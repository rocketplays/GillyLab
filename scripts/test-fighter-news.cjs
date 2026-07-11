#!/usr/bin/env node
'use strict';
// Unit tests for the news filters in fetch-fighter-news.cjs — mainly
// isProfilePage(), which drops a fighter's static profile/stats landing pages
// (ESPN "MMA Profile", CBS Sports / UFC.com name-only pages, Sherdog fighter
// page) that Google News surfaces as if they were articles.
const { isProfilePage, curate } = require('./fetch-fighter-news.cjs');

let fail = 0;
function check(label, cond, extra) {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '   ' + extra : ''));
  if (!cond) fail++;
}

// [fighter, headline, expectDrop]
const cases = [
  // profile / stats / landing pages — must be dropped
  ['John Garza', 'John Garza (Bantamweight) MMA Profile - ESPN', true],
  ['John Garza', 'John Garza - CBS Sports', true],
  ['John Garza', 'John Garza | ESPN', true],
  ['Gable Steveson', 'Gable Steveson - UFC.com', true],
  ['Anna Melisano', 'Anna Melisano Stats, News, Bio - ESPN', true],
  ['RJ Harris', 'RJ Harris - Sherdog.com Fighter Profile', true],
  ['Cody Durden', 'Cody Durden MMA Record, Fight Stats - Tapology', true],
  // a different fighter's profile page that leaked into this feed — still a profile
  ['Nina Milošević', "Anastasiya Koroleva (Women's Bantamweight) MMA Profile - ESPN Philippines", true],
  // real articles — must be kept
  ['John Garza', 'Meet John Garza: The 23-year-old making his UFC debut on six days’ notice at Conor McGregor’s return card - Bloody Elbow', false],
  ['John Garza', 'Conor McGregor-led UFC 329 fight card gets last-second regional fighter replacement - Yahoo Sports', false],
  ['John Garza', 'UFC 329 gets late replacement opponent change - MMA Fighting', false],
  ['Alessandro Costa', 'Alessandro Costa vs. Cody Durden prediction, odds, pick for UFC 329 - Yahoo Sports', false],
  ['Alessandro Costa', 'Alessandro Costa unsure of new UFC rankings: ‘It’s very confusing’ - MMA Junkie', false],
  ['Conor McGregor', 'Conor McGregor announces return, targets UFC 329 - ESPN', false],
];

console.log('== isProfilePage ==');
cases.forEach(([name, title, drop]) => check((drop ? 'drops   ' : 'keeps   ') + title.slice(0, 62), isProfilePage(title, name) === drop));

// curate() should strip profile pages while keeping real articles (and still
// respect the outlet whitelist + recency).
console.log('\n== curate() integration ==');
const now = Date.parse('2026-07-11');
const items = [
  { title: 'John Garza (Bantamweight) MMA Profile - ESPN', url: 'u1', source: 'ESPN', date: '2026-07-07' },
  { title: 'John Garza - CBS Sports', url: 'u2', source: 'CBS Sports', date: '2026-07-10' },
  { title: 'Meet John Garza: the 23-year-old stepping in on six days’ notice - Bloody Elbow', url: 'u3', source: 'Bloody Elbow', date: '2026-07-07' },
  { title: 'John Garza signs with sketchy blog', url: 'u4', source: 'RandomSEOblog', date: '2026-07-08' }, // outlet not whitelisted
];
const out = curate(items, now, new Set(['329']), 'John Garza');
const titles = out.map((i) => i.title);
check('kept the real article', titles.some((t) => /Meet John Garza/.test(t)));
check('dropped the ESPN profile', !titles.some((t) => /MMA Profile/.test(t)));
check('dropped the CBS profile', !titles.some((t) => /John Garza - CBS Sports/.test(t)));
check('dropped the non-whitelisted outlet', !titles.some((t) => /sketchy blog/.test(t)));
check('exactly 1 item survives', out.length === 1, 'got ' + out.length);

console.log('\n' + (fail ? '  ' + fail + ' FAILURE(S)' : '  all checks passed'));
process.exit(fail ? 1 : 0);
