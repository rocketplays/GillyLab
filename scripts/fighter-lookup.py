#!/usr/bin/env python3
"""Gather everything needed to fill one fighter's GillyLab profile, compactly.

Usage:
  python3 scripts/fighter-lookup.py "Merab Dvalishvili"
  python3 scripts/fighter-lookup.py "Merab Dvalishvili" --bfo-id Merab-Dvalishvili-7676
  python3 scripts/fighter-lookup.py "Merab Dvalishvili" --espn-id 3091146
  python3 scripts/fighter-lookup.py "Merab Dvalishvili" --local-only

Prints these sections:
  [LOCAL]   current data in index.html (stats / odds / fight history / accolades)
  [UFCCOM]  career stats parsed from ufc.com/athlete/<slug> (each field parsed
            independently; a field that is blank on the page is reported as
            MISSING, distinct from a field genuinely listed as 0/0.00). Also
            surfaces the fighter's gym, fighting style, and any grappling BELT
            RANK from the page's bio + Q&A blocks (the Q&A is often the only
            place a BJJ/judo belt is stated) -- use it for a 🥋 accolade.
  [ESPN]    bio fields (stance, height, reach, DOB, gym) from ESPN's core API --
            a second source so stance and other bio fields are not left blank;
            ALSO the VERIFIED takedown accuracy, summed from ESPN's per-fight
            stats table (takedowns landed / attempted across every fight). This
            is the authoritative tdAcc -- ufc.com's athlete page systematically
            under-reports takedowns LANDED and prints bogus low % (often 0-2%).
            If ufc.com and ESPN disagree, a "!! tdAcc MISMATCH" line tells you
            to use the ESPN value.
            ALSO downloads the ESPN headshot to photos/<slug>.png (slug computed
            with the same rules as index.html's nameToSlug). Existing photos are
            kept unless --force-photo; use --no-photo to skip the download. The
            "photo: ..." line in this section reports what happened.
  [BFO]     full odds history parsed from bestfightodds.com (fighter's rows only).
            ODDS_HISTORY records the CLOSING line: take the number right before
            the % movement (the closer), not the opener (the first number).

A final ">> STILL MISSING" line lists any bio/stat field not found on EITHER
ufc.com or ESPN, so it can be chased on Sherdog/Tapology/Wikipedia before being
left blank. Run from the repo root. Network fetches use curl with a browser UA.
(UFCStats.com is bot-blocked; ufc.com + ESPN + BFO are the working sources.)
"""
import argparse, json, os, re, subprocess, sys, unicodedata, urllib.request
from datetime import datetime
from html import unescape as html_unescape

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0 Safari/537.36"
TODAY = datetime.now()

# repo paths (this script lives in scripts/; photos/ sits at the repo root)
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PHOTOS_DIR = os.path.join(ROOT, "photos")

def curl(url):
    r = subprocess.run(["curl", "-s", "--max-time", "60", "-L", "-A", UA, url],
                       capture_output=True, text=True)
    return r.stdout

def fold(s):
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return s.replace("ł", "l").replace("Ł", "L").lower()

def slugify(name):
    s = fold(name).replace("'", "").replace("’", "")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")

# Canonical photo-file slug — MUST stay byte-for-byte identical to index.html's
# nameToSlug(), because the site looks up photos/<slug>.png by that exact slug.
# (slugify() above is for ufc.com/ESPN URL guesses and does NOT drop the Jr./Sr./
# numeral suffixes or map special letters the way nameToSlug does, so the photo
# filename uses this function instead.)
SLUG_LETTER_MAP = {
    "ł": "l", "Ł": "L", "đ": "d", "Đ": "D", "ø": "o", "Ø": "O",
    "æ": "ae", "Æ": "AE", "œ": "oe", "Œ": "OE", "ß": "ss",
    "ı": "i", "İ": "I",
}
SUFFIX_RE = re.compile(r"\s+(jr\.?|sr\.?|i{1,3}|iv|v)\s*$", re.I)

def canonical_slug(name):
    s = name.lower()
    s = SUFFIX_RE.sub("", s)                       # drop trailing Jr./Sr./II/III/IV/V
    s = "".join(SLUG_LETTER_MAP.get(c, c) for c in s)
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.replace("'", "").replace("’", "")        # drop apostrophes entirely
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")

