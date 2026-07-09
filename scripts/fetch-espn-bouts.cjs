#!/usr/bin/env node
/**
 * Reconciles each upcoming card's bout list against ESPN.
 *
 * Division of labour: Cito owns events, results, method details and box scores —
 * it's good at those. But its bout sync lags badly (as of writing, every bout in
 * the feed carried lastSyncedAt 2026-06-29, ten days stale, while ESPN's card
 * for the same event was updated two days prior). So ESPN is used for exactly
 * one job: telling us which fights are actually booked.
 *
 * This script only ever ADDS bouts that ESPN lists and Cito is missing. It never
 * deletes: a bout Cito still lists that ESPN has dropped is *reported* (usually a
 * cancellation) but left alone, because a transient ESPN hiccup must not be able
 * to wipe a real fight off the card.
 *
 * ESPN's endpoints are undocumented and unofficial — they can change or vanish
 * without notice. Every failure here is non-fatal: on any error we leave
 * data/event.json exactly as Cito returned it and exit 0.
 *
 * Endpoints (no key, no quota):
 *   scoreboard  -> leagues[0].calendar[]  : event ids + dates
 *   events/{id}/competitions              : the actual bouts (cardSegment,
 *                                           matchNumber, weight class, title,
 *                                           round format)
 *   athletes/{id}                         : name, slug, nickname, country
 *   athletes/{id}/records                 : W-L-D
 * Athlete ids are stable, so they're cached on disk and cost ~nothing on
 * subsequent runs.
 *
 * Usage: node scripts/fetch-espn-bouts.cjs [--horizon N] [--max-events N] [--dry]
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EVENT_PATH = path.join(ROOT, 'data', 'event.json');
const CACHE_PATH = path.join(ROOT, 'data', 'espn-athletes.json');
const REPORT_PATH = path.join(ROOT, 'data', 'espn-bouts-report.json');

const args = process.argv.slice(2);
const argN = (flag, def) => { const i = args.indexOf(flag); return i >= 0 ? +args[i + 1] : def; };
const HORIZON_DAYS = argN('--horizon', 120);
const MAX_EVENTS = argN('--max-events', 8);
const DRY = args.includes('--dry');
const ATHLETE_TTL_DAYS = 30;
// A cached athlete not seen on any card for this long is dead weight — a
// retired fighter, or someone who fought once in 2026. Drop them so the cache
// tracks the active roster instead of growing forever.
const ATHLETE_PRUNE_DAYS = 240;
const DAY = 86400000;

const SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard';
const CORE = 'https://sports.core.api.espn.com/v2/sports/mma';

// ── pure helpers (unit-tested; no network) ───────────────────────────────────

const NAME_SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v']);
// NFD decomposes é -> e + accent, but NOT ł, ø, đ, ß … those are distinct
// codepoints with no combining form, so "Błachowicz" would survive as
// "b achowicz" once punctuation is stripped and never match ESPN's
// "Blachowicz". Transliterate them explicitly first.
const TRANSLIT = { 'ł': 'l', 'Ł': 'l', 'ø': 'o', 'Ø': 'o', 'đ': 'd', 'Đ': 'd', 'ð': 'd', 'þ': 'th', 'ß': 'ss', 'æ': 'ae', 'Æ': 'ae', 'œ': 'oe', 'Œ': 'oe', 'ı': 'i', 'ħ': 'h', 'ŧ': 't', 'ĸ': 'k' };
function deburr(s) {
  return String(s || '').replace(/[łŁøØđĐðþßæÆœŒıħŧĸ]/g, (c) => TRANSLIT[c] || c)
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
}
function nameTokens(s) {
  const t = deburr(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  while (t.length > 1 && NAME_SUFFIXES.has(t[t.length - 1])) t.pop();
  return t;
}
function normName(s) { return nameTokens(s).join(' '); }

// Feeds also disagree on given names — Cito "Zachary Reese" vs ESPN "Zach Reese".
// A soft identity of "lastname:first-initial" catches that, while still telling
// Michael Johnson (johnson:m) apart from Anthony Johnson (johnson:a).
function softName(s) {
  const t = nameTokens(s);
  if (!t.length) return '';
  const last = t[t.length - 1];
  const initial = t.length > 1 ? t[0][0] : '';
  return last + ':' + initial;
}
function boutKey(names) { return names.map(normName).sort().join('|'); }
function boutSoftKey(names) { return names.map(softName).sort().join('|'); }
// Two bouts are the same fight if the full names match, or the softer
// lastname+initial identity matches.
function sameBout(namesA, namesB) {
  return boutKey(namesA) === boutKey(namesB) || boutSoftKey(namesA) === boutSoftKey(namesB);
}

const SEGMENTS = {
  'main card': { section: 'Main Card', order: 1 },
  'prelims': { section: 'Prelims', order: 2 },
  'early prelims': { section: 'Early Prelims', order: 3 },
};
function mapSegment(desc) {
  return SEGMENTS[String(desc || '').toLowerCase().trim()] || { section: 'Prelims', order: 2 };
}

function weightClassText(typeText, isTitle) {
  const base = String(typeText || '').trim() || 'Catchweight';
  return isTitle ? `${base} Title Bout` : `${base} Bout`;
}

// ESPN gives ISO alpha-3 in citizenshipCountry.abbreviation. Cito carries emoji
// flags, so map the nations that actually show up on UFC cards; unknown -> null,
// which the app already renders as "no flag".
const A3_FLAG = {
  USA: '🇺🇸', BRA: '🇧🇷', RUS: '🇷🇺', ENG: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', GBR: '🇬🇧', IRL: '🇮🇪', CAN: '🇨🇦', AUS: '🇦🇺',
  NZL: '🇳🇿', MEX: '🇲🇽', ARG: '🇦🇷', CHL: '🇨🇱', PER: '🇵🇪', ECU: '🇪🇨', COL: '🇨🇴', VEN: '🇻🇪',
  FRA: '🇫🇷', GER: '🇩🇪', DEU: '🇩🇪', NED: '🇳🇱', NLD: '🇳🇱', BEL: '🇧🇪', ESP: '🇪🇸', POR: '🇵🇹',
  ITA: '🇮🇹', SUI: '🇨🇭', AUT: '🇦🇹', SWE: '🇸🇪', NOR: '🇳🇴', DEN: '🇩🇰', FIN: '🇫🇮', ISL: '🇮🇸',
  POL: '🇵🇱', CZE: '🇨🇿', SVK: '🇸🇰', UKR: '🇺🇦', BLR: '🇧🇾', GEO: '🇬🇪', ARM: '🇦🇲', AZE: '🇦🇿',
  KAZ: '🇰🇿', UZB: '🇺🇿', KGZ: '🇰🇬', TJK: '🇹🇯', TKM: '🇹🇲', MNG: '🇲🇳', CHN: '🇨🇳', JPN: '🇯🇵',
  KOR: '🇰🇷', PHI: '🇵🇭', PHL: '🇵🇭', THA: '🇹🇭', VIE: '🇻🇳', IND: '🇮🇳', PAK: '🇵🇰', IRN: '🇮🇷',
  IRQ: '🇮🇶', TUR: '🇹🇷', ISR: '🇮🇱', JOR: '🇯🇴', LBN: '🇱🇧', EGY: '🇪🇬', MAR: '🇲🇦', TUN: '🇹🇳',
  NGA: '🇳🇬', CMR: '🇨🇲', RSA: '🇿🇦', ZAF: '🇿🇦', SRB: '🇷🇸', CRO: '🇭🇷', BIH: '🇧🇦', SLO: '🇸🇮',
  ROU: '🇷🇴', BUL: '🇧🇬', GRE: '🇬🇷', HUN: '🇭🇺', MDA: '🇲🇩', LTU: '🇱🇹', LVA: '🇱🇻', EST: '🇪🇪',
  SCO: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', WAL: '🏴󠁧󠁢󠁷󠁬󠁳󠁿', JAM: '🇯🇲', CUB: '🇨🇺', DOM: '🇩🇴', SUR: '🇸🇷', PAN: '🇵🇦',
};
function flagFor(a3) { return A3_FLAG[String(a3 || '').toUpperCase()] || null; }

// Pure: drop athletes whose last appearance on a tracked card is long past.
// Falls back to fetchedAt for entries written before lastSeenAt existed.
function pruneCache(cache, now) {
  now = now || Date.now();
  const athletes = (cache && cache.athletes) || {};
  let dropped = 0;
  for (const id of Object.keys(athletes)) {
    const seen = Date.parse(athletes[id].lastSeenAt || athletes[id].fetchedAt || '');
    if (isFinite(seen) && (now - seen) > ATHLETE_PRUNE_DAYS * DAY) { delete athletes[id]; dropped += 1; }
  }
  return dropped;
}

function parseRecordText(recordText) {
  const m = String(recordText || '').match(/(\d+)-(\d+)-(\d+)/);
  if (!m) return { wins: 0, losses: 0, draws: 0, noContest: 0, text: recordText || '' };
  return { wins: +m[1], losses: +m[2], draws: +m[3], noContest: 0, text: recordText };
}

function buildFighter(boutId, spec, corner) {
  const recordText = spec.recordText || null;
  return {
    id: 'espn-' + spec.slug, boutId,
    fighterSlug: spec.slug, fighterName: spec.name, corner,
    outcome: null, rankText: null, country: spec.country || null,
    odds: null, imageUrl: null, flag: spec.flag || null, championStatus: 'none',
    profile: {
      slug: spec.slug, name: spec.name, nickname: spec.nickname || null,
      championStatus: 'none', division: spec.division || null,
      recordText, record: recordText ? parseRecordText(recordText) : null,
      country: spec.country || null, flag: spec.flag || null,
      headshotUrl: spec.headshot || null, imageUrl: null,
      status: 'Active', isActive: true,
      dataFreshness: null, freshnessStatus: 'espn-reconcile', dataAgeHours: 0,
      dataSource: 'espn-reconcile',
      warning: 'Added by fetch-espn-bouts.js — Cito had not listed this bout.',
    },
  };
}

// Turn one reconciled ESPN bout into a Cito-shaped bout object.
function buildBout(eventSlug, b) {
  const boutId = 'espn-' + b.fighters.map((f) => f.slug).join('-vs-');
  const now = new Date().toISOString();
  return {
    id: boutId, eventSlug,
    cardSection: b.section, cardSectionOrder: b.sectionOrder,
    cardPosition: `${b.section} ${b.position}`,
    boutOrder: b.sectionOrder * 1000 + b.position,
    weightClass: weightClassText(b.weightClass, b.titleBout),
    titleBout: !!b.titleBout,
    status: 'confirmed', isCancelled: false, cancellationReason: null,
    winnerFighterSlug: null, resultRound: 0, resultTime: null,
    method: null, methodDetails: null,
    odds: { red: null, blue: null }, awards: null,
    numberOfRounds: b.rounds || 3,
    dataAvailability: {
      result: 'pending', warning: null, strategy: 'espn-reconcile', warnings: [],
      fetchedAt: now, roundStats: 'ufcstats_enrichment_when_available',
      dataAgeHours: 0, dataFreshness: 'espn-reconcile', fighterCorners: 'available',
    },
    createdAt: now, lastSyncedAt: now,
    fighters: b.fighters.map((f, i) => buildFighter(boutId, f, i === 0 ? 'red' : 'blue')),
    roundStats: [], dataId: boutId, hasStats: false,
    dataFreshness: now, freshnessStatus: 'espn-reconcile', dataAgeHours: 0,
    dataSource: 'espn-reconcile',
    warning: 'Added by fetch-espn-bouts.js — Cito had not listed this bout.',
    boutStats: [],
  };
}

/**
 * Compare one Cito event's bouts against ESPN's. Additive only.
 * espnBouts: [{ section, sectionOrder, position, weightClass, titleBout, rounds,
 *               fighters:[{name,slug,...}] }]
 */
