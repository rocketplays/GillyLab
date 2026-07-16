#!/usr/bin/env node
/* FIX (b)'s ACCEPTANCE TEST. A cap that lapses is worse than no cap.
 *
 * The failure it guards: MAX_FAVORITE swaps a gift for a harder man drawn from
 * avail(), which excludes everyone you have FOUGHT — so late in a run there is
 * nobody to swap in and the cap silently stops working. It reported 46% of the
 * favorite-hunter's fights still over 80% while the constant said 78%.
 *
 * So: play real runs, record the p of every fight actually TAKEN, and report the
 * tail. Sample the game, not the function.
 */
const fs=require('fs'),path=require('path'),{JSDOM}=require('jsdom');
const R=path.resolve(__dirname,'..')+'/';
const args=process.argv.slice(2);
const RUNS=(()=>{const i=args.indexOf('--runs');return i>=0?+args[i+1]:40;})();
const DATA=JSON.parse(fs.readFileSync(R+'data/climb.json','utf8'));
const HTML=fs.readFileSync(R+'prototypes/the-climb.html','utf8');
const dom=new JSDOM(HTML,{runScripts:'dangerously',pretendToBeVisual:true,
  beforeParse(w){w.fetch=()=>Promise.resolve({json:()=>Promise.resolve(DATA)});}});
const win=dom.window;
setTimeout(main,800);
function main(){
const CAP=+(/const MAX_FAVORITE = ([0-9.]+)/.exec(HTML)||[,0.85])[1];
const O=['power','technique','pace','strdef','chin','cardio','takedef','grappling','wrestling'];
const spend='if(G.pts>0){var O='+JSON.stringify(O)+';while(G.pts>0){var moved=false;'+
  'for(const id of O){var c=upCost(G.attrs[id]);if(G.pts>=c&&G.attrs[id]<ATTR_MAX){G.pts-=c;G.attrs[id]++;moved=true;break;}}'+
  'if(!moved)break;}}';
console.log('THE CAP, MEASURED IN PLAY — MAX_FAVORITE = '+CAP+' (read from the page, never hardcoded twice), '+RUNS+' runs of the favorite-hunter\n');
for(const [label,pick] of [['favorite-hunter (easy)','s[0]'],['mid','s[Math.floor(s.length/2)]']]){
  const ps=[], ranked=[];
  for(let r=0;r<RUNS;r++){
    win.eval('newGame(); G.started=true;');
    win.eval('(function(){'+spend+'})()');
    let guard=0;
    for(;;){
      if(guard++>40) break;
      const st=win.eval('({champ:G.champ,losses:G.losses,rank:G.rank})');
      if(st.champ||st.losses>=win.eval('CUT_AT')) break;
      win.eval('(function(){'+spend+'})()');
      const got=win.eval('(function(){var o=offers(); if(!o.length){G.losses=99;return "0";}'+
        'var s=o.slice().sort(function(a,b){return b.p-a.p});'+
        'var t=o.filter(function(x){return x.f.rankNum===0})[0];'+
        'var pick=t||'+pick+';var wasRanked=G.rank!=null;fight(pick);'+
        'return pick.p+"|"+wasRanked;})()');
      if(got==="0") break;
      const [p,wr]=got.split('|');
      ps.push(+p); ranked.push(wr==='true');
    }
  }
  const rk=ps.filter((_,i)=>ranked[i]);
  const over=rk.filter(p=>p>CAP+1e-9);
  console.log('  '+label);
  console.log('    fights taken            '+ps.length+'  ('+rk.length+' from a ranked board)');
  console.log('    ranked fights over cap  '+over.length+'  = '+(over.length/rk.length*100).toFixed(1)+
    '%   <- the note measured 46% here');
  if(over.length) console.log('    worst offender          '+(Math.max(...over)*100).toFixed(1)+'%');
  const mean=rk.reduce((a,b)=>a+b,0)/rk.length;
  console.log('    mean p, ranked boards   '+(mean*100).toFixed(1)+'%');
  const unr=ps.filter((_,i)=>!ranked[i]);
  if(unr.length) console.log('    (unranked debut cards   '+(unr.reduce((a,b)=>a+b,0)/unr.length*100).toFixed(1)+
    '% mean — uncapped BY DESIGN, the gatekeeper is meant to be a gift)');
  console.log('');
}
console.log('  PASS = ranked fights over cap is ~0%. Anything else means the cap cannot');
console.log('  find a legal opponent and is lapsing where it matters most.');
process.exit(0);
}
