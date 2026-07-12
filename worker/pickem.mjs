/**
 * Pick'em scoring, grading and aggregation — PURE functions, no I/O.
 *
 * The same code runs in the Worker (grading stored picks against results) and in
 * the offline unit test (scripts/test-pickem.mjs). Keeping it dependency-free is
 * what lets us verify the money-math without a live Worker or KV.
 *
 * Scoring mirrors the client's "points at stake" preview: the client snapshots
 * each pick's component points at submit time — winnerBase (wPts, scaled by the
 * underdog odds at that moment), method bonus (mPts, likelihood-weighted) and
 * round bonus (rPts) — so grading here only has to check WHAT came true and apply
 * the confidence multiplier. That locks the odds/likelihood in at pick time and
 * keeps the server from needing the client's odds/fight-history data.
 */

export const CONF_MULT = { High: 2, Med: 1.5, Low: 1 };
// A wrong winner costs points, scaled by how confident the pick was.
export const CONF_PENALTY = { High: 10, Med: 5, Low: 0 };
// A pick counts as an "underdog pick" when the snapshotted winner base (wPts) is
// above this. winnerBase is exactly 10 at a coin flip and rises above 10 for ANY
// underdog (no-vig win prob under 50%), so >10 flags every underdog picked — slight
// +100 / -105 dogs included — not just clear ones.
export const UNDERDOG_WPTS = 10;

export function normName(s) {
  return String(s == null ? '' : s).toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\b(jr|sr|iv|iii|ii)\b/g, '')   // drop generational suffixes — the common canonical-vs-feed mismatch
    .replace(/[^a-z0-9]+/g, '');
}
// Order-independent key for a bout, so a pick and a result match regardless of
// which fighter is listed first.
export function pairKey(a, b) { return [normName(a), normName(b)].sort().join('__'); }

// Normalized LAST name (accents/suffixes/punctuation stripped).
export function lastNorm(s) {
  const toks = String(s == null ? '' : s).toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\b(jr|sr|iv|iii|ii|v)\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim().split(/\s+/).filter(Boolean);
  return toks.length ? toks[toks.length - 1] : '';
}
// Two fighter names refer to the same person. Handles the feed disagreeing on a
// fighter's display name between pick time and results: nicknames ("King Green" vs
// "Bobby Green"), short forms ("Zach" vs "Zachary Reese"), accents and suffixes.
// Exact normalized match wins; otherwise a shared last name (a bout only pairs two
// fighters, so a same-last-name coincidence can't cross bouts).
export function namesMatch(a, b) {
  const na = normName(a), nb = normName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 5 && nb.length >= 5 && (na.startsWith(nb) || nb.startsWith(na))) return true;
  const la = lastNorm(a), lb = lastNorm(b);
  return !!la && la === lb && la.length >= 3;
}

// Bucket any raw method string into KO/TKO | Submission | Decision | null.
export function methodBucket(m) {
  const s = String(m || '').toLowerCase();
  if (!s) return null;
  if (/sub/.test(s)) return 'Submission';
  if (/dec/.test(s)) return 'Decision';
  if (/ko|tko|knockout|stoppage|punch|kick|elbow|knee|slam|choke|lock|bar/.test(s)) return 'KO/TKO';
  return null;
}

// Grade one bout.
//   pick   = { winner, method, round, confidence, wPts, mPts, rPts }
//   result = { winner, method(bucket), round, voided }   (null if not final)
// Returns { points, winnerHit, methodHit, roundHit, voided, pending }.
export function gradeBout(pick, result) {
  const conf = CONF_MULT[pick && pick.confidence] != null ? pick.confidence : 'Med';
  if (!result) return { points: 0, pending: true, winnerHit: false, methodHit: false, roundHit: false, voided: false };
  if (result.voided) return { points: 0, voided: true, winnerHit: false, methodHit: false, roundHit: false, pending: false };
  const winnerHit = namesMatch(pick.winner, result.winner);
  if (!winnerHit) return { points: -(CONF_PENALTY[conf] || 0), winnerHit: false, methodHit: false, roundHit: false, voided: false, pending: false };
  // Method and round are scored INDEPENDENTLY (once the winner is right). Round
  // credit only requires that the fight actually ended in the round you called — it
  // does NOT require the method to be right. It just can't apply to a decision (no
  // finishing round). So calling the winner + round but the wrong method still earns
  // the winner + round bonuses.
  const methodHit = !!pick.method && pick.method === result.method;
  const roundHit = result.method !== 'Decision' && pick.round != null && Number(pick.round) === Number(result.round);
  const earned = (pick.wPts || 0) + (methodHit ? (pick.mPts || 0) : 0) + (roundHit ? (pick.rPts || 0) : 0);
  return { points: Math.round(earned * (CONF_MULT[conf] || 1)), winnerHit: true, methodHit, roundHit, voided: false, pending: false };
}

