#!/usr/bin/env node
/**
 * data/legends-pool.json — the Legends Bracket's fighter pool, a large-ish
 * curated list per division (not just 8). This is the "recognizable names
 * only" fix requested after the prototype's demo pool: rather than pulling
 * ANY 8 fighters out of the ~3,190-entry data/fighter-extras-full.json
 * (which is dominated by current roster depth and Contender Series
 * prospects nobody outside the sport would recognize), each division's list
 * is hand-curated — former champions, PPV headliners, Hall-of-Fame-caliber
 * careers, and current stars — cross-referenced against that same database
 * for REAL record/accolade data. The worker draws a fresh, era-mixed 8 out
 * of this pool every week (see bracketSelectPool in worker/index.js) instead
 * of it being a static list of exactly 8, which is what kept the same
 * bracket recurring every time a division came back around on the old
 * 8-fighter-only pool.
 *
 * "Power" isn't hand-typed like the prototype's mock numbers. It's computed
 * from each fighter's actual data/fighter-extras-full.json recordBreakdown --
 * win rate, finish rate, average quality-of-competition (the org tier system
 * gen-app-fighter-extras.cjs already computes for every org a fighter has
 * ever competed in, Tier 1 elite down to Tier 5) -- PLUS a manually-curated
 * title-history bonus (see `titleTier` below). The record-based half alone
 * wasn't separating "multi-time undisputed champion" from "longtime top-10
 * contender who never won the belt" enough: a durable journeyman with a
 * padded win/loss record could land within a couple of points of a legend
 * with a genuinely dominant title reign, which made the weekly bracket play
 * out closer to a coin flip than it should for a mismatch like that. The
 * title-tier bonus is the fix -- see below.
 *
 * This is the honest substitute for the real, live Fight Simulator's method
 * (round-by-round striking/grappling data), not a claim that this calls the
 * literal same function: that granular data (data/fight-grid-all.json) only
 * covers ~620 fighters from the UFC-stats era, which excludes almost every
 * legend below (Fedor, GSP, Liddell, prime Anderson Silva, ...).
 *
 * `era` is "current" (actively fighting at a high level in roughly the last
 * couple of years) or "former" (retired or long inactive at this weight) --
 * used by the worker's weekly draw to guarantee a genuine cross-era bracket
 * every week rather than leaving it to chance. It's a rough, hand-set label,
 * not derived from anything -- re-tag a fighter here as their career moves on
 * (a retirement, a comeback) rather than trying to compute it.
 *
 * `titleTier` is a hand-judged 0-3 rating of a fighter's real title history
 * in a top-level MMA org (UFC/WEC/Strikeforce/Bellator/PRIDE/RIZIN-caliber,
 * not a regional belt), used ONLY to separate "actually won it" tiers from
 * each other -- record/finish-rate/competition-quality above already reward
 * being generally good, this rewards specifically being a champion:
 *   0 = never held a top-level title (however good the résumé otherwise)
 *   1 = one-time interim champion, or a title challenger with a uniquely
 *       notable claim (e.g. a title-fight upset), but never undisputed champ
 *   2 = one-time undisputed champion of a top-level org
 *   3 = multi-time undisputed champion (in one org or across two), or a
 *       single reign so dominant it's remembered as all-time great (e.g.
 *       Demetrious Johnson's 11 defenses) -- this is the "legend" tier
 * See bracketPowerBonus below for how this converts to power points.
 *
 * Adding a fighter: add their name, one-line legacy tag, era, and titleTier
 * to LEGENDS below. They must already exist in data/fighter-extras-full.json
 * (run gen-app-fighter-extras.cjs first if they're missing) or this script
 * fails loudly rather than silently shipping a fighter with a made-up power
 * score. Keep each division's list reasonably large (16+) and with a real
 * mix of both eras -- the generator enforces a minimum of both below so a
 * division can't quietly shrink back down to an all-one-era pool.
 *
 * Run: node scripts/gen-legends-pool.cjs
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");

const EXTRAS_PATH = path.join(ROOT, "data", "fighter-extras-full.json");
const OUT_PATH = path.join(ROOT, "data", "legends-pool.json");

// [name, legacy, era, titleTier]. Curated, not derived. 24 per division, a
// real mix of current stars and former/retired legends -- the actual product
// decision ("recognizable names, not random people nobody would recognize",
// "a fairly large pool... mix of current and former notable fighters, so it
// stays evergreen"). 24 gives the weekly draw real variety -- a division's
// 8-of-24 draw has millions of possible combinations rather than repeating a
// small fixed set every few months.
const LEGENDS = {
  FLW: [
    ["Demetrious Johnson", "Longest UFC flyweight title reign ever, 11 defenses", "former", 3],
    ["Henry Cejudo", "Olympic gold medalist turned two-division champion", "former", 3],
    ["Deiveson Figueiredo", "Two-time UFC flyweight champion", "current", 3],
    ["Brandon Moreno", "First Mexican-born UFC champion", "current", 2],
    ["Joseph Benavidez", "Two-time title challenger, flyweight division mainstay", "former", 1],
    ["Kyoji Horiguchi", "RIZIN champion, first UFC flyweight title challenger", "current", 2],
    ["Ian McCall", "One of the UFC's original flyweights, division pioneer", "former", 0],
    ["Alexandre Pantoja", "Current UFC flyweight champion", "current", 2],
    ["Kai Kara-France", "Two-time UFC flyweight title challenger", "current", 1],
    ["Askar Askarov", "Undefeated-for-years flyweight title contender", "current", 1],
    ["Manel Kape", "Knockout artist, top-5 flyweight contender", "current", 0],
    ["Sergio Pettis", "Younger brother of Anthony Pettis, longtime title contender", "current", 1],
    ["John Dodson", "First UFC flyweight title challenger, dynamic knockout power", "former", 1],
    ["Tim Elliott", "Division mainstay for over a decade", "current", 0],
    ["Alex Perez", "Perennial top-10 flyweight contender", "current", 0],
    ["Jussier Formiga", "Longtime top-5 flyweight, BJJ black belt", "former", 0],
    ["Matheus Nicolau", "Longtime top-10 flyweight, elite grappler", "current", 0],
    ["Amir Albazi", "Undefeated-for-years top-5 flyweight contender", "current", 1],
    ["Tyson Nam", "Knockout artist, fan-favorite flyweight finisher", "former", 0],
    ["Ray Borg", "Former title challenger, one of the fastest finishes in UFC history", "former", 1],
    ["Wilson Reis", "Longtime top-10 flyweight, BJJ black belt", "former", 0],
    ["Louis Smolka", "Early UFC flyweight prospect and top-10 contender", "former", 0],
    ["Dustin Ortiz", "Division mainstay through the flyweight division's early years", "former", 0],
    ["Ali Bagautinov", "Former title challenger, dangerous wrestler", "former", 1],
  ],
  BW: [
    ["Dominick Cruz", "Two-time UFC bantamweight champion, pioneer of the division", "former", 3],
    ["TJ Dillashaw", "Two-time UFC bantamweight champion", "former", 3],
    ["Cody Garbrandt", "Former UFC bantamweight champion", "current", 2],
    ["Sean O'Malley", "Former UFC bantamweight champion, breakout PPV draw", "current", 2],
    ["Aljamain Sterling", "Former UFC bantamweight champion", "current", 2],
    ["Petr Yan", "Former UFC bantamweight champion", "current", 2],
    ["Urijah Faber", "WEC featherweight champion, bantamweight division godfather", "former", 2],
    ["Renan Barao", "Long-reigning WEC/UFC bantamweight champion", "former", 3],
    ["Merab Dvalishvili", "Current UFC bantamweight champion", "current", 2],
    ["Marlon Moraes", "Former WSOF champion, top UFC bantamweight title contender", "former", 2],
    ["John Lineker", "Feared knockout puncher, former title contender", "former", 1],
    ["Raphael Assuncao", "Longtime top-5 bantamweight, beat multiple champions", "former", 1],
    ["Pedro Munhoz", "Perennial top-10 bantamweight contender", "current", 0],
    ["Umar Nurmagomedov", "Undefeated rising bantamweight title contender", "current", 1],
    ["Rob Font", "Longtime top-10 bantamweight contender", "current", 0],
    ["Song Yadong", "Top-5 bantamweight contender", "current", 0],
    ["Cory Sandhagen", "Longtime top-5 bantamweight, highlight-reel finisher", "current", 1],
    ["Jimmie Rivera", "Longtime top-10 bantamweight contender", "former", 0],
    ["Eddie Wineland", "Former WEC bantamweight champion", "former", 2],
    ["Miguel Torres", "Former WEC bantamweight champion, pound-for-pound great in his prime", "former", 2],
    ["Brad Pickett", "Fan-favorite British bantamweight, longtime top-10 fixture", "former", 0],
    ["Michael McDonald", "Youngest UFC title challenger in bantamweight history", "former", 1],
    ["Iuri Alcantara", "Longtime top-10 bantamweight, dangerous submission artist", "former", 0],
    ["Jonathan Martinez", "Top-10 bantamweight contender", "current", 0],
  ],
  FW: [
    ["Jose Aldo", "First UFC featherweight champion, 10-year WEC/UFC title reign", "former", 3],
    ["Conor McGregor", "First UFC fighter to hold two titles simultaneously", "former", 3],
    ["Max Holloway", "Former UFC featherweight champion, all-time strikes leader", "current", 2],
    ["Alexander Volkanovski", "Two-time UFC featherweight champion", "current", 3],
    ["Frankie Edgar", "Former UFC lightweight champion, featherweight title challenger", "former", 2],
    ["Chad Mendes", "Two-time UFC featherweight title challenger", "former", 1],
    ["Ilia Topuria", "Undefeated two-division champion", "current", 3],
    ["Brian Ortega", "Submission specialist, two-time title challenger", "current", 1],
    ["Yair Rodriguez", "Former interim UFC featherweight champion", "current", 2],
    ["Josh Emmett", "Former interim UFC featherweight title challenger", "current", 1],
    ["Movsar Evloev", "Undefeated top-5 featherweight contender", "current", 0],
    ["Diego Lopes", "Fast-rising top-5 featherweight contender", "current", 0],
    ["Cub Swanson", "One of the longest-tenured featherweights in UFC history", "former", 0],
    ["Chan Sung Jung", "\"The Korean Zombie\", cult-favorite title challenger", "former", 1],
    ["Ricardo Lamas", "Former UFC featherweight title challenger", "former", 1],
    ["Dan Ige", "Longtime top-10 featherweight contender", "current", 0],
    ["Zabit Magomedsharipov", "Undefeated top-5 featherweight, cult-favorite finisher", "former", 0],
    ["Calvin Kattar", "Longtime top-5 featherweight, granite chin", "current", 0],
    ["Giga Chikadze", "Kickboxing knockout artist, former title contender", "current", 1],
    ["Arnold Allen", "Longtime unbeaten run, top-5 featherweight contender", "current", 0],
    ["Jeremy Stephens", "One of the longest-tenured featherweights in UFC history", "former", 0],
    ["Dooho Choi", "Explosive Korean knockout artist, cult PPV favorite", "former", 0],
    ["Mirsad Bektic", "Undefeated-for-years top-10 featherweight prospect", "former", 0],
    ["Charles Jourdain", "Fan-favorite finisher, top-15 featherweight contender", "current", 0],
  ],
  LW: [
    ["Khabib Nurmagomedov", "Undefeated UFC lightweight champion, 29-0", "former", 3],
    ["BJ Penn", "UFC Hall of Famer, two-division champion", "former", 3],
    ["Nate Diaz", "Stockton's own, two of the biggest PPV upsets in UFC history", "former", 0],
    ["Justin Gaethje", "Interim lightweight champion, Fight of the Night record holder", "current", 2],
    ["Dustin Poirier", "Former interim UFC lightweight champion", "former", 2],
    ["Charles Oliveira", "Former UFC lightweight champion, all-time UFC finishes leader", "current", 2],
    ["Islam Makhachev", "Current UFC lightweight champion", "current", 2],
    ["Tony Ferguson", "Former interim UFC lightweight champion, 12-fight win streak", "former", 2],
    ["Michael Chandler", "Three-time Bellator lightweight champion", "current", 3],
    ["Dan Hooker", "Top-10 lightweight mainstay, Fight of the Night staple", "current", 0],
    ["Beneil Dariush", "Longtime top-5 lightweight contender", "current", 0],
    ["Kevin Lee", "Former interim lightweight title challenger", "former", 1],
    ["Eddie Alvarez", "Former Bellator and UFC lightweight champion", "former", 3],
    ["Anthony Pettis", "\"Showtime\", former WEC and UFC lightweight champion", "former", 3],
    ["Rafael dos Anjos", "Former UFC lightweight champion", "former", 2],
    ["Jim Miller", "UFC's all-time wins and fights leader", "current", 0],
    ["Gilbert Melendez", "Former Strikeforce lightweight champion", "former", 2],
    ["Al Iaquinta", "Former interim lightweight title challenger on a week's notice", "former", 1],
    ["Paul Felder", "Longtime top-10 lightweight, Fight of the Night staple", "former", 0],
    ["Diego Ferreira", "Longtime top-10 lightweight, submission specialist", "former", 0],
    ["Mateusz Gamrot", "Top-5 lightweight contender, KSW champion", "current", 1],
    ["Arman Tsarukyan", "Undefeated-for-years top-5 lightweight title contender", "current", 1],
    ["Renato Moicano", "Top-10 lightweight contender, two-division veteran", "current", 0],
    ["Edson Barboza", "Legendary leg-kicker, longtime top-10 lightweight", "former", 0],
  ],
  WW: [
    ["Georges St-Pierre", "One of the greatest welterweights ever, 9 straight title defenses", "former", 3],
    ["Nick Diaz", "Former Strikeforce welterweight champion, cult PPV draw", "former", 2],
    ["Matt Hughes", "UFC Hall of Famer, dominant 2000s welterweight champion", "former", 3],
    ["Kamaru Usman", "Former UFC welterweight champion, 15-fight win streak", "current", 3],
    ["Tyron Woodley", "Former UFC welterweight champion", "former", 2],
    ["Robbie Lawler", "Former UFC welterweight champion, Fight of the Year staple", "former", 2],
    ["Johny Hendricks", "Former UFC welterweight champion", "former", 2],
    ["Leon Edwards", "Former UFC welterweight champion", "current", 2],
    ["Belal Muhammad", "Current UFC welterweight champion", "current", 2],
    ["Shavkat Rakhmonov", "Undefeated top-5 welterweight contender", "current", 0],
    ["Colby Covington", "Former interim UFC welterweight champion", "current", 2],
    ["Jorge Masvidal", "\"Gamebred\", fastest knockout in UFC history", "former", 1],
    ["Carlos Condit", "Former interim UFC welterweight champion, WEC champion", "former", 2],
    ["Josh Koscheck", "Former UFC welterweight title challenger, TUF 1 finalist", "former", 1],
    ["Diego Sanchez", "The first-ever TUF winner", "former", 0],
    ["Matt Serra", "Scored one of the biggest upsets in UFC history over GSP", "former", 2],
    ["Stephen Thompson", "Longtime top-5 welterweight, elite karate striker", "current", 1],
    ["Vicente Luque", "Longtime top-10 welterweight finisher", "current", 0],
    ["Gilbert Burns", "Former title challenger, top-5 welterweight contender", "current", 1],
    ["Neil Magny", "One of the most active welterweights in UFC history", "current", 0],
    ["Thiago Alves", "Former title challenger, feared Muay Thai striker", "former", 1],
    ["Jake Ellenberger", "Longtime top-10 welterweight knockout artist", "former", 0],
    ["Jake Shields", "Former Strikeforce welterweight champion", "former", 2],
    ["Matt Brown", "Cult-favorite brawler, one of the sport's toughest finishers", "former", 0],
  ],
  MW: [
    ["Anderson Silva", "Longest UFC middleweight title reign ever, 16 straight wins", "former", 3],
    ["Chael Sonnen", "Two-time title challenger, one of the sport's best talkers", "former", 1],
    ["Michael Bisping", "First British UFC champion", "former", 2],
    ["Israel Adesanya", "Former two-time UFC middleweight champion", "current", 3],
    ["Vitor Belfort", "Former UFC light heavyweight champion, middleweight title challenger", "former", 2],
    ["Rich Franklin", "Former UFC middleweight champion", "former", 2],
    ["Chris Weidman", "Ended Anderson Silva's title reign", "former", 2],
    ["Robert Whittaker", "Former UFC middleweight champion", "current", 2],
    ["Dricus Du Plessis", "Current UFC middleweight champion", "current", 2],
    ["Sean Strickland", "Former UFC middleweight champion", "current", 2],
    ["Paulo Costa", "Undefeated title challenger, feared power puncher", "current", 1],
    ["Yoel Romero", "Olympic silver medalist wrestler, two-time title challenger", "former", 1],
    ["Luke Rockhold", "Former UFC and Strikeforce middleweight champion", "former", 3],
    ["Jacare Souza", "Longtime top-5 middleweight, ADCC champion", "former", 0],
    ["Kelvin Gastelum", "Former TUF winner, title challenger", "current", 1],
    ["Dan Henderson", "Two-division PRIDE champion, cross-era legend", "former", 3],
    ["Jared Cannonier", "Longtime top-5 middleweight, former title challenger", "current", 1],
    ["Marvin Vettori", "Longtime top-5 middleweight, former title challenger", "current", 1],
    ["Derek Brunson", "Longtime top-10 middleweight wrestler-striker", "former", 0],
    ["Nate Marquardt", "Former title challenger, longtime top-10 middleweight", "former", 1],
    ["Gegard Mousasi", "Former Strikeforce and Bellator middleweight champion", "former", 3],
    ["Uriah Hall", "Fan-favorite knockout artist, former title challenger", "former", 1],
    ["Yushin Okami", "Longtime top-5 middleweight, former title challenger", "former", 1],
    ["Thales Leites", "Former title challenger, elite BJJ black belt", "former", 1],
  ],
  LHW: [
    ["Jon Jones", "Youngest UFC champion ever, widely considered pound-for-pound GOAT", "current", 3],
    ["Chuck Liddell", "UFC Hall of Famer, defined the light heavyweight era", "former", 2],
    ["Quinton Jackson", "PRIDE and UFC light heavyweight champion", "former", 3],
    ["Daniel Cormier", "Two-division UFC champion", "former", 3],
    ["Alexander Gustafsson", "Two-time UFC light heavyweight title challenger", "former", 1],
    ["Wanderlei Silva", "PRIDE legend, 18-fight win streak", "former", 2],
    ["Forrest Griffin", "The Ultimate Fighter 1 winner, former UFC champion", "former", 2],
    ["Lyoto Machida", "Former UFC light heavyweight champion, undefeated for years", "former", 2],
    ["Alex Pereira", "Two-division UFC champion", "current", 3],
    ["Jamahal Hill", "Former UFC light heavyweight champion", "current", 2],
    ["Magomed Ankalaev", "Current UFC light heavyweight champion", "current", 2],
    ["Jiri Prochazka", "Former UFC light heavyweight champion", "current", 2],
    ["Glover Teixeira", "UFC light heavyweight champion at age 42", "former", 2],
    ["Anthony Johnson", "One of the hardest hitters in UFC history", "former", 1],
    ["Rashad Evans", "Former UFC light heavyweight champion", "former", 2],
    ["Mauricio Rua", "\"Shogun\", PRIDE Grand Prix winner and former UFC champion", "former", 3],
    ["Dominick Reyes", "Former UFC light heavyweight title challenger", "current", 1],
    ["Volkan Oezdemir", "Former title challenger, feared knockout power", "current", 1],
    ["Corey Anderson", "Former Bellator light heavyweight champion", "current", 2],
    ["Ovince Saint Preux", "Former interim UFC light heavyweight title challenger", "former", 1],
    ["Ryan Bader", "Former Bellator light heavyweight champion", "former", 2],
    ["Phil Davis", "Longtime top-5 light heavyweight, former Bellator title challenger", "former", 1],
    ["Rogerio Nogueira", "PRIDE legend, twin brother of Antonio Rodrigo Nogueira", "former", 1],
    ["Tito Ortiz", "UFC Hall of Famer, longest light heavyweight title reign of the early era", "former", 2],
  ],
  HW: [
    ["Fedor Emelianenko", "PRIDE Heavyweight King, 2000s", "former", 3],
    ["Brock Lesnar", "Fastest fighter to a UFC heavyweight title", "former", 2],
    ["Randy Couture", "5x UFC Heavyweight Champion", "former", 3],
    ["Cain Velasquez", "Undefeated title reign, 2010s", "former", 3],
    ["Stipe Miocic", "Most UFC heavyweight title defenses", "former", 3],
    ["Francis Ngannou", "Hardest punch ever recorded", "former", 2],
    ["Junior Dos Santos", "UFC 155 champion", "former", 2],
    ["Fabricio Werdum", "Ended Fedor's 10-year unbeaten streak", "former", 2],
    ["Tom Aspinall", "Current UFC heavyweight champion", "current", 2],
    ["Ciryl Gane", "Former interim UFC heavyweight champion", "current", 2],
    ["Sergei Pavlovich", "Top-5 heavyweight contender, feared knockout power", "current", 0],
    ["Curtis Blaydes", "Longtime top-5 heavyweight wrestler-striker", "current", 0],
    ["Mark Hunt", "Cult-favorite knockout artist, K-1 champion", "former", 1],
    ["Andrei Arlovski", "Former UFC heavyweight champion", "former", 2],
    ["Antonio Rodrigo Nogueira", "\"Minotauro\", PRIDE and UFC legend", "former", 2],
    ["Alistair Overeem", "Former Strikeforce and K-1 champion", "former", 3],
    ["Derrick Lewis", "UFC's all-time knockout leader", "current", 0],
    ["Frank Mir", "Former UFC heavyweight champion, submission specialist", "former", 2],
    ["Tim Sylvia", "Former two-time UFC heavyweight champion", "former", 3],
    ["Josh Barnett", "Former UFC heavyweight champion, catch-wrestling legend", "former", 2],
    ["Pedro Rizzo", "Longtime top-5 heavyweight in the division's early era", "former", 1],
    ["Aleksei Oleinik", "One of the most active submission finishers in UFC history", "former", 0],
    ["Marcin Tybura", "Longtime top-10 heavyweight contender", "current", 0],
    ["Kevin Randleman", "Former UFC heavyweight champion, elite wrestler", "former", 2],
  ],
};

function slugify(name) {
  return name
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const extras = JSON.parse(fs.readFileSync(EXTRAS_PATH, "utf8"));
const bySlug = extras.bySlug || {};

// Org tier -> quality-of-competition score (Tier 1 elite = best).
const TIER_SCORE = { 1: 5, 2: 3.5, 3: 2, 4: 1, 5: 0.5 };

// titleTier -> power-score bonus. Spread wide enough that a multi-time
// champion (tier 3) separates clearly from a same-record fighter who never
// won a top-level title (tier 0) -- see the LEGENDS header comment for what
// each tier means. This is added on TOP of the record-based score below, not
// blended into it, specifically so two fighters with similar win/finish
// rates can still land far apart if one of them is a real former champion.
const TITLE_BONUS = { 0: 0, 1: 3, 2: 8, 3: 15 };

function computePower(slug, name, titleTier) {
  const entry = bySlug[slug];
  if (!entry || !entry.recordBreakdown) {
    console.error("gen-legends-pool: " + name + " (" + slug + ") not found in fighter-extras-full.json — add them there first (gen-app-fighter-extras.cjs) or fix the name/slug");
    process.exit(1);
  }
  const rb = entry.recordBreakdown;
  const wm = rb.winsByMethod || {};
  const lm = rb.lossesByMethod || {};
  const wins = (wm.koTko || 0) + (wm.sub || 0) + (wm.dec || 0) + (wm.dq || 0);
  const losses = (lm.koTko || 0) + (lm.sub || 0) + (lm.dec || 0) + (lm.dq || 0);
  const draws = rb.draws || 0;
  const total = wins + losses + draws;
  if (!total) {
    console.error("gen-legends-pool: " + name + " (" + slug + ") has no recorded fights in recordBreakdown");
    process.exit(1);
  }
  const winPct = wins / total;
  const finishes = (wm.koTko || 0) + (wm.sub || 0);
  const finishRate = wins ? finishes / wins : 0;

  // Weighted-average quality of every org this fighter has ever competed in,
  // weighted by how many fights they had there — a long, deep run in Tier-1
  // orgs (UFC/Bellator/PRIDE-equivalent) scores higher than a record padded
  // in Tier-4/5 promotions, same principle the site's Regional Promotion
  // Strength metric already applies fighter-profile-side.
  const orgs = rb.orgs || [];
  let qWeighted = 0, qCount = 0;
  orgs.forEach(function (o) {
    const t = o.tier && o.tier.tier;
    const score = TIER_SCORE[t] != null ? TIER_SCORE[t] : 2;
    qWeighted += score * (o.count || 0);
    qCount += (o.count || 0);
  });
  const orgQuality = qCount ? qWeighted / qCount : 2;

  if (TITLE_BONUS[titleTier] == null) {
    console.error("gen-legends-pool: " + name + " has an invalid titleTier " + titleTier + " — must be 0, 1, 2, or 3");
    process.exit(1);
  }

  // base 50 + up to 30 for win% + up to 10 for finish rate + up to 12 for
  // competition quality (org quality maxes at 5) + a title-history bonus
  // (0/3/8/15) on top -- clamped to a 40-99 band. The title bonus is what
  // keeps two fighters with a similar record from landing on top of each
  // other in the bracket's win-probability math when only one of them
  // actually won the belt.
  const raw = 50 + winPct * 30 + finishRate * 10 + orgQuality * 2.4 + TITLE_BONUS[titleTier];
  return Math.max(40, Math.min(99, Math.round(raw)));
}

const MIN_PER_DIVISION = 8;
const MIN_PER_ERA = 3;

const out = {};
Object.keys(LEGENDS).forEach(function (division) {
  out[division] = LEGENDS[division].map(function (row) {
    const name = row[0], legacy = row[1], era = row[2], titleTier = row[3];
    if (era !== "current" && era !== "former") {
      console.error("gen-legends-pool: " + name + " in " + division + " has an invalid era \"" + era + "\" — must be \"current\" or \"former\"");
      process.exit(1);
    }
    const slug = slugify(name);
    const power = computePower(slug, name, titleTier);
    return { name: name, slug: slug, legacy: legacy, power: power, photo: slug, era: era };
  });
  const list = out[division];
  if (list.length < MIN_PER_DIVISION) {
    console.error("gen-legends-pool: " + division + " has only " + list.length + " fighters, need at least " + MIN_PER_DIVISION + " for the weekly draw to have real variety");
    process.exit(1);
  }
  const slugSet = new Set();
  list.forEach(function (f) {
    if (slugSet.has(f.slug)) { console.error("gen-legends-pool: duplicate fighter " + f.name + " (" + f.slug + ") in " + division); process.exit(1); }
    slugSet.add(f.slug);
  });
  const currentCount = list.filter(function (f) { return f.era === "current"; }).length;
  const formerCount = list.length - currentCount;
  if (currentCount < MIN_PER_ERA || formerCount < MIN_PER_ERA) {
    console.error("gen-legends-pool: " + division + " needs at least " + MIN_PER_ERA + " \"current\" and " + MIN_PER_ERA + " \"former\" fighters to guarantee a cross-era bracket (has " + currentCount + " current, " + formerCount + " former)");
    process.exit(1);
  }
});

fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + "\n");
const divCount = Object.keys(out).length;
const fCount = Object.values(out).reduce(function (n, arr) { return n + arr.length; }, 0);
console.log("data/legends-pool.json: " + divCount + " divisions, " + fCount + " fighters, " + fs.statSync(OUT_PATH).size + " bytes");
