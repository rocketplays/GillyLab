#!/usr/bin/env node
/* MATCHUP DEEP DIVE — strike distribution, offence vs defence, for one bout.
 *
 * WHAT THIS IS FOR. The fight-info dropdown lists a lot of matchup detail and
 * none of it is an ARGUMENT. It tells you Du Plessis lands 5.2 sig/min; it does
 * not tell you that he throws 41% of his significant strikes at the body while
 * Usman absorbs body shots at a 62% clip. The first is a stat. The second is a
 * reason to watch a fight.
 *
 * The insight in this data is not in either fighter's numbers. It is in the CROSS:
 * A's offensive distribution against B's defensive one. data/fight-stats.json has
 * both halves for every fight — `f` is what the fighter did, `o` is what was done
 * TO him — and nothing in the app currently reads the second half.
 *
 * WHAT THIS IS NOT. There is no round-by-round data anywhere in the payload.
 * Every record is whole-fight totals. Do not add a "round 3 output" panel by
 * inferring it from finishes and calling it measured.
 *
 * Usage: node scripts/matchup-deepdive.cjs ["Fighter A" "Fighter B"]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const STATS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/fight-stats.json'), 'utf8'));

// NAME NORMALISATION IS NOT OPTIONAL. A naive join drops Dricus du Plessis (the
// card says "Du", the stats say "du") and Aleksandar Rakić (the ć). I measured
// coverage without this and reported 9% of a card as "no stats", including a
// champion. That number was about my matcher, not the dataset.
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z ]/g, '').trim();
const INDEX = new Map(Object.keys(STATS).map(k => [norm(k), k]));
const lookup = name => { const k = INDEX.get(norm(name)); return k ? STATS[k] : null; };

const ZONES = ['head', 'body', 'leg'];
const POS = ['dist', 'clinch', 'ground'];

// Aggregate a fighter's fights into offence (what he threw) and defence (what was
// thrown at him). `n` rides along on every number, because a rate without its
// sample size is how this project keeps talking itself into things.
function profile(fights, limit) {
  const use = (fights || []).slice(0, limit || 8);
  const z = () => ({ landed: 0, att: 0 });
  const p = { fights: use.length, off: {}, def: {}, offPos: {}, defPos: {},
              ctrlSec: 0, tdL: 0, tdA: 0, tdAgainstL: 0, tdAgainstA: 0, kd: 0, kdAgainst: 0 };
  for (const k of ZONES) { p.off[k] = z(); p.def[k] = z(); }
  for (const k of POS) { p.offPos[k] = z(); p.defPos[k] = z(); }
  const secs = t => { const m = /^(\d+):(\d+)$/.exec(String(t || '')); return m ? +m[1] * 60 + +m[2] : 0; };
  for (const f of use) {
    if (!f.f || !f.o) continue;
    for (const k of ZONES) {
      if (f.f[k]) { p.off[k].landed += f.f[k][0]; p.off[k].att += f.f[k][1]; }
      if (f.o[k]) { p.def[k].landed += f.o[k][0]; p.def[k].att += f.o[k][1]; }
    }
    for (const k of POS) {
      if (f.f[k]) { p.offPos[k].landed += f.f[k][0]; p.offPos[k].att += f.f[k][1]; }
      if (f.o[k]) { p.defPos[k].landed += f.o[k][0]; p.defPos[k].att += f.o[k][1]; }
    }
    p.ctrlSec += secs(f.f.ctrl); p.tdL += f.f.tdL || 0; p.tdA += f.f.tdA || 0;
    p.tdAgainstL += f.o.tdL || 0; p.tdAgainstA += f.o.tdA || 0;
    p.kd += f.f.kd || 0; p.kdAgainst += f.o.kd || 0;
  }
  return p;
}

const totAtt = o => ZONES.reduce((s, k) => s + o[k].att, 0);
const totLanded = o => ZONES.reduce((s, k) => s + o[k].landed, 0);
const share = (o, k) => { const t = totAtt(o); return t ? o[k].att / t : 0; };
const acc = (o, k) => o[k].att ? o[k].landed / o[k].att : 0;

// LEAGUE BASELINE — a DISTRIBUTION per axis, not a pooled average.
//
// THE FIRST VERSION POOLED EVERY STRIKE IN THE LEAGUE AND SUBTRACTED:
//     (A's share - league share)*100 + (B's allowed - league allowed)*100
// which adds two numbers measured on different scales and calls the sum an edge.
//
// I JUSTIFIED REPLACING IT WITH A MECHANISM I MADE UP. I wrote, and said out loud:
// "leg strikes land 80-92% for everyone, so the league sits in a 12-point band,
// while head accuracy genuinely ranges 34-43% — a +11 on legs is noise and a +6 on
// the head is the fight." Confident, plausible, and false. Measured, the spreads
// are nearly the same:
//     head allowed 38% +-8.1        leg allowed 81% +-9.2
// A 10-point deviation is 1.2 sd on the head and 1.1 sd on the legs. Pooled
// subtraction was not lying about legs-vs-head at all, and the right fix has
// nothing to do with the reason I gave for it.
//
// WHERE THE SCALES ACTUALLY DIVERGE IS STRIKING vs GRAPPLING:
//     head allowed  38% +-8.1        takedowns allowed  39% +-19.5
// The same 26-point deviation is 3.2 sd on the head and 1.3 sd on takedowns.
// THAT is the axis pair pooled subtraction could not rank, and it is exactly the
// pair the old version never had to rank — because it only ever looked at strikes.
// The two bugs were one bug: a metric that could not compare across axes, and a
// metric that only had one axis, so nobody noticed.
//
// So: z-scores, because they make every path commensurable and let grappling into
// the ranking at all. Computed per FIGHTER (not per strike) with a volume floor —
// a man with 20 leg attempts is not evidence about the league and would just
// fatten the sd.
function leagueDist() {
  const cols = {};
  const push = (k, v) => { (cols[k] = cols[k] || []).push(v); };
  for (const name of Object.keys(STATS)) {
    const p = profile(STATS[name], 8);
    if (p.fights < 3) continue;                 // a 1-fight sample is not a data point
    const tot = totAtt(p.off);
    if (tot < 150) continue;
    for (const k of ZONES) {
      push('offShare.' + k, share(p.off, k));
      if (p.def[k].att >= 40) push('defAllow.' + k, acc(p.def, k));
    }
    push('tdRate', p.tdA / p.fights);
    if (p.tdAgainstA >= 4) push('tdDefAllow', p.tdAgainstL / p.tdAgainstA);
    push('ctrl', p.ctrlSec / p.fights);
  }
  const out = {};
  for (const [k, v] of Object.entries(cols)) {
    const m = v.reduce((a, b) => a + b, 0) / v.length;
    const sd = Math.sqrt(v.reduce((s, x) => s + (x - m) * (x - m), 0) / v.length);
    out[k] = { m, sd: sd || 1, n: v.length };
  }
  return out;
}

// THE CROSS. Every path A has, ranked in one unit: how unusual is A's INTENT here,
// plus how unusual is B's VULNERABILITY here. Both in z, so they add honestly.
//
// GRAPPLING IS A PATH, NOT A SIDEBAR. The first version ranked three striking
// lanes and put takedowns in a separate table underneath — so for Du Plessis vs
// Usman it confidently recommended leg kicks while the actual story (Usman taken
// down on 16% of attempts, Du Plessis on 65%, 50 minutes of control to 16) sat
// somewhere else on the page. A deep dive that ranks the wrong axis is worse than
// one that ranks nothing: it is an opinion, delivered with a number, about the
// second-most-important thing in the fight.
// KNOWN LIMIT, MEASURED AND NOT FIXED: z ASSUMES A ROUGHLY SYMMETRIC SPREAD, AND
// tdRate IS NOT. Merab Dvalishvili shoots 24.9 takedowns a fight against a league
// of 2.9 +-2.4 — z = +9.2. That is not "nine times more meaningful than a +1.0",
// it is a long right tail being read by a tool that assumes there isn't one. The
// RANKING survives it (his takedowns genuinely are the story of any fight he's in,
// and O'Malley's -1.9 correctly says he will never shoot) but the MAGNITUDES do
// not compare across paths once you leave +-2. A percentile rank would be
// distribution-free and is the right answer; it needs its own pass, and any UI
// built on this must not print the raw number as if +9.3 and +1.9 sit on one
// ruler. Rank the paths; don't quantify the gap between them.
function edges(A, B, L) {
  const z = (key, x) => { const d = L[key]; return d ? (x - d.m) / d.sd : 0; };
  const out = [];
  for (const k of ZONES) {
    const intent = z('offShare.' + k, share(A.off, k));
    const vuln = z('defAllow.' + k, acc(B.def, k));
    out.push({
      path: k, kind: 'strike',
      aShare: share(A.off, k), aAcc: acc(A.off, k), bAllows: acc(B.def, k),
      lgShare: L['offShare.' + k].m, lgAllows: L['defAllow.' + k].m,
      intent, vuln, edge: intent + vuln,
      n: A.off[k].att, m: B.def[k].att,
      thin: A.off[k].att < 60 || B.def[k].att < 40,
    });
  }
  // Takedowns: intent is how often he shoots, vulnerability is how often the other
  // man goes down when shot on.
  const tdIntent = z('tdRate', A.tdA / Math.max(1, A.fights));
  const tdVuln = z('tdDefAllow', B.tdAgainstA ? B.tdAgainstL / B.tdAgainstA : L['tdDefAllow'].m);
  out.push({
    path: 'takedown', kind: 'grapple',
    aShare: null, aAcc: A.tdA ? A.tdL / A.tdA : 0,
    bAllows: B.tdAgainstA ? B.tdAgainstL / B.tdAgainstA : 0,
    lgShare: null, lgAllows: L['tdDefAllow'].m,
    intent: tdIntent, vuln: tdVuln, edge: tdIntent + tdVuln,
    n: A.tdA, m: B.tdAgainstA,
    thin: A.tdA < 8 || B.tdAgainstA < 6,
  });
  return out.sort((x, y) => y.edge - x.edge);
}

function pct(x) { return (x * 100).toFixed(0) + '%'; }

function main() {
  const argv = process.argv.slice(2);
  let a = argv[0], b = argv[1];
  if (!a || !b) {
    const EV = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/event.json'), 'utf8'));
    const bout = EV.data[0].bouts[0];
    const m = /^espn-(.+)-vs-(.+)$/.exec(bout.id);
    a = m[1].replace(/-/g, ' '); b = m[2].replace(/-/g, ' ');
  }
  const fa = lookup(a), fb = lookup(b);
  if (!fa || !fb) { console.error('no stats for ' + (fa ? b : a)); process.exit(1); }
  const A = profile(fa), B = profile(fb), L = leagueDist();

  console.log('MATCHUP DEEP DIVE  —  ' + a + '  vs  ' + b);
  console.log('last ' + A.fights + ' and ' + B.fights + ' fights\n');

  const row = (label, l, r) => console.log('  ' + label.padEnd(26) + String(l).padStart(12) + String(r).padStart(14));
  console.log('  ' + ''.padEnd(26) + a.split(' ').pop().padStart(12) + b.split(' ').pop().padStart(14));
  console.log('  ' + '-'.repeat(52));
  console.log('  OFFENCE — where he aims (share of significant strikes attempted)');
  for (const k of ZONES)
    row('  ' + k, pct(share(A.off, k)) + ' @ ' + pct(acc(A.off, k)), pct(share(B.off, k)) + ' @ ' + pct(acc(B.off, k)));
  console.log('  DEFENCE — what lands on him (accuracy allowed at each target)');
  for (const k of ZONES)
    row('  ' + k, pct(acc(A.def, k)), pct(acc(B.def, k)));
  console.log('  POSITION — share of strikes attempted');
  for (const k of POS)
    row('  ' + k, pct(share2(A.offPos, k)), pct(share2(B.offPos, k)));
  console.log('  GRAPPLING');
  row('  takedowns', A.tdL + '/' + A.tdA, B.tdL + '/' + B.tdA);
  row('  takedowns allowed', A.tdAgainstL + '/' + A.tdAgainstA, B.tdAgainstL + '/' + B.tdAgainstA);
  row('  control time', Math.round(A.ctrlSec / 60) + 'm', Math.round(B.ctrlSec / 60) + 'm');
  row('  knockdowns for/against', A.kd + '/' + A.kdAgainst, B.kd + '/' + B.kdAgainst);

  console.log('\n  LEAGUE DISTRIBUTION — mean +- sd across qualified fighters');
  for (const k of ZONES)
    console.log('    ' + k.padEnd(6) + 'aim ' + pct(L['offShare.' + k].m) + ' +-' +
      (L['offShare.' + k].sd * 100).toFixed(1) + '   allowed ' + pct(L['defAllow.' + k].m) +
      ' +-' + (L['defAllow.' + k].sd * 100).toFixed(1) + '   (n=' + L['defAllow.' + k].n + ')');
  console.log('    ' + 'td'.padEnd(6) + 'shots/fight ' + L['tdRate'].m.toFixed(1) + ' +-' +
    L['tdRate'].sd.toFixed(1) + '   allowed ' + pct(L['tdDefAllow'].m) + ' +-' +
    (L['tdDefAllow'].sd * 100).toFixed(1) + '   (n=' + L['tdDefAllow'].n + ')');
  // The spread that actually matters is STRIKING vs GRAPPLING, not leg vs head.
  // Printed because I got this backwards once already and the numbers say it
  // better than the comment does.
  const sdHead = L['defAllow.head'].sd * 100, sdLeg = L['defAllow.leg'].sd * 100,
        sdTd = L['tdDefAllow'].sd * 100;
  console.log('    ^ head +-' + sdHead.toFixed(1) + ' and leg +-' + sdLeg.toFixed(1) +
    ' are the SAME spread — pooled subtraction ranked those two fine.');
  console.log('      td +-' + sdTd.toFixed(1) + ' is ' + (sdTd / sdHead).toFixed(1) +
    'x wider. A 26-pt deviation = ' + (26 / sdHead).toFixed(1) + ' sd on the head, ' +
    (26 / sdTd).toFixed(1) + ' sd on takedowns.');
  console.log('      THAT is the pair that needs z, and the old metric never ranked it at all.');

  for (const [att, dfd, name] of [[A, B, a], [B, A, b]]) {
    console.log('\n  THE CROSS — every path ' + name.split(' ').pop() + ' has, one unit (z)');
    for (const e of edges(att, dfd, L)) {
      const desc = e.kind === 'grapple'
        ? 'shoots ' + (att.tdA / Math.max(1, att.fights)).toFixed(1) + '/fight @ ' + pct(e.aAcc) +
          '   opp taken down ' + pct(e.bAllows) + ' (lg ' + pct(e.lgAllows) + ')'
        : 'aims ' + pct(e.aShare).padStart(4) + ' (lg ' + pct(e.lgShare) + ')   ' +
          'opp allows ' + pct(e.bAllows).padStart(4) + ' (lg ' + pct(e.lgAllows) + ')';
      console.log('    ' + e.path.padEnd(9) + desc.padEnd(52) +
        'intent ' + (e.intent >= 0 ? '+' : '') + e.intent.toFixed(1) +
        '  vuln ' + (e.vuln >= 0 ? '+' : '') + e.vuln.toFixed(1) +
        '  = ' + (e.edge >= 0 ? '+' : '') + e.edge.toFixed(1) +
        (e.thin ? '  THIN' : ''));
    }
  }
  console.log('\n  NOTE: no round-by-round data exists in the payload. Whole-fight totals only.');
}
function share2(o, k) { const t = POS.reduce((s, x) => s + o[x].att, 0); return t ? o[k].att / t : 0; }
main();
