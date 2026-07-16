#!/usr/bin/env node
/* The Climb — run-level balance. Plays whole careers, not creator screens.
 *
 * WHY THIS EXISTS. Every balance number in this project up to now was measured
 * the same way: one static build, everything else pinned at level 5, averaged
 * over six fixed opponents, at the creator screen. That produced confident
 * tables ("wrestling 0.89/level, striking 1.46") and a playtester saying tuning
 * felt stuck — correctly, because nobody plays a creator screen. The game is a
 * 15-fight run where points arrive over time and you choose who to fight.
 *
 * A static-build table cannot see: whether an attribute that's weak early is
 * strong once you can afford level 9; whether picking easy fights compounds;
 * whether a strategy that looks optimal survives two losses and a cut.
 *
 * So this plays the real page, through the real offers()/fight() loop, with the
 * real scorer, and reports what a PLAYER would notice: does my plan win the belt?
 *
 * Usage: node scripts/sim-climb-runs.cjs [--runs 60]
 */
const fs=require('fs'), path=require('path'), {JSDOM}=require('jsdom');
const R=path.resolve(__dirname,'..')+'/';
const args=process.argv.slice(2);
const argV=(f,d)=>{const i=args.indexOf(f);return i>=0?+args[i+1]:d;};
const RUNS=argV('--runs',60);
const argS=(f,d)=>{const i=args.indexOf(f);return i>=0?args[i+1]:d;};
const ONLY=argS('--only',null);   // one strategy per process: a full sweep outruns most timeouts

const DATA=JSON.parse(fs.readFileSync(R+'data/climb.json','utf8'));
const HTML=fs.readFileSync(R+'prototypes/the-climb.html','utf8');
// climb-scorer.js is GONE — the sim no longer referees, so the 90KB browser-
// wrapped scorer isn't shipped or loaded. The page needs no <script> injection.
const dom=new JSDOM(HTML,
 {runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){w.fetch=()=>Promise.resolve({json:()=>Promise.resolve(DATA)});}});
const win=dom.window;

// Each strategy is a PRIORITY ORDER over attributes plus a path preference.
// Points always go to the first attribute that isn't maxed — i.e. a player who
// has decided what kind of fighter he is and sticks to it. That's how people
// actually play; nobody re-solves a linear program between fights.
const STRATS={
  'striker'      : {order:['power','technique','pace','strdef','chin','cardio','takedef','grappling','wrestling'], path:'mid'},
  'wrestler'     : {order:['wrestling','takedef','cardio','chin','grappling','power','technique','pace','strdef'], path:'mid'},
  'grappler'     : {order:['grappling','wrestling','cardio','chin','takedef','technique','power','pace','strdef'], path:'mid'},
  'ground game'  : {order:['grappling','takedef','wrestling','chin','cardio','power','technique','pace','strdef'], path:'mid'},
  'balanced'     : {order:null,                                            path:'mid'},
  'striker/safe' : {order:['power','technique','pace','strdef','chin','cardio','takedef','grappling','wrestling'], path:'easy'},
  'striker/bold' : {order:['power','technique','pace','strdef','chin','cardio','takedef','grappling','wrestling'], path:'hard'},
  // THE CONTROL. The playtest spec was: "if you're a striker and you cherry pick
  // favorable matchups, that should be an advantage, not the same as picking
  // randomly." Same build as 'striker/safe', picks blind. If these two rates
  // match, the matchup screen is decoration and the game has no strategy in it.
  'striker/blind': {order:['power','technique','pace','strdef','chin','cardio','takedef','grappling','wrestling'], path:'random'},
  'wrestler/safe': {order:['wrestling','takedef','cardio','chin','grappling','power','technique','pace','strdef'], path:'easy'},
  'wrestler/blind':{order:['wrestling','takedef','cardio','chin','grappling','power','technique','pace','strdef'], path:'random'},
  // THE SMART BOT. safe (easiest card) and blind (random) score IDENTICALLY —
  // measured 26/26, then 14/15. That reads as "the matchup screen is decoration",
  // but it isn't: it reads as "both of these bots are bad, in opposite directions".
  // safe takes the soft card and climbs ONE rung; blind sometimes takes the man
  // above and climbs THREE. More wins versus more progress, and because rewardFor
  // pays LINEARLY in rungs, the two cancel almost exactly.
  //
  // So neither bot is playing the actual game, which is: which card buys the most
  // PROGRESS per unit of loss-budget risk? This one maximises p x rungs. If it
  // beats both, the strategy exists and the harness simply never looked for it. If
  // it ties them too, the board really is three equivalent doors and the screen is
  // decoration — and THAT is the thing worth fixing.
  'striker/smart' : {order:['power','technique','pace','strdef','chin','cardio','takedef','grappling','wrestling'], path:'ev'},
  'wrestler/smart': {order:['wrestling','takedef','cardio','chin','grappling','power','technique','pace','strdef'], path:'ev'},
};

