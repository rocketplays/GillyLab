#!/usr/bin/env node
/**
 * fix-tape-sections.cjs — repair Tape Study section headers in index.html.
 *
 *     node scripts/fix-tape-sections.cjs           # report
 *     node scripts/fix-tape-sections.cjs --write   # apply
 *
 * THE BUG THIS FIXES
 * Section headers were generated on the assumption that a career reads as one
 * UFC block followed by one pre-UFC block: emit "UFC" on the first UFC row,
 * "Pre-UFC" on the first non-UFC row, null everywhere else. 523 fighters in
 * FIGHT_HISTORY do not have that shape — they are UFC, then something else, then
 * UFC again (a release and return, a TUF or DWCS appearance mid-run, or a single
 * mis-tagged row). Under the old logic the "Pre-UFC" header, once emitted, is
 * inherited by every older row, so an entire earlier UFC stint renders beneath
 * it. Neil Magny's 2013-2015 UFC run and Nikita Krylov's 2013-2016 run both did.
 *
 * WHAT IT DOES NOT DO
 * It does not rewrite every section. Many are hand-curated promotion labels
 * ("LFA", "Bellator", "RCC", "Fury FC") and those carry information this script
 * has no way to reconstruct. It only touches a row when the header it currently
 * sits under CONTRADICTS the event: a UFC event inheriting a non-UFC header gets
 * a "UFC" header, and the first non-UFC row after that gets its own header back
 * (its existing label if it had one, otherwise "Pre-UFC").
 *
 * ORG IS NOT TRUSTWORTHY, so UFC-ness is decided by event name as well:
 * 957 FIGHT_HISTORY rows sit on an unmistakably UFC event while carrying an org
 * of "DWCS" or blank. DWCS / Road to UFC / TUF prelim rounds are deliberately
 * NOT counted as UFC here — they are the route into the UFC, so a "Pre-UFC"
 * header above them is right. A TUF *Finale* is a real UFC event and counts.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');

// Classified on the EVENT NAME ONLY, deliberately. Two reasons:
//   - org is unreliable: 957 FIGHT_HISTORY rows sit on an unmistakably UFC event
//     with org "DWCS" or blank.
//   - looking the org up needs a FIGHT_HISTORY row, and matching that by opponent
//     name alone picks the WRONG meeting for rematches. It did: Kape vs Horiguchi
//     at "Rizin WGP 2017 Final" was read as UFC because the pair also met in the
//     UFC in 2026. The event label in TAPE_STUDY is self-describing; use it.
const PROPER_UFC = /^UFC\b|^Noche UFC|^VeChain UFC|^UFC on |Ultimate Fighter[^·]*Finale/i;
// The route INTO the UFC, not the UFC itself — a "Pre-UFC" header above these is
// correct. Note "Contender Series" appears both with and without "Dana White's".
const NOT_UFC_ROUTE = /Contender Series|^DWCS|Road to UFC|Ultimate Fighter(?![^·]*Finale)/i;

const isUfcEvent = (event) => {
  const e = String(event || '');
  if (NOT_UFC_ROUTE.test(e)) return false;
  return PROPER_UFC.test(e);
};

function main() {
  const write = process.argv.includes('--write');
  let h;
  try { h = fs.readFileSync(INDEX, 'utf8'); }
  catch (e) { throw new Error('cannot read index.html (' + e.code + ') — if EDEADLK it is iCloud-offloaded; open it on the Mac first'); }

  function objectSource(marker) {
    const i = h.indexOf(marker);
    if (i < 0) throw new Error('not found: ' + marker);
    let d = 0, k = h.indexOf('{', i);
    for (; k < h.length; k++) { if (h[k] === '{') d++; else if (h[k] === '}') { d--; if (!d) break; } }
    return { src: h.slice(i, k + 1), start: i, end: k };
  }
  const ts = objectSource('const TAPE_STUDY = {');
  const ctx = vm.createContext({});
  vm.runInContext(ts.src + ';\n' + objectSource('const FIGHT_HISTORY = {').src +
    ';\nglobalThis.TS = TAPE_STUDY; globalThis.FH = FIGHT_HISTORY;', ctx);

  const norm = (n) => String(n || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  // decide the corrected section for every row, per fighter
  // NEVER overwrite an existing label. The hand-curated ones ("Early UFC", "LFA",
  // "Bellator", "RCC") carry information this script cannot reconstruct, and the
  // first draft of it tried to flatten "Early UFC" into "UFC". Only FILL NULLS.
  const changes = [];
  for (const [fighter, rows] of Object.entries(ctx.TS)) {
    let effective = null;          // the header a row currently renders under
    let prevUfc = null;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const ufc = isUfcEvent(r.event);

      if (r.section == null) {
        let want = null;
        if (prevUfc === null) want = ufc ? 'UFC' : 'Pre-UFC';         // heads the list
        else if (ufc !== prevUfc) want = ufc ? 'UFC' : 'Pre-UFC';      // real transition
        else if (ufc && effective && effective !== 'UFC') want = 'UFC'; // the reported bug
        if (want) {
          changes.push({ fighter, i, opponent: r.opponent, event: r.event, from: r.section, to: want });
          r.section = want;
        }
      } else if (r.section === 'Pre-UFC' && ufc) {
        // The ONE overwrite allowed. "Pre-UFC" sitting on a genuine UFC event is
        // never right, so this cannot destroy a meaningful hand label — those read
        // "Early UFC", "LFA", "Bellator" and so on. These are wrong labels the old
        // generator wrote explicitly, which the never-overwrite rule was shielding.
        changes.push({ fighter, i, opponent: r.opponent, event: r.event, from: r.section, to: 'UFC' });
        r.section = 'UFC';
      }
      // A header identical to the one already in force renders the same heading
      // twice in a row. Drop it (never the first row, which must carry one).
      if (i > 0 && r.section && r.section === effective) {
        changes.push({ fighter, i, opponent: r.opponent, event: r.event, from: r.section, to: null });
        r.section = null;
      }
      if (r.section) effective = r.section;
      prevUfc = ufc;
    }
  }

  console.log('rows whose section header changes: %d', changes.length);
  const byF = {};
  changes.forEach((c) => { (byF[c.fighter] = byF[c.fighter] || []).push(c); });
  console.log('fighters affected: %d\n', Object.keys(byF).length);
  Object.entries(byF).slice(0, 12).forEach(([f, cs]) => {
    console.log('  ' + f);
    cs.slice(0, 4).forEach((c) => console.log('      ' + String(c.opponent).padEnd(22) +
      String(c.event).slice(0, 30).padEnd(31) + JSON.stringify(c.from) + ' -> ' + JSON.stringify(c.to)));
  });

  if (!write) { console.log('\nreport only — re-run with --write to apply'); return; }

  // rewrite only the section: field of each affected row, in place, by position
  let src = ts.src;
  // url may be null — some rows are placeholders with an event but no video yet.
  // Requiring a quoted url made the rewrite skip them SILENTLY, which showed up
  // only because re-running the script still reported changes. Keep it idempotent.
  const rowRe = /\{ opponent: "((?:[^"\\]|\\.)*)", url: (?:null|"(?:[^"\\]|\\.)*"), event: "((?:[^"\\]|\\.)*)", section: (null|"[^"]*") \}/g;
  const keyRe = /^ +("(?:[^"\\]|\\.)*"): \[$/gm;
  // walk the source fighter block by fighter block so positions line up
  const keys = [...src.matchAll(keyRe)];
  let outSrc = '', cursor = 0;
  for (let ki = 0; ki < keys.length; ki++) {
    const name = JSON.parse(keys[ki][1]);
    const blockStart = keys[ki].index + keys[ki][0].length;
    const blockEnd = ki + 1 < keys.length ? keys[ki + 1].index : src.length;
    outSrc += src.slice(cursor, blockStart);
    let block = src.slice(blockStart, blockEnd);
    const rows = ctx.TS[name] || [];
    let n = 0;
    block = block.replace(rowRe, (m, opp, url, ev, sec) => {
      const want = rows[n] ? rows[n].section : null;
      n++;
      const wantLit = want ? JSON.stringify(want) : 'null';
      return wantLit === sec ? m : m.replace(/section: (null|"[^"]*") \}$/, 'section: ' + wantLit + ' }');
    });
    outSrc += block;
    cursor = blockEnd;
  }
  outSrc += src.slice(cursor);

  const updated = h.slice(0, ts.start) + outSrc + h.slice(ts.end + 1);
  // sanity: same number of rows, still parses
  const before = (ts.src.match(/\{ opponent:/g) || []).length;
  const after = (outSrc.match(/\{ opponent:/g) || []).length;
  if (before !== after) throw new Error('row count changed ' + before + ' -> ' + after + ' — refusing to write');
  new vm.Script(outSrc + ';');
  fs.writeFileSync(INDEX, updated);
  console.log('\nwrote index.html — %d rows, unchanged count, still parses', after);
}

main();
