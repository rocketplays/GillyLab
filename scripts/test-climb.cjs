const fs=require('fs'), {JSDOM}=require('jsdom');
// Was hardcoded to a previous session's sandbox path, which stopped existing the
// moment that session ended — so this gate threw EACCES instead of running, and
// a test that cannot run is a test that cannot fail. Resolve from __dirname like
// sim-climb-runs.cjs and smoke-climb-divisions.cjs already do.
const R=require('path').resolve(__dirname,'..')+'/';
const DATA=JSON.parse(fs.readFileSync(R+'prototypes/climb-data.json','utf8'));
const HTML=fs.readFileSync(R+'prototypes/the-climb.html','utf8');
// climb-scorer.js is GONE — the sim no longer referees, so the 90KB browser-
// wrapped scorer isn't shipped or loaded. The page needs no <script> injection.
let fails=0; const ok=(c,l,x)=>{console.log('  '+(c?'PASS':'FAIL')+'  '+l+(x&&!c?'   '+x:''));if(!c)fails++;};

const dom=new JSDOM(HTML,{
  runScripts:'dangerously', pretendToBeVisual:true,
  beforeParse(w){ w.fetch=()=>Promise.resolve({json:()=>Promise.resolve(DATA)}); }
});
const win=dom.window;
(async()=>{
  await new Promise(r=>setTimeout(r,120));
  const doc=win.document, app=()=>doc.querySelector('#app').textContent;
  const peek=e=>win.eval(e);
  console.log('\n== boot ==');
  ok(!/Could not load/.test(app()),'page booted');
  // WAS: 'the REAL scorer is live in the browser'. It isn't, on purpose — the sim
  // stopped refereeing and the 90KB browser copy is deleted. What must be live is
  // the BOARD: real fighters, real ranks, real power ratings, every division.
  ok(peek('D.order.length')>=10,'every division loaded','divisions='+peek('D.order.length'));
  ok(peek('LADDER().length')>20,'the chosen division has a ladder');
  ok(peek('LADDER().some(f=>f.rankNum===0)'),'the division has a champion to chase');
  ok(/Create your fighter/.test(app()),'creator screen');
  // The creator uses a -/+ stepper now, not sliders — same control as the
  // upgrade panel. What matters is one row per attribute with a readable level.
  const nAt = peek('ATTRS.length');
  ok(doc.querySelectorAll('.attr.up .pm').length===nAt,'one stepper per attribute',
    doc.querySelectorAll('.attr.up .pm').length+'/'+nAt);
  ok(doc.querySelectorAll('.lvlnum').length===nAt,'every attribute shows its level out of 10',
    doc.querySelectorAll('.lvlnum').length+'/'+nAt);
  // WAS: 'no fake cardio slider' — asserted Cardio must NOT exist, because the
  // sim had no cardio input. That test encoded a limitation as a principle. The
  // sim no longer referees, so cardio and durability are real attributes now:
  // the two things every fan argues about after a fight were the exact two the
  // model couldn't hear. Inverted deliberately.
  ok(/Cardio/i.test(app()) && /Durability/i.test(app()),'cardio + durability exist');

  console.log('\n== the sim actually scores the run ==');
  win.eval('G.started=true; render();');
  await new Promise(r=>setTimeout(r,20));
  const cards=[...doc.querySelectorAll('.opp')];
  ok(cards.length===3,'three opponents offered',cards.length+' offered');
  const probs=peek('offers().map(o=>o.p)');
  ok(probs.every(p=>p>0&&p<1),'every offer has a real win probability',JSON.stringify(probs.map(p=>+(p*100).toFixed(1))));
  ok(new Set(probs.map(p=>p.toFixed(4))).size>1,'the three offers differ in difficulty');

  // a build change must move the model
  const before=peek('offers()[0].p');
  win.eval('G.attrs.striking=10; G.attrs.wrestling=10; render();');
  await new Promise(r=>setTimeout(r,10));
  const after=peek('offers()[0].p');
  ok(after>before,'maxing Power+Technique raises your win prob',
    (before*100).toFixed(1)+'% -> '+(after*100).toFixed(1)+'%');

  console.log('\n== play 8 full runs ==');
  let champs=0, cut=0, lens=[], peaks=[];
  for(let i=0;i<8;i++){
    win.eval('newGame(); G.started=true;');
    // spread points, then play greedily-ish: always take the middle option
    // Spend the REAL starting budget the way a sensible player would: raise
    // everything evenly until it runs out. Was hardcoded to level 4 with pts=0,
    // which silently ignored POINTS_START entirely.
    win.eval('(function(){var moved=true; while(moved){ moved=false;'+
             'for(const a of ATTRS){ var c=upCost(G.attrs[a.id]);'+
             'if(G.pts>=c && G.attrs[a.id]<ATTR_MAX){ G.pts-=c; G.attrs[a.id]++; moved=true; } } }})()');
    let guard=0;
    while(guard++<40){
      const st=peek('({champ:G.champ,losses:G.losses})');
      if(st.champ||st.losses>=peek("CUT_AT")) break;
      win.eval('(function(){var o=offers(); if(!o.length){G.losses=2;return;} '+
               'var pick=o.slice().sort(function(a,b){return b.p-a.p})[0]; if(G.pts>0){var a=ATTRS[Math.floor(Math.random()*ATTRS.length)];'+
               'while(G.pts>0&&G.attrs[a.id]<ATTR_MAX){G.attrs[a.id]++;G.pts--;}} fight(pick);})()');
    }
    const st=peek('({champ:G.champ,losses:G.losses,wins:G.wins,rank:G.rank})');
    if(st.champ) champs++; else cut++;
    lens.push(st.wins+st.losses);
    peaks.push(st.rank==null?99:st.rank);
  }
  const avg=a=>(a.reduce((s,x)=>s+x,0)/a.length).toFixed(1);
  console.log('    champion runs : '+champs+'/8  ('+(champs*12.5).toFixed(0)+'%)');
  console.log('    cut           : '+cut+'/8');
  console.log('    avg run length: '+avg(lens)+' fights');
  console.log('    median peak   : '+(peaks.sort((a,b)=>a-b)[12]===99?'unranked':'#'+peaks[4]));
  ok(lens.every(l=>l>0),'every run actually plays');
  // Reachability is STRUCTURAL, not a bot's win rate. Failing the build because
  // a bad strategy loses is testing the wrong thing.
  // A REALISTIC end-of-run fighter, not a maxed one — and the BUDGET HAS TO TRACK
  // THE ECONOMY. This said 44 points, correct when wins paid 1-2 over ~15 fights.
  // With reward = risk x altitude a title run now earns ~20 start + ~70 = ~90, so
  // 44 was testing a challenger who can no longer exist, and it failed the build
  // for a title fight it had rigged to be unwinnable.
  //
  // This number is load-bearing and will rot again the next time the economy
  // moves. If it fights back a third time, make the test PLAY a run to the title
  // rather than hardcode what a challenger looks like.
  win.eval('newGame(); G.started=true; G.rank=1; G.wins=10; G.streak=10; G.fightNo=10;'+
           'G.pts=90; (function(){var O=["power","technique","wrestling","chin","cardio","takedef","grappling","pace","strdef"];'+
           'while(G.pts>0){var moved=false;'+
           'for(const id of O){var c=upCost(G.attrs[id]); if(G.pts>=c&&G.attrs[id]<ATTR_MAX){G.pts-=c;G.attrs[id]++;moved=true;break;}}'+
           'if(!moved)break;}})();');
  const champOffer = peek('offers().filter(o=>o.f.rankNum===0)');
  ok(champOffer.length>0,'a #1 contender is offered the title shot');
  if(champOffer.length){
    // o.p IS the fight probability now. bo3() here would re-apply a round->fight
    // conversion to a number that has already had one — the exact bug that made
    // the card read -13,700.
    const pf = champOffer[0].p;
    ok(pf>0.15 && pf<0.95,'the title fight is a real fight, not a formality',
      (pf*100).toFixed(1)+'% to win');
  }
  console.log('        bot rate is INFO, not a gate: an easiest-path bot went '+champs+'/8.');
  console.log('\n'+(fails?'  '+fails+' FAILED':'  all checks passed'));
  process.exit(fails?1:0);
})();
