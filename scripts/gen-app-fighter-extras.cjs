#!/usr/bin/env node
/* gen-app-fighter-extras.cjs — per-fighter Career Accolades + Tape Study, pre-baked
 * at build time for the native app's premium fighter-profile tabs.
 *
 * WHY THIS EXISTS. ACCOLADES and TAPE_STUDY are const object literals embedded in
 * index.html, keyed by fighter NAME, behind the paywall Worker gates at the HTTP
 * layer (readSession + subscribed, before index.html is ever served). The app's
 * /api/app/* endpoints are separate routes that do NOT inherit that static-file
 * gate — /api/app/fighter is deliberately public (it only ever serves the free
 * data/fighter-lite.json bio). A premium fighter-extras endpoint needs its OWN
 * readSession+subscribed check (see worker/index.js), but it also needs the data
 * itself somewhere reachable from the Worker without parsing all of index.html
 * (16MB+) per request in a CPU-metered isolate. Same tradeoff gen-matchup-free.cjs
 * and gen-landing-data.cjs already made: parse once at build time, ship a bundled
 * worker/*.js module.
 *
 * TAPE STUDY GROUPING/SORTING is ported from populateTapeStudy() in index.html
 * (section forward-propagation + month/year sort) so the app's ordering matches
 * the site's exactly. The opponent-record-at-fight badge populateTapeStudy also
 * shows is deliberately NOT ported here — it depends on scoutingHistKey/
 * recordAsOf/OPPONENT_RECORD_CACHE, a much larger dependency chain used nowhere
 * else in this app, for a "(3-1-0)" badge that's a nice-to-have, not the feature.
 *
 * Output: worker/fighter-extras.js — `export default { generatedAt, bySlug: {
 * [slug]: { accolades: [...], tapeStudy: [...] } } }`, keyed by the SAME slug
 * space as data/fighter-lite.json's bySlug (this script reads that file's
 * `name` per slug to look up ACCOLADES/TAPE_STUDY/FIGHT_HISTORY, rather than
 * recomputing its own slug — one source of truth for name<->slug, no drift).
 * A fighter with neither accolades nor tape study is simply omitted.
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const R = (p) => path.join(ROOT, p);
const OUT = R('worker/fighter-extras.js');
const DRY = process.argv.includes('--dry-run');

// ENOENT is the only tolerable read failure (CLAUDE.md #2) — offloaded/truncated/
// corrupt must throw, never silently fall back to an empty extras file.
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

// Same brace-depth-scan + vm approach as gen-matchup-free.cjs's grabConst.
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

const ACCOLADES = grabConst('ACCOLADES');
const TAPE_STUDY = grabConst('TAPE_STUDY');
const FIGHT_HISTORY = grabConst('FIGHT_HISTORY');

// ── tape study grouping/sort, ported from populateTapeStudy() in index.html ──
const MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
function monthYearKey(r) {
  const m = String(r && r.event).match(/([A-Z][a-z]{2})\s+(\d{4})/);
  return m ? (+m[2]) * 100 + (MONTHS[m[1]] || 0) : 0;
}
// Resolve the real bout date for an opponent off FIGHT_HISTORY, same matching
// logic as matchFightHistoryRow() — normalized-name equality, no fuzzy fallback
// needed here since a build script has no "closest date hint" to disambiguate
// rematches beyond what's already in the event string.
function normName(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ''); }
function findBoutDate(name, opponent) {
  const hist = FIGHT_HISTORY[name];
  if (!hist || !opponent) return null;
  const no = normName(opponent);
  const m = hist.find((f) => f && f.opponent && normName(f.opponent) === no);
  return (m && m.date) || null;
}

function buildTapeStudy(name) {
  const raw = TAPE_STUDY[name];
  if (!raw || !raw.length) return [];
  const firstSec = (raw.find((r) => r && r.section) || {}).section || null;
  let cur = firstSec;
  const tagged = raw.map((r) => {
    if (r && r.section) cur = r.section;
    return { f: r, sec: (r && r.section) ? r.section : cur };
  });
  const order = [];
  const groups = {};
  tagged.forEach((t) => {
    const k = t.sec || '';
    if (!groups[k]) { groups[k] = []; order.push(k); }
    groups[k].push(t.f);
  });
  order.forEach((k) => groups[k].sort((a, b) => monthYearKey(b) - monthYearKey(a)));
  order.sort((a, b) => monthYearKey(groups[b][0]) - monthYearKey(groups[a][0]));
  const out = [];
  order.forEach((k) => {
    groups[k].forEach((f) => {
      out.push({
        opponent: f.opponent || null,
        url: f.url || null,
        event: f.event || null,
        section: k || null,
        date: findBoutDate(name, f.opponent),
      });
    });
  });
  return out;
}

function buildAccolades(name) {
  const raw = ACCOLADES[name];
  if (!raw || !raw.length) return [];
  return raw.map((a) => ({ icon: a.icon || null, title: a.title || null, detail: a.detail || null }));
}

// ── walk every slug the app already knows about, so the extras endpoint's slug
// space matches /api/app/fighter's exactly (one source of truth: fighter-lite) ──
const lite = readJSON(R('data/fighter-lite.json'));
const bySlug = {};
let withAccolades = 0, withTape = 0;
for (const slug of Object.keys(lite.bySlug || {})) {
  const name = lite.bySlug[slug] && lite.bySlug[slug].name;
  if (!name) continue;
  const accolades = buildAccolades(name);
  const tapeStudy = buildTapeStudy(name);
  if (!accolades.length && !tapeStudy.length) continue;
  if (accolades.length) withAccolades++;
  if (tapeStudy.length) withTape++;
  bySlug[slug] = { accolades, tapeStudy };
}

const out = { generatedAt: new Date().toISOString(), bySlug };
const json = JSON.stringify(out);
const mod = '// AUTO-GENERATED by scripts/gen-app-fighter-extras.cjs — do not edit by hand.\n' +
            "// Per-fighter Career Accolades + Tape Study for the app's premium fighter\n" +
            '// profile tabs (see worker/index.js\'s /api/app/fighter-extras). Keyed by the\n' +
            '// same slug space as data/fighter-lite.json\'s bySlug. Regenerate rather than\n' +
            '// patch: see the script header.\n' +
            'export default ' + json + ';\n';
if (!DRY) fs.writeFileSync(OUT, mod);
const kb = (n) => (n / 1024).toFixed(0) + 'KB';
console.log('worker/fighter-extras.js  ' + kb(mod.length) +
  '  ' + Object.keys(bySlug).length + ' fighter(s) with extras' +
  ' (' + withAccolades + ' with accolades, ' + withTape + ' with tape study)' +
  (DRY ? '   [dry-run, nothing written]' : ''));
