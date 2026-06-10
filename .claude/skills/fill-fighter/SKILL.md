---
name: fill-fighter
description: Fill or verify one fighter's GillyLab profile (stats, odds history, fight history, accolades) in index.html. Use when asked to fill out, update, verify, or complete a fighter profile, e.g. "/fill-fighter Merab Dvalishvili" or "do the profile for X".
---

# Fill one fighter's GillyLab profile

Work ONE fighter at a time. Target state: full FIGHTER_STATS entry (with strAcc + sapm),
complete & corrected ODDS_HISTORY, verified FIGHT_HISTORY, and a real ACCOLADES list.
Commit when the fighter is done. All four structures live in `index.html` and are keyed
by the fighter's exact name as it appears in the FIGHTERS array.

## Step 1 — gather data (one command)

```bash
python3 scripts/fighter-lookup.py "<Fighter Name>"
```

This prints, compactly:
- **[LOCAL]** the fighter's current roster row, stats, odds, fight history (with derived
  record + win streak), and accolades from index.html
- **[UFCCOM]** career stats parsed from ufc.com (UFCStats.com is bot-blocked — don't try it)
- **[BFO]** the full BestFightOdds table. Each matchup is two lines: the fighter's line
  (open | closing-range-low ... closing-range-high), then the opponent's line with the
  event date. Trust this raw table; do NOT WebFetch BFO pages (the summarizer flips
  fighter/opponent rows).

If BFO returns multiple candidate IDs, rerun with `--bfo-id <Name-NNNN>`.

## Step 2 — one Wikipedia fetch

WebFetch `https://en.wikipedia.org/wiki/<Fighter_Name>` asking in a single prompt for:
DOB/height/reach/stance/gym, current record + any **scheduled** fight in the record table,
last 3-5 fights, and ALL championships/accomplishments (title reigns with defense counts,
UFC bonuses with counts + opponents, other-promotion titles, amateur/combat-sports background).

**Do not trust Wikipedia's "current win streak" figure** — recompute it from the fight
history (the lookup script already prints the derived streak and record).

**If the fighter has no Wikipedia page (or the record table comes back incomplete):**
fall back to WebFetch of their ESPN fighter page (`espn.com/mma/fighter/_/id/...` — find
it via WebSearch) and/or Sherdog profile, plus WebSearch for recent results. Tapology is
robots-blocked — don't scrape it. Do not skip verification just because Wikipedia is thin.

## Step 3 — write the four entries

**FIGHTER_STATS** (field order used by completed entries):
`ht, dob, reach, stance, slpm, strAcc, sapm, strDef, kd, tdLanded, tdAcc, tdDef, subAvg, finRate, streak, gym`
- All stat values come from [UFCCOM]. `finRate` = (KO + Sub wins) / total wins, rounded to whole %.
- `streak` = consecutive wins since last loss/draw; NCs are skipped, not breakers.

**ODDS_HISTORY** — rebuild from [BFO], newest first, one entry per fight that actually
happened (match against FIGHT_HISTORY):
- Odds value = consensus of the closing range: midpoint of low/high, discarding a
  single-book outlier when one end is far from the cluster and the open.
- **Skip** rows for fights that never happened: "Future Events" / "Unconfirmed" sections,
  and cancelled bookings (a BFO row whose opponent/date has no matching fight in the
  verified history — e.g. an opponent who pulled out). BFO keeps all of these.
- Non-UFC fights with real BFO lines (PFL, ACB, LFA, Invicta…) are fine to include.

**FIGHT_HISTORY** — verify against Wikipedia's record table (dates, opponents, methods,
events). Pre-existing data here can be wrong or fabricated — when [LOCAL] disagrees with
Wikipedia/BFO, believe the external sources and fix. Do NOT add upcoming-fight rows; the
site renders upcoming bouts from the events feed, not FIGHT_HISTORY.

**ACCOLADES** — array of `{ icon, title, detail: null }`. Icons by convention:
🏆 titles/championships, ⭐ UFC bonuses (with counts + opponents), 🏅 records & awards,
🥇🥈🥉 medals, 🥋 belts/grappling ranks, 🥊/🤼 striking/wrestling backgrounds.
Order: UFC titles → other titles → bonuses → records → backgrounds/belts.

Also fix the FIGHTERS roster row if rank/record/country is stale —
`data/rankings.json` (API-synced) is the authority for current rank and record.

## Step 4 — verify and commit

- Re-run `python3 scripts/fighter-lookup.py "<Name>" --local-only` and check: stats line
  has strAcc+sapm+gym, odds count ≈ number of fights with BFO lines, derived record matches
  the roster row, streak matches stats.
- Commit just index.html, message format:
  `Name: full stats (strAcc/sapm, fix X), overhaul odds (N entries, fix Y), accolades`

## Accuracy beats usage — non-negotiable

Existing profile data in index.html has repeatedly turned out to be not just stale but
**fabricated** (invented opponents, fights that never happened, mirrored careers under a
second spelling). Therefore:

- Every fight kept in FIGHT_HISTORY must be corroborated by at least one external source
  (Wikipedia record table, ESPN, Sherdog, BFO row, or a news result). The lookup script's
  derived record is a tripwire: if it disagrees with the roster row or `data/rankings.json`,
  the history is missing fights or contains fake ones — investigate, don't reconcile blindly.
- When local data conflicts with external sources, or a fight can't be corroborated after
  the standard fetches, **do more searching** (WebSearch the bout, fetch ESPN/Sherdog) until
  resolved — even though it costs extra calls. Never keep an unverified row because deleting
  it feels drastic, and never average a conflict.
- If something genuinely cannot be verified either way, leave it, but say so explicitly in
  the commit message (e.g. "could not verify 2019 regional fights") so it's findable later.

## Cautions learned the hard way

- Old ODDS_HISTORY data is untrustworthy: phantom fights, wrong-direction odds,
  opening lines. Prefer full rebuild from BFO.
- Only treat a next fight as booked if Wikipedia's record table has a scheduled row or
  current news confirms it — BFO "Future Events" lines are often speculative. UFC bouts only.
- The roster was deduped to one canonical spelling per fighter (652→628). Don't add a
  second entry under a different spelling; data lookups are exact-string keyed.
