#!/usr/bin/env python3
"""Time-bounded, resumable, concurrent wrapper around espn-fighter-import.process().

The sandbox freezes background processes between tool calls, so we can't run a
long background job. Instead each invocation runs for --seconds wall-clock using
a thread pool, appends completed fighters to the same _manifest.csv (resuming by
skipping ids already recorded), then exits cleanly. Re-invoke until 'to process: 0'.

Usage:
  python3 scripts/gather-parallel.py --workers 16 --seconds 38
"""
import os, sys, csv, time, argparse, importlib.util, threading
from concurrent.futures import ThreadPoolExecutor, as_completed

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("espnimp", os.path.join(HERE, "espn-fighter-import.py"))
imp = importlib.util.module_from_spec(spec); spec.loader.exec_module(imp)

MANIFEST = os.path.join(imp.OUTDIR, "_manifest.csv")

# ESPN's www HTML history page (used by parse_history / aggregate fallback) gets
# rate-limited under heavy concurrency and silently returns empty — which
# misclassifies real UFC fighters as no_ufc. The box-score API host is robust,
# so we cap ONLY the HTML fetches with a global semaphore while letting the
# fighter-level thread pool stay wide for the API calls.
_HTML_SEM = None
def install_html_throttle(n):
    global _HTML_SEM
    _HTML_SEM = threading.Semaphore(n)
    _orig = imp.get_html
    def throttled(url, tries=3):
        with _HTML_SEM:
            return _orig(url, tries)
    imp.get_html = throttled

