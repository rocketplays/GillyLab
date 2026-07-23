#!/usr/bin/env node
/*
 * fp-vets-ingest.cjs — place the targeted FP veteran-search results.
 *   node scripts/fp-vets-ingest.cjs data/fp-vets.tsv            # dry run
 *   node scripts/fp-vets-ingest.cjs data/fp-vets.tsv --write    # merge + verify
 *
 * Input TSV: <fighter>\t<opponent>\t<videoId>\t<FP title>
 * Places only untaped UFC bouts. Rematches disambiguated by event NUMBER, else by
 * date<->upload-id order (FP uploads chronologically). Anything ambiguous is flagged.
 * Append-only merge + findTapeStudyUrl + zero-loss verify.
 */
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
const tsvPath=process.argv[2];const WRITE=process.argv.includes('--write');
if(!tsvPath){console.error('usage: fp-vets-ingest.cjs <tsv> [--write]');process.exit(1);}
function bal(h,m){const i=h.indexOf(m);let d=0,k=h.indexOf('{',i);for(;k<h.length;k++){if(h[k]=='{')d++;else if(h[k]=='}'){d--;if(!d)break;}}return {s:i,e:k};}
function slice(h,m){const b=bal(h,m);return h.slice(b.s,b.e+1)+';';}
let H=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const ctx={};vm.createContext(ctx);
vm.runInContext('var '+slice(H,'FIGHT_HISTORY = {'),ctx);
vm.runInContext('var '+slice(H,'TAPE_STUDY = {'),ctx);
const FH=ctx.FIGHT_HISTORY,TS=ctx.TAPE_STUDY;
const norm=s=>(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/-/g,' ').replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,' ').trim();
const esc=s=>String(s).replace(/\\/g,'\\\\').replace(/"/g,'\\"');
function eventLabel(r){const name=String(r.event||r.org||'').split(':')[0].trim();const my=/([A-Z][a-z]{2})\s+\d+,\s*(\d{4})/.exec(String(r.date||''));return name+(my?' · '+my[1]+' '+my[2]:'');}
const dnum=s=>{const m=String(s).match(/([A-Z][a-z]{2})\s+\d+,\s*(\d{4})/);const mo={Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12};return m?(+m[2])*100+(mo[m[1]]||0):0;};
const numOf=s=>{const m=String(s).match(/\bUFC\s+(\d{2,4})\b/i);return m?m[1]:null;};

// group candidate cards by fighter->opponent
const raw=fs.readFileSync(path.join(ROOT,tsvPath),'utf8').split('\n').filter(Boolean);
const cand={};
for(const line of raw){const [f,opp,id,title]=line.split('\t');if(!f||!opp||!id)continue;
  const fk=Object.keys(FH).find(k=>norm(k)===norm(f));if(!fk)continue;
  const key=fk+'|'+norm(opp);(cand[key]=cand[key]||{fk,opp,cards:[]});
  if(!cand[key].cards.some(c=>c.id===id.trim()))cand[key].cards.push({id:id.trim(),title,num:numOf(title)});
}
const place={},flags=[];
for(const key in cand){
  const {fk,opp,cards}=cand[key];
  const ts=(TS[fk]||[]).map(x=>norm(x.opponent));
  if(ts.includes(norm(opp)))continue;                       // already taped
  const meetings=FH[fk].filter(b=>b.method!=='Upcoming'&&b.result!=='–'&&norm(b.opponent)===norm(opp)).sort((a,b)=>dnum(a.date)-dnum(b.date));
  if(!meetings.length)continue;
  const cs=cards.slice().sort((a,b)=>+a.id-+b.id);
  const rows=[];const used=new Set();
  if(meetings.length===1){
    // prefer a card whose number matches; else lowest id
    const numbered=cs.filter(c=>c.num&&numOf(meetings[0].event)===c.num);
    const pick=(numbered[0]||cs[0]);
    if(pick)rows.push({m:meetings[0],c:pick});
  } else {
    // rematch: phase 1 number-match
    for(const m of meetings){const mn=numOf(m.event);if(!mn)continue;const c=cs.filter(x=>!used.has(x.id)&&x.num===mn);if(c.length){used.add(c[0].id);rows.push({m,c:c[0]});}}
    // phase 2 unnumbered meetings <- remaining cards by date<->id order
    const unM=meetings.filter(m=>!numOf(m.event)&&!rows.some(r=>r.m===m));
    const unC=cs.filter(x=>!used.has(x.id)).sort((a,b)=>+a.id-+b.id);
    if(unM.length>=1&&unC.length>=unM.length){unM.forEach((m,i)=>{used.add(unC[i].id);rows.push({m,c:unC[i]});});}
    else if(unM.length){flags.push(fk+' vs '+opp+' | meetings '+meetings.length+' cards '+cs.length+' :: '+cs.map(c=>c.id+'='+c.title).join(' ; '));}
  }
  for(const {m,c} of rows)(place[fk]=place[fk]||[]).push({opponent:opp,url:'https://ufcfightpass.com/video/'+c.id,event:eventLabel(m),date:m.date});
}
let n=0;for(const f in place)n+=place[f].length;
fs.writeFileSync(path.join(ROOT,'data','fp-vets-place.json'),JSON.stringify(place,null,1));
fs.writeFileSync(path.join(ROOT,'data','fp-vets-flags.txt'),flags.join('\n')+'\n');
console.log('placed: '+n+' rows across '+Object.keys(place).length+' fighters | flags: '+flags.length);
if(!WRITE){console.log('dry run.');process.exit(0);}
const before={};for(const f in TS)for(const r of TS[f])before[f+'|'+r.opponent+'|'+r.url]=1;
let added=0;
for(const f in place){
  const lits=place[f].map(r=>`{ opponent: "${esc(r.opponent)}", url: "${esc(r.url)}", event: "${esc(r.event)}", section: null }`);
  const b=bal(H,'TAPE_STUDY = {');const ks='"'+f+'": [';let ki=H.indexOf(ks,b.s);
  if(ki!==-1&&ki<b.e){const ins=ki+ks.length;H=H.slice(0,ins)+'\n    '+lits.join(',\n    ')+','+H.slice(ins);}
  else{const ins=H.indexOf('{',b.s)+1;H=H.slice(0,ins)+`\n    "${esc(f)}": [\n    `+lits.join(',\n    ')+`\n  ],`+H.slice(ins);}
  added+=place[f].length;
}
fs.writeFileSync(path.join(ROOT,'index.html'),H);
const c2={};vm.createContext(c2);
vm.runInContext('var '+slice(H,'FIGHT_HISTORY = {'),c2);
vm.runInContext('var '+slice(H,'TAPE_STUDY = {'),c2);
let lost=0;const after={};for(const f in c2.TAPE_STUDY)for(const r of c2.TAPE_STUDY[f])after[f+'|'+r.opponent+'|'+r.url]=1;
for(const k in before)if(!after[k]){lost++;if(lost<=10)console.log('LOST '+k);}
const ni=H.indexOf('function normalizeFighterNameForMatch');vm.runInContext(H.slice(ni,H.indexOf('\n  }',ni)+4),c2);
const fi=H.indexOf('function findTapeStudyUrl');vm.runInContext(H.slice(fi,H.indexOf('\n  }',fi)+4),c2);
let un=0,ck=0;for(const f in place)for(const r of place[f]){ck++;let g=null;try{g=c2.findTapeStudyUrl(f,r.opponent,r.date);}catch(e){g='ERR';}if(g!==r.url){un++;if(un<=15)console.log('UNRESOLVED '+f+' vs '+r.opponent+' want '+r.url+' got '+g);}}
console.log('\nWROTE '+added+' | zero-loss lost: '+lost+' | unresolved: '+un+'/'+ck);
if(lost||un)console.log('!! verify failed — restore from git.');
