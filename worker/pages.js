/* Public HTML pages served by the Worker (landing, auth, subscribe, account).
   Self-contained (no gated assets) and on-brand with the app: dark + #00e668. */

const PRICE_LABEL = "$9.99 / month";   // display only — real price lives in Stripe

// Back-to-landing arrow, top-left (used on the signup + login pages).
const backLink = `<a class="back-link" href="/" aria-label="Back to home"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg><span>Back</span></a>`;

const shell = (title, body, extraJs = "") => `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  :root{--accent:#00e668;--bg:#0a0a0b;--card:#141416;--line:rgba(255,255,255,.09);--muted:rgba(255,255,255,.55)}
  *{box-sizing:border-box}
  html{background:var(--bg)}   /* dark behind the body so tall screens / iOS overscroll never show white */
  body{margin:0;background:radial-gradient(1200px 600px at 50% -10%,#15201a 0%,var(--bg) 55%);color:#fff;
       font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;min-height:100vh;min-height:100dvh}
  .wrap{max-width:440px;margin:0 auto;padding:2.5rem 1.25rem 4rem}
  .hero{max-width:760px;text-align:center;padding-top:1rem}
  .brand{font-weight:900;letter-spacing:.14em;font-size:1rem}
  .brand .a{color:var(--accent)}
  h1{font-size:2.15rem;line-height:1.1;margin:1.4rem 0 .6rem;font-weight:850}
  h1 .a{color:var(--accent)}
  .sub{color:var(--muted);font-size:1.02rem;max-width:520px;margin:0 auto 1.6rem}
  .card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:1.4rem 1.3rem;margin:1.25rem auto 0;max-width:440px}
  label{display:block;font-size:.8rem;color:var(--muted);margin:.85rem 0 .3rem;font-weight:600}
  input{width:100%;padding:.7rem .8rem;background:#0e0e10;border:1px solid var(--line);border-radius:9px;color:#fff;font-size:1rem}
  input:focus{outline:none;border-color:var(--accent)}
  button,.btn{display:inline-block;width:100%;text-align:center;margin-top:1.1rem;padding:.8rem 1rem;border:0;border-radius:10px;
       background:var(--accent);color:#04120a;font-weight:800;font-size:1rem;cursor:pointer;text-decoration:none}
  .btn.ghost{background:transparent;color:#fff;border:1px solid var(--line);font-weight:600}
  .row{display:flex;gap:.75rem;justify-content:center;flex-wrap:wrap;margin-top:1.6rem}
  .row .btn{width:auto;padding:.8rem 1.5rem}
  .muted{color:var(--muted)} .center{text-align:center}
  a{color:var(--accent)}
  .msg{margin-top:.9rem;font-size:.88rem;min-height:1.1em}
  .msg.err{color:#ff6a5e} .msg.ok{color:var(--accent)}
  .alt{margin-top:1rem;text-align:center;font-size:.88rem}
  .feat{display:grid;gap:.55rem;text-align:left;max-width:360px;margin:1.4rem auto 0;color:rgba(255,255,255,.8);font-size:.95rem}
  .feat div::before{content:"✓ ";color:var(--accent);font-weight:900}
  .price{font-weight:800;color:var(--accent)}
  hr.or{border:0;border-top:1px solid var(--line);margin:1.4rem 0 .2rem;position:relative}
  hr.or::after{content:"or";position:absolute;top:-.7em;left:50%;transform:translateX(-50%);background:var(--card);padding:0 .6rem;color:var(--muted);font-size:.8rem}
  /* Smooth page-to-page: fade in on load, fade out before navigating away */
  .wrap{animation:glPageIn .2s ease both}
  @keyframes glPageIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
  body{transition:opacity .13s ease}
  body.leaving{opacity:0}
  @media (prefers-reduced-motion: reduce){.wrap{animation:none}body{transition:none}}
  /* Only widen the landing on large displays; normal screens keep the original layout. */
  @media (min-width:1650px){.wrap{max-width:900px}}
  .back-link{position:fixed;top:1.1rem;left:1.1rem;display:inline-flex;align-items:center;gap:.35rem;color:var(--muted);text-decoration:none;font-size:.85rem;z-index:10;transition:color .15s}
  .back-link:hover{color:#fff}
  .back-link svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
</style></head><body><div class="wrap">${body}</div>
<script>
function post(url, data){return fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)}).then(r=>r.json());}
function wire(formId, url, msgId, okMsg){
  var f=document.getElementById(formId); if(!f)return;
  f.addEventListener("submit",function(e){e.preventDefault();
    var m=document.getElementById(msgId); m.className="msg"; m.textContent="Working…";
    var data={}; new FormData(f).forEach((v,k)=>data[k]=v);
    post(url,data).then(function(r){
      if(r.error){m.className="msg err";m.textContent=r.error;return;}
      if(r.redirect){document.body.classList.add("leaving");setTimeout(function(){window.location=r.redirect;},130);return;}
      if(r.ok){m.className="msg ok";m.textContent=okMsg||"If an account exists for that email, a sign-in link is on its way — check your inbox. New here? Create an account below.";}
    }).catch(function(){m.className="msg err";m.textContent="Network error — try again.";});
  });
}
// Fade out before internal navigations so page-to-page feels smooth, not abrupt.
document.addEventListener("click",function(e){
  var a=e.target.closest&&e.target.closest("a[href]"); if(!a)return;
  var href=a.getAttribute("href");
  if(!href||href.charAt(0)!=="/"||a.target==="_blank"||e.metaKey||e.ctrlKey||e.shiftKey||e.button)return;
  e.preventDefault(); document.body.classList.add("leaving");
  setTimeout(function(){window.location=href;},130);
});
${extraJs}
</script></body></html>`;

