#!/usr/bin/env node
/**
 * mobile/www/climb-game.html — the app's Climb screen, generated from
 * prototypes/the-climb.html so the app and the website can never play two
 * different games (same reasoning as gen-climb-page.cjs and
 * gen-bracket-page.cjs). Whatever gets balance-tuned there ships here too,
 * automatically, instead of a hand-copied twin that quietly drifts.
 *
 * Two real differences from the website's /theclimb, both deliberate product
 * decisions (not workarounds):
 *
 *  1. The website gates /data/climb.json behind a login (see readSession in
 *     worker/index.js) and injects `window.CLIMB_LOCKED=1` for logged-out
 *     visitors. The app is specced to let anyone play Climb without an
 *     account, so this file fetches the new, deliberately ungated
 *     GET /api/app/climb instead -- same ladder data, no session required.
 *     The raw prototype never sets CLIMB_LOCKED itself (only the worker's
 *     <!--HEAD--> injection does that), so no gate-removal code is needed
 *     here -- just point the fetch at the endpoint that doesn't check.
 *
 *  2. The app's WebView is a different origin from gillylab.com, so the
 *     handful of root-relative asset/API references (gl-sheet.js, the climb
 *     data fetch, the best-effort activity ping) need to become absolute
 *     URLs -- same treatment gen-bracket-page.cjs's fighter photos already
 *     get, for the same reason.
 *
 *  3. The prototype's own "The Climb" h1 + tagline are dropped. The app
 *     shell already puts its own GillyLab brand header above this iframe
 *     (see mobile/www/js/screens/climb.js's fullbleed handling in app.css) --
 *     keeping the in-page title too was double branding stacked right under
 *     the safe-area/notch. The "Build a fighter..." explainer paragraph
 *     stays; that's instructions, not chrome.
 *
 *  4. The prototype's own aurora background (html{background:radial-
 *     gradient(...)}, #bgfx, #bgedge) is stripped, and the iframe itself is
 *     made transparent (see .gl-embed-frame in app.css). mobile/www/index.html
 *     already renders its OWN #bgfx/#bgedge once, behind the whole app shell
 *     -- sized to the real device viewport. The prototype's copy is sized to
 *     the IFRAME's shorter viewport instead (it sits below this screen's
 *     title and above the tab bar), so its gradient's vh-relative positions
 *     don't line up with the app shell's -- the two auroras visibly
 *     disagreed at the iframe's edges, which is what made the game read as
 *     "in a box" separate from the rest of the page. A transparent iframe
 *     over an app shell that already paints the correct one is simpler than
 *     trying to make two independent gradients agree.
 *
 * This file is loaded inside an <iframe> by mobile/www/js/screens/climb.js,
 * not injected into the app's own DOM -- the game's CSS assumes it owns the
 * whole page (its own fonts, background, viewport), which an iframe gives it
 * for free without fighting the app shell's own styles.
 *
 * Run: node scripts/gen-climb-app-page.cjs
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "prototypes", "the-climb.html");
const OUT = path.join(ROOT, "mobile", "www", "climb-game.html");

let html = fs.readFileSync(SRC, "utf8");

// Same guard reasoning as the other gen-*.cjs scripts: a marker or hook that
// silently goes missing ships a broken page, and nothing about playing the
// game would tell you.
const CLIMB_H1 = '<h1>The <span class="g">Climb</span></h1>';
const CLIMB_TAG = '<p class="tag">Can you become a UFC champion?</p>';
const AURORA_HTML_BG_RE = /html\{background:#0a0a0b radial-gradient\([^)]*\)\}/;
const BGFX_RULE_RE = /#bgfx\{[^}]*\}/;
const BGEDGE_RULE_RE = /#bgedge\{[^}]*\}/;
const BGFX_DIVS = '<div id="bgfx"></div><div id="bgedge"></div>';

// gl-sheet.js's own cache-busting query string changes independently of
// this generator (bumped whenever that shared script itself is edited) — a
// hardcoded ?v=... here is exactly the kind of "silently stops matching"
// trap CLAUDE.md warns about: .replace() on a stale literal just returns
// the string unchanged, no error, and ships a root-relative <script> tag
// that 404s inside the app's cross-origin iframe. Matched by regex instead,
// on the src prefix only, so a version bump can never desync this rewrite.
const GL_SHEET_RE = /<script src="\/gl-sheet\.js(\?v=[^"]*)?" defer><\/script>/;

for (const needle of ["fetch('/data/climb.json')", "fetch('/api/activity/climb-run'", CLIMB_H1, CLIMB_TAG, BGFX_DIVS]) {
  if (!html.includes(needle)) {
    console.error("gen-climb-app-page: expected to find " + JSON.stringify(needle) + " in the prototype — refusing to generate (the source file changed shape; update this script's rewrites to match)");
    process.exit(1);
  }
}
if (!GL_SHEET_RE.test(html)) {
  console.error("gen-climb-app-page: expected to find a <script src=\"/gl-sheet.js...\" defer> tag in the prototype — refusing to generate (the source file changed shape; update this script's rewrites to match)");
  process.exit(1);
}
for (const [name, re] of [["html{background:...}", AURORA_HTML_BG_RE], ["#bgfx{...}", BGFX_RULE_RE], ["#bgedge{...}", BGEDGE_RULE_RE]]) {
  if (!re.test(html)) {
    console.error("gen-climb-app-page: expected to find " + name + " in the prototype — refusing to generate (the source file changed shape; update this script's rewrites to match)");
    process.exit(1);
  }
}

const SITE = "https://gillylab.com";
html = html
  .replace(GL_SHEET_RE, (m, qs) => '<script src="' + SITE + '/gl-sheet.js' + (qs || '') + '" defer></script>')
  .replace("fetch('/data/climb.json')", "fetch('" + SITE + "/api/app/climb')")
  .replace("fetch('/api/activity/climb-run', { method:'POST', keepalive:true })", "fetch('" + SITE + "/api/activity/climb-run', { method:'POST', keepalive:true })")
  // The prototype's load-failure message tells a developer to run a local
  // Python server -- correct advice when opening the file directly, actively
  // confusing inside a shipped app. Swap it for something a player would
  // actually do.
  .replace(
    /\$\('#app'\)\.innerHTML='<div class="load">Could not load \/data\/climb\.json — '\+e\.message\+[\s\S]*?<\/div>';/,
    "$('#app').innerHTML='<div class=\"load\">Couldn\\'t load The Climb — check your connection and try again.</div>';"
  )
  .replace(CLIMB_H1, '')
  .replace(CLIMB_TAG, '')
  .replace(AURORA_HTML_BG_RE, 'html{background:transparent}')
  .replace(BGFX_RULE_RE, '')
  .replace(BGEDGE_RULE_RE, '')
  .replace(BGFX_DIVS, '');

fs.writeFileSync(OUT, html);
console.log("mobile/www/climb-game.html: " + fs.statSync(OUT).size + " bytes from " + html.length + " bytes of prototype");
