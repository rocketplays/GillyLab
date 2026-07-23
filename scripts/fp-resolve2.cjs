#!/usr/bin/env node
/* Residual rematch resolver, v3 — with an EVENT-compatibility gate so a card's event
 * must actually match the meeting, not just the two fighter names.
 *
 * Gate:
 *   - card must be a UFC-family event (reject Karate Combat / KOTC / Pride / WEC / etc.
 *     even when both fighter names match)
 *   - UFC event NUMBER must agree: a numbered card ("UFC 190") only lands on a meeting
 *     whose event carries that number; an unnumbered card ("UFC Fight Night") only lands
 *     on an unnumbered UFC meeting
 * Placement:
 *   Phase 1 (numbered meetings): match card number -> meeting number
 *   Phase 2 (unnumbered UFC meetings): pair oldest fight <-> lowest video id (FP uploads
 *     chronologically) only when the unused-card count equals the meeting count, or a lone
 *     meeting takes the lowest-id card
 * Everything else is left for a human. Writes data/fp-resid-place.json + fp-resid-manual.txt.
 */
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
function bal(h,m){const i=h.indexOf(m);let d=0,k=h.indexOf('{',i);for(;k<h.length;k++){if(h[k]=='{')d++;else if(h[k]=='}'){d--;if(!d)break;}}return h.slice(i,k+1)+';';}
const H=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');const ctx={};vm.createContext(ctx);
vm.runInContext('var '+bal(H,'FIGHT_HISTORY = {'),ctx);vm.runInContext('var '+bal(H,'TAPE_STUDY = {'),ctx);
const FH=ctx.FIGHT_HISTORY,TS=ctx.TAPE_STUDY;
const cards=JSON.parse(fs.readFileSync(path.join(ROOT,'data/fp-results.json'),'utf8'));
const norm=s=>(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/-/g,' ').replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,' ').trim();
const toks=s=>norm(s).split(' ').filter(Boolean);
function sideHas(side,name){const st=toks(side),nt=toks(name);if(!nt.length)return false;const s=nt[nt.length-1],f=nt[0];if(!st.includes(s))return false;if(nt.length===1)return true;return st.some(t=>t===f||(f.length>=4&&t.startsWith(f.slice(0,4)))||(t.length>=4&&f.startsWith(t.slice(0,4))));}
function splitVs(t){const i=t.toLowerCase().indexOf(' vs ');return i<0?null:[t.slice(0,i),t.slice(i+4)];}
function eventLabel(r){const name=String(r.event||r.org||'').split(':')[0].trim();const my=/([A-Z][a-z]{2})\s+\d+,\s*(\d{4})/.exec(String(r.date||''));return name+(my?' · '+my[1]+' '+my[2]:'');}
const yr=s=>{const m=String(s).match(/(20\d\d|19\d\d)/);return m?+m[1]:0;};
const isUFC=f=>(f.org==='UFC'||f.org==='DWCS'||/\bUFC\b|DWCS|Contender Series|Ultimate Fighter|\bTUF\b|Road to UFC/i.test(f.event||''))&&!/Full Contact Contender/i.test(f.event||'');
const fpEra=m=>isUFC(m)&&yr(m.date)<2025;
const BAD=/rewind|fights of|countdown|embedded|best of|top \d|recap|mini|faceoff|weigh|preview|prelims|snoopcast|free fight|no\. ?\d/i;
const UFCFAM=/\bUFC\b|Noche UFC|Road to UFC|Ultimate Fighter|\bTUF\b|Contender Series|DWCS/i;
const FOREIGN=/karate combat|king of the cage|\bkotc\b|\bpride\b|bellator|strikeforce|\bwec\b|rizin|one championship|one fc|\bpfl\b|invicta|cage warrior|\bm ?1\b|shooto|pancrase|\bdream\b|affliction|elite ?xc/i;
const ufcCard=t=>UFCFAM.test(t)&&!FOREIGN.test(t);
const numOf=s=>{const m=String(s).match(/\bUFC\s+(\d{2,4})\b/i);return m?m[1]:null;};   // UFC event number only
const dnum=s=>{const m=String(s).match(/([A-Z][a-z]{2})\s+\d+,\s*(\d{4})/);const mo={Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12};return m?(+m[2])*100+(mo[m[1]]||0):0;};

