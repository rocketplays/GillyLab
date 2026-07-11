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

export function normName(s) {
  return String(s == null ? '' : s).toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\b(jr|sr|iv|iii|ii)\b/g, '')   // drop generational suffixes — the common canonical-vs-feed mismatch
    .replace(/[^a-z0-9]+/g, '');
}
// Order-independent key for a bout, so a pick and a result match regardless of
// which fighter is listed first.
export function pairKey(a, b) { return [normName(a), normName(b)].sort().join('__'); }

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
  const winnerHit = normName(pick.winner) === normName(result.winner);
  if (!winnerHit) return { points: -(CONF_PENALTY[conf] || 0), winnerHit: false, methodHit: false, roundHit: false, voided: false, pending: false };
  const methodHit = !!pick.method && pick.method === result.method;
  const roundHit = methodHit && pick.method !== 'Decision' && pick.round != null && Number(pick.round) === Number(result.round);
  const earned = (pick.wPts || 0) + (methodHit ? (pick.mPts || 0) : 0) + (roundHit ? (pick.rPts || 0) : 0);
  return { points: Math.round(earned * (CONF_MULT[conf] || 1)), winnerHit: true, methodHit, roundHit, voided: false, pending: false };
}

// Grade a full card. record.picks = [{ f1, f2, winner, method, round, confidence, wPts, mPts, rPts }].
// resultsBouts = [{ f1, f2, winner, method, round, voided }] (raw method ok — bucketed here).
export function gradeCard(record, resultsBouts) {
  const map = {};
  (resultsBouts || []).forEach(r => {
    map[pairKey(r.f1, r.f2)] = {
      winner: r.winner,
      method: r.method && /KO|Sub|Dec/i.test(r.method) && (r.method === 'KO/TKO' || r.method === 'Submission' || r.method === 'Decision') ? r.method : methodBucket(r.method),
      round: r.round != null ? Number(r.round) : null,
      voided: !!r.voided,
    };
  });
  const bouts = (record.picks || []).map(p => {
    const res = map[pairKey(p.f1, p.f2)] || null;
    const g = gradeBout(p, res);
    return { f1: p.f1, f2: p.f2, winner: p.winner, method: p.method || null, round: p.round || null,
             confidence: p.confidence || 'Med', result: res, ...g };
  });
  const total = bouts.reduce((t, b) => t + (b.points || 0), 0);
  const decided = bouts.filter(b => b.result && !b.voided).length;
  const correct = bouts.filter(b => b.winnerHit).length;
  return { bouts, total, decided, correct, boutCount: bouts.length };
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

// A single user's history, newest first, with a cumulative total.
export function userHistory(agg, orderedSlugs) {
  const events = orderedSlugs
    .filter(s => agg && agg.byEvent && agg.byEvent[s])
    .map(s => ({ slug: s, ...agg.byEvent[s] }));
  const total = events.reduce((t, e) => t + (e.points || 0), 0);
  return { name: (agg && agg.name) || null, total, events };
}

// ── display-name validation ──────────────────────────────────────────────────
// 2–20 chars, letters/numbers/space/_-. — no leading/trailing/double spaces.
export function cleanName(raw) {
  const n = String(raw == null ? '' : raw).trim().replace(/\s+/g, ' ');
  if (n.length < 2 || n.length > 20) return null;
  if (!/^[A-Za-z0-9 _.\-]+$/.test(n)) return null;
  return n;
}
