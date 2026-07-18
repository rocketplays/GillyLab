#!/usr/bin/env node
/**
 * carousel-data.js — the landing page's feature carousel (CSS + markup + the slide-
 * building script), extracted from worker/pages.js so the /subscribe page can show
 * the EXACT same carousel without forking it. Generated, not copied: the landing
 * page's inline carousel stays the single source of truth, and this keeps the
 * subscribe copy byte-identical.
 *
 * The extracted script still contains the literal `${JSON.stringify(landingData)}`
 * interpolation; because carousel-data.js imports landingData and wraps the script
 * in a template literal, that resolves at render time exactly as it does on landing.
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "worker", "pages.js");
const OUT = path.join(ROOT, "worker", "carousel-data.js");
const idx = fs.readFileSync(SRC, "utf8");

function between(startMarker, endMarker, includeEnd) {
  const s = idx.indexOf(startMarker);
  if (s < 0) throw new Error("gen-carousel: start marker not found: " + startMarker);
  const e = idx.indexOf(endMarker, s + startMarker.length);
  if (e < 0) throw new Error("gen-carousel: end marker not found: " + endMarker);
  return idx.slice(s, includeEnd ? e + endMarker.length : e);
}

// ── markup: the <section class="showcase"> … </section> block ──
const markup = between('<section class="showcase"', "</section>", true).trim();

// ── slide-building script: from `var LD=…` up to the END CAROUSEL SCRIPT sentinel ──
//
// The end marker used to be "// Smooth fade + height on the FAQ accordions" — the first
// line of the FAQ accordion code, which merely happened to follow the slide script. When
// the FAQ moved to /faq that comment moved with it, so indexOf found it further down the
// file and this sliced landingPage's script PLUS signupPage, termsPage and everything
// between into carousel-data.js. No throw — the marker still existed, in the wrong page.
// The output was a syntax error and /subscribe would have failed to build.
//
// The sentinel in pages.js is inert: it is not code, so it cannot be moved by moving
// code, and it can only ever mean "the carousel script ends here".
const END = "/* ===== END CAROUSEL SCRIPT ===== */";
const marks = (idx.match(new RegExp(END.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
if (marks !== 1) throw new Error("expected exactly 1 END CAROUSEL SCRIPT sentinel in pages.js, found " + marks + " — the slice would be ambiguous");
const jsBody = between("var LD=${JSON.stringify(landingData)};", END, false).trim();
// A slice that reaches an `export` has run past the page it was slicing.
if (/\bexport const \w+Page\b/.test(jsBody)) throw new Error("the carousel script slice swallowed another page's export — the end marker is in the wrong place");
const script = "<script>\n(function(){\n  " + jsBody + "\n})();\n</script>";

// ── CSS: the showcase chrome + faithful in-app component styles + fighter slide ──
const css = [
  ".bc{font-family:'Barlow Condensed',sans-serif}",
  between("  .showcase{", "  .foot{text-align:center;margin:52px auto 0}", false).trimEnd(),
  between("  /* Faithful in-app component styles */", "  @media (max-width:760px){", false).trimEnd(),
  between("  /* Featured-fighter slide", "  /* Free vs Premium plans */", false).trimEnd(),
  "  .fsx-val.bad{color:#c76a54}",
].join("\n");

// Build the output file as a plain string so the ${…} inside `script` is written
// verbatim (it must resolve inside carousel-data.js, not here).
// The extracted script carries `${JSON.stringify(...)}` interpolations that resolve when
// carousel-data.js re-wraps it in a template literal — so every name they reference must
// be imported HERE too, not just in pages.js. matchupFree feeds the matchup-hub slide;
// without this import /subscribe throws a ReferenceError at render and loses the whole
// carousel, while the landing page it was copied from stays perfectly fine.
const header = "// AUTO-GENERATED from worker/pages.js by scripts/gen-carousel.cjs — do not edit by hand.\n" +
  '// The landing page carousel, shared with /subscribe so the two stay identical.\n' +
  'import landingData from "./landing-data.js";\n' +
  'import matchupFree from "./matchup-free.js";\n\n';

const out = header +
  "export const carouselCSS = `" + css + "`;\n\n" +
  "export const carouselMarkup = `" + markup + "`;\n\n" +
  "export function carouselScript() {\n  return `" + script + "`;\n}\n";

fs.writeFileSync(OUT, out);
console.log("carousel-data.js: css " + css.length + "b, markup " + markup.length + "b, script " + script.length + "b");
