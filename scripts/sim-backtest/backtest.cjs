#!/usr/bin/env node
/* Point-in-time backtest of the live fight simulator.
 *
 * For every decided UFC bout where both fighters are in the DB and each has >=2
 * prior UFC box-scored bouts, we reconstruct BOTH fighters exactly as they stood
 * the day before the fight — box-score career averages recomputed from only their
 * earlier bouts, win streak/finish rate recomputed from earlier history, the whole
 * FIGHT_HISTORY globally truncated to earlier bouts, the clock set to the fight
 * date (so recency/age/layoff are as-of), and CURRENT rankings disabled (they'd
 * leak the future; the code's simEstimateHistoricalTier fallback still supplies an
 * as-of resume signal). Then we run the real simWinProbability and compare to the
 * actual result.
 *
 * For each graded fight we also cache the intermediate scoring components
 * (both power-score profiles + the style/H2H/unproven/uncertainty terms) to
 * _components.json, so the tuner can re-evaluate thousands of parameter sets
 * cheaply without repeating the expensive point-in-time reconstruction.
 *
 * Usage: node backtest.cjs [--min-prior N] [--limit N]
 */
const fs = require('fs');
const path = require('path');
const HERE = __dirname;
const ROOT = path.resolve(HERE, '..', '..');

const data = require('./_sim-data.json');
const createScorer = require('./_scorer.cjs');
const FIGHT_STATS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'fight-stats.json'), 'utf8'));

const args = process.argv.slice(2);
const argVal = (flag, def) => { const i = args.indexOf(flag); return i >= 0 ? +args[i + 1] : def; };
const MIN_PRIOR = argVal('--min-prior', 2);
const LIMIT = argVal('--limit', 0);

const DAY = 24 * 3600 * 1000;
const parseTs = s => { const t = Date.parse(s); return isNaN(t) ? null : t; };
const parseClock = t => { const m = /^(\d+):(\d{2})$/.exec(String(t || '')); return m ? (+m[1]) * 60 + (+m[2]) : null; };
const isUFC = e => String(e.org || '').toUpperCase() === 'UFC';
const isDecided = e => (e.result === 'W' || e.result === 'L') && e.method !== 'Upcoming';

// ---- pre-index FIGHT_HISTORY: sorted-ascending, with parsed ts + duration ----
const HIST = data.FIGHT_HISTORY;
const sortedHist = {};      // name -> [{__e, __ts}]  ascending by date
const durByKey = {};        // name -> {date||opp -> seconds}
for (const name of Object.keys(HIST)) {
  const arr = HIST[name] || [];
  const enriched = arr.map(e => ({ __e: e, __ts: parseTs(e.date) }));
  enriched.sort((a, b) => (a.__ts || -Infinity) - (b.__ts || -Infinity));
  sortedHist[name] = enriched;
  const dmap = {};
  for (const e of arr) {
    if (!isUFC(e) || !isDecided(e)) continue;
    const isDec = /DECISION/i.test(e.method || '');
    const R = 300;
    let sec;
    if (isDec) sec = (e.round || 3) * R;
    else { const clk = parseClock(e.time); sec = Math.max(0, (e.round || 1) - 1) * R + (clk != null ? clk : R); }
    dmap[e.date + '||' + e.opponent] = sec;
  }
  durByKey[name] = dmap;
}

// Lazy point-in-time global history: a Proxy returning each fighter's bouts
// strictly before cutoff D, newest-first (matching the source ordering the sim
// functions assume). Memoized per fight.
// Mirrors simProvenLevel's win-selection walk (which win, if any, sets the
// "resume" score) but also tracks whether that winning win was a finish --
// for testing whether manner-of-win should factor into proof-of-level
// credit, which the live formula currently ignores entirely (only W/L).
function bestProvenWin(name, asofHist, S) {
  const wins = (asofHist[name] || []).filter(f => f.result === 'W');
  let best = 0, bestFinish = null;
  wins.forEach(f => {
    const live = S.simRankTier(f.opponent); // null in backtest (rankings disabled)
    let q;
    if (live != null) { q = Math.max(0.1, 1 - live / 15); }
    else {
      const est = S.simEstimateHistoricalTier(f.opponent, f.date);
      if (est == null) return;
      q = est <= 7 ? Math.max(0.1, 1 - est / 15) * S.simBeatenVetDiscount(f.opponent, f.date) : 0.05;
    }
    if (q > best) {
      best = q;
      const method = String(f.method || '').toUpperCase();
      bestFinish = method.includes('KO') || method.includes('TKO') || method.includes('SUB');
    }
  });
  const tenure = Math.max(0, Math.min(1, (S.simUfcFightCount(name) - 4) / 14));
  return { resume: best, tenure, resumeWins: best >= tenure, bestFinish };
}

