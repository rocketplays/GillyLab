#!/usr/bin/env node
// ONE-TIME backfill: replays every git revision of data/odds.json (the
// only odds snapshots that exist prior to odds-history.json being
// introduced) through the same merge logic the daily updater uses, so the
// "Line Movement" tracker isn't empty on day one.
//
// Odds tracking in this repo only goes back a few days, so this recovers
// whatever's available — it does not invent any data.
//
// Usage (from repo root, clean working tree): node scripts/backfill-odds-history.js
// Safe to re-run: it rebuilds data/odds-history.json from scratch each time.

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { applySnapshot, stripKeys } = require('./odds-history-lib.cjs');

const ROOT = path.resolve(__dirname, '..');
const HISTORY_PATH = path.join(ROOT, 'data', 'odds-history.json');

function git(cmd) {
  return execSync(`git ${cmd}`, { cwd: ROOT, encoding: 'utf8' });
}

// Every commit that touched data/odds.json, oldest first: "<hash>\t<ISO commit date>"
const lines = git('log --reverse --format=%H%x09%aI -- data/odds.json').trim().split('\n').filter(Boolean);

if (!lines.length) {
  console.log('No odds.json history found in git — nothing to backfill.');
  process.exit(0);
}

// Collapse to one snapshot per UTC date — keep the LAST commit of each day
// (an end-of-day reading), since the live workflow runs twice daily.
const lastCommitForDate = {};
lines.forEach(line => {
  const [hash, iso] = line.split('\t');
  const date = iso.slice(0, 10); // 'YYYY-MM-DDTHH:MM:SS+00:00' -> 'YYYY-MM-DD'
  lastCommitForDate[date] = hash; // later commits on the same date overwrite earlier ones
});

let history = [];
let applied = 0;
Object.keys(lastCommitForDate).sort().forEach(date => {
  const hash = lastCommitForDate[date];
  let oddsData;
  try {
    oddsData = JSON.parse(git(`show ${hash}:data/odds.json`));
  } catch (e) {
    console.log(`  skip ${date} (${hash.slice(0, 7)}) — couldn't read/parse: ${e.message}`);
    return;
  }
  if (!Array.isArray(oddsData) || !oddsData.length) {
    console.log(`  skip ${date} (${hash.slice(0, 7)}) — empty snapshot`);
    return;
  }
  history = applySnapshot(history, oddsData, date);
  applied++;
  console.log(`  applied ${date} from ${hash.slice(0, 7)} (${oddsData.length} listed fights)`);
});

fs.writeFileSync(HISTORY_PATH, JSON.stringify(stripKeys(history)));
console.log(`\nBackfill complete — ${applied} day(s) replayed, ${history.length} matchup(s) written to data/odds-history.json`);
