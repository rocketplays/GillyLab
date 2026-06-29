#!/usr/bin/env python3
"""
PROTOTYPE — bulk-import ex-UFC fighters from ESPN into the GillyLab database.

Goal: for any fighter who has >=1 UFC fight and is NOT already in the roster
(released/retired fighters), gather from ESPN:
  - photo (headshot) -> photos/<slug>.png + thumb
  - bio (ht, dob, reach, stance, gym, country, division)
  - full statistics, COMPUTED from per-fight stat tables:
       offensive (own table):  slpm, strAcc, kd, tdLanded, tdAcc, subAvg
       defensive (opponent's table for each bout): sapm, strDef, tdDef
  - full fight history (record + win streak derived)
NO odds history, NO accolades (by design — those need BFO / ufc.com Q&A).

This prototype does NOT edit index.html. For each fighter it writes a paste-ready
snippet to scripts/espn-import-output/<slug>.js and a <slug>.json, downloads the
photo, and prints a summary so the output can be reviewed before insertion.

Usage:
  # process one fighter (by ESPN id or by name search):
  python3 scripts/espn-fighter-import.py --espn-id 2335639
  python3 scripts/espn-fighter-import.py --name "Mark Hunt"

  # build the candidate list of ex-UFC fighters not in the roster:
  python3 scripts/espn-fighter-import.py --discover --limit 50

  # bulk-import every ex-UFC fighter not in the roster (resume + manifest):
  python3 scripts/espn-fighter-import.py --process-all --min-coverage 0.6

  # VERIFY an existing roster fighter (diff DB vs ESPN; no writes):
  python3 scripts/espn-fighter-import.py --verify "Cub Swanson"

Run from the repo root. ESPN's core API (JSON) + the HTML stats/history pages
are the sources; both are already proven to work in fighter-lookup.py.
"""
import argparse, json, os, re, subprocess, sys, time, unicodedata, urllib.request
from datetime import datetime
from html import unescape

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0 Safari/537.36"
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
INDEX = os.path.join(ROOT, "index.html")
PHOTOS = os.path.join(ROOT, "photos")
OUTDIR = os.path.join(HERE, "espn-import-output")

CORE = "https://sports.core.api.espn.com/v2/sports/mma"

# --verify policy: ESPN is authoritative for these four; the rest keep the
# existing DB (ufc.com/UFCStats) value, since ESPN reads systematically low on
# takedowns landed and knockdown avg and the DB figures are more accurate there.
VERIFY_FIELDS = ["strAcc", "sapm", "kd", "tdAcc"]
KEEP_FIELDS   = ["slpm", "strDef", "tdLanded", "tdDef", "subAvg"]

DIV_MAP = {
    "Flyweight": "FLW", "Bantamweight": "BW", "Featherweight": "FW",
    "Lightweight": "LW", "Welterweight": "WW", "Middleweight": "MW",
    "Light Heavyweight": "LHW", "Heavyweight": "HW",
    "Women's Strawweight": "WSW", "Women's Flyweight": "WFLW",
    "Women's Bantamweight": "WBW", "Women's Featherweight": "WFW",
}

# ---------------- fetch helpers ----------------
def curl(url):
    r = subprocess.run(["curl", "-s", "--max-time", "60", "-L", "-A", UA, url],
                       capture_output=True, text=True)
    return r.stdout

def get_json(url, tries=3):
    """Retry on transient empty/error responses — matters over a long bulk run."""
    for n in range(tries):
        try:
            return json.loads(curl(url))
        except Exception:
            time.sleep(1.5 * (n + 1))
    return None

def get_html(url, tries=3):
    """ESPN's www pages serve empty to curl and reject long UA strings; the
    short 'Mozilla/5.0' UA over urllib is what works (same as fighter-lookup.py).
    Retries because a transient empty here would silently blank a fighter's stats."""
    for n in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            t = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "ignore")
            if t:
                return t
        except Exception:
            pass
        time.sleep(1.5 * (n + 1))
    return ""

def espn_stated_record(sid):
    """ESPN's own W-L-D for cross-checking the history-derived record (tripwire
    for a missed or extra fight). Returns e.g. '26-2-0' or None."""
    d = get_json("%s/athletes/%s/records?lang=en&region=us" % (CORE, sid))
    if not d:
        return None
    items = d.get("items", [])
    for it in items:
        if it.get("type") == "total" or it.get("name", "").lower() in ("overall", "total"):
            return (it.get("summary") or it.get("displayValue") or "").strip() or None
    return ((items[0].get("summary") if items else None) or None)