function makeAsofHistory(D) {
  const cache = Object.create(null);
  return new Proxy({}, {
    get(_, name) {
      if (typeof name !== 'string') return undefined;
      if (name in cache) return cache[name];
      const arr = sortedHist[name];
      if (!arr) return (cache[name] = undefined);
      const out = [];
      for (let i = 0; i < arr.length; i++) if (arr[i].__ts != null && arr[i].__ts < D) out.push(arr[i].__e);
      out.reverse();
      return (cache[name] = out);
    },
    has(_, name) { return sortedHist[name] !== undefined; }
  });
}

// As-of box-score career averages for one fighter, from fight-stats.json bouts
// strictly before D. Mirrors scripts/recompute-veteran-stats.py compute() exactly
// (slpm/sapm per-minute; kd/tdLanded/subAvg per-15; accuracies/defenses as
// fractions), so the reconstructed numbers land on the same scale the live
// FIGHTER_STATS use. Returns null fields + count 0 when there's no prior data.
function asofBoxStats(name, D) {
  const bouts = FIGHT_STATS[name] || [];
  const dmap = durByKey[name] || {};
  let ssl = 0, ssa = 0, kd = 0, tdl = 0, tda = 0, sub = 0, ossl = 0, ossa = 0, otdl = 0, otda = 0, sec = 0, n = 0;
  let wins = 0, winFin = 0;
  for (const bt of bouts) {
    const ts = parseTs(bt.date);
    if (ts == null || ts >= D) continue;
    const dur = dmap[bt.date + '||' + bt.opponent];
    if (dur == null) continue;                 // not a matched UFC bout w/ duration
    const f = bt.f || {}, o = bt.o || {};
    ssl += f.sigL || 0; ssa += f.sigA || 0; kd += f.kd || 0; tdl += f.tdL || 0; tda += f.tdA || 0; sub += f.sub || 0;
    ossl += o.sigL || 0; ossa += o.sigA || 0; otdl += o.tdL || 0; otda += o.tdA || 0;
    sec += dur; n++;
    if (bt.result === 'W') { wins++; if (/^(KO|TKO|SUB)/i.test(bt.method || '') || /Submission/i.test(bt.method || '')) winFin++; }
  }
  if (n === 0 || sec === 0) return { count: 0 };
  const min = sec / 60;
  const frac = (a, b) => (b ? a / b : null);
  return {
    count: n,
    slpm: ssl / min,
    strAcc: frac(ssl, ssa),
    sapm: ossl / min,
    strDef: ossa ? (ossa - ossl) / ossa : null,
    kd: kd / min * 15,
    tdLanded: tdl / min * 15,
    tdAcc: frac(tdl, tda),
    tdDef: otda ? (otda - otdl) / otda : null,
    subAvg: sub / min * 15
  };
}

// As-of overall win streak and truncated-career finish rate, from FIGHT_HISTORY
// (fallbacks the live formula uses when the box-score sample is thin).
function asofHistoryDerived(name, D) {
  const arr = HIST[name] || [];
  const prior = arr.filter(e => { const t = parseTs(e.date); return t != null && t < D && isDecided(e); })
                   .sort((a, b) => parseTs(b.date) - parseTs(a.date)); // newest first
  let streak = 0;
  for (const e of prior) { if (e.result === 'W') streak++; else break; }
  let wins = 0, fin = 0;
  for (const e of prior) if (e.result === 'W') { wins++; if (/KO|TKO|Submission/i.test(e.method || '')) fin++; }
  const finRate = wins ? fin / wins : null;
  return { streak, finRate, priorCount: prior.length, ufcPrior: prior.filter(isUFC).length };
}

// As-of NET control time (self control minus opponent control), in minutes per
// 15 min of fight time, from fight-stats.json bouts strictly before D. This is
// the real-data replacement for the old simControlTimeBoost proxy. Returns null
// when there's no prior box-scored bout with a matched duration.
function asofCtrlNet(name, D) {
  const bouts = FIGHT_STATS[name] || [];
  const dmap = durByKey[name] || {};
  let self = 0, opp = 0, sec = 0, n = 0;
  for (const bt of bouts) {
    const ts = parseTs(bt.date);
    if (ts == null || ts >= D) continue;
    const dur = dmap[bt.date + '||' + bt.opponent];
    if (dur == null) continue;
    self += parseClock((bt.f || {}).ctrl) || 0;
    opp += parseClock((bt.o || {}).ctrl) || 0;
    sec += dur; n++;
  }
  if (n === 0 || sec === 0) return null;
  return ((self - opp) / 60) / (sec / 60) * 15;   // net control MINUTES per 15 min
}

