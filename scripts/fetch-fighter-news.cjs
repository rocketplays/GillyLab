#!/usr/bin/env node
/* Fighter news aggregator.
 *
 * For every fighter on an imminent UFC card (from data/event.json), pulls recent
 * headlines from Google News RSS (a per-fighter query — no API key), curates them
 * (reputable-outlet whitelist, recency window, dedupe, cap), flags injury/
 * withdrawal stories, and writes data/fighter-news.json for the app to render on
 * fighter pages + as a card-level alert.
 *
 * We LINK OUT to sources (headline + outlet + date) rather than reproducing
 * article bodies — aggregation, not republication.
 *
 * Runs in the update-odds workflow. Non-fatal + keep-last-good: a fetch hiccup
 * never blocks the odds update, and a fighter with no fresh result keeps their
 * previous entry.
 *
 * Usage: node scripts/fetch-fighter-news.cjs [--days N] [--horizon N] [--max-cards N]
 *   --days       recency window for a headline to count (default 30)
 *   --horizon    outer bound (days) on how far ahead to consider events (default 120)
 *   --max-cards  how many upcoming cards to cover — featured + carousel (default 6)
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'fighter-news.json');

const args = process.argv.slice(2);
const argN = (flag, def) => { const i = args.indexOf(flag); return i >= 0 ? +args[i + 1] : def; };
const RECENCY_DAYS = argN('--days', 30);
const HORIZON_DAYS = argN('--horizon', 120);   // generous outer bound on how far ahead to look
const MAX_CARDS = argN('--max-cards', 6);      // featured card + the carousel's next few events
const PER_FIGHTER = 6;
const DAY = 24 * 3600 * 1000;

// Reputable MMA / sports outlets — everything else (SEO filler, betting-site
// "when is X's next fight" pages, random aggregators) is dropped.
const OUTLET_OK = /ufc\.com|mma\s?junkie|mma\s?fighting|mma\s?mania|bloody\s?elbow|sherdog|espn|bjpenn|lowkick|sports\s?illustrated|si\.com|mma\s?news|mmaweekly|yahoo|cbs\s?sports|the\s?sporting\s?news|talksport|tapology|the\s?score|givemesport|fox\s?sports|bleacher|sportingnews|mmauk|middleeasy/i;
// Injury / withdrawal / card-change signal. Kept tight to avoid false positives
// (bare "pull"/"replace"/"scratch" matched things like "pulled hair in training"
// or "replaces at the top of the rankings"). Requires specific phrasing.
const INJURY_RE = /\binjur(?:y|ed|ies)\b|\bwithdraw|pull(?:ed|s)?\s+out\b|\bforced out\b|out of the (?:fight|card|bout|event)\b|off the card\b|miss(?:es|ed)?\s+weight\b|fail(?:s|ed)?\s+to make weight\b|\boverweight\b|short.?notice\b|late replacement\b|replacement (?:opponent|fighter)\b|steps? in\b|\bnew\b[^.]{0,15}?\bopponent\b|opponent change\b|\btorn\b|fractur|hospitaliz/i;

// INJURY_RE matches the bare word "injury", so it also fires on retrospectives
// about long-past bouts — e.g. "Conor McGregor's coach takes the blame for toe
// injury that canceled UFC 303 comeback". That's history, not a card change.
//
// Guard: if a headline names UFC events and NONE of them are cards we're
// currently tracking, treat it as historical. A headline that names no event at
// all ("...detrimental injury forced him off McGregor's return card") is
// unaffected, and one naming both a past and an upcoming card still flags.
// A fighter TALKING ABOUT an injury is not a fight in doubt. "Alex Perez Details
// Brutal Low Blow Injury Before UFC Shanghai" is a pre-fight interview in which he
// recounts something that happened in his LAST fight — but it names him, says
// "Injury", and names an event we ARE tracking (Shanghai is his upcoming card), so
// every existing guard passes it and his bout got an injury warning.
//
// refersToPastEvent can't catch it: that only reads NUMBERED events ("UFC 303"), and
// city-named cards carry no number.
//
// The tell is the verb. Status news says what CHANGED — "steps in", "withdraws",
// "out of the main event". Retrospectives say what someone SAID — "details",
// "recalls", "reveals". So: suppress the flag when the headline is a recounting AND
// carries no status language. The second half is what keeps "Coach details injury
// that forced him out of UFC 303" flagged; without it this guard would swallow real
// withdrawals that happen to be reported as a quote.
const RETRO_RE = /\b(?:details?|detailed|recalls?|recalled|reveals?|revealed|explains?|explained|opens? up|opened up|reflects?|reflected|looks? back|looked back|discusses|discussed|talks? about|talked about|remembers?|remembered|breaks? down|admits?|admitted)\b/i;
// "forc\w*[^.]{0,15}out" rather than "forced out": the object usually sits between
// them ("forced HIM out"), which an adjacent-words pattern misses — that leak let
// "Coach details injury that forced him out of UFC 303" through as a retrospective.
const STATUS_RE = /\bwithdraw|pull(?:ed|s)?\s+out\b|\bforc\w*[^.]{0,15}\bout\b|\bout of\s+(?:the\s+)?(?:fight|card|bout|event|main event|co-main|ufc\b)|off the card\b|steps? in\b|replacement|short.?notice\b|\bruled out\b|\bout\b[^.]{0,25}\b(?:injur|main event|card)\b|miss(?:es|ed)?\s+weight\b|hospitaliz/i;
function isRetrospective(title) {
  return RETRO_RE.test(String(title || '')) && !STATUS_RE.test(String(title || ''));
}

function refersToPastEvent(title, eventNums) {
  if (!eventNums || !eventNums.size) return false;
  const found = String(title || '').match(/\bUFC\s+\d{2,4}\b/gi) || [];
  if (!found.length) return false;
  return !found.some(f => eventNums.has(f.replace(/\D+/g, '')));
}

// A headline that never names the fighter is EVENT-level news that Google only
// put in his feed because he's on the card. "UFC Abu Dhabi gets big shakeup
// after headliner ruled out with injury" lands in the feed of every fighter on
// that card — including Magomed Tuchalov, fighting 4th on the prelims. It says
// nothing about HIS bout, so it must not flag his bout as injury news.
//
// Match the SURNAME, not any token: "Magomed" alone would tie Tuchalov to a
// Magomed Ankalaev or Magomed Zaynukov story. Particles are folded back in so
// "du Plessis" / "Saint-Denis" / "Dos Anjos" match as a unit rather than on a
// bare, collision-prone last token.
//
// This only gates the injury FLAG — card-level articles still appear on the
// fighter's News tab, where they're useful context rather than a claim about
// his fight. Genuine card changes are covered independently by the ground-truth
// shortNotice / mayChange markers from card-changes.json, so nothing that
// actually moved loses its warning.
const PARTICLE = /^(?:du|de|dos|das|da|del|della|van|von|der|la|le|al|el|st|saint|bin|ibn|mac|mc|o)$/;
function namesFighter(title, name) {
  const t = norm(title), n = norm(name);
  if (!n) return false;
  if (t.includes(n)) return true;                       // full name present
  const toks = n.split(' ').filter(Boolean);
  let last = toks[toks.length - 1];
  if (!last || last.length < 3) return false;           // initials / junk — don't guess
  const surname = (toks.length > 2 && PARTICLE.test(toks[toks.length - 2]))
    ? toks.slice(-2).join(' ')
    : last;
  return new RegExp('\\b' + surname.replace(/\s+/g, '\\s+') + '\\b').test(t);
}

// Google News surfaces a fighter's static PROFILE / STATS pages (ESPN "MMA
// Profile", CBS Sports player page, Sherdog fighter page, …) as if they were
// articles. They pass the outlet whitelist but aren't news, so drop them: they
// either carry an explicit profile/stats marker, or the whole headline is just
// the fighter's name (Google titles are "Headline - Source", so we look at the
// part before the trailing source).
function isProfilePage(title, name) {
  const t = String(title || '');
  if (/\bMMA Profile\b|\b(?:Player|Fighter|Athlete)\s+(?:Page|Profile)\b|\bBio,\s*Stats\b|\bStats,\s*(?:News|Bio)\b|\bNews,\s*Stats\b|\bCareer\s+(?:Stats|Record)\b|\b(?:MMA|Fight)\s+Record\b/i.test(t)) return true;
  if (!name) return false;
  const headline = t.replace(/\s+[|–—-]\s+[^|–—-]+$/, '');   // strip trailing " - Source"
  const rem = headline
    .replace(new RegExp('\\b' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+') + '\\b', 'i'), '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[^A-Za-z0-9]+/g, '');
  return rem.length === 0;   // headline was nothing but the fighter's name
}

function norm(s) {
  return String(s == null ? '' : s).toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}
function decodeEntities(s) {
  return String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).trim();
}

// --- pure: parse Google News RSS xml text -> [{title,url,source,date}] ---
function parseItems(xml) {
  const blocks = String(xml || '').split('<item>').slice(1).map(b => b.split('</item>')[0]);
  const grab = (blk, tag) => {
    const m = new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)</' + tag + '>').exec(blk);
    return m ? decodeEntities(m[1]) : '';
  };
  return blocks.map(b => ({
    title: grab(b, 'title'),
    url: grab(b, 'link'),
    source: grab(b, 'source'),
    date: grab(b, 'pubDate')
  })).filter(x => x.title);
}

// --- pure: curate a fighter's items (whitelist + recency + dedupe + cap) ---
function curate(items, now, eventNums, name) {
  now = now || Date.now();
  const seen = new Set();
  const out = [];
  for (const it of items) {
    if (!OUTLET_OK.test(it.source)) continue;
    if (isProfilePage(it.title, name)) continue;   // static profile/stats page, not an article
    const ts = Date.parse(it.date);
    if (isFinite(ts) && (now - ts) > RECENCY_DAYS * DAY) continue;
    const key = norm(it.title).slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      title: it.title, url: it.url, source: it.source,
      date: isFinite(ts) ? new Date(ts).toISOString().slice(0, 10) : null,
      injury: INJURY_RE.test(it.title) && namesFighter(it.title, name) &&
              !refersToPastEvent(it.title, eventNums) && !isRetrospective(it.title)
    });
    if (out.length >= PER_FIGHTER) break;
  }
  return out;
}

async function fetchFeed(name) {
  const url = 'https://news.google.com/rss/search?q=%22' + encodeURIComponent(name) +
    '%22%20UFC&hl=en-US&gl=US&ceid=US:en';
  const r = await fetch(url, { headers: { 'User-Agent': 'GillyLab/1.0 (https://gillylab.com)' } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.text();
}

function upcomingCardFighters() {
  const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'event.json'), 'utf8'));
  const evs = (j && (j.data || j)) || [];
  const now = Date.now();
  // The next MAX_CARDS upcoming events that actually have a card — i.e. the
  // featured event plus the events shown in the home "upcoming events" carousel.
  // (Excludes Road to UFC, matching the carousel's own filter.)
  const upcoming = evs
    .map(ev => ({ ev, start: Date.parse(ev.startsAt || ev.eventDate || ev.venueDate || '') }))
    .filter(x => isFinite(x.start) && x.start > now - DAY && x.start < now + HORIZON_DAYS * DAY)
    .filter(x => x.ev.status !== 'completed')
    .filter(x => !(x.ev.bouts || []).some(b => b.winnerFighterSlug))  // any decided bout ⇒ already happened (mislabeled past event)
    .filter(x => !/road\s+to\s+(the\s+)?ufc/i.test(x.ev.title || x.ev.shortTitle || ''))
    .filter(x => (x.ev.bouts || []).some(b => !b.isCancelled && (b.fighters || []).length >= 2))
    .sort((a, b) => a.start - b.start)
    .slice(0, MAX_CARDS);
  const names = new Map(); // norm -> display name
  const eventNums = new Set(); // "329", "330" — the cards we're actually tracking
  for (const { ev } of upcoming) {
    const m = /\bUFC\s+(\d{2,4})\b/i.exec(ev.title || ev.shortTitle || '');
    if (m) eventNums.add(m[1]);
    for (const b of ev.bouts || []) {
      if (b.isCancelled) continue;
      for (const f of b.fighters || []) {
        if (f.fighterName) names.set(norm(f.fighterName), f.fighterName);
      }
    }
  }
  return { names: [...names.values()], eventNums: eventNums };
}

async function main() {
  let fighters, eventNums;
  try { const u = upcomingCardFighters(); fighters = u.names; eventNums = u.eventNums; }
  catch (e) { console.error('cannot read event.json:', e.message); return; }
  if (!fighters.length) { console.log('no fighters on cards within horizon; nothing to do.'); return; }

  const prev = (() => { try { return JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) { return { fighters: {} }; } })();
  const now = Date.now();
  const result = { generatedAt: new Date().toISOString(), recencyDays: RECENCY_DAYS, fighters: {} };
  let ok = 0, kept = 0, injuries = 0;

  for (const name of fighters) {
    const key = norm(name);
    try {
      const xml = await fetchFeed(name);
      const items = curate(parseItems(xml), now, eventNums, name);
      if (items.length) {
        result.fighters[key] = { name, hasInjuryNews: items.some(i => i.injury), items };
        ok++; kept += items.length; injuries += items.filter(i => i.injury).length;
      }
    } catch (e) {
      // keep last-good entry for this fighter on a transient error
      if (prev.fighters && prev.fighters[key]) result.fighters[key] = prev.fighters[key];
      console.warn('news fetch failed for', name, '-', e.message);
    }
  }

  fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n');
  console.log(`fighter-news.json: ${ok}/${fighters.length} fighters with news · ${kept} items · ${injuries} injury-flagged`);
}

module.exports = { parseItems, curate, norm, OUTLET_OK, INJURY_RE, refersToPastEvent, isRetrospective, upcomingCardFighters, isProfilePage, namesFighter };
if (require.main === module) main();