// Grade a full card. record.picks = [{ f1, f2, winner, method, round, confidence, wPts, mPts, rPts }].
// resultsBouts = [{ f1, f2, winner, method, round, voided }] (raw method ok — bucketed here).
export function gradeCard(record, resultsBouts) {
  const results = (resultsBouts || []).map(r => ({
    f1: r.f1, f2: r.f2,
    winner: r.winner,
    method: r.method && /KO|Sub|Dec/i.test(r.method) && (r.method === 'KO/TKO' || r.method === 'Submission' || r.method === 'Decision') ? r.method : methodBucket(r.method),
    round: r.round != null ? Number(r.round) : null,
    voided: !!r.voided,
  }));
  // Match a pick to its result by fighter names (order-independent, name-tolerant),
  // rather than a strict normalized-full-name key — so a display-name change between
  // pick time and results ("Bobby Green" -> "King Green") still grades.
  const boutMatches = (p, r) =>
    (namesMatch(p.f1, r.f1) && namesMatch(p.f2, r.f2)) ||
    (namesMatch(p.f1, r.f2) && namesMatch(p.f2, r.f1));
  const bouts = (record.picks || []).map(p => {
    const res = results.find(r => boutMatches(p, r)) || null;
    const g = gradeBout(p, res);
    return { f1: p.f1, f2: p.f2, winner: p.winner, method: p.method || null, round: p.round || null,
             confidence: p.confidence || 'Med', wPts: p.wPts, result: res, ...g };
  });
  const total = bouts.reduce((t, b) => t + (b.points || 0), 0);
  const decided = bouts.filter(b => b.result && !b.voided).length;
  const correct = bouts.filter(b => b.winnerHit).length;
  // Underdog record: of the decided bouts where the user backed a clear underdog,
  // how many came in.
  let dogPicks = 0, dogCorrect = 0;
  bouts.forEach(b => {
    if (!b.result || b.voided) return;
    if (Number(b.wPts) > UNDERDOG_WPTS) { dogPicks++; if (b.winnerHit) dogCorrect++; }
  });
  return { bouts, total, decided, correct, dogPicks, dogCorrect, boutCount: bouts.length };
}

// ── aggregation across events ────────────────────────────────────────────────
// A user's agg record: { name, byEvent: { slug: { points, name, date, correct, boutCount } } }.
export function cardPoints(agg, slugs) {
  if (!agg || !agg.byEvent) return 0;
  return slugs.reduce((t, s) => t + (agg.byEvent[s] ? (agg.byEvent[s].points || 0) : 0), 0);
}

// orderedSlugs: all finalized event slugs, NEWEST FIRST.
export function buildLeaderboard(aggs, orderedSlugs, scope) {
  const slugs = scope === 'recent' ? orderedSlugs.slice(0, 1)
              : scope === 'last5' ? orderedSlugs.slice(0, 5)
              : orderedSlugs.slice();
  const rows = (aggs || [])
    .filter(a => a && a.name)
    .map(a => ({
      name: a.name,
      points: cardPoints(a, slugs),
      played: slugs.filter(s => a.byEvent && a.byEvent[s]).length,
    }))
    .filter(r => r.played > 0)
    .sort((x, y) => y.points - x.points || x.name.localeCompare(y.name));
  return rows.map((r, i) => ({ rank: i + 1, name: r.name, points: r.points, played: r.played }));
}

// This player's 1-based rank in the all-time and last-5 leaderboards (null if
// they don't place in that scope).
export function playerRanks(aggs, orderedSlugs, name) {
  const find = (scope) => { const r = buildLeaderboard(aggs, orderedSlugs, scope).find(x => x.name === name); return r ? r.rank : null; };
  return { all: find('all'), last5: find('last5') };
}

// A single user's history, newest first, with cumulative totals + records.
export function userHistory(agg, orderedSlugs) {
  const events = orderedSlugs
    .filter(s => agg && agg.byEvent && agg.byEvent[s])
    .map(s => ({ slug: s, ...agg.byEvent[s] }));
  const sum = (k) => events.reduce((t, e) => t + (e[k] || 0), 0);
  return {
    name: (agg && agg.name) || null,
    total: sum('points'),
    correct: sum('correct'),
    decided: events.reduce((t, e) => t + (e.decided != null ? e.decided : (e.boutCount || 0)), 0),
    dogCorrect: sum('dogCorrect'),
    dogPicks: sum('dogPicks'),
    events,
  };
}

// ── display-name validation ──────────────────────────────────────────────────
// 2–20 chars, letters/numbers/space/_-. — no leading/trailing/double spaces.
export function cleanName(raw) {
  const n = String(raw == null ? '' : raw).trim().replace(/\s+/g, ' ');
  if (n.length < 2 || n.length > 20) return null;
  if (!/^[A-Za-z0-9 _.\-]+$/.test(n)) return null;
  return n;
}