// Integer age at cutoff date D, matching the formula's calcAge (whole years,
// accounting for whether the birthday has passed). Null if no/invalid dob.
function ageAt(name, D) {
  const dob = (data.FIGHTER_STATS[name] || {}).dob;
  if (!dob) return null;
  const b = new Date(dob); if (isNaN(b)) return null;
  const n = new Date(D);
  let age = n.getFullYear() - b.getFullYear();
  if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) age--;
  return age;
}

// ---- build the labeled fight set (dedup: one row per bout, A = alphabetical) ----
console.log('Building label set (min prior UFC box-scored bouts = ' + MIN_PRIOR + ')...');
const seen = new Set();
const labels = [];
const inDB = n => data.FIGHTER_STATS[n] !== undefined && FIGHT_STATS[n] !== undefined;
for (const name of Object.keys(HIST)) {
  for (const e of HIST[name]) {
    if (!isUFC(e) || !isDecided(e)) continue;
    const opp = e.opponent;
    if (!inDB(name) || !inDB(opp)) continue;
    const ts = parseTs(e.date);
    if (ts == null) continue;
    const A = name < opp ? name : opp;
    const B = name < opp ? opp : name;
    const key = A + '||' + B + '||' + e.date;
    if (seen.has(key)) continue;
    seen.add(key);
    // outcome from A's perspective
    const aWon = (name === A) ? (e.result === 'W') : (e.result === 'L');
    labels.push({ A, B, date: e.date, ts, aWon });
  }
}
labels.sort((a, b) => a.ts - b.ts);
console.log('  candidate decided UFC bouts (deduped, both in DB):', labels.length);

// ---- run point-in-time scoring ----
const S = createScorer(data.FIGHTER_STATS, makeAsofHistory(Date.now()), data.FIGHTERS);
const rows = [];
let skippedThin = 0, errors = 0;
const t0 = Date.now();
let processed = 0;
for (const L of labels) {
  const D = L.ts;                      // cutoff = fight day (bouts strictly earlier)
  const boxA = asofBoxStats(L.A, D), boxB = asofBoxStats(L.B, D);
  if (boxA.count < MIN_PRIOR || boxB.count < MIN_PRIOR) { skippedThin++; continue; }
  const dA = asofHistoryDerived(L.A, D), dB = asofHistoryDerived(L.B, D);
  const baseA = data.FIGHTER_STATS[L.A], baseB = data.FIGHTER_STATS[L.B];
  const statA = Object.assign({}, baseA, boxA, { streak: dA.streak, finRate: dA.finRate != null ? dA.finRate : baseA.finRate });
  const statB = Object.assign({}, baseB, boxB, { streak: dB.streak, finRate: dB.finRate != null ? dB.finRate : baseB.finRate });
  delete statA.count; delete statB.count;

  const asofStats = Object.assign(Object.create(null), data.FIGHTER_STATS);
  asofStats[L.A] = statA; asofStats[L.B] = statB;

  S.setNow(D);
  const asofHist = makeAsofHistory(D);
  S.setHistory(asofHist);
  S.setStats(asofStats);
  S.setRankBadge(null);                // point-in-time: no current rankings
  // point-in-time box scores (bouts strictly before D) so the live control-time
  // term (simControlNet) is computed as-of, not from the full career.
  const asofBox = Object.create(null);
  asofBox[L.A] = (FIGHT_STATS[L.A] || []).filter(bt => { const t = parseTs(bt.date); return t != null && t < D; });
  asofBox[L.B] = (FIGHT_STATS[L.B] || []).filter(bt => { const t = parseTs(bt.date); return t != null && t < D; });
  S.setBox(asofBox);

  try {
    const profA = S.getSimProfile(L.A, 3);
    const profB = S.getSimProfile(L.B, 3);
    const p = S.simWinProbability(L.A, L.B, 3);
    const styleDelta = S.simStyleMatchupDelta(L.A, L.B, profA, profB);
    const closeness = S.simRankClosenessFactor(L.A, L.B);
    const h2h = S.simHeadToHeadBoost(L.A, L.B);
    const unprovenA = S.simUnprovenPenalty(L.A, L.B);
    const unprovenB = S.simUnprovenPenalty(L.B, L.A);
    const volA = S.simVolatility(L.A), volB = S.simVolatility(L.B);
    const vol = Math.max(volA, volB);
    const lowCred = Math.max(1 - S.simRateCredibility(L.A), 1 - S.simRateCredibility(L.B));
    const uncertainty = Math.max(vol, lowCred * 0.7);
    // Point-in-time loss/finish profile (glass-cannon signal), for sweeping the
    // finishVulnerability scale/cap against the backtest.
    const lfpA = S.simLossFinishProfile(L.A), lfpB = S.simLossFinishProfile(L.B);
    // Point-in-time schedule-quality net (simScheduleQuality's `net`), for
    // testing whether the model under-credits a real opponent-quality edge
    // relative to a raw production-stat edge (Xiaonan/Gomes-style case).
    const sqA = S.simScheduleQuality(L.A), sqB = S.simScheduleQuality(L.B);
    const provenA = S.simProvenLevel(L.A), provenB = S.simProvenLevel(L.B);
    const bpwA = bestProvenWin(L.A, asofHist, S), bpwB = bestProvenWin(L.B, asofHist, S);
    rows.push({
      A: L.A, B: L.B, date: L.date, ts: L.ts, aWon: L.aWon ? 1 : 0, p,
      profA, profB, styleDelta, closeness, h2h, unprovenA, unprovenB, uncertainty,
      ctrlNetA: asofCtrlNet(L.A, D), ctrlNetB: asofCtrlNet(L.B, D),
      credA: S.simRateCredibility(L.A), credB: S.simRateCredibility(L.B),
      ageA: ageAt(L.A, D), ageB: ageAt(L.B, D),
      // Added for the thin-data-underdog and volatility-style-matchup hypothesis
      // tests: raw prior UFC box-scored bout counts (distinct from credibility,
      // which is a dampened 0-1 score) and each fighter's own volatility term.
      boxCountA: boxA.count, boxCountB: boxB.count, volA, volB,
      // Raw (pre-softcap) loss/finish profile for sweeping simFinishVulnerability's
      // scale/cap against the backtest, as-of the fight date.
      wFinLossA: lfpA.weightedFinishLossCount, lossesA: lfpA.losses, lossFinA: lfpA.lossFinishes,
      wFinLossB: lfpB.weightedFinishLossCount, lossesB: lfpB.losses, lossFinB: lfpB.lossFinishes,
      scheduleNetA: sqA.net, scheduleNetB: sqB.net,
      provenA, provenB,
      provenResumeWinsA: bpwA.resumeWins, provenBestFinishA: bpwA.bestFinish,
      provenResumeWinsB: bpwB.resumeWins, provenBestFinishB: bpwB.bestFinish
    });
  } catch (e) { errors++; if (errors <= 3) console.log('  ERR', L.A, 'vs', L.B, e.message); }
  processed++;
  if (LIMIT && processed >= LIMIT) break;
}
console.log('  graded:', rows.length, '| skipped (thin sample):', skippedThin, '| errors:', errors,
            '| elapsed', ((Date.now() - t0) / 1000).toFixed(1) + 's');

