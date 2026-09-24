#!/usr/bin/env node
/* gen-deep-dive.cjs — the Matchup Analytics Deep Dive, for ANY pairing, computed
 * live in the Worker instead of pre-rendered at build time.
 *
 * WHY THIS IS A DIFFERENT SHAPE FROM gen-matchup-free.cjs. That script renders a
 * FINITE set of pairings (the current main event + the carousel's own main
 * events) at build time and ships the OUTPUT HTML. Premium app users get the
 * button on EVERY fight of EVERY upcoming card — an unbounded set that would
 * balloon worker/matchup-free.js by megabytes per card if pre-rendered the same
 * way (each fight's panel is ~60-90KB of HTML across 2 tabs x 3 filters). So
 * this instead ports the exact same trick scripts/gen-fight-sim.cjs already
 * uses for the Fight Simulator: bake the INPUT data (FIGHT_GRID, FIGHT_STATS,
 * the grid-names manifest, FIGHT_HISTORY, ACTIVE_ROSTER_ALIASES) plus the pure
 * rendering functions themselves, verbatim, so the Worker can compute any one
 * fighter pair's panel live, per request, in milliseconds — a couple of Map
 * lookups and some string-building, nothing like parsing an 8MB file.
 *
 * GENERATED, NEVER FORKED, same rule as every sibling script: this slices the
 * ACTUAL glHasGrid()..fightStatsFor() block out of index.html by the SAME
 * literal string markers gen-matchup-free.cjs already uses (and the verify
 * harness), and writes it verbatim, wrapped in the same sandbox shims that
 * script proves work (empty-array FIGHTERS, a no-op document, escHtmlAttr/
 * escJsAttr, no MutationObserver, no real fetch). If those markers ever move,
 * this throws rather than silently shipping stale math.
 *
 * WHY NOT nodejs_compat's vm/eval AT REQUEST TIME. This Worker has no
 * nodejs_compat flag (see wrangler.toml) — same constraint gen-fight-sim.cjs's
 * header documents — so anything dynamic has to happen at BUILD time (this
 * script, run in Node's own `vm` only to grab a couple of consts) and ship as
 * ordinary importable code. The sliced hub functions read `window.FIGHT_GRID`
 * etc and bare `ACTIVE_ROSTER_ALIASES`/`FIGHT_HISTORY` — those are baked here
 * as real top-level bindings, not re-created via eval in the Worker.
 *
 * Output: worker/deep-dive-data.js — a real, executable ES module exporting
 * `deepDiveAvailable(f1, f2)` (cheap: two Set lookups, used to annotate the
 * app's own /api/app/matchup fight list with a `dd` boolean so the button
 * never appears for a pairing with no data) and `computeDeepDive(nameA, nameB)`
 * (the full {n1,n2,striking,grappling} payload, or null).
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const R = (p) => path.join(ROOT, p);
const OUT = R('worker/deep-dive-data.js');
const DRY = process.argv.includes('--dry-run');

function readOrThrow(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') throw new Error('missing: ' + p);
    throw new Error('unreadable, and that is NOT the same as absent: ' + p + ' — ' + e.message);
  }
}
const readJSON = (p) => JSON.parse(readOrThrow(p));

const html = readOrThrow(R('index.html'));

function grabConst(name) {
  const i = html.indexOf('const ' + name + ' =');
  if (i < 0) throw new Error(name + ' not found in index.html');
  const s = html.indexOf('=', i) + 1;
  let d = 0, j = s, started = false;
  for (; j < html.length; j++) {
    const c = html[j];
    if (c === '[' || c === '{') { d++; started = true; }
    else if (c === ']' || c === '}') { d--; if (started && !d) { j++; break; } }
  }
  const ctx = {}; vm.createContext(ctx);
  return vm.runInContext('(' + html.slice(s, j) + ')', ctx);
}

// ── slice the hub out of index.html — SAME markers as gen-matchup-free.cjs ──
const JS_START = 'let _gridAliasMap = null;';
const JS_END = 'function fightStatsFor(name, date){';
const a = html.indexOf(JS_START), b = html.indexOf(JS_END);
if (a < 0 || b < 0 || b < a) throw new Error('hub JS markers not found in index.html — did _ddGrid/fightStatsFor move?');
const hubJS = html.slice(a, b);

// A cheap sanity fence: every function this on-demand path depends on.
const REQUIRED_FNS = ['glHasGrid', 'glDeepDiveAvailable', '_ddGrid', 'mhStriking', 'mhGrappling'];
for (const fn of REQUIRED_FNS) {
  if (hubJS.indexOf('function ' + fn + '(') < 0) throw new Error('expected function missing from hub slice: ' + fn);
}

// ── data the slice reads ─────────────────────────────────────────────────
const FIGHT_GRID = readJSON(R('data/fight-grid.json'));
const FIGHT_STATS = readJSON(R('data/fight-stats.json'));
const gn = readJSON(R('data/grid-names.json'));
const FIGHT_HISTORY = grabConst('FIGHT_HISTORY');
const ACTIVE_ROSTER_ALIASES = grabConst('ACTIVE_ROSTER_ALIASES');

// ── assemble the module ──────────────────────────────────────────────────
// window.FIGHT_STATS + FIGHT_HISTORY (Sep 2026 cold-start latency fix -- see
// git log) are the dominant cost here (~17.7MB of this module's ~18.1MB) and
// are NOT baked as literals below. They go to data/deep-dive-history.json
// instead (built and deployed normally, protected the same way every other
// /data/*.json the Worker serves via env.ASSETS already is -- see
// worker/fighter-extras.js's own header comment) and are fetched + cached
// lazily, once per isolate, only by computeDeepDive() -- the one function
// that actually touches them. window.FIGHT_GRID stays baked here (small,
// ~292KB): deepDiveAvailable()/glHasGrid() only ever touch window.GRID_NAMES
// (built from FIGHT_GRID below), never FIGHT_STATS/FIGHT_HISTORY, so keeping
// that cheap per-pair check synchronous (no env, no await) matters -- it's
// called on every fight in /api/app/matchup, not just when a user opens a
// Deep Dive panel.
const DATA_OUT = R('data/deep-dive-history.json');
const deepDiveHistoryLoaderJS =
  'let _ddLoading = null;\n' +
  'async function _ensureDeepDiveHistory(env) {\n' +
  '  if (window.FIGHT_STATS && typeof FIGHT_HISTORY !== "undefined" && FIGHT_HISTORY) return;\n' +
  '  if (_ddLoading) return _ddLoading;\n' +
  '  _ddLoading = (async () => {\n' +
  '    const res = await env.ASSETS.fetch(new Request("https://internal.gillylab/data/deep-dive-history.json"));\n' +
  '    if (!res.ok) throw new Error("deep-dive-history.json missing from the deployed build (status " + res.status + ")");\n' +
  '    const j = await res.json();\n' +
  '    window.FIGHT_STATS = j.FIGHT_STATS;\n' +
  '    FIGHT_HISTORY = j.FIGHT_HISTORY;\n' +
  '  })();\n' +
  '  try { await _ddLoading; } finally { _ddLoading = null; }\n' +
  '}\n';
const dataJS =
  '// Baked data — same four sources gen-matchup-free.cjs loads for the free\n' +
  '// page\'s main-event-only render, just kept as raw data here instead of\n' +
  '// being consumed into a fixed set of rendered panels.\n' +
  'const window = {};\n' +
  'let FIGHT_HISTORY;\n' +
  deepDiveHistoryLoaderJS +
  '// window.FIGHT_STATS is populated lazily by _ensureDeepDiveHistory() above, not baked here.\n' +
  'window.FIGHT_GRID = ' + JSON.stringify(FIGHT_GRID) + ';\n' +
  'window.GRID_BASE = ' + JSON.stringify(gn.base || null) + ';\n' +
  'window.GRID_DIVBASE = ' + JSON.stringify(gn.divBase || {}) + ';\n' +
  'window.GRID_DIVS = ' + JSON.stringify(gn.divs || {}) + ';\n' +
  // GRID_NAMES must hold _gridNorm()-normalized strings, not raw display
  // names -- glHasGrid() compares window.GRID_NAMES.has(_gridNorm(name)), and
  // gen-matchup-free.cjs's own ctx.window.GRID_NAMES assignment does exactly
  // this map at build time (`new Set((gn.names||[]).map(ctx._gridNorm))`).
  // _gridNorm isn't defined until the hub slice below runs, so this Set is
  // built AFTER the slice (see the entry-point section), from this raw array.
  'const GRID_NAMES_RAW = ' + JSON.stringify(gn.names || []) + ';\n' +
  'const ACTIVE_ROSTER_ALIASES = ' + JSON.stringify(ACTIVE_ROSTER_ALIASES) + ';\n' +
  'const FIGHTERS = [];\n' +
  '// window.GL_SHEET is deliberately absent — mhSheetBtn() (inside the slice)\n' +
  '// checks for it and returns \'\\\'\\\'\', so no "Generate sheet" buttons leak in.\n' +
  '\n' +
  '// ── sandbox shims the slice expects to find as bare/window globals ──────\n' +
  'function _stubEl() {\n' +
  "  return { style: {}, dataset: {}, classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },\n" +
  '    addEventListener(){}, appendChild(){}, setAttribute(){}, querySelector(){ return null; } };\n' +
  '}\n' +
  'const document = {\n' +
  '  getElementById: function(){ return null; }, querySelectorAll: function(){ return []; },\n' +
  '  createElement: _stubEl, addEventListener: function(){}, removeEventListener: function(){},\n' +
  '};\n' +
  'function escHtmlAttr(s) { return String(s == null ? \'\' : s).replace(/[&<>"]/g, function(c) { return ({ \'&\':\'&amp;\', \'<\':\'&lt;\', \'>\':\'&gt;\', \'"\':\'&quot;\' })[c]; }); }\n' +
  "function escJsAttr(s) { return String(s == null ? '' : s).replace(/['\\\\]/g, '\\\\$&'); }\n" +
  "function _fsAva(n) { return '<div>' + n + '</div>'; }\n" +
  'const MutationObserver = undefined;\n' +
  'function requestAnimationFrame(f) { return f(); }\n' +
  "function fetch() { return Promise.reject(new Error('no fetch at request time')); }\n";

// renderFilter() — the same per-filter helper gen-matchup-free.cjs's script
// defines (not part of the index.html slice, since it doesn't exist there
// either — the site calls mhStriking/mhGrappling directly from its own UI
// event handlers). Ported verbatim, minus the "throw on missing grid" and
// the shape-validation fence, which existed there to catch a build-time
// generator bug before it shipped to every visitor — this endpoint instead
// returns null for a caller to turn into a 404, no different from
// runFightSim()'s own "unknown fighter" convention in fight-sim.js.
const entryJS =
  '\n' +
  '// _gridNorm (defined in the hub slice above) exists now — build the real,\n' +
  '// normalized GRID_NAMES Set from the raw manifest names baked above. Same\n' +
  '// order of operations as gen-matchup-free.cjs, which does this assignment\n' +
  '// AFTER vm.runInContext(hubJS, ctx) for the exact same reason.\n' +
  'window.GRID_NAMES = new Set(GRID_NAMES_RAW.map(_gridNorm));\n' +
  '\n' +
  '// ── entry points for worker/index.js ─────────────────────────────────────\n' +
  'function renderFilter(nameA, nameB, filter) {\n' +
  "  const wantResult = filter === 'all' ? undefined : filter;\n" +
  '  const A = _ddGrid(nameA, wantResult), B = _ddGrid(nameB, wantResult);\n' +
  '  if (!A || !B) return null;\n' +
  "  const rf = filter === 'win' ? 'wins' : filter === 'loss' ? 'losses' : null;\n" +
  '  if (A.noData && B.noData) {\n' +
  "    const empty = '<div class=\"mh-empty\">Neither fighter has any UFC ' + rf + ' on record.</div>';\n" +
  '    return { striking: empty, grappling: empty };\n' +
  '  }\n' +
  "  let note = '';\n" +
  '  if (A.noData || B.noData) {\n' +
  '    const emptyName = A.noData ? nameA : nameB, shownName = A.noData ? nameB : nameA;\n' +
  "    note = '<div class=\"mh-filter-note\">' + escHtmlAttr(emptyName) + ' has no UFC ' + rf +\n" +
  "      ' on record — showing ' + escHtmlAttr(shownName) + '\\'s numbers only.</div>';\n" +
  '  }\n' +
  '  return { striking: note + mhStriking(A, B, nameA, nameB), grappling: note + mhGrappling(A, B, nameA, nameB) };\n' +
  '}\n' +
  '\n' +
  '// ── raw grid + shading for the app\'s share-sheet canvas ──────────────────\n' +
  '// mhStriking/mhGrappling above return HTML with the shading already baked in\n' +
  '// as inline style attributes (mhGrid()\'s own green/red backgrounds) -- fine\n' +
  '// for a DOM the client renders, useless for a <canvas> the client draws\n' +
  '// itself (see mobile/www/js/gl-sheet.js\'s drawStriking/drawGrappling, ported\n' +
  '// from GL_SHEET in index.html but fed real numbers over the wire instead of\n' +
  '// reading FIGHT_GRID/FIGHT_STATS globals the app never loads). Recomputes\n' +
  '// the SAME verdicts mhGrid()/_mhGrade() already compute for the HTML path,\n' +
  '// just returned as plain numbers/strings instead of baked into a style\n' +
  '// attribute or a coloured <div> -- same floor (_MH_FLOOR), same median/\n' +
  '// spread lookup (mhNorm), same two-bar grade test (_mhGrade), so a share\n' +
  '// sheet can never show a shade the modal itself would disagree with.\n' +
  "const SHEET_LANES = [['dist','head'],['dist','body'],['dist','leg'],['ground','head']];\n" +
  'function sheetSide(name) {\n' +
  '  const G = _ddGrid(name, undefined);\n' +
  '  if (!G) return null;\n' +
  '  const shadeCells = [], shadeCellsD = [];\n' +
  '  for (let i = 0; i < 9; i++) {\n' +
  '    const acc = G.cells[i], def = G.cellsD[i];\n' +
  '    const an = acc[1], dn = def[1];\n' +
  '    const ar = an ? acc[0]/an : 0, dr = dn ? def[0]/dn : 0;\n' +
  "    const ab = an >= _MH_FLOOR ? mhNorm(name, 'acc', i) : null;\n" +
  "    const db = dn >= _MH_FLOOR ? mhNorm(name, 'allow', i) : null;\n" +
  '    shadeCells.push(ab ? Math.max(-1, Math.min(1, ((ar - ab.med) / ab.spread) / 2)) : null);\n' +
  '    // Inverted, same as mhGrid()\'s own `if (invert) z = -z` for cellsD --\n' +
  '    // getting hit less than your peers is the good end, so the sign flips.\n' +
  '    shadeCellsD.push(db ? -Math.max(-1, Math.min(1, ((dr - db.med) / db.spread) / 2)) : null);\n' +
  '  }\n' +
  '  const gradeAllow = SHEET_LANES.map(([p, t]) => {\n' +
  '    const i = _MH_GI(p, t), cell = G.cellsD[i], n = cell[1];\n' +
  '    if (n < _MH_FLOOR) return null;\n' +
  '    const r = cell[0] / n;\n' +
  "    return _mhGrade(r, n, mhNorm(name, 'allow', i), true);\n" +
  '  });\n' +
  '  return Object.assign({}, G, { shadeCells, shadeCellsD, gradeAllow });\n' +
  '}\n' +
  'function sheetGrid(nameA, nameB) {\n' +
  '  const A = sheetSide(nameA), B = sheetSide(nameB);\n' +
  '  return (A && B) ? { A, B } : null;\n' +
  '}\n' +
  '\n' +
  '// Cheap per-fighter-pair check — two Set lookups through the same\n' +
  '// alias-normalizing glHasGrid() the hub itself gates on (see index.html\'s\n' +
  '// own comment: raw-string joins on this have broken three times already).\n' +
  '// Used by worker/index.js to annotate /api/app/matchup fights with a `dd`\n' +
  '// boolean, so the app only ever shows a Deep Dive button for a pairing\n' +
  '// that actually has data, never a dead-end tap.\n' +
  'export function deepDiveAvailable(f1, f2) {\n' +
  '  return glDeepDiveAvailable(f1, f2);\n' +
  '}\n' +
  '// The full modal payload for an arbitrary pair, computed live. Returns\n' +
  '// null when the pairing has no grid data (a debut, or a sweep that hasn\'t\n' +
  '// reached one of them) — not an error, same convention as fight-sim.js\'s\n' +
  '// runFightSim() returning null for an unresolvable name.\n' +
  'export async function computeDeepDive(env, nameA, nameB) {\n' +
  '  if (!glDeepDiveAvailable(nameA, nameB)) return null;\n' +
  '  await _ensureDeepDiveHistory(env);\n' +
  "  const striking = {}, grappling = {};\n" +
  "  for (const filter of ['all', 'win', 'loss']) {\n" +
  '    const r = renderFilter(nameA, nameB, filter);\n' +
  '    if (!r) return null;\n' +
  '    striking[filter] = r.striking;\n' +
  '    grappling[filter] = r.grappling;\n' +
  '  }\n' +
  '  return { n1: nameA, n2: nameB, striking, grappling, sheet: sheetGrid(nameA, nameB) };\n' +
  '}\n';

const mod =
  '// AUTO-GENERATED by scripts/gen-deep-dive.cjs — do not edit by hand.\n' +
  "// The Matchup Analytics Deep Dive's pure rendering (glHasGrid()..mhGrappling()),\n" +
  "// sliced verbatim from index.html's own hub — same slice gen-matchup-free.cjs\n" +
  '// uses for the free page\'s main-event-only render — plus the data it reads\n' +
  '// (FIGHT_GRID, FIGHT_STATS, the grid-names manifest, FIGHT_HISTORY,\n' +
  '// ACTIVE_ROSTER_ALIASES), so the Worker can compute ANY fighter pair\'s panel\n' +
  '// live, per request, instead of only the finite set gen-matchup-free.cjs\n' +
  '// pre-renders. See worker/index.js\'s /api/app/deep-dive-fight and its `dd`\n' +
  '// flag on /api/app/matchup fights. Regenerate rather than patch.\n' +
  '\n' +
  dataJS +
  '\n' +
  hubJS +
  entryJS;

if (!DRY) {
  fs.writeFileSync(DATA_OUT, JSON.stringify({ FIGHT_STATS: FIGHT_STATS, FIGHT_HISTORY: FIGHT_HISTORY }));
  fs.writeFileSync(OUT, mod);
}
const kb = (n) => (n / 1024).toFixed(0) + 'KB';
console.log('data/deep-dive-history.json  ' + kb(JSON.stringify({ FIGHT_STATS: FIGHT_STATS, FIGHT_HISTORY: FIGHT_HISTORY }).length) + '\n' +
  'worker/deep-dive-data.js  ' + kb(mod.length) +
  '  ' + Object.keys(FIGHT_GRID).length + ' fighters in grid, ' + (gn.names || []).length + ' in manifest' +
  (DRY ? '   [dry-run, nothing written]' : ''));
