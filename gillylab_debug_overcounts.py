#!/usr/bin/env python3
"""
gillylab_debug_overcounts.py

For each fighter in the over-count list, shows:
  - What section headings Wikipedia has (MMA/wrestling/career/etc.)
  - What _extract_mma_section() returns as the section heading
  - How many fights the parser finds vs. the expected record

Run locally (requires Wikipedia access):
  python3 gillylab_debug_overcounts.py
"""

import re
import sys
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)

from gillylab_wikipedia_fill import (
    wiki_search, wiki_wikitext,
    _extract_mma_section, parse_fight_record,
)

OVERCOUNTS = [
    ("Mackenzie Dern",        "15-4-0"),
    ("Gable Steveson",        "3-0-0"),
    ("Henry Cejudo",          "16-4-0"),
    ("Deron Winn",            "9-4-0"),
    ("Michael Oliveira",      "9-0-0"),
    ("Rinya Nakamura",        "9-0-0"),
    ("Nursulton Ruziboev",    "12-4-0"),
    ("Muhammad Mokaev",       "12-1-0"),
    ("Bruno Silva",           "9-2-0"),
    ("Khamzat Chimaev",       "15-1-0"),
    ("José Henrique Souza",   "9-3-0"),
    ("Aaron Pico",            "14-5-0"),
    ("Kennedy Freeman",       "8-0-0"),
    ("Eric Shelton",          "9-6-0"),
    ("Melquizael Costa",      "13-4-0"),
    ("Alex Perez",            "13-5-1"),
    ("Kai Kara-France",       "15-7-0"),
    ("Louis Jourdain",        "9-3-0"),
    ("Bryan Battle",          "13-2-0"),
    ("Andreas Gustafsson",    "9-3-0"),
    ("Ariane Silva",          "11-4-0"),
    ("Bekzat Almakhan",       "12-0-0"),
    ("Zhang Mingyang",        "10-3-0"),
    ("Asu Almabayev",         "12-1-0"),
    ("Bruno Gustavo da Silva","13-2-0"),
    ("Raquel Pennington",     "16-8-0"),
    ("Tyson Nam",             "19-9-1"),
    ("Vinicius Oliveira",     "13-3-0"),
    ("Tofiq Musayev",         "14-4-0"),
    ("Kai Kamaka III",        "11-4-0"),
]

SECTION_RE = re.compile(r"^(==+[^=\n]+==+)\s*$", re.MULTILINE)
MMA_HEADING_RE = re.compile(
    r"^(={2,4})\s*(?:(?:professional|pro|mma|mixed\s+martial\s+arts)\s+)?record\s*\1\s*$",
    re.MULTILINE | re.I
)

def first_section_heading(wikitext):
    """Return the heading that _extract_mma_section matched, or None."""
    m = MMA_HEADING_RE.search(wikitext)
    return m.group(0).strip() if m else None

def relevant_headings(wikitext):
    """Return all section headings that mention record/mma/career/wrestling/amateur."""
    headings = SECTION_RE.findall(wikitext)
    return [h for h in headings if re.search(
        r"record|mma|mixed martial|career|fight|wrestling|amateur|grappl|bjj|freestyle",
        h, re.I
    )]

def main():
    print(f"{'Fighter':<28} {'Record':>8}  {'Found':>6}  {'MMA heading matched'}")
    print("-" * 80)

    for name, expected in OVERCOUNTS:
        title = wiki_search(name)
        if not title:
            print(f"{name:<28} {expected:>8}  {'N/A':>6}  [Wikipedia not found]")
            continue

        wikitext = wiki_wikitext(title)
        if not wikitext:
            print(f"{name:<28} {expected:>8}  {'N/A':>6}  [No wikitext]")
            continue

        fights = parse_fight_record(wikitext)
        found  = len(fights)
        heading = first_section_heading(wikitext)
        rel_headings = relevant_headings(wikitext)

        status = "OK" if abs(found - int(expected.split("-")[0]) - int(expected.split("-")[1])) <= 2 else "BAD"

        print(f"{name:<28} {expected:>8}  {found:>6}  {heading or '[NO MATCH]'}")
        if status == "BAD" or not heading:
            for h in rel_headings:
                print(f"  {'':28}          → {h}")
        print()


if __name__ == "__main__":
    main()
