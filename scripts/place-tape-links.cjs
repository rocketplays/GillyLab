#!/usr/bin/env node
/**
 * place-tape-links.cjs — turn a hand-sourced list of fight links into TAPE_STUDY
 * entries in index.html.
 *
 *     node scripts/place-tape-links.cjs links.txt            # report only
 *     node scripts/place-tape-links.cjs links.txt --write    # apply + verify
 *
 * Input is the format the links get collected in by hand, one record per line
 * (or several run together on one line — both work):
 *
 *     – Uros Medic vs Punahele Soriano (https://ufcfightpass.com/video/740274)
 *     – Uros Medic vs Tim Means (https://ufcfightpass.com/video/616159)
 *
 * WHAT THE HARD PART ACTUALLY IS
 * Not the parsing — the names. findTapeStudyUrl() matches an entry to a Fight
 * History row on the OPPONENT STRING, so a link filed under a spelling the
 * database does not use produces a Tape Study row that attaches to nothing, and
 * nothing anywhere goes red. In the first 513-link batch, 57 opponent names
 * differed from the DB. Some were near-misses ("Edson Barbosa" / "Edson Barboza"),
 * several were not guessable at all: "Sergey Spivak" is "Serghei Spivac",
 * "Montserrat Conejo" is "Montserrat Ruiz" (Conejo is her nickname), "Mizuki
 * Inoue" is just "Mizuki". So this script never stores the source spelling — it
 * resolves each name to a real FIGHT_HISTORY row and stores the DB's spelling.
 *
 * WHEN IT CANNOT RESOLVE A NAME IT STOPS, IT DOES NOT GUESS.
 * The row is reported with near-miss candidates from that fighter's history and
 * left out. A missing link costs a re-run; a wrong link is a lie on the page that
 * nobody will catch, because a plausible-looking video plays.
 *
 * THE PER-FIGHTER PLAYLIST IS NOT THE WHOLE JOB — ALWAYS ALSO SEARCH DWCS
 * A fighter's "all of X's UFC fights" playlist excludes their Contender Series
 * bout, every time, even though FIGHT_HISTORY tags that bout org "UFC". Harvest
 * the playlist alone and you will be short by exactly one fight for anyone who
 * came up through DWCS, with nothing to indicate it. So after harvesting, diff
 * the result against the fighter's UFC rows and search Fight Pass for each gap as
 *     "<Fighter> vs <Opponent>"
 * which is the phrasing that ranks the individual bout first. Same applies to TUF
 * bouts, which live inside season playlists rather than as standalone videos.
 *
 * SEARCH HARD-CAPS AT 20 RESULTS AND DOES NOT PAGINATE. Scrolling adds nothing.
 * So "not in the results" means "not in the top 20 for that phrasing", NOT "does
 * not exist" — try the opponent's name alone as a second phrasing before
 * concluding a video is absent.
 *
 * WHAT IT WILL NOT CATCH
 * A link that points at the wrong fight but whose name resolves cleanly. The
 * duplicate-URL report at the end is the cheap net for that — it is how
 * video/683983 was caught being filed under two different Salkilld fights. Note
 * that a shared URL is often CORRECT: full prelim blocks legitimately cover four
 * or five bouts on a card. Check the title before deleting one.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');

// ─────────────────────────────────────────────────────────────────────────────
// Accumulated name knowledge. Every entry was confirmed against that fighter's
// FIGHT_HISTORY — right opponent AND right date — before being written down.
// Add to it as new batches turn up new spellings; that is the point of it.
// ─────────────────────────────────────────────────────────────────────────────
const ALIAS = {
  'Daniel Rodriguez|Gabe Green': 'Gabriel Green',
  'Daniel Rodriguez|Alex Velazco': 'Alex Velasco',
  'Jan Błachowicz|Glover Texeira': 'Glover Teixeira',
  'Jan Błachowicz|Pat Cummins': 'Patrick Cummins',
  'Marcin Tybura|Sergey Spivak': 'Serghei Spivac',
  'Marcin Tybura|Alexandr Romanov': 'Alexander Romanov',
  'Robert Valentin|Joey Berkenbosch': 'Joey Michael Berkenbosch',
  'Vlasto Cepo|Gianni Melillo': 'Giovanni Melillo',
  'Gilbert Urbina|Charlie Radtke': 'Charles Radtke',
  'Ludovit Klein|Mike Trizano': 'Michael Trizano',
  'Ludovit Klein|Joao Rodrigues': 'João Paulo Rodrigues',
  'Tofiq Musayev|Akiri Okada': 'Akira Okada',
  'Tofiq Musayev|Alexander Shabily': 'Alexandr Shabliy',
  'Michael Oliveira|Francisco Ataliba': 'Francisco Chagas Ataliba Junior',
  'Michael Oliveira|Elder Costa': 'Elder da Costa Dias',
  'Oban Elliott|Seok Hyun Ko': 'Seok Hyeon Ko',
  'Oban Elliott|Val Woodburn': 'Valentine Woodburn',
  'Oban Elliott|Matt Bonner': 'Matthew Bonner',
  'Oban Elliott|Madars Fleminas': 'Madars Bertholds-Fleminas',
  'Mark Vologdin|Cleiton Monteiro': 'Francisco Cleiton Monteiro',
  'Mark Vologdin|Renan Baptista': 'Renan Cesar Baptista',
  'Mark Vologdin|Samat Fayzuldaev': 'Samat Faizuldaev',
  'Mark Vologdin|Bektursun Kaipnazar uulu': 'Bektursun Kaiypnazar',
  'Mark Vologdin|Beksultan Zhunusali Uulu': 'Beksultan Zhunusali',
  'Josias Musasa|Otar Tanzilov': 'Otari Tanzilovi',
  'Josias Musasa|Mostafa El Azoumy': 'Mostafa Alazomy',
  'Dennis Buzukja|Sosian Abanokov': 'Soslan Abanokov',
  'Dennis Buzukja|Mark Gregorio Valerio': 'Mark Gregory Valerio',
  'Milos Janicic|Akbar Gadzhiekperov': 'Ekper Gadzhiekperov',
  'Noah Gugnon|Bruno Matos': 'Bruno Matos de Sousa',
  'Stephanie Luciano|Michele Oliveira': 'Michele dos Santos Oliveira',
  'Jovan Leka|Genadi Zhorzholiani': 'Genadi Jorjoliani',
  'Jovan Leka|Amiran Severni': 'Amiran Severnii',
  'Mateusz Rębecki|Diego Ferreira': 'Carlos Diego Ferreira',
  'Kyle Prepolec|Marco Antonio Elpidio': 'Marco Elpidio',
  'Mateusz Gamrot|Rafel dos Anjos': 'Rafael dos Anjos',
  'Mateusz Gamrot|Diego Ferreira': 'Carlos Diego Ferreira',
  'Mateusz Gamrot|Renato Gomes': 'Renato Gomes Gabriel',
  'Mateusz Gamrot|Rodrigo Cavalheiro': 'Rodrigo Cavalheiro Correia',
  'Billy Quarantillo|Edson Barbosa': 'Edson Barboza',
  'Amanda Lemos|Weili Zhang': 'Zhang Weili',
  'Amanda Lemos|Montserrat Conejo': 'Montserrat Ruiz',   // "Conejo" is her nickname
  'Amanda Lemos|Livinha Souza': 'Lívia Renata Souza',
  'Amanda Lemos|Mizuki Inoue': 'Mizuki',
  'Amanda Lemos|Debora Dias': 'Débora Dias Nascimento',
  'Alexia Thainara|Jeanna Ruas': 'Jeanne Ruas',
  'Guilherme Pat|Allen Frye': 'Allen Frye Jr.',
  'Guilherme Pat|Leandro Moreira': 'Leandro Moreira de Oliveira',
  'Guilherme Pat|Luis Oliveira': 'Luis Andrade de Oliveira',
  'Louie Sutherland|Matusalém dos Santos': 'Matusalem dos Santos Domingos',
  'Louie Sutherland|Pavel Dailidko': 'Pavel Dalidko',
  'Eric McConico|Baysangur Susurkaev': 'Baisangur Susurkaev',
  'Bruno Lopes|Mikheil Sanzhiniani': 'Mikheil Sazhiniani',
  'Bruno Lopes|Matias Javier': 'Matias Genes',           // Matías Javier Genes

  // UFC 330 batch, harvested from Fight Pass playlists. Note the two married-name
  // cases: Fight Pass titles the video with the name she fought under at the time,
  // the DB carries the current one. Both confirmed on date.
  'Ian Machado Garry|Gabe Green': 'Gabriel Green',
  'Jalin Turner|Josh Culibao': 'Joshua Culibao',
  'Mackenzie Dern|Nina Ansaroff': 'Nina Nunes',            // married name
  'Mackenzie Dern|Amanda Bobby Cooper': 'Amanda Cooper',
  'Gillian Robertson|Veronica Macedo': 'Veronica Hardy',   // married name
  'Chidi Njokuani|Carlos Leal': 'Carlos Leal Miranda',
  'Neil Magny|Phil Rowe': 'Philip Rowe',
  'Neil Magny|Hyun Gyu Lim': 'Lim Hyun-gyu',               // Korean name order
  'Ramiz Brahimaj|Michael Gillmore': 'Micheal Gillmore',
  'Ian Machado Garry|Lawrence Tracey': 'Lawrence Jordan Tracey',
  'Ian Machado Garry|Matt Figlak': 'Mateusz Figlak',
};

// Rows deliberately not placed, with the reason. Kept so a re-run of the same
// document does not re-raise them as if they were new unknowns.
const DROP = {
  'Jan Błachowicz|Volkan Oezdemir':
    'they never fought; the URL is the Ankalaev video pasted a second time',
  'Dennis Buzukja|Christian': 'first name only, nothing in his history matches',
  'Marina Spasic|Samara Santos': 'no Samara Santos in her history',
  'Quillan Salkilld|Anshul Jubli':
    'video/683983 is titled "Salkilld vs Gauge Young DWCS, September 3 2024" — the ' +
    'Gauge Young link pasted twice. Jubli was Feb 8 2025.',
};

// ─────────────────────────────────────────────────────────────────────────────
// name matching
// ─────────────────────────────────────────────────────────────────────────────

// exactly what the app does: lowercase, strip diacritics, nothing else
const appNorm = (n) => String(n == null ? '' : n).trim().toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '');

// Looser, for LOOKUP only — never for what gets stored. NFD does not decompose
// ł, đ, ø or ß: they are letters in their own right, not letter-plus-accent. So
// "Jan Blachowicz" and "Jan Błachowicz" stay two different people without this,
// which is how one fighter's links got split across two entries.
const XLIT = { 'ł': 'l', 'đ': 'd', 'ð': 'd', 'ø': 'o', 'ß': 'ss', 'æ': 'ae', 'œ': 'oe', 'ħ': 'h', 'ŧ': 't' };
const loose = (n) => appNorm(n).replace(/[łđðøßæœħŧ]/g, (c) => XLIT[c]).replace(/[^a-z0-9]/g, '');

// ─────────────────────────────────────────────────────────────────────────────
// index.html
// ─────────────────────────────────────────────────────────────────────────────

function readIndex() {
  try {
    return fs.readFileSync(INDEX, 'utf8');
  } catch (e) {
    // Per CLAUDE.md: ENOENT is the only tolerable read failure, and even that is
    // fatal here. An offloaded file reports EDEADLK / errno -35 from a sandbox and
    // must never be treated as "empty" — that is how a rebuild eats the database.
    throw new Error('cannot read index.html (' + e.code + '). If this is EDEADLK / ' +
      'errno -35 the file is iCloud-offloaded: open it once on the Mac and re-run.');
  }
}

/** Slice a top-level `const NAME = {...}` out of index.html by balanced braces. */
function objectSource(h, marker) {
  const i = h.indexOf(marker);
  if (i < 0) throw new Error('not found in index.html: ' + marker);
  let d = 0, k = h.indexOf('{', i);
  for (; k < h.length; k++) { if (h[k] === '{') d++; else if (h[k] === '}') { d--; if (!d) break; } }
  if (d) throw new Error('unterminated object: ' + marker);
  return { src: h.slice(i, k + 1), start: i, end: k };
}

