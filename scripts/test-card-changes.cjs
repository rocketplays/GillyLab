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

function run(label, wt, names, expSN, expMC, mustNot) {
  const cc = extractCardChanges(wt, names);
  const sn = cc.shortNotice.map((c) => c.replacement).sort();
  const mc = cc.mayChange.map((c) => c.fighter).sort();
  console.log('\n== ' + label + ' ==\n  short-notice: [' + sn.join(', ') + ']\n  may-change:   [' + mc.join(', ') + ']');
  expSN.forEach((n) => check('short-notice flags ' + n, sn.includes(n)));
  expMC.forEach((n) => check('may-change flags ' + n, mc.includes(n)));
  mustNot.forEach((n) => check('does NOT flag ' + n + ' (either)', !sn.includes(n) && !mc.includes(n)));
  check('exactly ' + expSN.length + ' short-notice', sn.length === expSN.length, 'got ' + sn.length);
  check('exactly ' + expMC.length + ' may-change', mc.length === expMC.length, 'got ' + mc.length);
}

// Post-change OKC roster: three replacements (Ricci, Melisano, Harris), two
// bouts in limbo (Barriault & Jacobe Smith, whose opponents withdrew with no
// replacement yet), and the fighters who stayed. Withdrawn/moved fighters
// (Ribas, Hardy, Tavares, Frye, Holland, Vera, Jourdain) are off the card.
run('UFC Oklahoma City', OKC,
  ['Dricus du Plessis', 'Kamaru Usman', 'Tabatha Ricci', 'Fatima Kline', 'Dione Barbosa',
   'Anna Melisano', 'Alvin Hines', 'RJ Harris', 'Marc-André Barriault', 'Jacobe Smith'],
  ['Tabatha Ricci', 'Anna Melisano', 'RJ Harris'],   // short-notice
  ['Marc-André Barriault', 'Jacobe Smith'],           // may-change (opponent out, no replacement)
  ['Fatima Kline', 'Dione Barbosa', 'Alvin Hines', 'Dricus du Plessis', 'Kamaru Usman']);

run('UFC 329 (constructed)', U329,
  ['Conor McGregor', 'Max Holloway', 'Cody Durden', 'Alessandro Costa', 'Farid Basharat', 'John Garza'],
  ['Alessandro Costa', 'John Garza'],
  [],
  ['Cody Durden', 'Farid Basharat', 'Conor McGregor', 'Max Holloway']);

// The "Wikipedia is ahead of ESPN" guarantee. Wikipedia already names a
// replacement, but our event.json still lists the ORIGINAL fighter (ESPN hasn't
// swapped yet). The replacement must NOT be flagged short-notice (they're not on
// our card); the fighter who stayed is flagged may-change until ESPN catches up.
const AHEAD = `
== Background ==
[[Veronica Hardy]] and Dione Barbosa were expected to meet in a women's flyweight bout.<ref/> However, Hardy pulled out in early July and was replaced by promotional newcomer Anna Melisano.<ref name="Melisano"/>
`;
run('Wikipedia ahead of ESPN (feed still shows the withdrawn fighter)', AHEAD,
  ['Veronica Hardy', 'Dione Barbosa'],   // ESPN hasn't swapped Hardy -> Melisano yet
  [],                                    // short-notice: NONE (Melisano isn't on our feed)
  ['Dione Barbosa'],                     // may-change: her opponent is on the way out
  ['Veronica Hardy']);                   // the fighter who left is not flagged

run('ESPN caught up (replacement now on the feed)', AHEAD,
  ['Anna Melisano', 'Dione Barbosa'],    // ESPN swapped in Melisano
  ['Anna Melisano'],                     // now short-notice
  [],                                    // Barbosa no longer may-change
  ['Dione Barbosa', 'Veronica Hardy']);

