#!/usr/bin/env node
/* Lift the strike GRID out of fight-stats.json into a separate, lazily-loaded file.
 *
 * WHY THIS EXISTS RATHER THAN JUST WIDENING THE SCHEMA.
 * data/fight-stats.json is EAGER-FETCHED BY EVERY VISITOR — index.html does a
 * plain fetch() of it on load, and it is already ~8MB (its own comment says 9.8).
 * The 3x3 cross-tab adds ~900KB. Paying that on every page view, so that a
 * click-through panel can be richer, is the wrong trade: the deep dive is a
 * button, and a button's data should load when it's pressed.
 *
 * So pack() emits `g` (plus tdAcc/slams/adv), this lifts those fields into
 * data/fight-grid.json, and fight-stats.json goes back to exactly the shape
 * index.html already reads. The main payload does not grow by one byte.
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
const OUT = path.join(ROOT, 'data', 'fight-grid.json');
const DRY = process.argv.includes('--dry');

const LIFT = ['g', 'tdAcc', 'slams', 'adv'];

function main() {
  const D = JSON.parse(fs.readFileSync(SRC, 'utf8'));

  // MERGE, NEVER OVERWRITE — this file is the ONLY copy of the grid.
  //
  // The backfill writes `g` into fight-stats.json and this script lifts it out, so
  // after a split fight-stats.json holds no grid at all: fight-grid.json IS the
  // data. Building `grid` from scratch each run therefore doesn't "regenerate" it,
  // it DELETES every fighter who wasn't in this run's batch — and since the
  // backfill only ever fetches the delta, that is almost everyone.
  //
  // Caught by simulating a newly-announced fighter: one 24-fighter batch left
  // fight-grid.json holding 24 fighters instead of 115. Each CI run would have
  // quietly thrown away the last one's work, the queue would refill every night,
  // and the job would have stayed green throughout.
  let grid = {};
  try { grid = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) { grid = {}; }
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

  if (!lifted) {
    // NOT AN ERROR, AND WORTH SAYING PLAINLY: the grid only exists in records
    // written AFTER the pack() change. Every row currently on disk predates it,
    // so this is a no-op until the backfill is re-run.
    console.log('no `g` fields found in ' + path.basename(SRC) + ' — nothing to lift.');
    console.log('The grid only exists in records fetched since the pack() change.');
    console.log('Re-run the backfill first:');
    console.log('  python3 scripts/fight-stats-parallel.py --workers 32');
    console.log('NOTE: do NOT use --only-missing. Every fighter is already "present"');
    console.log('and would be skipped — they are present WITHOUT the grid, which is');
    console.log('exactly the case that flag cannot see. This needs a full re-fetch.');
    return;
  }

  const before = fs.statSync(SRC).size;
  if (DRY) { console.log('--dry: would lift ' + lifted + ' field groups from ' + withGrid + '/' + fights + ' fights'); return; }
  fs.writeFileSync(SRC, JSON.stringify(D));
  fs.writeFileSync(OUT, JSON.stringify(grid));
  const kb = n => (n / 1024).toFixed(0) + 'KB';
  console.log('fight-stats.json  ' + kb(before) + ' -> ' + kb(fs.statSync(SRC).size) + '   (eager: must not grow)');
  console.log('fight-grid.json   ' + kb(fs.statSync(OUT).size) + '   (lazy: deep dive only)');
  console.log('grid present on ' + withGrid + '/' + fights + ' fights this batch');
  console.log('fighters in grid  ' + had + ' -> ' + Object.keys(grid).length + '   (merged, never overwritten)');
}
main();
