#!/usr/bin/env python3
"""Gather everything needed to fill one fighter's GillyLab profile, compactly.

Usage:
  python3 scripts/fighter-lookup.py "Merab Dvalishvili"
  python3 scripts/fighter-lookup.py "Merab Dvalishvili" --bfo-id Merab-Dvalishvili-7676
  python3 scripts/fighter-lookup.py "Merab Dvalishvili" --local-only

Prints three sections:
  [LOCAL]   current data in index.html (stats / odds / fight history / accolades)
  [UFCCOM]  career stats parsed from ufc.com/athlete/<slug>
  [BFO]     full odds history parsed from bestfightodds.com (fighter's rows only)

Run from the repo root. Network fetches use curl with a browser UA.
(UFCStats.com is bot-blocked; ufc.com + BFO are the working sources.)
"""
import argparse, re, subprocess, sys, unicodedata
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
def ufccom_report(name):
    txt = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", curl(f"https://www.ufc.com/athlete/{slugify(name)}")))
    if len(txt) < 2000:
        return "fetch failed or athlete page missing (try a different slug)"
    out = []
    m = re.search(r"([\d.]+) Sig\. Str\. Landed Per Min ([\d.]+) Sig\. Str\. Absorbed Per Min ([\d.]+) Takedown avg Per 15 Min ([\d.]+) Submission avg Per 15 Min", txt)
    if m: out.append(f"slpm={m.group(1)} sapm={m.group(2)} tdLanded={m.group(3)} subAvg={m.group(4)}")
    m = re.search(r"(\d+) % Sig\. Str\. Defense (\d+) % Takedown Defense ([\d.]+) Knockdown Avg ([\d:]+) Average fight time", txt)
    if m: out.append(f"strDef={m.group(1)}% tdDef={m.group(2)}% kd={m.group(3)} avgTime={m.group(4)}")
    m = re.search(r"Striking accuracy (\d+)%", txt)
    if m: out.append(f"strAcc={m.group(1)}%")
    m = re.search(r"Takedown Accuracy (\d+)%", txt)
    if m: out.append(f"tdAcc={m.group(1)}%")
    wins = dict()
    for n_, kind in set(re.findall(r"(\d+) Wins by (Knockout|Decision|Submission)", txt)):
        wins[kind] = n_
    if wins: out.append(f"wins: {wins}  (finRate = (KO+Sub)/total wins)")
    m = re.search(r"Trains at ([^|]{3,60}?) (Fighting style|Age|Status)", txt)
    if m: out.append(f"gym: {m.group(1).strip()}")
    return "\n".join(out) or "page fetched but stats not found"

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

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("name")
    ap.add_argument("--bfo-id")
    ap.add_argument("--local-only", action="store_true")
    a = ap.parse_args()
    print(f"========== [LOCAL] {a.name}")
    print(local_report(a.name))
    if not a.local_only:
        print(f"\n========== [UFCCOM] ufc.com/athlete/{slugify(a.name)}")
        print(ufccom_report(a.name))
        print(f"\n========== [BFO]")
        print(bfo_report(a.name, a.bfo_id))
