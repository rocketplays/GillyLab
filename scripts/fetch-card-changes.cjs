#!/usr/bin/env node
'use strict';
/**
 * Derive short-notice replacements for each upcoming card from its Wikipedia
 * "Background" section, and write data/card-changes.json.
 *
 * Why Wikipedia: UFC event pages document every withdrawal + replacement in
 * cited prose ("...Hardy withdrew and was replaced by [[Anna Melisano]]"), which
 * is far more reliable than the news-headline inference (Google News gives only
 * titles, which usually don't name the replacement). One fetch per event covers
 * the whole card.
 *
 * Robustness: every candidate replacement extracted from Wikipedia is
 * cross-checked against the fighters actually on the current card (data/
 * event.json). We only emit a replacement whose name matches a live bout
 * fighter — so stale text, mis-parses, and unrelated names are dropped, and we
 * get the exact roster spelling for free.
 *
 * The parser (extractCardChanges) is pure and unit-tested in
 * scripts/test-card-changes.cjs. Only main() touches the network, so it runs in
 * the update-odds GitHub Action (full network) even though the sandbox can't.
 *
 * Usage: node scripts/fetch-card-changes.cjs
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const EVENT_PATH = path.join(ROOT, 'data', 'event.json');
const OUT_PATH = path.join(ROOT, 'data', 'card-changes.json');

// ── name matching ────────────────────────────────────────────────────────────
function norm(s) {
  return String(s || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
// Loose form drops generational suffixes so "Allen Frye Jr." matches "Allen Frye".
function normLoose(s) {
  return norm(s).replace(/\b(?:jr|sr|ii|iii|iv)\b/g, '').replace(/\s+/g, ' ').trim();
}
function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// ── pure parser ──────────────────────────────────────────────────────────────
// Pull the "Background" section (up to the next heading); fall back to the whole
// page if the heading isn't found.
function backgroundSection(wikitext) {
  const m = /(^|\n)\s*==+\s*Background\s*==+\s*\n/i.exec(wikitext || '');
  if (!m) return wikitext || '';
  const start = m.index + m[0].length;
  const rest = wikitext.slice(start);
  const next = /\n\s*==+[^=]/.exec(rest);
  return next ? rest.slice(0, next.index) : rest;
}

// Every [[wiki link]] occurrence with its char span, link target and display text.
function linkOccurrences(text) {
  const re = /\[\[([^\]|#]+?)(?:\|([^\]]+))?\]\]/g;
  const out = [];
  let m;
  while ((m = re.exec(text))) {
    out.push({ idx: m.index, end: re.lastIndex, target: m[1].trim(), disp: (m[2] || m[1]).trim() });
  }
  return out;
}

// Bounds of the sentence containing [a, b).
function sentenceBounds(text, a, b) {
  let s = a;
  while (s > 0 && !/[.!?\n]/.test(text[s - 1])) s--;
  let e = b;
  while (e < text.length && !/[.!?\n]/.test(text[e])) e++;
  return [s, e];
}

// Replacement-role phrasing, checked relative to a fighter's link within its
// own sentence. Returns true if this fighter is the one who STEPPED IN.
function isReplacementRole(sentence, linkStartInSentence, linkEndInSentence) {
  const before = sentence.slice(0, linkStartInSentence);
  const after = sentence.slice(linkEndInSentence);
  // "...(was) replaced by/with [newcomer] <F>"  |  "...as the replacement, <F>"
  if (/\breplaced (?:by|with)\s+(?:(?:the |a )?(?:promotional )?newcomer\s+|(?:a |the )?short.?notice replacement\s+)?$/i.test(before)) return true;
  if (/(?:short.?notice|late)\s+replacement[^.]{0,20}$/i.test(before)) return true;
  // "<F> stepped in / steps in ..."  |  "<F> replaced ..."  |  "<F> was booked/tabbed/added as ... replacement"
  if (/^\s*(?:,?\s*(?:who|and)\s+)?(?:[a-z][\w.'-]*\s+){0,3}?stepp(?:ed|ing)?\s+in\b/i.test(after)) return true;
  if (/^\s*(?:[a-z][\w.'-]*\s+){0,2}?replaced\b/i.test(after)) return true;
  if (/^[^.]{0,50}?(?:was|were)\s+(?:booked|tabbed|added|brought in|called (?:in|up))\b[^.]{0,30}?\breplacement\b/i.test(after)) return true;
  if (/^[^.]{0,50}?\bas (?:a|the) (?:short.?notice )?replacement\b/i.test(after)) return true;
  if (/^[^.]{0,50}?\bon (?:short notice|(?:less than )?\w+[\s-]days?'?\s+notice)\b/i.test(after)) return true;
  return false;
}

/**
 * @param {string} wikitext  Wikipedia article wikitext.
 * @param {string[]} currentNames  Exact fighter names on the live card.
 * @returns {Array<{replacement:string, sentence:string}>}
 */
