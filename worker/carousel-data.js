// AUTO-GENERATED from worker/pages.js by scripts/gen-carousel.cjs — do not edit by hand.
// The landing page carousel, shared with /subscribe so the two stay identical.
import landingData from "./landing-data.js";

export const carouselCSS = `.bc{font-family:'Barlow Condensed',sans-serif}
  .showcase{max-width:620px;margin:44px auto 0}
  .sc-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
  .sc-title{font-size:14px;font-weight:700}
  .sc-titlewrap{display:flex;align-items:center;gap:10px;min-width:0}
  .sc-tag{font-size:10px;font-weight:700;letter-spacing:.06em;padding:2px 8px;border-radius:999px;white-space:nowrap}
  .sc-tag.free{color:var(--accent);background:rgba(0,230,104,.12);border:1px solid rgba(0,230,104,.28)}
  .sc-tag.prem{color:#ffcf7a;background:rgba(255,207,122,.10);border:1px solid rgba(255,207,122,.28)}
  .sc-nav{display:flex;gap:8px}
  .sc-arrow{cursor:pointer;width:30px;height:30px;border-radius:8px;border:1px solid rgba(255,255,255,.14);display:flex;align-items:center;justify-content:center;font-size:16px;color:#fff;user-select:none}
  .sc-arrow:hover{border-color:var(--accent);color:var(--accent)}
  .sc-stage{background:#0d0d10;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:20px;min-height:384px;display:flex;align-items:center;touch-action:pan-y}
  #stg{width:100%;transition:opacity .22s ease}
  .sc-dots{display:flex;gap:7px;justify-content:center;margin-top:14px}
  .sc-dot{width:7px;height:7px;border-radius:50%;cursor:pointer;background:rgba(255,255,255,.22)}
  .sc-desc{text-align:left;color:rgba(255,255,255,.55);font-size:13px;margin:2px 0 13px;max-width:560px;min-height:2.4em}
  /* Faithful in-app component styles */
  .statc{background:var(--card);border:1px solid var(--border);border-radius:6px;padding:.85rem .9rem}
  .statc-l{font-size:.56rem;color:var(--muted);letter-spacing:.2em;text-transform:uppercase;margin-bottom:.35rem}
  .statc-v{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:1.7rem;letter-spacing:.02em;color:var(--accent);line-height:1}
  .rrow{display:flex;align-items:center;gap:.7rem;background:var(--card);border:1px solid var(--border);border-radius:5px;padding:.5rem .8rem}
  .rchamp{border-color:rgba(255,179,64,.35);background:linear-gradient(90deg,rgba(255,179,64,.06) 0%,var(--card) 100%)}
  .rnum{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:.95rem;color:var(--accent);min-width:22px;letter-spacing:.05em}
  .rchamp .rnum{color:#ffb340}
  .rname{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:1rem;letter-spacing:.04em;text-transform:uppercase;flex:1;min-width:0;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .rrec{font-size:.72rem;color:var(--muted)}
  .rmove{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:.68rem;padding:.1rem .3rem;border-radius:3px;white-space:nowrap}
  .rmu{color:#22c55e;background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.3)}
  .rmd{color:#ef4444;background:rgba(239,68,68,.10);border:1px solid rgba(239,68,68,.25)}
  .rtag{font-family:'Barlow Condensed',sans-serif;font-size:.58rem;letter-spacing:.08em;text-transform:uppercase;color:#ffb340;border:1px solid rgba(255,179,64,.35);padding:.08rem .35rem;border-radius:2px}
  /* Featured-fighter slide — mirrors the profile's grouped median bars. */
  .fsx-bio{display:flex;flex-wrap:wrap;gap:1.1rem;padding:.8rem 0;border-top:1px solid var(--border);border-bottom:1px solid var(--border)}
  .fsx-bio-k{font-size:.56rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
  .fsx-bio-v{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:1.05rem;margin-top:.15rem;color:#ececf0}
  .fsx-caption{font-size:.62rem;color:var(--muted);margin:.7rem 0 .1rem;display:flex;flex-wrap:wrap;gap:.3rem .8rem;align-items:center}
  .fsx-legend{display:inline-flex;align-items:center;gap:.7rem;flex-wrap:wrap}
  .fsx-lg{display:inline-flex;align-items:center;gap:.3rem}
  .fsx-lg-sw{width:14px;height:6px;border-radius:2px;display:inline-block}
  .fsx-lg-tick{width:2px;height:11px;background:#fff;display:inline-block}
  .fsx-group{margin-top:.9rem}
  .fsx-group-t{font-size:.58rem;letter-spacing:.18em;text-transform:uppercase;color:var(--muted);margin-bottom:.55rem}
  .fsx-row{display:flex;align-items:center;gap:.7rem;margin-bottom:.5rem}
  .fsx-group:last-child .fsx-row:last-child{margin-bottom:0}
  .fsx-label{flex:0 0 140px;font-size:.74rem;color:#c9c9d0}
  .fsx-bar{position:relative;flex:1;min-width:50px}
  .fsx-track{height:8px;background:var(--surface2);border-radius:4px;overflow:hidden}
  .fsx-track-empty{background:transparent}
  .fsx-fill{height:100%;border-radius:4px}
  .fsx-fill.good{background:var(--accent)}
  .fsx-fill.bad{background:#c76a54}
  .fsx-tick{position:absolute;top:-3px;bottom:-3px;width:2px;background:#fff;border-radius:1px}
  .fsx-val{flex:0 0 46px;text-align:right;font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:1.05rem;color:#ececf0}
  .fsx-val.good{color:var(--accent)}
  .fsx-val.bad{color:#c76a54}`;

export const carouselMarkup = `<section class="showcase" role="group" aria-label="Feature previews" aria-roledescription="carousel">
    <div class="sc-head">
      <div class="sc-titlewrap"><span class="sc-title" id="fl" aria-live="polite">Fight simulator</span><span class="sc-tag prem" id="ft">PREMIUM</span></div>
      <div class="sc-nav">
        <span class="sc-arrow" id="pv" role="button" tabindex="0" aria-label="Previous feature">‹</span>
        <span class="sc-arrow" id="nx" role="button" tabindex="0" aria-label="Next feature">›</span>
      </div>
    </div>
    <p class="sc-desc" id="fd"></p>
    <div class="sc-stage"><div id="stg"></div></div>
    <div class="sc-dots" id="dt" role="tablist" aria-label="Choose a feature"></div>
  </section>`;

