#!/usr/bin/env node
// Run this AFTER gen-app-fighter-extras.cjs / gen-fight-sim.cjs /
// gen-deep-dive.cjs regenerate worker/fighter-extras.js, worker/fight-sim.js,
// or worker/deep-dive-data.js -- those three generators still emit the old
// "bake the whole dataset as a JS literal" shape (19MB/10.5MB/18MB), which
// is what caused the Sep 2026 cold-start latency incident (run_worker_first
// means every request, even a cached static asset, has to parse whatever's
// in the Worker bundle). This script pulls the giant data back out into
// data/*.json (fetched lazily at runtime via env.ASSETS instead) and
// rewrites the three worker/*.js files to match, same as it did the first
// time -- see that commit for the full reasoning and the exact functions
// that stay eager vs go lazy.
//
// TODO: fold this logic directly into the three generators so this manual
// second step isn't needed. Not done yet -- flagged, not silently skipped.
//
// Usage: node scripts/split-worker-data.cjs
"use strict";
const fs = require("fs");
const path = require("path");

function findRoot() {
  const guess = require("path").join(__dirname, "..");
  if (fs.existsSync(require("path").join(guess, "wrangler.toml"))) return guess;
  throw new Error("could not find repo root (expected wrangler.toml next to scripts/..)");
}
const ROOT = findRoot();
const W = path.join(ROOT, "worker");
const D = path.join(ROOT, "data");

function readLines(file) {
  return fs.readFileSync(file, "utf8").split("\n");
}
function extractAssignment(line, prefix) {
  if (!line.startsWith(prefix)) throw new Error("prefix mismatch: expected " + JSON.stringify(prefix) + " got " + JSON.stringify(line.slice(0, prefix.length + 20)));
  let body = line.slice(prefix.length);
  if (body.endsWith(";")) body = body.slice(0, -1);
  return JSON.parse(body); // validates it's real JSON, throws loudly if not
}

// ---------- 1. fighter-extras.js ----------
(function () {
  const file = path.join(W, "fighter-extras.js");
  const lines = readLines(file);
  // find the export default line (should be the only huge one)
  const idx = lines.findIndex((l) => l.startsWith("export default "));
  if (idx === -1) throw new Error("fighter-extras.js: no 'export default' line found");
  const data = extractAssignment(lines[idx], "export default ");
  const outJson = path.join(D, "fighter-extras-full.json");
  fs.writeFileSync(outJson, JSON.stringify(data));
  console.log("wrote " + outJson + " (" + fs.statSync(outJson).size + " bytes)");

  const header = lines.slice(0, idx).join("\n");
  const newBody = `
// DATA MOVED OUT: this used to be a 19MB \`export default {...}\` object
// literal baked directly into the bundle, which meant V8 had to parse and
// compile it on every cold Worker isolate start -- for EVERY request,
// because wrangler.toml's run_worker_first=true means this module gets
// pulled in regardless of route. The data itself now lives in
// data/fighter-extras-full.json (excluded by name in build-site.sh, same
// treatment as data/fight-grid-all.json -- see CLAUDE.md #1/#3), fetched
// once per isolate via env.ASSETS and cached in memory. Callers must now
// \`await getFighterExtras(env)\` instead of importing a ready-made object.
let _cache = null;
let _loading = null;
async function getFighterExtras(env) {
  if (_cache) return _cache;
  if (_loading) return _loading;
  _loading = (async () => {
    const res = await env.ASSETS.fetch(new Request("https://internal.gillylab/data/fighter-extras-full.json"));
    if (!res.ok) throw new Error("fighter-extras-full.json missing from the deployed build (status " + res.status + ") -- did build-site.sh run after this data was regenerated?");
    _cache = await res.json();
    return _cache;
  })();
  try { return await _loading; } finally { _loading = null; }
}
export { getFighterExtras };
`;
  fs.writeFileSync(file, header + "\n" + newBody);
  console.log("rewrote " + file + " (" + fs.statSync(file).size + " bytes, was 19266338+)");
})();

