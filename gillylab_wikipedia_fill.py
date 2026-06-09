#!/usr/bin/env python3
"""
gillylab_wikipedia_fill.py
──────────────────────────
Queries Wikipedia for every fighter in the GillyLab FIGHTERS array,
parses bio + full fight record, and writes a pre-filled fighter_data.txt.

Fields filled from Wikipedia:
  • BIO:    height, dob, reach, stance, gym (trainer)
  • FIGHTS: complete professional record (date, result, opponent,
            method, event, org, round, time)

Fields left blank for manual entry:
  • odds, watch links, accolades
  • per-fight stats (slpm, strAcc, etc.)

Output: fighter_data_wikipedia.txt  ← safe, does NOT touch your existing file
        fighter_data_wikipedia_log.txt  ← per-fighter success/error notes

Setup (one-time, run in Terminal):
    pip3 install requests

Usage:
    python3 gillylab_wikipedia_fill.py                        # all 655 fighters
    python3 gillylab_wikipedia_fill.py --test "Islam Makhachev"
    python3 gillylab_wikipedia_fill.py --limit 20             # first 20
    python3 gillylab_wikipedia_fill.py --start 100 --limit 50 # resume from #100
"""

import re, sys, time, argparse, unicodedata

_DEBUG_CELLS = False  # set True via --debug flag to dump raw cells on blank dates
from pathlib import Path

try:
    import requests
except ImportError:
    sys.exit("Run first:  pip3 install requests")

# ── paths ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent
INDEX_HTML  = SCRIPT_DIR / "index.html"
OUT_FILE    = SCRIPT_DIR / "fighter_data_wikipedia.txt"
LOG_FILE    = SCRIPT_DIR / "fighter_data_wikipedia_log.txt"

# ── constants ─────────────────────────────────────────────────────────────────
WIKI_API = "https://en.wikipedia.org/w/api.php"
UA       = {"User-Agent": "GillyLab/1.0 (https://gillylab.com; fighter-data bot)"}
DELAY    = 0.5   # seconds between requests

# ── Wikipedia fill skip list ──────────────────────────────────────────────────
# Fighters whose Wikipedia pages embed non-MMA records (wrestling, BJJ, boxing)
# in the same section/template as their MMA record, causing the parser to return
# inflated fight counts that can't be reliably separated automatically.
# These fighters' FIGHT_HISTORY and record: fields should be managed manually.
WIKIPEDIA_SKIP: set[str] = {
    "Gable Steveson",    # Wikipedia mixes NCAA wrestling record with MMA record
    "Mackenzie Dern",    # Wikipedia mixes BJJ competition record with MMA record
    "Henry Cejudo",      # Wikipedia mixes Olympic/freestyle wrestling with MMA record
}

MONTH_ABBR = {
    1:"Jan",2:"Feb",3:"Mar",4:"Apr",5:"May",6:"Jun",
    7:"Jul",8:"Aug",9:"Sep",10:"Oct",11:"Nov",12:"Dec",
}
MONTH_NAME = {
    "january":1,"february":2,"march":3,"april":4,"may":5,"june":6,
    "july":7,"august":8,"september":9,"october":10,"november":11,"december":12,
    # abbreviated (3-char)
    "jan":1,"feb":2,"mar":3,"apr":4,"jun":6,
    "jul":7,"aug":8,"sep":9,"oct":10,"nov":11,"dec":12,
    # "may" is same for both full and abbreviated
}
# Regex alternation covering full and abbreviated month names
_MONTH_RE = (
    r"january|february|march|april|may|june|july|august|september|october|november|december|"
    r"jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec"
)

# Wikipedia result templates → letter
RESULT_TOKENS = {
    "win":"W","loss":"L","draw":"D","nc":"NC","no contest":"NC",
}

# Org inference — mirrors inferPromotion() in index.html
ORG_PATTERNS = [
    (r"^UFC\b",                    "UFC"),
    (r"^DWCS\b|contender.series",  "UFC"),
    (r"^Dana\s*White",             "UFC"),
    (r"^Bellator\b",               "Bellator"),
    (r"^PFL\b",                    "PFL"),
    (r"^ONE\b",                    "ONE Championship"),
    (r"^RIZIN\b",                  "RIZIN"),
    (r"^Invicta\b",                "Invicta FC"),
    (r"^Strikeforce\b",            "Strikeforce"),
    (r"^PRIDE\b",                  "PRIDE"),
    (r"^WEC\b",                    "WEC"),
    (r"^WSOF\b",                   "WSOF"),
    (r"^LFA\b",                    "LFA"),
    (r"^Cage\s*Warriors\b",        "Cage Warriors"),
    (r"^ACB\b",                    "ACB"),
    (r"^ACA\b",                    "ACA"),
    (r"^M-1\b",                    "M-1 Global"),
    (r"^BRAVE\b",                  "BRAVE CF"),
    (r"^KSW\b",                    "KSW"),
    (r"^Road\s*FC\b",              "Road FC"),
    (r"^Titan\s*FC\b",             "Titan FC"),
    (r"^Pancrase\b",               "Pancrase"),
    (r"^Shooto\b",                 "Shooto"),
    (r"^DEEP\b",                   "DEEP"),
]

def infer_org(event_name):
    for pat, org in ORG_PATTERNS:
        if re.search(pat, event_name, re.I):
            return org
    return ""


# ── Wikipedia API ─────────────────────────────────────────────────────────────
def _norm(s):
    """Lowercase, strip accents — for name matching."""
    s = unicodedata.normalize("NFD", str(s))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return s.lower()

def wiki_search(name):
    resp = requests.get(WIKI_API, headers=UA, timeout=10, params={
        "action":"query","list":"search",
        "srsearch":f"{name} MMA fighter","srlimit":5,
        "format":"json","utf8":"",
    })
    hits = resp.json().get("query",{}).get("search",[])
    if not hits:
        return None

    name_norm  = _norm(name)
    name_words = name_norm.split()
    first = name_words[0]  if name_words      else ""
    last  = name_words[-1] if len(name_words) > 1 else ""

    # Strong match: both first AND last name appear in the title
    for h in hits:
        t = _norm(h["title"])
        if first and last and first in t and last in t:
            return h["title"]

    # Weaker match: just last name (only if >= 5 chars to avoid common short words)
    if len(last) >= 5:
        for h in hits:
            if last in _norm(h["title"]):
                return h["title"]

    # No confident match — leave blank rather than return wrong fighter
    return None