// Full marketing landing page. Standalone (does NOT use shell()) so it can run
// its own full-width layout, the feature carousel, and the Barlow Condensed type
// that matches the app — while the auth/subscribe pages keep the compact shell.
// Feature previews are faithful recreations of the real in-app components
// (stat cards, simulator, odds table, tape rows, box score, rankings, roster).
export const landingPage = () => `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>GillyLab — The Ultimate UFC Analytics Database</title>
<meta name="description" content="Deep analytics for every UFC fighter and every bout, a fight simulator that predicts winner and method, live odds, one-click tape study, box scores, rankings, and weekly roster updates.">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;900&display=swap" rel="stylesheet">
<style>
  :root{--accent:#00e668;--accent2:#ff3d00;--bg:#0a0a0b;--card:#14141a;--border:#2a2a32;--muted:#666672;--surface2:#18181d}
  *{box-sizing:border-box}
  html{background:var(--bg)}
  body{margin:0;background:radial-gradient(1100px 520px at 50% -6%,#12251b 0%,var(--bg) 52%);color:#fff;
       font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;min-height:100vh;-webkit-font-smoothing:antialiased;
       animation:lpin .3s ease both}
  @keyframes lpin{from{opacity:0}to{opacity:1}}
  body.lp-out{opacity:0;transition:opacity .15s ease}
  @media (prefers-reduced-motion: reduce){body{animation:none}body.lp-out{transition:none}}
  a{text-decoration:none;color:inherit}
  .bc{font-family:'Barlow Condensed',sans-serif}
  .lp{max-width:1200px;margin:0 auto;padding:0 24px}
  nav.lpnav{display:flex;align-items:center;justify-content:space-between;padding:22px 0}
  .brand{font-weight:900;letter-spacing:.15em;font-size:16px}
  .brand .a{color:var(--accent)}
  .nav-cta{display:flex;gap:10px;align-items:center}
  .btn-primary{font-size:14px;font-weight:800;color:#04120a;background:var(--accent);border-radius:10px;padding:10px 16px;display:inline-block}
  .btn-primary:hover{background:#12f277}
  .btn-ghost{font-size:14px;color:rgba(255,255,255,.75);padding:9px 12px;border-radius:10px}
  .btn-ghost:hover{color:#fff}
  .hero{text-align:center;max-width:700px;margin:14px auto 0;padding-top:8px}
  .badge{display:inline-block;font-size:11px;letter-spacing:.08em;color:var(--accent);background:rgba(0,230,104,.1);border:1px solid rgba(0,230,104,.25);border-radius:100px;padding:6px 14px;margin-bottom:18px}
  h1.hh{font-size:46px;line-height:1.05;font-weight:850;letter-spacing:-.015em;margin:0}
  h1.hh .a{color:var(--accent)}
  .sub{color:rgba(255,255,255,.62);font-size:16px;max-width:530px;margin:16px auto 0}
  .stats{display:flex;gap:36px;justify-content:center;margin:26px 0 6px}
  .stat .n{font-size:26px;font-weight:850;color:var(--accent)}
  .stat .l{font-size:12px;color:rgba(255,255,255,.5)}
  .hero-cta{display:flex;gap:12px;justify-content:center;margin-top:24px;flex-wrap:wrap;align-items:center}
  .big{font-size:15px;font-weight:800;color:#04120a;background:var(--accent);border-radius:11px;padding:13px 22px;display:inline-block}
  .big:hover{background:#12f277}
  .big.ghost{background:transparent;color:#fff;border:1px solid var(--border)}
  .big.ghost:hover{border-color:#fff;background:transparent}
  .showcase{max-width:620px;margin:44px auto 0}
  .sc-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
  .sc-title{font-size:14px;font-weight:700}
  .sc-nav{display:flex;gap:8px}
  .sc-arrow{cursor:pointer;width:30px;height:30px;border-radius:8px;border:1px solid rgba(255,255,255,.14);display:flex;align-items:center;justify-content:center;font-size:16px;color:#fff;user-select:none}
  .sc-arrow:hover{border-color:var(--accent);color:var(--accent)}
  .sc-stage{background:#0d0d10;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:20px;min-height:344px}
  #stg{transition:opacity .18s ease}
  .sc-dots{display:flex;gap:7px;justify-content:center;margin-top:14px}
  .sc-dot{width:7px;height:7px;border-radius:50%;cursor:pointer;background:rgba(255,255,255,.22)}
  .sc-desc{text-align:center;color:rgba(255,255,255,.55);font-size:13px;margin:10px auto 0;max-width:470px;min-height:2.4em}
  .egrid{max-width:1040px;margin:58px auto 0}
  .egrid-title{text-align:center;font-size:12px;letter-spacing:.06em;color:rgba(255,255,255,.4);margin-bottom:20px}
  .egrid-cards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
  .ecard{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px}
  .ecard h3{font-size:14px;font-weight:800;margin:10px 0 4px}
  .ecard p{font-size:12px;color:rgba(255,255,255,.5);line-height:1.45;margin:0}
  .foot{text-align:center;margin:52px auto 0;padding-bottom:60px}
  .foot .fine{font-size:12px;color:rgba(255,255,255,.45);margin-top:14px}
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
  @media (max-width:760px){
    h1.hh{font-size:34px}
    .egrid-cards{grid-template-columns:repeat(2,1fr)}
    .stats{gap:24px}
    .nav-cta .btn-primary{display:none}
  }
</style></head><body>
<div class="lp">
  <nav class="lpnav">
    <div class="brand">GILLY<span class="a">LAB</span></div>
    <div class="nav-cta">
      <a class="btn-ghost" href="/login">Log in</a>
      <a class="btn-primary" href="/signup">Get access</a>
    </div>
  </nav>

  <header class="hero">
    <div class="badge">EVERY FIGHTER · EVERY FIGHT · EVERY BOX SCORE</div>
    <h1 class="hh">The Ultimate <span class="a">UFC</span><br>Analytics Database</h1>
    <p class="sub">Deep analytics for every fighter and every bout, a fight simulator that predicts winner and method, live odds, one-click tape study, and weekly roster updates — all in one place.</p>
    <div class="stats">
      <div class="stat"><div class="n">3,000+</div><div class="l">fighters</div></div>
      <div class="stat"><div class="n">18,000+</div><div class="l">bouts</div></div>
      <div class="stat"><div class="n">50,000+</div><div class="l">simulations</div></div>
    </div>
    <div class="hero-cta">
      <a class="big" href="/signup">Get access — ${PRICE_LABEL}</a>
      <a class="big ghost" href="/login">Log in</a>
    </div>
  </header>

  <section class="showcase">
    <div class="sc-head">
      <div class="sc-title" id="fl">Detailed fighter analytics</div>
      <div class="sc-nav"><span class="sc-arrow" id="pv">‹</span><span class="sc-arrow" id="nx">›</span></div>
    </div>
    <div class="sc-stage"><div id="stg"></div></div>
    <div class="sc-dots" id="dt"></div>
    <p class="sc-desc" id="fd"></p>
  </section>

  <section class="egrid">
    <div class="egrid-title">EVERYTHING INSIDE</div>
    <div class="egrid-cards" id="grid"></div>
  </section>

  <footer class="foot">
    <a class="big" href="/signup">Get access — ${PRICE_LABEL}</a>
    <div class="fine">Cancel anytime · Secure checkout by Stripe</div>
  </footer>
</div>

<script>
(function(){
  var A="#00e668",M="var(--muted)",L="rgba(255,255,255,.09)",BG="#0a0a0b";
  // Real database thumbnails (served publicly via the Worker's LANDING_PHOTOS
  // allow-list); initials render if an image is ever unavailable.
  function ava(slug,init,gold){
    var ring=gold?"#ffb340":A;
    var base="width:34px;height:34px;border-radius:50%;overflow:hidden;border:2px solid "+ring+";flex:0 0 auto;background:#1a1a1a;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;color:#fff;";
    if(!slug)return '<div style="'+base+'">'+init+'</div>';
    return '<div style="'+base+'"><img src="/photos/thumb/'+slug+'.png" alt="'+init+'" style="width:100%;height:100%;object-fit:cover;object-position:top center" onerror="this.parentNode.textContent=\\''+init+'\\'"></div>';
  }

  var analytics='<div style="display:flex;align-items:center;gap:11px;margin-bottom:14px">'+ava('ilia-topuria','IT')+'<div><div class="bc" style="font-weight:700;font-size:1.25rem;letter-spacing:.03em;text-transform:uppercase">Ilia Topuria</div><div style="font-size:11px;color:'+M+'">Featherweight / Lightweight · 17-0-0 · <span style="color:#ffb340">Champion</span></div></div></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">'
    +[['Strikes Landed / Min','4.82'],['Striking Accuracy','50%'],['Knockdowns / 15','1.15'],['Striking Defense','62%'],['Takedown Defense','95%'],['Finish Rate','88%']].map(function(s){
      return '<div class="statc"><div class="statc-l">'+s[0]+'</div><div class="statc-v">'+s[1]+'</div></div>';}).join('')+'</div>';

  function mrows(rows){return rows.map(function(r){return '<div style="display:flex;align-items:center;gap:7px;margin:5px 0"><div style="width:66px;font-size:10.5px;color:'+M+'">'+r[0]+'</div><div style="flex:1;height:6px;background:'+BG+';border-radius:4px;overflow:hidden"><div style="width:'+r[1]+'%;height:100%;background:'+A+'"></div></div><div style="width:28px;text-align:right;font-size:10.5px;font-weight:700">'+r[1]+'%</div></div>';}).join('');}
  function shead(av,name,count,pct,lead){return '<div style="display:flex;align-items:center;justify-content:space-between;margin:3px 0"><div style="display:flex;align-items:center;gap:9px">'+av+'<div><div style="font-weight:700;font-size:13px">'+name+'</div><div style="font-size:10.5px;color:'+M+'">'+count+'</div></div></div><div class="bc" style="font-size:22px;font-weight:900;color:'+(lead?A:'#fff')+'">'+pct+'%</div></div>';}
  var sim=shead(ava('jon-jones','JJ'),'Jon Jones','5,410 / 10,000 wins','54',true)
    +'<div style="height:8px;background:var(--surface2);border-radius:4px;overflow:hidden;display:flex;margin:8px 0"><div style="width:54%;height:100%;background:'+A+'"></div><div style="flex:1;background:'+M+'"></div></div>'
    +shead(ava('tom-aspinall','TA'),'Tom Aspinall','4,590 / 10,000 wins','46',false)
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:14px">'
    +'<div><div class="bc" style="font-size:11px;font-weight:700;color:'+M+';text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px">Jones — method of victory</div>'+mrows([['KO/TKO',28],['Submission',22],['Decision',50]])+'</div>'
    +'<div><div class="bc" style="font-size:11px;font-weight:700;color:'+M+';text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px">Aspinall — method of victory</div>'+mrows([['KO/TKO',71],['Submission',20],['Decision',9]])+'</div></div>'
    +'<div style="display:flex;align-items:center;margin-top:14px;padding-top:12px;border-top:1px solid '+L+'"><div style="flex:1;text-align:center"><div style="font-size:10px;color:'+M+';text-transform:uppercase;letter-spacing:.1em">Power Score</div><div class="bc" style="font-size:19px;font-weight:900;color:'+A+'">91.2</div></div><div style="width:1px;height:30px;background:'+L+'"></div><div style="flex:1;text-align:center"><div style="font-size:10px;color:'+M+';text-transform:uppercase;letter-spacing:.1em">Power Score</div><div class="bc" style="font-size:19px;font-weight:900">89.7</div></div></div>'
    +'<div style="font-size:10px;color:'+M+';text-align:center;margin-top:8px;line-height:1.4">Composite of striking output/defense, grappling &amp; finishing rate, and recent form — drives the win-probability estimate above.</div>';

  function odd(v){var neg=v.charAt(0)==='-';return '<span class="bc" style="font-weight:700;font-size:1rem;min-width:46px;text-align:center;color:'+(neg?'#4cff8a':'#ff3d00')+'">'+v+'</span>';}
  function obout(fA,oA,fB,oB){return '<div style="display:flex;align-items:center;padding:.6rem .2rem;border-bottom:1px solid '+L+';font-size:.86rem">'
    +'<span style="flex:1;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+fA+'</span>'+odd(oA)
    +'<span style="color:'+M+';font-size:.68rem;padding:0 .5rem">vs</span>'+odd(oB)
    +'<span style="flex:1;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+fB+'</span></div>';}
  var odds='<div style="font-size:11px;color:'+M+';margin-bottom:8px">UFC 300 · Apr 13, 2024 — closing moneylines</div>'
    +obout('Alex Pereira','-130','Jamahal Hill','+118')
    +obout('Zhang Weili','-500','Yan Xiaonan','+390')
    +obout('Justin Gaethje','-150','Max Holloway','+143')
    +obout('Arman Tsarukyan','-210','Charles Oliveira','+173');

  function trow(date,opp,meta){return '<div style="display:flex;align-items:center;justify-content:space-between;gap:.75rem;padding:.55rem .1rem;border-bottom:1px solid rgba(255,255,255,.06)"><div style="min-width:0;flex:1 1 auto"><div style="font-size:.68rem;color:'+M+';text-transform:uppercase;letter-spacing:.04em">'+date+'</div><div style="font-weight:600;font-size:.85rem;margin-top:.05rem">'+opp+'</div><div style="font-size:.72rem;color:'+M+';margin-top:.1rem">'+meta+'</div></div><a style="display:inline-flex;align-items:center;gap:.3rem;padding:.25rem .7rem;background:rgba(255,0,0,.15);border:1px solid rgba(255,60,60,.35);border-radius:.4rem;color:#ff4444;font-size:.74rem;font-weight:600;white-space:nowrap">▶ Watch</a></div>';}
  var tape='<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">'+ava('alex-pereira','AP')+'<div><div style="font-weight:600;font-size:.92rem">Alex Pereira</div><div style="font-size:.72rem;color:'+M+'">Light Heavyweight · 12-3-0</div></div></div>'
    +trow('Oct 5, 2024','def. Khalil Rountree Jr.','KO/TKO · R4 · UFC 307')
    +trow('Jun 8, 2024','def. Jiří Procházka','KO/TKO · R2 · UFC 303')
    +trow('Apr 13, 2024','def. Jamahal Hill','KO/TKO · R1 · UFC 300')
    +trow('Jul 29, 2023','def. Jan Błachowicz','Decision · UFC 291');

  function bhead(){return '<div style="display:flex;align-items:center;justify-content:space-between;gap:.6rem;margin-bottom:.4rem"><div style="display:flex;align-items:center;gap:.5rem;flex:1;min-width:0">'+ava('islam-makhachev','IM')+'<span style="font-weight:800;font-size:.9rem">Islam Makhachev</span></div><div style="display:flex;align-items:center;gap:.5rem;flex:1;min-width:0;justify-content:flex-end"><span style="font-weight:800;font-size:.9rem">A. Volkanovski</span>'+ava('alexander-volkanovski','AV')+'</div></div>';}
  function bbar(lv,rv){var t=lv+rv;if(t<=0)return '';var lp=Math.max(8,Math.min(92,Math.round(100*lv/t)));if(lv===rv)lp=50;var lc=lv>=rv?A:'rgba(255,255,255,.18)',rc=rv>=lv?A:'rgba(255,255,255,.18)';return '<div style="display:flex;height:5px;border-radius:3px;overflow:hidden;background:rgba(255,255,255,.08);margin-top:4px"><div style="width:'+lp+'%;background:'+lc+'"></div><div style="width:'+(100-lp)+'%;background:'+rc+'"></div></div>';}
  function brow(lval,label,rval,lv,rv){return '<div style="padding:.42rem 0;border-bottom:1px solid rgba(255,255,255,.06)"><div style="display:flex;justify-content:space-between;align-items:baseline;gap:.75rem"><span style="font-weight:700;font-size:.86rem;min-width:56px">'+lval+'</span><span style="font-size:.62rem;letter-spacing:.07em;text-transform:uppercase;color:'+M+';white-space:nowrap">'+label+'</span><span style="font-weight:700;font-size:.86rem;min-width:56px;text-align:right">'+rval+'</span></div>'+bbar(lv,rv)+'</div>';}
  var box=bhead()
    +'<div style="text-align:center;margin-bottom:.6rem"><span style="font-size:.72rem;color:'+M+'">Feb 11, 2023 · UFC 284</span><div style="font-size:.74rem;color:'+A+';font-weight:700;margin-top:2px">Islam Makhachev by Unanimous Decision</div></div>'
    +brow('0','Knockdowns','1',0,1)
    +brow('57/95 <span style="color:rgba(255,255,255,.4);font-size:.72rem">(60%)</span>','Sig. Strikes','70/143 <span style="color:rgba(255,255,255,.4);font-size:.72rem">(49%)</span>',57,70)
    +brow('95/135','Total Strikes','164/255',95,164)
    +brow('4/9','Takedowns','0/4',4,0)
    +brow('7:37','Control','2:55',457,175);

  function rr(n,name,rec,move,mv,champ){return '<div class="rrow'+(champ?' rchamp':'')+'"><span class="rnum">'+n+'</span><span class="rname">'+name+'</span><span class="rrec">'+rec+'</span>'+(move?'<span class="rmove '+mv+'">'+move+'</span>':(champ?'<span class="rtag">Champion</span>':''))+'</div>';}
  var rank='<div class="bc" style="font-size:1.05rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;margin-bottom:.6rem">Bantamweight — Top 5</div><div style="display:flex;flex-direction:column;gap:.4rem">'
    +rr('C','Petr Yan','20-5-0','','',true)
    +rr('1','Merab Dvalishvili','21-5-0','','')
    +rr('2',"Sean O'Malley",'19-3-0','','')
    +rr('3','Umar Nurmagomedov','20-1-0','','')
    +rr('4','Cory Sandhagen','18-6-0','','')
    +rr('5','Song Yadong','23-9-1','','')+'</div>';

  function rcol(title,color,items,first){return '<div style="'+(first?'':'margin-top:1.1rem;padding-top:1.1rem;border-top:1px solid rgba(255,255,255,.08)')+'"><div style="display:flex;align-items:center;gap:.45rem;font-size:.72rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:'+color+';margin-bottom:.6rem"><span>'+title+'</span><span style="background:'+color+'22;border-radius:999px;padding:.05rem .5rem;font-size:.7rem">'+items.length+'</span></div><div style="display:flex;flex-direction:column;gap:.4rem">'+items.map(function(n){return '<div style="display:flex;align-items:center;gap:.55rem;font-size:.92rem"><span style="color:'+color+';font-size:.58rem">●</span><span>'+n+'</span></div>';}).join('')+'</div></div>';}
  var roster='<div style="border:1px solid rgba(255,255,255,.1);border-radius:12px;background:rgba(255,255,255,.025);padding:1.1rem 1.3rem"><div style="font-size:.8rem;font-weight:700;color:rgba(255,255,255,.55);margin-bottom:1rem">Week of Jun 30 – Jul 6, 2026</div>'
    +rcol('Added','#00e668',['Diego Marreta','Yuki Tanaka','Aisha Campbell'],true)
    +rcol('Removed','#ff9500',['Corey Blakewood','Frank Ostrowski'],false)+'</div>';

  var slides=[
    {t:'Detailed fighter analytics',d:'Career striking and grappling stats for every fighter — champions to prospects.',h:analytics},
    {t:'Fight simulator',d:'Run any matchup through the tuned model — win probability plus how the finish comes.',h:sim},
    {t:'Live odds for every card',d:'Live moneylines for every upcoming bout, plus closing lines on every past card.',h:odds},
    {t:'One-click tape study',d:'Every fight in a fighter\\u2019s history links straight to the film.',h:tape},
    {t:'Box scores for every bout',d:'Full head-to-head box score — strikes, takedowns, control — for every UFC fight ever.',h:box},
    {t:'Always-current rankings',d:'Official UFC division rankings, synced and updated after every event.',h:rank},
    {t:'Active roster tracker',d:'Signings and releases — the roster kept current, week by week.',h:roster}
  ];

  var i=0,stg=document.getElementById('stg'),dt=document.getElementById('dt');
  slides.forEach(function(_,k){var d=document.createElement('span');d.className='sc-dot';if(k===0)d.style.background=A;d.onclick=function(){i=k;render();reset();};dt.appendChild(d);});
  function render(){stg.style.opacity=0;setTimeout(function(){stg.innerHTML=slides[i].h;document.getElementById('fl').textContent=slides[i].t;document.getElementById('fd').textContent=slides[i].d;Array.prototype.forEach.call(dt.children,function(c,k){c.style.background=(k===i?A:'rgba(255,255,255,.22)');});stg.style.opacity=1;},150);}
  var timer;function reset(){clearInterval(timer);timer=setInterval(function(){i=(i+1)%slides.length;render();},4200);}
  document.getElementById('nx').onclick=function(){i=(i+1)%slides.length;render();reset();};
  document.getElementById('pv').onclick=function(){i=(i-1+slides.length)%slides.length;render();reset();};

  var sv='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00e668" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';
  var ic={c:sv+'<path d="M3 3v18h18"/><rect x="7" y="10" width="3" height="7"/><rect x="12" y="6" width="3" height="11"/><rect x="17" y="13" width="3" height="4"/></svg>',s:sv+'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/></svg>',o:sv+'<path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',t:sv+'<circle cx="12" cy="12" r="9"/><path d="M10 8l6 4-6 4z" fill="#00e668"/></svg>',b:sv+'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>',r:sv+'<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 4H4v2a3 3 0 0 0 3 3M17 4h3v2a3 3 0 0 1-3 3"/></svg>',u:sv+'<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0M17 11l2 2 3-3"/></svg>',f:sv+'<circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>'};
  var cards=[[ic.c,'Fighter analytics','Full career stats for all 3,000+ fighters'],[ic.s,'Fight simulator','Predicts the winner and the method up to 50,000 times'],[ic.o,'Live odds','Moneyline, round O/U, method props and round prop odds for every upcoming fight'],[ic.t,'Tape study','One click from any fight to the film'],[ic.b,'Box scores','Head-to-head data for every bout ever'],[ic.r,'Rankings','Updated after every event'],[ic.u,'Roster tracker','Weekly signings and cuts'],[ic.f,'Instant search','See detailed analytics for any fighter, past or present, with a quick search']];
  document.getElementById('grid').innerHTML=cards.map(function(c){return '<div class="ecard">'+c[0]+'<h3>'+c[1]+'</h3><p>'+c[2]+'</p></div>';}).join('');

  render();reset();

  document.addEventListener('click',function(e){
    var a=e.target.closest&&e.target.closest('a[href^="/"]');
    if(!a)return;var href=a.getAttribute('href');
    if(!href||a.target==='_blank'||e.metaKey||e.ctrlKey||e.shiftKey||e.button)return;
    e.preventDefault();document.body.classList.add('lp-out');setTimeout(function(){window.location=href;},150);
  });
})();
</script></body></html>`;

