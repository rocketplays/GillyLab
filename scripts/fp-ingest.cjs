#!/usr/bin/env node
/*
 * fp-ingest.cjs — take the browser sweep's fp-results.json and place the links.
 *
 *   node scripts/fp-ingest.cjs data/fp-results.json            # dry run: report only
 *   node scripts/fp-ingest.cjs data/fp-results.json --write    # actually merge into index.html
 *
 * fp-results.json is { "Fighter": ["<videoId> | <FP bout title>", ...], ... }.
 * Matching mirrors the proven pipeline exactly:
 *   - subject fighter matched by EXACT surname token + first-name (prefix ok)
 *   - opponent must be on the OTHER side of " vs "  (kills Perez/Pereira collisions)
 *   - only opponents with NO existing tape row are added (never overwrites YouTube)
 *   - single-meeting matches auto-place; REMATCHES are flagged for review, never guessed
 * After --write: appends rows without touching any existing byte, then verifies every
 * new row resolves through findTapeStudyUrl AND that zero pre-existing rows were lost.
 */
const fs=require('fs'), vm=require('vm'), path=require('path');
const ROOT=path.join(__dirname,'..');
const resultsPath=process.argv[2];
const WRITE=process.argv.includes('--write');
if(!resultsPath){console.error('usage: fp-ingest.cjs <fp-results.json> [--write]');process.exit(1);}
function bal(h,m){const i=h.indexOf(m);let d=0,k=h.indexOf('{',i);for(;k<h.length;k++){if(h[k]=='{')d++;else if(h[k]=='}'){d--;if(!d)break;}}return {s:i,e:k};}
function slice(h,m){const b=bal(h,m);return h.slice(b.s,b.e+1)+';';}
let H=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const ctx={};vm.createContext(ctx);
vm.runInContext('var '+slice(H,'FIGHT_HISTORY = {'),ctx);
vm.runInContext('var '+slice(H,'TAPE_STUDY = {'),ctx);
const FH=ctx.FIGHT_HISTORY,TS=ctx.TAPE_STUDY;
const cards=JSON.parse(fs.readFileSync(resultsPath,'utf8'));
const norm=s=>(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/-/g,' ').replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,' ').trim();
const toks=s=>norm(s).split(' ').filter(Boolean);
function sideHas(side,name){const st=toks(side),nt=toks(name);if(!nt.length)return false;const sur=nt[nt.length-1],fir=nt[0];if(!st.includes(sur))return false;if(nt.length===1)return true;return st.some(t=>t===fir||(fir.length>=4&&t.startsWith(fir.slice(0,4)))||(t.length>=4&&fir.startsWith(t.slice(0,4))));}
function splitVs(t){const i=t.toLowerCase().indexOf(' vs ');return i<0?null:[t.slice(0,i),t.slice(i+4)];}
function eventLabel(r){const name=String(r.event||r.org||'').split(':')[0].trim();const my=/([A-Z][a-z]{2})\s+\d+,\s*(\d{4})/.exec(String(r.date||''));return name+(my?' · '+my[1]+' '+my[2]:'');}
const esc=s=>String(s).replace(/\\/g,'\\\\').replace(/"/g,'\\"');

const place={},flags=[];
for(const rkey in cards){
  const fk=Object.keys(FH).find(k=>norm(k)===norm(rkey));
  if(!fk){continue;}
  const ts=(TS[fk]||[]).map(x=>norm(x.opponent));
  const bouts=FH[fk].filter(f=>f.method!=='Upcoming'&&f.result!=='–');
  // untaped opponents
  const byOpp={};
  for(const b of bouts){if(ts.includes(norm(b.opponent)))continue;(byOpp[norm(b.opponent)]=byOpp[norm(b.opponent)]||[]).push(b);}
  const rows=[];
  for(const key in byOpp){
    const meetings=byOpp[key],opp=meetings[0].opponent;
    // candidate cards for (fk, opp): fighter one side, opp the OTHER
    const cand=[];
    for(const line of cards[rkey]){const [id,...t]=line.split(' | ');const title=t.join(' | ');const sp=splitVs(title);if(!sp)continue;
      const [a,b]=sp;const fA=sideHas(a,fk),fB=sideHas(b,fk);if(fA===fB)continue;const opS=fA?b:a,fS=fA?a:b;
      if(sideHas(opS,opp)&&!sideHas(fS,opp))cand.push({id:id.trim(),title});
    }
    if(!cand.length)continue;
    if(meetings.length===1&&cand.length===1){
      rows.push({opponent:opp,url:'https://ufcfightpass.com/video/'+cand[0].id,event:eventLabel(meetings[0]),date:meetings[0].date});
    } else {
      // rematch or ambiguous: try clean 1:1 by event NUMBER token, else flag
      const used=new Set();let ok=meetings.length>1;const asg=[];
      if(ok)for(const m of meetings){const nums=(String(m.event).match(/\d{2,4}/g)||[]);const c=cand.filter(x=>!used.has(x.id)&&nums.some(n=>x.title.includes(n)));if(c.length!==1){ok=false;break;}used.add(c[0].id);asg.push([m,c[0]]);}
      if(ok&&asg.length===meetings.length){for(const[m,c]of asg)rows.push({opponent:opp,url:'https://ufcfightpass.com/video/'+c.id,event:eventLabel(m),date:m.date});}
      else flags.push(fk+' vs '+opp+' | meetings: '+meetings.map(m=>m.event+' '+m.date).join(' ; ')+' | cards: '+cand.map(c=>c.id+'='+c.title).join(' ; '));
    }
  }
  if(rows.length)place[fk]=rows;
}
let n=0;for(const f in place)n+=place[f].length;
console.log('auto-place: '+n+' rows across '+Object.keys(place).length+' fighters | rematch/ambiguous flags: '+flags.length);
fs.writeFileSync(path.join(ROOT,'data','fp-ingest-flags.txt'),flags.join('\n')+'\n');
fs.writeFileSync(path.join(ROOT,'data','fp-ingest-place.json'),JSON.stringify(place,null,1));
if(flags.length)console.log('flags -> data/fp-ingest-flags.txt (resolve by hand, add to place json, re-run with --write)');
if(!WRITE){console.log('dry run — re-run with --write to merge.');process.exit(0);}

// ---- merge (append only) ----
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
// ---- verify ----
const c2={};vm.createContext(c2);
vm.runInContext('var '+slice(H,'FIGHT_HISTORY = {'),c2);
vm.runInContext('var '+slice(H,'TAPE_STUDY = {'),c2);
let lost=0;const after={};for(const f in c2.TAPE_STUDY)for(const r of c2.TAPE_STUDY[f])after[f+'|'+r.opponent+'|'+r.url]=1;
for(const k in before)if(!after[k]){lost++;if(lost<=10)console.log('LOST '+k);}
const ni=H.indexOf('function normalizeFighterNameForMatch');vm.runInContext(H.slice(ni,H.indexOf('\n  }',ni)+4),c2);
const fi=H.indexOf('function findTapeStudyUrl');vm.runInContext(H.slice(fi,H.indexOf('\n  }',fi)+4),c2);
let un=0,ck=0;for(const f in place)for(const r of place[f]){ck++;let g=null;try{g=c2.findTapeStudyUrl(f,r.opponent,r.date);}catch(e){g='ERR';}if(g!==r.url){un++;if(un<=15)console.log('UNRESOLVED '+f+' vs '+r.opponent+' want '+r.url+' got '+g);}}
console.log('\nWROTE '+added+' rows | zero-loss lost: '+lost+' | unresolved: '+un+'/'+ck);
if(lost||un)console.log('!! verification failed — restore index.html from backup/git and investigate.');
