#!/usr/bin/env node
'use strict';
/**
 * Fill in "opponent's record at time of fight" for opponents who have no
 * FIGHT_HISTORY profile of their own — the DWCS-newcomer / regional-fighter
 * case where index.html's opponentRecordAtFight() currently has nothing to
 * show, because it can only look inside our own FIGHT_HISTORY.
 *
 * Source: Sherdog's Fight Finder. For each fighter passed on the command line
 * (or, with no args, every fighter on an upcoming event in data/event.json),
 * this walks their FIGHT_HISTORY rows, finds opponents who are NOT themselves
 * a FIGHT_HISTORY key, and looks each one up:
 *
 *   1. Search Sherdog's fightfinder for the opponent's name.
 *   2. Exactly one result -> use it.
 *   3. Multiple results (common — regional MMA has a lot of name collisions,
 *      confirmed live: searching "Hunter Smith" returns three different
 *      fighters) -> fetch each candidate's own Sherdog fight history and look
 *      for a listed fight against OUR fighter within ~45 days of the date we
 *      already have. Sherdog independently listing the same two names on
 *      close dates is a mutual cross-check, not a guess — verified live on
 *      Elliot Hebert, whose Sherdog page lists both fights against Hunter
 *      Smith on the exact dates our own FIGHT_HISTORY has.
 *   4. No result, or multiple results with no confirming cross-check -> leave
 *      unresolved (logged, not guessed). A wrong record is worse than no badge.
 *
 * Once resolved, the opponent's PRO fight list (Sherdog separates pro/amateur;
 * amateur bouts are excluded to match how our own FIGHT_HISTORY/computeRecord
 * only ever counts pro fights) is tallied for everything strictly before the
 * bout date, same math as index.html's recordAsOf().
 *
 * Results cache to data/opponent-record-cache.json, keyed by
 * "<normalized opponent name>|<date>" so a name is never re-fetched once
 * resolved (or once conclusively marked unresolved-ambiguous / not-found —
 * only network *errors* get retried on the next run).
 *
 * The parsers (parseSearchResults, parseFighterHistory, recordAsOfFromHistory,
 * findMutualConfirmation) are pure and unit-tested in
 * scripts/test-opponent-records.cjs against real Sherdog HTML fixtures. Only
 * main() touches the network.
 *
 * Usage:
 *   node scripts/fetch-opponent-records.cjs "Hunter Smith" "Adam Livingston"
 *   node scripts/fetch-opponent-records.cjs            # scans data/event.json's upcoming cards
 *   node scripts/fetch-opponent-records.cjs --dry-run "Hunter Smith"
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const INDEX_PATH = path.join(ROOT, 'index.html');
const EVENT_PATH = path.join(ROOT, 'data', 'event.json');
const CACHE_PATH = path.join(ROOT, 'data', 'opponent-record-cache.json');

// ── name normalization (matches index.html's _newsNorm convention) ─────────
function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
// Sherdog's own search index doesn't match diacritics against their unaccented
// form -- confirmed live: searching "Hugo Oyarzún" returns 0 results, "Hugo
// Oyarzun" (no accent) returns 1. Used only as a fallback *query* string (kept
// separate from norm() above, which is for comparing/keying, not searching).
function stripDiacritics(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// ── FIGHT_HISTORY extraction (brace-match; same convention as
// gen-sixdegrees-data.cjs — a narrow regex silently truncates this) ─────────
function readFightHistory(indexHtml) {
  const i = indexHtml.indexOf('const FIGHT_HISTORY');
  if (i < 0) throw new Error('FIGHT_HISTORY not found in index.html');
  const s = indexHtml.indexOf('{', i);
  let d = 0, e = s;
  for (; e < indexHtml.length; e++) {
    const c = indexHtml[e];
    if (c === '{') d++;
    else if (c === '}') { d--; if (!d) { e++; break; } }
  }
  return eval('(' + indexHtml.slice(s, e) + ')');   // trusted local source
}

/**
 * @param {object} FH  FIGHT_HISTORY object.
 * @param {string[]} fighterNames  Fighters to scan (must be exact FH keys).
 * @returns {Array<{fighter:string, opponent:string, date:string}>} every
 *   (fighter, opponent, date) triple where the opponent has no FH key of
 *   their own — i.e. no existing profile to compute a record from.
 */
function untrackedOpponentsFor(FH, fighterNames) {
  const keys = new Set(Object.keys(FH));
  const out = [];
  for (const name of fighterNames) {
    const fights = FH[name] || [];
    for (const f of fights) {
      if (f && f.opponent && f.date && !keys.has(f.opponent)) {
        out.push({ fighter: name, opponent: f.opponent, date: f.date });
      }
    }
  }
  return out;
}

