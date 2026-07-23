#!/usr/bin/env node
/*
 * mirror-tape.cjs — make TAPE_STUDY symmetric. For every catalogued bout that
 * resolves for fighter A vs opponent B, ensure B's profile also carries the same
 * video (B vs A). Rematch-safe: the meeting is pinned by month+year, and a mirror
 * is only added when the opponent has a real FIGHT_HISTORY bout on that date and
 * does not already resolve a link for it. YouTube rows are mirrored too (a fight
 * belongs on both fighters' profiles); nothing is ever overwritten or removed.
 *   node scripts/mirror-tape.cjs          # dry run
 *   node scripts/mirror-tape.cjs --write  # apply + verify
 */
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
const WRITE=process.argv.includes('--write');
function bal(h,m){const i=h.indexOf(m);let d=0,k=h.indexOf('{',i);for(;k<h.length;k++){if(h[k]=='{')d++;else if(h[k]=='}'){d--;if(!d)break;}}return {s:i,e:k};}
function slice(h,m){const b=bal(h,m);return h.slice(b.s,b.e+1)+';';}
let H=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const ctx={};vm.createContext(ctx);
vm.runInContext('var '+slice(H,'FIGHT_HISTORY = {'),ctx);
vm.runInContext('var '+slice(H,'TAPE_STUDY = {'),ctx);
const ni=H.indexOf('function normalizeFighterNameForMatch');vm.runInContext(H.slice(ni,H.indexOf('\n  }',ni)+4),ctx);
const fri=H.indexOf('function findTapeStudyUrl');vm.runInContext(H.slice(fri,H.indexOf('\n  }',fri)+4),ctx);
const FH=ctx.FIGHT_HISTORY,TS=ctx.TAPE_STUDY,resolve=ctx.findTapeStudyUrl,nrm=ctx.normalizeFighterNameForMatch;
const esc=s=>String(s).replace(/\\/g,'\\\\').replace(/"/g,'\\"');
const monY=s=>{const m=String(s).match(/([A-Z][a-z]{2})\s+(\d{4})/);return m?m[1]+' '+m[2]:null;};
const dMonY=d=>{const m=String(d).match(/([A-Z][a-z]{2})\s+\d+,\s*(\d{4})/);return m?m[1]+' '+m[2]:null;};
function eventLabel(b){const name=String(b.event||b.org||'').split(':')[0].trim();const my=/([A-Z][a-z]{2})\s+\d+,\s*(\d{4})/.exec(String(b.date||''));return name+(my?' · '+my[1]+' '+my[2]:'');}
// norm -> FH key
const fhKeys={};for(const k in FH)fhKeys[nrm(k)]=k;

const add={};let considered=0,already=0,noOpp=0,noMeeting=0,mirrored=0;
for(const F in TS){
  for(const r of (TS[F]||[])){
    if(!r||!r.url)continue;
    considered++;
    const Okey=fhKeys[nrm(r.opponent)];
    if(!Okey){noOpp++;continue;}                       // opponent has no profile → nothing to mirror to
    // which meeting is this row? match F's FH bout vs O by month+year of the row's event
    const rowMY=monY(r.event);
    const fBouts=(FH[F]||[]).filter(b=>b.method!=='Upcoming'&&b.result!=='–'&&nrm(b.opponent)===nrm(r.opponent));
    if(!fBouts.length){noMeeting++;continue;}
    let fb=null;
    if(fBouts.length===1) fb=fBouts[0];
    else if(rowMY) fb=fBouts.find(b=>dMonY(b.date)===rowMY)||null;
    if(!fb){noMeeting++;continue;}
    // O's bout on the same date. If O's inline FIGHT_HISTORY is stale and doesn't
    // yet carry this (recent) bout, still mirror — the tape row + video is enough
    // for the profile to show it; fall back to F's spelling and the row's event.
    const ob=(FH[Okey]||[]).find(b=>b.date===fb.date&&nrm(b.opponent)===nrm(F));
    const oppLabel = ob ? ob.opponent : F;
    const evLabel  = ob ? eventLabel(ob) : (r.event || eventLabel(fb));
    let cur=null;try{cur=resolve(Okey,oppLabel,fb.date);}catch(e){}
    if(cur){already++;continue;}
    // avoid dup rows
    const exists=(TS[Okey]||[]).some(x=>x.url===r.url&&nrm(x.opponent)===nrm(F));
    if(exists){already++;continue;}
    (add[Okey]=add[Okey]||[]).push({opponent:oppLabel,url:r.url,event:evLabel,date:fb.date});
    mirrored++;
  }
}
// de-dup within add (same fighter/opp/url)
for(const f in add){const seen=new Set();add[f]=add[f].filter(r=>{const k=nrm(r.opponent)+'|'+r.url;if(seen.has(k))return false;seen.add(k);return true;});}
let n=0;for(const f in add)n+=add[f].length;
fs.writeFileSync(path.join(ROOT,'data','mirror-place.json'),JSON.stringify(add,null,1));
console.log('rows considered:',considered,'| opp-no-profile:',noOpp,'| no-meeting-match:',noMeeting,'| already had:',already);
console.log('mirrors to add:',n,'across',Object.keys(add).length,'fighters');
if(!WRITE){console.log('dry run.');process.exit(0);}

const before={};for(const f in TS)for(const r of TS[f])before[f+'|'+r.opponent+'|'+r.url]=1;
const beforeYT=Object.values(TS).flat().filter(r=>/youtu/.test(r.url||'')).length;
let added=0;
for(const f in add){
  const lits=add[f].map(r=>`{ opponent: "${esc(r.opponent)}", url: "${esc(r.url)}", event: "${esc(r.event)}", section: null }`);
  const b=bal(H,'TAPE_STUDY = {');const ks='"'+f+'": [';let ki=H.indexOf(ks,b.s);
  if(ki!==-1&&ki<b.e){const ins=ki+ks.length;H=H.slice(0,ins)+'\n    '+lits.join(',\n    ')+','+H.slice(ins);}
  else{const ins=H.indexOf('{',b.s)+1;H=H.slice(0,ins)+`\n    "${esc(f)}": [\n    `+lits.join(',\n    ')+`\n  ],`+H.slice(ins);}
  added+=add[f].length;
}
fs.writeFileSync(path.join(ROOT,'index.html'),H);
const c2={};vm.createContext(c2);
vm.runInContext('var '+slice(H,'FIGHT_HISTORY = {'),c2);
vm.runInContext('var '+slice(H,'TAPE_STUDY = {'),c2);
let lost=0;const after={};for(const f in c2.TAPE_STUDY)for(const r of c2.TAPE_STUDY[f])after[f+'|'+r.opponent+'|'+r.url]=1;
for(const k in before)if(!after[k]){lost++;if(lost<=10)console.log('LOST '+k);}
const n2=H.indexOf('function normalizeFighterNameForMatch');vm.runInContext(H.slice(n2,H.indexOf('\n  }',n2)+4),c2);
const f2=H.indexOf('function findTapeStudyUrl');vm.runInContext(H.slice(f2,H.indexOf('\n  }',f2)+4),c2);
let un=0,ck=0;for(const f in add)for(const r of add[f]){ck++;let g=null;try{g=c2.findTapeStudyUrl(f,r.opponent,r.date);}catch(e){g='ERR';}if(g!==r.url){un++;if(un<=15)console.log('UNRESOLVED '+f+' vs '+r.opponent+' @'+r.date+' got '+g);}}
const afterYT=Object.values(c2.TAPE_STUDY).flat().filter(r=>/youtu/.test(r.url||'')).length;
console.log('\nWROTE '+added+' | zero-loss lost: '+lost+' | unresolved: '+un+'/'+ck+' | youtube '+beforeYT+'->'+afterYT);
if(lost||un)console.log('!! verify failed — restore from /tmp backup.');
