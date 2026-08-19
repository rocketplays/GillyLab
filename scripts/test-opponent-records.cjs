#!/usr/bin/env node
'use strict';
// Unit tests for the pure parsers/logic in fetch-opponent-records.cjs.
// Fixtures below are hand-built to match REAL Sherdog markup, inspected live
// via browser devtools on 2026-08-19 (fightfinder search results table and a
// fighter profile's PRO/AMATEUR history tables) — not guessed from memory.
const assert = require('assert');
const {
  norm, untrackedOpponentsFor, parseSearchResults, parseFighterHistory,
  isoFromSherdogDate, recordAsOfFromHistory, findMutualConfirmation,
  stripDiacritics, parseDateUTC, findRowNearDate, readNameAliases, resolveFhKey,
} = require('./fetch-opponent-records.cjs');

let fail = 0;
function check(label, cond, extra) {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '   ' + extra : ''));
  if (!cond) fail++;
}

// ── untrackedOpponentsFor ────────────────────────────────────────────────────
(function testUntracked() {
  console.log('\n== untrackedOpponentsFor ==');
  const FH = {
    'Hunter Smith': [
      { date: '2026-03-07', opponent: 'Elliot Hebert', result: 'W' },
      { date: '2025-11-22', opponent: 'Aleko Saghliani', result: 'W' },
    ],
    'Elliot Hebert': [   // tracked -- has its own key
      { date: '2026-03-07', opponent: 'Hunter Smith', result: 'L' },
    ],
  };
  const out = untrackedOpponentsFor(FH, ['Hunter Smith']);
  check('excludes tracked opponent (Elliot Hebert has own key)', !out.some((o) => o.opponent === 'Elliot Hebert'));
  check('includes untracked opponent (Aleko Saghliani)', out.some((o) => o.opponent === 'Aleko Saghliani'));
  check('exactly one untracked row', out.length === 1, 'got ' + out.length);
})();

// ── parseSearchResults ───────────────────────────────────────────────────────
// Real markup shape from https://www.sherdog.com/stats/fightfinder?SearchTxt=Elliot+Hebert
const SEARCH_SINGLE = `
<html><body>
<div class="trending">
  <a href="/fighter/Ian-Garry-268923">Ian Garry</a>
</div>
<table class="new_table fightfinder_result">
<thead><tr><td class="col_one">Fighter</td><td class="col_two">Nickname</td></tr></thead>
<tr>
  <td class="pic"></td>
  <td><a href="/fighter/Elliot-Hebert-312389">Elliot Hebert</a></td>
  <td>"Be Good"</td>
  <td>5'8"(1.73 m)</td>
  <td>155 lbs(70.31 kg)</td>
  <td>The Shed Training Grounds</td>
</tr>
</table>
</body></html>`;
// Real shape from SearchTxt=Hunter+Smith -- three distinct fighters returned.
const SEARCH_MULTI = `
<table class="new_table fightfinder_result">
<thead><tr><td class="col_one">Fighter</td></tr></thead>
<tr><td class="pic"></td><td><a href="/fighter/Hunter-Smith-317133">Hunter Smith</a></td></tr>
<tr><td class="pic"></td><td><a href="/fighter/Hunter-Smith-392777">Hunter Smith</a></td></tr>
<tr><td class="pic"></td><td><a href="/fighter/Hunter-Smith-490875">Hunter Smith</a></td></tr>
</table>`;
const SEARCH_EMPTY = `<html><body><p>No results found.</p></body></html>`;

(function testParseSearchResults() {
  console.log('\n== parseSearchResults ==');
  const single = parseSearchResults(SEARCH_SINGLE);
  check('single result: exactly 1 candidate (trending-fighters links excluded)', single.length === 1, 'got ' + single.length);
  check('single result: correct url', single[0] && single[0].url === 'https://www.sherdog.com/fighter/Elliot-Hebert-312389', single[0] && single[0].url);
  check('single result: correct name', single[0] && single[0].name === 'Elliot Hebert');

  const multi = parseSearchResults(SEARCH_MULTI);
  check('multi result: exactly 3 candidates', multi.length === 3, 'got ' + multi.length);
  check('multi result: urls are distinct', new Set(multi.map((c) => c.url)).size === 3);

  const empty = parseSearchResults(SEARCH_EMPTY);
  check('no results -> empty array', empty.length === 0, 'got ' + empty.length);
})();

