#!/usr/bin/env node
/*
 * append-card-history.cjs — after a card, fold the finished bouts the live poller
 * captured in data/live-card.json into the STATIC FIGHT_HISTORY in index.html.
 *
 * Why: the app live-merges live-card.json into FIGHT_HISTORY in the browser, so the
 * full profile is always current — but the lite (SEO) profiles are generated from
 * the static FIGHT_HISTORY at deploy time and don't run that merge. Record, finish
 * rate and win streak all derive from FIGHT_HISTORY, so appending the bout here (once)
 * is all it takes for the lite profiles to catch up too (see gen-landing-data, which
 * derives record + finRate from history).
 *
 * live-card.json already holds a complete, correctly-shaped row per fighter
 * (date/opponent/result/method/round/time/event/org). This script inserts each such
 * row at the top of that fighter's FIGHT_HISTORY array, de-duped by opponent+date, so
 * re-running it (the 3-day workflow window) never double-adds. Only fighters who
 * already have a FIGHT_HISTORY block are touched.
 *
 * Idempotent + non-destructive. Run in the odds workflow before gen-landing-data.
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const INDEX = path.join(ROOT, "index.html");
const LIVE = path.join(ROOT, "data", "live-card.json");

function esc(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

// feed name -> DB FIGHT_HISTORY key, via index.html's SLUG_ALIASES (e.g. live-card's
// "King Green" -> "Bobby Green", "Zach Reese" -> "Zachary Reese").
const SLUG_MAP = { "ł": "l", "Ł": "l", "đ": "d", "Đ": "d", "ø": "o", "Ø": "o", "æ": "ae", "Æ": "ae", "œ": "oe", "Œ": "oe", "ß": "ss", "ı": "i", "İ": "i" };
function nameToSlug(name) {
  return String(name).toLowerCase()
    .replace(/\s+(jr\.?|sr\.?|i{1,3}|iv|v)\s*$/i, "")
    .replace(/[łŁđĐøØæÆœŒßıİ]/g, (c) => SLUG_MAP[c] || c)
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
function loadAliases(h) {
  const m = h.match(/const SLUG_ALIASES\s*=\s*\{([\s\S]*?)\n\s*\};/);
  const d = {}; if (!m) return d;
  const re = /'([^']+)'\s*:\s*'([^']+)'/g; let x;
  while ((x = re.exec(m[1]))) d[x[1]] = x[2];
  return d;
}

function main() {
  let live;
  try { live = JSON.parse(fs.readFileSync(LIVE, "utf8")); } catch { console.log("no live-card.json — nothing to append."); return; }
  const fighters = (live && live.fighters) || {};
  let h = fs.readFileSync(INDEX, "utf8");

  // Bound the search to the FIGHT_HISTORY object so we never touch the
  // same-name arrays in TAPE_STUDY / ODDS_HISTORY / ACCOLADES.
  const fhStart = h.indexOf("const FIGHT_HISTORY = {");
  if (fhStart < 0) { console.log("FIGHT_HISTORY not found."); return; }
  const aliases = loadAliases(h);

  let added = 0, dupes = 0, noblock = 0;
  for (const [name, data] of Object.entries(fighters)) {
    const rows = (data && data.history) || [];
    if (!rows.length) continue;
    const key = aliases[nameToSlug(name)] || name;   // DB FIGHT_HISTORY key
    for (const r of rows) {
      if (!r || !r.opponent || !r.date) continue;
      // Locate this fighter's FIGHT_HISTORY array: "<key>": [  followed by a
      // date-shaped row (distinguishes it from the odds/tape/accolade arrays).
      const re = new RegExp('("' + esc(key) + '":\\s*\\[)(\\s*\\n\\s*\\{ date:)');
      const m = re.exec(h.slice(fhStart));
      if (!m) { noblock++; continue; }
      const at = fhStart + m.index;
      const blockOpenEnd = at + m[1].length;               // just after the "[":
      // De-dupe within this fighter's array (scan to its closing "]").
      const close = h.indexOf("\n  ],", blockOpenEnd);
      const block = h.slice(blockOpenEnd, close < 0 ? blockOpenEnd + 4000 : close);
      const dup = new RegExp('opponent:\\s*"' + esc(r.opponent) + '"[^}]*date:\\s*"' + esc(r.date) + '"|date:\\s*"' + esc(r.date) + '"[^}]*opponent:\\s*"' + esc(r.opponent) + '"');
      if (dup.test(block)) { dupes++; continue; }
      const row = `\n    { date: ${JSON.stringify(r.date)}, opponent: ${JSON.stringify(r.opponent)}, result: ${JSON.stringify(r.result || "")}, method: ${JSON.stringify(r.method || "")}, round: ${Number(r.round) || 0}, time: ${JSON.stringify(r.time || "")}, event: ${JSON.stringify(r.event || "")}, org: ${JSON.stringify(r.org || "UFC")} },`;
      h = h.slice(0, blockOpenEnd) + row + h.slice(blockOpenEnd);
      added++;
      console.log(`  + ${name}: ${r.result} vs ${r.opponent} (${r.method}) ${r.date}`);
    }
  }

  if (added) fs.writeFileSync(INDEX, h);
  console.log(`append-card-history: added ${added} | already-present ${dupes} | no FIGHT_HISTORY block ${noblock}`);
}

main();
