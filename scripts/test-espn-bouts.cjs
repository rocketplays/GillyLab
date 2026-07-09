#!/usr/bin/env node
/**
 * Offline unit tests for scripts/fetch-espn-bouts.cjs. No network, no deps.
 *   node scripts/test-espn-bouts.cjs    (exit 0 = pass)
 *
 * The reconciler can HIDE a real fight from the site, so the guards around
 * decideCancellation are the most important assertions in here. Several of
 * these cases are regressions caught by a live --dry run, not by imagination:
 * "Zachary Reese" vs ESPN's "Zach Reese", and "Jan Bl\u0142achowicz" whose \u0142 does
 * not decompose under NFD. Both once produced false cancellation warnings.
 */
'use strict';
const m = require('./fetch-espn-bouts.cjs');
let fails = 0;
const ok = (n, c) => { if (!c) fails++; console.log((c ? 'ok   ' : 'FAIL ') + n); };

console.log('=== helpers, segments, bout construction ===');
{
  // helpers
  ok("refToId handles the .pvt internal host", m.refToId("http://sports.core.api.espn.pvt/v2/sports/mma/leagues/ufc/events/600059185?lang=en")==="600059185");
  ok("mapSegment Main Card", m.mapSegment("Main Card").order===1);
  ok("mapSegment Early Prelims", m.mapSegment("Early Prelims").order===3);
  ok("weightClass title", m.weightClassText("Welterweight",true)==="Welterweight Title Bout");
  ok("weightClass normal", m.weightClassText("Welterweight",false)==="Welterweight Bout");
  ok("flag USA", m.flagFor("USA")==="🇺🇸");
  ok("flag unknown -> null", m.flagFor("XYZ")===null);
  ok("normName strips accent+suffix", m.normName("Kauê Fernandes")==="kaue fernandes" && m.normName("Khalil Rountree Jr.")==="khalil rountree");

  const F=(name,slug)=>({name,slug,country:"USA",flag:"🇺🇸",division:"Welterweight",recordText:"1-0-0 (W-L-D)"});
  const eb=(sec,secOrd,pos,names,title=false)=>({section:sec,sectionOrder:secOrd,position:pos,weightClass:"Welterweight",titleBout:title,rounds:title?5:3,fighters:names.map(n=>F(n,n.toLowerCase().replace(/\W+/g,"-")))});

  // ESPN's real UFC 330 card (10)
  const espn=[
   eb("Main Card",1,1,["Islam Makhachev","Ian Machado Garry"],true),
   eb("Main Card",1,2,["Mackenzie Dern","Gillian Robertson"],true),
   eb("Main Card",1,3,["Erin Blanchfield","Jasmine Jasudavicius"]),
   eb("Prelims",2,1,["Jalin Turner","Kauê Fernandes"]),
   eb("Prelims",2,2,["Mansur Abdul-Malik","Dustin Stoltzfus"]),
   eb("Prelims",2,3,["Edson Barboza","Esteban Ribovics"]),
   eb("Prelims",2,4,["Jeremiah Wells","Myktybek Orolbai"]),
   eb("Prelims",2,5,["Geoff Neal","Chidi Njokuani"]),
   eb("Prelims",2,6,["Neil Magny","Ramiz Brahimaj"]),
   eb("Early Prelims",3,1,["Vicente Luque","Tresean Gore"]),
  ];
  const cb=(...names)=>({isCancelled:false,fighters:names.map(n=>({fighterName:n}))});

  console.log("\n-- case 1: Cito has the original 4 --");
  let r=m.reconcile({bouts:[cb("Ian Machado Garry","Islam Makhachev"),cb("Gillian Robertson","Mackenzie Dern"),cb("Esteban Ribovics","Edson Barboza"),cb("Jasmine Jasudavicius","Erin Blanchfield")]}, espn);
  ok("injects exactly the 6 missing", r.toInject.length===6);
  ok("flags none as only-in-Cito", r.onlyInCito.length===0);
  console.log("   +", r.toInject.map(b=>b.fighters.map(f=>f.name).join(" vs ")).join(" | "));

  console.log("\n-- case 2: Cito spells it 'Kaue' (no accent), ESPN 'Kauê' --");
  r=m.reconcile({bouts:[cb("Jalin Turner","Kaue Fernandes")]}, [espn[3]]);
  ok("no duplicate injected", r.toInject.length===0);

  console.log("\n-- case 3: Cito still lists a fight ESPN dropped (cancellation) --");
  r=m.reconcile({bouts:[cb("Umar Nurmagomedov","David Martinez")]}, [espn[0]]);
  ok("flagged as only-in-Cito", r.onlyInCito.length===1 && /Nurmagomedov/.test(r.onlyInCito[0].label));
  ok("never auto-removed (still additive only)", r.toInject.length===1);

  console.log("\n-- case 4: Cito booked Turner vs a different opponent --");
  r=m.reconcile({bouts:[cb("Jalin Turner","Some Newguy")]}, [espn[3]]);
  ok("skipped, not double-booked", r.toInject.length===0 && r.skipped.length===1);
  console.log("   reason:", r.skipped[0].reason);

  console.log("\n-- case 5: buildBout shape --");
  const b=m.buildBout("ufc-330", Object.assign({}, espn[3]));
  ok("boutOrder = section*1000 + position", b.boutOrder===2001);
  ok("cardPosition", b.cardPosition==="Prelims 1");
  ok("weightClass suffixed", b.weightClass==="Welterweight Bout");
  ok("two fighters, red/blue", b.fighters.length===2 && b.fighters[0].corner==="red" && b.fighters[1].corner==="blue");
  ok("record parsed", b.fighters[0].profile.record.wins===1);
  ok("not cancelled, confirmed", b.isCancelled===false && b.status==="confirmed");
  ok("tagged as espn-reconcile", b.dataSource==="espn-reconcile");
  const t=m.buildBout("ufc-330", Object.assign({}, espn[0]));
  ok("title bout -> Title Bout + 5 rounds", t.weightClass==="Welterweight Title Bout" && t.numberOfRounds===5 && t.titleBout===true);
}