// ── isoFromSherdogDate ───────────────────────────────────────────────────────
(function testDateParse() {
  console.log('\n== isoFromSherdogDate ==');
  check('"Mar / 07 / 2026" -> 2026-03-07', isoFromSherdogDate('Mar / 07 / 2026') === '2026-03-07', isoFromSherdogDate('Mar / 07 / 2026'));
  check('"Jul / 04 / 2026" -> 2026-07-04', isoFromSherdogDate('Jul / 04 / 2026') === '2026-07-04');
  check('garbage input -> null', isoFromSherdogDate('not a date') === null);
})();

// ── parseFighterHistory ──────────────────────────────────────────────────────
// Real markup shape from https://www.sherdog.com/fighter/Elliot-Hebert-312389
// (trimmed to a few representative rows; PRO table first, AMATEUR second, per
// live DOM order confirmed on that page).
const PROFILE_HEBERT = `
<html><body>
<table class="new_table fighter">
<thead><tr><td class="col_one">Result</td><td class="col_two">Fighter</td><td class="col_three">Event</td></tr></thead>
<tr>
  <td><span class="final_result loss">loss</span></td>
  <td><a href="/fighter/Jettre-Hampton-388858">Jettre Hampton</a></td>
  <td><a href="/events/AKA-55-Flags-Fights-and-Freedom-113465">AKA 55 - Flags, Fights and Freedom</a><br><span class="sub_line">Jul / 04 / 2026</span></td>
</tr>
<tr>
  <td><span class="final_result loss">loss</span></td>
  <td><a href="/fighter/Hunter-Smith-392777">Hunter Smith</a></td>
  <td><a href="/events/AKA-53-American-Kombat-Alliance-111904">AKA 53 - American Kombat Alliance</a><br><span class="sub_line">Mar / 07 / 2026</span></td>
</tr>
<tr>
  <td><span class="final_result win">win</span></td>
  <td><a href="/fighter/Nicko-Commissiong-220125">Nicko Commissiong</a></td>
  <td><a href="/events/AKA-49-American-Kombat-Alliance-108947">AKA 49 - American Kombat Alliance</a><br><span class="sub_line">Aug / 16 / 2025</span></td>
</tr>
<tr>
  <td><span class="final_result win">win</span></td>
  <td><a href="/fighter/Nakia-Brown-310829">Nakia Brown</a></td>
  <td><a href="/events/RFC-2-Ragin-Fighting-Championship-2-107627">RFC 2 - Ragin Fighting Championship 2</a><br><span class="sub_line">Jun / 14 / 2025</span></td>
</tr>
<tr>
  <td><span class="final_result loss">loss</span></td>
  <td><a href="/fighter/Nicko-Commissiong-220125">Nicko Commissiong</a></td>
  <td><a href="/events/AKA-42-American-Kombat-Alliance-104875">AKA 42 - American Kombat Alliance</a><br><span class="sub_line">Nov / 23 / 2024</span></td>
</tr>
<tr>
  <td><span class="final_result win">win</span></td>
  <td><a href="/fighter/Hunter-Smith-392777">Hunter Smith</a></td>
  <td><a href="/events/AKA-37-American-Kombat-Alliance-102992">AKA 37 - American Kombat Alliance</a><br><span class="sub_line">Jun / 22 / 2024</span></td>
</tr>
</table>
<table class="new_table fighter">
<thead><tr><td class="col_one">Result</td><td class="col_two">Fighter</td></tr></thead>
<tr>
  <td><span class="final_result win">win</span></td>
  <td><a href="/fighter/Jalen-Hill-259659">Jalen Hill</a></td>
  <td><a href="/events/EFC-Empire-Fighting-Championship-11-89084">EFC - Empire Fighting Championship 11</a><br><span class="sub_line">May / 08 / 2021</span></td>
</tr>
</table>
</body></html>`;

(function testParseFighterHistory() {
  console.log('\n== parseFighterHistory ==');
  const hist = parseFighterHistory(PROFILE_HEBERT);
  check('6 pro rows parsed', hist.pro.length === 6, 'got ' + hist.pro.length);
  check('1 amateur row parsed', hist.amateur.length === 1, 'got ' + hist.amateur.length);
  check('header row not included as data', !hist.pro.some((f) => f.opponent === 'Fighter'));
  const first = hist.pro[0];
  check('row shape: opponent parsed', first.opponent === 'Jettre Hampton', first.opponent);
  check('row shape: result mapped to L', first.result === 'L', first.result);
  check('row shape: date converted to ISO', first.date === '2026-07-04', first.date);
  const win = hist.pro.find((f) => f.opponent === 'Nicko Commissiong' && f.date === '2025-08-16');
  check('a "win" row maps to W', win && win.result === 'W', win && win.result);
})();

