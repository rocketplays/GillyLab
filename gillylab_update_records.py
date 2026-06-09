#!/usr/bin/env python3
"""
gillylab_update_records.py

Updates the record: field in the FIGHTERS array to match W-L-D counts in FIGHT_HISTORY,
but only for fighters where:
  - FIGHT_HISTORY has MORE fights than current record (stale, not missing)
  - The gap is ≤ 10 (skips fighters whose history is inflated by wrestling/grappling records)

Usage:
  python3 gillylab_update_records.py [--dry-run]
"""

import re
import sys
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
INDEX_HTML  = os.path.join(SCRIPT_DIR, "index.html")

DRY_RUN = "--dry-run" in sys.argv
MAX_GAP = 10  # skip if history has more than this many fights above stats


def main():
    with open(INDEX_HTML, encoding="utf-8") as f:
        html = f.read()
    print(f"Loaded {INDEX_HTML} ({len(html):,} chars)")

    # ── Locate block boundaries ────────────────────────────────────────────────
    fh_start  = re.search(r'const FIGHT_HISTORY = \{', html).start()
    acc_start = re.search(r'const ACCOLADES = \{', html).start()
    fh_block  = html[fh_start:acc_start]

    # ── Parse FIGHTERS array records ──────────────────────────────────────────
    # Each entry: { name: "Fighter Name", ..., record: "W-L-D", ... }
    fighters_pat = re.compile(
        r'\{\s*name:\s*"([^"]+)"[^}]*?record:\s*"(\d+)-(\d+)-(\d+)"',
        re.DOTALL
    )
    stats = {}
    for m in fighters_pat.finditer(html):
        name = m.group(1)
        stats.setdefault(name, (int(m.group(2)), int(m.group(3)), int(m.group(4))))

    print(f"FIGHTERS entries parsed: {len(stats)}")

    # ── Count FIGHT_HISTORY results ───────────────────────────────────────────
    fighter_names = re.findall(r'^  "([^"]+)":\s*\[', fh_block, re.MULTILINE)
    history = {}
    for name in fighter_names:
        if name not in stats:
            continue
        # Find the array for this fighter and count results
        # Simple approach: find the block between this name's [ and the matching ]
        pat = re.compile(r'"' + re.escape(name) + r'":\s*\[', re.MULTILINE)
        m = pat.search(fh_block)
        if not m:
            continue
        array_open = fh_block.index("[", m.start())
        pos   = array_open + 1
        depth = 1
        while pos < len(fh_block) and depth > 0:
            ch = fh_block[pos]
            if ch in ('"', "'"):
                quote = ch
                pos += 1
                while pos < len(fh_block):
                    c = fh_block[pos]
                    if c == '\\':
                        pos += 2
                        continue
                    if c == quote:
                        break
                    pos += 1
            elif ch == '[':
                depth += 1
            elif ch == ']':
                depth -= 1
            pos += 1
        arr = fh_block[array_open:pos]
        w = arr.count('result: "W"')
        l = arr.count('result: "L"')
        d = arr.count('result: "D"')
        history[name] = (w, l, d)

    print(f"FIGHT_HISTORY entries matched to FIGHTERS: {len(history)}")

    # ── Find fighters to update ───────────────────────────────────────────────
    to_update = []
    for name, (hw, hl, hd) in history.items():
        sw, sl, sd = stats[name]
        hist_total = hw + hl + hd
        stat_total = sw + sl + sd
        gap = hist_total - stat_total
        if gap <= 0:
            continue  # history not more than stats — skip
        if gap > MAX_GAP:
            continue  # too big a gap — likely wrestling/grappling records
        if (hw, hl, hd) == (sw, sl, sd):
            continue  # already matches
        to_update.append((name, (sw, sl, sd), (hw, hl, hd)))

    print(f"\nFound {len(to_update)} fighters to update (gap 1–{MAX_GAP}, history > stats)")

    # ── Apply updates ─────────────────────────────────────────────────────────
    new_html = html
    updated  = []
    skipped  = []

    for name, old, new in sorted(to_update, key=lambda x: x[0]):
        old_rec = f'"{old[0]}-{old[1]}-{old[2]}"'
        new_rec = f'"{new[0]}-{new[1]}-{new[2]}"'

        # Match the exact fighter entry line containing this name and record
        line_pat = re.compile(
            r'(\{\s*name:\s*"' + re.escape(name) + r'"[^}]*?record:\s*)' + re.escape(old_rec),
            re.DOTALL
        )
        m = line_pat.search(new_html)
        if not m:
            skipped.append(f"  {name}: pattern not found for record:{old_rec}")
            continue

        new_html = new_html[:m.end() - len(old_rec)] + new_rec + new_html[m.end():]
        updated.append(f"  {name}: {old[0]}-{old[1]}-{old[2]} → {new[0]}-{new[1]}-{new[2]}")

    # ── Print results ─────────────────────────────────────────────────────────
    print(f"\n── Updated ({len(updated)}) ──")
    for line in updated:
        print(line)

    if skipped:
        print(f"\n── Skipped ({len(skipped)}) ──")
        for line in skipped:
            print(line)

    if DRY_RUN:
        print("\n[DRY RUN — index.html not modified]")
    else:
        with open(INDEX_HTML, "w", encoding="utf-8") as f:
            f.write(new_html)
        print(f"\nWrote {INDEX_HTML}")


if __name__ == "__main__":
    main()