console.log("\n=== name matching (regressions from a live dry run) ===");
{

  ok("Zachary Reese == Zach Reese", m.sameBout(["Ryan Gandra","Zachary Reese"],["Ryan Gandra","Zach Reese"]));
  ok("Jan Błachowicz == Jan Blachowicz", m.sameBout(["Jan Błachowicz","Bogdan Guskov"],["Jan Blachowicz","Bogdan Guskov"]));
  ok("deburr handles ł (not NFD-decomposable)", m.deburr("Błachowicz")==="Blachowicz");
  ok("deburr still handles ê", m.deburr("Kauê")==="Kaue");
  console.log("\n-- must NOT over-merge --");
  ok("Michael Johnson != Anthony Johnson", !m.sameBout(["Michael Johnson","Alex Smith"],["Anthony Johnson","Alex Smith"]));
  ok("different fights stay different", !m.sameBout(["Neil Magny","Ramiz Brahimaj"],["Geoff Neal","Chidi Njokuani"]));
  ok("Kauê/Kaue still match", m.sameBout(["Jalin Turner","Kauê Fernandes"],["Jalin Turner","Kaue Fernandes"]));
  ok("Rountree Jr. == Rountree", m.sameBout(["Khalil Rountree Jr.","Magomed Ankalaev"],["Khalil Rountree","Magomed Ankalaev"]));
  console.log("\n-- reconcile with the real-world variants --");
  const eb=names=>({section:"Prelims",sectionOrder:2,position:1,weightClass:"Welterweight",titleBout:false,rounds:3,fighters:names.map(n=>({name:n,slug:n.toLowerCase().replace(/\W+/g,"-")}))});
  const cb=(...n)=>({isCancelled:false,fighters:n.map(x=>({fighterName:x}))});
  let r=m.reconcile({bouts:[cb("Ryan Gandra","Zachary Reese")]},[eb(["Ryan Gandra","Zach Reese"])]);
  ok("no injection", r.toInject.length===0);
  ok("no false 'cancelled' flag", r.onlyInCito.length===0);
  ok("no bogus skip", r.skipped.length===0);
  r=m.reconcile({bouts:[cb("Jan Błachowicz","Bogdan Guskov")]},[eb(["Jan Blachowicz","Bogdan Guskov"])]);
  ok("Blachowicz: clean, no flags", r.toInject.length===0&&r.onlyInCito.length===0&&r.skipped.length===0);
  console.log("\n-- genuine cancellation still surfaces --");
  r=m.reconcile({bouts:[cb("Umar Nurmagomedov","David Martinez")]},[eb(["Someone Else","Other Guy"])]);
  ok("Nurmagomedov vs Martinez flagged", r.onlyInCito.length===1);
}