def install_parallel_boxscore(bout_workers):
    """Replace espn_boxscore_stats with a version that fetches a fighter's bouts
    concurrently, so long-career veterans finish in seconds instead of ~40s
    (a sequential 40-bout fighter would exceed the per-call window and restart)."""
    import re as _re
    from concurrent.futures import ThreadPoolExecutor
    CORE, get_json, _iv = imp.CORE, imp.get_json, imp._iv
    def fetch_bout(ev, co, sid):
        comp = get_json("%s/leagues/ufc/events/%s/competitions/%s?lang=en&region=us" % (CORE, ev, co))
        if not comp or not comp.get("boxscoreAvailable"): return None
        me = opp = None
        for c in comp.get("competitors", []):
            aid = _re.search(r"/athletes/(\d+)", (c.get("athlete") or {}).get("$ref", ""))
            sref = (c.get("statistics") or {}).get("$ref", "")
            if not sref: continue
            sd = get_json(sref)
            g = next((x for x in (sd or {}).get("splits", {}).get("categories", []) if x.get("name") == "general"), None)
            if not g: continue
            st = {s.get("name"): s.get("value") for s in g.get("stats", [])}
            rec = dict(ssl=_iv(st, "sigStrikesLanded"), ssa=_iv(st, "sigStrikesAttempted"),
                       kd=_iv(st, "knockDowns"), tdl=_iv(st, "takedownsLanded"),
                       tda=_iv(st, "takedownsAttempted"), sm=_iv(st, "submissions"))
            if aid and aid.group(1) == str(sid): me = rec
            else: opp = rec
        if not (me and opp) or (me["ssa"] + opp["ssa"]) == 0: return None
        dsec = 0; stref = (comp.get("status") or {}).get("$ref", "")
        stt = get_json(stref) if stref else None
        if stt:
            try:
                mm, ss = (str(stt.get("displayClock") or "5:00").split(":") + ["0"])[:2]
                dsec = (int(stt.get("period") or 1) - 1) * 300 + int(mm) * 60 + int(ss)
            except Exception: dsec = 0
        return (me, opp, dsec)
    def parallel(sid, sleep_s=0.0):
        log = get_json("%s/athletes/%s/eventlog?lang=en&region=us" % (CORE, sid))
        if not log: return None
        pairs = []
        for it in log.get("events", {}).get("items", []):
            if not it.get("played"): continue
            evref = (it.get("event") or {}).get("$ref", ""); cref = (it.get("competition") or {}).get("$ref", "")
            lg = _re.search(r"/leagues/([a-z0-9-]+)/", evref) or _re.search(r"/leagues/([a-z0-9-]+)/", cref)
            if not lg or lg.group(1) != "ufc": continue
            ev = _re.search(r"/events/(\d+)", evref); co = _re.search(r"/competitions/(\d+)", cref)
            if ev and co: pairs.append((ev.group(1), co.group(1)))
        if not pairs: return None
        a = dict(ssl=0, ssa=0, kd=0, tdl=0, tda=0, sm=0, ossl=0, ossa=0, otdl=0, otda=0, sec=0, bouts=0)
        with ThreadPoolExecutor(max_workers=bout_workers) as ex:
            for res in ex.map(lambda p: fetch_bout(p[0], p[1], sid), pairs):
                if not res: continue
                me, opp, dsec = res
                for k in ("ssl", "ssa", "kd", "tdl", "tda", "sm"): a[k] += me[k]
                a["ossl"] += opp["ssl"]; a["ossa"] += opp["ssa"]; a["otdl"] += opp["tdl"]; a["otda"] += opp["tda"]
                a["sec"] += dsec; a["bouts"] += 1
        return a if a["bouts"] else None
    imp.espn_boxscore_stats = parallel

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=16)
    ap.add_argument("--html-workers", type=int, default=4,
                    help="max concurrent HTML history fetches (rate-limit safe)")
    ap.add_argument("--bout-workers", type=int, default=6,
                    help="concurrent per-bout fetches within one fighter")
    ap.add_argument("--seconds", type=float, default=38.0)
    ap.add_argument("--min-coverage", type=float, default=0.5)
    a = ap.parse_args()

    install_html_throttle(a.html_workers)
    install_parallel_boxscore(a.bout_workers)
    roster, _ = imp.roster_slugs()
    os.makedirs(imp.OUTDIR, exist_ok=True)

    done = set()
    if os.path.exists(MANIFEST):
        for line in open(MANIFEST):
            cell = line.split(",")[0].strip()
            if cell.isdigit(): done.add(cell)
    new = not os.path.exists(MANIFEST)
    mf = open(MANIFEST, "a")
    if new:
        mf.write("espn_id,status,slug,division,record,record_check,stat_fights,def_fights,coverage,photo_ok,country_ok\n")

    ids = imp.all_ufc_ids()
    todo = [i for i in ids if i not in done]
    print("UFC athletes: %d | already done: %d | to process: %d" % (len(ids), len(done), len(todo)))
    if not todo:
        mf.close(); return

    deadline = time.time() + a.seconds
    lock = threading.Lock()
    counts = {}
    n_done = 0

    def work(sid):
        try:
            return sid, imp.process(sid, roster, verbose=False, min_coverage=a.min_coverage)
        except Exception as e:
            return sid, {"status": "error", "espn_id": sid, "slug": str(e)[:40]}

    with ThreadPoolExecutor(max_workers=a.workers) as ex:
        futures = {}
        it = iter(todo)
        # prime the pool
        for _ in range(min(a.workers * 2, len(todo))):
            try: sid = next(it)
            except StopIteration: break
            futures[ex.submit(work, sid)] = sid
        while futures:
            for fut in as_completed(list(futures)):
                sid = futures.pop(fut)
                _, r = fut.result()
                st = r.get("status", "error")
                with lock:
                    counts[st] = counts.get(st, 0) + 1
                    n_done += 1
                    photo_ok = "1" if str(r.get("photo", "")).startswith("saved") else "0"
                    country_ok = "1" if r.get("roster_row", {}).get("country") else "0"
                    rec_chk = "ok" if r.get("record_check", "ok") == "ok" else "MISMATCH"
                    mf.write("%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s\n" % (
                        sid, st, r.get("slug", ""),
                        r.get("roster_row", {}).get("division", ""),
                        r.get("roster_row", {}).get("record", ""), rec_chk,
                        r.get("stat_fights", ""), r.get("def_fights", ""),
                        r.get("coverage", ""), photo_ok, country_ok))
                    mf.flush()
                # keep the pool full until the time budget is hit
                if time.time() < deadline:
                    try:
                        nsid = next(it)
                        futures[ex.submit(work, nsid)] = nsid
                    except StopIteration:
                        pass
                break  # re-evaluate as_completed over the updated set
            if time.time() >= deadline and len(futures) == 0:
                break
            if time.time() >= deadline:
                # stop scheduling new work; drain in-flight then exit
                for fut in as_completed(list(futures)):
                    sid = futures.pop(fut)
                    _, r = fut.result()
                    st = r.get("status", "error")
                    with lock:
                        counts[st] = counts.get(st, 0) + 1
                        n_done += 1
                        photo_ok = "1" if str(r.get("photo", "")).startswith("saved") else "0"
                        country_ok = "1" if r.get("roster_row", {}).get("country") else "0"
                        rec_chk = "ok" if r.get("record_check", "ok") == "ok" else "MISMATCH"
                        mf.write("%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s\n" % (
                            sid, st, r.get("slug", ""),
                            r.get("roster_row", {}).get("division", ""),
                            r.get("roster_row", {}).get("record", ""), rec_chk,
                            r.get("stat_fights", ""), r.get("def_fights", ""),
                            r.get("coverage", ""), photo_ok, country_ok))
                        mf.flush()
                break

    mf.close()
    print("this batch: %d processed in ~%.0fs" % (n_done, a.seconds))
    for k in sorted(counts): print("  %-14s %d" % (k, counts[k]))
    print("remaining after batch: %d" % (len(todo) - n_done))

if __name__ == "__main__":
    main()
