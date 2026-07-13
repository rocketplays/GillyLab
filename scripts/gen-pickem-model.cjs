#!/usr/bin/env node
/**
 * worker/pickem-model.js — a compact, server-only map of the model's win probability
 * per fighter per recent event, distilled from the (paywalled) predictions log.
 *
 * Used by the Worker's results-recap email to show FREE players what the model gave
 * their pick ("the model had Whittaker at 61%") as an upgrade hook. It's imported
 * into the Worker (never served to a client), and only covers recent events + only
 * the win %, so the paywalled model isn't exposed.
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "worker", "pickem-model.js");

const norm = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/\b(jr|sr|ii|iii|iv|v)\b/g, "").replace(/[^a-z0-9]+/g, "");
const DAYS = 40;   // only keep events within this window (keeps the file small + relevant)

let log;
try { log = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "predictions-log.json"), "utf8")); }
catch (e) { console.error("gen-pickem-model: no predictions-log.json — leaving last-good file"); process.exit(0); }

const snaps = Array.isArray(log && log.snapshots) ? log.snapshots : [];
const cutoff = Date.now() - DAYS * 24 * 3600 * 1000;
// For each event+fight, keep the most-recently-captured snapshot (the closing model line).
const latest = new Map();   // key: normEvent|fightId -> snapshot
for (const s of snaps) {
  if (!s || !s.event || !s.model) continue;
  const t = Date.parse(s.commenceTime || s.capturedAt || 0) || 0;
  if (t && t < cutoff) continue;
  const key = norm(s.event) + "|" + (s.fightId || "");
  const prev = latest.get(key);
  if (!prev || (Date.parse(s.capturedAt || 0) || 0) > (Date.parse(prev.capturedAt || 0) || 0)) latest.set(key, s);
}

// Flat map: normalized fighter name -> model win %. Matching a pick by fighter (not
// event) is robust — a fighter appears at most once in the recent window. Keep the
// most-recently-captured value per fighter.
const byFighter = {};   // normName -> { pct, at }
const put = (nm, pct, at) => { const k = norm(nm); if (!k || !pct) return; const p = byFighter[k]; if (!p || at > p.at) byFighter[k] = { pct, at }; };
for (const s of latest.values()) {
  const at = Date.parse(s.capturedAt || 0) || 0;
  const pctA = Math.round((s.model.pA || 0) * 100), pctB = Math.round((s.model.pB || 0) * 100);
  put(s.a && s.a.feed, pctA, at); put(s.a && s.a.db, pctA, at);
  put(s.b && s.b.feed, pctB, at); put(s.b && s.b.db, pctB, at);
}
const model = {};
for (const k in byFighter) model[k] = byFighter[k].pct;

fs.writeFileSync(OUT,
  "// AUTO-GENERATED from data/predictions-log.json by scripts/gen-pickem-model.cjs — do not edit by hand.\n" +
  "// Server-only: the Worker reads this to show free players the model's take on their pick.\n" +
  "export const pickemModel = " + JSON.stringify(model) + ";\n");
console.log("pickem-model.js: " + Object.keys(model).length + " fighters, " + JSON.stringify(model).length + " bytes");
