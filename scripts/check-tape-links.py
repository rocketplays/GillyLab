#!/usr/bin/env python3
"""Check every YouTube link in TAPE_STUDY for videos that no longer play.

    python3 scripts/check-tape-links.py            # report
    python3 scripts/check-tape-links.py --ids-only # just the dead ids, for piping

WHY THIS EXISTS
A dead tape link is worse than no tape link: the row reads as covered, so the
bout never comes back on a gap report, and the reader gets an error page.
On 2026-07-21 a sweep found 32 deleted videos that had been live for months.

HOW IT DECIDES
youtube.com/oembed returns JSON for a playable video and an HTTP error for one
that is gone or locked down:
    404  video deleted, or the channel was deleted/made private   -> DEAD
    401/403  age-restricted, region-locked, or embedding disabled  -> UNCERTAIN
Only 404 is treated as dead. 401/403 can still play for a signed-in viewer, so
those are printed for a human to open rather than stripped automatically.

DO NOT read a bare "Forbidden" body as "embedding disabled, video is fine" —
that was assumed once and it was wrong; those videos were on channels that had
gone private and did not play at all. If oembed will not confirm a video, the
link is unverified. Do not place it.
"""
import json, re, subprocess, sys, urllib.error, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HTML = (ROOT / "index.html").read_text(encoding="utf8")


def balanced(marker):
    i = HTML.index(marker)
    depth, k = 0, HTML.index("{", i)
    while k < len(HTML):
        if HTML[k] == "{":
            depth += 1
        elif HTML[k] == "}":
            depth -= 1
            if not depth:
                break
        k += 1
    return HTML[i:k + 1] + ";"


def tape_study():
    src = balanced("const TAPE_STUDY = {") + "\nconsole.log(JSON.stringify(TAPE_STUDY));"
    out = subprocess.run(["node", "-e", src], capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def main():
    ids = {}
    for fighter, rows in tape_study().items():
        for row in rows:
            m = re.search(r"youtube\.com/watch\?v=([\w-]{11})", row.get("url") or "")
            if m and m[1] not in ids:
                ids[m[1]] = "%s vs %s" % (fighter, row["opponent"])

    dead, uncertain = [], []
    for vid, label in ids.items():
        url = ("https://www.youtube.com/oembed?url=https://www.youtube.com/"
               "watch?v=%s&format=json" % vid)
        try:
            urllib.request.urlopen(url, timeout=6).read()
        except urllib.error.HTTPError as e:
            (dead if e.code == 404 else uncertain).append((vid, label, e.code))
        except Exception as e:                      # network flake, not a verdict
            uncertain.append((vid, label, type(e).__name__))

    if "--ids-only" in sys.argv:
        print("\n".join(v for v, _, _ in dead))
        return 1 if dead else 0

    print("checked %d youtube links" % len(ids))
    print("\nDEAD (404, safe to strip): %d" % len(dead))
    for v, l, _ in dead:
        print("   %s  %s" % (v, l))
    print("\nUNCERTAIN (open these yourself before touching them): %d" % len(uncertain))
    for v, l, c in uncertain:
        print("   %s  %s  [%s]" % (v, l, c))
    return 1 if dead else 0


if __name__ == "__main__":
    sys.exit(main())
