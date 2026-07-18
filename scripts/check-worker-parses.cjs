#!/usr/bin/env node
/**
 * check-worker-parses.cjs — do the Worker's modules actually parse?
 *
 * THE GAP THIS FILLS, AND HOW IT WAS FOUND. On 2026-07-17 I put backticks in a comment
 * inside landingPage's template literal. A backtick closes the literal, so worker/pages.js
 * became a syntax error and gen-carousel copied the break into worker/carousel-data.js —
 * the landing page AND /subscribe, both unbuildable. The wrangler deploy would have died.
 *
 * Nothing noticed. Every generator here treats pages.js as TEXT: gen-carousel slices it
 * with indexOf, gen-showcase-proto slices it with markers, gen-matchup-free slices
 * index.html. None of them parse what they read, so all of them ran green over a file
 * that could not load, and 30 passing checks said the page was fine.
 *
 * `node --check` DOES NOT CATCH IT. It assumes CommonJS, and the broken construct is only
 * broken under module semantics — it exits 0 on the broken file. The check has to be
 * `--input-type=module`, which is the whole reason this script exists rather than a line
 * in the workflow that looked right.
 *
 * Cheap, and it is the difference between finding this in a second and finding it in a
 * failed deploy.
 *
 * Run: node scripts/check-worker-parses.cjs   (CI runs it in update-odds.yml)
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'worker');

let files;
try { files = fs.readdirSync(DIR).filter((f) => f.endsWith('.js')).sort(); }
catch (e) {
  if (e.code === 'ENOENT') throw new Error('worker/ is absent');
  throw new Error('worker/ unreadable, which is NOT absent (CLAUDE.md #1): ' + e.message);
}
if (!files.length) throw new Error('no .js in worker/ — this check would pass by testing nothing');

const bad = [];
for (const f of files) {
  const p = path.join(DIR, f);
  let src;
  try { src = fs.readFileSync(p, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') { bad.push([f, 'vanished mid-run']); continue; }
    throw new Error('unreadable, which is NOT absent (iCloud offload? CLAUDE.md #1): ' + p + ' — ' + e.message);
  }
  try {
    // --input-type=module is the point. Plain --check assumes CommonJS and exits 0 on
    // exactly the break this exists to catch.
    execFileSync(process.execPath, ['--input-type=module', '--check'], { input: src, stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (e) {
    const msg = String(e.stderr || e.message).split('\n').find((l) => /SyntaxError/.test(l)) || 'failed to parse';
    const where = String(e.stderr || '').match(/^\[stdin\]:(\d+)/m);
    const hint = diagnose(src, f, where ? +where[1] : 0);
    bad.push([f, msg.trim() + (where ? '  (line ' + where[1] + ')' : '') + (hint ? '\n' + hint : '')]);
  }
}

// WHERE the break is, not just that there is one.
//
// "SyntaxError: Unexpected token 'var'" at line 1186 of a 3,000-line file, with no
// context, is a 10-minute hunt. Five times today the cause was identical: a backtick
// inside a COMMENT inside a template literal, which closes the literal and makes the rest
// of the file parse as code. Four of those five were in comments I was writing to warn
// about the other ones. If a mistake recurs that reliably, the answer is not resolving to
// be careful — it is making the tool name it.
// ANCHOR THE HINT TO THE ERROR LINE, or it points at innocent code.
// The first version listed every backtick-in-a-comment in the file. Most are harmless —
// a comment outside any template literal can say whatever it likes — so it fingered
// pages.js:145 and :287 (both fine) and missed the actual culprit further down. A
// diagnostic that names the wrong line is worse than no diagnostic: it sends you to
// rewrite working code. Node tells us where the parse died; the cause is the LAST
// offending comment before that point.
function diagnose(src, file, errLine) {
  if (!errLine) return null;
  const lines = src.split('\n');
  // TRACK BLOCK COMMENTS, don't pattern-match a line prefix.
  // The first version only recognised lines beginning with // or /* or *. Most block
  // comments in this repo are indented prose whose continuation lines start with a plain
  // word — so it walked straight past the actual culprit and fingered two innocent lines
  // instead. It found `#mh-box` in nothing and blamed line 314. A detector that only sees
  // the comments that look like comments is the same shape as the bug it hunts.
  const hits = [];
  let inBlock = false;
  for (let i = 0; i < Math.min(errLine, lines.length); i++) {
    const l = lines[i];
    const opens = l.lastIndexOf('/*'), closes = l.lastIndexOf('*/');
    const isLine = /^\s*\/\//.test(l);
    const inside = inBlock || isLine || (opens >= 0 && closes < opens);
    if (inside) {
      const ticks = (l.match(/(?<!\\)`/g) || []).length;
      if (ticks) hits.push([i + 1, l.trim().slice(0, 76), ticks]);
    }
    if (opens >= 0 && closes < opens) inBlock = true;
    else if (closes >= 0 && closes > opens) inBlock = false;
  }
  if (!hits.length) return null;
  const near = hits.slice(-3).reverse();   // closest to the break, working backwards
  return '  likely cause — backtick(s) in a comment CLOSE an enclosing template literal.\n' +
    '  the last such comment(s) before the break:\n' +
    near.map(([n, t, c]) => '     ' + file + ':' + n + '  (' + c + ' backtick' + (c > 1 ? 's' : '') + ')  ' + t).join('\n');
}

console.log('\nworker/ — ES module parse check\n');
for (const f of files) {
  const hit = bad.find((b) => b[0] === f);
  console.log(hit ? '  FAIL  ' + f + '\n          ' + hit[1] : '  ok    ' + f);
}
console.log('\n' + (files.length - bad.length) + ' of ' + files.length + ' parse' + (bad.length ? ' — ' + bad.length + ' BROKEN, the deploy would fail' : '') + '\n');
process.exit(bad.length ? 1 : 0);
