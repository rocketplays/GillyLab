# Fight Pass tape-sweep relay

Fills `TAPE_STUDY` in `index.html` with UFC Fight Pass video links, in bulk, without
piping data through a chat window. The browser does the searching (using its own
logged-in token) and drops a results file; a Node script matches + merges + verifies.

Nothing here handles your credentials — the sweep runs inside your logged-in Fight
Pass tab and uses the token already in that page. Merges are **append-only**: an
existing tape row (YouTube or otherwise) is never modified or overwritten.

## One-time per batch

**1. Generate the browser sweep script** (pick a scope):

```
node scripts/gen-fp-sweep.cjs ranked          # all ranked fighters (default)
node scripts/gen-fp-sweep.cjs all             # every fighter with an untaped bout
node scripts/gen-fp-sweep.cjs "Welterweight"  # one division
```

This writes `scripts/fp-sweep.js` (a self-contained script with the fighters +
their untaped opponents embedded).

**2. Run it in the browser.** Open `https://ufcfightpass.com` in Chrome, logged in.
Open DevTools console (Cmd+Opt+J), paste the entire contents of `scripts/fp-sweep.js`,
Enter. It prints progress (`swept 20/… `) and, when finished, downloads
`fp-results.json`.

The run is **resumable**. It saves progress to the tab's `localStorage` after every
20 fighters and auto-refreshes the auth token. If the token still expires on a very
long run (thousands of fighters), it prints `TOKEN EXPIRED … Progress saved` and stops —
just **reload the tab and paste the script again**; it skips everyone already done and
continues, auto-downloading when complete. You can also call `fpDownload()` in the
console at any point to grab progress so far. (To start over from scratch, run
`localStorage.removeItem('fp_sweep_out')` first.)

Big scopes are slow: `all` is ~3,000 fighters (~15+ min across a couple of reloads).
Running per-division or `ranked` finishes inside one token lifetime with no reloads.

**3. Move the file into the repo:**

```
mv ~/Downloads/fp-results.json ~/Documents/GitHub/GillyLab/data/
```

**4. Ingest — dry run first, then write:**

```
node scripts/fp-ingest.cjs data/fp-results.json            # reports counts + flags
node scripts/fp-ingest.cjs data/fp-results.json --write    # merges into index.html
```

The `--write` pass appends the rows and then verifies two things: every new row
resolves through the app's own `findTapeStudyUrl`, and **zero** pre-existing rows were
lost. If either check fails it says so — restore `index.html` from git and investigate.

**5. Resolve rematch flags (if any).** Rematches and duplicate-VOD cases are never
guessed — they go to `data/fp-ingest-flags.txt` with the candidate titles. Read them,
add the correct rows to `data/fp-ingest-place.json` with the right per-fight event
label (e.g. `"UFC 281 · Nov 2022"`), and re-run `--write`. This is the only manual step,
and it's exactly the check that prevents mis-dated links.

**6. Commit** (from Terminal — the repo is on iCloud and a sandbox can't commit it):

```
git add index.html && git commit -m "Tape: FP bulk sweep" && git push
# if rejected: git pull --rebase origin main && git push
```

## Notes / safety

- **Never overwrites free tape.** Only opponents with *no* existing tape row are added.
- **No cross-contamination.** A card is accepted only when the FP bout title contains
  the fighter (exact surname + first name) on one side and the opponent on the other —
  so "Alex Perez" can't land on "Alex Pereira", etc.
- **2025–26 fights** mostly aren't on Fight Pass (they moved to Paramount+); those
  simply won't match and stay as gaps for a separate Paramount+ pass.
- Re-running is safe and idempotent: already-taped bouts are skipped every time.
