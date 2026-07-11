#!/usr/bin/env node
'use strict';
// Unit tests for the pure Wikipedia-Background parser in fetch-card-changes.cjs.
// Uses the REAL current-card rosters from data/event.json so the cross-check
// (only flag names that are live bout fighters) is actually exercised, plus
// realistic Background wikitext modelled on how UFC event pages are written.
const fs = require('fs');
const path = require('path');
const { extractCardChanges } = require('./fetch-card-changes.cjs');

const ev = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'data', 'event.json'), 'utf8'));
function namesFor(slug) {
  const e = (ev.data || []).find((x) => x.slug === slug);
  const out = [];
  (e.bouts || []).forEach((b) => (b.fighters || []).forEach((f) => f && f.fighterName && out.push(f.fighterName)));
  return out;
}

// Realistic Background sections (wikitext with [[links]]).
const OKC = `
== Background ==
This event marked the promotion's return to Oklahoma City.

A [[UFC Middleweight Championship|middleweight]] bout between former champion [[Dricus du Plessis]] and [[Kamaru Usman]] headlined the event.

A [[women's strawweight]] bout between [[Veronica Hardy]] and [[Dione Barbosa]] was expected to take place at the event. However, Hardy withdrew from the bout in early July and was replaced by promotional newcomer [[Anna Melisano]].

[[Alvin Hines]] was scheduled to face [[Allen Frye Jr.]] in a heavyweight bout. However, Frye was removed from the card and [[RJ Harris]] stepped in on short notice.

A [[lightweight]] bout between [[Terrance McKinney]] and [[Kaue Fernandes]] was also scheduled for the card.

== Results ==
`;

const U329 = `
== Background ==
The event was headlined by a lightweight bout between [[Conor McGregor]] and [[Max Holloway]].

A [[flyweight]] bout between [[Cody Durden]] and [[Ode' Osbourne]] was scheduled. Osbourne withdrew due to injury and [[Alessandro Costa]] replaced him on roughly two weeks' notice.

[[Farid Basharat]] was expected to face [[Ethyn Ewing]]. Ewing withdrew and was replaced by [[John Garza]] on six days' notice.

== Fight card ==
`;

let fail = 0;
function check(label, cond, extra) {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '   ' + extra : ''));
  if (!cond) fail++;
}

function run(slug, wt, expected, mustNot) {
  const names = namesFor(slug);
  const got = extractCardChanges(wt, names).map((c) => c.replacement).sort();
  console.log('\n== ' + slug + ' ==  detected: [' + got.join(', ') + ']');
  expected.forEach((n) => check('flags ' + n, got.includes(n)));
  mustNot.forEach((n) => check('does NOT flag ' + n, !got.includes(n)));
  check('exactly ' + expected.length + ' flagged', got.length === expected.length, 'got ' + got.length);
}

run('ufc-fight-night-july-18-2026', OKC,
  ['Anna Melisano', 'RJ Harris'],
  ['Dione Barbosa', 'Alvin Hines', 'Dricus du Plessis', 'Kamaru Usman', 'Terrance McKinney', 'Kaue Fernandes']);

run('ufc-329', U329,
  ['Alessandro Costa', 'John Garza'],
  ['Cody Durden', 'Farid Basharat', 'Conor McGregor', 'Max Holloway']);

// Negative: a card with no replacements at all — nothing should be flagged.
const CLEAN = `
== Background ==
A bout between [[Conor McGregor]] and [[Max Holloway]] headlined the event. It was their second meeting.
`;
(function () {
  const got = extractCardChanges(CLEAN, namesFor('ufc-329'));
  console.log('\n== clean card (no changes) ==  detected: [' + got.map((c) => c.replacement).join(', ') + ']');
  check('no false positives on a clean card', got.length === 0, 'got ' + got.length);
})();

console.log('\n' + (fail ? '  ' + fail + ' FAILURE(S)' : '  all checks passed'));
process.exit(fail ? 1 : 0);
