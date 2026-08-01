'use strict';
// Closing-line capture. Runs on fight day and, ~10 minutes before a card section
// starts, records the consensus moneyline for the fights in THAT section into
// data/odds-closing.json. Two firings per card:
//   • ~10 min before prelims  -> capture the prelim + early-prelim bouts
//   • ~10 min before main card -> capture the main-card bouts
// Capturing each section right before it starts gives a truer closing line (main
// card odds keep moving after prelims begin). The client merges this overlay into
// ODDS_HISTORY at load, so the retrospective's "Closing odds" fills in automatically
// for every card — no hand editing of index.html.
//
// Modes:
//   (default)        time-gated: only acts when now is inside a capture window
//   --check          print capture=true/false + phase + slug, then exit (CI gate)
//   --force          ignore the time gate; use FORCE_SLUG + FORCE_PHASE (manual run)
// Odds source: env ODDS_SRC (a fresh odds.json the workflow just fetched), else data/odds.json.

const fs = require('fs');
const path = require('path');
const { consensus, lastNameOf, pairKey } = require('./odds-history-lib.cjs');

const ROOT = path.resolve(__dirname, '..');
const EVENT_PATH = path.join(ROOT, 'data', 'event.json');
const CLOSING_PATH = path.join(ROOT, 'data', 'odds-closing.json');
const ODDS_SRC = process.env.ODDS_SRC || path.join(ROOT, 'data', 'odds.json');

// Capture in the window [start-20m, start-2m]. Every tick inside re-captures and the
// LATEST one wins (see the store logic below) — so the recorded line is the freshest
// one before the bell, and it no longer matters WHICH tick lands, only that one does.
// That's the reliability fix: GitHub Actions' scheduled crons are routinely delayed
// (and sometimes skipped) by several minutes, so the old 10-min window on a */5 cron
// got stepped over — that's how a whole section's prelims closing lines went missing.
// An 18-min window on a */3 cron gives ~6 shots, robust to a long Actions delay, and
// still captures nothing (bets keep grading, no CLV) only if EVERY tick is lost.
const WIN_EARLY_MS = 20 * 60 * 1000;
const WIN_LATE_MS  = 2 * 60 * 1000;

const loadJson = (p, fb) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fb; } };
// event.json and the odds feed spell names differently — accents ("Benoît" vs
// "Benoit"), punctuation ("Saint-Denis" vs "Saint Denis"), generational suffixes
// ("Khalil Rountree Jr" vs "Khalil Rountree", "Kai Kamaka III" vs "Kai Kamaka"), and
// extra surnames ("Javier Reyes" vs "Javier Reyes Rugeles"). Normalize all of those
// away, then compare (with a last-name fallback).
const SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v']);
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9\s]/g, ' ').trim().split(/\s+/)   // punctuation -> word break
  .filter(t => t && !SUFFIXES.has(t))                  // drop Jr / Sr / II–V
  .join('');
function fighterMatch(a, b) {
  const na = norm(a), nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 6 && nb.length >= 6 && (na.includes(nb) || nb.includes(na))) return true;
  const la = norm(lastNameOf(a)), lb = norm(lastNameOf(b));
  return la && la === lb && la.length >= 4;
}
function findFight(f1, f2, odds) {
  return odds.find(o => o && o.home_team && o.away_team && (
    (fighterMatch(o.home_team, f1) && fighterMatch(o.away_team, f2)) ||
    (fighterMatch(o.home_team, f2) && fighterMatch(o.away_team, f1))
  ));
}
function easternDateStr(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso || '').split('T')[0] || '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
const isMainCard = (b) => /main\s*card/i.test(b.cardSection || '');

// Which event + section is ~10 min from starting right now (or null).
function pickTarget(events, now) {
  const inWin = (t) => isFinite(t) && now >= t - WIN_EARLY_MS && now <= t - WIN_LATE_MS;
  for (const ev of events) {
    if (inWin(Date.parse(ev.prelimsStartsAt || ''))) return { ev, phase: 'prelims' };
    if (inWin(Date.parse(ev.startsAt || '')))        return { ev, phase: 'maincard' };
  }
  return null;
}

// Catch-up window: an event whose main card started between 2h and 36h ago is
// "over enough" that a live in-window capture would have already happened if it
// was going to, but recent enough that data/odds.json (refreshed twice daily by
// update-odds.yml) still very likely carries its pre-fight lines — the-odds-api
// doesn't pull a fight's market the instant it starts, and this repo's own history
// backs that up (2026-08-01's odds.json still listed all 14 of that day's bouts
// hours after the card ended). Below 2h, the timed capture still has shots left
// at its real window and shouldn't be preempted by an approximate one; above 36h,
// odds.json has almost certainly rolled the event's markets off by then anyway.
const CATCHUP_MIN_MS = 2 * 60 * 60 * 1000;
const CATCHUP_MAX_MS = 36 * 60 * 60 * 1000;

