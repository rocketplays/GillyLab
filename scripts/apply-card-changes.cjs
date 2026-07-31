#!/usr/bin/env node
'use strict';
/**
 * Apply data/card-changes.json (from fetch-card-changes.cjs) onto data/event.json
 * by marking the relevant fighters:
 *   - shortNotice: true  → the fighter stepped in as a replacement
 *   - mayChange:   true  → the fighter's opponent withdrew and no replacement is
 *                          set yet, so the bout is in flux
 *
 * The client reads these flags (SHORT_NOTICE_SET / MAY_CHANGE_SET) to drive the
 * "Short notice" / "May change" tiles. Run in the update-odds workflow AFTER
 * fetch-espn-events + fetch-card-changes, and BEFORE apply-fighter-overrides so a
 * manual override always has the final say.
 *
 * Usage: node scripts/apply-card-changes.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EVENT_PATH = path.join(ROOT, 'data', 'event.json');
const CHANGES_PATH = path.join(ROOT, 'data', 'card-changes.json');

function norm(s) {
  return String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
function normLoose(s) { return norm(s).replace(/\b(?:jr|sr|ii|iii|iv)\b/g, '').replace(/\s+/g, ' ').trim(); }

function main() {
  if (!fs.existsSync(CHANGES_PATH)) { console.log('[card-changes] no data/card-changes.json — skipping.'); return; }
  if (!fs.existsSync(EVENT_PATH)) { console.log('[card-changes] no data/event.json — skipping.'); return; }

  const changes = JSON.parse(fs.readFileSync(CHANGES_PATH, 'utf8'));
  const rawBefore = fs.readFileSync(EVENT_PATH, 'utf8');
  const eventDoc = JSON.parse(rawBefore);
  const bySlug = new Map((eventDoc.data || []).map((e) => [e.slug, e]));

  let logged = 0;
  for (const ce of (changes.events || [])) {
    const evt = bySlug.get(ce.slug);
    if (!evt) continue;

    // RESET before re-applying, for every event this run actually scraped. Without
    // this, a flag only ever turns true and never turns back off — a fighter whose
    // opponent situation gets resolved (the withdrawal is confirmed, a replacement
    // is locked in, etc.) keeps showing a stale "may change"/"short notice" tile
    // forever, because nothing ever cleared it once the feed stopped mentioning
    // them. Only events present in THIS run's changes.events are reset — an event
    // the scraper didn't find a Wikipedia page for this run is left alone rather
    // than having potentially-still-valid flags wiped based on no information.
    ['shortNotice', 'mayChange'].forEach((field) => {
      (evt.bouts || []).forEach((b) => (b.fighters || []).forEach((f) => {
        if (f && f[field] === true) f[field] = false;
      }));
    });

    const flagFor = (names, field, label) => {
      (names || []).forEach((nm) => {
        const key = normLoose(nm);
        let hit = false;
        (evt.bouts || []).forEach((b) => (b.fighters || []).forEach((f) => {
          if (f && normLoose(f.fighterName) === key) { f[field] = true; hit = true; }
        }));
        if (hit) { logged++; console.log(`[card-changes] ${evt.slug}: ${label} "${nm}"`); }
      });
    };
    flagFor(ce.shortNotice, 'shortNotice', 'short-notice');
    flagFor(ce.mayChange, 'mayChange', 'may-change');
  }

  // Compact to match the feed's format, then compare against what was on disk —
  // this is the real "did anything change" check (a reset that gets immediately
  // re-set true nets out to no diff, and shouldn't trigger a write/commit).
  const rawAfter = JSON.stringify(eventDoc);
  if (rawAfter === rawBefore) { console.log('[card-changes] nothing to apply.'); return; }
  fs.writeFileSync(EVENT_PATH, rawAfter);
  console.log(`[card-changes] applied ${logged} flag(s), event.json changed (some may be stale flags clearing).`);
}

module.exports = { normLoose };
if (require.main === module) main();
