/*
 * lib-live-overlay.cjs — offline twin of the browser's glMergeLiveCard().
 *
 * The site's embedded FIGHT_HISTORY is a static build-time snapshot: bouts from a
 * card that just finished are baked as { result:"–", method:"Upcoming" } and only
 * become "completed" in the DOM because the browser fetches data/live-card.json at
 * render and overlays the real results (see glMergeLiveCard in index.html).
 *
 * Node tooling (fix-tape, gap sweeps) parses the *baked* FIGHT_HISTORY, so it sees
 * the stale "Upcoming" rows and skips just-finished bouts. This applies the SAME
 * overlay in memory, so the tooling sees exactly what a visitor sees.
 *
 * Contract mirrored from index.html:
 *   data/live-card.json = { fighters: { "<ESPN name>": { history:[FH row,...], stats:[...] } } }
 *   each history row is a full FIGHT_HISTORY row carrying the real result/method.
 *   dedupe is on (opponent, date); an existing row is UPDATED in place (a correction /
 *   an Upcoming row going final), otherwise the row is prepended (newest-first).
 *
 * Read-failure policy follows CLAUDE.md rule #2: a genuinely ABSENT file (ENOENT) is
 * the only tolerable miss — the overlay is optional, so we no-op. Any OTHER read/parse
 * failure (iCloud-offloaded stub, truncated, corrupt JSON) THROWS, because silently
 * defaulting past an unreadable file is the exact data-loss shape that repo warns about.
 *
 *   const { overlayLiveCard } = require('./lib-live-overlay.cjs');
 *   const n = overlayLiveCard(FH, nrm, ROOT);   // patches FH in place, returns rows merged
 */
const fs = require('fs'), path = require('path');

function overlayLiveCard(FH, nrm, ROOT, opts) {
  opts = opts || {};
  const file = opts.file || path.join(ROOT, 'data', 'live-card.json');
  let txt;
  try {
    txt = fs.readFileSync(file, 'utf8');
  } catch (e) {
    if (e && e.code === 'ENOENT') return 0;      // no live card right now — fine
    throw e;                                      // offloaded / unreadable — do NOT guess
  }
  const doc = JSON.parse(txt);                    // corrupt JSON must throw, not default
  const fighters = (doc && doc.fighters) || {};

  // canon: map an ESPN name onto the existing FIGHT_HISTORY key with the same
  // normalized form (e.g. "Zach Reese" -> "Zachary Reese", "King Green" -> "Bobby
  // Green"), so merged rows land on the profile the tooling already knows. Unknown
  // names are kept verbatim (a brand-new debut fighter gets their own key).
  const byNorm = {};
  for (const k in FH) byNorm[nrm(k)] = k;
  const canon = (nm) => byNorm[nrm(nm)] || nm;

  let merged = 0;
  for (const rawName of Object.keys(fighters)) {
    const e = fighters[rawName] || {};
    if (!Array.isArray(e.history) || !e.history.length) continue;
    const name = canon(rawName);
    const arr = FH[name] || (FH[name] = []);
    // reverse: prepend oldest-first so the net order stays newest-first, matching the site
    e.history.slice().reverse().forEach(r => {
      if (!r || !r.opponent || !r.date) return;
      const row = Object.assign({}, r, { opponent: canon(r.opponent) });
      const i = arr.findIndex(x => x && x.date === row.date && nrm(x.opponent) === nrm(row.opponent));
      if (i >= 0) {
        if (JSON.stringify(arr[i]) !== JSON.stringify(row)) { arr[i] = row; merged++; }
        return;
      }
      arr.unshift(row);
      merged++;
    });
  }
  return merged;
}

module.exports = { overlayLiveCard };