// ── recordAsOfFromHistory ────────────────────────────────────────────────────
(function testRecordAsOf() {
  console.log('\n== recordAsOfFromHistory ==');
  const hist = parseFighterHistory(PROFILE_HEBERT);
  // Entering the Mar 7 2026 fight (vs Hunter Smith): everything strictly
  // before that date is Aug16'25 W, Jun14'25 W, Nov23'24 L, Jun22'24 W ->
  // 3-1-0. (Manually cross-checked against the live page during the pilot.)
  const rec = recordAsOfFromHistory(hist.pro, '2026-03-07');
  check('record entering Mar 7 2026 fight = 3-1-0', rec === '3-1-0', rec);
  // Entering his very first fight on file -> 0-0-0, not null (he IS tracked,
  // just hasn't fought yet as of that date).
  const debut = recordAsOfFromHistory(hist.pro, '2024-06-22');
  check('record entering earliest fight on file = 0-0-0', debut === '0-0-0', debut);
  const bogus = recordAsOfFromHistory(hist.pro, 'not-a-date');
  check('unparseable date -> null', bogus === null, bogus);
  // Same target date, two different string formats (mirrors the real call:
  // Sherdog rows are ISO via isoFromSherdogDate, but the target passed in is
  // whatever FIGHT_HISTORY's own "Mon D, YYYY" format looks like) -- must
  // agree exactly, this is the timezone regression at the function level.
  const viaISO = recordAsOfFromHistory(hist.pro, '2026-03-07');
  const viaHuman = recordAsOfFromHistory(hist.pro, 'Mar 7, 2026');
  check('ISO target and "Mon D, YYYY" target give the identical record', viaISO === viaHuman, viaISO + ' vs ' + viaHuman);
})();

// ── findMutualConfirmation ───────────────────────────────────────────────────
(function testMutualConfirmation() {
  console.log('\n== findMutualConfirmation ==');
  const hist = parseFighterHistory(PROFILE_HEBERT);
  const confirmed = findMutualConfirmation(hist.pro, 'Hunter Smith', '2026-03-07', 45);
  check('confirms Hunter Smith on matching date', !!confirmed, confirmed);
  const wrongDate = findMutualConfirmation(hist.pro, 'Hunter Smith', '2020-01-01', 45);
  check('rejects Hunter Smith on a wildly different date', wrongDate === null, wrongDate);
  const noSuchOpponent = findMutualConfirmation(hist.pro, 'Someone Else', '2026-03-07', 45);
  check('rejects a name never fought', noSuchOpponent === null, noSuchOpponent);
  // Within tolerance but not exact -- date shifted by 10 days should still confirm.
  const nearMiss = findMutualConfirmation(hist.pro, 'Hunter Smith', '2026-03-17', 45);
  check('confirms within tolerance window (10 days off)', !!nearMiss, nearMiss);
})();

// ── parseDateUTC (the timezone regression) ───────────────────────────────────
// This is a REAL bug caught by live testing, not a hypothetical: on a non-UTC
// runner (America/Phoenix, UTC-7, confirmed via Intl.DateTimeFormat), bare
// Date.parse('2026-03-07') and Date.parse('Mar 7, 2026') land 7 hours apart --
// enough to flip which side of a boundary a same-day fight falls on, which
// silently inflated Hunter Smith's record-entering-a-fight by one win (his own
// win ON the target date was being counted as "before" itself: 8-1-0 instead
// of the correct 7-1-0). parseDateUTC must resolve both formats to the exact
// same instant.
(function testParseDateUTC() {
  console.log('\n== parseDateUTC (timezone regression) ==');
  const iso = parseDateUTC('2026-03-07');
  const human = parseDateUTC('Mar 7, 2026');
  check('ISO and "Mon D, YYYY" forms of the same date agree exactly', iso === human, iso + ' vs ' + human);
  check('single-digit day, no leading zero, matches padded ISO', parseDateUTC('Jul 4, 2026') === parseDateUTC('2026-07-04'));
  check('unparseable input -> NaN', Number.isNaN(parseDateUTC('garbage')));
})();

