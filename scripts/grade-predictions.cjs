#!/usr/bin/env node
/* Phase-1 prediction grader (CLV + calibration).
 *
 * Companion to scripts/log-predictions.cjs. Joins the banked snapshot series in
 * data/predictions-log.json to fight RESULTS (data/event.json + event-recent.json)
 * and produces two internal files:
 *
 *   data/predictions-graded.json    — one append-only record per decided fight
 *   data/predictions-scorecard.json — aggregate metrics, recomputed each run
 *
 * We deliberately grade CLV and calibration, NOT ROI:
 *   • CLOSING-LINE VALUE (bet-free): for each fight, did the market move TOWARD
 *     the model's lean between the first snapshot (opener proxy) and the last
 *     pre-fight snapshot (closer proxy)? Positive = the model saw value the market
 *     later confirmed. Lower variance than win/loss, so it means something sooner.
 *   • CALIBRATION: grade the model's OPENING number (locked before the line
 *     moved) against the actual result — when we say 60%, does it hit ~60%?
 *
 * Honesty guardrails: grade the opening model number (never a post-move one);
 * only decided, non-cancelled bouts; append-only + idempotent (a fight is graded
 * exactly once); internal only.
 *
 * NOTE (pre-upgrade): on the free odds tier the "close" is our last twice-daily
 * snapshot, an approximation. Treat CLV as directional until the paid history
 * feed makes the true closing line available — the schema doesn't change then.
 *
 * Usage: node scripts/grade-predictions.cjs [--dry-run]
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LOG_PATH = path.join(ROOT, 'data', 'predictions-log.json');
const GRADED_PATH = path.join(ROOT, 'data', 'predictions-graded.json');
const SCORECARD_PATH = path.join(ROOT, 'data', 'predictions-scorecard.json');
const LEAN_EPS = 0.02; // a "leaned" fight = model disagreed with market by >= 2 pts

// ---------- helpers ----------
function readJSON(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; } }
function norm(s) {
  return String(s == null ? '' : s).toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}
function pairId(a, b) { return [norm(a), norm(b)].sort().join('|'); }
function round4(x) { return x == null ? null : Math.round(x * 1e4) / 1e4; }

// ---------- results index from event feeds ----------
// key: sorted-normalized name pair -> { fighters:[{name,slug}], winnerSlug,
// method, round, eventTitle }. Only decided, non-cancelled bouts.
function buildResultsIndex() {
  const idx = new Map();
  for (const file of ['event.json', 'event-recent.json']) {
    const j = readJSON(path.join(ROOT, 'data', file));
    const evs = (j && (j.data || j)) || [];
    for (const ev of evs) {
      for (const b of ev.bouts || []) {
        if (b.isCancelled) continue;
        const winnerSlug = b.winnerFighterSlug;
        if (!winnerSlug) continue; // not decided yet
        const fighters = (b.fighters || []).map(f => ({ name: f.fighterName, slug: f.fighterSlug, outcome: f.outcome }));
        if (fighters.length < 2 || !fighters[0].name || !fighters[1].name) continue;
        const key = pairId(fighters[0].name, fighters[1].name);
        const evDate = Date.parse(ev.startsAt || ev.eventDate || ev.venueDate || '');
        if (!idx.has(key)) idx.set(key, {
          fighters, winnerSlug, method: b.method || null, round: b.resultRound || null,
          eventTitle: ev.title || null, date: isFinite(evDate) ? evDate : null
        });
      }
    }
  }
  return idx;
}

// which stored side (a/b) won, given the result bout's winnerSlug + names
function winnerSide(fight, result) {
  const win = result.fighters.find(f => f.slug === result.winnerSlug)
    || result.fighters.find(f => f.outcome === 'win');
  if (!win) return null;
  const wn = norm(win.name);
  if (wn === norm(fight.a.feed) || wn === norm(fight.a.db)) return 'A';
  if (wn === norm(fight.b.feed) || wn === norm(fight.b.db)) return 'B';
  // token-subset fallback (suffix/alias differences between feeds)
  const wt = new Set(norm(win.name).split(' ').filter(Boolean));
  const overlap = name => { const t = norm(name).split(' ').filter(Boolean); return t.length && t.every(x => wt.has(x)); };
  if (overlap(fight.a.feed) || overlap(fight.a.db)) return 'A';
  if (overlap(fight.b.feed) || overlap(fight.b.db)) return 'B';
  return null;
}

// ---------- grade one fight from its snapshot series + result ----------
// snaps: chronological snapshots for one fightId (each has model {pA}, market
// {impliedA}, capturedAt). Returns a graded record or null if not gradeable.
function gradeFight(fightId, snaps, result) {
  const withModel = snaps.filter(s => s.model && typeof s.model.pA === 'number');
  if (!withModel.length) return null;
  const side = winnerSide(withModel[0], result);
  if (side !== 'A' && side !== 'B') return null;
  const aWon = side === 'A' ? 1 : 0;

  const open = withModel[0], close = withModel[withModel.length - 1];
  const modelOpen = open.model.pA, modelClose = close.model.pA;
  const marketOpen = open.market.impliedA, marketClose = close.market.impliedA;

  // CLV (bet-free): did the market move toward the model's opening lean?
  const leanA = modelOpen - marketOpen;                 // >0 model higher on A than market
  const marketMoveA = (marketClose != null && marketOpen != null) ? marketClose - marketOpen : null;
  let clvToward = null, clvPts = null;
  if (marketMoveA != null && Math.abs(leanA) >= 1e-9) {
    clvPts = Math.sign(leanA) * marketMoveA;            // >0 = market drifted our way
    clvToward = clvPts > 0;
  }

  return {
    fightId,
    event: result.eventTitle || open.event || null,
    gradedAt: new Date().toISOString(),
    a: open.a, b: open.b,
    winner: side, method: result.method, round: result.round,
    aWon,
    rounds: open.rounds,
    modelOpen: round4(modelOpen), modelClose: round4(modelClose),
    marketOpen: round4(marketOpen), marketClose: round4(marketClose),
    leanA: round4(leanA),
    nSnapshots: snaps.length,
    clv: { toward: clvToward, pts: round4(clvPts), leaned: Math.abs(leanA) >= LEAN_EPS }
  };
}

// ---------- aggregate scorecard ----------
function brier(p, y) { return (p - y) * (p - y); }
function logloss(p, y) { const pc = Math.min(1 - 1e-12, Math.max(1e-12, p)); return -(y * Math.log(pc) + (1 - y) * Math.log(1 - pc)); }

function buildScorecard(graded) {
  const n = graded.length;
  const bins = Array.from({ length: 10 }, () => ({ n: 0, wins: 0, psum: 0 }));
  let mBrierO = 0, kBrierC = 0, mLogO = 0, kLogC = 0;
  let mCorrect = 0, mDecisive = 0, kCorrect = 0, kDecisive = 0;
  let clvN = 0, clvHits = 0, clvSum = 0, clvLeanN = 0, clvLeanHits = 0, clvLeanSum = 0;

  for (const g of graded) {
    const y = g.aWon;
    const po = g.modelOpen, kc = g.marketClose != null ? g.marketClose : g.marketOpen;
    // calibration on the model's opening number
    const bi = Math.min(9, Math.floor(po * 10));
    bins[bi].n++; bins[bi].wins += y; bins[bi].psum += po;
    // brier / logloss: model open vs market close (the sharp bar)
    mBrierO += brier(po, y); mLogO += logloss(po, y);
    kBrierC += brier(kc, y); kLogC += logloss(kc, y);
    // favorite-side accuracy
    if (Math.abs(po - 0.5) > 1e-9) { mDecisive++; if ((po > 0.5) === (y === 1)) mCorrect++; }
    if (Math.abs(kc - 0.5) > 1e-9) { kDecisive++; if ((kc > 0.5) === (y === 1)) kCorrect++; }
    // CLV
    if (g.clv && g.clv.toward != null) {
      clvN++; if (g.clv.toward) clvHits++; clvSum += g.clv.pts || 0;
      if (g.clv.leaned) { clvLeanN++; if (g.clv.toward) clvLeanHits++; clvLeanSum += g.clv.pts || 0; }
    }
  }

  const calibration = [];
  for (let i = 0; i < 10; i++) {
    const b = bins[i]; if (!b.n) continue;
    calibration.push({ band: `${i * 10}-${i * 10 + 10}%`, n: b.n, predicted: round4(b.psum / b.n), actual: round4(b.wins / b.n) });
  }

  return {
    generatedAt: new Date().toISOString(),
    nGraded: n,
    note: 'Internal proof-of-concept. Pre-upgrade CLV uses self-snapshotted close (approximate).',
    calibration,
    accuracy: {
      model: mDecisive ? round4(mCorrect / mDecisive) : null,
      marketClose: kDecisive ? round4(kCorrect / kDecisive) : null
    },
    brier: { modelOpen: n ? round4(mBrierO / n) : null, marketClose: n ? round4(kBrierC / n) : null },
    logloss: { modelOpen: n ? round4(mLogO / n) : null, marketClose: n ? round4(kLogC / n) : null },
    clv: {
      nWithMovement: clvN,
      hitRate: clvN ? round4(clvHits / clvN) : null,
      avgMovePts: clvN ? round4(clvSum / clvN) : null,
      leanedOnly: { n: clvLeanN, hitRate: clvLeanN ? round4(clvLeanHits / clvLeanN) : null, avgMovePts: clvLeanN ? round4(clvLeanSum / clvLeanN) : null }
    }
  };
}

// ---------- main ----------
function main() {
  const DRY = process.argv.includes('--dry-run');
  const log = readJSON(LOG_PATH);
  if (!log || !Array.isArray(log.snapshots)) { console.error('predictions-log.json missing; nothing to grade.'); return; }
  const results = buildResultsIndex();

  // group snapshots by fightId, chronological
  const byFight = new Map();
  for (const s of log.snapshots) {
    if (!byFight.has(s.fightId)) byFight.set(s.fightId, []);
    byFight.get(s.fightId).push(s);
  }
  for (const arr of byFight.values()) arr.sort((a, b) => Date.parse(a.capturedAt) - Date.parse(b.capturedAt));

  const gradedFile = readJSON(GRADED_PATH) || { schemaVersion: 1, createdAt: new Date().toISOString(), graded: [] };
  const already = new Set(gradedFile.graded.map(g => g.fightId));

  const DAY = 24 * 3600 * 1000;
  const now = Date.now();
  let newlyGraded = 0, pendingResult = 0, rejectedTiming = 0;
  for (const [fightId, snaps] of byFight) {
    if (already.has(fightId)) continue;
    // The fight must actually have happened: its scheduled time is in the past.
    // Guards against grading FUTURES markets (e.g. an announced rematch) whose
    // commence time is months out.
    const commence = Date.parse(snaps[0].commenceTime);
    if (!isFinite(commence) || commence > now) { pendingResult++; continue; }
    const result = results.get(fightId) || findResultFallback(fightId, snaps, results);
    if (!result) { pendingResult++; continue; }
    // The matched result must be the SAME meeting, not a prior/later bout between
    // the same two fighters (rematches). Require the result's event date to sit
    // within a few days of the predicted commence time.
    if (result.date == null || Math.abs(result.date - commence) > 4 * DAY) { rejectedTiming++; continue; }
    const rec = gradeFight(fightId, snaps, result);
    if (rec) { gradedFile.graded.push(rec); already.add(fightId); newlyGraded++; }
  }

  const scorecard = buildScorecard(gradedFile.graded);

  console.log(`graded ${gradedFile.graded.length} fights total (+${newlyGraded} new) | ${pendingResult} awaiting result | ${rejectedTiming} rejected (timing/rematch guard)`);
  if (gradedFile.graded.length) {
    console.log(`  model Brier ${scorecard.brier.modelOpen} vs market ${scorecard.brier.marketClose} (lower better)`);
    console.log(`  CLV hit rate ${scorecard.clv.hitRate == null ? 'n/a' : (scorecard.clv.hitRate * 100).toFixed(0) + '%'} over ${scorecard.clv.nWithMovement} fights w/ line movement`);
  }
  if (DRY) { console.log('[dry-run] not writing.'); return; }
  gradedFile.generatedAt = new Date().toISOString();
  fs.writeFileSync(GRADED_PATH, JSON.stringify(gradedFile, null, 2) + '\n');
  fs.writeFileSync(SCORECARD_PATH, JSON.stringify(scorecard, null, 2) + '\n');
  console.log(`wrote predictions-graded.json and predictions-scorecard.json`);
}

// fallback: match a logged fight to a result bout by token overlap when the two
// feeds spell a name differently enough that the sorted-norm-pair key misses.
function findResultFallback(fightId, snaps, results) {
  const s = snaps[0];
  const names = [s.a.feed, s.a.db, s.b.feed, s.b.db].filter(Boolean).map(norm);
  const has = (fighters, want) => fighters.some(f => { const fn = norm(f.name); return want.includes(fn) || fn.split(' ').every(t => want.join(' ').includes(t)); });
  for (const r of results.values()) {
    const rn = r.fighters.map(f => norm(f.name));
    const bothMatch = rn.every(n => names.includes(n) || names.some(x => x && (x.includes(n) || n.includes(x))));
    if (bothMatch) return r;
  }
  return null;
}

module.exports = { gradeFight, buildScorecard, winnerSide, pairId, norm };
if (require.main === module) main();
