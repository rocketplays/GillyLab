#!/usr/bin/env node
/* Regenerates worker/landing-data.json — the small slice of REAL data shown on
 * the public (logged-out) marketing landing page that actually changes over
 * time: the featured division's Top-5 rankings and the latest weekly roster
 * changes. worker/pages.js imports this file and renders those two carousel
 * slides from it, so the landing stays current without hand-edits.
 *
 * Sources (the same ones the app uses):
 *   - data/rankings.json  → official UFC media-panel division rankings
 *   - index.html  → FIGHTERS records + the ROSTER_CHANGES weekly snapshot
 *
 * Safe by design: if either section can't be parsed, the existing
 * landing-data.json is left untouched (never overwritten with empty data) and
 * the script still exits 0, so a parse hiccup can't break the odds workflow or
 * ship a blank slide. Run it from the odds workflow before the commit step.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
// Emitted as an ES module (not .json) so both native-Node ESM and the wrangler
// (esbuild) bundle can `import` it without JSON import assertions.
const OUT = path.join(ROOT, 'worker', 'landing-data.js');
const RANK_DIVISION = 'Bantamweight';    // division shown in the rankings slide
const FEATURED_DIVISION = 'Welterweight'; // its champion is the featured-analytics fighter

const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// name -> "W-L-D" record, from the FIGHTERS roster array in index.html
function recordMap() {
  const m = {}, re = /\{ name: "([^"]+)", division: "[^"]*", rank: "[^"]*", record: "([^"]*)"/g;
  let x; while ((x = re.exec(idx))) m[x[1]] = x[2];
  return m;
}

// A single fighter's stat object from the FIGHTER_STATS map in index.html
function fighterStat(name) {
  const re = new RegExp('"' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '":\\s*\\{([^}]*)\\}');
  const m = idx.match(re);
  if (!m) return null;
  const o = {};
  m[1].replace(/(\w+):\s*("(?:[^"\\]|\\.)*"|'[^']*'|-?[\d.]+)/g, (_, k, v) => { o[k] = v.replace(/^['"]|['"]$/g, ''); });
  return o;
}
const initialsOf = (name) => String(name || '').trim().split(/\s+/).map(w => w[0] || '').filter(Boolean);

// Top 5 (+ champion) of a division, with real records
function buildRankings(rk, recMap) {
  const grp = rk.filter(x => x.division === RANK_DIVISION);
  const champ = grp.find(x => x.isChampion);
  const top = grp.filter(x => !x.isChampion).sort((a, b) => a.rank - b.rank).slice(0, 5);
  const row = (x, n) => ({
    n, name: x.fighterName, record: recMap[x.fighterName] || '', champ: !!x.isChampion,
    slug: photoExists(x.fighterSlug) ? x.fighterSlug : (photoExists(nameToSlug(x.fighterName)) ? nameToSlug(x.fighterName) : ''),
    initials: initials2(x.fighterName),
  });
  const rows = [...(champ ? [row(champ, 'C')] : []), ...top.map(x => row(x, String(x.rank)))];
  return { division: RANK_DIVISION, rows };
}

// The current champion of FEATURED_DIVISION, with real stats/record/photo — so
// the featured-analytics slide always shows whoever actually holds the belt.
function buildFeatured(rk, recMap) {
  const champ = rk.find(x => x.division === FEATURED_DIVISION && x.isChampion);
  if (!champ) return null;
  const st = fighterStat(champ.fighterName) || {};
  const stats = [
    ['Strikes Landed / Min', st.slpm], ['Striking Accuracy', st.strAcc], ['Strikes Absorbed / Min', st.sapm],
    ['Striking Defense', st.strDef], ['Knockdowns / 15', st.kd], ['Takedowns / 15', st.tdLanded],
    ['Takedown Accuracy', st.tdAcc], ['Takedown Defense', st.tdDef], ['Submission Avg', st.subAvg],
    ['Finish Rate', st.finRate],
  ].filter(s => s[1] != null && s[1] !== '');
  if (stats.length < 4) return null;   // not enough data → keep last-good
  const ini = initialsOf(champ.fighterName);
  return {
    name: champ.fighterName,
    slug: photoExists(champ.fighterSlug) ? champ.fighterSlug : (photoExists(nameToSlug(champ.fighterName)) ? nameToSlug(champ.fighterName) : ''),
    division: FEATURED_DIVISION,
    record: recMap[champ.fighterName] || '',
    initials: ((ini[0] || '') + (ini[ini.length - 1] || '')).toUpperCase(),
    stats,
  };
}

// Most-recent entry of the ROSTER_CHANGES array literal in index.html
function buildRoster() {
  const s = idx.indexOf('ROSTER_CHANGES =');
  if (s < 0) return null;
  let i = idx.indexOf('[', s), depth = 0, end = -1, inStr = false, q = '';
  for (; i < idx.length; i++) {
    const c = idx[i];
    if (inStr) { if (c === '\\') { i++; continue; } if (c === q) inStr = false; continue; }
    if (c === '"' || c === "'") { inStr = true; q = c; continue; }
    if (c === '[') depth++;
    else if (c === ']') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end < 0) return null;
  let RC; eval('RC=' + idx.slice(idx.indexOf('[', s), end + 1));   // our own data literal
  if (!Array.isArray(RC) || !RC.length) return null;
  const w = RC[0];
  // Only ship ONE name per column publicly (plus the totals) so the full weekly
  // signings/cuts list isn't exposed on the logged-out page — the rest shows as
  // "+N more".
  const added = w.added || [], removed = w.removed || [];
  return {
    week: w.week || '',
    added: added.slice(0, 1), addedTotal: added.length,
    removed: removed.slice(0, 1), removedTotal: removed.length,
  };
}

// ── slug / odds helpers (nameToSlug mirrors index.html so photo files resolve) ──
const SLUG_MAP = { 'ł':'l','Ł':'L','đ':'d','Đ':'D','ø':'o','Ø':'O','æ':'ae','Æ':'AE','œ':'oe','Œ':'OE','ß':'ss','ı':'i','İ':'I' };
function nameToSlug(name) {
  return String(name).toLowerCase()
    .replace(/\s+(jr\.?|sr\.?|i{1,3}|iv|v)\s*$/i, '')
    .replace(/[łŁđĐøØæÆœŒßıİ]/g, ch => SLUG_MAP[ch] || ch)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
// public/photos/thumb is produced by the build, which runs AFTER this script, so
// on a fresh CI checkout it does not exist and every slug would resolve to '' --
// the landing page would silently lose its photos. photos/thumb is the tracked
// library the build copies from; data/photos holds sources the workflow's photo
// step refreshes just before this runs. Accept any of the three.
const PHOTO_DIRS = ['photos/thumb', 'public/photos/thumb', 'data/photos'];
const photoExists = (slug) => !!slug && PHOTO_DIRS.some((d) => fs.existsSync(path.join(ROOT, d, slug + '.png')));
const initials2 = (name) => { const p = String(name).trim().split(/\s+/); return (((p[0] || '')[0] || '') + ((p[p.length - 1] || '')[0] || '')).toUpperCase(); };
const toProb = (o) => o < 0 ? (-o) / ((-o) + 100) : 100 / (o + 100);
const toAmerican = (p) => p >= 0.5 ? Math.round(-100 * p / (1 - p)) : Math.round(100 * (1 - p) / p);
const round5 = (n) => Math.round(n / 5) * 5;
const fmtOdds = (a) => (a > 0 ? '+' : '') + a;
const lastName = (s) => String(s || '').toLowerCase().split(' ').pop();

// Extract a top-level `NAME = {...}` object literal from index.html and eval it.
function extractObject(marker) {
  const s = idx.indexOf(marker); if (s < 0) return null;
  let i = idx.indexOf('{', s), depth = 0, end = -1, inStr = false, q = '';
  for (; i < idx.length; i++) {
    const c = idx[i];
    if (inStr) { if (c === '\\') { i++; continue; } if (c === q) inStr = false; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = true; q = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end < 0) return null;
  let O; eval('O=' + idx.slice(idx.indexOf('{', s), end + 1)); return O;
}

// Exact corpus counts, measured not rounded. "3,000+" is the shape every landing
// page uses; a measured number reads as measured. Regenerated on every build, so
// they cannot drift as the roster grows.
// Extract a top-level `const NAME = {...};` literal by scanning braces line by
// line, then parse it. Counting rows with a regex is not safe here: braces appear
// inside strings (method names, event titles), so a character scan mis-bounds the
// block, and no single pattern matched the true row count -- `{ date: "` missed 48
// rows and `opponent: "` overcounted by 85.
function parseConst(name) {
  const lines = idx.split('\n');
  const i = lines.findIndex((l) => l.includes('const ' + name));
  if (i < 0) return null;
  let depth = 0, seen = false, end = i;
  for (let k = i; k < lines.length; k++) {
    for (const c of lines[k]) { if (c === '{') { depth++; seen = true; } else if (c === '}') depth--; }
    if (seen && depth === 0) { end = k; break; }
  }
  const body = lines.slice(i, end + 1).join('\n').replace(/^\s*const \w+\s*=\s*/, '').replace(/;\s*$/, '');
  try { return new Function('return ' + body)(); } catch (e) { return null; }
}
function countStats() {
  const fighters = (idx.match(/\{ name: "[^"]+", division: "/g) || []).length;
  const FH = parseConst('FIGHT_HISTORY') || {};
  let rows = 0;
  for (const k of Object.keys(FH)) rows += (FH[k] || []).length;
  const TS = parseConst('TAPE_STUDY') || {};
  let videos = 0;
  for (const k of Object.keys(TS)) videos += (TS[k] || []).filter((r) => r && r.url).length;
  let photos = 0;
  try { photos = fs.readdirSync(path.join(ROOT, 'photos')).filter((f) => f.endsWith('.jpg')).length; } catch (e) {}
  // every bout appears once in each fighter's history
  return { fighters, bouts: Math.round(rows / 2), historyRows: rows, videos, photos };
}

