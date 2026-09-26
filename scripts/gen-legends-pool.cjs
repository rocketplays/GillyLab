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
 * from each fighter's actual data/fighter-extras-full.json recordBreakdown:
 * win rate, finish rate, and average quality-of-competition (the org tier
 * system gen-app-fighter-extras.cjs already computes for every org a fighter
 * has ever competed in — Tier 1 elite down to Tier 5). This is the same
 * "quality of opposition matters, not just the record" philosophy the real
 * GillyLab Fight Simulator runs on, applied to the data that actually EXISTS
 * for retired/cross-era fighters — the granular round-by-round striking grid
 * (data/fight-grid-all.json) the live simulator uses only covers ~620 fighters
 * from the UFC-stats era, which excludes almost every legend below (Fedor,
 * GSP, Liddell, prime Anderson Silva, ...). A record-and-competition-quality
 * model is the honest substitute, not a claim that this calls the literal
 * same function the Fight Simulator does.
 *
 * `era` is "current" (actively fighting at a high level in roughly the last
 * couple of years) or "former" (retired or long inactive at this weight) —
 * used by the worker's weekly draw to guarantee a genuine cross-era bracket
 * every week rather than leaving it to chance. It's a rough, hand-set label,
 * not derived from anything — re-tag a fighter here as their career moves on
 * (a retirement, a comeback) rather than trying to compute it.
 *
 * Adding a fighter: add their name, one-line legacy tag, and era to LEGENDS
 * below. They must already exist in data/fighter-extras-full.json (run
 * gen-app-fighter-extras.cjs first if they're missing) or this script fails
 * loudly rather than silently shipping a fighter with a made-up power score.
 * Keep each division's list reasonably large (16+) and with a real mix of
 * both eras — the generator enforces a minimum of both below so a division
 * can't quietly shrink back down to an all-one-era pool.
 *
 * Run: node scripts/gen-legends-pool.cjs
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");

const EXTRAS_PATH = path.join(ROOT, "data", "fighter-extras-full.json");
const OUT_PATH = path.join(ROOT, "data", "legends-pool.json");

// [name, legacy, era]. Curated, not derived. Roughly 16 per division, a real
// mix of current stars and former/retired legends -- the actual product
// decision ("recognizable names, not random people nobody would recognize",
// "a fairly large pool... mix of current and former notable fighters").
const LEGENDS = {
  FLW: [
    ["Demetrious Johnson", "Longest UFC flyweight title reign ever, 11 defenses", "former"],
    ["Henry Cejudo", "Olympic gold medalist turned two-division champion", "former"],
    ["Deiveson Figueiredo", "Two-time UFC flyweight champion", "current"],
    ["Brandon Moreno", "First Mexican-born UFC champion", "current"],
    ["Joseph Benavidez", "Two-time title challenger, flyweight division mainstay", "former"],
    ["Kyoji Horiguchi", "RIZIN champion, first UFC flyweight title challenger", "current"],
    ["Ian McCall", "One of the UFC's original flyweights, division pioneer", "former"],
    ["Alexandre Pantoja", "Current UFC flyweight champion", "current"],
    ["Kai Kara-France", "Two-time UFC flyweight title challenger", "current"],
    ["Askar Askarov", "Undefeated-for-years flyweight title contender", "current"],
    ["Manel Kape", "Knockout artist, top-5 flyweight contender", "current"],
    ["Sergio Pettis", "Younger brother of Anthony Pettis, longtime title contender", "current"],
    ["John Dodson", "First UFC flyweight title challenger, dynamic knockout power", "former"],
    ["Tim Elliott", "Division mainstay for over a decade", "current"],
    ["Alex Perez", "Perennial top-10 flyweight contender", "current"],
    ["Jussier Formiga", "Longtime top-5 flyweight, BJJ black belt", "former"],
  ],
  BW: [
    ["Dominick Cruz", "Two-time UFC bantamweight champion, pioneer of the division", "former"],
    ["TJ Dillashaw", "Two-time UFC bantamweight champion", "former"],
    ["Cody Garbrandt", "Former UFC bantamweight champion", "current"],
    ["Sean O'Malley", "Former UFC bantamweight champion, breakout PPV draw", "current"],
    ["Aljamain Sterling", "Former UFC bantamweight champion", "current"],
    ["Petr Yan", "Former UFC bantamweight champion", "current"],
    ["Urijah Faber", "WEC featherweight champion, bantamweight division godfather", "former"],
    ["Renan Barao", "Long-reigning WEC/UFC bantamweight champion", "former"],
    ["Merab Dvalishvili", "Current UFC bantamweight champion", "current"],
    ["Marlon Moraes", "Former WSOF champion, top UFC bantamweight title contender", "former"],
    ["John Lineker", "Feared knockout puncher, former title contender", "former"],
    ["Raphael Assuncao", "Longtime top-5 bantamweight, beat multiple champions", "former"],
    ["Pedro Munhoz", "Perennial top-10 bantamweight contender", "current"],
    ["Umar Nurmagomedov", "Undefeated rising bantamweight title contender", "current"],
    ["Rob Font", "Longtime top-10 bantamweight contender", "current"],
    ["Song Yadong", "Top-5 bantamweight contender", "current"],
  ],
  FW: [
    ["Jose Aldo", "First UFC featherweight champion, 10-year WEC/UFC title reign", "former"],
    ["Conor McGregor", "First UFC fighter to hold two titles simultaneously", "former"],
    ["Max Holloway", "Former UFC featherweight champion, all-time strikes leader", "current"],
    ["Alexander Volkanovski", "Two-time UFC featherweight champion", "current"],
    ["Frankie Edgar", "Former UFC lightweight champion, featherweight title challenger", "former"],
    ["Chad Mendes", "Two-time UFC featherweight title challenger", "former"],
    ["Ilia Topuria", "Undefeated two-division champion", "current"],
    ["Brian Ortega", "Submission specialist, two-time title challenger", "current"],
    ["Yair Rodriguez", "Former interim UFC featherweight champion", "current"],
    ["Josh Emmett", "Former interim UFC featherweight title challenger", "current"],
    ["Movsar Evloev", "Undefeated top-5 featherweight contender", "current"],
    ["Diego Lopes", "Fast-rising top-5 featherweight contender", "current"],
    ["Cub Swanson", "One of the longest-tenured featherweights in UFC history", "former"],
    ["Chan Sung Jung", "\"The Korean Zombie\", cult-favorite title challenger", "former"],
    ["Ricardo Lamas", "Former UFC featherweight title challenger", "former"],
    ["Dan Ige", "Longtime top-10 featherweight contender", "current"],
  ],
  LW: [
    ["Khabib Nurmagomedov", "Undefeated UFC lightweight champion, 29-0", "former"],
    ["BJ Penn", "UFC Hall of Famer, two-division champion", "former"],
    ["Nate Diaz", "Stockton's own, two of the biggest PPV upsets in UFC history", "former"],
    ["Justin Gaethje", "Interim lightweight champion, Fight of the Night record holder", "current"],
    ["Dustin Poirier", "Former interim UFC lightweight champion", "former"],
    ["Charles Oliveira", "Former UFC lightweight champion, all-time UFC finishes leader", "current"],
    ["Islam Makhachev", "Current UFC lightweight champion", "current"],
    ["Tony Ferguson", "Former interim UFC lightweight champion, 12-fight win streak", "former"],
    ["Michael Chandler", "Three-time Bellator lightweight champion", "current"],
    ["Dan Hooker", "Top-10 lightweight mainstay, Fight of the Year staple", "current"],
    ["Beneil Dariush", "Longtime top-5 lightweight contender", "current"],
    ["Kevin Lee", "Former interim lightweight title challenger", "former"],
    ["Eddie Alvarez", "Former Bellator and UFC lightweight champion", "former"],
    ["Anthony Pettis", "\"Showtime\", former WEC and UFC lightweight champion", "former"],
    ["Rafael dos Anjos", "Former UFC lightweight champion", "former"],
    ["Jim Miller", "UFC's all-time wins and fights leader", "current"],
  ],
  WW: [
    ["Georges St-Pierre", "One of the greatest welterweights ever, 9 straight title defenses", "former"],
    ["Nick Diaz", "Former Strikeforce welterweight champion, cult PPV draw", "former"],
    ["Matt Hughes", "UFC Hall of Famer, dominant 2000s welterweight champion", "former"],
    ["Kamaru Usman", "Former UFC welterweight champion, 15-fight win streak", "current"],
    ["Tyron Woodley", "Former UFC welterweight champion", "former"],
    ["Robbie Lawler", "Former UFC welterweight champion, Fight of the Year staple", "former"],
    ["Johny Hendricks", "Former UFC welterweight champion", "former"],
    ["Leon Edwards", "Former UFC welterweight champion", "current"],
    ["Belal Muhammad", "Current UFC welterweight champion", "current"],
    ["Shavkat Rakhmonov", "Undefeated top-5 welterweight contender", "current"],
    ["Colby Covington", "Former interim UFC welterweight champion", "current"],
    ["Jorge Masvidal", "\"Gamebred\", fastest knockout in UFC history", "former"],
    ["Carlos Condit", "Former interim UFC welterweight champion, WEC champion", "former"],
    ["Josh Koscheck", "Former UFC welterweight title challenger, TUF 1 finalist", "former"],
    ["Diego Sanchez", "The first-ever TUF winner", "former"],
    ["Matt Serra", "Scored one of the biggest upsets in UFC history over GSP", "former"],
  ],
  MW: [
    ["Anderson Silva", "Longest UFC middleweight title reign ever, 16 straight wins", "former"],
    ["Chael Sonnen", "Two-time title challenger, one of the sport's best talkers", "former"],
    ["Michael Bisping", "First British UFC champion", "former"],
    ["Israel Adesanya", "Former two-time UFC middleweight champion", "current"],
    ["Vitor Belfort", "Former UFC light heavyweight champion, middleweight title challenger", "former"],
    ["Rich Franklin", "Former UFC middleweight champion", "former"],
    ["Chris Weidman", "Ended Anderson Silva's title reign", "former"],
    ["Robert Whittaker", "Former UFC middleweight champion", "current"],
    ["Dricus Du Plessis", "Current UFC middleweight champion", "current"],
    ["Sean Strickland", "Former UFC middleweight champion", "current"],
    ["Paulo Costa", "Undefeated title challenger, feared power puncher", "current"],
    ["Yoel Romero", "Olympic silver medalist wrestler, two-time title challenger", "former"],
    ["Luke Rockhold", "Former UFC and Strikeforce middleweight champion", "former"],
    ["Jacare Souza", "Longtime top-5 middleweight, ADCC champion", "former"],
    ["Kelvin Gastelum", "Former TUF winner, title challenger", "current"],
    ["Dan Henderson", "Two-division PRIDE champion, cross-era legend", "former"],
  ],
  LHW: [
    ["Jon Jones", "Youngest UFC champion ever, widely considered pound-for-pound GOAT", "current"],
    ["Chuck Liddell", "UFC Hall of Famer, defined the light heavyweight era", "former"],
    ["Quinton Jackson", "PRIDE and UFC light heavyweight champion", "former"],
    ["Daniel Cormier", "Two-division UFC champion", "former"],
    ["Alexander Gustafsson", "Two-time UFC light heavyweight title challenger", "former"],
    ["Wanderlei Silva", "PRIDE legend, 18-fight win streak", "former"],
    ["Forrest Griffin", "The Ultimate Fighter 1 winner, former UFC champion", "former"],
    ["Lyoto Machida", "Former UFC light heavyweight champion, undefeated for years", "former"],
    ["Alex Pereira", "Two-division UFC champion", "current"],
    ["Jamahal Hill", "Former UFC light heavyweight champion", "current"],
    ["Magomed Ankalaev", "Current UFC light heavyweight champion", "current"],
    ["Jiri Prochazka", "Former UFC light heavyweight champion", "current"],
    ["Glover Teixeira", "UFC light heavyweight champion at age 42", "former"],
    ["Anthony Johnson", "One of the hardest hitters in UFC history", "former"],
    ["Rashad Evans", "Former UFC light heavyweight champion", "former"],
    ["Mauricio Rua", "\"Shogun\", PRIDE Grand Prix winner and former UFC champion", "former"],
  ],
  HW: [
    ["Fedor Emelianenko", "PRIDE Heavyweight King, 2000s", "former"],
    ["Brock Lesnar", "Fastest fighter to a UFC heavyweight title", "former"],
    ["Randy Couture", "5x UFC Heavyweight Champion", "former"],
    ["Cain Velasquez", "Undefeated title reign, 2010s", "former"],
    ["Stipe Miocic", "Most UFC heavyweight title defenses", "former"],
    ["Francis Ngannou", "Hardest punch ever recorded", "former"],
    ["Junior Dos Santos", "UFC 155 champion", "former"],
    ["Fabricio Werdum", "Ended Fedor's 10-year unbeaten streak", "former"],
    ["Tom Aspinall", "Current UFC heavyweight champion", "current"],
    ["Ciryl Gane", "Former interim UFC heavyweight champion", "current"],
    ["Sergei Pavlovich", "Top-5 heavyweight contender, feared knockout power", "current"],
    ["Curtis Blaydes", "Longtime top-5 heavyweight wrestler-striker", "current"],
    ["Mark Hunt", "Cult-favorite knockout artist, K-1 champion", "former"],
    ["Andrei Arlovski", "Former UFC heavyweight champion", "former"],
    ["Antonio Rodrigo Nogueira", "\"Minotauro\", PRIDE and UFC legend", "former"],
    ["Alistair Overeem", "Former Strikeforce and K-1 champion", "former"],
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

function computePower(slug, name) {
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

  // base 50 + up to 30 for win%, up to 10 for finish rate, up to 12 for
  // competition quality (org quality maxes at 5) -- clamped to a believable
  // 40-99 band, same range the prototype's own mock power numbers used.
  const raw = 50 + winPct * 30 + finishRate * 10 + orgQuality * 2.4;
  return Math.max(40, Math.min(99, Math.round(raw)));
}

const MIN_PER_DIVISION = 8;
const MIN_PER_ERA = 3;

const out = {};
Object.keys(LEGENDS).forEach(function (division) {
  out[division] = LEGENDS[division].map(function (row) {
    const name = row[0], legacy = row[1], era = row[2];
    if (era !== "current" && era !== "former") {
      console.error("gen-legends-pool: " + name + " in " + division + " has an invalid era \"" + era + "\" — must be \"current\" or \"former\"");
      process.exit(1);
    }
    const slug = slugify(name);
    const power = computePower(slug, name);
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