// Verbatim from the UFC Fight Night: Ankalaev vs. Guskov page. The descriptor
// between "replaced by" and the name is "undefeated promotional newcomer" — one
// adjective longer than the enumerated list used to allow. That single word made
// the replacement invisible, so the paragraph fell through to the withdrawal
// branch and flagged BOTH fighters "may change" on a bout that was already
// settled. Keep this case verbatim: it is the exact prose that broke it.
const JACOBY = `
== Background ==
A light heavyweight bout between [[Dustin Jacoby]] and former [[Legacy Fighting Alliance#LFA Light Heavyweight Championship|LFA Light Heavyweight Champion]] Uran Satybaldiev was scheduled for the event.<ref/> However, Satybaldiev withdrew for undisclosed reasons and was replaced by undefeated promotional newcomer Muhammad Said.<ref name="Said"/>
`;
run('adjective-laden replacement descriptor ("undefeated promotional newcomer")', JACOBY,
  ['Dustin Jacoby', 'Muhammad Said'],
  ['Muhammad Said'],   // short-notice: he stepped in
  [],                  // may-change: NOT Jacoby — the replacement is already booked
  ['Dustin Jacoby']);

// A capitalised word after "replaced by" is another fighter's NAME, so the
// descriptor run must not bridge across it onto the wrong person.
const BRIDGE = `
== Background ==
[[Veronica Hardy]] and Dione Barbosa were expected to meet.<ref/> However, Hardy withdrew and was replaced by Anna Melisano, who now faces Dione Barbosa.<ref/>
`;
run('descriptor run does not bridge across a capitalised name', BRIDGE,
  ['Anna Melisano', 'Dione Barbosa'],
  ['Anna Melisano'],   // matched by her own "replaced by <F>" position, not via Barbosa
  [],
  ['Dione Barbosa', 'Veronica Hardy']);

// Verbatim from the UFC 330 page. Two compounding problems in one real case:
// (1) Wikipedia names the replacement by his LEGAL name, "Eduardo Henrique" —
// the roster/our DB both use his ring name "Eduardo Chapolin", so a plain
// textual search for the roster name never finds him at all (WIKI_NAME_ALIASES).
// (2) even once found, the descriptor between "replaced by" and his name is
// "promotional newcomer and fellow former LFA flyweight champion" — 8 words
// including the capitalized acronym "LFA", which broke the old 4-word
// all-lowercase-only descriptor check. Before both fixes this paragraph never
// matched Chapolin as a replacement, so it fell through to the withdrawal
// branch and flagged Charles Johnson "may change" on a bout that had already
// been resolved for days. Keep this case verbatim: it is the exact prose that
// broke it.
const CHAPOLIN = `
== Background ==
Jose Ochoa was scheduled to face former [[Legacy Fighting Alliance#LFA Flyweight Championship|LFA Flyweight Champion]] [[Charles Johnson (fighter)|Charles Johnson]] in a flyweight bout.<ref/> However, Ochoa pulled out for undisclosed reasons three days before the event and was replaced by promotional newcomer and fellow former LFA flyweight champion Eduardo Henrique in a 130 pound catchweight bout.<ref/>
`;
run('legal-name alias + acronym-laden descriptor ("...LFA flyweight champion Eduardo Henrique")', CHAPOLIN,
  ['Charles Johnson', 'Eduardo Chapolin'],
  ['Eduardo Chapolin'],   // short-notice: he stepped in (found only via the Henrique alias)
  [],                     // may-change: NOT Johnson — the replacement is already booked
  ['Charles Johnson']);

// Negative: a card with no replacements at all — nothing should be flagged.
const CLEAN = `
== Background ==
A bout between [[Conor McGregor]] and [[Max Holloway]] headlined the event. It was their second meeting.
`;
(function () {
  const cc = extractCardChanges(CLEAN, ['Conor McGregor', 'Max Holloway']);
  console.log('\n== clean card (no changes) ==  detected: sn ' + cc.shortNotice.length + ' / mc ' + cc.mayChange.length);
  check('no false positives on a clean card', cc.shortNotice.length === 0 && cc.mayChange.length === 0);
})();

console.log('\n' + (fail ? '  ' + fail + ' FAILURE(S)' : '  all checks passed'));
process.exit(fail ? 1 : 0);
