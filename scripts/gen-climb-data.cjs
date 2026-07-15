#!/usr/bin/env node
/* The Climb — board generator. Every division, in one lean file.
 *
 * Emits prototypes/climb-data.json: for each weight class, the ladder the player
 * climbs — name, rank, record, a POWER rating, and a STYLE profile. That's all.
 *
 * WHAT THIS FILE USED TO DO, AND WHY IT DOESN'T ANY MORE.
 * It used to ship FIGHTERS (3,101 rows), FIGHTER_STATS, and a trimmed
 * FIGHT_HISTORY (346 fighters, ladder + one hop), plus a browser-wrapped copy of
 * the 90KB simulator — 443KB gzipped, for ONE division. All of it existed to
 * feed the sim, because the sim refereed every fight.
 *
 * The sim no longer referees (see the-climb.html for the measurement that killed
 * it: three different builds wanted the same opponent 92% of the time — it's a
 * power ladder, not a matchup engine). The game scores fights itself, from
 * attributes and a style triangle. So none of that payload is read any more.
 *
 *     was:  443 KB gzipped, 1 division
 *     now:  ~2 KB gzipped per division — all 11 divisions in ~24 KB
 *
 * That is an 18x REDUCTION while going from one weight class to eleven. The
 * expensive part was never the game; it was carrying a referee we fired.
 *
 * The sim still runs — here, at generation time, where it costs the player
 * nothing. It does the one job it's genuinely great at: telling us how good a
 * fighter really is.
 *
 * Usage: node scripts/gen-climb-data.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const createScorer = require('./sim-backtest/_scorer.cjs');

// RANKS COME FROM data/rankings.json, NOT from the roster's rank field.
//
// The roster's FIGHTERS[].rank is stale and was quietly wrong in a way that went
// straight into the game. Playtest caught it: "roster data is wrong. Ciryl Gane
// is the interim champ, Tom Aspinall is the champ, Ilia Topuria also isn't the
// champ anymore." All confirmed:
//
//     roster says            rankings.json says (synced 2026-07-14)
//     Tom Aspinall  = NR     Tom Aspinall  = HW CHAMPION
//     Ilia Topuria  = #C     Justin Gaethje = LW champion, Topuria #1
//     LHW champion  = Alex Pereira AND Carlos Ulberg  (two belts, one division)
//
// data/rankings.json is the UFC media panel, updated manually every week. It is
// the source of truth for who holds a belt. The roster field is a fossil, and
// building the ladder on it meant the game's climb ended at a champion who
// isn't one — the single most visible fact in the whole game.
const RANKDIV = {
  'Heavyweight':'HW', 'Light Heavyweight':'LHW', 'Middleweight':'MW',
  'Welterweight':'WW', 'Lightweight':'LW', 'Featherweight':'FW',
  'Bantamweight':'BW', 'Flyweight':'FLW', "Women's Bantamweight":'WBW',
  "Women's Flyweight":'WFLW', "Women's Strawweight":'WSW'
};
// Pound-for-pound is a list, not a division — a fighter there also appears in
// their real weight class, so including it would give them two ranks.
const norm = s => String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .replace(/[^a-z ]/g,'').replace(/\s+/g,' ').trim();

function loadRanks() {
  const R = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'rankings.json'), 'utf8'));
  const byDiv = {};   // div -> [{name, rankNum, rankText}]
  for (const row of R.data) {
    const div = RANKDIV[row.division];
    if (!div) continue;                       // skips P4P
    const rankNum = row.isChampion ? 0
      : /^IC$/i.test(String(row.rankText||'')) ? 0.5
      : (row.rank != null ? +row.rank : 99);
    (byDiv[div] = byDiv[div] || []).push({
      name: row.fighterName, key: norm(row.fighterName),
      rankNum, rankText: row.isChampion ? '#C' : (rankNum===0.5 ? '#IC' : '#'+rankNum)
    });
  }
  return { byDiv, syncedAt: (R.meta && (R.meta.syncedAt || R.meta.latestSnapshotDate)) || null };
}

// Real UFC weight classes. The roster also carries '?', 'WFW' and 'WFLY' with
// 5-10 fighters and NO champion between them — defunct or mis-keyed divisions.
// A division with no belt isn't a climb, so the requirement is structural (a
// champion + enough bodies), not a hand-written allowlist that rots.
const LABELS = {
  HW:'Heavyweight', LHW:'Light Heavyweight', MW:'Middleweight', WW:'Welterweight',
  LW:'Lightweight', FW:'Featherweight', BW:'Bantamweight', FLW:'Flyweight',
  WBW:"Women's Bantamweight", WFLW:"Women's Flyweight", WSW:"Women's Strawweight"
};
const ORDER = ['HW','LHW','MW','WW','LW','FW','BW','FLW','WBW','WFLW','WSW'];

function main() {
  const D = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'sim-backtest', '_sim-data.json'), 'utf8'));
  const { FIGHTERS, FIGHTER_STATS, FIGHT_HISTORY } = D;

  const lastYear = n => {
    const ys = (FIGHT_HISTORY[n] || []).map(b => +((/(\d{4})/.exec(b.date || '') || [])[1] || 0));
    return ys.length ? Math.max(...ys) : 0;
  };
  const THIS_YEAR = new Date().getFullYear();
  const ACTIVE_SINCE = THIS_YEAR - 8;      // ~2018+: still recognisable to a current fan

  // The roster writes the champion as "#C" and the interim as "#IC" — NOT
  // "Champion" or "C". A parser looking for the word "champ" matches neither,
  // finds no digits, and files Ilia Topuria as UNRANKED. That put the champion in
  // the gatekeeper pool and made the belt literally unreachable — 0 champions in
  // 25 test runs, which is how it was caught.
  const RANKS = loadRanks();
  const numOf = v => { const m = /(-?\d+(\.\d+)?)/.exec(String(v == null ? '' : v)); return m ? +m[1] : null; };

  const RANKED_MAX = 16, UNRANKED_POOL = 24;

  function buildDivision(DIV) {
    const rows = RANKS.byDiv[DIV] || [];
    const rankOf = new Map(rows.map(r => [r.key, r]));
    const rankNum = f => { const r = rankOf.get(norm(f.name)); return r ? r.rankNum : 99; };
    const rankTxt = f => { const r = rankOf.get(norm(f.name)); return r ? r.rankText : 'NR'; };

    // Division membership: ranked fighters belong to the division the PANEL puts
    // them in, whatever the roster says. Everyone else falls back to the roster.
    const usable = f => f && FIGHTER_STATS[f.name] &&
      (FIGHT_HISTORY[f.name] || []).length >= 3 && lastYear(f.name) >= ACTIVE_SINCE;
    const inDiv = FIGHTERS.filter(f => usable(f) &&
      (rankOf.has(norm(f.name)) || (f.division === DIV && !isRankedElsewhere(f, DIV))));
    const sorted = inDiv.slice().sort((a, b) => rankNum(a) - rankNum(b));
    const ranked = sorted.filter(f => rankNum(f) < 99).slice(0, RANKED_MAX);
    if (!ranked.some(f => rankNum(f) === 0)) return null;      // no belt, no climb

    // Gatekeepers: rank by RECENT UFC activity, not career volume. Playtest: "a
    // name that keeps popping up is Sam Stout, I don't even know who that is."
    // Sorting the unranked pool by MOST UFC FIGHTS is a retired-journeyman
    // detector — Cerrone, Guida, Stephens all outrank anyone current on career
    // volume. Fighting names nobody recognises makes the run mean nothing.
    const recentUFC = n => (FIGHT_HISTORY[n] || []).filter(b =>
      /UFC/i.test(b.org || '') && +((/(\d{4})/.exec(b.date || '') || [])[1] || 0) >= ACTIVE_SINCE).length;
    const unranked = sorted.filter(f => rankNum(f) === 99)
      .map(f => ({ f, n: recentUFC(f.name) })).filter(x => x.n >= 2)
      .sort((a, b) => b.n - a.n).slice(0, UNRANKED_POOL).map(x => x.f);
    if (unranked.length < 8) return null;      // too thin for an early career

    const ladder = ranked.concat(unranked);

    // ROUND-ROBIN: the sim's full opinion of each fighter — stats, record,
    // unproven penalty, the lot — expressed as avg win prob vs their own
    // division. NOT simPowerScore(), which is raw stats and rates a 3-fight
    // prospect above the champion.
    const sc = createScorer(FIGHTER_STATS, FIGHT_HISTORY, FIGHTERS);
    sc.setNow(Date.now()); sc.setRankBadge(null);
    const names = ladder.map(f => f.name), rr = {};
    for (const a of names) {
      let s = 0, c = 0;
      for (const b of names) { if (a === b) continue; const p = sc.simWinProbability(a, b); if (p != null) { s += p; c++; } }
      rr[a] = c ? s / c : 0.5;
    }
    const vals = Object.values(rr).sort((a, b) => a - b);
    const lo = vals[0], hi = vals[vals.length - 1];
    const rrNorm = n => (hi > lo) ? (rr[n] - lo) / (hi - lo) : 0.5;

    // POWER: rank-led, sim-textured. The sim's own ordering is NOT the UFC's —
    // round-robined it puts Benoît Saint Denis and a 3-fight Quillan Salkilld
    // above Topuria, drops Michael Chandler to last of 40, and agrees with the
    // real rankings on only 68% of ranked pairs. Fine statistics, absurd climb:
    // nobody believes fighting Salkilld is harder than fighting the champion.
    // The RANK is what the player is climbing, so the rank leads. The sim then
    // separates fighters INSIDE a tier — exactly what an integer from a media
    // panel cannot do.
    //
    // Identical tier shape in every division, which is what should let one set
    // of difficulty dials cover all eleven.
    const powerOf = f => {
      const r = rankNum(f);
      const tier = r === 0 ? 100 : r <= 0.5 ? 92 : r <= 15 ? 86 - (r - 1) * 1.6 : 48;
      return Math.round((tier + (rrNorm(f.name) - 0.5) * 12) * 10) / 10;
    };
    // STYLE: read off their REAL stats, so the invented triangle bites on
    // something true.
    const styleOf = name => {
      const s = FIGHTER_STATS[name] || {};
      const g = (k, d) => { const v = numOf(s[k]); return v == null ? d : v; };
      return { tdDef:g('tdDef',60), strDef:g('strDef',52), td:g('tdLanded',1.4),
               sub:g('subAvg',0.5), kd:g('kd',0.4), slpm:g('slpm',4.4),
               sapm:g('sapm',4.0), tdAcc:g('tdAcc',35) };
    };

    return {
      label: LABELS[DIV] || DIV,
      ladder: ladder.map(f => ({
        name: f.name, rank: rankTxt(f), record: f.record, initials: f.initials,
        country: f.country, rankNum: rankNum(f), power: powerOf(f), style: styleOf(f.name)
      }))
    };
  }

  // A ranked fighter must not also be dragged into their OLD division by a stale
  // roster row. Islam Makhachev is ranked at welterweight; the roster agreeing is
  // luck, not design.
  function isRankedElsewhere(f, DIV) {
    const k = norm(f.name);
    for (const [d, rows] of Object.entries(RANKS.byDiv))
      if (d !== DIV && rows.some(r => r.key === k)) return true;
    return false;
  }

  const divisions = {};
  const skipped = [];
  for (const DIV of ORDER) {
    const d = buildDivision(DIV);
    if (d) divisions[DIV] = d; else skipped.push(DIV);
  }

  const out = {
    generatedAt: new Date().toISOString(),
    ranksSyncedAt: RANKS.syncedAt,
    note: 'The Climb — every division. Ranks from data/rankings.json (UFC media panel, updated weekly), NOT the stale roster rank field. Ladder only: the sim scores nothing at runtime, ' +
          'so FIGHTERS/FIGHTER_STATS/FIGHT_HISTORY and the 90KB scorer are no longer shipped.',
    order: Object.keys(divisions),
    divisions
  };
  const OUT = path.join(ROOT, 'prototypes', 'climb-data.json');
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out));

  // The browser-wrapped scorer is dead weight now — remove it rather than leave
  // 90KB of stale copy next to the game for someone to wire back in by mistake.
  const dead = path.join(ROOT, 'prototypes', 'climb-scorer.js');
  if (fs.existsSync(dead)) { fs.unlinkSync(dead); }

  const kb = n => Math.round(n / 1024);
  const gz = kb(require('zlib').gzipSync(fs.readFileSync(OUT)).length);
  console.log('climb-data.json: ' + Object.keys(divisions).length + ' divisions, ' +
    Object.values(divisions).reduce((t, d) => t + d.ladder.length, 0) + ' fighters · ' +
    kb(fs.statSync(OUT).size) + ' KB (' + gz + ' KB gzipped)');
  if (skipped.length) console.log('  skipped (no champion or too thin): ' + skipped.join(', '));
  console.log('');
  for (const [k, d] of Object.entries(divisions)) {
    const ch = d.ladder.find(f => f.rankNum === 0);
    console.log('  ' + k.padEnd(5) + d.label.padEnd(22) + String(d.ladder.length).padStart(3) + ' deep   champ: ' + (ch ? ch.name : '—'));
  }
}

if (require.main === module) main();
