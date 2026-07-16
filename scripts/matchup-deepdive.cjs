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

// THE GRID lives in its own file — fight-stats.json is eager-fetched by every
// visitor at ~8MB and must not carry 2MB for a panel you have to click. Card-
// scoped by construction (only card fighters get backfilled), ~245KB, kept fresh
// by update-odds.yml twice a day. Absent = the fighter hasn't been backfilled, and
// the button hides; it is not an error.
let GRID = {};
try { GRID = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/fight-grid.json'), 'utf8')); }
catch (e) { GRID = {}; }

// Row-major, matching pack(): [distance, clinch, ground] x [head, body, leg].
const GI = (pos, tgt) => ['dist', 'clinch', 'ground'].indexOf(pos) * 3 + ['head', 'body', 'leg'].indexOf(tgt);

// MEASURED, AND THE REASON THESE ARE SEPARATE LANES AT ALL:
//   head accuracy AT DISTANCE    mean 35.8%  sd 4.9
//   head accuracy ON THE GROUND  mean 70.2%  sd 8.2
//   corr(the two) = -0.04       across 63 card fighters
// Zero correlation. Punching a man in the face standing up and punching a man in
// the face while sitting on him are unrelated skills, and `head 79%` averages them
// into one number that describes neither. Mackenzie Dern is +55 points better on
// the ground than at range; a kickboxer is +11. The old margin reported one figure
// for both. That is the entire case for this file reading the grid.
// side 'f' = what he threw (offence). side 'o' = what was thrown AT him (defence).
// The split keeps both, which is what makes "where can I hit this man, and from
// where" answerable at all — the defensive half is the part nothing in the app
// has ever read.
function gridFor(name, side, limit) {
  // NORMALISED, like every other lookup in this file, because I have now written
  // this bug three times in one session: once reporting 9% of a card as "no stats"
  // (it was du Plessis vs Du Plessis and Rakić vs Rakic), once dropping every
  // mononym from the backfill queue, and once here — where a raw `GRID[name]` with
  // a slug-derived "dricus du plessis" missed a fighter who WAS backfilled and
  // silently fell back to the margins. Same shape every time: two names for one
  // man, and the miss looks exactly like absent data.
  const rows = GRID[GRID_INDEX.get(norm(name))];
  if (!rows) return null;
  const cells = Array.from({ length: 9 }, () => ({ landed: 0, att: 0 }));
  let n = 0;
  for (const r of rows.slice(0, limit || 8)) {
    const g = r && r[side] && r[side].g;
    if (!g) continue;
    n++;
    for (let i = 0; i < 9; i++) { cells[i].landed += g[i][0]; cells[i].att += g[i][1]; }
  }
  return n ? { cells, fights: n } : null;
}
const gShare = (G, pos, tgt) => {
  const tot = G.cells.reduce((s, c) => s + c.att, 0);
  return tot ? G.cells[GI(pos, tgt)].att / tot : 0;
};
const gAcc = (G, pos, tgt) => {
  const c = G.cells[GI(pos, tgt)];
  return c.att ? c.landed / c.att : 0;
};

// NAME NORMALISATION IS NOT OPTIONAL. A naive join drops Dricus du Plessis (the
// card says "Du", the stats say "du") and Aleksandar Rakić (the ć). I measured
// coverage without this and reported 9% of a card as "no stats", including a
// champion. That number was about my matcher, not the dataset.
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z ]/g, '').trim();
const INDEX = new Map(Object.keys(STATS).map(k => [norm(k), k]));
const lookup = name => { const k = INDEX.get(norm(name)); return k ? STATS[k] : null; };
const GRID_INDEX = new Map(Object.keys(GRID).map(k => [norm(k), k]));

const ZONES = ['head', 'body', 'leg'];
const POS = ['dist', 'clinch', 'ground'];

