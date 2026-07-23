#!/usr/bin/env node
/*
 * pplus-ingest.cjs — match Paramount+ per-fight videos to untaped 2025-26 UFC gaps.
 *
 *   node scripts/pplus-ingest.cjs data/pplus-fights.tsv            # dry run: report + flags
 *   node scripts/pplus-ingest.cjs data/pplus-fights.tsv --write    # append-only merge + verify
 *
 * Input TSV rows: <contentId>\t<fightTitle>\t<seriesTitle>\t<YYYY-MM-DD>
 * fightTitle looks like "Dricus Du Plessis vs. Kamaru Usman (UFC Fight Night: ... - Main)".
 *
 * Matching mirrors the proven FP pipeline, with an added DATE gate:
 *   - subject matched by EXACT surname token + first-name (prefix ok), opp on the OTHER
 *     side of "vs" (kills Perez/Pereira etc.)
 *   - the Paramount airdate month/year must equal the DB bout's month/year (±1 month),
 *     which makes rematches self-disambiguating and blocks wrong-event links
 *   - only opponents with NO existing tape row are added (never overwrites YouTube/FP)
 *   - a single date-matched candidate auto-places; >1 after date gate -> flag (never guess)
 * After --write: append rows untouched, then verify findTapeStudyUrl + zero pre-existing loss.
 */
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
const tsvPath=process.argv[2];
const WRITE=process.argv.includes('--write');
if(!tsvPath){console.error('usage: pplus-ingest.cjs <pplus-fights.tsv> [--write]');process.exit(1);}
function bal(h,m){const i=h.indexOf(m);let d=0,k=h.indexOf('{',i);for(;k<h.length;k++){if(h[k]=='{')d++;else if(h[k]=='}'){d--;if(!d)break;}}return {s:i,e:k};}
function slice(h,m){const b=bal(h,m);return h.slice(b.s,b.e+1)+';';}
let H=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const ctx={};vm.createContext(ctx);
vm.runInContext('var '+slice(H,'FIGHT_HISTORY = {'),ctx);
vm.runInContext('var '+slice(H,'TAPE_STUDY = {'),ctx);
const FH=ctx.FIGHT_HISTORY,TS=ctx.TAPE_STUDY;

const norm=s=>(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/-/g,' ').replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,' ').trim();
const toks=s=>norm(s).split(' ').filter(Boolean);
function sideHas(side,name){const st=toks(side),nt=toks(name);if(!nt.length)return false;const s=nt[nt.length-1],f=nt[0];if(!st.includes(s))return false;if(nt.length===1)return true;return st.some(t=>t===f||(f.length>=4&&t.startsWith(f.slice(0,4)))||(t.length>=4&&f.startsWith(t.slice(0,4))));}
const esc=s=>String(s).replace(/\\/g,'\\\\').replace(/"/g,'\\"');
const MON={Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12};
const boutMY=d=>{const m=String(d).match(/([A-Z][a-z]{2})\s+\d+,\s*(\d{4})/);return m?{y:+m[2],m:MON[m[1]]}:null;};
const ppMY=d=>{const m=String(d).match(/(\d{4})-(\d{2})-\d{2}/);return m?{y:+m[1],m:+m[2]}:null;};
const near=(a,b)=>a&&b&&a.y===b.y&&Math.abs(a.m-b.m)<=1;
const yr=s=>{const m=String(s).match(/\b(20\d\d)\b/);return m?+m[1]:0;};
const isUFC=f=>(f.org==='UFC'||f.org==='DWCS'||/\bUFC\b|DWCS|Contender Series|Ultimate Fighter|\bTUF\b|Road to UFC|Noche UFC/i.test(f.event||''))&&!/Full Contact Contender/i.test(f.event||'');

// --- parse Paramount fights ---
const raw=fs.readFileSync(path.join(ROOT,tsvPath),'utf8').split('\n').filter(Boolean);
const ppf=[];
for(const line of raw){
  const [id,title,series,date]=line.split('\t');
  if(!id||!title)continue;
  const head=title.split(' (')[0];              // strip trailing "(Event ...)"
  const mm=head.match(/^(.*?)\s+vs\.?\s+(.*)$/i);
  if(!mm)continue;
  ppf.push({id:id.trim(), a:mm[1].trim(), b:mm[2].trim(), my:ppMY(date), date, title});
}

// --- match each untaped 2025-26 UFC gap ---
const place={},flags=[];
for(const fk in FH){
  const ts=(TS[fk]||[]).map(x=>norm(x.opponent));
  const seen={};
  for(const bt of FH[fk]){
    if(bt.method==='Upcoming'||bt.result==='–')continue;
    if(yr(bt.date)<2025)continue;
    if(!isUFC(bt))continue;
    const ok=norm(bt.opponent); if(ts.includes(ok))continue;
    const key=ok+'|'+bt.date; if(seen[key])continue; seen[key]=1;
    const bMY=boutMY(bt.date);
    // candidate Paramount fights: fk one side, opp other, date near
    const cand=ppf.filter(p=>{
      const fA=sideHas(p.a,fk),fB=sideHas(p.b,fk); if(fA===fB)return false;
      const oS=fA?p.b:p.a, sS=fA?p.a:p.b;
      return sideHas(oS,bt.opponent)&&!sideHas(sS,bt.opponent)&&near(p.my,bMY);
    });
    const uniq=[...new Map(cand.map(c=>[c.id,c])).values()];
    if(uniq.length===0)continue;
    if(uniq.length===1){
      (place[fk]=place[fk]||[]).push({opponent:bt.opponent,url:'https://www.paramountplus.com/shows/video/'+uniq[0].id+'/',event:eventLabel(bt),date:bt.date});
    } else {
      // more than one date-near candidate: prefer exact month, else flag
      const exact=uniq.filter(c=>c.my&&bMY&&c.my.m===bMY.m);
      if(exact.length===1){(place[fk]=place[fk]||[]).push({opponent:bt.opponent,url:'https://www.paramountplus.com/shows/video/'+exact[0].id+'/',event:eventLabel(bt),date:bt.date});}
      else flags.push(fk+' vs '+bt.opponent+' ('+bt.event+' '+bt.date+') :: '+uniq.map(c=>c.id+'='+c.title).join(' ; '));
    }
  }
}
function eventLabel(r){const name=String(r.event||r.org||'').split(':')[0].trim();const my=/([A-Z][a-z]{2})\s+\d+,\s*(\d{4})/.exec(String(r.date||''));return name+(my?' · '+my[1]+' '+my[2]:'');}

let n=0;for(const f in place)n+=place[f].length;
fs.writeFileSync(path.join(ROOT,'data','pplus-place.json'),JSON.stringify(place,null,1));
fs.writeFileSync(path.join(ROOT,'data','pplus-flags.txt'),flags.join('\n')+'\n');
console.log('Paramount fights parsed: '+ppf.length+' | auto-place: '+n+' rows across '+Object.keys(place).length+' fighters | flags: '+flags.length);
if(!WRITE){console.log('dry run — re-run with --write to merge.');process.exit(0);}

// ---- append-only merge ----
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
if(lost||un)console.log('!! verification failed — restore index.html from git and investigate.');