def save_headshot(bio, name, force=False):
    """Download the ESPN headshot from the athlete bio JSON to
    photos/<canonical_slug>.png and return a short status string.
    - keyed by canonical_slug(name) so the site finds it
    - skips if a photo already exists (won't clobber a curated one) unless force
    - guards against ESPN's tiny silhouette placeholder (<3000 bytes)
    """
    slug = canonical_slug(name)
    hs = (bio.get("headshot") or {}).get("href")
    dest = os.path.join(PHOTOS_DIR, slug + ".png")
    rel = "photos/%s.png" % slug
    if not hs:
        return "no headshot on ESPN (leave %s for manual sourcing)" % rel
    if os.path.exists(dest) and not force:
        return "kept existing %s (re-run with --force-photo to overwrite)" % rel
    os.makedirs(PHOTOS_DIR, exist_ok=True)
    subprocess.run(["curl", "-s", "--max-time", "60", "-L", "-A", UA, "-o", dest, hs])
    sz = os.path.getsize(dest) if os.path.exists(dest) else 0
    if sz < 3000:                                   # silhouette / placeholder guard
        if os.path.exists(dest):
            os.remove(dest)
        return "ESPN returned a placeholder/too-small image (%d bytes), skipped %s" % (sz, rel)
    return "saved %s (%d bytes)" % (rel, sz)

# ---------- local (index.html) ----------
def block_of(html, const):
    start = html.index("const %s = " % const)
    i = start + len("const %s = " % const)
    while html[i] not in "[{":
        i += 1
    oc = html[i]; cc = "]" if oc == "[" else "}"
    d = 0
    for j in range(i, len(html)):
        if html[j] == oc: d += 1
        elif html[j] == cc:
            d -= 1
            if d == 0: return html[i:j + 1]

def local_report(name):
    html = open("index.html").read()
    out = []
    rows = re.findall(r'\{ name: "%s", division: "([^"]*)", rank: "([^"]*)", record: "([^"]*)"' % re.escape(name), html)
    out.append(f"FIGHTERS row: {rows if rows else 'NOT IN ROSTER'}")
    m = re.search(r'"%s":\s*\{([^}]*)\}' % re.escape(name), block_of(html, "FIGHTER_STATS"))
    out.append("STATS: " + (re.sub(r"\s+", " ", m.group(1)).strip() if m else "none"))
    m = re.search(r'"%s": \[(.*?)\n\s*\]' % re.escape(name), block_of(html, "ODDS_HISTORY"), re.S)
    odds = re.findall(r'opponent: "([^"]+)", odds: (-?\d+)', m.group(1)) if m else []
    out.append(f"ODDS ({len(odds)}): " + "; ".join(f"{o} {v}" for o, v in odds))
    m = re.search(r'"%s": \[(.*?)\n\s*\]' % re.escape(name), block_of(html, "FIGHT_HISTORY"), re.S)
    fights = re.findall(r'date: "([^"]+)", opponent: "([^"]+)", result: "([^"]+)", method: "([^"]+)"', m.group(1)) if m else []
    w = l = d = 0; streak = None
    past = []
    for date, opp, res, meth in fights:
        try: future = datetime.strptime(date, "%b %d, %Y") > TODAY
        except ValueError: future = False
        if future or meth == "Upcoming" or res == "–":
            out.append(f"  upcoming row present: {date} vs {opp}")
            continue
        past.append((date, opp, res, meth))
        if res == "W": w += 1
        elif res == "L": l += 1
        elif res == "D": d += 1
    for date, opp, res, meth in past:  # newest first: streak = wins before first non-W (NC skipped)
        if res == "NC": continue
        if res == "W": streak = (streak or 0) + 1
        else: break
    out.append(f"FIGHT_HISTORY: {len(past)} past fights -> derived record {w}-{l}-{d}, win streak {streak or 0}")
    for f in past[:5]:
        out.append("  " + " | ".join(f))
    m = re.search(r'"%s": \[(.*?)\n\s*\]' % re.escape(name), block_of(html, "ACCOLADES"), re.S)
    acc = re.findall(r'title: "([^"]+)"', m.group(1)) if m else []
    out.append(f"ACCOLADES ({len(acc)}): " + " || ".join(acc))
    return "\n".join(out)

