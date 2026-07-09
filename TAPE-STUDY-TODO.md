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

19 of 510. Everything else is live.

### 2a. Fighter doesn't exist on the site (8 links)

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

### 2b. One video listed against two different fights (6 links)

Same problem as section 1, in the source file this time. Tell me which fight each
belongs to.

| Fighter | URL | Listed against |
|---------|-----|----------------|
| Jacobe Smith | `https://ufcfightpass.com/video/694840` | Preston Parsons **and** Christien Savoie |
| David Martinez | `https://www.youtube.com/watch?v=_K14L-SQyXw&t=648s` | Alan Cantu Garcia **and** Alex Gonzalez |
| Magomedrasul Gasanov | `https://www.youtube.com/watch?v=LsoOrU5ST7Y` | Albert Tumenov **and** Salamu Abdurakhmanov |

Two others in this class *were* placed, because the URL named its own fight:
Valter Walker's `mma-seria-47-kobenov-ignasio` went to Aybek Kobenov, and Sam
Patterson's `yanal-ashmoz-vs-sam-patterson-ufc-286` went to Yanal Ashmouz.

### 2c. Opponent has no row in that fighter's FIGHT_HISTORY (3 links)

The fight itself is missing from the site, so there's nothing to hang the video
on. Either the bout is absent from `FIGHT_HISTORY` or the name is spelled
differently enough that I wouldn't guess.

- **Magomed Ankalaev** vs Nadir Bulkhadarov — `https://www.youtube.com/watch?v=cVkgL_QZ1BU`
- **Felipe Franco** vs Murilo Magalhães — `https://www.youtube.com/watch?v=yDMxL28AlUY` (closest history row: *Murilo dos Santos Ferreira*, Aug 31, 2024)
- **Ismael Bonfim** vs Mateus Nascimento — `https://v.youku.com/v_show/id_XNDAxNzYzMDc3Ng==.html` (closest: *Mateus Nery da Cruz*, Dec 22, 2018)

### 2d. Two links, one fight on record (2 links)

**Alvin Hines** has a `Justin Smith` fight (Apr 5, 2024) in `FIGHT_HISTORY` but no
`Will Smith`. The file supplies tape for both, so one of them is either a fight
we're missing or a mislabelled opponent.

- vs Justin Smith — `https://ufcfightpass.com/video/606698`
- vs Will Smith — `https://www.youtube.com/watch?v=oFeqjtljfMY`

---

## 3. Data inconsistencies worth a look

- **`Lenny Lovoto` vs `Lovato`.** `FIGHT_HISTORY` spells Usman's Legacy FC 30
  opponent *Lovoto*; the first upload said *Lovato*. The link is attached (I used
  your spelling), but one of the two is a typo.

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

- `TAPE_STUDY`: **150 fighters, 1,755 rows**
- Fight-history rows that resolve a video: **1,723**
- Rows showing a video from the wrong fight: **12 pairs, all pre-existing** (section 1b).
  Nothing either upload added is misplaced.
