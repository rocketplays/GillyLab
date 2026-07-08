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
const INJURY_RE = /injur|withdr|pull(ed|s)?\b|replace|steps? in|short notice|miss(ed|es)? weight|off the card|out of (the )?(fight|card|bout|event)|forced out|scratch/i;

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
function curate(items, now) {
  now = now || Date.now();
  const seen = new Set();
  const out = [];
  for (const it of items) {
    if (!OUTLET_OK.test(it.source)) continue;
    const ts = Date.parse(it.date);
    if (isFinite(ts) && (now - ts) > RECENCY_DAYS * DAY) continue;
    const key = norm(it.title).slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      title: it.title, url: it.url, source: it.source,
      date: isFinite(ts) ? new Date(ts).toISOString().slice(0, 10) : null,
      injury: INJURY_RE.test(it.title)
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
  for (const { ev } of upcoming) {
    for (const b of ev.bouts || []) {
      if (b.isCancelled) continue;
      for (const f of b.fighters || []) {
        if (f.fighterName) names.set(norm(f.fighterName), f.fighterName);
      }
    }
  }
  return [...names.values()];
}

async function main() {
  let fighters;
  try { fighters = upcomingCardFighters(); }
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
      const items = curate(parseItems(xml), now);
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

module.exports = { parseItems, curate, norm, OUTLET_OK, INJURY_RE };
if (require.main === module) main();
