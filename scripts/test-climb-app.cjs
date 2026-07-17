#!/usr/bin/env node
/**
 * test-climb-app.cjs — does the GENERATED app bundle actually play?
 *
 * The rest of the climb suite (test-climb, sim-climb-runs, smoke-climb-divisions,
 * check-climb-cap, climb-arithmetic) all JSDOM prototypes/the-climb.html. That is
 * correct and stays that way — the prototype is the source of truth. But it means
 * NOTHING tests the artefact premium users would actually play. This does, and only
 * this: that climb-app.js mounts, boots, renders, and takes a turn.
 *
 * It deliberately does NOT re-test the game's logic. If the belt rate is wrong, that
 * is sim-climb-runs' job on the prototype. This file asks one question: did the
 * slicing and CSS scoping break the thing on the way out?
 *
 * Run: node scripts/test-climb-app.cjs
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
const BUNDLE = path.join(ROOT, 'climb-app.js');

let bundle;
try { bundle = fs.readFileSync(BUNDLE, 'utf8'); }
catch (e) {
  if (e.code === 'ENOENT') { console.error('climb-app.js is absent — run: node scripts/gen-climb-app.cjs'); process.exit(1); }
  throw new Error('climb-app.js unreadable, which is NOT absent: ' + e.message);
}

const fail = [];
const ok = [];
const check = (name, cond, detail) => (cond ? ok : fail).push(name + (detail ? '  ' + detail : ''));

// A host page that looks like the app: same wrapper id, plus a couple of the elements
// the game's classes are known to collide with, so we can prove they are untouched.
const dom = new JSDOM(
  '<!doctype html><html><head></head><body>' +
  '<h1 id="app-title">Gilly Lab</h1>' +
  '<div class="panel open" id="app-panel">a real app panel</div>' +
  '<button class="pl-act primary" id="app-btn">app button</button>' +
  '<div id="climb-host"></div>' +
  '</body></html>',
  { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://gillylab.com/' }
);
const { window } = dom;
window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
window.scrollTo = () => {};
window.HTMLCanvasElement.prototype.getContext = () => null; // gl-sheet only; the game must not need it to boot

// The game fetches /data/climb.json (104KB) rather than inlining its roster — which is
// exactly why dropping this into the app costs the eager payload nothing. Serve the real
// file from disk; a stub would test the stub.
const CLIMB_DATA = path.join(ROOT, 'data', 'climb.json');
let climbJSON;
try { climbJSON = fs.readFileSync(CLIMB_DATA, 'utf8'); }
catch (e) {
  if (e.code === 'ENOENT') throw new Error('data/climb.json is absent — the game has no roster to load');
  throw new Error('data/climb.json unreadable, which is NOT absent (iCloud offload? see CLAUDE.md #1): ' + e.message);
}
const fetched = [];
window.fetch = (url) => {
  fetched.push(String(url));
  if (String(url).endsWith('/data/climb.json')) {
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(climbJSON)), text: () => Promise.resolve(climbJSON) });
  }
  return Promise.resolve({ ok: false, status: 404, json: () => Promise.reject(new Error('404')), text: () => Promise.resolve('') });
};

window.eval(bundle);
const APP = window.CLIMB_APP;
check('bundle exposes window.CLIMB_APP', !!APP && typeof APP.boot === 'function');

// mount exactly the way the app will
const host = window.document.getElementById('climb-host');
const style = window.document.createElement('style');
style.textContent = APP.css;
window.document.head.appendChild(style);
host.innerHTML = APP.html;

check('#app mounted inside the host', !!host.querySelector('#app'));

// boot must not throw
let booted = true;
try { APP.boot.call(window); } catch (e) { booted = false; check('boot() throws', false, '-> ' + e.message.split('\n')[0]); }
if (booted) check('boot() runs clean', true);

main();
async function main() {
// The roster load is async, so let the fetch settle before asking what rendered.
await new Promise((r) => setTimeout(r, 200));

check('the game fetched its roster rather than inlining it', fetched.includes('/data/climb.json'),
  '(' + (fetched.join(', ') || 'nothing fetched') + ' — this is why the eager payload does not grow)');

// the game rendered something to play
const app = host.querySelector('#app');
const rendered = app ? app.innerHTML.trim().length : 0;
check('the game rendered', rendered > 200, '(' + rendered + ' chars of markup)');

// a turn is takeable: the division picker or a choice button exists
const clickable = host.querySelectorAll('button, .divsel, .pl-act').length;
check('there is something to click', clickable > 0, '(' + clickable + ' controls)');

// ── the point of all the scoping: the host page is untouched ──────────────────
// These are live elements in index.html's world. If any rule leaked, they move.
// (An earlier assertion here ended in `|| true`. It could not fail. Deleted rather than
//  fixed — the rule-vs-document sweep below is the real test and this only diluted it.)

// The honest test: no rule in the sheet may match an element outside the host.
//
// TEST selectorText BEFORE cssRules, and count what you examined.
// In jsdom a plain CSSStyleRule has a `cssRules` property that is an EMPTY BUT TRUTHY
// CSSRuleList. The obvious walker — `if (r.cssRules) recurse; else read selectorText` —
// therefore recurses into nothing for every ordinary rule and reads zero selectors. It
// reported "0 leaks" for the completely unscoped stylesheet, which is how a vacuous
// check looks from the outside: identical to a passing one. `examined` below exists so
// that can never happen quietly again — a test that measures nothing must fail, not pass.
let leaked = [];
let examined = 0;
const walk = (list) => {
  for (const r of list) {
    if (r.selectorText) {
      for (const sel of r.selectorText.split(',')) {
        const s = sel.trim();
        if (!s) continue;
        examined++;
        let hits;
        try { hits = window.document.querySelectorAll(s); } catch { continue; } // keyframe stops etc.
        for (const el of hits) if (!host.contains(el) && el !== host) leaked.push(s + '  ->  ' + el.tagName + '#' + (el.id || el.className));
      }
      continue;
    }
    if (r.cssRules && r.cssRules.length) walk(r.cssRules); // @media / @supports
  }
};
for (const sheet of window.document.styleSheets) {
  let rules; try { rules = sheet.cssRules; } catch { continue; }
  walk(rules);
}
check('the leak check actually looked at the rules', examined > 100, '(' + examined + ' selectors examined)');
check('no game rule matches anything outside the host', leaked.length === 0,
  leaked.length ? '(' + leaked.length + ' leaks)\n     ' + [...new Set(leaked)].slice(0, 8).join('\n     ') : '(vs h1, .panel.open, .pl-act.primary planted outside it)');

// the one sanctioned reach outside: body.playing
check('body.playing is the only outside touch, and it is harmless',
  !/\.playing/.test(APP.css) || /body\.playing #climb-host/.test(APP.css));

// The other direction: the host page's reset must not reach IN. index.html opens with
// `* { margin:0; padding:0 }`; the game leaves its division <select> to the browser, so
// without this the app's copy renders that control squeezed and /theclimb does not.
// Only the ordering is asserted here — `revert` resolves against a UA stylesheet, which
// jsdom does not have, so whether it LOOKS right is a browser question, not this file's.
check('the game is immune to the app\'s CSS reset', APP.css.startsWith('#climb-host, #climb-host * { margin: revert; padding: revert; }'),
  '(un-reset present and first, so every game rule still overrides it)');

console.log('\nclimb-app.js — generated bundle\n');
ok.forEach((s) => console.log('  ok    ' + s));
fail.forEach((s) => console.log('  FAIL  ' + s));
console.log('\n' + ok.length + ' passed, ' + fail.length + ' failed\n');
process.exit(fail.length ? 1 : 0);
}
