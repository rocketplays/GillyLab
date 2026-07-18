#!/usr/bin/env node
/**
 * landing-showcase.html — a PROTOTYPE of the landing page's feature section as a
 * free/premium grid instead of a 14-slide carousel. Built to be compared against the
 * live page and then either adopted or deleted.
 *
 * WHY GENERATED, NOT HAND-BUILT. The whole point is to judge the LAYOUT, which only
 * works if the previews are the real ones. Hand-copying the 14 slide payloads would
 * mean judging a mockup of the product rather than the product, and the copy would be
 * stale within a card or two. So this slices the actual slide-building script out of
 * worker/pages.js — the same source, the same markers, the same rule as
 * gen-carousel.cjs, which already extracts this exact block for /subscribe.
 *
 * WHAT THE CAROUSEL MEASURES, AND WHY THIS EXISTS:
 *   slides                     : 14
 *   auto-advance               : 7s
 *   time to see all of them    : 98s of uninterrupted staring
 *   tagged FREE / PREMIUM      : 4 / 10, and the tag flips every 7s — so the one
 *                                question a visitor has ("what do I get for free?")
 *                                is answered differently every 7 seconds.
 * ~11 of 14 previews are effectively invisible. That is the problem this tries to fix.
 * It is NOT fixed by accordions: a closed accordion renders zero previews where the
 * carousel at least renders one. On a landing page the previews ARE the argument, so
 * the fix is to show them all at once and let scrolling replace clicking.
 *
 * NOT wired into the site. It writes to prototypes/ and nothing imports it. If the
 * layout wins, the change belongs in worker/pages.js (the source of truth) and
 * gen-carousel.cjs keeps /subscribe in sync — exactly as today.
 *
 * Run: node scripts/gen-showcase-proto.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'worker', 'pages.js');
const DATA = path.join(ROOT, 'worker', 'landing-data.js');
const OUT = path.join(ROOT, 'prototypes', 'landing-showcase.html');
// The same page, emitted as a Worker module so it can be served at /landingpagetest —
// a real URL on a real phone, which is the only way to judge this before it replaces /.
//
// It needs a ROUTE and cannot just be the file above: wrangler.toml sets
// run_worker_first, so the Worker gates every request and public/ is only served to a
// subscribed session (bar the PUBLIC_LANDING_ASSETS allowlist). prototypes/ is copied
// into public/ by build-site.sh but is NOT reachable logged-out — I claimed otherwise
// earlier having read build-site.sh and not wrangler.toml.
const OUT_WORKER = path.join(ROOT, 'worker', 'landing-test.js');

// ── the hero ─────────────────────────────────────────────────────────────────
// Copy, not code — pulled out here because it's the line most likely to be rewritten
// five times, and it shouldn't need a spelunk through the generator to find.
//
// What it replaces on the live page, measured: an <h1> of "The Ultimate UFC Analytics
// Database" over a 79-word single sentence carrying 13 commas. That sentence lists
// fourteen features before giving the reader one reason to care, and it is the first
// thing anyone reads. Listing features is the GRID's job now. The hero only has to say
// what this is and why to stay, in the time it takes to scroll past it.
const HERO_EYEBROW = 'Every stat · Every matchup · Every edge';
const HERO_TITLE = 'The Ultimate <span class="a">UFC</span><br>Analytics Database';
const HERO_HOOK = 'Know the fight before it starts.';
// {PRICE} is substituted from pages.js's own PRICE_LABEL at build time, NOT typed out
// here. The footer's fine print already reads from that const, and a hand-written
// "$9.99" in the hero would keep saying $9.99 on the day the price changes — with the
// bottom of the same page disagreeing with the top of it.
const HERO_TRUST = 'Free to start, no card required — play The Climb and call the card in Pick’em. Premium is {PRICE}, cancel anytime.';

// ENOENT is the only tolerable read failure (CLAUDE.md #2). An offloaded file must
// throw, never fall back — a default here would silently prototype an empty page.
function read(p) {
  try { return fs.readFileSync(p, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') throw new Error('absent: ' + p);
    throw new Error('unreadable, which is NOT the same as absent (iCloud offload? see CLAUDE.md #1): ' + p + ' — ' + e.message);
  }
}

const idx = read(SRC);

// EVERYTHING IS SEARCHED FROM INSIDE landingPage, NOT FROM CHAR 0.
//
// pages.js holds every page in the site, and the landing one starts ~26k chars in. A
// plain indexOf therefore finds some OTHER page's copy of any shared markup and slices
// that instead — silently, because the wrong page's footer/nav is still a valid footer/nav.
// It already happened: `<footer class="site-footer">` occurs twice (L267 and L749), the
// first belongs to a different page and carries four links where the landing has two, and
// the prototype shipped it while a test asserting "Terms of Service is present" passed,
// because that string is in both. Anchoring here kills the whole bug class rather than
// the one instance of it.
const LP = idx.indexOf('export const landingPage');
if (LP < 0) throw new Error('landingPage not found in pages.js');

function between(startMarker, endMarker, includeEnd) {
  const s = idx.indexOf(startMarker, LP);
  if (s < 0) throw new Error('start marker not found inside landingPage: ' + startMarker);
  const e = idx.indexOf(endMarker, s + startMarker.length);
  if (e < 0) throw new Error('end marker not found inside landingPage: ' + endMarker);
  return idx.slice(s, includeEnd ? e + endMarker.length : e);
}

// ── the real slide payloads ──────────────────────────────────────────────────
// From `var LD=…` down to the end of the slides array — i.e. everything that BUILDS
// the previews, and none of the carousel driver (dots, 7s timer, swipe) that this
// prototype exists to replace.
const SLIDES_END = '].filter(function(s){return s.h;});';
let slideJS = between('var LD=${JSON.stringify(landingData)};', SLIDES_END, true);

// This block lives inside a template literal in pages.js, so what the browser actually
// receives is the UN-escaped text: `\\u2713` is delivered as `✓`, `\\'` as `\'`.
// Writing the raw source into a plain .html file would ship the escaping too and the
// checkmarks would render as literal "✓". One pass, so `\\` can't be re-processed.
slideJS = slideJS.replace(/\\(\\|`|\$\{)/g, '$1');

// Resolve the interpolations the same way the Worker does at render time. Every name the
// slide script interpolates has to be resolved here too — the guard below is what makes
// that a build error instead of a blank slide someone notices in a month.
const dataSrc = read(DATA);
const landingData = dataSrc.slice(dataSrc.indexOf('{'), dataSrc.lastIndexOf('}') + 1);
JSON.parse(landingData); // fail loudly here rather than in the browser
slideJS = slideJS.replace('var LD=${JSON.stringify(landingData)};', 'var LD=' + landingData + ';');

// The matchup-hub slide bakes in the real rendered main event from worker/matchup-free.js.
const mfSrc = read(path.join(ROOT, 'worker', 'matchup-free.js'));
const matchupFree = JSON.parse(mfSrc.slice(mfSrc.indexOf('{'), mfSrc.lastIndexOf('}') + 1));
slideJS = slideJS.replace('var mhx=${JSON.stringify((matchupFree && matchupFree.striking) || \'\')};',
  'var mhx=' + JSON.stringify(matchupFree.striking || '') + ';');
// The grappling tab — takedowns, control, submission threat. The slide is a real tabbed
// modal, not just its striking half.
slideJS = slideJS.replace('var mhGr=${JSON.stringify((matchupFree && matchupFree.grappling) || \'\')};',
  'var mhGr=' + JSON.stringify(matchupFree.grappling || '') + ';');
// The hub slide rebuilds the .mh-hd header (with the avatars) from these two names,
// cross-checked against LD.matchup so it can't print the wrong men over the right read.
slideJS = slideJS.replace('var mhN1=${JSON.stringify((matchupFree && matchupFree.n1) || \'\')};',
  'var mhN1=' + JSON.stringify(matchupFree.n1 || '') + ';');
slideJS = slideJS.replace('var mhN2=${JSON.stringify((matchupFree && matchupFree.n2) || \'\')};',
  'var mhN2=' + JSON.stringify(matchupFree.n2 || '') + ';');
slideJS = slideJS.replace('var mhSlug=${JSON.stringify((matchupFree && matchupFree.slug) || \'\')};',
  'var mhSlug=' + JSON.stringify(matchupFree.slug || '') + ';');
if (!matchupFree.striking) throw new Error('matchup-free.js has no striking payload — the matchup slide would silently vanish');
if (!matchupFree.grappling) throw new Error('matchup-free.js has no grappling payload — the slide would advertise half the feature');
// The slide gates itself on matchupFree.slug === landingData.card.slug. If they disagree
// HERE, the prototype would silently generate without its headline premium card and I'd
// spend an hour wondering where it went — so say so loudly at build time instead.
{
  const cardSlug = JSON.parse(landingData).card && JSON.parse(landingData).card.slug;
  if (matchupFree.slug !== cardSlug) {
    throw new Error('matchup-free.js is for "' + matchupFree.slug + '" but landing-data.js says the card is "' + cardSlug +
      '" — the matchup slide gates on this and would drop out. Re-run: node scripts/gen-matchup-free.cjs && node scripts/gen-landing-data.cjs');
  }
}

if (slideJS.includes('${')) throw new Error('an unresolved ${…} survived into the prototype: ' + /\$\{[^}]{0,60}/.exec(slideJS)[0]);

// The previews reference /photos/thumb/<slug>.png, which resolves on gillylab.com but
// not from a file:// prototype — the faces would silently fall back to initials via the
// <img onerror> and the layout would be judged with no faces in it at all.
//
// MATCH THE BARE PATH, NOT A QUOTED ONE. The first version of this looked for
// '/photos/thumb/' — single-quoted — and pages.js writes it double-quoted inside a
// concatenation ("><img src=\"/photos/thumb/'+slug). So the replace matched nothing,
// changed nothing, threw nothing, and the prototype rendered every fighter as grey
// initials while this line sat here looking like it had handled it. The count below is
// the whole point: a rewrite that silently no-ops is indistinguishable from one that
// worked, unless you assert it did something.
const photoRefs = (slideJS.match(/\/photos\/thumb\//g) || []).length;
if (!photoRefs) throw new Error('no /photos/thumb/ references in the slide code — the avatar markup moved and this rewrite is now dead');
slideJS = slideJS.replace(/\/photos\/thumb\//g, 'https://gillylab.com/photos/thumb/');
const rewritten = (slideJS.match(/https:\/\/gillylab\.com\/photos\/thumb\//g) || []).length;
if (rewritten !== photoRefs) throw new Error('rewrote ' + rewritten + ' of ' + photoRefs + ' photo paths');

// ── the real component CSS ───────────────────────────────────────────────────
// Same blocks gen-carousel.cjs takes: without these the previews are unstyled divs.
const componentCSS = [
  between('  /* Faithful in-app component styles */', '  @media (max-width:760px){', false).trimEnd(),
  between('  /* Featured-fighter slide', '  /* Free vs Premium plans */', false).trimEnd(),
  '  .fsx-val.bad{color:#c76a54}',
].join('\n');

