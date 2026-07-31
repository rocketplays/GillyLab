#!/usr/bin/env node
/* gen-matchup-free.cjs — the matchup hub for the MAIN EVENT, rendered at build time
 * for the free /matchup page.
 *
 * WHY THIS EXISTS AT ALL. The hub lives in index.html, behind the paywall, and the
 * free matchup page is a different document served by the Worker. The main event is
 * shown free, so its deep dive should be too — but the free page cannot reach the
 * hub's code or its data:
 *     _ddGrid      -> FIGHT_GRID   (data/fight-grid.json, 241KB)
 *     _ddGrid      -> FIGHT_STATS  (data/fight-stats.json, 7.9MB)
 *     _ddGrid      -> FIGHT_HISTORY (inline in index.html — cage time, for per-15)
 *     mhNorm       -> grid-names.json (the division medians the grid shades against)
 * Shipping 7.9MB to a free page to render two fighters is not a trade anyone would
 * make.
 *
 * WHY BUILD TIME AND NOT PER REQUEST. The obvious alternative is for the Worker to
 * render it on the fly, which means parsing that 7.9MB on every hit to /matchup —
 * inside a 128MB, CPU-metered isolate, for a panel most visitors never open. Here it
 * happens once per card update, on CI, and the page ships with the HTML already in
 * it: no client JS, no data fetch, no Worker cost, and the panel is in the initial
 * HTML so it is there before any script runs.
 *
 * GENERATED, NEVER FORKED. This runs index.html's OWN mhStriking/mhGrappling/ddRead
 * over its OWN data — the same trick scripts/gen-gl-sheet.cjs uses for the share
 * sheet, and the same trick verify/harness.cjs uses to test the panel. A hand-copy of
 * the hub into pages.js would have drifted inside a week: the hub changed eight times
 * in the session that built it (window, per-15, wording, bars, legend...). If the
 * slice markers below ever stop matching, this FAILS rather than silently shipping a
 * stale panel — see the throws.
 *
 * THE SHEET BUTTONS EXCLUDE THEMSELVES, and that is not luck: mhSheetBtn() returns ''
 * unless window.GL_SHEET exists, and it does not in this sandbox. The free page gets
 * the analysis without the "Generate striking sheet" buttons, which is what was asked
 * for, without a flag anyone has to remember.
 *
 * Output: worker/matchup-free.js — `export default { slug, n1, n2, striking, grappling,
 * css, generatedAt }`. A BUNDLED MODULE, not a data file, because that is how this
 * Worker already ships generated payloads (landing-data.js, carousel-data.js,
 * pickem-model.js, scorecard-data.js) and because /matchup renders from
 * landingData rather than fetching anything. Bundled at deploy = no runtime fetch, no
 * ASSETS round-trip, and the panel is in the first byte of HTML.
 *
 * Run from CI after split-fight-grid.cjs (it needs the card-scoped grid + medians)
 * and after gen-landing-data.cjs is irrelevant — but the SLUG must match
 * landingData.card.slug or the page hides the button, so both must describe the same
 * card. They read the same event.json, so they do.
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const R = (p) => path.join(ROOT, p);
const OUT = R('worker/matchup-free.js');
const DRY = process.argv.includes('--dry-run');

// ENOENT IS THE ONLY TOLERABLE READ FAILURE (CLAUDE.md #2). A file that is present
// but unreadable — offloaded by iCloud, truncated, corrupt — must throw, not fall
// back to a default. A silent default here would ship a panel built from nothing.
function readOrThrow(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') throw new Error('missing (run split-fight-grid.cjs first): ' + p);
    throw new Error('unreadable, and that is NOT the same as absent: ' + p + ' — ' + e.message);
  }
}
const readJSON = (p) => JSON.parse(readOrThrow(p));

const html = readOrThrow(R('index.html'));

// ── slice the hub out of index.html ──────────────────────────────────────────
// Same markers the verify harness uses. If either moves, throw: a generator that
// quietly emits half a panel is worse than one that stops the build.
const JS_START = 'let _gridAliasMap = null;';
const JS_END = 'function fightStatsFor(name, date){';
const a = html.indexOf(JS_START), b = html.indexOf(JS_END);
if (a < 0 || b < 0 || b < a) throw new Error('hub JS markers not found in index.html — did _ddGrid/fightStatsFor move?');
const hubJS = html.slice(a, b);

// The hub's stylesheet: #mh-overlay .. the END of its @media block.
//
// IT USED TO STOP AT .mh-empty, AND THE RESPONSIVE RULES ARE RIGHT AFTER IT. The free
// page therefore shipped the hub with no breakpoint at all: .mh-grids never collapsed
// to one column, #mh-box never widened to 96vw, the header never wrapped. Measured at
// 430px: the free modal was 404px wide and scrolled 2px sideways, while the app's was
// 413 and didn't — because the app's `@media (max-width: 720px)` was firing and the
// free page had never been given it. Reported as "it doesn't all quite fit ... you can
// scroll left/right a bit", which is exactly what a missing breakpoint looks like.
//
// So the slice runs to the close of that block. Balance the braces rather than hunt
// for a marker: the last rule in it is a comment-heavy header override that anyone
// might reorder, and a slice keyed to whichever selector happens to be last is a slice
// that silently truncates the day someone moves one.
const CSS_START = '#mh-overlay {';
const ca = html.indexOf(CSS_START);
if (ca < 0) throw new Error('hub CSS start marker not found in index.html');
const mq = html.indexOf('@media (max-width: 720px)', ca);
if (mq < 0) throw new Error("the hub's @media (max-width: 720px) block not found — the free modal would ship with no breakpoint");
let depth = 0, ce = -1;
for (let i = mq; i < html.length; i++) {
  if (html[i] === '{') depth++;
  else if (html[i] === '}') { depth--; if (depth === 0) { ce = i; break; } }
}
if (ce < 0) throw new Error("the hub's @media block never closes — refusing to guess where it ends");
const hubCSS = html.slice(ca, ce + 1);
// .gl-sheet-btn styles the sheet buttons, which the free page does not render.
// Everything else in the block is load-bearing.

// FIGHT_HISTORY (cage time) and ACTIVE_ROSTER_ALIASES (the name join) are inline
// consts in index.html, not data files.
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

// ── the sandbox the hub runs in ──────────────────────────────────────────────
const ctx = {
  window: {}, console,
  document: {
    getElementById: () => null, querySelectorAll: () => [],
    createElement: () => ({ style: {}, dataset: {}, classList: { toggle() {}, add() {} }, addEventListener() {}, appendChild() {} }),
    addEventListener() {}, removeEventListener() {},
  },
  escHtmlAttr: (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
  escJsAttr: (s) => String(s == null ? '' : s).replace(/['\\]/g, '\\$&'),
  _fsAva: (n) => '<div>' + n + '</div>',
  FIGHTERS: [],
  MutationObserver: undefined, setTimeout, requestAnimationFrame: (f) => f(),
  fetch: () => Promise.reject(new Error('no fetch at build time')),
};
ctx.window = ctx; ctx.globalThis = ctx;
ctx.FIGHT_HISTORY = grabConst('FIGHT_HISTORY');
ctx.ACTIVE_ROSTER_ALIASES = grabConst('ACTIVE_ROSTER_ALIASES');
// NOTE: window.GL_SHEET is deliberately absent — mhSheetBtn() checks for it and
// returns '' , so the "Generate striking/grappling sheet" buttons are excluded.
vm.createContext(ctx);
vm.runInContext(hubJS, ctx, { filename: 'index.html:hub' });

ctx.window.FIGHT_GRID = readJSON(R('data/fight-grid.json'));
ctx.window.FIGHT_STATS = readJSON(R('data/fight-stats.json'));
const gn = readJSON(R('data/grid-names.json'));
ctx.window.GRID_BASE = gn.base;
ctx.window.GRID_DIVBASE = gn.divBase || {};
ctx.window.GRID_DIVS = gn.divs || {};
ctx.window.GRID_NAMES = new Set((gn.names || []).map(ctx._gridNorm));

// ── which bout is the main event? ────────────────────────────────────────────
// The same card the free page shows: the soonest event still ahead of us, 6h grace
// so a live card stays selected — mirroring loadUpcomingCard() in worker/index.js.
const feed = readJSON(R('data/event.json'));
const events = (feed.data || []).filter((e) => e && (e.bouts || []).length);
if (!events.length) throw new Error('no events with bouts in data/event.json');
const now = Date.now();
const byStart = events.slice().sort((x, y) => (Date.parse(x.startsAt || 0) || 0) - (Date.parse(y.startsAt || 0) || 0));
const ev = byStart.find((e) => (Date.parse(e.startsAt || 0) || 0) >= now - 6 * 3600 * 1000) || byStart[0];

// boutOrder is the card order and the main event is first. Same rule the page uses.
const bouts = (ev.bouts || [])
  .filter((x) => x && !x.isCancelled && (x.fighters || []).length === 2)
  .sort((x, y) => (x.boutOrder || 0) - (y.boutOrder || 0));
const main = bouts[0];
if (!main) throw new Error('no live bouts on ' + ev.slug);
const n1 = main.fighters[0].fighterName, n2 = main.fighters[1].fighterName;

// ── render ───────────────────────────────────────────────────────────────────
// striking/grappling are now { all, win, loss } — three pre-baked variants per
// tab, so the free page's filter pills (added alongside the app's — see
// MATCHUP-DEEPDIVE.txt and _ddGrid's resultFilter param) can swap between them
// with a display:none toggle, the same trick mfHubTab already uses for tabs.
// Nothing is computed client-side; all six panes ship in the initial HTML.
let out = { slug: ev.slug, n1, n2, striking: { all: '', win: '', loss: '' }, grappling: { all: '', win: '', loss: '' }, css: hubCSS, generatedAt: new Date().toISOString() };

if (!ctx.glDeepDiveAvailable(n1, n2)) {
  // NOT an error: the button is hidden in the app for exactly this case too — a
  // fighter with no grid yet (a debut, or a sweep that hasn't reached him). Emit an
  // empty payload and let the page omit the button, same as the app does.
  console.log('gen-matchup-free: no grid for ' + n1 + ' vs ' + n2 + ' — emitting an empty payload (the page will omit the button)');
} else {
  // Mirrors mhRenderBody's noData/note logic (index.html) exactly, since that is
  // the app's rule for what "no wins on record" should look like — a rule
  // change there without a matching change here is exactly the kind of drift
  // this generator exists to prevent.
  const renderFilter = (filter) => {
    const wantResult = filter === 'all' ? undefined : filter;
    const A = ctx._ddGrid(n1, wantResult), B = ctx._ddGrid(n2, wantResult);
    if (!A || !B) throw new Error('_ddGrid returned null for filter=' + filter + ' (' + n1 + ' vs ' + n2 + ')');
    const rf = filter === 'win' ? 'wins' : filter === 'loss' ? 'losses' : null;
    if (A.noData && B.noData) {
      const empty = '<div class="mh-empty">Neither fighter has any UFC ' + rf + ' on record.</div>';
      return { striking: empty, grappling: empty };
    }
    let note = '';
    if (A.noData || B.noData) {
      const emptyName = A.noData ? n1 : n2, shownName = A.noData ? n2 : n1;
      // "UFC" is load-bearing — mirrors mhRenderBody's wording in index.html. A
      // fighter can have real regional wins/losses this grid never sees.
      note = '<div class="mh-filter-note">' + ctx.escHtmlAttr(emptyName) + ' has no UFC ' + rf +
        ' on record — showing ' + ctx.escHtmlAttr(shownName) + '\'s numbers only.</div>';
    }
    return { striking: note + ctx.mhStriking(A, B, n1, n2), grappling: note + ctx.mhGrappling(A, B, n1, n2) };
  };

  for (const filter of ['all', 'win', 'loss']) {
    const r = renderFilter(filter);
    out.striking[filter] = r.striking;
    out.grappling[filter] = r.grappling;
  }

  // The panel must never ship a NaN or an [object Object] to a public page. The
  // "all" variant is guaranteed non-empty by glDeepDiveAvailable above; win/loss
  // legitimately can be short (the "no wins/losses on record" message), so only
  // the content-shape checks apply to them, not the length floor.
  for (const tabName of ['striking', 'grappling']) {
    for (const filter of ['all', 'win', 'loss']) {
      const v = out[tabName][filter], k = tabName + '.' + filter;
      if (!v) throw new Error(k + ' rendered empty — refusing to ship it');
      if (filter === 'all' && v.length < 200) throw new Error(k + ' rendered short — refusing to ship it');
      const bad = /NaN|undefined|\[object/.exec(v);
      if (bad) throw new Error(k + ' contains "' + bad[0] + '" — refusing to ship it');
      if (/data-mh-sheet/.test(v)) throw new Error(k + ' still has a Generate-sheet button — GL_SHEET leaked into the sandbox');
    }
  }
}

const json = JSON.stringify(out);
const mod = '// AUTO-GENERATED by scripts/gen-matchup-free.cjs — do not edit by hand.\n' +
            '// The matchup hub for THIS card\'s main event, rendered from index.html\'s own\n' +
            '// code at build time. Regenerate rather than patch: see the script header.\n' +
            'export default ' + json + ';\n';
if (!DRY) fs.writeFileSync(OUT, mod);
const kb = (n) => (n / 1024).toFixed(0) + 'KB';
const strikeKB = kb(out.striking.all.length + out.striking.win.length + out.striking.loss.length);
const grapKB = kb(out.grappling.all.length + out.grappling.win.length + out.grappling.loss.length);
console.log('worker/matchup-free.js  ' + kb(mod.length) +
  '  (' + n1 + ' vs ' + n2 + ', ' + ev.slug + ')' +
  '  striking ' + strikeKB + ' (all/win/loss) · grappling ' + grapKB + ' (all/win/loss) · css ' + kb(out.css.length) +
  (DRY ? '   [dry-run, nothing written]' : ''));
