#!/usr/bin/env node
/* Test the AGE curve itself, point-in-time: sweep the onset age T (when the
 * penalty starts) and a steepness multiplier m (scales the whole curve), keeping
 * everything else at the current formula. Fit on TRAIN, judge on held-out TEST.
 * Current formula = T=36, m=1 (penalty = (yp*0.12 + yp^2*0.02), soft-capped 1.5).
 */
const fs = require('fs');
const rows = JSON.parse(fs.readFileSync(__dirname + '/_components.json', 'utf8'));
const TEST_FROM = Date.parse('2024-07-01');
const train = rows.filter(r => r.ts < TEST_FROM), test = rows.filter(r => r.ts >= TEST_FROM);
const softcap = (x, c) => c * Math.tanh(x / c);

function ageTerm(age, T, m) {
  if (age == null || age <= T) return 0;
  const yp = age - T;
  return -softcap((yp * 0.12 + yp * yp * 0.02) * m, 1.5);
}
function power(p, age, T, m) {
  const strikingNet = softcap(p.slpm * p.strAcc, 2.2) - softcap(p.sapm * (1 - p.strDef), 2.2);
  const tdDefBonus = (p.tdDef - 0.65) * 1.5;
  const grappling = (p.tdLanded * p.tdAcc) + (p.subAvg * 1.6);
  const finishing = (p.finRate * 3) + (softcap(p.kd, 2.2) * 2);
  const form = softcap(p.streak, 10) * 0.2;
  const production = (strikingNet + grappling + finishing) * p.scheduleMultiplier;
  const subtotal = production + tdDefBonus + form + p.activityCredit + p.trajectory
    + ageTerm(age, T, m)   // replaces p.age
    + p.layoff + p.bigFight + p.controlBoost + p.undefeatedBoost + p.durabilityBoost;
  return subtotal + Math.abs(subtotal) * p.finishVulnerability + (p.fiveRoundFactor || 0);
}
function predict(r, T, m) {
  const sa = power(r.profA, r.ageA, T, m), sb = power(r.profB, r.ageB, T, m);
  const statDiff = ((sa - sb) + r.styleDelta) * (1 - 0.8 * r.closeness);
  const diff = statDiff + r.h2h - r.unprovenA + r.unprovenB;
  return Math.min(0.96, Math.max(0.04, 1 / (1 + Math.exp(-diff / (5.4 * (1 + 0.5 * r.uncertainty))))));
}
const ll = (set, T, m) => { let s = 0; for (const r of set) { const p = Math.min(1 - 1e-12, Math.max(1e-12, predict(r, T, m))); s += -(r.aWon * Math.log(p) + (1 - r.aWon) * Math.log(1 - p)); } return s / set.length; };
const acc = (set, T, m) => { let c = 0, n = 0; for (const r of set) { const p = predict(r, T, m); if (Math.abs(p - .5) > 1e-9) { n++; if ((p > .5) === (r.aWon === 1)) c++; } } return c / n; };

let md = 0; for (const r of rows) md = Math.max(md, Math.abs(predict(r, 36, 1) - r.p));
console.log('faithfulness (T=36,m=1 vs stored live):', md.toExponential(2), md < 1e-9 ? 'OK' : 'DRIFT');
console.log(`baseline (T=36,m=1)  TRAIN ll=${ll(train, 36, 1).toFixed(4)}  TEST ll=${ll(test, 36, 1).toFixed(4)} acc=${(acc(test, 36, 1) * 100).toFixed(1)}\n`);

console.log('TRAIN log-loss grid (rows = onset T, cols = steepness m):');
const Ts = [30, 31, 32, 33, 34, 35, 36], Ms = [0, 0.5, 1, 1.5, 2, 2.5, 3];
process.stdout.write('  T\\m  ' + Ms.map(m => String(m).padStart(7)).join('') + '\n');
let bestTr = { ll: 1e9 };
for (const T of Ts) {
  let line = '  ' + String(T).padEnd(4);
  for (const m of Ms) { const l = ll(train, T, m); line += l.toFixed(4).padStart(7); if (l < bestTr.ll) bestTr = { ll: l, T, m }; }
  console.log(line);
}
// refine steepness at best T
let best = bestTr;
for (let m = 0; m <= 4; m += 0.05) { const l = ll(train, best.T, m); if (l < best.ll) best = { ll: l, T: best.T, m }; }
console.log(`\nTRAIN-optimal: T=${best.T}, m=${best.m.toFixed(2)}`);
console.log(`  baseline  TRAIN ll=${ll(train, 36, 1).toFixed(4)}  TEST ll=${ll(test, 36, 1).toFixed(4)} acc=${(acc(test, 36, 1) * 100).toFixed(1)}`);
console.log(`  tuned     TRAIN ll=${ll(train, best.T, best.m).toFixed(4)}  TEST ll=${ll(test, best.T, best.m).toFixed(4)} acc=${(acc(test, best.T, best.m) * 100).toFixed(1)}`);
// show the resulting penalty curve
console.log('\ntuned penalty by age:');
let s = '  '; for (const a of [33, 34, 35, 36, 37, 38, 40, 42, 44]) s += `${a}:${ageTerm(a, best.T, best.m).toFixed(2)}  `;
console.log(s);
