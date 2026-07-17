#!/usr/bin/env node
/**
 * climb-app.js — The Climb, packaged for the PREMIUM APP, generated from
 * prototypes/the-climb.html.
 *
 * WHY GENERATED, NOT REPRODUCED. The brief was to "reproduce the entire game" inside
 * index.html. That is the exact failure this toolchain exists to prevent, and
 * gen-climb-page.cjs already says so about the free page: sim-climb-runs.cjs,
 * smoke-climb-divisions.cjs, test-climb.cjs, test-climb-fixes.cjs, check-climb-cap.cjs
 * and climb-arithmetic.cjs ALL JSDOM the prototype. A second copy in index.html means
 * the suite keeps measuring the prototype while the game premium users actually play
 * drifts away from it — and every number in THE-CLIMB-TUNING.txt becomes a claim about
 * a file nobody runs. The prototype is the source of truth because it is the file the
 * tests read. This is the third target built from it (the others: /theclimb, gl-sheet).
 *
 * It also keeps the eager payload flat. index.html is ~13MB and every visitor fetches
 * it; the game is 179KB. CLAUDE.md #3 is explicit about this. So the app lazy-loads
 * this bundle the first time someone flips the toggle, and a player who never does
 * pays nothing.
 *
 * WHAT MAKES THIS SAFE, MEASURED RATHER THAN HOPED:
 *   element IDs colliding with index.html : 0   (the game has exactly one, #app)
 *   getElementById calls in the game      : 0
 *   querySelector outside its own subtree : 0   (only .nm / .rec)
 *   touches of the world outside the game : 1   — document.body.classList.toggle('playing')
 *   CSS CLASS COLLISIONS                  : 15  <-- the whole problem
 * .open alone has 18 rules in index.html (the fight-info panels, the matchup modal);
 * .pl-act has 9, .win has 3 across 9 live elements. Dropping the game's 20KB of
 * stylesheet into the app unscoped would silently restyle the parlay slip and every
 * open panel in the document. So EVERY selector is rewritten under HOST below.
 *
 * Output: climb-app.js — window.CLIMB_APP = { css, html, boot }. The app injects css
 * once, sets html into its container, then calls boot(). Nothing runs at load.
 *
 * Run: node scripts/gen-climb-app.cjs   (CI runs it in update-odds.yml)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'prototypes', 'the-climb.html');
const OUT = path.join(ROOT, 'climb-app.js');
const DRY = process.argv.includes('--dry-run');

// The wrapper every selector gets scoped under. The app puts this id on the container
// it mounts the game into.
const HOST = '#climb-host';

function readOrThrow(p) {
  try { return fs.readFileSync(p, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') throw new Error('missing: ' + p);
    // ENOENT is the only tolerable read failure (CLAUDE.md #2). Offloaded/truncated
    // must throw, never fall back — a default here would ship an empty game.
    throw new Error('unreadable, which is NOT the same as absent: ' + p + ' — ' + e.message);
  }
}

const html = readOrThrow(SRC);

// ── slice ────────────────────────────────────────────────────────────────────
const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
if (styles.length !== 1) throw new Error('expected exactly 1 <style> block in the prototype, found ' + styles.length + ' — the slicer would drop or duplicate rules');

// Two scripts: gl-sheet.js (external, the app already has GL_SHEET) and the game.
const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
if (scripts.length !== 1) throw new Error('expected exactly 1 inline <script> in the prototype, found ' + scripts.length);
const gameJS = scripts[0];
if (gameJS.length < 50000) throw new Error('the game script is only ' + gameJS.length + ' chars — that is not the game');

// The playable markup: everything between the nav slot and the CTA slot, i.e. the
// .wrap column minus the site chrome the app supplies itself.
const NAV = '<!--FREE_NAV-->', CTA = '<!--CTA-->';
const a = html.indexOf(NAV), b = html.indexOf(CTA);
if (a < 0 || b < 0 || b < a) throw new Error('slot markers ' + NAV + ' / ' + CTA + ' missing or out of order — gen-climb-page.cjs relies on these too');
let body = html.slice(a + NAV.length, b);
// The BACK slot sits inside .wrap; the app has its own nav.
body = body.replace('<!--BACK-->', '');
if (!/id="app"/.test(body)) throw new Error('the mount point #app is not in the sliced markup — the game would have nowhere to render');
if (/<!--[A-Z_]+-->/.test(body)) throw new Error('an unfilled slot marker survived into the markup: ' + (/<!--[A-Z_]+-->/.exec(body) || [])[0]);

// The comments are notes to whoever edits the PROTOTYPE. They are not for the app's
// readers, and one of them ("KEEP THIS TRUE…") is an instruction that makes no sense
// in a generated file. Drop them here; the prototype keeps them.
body = body.replace(/<!--[\s\S]*?-->/g, '');

// CLOSE THE COLUMN. The <!--CTA--> marker sits INSIDE .wrap, so slicing at it opens
// `<div class="wrap">` and never closes it. innerHTML papers over this by auto-closing
// at the end of the fragment, which is why the bundle appeared to work — but that is the
// parser being forgiving, not the markup being right. Left alone, anything the app later
// appends to the same container would land INSIDE the game's column.
const opens = (body.match(/<div\b/g) || []).length;
const closes = (body.match(/<\/div>/g) || []).length;
if (opens - closes === 1) body += '\n</div>';
else if (opens !== closes) throw new Error('the sliced markup is unbalanced by ' + (opens - closes) + ' <div>s — the slot markers have moved and the slice is wrong');

// ── namespace the CSS ────────────────────────────────────────────────────────
// A real transform, not a regex over the whole file: selectors only, leaving
// declarations, @media conditions and custom properties alone.
//
//   :root                -> HOST            (the game's palette, scoped to the game)
//   html, body           -> HOST            (its page-level rules become host rules)
//   body.playing X       -> body.playing HOST X   <-- NOT rewritten to HOST.playing.
//        The game does document.body.classList.toggle('playing'), and that single
//        line is its only reach outside itself. Rewriting the JS to toggle the host
//        instead would mean editing the game — the thing this file exists not to do.
//        The class lands on the app's <body>, which is harmless (index.html has no
//        .playing rule at all, measured), and the selector still resolves.
//   *                    -> HOST *
//   anything else        -> HOST <sel>
// COMMENTS COME OUT FIRST, AND THAT IS NOT AN OPTIMISATION.
//
// This file's rules are found by counting braces, and ONE comment in the game's
// stylesheet contains a `{`. The counter walked into it, lost its balance, and the
// entire rest of the file came out unscoped — .divsel, .pl-act, .open, all of it,
// straight into the app's stylesheet. It was caught only because the guard below
// checks for surviving bare selectors; the output looked plausible otherwise.
//
// A brace counter that cannot see comments is not a parser, it is a hope. In a
// codebase whose stylesheets carry 31 comment blocks explaining why each rule exists,
// that hope is guaranteed to fail. Strip them, then count.
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');

function scopeCSS(css) {
  let out = '', i = 0;
  const flushRule = (selectors) => selectors.split(',').map((s) => {
    s = s.trim();
    if (!s) return '';
    if (s === ':root') return HOST;
    if (s === 'html' || s === 'body') return HOST;
    if (s === '*') return HOST + ' *';
    // body.playing … keeps body, because the class genuinely lands there.
    if (/^body(\.[\w-]+)+\s+/.test(s)) {
      const m = /^(body(?:\.[\w-]+)+)\s+(.*)$/.exec(s);
      return m[1] + ' ' + HOST + ' ' + m[2];
    }
    if (/^body(\.[\w-]+)+$/.test(s)) return s + ' ' + HOST;
    return HOST + ' ' + s;
  }).filter(Boolean).join(', ');

  while (i < css.length) {
    // at-rules: keep the condition, scope the inside
    const at = /^\s*@([\w-]+)([^{;]*)([{;])/.exec(css.slice(i));
    if (at) {
      const kw = at[1];
      if (at[3] === ';') { out += css.slice(i, i + at[0].length); i += at[0].length; continue; }
      // find the matching close brace
      let d = 0, j = i + at[0].length - 1;
      for (; j < css.length; j++) { if (css[j] === '{') d++; else if (css[j] === '}') { d--; if (!d) break; } }
      const inner = css.slice(i + at[0].length, j);
      // keyframes' "0%/from/to" are not selectors; leave the body alone.
      out += css.slice(i, i + at[0].length) + (/^(keyframes|font-face|supports)$/.test(kw) ? inner : scopeCSS(inner)) + '}';
      i = j + 1; continue;
    }
    const brace = css.indexOf('{', i);
    if (brace < 0) { out += css.slice(i); break; }
    let d = 0, j = brace;
    for (; j < css.length; j++) { if (css[j] === '{') d++; else if (css[j] === '}') { d--; if (!d) break; } }
    const sel = css.slice(i, brace);
    const decl = css.slice(brace + 1, j);
    const lead = /^\s*/.exec(sel)[0];
    out += lead + flushRule(sel) + '{' + decl + '}';
    i = j + 1;
  }
  return out;
}

