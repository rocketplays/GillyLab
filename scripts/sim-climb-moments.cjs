#!/usr/bin/env node
/* The Climb — in-fight MOMENT balance (swarm/fire, compose/evade, ground/clinch).
 *
 * WHY THIS IS SEPARATE FROM sim-climb-runs.cjs: that harness calls fight(o), the
 * INSTANT path, which never touches startBout/advanceBout/boutChoose at all — the
 * moment system has never been exercised by a sim. This one Monte Carlos the
 * moment-resolution math directly (pLand/backfire/stopAgainst/pTD/pFinish), reusing
 * the exact constants and branch structure committed in prototypes/the-climb.html
 * (AGG_BACKFIRE/AGG_STEAL/CTL_BACKFIRE/CTL_STEAL + the swarm/compose/ground blocks
 * in boutChoose). If those drift from the source file, this harness is testing a
 * fiction — cross-check against the file before trusting a "balanced" verdict.
 *
 * WHAT "BALANCED" MEANS HERE: bank/weather is EV 0 by construction (the pre-rolled
 * result plays out unchanged). Every gamble option should hover NEAR 0 in expected
 * value across the realistic range of in-game conditions — that's the stated design
 * goal ("ALWAYS-swarming is win-rate-neutral"). The new options should sit CLOSER to
 * 0 (flatter) for compose/evade, and should reward wrestling/grappling investment
 * monotonically for ground/clinch, without blowing past swarm/fire's EV band.
 */
const clampv = (v,lo,hi) => Math.max(lo, Math.min(hi, v));

// ── constants, copied verbatim from prototypes/the-climb.html — keep in sync ──
const AGG_BACKFIRE = 0.60, AGG_STEAL = 0.50;
const CTL_BACKFIRE = 0.30, CTL_STEAL = 0.35;
const ROUND_COST = 0.12; // rough value of one round toward the fight, for the EV proxy only

function sigMult(sg, killerMult, softMult) {
  return sg === 'killer' ? killerMult : (sg === 'scram' || sg === 'chin') ? softMult : 1;
}
function stopAgainstOf(sg) { return sg === 'chin' ? 0.22 : (sg === 'scram' ? 0.35 : 0.5); }

// One trial of the shared aggressive/composed resolution (mirrors resolveAggressive()).
// Returns 'finT' | 'finF' | 'flip' | 'noharm'.
function trialAggressive(pLand, backfire, stopAgainst, winning, steal) {
  if (winning) {
    if (Math.random() < pLand) return 'finT';
    if (Math.random() < backfire) {
      // flipLoss always succeeds in this idealized model (there's always a round to
      // flip mid-career; treat the "no round left to flip" edge as noharm, matching
      // the real code's fallback when flipLoss() returns false)
      if (Math.random() < stopAgainst) return 'finF';
      return 'flip';
    }
    return 'noharm';
  } else {
    if (Math.random() < pLand * steal) return 'finT';
    if (Math.random() < stopAgainst) return 'finF';
    return 'noharm';
  }
}
function trialGround(pTD, pFinish, winning, steal, scramble) {
  if (Math.random() < pTD) {
    const stealChance = winning ? pFinish : pFinish * steal;
    if (Math.random() < stealChance) return 'finT';
    return 'noharm';
  }
  if (Math.random() < scramble) return 'flip';
  return 'noharm';
}
function trialClinch(holdChance, sg) {
  if (Math.random() < holdChance) return 'noharm';
  const clinchStop = sg === 'chin' ? 0.08 : (sg === 'scram' ? 0.12 : 0.18);
  if (Math.random() < clinchStop) return 'finF';
  if (Math.random() < 0.45) return 'flip';
  return 'noharm';
}

function ev(counts, n) {
  return (counts.finT - counts.finF - counts.flip * ROUND_COST) / n;
}

const SIGS = [null, 'killer', 'chin', 'scram'];
const WINNING = [true, false];
const FINBIAS = [0, 0.3, 0.6, 0.9];
const FRAIL   = [0, 0.3, 0.6];
const THREAT  = [0, 0.3, 0.6];
const GROUND_SKILL = [0, 0.3, 0.6, 1.0]; // 0.6*wrestling_lvl + 0.4*grappling_lvl, 0..1 normalized
const TRIALS = 20000;

