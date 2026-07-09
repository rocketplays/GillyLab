#!/usr/bin/env node
/**
 * Live result patcher. During a card, pulls ESPN's per-bout status and writes the
 * results straight into data/event.json, so the featured fight card fills in as
 * the night goes on.
 *
 * Deliberately narrow. It touches ONE event and only the result fields:
 *   status, winnerFighterSlug, resultRound, resultTime, method, methodDetails,
 *   fighters[].outcome
 * It never adds, removes or reorders bouts, never writes the athlete cache, and
 * never rewrites an event it isn't actively tracking. Names come from the on-disk
 * cache keyed by ESPN's stable athlete id; a miss is fetched into memory only. The heavy, authoritative rebuild stays in
 * fetch-espn-events.cjs on the twice-daily schedule.
 *
 * Cost per poll: 1 request for the competitions list (which arrives fully
 * hydrated, with competitors and winner flags) + 1 status request per bout.
 * ~14 calls for a 13-bout card. No key, no quota.
 *
 * Two safety rules matter more than freshness:
 *   - A decided bout is never un-decided. If we have a winner and ESPN briefly
 *     reports none, we keep ours. Results only ever move forward.
 *   - The event is never marked 'completed' while it is still inside the
 *     featured window. Only 'completed' events leave event.json, and the card
 *     must stay on screen for the aftermath. The daily rebuild retires it.
 *
 * Usage: node scripts/fetch-espn-live.cjs [--dry] [--event <slug>] [--now <iso>]
 * Exit 0 always. Prints "changed=true|false" to $GITHUB_OUTPUT when set.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const E = require('./fetch-espn-events.cjs');
const B = require('./fetch-espn-bouts.cjs');

const ROOT = path.resolve(__dirname, '..');
const EVENT_PATH = path.join(ROOT, 'data', 'event.json');
const CACHE_PATH = path.join(ROOT, 'data', 'espn-athletes.json');
const CORE = 'https://sports.core.api.espn.com/v2/sports/mma';
const LEAGUE = `${CORE}/leagues/ufc`;

const args = process.argv.slice(2);
const argS = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const DRY = args.includes('--dry');
const ONLY = argS('--event', null);
const NOW = argS('--now', null) ? Date.parse(argS('--now', null)) : Date.now();

const HOUR = 3600 * 1000;
// Start polling a little before the first walkout, and keep going for as long as
// the card holds the featured slot on the site (index.html: startsAt + 10h).
const LEAD_IN_MS = 30 * 60 * 1000;
const FEATURED_WINDOW_MS = 10 * HOUR;

const loadJson = (p, d) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return d; } };

async function getJson(url, tries = 3) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 12000);
      const r = await fetch(E.fixRef(url), { signal: ctl.signal, headers: { 'User-Agent': 'GillyLab/1.0 (https://gillylab.com)' } });
      clearTimeout(t);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) { lastErr = e; await new Promise((s) => setTimeout(s, 300 * (i + 1))); }
  }
  throw lastErr;
}

// ── pure ─────────────────────────────────────────────────────────────────────

// The one event worth polling: doors are open and the card still holds the
// featured slot. Returns null the rest of the week, which is most of the time —
// the caller should exit immediately and cheaply.
function pickLiveEvent(events, now) {
  const live = (events || []).filter((e) => {
    if (e.status === 'completed') return false;
    const open = Date.parse(e.prelimsStartsAt || e.startsAt);
    const shut = Date.parse(e.startsAt) + FEATURED_WINDOW_MS;
    if (!isFinite(open) || !isFinite(shut)) return false;
    return now >= open - LEAD_IN_MS && now <= shut;
  });
  live.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  return live[0] || null;
}

// Fold one ESPN competition into one of our bouts. Returns a list of the fields
// that actually changed, so the caller can decide whether a commit is warranted.
// Results only move forward: a bout we already have a winner for is never reset,
// because a momentary ESPN blip must not wipe a result off the live card.
function applyResult(bout, espn) {
  const changed = [];
  const set = (k, v) => { if (v != null && bout[k] !== v) { changed.push(k + '=' + v); bout[k] = v; } };

  const decided = !!(espn.status && espn.status.type && espn.status.type.completed);
  if (bout.winnerFighterSlug && !espn.winnerSlug) return changed;   // never un-decide

  set('status', E.boutStatusOf(espn.status));
  if (decided) {
    const { method, methodDetails } = E.methodOf(espn.status.result);
    set('method', method);
    if (methodDetails != null && bout.methodDetails !== methodDetails) { changed.push('methodDetails=' + methodDetails); bout.methodDetails = methodDetails; }
    set('resultRound', (espn.status.period || 0) || null);
    set('resultTime', E.resultTimeOf(espn.status));
    set('winnerFighterSlug', espn.winnerSlug);
    (bout.fighters || []).forEach((f) => {
      const isWinner = espn.winnerSlug != null && f.fighterSlug === espn.winnerSlug;
      const o = E.outcomeFor(true, isWinner, !!espn.winnerSlug, method);
      if (f.outcome !== o) { changed.push(f.fighterName + '=' + o); f.outcome = o; }
    });
    if (bout.dataAvailability) bout.dataAvailability.result = 'available';
  }
  if (changed.length) bout.lastSyncedAt = new Date().toISOString();
  return changed;
}

// Never retire the card while it still owns the featured slot — 'completed' is
// what moves an event out of event.json, and the results have to stay on screen.
function liveEventStatus(bouts, startsAt, now) {
  const s = E.eventStatusOf(bouts, startsAt, now);
  if (s === 'completed' && now < Date.parse(startsAt) + FEATURED_WINDOW_MS) return 'live';
  return s;
}

// ── network ──────────────────────────────────────────────────────────────────

async function espnBouts(espnId, cache) {
  const comps = await getJson(`${LEAGUE}/events/${espnId}/competitions?limit=50`);
  const out = [];
  for (const c of comps.items || []) {
    const cs = (c.competitors || []);
    if (cs.length !== 2) continue;
    let status = null;
    try { status = await getJson(c.status.$ref); } catch (e) { /* bout not started */ }

    const fighters = [];
    for (const cc of cs) {
      let a = cache.athletes[cc.id];
      if (!a) {
        // Cache miss (a late replacement the daily rebuild hasn't seen). Fetch the
        // name, but keep it in memory ONLY. Persisting a stub here would poison the
        // shared cache: fetch-espn-events honours any entry with a fetchedAt for 30
        // days, so this fighter would lose his flag, record and headshot until the
        // TTL expired. The next full rebuild fetches him properly.
        try {
          const raw = await getJson(`${CORE}/athletes/${cc.id}`);
          a = { name: raw.fullName || raw.displayName, slug: raw.slug || null };
        } catch (e) { a = null; }
      }
      if (!a || !a.name) { fighters.length = 0; break; }
      fighters.push({ name: a.name, slug: a.slug, winner: cc.winner === true });
    }
    if (fighters.length !== 2) continue;
    const w = fighters.find((f) => f.winner);
    out.push({ names: fighters.map((f) => f.name), winnerSlug: w ? w.slug : null, status });
  }
  return out;
}

