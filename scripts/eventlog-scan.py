#!/usr/bin/env python3
"""Scan every roster fighter's ESPN eventlog COUNT (one light call each) to find
who has >25 events — i.e. whose box scores were truncated at page 1 by the
original single-page fetch. Writes affected names to data/_paginated_fighters.txt.
Resumable (caches counts in data/_eventlog_counts.json), time-bounded.

  python3 scripts/eventlog-scan.py --workers 40 --seconds 38
"""
import os, re, csv, json, glob, time, argparse, importlib.util, threading, urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

HERE = os.path.dirname(os.path.abspath(__file__))
def _load(mod, path):
    spec = importlib.util.spec_from_file_location(mod, os.path.join(HERE, path))
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
fsb = _load("fsb", "fight-stats-backfill.py")
imp = _load("imp", "espn-fighter-import.py")

def _gget(url, tries=3):
    last = None
    for i in range(tries):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=fsb.UA), timeout=20).read().decode("utf-8", "ignore")
        except Exception as e:
            last = e; time.sleep(0.35 * (i + 1))
    raise last
fsb.get = _gget

ROOT = os.path.dirname(HERE)
CACHE = os.path.join(ROOT, "data", "_eventlog_counts.json")
OUTLIST = os.path.join(ROOT, "data", "_paginated_fighters.txt")

def build_idmap():
    idmap = {}
    for p in glob.glob(os.path.join(HERE, "espn-import-output", "*.json")):
        try:
            j = json.load(open(p))
            if j.get("name") and j.get("espn_id"): idmap[j["name"]] = str(j["espn_id"])
        except Exception: pass
    slug2id = {}
    for r in csv.DictReader(open(os.path.join(HERE, "espn-import-output", "_manifest.csv"))):
        if r.get("espn_id", "").isdigit(): slug2id[r["slug"]] = r["espn_id"]
    return idmap, slug2id

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=40)
    ap.add_argument("--seconds", type=float, default=38.0)
    a = ap.parse_args()
    counts = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
    names = fsb.roster_names()
    idmap, slug2id = build_idmap()
    def gid(n): return idmap.get(n) or slug2id.get(imp.name_to_slug(n))
    todo = [n for n in names if n not in counts]
    print("roster: %d | scanned: %d | to scan: %d" % (len(names), len(counts), len(todo)))
    deadline = time.time() + a.seconds
    lock = threading.Lock(); done = [0]
    def work(nm):
        sid = gid(nm)
        if not sid: return nm, -1
        try:
            log = fsb.getj("%s/%s/eventlog?page=1" % (fsb.ATHL, sid))
            return nm, int(log.get("events", {}).get("count") or 0)
        except Exception:
            return nm, -2
    ex = ThreadPoolExecutor(max_workers=a.workers)
    futs = [ex.submit(work, nm) for nm in todo]
    for fut in as_completed(futs):
        nm, c = fut.result()
        with lock:
            counts[nm] = c; done[0] += 1
            if done[0] % 100 == 0: json.dump(counts, open(CACHE, "w"))
        if time.time() >= deadline: break
    json.dump(counts, open(CACHE, "w"))
    affected = sorted(n for n, c in counts.items() if c > 25)
    open(OUTLIST, "w").write("\n".join(affected) + "\n")
    print("scanned total: %d | >25 events (paginated/affected): %d | wrote %s"
          % (len(counts), len(affected), os.path.relpath(OUTLIST, ROOT)))
    ex.shutdown(wait=False, cancel_futures=True); os._exit(0)

if __name__ == "__main__":
    main()