function reconcile(citoEvent, espnBouts) {
  const citoBouts = (citoEvent.bouts || []).filter((b) => (b.fighters || []).length >= 2);
  const citoNames = citoBouts.map((b) => b.fighters.map((f) => f.fighterName));
  const espnNames = espnBouts.map((b) => b.fighters.map((f) => f.name));

  // A fighter already booked elsewhere on this card means the matchup changed;
  // injecting would list them twice. Compare on the soft identity too, so
  // "Zach" and "Zachary" are recognised as the same person.
  const booked = new Set();
  citoBouts.forEach((b) => (b.fighters || []).forEach((f) => { booked.add(normName(f.fighterName)); booked.add(softName(f.fighterName)); }));

  const toInject = [];
  const skipped = [];
  espnBouts.forEach((b, i) => {
    if (citoNames.some((cn) => sameBout(cn, espnNames[i]))) return;   // already on the card
    const clash = b.fighters.find((f) => booked.has(normName(f.name)) || booked.has(softName(f.name)));
    if (clash) { skipped.push({ bout: espnNames[i].join(' vs '), reason: `${clash.name} already booked on this card` }); return; }
    toInject.push(b);
  });

  const onlyInCito = citoBouts
    .filter((b) => !b.isCancelled)
    .filter((b, i) => !espnNames.some((en) => sameBout(en, citoNames[citoBouts.indexOf(b)])))
    .map((b) => b.fighters.map((f) => f.fighterName).join(' vs '));

  return { toInject, onlyInCito, skipped };
}