// ── Sherdog HTML parsers (pure) ─────────────────────────────────────────────
// Search results table: <table class="new_table fightfinder_result">...
// one <tr> per candidate, second <td> holds <a href="/fighter/Name-12345">Name</a>.
function parseSearchResults(html) {
  const tIdx = html.indexOf('fightfinder_result');
  if (tIdx < 0) return [];
  const tblStart = html.lastIndexOf('<table', tIdx);
  const tblEnd = html.indexOf('</table>', tIdx);
  if (tblStart < 0 || tblEnd < 0) return [];
  const tbl = html.slice(tblStart, tblEnd);
  const re = /<a\s+href="(\/fighter\/[^"]+)">([^<]+)<\/a>/g;
  const seen = new Set();
  const out = [];
  let m;
  while ((m = re.exec(tbl))) {
    const url = 'https://www.sherdog.com' + m[1];
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({ name: m[2].trim(), url });
  }
  return out;
}

// Fighter profile: two "new_table fighter" tables in DOM order — PRO first,
// AMATEUR second (confirmed live on multiple profiles; Sherdog always lists
// PRO history before AMATEUR history when both exist). Row shape:
//   <td><span class="final_result loss">loss</span></td>
//   <td><a href="/fighter/Opponent-Id">Opponent Name</a></td>
//   <td><a href="/events/...">Event Name</a><br><span class="sub_line">Mon / DD / YYYY</span>...</td>
function parseFightTable(tableHtml) {
  const rows = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let rm;
  let first = true;
  while ((rm = rowRe.exec(tableHtml))) {
    if (first) { first = false; continue; }   // header row
    const row = rm[1];
    const resultM = /final_result\s+(\w+)"[^>]*>([^<]*)</.exec(row);
    const oppM = /<a\s+href="(\/fighter\/[^"]+)">([^<]+)<\/a>/.exec(row);
    const dateM = /<span class="sub_line">([^<]+)<\/span>/.exec(row);
    if (!resultM || !oppM) continue;
    const result = resultM[1].toLowerCase();
    const dateStr = dateM ? dateM[1].trim() : null;   // "Mar / 07 / 2026"
    const iso = dateStr ? isoFromSherdogDate(dateStr) : null;
    rows.push({
      result: result === 'win' ? 'W' : result === 'loss' ? 'L' : result === 'draw' ? 'D' : result.toUpperCase(),
      opponent: oppM[2].trim(),
      opponentUrl: 'https://www.sherdog.com' + oppM[1],
      date: iso,
    });
  }
  return rows;
}
// Parse a date string to a UTC midnight timestamp, regardless of which of the
// two formats this script mixes: Sherdog's converted "YYYY-MM-DD" and our own
// FIGHT_HISTORY's "Mon D, YYYY". Bare Date.parse() is NOT safe here — it
// treats "YYYY-MM-DD" as UTC midnight but "Mon D, YYYY" as LOCAL midnight, so
// on any non-UTC runner (verified live: America/Phoenix is UTC-7) the two
// formats disagree by hours and silently shift which side of a date boundary
// a fight lands on. Confirmed this caused a real off-by-one: Hunter Smith's
// own win over Elliot Hebert on the target date was being counted as "before"
// itself, inflating his record-entering-that-fight by one win (8-1-0 instead
// of the correct 7-1-0).
const MONTHS3 = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
function parseDateUTC(s) {
  const str = String(s || '').trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
  m = /^([A-Za-z]{3,9})\s+(\d{1,2}),?\s*(\d{4})$/.exec(str);
  if (m) {
    const mon = MONTHS3[m[1].slice(0, 3).toLowerCase()];
    if (mon != null) return Date.UTC(+m[3], mon, +m[2]);
  }
  const t = Date.parse(str);
  return isFinite(t) ? t : NaN;
}

function isoFromSherdogDate(s) {
  // "Mar / 07 / 2026" -> "2026-03-07"
  const m = /^([A-Za-z]{3})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})$/.exec(String(s).trim());
  if (!m) return null;
  const MONTHS = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
  const mo = MONTHS[m[1]];
  if (!mo) return null;
  return m[3] + '-' + mo + '-' + m[2].padStart(2, '0');
}

/**
 * @param {string} html  Full Sherdog fighter profile page HTML.
 * @returns {{pro: Array, amateur: Array}}
 */
