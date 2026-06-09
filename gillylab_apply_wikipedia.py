#!/usr/bin/env python3
"""
gillylab_apply_wikipedia.py

Merges fighter_data_wikipedia.txt into index.html:
  - Updates blank bio fields in FIGHTER_STATS (ht, dob, reach, stance, gym)
  - Replaces FIGHT_HISTORY arrays where Wikipedia has more fights than current
  - NEVER touches stats fields (slpm, strAcc, sapm, etc.)
  - NEVER touches ODDS_HISTORY, TAPE_STUDY, ACCOLADES

Usage:
  python3 gillylab_apply_wikipedia.py [--dry-run] [--force]

  --force   Bypass the fight-count threshold and overwrite FIGHT_HISTORY for
            all fighters in fighter_data_wikipedia.txt, even if Wikipedia has
            fewer fights than the current data. Use after a parser fix to
            correct previously-inflated fight histories.
            Tip: pipe through a name filter to limit scope:
              python3 gillylab_apply_wikipedia.py --force --names "Michael Oliveira,Bruno Silva"
"""

import re
import sys
import os

SCRIPT_DIR    = os.path.dirname(os.path.abspath(__file__))
WIKIPEDIA_TXT = os.path.join(SCRIPT_DIR, "fighter_data_wikipedia.txt")
INDEX_HTML    = os.path.join(SCRIPT_DIR, "index.html")

DRY_RUN = "--dry-run" in sys.argv
FORCE   = "--force"   in sys.argv

# Optional comma-separated name filter: --names "Fighter A,Fighter B"
FORCE_NAMES: set[str] = set()
if "--names" in sys.argv:
    idx = sys.argv.index("--names")
    if idx + 1 < len(sys.argv):
        FORCE_NAMES = {n.strip() for n in sys.argv[idx + 1].split(",") if n.strip()}


# ── Manual overrides ──────────────────────────────────────────────────────────
# Fields listed here are force-written to FIGHTER_STATS after the Wikipedia
# apply pass, overriding whatever Wikipedia put there.
# Format: { "Fighter Name": { "field": "value", ... }, ... }
# Supported fields: gym, ht, dob, reach, stance
MANUAL_OVERRIDES: dict[str, dict[str, str]] = {
    "Maurício Ruffy": {"gym": "Fighting Nerds"},
    "Mauricio Ruffy":  {"gym": "Fighting Nerds"},
}


# ── Parse fighter_data_wikipedia.txt ─────────────────────────────────────────

def parse_wikipedia_txt(path):
    """Returns {name: {"bio": {...}, "fights": [...]}}"""
    fighters = {}
    with open(path, encoding="utf-8") as f:
        content = f.read()

    blocks = re.split(r"^FIGHTER: ", content, flags=re.MULTILINE)
    for block in blocks:
        if not block.strip():
            continue
        lines = block.split("\n")
        name = lines[0].strip()
        if not name:
            continue

        bio       = {}
        fights    = []
        accolades = []
        section   = None
        current_fight = {}

        for line in lines[1:]:
            stripped = line.strip()
            if stripped == "ACCOLADES:":
                section = "accolades"
            elif stripped == "BIO:":
                section = "bio"
            elif stripped == "STATS:":
                section = "stats"
            elif stripped == "FIGHTS:":
                section = "fights"
            elif section == "accolades":
                # Format: icon | title | detail  (detail may be blank)
                if "|" in stripped and not stripped.startswith("("):
                    parts = [p.strip() for p in stripped.split("|", 2)]
                    if len(parts) >= 2 and parts[0] and parts[1]:
                        accolades.append({
                            "icon":   parts[0],
                            "title":  parts[1],
                            "detail": parts[2] if len(parts) > 2 and parts[2] else None,
                        })
            elif section == "bio":
                if ": " in stripped:
                    k, v = stripped.split(": ", 1)
                    bio[k.strip()] = v.strip()
                elif stripped.endswith(":"):
                    bio[stripped[:-1].strip()] = ""
            elif section == "fights":
                if stripped == "---":
                    if current_fight.get("opponent"):
                        fights.append(current_fight)
                    current_fight = {}
                elif stripped.startswith("date:"):
                    current_fight["date"] = stripped[5:].strip()
                elif stripped.startswith("result:") and "|" in stripped:
                    for part in stripped.split("|"):
                        part = part.strip()
                        if ":" in part:
                            k, v = part.split(":", 1)
                            current_fight[k.strip()] = v.strip()
                elif stripped.startswith("event:"):
                    rest = stripped[6:].strip()
                    if "|" in rest:
                        parts = rest.split("|")
                        # first segment is the event name (no "key:" prefix)
                        current_fight["event"] = parts[0].strip()
                        for part in parts[1:]:
                            part = part.strip()
                            if ":" in part:
                                k, v = part.split(":", 1)
                                current_fight[k.strip()] = v.strip()
                    else:
                        current_fight["event"] = rest

        fighters[name] = {"bio": bio, "fights": fights, "accolades": accolades}
    return fighters