function runHurtCell(kind, finBias, frail, sg, winning, groundSkill) {
  const counts = { finT:0, finF:0, flip:0, noharm:0 };
  for (let t=0;t<TRIALS;t++) {
    let r;
    if (kind === 'swarm') {
      let pLand = clampv(0.45 + finBias*0.30 + frail*0.20, 0.2, 0.9);
      if (sg === 'killer') pLand = Math.min(0.95, pLand + 0.15);
      const backfire = AGG_BACKFIRE * sigMult(sg, 1.3, 0.5);
      r = trialAggressive(pLand, backfire, stopAgainstOf(sg), winning, AGG_STEAL);
    } else if (kind === 'compose') {
      let pLand = clampv(0.30 + finBias*0.20 + frail*0.12, 0.15, 0.65);
      if (sg === 'killer') pLand = Math.min(0.80, pLand + 0.08);
      const backfire = CTL_BACKFIRE * sigMult(sg, 1.15, 0.6);
      r = trialAggressive(pLand, backfire, stopAgainstOf(sg)*0.7, winning, CTL_STEAL);
    } else { // ground
      const pTD = clampv(0.35 + groundSkill*0.45, 0.2, 0.85);
      const pFinish = clampv(0.35 + groundSkill*0.35 + frail*0.15, 0.15, 0.85); // uses grappling share of groundSkill as a proxy
      const scramble = 0.18 * sigMult(sg, 1.2, 0.6);
      r = trialGround(pTD, pFinish, winning, CTL_STEAL, scramble);
    }
    counts[r]++;
  }
  return counts;
}
function runTroubleCell(kind, finBias, frail, sg, winning, groundSkill) {
  // trouble moment reuses the identical formulas (hurt=false path in boutChoose),
  // fire/evade are symmetric to swarm/compose; clinch is its own shape.
  const counts = { finT:0, finF:0, flip:0, noharm:0 };
  for (let t=0;t<TRIALS;t++) {
    let r;
    if (kind === 'fire') {
      let pLand = clampv(0.45 + finBias*0.30 + frail*0.20, 0.2, 0.9);
      if (sg === 'killer') pLand = Math.min(0.95, pLand + 0.15);
      const backfire = AGG_BACKFIRE * sigMult(sg, 1.3, 0.5);
      r = trialAggressive(pLand, backfire, stopAgainstOf(sg), winning, AGG_STEAL);
    } else if (kind === 'evade') {
      let pLand = clampv(0.30 + finBias*0.20 + frail*0.12, 0.15, 0.65);
      if (sg === 'killer') pLand = Math.min(0.80, pLand + 0.08);
      const backfire = CTL_BACKFIRE * sigMult(sg, 1.15, 0.6);
      r = trialAggressive(pLand, backfire, stopAgainstOf(sg)*0.7, winning, CTL_STEAL);
    } else { // clinch
      const holdChance = clampv(0.65 + groundSkill*0.30, 0.55, 0.95);
      r = trialClinch(holdChance, sg);
    }
    counts[r]++;
  }
  return counts;
}

function summarize(label, kinds, runner) {
  console.log('\n' + label);
  console.log('option'.padEnd(10) + 'avg EV'.padStart(10) + '  finish%'.padStart(10) + '  stopped%'.padStart(11) + '  flip%'.padStart(9) + '  cells');
  for (const kind of kinds) {
    let evSum=0, cells=0, finT=0, finF=0, flip=0, n=0;
    for (const sg of SIGS) for (const winning of WINNING) for (const fb of FINBIAS) for (const fr of FRAIL)
      for (const gs of (kind==='ground'||kind==='clinch' ? GROUND_SKILL : [0])) {
        const counts = runner(kind, fb, fr, sg, winning, gs);
        evSum += ev(counts, TRIALS); cells++;
        finT += counts.finT; finF += counts.finF; flip += counts.flip; n += TRIALS;
      }
    console.log(
      kind.padEnd(10) +
      (evSum/cells).toFixed(4).padStart(10) +
      ((finT/n*100).toFixed(1)+'%').padStart(10) +
      ((finF/n*100).toFixed(1)+'%').padStart(11) +
      ((flip/n*100).toFixed(1)+'%').padStart(9) +
      String(cells).padStart(7)
    );
  }
}

console.log('THE CLIMB — in-fight moment balance, '+TRIALS+' trials/cell.');
console.log('EV proxy = P(finish, win outright) - P(finish, get stopped) - P(round flipped)*'+ROUND_COST);
console.log('Bank/weather (not simulated) = EV 0 exactly, by construction.');

summarize('HURT moment (you rocked him)', ['swarm','compose','ground'], runHurtCell);
summarize('TROUBLE moment (you got rocked)', ['fire','evade','clinch'], runTroubleCell);

// ── monotonicity check: does ground/clinch actually reward wrestling/grappling? ──
console.log('\nGround/clinch EV vs groundSkill (averaged over sig/winning/finBias/frail/threat), should rise:');
for (const gs of GROUND_SKILL) {
  let evSum=0, cells=0;
  for (const sg of SIGS) for (const winning of WINNING) for (const fb of FINBIAS) for (const fr of FRAIL) {
    evSum += ev(runHurtCell('ground', fb, fr, sg, winning, gs), TRIALS); cells++;
  }
  console.log('  groundSkill='+gs.toFixed(1)+'  EV='+(evSum/cells).toFixed(4));
}
console.log('\nClinch hold-rate vs groundSkill (should rise — less time exposed to being finished):');
for (const gs of GROUND_SKILL) {
  let evSum=0, cells=0;
  for (const sg of SIGS) for (const fb of FINBIAS) for (const fr of FRAIL) {
    evSum += ev(runTroubleCell('clinch', fb, fr, sg, true, gs), TRIALS); cells++;
  }
  console.log('  groundSkill='+gs.toFixed(1)+'  EV='+(evSum/cells).toFixed(4));
}
