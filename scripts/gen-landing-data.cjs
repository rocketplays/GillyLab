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

// Feed→DB name aliases (roster lists a fighter under a different name than the DB
// profile). Read from index.html's ACTIVE_ROSTER_ALIASES so the free pages resolve
// the same names the app does ("Jose Miguel Delgado" -> "Jose Delgado").
const STAT_ALIASES = (() => {
  const m = idx.match(/const ACTIVE_ROSTER_ALIASES\s*=\s*\{([\s\S]*?)\n\s*\};/);
  const o = {}; if (!m) return o;
  const re = /"([^"]+)"\s*:\s*"([^"]+)"/g; let x;
  while ((x = re.exec(m[1]))) o[x[1]] = x[2];
  return o;
})();
// Does FIGHTER_STATS have an exact (case-insensitive) entry for this name?
function _statMatch(name) {
  return idx.match(new RegExp('"' + String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '":\\s*\\{([^}]*)\\}', 'i'));
}
// Resolve a feed name to the DB's canonical name: exact match, else alias, else a
// first+last fallback (drops a middle name like "Jose Miguel Delgado" -> "Jose Delgado")
// when THAT resolves. Used for every stat/history/division lookup.
function canonStatName(name) {
  if (!name) return name;
  if (_statMatch(name)) return name;
  if (STAT_ALIASES[name] && _statMatch(STAT_ALIASES[name])) return STAT_ALIASES[name];
  const p = String(name).trim().split(/\s+/);
  if (p.length >= 3) { const fl = p[0] + ' ' + p[p.length - 1]; if (_statMatch(fl)) return fl; }
  return STAT_ALIASES[name] || name;
}
// A single fighter's stat object from the FIGHTER_STATS map in index.html.
// Case-insensitive + alias-resolved so feed spellings ("Dricus Du Plessis",
// "Jose Miguel Delgado") still find the DB entry.
function fighterStat(name) {
  const m = _statMatch(canonStatName(name));
  if (!m) return null;
  const o = {};
  m[1].replace(/(\w+):\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|-?[\d.]+)/g, (_, k, v) => {
    // Strip the surrounding quotes AND unescape inner backslash-escapes, so a source
    // value like ht:"5'10\"" (or single-quoted ht:'5\'11"') yields 5'10" / 5'11".
    o[k] = v[0] === '"' ? v.slice(1, -1).replace(/\\(["\\])/g, '$1')
         : v[0] === "'" ? v.slice(1, -1).replace(/\\(['\\])/g, '$1')
         : v;
  });
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
// ── featured fighter, rendered like the current profile (grouped median bars) ──
const _statNumG = (v) => { if (v == null) return null; const s = String(v).trim(); if (!s || s === '--' || s === '-') return null; const m = s.match(/-?[\d.]+/); return m ? parseFloat(m[0]) : null; };
function _ageFromDob(dob) { if (!dob) return null; const d = new Date(dob); if (isNaN(d.getTime())) return null; const t = new Date(); let a = t.getFullYear() - d.getFullYear(); const mo = t.getMonth() - d.getMonth(); if (mo < 0 || (mo === 0 && t.getDate() < d.getDate())) a--; return (a >= 0 && a < 90) ? a : null; };
// The featured slide's bio is one line per field; a full gym name like "American
// Kickboxing Academy / Eagles MMA" wraps and makes the slide tall on mobile. Map
// the common gyms to short forms; unknown gyms pass through unchanged.
const _GYM_ABBR = {
  'american kickboxing academy': 'AKA', 'eagles mma': 'Eagles', 'american top team': 'ATT',
  'city kickboxing': 'City KB', 'jackson wink mma': 'Jackson-Wink', 'jackson-wink mma': 'Jackson-Wink',
  'team alpha male': 'Team Alpha Male', 'kill cliff fc': 'Kill Cliff', 'fortis mma': 'Fortis',
  'sanford mma': 'Sanford', 'xtreme couture': 'Xtreme Couture', 'the mma lab': 'MMA Lab',
  'alliance mma': 'Alliance', 'nova uniao': 'Nova Uniao', 'american kickboxing academy (aka)': 'AKA',
};
function _shortGym(g) {
  if (!g) return g;
  return String(g).split('/').map(p => { const t = p.trim(); return _GYM_ABBR[t.toLowerCase()] || t; }).join('/');
}
// Division abbreviation aliases — "WFLY" is a pre-existing alternate code for
// Women's Flyweight (WFLW) used on a handful of fighters; the app normalizes it
// via SIM_DIVISION_ALIASES, so mirror that here or those fighters form their own
// tiny (<8) cohort and get no median bars.
const DIV_ALIAS = { WFLY: 'WFLW' };
const _canonDiv = (d) => DIV_ALIAS[d] || d || '';
// A fighter's roster division ABBREVIATION ("WW", "LW", …) and the peers who share
// it — FIGHTERS stores the abbreviation, which is what the profile's medians use too.
function _fighterDivAbbrev(name) {
  // Case-insensitive + alias-resolved so a feed spelling ("Dricus Du Plessis",
  // "Jose Miguel Delgado") still resolves to the DB's canonical entry.
  const cn = canonStatName(name);
  const m = idx.match(new RegExp('\\{ name: "' + cn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '", division: "([^"]*)"', 'i'));
  return m ? _canonDiv(m[1]) : '';
}
function _divToNames(abbrev) {
  if (!abbrev) return [];
  const re = /\{ name: "([^"]+)", division: "([^"]*)"/g; let x; const out = [];
  while ((x = re.exec(idx))) { if (_canonDiv(x[2]) === abbrev) out.push(x[1]); }
  return out;
}
function _activeSet() {
  const m = idx.match(/const ACTIVE_ROSTER\s*=\s*(\[[\s\S]*?\]);/);
  if (!m) return new Set();
  try { return new Set(JSON.parse(m[1])); } catch (e) { return new Set(); }
}
const _MED_CACHE = {};
function _divMedians(abbrev) {
  if (_MED_CACHE[abbrev]) return _MED_CACHE[abbrev];
  const FS = parseConst('FIGHTER_STATS') || {};
  const active = _activeSet();
  const peers = _divToNames(abbrev).filter((n) => FS[n] && (active.size === 0 || active.has(n)));
  const fields = ['slpm', 'strAcc', 'sapm', 'strDef', 'kd', 'tdLanded', 'tdAcc', 'tdDef', 'subAvg', 'finRate'];
  const out = {};
  for (const fld of fields) {
    const vals = [];
    for (const n of peers) { const v = _statNumG(FS[n][fld]); if (v != null && !isNaN(v) && v !== 0) vals.push(v); }
    if (vals.length < 8) { out[fld] = null; continue; }
    vals.sort((a, b) => a - b);
    const half = vals.length / 2;
    const median = vals.length % 2 ? vals[(vals.length - 1) / 2] : (vals[half - 1] + vals[half]) / 2;
    let cap = vals[Math.min(vals.length - 1, Math.floor(0.95 * vals.length))]; if (!(cap > 0)) cap = 1;
    out[fld] = { median, cap };
  }
  _MED_CACHE[abbrev] = out;
  return out;
}
function buildFeatured(rk, recMap) {
  const champ = rk.find(x => x.division === FEATURED_DIVISION && x.isChampion);
  if (!champ) return null;
  const st = fighterStat(champ.fighterName) || {};
  const med = _divMedians(_fighterDivAbbrev(champ.fighterName));
  const clamp = (x) => Math.max(0, Math.min(100, x));
  const round1 = (x) => Math.round(x * 10) / 10;
  // [label, raw, isPercent, medianField, lowerIsBetter] — mirrors populateFighterStats.
  const mkRow = (label, raw, isPct, field, invert) => {
    const ref = field ? med[field] : null;
    let cls = '', w = 0, tickX = null, bar = false;
    if (ref && raw != null && raw !== 0) {
      cls = (invert ? raw < ref.median : raw > ref.median) ? 'good' : 'bad';
      w = round1(clamp(raw / ref.cap * 100));
      tickX = round1(clamp(ref.median / ref.cap * 100));
      bar = true;
    }
    return { label, val: (raw == null || raw === 0) ? '—' : (isPct ? raw + '%' : String(raw)), cls, w, tickX, bar };
  };
  const groups = [
    { t: 'Striking', rows: [
      mkRow('Sig. strikes landed / min', _statNumG(st.slpm), false, 'slpm', false),
      mkRow('Striking accuracy', _statNumG(st.strAcc), true, 'strAcc', false),
      mkRow('Sig. strikes absorbed / min', _statNumG(st.sapm), false, 'sapm', true),
      mkRow('Striking defense', _statNumG(st.strDef), true, 'strDef', false),
      mkRow('Knockdowns / 15 min', _statNumG(st.kd), false, 'kd', false),
    ]},
    { t: 'Grappling', rows: [
      mkRow('Takedowns / 15 min', _statNumG(st.tdLanded), false, 'tdLanded', false),
      mkRow('Takedown accuracy', _statNumG(st.tdAcc), true, 'tdAcc', false),
      mkRow('Takedown defense', _statNumG(st.tdDef), true, 'tdDef', false),
      mkRow('Submissions / 15 min', _statNumG(st.subAvg), false, 'subAvg', false),
    ]},
    { t: 'Miscellaneous', rows: [
      mkRow('Finish rate', _statNumG(st.finRate), true, 'finRate', false),
      mkRow('Win streak', _winStreak(champ.fighterName), false, null, false),
    ]},
  ];
  if (groups.reduce((n, g) => n + g.rows.filter(r => r.val !== '—').length, 0) < 4) return null;
  const bio = [
    ['Age', _ageFromDob(st.dob)], ['Height', st.ht || null], ['Reach', st.reach || null],
    ['Stance', (st.stance && st.stance !== '--') ? st.stance : null], ['Gym', _shortGym(st.gym) || null],
  ].filter(b => b[1] != null && b[1] !== '');
  const ini = initialsOf(champ.fighterName);
  return {
    name: champ.fighterName,
    slug: photoExists(champ.fighterSlug) ? champ.fighterSlug : (photoExists(nameToSlug(champ.fighterName)) ? nameToSlug(champ.fighterName) : ''),
    division: FEATURED_DIVISION,
    record: recMap[champ.fighterName] || '',
    initials: ((ini[0] || '') + (ini[ini.length - 1] || '')).toUpperCase(),
    bio, groups, hasBars: groups.some(g => g.rows.some(r => r.bar)),
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
  // A-Z snippet of the active roster (the full list is public on /roster anyway) —
  // a taste of names plus the total, shown under the weekly changes on the slide.
  const active = [..._activeSet()].filter(Boolean).sort((a, b) => a.localeCompare(b));
  return {
    week: w.week || '',
    added: added.slice(0, 1), addedTotal: added.length,
    removed: removed.slice(0, 1), removedTotal: removed.length,
    names: active.slice(0, 12), total: active.length,
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
// Case-insensitive map lookup — the feed and roster disagree on capitalization for
// some names ("Dricus Du Plessis" vs "Dricus du Plessis").
function ciLookup(map, name) {
  if (map[name] != null) return map[name];
  const low = String(name || '').toLowerCase();
  const k = Object.keys(map).find((key) => key.toLowerCase() === low);
  return k ? map[k] : '';
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
// ── A real three-leg parlay off the next card ─────────────────────────────────
// The slide advertises the parlay builder, so the slip must be a real one. These
// are method-of-victory props, which do NOT come from odds.json — that feed only
// carries h2h and totals. They live in MANUAL_PROP_ODDS inside index.html,
// hand-entered per card, so this reads them from there.
//
// The combined price multiplies DECIMAL odds. Adding or averaging American odds
// is meaningless: +270 and -270 are 3.70 and 1.37.
const toDecimal = (a) => (a > 0 ? 1 + a / 100 : 1 + 100 / -a);
const lastLower = (s) => String(s || '').toLowerCase().trim().split(/\s+/).pop();

// The demo slip, by name. If any of these bouts leaves the card the slip rebuilds
// itself from whatever the current card offers, so the slide can never advertise
// a fight that already happened.
const PARLAY_PICKS = [
  { pick: 'Conor McGregor', method: 'ko', label: 'by KO/TKO' },
  { pick: 'Paddy Pimblett', method: 'sub', label: 'by submission' },
  { pick: 'Cory Sandhagen', method: 'dec', label: 'by decision' },
];
const METHOD_LABEL = { ko: 'by KO/TKO', sub: 'by submission', dec: 'by decision' };

// Consensus moneyline for one bout, averaged across every book that prices it.
function mlConsensus(odds, nameA, nameB) {
  const m = odds.find((o) => o && o.home_team && o.away_team &&
    [lastLower(o.home_team), lastLower(o.away_team)].sort().join('|') === [lastLower(nameA), lastLower(nameB)].sort().join('|'));
  if (!m || !Array.isArray(m.bookmakers)) return null;
  const qa = [], qb = [];
  m.bookmakers.forEach((bk) => {
    const mkt = (bk.markets || []).find((x) => x.key === 'h2h');
    if (!mkt) return;
    const pa = (mkt.outcomes.find((o) => lastLower(o.name) === lastLower(nameA)) || {}).price;
    const pb = (mkt.outcomes.find((o) => lastLower(o.name) === lastLower(nameB)) || {}).price;
    if (pa == null || pb == null) return;
    qa.push(toProb(pa)); qb.push(toProb(pb));
  });
  if (!qa.length) return null;
  const mean = (xs) => xs.reduce((t, v) => t + v, 0) / xs.length;
  const ma = mean(qa), mb = mean(qb);
  return { a: toAmerican(ma), b: toAmerican(mb), favA: ma > mb, books: qa.length };
}

function buildParlay() {
  let odds, feed;
  try {
    odds = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'odds.json'), 'utf8'));
    feed = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'event.json'), 'utf8'));
  } catch (e) { return null; }
  if (!Array.isArray(odds)) return null;
  const ev = ((feed && feed.data) || []).find((e) => e && e.status !== 'completed' && (e.bouts || []).length);
  if (!ev) return null;

  // Key off odds.json, not event.json: the two feeds spell names differently
  // ("Benoit Saint-Denis" vs "Benoît Saint Denis"), and MANUAL_PROP_ODDS is keyed
  // the way the app keys it — from the odds.json name.
  const byKey = new Map();
  for (const e of odds) {
    if (!e || !e.home_team || !e.away_team) continue;
    byKey.set([lastLower(e.home_team), lastLower(e.away_team)].sort().join('|'), [e.home_team, e.away_team]);
  }

  // ── preferred: the hand-entered FanDuel method props, while they still apply ──
  const PROPS = parseConst('MANUAL_PROP_ODDS') || {};
  const findFight = (pick) => {
    const ln = lastLower(pick);
    for (const key of Object.keys(PROPS)) {
      if (key.split('|').indexOf(ln) === -1) continue;
      const names = byKey.get(key);
      if (!names) continue;
      return { key, opponent: lastLower(names[0]) === ln ? names[1] : names[0] };
    }
    return null;
  };
  const propPrice = (pick, method) => {
    const f = findFight(pick);
    if (!f) return null;
    const fd = PROPS[f.key].method && PROPS[f.key].method.fanduel;
    if (!fd) return null;
    const side = lastLower(pick) === f.key.split('|')[0] ? 'f1' : 'f2';
    const p = fd[side] && fd[side][method];
    return typeof p === 'number' ? { odds: p, opponent: f.opponent } : null;
  };

  let legs = [], kind = 'props', book = 'FanDuel';
  for (const want of PARLAY_PICKS) {
    const got = propPrice(want.pick, want.method);
    if (!got) { legs = []; break; }
    legs.push({ pick: want.pick, slug: nameToSlug(want.pick), opponent: got.opponent, label: want.label, odds: got.odds });
  }

  // ── fallback: consensus MONEYLINES off the current card ──────────────────────
  // MANUAL_PROP_ODDS is hand-entered per card, so it goes stale the moment the
  // card does and no prop leg can be found. odds.json refreshes twice daily and
  // covers every upcoming event, so the moneyline is the only market that can
  // carry this slide from one card to the next without a human touching it.
  if (!legs.length) {
    kind = 'moneyline';
    const consensusBooks = [];
    for (const bout of ev.bouts) {
      if (legs.length === 3) break;
      if (bout.isCancelled) continue;
      const f = (bout.fighters || []).map((x) => x.fighterName);
      if (f.length !== 2) continue;
      const c = mlConsensus(odds, f[0], f[1]);
      if (!c) continue;
      const pick = c.favA ? f[0] : f[1];
      const opp = c.favA ? f[1] : f[0];
      consensusBooks.push(c.books);
      legs.push({ pick, slug: nameToSlug(pick), opponent: opp, label: 'to win', odds: c.favA ? c.a : c.b });
    }
    const n = consensusBooks.length ? Math.min.apply(null, consensusBooks) : 0;
    book = 'Consensus · ' + n + ' book' + (n === 1 ? '' : 's');
  }
  if (legs.length < 3) return null;

  const dec = legs.reduce((t, l) => t * toDecimal(l.odds), 1);
  const stake = 100;
  return {
    event: ev.title || 'UFC',
    kind, book,
    legs: legs.map((l) => ({ pick: l.pick, slug: l.slug, opponent: l.opponent, label: l.label, odds: fmtOdds(l.odds) })),
    combined: fmtOdds(toAmerican(1 / dec)),
    stake,
    payout: Math.round(stake * dec),
  };
}

const numOf = (v) => { if (v == null) return null; const m = /-?[\d.]+/.exec(String(v)); return m ? parseFloat(m[0]) : null; };

// ── The app's own matchup analysis, run headlessly ────────────────────────────
// The slide shows style, pace and path to victory. Those are NOT recomputed here:
// renderMatchupBreakdown() in index.html takes a null host, skips the DOM writes
// and returns its analysis, so the slide and the Scouting Report can never
// disagree. Reimplementing the prose in this script is exactly the drift trap
// that put the wrong video on a fighter's page.
//
// It needs FIGHTERS, FIGHTER_STATS, FIGHT_HISTORY, scoutingHistKey, _newsNorm and
// a document that can create throwaway elements. WOMEN and cmpRow are local to it.
// The dep list was found by running it and following the ReferenceErrors, not by
// reading — if it grows, the sandbox says so loudly instead of silently returning
// null, which is why the failure below warns rather than swallowing.
function extractDecl(name) {
  const lines = idx.split('\n');
  const i = lines.findIndex((l) => new RegExp('^\\s*(const|let|var|function)\\s+' + name + '\\b').test(l));
  if (i < 0) return '';
  let depth = 0, seen = false, end = i;
  for (let k = i; k < lines.length; k++) {
    for (const c of lines[k]) {
      if (c === '{' || c === '[') { depth++; seen = true; }
      else if (c === '}' || c === ']') depth--;
    }
    if (seen && depth === 0) { end = k; break; }
  }
  return lines.slice(i, end + 1).join('\n');
}

let _breakdown = null;
function breakdownFor(nameA, nameB) {
  if (!_breakdown) {
    const stubEl = () => ({
      style: {}, className: '', textContent: '', innerHTML: '',
      classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
      appendChild() {}, setAttribute() {}, querySelector: () => null,
    });
    const doc = { createElement: stubEl, createTextNode: () => ({}) };
    const src = [
      extractDecl('FIGHTERS'),
      extractDecl('FIGHTER_STATS'),
      extractDecl('FIGHT_HISTORY'),
      extractDecl('scoutingHistKey'),
      extractDecl('_newsNorm'),
      extractDecl('renderMatchupBreakdown'),
      'return renderMatchupBreakdown;',
    ].join('\n');
    try { _breakdown = new Function('document', src)(doc); }
    catch (e) { console.warn('landing-data.js: breakdown sandbox failed — ' + e.message); _breakdown = () => null; }
  }
  try { return _breakdown(null, nameA, nameB, {}) || null; }
  catch (e) { console.warn('landing-data.js: breakdown(' + nameA + ' vs ' + nameB + ') threw — ' + e.message); return null; }
}

// The style / pace / path-to-victory slide. Prefers a named bout, but only while
// both men are actually booked on the upcoming card. Once they fight, the slide
// rolls to that card's main event on its own — no hand-editing, and it can never
// advertise a matchup that already happened.
const STYLE_DEMO = ['Cory Sandhagen', 'Mario Bautista'];
function styleDemoPair() {
  let feed;
  try { feed = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'event.json'), 'utf8')); } catch (e) { return STYLE_DEMO; }
  const ev = ((feed && feed.data) || []).find((e) => e && e.status !== 'completed' && (e.bouts || []).length);
  if (!ev) return STYLE_DEMO;
  const booked = new Set();
  for (const bout of ev.bouts) {
    if (bout.isCancelled) continue;
    (bout.fighters || []).forEach((f) => booked.add(f.fighterName));
  }
  if (STYLE_DEMO.every((n) => booked.has(n))) return STYLE_DEMO;
  const main = ev.bouts.find((x) => x && x.cardPosition === 1 && !x.isCancelled) || ev.bouts.find((x) => x && !x.isCancelled);
  const f = (main && main.fighters) || [];
  return f.length === 2 ? [f[0].fighterName, f[1].fighterName] : STYLE_DEMO;
}
function buildStyleDemo(recMap) {
  const pair = styleDemoPair();
  const ins = breakdownFor(pair[0], pair[1]);
  if (!ins || ins.leanA == null || ins.leanB == null || !ins.pathA || !ins.pathB) return null;

  const ranks = rankMap();
  const one = (name, lean, pace, path) => {
    const slug = nameToSlug(name);
    return {
      name, slug: photoExists(slug) ? slug : '', initials: initials2(name),
      record: ciLookup(recMap, name), rank: ciLookup(ranks, name),
      lean, pace, path,
    };
  };
  const a = one(pair[0], ins.leanA, ins.paceA, ins.pathA);
  const b = one(pair[1], ins.leanB, ins.paceB, ins.pathB);
  return { a, b };
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
      record: ciLookup(recMap, name),
      rank: ciLookup(ranks, name),
      lean: styleLean(st),
      slpm: st && numOf(st.slpm),
      sapm: st && numOf(st.sapm),
      _st: st,
    };
  };
  const a = side(bout.fighters[0]), b = side(bout.fighters[1]);
  if (a.lean == null || b.lean == null) return null;   // no stats, no demo
  delete a._st; delete b._st;

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

// The full upcoming card (every bout: records, ranks, odds) + the main event's
// deep breakdown (tale of the tape, style/pace/path, h2h stats) — for the free
// /matchup page, which mirrors the events page.
// Physical "tale of the tape" for one fighter (age/height/reach/stance) — the ONLY
// breakdown shown free on non-main bouts (the rest is paywalled). Same shape the
// main-event tape uses, so the /matchup renderer can share one component.
function _physOf(name) {
  const st = fighterStat(name) || {};
  const lo = _layoff(name);
  return { ht: st.ht || "", reach: st.reach || "", age: _ageFromDob(st.dob), stance: (st.stance && st.stance !== "--") ? st.stance : "", gym: st.gym || "", layoff: lo, l5: _lastFive(name) };
}
function buildMainTape(m) {
  const ins = breakdownFor(m.f1, m.f2) || {};
  return {
    a: _physOf(m.f1), b: _physOf(m.f2),
    stats: { a: ins.statsA || {}, b: ins.statsB || {}, sig: ins.sig || {} },
    lean: { a: ins.leanA, b: ins.leanB }, pace: { a: ins.paceA, b: ins.paceB },
    path: { a: ins.pathA, b: ins.pathB }, story: { a: ins.storyA || [], b: ins.storyB || [] },
    finishDur: _finishDur(m.f1, m.f2), common: _commonOpps(m.f1, m.f2),
  };
}
// A single fighter's stat card — the profile's grouped median bars, WITHOUT the
// paywalled depth (no fight history, odds history, tape, accolades, record
// breakdown). Powers the tap-a-fighter popup on the free /matchup page.
// Win streak, computed from FIGHT_HISTORY exactly like the in-app profile: count
// leading wins over real (non-upcoming) bouts in the history's most-recent-first order.
let _FH_CACHE = null;
function _winStreak(name) {
  if (!_FH_CACHE) _FH_CACHE = parseConst('FIGHT_HISTORY') || {};
  const fh = (_FH_CACHE[canonStatName(name)] || []).filter((f) => f && f.date && f.result && f.result !== '–' && f.method !== 'Upcoming');
  let streak = 0;
  for (const f of fh) { if (f.result === 'W') streak++; else break; }
  return streak;
}
// Resolve a feed/stats name to its FIGHT_HISTORY key — mirrors index.html's
// scoutingHistKey (exact, then case/accent-insensitive, then an unambiguous
// token-subset match), because the history map sometimes spells a name
// differently than FIGHTER_STATS (e.g. "Dricus du Plessis" vs "Dricus Du Plessis").
function _histKey(name) {
  if (!_FH_CACHE) _FH_CACHE = parseConst('FIGHT_HISTORY') || {};
  if (_FH_CACHE[name]) return name;
  const t = _newsNormG(name), keys = Object.keys(_FH_CACHE);
  for (const k of keys) if (_newsNormG(k) === t) return k;
  const tt = t.split(' ').filter(Boolean); if (!tt.length) return null;
  let hit = null, h = 0;
  for (const k of keys) { const kt = _newsNormG(k).split(' ').filter(Boolean); if (tt.every((x) => kt.includes(x)) || kt.every((x) => tt.includes(x))) { hit = k; if (++h > 1) break; } }
  return h === 1 ? hit : null;
}
// Real (non-upcoming) bouts from FIGHT_HISTORY, most-recent-first.
function _fhReal(name) {
  if (!_FH_CACHE) _FH_CACHE = parseConst('FIGHT_HISTORY') || {};
  const k = _histKey(name);
  return (k && _FH_CACHE[k] || []).filter((f) => f && f.date && f.result && f.result !== '–' && f.method !== 'Upcoming');
}
// ── Scouting ports: layoff, last-5 form, finish/durability, common opponents ──
// Faithful Node reimplementations of index.html's renderScouting so the free
// /matchup page shows the same numbers as the in-app Fight Info dropdown.
function _parseD(s) { const t = Date.parse(s); return isFinite(t) ? t : null; }
function _methodCat(m) {
  m = String(m || '');
  if (/sub/i.test(m)) return 'sub';
  if (/disqualif|\bdq\b/i.test(m)) return 'dq';
  if (/dec/i.test(m)) return 'dec';
  if (/ko|tko|knockout|stoppage|doctor|retire/i.test(m)) return 'ko';
  return 'other';
}
// Layoff: whole months from the most recent real bout to now. Same formatting
// as the app ("8 mo" / "1y 2m"); flags long (>=12mo) layoffs.
function _layoff(name) {
  const d = _fhReal(name).map((f) => _parseD(f.date)).filter(Boolean).sort((a, b) => b - a);
  if (!d.length) return null;
  const mo = Math.max(0, Math.round((Date.now() - d[0]) / 2.628e9));
  const txt = mo >= 12 ? (Math.floor(mo / 12) + 'y ' + (mo % 12) + 'm') : (mo + ' mo');
  return { txt, mo, long: mo >= 12 };
}
// Last 5 results, most-recent-first, as form tiles {r, opp, method, round, time}.
const _RESULT_COLORS = { W: '#00e668', L: '#ff3d00', D: '#ffb340', NC: 'rgba(255,255,255,0.45)', DQ: '#ff3d00' };
function _lastFive(name) {
  return _fhReal(name).slice(0, 5).map((f) => ({
    r: f.result, opp: f.opponent || '', method: f.method || '',
    round: f.round != null ? String(f.round) : '', time: f.time || '',
  }));
}
// Finish & durability profile — mirrors finishProfile() in renderScouting.
function _finishProfile(name) {
  let wins = 0, losses = 0, wKO = 0, wSub = 0, wDec = 0, lKO = 0, lSub = 0, lDQ = 0;
  _fhReal(name).forEach((f) => {
    const c = _methodCat(f.method);
    if (f.result === 'W') { wins++; if (c === 'ko') wKO++; else if (c === 'sub') wSub++; else if (c === 'dec') wDec++; }
    else if (f.result === 'L') { losses++; if (c === 'ko') lKO++; else if (c === 'sub') lSub++; else if (c === 'dq') lDQ++; }
  });
  const finWins = wKO + wSub;
  return { wins, losses, wKO, wSub, wDec, finWins, finRate: wins ? finWins / wins : null, timesFinished: lKO + lSub + lDQ, lKO, lSub, lDQ };
}
// The full Finish & durability block for a bout: the three rows + the derived
// durability highlight (lower finish-rate-against greens, higher reds).
function _abbrMethod(m) {
  const c = _methodCat(m); if (c === 'ko') return 'KO/TKO'; if (c === 'sub') return 'SUB'; if (c === 'dec') return 'DEC'; if (c === 'dq') return 'DQ';
  return String(m || '').split(' ')[0] || '';
}
function _finishDur(nameA, nameB) {
  const fp = _finishProfile(nameA), op = _finishProfile(nameB);
  if (!fp.wins && !fp.losses && !op.wins && !op.losses) return null;
  const rate = (p) => p.finRate == null ? '—' : (Math.round(p.finRate * 100) + '% (' + p.finWins + '/' + p.wins + ')');
  const methods = (p) => { const parts = []; if (p.wKO) parts.push(p.wKO + ' KO'); if (p.wSub) parts.push(p.wSub + ' SUB'); if (p.wDec) parts.push(p.wDec + ' DEC'); return parts.join(' · ') || '—'; };
  const fin = (p) => {
    if (!(p.wins || p.losses)) return '—';
    if (!p.timesFinished) return 'Never';
    const parts = []; if (p.lKO) parts.push(p.lKO + ' KO/TKO'); if (p.lSub) parts.push(p.lSub + ' SUB'); if (p.lDQ) parts.push(p.lDQ + ' DQ');
    return p.timesFinished + '× (' + parts.join(', ') + ')';
  };
  const durRate = (p) => (p.wins + p.losses) > 0 ? p.timesFinished / (p.wins + p.losses) : null;
  const drA = durRate(fp), drB = durRate(op);
  let tfA = '', tfB = '';
  if (drA != null && drB != null && drA !== drB) { tfA = drA < drB ? 'w' : 'l'; tfB = drA < drB ? 'l' : 'w'; }
  return { finRate: { a: rate(fp), b: rate(op) }, methods: { a: methods(fp), b: methods(op) }, timesFinished: { a: fin(fp), b: fin(op), aCls: tfA, bCls: tfB } };
}
// Common opponents both fighters have faced — mirrors the app's block.
function _commonOpps(nameA, nameB) {
  const histA = _fhReal(nameA), histB = _fhReal(nameB);
  if (!histA.length || !histB.length) return [];
  const nn = _newsNormG(nameA), on = _newsNormG(nameB);
  const resultsVs = (h, target) => { const t = _newsNormG(target); return h.filter((f) => _newsNormG(f.opponent) === t).sort((a, b) => (_parseD(b.date) || 0) - (_parseD(a.date) || 0)); };
  const mineOpps = {}; histA.forEach((f) => { if (f.opponent) mineOpps[_newsNormG(f.opponent)] = f.opponent; });
  const shared = [], seen = {};
  histB.forEach((f) => { if (!f.opponent) return; const k = _newsNormG(f.opponent); if (k === nn || k === on || seen[k]) return; if (mineOpps[k]) { seen[k] = 1; shared.push(mineOpps[k]); } });
  const fmt = (rows) => {
    if (!rows.length) return '—';
    if (rows.length === 1) { const r = rows[0]; return r.result + (r.method ? ' (' + _abbrMethod(r.method) + (r.round ? ' R' + r.round : '') + ')' : ''); }
    let w = 0, l = 0, d = 0; rows.forEach((r) => { if (r.result === 'W') w++; else if (r.result === 'L') l++; else d++; });
    return w + '-' + l + (d ? '-' + d : '') + ' (' + rows.length + ' fights)';
  };
  const resCls = (rows) => { let w = 0, l = 0; rows.forEach((r) => { if (r.result === 'W') w++; else if (r.result === 'L') l++; }); return w > l ? 'w' : (l > w ? 'l' : ''); };
  return shared.slice(0, 6).map((opp) => {
    const a = resultsVs(histA, opp), b = resultsVs(histB, opp);
    return { opp, a: fmt(a), b: fmt(b), aCls: resCls(a), bCls: resCls(b) };
  });
}
// Normalizer matching index.html's _newsNorm (lowercase, strip accents/punct).
function _newsNormG(s) { return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }
// W-L-D derived from FIGHT_HISTORY (like the in-app computeRecord), or null if none.
function _computeRecord(name) {
  const fh = _fhReal(name); if (!fh.length) return null;
  let w = 0, l = 0, d = 0;
  for (const f of fh) { if (f.result === 'W') w++; else if (f.result === 'L') l++; else if (f.result === 'D') d++; }
  return { w, l, d, total: w + l + d, str: `${w}-${l}-${d}` };
}
// Finish rate (KO/TKO + submission wins ÷ total wins), or null if no wins in history.
function _deriveFinRate(name) {
  const wins = _fhReal(name).filter((f) => f.result === 'W');
  if (!wins.length) return null;
  const fin = wins.filter((f) => /^(?:KO|TKO|Submission|Technical Submission)\b/i.test(f.method || '')).length;
  return Math.round(fin / wins.length * 100);
}
// The curated FIGHTERS record is authoritative (FIGHT_HISTORY sometimes carries
// stray/miscounted bouts — e.g. a fighter who is really 17-0 showing an extra loss).
// So only override it when the derived record is EXACTLY "static record + the single
// newest bout" — i.e. the static record is precisely one fight stale (a bout we just
// appended). That fixes just-fought fighters and never trusts a discrepant history.
function _recordAndFinRate(name, staticRec, staticFin) {
  const sm = String(staticRec || '').match(/(\d+)-(\d+)-(\d+)/);
  const dr = _computeRecord(name);
  const fh = _fhReal(name);
  if (sm && dr && fh.length) {
    let ew = dr.w, el = dr.l, ed = dr.d;
    const rec = fh[0].result;
    if (rec === 'W') ew--; else if (rec === 'L') el--; else if (rec === 'D') ed--;
    if (ew === +sm[1] && el === +sm[2] && ed === +sm[3]) {   // static == derived minus newest bout
      const df = _deriveFinRate(name);
      return { record: dr.str, finRate: df != null ? df : staticFin };
    }
  }
  return { record: staticRec || '', finRate: staticFin };
}
function fighterProfileCard(name, recMap, ranks) {
  const st = fighterStat(name) || {};
  const rf = _recordAndFinRate(name, ciLookup(recMap, name), _statNumG(st.finRate));
  const med = _divMedians(_fighterDivAbbrev(name));
  const clamp = (x) => Math.max(0, Math.min(100, x));
  const round1 = (x) => Math.round(x * 10) / 10;
  const mkRow = (label, raw, isPct, field, invert) => {
    const ref = field ? med[field] : null;
    let cls = "", w = 0, tickX = null, bar = false;
    if (ref && raw != null && raw !== 0) {
      cls = (invert ? raw < ref.median : raw > ref.median) ? "good" : "bad";
      w = round1(clamp(raw / ref.cap * 100)); tickX = round1(clamp(ref.median / ref.cap * 100)); bar = true;
    }
    return { label, val: (raw == null || raw === 0) ? "—" : (isPct ? raw + "%" : String(raw)), cls, w, tickX, bar };
  };
  const groups = [
    { t: "Striking", rows: [
      mkRow("Sig. strikes landed / min", _statNumG(st.slpm), false, "slpm", false),
      mkRow("Striking accuracy", _statNumG(st.strAcc), true, "strAcc", false),
      mkRow("Sig. strikes absorbed / min", _statNumG(st.sapm), false, "sapm", true),
      mkRow("Striking defense", _statNumG(st.strDef), true, "strDef", false),
      mkRow("Knockdowns / 15 min", _statNumG(st.kd), false, "kd", false),
    ]},
    { t: "Grappling", rows: [
      mkRow("Takedowns / 15 min", _statNumG(st.tdLanded), false, "tdLanded", false),
      mkRow("Takedown accuracy", _statNumG(st.tdAcc), true, "tdAcc", false),
      mkRow("Takedown defense", _statNumG(st.tdDef), true, "tdDef", false),
      mkRow("Submissions / 15 min", _statNumG(st.subAvg), false, "subAvg", false),
    ]},
    { t: "Miscellaneous", rows: [
      mkRow("Finish rate", rf.finRate, true, "finRate", false),
      mkRow("Win streak", _winStreak(name), false, null, false),
    ]},
  ];
  const slug = nameToSlug(name);
  return {
    name, slug: photoExists(slug) ? slug : "", record: rf.record,
    rank: ciLookup(ranks, name) || "", groups,
    bars: groups.some((g) => g.rows.some((r) => r.bar)),
  };
}
function buildCard(recMap) {
  let feed; try { feed = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "event.json"), "utf8")); } catch (e) { return null; }
  const ev = ((feed && feed.data) || []).find((e) => e && e.status !== "completed" && Array.isArray(e.bouts) && e.bouts.length);
  if (!ev) return null;
  const ranks = rankMap();
  const bouts = ev.bouts.filter((b) => b && !b.isCancelled && (b.fighters || []).length === 2).sort((a, b) => (a.boutOrder || 0) - (b.boutOrder || 0));
  const fights = bouts.map((b, i) => {
    const f1 = b.fighters[0].fighterName, f2 = b.fighters[1].fighterName;
    const s1 = nameToSlug(f1), s2 = nameToSlug(f2), od = consensusOdds(f1, f2);
    return {
      f1, f2, s1: photoExists(s1) ? s1 : "", s2: photoExists(s2) ? s2 : "",
      rec1: ciLookup(recMap, f1) || "", rec2: ciLookup(recMap, f2) || "",
      rank1: ciLookup(ranks, f1) || "", rank2: ciLookup(ranks, f2) || "",
      weight: (b.weightClass || "").replace(/\s*Bout$/i, ""), rounds: b.numberOfRounds || 3,
      o1: od ? od.a : null, o2: od ? od.b : null, books: od ? od.books : 0,
      title: !!b.titleBout, section: b.cardSection || "", pos: b.cardPosition || "", main: i === 0,
      tape: { a: _physOf(f1), b: _physOf(f2) },
    };
  });
  const main = fights[0] ? buildMainTape(fights[0]) : null;
  if (main) { main.pA = fighterProfileCard(fights[0].f1, recMap, ranks); main.pB = fighterProfileCard(fights[0].f2, recMap, ranks); }
  return { event: ev.title || "UFC", slug: ev.slug, date: (ev.startsAt || "").slice(0, 10), prelimsAt: ev.prelimsStartsAt || ev.startsAt || null, location: ev.locationText || [ev.venue, ev.city].filter(Boolean).join(", ") || "", city: (ev.city || "").split(",")[0].trim(), fights, main };
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

