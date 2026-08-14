#!/usr/bin/env python3
"""
Generates GillyLab partner-promo graphics (feed post + story) for a given
promo code / discount / base price, in the house style established by
marketing/ufc330-promo.html.

Fonts (Barlow / Barlow Condensed @font-face, base64) and the GillyLab logo
data URI are pulled straight out of marketing/ufc330-promo.html at run time,
so this script has no external asset dependencies of its own.

Usage:
    python scripts/gen-partner-promo.py CODE DISCOUNT_PCT BASE_PRICE [OUT_DIR]

Example:
    python scripts/gen-partner-promo.py MATCHMAKER20 20 9.99 marketing

Writes <slug>-feed.html / <slug>-story.html into OUT_DIR (default: marketing/).
Render each to PNG with headless Chrome, e.g.:

    chrome.exe --headless=new --disable-gpu --hide-scrollbars \
      --window-size=1200,790 --force-device-scale-factor=2 \
      --screenshot=feed-raw.png file:///.../<slug>-feed.html

    chrome.exe --headless=new --disable-gpu --hide-scrollbars \
      --window-size=1200,2040 --force-device-scale-factor=2 \
      --screenshot=story-raw.png file:///.../<slug>-story.html

then crop to the .card element's bounding box (measure it in a browser,
scale by the device-scale-factor above) with Pillow.
"""
import os
import re
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REFERENCE_HTML = os.path.join(REPO_ROOT, "marketing", "ufc330-promo.html")


def _load_shared_assets():
    with open(REFERENCE_HTML, encoding="utf-8") as f:
        html = f.read()
    faces = re.findall(r"@font-face\s*\{[^}]*\}", html, re.S)
    if not faces:
        raise RuntimeError("no @font-face blocks found in " + REFERENCE_HTML)
    fonts_css = "\n".join(faces)
    m = re.search(r'<img src="(data:image/[^"]+)"', html)
    if not m:
        raise RuntimeError("no logo data URI found in " + REFERENCE_HTML)
    logo_uri = m.group(1)
    return fonts_css, logo_uri


FONTS_CSS, LOGO_URI = _load_shared_assets()

ROOT_CSS = """
:root{
  --bg:#0a0a0b;
  --card:#141416;
  --accent:#00e668;
  --text:#f4f5f7;
  --muted:rgba(255,255,255,.55);
  --line:rgba(255,255,255,.09);
}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:var(--bg);width:100%;min-height:100%}
body{
  display:flex; align-items:center; justify-content:center;
  padding:28px 14px;
  font-family:'Barlow',-apple-system,sans-serif;
  color:var(--text);
  -webkit-font-smoothing:antialiased;
}
"""

CODE_ICON_SVG = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z"/><circle cx="7" cy="7" r="1.3" fill="currentColor" stroke="none"/></svg>'

TAGLINE = "The Ultimate UFC Analytics Database — fight simulator, detailed fighter analytics, odds, CLV tracking and much more, for every card."


def money(n):
    return "${:,.2f}".format(n)


def pct(n):
    return str(int(n)) if float(n).is_integer() else str(n)


