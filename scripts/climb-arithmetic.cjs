#!/usr/bin/env node
/* THE ARITHMETIC — do this BEFORE touching a dial.
 *
 * The tuning file's central lesson: four attempts were spent on POINTS_START /
 * RATING_SPAN / CUT_AT / STEP before anyone divided 15 wins by 5 losses. If the
 * numbers say a constraint is impossible, no constant fixes it.
 *
 * This prints the division of record: ladder shape, what a budget buys, what the
 * board will therefore price you at, and what that costs against the loss budget.
 *
 * Usage: node scripts/climb-arithmetic.cjs [--pts 20,42]
 */
const fs=require('fs'), path=require('path'), {JSDOM}=require('jsdom');
const R=path.resolve(__dirname,'..')+'/';
const args=process.argv.slice(2);
const argS=(f,d)=>{const i=args.indexOf(f);return i>=0?args[i+1]:d;};
const PTS=argS('--pts','20,42').split(',').map(Number);

const DATA=JSON.parse(fs.readFileSync(R+'data/climb.json','utf8'));
const HTML=fs.readFileSync(R+'prototypes/the-climb.html','utf8');
const dom=new JSDOM(HTML,{runScripts:'dangerously',pretendToBeVisual:true,
  beforeParse(w){w.fetch=()=>Promise.resolve({json:()=>Promise.resolve(DATA)});}});
const win=dom.window;

setTimeout(main,800);

// Expected losses over a run of N wins at average win prob p, and the chance of
// surviving them against a budget. Negative binomial: fight until N wins, count
// losses; survive == fewer than BUDGET losses along the way.
function survive(N,p,budget){
  // P(reach N wins before `budget` losses) — race to N wins vs budget losses.
  let s=0;
  for(let l=0;l<budget;l++){
    // P(exactly l losses before the Nth win) = C(N-1+l, l) p^N (1-p)^l
    let c=1; for(let i=1;i<=l;i++) c=c*(N-1+i)/i;
    s += c*Math.pow(p,N)*Math.pow(1-p,l);
  }
  return s;
}
const expLosses=(N,p)=>N*(1-p)/p;

function main(){
const L=win.eval('LADDER().map(f=>({name:f.name,rank:f.rankNum,power:f.power}))');
const ranked=L.filter(f=>f.rank<99).sort((a,b)=>a.rank-b.rank);
const unranked=L.filter(f=>f.rank===99);
const avg=a=>a.reduce((x,y)=>x+y,0)/a.length;

console.log('THE CLIMB — the arithmetic, measured off the real ladder.\n');
console.log('LADDER SHAPE ('+win.eval('DIV')+')');
console.log('-'.repeat(72));
const champ=ranked.find(f=>f.rank===0);
console.log('  champion      power '+(champ?champ.power.toFixed(1):'?'));
for(const r of [1,5,10,15]){
  const f=ranked.find(x=>x.rank===r);
  if(f) console.log(('  #'+r).padEnd(16)+'power '+f.power.toFixed(1)+'   '+f.name);
}
console.log('  gatekeepers   power '+avg(unranked.map(f=>f.power)).toFixed(1)+
  '  (n='+unranked.length+', range '+Math.min(...unranked.map(f=>f.power)).toFixed(1)+
  '-'+Math.max(...unranked.map(f=>f.power)).toFixed(1)+')');
const g=avg(unranked.map(f=>f.power)), r15=ranked.find(x=>x.rank===15);
console.log('\n  THE CLIFF: gatekeeper '+g.toFixed(1)+' -> #15 '+r15.power.toFixed(1)+
  '  = '+(r15.power-g).toFixed(1)+' points');

console.log('\nWHAT A BUDGET BUYS (rating, best-case spend per archetype)');
console.log('-'.repeat(72));
const ORDERS={
  striker :['power','technique','pace','strdef','chin','cardio','takedef','grappling','wrestling'],
  wrestler:['wrestling','takedef','cardio','chin','grappling','power','technique','pace','strdef'],
  grappler:['grappling','wrestling','cardio','chin','takedef','technique','power','pace','strdef'],
};
console.log('  pts   '+Object.keys(ORDERS).map(k=>k.padStart(10)).join('')+'      vs #15   vs champ');
for(const pts of PTS){
  const line=[];
  let sample=null;
  for(const [k,O] of Object.entries(ORDERS)){
    const rating=win.eval('(function(){var a=Object.fromEntries(ATTRS.map(x=>[x.id,ATTR_MIN]));'+
      'var p='+pts+'-ATTRS.length*0;'+
      'var budget='+pts+'-'+win.eval('ATTRS.length')+';'+   // ATTR_MIN=1 each is pre-paid? no
      'var O='+JSON.stringify(O)+';var left='+pts+';'+
      'while(left>0){var moved=false;for(const id of O){var c=upCost(a[id]);'+
      'if(left>=c&&a[id]<ATTR_MAX){left-=c;a[id]++;moved=true;break;}}if(!moved)break;}'+
      'return myRating(a);})()');
    line.push(rating.toFixed(1).padStart(10));
    if(!sample) sample=rating;
  }
  // price that debut against the two ends of the ladder
  const pWin=(mine,theirs)=>1/(1+Math.pow(10,(theirs-mine)/win.eval('SCALE')));
  console.log(('  '+pts).padEnd(6)+line.join('')+
    '   '+(pWin(sample,r15.power)*100).toFixed(0)+'%'.padStart(6)+
    '     '+(pWin(sample,champ.power)*100).toFixed(0)+'%');
}
console.log('  (last two columns use the STRIKER rating, ladder odds only, no style)');

console.log('\nTHE LOSS BUDGET — CUT_AT '+win.eval('CUT_AT')+', so the run must clear N wins');
console.log('-'.repeat(72));
console.log('  wins   avg p    exp losses   survive');
for(const [N,p] of [[15,0.76],[15,0.78],[15,0.69],[15,0.65],[11,0.72],[8,0.68],[8,0.72],[8,0.75],[6,0.68],[5,0.50]]){
  console.log(('  '+N).padEnd(7)+(p*100).toFixed(0)+'%'+
    ('  '+expLosses(N,p).toFixed(1)).padStart(13)+
    ('  '+(survive(N,p,win.eval('CUT_AT'))*100).toFixed(0)+'%').padStart(10));
}
console.log('\n  A LADDER IS ONLY FEASIBLE IF ITS LENGTH AND ITS ODDS AGREE. Read down the');
console.log('  survive column: that is the belt rate ceiling for a player who never');
console.log('  makes a mistake. If it says 15%, no constant makes the game feel fair.');
process.exit(0);
}
