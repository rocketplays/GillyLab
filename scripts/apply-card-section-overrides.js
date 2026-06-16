#!/usr/bin/env node
/**
 * Re-applies manual bout.cardSection corrections on top of a freshly-fetched
 * data/event.json.
 *
 * Why this exists: the update-odds workflow curls the Cito API straight into
 * data/event.json every run, replacing the file wholesale. Any one-off manual
 * fix to a bout's cardSection (e.g. the API mislabeling a prelim as "Main
 * Card") gets silently wiped the next time the workflow runs. This script
 * reads data/card-section-overrides.json and re-applies each override to the
 * matching event/bouts in data/event.json, so a fix made once keeps sticking
 * across every future automated fetch.
 *
 * Run after fetching data/event.json and before committing it (see
 * .github/workflows/update-odds.yml).
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const EVENT_PATH = path.join(DATA_DIR, 'event.json');
const OVERRIDES_PATH = path.join(DATA_DIR, 'card-section-overrides.json');

function loadJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  const raw = fs.readFileSync(filePath, 'utf8').trim();
  if (!raw) return fallback;
  return JSON.parse(raw);
}

function main() {
  const overridesDoc = loadJson(OVERRIDES_PATH, { overrides: [] });
  const overrides = overridesDoc.overrides || [];

  if (!overrides.length) {
    console.log('[card-section-overrides] No overrides configured — nothing to do.');
    return;
  }

  if (!fs.existsSync(EVENT_PATH)) {
    console.log('[card-section-overrides] data/event.json not found — skipping.');
    return;
  }

  const eventDoc = loadJson(EVENT_PATH, null);
  if (!eventDoc || !Array.isArray(eventDoc.data)) {
    console.log('[card-section-overrides] data/event.json has no .data array — skipping.');
    return;
  }

  let totalChanged = 0;

  overrides.forEach((ov) => {
    const wantedNames = new Set((ov.fighterNames || []).map((n) => String(n).trim().toLowerCase()));
    if (!wantedNames.size || !ov.cardSection) return;

    const matchingEvents = eventDoc.data.filter((e) => {
      if (ov.eventSlug && e.slug === ov.eventSlug) return true;
      if (ov.eventStartsAt && e.startsAt === ov.eventStartsAt) return true;
      return false;
    });

    if (!matchingEvents.length) {
      console.log(`[card-section-overrides] No event matched slug="${ov.eventSlug || ''}" startsAt="${ov.eventStartsAt || ''}" — override skipped (event may have passed/been removed from the feed).`);
      return;
    }

    matchingEvents.forEach((evt) => {
      (evt.bouts || []).forEach((bout) => {
        const names = (bout.fighters || []).map((f) => String(f.fighterName || '').trim().toLowerCase());
        const isMatch = names.some((n) => wantedNames.has(n));
        if (isMatch && bout.cardSection !== ov.cardSection) {
          console.log(`[card-section-overrides] ${evt.title} (${evt.slug}): boutOrder ${bout.boutOrder} "${bout.cardSection}" -> "${ov.cardSection}" [${(bout.fighters || []).map((f) => f.fighterName).join(' vs ')}]`);
          bout.cardSection = ov.cardSection;
          totalChanged += 1;
        }
      });
    });
  });

  if (totalChanged > 0) {
    // Match the existing compact (no extra whitespace) formatting of event.json.
    fs.writeFileSync(EVENT_PATH, JSON.stringify(eventDoc));
    console.log(`[card-section-overrides] Applied ${totalChanged} bout override(s).`);
  } else {
    console.log('[card-section-overrides] All overrides already in effect — no changes needed.');
  }
}

main();
