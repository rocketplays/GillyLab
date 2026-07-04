#!/usr/bin/env python3
"""
gillylab_clean_accolades.py
───────────────────────────
One-time cleaner for accolades_wikipedia.json produced by the bulk run, fixing the
issues found in review WITHOUT re-fetching:

  1. WRONG-PAGE name collisions — using accolades_wikipedia.log ("Name: N from
     'Page Title'"), drop any fighter whose resolved Wikipedia page doesn't actually
     match their name (e.g. "Paul Jones" → a famous "Jones"). These names are written
     to accolades_rescrape.txt so a re-run (with the tightened wiki_search) can refill
     them correctly.
  2. Leftover bullet markers ("* 9th deg. BJJ belt") — stripped.
  3. Bare org headers ending with ":" ("IBJJF World Championship:") — dropped.
  4. Citation-fragment leaks ("url=", "web|url= …") — dropped.
  5. Biography prose captured as an accolade — dropped.

Writes accolades_wikipedia.clean.json (and backs up the original). Review it, then
either rename it over the original or re-run the scraper to refill the re-scrape list.
"""
import json, re, sys, unicodedata
from pathlib import Path

ROOT = Path(__file__).parent
JSON_IN  = ROOT / "accolades_wikipedia.json"
LOG_IN   = ROOT / "accolades_wikipedia.log"
JSON_OUT = ROOT / "accolades_wikipedia.clean.json"
RESCRAPE = ROOT / "accolades_rescrape.txt"

try:
    from gillylab_wikipedia_fill import WIKIPEDIA_MANUAL
except Exception:
    WIKIPEDIA_MANUAL = {}

def _norm(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9 ]", " ", s.lower())

def name_matches_page(name, page):
    """Same whole-word first+last test the fixed wiki_search uses."""
    w = _norm(name).split()
    if not w:
        return False
    first, last = w[0], w[-1]
    tw = set(_norm(re.sub(r"\s*\([^)]*\)\s*", " ", page)).split())
    return first in tw and last in tw

_RANK = re.compile(r"\b(most|fewest|tied|highest|lowest|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\b", re.I)
_STAT = re.compile(r"bonus|award|\bwins?\b|knockout|takedown|strikes?|submission|finish|defen[sc]e|title fight|\bfights?\b|\breign", re.I)

def clean_title(t):
    t = re.sub(r"^[\s*:•·\-–—]+", "", t or "")          # leading bullet markers
    t = re.sub(r"\s+vs\.?\s*$", "", t)                  # trailing "vs." with no names
    t = re.sub(r"\s+", " ", t).strip()
    return t

ACCOLADE_KW = re.compile(r"champion|medal|belt|of the night|hall of fame|\btitle\b|tournament|master of sport|all-?american|olympic|\bdan\b|grand prix|grand slam", re.I)

# Pro-wrestling promotions / titles — out of scope for an MMA database.
_PROWRESTLING = re.compile(
    r"\b(WWE|WWF|AEW|ROH|TNA|ECW|OVW|IWA|WCW|NJPW|IWC|LWF|SPCW|RCW|MPW|GWA|DWA|POGW"
    r"|NSWA|ATCW|NWA|LPW)\b|tag team|intercontinental cham|professional wrestling"
    r"|world heavyweight championship \(", re.I)

def is_prowrestling(t):
    if re.search(r"\bUFC\b|\bMMA\b", t):        # keep MMA-context (e.g. UFC Triple Crown)
        return False
    if _PROWRESTLING.search(t):
        return True
    if re.search(r"triple crown", t, re.I):     # non-UFC triple crown = pro wrestling
        return True
    if re.search(r"\bwrestler of the year\b|unrecogni[sz]ed", t, re.I):
        return True
    if re.search(r"\w+ wrestling (?:heavyweight|light\s*heavyweight|world|tag team) champion", t, re.I):
        return True
    return False

