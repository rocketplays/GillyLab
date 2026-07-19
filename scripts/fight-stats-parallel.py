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
import os, re, csv, json, glob, time, datetime, argparse, importlib.util, threading, urllib.request
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
_LASTFIGHT_CACHE = {}


def _pdate(s):
    """'Mar 21, 2026' -> datetime, or None."""
    try:
        return datetime.datetime.strptime(str(s or "").strip(), "%b %d, %Y")
    except Exception:
        return None


def last_completed_fights():
    """name -> date of their newest COMPLETED bout, from index.html's FIGHT_HISTORY.

    FIGHT_HISTORY is kept current by the workflow's "Persist finished bouts into
    static fight history" step, so it knows about a fight the moment the card ends —
    which is what lets us tell a stale grid from a current one WITHOUT re-fetching
    every fighter from ESPN just to find out.

    Scheduled bouts are excluded: they carry method "Upcoming" and an empty result,
    and counting them would mark every fighter with an announced fight as stale and
    re-queue the whole card twice a day — the exact runaway the grid_index() docstring
    is about.
    """
    if not _LASTFIGHT_CACHE:
        out = {}
        try:
            html = open(fsb.INDEX, encoding="utf-8").read()
        except OSError:
            _LASTFIGHT_CACHE["map"] = out
            return out
        start = html.find("const FIGHT_HISTORY")
        if start >= 0:
            block = html[start:]
            marks = [(m.group(1), m.end()) for m in re.finditer(r'"([^"]+)":\s*\[', block)]
            for i, (name, pos) in enumerate(marks):
                end = marks[i + 1][1] if i + 1 < len(marks) else min(len(block), pos + 20000)
                best = None
                for row in re.findall(r"\{[^{}]*\}", block[pos:end]):
                    if "Upcoming" in row:
                        continue
                    res = re.search(r'result:\s*"([^"]*)"', row)
                    if not res or res.group(1) in ("", "-", "–"):
                        continue
                    dt = _pdate((re.search(r'date:\s*"([^"]+)"', row) or [None, ""])[1])
                    if dt and (best is None or dt > best):
                        best = dt
                if best and (name not in out or best > out[name]):
                    out[name] = best
        _LASTFIGHT_CACHE["map"] = out
    return _LASTFIGHT_CACHE["map"]


def _grid_stale(name):
    """True when the fighter HAS a grid but it predates his most recent fight.

    Without this, --needs-grid is presence-only: a fighter's grid is built the first
    time he is announced for a card and then never rebuilt, so every fight after that
    is missing from the matchup deep dive, permanently and silently. Measured
    2026-07-19: 102 of the 103 fighters in the served grid were current only because
    the corpus is young enough that their grids postdate their last fight; Jovan Leka,
    who fought after his was built, was 179 days behind.

    The 2-day slack absorbs date-labelling differences between the grid's ESPN dates
    and FIGHT_HISTORY's event dates (a US Saturday card is often the 29th in one and
    the 30th in the other) — without it, a third of the card looks stale every week.
    """
    g = grid_latest().get(name)
    if not g:
        return False                       # no grid at all — _has_grid already says so
    h = last_completed_fights().get(name)
    return bool(h and (h - g).days > 2)

def grid_index():
    """Fighters who already have the strike grid.

    READS THE GRID FILES, NOT fight-stats.json, AND THAT IS THE WHOLE POINT.
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

    AND THEN THE SAME SEAM MOVED AND BROKE IT AGAIN. fight-grid.json used to BE the
    master — every fighter ever lifted — so reading it answered the question. The
    division-median work made it the CARD SUBSET and put the master in
    fight-grid-all.json, at which point this predicate could only see ~109 fighters
    and reported all ~500 swept roster fighters as missing. Observed live: the queue
    went UP, 340 -> 447, immediately after a split. Left alone the sweep never
    terminates and CI refetches the same men twice a day, green throughout — the
    exact failure the paragraph above is about, reintroduced by moving the evidence
    rather than by reading the wrong file.

    So: THE MASTER FIRST, the shipped subset as a fallback (it is all that exists on
    a checkout that predates the master, and seeding order matters more than speed
    here). Union, not either/or — a fighter counts if he is in either.

    THIRD TIME'S THE CHARM ON THE ERROR HANDLING, TOO. `except Exception: continue`
    treats "the file isn't there" and "the file is there but I can't read it" as the
    same thing. They aren't. This repo lives on iCloud Drive and fight-grid-all.json
    is the perfect eviction target — 1.4MB, never fetched by the browser, touched by
    a build script twice a day. Offloaded, it still exists at full size and reading
    it raises errno 35 from any process that can't trigger iCloud's download. The
    old code would shrug, see 109 fighters instead of 618, and re-queue ~500 men for
    a re-scrape ESPN already gave us. Green job, wasted hours, and nobody the wiser.

    Missing is fine (first run). Unreadable is NOT — let it raise.
    """
    if not _GRID_CACHE:
        names = set(); latest = {}
        d = os.path.join(HERE, "..", "data")
        for fn in ("fight-grid-all.json", "fight-grid.json"):
            p = os.path.join(d, fn)
            if not os.path.exists(p):
                continue                      # genuinely absent: fine
            g = json.load(open(p))            # present but unreadable: raise, loudly
            for n, rows in g.items():
                gr = [r for r in (rows or []) if ((r or {}).get("f") or {}).get("g")]
                if not gr:
                    continue
                names.add(n)
                # Newest bout the stored grid actually covers — this is what makes
                # staleness detectable at all (see _grid_stale).
                for r in gr:
                    dt = _pdate(r.get("date"))
                    if dt and (n not in latest or dt > latest[n]):
                        latest[n] = dt
        _GRID_CACHE["names"] = names
        _GRID_CACHE["latest"] = latest
    return _GRID_CACHE["names"]


