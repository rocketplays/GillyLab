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

// Flatten wikitext to readable prose: drop <ref>…</ref> citations and {{…}}
// templates, and unwrap [[target|display]] links to their display text. Crucial
// because promotional newcomers (the most common short-notice replacements)
// have no article, so they appear as PLAIN TEXT, not [[links]].
function stripWiki(text) {
  return String(text || '')
    .replace(/<ref[^>]*\/>/gi, ' ')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, ' ')
    .replace(/\{\{[^{}]*\}\}/g, ' ')
    .replace(/\[\[([^\]|#]+?)(?:\|([^\]]+))?\]\]/g, (m, t, d) => d || t)
    .replace(/'''?/g, '')
    .replace(/&nbsp;/g, ' ');
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
  if (/^\s*(?:,?\s*(?:who|and)\s+)?(?:(?:has|had|since)\s+)*stepp(?:ed|ing|s)?\s+in\b/i.test(after)) return true;
  if (/^\s+replaced\b/i.test(after)) return true;   // active "F replaced X" (passive "F was replaced" is handled by the before-check)
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
  const text = stripWiki(backgroundSection(wikitext));
  const found = new Map(); // normLoose -> {replacement, sentence}
  for (const F of currentNames) {
    const key = normLoose(F);
    if (found.has(key)) continue;
    // Match this fighter's FULL name wherever it appears — linked names were
    // unwrapped to plain text above, and newcomers are plain text to begin with.
    const re = new RegExp('\\b' + escapeRe(F).replace(/\s+/g, '\\s+') + '\\b', 'gi');
    let m;
    while ((m = re.exec(text))) {
      const [s, e] = sentenceBounds(text, m.index, re.lastIndex);
      const sentence = text.slice(s, e);
      if (isReplacementRole(sentence, m.index - s, re.lastIndex - s)) {
        found.set(key, { replacement: F, sentence: sentence.replace(/\s+/g, ' ').trim() });
        break;
      }
    }
  }
  return [...found.values()];
}

// ── network (CI only) ────────────────────────────────────────────────────────
const API = 'https://en.wikipedia.org/w/api.php';
// Wikimedia asks for a descriptive User-Agent with contact/URL; a generic one
// gets throttled aggressively.
const UA = 'GillyLab-card-changes/1.0 (https://github.com/rocketplays/GillyLab)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function httpGet(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('too many redirects'));
    https.get(url, { headers: { 'User-Agent': UA, 'Accept': 'application/json' } }, (r) => {
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
// GET the API with retries: a rate-limited response is plain text ("You are
// making too many requests…"), not JSON — back off and retry rather than crash.
async function apiJson(params) {
  const url = API + '?' + new URLSearchParams(Object.assign({ format: 'json', formatversion: '2', maxlag: '5' }, params)).toString();
  let last = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    const { status, body } = await httpGet(url);
    try { return JSON.parse(body); } catch (e) { last = 'status ' + status + ': ' + String(body).replace(/\s+/g, ' ').slice(0, 70); }
    await sleep(1500 * (attempt + 1));   // throttled — back off
  }
  throw new Error('wiki API not JSON (' + last + ')');
}
async function resolvePageTitle(query) {
  const j = await apiJson({ action: 'query', list: 'search', srsearch: query, srlimit: '1', srnamespace: '0' });
  const hit = j && j.query && j.query.search && j.query.search[0];
  return hit ? hit.title : null;
}
async function fetchWikitext(title) {
  const j = await apiJson({ action: 'parse', page: title, prop: 'wikitext', redirects: '1' });
  return (j && j.parse && j.parse.wikitext) || '';
}
// Guard against the search returning a nearby-but-wrong event (e.g. an event
// with no page yet resolving to a different card). Numbered events must match
// "UFC <n>"; Fight Nights must share a main-event surname from the ESPN name.
function titleMatchesEvent(title, evt) {
  if (!title) return false;
  const t = title.toLowerCase();
  const nm = /\bUFC\s+(\d{2,4})\b/i.exec(evt.espnName || evt.title || '');
  if (nm) return new RegExp('\\bufc\\s+' + nm[1] + '\\b').test(t) && !/fight night/.test(t);
  const me = /:\s*(.+?)\s+vs\.?\s+(.+)$/i.exec(evt.espnName || '');
  if (me) {
    const surs = [me[1], me[2]].map((x) => x.trim().split(/\s+/).pop().toLowerCase().replace(/[^a-z]/g, ''));
    return surs.some((s) => s && t.includes(s));
  }
  return true;
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
  const DUMP = process.argv.includes('--dump');
  const eventDoc = JSON.parse(fs.readFileSync(EVENT_PATH, 'utf8'));
  const events = upcomingEvents(eventDoc);
  const result = { generatedAt: new Date().toISOString(), events: [] };
  let dump = '';
  for (const evt of events) {
    await sleep(700);   // be polite — serialized with delays to avoid throttling
    const query = evt.espnName || evt.title || evt.slug;
    const names = cardFighterNames(evt);
    let title = null, changes = [];
    try {
      title = await resolvePageTitle(query);
      if (!titleMatchesEvent(title, evt)) title = null;   // reject a nearby-but-wrong page
      if (title) {
        await sleep(400);
        const wt = await fetchWikitext(title);
        changes = extractCardChanges(wt, names);
        if (DUMP) dump += '\n===== ' + evt.slug + '  <-  ' + title + ' =====\n' + backgroundSection(wt).replace(/\n{3,}/g, '\n\n').trim() + '\n';
      }
    } catch (e) {
      console.warn(`[card-changes] ${evt.slug}: ${e.message}`);
    }
    result.events.push({ slug: evt.slug, wikiTitle: title, shortNotice: changes });
    console.log(`[card-changes] ${evt.slug} <- ${title || '(no page)'} : ${changes.map((c) => c.replacement).join(', ') || 'none'}`);
  }
  fs.writeFileSync(OUT_PATH, JSON.stringify(result, null, 2));
  console.log('[card-changes] wrote ' + path.relative(ROOT, OUT_PATH));
  if (DUMP) {
    const dp = path.join(ROOT, 'data', 'card-changes-debug.txt');
    fs.writeFileSync(dp, dump.trim() + '\n');
    console.log('[card-changes] wrote ' + path.relative(ROOT, dp) + ' (raw Background text for tuning)');
  }
}

module.exports = { extractCardChanges, backgroundSection, norm, normLoose };
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
