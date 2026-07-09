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

## 1b. Pre-existing collisions — one video ID on two unrelated fights

Found while cleaning up section 1, and **not introduced by either upload** — all
12 predate the first tape-study commit. A YouTube ID identifies exactly one
video, so in each pair one placement is wrong and is showing the wrong fight
right now.

I did not touch these. They were not part of what you asked for, and unlike
section 1 the videos are presumably real, so the fix is to work out which fight
each belongs to rather than delete.

| URL | Placement A | Placement B |
|-----|-------------|-------------|
| `youtube.com/watch?v=mY9J4NqOqzU` | Joshua Van vs Rei Tsuruya (Mar 8, 2025) | Sean Brady vs Jake Matthews (Mar 6, 2021) |
| `youtube.com/watch?v=tBmVkXqJcNA` | Joshua Van vs Felipe Bunes (Jan 13, 2024) | Jose Ochoa vs Asu Almabayev (Jul 26, 2025) |
| `youtube.com/watch?v=mGbTkNxFpLE` | Joshua Van vs Kevin Borjas (Nov 11, 2023) | Jose Ochoa vs Lone'er Kavanagh (Nov 23, 2024) |
| `youtube.com/watch?v=pQnKJxF7mYE` | Joshua Van vs Zhalgas Zhumagulov (Jun 24, 2023) | Jose Ochoa vs Cody Durden (Jun 14, 2025) |
| `youtube.com/watch?v=Xm5RQ4sXhFE` | Alexander Volkov vs Walt Harris (Oct 24, 2020) | Waldo Cortes-Acosta vs Serghei Spivac (Jun 7, 2025) |
| `youtube.com/watch?v=JKb3qjG7LZA` | Alexander Volkov vs Derrick Lewis (Oct 6, 2018) | Waldo Cortes-Acosta vs Derrick Lewis (Jan 24, 2026) |
| `youtube.com/watch?v=XcMbEjPoW5A` | Grant Dawson vs Bobby Green (Oct 7, 2023) | Jim Miller vs Bobby Green (Apr 13, 2024) |
| `youtube.com/watch?v=hQmSY8JpGnM` | Jim Miller vs Damon Jackson (Nov 16, 2024) | Clayton Carpenter vs Juancamilo Ronderos (Feb 18, 2023) |
| `youtube.com/watch?v=3mK4wbD8YxY` | Joaquin Buckley vs Takashi Sato † | Marco Tulio vs Vitor Petrino † |
| `youtube.com/watch?v=WJqxMbCPKlE` | Joaquin Buckley vs Michal Oleksiejczuk † | Marco Tulio vs Karl Roberson † |
| `youtube.com/watch?v=T7A3q2Kwm_E` | Joel Alvarez vs Davi Ramos † | Grant Dawson vs Alan Patrick † |
| `youtube.com/watch?v=GYN8f1N6P4s` | Joel Alvarez vs Stevie Ray † | Grant Dawson vs Nasrat Haqparast † |

† = neither fight has a `FIGHT_HISTORY` row, so neither placement renders. Those
four are harmless today but still wrong.

The last two pairs share a suspicious shape — Volkov/Cortes-Acosta and
Buckley/Marco Tulio and Alvarez/Dawson are each *heavyweight-ish fighter paired
with a different heavyweight-ish fighter*, four fights deep. That looks like a
block of links copied onto the wrong fighter wholesale, not four coincidences.

Legitimate sharing, left alone: 42 URLs sit on two rows because the same video is
the same fight seen from both fighters' pages, and 27 are event pages covering
several bouts from one night (e.g. `ufcfightpass.com/video/206203` =
*UFC Fight Night: Hall vs Silva*, on three fights from that card).

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

- `TAPE_STUDY`: **150 fighters, 1,760 rows**
- Fight-history rows that resolve a video: **1,728**
- Unplaced links from `document.txt`: **8** (was 19) — all in section 2a
- Rows showing a video from the wrong fight: **12 pairs, all pre-existing** (section 1b).
  Nothing either upload added is misplaced.
