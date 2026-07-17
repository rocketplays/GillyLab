#!/usr/bin/env node
/* Lift the strike GRID out of fight-stats.json, and derive everything the browser
 * needs from it.
 *
 * WHY THIS EXISTS RATHER THAN JUST WIDENING THE SCHEMA.
 * data/fight-stats.json is EAGER-FETCHED BY EVERY VISITOR — index.html does a
 * plain fetch() of it on load, and it is already ~8MB (its own comment says 9.8).
 * The 3x3 cross-tab adds ~900KB. Paying that on every page view, so that a
 * click-through panel can be richer, is the wrong trade: the deep dive is a
 * button, and a button's data should load when it's pressed.
 *
 * THREE FILES OUT, AND THE SPLIT BETWEEN THEM IS THE WHOLE DESIGN:
 *
 *   data/fight-grid-all.json   MASTER. Every fighter ever swept (~643 after the
 *                              active-roster sweep, ~1.5MB). Tracked in git so CI
 *                              can persist it, but excluded from public/ by name in
 *                              build-site.sh — nothing fetches it. It exists so the
 *                              baselines can be measured over a real population and
 *                              re-measured later without re-scraping ESPN.
 *   data/fight-grid.json       SHIPPED, LAZY. Only fighters on an upcoming card
 *                              (~245KB). This is what the panel fetches on click.
 *   data/grid-names.json       SHIPPED, EAGER. ~9KB: the manifest that gates the
 *                              button, plus the baselines.
 *
 * WHY THE SHIPPED GRID STAYS CARD-SCOPED. Before the sweep, "every fighter with a
 * grid" and "every fighter on a card" were the same 109 people, so one file did
 * both jobs by accident. The sweep breaks that: 643 fighters is ~1.5MB, and the
 * panel would download all of it on every click to show two men — ~84% waste —
 * while CI rewrote 1.5MB into a .git that is already 805MB. The medians are what
 * the sweep is FOR, and medians are 9KB. So the population goes in the master, the
 * conclusions go in the manifest, and the wire stays thin.
 *
 * The margins stay in fight-stats.json even though they are derivable from the
 * grid. That is deliberate: index.html reads .head[] / .clinch[] / .ground[]
 * today, deriving them would mean shipping the grid to everyone, and that is the
 * exact cost this script exists to avoid.
 *
 * Usage: node scripts/split-fight-grid.cjs [--dry]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'data', 'fight-stats.json');
// NO UNDERSCORE PREFIX, DELIBERATELY — AND THIS IS A TRAP WORTH THE COMMENT.
//
// build-site.sh excludes `^data/_` from public/, which looks like exactly the hook
// this file wants: tracked, but not served. It isn't. .gitignore line 10 is
// `data/_*.json`, so the underscore ALSO means untracked — and this file must be
// committed or CI cannot persist it between runs and the master silently rebuilds
// itself from whatever delta the backfill last fetched.
//
// "Not shipped" and "not tracked" are the same prefix in this repo, and this file
// needs one without the other. So it gets a plain name and an explicit exclusion in
// build-site.sh. If you rename it, change build-site.sh in the same commit.
const MASTER = path.join(ROOT, 'data', 'fight-grid-all.json');
const OUT = path.join(ROOT, 'data', 'fight-grid.json');
const NAMES = path.join(ROOT, 'data', 'grid-names.json');
const INDEX = path.join(ROOT, 'index.html');
const EVENT = path.join(ROOT, 'data', 'event.json');
const DRY = process.argv.includes('--dry');

const LIFT = ['g', 'tdAcc', 'slams', 'adv'];
const GI = (p, t) => ['dist', 'clinch', 'ground'].indexOf(p) * 3 + ['head', 'body', 'leg'].indexOf(t);
const LANES = [['dist', 'head'], ['dist', 'body'], ['dist', 'leg'], ['ground', 'head']];

// Same fold as _gridNorm() in index.html and _norm() in the python. Written a
// fourth time here, and the fourth time it is still not optional: the card says
// "Dricus Du Plessis", the data says "Dricus du Plessis".
const normRaw = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z ]/g, '').trim();

// THE THIRD PLACE THIS JOIN LIVES, AND THE ONE I MISSED FIRST TIME.
//
// The shipped grid is `card ∩ master`, so this norm decides whether a fighter's
// panel exists. ESPN's card says "Jose Miguel Delgado"; the master is keyed "Jose
// Delgado". Fold accents all day, they still don't match — so he sat IN the master,
// fetched and lifted, and still wasn't shipped. Fixing the browser lookup and the
// scraper's id resolution had left this in the middle, quietly dropping him.
//
// ACTIVE_ROSTER_ALIASES is human-curated (see readIndex). Loaded lazily because
// this file's norm() is used before main() reads index.html.
let _aliasMap = null;
function aliasMap() {
  if (_aliasMap) return _aliasMap;
  _aliasMap = new Map();
  try {
    const html = fs.readFileSync(INDEX, 'utf8');
    const al = /const ACTIVE_ROSTER_ALIASES\s*=\s*\{([\s\S]*?)\n\s*\};/.exec(html);
    if (al) {
      const re = /"([^"]+)"\s*:\s*"([^"]+)"/g; let m;
      while ((m = re.exec(al[1]))) _aliasMap.set(normRaw(m[1]), normRaw(m[2]));
    }
  } catch (e) { /* no table: plain normalisation, same as before */ }
  return _aliasMap;
}
const norm = s => { const n = normRaw(s); return aliasMap().get(n) || n; };