const rootVars = between('  :root{--accent:#00e668;--accent2:#ff3d00;', '}', true);

// THE PAGE'S OWN body RULE, sliced — not my approximation of it.
//
// I first hand-wrote `body{background:var(--bg);font-family:'Barlow'…}` and it was wrong
// twice over. The real landing page is NOT flat black: it carries
//     radial-gradient(1100px 520px at 50% -6%, #12251b 0%, var(--bg) 52%)
// — a green-tinted glow behind the hero that fades out by halfway down — and it sets body
// copy in the SYSTEM stack, not Barlow. So my prototype was flatter and differently-typed
// than the thing it exists to be compared against, and every judgement made against it
// was a judgement of my CSS. The lesson is the same one as the nav and the footer: slice
// it, don't re-draw it. `animation:lpin` is dropped (its keyframe isn't sliced and a
// fade-in on a prototype is noise); padding is re-set because this page has no hero
// block above the grid.
const bodyRule = between('  body{margin:0;background:radial-gradient(', '}', false)
  .replace(/^\s*body\{/, '')
  .replace(/;?\s*animation:lpin[^;}]*/, '');

// The real nav — logo left, hamburger right — sliced rather than mocked, so the header
// above the grid is the page's actual chrome and not my impression of it. The logo is a
// relative <img src="gl-logo.png">, which resolves on the site and not from file://, so
// it gets the same absolute-host treatment as the fighter photos.
const navMarkup = between('<nav class="lpnav">', '</nav>', true)
  .replace(/src="gl-logo\.png([^"]*)"/, 'src="https://gillylab.com/gl-logo.png$1"');