def feed_post(code, discount_pct, base_price):
    disc_price = base_price * (1 - discount_pct / 100)
    title = f"GillyLab — {code} Partner Promo"
    css = f"""
{ROOT_CSS}
.card{{
  position:relative; width:1080px; max-width:100%;
  background:radial-gradient(1000px 620px at 50% -8%, #15201a 0%, var(--bg) 55%);
  border-radius:14px; overflow:hidden;
}}
.content{{ position:relative; z-index:2; padding:52px 60px 60px; display:flex; flex-direction:column; }}
.top-row{{ display:flex; align-items:center; justify-content:space-between; }}
.brand{{ display:inline-flex; align-items:center; gap:12px; font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:30px; letter-spacing:.12em; }}
.brand img{{height:44px;width:auto;display:block}}
.brand .a{{color:var(--accent)}}
.offer-tag{{ font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:16px; letter-spacing:.1em; text-transform:uppercase; color:var(--muted); }}
.offer-tag b{{color:var(--text)}}
.tagline{{ margin-top:14px; font-size:17px; color:var(--muted); line-height:1.5; max-width:640px; }}
.offer{{ margin-top:30px; display:flex; flex-direction:column; gap:20px; }}
.eyebrow{{ font-family:'Barlow Condensed',sans-serif; font-weight:800; font-size:24px; letter-spacing:.06em; text-transform:uppercase; color:var(--accent); }}
.headline{{ font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:150px; line-height:.92; letter-spacing:.002em; }}
.headline .was{{ color:var(--muted); font-weight:700; font-size:.4em; text-decoration:line-through; text-decoration-color:rgba(255,255,255,.3); margin-right:.22em; }}
.headline .fine{{ font-family:'Barlow',-apple-system,sans-serif; color:var(--muted); font-weight:500; font-size:.13em; letter-spacing:0; white-space:nowrap; margin-left:.3em; vertical-align:.24em; }}
.sub{{ font-size:26px; color:var(--text); line-height:1.45; max-width:900px; }}
.divider{{height:1px; background:var(--line); margin-top:6px}}
.claim{{ display:flex; flex-direction:column; gap:16px; }}
.claim-label{{ font-family:'Barlow Condensed',sans-serif; font-size:18px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; color:var(--muted); }}
.claim-row{{ display:flex; align-items:center; gap:26px; flex-wrap:wrap; }}
.code-chip{{ display:inline-flex; align-items:center; gap:16px; background:var(--card); border:2px dashed rgba(0,230,104,.55); border-radius:12px; padding:16px 26px; width:fit-content; }}
.code-chip .code{{ font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:44px; letter-spacing:.1em; color:var(--accent); }}
.code-chip .icon{{ width:28px;height:28px;color:var(--accent);opacity:.85; }}
.cta-url{{ font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:28px; letter-spacing:.02em; color:var(--muted); }}
.cta-url .a{{color:var(--accent)}}
"""
    body = f"""
<div class="card" role="img" aria-label="GillyLab partner promo: {pct(discount_pct)}% off first month, code {code}">
  <div class="content">
    <div class="top-row">
      <div class="brand"><img src="{LOGO_URI}" alt=""/><span class="word">GILLY<span class="a">LAB</span></span></div>
      <div class="offer-tag"><b>Partner offer</b></div>
    </div>
    <div class="tagline">{TAGLINE}</div>

    <div class="offer">
      <div class="eyebrow">{pct(discount_pct)}% off your first month</div>
      <div class="headline"><span class="was">{money(base_price)}</span>{money(disc_price)}<span class="fine">first month — then {money(base_price)}/mo, cancel anytime</span></div>
      <div class="sub">Get the full fighter database, fight simulator, odds and all the tools.</div>

      <div class="divider"></div>

      <div class="claim">
        <div class="claim-label">Use code at checkout</div>
        <div class="claim-row">
          <div class="code-chip">{CODE_ICON_SVG}<span class="code">{code}</span></div>
          <div class="cta-url">at gillylab<span class="a">.com</span>/subscribe</div>
        </div>
      </div>
    </div>
  </div>
</div>
"""
    return f"<meta charset=\"utf-8\">\n<title>{title}</title>\n<style>\n{FONTS_CSS}\n{css}\n</style>\n{body}"


