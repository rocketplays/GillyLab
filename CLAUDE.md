# Working in this repo

Short file on purpose. These are the things that have actually caused damage or
near-damage, not general advice.

## 1. NEVER DELETE A "DATALESS" FILE. THEY ARE NOT EMPTY.

This repo lives in `~/Documents`, which is **iCloud Drive**, with *Optimize Mac
Storage* on. That is a deliberate, informed choice — it is not a problem to fix, and
**do not propose moving the repo or disabling iCloud** unless asked.

iCloud offloads the contents of cold files and leaves a stub. The file still reports
its full size. On the Mac, reading it downloads it transparently — which is why
years of normal use never notice. **From a Claude/Cowork sandbox the read fails**
with `errno -35` / `EDEADLK` / "Resource deadlock avoided", because the Linux VM
cannot trigger iCloud's download.

That means:

- `data/odds.json`, `photos/*.jpg` and ~60 others may be unreadable **to you** and
  completely fine **on the owner's machine**.
- They are **real files**. Deleting one deletes real data *and syncs the deletion
  up*. They look exactly like tidy-up-able junk. They are the opposite.
- **`git status` failing from a sandbox is NOT evidence the repo is damaged.**
  On 2026-07-16 I diagnosed the repo as degrading, escalated it to "urgent, blocks
  work", and cost the owner an hour of worry. It was my environment failing. Before
  concluding anything about the repo, check whether the same command works in
  Terminal on the Mac.

**Safe to delete:** iCloud *conflict copies* — `"index 3.html"`, `public/photos 3/`,
`"gl-sheet 2.js"`. Those are duplicates. Nearly all live in `public/`, which
`build-site.sh` does `rm -rf` on every build anyway (`rm -rf public && npm run build`).

## 2. "ABSENT" AND "UNREADABLE" ARE DIFFERENT. NEVER CATCH THEM TOGETHER.

Because of (1), a bare `try/catch → default` around a file read in this repo is a
data-loss bug in a robustness costume. It was live until 2026-07-16:

```js
try { grid = JSON.parse(readFileSync(MASTER)) }
catch { grid = JSON.parse(readFileSync(CARD_FILE))   // 109 fighters
        console.log('master absent — seeded from fight-grid.json') }
// ...then writes that back as the master. 618 fighters -> 109, silently, green.
```

`data/fight-grid-all.json` is the perfect eviction target: 1.4MB, never fetched by
the browser, touched only by a build script twice a day. Cold **by design** — that
is the architecture.

**Rule:** `ENOENT` (genuinely absent, i.e. first run) is the only tolerable read
failure. Anything else — offloaded, truncated, corrupt — must **throw**. Refusing to
run costs a re-run. Guessing costs the sweep.

## 3. Don't let the eager payload grow

`data/fight-stats.json` (~7.9MB) is `fetch()`ed by **every visitor on every page
load**. `data/fight-grid-all.json` (1.4MB) must never be served — it is excluded by
name in `build-site.sh` and cannot use the `data/_` prefix, because that prefix is
also a `.gitignore` rule and CI must persist the file.

`fight-stats-backfill.py` writes with `json.dump(..., indent=0)`, which inflates the
file by ~2.1MB of newlines. `split-fight-grid.cjs` re-compacts it — including on
no-op runs, which is the case that used to leak. If you touch either, verify the
size afterwards.

## 4. Measure before you assert

The repo's own docs are emphatic about this and it caught me four times in one day:
claiming no ESPN route (I curled the wrong host), claiming fighters were stuck (empty
array, not missing data), claiming the repo was degrading (my sandbox), shading a
grid on absolute rates (encoded the axis, not the fighter). **The tell is always the
same: the mechanism arrives before the measurement and explains the data a little too
well.** One cheap measurement killed each.

## 5. Standing exception: git process lock files

Approved 2026-07-30. Claude may delete stray git process lock files without
asking first — specifically `.git/index.lock` and `.git/refs/**/*.lock` — but
only after confirming no git process is actually running (check for a live
`git` process; don't just assume a stuck lock). These are not "dataless"
iCloud stubs and are unrelated to rule 1. This does not extend to any other
file, including package-manager lockfiles (`package-lock.json`, etc.) — those
still require asking.

## Where the detail lives

- `ICLOUD-MIGRATION.txt` — the iCloud situation, measured. Verdict: not urgent.
- `MATCHUP-DEEPDIVE.txt` — the matchup hub, the grid, the division medians, and a
  long list of traps that are all real bugs someone already hit.
- `THE-CLIMB-TUNING.txt` — the climb model.