export const signupPage = () => shell("Create your GillyLab account", `
  ${backLink}
  <div class="center"><div class="brand">GILLY<span class="a">LAB</span></div></div>
  <div class="card">
    <h1 style="font-size:1.4rem;text-align:center">Create your account</h1>
    <p class="muted center" style="margin:.2rem 0 0;font-size:.9rem">Then continue to secure checkout (${PRICE_LABEL}).</p>
    <form id="f">
      <label>Email</label><input name="email" type="email" autocomplete="email" required>
      <label>Password</label><input name="password" type="password" autocomplete="new-password" minlength="8" required placeholder="at least 8 characters">
      <button type="submit">Continue to payment →</button>
      <div id="m" class="msg"></div>
    </form>
    <div class="alt muted">Already a member? <a href="/login">Log in</a></div>
  </div>`, `wire("f","/api/signup","m");`);

export const loginPage = () => shell("Log in to GillyLab", `
  ${backLink}
  <div class="center"><div class="brand">GILLY<span class="a">LAB</span></div></div>
  <div class="card">
    <h1 style="font-size:1.4rem;text-align:center">Log in</h1>
    <form id="f">
      <label>Email</label><input name="email" type="email" autocomplete="email" required>
      <label>Password</label><input name="password" type="password" autocomplete="current-password" required>
      <button type="submit">Log in</button>
      <div id="m" class="msg"></div>
    </form>
    <p class="muted center" style="font-size:.82rem;margin:.55rem 0 0"><a href="/forgot">Forgot your password?</a></p>
    <hr class="or">
    <form id="mf">
      <p class="muted center" style="font-size:.88rem;margin:.6rem 0 0">Log in a different way — we'll email you a one-click link.</p>
      <label>Email</label><input name="email" type="email" autocomplete="email" required>
      <button type="submit" class="ghost" style="background:transparent;border:1px solid var(--line);color:#fff">Email me a sign-in link</button>
      <div id="mm" class="msg"></div>
    </form>
    <div class="alt muted">New here? <a href="/signup">Create an account</a></div>
  </div>`, `wire("f","/api/login","m"); wire("mf","/api/magic/start","mm");`);

