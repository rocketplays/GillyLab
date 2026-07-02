#!/usr/bin/env python3
"""Recompute the 9 box-score-derived FIGHTER_STATS fields for the veterans whose
original import used only page 1 of ESPN's eventlog (capped at 25 fights). Uses a
PAGINATED, parallel box-score aggregate so the career averages include every UFC
bout. Caches results to data/_veteran_stats.json (resumable, time-bounded).

Only the 9 box-score fields are computed: slpm, strAcc, sapm, strDef, kd,
tdLanded, tdAcc, tdDef, subAvg. Bio (ht/dob/reach/stance/gym) and finRate/streak
are untouched. Apply with apply-veteran-stats.py.

  python3 scripts/recompute-veteran-stats.py --workers 10 --bout-workers 16 --seconds 32
"""
import os, re, csv, json, glob, time, argparse, importlib.util, threading
from concurrent.futures import ThreadPoolExecutor, as_completed

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
spec = importlib.util.spec_from_file_location("imp", os.path.join(HERE, "espn-fighter-import.py"))
imp = importlib.util.module_from_spec(spec); spec.loader.exec_module(imp)
CORE = imp.CORE
CACHE = os.path.join(ROOT, "data", "_veteran_stats.json")
AFFECTED = os.path.join(ROOT, "data", "_paginated_fighters.txt")

def build_idmap():
    idmap = {}
    for p in glob.glob(os.path.join(HERE, "espn-import-output", "*.json")):
        try:
            j = json.load(open(p))
            if j.get("name"): idmap[j["name"]] = str(j["espn_id"])
        except Exception: pass
    slug2id = {r["slug"]: r["espn_id"] for r in csv.DictReader(open(os.path.join(HERE, "espn-import-output", "_manifest.csv"))) if r.get("espn_id", "").isdigit()}
    return idmap, slug2id

def aggregate(sid, bout_workers):
    items = []; page = 1
    while True:
        log = imp.get_json("%s/athletes/%s/eventlog?lang=en&region=us&page=%d" % (CORE, sid, page))
        if not log: break
        ev = log.get("events", {}); items += ev.get("items", [])
        if page >= (ev.get("pageCount") or 1): break
        page += 1
    pairs = []
    for it in items:
        if not it.get("played"): continue
        evref = (it.get("event") or {}).get("$ref", ""); cref = (it.get("competition") or {}).get("$ref", "")
        lg = re.search(r"/leagues/([a-z0-9-]+)/", evref) or re.search(r"/leagues/([a-z0-9-]+)/", cref)
        if not lg or lg.group(1) != "ufc": continue
        ev = re.search(r"/events/(\d+)", evref); co = re.search(r"/competitions/(\d+)", cref)
        if ev and co: pairs.append((ev.group(1), co.group(1)))
    def fetch(p):
        ev, co = p
        comp = imp.get_json("%s/leagues/ufc/events/%s/competitions/%s?lang=en&region=us" % (CORE, ev, co))
        if not comp or not comp.get("boxscoreAvailable"): return None
        me = opp = None
        for c in comp.get("competitors", []):
            aid = re.search(r"/athletes/(\d+)", (c.get("athlete") or {}).get("$ref", ""))
            sref = (c.get("statistics") or {}).get("$ref", "")
            if not sref: continue
            sd = imp.get_json(sref)
            g = next((x for x in (sd or {}).get("splits", {}).get("categories", []) if x.get("name") == "general"), None)
            if not g: continue
            st = {s.get("name"): s.get("value") for s in g.get("stats", [])}
            rec = dict(ssl=imp._iv(st, "sigStrikesLanded"), ssa=imp._iv(st, "sigStrikesAttempted"),
                       kd=imp._iv(st, "knockDowns"), tdl=imp._iv(st, "takedownsLanded"),
                       tda=imp._iv(st, "takedownsAttempted"), sm=imp._iv(st, "submissions"))
            if aid and aid.group(1) == str(sid): me = rec
            else: opp = rec
        if not (me and opp) or (me["ssa"] + opp["ssa"]) == 0: return None
        dsec = 0; stref = (comp.get("status") or {}).get("$ref", "")
        stt = imp.get_json(stref) if stref else None
        if stt:
            try:
                mm, ss = (str(stt.get("displayClock") or "5:00").split(":") + ["0"])[:2]
                dsec = (int(stt.get("period") or 1) - 1) * 300 + int(mm) * 60 + int(ss)
            except Exception: dsec = 0
        return (me, opp, dsec)
    a = dict(ssl=0, ssa=0, kd=0, tdl=0, tda=0, sm=0, ossl=0, ossa=0, otdl=0, otda=0, sec=0, bouts=0)
    if not pairs: return a
    with ThreadPoolExecutor(max_workers=min(bout_workers, len(pairs))) as bex:
        for r in bex.map(fetch, pairs):
            if not r: continue
            me, opp, dsec = r
            for k in ("ssl", "ssa", "kd", "tdl", "tda", "sm"): a[k] += me[k]
            a["ossl"] += opp["ssl"]; a["ossa"] += opp["ssa"]; a["otdl"] += opp["tdl"]; a["otda"] += opp["tda"]
            a["sec"] += dsec; a["bouts"] += 1
    return a

def compute(a):
    minutes = a["sec"] / 60.0
    if not minutes: return None
    per15 = lambda x: round(x / minutes * 15, 2)
    permin = lambda x: round(x / minutes, 2)
    pct = lambda n, d: ("%d%%" % round(100 * n / d)) if d else None
    return {"bouts": a["bouts"], "slpm": permin(a["ssl"]), "strAcc": pct(a["ssl"], a["ssa"]),
            "sapm": round(a["ossl"] / minutes, 2), "strDef": pct(a["ossa"] - a["ossl"], a["ossa"]) if a["ossa"] else None,
            "kd": per15(a["kd"]), "tdLanded": per15(a["tdl"]), "tdAcc": pct(a["tdl"], a["tda"]),
            "tdDef": pct(a["otda"] - a["otdl"], a["otda"]) if a["otda"] else None, "subAvg": per15(a["sm"])}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=10)
    ap.add_argument("--bout-workers", type=int, default=16)
    ap.add_argument("--seconds", type=float, default=32.0)
    a = ap.parse_args()
    cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
    names = [l.strip() for l in open(AFFECTED) if l.strip()]
    idmap, slug2id = build_idmap()
    def gid(n): return idmap.get(n) or slug2id.get(imp.name_to_slug(n))
    todo = [n for n in names if n not in cache]
    print("affected: %d | done: %d | to do: %d" % (len(names), len(cache), len(todo)))
    deadline = time.time() + a.seconds
    lock = threading.Lock(); done = [0]
    def work(nm):
        sid = gid(nm)
        if not sid: return nm, "no_id"
        try: return nm, compute(aggregate(sid, a.bout_workers))
        except Exception: return nm, None
    ex = ThreadPoolExecutor(max_workers=a.workers)
    futs = [ex.submit(work, nm) for nm in todo]
    for fut in as_completed(futs):
        nm, st = fut.result()
        with lock:
            if isinstance(st, dict): cache[nm] = st
            done[0] += 1
            if done[0] % 20 == 0: json.dump(cache, open(CACHE, "w"))
        if time.time() >= deadline: break
    json.dump(cache, open(CACHE, "w"))
    print("cached now: %d | remaining: %d" % (len(cache), len(todo) - done[0]), flush=True)
    ex.shutdown(wait=False, cancel_futures=True); os._exit(0)

if __name__ == "__main__":
    main()
