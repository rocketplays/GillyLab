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
console.log(`gl-sheet.js: ${code.length} bytes`);
