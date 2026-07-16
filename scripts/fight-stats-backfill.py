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
    python3 scripts/fight-stats-backfill.py --all --only-missing   # skip fighters already saved
    python3 scripts/fight-stats-backfill.py --all --limit 20       # small test batch to review first
    python3 scripts/fight-stats-backfill.py --all --strict         # confirm before saving suspicious matches
    python3 scripts/fight-stats-backfill.py --all --sleep 0.4

Validation: every run cross-checks each saved bout against the fighter's own
FIGHT_HISTORY (opponent + date) and flags fallback IDs / ESPN-name mismatches.
A --all run writes data/fight-stats-report.txt; warnings also print to stdout.
Data is still written when flagged — the report is a review list, not a blocker.

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
import argparse, datetime, json, os, re, sys, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX = os.path.join(ROOT, "index.html")
OUT   = os.path.join(ROOT, "data", "fight-stats.json")
REPORT = os.path.join(ROOT, "data", "fight-stats-report.txt")

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
    """Returns (id, exact) — exact=False means we fell back to the first search
    result with no exact slug match (a wrong-athlete risk worth flagging)."""
    if override:
        return str(override), True
    html = get(SEARCH + "?" + urllib.parse.urlencode(
        {"query": name, "limit": "12", "type": "player", "sport": "mma"}))
    cands = re.findall(r'/mma/fighter/_/id/(\d+)/([a-z0-9-]+)', html)
    want = fold(name)
    for cid, slug in cands:
        if fold(slug.replace("-", " ")) == want:
            return cid, True
    return (cands[0][0], False) if cands else (None, False)


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
    """ESPN's 43-field 'general' category -> compact record for the site.

    THE MARGINS THROW AWAY THE INTERESTING PART. ESPN serves a full 3x3 cross-tab —
    head/body/leg BY distance/clinch/ground — and this function has always summed it
    twice, once across positions to get `head` and once across targets to get
    `dist`, then kept only the two margins and discarded the grid. The grid is
    strictly richer: both margins are derivable from it, and it is not derivable
    from them.

    That matters because the margins cannot tell two different fighters apart.
    "Head 79%" reads identically for a boxer and a ground-and-pounder. In one real
    fight the same man went 12 of 23 to the head AT DISTANCE and 24 of 27 to the
    head ON THE GROUND — those are two completely different skills wearing one
    number, and the current schema shows the one.

    `g` is the grid, row-major [distance, clinch, ground] x [head, body, leg], each
    cell [landed, attempted]. The margins stay for backward compatibility:
    index.html reads .head[] / .clinch[] / .ground[] today and this file is
    eager-fetched by every visitor, so nothing about the shipped payload changes.
    split-fight-grid.cjs lifts `g` out into a separate lazy file.
    """
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
    # The grid, row-major: distance/clinch/ground x head/body/leg, each [L, A].
    cell = lambda pos, tgt: [
        _n(stats, "sig%s%sStrikesLanded" % (pos, tgt)),
        _n(stats, "sig%s%sStrikesAttempted" % (pos, tgt)),
    ]
    grid = [cell(p, t) for p in ("Distance", "Clinch", "Ground") for t in ("Head", "Body", "Leg")]
    return {
        "kd": _n(stats, "knockDowns"),
        "sigL": _n(stats, "sigStrikesLanded"), "sigA": _n(stats, "sigStrikesAttempted"),
        "totL": _n(stats, "totalStrikesLanded"), "totA": _n(stats, "totalStrikesAttempted"),
        "tdL": _n(stats, "takedownsLanded"), "tdA": _n(stats, "takedownsAttempted"),
        "sub": _n(stats, "submissions"), "rev": _n(stats, "reversals"), "ctrl": ctrl,
        "head": [head, headA], "body": [body, bodyA], "leg": [leg, legA],
        "dist": [dist, distA], "clinch": [clinch, clinchA], "ground": [ground, groundA],
        # NEW — the grid, and the grappling detail the margins never had room for.
        # `adv` is advances to half guard / side / mount / back: the difference
        # between a man who takes you down and a man who then goes somewhere.
        "g": grid,
        "tdAcc": round(float(stats.get("takedownAccuracy") or 0), 3),
        "slams": _n(stats, "takedownsSlams"),
        "adv": [_n(stats, "advanceToHalfGuard"), _n(stats, "advanceToSide"),
                _n(stats, "advanceToMount"), _n(stats, "advanceToBack")],
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
    sid, exact = espn_id(name, override)
    meta = {"sid": sid, "exact": exact, "espn_name": None, "reason": None}
    if not sid:
        print("  ! no ESPN id for %s" % name)
        meta["reason"] = "no ESPN id found"
        return None, meta
    try:
        log = getj("%s/%s/eventlog" % (ATHL, sid))
    except Exception as e:
        print("  ! eventlog failed for %s (%s)" % (name, e))
        meta["reason"] = "eventlog fetch failed (%s)" % e
        return None, meta
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
                if not meta["espn_name"]:
                    meta["espn_name"] = rec["name"]   # ESPN's own name for this athlete
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
    # For a fighter who produced no bouts we never fetched their athlete record,
    # so grab the display name once so the wrong-ID name check can still run.
    if not out and not meta["espn_name"]:
        try:
            meta["espn_name"] = getj("%s/%s" % (ATHL, sid)).get("displayName")
        except Exception:
            pass
    print("  %-26s id=%s  bouts with stats: %d%s"
          % (name, sid, len(out), "" if exact else "   [fallback id]"))
    return out, meta


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


# ───────────────────────────── validation ─────────────────────────────
# Safeguards against a wrong-athlete ID quietly attaching the wrong career to a
# name. Cross-checks each saved bout against the fighter's own FIGHT_HISTORY
# (opponent + date), and flags fallback IDs / ESPN-name mismatches. Findings go
# to data/fight-stats-report.txt and a stdout summary — they don't block writing.

def _label_dt(s):
    try:
        return datetime.datetime.strptime(s, "%b %d, %Y")
    except Exception:
        return None


def names_match(a, b):
    fa, fb = fold(a), fold(b)
    if not fa or not fb:
        return True
    if fa == fb or fa in fb or fb in fa:
        return True
    ta, tb = a.split(), b.split()
    la = fold(ta[-1]) if ta else fa
    lb = fold(tb[-1]) if tb else fb
    return len(la) >= 3 and la == lb            # last-name match (handles "da Silva" etc.)


def parse_fight_history():
    """{fighter name: [{date, opponent, org, event}, ...]} parsed from index.html."""
    html = open(INDEX, encoding="utf-8").read()
    i = html.find("const FIGHT_HISTORY = {")
    if i < 0:
        return {}
    j = html.find("\n};", i)
    block = html[i:(j if j > 0 else len(html))]
    fh = {}
    for m in re.finditer(r'\n  "((?:[^"\\]|\\.)*)":\s*\[(.*?)\n  \],?', block, re.S):
        fname = m.group(1).replace('\\"', '"')
        rows = []
        for rm in re.finditer(r'\{([^{}]*)\}', m.group(2)):
            row = rm.group(1)
            d = re.search(r'date:\s*"([^"]+)"', row)
            o = re.search(r'opponent:\s*"((?:[^"\\]|\\.)*)"', row)
            if not (d and o):
                continue
            org = re.search(r'org:\s*"([^"]*)"', row)
            ev = re.search(r'event:\s*"((?:[^"\\]|\\.)*)"', row)
            rows.append({"date": d.group(1),
                         "opponent": o.group(1).replace('\\"', '"'),
                         "org": (org.group(1) if org else ""),
                         "event": (ev.group(1).replace('\\"', '"') if ev else "")})
        fh[fname] = rows
    return fh


def is_ufc_row(r):
    return r["org"] == "UFC" or (not r["org"] and r["event"][:3].upper() == "UFC")


def validate(name, meta, bouts, fh_rows):
    """Return a list of human-readable warning strings (empty == clean)."""
    w = []
    if not meta.get("exact", True):
        w.append("[FALLBACK-ID] id=%s picked as first search result (no exact slug "
                 "match) — confirm it's the right athlete" % meta.get("sid"))
    en = meta.get("espn_name")
    if en and not names_match(en, name):
        w.append("[NAME?] ESPN athlete name '%s' != roster name '%s'" % (en, name))
    ufc_hist = [r for r in fh_rows if is_ufc_row(r)]
    if bouts is not None and len(bouts) == 0 and len(ufc_hist) > 0:
        w.append("[NO-STATS] 0 ESPN stat bouts but %d UFC fights in history — "
                 "possible wrong ID or ESPN data gap" % len(ufc_hist))
    if not fh_rows and bouts:
        w.append("[NO-HISTORY] %d bouts saved but fighter has no FIGHT_HISTORY yet "
                 "— can't cross-check opponents" % len(bouts))
        return w
    for b in (bouts or []):
        bdt = _label_dt(b["date"])
        match = None
        for r in fh_rows:
            rdt = _label_dt(r["date"])
            if rdt and bdt and abs((rdt - bdt).days) <= 1:
                match = r
                break
        if not match:
            w.append("[DATE?] bout %s vs %s has no history row within +/-1 day"
                     % (b["date"], b["opponent"]))
        elif not names_match(b["opponent"], match["opponent"]):
            w.append("[OPP?] %s — ESPN opponent '%s' but history says '%s'"
                     % (b["date"], b["opponent"], match["opponent"]))
    return w


def write_report(report, n_processed, n_bouts):
    flagged = [(nm, ws) for nm, ws in report if ws]
    lines = ["GillyLab fight-stats backfill — validation report",
             "Generated: %s" % datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
             "Fighters processed: %d   |   flagged: %d   |   bouts saved this run: %d"
             % (n_processed, len(flagged), n_bouts), ""]
    if not flagged:
        lines.append("No warnings — every saved bout matched its fighter's history.")
    else:
        lines.append("Review the fighters below (data was still written):")
        lines.append("")
        for nm, ws in flagged:
            lines.append("== %s ==" % nm)
            for x in ws:
                lines.append("   - %s" % x)
            lines.append("")
    with open(REPORT, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


def _is_probably_wrong(bouts, fh_rows, warns):
    """True when warnings point at a mis-identified athlete (not just thin history).
    Severe = ESPN name conflict, opponent conflict, or — when the fighter DOES have
    a history to compare against — most bouts failing to line up by date."""
    if any(w.startswith("[NAME?]") or w.startswith("[OPP?]") for w in warns):
        return True
    date_misses = sum(1 for w in warns if w.startswith("[DATE?]"))
    return bool(fh_rows) and bool(bouts) and date_misses >= max(2, (len(bouts) + 1) // 2)


def _confirm_add(nm, meta, bouts, warns):
    """Interactive y/N gate used by --strict. Defaults to NO (skip) on Enter/EOF."""
    print("\n" + "!" * 66)
    print("STRICT REVIEW — '%s' may be the WRONG athlete:" % nm)
    print("   ESPN id=%s   ESPN name=%s   exact-slug-match=%s"
          % (meta.get("sid"), meta.get("espn_name"), meta.get("exact")))
    for w in warns:
        print("   - %s" % w)
    preview = ", ".join("%s vs %s" % (b["date"], b["opponent"]) for b in bouts[:6])
    print("   ESPN bouts: %s%s" % (preview, " ..." if len(bouts) > 6 else ""))
    try:
        ans = input("   Add this fighter's stats anyway? [y/N] ").strip().lower()
    except EOFError:
        print("   (non-interactive input — skipping)")
        return False
    return ans in ("y", "yes")


def process_fighter(nm, data, namecache, fh, override=None, strict=False):
    """Fetch + validate one fighter; updates data[nm]; returns warning list.
    In strict mode, a likely wrong-athlete match must be confirmed before saving."""
    try:
        bouts, meta = backfill_one(nm, override, namecache)
    except Exception as e:
        print("  ! %s errored: %s" % (nm, e))
        return ["[ERROR] %s" % e]
    if bouts is None:
        return ["[SKIP] %s" % (meta.get("reason") or "unknown")]
    warns = validate(nm, meta, bouts, fh.get(nm, []))
    if strict and warns and _is_probably_wrong(bouts, fh.get(nm, []), warns):
        if not _confirm_add(nm, meta, bouts, warns):
            return warns + ["[NOT-ADDED] skipped by user in --strict (likely wrong fighter)"]
    data[nm] = bouts
    return warns


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("name", nargs="?")
    ap.add_argument("--espn-id")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--only-missing", action="store_true",
                    help="with --all, skip fighters already in fight-stats.json "
                         "(resumes a big run / adds new roster fighters without "
                         "re-requesting everyone). Note: won't pick up NEW fights "
                         "for already-saved fighters — re-run those by name, or a "
                         "plain --all, after an event.")
    ap.add_argument("--limit", type=int, default=0,
                    help="with --all, process at most N fighters (handy for a small "
                         "test batch you can review before the full run)")
    ap.add_argument("--strict", action="store_true",
                    help="pause and ask for confirmation before saving any fighter "
                         "whose bouts look mis-identified (ESPN name/opponent conflicts). "
                         "Declining (default on Enter) skips that fighter without saving.")
    ap.add_argument("--sleep", type=float, default=0.3)
    a = ap.parse_args()

    data = load_out()
    namecache = {}
    fh = parse_fight_history()
    report = []          # (name, [warnings])
    n_processed = 0

    if a.all:
        names = roster_names()
        total = len(names)
        if a.only_missing:
            names = [nm for nm in names if nm not in data]
            print("Backfilling %d of %d roster fighters (%d already saved, skipping)..."
                  % (len(names), total, total - len(names)))
        else:
            print("Backfilling %d roster fighters..." % total)
        if a.limit and a.limit > 0:
            names = names[:a.limit]
            print("(--limit) processing first %d only." % len(names))
        for i, nm in enumerate(names, 1):
            report.append((nm, process_fighter(nm, data, namecache, fh, strict=a.strict)))
            n_processed += 1
            if i % 10 == 0:  # checkpoint to disk periodically
                json.dump(data, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
            time.sleep(a.sleep)
    else:
        if not a.name:
            ap.error("provide a fighter name or --all")
        report.append((a.name, process_fighter(a.name, data, namecache, fh, a.espn_id, strict=a.strict)))
        n_processed += 1

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(data, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    n_bouts = sum(len(data.get(nm, [])) for nm, _ in report if isinstance(data.get(nm), list))
    print("Wrote %s (%d fighters total)." % (os.path.relpath(OUT, ROOT), len(data)))

    # ── validation summary ──
    flagged = [(nm, ws) for nm, ws in report if ws]
    if a.all:
        write_report(report, n_processed, n_bouts)
        print("Validation report: %s" % os.path.relpath(REPORT, ROOT))
    if flagged:
        print("\n!! %d fighter(s) flagged for review:" % len(flagged))
        for nm, ws in flagged:
            print("  %s" % nm)
            for x in ws:
                print("     - %s" % x)
    else:
        print("\nOK - no validation warnings.")


if __name__ == "__main__":
    main()
