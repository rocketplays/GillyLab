/**
 * landing-legacy-backup.js — A FROZEN COPY OF THE CAROUSEL LANDING PAGE.
 *
 * Taken 2026-07-18, immediately before the landing page's feature section was replaced
 * with the free/premium grid. This is the page exactly as it shipped: the 14-slide
 * auto-advancing carousel, the old <h1> and its 79-word hero paragraph.
 *
 * WHY IT LIVES IN worker/ AND NOT prototypes/: build-site.sh copies every git-tracked
 * file into public/ EXCEPT a named list, and worker/ is on that list while prototypes/
 * is NOT — prototypes/the-climb.html and four others are served publicly right now. A
 * backup in prototypes/ would be a public URL. It is also never imported, so esbuild
 * never bundles it: it costs the Worker nothing.
 *
 * TO RESTORE: copy the export below over the landingPage export in worker/pages.js,
 * then re-run `node scripts/gen-carousel.cjs` so /subscribe matches again.
 *
 * Git has this too — it is c9139c7e:worker/pages.js plus the slide additions of the
 * same day. This file exists because 'it's in git somewhere' is a worse answer at 2am
 * than a file with the word BACKUP in the name.
 *
 * DO NOT EDIT. It is a snapshot; editing it makes it a lie.
 */

// The imports the export below depends on, for reference when restoring:
//   import landingData from "./landing-data.js";
//   import matchupFree from "./matchup-free.js";
//   PRICE_LABEL, SITE_URL and the shared helpers all live in pages.js.

