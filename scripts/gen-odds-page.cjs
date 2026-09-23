#!/usr/bin/env node
/* gen-odds-page.cjs — the site's Odds & Projections matching/merging engine,
 * ported for the app's native Odds screen (mobile/www/js/screens/odds.js).
 *
 * WHY THIS EXISTS. The site's Odds & Projections page (index.html's
 * handleOddsPage/renderProjectionsPage) is a DOM-building feature: it fetches
 * data/odds.json + data/odds-history.json client-side, matches those raw
 * entries against the featured card's real booked bouts, merges in
 * MANUAL_PROP_ODDS (method/round-prop/totals lines no live feed carries for
 * small cards), and writes HTML strings straight into the page. The app has
 * no such DOM to write into and no reason to ship the ~40KB MANUAL_PROP_ODDS
 * blob or the matching logic twice by hand — same "ship JSON, render
 * natively" trade gen-fight-sim.cjs already made for the simulator.
 *
 * GENERATED, NEVER FORKED, same rule as every sibling script: the matching
 * helpers below (lastNameOf, the fuzzy-name matcher, canonOddsName,
 * isScheduledBout, buildBoutPairings, pairKey, findManualProps,
 * manualSideFor, oddsAvatarInitials) are sliced VERBATIM out of index.html by
 * literal string markers, not re-typed — if a marker ever stops matching
 * (the site's code moved or got refactored), this throws rather than
 * silently shipping stale/wrong matching rules. MANUAL_PROP_ODDS/
 * BOOK_KEY_MAP/BOOK_ORDER/NAME_ALIASES are the actual object literals,
 * parsed out of index.html the same way gen-fight-sim.cjs pulls
 * FIGHTER_STATS/NAME_ALIASES.
 *
 * WHAT'S DELIBERATELY NOT SLICED: the *Table()/render*HTML() functions
 * (buildMoneylineTable, buildTotalsTable, buildMethodTable,
 * buildDoubleChanceTable, buildRoundPropsTable, buildLineMovementHTML,
 * renderOddsHTML, renderProjectionsPage) — those build HTML strings for the
 * site's own DOM/CSS. worker/index.js's /api/app/odds endpoint re-shapes the
 * same matched data into plain JSON instead (same "generated fresh, not
 * sliced" treatment eventToCard already gets in worker/pages.js), and
 * mobile/www/js/screens/odds.js renders that JSON with its own markup/CSS.
 * The Parlay Builder (PARLAY/plToggle/plRender/plBookPrices/...) is pure,
 * stateful client-side UI logic with no server data dependency at all — it's
 * hand-ported into odds.js directly, the same way the site itself has no
 * server-side component for it either.
 *
 * Output: worker/odds-page.js — a real, executable ES module (function
 * declarations + baked data), imported by worker/index.js's /api/app/odds.
 *
 * Re-run this whenever MANUAL_PROP_ODDS is hand-edited in index.html (the
 * recurring "write this week's manual prop odds" task) or BOOK_KEY_MAP/
 * BOOK_ORDER/NAME_ALIASES change — worker/odds-page.js is a build artifact,
 * not something to hand-edit.
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const R = (p) => path.join(ROOT, p);
const OUT = R('worker/odds-page.js');
const DRY = process.argv.includes('--dry-run');

function readOrThrow(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') throw new Error('missing: ' + p);
    throw new Error('unreadable, and that is NOT the same as absent: ' + p + ' — ' + e.message);
  }
}

const html = readOrThrow(R('index.html'));

// Same balanced-brace slicer gen-fight-sim.cjs uses for object/array consts.
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

// Same balanced-brace function-body slicer gen-fight-sim.cjs uses (sliceFn).
// Verbatim text out, not a re-typed copy — see header comment.
function sliceFn(name) {
  const marker = 'function ' + name + '(';
  const i = html.indexOf(marker);
  if (i < 0) throw new Error(name + '() not found in index.html');
  if (html.indexOf(marker, i + 1) >= 0) throw new Error(name + '() marker matches more than once — no longer unique');
  let d = 0, k = html.indexOf('{', i), started = false;
  for (; k < html.length; k++) {
    const c = html[k];
    if (c === '{') { d++; started = true; }
    else if (c === '}') { d--; if (started && !d) { k++; break; } }
  }
  return html.slice(i, k);
}

// ── data consts ───────────────────────────────────────────────────────────
const MANUAL_PROP_ODDS = grabConst('MANUAL_PROP_ODDS');
const BOOK_KEY_MAP = grabConst('BOOK_KEY_MAP');
const BOOK_ORDER = grabConst('BOOK_ORDER');
// The app's own resolveSimName/canonicalSimName (worker/fight-sim.js) already
// bakes its own copy of this same map for its own resolution needs — this is
// a second, independent copy for the matching helpers below, same "freely
// re-extractable, single real source of truth in index.html" treatment
// gen-fight-sim.cjs gives it.
const NAME_ALIASES = grabConst('NAME_ALIASES');
// lastNameOf() (sliced below) reads this module-level Set — grabConst can't
// handle a `new Set([...])` initializer (its brace-matcher is for a bare
// [...]/{...} literal), so pull the line directly instead.
function grabLine(constName) {
  const marker = 'const ' + constName + ' =';
  const i = html.indexOf(marker);
  if (i < 0) throw new Error(constName + ' not found in index.html');
  const end = html.indexOf(';', i);
  if (end < 0) throw new Error('no terminating ; found for ' + constName);
  const ctx = {}; vm.createContext(ctx);
  return vm.runInContext(html.slice(i, end).replace(/^const\s+\S+\s*=/, ''), ctx);
}
const NAME_SUFFIXES = grabLine('NAME_SUFFIXES');
// vm.runInContext's Set comes from a separate realm, so `instanceof Set`
// fails even though .has() works fine — check duck-typed behavior instead.
if (typeof NAME_SUFFIXES.has !== 'function' || !NAME_SUFFIXES.has('jr')) throw new Error('NAME_SUFFIXES did not parse as expected — did it move/change shape?');

// ── matching helpers, sliced verbatim ────────────────────────────────────
const lastNameOfJS = sliceFn('lastNameOf');
const levenshteinDistJS = sliceFn('levenshteinDist');
const nameTokensJS = sliceFn('nameTokens');
const namesLikelyMatchJS = sliceFn('namesLikelyMatch');
const buildBoutPairingsJS = sliceFn('buildBoutPairings');
const canonOddsNameJS = sliceFn('canonOddsName');
const isScheduledBoutJS = sliceFn('isScheduledBout');
const pairKeyJS = sliceFn('pairKey');
const findManualPropsJS = sliceFn('findManualProps');
const manualSideForJS = sliceFn('manualSideFor');
const oddsAvatarInitialsJS = sliceFn('oddsAvatarInitials');

// Cheap sanity fence — throws rather than shipping a silently-truncated slice.
const SLICES = {
  lastNameOf: lastNameOfJS, levenshteinDist: levenshteinDistJS, nameTokens: nameTokensJS,
  namesLikelyMatch: namesLikelyMatchJS, buildBoutPairings: buildBoutPairingsJS,
  canonOddsName: canonOddsNameJS, isScheduledBout: isScheduledBoutJS, pairKey: pairKeyJS,
  findManualProps: findManualPropsJS, manualSideFor: manualSideForJS, oddsAvatarInitials: oddsAvatarInitialsJS,
};
for (const [name, src] of Object.entries(SLICES)) {
  if (!src || src.indexOf('{') < 0 || !src.trim().endsWith('}')) {
    throw new Error('slice for ' + name + '() looks malformed — did the marker match something unexpected?');
  }
}

const banner =
  '// GENERATED by scripts/gen-odds-page.cjs — do not hand-edit.\n' +
  '// Re-run that script after MANUAL_PROP_ODDS/BOOK_KEY_MAP/BOOK_ORDER/\n' +
  '// NAME_ALIASES change in index.html, or after the matching helpers below\n' +
  '// (lastNameOf, namesLikelyMatch, isScheduledBout, ...) get refactored there.\n' +
  '// See that script\'s header for the full "generated, never forked" reasoning.\n\n';

const dataJS =
  'export const MANUAL_PROP_ODDS = ' + JSON.stringify(MANUAL_PROP_ODDS) + ';\n' +
  'export const BOOK_KEY_MAP = ' + JSON.stringify(BOOK_KEY_MAP) + ';\n' +
  'export const BOOK_ORDER = ' + JSON.stringify(BOOK_ORDER) + ';\n' +
  'const NAME_ALIASES = ' + JSON.stringify(NAME_ALIASES) + ';\n' +
  'const NAME_SUFFIXES = new Set(' + JSON.stringify(Array.from(NAME_SUFFIXES)) + ');\n\n';

// Slices are plain `function name(...) { ... }` declarations — `export`
// prepended so worker/index.js can import them directly.
const fnsJS = [
  lastNameOfJS, levenshteinDistJS, nameTokensJS, namesLikelyMatchJS,
  buildBoutPairingsJS, canonOddsNameJS, isScheduledBoutJS, pairKeyJS,
  findManualPropsJS, manualSideForJS, oddsAvatarInitialsJS,
].map((fn) => 'export ' + fn).join('\n\n');

const out = banner + dataJS + fnsJS + '\n';

if (DRY) {
  console.log(out.slice(0, 2000) + '\n...(' + out.length + ' bytes total)');
  process.exit(0);
}

fs.writeFileSync(OUT, out);
console.log('wrote ' + OUT + ' (' + out.length + ' bytes, ' +
  Object.keys(MANUAL_PROP_ODDS).length + ' MANUAL_PROP_ODDS entries, ' +
  Object.keys(BOOK_KEY_MAP).length + ' books)');