// ── network layer (runs in CI; unofficial endpoints, all failures non-fatal) ──

async function getJson(url, tries = 3) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 12000);
      const r = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': 'GillyLab/1.0 (https://gillylab.com)' } });
      clearTimeout(t);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) { lastErr = e; await new Promise((s) => setTimeout(s, 400 * (i + 1))); }
  }
  throw lastErr;
}

// The scoreboard calendar hands back refs on an internal host — rewrite it.
function refToId(ref) { const m = /\/events\/(\d+)/.exec(String(ref || '')); return m ? m[1] : null; }

function loadCache() { try { return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')); } catch (e) { return { athletes: {} }; } }

async function getAthlete(id, cache) {
  const hit = cache.athletes[id];
  if (hit && hit.fetchedAt && (Date.now() - Date.parse(hit.fetchedAt)) < ATHLETE_TTL_DAYS * DAY) {
    hit.lastSeenAt = new Date().toISOString();  // keeps them safe from the prune
    return hit;
  }
  const a = await getJson(`${CORE}/athletes/${id}`);
  let recordText = null;
  try {
    const rec = await getJson(`${CORE}/athletes/${id}/records`);
    const overall = (rec.items || []).find((x) => /overall/i.test(x.name || x.type || '')) || (rec.items || [])[0];
    if (overall && overall.summary) recordText = overall.summary + ' (W-L-D)';
  } catch (e) { /* record is optional */ }
  const out = {
    name: a.fullName || a.displayName, slug: a.slug || null, nickname: (a.nickname || '').replace(/^"|"$/g, '') || null,
    country: a.citizenship || null, flag: flagFor(a.citizenshipCountry && a.citizenshipCountry.abbreviation),
    division: (a.weightClass && a.weightClass.text) || null,
    headshot: (a.headshot && a.headshot.href) || null,
    recordText, fetchedAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(),
  };
  cache.athletes[id] = out;
  return out;
}

async function espnBoutsForEvent(eventId, cache) {
  const comps = await getJson(`${CORE}/leagues/ufc/events/${eventId}/competitions?limit=50`);
  const raw = [];
  for (const c of comps.items || []) {
    const seg = mapSegment(c.cardSegment && c.cardSegment.description);
    const ids = (c.competitors || []).sort((a, b) => (a.order || 0) - (b.order || 0)).map((x) => x.id);
    if (ids.length !== 2) continue;
    const fighters = [];
    for (const id of ids) fighters.push(await getAthlete(id, cache));
    if (fighters.some((f) => !f.name || /^opponent tba$|^tba$/i.test(f.name))) continue;  // placeholder slots
    raw.push({
      matchNumber: c.matchNumber || 999,
      section: seg.section, sectionOrder: seg.order,
      weightClass: (c.type && c.type.text) || null,
      titleBout: !!(c.types && c.types.length),
      rounds: (c.format && c.format.regulation && c.format.regulation.periods) || 3,
      lastUpdated: c.lastUpdated || null,
      fighters,
    });
  }
  // matchNumber 1 == main event. Position bouts within their own segment.
  const bySeg = {};
  raw.sort((a, b) => a.matchNumber - b.matchNumber).forEach((b) => {
    bySeg[b.section] = bySeg[b.section] || [];
    b.position = bySeg[b.section].push(b);
  });
  return raw;
}

async function main() {
  let eventDoc;
  try { eventDoc = JSON.parse(fs.readFileSync(EVENT_PATH, 'utf8')); }
  catch (e) { console.error('[espn-bouts] cannot read event.json:', e.message); return; }
  if (!eventDoc || !Array.isArray(eventDoc.data)) { console.log('[espn-bouts] event.json has no .data — skipping.'); return; }

  const cache = loadCache();
  const now = Date.now();
  const upcoming = eventDoc.data
    .filter((e) => e.status !== 'completed')
    .map((e) => ({ e, t: Date.parse(e.startsAt || '') }))
    .filter((x) => isFinite(x.t) && x.t > now - DAY && x.t < now + HORIZON_DAYS * DAY)
    .sort((a, b) => a.t - b.t)
    .slice(0, MAX_EVENTS);

  if (!upcoming.length) { console.log('[espn-bouts] no upcoming events in horizon.'); return; }

  let calendar;
  try {
    const sb = await getJson(SCOREBOARD);
    calendar = ((sb.leagues || [])[0] || {}).calendar || [];
  } catch (e) { console.warn('[espn-bouts] scoreboard fetch failed (non-fatal):', e.message); return; }

  const report = { generatedAt: new Date().toISOString(), events: [], injected: [], onlyInCito: [], skipped: [] };
  let added = 0;

  for (const { e } of upcoming) {
    const day = String(e.startsAt).slice(0, 10);
    const numMatch = /\bUFC\s+(\d{2,4})\b/i.exec(e.title || '');
    // Numbered cards match on the number. Otherwise match on UTC date, allowing
    // ±1 day (a US evening card straddles midnight UTC, so the two feeds can
    // legitimately disagree by a day) — but only when exactly one candidate fits.
    const near = calendar.filter((c) => Math.abs(Date.parse(c.startDate) - Date.parse(e.startsAt)) <= 1.5 * DAY);
    const cal = (numMatch && calendar.find((c) => new RegExp(`\\bUFC\\s+${numMatch[1]}\\b`, 'i').test(c.label || '')))
      || calendar.find((c) => String(c.startDate).slice(0, 10) === day)
      || (near.length === 1 ? near[0] : null);
    const espnId = cal && refToId(cal.event && cal.event.$ref);
    if (!espnId) { console.log(`[espn-bouts] ${e.title} (${day}): no ESPN event matched — skipping.`); continue; }

    let espnBouts;
    try { espnBouts = await espnBoutsForEvent(espnId, cache); }
    catch (err) { console.warn(`[espn-bouts] ${e.title}: competitions fetch failed (non-fatal): ${err.message}`); continue; }
    if (!espnBouts.length) { console.log(`[espn-bouts] ${e.title}: ESPN lists no bouts yet.`); continue; }

    const { toInject, onlyInCito, skipped } = reconcile(e, espnBouts);
    report.events.push({ slug: e.slug, title: e.title, espnId, citoBouts: (e.bouts || []).length, espnBouts: espnBouts.length, injected: toInject.length });

    toInject.forEach((b) => {
      const bout = buildBout(e.slug, b);
      (e.bouts = e.bouts || []).push(bout);
      const label = b.fighters.map((f) => f.name).join(' vs ');
      console.log(`[espn-bouts] ${e.title}: + ${label}  (${b.section})`);
      report.injected.push({ event: e.slug, bout: label, section: b.section });
      added++;
    });
    onlyInCito.forEach((b) => {
      console.warn(`[espn-bouts] ⚠ ${e.title}: Cito lists [${b}] but ESPN does not — likely cancelled. Not removed automatically; verify.`);
      report.onlyInCito.push({ event: e.slug, bout: b });
    });
    skipped.forEach((s) => { console.warn(`[espn-bouts] ⚠ ${e.title}: skipped [${s.bout}] — ${s.reason}`); report.skipped.push(Object.assign({ event: e.slug }, s)); });
  }

  if (DRY) { console.log('[espn-bouts] --dry: not writing.'); return; }
  const dropped = pruneCache(cache);
  if (dropped) console.log(`[espn] pruned ${dropped} athlete(s) not seen on a card in ${ATHLETE_PRUNE_DAYS} days.`);
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2) + '\n');
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + '\n');
  if (added > 0) {
    fs.writeFileSync(EVENT_PATH, JSON.stringify(eventDoc));  // compact, matching the feed
    console.log(`[espn-bouts] injected ${added} bout(s) Cito was missing.`);
  } else {
    console.log('[espn-bouts] card lists already agree — nothing to add.');
  }
}

module.exports = { normName, softName, deburr, pruneCache, boutKey, boutSoftKey, sameBout, mapSegment, weightClassText, flagFor, buildBout, reconcile, refToId };
if (require.main === module) main().catch((e) => { console.error('[espn-bouts] non-fatal error:', e.message); });
