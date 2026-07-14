#!/usr/bin/env python3
"""
recompute-card-stats.py — after a card finishes, recompute the 9 box-score
FIGHTER_STATS fields (slpm, strAcc, sapm, strDef, kd, tdLanded, tdAcc, tdDef,
subAvg) for the fighters who competed on it, from ESPN's full paginated bout
log (so the new fight is included), and patch ONLY the changed fields in
index.html.

Bio (ht/dob/reach/stance/gym) is left untouched — it's already filled and
doesn't change from a fight. finRate + streak are also left alone: they derive
from fight history, which the app live-merges from the results feed. Fight
history and odds history are handled separately/live, so this script is purely
the career-stat correction.

Selection (in priority order):
  * positional NAMES                        -> just those fighters
  * --event <slug>                          -> that event's fighters
  * (default / --recent) --within-days N    -> fighters on every COMPLETED event
      in data/event-recent.json whose start is within N days (default 3). This
      is what the daily workflow uses: it no-ops on days with no fresh card, and
      is idempotent (a second run finds nothing left to change).

Flags: --dry-run (print the diff, don't write), --within-days N, --bout-workers K.

Run daily from the odds workflow AFTER the ESPN results fetch.
"""
import argparse, importlib.util, json, os, re, sys, time, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
INDEX = os.path.join(ROOT, "index.html")
EVENT_RECENT = os.path.join(ROOT, "data", "event-recent.json")

# Reuse the tested aggregate/compute + ESPN helpers from recompute-veteran-stats
# (which itself loads espn-fighter-import for get_json/name_to_slug).
_sys_argv = sys.argv; sys.argv = ["recompute-card-stats"]
_spec = importlib.util.spec_from_file_location("rv", os.path.join(HERE, "recompute-veteran-stats.py"))
rv = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(rv)
sys.argv = _sys_argv

NUM = ["slpm", "sapm", "kd", "tdLanded", "subAvg"]
PCT = ["strAcc", "strDef", "tdAcc", "tdDef"]
UA = {"User-Agent": "Mozilla/5.0 (GillyLab recompute-card-stats)"}


def espn_find_id(name):
    """Fallback id resolution via ESPN search (for fighters not in the idmap)."""
    try:
        url = "https://site.web.api.espn.com/apis/search/v2?query=%s&limit=10" % name.replace(" ", "%20")
        r = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=25).read().decode("utf-8", "ignore")
    except Exception:
        return None
    pairs = re.findall(r"/mma/fighter/_/id/(\d+)/([a-z0-9-]+)", r)
    if not pairs:
        return None
    want = rv.imp.name_to_slug(name)
    for i, s in pairs:
        if s == want:
            return i
    return pairs[0][0]


def db_name_map():
    """slug -> canonical FIGHTERS name, and a FIGHTER_STATS-key set, from index.html."""
    h = open(INDEX, encoding="utf-8").read()
    slug2name = {}
    for m in re.finditer(r'\{ name: "([^"]+)", division:', h):
        nm = m.group(1)
        slug2name[rv.imp.name_to_slug(nm)] = nm
    stats_keys = set(re.findall(r'"([^"]+)": \{ ht:', h))
    return slug2name, stats_keys


def pick_fighters(args, slug2name):
    """Return a de-duped list of (dbName, fighterSlug) to recompute."""
    if args.names:
        return [(n, rv.imp.name_to_slug(n)) for n in args.names]
    try:
        ev = json.load(open(EVENT_RECENT, encoding="utf-8"))
    except Exception:
        return []
    events = ev.get("data") or []
    picked = []
    now = time.time()
    for e in events:
        if args.event:
            if e.get("slug") != args.event:
                continue
        else:
            if str(e.get("status", "")).lower() not in ("completed", "final"):
                continue
            sa = e.get("startsAt") or ""
            try:
                t = time.mktime(time.strptime(sa[:19], "%Y-%m-%dT%H:%M:%S"))
            except Exception:
                continue
            if (now - t) > args.within_days * 86400 or t > now:
                continue
        for b in (e.get("bouts") or []):
            for f in (b.get("fighters") or []):
                slug = f.get("fighterSlug") or rv.imp.name_to_slug(f.get("fighterName", ""))
                dbn = slug2name.get(slug) or f.get("fighterName")
                if dbn:
                    picked.append((dbn, slug))
    seen = set(); out = []
    for dbn, slug in picked:
        if dbn not in seen:
            seen.add(dbn); out.append((dbn, slug))
    return out


