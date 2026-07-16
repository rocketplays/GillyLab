#!/usr/bin/env python3
"""Parallel, resumable, time-bounded driver for fight-stats-backfill.

The sandbox caps each run at ~45s and freezes between calls, and the plain
`--all` backfill is sequential (too slow for 3,000+ fighters). This wraps the
proven backfill_one() with a thread pool, feeds it the known ESPN id from the
import manifest (skips the name-search + avoids wrong-athlete fallbacks), writes
data/fight-stats.json incrementally under a lock, and stops at --seconds.

Re-invoke until "remaining: 0" (uses only-missing style resume via the JSON).

  python3 scripts/fight-stats-parallel.py --workers 32 --seconds 38
"""
import os, re, csv, json, glob, time, argparse, importlib.util, threading, urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

HERE = os.path.dirname(os.path.abspath(__file__))
def _load(mod, path):
    spec = importlib.util.spec_from_file_location(mod, os.path.join(HERE, path))
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
fsb = _load("fsb", "fight-stats-backfill.py")
imp = _load("imp", "espn-fighter-import.py")

# The backfill's default get() sleeps 2-8s on any transient error, which stalls
# workers badly under concurrency. Use a gentle short backoff instead.
def _gentle_get(url, tries=3):
    last = None
    for i in range(tries):
        try:
            return urllib.request.urlopen(
                urllib.request.Request(url, headers=fsb.UA), timeout=20).read().decode("utf-8", "ignore")
        except Exception as e:
            last = e; time.sleep(0.35 * (i + 1))
    raise last
fsb.get = _gentle_get

OUT = fsb.OUT

