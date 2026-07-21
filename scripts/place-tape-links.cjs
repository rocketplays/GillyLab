#!/usr/bin/env node
/**
 * place-tape-links.cjs — turn a hand-sourced list of fight links into TAPE_STUDY
 * entries in index.html.
 *
 *     node scripts/place-tape-links.cjs links.txt            # report only
 *     node scripts/place-tape-links.cjs links.txt --write    # apply + verify
 *     node scripts/place-tape-links.cjs --gaps <event-slug>  # PASS 2 checklist
 *
 * A sweep is NOT DONE until --gaps prints nothing it can still find. Run it after
 * every --write; it lists the UFC bouts on that card with no video yet and the
 * exact search phrasing to use for each.
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
 * ── THE HARVEST IS TWO PASSES, NOT ONE. THIS IS THE RULE. ───────────────────
 *
 * PASS 1  the fighter's PLAYLIST. Do not substitute a plain name search for this.
 *         Search results hard-cap at 20 and are relevance-ranked, so for anyone
 *         with a long career the search silently returns a partial career and the
 *         gaps look like absences. Measured: name-search gave Gastelum 20 of 24,
 *         Blaydes 16 of 18, Tim Elliott 15 of 21; their playlists had all of them.
 *         Getting to the playlist needs the PLAYLIST filter on /search — and the
 *         filter only takes if you click the LABEL TEXT, not the checkbox box.
 * PASS 2  diff what you got against their org=="UFC" rows in FIGHT_HISTORY, and
 *         search Fight Pass for every gap individually.
 *
 * Pass 2 is not optional and not a tidy-up. Measured on the UFC 330 card: the 19
 * playlists left 24 UFC bouts unlinked, and targeted search recovered 6 of them,
 * including fights that were in the library the whole time. The playlists are
 * CURATED AND INCOMPLETE — they are not merely lagging, so waiting does nothing.
 * Two structural blind spots guaranteed to need pass 2:
 *
 *   - CONTENDER SERIES. A fighter's UFC playlist NEVER contains their DWCS bout,
 *     though FIGHT_HISTORY tags it org "UFC". Anyone who came up through DWCS is
 *     short exactly one fight, silently.
 *   - TUF bouts, which live inside season playlists, not as standalone videos.
 *
 * SEARCH MECHANICS, learned the hard way:
 *   - "<Fighter> vs <Opponent>" ranks the individual bout first. The opponent's
 *     name alone does not. Use the first form, fall back to the second.
 *   - Results HARD-CAP AT 20 and do not paginate; scrolling adds nothing. So a
 *     miss means "not in the top 20 for that phrasing", NOT "does not exist".
 *     Try both phrasings before concluding a video is absent.
 *   - MATCH ON THE OPPONENT'S FULL NAME, NEVER THE SURNAME. Searching Jasudavicius
 *     vs "Karine Silva" surname-matched the "Mayra Bueno Silva" video — a
 *     different fight, already placed. That would have written a confidently
 *     wrong link. Require first AND last name in the title.
 *
 * ── REMATCHES: THE SCRIPT WILL NOT GUESS, AND NEITHER SHOULD YOU ───────────
 * When a fighter met an opponent N times and the input supplies fewer than N
 * links, WHICH meeting a video belongs to is not derivable from ordering. The
 * script used to assume "Nth mention = Nth-most-recent meeting" and that put
 * three confidently wrong links on live profiles before it was caught:
 *
 *   video/437012  is "Rodrigues vs Ferreira UFC 283, Jan 21 2023"   -> filed on
 *                 their Mar 2026 rematch
 *   Z6lRqRBFxi0   is "Gamrot vs Norman Parke 1 | KSW 53" — a free fight of the
 *                 FIRST meeting released before KSW 53, i.e. KSW 39, May 2017
 *                 -> filed on KSW 40, Oct 2017
 *   aimp8cHDyVw   is "JUNGLE FIGHT 85" = Jan 2016 -> filed on JF 88, Jun 2016
 *
 * None of them looked wrong. The event label the script writes is exactly what
 * findTapeStudyUrl matches a history row on, so a mislabelled row does not fail
 * to link — it links to the wrong fight, silently.
 *
 * Now the script REFUSES these and asks you to pin the meeting:
 *     – Fighter vs Opponent @2023          (year)
 *     – Fighter vs Opponent @2016-01       (year-month, for two meetings in one year)
 * Get the real date from the video itself, both of which work logged out:
 *     Fight Pass  ufcfightpass.com/video/<bare-id>       -> og:description has it
 *     YouTube     youtube.com/oembed?url=<url>&format=json -> title names the event
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

  // Aug 22 2026 card. The Korean names are surname-first in the DB and given-name
  // first on Fight Pass, which no normaliser can bridge — they need spelling out.
  'Anthony Hernandez|Jun Young Park': 'Park Jun-yong',
  'Gregory Rodrigues|Junyong Park': 'Park Jun-yong',
  'Kennedy Nzechukwu|Da-un Jung': 'Jung Da-un',
  'Elise Reed|Loopy Godinez': 'Lupita Godinez',      // "Loopy" is her nickname

  // Aug 29 / Sep 5 / Sep 12 2026 cards
  'Michael Page|Shara Magomedov': 'Sharabutdin Magomedov',
  'Regina Tarin|Luisa Cifuentes': 'Luisa Fernanda Cifuentes',
  'Regina Tarin|Citalli Alcantar': 'Citlalli Alcantar',
  'Song Yadong|Bharat Kandare': 'Bharat Khandare',
  'Denise Gomes|Rayanne Amanda': 'Rayanne dos Santos',
  'Alexa Grasso|Ji Yeon Kim': 'Kim Ji-yeon',        // surname-first in the DB
  'JJ Aldrich|Chan-Mi Jeon': 'Jeon Chan-mi',        // surname-first in the DB
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
    // How many links did the input supply per opponent? Needed to spot the
    // one-video-two-meetings case before it silently picks the wrong meeting.
    const supplied = new Map();
    for (const { opp } of byFighter.get(gk)) {
      const b = opp.replace(/\s*@\d{4}\s*$/, '').replace(/\s+\d+$/, '');
      supplied.set(loose(b), (supplied.get(loose(b)) || 0) + 1);
    }

    const nth = new Map();
    for (const { opp, url } of byFighter.get(gk)) {
      // "Opponent @2023" or, when two meetings fall in the SAME year (Lemos met
      // Mayra Cantuária twice in 2016), "Opponent @2016-01".
      const pm = /@(\d{4})(?:-(\d{2}))?\s*$/.exec(opp) || [];
      const pin = pm[1], pinMonth = pm[2];
      const bare = opp.replace(/\s*@\d{4}(?:-\d{2})?\s*$/, '').replace(/\s+\d+$/, '');
      const tag = key + '|' + bare;
      if (DROP[tag]) { problems.push(['DROPPED', key, bare + ' — ' + DROP[tag]]); continue; }
      const dbName = ALIAS[tag] || bare;
      const cands = hist.map((r, i) => ({ r, i })).filter((x) => loose(x.r.opponent) === loose(dbName));
      if (!cands.length) { problems.push(['NO BOUT', key, opp + '  ->? ' + (suggest(hist, bare) || '(nothing close)')]); continue; }

      // AMBIGUOUS REMATCH. They met more times than we have links for, so which
      // meeting this video belongs to is NOT derivable from ordering — and the
      // event label we write from the chosen row is what findTapeStudyUrl matches
      // on, so guessing here puts a confidently wrong link on the profile. It did:
      // video/437012 is "Rodrigues vs Ferreira UFC 283, January 21 2023" and got
      // filed against their March 2026 rematch. Pin it with "Opponent @YYYY" after
      // reading the year off ufcfightpass.com/video/<id> (public, no login).
      if (!pin && cands.length > 1 && (supplied.get(loose(bare)) || 0) < cands.length) {
        problems.push(['AMBIGUOUS', key, bare + ' — ' + (supplied.get(loose(bare)) || 0) +
          ' link(s) for ' + cands.length + ' meetings (' + cands.map((x) => x.r.date).join(' / ') +
          '). Check ' + url + ' and pin the year: "' + bare + ' @YYYY"']);
        continue;
      }

      let chosen;
      if (pin) {
        const MON = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
          Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
        const matches = cands.filter((x) => {
          const d = String(x.r.date);
          if (!d.includes(pin)) return false;
          if (!pinMonth) return true;
          return MON[(d.match(/^([A-Z][a-z]{2})/) || [])[1]] === pinMonth;
        });
        if (!matches.length) { problems.push(['BAD PIN', key, bare + ' @' + pin + (pinMonth ? '-' + pinMonth : '') + ' — no meeting then']); continue; }
        if (matches.length > 1) { problems.push(['BAD PIN', key, bare + ' @' + pin + ' matches ' + matches.length + ' meetings (' + matches.map((x) => x.r.date).join(' / ') + ') — add the month, "@YYYY-MM"']); continue; }
        chosen = matches[0];
      } else {
        const n = nth.get(dbName) || 0;
        nth.set(dbName, n + 1);
        if (!cands[n]) { problems.push(['EXTRA', key, opp + ' — more links than meetings']); continue; }
        chosen = cands[n];
      }
      rows.push({ i: chosen.i, opponent: chosen.r.opponent, url, hist: chosen.r });
    }
    rows.sort((a, b) => a.i - b.i);   // newest-first, same order as FIGHT_HISTORY

    // Section headers sit on the first row of each block and are null thereafter.
    //
    // This used to emit "UFC" on the first UFC row and "Pre-UFC" on the first
    // non-UFC row and nothing else, which assumes a career is one UFC block above
    // one pre-UFC block. 523 fighters are not that shape — they go UFC, elsewhere,
    // UFC again — and the "Pre-UFC" header was then inherited by an entire earlier
    // UFC stint. Neil Magny's 2013-15 run and Nikita Krylov's 2013-16 run both
    // rendered under "Pre-UFC". Emit a header at EVERY transition instead.
    //
    // And classify on the EVENT NAME, not org: 957 FIGHT_HISTORY rows sit on an
    // unmistakably UFC event with org "DWCS" or blank. DWCS / Road to UFC / TUF
    // prelim rounds are deliberately not UFC — they are the route in — but a TUF
    // *Finale* is. See scripts/fix-tape-sections.cjs, which repairs existing rows.
    const PROPER_UFC = /^UFC\b|^Noche UFC|^VeChain UFC|^UFC on |Ultimate Fighter[^·]*Finale/i;
    const NOT_UFC_ROUTE = /Contender Series|^DWCS|Road to UFC|Ultimate Fighter(?![^·]*Finale)/i;
    let prevUFC = null;
    for (const row of rows) {
      row.event = eventLabel(row.hist);
      const e = row.event;
      const isUFC = NOT_UFC_ROUTE.test(e) ? false
        : (PROPER_UFC.test(e) || String(row.hist.org || '') === 'UFC');
      row.section = (prevUFC === null || isUFC !== prevUFC) ? (isUFC ? 'UFC' : 'Pre-UFC') : null;
      prevUFC = isUFC;
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

/**
 * PASS 2. Lists every org=="UFC" bout on a card that has no video yet, using the
 * app's own findTapeStudyUrl so it agrees with what a reader actually sees.
 * DWCS bouts are called out because a fighter's playlist never contains theirs.
 */
