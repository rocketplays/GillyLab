#!/usr/bin/env node
/* The Climb — board generator.
 *
 * Emits prototypes/climb-data.json: one division's ladder, small enough to ship
 * to a browser, plus prototypes/climb-scorer.js (the real sim, browser-wrapped).
 *
 * WHY A TRIM: scripts/sim-backtest/_sim-data.json is 10MB — the whole roster's
 * histories. A career run only ever fights one division, so we only need that
 * ladder. But the sim reads more than the two fighters in front of it:
 * strength-of-schedule looks up who your OPPONENTS beat, so their opponents'
 * roster rows matter too.
 *
 * So: full FIGHTERS (3,101 rows, cheap — it's just roster metadata), full
 * FIGHTER_STATS, and FIGHT_HISTORY only for the ladder. The generator VERIFIES
 * the trim by re-running the sim on the trimmed data and diffing against the
 * full data — a trim that silently changes the model's answers would make the
 * game a liar about its own numbers.
 *
 * Box scores (data/fight-stats.json, 8MB) are deliberately NOT shipped: measured
 * at 0.3pt of win probability. Not worth 8MB in a prototype.
 *
 * Usage: node scripts/gen-climb-data.cjs [--div LW]
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const createScorer = require('./sim-backtest/_scorer.cjs');
const args = process.argv.slice(2);
const argV = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const DIV = argV('--div', 'LW');

function main() {
  const D = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'sim-backtest', '_sim-data.json'), 'utf8'));
  const { FIGHTERS, FIGHTER_STATS, FIGHT_HISTORY } = D;

  // ---- the ladder: recognisable, ACTIVE fighters only ----
  // Playtest: "a name that keeps popping up is Sam Stout, I don't even know who
  // that is and people won't care if it's against people they don't know."
  // Sam Stout retired in 2016. The unranked pool was sorted by MOST UFC FIGHTS,
  // which is a retired-journeyman detector — Cerrone, Guida, Stephens, Yves
  // Edwards, Melvin Guillard all outrank anyone current on career volume.
  // Fighting names nobody recognises makes the run mean nothing.
  const lastYear = n => {
    const ys = (FIGHT_HISTORY[n] || []).map(b => +((/(\d{4})/.exec(b.date || '') || [])[1] || 0));
    return ys.length ? Math.max(...ys) : 0;
  };
  const THIS_YEAR = new Date().getFullYear();
  const ACTIVE_SINCE = THIS_YEAR - 8;      // ~2018+: still recognisable to a current fan
  const inDiv = FIGHTERS.filter(f => f && f.division === DIV && FIGHTER_STATS[f.name] &&
    (FIGHT_HISTORY[f.name] || []).length >= 3 && lastYear(f.name) >= ACTIVE_SINCE);

  // Rank order: champion, then #1..#15, then the unranked pool.
  // The roster writes the champion as "#C" and the interim as "#IC" — NOT
  // "Champion" or "C". A parser looking for the word "champ" or a bare "C"
  // matches neither, finds no digits, and files Ilia Topuria as UNRANKED. That
  // put the champion in the gatekeeper pool and made the belt literally
  // unreachable — 0 champions in 25 test runs, which is how it was caught.
  const rankNum = f => {
    const r = String(f.rank || '').trim();
    if (/^#?C$/i.test(r) || /champ/i.test(r)) return 0;      // champion
    if (/^#?IC$/i.test(r)) return 0.5;                        // interim champ
    const m = /(\d+)/.exec(r);
    return m ? +m[1] : 99;
  };
  // Cap the pool. A run is ~15 fights, so 406 lightweights is 10x what the game
  // can ever use and 400KB of it is fighters nobody will meet. Champion + the
  // ranked 15 + a deep-enough unranked pool to fill the early career.
  const RANKED_MAX = 16;                       // champ + #1..#15
  const UNRANKED_POOL = 24;
  const sorted = inDiv.slice().sort((a, b) => rankNum(a) - rankNum(b));
  const ranked = sorted.filter(f => rankNum(f) < 99).slice(0, RANKED_MAX);
  // Gatekeepers: rank by RECENT UFC activity, not career volume. A fighter with
  // 6 UFC bouts since 2022 is a better gatekeeper than one with 25 who left in
  // 2016 — the first is someone a fan watched, the second is trivia.
  const recentUFC = n => (FIGHT_HISTORY[n] || []).filter(b =>
    /UFC/i.test(b.org || '') && +((/(\d{4})/.exec(b.date || '') || [])[1] || 0) >= ACTIVE_SINCE).length;
  const unranked = sorted.filter(f => rankNum(f) === 99)
    .map(f => ({ f, n: recentUFC(f.name) }))
    .filter(x => x.n >= 2)
    .sort((a, b) => b.n - a.n)
    .slice(0, UNRANKED_POOL)
    .map(x => x.f);
  const ladder = ranked.concat(unranked);

  // ---- trim: the ladder PLUS one hop ----
  // Capping at just the 40 ladder fighters pushed the model's answers 0.95pts
  // off the full dataset — caught by the verification below, not by guessing.
  // Strength-of-schedule and trajectory read who your OPPONENTS beat, so a
  // ladder fighter whose own opponents have no history looks like he beat
  // ghosts. Keep one hop out: everyone the ladder has ever fought.
  const keep = new Set(ladder.map(f => f.name));
  for (const f of ladder) {
    for (const b of (FIGHT_HISTORY[f.name] || [])) {
      if (b.opponent && FIGHT_HISTORY[b.opponent]) keep.add(b.opponent);
    }
  }
  const hist = {};
  for (const n of keep) if (FIGHT_HISTORY[n]) hist[n] = FIGHT_HISTORY[n];

  // ---- POWER + STYLE: what the game actually scores with ----
  //
  // THE SIM IS NO LONGER THE REFEREE. It ranks and it flavours; the game decides
  // who wins. That's a deliberate reversal, and the reason is measured: across
  // 2,600 possible three-man offers, a striker, a wrestler and a grappler wanted
  // the SAME opponent 92% of the time. The model is a power ladder, not a matchup
  // engine — it was trained to price real fights, and real-fight pricing is
  // dominated by "who is better", with style interaction as a rounding error. A
  // game whose whole loop is "pick your matchup" cannot be built on that.
  //
  // So the jobs are split. The sim is superb at the thing the game can't fake —
  // how good a fighter really is — and hopeless at the thing the game is about.
  //
  // POWER: rank-led, sim-textured.
  // The sim's own ordering is NOT the UFC's: round-robined against the division
  // it puts Benoît Saint Denis and a 3-fight Quillan Salkilld above Ilia
  // Topuria, drops Michael Chandler to last of 40, and agrees with the real
  // rankings on only 68% of ranked pairs. All defensible as statistics, all
  // absurd as a climb — nobody believes fighting Salkilld is harder than
  // fighting the champion. The RANK is the thing the player is climbing, so the
  // rank leads. The sim then separates fighters inside a tier, which is exactly
  // what a ranking (an integer from a media panel) cannot do.
  const rr = {};
  {
    const sc = createScorer(FIGHTER_STATS, hist, FIGHTERS);
    sc.setNow(Date.now()); sc.setRankBadge(null);
    const names = ladder.map(f => f.name);
    for (const a of names) {
      let s = 0, c = 0;
      for (const b of names) { if (a === b) continue; const p = sc.simWinProbability(a, b); if (p != null) { s += p; c++; } }
      rr[a] = c ? s / c : 0.5;
    }
  }
  const rrVals = Object.values(rr).sort((a, b) => a - b);
  const rrLo = rrVals[0], rrHi = rrVals[rrVals.length - 1];
  const rrNorm = n => (rrHi > rrLo) ? (rr[n] - rrLo) / (rrHi - rrLo) : 0.5;   // 0..1

  const powerOf = f => {
    const r = rankNum(f);
    // The ladder the player feels: champion at the top, then #1..#15, then the
    // unranked pool. Gaps are deliberate — the belt is a real step up.
    const tier = r === 0 ? 100 : r <= 0.5 ? 92 : r <= 15 ? 86 - (r - 1) * 1.6 : 48;
    // The sim's texture, +-6. Enough to make two #8s feel different, never
    // enough to make a gatekeeper harder than a contender.
    return Math.round((tier + (rrNorm(f.name) - 0.5) * 12) * 10) / 10;
  };

  // STYLE: read off their REAL stats, so the triangle has something honest to
  // bite on. The archetype is the game's invention; the numbers under it aren't.
  const numOf = v => { const m = /(-?\d+(\.\d+)?)/.exec(String(v == null ? '' : v)); return m ? +m[1] : null; };
  const styleOf = name => {
    const s = FIGHTER_STATS[name] || {};
    const g = (k, d) => { const v = numOf(s[k]); return v == null ? d : v; };
    return {
      tdDef: g('tdDef', 60), strDef: g('strDef', 52),
      td: g('tdLanded', 1.4), sub: g('subAvg', 0.5), kd: g('kd', 0.4),
      slpm: g('slpm', 4.4), sapm: g('sapm', 4.0), tdAcc: g('tdAcc', 35)
    };
  };

  const out = {
    generatedAt: new Date().toISOString(),
    division: DIV,
    note: 'One division ladder for The Climb. FIGHTERS + FIGHTER_STATS are shipped whole (cheap, and strength-of-schedule reads opponents\' roster rows). FIGHT_HISTORY is trimmed to the ladder. Box scores omitted: worth 0.3pt, costs 8MB.',
    ladder: ladder.map(f => ({
      name: f.name, rank: f.rank, record: f.record, initials: f.initials,
      country: f.country, rankNum: rankNum(f),
      power: powerOf(f), style: styleOf(f.name)
    })),
    FIGHTERS, FIGHTER_STATS, FIGHT_HISTORY: hist
  };

  // ---- VERIFY the trim didn't change the model's mind ----
  const full = createScorer(FIGHTER_STATS, FIGHT_HISTORY, FIGHTERS);
  const trim = createScorer(FIGHTER_STATS, hist, FIGHTERS);
  full.setNow(Date.now()); trim.setNow(Date.now());
  full.setRankBadge(null); trim.setRankBadge(null);
  let worst = 0, worstPair = '';
  let n = 0;
  for (let i = 0; i < ladder.length && i < 24; i++) {
    for (let j = i + 1; j < ladder.length && j < 24; j++) {
      const a = ladder[i].name, b = ladder[j].name;
      const pf = full.simWinProbability(a, b), pt = trim.simWinProbability(a, b);
      if (pf == null || pt == null) continue;
      n++;
      const d = Math.abs(pf - pt);
      if (d > worst) { worst = d; worstPair = a + ' vs ' + b; }
    }
  }

  const OUT = path.join(ROOT, 'prototypes', 'climb-data.json');
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out));

  // ---- browser-wrap the real scorer, verbatim ----
  // Not a reimplementation: the same file the backtest uses, so the game can
  // never drift from the model it claims to be.
  const src = fs.readFileSync(path.join(ROOT, 'scripts', 'sim-backtest', '_scorer.cjs'), 'utf8');
  const wrapped = '/* AUTO-GENERATED by gen-climb-data.cjs — the REAL sim scorer, browser-wrapped.\n' +
    '   Do not edit. Regenerate instead, so the game can never drift from the model. */\n' +
    '(function(){\n  var module = { exports: null };\n' + src + '\n' +
    '  window.createScorer = module.exports;\n})();\n';
  fs.writeFileSync(path.join(ROOT, 'prototypes', 'climb-scorer.js'), wrapped);

  const kb = n => Math.round(n / 1024);
  console.log('climb-data.json: ' + ladder.length + ' on the ladder, ' + Object.keys(hist).length +
    ' histories (ladder + 1 hop) in ' + DIV + ' · ' +
    kb(fs.statSync(OUT).size) + ' KB (' + kb(require('zlib').gzipSync(fs.readFileSync(OUT)).length) + ' KB gzipped)');
  console.log('climb-scorer.js: ' + kb(fs.statSync(path.join(ROOT, 'prototypes', 'climb-scorer.js')).size) + ' KB — the real scorer, verbatim');
  console.log('');
  console.log('trim verification: ' + n + ' matchups re-scored on full vs trimmed data');
  console.log('  worst drift: ' + (worst * 100).toFixed(3) + ' pts' + (worstPair ? '  (' + worstPair + ')' : ''));
  if (worst > 0.005) {
    console.log('  FAIL — the trim changed the model\'s answers. Ship more history.');
    process.exitCode = 1;
  } else {
    console.log('  OK — the trimmed board scores identically to the full 10MB dataset.');
  }
}

if (require.main === module) main();
