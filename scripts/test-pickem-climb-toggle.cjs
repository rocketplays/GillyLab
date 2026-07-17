#!/usr/bin/env node
/**
 * test-pickem-climb-toggle.cjs — the Pick'em / The Climb switch inside the premium app.
 *
 * This tests the WIRING, not the game (test-climb-app.cjs boots the bundle; the climb
 * suite tests the prototype's logic). Specifically the things that would ship broken and
 * look fine in a diff:
 *   - the tab actually swaps the two views
 *   - The Climb is NOT fetched until someone asks for it  <-- CLAUDE.md #3, the whole
 *     reason this is a lazy bundle instead of 270KB added to a 13MB eager payload
 *   - it is fetched exactly once, no matter how many times you flip
 *   - a failed load says so instead of spinning forever
 *   - #climb-host still exists and still has that id (every selector in climb-app.js is
 *     scoped under it — rename it and the game silently loses all styling)
 *
 * It reads the markup and the functions OUT OF index.html rather than restating them, so
 * it cannot quietly drift into testing a copy. If the slice below stops finding them the
 * test fails rather than passing on nothing — a test that measures nothing looks exactly
 * like a test that passes.
 *
 * Run: node scripts/test-pickem-climb-toggle.cjs
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
const read = (p) => {
  try { return fs.readFileSync(p, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') throw new Error('absent: ' + p);
    throw new Error('unreadable, which is NOT absent (iCloud offload? CLAUDE.md #1): ' + p + ' — ' + e.message);
  }
};

const html = read(path.join(ROOT, 'index.html'));
const bundle = read(path.join(ROOT, 'climb-app.js'));
const climbData = read(path.join(ROOT, 'data', 'climb.json'));

const fail = [], ok = [];
const check = (name, cond, detail) => (cond ? ok : fail).push(name + (detail ? '  ' + detail : ''));

// ── pull the real markup + the real functions out of index.html ───────────────
const pageM = /<div class="page" id="page-pickem">([\s\S]*?)\n<\/div>\n/.exec(html);
if (!pageM) throw new Error('could not find #page-pickem in index.html — the harness is testing nothing, so it fails instead');
const pageHTML = pageM[0];

const grab = (name) => {
  const re = new RegExp('\\n  function ' + name + '\\(');
  const at = re.exec(html);
  if (!at) throw new Error('could not find function ' + name + '() in index.html — refusing to test a copy');
  // brace-match from the function's opening {
  let i = html.indexOf('{', at.index + at[0].length - 1), d = 0, j = i;
  for (; j < html.length; j++) { if (html[j] === '{') d++; else if (html[j] === '}') { d--; if (!d) break; } }
  return html.slice(at.index, j + 1);
};
// The state var the three functions close over — taken from the file, not restated here.
// Declaring my own `var _climbState = 'idle'` would work and would be a lie: the test
// would keep passing if index.html's initial state ever changed underneath it.
const stateM = /\n  var _climbState = '[a-z]+';[^\n]*/.exec(html);
if (!stateM) throw new Error('could not find the _climbState declaration in index.html — refusing to invent one');
const src = stateM[0] + '\n' + ['pcSwitch', 'loadClimb', 'climbFailed'].map(grab).join('\n');
check('the harness found the real markup and functions in index.html', pageHTML.length > 400 && src.length > 800);

// the .pc-* rules, so we can assert the tab visibly changes
const cssM = /\.pc-tabs \{[\s\S]*?#pc-view-climb\[hidden\] \{[^}]*\}/.exec(html);
check('the switch CSS is present in index.html', !!cssM);

// ── stand up a page that looks like the app ──────────────────────────────────
const dom = new JSDOM(
  '<!doctype html><html><head><style>' + (cssM ? cssM[0] : '') + '</style></head><body>' +
  '<h1 id="app-title">Gilly Lab</h1><div class="panel open" id="app-panel"></div>' +
  pageHTML + '</body></html>',
  { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://gillylab.com/' }
);
const { window } = dom;
const doc = window.document;
window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
window.scrollTo = () => {};
window.HTMLCanvasElement.prototype.getContext = () => null;

let climbFetches = 0;
window.fetch = (url) => {
  if (String(url).endsWith('/data/climb.json')) {
    climbFetches++;
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(climbData)) });
  }
  return Promise.resolve({ ok: false, status: 404, json: () => Promise.reject(new Error('404')) });
};

// Intercept the <script src="/climb-app.js"> the app injects, and serve it from disk.
let scriptLoads = 0;
let serve = true;
const realAppend = window.document.head.appendChild.bind(window.document.head);
window.document.head.appendChild = function (node) {
  if (node.tagName === 'SCRIPT' && node.src) {
    scriptLoads++;
    setTimeout(() => {
      if (!serve) { if (node.onerror) node.onerror(); return; }
      try { window.eval(bundle); } catch (e) { /* surfaces as a failed check below */ }
      if (node.onload) node.onload();
    }, 0);
    return node;
  }
  return realAppend(node);
};

window.eval(src);