function parseFighterHistory(html) {
  const tables = [];
  const re = /<table\s+class="new_table fighter"[^>]*>([\s\S]*?)<\/table>/g;
  let m;
  while ((m = re.exec(html))) tables.push(m[1]);
  return {
    pro: tables[0] ? parseFightTable(tables[0]) : [],
    amateur: tables[1] ? parseFightTable(tables[1]) : [],
  };
}

/**
 * Record entering `dateStr`, from a PRO fight list (as returned by
 * parseFighterHistory), tallying every fight strictly before that date.
 * Mirrors index.html's recordAsOf() exactly.
 */
function recordAsOfFromHistory(proFights, dateStr) {
  const target = parseDateUTC(dateStr);
  if (!isFinite(target)) return null;
  let w = 0, l = 0, d = 0;
  for (const f of proFights) {
    if (!f.date) continue;
    const fd = parseDateUTC(f.date);
    if (!isFinite(fd) || fd >= target) continue;
    if (f.result === 'W') w++;
    else if (f.result === 'L') l++;
    else if (f.result === 'D') d++;
  }
  return w + '-' + l + '-' + d;
}

/**
 * Does this candidate's own PRO fight list independently list a bout against
 * `ourFighterName` within `toleranceDays` of `approxDateStr`? If so, Sherdog's
 * own data mutually confirms this is the right person — not a guess.
 * @returns {object|null} the matching fight row, or null.
 */
/**
 * Find the single fight in `proFights` within `toleranceDays` of `dateStr`,
 * with NO regard to opponent-name spelling. This is deliberately more
 * robust than name matching: confirmed live that our FIGHT_HISTORY's "Mike
 * Murphy" is Sherdog's own "Micheal Murphy" -- an exact (or even fuzzy) name
 * match would miss that pairing entirely, but a fighter only has one bout on
 * a given date, so the date alone is an unambiguous key on THEIR OWN page.
 * Returns null (not a guess) if zero or more than one fight falls in the
 * window -- multiple hits would mean the tolerance is too loose for this
 * fighter's schedule, and this function should never pick between them.
 */
function findRowNearDate(proFights, dateStr, toleranceDays) {
  const tol = (toleranceDays == null ? 2 : toleranceDays) * 864e5;
  const target = parseDateUTC(dateStr);
  if (!isFinite(target)) return null;
  const matches = proFights.filter((f) => {
    if (!f.date) return false;
    const fd = parseDateUTC(f.date);
    return isFinite(fd) && Math.abs(fd - target) <= tol;
  });
  return matches.length === 1 ? matches[0] : null;
}

function findMutualConfirmation(proFights, ourFighterName, approxDateStr, toleranceDays) {
  const tol = (toleranceDays == null ? 45 : toleranceDays) * 864e5;
  const target = parseDateUTC(approxDateStr);
  const wantName = norm(ourFighterName);
  for (const f of proFights) {
    if (norm(f.opponent) !== wantName) continue;
    if (!isFinite(target) || !f.date) return f;   // no date to compare — name match alone
    const fd = parseDateUTC(f.date);
    if (isFinite(fd) && Math.abs(fd - target) <= tol) return f;
  }
  return null;
}

// ── network (CI / live only) ────────────────────────────────────────────────
const UA = 'Mozilla/5.0 (compatible; GillyLab-opponent-records/1.0; +https://github.com/rocketplays/GillyLab)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function httpGet(url, redirects) {
  redirects = redirects || 0;
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('too many redirects'));
    https.get(url, { headers: { 'User-Agent': UA, 'Accept': 'text/html' } }, (r) => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
        r.resume();
        return resolve(httpGet(r.headers.location, redirects + 1));
      }
      let body = '';
      r.on('data', (c) => (body += c));
      r.on('end', () => resolve({ status: r.statusCode, body }));
    }).on('error', reject);
  });
}
async function getWithRetry(url, attempts) {
  attempts = attempts || 3;
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const { status, body } = await httpGet(url);
      if (status === 200) return body;
      lastErr = new Error('HTTP ' + status);
    } catch (e) { lastErr = e; }
    await sleep(1200 * (i + 1));
  }
  throw lastErr;
}

/**
 * Resolve one opponent to a record-as-of-date, or a reason it couldn't be.
 * @returns {{status:'resolved', record:string, url:string, method:'single'|'cross-check'}
 *          |{status:'ambiguous', candidates:string[]}
 *          |{status:'not-found'}
 *          |{status:'error', message:string}}
 */
async function searchSherdog(name) {
  const searchUrl = 'https://www.sherdog.com/stats/fightfinder?SearchTxt=' + encodeURIComponent(name);
  const html = await getWithRetry(searchUrl);
  return parseSearchResults(html);
}