function extractCardChanges(wikitext, currentNames) {
  const text = backgroundSection(wikitext);
  const byNorm = new Map();
  currentNames.forEach((n) => { byNorm.set(normLoose(n), n); });
  const occ = linkOccurrences(text);
  const found = new Map(); // normLoose -> {replacement, sentence}
  for (const o of occ) {
    const key = byNorm.has(normLoose(o.target)) ? normLoose(o.target)
              : (byNorm.has(normLoose(o.disp)) ? normLoose(o.disp) : null);
    if (!key) continue;                       // not a fighter on this card
    if (found.has(key)) continue;
    const [s, e] = sentenceBounds(text, o.idx, o.end);
    const sentence = text.slice(s, e);
    if (isReplacementRole(sentence, o.idx - s, o.end - s)) {
      found.set(key, { replacement: byNorm.get(key), sentence: sentence.replace(/\s+/g, ' ').trim() });
    }
  }
  return [...found.values()];
}

// ── network (CI only) ────────────────────────────────────────────────────────
function httpGet(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('too many redirects'));
    https.get(url, { headers: { 'User-Agent': 'GillyLab/1.0 (rocketplays/GillyLab card-changes)' } }, (r) => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
        r.resume();
        return resolve(httpGet(r.headers.location, redirects + 1));
      }
      let d = '';
      r.on('data', (c) => (d += c));
      r.on('end', () => resolve({ status: r.statusCode, body: d }));
    }).on('error', reject);
  });
}
const API = 'https://en.wikipedia.org/w/api.php';
async function resolvePageTitle(query) {
  const u = API + '?action=query&list=search&srsearch=' + encodeURIComponent(query) +
    '&srlimit=1&srnamespace=0&format=json&formatversion=2';
  const { body } = await httpGet(u);
  const j = JSON.parse(body);
  const hit = j && j.query && j.query.search && j.query.search[0];
  return hit ? hit.title : null;
}
async function fetchWikitext(title) {
  const u = API + '?action=parse&page=' + encodeURIComponent(title) +
    '&prop=wikitext&redirects=1&format=json&formatversion=2';
  const { body } = await httpGet(u);
  const j = JSON.parse(body);
  return (j && j.parse && j.parse.wikitext) || '';
}

function upcomingEvents(eventDoc) {
  const now = Date.now();
  return (eventDoc.data || []).filter((e) => {
    if (e.status === 'completed') return false;
    const t = Date.parse(e.startsAt || e.eventDate || '');
    return !isFinite(t) || t > now - 864e5;
  });
}
function cardFighterNames(evt) {
  const out = [];
  (evt.bouts || []).forEach((b) => (b.fighters || []).forEach((f) => { if (f && f.fighterName) out.push(f.fighterName); }));
  return out;
}

async function main() {
  const eventDoc = JSON.parse(fs.readFileSync(EVENT_PATH, 'utf8'));
  const events = upcomingEvents(eventDoc);
  const result = { generatedAt: new Date().toISOString(), events: [] };
  for (const evt of events) {
    const query = evt.espnName || evt.title || evt.slug;
    const names = cardFighterNames(evt);
    let title = null, changes = [];
    try {
      title = await resolvePageTitle(query);
      if (title) {
        const wt = await fetchWikitext(title);
        changes = extractCardChanges(wt, names);
      }
    } catch (e) {
      console.warn(`[card-changes] ${evt.slug}: ${e.message}`);
    }
    result.events.push({ slug: evt.slug, wikiTitle: title, shortNotice: changes });
    console.log(`[card-changes] ${evt.slug} <- ${title || '(no page)'} : ${changes.map((c) => c.replacement).join(', ') || 'none'}`);
  }
  fs.writeFileSync(OUT_PATH, JSON.stringify(result, null, 2));
  console.log('[card-changes] wrote ' + path.relative(ROOT, OUT_PATH));
}

module.exports = { extractCardChanges, backgroundSection, norm, normLoose };
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
