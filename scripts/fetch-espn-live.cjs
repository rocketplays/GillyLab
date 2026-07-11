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
const STATS_PATH = path.join(ROOT, 'data', 'fight-stats.json');
// Small companion file the browser merges in-session, so a visitor mid-card sees
// the new history row and box score without re-downloading the 9.8MB fight-stats.
const LIVE_PATH = path.join(ROOT, 'data', 'live-card.json');
const LIVE_PRUNE_DAYS = 21;
const CORE = 'https://sports.core.api.espn.com/v2/sports/mma';
const LEAGUE = `${CORE}/leagues/ufc`;

const args = process.argv.slice(2);
const argS = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const DRY = args.includes('--dry');
const ONLY = argS('--event', null);
const NOW = argS('--now', null) ? Date.parse(argS('--now', null)) : Date.now();
const NO_ENRICH = args.includes('--no-enrich');   // results only; skip box score + history

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
  if (bout.winnerFighterSlug && !espn.winnerSlug && !espn.winnerName) return changed;   // never un-decide

  set('status', E.boutStatusOf(espn.status));
  if (decided) {
    const { method, methodDetails } = E.methodOf(espn.status.result);
    set('method', method);
    if (methodDetails != null && bout.methodDetails !== methodDetails) { changed.push('methodDetails=' + methodDetails); bout.methodDetails = methodDetails; }
    set('resultRound', (espn.status.period || 0) || null);
    set('resultTime', E.resultTimeOf(espn.status));
    // Identify the winning bout fighter by slug, falling back to NAME. ESPN can
    // flag a winner (competitor.winner === true) while that athlete's record has a
    // null slug — common for a late replacement — which used to leave the bout a
    // draw despite a real, methodful result.
    const nm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');
    let winner = null;
    if (espn.winnerSlug) winner = (bout.fighters || []).find((f) => f.fighterSlug === espn.winnerSlug);
    if (!winner && espn.winnerName) winner = (bout.fighters || []).find((f) => nm(f.fighterName) === nm(espn.winnerName));
    const hasWinner = !!(espn.winnerSlug || espn.winnerName);
    set('winnerFighterSlug', winner ? winner.fighterSlug : espn.winnerSlug);
    (bout.fighters || []).forEach((f) => {
      const isWinner = winner ? (f === winner) : (espn.winnerSlug != null && f.fighterSlug === espn.winnerSlug);
      const o = E.outcomeFor(true, isWinner, hasWinner, method);
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

// ── box score + fight history, derived from the bout we already have ─────────

// ESPN returns statistics as nested split/category/stat objects. Flatten to a bag.
function flatStats(doc) {
  const out = {};
  (((doc || {}).splits || {}).categories || []).forEach((c) => (c.stats || []).forEach((x) => { out[x.name] = x.value; }));
  return out;
}
const nz = (v) => (typeof v === 'number' ? v : 0);
const ctrlTime = (v) => { const t = Math.round(nz(v)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };

// The exact shape data/fight-stats.json already stores. Verified field-for-field
// against 26 fighter-rows that fight-stats-backfill.py wrote for a real card:
// zero mismatches, and head+body+leg and distance+clinch+ground each reconcile
// to sigStrikesLanded.
function boxFrom(st) {
  const s = (...k) => k.reduce((a, x) => a + nz(st[x]), 0);
  return {
    kd: nz(st.knockDowns),
    sigL: nz(st.sigStrikesLanded), sigA: nz(st.sigStrikesAttempted),
    totL: nz(st.totalStrikesLanded), totA: nz(st.totalStrikesAttempted),
    tdL: nz(st.takedownsLanded), tdA: nz(st.takedownsAttempted),
    sub: nz(st.submissions), rev: nz(st.reversals), ctrl: ctrlTime(st.timeInControl),
    head: [s('sigDistanceHeadStrikesLanded', 'sigClinchHeadStrikesLanded', 'sigGroundHeadStrikesLanded'),
      s('sigDistanceHeadStrikesAttempted', 'sigClinchHeadStrikesAttempted', 'sigGroundHeadStrikesAttempted')],
    body: [s('sigDistanceBodyStrikesLanded', 'sigClinchBodyStrikesLanded', 'sigGroundBodyStrikesLanded'),
      s('sigDistanceBodyStrikesAttempted', 'sigClinchBodyStrikesAttempted', 'sigGroundBodyStrikesAttempted')],
    leg: [s('sigDistanceLegStrikesLanded', 'sigClinchLegStrikesLanded', 'sigGroundLegStrikesLanded'),
      s('sigDistanceLegStrikesAttempted', 'sigClinchLegStrikesAttempted', 'sigGroundLegStrikesAttempted')],
    dist: [s('sigDistanceHeadStrikesLanded', 'sigDistanceBodyStrikesLanded', 'sigDistanceLegStrikesLanded'),
      s('sigDistanceHeadStrikesAttempted', 'sigDistanceBodyStrikesAttempted', 'sigDistanceLegStrikesAttempted')],
    clinch: [s('sigClinchHeadStrikesLanded', 'sigClinchBodyStrikesLanded', 'sigClinchLegStrikesLanded'),
      s('sigClinchHeadStrikesAttempted', 'sigClinchBodyStrikesAttempted', 'sigClinchLegStrikesAttempted')],
    ground: [s('sigGroundHeadStrikesLanded', 'sigGroundBodyStrikesLanded', 'sigGroundLegStrikesLanded'),
      s('sigGroundHeadStrikesAttempted', 'sigGroundBodyStrikesAttempted', 'sigGroundLegStrikesAttempted')],
  };
}

// ESPN publishes a statistics object BEFORE the fight, with every value zero.
// Writing that would give the fighter an empty box score forever, so a row is
// only worth saving once somebody has actually thrown something.
function hasRealStats(a, b) {
  const live = (x) => x.sigA > 0 || x.totA > 0 || x.tdA > 0 || x.kd > 0;
  return live(a) || live(b);
}

// "KO/TKO" + "Punches" -> "KO/TKO (Punches)"; "Decision - Unanimous" -> "Decision (Unanimous)",
// which is how every row already in FIGHT_HISTORY is written.
function methodLabel(method, detail) {
  const m = String(method || '').trim();
  if (!m) return '';
  const dec = /^decision\s*-\s*(.+)$/i.exec(m);
  if (dec) return 'Decision (' + dec[1].trim() + ')';
  const d = String(detail || '').trim();
  if (!d || d.toLowerCase() === m.toLowerCase()) return m;
  return m + ' (' + d + ')';
}

// FIGHT_HISTORY dates read "Jul 11, 2026" — the card's US-Eastern calendar day,
// the same convention the event slug uses.
function historyDate(startsAt) {
  const d = new Date(startsAt);
  if (!isFinite(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric' }).format(d);
}
const resultLetter = (outcome) => ({ win: 'W', loss: 'L', draw: 'D', no_contest: 'NC' }[outcome] || '');

// Rows are keyed by (opponent, date) so a re-poll — or the permanent import
// landing later — can never double up. Opponent alone is not enough: Fiziev has
// fought Gaethje twice.
function hasRow(rows, opponent, date) {
  return (rows || []).some((r) => r.opponent === opponent && r.date === date);
}

// The live file only ever carries the current card. Anything older has long since
// been folded into fight-stats.json and index.html by the permanent importers.
function pruneLive(live, now) {
  now = now || Date.now();
  let dropped = 0;
  for (const name of Object.keys(live.fighters || {})) {
    const e = live.fighters[name];
    const fresh = (rows) => (rows || []).filter((r) => {
      const t = Date.parse(r.date);
      return !isFinite(t) || (now - t) < LIVE_PRUNE_DAYS * 86400000;
    });
    e.history = fresh(e.history); e.stats = fresh(e.stats);
    if (!e.history.length && !e.stats.length) { delete live.fighters[name]; dropped++; }
  }
  return dropped;
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
    out.push({
      names: fighters.map((f) => f.name), slugs: fighters.map((f) => f.slug),
      winnerSlug: w ? w.slug : null, winnerName: w ? w.name : null, status,
      statRefs: cs.map((cc) => (cc.statistics && cc.statistics.$ref) || null),
    });
  }
  return out;
}

// For a bout that has just been decided, pull both fighters' box scores and
// write: a row into data/fight-stats.json (which the app already reads), and a
// row into data/live-history.json for each fighter's FIGHT_HISTORY.
//
// Costs 2 requests, once, per finished bout. A bout already recorded costs zero.
async function enrichFinishedBout(evt, bout, eb, stats, live) {
  const date = historyDate(evt.startsAt);
  const names = (bout.fighters || []).map((f) => f.fighterName);
  if (names.length !== 2 || !date) return [];

  const slot = (n) => (live.fighters[n] = live.fighters[n] || { history: [], stats: [] });
  // Already captured (or the permanent import beat us to it).
  if (hasRow(stats[names[0]], names[1], date) && hasRow(slot(names[0]).history, names[1], date)) return [];
  if (!eb.statRefs || eb.statRefs.some((r) => !r)) return [];

  let boxes;
  try { boxes = await Promise.all(eb.statRefs.map(async (r) => boxFrom(flatStats(await getJson(r))))); }
  catch (e) { console.warn(`[live] stats fetch failed for ${names.join(' vs ')} (will retry): ${e.message}`); return []; }

  // ESPN can flip the result before it posts the numbers. Wait for real ones.
  if (!hasRealStats(boxes[0], boxes[1])) { console.log(`[live] ${names.join(' vs ')}: stats still zeroed — retrying next poll.`); return []; }

  // ESPN's competitor order and ours can differ; align by slug.
  const idx = (slug) => { const i = (eb.slugs || []).indexOf(slug); return i < 0 ? null : i; };
  const changed = [];
  const method = methodLabel(bout.method, bout.methodDetails);
  const eventName = evt.espnName || evt.title || '';

  (bout.fighters || []).forEach((f, i) => {
    const me = f.fighterName, them = (bout.fighters[1 - i] || {}).fighterName;
    const mi = idx(f.fighterSlug), oi = idx((bout.fighters[1 - i] || {}).fighterSlug);
    if (mi == null || oi == null) return;

    const statRow = { date, opponent: them, result: resultLetter(f.outcome), f: boxes[mi], o: boxes[oi] };
    const histRow = {
      date, opponent: them, result: resultLetter(f.outcome), method,
      round: bout.resultRound || null, time: bout.resultTime || null,
      event: eventName, org: 'UFC',
    };
    if (!hasRow(stats[me], them, date)) {
      (stats[me] = stats[me] || []).unshift(statRow);
      changed.push(`box score: ${me} vs ${them}`);
    }
    const sl = slot(me);
    if (!hasRow(sl.stats, them, date)) sl.stats.unshift(statRow);
    if (!hasRow(sl.history, them, date)) {
      sl.history.unshift(histRow);
      changed.push(`history: ${me} ${resultLetter(f.outcome)} vs ${them}`);
    }
  });
  return changed;
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

  const stats = loadJson(STATS_PATH, {});
  const card = loadJson(LIVE_PATH, { fighters: {} });   // `live` is already the ESPN bout list
  card.fighters = card.fighters || {};
  pruneLive(card, NOW);
  const statsBefore = JSON.stringify(stats).length, liveBefore = JSON.stringify(card.fighters);

  const changes = [];
  for (const eb of live) {
    const bout = (evt.bouts || []).find((b) => B.sameBout((b.fighters || []).map((f) => f.fighterName), eb.names));
    if (!bout) continue;   // additive changes are the daily rebuild's job, not ours
    const ch = applyResult(bout, eb);
    if (ch.length) changes.push(`${eb.names.join(' vs ')}: ${ch.join(', ')}`);

    // A finished fight also belongs in both fighters' history and box score.
    if (bout.status === 'completed' && !NO_ENRICH) {
      const enr = await enrichFinishedBout(evt, bout, eb, stats, card);
      changes.push(...enr);
    }
  }
  const statsDirty = JSON.stringify(stats).length !== statsBefore;
  const liveDirty = JSON.stringify(card.fighters) !== liveBefore;

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

  fs.writeFileSync(EVENT_PATH, JSON.stringify(doc));   // never the athlete cache
  if (statsDirty) { fs.writeFileSync(STATS_PATH, JSON.stringify(stats)); console.log('[live] wrote data/fight-stats.json'); }
  if (liveDirty) { card.generatedAt = new Date().toISOString(); fs.writeFileSync(LIVE_PATH, JSON.stringify(card, null, 1) + '\n'); console.log('[live] wrote data/live-card.json'); }
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

module.exports = { pickLiveEvent, applyResult, liveEventStatus, boxFrom, flatStats, hasRealStats, methodLabel, historyDate, resultLetter, hasRow, pruneLive, enrichFinishedBout, LEAD_IN_MS, FEATURED_WINDOW_MS };
if (require.main === module) main().catch((e) => { console.error('[live] non-fatal error:', e.message); emit(false, false); });
