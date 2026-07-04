#!/usr/bin/env node
/* Regenerates worker/landing-data.json — the small slice of REAL data shown on
 * the public (logged-out) marketing landing page that actually changes over
 * time: the featured division's Top-5 rankings and the latest weekly roster
 * changes. worker/pages.js imports this file and renders those two carousel
 * slides from it, so the landing stays current without hand-edits.
 *
 * Sources (the same ones the app uses):
 *   - public/data/rankings.json  → official UFC media-panel division rankings
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
  const row = (x, n) => ({ n, name: x.fighterName, record: recMap[x.fighterName] || '', champ: !!x.isChampion });
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
    ['Strikes Landed / Min', st.slpm], ['Striking Accuracy', st.strAcc], ['Knockdowns / 15', st.kd],
    ['Striking Defense', st.strDef], ['Takedown Defense', st.tdDef], ['Finish Rate', st.finRate],
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
const photoExists = (slug) => !!slug && fs.existsSync(path.join(ROOT, 'public/photos/thumb', slug + '.png'));
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

// Real UPCOMING UFC bouts (next card) with consensus moneylines from the odds feed.
function buildLiveOdds(rk) {
  const oddsDoc = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/odds.json'), 'utf8'));
  const odds = Array.isArray(oddsDoc) ? oddsDoc : (oddsDoc.data || []);
  const box = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/fight-stats.json'), 'utf8'));
  const known = new Set(Object.keys(box).map(n => n.toLowerCase()));
  const isK = (n) => { const l = lastName(n), fi = (String(n)[0] || '').toLowerCase(); for (const k of known) { if (k.split(' ').pop() === l && k[0] === fi) return true; } return false; };
  const now = Date.now();
  const up = odds.filter(x => x.home_team && x.away_team && Date.parse(x.commence_time) > now && isK(x.home_team) && isK(x.away_team));
  if (!up.length) return null;
  up.sort((a, b) => Date.parse(a.commence_time) - Date.parse(b.commence_time));
  const t0 = Date.parse(up[0].commence_time);
  const card = up.filter(x => Date.parse(x.commence_time) - t0 < 48 * 3600 * 1000);   // next event
  // Surface the marquee bouts first: champions and pound-for-pound / top-ranked
  // fighters score highest, so the headliner leads the slide.
  const prom = {};
  rk.forEach(x => { const n = lastName(x.fighterName); const s = x.isChampion ? 100 : (/Pound/.test(x.division) ? (60 - (x.rank || 15)) : (30 - (x.rank || 15))); if (!(n in prom) || s > prom[n]) prom[n] = s; });
  const score = (b) => (prom[lastName(b.away_team)] || 0) + (prom[lastName(b.home_team)] || 0);
  card.sort((a, b) => score(b) - score(a));
  const consensus = (line, who) => {
    const ps = [];
    (line.bookmakers || []).forEach(bk => { const h = (bk.markets || []).find(m => m.key === 'h2h'); if (h) { const o = (h.outcomes || []).find(o => lastName(o.name) === lastName(who)); if (o && typeof o.price === 'number') ps.push(o.price); } });
    return ps.length ? round5(toAmerican(ps.map(toProb).reduce((s, p) => s + p, 0) / ps.length)) : null;
  };
  const bouts = [];
  for (const b of card) {
    const oa = consensus(b, b.away_team), oh = consensus(b, b.home_team);
    if (oa == null || oh == null) continue;
    const sA = nameToSlug(b.away_team), sB = nameToSlug(b.home_team);
    bouts.push({ sA: photoExists(sA) ? sA : '', iA: initials2(b.away_team), fA: b.away_team, oA: fmtOdds(oa),
                 sB: photoExists(sB) ? sB : '', iB: initials2(b.home_team), fB: b.home_team, oB: fmtOdds(oh) });
    if (bouts.length >= 5) break;
  }
  if (!bouts.length) return null;
  let title = 'Upcoming UFC — closing moneylines';
  try {
    const evs = (JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/event.json'), 'utf8')).data) || [];
    let best = null, bd = Infinity;
    for (const e of evs) { if (!e.startsAt) continue; const d = Math.abs(Date.parse(e.startsAt) - t0); if (d < bd) { bd = d; best = e; } }
    if (best && bd < 4 * 24 * 3600 * 1000 && best.title) {
      const dt = new Date(t0).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
      title = best.title.replace(/^[^A-Za-z0-9]*/, '') + ' · ' + dt + ' — moneylines';
    }
  } catch {}
  return { title, bouts };
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
  const rk = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/rankings.json'), 'utf8')).data;
  let rankings = null, roster = null, featured = null, liveOdds = null, oddsHistory = null;
  try { rankings = buildRankings(rk, recMap); } catch (e) { console.error('rankings parse failed:', e.message); }
  try { roster = buildRoster(); } catch (e) { console.error('roster parse failed:', e.message); }
  try { featured = buildFeatured(rk, recMap); } catch (e) { console.error('featured parse failed:', e.message); }
  try { liveOdds = buildLiveOdds(rk); } catch (e) { console.error('liveOdds parse failed:', e.message); }
  try { oddsHistory = buildOddsHistory(); } catch (e) { console.error('oddsHistory parse failed:', e.message); }

  if (!rankings || !rankings.rows.length || !roster || !featured || !liveOdds || !oddsHistory) {
    console.warn('gen-landing-data: incomplete parse (rankings=%s, roster=%s, featured=%s, liveOdds=%s, oddsHistory=%s) — keeping existing landing-data.js',
      rankings ? rankings.rows.length + ' rows' : 'null', roster ? 'ok' : 'null', featured ? featured.name : 'null',
      liveOdds ? liveOdds.bouts.length + ' bouts' : 'null', oddsHistory ? oddsHistory.name : 'null');
    return;   // leave last-good file untouched; exit 0
  }

  // Slugs the dynamic slides need served publicly (for the Worker allow-list).
  const photos = [...new Set([featured.slug, oddsHistory.slug, ...liveOdds.bouts.flatMap(b => [b.sA, b.sB])].filter(Boolean))];

  const out = { generatedAt: new Date().toISOString(), rankings, roster, featured, liveOdds, oddsHistory, photos };
  fs.writeFileSync(OUT,
    '// AUTO-GENERATED by scripts/gen-landing-data.cjs — do not edit by hand.\n' +
    'export default ' + JSON.stringify(out, null, 2) + ';\n');
  console.log('landing-data.js: rankings %s · featured %s (%s) · liveOdds "%s" (%d bouts) · oddsHistory %s (%d rows)',
    rankings.division, featured.name, featured.record, liveOdds.title, liveOdds.bouts.length, oddsHistory.name, oddsHistory.rows.length);
}

main();
