#!/usr/bin/env node
/* gen-season-leaders.cjs — builds data/season-leaders.json: top-5 boards for
 * significant strikes landed, takedowns landed, KO/TKO wins and submission
 * wins, all for the CURRENT calendar year's UFC fights only. Feeds the
 * mobile app Home dashboard's "<year> Leaders" section (see mobile/www/js/
 * screens/home.js) via worker/index.js's GET /api/app/leaders.
 *
 * This is the "2026 Leaders" stat-leaderboard section flagged as not-yet-
 * built in home.js's original rebuild -- it needs a real aggregation over
 * fight-stats.json, which is what this script is.
 *
 * Data sources, same identity space, no fuzzy name matching needed:
 * - data/fighter-lite.json's bySlug -- the base set of fighters to consider
 *   (slug/name/photo/division), same file the app's roster/fighter screens
 *   already use.
 * - data/fight-stats.json -- keyed by the SAME fighter `name` fighter-lite
 *   uses, an array of that fighter's fights with per-fight landed totals
 *   (f.sigL, f.tdL) and a `date` string. This already only covers UFC
 *   bouts (ESPN box scores don't exist for other orgs -- see
 *   gen-app-fighter-extras.cjs's own comment on this), so no org filter
 *   needed here for the volume categories.
 * - index.html's embedded FIGHT_HISTORY const -- same per-fighter `name`
 *   keying, with `method`/`org`/`result` per fight (fight-stats.json has
 *   neither), used only for the KO/TKO and Submission win counts. Filtered
 *   to org === "UFC" here since FIGHT_HISTORY (unlike fight-stats.json)
 *   covers every org a fighter has ever fought in.
 *
 * Not a rate stat (no "/min"): a season leaderboard reads more naturally,
 * and more defensibly, as "who landed the most" / "who finished the most"
 * than a per-minute rate that a single explosive low-volume fight can win.
 *
 * SEASON_YEAR is the actual current calendar year at generation time, not
 * hardcoded -- home.js labels the section "<SEASON_YEAR> Leaders" so this
 * script (re-run periodically, same as the odds/rankings refreshes) keeps
 * it correct across a year boundary with no code change needed.
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const R = (p) => path.join(ROOT, p);
const OUT = R('data/season-leaders.json');
const TOP_N = 5;
const DRY = process.argv.includes('--dry-run');

// ENOENT is the only tolerable read failure (CLAUDE.md #2) -- offloaded/
// truncated/corrupt must throw, never silently produce an empty board.
function readOrThrow(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') throw new Error('missing: ' + p);
    throw new Error('unreadable, and that is NOT the same as absent: ' + p + ' — ' + e.message);
  }
}
const readJSON = (p) => JSON.parse(readOrThrow(p));

// Same brace-depth-scan + vm approach as gen-app-fighter-extras.cjs's/
// gen-matchup-free.cjs's grabConst.
function grabConst(html, name) {
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

const SEASON_YEAR = new Date().getFullYear();

function yearOf(dateStr) {
  const t = Date.parse(dateStr);
  return isNaN(t) ? null : new Date(t).getFullYear();
}

function main() {
  const fighterLite = readJSON(R('data/fighter-lite.json'));
  const fightStats = readJSON(R('data/fight-stats.json'));
  const html = readOrThrow(R('index.html'));
  const FIGHT_HISTORY = grabConst(html, 'FIGHT_HISTORY');

  const sigStrikes = [];
  const takedowns = [];
  const ko = [];
  const submissions = [];

  const bySlug = fighterLite.bySlug || {};
  Object.keys(bySlug).forEach((slug) => {
    const rec = bySlug[slug];
    const name = rec.name;
    if (!name) return;
    const base = { name, slug, photo: rec.photo || null, division: rec.division || '' };

    let sigSum = 0, tdSum = 0;
    (fightStats[name] || []).forEach((fight) => {
      if (yearOf(fight.date) !== SEASON_YEAR) return;
      if (!fight.f) return;
      sigSum += fight.f.sigL || 0;
      tdSum += fight.f.tdL || 0;
    });
    if (sigSum > 0) sigStrikes.push(Object.assign({ value: sigSum }, base));
    if (tdSum > 0) takedowns.push(Object.assign({ value: tdSum }, base));

    let koCount = 0, subCount = 0;
    (FIGHT_HISTORY[name] || []).forEach((fight) => {
      if (fight.org !== 'UFC') return;
      if (fight.result !== 'W') return;
      if (yearOf(fight.date) !== SEASON_YEAR) return;
      const m = String(fight.method || '');
      if (/^(KO|TKO)/i.test(m)) koCount++;
      else if (/^Submission/i.test(m)) subCount++;
    });
    if (koCount > 0) ko.push(Object.assign({ value: koCount }, base));
    if (subCount > 0) submissions.push(Object.assign({ value: subCount }, base));
  });

  // Ties broken alphabetically -- stable, deterministic, no arbitrary
  // "whoever the loop hit first" ordering.
  function topN(list) {
    return list
      .slice()
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
      .slice(0, TOP_N);
  }

  const out = {
    generatedAt: new Date().toISOString(),
    year: SEASON_YEAR,
    categories: {
      sigStrikes: topN(sigStrikes),
      takedowns: topN(takedowns),
      ko: topN(ko),
      submissions: topN(submissions),
    },
  };

  console.log(
    'season-leaders %d: sigStrikes=%d takedowns=%d ko=%d submissions=%d (candidates before top-%d cut)',
    SEASON_YEAR, sigStrikes.length, takedowns.length, ko.length, submissions.length, TOP_N
  );
  console.log(JSON.stringify(out.categories, null, 2).split('\n').slice(0, 30).join('\n'));

  if (DRY) return;
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log('wrote', OUT);
}

main();