const tick = (ms) => new Promise((r) => setTimeout(r, ms));

(async function main() {
  const vp = () => doc.getElementById('pc-view-pickem');
  const vc = () => doc.getElementById('pc-view-climb');
  const host = () => doc.getElementById('climb-host');

  // ── the point of the whole exercise ────────────────────────────────────────
  check('nothing is fetched before the user asks for The Climb',
    scriptLoads === 0 && climbFetches === 0,
    '(script loads: ' + scriptLoads + ', roster fetches: ' + climbFetches + ' — a Pick\'em-only subscriber pays 0 bytes)');

  check('Pick\'em is the default view', vp() && !vp().hidden && vc() && vc().hidden);
  check('#climb-host exists (climb-app.js scopes every selector under this id)', !!host());

  // ── flip to The Climb ──────────────────────────────────────────────────────
  window.pcSwitch('climb');
  await tick(250);

  check('the tab swaps the views', vp().hidden === true && vc().hidden === false);
  check('the Climb tab is marked on', doc.getElementById('pc-tab-climb').classList.contains('on') &&
    !doc.getElementById('pc-tab-pickem').classList.contains('on'));
  check('aria-selected follows the tab', doc.getElementById('pc-tab-climb').getAttribute('aria-selected') === 'true' &&
    doc.getElementById('pc-tab-pickem').getAttribute('aria-selected') === 'false');
  check('the bundle was fetched on demand', scriptLoads === 1, '(' + scriptLoads + ' load)');
  check('the game booted and rendered', host().querySelector('#app') && host().querySelector('#app').innerHTML.trim().length > 200,
    '(' + (host().querySelector('#app') ? host().querySelector('#app').innerHTML.trim().length : 0) + ' chars)');
  check('the game fetched its roster', climbFetches === 1, '(' + climbFetches + ')');
  check('the game\'s CSS was injected once', doc.querySelectorAll('#climb-app-css').length === 1);

  // ── flip back and forth: must not re-load, must not double-boot ────────────
  window.pcSwitch('pickem');
  await tick(50);
  check('back to Pick\'em restores the picks view', vp().hidden === false && vc().hidden === true);
  check('body.playing does not linger on Pick\'em', !doc.body.classList.contains('playing'));

  window.pcSwitch('climb'); await tick(120);
  window.pcSwitch('pickem'); await tick(50);
  window.pcSwitch('climb'); await tick(120);
  check('flipping repeatedly loads the bundle exactly once', scriptLoads === 1, '(' + scriptLoads + ' loads after 4 flips)');
  check('flipping repeatedly does not re-boot the game', climbFetches === 1 && doc.querySelectorAll('#climb-app-css').length === 1,
    '(roster fetches: ' + climbFetches + ', stylesheets: ' + doc.querySelectorAll('#climb-app-css').length + ' — a re-boot would wipe a run in progress)');

  // ── the game must still not touch the app around it ────────────────────────
  let leaked = [], examined = 0;
  const walkRules = (list) => {
    for (const r of list) {
      if (r.selectorText) {
        for (const sel of r.selectorText.split(',')) {
          const s = sel.trim(); if (!s) continue; examined++;
          let hits; try { hits = doc.querySelectorAll(s); } catch { continue; }
          for (const el of hits) if (!host().contains(el) && el !== host() && !el.closest('#page-pickem')) leaked.push(s + ' -> ' + el.tagName + '#' + (el.id || el.className));
        }
        continue;
      }
      if (r.cssRules && r.cssRules.length) walkRules(r.cssRules);
    }
  };
  const sheet = [...doc.styleSheets].find((s) => s.ownerNode && s.ownerNode.id === 'climb-app-css');
  if (sheet) walkRules(sheet.cssRules);
  check('the leak check looked at the game\'s rules', examined > 100, '(' + examined + ' selectors)');
  check('the mounted game restyles nothing outside itself', leaked.length === 0,
    leaked.length ? '\n     ' + [...new Set(leaked)].slice(0, 6).join('\n     ') : '');

  // ── a broken deploy must not spin forever ─────────────────────────────────
  const dom2 = new JSDOM('<!doctype html><body>' + pageHTML + '</body>', { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://gillylab.com/' });
  const w2 = dom2.window;
  w2.document.head.appendChild = function (node) {
    if (node.tagName === 'SCRIPT' && node.src) { setTimeout(() => node.onerror && node.onerror(), 0); return node; }
    return node;
  };
  w2.eval(src);
  w2.pcSwitch('climb');
  await tick(60);
  const h2 = w2.document.getElementById('climb-host').innerHTML;
  check('a failed load tells the user instead of spinning', /couldn/i.test(h2) && /Try again/.test(h2),
    '(' + h2.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) + ')');

  console.log('\nPick\'em / The Climb — the switch in index.html\n');
  ok.forEach((s) => console.log('  ok    ' + s));
  fail.forEach((s) => console.log('  FAIL  ' + s));
  console.log('\n' + ok.length + ' passed, ' + fail.length + ' failed\n');
  process.exit(fail.length ? 1 : 0);
})();