# ---------------- slug (must mirror index.html nameToSlug) ----------------
SUFFIX_RE = re.compile(r"\s+(jr\.?|sr\.?|i{1,3}|iv|v)\s*$", re.I)
LETTER_MAP = {"ł": "l", "Ł": "l", "ø": "o", "Ø": "o", "æ": "ae", "Æ": "ae",
              "œ": "oe", "Œ": "oe", "ß": "ss", "ı": "i", "İ": "i", "đ": "d", "Đ": "d"}

def name_to_slug(name):
    s = SUFFIX_RE.sub("", name)
    s = "".join(LETTER_MAP.get(c, c) for c in s)
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower().replace("'", "").replace("’", "")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")

# ---------------- roster (dedup target) ----------------
def roster_slugs():
    html = open(INDEX, encoding="utf-8").read()
    i = html.index("const FIGHTERS = [")
    depth = 0
    for j in range(i + len("const FIGHTERS = "), len(html)):
        if html[j] == "[": depth += 1
        elif html[j] == "]":
            depth -= 1
            if depth == 0:
                block = html[i:j + 1]; break
    names = re.findall(r'name:\s*"([^"]+)"', block)
    return {name_to_slug(n) for n in names}, set(names)

# ---------------- LOCAL (index.html) parsing for --verify ----------------
def _const_block(html, const):
    i = html.index("const %s = " % const)
    k = i + len("const %s = " % const)
    while html[k] not in "[{": k += 1
    oc = html[k]; cc = "]" if oc == "[" else "}"
    depth = 0
    for j in range(k, len(html)):
        if html[j] == oc: depth += 1
        elif html[j] == cc:
            depth -= 1
            if depth == 0: return html[k:j + 1]
    return ""

def _fighter_array(block, name):
    """Extract the [...] that follows  "Name":  inside a const block."""
    key = '"%s":' % name
    i = block.find(key)
    if i == -1: return ""
    k = block.find("[", i)
    if k == -1: return ""
    depth = 0
    for j in range(k, len(block)):
        if block[j] == "[": depth += 1
        elif block[j] == "]":
            depth -= 1
            if depth == 0: return block[k:j + 1]
    return ""

def local_fighter(name):
    html = open(INDEX, encoding="utf-8").read()
    out = {"record": None, "stats": {}, "history": []}
    m = re.search(r'name:\s*"%s".*?record:\s*"([\d-]+)"' % re.escape(name), html)
    if m: out["record"] = m.group(1)
    # stats object
    sblock = _const_block(html, "FIGHTER_STATS")
    sm = re.search(r'"%s":\s*\{(.*?)\}' % re.escape(name), sblock, re.S)
    if sm:
        for k, v in re.findall(r'(\w+)\s*:\s*("(?:\\.|[^"\\])*"|\'[^\']*\'|null|[\d.]+)', sm.group(1)):
            if v.startswith('"'):
                val = v[1:-1].replace('\\"', '"').replace("\\\\", "\\")
            elif v.startswith("'"):
                val = v[1:-1]
            else:
                val = v
            out["stats"][k] = val
    # fight history array
    hblock = _const_block(html, "FIGHT_HISTORY")
    arr = _fighter_array(hblock, name)
    for row in re.findall(r"\{(.*?)\}", arr, re.S):
        d = {}
        for k, v in re.findall(r'(\w+)\s*:\s*("[^"]*"|\d+)', row):
            d[k] = v.strip('"')
        if d.get("date"): out["history"].append(d)
    return out

