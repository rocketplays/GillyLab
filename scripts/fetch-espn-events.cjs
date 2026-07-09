#!/usr/bin/env node
/**
 * Builds data/event.json (upcoming) and data/event-recent.json (past + results)
 * entirely from ESPN, in the exact shape the Cito feed produced.
 *
 * Why this replaces Cito: measured against ESPN on 2026-07-09, the Cito feed
 *   - omitted a whole card (2026-08-08) and shipped two others with zero bouts;
 *   - was ~10 days stale on bout sync (lastSyncedAt 2026-06-29);
 *   - returned EVERY bout twice (26 objects for 13 matchups on the Jun 27 card),
 *     with the duplicates disagreeing: one copy said "Submission" with
 *     methodDetails null, the other said "SUB" with "Suloev Stretch";
 *   - mislabelled that card as "UFC 317".
 * ESPN carries the finish detail natively, has one object per bout, and exposes
 * a live period/clock during the card.
 *
 * ESPN's endpoints are undocumented and unofficial. Everything here is
 * defensive: a failed event is skipped rather than fatal, and callers should
 * treat a suspiciously empty result as a fetch problem, not an empty card.
 *
 * Endpoints (no key, no quota):
 *   events?dates=YYYYMMDD-YYYYMMDD  -> event $refs in a window
 *   events/{id}                     -> name, date, venue
 *   events/{id}/competitions        -> bouts (segment, matchNumber, weight, format)
 *   .../competitions/{cid}/status   -> state, period, clock, result{method,detail}
 *   athletes/{id}, /records         -> profile + W-L-D
 *
 * Usage: node scripts/fetch-espn-events.cjs [--past N] [--future N] [--out DIR] [--dry]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const B = require('./fetch-espn-bouts.cjs');   // shared, tested helpers (no side effects on require)

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const argN = (f, d) => { const i = args.indexOf(f); return i >= 0 ? +args[i + 1] : d; };
const argS = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const PAST_DAYS = argN('--past', 150);
const FUTURE_DAYS = argN('--future', 180);
const OUT_DIR = path.resolve(ROOT, argS('--out', 'data'));
const DRY = args.includes('--dry');
const CONCURRENCY = 6;

const CORE = 'https://sports.core.api.espn.com/v2/sports/mma';
const LEAGUE = `${CORE}/leagues/ufc`;
const CACHE_PATH = path.join(ROOT, 'data', 'espn-athletes.json');
const EVENT_CACHE_PATH = path.join(ROOT, 'data', 'espn-event-cache.json');

// ESPN's public host is sports.core.api.espn.com, but $ref values often point at
// the internal .pvt host, which does not resolve. Rewrite every ref we follow.
const fixRef = (u) => String(u || '').replace('sports.core.api.espn.pvt', 'sports.core.api.espn.com').replace(/^http:/, 'https:');

async function getJson(url, tries = 3) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 15000);
      const r = await fetch(fixRef(url), { signal: ctl.signal, headers: { 'User-Agent': 'GillyLab/1.0 (https://gillylab.com)' } });
      clearTimeout(t);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) { lastErr = e; await new Promise((s) => setTimeout(s, 400 * (i + 1))); }
  }
  throw lastErr;
}

// Small fixed-size worker pool. ESPN is unmetered but not ours to hammer.
async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

const loadJson = (p, d) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return d; } };
const ymd = (d) => new Date(d).toISOString().slice(0, 10).replace(/-/g, '');

// ── pure: translate ESPN vocabulary into the shape the app already parses ─────

// ESPN: result.displayName "KO/TKO" | "Submission" | "Decision - Unanimous",
// result.description "Punches" | "Suloev Stretch" | "" (decisions repeat the name).
// Cito emitted the same long forms, so index.html's mcat() already understands them.
function methodOf(result) {
  if (!result) return { method: null, methodDetails: null };
  const method = result.displayName || result.name || null;
  let detail = result.description || null;
  if (detail && method && detail.toLowerCase() === method.toLowerCase()) detail = null;
  if (method && /^decision/i.test(method)) detail = null;   // "Decision - Unanimous" needs no detail
  return { method, methodDetails: detail };
}

// "4:28" from ESPN's displayClock, but a decision that goes the distance reports
// the clock at 5:00 of the final round, which is what Cito stored too.
function resultTimeOf(status) {
  if (!status || !status.type || !status.type.completed) return null;
  return status.displayClock || null;
}

function boutStatusOf(status) {
  const st = (status && status.type) || {};
  if (st.completed) return 'completed';
  if (st.state === 'in') return 'live';
  return 'confirmed';
}

function eventStatusOf(bouts, startsAt) {
  if (bouts.length && bouts.every((b) => b.status === 'completed')) return 'completed';
  if (bouts.some((b) => b.status === 'live' || b.status === 'completed')) return 'live';
  return Date.parse(startsAt) < Date.now() ? 'completed' : 'scheduled';
}

function parseRecordText(t) {
  const m = String(t || '').match(/(\d+)-(\d+)-(\d+)/);
  if (!m) return { wins: 0, losses: 0, draws: 0, noContest: 0, text: t || '' };
  return { wins: +m[1], losses: +m[2], draws: +m[3], noContest: 0, text: t };
}

// ── athletes (cached on disk; ids are stable so repeat runs are ~free) ────────
async function getAthlete(ref, cache) {
  const id = (/\/athletes\/(\d+)/.exec(String(ref)) || [])[1];
  if (!id) return null;
  const hit = cache.athletes[id];
  if (hit && hit.fetchedAt && (Date.now() - Date.parse(hit.fetchedAt)) < 30 * 86400000) {
    hit.lastSeenAt = new Date().toISOString();
    return hit;
  }
  const a = await getJson(`${CORE}/athletes/${id}`);
  let recordText = null;
  try {
    const rec = await getJson(`${CORE}/athletes/${id}/records`);
    const o = (rec.items || []).find((x) => /overall/i.test(x.name || x.type || '')) || (rec.items || [])[0];
    if (o && o.summary) recordText = o.summary + ' (W-L-D)';
  } catch (e) { /* record optional */ }
  const out = {
    name: a.fullName || a.displayName,
    slug: a.slug || null,
    nickname: (a.nickname || '').replace(/^"|"$/g, '') || null,
    country: a.citizenship || null,
    flag: B.flagFor(a.citizenshipCountry && a.citizenshipCountry.abbreviation),
    division: (a.weightClass && a.weightClass.text) || null,
    headshot: (a.headshot && a.headshot.href) || null,
    recordText,
    fetchedAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(),
  };
  cache.athletes[id] = out;
  return out;
}