// ---------- 2. fight-sim.js ----------
(function () {
  const file = path.join(W, "fight-sim.js");
  const lines = readLines(file);
  const histIdx = lines.findIndex((l) => l.startsWith("const FIGHT_HISTORY = "));
  if (histIdx === -1) throw new Error("fight-sim.js: FIGHT_HISTORY line not found");
  const data = extractAssignment(lines[histIdx], "const FIGHT_HISTORY = ");
  const outJson = path.join(D, "fight-sim-history.json");
  fs.writeFileSync(outJson, JSON.stringify(data));
  console.log("wrote " + outJson + " (" + fs.statSync(outJson).size + " bytes)");

  // Replace just that one line with a `let` declaration + loader. Everything
  // else (FIGHTER_STATS, FIGHTERS, and all ~2680 lines of actual sim logic)
  // is untouched -- those stay eager (small: ~900KB combined) since
  // resolveSimName()/canonicalSimName()/fighterTaleOfTape() (used broadly,
  // including by unrelated rank-badge code in index.js) only ever touch
  // FIGHTER_STATS, never FIGHT_HISTORY. Confirmed by reading resolveSimName's
  // body before making this change.
  const loader = `let FIGHT_HISTORY = null;
let _fsHistLoading = null;
async function _ensureFightHistory(env) {
  if (FIGHT_HISTORY) return;
  if (_fsHistLoading) return _fsHistLoading;
  _fsHistLoading = (async () => {
    const res = await env.ASSETS.fetch(new Request("https://internal.gillylab/data/fight-sim-history.json"));
    if (!res.ok) throw new Error("fight-sim-history.json missing from the deployed build (status " + res.status + ")");
    FIGHT_HISTORY = await res.json();
  })();
  try { await _fsHistLoading; } finally { _fsHistLoading = null; }
}`;
  lines[histIdx] = loader;
  fs.writeFileSync(file, lines.join("\n"));
  console.log("rewrote " + file + " (" + fs.statSync(file).size + " bytes)");
})();

// ---------- 3. deep-dive-data.js ----------
(function () {
  const file = path.join(W, "deep-dive-data.js");
  const lines = readLines(file);
  const statsIdx = lines.findIndex((l) => l.startsWith("window.FIGHT_STATS = "));
  const histIdx = lines.findIndex((l) => l.startsWith("const FIGHT_HISTORY = "));
  if (statsIdx === -1) throw new Error("deep-dive-data.js: window.FIGHT_STATS line not found");
  if (histIdx === -1) throw new Error("deep-dive-data.js: FIGHT_HISTORY line not found");
  const stats = extractAssignment(lines[statsIdx], "window.FIGHT_STATS = ");
  const hist = extractAssignment(lines[histIdx], "const FIGHT_HISTORY = ");
  const outJson = path.join(D, "deep-dive-history.json");
  fs.writeFileSync(outJson, JSON.stringify({ FIGHT_STATS: stats, FIGHT_HISTORY: hist }));
  console.log("wrote " + outJson + " (" + fs.statSync(outJson).size + " bytes)");

  // FIGHT_GRID stays eager (292KB) -- glDeepDiveAvailable()/glHasGrid() only
  // ever touch window.GRID_NAMES (built from FIGHT_GRID), confirmed by
  // reading both functions' bodies before making this change. Only
  // computeDeepDive() (the heavy per-request render) touches FIGHT_STATS/
  // FIGHT_HISTORY.
  const loader = `let _ddLoading = null;
async function _ensureDeepDiveHistory(env) {
  if (window.FIGHT_STATS && typeof FIGHT_HISTORY !== "undefined" && FIGHT_HISTORY) return;
  if (_ddLoading) return _ddLoading;
  _ddLoading = (async () => {
    const res = await env.ASSETS.fetch(new Request("https://internal.gillylab/data/deep-dive-history.json"));
    if (!res.ok) throw new Error("deep-dive-history.json missing from the deployed build (status " + res.status + ")");
    const j = await res.json();
    window.FIGHT_STATS = j.FIGHT_STATS;
    FIGHT_HISTORY = j.FIGHT_HISTORY;
  })();
  try { await _ddLoading; } finally { _ddLoading = null; }
}`;
  // FIGHT_HISTORY was `const` -- must become `let` so the loader can assign it.
  lines[histIdx] = loader;
  // remove the old window.FIGHT_STATS assignment line entirely (loader sets it)
  lines[statsIdx] = "// window.FIGHT_STATS is now populated lazily by _ensureDeepDiveHistory() below, not baked here.";
  // Need a `let FIGHT_HISTORY;` declared before first use (module scope) --
  // insert right after the window shim (line with "const window = {};").
  const shimIdx = lines.findIndex((l) => l.trim() === "const window = {};");
  if (shimIdx === -1) throw new Error("deep-dive-data.js: window shim line not found");
  lines.splice(shimIdx + 1, 0, "let FIGHT_HISTORY;");
  fs.writeFileSync(file, lines.join("\n"));
  console.log("rewrote " + file + " (" + fs.statSync(file).size + " bytes)");
})();

console.log("done");