const place={},manual=[];
for(const rkey in cards){
  const fk=Object.keys(FH).find(k=>norm(k)===norm(rkey));if(!fk)continue;
  const ts=(TS[fk]||[]).map(x=>norm(x.opponent));
  const byOpp={};
  for(const line of cards[rkey]){const [id,...t]=line.split(' | ');const title=t.join(' | ');if(BAD.test(title))continue;if(!ufcCard(title))continue;const sp=splitVs(title);if(!sp)continue;
    const [a,b]=sp;const fA=sideHas(a,fk),fB=sideHas(b,fk);if(fA===fB)continue;const opS=fA?b:a,fS=fA?a:b;
    for(const bt of FH[fk]){if(bt.method==='Upcoming'||bt.result==='–')continue;const o=bt.opponent;if(ts.includes(norm(o)))continue;
      if(sideHas(opS,o)&&!sideHas(fS,o)){(byOpp[norm(o)]=byOpp[norm(o)]||{opp:o,cards:[]});if(!byOpp[norm(o)].cards.some(c=>c.id===+id.trim()))byOpp[norm(o)].cards.push({id:+id.trim(),title,num:numOf(title)});break;}
    }
  }
  for(const k in byOpp){
    const {opp,cards:cds}=byOpp[k];
    const meetings=FH[fk].filter(b=>b.method!=='Upcoming'&&b.result!=='–'&&norm(b.opponent)===norm(opp));
    if(meetings.length<=1)continue;                       // single-meeting handled by ingest
    const fpM=meetings.filter(fpEra).sort((a,b)=>dnum(a.date)-dnum(b.date));
    const used=new Set(),rows=[];
    // Phase 1: numbered meetings <- numbered cards
    for(const m of fpM){const mn=numOf(m.event);if(!mn)continue;
      const c=cds.filter(x=>!used.has(x.id)&&x.num===mn).sort((a,b)=>a.id-b.id);
      if(c.length){used.add(c[0].id);rows.push({m,c:c[0]});}
    }
    // Phase 2: unnumbered UFC meetings <- unnumbered cards, by date<->id order
    const unM=fpM.filter(m=>!numOf(m.event)&&!rows.some(r=>r.m===m));
    const unC=cds.filter(x=>!used.has(x.id)&&!x.num).sort((a,b)=>a.id-b.id);
    if(unM.length>=1&&unC.length===unM.length){
      unM.forEach((m,i)=>{used.add(unC[i].id);rows.push({m,c:unC[i]});});
    } else if(unM.length===1&&unC.length>=1){
      used.add(unC[0].id);rows.push({m:unM[0],c:unC[0]});
    }
    if(rows.length){
      place[fk]=place[fk]||[];
      for(const {m,c} of rows)place[fk].push({opponent:opp,url:'https://ufcfightpass.com/video/'+c.id,event:eventLabel(m),date:m.date});
    }
    if(rows.length<fpM.length){
      manual.push(fk+' vs '+opp+' | placed '+rows.length+'/'+fpM.length+' fpMeetings :: '+meetings.map(m=>m.event+' '+m.date).join(' ; ')+' :: '+cds.map(c=>c.id+'='+c.title).join(' ; '));
    }
  }
}
fs.writeFileSync(path.join(ROOT,'data/fp-resid-place.json'),JSON.stringify(place,null,1));
fs.writeFileSync(path.join(ROOT,'data/fp-resid-manual.txt'),manual.join('\n')+'\n');
let n=0;for(const f in place)n+=place[f].length;
console.log('resid resolved rows: '+n+' across '+Object.keys(place).length+' fighters | partial/manual: '+manual.length);
