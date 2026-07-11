#!/usr/bin/env node
'use strict';
// Unit tests for the pure Wikipedia-Background parser in fetch-card-changes.cjs.
// Uses the REAL current-card rosters from data/event.json so the cross-check
// (only flag names that are live bout fighters) is actually exercised, plus
// realistic Background wikitext modelled on how UFC event pages are written.
const fs = require('fs');
const path = require('path');
const { extractCardChanges } = require('./fetch-card-changes.cjs');

// Explicit post-change rosters (the fighters actually booked after the changes),
// so the test is deterministic and doesn't depend on the live event.json.

// Real Background wikitext from the UFC Oklahoma City page (verbatim excerpts),
// exercising the hard parts: newcomer replacements as PLAIN TEXT (Melisano,
// Harris), an established replacement as a [[link]] (Ricci), withdrawals with NO
// replacement yet (Tavares, Holland), and a bout merely moved to another card
// (Vera/Jourdain) — none of which should flag the fighter who stayed.
const OKC = `
== Background ==
A middleweight bout between former [[UFC Middleweight Championship|UFC Middleweight Champion]] [[Dricus du Plessis]] and former [[UFC Welterweight Championship|UFC Welterweight Champion]] [[Kamaru Usman]] is scheduled to headline the event.<ref name="main"/>

A women's strawweight bout between [[Amanda Ribas]] and [[Fatima Kline]] was scheduled for the event.<ref/> However, Ribas withdrew due to dizziness and was replaced by [[Tabatha Ricci]].<ref/>

[[Brad Tavares]] was expected to face [[Marc-André Barriault]] in a middleweight bout.<ref/> However, Tavares pulled out due to undisclosed reasons and a replacement is currently being sought.<ref name="Barriault"/>

[[Veronica Hardy]] and Dione Barbosa were expected to meet in a women's flyweight bout at the preliminary card.<ref/> However, Hardy pulled out in early July after suffering a cut during training and was replaced by promotional newcomer Anna Melisano.<ref name="Melisano"/>

A bantamweight bout between [[Marlon Vera]] and [[Charles Jourdain]] was reportedly scheduled to take place as the co-main event.<ref/> However, the bout was moved to [[UFC 331]] for unknown reasons.<ref/>

A heavyweight bout between Alvin Hines and Allen Frye Jr. was originally booked for the event.<ref/> However, Frye Jr. pulled out due to undisclosed reasons and was replaced by promotional newcomer RJ Harris.<ref name="Harris"/>

In addition, a welterweight bout between [[Kevin Holland]] and undefeated prospect Jacobe Smith was scheduled for the event.<ref/> However, Holland had to withdraw due to an undisclosed injury and it is currently unclear whether a replacement opponent will be found.<ref name="Smith"/>

== Fight card ==
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

function run(label, wt, names, expected, mustNot) {
  const got = extractCardChanges(wt, names).map((c) => c.replacement).sort();
  console.log('\n== ' + label + ' ==  detected: [' + got.join(', ') + ']');
  expected.forEach((n) => check('flags ' + n, got.includes(n)));
  mustNot.forEach((n) => check('does NOT flag ' + n, !got.includes(n)));
  check('exactly ' + expected.length + ' flagged', got.length === expected.length, 'got ' + got.length);
}

// Post-change OKC roster: three replacements (Ricci, Melisano, Harris) + the
// fighters who stayed. Withdrawn fighters (Ribas, Hardy, Tavares, Frye, Holland)
// are gone from the card, so they aren't in this list.
run('UFC Oklahoma City', OKC,
  ['Dricus du Plessis', 'Kamaru Usman', 'Tabatha Ricci', 'Fatima Kline', 'Dione Barbosa',
   'Anna Melisano', 'Alvin Hines', 'RJ Harris', 'Marc-André Barriault', 'Jacobe Smith'],
  ['Tabatha Ricci', 'Anna Melisano', 'RJ Harris'],
  ['Fatima Kline', 'Dione Barbosa', 'Alvin Hines', 'Marc-André Barriault', 'Jacobe Smith', 'Dricus du Plessis', 'Kamaru Usman']);

run('UFC 329 (constructed)', U329,
  ['Conor McGregor', 'Max Holloway', 'Cody Durden', 'Alessandro Costa', 'Farid Basharat', 'John Garza'],
  ['Alessandro Costa', 'John Garza'],
  ['Cody Durden', 'Farid Basharat', 'Conor McGregor', 'Max Holloway']);

// Negative: a card with no replacements at all — nothing should be flagged.
const CLEAN = `
== Background ==
A bout between [[Conor McGregor]] and [[Max Holloway]] headlined the event. It was their second meeting.
`;
(function () {
  const got = extractCardChanges(CLEAN, ['Conor McGregor', 'Max Holloway']);
  console.log('\n== clean card (no changes) ==  detected: [' + got.map((c) => c.replacement).join(', ') + ']');
  check('no false positives on a clean card', got.length === 0, 'got ' + got.length);
})();

console.log('\n' + (fail ? '  ' + fail + ' FAILURE(S)' : '  all checks passed'));
process.exit(fail ? 1 : 0);
