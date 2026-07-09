# Tape study — outstanding items

Generated 2026-07-09, revised 2026-07-09. Everything here needs a human decision;
none of it was guessed at. Nothing below is currently showing a wrong video — the
rows in section 2 render the same "no footage" placeholder as an uncatalogued
fight.

---

## 1. Batch 1 fallout — CLOSED

The 11 URLs pointed at videos that don't exist, so there was no right fight to
reassign them to. The 25 rows holding them were deleted outright: a row with no
video is indistinguishable from an uncatalogued fight, so it carried no
information. `TAPE_STUDY` went 1,780 → 1,755 rows, and the number of fight-history
rows that resolve a video was **unchanged at 1,723** — confirming the deleted
rows were rendering nothing.

Affected: Sean Strickland (5 rows), Jim Miller (8), Jared Gordon (4), Roman
Kopylov (2), Pat Sabatini (6).

One duplicate resolved itself and was kept: Brandon Royval's fightpass slug
literally reads `ufc-vegas-34`, so the video stayed on the Aug 2021 Pantoja fight
and came off the Dec 2023 one. His Dec 2023 row is now an ordinary uncatalogued
fight.

---

## 1b. Pre-existing collisions — CLOSED, and they were a symptom

**17** URLs (not 12 — my first count had a bug, see below) each sat on two
fights from different months. All 17 were YouTube. I loaded every one of them in
a browser: **all 17 are dead**, showing "This video isn't available anymore".
Both rows deleted for each, 34 rows total. Jose Ochoa's entire `TAPE_STUDY` entry
came off, since all three of his links were in this set.

The collision was never the real problem.

### What the check actually found

Chasing those 17 IDs surfaced a pattern. There are two distinct YouTube failure
messages, and they mean different things:

- *"the YouTube account associated with this video has been terminated"* — a real
  video ID whose channel was later removed.
- *"This video isn't available anymore"* — the generic response for an ID that was
  deleted or never existed.

Sampling 31 IDs across the corpus splits perfectly along one line, and it is not
the line I expected:

| | loaded OK | dead |
|---|---|---|
| YouTube link on a **regional / pre-UFC** row | 6 of 6 | 0 |
| YouTube link on a **UFC-banner** row | 0 of 25 | 25 |

