#!/usr/bin/env node
/**
 * Active roster + weekly changes -> data/roster.json
 *
 * Extracts ACTIVE_ROSTER (the full active fighter list) and ROSTER_CHANGES (weekly
 * signings/releases) from index.html so the free /roster page can render them
 * without shipping the paywalled app. Just a name list — no paywalled data.
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const IDX = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

let fighters = [];
const arM = IDX.match(/const ACTIVE_ROSTER\s*=\s*(\[[\s\S]*?\]);/);
if (arM) { try { fighters = JSON.parse(arM[1]); } catch { fighters = []; } }

let changes = [];
const rcM = IDX.match(/const ROSTER_CHANGES\s*=\s*\[([\s\S]*?)\];/);
if (rcM) {
  const strs = (block, key) => { const m = block.match(new RegExp(key + ":\\s*\\[([^\\]]*)\\]")); if (!m) return []; const out = [], re = /"([^"]*)"/g; let x; while ((x = re.exec(m[1]))) out.push(x[1]); return out; };
  const objRe = /\{([\s\S]*?)\}/g; let o;
  while ((o = objRe.exec(rcM[1]))) {
    const t = o[1];
    const week = (t.match(/week:\s*"([^"]*)"/) || [])[1] || "";
    changes.push({ week, added: strs(t, "added"), removed: strs(t, "removed") });
  }
}

// Roster name -> canonical FIGHTERS name, for names the roster spells differently
// from the profile database ("Abdul Rakhman Yakhyaev" vs "Abdulrakhman Yakhyaev").
// Without this the /roster page and the app can't resolve a profile slug for them
// and render the name greyed out / unclickable.
const aliases = {};
const alM = IDX.match(/const ACTIVE_ROSTER_ALIASES\s*=\s*\{([\s\S]*?)\n\s*\};/);
if (alM) { const re = /"([^"]+)"\s*:\s*"([^"]+)"/g; let x; while ((x = re.exec(alM[1]))) aliases[x[1]] = x[2]; }

fs.writeFileSync(path.join(ROOT, "data/roster.json"), JSON.stringify({ generatedAt: new Date().toISOString(), count: fighters.length, fighters, changes, aliases }) + "\n");
console.log(`roster.json: ${fighters.length} fighters, ${changes.length} change week(s)`);