# ---------------- verify (diff LOCAL vs ESPN) ----------------
def verify(sid):
    bio = get_json("%s/athletes/%s" % (CORE, sid))
    if not bio:
        print("could not fetch ESPN bio for", sid); return
    name = bio.get("displayName") or bio.get("fullName")
    loc = local_fighter(name)
    if not loc["history"] and not loc["stats"]:
        print("!! '%s' not found in index.html (exact-name match). Check spelling." % name); return

    espn_hist = parse_history(sid)
    stated = espn_stated_record(sid)
    derived = None
    w = sum(1 for f in espn_hist if result_letter(f["result"]) == "W")
    l = sum(1 for f in espn_hist if result_letter(f["result"]) == "L")
    dr = sum(1 for f in espn_hist if result_letter(f["result"]) == "D")
    derived = "%d-%d-%d" % (w, l, dr)

    print("=== VERIFY: %s (ESPN %s) ===" % (name, sid))
    rec_flag = "OK" if loc["record"] in (stated, derived) else "!! CHECK"
    print("record   : DB %s | ESPN-stated %s | ESPN-derived %s   %s"
          % (loc["record"], stated, derived, rec_flag))

    # ---- bio diff (ESPN-verify ht/dob/reach/stance; gym informational) ----
    ebio = {"ht": norm_ht(bio.get("displayHeight")), "dob": (bio.get("dateOfBirth") or "")[:10] or None,
            "reach": norm_reach(bio.get("displayReach")), "stance": (bio.get("stance") or {}).get("text"),
            "gym": (bio.get("association") or {}).get("name")}
    bio_lines = []
    for k in ["ht", "dob", "reach", "stance"]:
        dv = loc["stats"].get(k, "—"); ev = ebio.get(k)
        if ev and str(dv) != str(ev):
            bio_lines.append("    %-7s DB %-9s ESPN %-9s  <- CHECK" % (k, dv, ev))
    gdv = loc["stats"].get("gym", "—")
    if ebio.get("gym") and str(gdv) != str(ebio["gym"]):
        bio_lines.append("    %-7s DB %-22s ESPN %-22s  (gym often differs — keep DB)" % ("gym", gdv, ebio["gym"]))
    if bio_lines:
        print("bio      :"); [print(x) for x in bio_lines]
    else:
        print("bio      : ht/dob/reach/stance match ESPN")

    # ---- fight history diff: match by opponent slug, then by date for the
    # remainder (so a name-spelling variant on the same date is reported as a
    # spelling diff, not a phantom missing+extra pair) ----
    print("history  : DB %d fights | ESPN %d fights" % (len(loc["history"]), len(espn_hist)))
    matched, namediffs = [], []
    esp_by_slug = {}
    for f in espn_hist:
        esp_by_slug.setdefault(name_to_slug(f.get("opponent", "")), []).append(f)
    rem_loc = []
    for lf in loc["history"]:
        s = name_to_slug(lf.get("opponent", ""))
        if esp_by_slug.get(s):
            matched.append((lf, esp_by_slug[s].pop(0)))
        else:
            rem_loc.append(lf)
    rem_esp = [f for v in esp_by_slug.values() for f in v]
    esp_by_date = {}
    for f in rem_esp:
        esp_by_date.setdefault(f.get("date", ""), []).append(f)
    extra = []
    for lf in rem_loc:
        bucket = esp_by_date.get(lf.get("date", ""))
        if bucket:
            namediffs.append((lf, bucket.pop(0)))
        else:
            extra.append(lf)
    missing = [f for v in esp_by_date.values() for f in v]

    if missing:
        print("  MISSING from DB (on ESPN — possible omission):")
        for f in missing: print("     +", f["date"], f["opponent"], f["result"], f["method"])
    if extra:
        print("  IN DB but NOT on ESPN (verify / possible fabrication):")
        for f in extra: print("     -", f.get("date"), f.get("opponent"), f.get("result"), f.get("method"))
    if namediffs:
        print("  opponent NAME differs (same date — likely just spelling):")
        for a, b in namediffs: print("     ~ %s: DB '%s' / ESPN '%s'" % (a.get("date"), a.get("opponent"), b["opponent"]))
    fdiffs = []
    for a, b in matched:
        al, bl = result_letter(a.get("result", "")), result_letter(b.get("result", ""))
        if al != bl:
            fdiffs.append("%s %s: result DB %s / ESPN %s" % (a.get("date"), a.get("opponent"), al, bl))
        am, bm = meth_cat(a.get("method", "")), meth_cat(b.get("method", ""))
        if am and bm and am != bm:
            fdiffs.append("%s %s: method DB %s / ESPN %s" % (a.get("date"), a.get("opponent"), a.get("method"), b.get("method")))
        if a.get("round") and b.get("round") and str(a["round"]) != re.sub(r"\D", "", b["round"]):
            fdiffs.append("%s %s: round DB %s / ESPN %s" % (a.get("date"), a.get("opponent"), a["round"], b["round"]))
    if fdiffs:
        print("  FIELD diffs on matched fights:")
        for x in fdiffs: print("     ~", x)
    if not (missing or extra or namediffs or fdiffs):
        print("  fight history: matches ESPN")

    # ---- stats side-by-side, split by the verify policy ----
    # POLICY: ESPN verifies these four; the rest keep the DB (ufc.com) value
    # because ESPN reads systematically low on takedowns/knockdowns and the
    # DB values there are the more accurate UFCStats figures.
    roster, _ = roster_slugs()
    r = process(sid, roster_minus(roster, name), verbose=False, write=False, fetch_photo=False)
    if r and r.get("fighter_stats"):
        es = r["fighter_stats"]
        print("stats    : policy = ESPN-verify {strAcc, sapm, kd, tdAcc}; keep DB {slpm, strDef, tdLanded, tdDef, subAvg}")
        print("  --- ESPN-verify (apply these) ---")
        for k in VERIFY_FIELDS:
            dv = loc["stats"].get(k, "—"); ev = es.get(k)
            if dv == "—":            note = "  <- FILL from ESPN"
            elif str(dv) != str(ev): note = "  <- UPDATE to ESPN"
            else:                    note = "  ok"
            print("    %-9s DB %-7s ESPN %-7s%s" % (k, dv, ev, note))
        print("  --- keep DB (informational only, do NOT change) ---")
        for k in KEEP_FIELDS:
            dv = loc["stats"].get(k, "—"); ev = es.get(k)
            print("    %-9s DB %-7s ESPN %-7s  (keep DB)" % (k, dv, ev))
        print("  (opponent-data coverage %.0f%% — low coverage = noisier ESPN defensive stats)"
              % (100 * r.get("coverage", 0)))