def wiki_wikitext(title):
    resp = requests.get(WIKI_API, headers=UA, timeout=15, params={
        "action":"query","titles":title,
        "prop":"revisions","rvprop":"content",
        "rvslots":"main","format":"json",
    })
    pages = resp.json().get("query",{}).get("pages",{})
    for page in pages.values():
        if page.get("missing") is not None:
            return None
        try:
            return page["revisions"][0]["slots"]["main"]["*"]
        except (KeyError,IndexError,TypeError):
            return None
    return None


# ── wikitext cleaning ─────────────────────────────────────────────────────────
def strip_wt(text):
    """Remove wikilinks, templates, HTML tags, refs."""
    t = str(text or "")
    t = re.sub(r"<ref[^>]*>.*?</ref>","",t,flags=re.DOTALL)
    t = re.sub(r"<[^>]+>","",t)
    t = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]+)\]\]",r"\1",t)   # [[X|Y]]→Y
    t = re.sub(r"\[+|\]+", "", t)   # remove any leftover bare [ or ] chars
    # Remove nested templates iteratively (handles up to 3 levels)
    # Use DOTALL so multi-line templates like {{ubl|...\n...}} are fully stripped
    for _ in range(3):
        t = re.sub(r"\{\{[^{}]*\}\}","",t, flags=re.DOTALL)
    t = re.sub(r"'{2,3}","",t)
    t = re.sub(r"\s+"," ",t)
    return t.strip()

def parse_date(text):
    """Return 'Mon D, YYYY' from wikitext date fields."""
    t = str(text or "")
    # {{sort|YYYYMMDD|...}} — extract from 8-digit sort key as fallback
    sort_m = re.search(r"\{\{sort\|(\d{8})\|", t)
    # {{dts|format=dmy|2025|November|15}} — named month (full or abbreviated)
    m = re.search(rf"\|\s*(\d{{4}})\s*\|\s*({_MONTH_RE})\s*\|\s*(\d{{1,2}})", t, re.I)
    if m:
        y,mo,d = int(m.group(1)),MONTH_NAME[m.group(2).lower()],int(m.group(3))
        return f"{MONTH_ABBR[mo]} {d}, {y}"
    # {{dts|YYYY|M|D}} — numeric month
    m = re.search(r"\|\s*(\d{4})\s*\|\s*(\d{1,2})\s*\|\s*(\d{1,2})", t)
    if m:
        y,mo,d = int(m.group(1)),int(m.group(2)),int(m.group(3))
        if 1 <= mo <= 12 and 1 <= d <= 31:
            return f"{MONTH_ABBR[mo]} {d}, {y}"
    # {{dts|YYYY.MM.DD}} — dot-separated
    m = re.search(r"(\d{4})\.(\d{2})\.(\d{2})", t)
    if m:
        y,mo,d = int(m.group(1)),int(m.group(2)),int(m.group(3))
        if 1 <= mo <= 12 and 1 <= d <= 31:
            return f"{MONTH_ABBR[mo]} {d}, {y}"
    # ISO
    m = re.search(r"(\d{4})-(\d{2})-(\d{2})", t)
    if m:
        y,mo,d = int(m.group(1)),int(m.group(2)),int(m.group(3))
        if 1 <= mo <= 12 and 1 <= d <= 31:
            return f"{MONTH_ABBR[mo]} {d}, {y}"
    # "22 April 2023" or "22 Apr 2023"
    m = re.search(rf"(\d{{1,2}})\s+({_MONTH_RE})\s+(\d{{4}})", t, re.I)
    if m:
        d,mo,y = int(m.group(1)),MONTH_NAME[m.group(2).lower()],int(m.group(3))
        return f"{MONTH_ABBR[mo]} {d}, {y}"
    # "April 22, 2023" or "Apr 22, 2023"
    m = re.search(rf"({_MONTH_RE})\s+(\d{{1,2}}),?\s+(\d{{4}})", t, re.I)
    if m:
        mo,d,y = MONTH_NAME[m.group(1).lower()],int(m.group(2)),int(m.group(3))
        return f"{MONTH_ABBR[mo]} {d}, {y}"
    # {{sort|YYYYMMDD|}} with empty/unparseable display — fall back to sort key
    if sort_m:
        s = sort_m.group(1)
        y,mo,d = int(s[:4]),int(s[4:6]),int(s[6:8])
        if 1 <= mo <= 12 and 1 <= d <= 31:
            return f"{MONTH_ABBR[mo]} {d}, {y}"
    return ""

def parse_dob(text):
    """Return YYYY-MM-DD."""
    t = str(text or "")
    # {{Birth date and age|1991|10|27}} — numbers separated by |
    m = re.search(r"\|\s*(\d{4})\s*\|\s*(\d{1,2})\s*\|\s*(\d{1,2})",t)
    if m:
        return f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
    # ISO
    m = re.search(r"(\d{4})-(\d{2})-(\d{2})",t)
    if m:
        return m.group(0)
    # "October 27, 1991" or "27 October 1991"
    m = re.search(r"(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})",t,re.I)
    if m:
        return f"{m.group(3)}-{MONTH_NAME[m.group(2).lower()]:02d}-{int(m.group(1)):02d}"
    m = re.search(r"(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})",t,re.I)
    if m:
        return f"{m.group(3)}-{MONTH_NAME[m.group(1).lower()]:02d}-{int(m.group(2)):02d}"
    return ""