// THE LANES THE GRID BUYS, and deliberately not all nine cells.
// Nine lanes on a 4-fight median sample is how you get a confident ranking of
// noise — clinch-leg and ground-leg are near-zero for almost everyone, and a lane
// nobody uses can still win a z-score contest by being weird. These four are the
// ones with real volume and real spread across the roster.
const GRID_LANES = [
  ['dist', 'head'],    // boxing/kickboxing at range
  ['dist', 'body'],
  ['dist', 'leg'],
  ['ground', 'head'],  // ground and pound — uncorrelated (-0.04) with dist-head
];
const LANE_LABEL = { 'dist.head': 'head at range', 'dist.body': 'body at range',
                     'dist.leg': 'leg kicks', 'ground.head': 'ground and pound' };

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
    // GRID LANES. Only fighters who have been backfilled contribute, so this
    // distribution is built from the card, not the league — which is correct for
    // the question ("is he unusual among the men who fight here") and worth being
    // explicit about, because it is NOT the same population as the margin
    // distributions above it. Two baselines in one file is a drift risk; they are
    // kept apart on purpose and neither is used to judge the other.
    const go = gridFor(name, 'f', 8), gd = gridFor(name, 'o', 8);
    if (go && go.fights >= 3) {
      for (const [pos, tgt] of GRID_LANES) {
        if (go.cells[GI(pos, tgt)].att >= 25) push('gShare.' + pos + '.' + tgt, gShare(go, pos, tgt));
      }
    }
    if (gd && gd.fights >= 3) {
      for (const [pos, tgt] of GRID_LANES) {
        if (gd.cells[GI(pos, tgt)].att >= 25) push('gAllow.' + pos + '.' + tgt, gAcc(gd, pos, tgt));
      }
    }
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
// KNOWN AND UNFIXED: THE LANES HAVE PREREQUISITES AND THIS MODEL DOES NOT KNOW IT.
//
// Measured on the first real bout it ran: Du Plessis's top-ranked path came out as
// GROUND AND POUND, +1.2 — built almost entirely from vuln +2.0 (Usman absorbs 93%
// of ground head strikes against a 71% league) while Du Plessis's own intent there
// is NEGATIVE (-0.8, he barely does it). And his takedown path is -0.4, because
// Usman is taken down on 16% of attempts. So the ranking is advising a man to
// ground-and-pound an opponent he cannot get to the ground.
//
// Ground-and-pound is GATED by a takedown. Head-at-range is gated by nothing. The
// cross treats them as peers, sums intent+vuln for each, and sorts — which is
// coherent only for lanes you can enter at will.
//
// NOT FIXED HERE ON PURPOSE. The obvious move is to scale the ground lane by the
// takedown edge, and I have twice today invented a plausible mechanism, shipped it,
// and found the justification was fiction (the "chin bug" that did not exist; the
// "legs are a narrow band" story behind the z-score change). A gating rule is a
// design decision that wants its own measurement across a card, not a same-day
// guess with a confident comment. Until then: the UI must NOT print this ranking
// as advice. The raw columns are honest; the order is a hypothesis.
function edges(A, B, L, aName, bName) {
  const z = (key, x) => { const d = L[key]; return d ? (x - d.m) / d.sd : 0; };
  const out = [];
  // GRID LANES when both fighters have been backfilled; MARGINS otherwise. The
  // grid is card-scoped, so a fighter from an old fight (or a --card run that
  // hasn't reached him) has none — and a deep dive that silently reports margins
  // as if they were lanes would be the worst of both. Say which one you used.
  const AG = gridFor(aName, 'f', 8), BG = gridFor(bName, 'o', 8);
  const useGrid = !!(AG && BG);
  if (useGrid) {
    for (const [pos, tgt] of GRID_LANES) {
      const key = pos + '.' + tgt;
      const dS = L['gShare.' + key], dA = L['gAllow.' + key];
      if (!dS || !dA) continue;
      const aSh = gShare(AG, pos, tgt), bAl = gAcc(BG, pos, tgt);
      const intent = (aSh - dS.m) / dS.sd, vuln = (bAl - dA.m) / dA.sd;
      out.push({
        path: LANE_LABEL[key], kind: 'strike',
        aShare: aSh, aAcc: gAcc(AG, pos, tgt), bAllows: bAl,
        lgShare: dS.m, lgAllows: dA.m,
        intent, vuln, edge: intent + vuln,
        n: AG.cells[GI(pos, tgt)].att, m: BG.cells[GI(pos, tgt)].att,
        thin: AG.cells[GI(pos, tgt)].att < 40 || BG.cells[GI(pos, tgt)].att < 25,
      });
    }
  } else {
    for (const k of ZONES) {
      const intent = z('offShare.' + k, share(A.off, k));
      const vuln = z('defAllow.' + k, acc(B.def, k));
      out.push({
        path: k + ' (margin)', kind: 'strike',
        aShare: share(A.off, k), aAcc: acc(A.off, k), bAllows: acc(B.def, k),
        lgShare: L['offShare.' + k].m, lgAllows: L['defAllow.' + k].m,
        intent, vuln, edge: intent + vuln,
        n: A.off[k].att, m: B.def[k].att,
        thin: A.off[k].att < 60 || B.def[k].att < 40,
      });
    }
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

  for (const [att, dfd, name, oname] of [[A, B, a, b], [B, A, b, a]]) {
    const usingGrid = !!(gridFor(name, 'f', 8) && gridFor(oname, 'o', 8));
    console.log('\n  THE CROSS — every path ' + name.split(' ').pop() + ' has, one unit (z)' +
      (usingGrid ? '   [GRID lanes]' : '   [margins — one or both not backfilled]'));
    for (const e of edges(att, dfd, L, name, oname)) {
      const desc = e.kind === "grapple"
        ? 'shoots ' + (att.tdA / Math.max(1, att.fights)).toFixed(1) + '/fight @ ' + pct(e.aAcc) +
          '   opp taken down ' + pct(e.bAllows) + ' (lg ' + pct(e.lgAllows) + ')'
        : 'aims ' + pct(e.aShare).padStart(4) + ' (lg ' + pct(e.lgShare) + ')   ' +
          'opp allows ' + pct(e.bAllows).padStart(4) + ' (lg ' + pct(e.lgAllows) + ')';
      console.log('    ' + e.path.padEnd(18) + desc.padEnd(50) +
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