# ---------- ufc.com ----------
# Each field parsed on its own so one blank field never drops the others.
# A capture of "0"/"0.00" means a genuine zero; NO match means the page left it
# blank -> that field is reported as MISSING (chase it on another source).
# values must START with a digit (\d[\d.]*) so a stray "." in the page's tooltip
# definitions can't be mistaken for a real value (e.g. a blank Knockdown Avg).
UFC_FIELDS = {
    "slpm":     r"(\d[\d.]*) Sig\. Str\. Landed Per Min",
    "sapm":     r"(\d[\d.]*) Sig\. Str\. Absorbed Per Min",
    "tdLanded": r"(\d[\d.]*) Takedown avg Per 15 Min",
    "subAvg":   r"(\d[\d.]*) Submission avg Per 15 Min",
    "strDef":   r"(\d+) % Sig\. Str\. Defense",
    "tdDef":    r"(\d+) % Takedown Defense",
    "kd":       r"(\d[\d.]*) Knockdown Avg",
    "avgTime":  r"(\d[\d:]*) Average fight time",
    "strAcc":   r"Striking accuracy (\d+)%",
    "tdAcc":    r"Takedown Accuracy (\d+)%",
}
# fields the GillyLab FIGHTER_STATS object actually stores (avgTime is info-only)
UFC_STAT_FIELDS = ["slpm", "sapm", "tdLanded", "subAvg", "strDef", "tdDef", "kd", "strAcc", "tdAcc"]

def ufccom_report(name):
    txt = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", curl(f"https://www.ufc.com/athlete/{slugify(name)}")))
    if len(txt) < 2000:
        return "fetch failed or athlete page missing (try a different slug)", {}
    found = {}
    for f, pat in UFC_FIELDS.items():
        m = re.search(pat, txt)
        if m:
            found[f] = m.group(1)
    m = re.search(r"Trains at ([^|]{3,60}?) (Fighting style|Age|Status)", txt)
    if m: found["gym"] = m.group(1).strip()
    # Fighting style + grappling belt rank from ufc.com's bio + Q&A blocks. The
    # Q&A is the best (often only) source for a fighter's BJJ/judo belt rank, e.g.
    # "Black belt in BJJ" (Oliveira), "brown belt in BJJ" (O'Malley). Surface the
    # raw context so it can be turned into a 🥋 ACCOLADE. Title/championship "belt"
    # mentions also match — read the snippet to tell a grappling rank from a belt
    # the fighter won.
    m = re.search(r"Fighting style\s+(.+?)\s+(?:Age|Height|Status|Trains|Octagon)", txt)
    if m: found["style"] = m.group(1).strip()
    belts = []
    for bm in re.finditer(r".{0,22}\bbelt\b.{0,22}", txt, re.I):
        seg = re.sub(r"\s+", " ", bm.group(0)).strip()
        if seg.lower() not in (b.lower() for b in belts):
            belts.append(seg)
    if belts: found["belts"] = belts
    wins = {}
    for n_, kind in set(re.findall(r"(\d+) Wins by (Knockout|Decision|Submission)", txt)):
        wins[kind] = n_
    out = []
    statbits = [f"{k}={found[k]}" for k in ["slpm", "sapm", "tdLanded", "subAvg",
                "strDef", "tdDef", "kd", "avgTime", "strAcc", "tdAcc"] if k in found]
    if statbits: out.append(" ".join(statbits))
    if "gym" in found: out.append(f"gym: {found['gym']}")
    if found.get("style"): out.append(f"fighting style (ufc.com): {found['style']}")
    if found.get("belts"):
        out.append("belt rank / 'belt' mentions (ufc.com Q&A — use for 🥋 accolade): "
                   + "  ||  ".join(found["belts"][:5]))
    if wins: out.append(f"wins: {wins}  (finRate = (KO+Sub)/total wins)")
    missing = [k for k in UFC_STAT_FIELDS if k not in found]
    if missing:
        out.append(f"MISSING on ufc.com (blank, NOT a 0): {missing}  <- chase on ESPN/Sherdog/Tapology")
    return ("\n".join(out) or "page fetched but stats not found"), found