def roster_minus(roster, name):
    """roster set without this fighter, so process() won't skip them as in-roster."""
    return roster - {name_to_slug(name)}

def meth_cat(m):
    """Coarse finish category so 'Submission (RNC)' vs 'Submission' don't false-flag;
    only a real category mismatch (e.g. DB Decision vs ESPN KO) is reported.
    KO/TKO is checked before submission so 'TKO (submission to punches)' -> KO."""
    m = (m or "").lower()
    if "decision" in m: return "DEC"
    if "no contest" in m or m.strip() in ("nc", "n/c"): return "NC"
    if "draw" in m: return "DRAW"
    if "tko" in m or "knockout" in m or re.search(r"\bko\b", m): return "KO"
    if "submission" in m or "choke" in m or "tap" in m: return "SUB"
    return ""

# ---------------- per-fight stat tables (HTML) ----------------
DATE_RE = re.compile(r"^[A-Z][a-z]{2} \d{1,2}, \d{4}$")

def parse_stat_tables(sid):
    """Return {date: {ssl,ssa,kd,tdl,tda,sm}} from the fighter's own stats page.
    Striking row idx: 0 date,1 opp,2 event,3 res, 9 SSL,10 SSA,12 KD
    Clinch   row idx: 12 TDL,13 TDA, 15 TK ACC%
    Ground   row idx: 15 SM
    """
    html = get_html("https://www.espn.com/mma/fighter/stats/_/id/%s" % sid)
    if not html:
        return {}
    txt = re.sub(r"\|+", "|", unescape(re.sub(r"<[^>]+>", "|", html)))
    out = {}

    # The page has 3 tables in order: striking (ends col %LEG), clinch (ends col
    # TK ACC), ground (ends col SM). Each repeats one row per fight keyed by date.
    # Must bound each table to its own segment, else later tables' rows (same
    # dates) clobber earlier columns. Segment by the NEXT table's first header col.
    def seg(start_tok, end_tok):
        i = txt.find(start_tok)
        if i == -1: return ""
        j = txt.find(end_tok, i + len(start_tok))
        return txt[i: j if j != -1 else len(txt)]

    def rows(segment, n):
        toks = [x.strip() for x in segment.split("|") if x.strip() != ""]
        return [toks[k:k + n] for k, tk in enumerate(toks) if DATE_RE.match(tk)]

    # striking: date,opp,event,res, SDBL/A,SDHL/A,SDLL/A, TSL,TSA, SSL(9),SSA(10), TSL-TSA, KD(12), %BODY,%HEAD,%LEG
    for row in rows(seg("%LEG", "SCBL"), 16):
        if len(row) < 13: continue
        try: ssl, ssa, kd = int(row[9]), int(row[10]), int(row[12])
        except (ValueError, IndexError): continue
        out.setdefault(row[0], {}).update(ssl=ssl, ssa=ssa, kd=kd, opp=row[1], _date=row[0])
    # clinch: ...TDL(12),TDA(13),TDS, TK ACC(15)
    for row in rows(seg("TK ACC", "SGBL"), 16):
        if len(row) < 14: continue
        try: tdl, tda = int(row[12]), int(row[13])
        except (ValueError, IndexError): continue
        out.setdefault(row[0], {}).update(tdl=tdl, tda=tda)
    # ground: ...SM(15)
    for row in rows(seg("SGBL", "Glossary"), 16):
        if len(row) < 16: continue
        try: sm = int(row[15])
        except (ValueError, IndexError): continue
        out.setdefault(row[0], {}).update(sm=sm)
    return out