function readIndex() {
  const html = fs.readFileSync(INDEX, 'utf8');

  // division per fighter
  const fm = /const FIGHTERS = \[([\s\S]*?)\n \];/.exec(html);
  const div = new Map();
  if (fm) {
    const re = /name:\s*"([^"]+)"[^}]*?division:\s*"([^"]+)"/g;
    let m; while ((m = re.exec(fm[1]))) div.set(norm(m[1]), m[2]);
  }

  // ACTIVE_ROSTER, resolved through the alias table.
  //
  // ONE LINE, CLOSING WITH `"];` — a /\[([\s\S]*?)\n\s*\];/ pattern does not stop
  // at the end of it, it runs on into ROSTER_CHANGES and collects week labels and
  // the literal "Name" as if they were fighters.
  //
  // AND THE ROSTER USES DISPLAY NAMES. Folding accents is not enough: "King Green"
  // -> "Bobby Green" and "Patricio Freire" -> "Patrício Pitbull" don't fold, and
  // neither does "Jan Blachowicz" -> "Jan Błachowicz". Seven fighters, a former
  // champion among them, drop out of their own division's baseline — and a miss
  // looks exactly like a fighter with no data.
  const am = /const ACTIVE_ROSTER = \[([\s\S]*?)\];/.exec(html);
  const alias = {};
  const al = /const ACTIVE_ROSTER_ALIASES\s*=\s*\{([\s\S]*?)\n\s*\};/.exec(html);
  if (al) { const re = /"([^"]+)"\s*:\s*"([^"]+)"/g; let m; while ((m = re.exec(al[1]))) alias[m[1]] = m[2]; }
  const active = new Set();
  if (am) {
    for (const raw of am[1].match(/"([^"]+)"/g) || []) {
      const n = raw.slice(1, -1);
      if (div.has(norm(n))) { active.add(norm(n)); continue; }
      const t = alias[n];
      if (t && div.has(norm(t))) active.add(norm(t));
    }
  }
  return { div, active };
}