async function main() {
  const doc = loadJson(EVENT_PATH, null);
  if (!doc || !Array.isArray(doc.data)) { console.log('[live] event.json unreadable — skipping.'); return emit(false, false); }

  const evt = ONLY ? doc.data.find((e) => e.slug === ONLY) : pickLiveEvent(doc.data, NOW);
  if (!evt) { console.log('[live] no card in its live window — nothing to do.'); return emit(false, false); }

  const espnId = String(evt.id || '').replace(/^espn-/, '');
  if (!/^\d+$/.test(espnId)) { console.log(`[live] ${evt.slug}: no ESPN id on the event — skipping.`); return emit(false, false); }
  console.log(`[live] ${evt.title} (${evt.slug}) — polling ESPN event ${espnId}`);

  const cache = loadJson(CACHE_PATH, { athletes: {} });
  cache.athletes = cache.athletes || {};

  let live;
  try { live = await espnBouts(espnId, cache); }
  catch (e) { console.warn('[live] ESPN fetch failed (non-fatal):', e.message); return emit(false, false); }
  if (!live.length) { console.log('[live] ESPN returned no bouts — leaving the card alone.'); return emit(false, false); }

  const changes = [];
  for (const eb of live) {
    const bout = (evt.bouts || []).find((b) => B.sameBout((b.fighters || []).map((f) => f.fighterName), eb.names));
    if (!bout) continue;   // additive changes are the daily rebuild's job, not ours
    const ch = applyResult(bout, eb);
    if (ch.length) changes.push(`${eb.names.join(' vs ')}: ${ch.join(', ')}`);
  }

  const before = evt.status;
  evt.status = liveEventStatus(evt.bouts || [], evt.startsAt, NOW);
  if (evt.status !== before) changes.push(`event status: ${before} -> ${evt.status}`);

  const total = (evt.bouts || []).filter((b) => !b.isCancelled).length;
  const decided = (evt.bouts || []).filter((b) => b.winnerFighterSlug).length;
  const allDecided = total > 0 && decided === total;
  console.log(`[live] ${decided}/${total} bouts decided · ${changes.length} change(s) this poll`);
  changes.forEach((c) => console.log('   + ' + c));

  if (!changes.length) return emit(false, allDecided);
  if (DRY) { console.log('[live] --dry: not writing.'); return emit(true, allDecided); }

  fs.writeFileSync(EVENT_PATH, JSON.stringify(doc));   // event.json only — never the athlete cache
  console.log('[live] wrote data/event.json');
  return emit(true, allDecided);
}

// The poller watches these two lines: `changed` decides whether to commit+deploy,
// `allDecided` lets it stop polling once the main event is in the books rather
// than idling until the featured window shuts hours later.
function emit(changed, allDecided) {
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
  console.log(`changed=${changed}`);
  console.log(`allDecided=${!!allDecided}`);
}

module.exports = { pickLiveEvent, applyResult, liveEventStatus, LEAD_IN_MS, FEATURED_WINDOW_MS };
if (require.main === module) main().catch((e) => { console.error('[live] non-fatal error:', e.message); emit(false, false); });