def parse_height(text):
    """Return height like 5'11\"."""
    t = str(text or "")
    # {{height|6|4}} or {{height|6|4|precision=0}}
    m = re.search(r"height\s*\|\s*(\d)\s*\|\s*(\d+)",t,re.I)
    if m:
        return f"{m.group(1)}'{m.group(2)}\""
    # {{convert|6|ft|4|in|...}} or ft=6|in=4
    m = re.search(r"convert\s*\|\s*(\d)\s*\|\s*ft\s*\|\s*(\d+)\s*\|\s*in",t,re.I)
    if m:
        return f"{m.group(1)}'{m.group(2)}\""
    m = re.search(r"ft\s*=\s*(\d+)[^|{}\n]*?in\s*=\s*(\d+)",t,re.I)
    if m:
        return f"{m.group(1)}'{m.group(2)}\""
    m = re.search(r"convert\s*\|\s*(\d+)\s*\|\s*cm",t,re.I)
    if m:
        tot = round(int(m.group(1))/2.54)
        return f"{tot//12}'{tot%12}\""
    m = re.search(r"(\d)\s*ft?\s*(\d+)\s*in",t,re.I)
    if m:
        return f"{m.group(1)}'{m.group(2)}\""
    m = re.search(r"(\d)'(\d{1,2})\"?",t)
    if m:
        return f"{m.group(1)}'{m.group(2)}\""
    return ""

def parse_reach(text):
    """Return reach like 70\"."""
    t = str(text or "")
    # Fraction format: 84+1/2 in
    m = re.search(r"(\d+)\+(\d+)/(\d+)", t)
    if m:
        val = round(int(m.group(1)) + int(m.group(2))/int(m.group(3)), 1)
        return f'{val}"'
    m = re.search(r"convert\s*\|\s*(\d+(?:\.\d+)?)\s*\|\s*in",t,re.I)
    if m:
        return f'{m.group(1)}"'
    m = re.search(r"(\d+(?:\.\d+)?)\s*in",t,re.I)
    if m:
        return f'{m.group(1)}"'
    m = re.search(r"(\d+(?:\.\d+)?)\s*cm",t,re.I)
    if m:
        v = round(float(m.group(1))/2.54,1)
        return f'{v}"'
    return ""

def parse_stance(text):
    t = strip_wt(str(text or "")).lower()
    if "orthodox" in t:  return "Orthodox"
    if "southpaw" in t:  return "Southpaw"
    if "switch"   in t:  return "Switch"
    return ""

def get_infobox_field(wikitext, *keys):
    """
    Extract the raw value of an infobox parameter by key name.
    Stops only at lines starting with | followed by a letter (next infobox field),
    NOT at | followed by a digit (which is a template positional arg on its own line).
    """
    for key in keys:
        m = re.search(
            rf"\|\s*{re.escape(key)}\s*=\s*(.*?)(?=\n\s*\|\s*[a-zA-Z_]|\Z)",
            wikitext, re.DOTALL | re.I
        )
        if m:
            val = m.group(1).strip()
            if val:
                return val
    return ""


# ── infobox parsing ───────────────────────────────────────────────────────────
def _pick_current_team(raw):
    """
    Given a raw wikitext team field (may contain multiple entries via <br>,
    {{ubl|...}}, bullet lines, or plain text), return the current team name.
    Strategy: strip markup, split into entries, drop any marked "(former)",
    return the last remaining entry (most recent).
    """
    t = str(raw or "")

    # Unwrap {{ubl|A|B}} or multiline {{ubl\n|A\n|B\n}} → one entry per line
    # Handles both inline (| immediately after ubl) and multiline (newline then |)
    ubl_m = re.search(r"\{\{ubl\b\s*\|?(.*?)(?:\}\}|$)", t, re.DOTALL | re.I)
    if ubl_m:
        inner = ubl_m.group(1)
        entries = [e.strip() for e in re.split(r"\n?\s*\|", inner) if e.strip()]
        t = "\n".join(entries)

    # Normalize <br> to newline
    t = re.sub(r"<br\s*/?>", "\n", t)

    # Split on <br>, newlines, asterisk bullets
    parts = re.split(r"\n\s*\*|\n", t)

    cleaned = []
    for p in parts:
        p = strip_wt(p)
        if not p:
            continue
        # Skip entries explicitly marked as former
        if re.search(r"\b(former|previously|past)\b", p, re.I):
            continue
        cleaned.append(p)

    if not cleaned:
        # All marked former — fall back to last raw entry
        parts2 = [strip_wt(p) for p in re.split(r"<br\s*/?>|\n\s*\*|\n", str(raw or ""))]
        cleaned = [p for p in parts2 if p]

    result = cleaned[-1][:100] if cleaned else ""
    # If we still have unresolved template markup, return blank rather than junk
    if re.search(r"\{\{|\}\}", result):
        return ""
    return result


def parse_infobox(wikitext):
    """Extract bio fields from the infobox. Returns dict."""
    bio = {"height":"","dob":"","reach":"","stance":"","gym":""}

    # Isolate the infobox block (between {{ and matching }})
    m = re.search(r"\{\{\s*[Ii]nfobox\s+(?:martial artist|MMA|fighter|boxer|wrestler)[^}]",
                  wikitext)
    if not m:
        return bio
    start = m.start()
    # Walk forward matching braces to find end
    depth, pos = 0, start
    end = start
    for i in range(start, min(start+60000, len(wikitext))):
        c = wikitext[i]
        if wikitext[i:i+2] == "{{":
            depth += 1
        elif wikitext[i:i+2] == "}}":
            depth -= 1
            if depth == 0:
                end = i+2
                break
    box = wikitext[start:end]

    # Height: try combined field first, then ft+in pair
    bio["height"] = parse_height(get_infobox_field(box, "height","height_cm","height_m"))
    if not bio["height"]:
        ft_raw = get_infobox_field(box, "height_ft","height_feet")
        in_raw = get_infobox_field(box, "height_in","height_inches")
        ft_m   = re.search(r"(\d+)", ft_raw)
        in_m   = re.search(r"(\d+)", in_raw)
        if ft_m and in_m:
            bio["height"] = f"{ft_m.group(1)}'{in_m.group(1)}\""

    bio["dob"]    = parse_dob(get_infobox_field(box, "birth_date","birthdate","date_of_birth"))

    # Reach: try combined field, then reach_in (handles fractions like 84+1/2)
    bio["reach"]  = parse_reach(get_infobox_field(box, "reach","reach_cm"))
    if not bio["reach"]:
        reach_in_raw = get_infobox_field(box, "reach_in","reach_inches")
        if reach_in_raw:
            bio["reach"] = parse_reach(reach_in_raw + " in")  # add unit so parse_reach picks it up

    bio["stance"] = parse_stance(get_infobox_field(box, "stance","style","fighting_style","striking_style"))

    # Try team/gym fields first; fall back to trainer/coach only if nothing found
    team_raw = get_infobox_field(box, "team","training_team","gym","fighting_out_of")
    if team_raw:
        bio["gym"] = _pick_current_team(team_raw)
    else:
        trainer_raw = get_infobox_field(box, "trainer","coach")
        if trainer_raw:
            bio["gym"] = strip_wt(trainer_raw)[:100]

    return bio


