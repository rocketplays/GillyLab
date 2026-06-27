#!/usr/bin/env python3
"""
fight-stats-backfill.py  —  pull per-fight box-score stats from ESPN's public
JSON API and merge them into data/fight-stats.json, keyed by fighter name.

The GillyLab site (index.html) reads data/fight-stats.json and makes a fight
row in a fighter's history clickable when a matching stat line exists, opening
a modal that compares both fighters' totals for that bout.

Usage:
    python3 scripts/fight-stats-backfill.py "Manel Kape"
    python3 scripts/fight-stats-backfill.py "Manel Kape" --espn-id 4236504
    python3 scripts/fight-stats-backfill.py --all          # every FIGHTERS name in index.html
    python3 scripts/fight-stats-backfill.py --all --sleep 0.4

Notes
-----
* ESPN only has detailed box scores for fights it tracked — essentially UFC.
  The athlete "eventlog" endpoint is UFC-league scoped, so non-UFC bouts
  (Bellator / M-1 / RIZIN / regional) simply won't appear and stay un-clickable
  on the site. That is expected, not an error.
* The script is idempotent: re-running re-fetches a fighter and overwrites just
  that fighter's array in the JSON, leaving everyone else untouched.
* Be polite on --all: it sleeps between fighters and caches nothing server-side.
"""
import argparse, json, os, re, sys, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX = os.path.join(ROOT, "index.html")
OUT   = os.path.join(ROOT, "data", "fight-stats.json")

UA = {"User-Agent": "Mozilla/5.0 (GillyLab fight-stats backfill)"}
CORE = "https://sports.core.api.espn.com/v2/sports/mma/leagues/ufc"
ATHL = "https://sports.core.api.espn.com/v2/sports/mma/athletes"
SEARCH = "https://site.api.espn.com/apis/common/v3/search"

MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]


def get(url, tries=4):
    last = None
    for i in range(tries):
        try:
            return urllib.request.urlopen(
                urllib.request.Request(url, headers=UA), timeout=30
            ).read().decode("utf-8", "ignore")
        except Exception as e:
            last = e
            time.sleep(2 + 2 * i)
    raise last


def getj(url, tries=4):
    return json.loads(get(url, tries))


def fold(s):
    """loose name key: strip accents/punct/spacing, lowercase."""
    import unicodedata
    s = unicodedata.normalize("NFKD", s or "")
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]", "", s.lower())


def espn_id(name, override=None):
    if override:
        return str(override)
    html = get(SEARCH + "?" + urllib.parse.urlencode(
        {"query": name, "limit": "12", "type": "player", "sport": "mma"}))
    cands = re.findall(r'/mma/fighter/_/id/(\d+)/([a-z0-9-]+)', html)
    want = fold(name)
    for cid, slug in cands:
        if fold(slug.replace("-", " ")) == want:
            return cid
    return cands[0][0] if cands else None


def iso_to_label(iso):
    """'2026-06-21T02:00Z' -> 'Jun 20, 2026' (shift to US fight-night date)."""
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})T(\d{2})", iso or "")
    if not m:
        return None
    y, mo, d, h = int(m.group(1)), int(m.group(2)), int(m.group(3)), int(m.group(4))
    # ESPN stamps bouts in UTC; a US card after ~22:00 local rolls past midnight,
    # so anything before ~12:00Z belongs to the previous calendar day locally.
    import datetime
    dt = datetime.datetime(y, mo, d) - (datetime.timedelta(days=1) if h < 12 else datetime.timedelta())
    return "%s %d, %d" % (MONTHS[dt.month - 1], dt.day, dt.year)


def _n(stats, key):
    v = stats.get(key)
    try:
        return int(round(float(v)))
    except (TypeError, ValueError):
        return 0


def pack(stats):
    """ESPN's 43-field 'general' category -> compact record for the site."""
    head = _n(stats, "sigDistanceHeadStrikesLanded") + _n(stats, "sigClinchHeadStrikesLanded") + _n(stats, "sigGroundHeadStrikesLanded")
    headA = _n(stats, "sigDistanceHeadStrikesAttempted") + _n(stats, "sigClinchHeadStrikesAttempted") + _n(stats, "sigGroundHeadStrikesAttempted")
    body = _n(stats, "sigDistanceBodyStrikesLanded") + _n(stats, "sigClinchBodyStrikesLanded") + _n(stats, "sigGroundBodyStrikesLanded")
    bodyA = _n(stats, "sigDistanceBodyStrikesAttempted") + _n(stats, "sigClinchBodyStrikesAttempted") + _n(stats, "sigGroundBodyStrikesAttempted")
    leg = _n(stats, "sigDistanceLegStrikesLanded") + _n(stats, "sigClinchLegStrikesLanded") + _n(stats, "sigGroundLegStrikesLanded")
    legA = _n(stats, "sigDistanceLegStrikesAttempted") + _n(stats, "sigClinchLegStrikesAttempted") + _n(stats, "sigGroundLegStrikesAttempted")
    dist = _n(stats, "sigDistanceHeadStrikesLanded") + _n(stats, "sigDistanceBodyStrikesLanded") + _n(stats, "sigDistanceLegStrikesLanded")
    distA = _n(stats, "sigDistanceHeadStrikesAttempted") + _n(stats, "sigDistanceBodyStrikesAttempted") + _n(stats, "sigDistanceLegStrikesAttempted")
    clinch = _n(stats, "sigClinchHeadStrikesLanded") + _n(stats, "sigClinchBodyStrikesLanded") + _n(stats, "sigClinchLegStrikesLanded")
    clinchA = _n(stats, "sigClinchHeadStrikesAttempted") + _n(stats, "sigClinchBodyStrikesAttempted") + _n(stats, "sigClinchLegStrikesAttempted")
    ground = _n(stats, "sigGroundHeadStrikesLanded") + _n(stats, "sigGroundBodyStrikesLanded") + _n(stats, "sigGroundLegStrikesLanded")
    groundA = _n(stats, "sigGroundHeadStrikesAttempted") + _n(stats, "sigGroundBodyStrikesAttempted") + _n(stats, "sigGroundLegStrikesAttempted")
    ctrl = stats.get("timeInControl") or "0:00"
    return {
        "kd": _n(stats, "knockDowns"),
        "sigL": _n(stats, "sigStrikesLanded"), "sigA": _n(stats, "sigStrikesAttempted"),
        "totL": _n(stats, "totalStrikesLanded"), "totA": _n(stats, "totalStrikesAttempted"),
        "tdL": _n(stats, "takedownsLanded"), "tdA": _n(stats, "takedownsAttempted"),
        "sub": _n(stats, "submissions"), "rev": _n(stats, "reversals"), "ctrl": ctrl,
        "head": [head, headA], "body": [body, bodyA], "leg": [leg, legA],
        "dist": [dist, distA], "clinch": [clinch, clinchA], "ground": [ground, groundA],
    }


