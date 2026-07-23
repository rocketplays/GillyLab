#!/usr/bin/env node
/*
 * fix-tape.cjs — two safety-net passes over TAPE_STUDY:
 *  (1) DEDUP: within a fighter, collapse rows that point at the same meeting
 *      (same normalized opponent + same month/year), keeping a Paramount+ link
 *      over others. Fixes accent/duplicate rows (e.g. "Michał" + "Michal").
 *  (2) DATE-AWARE MIRROR: ensure both fighters in a bout carry the video, pairing
 *      by fight DATE when the two records spell each other differently
 *      (e.g. McKinney's "King Green" == "Bobby Green").
 * Nothing is removed except exact same-meeting duplicates; no link is invented.
 *   node scripts/fix-tape.cjs          # dry run
 *   node scripts/fix-tape.cjs --write  # apply + verify
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
const fhKeys={};for(const k in FH)fhKeys[nrm(k)]=k;
// date -> [{key, nopp}]
const dateIdx={};
for(const F in FH)for(const b of FH[F]){if(!b.date)continue;(dateIdx[b.date]=dateIdx[b.date]||[]).push({key:F,nopp:nrm(b.opponent)});}

// ---------- pass 1: dedup ----------
let removed=0;const dedupFighters={};
for(const F in TS){
  const seen={};const keep=[];const seenUrl={};
  for(const r of TS[F]){
    // same video already kept under this fighter = same fight, always a dup
    if(r.url && seenUrl[r.url]!==undefined){removed++;dedupFighters[F]=1;continue;}
    const my=monY(r.event)||'';
    const key=nrm(r.opponent)+'|'+my;
    if(!(key in seen)){seen[key]=keep.length;if(r.url)seenUrl[r.url]=keep.length;keep.push(r);continue;}
    // duplicate meeting — prefer a paramount link
    const idx=seen[key];const cur=keep[idx];
    const better=/paramountplus/.test(r.url||'')&&!/paramountplus/.test(cur.url||'');
    if(better)keep[idx]=r;
    removed++;dedupFighters[F]=1;
  }
  if(keep.length!==TS[F].length)TS[F]=keep;
}

// ---------- pass 2: date-aware mirror ----------
const add={};let mirrored=0,noPair=0;
for(const F in TS){
  for(const r of (TS[F]||[])){
    if(!r||!r.url)continue;
    // F's FH bout for this row (by month/year)
    const rowMY=monY(r.event);
    const fBouts=(FH[F]||[]).filter(b=>nrm(b.opponent)===nrm(r.opponent));
    let fb=null;
    if(fBouts.length===1)fb=fBouts[0];
    else if(rowMY)fb=fBouts.find(b=>dMonY(b.date)===rowMY)||null;
    if(!fb)continue;
    // opponent profile: try name, else pair by date + reverse opponent
    let Okey=fhKeys[nrm(r.opponent)];
    if(!Okey){
      const cand=(dateIdx[fb.date]||[]).find(e=>e.nopp===nrm(F)&&e.key!==F);
      if(cand)Okey=cand.key;
    }
    if(!Okey){noPair++;continue;}
    const ob=(FH[Okey]||[]).find(b=>b.date===fb.date&&nrm(b.opponent)===nrm(F));
    const oppLabel=ob?ob.opponent:F;
    const evLabel=ob?eventLabel(ob):(r.event||eventLabel(fb));
    let cur=null;try{cur=resolve(Okey,oppLabel,fb.date);}catch(e){}
    if(cur)continue;
    // already has this exact video (possibly under a different name spelling) → skip
    const exists=(TS[Okey]||[]).some(x=>x.url===r.url);
    if(exists)continue;
    (add[Okey]=add[Okey]||[]).push({opponent:oppLabel,url:r.url,event:evLabel,date:fb.date});
    mirrored++;
  }
}
for(const f in add){const s=new Set();add[f]=add[f].filter(r=>{const k=nrm(r.opponent)+'|'+r.url;if(s.has(k))return false;s.add(k);return true;});}
let nAdd=0;for(const f in add)nAdd+=add[f].length;
console.log('dedup: removed '+removed+' duplicate rows across '+Object.keys(dedupFighters).length+' fighters');
console.log('date-aware mirror: '+nAdd+' to add across '+Object.keys(add).length+' fighters (unpaired '+noPair+')');
if(!WRITE){console.log('dry run.');process.exit(0);}

// rebuild TAPE_STUDY block from the (deduped) in-memory TS + additions
for(const f in add){TS[f]=(TS[f]||[]).concat(add[f]);}
const before={};for(const f in ctx.TAPE_STUDY)for(const r of ctx.TAPE_STUDY[f])before[f+'|'+r.opponent+'|'+r.url]=1;
// serialize
let body='';const keys=Object.keys(TS);
keys.forEach((f,fi)=>{
  body+='  "'+esc(f)+'": [\n';
  TS[f].forEach((r,ri)=>{body+='    { opponent: "'+esc(r.opponent)+'", url: "'+esc(r.url)+'", event: "'+esc(r.event)+'", section: '+(r.section?('"'+esc(r.section)+'"'):'null')+' }'+(ri<TS[f].length-1?',':'')+'\n';});
  body+='  ]'+(fi<keys.length-1?',':'')+'\n';
});
const b=bal(H,'TAPE_STUDY = {');
H=H.slice(0,b.s)+'TAPE_STUDY = {\n'+body+'}'+H.slice(b.e+1);
fs.writeFileSync(path.join(ROOT,'index.html'),H);
// verify
const c2={};vm.createContext(c2);
vm.runInContext('var '+slice(H,'FIGHT_HISTORY = {'),c2);
vm.runInContext('var '+slice(H,'TAPE_STUDY = {'),c2);
const n2=H.indexOf('function normalizeFighterNameForMatch');vm.runInContext(H.slice(n2,H.indexOf('\n  }',n2)+4),c2);
const f2=H.indexOf('function findTapeStudyUrl');vm.runInContext(H.slice(f2,H.indexOf('\n  }',f2)+4),c2);
let un=0,ck=0;for(const f in add)for(const r of add[f]){ck++;let g=null;try{g=c2.findTapeStudyUrl(f,r.opponent,r.date);}catch(e){g='ERR';}if(g!==r.url){un++;if(un<=15)console.log('UNRESOLVED '+f+' vs '+r.opponent+' got '+g);}}
let rows=0,yt=0;for(const f in c2.TAPE_STUDY)for(const r of c2.TAPE_STUDY[f]){rows++;if(/youtu/.test(r.url||''))yt++;}
console.log('WROTE — rows now '+rows+' | youtube '+yt+' | mirror unresolved '+un+'/'+ck);
