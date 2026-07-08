#!/usr/bin/env node
/**
 * Re-applies manual fighter opponent-swap corrections on top of a freshly-
 * fetched data/event.json.
 *
 * Why this exists: the update-odds workflow curls the Cito API straight into
 * data/event.json every run, replacing the file wholesale. If the API hasn't
 * picked up a real-world change yet — most commonly an injury withdrawal /
 * short-notice replacement opponent — any one-off manual fix gets silently
 * wiped the next time the workflow runs. This script reads
 * data/fighter-overrides.json and, for each entry, finds the bout in the
 * matching event whose fighters include matchFighterName and swaps that
 * fighter's corner for a minimal, correctly-shaped replacement record built
 * from `replacement`.
 *
 * Run after fetching data/event.json and before committing it (see
 * .github/workflows/update-odds.yml).
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const EVENT_PATH = path.join(DATA_DIR, 'event.json');
const OVERRIDES_PATH = path.join(DATA_DIR, 'fighter-overrides.json');

function loadJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  const raw = fs.readFileSync(filePath, 'utf8').trim();
  if (!raw) return fallback;
  return JSON.parse(raw);
}

function parseRecordText(recordText) {
  const m = String(recordText || '').match(/(\d+)-(\d+)-(\d+)/);
  if (!m) return { wins: 0, losses: 0, draws: 0, noContest: 0, text: recordText || '' };
  return { wins: +m[1], losses: +m[2], draws: +m[3], noContest: 0, text: recordText };
}

function buildReplacementFighter(original, replacement) {
  const recordText = replacement.recordText || null;
  return {
    id: original.id, // keep the same row id so client-side keys/diffing stay stable
    boutId: original.boutId,
    fighterSlug: replacement.fighterSlug,
    fighterName: replacement.fighterName,
    // Ground-truth marker: this fighter is a short-notice replacement. The app
    // reads this (the news feed's generic "regional fighter replacement"
    // headlines often don't name the incoming fighter, so we can't rely on it).
    shortNotice: replacement.shortNotice === true,
    corner: original.corner,
    outcome: null,
    rankText: null,
    country: replacement.country || null,
    odds: null,
    imageUrl: null,
    flag: replacement.flag || null,
    championStatus: 'none',
    profile: {
      slug: replacement.fighterSlug,
      name: replacement.fighterName,
      nickname: replacement.nickname || null,
      championStatus: 'none',
      division: original.profile ? original.profile.division : null,
      recordText,
      record: recordText ? parseRecordText(recordText) : null,
      country: replacement.country || null,
      flag: replacement.flag || null,
      headshotUrl: null,
      imageUrl: null,
      status: 'Active',
      isActive: true,
      dataFreshness: null,
      freshnessStatus: 'manual-override',
      dataAgeHours: 0,
      dataSource: 'manual-override',
      warning: 'Applied by apply-fighter-overrides.js — see data/fighter-overrides.json for the reason.',
    },
  };
}

function main() {
  const overridesDoc = loadJson(OVERRIDES_PATH, { overrides: [] });
  const overrides = overridesDoc.overrides || [];

  if (!overrides.length) {
    console.log('[fighter-overrides] No overrides configured — nothing to do.');
    return;
  }

  if (!fs.existsSync(EVENT_PATH)) {
    console.log('[fighter-overrides] data/event.json not found — skipping.');
    return;
  }

  const eventDoc = loadJson(EVENT_PATH, null);
  if (!eventDoc || !Array.isArray(eventDoc.data)) {
    console.log('[fighter-overrides] data/event.json has no .data array — skipping.');
    return;
  }

  let totalChanged = 0;

  overrides.forEach((ov) => {
    const matchName = String(ov.matchFighterName || '').trim().toLowerCase();
    if (!matchName || !ov.replacement || !ov.replacement.fighterName) return;

    const matchingEvents = eventDoc.data.filter((e) => {
      if (ov.eventSlug && e.slug === ov.eventSlug) return true;
      if (ov.eventStartsAt && e.startsAt === ov.eventStartsAt) return true;
      return false;
    });

    if (!matchingEvents.length) {
      console.log(`[fighter-overrides] No event matched slug="${ov.eventSlug || ''}" startsAt="${ov.eventStartsAt || ''}" — override skipped (event may have passed/been removed from the feed).`);
      return;
    }

    const replName = ov.replacement.fighterName.trim().toLowerCase();
    matchingEvents.forEach((evt) => {
      (evt.bouts || []).forEach((bout) => {
        (bout.fighters || []).forEach((fighter, idx) => {
          const name = String(fighter.fighterName || '').trim().toLowerCase();
          if (name === matchName && name !== replName) {
            // API still lists the stale fighter — swap in the replacement.
            const oldName = fighter.fighterName;
            bout.fighters[idx] = buildReplacementFighter(fighter, ov.replacement);
            console.log(`[fighter-overrides] ${evt.title} (${evt.slug}): boutOrder ${bout.boutOrder} "${oldName}" -> "${ov.replacement.fighterName}"`);
            totalChanged += 1;
          } else if (name === replName && ov.replacement.shortNotice === true && fighter.shortNotice !== true) {
            // API already caught up to the replacement — just ensure the
            // short-notice marker (the feed doesn't carry that fact).
            fighter.shortNotice = true;
            console.log(`[fighter-overrides] ${evt.title} (${evt.slug}): marked "${fighter.fighterName}" as short-notice replacement`);
            totalChanged += 1;
          }
        });
      });
    });
  });

  if (totalChanged > 0) {
    // Match the existing compact (no extra whitespace) formatting of event.json.
    fs.writeFileSync(EVENT_PATH, JSON.stringify(eventDoc));
    console.log(`[fighter-overrides] Applied ${totalChanged} fighter override(s).`);
  } else {
    console.log('[fighter-overrides] All overrides already in effect — no changes needed.');
  }
}

main();
