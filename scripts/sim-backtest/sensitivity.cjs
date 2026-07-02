#!/usr/bin/env node
/* One-at-a-time sensitivity scan of the remaining hand-set weights.
 *
 * Each term in the power score / win-prob is multiplied by a weight (default 1 =
 * current formula). For each weight we sweep it alone, find the value that
 * minimizes TRAIN log-loss, and report what that does to the held-out TEST set.
 * A term only has real headroom if TRAIN and TEST improve TOGETHER (co-movement);
 * train-only gains are overfitting and get rejected.
 *
 * Caveat: rankings are disabled in the point-in-time backtest, so rank-dependent
 * terms (rank-closeness, the ranked branch of the unproven penalty) can't be
 * evaluated here and are left out.
 */
const fs = require('fs');
const rows = JSON.parse(fs.readFileSync(__dirname + '/_components.json', 'utf8'));
const TEST_FROM = Date.parse('2024-07-01');
const train = rows.filter(r => r.ts < TEST_FROM), test = rows.filter(r => r.ts >= TEST_FROM);
const softcap = (x, c) => c * Math.tanh(x / c);

const D = { // default weights (1 = current), plus k / uncScale
  k: 5.4, uncScale: 0.5,
  strike: 1, tdDefBonus: 1, grappling: 1, finishing: 1, form: 1,
  activity: 1, trajectory: 1, age: 1, layoff: 1, bigFight: 1,
  control: 1, undefeated: 1, durability: 1, finishVuln: 1,
  style: 1, unproven: 1, h2h: 1
};
function power(p, w) {
  const strikingNet = w.strike * (softcap(p.slpm * p.strAcc, 2.2) - softcap(p.sapm * (1 - p.strDef), 2.2));
  const tdDefBonus = w.tdDefBonus * (p.tdDef - 0.65) * 1.5;
  const grappling = w.grappling * ((p.tdLanded * p.tdAcc) + (p.subAvg * 1.6));
  const finishing = w.finishing * ((p.finRate * 3) + (softcap(p.kd, 2.2) * 2));
  const form = w.form * softcap(p.streak, 10) * 0.2;
  const production = (strikingNet + grappling + finishing) * p.scheduleMultiplier;
  const subtotal = production + tdDefBonus + form
    + w.activity * p.activityCredit + w.trajectory * p.trajectory + w.age * p.age
    + w.layoff * p.layoff + w.bigFight * p.bigFight + w.control * p.controlBoost
    + w.undefeated * p.undefeatedBoost + w.durability * p.durabilityBoost;
  return subtotal + Math.abs(subtotal) * (w.finishVuln * p.finishVulnerability) + (p.fiveRoundFactor || 0);
}
function predict(r, w) {
  const sa = power(r.profA, w), sb = power(r.profB, w);
  const statDiff = ((sa - sb) + w.style * r.styleDelta) * (1 - 0.8 * r.closeness);
  const diff = statDiff + w.h2h * r.h2h - w.unproven * r.unprovenA + w.unproven * r.unprovenB;
  const k = w.k * (1 + w.uncScale * r.uncertainty);
  return Math.min(0.96, Math.max(0.04, 1 / (1 + Math.exp(-diff / k))));
}
const ll = (set, w) => { let s = 0; for (const r of set) { const p = Math.min(1 - 1e-12, Math.max(1e-12, predict(r, w))); s += -(r.aWon * Math.log(p) + (1 - r.aWon) * Math.log(1 - p)); } return s / set.length; };

let md = 0; for (const r of rows) md = Math.max(md, Math.abs(predict(r, D) - r.p));
console.log('faithfulness vs stored live prob:', md.toExponential(2), md < 1e-9 ? 'OK' : 'DRIFT');
const baseTr = ll(train, D), baseTe = ll(test, D);
console.log(`baseline  TRAIN ll=${baseTr.toFixed(4)}  TEST ll=${baseTe.toFixed(4)}\n`);

// how often each term is even non-zero in the set (fires), for context
const fires = {};
for (const key of ['tdDefBonus', 'form', 'activity', 'trajectory', 'age', 'layoff', 'bigFight', 'control', 'undefeated', 'durability', 'finishVuln', 'h2h', 'unproven']) fires[key] = 0;
for (const r of rows) {
  for (const p of [r.profA, r.profB]) {
    if (Math.abs(p.tdDef - 0.65) > 1e-9) fires.tdDefBonus++;
    if (p.streak) fires.form++;
    if (p.activityCredit) fires.activity++;
    if (p.trajectory) fires.trajectory++;
    if (p.age) fires.age++;
    if (p.layoff) fires.layoff++;
    if (p.bigFight) fires.bigFight++;
    if (p.controlBoost) fires.control++;
    if (p.undefeatedBoost) fires.undefeated++;
    if (p.durabilityBoost) fires.durability++;
    if (p.finishVulnerability) fires.finishVuln++;
  }
  if (r.h2h) fires.h2h++;
  if (r.unprovenA || r.unprovenB) fires.unproven++;
}

const knobs = [
  ['k', 3.5, 8, 0.1], ['uncScale', 0, 2, 0.1],
  ['strike', 0.4, 2.0, 0.05], ['tdDefBonus', 0, 3, 0.1], ['grappling', 0, 2.5, 0.05],
  ['finishing', 0, 2.5, 0.05], ['form', 0, 3, 0.1], ['activity', 0, 3, 0.1],
  ['trajectory', 0, 3, 0.1], ['age', 0, 3, 0.1], ['layoff', 0, 3, 0.1],
  ['bigFight', 0, 3, 0.1], ['control', 0, 3, 0.1], ['undefeated', 0, 3, 0.1],
  ['durability', 0, 3, 0.1], ['finishVuln', 0, 3, 0.1], ['style', 0, 3, 0.1],
  ['unproven', 0, 3, 0.1]
];
console.log('knob'.padEnd(12) + 'best× | trainΔ    testΔ    verdict   (fires)');
for (const [name, lo, hi, step] of knobs) {
  let best = { v: D[name], ll: baseTr };
  for (let v = lo; v <= hi + 1e-9; v += step) {
    const w = Object.assign({}, D); w[name] = v;
    const l = ll(train, w);
    if (l < best.ll - 1e-12) best = { v, ll: l };
  }
  const w = Object.assign({}, D); w[name] = best.v;
  const teNew = ll(test, w);
  const dTr = best.ll - baseTr, dTe = teNew - baseTe;
  const helps = dTr < -1e-4 && dTe < -1e-4;
  const verdict = helps ? 'HELPS' : (Math.abs(best.v - D[name]) < 1e-9 ? 'optimal' : 'train-only');
  const fc = fires[name] != null ? `${(100 * fires[name] / (rows.length * (name === 'h2h' || name === 'unproven' ? 1 : 2))).toFixed(0)}%` : '';
  console.log(name.padEnd(12) + `${best.v.toFixed(2).padStart(5)} | ${(dTr >= 0 ? '+' : '') + dTr.toFixed(4)}  ${(dTe >= 0 ? '+' : '') + dTe.toFixed(4)}  ${verdict.padEnd(10)} ${fc}`);
}
