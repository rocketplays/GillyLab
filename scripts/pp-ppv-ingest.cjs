#!/usr/bin/env node
/*
 * pp-ppv-ingest.cjs — place Paramount+ per-fight VOD links for numbered UFC PPV gaps.
 * Input TSV: <fighter>\t<opponent>\t<paramount_content_id>\t<ufc_number>
 * Match is by exact UFC number + opponent, and only fills meetings that don't already
 * resolve through findTapeStudyUrl. URL = https://www.paramountplus.com/shows/video/<id>/
 *   node scripts/pp-ppv-ingest.cjs data/pp-ppv.tsv          # dry run
 *   node scripts/pp-ppv-ingest.cjs data/pp-ppv.tsv --write  # merge + verify
 */
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
const tsvPath=process.argv[2];const WRITE=process.argv.includes('--write');
if(!tsvPath){console.error('usage: pp-ppv-ingest.cjs <tsv> [--write]');process.exit(1);}
function bal(h,m){const i=h.indexOf(m);let d=0,k=h.indexOf('{',i);for(;k<h.length;k++){if(h[k]=='{')d++;else if(h[k]=='}'){d--;if(!d)break;}}return {s:i,e:k};}
function slice(h,m){const b=bal(h,m);return h.slice(b.s,b.e+1)+';';}
let H=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const ctx={};vm.createContext(ctx);
vm.runInContext('var '+slice(H,'FIGHT_HISTORY = {'),ctx);
vm.runInContext('var '+slice(H,'TAPE_STUDY = {'),ctx);
const ni=H.indexOf('function normalizeFighterNameForMatch');vm.runInContext(H.slice(ni,H.indexOf('\n  }',ni)+4),ctx);
const fri=H.indexOf('function findTapeStudyUrl');vm.runInContext(H.slice(fri,H.indexOf('\n  }',fri)+4),ctx);
const FH=ctx.FIGHT_HISTORY,TS=ctx.TAPE_STUDY,resolve=ctx.findTapeStudyUrl;
const norm=s=>(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/-/g,' ').replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,' ').trim();
const esc=s=>String(s).replace(/\\/g,'\\\\').replace(/"/g,'\\"');
const numOf=s=>{const m=String(s).match(/\bUFC\s+(\d{2,4})\b/i);return m?m[1]:null;};
function eventLabel(r){const name=String(r.event||r.org||'').split(':')[0].trim();const my=/([A-Z][a-z]{2})\s+\d+,\s*(\d{4})/.exec(String(r.date||''));return name+(my?' · '+my[1]+' '+my[2]:'');}

const raw=fs.readFileSync(path.join(ROOT,tsvPath),'utf8').split('\n').filter(Boolean);
const place={},flags=[];
for(const line of raw){
  const [f,opp,id,num]=line.split('\t');
  if(!f||!opp||!id||!num)continue;
  const fk=Object.keys(FH).find(k=>norm(k)===norm(f));
  if(!fk){flags.push('NO FIGHTER: '+f);continue;}
  const meetings=FH[fk].filter(b=>b.method!=='Upcoming'&&b.result!=='–'&&norm(b.opponent)===norm(opp)&&numOf(b.event)===String(num));
  if(!meetings.length){flags.push('NO MEETING: '+f+' vs '+opp+' UFC '+num);continue;}
  const unfilled=meetings.filter(m=>!resolve(fk,opp,m.date));
  if(!unfilled.length)continue; // already covered
  const m=unfilled[0];
  const url='https://www.paramountplus.com/shows/video/'+id.trim()+'/';
  (place[fk]=place[fk]||[]).push({opponent:opp,url,event:eventLabel(m),date:m.date});
}
let n=0;for(const f in place)n+=place[f].length;
fs.writeFileSync(path.join(ROOT,'data','pp-ppv-place.json'),JSON.stringify(place,null,1));
fs.writeFileSync(path.join(ROOT,'data','pp-ppv-flags.txt'),flags.join('\n')+'\n');
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
const n2=H.indexOf('function normalizeFighterNameForMatch');vm.runInContext(H.slice(n2,H.indexOf('\n  }',n2)+4),c2);
const f2=H.indexOf('function findTapeStudyUrl');vm.runInContext(H.slice(f2,H.indexOf('\n  }',f2)+4),c2);
let un=0,ck=0;for(const f in place)for(const r of place[f]){ck++;let g=null;try{g=c2.findTapeStudyUrl(f,r.opponent,r.date);}catch(e){g='ERR';}if(g!==r.url){un++;if(un<=15)console.log('UNRESOLVED '+f+' vs '+r.opponent+' @'+r.date+' want '+r.url+' got '+g);}}
console.log('\nWROTE '+added+' | zero-loss lost: '+lost+' | unresolved: '+un+'/'+ck);
if(lost||un)console.log('!! verify failed — restore from /tmp backup.');