# ---------------- fight history (HTML, gives opponent ids + method/round/time) ----------------
def parse_history(sid):
    html = get_html("https://www.espn.com/mma/fighter/history/_/id/%s" % sid)
    fights = []
    if not html:
        return fights
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", html, re.S):
        if "fightcenter" not in tr and "/mma/fighter/_/id/" not in tr:
            continue
        m = re.search(r"/mma/fighter/_/id/(\d+)/([a-z0-9-]+)", tr)
        oppid = m.group(1) if m else None
        cells = [unescape(re.sub(r"<[^>]+>", "", td)).strip()
                 for td in re.findall(r"<td[^>]*>(.*?)</td>", tr, re.S)]
        cells = [c for c in cells if c != ""]
        if not cells or not DATE_RE.match(cells[0]):
            continue
        # cells: Date, Opponent, Res, Method, Rnd, Time, Event
        try:
            date, opp, res, method, rnd, tm, event = cells[:7]
        except ValueError:
            continue
        fights.append(dict(date=date, oppid=oppid, opponent=opp, result=res,
                           method=method, round=rnd, time=tm, event=event))
    return fights

# ---------------- helpers ----------------
def dur_seconds(rnd, tm):
    try:
        r = int(re.sub(r"\D", "", rnd) or 0)
        mm, ss = (tm.split(":") + ["0"])[:2]
        return (r - 1) * 300 + int(mm) * 60 + int(ss)
    except Exception:
        return 0

def norm_method(m):
    m = m.strip()
    if m.lower().startswith("ko"):  return "KO/TKO"
    if "TKO" in m:                  return "TKO"
    if m.lower().startswith("submission") or m.lower().startswith("technical sub"):
        return m
    if "Decision" in m or "Unanimous" in m or "Split" in m or "Majority" in m:
        # normalise "Unanimous Decision" -> "Decision (Unanimous)"
        for t in ("Unanimous", "Split", "Majority"):
            if t in m: return "Decision (%s)" % t
        return "Decision"
    return m or "—"

def result_letter(res):
    r = res.strip().upper()
    return "W" if r.startswith("W") else "L" if r.startswith("L") else "D" if r.startswith("D") else res

def is_ufc_event(ev):
    e = ev.lower()
    return e.startswith("ufc") or "ultimate fighting" in e or "contender series" in e or "dana white" in e

def initials(name):
    parts = [p for p in re.split(r"\s+", name) if p]
    if len(parts) == 1: return parts[0][:2].upper()
    return (parts[0][0] + parts[-1][0]).upper()

def norm_ht(h):
    # ESPN: "6' 0\"" -> site style "6'0\"" (display-only field; cosmetic match)
    return h.replace(" ", "") if h else h

def norm_reach(r):
    # ESPN: "75\"" -> keep value; quote-style handled in js_stats
    return r.strip() if r else r

