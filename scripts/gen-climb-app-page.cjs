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
for (const needle of ["/gl-sheet.js", "fetch('/data/climb.json')", "fetch('/api/activity/climb-run'"]) {
  if (!html.includes(needle)) {
    console.error("gen-climb-app-page: expected to find " + JSON.stringify(needle) + " in the prototype — refusing to generate (the source file changed shape; update this script's rewrites to match)");
    process.exit(1);
  }
}

const SITE = "https://gillylab.com";
html = html
  .replace('<script src="/gl-sheet.js?v=06bcf16b" defer></script>', '<script src="' + SITE + '/gl-sheet.js?v=06bcf16b" defer></script>')
  .replace("fetch('/data/climb.json')", "fetch('" + SITE + "/api/app/climb')")
  .replace("fetch('/api/activity/climb-run', { method:'POST', keepalive:true })", "fetch('" + SITE + "/api/activity/climb-run', { method:'POST', keepalive:true })")
  // The prototype's load-failure message tells a developer to run a local
  // Python server -- correct advice when opening the file directly, actively
  // confusing inside a shipped app. Swap it for something a player would
  // actually do.
  .replace(
    /\$\('#app'\)\.innerHTML='<div class="load">Could not load \/data\/climb\.json — '\+e\.message\+[\s\S]*?<\/div>';/,
    "$('#app').innerHTML='<div class=\"load\">Couldn\\'t load The Climb — check your connection and try again.</div>';"
  );

fs.writeFileSync(OUT, html);
console.log("mobile/www/climb-game.html: " + fs.statSync(OUT).size + " bytes from " + html.length + " bytes of prototype");