console.log("\n=== cancellation: the one operation that can destroy data ===");
{
  const cctx=o=>Object.assign({newsFlagged:null,forced:null,espnBoutCount:11,alreadyCancelled:0},o);

  console.log("── the happy path: two independent sources agree ──");
  ok("ESPN dropped it + news names a fighter -> hide",
     m.decideCancellation(["Umar Nurmagomedov","David Martinez"],cctx({newsFlagged:"David Martinez"})).cancel===true);

  console.log("\n── one signal alone is never enough ──");
  ok("ESPN dropped it, no news -> report only, stays visible",
     m.decideCancellation(["A B","C D"],cctx({})).cancel===false);

  console.log("\n── guard: ESPN serving a half-synced card must not nuke fights ──");
  ok("thin ESPN card (4 bouts) + news -> refuse",
     m.decideCancellation(["A B","C D"],cctx({newsFlagged:"A B",espnBoutCount:4})).cancel===false);
  ok("thin card blocks even a manual override",
     m.decideCancellation(["A B","C D"],cctx({forced:{reason:"scrapped"},espnBoutCount:3})).cancel===false);

  console.log("\n── guard: broken name-matching would look like a mass cancellation ──");
  ok("3rd cancellation on one card -> refuse",
     m.decideCancellation(["A B","C D"],cctx({newsFlagged:"A B",alreadyCancelled:2})).cancel===false);
  ok("2nd is still allowed",
     m.decideCancellation(["A B","C D"],cctx({newsFlagged:"A B",alreadyCancelled:1})).cancel===true);

  console.log("\n── manual override bypasses the news requirement, not the guards ──");
  const f=m.decideCancellation(["A B","C D"],cctx({forced:{reason:"withdrew at weigh-ins"}}));
  ok("forced + healthy card -> hide", f.cancel===true);
  ok("reason is recorded", /withdrew at weigh-ins/.test(f.reason));

  console.log("\n── news index keys line up with bout names ──");
  const idx=m.injuryFlaggedNames({fighters:{
    "david martinez":{name:"David Martinez",hasInjuryNews:true},
    "conor mcgregor":{name:"Conor McGregor",hasInjuryNews:false},
    "khalil rountree":{name:"Khalil Rountree Jr.",hasInjuryNews:true},
    "jan blachowicz":{name:"Jan Błachowicz",hasInjuryNews:true}}});
  ok("flagged fighter present", idx.has(m.normName("David Martinez")));
  ok("unflagged fighter absent", !idx.has(m.normName("Conor McGregor")));
  ok("suffix normalized (Rountree Jr.)", idx.has(m.normName("Khalil Rountree")));
  ok("transliteration holds (Błachowicz)", idx.has(m.normName("Jan Blachowicz")));

  console.log("\n── applyCancellation marks, never deletes ──");
  const b={isCancelled:false,status:"confirmed",fighters:[1,2]};
  m.applyCancellation(b,"because");
  ok("isCancelled set (app's parser skips these)", b.isCancelled===true);
  ok("fighters preserved for audit", b.fighters.length===2);
  ok("reason stored", b.cancellationReason==="because");

  console.log("\n── reconcile hands back the bout object so it can be marked ──");
  const eb=n=>({section:"Prelims",sectionOrder:2,position:1,weightClass:"LW",titleBout:false,rounds:3,fighters:n.map(x=>({name:x,slug:x}))});
  const cb=(...n)=>({isCancelled:false,fighters:n.map(x=>({fighterName:x}))});
  const target=cb("Umar Nurmagomedov","David Martinez");
  const r=m.reconcile({bouts:[target,cb("X Y","Z W")]},[eb(["X Y","Z W"])]);
  ok("one onlyInCito", r.onlyInCito.length===1);
  ok("carries a live object ref", r.onlyInCito[0].bout===target);
  ok("carries names + label", r.onlyInCito[0].label==="Umar Nurmagomedov vs David Martinez");
  ok("already-cancelled bouts not re-reported",
     m.reconcile({bouts:[Object.assign({},target,{isCancelled:true})]},[eb(["X Y","Z W"])]).onlyInCito.length===0);
}

console.log("\n=== same-card opponent swap (cancel must precede the booked check) ===");
{
  const eb=n=>({section:"Main Card",sectionOrder:1,position:1,weightClass:"BW",titleBout:false,rounds:3,fighters:n.map(x=>({name:x,slug:x}))});
  const cb=(...n)=>({isCancelled:false,fighters:n.map(x=>({fighterName:x}))});
  // ESPN rebooks Umar onto the SAME card. The stale Cito bout still names him,
  // so if `booked` were computed before cancelling, the replacement would be
  // skipped as a double-booking AND the stale bout hidden -> fighter erased.
  const espn=[eb(["Umar Nurmagomedov","Song Yadong"]),eb(["A A","B B"]),eb(["C C","D D"]),eb(["E E","F F"]),eb(["G G","H H"]),eb(["I I","J J"])];
  const cito={bouts:[cb("Umar Nurmagomedov","David Martinez"),cb("A A","B B"),cb("C C","D D"),cb("E E","F F"),cb("G G","H H"),cb("I I","J J")]};
  const r=m.reconcile(cito,espn,{newsFlagged:new Set([m.normName("David Martinez")])});
  ok("dead bout cancelled", r.toCancel.length===1 && /Martinez/.test(r.toCancel[0].label));
  ok("replacement still injected (fighter stays on card)", r.toInject.length===1);
  ok("not mistaken for a double-booking", r.skipped.length===0);

  // Without the second signal we cancel nothing, so the replacement is correctly
  // withheld rather than double-booking the fighter.
  const r2=m.reconcile(cito,espn,{newsFlagged:new Set()});
  ok("no news -> nothing hidden", r2.toCancel.length===0);
  ok("no news -> replacement withheld, not double-booked", r2.toInject.length===0 && r2.skipped.length===1);
  ok("stale bout merely reported", r2.onlyInCito.length===1 && /no corroborating news/.test(r2.onlyInCito[0].why));

  // A forced override reaches the same outcome with no news at all.
  const r3=m.reconcile(cito,espn,{forcedFor:(n)=>n.some(x=>/Martinez/.test(x))?{reason:"withdrew"}:null});
  ok("manual override also frees the replacement", r3.toCancel.length===1 && r3.toInject.length===1);
}

console.log('\n' + (fails ? fails + ' TEST(S) FAILED' : 'all tests passed'));
process.exit(fails ? 1 : 0);