def grid_latest():
    """name -> newest bout date covered by the stored grid."""
    grid_index()
    return _GRID_CACHE.get("latest") or {}


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


def active_roster_names():
    """index.html's ACTIVE_ROSTER, resolved to FIGHTERS names and normalised.

    WHY THIS EXISTS: roster_names() returns every name in the FIGHTERS array —
    3,101 of them, most retired. That is the right pool for "does this fighter
    have a page" and the WRONG pool for "what does a typical fighter in this
    division do", which is what the division medians need. populateFighterStats()
    in index.html already made this exact call and says so out loud: "FIGHTERS
    carries thousands of retired fighters who would skew the division median."
    Same reasoning, same population. It also cuts the sweep from ~2,990 fighters
    to ~510, which is the difference between a job you run and one you schedule.

    Parsed from the ACTIVE_ROSTER literal, not inferred from `rank`: only 177
    fighters carry a rank, and an unranked fighter is not a retired one.

    TWO TRAPS, BOTH HIT ON THE FIRST WRITE OF THIS FUNCTION:

    1. ACTIVE_ROSTER IS ONE LINE. It closes with `"];` with no newline before the
       bracket, so a `\\[(.*?)\\n\\s*\\];` pattern does not stop at the end of the
       array — it runs on into ROSTER_CHANGES and starts collecting week labels
       and the literal string "Name" as if they were fighters. Harmless here only
       because junk never matches a real roster name; still wrong, and the kind of
       wrong that makes a count look plausible.

    2. THE ROSTER USES DISPLAY NAMES; FIGHTERS USES DB NAMES. Folding accents is
       not enough — "Jan Blachowicz" vs "Jan Błachowicz" survives NFD, but
       "King Green" -> "Bobby Green" and "Patricio Freire" -> "Patrício Pitbull"
       do not, and neither does "Thomas Gantt" -> "Tommy Gantt". Seven fighters,
       a former light-heavyweight champion among them, silently dropped out of
       their own division's baseline. index.html already solved this exact problem
       (activeRosterDbSet: DBSET -> ALIASES -> DBNORM); this is the same resolution
       in the same order. A miss here looks precisely like a fighter who has no
       data, which is the bug this codebase keeps rewriting.
    """
    html = open(fsb.INDEX, encoding="utf-8").read()
    m = re.search(r"const ACTIVE_ROSTER = \[(.*?)\];", html, re.S)
    if not m:
        return set()
    raw = re.findall(r'"([^"]+)"', m.group(1))
    aliases = {}
    am = re.search(r"const ACTIVE_ROSTER_ALIASES\s*=\s*\{(.*?)\n\s*\};", html, re.S)
    if am:
        aliases = dict(re.findall(r'"([^"]+)"\s*:\s*"([^"]+)"', am.group(1)))
    db = {_norm(n) for n in roster_names_raw(html)}
    out = set()
    for n in raw:
        k = _norm(n)
        if k in db:
            out.add(k)
            continue
        t = aliases.get(n)
        if t and _norm(t) in db:
            out.add(_norm(t))
    return {n for n in out if n}


def roster_names_raw(html):
    """FIGHTERS names, read from an already-loaded index.html (fsb.roster_names()
    re-reads the 13MB file; this is called alongside the ACTIVE_ROSTER parse)."""
    m = re.search(r"const FIGHTERS = \[(.*?)\n \];", html, re.S)
    return re.findall(r'name:\s*"([^"]+)"', m.group(1) if m else html)


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