# ── fight-record table parsing ────────────────────────────────────────────────
def _parse_table(table):
    """Parse a single wikitable string into a list of fight dicts."""
    fights = []
    rows = re.split(r"\n\s*\|-", table)

    # ── detect column order from headers ──
    col = {}
    for row in rows[:8]:
        hdrs = re.findall(r"!(?:[^!|\n]*\|)?\s*([^!|\n]+)", row)
        if not hdrs:
            continue
        for i, h in enumerate(hdrs):
            hc = strip_wt(h).lower().strip().rstrip(".")
            if   re.search(r"\bres\b|result",    hc): col.setdefault("result",   i)
            elif re.search(r"\brecord\b",         hc): col.setdefault("record",   i)
            elif re.search(r"\bopponent\b",       hc): col.setdefault("opponent", i)
            elif re.search(r"\bmethod|type\b",    hc): col.setdefault("method",   i)
            elif re.search(r"\bevent\b",          hc): col.setdefault("event",    i)
            elif re.search(r"\bdate\b",           hc): col.setdefault("date",     i)
            elif re.search(r"\bround|rd\b",       hc): col.setdefault("round",    i)
            elif re.search(r"\btime\b",           hc): col.setdefault("time",     i)
            elif re.search(r"\bnotes?\b",         hc): col.setdefault("notes",    i)
        if col:
            break

    # Fallback: most Wikipedia MMA tables lead with a "#" column (result at index 1)
    if not col:
        for k,v in {"result":1,"record":2,"opponent":3,"method":4,"event":5,"date":6,"round":7,"time":8}.items():
            col[k] = v
    else:
        for k,v in {"result":1,"record":2,"opponent":3,"method":4,"event":5,"date":6,"round":7,"time":8}.items():
            col.setdefault(k, v)

    for row in rows[1:]:
        if not row.strip():
            continue

        # Split cells on || (same-line) or \n| (one-per-line) format
        raw_parts = re.split(r"\|\|", row)
        if len(raw_parts) < 3:
            # Fall back to one-cell-per-line split: newline + | not followed by | or }
            raw_parts = re.split(r"\n\s*\|(?!\||\})", row)
        cells = []
        for part in raw_parts:
            part = re.sub(r"^\s*\|", "", part)
            part = re.sub(r'^(?:(?:[a-zA-Z-]+=(?:"[^"]*"|\'[^\']*\'|[^\s|]+))\s*)+\|', "", part).strip()
            cells.append(part)

        if len(cells) < 3:
            continue

        # Skip stats/summary rows — cells that look like template params (e.g. nc=0, ko-wins=5, title=...)
        if any(re.match(r'^[\w][\w-]*\s*=', c.strip()) for c in cells[:6]):
            continue

        def gc(key):
            i = col.get(key, -1)
            return cells[i] if 0 <= i < len(cells) else ""

        # Result
        res_raw = gc("result").lower()
        result = ""
        tm = re.search(r"\{\{\s*(win|loss|draw|nc|no\s*contest)\s*[|}]", res_raw, re.I)
        if tm:
            result = RESULT_TOKENS.get(tm.group(1).lower().replace(" ",""), "")
        if not result:
            for tok, letter in RESULT_TOKENS.items():
                if tok in res_raw:
                    result = letter
                    break
        if not result:
            continue

        opponent = strip_wt(gc("opponent")).strip()
        if not opponent or len(opponent) < 2:
            continue
        # Reject template-artifact rows (e.g. title-reign markers with "years=" or "}}")
        if re.search(r"years=|\}\}", opponent):
            continue

        method = re.sub(r"\s+"," ", strip_wt(gc("method"))).strip()
        method = re.sub(r"\(([a-z])", lambda m: "("+m.group(1).upper(), method)
        if re.search(r"years\s*=|\}\}", method):
            continue
        # Reject wrestling/amateur score rows (e.g. "6–8", "SV 6–8", "TB 3–2")
        if re.match(r"^(?:SV\s+|TB\s+|OT\s+)?\d+[\-–]\d+$", method.strip()):
            continue

        # Detect column shift: if "opponent" looks like a method (e.g. "Submission (choke)")
        # the row had a missing/empty cell that shifted everything left one column.
        # Reassign: opponent→method, method→event; opponent becomes unknown.
        METHOD_PAT = re.compile(r"^(TKO|KO|Submission|Decision|NC|No Contest|DQ|Draw)\b", re.I)
        if METHOD_PAT.match(opponent):
            event_raw  = strip_wt(gc("event")).strip()
            method     = re.sub(r"\s+"," ", opponent).strip()
            method     = re.sub(r"\(([a-z])", lambda m: "("+m.group(1).upper(), method)
            event_raw2 = re.sub(r"\s+"," ", strip_wt(gc("method"))).strip()
            opponent   = ""   # actual opponent unknown for this row
            # Use what was "method" as event (it's the event name)
            event = re.sub(r"\s*\([^)]*(?:title|debut|belt|champ|interim|superfight)[^)]*\)\s*$",
                            "", event_raw2, flags=re.I).strip()
        else:
            event = None  # set below

        # Skip amateur bouts (notes column contains "amateur")
        if re.search(r"\bamateur\b", gc("notes"), re.I):
            continue

        if event is None:
            event = strip_wt(gc("event")).strip()
        event = re.sub(r"\s*\([^)]*(?:title|debut|belt|champ|interim|superfight)[^)]*\)\s*$",
                        "", event, flags=re.I).strip()
        org   = infer_org(event)

        date_raw = gc("date")
        date_str = parse_date(date_raw)
        if not date_str and _DEBUG_CELLS:
            print(f"  [cells] {len(cells)} cells, col={col}")
            for ci, cv in enumerate(cells):
                print(f"    [{ci}] {repr(cv[:80])}")
            print(f"    date raw: {repr(date_raw[:80])}")
        rnd  = strip_wt(gc("round")).strip()
        tim  = strip_wt(gc("time")).strip()
        # If attribute prefix wasn't stripped (e.g. "align*center|3"), take last segment
        if "|" in rnd: rnd = rnd.split("|")[-1].strip()
        if "|" in tim: tim = tim.split("|")[-1].strip()

        # Guard against column misdetection: if round looks like a time (m:ss)
        # and time looks like a location, the table had an extra column (e.g. location)
        # that shifted the indices. Swap them back.
        if re.match(r"^\d+:\d{2}$", rnd) and not re.match(r"^\d+:\d{2}$", tim):
            rnd, tim = tim, rnd
        # If round doesn't look like a number, it's a misread location/text — clear it
        if rnd and not re.match(r"^\d{1,2}$", rnd):
            rnd = ""

        fights.append({
            "date":date_str, "result":result, "opponent":opponent,
            "method":method, "event":event, "org":org,
            "round":rnd, "time":tim,
        })

    return fights


