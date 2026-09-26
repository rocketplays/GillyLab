#!/usr/bin/env node
/**
 * data/legends-pool.json — the Legends Bracket's fighter pool, one array of 8
 * per division. This is the "recognizable names only" fix requested after the
 * prototype's demo pool: rather than pulling ANY 8 fighters out of the
 * ~3,190-entry data/fighter-extras-full.json (which is dominated by current
 * roster depth and Contender Series prospects nobody outside the sport would
 * recognize), each division's 8 are a hand-curated list of genuinely famous
 * names — former champions, PPV headliners, Hall-of-Fame-caliber careers —
 * cross-referenced against that same database for REAL record/accolade data.
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
 * from the UFC-stats era, which excludes almost every name below (Fedor, GSP,
 * Liddell, prime Anderson Silva, ...). A record-and-competition-quality model
 * is the honest substitute, not a claim that this calls the literal same
 * function the Fight Simulator does.
 *
 * Adding a fighter: add their name + one-line legacy tag to LEGENDS below.
 * They must already exist in data/fighter-extras-full.json (run
 * gen-app-fighter-extras.cjs first if they're missing) or this script fails
 * loudly rather than silently shipping a fighter with a made-up power score.
 *
 * Run: node scripts/gen-legends-pool.cjs
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");

const EXTRAS_PATH = path.join(ROOT, "data", "fighter-extras-full.json");
const OUT_PATH = path.join(ROOT, "data", "legends-pool.json");

// Curated, not derived — this is the actual product decision ("recognizable
// names, not random people nobody would recognize"). Exactly 8 per division:
// standard bracket size, no draw-time padding/truncation logic needed.
const LEGENDS = {
  FLW: [
    ["Demetrious Johnson", "Longest UFC flyweight title reign ever, 11 defenses"],
    ["Henry Cejudo", "Olympic gold medalist turned two-division champion"],
    ["Deiveson Figueiredo", "Two-time UFC flyweight champion"],
    ["Brandon Moreno", "First Mexican-born UFC champion"],
    ["Joseph Benavidez", "Two-time title challenger, flyweight division mainstay"],
    ["Kyoji Horiguchi", "RIZIN champion, first UFC flyweight title challenger"],
    ["Ian McCall", "One of the UFC's original flyweights, division pioneer"],
    ["Alexandre Pantoja", "Current UFC flyweight champion"],
  ],
  BW: [
    ["Dominick Cruz", "Two-time UFC bantamweight champion, pioneer of the division"],
    ["TJ Dillashaw", "Two-time UFC bantamweight champion"],
    ["Cody Garbrandt", "Former UFC bantamweight champion"],
    ["Sean O'Malley", "Former UFC bantamweight champion, breakout PPV draw"],
    ["Aljamain Sterling", "Former UFC bantamweight champion"],
    ["Petr Yan", "Former UFC bantamweight champion"],
    ["Urijah Faber", "WEC featherweight champion, bantamweight division godfather"],
    ["Renan Barao", "Long-reigning WEC/UFC bantamweight champion"],
  ],
  FW: [
    ["Jose Aldo", "First UFC featherweight champion, 10-year WEC/UFC title reign"],
    ["Conor McGregor", "First UFC fighter to hold two titles simultaneously"],
    ["Max Holloway", "Former UFC featherweight champion, all-time strikes leader"],
    ["Alexander Volkanovski", "Two-time UFC featherweight champion"],
    ["Frankie Edgar", "Former UFC lightweight champion, featherweight title challenger"],
    ["Chad Mendes", "Two-time UFC featherweight title challenger"],
    ["Ilia Topuria", "Undefeated two-division champion"],
    ["Brian Ortega", "Submission specialist, two-time title challenger"],
  ],
  LW: [
    ["Khabib Nurmagomedov", "Undefeated UFC lightweight champion, 29-0"],
    ["BJ Penn", "UFC Hall of Famer, two-division champion"],
    ["Nate Diaz", "Stockton's own, two of the biggest PPV upsets in UFC history"],
    ["Justin Gaethje", "Interim lightweight champion, Fight of the Night record holder"],
    ["Dustin Poirier", "Former interim UFC lightweight champion"],
    ["Charles Oliveira", "Former UFC lightweight champion, all-time UFC finishes leader"],
    ["Islam Makhachev", "Current UFC lightweight champion"],
    ["Tony Ferguson", "Former interim UFC lightweight champion, 12-fight win streak"],
  ],
  WW: [
    ["Georges St-Pierre", "One of the greatest welterweights ever, 9 straight title defenses"],
    ["Nick Diaz", "Former Strikeforce welterweight champion, cult PPV draw"],
    ["Matt Hughes", "UFC Hall of Famer, dominant 2000s welterweight champion"],
    ["Kamaru Usman", "Former UFC welterweight champion, 15-fight win streak"],
    ["Tyron Woodley", "Former UFC welterweight champion"],
    ["Robbie Lawler", "Former UFC welterweight champion, Fight of the Year staple"],
    ["Johny Hendricks", "Former UFC welterweight champion"],
    ["Leon Edwards", "Former UFC welterweight champion"],
  ],
  MW: [
    ["Anderson Silva", "Longest UFC middleweight title reign ever, 16 straight wins"],
    ["Chael Sonnen", "Two-time title challenger, one of the sport's best talkers"],
    ["Michael Bisping", "First British UFC champion"],
    ["Israel Adesanya", "Former two-time UFC middleweight champion"],
    ["Vitor Belfort", "Former UFC light heavyweight champion, middleweight title challenger"],
    ["Rich Franklin", "Former UFC middleweight champion"],
    ["Chris Weidman", "Ended Anderson Silva's title reign"],
    ["Robert Whittaker", "Former UFC middleweight champion"],
  ],
  LHW: [
    ["Jon Jones", "Youngest UFC champion ever, widely considered pound-for-pound GOAT"],
    ["Chuck Liddell", "UFC Hall of Famer, defined the light heavyweight era"],
    ["Quinton Jackson", "PRIDE and UFC light heavyweight champion"],
    ["Daniel Cormier", "Two-division UFC champion"],
    ["Alexander Gustafsson", "Two-time UFC light heavyweight title challenger"],
    ["Wanderlei Silva", "PRIDE legend, 18-fight win streak"],
    ["Forrest Griffin", "The Ultimate Fighter 1 winner, former UFC champion"],
    ["Lyoto Machida", "Former UFC light heavyweight champion, undefeated for years"],
  ],
  HW: [
    ["Fedor Emelianenko", "PRIDE Heavyweight King, 2000s"],
    ["Brock Lesnar", "Fastest fighter to a UFC heavyweight title"],
    ["Randy Couture", "5x UFC Heavyweight Champion"],
    ["Cain Velasquez", "Undefeated title reign, 2010s"],
    ["Stipe Miocic", "Most UFC heavyweight title defenses"],
    ["Francis Ngannou", "Hardest punch ever recorded"],
    ["Junior Dos Santos", "UFC 155 champion"],
    ["Fabricio Werdum", "Ended Fedor's 10-year unbeaten streak"],
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

const out = {};
Object.keys(LEGENDS).forEach(function (division) {
  out[division] = LEGENDS[division].map(function (pair) {
    const name = pair[0], legacy = pair[1];
    const slug = slugify(name);
    const power = computePower(slug, name);
    return { name: name, slug: slug, legacy: legacy, power: power, photo: slug };
  });
  if (out[division].length !== 8) {
    console.error("gen-legends-pool: " + division + " has " + out[division].length + " fighters, expected exactly 8");
    process.exit(1);
  }
});

fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + "\n");
const divCount = Object.keys(out).length;
const fCount = Object.values(out).reduce(function (n, arr) { return n + arr.length; }, 0);
console.log("data/legends-pool.json: " + divCount + " divisions, " + fCount + " fighters, " + fs.statSync(OUT_PATH).size + " bytes");