// Every fighter on every upcoming card. Reads bouts[].fighters[].fighterName
// explicitly — a recursive hunt for any key called "name" also collects venues and
// broadcasters, and the junk filter people reach for (`" " in name`) silently drops
// every mononym: Sumudaerji, Aoriqileng. Single-name fighters are not an edge case.
function cardNames() {
  let ev; try { ev = JSON.parse(fs.readFileSync(EVENT, 'utf8')); } catch (e) { return null; }
  const out = new Set();
  for (const e of (ev.data || [])) for (const b of (e.bouts || [])) for (const f of (b.fighters || [])) {
    if (typeof f.fighterName === 'string' && f.fighterName.trim()) out.add(norm(f.fighterName));
  }
  return out.size ? out : null;
}

const median = v => {
  const s = v.slice().sort((a, b) => a - b), h = s.length / 2;
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[h - 1] + s[h]) / 2;
};
const quantile = (sorted, q) => {
  const p = (sorted.length - 1) * q, lo = Math.floor(p), hi = Math.ceil(p);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (p - lo);
};
// A ROBUST SPREAD TO GO WITH A ROBUST CENTRE.
//
// The shading needs a scale, not just a middle: "34%" means nothing until you know
// whether a division's fighters sit within 2 points of each other or 20. The
// obvious pairing is median + sd, and it is incoherent — the whole reason for the
// median is that these distributions are right-skewed, and an sd is computed
// around the MEAN and inflated by the very outliers the median was chosen to
// ignore. So: the IQR, rescaled by 1.349 so it reads on the same scale as an sd
// for a normal distribution. Same units, same intuition, doesn't flinch at one
// 95%-accuracy outlier dragging a whole division's scale sideways.
const robustSd = v => {
  const s = v.slice().sort((a, b) => a - b);
  const iqr = quantile(s, 0.75) - quantile(s, 0.25);
  return iqr / 1.349;
};

// Aggregate a fighter's last 8 grid fights into 9 offensive + 9 defensive cells.
function agg(rows) {
  const off = Array.from({ length: 9 }, () => [0, 0]);
  const def = Array.from({ length: 9 }, () => [0, 0]);
  for (const r of (rows || []).filter(Boolean).slice(0, 8)) {
    if (r.f && r.f.g) for (let i = 0; i < 9; i++) { off[i][0] += r.f.g[i][0]; off[i][1] += r.f.g[i][1]; }
    if (r.o && r.o.g) for (let i = 0; i < 9; i++) { def[i][0] += r.o.g[i][0]; def[i][1] += r.o.g[i][1]; }
  }
  return { off, def };
}

const CELL_FLOOR = 25;   // attempts before a fighter's own rate in a cell means anything
const PEER_FLOOR = 8;    // fighters before a "median" means anything (index.html's own rule)