def _extract_mma_section(wikitext):
    """
    Try to narrow wikitext to just the MMA/Professional record section.
    Returns the section text if found, otherwise the full wikitext.
    Avoids picking up wrestling/grappling/NCAA record tables on the same page.
    """
    # Match headings like "== Mixed martial arts record ==", "== Professional record ==",
    # "== MMA record ==". Excludes "== NCAA record ==", "== Freestyle record ==", etc.
    MMA_SECTION_RE = re.compile(
        r"^(={2,4})\s*(?:(?:professional|pro|mma|mixed\s+martial\s+arts)\s+)?record\s*\1\s*$",
        re.MULTILINE | re.I
    )
    m = MMA_SECTION_RE.search(wikitext)
    if not m:
        return wikitext
    level = len(m.group(1))
    # End at next heading of same or higher level
    end_re = re.compile(r"^={2," + str(level) + r"}[^=]", re.MULTILINE)
    end_m  = end_re.search(wikitext, m.end())
    section = wikitext[m.start() : end_m.start() if end_m else len(wikitext)]

    # Within the section, strip any amateur or exhibition subsection (and everything after it)
    amateur_m = re.search(r"^={2,4}\s*(?:amateur|exhibition)", section, re.MULTILINE | re.I)
    if amateur_m:
        section = section[:amateur_m.start()]

    return section


def parse_fight_record(wikitext):
    """
    Parse the professional MMA record wikitable.
    Narrows to the MMA record section when possible to avoid picking up
    wrestling/grappling tables on pages with multiple record sections.
    Returns list of fight dicts (most-recent first).
    """
    section = _extract_mma_section(wikitext)

    # Find all {|...|} wikitables in the section
    # Walk brace depth so nested tables don't truncate early
    tables = []
    i = 0
    while i < len(section):
        if section[i:i+2] == "{|":
            depth, start = 1, i
            j = i + 2
            while j < len(section) and depth > 0:
                if section[j:j+2] == "{|":
                    depth += 1; j += 2
                elif section[j:j+2] == "|}":
                    depth -= 1; j += 2
                else:
                    j += 1
            tables.append(section[start:j])
            i = j
        else:
            i += 1

    # Collect best wikitable result — score by MMA-method rows, not total rows.
    # This avoids picking wrestling/grappling tables on pages with multiple record tables.
    MMA_METHOD_RE = re.compile(
        r"^(TKO|KO|Knockout|Submission|Decision\s*[\(\|]|NC|No Contest|DQ|Disqualification|Draw|Could Not Continue|Doctor)\b",
        re.I
    )
    best_table      = []
    best_mma_score  = -1
    for table in tables:
        first_2k = table[:2000].lower()
        if not (re.search(r"!\s*(?:[^!|\n]*\|)?\s*(?:res\.?|result)", first_2k) and
                re.search(r"!\s*(?:[^!|\n]*\|)?\s*opponent", first_2k)):
            continue
        candidate = _parse_table(table)
        if not candidate:
            continue
        # Count rows with a recognisable MMA method signature
        mma_score = sum(1 for f in candidate if MMA_METHOD_RE.match(f.get("method", "")))
        if _DEBUG_CELLS:
            print(f"  [table] rows={len(candidate)} mma_score={mma_score} first_opponent={candidate[0].get('opponent','?')!r:.40}")
        if mma_score > best_mma_score or (mma_score == best_mma_score and len(candidate) > len(best_table)):
            best_table     = candidate
            best_mma_score = mma_score

    # Also try template-based parsers — always, not just as fallbacks
    # Some pages (Jon Jones) have a small grappling wikitable AND a large
    # {{MMA record start}} or {{MMA record win/loss}} block for the real MMA record
    tmpl_start = parse_mma_record_start(section)
    tmpl_named = parse_mma_record_templates(section)

    if _DEBUG_CELLS:
        print(f"  [parse_fight_record] best_table={len(best_table)}, tmpl_start={len(tmpl_start)}, tmpl_named={len(tmpl_named)}")

    # Prefer explicit MMA templates ({{MMA record start}}, {{MMA record win/loss}}) over
    # generic wikitables — wikitables can be wrestling/grappling records on the same page.
    # Only fall back to best_table if neither template parser found anything.
    tmpl_best = max(tmpl_start, tmpl_named, key=len)
    if tmpl_best:
        return tmpl_best
    return best_table


