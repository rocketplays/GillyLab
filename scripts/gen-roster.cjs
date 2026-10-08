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

// ── Per-division roster (for "Other fighters in this division" on the rankings pages) ──
// Each active-roster name is placed in a rankings division using the profile database
// (fighter-lite division, falling back to the FIGHTERS code in index.html). The
// rankings pages subtract whoever is currently ranked at render time, so this only
// has to track the roster. Re-run this script whenever ACTIVE_ROSTER changes.
const norm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const CODE2DIV = { FLW: "Flyweight", BW: "Bantamweight", FW: "Featherweight", LW: "Lightweight", WW: "Welterweight", MW: "Middleweight", LHW: "Light Heavyweight", HW: "Heavyweight", WSW: "Women's Strawweight", WFLW: "Women's Flyweight", WBW: "Women's Bantamweight" };
const RANK_DIVS = new Set(Object.values(CODE2DIV));
let lite = {};
try { lite = JSON.parse(fs.readFileSync(path.join(ROOT, "data/fighter-lite.json"), "utf8")).bySlug || {}; } catch {}
const liteByNorm = {};
Object.keys(lite).forEach((k) => { const e = lite[k]; if (e && e.name) liteByNorm[norm(e.name)] = e; });
const codeByNorm = {};
{
  const fi = IDX.indexOf("const FIGHTERS = [");
  const body = IDX.slice(fi, IDX.indexOf("\n];", fi));
  const re = /\{ name: "([^"]+)", division: "([^"]+)"/g; let m;
  while ((m = re.exec(body))) codeByNorm[norm(m[1])] = m[2];
}
const divisions = {}; const unplaced = [];
fighters.forEach((name) => {
  const alt = aliases[name] || "";
  const e = liteByNorm[norm(name)] || (alt && liteByNorm[norm(alt)]) || null;
  let div = e && RANK_DIVS.has(e.division) ? e.division : null;
  if (!div) div = CODE2DIV[codeByNorm[norm(name)] || codeByNorm[norm(alt)]] || null;
  if (!div) { unplaced.push(name); return; }
  (divisions[div] = divisions[div] || []).push({ n: name, s: e ? e.slug : null, p: e ? (e.photo || e.slug) : null });
});
const lastKey = (n) => { const w = n.trim().split(/\s+/); const SUF = /^(jr\.?|sr\.?|ii|iii|iv)$/i; while (w.length > 1 && SUF.test(w[w.length - 1])) w.pop(); const PRE = new Set(["da", "de", "del", "dos", "du", "van", "von", "la", "le", "di", "dos"]); let i = w.length - 1; while (i > 0 && PRE.has(w[i - 1].toLowerCase())) i--; return norm(w.slice(i).join(" ")) + "|" + norm(w.slice(0, i).join(" ")); };
Object.keys(divisions).forEach((d) => divisions[d].sort((a, b) => lastKey(a.n).localeCompare(lastKey(b.n))));
if (unplaced.length) console.log("unplaced (no division known): " + unplaced.join(", "));

fs.writeFileSync(path.join(ROOT, "data/roster.json"), JSON.stringify({ generatedAt: new Date().toISOString(), count: fighters.length, fighters, changes, aliases, divisions }) + "\n");
console.log(`roster.json: ${fighters.length} fighters, ${changes.length} change week(s)`);
