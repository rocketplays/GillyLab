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
// The same page, emitted as a Worker module so it can be served at "/" — it is the
// a real URL on a real phone, which is the only way to judge this before it replaces /.
//
// It needs a ROUTE and cannot just be the file above: wrangler.toml sets
// run_worker_first, so the Worker gates every request and public/ is only served to a
// subscribed session (bar the PUBLIC_LANDING_ASSETS allowlist). prototypes/ is copied
// into public/ by build-site.sh but is NOT reachable logged-out — I claimed otherwise
// earlier having read build-site.sh and not wrangler.toml.
const OUT_WORKER = path.join(ROOT, 'worker', 'landing-grid.js');
// The /subscribe premium-features module: the same grid this page renders, scoped to the
// premium groups, extracted so /subscribe shows the identical cards + expand. Replaces the
// old carousel-data.js / gen-carousel.cjs.
const OUT_SUBSCRIBE = path.join(ROOT, 'worker', 'subscribe-features.js');

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
const HERO_TRUST = 'Free to start, no card required — play The Climb and Pick’em. Premium is {PRICE}, cancel anytime.';

// ── the two numbers you dialled in on a real phone ───────────────────────────
// ONE CONSTANT EACH, used by the CSS *and* the slider. They were separate values and
// they drifted the moment I changed one: the CSS said --cy:86px while the slider's
// default said 96 and applied it with !important on load, so the page rendered at 96 and
// the 86 in the stylesheet was decoration. Two sources of truth for one number is how you
// get a control that lies and a value that isn't used. Derive the control from the value.
const FRAME_CY = 86;    // px from the top of the page to the octagon's flat cap
const AURORA = 0.90;    // multiplier on the .09/.07/.08 bloom baseline
const AURA = (base) => (base * AURORA).toFixed(3).replace(/0+$/, '');

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
// The marker has to be the WHOLE `var LD=${…};` statement, because the slice starts at
// it and anything left over would ship an unresolved ${…} into the prototype (the guard
// below catches that). But the expression inside is not stable: it was
// JSON.stringify(landingData), and became JSON.stringify(currentLanding()) when the
// finished-card hold moved the choice of card to request time — which broke this
// generator with "start marker not found". So find the statement by SHAPE and use
// whatever it currently says as the literal marker.
const LD_RE = /var LD=\$\{JSON\.stringify\([^;]*\)\};/;
const LD_MARK = (LD_RE.exec(idx.slice(LP)) || [])[0];
if (!LD_MARK) throw new Error('the `var LD=${JSON.stringify(…)};` statement is gone from landingPage — the slide payload can no longer be located');
let slideJS = between(LD_MARK, SLIDES_END, true);

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
// LD_MARK, not a hardcoded copy of the statement — same reason it's derived above.
slideJS = slideJS.replace(LD_MARK, 'var LD=' + landingData + ';');

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
let componentCSS = [
  between('  /* Faithful in-app component styles */', '  @media (max-width:760px){', false).trimEnd(),
  between('  /* Featured-fighter slide', '  /* Free vs Premium plans */', false).trimEnd(),
  '  .fsx-val.bad{color:#c76a54}',
].join('\n');