function playOne(strat){
  const {order,path:pref}=STRATS[strat];
  win.eval('newGame(); G.started=true;');
  // spend the starting budget the way this strategy would
  if(order) win.eval('(function(){var O='+JSON.stringify(order)+';'+
    'while(G.pts>0){var moved=false;'+
    'for(const id of O){var c=upCost(G.attrs[id]); if(G.pts>=c && G.attrs[id]<ATTR_MAX){G.pts-=c;G.attrs[id]++;moved=true;break;}}'+
    'if(!moved)break;}})()');
  else win.eval('(function(){var moved=true;while(moved){moved=false;'+
    'for(const a of ATTRS){var c=upCost(G.attrs[a.id]);'+
    'if(G.pts>=c&&G.attrs[a.id]<ATTR_MAX){G.pts-=c;G.attrs[a.id]++;moved=true;}}}})()');
  let guard=0, peak=99;
  for(;;){
    if(guard++>40) break;
    const st=win.eval('({champ:G.champ,losses:G.losses,rank:G.rank,out:!!G.outOfShots})');
    // Track the peak ourselves — the game HAD no peak, it only carried the CURRENT
    // rank. (It has G.peak now: the end screen was printing "peaked at #N" off the
    // current rank, which was only ever honest while rank couldn't go down, and a
    // loss costs a rung as of this pass. This harness was right for longer than the
    // game was.) Kept independent anyway: a harness that reads the number it is
    // checking cannot catch the game getting it wrong.
    if(st.rank!=null && st.rank<peak) peak=st.rank;
    // G.outOfShots ends a run WITHOUT G.losses reaching CUT_AT (second title loss).
    // A bot that only watches the loss counter spins to the 40-fight guard and
    // reports a run length that no player experiences — the harness lying again.
    if(st.champ||st.out||st.losses>=win.eval("CUT_AT")) break;
    win.eval('(function(){'+
      'if(G.pts>0){'+
        (order?'var O='+JSON.stringify(order)+';'+
          'while(G.pts>0){var moved=false;'+
          'for(const id of O){var c=upCost(G.attrs[id]); if(G.pts>=c&&G.attrs[id]<ATTR_MAX){G.pts-=c;G.attrs[id]++;moved=true;break;}}'+
          'if(!moved)break;}'
         :'var moved=true;while(moved){moved=false;'+
          'for(const a of ATTRS){var c=upCost(G.attrs[a.id]);'+
          'if(G.pts>=c&&G.attrs[a.id]<ATTR_MAX){G.pts-=c;G.attrs[a.id]++;moved=true;}}}')+
      '}'+
      'var o=offers(); if(!o.length){G.losses=99;return;}'+
      'var s=o.slice().sort(function(a,b){return b.p-a.p});'+
      // EVERY STRATEGY TAKES THE BELT WHEN IT IS OFFERED. `path` describes which
      // fight you take while CLIMBING; it is not a claim about whether you want to
      // be champion. Without this line, 'easy' sorts the title shot to the bottom
      // of the board every time and declines it forever: measured, a title fight
      // offered on 28 of 41 boards and taken 0 times, parking the bot at #1 to
      // farm 95% cards for a 39-2 record and no belt. That scored the strategy at
      // 0% — a number about the HARNESS that reads exactly like a number about the
      // game, and the tuning file's own warning is DON'T SAMPLE THE FUNCTION,
      // SAMPLE THE GAME. No player alive ducks the belt for thirty fights.
      'var title=o.filter(function(x){return x.f.rankNum===0})[0];'+
      // 'ev' picks the card with the best expected PROGRESS: p x rungs. o.jump is
      // the opponent's rank (99 = unranked), so rungs = how far this win moves you.
      'var ev=function(x){var rg=(G.rank==null||x.jump>=99||x.jump>=G.rank)?1:Math.max(1,G.rank-x.jump);return x.p*rg;};'+
      'var best=o.slice().sort(function(a,b){return ev(b)-ev(a)})[0];'+
      'var pick=title||'+(pref==='easy'?'s[0]':pref==='hard'?'s[s.length-1]':
                   pref==='random'?'o[Math.floor(Math.random()*o.length)]':
                   pref==='ev'?'best':'s[Math.floor(s.length/2)]')+';'+
      'fight(pick);})()');
  }
  const r=win.eval('({champ:!!G.champ,wins:G.wins,losses:G.losses,rank:G.rank,'+
    'fights:G.log.length,attrs:JSON.parse(JSON.stringify(G.attrs))})');
  if(r.rank!=null && r.rank<peak) peak=r.rank;
  r.peak = r.champ ? 0 : peak;
  return r;
}