# ---------------- main per-fighter processing ----------------
def process(sid, roster, verbose=True, min_coverage=0.0, write=True, fetch_photo=True):
    bio = get_json("%s/athletes/%s" % (CORE, sid))
    if not bio:
        if verbose: print("  !! could not fetch bio for id", sid)
        return {"status": "no_bio", "espn_id": sid}
    name = bio.get("displayName") or bio.get("fullName")
    slug = name_to_slug(name)
    if slug in roster:
        if verbose: print("  -- %s already in roster, skipping" % name)
        return {"status": "in_roster", "espn_id": sid, "name": name, "slug": slug}

    hist = parse_history(sid)
    ufc_fights = [f for f in hist if is_ufc_event(f["event"])]
    if not ufc_fights:
        if verbose: print("  -- %s has 0 UFC fights on ESPN, skipping" % name)
        return {"status": "no_ufc", "espn_id": sid, "name": name, "slug": slug}

    own = parse_stat_tables(sid)

    # ufc.com career stats are computed over UFC-promotion fights only, so we
    # restrict the aggregation to UFC dates (the full history still goes into
    # FIGHT_HISTORY). Mixing in WEC/Strikeforce/regional bouts inflates the
    # minute denominator and drags every per-minute stat low.
    ufc_dates = {f["date"] for f in ufc_fights}

    # ---- offensive aggregates over UFC fights that have a stats row ----
    SSL = SSA = KD = TDL = TDA = SM = 0
    sec = 0
    dur_by_date = {f["date"]: dur_seconds(f["round"], f["time"]) for f in hist}
    statted_dates = []
    for d, s in own.items():
        if "ssl" not in s or d not in ufc_dates:  # UFC fights with a striking row
            continue
        statted_dates.append(d)
        SSL += s.get("ssl", 0); SSA += s.get("ssa", 0); KD += s.get("kd", 0)
        TDL += s.get("tdl", 0); TDA += s.get("tda", 0); SM += s.get("sm", 0)
        sec += dur_by_date.get(d, 0)
    minutes = sec / 60.0 if sec else 0

    # ---- defensive aggregates via opponent tables (strikes absorbed / defense) ----
    oSSL = oSSA = oTDL = oTDA = 0
    def_sec = 0
    opp_cache = {}
    oppid_by_date = {f["date"]: f["oppid"] for f in hist}
    def_fights = 0
    for d in statted_dates:
        oid = oppid_by_date.get(d)
        if not oid:
            continue
        if oid not in opp_cache:
            opp_cache[oid] = parse_stat_tables(oid)
            time.sleep(0.3)
        # In the opponent's table find the row whose opponent is THIS fighter.
        # Match by name (robust to the day-apart date discrepancy across pages),
        # preferring the same date when a pair met more than once.
        cand = [r for r in opp_cache[oid].values()
                if "ssl" in r and name_to_slug(r.get("opp", "")) == slug]
        orow = next((r for r in cand if r.get("_date") == d), cand[0] if cand else None)
        if not orow:
            continue
        def_fights += 1
        def_sec += dur_by_date.get(d, 0)
        oSSL += orow.get("ssl", 0); oSSA += orow.get("ssa", 0)
        oTDL += orow.get("tdl", 0); oTDA += orow.get("tda", 0)
    def_minutes = def_sec / 60.0 if def_sec else 0

    def per15(x): return round(x / minutes * 15, 2) if minutes else None
    def permin(x): return round(x / minutes, 2) if minutes else None
    def pct(num, den): return ("%d%%" % round(100 * num / den)) if den else None

    stats = {
        "ht":   norm_ht(bio.get("displayHeight")),
        "dob":  (bio.get("dateOfBirth") or "")[:10] or None,
        "reach": norm_reach(bio.get("displayReach")),
        "stance": (bio.get("stance") or {}).get("text"),
        "slpm": permin(SSL),
        "strAcc": pct(SSL, SSA),
        "sapm": (round(oSSL / def_minutes, 2) if def_minutes else None) if def_fights else None,
        "strDef": pct(oSSA - oSSL, oSSA) if def_fights and oSSA else None,
        "kd":   per15(KD),
        "tdLanded": per15(TDL),
        "tdAcc": pct(TDL, TDA),
        "tdDef": pct(oTDA - oTDL, oTDA) if def_fights and oTDA else None,
        "subAvg": per15(SM),
        "gym": (bio.get("association") or {}).get("name"),
    }

    # ---- record / streak / finRate from full history ----
    fh = []
    wins = ko = sub = 0
    for f in hist:
        rl = result_letter(f["result"])
        meth = norm_method(f["method"])
        fh.append(dict(date=f["date"], opponent=f["opponent"], result=rl,
                       method=meth, round=re.sub(r"\D", "", f["round"]) or "",
                       time=f["time"], event=f["event"],
                       org=("UFC" if is_ufc_event(f["event"]) else None)))
        if rl == "W":
            wins += 1
            if "KO" in meth or "TKO" in meth: ko += 1
            elif meth.lower().startswith("submission") or "submission" in meth.lower(): sub += 1
    losses = sum(1 for f in fh if f["result"] == "L")
    draws = sum(1 for f in fh if f["result"] == "D")
    record = "%d-%d-%d" % (wins, losses, draws)
    streak = 0
    for f in fh:  # history is newest-first
        if f["result"] == "W": streak += 1
        else: break
    fin = "%d%%" % round(100 * (ko + sub) / wins) if wins else None
    stats["finRate"] = fin
    stats["streak"] = streak

    division = DIV_MAP.get((bio.get("weightClass") or {}).get("text"), "?")
    roster_row = dict(name=name, division=division, rank="NR", record=record,
                      initials=initials(name), country=bio.get("citizenship") or "")

    # ---- photo ----
    photo_status = "no headshot on ESPN"
    hs = (bio.get("headshot") or {}).get("href")
    if hs and fetch_photo:
        os.makedirs(PHOTOS, exist_ok=True)
        dest = os.path.join(PHOTOS, slug + ".png")
        subprocess.run(["curl", "-s", "--max-time", "60", "-L", "-A", UA, "-o", dest, hs])
        sz = os.path.getsize(dest) if os.path.exists(dest) else 0
        if sz < 3000:  # silhouette/placeholder guard
            if os.path.exists(dest): os.remove(dest)
            photo_status = "placeholder/too-small, skipped (%d bytes)" % sz
        else:
            photo_status = "saved photos/%s.png (%d bytes)" % (slug, sz)

    # tripwire: does the history-derived record match ESPN's stated record?
    # a mismatch means a fight is missing/extra/misread in the parsed history.
    stated = espn_stated_record(sid)
    record_check = "ok" if (not stated or stated == record) else ("MISMATCH derived %s vs ESPN %s" % (record, stated))

    coverage = round(def_fights / len(statted_dates), 2) if statted_dates else 0.0
    if not statted_dates:
        status = "no_stats"          # has UFC fights but no per-fight stat tables
    elif coverage < min_coverage:
        status = "low_coverage"      # defensive stats (sapm/strDef/tdDef) thin
    else:
        status = "ok"

    result = dict(status=status, name=name, slug=slug, espn_id=sid,
                  roster_row=roster_row, fighter_stats=stats, fight_history=fh,
                  stat_fights=len(statted_dates), def_fights=def_fights,
                  coverage=coverage, ufc_fights=len(ufc_fights), photo=photo_status,
                  record_check=record_check)

    # ---- write paste-ready output ----
    if write:
        os.makedirs(OUTDIR, exist_ok=True)
        write_snippet(result)
        json.dump(result, open(os.path.join(OUTDIR, slug + ".json"), "w"), indent=2)

    if verbose:
        print_summary(result)
    return result

