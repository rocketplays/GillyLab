#!/usr/bin/env node
/* The Climb — IS THE STYLE GAP THE GAME, OR IS IT HEAVYWEIGHT?
 *
 * WHY THIS EXISTS. Every balance table this project has produced — including the
 * N=500 one now sitting in THE-CLIMB-TUNING.txt — was measured in ONE division.
 * sim-climb-runs.cjs has no --div flag, so it plays whatever d.order[0] is, which
 * is heavyweight, and the numbers got written down as facts about "the game".
 *
 * That matters because heavyweight is STRIKER-HEAVY, and a striker-heavy division
 * is exactly where a striker's styleDelta should be worst (everyone opposite you
 * defends the thing you do). So the measured 2x striker/wrestler gap has two
 * completely different explanations and the existing harness cannot tell them
 * apart:
 *     (a) the game's styles are unbalanced           -> STYLE_MAX / weights problem
 *     (b) heavyweight is a bad matchup for strikers  -> working as intended
 * If (b), the gap should INVERT in a grappler-heavy division. If (a), the striker
 * trails everywhere. One measurement separates them; nobody took it.
 *
 * smoke-climb-divisions.cjs does sweep all 11, but it runs ONE deliberately-bad
 * bot and asks "is any belt free" — a floor check. It cannot see a style gap,
 * because it only ever plays one style.
 *
 * Usage: node scripts/sweep-climb-styles.cjs [--div hw] [--runs 150]
 *        node scripts/sweep-climb-styles.cjs --list
 */
const fs = require('fs'), path = require('path'), { JSDOM } = require('jsdom');
const R = path.resolve(__dirname, '..') + '/';
const args = process.argv.slice(2);
const argS = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const RUNS = +argS('--runs', 150);
const ONLYDIV = argS('--div', null);
const ONLYSTRAT = argS('--only', null);   // confirm one cell at a real N

const DATA = JSON.parse(fs.readFileSync(R + 'data/climb.json', 'utf8'));
const HTML = fs.readFileSync(R + 'prototypes/the-climb.html', 'utf8');
const dom = new JSDOM(HTML, { runScripts: 'dangerously', pretendToBeVisual: true,
  beforeParse(w) { w.fetch = () => Promise.resolve({ json: () => Promise.resolve(DATA) }); } });
const win = dom.window;

// Same priority orders as sim-climb-runs.cjs. Kept in sync BY HAND, which is a
// smell — if these drift the two scripts stop being comparable.
const ORD = {
  striker : ['power','technique','pace','strdef','chin','cardio','takedef','grappling','wrestling'],
  wrestler: ['wrestling','takedef','cardio','chin','grappling','power','technique','pace','strdef'],
  grappler: ['grappling','wrestling','cardio','chin','takedef','technique','power','pace','strdef'],
};
const spend = O => 'var O=' + JSON.stringify(O) + ';while(G.pts>0){var m=false;' +
  'for(const id of O){var c=upCost(G.attrs[id]);' +
  'if(G.pts>=c&&G.attrs[id]<ATTR_MAX){G.pts-=c;G.attrs[id]++;m=true;break;}}if(!m)break;}';

function play(div, O) {
  win.eval('DIV="' + div + '"; newGame(); G.started=true;');
  win.eval('(function(){' + spend(O) + '})()');
  for (let g = 0; g < 40; g++) {
    const st = win.eval('({c:G.champ,l:G.losses,out:!!G.outOfShots})');
    if (st.c || st.out || st.l >= win.eval('CUT_AT')) break;
    // EVERY BOT TAKES THE BELT WHEN OFFERED — the harness's oldest lesson. A bot
    // that ducks the title reports a number about itself, not about the game.
    const ok = win.eval('(function(){if(G.pts>0){' + spend(O) + '}' +
      'var o=offers(); if(!o.length) return false;' +
      'var s=o.slice().sort(function(a,b){return b.p-a.p});' +
      'var t=o.filter(function(x){return x.f.rankNum===0})[0];' +
      'fight(t||s[Math.floor(s.length/2)]); return true;})()');
    if (!ok) break;
  }
  return win.eval('!!G.champ');
}

setTimeout(main, 800);
function main() {
  const divs = DATA.order.filter(d => !ONLYDIV || d === ONLYDIV);
  if (args.includes('--list')) { console.log(DATA.order.join(' ')); process.exit(0); }
  const se = p => Math.sqrt(p * (1 - p) / RUNS) * 100;
  for (const div of divs) {
    const rates = {};
    for (const [n, O] of Object.entries(ORD)) {
      if (ONLYSTRAT && n !== ONLYSTRAT) continue;
      let c = 0;
      for (let i = 0; i < RUNS; i++) if (play(div, O)) c++;
      rates[n] = c / RUNS * 100;
    }
    const lab = (DATA.divisions[div] && DATA.divisions[div].label) || div;
    if (ONLYSTRAT) {
      const p = rates[ONLYSTRAT];
      console.log(lab.padEnd(22) + ONLYSTRAT.padEnd(10) +
        (p.toFixed(0) + '%').padStart(5) + '   +-' + se(p / 100).toFixed(1) +
        '   (N=' + RUNS + ')');
      continue;
    }
    const st = rates.striker, gr = Math.max(rates.wrestler, rates.grappler);
    // +ve = the ground leads. This is the number the whole script exists for.
    const gap = gr - st;
    console.log(lab.padEnd(20) +
      ['striker','wrestler','grappler'].map(k => (rates[k].toFixed(0) + '%').padStart(9)).join('') +
      ('   ground-striker ' + (gap >= 0 ? '+' : '') + gap.toFixed(0)).padStart(24) +
      '   +-' + se(0.2).toFixed(1));
  }
  process.exit(0);
}
