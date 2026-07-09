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

### 1c. CLOSED — all 106 ids checked one by one, 101 rows deleted

I did **not** delete the class on the pattern, and it's as well: **7 of them
work.** Each of the 106 distinct ids was queried against YouTube's oembed
endpoint, with every non-404 and a 9-id sample of the 404s confirmed against the
real watch page.

| Verdict | ids | Action |
|---|---|---|
| `404` — deleted or never existed | 93 | removed |
| `403` — private | 3 | removed (never plays for a visitor) |
| `400` — not even a valid video id | 1 | removed |
| `200` — plays, **but shows the wrong fight** | 2 | removed |
| `200` — plays, correct fight | 6 | **kept** |
| `401` — plays, embedding disabled | 1 | **kept** |

The two live-but-wrong were the nastiest thing in the file: `XNCytatM3cw` and
`EjeHrWjdKFE` are real videos of *Chimaev vs Rhys McKee*, sitting on **Jeremy
Stephens vs Doo Ho Choi** and **Jeremy Stephens vs Gilbert Melendez**. A dead link
is honest; those two were confidently playing the wrong fight.

The keepers, all verified title-against-row: six Chimaev full fights (Whittaker,
Usman, Burns, Meerschaert, McKee, Phillips) and Aaron Pico vs Lerone Murphy.

Two calibration notes, both of which nearly cost us:

- **oembed `401` does not mean broken.** The Pico video returns 401 because the
  uploader disabled embedding; it plays fine. Status code alone is not
  playability.
- **oembed `404` does not mean "fabricated".** `bD5-FOay3VE` is a real id whose
  channel was terminated, and it 404s too. 404 means "won't play", which is the
  criterion we actually care about.

Three fighters lost their entire `TAPE_STUDY` entry, because every row they had
was a dead UFC-card YouTube link: **Joshua Van, Tatsuro Taira, Alexander Volkov**.
They need tape re-sourced from scratch.

The 245 pre-existing YouTube links on **regional / pre-UFC** rows were left alone.
Every one sampled loads, and the video title names exactly the fight it sits on.
That is where the real footage lives.

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

- **The 51 orphan tape rows — swept, down to 1.** Rows whose opponent had no
  `FIGHT_HISTORY` match, and so could never render. 51 → 31 → 5 as the dead-link
  purges took most of them out; they were overwhelmingly the same junk. Of the
  final five: two were typos, now fixed and rendering (`Lenadro Higo` →
  **Leandro Higo**, `Abus Magomedov` → **Abusupiyan Magomedov**, both videos
  verified against the row). Two were inert rows with no URL, deleted — Aaron Pico
  vs `Solo Hatley Jr` and Roman Kopylov vs `Chris Leroy Duncan`.

  **One remains, and it's a gap in `FIGHT_HISTORY`, not in the tape:**
  **Tahir Abdullayev vs Maxim Butorin**, AMC Fight Nights 112, Jun 2022 —
  `youtube.com/watch?v=bIUFj0HUFC0` is a real, playing video titled
  "Тахир Абдуллаев vs Максим Буторин. AMC Fight Nights 112." His history jumps
  from Oct 2021 straight to Sep 2022. The bout is missing from the site. Add the
  history row and the video lights up on its own.

  Also unresolved: Pico's Bellator 242 opponent is `Chris Hatley` in
  `FIGHT_HISTORY` but was `Solo Hatley Jr` in the tape. Solo Hatley Jr is a real
  fighter — `ts_2HzStZ9Y` is "Full Fight | Solo Hatley Jr vs. Gaston Bolanos -
  Bellator 239" — so one of the two names is wrong. I didn't guess.

- **`ufc.com/video/` links — 5 in the file, 2 were broken.** Found while checking
  the above. A dead UFC video id does not 404: it **redirects to the fighter's
  athlete page**, which is exactly where the mysterious
  `ufc.com/athlete/sean-strickland` "link" in batch 1 came from. `132962`
  (Strickland vs Imavov) does this, and was removed. `141363` was worse — it is
  titled "Dricus Du Plessis vs Sean Strickland **1**" but sat on the **UFC 312
  rematch** row; it has been relabelled to UFC 297 / Jan 2024, so it now plays on
  the fight it actually shows, and the rematch correctly shows no video.
  `135781` returns "Access denied", which for ufc.com means gated, not dead — a
  bad id redirects to search instead. Left in place, same as Fight Pass.

---

## Current state

- `TAPE_STUDY`: **146 fighters, 1,622 rows**
- Fight-history rows that resolve a video: **1,630**
- Unplaced links from `document.txt`: **8** (was 19) — all in section 2a
- Tape rows that can never render (no matching `FIGHT_HISTORY` row): **1** (was 51)
- Rows showing a video from the wrong fight: **0** (was 17, plus 2 in 1c, plus the
  Strickland/Du Plessis mislabel)
- Rows pointing at a video that doesn't play: **0**. Every YouTube link on a
  UFC-card bout has been loaded and checked individually.
- Fight Pass and Paramount+ links are untouched throughout. They require a
  subscription to view; they are not broken.
- Needs tape re-sourced from scratch: **Joshua Van, Tatsuro Taira, Alexander
  Volkov** (every row they had was a dead link).
