#!/usr/bin/env node
/* gen-fight-sim.cjs — the Fight Simulator's pure math, ported for the app.
 *
 * WHY THIS IS A DIFFERENT SHAPE FROM EVERY OTHER gen-*.cjs SCRIPT HERE. Every
 * other generator (gen-matchup-free.cjs, gen-app-fighter-extras.cjs, ...)
 * pre-renders a FINITE set of inputs (scheduled fights, the current roster)
 * at build time and ships the OUTPUT. The simulator takes ANY fighter vs ANY
 * fighter — an unbounded combinatorial space — so there is no finite set of
 * outputs to bake. What CAN be baked is the INPUT data (FIGHTER_STATS,
 * FIGHT_HISTORY, a simplified rank-badge lookup) plus the pure computation
 * functions themselves, verbatim, so the Worker can run the actual
 * simulation live, per request, in milliseconds — Monte Carlo over a few
 * numbers, not a multi-MB parse.
 *
 * WHY NOT SHIP THE REAL JS TO THE APP'S WEBVIEW INSTEAD (the pattern used for
 * the Go Premium carousel / Deep Dive modal). Those are self-contained or
 * build-time-renderable. The simulator's DOM-touching code, autocomplete
 * picker, and math are woven through ~5,600 lines of index.html sharing
 * ambient globals and one undifferentiated stylesheet, AND its two data
 * dependencies (FIGHT_HISTORY ~9.6MB, FIGHTER_STATS ~750KB) would have to
 * ship to every device on every app install/update just to run a probability
 * calculation server hardware can do in single-digit milliseconds. Compute
 * server-side, ship a tiny JSON result, render natively — see the app's
 * screens/simulator.js.
 *
 * GENERATED, NEVER FORKED, same rule as every sibling script: this slices the
 * ACTUAL simPct()..simRunTrials() block out of index.html by literal string
 * markers and writes it verbatim. If those markers ever move (the block gets
 * refactored, functions renamed), this throws rather than silently shipping
 * stale math — see the marker-not-found checks below.
 *
 * WHAT'S DELIBERATELY LEFT OUT of the slice: simFindFighter/
 * simGetFighterRoster/simBuildAutocomplete/initSimFighterPickers (the
 * in-browser autocomplete — the app instead reuses the already-CORS-open
 * /api/fighter-search, a server-filtered lookup that already backs
 * matchup.js's search bar), renderSimResults/simMethodRowsHtml/
 * simFighterOpenAttr (DOM-building — the app renders the JSON result
 * natively instead), and the "Custom Simulator" (cs*) category-weight tool
 * layered on top (a separate, larger scope not attempted here).
 *
 * fighterDivisionRankBadge/normalizeFighterNameForMatch (used by
 * simRankTier/simRankClosenessFactor) live ~1,500 lines away from the sim
 * block, wired to a `RANKINGS_LOOKUP` the site only populates as a SIDE
 * EFFECT of visiting a fighter/event page elsewhere in the SPA (confirmed:
 * runFightSimulator() never calls loadRankingsLookup() itself — the live
 * site's simulator quietly runs with an empty lookup, i.e. no rank-closeness
 * softening, unless something else on the page happened to load it first).
 * Rather than inherit that accident, this script builds RANKINGS_LOOKUP
 * directly and deliberately from data/rankings.json, using the same
 * normalize+label logic as buildRankLookupFromPayload — minus its
 * resolveCanonicalFighterName alias-resolution pass (a handful of fighters
 * whose rankings-feed name differs from their roster name would get no
 * badge instead of a resolved one; the effect is a slightly less-softened
 * rank-closeness factor for those specific fighters, not a wrong number for
 * anyone else).
 *
 * Output: worker/fight-sim.js — a real, executable ES module (function
 * declarations + baked data, not a JSON blob) exporting
 * `runFightSim(nameA, nameB, rounds, n)`. Plain JS, no `vm`/`eval` at
 * request time — Cloudflare Workers here have no nodejs_compat flag (see
 * wrangler.toml), so anything dynamic has to happen at BUILD time (this
 * script, run in Node) and ship as ordinary importable code.
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const R = (p) => path.join(ROOT, p);
const OUT = R('worker/fight-sim.js');
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

// Slices a top-level `function NAME(...) { ... }` declaration out of
// index.html verbatim, by balanced braces -- same technique grabConst uses
// for object/array consts, generalized for function bodies. Used for
// renderMatchupBreakdown (Style/Pace/Path to victory/Storylines) and its
// small helpers, same "GENERATED, NEVER FORKED" rule as the sim-math slice
// below: if the marker stops matching exactly once, this throws rather than
// silently slicing something else.
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

// ── slice the pure-math block ────────────────────────────────────────────
const JS_START = 'function simPct(v, def) {';
const JS_END = 'function simMethodRowsHtml(methods, wins) {';
const a = html.indexOf(JS_START), b = html.indexOf(JS_END);
if (a < 0 || b < 0 || b < a) throw new Error('sim math markers not found in index.html — did the simulator get refactored?');
if (html.indexOf(JS_START, a + 1) >= 0) throw new Error('JS_START matches more than once — marker is no longer unique');
if (html.indexOf(JS_END, b + 1) >= 0) throw new Error('JS_END matches more than once — marker is no longer unique');
const simJS = html.slice(a, b);

// A cheap sanity fence: every function this block is supposed to define.
// Throws (rather than shipping silently-broken math) if the slice somehow
// stopped including one of them.
const REQUIRED_FNS = [
  'simPct', 'getSimProfile', 'simRateCredibility', 'simTrajectory', 'simAgeFactor',
  'simFinishStats', 'simVolatility', 'simStyleMatchupDelta', 'simPowerScore',
  'simRankTier', 'simRankClosenessFactor', 'simUnprovenPenalty', 'simHeadToHeadBoost',
  'simWinProbability', 'simMethodPool', 'simMethodDistribution', 'simPickMethod', 'simRunTrials',
];
for (const fn of REQUIRED_FNS) {
  if (simJS.indexOf('function ' + fn + '(') < 0) throw new Error('expected function missing from sim slice: ' + fn);
}

// ── Style / Pace / Path to victory / Storylines — renderMatchupBreakdown(),
// sliced verbatim (same rule as the sim-math block above). Unlike the sim
// math, this one is DOM-building: it calls document.createElement/
// appendChild throughout to build the site's own HTML. Called here with
// host=null (see matchupBreakdown() in entryJS below), every one of those
// DOM branches is either skipped (`if (host) ...`) or writes to a throwaway
// node that's never attached to anything real -- so a lightweight `document`
// stub (defined as a real top-level const in dataJS below, not vm/eval) is
// enough to let the function run for its RETURN VALUE (the OUT object:
// leanA/leanB/paceA/paceB/pathA/pathB/storyA/storyB) without needing a real
// DOM. This exact stub-document technique is already proven at build time
// in scripts/gen-landing-data.cjs's own breakdownFor() -- this just bakes it
// as real code instead of running it through `new Function` at build time,
// since the Worker has no such trick available at request time.
const breakdownJS = sliceFn('renderMatchupBreakdown');
if (breakdownJS.indexOf('OUT.leanA') < 0 || breakdownJS.indexOf('OUT.pathA') < 0 || breakdownJS.indexOf('OUT.storyA') < 0) {
  throw new Error('renderMatchupBreakdown slice is missing an expected OUT.* field — did it get refactored?');
}
// scoutingHistKey/_newsNorm — small helpers renderMatchupBreakdown reads by
// `typeof X === 'function' ? X : fallback`, i.e. it already tolerates their
// absence, but baking the real ones (rather than the degraded inline
// fallback) keeps name resolution consistent with fighterTaleOfTape's own
// resolveSimName/NAME_ALIASES pass instead of introducing a second, looser
// matching path.
const scoutingHistKeyJS = sliceFn('scoutingHistKey');
const newsNormJS = sliceFn('_newsNorm');

// calcAge — trivial, defined far away (~line 11843), inlined verbatim.
const CALC_AGE_START = 'function calcAge(dob) {';
const ca = html.indexOf(CALC_AGE_START);
if (ca < 0) throw new Error('calcAge not found in index.html');
const caEnd = html.indexOf('\n }', ca);
if (caEnd < 0) throw new Error('could not find the end of calcAge');
const calcAgeJS = html.slice(ca, caEnd + 3);

// ── FIGHTER_STATS / FIGHT_HISTORY — the only two data globals the math reads ──
const FIGHTER_STATS = grabConst('FIGHTER_STATS');
const FIGHT_HISTORY = grabConst('FIGHT_HISTORY');
// NAME_ALIASES — the site's own "these two strings mean the same fighter"
// map (odds feeds, ESPN imports, etc. spelling someone differently than our
// DB does -- e.g. "Jose Miguel Delgado" -> "Jose Delgado"). The app's own
// Simulate Matchup button passes whatever name the matchup card itself
// carries, which isn't always run through this map before reaching here the
// way the site's card-generation scripts do upstream -- so runFightSim
// below resolves through it itself rather than assuming an exact
// FIGHTER_STATS key match on whatever name arrives.
const NAME_ALIASES = grabConst('NAME_ALIASES');

// ── RANKINGS_LOOKUP — built directly from data/rankings.json (see header
// comment on why this deliberately does NOT replicate the site's own
// side-effect-populated version) ──
function normalizeFighterNameForMatch(name) {
  return String(name == null ? '' : name).trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l').replace(/ø/g, 'o').replace(/đ/g, 'd').replace(/ð/g, 'd')
    .replace(/ß/g, 'ss').replace(/æ/g, 'ae').replace(/œ/g, 'oe').replace(/þ/g, 'th');
}
function rankBadgeLabelForEntry(e) {
  if (e.isChampion) {
    const interim = e.championStatus === 'interim' || (e.fighter && e.fighter.championStatus === 'interim');
    return interim ? 'IC' : 'C';
  }
  return e.rank != null ? '#' + e.rank : '';
}
function buildRankLookup(payload) {
  const lookup = {};
  if (payload && Array.isArray(payload.data)) {
    payload.data.forEach((e) => {
      const division = e.division || '';
      if (division.indexOf('Pound-for-Pound') !== -1) return;
      const label = rankBadgeLabelForEntry(e);
      if (!label) return;
      const key = normalizeFighterNameForMatch(e.fighterName);
      if (key) lookup[key] = label;
    });
  }
  return lookup;
}
const rankingsPayload = readJSON(R('data/rankings.json'));
const RANKINGS_LOOKUP = buildRankLookup(rankingsPayload);

// simDivisionFinishPrior() (inside the slice) calls simGetFighterRoster(name)
// for `.division` alone — the picker function itself (FIGHTERS.find, keyed
// off the in-browser roster array we deliberately didn't bake in, see header)
// isn't needed for that one field. data/fighter-lite.json already has name
// and division per fighter, so a name->division map is a straight lookup,
// same "one source of truth" reasoning as gen-app-fighter-extras.cjs using
// it for the name<->slug mapping.
//
// fighter-lite.json stores the full label ("Women's Flyweight"), but every
// consumer of NAME_DIVISION downstream (SIM_DIVISION_LADDERS/LABELS in the
// sim math, and isFemale()'s WOMEN set in renderMatchupBreakdown) is keyed
// on the site's short abbreviation ("WFLW") -- discovered when isFemale()
// silently failed for a real women's matchup because "Women's Flyweight"
// never appears in WOMEN's own {WSW,WFLW,WBW,WFW,WFLY} keys. Map the full
// label back to the abbreviation those consumers actually expect.
const LABEL_TO_ABBR = {
  'Flyweight': 'FLW', 'Bantamweight': 'BW', 'Featherweight': 'FW', 'Lightweight': 'LW',
  'Welterweight': 'WW', 'Middleweight': 'MW', 'Light Heavyweight': 'LHW', 'Heavyweight': 'HW',
  "Women's Strawweight": 'WSW', "Women's Flyweight": 'WFLW',
  "Women's Bantamweight": 'WBW', "Women's Featherweight": 'WFW',
};
const liteData = readJSON(R('data/fighter-lite.json'));
const NAME_DIVISION = {};
for (const slug of Object.keys(liteData.bySlug || {})) {
  const f = liteData.bySlug[slug];
  const abbr = f && f.division && LABEL_TO_ABBR[f.division];
  if (f && f.name && abbr && !NAME_DIVISION[f.name]) NAME_DIVISION[f.name] = abbr;
}
// SIM_DIVISION_ALIASES lives ~200 lines before JS_START (outside the slice) —
// trivial, hardcoded here rather than adjusting the slice boundary for one line.
const SIM_DIVISION_ALIASES = { WFLY: 'WFLW' };

// Minimal FIGHTERS stand-in -- renderMatchupBreakdown's isFemale() reads
// fightersEntry(name).division alone (for he/she pronouns in Path to
// victory), via a `typeof FIGHTERS === 'undefined'` guard that degrades to
// "always male" if this isn't here. The FULL FIGHTERS array (every roster
// field: rank, record, initials, country, ...) isn't worth baking just for
// one field already sitting in NAME_DIVISION -- so this reshapes that
// existing map into the {name, division} shape fightersEntry's .find(...)
// needs, rather than shipping a second, larger copy of the roster.
const FIGHTERS_STUB = Object.keys(NAME_DIVISION).map((name) => ({ name, division: NAME_DIVISION[name] }));

// ── assemble the module ──────────────────────────────────────────────────
const dataJS =
  'const FIGHTER_STATS = ' + JSON.stringify(FIGHTER_STATS) + ';\n' +
  'const FIGHT_HISTORY = ' + JSON.stringify(FIGHT_HISTORY) + ';\n' +
  'const RANKINGS_LOOKUP = ' + JSON.stringify(RANKINGS_LOOKUP) + ';\n' +
  'const NAME_DIVISION = ' + JSON.stringify(NAME_DIVISION) + ';\n' +
  'const SIM_DIVISION_ALIASES = ' + JSON.stringify(SIM_DIVISION_ALIASES) + ';\n' +
  'const NAME_ALIASES = ' + JSON.stringify(NAME_ALIASES) + ';\n' +
  'const FIGHTERS = ' + JSON.stringify(FIGHTERS_STUB) + ';\n' +
  // A stub `document` so renderMatchupBreakdown's (unconditional, even when
  // host is null) document.createElement/createTextNode calls resolve to
  // something -- every node it builds either never gets appended to a real
  // host (host is always null here) or is a fully inert no-op object. Same
  // technique gen-landing-data.cjs's own breakdownFor() uses via
  // `new Function('document', src)(doc)`, just baked as a real top-level
  // binding instead of run through the Function constructor (unavailable
  // for the same nodejs_compat reason noted at the top of this file).
  'function _stubEl() {\n' +
  "  return { style: {}, className: '', textContent: '', innerHTML: '',\n" +
  '    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },\n' +
  '    appendChild(){}, setAttribute(){}, querySelector(){ return null; } };\n' +
  '}\n' +
  'const document = { createElement: _stubEl, createTextNode: function(){ return {}; } };\n' +
  scoutingHistKeyJS + '\n' +
  newsNormJS + '\n' +
  breakdownJS + '\n' +
  // _finishDur/_commonOpps -- NOT sliced from index.html (that logic lives
  // in renderScouting, a different, much larger DOM-building function this
  // deliberately does not port). These are faithful Node reimplementations
  // already maintained and proven at build time in gen-landing-data.cjs's
  // own _finishDur/_commonOpps (see that file's header: "Faithful Node
  // reimplementations of index.html's renderScouting") -- reused here
  // verbatim rather than a third copy, with scoutingHistKey (baked above)
  // standing in for that file's own _histKey.
  'function _fhReal(name) {\n' +
  '  const k = scoutingHistKey(name);\n' +
  "  return (k && FIGHT_HISTORY[k] || []).filter(function(f){ return f && f.date && f.result && f.result !== '–' && f.method !== 'Upcoming'; });\n" +
  '}\n' +
  'function _parseD(s) { const t = Date.parse(s); return isFinite(t) ? t : null; }\n' +
  'function _methodCat(m) {\n' +
  "  m = String(m || '');\n" +
  "  if (/sub/i.test(m)) return 'sub';\n" +
  "  if (/disqualif|\\bdq\\b/i.test(m)) return 'dq';\n" +
  "  if (/dec/i.test(m)) return 'dec';\n" +
  "  if (/ko|tko|knockout|stoppage|doctor|retire/i.test(m)) return 'ko';\n" +
  "  return 'other';\n" +
  '}\n' +
  'function _finishProfile(name) {\n' +
  '  let wins = 0, losses = 0, wKO = 0, wSub = 0, wDec = 0, lKO = 0, lSub = 0, lDQ = 0;\n' +
  '  _fhReal(name).forEach(function(f){\n' +
  '    const c = _methodCat(f.method);\n' +
  "    if (f.result === 'W') { wins++; if (c === 'ko') wKO++; else if (c === 'sub') wSub++; else if (c === 'dec') wDec++; }\n" +
  "    else if (f.result === 'L') { losses++; if (c === 'ko') lKO++; else if (c === 'sub') lSub++; else if (c === 'dq') lDQ++; }\n" +
  '  });\n' +
  '  const finWins = wKO + wSub;\n' +
  '  return { wins: wins, losses: losses, wKO: wKO, wSub: wSub, wDec: wDec, finWins: finWins, finRate: wins ? finWins / wins : null, timesFinished: lKO + lSub + lDQ, lKO: lKO, lSub: lSub, lDQ: lDQ };\n' +
  '}\n' +
  'function _finishDur(nameA, nameB) {\n' +
  '  const fp = _finishProfile(nameA), op = _finishProfile(nameB);\n' +
  '  if (!fp.wins && !fp.losses && !op.wins && !op.losses) return null;\n' +
  "  const rate = function(p){ return p.finRate == null ? '—' : (Math.round(p.finRate * 100) + '% (' + p.finWins + '/' + p.wins + ')'); };\n" +
  "  const methods = function(p){ const parts = []; if (p.wKO) parts.push(p.wKO + ' KO'); if (p.wSub) parts.push(p.wSub + ' SUB'); if (p.wDec) parts.push(p.wDec + ' DEC'); return parts.join(' · ') || '—'; };\n" +
  '  const fin = function(p){\n' +
  "    if (!(p.wins || p.losses)) return '—';\n" +
  "    if (!p.timesFinished) return 'Never';\n" +
  "    const parts = []; if (p.lKO) parts.push(p.lKO + ' KO/TKO'); if (p.lSub) parts.push(p.lSub + ' SUB'); if (p.lDQ) parts.push(p.lDQ + ' DQ');\n" +
  "    return p.timesFinished + '× (' + parts.join(', ') + ')';\n" +
  '  };\n' +
  '  const durRate = function(p){ return (p.wins + p.losses) > 0 ? p.timesFinished / (p.wins + p.losses) : null; };\n' +
  '  const drA = durRate(fp), drB = durRate(op);\n' +
  "  let tfA = '', tfB = '';\n" +
  "  if (drA != null && drB != null && drA !== drB) { tfA = drA < drB ? 'w' : 'l'; tfB = drA < drB ? 'l' : 'w'; }\n" +
  '  return { finRate: { a: rate(fp), b: rate(op) }, methods: { a: methods(fp), b: methods(op) }, timesFinished: { a: fin(fp), b: fin(op), aCls: tfA, bCls: tfB } };\n' +
  '}\n' +
  'function _commonOpps(nameA, nameB) {\n' +
  '  const histA = _fhReal(nameA), histB = _fhReal(nameB);\n' +
  '  if (!histA.length || !histB.length) return [];\n' +
  '  const nn = _newsNorm(nameA), on = _newsNorm(nameB);\n' +
  '  const resultsVs = function(h, target){ const t = _newsNorm(target); return h.filter(function(f){ return _newsNorm(f.opponent) === t; }).sort(function(a, b){ return (_parseD(b.date) || 0) - (_parseD(a.date) || 0); }); };\n' +
  '  const mineOpps = {};\n' +
  '  histA.forEach(function(f){ if (f.opponent) mineOpps[_newsNorm(f.opponent)] = f.opponent; });\n' +
  '  const shared = [], seen = {};\n' +
  '  histB.forEach(function(f){\n' +
  '    if (!f.opponent) return;\n' +
  '    const k = _newsNorm(f.opponent);\n' +
  '    if (k === nn || k === on || seen[k]) return;\n' +
  '    if (mineOpps[k]) { seen[k] = 1; shared.push(mineOpps[k]); }\n' +
  '  });\n' +
  '  const fmt = function(rows){\n' +
  "    if (!rows.length) return '—';\n" +
  "    if (rows.length === 1) { const r = rows[0]; return r.result + (r.method ? ' (' + _abbrMethod(r.method) + (r.round ? ' R' + r.round : '') + ')' : ''); }\n" +
  "    let w = 0, l = 0, d = 0; rows.forEach(function(r){ if (r.result === 'W') w++; else if (r.result === 'L') l++; else d++; });\n" +
  "    return w + '-' + l + (d ? '-' + d : '') + ' (' + rows.length + ' fights)';\n" +
  '  };\n' +
  "  const resCls = function(rows){ let w = 0, l = 0; rows.forEach(function(r){ if (r.result === 'W') w++; else if (r.result === 'L') l++; }); return w > l ? 'w' : (l > w ? 'l' : ''); };\n" +
  '  return shared.slice(0, 6).map(function(opp){\n' +
  '    const a = resultsVs(histA, opp), b = resultsVs(histB, opp);\n' +
  '    return { opp: opp, a: fmt(a), b: fmt(b), aCls: resCls(a), bCls: resCls(b) };\n' +
  '  });\n' +
  '}\n' +
  'function _abbrMethod(m) {\n' +
  "  const c = _methodCat(m); if (c === 'ko') return 'KO/TKO'; if (c === 'sub') return 'SUB'; if (c === 'dec') return 'DEC'; if (c === 'dq') return 'DQ';\n" +
  "  return String(m || '').split(' ')[0] || '';\n" +
  '}\n' +
  '// A name arrives here already-canonical for the search-picker flow (the\n' +
  "// app's own /api/fighter-search is keyed off the same roster this alias\n" +
  '// map ultimately resolves into), but the Card page\'s Simulate Matchup\n' +
  '// button passes whatever name the matchup/event data itself carries --\n' +
  '// not always run through this map first. Mirrors the site\'s own reason\n' +
  '// for NAME_ALIASES existing (see index.html): resolve a known alternate\n' +
  '// spelling to the FIGHTER_STATS key before giving up on it.\n' +
  'function resolveSimName(name) {\n' +
  '  if (FIGHTER_STATS[name]) return name;\n' +
  "  const alias = NAME_ALIASES[String(name || '').trim().toLowerCase()];\n" +
  '  if (alias && FIGHTER_STATS[alias]) return alias;\n' +
  '  return null;\n' +
  '}\n' +
  'function normalizeFighterNameForMatch(name) {\n' +
  "  return String(name == null ? '' : name).trim().toLowerCase()\n" +
  "    .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')\n" +
  "    .replace(/ł/g, 'l').replace(/ø/g, 'o').replace(/đ/g, 'd').replace(/ð/g, 'd')\n" +
  "    .replace(/ß/g, 'ss').replace(/æ/g, 'ae').replace(/œ/g, 'oe').replace(/þ/g, 'th');\n" +
  '}\n' +
  'function fighterDivisionRankBadge(name) {\n' +
  '  const key = normalizeFighterNameForMatch(name);\n' +
  "  return key ? (RANKINGS_LOOKUP[key] || '') : '';\n" +
  '}\n' +
  '// Minimal shim for the one field simDivisionFinishPrior() needs from the\n' +
  "// in-browser roster-picker's simGetFighterRoster() -- see the NAME_DIVISION\n" +
  '// comment above for why the full picker function isn\'t ported.\n' +
  'function simGetFighterRoster(name) {\n' +
  '  const div = NAME_DIVISION[name];\n' +
  '  return div ? { division: div } : null;\n' +
  '}\n';

const entryJS =
  '\n' +
  '// Entry point for worker/index.js\'s /api/app/fight-sim. Returns null for an\n' +
  '// unknown fighter name (caller turns that into a 404) rather than letting the\n' +
  '// math run on undefined and produce nonsense. Resolves through\n' +
  '// resolveSimName first (see its comment above) so an alias spelling\n' +
  '// (e.g. "Jose Miguel Delgado") still finds "Jose Delgado" in FIGHTER_STATS,\n' +
  '// and runs the actual trials against the CANONICAL names either way, so\n' +
  '// the result and every stat in it lines up with one consistent identity.\n' +
  'export function runFightSim(nameA, nameB, rounds, n) {\n' +
  '  const canonA = resolveSimName(nameA), canonB = resolveSimName(nameB);\n' +
  '  if (!canonA || !canonB) return null;\n' +
  '  return simRunTrials(canonA, canonB, n, rounds);\n' +
  '}\n' +
  'export function fightSimKnowsFighter(name) {\n' +
  '  return !!resolveSimName(name);\n' +
  '}\n' +
  '// The canonical FIGHTER_STATS key for a name that might be an alias --\n' +
  '// worker/index.js uses this to look up the matching slug/photo and to\n' +
  '// echo a name back that actually matches what runFightSim just computed,\n' +
  '// instead of echoing whatever spelling the caller happened to send.\n' +
  'export function canonicalSimName(name) {\n' +
  '  return resolveSimName(name);\n' +
  '}\n' +
  '// Tale-of-the-tape stat line for one fighter -- the same raw numbers the\n' +
  '// win-probability math itself reads out of FIGHTER_STATS, reshaped for\n' +
  '// the app\'s own head-to-head comparison table (see screens/simulator.js).\n' +
  '// Returns null for an unresolvable name, same convention as runFightSim.\n' +
  'export function fighterTaleOfTape(name) {\n' +
  '  const canon = resolveSimName(name);\n' +
  '  if (!canon) return null;\n' +
  '  const s = FIGHTER_STATS[canon] || {};\n' +
  '  return {\n' +
  '    name: canon,\n' +
  '    ht: s.ht || null,\n' +
  '    reach: s.reach || null,\n' +
  '    stance: s.stance || null,\n' +
  '    age: s.dob ? calcAge(s.dob) : null,\n' +
  '    slpm: s.slpm != null ? s.slpm : null,\n' +
  '    strAcc: s.strAcc || null,\n' +
  '    sapm: s.sapm != null ? s.sapm : null,\n' +
  '    strDef: s.strDef || null,\n' +
  '    tdLanded: s.tdLanded != null ? s.tdLanded : null,\n' +
  '    tdAcc: s.tdAcc || null,\n' +
  '    tdDef: s.tdDef || null,\n' +
  '    subAvg: s.subAvg != null ? s.subAvg : null,\n' +
  '    finRate: s.finRate || null,\n' +
  '    streak: s.streak != null ? s.streak : null,\n' +
  '  };\n' +
  '}\n' +
  '// Style / Pace / Path to victory / Storylines / Finish & durability /\n' +
  '// Common opponents -- the rest of what the site\'s own Simulate Matchup\n' +
  '// result shows beyond win% and method-of-victory, reshaped into the exact\n' +
  '// {lean, pace, path, story, finishDur, common} shape matchup.js\'s own\n' +
  '// breakdownHTML() already expects and renders (see mobile/www/js/screens/\n' +
  '// matchup.js) -- the app already has the renderer; this is what was\n' +
  '// missing to feed it for an arbitrary (not just scheduled) pairing.\n' +
  '// Returns null for an unresolvable name, same convention as runFightSim.\n' +
  'export function matchupBreakdown(nameA, nameB) {\n' +
  '  const canonA = resolveSimName(nameA), canonB = resolveSimName(nameB);\n' +
  '  if (!canonA || !canonB) return null;\n' +
  '  const out = renderMatchupBreakdown(null, canonA, canonB, {}) || {};\n' +
  '  return {\n' +
  '    lean: { a: out.leanA != null ? out.leanA : null, b: out.leanB != null ? out.leanB : null },\n' +
  '    pace: { a: out.paceA != null ? out.paceA : null, b: out.paceB != null ? out.paceB : null },\n' +
  '    path: { a: out.pathA || null, b: out.pathB || null },\n' +
  '    story: { a: out.storyA || [], b: out.storyB || [] },\n' +
  '    finishDur: _finishDur(canonA, canonB),\n' +
  '    common: _commonOpps(canonA, canonB),\n' +
  '  };\n' +
  '}\n';

const mod =
  '// AUTO-GENERATED by scripts/gen-fight-sim.cjs — do not edit by hand.\n' +
  "// The Fight Simulator's pure win-probability/method math, sliced verbatim\n" +
  "// from index.html's own simPct()..simRunTrials() block, plus the data it\n" +
  '// reads (FIGHTER_STATS, FIGHT_HISTORY) and a simplified RANKINGS_LOOKUP.\n' +
  '// See worker/index.js\'s /api/app/fight-sim. Regenerate rather than patch:\n' +
  '// see the script header for what this deliberately does and does not port.\n' +
  '\n' +
  dataJS +
  calcAgeJS + '\n' +
  simJS +
  entryJS;

if (!DRY) fs.writeFileSync(OUT, mod);
const kb = (n) => (n / 1024).toFixed(0) + 'KB';
console.log('worker/fight-sim.js  ' + kb(mod.length) +
  '  ' + Object.keys(FIGHTER_STATS).length + ' fighters, ' + Object.keys(RANKINGS_LOOKUP).length + ' ranked' +
  (DRY ? '   [dry-run, nothing written]' : ''));