const cleanCSS = stripComments(styles[0]);
const scoped = scopeCSS(cleanCSS);
// The transform has to have actually done something, and must not have eaten rules.
const braces = (s) => (s.match(/\{/g) || []).length;
if (braces(scoped) !== braces(cleanCSS)) throw new Error('the CSS transform changed the rule count: ' + braces(cleanCSS) + ' -> ' + braces(scoped));
if (scoped.includes(':root')) throw new Error(':root survived scoping — the game would repaint the app');

// EVERY selector must be anchored to the host — not just a list of classes I thought of.
//
// This guard used to name five: .open, .primary, .busy, .win, .pl-act. It fired correctly
// when a comment containing `{` derailed the brace counter and left HALF THE STYLESHEET
// unscoped — but only because .pl-act happened to be in the wreckage. .divsel was in there
// too, and nothing was watching for it.
//
// The obvious fix was to re-parse the output and check each selector. Don't: a brace-walking
// audit shares the brace-walking bug, goes blind at the same comment, and passes the broken
// output 194/194. MEASURED — it did exactly that. The audit must not reuse the parser's
// assumptions, so this stays a dumb regex over the text. Dumb is the feature.
const RULE_START = /(^|\})\s*([^{}@]+)\{/g;
const unanchored = [];
for (const m of scoped.matchAll(RULE_START)) {
  for (const s of m[2].split(',')) {
    const sel = s.trim();
    if (!sel || /^(from|to|\d+%)$/.test(sel)) continue; // keyframe stops, left alone by design
    if (sel.startsWith(HOST)) continue;
    if (new RegExp('^body(\\.[\\w-]+)*\\s+' + HOST).test(sel)) continue; // body.playing HOST x
    unanchored.push(sel);
  }
}
if (unanchored.length) throw new Error(unanchored.length + ' selector(s) escaped scoping and would collide with index.html: ' + unanchored.slice(0, 6).join(' | '));

// ── emit ─────────────────────────────────────────────────────────────────────
const bundle =
  '// AUTO-GENERATED by scripts/gen-climb-app.cjs from prototypes/the-climb.html.\n' +
  '// DO NOT EDIT. Edit the prototype — it is what the test suite measures, and a fix\n' +
  '// made here would be invisible to sim-climb-runs.cjs and friends. See the header of\n' +
  '// scripts/gen-climb-app.cjs for why this is generated rather than reproduced.\n' +
  '(function () {\n' +
  '  if (typeof window === "undefined") return;\n' +
  '  window.CLIMB_APP = {\n' +
  '    css: ' + JSON.stringify(scoped) + ',\n' +
  '    html: ' + JSON.stringify(body.trim()) + ',\n' +
  '    // Nothing runs until the app calls this — the game ends with newGame(), which\n' +
  '    // needs its markup mounted first. Wrapping the script in a function also keeps\n' +
  '    // its 82 top-level names out of the app\'s scope.\n' +
  '    boot: function () {\n' +
  gameJS + '\n' +
  '    }\n' +
  '  };\n' +
  '})();\n';

if (!DRY) fs.writeFileSync(OUT, bundle);
const kb = (n) => (n / 1024).toFixed(0) + 'KB';
console.log('climb-app.js  ' + kb(bundle.length) +
  '  (css ' + kb(scoped.length) + ' scoped under ' + HOST + ' · markup ' + kb(body.length) + ' · game ' + kb(gameJS.length) + ')' +
  (DRY ? '   [dry-run, nothing written]' : ''));