export const subscribePage = (canceled) => shell("Subscribe — GillyLab", `
  <div class="center"><div class="brand">GILLY<span class="a">LAB</span></div></div>
  <div class="card center">
    <h1 style="font-size:1.4rem">${canceled ? "Checkout canceled" : "One step left"}</h1>
    <p class="muted">Your account is ready — start your subscription to unlock the full database.</p>
    <p class="price" style="font-size:1.2rem;margin:.6rem 0">${PRICE_LABEL}</p>
    <button id="go">Subscribe with Stripe →</button>
    <div id="m" class="msg"></div>
    <div class="alt"><a href="/api/logout">Log out</a></div>
  </div>`, `
  document.getElementById("go").addEventListener("click",function(){
    var m=document.getElementById("m"); m.className="msg"; m.textContent="Redirecting to secure checkout…";
    post("/api/checkout",{}).then(function(r){ if(r.redirect){window.location=r.redirect;} else {m.className="msg err";m.textContent=r.error||"Error";}});
  });`);

export const accountPage = (email, subscribed) => shell("Account — GillyLab", `
  <div class="center"><div class="brand">GILLY<span class="a">LAB</span></div></div>
  <div class="card">
    <h1 style="font-size:1.4rem;text-align:center">Account</h1>
    <p class="muted">Signed in as <strong style="color:#fff">${email}</strong></p>
    <p>Subscription: <strong style="color:${subscribed ? "var(--accent)" : "#ff6a5e"}">${subscribed ? "Active" : "Inactive"}</strong></p>
    ${subscribed ? `<a class="btn" href="/">Open GillyLab →</a>
    <a class="btn ghost" href="/api/portal">Manage subscription &amp; billing</a>` : `<a class="btn" href="/subscribe">Subscribe →</a>`}
    <a class="btn ghost" href="/api/logout">Log out</a>
  </div>`);

