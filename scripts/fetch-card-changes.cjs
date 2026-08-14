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

// Wikipedia sometimes narrates a fighter by their legal name instead of the ring
// name our roster (data/event.json) and index.html both use -- e.g. Eduardo
// "Chapolin" appears in UFC 330's Background prose as "Eduardo Henrique" (his
// legal name), so a plain textual search for "Eduardo Chapolin" never finds him
// and his whole paragraph gets missed. Mirrors the handful of cases index.html's
// own NAME_ALIASES carries for exactly this reason; duplicated here rather than
// shared because this script runs standalone in Node and doesn't load that
// runtime object. Keyed by the Wikipedia-prose spelling -> the roster's
// canonical name (case-sensitive: the replacement-role regexes below are
// case-sensitive on purpose, so the alias has to be spelled the way Wikipedia
// actually capitalizes it).
const WIKI_NAME_ALIASES = {
  'Eduardo Henrique': 'Eduardo Chapolin',
};
// All name-forms worth searching a paragraph for, for one roster fighter: their
// own name, plus any Wikipedia alias known to refer to them. Fighters with no
// alias just get back [F] -- identical behavior to a plain nameRe(F) test.
function nameFormsFor(F) {
  const forms = [F];
  for (const wikiName of Object.keys(WIKI_NAME_ALIASES)) {
    if (WIKI_NAME_ALIASES[wikiName] === F) forms.push(wikiName);
  }
  return forms;
}

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
  // "...(was) replaced by/with <descriptors> <F>"  |  "...as the replacement, <F>"
  // The descriptor run between "replaced by" and the name is open-ended prose:
  // "promotional newcomer", "undefeated promotional newcomer", "a short-notice
  // replacement", "promotional newcomer and fellow former LFA flyweight champion".
  // Enumerating the variants was a losing game — the single word "undefeated" was
  // enough to drop Muhammad Said out of shortNotice, which sent the paragraph down
  // the withdrawal branch and flagged BOTH him and Jacoby as "may change" on a
  // bout that was already settled. Accept any short run of LOWERCASE words
  // instead, PLUS short ALL-CAPS acronyms (LFA, UFC, PFL, ...) as their own
  // exception — an org acronym reads nothing like a person's name and titlecase
  // fighter names never take that shape, so it's an unambiguous carve-out, not a
  // loosening of the guard below.
  //
  // Case is the load-bearing part, so this test deliberately has no /i: a
  // capitalised (Title Case) word is another person's NAME and must not be
  // bridged across ("replaced by Anna Melisano, who now faces <F>" must stay
  // false — "Anna" is mixed-case, not all-caps, so the acronym exception doesn't
  // apply to it). Punctuation still breaks the run for the same reason, and the
  // word cap (raised from 4 to 10 for the LFA case above — 8 words) stops it
  // reaching across a clause into an unrelated fighter.
  const rb = /\breplaced (?:by|with)\s+([^.]*)$/i.exec(before);
  if (rb && /^(?:(?:[a-z][a-z0-9'’-]*|[A-Z]{2,6})\s+){0,10}$/.test(rb[1])) return true;
  if (/(?:short.?notice|late)\s+replacement[^.]{0,20}$/i.test(before)) return true;
  // "<F> stepped in / steps in ..."  |  "<F> replaced ..."  |  "<F> was booked/tabbed/added as ... replacement"
  if (/^\s*(?:,?\s*(?:who|and)\s+)?(?:(?:has|had|since)\s+)*stepp(?:ed|ing|s)?\s+in\b/i.test(after)) return true;
  if (/^\s+replaced\b/i.test(after)) return true;   // active "F replaced X" (passive "F was replaced" is handled by the before-check)
  if (/^[^.]{0,50}?(?:was|were)\s+(?:booked|tabbed|added|brought in|called (?:in|up))\b[^.]{0,30}?\breplacement\b/i.test(after)) return true;
  if (/^[^.]{0,50}?\bas (?:a|the) (?:short.?notice )?replacement\b/i.test(after)) return true;
  if (/^[^.]{0,50}?\bon (?:short notice|(?:less than )?\w+[\s-]days?'?\s+notice)\b/i.test(after)) return true;
  return false;
}

// Withdrawal language (a fighter leaving a bout).
const WITHDRAW = /\bwithd?rew\b|\bwithdrawn\b|\bwithdraw\b|pull(?:ed|s)?\s+out\b|forced out\b|out of the (?:fight|card|bout|event)\b|off the card\b|had to withdraw\b|removed from the card\b/i;
// Is F named as the one who LEFT this paragraph's bout? (so we don't flag the
// departed fighter as "may change" — we flag the one who stayed). Withdrawals
// usually reference the fighter by LAST NAME after the first mention ("Hardy
// pulled out"), so match the last name too, not just the full name.
function isWithdrawalSubject(name, para) {
  const full = escapeRe(name).replace(/\s+/g, '\\s+');
  const last = escapeRe(name.split(/\s+/).pop() || '');
  const who = (last && last.toLowerCase() !== full.toLowerCase()) ? '(?:' + full + '|' + last + ')' : full;
  return new RegExp('\\b' + who + '\\b[^.]{0,25}?(?:' + WITHDRAW.source + ')', 'i').test(para);
}
const nameRe = (name, flags) => new RegExp('\\b' + escapeRe(name).replace(/\s+/g, '\\s+') + '\\b', flags);

/**
 * @param {string} wikitext  Wikipedia article wikitext.
 * @param {string[]} currentNames  Exact fighter names on the live card.
 * @returns {{shortNotice:Array<{replacement,sentence}>, mayChange:Array<{fighter,sentence}>}}
 */
function extractCardChanges(wikitext, currentNames) {
  const text = stripWiki(backgroundSection(wikitext));
  const paras = text.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const shortNotice = new Map();
  const mayChange = new Map();
  for (const para of paras) {
    // present: one entry per currentNames fighter actually mentioned in this
    // paragraph, carrying BOTH the roster's canonical spelling (for keying and
    // output) and whichever textual form (own name, or a WIKI_NAME_ALIASES
    // legal-name form) is the one that actually appears in the prose -- that
    // second form is what every regex below has to search FOR, since the
    // canonical spelling itself may never occur in the text at all (Chapolin
    // case: only "Eduardo Henrique" appears).
    const present = [];
    for (const F of currentNames) {
      const searchName = nameFormsFor(F).find((form) => nameRe(form).test(para));
      if (searchName) present.push({ canonical: F, searchName });
    }
    if (!present.length) continue;

    // 1) A replacement named in this bout-paragraph — flag the fighter who stepped in.
    let hadReplacement = false;
    for (const { canonical: F, searchName } of present) {
      const key = normLoose(F);
      const re = nameRe(searchName, 'gi');
      let m;
      while ((m = re.exec(para))) {
        const [s, e] = sentenceBounds(para, m.index, re.lastIndex);
        const sentence = para.slice(s, e);
        if (isReplacementRole(sentence, m.index - s, re.lastIndex - s)) {
          if (!shortNotice.has(key)) shortNotice.set(key, { replacement: F, sentence: sentence.trim() });
          hadReplacement = true;
          break;
        }
      }
    }
    if (hadReplacement) continue;

    // 2) A withdrawal with NO replacement yet — flag the fighter who STAYED
    // (the one still on the card whose opponent left). Skip the fighter who left,
    // and skip a bout merely moved to another card (no withdrawal language).
    if (WITHDRAW.test(para)) {
      for (const { canonical: F, searchName } of present) {
        const key = normLoose(F);
        if (shortNotice.has(key) || mayChange.has(key)) continue;
        if (isWithdrawalSubject(searchName, para)) continue;   // this fighter is the one who left
        mayChange.set(key, { fighter: F, sentence: para.trim() });
      }
    }
  }
  return { shortNotice: [...shortNotice.values()], mayChange: [...mayChange.values()] };
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
    let title = null, cc = { shortNotice: [], mayChange: [] };
    try {
      title = await resolvePageTitle(query);
      if (!titleMatchesEvent(title, evt)) title = null;   // reject a nearby-but-wrong page
      if (title) {
        await sleep(400);
        const wt = await fetchWikitext(title);
        cc = extractCardChanges(wt, names);
        if (DUMP) dump += '\n===== ' + evt.slug + '  <-  ' + title + ' =====\n' + backgroundSection(wt).replace(/\n{3,}/g, '\n\n').trim() + '\n';
      }
    } catch (e) {
      console.warn(`[card-changes] ${evt.slug}: ${e.message}`);
    }
    const sn = cc.shortNotice.map((c) => c.replacement);
    const mc = cc.mayChange.map((c) => c.fighter);
    result.events.push({ slug: evt.slug, wikiTitle: title, shortNotice: sn, mayChange: mc });
    console.log(`[card-changes] ${evt.slug} <- ${title || '(no page)'} : short-notice [${sn.join(', ') || '-'}]  may-change [${mc.join(', ') || '-'}]`);
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
