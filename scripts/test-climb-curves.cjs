/* The Climb — the attribute curves are anchored to real fighters.
 *
 * This suite exists because of a specific, embarrassing class of bug: the game's
 * stat curves were hand-picked ramps that put level 10 Power at 3.6x the best
 * lightweight who has ever fought, and level 1 Power ABOVE the division median.
 * Every measurement taken on top of that mapping was clean, careful, and wrong —
 * including a "spread beats specialists" finding that reversed the moment the
 * curves were anchored to reality.
 *
 * So these tests do NOT check the curve table (that's generated, and checking a
 * generated constant against itself proves nothing). They check the curve
 * against the REAL DIVISION shipped in climb-data.json, through the REAL page.
 * If someone hand-edits CURVES back into fantasy, this fails.
 */
const fs=require('fs'), {JSDOM}=require('jsdom');
const R='/Users/jeffreyadler/Documents/GitHub/GillyLab/'.replace('/Users/jeffreyadler/Documents/GitHub/GillyLab/',
  require('path').resolve(__dirname,'..')+'/');
const DATA=JSON.parse(fs.readFileSync(R+'prototypes/climb-data.json','utf8'));
const HTML=fs.readFileSync(R+'prototypes/the-climb.html','utf8');
const SCORER=fs.readFileSync(R+'prototypes/climb-scorer.js','utf8');
const dom=new JSDOM(HTML.replace('<script src="climb-scorer.js"></script>','<script>'+SCORER+'</script>'),
 {runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){w.fetch=()=>Promise.resolve({json:()=>Promise.resolve(DATA)});}});
const win=dom.window; let f=0;
const ok=(c,l,x)=>{console.log('  '+(c?'PASS':'FAIL')+'  '+l+(x&&!c?'   '+x:''));if(!c)f++;};

// the real division, read straight from the shipped board
const S=DATA.FIGHTER_STATS;
const num=v=>{if(v==null)return null;const m=/(-?\d+(\.\d+)?)/.exec(String(v));return m?+m[1]:null;};
const vals=k=>DATA.ladder.map(x=>num(S[x.name]&&S[x.name][k])).filter(v=>v!=null&&isFinite(v)).sort((a,b)=>a-b);
const med=a=>a[Math.floor(a.length/2)];

