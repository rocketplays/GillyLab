#!/usr/bin/env python3
"""
gillylab_wikipedia_accolades.py
───────────────────────────────
ACCOLADES-ONLY Wikipedia scraper. For every roster fighter that currently has
NO ACCOLADES entry in index.html, this looks up their Wikipedia article and
extracts ONLY their honours:

  • belt ranks / dan grades / Master of Sport   (infobox 'rank'/'wrestling')  🥋 🤼 🥊
  • the "Championships and accomplishments" list (titles, awards, records)     🏆 ⭐ 🏅
  • competition medals (wrestling / BJJ / sambo / Olympic)                     🥇 🥈 🥉

It DOES NOT touch bio, stats, or fight records — it only produces an accolades
JSON. Applying it (gillylab_apply_accolades.py) only edits the ACCOLADES object.

It reuses the tuned page-resolution + parsers from gillylab_wikipedia_fill.py
(wiki_search, wiki_wikitext, parse_ranks, parse_competitive_accolades, etc.).

Setup (one-time):   pip3 install requests

Usage:
    python3 gillylab_wikipedia_accolades.py                 # all fighters missing accolades
    python3 gillylab_wikipedia_accolades.py --test "Kenny Florian"   # one fighter, print only
    python3 gillylab_wikipedia_accolades.py --limit 50               # first 50 targets
    python3 gillylab_wikipedia_accolades.py --start 500 --limit 500  # resume window
    python3 gillylab_wikipedia_accolades.py --all                    # ALL fighters (re-scrape)

Output (appended incrementally so you can stop/resume):
    accolades_wikipedia.json   { "Fighter Name": [ {icon,title,detail}, ... ], ... }
    accolades_wikipedia.log    per-fighter notes (found N / no page / no accolades)
"""
import re, sys, json, time, argparse, html
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
INDEX_HTML = SCRIPT_DIR / "index.html"
OUT_JSON   = SCRIPT_DIR / "accolades_wikipedia.json"
LOG_FILE   = SCRIPT_DIR / "accolades_wikipedia.log"

# Reuse the tuned fetch + parsers from the existing fill script.
try:
    from gillylab_wikipedia_fill import (
        wiki_search, wiki_wikitext, strip_wt,
        parse_ranks, parse_competitive_accolades, WIKIPEDIA_MANUAL, DELAY,
    )
except ImportError as e:
    sys.exit("Need gillylab_wikipedia_fill.py alongside this script (and `pip3 install requests`).\n" + str(e))

# ── read the roster + which fighters already have accolades ───────────────────
def _balanced(src, start_brace):
    depth, i, in_str, q, esc = 0, start_brace, False, "", False
    while i < len(src):
        c = src[i]
        if in_str:
            if esc: esc = False
            elif c == "\\": esc = True
            elif c == q: in_str = False
        elif c in "\"'`": in_str, q = True, c
        elif c == "{": depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0: return src[start_brace:i+1]
        i += 1
    raise ValueError("unbalanced")

def load_targets(scrape_all=False):
    html = INDEX_HTML.read_text(encoding="utf-8")
    roster = []
    for m in re.finditer(r'\{ name: "((?:[^"\\]|\\.)*)", division:', html):
        roster.append(m.group(1))
    s = html.index("const ACCOLADES = {")
    block = _balanced(html, html.index("{", s))
    have = set(re.findall(r'(?m)^  "((?:[^"\\]|\\.)*)":\s*\[', block))
    # de-dup roster, preserve order
    seen, ordered = set(), []
    for n in roster:
        if n not in seen:
            seen.add(n); ordered.append(n)
    if scrape_all:
        return ordered, have
    return [n for n in ordered if n not in have], have

