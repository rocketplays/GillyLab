#!/usr/bin/env node
/*
 * gen-fp-sweep.cjs — build a self-contained browser script that sweeps UFC Fight
 * Pass for a set of fighters and DOWNLOADS the results as fp-results.json.
 *
 * No server, no CORS: the script runs on the ufcfightpass.com tab (so it uses the
 * page's own auth token), matches each fighter's untaped bouts against FP's search
 * results with the SAME strict logic the ingest side re-checks, and saves a file.
 *
 * Usage:
 *   node scripts/gen-fp-sweep.cjs ranked        # ranked fighters not yet fully taped (default)
 *   node scripts/gen-fp-sweep.cjs all           # every fighter with an untaped bout
 *   node scripts/gen-fp-sweep.cjs "Middleweight" # one division
 * Output: scripts/fp-sweep.js  (paste its contents into the FP tab console)
 */
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..');
const arg = process.argv[2] || 'ranked';
function bal(h, m){const i=h.indexOf(m);let d=0,k=h.indexOf('{',i);for(;k<h.length;k++){if(h[k]=='{')d++;else if(h[k]=='}'){d--;if(!d)break;}}return h.slice(i,k+1)+';';}
const H = fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const ctx={}; vm.createContext(ctx);
vm.runInContext('var '+bal(H,'FIGHT_HISTORY = {'),ctx);
vm.runInContext('var '+bal(H,'TAPE_STUDY = {'),ctx);
const FH=ctx.FIGHT_HISTORY, TS=ctx.TAPE_STUDY;
const norm=s=>(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/-/g,' ').replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,' ').trim();
const asc=s=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[’]/g,'');

// choose the fighter set
let names;
if (arg === 'all') {
  names = Object.keys(FH);
} else {
  const R = JSON.parse(fs.readFileSync(path.join(ROOT,'data/rankings.json'),'utf8')).data;
  const ranked = R.filter(r=>r.division && !/pound/i.test(r.division));
  if (arg === 'ranked') {
    names = [...new Set(ranked.map(r=>r.fighterName))];
  } else {
    names = ranked.filter(r=>new RegExp(arg,'i').test(r.division)).map(r=>r.fighterName);
  }
}
// map to DB keys + build untaped-opponent lists
const gaps = {};
for (const nm of names) {
  const fk = Object.keys(FH).find(k=>norm(k)===norm(nm));
  if (!fk) continue;
  const ts = (TS[fk]||[]).map(x=>norm(x.opponent));
  const opps = [...new Set(FH[fk].filter(b=>b.method!=='Upcoming'&&b.result!=='–'&&!ts.includes(norm(b.opponent))).map(b=>b.opponent))];
  if (opps.length) gaps[asc(fk)] = opps.map(asc);
}

