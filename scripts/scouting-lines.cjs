#!/usr/bin/env node
/**
 * scouting-lines.cjs — generate every "Path to victory" line the app would show,
 * for both fighters in every bout across data/event.json + data/event-recent.json.
 *
 * Run it for a repetition report:
 *     node scripts/scouting-lines.cjs
 *
 * Require it to get the lines (scripts/test-scouting-lines.cjs does):
 *     const { buildLines } = require('./scouting-lines.cjs');
 *
 * WHY IT EXTRACTS SOURCE TEXT INSTEAD OF IMPORTING
 * path() lives inside a closure in index.html's 13MB inline <script>, alongside the
 * DOM rendering it feeds. There is no module boundary to import and no way to run it
 * without a browser. So we lift path() and the handful of helpers it closes over out
 * by source text and run them in a vm. The alternative — reimplementing the rules
 * here — would test the copy rather than the code, which is worse than no test.
 *
 * The cost of that choice: this file knows the SIGNATURES of the functions it lifts.
 * Change `const edge = (self, other, prefer)` and extraction breaks. That has already
 * happened once, so every marker lookup throws by name rather than silently slicing
 * garbage — a loud failure here means "the signature moved", not "the code is broken".
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const PATH_FN = 'const path = (self, other, otherN, female) =>';

function buildLines() {
  const h = fs.readFileSync(INDEX, 'utf8');
  const anchor = h.indexOf(PATH_FN);
  if (anchor < 0) throw new Error('path() not found in index.html — has it been renamed?');

  // to the end of a single-line statement (balanced brackets, then newline)
  function decl(marker) {
    const i = h.lastIndexOf(marker, anchor);
    if (i < 0) throw new Error('marker not found (signature changed?): ' + marker);
    let d = 0;
    for (let k = i; k < h.length; k++) {
      const c = h[k];
      if (c === '{' || c === '[' || c === '(') d++;
      else if (c === '}' || c === ']' || c === ')') d--;
      else if (c === '\n' && d === 0) return h.slice(i, k);
    }
    throw new Error('unterminated declaration: ' + marker);
  }
  // to the end of a braced block
  function block(marker, from) {
    const i = from === 'forward' ? h.indexOf(marker) : h.lastIndexOf(marker, anchor);
    if (i < 0) throw new Error('marker not found (signature changed?): ' + marker);
    let d = 0, k = h.indexOf('{', i);
    for (; k < h.length; k++) { if (h[k] === '{') d++; else if (h[k] === '}') { d--; if (!d) break; } }
    return h.slice(i, k + 1) + ';';
  }

  const gapHelper = (h.match(/(?:const|let)\s+d\s*=\s*\(x, y\)\s*=>[^\n]*/) || [])[0];
  if (!gapHelper) throw new Error('the d(x, y) gap helper is gone');

  const SRC = [
    gapHelper,
    decl('const lean = s =>'),
    decl('const output = s =>'),
    block('const short = n =>'),
    block('const EDGE_AXES = {'),
    decl('const STRIKING_AXES = ['),
    decl('const GRAPPLING_AXES = ['),
    'const ALL_AXES = Object.keys(EDGE_AXES);',
    block('const edge = (self, other, prefer'),
    decl('const FINISH_AXES = ['),
    block('const dedupeFinish = ('),
    block(PATH_FN, 'forward'),
  ].join('\n');

  // FIGHTER_STATS, parsed out of index.html. Percentages ("58%") become numbers,
  // nulls stay null — the same shape path() reads at runtime.
  const stats = {};
  for (const m of h.matchAll(/"([^"]+)":\s*\{\s*(ht:[^}]*)\}/g)) {
    const o = {};
    for (const [, k, v] of m[2].matchAll(/(\w+):\s*("(?:[^"\\]|\\.)*"|-?[\d.]+|null)/g)) {
      if (v === 'null') { o[k] = null; continue; }
      const n = v[0] === '"' ? parseFloat(v.replace(/[^\d.\-]/g, '')) : parseFloat(v);
      o[k] = isNaN(n) ? null : n;
    }
    stats[m[1]] = o;
  }

  const ctx = vm.createContext({ console });
  vm.runInContext(SRC, ctx);

  // Feed spellings differ from the DB's; reuse the app's own alias table.
  const aliases = {};
  const na = h.match(/const NAME_ALIASES = \{([\s\S]*?)\n {2}\};/);
  if (na) for (const [, k, v] of na[1].matchAll(/'([^']+)':\s*'([^']+)'/g)) aliases[k.toLowerCase()] = v;
  const resolve = (n) => (stats[n] ? n : aliases[(n || '').toLowerCase()] || n);

  const events = [];
  for (const f of ['data/event.json', 'data/event-recent.json']) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;          // genuinely absent is fine; see CLAUDE.md
    events.push(...(JSON.parse(fs.readFileSync(p, 'utf8')).data || []));
  }

  const lines = [];
  let bouts = 0, skipped = 0;
  for (const e of events) {
    for (const b of e.bouts || []) {
      const fr = b.fighters || [];
      if (fr.length !== 2 || b.isCancelled) continue;
      const n1 = resolve(fr[0].fighterName), n2 = resolve(fr[1].fighterName);
      if (!stats[n1] || !stats[n2]) { skipped++; continue; }   // no FIGHTER_STATS entry
      bouts++;
      Object.assign(ctx, { A: stats[n1], B: stats[n2], N1: n1, N2: n2 });
      vm.runInContext('L1 = path(A, B, N2, false); L2 = path(B, A, N1, false);', ctx);
      lines.push({ ev: e.slug, who: n1, vs: n2, line: ctx.L1 });
      lines.push({ ev: e.slug, who: n2, vs: n1, line: ctx.L2 });
    }
  }
  return { lines, stats, bouts, skipped };
}

module.exports = { buildLines };

if (require.main === module) {
  const { lines, bouts, skipped } = buildLines();
  const stem = (s) => String(s).split(/[—(]/)[0].trim().replace(/\s+/g, ' ');
  const tally = (a) => a.reduce((m, x) => ((m[x] = (m[x] || 0) + 1), m), {});
  const stems = tally(lines.map((l) => stem(l.line)));
  const full = tally(lines.map((l) => l.line));

  console.log('bouts scored: %d  (%d skipped — a fighter had no FIGHTER_STATS entry)', bouts, skipped);
  console.log('lines generated: %d\n', lines.length);

  console.log('most repeated opening clause:');
  Object.entries(stems).sort((a, b) => b[1] - a[1]).slice(0, 8)
    .forEach(([s, n]) => console.log('  %s  %s', String(n).padStart(4), s.slice(0, 84)));

  const dup = Object.entries(full).filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);
  console.log('\ndistinct lines: %d of %d  (%d are duplicates of another)',
    Object.keys(full).length, lines.length, lines.length - Object.keys(full).length);
  dup.slice(0, 5).forEach(([s, n]) => console.log('  %sx  %s', n, s.slice(0, 96)));
}