// THE STRAY-${} GUARD ONLY EVER COVERED slideJS, NEVER THE CSS — so this block carried
// pages.js line 558 across VERBATIM:
//     ${matchupFree && matchupFree.css ? matchupFree.css : ''}
// In pages.js that resolves at render. Sliced into a static page it is just text, and it
// sat in the stylesheet at ~offset 63043 where a selector should be. Trap #2: CSS has no
// syntax errors, it has recovery — the parser drops it and the rule after it, silently.
// It never mattered while this was a prototype nobody indexed. It matters now that this
// block IS the landing page. matchupFree.css is already interpolated further up (the
// ${matchupFree.css || ''} line in the css template), so the correct resolution here is
// to drop the duplicate rather than resolve it twice.
const STRAY = "${matchupFree && matchupFree.css ? matchupFree.css : ''}";
if (!componentCSS.includes(STRAY)) throw new Error('the matchupFree.css interpolation is no longer in the component CSS slice — this rewrite is dead, check pages.js line ~558');
componentCSS = componentCSS.split(STRAY).join('');
if (/\$\{/.test(componentCSS)) throw new Error('an unresolved ${…} survived into the component CSS: ' + /\$\{[^}]{0,60}/.exec(componentCSS)[0]);

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

// AND THE html RULE, which I forgot, and which is why the phone showed white bands.
// The live page carries `html{background:var(--bg);scroll-behavior:smooth}`. I sliced
// body{} and stopped, so the ROOT element went unpainted here. body's background does
// propagate to the canvas — which is why this looked fine on a desktop — but rubber-band
// past the top or bottom on iOS and you are looking at the root, and my fixed #bgfx layer
// stops dead at the viewport edge. Hence white. Slice both; assume neither.
const htmlRule = between('  html{', '}', true);
if (!/background/.test(htmlRule)) throw new Error('the html{} slice has no background — the page would overscroll to white');

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
  .replace(/\$\{PRICE_LABEL\}/g, PRICE_LABEL)
  // Give the footer "Start free" the same events-page look as the hero one (see .fx-cta-free).
  .replace('<a class="big ghost" href="/signup">Start free →</a>', '<a class="big ghost fx-cta-free" href="/signup">Start free →</a>')
  // Footer "Go Premium" was a solid-green .big; make it ghost to match the hero one.
  .replace('<a class="big" href="/signup?next=/subscribe">Go Premium →</a>', '<a class="big ghost" href="/signup?next=/subscribe">Go Premium →</a>');
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
  ${htmlRule}
  /* (An overscroll-behavior:none lock lived here. It was a fix for the wrong diagnosis —
     the black bands are the browser's own chrome, not rubber-band — and it would have
     killed the native bounce for no reason. Removed. See the theme-color meta instead.) */
  /* overscroll-behavior lives INSIDE this rule, not in a body{} of its own above it: a
     second body rule would be the FIRST body{} in the file, and the checks that assert
     this page uses the real sliced background and font stack read the first one they find.
     They failed on correct CSS. Two rules for one element is how you get a test reading
     the wrong half of a cascade. */
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
  /* margin-top 58, not 30. The cap has to sit BETWEEN the nav (ends 70px) and the eyebrow,
     and at 30px that gap was 30px wide — no line fits in there without appearing to touch
     one of them. Nudging --cy could never fix it; the gap was the problem. At 58 the
     eyebrow starts at 128 and the cap has ~26px of clearance either side. */
  .fx-top{text-align:center;margin:58px 0 26px}
  .fx-eyebrow{display:inline-block;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--accent);background:rgba(0,230,104,.1);border:1px solid rgba(0,230,104,.25);border-radius:100px;padding:5px 13px;margin-bottom:16px}
  .fx-h{font-family:'Barlow Condensed',sans-serif;font-size:52px;font-weight:700;line-height:1.02;letter-spacing:.004em}
  .fx-sub{color:rgba(255,255,255,.62);font-size:15px;margin-top:13px;max-width:545px;margin-left:auto;margin-right:auto;line-height:1.6}
  .fx-cta{display:flex;gap:10px;justify-content:center;margin-top:20px;flex-wrap:wrap}
  .fx-btn{font-size:14px;font-weight:800;color:#04120a;background:var(--accent);border-radius:10px;padding:11px 18px;display:inline-block;transition:background .15s}
  .fx-btn:hover{background:#12f277}
  .fx-btn.ghost{background:transparent;color:rgba(255,255,255,.8);border:1px solid rgba(255,255,255,.16)}
  .fx-btn.ghost:hover{color:#fff;border-color:rgba(255,255,255,.34);background:rgba(255,255,255,.04)}
  /* "Start free" gets the events-page deep-dive / Climb·Pick'em look — a green-tinted panel
     with a green border instead of a solid fill (.ftab-pick in pages.js). Applied to both
     the hero button (.fx-btn) and the footer one (.big.ghost); the two-class selectors
     out-specify each base rule so it wins without !important. */
  .fx-btn.fx-cta-free, .big.ghost.fx-cta-free{background:linear-gradient(180deg,rgba(0,230,104,.09),rgba(0,230,104,.03));border:1px solid rgba(0,230,104,.35);color:#f4f5f7}
  .fx-btn.fx-cta-free:hover, .big.ghost.fx-cta-free:hover{background:linear-gradient(180deg,rgba(0,230,104,.18),rgba(0,230,104,.07));border-color:var(--accent)}
  .fx-trust{color:var(--muted);font-size:12px;margin-top:13px}
  @media (max-width:560px){ .fx-h{font-size:36px} }

  /* STICKY — the chips ride with you through the grid.
     They used to scroll away with the hero, so for five screens you had no idea which
     tier you were in or how much was left. Pinned, they answer three things at once:
     where am I (the active chip, which spy() was already computing and had nowhere to
     show), how much is left (the counts), and how do I get out (tap Premium, skip the
     Free block). Costs ~46px of a 844px phone — about 5% — and buys orientation through
     the longest part of the page.
     The blur/background is not decoration: cards scroll UNDER this, and without an opaque
     backing the counts sit on top of a moving preview and become unreadable. */
  /* The heading's tier badge. One per group instead of one per card: the signifier sits
     where the decision is — "this whole section is Premium" — not stapled to fifteen
     cards that all say the same thing. Green FREE, gold PREMIUM, the palette's existing
     two meanings and no new ones. */
  .fx-btag{font-size:9px;font-weight:800;letter-spacing:.09em;padding:3px 8px;border-radius:999px;white-space:nowrap;flex:0 0 auto}
  .fx-btag.free{color:var(--accent);background:rgba(0,230,104,.12);border:1px solid rgba(0,230,104,.3)}
  .fx-btag.prem{color:#ffcf7a;background:rgba(255,207,122,.10);border:1px solid rgba(255,207,122,.3)}

  .fx-fb{background:none;border:0;color:var(--muted);font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:12.5px;letter-spacing:.1em;text-transform:uppercase;padding:7px 17px;border-radius:999px;cursor:pointer;transition:color .15s,background .15s}
  .fx-fb:hover{color:#f4f5f7}
  .fx-fb.on{background:var(--accent);color:#0a0a0b}
  .fx-fb .n{opacity:.6;font-size:11px;margin-left:5px}

  /* Tier band — the thing the carousel could never say, because its tag changed every
     7 seconds: here's the line, and here's which side each feature is on. */
  /* scroll-margin-top clears the sticky bar. Without it, tapping a chip scrolls the band
     to y=0 — directly underneath the bar that's pinned there — so the thing you asked to
     see is the one thing hidden. */
  .fx-band{display:flex;align-items:center;gap:13px;margin:34px 0 16px;scroll-margin-top:58px}
  .fx-band:first-of-type{margin-top:26px}
  .fx-bt{font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap}
  .fx-bt.free{color:var(--accent)}
  .fx-bt.prem{color:#ffcf7a}
  .fx-bn{font-size:12px;color:var(--muted);white-space:nowrap}
  /* Each rule fades AWAY from the title — solid where it meets the words, gone at the
     margin. That direction is the whole effect: it reads as the heading anchoring a line
     that trails off, not as a line with a label parked on it.
     Desktop: the left rule is hidden and the arrangement is label · badge · note · ————,
     which is what it has always been. The explicit orders below are what let the same
     markup become ———— · label · badge · ———— over the note on a phone. */
  .fx-bl{flex:1;height:1px}
  .fx-bl.l{display:none;background:linear-gradient(90deg,transparent,var(--border))}
  .fx-bl.r{background:linear-gradient(90deg,var(--border),transparent)}
  .fx-bt{order:1} .fx-btag{order:2} .fx-bn{order:3} .fx-bl.r{order:4}

  /* EVERY GROUP IS A HORIZONTAL ROW — on desktop as well as on a phone. The row scrolls: you
     swipe it on touch, and on a desktop the per-row arrow buttons (built in the script) page
     through it. Same card basis for every card, the matchup hub included — no card spans the
     row now. The fixed basis is what leaves the next card peeking past the edge, the
     affordance that says "there's more, keep going." Card width is overridden to 86vw on the
     phone in the max-width:720px block below. */
  .fx-grid{
    display:flex; gap:20px;
    overflow-x:auto; overscroll-behavior-x:contain;
    scroll-snap-type:x proximity; -webkit-overflow-scrolling:touch;
    scrollbar-width:none; padding:0 0 4px;
  }
  .fx-grid::-webkit-scrollbar{display:none}
  .fx-card{flex:0 0 clamp(320px,32vw,432px); scroll-snap-align:start}

  /* Per-row scroll arrows. Desktop only, and only shown (the script toggles .show) when the
     row actually overflows — a group of three that already fits gets none. They sit over the
     card band, centred on the preview, and disable at each end of the scroll. */
  .fx-rowwrap{position:relative}
  .fx-arrow{position:absolute;top:calc(50% + 22px);transform:translateY(-50%);z-index:4;width:42px;height:42px;border-radius:999px;display:none;align-items:center;justify-content:center;background:rgba(18,18,22,.86);border:1px solid rgba(0,230,104,.55);color:#f4f5f7;font-size:20px;line-height:1;cursor:pointer;backdrop-filter:blur(5px);transition:background .15s,opacity .15s,border-color .15s}
  .fx-arrow:hover{background:rgba(0,230,104,.12);border-color:var(--accent)}
  .fx-arrow.prev{left:-8px}
  .fx-arrow.next{right:-8px}
  .fx-arrow:disabled{opacity:.28;cursor:default}
  @media (min-width:721px){ .fx-arrow.show{display:flex} }

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

  /* THE ONE PAYLOAD THAT DOES NOT REFLOW.
     I removed transform:scale() from every card because the slide payloads are flex/grid
     and reflow happily — measured: no hardcoded width over 100px. The matchup hub is the
     exception and it is not a small one: it is authored for the modal's real
     width:min(1040px,94vw), and .mh-grid has four fixed tracks
     (var(--mh-rail) 1fr 1fr 1fr). It cannot reflow. Handed 520px it wraps every label and
     squashes the tiles into rubble — which is what "it's broken" looked like.
     So this card alone gets the original treatment: render at the true 1040px and scale
     the whole thing down to fit. That is right HERE and wrong everywhere else, which is
     why it is one class and not a global. */
  /* THE HUB IS A NORMAL-WIDTH CARD NOW — same basis as its neighbours in the row, no span.
     It still can't reflow (fixed 1040px tracks), so it renders at 1040 and the script scales
     it down to the card's width; it keeps the same frame height as every other card so it
     sits the same size on the shelf. Just a smaller, faithful thumbnail — tap to expand for
     the full 1040px read. */
  .fx-card.wide .fx-scaler{width:1040px;transform-origin:top left;padding:14px 16px}

  /* BELOW 720px, DO NOT SCALE IT — LET IT REFLOW.
     matchup-free.css has its own phone block: .mh-grids collapses to one column, the
     header wraps instead of shrinking, the tabs and body tighten. That is how the real
     modal survives a 390px screen, and it keys on VIEWPORT width — which is also why the
     desktop card needed scaling in the first place: at a 1512px viewport the payload uses
     its desktop layout no matter how narrow the box around it is.
     So under 720px the media query is already doing the work; scaling on top of it would
     shrink an already-correct layout to 35%. Hand it the card's width and get out of the
     way — exactly what the modal does. */
  @media (max-width:720px){
    .fx-card.wide .fx-scaler{width:auto;transform:none !important;padding:12px 13px}
    /* The hub keeps a taller frame than its neighbours here too: it reflows into a header,
       tabs and two stacked grids, and 172px showed the header and nothing else — a preview
       of a modal that never previewed the modal. Same stale 15-card tax as the rule above. */
    .fx-card.wide .fx-frame{height:330px}
  }
  .fx-fade{position:absolute;left:0;right:0;bottom:0;height:96px;background:linear-gradient(180deg,rgba(13,13,16,0),rgba(13,13,16,.82) 46%,#0d0d10);pointer-events:none}
  .fx-expand{position:absolute;right:11px;bottom:10px;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);background:rgba(20,20,26,.9);border:1px solid var(--border);border-radius:7px;padding:5px 9px;pointer-events:none;transition:color .15s,border-color .15s}
  .fx-card:hover .fx-expand{color:var(--accent);border-color:rgba(0,230,104,.45)}
  .fx-card.prem:hover .fx-expand{color:#ffcf7a;border-color:rgba(255,207,122,.45)}

  /* Expand = detail on demand. Nothing is HIDDEN behind it — the preview is already
     on the card; this is just the full-size read. That's the difference between this
     and an accordion. */
  /* SCROLL LOCK, iOS-shaped.
     body{overflow:hidden} does not hold on iOS Safari — it never has — so the page kept
     scrolling behind the expanded card. The usual fix is body{position:fixed;top:-scrollY},
     but that would be a bug here: #bgframe is absolutely positioned against BODY, so
     making body fixed collapses its containing block to the viewport and the rails would
     snap from full-document height to one screen, mid-interaction.
     So: lock the ROOT instead (which modern iOS does respect), and give the lightbox
     overscroll-behavior:contain so its own scroll doesn't chain out to the page behind it.
     body is left completely alone, and #bgframe never notices. */
  html.fx-locked{overflow:hidden}
  /* opacity+visibility, NOT display:none/block, so the expand fades BOTH ways. display
     can't transition, so the old version popped open and popped shut; visibility can, and
     it still removes the overlay from hit-testing when hidden. The inner keeps its fxIn
     slide, re-triggered in open() so it replays on every expand, not just the first. */
  /* text-size-adjust:100% on the modal itself, not just the page: on /subscribe the shell
     wraps this in .sub-cx, and mobile Blink was font-boosting the modal's text ~1.2x (title,
     stat bars and labels all too big, so the description and headings wrapped and it looked
     squished). The standalone landing page never triggered it. Pinning it here keeps the two
     modals byte-identical regardless of the page around them. */
  .fx-lb{position:fixed;inset:0;background:rgba(6,6,8,.86);backdrop-filter:blur(3px);z-index:80;opacity:0;visibility:hidden;transition:opacity .22s ease,visibility .22s ease;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:40px 18px;-webkit-text-size-adjust:100%;text-size-adjust:100%}
  .fx-lb.on{opacity:1;visibility:visible}
  .fx-lbin{max-width:640px;margin:0 auto;background:var(--card);border:1px solid var(--border);border-radius:18px;overflow:hidden;animation:fxIn .22s cubic-bezier(.2,.7,.3,1)}
  /* Expanded, the hub gets the width the real modal gets — min(1040px,94vw), lifted from
     index.html. 640px is what made it wrap on expand: I was showing a 1040px component in
     a 640px box and reading the result as a bug in the component. */
  .fx-lb.wide .fx-lbin{max-width:min(1040px,94vw)}
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
  /* TWO LAYERS, and the split is the point.
     #bgfx is FIXED and carries the aurora only — atmosphere should stay put as you scroll.
     #bgframe is ABSOLUTE and carries the octagon cap + the rails, so the cap is anchored
     to the top of the DOCUMENT and scrolls away, leaving only the two rails running down
     past the features. Previously everything was fixed, so the cap rode down the page with
     you and was still framing the title when you were four screens into the grid. */
  /* z-index:-1, not 0 (2026-07-18). This is a position:FIXED full-viewport layer. At
     z-index:0 iOS treated it as chrome ABOVE the floating URL bar and painted the bottom
     safe area solid black instead of letting the page show through — the exact black band
     the owner reported, and the one structural difference from the auth/public pages, whose
     #bgfx is already -1. Negative z-index reads as background the bar composites through.
     Still below the content either way, so nothing above it changes. */
  #bgfx{position:fixed;inset:0;z-index:-1;pointer-events:none;opacity:0;transition:opacity .25s}

  /* #bgedge — PAINT the page's top and bottom back to #0a0a0b, don't mask a layer.
     iOS paints the status bar and the URL bar flat. theme-color only ASKS the browser to
     match us, and one colour cannot match two differently-lit edges anyway — so the page
     matches THEM instead, and the seam has nothing left to mismatch.
     My first attempt masked #bgfx, and it failed for a reason worth keeping: there are
     THREE things tinting these edges — the aurora on #bgfx, the frame's rails on #bgframe,
     and body's own radial hero glow, which is sliced from the live page and paints ~#0e1612
     at y=0. A mask only ever covers the layer you put it on. I masked the layer I built and
     forgot the one I sliced, so the top stayed green.
     An opaque wash sitting ABOVE all three cannot make that mistake: whatever is under it,
     the first and last 100px of the viewport end up #0a0a0b. z-index 0 keeps it beneath the
     content (z-index 1+), and fixed means the clean edge follows the screen at any scroll
     position.
     inset:0, AND IT STAYS THAT WAY. I swapped this to height:100dvh to chase the bottom
     edge and it broke the top — which had been perfect. Reverted. The rule I keep having
     to relearn: do not touch the half that works to fix the half that doesn't.
     THE BOTTOM IS FIXED BY THE GRADIENT, NOT THE BOX. A position:fixed element on iOS is
     sized to the LARGE viewport (URL-bar-hidden), so this element's bottom edge sits under
     the URL bar and a 100px bottom fade plays out where you cannot see it. Rather than
     resize the box — which is what cost me the top — the bottom fade simply starts much
     earlier: 260px up, so by the visible bottom (~60px above the box's edge) it is already
     ~77% of the way to var(--bg). Longer fade, softer landing, and the top's 100px is
     untouched. */
  /* z-index:-1, LOWERED ON PURPOSE (2026-07-18). At z-index:0 this wash painted ABOVE the
     non-positioned content and masked the top 100px / bottom 260px to #0a0a0b — the clean
     black edges. The owner wanted the OPPOSITE: content visible through the status bar and
     the URL bar, edge-to-edge, the same see-through look the auth/public pages have. Behind
     the content it no longer masks; it only keeps the aurora off the extreme edges. The
     solid html{background:var(--bg)} still keeps the true insets / overscroll dark. */
  #bgedge{position:fixed;inset:0;z-index:-1;pointer-events:none;
    background:linear-gradient(180deg,var(--bg) 0,transparent 100px,transparent calc(100% - 260px),var(--bg) 100%)}
  #bgframe{position:absolute;top:0;left:0;right:0;bottom:0;z-index:0;pointer-events:none;opacity:0}
  /* the containing block for #bgframe — without this, absolute resolves against the
     viewport and the rails would stop one screen down. */
  body{position:relative}

  /* .lp ABOVE .fx-wrap, and this is not cosmetic.
     Both used to be z-index:1. Equal z-index means DOM order decides, .fx-wrap comes
     later, so the grid painted over the whole nav — and the dropdown's z-index:60 could
     not save it, because 60 only competes INSIDE .lp's stacking context. The menu was
     opening behind the page. That was caused by this very rule, which I added to keep the
     background behind the content and didn't think through. */
  .lp{position:relative;z-index:20}
  .fx-wrap,.fx-note{position:relative;z-index:1}

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
  /* THE AURORA IS SIZED IN vw NOW, AND THAT IS THE WHOLE FIX FOR "IT JUST LOOKS GREEN".
     It was 900/1000/1100px — fixed. On a 1512 desktop a 900px bloom is 60% of the width
     and reads as a bloom. On a 390px phone it is 231% of the width: you never see the
     falloff, only the flat core, edge to edge, three of them overlapping. That isn't a
     bright aurora, it's a green fill. Exactly the same fixed-px mistake as the 1500px
     octagon, made twice in one page. Everything atmospheric here is relative now, and
     the alpha drops again on small screens where three blooms share far less area. */
  /* AURORA — fixed, atmosphere only.
     I CUT THIS TWICE AND THE CUTS MULTIPLIED. The green wash was caused by SIZE: 900px
     blooms are 231% of a phone's width, so you saw the flat core, not the falloff.
     Switching to 60vw fixed that outright. Halving the alpha underneath (.085 -> .045)
     was me treating a symptom I had already cured — area x0.07 AND alpha x0.53 on a
     phone, which is how "too green" became "black again" in one step. The alpha stays put
     now; only the size is responsive, because only the size was ever wrong.
     Calibrated against the hero glow the page already ships: #12251b over #0a0a0b is
     ~12% accent green, so ~.09 for the brightest bloom sits just under the atmosphere
     you already accepted.
     --aur is a live multiplier for the slider — this is the number I have been worst at
     guessing, so it gets a knob rather than another round of adjectives. */
  html.bg-frame #bgfx{opacity:1;
    /* .068/.053/.060 = the .09/.07/.08 baseline dialled to the 75% you picked on a real
       screen. Baked in rather than left as a multiplier, so the shipped CSS carries the
       chosen number and not a knob set to three-quarters. Peak green ~.068 against the
       hero glow's measured ~.123. */
    --a1:${AURA(.09)}; --a2:${AURA(.07)}; --a3:${AURA(.08)}; --aur:1;
    background:
    radial-gradient(60vw 48vh at 12% 28%,rgba(0,230,104,calc(var(--a1) * var(--aur))) 0%,transparent 62%),
    radial-gradient(66vw 55vh at 88% 58%,rgba(50,120,255,calc(var(--a2) * var(--aur))) 0%,transparent 62%),
    radial-gradient(72vw 48vh at 45% 90%,rgba(0,230,104,calc(var(--a3) * var(--aur))) 0%,transparent 62%)}
  html[style*="--gl-aur"] #bgfx{--aur:var(--gl-aur) !important}

  /* THE FRAME — absolute, so the cap belongs to the page and not to the screen.
     --cy CLEARS THE NAV, and its value is FRAME_CY at the top of this file — do not quote
     a number here. A comment naming a specific px value is a second source of truth that
     nobody updates: this one said 96 for a while after the constant became 86, which is
     exactly the drift the constant was introduced to stop.
     nav.lpnav is padding:22px 0 around a 26px logo = 70px tall, so 48px put the cap level
     with the wordmark and it read as a line through the logo. (48 was my mistake to
     accept: "lower" needs a BIGGER number — --cy is distance from the top — and I should
     have said so instead of typing it.)

     vector-effect:non-scaling-stroke IS THE THICKNESS FIX. The stroke used to scale with
     the SVG box: at 98vw the scale factor is 1.48 on a desktop but 0.38 on a phone, so a
     stroke-width of 1.1 landed at 1.63px on your laptop and 0.42px on your phone — not
     thin, sub-pixel, antialiased into a ghost. Non-scaling-stroke means the width is in
     SCREEN pixels and identical everywhere. The cap is drawn heavier than the shoulders
     because it's the shortest line and reads lightest. */
  html.bg-frame #bgframe{opacity:1;
    --cw:98vw; --cy:${FRAME_CY}px; --sh:calc(var(--cw) * 0.293); --rail:calc(var(--cy) + var(--sh));
    background:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1000 293' preserveAspectRatio='none'%3E%3Cpath d='M293 0 H707' fill='none' stroke='%2300e668' stroke-opacity='0.42' stroke-width='2.6' vector-effect='non-scaling-stroke'/%3E%3Cpath d='M293 0 L0 293 M707 0 L1000 293' fill='none' stroke='%2300e668' stroke-opacity='0.36' stroke-width='2' vector-effect='non-scaling-stroke'/%3E%3C/svg%3E") no-repeat 50% var(--cy)/var(--cw) var(--sh),
    /* the rails: 2px, and they now run the DOCUMENT's height, not the viewport's — so
       they settle to a steady .11 rather than fading out inside the first screen. */
    linear-gradient(rgba(0,230,104,.36) 0%,rgba(0,230,104,.14) 22%,rgba(0,230,104,.11) 100%) no-repeat calc(50% - var(--cw)/2) var(--rail)/2px 100%,
    linear-gradient(rgba(0,230,104,.36) 0%,rgba(0,230,104,.14) 22%,rgba(0,230,104,.11) 100%) no-repeat calc(50% + var(--cw)/2) var(--rail)/2px 100%}

  /* NO PHONE OVERRIDE ON --sh. THE OCTAGON ANGLE IS THE DESIGN.
     There was a max-width:720px media query here setting --sh to 370px. My reasoning: --sh is
     0.293 x --cw, so on a phone the shoulders are only ~112px long and finish at y~198,
     right at the headline — and I "fixed" it to a fixed 370px drop so they'd clear the
     whole hero on every device.
     It was measured, it was internally consistent, and it was wrong, because the thing it
     fixed was never reported. 86px was approved WITH the 0.293 angle. Tripling the drop
     drags the diagonals down across the title, the hook, the buttons and the chips —
     which is exactly what "it goes through a ton of things" means.
     THE LESSON, AND IT IS THE SESSION'S LESSON: an approved value is a measurement. My
     arithmetic said the shoulders landed badly; the person looking at it said it looked
     good. When those disagree, the arithmetic is describing a different problem than the
     one on screen. Do not renovate something that has already been signed off because a
     calculation is unhappy about it. If the shoulders genuinely read wrong on a small
     phone, that is a separate report, and it comes from eyes, not from me. */

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
  html[style*="--gl-cy"] #bgframe{--cy:var(--gl-cy) !important}


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

  #cypick,#aurpick{position:fixed;left:14px;z-index:70;display:flex;align-items:center;gap:9px;background:rgba(10,10,11,.92);border:1px solid var(--border);border-radius:999px;padding:7px 13px;backdrop-filter:blur(6px)}
  #cypick{bottom:60px}
  #aurpick{bottom:106px}
  #cypick[hidden],#aurpick[hidden]{display:none}
  #cypick b,#aurpick b{font-family:'Barlow Condensed',sans-serif;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
  #cypick input[type=range],#aurpick input[type=range]{width:190px;accent-color:var(--accent)}
  #cypick span,#aurpick span{font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;color:var(--accent);width:46px;text-align:right}
  #cypick button{background:none;border:0;color:var(--muted);font-size:11px;text-decoration:underline;cursor:pointer;padding:0 2px}
  #cypick button:hover{color:#fff}
  /* On a phone the controls have to be usable with a thumb and must not cover the page. */
  /* The controls sit ON the page on a phone — your screenshot has the Aurora and Top edge
     sliders lying across The Climb's preview, which is the card you're trying to judge.
     Collapsed behind a tap: one small handle, and the panel only exists while you're
     actually dialling something. */
  @media (max-width:560px){
    #bgpick{left:8px;bottom:8px;right:8px;justify-content:center;flex-wrap:wrap}
    #cypick{left:8px;right:8px;bottom:54px}
    #aurpick{left:8px;right:8px;bottom:100px}
    #cypick input[type=range],#aurpick input[type=range]{flex:1;width:auto}
    html:not(.fx-tools) #bgpick,
    html:not(.fx-tools) #cypick,
    html:not(.fx-tools) #aurpick{display:none}
    #fxtoggle{position:fixed;right:10px;bottom:10px;z-index:80;width:38px;height:38px;border-radius:50%;
      background:rgba(10,10,11,.9);border:1px solid var(--border);color:var(--muted);
      font-size:15px;line-height:1;cursor:pointer;backdrop-filter:blur(8px)}
    html.fx-tools #fxtoggle{background:var(--accent);color:#0a0a0b;border-color:var(--accent)}
  }
  @media (min-width:561px){ #fxtoggle{display:none} }

  /* ── MOBILE: EACH GROUP BECOMES A SWIPE ROW ──────────────────────────────────
     Fifteen cards stacked is ~5 screens of identical rectangles — a texture the eye stops
     reading around the fourth. Four named rows is ~2.4 screens, and the page's argument
     becomes the TAXONOMY rather than the cards: scroll twice and you know this thing does
     free play, pre-fight analysis, historical numbers and betting tools, whether or not
     you swipe a single row.
     This is NOT the carousel we removed. That was one row of sixteen with fifteen hidden
     and no structure. Four rows of ~4 keep every heading and count on screen, so the row
     is honest about what it's concealing — which vertical depth never is: card 12 of a
     stack doesn't announce itself, it just never gets reached.
     THE PEEK IS THE AFFORDANCE, and it is the whole ballgame. 86vw + gap leaves ~14% of
     the next card showing. A row that ends flush at the screen edge looks like it ends,
     and nobody swipes it. Do not "tidy" this to 100vw.
     Desktop now uses these same rows too — same chunks, paged by the arrow buttons above
     instead of a swipe. This block just retunes the card width and gaps for a phone. */
  @media (max-width:720px){
    .fx-grid{
      display:flex; grid-template-columns:none;
      overflow-x:auto; overscroll-behavior-x:contain;
      scroll-snap-type:x mandatory; -webkit-overflow-scrolling:touch;
      /* NOT full-bleed. margin:0 -13px let the row clip at the screen edge, so a swiped
         card slid straight under the frame rail sitting at 1vw. An overflow container
         clips at its PADDING box, so the negative margin was handing cards the last 13px
         either side — exactly where the rails live. Kept inside .fx-wrap's padding, cards
         now vanish at 13px, clear of the rail, on both sides. The peek is unaffected: the
         row is 364px of a 390px screen and the card is 86vw, so ~29px of the next one
         still shows. */
      gap:12px; padding:0 0 2px;
      scrollbar-width:none;
    }
    /* UNIFORM CARDS, AND THE PREVIEW EATS THE DIFFERENCE.
       The row stretches every card to match the tallest in its group (descriptions run
       one to three lines, and .fx-card.wide's frame is 330px against everyone else's
       290px). That slack has to go somewhere. It used to go ABOVE the frame, because
       .fx-frame is pinned down with margin-top:auto — one dead band directly under the
       description, worst on the premium rows. Letting the FRAME grow instead keeps every
       card the same height and spends the slack on more preview, which is the one part
       of the card that can absorb it: it is a scaled-down screenshot behind a fade, so
       showing a little more or less of it reads as intentional cropping rather than as
       a hole in the layout. */
    .fx-card > .fx-frame{margin-top:0; flex:1 1 auto}
    .fx-grid::-webkit-scrollbar{display:none}
    .fx-card{flex:0 0 86vw; scroll-snap-align:start}
    /* the hub reflows via matchup-free.css's own phone rules, so it needs no special width */
    .fx-card.wide{flex:0 0 86vw; grid-column:auto}
    /* Air between groups, tight within: grouping is spacing, not lines. */
    .fx-tier + .fx-tier{margin-top:34px}

    /* THE HEADING WRAPS TO TWO LINES ON A PHONE.
       It was one flex row — label, badge, note, gradient rule — with white-space:nowrap on
       the note. Measured on a 390px screen: label ~110 + badge ~80 + note ~200 + 39px of
       gaps = ~419px in 364px of room, and nowrap means the note cannot fold, so it just
       leaves the screen. Adding the badge is what tipped it; the note was already close.
       So: name and badge on line one, the promise on its own line beneath, and drop the
       gradient rule — it is decoration and there is no width to spend on it. */
    /* CENTRED, because the thing that justified the left edge is gone.
       On desktop the heading is a row: label, badge, note, then a gradient rule running to
       the right margin — the rule is what makes left-alignment read as deliberate, an
       anchor with a line trailing off it. On a phone there's no width for the rule, so it
       is display:none — leaving a left-aligned label pointing at nothing, in a column whose
       hero above it is centred. Centre it and the page has one axis instead of two. */
    .fx-band{flex-wrap:wrap;justify-content:center;text-align:center;gap:9px;margin:0 0 12px}
    /* ———— label · badge ———— on line one, the promise on line two. The rules come back
       (they were display:none) now that there are two of them and the heading is centred:
       symmetrical, they frame it instead of pointing off one edge at nothing. */
    .fx-bl.l{display:block;order:0}
    .fx-bl.r{order:3}
    .fx-bn{flex:0 0 100%;order:4;white-space:normal;line-height:1.4}
  }
  @media (max-width:560px){
    .fx-h{font-size:29px}
    /* NO HEIGHT OVERRIDE — the phone gets the same 290px preview as the desktop.
       It was 172px, and that was a tax on a layout that no longer exists: when this was
       one column of 15 cards, every pixel of preview height was paid FIFTEEN times, and
       172 vs 290 was the difference between 5.7 and 7.8 screens. In rows only four
       previews are in the vertical budget — the other eleven cost nothing, they're
       sideways — so the same change is 2.4 vs 2.9 screens. Six-tenths of a screen for a
       preview you can actually read, on the element that is the entire reason anyone taps.
       One less thing diverging from desktop, too. */
    .fx-fade{height:80px}
    .fx-scaler{padding:12px 13px}
    .fx-ch{padding:12px 13px 10px}
    .fx-cd{font-size:12px}
    .fx-wrap{padding:0 13px}
    .fx-band{margin:26px 0 12px}
  }

${componentCSS}

  /* SAFE-AREA SEE-THROUGH (2026-07-18). Overrides the sliced body/html rules above, last so
     they win the cascade. The glow was on BODY, which paints an OPAQUE background across the
     whole viewport — so the status-bar and URL-bar safe areas showed that body background
     (black at the bottom, where the glow bottoms out at var(--bg)) instead of the page. That
     is the black band the owner saw fade to the next page's colour on navigate. Moving the
     glow to HTML and making body transparent is exactly what the auth/public pages do: the
     safe areas now show the background colour and the content behind the bars, edge-to-edge.
     The solid var(--bg) COLOUR stays on html (shorthand colour + image) so the true insets
     and overscroll are dark, never white. */
  html{background:var(--bg) radial-gradient(1100px 520px at 50% -6%,#12251b 0%,var(--bg) 52%)}
  /* PAGE-TRANSITION FADE (2026-07-18). The grid page lost this when it replaced the
     carousel — the carousel's fade handler lived past the END CAROUSEL SCRIPT sentinel, so
     the slice never carried it, and clicking a link navigated with a hard cut while every
     other page on the site fades. Same shape as the app pages: fade IN on load via an
     animation, fade OUT on navigate via a class + transition (the JS adds .gl-leaving). */
  body{background:transparent;animation:glFadeIn .28s ease both;transition:opacity .16s ease}
  body.gl-leaving{opacity:0}
  @keyframes glFadeIn{from{opacity:0}to{opacity:1}}
`;

// Built twice from one builder: once with the debug switcher for local eyeballing, once
// without for "/". A separate "clean copy" would be a fork, and the phone
// build is the one that decides whether this ships — it must be the same page.
// TWO flags, not one. They were conflated — debug also meant "indexable" — so asking for
// a preview WITH controls silently asked for one without noindex. Separate concerns.
const page = (debug, noindex) => `<!doctype html>
<!-- class="bg-frame" so the page LOADS as the chosen design rather than loading flat and
     flipping once JS runs. The picker's "on" chip must agree with this or the control
     lies about what you're looking at. -->
<html lang="en" class="bg-frame"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>GillyLab — feature grid (${noindex ? 'preview' : 'prototype'})</title>
${noindex ? '<meta name="robots" content="noindex,nofollow">' : ''}
<!-- THE BLACK BANDS ARE THE BROWSER'S CHROME, NOT THE PAGE.
     iOS Safari paints the status bar (time/signal/battery) and the URL bar with
     theme-color. The live landing page sets #0a0a0b and gets away with it because that
     page IS #0a0a0b — flat. This one isn't: measured, the top is #12251b where the hero
     glow sits and the bottom is #091a12 under the aurora bloom, so a black bar sits 15-27
     points of green away from the page it's framing. Turning the aurora to 90% didn't
     cause it; it made an existing mismatch visible.
     #12251b matches the TOP exactly — the status bar is the one that's always on screen,
     and the URL bar is translucent over the page anyway. One colour cannot match both
     edges; this is the edge worth matching.
     (viewport-fit=cover is set on the viewport meta above for the same seam: it lets the
     page paint INTO the safe areas instead of letting the browser letterbox them.)
-->
<meta name="theme-color" content="#12251b">
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
<div id="bgframe"></div>
<!-- LAST of the three background layers, so it paints over all of them — the aurora, the
     frame's rails, and body's own hero glow. Same z-index; DOM order decides. -->
<div id="bgedge"></div>
${debug ? `
<!-- Phone-only: the sliders are hidden until you tap this. On a 390px screen they lie
     across the cards they exist to help you judge. -->
<button type="button" id="fxtoggle" aria-label="Toggle design controls">⚙</button>
<script>
(function(){
  var t=document.getElementById('fxtoggle'); if(!t) return;
  try{ if(localStorage.getItem('glTools')==='1') document.documentElement.classList.add('fx-tools'); }catch(_){}
  t.addEventListener('click',function(){
    var on=document.documentElement.classList.toggle('fx-tools');
    try{ localStorage.setItem('glTools', on?'1':'0'); }catch(_){}
  });
})();
</script>
` : ''}
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
  <input type="range" id="cy" min="-40" max="200" step="2" value="${FRAME_CY}">
  <span id="cyv">${FRAME_CY}px</span>
  <button type="button" id="cyreset">reset</button>
</div>

<div id="aurpick">
  <b>Aurora</b>
  <input type="range" id="aur" min="0" max="250" step="5" value="100">
  <span id="aurv">100%</span>
</div>
<script>
(function(){
  var pick=document.getElementById('bgpick');
  var cyBox=document.getElementById('cypick'), cy=document.getElementById('cy'),
      cyv=document.getElementById('cyv'), cyreset=document.getElementById('cyreset');
  var aurBox=document.getElementById('aurpick'), aur=document.getElementById('aur'), aurv=document.getElementById('aurv');

  // The aurora multiplier. Same reasoning as the top edge: I have now been wrong about
  // this number in both directions — too green, then invisible — so it stops being my
  // number. 100% is the calibrated default (~.09 peak, just under the hero glow's ~12%).
  function setAur(v){
    document.documentElement.style.setProperty('--gl-aur', (v/100).toFixed(2));
    aur.value=v; aurv.textContent=v+'%';
    try{ localStorage.setItem('glBgAur', v); }catch(_){}
  }
  aur.addEventListener('input',function(){ setAur(+aur.value); });
  (function(){ var s=null; try{ s=localStorage.getItem('glBgAur'); }catch(_){} setAur(s!=null?+s:100); })();
  // The default --cy each frame variant ships with, so "reset" means something and the
  // slider starts where the variant actually is rather than at an arbitrary number.
  // 60px: chosen on a real screen, halfway between the top of the page and the eyebrow.
  // The slider stays so it can be re-checked, but this is the number.
  var DEF={"bg-frame":${FRAME_CY}};

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
    aurBox.hidden = !isFrame;
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
    // toggle, NOT className=mode. The scroll lock is also a class on <html>, and an
    // assignment here would silently wipe it — open a card, tap the background switcher,
    // and the page starts scrolling behind the overlay again.
    document.documentElement.classList.toggle('bg-frame', mode==='bg-frame');
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
  // read the CLASS, not className — the root may legitimately carry others.
  var mode = savedFx!=null ? savedFx : (document.documentElement.classList.contains('bg-frame') ? 'bg-frame' : '');
  var b = pick.querySelector('button[data-bg="'+mode+'"]');
  if(!b){ mode='bg-frame'; b=pick.querySelector('button[data-bg="bg-frame"]'); }
  document.documentElement.classList.toggle('bg-frame', mode==='bg-frame');
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
      <a class="fx-btn fx-cta-free" href="/signup">Start free →</a>
      <a class="fx-btn ghost" href="/signup?next=/subscribe">Go Premium →</a>
      <a class="fx-btn ghost" href="/login">Log in</a>
    </div>
    <p class="fx-trust">${HERO_TRUST.replace('{PRICE}', PRICE_LABEL)}</p>
  </div>
  <div id="tiers"></div>
</div>

<div class="lp">
  ${footCTA}
  ${siteFooter}
</div>

${debug ? `<div class="fx-note">
  <b>Prototype.</b> The previews are sliced live out of <b>worker/pages.js</b> — same payloads the carousel renders today, and the nav and footer are the real ones.
  What changed is only the layout: no auto-advance, no dots, nothing hidden behind a click. Compare against the carousel on the live landing page.
</div>` : ''}

<div class="fx-lb" id="lb"><div class="fx-lbin" id="lbin"></div></div>

<script>
(function(){
${slideJS}

  // ── the grid ───────────────────────────────────────────────────────────────
  // Everything above this line is the landing page's own code, untouched. Only the
  // rendering below is new: the carousel's driver (dots, 7s timer, swipe) is gone.
  var tiers = document.getElementById('tiers');
  var lb = document.getElementById('lb'), lbin = document.getElementById('lbin');
  // The lightbox is position:fixed, but on /subscribe it renders inside .wrap, which runs a
  // transform-animation (glPageIn) — a transformed/animated ancestor becomes the containing
  // block for fixed descendants, so the overlay anchors to the TOP OF .wrap instead of the
  // viewport and opens off-screen when the page is scrolled. Reparent it to <body> so it
  // escapes any such ancestor and always covers the viewport. Harmless on the landing page,
  // where lb is already effectively top-level.
  if (lb && lb.parentNode !== document.body) document.body.appendChild(lb);
  var cur = 0;
  var rows = [];   // one arrow-updater per group row, refreshed on scroll/resize

  var free = slides.filter(function(s){ return s.f; });
  var prem = slides.filter(function(s){ return !s.f; });

  // The hub payload is the only one authored to a fixed width (the modal's 1040px) — it
  // has to be scaled rather than squeezed. Detected from the markup, not from the title,
  // so renaming the slide can't quietly break it.
  function isWide(s){ return /class="mh-slide"/.test(s.h); }

  function card(s){
    var i = slides.indexOf(s);
    var el = document.createElement('div');
    el.className = 'fx-card' + (s.f ? '' : ' prem') + (isWide(s) ? ' wide' : '');
    el.innerHTML =
      // No pill on the card: every card in a group shares its tier, so the heading above
      // already said it. Fifteen pills repeating the group's own label is noise on the
      // one view that cannot afford any. The lightbox keeps its pill — expanded, the
      // group heading is off-screen and the tier is genuinely unstated.
      '<div class="fx-ch"><div><div class="fx-ct">'+s.t+'</div><div class="fx-cd">'+s.d+'</div></div></div>'
      + '<div class="fx-frame"><div class="fx-scaler">'+s.h+'</div>'
      + '<div class="fx-fade"></div><div class="fx-expand">Expand ↗</div></div>';
    el.onclick = function(){ open(i); };
    return el;
  }

  // NO COUNTS. I put them in so a non-swiper would know each row's depth — a reasonable
  // argument that lost to someone actually looking at it: "Free 4" reads as a quantity
  // when the heading's job is to name a category, and the number competes with the words
  // that carry the meaning. The peek already says there is more.
  function band(key, label, tierCls, n, note){
    var d=document.createElement('div'); d.className='fx-band'; d.id='band-'+key;
    // PREMIUM ONLY. A "FREE" badge next to a heading that says "Free" is the word twice —
    // and it made the badge look like a label rather than a gate. The badge exists to mark
    // what costs money; the absence of one is what free looks like.
    // Two rules, one either side, each fading AWAY from the title. DOM order is
    // left-rule, label, badge, right-rule, note — and every piece carries an explicit
    // flex order (see the CSS), because desktop wants "label badge note ————" while mobile
    // wants "———— label badge ————" over the note. Same markup, two arrangements.
    d.innerHTML='<span class="fx-bl l"></span>'
      +'<span class="fx-bt '+tierCls+'">'+label+'</span>'
      +(tierCls==='prem' ? '<span class="fx-btag prem">PREMIUM</span>' : '')
      +'<span class="fx-bl r"></span>'
      +'<span class="fx-bn">'+note+'</span>';
    return d;
  }

  function grid(list){
    var g=document.createElement('div'); g.className='fx-grid';
    list.forEach(function(s){ g.appendChild(card(s)); });
    return g;
  }

  // FOUR NAMED GROUPS INSTEAD OF TWO TIERS.
  // Fifteen cards arriving as one undifferentiated run is a texture, not a list — the eye
  // stops reading around the fourth. Chunked, every group is under that threshold, and the
  // page says something the flat stack never could: the product has AREAS. A visitor who
  // scrolls two screens and swipes nothing still learns what this thing is.
  // The group lives on the slide (g:) in pages.js, because it is a fact about the feature.
  var GROUPS=[
    // "no card required" removed an objection nobody had raised yet. The other three
    // headings promise something; this one apologised. It also buried the free tier's
    // actual advantage: it is not a trial. Play covers The Climb, predict covers Pick'em,
    // dig in covers the stats and the rankings — and "forever" is the word doing the real
    // work, because every other free tier a visitor has met was a countdown.
    {k:'free', label:'Free',                      note:'play, predict and dig in — free forever', tier:'free'},
    {k:'pre',  label:'Before the fight',           note:'where the research begins', tier:'prem'},
    {k:'bet',  label:'Betting tools',              note:'become a smarter, more efficient bettor', tier:'prem'},
    {k:'num',  label:'Complete fighter history',   note:'every fighter, every bout', tier:'prem'}
  ];

  function arrow(kind){
    var b=document.createElement('button');
    b.className='fx-arrow '+kind; b.type='button';
    b.setAttribute('aria-label', kind==='prev' ? 'Scroll left' : 'Scroll right');
    b.innerHTML = kind==='prev' ? '‹' : '›';
    return b;
  }

  function tier(g,list){
    var sec=document.createElement('section');
    sec.className='fx-tier'; sec.setAttribute('data-tier',g.tier);
    sec.appendChild(band(g.k, g.label, g.tier, list.length, g.note));

    // Each group is a horizontal scroller wrapped with two arrows. On a phone the arrows are
    // hidden (CSS) and you swipe the row; on a desktop the arrows page it one card at a time.
    var gr=grid(list);
    var wrap=document.createElement('div'); wrap.className='fx-rowwrap';
    var prev=arrow('prev'), next=arrow('next');
    wrap.appendChild(prev); wrap.appendChild(gr); wrap.appendChild(next);
    sec.appendChild(wrap);

    function step(){ var c=gr.querySelector('.fx-card'); return (c ? c.getBoundingClientRect().width : gr.clientWidth*0.8) + 20; }
    prev.onclick=function(){ gr.scrollBy({left:-step(), behavior:'smooth'}); };
    next.onclick=function(){ gr.scrollBy({left: step(), behavior:'smooth'}); };
    // Show the arrows only when the row overflows, and disable whichever end you've hit.
    function upd(){
      var max=gr.scrollWidth - gr.clientWidth - 1;
      var over=max>4;
      prev.classList.toggle('show', over);
      next.classList.toggle('show', over);
      prev.disabled = gr.scrollLeft <= 2;
      next.disabled = gr.scrollLeft >= max-2;
    }
    gr.addEventListener('scroll', upd, {passive:true});
    rows.push(upd);
    return sec;
  }

  function paint(){
    tiers.innerHTML=''; rows=[];
    // The four named groups, matched to each slide by slide.g — the SAME chunks on desktop
    // and mobile now; only how you move through a row differs (arrows vs swipe).
    var defs = GROUPS.map(function(g){ return {k:g.k,label:g.label,note:g.note,tier:g.tier,sel:function(s){ return s.g===g.k; }}; });
    // /subscribe embeds this with window.__FX_PREMIUM_ONLY=true — drop the free group there,
    // leaving the three premium chunks.
    if(window.__FX_PREMIUM_ONLY) defs = defs.filter(function(g){ return g.tier==='prem'; });
    defs.forEach(function(g){
      var list=slides.filter(g.sel);
      if(!list.length) return;                        // a group with no slides draws nothing
      tiers.appendChild(tier(g,list));
    });
    fitWide();
    updRows();
  }
  function updRows(){ rows.forEach(function(f){ f(); }); }
  // The layout is fluid, so which rows overflow (and how far the hub scales) changes with the
  // width — recompute both on resize. No re-paint needed: the chunks are the same at every
  // width, only the arrows-vs-swipe affordance differs, and that is pure CSS.
  window.addEventListener('resize', updRows);

  // Scale the 1040px hub preview down to whatever its card ended up being. Measured per
  // card because the grid is fluid — there is no single correct constant, which is the
  // same reason the first blanket transform:scale() had to go.
  function fitWide(){
    Array.prototype.forEach.call(document.querySelectorAll('.fx-card.wide .fx-frame'), function(f){
      var sc=f.querySelector('.fx-scaler'); if(!sc) return;
      // Never write scale(0). If the frame has no width yet — measured before layout, or
      // in a hidden container — a zero scale renders the card blank, which looks exactly
      // like the payload failing rather than the measurement being early. Leave it alone
      // and let the resize handler catch it once there IS a width.
      if(!f.clientWidth) return;
      // Under 720px the payload's own media query has already reflowed it — the CSS above
      // clears the width and the transform, and scaling here would undo that.
      if(window.innerWidth <= 720){ sc.style.transform=''; return; }
      // Never scale UP past 1:1. Full-width the frame is ~1096px against a 1040px payload,
      // and 1.05 would blur it for no reason — the point is to stop shrinking it, not to
      // start stretching it.
      sc.style.transform = 'scale(' + Math.min(1, f.clientWidth/1040) + ')';
    });
  }
  window.addEventListener('resize', fitWide);

  function open(i){
    cur=i; var s=slides[i];
    lbin.innerHTML =
      '<div class="fx-lbh"><div><div class="fx-ct">'+s.t+'</div><div class="fx-cd">'+s.d+'</div></div>'
      + '<span class="fx-pill '+(s.f?'free':'prem')+'">'+(s.f?'FREE':'PREMIUM')+'</span>'
      + '<button class="fx-x" type="button" aria-label="Close">×</button></div>'
      + '<div class="fx-lbstage">'+s.h+'</div>'
      + '<div class="fx-nav"><button class="fx-nb" type="button" id="pv">‹ Prev</button><button class="fx-nb" type="button" id="nx">Next ›</button></div>';
    lb.classList.toggle('wide', isWide(s));   // the hub expands to the modal's own width
    // Restart the inner slide-in. With the overlay now toggled by visibility (not display),
    // fxIn no longer replays on its own each open, so kick it by hand: clear it, force a
    // reflow, restore it.
    lbin.style.animation='none'; void lbin.offsetWidth; lbin.style.animation='';
    lb.classList.add('on'); document.documentElement.classList.add('fx-locked');
    lbin.querySelector('.fx-x').onclick=close;
    document.getElementById('pv').onclick=function(e){e.stopPropagation();open((cur-1+slides.length)%slides.length);};
    document.getElementById('nx').onclick=function(e){e.stopPropagation();open((cur+1)%slides.length);};
  }
  function close(){ lb.classList.remove('on'); document.documentElement.classList.remove('fx-locked'); }
  lb.onclick=function(e){ if(e.target===lb) close(); };
  document.addEventListener('keydown',function(e){
    if(!lb.classList.contains('on')) return;
    if(e.key==='Escape') close();
    if(e.key==='ArrowLeft') open((cur-1+slides.length)%slides.length);
    if(e.key==='ArrowRight') open((cur+1)%slides.length);
  });

  paint();

  /* SUBSCRIBE-STRIP-START — everything to SUBSCRIBE-STRIP-END is page-only and is removed
     when this same grid is emitted as the /subscribe premium-features module (no full-page
     navigation to fade there, and no test hook). Keep paint() ABOVE this marker. */
  // Fade the page out before an internal navigation, and clear the fade on bfcache restore
  // (Back would otherwise land on a page stuck at opacity 0). Same transition every other
  // page uses. The slide-expand controls are <button>/<div>, not <a href="/">, so opening a
  // slide never triggers this — only real navigations do.
  document.addEventListener('click',function(e){
    var a=e.target.closest&&e.target.closest('a[href^="/"]');
    if(!a||a.target==='_blank'||e.metaKey||e.ctrlKey||e.shiftKey||e.button) return;
    var href=a.getAttribute('href'); if(!href||href.charAt(0)!=='/') return;
    e.preventDefault();
    // Drop the fade-IN animation first. glFadeIn runs with fill-mode:both, so after it
    // finishes it HOLDS opacity:1 — and a held animation value overrides a normal class
    // rule in the cascade, so body.gl-leaving{opacity:0} would do nothing and the page
    // would cut instead of fade. Clearing the animation lets the opacity transition run.
    document.body.style.animation='none';
    document.body.classList.add('gl-leaving');
    setTimeout(function(){window.location=href;},150);
  });
  window.addEventListener('pageshow',function(){document.body.classList.remove('gl-leaving');});
  window.SHOWCASE_PROTO={slides:slides,free:free.length,prem:prem.length};  // for the test
  /* SUBSCRIBE-STRIP-END */
})();
</script>
</body></html>`;

const html = page(true, false);          // local file: controls, indexable is moot

// PRODUCTION. This is what "/" serves: no debug controls, and INDEXABLE — it is the
// landing page now, not a preview of one. The sliders and the noindex were scaffolding
// for choosing numbers, and the numbers are chosen (frame 86px, aurora 90%).
//
// This half-landed once before. On 2026-07-17 20:25 this line flipped to page(false,
// false) while the assertions below still asserted noindex and sliders, so the generator
// threw on every run, the workflow's `|| true` swallowed it, and worker/landing-grid.js
// stayed frozen while CI went green. The assertions are inverted with it this time.
// prototypes/landing-showcase.html still carries the sliders for a re-check on a phone.
const preview = page(false, false);

// STRAY */ IN THE CSS = EVERY RULE AFTER IT IS DROPPED.
// Editing inside a long comment, I left the original's closing */ in place and wrote on
// past it — so my prose became CSS and ended with a second, orphaned */. The parser choked
// and silently binned the rules that followed, which is why the debug panels lost
// position:fixed and rendered as text at the top of the page. CSS has no syntax errors, it
// has recovery: it drops what it can't read and says nothing. Three rounds went to this.
{
  const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
  const opens = (css.match(/\/\*/g) || []).length;
  const closes = (css.match(/\*\//g) || []).length;
  if (opens !== closes) throw new Error('unbalanced CSS comments: ' + opens + ' /* vs ' + closes + ' */ — a stray */ silently drops every rule after it');
  // and nothing that looks like prose sitting where a selector should be
  const stray = /\n\s{4,}[A-Z][a-z]+[^{};*\n]{20,}\n/.exec(css.replace(/\/\*[\s\S]*?\*\//g, ''));
  if (stray) throw new Error('prose found outside a comment in the CSS — it will be dropped along with the next rule: "' + stray[0].trim().slice(0, 60) + '"');
}

// These assert what "/" must be. They used to assert the opposite — noindex, sliders
// present — because this file only ever built a preview. They are inverted together with
// the page(false, false) above; splitting those two edits is exactly what broke this file
// for two hours on 2026-07-17.
if (/noindex/.test(preview)) throw new Error('"/" must NOT be noindex — this is the landing page, not a preview of one');
if (!/id="bgfx"/.test(preview) || !/bg-frame/.test(preview)) throw new Error('the landing page lost the frame background');
if (/id="bgpick"|id="cypick"|id="aurpick"|glBgFx/.test(preview)) throw new Error('"/" still emits debug chrome — the landing page would ship the sliders');
// The MARKUP, not the class name: /fx-note/ also matches the .fx-note{} rule left in the
// stylesheet, which is dead but harmless. Asserting on the rule made this throw on a page
// that had already dropped the banner.
if (/<div class="fx-note">/.test(preview)) throw new Error('"/" still carries the prototype banner — it names worker/pages.js at visitors');
// The local prototype is the one that must KEEP the controls: it is where a number gets
// re-dialled on a phone, and it is the only reason this file still emits two builds.
if (!/id="bgpick"|id="cypick"|id="aurpick"/.test(html)) throw new Error('the local prototype lost its controls — the point is to dial these on a phone');
const shipped = preview;
// 8000, up from 6000: the phone toggle (button + its script + the collapse CSS) legitimately
// added ~600b of debug chrome. The guard is here to catch page CONTENT diverging between the
// preview and the shipped build — not to freeze the size of the toolbox. Raised deliberately
// after checking the delta was the toggle and nothing else.
if (Math.abs(shipped.length - html.length) > 8000) throw new Error('the debug chrome accounts for ' + (html.length - shipped.length) + 'b — something other than the controls differs');

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);

// The Worker module. A template literal would need every backtick and ${ inside the page
// escaped — and an unescaped backtick in a template literal is precisely what broke
// worker/pages.js today. JSON.stringify cannot make that mistake.
fs.writeFileSync(OUT_WORKER,
  '// AUTO-GENERATED by scripts/gen-showcase-proto.cjs — do not edit by hand.\n' +
  '// THE LANDING PAGE. Served at "/" to logged-out visitors. Generated from worker/pages.js\n' +
  '// so the feature previews are the real slide payloads and cannot drift from the product.\n' +
  '// Same builder as prototypes/landing-showcase.html, minus the debug sliders.\n' +
  '// Regenerated by CI every run. Do not edit by hand.\n' +
  'export const landingGridPage = () => ' + JSON.stringify(preview) + ';\n');

// ── /subscribe premium-features module ───────────────────────────────────────
// Extract the grid straight out of the built page so it can never drift from what "/"
// ships. Everything below is sliced from `preview` and `css`, which are fully resolved —
// no ${…} survive, so the module needs no imports and JSON.stringify is safe.
//
// featuresCSS: the fx-* grid/card/band/lightbox rules + the hub slide's own CSS + the
// faithful in-app component styles. NOT the page chrome (html/body/nav/footer/aurora) —
// /subscribe brings its own via shell().
// The fx-* CSS is SPLIT by the page chrome: base grid/card/band/lightbox rules, then the
// aurora/frame/debug-slider block (which must NOT come along — its #bgfx{opacity:0} gated on
// html.bg-frame would blank /subscribe's own aurora), then the MOBILE swipe-row section that
// turns each group into a horizontal scroll-snap row (the "peek"). Take both feature ranges,
// skip the chrome between them, then append the in-app component styles.
const FX_START = '.fx-h .a{color:var(--accent)}';
const FX_CHROME = '/* ── BACKGROUND TREATMENTS';                       // chrome begins — exclude from here
const FX_MOBILE = '/* ── MOBILE: EACH GROUP BECOMES A SWIPE ROW';      // feature CSS resumes
const FX_MOBILE_END = '/* Faithful in-app component styles */';        // componentCSS begins
for (const mk of [FX_START, FX_CHROME, FX_MOBILE, FX_MOBILE_END]) {
  if (css.indexOf(mk) < 0) throw new Error('subscribe module: fx-* CSS slice marker moved: ' + mk);
}
const featuresCSS =
  css.slice(css.indexOf(FX_START), css.indexOf(FX_CHROME)).trimEnd() + '\n' +
  css.slice(css.indexOf(FX_MOBILE), css.indexOf(FX_MOBILE_END)).trimEnd() + '\n' +
  componentCSS;
if (/\$\{/.test(featuresCSS)) throw new Error('subscribe module: an unresolved ${…} survived into featuresCSS');
if (!/\.fx-card\{/.test(featuresCSS) || !/\.fx-lb\{/.test(featuresCSS)) throw new Error('subscribe module: featuresCSS lost the cards or the lightbox');
if (!/scroll-snap-type:x mandatory/.test(featuresCSS)) throw new Error('subscribe module: featuresCSS lost the mobile swipe-row (horizontal scroll)');
if (/#bgframe\{|html\.bg-frame/.test(featuresCSS)) throw new Error('subscribe module: featuresCSS picked up the aurora/frame chrome — it would blank the page aurora');

// featuresMarkup: the grid mount + the lightbox. Same ids the script wires (#tiers/#lb/#lbin).
const featuresMarkup = '<div class="fx-wrap"><div id="tiers"></div></div>\n<div class="fx-lb" id="lb"><div class="fx-lbin" id="lbin"></div></div>';

// featuresScript: the grid <script> from the built page (last <script> before </body>),
// minus the page-only tail (nav-fade + test hook, between the SUBSCRIBE-STRIP sentinels),
// with the premium-only flag set so paint() renders only the premium groups.
let featuresScript = preview.slice(preview.lastIndexOf('<script>'), preview.lastIndexOf('</script>') + '</script>'.length);
if (!/function paint\(\)/.test(featuresScript)) throw new Error('subscribe module: sliced the wrong <script> — no paint()');
featuresScript = featuresScript.replace(/\n?\s*\/\* SUBSCRIBE-STRIP-START[\s\S]*?SUBSCRIBE-STRIP-END \*\//, '');
featuresScript = featuresScript.replace('(function(){', '(function(){\n  window.__FX_PREMIUM_ONLY=true;');
if (/SHOWCASE_PROTO/.test(featuresScript)) throw new Error('subscribe module: the test hook was not stripped');
if (/gl-leaving/.test(featuresScript)) throw new Error('subscribe module: the page navigation-fade was not stripped');
if (!/window\.__FX_PREMIUM_ONLY=true/.test(featuresScript)) throw new Error('subscribe module: the premium-only flag was not set');
if (/\$\{/.test(featuresScript)) throw new Error('subscribe module: an unresolved ${…} survived into featuresScript');

fs.writeFileSync(OUT_SUBSCRIBE,
  '// AUTO-GENERATED by scripts/gen-showcase-proto.cjs — do not edit by hand.\n' +
  '// The landing page\'s PREMIUM feature groups (Before the fight / Betting tools /\n' +
  '// Complete fighter history), extracted so /subscribe shows the exact same cards and\n' +
  '// tap-to-expand as "/". Replaces the old carousel-data.js. Fully resolved: no imports.\n' +
  'export const featuresCSS = ' + JSON.stringify(featuresCSS) + ';\n\n' +
  'export const featuresMarkup = ' + JSON.stringify(featuresMarkup) + ';\n\n' +
  'export function featuresScript(){ return ' + JSON.stringify(featuresScript) + '; }\n');

console.log('prototypes/landing-showcase.html  ' + (html.length / 1024).toFixed(0) + 'KB' +
  '  (slide code ' + (slideJS.length / 1024).toFixed(0) + 'KB sliced from pages.js · component css ' + (componentCSS.length / 1024).toFixed(0) + 'KB)');
