#!/usr/bin/env node
// Run after data/odds.json has been refreshed (see .github/workflows/update-odds.yml).
// Folds today's snapshot into data/odds-history.json — the running
// day-by-day record that powers the "Line Movement" tracker on the Odds
// page (opening line vs. current line, with the day-to-day trend between).
//
// Usage: node scripts/update-odds-history.js [--snapshot-date=YYYY-MM-DD]
//   --snapshot-date overrides "today" — mainly useful for testing; the
//   workflow always lets it default to the current UTC date.

'use strict';

const fs = require('fs');
const path = require('path');
const { applySnapshot, withKeys, stripKeys, pruneStale } = require('./odds-history-lib');

const ROOT = path.resolve(__dirname, '..');
const ODDS_PATH = path.join(ROOT, 'data', 'odds.json');
const HISTORY_PATH = path.join(ROOT, 'data', 'odds-history.json');
const MAX_AGE_DAYS = 4; // keep matchups for a few days after the event so the closing line stays visible

function loadHistory() {
  try {
    return withKeys(JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8')));
  } catch {
    return [];
  }
}

function main() {
  const dateArg = process.argv.find(a => a.startsWith('--snapshot-date='));
  const dateStr = dateArg ? dateArg.split('=')[1] : new Date().toISOString().slice(0, 10);

  if (!fs.existsSync(ODDS_PATH)) {
    console.log('No data/odds.json found — skipping odds-history update.');
    return;
  }
  const oddsData = JSON.parse(fs.readFileSync(ODDS_PATH, 'utf8'));
  if (!Array.isArray(oddsData) || !oddsData.length) {
    console.log('odds.json is empty — skipping odds-history update.');
    return;
  }

  let history = loadHistory();
  history = applySnapshot(history, oddsData, dateStr);
  history = pruneStale(history, MAX_AGE_DAYS);

  fs.writeFileSync(HISTORY_PATH, JSON.stringify(stripKeys(history)));
  console.log(`odds-history.json updated — ${history.length} matchups tracked, snapshot date ${dateStr}`);
}

main();