def parse_mma_record_start(wikitext):
    """
    Parse {{MMA record start}} ... {{MMA record end}} blocks.
    Each fight is a wikitable row (|-) with each cell on its own line.
    Result cell is {{yes2}}Win / {{no2}}Loss / etc.
    Date cell uses {{dts|format=dmy|YYYY|Month|DD}}.
    Column order: result | record | opponent | method | event | date | round | time | location | notes
    """
    fights = []

    start_m = re.search(r"\{\{MMA record start[^}]*\}\}", wikitext, re.I)
    if not start_m:
        return fights
    # Accept either {{MMA record end}} or plain {{end}} as the block terminator.
    # Many Wikipedia pages close the table with {{end}} rather than {{MMA record end}},
    # and without this, block_end falls back to len(wikitext), swallowing any
    # subsequent amateur/grappling table that also lives in the MMA section.
    end_pat = re.compile(r"\{\{(?:MMA record end|end)[^}]*\}\}", re.I)
    end_m = end_pat.search(wikitext, start_m.end())
    block_end = end_m.start() if end_m else len(wikitext)
    block = wikitext[start_m.end():block_end]

    if _DEBUG_CELLS:
        # Show any MMA record section markers
        for sm in re.finditer(r"\{\{MMA record[^}]*\}\}", block, re.I):
            print(f"  [tmpl marker] {repr(sm.group()[:120])}")
        # Show rows 28-40 to find the pro→amateur transition
        rows_preview = re.split(r"\n\s*\|-", block)
        print(f"  [tmpl block] {len(rows_preview)} rows total")
        for ri, rp in enumerate(rows_preview[28:42], start=28):
            print(f"  [row {ri}] {repr(rp[:200])}")

    in_amateur_section = False
    for row in re.split(r"\n\s*\|-", block):
        if not row.strip():
            continue

        # Detect {{MMA record section|...}} dividers — hard skip for amateur sections
        # (explicit Wikipedia template, reliable)
        sec_m = re.search(r"\{\{MMA record section\s*\|([^}]*)\}\}", row, re.I)
        if sec_m:
            in_amateur_section = "amateur" in sec_m.group(1).lower()
            continue
        if in_amateur_section:
            continue

        # Detect wikitext section heading for amateur record — stop here
        if re.search(r"==+\s*amateur", row, re.I):
            break

        # Each cell is on its own line starting with |
        cells = []
        for line in row.split('\n'):
            line = line.strip()
            if not line.startswith('|') or line.startswith('||'):
                continue
            cell = line[1:].strip()
            # Strip wiki cell attributes: align=center|VALUE or style="..."|VALUE
            cell = re.sub(r'^(?:[a-zA-Z-]+=(?:"[^"]*"|[^\s|]+)\s*)+\|', "", cell).strip()
            cells.append(cell)

        if len(cells) < 3:
            continue

        # Skip stats/summary rows — cells that look like template params (e.g. nc=0, ko-wins=5, title=...)
        if any(re.match(r'^[\w][\w-]*\s*=', c.strip()) for c in cells[:6]):
            continue

        # Result (index 0): {{yes2}}Win, {{no2}}Loss, {{draw2}}, {{nc2}}, etc.
        res = cells[0].lower()
        if   re.search(r"yes2|{{win|align.*win|\bwin\b",  res): result = "W"
        elif re.search(r"no2|{{loss|align.*loss|\bloss\b", res): result = "L"
        elif re.search(r"draw",                            res): result = "D"
        elif re.search(r"nc2|no.?contest",                 res): result = "NC"
        else: continue

        opponent = strip_wt(cells[2] if len(cells) > 2 else "").strip()
        if not opponent or len(opponent) < 2:
            continue
        if re.search(r"years=|\}\}", opponent):
            continue

        method = re.sub(r"\s+"," ", strip_wt(cells[3] if len(cells) > 3 else "")).strip()
        method = re.sub(r"\(([a-z])", lambda m: "("+m.group(1).upper(), method)
        if re.search(r"years\s*=|\}\}", method):
            continue
        # Reject wrestling/amateur score rows (e.g. "6–8", "SV 6–8", "TB 3–2")
        if re.match(r"^(?:SV\s+|TB\s+|OT\s+)?\d+[\-–]\d+$", method.strip()):
            continue

        # Detect column shift: if "opponent" looks like a method, a missing cell shifted
        # everything left. Reassign: opponent→method, cells[3]→event; opponent = unknown.
        METHOD_PAT = re.compile(r"^(TKO|KO|Submission|Decision|NC|No Contest|DQ|Draw)\b", re.I)
        if METHOD_PAT.match(opponent):
            method   = re.sub(r"\s+"," ", opponent).strip()
            method   = re.sub(r"\(([a-z])", lambda m: "("+m.group(1).upper(), method)
            event_s  = strip_wt(cells[3] if len(cells) > 3 else "").strip()
            opponent = ""
        else:
            event_s  = strip_wt(cells[4] if len(cells) > 4 else "").strip()

        event = re.sub(r"\s*\([^)]*(?:title|debut|belt|champ|interim)[^)]*\)\s*$","",event_s,flags=re.I).strip()

        # Skip amateur bouts — check all trailing cells (index 8+) since notes column
        # position varies by table (some tables have Location col, shifting notes from 8→9)
        notes_text = " ".join(cells[8:]) if len(cells) > 8 else ""
        if re.search(r"\bamateur\b", notes_text, re.I):
            continue

        date_raw = cells[5] if len(cells) > 5 else ""
        date_str = parse_date(date_raw)
        if not date_str and _DEBUG_CELLS:
            print(f"  [mma_record_start cells] {len(cells)} cells, opponent={opponent!r}")
            for ci, cv in enumerate(cells):
                print(f"    [{ci}] {repr(cv[:100])}")

        rnd = strip_wt(cells[6] if len(cells) > 6 else "").strip()
        tim = strip_wt(cells[7] if len(cells) > 7 else "").strip()
        # If attribute prefix wasn't stripped (e.g. "align*center|3"), take last segment
        if "|" in rnd: rnd = rnd.split("|")[-1].strip()
        if "|" in tim: tim = tim.split("|")[-1].strip()

        # If round looks like a time (m:ss) and time doesn't, columns shifted — swap
        if re.match(r"^\d+:\d{2}$", rnd) and not re.match(r"^\d+:\d{2}$", tim):
            rnd, tim = tim, rnd
        # If round doesn't look like a number, it's a misread location/text — clear it
        if rnd and not re.match(r"^\d{1,2}$", rnd):
            rnd = ""

        fights.append({
            "date":     date_str,
            "result":   result,
            "opponent": opponent,
            "method":   method,
            "event":    event,
            "org":      infer_org(event),
            "round":    rnd,
            "time":     tim,
        })

    return fights