def athlete_name(ref, cache):
    if ref in cache:
        return cache[ref]
    try:
        nm = getj(ref).get("displayName")
    except Exception:
        nm = None
    cache[ref] = nm
    return nm


def backfill_one(name, override=None, namecache=None):
    namecache = namecache if namecache is not None else {}
    sid = espn_id(name, override)
    if not sid:
        print("  ! no ESPN id for %s" % name); return None
    try:
        log = getj("%s/%s/eventlog" % (ATHL, sid))
    except Exception as e:
        print("  ! eventlog failed for %s (%s)" % (name, e)); return None
    items = log.get("events", {}).get("items", [])
    out = []
    for it in items:
        if not it.get("played"):
            continue
        evref = it.get("event", {}).get("$ref", "")
        cref = it.get("competition", {}).get("$ref", "")
        # Only UFC: ESPN flags RIZIN/regional bouts as boxscoreAvailable but
        # returns all-zero stats for them. The event $ref encodes the real
        # league (.../leagues/<slug>/events/...), so filter on it (no extra fetch).
        league = re.search(r"/leagues/([a-z0-9-]+)/", evref) or re.search(r"/leagues/([a-z0-9-]+)/", cref)
        if not league or league.group(1) != "ufc":
            continue
        ev = re.search(r"/events/(\d+)", evref)
        co = re.search(r"/competitions/(\d+)", cref)
        if not (ev and co):
            continue
        cu = "%s/events/%s/competitions/%s" % (CORE, ev.group(1), co.group(1))
        try:
            comp = getj(cu)
        except Exception:
            continue
        if not comp.get("boxscoreAvailable"):
            continue
        date_label = iso_to_label(comp.get("date") or "")
        me = opp = None
        for c in comp.get("competitors", []):
            aref = c.get("athlete", {}).get("$ref", "")
            aid = re.search(r"/athletes/(\d+)", aref)
            sref = c.get("statistics", {}).get("$ref", "")
            if not sref:
                continue
            try:
                cats = getj(sref).get("splits", {}).get("categories", [])
            except Exception:
                continue
            general = next((x for x in cats if x.get("name") == "general"), None)
            if not general:
                continue
            stats = {s.get("name"): s.get("displayValue") for s in general.get("stats", [])}
            rec = {"id": aid.group(1) if aid else None, "winner": bool(c.get("winner")),
                   "name": athlete_name(aref, namecache), "stats": pack(stats)}
            if aid and aid.group(1) == sid:
                me = rec
            else:
                opp = rec
        if not (me and opp):
            continue
        if (me["stats"]["totA"] + opp["stats"]["totA"]
                + me["stats"]["sigA"] + opp["stats"]["sigA"]) == 0:
            continue  # flagged available but no real data — don't tag an empty stat sheet
        out.append({
            "date": date_label,
            "opponent": opp["name"],
            "result": "W" if me["winner"] else ("L" if opp["winner"] else "D"),
            "f": me["stats"], "o": opp["stats"],
        })
    print("  %-26s id=%s  bouts with stats: %d" % (name, sid, len(out)))
    return out


def load_out():
    if os.path.exists(OUT):
        try:
            return json.load(open(OUT, encoding="utf-8"))
        except Exception:
            pass
    return {}


def roster_names():
    html = open(INDEX, encoding="utf-8").read()
    m = re.search(r"const FIGHTERS = \[(.*?)\n \];", html, re.S)
    block = m.group(1) if m else html
    return list(dict.fromkeys(re.findall(r'name:\s*"([^"]+)"', block)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("name", nargs="?")
    ap.add_argument("--espn-id")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--sleep", type=float, default=0.3)
    a = ap.parse_args()

    data = load_out()
    namecache = {}

    if a.all:
        names = roster_names()
        print("Backfilling %d roster fighters..." % len(names))
        for i, nm in enumerate(names, 1):
            try:
                rec = backfill_one(nm, namecache=namecache)
            except Exception as e:
                print("  ! %s errored: %s" % (nm, e)); rec = None
            if rec is not None:
                data[nm] = rec
                if i % 10 == 0:  # checkpoint to disk periodically
                    json.dump(data, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
            time.sleep(a.sleep)
    else:
        if not a.name:
            ap.error("provide a fighter name or --all")
        rec = backfill_one(a.name, a.espn_id, namecache)
        if rec is None:
            sys.exit(1)
        data[a.name] = rec

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(data, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    print("Wrote %s (%d fighters total)." % (os.path.relpath(OUT, ROOT), len(data)))


if __name__ == "__main__":
    main()
