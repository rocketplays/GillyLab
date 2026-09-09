#!/usr/bin/env node
/* gen-app-fighter-extras.cjs — per-fighter Career Accolades, Tape Study, Fight
 * History, Odds History and News, pre-baked at build time for the native
 * app's premium fighter-profile tabs. (Box scores for Fight History rows are
 * NOT baked in here -- see the FIGHT HISTORY section below for why, and
 * worker/index.js's /api/app/fighter-extras handler for where that lives.)
 *
 * WHY THIS EXISTS. ACCOLADES, TAPE_STUDY, FIGHT_HISTORY and ODDS_HISTORY are
 * const object literals embedded in index.html, keyed by fighter NAME, behind
 * the paywall Worker gates at the HTTP layer (readSession + subscribed, before
 * index.html is ever served). The app's /api/app/* endpoints are separate
 * routes that do NOT inherit that static-file gate — /api/app/fighter is
 * deliberately public (it only ever serves the free data/fighter-lite.json
 * bio). A premium fighter-extras endpoint needs its OWN readSession+subscribed
 * check (see worker/index.js), but it also needs the data itself somewhere
 * reachable from the Worker without parsing all of index.html (16MB+) per
 * request in a CPU-metered isolate. Same tradeoff gen-matchup-free.cjs and
 * gen-landing-data.cjs already made: parse once at build time, ship a bundled
 * worker/*.js module.
 *
 * TAPE STUDY GROUPING/SORTING is ported from populateTapeStudy() in index.html
 * (section forward-propagation + month/year sort) so the app's ordering matches
 * the site's exactly. The opponent-record-at-fight badge populateTapeStudy also
 * shows is deliberately NOT ported here — it depends on scoutingHistKey/
 * recordAsOf/OPPONENT_RECORD_CACHE, a much larger dependency chain used nowhere
 * else in this app, for a "(3-1-0)" badge that's a nice-to-have, not the feature.
 *
 * FIGHT HISTORY. Ported from populateFightHistory() (index.html
 * ~114845-114919). Each dated FIGHT_HISTORY row is embedded verbatim (date/
 * opponent/result/method/round/time/event) — deliberately WITHOUT the box
 * score. The site's own box-score modal (fightStatsFor()/openFightStats(),
 * ~114684-114832) matches "ESPN box scores exist for UFC bouts; non-UFC
 * fights have no record and stay un-clickable" by holding the ENTIRE
 * data/fight-stats.json (~8MB) in memory for every visitor (CLAUDE.md #3,
 * index.html ~112916) — fine there since it's loaded once per page-load
 * anyway. Embedding "just the bouts this fighter touches" here looked like
 * the equivalent per-fighter-scoped move, but every fight has two sides, so
 * a dry run pulled nearly the ENTIRE file back in anyway (21MB bundle, vs.
 * ~4MB without) — the same eager-payload problem CLAUDE.md #3 warns about,
 * just relocated from "every visitor's browser" to "every Worker deploy".
 * Box scores are instead attached per-row, per-fighter, per-request by
 * worker/index.js's /api/app/fighter-extras handler, which fetches
 * data/fight-stats.json through the ASSETS binding (loadAssetJson) — the
 * same lazy-fetch-at-request-time pattern already used there for
 * fighter-lite.json — rather than being baked into this static bundle at
 * all. The "Upcoming" placeholder row populateFightHistory synthesizes from
 * the live event carousel is NOT ported — the app's own Card/Matchup
 * screens already cover upcoming bouts.
 *
 * ODDS HISTORY. Ported from populateOddsHistory() (index.html ~115135-115197).
 * ODDS_HISTORY rows carry only `{opponent, odds, date?}` — date and result are
 * cross-referenced from FIGHT_HISTORY via matchFightHistoryRow's own logic
 * (normalized-opponent-name match, closest-date tiebreak for rematches using
 * ODDS_HISTORY's optional `date` as the hint) so the app doesn't need its own
 * copy of that resolution logic client-side.
 *
 * NEWS. Ported from populateFighterNews()/fighterNewsEntry() (index.html
 * ~128332-128418), reading data/fighter-news.json — normalized-name lookup
 * with the same unambiguous-token-subset fallback the site uses for alias/
 * suffix spelling mismatches across feeds.
 *
 * Output: worker/fighter-extras.js — `export default { generatedAt, bySlug: {
 * [slug]: { accolades, tapeStudy, fightHistory, oddsHistory, news } } }`,
 * keyed by the SAME slug space as data/fighter-lite.json's bySlug (this script
 * reads that file's `name` per slug to look up ACCOLADES/TAPE_STUDY/
 * FIGHT_HISTORY/ODDS_HISTORY, rather than recomputing its own slug — one
 * source of truth for name<->slug, no drift). A fighter with NONE of the five
 * is simply omitted; each field is independently omitted (not just emptied)
 * when that fighter has nothing for it, so the app can tell "no tab" from
 * "empty tab" the same way the site's own tab-hiding logic does.
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
// data/fighter-news.json is refreshed by a separate scheduled workflow (see
// its own header comment) — genuinely optional (ENOENT tolerated per
// CLAUDE.md #2), unlike index.html/fighter-lite.json/fight-stats.json below,
// which this script cannot run meaningfully without.
function readJSONOptional(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw new Error('unreadable, and that is NOT the same as absent: ' + p + ' — ' + e.message);
  }
}

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
const ODDS_HISTORY = grabConst('ODDS_HISTORY');
const FIGHTER_NEWS = readJSONOptional(R('data/fighter-news.json'));
// Box scores (data/fight-stats.json, ~8MB) are deliberately NOT read or
// embedded here. Bundling even just "the bouts this fighter's own history
// touches" still means bundling roughly the whole file (every fight has two
// sides, so nearly every fighter with any covered bout pulls its box score
// in) -- a dry run of that approach produced a 21MB worker/fighter-extras.js,
// the exact eager-payload problem CLAUDE.md #3 warns about, just moved from
// "every visitor's browser" to "every deploy's bundle size". worker/index.js's
// /api/app/fighter-extras handler instead fetches data/fight-stats.json via
// the ASSETS binding (loadAssetJson) AT REQUEST TIME -- same lazy-fetch
// pattern already used there for fighter-lite.json etc. -- and attaches a
// `stats:{f,o}` object to whichever fightHistory rows below have a matching
// box score, per fighter, per request, never bundled statically.

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

// ── fight history, ported from populateFightHistory() in index.html ─────────
// Only dated (completed) rows -- see header comment on why the "Upcoming"
// placeholder isn't ported. No `stats` field here -- worker/index.js attaches
// per-row box scores at request time (see the FIGHT_STATS comment above).
function buildFightHistory(name) {
  const raw = (FIGHT_HISTORY[name] || []).filter((f) => f && f.date);
  return raw.map((f) => ({
    date: f.date || null,
    opponent: f.opponent || null,
    result: f.result || null,
    method: f.method || null,
    round: f.round || null,
    time: f.time || null,
    event: f.event || null,
    org: f.org || null,
  }));
}

// ── odds history, ported from populateOddsHistory()/matchFightHistoryRow() in
// index.html. ODDS_HISTORY rows rarely carry their own reliable date/result --
// cross-reference the matching FIGHT_HISTORY row (by normalized opponent name,
// using ODDS_HISTORY's optional `date` to disambiguate rematches) for both. ──
function matchFightHistoryRow(name, opponent, dateHint) {
  const hist = FIGHT_HISTORY[name];
  if (!hist || !opponent) return null;
  const no = normName(opponent);
  const matches = hist.filter((f) => f && f.opponent && normName(f.opponent) === no);
  if (!matches.length) return null;
  if (matches.length === 1) return matches[0];
  if (dateHint) {
    const dt = Date.parse(dateHint);
    if (isFinite(dt)) {
      let best = null, bestDiff = Infinity;
      matches.forEach((m) => {
        const d2 = Date.parse(m.date);
        if (isFinite(d2)) { const diff = Math.abs(d2 - dt); if (diff < bestDiff) { bestDiff = diff; best = m; } }
      });
      if (best) return best;
    }
  }
  return matches[0];
}
function buildOddsHistory(name) {
  const raw = ODDS_HISTORY[name];
  if (!raw || !raw.length) return [];
  return raw.map((h) => {
    const matched = matchFightHistoryRow(name, h.opponent, h.date);
    return {
      opponent: h.opponent || null,
      odds: typeof h.odds === 'number' ? h.odds : null,
      date: (matched && matched.date) || h.date || null,
      result: (matched && matched.result) || null,
    };
  });
}

// ── fighter news, ported from populateFighterNews()/fighterNewsEntry()/
// _newsNorm() in index.html — a looser, space-preserving normalization than
// normName() above (that one's for FIGHT_HISTORY opponent matching), plus the
// same unambiguous-token-subset fallback for alias/suffix mismatches. ────────
function newsNorm(s) {
  return String(s == null ? '' : s).toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}
function fighterNewsEntry(name) {
  if (!FIGHTER_NEWS || !FIGHTER_NEWS.fighters) return null;
  const nn = newsNorm(name);
  if (FIGHTER_NEWS.fighters[nn]) return FIGHTER_NEWS.fighters[nn];
  const t = nn.split(' ').filter(Boolean);
  if (!t.length) return null;
  let hit = null, hits = 0;
  for (const k of Object.keys(FIGHTER_NEWS.fighters)) {
    const kt = k.split(' ').filter(Boolean);
    if (t.every((x) => kt.includes(x)) || kt.every((x) => t.includes(x))) { hit = FIGHTER_NEWS.fighters[k]; if (++hits > 1) break; }
  }
  return hits === 1 ? hit : null;
}
function buildNews(name) {
  const entry = fighterNewsEntry(name);
  const items = entry && Array.isArray(entry.items) ? entry.items : [];
  if (!items.length) return null;
  return {
    hasInjuryNews: !!(entry && entry.hasInjuryNews),
    items: items.map((it) => ({
      title: it.title || null, url: it.url || null,
      source: it.source || null, date: it.date || null, injury: !!it.injury,
    })),
  };
}

// ── walk every slug the app already knows about, so the extras endpoint's slug
// space matches /api/app/fighter's exactly (one source of truth: fighter-lite) ──
const lite = readJSON(R('data/fighter-lite.json'));
const bySlug = {};
let withAccolades = 0, withTape = 0, withHistory = 0, withOdds = 0, withNews = 0;
for (const slug of Object.keys(lite.bySlug || {})) {
  const name = lite.bySlug[slug] && lite.bySlug[slug].name;
  if (!name) continue;
  const accolades = buildAccolades(name);
  const tapeStudy = buildTapeStudy(name);
  const fightHistory = buildFightHistory(name);
  const oddsHistory = buildOddsHistory(name);
  const news = buildNews(name);
  if (!accolades.length && !tapeStudy.length && !fightHistory.length && !oddsHistory.length && !news) continue;
  const entry = {};
  // Each field independently present-or-omitted (never an empty array/null
  // placeholder) so the app can tell "no tab" from "empty tab" the same way
  // the site's own tab-hiding logic does — see header comment.
  if (accolades.length) { entry.accolades = accolades; withAccolades++; }
  if (tapeStudy.length) { entry.tapeStudy = tapeStudy; withTape++; }
  if (fightHistory.length) { entry.fightHistory = fightHistory; withHistory++; }
  if (oddsHistory.length) { entry.oddsHistory = oddsHistory; withOdds++; }
  if (news) { entry.news = news; withNews++; }
  bySlug[slug] = entry;
}

const out = { generatedAt: new Date().toISOString(), bySlug };
const json = JSON.stringify(out);
const mod = '// AUTO-GENERATED by scripts/gen-app-fighter-extras.cjs — do not edit by hand.\n' +
            "// Per-fighter Career Accolades, Tape Study, Fight History (with embedded\n" +
            '// box scores), Odds History and News for the app\'s premium fighter profile\n' +
            '// tabs (see worker/index.js\'s /api/app/fighter-extras). Keyed by the same\n' +
            '// slug space as data/fighter-lite.json\'s bySlug. Regenerate rather than\n' +
            '// patch: see the script header.\n' +
            'export default ' + json + ';\n';
if (!DRY) fs.writeFileSync(OUT, mod);
const kb = (n) => (n / 1024).toFixed(0) + 'KB';
console.log('worker/fighter-extras.js  ' + kb(mod.length) +
  '  ' + Object.keys(bySlug).length + ' fighter(s) with extras' +
  ' (' + withAccolades + ' accolades, ' + withTape + ' tape study, ' +
  withHistory + ' fight history, ' + withOdds + ' odds history, ' + withNews + ' news)' +
  (DRY ? '   [dry-run, nothing written]' : ''));
