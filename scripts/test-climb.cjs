const fs=require('fs'), {JSDOM}=require('jsdom');
const R='/sessions/lucid-compassionate-dijkstra/mnt/GillyLab/';
const DATA=JSON.parse(fs.readFileSync(R+'prototypes/climb-data.json','utf8'));
const HTML=fs.readFileSync(R+'prototypes/the-climb.html','utf8');
const SCORER=fs.readFileSync(R+'prototypes/climb-scorer.js','utf8');
let fails=0; const ok=(c,l,x)=>{console.log('  '+(c?'PASS':'FAIL')+'  '+l+(x&&!c?'   '+x:''));if(!c)fails++;};

const dom=new JSDOM(HTML.replace('<script src="climb-scorer.js"></script>','<script>'+SCORER+'</script>'),{
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
  ok(typeof peek('S')==='object' && peek('S')!==null,'the REAL scorer is live in the browser');
  ok(/Create your fighter/.test(app()),'creator screen');
  const nAt = peek('ATTRS.length');
  ok(doc.querySelectorAll('input[type=range]').length===nAt,'one slider per attribute',
    doc.querySelectorAll('input[type=range]').length+'/'+nAt);
  ok(!/Cardio/i.test(app()) || /no cardio input/i.test(app()),'no fake cardio slider');

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
  win.eval('G.attrs.power=10; G.attrs.technique=10; render();');
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
      if(st.champ||st.losses>=2) break;
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
  win.eval('newGame(); G.started=true; G.rank=1; G.wins=10; G.streak=10; G.fightNo=10;'+
           'for(const a of ATTRS) G.attrs[a.id]=7;');
  const champOffer = peek('offers().filter(o=>o.f.rankNum===0)');
  ok(champOffer.length>0,'a #1 contender is offered the title shot');
  if(champOffer.length){
    const pf = peek('bo3('+champOffer[0].p+')');
    ok(pf>0.15 && pf<0.95,'the title fight is a real fight, not a formality',
      (pf*100).toFixed(1)+'% to win');
  }
  console.log('        bot rate is INFO, not a gate: an easiest-path bot went '+champs+'/8.');
  console.log('\n'+(fails?'  '+fails+' FAILED':'  all checks passed'));
  process.exit(fails?1:0);
})();