// ---- baseline metrics on the live formula ----
function metrics(rows, probOf) {
  let correct = 0, brier = 0, logloss = 0, nDecisive = 0;
  const bins = Array.from({ length: 10 }, () => ({ n: 0, wins: 0, psum: 0 }));
  for (const r of rows) {
    const p = probOf(r);
    const y = r.aWon;
    if (Math.abs(p - 0.5) > 1e-9) { nDecisive++; if ((p > 0.5) === (y === 1)) correct++; }
    brier += (p - y) * (p - y);
    const pc = Math.min(1 - 1e-12, Math.max(1e-12, p));
    logloss += -(y * Math.log(pc) + (1 - y) * Math.log(1 - pc));
    const bi = Math.min(9, Math.floor(p * 10));
    bins[bi].n++; bins[bi].wins += y; bins[bi].psum += p;
  }
  return { n: rows.length, acc: correct / nDecisive, brier: brier / rows.length, logloss: logloss / rows.length, bins };
}
const base = metrics(rows, r => r.p);
console.log('\n=== BASELINE (current live formula, point-in-time) ===');
console.log('graded fights:', base.n);
console.log('accuracy (favorite wins):', (base.acc * 100).toFixed(2) + '%');
console.log('Brier score:', base.brier.toFixed(4), '(lower better; 0.25 = coinflip)');
console.log('Log loss:', base.logloss.toFixed(4), '(lower better; 0.693 = coinflip)');
console.log('\ncalibration (predicted band -> actual favorite-side win rate):');
for (let i = 0; i < 10; i++) {
  const b = base.bins[i];
  if (!b.n) continue;
  console.log(`  ${(i * 10)}-${i * 10 + 10}%: n=${String(b.n).padStart(4)} predicted=${(b.psum / b.n * 100).toFixed(1)}% actual=${(b.wins / b.n * 100).toFixed(1)}%`);
}

fs.writeFileSync(path.join(HERE, '_components.json'), JSON.stringify(rows));
console.log('\nWrote _components.json (', rows.length, 'fights ) for the tuner.');