# ---------- espn (secondary source for bio fields incl. stance) ----------
def espn_find_id(name, espn_id=None):
    if espn_id: return espn_id
    r = curl("https://site.web.api.espn.com/apis/search/v2?query=%s&limit=10" % name.replace(" ", "%20"))
    pairs = re.findall(r"/mma/fighter/_/id/(\d+)/([a-z0-9-]+)", r)
    if not pairs: return None
    want = slugify(name)
    for i, s in pairs:           # prefer the result whose slug matches the name
        if s == want: return i
    return pairs[0][0]

def espn_tdacc(sid):
    """AUTHORITATIVE takedown accuracy, summed from ESPN's per-fight stats table
    (takedowns landed / attempted across every fight). Use this for the
    FIGHTER_STATS tdAcc field. ufc.com's athlete page under-reports takedowns
    LANDED and produces bogus low percentages (often 0-2%); this per-fight sum
    is the correct figure. Returns (pct, TDL, TDA) or None if no table exists.
    A genuine (0, 0, n>0) means the fighter truly landed 0 of n attempts; a
    (0, 0, 0) means no recorded takedown attempts (None of the data is the bug).
    """
    # ESPN's stats page returns empty to curl but serves fine to urllib.
    try:
        req = urllib.request.Request(
            "https://www.espn.com/mma/fighter/stats/_/id/%s" % sid,
            headers={"User-Agent": "Mozilla/5.0"})
        t = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "ignore")
    except Exception:
        return None
    if not t:
        return None
    txt = re.sub(r"\|+", "|", html_unescape(re.sub(r"<[^>]+>", "|", t)))
    i = txt.find("TK ACC")          # the Clinch table header
    if i == -1:
        return None
    toks = [x.strip() for x in txt[i + 6:].split("|") if x.strip() != ""]
    datere = re.compile(r"^[A-Z][a-z]{2} \d{1,2}, \d{4}$")
    TDL = TDA = 0
    for k, tk in enumerate(toks):
        if datere.match(tk):        # one fight row begins at each date cell
            row = toks[k:k + 16]
            if len(row) >= 16 and row[15].endswith("%"):
                try:
                    TDL += int(row[12]); TDA += int(row[13])
                except ValueError:
                    pass
    if TDA == 0:
        return (0, TDL, TDA)
    return (round(100 * TDL / TDA), TDL, TDA)

def espn_report(name, espn_id=None, save_photo=True, force_photo=False):
    sid = espn_find_id(name, espn_id)
    if not sid:
        return "no ESPN match (try --espn-id <number>)", {}
    raw = curl("https://sports.core.api.espn.com/v2/sports/mma/athletes/%s" % sid)
    try:
        d = json.loads(raw)
    except Exception:
        return f"id={sid} but ESPN JSON fetch failed", {}
    found = {}
    if (d.get("stance") or {}).get("text"): found["stance"] = d["stance"]["text"]
    if d.get("displayReach"):  found["reach"] = d["displayReach"]
    if d.get("displayHeight"): found["ht"] = d["displayHeight"]
    if d.get("dateOfBirth"):   found["dob"] = d["dateOfBirth"][:10]
    if (d.get("association") or {}).get("name"): found["gym"] = d["association"]["name"]
    if d.get("citizenship"):   found["country"] = d["citizenship"]
    out = [f"id={sid}  https://www.espn.com/mma/fighter/_/id/{sid}"]
    out.append(" ".join(f"{k}={v}" for k, v in found.items()) or "no bio fields parsed")
    td = espn_tdacc(sid)
    if td is not None:
        acc, tdl, tda = td
        found["tdAcc"] = str(acc)
        note = "" if tda else "  (no recorded TD attempts -> 0% is genuine)"
        out.append(f"tdAcc (VERIFIED per-fight {tdl}/{tda}) = {acc}%   <- USE THIS for FIGHTER_STATS tdAcc{note}")
    else:
        out.append("tdAcc: no ESPN per-fight table (fall back to ufc.com, but sanity-check the value)")
    if save_photo:
        out.append("photo: " + save_headshot(d, name, force=force_photo))
    return "\n".join(out), found