// The page FETCHES its board, so D is null until the microtask queue drains.
// Running at require time read D.ladder off null. Wait for the real boot.
setTimeout(main, 800);
function main(){
console.log('THE CLIMB — '+RUNS+' full careers per strategy, real page, real scorer.\n');
console.log('strategy        belt    avg W-L   avg fights   peak rank   final build');
console.log('-'.repeat(94));
const IDS=win.eval('ATTRS.map(a=>a.id)');
const rows=[];
for(const s of Object.keys(STRATS).filter(k=>!ONLY||k===ONLY)){
  let champ=0,w=0,l=0,f=0,peak=0; const bsum={}; for(const id of IDS) bsum[id]=0;
  for(let i=0;i<RUNS;i++){
    const r=playOne(s);
    if(r.champ)champ++; w+=r.wins; l+=r.losses; f+=r.fights; peak+=r.peak;
    for(const id of IDS) bsum[id]+=(r.attrs[id]||0);
  }
  const rate=champ/RUNS*100;
  rows.push({s,rate});
  console.log(s.padEnd(15)+
    (rate.toFixed(0)+'%').padStart(5)+'   '+
    ((w/RUNS).toFixed(1)+'-'+(l/RUNS).toFixed(1)).padStart(8)+'   '+
    (f/RUNS).toFixed(1).padStart(10)+'   '+
    ('#'+(peak/RUNS).toFixed(0)).padStart(9)+'   '+
    IDS.map(id=>id.slice(0,4)+' '+(bsum[id]/RUNS).toFixed(1)).join('  '));
}
if(rows.length>1){
const best=rows.reduce((a,b)=>a.rate>b.rate?a:b), worst=rows.reduce((a,b)=>a.rate<b.rate?a:b);
console.log('\n  best: '+best.s+' '+best.rate.toFixed(0)+'%    worst: '+worst.s+' '+worst.rate.toFixed(0)+'%');}
console.log('\n  WHAT GOOD LOOKS LIKE: a spread, with no strategy at 0% and none running away');
console.log('  with it. Every strategy identical = the build does not matter. One strategy');
console.log('  dominating = there is a right answer and the rest are decoration.');
process.exit(0);
}
