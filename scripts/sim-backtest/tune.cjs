#!/usr/bin/env node
/* Fit the simulator's high-leverage knobs to the point-in-time backtest.
 *
 * Knobs (7): logistic slope k, uncertainty-widening scale, and relative weights
 * on the grappling / finishing / form / style / unproven-penalty terms. The
 * striking term is held fixed as the reference scale (otherwise a global weight
 * scaling would be perfectly degenerate with k). We minimise mean log-loss on a
 * TIME-BASED training split (older fights), with mild L2 regularisation pulling
 * the weights toward their current values, then report honest OUT-OF-SAMPLE
 * metrics on the held-out recent fights. Tuned values are only worth adopting if
 * the test set improves.
 */
const fs = require('fs');
const path = require('path');
const rows = JSON.parse(fs.readFileSync(path.join(__dirname, '_components.json'), 'utf8'));

const TEST_FROM = Date.parse('2024-07-01');   // held-out = last ~2 years
const train = rows.filter(r => r.ts < TEST_FROM);
const test = rows.filter(r => r.ts >= TEST_FROM);
console.log(`fights: ${rows.length}  | train (<2024-07): ${train.length}  | test (>=2024-07): ${test.length}\n`);

const softcap = (x, cap) => cap * Math.tanh(x / cap);

// Faithful re-implementation of simPowerScore with weight knobs on the
// grappling / finishing / form terms (striking = reference, weight fixed at 1).
function powerScore(p, P) {
  const strikingNet = softcap(p.slpm * p.strAcc, 2.2) - softcap(p.sapm * (1 - p.strDef), 2.2);
  const tdDefBonus = (p.tdDef - 0.65) * 1.5;
  const grappling = ((p.tdLanded * p.tdAcc * 1.0) + (p.subAvg * 1.6)) * P.wGrappling;
  const finishing = ((p.finRate * 3) + (softcap(p.kd, 2.2) * 2.0)) * P.wFinishing;
  const form = softcap(p.streak, 10) * 0.2 * P.wForm;
  const production = (strikingNet + grappling + finishing) * p.scheduleMultiplier;
  const subtotal = production + tdDefBonus + form + p.activityCredit + p.trajectory + p.age
    + p.layoff + p.bigFight + p.controlBoost + p.undefeatedBoost + p.durabilityBoost;
  const afterFinishPenalty = subtotal + Math.abs(subtotal) * p.finishVulnerability;
  return afterFinishPenalty + (p.fiveRoundFactor || 0);
}

function predict(r, P) {
  const sa = powerScore(r.profA, P), sb = powerScore(r.profB, P);
  const statDiff = ((sa - sb) + P.wStyle * r.styleDelta) * (1 - 0.8 * r.closeness);
  const diff = statDiff + r.h2h - P.wUnproven * r.unprovenA + P.wUnproven * r.unprovenB;
  const k = P.k * (1 + P.uncScale * r.uncertainty);
  const raw = 1 / (1 + Math.exp(-diff / k));
  return Math.min(0.96, Math.max(0.04, raw));
}

const PARAM_NAMES = ['k', 'uncScale', 'wGrappling', 'wFinishing', 'wForm', 'wStyle', 'wUnproven'];
const DEFAULTS = { k: 3.2, uncScale: 0.5, wGrappling: 1, wFinishing: 1, wForm: 1, wStyle: 1, wUnproven: 1 };
const BOUNDS = { k: [1.5, 8], uncScale: [0, 2], wGrappling: [0, 2.5], wFinishing: [0, 2.5], wForm: [0, 2.5], wStyle: [0, 2.5], wUnproven: [0, 2.5] };
const toP = v => { const P = {}; PARAM_NAMES.forEach((n, i) => P[n] = v[i]); return P; };
const toV = P => PARAM_NAMES.map(n => P[n]);
const clampV = v => v.map((x, i) => Math.min(BOUNDS[PARAM_NAMES[i]][1], Math.max(BOUNDS[PARAM_NAMES[i]][0], x)));

function evalSet(set, P) {
  let correct = 0, nDec = 0, brier = 0, logloss = 0;
  const bins = Array.from({ length: 10 }, () => ({ n: 0, wins: 0, psum: 0 }));
  for (const r of set) {
    const p = predict(r, P), y = r.aWon;
    if (Math.abs(p - 0.5) > 1e-9) { nDec++; if ((p > 0.5) === (y === 1)) correct++; }
    brier += (p - y) * (p - y);
    const pc = Math.min(1 - 1e-12, Math.max(1e-12, p));
    logloss += -(y * Math.log(pc) + (1 - y) * Math.log(1 - pc));
    const bi = Math.min(9, Math.floor(p * 10)); bins[bi].n++; bins[bi].wins += y; bins[bi].psum += p;
  }
  return { acc: correct / nDec, brier: brier / set.length, logloss: logloss / set.length, bins };
}