# ---------- bestfightodds ----------
def bfo_find_id(name):
    h = curl(f"https://www.bestfightodds.com/search?query={name.split()[-1]}")
    cands = sorted(set(re.findall(r"/fighters/([A-Za-z-]+-\d+)", h)))
    exact = [c for c in cands if fold(re.sub(r"-\d+$", "", c)).replace("-", "") == fold(name).replace(" ", "").replace("-", "").replace("'", "")]
    if exact: return exact[0], cands
    return None, cands

def bfo_report(name, bfo_id=None):
    cands = []
    if not bfo_id:
        bfo_id, cands = bfo_find_id(name)
    if not bfo_id:
        return "no exact BFO match; candidates: " + ", ".join(cands[:12])
    h = curl(f"https://www.bestfightodds.com/fighters/{bfo_id}")
    out = [f"page: /fighters/{bfo_id}",
           "ODDS_HISTORY stores the CLOSING line: each row reads "
           "'name | opener | ... | closer | %move | arrow' -> use the number "
           "right before the % (the closer), NOT the opener (first number)."]
    rows = re.findall(r"<tr[^>]*>(.*?)</tr>", h, re.S)
    for r in rows:
        txt = re.sub(r"\s+", " ", re.sub(r"\|+", " | ", re.sub(r"<[^>]+>", "|", r))).strip(" |")
        if not txt or txt.startswith("Matchup"): continue
        out.append(txt[:150])
    return "\n".join(out)

# bio + stat fields a complete FIGHTER_STATS entry should carry
BIO_FIELDS  = ["ht", "dob", "reach", "stance", "gym"]
STAT_FIELDS = ["slpm", "sapm", "tdLanded", "subAvg", "strDef", "tdDef", "kd", "strAcc", "tdAcc"]

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("name")
    ap.add_argument("--bfo-id")
    ap.add_argument("--espn-id")
    ap.add_argument("--local-only", action="store_true")
    ap.add_argument("--no-photo", action="store_true",
                    help="skip downloading the ESPN headshot to photos/<slug>.png")
    ap.add_argument("--force-photo", action="store_true",
                    help="overwrite an existing photos/<slug>.png with the ESPN headshot")
    a = ap.parse_args()
    print(f"========== [LOCAL] {a.name}")
    print(local_report(a.name))
    if not a.local_only:
        print(f"\n========== [UFCCOM] ufc.com/athlete/{slugify(a.name)}")
        ufc_txt, ufc_found = ufccom_report(a.name)
        print(ufc_txt)
        print(f"\n========== [ESPN] (bio/stance secondary source + VERIFIED tdAcc)")
        espn_txt, espn_found = espn_report(a.name, a.espn_id,
                                           save_photo=not a.no_photo,
                                           force_photo=a.force_photo)
        print(espn_txt)
        u, e = ufc_found.get("tdAcc"), espn_found.get("tdAcc")
        if u is not None and e is not None and abs(int(u) - int(e)) >= 5:
            print(f"\n!! tdAcc MISMATCH: ufc.com={u}% vs ESPN per-fight={e}%  ->  USE ESPN ({e}%).")
            print("   ufc.com under-counts takedowns landed; the ESPN per-fight sum is correct.")
        # ESPN's per-fight tdAcc is authoritative; let it win in the missing-field set
        have = set(ufc_found) | set(espn_found)
        still = [f for f in (BIO_FIELDS + STAT_FIELDS) if f not in have]
        print()
        if still:
            print(f">> STILL MISSING after ufc.com + espn: {still}")
            print("   Do NOT leave these blank. Verify on Sherdog / Tapology / Wikipedia.")
            print("   Only leave a field out if it is confirmed unavailable on several")
            print("   sources, or is genuinely 0 (a real 0/0.00 is reported, not 'missing').")
        else:
            print(">> all bio + stat fields located across ufc.com + espn")
        print(f"\n========== [BFO]")
        print(bfo_report(a.name, a.bfo_id))