function functionSource(h, signature) {
  const i = h.indexOf(signature);
  if (i < 0) throw new Error('not found in index.html: ' + signature);
  let d = 0, k = h.indexOf('{', i);
  for (; k < h.length; k++) { if (h[k] === '{') d++; else if (h[k] === '}') { d--; if (!d) break; } }
  return h.slice(i, k + 1);
}

function loadData(h) {
  const ctx = vm.createContext({});
  vm.runInContext(
    objectSource(h, 'const FIGHT_HISTORY = {').src + ';\n' +
    objectSource(h, 'const TAPE_STUDY = {').src + ';\n' +
    'globalThis.FH = FIGHT_HISTORY; globalThis.TS = TAPE_STUDY;', ctx);
  return { FH: ctx.FH, TS: ctx.TS };
}

// ─────────────────────────────────────────────────────────────────────────────
// parse the document
// ─────────────────────────────────────────────────────────────────────────────

const RECORD = /[–—-]\s*([^()]+?)\s+vs\s+([^()]+?)\s*\((https?:\/\/[^\s)]+)\)/g;

function cleanUrl(u) {
  return u
    .replace(/%22$/, '').replace(/["']+$/, '')       // stray quote from the copy
    .replace(/\/?%20target=$/, '')                   // half-copied anchor tag
    .replace(/[&?]pp=[^&]*/g, '')                    // YouTube search tracking
    .replace(/[&?]ab_channel=[^&]*/g, '')
    .replace(/[?&]spm=[^&]*/g, '').replace(/&debug=flv/g, '');
  // NB: &t= is deliberately kept — on a full-card upload it is the timestamp
  // that points at this fight, so dropping it loses the only useful part.
}

function parseDoc(text) {
  const order = [], byFighter = new Map();
  let m, n = 0;
  while ((m = RECORD.exec(text))) {
    n++;
    const who = m[1].replace(/\s+/g, ' ').trim();
    const opp = m[2].replace(/\s+/g, ' ').trim().replace(/\s*\(PPV\)$/i, '');
    // group on the loose key: the same fighter often appears under two spellings
    const gk = loose(who);
    if (!byFighter.has(gk)) { byFighter.set(gk, []); order.push(gk); }
    byFighter.get(gk).push({ who, opp, url: cleanUrl(m[3]) });
  }
  return { order, byFighter, count: n };
}

// ─────────────────────────────────────────────────────────────────────────────
// resolve
// ─────────────────────────────────────────────────────────────────────────────

/** Near-misses from this fighter's own history, to hand back to a human. */
function suggest(hist, name) {
  const t = loose(name);
  const last = appNorm(name).split(/\s+/).pop().replace(/[^a-z0-9]/g, '');
  return hist.filter((r) => {
    const l = loose(r.opponent);
    if (l.includes(t) || t.includes(l)) return true;
    const rl = appNorm(r.opponent).split(/\s+/).pop().replace(/[^a-z0-9]/g, '');
    return last.length > 4 && rl.length > 4 &&
      (rl.startsWith(last.slice(0, 5)) || last.startsWith(rl.slice(0, 5)));
  }).map((r) => r.opponent + ' (' + r.date + ')').join(' | ');
}

/** "UFC Fight Night: Du Plessis vs. Usman" + "Jul 18, 2026" -> "UFC Fight Night · Jul 2026" */
function eventLabel(r) {
  const name = String(r.event || r.org || '').split(':')[0].trim();
  const my = /([A-Z][a-z]{2})\s+\d+,\s*(\d{4})/.exec(String(r.date || ''));
  return name + (my ? ' · ' + my[1] + ' ' + my[2] : '');
}

function resolve({ order, byFighter }, FH, TS) {
  const fhKeys = new Map(Object.keys(FH).map((k) => [loose(k), k]));
  const out = [], problems = [];

  for (const gk of order) {
    const key = fhKeys.get(gk);
    if (!key) { problems.push(['NO FIGHTER', byFighter.get(gk)[0].who, 'no FIGHT_HISTORY entry']); continue; }
    const hist = FH[key] || [];
    const rows = [];
    // Rematches: the document runs newest-first and so does FIGHT_HISTORY, so the
    // Nth mention of an opponent is the Nth-most-recent meeting. This covers both
    // the numbered form ("Sergey Spivak 2" then "Sergey Spivak") and the plain one
    // — Błachowicz has two unnumbered "Corey Anderson" rows, five years apart.
    const nth = new Map();
    for (const { opp, url } of byFighter.get(gk)) {
      const bare = opp.replace(/\s+\d+$/, '');
      const tag = key + '|' + bare;
      if (DROP[tag]) { problems.push(['DROPPED', key, bare + ' — ' + DROP[tag]]); continue; }
      const dbName = ALIAS[tag] || bare;
      const cands = hist.map((r, i) => ({ r, i })).filter((x) => loose(x.r.opponent) === loose(dbName));
      if (!cands.length) { problems.push(['NO BOUT', key, opp + '  ->? ' + (suggest(hist, bare) || '(nothing close)')]); continue; }
      const n = nth.get(dbName) || 0;
      nth.set(dbName, n + 1);
      if (!cands[n]) { problems.push(['EXTRA', key, opp + ' — more links than meetings']); continue; }
      rows.push({ i: cands[n].i, opponent: cands[n].r.opponent, url, hist: cands[n].r });
    }
    rows.sort((a, b) => a.i - b.i);   // newest-first, same order as FIGHT_HISTORY

    // Section headers sit on the first row of a block and are null thereafter.
    let seenUFC = false, seenPre = false;
    for (const row of rows) {
      const isUFC = String(row.hist.org || '') === 'UFC';
      row.section = null;
      if (isUFC && !seenUFC) { row.section = 'UFC'; seenUFC = true; }
      else if (!isUFC && !seenPre) { row.section = 'Pre-UFC'; seenPre = true; }
      row.event = eventLabel(row.hist);
    }
    out.push({ key, gk, rows, existing: TS[key] ? TS[key].length : 0, hist });
  }
  return { out, problems };
}

// ─────────────────────────────────────────────────────────────────────────────
// emit + splice
// ─────────────────────────────────────────────────────────────────────────────

function renderBlock(out) {
  const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return out.map((f) =>
    '  ' + JSON.stringify(f.key) + ': [\n' + f.rows.map((r) =>
      '    { opponent: "' + esc(r.opponent) + '", url: "' + esc(r.url) +
      '", event: "' + esc(r.event) + '", section: ' +
      (r.section ? '"' + r.section + '"' : 'null') + ' },').join('\n') +
    '\n  ],').join('\n');
}

function splice(h, block) {
  const { start, end } = objectSource(h, 'const TAPE_STUDY = {');
  let region = h.slice(start, end + 1);

  const keys = [...block.matchAll(/^ {2}("(?:[^"\\]|\\.)*"): \[$/gm)].map((m) => m[1]);
  if (!keys.length) throw new Error('nothing to insert');

  // Replace a key that is already present rather than appending a second copy.
  // TAPE_STUDY's indentation is NOT uniform — most of it is at one space, newer
  // blocks at two — so this must not anchor on a fixed indent. Anchoring on
  // '\n  "Name": [' quietly matched nothing and left a duplicate key behind;
  // the last one wins at runtime, so it looked like it had worked.
  const replaced = [];
  for (const k of keys) {
    const open = new RegExp('\\n +' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ': \\[');
    const m = open.exec(region);
    if (!m) continue;
    const close = /\n +\],/.exec(region.slice(m.index + 1));
    if (!close) throw new Error('unterminated existing block for ' + k);
    region = region.slice(0, m.index) + region.slice(m.index + 1 + close.index + close[0].length);
    replaced.push(k);
  }

  const tail = region.lastIndexOf('\n  ],');
  if (tail < 0) throw new Error('no closing row found to append after');
  const at = tail + '\n  ],'.length;
  region = region.slice(0, at) + '\n' + block + region.slice(at);
  return { html: h.slice(0, start) + region + h.slice(end + 1), keys, replaced };
}

/**
 * Run the app's own findTapeStudyUrl over the written file. This is the check
 * that matters: it is the function the page calls, so if a row does not resolve
 * here it will not resolve for a reader either.
 */
function verify(html, keys) {
  const ctx = vm.createContext({});
  vm.runInContext(
    objectSource(html, 'const TAPE_STUDY = {').src + ';\n' +
    objectSource(html, 'const FIGHT_HISTORY = {').src + ';\n' +
    functionSource(html, 'function normalizeFighterNameForMatch(') + '\n' +
    functionSource(html, 'function findTapeStudyUrl(') + '\n' +
    'globalThis.TS = TAPE_STUDY; globalThis.FH = FIGHT_HISTORY; globalThis.F = findTapeStudyUrl;', ctx);

  let tape = 0, linked = 0;
  const short = [];
  for (const raw of keys) {
    const name = JSON.parse(raw);
    const rows = ctx.TS[name] || [];
    const hist = ctx.FH[name] || [];
    const n = hist.filter((r) => !!ctx.F(name, r.opponent, r.date)).length;
    tape += rows.length; linked += n;
    if (n !== rows.length) short.push(name + ': ' + rows.length + ' rows but ' + n + ' resolve');
  }

  const src = objectSource(html, 'const TAPE_STUDY = {').src;
  const all = [...src.matchAll(/^ +("(?:[^"\\]|\\.)*"): \[$/gm)].map((m) => m[1]);
  const seen = new Set(), dupes = [];
  for (const k of all) { if (seen.has(k)) dupes.push(k); seen.add(k); }

  return { tape, linked, short, dupes, fighters: Object.keys(ctx.TS).length };
}

// ─────────────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const doc = args.find((a) => !a.startsWith('--'));
  if (!doc) {
    console.error('usage: node scripts/place-tape-links.cjs <links.txt> [--write]');
    process.exit(2);
  }

  const h = readIndex();
  const { FH, TS } = loadData(h);
  const parsed = parseDoc(fs.readFileSync(doc, 'utf8'));
  const { out, problems } = resolve(parsed, FH, TS);

  const placed = out.reduce((n, f) => n + f.rows.length, 0);
  console.log('parsed %d records across %d fighters; placed %d\n', parsed.count, out.length, placed);

  const pad = (s, n) => String(s).padEnd(n);
  console.log(pad('fighter', 26) + 'placed  history  already');
  for (const f of out) {
    console.log(pad(f.key, 26) + String(f.rows.length).padStart(6) +
      String(f.hist.length).padStart(9) + String(f.existing).padStart(9));
  }

  console.log('\nunplaced rows (%d):', problems.length);
  for (const p of problems) console.log('  ' + pad(p[0], 11) + pad(p[1], 22) + p[2]);

  // Shared URLs: often correct (a prelim block covers several bouts), sometimes a
  // copy-paste slip. Reported, never auto-resolved — the title on the page decides.
  const bySame = new Map();
  for (const f of out) for (const r of f.rows) {
    if (!bySame.has(r.url)) bySame.set(r.url, []);
    bySame.get(r.url).push(f.key + ' vs ' + r.opponent);
  }
  const shared = [...bySame].filter(([, v]) => v.length > 1);
  console.log('\nURLs covering more than one bout (%d) — check the video title before ' +
    'assuming an error, full prelim blocks legitimately do this:', shared.length);
  for (const [u, v] of shared) console.log('  ' + u + '\n     ' + v.join('\n     '));

  const unresolved = problems.filter((p) => p[0] !== 'DROPPED');
  if (!write) {
    console.log('\nreport only — re-run with --write to apply');
    if (unresolved.length) process.exitCode = 1;
    return;
  }
  if (unresolved.length) {
    console.log('\nrefusing to write: %d row(s) did not resolve. Add them to ALIAS (or ' +
      'DROP, with a reason) and re-run.', unresolved.length);
    process.exit(1);
  }

  const { html, keys, replaced } = splice(h, renderBlock(out));
  const v = verify(html, keys);
  if (v.short.length || v.dupes.length) {
    console.log('\nNOT WRITTEN — verification failed:');
    v.short.forEach((s) => console.log('  ' + s));
    v.dupes.forEach((d) => console.log('  duplicate key: ' + d));
    process.exit(1);
  }
  fs.writeFileSync(INDEX, html);
  console.log('\nwrote %d fighters / %d rows (%d replaced an existing block)',
    keys.length, v.tape, replaced.length);
  console.log('verified: all %d rows resolve through findTapeStudyUrl; ' +
    'TAPE_STUDY now holds %d fighters', v.linked, v.fighters);
}

if (require.main === module) main();
module.exports = { parseDoc, loose, cleanUrl, eventLabel, ALIAS, DROP };