def is_malformed_medal(t):
    return bool(re.search(r"align=center|colspan|rowspan", t, re.I) or
                re.match(r"^\s*\d{4}\s*[—–-]\s*\d{4}\s*[—–-]", t))   # "YYYY — YYYY — division"

def is_broken_parse(accs):
    """Catastrophic parse: raw section headers ("==Career==") leaked in — the whole
    fighter's data is unreliable, so drop and re-scrape rather than keep fragments."""
    return any("==" in (a.get("title") or "") for a in accs)

def is_junk(t):
    if not t or len(t) < 4 or t.endswith(":"):
        return True
    if "==" in t:
        return True
    if is_prowrestling(t) or is_malformed_medal(t):
        return True
    # stat-leaderboard record carrying a ⭐/🏅 ("Most Post-Fight bonuses in UFC
    # history") — a count, not an award. Requires a countable stat so legit
    # distinctions like "Triple Crown Champion (first in UFC history)" survive.
    if "history" in t.lower() and _RANK.search(t) and _STAT.search(t):
        return True
    if re.search(r"\|?\s*url\s*=|archive-url|access-?date|\bcite\b", t, re.I):
        return True
    if re.search(r"\bsuccessful\b|\bdefen[sc]es?\b|\breign\b|torch\s?-?bearer", t, re.I):
        return True
    # biography prose (narrative verb, long, names no accolade)
    if (len(t) > 45
            and re.search(r"\b(is an?|was an?|were|has|had|began|became|born|married|notable|famous|rivalry|represented|defeated|continued|moved|fought|trained|competed|retired|joined|signed|invited|his |her )\b", t, re.I)
            and not ACCOLADE_KW.search(t)):
        return True
    return False

def main():
    data = json.loads(JSON_IN.read_text(encoding="utf-8"))

    # name -> resolved page title (last occurrence wins)
    page_of = {}
    if LOG_IN.exists():
        for line in LOG_IN.read_text(encoding="utf-8").splitlines():
            m = re.search(r"\]\s*(.+?):\s*\d+\s+from\s+'(.+)'\s*$", line)
            if m:
                page_of[m.group(1).strip()] = m.group(2).strip()

    out, rescrape = {}, []
    stats = {"wrong_page": 0, "titles_cleaned": 0, "junk_dropped": 0, "emptied": 0}
    for name, accs in data.items():
        page = WIKIPEDIA_MANUAL.get(name) or page_of.get(name)
        # wrong-page: resolved to a page whose name doesn't match (skip manual maps)
        if name not in WIKIPEDIA_MANUAL and page and not name_matches_page(name, page):
            stats["wrong_page"] += 1
            rescrape.append(name)
            continue
        if is_broken_parse(accs):
            stats["broken_parse"] = stats.get("broken_parse", 0) + 1
            rescrape.append(name)
            continue
        kept = []
        for a in accs:
            ct = clean_title(a.get("title", ""))
            if ct != a.get("title", ""):
                stats["titles_cleaned"] += 1
            if is_junk(ct):
                stats["junk_dropped"] += 1
                continue
            kept.append({**a, "title": ct})
        if kept:
            out[name] = kept
        else:
            stats["emptied"] += 1

    JSON_OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    RESCRAPE.write_text("\n".join(sorted(set(rescrape))) + "\n", encoding="utf-8")
    print("Input fighters:      %d" % len(data))
    print("Wrong-page removed:  %d  → %s" % (stats["wrong_page"], RESCRAPE.name))
    print("Broken-parse removed:%d" % stats.get("broken_parse", 0))
    print("Junk entries dropped:%d" % stats["junk_dropped"])
    print("Titles cleaned:      %d" % stats["titles_cleaned"])
    print("Emptied (0 left):    %d" % stats["emptied"])
    print("Output fighters:     %d  → %s" % (len(out), JSON_OUT.name))

if __name__ == "__main__":
    main()
