#!/usr/bin/env node
/**
 * Injects manually-confirmed bouts that are entirely missing from the Cito
 * API feed into a freshly-fetched data/event.json.
 *
 * Why this exists: the update-odds workflow curls the Cito API straight into
 * data/event.json every run, replacing the file wholesale. Sometimes a real,
 * booked bout (confirmed via UFC.com / Sherdog / BestFightOdds, etc.) simply
 * hasn't been added to the API's feed yet for a given event. Unlike
 * fighter-overrides.json (which swaps one fighter within an EXISTING bout),
 * this script adds a brand-new bout object to an existing event. It reads
 * data/missing-bout-overrides.json and, for each entry, checks whether a
 * bout already exists in the matching event containing all of
 * matchFighterNames (case-insensitive) — if so it's skipped (the API has
 * caught up); otherwise the bout described in `bout` is appended.
 *
 * Run after fetching data/event.json and before committing it (see
 * .github/workflows/update-odds.yml).
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const EVENT_PATH = path.join(DATA_DIR, 'event.json');
const OVERRIDES_PATH = path.join(DATA_DIR, 'missing-bout-overrides.json');

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

function buildFighter(boutId, spec) {
  const recordText = spec.recordText || null;
  return {
    id: 'manual-override-' + spec.fighterSlug,
    boutId,
    fighterSlug: spec.fighterSlug,
    fighterName: spec.fighterName,
    corner: spec.corner,
    outcome: null,
    rankText: null,
    country: spec.country || null,
    odds: null,
    imageUrl: null,
    flag: spec.flag || null,
    championStatus: 'none',
    profile: {
      slug: spec.fighterSlug,
      name: spec.fighterName,
      nickname: spec.nickname || null,
      championStatus: 'none',
      division: spec.division || null,
      recordText,
      record: recordText ? parseRecordText(recordText) : null,
      country: spec.country || null,
      flag: spec.flag || null,
      headshotUrl: null,
      imageUrl: null,
      status: 'Active',
      isActive: true,
      dataFreshness: null,
      freshnessStatus: 'manual-override',
      dataAgeHours: 0,
      dataSource: 'manual-override',
      warning: 'Applied by apply-missing-bout-overrides.js — see data/missing-bout-overrides.json for the reason.',
    },
  };
}

function buildBout(eventSlug, ov) {
  const spec = ov.bout || {};
  const boutId = 'manual-override-' + (spec.fighters || []).map((f) => f.fighterSlug).join('-vs-');
  return {
    id: boutId,
    eventSlug,
    cardSection: spec.cardSection || 'Prelims',
    cardSectionOrder: spec.cardSectionOrder != null ? spec.cardSectionOrder : 2,
    cardPosition: spec.cardPosition || null,
    boutOrder: spec.boutOrder != null ? spec.boutOrder : 9999,
    weightClass: spec.weightClass || null,
    titleBout: !!spec.titleBout,
    status: 'confirmed',
    isCancelled: false,
    cancellationReason: null,
    winnerFighterSlug: null,
    resultRound: 0,
    resultTime: null,
    method: null,
    methodDetails: null,
    odds: { red: null, blue: null },
    awards: null,
    dataAvailability: {
      result: 'pending',
      warning: null,
      strategy: 'manual-override',
      warnings: [],
      fetchedAt: new Date().toISOString(),
      roundStats: 'ufcstats_enrichment_when_available',
      dataAgeHours: 0,
      dataFreshness: 'manual-override',
      fighterCorners: 'available',
    },
    createdAt: new Date().toISOString(),
    lastSyncedAt: new Date().toISOString(),
    fighters: (spec.fighters || []).map((f) => buildFighter(boutId, f)),
    roundStats: [],
    dataId: boutId,
    hasStats: false,
    dataFreshness: new Date().toISOString(),
    freshnessStatus: 'manual-override',
    dataAgeHours: 0,
    dataSource: 'manual-override',
    warning: 'Applied by apply-missing-bout-overrides.js — see data/missing-bout-overrides.json for the reason.',
    boutStats: [],
  };
}

function main() {
  const overridesDoc = loadJson(OVERRIDES_PATH, { overrides: [] });
  const overrides = overridesDoc.overrides || [];

  if (!overrides.length) {
    console.log('[missing-bout-overrides] No overrides configured — nothing to do.');
    return;
  }

  if (!fs.existsSync(EVENT_PATH)) {
    console.log('[missing-bout-overrides] data/event.json not found — skipping.');
    return;
  }

  const eventDoc = loadJson(EVENT_PATH, null);
  if (!eventDoc || !Array.isArray(eventDoc.data)) {
    console.log('[missing-bout-overrides] data/event.json has no .data array — skipping.');
    return;
  }

  let totalAdded = 0;

  overrides.forEach((ov) => {
    const wantedNames = (ov.matchFighterNames || []).map((n) => String(n).trim().toLowerCase());
    if (wantedNames.length < 2 || !ov.bout || !(ov.bout.fighters || []).length) return;

    const matchingEvents = eventDoc.data.filter((e) => {
      if (ov.eventSlug && e.slug === ov.eventSlug) return true;
      if (ov.eventStartsAt && e.startsAt === ov.eventStartsAt) return true;
      return false;
    });

    if (!matchingEvents.length) {
      console.log(`[missing-bout-overrides] No event matched slug="${ov.eventSlug || ''}" startsAt="${ov.eventStartsAt || ''}" — override skipped (event may have passed/been removed from the feed).`);
      return;
    }

    matchingEvents.forEach((evt) => {
      evt.bouts = evt.bouts || [];
      const alreadyPresent = evt.bouts.some((bout) => {
        const names = (bout.fighters || []).map((f) => String(f.fighterName || '').trim().toLowerCase());
        return wantedNames.every((n) => names.includes(n));
      });
      if (alreadyPresent) {
        console.log(`[missing-bout-overrides] ${evt.title} (${evt.slug}): bout [${wantedNames.join(' vs ')}] already present — API has caught up, skipping injection.`);
        return;
      }
      const newBout = buildBout(evt.slug, ov);
      evt.bouts.push(newBout);
      console.log(`[missing-bout-overrides] ${evt.title} (${evt.slug}): injected missing bout [${(newBout.fighters || []).map((f) => f.fighterName).join(' vs ')}]`);
      totalAdded += 1;
    });
  });

  if (totalAdded > 0) {
    // Match the existing compact (no extra whitespace) formatting of event.json.
    fs.writeFileSync(EVENT_PATH, JSON.stringify(eventDoc));
    console.log(`[missing-bout-overrides] Added ${totalAdded} missing bout(s).`);
  } else {
    console.log('[missing-bout-overrides] All overrides already in effect — no changes needed.');
  }
}

main();
