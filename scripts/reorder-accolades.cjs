#!/usr/bin/env node
/* Re-order every fighter's ACCOLADES array in index.html to a consistent scheme:
 *   1. BJJ belt rank (Brazilian jiu-jitsu + a colored belt)
 *   2. Other belt rankings / dan grades / "Master of Sport"
 *   3. Everything else (championships, awards, records, descriptors),
 *      most-recent → oldest by the latest year in the text; undated entries last.
 * Order WITHIN categories 1 and 2 is preserved from the source.
 *
 * Safe by construction: it eval()s the existing literal, reorders each array in
 * place, re-serializes in the SAME style, and asserts that every fighter's set of
 * entries is unchanged (same multiset, only reordered) before writing. Dry-run by
 * default — pass WRITE=1 to actually modify index.html.
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'index.html');
let idx = fs.readFileSync(FILE, 'utf8');

const marker = 'const ACCOLADES = {';
const s = idx.indexOf(marker);
if (s < 0) throw new Error('ACCOLADES not found');
const braceStart = idx.indexOf('{', s);
let i = braceStart, depth = 0, inStr = false, q = '', esc = false, end = -1;
for (; i < idx.length; i++) {
  const c = idx[i];
  if (inStr) { if (esc) { esc = false; continue; } if (c === '\\') { esc = true; continue; } if (c === q) inStr = false; continue; }
  if (c === '"' || c === "'" || c === '`') { inStr = true; q = c; continue; }
  if (c === '{') depth++;
  else if (c === '}') { depth--; if (depth === 0) { end = i; break; } }
}
if (end < 0) throw new Error('ACCOLADES close not found');
const literal = idx.slice(braceStart, end + 1);
let A; eval('A=' + literal);

// ---- classification ----
const beltRe = /(black|brown|purple|blue|white|red|coral)[\s-]*belt/i;      // colored belt = a rank
const bjjRe = /(brazilian jiu-?jitsu|jiu-?jitsu|\bbjj\b|ibjjf|gracie)/i;
const danRe = /\b\d+(?:st|nd|rd|th)?[\s-]*dan\b/i;                           // e.g. "3rd dan"
const masterRe = /master of sport/i;
function category(t) {
  t = t || '';
  if (bjjRe.test(t) && beltRe.test(t)) return 1;   // BJJ belt rank
  if (masterRe.test(t)) return 2;                  // master of sport
  if (beltRe.test(t) || danRe.test(t)) return 2;   // other belt / dan grade
  return 3;                                        // championships / awards / everything else
}
function recency(t) {
  t = t || '';
  if (/present|current|reigning|ongoing/i.test(t)) return 9999;   // active reign = most recent
  const ys = (t.match(/(?:19|20)\d\d/g) || []).map(Number);
  return ys.length ? Math.max(...ys) : -1;                        // undated -> last
}
function reorder(arr) {
  return arr.map((e, ix) => ({ e, ix, c: category(e.title), r: recency(e.title) }))
    .sort((a, b) => {
      if (a.c !== b.c) return a.c - b.c;
      if (a.c === 3) { if (a.r !== b.r) return b.r - a.r; return a.ix - b.ix; }
      return a.ix - b.ix;   // categories 1 & 2 keep source order
    })
    .map(x => x.e);
}

const out = {};
for (const name of Object.keys(A)) out[name] = reorder(A[name]);

// ---- integrity check: no fighter loses/gains/mutates an entry ----
const keyOf = (e) => JSON.stringify([e.icon, e.title, e.detail === undefined ? null : e.detail]);
let problems = 0;
for (const name of Object.keys(A)) {
  const before = A[name].map(keyOf).sort();
  const after = out[name].map(keyOf).sort();
  if (JSON.stringify(before) !== JSON.stringify(after)) { console.error('MISMATCH for', name); problems++; }
  // also ensure only icon/title/detail fields exist
  for (const e of A[name]) { const ks = Object.keys(e).sort().join(','); if (ks !== 'detail,icon,title' && ks !== 'icon,title') { console.error('UNEXPECTED FIELDS in', name, ks); problems++; } }
}
if (Object.keys(A).length !== Object.keys(out).length) { console.error('fighter count changed'); problems++; }

// ---- re-serialize in the original style ----
const escStr = (v) => String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
const val = (v) => (v == null ? 'null' : '"' + escStr(v) + '"');
const entry = (e) => '{ icon: ' + val(e.icon) + ', title: ' + val(e.title) + ', detail: ' + val(e.detail === undefined ? null : e.detail) + ' }';
const body = Object.keys(out).map(name => {
  const rows = out[name].map(e => '    ' + entry(e)).join(',\n');
  return '  ' + JSON.stringify(name) + ': [\n' + rows + '\n  ]';
}).join(',\n');
const newLiteral = '{\n' + body + '\n}';

// sanity: the new literal must eval to the same reordered object
let CHECK; eval('CHECK=' + newLiteral);
if (Object.keys(CHECK).length !== Object.keys(out).length) { console.error('re-serialize eval mismatch'); problems++; }

const changed = Object.keys(A).filter(n => A[n].map(keyOf).join('|') !== out[n].map(keyOf).join('|')).length;
console.log('fighters:', Object.keys(A).length, '| entries:', Object.values(A).reduce((s, a) => s + a.length, 0),
  '| reordered fighters:', changed, '| integrity problems:', problems);

// sample previews
const samples = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(A).filter(n => A[n].length >= 3).slice(0, 4);
samples.forEach(n => {
  if (!A[n]) return;
  console.log('\n--- ' + n + ' ---');
  out[n].forEach(e => console.log('  [' + category(e.title) + '] ' + e.icon + ' ' + e.title.slice(0, 90)));
});

if (problems) { console.error('\nABORT: integrity problems found, not writing.'); process.exit(1); }
if (process.env.WRITE) {
  idx = idx.slice(0, braceStart) + newLiteral + idx.slice(end + 1);
  fs.writeFileSync(FILE, idx);
  console.log('\nWROTE index.html');
} else {
  console.log('\n(dry run — set WRITE=1 to apply)');
}
