#!/usr/bin/env node
/**
 * worker/bracket-page.js — the /bracket page, generated from
 * prototypes/legends-bracket.html so the shipped page and the prototype can
 * never be two different games. Same reasoning as gen-climb-page.cjs (see
 * that file for the fuller version of this argument): whatever gets balance-
 * tuned or screenshotted for feedback has to be the file that actually ships,
 * not a hand-copied twin of it that quietly drifts.
 *
 * The prototype uses no site-relative assets beyond Google Fonts, so unlike
 * the-climb.html there's no absolute-path requirement to satisfy — it's
 * self-contained CSS/JS with an in-memory 8-fighter demo pool, no fetch()
 * calls at all. That will change once this is wired to real data; until then
 * this script only does two things: swap the prototype-only title, and fill
 * the slots the worker passes in (see SLOTS below).
 *
 * Run: node scripts/gen-bracket-page.cjs
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "prototypes", "legends-bracket.html");
const OUT = path.join(ROOT, "worker", "bracket-page.js");

let html = fs.readFileSync(SRC, "utf8");

// Same reasoning as gen-climb-page.cjs's guards: a marker or mount point that
// silently goes missing ships a broken or half-branded page, and nothing
// about playing the game would tell you.
if (!html.includes("<!--FREE_NAV-->")) {
  console.error("gen-bracket-page: <!--FREE_NAV--> marker missing from the prototype — refusing to generate a page with no nav");
  process.exit(1);
}
if (!html.includes("<!--HEAD-->")) {
  console.error("gen-bracket-page: <!--HEAD--> marker missing from the prototype — refusing to ship a page with no og tags");
  process.exit(1);
}
if (!html.includes("<!--FOOTER-->")) {
  console.error("gen-bracket-page: <!--FOOTER--> marker missing from the prototype — refusing to ship a page with no footer (About/Terms/Privacy/Contact are not optional)");
  process.exit(1);
}
for (const needle of ['<div class="bracket" id="bracket">', 'id="submitBtn"']) {
  if (!html.includes(needle)) {
    console.error("gen-bracket-page: expected " + needle + " in the prototype — refusing to generate");
    process.exit(1);
  }
}

// Prototype-only title. The shipped page wants a real one for the tab and SEO.
html = html.replace(
  "<title>Legends Bracket — GillyLab prototype</title>",
  "<title>Legends Bracket — Weekly UFC Fantasy Tournament | GillyLab</title>\n" +
  '<meta name="description" content="Fill out a randomized 8-fighter bracket every week, any era, scored like a March Madness pool. Free to play on GillyLab.">'
);

// The page is a template literal in the worker — escape anything that would
// terminate or interpolate it.
const esc = (s) => s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");

// THE SLOTS, IN DOCUMENT ORDER. Split them off one at a time from the
// remainder, so a missing or out-of-order marker fails loudly instead of
// silently reassembling the page in the wrong order.
//
// Add a slot here and you must also add: the marker in the prototype, the
// param in the bracketPage signature below, and the value at the /bracket
// route. Miss the last one and the slot silently renders as "".
const SLOTS = ["<!--HEAD-->", "<!--FREE_NAV-->", "<!--BACK-->", "<!--CTA-->", "<!--FOOTER-->"];
const chunks = [];
let rest = html;
for (const marker of SLOTS) {
  const [before, after] = rest.split(marker);
  if (after === undefined) {
    console.error("gen-bracket-page: " + marker + " is missing or out of order (expected " + SLOTS.join(" then ") + ")");
    process.exit(1);
  }
  chunks.push(before);
  rest = after;
}
chunks.push(rest);

fs.writeFileSync(OUT,
  "/* AUTO-GENERATED from prototypes/legends-bracket.html by scripts/gen-bracket-page.cjs — do not edit by hand.\n" +
  "   Edit the prototype instead. */\n" +
  "export const bracketPage = ({ head, nav, back, cta, footer }) => `" + esc(chunks[0]) + "` + (head || \"\") + `" +
  esc(chunks[1]) + "` + (nav || \"\") + `" + esc(chunks[2]) + "` + (back || \"\") + `" +
  esc(chunks[3]) + "` + (cta || \"\") + `" + esc(chunks[4]) + "` + (footer || \"\") + `" +
  esc(chunks[5]) + "`;\n");

console.log("worker/bracket-page.js: " + fs.statSync(OUT).size + " bytes from " + html.length + " bytes of prototype");