# ---------------- output formatting ----------------
def js_stats(s):
    order = ["ht","dob","reach","stance","slpm","strAcc","sapm","strDef","kd",
             "tdLanded","tdAcc","tdDef","subAvg","finRate","streak","gym"]
    parts = []
    for k in order:
        v = s.get(k)
        if v is None: parts.append("%s:null" % k)
        elif k == "reach" and isinstance(v, str):
            parts.append("%s:'%s'" % (k, v))          # site style: reach:'76"'
        elif isinstance(v, str): parts.append('%s:"%s"' % (k, v.replace('"', '\\"')))
        else: parts.append("%s:%s" % (k, v))
    return "{ " + ", ".join(parts) + " }"

def js_history(fh):
    lines = []
    for f in fh:
        org = ', org: "UFC"' if f["org"] else ""
        lines.append('    { date: "%s", opponent: "%s", result: "%s", method: "%s", round: %s, time: "%s", event: "%s"%s },'
                     % (f["date"], f["opponent"].replace('"', ""), f["result"], f["method"],
                        f["round"] or "0", f["time"], f["event"].replace('"', ""), org))
    return "\n".join(lines)

def write_snippet(r):
    rr = r["roster_row"]
    out = []
    out.append("// ---- FIGHTERS roster row ----")
    out.append(' { name: "%s", division: "%s", rank: "NR", record: "%s", initials: "%s", country: "%s" },'
               % (rr["name"], rr["division"], rr["record"], rr["initials"], rr["country"]))
    out.append("\n// ---- FIGHTER_STATS ----")
    out.append('  "%s": %s,' % (r["name"], js_stats(r["fighter_stats"])))
    out.append("\n// ---- FIGHT_HISTORY ----")
    out.append('  "%s": [' % r["name"])
    out.append(js_history(r["fight_history"]))
    out.append("  ],")
    open(os.path.join(OUTDIR, r["slug"] + ".js"), "w").write("\n".join(out) + "\n")

def print_summary(r):
    s = r["fighter_stats"]
    print("  name     :", r["name"], "(ESPN", r["espn_id"], "->", r["slug"] + ")")
    print("  roster   :", r["roster_row"]["division"], r["roster_row"]["record"],
          r["roster_row"]["country"] or "(country MISSING on ESPN — needs manual fill)")
    print("  stats    :", js_stats(s))
    print("  status   :", r["status"], "(opponent-data coverage %.0f%%)" % (100 * r["coverage"]))
    print("  record   :", r["roster_row"]["record"],
          "" if r["record_check"] == "ok" else "  !! " + r["record_check"])
    print("  sample   : %d fights with stats, %d with opponent-data (for sapm/strDef/tdDef)"
          % (r["stat_fights"], r["def_fights"]))
    print("  history  : %d fights (UFC: %d)" % (len(r["fight_history"]), r["ufc_fights"]))
    print("  photo    :", r["photo"])
    print("  output   : scripts/espn-import-output/%s.js (+ .json)" % r["slug"])

