#!/usr/bin/env node
/* Merge scraped Wikipedia accolades (accolades_wikipedia.json, produced by
 * gillylab_wikipedia_accolades.py) into the ACCOLADES object in index.html.
 *
 * Scope, strictly: this ONLY edits the ACCOLADES literal. It never touches
 * FIGHTERS, FIGHTER_STATS, or FIGHT_HISTORY — bio, stats and fight records are
 * left exactly as they are. It only ADDS fighters who currently have NO
 * accolades entry (curated entries are never overwritten), and orders each new
 * fighter's list with the house scheme (BJJ belt → other belts/masters →
 * championships & awards, newest→oldest). Existing entries re-serialize byte-for
 * -byte identically and are integrity-checked.
 *
 * Dry-run by default; pass WRITE=1 to modify index.html.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, 'index.html');
const JSON_IN = path.join(ROOT, 'accolades_wikipedia.json');

if (!fs.existsSync(JSON_IN)) { console.error('Missing', JSON_IN, '— run gillylab_wikipedia_accolades.py first.'); process.exit(1); }
const scraped = JSON.parse(fs.readFileSync(JSON_IN, 'utf8'));

let idx = fs.readFileSync(FILE, 'utf8');
const marker = 'const ACCOLADES = {';
const s = idx.indexOf(marker);
if (s < 0) throw new Error('ACCOLADES not found');
const braceStart = idx.indexOf('{', s);
let i = braceStart, depth = 0, inStr = false, q = '', esc = false, end = -1;
for (; i < idx.length; i++) {
  const c = idx[i];
  if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === q) inStr = false; }
  else if (c === '"' || c === "'" || c === '`') { inStr = true; q = c; }
  else if (c === '{') depth++;
  else if (c === '}') { depth--; if (depth === 0) { end = i; break; } }
}
let A; eval('A=' + idx.slice(braceStart, end + 1));

// ── ordering (same scheme as scripts/reorder-accolades.cjs) ──
const beltRe = /(black|brown|purple|blue|white|red|coral)[\s-]*belt/i;
const bjjRe = /(brazilian jiu-?jitsu|jiu-?jitsu|\bbjj\b|ibjjf|gracie)/i;
const danRe = /\b\d+(?:st|nd|rd|th)?[\s-]*dan\b/i;
const masterRe = /master of sport/i;
const category = (t) => { t = t || ''; if (bjjRe.test(t) && beltRe.test(t)) return 1; if (masterRe.test(t)) return 2; if (beltRe.test(t) || danRe.test(t)) return 2; return 3; };
const recency = (t) => { t = t || ''; if (/present|current|reigning|ongoing/i.test(t)) return 9999; const ys = (t.match(/(?:19|20)\d\d/g) || []).map(Number); return ys.length ? Math.max(...ys) : -1; };
const order = (arr) => arr.map((e, ix) => ({ e, ix, c: category(e.title), r: recency(e.title) }))
  .sort((a, b) => a.c !== b.c ? a.c - b.c : (a.c === 3 ? (a.r !== b.r ? b.r - a.r : a.ix - b.ix) : a.ix - b.ix))
  .map(x => x.e);

// ── merge: only ADD fighters that have no accolades yet ──
const before = Object.keys(A).length;
let added = 0, skippedHave = 0, skippedNotRoster = 0;
// roster names, so we don't add accolades for someone not in the DB
const roster = new Set([...idx.matchAll(/\{ name: "((?:[^"\\]|\\.)*)", division:/g)].map(m => m[1]));
for (const name of Object.keys(scraped)) {
  if (A[name]) { skippedHave++; continue; }
  if (!roster.has(name)) { skippedNotRoster++; continue; }
  const list = (scraped[name] || []).filter(e => e && e.title);
  if (!list.length) continue;
  A[name] = order(list.map(e => ({ icon: e.icon, title: e.title, detail: e.detail === undefined ? null : e.detail })));
  added++;
}

// ── re-serialize (identical style to reorder-accolades.cjs) ──
const escStr = (v) => String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
const val = (v) => (v == null ? 'null' : '"' + escStr(v) + '"');
const entry = (e) => '{ icon: ' + val(e.icon) + ', title: ' + val(e.title) + ', detail: ' + val(e.detail === undefined ? null : e.detail) + ' }';
const body = Object.keys(A).map(name => '  ' + JSON.stringify(name) + ': [\n' + A[name].map(e => '    ' + entry(e)).join(',\n') + '\n  ]').join(',\n');
const newLiteral = '{\n' + body + '\n}';

// ── integrity: only new keys added; original fighters' entries unchanged ──
let CHK; eval('CHK=' + newLiteral);
const keyOf = (e) => JSON.stringify([e.icon, e.title, e.detail == null ? null : e.detail]);
let problems = 0;
const origAcc = (() => { let O; eval('O=' + idx.slice(braceStart, end + 1)); return O; })();
for (const name of Object.keys(origAcc)) {
  const b = origAcc[name].map(keyOf).sort(), a = (CHK[name] || []).map(keyOf).sort();
  if (JSON.stringify(b) !== JSON.stringify(a)) { console.error('MUTATED existing fighter:', name); problems++; }
}
if (Object.keys(CHK).length !== before + added) { console.error('key-count mismatch'); problems++; }

console.log('ACCOLADES: %d fighters before, +%d added from Wikipedia, %d skipped (already had), %d skipped (not on roster). integrity problems: %d',
  before, added, skippedHave, skippedNotRoster, problems);

if (problems) { console.error('ABORT: integrity problems, not writing.'); process.exit(1); }
if (process.env.WRITE) {
  fs.writeFileSync(FILE, idx.slice(0, braceStart) + newLiteral + idx.slice(end + 1));
  console.log('WROTE index.html (' + (before + added) + ' fighters now have accolades).');
} else {
  console.log('(dry run — set WRITE=1 to apply. Existing bio/stats/fight-records are untouched.)');
}