# ── "Championships and accomplishments" section parser (the missing piece) ────
# Match the HONOURS section by its full heading name — NOT a bare substring.
# Fighter articles are full of career headings like "Ultimate Fighting
# Championship" or "Winning and losing the Welterweight Championship"; a substring
# match on "championship"/"title" would latch onto those and never reach the real
# honours list (this is exactly what dropped every accolade for Georges St-Pierre).
_HEADING = re.compile(
    r'^\s*(?:'
    r'championships?\s+and\s+(?:accomplishments?|achievements?)'
    r'|titles?\s+and\s+(?:accomplishments?|achievements?)'
    r'|accomplishments?|achievements?|accolades?'
    r'|awards?\s+and\s+hono(?:u)?rs?|hono(?:u)?rs?\s+and\s+awards?'
    r'|hono(?:u)?rs?|awards?'
    r')\s*$', re.I)

def _section_lines(wikitext):
    """Lines inside the honours-type section. Keeps capturing through DEEPER
    sub-headings (e.g. '===Mixed martial arts===' under
    '==Championships and accomplishments==', as on Georges St-Pierre's page) and
    only stops at the next heading of the same level or shallower."""
    out, capturing, start_level = [], False, 0
    for ln in wikitext.split("\n"):
        h = re.match(r'^\s*(={2,})\s*(.+?)\s*\1\s*$', ln)
        if h:
            level = len(h.group(1))
            if not capturing:
                if _HEADING.search(h.group(2)):
                    capturing, start_level = True, level
                continue
            # already capturing …
            if level > start_level:
                continue                         # deeper sub-heading — stay in section
            if _HEADING.search(h.group(2)):
                start_level = level              # another honours heading — keep going
                continue
            break                                # same/shallower non-honours heading — done
        elif capturing:
            out.append(ln)
    return out

def _acc_icon(text):
    t = text.lower()
    # Drop parenthetical qualifiers before the record test so a title like
    # "Interim UFC Welterweight Championship (One time, first)" isn't misread as a
    # record just because the note says "first".
    core = re.sub(r'\([^)]*\)', ' ', t)
    if re.search(r'of the night|performance bonus|\bbonus(es)?\b', t):           return '⭐'
    if 'hall of fame' in t:                                                      return '🏅'
    # Explicit competition medals / runner-up → medal icons (e.g. "2007 Wrestling
    # World Championships Bronze Medalist", "NCAA … National Runner-up").
    if re.search(r'medall?ist|runner[\s-]?up', t):
        if 'gold' in t:   return '🥇'
        if 'bronze' in t: return '🥉'
        return '🥈'   # silver medalist or runner-up
    # Records/statistical firsts read as 🏅 even when they mention a "title" —
    # incl. distinctions like "holds wins over … champions".
    if re.search(r'\b(most|longest|fastest|youngest|oldest|record|records|only|first'
                 r'|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\b'
                 r'|wins over|victories over|\bholds\b', core):
        return '🏅'
    if re.search(r'\bchampion(ship)?s?\b|\btitle\b|\bbelt\b|interim', core) and 'of the year' not in t:
        return '🏆'
    if re.search(r'wrestl|grappl|\bncaa\b|all.?american|freestyle|greco|olympic', t):
        return '🤼'
    return '🏅'  # awards, "of the year", Hall of Fame, everything else

# An honours section mixes real accolades with a long tail of media/publication
# poll awards ("Fighter of the Year", "Greatest of All Time", "Athlete of the
# Year") and statistical-leaderboard positions ("Nth most takedowns in UFC
# history"). We keep ONLY institutional accolades: promotion/org titles (🏆),
# post-fight bonuses (⭐), grappling/wrestling honours (🤼) and Hall of Fame
# inductions. (Competition medals and belt ranks come from the other parsers and
# are unaffected.)
# Media/publication outlets that run their own "of the year" polls and media
# halls of fame (e.g. Sherdog's "Mixed Martial Arts Hall of Fame", which is NOT
# the institutional UFC Hall of Fame). Everything grouped under one of these org
# headers is a media accolade and is dropped wholesale.
_MEDIA_ORG = re.compile(
    r'sherdog|bleacher report|sports illustrated|\bespn\b|fox sports|yahoo'
    r'|mma\s*junkie|wrestling observer|world mma awards|sportsnet'
    r'|black belt magazine|\bthe ring\b|usa today|fighters only|inside mma'
    r'|\bcbs\b|pro-?wrestling', re.I)

