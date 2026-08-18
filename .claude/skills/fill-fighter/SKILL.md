---
name: fill-fighter
description: Fill or verify one fighter's GillyLab profile (stats, odds history, fight history, accolades) in index.html. Use when asked to fill out, update, verify, or complete a fighter profile, e.g. "/fill-fighter Merab Dvalishvili" or "do the profile for X".
---

# Fill one fighter's GillyLab profile

Work ONE fighter at a time. The job is to VERIFY AND CORRECT every field against live
sources — not just fill blanks. Existing values are frequently stale or fabricated, so
treat each one as unverified until a source confirms it. The fighter is done only when
ALL of the following are independently checked and corrected:

- **all bio info** — height, DOB, reach, stance, and the **gym** they currently train at
- **all statistics** — slpm, **striking accuracy (strAcc)**, **strikes absorbed/min (sapm)**,
  strDef, kd, tdLanded, tdAcc, tdDef, subAvg, finRate, streak (no stat left stale)
- **full FIGHT_HISTORY** — every bout, corroborated, with the derived record matching the roster
- **full closing-line ODDS_HISTORY** — one entry per real fight, built from BFO **closing** lines
- **all ACCOLADES** — titles, bonuses, records, backgrounds, and any **BJJ/grappling belt rank**
  (check ufc.com's Q&A if you can't find the belt elsewhere)

Commit when the fighter is done. All four data structures live in `index.html` and are keyed
by the fighter's exact name as it appears in the FIGHTERS array.

## Step 1 — gather data (one command)

```bash
python3 scripts/fighter-lookup.py "<Fighter Name>"
```

This prints, compactly:
- **[LOCAL]** the fighter's current roster row, stats, odds, fight history (with derived
  record + win streak), and accolades from index.html
- **[UFCCOM]** career stats parsed from ufc.com, each field parsed independently
  (UFCStats.com is bot-blocked — don't try it). A field captured as `0`/`0.00` is a
  **genuine zero**; a field listed under `MISSING on ufc.com (blank, NOT a 0)` was left
  blank on the page and must be chased on another source — never copy a blank as 0.
  This is the primary source for **strAcc, sapm**, slpm, strDef, kd, tdLanded, subAvg,
  tdDef — verify each against it. The section also surfaces the **gym**, the fighter's
  **fighting style**, and any **grappling belt rank** found in the page's bio + Q&A blocks
  (a `belt rank / 'belt' mentions (ufc.com Q&A ...)` line) — this Q&A is often the only
  place a BJJ/judo belt is stated, so use it for a 🥋 accolade.
  **Do NOT trust ufc.com's `tdAcc`** — it systematically under-counts takedowns *landed*
  and prints bogus low percentages (often 0–2%). Take tdAcc from [ESPN] instead (below).
- **[ESPN]** bio fields (stance, height, reach, DOB, gym) pulled from ESPN's core API,
  **plus the VERIFIED takedown accuracy** summed from ESPN's per-fight stats table
  (takedowns landed / attempted across every fight). The line
  `tdAcc (VERIFIED per-fight L/A) = NN%   <- USE THIS` is the authoritative tdAcc —
  use it for FIGHTER_STATS, not ufc.com's value. When ufc.com and ESPN disagree by ≥5
  points the script prints a `!! tdAcc MISMATCH ... USE ESPN` line; always follow it.
  This is also the second source for bio fields — especially **stance**, which the
  ufc.com parse does not provide. If ESPN picks the wrong athlete, rerun with
  `--espn-id <number>` (also fixes a wrong/empty verified tdAcc).
- **[BFO]** the full BestFightOdds table. Each matchup is two lines: the fighter's line
  (open | closing-range-low ... closing-range-high), then the opponent's line with the
  event date. Trust this raw table; do NOT WebFetch BFO pages (the summarizer flips
  fighter/opponent rows).

The ESPN section also **downloads the fighter's headshot to `photos/<slug>.png`** (the
slug is computed with the same rules as index.html's `nameToSlug`, so the profile page
finds it automatically). The `photo:` line in the [ESPN] section reports the result —
`saved photos/<slug>.png (N bytes)`, `kept existing ...` (a curated photo was already
there; pass `--force-photo` to replace it), or a note that ESPN had no headshot. If ESPN
matched the wrong athlete the photo is wrong too — rerun with `--espn-id <number>` (add
`--force-photo` to overwrite the bad image). Commit the new `photos/<slug>.png` alongside
index.html. Use `--no-photo` only if you explicitly don't want the download.