setTimeout(()=>{
  const peek=e=>win.eval(e);

  console.log('\n== 1. every level lives inside the sport ==');
  // The bug that started all this: level 1 above the median, level 10 in orbit.
  const RATE=['kd','slpm','tdLanded','subAvg'];       // no ceiling -> headroom allowed
  const PCT =['strAcc','strDef','tdAcc','tdDef'];     // bounded by physics -> no headroom
  let orbit=[], toohigh=[];
  for(const k of RATE.concat(PCT)){
    const a=vals(k), C=peek('CURVES.'+k), lo=C[0], hi=C[10];
    // level 0 must be at or below the division median — a starting fighter is not
    // an above-average professional.
    if(lo>med(a)) toohigh.push(k+' lvl0='+lo+' > median '+med(a));
    // level 10 may exceed the best man alive, but only just. 1.35x is the gate:
    // enough for "otherworldly", nowhere near the 3.6x that broke the model.
    const cap=PCT.includes(k)?1.0:1.35;
    if(hi>a[a.length-1]*cap) orbit.push(k+' lvl10='+hi+' vs div best '+a[a.length-1]);
  }
  ok(toohigh.length===0,'level 0 is never better than the division median',toohigh.join('; '));
  ok(orbit.length===0,'level 10 is beyond the best man alive, but not in orbit',orbit.join('; '));

  console.log('\n== 2. no dead levels ==');
  // A point you spend for nothing is a lie. This is what capped the convexity at
  // k=1.6: the honest fit was k=2.6 and it made Power levels 1-2 move kd by 0.005.
  let dead=[];
  for(const k of RATE.concat(PCT)){
    const C=peek('CURVES.'+k), span=Math.abs(C[10]-C[0]);
    for(let v=1;v<=10;v++){
      const step=Math.abs(C[v]-C[v-1]);
      if(step < span*0.02) dead.push(k+' lvl'+v+' moves '+step.toFixed(3));
    }
  }
  ok(dead.length===0,'every level moves its stat by a real amount',dead.join('; '));

  console.log('\n== 3. the curve is monotone ==');
  let bad=[];
  for(const k of RATE.concat(PCT)){
    const C=peek('CURVES.'+k), down=C[10]<C[0];     // sapm: lower is better
    for(let v=1;v<=10;v++) if(down?C[v]>=C[v-1]:C[v]<=C[v-1]) bad.push(k+' lvl'+v);
  }
  ok(bad.length===0,'more of an attribute is never worse',bad.join('; '));

  console.log('\n== 4. the top of the curve is where the payoff is ==');
  // The playtest ask: "going from 6->10 power should give you a REAL power boost,
  // not linear." Convexity comes from the division's own skew, so this asserts
  // the shape survived, not a specific number.
  let flat=[];
  for(const k of ['kd','subAvg','tdLanded']){
    const C=peek('CURVES.'+k);
    const lowStep=Math.abs(C[1]-C[0]), topStep=Math.abs(C[10]-C[9]);
    if(topStep <= lowStep*1.5) flat.push(k+' top step '+topStep.toFixed(3)+' vs bottom '+lowStep.toFixed(3));
  }
  ok(flat.length===0,'the last level moves the stat far more than the first',flat.join('; '));

  console.log('\n== 5. the sim reads it, and the soft cap is gone ==');
  // The real proof. Under the fantasy curve, gains COLLAPSED at the top (+0.49 at
  // 9->10) because the model was being asked to extrapolate off its training
  // range. Inside the real range that collapse must not reappear.
  const OPPS=['Ilia Topuria','Justin Gaethje','Dan Hooker','Charles Oliveira'];
  // winProb returns a FRACTION, not a percentage. Multiply here, once — the
  // first draft of this test compared 0.10 against a 2-point threshold and
  // reported that maxing Power moved the sim "0.1pts". It moved it ten.
  const winAt=(attr,lv)=>100*peek(
    '(function(){ newGame(); G.started=true;'+
    ' for(const A of ATTRS) G.attrs[A.id]=5;'+
    ' G.attrs["'+attr+'"]='+lv+';'+
    ' var o='+JSON.stringify(OPPS)+'.map(n=>winProb(n)).filter(x=>x!=null);'+
    ' return o.reduce((a,b)=>a+b,0)/o.length; })()');
  let collapsed=[], inert=[];
  for(const attr of ['striking','grappling','wrestling']){
    const lo=winAt(attr,0), mid=winAt(attr,5), hi=winAt(attr,10);
    const bottomHalf=mid-lo, topHalf=hi-mid;
    if(hi-lo < 2) inert.push(attr+' moves only '+(hi-lo).toFixed(1)+'pts end to end');
    // convex curve => the TOP half must be worth at least as much as the bottom.
    // If the top half is worth less, we're back off the end of the training data.
    if(topHalf < bottomHalf*0.9) collapsed.push(attr+' top half '+topHalf.toFixed(1)+'pts < bottom half '+bottomHalf.toFixed(1)+'pts');
  }
  ok(inert.length===0,'each of the big three attributes actually moves the sim',inert.join('; '));
  ok(collapsed.length===0,'the top half of the curve is not worth less than the bottom',collapsed.join('; '));

  console.log('\n== 6. the division\'s best man sits near the top of the scale ==');
  // Self-validating, and the check that would have caught the original bug on
  // day one. Nobody tells the generator who the best lightweight is; it reads the
  // ladder. So the real ceiling — Ruffy's 1.54 kd, Oliveira's 2.59 subs — must
  // land in the last couple of levels. Under the fantasy curve Ruffy came out at
  // level 2.6 of 10, which is the entire bug stated as one number.
  //
  // NOT an equality check against level 9: the scale runs 0..10 and level 10 is
  // the +20% headroom, so the best man alive lands around 8.8. He must be high,
  // not exact.
  let misplaced=[];
  for(const k of ['kd','subAvg','slpm','tdLanded']){
    const C=peek('CURVES.'+k), a=vals(k), best=a[a.length-1];
    const owner=DATA.ladder.find(x=>Math.abs(num(S[x.name]&&S[x.name][k])-best)<1e-9);
    // where does the real best man fall on our 0..10 scale?
    let lvl=0; while(lvl<10 && C[lvl+1]<best) lvl++;
    const frac=lvl + (best-C[lvl])/((C[lvl+1]-C[lvl])||1);
    console.log('        '+k.padEnd(9)+(owner?owner.name:'?').padEnd(20)+best+'  ->  level '+frac.toFixed(1));
    if(frac < 8) misplaced.push(k+': division best is only level '+frac.toFixed(1));
  }
  ok(misplaced.length===0,'the best fighter in the division rates level 8+',misplaced.join('; '));

  console.log(f?('\n  '+f+' FAILED'):'\n  all checks passed');
  process.exit(f?1:0);
},700);
