# Fill Fighter — workflow & data rules

How to populate / correct an MMA fighter's profile in `index.html`. When asked to
"fill fighter <Name>", follow this exactly.

## Per-fighter steps
1. Run `python3 scripts/fighter-lookup.py "<Name>"` — aggregates LOCAL / UFC.com /
   ESPN / BestFightOdds and saves `photos/<slug>.png`. (If ESPN didn't match by
   name, re-run with `--espn-id <id> --force-photo`.)
2. Pull the fighter's full ESPN fight history
   (`espn.com/mma/fighter/history/_/id/<id>`) and treat ESPN as authoritative.
   Cross-check Sherdog/Wikipedia when ESPN looks stale (e.g. a fighter who left
   the UFC and kept fighting on the regional scene).
3. Edit all five data structures in `index.html`: `FIGHTERS` (roster row),
   `FIGHTER_STATS`, `ODDS_HISTORY`, `FIGHT_HISTORY`, `ACCOLADES`.
4. Syntax-check: extract inline `<script>` → `node --check`.
5. Run `python3 scripts/fighter-lookup.py "<Name>" --local-only` and confirm the
   derived record + win streak match.
6. `python3 photos/generate_thumbs.py`, then commit (one commit per fighter).

## Accuracy mandate
Local data is frequently WRONG, not just incomplete — fabricated fight histories,
fake odds opponents, placeholder DOBs (`1990-01-01` etc.), wrong division/country,
draws that are actually No Contests. Don't just fill blanks: verify every value
against ESPN and overwrite anything wrong. If the local fight history opponents
don't match ESPN/BFO, assume it's fabricated and rebuild it from ESPN.

## Record
- The roster `record` is the full PRO MMA record, and must equal what
  `--local-only` derives from `FIGHT_HISTORY`.
- **TUF bouts:** The Ultimate Fighter tournament/exhibition fights (prelims,
  quarterfinals, semifinals) DO NOT count. Only the TUF Finale (held on a real
  UFC card) counts. Exclude the exhibition bouts from `FIGHT_HISTORY`.
- **No Contests:** record is `W-L-0` with a trailing `// 1 NC` comment; the fight's
  `result` field is `"NC"` (never `"D"`), so it derives as a No Contest, not a draw.

## Odds (ODDS_HISTORY)
Use the **CLOSING** line — in each BestFightOdds row (`name | opener | ... | closer
| %move | arrow`) take the number right before the % movement, NOT the opener.
Only include opponents the fighter actually fought (drop cancelled bookings).

## Stats (FIGHTER_STATS)
- Per-minute values (slpm, sapm, strAcc, strDef, kd, tdLanded, subAvg) come from
  UFC.com. **Record every value UFC.com reports, even a one-off / small-sample
  extrapolation — never null a field that has a number.**
- **Sanity-check** any value that looks off (implausibly low/high, e.g. slpm 0.41).
  UFC.com is sometimes broken for a fighter. Verify against ESPN's per-fight stats
  page (`espn.com/mma/fighter/stats/_/id/<id>`): sum per-fight SSL / SSA / KD /
  takedowns over total fight time and use the ESPN-derived figure when UFC.com is
  clearly wrong. (Absorbed stats — sapm/strDef — come from the opponents' pages.)
- `tdAcc`: use ESPN's verified per-fight value when it disagrees with UFC.com.
- `finRate` = (KO/TKO + submission wins) / total wins.
- `streak` = current win streak (0 if the last result was a loss/NC; no negatives).
- `null` only for a field genuinely unavailable across all sources (renders as a dash).

## Accolades
- Check UFC.com **bio + Q&A** for grappling belt rank (judo/BJJ) → 🥋 accolade.
  The Q&A is often the only place a belt is stated; read the FULL Q&A answer — the
  lookup's snippet can truncate mid-phrase (e.g. "Black Belt in TKD, Black Belt in
  …BJJ").
- Other accolades: titles won (regional or UFC), tournament wins (TUF, DWCS,
  Road to UFC, GP), Olympic/notable background, finish breakdowns.
