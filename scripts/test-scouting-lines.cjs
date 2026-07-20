#!/usr/bin/env node
/**
 * test-scouting-lines.cjs — every "Path to victory" line must agree with the stats
 * it was generated from. Exits non-zero on any violation.
 *
 *     node scripts/test-scouting-lines.cjs
 *
 * Each rule asserts that the CLAIM a sentence makes matches the numbers behind it:
 * a fighter called takedown-vulnerable is actually below 55% TDD, "heavier hands"
 * really does belong to the man with more knockdowns, and so on.
 *
 * TWO THINGS KEEP THIS FROM BEING THEATRE, and both earned their place:
 *
 *  1. APPLICABILITY. A rule whose pattern matches nothing reports "ok" forever.
 *     Rewording copy has already silently disarmed two rules — one showed INERT, the
 *     other still probed 22 lines while its own regex could no longer match, so it
 *     could never fire. Every rule therefore reports how many lines it APPLIES to,
 *     and a rule that applies to zero is called out as INERT.
 *
 *  2. A NEGATIVE CONTROL. Ten planted bugs — including verbatim reproductions of the
 *     two real ones this caught (an 88%-TDD fighter described as a non-stuffer, and a
 *     grappler with zero takedowns told his path was takedown volume) — are fed
 *     through the same rules. If any goes uncaught, the suite fails even when the
 *     real lines are clean, because a clean run only means something if the rules
 *     can still bite.
 */
const { buildLines } = require('./scouting-lines.cjs');

const num = (x) => (x == null ? null : Number(x));