// ---- faithfulness check: predict(defaults) must reproduce the stored live prob
let maxDiff = 0;
for (const r of rows) maxDiff = Math.max(maxDiff, Math.abs(predict(r, DEFAULTS) - r.p));
console.log('faithfulness (max |predict(defaults) - live simWinProbability|):', maxDiff.toExponential(2));
if (maxDiff > 1e-9) console.log('  WARNING: reimplementation drifts from live formula — tuning results suspect.\n');
else console.log('  OK — parameterization exactly reproduces the live formula.\n');

// ---- objective: train log-loss + mild L2 pull toward current values ----
const LAMBDA = 0.02;
function objective(v) {
  const P = toP(clampV(v));
  const ll = evalSet(train, P).logloss;
  let reg = 0;
  for (const n of PARAM_NAMES) if (n !== 'k') { const d = P[n] - DEFAULTS[n]; reg += d * d; }
  return ll + LAMBDA * reg;
}

// ---- Nelder-Mead downhill simplex with random restarts ----
function nelderMead(f, x0, opts = {}) {
  const n = x0.length, step = opts.step || 0.4, iters = opts.iters || 800;
  let simplex = [x0.slice()];
  for (let i = 0; i < n; i++) { const p = x0.slice(); p[i] += step * (Math.abs(p[i]) > 1e-6 ? p[i] : 1); simplex.push(p); }
  let fv = simplex.map(f);
  const order = () => { const idx = fv.map((v, i) => i).sort((a, b) => fv[a] - fv[b]); simplex = idx.map(i => simplex[i]); fv = idx.map(i => fv[i]); };
  for (let it = 0; it < iters; it++) {
    order();
    const centroid = new Array(n).fill(0);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) centroid[j] += simplex[i][j] / n;
    const worst = simplex[n];
    const refl = centroid.map((c, j) => c + 1.0 * (c - worst[j])); const fr = f(refl);
    if (fr < fv[0]) { const exp = centroid.map((c, j) => c + 2.0 * (c - worst[j])); const fe = f(exp); if (fe < fr) { simplex[n] = exp; fv[n] = fe; } else { simplex[n] = refl; fv[n] = fr; } }
    else if (fr < fv[n - 1]) { simplex[n] = refl; fv[n] = fr; }
    else { const con = centroid.map((c, j) => c + 0.5 * (worst[j] - c)); const fc = f(con); if (fc < fv[n]) { simplex[n] = con; fv[n] = fc; } else { for (let i = 1; i <= n; i++) { simplex[i] = simplex[i].map((x, j) => simplex[0][j] + 0.5 * (x - simplex[0][j])); fv[i] = f(simplex[i]); } } }
  }
  order();
  return { x: simplex[0], f: fv[0] };
}

let best = { x: toV(DEFAULTS), f: objective(toV(DEFAULTS)) };
const starts = [toV(DEFAULTS), [4.5, 0.5, 1, 1, 1, 1, 1], [5.5, 0.8, 0.8, 0.8, 0.8, 1, 1.2], [3.5, 0.3, 1.2, 1.2, 0.6, 1.2, 0.8]];
for (const s of starts) {
  const res = nelderMead(objective, s, { step: 0.35, iters: 1000 });
  if (res.f < best.f) best = res;
}
const tuned = toP(clampV(best.x));

console.log('=== tuned parameters ===');
for (const n of PARAM_NAMES) console.log(`  ${n.padEnd(11)} ${DEFAULTS[n].toFixed(3)}  ->  ${tuned[n].toFixed(3)}`);

function report(label, P) {
  const tr = evalSet(train, P), te = evalSet(test, P);
  console.log(`\n${label}`);
  console.log(`  TRAIN  acc=${(tr.acc * 100).toFixed(2)}%  brier=${tr.brier.toFixed(4)}  logloss=${tr.logloss.toFixed(4)}`);
  console.log(`  TEST   acc=${(te.acc * 100).toFixed(2)}%  brier=${te.brier.toFixed(4)}  logloss=${te.logloss.toFixed(4)}`);
  return te;
}
console.log('\n================ RESULTS ================');
report('DEFAULT (current live values):', DEFAULTS);
const teT = report('TUNED:', tuned);

console.log('\ntest-set calibration, TUNED (predicted band -> actual):');
for (let i = 0; i < 10; i++) { const b = teT.bins[i]; if (!b.n) continue; console.log(`  ${i * 10}-${i * 10 + 10}%: n=${String(b.n).padStart(4)} predicted=${(b.psum / b.n * 100).toFixed(1)}% actual=${(b.wins / b.n * 100).toFixed(1)}%`); }

fs.writeFileSync(path.join(__dirname, '_tuned.json'), JSON.stringify({ defaults: DEFAULTS, tuned }, null, 2));
console.log('\nWrote _tuned.json');