// Division abbreviation -> display name (FIGHTERS stores the abbrev).
const _DIV_NAMES = { HW: "Heavyweight", LHW: "Light Heavyweight", MW: "Middleweight", WW: "Welterweight", LW: "Lightweight", FW: "Featherweight", BW: "Bantamweight", FLW: "Flyweight", WSW: "Women's Strawweight", WFLW: "Women's Flyweight", WBW: "Women's Bantamweight", WFW: "Women's Featherweight", CW: "Catchweight" };
// Public "lite" fighter profiles (SEO): one bounded profile per fighter WITH real
// data — record, division, country, physicals, and the grouped median bars (same
// bounded set as the tap-a-fighter popup). The deep stuff stays paywalled. Fighters
// with neither stats nor fight history are skipped to avoid thin, low-quality pages.
function buildFighterLite(recMap, ranks) {
  const FH = parseConst("FIGHT_HISTORY") || {};
  const fighters = [];
  const re = /\{ name: "([^"]+)", division: "([^"]*)", rank: "[^"]*", record: "([^"]*)"([^}]*)\}/g;
  let m; while ((m = re.exec(idx))) { const cm = m[4].match(/country: "([^"]*)"/); fighters.push({ name: m[1], div: m[2], record: m[3], country: cm ? cm[1] : "" }); }
  const bySlug = {};
  for (const f of fighters) {
    const name = f.name;
    const hasStats = !!fighterStat(name);
    const hasHist = Array.isArray(FH[name]) && FH[name].length > 0;
    if (!hasStats && !hasHist) continue;   // skip empty shells (thin-content risk)
    const slug = nameToSlug(name);
    if (bySlug[slug]) continue;             // first fighter wins a slug collision
    const card = fighterProfileCard(name, recMap, ranks);   // {slug, record, rank, groups, bars}
    bySlug[slug] = {
      name, slug,
      record: card.record || f.record || "",
      rank: card.rank || "",
      division: _DIV_NAMES[_canonDiv(f.div)] || _canonDiv(f.div) || "",
      country: f.country || "",
      photo: card.slug || (photoExists(slug) ? slug : ""),
      phys: _physOf(name),
      groups: card.groups, bars: card.bars,
    };
  }
  return bySlug;
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
  const parlay = buildParlay();
  const styleDemo = buildStyleDemo(recMap);
  const counts = countStats();
  const photos = [...new Set([featured.slug, oddsHistory.slug, matchup && matchup.a.slug, matchup && matchup.b.slug,
    ...((parlay && parlay.legs) || []).map((l) => l.slug),
    styleDemo && styleDemo.a.slug, styleDemo && styleDemo.b.slug, ...rankings.rows.map(r => r.slug)].filter(Boolean))];

  const card = buildCard(recMap);
  const out = { generatedAt: new Date().toISOString(), rankings, roster, featured, oddsHistory, matchup, parlay, styleDemo, counts, photos, card };
  fs.writeFileSync(OUT,
    '// AUTO-GENERATED by scripts/gen-landing-data.cjs — do not edit by hand.\n' +
    'export default ' + JSON.stringify(out, null, 2) + ';\n');

  // Public "lite" fighter profiles for SEO (served at /fighter/<slug>). Best-effort:
  // a parse hiccup here must never block the landing-data write above.
  try {
    const ranks = rankMap();
    const bySlug = buildFighterLite(recMap, ranks);
    fs.writeFileSync(path.join(ROOT, "data", "fighter-lite.json"),
      JSON.stringify({ generatedAt: new Date().toISOString(), bySlug }) + "\n");
    console.log("fighter-lite.json: %d public profiles", Object.keys(bySlug).length);
  } catch (e) { console.error("fighter-lite build failed:", e.message); }
  console.log('landing-data.js: rankings %s · featured %s (%s) · oddsHistory %s (%d rows)',
    rankings.division, featured.name, featured.record, oddsHistory.name, oddsHistory.rows.length);
  console.log('landing-data.js: counts %s fighters · %s bouts · %s videos · %s photos',
    counts.fighters.toLocaleString(), counts.bouts.toLocaleString(), counts.videos.toLocaleString(), counts.photos.toLocaleString());
  console.log('landing-data.js: parlay [%s] %s', parlay ? parlay.kind : '-', parlay
    ? (parlay.legs.map((l) => l.pick + ' ' + l.odds).join(' + ') + ' = ' + parlay.combined + ' ($' + parlay.stake + ' -> $' + parlay.payout + ')')
    : 'none');
  console.log('landing-data.js: styleDemo %s', styleDemo
    ? (styleDemo.a.name + ' (lean ' + styleDemo.a.lean + ', pace ' + styleDemo.a.pace + ') vs ' +
       styleDemo.b.name + ' (lean ' + styleDemo.b.lean + ', pace ' + styleDemo.b.pace + ')')
    : 'none');
  console.log('landing-data.js: matchup %s', matchup ? (matchup.a.name + ' vs ' + matchup.b.name + ' · ' + matchup.event + (matchup.odds ? ' · odds ' + matchup.odds.a + '/' + matchup.odds.b + ' from ' + matchup.odds.books + ' books' : ' · no odds')) : 'none (hero falls back)');
}

main();
