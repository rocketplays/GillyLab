'use strict';
// Closing-line capture. Runs on fight day and, ~30 minutes before a card section
// starts, records the consensus moneyline for the fights in THAT section into
// data/odds-closing.json. Two firings per card:
//   • ~30 min before prelims  -> capture the prelim + early-prelim bouts
//   • ~30 min before main card -> capture the main-card bouts
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

// Fire ~30 min out: capture on the first cron tick inside [start-40m, start-15m];
// idempotency (a fight already recorded) makes later ticks in the window no-ops.
const WIN_EARLY_MS = 40 * 60 * 1000;
const WIN_LATE_MS  = 15 * 60 * 1000;

const loadJson = (p, fb) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fb; } };
// event.json and the odds feed spell names differently ("Benoît Saint Denis" vs
// "Benoit Saint-Denis", "Javier Reyes" vs "Javier Reyes Rugeles"), so match on an
// accent/punctuation-stripped comparison, then a last-name fallback.
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
function fighterMatch(a, b) {
  const na = norm(a), nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  return norm(lastNameOf(a)) === norm(lastNameOf(b)) && norm(lastNameOf(a)).length >= 4;
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

// Which event + section is ~30 min from starting right now (or null).
function pickTarget(events, now) {
  const inWin = (t) => isFinite(t) && now >= t - WIN_EARLY_MS && now <= t - WIN_LATE_MS;
  for (const ev of events) {
    if (inWin(Date.parse(ev.prelimsStartsAt || ''))) return { ev, phase: 'prelims' };
    if (inWin(Date.parse(ev.startsAt || '')))        return { ev, phase: 'maincard' };
  }
  return null;
}

function main() {
  const argv = process.argv.slice(2);
  const check = argv.includes('--check');
  const force = argv.includes('--force');
  const doc = loadJson(EVENT_PATH, null);
  const events = (doc && Array.isArray(doc.data)) ? doc.data : [];
  const now = Date.now();

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
  const store = loadJson(CLOSING_PATH, null) || { generatedAt: null, fights: [] };
  if (!Array.isArray(store.fights)) store.fights = [];

  const bouts = (ev.bouts || []).filter(b => phase === 'maincard' ? isMainCard(b) : !isMainCard(b));
  let added = 0, updated = 0; const unmatched = [];

  bouts.forEach(b => {
    const fr = b.fighters || [];
    if (fr.length !== 2) return;
    const f1 = fr[0].fighterName, f2 = fr[1].fighterName;
    if (!f1 || !f2 || b.isCancelled) return;
    const key = pairKey(f1, f2);
    const fight = findFight(f1, f2, odds);
    if (!fight) { unmatched.push(f1 + ' vs ' + f2 + ' (not in feed)'); return; }
    const c = consensus(fight);
    const homeIsF1 = fighterMatch(fight.home_team, f1);
    const o1 = homeIsF1 ? c.home : c.away;
    const o2 = homeIsF1 ? c.away : c.home;
    if (o1 == null || o2 == null) { unmatched.push(f1 + ' vs ' + f2 + ' (no price)'); return; }
    const rec = { slug: ev.slug, date, section: phase, f1, f2, o1, o2, capturedAt: new Date().toISOString() };
    const existing = store.fights.find(x => x.slug === ev.slug && pairKey(x.f1, x.f2) === key);
    if (existing) {
      // Idempotent: a fight already captured this card is left alone, unless a manual
      // --force re-run wants to overwrite it with a fresher line.
      if (force) { Object.assign(existing, rec); updated++; }
    } else {
      store.fights.push(rec); added++;
    }
  });

  if (added || updated) {
    store.generatedAt = new Date().toISOString();
    fs.writeFileSync(CLOSING_PATH, JSON.stringify(store, null, 1) + '\n');
  }
  console.log(`[closing] ${ev.slug} ${phase}: +${added} added, ${updated} updated, ${unmatched.length} unmatched`
    + (unmatched.length ? ' — ' + unmatched.join('; ') : ''));
}

main();
