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
    bad.push([f, msg.trim()]);
  }
}

console.log('\nworker/ — ES module parse check\n');
for (const f of files) {
  const hit = bad.find((b) => b[0] === f);
  console.log(hit ? '  FAIL  ' + f + '\n          ' + hit[1] : '  ok    ' + f);
}
console.log('\n' + (files.length - bad.length) + ' of ' + files.length + ' parse' + (bad.length ? ' — ' + bad.length + ' BROKEN, the deploy would fail' : '') + '\n');
process.exit(bad.length ? 1 : 0);