def apply_stats(name, st, h):
    """Patch only the 9 changed box-score fields for `name` in index.html text `h`.
    Returns (new_h, [ (field, old, new) ]) or (h, []) if nothing changed / not found."""
    m = re.search(r'("%s": \{)([^}]*)(\})' % re.escape(name), h)
    if not m:
        return h, None  # no FIGHTER_STATS entry (e.g. debut with none yet)
    inner = m.group(2); changes = []
    for k in NUM:
        new = st.get(k)
        if new is None:
            continue
        cm = re.search(r'\b%s:(null|-?[0-9.]+)' % k, inner)
        if not cm:
            continue
        cur = None if cm.group(1) == "null" else cm.group(1)
        if not rv_num_eq(cur, new):
            changes.append((k, cur, new))
            inner = inner[:cm.start()] + "%s:%s" % (k, new) + inner[cm.end():]
    for k in PCT:
        new = st.get(k)
        if new is None:
            continue
        cm = re.search(r'%s:(null|"[^"]*")' % k, inner)
        if not cm:
            continue
        cur = None if cm.group(1) == "null" else cm.group(1).strip('"')
        if cur != new:
            changes.append((k, cur, new))
            inner = inner[:cm.start()] + '%s:"%s"' % (k, new) + inner[cm.end():]
    if not changes:
        return h, []
    return h[:m.start(2)] + inner + h[m.end(2):], changes


def rv_num_eq(cur, new):
    if cur is None or new is None:
        return cur == new
    try:
        return abs(float(cur) - float(new)) < 1e-9
    except Exception:
        return str(cur) == str(new)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("names", nargs="*")
    ap.add_argument("--event")
    ap.add_argument("--recent", action="store_true")
    ap.add_argument("--within-days", type=float, default=3.0)
    ap.add_argument("--bout-workers", type=int, default=12)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    slug2name, stats_keys = db_name_map()
    idmap, slug2id = rv.build_idmap()
    fighters = pick_fighters(args, slug2name)
    if not fighters:
        print("no fighters selected (no fresh completed card within %g days)." % args.within_days)
        return

    print("recomputing stats for %d fighter(s):" % len(fighters))
    h = open(INDEX, encoding="utf-8").read()
    updated = fields = noid = nostats = unchanged = 0
    for dbn, slug in fighters:
        sid = slug2id.get(slug) or idmap.get(dbn) or espn_find_id(dbn)
        if not sid:
            print("  %-26s  (no ESPN id — skipped)" % dbn); noid += 1; continue
        try:
            st = rv.compute(rv.aggregate(str(sid), args.bout_workers))
        except Exception as e:
            print("  %-26s  (ESPN error: %s)" % (dbn, e)); continue
        newh, changes = apply_stats(dbn, st, h)
        if changes is None:
            print("  %-26s  (no FIGHTER_STATS entry — skipped)" % dbn); nostats += 1; continue
        if not changes:
            print("  %-26s  unchanged" % dbn); unchanged += 1; continue
        h = newh; updated += 1; fields += len(changes)
        print("  %-26s  %s" % (dbn, ", ".join("%s %s->%s" % (k, o, n) for k, o, n in changes)))

    if args.dry_run:
        print("\n[dry-run] would update %d fighter(s), %d field(s). No file written." % (updated, fields))
        return
    if updated:
        open(INDEX, "w", encoding="utf-8").write(h)
    print("\nupdated %d fighter(s), %d field(s) | unchanged %d | no-id %d | no-stats %d"
          % (updated, fields, unchanged, noid, nostats))


if __name__ == "__main__":
    main()
