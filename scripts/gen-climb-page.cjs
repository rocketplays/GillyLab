#!/usr/bin/env node
/**
 * worker/climb-page.js — the /theclimb page, generated from
 * prototypes/the-climb.html so the shipped game and the prototype can never be
 * two different games.
 *
 * WHY GENERATED, NOT PORTED. Everything that measures this game reads the
 * prototype: sim-climb-runs.cjs, smoke-climb-divisions.cjs, test-climb.cjs,
 * test-climb-fixes.cjs, check-climb-cap.cjs and climb-arithmetic.cjs all
 * JSDOM the prototype file. Copy it into pages.js and the suite keeps testing the
 * prototype while the page users actually play quietly drifts — every balance
 * number in THE-CLIMB-TUNING.txt would be about a file nobody runs. That is the
 * same failure gen-gl-sheet.cjs exists to prevent for GL_SHEET, and it is worth
 * repeating: the source of truth is the file the tests read.
 *
 * The prototype uses ABSOLUTE asset paths (/data/climb.json, /gl-sheet.js,
 * /photos/thumb/...) so the identical HTML works at /prototypes/the-climb.html
 * and at /theclimb with no path rewriting here. This script only ever does two
 * kinds of thing: swap the prototype-only title, and fill the slots the worker
 * passes in (see SLOTS below). Everything a browser needs to PLAY the game is in
 * the prototype; everything that needs a session, a SITE_URL or a subscription
 * comes through a slot.
 *
 * The slot list has grown from one to five. That is worth watching: if it keeps
 * growing, the page has outgrown being a generated prototype and wants its own
 * module — but every slot so far is site chrome the prototype genuinely cannot
 * have (og tags, account nav, the Premium CTA, the legal footer), not game code.
 *
 * Run: node scripts/gen-climb-page.cjs   (CI runs it in update-odds.yml)
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "prototypes", "the-climb.html");
const OUT = path.join(ROOT, "worker", "climb-page.js");

let html = fs.readFileSync(SRC, "utf8");

// The nav slot has to exist — if someone deletes the marker, the page ships with
// no way back to the rest of the site and nothing anywhere would say so.
if (!html.includes("<!--FREE_NAV-->")) {
  console.error("gen-climb-page: <!--FREE_NAV--> marker missing from the prototype — refusing to generate a page with no nav");
  process.exit(1);
}
// The head slot carries the og tags and the logged-out flag. Lose it and the page
// still works perfectly for the person playing it — which is exactly why it needs
// a guard: link previews and the signup gate would just quietly stop existing, and
// nothing you'd notice while testing the game would tell you.
if (!html.includes("<!--HEAD-->")) {
  console.error("gen-climb-page: <!--HEAD--> marker missing from the prototype — refusing to ship a page with no og tags and no signup gate");
  process.exit(1);
}
if (!html.includes("<!--FOOTER-->")) {
  console.error("gen-climb-page: <!--FOOTER--> marker missing from the prototype — refusing to ship a page with no footer (About/Terms/Privacy/Contact are not optional)");
  process.exit(1);
}
// Same guard for the mount point and the boot fetch: these are the two things
// that make it a game rather than a document, and a silent miss ships a blank page.
for (const needle of ['<div id="app">', "fetch('/data/climb.json')"]) {
  if (!html.includes(needle)) {
    console.error("gen-climb-page: expected " + needle + " in the prototype — refusing to generate");
    process.exit(1);
  }
}

// Prototype-only title. The shipped page wants a real one for the tab and SEO.
html = html.replace(
  "<title>The Climb — GillyLab prototype</title>",
  "<title>The Climb — build a fighter, win the UFC belt | GillyLab</title>\n" +
  '<meta name="description" content="Build a UFC fighter, start as a 10-0 prospect, pick your fights and climb the real rankings to the belt. Free on GillyLab.">'
);

// The page is a template literal in the worker, so anything that would terminate
// or interpolate it has to be escaped. The prototype is full of backticks in
// comments and ${...} would be catastrophic — this is why it's mechanical.
const esc = (s) => s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");

// THE SLOTS, IN DOCUMENT ORDER. Split them off one at a time from the remainder,
// so the chunks can only reassemble in the order they appear in the file — if a
// marker is missing OR out of order the split returns undefined and we fail loudly
// rather than emit a page with the footer in the <head>.
//
// Add a slot here and you must also add: the marker in the prototype, the param in
// the climbPage signature below, and the value at the /theclimb route. Miss the
// last one and the slot silently renders as "" — which is why every marker that
// carries something a PLAYER wouldn't notice missing (og tags, the footer) gets an
// explicit guard above.
const SLOTS = ["<!--HEAD-->", "<!--FREE_NAV-->", "<!--BACK-->", "<!--CTA-->", "<!--FOOTER-->"];
const chunks = [];
let rest = html;
for (const marker of SLOTS) {
  const [before, after] = rest.split(marker);
  if (after === undefined) {
    console.error("gen-climb-page: " + marker + " is missing or out of order (expected " + SLOTS.join(" then ") + ")");
    process.exit(1);
  }
  chunks.push(before);
  rest = after;
}
chunks.push(rest);

fs.writeFileSync(OUT,
  "/* AUTO-GENERATED from prototypes/the-climb.html by scripts/gen-climb-page.cjs — do not edit by hand.\n" +
  "   Edit the prototype: it is what the whole test/sim harness reads. */\n" +
  "export const climbPage = ({ head, nav, back, cta, footer }) => `" + esc(chunks[0]) + "` + (head || \"\") + `" +
  esc(chunks[1]) + "` + (nav || \"\") + `" + esc(chunks[2]) + "` + (back || \"\") + `" +
  esc(chunks[3]) + "` + (cta || \"\") + `" + esc(chunks[4]) + "` + (footer || \"\") + `" +
  esc(chunks[5]) + "`;\n");

console.log("worker/climb-page.js: " + fs.statSync(OUT).size + " bytes from " + html.length + " bytes of prototype");