def story(code, discount_pct, base_price):
    disc_price = base_price * (1 - discount_pct / 100)
    title = f"GillyLab — {code} Partner Promo (Story)"
    css = f"""
{ROOT_CSS}
.card{{
  position:relative; width:1080px; height:1920px;
  background:radial-gradient(1100px 900px at 50% -6%, #15201a 0%, var(--bg) 45%);
  overflow:hidden;
}}
.content{{ position:relative; z-index:2; height:100%; padding:76px 74px; display:flex; flex-direction:column; }}
.top-row{{ display:flex; align-items:center; justify-content:space-between; }}
.brand{{ display:inline-flex; align-items:center; gap:14px; font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:36px; letter-spacing:.12em; }}
.brand img{{height:54px;width:auto;display:block}}
.brand .a{{color:var(--accent)}}
.offer-tag{{ font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:18px; letter-spacing:.1em; text-transform:uppercase; color:var(--muted); }}
.offer-tag b{{color:var(--text)}}

.mid{{ flex:1; display:flex; flex-direction:column; justify-content:center; gap:88px; }}

.tagline{{ font-size:30px; color:var(--muted); line-height:1.55; max-width:860px; }}

.eyebrow{{ font-family:'Barlow Condensed',sans-serif; font-weight:800; font-size:40px; letter-spacing:.06em; text-transform:uppercase; color:var(--accent); }}
.headline{{ font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:250px; line-height:.9; letter-spacing:.002em; margin-top:22px; }}
.headline .was{{ color:var(--muted); font-weight:700; font-size:.34em; text-decoration:line-through; text-decoration-color:rgba(255,255,255,.3); margin-right:.2em; display:block; margin-bottom:.16em; }}
.fine{{ font-family:'Barlow',-apple-system,sans-serif; color:var(--muted); font-weight:500; font-size:37px; margin-top:24px; }}

.sub{{ font-size:40px; color:var(--text); line-height:1.5; max-width:860px; margin-top:8px; }}

.claim{{ display:flex; flex-direction:column; gap:32px; margin-top:8px; }}
.claim-label{{ font-family:'Barlow Condensed',sans-serif; font-size:26px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; color:var(--muted); }}
.code-chip{{ display:inline-flex; align-items:center; gap:22px; background:var(--card); border:3px dashed rgba(0,230,104,.55); border-radius:18px; padding:30px 40px; width:fit-content; }}
.code-chip .code{{ font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:80px; letter-spacing:.06em; color:var(--accent); }}
.code-chip .icon{{ width:46px;height:46px;color:var(--accent);opacity:.85; }}
.cta-url{{ font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:42px; letter-spacing:.02em; color:var(--muted); margin-top:6px; }}
.cta-url .a{{color:var(--accent)}}
"""
    body = f"""
<div class="card" role="img" aria-label="GillyLab partner promo: {pct(discount_pct)}% off first month, code {code}">
  <div class="content">
    <div class="top-row">
      <div class="brand"><img src="{LOGO_URI}" alt=""/><span class="word">GILLY<span class="a">LAB</span></span></div>
      <div class="offer-tag"><b>Partner offer</b></div>
    </div>

    <div class="mid">
      <div class="tagline">{TAGLINE}</div>

      <div>
        <div class="eyebrow">{pct(discount_pct)}% off your first month</div>
        <div class="headline"><span class="was">{money(base_price)}</span>{money(disc_price)}</div>
        <div class="fine">first month — then {money(base_price)}/mo, cancel anytime</div>
      </div>

      <div class="sub">Get the full fighter database, fight simulator, odds and all the tools.</div>

      <div class="claim">
        <div class="claim-label">Use code at checkout</div>
        <div class="code-chip">{CODE_ICON_SVG}<span class="code">{code}</span></div>
        <div class="cta-url">at gillylab<span class="a">.com</span>/subscribe</div>
      </div>
    </div>
  </div>
</div>
"""
    return f"<meta charset=\"utf-8\">\n<title>{title}</title>\n<style>\n{FONTS_CSS}\n{css}\n</style>\n{body}"


if __name__ == "__main__":
    if len(sys.argv) < 4:
        print(__doc__)
        sys.exit(1)

    code = sys.argv[1]
    discount_pct = float(sys.argv[2])
    base_price = float(sys.argv[3])
    out_dir = sys.argv[4] if len(sys.argv) > 4 else os.path.join(REPO_ROOT, "marketing")
    slug = code.lower()

    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(out_dir, f"{slug}-feed.html"), "w", encoding="utf-8") as f:
        f.write(feed_post(code, discount_pct, base_price))
    with open(os.path.join(out_dir, f"{slug}-story.html"), "w", encoding="utf-8") as f:
        f.write(story(code, discount_pct, base_price))
    print("wrote", slug, "feed + story to", out_dir)
