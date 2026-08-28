#!/usr/bin/env node
/**
 * Sync the FIGHTERS roster's `rank` (and, for ranked fighters, `division`) in
 * index.html from data/rankings.json.
 *
 * Why this exists: index.html's FIGHTERS array was hand-maintained while
 * data/rankings.json auto-syncs from the UFC media panel. They drifted. At the
 * time this was written 39 ranked fighters disagreed, and the damage was not
 * cosmetic:
 *   - Alex Pereira was still '#C' at light heavyweight, a belt Carlos Ulberg
 *     holds. The division claimed TWO champions.
 *   - Tom Aspinall, the heavyweight champion, was 'NR'.
 *   - Justin Gaethje held the lightweight belt but was marked '#IC' (interim),
 *     while Ilia Topuria was still '#C'.
 *   - Carlos Ulberg was stored as 'C' rather than '#C'. The search's champion
 *     filter is `f.rank === '#C'`, so the real champion was invisible to it
 *     while the ex-champion showed up.
 * openFighter() also resolves a fighter's division from his rank, so a stale
 * rank silently files a fighter under the wrong weight class.
 *
 * rankings.json is the source of truth. This script never invents a rank: a
 * fighter absent from the (non-P4P) rankings becomes 'NR'.
 *
 * Usage: node scripts/sync-fighter-ranks.cjs [--dry]
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const IDX = path.join(ROOT, 'index.html');
const RANKS = path.join(ROOT, 'data', 'rankings.json');
const DRY = process.argv.includes('--dry');

// FIGHTERS stores divisions abbreviated; rankings.json spells them out.
const ABBR = {
  'Flyweight': 'FLW', 'Bantamweight': 'BW', 'Featherweight': 'FW', 'Lightweight': 'LW',
  'Welterweight': 'WW', 'Middleweight': 'MW', 'Light Heavyweight': 'LHW', 'Heavyweight': 'HW',
  "Women's Strawweight": 'WSW', "Women's Flyweight": 'WFLW', "Women's Bantamweight": 'WBW',
  "Women's Featherweight": 'WFW',
};

// Match on a folded name: rankings.json and FIGHTERS disagree on accents in
// places (Jiří Procházka, Jan Błachowicz, Lone'er Kavanagh).
const TRANSLIT = { 'ł': 'l', 'Ł': 'l', 'ø': 'o', 'đ': 'd', 'ð': 'd', 'ß': 'ss', 'æ': 'ae', 'œ': 'oe', 'ı': 'i' };
const fold = (s) => String(s || '')
  .replace(/[łŁøđðßæœı]/g, (c) => TRANSLIT[c] || c)
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]/g, '');

// Fighters the two sources name differently. Folding accents is not enough when
// one side uses a ring name: rankings.json says "Patricio Freire", FIGHTERS says
// "Patrício Pitbull". Without this he silently drops from #15 to NR — a demotion
// invented by a name mismatch, which is exactly the failure this script exists to
// prevent. Any ranked name that matches nothing is reported, never guessed at.
const ALIASES = {
  'patriciofreire': 'patriciopitbull',
  'michaelvenompage': 'michaelpage',
};
const key = (s) => { const f = fold(s); return ALIASES[f] || f; };

function main() {
  const idx = fs.readFileSync(IDX, 'utf8');
  const rows = JSON.parse(fs.readFileSync(RANKS, 'utf8')).data;

  // Pound-for-pound is not a weight class; a P4P entry must never set a division.
  const ranked = rows.filter((r) => r && r.division && !/pound/i.test(r.division));

  const truth = new Map();       // folded name -> { div, rank, name }
  for (const r of ranked) {
    const div = ABBR[r.division];
    if (!div) continue;          // unknown division: leave the roster alone
    const rank = r.isChampion
      ? (String(r.championStatus).toLowerCase() === 'interim' ? '#IC' : '#C')
      : (r.rank == null ? null : '#' + r.rank);
    if (!rank) continue;
    truth.set(key(r.fighterName), { div, rank, name: r.fighterName });
  }

  const changes = [];
  const unmatched = [];
  const seen = new Set();

  // Rewrite only the three fields, in place, one roster row at a time.
  const out = idx.replace(
    /(\{ name: ")([^"]+)(", division: ")([^"]*)(", rank: ")([^"]*)(")/g,
    (whole, p1, name, p3, div, p5, rank, p7) => {
      const t = truth.get(key(name));
      let nextDiv = div, nextRank = rank;
      if (t) {
        seen.add(key(name));
        nextDiv = t.div;         // a ranked fighter belongs to the division he is ranked in
        nextRank = t.rank;
      } else if (rank !== 'NR') {
        nextRank = 'NR';         // dropped out of the rankings
      }
      if (nextDiv !== div || nextRank !== rank) {
        changes.push({ name, from: div + ' ' + rank, to: nextDiv + ' ' + nextRank });
      }
      return p1 + name + p3 + nextDiv + p5 + nextRank + p7;
    }
  );

  for (const [k, v] of truth) if (!seen.has(k)) unmatched.push(v.name);

  // Sanity: exactly one champion per division, and no interim without a champion.
  const champs = {};
  for (const m of out.matchAll(/\{ name: "([^"]+)", division: "([^"]*)", rank: "#C"/g)) {
    (champs[m[2]] = champs[m[2]] || []).push(m[1]);
  }
  const doubled = Object.entries(champs).filter(([, v]) => v.length > 1);

  console.log('changed rows: ' + changes.length);
  changes.forEach((c) => console.log('  ' + c.name.padEnd(24) + c.from.padEnd(10) + ' -> ' + c.to));
  console.log('\nchampions after sync: ' + Object.keys(champs).length + ' divisions');
  Object.entries(champs).sort().forEach(([d, v]) => console.log('  ' + d.padEnd(6) + v.join(', ')));
  if (doubled.length) {
    console.error('\nABORT: division with two champions: ' + JSON.stringify(doubled));
    process.exit(1);
  }
  if (unmatched.length) {
    console.log('\nranked in rankings.json but not found in FIGHTERS (' + unmatched.length + '):');
    unmatched.forEach((n) => console.log('  ' + n));
  }

  if (DRY) { console.log('\n--dry: nothing written'); return; }
  if (!changes.length) { console.log('\nalready in sync'); return; }
  fs.writeFileSync(IDX, out);
  console.log('\nindex.html updated');
}

main();