def _atomic_dump(data):
    tmp = OUT + '.tmp'
    json.dump(data, open(tmp, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    os.replace(tmp, OUT)
MANIFEST = os.path.join(HERE, "espn-import-output", "_manifest.csv")

_GRID_CACHE = {}

def grid_index():
    """Fighters who already have the strike grid.

    READS data/fight-grid.json, NOT fight-stats.json, AND THAT IS THE WHOLE POINT.
    The pipeline is: backfill writes `g` INTO fight-stats.json, then
    split-fight-grid.cjs LIFTS IT BACK OUT (because fight-stats.json is eager-
    fetched by every visitor and must not carry 2MB for an optional panel). So by
    the time the next run asks "who has the grid?", fight-stats.json has no `g` in
    it — by design.

    Checking fight-stats.json therefore reports EVERY fighter as missing, forever.
    Caught by simulating one newly-announced fighter and watching the queue read
    112 instead of 1: CI would have re-fetched the whole card twice a day and the
    commit message would have said "steady state is the delta only". The split is
    what makes the eager payload safe AND what erases the evidence the predicate
    was reading — two correct pieces whose seam is a bug.
    """
    if not _GRID_CACHE:
        p = os.path.join(HERE, "..", "data", "fight-grid.json")
        try:
            g = json.load(open(p))
        except Exception:
            g = {}
        _GRID_CACHE["names"] = {n for n, rows in g.items()
                                if any(((r or {}).get("f") or {}).get("g") for r in (rows or []))}
    return _GRID_CACHE["names"]


def _has_grid(name, rows):
    """True if the grid exists for this fighter, in EITHER place.

    fight-grid.json is the post-split home; fight-stats.json is where it lands
    pre-split. Both count, so the predicate is correct whether or not the split has
    run yet — which matters because CI runs backfill then split, and a human
    debugging locally may well run them out of order.
    """
    if name in grid_index():
        return True
    return any(((b or {}).get("f") or {}).get("g") for b in (rows or []))


def _norm(s):
    """Fold accents and case. NOT optional: the card says 'Dricus Du Plessis' and
    the stats say 'Dricus du Plessis'; the card says 'Aleksandar Rakic' and the
    stats say 'Aleksandar Rakić'. A raw-string join drops a champion and reports
    it as 'no stats available', which is a bug about the matcher wearing the
    costume of a bug about the data."""
    import unicodedata
    s = unicodedata.normalize("NFD", str(s or ""))
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z ]", "", s.lower()).strip()


def card_names():
    """Every fighter on every card in data/event.json, normalised.

    ALL the events, not just the featured one: the deep dive button goes on every
    bout the events page renders, and event.json currently carries 18 events out
    to September. The Contender Series cards with 0 bouts today will have fighters
    when ESPN announces them — this reads whatever is there at the time, which is
    what makes the whole thing auto-populate rather than need a human.

    READS bouts[].fighters[].fighterName EXPLICITLY, not a recursive hunt for any
    key called "name". The first version walked the whole object grabbing every
    `name`, which also collects venues and broadcasters, so it needed a junk filter
    — and the filter I reached for was `" " in name`. That silently dropped every
    MONONYM on the card: Sumudaerji (11 bouts of stats) and Aoriqileng (10) both
    vanished, and their fights would simply never have got a button. Single-name
    fighters are not an edge case in this sport.
    A heuristic to clean up an imprecise read is two bugs: the imprecise read, and
    the heuristic. The field has a name; use it."""
    p = os.path.join(HERE, "..", "data", "event.json")
    if not os.path.exists(p): return set()
    try:
        ev = json.load(open(p))
    except Exception:
        return set()
    out = set()
    for e in (ev.get("data") or []):
        for b in (e.get("bouts") or []):
            for f in (b.get("fighters") or []):
                nm = f.get("fighterName")
                if isinstance(nm, str) and nm.strip():
                    out.add(_norm(nm))
    return {n for n in out if n}


def parallel_fighter(sid, namecache, bout_workers):
    """Same output as fsb.backfill_one but fetches a fighter's bouts concurrently
    (given a known id) so long-career fighters finish in seconds, not ~15s."""
    items = []
    page = 1
    while True:                                   # eventlog is paginated (25/page)
        try:
            log = fsb.getj("%s/%s/eventlog?page=%d" % (fsb.ATHL, sid, page))
        except Exception:
            return None if page == 1 else _finish(items, sid, namecache, bout_workers)
        ev = log.get("events", {})
        items.extend(ev.get("items", []))
        if page >= (ev.get("pageCount") or 1):
            break
        page += 1
    return _finish(items, sid, namecache, bout_workers)

def _finish(items, sid, namecache, bout_workers):
    import re
    pairs = []
    for it in items:
        if not it.get("played"): continue
        evref = it.get("event", {}).get("$ref", ""); cref = it.get("competition", {}).get("$ref", "")
        lg = re.search(r"/leagues/([a-z0-9-]+)/", evref) or re.search(r"/leagues/([a-z0-9-]+)/", cref)
        if not lg or lg.group(1) != "ufc": continue
        ev = re.search(r"/events/(\d+)", evref); co = re.search(r"/competitions/(\d+)", cref)
        if ev and co: pairs.append((ev.group(1), co.group(1)))
    def fetch_bout(p):
        ev, co = p
        try:
            comp = fsb.getj("%s/events/%s/competitions/%s" % (fsb.CORE, ev, co))
        except Exception:
            return None
        if not comp.get("boxscoreAvailable"): return None
        date_label = fsb.iso_to_label(comp.get("date") or "")
        me = opp = None
        for c in comp.get("competitors", []):
            aref = c.get("athlete", {}).get("$ref", ""); aid = re.search(r"/athletes/(\d+)", aref)
            sref = c.get("statistics", {}).get("$ref", "")
            if not sref: continue
            try:
                cats = fsb.getj(sref).get("splits", {}).get("categories", [])
            except Exception:
                continue
            general = next((x for x in cats if x.get("name") == "general"), None)
            if not general: continue
            stats = {s.get("name"): s.get("displayValue") for s in general.get("stats", [])}
            rec = {"id": aid.group(1) if aid else None, "winner": bool(c.get("winner")),
                   "name": fsb.athlete_name(aref, namecache), "stats": fsb.pack(stats)}
            if aid and aid.group(1) == str(sid): me = rec
            else: opp = rec
        if not (me and opp): return None
        if (me["stats"]["totA"] + opp["stats"]["totA"] + me["stats"]["sigA"] + opp["stats"]["sigA"]) == 0:
            return None
        return {"date": date_label, "opponent": opp["name"],
                "result": "W" if me["winner"] else ("L" if opp["winner"] else "D"),
                "f": me["stats"], "o": opp["stats"]}
    if not pairs: return []
    with ThreadPoolExecutor(max_workers=min(bout_workers, len(pairs))) as bex:
        return [r for r in bex.map(fetch_bout, pairs) if r]

def build_idmap():
    idmap = {}
    # exact name -> id from the per-fighter import snippets (most reliable)
    for p in glob.glob(os.path.join(HERE, "espn-import-output", "*.json")):
        try:
            j = json.load(open(p))
            if j.get("name") and j.get("espn_id"): idmap[j["name"]] = str(j["espn_id"])
        except Exception:
            pass
    # slug -> id from the manifest (covers in_roster / everyone processed)
    slug2id = {}
    if os.path.exists(MANIFEST):
        for r in csv.DictReader(open(MANIFEST)):
            if r.get("slug") and r.get("espn_id", "").isdigit():
                slug2id[r["slug"]] = r["espn_id"]
    return idmap, slug2id

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=12)
    ap.add_argument("--bout-workers", type=int, default=8)
    ap.add_argument("--seconds", type=float, default=38.0)
    ap.add_argument("--all", action="store_true", help="reprocess everyone (default is only-missing)")
    ap.add_argument("--refetch-min", type=int, default=0,
                    help="re-fetch fighters that already have >= N saved bouts (catches page-1 "
                         "truncation on long-career fighters); overwrites only on a non-empty result")
    # --- the deep dive's two flags ---
    #
    # WHY --only-missing (the default) CANNOT DO THIS JOB. Its predicate is
    # `n not in data` — "have we ever saved this fighter?" — and every fighter on
    # every card is already saved. They are saved WITHOUT the strike grid, which is
    # precisely the case that predicate cannot see. Asking "does the fighter exist"
    # when you mean "does the fighter have the field" is the same class of mistake
    # as joining on a raw name and silently dropping Dricus du Plessis.
    ap.add_argument("--needs-grid", action="store_true",
                    help="fetch fighters whose saved bouts have no `g` (strike grid). "
                         "Self-clearing: once a fighter has the grid he drops out of todo, "
                         "so no mark file, and re-running is idempotent.")
    ap.add_argument("--card", action="store_true",
                    help="restrict to fighters on an upcoming card (data/event.json). "
                         "The deep dive lives on the events page; the other ~2,980 "
                         "fighters in the roster are not on the critical path.")
    a = ap.parse_args()

    data = fsb.load_out()
    names = fsb.roster_names()
    fh = fsb.parse_fight_history()
    idmap, slug2id = build_idmap()
    def get_id(nm):
        if nm in idmap: return idmap[nm]
        return slug2id.get(imp.name_to_slug(nm))

    MARK = os.path.join(HERE, "espn-import-output", "_refetched.txt")
    refetch = a.refetch_min > 0
    pool = names
    if a.card:
        card = card_names()
        pool = [n for n in names if _norm(n) in card]
        print("card fighters matched in roster: %d of %d names on upcoming cards"
              % (len(pool), len(card)))

    if refetch:
        marked = set(l.strip() for l in open(MARK)) if os.path.exists(MARK) else set()
        todo = [n for n in pool if len(data.get(n, [])) >= a.refetch_min and n not in marked]
    elif a.needs_grid:
        # No mark file on purpose: the predicate is its own progress tracker. A
        # fighter with the grid is no longer missing it, so a re-run picks up
        # exactly what failed last time and nothing else. --refetch-min needs a
        # mark file because "has >= N bouts" is still true after you refetch it.
        # `data[n]` non-empty is load-bearing, not a tidy-up. A fighter saved with
        # ZERO bouts has no ESPN box scores to have a grid FROM — five of them sit
        # on the current cards (debutants). Without this they are permanently
        # missing the grid, so every run re-queues them, re-fetches them, gets
        # nothing, and reports "saved 0 bouts" forever. A self-clearing predicate
        # that can never clear is just a loop with good manners.
        # These are also exactly the fighters whose button must hide: no stats, no
        # panel. The queue and the UI agree by construction rather than by two
        # separate rules that can drift.
        todo = [n for n in pool if data.get(n) and not _has_grid(n, data[n])]
    else:
        todo = pool if a.all else [n for n in pool if n not in data]
    print("roster: %d | already saved: %d | to process: %d%s"
          % (len(pool), len(data), len(todo),
             " (refetch)" if refetch else " (needs-grid)" if a.needs_grid else ""))
    if not todo: return

    deadline = time.time() + a.seconds
    lock = threading.Lock()
    namecache = {}
    done_ct = [0]; bout_ct = [0]

    def work(nm):
        sid = get_id(nm)
        if not sid and refetch:                # refetch: alias fighters resolved earlier via search
            try: sid, _ = fsb.espn_id(nm)
            except Exception: sid = None
        if not sid: return nm, "no_id"
        try:
            return nm, parallel_fighter(sid, namecache, a.bout_workers)
        except Exception:
            return nm, None

    def record(nm, bouts):
        with lock:
            if isinstance(bouts, list):
                if bouts or not refetch:       # in refetch mode never overwrite good data with empty
                    data[nm] = bouts
                    bout_ct[0] += len(bouts)
            if refetch and isinstance(bouts, list):   # only mark done on success, not on fetch error
                with open(MARK, "a") as mf: mf.write(nm + "\n")
            done_ct[0] += 1
            if done_ct[0] % 25 == 0:
                _atomic_dump(data)

    ex = ThreadPoolExecutor(max_workers=a.workers)
    futs = {ex.submit(work, nm): nm for nm in todo}
    for fut in as_completed(futs):
        rnm, bouts = fut.result()
        record(rnm, bouts)
        if time.time() >= deadline:
            break
    with lock:
        _atomic_dump(data)
    print("this batch: processed %d, saved %d bouts | json total: %d | remaining: %d"
          % (done_ct[0], bout_ct[0], len(data), len(todo) - done_ct[0]), flush=True)
    ex.shutdown(wait=False, cancel_futures=True)
    os._exit(0)   # don't wait on in-flight worker threads (data already flushed)
    print("this batch: processed %d, saved %d bouts | total fighters in json: %d | remaining: %d"
          % (done_ct[0], bout_ct[0], len(data), len(todo) - done_ct[0]))

if __name__ == "__main__":
    main()