export const changePasswordPage = () => shell("Change password — GillyLab", `
  ${backLink}
  <div class="center"><div class="brand">GILLY<span class="a">LAB</span></div></div>
  <div class="card">
    <h1 style="font-size:1.4rem;text-align:center">Change password</h1>
    <form id="f">
      <label>Current password</label><input name="current" type="password" autocomplete="current-password" required>
      <label>New password</label><input name="password" type="password" autocomplete="new-password" minlength="8" required placeholder="at least 8 characters">
      <button type="submit">Update password</button>
      <div id="m" class="msg"></div>
    </form>
    <div class="alt muted"><a href="/">Back to GillyLab</a></div>
  </div>`, `wire("f","/api/change-password","m","Password updated.");`);

export const forgotPasswordPage = () => shell("Reset your password — GillyLab", `
  ${backLink}
  <div class="center"><div class="brand">GILLY<span class="a">LAB</span></div></div>
  <div class="card">
    <h1 style="font-size:1.4rem;text-align:center">Reset password</h1>
    <p class="muted center" style="margin:.2rem 0 0;font-size:.9rem">Enter your email and we'll send you a link to set a new password.</p>
    <form id="f">
      <label>Email</label><input name="email" type="email" autocomplete="email" required>
      <button type="submit">Email me a reset link</button>
      <div id="m" class="msg"></div>
    </form>
    <div class="alt muted"><a href="/login">Back to log in</a></div>
  </div>`, `wire("f","/api/reset/start","m","If an account exists for that email, a reset link is on its way — check your inbox.");`);

export const resetPasswordPage = (token) => shell("Set a new password — GillyLab", `
  <div class="center"><div class="brand">GILLY<span class="a">LAB</span></div></div>
  <div class="card">
    <h1 style="font-size:1.4rem;text-align:center">Set a new password</h1>
    <form id="f">
      <input type="hidden" name="token" value="${String(token).replace(/"/g, "&quot;")}">
      <label>New password</label><input name="password" type="password" autocomplete="new-password" minlength="8" required placeholder="at least 8 characters">
      <button type="submit">Set password &amp; sign in</button>
      <div id="m" class="msg"></div>
    </form>
    <div class="alt muted"><a href="/login">Back to log in</a></div>
  </div>`, `wire("f","/api/reset/complete","m");`);

export const notePage = (title, msg) => shell(title, `
  <div class="center"><div class="brand">GILLY<span class="a">LAB</span></div></div>
  <div class="card center">
    <h1 style="font-size:1.35rem">${title}</h1>
    <p class="muted">${msg}</p>
    <a class="btn ghost" href="/login">Back to login</a>
  </div>`);
