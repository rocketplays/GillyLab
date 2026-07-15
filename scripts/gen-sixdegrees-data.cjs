#!/usr/bin/env node
/* Six Degrees of the Octagon — board generator.
 *
 * Turns FIGHT_HISTORY (58k bout rows, 3.1k fighters) into a playable graph and
 * writes prototypes/sixdegrees-data.json.
 *
 * Three filters do the real work, each one load-bearing (measured, not guessed):
 *
 *  1. UFC-only. The raw graph is 22,432 nodes with a MEDIAN DEGREE OF 1 — it's
 *     mostly regional one-and-done opponents nobody can name. Restricting both
 *     corners to fighters with UFC experience gives 3,269 nodes / 13,324 edges
 *     and a median degree of 6.
 *
 *  2. Giant component only. Even UFC-only, ~11-18% of random pairs are
 *     unreachable (fighters marooned on islands). Puzzles drawn from anywhere
 *     else are literally unsolvable, so endpoints come only from the giant
 *     component.
 *
 *  3. Fame, for ENDPOINTS only. Degree is not fame — picking endpoints by
 *     "most opponents" yields journeymen and generates unplayable puzzles like
 *     "Da Woon Jung -> Steve Berger". Stars fight LESS than journeymen. So fame
 *     is derived from event titles instead: they read "UFC Fight Night: du
 *     Plessis vs. Usman", so a fighter whose surname appears in the title of
 *     their own bout headlined that card. Counting those ranks Anderson Silva,
 *     JDS, Bisping, GSP, DJ, Cormier at the top. Endpoints are drawn from the
 *     148 fighters who headlined 3+ cards; the PATH may run through anyone.
 *
 * Usage: node scripts/gen-sixdegrees-data.cjs [--puzzles N]
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'prototypes', 'sixdegrees-data.json');
const args = process.argv.slice(2);
const argN = (f, d) => { const i = args.indexOf(f); return i >= 0 ? +args[i + 1] : d; };
const N_PUZZLES = argN('--puzzles', 60);

const norm = s => String(s == null ? '' : s).toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const slugOf = s => norm(s).replace(/ /g, '-');

// --- FIGHT_HISTORY lives inside index.html; brace-match it out ---------------
// (A narrow regex silently truncates this to ~50 keys — brace-match or bust.)
function readFightHistory() {
  const h = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const i = h.indexOf('const FIGHT_HISTORY');
  if (i < 0) throw new Error('FIGHT_HISTORY not found in index.html');
  const s = h.indexOf('{', i);
  let d = 0, e = s;
  for (; e < h.length; e++) {
    const c = h[e];
    if (c === '{') d++;
    else if (c === '}') { d--; if (!d) { e++; break; } }
  }
  return eval('(' + h.slice(s, e) + ')');   // trusted local source
}

function main() {
  const FH = readFightHistory();

  // ---- pass 1: who has UFC experience, and who headlined ----
  const isUFC = Object.create(null);
  const fame = Object.create(null);
  const display = Object.create(null);

  for (const key of Object.keys(FH)) {
    const nk = norm(key);
    display[nk] = display[nk] || key;
    const last = nk.split(' ').pop();
    for (const b of FH[key]) {
      const ufcBout = /UFC/i.test(b.org || '');
      if (!ufcBout) continue;
      const no = norm(b.opponent);
      if (!no) continue;
      isUFC[nk] = 1; isUFC[no] = 1;
      display[no] = display[no] || b.opponent;
      const t = norm(b.event || '');
      if (last.length > 2 && t.includes(' vs') && new RegExp('\\b' + last + '\\b').test(t)) {
        fame[nk] = (fame[nk] || 0) + 1;
      }
    }
  }

  // ---- pass 2: adjacency + the bout behind each edge ----
  // NODES are gated on UFC experience; EDGES are not. Two UFC fighters who met
  // in PRIDE / Strikeforce / Bellator are still connected, and those are some of
  // the best links on the board — Wanderlei vs Hunt (PRIDE 25) is exactly the
  // kind of "oh RIGHT" moment the game is for. Gating edges on org=UFC as well
  // drops 13.3k edges to 8.1k and quietly deletes the sport's whole pre-Zuffa
  // memory.
  //
  // Edge flavour is what makes a solved path a story rather than a receipt, so
  // keep the bout that linked each pair (the earliest meeting) and its org.
  const adj = Object.create(null);
  const edgeInfo = Object.create(null);
  const ek = (a, b) => a < b ? a + '|' + b : b + '|' + a;

  for (const key of Object.keys(FH)) {
    const a = norm(key);
    if (!isUFC[a]) continue;
    for (const b of FH[key]) {
      const o = norm(b.opponent);
      if (!o || !isUFC[o] || o === a) continue;
      (adj[a] = adj[a] || new Set()).add(o);
      (adj[o] = adj[o] || new Set()).add(a);
      const k = ek(a, o);
      const prev = edgeInfo[k];
      const ts = Date.parse(b.date || '');
      if (!prev || (isFinite(ts) && ts < prev._ts)) {
        edgeInfo[k] = { _ts: isFinite(ts) ? ts : Infinity, d: b.date || '', e: b.event || '', m: b.method || '', r: b.round || 0, g: b.org || '' };
      }
    }
  }

  // ---- giant connected component ----
  const bfsAll = start => {
    const seen = { [start]: 0 }; const q = [start];
    while (q.length) { const c = q.shift(); for (const n of (adj[c] || [])) if (!(n in seen)) { seen[n] = seen[c] + 1; q.push(n); } }
    return seen;
  };
  const visited = Object.create(null);
  let giant = [];
  for (const k of Object.keys(adj)) {
    if (visited[k]) continue;
    const comp = Object.keys(bfsAll(k));
    comp.forEach(x => visited[x] = 1);
    if (comp.length > giant.length) giant = comp;
  }
  const inGiant = new Set(giant);

  // ---- pack: index-based, so the file stays small ----
  const ids = giant.slice().sort();
  const idx = Object.create(null);
  ids.forEach((k, i) => idx[k] = i);

  const fighters = ids.map(k => ({
    n: display[k] || k,
    s: slugOf(display[k] || k),
    f: fame[k] || 0,
    o: [...(adj[k] || [])].filter(o => inGiant.has(o)).map(o => idx[o]).sort((a, b) => a - b)
  }));

  // Edges, keyed "i-j" with i<j, carrying the bout that made the link.
  //
  // Event and method strings repeat hard across 12k edges ("UFC 100" appears on
  // every bout from that card; "Decision (Unanimous)" thousands of times), so
  // intern them into a table and store indices. Cuts the file roughly in half
  // for free.
  const pool = [];
  const poolIdx = new Map();
  const intern = s => {
    s = s || '';
    if (!s) return -1;
    let i = poolIdx.get(s);
    if (i === undefined) { i = pool.length; pool.push(s); poolIdx.set(s, i); }
    return i;
  };
  const edges = {};
  for (const k of Object.keys(edgeInfo)) {
    const [a, b] = k.split('|');
    if (!inGiant.has(a) || !inGiant.has(b)) continue;
    const i = idx[a], j = idx[b];
    const info = edgeInfo[k];
    // [date, eventIdx, methodIdx, round, orgIdx] — array, not object: no repeated keys
    edges[(i < j ? i + '-' + j : j + '-' + i)] = [info.d, intern(info.e), intern(info.m), info.r || 0, intern(info.g)];
  }

  // ---- puzzles: famous endpoints, par from BFS ----
  const bfsPath = (a, b) => {
    const prev = { [a]: -1 }; const q = [a];
    while (q.length) {
      const c = q.shift();
      if (c === b) { const p = []; let x = b; while (x !== -1) { p.unshift(x); x = prev[x]; } return p; }
      for (const n of fighters[c].o) if (!(n in prev)) { prev[n] = c; q.push(n); }
    }
    return null;
  };
  const stars = ids.map((k, i) => i).filter(i => fighters[i].f >= 3);
  const puzzles = [];
  const seenPair = new Set();
  // deterministic shuffle so the board is reproducible across runs
  let seed = 20260715;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

  // MIX, not "whatever falls out". Left to chance, random star pairs land on par
  // 4-5 about 2/3 of the time — and par 4-5 is only ~39% solvable even when you
  // can see the target's opponent list. Stocking the game with its own hardest
  // tier made it unwinnable; the first build shipped 38 of 60 puzzles at par 4+
  // and a playtester went 0-for.
  //
  // Measured solve rates for a mechanical player (target list visible, par+3):
  //     par 2   100%      par 2-3   73%      par 4-5   39%
  // So par 2 is the on-ramp, par 3 is the game, par 4 is the Friday. A fan who
  // knows the era beats these numbers — they're the floor, not the ceiling.
  const MIX = { 2: 20, 3: 25, 4: 15 };
  const need = par => (MIX[par] || 0) - puzzles.filter(p => p.par === par).length;
  const done = () => Object.keys(MIX).every(k => need(+k) <= 0);

  for (let tries = 0; tries < 600000 && !done(); tries++) {
    const a = stars[(rnd() * stars.length) | 0], b = stars[(rnd() * stars.length) | 0];
    if (a === b) continue;
    const pk = a < b ? a + '-' + b : b + '-' + a;
    if (seenPair.has(pk)) continue;
    const p = bfsPath(a, b);
    if (!p) continue;
    const par = p.length - 1;
    if (need(par) <= 0) continue;               // tier already full
    seenPair.add(pk);
    puzzles.push({ a, b, par, sol: p });        // sol = one optimal path, for the reveal
  }
  puzzles.sort((x, y) => x.par - y.par);

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({
    generatedAt: new Date().toISOString(),
    note: 'Nodes gated on UFC experience; edges are any bout between two such fighters (so PRIDE/Bellator links survive). Giant component only. Endpoints are 3+ time headliners; paths may run through anyone.',
    pool, fighters, edges, puzzles
  }));

  const kb = Math.round(fs.statSync(OUT).size / 1024);
  const byPar = {};
  puzzles.forEach(p => byPar[p.par] = (byPar[p.par] || 0) + 1);
  console.log('sixdegrees-data.json: ' + fighters.length + ' fighters · ' +
    Object.keys(edges).length + ' edges · ' + puzzles.length + ' puzzles · ' + kb + ' KB');
  console.log('  star endpoints (3+ headliners): ' + stars.length);
  console.log('  puzzles by par: ' + Object.keys(byPar).sort().map(k => 'par ' + k + '×' + byPar[k]).join(' · '));
}

if (require.main === module) main();
module.exports = { readFightHistory, norm, slugOf };
