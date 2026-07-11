// Unit tests for worker/pickem.mjs — the pure scoring/grading/aggregation core.
import {
  gradeBout, gradeCard, buildLeaderboard, userHistory, cleanName,
  pairKey, methodBucket, CONF_MULT, CONF_PENALTY,
} from '../worker/pickem.mjs';

let fail = 0;
const ok = (label, cond, extra) => { console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '   ' + extra : '')); if (!cond) fail++; };
const eq = (label, got, want) => ok(label, JSON.stringify(got) === JSON.stringify(want), 'got ' + JSON.stringify(got));

console.log('== methodBucket ==');
eq('KO', methodBucket('KO (Punch)'), 'KO/TKO');
eq('TKO', methodBucket('TKO (Punches)'), 'KO/TKO');
eq('Submission', methodBucket('Submission (RNC)'), 'Submission');
eq('Decision', methodBucket('Decision (Unanimous)'), 'Decision');
eq('empty -> null', methodBucket(''), null);

console.log('\n== pairKey order independence ==');
ok('same key regardless of order', pairKey('Conor McGregor', 'John Garza') === pairKey('John Garza', 'Conor McGregor'));

console.log('\n== gradeBout ==');
// A High-confidence KO/R2 pick worth wPts=14, mPts=6, rPts=5 (pre-confidence).
const pick = { winner: 'A', method: 'KO/TKO', round: 2, confidence: 'High', wPts: 14, mPts: 6, rPts: 5 };
eq('perfect: (14+6+5)*2 = 50', gradeBout(pick, { winner: 'A', method: 'KO/TKO', round: 2 }).points, 50);
eq('right winner+method, wrong round: (14+6)*2 = 40', gradeBout(pick, { winner: 'A', method: 'KO/TKO', round: 5 }).points, 40);
eq('right winner, wrong method: 14*2 = 28', gradeBout(pick, { winner: 'A', method: 'Submission', round: 1 }).points, 28);
eq('wrong winner (High): -10', gradeBout(pick, { winner: 'B', method: 'KO/TKO', round: 2 }).points, -10);
eq('wrong winner (Low): 0', gradeBout({ ...pick, confidence: 'Low' }, { winner: 'B' }).points, 0);
eq('voided bout: 0', gradeBout(pick, { voided: true }).points, 0);
ok('no result yet -> pending, 0', gradeBout(pick, null).pending === true && gradeBout(pick, null).points === 0);
// decision pick never earns a round bonus
const dec = { winner: 'A', method: 'Decision', confidence: 'Med', wPts: 10, mPts: 5, rPts: 0 };
eq('decision correct: (10+5)*1.5 = 23', gradeBout(dec, { winner: 'A', method: 'Decision', round: null }).points, 23);
ok('accent-insensitive winner match', gradeBout({ ...dec, winner: 'José Aldo' }, { winner: 'Jose Aldo', method: 'Decision' }).winnerHit === true);

console.log('\n== gradeCard ==');
const record = { picks: [
  { f1: 'A', f2: 'B', winner: 'A', method: 'KO/TKO', round: 1, confidence: 'High', wPts: 12, mPts: 4, rPts: 4 },  // fav (wPts 12 -> underdog by >11), hit
  { f1: 'C', f2: 'D', winner: 'D', method: 'Decision', confidence: 'Med', wPts: 10, mPts: 5, rPts: 0 },           // fav, wrong winner
  { f1: 'E', f2: 'F', winner: 'E', method: 'Submission', round: 3, confidence: 'Low', wPts: 20, mPts: 7, rPts: 6 }, // big dog, hit
] };
const results = [
  { f1: 'B', f2: 'A', winner: 'A', method: 'KO (Punch)', round: 1 },   // perfect (order flipped) -> (12+4+4)*2 = 40
  { f1: 'C', f2: 'D', winner: 'C', method: 'Decision' },               // wrong winner (Med) -> -5
  { f1: 'E', f2: 'F', winner: 'E', method: 'Submission', round: 2 },   // winner+method, wrong round (Low) -> (20+7)*1 = 27
];
const card = gradeCard(record, results);
eq('card total = 40 - 5 + 27 = 62', card.total, 62);
eq('correct winners = 2', card.correct, 2);
eq('decided = 3', card.decided, 3);
eq('underdog picks (wPts>11) = 2', card.dogPicks, 2);
eq('underdog correct = 2', card.dogCorrect, 2);

console.log('\n== leaderboard ==');
const aggs = [
  { name: 'Alpha', byEvent: {
      e3: { points: 50, date: '2026-07-18', correct: 8, decided: 10, dogPicks: 3, dogCorrect: 2 },
      e2: { points: 10, date: '2026-07-11', correct: 5, decided: 9,  dogPicks: 2, dogCorrect: 0 },
      e1: { points: 30, date: '2026-07-04', correct: 7, decided: 8,  dogPicks: 4, dogCorrect: 2 } } },
  { name: 'Bravo', byEvent: { e3: { points: 20, date: '2026-07-18' }, e1: { points: 90, date: '2026-07-04' } } },
  { name: 'Charlie', byEvent: { e2: { points: 5, date: '2026-07-11' } } },
  { name: null, byEvent: { e3: { points: 999 } } },   // no display name -> excluded
];
const ordered = ['e3', 'e2', 'e1'];   // newest first
const recent = buildLeaderboard(aggs, ordered, 'recent');
eq('recent: Alpha 50 then Bravo 20 (Charlie/no-name excluded)', recent.map(r => [r.name, r.points]), [['Alpha', 50], ['Bravo', 20]]);
const last5 = buildLeaderboard(aggs, ordered, 'last5');
eq('last5 == all here: Bravo 110, Alpha 90, Charlie 5', last5.map(r => [r.name, r.points]), [['Bravo', 110], ['Alpha', 90], ['Charlie', 5]]);
const all = buildLeaderboard(aggs, ordered, 'all');
eq('all: Bravo 110, Alpha 90, Charlie 5', all.map(r => [r.name, r.points]), [['Bravo', 110], ['Alpha', 90], ['Charlie', 5]]);
eq('ranks assigned 1..n', all.map(r => r.rank), [1, 2, 3]);

console.log('\n== userHistory ==');
const hist = userHistory(aggs[0], ordered);
eq('Alpha total = 90', hist.total, 90);
eq('Alpha events newest first', hist.events.map(e => e.slug), ['e3', 'e2', 'e1']);
eq('Alpha record correct = 20', hist.correct, 20);
eq('Alpha record decided = 27', hist.decided, 27);
eq('Alpha underdogs picked = 9', hist.dogPicks, 9);
eq('Alpha underdogs correct = 4', hist.dogCorrect, 4);

console.log('\n== cleanName ==');
eq('trims + collapses spaces', cleanName('  Choke   Artist '), 'Choke Artist');
eq('too short -> null', cleanName('a'), null);
eq('too long -> null', cleanName('x'.repeat(21)), null);
eq('bad chars -> null', cleanName('drop<table>'), null);
eq('valid handle', cleanName('KO_Merchant-7'), 'KO_Merchant-7');

console.log('\n' + (fail ? '  ' + fail + ' FAILURE(S)' : '  all pick\'em checks passed'));
process.exit(fail ? 1 : 0);