/**
 * Strategy 1 (tried before any name search): read the bout directly off OUR
 * fighter's own Sherdog page, via findRowNearDate. Requires our fighter's own
 * name to resolve to exactly one Sherdog profile -- if it's ambiguous or not
 * found, this strategy simply declines (returns null) rather than guessing,
 * and resolveOpponent falls back to searching the opponent's name instead.
 */
async function resolveViaFighterOwnPage(ourFighterName, opponentName, dateStr) {
  const ourCandidates = await searchSherdog(ourFighterName);
  if (ourCandidates.length !== 1) return null;
  await sleep(700);
  const ownHtml = await getWithRetry(ourCandidates[0].url);
  const ownHist = parseFighterHistory(ownHtml);
  const row = findRowNearDate(ownHist.pro, dateStr, 2);
  if (!row || !row.opponentUrl) return null;
  await sleep(700);
  const oppHtml = await getWithRetry(row.opponentUrl);
  const oppHist = parseFighterHistory(oppHtml);
  const record = recordAsOfFromHistory(oppHist.pro, dateStr);
  if (record == null) return null;
  return { status: 'resolved', record, url: row.opponentUrl, method: 'own-page', sherdogOpponentName: row.opponent };
}

async function resolveOpponent(opponentName, ourFighterName, dateStr) {
  try {
    const viaOwn = await resolveViaFighterOwnPage(ourFighterName, opponentName, dateStr);
    if (viaOwn) return viaOwn;
  } catch (e) {
    // Fall through to the name-search strategies below -- a failure here
    // (network error, our fighter's own page unparseable, etc.) shouldn't
    // sink the whole lookup when the opponent-name search might still work.
  }

  let candidates;
  try {
    candidates = await searchSherdog(opponentName);
    // Sherdog's search index doesn't match diacritics (confirmed live: "Hugo
    // Oyarzún" -> 0 results, "Hugo Oyarzun" -> 1). Retry once, unaccented,
    // before giving up -- only when the accented query itself found nothing.
    if (!candidates.length) {
      const stripped = stripDiacritics(opponentName);
      if (stripped !== opponentName) {
        await sleep(700);
        candidates = await searchSherdog(stripped);
      }
    }
  } catch (e) {
    return { status: 'error', message: 'search: ' + e.message };
  }
  if (!candidates.length) return { status: 'not-found' };

  if (candidates.length === 1) {
    try {
      await sleep(700);
      const html = await getWithRetry(candidates[0].url);
      const hist = parseFighterHistory(html);
      const record = recordAsOfFromHistory(hist.pro, dateStr);
      if (record == null) return { status: 'error', message: 'unparseable date' };
      return { status: 'resolved', record, url: candidates[0].url, method: 'single' };
    } catch (e) {
      return { status: 'error', message: 'profile: ' + e.message };
    }
  }

  // Multiple candidates — try to confirm via a mutual fight listing before
  // giving up. Capped at 10 to bound worst-case fetches on a very common
  // name; this is now the last-resort path since resolveViaFighterOwnPage
  // above already handles the common case (including name-spelling
  // mismatches that this name-based check can't catch at all).
  for (const cand of candidates.slice(0, 10)) {
    try {
      await sleep(700);
      const html = await getWithRetry(cand.url);
      const hist = parseFighterHistory(html);
      const confirmed = findMutualConfirmation(hist.pro, ourFighterName, dateStr);
      if (confirmed) {
        const record = recordAsOfFromHistory(hist.pro, dateStr);
        return { status: 'resolved', record, url: cand.url, method: 'cross-check' };
      }
    } catch (e) {
      // one candidate erroring shouldn't abort the whole disambiguation pass
      continue;
    }
  }
  return { status: 'ambiguous', candidates: candidates.map((c) => c.url) };
}

// ── main ─────────────────────────────────────────────────────────────────
function fightersFromEventJson() {
  if (!fs.existsSync(EVENT_PATH)) return [];
  const doc = JSON.parse(fs.readFileSync(EVENT_PATH, 'utf8'));
  const now = Date.now();
  const names = new Set();
  for (const evt of doc.data || []) {
    if (evt.status === 'completed') continue;
    const t = Date.parse(evt.startsAt || '');
    if (isFinite(t) && t < now - 864e5) continue;
    for (const b of evt.bouts || []) {
      for (const f of b.fighters || []) {
        if (f && f.fighterName) names.add(f.fighterName);
      }
    }
  }
  return [...names];
}

// Parse "--time-budget-ms 480000" style flags out of argv.
function flagValue(args, name) {
  const i = args.indexOf(name);
  if (i < 0 || i + 1 >= args.length) return null;
  const v = Number(args[i + 1]);
  return isFinite(v) ? v : null;
}

