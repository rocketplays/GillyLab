#!/usr/bin/env node
/**
 * gl-sheet.js — the app's share-sheet renderer (window.GL_SHEET), extracted from
 * index.html so the free /pickem page can generate a pick'em share image that is
 * BYTE-IDENTICAL to what a premium user produces in the app. Generated (not forked)
 * so the two can never drift: index.html stays the single source of truth.
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const IDX = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

const start = IDX.indexOf("const GL_SHEET = (function ()");
const marker = "if (typeof window !== 'undefined') window.GL_SHEET = GL_SHEET;";
const mi = IDX.indexOf(marker, start);
if (start < 0 || mi < 0) { console.error("gen-gl-sheet: GL_SHEET markers not found — leaving last-good gl-sheet.js"); process.exit(0); }
const code = IDX.slice(start, mi + marker.length);

fs.writeFileSync(path.join(ROOT, "gl-sheet.js"),
  "/* AUTO-GENERATED from index.html by scripts/gen-gl-sheet.cjs — do not edit by hand. */\n" + code + "\n");

/* THE CACHE BUSTER, DERIVED FROM THE CODE.
 *
 * gl-sheet.js is served with Cache-Control: public, max-age=86400 and every page
 * asked for it as "?v=1" — a literal, hand-typed 1 that had never moved while the
 * file itself changed across ELEVEN commits. So every change to the share sheet
 * reached users a day late, or not at all, and the symptom is the worst kind: the
 * code is right, the deploy is green, and the picture is last week's.
 *
 * Reported as "the share sheet still doesn't print like the champion page, unless
 * it got reverted" — it hadn't been reverted. It was cached.
 *
 * The other versioned assets (gl-logo.png?v=8, og.png?v=2) are bumped by hand and
 * that works because a human edits the logo and remembers. Nobody edits
 * gl-sheet.js; it's generated. So the version is generated too — a hash of the
 * exact bytes we just wrote. It cannot go stale, because it isn't a number anyone
 * has to remember to change.
 */
const hash = require("crypto").createHash("sha1").update(code).digest("hex").slice(0, 8);
const STAMP = [
  path.join(ROOT, "worker", "pages.js"),           // /pickem
  path.join(ROOT, "prototypes", "the-climb.html"), // /theclimb (via gen-climb-page)
];
let stamped = 0;
for (const f of STAMP) {
  const before = fs.readFileSync(f, "utf8");
  const after = before.replace(/gl-sheet\.js\?v=[A-Za-z0-9]+/g, "gl-sheet.js?v=" + hash);
  if (after !== before) { fs.writeFileSync(f, after); stamped++; }
}
// If nothing got stamped, either the reference moved or someone renamed the file —
// either way the next sheet change would silently serve stale to everyone, which
// is exactly the bug this block exists to kill.
if (!stamped && !STAMP.every(f => fs.readFileSync(f, "utf8").includes("?v=" + hash))) {
  console.error("gen-gl-sheet: no gl-sheet.js?v= reference found to stamp — cache busting is broken");
  process.exit(1);
}
console.log(`gl-sheet.js: ${code.length} bytes, v=${hash} (stamped ${stamped} file(s))`);
// NOTE: run gen-climb-page.cjs AFTER this — it copies the prototype, ?v= and all.