const BROWSER = `/* UFC Fight Pass sweep — paste into the ufcfightpass.com tab console while logged in.
   Runs autonomously, then downloads fp-results.json. Move that file into
   ~/Documents/GitHub/GillyLab/data/ (or the outputs folder) and run fp-ingest. */
(async () => {
  const GAPS = ${JSON.stringify(gaps)};
  const KEY = '857a1e5d-e35e-4fdf-805b-a87b6f8364bf';
  const of = window.__of || (window.__of = window.fetch);
  const norm = s => (s||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().replace(/-/g,' ').replace(/[^a-z0-9\\s]/g,'').replace(/\\s+/g,' ').trim();
  const toks = s => norm(s).split(' ').filter(Boolean);
  function sideHas(side,name){const st=toks(side),nt=toks(name);if(!nt.length)return false;const sur=nt[nt.length-1],fir=nt[0];if(!st.includes(sur))return false;if(nt.length===1)return true;return st.some(t=>t===fir||(fir.length>=4&&t.startsWith(fir.slice(0,4)))||(t.length>=4&&fir.startsWith(t.slice(0,4))));}
  function tok(){let t=localStorage.getItem('dice:authToken')||'';if(t&&t[0]==='"'){try{t=JSON.parse(t);}catch(e){}}if(t&&t[0]==='{'){try{const o=JSON.parse(t);t=o.authorisationToken||o.token||o.accessToken||t;}catch(e){}}return t.startsWith('Bearer')?t:'Bearer '+t;}
  async function refresh(){
    // proactively swap the stored token using the refresh token (best-effort)
    try{
      let rt=localStorage.getItem('dice:refreshToken')||'';if(rt&&rt[0]==='"'){try{rt=JSON.parse(rt);}catch(e){}}
      const r=await of('https://dce-frontoffice.imggaming.com/api/v2/token/refresh',{method:'POST',headers:{'Accept':'application/json','Content-Type':'application/json','Realm':'dce.ufc','app':'dice','x-api-key':KEY,'x-app-var':'6.60.0','Authorization':tok()},body:JSON.stringify({refreshToken:rt})});
      if(r.status===200){const j=await r.json();const nt=j.authorisationToken||j.token;if(nt){localStorage.setItem('dice:authToken',nt);if(j.refreshToken)localStorage.setItem('dice:refreshToken',j.refreshToken);return true;}}
    }catch(e){}
    return false;
  }
  async function search(term){
    const url='https://search.dce-prod.dicelaboratory.com/search?query='+encodeURIComponent(term)+'&timezone=America%2FPhoenix';
    let r=await of(url,{headers:{'Accept':'application/json','Authorization':tok(),'Realm':'dce.ufc','app':'dice','x-api-key':KEY,'x-app-var':'6.60.0','Content-Type':'application/json'}});
    if(r.status===401){ if(await refresh()){ r=await of(url,{headers:{'Accept':'application/json','Authorization':tok(),'Realm':'dce.ufc','app':'dice','x-api-key':KEY,'x-app-var':'6.60.0','Content-Type':'application/json'}}); } }
    if(r.status!==200)return {__err:r.status};
    const j=await r.json();const cl=(j.elements||[]).find(e=>e.attributes&&e.attributes.cards);const cs=(cl&&cl.attributes.cards)||[];
    return cs.map(c=>{const d=c.attributes&&c.attributes.action&&c.attributes.action.data||{};return {title:d.title,id:String(d.id||'').replace('VOD#','')};}).filter(x=>x.title&&x.id);
  }
  const STORE='fp_sweep_out';
  const out = JSON.parse(localStorage.getItem(STORE)||'{}');   // resume: keep prior progress
  const save=()=>localStorage.setItem(STORE,JSON.stringify(out));
  function download(){const blob=new Blob([JSON.stringify(out,null,0)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='fp-results.json';document.body.appendChild(a);a.click();a.remove();}
  window.fpDownload=download;   // call fpDownload() any time to grab progress so far
  const keys=Object.keys(GAPS); let done=Object.keys(out).length;
  for(const f of keys){
    if(out[f]!==undefined)continue;                 // already swept in a prior run
    let cards; try{cards=await search(f);}catch(e){cards={__err:'net'};}
    if(cards&&cards.__err){
      save();
      console.log('TOKEN EXPIRED after '+done+'/'+keys.length+'. Progress saved. Reload this tab and paste the script again to resume; it will finish and auto-download.');
      return;
    }
    const seen=new Set(),lines=[];
    for(const c of cards){const t=c.title||'';const i=t.toLowerCase().indexOf(' vs ');if(i<0)continue;const a=t.slice(0,i),b=t.slice(i+4);
      const fA=sideHas(a,f),fB=sideHas(b,f);if(fA===fB)continue;const opS=fA?b:a,fS=fA?a:b;
      for(const opp of GAPS[f]){if(sideHas(opS,opp)&&!sideHas(fS,opp)){if(!seen.has(c.id)){seen.add(c.id);lines.push(c.id+' | '+t);}break;}}
    }
    out[f]=lines; done++;
    if(done%20===0){save();console.log('swept '+done+'/'+keys.length);}
    await new Promise(r=>setTimeout(r,250));
  }
  save();
  console.log('DONE — '+done+'/'+keys.length+' fighters. Downloading fp-results.json... (localStorage key '+STORE+' can be cleared after)');
  download();
})();
`;
fs.writeFileSync(path.join(ROOT,'scripts','fp-sweep.js'), BROWSER);
const nf = Object.keys(gaps).length, no = Object.values(gaps).reduce((a,b)=>a+b.length,0);
console.log('Wrote scripts/fp-sweep.js — set "'+arg+'": '+nf+' fighters, '+no+' untaped opponents.');
console.log('Paste its contents into the ufcfightpass.com tab console (logged in).');
