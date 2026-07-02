#!/usr/bin/env node
/* Make grappling matchup-aware and validate point-in-time.
 *
 * Two knobs, both backward-compatible (defaults reproduce today's formula exactly):
 *   - ctrlSlope: scales each fighter's control-time boost by the OPPONENT's
 *     takedown defense. mod = clamp(1 + ctrlSlope*(0.65 - tdDefOpp), 0.2, 1.8).
 *     A grappler's control credit is blunted vs an elite-TDD opponent, amplified
 *     vs a leaky one. ctrlSlope=0 -> no adjustment -> current behavior.
 *   - grappleW / grapplePivot: the existing takedown/sub matchup term's weight
 *     (currently 1.6) and TDD pivot (currently 0.65), re-checked against data.
 *
 * The control adjustment is added as a CORRECTION on top of the existing absolute
 * control boost (which stays in the power score), so mod=1 changes nothing and the
 * finish-vulnerability interaction is untouched.
 */
const fs = require('fs');
const rows = JSON.parse(fs.readFileSync(__dirname + '/_components.json', 'utf8'));
const TEST_FROM = Date.parse('2024-07-01');
const train = rows.filter(r => r.ts < TEST_FROM);
const test = rows.filter(r => r.ts >= TEST_FROM);
const softcap = (x, c) => c * Math.tanh(x / c);
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

// power score exactly as live (control boost included).
function power(p) {
  const strikingNet = softcap(p.slpm * p.strAcc, 2.2) - softcap(p.sapm * (1 - p.strDef), 2.2);
  const tdDefBonus = (p.tdDef - 0.65) * 1.5;
  const grappling = (p.tdLanded * p.tdAcc * 1.0) + (p.subAvg * 1.6);
  const finishing = (p.finRate * 3) + (softcap(p.kd, 2.2) * 2.0);
  const form = softcap(p.streak, 10) * 0.2;
  const production = (strikingNet + grappling + finishing) * p.scheduleMultiplier;
  const subtotal = production + tdDefBonus + form + p.activityCredit + p.trajectory + p.age
    + p.layoff + p.bigFight + p.controlBoost + p.undefeatedBoost + p.durabilityBoost;
  return subtotal + Math.abs(subtotal) * p.finishVulnerability + (p.fiveRoundFactor || 0);
}
const grappleEdge = (pa, pb, pivot) =>
  (pa.tdLanded * pa.tdAcc + pa.subAvg * 0.5) * (pivot - pb.tdDef)
  - (pb.tdLanded * pb.tdAcc + pb.subAvg * 0.5) * (pivot - pa.tdDef);
const ctrlMod = (tdDefOpp, slope) => clamp(1 + slope * (0.65 - tdDefOpp), 0.2, 1.8);

function predict(r, P) {
  const sa = power(r.profA), sb = power(r.profB);
  // re-weight the takedown/sub matchup term inside styleDelta
  const origGrapple = softcap(grappleEdge(r.profA, r.profB, 0.65) * 1.6, 1.2);
  const newGrapple = softcap(grappleEdge(r.profA, r.profB, P.pivot) * P.grappleW, 1.2);
  const styleDelta = r.styleDelta - origGrapple + newGrapple;
  // matchup correction on the (already-counted) control boost
  const ctrlAdj = r.profA.controlBoost * (ctrlMod(r.profB.tdDef, P.ctrlSlope) - 1)
    - r.profB.controlBoost * (ctrlMod(r.profA.tdDef, P.ctrlSlope) - 1);
  const statDiff = ((sa - sb) + styleDelta + ctrlAdj) * (1 - 0.8 * r.closeness);
  const diff = statDiff + r.h2h - r.unprovenA + r.unprovenB;
  const k = 5.4 * (1 + 0.5 * r.uncertainty);
  return Math.min(0.96, Math.max(0.04, 1 / (1 + Math.exp(-diff / k))));
}
function ev(set, P) {
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
const CUR = { ctrlSlope: 0, grappleW: 1.6, pivot: 0.65 };
let md = 0; for (const r of rows) md = Math.max(md, Math.abs(predict(r, CUR) - r.p));
console.log('faithfulness vs stored live prob (slope0/1.6/0.65):', md.toExponential(2), md < 1e-9 ? 'OK\n' : 'DRIFT\n');

function show(label, P) {
  const tr = ev(train, P), te = ev(test, P);
  console.log(label.padEnd(40) + `TRAIN ll=${tr.ll.toFixed(4)} br=${tr.brier.toFixed(4)} acc=${(tr.acc * 100).toFixed(1)} | TEST ll=${te.ll.toFixed(4)} br=${te.brier.toFixed(4)} acc=${(te.acc * 100).toFixed(1)}`);
}
show('current (no matchup control):', CUR);

// grid search
function search(fix) {
  let best = null;
  const slopes = fix.ctrlSlope != null ? [fix.ctrlSlope] : [];
  if (!slopes.length) for (let s = 0; s <= 3.01; s += 0.25) slopes.push(s);
  const ws = fix.grappleW != null ? [fix.grappleW] : [];
  if (!ws.length) for (let w = 0.8; w <= 3.01; w += 0.2) ws.push(w);
  const pvs = fix.pivot != null ? [fix.pivot] : [];
  if (!pvs.length) for (let p = 0.55; p <= 0.751; p += 0.05) pvs.push(p);
  for (const ctrlSlope of slopes) for (const grappleW of ws) for (const pivot of pvs) {
    const P = { ctrlSlope, grappleW, pivot };
    const ll = ev(train, P).ll;
    if (!best || ll < best.ll) best = { ll, P };
  }
  return best.P;
}

const cOnly = search({ grappleW: 1.6, pivot: 0.65 });
console.log('\n-- control matchup only --'); console.log('  tuned:', JSON.stringify(cOnly)); show('control-matchup only:', cOnly);
const gOnly = search({ ctrlSlope: 0 });
console.log('\n-- grappleEdge re-tune only --'); console.log('  tuned:', JSON.stringify(gOnly)); show('grappleEdge re-tune only:', gOnly);
const both = search({});
console.log('\n-- both --'); console.log('  tuned:', JSON.stringify(both)); show('both:', both);

fs.writeFileSync(__dirname + '/_tuned-matchup.json', JSON.stringify({ current: CUR, ctrlOnly: cOnly, grappleOnly: gOnly, both }, null, 2));
