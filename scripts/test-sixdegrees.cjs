#!/usr/bin/env node
/* Six Degrees prototype — verification.
 *
 * Loads the ACTUAL prototype page in jsdom and drives it by clicking, rather
 * than asserting on source strings. String-level checks are worthless here: the
 * bug I care about ("this puzzle is unsolvable", "this link isn't a real fight")
 * only exists at runtime, against real data.
 *
 * Usage: node scripts/test-sixdegrees.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, 'prototypes', 'sixdegrees-data.json'), 'utf8'));
const HTML = fs.readFileSync(path.join(ROOT, 'prototypes', 'six-degrees.html'), 'utf8');

let fails = 0;
const ok = (cond, label, extra) => {
  if (cond) console.log('  PASS  ' + label);
  else { fails++; console.log('  FAIL  ' + label + (extra ? '   ' + extra : '')); }
};

const F = DATA.fighters, P = DATA.puzzles;
const eKey = (a, b) => a < b ? a + '-' + b : b + '-' + a;

// ── 1. board integrity ──────────────────────────────────────────────────────
console.log('\n== board ==');
let asym = 0, selfLoop = 0, oob = 0, noEdge = 0;
for (let i = 0; i < F.length; i++) {
  for (const o of F[i].o) {
    if (o < 0 || o >= F.length) { oob++; continue; }
    if (o === i) selfLoop++;
    if (!F[o].o.includes(i)) asym++;                 // adjacency must be mutual
    if (!DATA.edges[eKey(i, o)]) noEdge++;           // every link must carry a real bout
  }
}
ok(oob === 0, 'every adjacency index is in range', 'oob=' + oob);
ok(selfLoop === 0, 'no fighter fights himself', 'loops=' + selfLoop);
ok(asym === 0, 'adjacency is symmetric', 'asym=' + asym);
ok(noEdge === 0, 'every adjacency has a bout behind it', 'missing=' + noEdge);

const eraFrom = id => (DATA.eras.find(e => e.id === id) || { from: 0 }).from;
const oppsIn = (i, from) => F[i].o.filter(o => F[o].l >= from);
const bfs = (from_, to, era) => {
  const cut = era === undefined ? 0 : era;
  const prev = { [from_]: -1 }, q = [from_];
  while (q.length) {
    const c = q.shift();
    if (c === to) { const p = []; let x = to; while (x !== -1) { p.unshift(x); x = prev[x]; } return p; }
    for (const n of oppsIn(c, cut)) if (!(n in prev)) { prev[n] = c; q.push(n); }
  }
  return null;
};

// giant component: every fighter must reach every other, or puzzles can be unsolvable
const seen = { 0: 0 }; const q = [0];
while (q.length) { const c = q.shift(); for (const n of F[c].o) if (!(n in seen)) { seen[n] = 1; q.push(n); } }
ok(Object.keys(seen).length === F.length, 'board is one connected component',
  Object.keys(seen).length + '/' + F.length);

// ── 2. every puzzle is solvable and the stated par is the true one ─────────
console.log('\n== puzzles ==');
let unsolvable = 0, badPar = 0, badSol = 0, fakeLink = 0;
let outOfEra = 0;
for (const p of P) {
  const cut = eraFrom(p.era);
  const real = bfs(p.a, p.b, cut);          // par must hold on THIS era's pruned graph
  if (!real) { unsolvable++; continue; }
  if (real.length - 1 !== p.par) badPar++;
  if (!p.sol || p.sol.length - 1 !== p.par || p.sol[0] !== p.a || p.sol[p.sol.length - 1] !== p.b) badSol++;
  for (let k = 0; k < p.sol.length - 1; k++) {
    if (!F[p.sol[k]].o.includes(p.sol[k + 1])) fakeLink++;   // shipped solution must be real fights
  }
  // A shipped solution routing through someone the board hides would be
  // unfollowable — the player can never click that tile.
  if (p.sol.some(i => F[i].l < cut)) outOfEra++;
}
ok(unsolvable === 0, 'every puzzle is reachable', 'unsolvable=' + unsolvable);
ok(badPar === 0, 'stated par equals true shortest path', 'wrong=' + badPar);
ok(badSol === 0, 'shipped solution matches par and endpoints', 'bad=' + badSol);
ok(fakeLink === 0, 'every step in a shipped solution is a real bout', 'fake=' + fakeLink);
ok(P.every(p => F[p.a].f >= 3 && F[p.b].f >= 3), 'both endpoints are 3+ time headliners');
ok(outOfEra === 0, 'no solution routes through a fighter their era hides', 'bad=' + outOfEra);
ok(P.every(p => F[p.a].l >= eraFrom(p.era) && F[p.b].l >= eraFrom(p.era)), 'endpoints live inside their own era');
for (const e of DATA.eras) {
  const mine = P.filter(p => p.era === e.id);
  ok(mine.length >= 40, 'era "' + e.id + '" has a full puzzle set', mine.length + ' puzzles');
}

// The first build shipped 38/60 puzzles at par 4+ — its own hardest tier, only
// ~39% solvable — and a playtester went 0-for. The mix is now load-bearing.
const byPar = {};
P.filter(p => p.era === 'modern').forEach(p => byPar[p.par] = (byPar[p.par] || 0) + 1);
ok((byPar[2] || 0) >= 15, 'enough par-2 on-ramp puzzles', 'par2=' + (byPar[2] || 0));
const nMod = P.filter(p => p.era === 'modern').length;
ok((byPar[2] || 0) + (byPar[3] || 0) >= nMod * 0.7, 'pool is mostly the tractable par 2-3 tier',
  'par2+3=' + ((byPar[2] || 0) + (byPar[3] || 0)) + '/' + nMod);
ok(!P.some(p => p.par > 4), 'nothing above par 4 ships', 'max=' + Math.max(...P.map(p => p.par)));

// Solve rate for a mechanical player who can see the dossier and plays the
// obvious bridge strategy. This is the FLOOR — a real fan does better.
const solveRate = pool => {
  let won = 0;
  for (const p of pool) {
    const cut = eraFrom(p.era);
    const tOpp = new Set(oppsIn(p.b, cut));
    let cur = p.a, n = 0, seen = new Set([cur]), got = false;
    while (n < p.par + 3) {
      if (oppsIn(cur, cut).includes(p.b)) { got = true; break; }
      const opts = oppsIn(cur, cut).filter(o => !seen.has(o));
      if (!opts.length) break;
      const br = opts.filter(o => tOpp.has(o));
      cur = (br.length ? br : opts).slice().sort((x, y) => F[y].f - F[x].f)[0];
      seen.add(cur); n++;
    }
    if (got) won++;
  }
  return won / pool.length;
};
const r2 = solveRate(P.filter(p => p.par === 2));
const rAll = solveRate(P.filter(p => p.era === 'modern'));
ok(r2 === 1, 'every par-2 is solvable by the obvious strategy', Math.round(r2 * 100) + '%');
ok(rAll >= 0.6, 'overall floor solve rate is playable', Math.round(rAll * 100) + '%');
console.log('        floor solve rate (dossier visible, par+3): ' + Math.round(rAll * 100) + '% — was 18% blind');

// ── 3. photos actually resolve ──────────────────────────────────────────────
console.log('\n== photos ==');
const photos = new Set(fs.readdirSync(path.join(ROOT, 'photos'))
  .filter(f => /\.jpg$/i.test(f)).map(f => f.replace(/\.jpg$/i, '')));
const endpointIdx = [...new Set(P.flatMap(p => [p.a, p.b]))];
const epHit = endpointIdx.filter(i => photos.has(F[i].s)).length;
const allHit = F.filter(f => photos.has(f.s)).length;
ok(epHit / endpointIdx.length > 0.9, 'puzzle endpoints have faces',
  epHit + '/' + endpointIdx.length + ' (' + Math.round(epHit / endpointIdx.length * 100) + '%)');
console.log('        whole board: ' + allHit + '/' + F.length + ' (' + Math.round(allHit / F.length * 100) + '%) — rest fall back to initials');

// ── 4. drive the REAL page: click a puzzle to completion ────────────────────
console.log('\n== playthrough (real page, real clicks) ==');
// beforeParse, not after: the page's script runs during parse, so stubs added
// afterwards land too late and the page boots with no fetch at all.
const dom = new JSDOM(HTML, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  beforeParse(window) {
    window.fetch = () => Promise.resolve({ json: () => Promise.resolve(DATA) });
    // no network in the harness — force the initials fallback path
    window.Image = class { set src(v) { setTimeout(() => this.onerror && this.onerror(), 0); } };
    window.scrollTo = () => {};
    window.alert = () => {};
  }
});
const win = dom.window;

(async () => {
  await new Promise(r => setTimeout(r, 60));
  const doc = win.document;
  // #app, not body: body.textContent includes the inline <script> source, which
  // contains the literal error string and matches its own check.
  const app = () => doc.querySelector('#app').textContent;
  // `let puz` / `let trail` are lexical top-level bindings — they never attach to
  // window, so reach them through the page's own scope.
  const peek = expr => win.eval(expr);
  // Card names carry badge text ('TARGET', 'FOUGHT PRATES') inside .nm — strip
  // it once, here, rather than in three places that drift apart.
  const cardName = c => { const n = c.querySelector('.nm').cloneNode(true);
    n.querySelectorAll('.badge').forEach(b => b.remove()); return n.textContent.trim(); };

  ok(!/Could not load/.test(app()), 'page booted against the data');
  ok(doc.querySelectorAll('.opp').length > 0, 'opponent grid rendered',
    doc.querySelectorAll('.opp').length + ' cards');
  ok(peek('puz').par === 2, 'opens on a par-2 on-ramp, not a puzzle you lose', 'par=' + peek('puz').par);

  // ── era scoping ──────────────────────────────────────────────────────────
  // The whole point is that a modern player never MEETS a 2009 fighter. If a
  // single out-of-era name reaches the screen, the fix hasn't worked.
  ok(peek('eraId') === 'modern', 'defaults to the modern board, not all-time');
  const yearsOnScreen = () => {
    const names = [...doc.querySelectorAll('.opp')].map(cardName)
      .concat([...doc.querySelectorAll('.dos-list .chip span')].map(c => c.textContent.trim()));
    return names.map(n => { const f = F.find(x => x.n === n); return f ? f.l : null; }).filter(Boolean);
  };
  {
    const ys = yearsOnScreen();
    const stale = ys.filter(y => y < 2018);
    ok(stale.length === 0, 'every name on screen fought in 2018 or later',
      stale.length ? stale.length + ' out-of-era (oldest ' + Math.min(...ys) + ')' : 'oldest=' + Math.min(...ys));
    ok(ys.length > 0, 'and the board is not empty', ys.length + ' names');
  }
  // Pruning is a property of the BOARD, not of one arbitrary start — plenty of
  // modern fighters have every opponent inside the window, so asserting on a
  // single grid is a coin flip.
  {
    const totalAll = F.reduce((s, f) => s + f.o.length, 0);
    const totalMod = F.filter(f => f.l >= 2018).reduce((s, f) => s + oppsIn(F.indexOf(f), 2018).length, 0);
    ok(totalMod < totalAll * 0.75, 'the modern board is genuinely pruned',
      totalMod + ' era-links vs ' + totalAll + ' all-time');
    const hidden = F.filter(f => f.l < 2018).length;
    ok(hidden > 500, 'and it hides a real chunk of the old guard', hidden + ' fighters hidden');
  }
  // Switching to all-time must bring the old guard back.
  {
    win.eval("setEra('all')");
    const allP = P.filter(p => p.era === 'all' && p.par === 2)[0];
    win.start(allP);
    await new Promise(r => setTimeout(r, 20));
    ok(peek('eraFrom') === 0, 'all-time era lifts the cut');
    win.eval("setEra('modern')");
    win.start(P.find(p => p.era === 'modern' && p.par === 2));
    await new Promise(r => setTimeout(r, 20));
  }

  // The dossier — without it a player is routing blind and solves 18%.
  const dossierNames = () => [...doc.querySelectorAll('.dos-list .chip span')].map(c => c.textContent.trim());
  ok(doc.querySelector('.dos'), 'target dossier is on the board');
  {
    // era-filtered, not all-time: showing a 2009 opponent you can never click
    // would be exactly the bug era scoping exists to kill.
    const want = new Set(oppsIn(peek('puz').b, 2018).map(i => F[i].n));
    const got = dossierNames();
    ok(got.length === want.size, 'dossier lists all the target\'s opponents', got.length + '/' + want.size);
    ok(got.every(n => want.has(n)), 'and nothing that isn\'t one');
  }
  ok(/Every tile below is someone/.test(app()), 'the mechanic is explained on the board');
  ok(/you're one hop out/.test(app()), 'the green highlight is explained');

  // The bridge highlight. Doing the set-intersection FOR the player was the
  // whole point ("the game isn't reading comprehension"), so it has to be
  // exactly right — a wrong highlight is worse than none at all.
  {
    const p = peek('puz');
    const tOpp = new Set(F[p.b].o);
    const cards = [...doc.querySelectorAll('.opp')];
    const flagged = cards.filter(c => c.classList.contains('bridge')).map(cardName);
    const shouldFlag = cards.map(cardName).filter(n => {
      const i = F.findIndex(f => f.n === n);
      return i !== p.b && tOpp.has(i);
    });
    ok(flagged.length === shouldFlag.length && flagged.every(n => shouldFlag.includes(n)),
      'every bridge is highlighted, and only real bridges are',
      'flagged=' + flagged.length + ' expected=' + shouldFlag.length);
    ok(flagged.length > 0, 'the par-2 opener actually shows a green bridge', flagged.join(', '));
    // the target itself is gold, never green — different meaning, different colour
    const tgtCard = cards.find(c => c.classList.contains('target'));
    ok(!tgtCard || !tgtCard.classList.contains('bridge'), 'target is gold, not green');
    // clicking a green bridge must genuinely leave you one hop out
    const bi = F.findIndex(f => f.n === flagged[0]);
    ok(F[bi].o.includes(p.b), 'a green card really is one hop from the target');
  }

  // Walk the optimal path by CLICKING the card whose name matches the next hop.
  const target = peek('puz');
  const solution = bfs(target.a, target.b);
  let clicked = 0;
  for (let k = 1; k < solution.length; k++) {
    const wantName = F[solution[k]].n;
    const cards = [...doc.querySelectorAll('.opp')];
    const card = cards.find(c => cardName(c) === wantName);
    if (!card) { ok(false, 'could click through to ' + wantName, 'card not in grid'); break; }
    card.dispatchEvent(new win.Event('click', { bubbles: true }));
    clicked++;
  }
  ok(clicked === solution.length - 1, 'clicked the full optimal chain', clicked + '/' + (solution.length - 1) + ' hops');
  ok(/Connected in/.test(app()), 'win state fired');
  ok(/par, optimal chain/.test(app()), 'scored as par');

  const share = doc.querySelector('.share');
  ok(share && /hops \(par \d\)/.test(share.textContent), 'share line rendered',
    share ? JSON.stringify(share.textContent.split('\n').pop()) : 'missing');

  // Every card in a live grid must be a genuine opponent of the current fighter.
  const cur = peek("trail")[peek("trail").length - 1];
  ok(cur === target.b, 'trail ends on the target');

  // Restart and confirm a bogus link is impossible: grid only ever shows F[cur].o
  win.start(P.find(p => p.par >= 4) || P[0]);
  await new Promise(r => setTimeout(r, 20));
  const cur2 = peek("trail")[0];
  const shown = [...doc.querySelectorAll('.opp')].map(cardName);
  const legit = new Set(F[cur2].o.map(i => F[i].n));
  ok(shown.every(n => legit.has(n)), 'grid only offers real opponents',
    shown.filter(n => !legit.has(n)).slice(0, 3).join(', '));
  ok(shown.length === F[cur2].o.length, 'grid shows all of them', shown.length + '/' + F[cur2].o.length);

  // ── 5. the budget: a game you cannot lose is not a game ───────────────────
  console.log('\n== budget / fail state ==');
  const p4 = P.find(x => x.par >= 3);
  win.start(p4);
  await new Promise(r => setTimeout(r, 20));
  const budget = p4.par + 3;
  ok(/Moves left/.test(app()), 'budget is surfaced to the player');
  ok(peek('budgetOf(puz)') === budget, 'budget is par+3', 'got ' + peek('budgetOf(puz)'));

  // Burn every move on links that are NOT the target, and confirm we lose.
  let guard = 0;
  while (peek('spent') < budget && guard++ < 40) {
    const cards = [...doc.querySelectorAll('.opp')].filter(c => !c.classList.contains('target'));
    if (!cards.length) break;
    cards[0].dispatchEvent(new win.Event('click', { bubbles: true }));
  }
  ok(peek('spent') === budget, 'moves actually run out', 'spent=' + peek('spent'));
  ok(/Out of moves/.test(app()), 'loss state fires when the budget is gone');
  ok(/The par line/.test(app()), 'the optimal chain is revealed on loss');
  ok(doc.querySelectorAll('.opp').length === 0, 'grid is gone — no clicking on past a loss');

  // A spent-out board must refuse further moves.
  const before = JSON.stringify(peek('trail'));
  win.eval('move(F[trail[trail.length-1]].o[0])');
  ok(JSON.stringify(peek('trail')) === before, 'move() is refused once out of budget');

  // Backing up costs a move — free undo would hand the budget back.
  win.start(p4);
  await new Promise(r => setTimeout(r, 20));
  const first = [...doc.querySelectorAll('.opp')].find(c => !c.classList.contains('target'));
  first.dispatchEvent(new win.Event('click', { bubbles: true }));
  ok(peek('spent') === 1, 'a forward click costs 1');
  win.eval('backTo(0)');
  ok(peek('spent') === 2, 'backing up costs 1 too', 'spent=' + peek('spent'));
  ok(peek('trail').length === 1, 'and it does return you to the start');

  console.log('\n' + (fails ? '  ' + fails + ' CHECK(S) FAILED' : '  all checks passed'));
  process.exit(fails ? 1 : 0);
})();
