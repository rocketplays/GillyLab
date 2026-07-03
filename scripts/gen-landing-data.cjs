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
    slug: champ.fighterSlug || '',
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

function main() {
  const recMap = recordMap();
  const rk = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/rankings.json'), 'utf8')).data;
  let rankings = null, roster = null, featured = null;
  try { rankings = buildRankings(rk, recMap); } catch (e) { console.error('rankings parse failed:', e.message); }
  try { roster = buildRoster(); } catch (e) { console.error('roster parse failed:', e.message); }
  try { featured = buildFeatured(rk, recMap); } catch (e) { console.error('featured parse failed:', e.message); }

  if (!rankings || !rankings.rows.length || !roster || !featured) {
    console.warn('gen-landing-data: incomplete parse (rankings=%s rows, roster=%s, featured=%s) — keeping existing landing-data.js',
      rankings ? rankings.rows.length : 0, roster ? 'ok' : 'null', featured ? featured.name : 'null');
    return;   // leave last-good file untouched; exit 0
  }

  const out = { generatedAt: new Date().toISOString(), rankings, roster, featured };
  fs.writeFileSync(OUT,
    '// AUTO-GENERATED by scripts/gen-landing-data.cjs — do not edit by hand.\n' +
    'export default ' + JSON.stringify(out, null, 2) + ';\n');
  console.log('landing-data.js: rankings %s (%d rows) · roster "%s" (+%d/-%d) · featured %s (%s champ, %s)',
    rankings.division, rankings.rows.length, roster.week, roster.added.length, roster.removed.length,
    featured.name, featured.division, featured.record);
}

main();
