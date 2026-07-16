#!/usr/bin/env node
/* The Climb — does every division play, and is any of them a walkover?
 *
 * The cheap half of a balance sweep. It does NOT answer "is the title rate 20%"
 * (that's sim-climb-runs.cjs, and it's slow); it answers "can you play this
 * division at all, and is the belt free". Both are things a player hits in the
 * first ten minutes.
 *
 * It earned its place immediately: with DIV_SWING at 12, an easiest-path bot —
 * the dumbest strategy in the game — won the light-heavyweight title 3 times out
 * of 3 and went 21 fights, while the same bot got cut at #12 in welterweight
 * after 7. That isn't a difficulty spread, it's two different games. The
 * division talent measurement was sound; the SWING I picked off it was a guess,
 * and the guess was wrong.
 *
 * Usage: node scripts/smoke-climb-divisions.cjs [runs]
 */
const fs=require('fs'), path=require('path'), {JSDOM}=require('jsdom');
const R=path.resolve(__dirname,'..')+'/';
const DATA=JSON.parse(fs.readFileSync(R+'data/climb.json','utf8'));
const N=+process.argv[2]||4;
let warns=0;
const dom=new JSDOM(fs.readFileSync(R+'prototypes/the-climb.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,
  beforeParse(w){w.fetch=()=>Promise.resolve({json:()=>Promise.resolve(DATA)});w.console.warn=()=>{warns++};}});
setTimeout(()=>{
  const w=dom.window, out=[], bad=[];
  // The bot spreads points evenly and always takes the easiest fight. It is
  // meant to be BAD. If a bad bot wins the belt often, the belt is free.
  // Define the body ONCE. The first draft built the in-run version by slicing
  // the string apart (spend.slice(12,-3)), which cut mid-token and threw
  // 'Unexpected token var' inside every division — reported as 0 fights, 0%
  // belts, and a clean-looking "spread: 0% -> 0%". A crash that renders as a
  // plausible table is the same failure as the 50.0% column.
  const SPEND_BODY='var m=true;while(m){m=false;for(const a of ATTRS){'+
    'var c=upCost(G.attrs[a.id]);if(G.pts>=c&&G.attrs[a.id]<ATTR_MAX){G.pts-=c;G.attrs[a.id]++;m=true;}}}';
  const spend='(function(){'+SPEND_BODY+'})()';
  for(const div of DATA.order){
    let f=0,champ=0,empty=0,peaks=[];
    for(let i=0;i<N;i++){
      try{
        w.eval('DIV="'+div+'"; newGame(); G.started=true;'); w.eval(spend);
        let g=0,peak=99;
        for(;;){
          if(g++>40) break;
          const st=w.eval('({c:G.champ,l:G.losses,r:G.rank})');
          if(st.r!=null&&st.r<peak) peak=st.r;
          if(st.c){champ++;peak=0;break;}
          if(st.l>=2) break;
          if(!w.eval('offers().length')){empty++;break;}
          w.eval('(function(){if(G.pts>0){'+SPEND_BODY+'}'+
                 'var o=offers();fight(o.slice().sort((x,y)=>y.p-x.p)[0]);})()');
        }
        f+=w.eval('G.log.length'); peaks.push(peak);
      }catch(e){ bad.push(div+': '+e.message); peaks.push(99); }
    }
    peaks.sort((a,b)=>a-b);
    out.push({div,f:f/N,champ:champ/N*100,peak:peaks[Math.floor(peaks.length/2)]});
    if(empty) bad.push(div+': empty board x'+empty);
  }
  console.log('THE CLIMB — '+N+' runs per division, easiest-path bot (deliberately bad)\n');
  console.log('div    avg fights   median peak   belt%');
  out.forEach(r=>console.log('  '+r.div.padEnd(6)+r.f.toFixed(1).padStart(8)+'   '+('#'+r.peak).padStart(11)+'   '+r.champ.toFixed(0).padStart(4)+'%'));
  const b=out.map(r=>r.champ);
  console.log('\n  belt% spread: '+Math.min(...b).toFixed(0)+'% -> '+Math.max(...b).toFixed(0)+'%');
  console.log('  stale-offer warnings: '+warns);
  console.log('\n  A BAD bot should rarely win anywhere. Any division near 100% is a free belt.');
  if(bad.length){ console.log('\n  BROKEN:\n   '+bad.join('\n   ')); process.exit(1); }
  process.exit(0);
},900);
