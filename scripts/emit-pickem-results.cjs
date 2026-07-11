#!/usr/bin/env node
'use strict';
/*
 * Emit data/pickem-results.json — the finalized results the Worker grades pick'em
 * against. Scans completed events in data/event.json + data/event-recent.json and
 * records, per FULLY-FINAL event, each decided bout's winner / method / round.
 *
 * Only fully-final events are written (every non-cancelled bout decided), because
 * the Worker grades an event exactly once — a half-final emit would freeze a card
 * mid-grade. Merge-updates by slug and keeps the most recent ~40 events.
 *
 * Runs in the results / update-odds workflows. Non-fatal by design.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'pickem-results.json');
const KEEP = 40;

const norm = (o) => String(o || '').toLowerCase().replace(/_/g, ' ');
function readEvents(file) {
  try { const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', file), 'utf8')); return (j && (j.data || j)) || []; }
  catch (e) { return []; }
}

// Every non-cancelled bout must be decided for the card to count as final.
function isFinal(ev) {
  const live = (ev.bouts || []).filter(b => b && !b.isCancelled);
  if (!live.length) return false;
  return live.every(b => {
    if (b.status !== 'completed') return false;
    const outs = (b.fighters || []).map(f => norm(f.outcome));
    return outs.some(o => o === 'win') || outs.some(o => o === 'draw' || o === 'nc' || o === 'no contest') || !!b.winnerFighterSlug;
  });
}

function boutResult(b) {
  const red = (b.fighters || []).find(f => f.corner === 'red') || (b.fighters || [])[0] || {};
  const blue = (b.fighters || []).find(f => f.corner === 'blue') || (b.fighters || [])[1] || {};
  const f1 = red.fighterName || '', f2 = blue.fighterName || '';
  if (!f1 || !f2) return null;
  const ro = norm(red.outcome), bo = norm(blue.outcome);
  const draw = ro === 'draw' || bo === 'draw' || ro === 'nc' || bo === 'nc' || ro === 'no contest' || bo === 'no contest';
  let winner = null;
  if (ro === 'win') winner = f1;
  else if (bo === 'win') winner = f2;
  else if (b.winnerFighterSlug) {
    if (red.fighterSlug === b.winnerFighterSlug) winner = f1;
    else if (blue.fighterSlug === b.winnerFighterSlug) winner = f2;
  }
  if (!winner) return { f1, f2, voided: true };           // draw / no-contest / undetermined
  return { f1, f2, winner, method: b.method || '', round: b.resultRound != null ? Number(b.resultRound) : null, voided: false };
}

function eventResult(ev) {
  const bouts = (ev.bouts || []).filter(b => b && !b.isCancelled && b.status === 'completed')
    .map(boutResult).filter(Boolean);
  if (!bouts.length) return null;
  const dateStr = ev.startsAt ? new Date(ev.startsAt).toISOString().slice(0, 10) : '';
  return { slug: ev.slug || dateStr, name: ev.title || ev.shortTitle || 'UFC Event', date: dateStr, bouts };
}

function main() {
  const seen = new Set(), events = [];
  // event.json first (the just-finished featured card), then the recent archive.
  for (const ev of [...readEvents('event.json'), ...readEvents('event-recent.json')]) {
    if (!ev || !ev.slug || seen.has(ev.slug)) continue;
    if (!isFinal(ev)) continue;
    const r = eventResult(ev);
    if (r) { seen.add(ev.slug); events.push(r); }
  }

  // Merge with what's already on disk (older cards that have rolled out of the feeds).
  let prev = { events: [] };
  try { prev = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) { /* first run */ }
  const byslug = new Map();
  (prev.events || []).forEach(e => e && e.slug && byslug.set(e.slug, e));
  events.forEach(e => byslug.set(e.slug, e));                // fresh emit wins

  const merged = [...byslug.values()]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, KEEP);

  fs.writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), events: merged }, null, 2) + '\n');
  console.log(`pickem-results.json: ${merged.length} final events (${events.length} from live feeds this run)`);
}

if (require.main === module) main();
module.exports = { isFinal, boutResult, eventResult };
