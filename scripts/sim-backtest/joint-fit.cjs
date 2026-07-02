#!/usr/bin/env node
/* Joint fit of the knobs that passed the one-at-a-time screen (age, activity,
 * finishVuln, strike, layoff, style, durability, k), so interactions and the
 * strike/k degeneracy are resolved together. Mild L2 pull toward defaults; fit on
 * TRAIN, judged on held-out TEST. */
const fs = require('fs');
const rows = JSON.parse(fs.readFileSync(__dirname + '/_components.json', 'utf8'));
const TEST_FROM = Date.parse('2024-07-01');
const train = rows.filter(r => r.ts < TEST_FROM), test = rows.filter(r => r.ts >= TEST_FROM);
const softcap = (x, c) => c * Math.tanh(x / c);
const D = { k: 5.4, uncScale: 0.5, strike: 1, tdDefBonus: 1, grappling: 1, finishing: 1, form: 1, activity: 1, trajectory: 1, age: 1, layoff: 1, bigFight: 1, control: 1, undefeated: 1, durability: 1, finishVuln: 1, style: 1, unproven: 1, h2h: 1 };
function power(p, w) {
  const strikingNet = w.strike * (softcap(p.slpm * p.strAcc, 2.2) - softcap(p.sapm * (1 - p.strDef), 2.2));
  const tdDefBonus = w.tdDefBonus * (p.tdDef - 0.65) * 1.5;
  const grappling = w.grappling * ((p.tdLanded * p.tdAcc) + (p.subAvg * 1.6));
  const finishing = w.finishing * ((p.finRate * 3) + (softcap(p.kd, 2.2) * 2));
  const form = w.form * softcap(p.streak, 10) * 0.2;
  const production = (strikingNet + grappling + finishing) * p.scheduleMultiplier;
  const subtotal = production + tdDefBonus + form + w.activity * p.activityCredit + w.trajectory * p.trajectory + w.age * p.age + w.layoff * p.layoff + w.bigFight * p.bigFight + w.control * p.controlBoost + w.undefeated * p.undefeatedBoost + w.durability * p.durabilityBoost;
  return subtotal + Math.abs(subtotal) * (w.finishVuln * p.finishVulnerability) + (p.fiveRoundFactor || 0);
}
function predict(r, w) {
  const sa = power(r.profA, w), sb = power(r.profB, w);
  const statDiff = ((sa - sb) + w.style * r.styleDelta) * (1 - 0.8 * r.closeness);
  const diff = statDiff + w.h2h * r.h2h - w.unproven * r.unprovenA + w.unproven * r.unprovenB;
  return Math.min(0.96, Math.max(0.04, 1 / (1 + Math.exp(-diff / (w.k * (1 + w.uncScale * r.uncertainty))))));
}
const ll = (set, w) => { let s = 0; for (const r of set) { const p = Math.min(1 - 1e-12, Math.max(1e-12, predict(r, w))); s += -(r.aWon * Math.log(p) + (1 - r.aWon) * Math.log(1 - p)); } return s / set.length; };
const acc = (set, w) => { let c = 0, n = 0; for (const r of set) { const p = predict(r, w); if (Math.abs(p - .5) > 1e-9) { n++; if ((p > .5) === (r.aWon === 1)) c++; } } return c / n; };

const FIT = ['k', 'strike', 'age', 'activity', 'finishVuln', 'layoff', 'style', 'durability'];
const BOUNDS = { k: [4, 8], strike: [0.5, 2.5], age: [1, 5], activity: [0, 1.5], finishVuln: [0, 4], layoff: [0, 4], style: [0.5, 2.5], durability: [0, 1.5] };
const LAMBDA = 0.01;
const clampFit = v => v.map((x, i) => Math.min(BOUNDS[FIT[i]][1], Math.max(BOUNDS[FIT[i]][0], x)));
function obj(v) {
  const w = Object.assign({}, D); FIT.forEach((n, i) => w[n] = v[i]);
  let reg = 0; FIT.forEach((n, i) => { if (n !== 'k') { const d = v[i] - D[n]; reg += d * d; } });
  return ll(train, w) + LAMBDA * reg;
}
function nm(f, x0, iters) {
  const n = x0.length; let S = [x0.slice()];
  for (let i = 0; i < n; i++) { const p = x0.slice(); p[i] += 0.3 * (Math.abs(p[i]) > 1e-6 ? p[i] : 1); S.push(p); }
  let F = S.map(f);
  const ord = () => { const idx = F.map((v, i) => i).sort((a, b) => F[a] - F[b]); S = idx.map(i => S[i]); F = idx.map(i => F[i]); };
  for (let it = 0; it < iters; it++) {
    ord(); const c = new Array(n).fill(0);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) c[j] += S[i][j] / n;
    const wst = S[n]; const rf = c.map((x, j) => x + (x - wst[j])); const fr = f(rf);
    if (fr < F[0]) { const e = c.map((x, j) => x + 2 * (x - wst[j])); const fe = f(e); if (fe < fr) { S[n] = e; F[n] = fe; } else { S[n] = rf; F[n] = fr; } }
    else if (fr < F[n - 1]) { S[n] = rf; F[n] = fr; }
    else { const ct = c.map((x, j) => x + 0.5 * (wst[j] - x)); const fc = f(ct); if (fc < F[n]) { S[n] = ct; F[n] = fc; } else { for (let i = 1; i <= n; i++) { S[i] = S[i].map((x, j) => S[0][j] + 0.5 * (x - S[0][j])); F[i] = f(S[i]); } } }
  }
  ord(); return S[0];
}
let best = null;
for (const st of [FIT.map(n => D[n]), [6, 1.5, 3, 0.3, 2.5, 2, 1.3, 0.3], [5.4, 2, 4, 0, 3, 3, 1.5, 0]]) {
  const x = clampFit(nm(obj, clampFit(st), 1200));
  const f = obj(x); if (!best || f < best.f) best = { x, f };
}
const w = Object.assign({}, D); FIT.forEach((n, i) => w[n] = best.x[i]);
console.log('joint-fit values (default -> tuned):');
FIT.forEach(n => console.log(`  ${n.padEnd(11)} ${D[n].toFixed(2)} -> ${w[n].toFixed(2)}`));
console.log(`\nbaseline  TRAIN ll=${ll(train, D).toFixed(4)} acc=${(acc(train, D) * 100).toFixed(1)} | TEST ll=${ll(test, D).toFixed(4)} acc=${(acc(test, D) * 100).toFixed(1)}`);
console.log(`jointfit  TRAIN ll=${ll(train, w).toFixed(4)} acc=${(acc(train, w) * 100).toFixed(1)} | TEST ll=${ll(test, w).toFixed(4)} acc=${(acc(test, w) * 100).toFixed(1)}`);
// isolate the two safest, highest-signal single moves for comparison
const wAgeAct = Object.assign({}, D, { age: w.age, activity: w.activity });
console.log(`age+activity only (age=${w.age.toFixed(2)},act=${w.activity.toFixed(2)}):  TEST ll=${ll(test, wAgeAct).toFixed(4)} acc=${(acc(test, wAgeAct) * 100).toFixed(1)}`);
fs.writeFileSync(__dirname + '/_joint.json', JSON.stringify(w, null, 2));