def _keep_honour(title, icon, org):
    if _MEDIA_ORG.search(org or ''):
        return False   # media/publication outlet — poll awards & media halls of fame
    return icon in ('🏆', '⭐', '🤼', '🥇', '🥈', '🥉') or 'hall of fame' in title.lower()

def parse_championships(wikitext):
    results, seen, current_org = [], set(), ""
    for ln in _section_lines(wikitext):
        s = ln.strip()
        m = re.match(r'^(\*+)\s*(.*)$', s)
        if not m:
            continue
        depth, body = len(m.group(1)), m.group(2).strip()
        if depth >= 3:
            # depth-3+ is usually sub-notes ("Three successful title defenses"), but
            # some articles wrongly nest REAL titles there (Randy Couture's Light
            # Heavyweight titles). Keep a deep line only if it names a championship and
            # isn't a defense/reign/record note; the icon+keep filters handle the rest.
            if not re.search(r'champion|\btitle\b|\bbelt\b', body, re.I) \
                    or re.search(r'defen[sc]e|reign|successful|consecutive|overall|runner', body, re.I):
                continue
        # Drop leading belt/flag icons like [[File:Generic_belt_icon.svg|20x20px]]
        # so the cleaned title doesn't start with "20x20px …".
        body = re.sub(r'\[\[(?:File|Image):[^\]]*\]\]', '', body).strip()
        clean = strip_wt(body).strip().strip("'").strip()
        if not clean or len(clean) < 4:
            continue
        # A bold-only bullet ('''Org''') is an organisation header, not an accolade.
        if re.match(r"^'''.*'''$", body.strip()):
            if depth == 1:
                current_org = clean
            continue
        # Strip stray leading/trailing punctuation left by stripped templates/markup
        # (e.g. a trailing " or an em-dash before a name list that got removed).
        clean = clean.strip('"“”').strip(' -–—•·;,').strip()
        if len(clean) < 4:
            continue
        # Some depth-2 items only make sense with their org header, e.g.
        # "Class of 2023" under "Canada's Sports Hall of Fame", or "#2 Ranked …"
        # under a media outlet. Prepend the org so they read as real accolades.
        if current_org and re.match(r'(?i)^(class of\b|inducted\b|#\d)', clean) \
                and current_org.lower() not in clean.lower():
            clean = current_org + " — " + clean
        # BJJ/grappling competition placements ("… : 2nd Place") are covered — more
        # cleanly, with medal icons — by the medals template, so drop the messy
        # honours-prose versions.
        if re.search(r'\b\d+(?:st|nd|rd|th)\s+place\b', clean, re.I):
            continue
        # Pro-wrestling / media ranking lines ("Ranked No. 1 … PWI Women's 100") are
        # publication rankings, not athletic accolades.
        if re.search(r'\bpwi\b|ranked\s+no\.?\s*\d+\s+of\s+the\s+top', clean, re.I):
            continue
        # Defense-count sub-notes ("Three successful title defenses") and ceremonial
        # roles (Olympic torch/flag bearer) are not accolades.
        if re.search(r'\bsuccessful\b|\bdefen[sc]es?\b|\breign\b|torch\s?-?bearer|flag\s?-?bearer',
                     clean, re.I):
            continue
        icon = _acc_icon(clean)
        if not _keep_honour(clean, icon, current_org):   # drop media/poll awards & stat records
            continue
        key = re.sub(r'[^a-z0-9]+', ' ', clean.lower()).strip()
        if key in seen:
            continue
        seen.add(key)
        results.append({"icon": icon, "title": clean, "detail": None})
    return results

# ── post-fight bonuses from the record table (fallback for pages with no honours
#    section, e.g. Kenny Florian) ───────────────────────────────────────────────
# Each UFC post-fight bonus is one row in the "Mixed martial arts record" table's
# Notes column. We count the rows mentioning each bonus and emit a single ⭐
# accolade like "Fight of the Night (3×)" — matching the app's existing style.
_BONUSES = [
    ("Fight of the Night",        re.compile(r'fight of the night', re.I)),
    ("Performance of the Night",  re.compile(r'performance of the night', re.I)),
    ("Submission of the Night",   re.compile(r'submission of the night', re.I)),
    ("Knockout of the Night",     re.compile(r'knockout of the night', re.I)),
]
_REC_HEADING = re.compile(r'\brecord\b', re.I)

