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
import argparse, csv, importlib.util, json, os, re, sys, time, urllib.request

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


def load_aliases():
    """feed/ESPN slug -> DB FIGHTER_STATS key, parsed from index.html's SLUG_ALIASES
    so this stays in sync with the app (e.g. 'king-green' -> 'Bobby Green',
    'zach-reese' -> 'Zachary Reese') without a second hand-kept list."""
    try:
        h = open(INDEX, encoding="utf-8").read()
    except Exception:
        return {}
    m = re.search(r"const SLUG_ALIASES\s*=\s*\{([\s\S]*?)\n\s*\};", h)
    d = {}
    if m:
        for k, v in re.findall(r"'([^']+)'\s*:\s*'([^']+)'", m.group(1)):
            d[k] = v
    return d


ALIASES = load_aliases()

ESPN_ATHLETES = os.path.join(ROOT, "data", "espn-athletes.json")
IMPORT_MANIFEST = os.path.join(HERE, "espn-import-output", "_manifest.csv")


def card_idmap():
    """(slug -> ESPN id, normalised-name -> ESPN id) for resolving fighters.

    Sourced from data/espn-athletes.json — the athlete cache fetch-espn-events.cjs
    fills as it walks the event feed. Every fighter on any card the feed knows about
    is in it BY CONSTRUCTION, because the entry is written while that fighter's own
    bout is parsed; and unlike the import corpus, it is COMMITTED. Measured
    2026-07-19: 24/24 of both the finished and the upcoming card resolved by slug.

    This replaces rv.build_idmap(), which could not work from either side:
      * scripts/espn-import-output/ is gitignored with zero files tracked, so on a CI
        runner it does not exist. rv.build_idmap() opens its _manifest.csv WITHOUT a
        guard, so the call raised FileNotFoundError and killed this script before it
        looked at a single fighter — silently, because the workflow step ended in
        `|| true`. That is why the daily job never once patched a stat.
      * On a Mac it fails the other way: those 4,646 files sit in iCloud, so globbing
        and json.load-ing every one blocks on a download apiece and the script looks
        frozen (observed stuck on an unrelated retired fighter's file).

    Match order is slug first (the feed and the cache both carry ESPN's own slug, so
    aliases like king-green resolve without help), then name_to_slug-normalised name,
    which folds away accents and middle names — Jan Błachowicz -> jan-blachowicz,
    Jose Miguel Delgado -> jose-miguel-delgado. espn_find_id() remains the last
    resort for anyone genuinely new.

    The manifest is still read WHEN PRESENT — one small file, no directory glob — so
    a local run keeps any extra ids it holds. It is never required.
    """
    slug2id, norm2id = {}, {}
    try:
        athletes = (json.load(open(ESPN_ATHLETES, encoding="utf-8")) or {}).get("athletes") or {}
    except Exception as e:
        athletes = {}
        print("  ! %s unreadable (%s) — falling back to ESPN search" % (os.path.basename(ESPN_ATHLETES), e))
    for eid, a in athletes.items():
        if not str(eid).isdigit() or not isinstance(a, dict):
            continue
        if a.get("slug"):
            slug2id.setdefault(a["slug"], str(eid))
        if a.get("name"):
            norm2id.setdefault(rv.imp.name_to_slug(a["name"]), str(eid))
    try:
        with open(IMPORT_MANIFEST, encoding="utf-8") as fh:
            for r in csv.DictReader(fh):
                if str(r.get("espn_id", "")).isdigit() and r.get("slug"):
                    slug2id.setdefault(r["slug"], r["espn_id"])
    except Exception:
        pass   # local-only supplement; absent on CI by design
    return slug2id, norm2id


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
    stats_keys = set(re.findall(r'"([^"]+)":\s*\{\s*ht:', h))   # tolerate spacing — see apply_stats
    return slug2name, stats_keys


def resolve_db_name(slug, slug2name, feed_name):
    """feed slug -> the FIGHTER_STATS key: alias first, then the roster's slug map,
    else the feed name."""
    return ALIASES.get(slug) or slug2name.get(slug) or feed_name


def pick_fighters(args, slug2name):
    """Return a de-duped list of (dbName, fighterSlug, feedName) to recompute.
    feedName is kept so ESPN id resolution can search under the name ESPN uses
    (e.g. "King Green"), even when the DB key is the alias ("Bobby Green")."""
    if args.names:
        out = []
        for n in args.names:
            slug = rv.imp.name_to_slug(n)
            out.append((resolve_db_name(slug, slug2name, n), slug, n))
        return out
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
                feed = f.get("fighterName", "")
                slug = f.get("fighterSlug") or rv.imp.name_to_slug(feed)
                dbn = resolve_db_name(slug, slug2name, feed)
                if dbn:
                    picked.append((dbn, slug, feed))
    seen = set(); out = []
    for dbn, slug, feed in picked:
        if dbn not in seen:
            seen.add(dbn); out.append((dbn, slug, feed))
    return out


def apply_stats(name, st, h):
    """Patch only the 9 changed box-score fields for `name` in index.html text `h`.
    Returns (new_h, [ (field, old, new) ]) or (h, []) if nothing changed / not found."""
    # ":\s*\{" — NOT ": \{". index.html is hand-edited, and 3 of its ~3,105 entries
    # are written '"Name":{ ht:' with no space after the colon (Christian Leroy Duncan,
    # Bruno Gustavo da Silva, Adrián Luna Martinetti). Hardcoding the space made those
    # three report "no FIGHTER_STATS entry" — a false negative indistinguishable from a
    # genuine debut, so they silently never got a stat update.
    m = re.search(r'("%s":\s*\{)([^}]*)(\})' % re.escape(name), h)
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
    slug2id, norm2id = card_idmap()
    fighters = pick_fighters(args, slug2name)
    if not fighters:
        print("no fighters selected (no fresh completed card within %g days)." % args.within_days)
        return

    print("recomputing stats for %d fighter(s):" % len(fighters))
    h = open(INDEX, encoding="utf-8").read()
    updated = fields = noid = nostats = unchanged = 0
    for dbn, slug, feed in fighters:
        # Slug first (feed and cache share ESPN's slug), then the accent/middle-name
        # -insensitive normalised name, then the network search as a last resort.
        sid = (slug2id.get(slug)
               or norm2id.get(slug)
               or norm2id.get(rv.imp.name_to_slug(dbn))
               or norm2id.get(rv.imp.name_to_slug(feed))
               or espn_find_id(feed) or espn_find_id(dbn))
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
