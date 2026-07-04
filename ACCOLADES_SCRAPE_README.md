# Filling missing accolades from Wikipedia

Two scripts, run in order. This **only** fills the **Accolades** tab for the
~2,320 fighters who currently have none. It never touches bio, stats, or fight
records (FIGHTERS / FIGHTER_STATS / FIGHT_HISTORY) — those stay exactly as they
are. Curated accolades already in the DB are never overwritten.

## One-time setup

```bash
pip3 install requests
```

## Step 1 — Scrape Wikipedia (you run this; it hits the network)

```bash
cd /path/to/GillyLab

# Try one fighter first, prints only, writes nothing:
python3 gillylab_wikipedia_accolades.py --test "Kenny Florian"

# Full run — every roster fighter missing accolades (~2,320).
# Writes results incrementally, so it's safe to stop (Ctrl-C) and re-run to resume.
python3 gillylab_wikipedia_accolades.py
```

Options: `--limit N` (first N targets), `--start N --limit N` (resume window),
`--all` (re-scrape everyone, including those who already have accolades).

Produces two files in the repo root:

- `accolades_wikipedia.json` — `{ "Fighter Name": [ {icon,title,detail}, … ] }`
- `accolades_wikipedia.log` — per-fighter notes (found N / no page / no accolades)

A full run takes a while (there's a polite delay between requests). It resumes
where it left off, so you can run it in chunks. When it finishes it prints
`Next: python3 gillylab_apply_accolades.py` — ignore that line; use Step 2 below.

**Review before applying.** Skim `accolades_wikipedia.json` (or the `.log`) for
anything obviously wrong. You can hand-edit the JSON before Step 2.

## Step 2 — Apply into index.html (accolades only)

```bash
# Dry run first — reports how many will be added, changes nothing:
node scripts/apply-accolades.cjs

# Apply for real:
WRITE=1 node scripts/apply-accolades.cjs
```

This merges the scraped accolades into the `ACCOLADES` object **only**, and only
for fighters who have none yet. It:

- skips anyone who already has curated accolades (never overwrites),
- skips any name not on the roster,
- orders each new fighter's list the house way (BJJ belt → other belts/masters →
  championships & awards, newest→oldest),
- runs an integrity check that **aborts** if any existing fighter's entries would
  change, and refuses to write on any problem.

Icons: 🏆 championship/title/belt · 🏅 record/award/"of the year"/Hall of Fame ·
⭐ performance bonus ("of the night") · 🥋 BJJ belt · 🤼 wrestling/grappling ·
🥇🥈🥉 competition medals.

## Step 3 — Review, then commit

```bash
git diff --stat            # should show only index.html changed
git add index.html
git commit -m "Fill missing fighter accolades from Wikipedia"
git push
```

Because the app is served by the Cloudflare Worker from bundled files, run a
deploy afterward (or let the next scheduled odds run redeploy) so the change
reaches gillylab.com:

```bash
npm run deploy
```
