#!/usr/bin/env node
/* FIGHT_HISTORY link auditor — splits one-sided links into ALIASES vs COLLISIONS.
 *
 * A genuine bout is RECIPROCAL: it sits in both corners' records. ~2.6% of links
 * are one-sided, and they are two very different bugs wearing the same face:
 *
 *   ALIAS      one man, two spellings. "Anderson Berinja" claims a bout vs Miles
 *              Johns; Johns's record says he fought "Anderson dos Santos". Both
 *              records describe the SAME REAL BOUT, on the same date. The fix is
 *              a rename — the fight is real and must be kept.
 *
 *   COLLISION  two men, one name. Brendan Allen claims a bout vs "Bruno Silva";
 *              the Bruno Silva record has never heard of him because Allen
 *              fought a DIFFERENT Bruno Silva. The fight is real but the LINK is
 *              fabricated. The fix is a new identity, not a rename.
 *
 * Telling them apart with names alone is impossible — that's what got us here.
 * DATES do it. For a one-sided link "A claims a bout vs X on date D", ask the
 * one question names can't answer: WAS X EVEN FIGHTING THAT DAY?
 *
 *   X has a bout on D, against W       -> X was there. A and W are the same man
 *                                         under two names. ALIAS. (Anderson
 *                                         "Berinja" fought Miles Johns on
 *                                         2021-08-07; Johns's record calls him
 *                                         Anderson dos Santos.) Note the alias
 *                                         can be on EITHER side — the claimant's
 *                                         name or the opponent's — and this test
 *                                         catches both, because it never trusts
 *                                         a name in the first place.
 *   X has no bout on D at all          -> X wasn't fighting. So A fought a
 *                                         DIFFERENT man who happens to share the
 *                                         name. COLLISION. (Brendan Allen fought
 *                                         a Bruno Silva on 2023-06-24; the Bruno
 *                                         Silva on file was nowhere near it.)
 *
 * An earlier draft of this asked "who records a bout against A on D?" and got
 * Berinja exactly backwards — it only ever detected an alias on the OPPONENT's
 * side, so every claimant-side alias came out as a collision. Asking about the
 * date instead of the name is the whole trick.
 *
 * Emits data/name-aliases.json: { "<claimant>|<date>|<written name>": "<real key>" }
 * so consumers can resolve a written name to a real identity instead of guessing.
 *
 * Usage:
 *   node scripts/audit-name-links.cjs             # report only
 *   node scripts/audit-name-links.cjs --write     # also write data/name-aliases.json
 *   node scripts/audit-name-links.cjs --check     # CI: fail only on NEW collisions
 *   node scripts/audit-name-links.cjs --baseline  # re-bless the current collisions
 *
 * --check is the point of the whole thing. 180 collisions exist today; failing on
 * all of them would cry wolf forever and get muted within a week. So we baseline
 * the known ones and fail only on what's NEW — the Bruno that lands next month.
 * Every bug in this family so far was found by a person playing the site months
 * later. This is what makes the pipeline find the next one on day one instead.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'name-aliases.json');
const BASELINE = path.join(ROOT, 'data', 'name-collisions-baseline.json');
const WRITE = process.argv.includes('--write');
const CHECK = process.argv.includes('--check');
const BLESS = process.argv.includes('--baseline');

// A collision's identity is the bout it fabricates, not the fighter — the same
// name collides differently in different records, which is the entire bug.
const cid = c => c.claimant + '|' + c.date + '|' + c.wrote;

const norm = s => String(s == null ? '' : s).toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

function readFightHistory() {
  const h = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const i = h.indexOf('const FIGHT_HISTORY');
  const s = h.indexOf('{', i);
  let d = 0, e = s;
  for (; e < h.length; e++) {
    const c = h[e];
    if (c === '{') d++;
    else if (c === '}') { d--; if (!d) { e++; break; } }
  }
  return eval('(' + h.slice(s, e) + ')');
}

// Dates drift by a day across sources (timezone of the event vs the local card),
// so treat anything inside 2 days as the same bout.
const DAY = 864e5;
const ts = d => { const t = Date.parse(d || ''); return isFinite(t) ? t : null; };
const sameDay = (a, b) => a != null && b != null && Math.abs(a - b) <= 2 * DAY;

function main() {
  const FH = readFightHistory();
  const keyByNorm = Object.create(null);
  for (const k of Object.keys(FH)) keyByNorm[norm(k)] = k;

  const aliases = {};
  const collisions = [];
  const ambiguous = [];
  let reciprocal = 0, oneSided = 0;

  for (const k of Object.keys(FH)) {
    const a = norm(k);
    for (const b of FH[k]) {
      const o = norm(b.opponent);
      if (!o) continue;
      const oppKey = keyByNorm[o];
      if (!oppKey) continue;                       // opponent keeps no record — nothing to check
      const theirs = FH[oppKey];
      if (theirs.some(x => norm(x.opponent) === a)) { reciprocal++; continue; }
      oneSided++;

      // The only question that matters: was the opponent fighting that day at all?
      const when = ts(b.date);
      const thatDay = theirs.filter(x => sameDay(ts(x.date), when));

      if (thatDay.length === 1) {
        // He was there, against someone written differently -> same man, two names.
        aliases[k + '|' + b.date + '|' + b.opponent] = {
          real: oppKey,
          theyCallHim: thatDay[0].opponent,        // what the opponent's record calls the claimant
          note: 'alias'
        };
      } else if (thatDay.length === 0) {
        // He wasn't fighting. So this is a different man wearing the same name.
        collisions.push({ claimant: k, wrote: b.opponent, date: b.date,
                          resolvesTo: oppKey, org: b.org || '?' });
      } else {
        ambiguous.push({ claimant: k, wrote: b.opponent, date: b.date,
                         cands: thatDay.map(x => x.opponent) });
      }
    }
  }

  console.log('FIGHT_HISTORY link audit');
  console.log('  reciprocal links : ' + reciprocal);
  console.log('  one-sided links  : ' + oneSided);
  console.log('');
  console.log('  ALIAS  (one man, two spellings — a date-matched echo exists) : ' + Object.keys(aliases).length);
  console.log('  COLLIDE(two men, one name — nobody echoes the bout)          : ' + collisions.length);
  console.log('  AMBIG  (several candidates — needs a human)                  : ' + ambiguous.length);
  console.log('');

  const showAlias = Object.entries(aliases).slice(0, 8);
  if (showAlias.length) {
    console.log('  sample ALIASES (safe to rename — the bout is real and both records agree on the date):');
    for (const [k, v] of showAlias) {
      const [who, date, wrote] = k.split('|');
      console.log('    ' + who + ' wrote "' + wrote + '" (' + date + ')');
      console.log('        that man WAS fighting that day — his record calls the claimant "' + v.theyCallHim + '"');
    }
    console.log('');
  }
  if (collisions.length) {
    console.log('  sample COLLISIONS (do NOT rename — the written name is a different person):');
    for (const c of collisions.slice(0, 8)) {
      console.log('    ' + c.claimant + ' wrote "' + c.wrote + '" (' + c.date + ', ' + c.org +
                  ')  -> resolves to ' + c.resolvesTo + ', who denies it');
    }
    console.log('');
  }
  if (ambiguous.length) {
    console.log('  AMBIGUOUS:');
    for (const c of ambiguous.slice(0, 5)) {
      console.log('    ' + c.claimant + ' wrote "' + c.wrote + '" (' + c.date + ') -> ' + c.cands.join(' | '));
    }
    console.log('');
  }

  // ── baseline / CI gate ────────────────────────────────────────────────────
  if (BLESS) {
    fs.writeFileSync(BASELINE, JSON.stringify({
      generatedAt: new Date().toISOString(),
      note: 'Known collisions, deliberately tolerated. --check fails only on links NOT in here. Each entry is a real bug: a fighter with no record of his own whose name lands on someone else\'s key (the Bruno "Blindado" shape). Fix one via the fill-fighter skill, then re-run --baseline to drop it.',
      known: collisions.map(cid).sort()
    }, null, 2) + '\n');
    console.log('  baselined ' + collisions.length + ' known collisions');
  }

  if (CHECK) {
    let known = [];
    try { known = JSON.parse(fs.readFileSync(BASELINE, 'utf8')).known || []; }
    catch (e) { console.log('  no baseline yet — run --baseline first'); process.exitCode = 1; return { aliases, collisions, ambiguous }; }
    const knownSet = new Set(known);
    const fresh = collisions.filter(c => !knownSet.has(cid(c)));
    const gone = known.filter(k => !collisions.some(c => cid(c) === k));

    // Loud, and in GitHub's own annotation format so it lands on the run page.
    for (const c of fresh) {
      console.log('::warning title=New fighter-name collision::' + c.claimant +
        ' claims a bout vs "' + c.wrote + '" (' + c.date + ', ' + c.org +
        ') but that name resolves to ' + c.resolvesTo + ', who has no bout that day. ' +
        'Two different fighters share this name. Give the missing one an identity (fill-fighter), then re-baseline.');
    }
    if (gone.length) console.log('  ' + gone.length + ' baselined collision(s) no longer present — re-run --baseline to tidy');
    if (fresh.length) {
      console.log('\n  FAIL: ' + fresh.length + ' NEW collision(s) since the baseline.');
      process.exitCode = 1;
    } else {
      console.log('  OK: no new collisions (' + known.length + ' known, tolerated)');
    }
  }

  if (WRITE) {
    fs.writeFileSync(OUT, JSON.stringify({
      generatedAt: new Date().toISOString(),
      note: 'Resolves a written opponent name to the real fighter key. Keyed "<claimant>|<date>|<written name>" because the SAME written name can mean different people in different records — that is the whole bug. Aliases only: date-matched, so both records describe one real bout. Collisions are deliberately NOT here; they need new identities, not renames.',
      aliases
    }, null, 2) + '\n');
    console.log('  wrote data/name-aliases.json (' + Object.keys(aliases).length + ' resolutions)');
  }
  return { aliases, collisions, ambiguous };
}

if (require.main === module) main();
module.exports = { main, norm, readFightHistory };
