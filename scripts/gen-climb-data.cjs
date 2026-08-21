#!/usr/bin/env node
/* The Climb — board generator. Every division, in one lean file.
 *
 * Emits data/climb.json: for each weight class, the ladder the player
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
// [^a-z ] USED TO DELETE non-letters outright, which COLLAPSES a hyphen instead
// of separating on it: "Waldo Cortes-Acosta" -> "waldocortesacosta" while
// rankings.json's "Waldo Cortes Acosta" -> "waldo cortes acosta" \u2014 two different
// keys for the same #5 heavyweight, so the lookup missed and he shipped
// unranked. Found by a player: he IS ranked, the game just couldn't find him.
// Replacing any RUN of non-letters with a single space (not deleting it) fixes
// this for every hyphen/apostrophe name, not just this one.
const norm = s => String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .replace(/[^a-z]+/g,' ').trim();

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

  // ACTIVE ROSTER GATE. Recent-fight-count alone (recentUFC below) is a proxy
  // for "still on the roster", and it's a bad one for anyone who left AFTER a
  // recent run: Jailton Almeida was cut in Feb 2026 and Francis Ngannou hasn't
  // fought in the UFC since Jan 2023, and both still cleared the old filter
  // because it only asked "did you fight recently", never "are you still here".
  // Both showed up as easy unranked gatekeeper fights — found by a player.
  //
  // data/roster.json IS the real answer to "are you still here": gen-roster.cjs
  // extracts index.html's ACTIVE_ROSTER, which is hand-maintained off UFC
  // signings/releases and runs right before this script in update-odds.yml.
  // Gate on it instead of inventing a second, worse heuristic. A fighter must be
  // ranked (rankings.json, always authoritative) OR on the active roster to be
  // usable at all — recentUFC() below still decides who among the ACTIVE
  // unranked fighters is recognisable enough to be a gatekeeper.
  //
  // ENOENT (never generated yet) degrades to the old recency-only behavior —
  // this script already runs non-fatally in CI and a missing snapshot on a
  // first run is not the same failure as a corrupt or truncated one, which
  // must still throw rather than silently ship a worse board.
  let ROSTER_SET = null;
  try {
    const roster = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'roster.json'), 'utf8'));
    ROSTER_SET = new Set((roster.fighters || []).map(norm));
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
    console.warn('gen-climb-data: data/roster.json absent — falling back to recency-only roster membership (run scripts/gen-roster.cjs)');
  }

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
    // MUST ALSO be ranked or on the active roster (see ROSTER_SET above) — an
    // unranked fighter who fought recently but isn't on ROSTER_SET has left the
    // UFC, and recentUFC()'s job below is to rank recognisability among people
    // who are actually still here, not to double as a departure check it can't do.
    const usable = f => f && FIGHTER_STATS[f.name] &&
      (FIGHT_HISTORY[f.name] || []).length >= 3 && lastYear(f.name) >= ACTIVE_SINCE &&
      (!ROSTER_SET || rankOf.has(norm(f.name)) || ROSTER_SET.has(norm(f.name)));
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
    //
    // DIV_SWING: how much the division's difficulty moves every rung. sAdj spans
    // +-DIV_SWING/2, applied to every fighter on the ladder, so it is the same
    // climb shifted bodily up or down.
    //
    // 6 WAS TOO WIDE AND ITS COMMENT WAS FICTION. It claimed "a welterweight
    // champion rates 106 and a light-heavyweight champion 94" — measured, they
    // rate 109 and 103, because the comment forgot the +-6 rrNorm term sitting
    // next to it in the same expression. Six points of swing produced a belt rate
    // spanning 9%-38% across the divisions: picking the soft one was worth 4x,
    // which is a bigger lever than the entire build.
    //
    // 4 IS FITTED, NOT GUESSED. Belt% vs sAdj across all eleven divisions is
    // close to linear at about -3.7 belt-points per point of power (intercept
    // ~21). A 15-point spread — the 15%-30% target — therefore needs 15/3.7 =
    // ~4.1 points of sAdj end to end. Hence 4, giving sAdj +-2 and a predicted
    // ~14%-28%. The response compounds over a ~10-fight run, so it is exponential
    // in sAdj and the linear fit only holds over a narrow band: DO NOT
    // extrapolate this constant, re-fit it.
    // DIV_OFFSET — the division's rating shift, in POWER POINTS, CALIBRATED against
    // measured championship difficulty rather than authored from a 0-1 guess. This
    // replaces (strengthNorm-0.5)*DIV_SWING, which could only shift by RATING and so
    // was blind to STYLE: bantamweight's ladder rates normally but its fighters carry
    // 70 takedown defense and 0.69 chins across the board — no weakness to exploit —
    // so it played as a 5% belt while heavyweight's hittable, takedown-able ladder
    // played as an 80% belt at the SAME authored difficulty. A rating dial can't see
    // that; a calibrated offset can. Positive = harder (ratings up), negative = easier.
    // Fit so a balanced build wins every belt in a ~35-50% band. Re-measure with
    // scripts/sim-div-bal after any ladder/stat resync; the numbers drift with the data.
    const sAdj = DIV_OFFSET[DIV] != null ? DIV_OFFSET[DIV] : 0;
    // RR_TEXTURE: how far the sim may move a fighter WITHIN his rank tier.
    //
    // This was 12 (i.e. +-6) and it was not texture, it was the loudest term in
    // the expression. Ranked tiers are spaced 1.6 points apart (#1 86.0, #2 84.4,
    // #3 82.8...), so +-6 lets the sim reorder FOUR RANKS IN EITHER DIRECTION —
    // it doesn't separate fighters inside a tier, it shuffles the ladder and then
    // the ladder gets described as "lumpy" (measured: rung spacing -9.0 to +9.7
    // against a median of 1.8; I wrote that down as "honest" rather than reading
    // it as this constant confessing).
    //
    // Worse, it applies to the CHAMPION, so each division's final boss floats
    // +-6 depending on how his own division's round-robin happened to shake out —
    // independent of, and 3x louder than, the DIV_SWING dial that is supposed to
    // decide how hard that division is. Measured: WBW and WFLW are authored 0.00
    // and 0.12 — all but identical — and their belts came out 36% and 18%,
    // because their champions rated 101.2 and 104.5. The division dial was being
    // shouted down by a normalisation artefact.
    //
    // 4 (+-2) is bigger than the 1.6 tier gap, so the sim can still say "this #7
    // is really a #5" — a one-to-two rung opinion — and cannot say "this #12 is
    // the best contender in the division".
    const RR_TEXTURE = 4;
    const powerOf = f => {
      const r = rankNum(f);
      const tier = r === 0 ? 100 : r <= 0.5 ? 92 : r <= 15 ? 86 - (r - 1) * 1.6 : 48;
      // THE CHAMPION CARRIES NO ROUND-ROBIN TEXTURE. RR_TEXTURE separates fighters
      // WITHIN a tier — useful for the fifteen contenders — but on the belt it was a
      // ±2 coin flip on top of the ±2 DIV_SWING dial, so how hard a title was depended
      // as much on his own division's bracket luck as on the authored difficulty. That
      // is exactly why a mid-authored division could play as the softest belt in the
      // game. The champion's rating is now the division's difficulty, full stop; the
      // contenders keep their texture so the climb still has lumps.
      const texture = r === 0 ? 0 : (rrNorm(f.name) - 0.5) * RR_TEXTURE;
      return Math.round((tier + sAdj + texture) * 10) / 10;
    };
    // STYLE: read off their REAL stats, so the invented triangle bites on
    // something true.
    const styleOf = name => {
      const s = FIGHTER_STATS[name] || {};
      const g = (k, d) => { const v = numOf(s[k]); return v == null ? d : v; };
      // CHIN, from the record rather than the stat sheet. The playtest asked for
      // "a finisher with durability should have an advantage over someone with
      // durability concerns" — but there is no durability stat anywhere in the
      // data. There IS the thing durability actually means: how often does this
      // man get knocked out? Count his KO losses. Frankie Edgar and a glass-jawed
      // prospect can carry identical strDef and be completely different fights.
      //
      // Rate over LOSSES, not over all bouts: a fighter with 20 wins and 2 KO
      // losses has been stopped in 100% of the fights he lost, which is the
      // signal — losing by decision means you were beaten, losing by KO means you
      // were hurt. Fewer than 3 losses is no sample, so default to average.
      const h = FIGHT_HISTORY[name] || [];
      const losses = h.filter(b => /^L/i.test(String(b.result || '')));
      const koL = losses.filter(b => /ko|tko/i.test(String(b.method || '')) && !/sub/i.test(String(b.method || ''))).length;
      const subL = losses.filter(b => /sub/i.test(String(b.method || ''))).length;
      // SHRINK TOWARD THE MEAN. A raw rate says Grant Dawson's chin is 0.00 —
      // stopped in 3 of 3 losses — which is true and is also three coin flips.
      // Add K phantom losses at the division-average rate, so a man with 3 losses
      // is pulled toward average and a man with 12 is trusted. This is the same
      // move the sim makes with rate credibility, for the same reason: a small
      // denominator produces confident nonsense.
      const K = 3, PKO = 0.45, PSUB = 0.20;
      const chin = 1 - (koL  + K*PKO ) / (losses.length + K);   // 1 = never stopped
      const mat  = 1 - (subL + K*PSUB) / (losses.length + K);   // 1 = never tapped
      return { tdDef:g('tdDef',60), strDef:g('strDef',52), td:g('tdLanded',1.4),
               sub:g('subAvg',0.5), kd:g('kd',0.4), slpm:g('slpm',4.4),
               sapm:g('sapm',4.0), tdAcc:g('tdAcc',35),
               chin:Math.round(chin*100)/100, mat:Math.round(mat*100)/100 };
    };

    return {
      label: LABELS[DIV] || DIV,
      strength: Math.round(strengthNorm(DIV) * 100) / 100,   // 0 = softest, 1 = hardest
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

  // ---- DIVISION DIFFICULTY: not every belt is worth the same climb ----
  //
  // THIS WAS MEASURED AND IS NOW AUTHORED, AND THAT IS A REVERSAL. The old block
  // is worth stating before replacing, because it was RIGHT about its own number
  // and wrong about what the number meant.
  //
  // It read: "Playtest: in talent-heavy divisions it should be harder to climb;
  // thinner divisions (like heavyweight) should make the rise quicker. Right
  // idea, and the example is wrong — measured, HEAVYWEIGHT IS NOT WEAK." It then
  // averaged the SIM POWER SCORE of each division's ranked 15 (WW 4.97, LW 4.80,
  // FW 4.38, HW 4.28 ... LHW 3.19), fed that to DIV_SWING, and overruled the
  // playtester.
  //
  // Its own next sentence is the refutation: "Depth predicts talent well (r=0.89),
  // BUT HEAVYWEIGHT BREAKS THE TREND: shallow (177 actives) yet the 4th-strongest
  // top 15, because its ranked fighters are stat monsters even though there's
  // little behind them." That is the block telling you, in writing, that its
  // metric measures TOP-15 STAT QUALITY and the design wants DEPTH — and then
  // shipping the metric anyway and calling the playtester's example wrong.
  //
  // Measured downstream, that choice is what the game did: belt rate correlates
  // -0.86 with top-15 quality. It faithfully delivered the wrong quantity.
  //
  // WHY NOT JUST SWITCH TO DEPTH? Because it doesn't get there either. Active
  // fighters per division: LW 298, WW 296, FW 278, BW 257, MW 240, HW 177,
  // LHW 158, FLW 143, WSW 123, WFLW 84, WBW 66. Depth correlates r=0.80 with the
  // design intent vs quality's 0.67 — better, and still wrong about FLYWEIGHT,
  // which is thinner than heavyweight on any roster count and is nonetheless a
  // brutal climb. No roster statistic knows that, because "flyweight is stacked"
  // is a fact about the fighters in it, not about how many there are.
  //
  // So: the ORDER is a design decision, stated once, here, in the open. The
  // measured data still does the job it is actually good at — separating
  // fighters INSIDE a division (rrNorm, below). What it never knew was which
  // belts are supposed to be hard.
  //
  // 1.00 = the hardest climb in the game, 0.00 = the softest.
  const DIV_DIFFICULTY = {
    WW  : 1.00,   // the deepest division in the sport, and the data agrees (4.97)
    LW  : 0.92,   // 298 actives, murderers' row from #15 up
    FLW : 0.84,   // THE ONE THE DATA CANNOT SEE: small roster, no easy nights
    BW  : 0.80,
    FW  : 0.76,
    MW  : 0.55,   // "maybe even middleweight" — mid, deliberately
    HW  : 0.22,   // stat monsters at the top, little behind them: a quick rise
    WSW : 0.20,
    WFLW: 0.12,
    LHW : 0.10,   // the softest men's belt, which the data got right
    WBW : 0.00,
  };
  const strengthNorm = DIV => DIV_DIFFICULTY[DIV] == null ? 0.5 : DIV_DIFFICULTY[DIV];
  // CALIBRATED RATING OFFSET (power points), fit against measured balanced-build belt
  // rates so every division lands in a ~35-50% band. See the note at sAdj: this is the
  // dial that can compensate for STYLE-driven difficulty, which the authored 0-1 map
  // above (kept only for the cosmetic talent bar) cannot. Seeded from a measured pass;
  // positive makes a division harder, negative easier.
  const DIV_OFFSET = {
    HW:  1.7,   // hittable, takedown-able ladder — was an 80% walkover, pulled UP
    LHW:-1.25,
    MW:  2.2,
    WW:  0.95,
    LW:  0.15,
    FW: -0.35,
    BW: -0.9,   // 70 tdDef + 0.69 chins: brutal on finishers, kind to grinders. Only
                // PARTLY compensated — full compensation handed grapplers a 52% cakewalk.
                // It stays a defensive division you need the right style for.
    FLW: 1.55,
    WBW:-0.8,
    WFLW:-1.0,
    WSW:-0.7
  };
  // Kept so `node scripts/gen-climb-data.cjs --audit` can still print what the
  // fighters say, and so the next person can see the two disagree on purpose.
  const strengthOf = {};
  if (process.argv.includes('--audit')) {
    const sc = createScorer(FIGHTER_STATS, FIGHT_HISTORY, FIGHTERS);
    sc.setNow(Date.now()); sc.setRankBadge(null);
    for (const DIV of ORDER) {
      const rows = (RANKS.byDiv[DIV] || []).filter(r => r.rankNum < 99).slice(0, 15);
      const ps = rows.map(r => {
        const f = FIGHTERS.find(x => x && norm(x.name) === r.key);
        if (!f || !FIGHTER_STATS[f.name]) return null;
        const v = sc.simPowerScore(sc.getSimProfile(f.name));
        return isFinite(v) ? v : null;
      }).filter(v => v != null);
      strengthOf[DIV] = ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : null;
    }
    console.log('AUTHORED difficulty vs what the fighters say (top-15 sim power):');
    for (const DIV of ORDER)
      console.log('  ' + DIV.padEnd(6) + 'authored ' + DIV_DIFFICULTY[DIV].toFixed(2) +
        '   top15 ' + (strengthOf[DIV] == null ? '—' : strengthOf[DIV].toFixed(2)));
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
  const OUT = path.join(ROOT, 'data', 'climb.json');
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out));

  // The browser-wrapped scorer is dead weight now — remove it rather than leave
  // 90KB of stale copy next to the game for someone to wire back in by mistake.
  const dead = path.join(ROOT, 'prototypes', 'climb-scorer.js');
  if (fs.existsSync(dead)) { fs.unlinkSync(dead); }

  const kb = n => Math.round(n / 1024);
  const gz = kb(require('zlib').gzipSync(fs.readFileSync(OUT)).length);
  console.log('climb.json: ' + Object.keys(divisions).length + ' divisions, ' +
    Object.values(divisions).reduce((t, d) => t + d.ladder.length, 0) + ' fighters · ' +
    kb(fs.statSync(OUT).size) + ' KB (' + gz + ' KB gzipped)');
  if (skipped.length) console.log('  skipped (no champion or too thin): ' + skipped.join(', '));
  console.log('');
  for (const [k, d] of Object.entries(divisions)) {
    const ch = d.ladder.find(f => f.rankNum === 0);
    const bar = '#'.repeat(Math.round(d.strength * 10)).padEnd(10, '.');
    console.log('  ' + k.padEnd(5) + d.label.padEnd(22) + 'talent ' + bar + '  champ ' +
      String(ch ? ch.power : '—').padStart(6) + '  ' + (ch ? ch.name : '—'));
  }
}

if (require.main === module) main();