**Headshot sourcing is restricted to ESPN and ufc.com — no other site, ever.** Both use
consistent, front-facing UFC-quality photography; every other source (Sherdog, Tapology,
Google Images, etc.) is a different crop/angle/quality and looks inconsistent next to the
rest of the roster. If ESPN has no headshot (common for a fighter making their UFC/DWCS
debut who hasn't been photographed yet) and ufc.com's athlete page also only shows the
generic silhouette placeholder (image filename contains `SHADOW_Fighter`), **leave
`photos/<slug>.png` unset and move on** — do not substitute a photo from Sherdog or
anywhere else to fill the gap. A missing photo is fine and expected to be filled in later
once ESPN/UFC.com actually have one; a wrong-style photo is not an acceptable trade.

The script ends with a **`>> STILL MISSING`** line listing any bio/stat field not found on
either ufc.com or ESPN. Treat that list as a to-do: resolve every field on it (Step 2)
before writing the entry — do not ship a profile with a field still on that list unless
you've confirmed it's genuinely unavailable or a real 0 (see "No blank fields" below).

If BFO returns multiple candidate IDs, rerun with `--bfo-id <Name-NNNN>`.

## Step 2 — one Wikipedia fetch

WebFetch `https://en.wikipedia.org/wiki/<Fighter_Name>` asking in a single prompt for:
DOB/height/reach/stance/gym, current record + any **scheduled** fight in the record table,
last 3-5 fights, and ALL championships/accomplishments (title reigns with defense counts,
UFC bonuses with counts + opponents, other-promotion titles, amateur/combat-sports background,
and any **BJJ/judo/grappling belt rank**). If a belt rank still isn't found here or on the
ufc.com Q&A line, check the fighter's gym/academy page or a grappling-news result before
giving up — a black/brown belt is a real accolade worth carrying.

**Do not trust Wikipedia's "current win streak" figure** — recompute it from the fight
history (the lookup script already prints the derived streak and record).

**If the fighter has no Wikipedia page (or the record table comes back incomplete):**
fall back to WebFetch of their ESPN fighter page (`espn.com/mma/fighter/_/id/...` — find
it via WebSearch) and/or Sherdog profile, plus WebSearch for recent results. Tapology is
robots-blocked — don't scrape it. Do not skip verification just because Wikipedia is thin.

## Step 3 — write the four entries

**FIGHTER_STATS** (field order used by completed entries):
`ht, dob, reach, stance, slpm, strAcc, sapm, strDef, kd, tdLanded, tdAcc, tdDef, subAvg, finRate, streak, gym`
- Stat values come from [UFCCOM]; bio fields (ht, dob, reach, stance, gym) also from [ESPN].
  **`tdAcc` comes from [ESPN]'s VERIFIED per-fight line, NOT ufc.com** (ufc.com's tdAcc is
  the known under-count bug). `finRate` = (KO + Sub wins) / total wins, rounded to whole %.
- `streak` = consecutive wins since last loss/draw; NCs are skipped, not breakers.
- **Re-verify every stat, even ones already present.** `strAcc` and `sapm` are the two most
  often left stale: take `strAcc` from ufc.com's `Striking accuracy NN%` and `sapm` from its
  `Sig. Str. Absorbed Per Min` — overwrite the old value when it differs. Do the same for the
  whole stat line; a pre-existing number is not a verified number.

**Blank vs. 0 vs. unavailable — keep the key, pick the right value.** Every one of the 16 keys
above must be PRESENT in the entry; never drop a key. The value depends on what the sources show:
  1. **Genuine 0** is written as the value (`kd:0.00`, `tdAcc:"0%"`), never omitted. The script
     reports a real 0 as a value and a blank as `MISSING` — never copy a blank as 0.
  2. **Genuinely unavailable/blank** (confirmed missing after checking **several** sources —
     ufc.com, ESPN, Sherdog, Tapology, Wikipedia) is written as `null` (JS null, NOT the string
     `"null"`, NOT a guessed number). The site renders a `null` stat as a dash (`—`) via
     `setStatCard`, which is the correct "no data" display — do NOT fabricate a value to fill it.
     Note the dashed field in the commit message.
- **Only ONE UFC fight — KEEP the extrapolated per-minute stats, do NOT null them.** When a fighter
  has a single UFC bout, ufc.com's per-minute / per-15-min figures (slpm, sapm, strDef, kd,
  tdLanded, subAvg, strAcc) are computed from that one fight and can look extreme — e.g. strAcc
  100%, or 10+ takedowns/15min off a sub-3-minute finish. Use them anyway; a one-fight
  extrapolation is the official stat and is always preferred over a dash. Do NOT treat small sample
  size as "unavailable." (Exceptions unchanged: take `tdAcc` from the ESPN VERIFIED per-fight line
  when it spans more of the career than the lone UFC fight; keep `null` only for a field genuinely
  blank/absent on the page, e.g. `tdDef` when no opponent attempted a takedown.) If the lookup
  script prints these under `>> STILL MISSING` for a debut fighter, fetch the ufc.com athlete page
  directly and read the single-fight numbers from it rather than nulling them.
