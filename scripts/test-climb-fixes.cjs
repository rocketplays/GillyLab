const fs=require('fs'), {JSDOM}=require('jsdom');
// See test-climb.cjs: this was pinned to a dead session sandbox path and had been
// throwing EACCES rather than testing anything.
const R=require('path').resolve(__dirname,'..')+'/';
const DATA=JSON.parse(fs.readFileSync(R+'data/climb.json','utf8'));
const HTML=fs.readFileSync(R+'prototypes/the-climb.html','utf8');
// climb-scorer.js is GONE — the sim no longer referees, so the 90KB browser-
// wrapped scorer isn't shipped or loaded. The page needs no <script> injection.
const dom=new JSDOM(HTML,
 {runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){w.fetch=()=>Promise.resolve({json:()=>Promise.resolve(DATA)});}});
const win=dom.window; let f=0;
const ok=(c,l,x)=>{console.log('  '+(c?'PASS':'FAIL')+'  '+l+(x&&!c?'   '+x:''));if(!c)f++;};
setTimeout(()=>{
  const doc=win.document, peek=e=>win.eval(e);

  console.log('\n== 1. the upgrade button fits its column ==');
  win.eval('newGame(); G.started=true; G.pts=20; render();');
  const rows=[...doc.querySelectorAll('.attr.up')];
  // UI_ATTRS, not ATTRS: the upgrade panel spends points on Fight IQ too (a build
  // stat kept out of the combat set so it feeds no win probability), so it draws
  // one more row than there are combat attributes.
  const nAttr = peek('UI_ATTRS.length');
  ok(rows.length===nAttr,'upgrade rows use their own grid class',rows.length+' rows vs '+nAttr+' build stats');
  ok(!doc.querySelector('.attr:not(.up) button'),'no upgrade button left in the 42px creator grid');

  console.log('\n== 1b. you cannot drop an attribute below the free baseline ==');
  // Playtest: "you're able to put a default attribute of 1 down to 0."
  // costTo() charges nothing below ATTR_MIN, so 1 -> 0 refunded NOTHING: a free
  // downgrade the UI invited. Every slider must floor at the baseline.
  // The slider is gone, the FLOOR still matters. Drive the real minus button to
  // the bottom and confirm it stops at the free baseline and refunds every point.
  win.eval('newGame(); render();');
  const AMIN=peek('ATTR_MIN');
  const row0=()=>[...doc.querySelectorAll('.attr.up')][0];
  const plus=()=>row0().querySelectorAll('.pmbtn')[1], minus=()=>row0().querySelectorAll('.pmbtn')[0];
  for(let i=0;i<4;i++) plus().click();
  const raised=peek('G.attrs[ATTRS[0].id]');
  for(let i=0;i<12;i++) minus().click();
  ok(raised>AMIN,'the + button actually raises the attribute','got '+raised);
  ok(peek('G.attrs[ATTRS[0].id]')===AMIN,'the - button floors at ATTR_MIN, never below',
     'landed on '+peek('G.attrs[ATTRS[0].id]')+' want '+AMIN);
  ok(peek('G.pts')===peek('POINTS_START'),'stepping all the way back down refunds every point',
     'pts='+peek('G.pts')+' want '+peek('POINTS_START'));
  // and the floor must genuinely be free — otherwise the baseline eats the budget
  ok(peek('spent()')===0,'the baseline sheet costs nothing','spent='+peek('spent()'));
  ok(peek('G.pts')===peek('POINTS_START'),'you start with the full budget');

  console.log('\n== 1c. the board always offers a choice ==');
  // Playtest: "sometimes it only gives you one option for a matchup. there
  // should always be 2+." Measured at 21.6% of boards, 72% of them at #15 —
  // narrowing the rank bands made the three picks collide and the dedup
  // collapsed them. Guard every rung, not just the middle ones.
  let thin=[];
  for(const dv of peek('D.order')){
    for(const rk of [null,15,14,10,6,3,2,1]){
      win.eval('DIV="'+dv+'"; newGame(); G.started=true; G.rank='+(rk===null?'null':rk)+'; G.wins=6;');
      const n=peek('offers().length');
      if(n<2) thin.push(dv+' @ '+(rk===null?'unranked':'#'+rk)+' -> '+n);
    }
  }
  ok(thin.length===0,'every rung of every division offers 2+ fights',thin.join('; '));

  console.log('\n== 1c2. the man who beat you does not come back ==');
  // Playtest: "L vs Johnny Walker (64%), L vs Johnny Walker (64%), L vs Johnny
  // Walker (68%)" — three straight rematches with a man who had already beaten
  // him. Cause: the board's top-up filtered on G.beat, which only records WINS,
  // so a conqueror was never excluded. Reads exactly like "it isn't refreshing
  // the matchups when losing", which is how it was reported. Play real runs and
  // watch for it; a static board can't see this.
  let revenge=0, repeat=0, boards=0, titleLoss=0, titleBack=0, nCards=0, repCards=0, allRepeat=0;
  const O=['power','technique','pace','strdef','chin','cardio','takedef','grappling','wrestling'];
  const sp='(function(){var O='+JSON.stringify(O)+';while(G.pts>0){var m=false;'+
    'for(const id of O){var c=upCost(G.attrs[id]);if(G.pts>=c&&G.attrs[id]<ATTR_MAX){G.pts-=c;G.attrs[id]++;m=true;break;}}if(!m)break;}})()';
  // 12 -> 30 runs a division. NOT a threshold change — the 20% line is untouched.
  // At 12 the estimate was noisy enough to cross it on its own: measured, the same
  // unchanged code read 12.4%, 20.4%, and PASS six times running. A gate that flakes
  // one run in seven is the thing this file's own comment warns about ("a test that
  // cries wolf gets ignored, which is worse than no test") and it fails in the worst
  // possible way — it teaches you to shrug at a red gate, which is exactly when a
  // real regression walks past. More samples tightens the estimate around its true
  // ~13%, which moves it FURTHER from the line in SE terms. Strictly stricter, and
  // it costs about a second.
  for(const dv of ['LHW','LW']){
    for(let r=0;r<30;r++){
      win.eval('DIV="'+dv+'"; newGame(); G.started=true;'); win.eval(sp);
      for(let g=0; g<40; g++){
        const st=peek('({c:G.champ,l:G.losses,out:!!G.outOfShots})'); if(st.c||st.out||st.l>=peek('CUT_AT')) break;
        if(peek('G.pts>0')) win.eval(sp);
        const n=peek('offers().length'); if(!n) break;
        boards++;
        // THE CHAMPION IS EXEMPT, and this test used to assert he wasn't.
        // `revenge` counted ANY conqueror on the board, champion included — so the
        // gate was green precisely because losing a title fight removed the belt
        // from the game forever. A test can bank a bug as hard as it banks a fix:
        // this one was the reason nobody noticed that a #1 with a title loss has
        // no win condition and farms #3 until the 40-fight guard.
        if(peek('offers().some(x=>x.f.rankNum>0.5 && G.log.some(l=>l.opp===x.f.name && !l.won))')) revenge++;
        nCards+=n;
        // The champion is EXCLUDED here: his return after a title loss is the WIN
        // CONDITION, not the matchmaker recycling because it ran out of contenders.
        // Counting him conflates "the belt is reachable" with "the division is
        // exhausted", and would set this gate against the fix directly above it.
        repCards+=peek('offers().filter(x=>x.f.rankNum>0.5 && G.log.some(l=>l.opp===x.f.name)).length');
        if(peek('offers().every(x=>G.log.some(l=>l.opp===x.f.name))')) allRepeat++;
        if(peek('offers().some(x=>G.log.some(l=>l.opp===x.f.name))')) repeat++;
        // Track the property that MATTERS: once you have lost a title fight and
        // won something since, the champion must be reachable again.
        if(peek('G.log.some(l=>l.rank===0 && !l.won)')){
          titleLoss++;
          if(peek('G.streak>0 && offers().some(x=>x.f.rankNum===0)')) titleBack++;
        }
        // TAKE THE BELT WHEN IT IS OFFERED — same reason as sim-climb-runs.cjs.
        // o[Math.floor(o.length/2)] is the 'near' card, so this bot ducked the title
        // forever and ran the full 40-fight guard on every single run. A 40-fight bot
        // eats a 16-man ladder and then reports "rematches" — a measurement of the
        // harness refusing to finish, reported as a fact about matchmaking.
        win.eval('(function(){var o=offers();'+
          'var t=o.filter(function(x){return x.f.rankNum===0})[0];'+
          'fight(t||o[Math.floor(o.length/2)]);})()');
      }
    }
  }
  // The HARD assertion: a CONTENDER who beat you never returns. Deterministic —
  // the filter either excludes him or it doesn't.
  ok(revenge===0,'a contender who beat you is never re-offered',revenge+'/'+boards+' boards');
  // The other half, and the one that was missing: the belt stays winnable. A loss
  // to the champion costs a shot, not the run.
  ok(titleLoss===0 || titleBack>0,'the belt is still reachable after a title loss',
     titleLoss?titleBack+'/'+titleLoss+' post-title-loss boards offered the champ again':'no title losses seen');
  // The SOFT one: rematches of men you BEAT are fine (a real career has them) and
  // only matter if they FLOOD the board. Threshold unchanged at 20%.
  //
  // I NEARLY MOVED THIS GOALPOST, AND IT WOULD HAVE BEEN WRONG. It went red (23%
  // -> 46%) while I was fixing the ladder, and I had a genuinely good argument for
  // relaxing it: the rate is mostly ARITHMETIC, since a 16-man ladder plus a
  // 3-card board means P(one of three is a rematch) climbs with run depth no
  // matter how good the matchmaker is. All true. It was also beside the point.
  // The rate was high because the TEST BOT ducked the title shot and ran the full
  // 40-fight guard every time; a bot that never finishes eats the division and
  // then reports the leftovers as a matchmaking defect. Fix the bot and this reads
  // 12% without touching the threshold.
  //
  // The lesson is the expensive one: A RED GATE WITH A PLAUSIBLE EXCUSE IS STILL A
  // RED GATE. I had the argument for weakening it BEFORE I had the cause, and the
  // argument was correct in every particular except that it was not what was
  // happening. If the reasoning for relaxing a threshold arrives before the
  // diagnosis does, that is the tell.
  ok(repeat/boards < 0.20,'rematches never flood the board',(repeat/boards*100).toFixed(1)+'% of '+boards+' boards');
  // Two ADDITIONS, not replacements — they measure the word in the assertion's own
  // name, which the board-level proxy above never quite did. A flood is a board
  // that is MOSTLY rematches: 1 of 3 is a career, 3 of 3 is a dead division.
  ok(allRepeat/boards < 0.05,'no board is ALL rematches',
     (allRepeat/boards*100).toFixed(1)+'% of '+boards+' boards');
  ok(repCards/nCards < 0.25,'most cards are still someone new',
     (repCards/nCards*100).toFixed(1)+'% of '+nCards+' cards were a rematch');

  console.log('\n== 1c3. the ducker: nobody gets fought forever ==');
  // THE REGIME NO OTHER TEST REACHES. Every bot in every harness takes the title
  // when it's offered — correctly, since ducking it was itself a bug — so they all
  // finish at ~13 fights and the matchmaker's exhausted state is never sampled.
  // A player who DUCKS the belt runs 30+ fights, and there it was serving the same
  // man twenty times in a row: measured, Sergei Pavlovich for fights 15-33.
  //
  // "Rematches never flood the board" was green the whole time, because a board
  // holding one rematch looks identical whether it's his second meeting or his
  // twentieth. The gate measured the board; the bug was in the SEQUENCE.
  let worstMeetings=0, worstStreak=0, deadEnds=0, longRuns=0;
  for(const dv of ['LHW','LW','HW']){
    for(let r=0;r<4;r++){
      win.eval('DIV="'+dv+'"; newGame(); G.started=true;'); win.eval(sp);
      const seq=[]; let empty=false;
      for(let g=0; g<40; g++){
        const st=peek('({c:G.champ,l:G.losses})'); if(st.c||st.l>=peek('CUT_AT')) break;
        if(peek('G.pts>0')) win.eval(sp);
        if(!peek('offers().length')){ empty=true; break; }
        seq.push(win.eval('(function(){var o=offers();'+
          'var nt=o.filter(function(x){return x.f.rankNum!==0});'+   // duck the belt
          'var s=(nt.length?nt:o);var pick=s[Math.floor(s.length/2)];fight(pick);return pick.f.name;})()'));
      }
      if(seq.length<12) continue;
      longRuns++;
      if(empty) deadEnds++;
      const f={}; seq.forEach(n=>f[n]=(f[n]||0)+1);
      worstMeetings=Math.max(worstMeetings, Math.max(...Object.values(f)));
      let m=1,c=1; for(let i=1;i<seq.length;i++){ if(seq[i]===seq[i-1]){c++;m=Math.max(m,c);} else c=1; }
      worstStreak=Math.max(worstStreak,m);
    }
  }
  ok(longRuns>0,'the ducker actually produces long runs to test', longRuns+' runs of 12+ fights');
  // A trilogy is a career; a tetralogy is the matchmaker out of ideas.
  ok(worstMeetings<=3,'no opponent is ever fought more than 3 times',
     'worst was '+worstMeetings+' meetings');
  ok(worstStreak<=3,'no opponent is served back-to-back forever',
     'worst streak was '+worstStreak+' in a row');
  ok(deadEnds===0,'ducking the belt never dead-ends the run', deadEnds+'/'+longRuns+' runs hit an empty board');

  console.log('\n== 1d. opponents have faces ==');
  win.eval('DIV="LW"; newGame(); G.started=true; G.pts=40; render();');
  const avs=[...doc.querySelectorAll('.opp .av img')];
  const cards=doc.querySelectorAll('.opp').length;
  ok(avs.length===cards,'every opponent card carries an avatar',avs.length+'/'+cards);
  // A wrong slug 404s to initials and looks like "no photo" rather than a bug,
  // so assert the files are really there.
  const fsx=require('fs'), R2=require('path').resolve(__dirname,'..')+'/';
  const gone=avs.map(i=>i.getAttribute('src').split('/').pop())
                .filter(f=>!fsx.existsSync(R2+'photos/thumb/'+f));
  ok(gone.length===0,'the photos those avatars point at exist',gone.join(', '));

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
