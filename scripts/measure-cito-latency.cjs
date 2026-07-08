#!/usr/bin/env node
/**
 * ONE-OFF DIAGNOSTIC — measure how quickly the Cito API publishes a fight result
 * after the fight actually ends.
 *
 * Motivation: a live/"aftermath" mode (flip each fight's card to the retrospective
 * panel as results land) is only worth building if Cito reports results within
 * minutes. If it batches them hours later, real-time polling buys nothing.
 *
 * How it works: the measure-cito-latency workflow polls the Cito events feed every
 * ~10 min during the target card's window and runs this script. For each bout on
 * the card, we record the FIRST poll at which Cito shows it `completed` with a
 * result — our observed wall-clock time — alongside Cito's own freshness fields
 * (lastSyncedAt / dataAgeHours / dataAvailability.fetchedAt) for cross-reference.
 * After the card, compare firstObservedAt against the real finish times to get the
 * end-to-end latency (which includes our poll cadence) and, via Cito's own
 * timestamps, an estimate of Cito's server-side latency independent of cadence.
 *
 * Append-only + idempotent: re-running on the same payload never overwrites an
 * already-recorded firstObservedAt. Sets `complete:true` once every target bout is
 * final, which the workflow uses to stop calling the API.
 *
 * Usage: node scripts/measure-cito-latency.cjs <citoPayload.json> <log.json>
 */
'use strict';
const fs = require('fs');

const payloadPath = process.argv[2] || 'data/_cito-live.json';
const logPath = process.argv[3] || 'cito-latency-log.json';

function loadJson(p, fallback) {
  try { const s = fs.readFileSync(p, 'utf8').trim(); return s ? JSON.parse(s) : fallback; }
  catch (e) { return fallback; }
}

const nowISO = new Date().toISOString();
const todayUTC = nowISO.slice(0, 10);

const log = loadJson(logPath, null) || {
  measurement: 'cito-result-latency',
  createdAt: nowISO,
  targetDateUTC: todayUTC,
  complete: false,
  polls: [],
  events: {},
};

// Early-stop: if we've already seen every target bout finish, do nothing further.
// (The workflow also checks this flag *before* calling Cito, so a completed
// measurement stops consuming API quota.)
if (log.complete) {
  console.log('[cito-latency] measurement already complete — no-op.');
  process.exit(0);
}

const payload = loadJson(payloadPath, null);
if (!payload) { console.log('[cito-latency] no/empty Cito payload — skipping this poll.'); process.exit(0); }
const events = payload.data || payload || [];

// Target: events happening on the run's UTC date (on 2026-07-12 that's UFC 329).
const boutKey = (b) => (b.fighters || [])
  .map(f => (f.fighterSlug || f.fighterName || '').toLowerCase().replace(/[^a-z0-9]+/g, ''))
  .sort().join('|');

let targetBouts = 0, completedNow = 0, newlyRecorded = 0;

for (const ev of events) {
  const start = String(ev.startsAt || '');
  if (start.slice(0, 10) !== (log.targetDateUTC || todayUTC)) continue;

  const slug = ev.slug || ev.title || 'event';
  const evLog = log.events[slug] || (log.events[slug] = {
    title: ev.title || slug, startsAt: ev.startsAt || null, bouts: {},
  });

  for (const b of ev.bouts || []) {
    const key = boutKey(b);
    if (!key) continue;
    targetBouts++;
    const rec = evLog.bouts[key] || (evLog.bouts[key] = {
      fighters: (b.fighters || []).map(f => f.fighterName),
      cardPosition: b.cardPosition || null,
      boutOrder: b.boutOrder || null,
      firstObservedAt: null,
    });

    const da = b.dataAvailability || {};
    const isFinal = b.status === 'completed' &&
      (b.winnerFighterSlug || b.method || da.result === 'available');
    if (isFinal) completedNow++;

    if (isFinal && !rec.firstObservedAt) {
      rec.firstObservedAt = nowISO;              // our observed wall-clock time
      rec.result = {
        status: b.status,
        winnerFighterSlug: b.winnerFighterSlug || null,
        method: b.method || null,
        methodDetails: b.methodDetails || null,
        resultRound: b.resultRound || null,
        resultTime: b.resultTime || null,
      };
      // Cito's own freshness signals — used to separate Cito's server-side latency
      // from our polling cadence.
      rec.cito = {
        lastSyncedAt: b.lastSyncedAt || null,
        createdAt: b.createdAt || null,
        dataAgeHours: (b.dataAgeHours != null ? b.dataAgeHours : null),
        dataFreshness: b.dataFreshness || null,
        fetchedAt: da.fetchedAt || null,
      };
      newlyRecorded++;
    }
  }
}

log.polls.push({ at: nowISO, targetBouts, completed: completedNow, newlyRecorded });

// Mark complete only once we've actually seen bouts AND every one is final.
if (targetBouts > 0 && completedNow >= targetBouts) log.complete = true;

fs.writeFileSync(logPath, JSON.stringify(log, null, 2) + '\n');
console.log(`[cito-latency] poll @ ${nowISO} — target=${targetBouts} completed=${completedNow} new=${newlyRecorded} complete=${log.complete}`);
