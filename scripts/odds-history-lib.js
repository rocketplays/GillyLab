// Shared helpers for building/maintaining data/odds-history.json — a
// running day-by-day record of consensus moneyline odds for each scheduled
// UFC matchup. Used by both the daily update script (run from the
// update-odds GitHub Action) and the one-time git-history backfill.
//
// Powers the "Line Movement" tracker on the Odds page: shows what a
// fighter's moneyline opened at when odds were first tracked, and how it
// has moved day-to-day up to the current line.

'use strict';

const NAME_SUFFIXES = new Set(['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'v']);

function lastNameOf(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  while (parts.length > 1 && NAME_SUFFIXES.has(parts[parts.length - 1].toLowerCase().replace(/\.$/, ''))) {
    parts.pop();
  }
  return parts[parts.length - 1] || (name || '');
}

// Order-independent key so "A vs B" and "B vs A" snapshots merge into one entry
function pairKey(n1, n2) {
  return [lastNameOf(n1).toLowerCase(), lastNameOf(n2).toLowerCase()].sort().join('|');
}

function avg(arr) {
  return arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
}

// Consensus (cross-bookmaker average) h2h price for each side of a fight,
// mirroring the front-end's findFightOdds() so the tracked numbers match
// what users already see elsewhere on the site.
function consensus(fight) {
  const homePrices = [], awayPrices = [];
  (fight.bookmakers || []).forEach(bk => {
    const market = (bk.markets || []).find(m => m.key === 'h2h');
    if (!market) return;
    const ho = (market.outcomes || []).find(o => o.name === fight.home_team);
    const ao = (market.outcomes || []).find(o => o.name === fight.away_team);
    if (ho && typeof ho.price === 'number') homePrices.push(ho.price);
    if (ao && typeof ao.price === 'number') awayPrices.push(ao.price);
  });
  return { home: avg(homePrices), away: avg(awayPrices) };
}

// Recompute the internal merge key for entries loaded from disk (the key
// itself is never persisted — it's derived from f1/f2 each time).
function withKeys(entries) {
  return (entries || []).map(e => Object.assign({}, e, { _key: pairKey(e.f1, e.f2) }));
}

function stripKeys(entries) {
  return entries.map(e => {
    const copy = Object.assign({}, e);
    delete copy._key;
    return copy;
  });
}

// Merge one day's odds.json snapshot into the running history (in place,
// returns the array). `dateStr` is a 'YYYY-MM-DD' UTC date string —
// re-applying the same date overwrites that day's entry (so a script can
// safely be re-run, and the twice-daily schedule collapses to one
// end-of-day reading per matchup per day).
function applySnapshot(history, oddsData, dateStr) {
  (oddsData || []).forEach(fight => {
    if (!fight || !fight.home_team || !fight.away_team) return;
    const { home, away } = consensus(fight);
    if (home == null && away == null) return;
    const key = pairKey(fight.home_team, fight.away_team);
    let entry = history.find(e => e._key === key);
    if (!entry) {
      entry = { _key: key, f1: fight.home_team, f2: fight.away_team, commence_time: fight.commence_time, days: [] };
      history.push(entry);
    }
    // Keep the matchup's display fields fresh in case upstream formatting shifts
    entry.f1 = fight.home_team;
    entry.f2 = fight.away_team;
    entry.commence_time = fight.commence_time;
    const existing = entry.days.find(d => d.date === dateStr);
    if (existing) {
      existing.price1 = home;
      existing.price2 = away;
    } else {
      entry.days.push({ date: dateStr, price1: home, price2: away });
      entry.days.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    }
  });
  return history;
}

// Drop matchups whose fight happened more than `maxAgeDays` ago, so the
// file doesn't grow without bound as cards come and go.
function pruneStale(history, maxAgeDays) {
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  return history.filter(e => {
    const t = Date.parse(e.commence_time);
    return Number.isNaN(t) || t > cutoff;
  });
}

module.exports = { lastNameOf, pairKey, consensus, applySnapshot, withKeys, stripKeys, pruneStale };