export function carouselScript() {
  return `<script>
(function(){
  var LD=${JSON.stringify(landingData)};
  var A="#00e668",M="var(--muted)",L="rgba(255,255,255,.09)",BG="#0a0a0b";
  // Real database thumbnails (served publicly via the Worker's LANDING_PHOTOS
  // allow-list); initials render if an image is ever unavailable.
  function ava(slug,init,gold,sz){
    var d=sz||34,ring=gold?"#ffb340":A;
    var base="width:"+d+"px;height:"+d+"px;border-radius:50%;overflow:hidden;border:2px solid "+ring+";flex:0 0 auto;background:#1a1a1a;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:"+(d>=32?12:10)+"px;color:#fff;";
    if(!slug)return '<div style="'+base+'">'+init+'</div>';
    return '<div style="'+base+'"><img src="/photos/thumb/'+slug+'.png" alt="'+init+'" style="width:100%;height:100%;object-fit:cover;object-position:top center" onerror="this.parentNode.textContent=\\''+init+'\\'"></div>';
  }

  var F=LD.featured;
  function fsxRow(r){
    var bar=r.bar
      ? '<div class="fsx-bar"><div class="fsx-track"><div class="fsx-fill '+r.cls+'" style="width:'+r.w+'%"></div></div><div class="fsx-tick" style="left:'+r.tickX+'%"></div></div>'
      : '<div class="fsx-bar"><div class="fsx-track fsx-track-empty"></div></div>';
    return '<div class="fsx-row"><div class="fsx-label">'+r.label+'</div>'+bar+'<div class="fsx-val '+r.cls+'">'+r.val+'</div></div>';
  }
  var analytics='<div style="display:flex;align-items:center;gap:11px;margin-bottom:12px">'+ava(F.slug,F.initials,true,38)+'<div><div class="bc" style="font-weight:700;font-size:1.2rem;letter-spacing:.03em;text-transform:uppercase">'+F.name+'</div><div style="font-size:11px;color:'+M+'"><span style="color:#ffb340">'+F.division+' Champion</span>'+(F.record?' · '+F.record:'')+'</div></div></div>'
    +((F.bio&&F.bio.length)?'<div class="fsx-bio">'+F.bio.map(function(b){return '<div><div class="fsx-bio-k">'+b[0]+'</div><div class="fsx-bio-v">'+b[1]+'</div></div>';}).join('')+'</div>':'')
    +(F.hasBars?'<div class="fsx-caption"><span class="fsx-legend"><span class="fsx-lg"><span class="fsx-lg-sw" style="background:'+A+'"></span>better than average</span><span class="fsx-lg"><span class="fsx-lg-sw" style="background:#c76a54"></span>below average</span><span class="fsx-lg"><span class="fsx-lg-tick"></span>division average</span></span></div>':'')
    +(F.groups||[]).map(function(g){return '<div class="fsx-group"><div class="fsx-group-t">'+g.t+'</div>'+g.rows.map(fsxRow).join('')+'</div>';}).join('');

  function mrows(rows){return rows.map(function(r){return '<div style="display:flex;align-items:center;gap:7px;margin:5px 0"><div style="width:66px;font-size:10.5px;color:'+M+'">'+r[0]+'</div><div style="flex:1;height:6px;background:'+BG+';border-radius:4px;overflow:hidden"><div style="width:'+r[1]+'%;height:100%;background:'+A+'"></div></div><div style="width:28px;text-align:right;font-size:10.5px;font-weight:700">'+r[1]+'%</div></div>';}).join('');}
  function shead(av,name,count,pct,lead){return '<div style="display:flex;align-items:center;justify-content:space-between;margin:3px 0"><div style="display:flex;align-items:center;gap:9px">'+av+'<div><div style="font-weight:700;font-size:13px">'+name+'</div><div style="font-size:10.5px;color:'+M+'">'+count+'</div></div></div><div class="bc" style="font-size:22px;font-weight:900;color:'+(lead?A:'#fff')+'">'+pct+'%</div></div>';}
  var sim='<div style="font-size:10px;color:'+M+';text-transform:uppercase;letter-spacing:.09em;margin-bottom:9px">Simulated · 5 rounds · 10,000 runs</div>'
    +shead(ava('joshua-van','JV'),'Joshua Van','5,522 / 10,000 wins','55',true)
    +'<div style="height:8px;background:var(--surface2);border-radius:4px;overflow:hidden;display:flex;margin:8px 0"><div style="width:55%;height:100%;background:'+A+'"></div><div style="flex:1;background:'+M+'"></div></div>'
    +shead(ava('tatsuro-taira','TT'),'Tatsuro Taira','4,478 / 10,000 wins','45',false)
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:14px">'
    +'<div><div class="bc" style="font-size:11px;font-weight:700;color:'+M+';text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px">Van — method of victory</div>'+mrows([['KO/TKO',52],['Submission',11],['Decision',37]])+'</div>'
    +'<div><div class="bc" style="font-size:11px;font-weight:700;color:'+M+';text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px">Taira — method of victory</div>'+mrows([['KO/TKO',36],['Submission',43],['Decision',21]])+'</div></div>'
    +'<div style="display:flex;align-items:center;margin-top:14px;padding-top:12px;border-top:1px solid '+L+'"><div style="flex:1;text-align:center"><div style="font-size:10px;color:'+M+';text-transform:uppercase;letter-spacing:.1em">Power Score</div><div class="bc" style="font-size:19px;font-weight:900">7.08</div></div><div style="width:1px;height:30px;background:'+L+'"></div><div style="flex:1;text-align:center"><div style="font-size:10px;color:'+M+';text-transform:uppercase;letter-spacing:.1em">Power Score</div><div class="bc" style="font-size:19px;font-weight:900;color:'+A+'">7.80</div></div></div>'
    +'<div style="font-size:10px;color:'+M+';text-align:center;margin-top:8px;line-height:1.4">Composite of striking output/defense, grappling &amp; finishing rate, and recent form — drives the win-probability estimate above.</div>';

  // Static single-matchup odds board (McGregor vs Holloway), mirroring the
  // Odds & Projections page: moneyline + rounds O/U by book, method-of-victory
  // and round props per fighter. PLACEHOLDER values — replace with real ones.
  var BK={dk:'#1fbf4d',fd:'#4aa3ff',mgm:'#d1a10a'};
  function oc(v){var neg=String(v).charAt(0)==='-';return '<span class="bc" style="font-weight:700;color:'+(neg?'#4cff8a':'#ff9500')+'">'+v+'</span>';}
  function osec(t){return '<div style="font-size:.56rem;letter-spacing:.09em;text-transform:uppercase;color:rgba(255,255,255,.42);margin:.5rem 0 .18rem">'+t+'</div>';}
  function o3(book,col,a,b){return '<div style="display:flex;align-items:center;padding:.13rem 0;font-size:.78rem"><span style="flex:0 0 80px;font-weight:700;font-size:.7rem;color:'+col+'">'+book+'</span><span style="flex:1;text-align:center">'+oc(a)+'</span><span style="flex:1;text-align:center">'+oc(b)+'</span></div>';}
  function o2(book,col,over,under){return '<div style="display:flex;align-items:center;justify-content:space-between;padding:.13rem 0;font-size:.78rem"><span style="font-weight:700;font-size:.7rem;color:'+col+'">'+book+'</span><span>'+oc(over)+' <span style="color:'+M+';font-weight:400">/</span> '+oc(under)+'</span></div>';}
  function opropRow(name,cells){return '<div style="font-size:.74rem;padding:.1rem 0;white-space:nowrap"><span style="color:'+M+';font-size:.68rem;display:inline-block;min-width:66px">'+name+'</span>'+cells+'</div>';}
  var odds='<div style="display:flex;align-items:center;justify-content:space-between;gap:.4rem;margin-bottom:.25rem"><div style="display:flex;align-items:center;gap:7px">'+ava('conor-mcgregor','CM',false,28)+'<span style="font-weight:700;font-size:.86rem">Conor McGregor</span></div><span style="color:'+M+';font-size:.66rem">vs</span><div style="display:flex;align-items:center;gap:7px"><span style="font-weight:700;font-size:.86rem">Max Holloway</span>'+ava('max-holloway','MH',false,28)+'</div></div>'
    +'<div style="text-align:center;font-size:.6rem;color:'+M+';text-transform:uppercase;letter-spacing:.08em;margin-bottom:.15rem">UFC 329 · 5-round main event</div>'
    +osec('Moneyline · McGregor / Holloway')
    +o3('DraftKings',BK.dk,'+195','-238')+o3('FanDuel',BK.fd,'+196','-260')+o3('BetMGM',BK.mgm,'+175','-225')
    +osec('Total rounds · Over/Under 2.5')
    +o2('DraftKings',BK.dk,'-105','-125')+o2('FanDuel',BK.fd,'-102','-126')+o2('BetMGM',BK.mgm,'-115','-115')
    +osec('Method of victory')
    +opropRow('McGregor','KO/TKO '+oc('+300')+' &nbsp;Sub '+oc('+2500')+' &nbsp;Dec '+oc('+1100'))
    +opropRow('Holloway','KO/TKO '+oc('-120')+' &nbsp;Sub '+oc('+1300')+' &nbsp;Dec '+oc('+600'))
    +osec('Round props — fight ends in')
    +opropRow('McGregor','R1 '+oc('+600')+' R2 '+oc('+1200')+' R3 '+oc('+2200')+' R4 '+oc('+3300')+' R5 '+oc('+5000'))
    +opropRow('Holloway','R1 '+oc('+500')+' R2 '+oc('+600')+' R3 '+oc('+650')+' R4 '+oc('+750')+' R5 '+oc('+1100'));

  // Line-movement slide — real McGregor/Holloway moneyline trajectory (raw American odds).
  var lmM=[300,288,278,268,259,251,243,236,229,222,216,210,202,197,193,189,180,176,172,169,166,163,161,160,162,176,185,181,184,184,187,187,186,210,263];
  var lmH=[-430,-412,-396,-382,-368,-356,-344,-333,-323,-313,-304,-296,-284,-278,-272,-266,-240,-235,-230,-226,-222,-218,-214,-210,-213,-223,-229,-224,-226,-226,-228,-229,-227,-257,-324];
  var lmW=520,lmHt=130,lmP=10,lmN=lmM.length,lmLo=-460,lmHi=330;
  function lmy(o){return lmHt-lmP-(o-lmLo)/(lmHi-lmLo)*(lmHt-2*lmP);}
  function lmpts(arr){return arr.map(function(o,k){return (lmP+(lmW-2*lmP)*k/(lmN-1)).toFixed(1)+','+lmy(o).toFixed(1);}).join(' ');}
  function lmdot(arr,col){return '<circle cx="'+(lmW-lmP)+'" cy="'+lmy(arr[arr.length-1]).toFixed(1)+'" r="3.6" fill="'+col+'"/>';}
  var lmZ=lmy(0).toFixed(1);
  // Bet & CLV tracker — the pitch is the honesty of the number: bets on fights we
  // track auto-grade, and CLV is measured against a real closing line.
  function btile(lab,val,col){return '<div style="flex:1;background:rgba(255,255,255,.04);border-radius:8px;padding:.4rem .5rem"><div style="font-size:.52rem;letter-spacing:.08em;text-transform:uppercase;color:'+M+'">'+lab+'</div><div style="font-size:.95rem;font-weight:800;color:'+(col||'inherit')+'">'+val+'</div></div>';}
  // The fighter you actually bet on gets the face — same rule as btBetNames() in
  // the app: a fighter-specific pick shows one headshot.
  // NB: named btkrow, not brow — the box-score slide already owns brow(), and a
  // second brow() in the same script silently wins by being declared later,
  // swallowing these args into the wrong signature. (No backticks in here: this
  // whole block lives inside a template literal.)
  function btkrow(slug,init,pick,match,odds,res,rescol,tag,tagcol){
    return '<div style="display:flex;align-items:center;gap:8px;padding:.3rem 0;border-bottom:1px solid rgba(255,255,255,.05)">'
      +ava(slug,init,false,26)
      +'<div style="flex:1;min-width:0"><div style="font-weight:700;font-size:.76rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+pick+'</div>'
      +'<div style="font-size:.6rem;color:'+M+';white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+match+'</div></div>'
      +'<div style="text-align:right"><div style="font-weight:800;font-size:.78rem;color:'+rescol+'">'+res+'</div>'
      +'<div style="font-size:.58rem;color:'+M+'">'+odds+'</div></div>'
      +'<span style="flex:0 0 auto;font-size:.52rem;font-weight:700;border-radius:4px;padding:2px 5px;color:'+tagcol+';background:'+tagcol+'1a;white-space:nowrap">'+tag+'</span></div>';
  }
  var bets='<div style="font-size:.68rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#fff;margin-bottom:.45rem">My bet history</div>'
    +'<div style="font-size:.56rem;letter-spacing:.09em;text-transform:uppercase;color:rgba(255,255,255,.42);margin-bottom:.1rem">Closing line value</div>'
    +'<div style="display:flex;align-items:baseline;gap:8px;margin-bottom:.5rem"><span style="font-size:1.6rem;font-weight:800;color:'+A+';line-height:1">+3.1<span style="font-size:.6rem;color:'+M+';margin-left:2px">pts</span></span>'
    +'<span style="font-size:.66rem;color:#c9ccd3">beat the close on <b>27 of 40</b> moneylines</span></div>'
    +'<div style="display:flex;gap:6px;margin-bottom:.55rem">'+btile('Record','24-16')+btile('ROI','+11.8%',A)+btile('Units','+9.2u',A)+btile('Pending','3')+'</div>'
    +osec('UFC 329 · settled')
    +btkrow('max-holloway','MH','Holloway ML','Holloway vs McGregor','-205 \\u00b7 5u','+2.44u',A,'CLV +2.4',A)
    +btkrow('paddy-pimblett','PP','Pimblett by submission','Pimblett vs Saint-Denis','+700 \\u00b7 0.5u','+3.5u',A,'no CLV','#8a8f99')
    +btkrow('adrian-yanez','AY','Yanez inside the distance','Yanez vs Garbrandt','-110 \\u00b7 1u','+0.91u',A,'no CLV','#8a8f99')
    +'<div style="font-size:.58rem;color:'+M+';margin-top:.45rem;line-height:1.5">Log a bet before the bell and it grades itself off the result. CLV is measured against the real closing line \\u2014 moneylines only.</div>';

  var lm='<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">'+ava('conor-mcgregor','CM',false,28)+'<div style="flex:1"><div style="font-weight:700;font-size:.88rem">McGregor vs Holloway</div><div style="font-size:10.5px;color:'+M+'">UFC 329 · moneyline movement (American odds)</div></div>'+ava('max-holloway','MH',false,28)+'</div>'
    +'<svg viewBox="0 0 '+lmW+' '+lmHt+'" width="100%" style="display:block">'
    +'<line x1="'+lmP+'" y1="'+lmZ+'" x2="'+(lmW-lmP)+'" y2="'+lmZ+'" stroke="rgba(255,255,255,.12)" stroke-width="1" stroke-dasharray="3 4"/>'
    +'<text x="'+lmP+'" y="'+(lmZ-3)+'" fill="rgba(255,255,255,.3)" font-size="9" style="text-transform:uppercase;letter-spacing:.05em">even</text>'
    +'<polyline points="'+lmpts(lmH)+'" fill="none" stroke="#8a8a92" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>'
    +'<polyline points="'+lmpts(lmM)+'" fill="none" stroke="'+A+'" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>'
    +lmdot(lmH,'#8a8a92')+lmdot(lmM,A)+'</svg>'
    +'<div style="display:flex;justify-content:space-between;font-size:9px;color:rgba(255,255,255,.32);text-transform:uppercase;letter-spacing:.06em;margin-top:1px"><span>Jun 5 · open</span><span>Jul 11 · close</span></div>'
    +'<div style="display:flex;justify-content:space-between;font-size:11px;margin-top:7px"><span><span style="color:'+A+'">●</span> McGregor <span class="bc" style="font-weight:700">+300 → +263</span></span><span><span style="color:#8a8a92">●</span> Holloway <span class="bc" style="font-weight:700">-430 → -324</span></span></div>'
    +'<div style="font-size:11px;color:'+M+';margin-top:8px;line-height:1.45">Opened a +300 underdog; early money on McGregor bet him in to +160 (Holloway -210), but late steam swung back to Holloway and the line closed McGregor +263 / Holloway -324.</div>';

  var OH=LD.oddsHistory;
  var ohist='<div style="display:flex;align-items:center;gap:11px;margin-bottom:12px">'+ava(OH.slug,OH.initials,false,36)+'<div><div style="font-weight:700;font-size:1rem">'+OH.name+'</div><div style="font-size:11px;color:'+M+'">Closing line — career odds history</div></div></div>'
    +OH.rows.map(function(r){var neg=r.odds<0,v=r.odds>0?('+'+r.odds):String(r.odds);return '<div style="display:flex;justify-content:space-between;align-items:center;padding:.46rem .1rem;border-bottom:1px solid rgba(255,255,255,.06)"><span style="font-size:.85rem;font-weight:600">vs '+r.opponent+'</span><span class="bc" style="font-weight:800;font-size:1rem;color:'+(neg?'#00e668':'#ff9500')+'">'+v+'</span></div>';}).join('');

  function trow(date,opp,meta){return '<div style="display:flex;align-items:center;justify-content:space-between;gap:.75rem;padding:.55rem .1rem;border-bottom:1px solid rgba(255,255,255,.06)"><div style="min-width:0;flex:1 1 auto"><div style="font-size:.68rem;color:'+M+';text-transform:uppercase;letter-spacing:.04em">'+date+'</div><div style="font-weight:600;font-size:.85rem;margin-top:.05rem">'+opp+'</div><div style="font-size:.72rem;color:'+M+';margin-top:.1rem">'+meta+'</div></div><a style="display:inline-flex;align-items:center;gap:.3rem;padding:.25rem .7rem;background:rgba(255,0,0,.15);border:1px solid rgba(255,60,60,.35);border-radius:.4rem;color:#ff4444;font-size:.74rem;font-weight:600;white-space:nowrap">▶ Watch</a></div>';}
  var tape='<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">'+ava('paddy-pimblett','PP')+'<div><div style="font-weight:600;font-size:.92rem">Paddy Pimblett</div><div style="font-size:.72rem;color:'+M+'">Lightweight · 24-4-0</div></div></div>'
    +trow('Jul 11, 2026','def. Benoît Saint Denis','Submission · R1 · UFC 329')
    +trow('Jan 24, 2026','lost to Justin Gaethje','Decision · UFC 324')
    +trow('Apr 12, 2025','def. Michael Chandler','TKO · R3 · UFC 314')
    +trow('Jul 27, 2024','def. Bobby Green','Submission · R1 · UFC 304')
    +trow('Dec 16, 2023','def. Tony Ferguson','Decision · UFC 296');

  function bhead(){return '<div style="display:flex;align-items:center;justify-content:space-between;gap:.6rem;margin-bottom:.4rem"><div style="display:flex;align-items:center;gap:.5rem;flex:1;min-width:0">'+ava('islam-makhachev','IM')+'<span style="font-weight:800;font-size:.9rem">Islam Makhachev</span></div><div style="display:flex;align-items:center;gap:.5rem;flex:1;min-width:0;justify-content:flex-end"><span style="font-weight:800;font-size:.9rem">A. Volkanovski</span>'+ava('alexander-volkanovski','AV')+'</div></div>';}
  function bbar(lv,rv){var t=lv+rv;if(t<=0)return '';var lp=Math.max(8,Math.min(92,Math.round(100*lv/t)));if(lv===rv)lp=50;var lc=lv>=rv?A:'rgba(255,255,255,.18)',rc=rv>=lv?A:'rgba(255,255,255,.18)';return '<div style="display:flex;height:4px;border-radius:2px;overflow:hidden;background:rgba(255,255,255,.08);margin-top:2px"><div style="width:'+lp+'%;background:'+lc+'"></div><div style="width:'+(100-lp)+'%;background:'+rc+'"></div></div>';}
  function brow(lval,label,rval,lv,rv){return '<div style="padding:.16rem 0;border-bottom:1px solid rgba(255,255,255,.06)"><div style="display:flex;justify-content:space-between;align-items:baseline;gap:.6rem"><span style="font-weight:700;font-size:.76rem;min-width:50px">'+lval+'</span><span style="font-size:.56rem;letter-spacing:.05em;text-transform:uppercase;color:'+M+';white-space:nowrap">'+label+'</span><span style="font-weight:700;font-size:.76rem;min-width:50px;text-align:right">'+rval+'</span></div>'+bbar(lv,rv)+'</div>';}
  function bsec(t){return '<div style="margin:.4rem 0 .05rem;font-size:.56rem;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.34)">'+t+'</div>';}
  function bpct(a){return ' <span style="color:rgba(255,255,255,.4);font-size:.64rem">('+a+')</span>';}
  var box=bhead()
    +'<div style="text-align:center;margin-bottom:.45rem"><span style="font-size:.7rem;color:'+M+'">Feb 11, 2023 · UFC 284</span><div style="font-size:.72rem;color:'+A+';font-weight:700;margin-top:1px">Islam Makhachev by Unanimous Decision</div></div>'
    +brow('0','Knockdowns','1',0,1)
    +brow('57/95'+bpct('60%'),'Sig. Strikes','70/143'+bpct('49%'),57,70)
    +brow('95/135','Total Strikes','164/255',95,164)
    +brow('4/9','Takedowns','0/4',4,0)
    +brow('7:37','Control','2:55',457,175)
    +bsec('Sig. strikes by target')
    +brow('36/72','Head','37/96',36,37)
    +brow('18/20','Body','21/33',18,21)
    +brow('3/3','Leg','12/14',3,12)
    +bsec('Sig. strikes by position')
    +brow('45/82','Distance','58/125',45,58)
    +brow('12/13','Clinch','6/10',12,6)
    +brow('0/0','Ground','6/8',0,6);

  function arow(ic,txt){return '<div style="display:flex;gap:9px;align-items:flex-start;padding:.42rem 0;border-bottom:1px solid rgba(255,255,255,.06)"><span style="font-size:1rem;line-height:1.15;flex:0 0 auto">'+ic+'</span><span style="font-size:.82rem;line-height:1.35;color:rgba(255,255,255,.85)">'+txt+'</span></div>';}
  var acc='<div style="display:flex;align-items:center;gap:11px;margin-bottom:12px">'+ava('charles-oliveira','CO',false,34)+'<div><div style="font-weight:700;font-size:1rem">Charles Oliveira</div><div style="font-size:11px;color:'+M+'">Lightweight · 37-11-0</div></div></div>'
    +arow('🥋','Brazilian Jiu-Jitsu black belt · black prajied in Muay Thai')
    +arow('🏆','Former UFC Lightweight Champion (2021–22) · current UFC "BMF" Champion')
    +arow('🏅','UFC all-time records: most submission wins, most finishes (21) &amp; most fight-night bonuses (21)')
    +arow('🥊','37–11 (1 NC), 32 finishes (22 subs, 10 KO/TKO) — one of MMA’s most prolific finishers');

  function rr(n,name,rec,champ,slug,init){return '<div class="rrow'+(champ?' rchamp':'')+'"><span class="rnum">'+n+'</span>'+ava(slug,init,champ,26)+'<span class="rname">'+name+'</span><span class="rrec">'+rec+'</span>'+(champ?'<span class="rtag">Champion</span>':'')+'</div>';}
  var rank='<div class="bc" style="font-size:1.05rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;margin-bottom:.6rem">'+LD.rankings.division+' — Top 5</div><div style="display:flex;flex-direction:column;gap:.4rem">'
    +LD.rankings.rows.map(function(x){return rr(x.n,x.name,x.record,x.champ,x.slug,x.initials);}).join('')+'</div>';

  function rcol(title,color,items,total,first){var extra=total-items.length;return '<div style="'+(first?'':'margin-top:1.1rem;padding-top:1.1rem;border-top:1px solid rgba(255,255,255,.08)')+'"><div style="display:flex;align-items:center;gap:.45rem;font-size:.72rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:'+color+';margin-bottom:.6rem"><span>'+title+'</span><span style="background:'+color+'22;border-radius:999px;padding:.05rem .5rem;font-size:.7rem">'+total+'</span></div><div style="display:flex;flex-direction:column;gap:.4rem">'+(total?items.map(function(n){return '<div style="display:flex;align-items:center;gap:.55rem;font-size:.92rem"><span style="color:'+color+';font-size:.58rem">●</span><span>'+n+'</span></div>';}).join(''):'<div style="color:'+M+';font-size:.85rem">None</div>')+(extra>0?'<div style="color:'+M+';font-size:.8rem;padding-left:1.1rem">+'+extra+' more</div>':'')+'</div></div>';}
  var rNames=(LD.roster.names||[]),rExtra=(LD.roster.total||0)-rNames.length;
  var rosterAZ=rNames.length?'<div style="border:1px solid rgba(255,255,255,.1);border-radius:12px;background:rgba(255,255,255,.025);padding:1.1rem 1.3rem"><div style="display:flex;align-items:baseline;gap:.45rem;margin-bottom:.7rem"><span style="font-size:.72rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:rgba(255,255,255,.55)">Active roster</span><span style="font-size:.72rem;font-weight:800;color:'+A+'">'+(LD.roster.total||0)+' fighters</span></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:.3rem .9rem;font-size:.86rem;color:#fff">'+rNames.map(function(n){return '<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+n+'</span>';}).join('')+'</div>'+(rExtra>0?'<div style="color:'+M+';font-size:.8rem;margin-top:.55rem">+'+rExtra+' more, A\\u2013Z</div>':'')+'</div>':'';
  var roster='<div style="display:flex;flex-direction:column;gap:12px"><div style="border:1px solid rgba(255,255,255,.1);border-radius:12px;background:rgba(255,255,255,.025);padding:1.1rem 1.3rem"><div style="font-size:.8rem;font-weight:700;color:rgba(255,255,255,.55);margin-bottom:1rem">'+LD.roster.week+'</div>'
    +rcol('Added','#00e668',LD.roster.added,LD.roster.addedTotal,true)
    +rcol('Removed','#ff9500',LD.roster.removed,LD.roster.removedTotal,false)+'</div>'+rosterAZ+'</div>';

    // ── Parlay builder ────────────────────────────────────────────────────────
    // Real legs, real FanDuel method-of-victory prices, and a combined price that
    // multiplies the DECIMAL odds. Summing American odds is meaningless: +270 and
    // +700 are 3.70 and 8.00, not 970.
    var PB=LD.parlay;
    var parlay=PB?(
      '<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:10px">'
      +'<div style="font-weight:700;font-size:.95rem">'+PB.event+' parlay</div>'
      +'<div style="font-size:11px;color:'+M+';text-transform:uppercase;letter-spacing:.06em">'+PB.book+' · 3 legs</div>'
      +'</div>'
      +PB.legs.map(function(l){return ''
        +'<div style="display:flex;align-items:center;gap:9px;padding:8px 0;border-bottom:1px solid '+L+'">'
        +ava(l.slug,l.pick.split(' ').map(function(w){return w[0];}).join('').slice(0,2),false,26)
        +'<div style="flex:1;min-width:0">'
        +'<div style="font-size:12.5px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+l.pick+' '+l.label+'</div>'
        +'<div style="font-size:10.5px;color:'+M+'">vs '+l.opponent+'</div>'
        +'</div>'
        +'<div style="font-size:13px;font-weight:800;color:'+A+';font-variant-numeric:tabular-nums">'+l.odds+'</div>'
        +'</div>';}).join('')
      +'<div style="display:flex;align-items:center;justify-content:space-between;margin-top:11px">'
      +'<div><div style="font-size:10px;color:'+M+';text-transform:uppercase;letter-spacing:.07em">Parlay odds</div>'
      +'<div style="font-size:1.35rem;font-weight:850;color:'+A+';line-height:1.1">'+PB.combined+'</div></div>'
      +'<div style="text-align:right"><div style="font-size:10px;color:'+M+';text-transform:uppercase;letter-spacing:.07em">$'+PB.stake+' returns</div>'
      +'<div style="font-size:1.35rem;font-weight:850;line-height:1.1">$'+PB.payout.toLocaleString()+'</div></div>'
      +'</div>'
      +'<div style="font-size:10.5px;color:'+M+';margin-top:9px;line-height:1.45">Build a slip from any market, then re-price the identical slip at every other book.</div>'
    ):'';

    // ── Style / pace / path to victory ────────────────────────────────────────
    // Style, pace and both paths to victory come straight out of the app's own
    // renderMatchupBreakdown() — the generator runs it headlessly. Nothing here is
    // recomputed, so the slide and the Scouting Report cannot disagree.
    var SD=LD.styleDemo;
    function sdot(lean,col){return '<span style="position:absolute;top:50%;left:'+Math.max(2,Math.min(98,lean))+'%;transform:translate(-50%,-50%);width:11px;height:11px;border-radius:50%;background:'+col+';border:2px solid '+BG+'"></span>';}
    function pacebar(v,mx,col){return '<div style="flex:1;height:5px;border-radius:3px;background:rgba(255,255,255,.09);overflow:hidden"><div style="height:100%;width:'+Math.round(100*v/mx)+'%;background:'+col+'"></div></div>';}
    var style=SD?(function(){
      var mx=Math.max(SD.a.pace||0,SD.b.pace||0)||1;
      return ''
      +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">'
      +ava(SD.a.slug,SD.a.initials,false,30)
      +'<div style="flex:1;min-width:0"><div style="font-size:12.5px;font-weight:700">'+SD.a.name+'</div>'
      +'<div style="font-size:10.5px;color:'+M+'">'+SD.a.record+(SD.a.rank&&SD.a.rank!=='NR'?' · '+SD.a.rank:'')+'</div></div>'
      +'<div style="font-size:10.5px;color:'+M+';font-weight:800;letter-spacing:.08em">VS</div>'
      +'<div style="flex:1;min-width:0;text-align:right"><div style="font-size:12.5px;font-weight:700">'+SD.b.name+'</div>'
      +'<div style="font-size:10.5px;color:'+M+'">'+SD.b.record+(SD.b.rank&&SD.b.rank!=='NR'?' · '+SD.b.rank:'')+'</div></div>'
      +ava(SD.b.slug,SD.b.initials,false,30)
      +'</div>'
      +'<div style="font-size:10px;color:'+M+';text-transform:uppercase;letter-spacing:.08em;margin-bottom:15px">Style</div>'
      +'<div style="position:relative;height:6px;border-radius:3px;background:rgba(255,255,255,.09);margin-bottom:6px">'+sdot(SD.a.lean,A)+sdot(SD.b.lean,'#ffcf7a')+'</div>'
      +'<div style="display:flex;justify-content:space-between;font-size:9.5px;color:rgba(255,255,255,.32);text-transform:uppercase;letter-spacing:.06em">'
      +'<span>grappler</span><span>striker</span></div>'
      +'<div style="font-size:10px;color:'+M+';text-transform:uppercase;letter-spacing:.08em;margin:14px 0 8px">Pace · sig. strikes thrown / min</div>'
      +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span style="font-size:11px;width:74px;color:rgba(255,255,255,.75)">'+SD.a.name.split(' ').pop()+'</span>'+pacebar(SD.a.pace,mx,A)+'<span style="font-size:12px;font-weight:800;color:'+A+';width:34px;text-align:right">'+SD.a.pace+'</span></div>'
      +'<div style="display:flex;align-items:center;gap:8px"><span style="font-size:11px;width:74px;color:rgba(255,255,255,.75)">'+SD.b.name.split(' ').pop()+'</span>'+pacebar(SD.b.pace,mx,'#ffcf7a')+'<span style="font-size:12px;font-weight:800;color:#ffcf7a;width:34px;text-align:right">'+SD.b.pace+'</span></div>'
      +'<div style="font-size:10px;color:'+M+';text-transform:uppercase;letter-spacing:.08em;margin:15px 0 8px">Path to victory</div>'
      +[[SD.a,A],[SD.b,'#ffcf7a']].map(function(p){var f=p[0],c=p[1];
        return '<div style="border-left:2px solid '+c+';padding:2px 0 2px 9px;margin-bottom:8px">'
          +'<div style="font-size:11px;font-weight:750;color:'+c+'">'+f.name.split(' ').pop().toUpperCase()+'</div>'
          +'<div style="font-size:11px;color:rgba(255,255,255,.75);line-height:1.45">'+f.path+'</div></div>';}).join('');
    })():'';

  // ── Pick'em (free) ──────────────────────────────────────────────────────────
  // Mirrors the real Pick'em page: per-bout cards with two photo tiles, the picked
  // fighter highlighted green with a "✓ Your pick" flag, a colour-coded confidence
  // segment, and a points-at-stake foot. Only whitelisted thumbs are used so the
  // logged-out landing page can load them (else the initials fallback kicks in).
  function pkav(slug,init,sel){var ring=sel?A:'rgba(255,255,255,.14)';var base='width:48px;height:48px;border-radius:50%;overflow:hidden;border:2px solid '+ring+';background:#1b1e25;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.95rem;color:'+M+';flex:0 0 auto;';return slug?'<div style="'+base+'"><img src="/photos/thumb/'+slug+'.png" alt="" style="width:100%;height:100%;object-fit:cover;object-position:top center" onerror="this.parentNode.textContent=\\''+init+'\\'"></div>':'<div style="'+base+'">'+init+'</div>';}
  function pktile(slug,init,name,rec,sel){var sc=sel?'border-color:'+A+';background:rgba(0,230,104,.10);box-shadow:inset 0 0 0 1px '+A:'border-color:rgba(255,255,255,.12)';return '<div style="display:flex;flex-direction:column;align-items:center;gap:.32rem;background:rgba(255,255,255,.03);border:1.5px solid transparent;'+sc+';border-radius:11px;padding:.7rem .5rem;text-align:center">'+pkav(slug,init,sel)+'<div style="font-weight:600;font-size:.82rem;line-height:1.15">'+name+'</div><div style="font-size:.64rem;color:'+M+'">'+rec+'</div><div style="font-size:.55rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:'+A+';'+(sel?'':'visibility:hidden')+'">\\u2713 Your pick</div></div>';}
  function pkseg(l,sel){var c=l==='High'?'#00e668':l==='Med'?'#ffcf7a':'#8a8d94';var css=sel?'border-color:'+c+';background:'+c+'28;color:#fff':'border-color:var(--border);color:'+M;return '<div style="flex:1;text-align:center;background:rgba(255,255,255,.03);border:1px solid var(--border);border-radius:8px;padding:.32rem .3rem;font-size:.66rem;font-weight:700;'+css+'">'+l+'</div>';}
  function pkbout(wc,main,ta,tb,conf,pts,mr){return '<div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:.75rem .75rem .8rem;margin-bottom:.6rem">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.55rem">'
    +'<span style="font-size:.62rem;letter-spacing:.06em;text-transform:uppercase;color:'+M+';font-weight:600">'+wc+'</span>'
    +'<span style="font-size:.56rem;letter-spacing:.08em;text-transform:uppercase;color:'+A+';font-weight:700">'+main+'</span></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem">'+ta+tb+'</div>'
    +(conf?'<div style="display:flex;align-items:center;gap:.5rem;margin-top:.6rem"><span style="flex:0 0 4rem;font-size:.58rem;text-transform:uppercase;letter-spacing:.05em;color:'+M+';font-weight:600">Confidence</span><div style="display:flex;flex:1;gap:.3rem">'+pkseg('High',conf==='High')+pkseg('Med',conf==='Med')+pkseg('Low',conf==='Low')+'</div></div>':'')
    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-top:.6rem"><span style="font-size:.66rem;color:'+M+'">Points at stake <b style="color:'+A+'">+'+pts+'</b></span>'+(mr?'<span style="font-size:.6rem;color:'+M+'">'+mr+'</span>':'')+'</div>'
    +'</div>';}
  var pickem='<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:.65rem">'
    +'<div style="font-weight:700;font-size:.95rem">Your Pick\\u2019em card</div>'
    +'<div style="font-size:.68rem;color:'+M+'">Locks at prelims</div></div>'
    +pkbout('Welterweight','Main event',pktile('max-holloway','MH','Holloway','26-8-0',true),pktile('conor-mcgregor','CM','McGregor','22-6-0',false),'High',38,'KO/TKO \\u00b7 R2')
    +pkbout('Lightweight','Co-main',pktile('islam-makhachev','IM','Makhachev','27-1-0',true),pktile('alexander-volkanovski','AV','Volkanovski','26-4-0',false),'Med',24,'Decision')
    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-top:.55rem;padding-top:.6rem;border-top:1px solid rgba(255,255,255,.08);font-size:.8rem">'
    +'<span style="color:'+M+'">Live leaderboard</span>'
    +'<span><b>You</b> \\u00b7 #3 of 128 \\u00b7 <span style="color:'+A+'">+74 last card</span></span></div>';

  var slides=[
    {t:'Fight simulator',d:'Run any matchup through the tuned model — win probability plus how the fight ends.',h:sim},
    {t:'Box scores for every bout',d:'Full head-to-head box score — strikes, takedowns, control — for every UFC fight ever.',h:box},
    {t:'Career accolades',d:'Titles, belt ranks, records, and fight-night awards for every fighter.',h:acc},
    {t:'Style, pace & path to victory',d:'Where each fighter sits on the striker\u2013grappler spectrum, the pace they imply, and how each one wins.',h:style},
    {t:'Live odds & props',d:'Moneyline and round totals by book, plus method-of-victory and round props for each fighter.',h:odds},
    {t:'Bet & CLV tracker',d:'Log a bet before the bell and it grades itself off the result — record, ROI, units, and your closing-line value.',h:bets},
    {t:'Line movement',d:'Watch a bout’s odds move day by day, from open to now, across the whole market.',h:lm},
    {t:'Parlay builder',d:'Build a slip across any market, then re-price the identical slip at every other book.',h:parlay},
    {t:'Odds & line history',d:'Every fighter’s closing lines, bout by bout — favorites and underdogs at a glance.',h:ohist},
    {t:'One-click tape study',d:'Every fight in a fighter\\u2019s history links straight to the film.',h:tape},
    {t:'Detailed fighter analytics',d:'Career striking and grappling stats for every fighter — free on every lite profile.',h:analytics,f:1},
    {t:'Pick\\u2019em predictions',d:'Call every fight on the card, lock in before the prelims, then climb the live leaderboard — free.',h:pickem,f:1},
    {t:'Always-current rankings',d:'Official UFC division rankings, synced and updated after every event.',h:rank,f:1},
    {t:'Active roster tracker',d:'Signings and releases — the roster kept current, week by week.',h:roster,f:1}
  ].filter(function(s){return s.h;});   // a null payload drops its slide rather than rendering an empty stage

  var i=0,stg=document.getElementById('stg'),dt=document.getElementById('dt');
  var RM=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function keyact(el,fn){el.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();fn();}});}
  slides.forEach(function(_,k){var d=document.createElement('span');d.className='sc-dot';d.setAttribute('role','tab');d.setAttribute('tabindex','0');d.setAttribute('aria-label','Feature '+(k+1)+': '+slides[k].t);if(k===0)d.style.background=A;var pick=function(){i=k;render();reset();};d.onclick=pick;keyact(d,pick);dt.appendChild(d);});
  function render(){stg.style.opacity=0;setTimeout(function(){var s=slides[i];stg.innerHTML=s.h;document.getElementById('fl').textContent=s.t;document.getElementById('fd').textContent=s.d;var ft=document.getElementById('ft');if(ft){ft.textContent=s.f?'FREE':'PREMIUM';ft.className='sc-tag '+(s.f?'free':'prem');}Array.prototype.forEach.call(dt.children,function(c,k){c.style.background=(k===i?A:'rgba(255,255,255,.22)');c.setAttribute('aria-selected',k===i?'true':'false');});stg.style.opacity=1;},RM?0:220);}
  var timer;function reset(){clearInterval(timer);if(RM)return;timer=setInterval(function(){i=(i+1)%slides.length;render();},7000);}
  var nx=document.getElementById('nx'),pv=document.getElementById('pv');
  var next=function(){i=(i+1)%slides.length;render();reset();},prev=function(){i=(i-1+slides.length)%slides.length;render();reset();};
  nx.onclick=next;pv.onclick=prev;keyact(nx,next);keyact(pv,prev);

  render();reset();

  // Swipe left/right to change slides on touch devices.
  var stage=document.querySelector('.sc-stage'),tx=0,ty=0;
  stage.addEventListener('touchstart',function(e){var t=e.changedTouches[0];tx=t.clientX;ty=t.clientY;},{passive:true});
  stage.addEventListener('touchend',function(e){var t=e.changedTouches[0],dx=t.clientX-tx,dy=t.clientY-ty;if(Math.abs(dx)>40&&Math.abs(dx)>Math.abs(dy)){(dx<0?next:prev)();}},{passive:true});
  // Only auto-advance while the carousel is actually on screen.
  if('IntersectionObserver' in window){
    new IntersectionObserver(function(es){es.forEach(function(en){if(en.isIntersecting){reset();}else{clearInterval(timer);}});},{threshold:.2}).observe(document.querySelector('.showcase'));
  }
})();
</script>`;
}
