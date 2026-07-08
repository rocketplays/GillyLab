#!/usr/bin/env node
/* Phase-0 prediction logger.
 *
 * PURPOSE — bank a timestamped time-series of (model projection, market price)
 * for every upcoming, bettable UFC fight, so that later we can measure the
 * model's CALIBRATION and CLOSING-LINE VALUE against reality. This captures the
 * one input we can't backfill later: what the model thought, at a point in time,
 * BEFORE the line moved and before the fight resolved.
 *
 * It is capture-only. No analysis, no public output, no claims. Each run appends
 * one snapshot per fight to data/predictions-log.json. Run it on a schedule (the
 * update-odds workflow runs twice daily), so a fight accumulates a series of
 * snapshots across the week — the first is an opener proxy, the last before
 * walkouts a closer proxy.
 *
 * Model side: the EXACT production win-probability formula, extracted from
 * index.html by scripts/sim-backtest/extract-sim.cjs into _scorer.cjs. Run that
 * first so the scorer reflects the live model. Rankings are wired from
 * data/rankings.json so the number matches what the site shows.
 *
 * Market side: consensus (median, de-vigged) h2h implied probability across the
 * books in data/odds.json (the-odds-api). Totals (rounds O/U) captured too.
 *
 * NOTE: free-tier the-odds-api gives only CURRENT odds, so our opener/closer are
 * self-snapshotted approximations. When the paid history tier is added, the
 * accurate opener/closer feed slots in here without changing the schema.
 *
 * Usage: node scripts/log-predictions.cjs [--min-interval-hours N] [--dry-run]
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SIM_DIR = path.join(__dirname, 'sim-backtest');
const LOG_PATH = path.join(ROOT, 'data', 'predictions-log.json');

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const MIN_INTERVAL_H = (() => { const i = args.indexOf('--min-interval-hours'); return i >= 0 ? +args[i + 1] : 3; })();

// ---------- helpers ----------
function readJSON(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; } }
// Aggressive normalization for matching across feeds (case/accents/punct/suffixes).
const SUFFIX = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v']);
function norm(s) {
  return String(s == null ? '' : s).toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}
function tokens(s) { return norm(s).split(' ').filter(t => t && !SUFFIX.has(t)); }
function impliedFromAmerican(a) { return a < 0 ? (-a) / ((-a) + 100) : 100 / (a + 100); }
function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((x, y) => x - y); const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function pairId(a, b) { return [norm(a), norm(b)].sort().join('|'); }

// ---------- model: extracted production scorer ----------
let scorer = null, dbNames = [], dbByNorm = new Map();
function loadScorer() {
  const createScorer = require(path.join(SIM_DIR, '_scorer.cjs'));
  const data = require(path.join(SIM_DIR, '_sim-data.json'));
  scorer = createScorer(data.FIGHTER_STATS, data.FIGHT_HISTORY, data.FIGHTERS);
  scorer.setNow(Date.now());
  dbNames = Object.keys(data.FIGHTER_STATS);
  dbByNorm = new Map(dbNames.map(n => [norm(n), n]));
  // rankings -> badge, faithful to buildRankLookupFromPayload in index.html
  const ranks = readJSON(path.join(ROOT, 'data', 'rankings.json'));
  const lookup = {};
  if (ranks && Array.isArray(ranks.data)) {
    for (const e of ranks.data) {
      if ((e.division || '').indexOf('Pound-for-Pound') !== -1) continue;
      let label;
      if (e.isChampion) {
        const interim = e.championStatus === 'interim' || (e.fighter && e.fighter.championStatus === 'interim');
        label = interim ? 'IC' : 'C';
      } else label = e.rank != null ? '#' + e.rank : '';
      if (!label) continue;
      const k = norm(e.fighterName); if (k) lookup[k] = label;
    }
  }
  scorer.setRankBadge(name => lookup[norm(name)] || null);
}
// Resolve a feed name to a DB (FIGHTER_STATS) key: exact-normalized, else an
// UNAMBIGUOUS token-subset match (handles suffixes / extra or missing surnames,
// e.g. "Kai Kamaka" <-> "Kai Kamaka III", "Ian Garry" <-> "Ian Machado Garry").
function resolveDB(name) {
  const nn = norm(name);
  if (dbByNorm.has(nn)) return dbByNorm.get(nn);
  const t = tokens(name); if (!t.length) return null;
  const cands = [];
  for (const dn of dbNames) {
    const dt = tokens(dn); if (!dt.length) continue;
    if (t.every(x => dt.includes(x)) || dt.every(x => t.includes(x))) cands.push(dn);
  }
  if (cands.length === 1) return cands[0];
  if (cands.length > 1) {
    // Tie-break: prefer the candidate whose surname (last token) matches the
    // feed name's last token — e.g. "Paulo Henrique Costa" -> "Paulo Costa",
    // not the unrelated "Paulo Henrique". Only accept if it's now unambiguous.
    const lastTok = t[t.length - 1];
    const byLast = cands.filter(dn => { const dt = tokens(dn); return dt[dt.length - 1] === lastTok; });
    if (byLast.length === 1) return byLast[0];
  }
  return null;
}

// ---------- rounds / card context from event.json ----------
function buildBoutIndex(eventJson) {
  const idx = new Map();
  const evs = (eventJson && (eventJson.data || eventJson)) || [];
  for (const ev of evs) {
    const bouts = ev.bouts || [];
    let minOrder = Infinity;
    for (const b of bouts) if (typeof b.boutOrder === 'number' && b.boutOrder < minOrder) minOrder = b.boutOrder;
    for (const b of bouts) {
      const names = (b.fighters || []).map(f => f.fighterName).filter(Boolean);
      if (names.length < 2) continue;
      const isHeadliner = b.boutOrder === minOrder;
      const rounds = (b.titleBout || isHeadliner) ? 5 : 3;
      idx.set(pairId(names[0], names[1]), {
        rounds, weightClass: b.weightClass || null, cardSection: b.cardSection || null,
        titleBout: !!b.titleBout, eventTitle: ev.title || null
      });
    }
  }
  return idx;
}

// ---------- market consensus from odds.json ----------
function marketConsensus(ev) {
  const home = ev.home_team, away = ev.away_team;
  const devigHome = [], homePrices = [], awayPrices = [];
  const totalPoints = [], overPrices = [], underPrices = [];
  for (const bk of ev.bookmakers || []) {
    for (const mk of bk.markets || []) {
      if (mk.key === 'h2h') {
        const oh = (mk.outcomes || []).find(o => o.name === home);
        const oa = (mk.outcomes || []).find(o => o.name === away);
        if (oh && oa && typeof oh.price === 'number' && typeof oa.price === 'number') {
          const ih = impliedFromAmerican(oh.price), ia = impliedFromAmerican(oa.price);
          if (ih + ia > 0) devigHome.push(ih / (ih + ia));
          homePrices.push(oh.price); awayPrices.push(oa.price);
        }
      } else if (mk.key === 'totals') {
        const over = (mk.outcomes || []).find(o => /over/i.test(o.name));
        const under = (mk.outcomes || []).find(o => /under/i.test(o.name));
        if (over && typeof over.point === 'number') { totalPoints.push(over.point); overPrices.push(over.price); }
        if (under && typeof under.price === 'number') underPrices.push(under.price);
      }
    }
  }
  if (!devigHome.length) return null;
  const impliedA = median(devigHome);
  const totalsPoint = median(totalPoints);
  return {
    nBooks: devigHome.length,
    priceA: median(homePrices), priceB: median(awayPrices),
    impliedA: round4(impliedA), impliedB: round4(1 - impliedA),
    totals: totalsPoint != null ? {
      point: totalsPoint, overPrice: median(overPrices), underPrice: median(underPrices), nBooks: totalPoints.length
    } : null
  };
}
function round4(x) { return x == null ? null : Math.round(x * 1e4) / 1e4; }

// ---------- main ----------
function main() {
  const odds = readJSON(path.join(ROOT, 'data', 'odds.json'));
  if (!Array.isArray(odds)) { console.error('odds.json missing or not an array; aborting.'); process.exit(0); }
  const eventJson = readJSON(path.join(ROOT, 'data', 'event.json'));
  const boutIdx = buildBoutIndex(eventJson);
  loadScorer();

  const log = readJSON(LOG_PATH) || { schemaVersion: 1, createdAt: new Date().toISOString(), lastRun: null, snapshots: [] };
  // latest snapshot timestamp per fightId, to skip near-duplicate runs
  const lastByFight = new Map();
  for (const s of log.snapshots) {
    const t = Date.parse(s.capturedAt);
    if (!lastByFight.has(s.fightId) || t > lastByFight.get(s.fightId)) lastByFight.set(s.fightId, t);
  }

  const now = Date.now();
  const capturedAt = new Date(now).toISOString();
  const added = [];
  let skippedRecent = 0, unmatchedModel = 0;

  for (const ev of odds) {
    const home = ev.home_team, away = ev.away_team;
    if (!home || !away) continue;
    // only upcoming fights
    const commence = Date.parse(ev.commence_time);
    if (isFinite(commence) && commence < now) continue;

    const fightId = pairId(home, away);
    const last = lastByFight.get(fightId);
    if (last && (now - last) < MIN_INTERVAL_H * 3600 * 1000) { skippedRecent++; continue; }

    const market = marketConsensus(ev);
    if (!market) continue; // no h2h prices -> nothing to log

    const ctx = boutIdx.get(fightId) || {};
    const rounds = ctx.rounds || 3;

    const dbA = resolveDB(home), dbB = resolveDB(away);
    let model = null, edgeA = null;
    if (dbA && dbB) {
      try {
        const pA = scorer.simWinProbability(dbA, dbB, rounds);
        if (typeof pA === 'number' && isFinite(pA)) {
          model = { pA: round4(pA), pB: round4(1 - pA) };
          if (market.impliedA != null) edgeA = round4(pA - market.impliedA);
        }
      } catch (e) { /* leave model null */ }
    }
    if (!model) unmatchedModel++;

    added.push({
      capturedAt,
      event: ctx.eventTitle || ev.sport_title || null,
      commenceTime: ev.commence_time || null,
      fightId,
      cardSection: ctx.cardSection || null,
      weightClass: ctx.weightClass || null,
      titleBout: !!ctx.titleBout,
      rounds,
      a: { feed: home, db: dbA || null },
      b: { feed: away, db: dbB || null },
      model,
      market,
      edgeA
    });
  }

  log.snapshots.push(...added);
  log.lastRun = capturedAt;

  console.log(`captured ${added.length} snapshot(s) | skipped ${skippedRecent} recent | ${unmatchedModel} without model (unmatched)`);
  if (added.length) {
    const withModel = added.filter(s => s.model);
    console.log(`  fights with model projection: ${withModel.length}/${added.length}`);
    withModel.slice(0, 6).forEach(s => {
      const eg = s.edgeA == null ? '' : ` edge(A)=${(s.edgeA * 100 >= 0 ? '+' : '') + (s.edgeA * 100).toFixed(1)}%`;
      console.log(`   ${s.a.feed} vs ${s.b.feed}: model ${(s.model.pA * 100).toFixed(1)}% / market ${(s.market.impliedA * 100).toFixed(1)}%${eg}`);
    });
  }
  if (DRY) { console.log('[dry-run] not writing.'); return; }
  fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2) + '\n');
  console.log(`wrote ${LOG_PATH} (${log.snapshots.length} total snapshots)`);
}
main();