# ── JS formatting helpers ─────────────────────────────────────────────────────

def js_ht(h):
    """Double-quoted height string with inner double-quote escaped."""
    return '"' + h.replace('"', '\\"') + '"'

def js_reach(r):
    """Single-quoted reach string."""
    return "'" + r + "'"

def fight_to_js(f, indent="    "):
    """Convert a fight dict to a JS object literal string."""
    parts = []
    if f.get("date"):
        parts.append(f'date: "{f["date"]}"')
    if f.get("opponent"):
        parts.append(f'opponent: "{f["opponent"].replace(chr(34), chr(92)+chr(34))}"')
    if f.get("result"):
        parts.append(f'result: "{f["result"]}"')
    if f.get("method"):
        parts.append(f'method: "{f["method"].replace(chr(34), chr(92)+chr(34))}"')
    if f.get("round"):
        try:
            parts.append(f'round: {int(f["round"])}')
        except (ValueError, TypeError):
            parts.append(f'round: "{f["round"]}"')
    if f.get("time"):
        parts.append(f'time: "{f["time"]}"')
    if f.get("event"):
        parts.append(f'event: "{f["event"].replace(chr(34), chr(92)+chr(34))}"')
    if f.get("org"):
        parts.append(f'org: "{f["org"]}"')
    return indent + "{ " + ", ".join(parts) + " }"


# ── FIGHTER_STATS bio field update ───────────────────────────────────────────

BLANK_BIO = {"--", "", "0\"", "0'", "0"}

def _match_any_quote(field):
    """Return regex that matches field:"value" or field:'value'."""
    return rf'''{re.escape(field)}:(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')'''

def _current_val(m_str):
    """Extract unquoted value from 'field:"val"' match string."""
    val = re.sub(r'^[^:]+:', '', m_str).strip()
    if val.startswith('"'):
        val = val[1:-1].replace('\\"', '"')
    elif val.startswith("'"):
        val = val[1:-1].replace("\\'", "'")
    return val