// PER-DIVISION MEDIANS — what the sweep is for.
//
// MEDIAN, NOT MEAN, and the reason is index.html's, verbatim: MMA rate stats are
// right-skewed, and a mean is dragged up by the few extremes, making ordinary
// fighters look below par. statDivMedians() already made this call for the profile
// bars; this is the same statistic over the same population, per grid cell.
//
// ACTIVE ROSTER ONLY. FIGHTERS carries ~2,450 retired fighters. A division median
// that includes them is a median of MMA history, not of the men this fighter is
// actually being compared to.
//
// >= 8 PEERS OR NOTHING. Measured on the card-only grid this floor left 16 of 99
// division x cell combos standing, which is why the sweep had to come first. Under
// the floor the entry is null and the UI shades nothing — it does not quietly fall
// back to a different baseline, because a grid where some cells mean "vs division"
// and others mean "vs card" is a grid that means neither.
function divisionBase(grid, div, active) {
  const byDiv = {};
  for (const name of Object.keys(grid)) {
    const k = norm(name);
    if (!active.has(k)) continue;
    const d = div.get(k);
    if (!d || d === '?') continue;
    (byDiv[d] = byDiv[d] || []).push(agg(grid[name]));
  }
  const out = {};
  // [median, spread, n], or null under the peer floor. The spread can legitimately
  // be 0 when a division's middle half all land on the same rate; floor it so the
  // browser never divides by it.
  const pack = v => v.length >= PEER_FLOOR
    ? [+median(v).toFixed(4), +Math.max(robustSd(v), 0.01).toFixed(4), v.length]
    : null;
  for (const [d, fighters] of Object.entries(byDiv)) {
    const acc = [], allow = [], aim = [];
    for (let i = 0; i < 9; i++) {
      const a = [], b = [], m = [];
      for (const f of fighters) {
        const tot = f.off.reduce((s, c) => s + c[1], 0);
        if (f.off[i][1] >= CELL_FLOOR) a.push(f.off[i][0] / f.off[i][1]);
        if (f.def[i][1] >= CELL_FLOOR) b.push(f.def[i][0] / f.def[i][1]);
        // Share is a proportion of the fighter's OWN total, so the floor is "does
        // he have meaningful volume at all", not "25 in this cell" — which is why
        // this section survives the peer floor in more divisions than the others.
        if (tot >= 150) m.push(f.off[i][1] / tot);
      }
      acc.push(pack(a)); allow.push(pack(b)); aim.push(pack(m));
    }

    // TWO THINGS `aim` WAS MIXING, NOW SEPARATED — because a share of TOTAL offense
    // is not a targeting choice, and the prose was reporting it as one.
    //
    // Measured over the 524 swept fighters with enough volume:
    //     corr(head-share-of-TOTAL, share of offense at range)  =  0.703
    //     corr(head-share-of-TOTAL, share of offense on ground) = -0.576
    // So "he aims at the head unusually often" is about HALF just "he stays
    // standing". And the ground version isn't merely confounded, it's incoherent:
    // nobody AIMS at ground strikes, you throw them because you are on the ground.
    // That is a grappling fact, and the Grappling tab already states it properly
    // with control time and takedowns.
    //
    //     corr(head-share-of-DISTANCE, share at range) = 0.059
    // THAT is a targeting choice: what he does once he is standing, independent of
    // how often he is standing. Hence two separate baselines:
    //     pos  = where the fight happens  [dist, clinch, ground] / total
    //     aimD = what he throws at range  [head, body, leg] / distance offense
    const pos = [], aimD = [];
    for (let g = 0; g < 3; g++) {                        // 0 dist, 1 clinch, 2 ground
      const v = [];
      for (const f of fighters) {
        const tot = f.off.reduce((s, c) => s + c[1], 0);
        if (tot < 150) continue;
        v.push((f.off[g*3][1] + f.off[g*3+1][1] + f.off[g*3+2][1]) / tot);
      }
      pos.push(pack(v));
    }
    for (let t = 0; t < 3; t++) {                        // 0 head, 1 body, 2 leg
      const v = [];
      for (const f of fighters) {
        const dt = f.off[0][1] + f.off[1][1] + f.off[2][1];
        if (dt < 100) continue;                          // enough range volume to have a habit
        v.push(f.off[t][1] / dt);
      }
      aimD.push(pack(v));
    }

    if (acc.some(Boolean) || allow.some(Boolean) || aim.some(Boolean)) out[d] = { acc, allow, aim, pos, aimD };
  }
  return out;
}

// THE EAGER FILE MUST LEAVE HERE COMPACT, LIFT OR NO LIFT.
//
// fight-stats-backfill.py writes it with json.dump(..., indent=0), which puts every
// element on its own line: 7909KB of data becomes 9970KB on disk. Pure newlines —
// measured, the parsed content is byte-identical and re-serialises to 7908KB. That
// is +2.1MB (26%) on a file EVERY VISITOR EAGER-FETCHES, and 1.4 million lines of
// churn per commit into a .git that is already 805MB.
//
// This script always fixed it by accident, because rewriting SRC compactly is a
// side effect of the lift. But the lift's early-return on a no-op run skips that
// write — so the bloat survives exactly when nothing was fetched, which IS steady
// state. Any python run followed by a quiet split shipped the fat file.
//
// So the normalisation is explicit and unconditional now, and writes ONLY when the
// bytes would actually change: an already-compact file produces no write and no git
// diff, so a no-op run stays a no-op.
function writeSrcCompact(D, raw) {
  const out = JSON.stringify(D);
  if (out === raw) return false;
  fs.writeFileSync(SRC, out);
  return true;
}

