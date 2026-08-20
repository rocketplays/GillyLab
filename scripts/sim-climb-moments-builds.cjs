#!/usr/bin/env node
/* The Climb — in-fight moment balance, tied to REAL builds and REAL opponents.
 *
 * sim-climb-moments.cjs swept finBias/frail as an abstract grid — it validated the
 * probability FORMULAS but never actually computed finBias/frail from real attribute
 * builds (power/pace/wrestling/grappling) against real opponent style data (chin/kd/
 * sub/tdDef), and never confirmed the different archetypes actually produce different
 * numbers going into the moment math the way the design intends.
 *
 * This one drives boutFinishCtx(o) — the real function, loaded live off
 * prototypes/the-climb.html via JSDOM, exactly like sim-climb-runs.cjs does — with
 * real attribute builds (same STRATS spend-order pattern) against every fighter's
 * real style data in data/climb.json. boutFinishCtx is a pure read of G.attrs/G.sig
 * and o.f.style; it doesn't mutate any game state, so it's safe to call directly
 * without fabricating a full fight/G state.
 *
 * The finBias/frail values that come out are then fed into the same Monte Carlo
 * resolution math as sim-climb-moments.cjs (kept in sync by hand — cross-check
 * against prototypes/the-climb.html's boutChoose if either drifts).
 */
const fs=require('fs'), path=require('path'), {JSDOM}=require('jsdom');
const R=path.resolve(__dirname,'..')+'/'; // adjust if run from outputs/, see README note below
const clampv=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));

const AGG_BACKFIRE=0.60, AGG_STEAL=0.50, CTL_BACKFIRE=0.30, CTL_STEAL=0.35, ROUND_COST=0.12;
const sigMult=(sg,k,s)=> sg==='killer'?k:(sg==='scram'||sg==='chin')?s:1;
const stopAgainstOf=(sg)=> sg==='chin'?0.22:(sg==='scram'?0.35:0.5);
function trialAggressive(pLand,backfire,stopAgainst,winning,steal){
  if(winning){
    if(Math.random()<pLand) return 'finT';
    if(Math.random()<backfire){ if(Math.random()<stopAgainst) return 'finF'; return 'flip'; }
    return 'noharm';
  } else {
    if(Math.random()<pLand*steal) return 'finT';
    if(Math.random()<stopAgainst) return 'finF';
    return 'noharm';
  }
}
function trialGround(pTD,pFinish,winning,steal,scramble){
  if(Math.random()<pTD){ const stealChance=winning?pFinish:pFinish*steal; if(Math.random()<stealChance) return 'finT'; return 'noharm'; }
  if(Math.random()<scramble) return 'flip';
  return 'noharm';
}
function trialClinch(holdChance,sg){
  if(Math.random()<holdChance) return 'noharm';
  const clinchStop = sg==='chin'?0.08:(sg==='scram'?0.12:0.18);
  if(Math.random()<clinchStop) return 'finF';
  if(Math.random()<0.45) return 'flip';
  return 'noharm';
}
function ev(c,n){ return (c.finT - c.finF - c.flip*ROUND_COST)/n; }

const DATA=JSON.parse(fs.readFileSync(R+'data/climb.json','utf8'));
const HTML=fs.readFileSync(R+'prototypes/the-climb.html','utf8');
const dom=new JSDOM(HTML,{runScripts:'dangerously',pretendToBeVisual:true,
  beforeParse(w){ w.fetch=()=>Promise.resolve({json:()=>Promise.resolve(DATA)}); }});
const win=dom.window;

// Every real fighter in the ladder, across every division — the actual opponent
// pool the game draws from, not an invented style distribution.
const OPPONENTS=[];
for(const divKey of Object.keys(DATA.divisions)){
  for(const f of DATA.divisions[divKey].ladder) if(f.style) OPPONENTS.push(f);
}

// Same spend-order pattern as sim-climb-runs.cjs's STRATS, minus the path (irrelevant
// here — we only need the resulting attribute sheet, not the run they'd play).
const BUILDS={
  striker : ['power','technique','pace','strdef','chin','cardio','takedef','grappling','wrestling'],
  wrestler: ['wrestling','takedef','cardio','chin','grappling','power','technique','pace','strdef'],
  grappler: ['grappling','wrestling','cardio','chin','takedef','technique','power','pace','strdef'],
  balanced: null, // spend everywhere evenly, mirrors STRATS.balanced
};
// Two budget snapshots: a fresh 42-pt rookie sheet, and an ~110-pt developed sheet
// (roughly what a mid/late-run fighter has banked). Balance should hold at both.
const BUDGETS = { rookie: 42, veteran: 110 };

function buildAttrs(order, budget){
  win.eval('newGame(); G.started=true; G.pts='+budget+';');
  if(order) win.eval('(function(){var O='+JSON.stringify(order)+';'+
    'while(G.pts>0){var moved=false;'+
    'for(const id of O){var c=upCostOf(id,G.attrs[id]); if(G.pts>=c && G.attrs[id]<ATTR_MAX){G.pts-=c;G.attrs[id]++;moved=true;break;}}'+
    'if(!moved)break;}})()');
  else win.eval('(function(){var moved=true;while(moved){moved=false;'+
    'for(const a of ATTRS){var c=upCostOf(a.id,G.attrs[a.id]);'+
    'if(G.pts>=c&&G.attrs[a.id]<ATTR_MAX){G.pts-=c;G.attrs[a.id]++;moved=true;}}}})()');
  return win.eval('JSON.parse(JSON.stringify(G.attrs))');
}
function ctxFor(attrs, sig, opp){
  win.eval('G.attrs='+JSON.stringify(attrs)+'; G.sig='+JSON.stringify(sig)+';');
  win.__opp = opp;
  return win.eval('boutFinishCtx({f: window.__opp})');
}
function groundSkillOf(attrs){
  const lvl=(id)=>((attrs[id]||1)-1)/9;
  return lvl('wrestling')*0.6 + lvl('grappling')*0.4;
}

