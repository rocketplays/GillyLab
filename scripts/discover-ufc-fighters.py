#!/usr/bin/env python3
"""Discover EVERY fighter who has competed in a UFC event per ESPN, by enumerating
UFC events (not the /leagues/ufc/athletes roster index, which drops fighters who
left for boxing/PFL/BKFC — e.g. Nate Diaz, Chael Sonnen, Mike Perry).

Events -> competitions -> competitors -> athlete ids. Then diff against the ids
already in _manifest.csv to find the MISSED fighters. Writes their ids to
scripts/espn-import-output/_missing_ids.txt for gather-parallel to process.
"""
import os, re, csv, importlib.util, threading
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("e", os.path.join(HERE, "espn-fighter-import.py"))
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
CORE = m.CORE
OUT = os.path.join(HERE, "espn-import-output")
MANIFEST = os.path.join(OUT, "_manifest.csv")

def event_refs():
    refs = []
    for yr in range(1993, 2027):
        d = m.get_json("%s/leagues/ufc/events?dates=%d&limit=500" % (CORE, yr))
        if d:
            for it in d.get("items", []):
                refs.append(it["$ref"])
    return refs

def ids_from_event(ref):
    ev = m.get_json(ref)
    ids = set()
    if not ev: return ids
    for comp in ev.get("competitions", []):
        for c in comp.get("competitors", []):
            a = re.search(r"/athletes/(\d+)", (c.get("athlete") or {}).get("$ref", ""))
            if a: ids.add(a.group(1))
    return ids

def main():
    print("enumerating UFC events by year ...")
    refs = event_refs()
    print("events:", len(refs))
    allids = set()
    lock = threading.Lock()
    def work(r):
        got = ids_from_event(r)
        with lock: allids.update(got)
    with ThreadPoolExecutor(max_workers=40) as ex:
        list(ex.map(work, refs))
    print("unique fighters who competed in a UFC event:", len(allids))

    done = set()
    if os.path.exists(MANIFEST):
        for line in open(MANIFEST):
            cell = line.split(",")[0].strip()
            if cell.isdigit(): done.add(cell)
    missing = sorted(allids - done, key=int)
    open(os.path.join(OUT, "_missing_ids.txt"), "w").write("\n".join(missing) + "\n")
    print("already in manifest:", len(done))
    print("MISSING (fought in UFC, never processed):", len(missing))
    print("wrote scripts/espn-import-output/_missing_ids.txt")

if __name__ == "__main__":
    main()