def alias_names(db_name, html=None):
    """Other names the SAME fighter is known by, per index.html's curated table.

    BOTH CACHES ABOVE ARE KEYED BY ESPN'S NAME, and the pool is keyed by ours. When
    they disagree the fighter becomes unfetchable: get_id() misses on both the name
    and the slug, returns None, and he silently never gets a grid. Measured
    2026-07-16, that is exactly why Jose Delgado vs Austin Bashi had no matchup
    panel -- his ESPN id (5223435, status ok, 5 fights, coverage 1.0) was sitting in
    the cache the whole time under "Jose Miguel Delgado". The sweep reported
    "processed 6, saved 0 bouts" every run and looked like a normal no-op.

    ACTIVE_ROSTER_ALIASES maps ESPN/display name -> our DB name. get_id() needs the
    reverse, so this inverts it: given "Jose Delgado", return ["Jose Miguel Delgado"].

    CURATED ONLY. No fuzzy matching, no token overlap, no "Jose Delgado is a subset
    of Jose Miguel Delgado". This module's whole reason for reading a manifest
    instead of searching ESPN by name is to avoid wrong-athlete fallbacks -- a
    heuristic would hand "Jose Souza" some other Souza's career and never say so.
    A human asserting two names are one man is evidence; a substring is not.
    """
    if html is None:
        html = open(fsb.INDEX, encoding="utf-8").read()
    m = re.search(r"const ACTIVE_ROSTER_ALIASES\s*=\s*\{(.*?)\n\s*\};", html, re.S)
    if not m:
        return []
    rev = {}
    for k, v in re.findall(r'"([^"]+)"\s*:\s*"([^"]+)"', m.group(1)):
        rev.setdefault(_norm(v), []).append(k)
    return rev.get(_norm(db_name), [])

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
    # THE DIVISION-MEDIAN SWEEP.
    #
    # --card gets the grid onto the panel. --active gets the grid onto ENOUGH
    # fighters to say what a number MEANS. Measured on the card-only grid (109
    # fighters, 11 divisions): only 16 of 99 division x cell combos had the 8 peers
    # a median needs, and the whole clinch row had none in any division. Worse, a
    # "division median" drawn from card fighters is really "the median of whoever
    # from that weight class is booked this weekend" — it moves week to week for
    # reasons that have nothing to do with the fighter being shaded.
    #
    # ACTIVE_ROSTER, not roster_names(): retired fighters skew a division median,
    # and 653 is a sweep you run once rather than 3,101.
    ap.add_argument("--active", action="store_true",
                    help="restrict to the ACTIVE_ROSTER (653 names in index.html). "
                         "Use with --needs-grid for the one-off sweep that makes "
                         "per-division baselines possible. Resumable: --needs-grid "
                         "is self-clearing, so re-run until 'to process: 0'.")
    a = ap.parse_args()
    if a.card and a.active:
        ap.error("--card and --active both narrow the pool; pick one "
                 "(--card = this weekend's bouts, --active = the sweep)")

    data = fsb.load_out()
    names = fsb.roster_names()
    fh = fsb.parse_fight_history()
    idmap, slug2id = build_idmap()
    _alias_html = open(fsb.INDEX, encoding="utf-8").read()   # read once, not per fighter
    def get_id(nm):
        if nm in idmap: return idmap[nm]
        sid = slug2id.get(imp.name_to_slug(nm))
        if sid: return sid
        # THE CACHES ARE KEYED BY ESPN'S NAME; the pool is keyed by ours. When they
        # disagree, both lookups above miss and the fighter is unfetchable for ever
        # -- silently, because returning None looks the same as "no such athlete".
        # See alias_names(): curated pairs only, never a heuristic.
        for alt in alias_names(nm, _alias_html):
            if alt in idmap: return idmap[alt]
            sid = slug2id.get(imp.name_to_slug(alt))
            if sid: return sid
        return None

    MARK = os.path.join(HERE, "espn-import-output", "_refetched.txt")
    refetch = a.refetch_min > 0
    pool = names
    if a.card:
        card = card_names()
        pool = [n for n in names if _norm(n) in card]
        print("card fighters matched in roster: %d of %d names on upcoming cards"
              % (len(pool), len(card)))
    elif a.active:
        act = active_roster_names()
        if not act:
            # Fail loud. Silently falling through to all 3,101 would look like a
            # working sweep, take twenty times as long, and quietly poison every
            # division median with retired fighters — the failure mode this flag
            # exists to prevent.
            ap.error("--active: couldn't parse ACTIVE_ROSTER out of index.html. "
                     "Refusing to fall back to all %d roster names." % len(names))
        pool = [n for n in names if _norm(n) in act]
        print("active roster matched: %d of %d ACTIVE_ROSTER names (%d retired/unlisted skipped)"
              % (len(pool), len(act), len(names) - len(pool)))

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
        # ...OR whose grid is behind their latest fight. Presence alone was the bug:
        # a grid built when a fighter was first announced was never rebuilt, so the
        # deep dive silently froze at that date for the rest of his career.
        todo = [n for n in pool if data.get(n) and (not _has_grid(n, data[n]) or _grid_stale(n))]
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
