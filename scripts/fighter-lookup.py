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
            MISSING, distinct from a field genuinely listed as 0/0.00)
  [ESPN]    bio fields (stance, height, reach, DOB, gym) from ESPN's core API --
            a second source so stance and other bio fields are not left blank
  [BFO]     full odds history parsed from bestfightodds.com (fighter's rows only)

A final ">> STILL MISSING" line lists any bio/stat field not found on EITHER
ufc.com or ESPN, so it can be chased on Sherdog/Tapology/Wikipedia before being
left blank. Run from the repo root. Network fetches use curl with a browser UA.
(UFCStats.com is bot-blocked; ufc.com + ESPN + BFO are the working sources.)
"""
import argparse, json, re, subprocess, sys, unicodedata
from datetime import datetime

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0 Safari/537.36"
TODAY = datetime.now()

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
    wins = {}
    for n_, kind in set(re.findall(r"(\d+) Wins by (Knockout|Decision|Submission)", txt)):
        wins[kind] = n_
    out = []
    statbits = [f"{k}={found[k]}" for k in ["slpm", "sapm", "tdLanded", "subAvg",
                "strDef", "tdDef", "kd", "avgTime", "strAcc", "tdAcc"] if k in found]
    if statbits: out.append(" ".join(statbits))
    if "gym" in found: out.append(f"gym: {found['gym']}")
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

def espn_report(name, espn_id=None):
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
    out = [f"page: /fighters/{bfo_id}"]
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
    a = ap.parse_args()
    print(f"========== [LOCAL] {a.name}")
    print(local_report(a.name))
    if not a.local_only:
        print(f"\n========== [UFCCOM] ufc.com/athlete/{slugify(a.name)}")
        ufc_txt, ufc_found = ufccom_report(a.name)
        print(ufc_txt)
        print(f"\n========== [ESPN] (bio/stance secondary source)")
        espn_txt, espn_found = espn_report(a.name, a.espn_id)
        print(espn_txt)
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