function main() {
  const rawSrc = fs.readFileSync(SRC, 'utf8');
  const D = JSON.parse(rawSrc);

  // MERGE, NEVER OVERWRITE — the master is the ONLY copy of the grid.
  //
  // The backfill writes `g` into fight-stats.json and this script lifts it out, so
  // after a split fight-stats.json holds no grid at all: the master IS the data.
  // Building it from scratch each run therefore doesn't "regenerate" it, it DELETES
  // every fighter who wasn't in this run's batch — and since the backfill only ever
  // fetches the delta, that is almost everyone.
  //
  // Caught by simulating a newly-announced fighter: one 24-fighter batch left the
  // file holding 24 fighters instead of 115. Each CI run would have quietly thrown
  // away the last one's work, the queue would refill every night, and the job would
  // have stayed green throughout.
  //
  // MIGRATION: before the master existed, fight-grid.json WAS the master. Seed from
  // it when the master is absent, or the first run after this change silently starts
  // the grid over from whatever tiny batch it happens to be holding.
  // "DOESN'T EXIST" AND "CAN'T BE READ" ARE NOT THE SAME THING, AND CONFLATING THEM
  // DESTROYS THE MASTER.
  //
  // The old code caught ANY error here and fell back to the 109-fighter card file,
  // then wrote that back as the master: 618 fighters -> 109, division medians
  // 63/99 -> 16/99, and it printed "master absent — seeded from fight-grid.json",
  // which reads like a normal day.
  //
  // That is not hypothetical. This repo lives on iCloud Drive, and the master is
  // the PERFECT eviction target: 1.4MB, never fetched by the browser, touched only
  // by this script twice a day. Cold by design — that IS the architecture. When
  // "Optimize Mac Storage" offloads it, the file still exists with its full size
  // and reading it throws errno -35 from any process that can't trigger iCloud's
  // download (i.e. every Claude/Cowork sandbox). One run and 500 fighters of
  // scraping are gone, silently, green.
  //
  // So: ENOENT is the only tolerable failure. It means a genuine first run, and
  // seeding from fight-grid.json is right. ANYTHING ELSE — offloaded, truncated,
  // corrupt — must THROW and take CI red with it. Refusing to run costs a re-run;
  // guessing costs the sweep.
  let grid = {};
  if (fs.existsSync(MASTER)) {
    grid = JSON.parse(fs.readFileSync(MASTER, 'utf8'));      // deliberately unguarded
  } else if (fs.existsSync(OUT)) {
    grid = JSON.parse(fs.readFileSync(OUT, 'utf8'));
    console.log('master absent — seeded from fight-grid.json (' + Object.keys(grid).length + ' fighters)');
  }
  const had = Object.keys(grid).length;

  let lifted = 0, fights = 0, withGrid = 0;
  for (const name of Object.keys(D)) {
    const rows = [];
    for (const f of D[name]) {
      fights++;
      const row = {};
      let any = false;
      for (const side of ['f', 'o']) {
        if (!f[side]) continue;
        const keep = {};
        for (const k of LIFT) {
          if (f[side][k] !== undefined) { keep[k] = f[side][k]; delete f[side][k]; any = true; lifted++; }
        }
        if (Object.keys(keep).length) row[side] = keep;
      }
      if (any) { withGrid++; rows.push({ date: f.date, opponent: f.opponent, ...row }); }
      else rows.push(null);
    }
    // Only replace a fighter's entry when THIS run actually lifted something for
    // him. `rows.some(Boolean)` alone would write an all-null array for every
    // fighter in the 3,096-row file, i.e. wipe the grid with placeholders.
    if (rows.some(Boolean)) grid[name] = rows;
  }

  const { div, active } = readIndex();
  const withG = n => (grid[n] || []).some(r => r && r.f && r.f.g);
  const allNames = Object.keys(grid).filter(withG);

  // THE SHIPPED GRID: card fighters only.
  //
  // If event.json can't be read, ship everything rather than nothing — a fat file
  // is a performance bug, an empty one is every button on the site opening a panel
  // that says "no breakdown available".
  const card = cardNames();
  const shipNames = card ? allNames.filter(n => card.has(norm(n))) : allNames;
  const ship = {};
  for (const n of shipNames) ship[n] = grid[n];

  // THE MANIFEST GATES THE BUTTON, SO IT MUST DESCRIBE THE SHIPPED FILE, NOT THE
  // MASTER. Listing a master-only fighter here would put a button on his bout and
  // then hand the panel a file that doesn't contain him — the button opens, the
  // fetch succeeds, _ddGrid returns null, and the reader gets "No breakdown
  // available for this bout". That empty panel is the exact thing the gate exists
  // to prevent, and it would only appear for fighters who HAVE data.
  const names = Object.keys(ship);

  // THE BASELINE RIDES WITH THE MANIFEST.
  //
  // The panel's prose has to pick WHICH disparity to lead with, and "biggest gap"
  // is meaningless across axes measured on different scales — takedown defense
  // varies wildly across fighters (sd ~19 points) while head accuracy barely moves
  // (sd ~8). A 20-point gap is ordinary in one and enormous in the other. Comparing
  // them needs each axis's own spread.
  //
  // I already got this wrong once in this feature by dividing each stat by a
  // constant I picked by eye, which made the weights incomparable and ranked my own
  // denominators instead of the fighters. So the spreads are MEASURED here and
  // shipped — a few hundred bytes — rather than re-derived by hand in the browser.
  //
  // Measured over the MASTER now, not the shipped subset: same statistic, ~6x the
  // population, and it stops being a baseline that reshuffles every time the card
  // changes.
  const cols = {};
  const push = (k, v) => { if (isFinite(v)) (cols[k] = cols[k] || []).push(v); };
  for (const n of allNames) {
    const { off, def } = agg(grid[n]);
    const tot = off.reduce((s, c) => s + c[1], 0);
    if (tot < 150) continue;
    for (const [p, t] of LANES) {
      const i = GI(p, t);
      push('aim.' + p + '.' + t, off[i][1] / tot);
      if (def[i][1] >= CELL_FLOOR) push('allow.' + p + '.' + t, def[i][0] / def[i][1]);
    }
  }
  // Takedowns and control live in fight-stats.json, not the grid — they were never
  // part of the cross-tab and the panel needs them because they are usually the
  // story of the fight. Baseline them from the same source the panel reads.
  for (const n of allNames) {
    const rows = (D[n] || []).slice(0, 8);
    if (rows.length < 3) continue;
    let tdA = 0, agL = 0, agA = 0, ctrl = 0;
    for (const f of rows) {
      if (!f || !f.f || !f.o) continue;
      tdA += f.f.tdA || 0; agL += f.o.tdL || 0; agA += f.o.tdA || 0;
      const m = /^(\d+):(\d+)$/.exec(String(f.f.ctrl || ''));
      if (m) ctrl += +m[1] * 60 + +m[2];
    }
    push('tdRate', tdA / rows.length);
    if (agA >= 4) push('tdStop', (agA - agL) / agA);
    push('ctrlPer', ctrl / rows.length);
  }
  const base = {};
  for (const [k, v] of Object.entries(cols)) {
    const m = v.reduce((a, b) => a + b, 0) / v.length;
    const sd = Math.sqrt(v.reduce((s, x) => s + (x - m) * (x - m), 0) / v.length);
    base[k] = [+m.toFixed(4), +(sd || 0.01).toFixed(4), v.length];
  }

  const divBase = divisionBase(grid, div, active);

  // `divs` maps a fighter to his division so the browser doesn't have to scan
  // FIGHTERS (3,101 rows) on every panel open. Only the shipped fighters need it.
  const divs = {};
  for (const n of names) { const d = div.get(norm(n)); if (d && d !== '?') divs[n] = d; }

  if (!DRY) fs.writeFileSync(NAMES, JSON.stringify({ names, base, divBase, divs }));

  const kb = n => (n / 1024).toFixed(0) + 'KB';
  const covered = Object.entries(divBase).reduce((s, [, v]) => s + v.acc.filter(Boolean).length, 0);
  const divCells = Object.keys(divBase).length * 9;

  if (!lifted) {
    // NOT AN ERROR: nothing new to lift. Either the backfill hasn't run since the
    // pack() change, or — far more likely in steady state — nobody new was
    // announced and every card fighter already has his grid. The manifest is still
    // rewritten above, and that MATTERS: it is derived from the whole grid, not
    // this batch, so a manifest that only regenerated on fresh data would go stale
    // on the exact schedule it serves and every button would vanish on a quiet day.
    let renorm = false;
    if (!DRY) {
      fs.writeFileSync(MASTER, JSON.stringify(grid));
      fs.writeFileSync(OUT, JSON.stringify(ship));
      // Even here — ESPECIALLY here. A no-op lift after a python run is exactly the
      // case that used to leave the eager payload 2.1MB fat.
      renorm = writeSrcCompact(D, rawSrc);
    }
    console.log((DRY ? '--dry: ' : '') + 'nothing to lift (' + allNames.length + ' fighters in the master).');
    if (renorm) console.log('fight-stats.json  ' + kb(rawSrc.length) + ' -> ' + kb(fs.statSync(SRC).size) +
      '   (re-compacted: python wrote it with indent=0)');
    // Size from the string we built, not statSync — in --dry that file was never
    // written and stat would report the OLD one, which is a dry run reporting a
    // number from the thing it is meant to be predicting.
    console.log('grid-names.json   ' + kb(JSON.stringify({ names, base, divBase, divs }).length) +
      '   (' + names.length + ' shipped names of ' + allNames.length + ' in master, ' +
      Object.keys(divBase).length + ' divisions, ' + covered + '/' + divCells + ' accuracy cells have a median)');
    return;
  }

  const before = fs.statSync(SRC).size;
  if (DRY) {
    console.log('--dry: would lift ' + lifted + ' field groups from ' + withGrid + '/' + fights + ' fights');
    console.log('--dry: master ' + had + ' -> ' + Object.keys(grid).length + ' fighters; would ship ' + names.length);
    console.log('--dry: ' + Object.keys(divBase).length + ' divisions, ' + covered + '/' + divCells + ' accuracy cells have a median');
    return;
  }
  writeSrcCompact(D, rawSrc);
  fs.writeFileSync(MASTER, JSON.stringify(grid));
  fs.writeFileSync(OUT, JSON.stringify(ship));

  console.log('fight-stats.json     ' + kb(before) + ' -> ' + kb(fs.statSync(SRC).size) + '   (eager: must not grow)');
  console.log('fight-grid-all.json  ' + kb(fs.statSync(MASTER).size) + '   (master: build-time only, never fetched)');
  console.log('fight-grid.json      ' + kb(fs.statSync(OUT).size) + '   (lazy: deep dive only, card-scoped)');
  console.log('grid-names.json      ' + kb(fs.statSync(NAMES).size) + '   (eager: gates the button + baselines)');
  console.log('grid present on ' + withGrid + '/' + fights + ' fights this batch');
  console.log('master ' + had + ' -> ' + Object.keys(grid).length + ' fighters (merged, never overwritten); shipping ' + names.length);
  console.log('divisions with a baseline: ' + Object.keys(divBase).length + '   accuracy cells with a median: ' + covered + '/' + divCells);
}
main();
