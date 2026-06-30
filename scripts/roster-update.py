#!/usr/bin/env python3
"""
roster-update.py — weekly Active Roster update (Option B: manual trigger).

Flow each week:
  1) Open Chrome to roster.watch; Claude scrapes the current active roster and
     writes the names (one per line) to a snapshot file.
  2) Run this script with that snapshot:
         python3 scripts/roster-update.py /tmp/active_roster.txt
     It diffs the new snapshot against the ACTIVE_ROSTER currently embedded in
     index.html (= last week's snapshot), then:
       - replaces ACTIVE_ROSTER with the new (sorted) list
       - prepends a dated entry to ROSTER_CHANGES with added/removed names
     Add --week "Jun 23-29, 2026" to label the entry (default: today's date).
     Use --dry-run to preview the diff without writing.

Notes
-----
* "Removed" fighters left the ACTIVE roster (active -> former). They are NOT
  removed from your FIGHTERS database — your DB intentionally keeps former
  fighters; the log just records the change for display.
* "Added" fighters are candidates to add to your DB via the import pipeline.
* Matching is by exact name (roster.watch names are stable week to week). If a
  one-off spelling change shows up as a spurious add+remove pair, fix it by hand.
"""
import argparse, datetime, re, sys, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX = os.path.join(ROOT, "index.html")

def read_active_roster(html):
    m = re.search(r'const ACTIVE_ROSTER = \[(.*?)\];', html, re.S)
    if not m:
        return None
    return [x for x in re.findall(r'"((?:[^"\\]|\\.)*)"', m.group(1))]

def js_array(names):
    return "const ACTIVE_ROSTER = [" + ",".join('"%s"' % n.replace('"', '\\"') for n in names) + "];"

def js_changes_entry(week, added, removed):
    def lst(xs): return "[" + ", ".join('"%s"' % x.replace('"', '\\"') for x in xs) + "]"
    return ('   { week: "%s", added: %s, removed: %s },\n'
            % (week, lst(added), lst(removed)))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("snapshot", help="file with the fresh active-roster names, one per line")
    ap.add_argument("--week", help='label for the changes entry (default: today, e.g. "Jun 29, 2026")')
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    new = sorted(dict.fromkeys(l.strip() for l in open(a.snapshot, encoding="utf-8") if l.strip()))
    if not new:
        print("snapshot is empty — aborting"); sys.exit(1)

    html = open(INDEX, encoding="utf-8").read()
    old = read_active_roster(html)
    if old is None:
        print("ACTIVE_ROSTER not found in index.html — aborting"); sys.exit(1)

    olds, news = set(old), set(new)
    added = sorted(news - olds)
    removed = sorted(olds - news)
    week = a.week or datetime.date.today().strftime("%b %d, %Y")

    print("baseline (current ACTIVE_ROSTER): %d  |  new snapshot: %d" % (len(old), len(new)))
    print("ADDED (%d): %s" % (len(added), ", ".join(added) or "none"))
    print("REMOVED (%d): %s" % (len(removed), ", ".join(removed) or "none"))

    if not added and not removed:
        print("\nNo roster changes this week — nothing to write.")
        return
    if a.dry_run:
        print("\n(dry run — no changes written)"); return

    # replace ACTIVE_ROSTER
    html = re.sub(r'const ACTIVE_ROSTER = \[.*?\];', lambda m: js_array(new), html, count=1, flags=re.S)
    # prepend ROSTER_CHANGES entry (insert right after the opening [)
    html = re.sub(r'(const ROSTER_CHANGES = \[)\n', r'\1\n' + js_changes_entry(week, added, removed), html, count=1)
    open(INDEX, "w", encoding="utf-8").write(html)
    print("\nWrote index.html: ACTIVE_ROSTER -> %d names; prepended '%s' changes entry "
          "(+%d / -%d)." % (len(new), week, len(added), len(removed)))
    print("Remember: 'removed' fighters stay in your DB (now former); 'added' are import candidates.")

if __name__ == "__main__":
    main()