def parse_mma_record_templates(wikitext):
    """
    Parse fight records stored as {{MMA record win|...}} / {{MMA record loss|...}}
    templates (used on high-profile Wikipedia pages instead of wikitables).
    Handles nested templates inside parameter values by walking braces.
    """
    fights = []
    RESULT_MAP = {"win":"W","loss":"L","draw":"D","nc":"NC","nocontest":"NC"}
    POSITIONAL  = ["date","opponent","method","event","round","time","notes"]

    i = 0
    while i < len(wikitext):
        if wikitext[i:i+2] != "{{":
            i += 1; continue

        # Grab template name (up to first | or })
        name_end = i + 2
        while name_end < len(wikitext) and wikitext[name_end] not in ('|', '}', '\n'):
            name_end += 1
        tname = wikitext[i+2:name_end].strip()
        rkey  = re.match(r"MMA\s+record\s+(win|loss|draw|nc|no\s*contest)\s*$", tname, re.I)
        if not rkey:
            i += 1; continue

        result = RESULT_MAP.get(rkey.group(1).lower().replace(" ",""), "")

        # Walk to closing }} respecting nesting
        depth, j = 1, name_end
        while j < len(wikitext) and depth > 0:
            if   wikitext[j:j+2] == "{{": depth += 1; j += 2
            elif wikitext[j:j+2] == "}}": depth -= 1; j += 2
            else:                          j += 1
        template_body = wikitext[name_end:j-2]

        # Split on | at depth 0
        parts, buf, d2 = [], "", 0
        for ch in template_body:
            if   ch == "{": d2 += 1; buf += ch
            elif ch == "}": d2 -= 1; buf += ch
            elif ch == "|" and d2 == 0:
                parts.append(buf); buf = ""
            else:
                buf += ch
        if buf: parts.append(buf)

        params = {}
        pos = 0
        for part in parts:
            part = part.strip()
            if not part: continue
            if "=" in part:
                k, _, v = part.partition("=")
                params[k.strip().lower()] = v.strip()
            else:
                if pos < len(POSITIONAL):
                    params[POSITIONAL[pos]] = part
                pos += 1

        opponent = strip_wt(params.get("opponent","")).strip()
        if not opponent or len(opponent) < 2:
            i = j; continue

        method = strip_wt(params.get("method","") or params.get("type","")).strip()
        event  = strip_wt(params.get("event","")).strip()
        event  = re.sub(r"\s*\([^)]*(?:title|debut|belt|champ|interim)[^)]*\)\s*$","",event,flags=re.I).strip()

        fights.append({
            "date":     parse_date(params.get("date","")),
            "result":   result,
            "opponent": opponent,
            "method":   method,
            "event":    event,
            "org":      infer_org(event),
            "round":    params.get("round","").strip(),
            "time":     params.get("time","").strip(),
        })
        i = j

    return fights


# ── output formatting ─────────────────────────────────────────────────────────
HEADER = """\
GILLYLAB FIGHTER DATA — auto-filled from Wikipedia
============================================================
Fields filled: height, dob, reach, stance, gym, full fight history.
Fill manually: odds, watch links, stats (slpm etc.), accolades.

Run script again with --start N to resume after an interruption.
============================================================

"""

def fmt_fighter(name, bio, fights):
    lines = [f"FIGHTER: {name}"]
    lines.append("  ACCOLADES:")
    lines.append("    (add one per line as: icon | title | detail)")
    lines.append("  BIO:")
    lines.append(f"    height: {bio.get('height','')}")
    lines.append(f"    dob: {bio.get('dob','')}")
    lines.append(f"    reach: {bio.get('reach','')}")
    lines.append(f"    stance: {bio.get('stance','')}")
    lines.append(f"    gym: {bio.get('gym','')}")
    lines.append("  STATS:")
    for stat in ["strikes landed/min","striking accuracy","strikes absorbed/min",
                 "striking defense","knockdowns landed","takedowns landed",
                 "takedown accuracy","takedown defense","submission average",
                 "finish rate","win streak"]:
        lines.append(f"    {stat}:")
    lines.append("  FIGHTS:")
    if fights:
        for f in fights:
            lines.append(f"    date: {f['date']}")
            lines.append(
                f"    result: {f['result']} | opponent: {f['opponent']} | "
                f"method: {f['method']} | round: {f['round']} | time: {f['time']}"
            )
            lines.append(f"    event: {f['event']} | org: {f['org']}")
            lines.append("    odds:")
            lines.append("    watch link:")
            lines.append("    ---")
    lines.append("")
    return "\n".join(lines)


# ── fighter name extraction ───────────────────────────────────────────────────
def extract_fighters(html_path):
    html = html_path.read_text(encoding="utf-8")
    return re.findall(r'\{\s*name:\s*"([^"]+)"', html)


# ── main ──────────────────────────────────────────────────────────────────────
def lookup(name):
    title = wiki_search(name)
    if not title:
        return {}, [], None
    time.sleep(DELAY)
    wt = wiki_wikitext(title)
    if not wt:
        return {}, [], title
    return parse_infobox(wt), parse_fight_record(wt), title

