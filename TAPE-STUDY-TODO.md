# Tape study — outstanding items

Generated 2026-07-09. Everything here needs a human decision; none of it was
guessed at. Nothing below is currently showing a wrong video — the rows in
sections 1 and 2 render the same "no footage" placeholder as an uncatalogued
fight.

---

## 1. Batch 1 fallout — one video attached to two or three fights

These URLs each sat on multiple rows in `TAPE_STUDY`, so they were wrong on all
but one. YouTube titles aren't fetchable from here, so the URL was detached from
every row rather than assigned at random. Pick the right fight for each and I'll
reattach it.

| # | Fighter | URL | Candidate fights |
|---|---------|-----|------------------|
| 1 | Sean Strickland | `https://www.ufc.com/video/139275` | vs **Dricus du Plessis** (Feb 9, 2025 · UFC 312) · vs **Israel Adesanya** (Sep 10, 2023 · UFC 293) |
| 2 | Sean Strickland | `https://www.ufc.com/athlete/sean-strickland` | **Not a video — an athlete profile page.** Was on Brendan Allen (Nov 14, 2020), Court McGee (Nov 11, 2017), Kamaru Usman (Apr 8, 2017). Probably just delete it. |
| 3 | Jim Miller | `https://www.youtube.com/watch?v=ZDPa2eFVqMY` | vs **Chase Hooper** (Apr 12, 2025 · UFC 314) · vs **Nikolas Motta** (Feb 19, 2022) |
| 4 | Jim Miller | `https://www.youtube.com/watch?v=BcVqxX4FNP0` | vs **Gabriel Benitez** (Jan 13, 2024) · vs **Donald Cerrone** (Jul 2, 2022 · UFC 276) · vs Drakkar Klose † |
| 5 | Jim Miller | `https://www.youtube.com/watch?v=O5DMJPmETSY` | vs **Clay Guida** (Aug 3, 2019) · vs **Dustin Poirier** (Feb 11, 2017 · UFC 208) · vs **Joe Lauzon** (Aug 27, 2016) |
| 6 | Jared Gordon | `https://www.youtube.com/watch?v=LNhQK2P3c7Y` | vs Billy Quarantillo † · vs Julio Arce † — **both fights are missing from FIGHT_HISTORY, so this link cannot display either way** |
| 7 | Jared Gordon | `https://www.youtube.com/watch?v=8WqbX7T5mjs` | vs **Mark Madsen** (Nov 11, 2023 · UFC 295) · vs **Chris Fishgold** (Jul 16, 2020) |
| 8 | Roman Kopylov | `https://www.youtube.com/watch?v=Ym9kG5hHsNA` | vs Abdul Razak Alhassan † · vs **Albert Duraev** (Oct 30, 2021 · UFC 267) |
| 9 | Pat Sabatini | `https://www.youtube.com/watch?v=wLmYHqCEJbU` | vs **Chepe Mariscal** (Nov 15, 2025 · UFC 322) · vs **Tucker Lutz** (Nov 20, 2021) |
| 10 | Pat Sabatini | `https://www.youtube.com/watch?v=vSoQBX5d9Tk` | vs **Lucas Almeida** (Jun 17, 2023) · vs Herbert Burns † |
| 11 | Pat Sabatini | `https://www.youtube.com/watch?v=Z8KQFJRxJwU` | vs TJ Brown † · vs Felipe Colares † — **both missing from FIGHT_HISTORY** |

† = that fight has no row in `FIGHT_HISTORY`, so a link attached to it would
never render.

One duplicate resolved itself: Brandon Royval's fightpass slug literally reads
`ufc-vegas-34`, so it stayed on the Aug 2021 Pantoja fight and came off the Dec
2023 one.

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

- `TAPE_STUDY`: **150 fighters, 1,780 rows**
- Fight-history rows that resolve a video: **1,703** (was 1,214 before this batch)
- Rows showing a video from the wrong fight: **0** (was 33)