def _record_section(wikitext):
    """Lines inside == ... record ... == section(s), excluding exhibition records."""
    out, capturing = [], False
    for ln in wikitext.split("\n"):
        h = re.match(r'^\s*(={2,})\s*(.+?)\s*\1\s*$', ln)
        if h:
            title = h.group(2)
            capturing = bool(_REC_HEADING.search(title)) and 'exhibition' not in title.lower()
            continue
        if capturing:
            out.append(ln)
    return out

def parse_bonus_awards(wikitext):
    """Count post-fight bonuses from the record table's Notes cells → ⭐ entries."""
    rows = "\n".join(_record_section(wikitext)).split("|-")  # wikitable row separator
    results = []
    for label, rx in _BONUSES:
        n = sum(1 for row in rows if rx.search(row))
        if n:
            title = label if n == 1 else f"{label} ({n}×)"
            results.append({"icon": "⭐", "title": title, "detail": None})
    return results

# ── clean up infobox ranks (parse_ranks defaults unknown belts to 🏆) ─────────
_BELT_RE    = re.compile(r'\b(?:black|brown|purple|blue|white|red|coral)\s*belt\b|\bbelt\b|\b\d+(?:st|nd|rd|th)?\s*(?:degree|dan)\b|master of sport', re.I)
_STRIKE_ART = re.compile(r'karate|shotokan|shid[oō]kan|kyokushin|goju|kempo|kenpo|taekwondo|muay ?thai|kickbox|\bboxing\b|sanshou|sanda|savate|gaidojutsu|prajied', re.I)
_GRAPPLE_ART= re.compile(r'\bbjj\b|jiu.?jitsu|gracie|\bjudo\b|10th planet|luta livre|catch wrestling', re.I)
_WRESTLE_ART= re.compile(r'wrestl|sambo|\bncaa\b|all.?american|greco|freestyle', re.I)

def _clean_ranks(ranks):
    """Fix belt entries parse_ranks left as the 🏆 default, and re-attach orphan
    'under <coach>' fragments to the belt they belong to (e.g. GSP's BJJ rank)."""
    out = []
    for e in ranks:
        title = (e.get("title") or "").strip()
        if re.match(r'^under\b', title, re.I):        # orphan "under <coach>" line
            if out:
                out[-1]["title"] = out[-1]["title"].rstrip('. ').rstrip() + " " + title
            continue
        # A bare belt colour with no martial art ("Black belt") is uninformative —
        # drop it (a useful rank names the discipline, e.g. "… in Judo").
        if re.match(r'^(?:black|brown|purple|blue|white|red|coral)\s*belt\.?$', title, re.I):
            continue
        icon = e.get("icon")
        if re.search(r'master of sport', title, re.I):  # Soviet/Russian combat-sport title
            icon = "🤼"
        elif icon == "🏆" and _BELT_RE.search(title):   # a belt/dan misread as a title
            icon = ("🥋" if _GRAPPLE_ART.search(title)
                    else "🥊" if _STRIKE_ART.search(title)
                    else "🤼" if _WRESTLE_ART.search(title)
                    else "🥋")
        out.append({"icon": icon, "title": title, "detail": e.get("detail")})
    return out

# ── combine all accolade sources for one fighter ─────────────────────────────
def _bonus_type(title):
    """The bonus kind ('fight of the night', …) regardless of surrounding count or
    opponent notes, so an honours-listed bonus ("Fight of the Night (Two times) vs.
    …") and the record-table-derived one ("Fight of the Night (2×)") aren't both
    emitted."""
    m = re.search(r'(fight|performance|submission|knockout) of the night', title or '', re.I)
    return m.group(0).lower() if m else None