// ── The next main event, rendered as a live demo in the hero ──────────────────
// The landing page used to show three round counters. This replaces them with the
// actual next main event: the analytics, not a count of them. Everything here is
// derived, never hand-written, so it can never go stale or overstate.
function rankMap() {
  const m = {}, re = /\{ name: "([^"]+)", division: "[^"]*", rank: "([^"]*)"/g;
  let x; while ((x = re.exec(idx))) m[x[1]] = x[2];
  return m;
}
// Striker-vs-grappler lean, 0..100. Identical to index.html's lean() — the 0.3
// grappling floor stops a fighter with no recorded takedowns pinning to 100.
function styleLean(st) {
  if (!st) return null;
  const slpm = parseFloat(st.slpm), td = parseFloat(st.tdLanded), sub = parseFloat(st.subAvg);
  if (![slpm, td, sub].every((v) => isFinite(v))) return null;
  const S = slpm / 2, G = Math.max(td + 1.5 * sub, 0.3);
  return Math.round((100 * S) / (S + G));
}
// One consensus moneyline, averaged across every book that prices the fight.
// Averaged in probability space: -300 and +300 are 75% and 25%, so the mean of
// two prices is meaningless.
function consensusOdds(nameA, nameB) {
  let odds;
  try { odds = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'odds.json'), 'utf8')); } catch (e) { return null; }
  if (!Array.isArray(odds)) return null;
  const ln = lastName;
  const ev = odds.find((e) => e && e.home_team && e.away_team &&
    ((ln(e.home_team) === ln(nameA) && ln(e.away_team) === ln(nameB)) ||
     (ln(e.home_team) === ln(nameB) && ln(e.away_team) === ln(nameA))));
  if (!ev || !Array.isArray(ev.bookmakers)) return null;
  const qa = [], qb = [];
  ev.bookmakers.forEach((bk) => {
    const mkt = (bk.markets || []).find((m) => m.key === 'h2h');
    if (!mkt || !Array.isArray(mkt.outcomes)) return;
    const pa = (mkt.outcomes.find((o) => ln(o.name) === ln(nameA)) || {}).price;
    const pb = (mkt.outcomes.find((o) => ln(o.name) === ln(nameB)) || {}).price;
    if (pa == null || pb == null) return;
    qa.push(toProb(pa)); qb.push(toProb(pb));
  });
  if (!qa.length) return null;
  const mean = (xs) => xs.reduce((t, v) => t + v, 0) / xs.length;
  const ma = mean(qa), mb = mean(qb);
  return { a: fmtOdds(toAmerican(ma)), b: fmtOdds(toAmerican(mb)), books: qa.length, favA: ma > mb, favB: mb > ma };
}
function buildMatchup(recMap) {
  let feed;
  try { feed = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'event.json'), 'utf8')); } catch (e) { return null; }
  const events = (feed && feed.data) || [];
  const ev = events.find((e) => e && e.status !== 'completed' && Array.isArray(e.bouts) && e.bouts.length);
  if (!ev) return null;
  // matchNumber 1 / cardPosition 1 is the main event; fall back to the first bout
  const bout = ev.bouts.find((x) => x && x.cardPosition === 1 && !x.isCancelled) || ev.bouts.find((x) => x && !x.isCancelled);
  if (!bout || !Array.isArray(bout.fighters) || bout.fighters.length !== 2) return null;

  const ranks = rankMap();
  const side = (f) => {
    const name = f.fighterName;
    const slug = nameToSlug(name);
    const st = fighterStat(name);
    return {
      name,
      slug: photoExists(slug) ? slug : '',
      initials: initials2(name),
      record: recMap[name] || '',
      rank: ranks[name] || '',
      lean: styleLean(st),
    };
  };
  const a = side(bout.fighters[0]), b = side(bout.fighters[1]);
  if (a.lean == null || b.lean == null) return null;   // no stats, no demo

  return {
    event: ev.title || 'UFC',
    startsAt: ev.startsAt || null,
    weightClass: (bout.weightClass || '').replace(/\s*Bout$/i, ''),
    titleBout: !!bout.titleBout,
    rounds: bout.numberOfRounds || 3,
    a, b,
    odds: consensusOdds(a.name, b.name),
  };
}