def update_stats_line(line, bio):
    """Update blank bio fields in a single FIGHTER_STATS line. Returns (new_line, [changes])."""
    changes = []

    h      = bio.get("height", "").strip()
    dob    = bio.get("dob", "").strip()
    reach  = bio.get("reach", "").strip()
    stance = bio.get("stance", "").strip()
    gym    = bio.get("gym", "").strip()

    # ── height ──
    if h:
        pat = _match_any_quote("ht")
        m = re.search(pat, line)
        if m and _current_val(m.group()) in BLANK_BIO:
            line = re.sub(pat, f"ht:{js_ht(h)}", line, count=1)
            changes.append(f"ht → {h}")

    # ── dob ──
    if dob:
        pat = _match_any_quote("dob")
        m = re.search(pat, line)
        if m and _current_val(m.group()) in BLANK_BIO:
            line = re.sub(pat, f'dob:"{dob}"', line, count=1)
            changes.append(f"dob → {dob}")

    # ── reach ──
    if reach:
        pat = _match_any_quote("reach")
        m = re.search(pat, line)
        if m and _current_val(m.group()) in BLANK_BIO:
            line = re.sub(pat, f"reach:{js_reach(reach)}", line, count=1)
            changes.append(f"reach → {reach}")

    # ── stance ──
    if stance:
        pat = _match_any_quote("stance")
        m = re.search(pat, line)
        if m and _current_val(m.group()) in BLANK_BIO:
            line = re.sub(pat, f'stance:"{stance}"', line, count=1)
            changes.append(f"stance → {stance}")

    # ── gym: update existing blank, or add if key absent ──
    if gym:
        pat = _match_any_quote("gym")
        m = re.search(pat, line)
        if m:
            if _current_val(m.group()) in {"", "--"}:
                line = re.sub(pat, f'gym:"{gym}"', line, count=1)
                changes.append(f"gym → {gym}")
        else:
            # Insert gym before the closing }
            line = line.rstrip()
            # strip trailing comma if present
            trailing_comma = line.endswith(",")
            if trailing_comma:
                line = line[:-1].rstrip()
            if line.endswith("}"):
                line = line[:-1].rstrip() + f', gym:"{gym}" }}'
            if trailing_comma:
                line += ","
            changes.append(f"gym added: {gym}")

    return line, changes


# ── FIGHT_HISTORY array operations ────────────────────────────────────────────

def build_fight_array(name, fights):
    """Build the full JS array string for a fighter's FIGHT_HISTORY entry."""
    lines = [f'  "{name}": [']
    for i, f in enumerate(fights):
        comma = "," if i < len(fights) - 1 else ""
        lines.append(fight_to_js(f) + comma)
    lines.append("  ],")
    return "\n".join(lines)

