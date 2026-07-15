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

const DATA=JSON.parse(fs.readFileSync(R+'prototypes/climb-data.json','utf8'));
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
    const st=win.eval('({champ:G.champ,losses:G.losses,rank:G.rank})');
    // Track the peak ourselves — the game has no G.peakRank, it only carries the
    // CURRENT rank. Reading a field that doesn't exist returns undefined, which
    // would have quietly scored every run as identical.
    if(st.rank!=null && st.rank<peak) peak=st.rank;
    if(st.champ||st.losses>=2) break;
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
      'var o=offers(); if(!o.length){G.losses=2;return;}'+
      'var s=o.slice().sort(function(a,b){return b.p-a.p});'+
      'var pick='+(pref==='easy'?'s[0]':pref==='hard'?'s[s.length-1]':
                   pref==='random'?'o[Math.floor(Math.random()*o.length)]':'s[Math.floor(s.length/2)]')+';'+
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