function main() {
  const argv = process.argv.slice(2);
  const check = argv.includes('--check');
  const force = argv.includes('--force');
  const catchup = argv.includes('--catchup');
  const doc = loadJson(EVENT_PATH, null);
  const events = (doc && Array.isArray(doc.data)) ? doc.data : [];
  const now = Date.now();

  const store = loadJson(CLOSING_PATH, null) || { generatedAt: null, fights: [] };
  if (!Array.isArray(store.fights)) store.fights = [];

  // One section's bouts -> closing lines. `section` is the label stored ('prelims' /
  // 'maincard'); the existing-record lookup is by slug+pair (section-independent), so a
  // later, fresher capture of the same fight OVERWRITES an earlier one — that's what lets
  // the main-card window refresh the prelims-time fallback below. `allowOverwrite: false`
  // (catch-up mode only) instead ADDS ONLY what's genuinely missing and never touches an
  // existing record — a real precise in-window capture always wins over an approximate
  // late one, even if the catch-up job runs after it.
  function captureSection(ev, odds, date, bouts, section, allowOverwrite) {
    let added = 0, updated = 0; const unmatched = [];
    bouts.forEach(b => {
      const fr = b.fighters || [];
      if (fr.length !== 2) return;
      const f1 = fr[0].fighterName, f2 = fr[1].fighterName;
      if (!f1 || !f2 || b.isCancelled) return;
      const key = pairKey(f1, f2);
      const existing = store.fights.find(x => x.slug === ev.slug && pairKey(x.f1, x.f2) === key);
      if (existing && !allowOverwrite) return;   // catch-up: never touch a record that's already there
      const fight = findFight(f1, f2, odds);
      if (!fight) { unmatched.push(f1 + ' vs ' + f2 + ' (not in feed)'); return; }
      const c = consensus(fight);
      const homeIsF1 = fighterMatch(fight.home_team, f1);
      const o1 = homeIsF1 ? c.home : c.away;
      const o2 = homeIsF1 ? c.away : c.home;
      if (o1 == null || o2 == null) { unmatched.push(f1 + ' vs ' + f2 + ' (no price)'); return; }
      const rec = { slug: ev.slug, date, section, f1, f2, o1, o2, capturedAt: new Date().toISOString() };
      if (existing) {
        if (force || existing.o1 !== o1 || existing.o2 !== o2) { Object.assign(existing, rec); updated++; }
      } else {
        store.fights.push(rec); added++;
      }
    });
    return { added, updated, unmatched };
  }

  if (catchup) {
    const odds = loadJson(ODDS_SRC, []);
    if (!Array.isArray(odds) || !odds.length) { console.log('[closing] catchup: no odds source at ' + ODDS_SRC); return; }
    let anyChange = false;
    events.forEach(ev => {
      const startedAgo = now - (Date.parse(ev.startsAt || ev.prelimsStartsAt || '') || NaN);
      if (!isFinite(startedAgo) || startedAgo < CATCHUP_MIN_MS || startedAgo > CATCHUP_MAX_MS) return;
      const prelimBouts = (ev.bouts || []).filter(b => !isMainCard(b));
      const mainBouts   = (ev.bouts || []).filter(b =>  isMainCard(b));
      if (!prelimBouts.length && !mainBouts.length) return;
      const date = easternDateStr(ev.startsAt || ev.prelimsStartsAt);
      const rp = captureSection(ev, odds, date, prelimBouts, 'prelims', false);
      const rm = captureSection(ev, odds, date, mainBouts, 'maincard', false);
      const added = rp.added + rm.added;
      if (added) anyChange = true;
      if (added || rp.unmatched.length || rm.unmatched.length) {
        console.log(`[closing] CATCHUP ${ev.slug}: +${added} added (prelims ${rp.added}, maincard ${rm.added})`
          + ([...rp.unmatched, ...rm.unmatched].length ? ' — unmatched: ' + [...rp.unmatched, ...rm.unmatched].join('; ') : ''));
      }
    });
    if (anyChange) {
      store.generatedAt = new Date().toISOString();
      fs.writeFileSync(CLOSING_PATH, JSON.stringify(store, null, 1) + '\n');
    } else {
      console.log('[closing] catchup: nothing missing in the 2h-36h window');
    }
    return;
  }

  let target = null;
  if (force) {
    const ev = events.find(e => e.slug === process.env.FORCE_SLUG) || events[0];
    if (ev) target = { ev, phase: /main/i.test(process.env.FORCE_PHASE || '') ? 'maincard' : 'prelims' };
  } else {
    target = pickTarget(events, now);
  }

  if (!target) { console.log('capture=false'); return; }
  console.log('capture=true');
  console.log('phase=' + target.phase);
  console.log('slug=' + target.ev.slug);
  if (check) return;

  const odds = loadJson(ODDS_SRC, []);
  if (!Array.isArray(odds) || !odds.length) { console.log('[closing] no odds source at ' + ODDS_SRC + '; nothing captured'); return; }

  const { ev, phase } = target;
  const date = easternDateStr(ev.startsAt || ev.prelimsStartsAt);

  const prelimBouts = (ev.bouts || []).filter(b => !isMainCard(b));
  const mainBouts   = (ev.bouts || []).filter(b =>  isMainCard(b));
  let r;
  if (phase === 'maincard') {
    r = captureSection(ev, odds, date, mainBouts, 'maincard', true);
  } else {
    r = captureSection(ev, odds, date, prelimBouts, 'prelims', true);
    // FALLBACK: snapshot the main card NOW, at the prelims window, so a MISSED main-card
    // window (GitHub Actions skipped/delayed the whole slot — how this section's lines went
    // missing in the first place) degrades to a slightly-early main-card line instead of
    // NOTHING. When the main-card window does fire, it OVERWRITES this with the true closing
    // line (LATEST wins). Same odds feed already in hand — no extra fetch.
    const rm = captureSection(ev, odds, date, mainBouts, 'maincard', true);
    r.added += rm.added; r.updated += rm.updated; r.unmatched = r.unmatched.concat(rm.unmatched);
  }

  if (r.added || r.updated) {
    store.generatedAt = new Date().toISOString();
    fs.writeFileSync(CLOSING_PATH, JSON.stringify(store, null, 1) + '\n');
  }
  console.log(`[closing] ${ev.slug} ${phase}: +${r.added} added, ${r.updated} updated, ${r.unmatched.length} unmatched`
    + (r.unmatched.length ? ' — ' + r.unmatched.join('; ') : ''));
}

main();