# ---------------- discover ----------------
def all_ufc_ids():
    """Every athlete id in ESPN's UFC league index (paginated)."""
    ids, page = [], 1
    while True:
        d = get_json("%s/leagues/ufc/athletes?limit=1000&page=%d" % (CORE, page))
        if not d or not d.get("items"): break
        for it in d["items"]:
            m = re.search(r"/athletes/(\d+)", it.get("$ref", ""))
            if m: ids.append(m.group(1))
        if page >= d.get("pageCount", 1): break
        page += 1
    return ids

def discover(limit):
    roster, _ = roster_slugs()
    ids = all_ufc_ids()
    print("ESPN UFC-league athletes:", len(ids))
    print("roster size:", len(roster))
    print("(candidates = these ids minus roster; the >=1-UFC-fight and")
    print(" stat-coverage checks are applied per fighter during --process-all)")
    return ids[:limit] if limit else ids

# ---------------- process-all (the bulk loop) ----------------
def process_all(min_coverage, limit, sleep_s):
    roster, _ = roster_slugs()
    os.makedirs(OUTDIR, exist_ok=True)
    manifest = os.path.join(OUTDIR, "_manifest.csv")

    # resume: skip espn ids already recorded in the manifest
    done = set()
    if os.path.exists(manifest):
        for line in open(manifest):
            cell = line.split(",")[0].strip()
            if cell.isdigit(): done.add(cell)
    new = not os.path.exists(manifest)
    mf = open(manifest, "a")
    if new:
        mf.write("espn_id,status,slug,division,record,record_check,stat_fights,def_fights,coverage,photo_ok,country_ok\n")

    ids = all_ufc_ids()
    if limit: ids = ids[:limit]
    counts = {}
    todo = [i for i in ids if i not in done]
    print("UFC athletes: %d | already done: %d | to process: %d"
          % (len(ids), len(done), len(todo)))

    for n, sid in enumerate(todo, 1):
        try:
            r = process(sid, roster, verbose=False, min_coverage=min_coverage)
        except Exception as e:
            r = {"status": "error", "espn_id": sid, "slug": str(e)[:40]}
        st = r.get("status", "error")
        counts[st] = counts.get(st, 0) + 1
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
        if n % 25 == 0 or st in ("ok", "low_coverage"):
            print("  [%d/%d] %s -> %s" % (n, len(todo), r.get("slug", sid), st))
        time.sleep(sleep_s)

    mf.close()
    print("\n=== done ===")
    for k in sorted(counts): print("  %-14s %d" % (k, counts[k]))
    print("manifest + per-fighter .js/.json in", OUTDIR)

# ---------------- cli ----------------
def find_id_by_name(name):
    r = curl("https://site.web.api.espn.com/apis/search/v2?query=%s&limit=10" % name.replace(" ", "%20"))
    pairs = re.findall(r"/mma/fighter/_/id/(\d+)/([a-z0-9-]+)", r)
    if not pairs: return None
    want = name_to_slug(name)
    for i, s in pairs:
        if s == want: return i
    return pairs[0][0]

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--espn-id")
    ap.add_argument("--name")
    ap.add_argument("--discover", action="store_true")
    ap.add_argument("--verify", metavar="NAME",
                    help="diff an existing roster fighter's DB entry against ESPN (no writes)")
    ap.add_argument("--process-all", action="store_true",
                    help="run the bulk import over all ex-UFC fighters not in roster")
    ap.add_argument("--min-coverage", type=float, default=0.5,
                    help="opponent-data coverage below this is flagged 'low_coverage'")
    ap.add_argument("--sleep", type=float, default=0.5,
                    help="seconds between fighters in --process-all")
    ap.add_argument("--limit", type=int, default=0)
    a = ap.parse_args()

    if a.discover:
        discover(a.limit); sys.exit(0)
    if a.verify:
        sid = a.espn_id or find_id_by_name(a.verify)
        if not sid: print("no ESPN match for", a.verify); sys.exit(1)
        verify(sid); sys.exit(0)
    if a.process_all:
        process_all(a.min_coverage, a.limit, a.sleep); sys.exit(0)

    roster, _ = roster_slugs()
    sid = a.espn_id or (find_id_by_name(a.name) if a.name else None)
    if not sid:
        print("provide --espn-id or --name (no match found)"); sys.exit(1)
    print("processing ESPN id", sid)
    process(sid, roster, min_coverage=a.min_coverage)