// { name, probe, test(line, self, other) -> null | 'why it is wrong' }
const RULES = [
  {
    name: 'opponent called takedown-vulnerable but defends well',
    probe: /is takedown-vulnerable \(|defends only /,
    test(L) {
      const m = /is takedown-vulnerable \((\d+)% TDD\)/.exec(L);
      if (m && +m[1] > 55) return `claims vulnerable at ${m[1]}% TDD`;
      const d = /defends only (\d+)%/.exec(L);
      if (d && +d[1] > 55) return `"defends only ${d[1]}%" is not low`;
    },
  },
  {
    name: 'self called takedown-vulnerable but defends well',
    probe: /he's takedown-vulnerable \(/,
    test(L) {
      const m = /he's takedown-vulnerable \((\d+)% TDD\)/.exec(L);
      if (m && +m[1] > 55) return `claims vulnerable at ${m[1]}%`;
    },
  },
  {
    name: '"neither stuffs much" with a good defender',
    probe: /neither stuffs much/,
    test(L) {
      const m = /neither stuffs much \((\d+)% and (\d+)% TDD\)/.exec(L);
      if (m && (+m[1] >= 68 || +m[2] >= 68)) return `${m[1]}% / ${m[2]}%`;
    },
  },
  {
    name: '"both stuff N%+" but one is below N',
    probe: /both stuff /,
    test(L, s, o) {
      const m = /both stuff (\d+)%\+/.exec(L);
      if (m && (num(s.tdDef) < +m[1] || num(o.tdDef) < +m[1])) {
        return `floor ${m[1]}% vs actual ${s.tdDef}/${o.tdDef}`;
      }
    },
  },
  {
    name: 'mid-range TDD claim outside 56-67',
    probe: /turns away /,
    test(L) {
      const m = /turns away (\d+)% of shots/.exec(L);
      if (m && (+m[1] < 56 || +m[1] > 67)) return `${m[1]}% is not mid-range`;
    },
  },
  {
    name: '"TDD is the problem" but it is not high',
    probe: /takedown defense is the problem/,
    test(L) {
      const m = /(\d+)% takedown defense is the problem/.exec(L);
      if (m && +m[1] < 68) return `${m[1]}%`;
    },
  },
  {
    name: '"should stall his entries" but own TDD is low',
    probe: /should stall/,
    test(L) {
      const m = /his (\d+)% takedown defense should stall/.exec(L);
      if (m && +m[1] < 70) return `${m[1]}%`;
    },
  },
  {
    // The biggest net: every "his edge is X (a vs b)" claim, checked for direction.
    name: 'claims an edge the numbers contradict',
    probe: /heavier hands \(|busier submission game \(|persistent takedown entries \(|edge in output \(|finishing instinct \(|output is even \(/,
    test(L) {
      const checks = [
        [/heavier hands \(([\d.]+) vs ([\d.]+) knockdowns/, (a, b) => a > b],
        [/busier submission game \(([\d.]+) vs ([\d.]+) attempts/, (a, b) => a > b],
        [/persistent takedown entries \(([\d.]+) vs ([\d.]+) per/, (a, b) => a > b],
        [/he has the edge in output \(([\d.]+) vs ([\d.]+) thrown/, (a, b) => a > b],
        [/doesn't have the edge in output \(([\d.]+) vs ([\d.]+) thrown/, (a, b) => a < b],
        [/finishing instinct \((\d+)% of wins inside the distance vs (\d+)%/, (a, b) => a > b],
        [/output is even \(([\d.]+) vs ([\d.]+) thrown/, (a, b) => Math.abs(a - b) <= 1.5],
      ];
      for (const [re, ok] of checks) {
        const m = re.exec(L);
        if (m && !ok(+m[1], +m[2])) return m[0];
      }
    },
  },
  {
    name: 'advises volume from a fighter who does not shoot',
    probe: /takes volume/,
    test(L, s) {
      if (/takes volume/.test(L) && num(s.tdLanded) < 1) return `tdLanded=${s.tdLanded}`;
    },
  },
  {
    name: 'submission threat claimed but rate is low',
    probe: /live submission threat at /,
    test(L) {
      const m = /live submission threat at ([\d.]+) per 15min/.exec(L);
      if (m && +m[1] < 0.8) return `${m[1]} per 15min`;
    },
  },
  {
    name: 'finish-rate claim contradicts the stat',
    probe: /% of wins are finishes/,
    test(L, s) {
      const m = /(\d+)% of wins are finishes/.exec(L);
      if (m && num(s.finRate) !== +m[1]) return `line says ${m[1]}%, stat is ${s.finRate}%`;
    },
  },
  {
    name: '"harder to hold down" names the wrong fighter',
    probe: /harder to hold down/,
    test(L, s, o) {
      // Anchored on ", and " and requiring a CAPITAL for the name alternative:
      // unanchored, "\w[\w' -]*?" matched "and he" and sent the lookup to the
      // opponent, failing 10 correct lines.
      const m = /, and (he|[A-Z][\w' .-]*?) is harder to hold down \((\d+)% TDD to (\d+)%\)/.exec(L);
      if (!m) return null;
      const hi = +m[2], lo = +m[3];
      if (hi <= lo) return `claims ${hi}% is harder to hold down than ${lo}%`;
      if (hi < 68) return `${hi}% is not a high TDD`;
      const expect = m[1] === 'he' ? s.tdDef : o.tdDef;   // "he" = this card's fighter
      if (expect != null && +expect !== hi) return `says ${hi}% but that fighter's TDD is ${expect}%`;
    },
  },
  {
    name: 'gendered noun the she/her swap cannot fix',
    probe: /./,
    // path() rewrites he->she and his->her for women's bouts and nothing else, so a
    // noun like "the harder man to hold down" survives into a women's card. It did.
    test(L) {
      const m = /\b(man|men|guy|guys|him|himself)\b/.exec(L);
      if (m) return `"${m[1]}" survives the she/her swap`;
    },
  },
  {
    name: 'broken number or grammar',
    probe: /./,
    test(L) {
      if (/\b(null|undefined|NaN)\b/.test(L)) return 'contains null/undefined/NaN';
      if (/ 1 takedowns\b/.test(L)) return '"1 takedowns"';
      if (/\(\)/.test(L) || / {2,}/.test(L)) return 'empty parens / double space';
      if (/\([^()]*\([^()]*\)[^()]*\)/.test(L)) return 'nested parens';
    },
  },
];

// Known-bad lines, including verbatim reproductions of the two real bugs.
const PLANTED = [
  ['the 88% TDD misread',        'Both want it on the mat (neither stuffs much (88% and 0% TDD)) — his edge is the busier submission game.'],
  ['volume from a non-wrestler', 'Get it to the mat — Jacoby turns away 64% of shots, so it takes volume: he lands 0 takedowns/15 and has to keep shooting.'],
  ['plural grammar',             'Get it to the mat — he lands 1 takedowns/15 and has to keep shooting.'],
  ['null leaked through',        'Keep it standing: his null% takedown defense should stall the entries.'],
  ['vulnerable at a high TDD',   'Comfortable everywhere — best route is the takedown (Jones defends only 82%).'],
  ['backwards knockdown edge',   'A striking battle — the margin is his heavier hands (0.1 vs 0.9 knockdowns/15).'],
  ['backwards output claim',     'A striking battle — he has the edge in output (4.0 vs 9.0 thrown/min).'],
  ['finish rate not the stat',   'Get it to the mat and impose top control (99% of wins are finishes).'],
  ['submission threat that is not', 'Get it to the mat — live submission threat at 0.10 per 15min.'],
  ['gendered noun',              'Both want it on the mat, and he is the harder man to hold down (88% TDD to 0%).'],
];
const CONTROL_STATS = { tdDef: 88, tdLanded: 0, finRate: 40, subAvg: 0.2 };
const CONTROL_OPP = { tdDef: 0, tdLanded: 3, finRate: 90, subAvg: 2.5 };

function main() {
  const { lines, stats, bouts, skipped } = buildLines();
  const S = (n) => stats[n] || {};
  let failed = 0;

  console.log('vetted %d lines across %d bouts (%d bouts skipped — no FIGHTER_STATS)\n',
    lines.length, bouts, skipped);

  for (const r of RULES) {
    const applies = lines.filter((l) => r.probe.test(l.line)).length;
    const hits = [];
    for (const l of lines) {
      let why;
      try { why = r.test(l.line, S(l.who), S(l.vs)); } catch (e) { why = 'rule threw: ' + e.message; }
      if (why) hits.push({ ...l, why });
    }
    const tag = hits.length ? 'FAIL ' : applies ? ' ok  ' : 'INERT';
    if (hits.length) failed++;
    console.log('%s %s  applies %s, violations %s', tag, r.name.padEnd(50),
      String(applies).padStart(4), String(hits.length).padStart(3));
    hits.slice(0, 3).forEach((x) =>
      console.log('        %s vs %s  [%s]\n          %s', x.who, x.vs, x.why, x.line.slice(0, 150)));
    // A rule that matches nothing is not passing, it is asleep.
    if (!applies) { failed++; console.log('        ^ this rule matched no line — repoint it at the current copy'); }
  }

  console.log('\ncontrol — planted bugs that MUST be caught:');
  let missed = 0;
  for (const [label, line] of PLANTED) {
    const caught = RULES.some((r) => {
      try { return !!r.test(line, CONTROL_STATS, CONTROL_OPP); } catch { return false; }
    });
    if (!caught) { missed++; console.log('  MISSED  %s', label); }
  }
  console.log('  %d of %d caught', PLANTED.length - missed, PLANTED.length);

  if (failed || missed) {
    console.log('\nFAILED: %d rule(s) violated or inert, %d planted bug(s) missed', failed, missed);
    process.exit(1);
  }
  console.log('\nall %d rules live and clean across %d lines', RULES.length, lines.length);
}

main();