// ── findRowNearDate (the name-spelling-mismatch fix) ─────────────────────────
// Real case found live: our FIGHT_HISTORY spells this opponent "Mike Murphy",
// Sherdog's own page spells him "Micheal Murphy" -- name matching (exact or
// via findMutualConfirmation) can never bridge that, but date matching can,
// since a fighter has at most one bout on a given date.
(function testFindRowNearDate() {
  console.log('\n== findRowNearDate ==');
  const hist = parseFighterHistory(PROFILE_HEBERT);
  const byDate = findRowNearDate(hist.pro, '2026-03-07', 2);
  check('finds the row on an exact date match, regardless of name', byDate && byDate.opponent === 'Hunter Smith', byDate && byDate.opponent);
  const withinTol = findRowNearDate(hist.pro, '2026-03-08', 2);
  check('finds the row within tolerance (1 day off)', withinTol && byDate && withinTol.date === byDate.date);
  const outsideTol = findRowNearDate(hist.pro, '2026-03-20', 2);
  check('no match outside tolerance -> null', outsideTol === null, outsideTol);
  const noDate = findRowNearDate(hist.pro, 'garbage', 2);
  check('unparseable target date -> null', noDate === null, noDate);
})();

// ── stripDiacritics ──────────────────────────────────────────────────────────
(function testStripDiacritics() {
  console.log('\n== stripDiacritics ==');
  check('"Hugo Oyarzún" -> "Hugo Oyarzun"', stripDiacritics('Hugo Oyarzún') === 'Hugo Oyarzun', stripDiacritics('Hugo Oyarzún'));
  check('plain ASCII unchanged', stripDiacritics('Hunter Smith') === 'Hunter Smith');
})();

// ── readNameAliases / resolveFhKey ──────────────────────────────────────────
// Fixture mirrors the real shape of index.html's NAME_ALIASES block (verified
// live: 'gary-balletto' -> 'Gary Balletto Jr.' etc. are real entries) so this
// tests the actual regex against real formatting, not an idealized one.
const NAME_ALIASES_FIXTURE = `
  const SLUG_ALIASES = {
    'gary-balletto': 'Gary Balletto Jr.',
  };
  const NAME_ALIASES = {
    'abdul rakhman yakhyaev': 'Abdulrakhman Yakhyaev',
    'gary balletto': 'Gary Balletto Jr.',
    'king green': 'Bobby Green',
  };
`;
(function testReadNameAliases() {
  console.log('\n== readNameAliases ==');
  const aliases = readNameAliases(NAME_ALIASES_FIXTURE);
  check('parses NAME_ALIASES, not SLUG_ALIASES above it', aliases['gary balletto'] === 'Gary Balletto Jr.', aliases['gary balletto']);
  check('parses every entry', Object.keys(aliases).length === 3, Object.keys(aliases).length);
  check('does not pick up the slug-keyed alias', aliases['gary-balletto'] === undefined);
  const empty = readNameAliases('no NAME_ALIASES block here');
  check('missing block -> empty object, not a throw', Object.keys(empty).length === 0);
})();
(function testResolveFhKey() {
  console.log('\n== resolveFhKey ==');
  const FH = { 'Gary Balletto Jr.': [], 'Bobby Green': [] };
  const aliases = readNameAliases(NAME_ALIASES_FIXTURE);
  // The real bug this fixes: ESPN's event.json spells him "Gary Balletto"
  // (no "Jr."), which is not a FIGHT_HISTORY key on its own -- direct lookup
  // must fall through to the alias map.
  check('direct FH hit returns the name unchanged', resolveFhKey(FH, aliases, 'Bobby Green') === 'Bobby Green');
  check('resolves via alias when no direct hit', resolveFhKey(FH, aliases, 'Gary Balletto') === 'Gary Balletto Jr.', resolveFhKey(FH, aliases, 'Gary Balletto'));
  check('alias lookup is case-insensitive (event.json casing varies)', resolveFhKey(FH, aliases, 'GARY BALLETTO') === 'Gary Balletto Jr.', resolveFhKey(FH, aliases, 'GARY BALLETTO'));
  check('unresolvable name -> null, not a guess', resolveFhKey(FH, aliases, 'Nobody Real') === null);
  // Guards the exact failure mode this fix targets: an alias pointing at a
  // name that itself isn't (or is no longer) a real FH key must not be
  // trusted blindly -- resolveFhKey re-checks FH[aliased] before returning it.
  const staleAliases = { 'ghost fighter': 'Not A Real FH Key' };
  check('alias target must itself be a real FH key', resolveFhKey(FH, staleAliases, 'Ghost Fighter') === null);
})();

console.log('\n' + (fail === 0 ? 'ALL PASS' : fail + ' FAILURE(S)'));
process.exit(fail === 0 ? 0 : 1);
