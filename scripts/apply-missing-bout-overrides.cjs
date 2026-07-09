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

// How long an override may sit un-picked-up before we start nagging, and how
// long after an event we keep its (inert) entry around before pruning it.
const STALE_WARN_DAYS = 21;
const PRUNE_AFTER_DAYS = 14;

const NAME_SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v']);
// Feeds disagree on accents, punctuation and suffixes — "Kauê Fernandes" vs
// "Kaue Fernandes", "Khalil Rountree Jr." vs "Khalil Rountree". A plain
// lowercase compare would miss those and inject a DUPLICATE bout, so normalise
// hard before deciding whether the API has caught up.
function normName(s) {
  const t = String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    .split(/\s+/).filter(Boolean);
  while (t.length > 1 && NAME_SUFFIXES.has(t[t.length - 1])) t.pop();
  return t.join(' ');
}
function normSlug(s) { return String(s || '').toLowerCase().trim(); }

// Does this bout hold exactly the fighters the override describes? Matches on
// normalised names OR on slugs, so either source of truth is enough.
function boutMatches(bout, wantedNames, wantedSlugs) {
  const names = (bout.fighters || []).map((f) => normName(f.fighterName));
  const slugs = (bout.fighters || []).map((f) => normSlug(f.fighterSlug));
  const byName = wantedNames.length > 0 && wantedNames.every((n) => names.includes(n));
  const bySlug = wantedSlugs.length > 0 && wantedSlugs.length === wantedNames.length && wantedSlugs.every((s) => slugs.includes(s));
  return byName || bySlug;
}
// Is either fighter already booked in some OTHER bout on this card? Happens when
// the API picks the bout up but with a changed opponent — injecting on top would
// list that fighter twice.
function bookedElsewhere(evt, wantedNames, wantedSlugs) {
  return (evt.bouts || []).find((bout) => {
    if (boutMatches(bout, wantedNames, wantedSlugs)) return false;
    return (bout.fighters || []).some((f) =>
      wantedNames.includes(normName(f.fighterName)) || wantedSlugs.includes(normSlug(f.fighterSlug)));
  });
}
function daysSince(iso) {
  const t = Date.parse(iso || '');
  return isFinite(t) ? (Date.now() - t) / 86400000 : null;
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
    const wantedNames = (ov.matchFighterNames || []).map(normName).filter(Boolean);
    const wantedSlugs = ((ov.bout || {}).fighters || []).map((f) => normSlug(f.fighterSlug)).filter(Boolean);
    const label = wantedNames.join(' vs ');
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

      const match = evt.bouts.find((b) => boutMatches(b, wantedNames, wantedSlugs));
      if (match) {
        if (match.isCancelled) {
          console.warn(`[missing-bout-overrides] ⚠ ${evt.title} (${evt.slug}): [${label}] is present but CANCELLED upstream — remove this override, it is no longer a real bout.`);
        } else {
          console.log(`[missing-bout-overrides] ${evt.title} (${evt.slug}): bout [${label}] already present — API has caught up, skipping injection.`);
        }
        return;
      }

      const clash = bookedElsewhere(evt, wantedNames, wantedSlugs);
      if (clash) {
        const who = (clash.fighters || []).map((f) => f.fighterName).join(' vs ');
        console.warn(`[missing-bout-overrides] ⚠ ${evt.title} (${evt.slug}): skipping [${label}] — one of those fighters is already booked on this card as [${who}]. The matchup likely changed; update or remove this override.`);
        return;
      }

      const age = daysSince(ov.addedOn);
      if (age != null && age > STALE_WARN_DAYS) {
        console.warn(`[missing-bout-overrides] ⚠ [${label}] has been injected for ${Math.round(age)} days without the API picking it up — re-confirm the bout is still booked.`);
      }

      const newBout = buildBout(evt.slug, ov);
      evt.bouts.push(newBout);
      console.log(`[missing-bout-overrides] ${evt.title} (${evt.slug}): injected missing bout [${(newBout.fighters || []).map((f) => f.fighterName).join(' vs ')}]`);
      totalAdded += 1;
    });
  });

  // Self-prune: once an event is well past, its override can never fire again
  // (the feed only returns from=TODAY), so drop the dead entry rather than let
  // the file accumulate cruft forever.
  const kept = overrides.filter((ov) => {
    const age = daysSince(ov.eventStartsAt);
    if (age != null && age > PRUNE_AFTER_DAYS) {
      console.log(`[missing-bout-overrides] pruning expired override for ${ov.eventSlug || ov.eventStartsAt} (event was ${Math.round(age)} days ago).`);
      return false;
    }
    return true;
  });
  if (kept.length !== overrides.length) {
    overridesDoc.overrides = kept;
    fs.writeFileSync(OVERRIDES_PATH, JSON.stringify(overridesDoc, null, 2) + '\n');
  }

  if (totalAdded > 0) {
    // Match the existing compact (no extra whitespace) formatting of event.json.
    fs.writeFileSync(EVENT_PATH, JSON.stringify(eventDoc));
    console.log(`[missing-bout-overrides] Added ${totalAdded} missing bout(s).`);
  } else {
    console.log('[missing-bout-overrides] All overrides already in effect — no changes needed.');
  }
}

main();