def find_fighter_array(block, name):
    """
    Within `block` (the raw FIGHT_HISTORY JS block), find the start/end of
    "name": [ ... ], and return (current_fight_count, block_start, block_end).
    block_start/block_end are character offsets within `block`.
    Returns (-1, -1, -1) if not found.
    """
    start_pat = re.compile(
        r'(?:^|\n)\s*"' + re.escape(name) + r'":\s*\[',
        re.MULTILINE
    )
    m = start_pat.search(block)
    if not m:
        return -1, -1, -1

    # The array starts at the '[' character
    array_open = block.index("[", m.start())
    pos   = array_open + 1
    depth = 1
    while pos < len(block) and depth > 0:
        ch = block[pos]
        # Skip string literals so brackets inside strings don't affect depth
        if ch in ('"', "'"):
            quote = ch
            pos += 1
            while pos < len(block):
                c = block[pos]
                if c == '\\':
                    pos += 2   # skip escaped char
                    continue
                if c == quote:
                    break
                pos += 1
        elif ch == "[":
            depth += 1
        elif ch == "]":
            depth -= 1
        pos += 1
    # pos is just past the closing ']'
    # include the trailing comma if present
    end_pos = pos
    if end_pos < len(block) and block[end_pos] == ",":
        end_pos += 1

    # entry starts at the newline before the name (or beginning of block)
    entry_start = m.start()
    if block[entry_start] == "\n":
        entry_start += 1  # skip the leading newline; we'll keep it

    array_text   = block[entry_start:end_pos]
    fight_count  = len(re.findall(r'\bdate:', array_text))
    return fight_count, entry_start, end_pos


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print(f"Loading {WIKIPEDIA_TXT} ...")
    wiki = parse_wikipedia_txt(WIKIPEDIA_TXT)
    print(f"  {len(wiki)} fighters parsed from Wikipedia data")

    print(f"Loading {INDEX_HTML} ...")
    with open(INDEX_HTML, encoding="utf-8") as f:
        html = f.read()
    print(f"  {len(html):,} chars")

    # ── Locate block boundaries ──
    # Block order in index.html: FIGHTER_STATS → TAPE_STUDY → ODDS_HISTORY → FIGHT_HISTORY → ACCOLADES
    stats_start_m    = re.search(r'const FIGHTER_STATS = \{', html)
    tape_start_m     = re.search(r'const TAPE_STUDY = \{', html)
    fh_start_m       = re.search(r'const FIGHT_HISTORY = \{', html)
    accolades_start_m = re.search(r'const ACCOLADES = \{', html)

    if not stats_start_m or not fh_start_m:
        print("ERROR: Could not locate FIGHTER_STATS or FIGHT_HISTORY in index.html")
        sys.exit(1)

    stats_block_start = stats_start_m.start()
    # FIGHTER_STATS ends at TAPE_STUDY
    stats_block_end   = tape_start_m.start() if tape_start_m else fh_start_m.start()
    fh_block_start    = fh_start_m.start()
    # FIGHT_HISTORY ends at ACCOLADES
    fh_block_end      = accolades_start_m.start() if accolades_start_m else len(html)

    # ── Update FIGHTER_STATS bio fields ──
    stats_block = html[stats_block_start:stats_block_end]
    lines = stats_block.split("\n")
    bio_changes = {}

    for name, data in wiki.items():
        bio = data["bio"]
        if not any(bio.get(k) for k in ("height", "dob", "reach", "stance", "gym")):
            continue

        name_pat = re.compile(r'^\s*"' + re.escape(name) + r'":\s*\{')
        for i, line in enumerate(lines):
            if name_pat.match(line):
                new_line, changes = update_stats_line(line, bio)
                if changes:
                    lines[i] = new_line
                    bio_changes[name] = changes
                break

    new_stats_block = "\n".join(lines)
    # Splice updated stats block back in (preserve everything before and after)
    html = html[:stats_block_start] + new_stats_block + html[stats_block_end:]

    # ── Update FIGHT_HISTORY arrays ──
    # Recompute fh offsets after stats splice (size may have changed slightly)
    fh_block_start = html.index("const FIGHT_HISTORY = {")
    accolades_idx  = html.find("const ACCOLADES = {")
    fh_block_end   = accolades_idx if accolades_idx != -1 else len(html)

    # Work on the FIGHT_HISTORY block in isolation to avoid false matches
    fh_block_original = html[fh_block_start:fh_block_end]
    fh_block          = fh_block_original
    fh_changes        = {}
    offset_delta      = 0  # track cumulative size change as we make replacements

    # Sort by position in block so we can make replacements safely
    replacements = []  # list of (name, old_start, old_end, new_text)

    for name, data in wiki.items():
        wiki_fights = data["fights"]
        if not wiki_fights:
            continue

        count, rel_start, rel_end = find_fighter_array(fh_block_original, name)
        if rel_start == -1:
            continue  # not in FIGHT_HISTORY

        # Threshold check — skip if Wikipedia doesn't have more fights.
        # Bypass with --force (optionally scoped to --names "A,B,C").
        force_this = FORCE and (not FORCE_NAMES or name in FORCE_NAMES)
        if not force_this and len(wiki_fights) <= count:
            continue

        new_array = build_fight_array(name, wiki_fights)
        replacements.append((name, rel_start, rel_end, count, new_array))

    # Apply replacements from end to start so offsets stay valid
    replacements.sort(key=lambda x: x[1], reverse=True)
    for name, rel_start, rel_end, old_count, new_array in replacements:
        fh_block = fh_block[:rel_start] + new_array + "\n" + fh_block[rel_end:]
        fh_changes[name] = (old_count, len(wiki[name]["fights"]))

    html = html[:fh_block_start] + fh_block + html[fh_block_start + len(fh_block_original):]

    # ── Manual overrides ──
    # Re-locate the stats block (may have shifted after fight history splice)
    stats_start_m2   = re.search(r'const FIGHTER_STATS = \{', html)
    tape_start_m2    = re.search(r'const TAPE_STUDY = \{', html)
    stats_block2     = html[stats_start_m2.start():tape_start_m2.start()]
    lines2           = stats_block2.split("\n")
    override_changes = {}

    for name, fields in MANUAL_OVERRIDES.items():
        name_pat = re.compile(r'^\s*"' + re.escape(name) + r'":\s*\{')
        for i, line in enumerate(lines2):
            if name_pat.match(line):
                new_line = line
                applied  = []
                for field, value in fields.items():
                    # Replace existing field value
                    pat = _match_any_quote(field)
                    if re.search(pat, new_line):
                        new_line = re.sub(pat, f'{field}:"{value}"', new_line, count=1)
                    else:
                        # Insert before closing }
                        stripped = new_line.rstrip()
                        trailing = stripped.endswith(",")
                        if trailing:
                            stripped = stripped[:-1].rstrip()
                        if stripped.endswith("}"):
                            stripped = stripped[:-1].rstrip() + f', {field}:"{value}" }}'
                        new_line = stripped + ("," if trailing else "")
                    applied.append(f"{field} → {value}")
                if applied:
                    lines2[i] = new_line
                    override_changes[name] = applied
                break

    new_stats_block2 = "\n".join(lines2)
    html = html[:stats_start_m2.start()] + new_stats_block2 + html[stats_start_m2.start() + len(stats_block2):]

    # ── Inject Wikipedia rank accolades ──
    # Only adds entries for fighters who have NO existing ACCOLADES entry.
    # Fighters with manually-curated accolades are left untouched.
    accolades_start_m3 = re.search(r'const ACCOLADES = \{', html)
    accolade_changes = {}
    if accolades_start_m3:
        acc_start = accolades_start_m3.end()
        # Find the closing }; of the ACCOLADES block
        depth, pos = 1, acc_start
        while pos < len(html) and depth > 0:
            if html[pos] == '{':
                depth += 1
            elif html[pos] == '}':
                depth -= 1
            pos += 1
        acc_end = pos - 1  # points at the closing }

        acc_block = html[acc_start:acc_end]

        inserts = []
        for name, data in wiki.items():
            ranks = data.get("accolades") or []
            if not ranks:
                continue
            # Skip if fighter already has an entry in ACCOLADES
            if re.search(r'"' + re.escape(name) + r'"\s*:', acc_block):
                continue
            # Build JS array entry
            js_lines = [f'  "{name}": [']
            for i, r in enumerate(ranks):
                comma = "," if i < len(ranks) - 1 else ""
                detail_js = f'"{r["detail"]}"' if r.get("detail") else "null"
                icon = r["icon"].replace('"', '\\"')
                title = r["title"].replace('"', '\\"')
                js_lines.append(f'    {{ icon: "{icon}", title: "{title}", detail: {detail_js} }}{comma}')
            js_lines.append("  ],")
            inserts.append("\n".join(js_lines))
            accolade_changes[name] = [r["title"] for r in ranks]

        if inserts:
            injection = "\n" + "\n".join(inserts)
            html = html[:acc_end] + injection + html[acc_end:]

    # ── Summary ──
    print(f"\n── Bio field updates ({len(bio_changes)} fighters) ──")
    for name, changes in sorted(bio_changes.items()):
        print(f"  {name}: {', '.join(changes)}")

    print(f"\n── Fight history replacements ({len(fh_changes)} fighters) ──")
    for name, (old, new) in sorted(fh_changes.items()):
        arrow = f"{old} → {new}"
        print(f"  {name}: {arrow} fights")

    print(f"\n── Manual overrides ({len(override_changes)} fighters) ──")
    for name, changes in sorted(override_changes.items()):
        print(f"  {name}: {', '.join(changes)}")

    print(f"\n── Rank accolades injected ({len(accolade_changes)} fighters) ──")
    for name, titles in sorted(accolade_changes.items()):
        print(f"  {name}: {', '.join(titles)}")

    print(f"\nTotal: {len(bio_changes)} bio updates, {len(fh_changes)} fight history replacements, {len(override_changes)} manual overrides, {len(accolade_changes)} accolade injections")

    if DRY_RUN:
        print("\n[DRY RUN — index.html not modified]")
    else:
        with open(INDEX_HTML, "w", encoding="utf-8") as f:
            f.write(html)
        print(f"\nWrote {INDEX_HTML}")


if __name__ == "__main__":
    main()