const SIGS=[null,'killer','chin','scram'];
const WINNING=[true,false];
const TRIALS_PER_OPP=40; // x OPPONENTS.length real matchups = plenty of samples

function evalBuild(attrs, groundSkill){
  const hurt={swarm:{finT:0,finF:0,flip:0,n:0}, compose:{finT:0,finF:0,flip:0,n:0}, ground:{finT:0,finF:0,flip:0,n:0}};
  const trouble={fire:{finT:0,finF:0,flip:0,n:0}, evade:{finT:0,finF:0,flip:0,n:0}, clinch:{finT:0,finF:0,flip:0,n:0}};
  for(const sg of SIGS){
    for(const opp of OPPONENTS){
      const ctx = ctxFor(attrs, sg, opp);
      for(const winning of WINNING){
        for(let t=0;t<TRIALS_PER_OPP;t++){
          // swarm/fire
          let pLand=clampv(0.45+ctx.finBias*0.30+ctx.frail*0.20,0.2,0.9);
          if(sg==='killer') pLand=Math.min(0.95,pLand+0.15);
          let backfire=AGG_BACKFIRE*sigMult(sg,1.3,0.5);
          let r=trialAggressive(pLand,backfire,stopAgainstOf(sg),winning,AGG_STEAL);
          hurt.swarm[r]++; hurt.swarm.n++;
          trouble.fire[r]++; trouble.fire.n++; // symmetric formula, separate tally
          // compose/evade
          let pLand2=clampv(0.30+ctx.finBias*0.20+ctx.frail*0.12,0.15,0.65);
          if(sg==='killer') pLand2=Math.min(0.80,pLand2+0.08);
          let backfire2=CTL_BACKFIRE*sigMult(sg,1.15,0.6);
          let r2=trialAggressive(pLand2,backfire2,stopAgainstOf(sg)*0.7,winning,CTL_STEAL);
          hurt.compose[r2]++; hurt.compose.n++;
          trouble.evade[r2]++; trouble.evade.n++;
          // ground
          const pTD=clampv(0.35+groundSkill*0.45,0.2,0.85);
          const pFinish=clampv(0.35+groundSkill*0.35+ctx.frail*0.15,0.15,0.85);
          const scramble=0.18*sigMult(sg,1.2,0.6);
          let r3=trialGround(pTD,pFinish,winning,CTL_STEAL,scramble);
          hurt.ground[r3]++; hurt.ground.n++;
          // clinch (trouble-only; independent of winning)
          const holdChance=clampv(0.65+groundSkill*0.30,0.55,0.95);
          let r4=trialClinch(holdChance,sg);
          trouble.clinch[r4]++; trouble.clinch.n++;
        }
      }
    }
  }
  return {hurt,trouble};
}

// The page FETCHES its board asynchronously — D is null until that microtask drains.
// Same fix as sim-climb-runs.cjs: wait for the real boot before touching newGame().
setTimeout(main, 800);
function main(){
console.log('THE CLIMB — moment balance vs REAL builds x REAL roster ('+OPPONENTS.length+' fighters).\n');
for(const budgetName of Object.keys(BUDGETS)){
  const budget = BUDGETS[budgetName];
  console.log('='.repeat(78));
  console.log(budgetName.toUpperCase()+' ('+budget+' pts spent)');
  console.log('='.repeat(78));
  console.log('build'.padEnd(10)+'wrestling'.padStart(11)+'grappling'.padStart(11)+'groundSkill'.padStart(13)+
    '  swarm'.padStart(9)+'  compose'.padStart(11)+'  ground'.padStart(10)+'   |   fire'.padStart(11)+'  evade'.padStart(9)+'  clinch'.padStart(10));
  for(const [name,order] of Object.entries(BUILDS)){
    const attrs = buildAttrs(order, budget);
    const gs = groundSkillOf(attrs);
    const {hurt,trouble} = evalBuild(attrs, gs);
    console.log(
      name.padEnd(10)+
      String(attrs.wrestling).padStart(11)+
      String(attrs.grappling).padStart(11)+
      gs.toFixed(2).padStart(13)+
      ('  '+ev(hurt.swarm,hurt.swarm.n).toFixed(3)).padStart(9)+
      ('  '+ev(hurt.compose,hurt.compose.n).toFixed(3)).padStart(11)+
      ('  '+ev(hurt.ground,hurt.ground.n).toFixed(3)).padStart(10)+
      ('   |  '+ev(trouble.fire,trouble.fire.n).toFixed(3)).padStart(11)+
      ('  '+ev(trouble.evade,trouble.evade.n).toFixed(3)).padStart(9)+
      ('  '+ev(trouble.clinch,trouble.clinch.n).toFixed(3)).padStart(10)
    );
  }
}
console.log('\nWHAT GOOD LOOKS LIKE: every build\'s swarm/compose/fire/evade land in a similar');
console.log('band (those four don\'t key off wrestling/grappling, so build shouldn\'t move them');
console.log('much beyond what finBias/frail naturally do). ground/clinch should separate by');
console.log('build — grappler clearly ahead of striker on those two, wrestler in between,');
console.log('proportional to the wrestling/grappling column, not proportional to some other');
console.log('unrelated stat.');
process.exit(0);
}