function gapsFor(slug) {
  const h = readIndex();
  const ctx = vm.createContext({});
  vm.runInContext(
    objectSource(h, 'const TAPE_STUDY = {').src + ';\n' +
    objectSource(h, 'const FIGHT_HISTORY = {').src + ';\n' +
    functionSource(h, 'function normalizeFighterNameForMatch(') + '\n' +
    functionSource(h, 'function findTapeStudyUrl(') + '\n' +
    'globalThis.TS = TAPE_STUDY; globalThis.FH = FIGHT_HISTORY; globalThis.F = findTapeStudyUrl;', ctx);

  const feed = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/event.json'), 'utf8'));
  const ev = (feed.data || []).find((e) => e.slug === slug);
  if (!ev) throw new Error('no such event in data/event.json: ' + slug);

  const names = [];
  for (const b of ev.bouts || []) for (const f of b.fighters || []) {
    const n = ctx.FH[f.fighterName] ? f.fighterName
      : String(f.fighterName).normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (!names.includes(n)) names.push(n);
  }

  let total = 0, dwcs = 0;
  console.log('%s — pass 2 checklist\n', slug);
  for (const n of names) {
    const miss = (ctx.FH[n] || []).filter((r) => String(r.org || '') === 'UFC' && !ctx.F(n, r.opponent, r.date));
    if (!miss.length) continue;
    console.log('  ' + n);
    for (const r of miss) {
      total++;
      const isD = /contender|dwcs/i.test(r.event || '');
      if (isD) dwcs++;
      console.log('      search: "' + n + ' vs ' + r.opponent + '"   (' + r.date + ')' + (isD ? '   [DWCS]' : ''));
    }
  }
  console.log('\n%d bout(s) with no video, %d of them DWCS.', total, dwcs);
  if (!total) console.log('Card is complete.');
  else console.log('Fall back to the opponent name alone if the first phrasing misses; ' +
    'results cap at 20 and do not paginate, so one miss is not proof of absence.');
}

function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const gi = args.indexOf('--gaps');
  if (gi >= 0) return gapsFor(args[gi + 1]);
  const doc = args.find((a) => !a.startsWith('--'));
  if (!doc) {
    console.error('usage: node scripts/place-tape-links.cjs <links.txt> [--write]');
    console.error('       node scripts/place-tape-links.cjs --gaps <event-slug>');
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