function buildFighter(boutId, spec, corner, outcome) {
  return {
    id: 'espn-' + spec.slug, boutId,
    fighterSlug: spec.slug, fighterName: spec.name, corner,
    outcome, rankText: null, country: spec.country || null,
    odds: null, imageUrl: null, flag: spec.flag || null, championStatus: 'none',
    profile: {
      slug: spec.slug, name: spec.name, nickname: spec.nickname || null,
      championStatus: 'none', division: spec.division || null,
      recordText: spec.recordText, record: spec.recordText ? parseRecordText(spec.recordText) : null,
      country: spec.country || null, flag: spec.flag || null,
      headshotUrl: spec.headshot || null, imageUrl: null,
      status: 'Active', isActive: true,
      dataFreshness: null, freshnessStatus: 'espn', dataAgeHours: 0, dataSource: 'espn',
      warning: null,
    },
  };
}

// ── one event, fully built ───────────────────────────────────────────────────
async function buildEventFull(espnId, cache) {
  const ev = await getJson(`${LEAGUE}/events/${espnId}`);
  const label = ev.name || ev.shortName || 'UFC Fight Night';
  const startsAt = new Date(ev.date).toISOString();

  let venue = null;
  try {
    const vref = ((ev.venues || [])[0] || {}).$ref;
    if (vref) { const v = await getJson(vref); venue = { fullName: v.fullName || null, address: v.address || {} }; }
  } catch (e) { /* cosmetic */ }

  const slug = B.eventSlugFor(label, startsAt);
  const comps = await getJson(`${LEAGUE}/events/${espnId}/competitions?limit=50`);

  const raw = (await pool(comps.items || [], CONCURRENCY, async (it) => {
    let c;
    try { c = await getJson(it.$ref); } catch (e) { return null; }
    const ids = (c.competitors || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    if (ids.length !== 2) return null;

    let status = null;
    try { status = await getJson(c.status.$ref); } catch (e) { /* upcoming bouts may lack it */ }

    const fighters = [];
    for (const cc of ids) {
      const a = await getAthlete(cc.athlete && cc.athlete.$ref, cache);
      if (!a || !a.name) return null;
      fighters.push({ spec: a, winner: cc.winner === true });
    }
    // ESPN publishes placeholder slots for unannounced fights.
    if (fighters.some((f) => /^(opponent )?tba$/i.test(f.spec.name))) return null;

    const seg = B.mapSegment(c.cardSegment && c.cardSegment.description);
    const { method, methodDetails } = methodOf(status && status.result);
    return {
      matchNumber: c.matchNumber || 999,
      section: seg.section, sectionOrder: seg.order,
      weightClass: B.weightClassText((c.type && c.type.text) || '', !!(c.types && c.types.length)),
      titleBout: !!(c.types && c.types.length),
      numberOfRounds: (c.format && c.format.regulation && c.format.regulation.periods) || 3,
      status: boutStatusOf(status),
      resultRound: (status && status.type && status.type.completed) ? (status.period || 0) : 0,
      resultTime: resultTimeOf(status),
      method, methodDetails,
      lastUpdated: c.lastUpdated || null,
      fighters,
    };
  })).filter(Boolean);

  // matchNumber 1 is the main event. Order within each segment.
  const bySeg = {};
  raw.sort((a, b) => a.matchNumber - b.matchNumber).forEach((b) => {
    bySeg[b.section] = bySeg[b.section] || [];
    b.position = bySeg[b.section].push(b);
  });

  const now = new Date().toISOString();
  const bouts = raw.map((b) => {
    const boutId = 'espn-' + b.fighters.map((f) => f.spec.slug).join('-vs-');
    const win = b.fighters.find((f) => f.winner);
    const decided = b.status === 'completed';
    return {
      id: boutId, eventSlug: slug,
      cardSection: b.section, cardSectionOrder: b.sectionOrder,
      cardPosition: `${b.section} ${b.position}`,
      boutOrder: b.sectionOrder * 1000 + b.position,
      weightClass: b.weightClass, titleBout: b.titleBout,
      numberOfRounds: b.numberOfRounds,
      status: b.status, isCancelled: false, cancellationReason: null,
      winnerFighterSlug: win ? win.spec.slug : null,
      resultRound: b.resultRound, resultTime: b.resultTime,
      method: b.method, methodDetails: b.methodDetails,
      odds: { red: null, blue: null }, awards: null,
      dataAvailability: { result: decided ? 'available' : 'pending', warning: null, strategy: 'espn', fetchedAt: now, roundStats: 'ufcstats_enrichment_when_available', dataAgeHours: 0, dataFreshness: 'espn', fighterCorners: 'available' },
      createdAt: now, lastSyncedAt: b.lastUpdated || now,
      fighters: b.fighters.map((f, i) => buildFighter(
        boutId, f.spec, i === 0 ? 'red' : 'blue',
        decided ? (f.winner ? 'win' : (win ? 'loss' : 'draw')) : null,
      )),
      roundStats: [], dataId: boutId, hasStats: false,
      dataFreshness: b.lastUpdated || now, freshnessStatus: 'espn', dataAgeHours: 0,
      dataSource: 'espn', warning: null, boutStats: [],
    };
  });

  const addr = (venue && venue.address) || {};
  const city = [addr.city, addr.state || addr.country].filter(Boolean).join(' ') || null;
  return {
    id: 'espn-' + espnId, slug,
    title: B.eventTitleFor(label), shortTitle: B.eventTitleFor(label),
    espnName: label,   // the full "UFC Fight Night: Fiziev vs Torres" headline, for reference
    status: eventStatusOf(bouts, startsAt), startsAt,
    venue: (venue && venue.fullName) || null, city,
    state: addr.state || null, country: addr.country || null,
    locationText: [(venue && venue.fullName), city].filter(Boolean).join(', ') || null,
    imageUrl: null, broadcastInfo: { raw: '' },
    dataAvailability: { bouts: bouts.length ? 'available' : 'missing', warning: null, strategy: 'espn', fetchedAt: now, dataAgeHours: 0, dataFreshness: 'espn' },
    createdAt: now, lastSyncedAt: now, dataId: 'espn-' + espnId,
    hasStats: false, dataFreshness: now, freshnessStatus: 'espn', dataAgeHours: 0,
    dataSource: 'espn', warning: null,
    bouts,
  };
}

async function eventIdsBetween(fromMs, toMs) {
  const idx = await getJson(`${LEAGUE}/events?dates=${ymd(fromMs)}-${ymd(toMs)}&limit=200`);
  return (idx.items || []).map((i) => (/\/events\/(\d+)/.exec(fixRef(i.$ref)) || [])[1]).filter(Boolean);
}

async function main() {
  const cache = loadJson(CACHE_PATH, { athletes: {} });
  cache.athletes = cache.athletes || {};
  const evCache = loadJson(EVENT_CACHE_PATH, { events: {} });
  evCache.events = evCache.events || {};

  const now = Date.now();
  const DAY = 86400000;
  const pastIds = await eventIdsBetween(now - PAST_DAYS * DAY, now);
  const futureIds = await eventIdsBetween(now, now + FUTURE_DAYS * DAY);
  const ids = [...new Set([...pastIds, ...futureIds])];
  console.log(`[espn-events] ${ids.length} event(s) in window (-${PAST_DAYS}d .. +${FUTURE_DAYS}d)`);

  let fromCache = 0;
  const built = (await pool(ids, 3, async (id) => {
    // A finished card never changes. Serve it from disk and skip ~26 calls.
    const c = evCache.events[id];
    if (c && c.status === 'completed' && Date.parse(c.startsAt) < now - 2 * DAY) { fromCache++; return c; }
    try { return await buildEventFull(id, cache); }
    catch (e) { console.warn(`[espn-events] event ${id} failed (skipped): ${e.message}`); return null; }
  })).filter(Boolean);

  built.forEach((e) => { if (e.status === 'completed') evCache.events[e.id.replace('espn-', '')] = e; });
  console.log(`[espn-events] built ${built.length} (${fromCache} served from cache)`);

  const upcoming = built.filter((e) => e.status !== 'completed').sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const recent = built.filter((e) => e.status === 'completed').sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt)).slice(0, 20);

  console.log(`[espn-events] upcoming ${upcoming.length} (${upcoming.reduce((n, e) => n + e.bouts.length, 0)} bouts) · recent ${recent.length} (${recent.reduce((n, e) => n + e.bouts.length, 0)} bouts)`);

  // Refuse to write a suspiciously empty feed over a good one: an ESPN hiccup
  // must never blank the site's card list.
  if (!upcoming.length) { console.error('[espn-events] ABORT: zero upcoming events — treating as a fetch failure, leaving files untouched.'); process.exitCode = 0; return; }

  if (DRY) { console.log('[espn-events] --dry: not writing.'); return; }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'event.json'), JSON.stringify({ data: upcoming }));
  fs.writeFileSync(path.join(OUT_DIR, 'event-recent.json'), JSON.stringify({ data: recent }));
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2) + '\n');
  fs.writeFileSync(EVENT_CACHE_PATH, JSON.stringify(evCache));
  console.log(`[espn-events] wrote ${OUT_DIR}/event.json + event-recent.json`);
}

module.exports = { methodOf, resultTimeOf, boutStatusOf, eventStatusOf, parseRecordText, buildEventFull, fixRef };
if (require.main === module) main().catch((e) => { console.error('[espn-events] fatal:', e.message); process.exit(1); });
