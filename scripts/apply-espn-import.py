#!/usr/bin/env python3
"""Insert gathered ESPN fighter snippets into index.html.

Reads scripts/espn-import-output/_manifest.csv, selects fighters whose status is
in --status (default: ok), and injects each one's FIGHTERS row, FIGHTER_STATS
entry, and FIGHT_HISTORY block into the corresponding structures in index.html.

Dedupes by fighter name (skips anyone already present). Idempotent: re-running
only adds fighters not yet in index.html.

Usage:
  python3 scripts/apply-espn-import.py                    # status=ok
  python3 scripts/apply-espn-import.py --status ok,low_coverage,no_stats
  python3 scripts/apply-espn-import.py --slugs kenny-florian,jorge-rivera
  python3 scripts/apply-espn-import.py --dry-run
"""
import os, re, csv, argparse, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
INDEX = os.path.join(ROOT, "index.html")
OUT = os.path.join(HERE, "espn-import-output")
MANIFEST = os.path.join(OUT, "_manifest.csv")

H_ROW  = "// ---- FIGHTERS roster row ----"
H_STAT = "// ---- FIGHTER_STATS ----"
H_HIST = "// ---- FIGHT_HISTORY ----"

def parse_snippet(js):
    """Return (fighters_row, stats_line, history_block, name)."""
    row  = js.split(H_ROW,1)[1].split(H_STAT,1)[0].strip("\n")
    stat = js.split(H_STAT,1)[1].split(H_HIST,1)[0].strip("\n")
    hist = js.split(H_HIST,1)[1].strip("\n")
    m = re.search(r'name:\s*"((?:[^"\\]|\\.)*)"', row)
    name = m.group(1) if m else None
    return row.strip("\n"), stat.strip("\n"), hist, name

def match_close(h, var):
    m = re.search(r'const %s\s*=\s*([\[{])' % var, h)
    op = m.group(1); cl = ']' if op == '[' else '}'
    i = m.end()-1; depth = 0
    while i < len(h):
        if h[i] == op: depth += 1
        elif h[i] == cl:
            depth -= 1
            if depth == 0: break
        i += 1
    return i  # index of matching close delimiter

def insert_before_close(h, var, block):
    i = match_close(h, var)
    j = i - 1                              # step back to last content char of last entry
    while j > 0 and h[j] in " \t\r\n": j -= 1
    sep = "" if h[j] == "," else ","       # the last existing entry may lack a trailing comma
    return h[:j+1] + sep + "\n" + block.rstrip("\n") + h[j+1:]

def db_names(h):
    fm = re.search(r'const FIGHTERS\s*=\s*\[', h)
    i = match_close(h, "FIGHTERS")
    seg = h[fm.end():i]
    return set(n.replace('\\"','"') for n in re.findall(r'name:\s*"((?:[^"\\]|\\.)*)"', seg))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--status", default="ok",
                    help="comma list of statuses to insert (ok,low_coverage,no_stats)")
    ap.add_argument("--slugs", default="", help="comma list of specific slugs (overrides --status filter)")
    ap.add_argument("--exclude-file", default="", help="file of slugs to skip (one per line)")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    want_status = set(s.strip() for s in a.status.split(",") if s.strip())
    want_slugs  = set(s.strip() for s in a.slugs.split(",") if s.strip())
    exclude = set()
    if a.exclude_file and os.path.exists(a.exclude_file):
        exclude = set(l.strip() for l in open(a.exclude_file) if l.strip())

    rows = list(csv.DictReader(open(MANIFEST)))
    sel = []
    for r in rows:
        slug = r["slug"]
        if slug in exclude:
            continue
        if want_slugs:
            if slug in want_slugs: sel.append(r)
        elif r["status"] in want_status:
            sel.append(r)
    if not sel:
        print("nothing selected"); return

    h = open(INDEX).read()
    existing = db_names(h)

    inserted, skipped = [], []
    add_rows, add_stats, add_hist = [], [], []
    for r in sel:
        slug = r["slug"]
        p = os.path.join(OUT, slug + ".js")
        if not os.path.exists(p):
            skipped.append((slug, "no .js snippet")); continue
        row, stat, hist, name = parse_snippet(open(p).read())
        if not name:
            skipped.append((slug, "no name parsed")); continue
        if name in existing:
            skipped.append((slug, "already in DB: %s" % name)); continue
        existing.add(name)
        add_rows.append(row.rstrip())
        add_stats.append(stat.rstrip())
        add_hist.append(hist.rstrip())
        inserted.append((slug, name, r["status"]))

    if inserted:
        h = insert_before_close(h, "FIGHT_HISTORY", "\n".join(add_hist) + "\n")
        h = insert_before_close(h, "FIGHTER_STATS", "\n".join(add_stats) + "\n")
        h = insert_before_close(h, "FIGHTERS",      "\n".join(add_rows)  + "\n")

    print("selected %d | inserting %d | skipping %d" % (len(sel), len(inserted), len(skipped)))
    for slug, why in skipped: print("  skip %-28s %s" % (slug, why))
    for slug, name, st in inserted: print("  add  %-28s %-24s (%s)" % (slug, name, st))

    if a.dry_run:
        print("\n(dry run — index.html not written)"); return
    if inserted:
        open(INDEX, "w").write(h)
        print("\nwrote index.html (+%d fighters)" % len(inserted))
    else:
        print("\nno new fighters to write")

if __name__ == "__main__":
    main()