Every regional link resolves to a real video whose **title names exactly the
fight it is attached to** (e.g. `D40Qen3rFmQ` = "WFC 24 / Brave : Ivica Truscek vs
Benoit St. Denis", on the Benoît Saint Denis vs Ivica Trušček row). Every UFC-card
link is unplayable — 24 gone, 1 private.

That makes sense: UFC full fights aren't hosted on public YouTube, they're on
Fight Pass. A YouTube link on a UFC bout was never going to work.

### 1c. STILL OPEN — 108 more of the same

After deleting the 34, **108 pre-existing YouTube links remain on UFC-banner
rows**, across 24 fighters. I verified 25 of that class were dead; the other 108
are unverified but are the same shape, from the same source, on the same kind of
bout.

Worst offenders: Jeremy Stephens (10), Khamzat Chimaev (9), Sean Strickland (8),
Tatsuro Taira (8), Joaquin Buckley (8), Alexander Volkov (7), Joshua Van (6).

I stopped here rather than delete 108 rows on an inference. Two options: I can
load all 108 in the browser and delete only the confirmed-dead ones (slow but
certain), or delete the class outright on the pattern above. Your call.

Note the 245 pre-existing YouTube links on **regional** rows look fine and should
be left alone — that's where the real footage lives.

### Correction to my earlier count

I first reported 12 conflicts. The classifier was wrong: it called a group "one
event page, several bouts" whenever the fights' dates collapsed to a single
value, which is trivially true when only one of the two rows has a
`FIGHT_HISTORY` date. Re-running it against the tape rows' own event labels
(month + year) gives **17 conflicts, 42 mirrored, 22 event pages**. `gvNBqLJMT3s`
and `8bF9kNbvKR4` were among the ones it wrongly cleared.

Legitimate sharing, left alone: 42 URLs sit on two rows because it's the same
fight seen from both fighters' pages, and 22 are event pages covering several
bouts from one night (e.g. `ufcfightpass.com/video/206203` = *UFC Fight Night:
Hall vs Silva*, on three fights from that card).

---

## 2. Batch 2 — links from `document.txt` that could not be placed

**8 of 510 remain.** You resolved 11 of the original 19 on 2026-07-09; those are
placed or deleted, per your calls, below.

### 2a. Fighter doesn't exist on the site (8 links) — STILL OPEN

Neither name appears in `FIGHTERS` or `FIGHT_HISTORY`, so there is nowhere to
attach the tape. Add the fighter first and these drop straight in.

**RJ Harris**
- vs Phillip Latu — `https://www.youtube.com/watch?v=_S8DCKXICHE`
- vs Alex Marro — `https://www.youtube.com/watch?v=iKViS2-ebhg`
- vs Austin Green — `https://www.youtube.com/watch?v=NmVDi_sQEqg`
- vs Charlie Cleveland — `https://www.youtube.com/watch?v=xUax34bgFaI`

**Anna Melisano**
- vs Andrea Amaro — `https://ufcfightpass.com/video/901204`
- vs Lydia Warren — `https://ufcfightpass.com/video/855716`
- vs Blanca Medina — `https://ufcfightpass.com/video/757939`
- vs Ana Martinez — `https://ufcfightpass.com/video/695542`

### 2b, 2c, 2d — CLOSED

| Link | Call | Done |
|------|------|------|
| Jacobe Smith `video/694840` | → Christien Savoie | placed (Oct 1, 2024, DWCS) |
| David Martínez `_K14L-SQyXw&t=648s` | → Alan Cantú | placed (May 29, 2021) |
| Magomedrasul Gasanov `LsoOrU5ST7Y` | bad link | dropped |
| Magomed Ankalaev `cVkgL_QZ1BU` | combat sambo, not the bout | dropped |
| Felipe Franco `yDMxL28AlUY` | → Murilo dos Santos Ferreira | placed (Aug 31, 2024) |
| Ismael Bonfim `XNDAxNzYzMDc3Ng` | bad link | dropped |
| Alvin Hines `video/606698` | → Justin Smith | placed (Apr 5, 2024, LFA 181) |
| Alvin Hines `oFeqjtljfMY` | "Will Smith" is **Will Johnson** | placed (Jan 12, 2024, LFA 174) |

The four dropped links were never written to `index.html`, so nothing had to be
removed — they only ever lived in this file.

**David Martínez was never a collision.** `_K14L-SQyXw` is a single Combate Global
broadcast of the May 29, 2021 bantamweight tournament, and the two links point at
different timestamps of it: `t=4745s` is the Francisco Rivera fight (already
placed), `t=648s` is Alan Cantú. Both are now on the right rows.

Two others in this class had been placed earlier, because the URL named its own
fight: Valter Walker's `mma-seria-47-kobenov-ignasio` went to Aybek Kobenov, and
Sam Patterson's `yanal-ashmoz-vs-sam-patterson-ufc-286` went to Yanal Ashmouz.

---

## 3. Data inconsistencies worth a look

- **`Lenny Lovoto` — settled, one loose end.** Usman's Legacy FC 30 row and its
  tape link both read *Lovoto*, per your call, so nothing changed. But
  `FIGHT_HISTORY` also has **Gabe Ruediger vs `Lenny Lovato`** (Jul 9, 2010, TPF 5:
  Stars and Strikes) — a different fight four years earlier. If that's the same
  man, one of the two spellings is wrong. I left it alone rather than guess that
  they're the same person.

- **`Dricus du Plessis` vs `Dricus Du Plessis`.** 7 places in `index.html` use the
  capital `Du`, 20 use lowercase. The canonical `FIGHTERS` spelling is lowercase
  and everything resolves through it via the slug, so nothing is broken — just
  inconsistent.

- **51 tape rows point at an opponent with no `FIGHT_HISTORY` row** (42 of them
  carry a URL). Those rows can never render, because the Tape Study page and the
  profile's Fight History tab both iterate `FIGHT_HISTORY` and look the video up
  per fight. Either the bouts are missing from history, or the opponent names
  disagree between the two tables. Worth a sweep.

---

## Current state

- `TAPE_STUDY`: **149 fighters, 1,726 rows**
- Fight-history rows that resolve a video: **1,707**
- Unplaced links from `document.txt`: **8** (was 19) — all in section 2a
- Rows showing a video from the wrong fight: **0** (was 17)
- Rows pointing at a video that almost certainly doesn't exist: **108**, all
  pre-existing YouTube links on UFC-card bouts (section 1c). Nothing either
  upload added is affected.