def _medal_sig(entry):
    """A (years, weight-kg, medal-colour) signature so the same medal listed both in
    the honours prose ("2009 World Combat Sambo Championships (−74 kg) Gold Medalist")
    and in the medals template ("WCSF World Championships — 2009 Kyiv — 74 kg") is
    recognised as one accolade. Returns None when it isn't a year+weight medal."""
    t = (entry.get("title") or "")
    tl = t.lower(); icon = entry.get("icon")
    yrs = re.findall(r'\b((?:19|20)\d\d)\b', t)
    kg  = re.search(r'(\d{2,3})\s*kg', tl)
    if not yrs or not kg:
        return None
    if icon == '🥇' or 'gold' in tl or 'champion' in tl:   colour = 'g'
    elif icon == '🥈' or 'silver' in tl or 'runner-up' in tl: colour = 's'
    elif icon == '🥉' or 'bronze' in tl:                    colour = 'b'
    else:                                                   colour = '?'
    return (frozenset(yrs), kg.group(1), colour)

# Generic words shared by many competition names — ignored when matching an
# honours competition result to a medal, so only the distinctive tokens (org
# acronyms like "ncaa"/"njcaa", event types like "cup"/"games", region words like
# "pan"/"american") decide a duplicate. Org acronyms and event/region words are
# deliberately NOT listed here.
_COMP_STOP = set(
    "championship championships champion champions title titles world national "
    "international senior junior regional collegiate open master masters adult "
    "men mens women womens weight division class team super light middle heavy welter "
    "feather absolute gold silver bronze medalist medallist runner place first second "
    "third fourth fifth invitational nationals the of in out and de kg lbs "
    "jiu jitsu jiujitsu submission wrestling grappling medio meio pesado pesada leve "
    "pena pluma galo alliance "
    # host cities / countries — only ever appear in the template, never the honours
    "janeiro rio california usa united states brazil brazilian los angeles newark "
    "moscow kyiv tashkent santo domingo maracaibo bismark bismarck rochester prague "
    "lisbon portugal iowa city lincoln stillwater oklahoma campos paulo sao são "
    "uzbekistan dominican republic spain".split())

def _comp_years(t): return frozenset(re.findall(r'(?:19|20)\d\d', t or ''))
def _comp_words(t):
    return frozenset(w for w in re.findall(r'[a-z]+', (t or '').lower())
                     if len(w) >= 3 and w not in _COMP_STOP)

def _medal_colour(entry):
    ic = entry.get("icon"); t = (entry.get("title") or "").lower()
    if ic == '🥇': return 'g'          # the icon is authoritative for template medals
    if ic == '🥈': return 's'
    if ic == '🥉': return 'b'
    if 'gold' in t or re.search(r'\bchampion', t):        return 'g'
    if 'silver' in t or re.search(r'runner[\s-]?up', t):  return 's'
    if 'bronze' in t:                                     return 'b'
    return '?'

def _honour_dups_medal(champ, medals):
    """A year-bearing honours competition result ("2005 Wrestling World Cup Silver
    Medalist", "2006 Pan American Champion") duplicates a template medal when they
    share a year, at least one distinctive competition token, and a compatible medal
    colour. Titles without a year (UFC/Strikeforce belts) never match."""
    cy, cw, cc = _comp_years(champ["title"]), _comp_words(champ["title"]), _medal_colour(champ)
    if not cy or not cw:
        return False
    for m in medals:
        if (cy & _comp_years(m["title"])) and (cw & _comp_words(m["title"])) \
                and (cc == _medal_colour(m) or cc == '?' or _medal_colour(m) == '?'):
            return True
    return False

# Only major competitions count as accolades — so a decorated judoka/wrestler's long
# amateur circuit doesn't bury their headline results. Applies to medal-type entries
# (🥇🥈🥉) only; titles, Hall of Fame, bonuses and belt ranks are never touched.
_MAJOR_COMP = re.compile(
    r'\bolympic|world championship|world judo championship|world wrestling championship'
    r'|\bworlds\b|world cup|world team|pan[\s-]?americ|european championship'
    r'|asian championship|african championship|oceania|commonwealth games|asian games'
    r'|european games|mediterranean games|grand slam|grand prix|\bmasters\b|continental'
    r'|national championship|\bnationals\b|team trials|\badcc\b|ibjjf', re.I)