// A marquee fighter's closing-line history — mirrors the profile Odds History tab.
function buildOddsHistory() {
  const OH = extractObject('ODDS_HISTORY ='); if (!OH) return null;
  const prefer = ['Max Holloway', 'Charles Oliveira', 'Dustin Poirier', 'Justin Gaethje', 'Robert Whittaker', 'Conor McGregor'];
  let name = prefer.find(c => Array.isArray(OH[c]) && OH[c].length >= 5)
          || Object.keys(OH).find(k => Array.isArray(OH[k]) && OH[k].length >= 6);
  if (!name) return null;
  const rows = OH[name].slice(0, 7).map(h => ({ opponent: h.opponent, odds: h.odds })).filter(r => r.opponent && typeof r.odds === 'number');
  if (rows.length < 4) return null;
  const slug = nameToSlug(name);
  return { name, slug: photoExists(slug) ? slug : '', initials: initials2(name), rows };
}

function main() {
  const recMap = recordMap();
  // public/ is assembled by build-site.sh, which runs at DEPLOY time -- after
  // this script. On a fresh CI checkout it does not exist, so reading from it
  // threw ENOENT straight into the step's `|| true` and the snapshot silently
  // never regenerated (worker/landing-data.js sat 5 days stale). data/rankings.json
  // is the tracked source build-site.sh copies from; prefer it, and fall back to
  // the built copy for anyone running this after a local build.
  const rkPath = [path.join(ROOT, 'data/rankings.json'), path.join(ROOT, 'public/data/rankings.json')]
    .find((p) => fs.existsSync(p));
  if (!rkPath) throw new Error('rankings.json not found in data/ or public/data/');
  const rk = JSON.parse(fs.readFileSync(rkPath, 'utf8')).data;
  let rankings = null, roster = null, featured = null, oddsHistory = null;
  try { rankings = buildRankings(rk, recMap); } catch (e) { console.error('rankings parse failed:', e.message); }
  try { roster = buildRoster(); } catch (e) { console.error('roster parse failed:', e.message); }
  try { featured = buildFeatured(rk, recMap); } catch (e) { console.error('featured parse failed:', e.message); }
  try { oddsHistory = buildOddsHistory(); } catch (e) { console.error('oddsHistory parse failed:', e.message); }

  if (!rankings || !rankings.rows.length || !roster || !featured || !oddsHistory) {
    console.warn('gen-landing-data: incomplete parse (rankings=%s, roster=%s, featured=%s, oddsHistory=%s) — keeping existing landing-data.js',
      rankings ? rankings.rows.length + ' rows' : 'null', roster ? 'ok' : 'null', featured ? featured.name : 'null',
      oddsHistory ? oddsHistory.name : 'null');
    return;   // leave last-good file untouched; exit 0
  }

  // Slugs the dynamic slides need served publicly (for the Worker allow-list).
  const matchup = buildMatchup(recMap);
  const counts = countStats();
  const photos = [...new Set([featured.slug, oddsHistory.slug, matchup && matchup.a.slug, matchup && matchup.b.slug, ...rankings.rows.map(r => r.slug)].filter(Boolean))];

  const out = { generatedAt: new Date().toISOString(), rankings, roster, featured, oddsHistory, matchup, counts, photos };
  fs.writeFileSync(OUT,
    '// AUTO-GENERATED by scripts/gen-landing-data.cjs — do not edit by hand.\n' +
    'export default ' + JSON.stringify(out, null, 2) + ';\n');
  console.log('landing-data.js: rankings %s · featured %s (%s) · oddsHistory %s (%d rows)',
    rankings.division, featured.name, featured.record, oddsHistory.name, oddsHistory.rows.length);
  console.log('landing-data.js: counts %s fighters · %s bouts · %s videos · %s photos',
    counts.fighters.toLocaleString(), counts.bouts.toLocaleString(), counts.videos.toLocaleString(), counts.photos.toLocaleString());
  console.log('landing-data.js: matchup %s', matchup ? (matchup.a.name + ' vs ' + matchup.b.name + ' · ' + matchup.event + (matchup.odds ? ' · odds ' + matchup.odds.a + '/' + matchup.odds.b + ' from ' + matchup.odds.books + ' books' : ' · no odds')) : 'none (hero falls back)');
}

main();