async function main() {
  const args = process.argv.slice(2);
  const DRY = args.includes('--dry-run');
  // Bounds how long one invocation runs (this script is meant to be re-run
  // repeatedly -- each run picks up exactly where the cache left off, since
  // already-resolved/ambiguous/not-found entries are skipped). Without a
  // budget, a large batch (e.g. every fighter on every upcoming card) can run
  // well past any reasonable single-process timeout.
  const timeBudgetMs = flagValue(args, '--time-budget-ms');
  const maxLookups = flagValue(args, '--max');
  // By default, only 'error' entries are retried (network hiccups). These
  // flags additionally reopen entries that resolved without error but
  // couldn't be confidently answered -- useful after a resolution-strategy
  // improvement (like adding resolveViaFighterOwnPage), to re-attempt exactly
  // the entries that might now succeed, without re-touching everything else.
  const retryAmbiguous = args.includes('--retry-ambiguous');
  const retryNotFound = args.includes('--retry-not-found');
  const explicit = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--time-budget-ms' && args[i - 1] !== '--max');
  const fighterNames = explicit.length ? explicit : fightersFromEventJson();
  if (!fighterNames.length) {
    console.log('[opponent-records] no fighters to scan (no CLI args and no upcoming events)');
    return;
  }

  const indexHtml = fs.readFileSync(INDEX_PATH, 'utf8');
  const FH = readFightHistory(indexHtml);
  const targets = untrackedOpponentsFor(FH, fighterNames.filter((n) => FH[n]));
  const skippedFighters = fighterNames.filter((n) => !FH[n]);
  if (skippedFighters.length) {
    console.log('[opponent-records] no FIGHT_HISTORY for: ' + skippedFighters.join(', '));
  }

  let cache = {};
  if (fs.existsSync(CACHE_PATH)) cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
  const writeCache = () => { if (!DRY) fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 1)); };

  const startedAt = Date.now();
  const stats = { resolved: 0, ambiguous: 0, notFound: 0, error: 0, skipped: 0 };
  let processed = 0;
  let stoppedEarly = false;
  for (const t of targets) {
    const key = norm(t.opponent) + '|' + t.date;
    const existing = cache[key];
    const reopenable = existing && (
      existing.status === 'error' ||
      (retryAmbiguous && existing.status === 'ambiguous') ||
      (retryNotFound && existing.status === 'not-found')
    );
    if (existing && !reopenable) { stats.skipped++; continue; }

    if (timeBudgetMs != null && Date.now() - startedAt > timeBudgetMs) { stoppedEarly = true; break; }
    if (maxLookups != null && processed >= maxLookups) { stoppedEarly = true; break; }
    processed++;

    await sleep(700);
    const result = await resolveOpponent(t.opponent, t.fighter, t.date);
    cache[key] = Object.assign({ opponent: t.opponent, fighter: t.fighter, date: t.date, checkedAt: new Date().toISOString() }, result);
    // Write after every lookup, not just at the end -- a lookup can involve
    // several network round-trips (ambiguous names re-fetch up to 6
    // candidate profiles), so losing an in-progress run should cost at most
    // one lookup's work, not the whole batch.
    writeCache();

    if (result.status === 'resolved') stats.resolved++;
    else if (result.status === 'ambiguous') stats.ambiguous++;
    else if (result.status === 'not-found') stats.notFound++;
    else stats.error++;

    const tag = result.status === 'resolved' ? `${result.record} (${result.method})` : result.status;
    console.log(`[opponent-records] ${t.opponent} vs ${t.fighter} @ ${t.date} -> ${tag}`);
  }

  const remaining = targets.length - stats.skipped - processed;
  console.log(`[opponent-records] done: ${stats.resolved} resolved, ${stats.ambiguous} ambiguous, ${stats.notFound} not-found, ${stats.error} errors, ${stats.skipped} already cached (of ${targets.length} total)`);
  if (stoppedEarly) {
    console.log(`[opponent-records] stopped early (budget reached) -- ${remaining} still unprocessed; re-run to continue`);
  }
  console.log(DRY ? '[opponent-records] --dry-run: cache not written' : '[opponent-records] cache is up to date at ' + path.relative(ROOT, CACHE_PATH));
}

module.exports = {
  norm, stripDiacritics, readFightHistory, untrackedOpponentsFor,
  parseSearchResults, parseFighterHistory, parseFightTable, isoFromSherdogDate,
  parseDateUTC, recordAsOfFromHistory, findMutualConfirmation, findRowNearDate,
  resolveOpponent, resolveViaFighterOwnPage,
};
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
