#!/usr/bin/env node
/* Test replacing the old simControlTimeBoost PROXY with a REAL net-control-time
 * term, using point-in-time control data. Compares, out-of-sample:
 *   - current live (k=5.4, proxy on)
 *   - proxy removed entirely (does the guess even help?)
 *   - real control term (proxy off), weight/cap/k grid-searched on TRAIN
 * Only a genuine held-out improvement justifies changing index.html.
 */
const fs = require('fs');
const rows = JSON.parse(fs.readFileSync(__dirname + '/_components.json', 'utf8'));
const TEST_FROM = Date.parse('2024-07-01');
const train = rows.filter(r => r.ts < TEST_FROM);
const test = rows.filter(r => r.ts >= TEST_FROM);
const softcap = (x, c) => c * Math.tanh(x / c);

// power score with knobs: wOldCtrl removes the proxy (1 = fully removed),
// wCtrl/ctrlCap add a real credibility-dampened net-control term.
function power(p, P, ctrlNet, cred) {
  const strikingNet = softcap(p.slpm * p.strAcc, 2.2) - softcap(p.sapm * (1 - p.strDef), 2.2);
  const tdDefBonus = (p.tdDef - 0.65) * 1.5;
  const grappling = (p.tdLanded * p.tdAcc * 1.0) + (p.subAvg * 1.6);
  const finishing = (p.finRate * 3) + (softcap(p.kd, 2.2) * 2.0);
  const form = softcap(p.streak, 10) * 0.2;
  const production = (strikingNet + grappling + finishing) * p.scheduleMultiplier;
  let newCtrl = 0;
  if (ctrlNet != null) { const d = ctrlNet * (0.5 + 0.5 * cred); newCtrl = P.wCtrl * softcap(d, P.ctrlCap); }
  const subtotal = production + tdDefBonus + form + p.activityCredit + p.trajectory + p.age
    + p.layoff + p.bigFight + p.undefeatedBoost + p.durabilityBoost
    + (1 - P.wOldCtrl) * p.controlBoost + newCtrl;
  return subtotal + Math.abs(subtotal) * p.finishVulnerability + (p.fiveRoundFactor || 0);
}
function predict(r, P) {
  const sa = power(r.profA, P, r.ctrlNetA, r.credA);
  const sb = power(r.profB, P, r.ctrlNetB, r.credB);
  const statDiff = ((sa - sb) + r.styleDelta) * (1 - 0.8 * r.closeness);
  const diff = statDiff + r.h2h - r.unprovenA + r.unprovenB;
  const k = P.k * (1 + 0.5 * r.uncertainty);
  return Math.min(0.96, Math.max(0.04, 1 / (1 + Math.exp(-diff / k))));
}
function evalSet(set, P) {
  let c = 0, nd = 0, br = 0, ll = 0;
  for (const r of set) {
    const p = predict(r, P), y = r.aWon;
    if (Math.abs(p - 0.5) > 1e-9) { nd++; if ((p > 0.5) === (y === 1)) c++; }
    br += (p - y) * (p - y);
    const pc = Math.min(1 - 1e-12, Math.max(1e-12, p));
    ll += -(y * Math.log(pc) + (1 - y) * Math.log(1 - pc));
  }
  return { acc: c / nd, brier: br / set.length, ll: ll / set.length };
}

const LIVE = { k: 5.4, wOldCtrl: 0, wCtrl: 0, ctrlCap: 3 };  // current production
// faithfulness: with proxy on and no new term, must reproduce stored live prob
let md = 0; for (const r of rows) md = Math.max(md, Math.abs(predict(r, LIVE) - r.p));
console.log('faithfulness vs stored live prob:', md.toExponential(2), md < 1e-9 ? 'OK\n' : 'DRIFT\n');

function line(label, P) {
  const tr = evalSet(train, P), te = evalSet(test, P);
  console.log(label.padEnd(34) + `TRAIN ll=${tr.ll.toFixed(4)} brier=${tr.brier.toFixed(4)} acc=${(tr.acc * 100).toFixed(1)}  |  TEST ll=${te.ll.toFixed(4)} brier=${te.brier.toFixed(4)} acc=${(te.acc * 100).toFixed(1)}`);
  return te;
}
line('current live (k=5.4, proxy on):', LIVE);
line('proxy removed, no new term:', { k: 5.4, wOldCtrl: 1, wCtrl: 0, ctrlCap: 3 });

// grid-search the real control term on TRAIN (proxy off), k re-optimized too
let best = null;
for (let k = 4.6; k <= 6.4; k += 0.2)
  for (let cap = 1.5; cap <= 4.5; cap += 0.5)
    for (let w = 0; w <= 2.6; w += 0.1) {
      const P = { k, wOldCtrl: 1, wCtrl: w, ctrlCap: cap };
      const ll = evalSet(train, P).ll;
      if (!best || ll < best.ll) best = { ll, P };
    }
console.log('\nbest real-control config (by TRAIN log-loss):', JSON.stringify(best.P));
const teBest = line('real control (proxy off, tuned):', best.P);

// also report the same control weight but keeping k at 5.4 (isolate the term)
let bestK54 = null;
for (let cap = 1.5; cap <= 4.5; cap += 0.5)
  for (let w = 0; w <= 2.6; w += 0.1) {
    const P = { k: 5.4, wOldCtrl: 1, wCtrl: w, ctrlCap: cap };
    const ll = evalSet(train, P).ll;
    if (!bestK54 || ll < bestK54.ll) bestK54 = { ll, P };
  }
console.log('\nbest real-control config with k fixed 5.4:', JSON.stringify(bestK54.P));
line('real control (k=5.4 fixed, tuned):', bestK54.P);

fs.writeFileSync(__dirname + '/_tuned-ctrl.json', JSON.stringify({ live: LIVE, best: best.P, bestK54: bestK54.P }, null, 2));
