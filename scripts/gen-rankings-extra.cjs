#!/usr/bin/env node
/**
 * Rankings enrichment -> data/rankings-extra.json
 *
 * The UFC rankings feed is missing data for ~12 fighters: a non-canonical display
 * name (e.g. "Patricio Freire" vs the DB's "Patrício Pitbull", which also breaks
 * the photo lookup), and no country/flag. This resolves each ranked fighter to the
 * DB's canonical name (ACTIVE_ROSTER_ALIASES + FIGHTERS-by-slug), derives the photo
 * slug the app uses, and fills the flag from the DB's per-fighter country — so the
 * free /rankings page matches the app. Keyed by the feed's fighterSlug.
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const rd = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const IDX = rd("index.html");

// ── nameToSlug (mirror index.html) ──────────────────────────────────────────
const SLUG_LETTER_MAP = { "ł": "l", "Ł": "l", "đ": "d", "Đ": "d", "ø": "o", "Ø": "o", "æ": "ae", "Æ": "ae", "œ": "oe", "Œ": "oe", "ß": "ss", "ı": "i", "İ": "i" };
function nameToSlug(name) {
  return String(name || "").toLowerCase()
    .replace(/\s+(jr\.?|sr\.?|i{1,3}|iv|v)\s*$/i, "")
    .replace(/[łŁđĐøØæÆœŒßıİ]/g, (ch) => SLUG_LETTER_MAP[ch] || ch)
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ── DB tables from index.html ───────────────────────────────────────────────
// Display-name aliases: feed/roster name -> canonical DB name.
const ALIASES = (() => {
  const m = IDX.match(/const ACTIVE_ROSTER_ALIASES\s*=\s*\{([\s\S]*?)\n\s*\};/);
  const o = {}; if (!m) return o;
  const re = /"([^"]+)"\s*:\s*"([^"]+)"/g; let x;
  while ((x = re.exec(m[1]))) o[x[1]] = x[2];
  return o;
})();
// FIGHTERS: canonical name -> country, and slug -> canonical name.
const NAME_COUNTRY = {}, SLUG_NAME = {};
(() => {
  const start = IDX.indexOf("const FIGHTERS");
  const open = IDX.indexOf("[", start);
  if (open < 0) return;
  // bounded scan to the matching ]
  let depth = 0, inStr = false, esc = false, end = -1;
  for (let i = open; i < IDX.length; i++) {
    const c = IDX[i];
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') { inStr = true; continue; }
    if (c === "[") depth++;
    else if (c === "]") { depth--; if (depth === 0) { end = i; break; } }
  }
  const block = IDX.slice(open, end < 0 ? undefined : end);
  const re = /\{\s*name:\s*"([^"]+)"[^}]*?\}/g; let m;
  while ((m = re.exec(block))) {
    const obj = m[0], name = m[1];
    const cm = obj.match(/country:\s*"([^"]*)"/);
    NAME_COUNTRY[name] = cm ? cm[1] : "";
    SLUG_NAME[nameToSlug(name)] = name;
  }
})();

function resolveCanon(feedName, feedSlug) {
  if (ALIASES[feedName]) return ALIASES[feedName];
  if (feedSlug && SLUG_NAME[feedSlug]) return SLUG_NAME[feedSlug];
  const ns = nameToSlug(feedName);
  if (SLUG_NAME[ns]) return SLUG_NAME[ns];
  return feedName;
}

// ── country -> flag emoji ───────────────────────────────────────────────────
const CC = {
  "United States": "US", "USA": "US", "Brazil": "BR", "Russia": "RU", "England": "GB",
  "United Kingdom": "GB", "Scotland": "GB", "Wales": "GB", "Ireland": "IE", "Northern Ireland": "GB",
  "Mexico": "MX", "Canada": "CA", "Australia": "AU", "New Zealand": "NZ", "France": "FR",
  "Germany": "DE", "Poland": "PL", "Netherlands": "NL", "Spain": "ES", "Italy": "IT",
  "Sweden": "SE", "Norway": "NO", "Denmark": "DK", "Georgia": "GE", "Dagestan": "RU",
  "Kazakhstan": "KZ", "Kyrgyzstan": "KG", "Uzbekistan": "UZ", "Tajikistan": "TJ", "Azerbaijan": "AZ",
  "Armenia": "AM", "China": "CN", "Japan": "JP", "South Korea": "KR", "Korea": "KR",
  "Thailand": "TH", "Philippines": "PH", "Indonesia": "ID", "India": "IN", "Mongolia": "MN",
  "Cuba": "CU", "Argentina": "AR", "Chile": "CL", "Peru": "PE", "Ecuador": "EC",
  "Colombia": "CO", "Venezuela": "VE", "Panama": "PA", "Nigeria": "NG", "Cameroon": "CM",
  "South Africa": "ZA", "Morocco": "MA", "Iran": "IR", "Iraq": "IQ", "Turkey": "TR",
  "Portugal": "PT", "Belgium": "BE", "Switzerland": "CH", "Austria": "AT", "Croatia": "HR",
  "Serbia": "RS", "Slovakia": "SK", "Czechia": "CZ", "Czech Republic": "CZ", "Lithuania": "LT",
  "Moldova": "MD", "Ukraine": "UA", "Romania": "RO", "Bulgaria": "BG", "Finland": "FI",
  "Israel": "IL", "Afghanistan": "AF", "Suriname": "SR", "Jamaica": "JM", "Greece": "GR",
};
const flagFor = (country) => {
  const iso = CC[String(country || "").trim()];
  if (!iso) return "";
  return String.fromCodePoint(...[...iso.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
};

// ── build overrides for every ranked fighter across both files ──────────────
const bySlug = {};
["data/rankings.json", "data/rankings-meta.json"].forEach((f) => {
  let j; try { j = JSON.parse(rd(f)); } catch { return; }
  (j.data || []).forEach((e) => {
    const slug = e.fighterSlug; if (!slug || bySlug[slug]) return;
    const canon = resolveCanon(e.fighterName, slug);
    bySlug[slug] = { name: canon, photo: nameToSlug(canon), flag: flagFor(NAME_COUNTRY[canon]) };
  });
});

fs.writeFileSync(path.join(ROOT, "data/rankings-extra.json"), JSON.stringify({ generatedAt: new Date().toISOString(), bySlug }, null, 2) + "\n");
const n = Object.keys(bySlug).length;
console.log(`rankings-extra.json: ${n} fighters | aliases ${Object.keys(ALIASES).length} | FIGHTERS ${Object.keys(NAME_COUNTRY).length}`);
console.log("  Patricio:", JSON.stringify(bySlug["patricio-freire"] || "(not found)"));
