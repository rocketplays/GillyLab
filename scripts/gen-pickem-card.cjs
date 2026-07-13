#!/usr/bin/env node
/**
 * Per-card Pick'em scoring table -> data/pickem-card.json
 *
 * The standalone /pickem page can't ship the paywalled odds + fight-history data
 * that the in-app pick UI uses to price each pick. This generator reproduces that
 * exact math (winnerBase from odds, methodBonus from fight history, roundBonus) for
 * the CURRENT card only, and writes a tiny table the page embeds. Because it reads
 * the SAME data/odds.json + index.html FIGHT_HISTORY the app does, free and paid
 * picks snapshot identical wPts/mPts/rPts — so one shared leaderboard stays fair.
 *
 * Mirrors index.html: P_WIN/P_METHOD, winnerBase, winProb, methodDist/Bonus,
 * roundBonus, namesLikelyMatch. Keep in sync if that scoring ever changes.
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const rd = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

// ── constants (mirror index.html) ───────────────────────────────────────────
const P_WIN = 10, P_METHOD = 5, RECENCY_DECAY = 0.9;
const roundBonus = (r) => (r ? 3 + r : 0);
const METHODS = ["KO/TKO", "Submission", "Decision"];

// ── name matching (mirror index.html) ───────────────────────────────────────
function levenshteinDist(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] : 1 + Math.min(prev[j - 1], prev[j], cur[j - 1]);
    prev = cur;
  }
  return prev[n];
}
function nameTokens(name) {
  return String(name || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z\s]/g, "").trim().split(/\s+/).filter(Boolean);
}
function namesLikelyMatch(a, b) {
  const ta = nameTokens(a), tb = nameTokens(b);
  if (!ta.length || !tb.length) return false;
  for (const wa of ta) { if (wa.length < 3) continue;
    for (const wb of tb) { if (wb.length < 3) continue;
      if (wa === wb) return true;
      const allowed = Math.max(wa.length, wb.length) >= 7 ? 2 : 1;
      if (levenshteinDist(wa, wb) <= allowed) return true;
    }
  }
  return false;
}

// ── odds -> winProb -> winnerBase ───────────────────────────────────────────
let ODDS = null;
try { ODDS = JSON.parse(rd("data/odds.json")); } catch { ODDS = null; }
const toProb = (a) => (a > 0 ? 100 / (a + 100) : -a / (-a + 100));
function winProb(winner, opponent) {
  if (!Array.isArray(ODDS) || !opponent) return null;
  const like = namesLikelyMatch;
  const ev = ODDS.find((e) => e && e.home_team && e.away_team &&
    ((like(e.home_team, winner) && like(e.away_team, opponent)) ||
     (like(e.home_team, opponent) && like(e.away_team, winner))));
  if (!ev || !Array.isArray(ev.bookmakers)) return null;
  const qw = [], qo = [];
  ev.bookmakers.forEach((bk) => {
    const mkt = (bk.markets || []).find((m) => m.key === "h2h");
    if (!mkt || !Array.isArray(mkt.outcomes)) return;
    const pw = (mkt.outcomes.find((o) => like(o.name, winner)) || {}).price;
    const po = (mkt.outcomes.find((o) => like(o.name, opponent)) || {}).price;
    if (pw == null || po == null) return;
    qw.push(toProb(pw)); qo.push(toProb(po));
  });
  if (!qw.length) return null;
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const mw = mean(qw), mo = mean(qo);
  return (mw + mo) > 0 ? mw / (mw + mo) : null;
}
function winnerBase(winner, opponent) {
  const q = winProb(winner, opponent);
  if (q == null || !isFinite(q) || q <= 0) return P_WIN;
  return P_WIN * Math.max(0.6, Math.min(3, Math.pow(0.5 / q, 0.7)));
}

// ── fight history -> methodBonus ────────────────────────────────────────────
// Extract the FIGHT_HISTORY object text by brace-matching (string-aware, so a
// brace inside a quoted value can't throw off the count), then pull each
// fighter's ordered (result, method) pairs.
const IDX = rd("index.html");
const FH_TEXT = (() => {
  const start = IDX.indexOf("const FIGHT_HISTORY");
  if (start < 0) return "";
  const open = IDX.indexOf("{", start);
  if (open < 0) return "";
  let depth = 0, inStr = false, esc = false;
  for (let i = open; i < IDX.length; i++) {
    const c = IDX[i];
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') { inStr = true; continue; }
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) return IDX.slice(open, i + 1); }
  }
  return "";
})();
// ── canonical name resolution (mirror index.html resolveCanonicalFighterName) ──
// The ESPN feed says "Dricus Du Plessis"; FIGHT_HISTORY keys the canonical
// "Dricus du Plessis". Resolve feed name+slug to the canonical key so method
// history is found — otherwise the app and this table would disagree.
const SLUG_LETTER_MAP = { "ł": "l", "Ł": "l", "đ": "d", "Đ": "d", "ø": "o", "Ø": "o", "æ": "ae", "Æ": "ae", "œ": "oe", "Œ": "oe", "ß": "ss", "ı": "i", "İ": "i" };
function nameToSlug(name) {
  return String(name || "").toLowerCase()
    .replace(/\s+(jr\.?|sr\.?|i{1,3}|iv|v)\s*$/i, "")
    .replace(/[łŁđĐøØæÆœŒßıİ]/g, (ch) => SLUG_LETTER_MAP[ch] || ch)
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
const parseAliases = (block) => { const o = {}; const re = /'([^']+)':\s*'([^']+)'/g; let x; while ((x = re.exec(block))) o[x[1]] = x[2]; return o; };
const SLUG_ALIASES = parseAliases((IDX.match(/const SLUG_ALIASES\s*=\s*\{[\s\S]*?\n\s*\};/) || [""])[0]);
const NAME_ALIASES = parseAliases((IDX.match(/const NAME_ALIASES\s*=\s*\{[\s\S]*?\n\s*\};/) || [""])[0]);
// Top-level FIGHT_HISTORY keys are the canonical names; map their slug -> key.
const FH_KEYS = (() => { const s = {}; const re = /"([^"]+)"\s*:\s*\[/g; let x; while ((x = re.exec(FH_TEXT))) s[nameToSlug(x[1])] = x[1]; return s; })();
function resolveCanon(apiName, apiSlug) {
  const keys = [];
  if (apiSlug) keys.push(apiSlug);
  const ns = nameToSlug(apiName); if (ns && ns !== apiSlug) keys.push(ns);
  for (const k of keys) { if (SLUG_ALIASES[k]) return SLUG_ALIASES[k]; if (FH_KEYS[k]) return FH_KEYS[k]; }
  const lower = (apiName || "").toLowerCase();
  if (NAME_ALIASES[lower]) return NAME_ALIASES[lower];
  return apiName;
}
function fighterHistory(name) {
  const key = '"' + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '"\\s*:\\s*\\[';
  const m = FH_TEXT.match(new RegExp(key + "([\\s\\S]*?)\\]"));
  if (!m) return [];
  const out = [], re = /result:\s*"([^"]*)"[^}]*?method:\s*"([^"]*)"/g;
  let x; while ((x = re.exec(m[1]))) out.push({ result: x[1], method: x[2] });
  return out;
}
function methodDist(name, want) {
  const FH = fighterHistory(name);
  let ko = 0, sub = 0, dec = 0, i = 0;
  for (const f of FH) {
    if (!f || !f.result || f.result === "–" || f.method === "Upcoming") continue;
    const w = Math.pow(RECENCY_DECAY, i); i++;
    if (f.result !== want) continue;
    const mm = (f.method || "").toLowerCase();
    if (/sub/.test(mm)) sub += w; else if (/dec/.test(mm)) dec += w; else if (/ko|tko|knockout|stoppage/.test(mm)) ko += w;
  }
  return { ko, sub, dec };
}
function smoothedDist(d) {
  const t = d.ko + d.sub + d.dec + 3;
  return { "KO/TKO": (d.ko + 1) / t, "Submission": (d.sub + 1) / t, "Decision": (d.dec + 1) / t };
}
function methodLikelihoods(winner, opponent) {
  const off = smoothedDist(methodDist(winner, "W")), def = smoothedDist(methodDist(opponent, "L"));
  const joint = {}; let sum = 0;
  METHODS.forEach((m) => { joint[m] = off[m] * def[m]; sum += joint[m]; });
  const p = {}; METHODS.forEach((m) => { p[m] = sum > 0 ? joint[m] / sum : 1 / 3; });
  return p;
}
function methodBonus(winner, method, opponent) {
  const p = methodLikelihoods(winner, opponent)[method];
  const raw = P_METHOD * 1.5 * (1 - (p == null ? 1 / 3 : p));
  return Math.max(2, Math.min(8, Math.round(raw)));
}

// ── build the current card's table ──────────────────────────────────────────
const feed = JSON.parse(rd("data/event.json"));
const events = (feed.data || []).filter((ev) => ev && (ev.bouts || []).length);
if (!events.length) { console.error("gen-pickem-card: no events"); process.exit(0); }
const now = Date.now();
const byStart = events.slice().sort((a, b) => (Date.parse(a.startsAt || 0) || 0) - (Date.parse(b.startsAt || 0) || 0));
const ev = byStart.find((e) => (Date.parse(e.startsAt || 0) || 0) >= now - 6 * 3600 * 1000) || byStart[0];

const bouts = (ev.bouts || [])
  .filter((b) => b && !b.isCancelled && (b.fighters || []).length === 2)
  .sort((a, b) => (a.boutOrder || 0) - (b.boutOrder || 0))
  .map((b, i) => {
    const f1 = b.fighters[0].fighterName, f2 = b.fighters[1].fighterName;
    // Canonical names drive the math (odds + history); the table keys by f1/f2 slot
    // so the client never has to name-match. Feed names stay as the display labels.
    const c1 = resolveCanon(f1, b.fighters[0].fighterSlug), c2 = resolveCanon(f2, b.fighters[1].fighterSlug);
    const mb = (w, o) => { const r = {}; METHODS.forEach((m) => (r[m] = methodBonus(w, m, o))); return r; };
    const rounds = b.numberOfRounds || 3, rPts = {};
    for (let r = 1; r <= rounds; r++) rPts[r] = roundBonus(r);
    return {
      id: b.id || (ev.slug + "-" + i), f1, f2,
      wPts: { f1: winnerBase(c1, c2), f2: winnerBase(c2, c1) },
      mPts: { f1: mb(c1, c2), f2: mb(c2, c1) },
      rPts,
    };
  });

// Fighter thumbnail slugs on this card, so the Worker can serve just these photos
// publicly (free accounts otherwise can't fetch the gated /photos/*).
const slugs = [];
(ev.bouts || []).forEach((b) => (b.fighters || []).forEach((f) => { if (f.fighterSlug) slugs.push(f.fighterSlug); }));
const out = { slug: ev.slug, generatedAt: new Date().toISOString(), slugs: Array.from(new Set(slugs)), bouts };
fs.writeFileSync(path.join(ROOT, "data/pickem-card.json"), JSON.stringify(out, null, 2) + "\n");
console.log(`pickem-card.json: ${ev.slug} · ${bouts.length} bouts · FIGHT_HISTORY ${FH_TEXT ? "loaded" : "MISSING"}`);
bouts.slice(0, 3).forEach((b) =>
  console.log(`  ${b.f1} wPts=${b.wPts.f1.toFixed(2)} m=${JSON.stringify(b.mPts.f1)} | ${b.f2} wPts=${b.wPts.f2.toFixed(2)}`));