_DEVELOPMENTAL = re.compile(r'\bjunior|\bcadet|\byouth\b|\bu-?\s?\d{2}\b|espoir|schoolboy|scholastic', re.I)
_MINOR_COMP = re.compile(r'\bopen\b|rendez[\s-]?vous|invitational|memorial|\bclassic\b|coupe|\bcup\b|ladies|international tournament', re.I)

def _drop_minor_medal(entry):
    if entry.get("icon") not in ('🥇', '🥈', '🥉'):
        return False                              # only filter competition medals
    t = entry.get("title") or ""
    if _DEVELOPMENTAL.search(t):
        return True                               # junior/cadet/youth — drop regardless
    if re.search(r'\((?:blue|purple|brown|white)\)', t, re.I):
        return True                               # pre-black-belt BJJ division — developmental
    if _MAJOR_COMP.search(t):
        return False                              # major senior competition — keep
    return bool(_MINOR_COMP.search(t))            # minor circuit event — drop

def collect(name):
    title = WIKIPEDIA_MANUAL.get(name) or wiki_search(name)
    if not title:
        return None, "no wikipedia page"
    wt = wiki_wikitext(title)
    if not wt:
        return None, f"page '{title}' had no content"
    ranks  = _clean_ranks(parse_ranks(wt))
    champs = parse_championships(wt)
    medals = parse_competitive_accolades(wt)
    # Prolific grapplers (e.g. Roger Gracie) summarise titles in the honours section
    # as "10× IBJJF World Champion" etc. Those "N×" summaries only cover their GOLD
    # medals, which the template then re-lists itemised by year — redundant. So when
    # such summaries exist, drop just the itemised golds and keep the silver/bronze
    # medals (still real medals, and not covered by the champion summaries).
    # Fighters with only a few medals have no "N×" summaries and keep the full list.
    if any(re.match(r'^\s*\d+\s*[x×]\s', c["title"]) for c in champs):
        medals = [m for m in medals if m.get("icon") != '🥇']
    # Prefer the structured medals template: drop any honours-prose championship
    # that duplicates a medal — by (year+weight+colour), or by competition name+year
    # for ones without a weight class (e.g. "2006 Pan American Champion").
    medal_sigs = set(filter(None, (_medal_sig(m) for m in medals)))
    champs = [c for c in champs
              if _medal_sig(c) not in medal_sigs and not _honour_dups_medal(c, medals)]
    # Keep only major-competition medals (drop junior/cadet + minor circuit events).
    champs = [c for c in champs if not _drop_minor_medal(c)]
    medals = [m for m in medals if not _drop_minor_medal(m)]
    primary = ranks + champs + medals
    have_bonus = set(filter(None, (_bonus_type(a["title"]) for a in primary)))
    extra = [a for a in parse_bonus_awards(wt) if _bonus_type(a["title"]) not in have_bonus]
    combined, seen = [], set()
    for acc in (primary + extra):
        clean = html.unescape(acc["title"]).replace('\xa0', ' ')   # decode &nbsp; etc.
        clean = re.sub(r'^[\s*:•·\-–—]+', '', clean)   # strip leftover leading bullet markers
        clean = re.sub(r'\{\{[^{}]*\}\}', '', clean)   # closed template remnants
        clean = re.sub(r'\{\{\S+', '', clean)          # dangling opener (e.g. "{{nbnd")
        clean = re.sub(r'\bOpen\s+kg\b', 'Open', clean, flags=re.I)   # "Open kg" → "Open"
        clean = re.sub(r'\s*[—–-]\s*$', '', clean)     # trailing separator w/ empty field
        clean = re.sub(r'\s+', ' ', clean).strip()
        # Drop junk that slipped through: bare org headers ("… Championship:"),
        # leaked citation fragments, and defense-count / ceremonial notes.
        if not clean or clean.endswith(':') or len(clean) < 4:
            continue
        if re.search(r'\|?\s*url\s*=|archive-url|access-?date|\bcite\b', clean, re.I):
            continue
        if re.search(r'\bsuccessful\b|\bdefen[sc]es?\b|torch\s?-?bearer|flag\s?-?bearer', clean, re.I):
            continue
        # Pro-wrestling titles (out of scope) and malformed table rows.
        if not re.search(r'\bUFC\b|\bMMA\b', clean) and re.search(
                r'\b(WWE|WWF|AEW|ROH|TNA|ECW|OVW|IWA|WCW|NJPW|IWC|LWF|SPCW|RCW|MPW|GWA|DWA'
                r'|POGW|NSWA|ATCW|NWA|LPW)\b|tag team|intercontinental cham|professional wrestling'
                r'|world heavyweight championship \(|triple crown|wrestler of the year|unrecogni[sz]ed',
                clean, re.I):
            continue
        if re.search(r'align=center|colspan|rowspan', clean, re.I) or re.match(r'^\d{4}\s*[—–-]\s*\d{4}\s*[—–-]', clean):
            continue
        clean = re.sub(r'\s+vs\.?\s*$', '', clean).strip()   # trailing "vs." w/ no names
        # bonus/stat-leaderboard record ("Most Post-Fight bonuses in UFC history") —
        # a count, not an award. Needs a countable stat so "… first in UFC history"
        # distinctions survive.
        if 'history' in clean.lower() \
                and re.search(r'\b(most|fewest|tied|highest|lowest|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\b', clean, re.I) \
                and re.search(r'bonus|award|\bwins?\b|knockout|takedown|strikes?|submission|finish|defen[sc]e|title fight|\bfights?\b|\breign', clean, re.I):
            continue
        acc = {**acc, "title": clean}
        k = re.sub(r'[^a-z0-9]+', ' ', clean.lower()).strip()
        if k and k not in seen:
            seen.add(k)
            combined.append(acc)
    # Order by importance before capping so a flood of minor tournament medals can't
    # push out the marquee accolades (belt ranks, MMA/org titles, Hall of Fame,
    # bonuses, Olympic/World-Championship medals). Stable sort keeps document order
    # within each tier.
    def _prio(e):
        t = e["title"].lower(); ic = e["icon"]
        if ic in ('🥋', '🥊'):                            return 0   # belt / striking ranks
        if 'hall of fame' in t:                           return 1
        if ic in ('⭐', '🏆', '🤼'):                       return 1   # bonuses, titles, wrestling honours
        if re.search(r'\bolympic|world championship', t): return 2   # marquee medals
        return 3                                                     # everything else
    combined.sort(key=_prio)
    combined = combined[:40]  # generous ceiling — decorated wrestlers/Olympians/BJJ athletes
                              # can legitimately have many medals; only a guard against a runaway page
    if not combined:
        return None, f"page '{title}' — no accolades found"
    return combined, f"{len(combined)} from '{title}'"

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--test", metavar="NAME", help="one fighter, print only (no write)")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--start", type=int, default=0)
    ap.add_argument("--all", action="store_true", help="scrape every fighter, not just those missing accolades")
    args = ap.parse_args()

    if args.test:
        accs, note = collect(args.test)
        print(f"[{args.test}] {note}")
        for a in (accs or []):
            print(f"  {a['icon']}  {a['title']}")
        return

    targets, have = load_targets(args.all)
    if args.start:
        targets = targets[args.start:]
    if args.limit:
        targets = targets[:args.limit]

    out = {}
    if OUT_JSON.exists():
        try: out = json.loads(OUT_JSON.read_text(encoding="utf-8"))
        except Exception: out = {}

    log = LOG_FILE.open("a", encoding="utf-8")
    print(f"Targets: {len(targets)} fighters (already have accolades: {len(have)})")
    for i, name in enumerate(targets, 1):
        if name in out:  # already scraped in a previous run
            continue
        try:
            accs, note = collect(name)
        except Exception as e:
            note, accs = f"ERROR {e}", None
        if accs:
            out[name] = accs
            OUT_JSON.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        line = f"[{i}/{len(targets)}] {name}: {note}"
        print(line); log.write(line + "\n"); log.flush()
        time.sleep(DELAY)
    log.close()
    print(f"\nDone. {len(out)} fighters with accolades → {OUT_JSON.name}")
    print("Next: python3 gillylab_apply_accolades.py")

if __name__ == "__main__":
    main()