def main():
    ap = argparse.ArgumentParser(description="GillyLab Wikipedia autofill")
    ap.add_argument("--test",  metavar="NAME", help="Test a single fighter and print")
    ap.add_argument("--limit", metavar="N", type=int, help="Process at most N fighters")
    ap.add_argument("--start", metavar="N", type=int, default=0,
                    help="Skip first N fighters (use to resume)")
    ap.add_argument("--debug", action="store_true",
                    help="Print raw wikitext snippets to diagnose parsing issues")
    args = ap.parse_args()

    fighters = extract_fighters(INDEX_HTML)
    if not fighters:
        sys.exit(f"Could not read FIGHTERS from {INDEX_HTML}")

    # ── single-fighter test mode ──
    if args.test:
        name = args.test
        if name in WIKIPEDIA_SKIP:
            print(f"⚠️  {name} is in WIKIPEDIA_SKIP — Wikipedia page mixes non-MMA records.")
            print("   Remove from WIKIPEDIA_SKIP in gillylab_wikipedia_fill.py to force a lookup.")
            return
        print(f"\n{'='*60}\nLooking up: {name}\n{'='*60}")
        title = wiki_search(name)
        print(f"Wikipedia page : {title or 'NOT FOUND'}")
        if not title:
            return
        time.sleep(DELAY)
        wt = wiki_wikitext(title)
        if not wt:
            print("Could not fetch wikitext.")
            return

        if args.debug:
            global _DEBUG_CELLS
            _DEBUG_CELLS = True

        if args.debug:
            # ── raw birth_date field ──
            dob_raw = get_infobox_field(wt, "birth_date","birthdate","date_of_birth")
            print(f"\n[DEBUG] birth_date field raw: {repr(dob_raw[:200])}")

            # ── all wikitables found ──
            tables_found = []
            i = 0
            while i < len(wt):
                if wt[i:i+2] == "{|":
                    depth, start = 1, i
                    j = i + 2
                    while j < len(wt) and depth > 0:
                        if wt[j:j+2] == "{|":  depth += 1; j += 2
                        elif wt[j:j+2] == "|}": depth -= 1; j += 2
                        else: j += 1
                    tables_found.append(wt[start:j])
                    i = j
                else:
                    i += 1

            print(f"\n[DEBUG] Total wikitables found in page: {len(tables_found)}")
            for ti, tbl in enumerate(tables_found):
                first = tbl[:300].lower()
                has_res = bool(re.search(r"res\.?|result", first))
                has_opp = bool(re.search(r"opponent", first))
                print(f"  Table {ti+1}: {len(tbl)} chars | has_res={has_res} | has_opp={has_opp}")
                if has_res or has_opp:
                    print(f"    First 400 chars:\n{tbl[:400]}\n")

            # ── MMA record templates ──
            mma_hits = [(m.start(), m.group(0)) for m in re.finditer(r"\{\{MMA record[^}]{0,40}", wt, re.I)]
            print(f"\n[DEBUG] {{{{MMA record}}}} template hits: {len(mma_hits)}")
            for pos, snippet in mma_hits[:3]:
                print(f"  pos {pos}: {repr(snippet)}")
            # Show 1500 chars from the first MMA record hit
            if mma_hits:
                start_pos = mma_hits[0][0]
                print(f"\n[DEBUG] Wikitext from pos {start_pos} (1500 chars):")
                print(wt[start_pos:start_pos+1500])

            # ── all headings (to see page structure) ──
            print("\n[DEBUG] All section headings:")
            for m in re.finditer(r"==+[^=\n]+==+", wt):
                print(f"  {m.group(0).strip()}")

            # ── first 300 chars after the record heading ──
            sec_m = re.search(r"==+[^=\n]*(?:record|career)[^=\n]*==+", wt, re.I)
            if sec_m:
                print(f"\n[DEBUG] Record heading: {sec_m.group(0).strip()}")
                after = wt[sec_m.end():sec_m.end()+400]
                print(f"[DEBUG] Content after heading:\n{after}")

        if args.debug:
            # ── raw infobox field values ──
            from functools import partial
            _gf = partial(get_infobox_field, wt)
            print("\n[DEBUG] Raw infobox fields:")
            for fld in ["height","height_in","height_cm","reach","reach_in","team","training_team","gym","trainer","coach","birth_date"]:
                raw = _gf(fld)
                print(f"  {fld}: {repr(raw[:120]) if raw else '(empty)'}")

        bio    = parse_infobox(wt)
        fights = parse_fight_record(wt)
        print(f"Bio            : {bio}")
        print(f"Fights found   : {len(fights)}")
        for f in fights[:6]:
            print(f"  {f['date']:<14} {f['result']}  {f['opponent']:<22} {f['method']:<25} {f['event']}")
        if len(fights) > 6:
            print(f"  ... ({len(fights)-6} more)")
        print("\n--- Formatted block ---")
        print(fmt_fighter(name, bio, fights))
        return

    # ── batch mode ──
    fighters = fighters[args.start:]
    if args.limit:
        fighters = fighters[:args.limit]
    total = len(fighters)

    print(f"Processing {total} fighters (starting at #{args.start+1})")
    print(f"Output → {OUT_FILE.name}    Log → {LOG_FILE.name}")
    print("(Ctrl-C to stop; re-run with --start N to resume)\n")

    log_lines = []
    out_blocks = [HEADER] if args.start == 0 else []

    # Append mode when resuming
    write_mode = "w" if args.start == 0 else "a"

    with OUT_FILE.open(write_mode, encoding="utf-8") as out_f, \
         LOG_FILE.open(write_mode, encoding="utf-8") as log_f:

        for i, name in enumerate(fighters, args.start+1):
            if name in WIKIPEDIA_SKIP:
                print(f"[{i:>4}/{args.start+total}] {name} ... SKIPPED (in WIKIPEDIA_SKIP)")
                block = fmt_fighter(name, {}, [])
                out_f.write(block + "\n")
                out_f.flush()
                log_f.write(f"{name:<35} SKIPPED (WIKIPEDIA_SKIP)\n")
                log_f.flush()
                continue
            print(f"[{i:>4}/{args.start+total}] {name} ...", end=" ", flush=True)
            try:
                bio, fights, title = lookup(name)
                note = f"wiki: {title or 'NOT FOUND'} | fights: {len(fights)}"
                print(f"{len(fights)} fights  ({title or 'NOT FOUND'})")
            except KeyboardInterrupt:
                print(f"\nInterrupted at fighter #{i}. Re-run with --start {i-1} to resume.")
                sys.exit(0)
            except Exception as e:
                bio, fights, title = {}, [], None
                note = f"ERROR: {e}"
                print(f"ERROR: {e}")

            block = fmt_fighter(name, bio, fights)
            out_f.write(block + "\n")
            out_f.flush()
            log_f.write(f"{name:<35} {note}\n")
            log_f.flush()

    # Summary
    with LOG_FILE.open(encoding="utf-8") as lf:
        all_lines = lf.readlines()
    found     = sum(1 for l in all_lines if "NOT FOUND" not in l and "ERROR" not in l)
    no_fights = sum(1 for l in all_lines if "fights: 0" in l)
    print(f"\nDone.")
    print(f"  {found}/{len(all_lines)} fighters found on Wikipedia")
    print(f"  {no_fights} found but had 0 parseable fights")
    print(f"  Output → {OUT_FILE}")
    print(f"  Log    → {LOG_FILE}")

if __name__ == "__main__":
    main()