- `stance` is never on ufc.com's parse — take it from [ESPN] (or Sherdog/Tapology/Wikipedia).
- When a fighter has landed 0 takedowns, `tdAcc` is `"0%"` — confirm it's a real 0 via the ESPN
  per-fight line `(VERIFIED per-fight 0/N)`, not ufc.com's bugged 0.
- **Takedown defense with no attempts faced:** when ufc.com leaves `tdDef` blank because no
  opponent has ever attempted a takedown (a fighter who's never been taken down), use a
  corroborated value from another source if one exists. If none exists, set `tdDef:null` so it
  renders as a dash — do NOT write `"100%"` (an unverified fabrication) or `"0%"` (a blank
  misread). The same rule applies to any other stat that is blank and uncorroborable.
- Resolve everything on the script's `>> STILL MISSING` line before committing (resolving a field
  can mean confirming it's genuinely blank and setting it to `null`).

**ODDS_HISTORY** — rebuild the FULL history from [BFO], newest first, one entry per fight
that actually happened (match against FIGHT_HISTORY); don't stop at the last few fights.
- Use the **CLOSING line, not the open.** Odds value = consensus of the closing range:
  midpoint of the closing low/high, discarding a single-book outlier when one end is far
  from the cluster and the open. (The open is the left-most number; never record it.)
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
- **Always capture a BJJ/grappling belt rank when one exists** (e.g. `🥋 BJJ Black Belt`).
  Sourcing order: the `belt rank / 'belt' mentions` line in [UFCCOM] (ufc.com's Q&A), then
  Wikipedia, then the fighter's gym page or a grappling-news result. Distinguish a grappling
  RANK from a championship "belt" the fighter won — read the surrounding Q&A snippet. Only
  drop the belt accolade if no source states one.

Also fix the FIGHTERS roster row if rank/record/country is stale —
`data/rankings.json` (API-synced) is the authority for current rank and record.

**DWCS (Dana White's Contender Series) fighters — do NOT touch ACTIVE_ROSTER.** A fighter
who hasn't debuted in the UFC yet, or fought on DWCS and is awaiting a contract decision,
is not on the UFC roster — winning the fight is not the same as winning a contract, and
Dana White's decision can go either way regardless of who won in the cage. Write and verify
the FIGHTERS/FIGHT_HISTORY/FIGHTER_STATS/ODDS_HISTORY/ACCOLADES entries as normal (a real
profile is still worth having pre-fight, for the matchup/odds pages), but leave
`ACTIVE_ROSTER` and `ROSTER_CHANGES` alone. Only after the event, once a fighter is
confirmed signed, add them to `ACTIVE_ROSTER` and log the signing in `ROSTER_CHANGES`
(`added`) — and add anyone who fought and did NOT get signed to `ROSTER_CHANGES` only if
they were mistakenly added to `ACTIVE_ROSTER` already (remove them from there instead).
Mirror any `ACTIVE_ROSTER`/`ROSTER_CHANGES` edit into `data/roster.json` — it's generated
FROM index.html by `scripts/gen-roster.cjs` (which the free `/roster` page reads), so a
hand-edit here is stale until that script next runs; if editing by hand, keep it exact —
same fighters list minus/plus the same names, same `changes` entries.

## Step 4 — verify and commit

- Re-run `python3 scripts/fighter-lookup.py "<Name>" --local-only` and confirm EVERY area
  was corrected, not just touched:
  - **bio** — ht, dob, reach, stance, and **gym** all present and matching the sources
  - **stats** — full line present including **strAcc** and **sapm**; tdAcc is the ESPN value
  - **fight history** — derived record matches the roster row / `data/rankings.json`, streak matches
  - **odds** — count ≈ number of fights with BFO lines, and values are closing (not opening) lines
  - **accolades** — titles/bonuses/records present, plus a 🥋 **belt rank** if any source states one
- Commit index.html together with the new `photos/<slug>.png` (if the lookup saved one
  this run — check the [ESPN] `photo:` line; nothing to add if it said `kept existing`).
  Message format:
  `Name: full stats (strAcc/sapm, fix X), overhaul odds (N entries, fix Y), accolades, photo`

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
