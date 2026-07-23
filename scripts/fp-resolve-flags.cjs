#!/usr/bin/env node
/* Audit the auto-placed rows and auto-resolve resolvable rematches.
 *   node scripts/fp-resolve-flags.cjs data/fp-results.json
 * Writes resolved rematch rows into data/fp-ingest-place.json (merged with the
 * single-meeting rows already there) and reports:
 *   - SUSPECT: any placed row whose source FP title doesn't contain both surnames
 *   - resolved rematches (card mapped to a meeting by event number)
 *   - residual: rematches that still need a human (no clean number match)
 */
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
const resultsPath=process.argv[2]||path.join(ROOT,'data/fp-results.json');
function bal(h,m){const i=h.indexOf(m);let d=0,k=h.indexOf('{',i);for(;k<h.length;k++){if(h[k]=='{')d++;else if(h[k]=='}'){d--;if(!d)break;}}return h.slice(i,k+1)+';';}
const H=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');const ctx={};vm.createContext(ctx);
vm.runInContext('var '+bal(H,'FIGHT_HISTORY = {'),ctx);vm.runInContext('var '+bal(H,'TAPE_STUDY = {'),ctx);
const FH=ctx.FIGHT_HISTORY,TS=ctx.TAPE_STUDY;
const cards=JSON.parse(fs.readFileSync(resultsPath,'utf8'));
const place=JSON.parse(fs.readFileSync(path.join(ROOT,'data/fp-ingest-place.json'),'utf8'));
const norm=s=>(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/-/g,' ').replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,' ').trim();
const sur=n=>{const t=norm(n).split(' ');return t[t.length-1];};
const toks=s=>norm(s).split(' ').filter(Boolean);
function sideHas(side,name){const st=toks(side),nt=toks(name);if(!nt.length)return false;const s=nt[nt.length-1],f=nt[0];if(!st.includes(s))return false;if(nt.length===1)return true;return st.some(t=>t===f||(f.length>=4&&t.startsWith(f.slice(0,4)))||(t.length>=4&&f.startsWith(t.slice(0,4))));}
function splitVs(t){const i=t.toLowerCase().indexOf(' vs ');return i<0?null:[t.slice(0,i),t.slice(i+4)];}
function eventLabel(r){const name=String(r.event||r.org||'').split(':')[0].trim();const my=/([A-Z][a-z]{2})\s+\d+,\s*(\d{4})/.exec(String(r.date||''));return name+(my?' · '+my[1]+' '+my[2]:'');}
const BAD=/rewind|fights of|countdown|embedded|best of|top \d|recap|mini|faceoff|weigh|preview|prelims|snoopcast|free fight|no\. ?\d/i;

// --- title map: id -> title (from sweep) ---
const idTitle={};for(const f in cards)for(const line of cards[f]){const [id,...t]=line.split(' | ');idTitle[id.trim()]=t.join(' | ');}

// --- AUDIT the single-meeting auto-place rows ---
let suspects=0,audited=0;
for(const f in place)for(const r of place[f]){audited++;const id=r.url.split('/video/')[1];const t=idTitle[id]||'';
  if(!(norm(t).includes(sur(f))&&norm(t).includes(sur(r.opponent)))){suspects++;if(suspects<=20)console.log('SUSPECT '+f+' vs '+r.opponent+' id '+id+' title="'+t+'"');}}
console.log('AUDIT: '+audited+' placed rows, '+suspects+' suspect.');

// --- resolve rematches ---
let resolved=0,residual=[];
for(const rkey in cards){
  const fk=Object.keys(FH).find(k=>norm(k)===norm(rkey));if(!fk)continue;
  const ts=(TS[fk]||[]).map(x=>norm(x.opponent));
  const already=new Set((place[fk]||[]).map(r=>norm(r.opponent)));
  // group cards by opponent for this fighter
  const byOpp={};
  for(const line of cards[rkey]){const [id,...t]=line.split(' | ');const title=t.join(' | ');if(BAD.test(title))continue;const sp=splitVs(title);if(!sp)continue;
    const [a,b]=sp;const fA=sideHas(a,fk),fB=sideHas(b,fk);if(fA===fB)continue;const opS=fA?b:a,fS=fA?a:b;
    // which untaped opponent is on the other side?
    for(const bt of FH[fk]){if(bt.method==='Upcoming'||bt.result==='–')continue;const o=bt.opponent;if(ts.includes(norm(o)))continue;
      if(sideHas(opS,o)&&!sideHas(fS,o)){(byOpp[norm(o)]=byOpp[norm(o)]||{opp:o,cards:[]});if(!byOpp[norm(o)].cards.some(c=>c.id===id.trim()))byOpp[norm(o)].cards.push({id:id.trim(),title});break;}
    }
  }
  for(const k in byOpp){
    if(already.has(k))continue;                       // single-meeting already placed
    const {opp,cards:cds}=byOpp[k];
    const meetings=FH[fk].filter(b=>b.method!=='Upcoming'&&b.result!=='–'&&norm(b.opponent)===norm(opp));
    if(meetings.length<=1){continue;}                 // handled by ingest (or 0)
    // map each card to a meeting by event NUMBER token; require uniqueness
    const used=new Set(),rows=[];let leftover=false;
    for(const m of meetings){
      const nums=(String(m.event).match(/\d{2,4}/g)||[]);
      const c=cds.filter(x=>!used.has(x.id)&&nums.length&&nums.some(n=>x.title.includes(n)));
      if(c.length===1){used.add(c[0].id);rows.push({opponent:opp,url:'https://ufcfightpass.com/video/'+c[0].id,event:eventLabel(m),date:m.date});}
    }
    if(rows.length){place[fk]=place[fk]||[];for(const r of rows)place[fk].push(r);resolved+=rows.length;}
    if(cds.length>rows.length)residual.push(fk+' vs '+opp+' (placed '+rows.length+'/'+cds.length+' cards, '+meetings.length+' meetings)');
  }
}
fs.writeFileSync(path.join(ROOT,'data/fp-ingest-place.json'),JSON.stringify(place,null,1));
fs.writeFileSync(path.join(ROOT,'data/fp-resolve-residual.txt'),residual.join('\n')+'\n');
let n=0;for(const f in place)n+=place[f].length;
console.log('resolved rematch rows added: '+resolved+' | residual (needs human): '+residual.length);
console.log('TOTAL place rows now: '+n+' (across '+Object.keys(place).length+' fighters)');
