const fs=require('fs'), {JSDOM}=require('jsdom');
const R='/sessions/lucid-compassionate-dijkstra/mnt/GillyLab/';
const DATA=JSON.parse(fs.readFileSync(R+'prototypes/climb-data.json','utf8'));
const HTML=fs.readFileSync(R+'prototypes/the-climb.html','utf8');
const SCORER=fs.readFileSync(R+'prototypes/climb-scorer.js','utf8');
const dom=new JSDOM(HTML.replace('<script src="climb-scorer.js"></script>','<script>'+SCORER+'</script>'),
 {runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){w.fetch=()=>Promise.resolve({json:()=>Promise.resolve(DATA)});}});
const win=dom.window; let f=0;
const ok=(c,l,x)=>{console.log('  '+(c?'PASS':'FAIL')+'  '+l+(x&&!c?'   '+x:''));if(!c)f++;};
setTimeout(()=>{
  const doc=win.document, peek=e=>win.eval(e);

  console.log('\n== 1. the upgrade button fits its column ==');
  win.eval('newGame(); G.started=true; G.pts=20; render();');
  const rows=[...doc.querySelectorAll('.attr.up')];
  const nAttr = peek('ATTRS.length');
  ok(rows.length===nAttr,'upgrade rows use their own grid class',rows.length+' rows vs '+nAttr+' attributes');
  ok(!doc.querySelector('.attr:not(.up) button'),'no upgrade button left in the 42px creator grid');

  console.log('\n== 1b. you cannot drop an attribute below the free baseline ==');
  // Playtest: "you're able to put a default attribute of 1 down to 0."
  // costTo() charges nothing below ATTR_MIN, so 1 -> 0 refunded NOTHING: a free
  // downgrade the UI invited. Every slider must floor at the baseline.
  win.eval('newGame(); render();');
  const mins=[...doc.querySelectorAll('.attr:not(.up) input[type=range]')].map(i=>+i.min);
  const AMIN=peek('ATTR_MIN');
  ok(mins.length>0 && mins.every(m=>m===AMIN),'every creator slider floors at ATTR_MIN',
     'mins='+JSON.stringify(mins)+' ATTR_MIN='+AMIN);
  // and the floor must genuinely be free — otherwise the baseline eats the budget
  ok(peek('spent()')===0,'the baseline sheet costs nothing','spent='+peek('spent()'));
  ok(peek('G.pts')===peek('POINTS_START'),'you start with the full budget');

  console.log('\n== 2. a finish ends the fight ==');
  let sawFin=false, badFin=0, sawDec=false, badDec=0;
  for(let i=0;i<60;i++){
    win.eval('newGame(); G.started=true; G.attrs.striking=10; G.attrs.grappling=10;');
    win.eval('(function(){ fight(offers()[0]); })()');
    const L=peek('G.log[0]');
    if(L.fin){ sawFin=true;
      if(L.rounds.length!==L.finRound) badFin++;              // must truncate AT the finish
      if(L.rounds.length>3||L.finRound<1||L.finRound>3) badFin++;
    } else if(L.won){ sawDec=true; if(L.rounds.length!==3) badDec++; }
  }
  ok(sawFin,'finishes happen');
  ok(badFin===0,'a finish shows ONLY the rounds up to the stoppage','bad='+badFin);
  ok(sawDec,'decisions happen');
  ok(badDec===0,'a decision still shows all 3 rounds','bad='+badDec);

  console.log('\n== 3. a loss refreshes, and you never rematch your conqueror ==');
  let rematch=0, identical=0;
  for(let i=0;i<40;i++){
    win.eval('newGame(); G.started=true;');
    const before=peek('offers().map(o=>o.f.name)');
    win.eval('(function(){var o=offers()[0];'+
      'G.log.push({opp:o.f.name,won:false,fin:false,p:o.p,rank:o.f.rankNum,rounds:[false,false,false],roundsWon:0,finRound:0});'+
      'G.losses++; G.streak=0; G.fightNo++; G.last={o:o,won:false,fin:false};})()');
    const loser=peek('G.log[0].opp');
    const after=peek('offers().map(o=>o.f.name)');
    if(after.includes(loser)) rematch++;
    if(JSON.stringify(before)===JSON.stringify(after)) identical++;
  }
  ok(rematch===0,'the man who just beat you is NEVER re-offered',rematch+'/40');
  ok(identical===0,'the board always changes after a loss',identical+'/40 identical');

  console.log('\n== 4. the post-loss step-down works while UNRANKED ==');
  const eas=[]; const har=[];
  for(let i=0;i<6;i++){
    win.eval('newGame(); G.started=true;');
    har.push(peek('offers().map(o=>o.p).sort()[0]'));
    win.eval('(function(){var o=offers()[0];'+
      'G.log.push({opp:o.f.name,won:false,fin:false,p:o.p,rank:o.f.rankNum,rounds:[],roundsWon:0,finRound:0});'+
      'G.losses++; G.fightNo++;})()');
    eas.push(peek('offers().map(o=>o.p).sort()[0]'));
  }
  const avg=a=>a.reduce((s,x)=>s+x,0)/a.length;
  const b4=avg(har), af=avg(eas);
  ok(af>b4,'the toughest fight on offer gets EASIER after a loss',
    (b4*100).toFixed(1)+'% -> '+(af*100).toFixed(1)+'%');
  console.log('        toughest offer: '+(b4*100).toFixed(1)+'% before a loss -> '+(af*100).toFixed(1)+'% after');
  console.log('\n'+(f?'  '+f+' FAILED':'  all checks passed'));
  process.exit(f?1:0);
},150);