const navScript = between('window.glToggleNavMenu=function(e)', '</script>', false);
// `nav.lpnav{` and `.lp{`, NOT `.brand{`. .brand{ appears five times across this file
// (L168, L409, L2853, L2946, L3084) and between() takes the first — so anchoring there
// would silently slice the WRONG page's nav and the header would look subtly off with
// nothing failing. nav.lpnav{ occurs exactly once. Checked, not assumed.
if ((idx.match(/^\s*nav\.lpnav\{/gm) || []).length !== 1) throw new Error('nav.lpnav{ is no longer a unique anchor — the nav CSS slice would grab the wrong page');
const navCSS = between('  .lp{max-width:1200px', '  .hero{text-align:center', false).trimEnd();
if (!/brand-logo/.test(navMarkup) || !/nav-menu-btn/.test(navMarkup)) throw new Error('the nav slice lost the logo or the hamburger');
if (!/nav-menu-list/.test(navCSS) || !/brand-logo/.test(navCSS)) throw new Error('the nav CSS slice is missing the menu or the logo rules');

// ── the footer, sliced too ───────────────────────────────────────────────────
// The landing page carries TWO: a .foot CTA block (Start free / Go Premium + the price
// fine print) and the real .site-footer (brand, legal links, the UFC disclaimer). Both
// come across — the disclaimer in particular is not decoration, and a prototype that
// quietly drops it is the wrong thing to be judging a page against.
// PRICE_LABEL is a server-side const like matchupFree was, so it is resolved here.
// NO FALLBACK. This used to end `: '$8 / month'` — so if the regex ever missed, the page
// would quietly advertise a price that is both wrong and not even the current one, in two
// places, with nothing failing. A price is not a thing to guess at: if it can't be read,
// stop.
const PRICE_LABEL = (() => {
  const m = /const PRICE_LABEL\s*=\s*["'`]([^"'`]+)["'`]/.exec(idx);
  if (!m) throw new Error('could not read PRICE_LABEL out of pages.js — refusing to print a guessed price');
  return m[1];
})();
const footCTA = between('<footer class="foot">', '</footer>', true)
  .replace(/\$\{PRICE_LABEL\}/g, PRICE_LABEL);
const siteFooter = between('<footer class="site-footer">', '</footer>', true);
const footCSS = between('  .foot{text-align:center', '  .trust{', false).trimEnd() + '\n' +
  between('  .site-footer{', '  /* Faithful in-app component styles */', false).trimEnd() +
  // .big / .hero-cta belong to the hero the prototype doesn't slice, but the CTA footer
  // reuses them — without these its two buttons render as bare links.
  '\n' + between('  .hero-cta{', '  .trust{', false).trimEnd();
if (!/Terms of Service/.test(siteFooter)) throw new Error('the site footer slice lost its legal links');
if (!/Not affiliated/.test(siteFooter)) throw new Error('the site footer slice lost the UFC disclaimer');
if (/\$\{/.test(footCTA + siteFooter)) throw new Error('an unresolved ${…} survived into the footer: ' + /\$\{[^}]{0,40}/.exec(footCTA + siteFooter)[0]);

// ── the prototype's own chrome ───────────────────────────────────────────────
const css = `
${rootVars}
  *{margin:0;padding:0;box-sizing:border-box}
  body{${bodyRule};padding:0 0 90px}
  a{text-decoration:none;color:inherit}
  .bc{font-family:'Barlow Condensed',sans-serif}

  /* The real nav and footer, sliced from the landing page — not re-drawn. */
${navCSS}
${footCSS}
  .fx-h .a{color:var(--accent)}

  .fx-wrap{max-width:1140px;margin:0 auto;padding:0 22px}

  /* Section head + the tier filter. The filter is the navigation the carousel's dots
     pretended to be: 14 unlabelled dots are not a way to find anything. */
  .fx-top{text-align:center;margin:30px 0 26px}
  .fx-eyebrow{display:inline-block;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--accent);background:rgba(0,230,104,.1);border:1px solid rgba(0,230,104,.25);border-radius:100px;padding:5px 13px;margin-bottom:16px}
  .fx-h{font-family:'Barlow Condensed',sans-serif;font-size:52px;font-weight:700;line-height:1.02;letter-spacing:.004em}
  .fx-sub{color:rgba(255,255,255,.62);font-size:15px;margin-top:13px;max-width:545px;margin-left:auto;margin-right:auto;line-height:1.6}
  .fx-cta{display:flex;gap:10px;justify-content:center;margin-top:20px;flex-wrap:wrap}
  .fx-btn{font-size:14px;font-weight:800;color:#04120a;background:var(--accent);border-radius:10px;padding:11px 18px;display:inline-block;transition:background .15s}
  .fx-btn:hover{background:#12f277}
  .fx-btn.ghost{background:transparent;color:rgba(255,255,255,.8);border:1px solid rgba(255,255,255,.16)}
  .fx-btn.ghost:hover{color:#fff;border-color:rgba(255,255,255,.34);background:rgba(255,255,255,.04)}
  .fx-trust{color:var(--muted);font-size:12px;margin-top:13px}
  @media (max-width:560px){ .fx-h{font-size:36px} }

  .fx-filter{display:inline-flex;gap:3px;margin-top:20px;background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:999px;padding:4px}
  .fx-fb{background:none;border:0;color:var(--muted);font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:12.5px;letter-spacing:.1em;text-transform:uppercase;padding:7px 17px;border-radius:999px;cursor:pointer;transition:color .15s,background .15s}
  .fx-fb:hover{color:#f4f5f7}
  .fx-fb.on{background:var(--accent);color:#0a0a0b}
  .fx-fb .n{opacity:.6;font-size:11px;margin-left:5px}

  /* Tier band — the thing the carousel could never say, because its tag changed every
     7 seconds: here's the line, and here's which side each feature is on. */
  .fx-band{display:flex;align-items:center;gap:13px;margin:34px 0 16px}
  .fx-band:first-of-type{margin-top:26px}
  .fx-bt{font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap}
  .fx-bt.free{color:var(--accent)}
  .fx-bt.prem{color:#ffcf7a}
  .fx-bn{font-size:12px;color:var(--muted);white-space:nowrap}
  .fx-bl{flex:1;height:1px;background:linear-gradient(90deg,var(--border),transparent)}

  .fx-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(460px,1fr));gap:20px}

  .fx-card{background:var(--card);border:1px solid var(--border);border-radius:16px;overflow:hidden;cursor:zoom-in;transition:transform .2s cubic-bezier(.2,.7,.3,1),border-color .2s,box-shadow .2s;display:flex;flex-direction:column}
  .fx-card:hover{transform:translateY(-4px);border-color:rgba(0,230,104,.4);box-shadow:0 14px 38px rgba(0,0,0,.5)}
  .fx-card.prem:hover{border-color:rgba(255,207,122,.4)}
  .fx-ch{padding:15px 17px 12px;display:flex;align-items:flex-start;gap:10px}
  .fx-ct{font-weight:750;font-size:15.5px;line-height:1.25;letter-spacing:.005em}
  .fx-cd{color:var(--muted);font-size:12.5px;line-height:1.5;margin-top:5px}
  .fx-pill{font-size:9.5px;font-weight:700;letter-spacing:.07em;padding:3px 8px;border-radius:999px;white-space:nowrap;flex:0 0 auto;margin-left:auto}
  .fx-pill.free{color:var(--accent);background:rgba(0,230,104,.12);border:1px solid rgba(0,230,104,.28)}
  .fx-pill.prem{color:#ffcf7a;background:rgba(255,207,122,.10);border:1px solid rgba(255,207,122,.28)}

  /* The preview frame.
     NO transform:scale(). The first version pinned each payload to the carousel's
     authored 580px and scaled it to fit the card, which is fine at 2-up on a desktop
     and ruinous on a phone: a 375px screen gives scale(0.55), so 11px type renders at
     6px and the previews become unreadable smudges — worse than the carousel, which is
     the one thing this layout must not be. MEASURED: the payloads carry no hardcoded
     width over 100px, 53 flex/grid layouts and min-widths of 50–66px, i.e. they were
     built to reflow, and the carousel already relies on that (its stage is max-width,
     not fixed). So let them reflow into the card exactly as they reflow into the stage:
     readable at any width, no scaling, and one less thing to keep in sync. */
  .fx-frame{position:relative;height:290px;overflow:hidden;background:#0d0d10;border-top:1px solid var(--border);margin-top:auto}
  .fx-scaler{padding:16px 18px}
  .fx-fade{position:absolute;left:0;right:0;bottom:0;height:96px;background:linear-gradient(180deg,rgba(13,13,16,0),rgba(13,13,16,.82) 46%,#0d0d10);pointer-events:none}
  .fx-expand{position:absolute;right:11px;bottom:10px;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);background:rgba(20,20,26,.9);border:1px solid var(--border);border-radius:7px;padding:5px 9px;pointer-events:none;transition:color .15s,border-color .15s}
  .fx-card:hover .fx-expand{color:var(--accent);border-color:rgba(0,230,104,.45)}
  .fx-card.prem:hover .fx-expand{color:#ffcf7a;border-color:rgba(255,207,122,.45)}

  /* Expand = detail on demand. Nothing is HIDDEN behind it — the preview is already
     on the card; this is just the full-size read. That's the difference between this
     and an accordion. */
  .fx-lb{position:fixed;inset:0;background:rgba(6,6,8,.86);backdrop-filter:blur(3px);z-index:80;display:none;overflow-y:auto;padding:40px 18px}
  .fx-lb.on{display:block}
  .fx-lbin{max-width:640px;margin:0 auto;background:var(--card);border:1px solid var(--border);border-radius:18px;overflow:hidden;animation:fxIn .22s cubic-bezier(.2,.7,.3,1)}
  @keyframes fxIn{from{opacity:0;transform:translateY(10px) scale(.99)}to{opacity:1;transform:none}}
  .fx-lbh{padding:16px 18px 13px;display:flex;align-items:flex-start;gap:10px;border-bottom:1px solid var(--border)}
  .fx-lbstage{background:#0d0d10;padding:20px}
  .fx-x{margin-left:auto;background:none;border:0;color:var(--muted);font-size:22px;line-height:1;cursor:pointer;padding:0 4px}
  .fx-x:hover{color:#f4f5f7}
  .fx-nav{display:flex;gap:8px;padding:12px 18px;border-top:1px solid var(--border)}
  .fx-nb{flex:1;background:rgba(255,255,255,.03);border:1px solid var(--border);color:var(--muted);font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:12px;letter-spacing:.09em;text-transform:uppercase;padding:9px;border-radius:9px;cursor:pointer}
  .fx-nb:hover{color:#f4f5f7;border-color:rgba(255,255,255,.25)}

  .fx-note{max-width:1140px;margin:44px auto 0;padding:16px 22px;color:var(--muted);font-size:12px;line-height:1.65;border-top:1px solid var(--border)}
  .fx-note b{color:#f4f5f7}

  /* The matchup-hub slide's own stylesheet, from worker/matchup-free.js — the same one
     the free /matchup page serves. Measured: 75 selectors, all .mh-/#mh-, no :root. */
${matchupFree.css || ''}

  /* ── BACKGROUND TREATMENTS (prototype only — a switcher, not a decision) ──────
     The page is #0a0a0b below the hero glow, all the way down a 16-card scroll. These
     are the candidates for fixing that. All four are pure CSS — no image, no request,
     no bytes — and all sit on a fixed, pointer-events:none layer BEHIND the content, so
     none of them can touch the data cards' legibility.
     Deliberately NOT included: any visible pattern with a motif. The field down there is
     carrying dense green/gold analytics; a texture with a shape in it competes with the
     numbers, which is the one thing this page cannot afford. */
  #bgfx{position:fixed;inset:0;z-index:0;pointer-events:none;opacity:0;transition:opacity .25s}
  .lp,.fx-wrap,.fx-note{position:relative;z-index:1}

  /* CALIBRATION NOTE, because round one was invisible and that was measurable, not
     subjective. Your hero glow is #12251b over #0a0a0b — a delta of (8,27,16), i.e. about
     12% of accent green over the page. The "glow" I offered was rgba(0,230,104,.055):
     2.2x fainter than the atmosphere you already ship and had already accepted. It looked
     like nothing because it WAS nothing. Everything below is calibrated to ~10-13%.
     (Grain and Grid are gone: rejected. "Both" looked like static because its grain sat
     on an ::after blending against the layer's own gradient rather than against the page,
     so it stacked twice as hard as plain Grain — a bug in my option, not a verdict.) */

  /* THE OCTAGON WAS 1500px AND THAT WAS THE WHOLE PROBLEM.
     Measured: on a 1512x860 laptop only 57% of the shape is inside the window; 46% at
     1280x800; 15% on a phone. So it never read as an octagon — it read as two arcs
     passing through, which is exactly what "big and vague" looks like. Nothing about the
     opacity was wrong. It just didn't fit.
     All three below are sized in vmin, so the shape is COMPLETE at every viewport and
     scales with the window instead of being cropped by it. All three include Aurora —
     the octagon standing in the weather rather than on a flat field. */

  /* AURORA alone — three soft blooms at the hero's own ~12%. */

  /* ── FRAME — the good accident, made deliberate ───────────────────────────────
     The original 1500px octagon looked right for a reason nobody designed: its top edge
     sat ABOVE the window (y=-77 on a 1512x860 screen), so the diagonals swept down THROUGH
     the hero — framing the title — and the verticals landed at x=6 and x=1506, i.e. the
     screen edges, and ran down past the cards. The crop was doing the design work. My
     "fix" — shrinking it to fit — threw exactly that away and replaced it with a tidy
     little badge.
     So: reproduce that geometry on purpose, and then do the thing an octagon can't. The
     shoulders come down and the rails simply KEEP GOING, fading as they fall, instead of
     turning back in to close a shape. An octagon says "here is a logo". Two rails running
     off the bottom of the page say "you are inside this".
       width     98vw    -> verticals ~1vw off each edge, where they were
       top       -70px   -> above the fold, where it was
       shoulders 0.293w  -> ends y~364px at 1512 wide (the original: 362)
     Three background layers, no image, nothing tiling, nothing to crop wrong at any size:
     the shoulders scale with the width, the rails are 1px gradients that fade out. */
  /* --cy: 60px — CHOSEN, not derived. Halfway between the top of the page and the top of
     the eyebrow: the flat cap reads, the diagonals frame the title, and the rails run off
     the bottom. Landed by dragging the slider on a real screen, which is the only
     instrument that could settle it — I picked -70 by maths and it was wrong. */
  html.bg-frame #bgfx{opacity:1;
    --cw:98vw; --cy:60px; --sh:calc(var(--cw) * 0.293); --rail:calc(var(--cy) + var(--sh));
    background:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1000 293' preserveAspectRatio='none'%3E%3Cpath d='M293 0 H707 M293 0 L0 293 M707 0 L1000 293' fill='none' stroke='%2300e668' stroke-opacity='0.30' stroke-width='1.1'/%3E%3C/svg%3E") no-repeat 50% var(--cy)/var(--cw) var(--sh),
    linear-gradient(rgba(0,230,104,.30) 0%,rgba(0,230,104,.10) 45%,rgba(0,230,104,0) 100%) no-repeat calc(50% - var(--cw)/2) var(--rail)/1px 100%,
    linear-gradient(rgba(0,230,104,.30) 0%,rgba(0,230,104,.10) 45%,rgba(0,230,104,0) 100%) no-repeat calc(50% + var(--cw)/2) var(--rail)/1px 100%,
    radial-gradient(900px 700px at 12% 28%,rgba(0,230,104,.085) 0%,transparent 62%),
    radial-gradient(1000px 800px at 88% 58%,rgba(50,120,255,.065) 0%,transparent 62%),
    radial-gradient(1100px 700px at 45% 90%,rgba(0,230,104,.075) 0%,transparent 62%)}

  /* FRAME CLOSED — the same frame, dropped so its flat top edge lands ABOVE the eyebrow
     instead of above the fold. Identical geometry; only --cy moves (-70px -> 88px), which
     is the whole point of parameterising it.
     The trade, stated so it can be judged rather than argued: closing the top makes the
     shape legible — it is unmistakably the top of a cage, framing the title on three
     sides. But it also lands a ~620px horizontal rule directly under the nav, and the
     page's busiest region gains a second horizontal. And it makes the form's logic
     uneven: closed at the top, open at the bottom, which invites "why there and not
     there?". Open at both ends says one thing consistently — you are inside something
     that doesn't fit on the screen. */
  /* MID — the top edge tucked up behind the nav (~40px), so the flat cap is only just
     implied and the diagonals do the framing. Between open and closed. */

  /* THE SLIDER OVERRIDES --cy ON ANY FRAME VARIANT.
     We are three rounds into tuning one number by me guessing a value, you looking, and
     both of us describing pixels in adjectives. I cannot see this page; you can. So the
     number becomes yours. --gl-cy wins wherever it is set. */
  html[style*="--gl-cy"] #bgfx{--cy:var(--gl-cy) !important}


  /* FRAME TIGHT — the same idea pulled in to a column, so the rails hug the grid instead
     of the window. Which one is right depends on whether the frame should feel like the
     room or like the page's own margin — that's an eye question, not a maths one. */

  /* FIT — one complete octagon, 72vmin, sitting behind the hero. The shape you can
     actually recognise, which is the entire point of using a shape. */

  /* RINGS — four concentric octagons: less "a cage" and more an instrument — a radar
     ring, a target, a measuring device. Arguably the most on-brand of the three for a
     site whose whole pitch is that it measures things. */

  /* CORNER — a big octagon bleeding off the right edge. Still cropped, but DELIBERATELY:
     a watermark reads as intentional where a shape that merely didn't fit reads as a
     mistake. Leaves the centre completely clear for the cards. */

  /* ROOMS — not decoration at all: the Premium half gets its own lifted floor, so the two
     tiers read as two places rather than one long list. Structure is usually the honest
     fix when a page "feels flat", and it's the only option here that survives a visitor
     who never looks at the background. */

  #bgpick{position:fixed;left:14px;bottom:14px;z-index:70;display:flex;gap:4px;background:rgba(10,10,11,.92);border:1px solid var(--border);border-radius:999px;padding:5px;backdrop-filter:blur(6px)}
  #bgpick b{font-family:'Barlow Condensed',sans-serif;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);align-self:center;padding:0 7px 0 9px}
  #bgpick button{background:none;border:0;color:var(--muted);font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;padding:6px 11px;border-radius:999px;cursor:pointer}
  #bgpick button:hover{color:#fff}
  #bgpick button.on{background:var(--accent);color:#0a0a0b}

  #cypick{position:fixed;left:14px;bottom:60px;z-index:70;display:flex;align-items:center;gap:9px;background:rgba(10,10,11,.92);border:1px solid var(--border);border-radius:999px;padding:7px 13px;backdrop-filter:blur(6px)}
  #cypick[hidden]{display:none}
  #cypick b{font-family:'Barlow Condensed',sans-serif;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
  #cypick input[type=range]{width:190px;accent-color:var(--accent)}
  #cypick span{font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;color:var(--accent);width:46px;text-align:right}
  #cypick button{background:none;border:0;color:var(--muted);font-size:11px;text-decoration:underline;cursor:pointer;padding:0 2px}
  #cypick button:hover{color:#fff}

  @media (max-width:1000px){ .fx-grid{grid-template-columns:1fr} }
  @media (max-width:560px){
    .fx-h{font-size:29px}
    .fx-frame{height:250px}
    .fx-wrap{padding:0 14px}
  }

${componentCSS}
`;

// Built twice from one builder: once with the debug switcher for local eyeballing, once
// without for /landingpagetest. A separate "clean copy" would be a fork, and the phone
// build is the one that decides whether this ships — it must be the same page.
const page = (debug) => `<!doctype html>
<!-- class="bg-frame" so the page LOADS as the chosen design rather than loading flat and
     flipping once JS runs. The picker's "on" chip must agree with this or the control
     lies about what you're looking at. -->
<html lang="en" class="bg-frame"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>GillyLab — feature grid (${debug ? 'prototype' : 'preview'})</title>
${debug ? '' : '<meta name="robots" content="noindex,nofollow">'}
<!-- AUTO-GENERATED by scripts/gen-showcase-proto.cjs from worker/pages.js.
     DO NOT EDIT. This is a layout prototype: the previews below are the REAL slide
     payloads, sliced from the live landing page, so what you're judging is the
     product and not a mockup of it. Edit the generator, or pages.js. -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Barlow:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>${css}</style>
</head><body>

<div id="bgfx"></div>
${debug ? `
<!-- Prototype-only: flip the page background between the candidates. Not part of the
     design — a way to answer "is flat black a problem, and which fix is least bad"
     with your eyes instead of my adjectives. Whichever wins becomes ~2 lines in
     worker/pages.js; the rest of this goes in the bin. -->
<div id="bgpick">
  <b>Background</b>
  <button type="button" data-bg="">Flat</button>
  <button type="button" data-bg="bg-frame" class="on">Frame</button>
</div>

<div id="cypick">
  <b>Top edge</b>
  <input type="range" id="cy" min="-140" max="150" step="2" value="60">
  <span id="cyv">60px</span>
  <button type="button" id="cyreset">reset</button>
</div>
<script>
(function(){
  var pick=document.getElementById('bgpick');
  var cyBox=document.getElementById('cypick'), cy=document.getElementById('cy'),
      cyv=document.getElementById('cyv'), cyreset=document.getElementById('cyreset');
  // The default --cy each frame variant ships with, so "reset" means something and the
  // slider starts where the variant actually is rather than at an arbitrary number.
  // 60px: chosen on a real screen, halfway between the top of the page and the eyebrow.
  // The slider stays so it can be re-checked, but this is the number.
  var DEF={'bg-frame':60};

  function setCy(v){
    document.documentElement.style.setProperty('--gl-cy', v+'px');
    cy.value=v; cyv.textContent=v+'px';
    try{ localStorage.setItem('glBgCy', v); }catch(_){}
  }
  // useSaved ONLY on first load. Reading localStorage on every variant click meant the
  // saved slider value clobbered each variant's own --cy, so Frame·mid and Frame·closed
  // both rendered at -70px — identical to Frame·open. Three buttons, one picture, and
  // nothing to tell you they weren't working. Clicking a variant now means "show me THAT
  // variant"; the slider is for tuning it afterwards.
  function syncCyBox(mode, useSaved){
    var isFrame = /^bg-frame/.test(mode||'');
    cyBox.hidden = !isFrame;
    if(!isFrame){ document.documentElement.style.removeProperty('--gl-cy'); return; }
    var saved=null;
    if(useSaved){ try{ saved=localStorage.getItem('glBgCy'); }catch(_){} }
    setCy(saved!=null ? +saved : DEF[mode]);
  }
  cy.addEventListener('input',function(){ setCy(+cy.value); });
  cyreset.addEventListener('click',function(){
    try{ localStorage.removeItem('glBgCy'); }catch(_){}
    var on=pick.querySelector('button.on');
    setCy(DEF[on&&on.getAttribute('data-bg')] || -70);
  });

  pick.addEventListener('click',function(e){
    var b=e.target.closest('button[data-bg]'); if(!b) return;
    var mode=b.getAttribute('data-bg');
    document.documentElement.className=mode;
    Array.prototype.forEach.call(pick.querySelectorAll('button'),function(x){x.classList.toggle('on',x===b);});
    try{ localStorage.setItem('glBgFx', mode); localStorage.removeItem('glBgCy'); }catch(_){}
    syncCyBox(mode, false);
  });
  // Remember the choice across reloads, so you can live with one for a while. On LOAD the
  // saved slider value does apply — that's the point of saving it. It's only a variant
  // CLICK that resets to that variant's own default.
  // Sync ALWAYS, not only when there's saved state. The first version only ran this
  // inside the saved-state branch, so on a clean load the slider kept the -70px baked
  // into the markup while the frame actually rendered at its 60px default — the control
  // reporting a number the page wasn't using. A lying control is worse than no control:
  // every judgement made with it is against the wrong value.
  var savedFx=null, savedCy=null;
  try{ savedFx=localStorage.getItem('glBgFx'); savedCy=localStorage.getItem('glBgCy'); }catch(_){}
  var mode = savedFx!=null ? savedFx : document.documentElement.className;
  var b = pick.querySelector('button[data-bg="'+mode+'"]');
  if(!b){ mode='bg-frame'; b=pick.querySelector('button[data-bg="bg-frame"]'); }
  document.documentElement.className=mode;
  Array.prototype.forEach.call(pick.querySelectorAll('button'),function(x){x.classList.toggle('on',x===b);});
  syncCyBox(mode, true);
})();
</script>
` : ''}
<div class="lp">
${navMarkup}
</div>
<script>${navScript}</script>

<div class="fx-wrap">
  <div class="fx-top">
    <div class="fx-eyebrow">${HERO_EYEBROW}</div>
    <h1 class="fx-h">${HERO_TITLE}</h1>
    <p class="fx-sub">${HERO_HOOK}</p>
    <!-- "Compare plans" anchored to #plans, which lives on the real landing page but not
         in this slice — a button that did nothing. Replaced with Go Premium, which goes
         somewhere real (/signup?next=/subscribe — the same target the footer CTA uses,
         so the two agree). -->
    <div class="fx-cta">
      <a class="fx-btn" href="/signup">Start free →</a>
      <a class="fx-btn ghost" href="/signup?next=/subscribe">Go Premium →</a>
      <a class="fx-btn ghost" href="/login">Log in</a>
    </div>
    <p class="fx-trust">${HERO_TRUST.replace('{PRICE}', PRICE_LABEL)}</p>
    <div class="fx-filter" id="flt" role="tablist"></div>
  </div>
  <div id="tiers"></div>
</div>

<div class="lp">
  ${footCTA}
  ${siteFooter}
</div>

<div class="fx-note">
  <b>Prototype.</b> The previews are sliced live out of <b>worker/pages.js</b> — same payloads the carousel renders today, and the nav and footer are the real ones.
  What changed is only the layout: no auto-advance, no dots, nothing hidden behind a click. Compare against the carousel on the live landing page.
</div>

<div class="fx-lb" id="lb"><div class="fx-lbin" id="lbin"></div></div>

<script>
(function(){
${slideJS}

  // ── the grid ───────────────────────────────────────────────────────────────
  // Everything above this line is the landing page's own code, untouched. Only the
  // rendering below is new: the carousel's driver (dots, 7s timer, swipe) is gone.
  var tiers = document.getElementById('tiers'), flt = document.getElementById('flt');
  var lb = document.getElementById('lb'), lbin = document.getElementById('lbin');
  var cur = 0;

  var free = slides.filter(function(s){ return s.f; });
  var prem = slides.filter(function(s){ return !s.f; });

  // FREE / PREMIUM ARE JUMP LINKS, NOT FILTERS — and that is the whole reason the "All"
  // chip could go.
  //
  // Dropping "All" from a three-way filter forces a default, and the only available
  // default hides one tier: land on Free and 11 of 16 features are behind a click; land
  // on Premium and the free tier is invisible to the person you most want to convert.
  // That is the accordion this layout exists to replace, wearing a different hat — the
  // argument was never "fewer clicks", it was that the previews ARE the pitch and a
  // stranger will not click to see your pitch.
  //
  // So both blocks always render and these two scroll to them. Two chips, nothing
  // hidden, and the count still answers "what do I get for nothing?" at a glance.
  // If you'd rather they genuinely filter, it is the paint() call below and one line.
  [['free','Free',free.length],['prem','Premium',prem.length]].forEach(function(o){
    var b=document.createElement('button');
    b.className='fx-fb'; b.type='button';
    b.innerHTML=o[1]+'<span class="n">'+o[2]+'</span>';
    b.onclick=function(){
      var band=document.getElementById('band-'+o[0]);
      if(band) band.scrollIntoView({behavior:'smooth',block:'start'});
    };
    flt.appendChild(b);
  });

  // Keep the chip matching whatever band you're actually looking at, so the control
  // reports position rather than just firing and forgetting.
  function spy(){
    var f=document.getElementById('band-free'), p=document.getElementById('band-prem');
    if(!f||!p) return;
    var onPrem = p.getBoundingClientRect().top <= 120;
    Array.prototype.forEach.call(flt.children,function(c,i){ c.classList.toggle('on', i===(onPrem?1:0)); });
  }
  window.addEventListener('scroll', spy, {passive:true});

  function card(s){
    var i = slides.indexOf(s);
    var el = document.createElement('div');
    el.className = 'fx-card' + (s.f ? '' : ' prem');
    el.innerHTML =
      '<div class="fx-ch"><div><div class="fx-ct">'+s.t+'</div><div class="fx-cd">'+s.d+'</div></div>'
      + '<span class="fx-pill '+(s.f?'free':'prem')+'">'+(s.f?'FREE':'PREMIUM')+'</span></div>'
      + '<div class="fx-frame"><div class="fx-scaler">'+s.h+'</div>'
      + '<div class="fx-fade"></div><div class="fx-expand">Expand ↗</div></div>';
    el.onclick = function(){ open(i); };
    return el;
  }

  function band(label, cls, n, note){
    var d=document.createElement('div'); d.className='fx-band'; d.id='band-'+cls;
    d.innerHTML='<span class="fx-bt '+cls+'">'+label+'</span><span class="fx-bn">'+n+' features · '+note+'</span><span class="fx-bl"></span>';
    return d;
  }

  function grid(list){
    var g=document.createElement('div'); g.className='fx-grid';
    list.forEach(function(s){ g.appendChild(card(s)); });
    return g;
  }

  function tier(key,label,list,note){
    var sec=document.createElement('section');
    sec.className='fx-tier'; sec.setAttribute('data-tier',key);
    sec.appendChild(band(label,key,list.length,note));
    sec.appendChild(grid(list));
    return sec;
  }
  function paint(){
    tiers.innerHTML='';
    tiers.appendChild(tier('free','Free',free,'no card required'));
    tiers.appendChild(tier('prem','Premium',prem,'the full database and every tool'));
    spy();
  }

  function open(i){
    cur=i; var s=slides[i];
    lbin.innerHTML =
      '<div class="fx-lbh"><div><div class="fx-ct">'+s.t+'</div><div class="fx-cd">'+s.d+'</div></div>'
      + '<span class="fx-pill '+(s.f?'free':'prem')+'">'+(s.f?'FREE':'PREMIUM')+'</span>'
      + '<button class="fx-x" type="button" aria-label="Close">×</button></div>'
      + '<div class="fx-lbstage">'+s.h+'</div>'
      + '<div class="fx-nav"><button class="fx-nb" type="button" id="pv">‹ Prev</button><button class="fx-nb" type="button" id="nx">Next ›</button></div>';
    lb.classList.add('on'); document.body.style.overflow='hidden';
    lbin.querySelector('.fx-x').onclick=close;
    document.getElementById('pv').onclick=function(e){e.stopPropagation();open((cur-1+slides.length)%slides.length);};
    document.getElementById('nx').onclick=function(e){e.stopPropagation();open((cur+1)%slides.length);};
  }
  function close(){ lb.classList.remove('on'); document.body.style.overflow=''; }
  lb.onclick=function(e){ if(e.target===lb) close(); };
  document.addEventListener('keydown',function(e){
    if(!lb.classList.contains('on')) return;
    if(e.key==='Escape') close();
    if(e.key==='ArrowLeft') open((cur-1+slides.length)%slides.length);
    if(e.key==='ArrowRight') open((cur+1)%slides.length);
  });

  paint();
  window.SHOWCASE_PROTO={slides:slides,free:free.length,prem:prem.length};  // for the test
})();
</script>
</body></html>`;

const html = page(true);
const preview = page(false);

// Guard the split: the phone build must be the SAME page minus the debug chrome. If the
// switcher ever leaks into the served route, the first person to see it is a visitor.
if (/id="bgpick"|id="cypick"|glBgFx/.test(preview)) throw new Error('the debug switcher leaked into the /landingpagetest build');
if (!/noindex/.test(preview)) throw new Error('the preview route must be noindex — it is a duplicate of the landing page');
if (!/id="bgfx"/.test(preview) || !/bg-frame/.test(preview)) throw new Error('the preview lost the frame background');
if (Math.abs(preview.length - html.length) > 4500) throw new Error('preview and prototype differ by more than the debug chrome (' + (html.length - preview.length) + 'b) — something else was dropped');

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);

// The Worker module. A template literal would need every backtick and ${ inside the page
// escaped — and an unescaped backtick in a template literal is precisely what broke
// worker/pages.js today. JSON.stringify cannot make that mistake.
fs.writeFileSync(OUT_WORKER,
  '// AUTO-GENERATED by scripts/gen-showcase-proto.cjs — do not edit by hand.\n' +
  '// The candidate landing page, served at /landingpagetest so it can be judged on a real\n' +
  '// phone before it replaces /. Same builder as prototypes/landing-showcase.html, minus\n' +
  '// the debug switcher. TEMPORARY: when the design ships into landingPage(), delete this\n' +
  '// file, its route in worker/index.js, and the generator step in the workflow.\n' +
  'export const landingTestPage = () => ' + JSON.stringify(preview) + ';\n');

console.log('prototypes/landing-showcase.html  ' + (html.length / 1024).toFixed(0) + 'KB' +
  '  (slide code ' + (slideJS.length / 1024).toFixed(0) + 'KB sliced from pages.js · component css ' + (componentCSS.length / 1024).toFixed(0) + 'KB)');
