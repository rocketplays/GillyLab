#!/usr/bin/env node
/**
 * test-showcase-proto.cjs — does the grid prototype actually render the real slides?
 *
 * The prototype's whole claim is "these are the REAL previews, so you're judging the
 * product and not a mockup". That claim is worth exactly as much as this file: a slice
 * that quietly dropped half the payloads would still produce a page that looks
 * plausible and is completely useless to judge.
 *
 * Run: node scripts/test-showcase-proto.cjs
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
const read = (p) => {
  try { return fs.readFileSync(p, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') throw new Error('absent (run: node scripts/gen-showcase-proto.cjs): ' + p);
    throw new Error('unreadable, which is NOT absent (CLAUDE.md #1): ' + p + ' — ' + e.message);
  }
};

const html = read(path.join(ROOT, 'prototypes', 'landing-showcase.html'));
const pages = read(path.join(ROOT, 'worker', 'pages.js'));

const ok = [], fail = [];
const check = (n, c, d) => (c ? ok : fail).push(n + (d ? '  ' + d : ''));

// How many slides does the LIVE page define? The prototype must render that many —
// counted from pages.js, not hardcoded, so this tracks the real page.
const liveSlides = [...pages.matchAll(/\{t:'([^']+)',d:'/g)].map((m) => m[1]);
check('found the slide list in pages.js', liveSlides.length > 5, '(' + liveSlides.length + ' slides defined live)');

const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://gillylab.com/' });
const { window } = dom;
const doc = window.document;

const P = window.SHOWCASE_PROTO;
check('the prototype script ran without throwing', !!P);
if (!P) { console.log('\n  FAIL  the prototype script did not run — nothing else can be checked\n'); process.exit(1); }

check('every live slide survives the slice', P.slides.length === liveSlides.length,
  '(' + P.slides.length + ' rendered vs ' + liveSlides.length + ' defined in pages.js)');

// The tier split is the entire point of the redesign — it must match the f:1 flags.
const liveFree = (pages.match(/h:\w+,f:1\}/g) || []).length;
check('the free/premium split matches the f:1 flags', P.free === liveFree,
  '(' + P.free + ' free / ' + P.prem + ' premium; pages.js flags ' + liveFree + ' as free)');

// Cards actually in the DOM, and each with a non-empty preview.
const cards = doc.querySelectorAll('.fx-card');
check('a card is rendered for every slide', cards.length === P.slides.length, '(' + cards.length + ' cards)');

let empty = [];
cards.forEach((c, i) => {
  const sc = c.querySelector('.fx-scaler');
  if (!sc || sc.innerHTML.trim().length < 120) empty.push(P.slides[i] ? P.slides[i].t : '#' + i);
});
check('no preview is empty', empty.length === 0,
  empty.length ? '(' + empty.join(', ') + ' rendered blank)' : '(all ' + cards.length + ' carry real markup)');

// The escaping fix, asserted on the DOM rather than on the bytes.
//
// The first version of this check scanned the raw file for `✓` and failed — but
// the file is SUPPOSED to contain that: it is a JS escape inside a <script> string
// literal, and the browser resolves it to ✓. Grepping the source was asking the wrong
// question, and "fixing" the generator to satisfy it would have broken working output.
// What matters is what renders, so look at what renders.
const previewText = [...doc.querySelectorAll('.fx-scaler')].map((e) => e.textContent).join(' ');
check('template-literal escaping was resolved', previewText.includes('✓') && !previewText.includes('\\u2713') && !previewText.includes("\\'"),
  '(a real ✓ reaches the DOM; no escape sequences render as text)');

// Titles came through, not "undefined".
const titles = [...doc.querySelectorAll('.fx-ct')].map((e) => e.textContent);
check('slide titles came through intact', titles.length > 0 && !titles.some((t) => /undefined|NaN|\[object/.test(t)),
  '(' + titles.length + ' titles, none undefined/NaN)');

// A NaN or "undefined" in a payload is how a broken data join reaches a public page.
const stageText = [...doc.querySelectorAll('.fx-scaler')].map((e) => e.textContent).join(' ');
check('no NaN/undefined leaked into a preview', !/\bNaN\b|\bundefined\b/.test(stageText));

// Faces must actually load from a file:// prototype, or the whole thing gets judged
// as a wall of grey initials. Root-relative paths silently 404 there and the <img>
// onerror swaps in initials — a failure that looks like a design choice.
const imgs = [...doc.querySelectorAll('.fx-scaler img')];
const relative = imgs.filter((i) => (i.getAttribute('src') || '').startsWith('/'));
check('every preview photo is loadable from file://', imgs.length > 0 && relative.length === 0,
  '(' + imgs.length + ' faces, ' + relative.length + ' still root-relative)');

// The hub slide must carry the real modal header, avatars and all — that IS the modal.
const hd = doc.querySelector('.fx-scaler .mh-hd');
check('the matchup slide shows the real modal header', !!hd && hd.querySelectorAll('.mh-hd-av img').length === 2,
  hd ? '(2 avatars, ' + [...hd.querySelectorAll('.mh-hd-nm')].map((e) => e.textContent).join(' vs ') + ')' : '(no .mh-hd)');

// BOTH tabs. The slide shipped striking-only at first and advertised half the feature —
// matchup-free.js exports the grappling payload and always did.
const mhBox = doc.querySelector('.fx-card .mh-slide');
const pane = (k) => mhBox && mhBox.querySelector('[data-mh-pane="' + k + '"]');
check('the matchup slide has both tabs, striking and grappling',
  !!mhBox && [...mhBox.querySelectorAll('.mh-tab')].map((t) => t.textContent).join('|') === 'Striking|Grappling');
check('the grappling tab carries real content',
  !!pane('grappling') && pane('grappling').textContent.length > 300 && /takedown|control|submission/i.test(pane('grappling').textContent),
  '(' + (pane('grappling') ? pane('grappling').innerHTML.length : 0) + 'b of takedown/control/submission analysis)');

// The tab handler resolves panes from the clicked button, never by id — because the same
// payload is live in the card AND the lightbox at once. An id-based handler would drive
// whichever copy the browser found first, from either.
if (mhBox) {
  const tabs = [...mhBox.querySelectorAll('.mh-tab')];
  tabs[1].dispatchEvent(new window.Event('click', { bubbles: true }));
  check('clicking Grappling switches that copy', pane('grappling').style.display !== 'none' && pane('striking').style.display === 'none');
  check('a tab click does not also fire the card open', !doc.getElementById('lb').classList.contains('on'),
    '(stopPropagation — otherwise switching tabs throws you into the lightbox)');
  tabs[0].dispatchEvent(new window.Event('click', { bubbles: true })); // restore
}

// The Climb must show the game's full sheet, not a trimmed sample of it.
const climbSlide = P.slides.find((s) => s.t === 'The Climb');
const climbCats = climbSlide ? (climbSlide.h.match(/width:92px/g) || []).length : 0;
check('the Climb slide shows all nine rating categories', climbCats === 9, '(' + climbCats + '/9)');
const climbLabels = climbSlide ? (climbSlide.h.match(/Heavy favorite|Favorite|Slight edge|Live dog|Underdog/g) || []) : [];
check('the Climb slide offers three fights with the game\'s own odds labels', climbLabels.length === 3,
  '(' + climbLabels.join(' · ') + ')');

// Both tier bands present in the default view.
check('both tier bands render', doc.querySelectorAll('.fx-band').length === 2);

// Two chips — Free and Premium — that jump to the bands. No "All", because there are no
// other modes: both blocks are ALWAYS rendered. A filter with no "All" would have to
// default to hiding one tier, which is the accordion this layout exists to replace.
check('the tier nav is two chips, Free and Premium', doc.querySelectorAll('.fx-fb').length === 2,
  '(' + [...doc.querySelectorAll('.fx-fb')].map((b) => b.textContent).join(', ') + ')');
check('both tiers stay on the page — nothing is hidden behind a chip',
  doc.querySelectorAll('#band-free').length === 1 && doc.querySelectorAll('#band-prem').length === 1 &&
  doc.querySelectorAll('.fx-card').length === P.slides.length,
  '(all ' + doc.querySelectorAll('.fx-card').length + ' cards rendered at once)');

// The background is the page's, not a flat fill I invented. The live landing carries a
// green radial glow behind the hero; the prototype hand-wrote background:var(--bg) and
// looked flatter than the page it's meant to be compared against — so the comparison was
// against my CSS, not the design. Same for body copy: the page uses the system stack.
const protoBody = /\n\s*body\{([^}]*)\}/.exec(html);
const lpBody = /\n\s*body\{margin:0;background:radial-gradient\(([^)]*)\)/.exec(pages);
check('the prototype uses the page\'s real body background, not a flat fill',
  !!protoBody && /radial-gradient/.test(protoBody[1]),
  '(the hero glow: ' + (lpBody ? lpBody[1].slice(0, 44) + '…' : '?') + ')');
check('body copy uses the page\'s own font stack',
  !!protoBody && /-apple-system/.test(protoBody[1]) && !/font-family:'Barlow'/.test(protoBody[1]));

// The nav and footer are the page's real ones, sliced — not redrawn.
check('the real nav is present (logo + hamburger)',
  !!doc.querySelector('.brand-logo') && !!doc.querySelector('.nav-menu-btn') && doc.querySelectorAll('.nav-menu-list a').length > 0);
// THE LANDING'S footer, not just A footer. pages.js contains several <footer
// class="site-footer"> blocks and they differ — the first belongs to another page and
// carries four links where the landing carries two. The generator shipped that one while
// a check for "Terms of Service is present" passed, because both contain it. So compare
// against the landing page's actual link list, read out of pages.js, rather than against
// a string that happens to appear in every version.
const lpStart = pages.indexOf('export const landingPage');
const lpFooter = pages.slice(pages.indexOf('<footer class="site-footer">', lpStart), pages.indexOf('</footer>', pages.indexOf('<footer class="site-footer">', lpStart)));
const wantLinks = [...lpFooter.matchAll(/<a href="([^"]+)"[^>]*>([^<]+)</g)].map((m) => m[2]);
const gotLinks = [...doc.querySelectorAll('.site-footer .foot-links a')].map((a) => a.textContent);
check('the site footer is the LANDING page\'s, not another page\'s',
  gotLinks.length === wantLinks.length && wantLinks.every((l, i) => l === gotLinks[i]),
  '(got [' + gotLinks.join(', ') + '] · landing has [' + wantLinks.join(', ') + '])');
check('the footer keeps the UFC disclaimer',
  /Not affiliated/.test((doc.querySelector('.site-footer .foot-copy') || {}).textContent || ''));
check('exactly one site footer', doc.querySelectorAll('.site-footer').length === 1,
  '(' + doc.querySelectorAll('footer').length + ' <footer> total: the CTA block + the site footer)');
// The hero and the footer quote the price independently. They must quote the SAME one,
// and it must be pages.js's PRICE_LABEL — not a number typed into the copy that keeps
// saying $9.99 after the price moves.
const priceM = /const PRICE_LABEL\s*=\s*["'`]([^"'`]+)["'`]/.exec(pages);
const price = priceM ? priceM[1] : null;
const heroTrust = (doc.querySelector('.fx-trust') || {}).textContent || '';
const footFine = (doc.querySelector('.foot .fine') || {}).textContent || '';
check('the hero quotes the real PRICE_LABEL', !!price && heroTrust.includes(price),
  '(hero says "' + (heroTrust.match(/Premium is ([^,]+)/) || [, '?'])[1] + '", pages.js says "' + price + '")');
check('the hero and the footer agree on the price', !!price && heroTrust.includes(price) && footFine.includes(price));

check('no dead controls: every link/button goes somewhere',
  [...doc.querySelectorAll('.fx-cta a')].every((a) => { const h = a.getAttribute('href'); return h && h !== '#' && (!h.startsWith('#') || doc.querySelector(h)); }),
  '(the #plans anchor that pointed at nothing is gone)');

// The carousel driver must be GONE — a stray 7s timer would defeat the point.
check('no auto-advance survived into the prototype', !/setInterval/.test(html),
  '(the 7s timer and the dots are not here)');

console.log('\nlanding-showcase.html — the grid prototype\n');
ok.forEach((s) => console.log('  ok    ' + s));
fail.forEach((s) => console.log('  FAIL  ' + s));
console.log('\n' + ok.length + ' passed, ' + fail.length + ' failed\n');
process.exit(fail.length ? 1 : 0);