export const legacy_landingPage = () => `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>GillyLab — The Ultimate UFC Analytics Database</title>
<meta name="description" content="Deep analytics for every UFC fighter, a fight simulator that predicts winner and method, per-fight box scores, career accolades, matchup analysis of style, pace and path to victory, live odds and props, a bet tracker that grades itself and measures your closing-line value, line-movement tracking, a parlay builder that re-prices your slip at every book, closing-line history, tape study, rankings, and weekly roster updates.">
<link rel="canonical" href="${SITE_URL}/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="GillyLab">
<meta property="og:title" content="GillyLab — The Ultimate UFC Analytics Database">
<meta property="og:description" content="Deep analytics for every UFC fighter, a fight simulator that predicts winner and method, per-fight box scores, career accolades, matchup analysis of style, pace and path to victory, live odds and props, a bet tracker that grades itself and measures your closing-line value, line-movement tracking, a parlay builder that re-prices your slip at every book, closing-line history, tape study, rankings, and weekly roster updates.">
<meta property="og:url" content="${SITE_URL}/">
<meta property="og:image" content="${SITE_URL}/og.png?v=2">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="GillyLab — The Ultimate UFC Analytics Database">
<meta name="twitter:description" content="Every UFC fighter and bout: deep analytics, a fight simulator, box scores, career accolades, matchup analysis, live odds, line movement, a parlay builder, tape study, rankings, and more.">
<meta name="twitter:image" content="${SITE_URL}/og.png?v=2">
<link rel="icon" href="/favicon.ico?v=7" sizes="any">
<link rel="icon" href="/favicon.svg?v=7" type="image/svg+xml">
<link rel="icon" href="/favicon-96.png?v=7" type="image/png" sizes="96x96">
<link rel="icon" href="/favicon-48.png?v=7" type="image/png" sizes="48x48">
<link rel="apple-touch-icon" href="/apple-touch-icon.png?v=7">
<meta name="theme-color" content="#0a0a0b">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization","@id":"${SITE_URL}/#org","name":"GillyLab","url":"${SITE_URL}/","logo":"${SITE_URL}/gl-logo.png","description":"The ultimate UFC analytics database — deep fighter stats, a fight simulator, live odds, matchup breakdowns, rankings and more."},{"@type":"WebSite","@id":"${SITE_URL}/#website","name":"GillyLab","url":"${SITE_URL}/","publisher":{"@id":"${SITE_URL}/#org"}}]}</script>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;900&display=swap" rel="stylesheet">
<style>
  :root{--accent:#00e668;--accent2:#ff3d00;--bg:#0a0a0b;--card:#14141a;--border:#2a2a32;--muted:#666672;--surface2:#18181d}
  *{box-sizing:border-box}
  html{background:var(--bg);scroll-behavior:smooth}
  body{margin:0;background:radial-gradient(1100px 520px at 50% -6%,#12251b 0%,var(--bg) 52%);color:#fff;
       font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;min-height:100vh;-webkit-font-smoothing:antialiased;
       opacity:1;transition:opacity .15s ease;animation:lpin .3s ease backwards}
  @keyframes lpin{from{opacity:0}to{opacity:1}}
  body.lp-out{opacity:0}
  @media (prefers-reduced-motion: reduce){body{animation:none}body.lp-out{transition:none}}
  a{text-decoration:none;color:inherit}
  .bc{font-family:'Barlow Condensed',sans-serif}
  .lp{max-width:1200px;margin:0 auto;padding:0 24px}
  nav.lpnav{display:flex;align-items:center;justify-content:space-between;padding:22px 0}
  .brand{font-weight:900;letter-spacing:.15em;font-size:16px;display:inline-flex;align-items:center;gap:8px}
  .brand .a{color:var(--accent)}
  .brand-logo{height:26px;width:auto;display:block}
  .nav-cta{display:flex;gap:10px;align-items:center}
  .btn-primary{font-size:14px;font-weight:800;color:#04120a;background:var(--accent);border-radius:10px;padding:10px 16px;display:inline-block}
  .btn-primary:hover{background:#12f277}
  .btn-ghost{font-size:14px;color:rgba(255,255,255,.75);padding:9px 12px;border-radius:10px}
  .btn-ghost:hover{color:#fff}
  /* Top-right nav dropdown menu (replaces the plain Log in link) */
  .nav-menu{position:relative}
  .nav-menu-btn{display:inline-flex;align-items:center;justify-content:center;padding:9px;border-radius:11px;background:transparent;border:1px solid rgba(255,255,255,.15);cursor:pointer;transition:border-color .15s,background-color .15s}
  .nav-menu-btn:hover{border-color:#00e668;background:rgba(0,230,104,.09)}
  .nav-menu-icon{display:block;stroke:rgba(255,255,255,.85);stroke-width:2.2;stroke-linecap:round;transition:stroke .15s}
  .nav-menu-btn:hover .nav-menu-icon{stroke:#fff}
  .nav-menu.open .nav-menu-btn{border-color:#00e668;background:rgba(0,230,104,.09)}
  .nav-menu.open .nav-menu-icon{stroke:#00e668}
  .nav-menu-list{position:absolute;right:0;top:calc(100% + 8px);min-width:176px;background:#141416;border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:6px;display:flex;flex-direction:column;z-index:60;box-shadow:0 14px 34px rgba(0,0,0,.5);opacity:0;visibility:hidden;transform:translateY(-6px);pointer-events:none;transition:opacity .15s ease,transform .15s ease,visibility .15s ease}
  .nav-menu.open .nav-menu-list{opacity:1;visibility:visible;transform:translateY(0);pointer-events:auto}
  .nav-menu-list a{display:block;padding:9px 12px;border-radius:8px;font-size:14px;color:rgba(255,255,255,.82);text-decoration:none;white-space:nowrap}
  .nav-menu-list a:hover{background:rgba(0,230,104,.12);color:#00e668}
  .hero{text-align:center;max-width:700px;margin:14px auto 0;padding-top:8px}
  .badge{display:inline-block;font-size:11px;letter-spacing:.08em;color:var(--accent);background:rgba(0,230,104,.1);border:1px solid rgba(0,230,104,.25);border-radius:100px;padding:6px 14px;margin-bottom:18px}
  h1.hh{font-size:46px;line-height:1.05;font-weight:850;letter-spacing:-.015em;margin:0}
  h1.hh .a{color:var(--accent)}
  .sub{color:rgba(255,255,255,.62);font-size:16px;max-width:530px;margin:16px auto 0}
  .stats{display:flex;gap:36px;justify-content:center;margin:26px 0 6px}
  .stat .n{font-size:26px;font-weight:850;color:var(--accent)}
  .stat .l{font-size:12px;color:rgba(255,255,255,.5)}
  /* Hero matchup: the real next main event, not three round numbers. Server-rendered
     from landing-data.js, so it is correct the instant the page is served. */
  /* Eyebrow. Unlabelled, the card reads as decoration rather than a live example.
     Rendered only when there is a real card to label. */
  .mu-kick{display:flex;align-items:center;justify-content:center;gap:9px;margin:34px 0 11px;
           font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.44);font-weight:700}
  .mu-kick::before,.mu-kick::after{content:"";height:1px;width:36px;background:rgba(255,255,255,.13)}
  .mu-live{width:6px;height:6px;border-radius:50%;background:var(--accent);box-shadow:0 0 0 3px rgba(0,230,104,.16)}
  .mu{max-width:560px;margin:0 auto 4px;border:1px solid rgba(255,255,255,.10);border-radius:14px;
      background:linear-gradient(180deg,rgba(255,255,255,.035),rgba(255,255,255,.01));padding:16px 18px 14px;text-align:left}
  .mu-top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}
  .mu-ev{font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:var(--accent);font-weight:800}
  .mu-when{font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:rgba(255,255,255,.45)}
  .mu-row{display:flex;align-items:center;gap:12px}
  .mu-f{display:flex;align-items:center;gap:10px;min-width:0;flex:1}
  .mu-f.r{flex-direction:row-reverse;text-align:right}
  /* ring colour is set inline, from the same colourOf() the style dots use */
  .mu-av{width:44px;height:44px;border-radius:50%;flex:0 0 44px;object-fit:cover;background:#1b1e25;
         border:2px solid rgba(255,255,255,.14);display:grid;place-items:center;font-size:13px;font-weight:800;color:rgba(255,255,255,.5)}
  .mu-nm{font-size:15px;font-weight:750;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .mu-rec{font-size:11px;color:rgba(255,255,255,.45);margin-top:2px}
  .mu-vs{font-size:12px;font-weight:800;color:rgba(255,255,255,.35);letter-spacing:.08em;flex:0 0 auto}
  .mu-odds{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-top:12px;
           padding-top:11px;border-top:1px solid rgba(255,255,255,.08)}
  .mu-o{font-size:17px;font-weight:800;font-variant-numeric:tabular-nums}
  .mu-o.fav{color:var(--accent)}
  .mu-o.dog{color:rgba(255,255,255,.72)}
  .mu-olbl{font-size:10px;letter-spacing:.07em;text-transform:uppercase;color:rgba(255,255,255,.38);text-align:center;flex:1}
  .mu-style{margin-top:13px}
  .mu-bar{position:relative;height:6px;border-radius:3px;background:rgba(255,255,255,.09);margin:16px 0 6px}
  .mu-dot{position:absolute;top:50%;width:12px;height:12px;border-radius:50%;transform:translate(-50%,-50%);border:2px solid #0b0c10}
  .mu-tick{display:flex;justify-content:space-between;font-size:9.5px;letter-spacing:.07em;text-transform:uppercase;color:rgba(255,255,255,.32)}
  .mu-foot{margin-top:12px;font-size:11px;color:rgba(255,255,255,.42);text-align:center}
  .mu-foot b{color:rgba(255,255,255,.72);font-weight:700}
  @media(max-width:560px){
    .mu{margin-left:12px;margin-right:12px;padding:14px 14px 12px}
    .mu-nm{font-size:13.5px}.mu-av{width:38px;height:38px;flex-basis:38px}
  }
  .hero-cta{display:flex;gap:12px;justify-content:center;margin-top:24px;flex-wrap:wrap;align-items:center}
  .big{font-size:15px;font-weight:800;color:#04120a;background:var(--accent);border-radius:11px;padding:13px 22px;display:inline-block}
  .big:hover{background:#12f277}
  .big.ghost{background:transparent;color:#fff;border:1px solid var(--border)}
  .big.ghost:hover{border-color:#fff;background:transparent}
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
  .foot{text-align:center;margin:52px auto 0}
  .foot .fine{font-size:12px;color:rgba(255,255,255,.45);margin-top:14px}
  .trust{color:rgba(255,255,255,.42);font-size:12.5px;margin:16px auto 0;max-width:540px;line-height:1.5}
  .faq{max-width:720px;margin:60px auto 0}
  .faq-title{text-align:center;font-size:12px;letter-spacing:.06em;color:rgba(255,255,255,.4);margin-bottom:20px}
  .faq-list{display:flex;flex-direction:column;gap:10px}
  .faq-item{background:var(--card);border:1px solid var(--border);border-radius:14px;overflow:hidden}
  .faq-item summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:15px 18px;font-size:14px;font-weight:800;color:#fff}
  .faq-item summary::-webkit-details-marker{display:none}
  .faq-item summary:hover{color:var(--accent)}
  .faq-chev{color:var(--muted);font-size:20px;line-height:1;transition:transform .2s;flex:0 0 auto}
  .faq-item[open] .faq-chev{transform:rotate(90deg);color:var(--accent)}
  .faq-item p{margin:0;padding:0 18px 16px;font-size:13px;color:rgba(255,255,255,.62);line-height:1.6}
  .site-footer{max-width:1040px;margin:44px auto 0;padding:26px 24px 48px;border-top:1px solid var(--border);text-align:center}
  .foot-brand{font-weight:900;letter-spacing:.15em;font-size:14px;margin-bottom:12px}
  .foot-brand .a{color:var(--accent)}
  .foot-links{display:flex;gap:22px;justify-content:center;flex-wrap:wrap;margin-bottom:14px}
  .foot-links a{color:rgba(255,255,255,.6);font-size:13px}
  .foot-links a:hover{color:#fff}
  .foot-copy{color:rgba(255,255,255,.32);font-size:11.5px;line-height:1.6;max-width:900px;margin:0 auto}
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
    .stats{gap:24px}
    .hero-cta{gap:8px}
    .hero-cta .big{padding:11px 13px;font-size:13.5px}
  }
  @media (max-width:400px){
    .hero-cta .big{padding:10px 10px;font-size:12.5px}
  }
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

  /* The matchup-hub slide's styles, imported rather than restated. This is the SAME
     stylesheet the free /matchup page serves, generated by gen-matchup-free.cjs from
     index.html — so the slide is the real modal, not a landing-page impression of it.
     MEASURED before dropping 12.7KB of someone else's CSS onto this page: 75 selectors,
     every one inside the .mh-/#mh- namespace, no :root, nothing that can touch the hero,
     the plans table or the carousel chrome. */
  ${matchupFree && matchupFree.css ? matchupFree.css : ''}

  /* Free vs Premium plans */
  .plans{max-width:780px;margin:0 auto;padding:8px 20px}
  .plans-title{text-align:center;font-size:12px;letter-spacing:.06em;color:rgba(255,255,255,.4);margin-bottom:20px}
  .plans-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  .plan{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:24px 22px;display:flex;flex-direction:column}
  .plan.featured{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}
  .plan-eyebrow{font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--accent);margin-bottom:8px}
  .plan-name{font-weight:800;font-size:1.05rem;letter-spacing:.02em}
  .plan-tag{display:inline-block;margin-left:8px;font-size:10px;font-weight:700;letter-spacing:.06em;color:var(--accent);background:rgba(0,230,104,.12);border:1px solid rgba(0,230,104,.25);border-radius:999px;padding:2px 8px;vertical-align:middle}
  .plan-price{font-size:1.9rem;font-weight:900;margin:10px 0 2px}
  .plan-price small{font-size:.8rem;font-weight:600;color:var(--muted)}
  .plan-sub{color:var(--muted);font-size:.85rem;margin:0 0 14px}
  .plan-feats{list-style:none;padding:0;margin:0 0 20px;display:flex;flex-direction:column;gap:9px}
  .plan-feats li{position:relative;padding-left:24px;font-size:.9rem;line-height:1.35;color:#d7d7db}
  .plan-feats li::before{content:"✓";position:absolute;left:0;top:0;color:var(--accent);font-weight:800}
  .plan-feats li.off{color:var(--muted)}
  .plan-feats li.off::before{content:"—";color:var(--muted)}
  .plan .big{margin-top:auto;text-align:center}
  .plans-note{text-align:center;color:var(--muted);font-size:.8rem;margin-top:14px}
  /* Mobile: swap the two stacked cards for a single side-by-side comparison table */
  .plans-table{display:none;max-width:520px;margin:0 auto}
  .ptbl{width:100%;border-collapse:collapse;font-size:13px;table-layout:fixed}
  .ptbl th,.ptbl td{padding:9px 4px;border-top:1px solid rgba(255,255,255,.08)}
  .ptbl thead th{border-top:0;padding-bottom:12px;vertical-align:bottom}
  .ptbl .pf{text-align:left;width:54%;padding-left:0;color:#d7d7db}
  .ptbl .pc{text-align:center;width:23%}
  .ptbl .prem{background:rgba(0,230,104,.06)}
  .ptbl .yes{color:var(--accent);font-weight:800}
  .ptbl .no{color:#4a4a52}
  .ptbl .pt-name{font-weight:800;font-size:14px}
  .ptbl .pt-name.a{color:var(--accent)}
  .ptbl .pt-price{font-size:11px;color:var(--muted);font-weight:600}
  .plans-cta{display:flex;gap:10px;margin-top:16px}
  .plans-cta .big{flex:1;padding:12px 8px;text-align:center}
  @media(max-width:640px){.plans-grid{display:none}.plans-table{display:block}}
  .fsx-val.bad{color:#c76a54}
</style></head><body>
<div class="lp">
  <nav class="lpnav">
    <div class="brand"><img src="gl-logo.png?v=8" alt="" class="brand-logo"/><span class="brand-word">GILLY<span class="a">LAB</span></span></div>
    <div class="nav-cta">
      <div class="nav-menu" id="navMenu">
        <button type="button" class="nav-menu-btn" id="navMenuBtn" aria-haspopup="true" aria-expanded="false" aria-label="Menu" onclick="glToggleNavMenu(event)"><svg class="nav-menu-icon" viewBox="0 0 24 24" width="28" height="28" fill="none" aria-hidden="true"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></svg></button>
        <div class="nav-menu-list" role="menu">
          <a role="menuitem" href="/login">Log In</a>
          <a role="menuitem" href="/signup">Start free</a>
          <a role="menuitem" href="/signup?next=/subscribe">Go Premium</a>
          <a role="menuitem" href="/about">About Us</a>
          <a role="menuitem" href="/contact">Contact Us</a>
        </div>
      </div>
    </div>
  </nav>
  <script>
    window.glToggleNavMenu=function(e){e.stopPropagation();var m=document.getElementById('navMenu');var b=document.getElementById('navMenuBtn');var open=m.classList.toggle('open');if(b)b.setAttribute('aria-expanded',open?'true':'false');};
    document.addEventListener('click',function(e){var m=document.getElementById('navMenu');if(m&&!m.contains(e.target))m.classList.remove('open');});
    document.addEventListener('keydown',function(e){if(e.key==='Escape'){var m=document.getElementById('navMenu');if(m)m.classList.remove('open');}});
  </script>

  <header class="hero">
    <div class="badge">EVERY STAT · EVERY MATCHUP · EVERY EDGE</div>
    <h1 class="hh">The Ultimate <span class="a">UFC</span><br>Analytics Database</h1>
    <p class="sub">Deep analytics for every fighter, a fight simulator that predicts winner and method, a box score for every UFC bout in history, career accolades, matchup analysis that reads each fighter’s style, pace and path to victory, live odds and props, a bet tracker that grades itself and measures your closing-line value, line-movement tracking, a parlay builder that re-prices your slip at every book, closing-line history, one-click tape study, always-current rankings, and weekly roster updates — all in one place.</p>
    <div class="hero-cta">
      <a class="big" href="/signup">Start free →</a>
      <a class="big ghost" href="#plans">Compare plans</a>
      <a class="big ghost" href="/login">Log in</a>
    </div>
    <p class="trust">Free to start, no card required — play Pick'em and climb the leaderboard. Upgrade for the full database and tools. Works on any device.</p>
  </header>

  <section class="showcase" role="group" aria-label="Feature previews" aria-roledescription="carousel">
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
  </section>

  <section class="plans" id="plans">
    <div class="plans-title">TWO WAYS IN</div>
    <div class="plans-grid">
      <div class="plan">
        <div><span class="plan-name">Free</span></div>
        <div class="plan-price">$0<small> / forever</small></div>
        <p class="plan-sub">Create an account and play every fight week.</p>
        <ul class="plan-feats">
          <li>Pick'em — predict every card</li>
          <li>Live leaderboard &amp; your pick history</li>
          <li>Division rankings, current active roster and weekly roster changes</li>
          <li>Main event breakdown and analysis</li>
          <li class="off">Full analysis and breakdown of every other bout on the card and future cards</li>
          <li class="off">Full fighter database &amp; profiles</li>
          <li class="off">Fight simulator &amp; any-matchup builder</li>
          <li class="off">Live odds, props &amp; parlay tools</li>
          <li class="off">Bet &amp; CLV tracker</li>
        </ul>
        <a class="big ghost" href="/signup">Start free →</a>
      </div>
      <div class="plan featured">
        <div class="plan-eyebrow">Built for bettors, analysts &amp; hardcore fans</div>
        <div><span class="plan-name">Premium</span><span class="plan-tag">FULL ACCESS</span></div>
        <div class="plan-price">${PRICE_LABEL}</div>
        <p class="plan-sub">Everything in Free, plus the whole database and every tool.</p>
        <ul class="plan-feats">
          <li>Every fighter &amp; every bout — full analytics</li>
          <li>Fight simulator: winner, method &amp; round</li>
          <li>Build &amp; simulate any matchup you want</li>
          <li>Matchup analysis — style, pace &amp; path to victory</li>
          <li>Auto scouting reports &amp; fighter injury news</li>
          <li>Live odds, props &amp; the parlay builder</li>
          <li>Bet &amp; CLV tracker — grade your bets, track ROI</li>
          <li>Closing-line history &amp; line movement</li>
          <li>Tape study, accolades &amp; full box scores</li>
        </ul>
        <a class="big" href="/signup?next=/subscribe">Go Premium →</a>
      </div>
    </div>
    <div class="plans-table">
      <table class="ptbl">
        <thead>
          <tr>
            <th class="pf"></th>
            <th class="pc"><div class="pt-name">Free</div><div class="pt-price">$0</div></th>
            <th class="pc prem"><div class="pt-name a">Premium</div><div class="pt-price">${PRICE_LABEL.split(' ')[0]}/mo</div></th>
          </tr>
        </thead>
        <tbody>
          <tr><td class="pf">Pick'em predictions</td><td class="pc yes">✓</td><td class="pc prem yes">✓</td></tr>
          <tr><td class="pf">Leaderboard &amp; pick history</td><td class="pc yes">✓</td><td class="pc prem yes">✓</td></tr>
          <tr><td class="pf">Rankings, roster &amp; weekly changes</td><td class="pc yes">✓</td><td class="pc prem yes">✓</td></tr>
          <tr><td class="pf">Main-event breakdown &amp; analysis</td><td class="pc yes">✓</td><td class="pc prem yes">✓</td></tr>
          <tr><td class="pf">Every other bout, this &amp; future cards</td><td class="pc no">—</td><td class="pc prem yes">✓</td></tr>
          <tr><td class="pf">Full fighter database &amp; profiles</td><td class="pc no">—</td><td class="pc prem yes">✓</td></tr>
          <tr><td class="pf">Fight simulator — any matchup</td><td class="pc no">—</td><td class="pc prem yes">✓</td></tr>
          <tr><td class="pf">Matchup analysis: style, pace &amp; path</td><td class="pc no">—</td><td class="pc prem yes">✓</td></tr>
          <tr><td class="pf">Scouting reports &amp; injury news</td><td class="pc no">—</td><td class="pc prem yes">✓</td></tr>
          <tr><td class="pf">Odds, props &amp; parlay builder</td><td class="pc no">—</td><td class="pc prem yes">✓</td></tr>
          <tr><td class="pf">Closing-line &amp; movement history</td><td class="pc no">—</td><td class="pc prem yes">✓</td></tr>
          <tr><td class="pf">Tape study, accolades &amp; box scores</td><td class="pc no">—</td><td class="pc prem yes">✓</td></tr>
        </tbody>
      </table>
      <div class="plans-cta">
        <a class="big ghost" href="/signup">Start free</a>
        <a class="big" href="/signup?next=/subscribe">Go Premium →</a>
      </div>
    </div>
    <p class="plans-note">Start free, upgrade whenever — cancel Premium anytime.</p>
  </section>

  <section class="faq">
    <div class="faq-title">FREQUENTLY ASKED</div>
    <div class="faq-list">
      <details class="faq-item"><summary>What's included?<span class="faq-chev">›</span></summary><div class="faq-body"><p>Every UFC fighter (${cnt('fighters', '3,000+')}) and bout (${cnt('bouts', '18,000+')}): full career analytics, the fight simulator, per-fight box scores, career accolades, matchup analysis — each fighter’s style, pace and path to victory — live odds and props, the bet &amp; CLV tracker, line-movement history, the parlay builder, closing-line history, ${cnt('videos', 'thousands of')} tape links, division rankings, and weekly roster updates.</p></div></details>
      <details class="faq-item"><summary>Is there a free version?<span class="faq-chev">›</span></summary><div class="faq-body"><p>Yes. A free account lets you play Pick'em, climb the live leaderboard, keep your pick history, and browse division rankings and the active roster — no card required. Premium (${PRICE_LABEL}) unlocks the full fighter database, the simulator, matchup analytics, the odds and parlay tools, the bet &amp; CLV tracker, and everything else.</p></div></details>
      <details class="faq-item"><summary>What is the matchup analysis?<span class="faq-chev">›</span></summary><div class="faq-body"><p>For any two fighters, GillyLab places each on a striker–grappler spectrum, projects the pace (significant strikes thrown per minute), and writes each fighter’s path to victory from their own statistical edges. It runs on every upcoming bout, and on any matchup you build yourself.</p></div></details>
      <details class="faq-item"><summary>What does the parlay builder do?<span class="faq-chev">›</span></summary><div class="faq-body"><p>Build a slip from any market — moneylines, round totals, method of victory, round props — then see the identical slip priced at every book that offers all of its legs, so you can take the best number. It flags same-game correlation, because a moneyline and a method prop on one fight are not independent.</p></div></details>
      <details class="faq-item"><summary>What is the bet &amp; CLV tracker?<span class="faq-chev">›</span></summary><div class="faq-body"><p>Log a bet before the bell — moneyline, method, rounds, round props, or a parlay — and it grades itself off the result, then tracks your record, ROI and units. It also measures your <em>closing-line value</em>: whether the price you took beat where the market closed, which is the clearest signal of whether you're actually betting well rather than just running hot. CLV covers moneylines only, measured against the closing line we capture ten minutes before each segment; props still grade and count toward your record, but their prices move too fast and vary too much between books to have a close worth measuring against. You can log bets on fights we don't track too — those are tagged self-reported and kept out of the verified numbers.</p></div></details>
      <details class="faq-item"><summary>How current is the data?<span class="faq-chev">›</span></summary><div class="faq-body"><p>Odds refresh twice daily; rankings and the active roster sync regularly; results and box scores are updated after every event.</p></div></details>
      <details class="faq-item"><summary>Which promotions does it cover?<span class="faq-chev">›</span></summary><div class="faq-body"><p>GillyLab is focused on the UFC — every fighter past and present, including their full pre-UFC records.</p></div></details>
      <details class="faq-item"><summary>Can I cancel anytime?<span class="faq-chev">›</span></summary><div class="faq-body"><p>Yes. Manage or cancel your subscription in one click from your account — no contracts and no cancellation fees.</p></div></details>
      <details class="faq-item"><summary>How does billing work?<span class="faq-chev">›</span></summary><div class="faq-body"><p>${PRICE_LABEL} via Stripe. Payments are handled entirely by Stripe — we never see or store your card details.</p></div></details>
      <details class="faq-item"><summary>Is this betting advice?<span class="faq-chev">›</span></summary><div class="faq-body"><p>No. GillyLab is data and analytics for research and entertainment. It isn't financial or betting advice — always wager responsibly.</p></div></details>
    </div>
  </section>

  <footer class="foot">
    <div class="hero-cta">
      <a class="big ghost" href="/signup">Start free →</a>
      <a class="big" href="/signup?next=/subscribe">Go Premium →</a>
    </div>
    <div class="fine">Free to start · Premium ${PRICE_LABEL}, cancel anytime · Secure checkout by Stripe</div>
  </footer>

  <footer class="site-footer">
    <div class="foot-brand">GILLY<span class="a">LAB</span></div>
    <nav class="foot-links">
      <a href="/terms">Terms of Service</a>
      <a href="/privacy">Privacy Policy</a>
    </nav>
    <div class="foot-copy">© 2026 GillyLab. Not affiliated with, endorsed by, or sponsored by the Ultimate Fighting Championship or Zuffa, LLC. All fighter names, marks, and event names are the property of their respective owners. Data is provided for informational and entertainment purposes only.</div>
  </footer>
</div>

<script>
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
      +(tag ? '<span style="flex:0 0 auto;font-size:.52rem;font-weight:700;border-radius:4px;padding:2px 5px;color:'+tagcol+';background:'+tagcol+'1a;white-space:nowrap">'+tag+'</span>' : '')
      +'</div>';
  }
  var bets='<div style="font-size:.68rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#fff;margin-bottom:.45rem">My bet history</div>'
    +'<div style="font-size:.56rem;letter-spacing:.09em;text-transform:uppercase;color:rgba(255,255,255,.42);margin-bottom:.1rem">Closing line value</div>'
    +'<div style="display:flex;align-items:baseline;gap:8px;margin-bottom:.5rem"><span style="font-size:1.6rem;font-weight:800;color:'+A+';line-height:1">+3.1<span style="font-size:.6rem;color:'+M+';margin-left:2px">pts</span></span>'
    +'<span style="font-size:.66rem;color:#c9ccd3">beat the close on <b>27 of 40</b> moneylines</span></div>'
    +'<div style="display:flex;gap:6px;margin-bottom:.55rem">'+btile('Record','24-16')+btile('ROI','+11.8%',A)+btile('Units','+9.2u',A)+btile('Pending','3')+'</div>'
    +osec('UFC 329 · settled')
    +btkrow('max-holloway','MH','Holloway ML','Holloway vs McGregor','-205 \\u00b7 5u','+2.44u',A,'CLV +2.4',A)
    +btkrow('paddy-pimblett','PP','Pimblett by submission','Pimblett vs Saint-Denis','+700 \\u00b7 0.5u','+3.5u',A,'','')
    +btkrow('adrian-yanez','AY','Yanez inside the distance','Yanez vs Garbrandt','-110 \\u00b7 1u','+0.91u',A,'','')
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

  // ── The Climb (free) ────────────────────────────────────────────────────────
  // Mirrors the real game (prototypes/the-climb.html) rather than describing it: the
  // 42 points a run actually starts with, the real attribute names, the 10-0 prospect
  // and the #15 debut. Those numbers are the game's constants — if POINTS_START or the
  // ladder move, this slide is wrong, so it says only what the tuning file certifies.
  //
  // The opponent is a REAL currently-ranked fighter, pulled from the same LD.rankings
  // the rankings slide uses, so the preview stays current with no extra data plumbing
  // and never advertises a fighter who has since been cut.
  var climb=(function(){
    var rk=(LD.rankings&&LD.rankings.rows?LD.rankings.rows:[]).filter(function(r){return r.n!=='C';});
    if(rk.length<3) return '';   // no board, no slide — better absent than invented
    var div=(LD.rankings&&LD.rankings.division)||'';

    // The nine ATTRS the game actually has, with the game's own labels and order
    // (prototypes/the-climb.html). Not a representative four: the sheet IS the game,
    // and showing a trimmed one sells a simpler product than the one that exists.
    var SHEET=[['Power',8],['Pace',5],['Technique',6],['Striking defense',4],['Durability',5],
               ['Cardio',6],['Wrestling',7],['Grappling',5],['Takedown defense',4]];
    // 'Wrestler' is what archetype() returns for a wrestling-led sheet (ARCH_ONE.wrestling),
    // not a name invented for a slide. Same for the 42 points and the 10-0 debut.
    var ARCH='Wrestler';

    function abar(label,v){
      return '<div style="display:flex;align-items:center;gap:7px;margin-bottom:4px">'
        +'<span style="font-size:10px;width:92px;color:rgba(255,255,255,.72);flex:0 0 auto">'+label+'</span>'
        +'<div style="flex:1;height:5px;background:var(--surface2);border-radius:3px;overflow:hidden"><div style="width:'+(v*10)+'%;height:100%;background:'+A+'"></div></div>'
        +'<span style="font-size:10px;font-weight:800;color:'+A+';width:12px;text-align:right">'+v+'</span></div>';
    }
    // The real ladder from the game: >=.82 heavy favorite, >=.66 favorite, >=.54 slight
    // edge, >=.32 live dog, else underdog — same thresholds, same colours the game uses
    // (gold for a live dog, accent2 for an underdog).
    function odds(p){
      if(p>=0.82) return {t:'Heavy favorite',c:A};
      if(p>=0.66) return {t:'Favorite',c:A};
      if(p>=0.54) return {t:'Slight edge',c:'#f4f5f7'};
      if(p>=0.32) return {t:'Live dog',c:'#ffcf7a'};
      return {t:'Underdog',c:'var(--accent2)'};
    }
    function init(n){return String(n||'').split(' ').map(function(w){return w[0];}).join('').slice(0,2);}
    function offer(r,p){
      var o=odds(p);
      return '<div style="display:flex;align-items:center;gap:9px;background:var(--card);border:1px solid var(--border);border-radius:11px;padding:.5rem .6rem;margin-bottom:.4rem">'
        +ava(r.slug,init(r.name),false,34)
        +'<div style="flex:1;min-width:0"><div style="font-weight:650;font-size:.8rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+r.name+'</div>'
        +'<div style="font-size:.6rem;color:'+M+'">#'+r.n+' · '+r.record+'</div></div>'
        +'<div style="text-align:right;flex:0 0 auto"><div style="font-size:.58rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:'+o.c+'">'+o.t+'</div>'
        +'<div class="bc" style="font-size:15px;font-weight:900;color:'+o.c+'">'+Math.round(p*100)+'%</div></div></div>';
    }
    return '<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:9px">'
      +'<div style="font-weight:700;font-size:.95rem">Your fighter <span style="color:'+M+';font-weight:600">· '+div+'</span></div>'
      +'<div style="font-size:.66rem;color:'+A+';font-weight:800">10-0 · UNRANKED</div></div>'
      +'<div style="display:flex;align-items:center;gap:7px;margin-bottom:8px">'
      +'<span style="font-size:.62rem;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:#0a0a0b;background:'+A+';border-radius:999px;padding:2px 9px">'+ARCH+'</span>'
      +'<span style="font-size:10px;color:'+M+'">42 points spent · your sheet decides the name</span></div>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 16px;margin-bottom:13px">'
      +SHEET.map(function(x){return abar(x[0],x[1]);}).join('')+'</div>'
      +'<div style="font-size:10px;color:'+M+';text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">Pick your next fight — three offers</div>'
      +offer(rk[4]||rk[2],0.71)+offer(rk[2],0.38)+offer(rk[0],0.21)
      +'<div style="font-size:10px;color:'+M+';text-align:center;margin-top:7px;line-height:1.45">Real fighters, real rankings, real GillyLab power ratings. Win and you climb; lose twice and you\\u2019re cut.</div>';
  })();

  // ── Matchup analytics deep dive (premium, main event free) ──────────────────
  // The REAL rendered main-event hub, straight out of worker/matchup-free.js — the same
  // build-time artifact the free /matchup page serves. Not a mockup and not a fork: if
  // the modal changes, gen-matchup-free.cjs regenerates and this follows. It is also
  // free weight, because pages.js already imports that module for /matchup.
  //
  // NO BACKTICKS IN THIS COMMENT, OR ANY COMMENT BELOW THIS LINE. Everything here is
  // inside landingPage's template literal, so an unescaped backtick CLOSES IT and the
  // rest of the file is parsed as code. I did exactly that while explaining this very
  // variable, and it broke worker/pages.js: the Worker build would have failed on deploy.
  // Nothing caught it — every generator here text-slices this file and none of them ever
  // parse it, so gen-carousel, gen-showcase-proto and all 30 checks stayed green over a
  // file that could not load. Plain node --check misses it too (it assumes CommonJS).
  // The check that catches it: node --input-type=module --check < worker/pages.js
  // (and yes — the first draft of THIS comment had backticks in it.)
  //
  // INTERPOLATED, not referenced. matchupFree is a server-side import; this script runs
  // in the browser, where the name does not exist — so a typeof guard on it would be
  // false on every page load, mhx would be '', and the slides array's own .filter(s.h)
  // would drop the slide silently. Baked in at render time exactly like LD above.
  //
  // THE HEADER IS REBUILT HERE, and it has to be: matchup-free.js carries the tab bodies
  // but not the .mh-hd header (that markup is /matchup's own, above), and it exports no
  // fighter slugs — so the faces come from LD.matchup, which does carry them. Both files
  // are regenerated in the same CI run from the same card, so they agree; the mhSame
  // check below ASSERTS that rather than trusting it. If they ever diverge the header is
  // dropped instead of printing the wrong two men over the right analysis.
  var mhx=${JSON.stringify((matchupFree && matchupFree.striking) || '')};
  var mhGr=${JSON.stringify((matchupFree && matchupFree.grappling) || '')};
  var mhN1=${JSON.stringify((matchupFree && matchupFree.n1) || '')};
  var mhN2=${JSON.stringify((matchupFree && matchupFree.n2) || '')};
  var mhSlug=${JSON.stringify((matchupFree && matchupFree.slug) || '')};

  // FRESHNESS GATE — the same contract /matchup enforces with ddFresh, and the reason
  // gen-matchup-free.cjs bothers to write a slug at all ("landingData.card.slug or the
  // page hides the button, so both must describe the same card").
  //
  // matchup-free.js is regenerated from the CURRENT event.json twice a day, so the slide
  // tracks each new main event by itself. But if it ever falls behind the card — a failed
  // run, a deploy that didn't land, a card pulled at short notice — this slide would keep
  // advertising a fight that has already happened, on the marketing page, as "the main
  // event". Without this check nothing would catch that: stale HTML renders exactly as
  // well as fresh HTML. Slugs disagree -> no payload -> the slides array's own
  // .filter(s.h) drops the card. One fewer feature beats one confident lie.
  var mhFresh = !!(mhx && mhGr && mhSlug && LD.card && LD.card.slug === mhSlug);
  if(!mhFresh) mhx='';
  if(mhx){
    var mm=LD.matchup||{}, ma=mm.a||{}, mb=mm.b||{};
    var mhSame = ma.name===mhN1 && mb.name===mhN2;
    var mhHd = mhSame ? (function(){
      function side(nm,slug,rec,init,right){
        return '<div class="mh-hd-f'+(right?' r':'')+'">'
          +'<span class="mh-hd-av">'+ava(slug,init,false,40)+'</span>'
          +'<div class="mh-hd-tx"><div class="mh-hd-nm">'+nm+'</div>'
          +(rec?'<div class="mh-hd-rc">'+rec+'</div>':'')+'</div></div>';
      }
      var sub=[mm.weightClass, mm.rounds?mm.rounds+' RDS':''].filter(Boolean).join(' \\u00b7 ');
      return '<div class="mh-hd">'
        +side(ma.name,ma.slug,ma.record,ma.initials,false)
        +'<div class="mh-hd-mid"><div class="mh-hd-vs">VS</div>'+(sub?'<div class="mh-hd-sub">'+sub+'</div>':'')+'</div>'
        +side(mb.name,mb.slug,mb.record,mb.initials,true)+'</div>';
    })() : '';

    // BOTH TABS, because the modal has both. Shipping only the striking half advertised
    // half the feature: the grappling tab is where takedowns, control time and submission
    // threat live, and matchup-free.js has always exported it — it just wasn't asked for.
    //
    // Instance-safe by design: the tab handler resolves its panes from the CLICKED button
    // (btn.closest) rather than by id. The real modal can use #mh-tabs because there is
    // exactly one of it; this payload is rendered into the carousel stage AND into every
    // card of the grid AND into the lightbox — up to three live copies at once — so an
    // id-based handler would toggle whichever copy the browser found first.
    var mhTabs = mhGr ? (
      '<div class="mh-tabs">'
      +'<button type="button" class="mh-tab on" onclick="glMhTab(event,this,\\'striking\\')">Striking</button>'
      +'<button type="button" class="mh-tab" onclick="glMhTab(event,this,\\'grappling\\')">Grappling</button>'
      +'</div>'
      +'<div class="mh-body">'
      +'<div data-mh-pane="striking">'+mhx+'</div>'
      +'<div data-mh-pane="grappling" style="display:none">'+mhGr+'</div>'
      +'</div>'
    ) : ('<div class="mh-body">'+mhx+'</div>');
    mhx = '<div class="mh-slide">' + mhHd + mhTabs + '</div>';
  }
  // stopPropagation matters: in the grid the whole card is clickable, so without it
  // switching tabs would also fire the card and throw you into the lightbox.
  window.glMhTab=function(e,btn,which){
    if(e&&e.stopPropagation)e.stopPropagation();
    var box=btn.closest('.mh-slide'); if(!box) return;
    Array.prototype.forEach.call(box.querySelectorAll('.mh-tab'),function(b){b.classList.toggle('on',b===btn);});
    Array.prototype.forEach.call(box.querySelectorAll('[data-mh-pane]'),function(p){
      p.style.display=(p.getAttribute('data-mh-pane')===which)?'':'none';
    });
  };

  var slides=[
    {t:'Fight simulator',d:'Run any matchup through the tuned model — win probability plus how the fight ends.',h:sim},
    {t:'Box scores for every bout',d:'Full head-to-head box score — strikes, takedowns, control — for every UFC fight ever.',h:box},
    {t:'Career accolades',d:'Titles, belt ranks, records, and fight-night awards for every fighter.',h:acc},
    // PREMIUM, but the main event's is genuinely free on every card \u2014 the /matchup page
    // serves the real thing to logged-out visitors (worker/matchup-free.js). Saying only
    // "PREMIUM" undersells the free tier and, worse, is not true.
    {t:'Matchup analytics deep dive',d:'Striking: where the fight happens, what each man throws at range, what lands on him \u2014 every strike split by target and position. Grappling: takedowns, control time and submission threat. Both shaded against the division. Free for the main event of every card.',h:mhx},
    {t:'Style, pace & path to victory',d:'Where each fighter sits on the striker\u2013grappler spectrum, the pace they imply, how each one wins, and the storylines behind the bout. Free for the main event of every card.',h:style},
    {t:'Live odds & props',d:'Moneyline and round totals by book, plus method-of-victory and round props for each fighter.',h:odds},
    {t:'Bet & CLV tracker',d:'Log a bet before the bell and it grades itself off the result — record, ROI, units, and your closing-line value.',h:bets},
    {t:'Line movement',d:'Watch a bout’s odds move day by day, from open to now, across the whole market.',h:lm},
    {t:'Parlay builder',d:'Build a slip across any market, then re-price the identical slip at every other book.',h:parlay},
    {t:'Odds & line history',d:'Every fighter’s closing lines, bout by bout — favorites and underdogs at a glance.',h:ohist},
    {t:'One-click tape study',d:'Every fight in a fighter\\u2019s history links straight to the film.',h:tape},
    // FREE ORDER IS DELIBERATE: the two things you can DO without an account come first
    // (The Climb, then Pick'em), then what you can read. The free tier's job is to get a
    // stranger playing, not to lead with a stats table.
    {t:'The Climb',d:'Build a fighter, start as a 10-0 prospect, and work your way up the real rankings to the belt — against real fighters and real GillyLab power ratings. Free, no account needed.',h:climb,f:1},
    {t:'Pick\\u2019em predictions',d:'Call every fight on the card, lock in before the prelims, then climb the live leaderboard — free.',h:pickem,f:1},
    {t:'Detailed fighter statistics',d:'Career striking and grappling stats for every fighter — free on every lite profile. Plus a full main event breakdown and analytics deep dive on every main event.',h:analytics,f:1},
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

  // Smooth fade + height on the FAQ accordions (native <details> otherwise snaps
  // open/closed). Falls back to the native instant toggle if JS or motion is off.
  var RMf=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  Array.prototype.forEach.call(document.querySelectorAll('.faq-item'),function(d){
    if(RMf)return;
    var sum=d.querySelector('summary'),body=d.querySelector('.faq-body');if(!sum||!body)return;
    body.style.overflow='hidden';body.style.transition='height .28s ease, opacity .28s ease';
    if(!d.open){body.style.height='0';body.style.opacity='0';}
    var busy=false;
    sum.addEventListener('click',function(e){
      e.preventDefault();if(busy)return;busy=true;
      if(d.open){
        body.style.height=body.scrollHeight+'px';
        requestAnimationFrame(function(){body.style.height='0';body.style.opacity='0';});
        body.addEventListener('transitionend',function h(ev){if(ev.propertyName!=='height')return;d.open=false;body.removeEventListener('transitionend',h);busy=false;});
      }else{
        d.open=true;body.style.height='0';body.style.opacity='0';
        requestAnimationFrame(function(){body.style.height=body.scrollHeight+'px';body.style.opacity='1';});
        body.addEventListener('transitionend',function h(ev){if(ev.propertyName!=='height')return;body.style.height='auto';body.removeEventListener('transitionend',h);busy=false;});
      }
    });
  });

  document.addEventListener('click',function(e){
    var a=e.target.closest&&e.target.closest('a[href^="/"]');
    if(!a)return;var href=a.getAttribute('href');
    if(!href||a.target==='_blank'||e.metaKey||e.ctrlKey||e.shiftKey||e.button)return;
    e.preventDefault();document.body.classList.add('lp-out');setTimeout(function(){window.location=href;},150);
  });
  // Reset the fade-out when the page is restored (esp. from the back/forward cache),
  // otherwise Back lands on a page still faded to opacity 0 — a blank screen.
  window.addEventListener('pageshow',function(){document.body.classList.remove('lp-out');document.body.style.animation='';});
})();
</script></body></html>`;
