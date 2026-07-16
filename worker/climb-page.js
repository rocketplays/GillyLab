/* AUTO-GENERATED from prototypes/the-climb.html by scripts/gen-climb-page.cjs — do not edit by hand.
   Edit the prototype: it is what the whole test/sim harness reads. */
export const climbPage = ({ head, nav, back, cta, footer }) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>The Climb — build a fighter, win the UFC belt | GillyLab</title>
<meta name="description" content="Build a UFC fighter, start as a 10-0 prospect, pick your fights and climb the real rankings to the belt. Free on GillyLab.">
<!-- The share sheet is the app's, not a copy of it. gen-gl-sheet.cjs generates
     gl-sheet.js out of index.html so standalone pages can render a sheet that is
     byte-identical to the app's; /pickem already loads it exactly this way. Barlow
     is required — GL_SHEET draws in it and awaits document.fonts.ready, so without
     the link the sheet renders in a fallback face and looks like a knock-off of
     itself. Both are relative because this page is served from the repo root. -->
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&family=Barlow:wght@300;400;500&display=swap" rel="stylesheet">
<script src="/gl-sheet.js?v=114999b8" defer></script>
<!-- HEAD SLOT — filled by scripts/gen-climb-page.cjs from the worker, empty here.
     Carries the Open Graph tags (so a shared link previews) and, for logged-out
     visitors, the CLIMB_LOCKED flag. Both have to come from the worker rather than
     be baked in: ogTags() needs SITE_URL and is ONE definition shared with every
     other page, and locked-ness is per-request. The prototype is opened directly
     and is never locked, so this is empty there. -->
` + (head || "") + `
<!--
  PROTOTYPE. Deliberately ugly. Needs a local server (it fetches climb-data.json):
      python3 -m http.server        then  localhost:8000/prototypes/the-climb.html

  WHAT'S REAL AND WHAT ISN'T — say it plainly, because the page used to claim
  "every fight is scored by the real GillyLab simulator, no fake difficulty" and
  that stopped being true the moment we took the wheel.

    REAL      the fighters, their stats, their records, their rankings, and the
              ladder's power ratings (rank-led, textured by the sim's own
              round-robin opinion). Climbing this division is climbing the UFC.
    OURS      who wins. The style triangle, the attribute weights, the cost and
              value curves, the difficulty dials.

  WHY THE SIM STOPPED REFEREEING. Measured across 2,600 possible three-man
  offers: a striker, a wrestler and a grappler wanted the SAME opponent 92% of
  the time. The sim is a power ladder, not a matchup engine — it was trained to
  price real fights, and real-fight pricing is dominated by "who's better", with
  style as a rounding error. A game whose whole loop is "pick your matchup"
  cannot be built on that. Every hour spent tuning attributes on top of it was
  rearranging furniture in a house with no floor.

  So the sim does the thing it's genuinely great at and the game can't fake —
  how good a fighter really is — and the game does the rest.

  This exists to answer ONE question no amount of measuring can: is the run fun?
  Play three runs. If you find yourself thinking "one more, I'll build him
  differently" — it works. Everything else is tunable, and now actually tunable:
  see THE DIFFICULTY DIALS in the script below.

-->
<style>
  :root{ --bg:#0a0a0b; --surface:#111114; --surface2:#18181d; --border:#2a2a32;
    --accent:#00e668; --accent2:#ff3d00; --gold:#ffc531; --text:#f0f0f0; --muted:#666672; --card:#14141a; }
  *{box-sizing:border-box}

  /* THE RULE THAT MAKES EVERY OTHER PAGE'S NAV WORK, and the reason "GILLY" and
     "Log out" went PURPLE here without it.
     The browser ships its own a:link/a:visited colours. Those are declarations ON
     THE ELEMENT, and a declaration on the element beats an INHERITED value however
     specific the ancestor — so .pk-navlinks{color:var(--muted)} never reaches the
     <a> inside it, and the UA's visited purple wins. Every other free page has
     a{color:inherit} at the top of its <style>; this page, being a standalone
     prototype with no links, never needed one until it grew a nav.
     It is also why .pk-brand can safely have no colour of its own over there.
     I copied those four pk-* rules "byte-for-byte" and they still broke, because a
     rule's behaviour is the whole cascade it lands in, not the rule. */
  a{color:inherit}

  /* MOBILE: DON'T ZOOM WHEN I'M TAPPING +.
     Two fast taps on the same spot is a DOUBLE-TAP, and a double-tap is the
     browser's built-in zoom gesture — so spending 42 points at any speed zooms the
     page. It isn't the button's fault and it isn't fixable in JS: the gesture is
     resolved by the compositor before any click fires.

     touch-action:manipulation tells the browser this element has no double-tap
     gesture, so it can dispatch the tap immediately. Pinch-to-zoom and scrolling
     are untouched — they are page gestures, not element ones.

     WHAT WE ARE *NOT* DOING, deliberately: user-scalable=no / maximum-scale=1 in
     the viewport. It's the usual answer and it's wrong twice over.
       1. It disables pinch-zoom for everyone, permanently. That's an accessibility
          regression (WCAG 1.4.4 wants 200%), on a page whose smallest text is
          0.62rem — about 10px. The people most likely to pinch are the ones who
          most need to.
       2. IT WOULDN'T EVEN WORK. iOS Safari has ignored user-scalable=no since
          iOS 10. So on the device this was reported from it fixes nothing, and
          the only thing it achieves is breaking zoom on Android.
     Every tappable thing on this page is a <button> (the opponent cards included),
     plus the division <select> and the back link, so the list below is exhaustive
     rather than a blanket * rule. */
  /* ON THE BODY, NOT ON THE BUTTONS. Scoping it to \`button, select, a\` was wrong
     and the zoom survived: touch-action only governs the gesture when the tap
     LANDS on that element, and this page rebuilds #app on every single click. So
     the second tap of a fast double lands on a brand-new node, or in the 8px gap
     between two 22px buttons, and hits a container with touch-action:auto — at
     which point the double-tap belongs to the ancestor and zooms.

     The effective touch-action is the intersection down the ancestor chain, so
     putting \`manipulation\` on <body> covers the whole subtree no matter what the
     tap lands on or what re-rendered underneath it. \`manipulation\` is exactly
     "auto minus double-tap-zoom": panning and PINCH-ZOOM both survive, which is
     the accessibility line we're not crossing (see the viewport note above). */
  html, body{touch-action:manipulation}

  /* iOS ZOOMS ANY FORM CONTROL UNDER 16px WHEN IT GAINS FOCUS. That's a separate
     gesture from the double-tap above and it has a separate cause: Safari decides
     the control is too small to read and helpfully scales the whole viewport, then
     leaves you zoomed in. .divsel is .82rem (~13px), so tapping the weight class
     picker zooms every iPhone — a bug nobody reported yet because you pick a
     division once. 16px is the exact threshold, and it only needs to apply where
     there's a touch pointer, so the desktop design is unchanged. */
  @media (pointer: coarse){ .divsel{font-size:16px} }

  /* ── HEIGHT ─────────────────────────────────────────────────────────────
     A phone shows ~650px. Every block below the fold is a scroll between you
     and the fight you're picking, so the rule is: show what this screen is FOR,
     and put everything else one tap away. Nothing here deletes information. */

  /* The pitch, hidden once you're playing. ~90px back on every in-run screen. */
  body.playing .tag, body.playing .sub{display:none}
  body.playing h1{font-size:1.1rem;margin-bottom:.4rem}

  /* Collapsibles. summary::marker is a ▸ that ignores colour in most engines, so
     it's replaced with our own caret that inherits currentColor and rotates. */
  details.panel > summary, details.legwrap > summary{cursor:pointer;list-style:none;
    display:flex;align-items:center;gap:.4rem;user-select:none}
  details.panel > summary::-webkit-details-marker,
  details.legwrap > summary::-webkit-details-marker{display:none}
  details.panel > summary::before, details.legwrap > summary::before{
    content:'';width:0;height:0;border-left:4px solid currentColor;
    border-top:3.5px solid transparent;border-bottom:3.5px solid transparent;
    transition:transform .15s;flex:0 0 auto;opacity:.6}
  details.panel[open] > summary::before, details.legwrap[open] > summary::before{transform:rotate(90deg)}
  details.legwrap{margin-top:.8rem}
  details.legwrap > summary{margin-bottom:.4rem}
  .hint{color:var(--muted);font-weight:400;text-transform:none;letter-spacing:0}

  /* Phone spacing. The desktop values are unchanged — this is the same layout
     with less air, not a different one. */
  @media (max-width:560px){
    /* .wrap, not body — the gutter moved there when the top bar went full-bleed.
       Left on body this would have set padding on an element that no longer has
       any, and the phone would have quietly kept the desktop 1rem. */
    .wrap{padding:.6rem}
    .pk-nav{padding:10px 12px}
    .panel{padding:.7rem;margin:.5rem 0}
    h1{font-size:1.15rem}
    .sub{font-size:.72rem;margin-bottom:.7rem}
    .tag{margin-bottom:.35rem}
    .attr{margin:.2rem 0}
    .legend{gap:.3rem .8rem}
    .opp{padding:.55rem}
    .log{line-height:1.65}
    .tipbox{margin-top:.5rem}
  }
  /* PADDING MOVED TO .wrap. The top bar and the footer both need to touch the
     viewport edges — a sticky bar whose divider stops 1rem short on each side
     reads as a floating box, not a rule. So body is flush and the reading column
     carries its own gutter. */
  body{margin:0;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:0}
  .wrap{max-width:820px;margin:0 auto;padding:1rem}
  h1{font-size:1.3rem;margin:0 0 .1rem;letter-spacing:-.02em}
  h1 .g{color:var(--accent)}
  .tag{font-size:.92rem;font-weight:600;color:var(--text);margin:.15rem 0 .5rem;letter-spacing:-.01em}
  .sub{color:var(--muted);font-size:.78rem;margin:0 0 1rem;line-height:1.5}
  .panel{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:.9rem;margin:.7rem 0}
  .rl{color:var(--muted);font-size:.62rem;text-transform:uppercase;letter-spacing:.08em;margin-bottom:.4rem}

  /* attribute sliders */
  .attr{display:grid;grid-template-columns:120px 1fr 42px;gap:.6rem;align-items:center;margin:.35rem 0}
  /* The upgrade rows reuse .attr but their third column is a BUTTON reading
     "+1 · 2 pts", not a 2-char number. 42px clipped it straight out of the
     container. Own grid, auto-width column. */
  .attr.up{grid-template-columns:120px 1fr auto}
  .attr.up button{min-width:74px}
  .attr label{font-size:.8rem}
  .attr .v{font-size:.8rem;color:var(--accent);text-align:right;font-variant-numeric:tabular-nums}
  input[type=range]{width:100%;accent-color:var(--accent)}
  .pts{font-size:.9rem;font-weight:700}
  .pts.over{color:var(--accent2)}

  /* opponent cards */
  .opps{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:.6rem}
  .opp{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:.7rem;cursor:pointer;text-align:left;color:inherit;font:inherit}
  .opp .nm{font-size:.92rem;font-weight:700}
  .opp .rk{font-size:.65rem;color:var(--gold);text-transform:uppercase;letter-spacing:.06em}
  .opp .rec{font-size:.72rem;color:var(--muted);margin:.2rem 0 .45rem}
  .opp .odds{font-size:.75rem}
  .opp .rw{font-size:.68rem;color:var(--accent);margin-top:.3rem}
  .opp.risky{border-color:rgba(255,61,0,.5)}

  /* HOVER ONLY WHERE A CURSOR EXISTS.
     Reported: "when clicking a fighter that's green because you're the favorite,
     it stays green on the next round, which guides the eye to that one almost as a
     suggestion." Exactly right, and it was the matchmaker appearing to have an
     opinion — the one thing this board must never do.
     A touch device has no cursor, so it FAKES one: it applies :hover on tap and
     holds it until you tap somewhere else. render() then rebuilds the board, the
     new card lands under the same finger, and the emulated hover re-applies to
     whatever now occupies that spot. The green outline follows your last tap
     around and reads as a recommendation.
     @media (hover: hover) is the fix rather than deleting the rule: a mouse
     genuinely IS over the thing it highlights, so desktop keeps the affordance and
     touch never gets a state it has no way to leave. */
  @media (hover: hover){
    .opp:hover{border-color:var(--accent)}
    button.btn:hover{border-color:var(--accent)}
    .btn.restart:hover{color:var(--accent2);border-color:var(--accent2);background:transparent}
    .divsel:hover{border-color:var(--accent)}
    .pl-act:hover{background:var(--accent);color:#0e0f13}
  }

  /* record + status */
  .hud{display:flex;gap:1.2rem;flex-wrap:wrap;align-items:baseline}
  /* The archetype is a name, not a number — the HUD's 1.1rem is sized for "10-0"
     and "Submission threat" at that size wraps the row on a phone. */
  .hud b.archv{font-size:.82rem;font-weight:700;color:var(--gold)}
  .archline{display:flex;align-items:baseline;justify-content:space-between;gap:.6rem;
    margin-top:.6rem;padding:.4rem .55rem;background:var(--surface2);
    border:1px solid var(--border);border-radius:6px}
  .archline span{color:var(--muted);font-size:.62rem;text-transform:uppercase;letter-spacing:.07em}
  .archline b{color:var(--gold);font-size:.88rem}
  /* Restart: quiet by default, and it only announces itself on hover. It is the
     one control here that destroys something, so it should be findable and never
     inviting. margin-left:auto pins it to the far end of the HUD row. */
  .btn.restart{margin-left:auto;padding:.25rem .55rem;font-size:.68rem;font-weight:600;
    color:var(--muted);background:transparent;border-color:var(--border);align-self:center}
  /* ...but in the creator's button row it sits beside "Turn pro", where
     margin-left:auto would fling it to the far edge away from its own label. */
  .panel > div > .btn.restart{margin-left:0}
  .hud div span{color:var(--muted);font-size:.62rem;text-transform:uppercase;letter-spacing:.07em;display:block}
  .hud div b{font-size:1.1rem}
  .log{font-size:.78rem;line-height:1.8}
  .log .w{color:var(--accent)} .log .l{color:var(--accent2)}
  /* the method tag is a fixed-width column so the opponents' names line up —
     'SUB'/'KO '/'DEC' are 3 chars but not 3 equal widths in a proportional font */
  .log .mth{color:var(--muted);font-variant-numeric:tabular-nums;
            font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.72rem;margin-right:.15rem}
  .log .ml{color:var(--muted);font-variant-numeric:tabular-nums;font-size:.72rem}
  /* the champion's mark. Gold, because gold is what the belt is in this palette. */
  .cmark{display:inline-flex;align-items:center;justify-content:center;
    width:1rem;height:1rem;border-radius:3px;font-size:.6rem;font-weight:800;
    background:var(--gold);color:#1a1204;vertical-align:middle;line-height:1}
  .cmark.im{background:transparent;color:var(--gold);border:1px solid var(--gold)}
  /* the rank shares the champion's slot, so it gets the champion's metrics —
     right-aligned and fixed-width, or the names shear left and right by a digit */
  .log .rk{display:inline-block;min-width:1.7rem;text-align:right;color:var(--muted);
    font-size:.72rem;font-variant-numeric:tabular-nums}
  .log .rk.ur{font-size:.62rem;letter-spacing:.03em}
  .log .cmark{min-width:1rem;margin-left:.7rem}
  /* Share-sheet overlay. Lifted verbatim from the /pickem page (worker/pages.js)
     rather than reinvented — GL_SHEET builds its markup against these exact class
     names, so they are part of its contract, not styling choices we get to make. */
  .pl-share{position:fixed;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;padding:1.25rem;background:rgba(0,0,0,.72);overflow-y:auto;visibility:hidden;opacity:0;pointer-events:none;transition:opacity .18s ease,visibility .18s}
  .pl-share.open{visibility:visible;opacity:1;pointer-events:auto}
  .pl-share-inner{width:100%;max-width:460px}
  .pl-share-actions{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:.9rem}
  .pl-share-hint{text-align:center;margin-top:.6rem;font-size:.66rem;color:var(--text);line-height:1.5;background:var(--card);border:1px solid var(--border);border-radius:6px;padding:.6rem .75rem}
  .pl-act{background:rgba(0,230,104,.10);border:1px solid var(--accent);color:var(--accent);font-family:inherit;font-size:.72rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;padding:.6rem 1.25rem;border-radius:6px;cursor:pointer;transition:background .15s,color .15s}
  .pl-act.primary{background:var(--accent);color:#0e0f13}
  .pl-act.ghost{background:transparent;border-color:var(--border);color:var(--muted)}
  .pl-act.busy{opacity:.5;pointer-events:none}
  .gl-sheet-preview img{width:100%;border-radius:10px;display:block;border:1px solid var(--border)}
  .recs{display:flex;gap:1.4rem;flex-wrap:wrap;align-items:baseline;margin:.5rem 0 .1rem}
  .recs span{color:var(--muted);font-size:.62rem;text-transform:uppercase;letter-spacing:.07em;display:block}
  .recs b{font-size:1.05rem}
  .mtally{margin:.6rem 0 .2rem;font-size:.78rem}
  .mtally .mrow{display:grid;grid-template-columns:1fr 2.2rem 2.2rem;gap:.3rem;line-height:1.7}
  .mtally .mrow span:not(:first-child){text-align:right;font-weight:600;font-variant-numeric:tabular-nums}
  .mtally .mhead span{color:var(--muted);font-size:.62rem;text-transform:uppercase;letter-spacing:.07em;font-weight:400}
  .mtally .w{color:var(--accent)} .mtally .l{color:var(--accent2)} .mtally .z{color:var(--muted)}
  .big{font-size:1.05rem;font-weight:700;margin:.3rem 0}
  .big.win{color:var(--accent)} .big.loss{color:var(--accent2)}
  button.btn{background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:.45rem .9rem;font-size:.8rem;cursor:pointer;font-weight:600}
  button.btn.pri{background:var(--accent);color:#04120a;border-color:var(--accent)}
  .load{color:var(--muted);padding:2rem 0;text-align:center}

  /* Attribute legend — a table, not a paragraph.
     Rows get a hairline rule and real vertical padding: seven label/value pairs
     stacked with .2rem of space and no separator read as one grey clump, which
     is what they were. The rule does the grouping so the eye doesn't have to. */
  .legend{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));
    gap:0 1.6rem;margin:.9rem 0 0;padding-top:.75rem;border-top:1px solid var(--border)}
  .lg-row{display:grid;grid-template-columns:108px 1fr;gap:.5rem;align-items:baseline;
    padding:.42rem 0;font-size:.74rem;border-bottom:1px solid rgba(255,255,255,.045)}
  .lg-row b{color:var(--text);font-weight:600;letter-spacing:-.01em}
  .lg-row span{color:var(--muted);line-height:1.4}
  .tipbox{margin-top:.7rem;padding:.5rem .7rem;border-left:2px solid var(--accent);
    background:var(--surface);border-radius:0 4px 4px 0;font-size:.74rem;
    line-height:1.55;color:#c8c8cf}
  .tipbox b{color:var(--text)}
  .note{color:var(--muted);font-size:.72rem;line-height:1.5;margin-top:.4rem}

  /* opponent avatar. The initials sit UNDER the photo, so a 404 reveals them
     rather than needing a JS fallback.
     THE PHOTO MUST BE OPAQUE OR THE TRICK LEAKS. Every file in photos/thumb is a
     cutout — PNG colortype 6, RGB+ALPHA — so the fighter is surrounded by
     transparency, and "the initials sit UNDER the photo" meant they showed THROUGH
     it: every opponent card had ghost letters floating around the man's head. The
     layering was right and the assumption underneath it ("a photo is a rectangle
     of pixels") was wrong. Giving the img its own opaque background fixes it in
     one line and keeps the 404 path exactly as it was — on error the img hides
     itself and the initials are revealed, as designed. */
  .av{position:relative;width:44px;height:44px;border-radius:50%;flex:0 0 44px;
    background:var(--surface2);border:1px solid var(--border);overflow:hidden}
  .av span{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
    font-size:.72rem;font-weight:700;color:var(--muted);letter-spacing:.02em}
  .av img{position:relative;width:100%;height:100%;object-fit:cover;object-position:top center;
    display:block;background:var(--surface2)}
  .opphd{display:flex;align-items:center;gap:.55rem;margin-bottom:.45rem}
  .oppwho{min-width:0}
  .opp .rec{margin:.1rem 0 0}

  /* level readout: bar + "7/10", shared by the creator and the upgrade panel */
  .lvlwrap{display:flex;align-items:center;gap:.5rem;min-width:0}
  .lvlbar{flex:1;height:6px;background:var(--surface2);border-radius:3px;overflow:hidden;min-width:40px}
  .lvlfill{height:100%;background:var(--accent)}
  .lvlnum{font-size:.72rem;color:var(--accent);font-variant-numeric:tabular-nums;
    white-space:nowrap;min-width:34px;text-align:right}
  .lvlnum i{color:var(--muted);font-style:normal;font-size:.62rem}

  /* -/+ stepper */
  .pm{display:flex;align-items:center;gap:.3rem;white-space:nowrap}
  .pmbtn{padding:.1rem 0;width:22px;height:22px;line-height:1;font-size:.85rem;
    display:flex;align-items:center;justify-content:center}
  .pmcost{font-size:.62rem;color:var(--muted);min-width:34px;text-align:center;
    font-variant-numeric:tabular-nums}

  /* weight class picker — one row, not a wall of cards */
  .divpick{display:flex}
  .divsel{width:100%;background:var(--surface2);color:var(--text);border:1px solid var(--border);
    border-radius:6px;padding:.45rem .6rem;font-size:.82rem;font-weight:600;font-family:inherit;
    cursor:pointer;appearance:none;
    /* native select arrows are grey-on-grey in dark mode on most platforms */
    background-image:linear-gradient(45deg,transparent 50%,var(--muted) 50%),
                     linear-gradient(135deg,var(--muted) 50%,transparent 50%);
    background-position:calc(100% - 15px) calc(50% + 1px), calc(100% - 10px) calc(50% + 1px);
    background-size:5px 5px, 5px 5px; background-repeat:no-repeat}
  .divsel:focus{border-color:var(--accent);outline:none}   /* :focus is real and
     dismissable — only :hover is the emulated, sticky one. Gated above. */
  /* The dropdown list itself renders with the OS palette, not ours — without this
     it's black text on a white sheet in the middle of a dark page. */
  .divsel option{background:var(--surface2);color:var(--text)}

  /* THE SCOUTING REPORT. Collapsed to one line by default: the creator screen was
     already reported as "a little tall" on mobile, and this sits above the thing
     you came here to do. The READ is always visible; the numbers are opt-in. */
  .scout{margin-top:.5rem;background:var(--surface);border:1px solid var(--border);
    border-radius:8px;overflow:hidden}
  .scout-hd{display:flex;align-items:center;gap:.5rem;padding:.5rem .6rem;
    cursor:pointer;user-select:none;background:none;border:0;width:100%;
    color:inherit;font:inherit;text-align:left}
  .scout-nm{font-size:.78rem;font-weight:700;white-space:nowrap}
  .scout-c{color:var(--gold);font-weight:700}
  .scout-rd{font-size:.72rem;color:var(--muted);flex:1;overflow:hidden;
    text-overflow:ellipsis;white-space:nowrap}
  .scout-ch{color:var(--muted);font-size:.6rem;transition:transform .15s}
  .scout-ch.o{transform:rotate(180deg)}
  .scout-bd{padding:0 .6rem .6rem;border-top:1px solid var(--border)}
  .scout-arch{font-size:.68rem;color:var(--muted);text-transform:uppercase;
    letter-spacing:.06em;margin:.5rem 0 .45rem}
  .scout-row{display:flex;justify-content:space-between;font-size:.72rem;margin-bottom:.2rem}
  .scout-row .v{font-weight:600}
  .scout-bar{height:3px;background:var(--surface2);border-radius:2px;margin-bottom:.45rem}
  .scout-bar i{display:block;height:3px;border-radius:2px;background:var(--muted)}
</style>
</head>
<body>
<!-- TOP BAR SLOT — the brand + account links, filled by gen-climb-page.cjs.
     OUTSIDE .wrap so its divider spans the viewport the way it does on every other
     free page; inside, the rule would stop at the 820px column and read as a box.
     Empty in the prototype, which has no /subscribe to link to. -->
` + (nav || "") + `
<div class="wrap">
  <!-- BACK SLOT — inside the column, under the divider. The brand above goes to
       /matchup; this goes to the page you were ACTUALLY on, which is a different
       promise and the reason both exist. -->
  ` + (back || "") + `
  <h1>The <span class="g">Climb</span></h1>
  <p class="tag">Can you become a UFC champion?</p>
  <!-- KEEP THIS TRUE. The tuning file lists the subtitle among the claims that
       outlived what made them true, and it is the first thing a player reads: it
       must describe the game that exists. "Start as a 10-0 prospect" is not
       flavour — POINTS_START 42 buys a debut rated 74 against a #15 rated 62, and
       the scoreboard now says 10-0. If any of those three move, this line moves. -->
  <p class="sub">Build a fighter. Start as a 10-0 prospect entering the UFC.<br>
    Pick your fights, climb the rankings, win the belt.<br>
    Real UFC fighters, real rankings, real GillyLab power ratings.</p>
  <div id="app"><div class="load">Loading the divisions…</div></div>
  <!-- CTA SLOT — the "this is free, here's what Premium adds" box every other free
       page ends its content with. BENEATH the game and inside .wrap: it's the last
       thing you read after a run, not chrome. Empty in the prototype, which has no
       /subscribe to sell. -->
  ` + (cta || "") + `
</div>
<!-- FOOTER SLOT — filled by scripts/gen-climb-page.cjs with the worker's
     FREE_FOOTER, the same one every other free page ends with. OUTSIDE .wrap on
     purpose: the footer's rule and copyright span the page, they aren't part of
     the 820px reading column. Empty in the prototype, which is opened directly
     and has no /about or /terms to link to. -->
` + (footer || "") + `

<script>
const $ = s => document.querySelector(s);
let D=null, ME='__YOU__';
let DIV=null; // chosen weight class
let G=null;   // game state
// Every read of the board goes through here. D.ladder no longer exists — the
// data is keyed by division now, and a stale D.ladder would read undefined and
// fail somewhere far away from the cause.
const LADDER = () => (D && DIV && D.divisions[DIV]) ? D.divisions[DIV].ladder : [];
const DIVLABEL = () => (D && DIV && D.divisions[DIV]) ? D.divisions[DIV].label : '';

// ── the attribute sheet ─────────────────────────────────────────────────────
// NINE SLIDERS, and every one of them is a real choice again.
//
// This sheet was SEVEN, then FIVE, then FOUR — each merge forced by the sim.
// Power and Pace got merged because the sim priced striking as one flat
// quantity that paid the same against everyone (spread of 0.3 across the whole
// division). Technique got merged because the sim barely read accuracy: 0.4
// win% end to end. None of that was a fact about MMA. It was a fact about a
// model built to price real fights, being asked to be a game.
//
// The sim no longer referees, so the sheet is ours. Split back out.
//
// CARDIO AND DURABILITY EXIST NOW. Both were rejected earlier, and the old
// comment here was emphatic: "Cardio is deliberately ABSENT: the sim has no
// cardio input... so you can't buy a gas tank here, same as real life." That
// was rationalising a limitation as realism. The sim has no cardio input; MMA
// certainly does. The two things every fan argues about after a fight — did he
// gas, can he take a shot — were the exact two the model couldn't hear.
//
// Levels run ATTR_MIN..ATTR_MAX (1..10). Level 1 is the FREE BASELINE — every
// fighter starts there in everything, and POINTS_START buys you up from it. It
// is not level zero: a UFC fighter with literally no takedown defence isn't a
// thing, and costTo() charges nothing below 1 anyway, so a 0 would be a free
// downgrade. 5 is about median, 10 is the best in the world at it.
const ATTRS = [
  { id:'power',     label:'Power',        note:'ending it with one shot' },
  { id:'pace',      label:'Pace',         note:'volume and pressure' },
  { id:'technique', label:'Technique',    note:'accuracy and timing' },
  { id:'strdef',    label:'Striking defense',note:'not getting hit' },
  { id:'chin',      label:'Durability',   note:'taking a shot' },
  { id:'cardio',    label:'Cardio',       note:'ability to keep fighting late' },
  { id:'wrestling', label:'Wrestling',    note:'getting them to the ground' },
  { id:'grappling', label:'Grappling',    note:'submissions' },
  { id:'takedef',   label:'Takedown def', note:'staying upright' },
];

// WHAT KIND OF FIGHTER DID I JUST BUILD? — the sheet, said out loud.
//
// Nine numbers don't tell you who you are. A player spends 42 points and gets a
// bar chart; "Knockout artist" is the same information in the language the sport
// uses, and it turns the creator from arithmetic into a decision about a person.
//
// PURELY DERIVED, AND DELIBERATELY SO. This reads G.attrs and returns a string.
// It feeds nothing — not winProb, not the board, not rewardFor. The whole file's
// history is constants that quietly became load-bearing; a label that could move a
// win rate would be the same trap wearing a nicer name. If this function were
// deleted the game would play identically, and that is the point.
//
// CENTRED ON YOUR OWN AVERAGE, not on an absolute. That's the rule the style
// triangle already banks ("Style is centred on YOUR OWN AVERAGE, not 0.5 —
// centring on 0.5 double-counts quality and taxes specialists twice"), and it's
// the only version that works here too: a maxed 10/10/10 fighter has no lean, he's
// just good, while a 4/4/1 fighter at level 4 IS a striker. An archetype is about
// SHAPE, and shape is what's above your own mean.
const ARCH_ONE = {
  power:     'Knockout artist',
  pace:      'Volume striker',
  technique: 'Technician',
  strdef:    'Counter striker',
  chin:      'Brawler',
  cardio:    'Grinder',
  wrestling: 'Wrestler',
  grappling: 'BJJ specialist',
  takedef:   'Sprawl-and-brawl',
};
// The pairs worth naming. Not all 36 — only the ones the sport already has a word
// for, because an invented name is worse than an honest hyphen. Anything not here
// falls back to the PRIMARY name, never an invented one — see archetype().
//
// KEYS ARE NORMALISED, because half of them were wrong the moment I typed them.
// The lookup builds its key with .sort(), so 'power+pace' is unreachable — the
// sorted form is 'pace+power'. Written by hand, 18 of these 36 were dead on
// arrival and silently fell through to the primary name: pace+cardio read "Volume
// striker" instead of "Pressure fighter". A lookup table whose keys are built by
// one rule and read by another is a table half-present, and nothing throws — it
// just quietly answers a slightly worse question. So the sort happens HERE, once,
// and hand-written order stops being load-bearing. It also means a DUPLICATE key
// silently wins, so check for those when you edit (the list below is 36 distinct
// pairs; if the table ever holds fewer, two entries collided).
const ARCH_PAIR = Object.fromEntries(Object.entries({
  // Power + Wrestling and Technique + Wrestling both read "Wrestle-boxer" until
  // now. They aren't the same fighter: one takes you down and hits you, the other
  // takes you down and works. Splitting them costs nothing and removes a duplicate.
  'power+wrestling':     'Ground-and-pound',
  'technique+wrestling': 'Dirty boxer',
  'power+technique':     'Sniper',
  'power+pace':          'Swarmer',
  'power+chin':          'Slugger',
  // NOT 'Pressure puncher' / 'Counter puncher'. Both were "X puncher" sitting
  // beside an existing "X striker"/"X fighter" — Counter striker (strdef alone)
  // and Pressure fighter (pace+cardio) — so the list had two pairs of names that
  // differed by their second word and named unrelated builds. Third time that's
  // been the actual complaint (Outfighter/Out-boxer, Chain grappler/Chain
  // wrestler), which is a pattern, not a coincidence: naming a hybrid by
  // compounding its neighbour's name reliably produces two names nobody can tell
  // apart. Name the FIGHTER, not the formula.
  'power+cardio':        'Juggernaut',
  'power+strdef':        'Assassin',
  'power+grappling':     'Finisher',
  'power+takedef':       'Sprawl-and-brawl',
  'pace+cardio':         'Pressure fighter',
  'pace+technique':      'Point fighter',
  'pace+strdef':         'Hit-and-run',
  'pace+chin':           'Brawler',
  'pace+wrestling':      'Smother wrestler',
  'pace+grappling':      'Scrambler',
  'pace+takedef':        'Kickboxer',
  'technique+strdef':    'Surgeon',
  'technique+cardio':    'Distance manager',
  'technique+chin':      'Craftsman',
  'technique+grappling': 'All-rounder',
  'technique+takedef':   'Kickboxer',
  'strdef+cardio':       'Marathon man',
  'strdef+chin':         'Wall',
  'strdef+wrestling':    'Mat general',
  'strdef+grappling':    'All-rounder',
  'strdef+takedef':      'Untouchable',
  'chin+cardio':         'Iron man',
  'chin+wrestling':      'Grinder',
  'chin+grappling':      'Mauler',
  'chin+takedef':        'Gatekeeper',
  'cardio+wrestling':    'Chain wrestler',
  'cardio+grappling':    'Python',
  'cardio+takedef':      'Stick-and-move',
  // NOT 'Chain grappler', which sat four rows from 'Chain wrestler' (cardio +
  // wrestling): two different builds whose names differed by one word. Same
  // confusion as Outfighter/Out-boxer, same fix.
  'wrestling+grappling': 'Constrictor',
  'wrestling+takedef':   'Mat general',
  // NOT 'Guard player'. High takedown defence means he is NOT on his back — the
  // old name described the opposite of the build it was attached to.
  'grappling+takedef':   'Submission threat',
}).map(([k, v]) => [k.split('+').sort().join('+'), v]));
// HOW MUCH AN ATTRIBUTE DEFINES A FIGHTER. Not how much it's WORTH — WEIGHTS
// already prices that at 1/9 each, deliberately, and this must not second-guess it.
// This is about language: nobody is called anything for having a chin. You are
// named for what you DO to someone (power, pace, technique, wrestling, grappling)
// and only described by what you RESIST with (chin, cardio, defence).
//
// It exists because of a real bug, not a hunch. The wrestler and grappler builds
// both max FIVE attributes — chin, cardio, wrestling, grappling, takedef — so every
// lean tied at +4 and the sort picked two of the five arbitrarily. Both read
// "Brawler-grinder": a grappler named after his chin, by tie-break order. Same
// shape as the MAX_FAVORITE pop() bug — relying on an order I never established.
const ARCH_SALIENCE = {
  power:1.00, grappling:1.00, wrestling:0.98, pace:0.92, technique:0.90,
  strdef:0.70, takedef:0.62, cardio:0.60, chin:0.50,
};
function archetype(a){
  a = a || G.attrs;
  const lv = ATTRS.map(A => ({ id:A.id, v:a[A.id]||0 }));
  const mean = lv.reduce((s,x)=>s+x.v,0) / lv.length;
  const spread = Math.max(...lv.map(x=>x.v)) - Math.min(...lv.map(x=>x.v));
  // A FLAT SHEET HAS NO ARCHETYPE, and saying so is more honest than picking the
  // biggest of nine equal numbers. Two ways to be flat and they are different
  // fighters: nothing spent yet, or spent evenly on purpose.
  if (spread < 2) return mean <= ATTR_MIN + 0.5 ? 'Prospect' : 'Well-rounded';
  // SALIENCE BREAKS TIES; IT DOES NOT SCALE THE LEAN. Multiplying the lean BY
  // salience — my first attempt — fixed the tie bug and quietly created a worse
  // one: it inflated the gap between two equally-high attributes of different
  // salience, so pace 10 + cardio 10 (identical leans!) read as a 2.2 gap and
  // stopped pairing. "Pressure fighter" became "Volume striker" because cardio is
  // a less nameable attribute, which is not the same fact at all. The lean is how
  // MUCH you leaned; salience is only which of two equal leans names the fighter.
  // Two questions, two places.
  const lean = lv.map(x => ({ ...x, d: x.v - mean }))
                 .sort((x,y) => (y.d - x.d) || (ARCH_SALIENCE[y.id] - ARCH_SALIENCE[x.id]));
  const top = lean[0], second = lean[1];
  // One lean, or two? Two only when the second is genuinely comparable — otherwise
  // every build reads as a hybrid and the word stops meaning anything.
  const paired = second.d > 0 && (top.d - second.d) < 1.2;
  if (!paired) return ARCH_ONE[top.id];
  // Every pair of the nine is named above, so this lookup is total — but fall back
  // to the primary rather than hyphenate. The first draft built names by splicing
  // words together and produced "Wrestler-bjj" and "Knockout artist-volume": an
  // invented name is worse than a plain true one.
  return ARCH_PAIR[[top.id, second.id].sort().join('+')] || ARCH_ONE[top.id];
}

// Playtest: "why do you get to pick attributes to build your fighter, then get
// another +7 right off the bat?" — a straight BUG. The creator's sliders and
// G.pts were two separate wallets that never spoke: G.pts was set once at
// newGame() and the sliders never decremented it. You placed 12 points in the
// creator and then got 7 more free. One pool now; the creator spends from it.
//
// UPGRADES ESCALATE. Playtest: "by the time I got to the championship fight I
// was nearly maxed out and was 88% against Ilia Topuria." Measured: maxed + 18
// wins is 97.8% vs the champ, maxed + 0 wins is 50.9%. The record is worth ~47
// points at the top, so once you've climbed you're unbeatable and the title
// fight is a formality.
//
// Flat costs let an 18-fight run buy EVERYTHING (18 fights x ~2pts + 12 start =
// 48, and maxing all five costs 45). So the fix isn't fewer points, it's that
// the LAST point in a category must cost more than the first. Now cost(v->v+1)
// = ceil(v/2): maxing one attribute costs 25, all five costs 125. A full run
// earns ~40. You can master one thing and be decent at another. You cannot be
// good at everything, so the build stays a real choice all the way up.
// Playtest: "now that there's more categories, should they start with more
// points?" Yes. Measured, and 12 was nearly meaningless: your ENTIRE starting
// budget was worth ~6 points of win probability. Spend nothing (all 1s) and you
// debut at 42% across the gatekeepers; spend all 12 and you're at 48-53%. The
// creator screen barely existed.
//
// 24 buys a real build with an identity — a tilt plus a floor — and moves the
// debut to ~60%. Not a gimme, but not a coin flip you had no say in.
//
// "A SPREAD BUILD BEATS A SPECIALIST" — WITHDRAWN. This comment used to carry a
// measured table showing spread winning at every budget, and concluded the model
// rewards a floor everywhere. It was an artefact of the fantasy stat curve: the
// top of every attribute was off the end of the model's training range and
// therefore inert, so buying a 10 bought nothing and spreading was strictly
// better. Once the curves were anchored to real lightweights the finding
// reversed — specialists now win by ~9 points at a 24-point budget.
//
// Keeping the corpse visible on purpose. The number was real, the measurement
// was clean, and the conclusion was still wrong, because the bug was in the
// thing generating the inputs rather than the thing being measured. Measuring
// your own broken assumptions very carefully just gets you confident about them.
// THE ECONOMY IS SIZED AGAINST THE CEILING, and the ceiling is no longer mine to
// pick — level 10 is a real fighter now, so the only free variable is how many
// points exist. Merging seven attributes into four cut the cost of a maxed-out
// fighter from 70 points to 40, while a run still paid ~59. The effect was
// instant and visible: an easiest-path bot went from 0/8 championships to 4/8,
// because it was maxing every attribute by mid-run and binning the change.
//
// That is precisely the playtest complaint from earlier — "by the time I got to
// the championship fight I was nearly maxed out and was 88% against Ilia
// Topuria" — re-created by a change that had nothing to do with the economy.
// Worth the note for next time: MERGING ATTRIBUTES IS A BUDGET CHANGE IN
// DISGUISE. Fewer sliders means a cheaper ceiling means a richer player.
//
// So: 24 -> 14 to start. 14 is 35% of a maxed fighter, the same fraction 24 was
// of the old 70-point ceiling — the creator screen is worth what it was worth.
// POINTS_START 42, AND THIS IS PART OF THE SHORT LADDER — not a separate dial.
//
// Read the cliff off the real board (scripts/climb-arithmetic.cjs):
//     gatekeeper 46.9  ->  #15 62.2   = a 15.3-point step
// A 20-point debut rates 53. It enters the rankings NINE points below the man it
// meets, and one gatekeeper win pays ~3 points, so no realistic number of tune-up
// fights bridges 15.3. The old 5-win unranked phase was secretly a points ramp
// wearing a matchmaking costume — that's why cutting it to 1 only works if the
// points arrive some other way. Parts 1 and 2 are ONE change; either alone is
// worse than neither.
//
// 42 lands the debut at 74 — a ~74% favorite over #15, and a live dog against
// anyone above #12. That IS the hyped-prospect premise: "a fighter doesn't
// actually start in the UFC at 0-0 ever ... assume this fighter is coming in as a
// hyped up prospect with a proven regional record." You arrive able to beat the
// bottom of the division and nobody above it.
//
// 74 for ANY build, not just a striker: WEIGHTS are 1/9 each now, so a point buys
// the same rating wherever it goes and every archetype debuts on the same number.
// Under the old 0.39/0.39 weights this line read "74 (striker)" and the ground
// archetypes debuted at 85 — same budget, 11 free rating.
const POINTS_START = 42, ATTR_MAX = 10, ATTR_MIN = 1;

// MILD RISING COST — 1pt through level 3, 2pts through 7, 3pts at 8 and 9.
//
// THIS COMMENT USED TO BE TITLED "FLAT COST — one point per level, always" and it
// sat directly above a line that has not been flat for a long time. Everything
// under that heading argued, at length and with measurements, for a pricing
// scheme the code wasn't using. Four more of its claims were also false by the
// time anyone re-read them: "maxing one = 18" (it's 17 — ATTR_MIN is 1, so nine
// steps, not ten), "7 attributes x 10 levels = 70 points" (there are NINE
// attributes and maxing all of them costs 153), "a full run earns ~45-50"
// (measured over 200 runs: the run earns ~16 on top of the 42 start, landing at
// 58, range 43-63), and "the attributes are worth wildly different amounts
// (grappling 8.9 win% end to end, technique 0.7) — that's the real open problem",
// which the equal-WEIGHTS fix SOLVED. Every slider is 1/9 now. The comment was
// still calling it open.
//
// So: read the line, not the paragraph above it.
//
// WHAT IS ACTUALLY TRUE ABOUT THIS CURVE, measured 2026-07-16:
// value per point DECLINES as you commit (L=2 0.0761, L=6 0.0631, L=10 0.0588),
// so spreading beats specialising and 9->10 is the worst buy on the sheet. That
// is backwards from what a build-a-fighter game wants, AND IT DOES NOT MATTER:
// ATTR_MAX caps everyone, so the spread edge is +4.0 rating at the 42-pt debut
// (59% vs 50% against a 74-power man) and +0.4 by the 100-pt title fight (96% vs
// 96%). The distortion dies in the region the game leaves immediately. The game
// agrees: at N=500 the mechanically-optimal \`balanced\` bot scores 20% — MID, behind
// wrestler's 22%. If the curve mattered, balanced would run away with it.
// Deliberately not fixed. See THE-CLIMB-TUNING.txt, "THE COST CURVE — CLOSED".
const upCost = v => 1 + Math.floor(v/4);   // 1-3:1pt  4-7:2pts  8-9:3pts. Maxing one = 17.
const pct = n => Math.round(n)+'%';

// ONE GATEKEEPER FIGHT. Not five.
//
// The playtest ask was real — "should there be more tune-up fights at the
// beginning in order to earn more attributes?" — but the answer of 5 tune-ups
// solved it with the WRONG CURRENCY. What he wanted was points before the
// division hits back; what 5 tune-ups charge for those points is fights, and
// fights cost losses.
//
// The arithmetic: every unranked LOSS forces another unranked win, so a 5-win
// requirement is 5 fights only if you never lose. Measured, the old 3-win rule
// already ran EIGHT fights in a real run at 51%->84%, and produced 3 of that
// run's 5 losses. It is the worst place in the game to spend the loss budget:
// you are burning a 5-loss allowance on men who cannot advance you a single rung.
//
// So the points now arrive at the creator screen (POINTS_START 42) where they
// cost nothing, and the gatekeeper is one fight — a proof, not a ramp. Parts 1
// and 2 are one change.
const UNRANKED_WINS = 1;

// HOW MANY LOSSES ENDS THE RUN.
//
// Playtest reframed the whole game: "the challenge is really: how quickly can
// you become a champion, and with what record? not can you become a champion in
// 2 losses or less." That is a better game and it dissolves a problem rather
// than tuning it.
//
// Two losses made survival the ONLY thing that mattered, which is what drove the
// runaway: to survive 15 fights at 2 losses you must be a heavy favorite in all
// of them, so the economy had to make you one, so the belt became a formality.
// The cut rule and the god-stats were the same bug wearing two hats. It also
// made the easiest-path bot the strongest strategy (32% vs 20% for bold), since
// dodging is worth more than climbing when one bad night ends everything.
//
// With the rating bounded, wins are genuinely hard and a 2-loss cut would be
// brutal. So losses become a COST, not a coin flip that deletes the run: they
// cost you rank, time and a soft matchmaking step-down. The score is the record
// you got there with.
const CUT_AT = 5;
const START_AGE = 24, MONTHS_PER_FIGHT = 4;

// THE REGIONAL RECORD YOU ARRIVE WITH. Playtest, and it's the premise the whole
// economy was already built on: "a fighter doesn't actually start in the UFC at
// 0-0 ever ... assume this fighter is coming in as a hyped up prospect with a
// proven regional record." POINTS_START 42 has encoded that since the short
// ladder went in — a debut rating of 74 IS a 10-0 prospect — but the scoreboard
// still said 0-0, so the number the player read contradicted the fighter the game
// had actually built. This is that premise, said out loud.
//
// DISPLAY ONLY, AND THAT IS LOAD-BEARING. G.wins and G.losses are the UFC record
// and every rule in the game reads them: G.wins >= UNRANKED_WINS ranks you,
// G.losses >= CUT_AT ends the run. Adding 10 to G.wins at the source would rank
// you before your debut and is exactly the class of change that breaks four things
// silently. The regional record is added at the point of PRINTING and nowhere else.
const REGIONAL = { w: 10, l: 0 };
const ufcRecord   = () => G.wins + '-' + G.losses;
const totalRecord = () => (REGIONAL.w + G.wins) + '-' + (REGIONAL.l + G.losses);
// buildStats() and the CURVES table are GONE. They existed to translate sliders
// into the nine stat levers the sim read (kd, slpm, strAcc...). Nothing reads
// them now — the game scores from attributes directly. Deleting them removes the
// single most expensive thing in the loop: winProb() used to rebuild the entire
// scorer, re-index 346 fight histories and re-run strength-of-schedule on every
// call, three times per offer screen. It is now arithmetic.
//
// The curve-anchoring work is NOT wasted: it lives on in gen-climb-curves.cjs
// and in the ladder's power scores, and it's what taught us the division's real
// shape. It just isn't in the hot path any more.

// ── scoring a fight: THE GAME'S MODEL, not the sim's ────────────────────
//
// THE SIM NO LONGER REFEREES. It builds the ladder (ladder[].power — rank-led,
// sim-textured, so climbing feels like the real UFC) and it stops there. Who
// wins is decided here, by rules we control.
//
// WHY. Measured across 2,600 possible three-man offers: a striker, a wrestler
// and a grappler wanted the SAME opponent 92% of the time. The sim is a power
// ladder, not a matchup engine — it was trained to price real fights, and real
// fight pricing is dominated by "who's better", with style as a rounding error.
// The whole loop of this game is "pick your matchup". You cannot build that on a
// model with no opinion about matchups, and every hour spent tuning attributes
// on top of it was rearranging furniture in a house with no floor.
//
// So: the sim is kept for the one thing it's genuinely great at and the game
// can't fake — how good a fighter really is. The style triangle below is ours,
// invented, and tuned to be FELT (~10 pts of win probability, where the sim
// offered ~1). EA UFC invents its style system too. Nobody minds.
//
// What is still real: every fighter, their stats, their record, their rank, and
// their relative strength. What's invented: the triangle. That's an honest line
// to draw and an honest one to say out loud.

// ── THE DIFFICULTY DIALS ────────────────────────────────────────────────────
// All of it, in one place, tunable, ours. This is the thing that did not exist
// while the sim refereed: there was nowhere to turn. Every "balance change" was
// really a change to how sliders mapped onto a model that had already made up
// its mind, which is why they kept cancelling out.
//
// The ladder runs from ~43 (a gatekeeper) to ~105 (Topuria). The player's rating
// MUST span that or the game is decided before it starts. The first cut of this
// mapped a maxed fighter to 73 against a 105 champion — a 0.2-2.0 record and a
// cut inside three fights, every time, for every build.
//
// The realistic ceiling is NOT a maxed sheet. Nine attributes x 10 levels = 90
// points; a championship run earns ~14 + 2/win ~= 44. So a good end-of-run
// fighter sits near t=0.5, and t=0.5 is what has to land at title level — not
// t=1.0, which no one will ever see.
// THE RATING IS BOUNDED BY THE DIVISION. This is the fix I named hours ago and
// then spent the whole session not doing.
//
// Playtest: "i was able to go 20-1 in lightweight and win the belt, pretty
// easily. once i started getting a lot of upgrades, i was pretty much -1000
// against everyone." Measured, exactly right:
//
//     pts spent   your rating   vs Gaethje (100.7)
//        20            70          5%   +1900
//        50           105         59%    -144
//        80           143         95%  -1900   <- a 20-fight run
//
// You don't beat the division, you OUTGROW it. 36 + t*200 runs to 236 while the
// best lightweight alive rates 100.7. Nothing in the model said "you cannot
// become twice Makhachev".
//
// And this is the loop I diagnosed in my own commit message and then ignored:
// "winning pays points, points make you stronger, strength wins more... the real
// fix is to damp the loop, not to hunt for a magic constant." I then hunted for
// magic constants for hours. POINTS_START 24 -> 14 -> 20. RATING_SPAN 46 -> 124
// -> 200 -> 150 -> 200. Rewards 1-3 -> 1-2 -> risk x altitude. Every one of
// those moved WHERE THE LINE STARTS. Not one of them touched its SLOPE. That is
// why the game kept flipping between coronation and massacre.
//
// Now: a maxed fighter asymptotes just above the division's champion. Level 10
// across the board means "as good as anyone alive in this weight class" — which
// is what level 10 was defined to mean when the curves were anchored — instead
// of a demigod. The ceiling is per-division and read off the ladder, so no
// future budget tweak can recreate a 143-rated lightweight.
// CALIBRATED AGAINST THE LADDER, NOT AGAINST ITSELF. This is the fix every other
// fix today was standing in for.
//
//     THE LADDER            WHERE YOU WERE
//     gatekeepers 44-54     debut (20 pts) = 62   <- above EVERY gatekeeper, day one
//     #15         68.6      40 pts         = 79   <- above #15 after four wins
//     #1          93.8      70 pts         = 102  <- above the #1 contender
//     champion   100.7      85 pts         = 105
//
// You didn't climb the ladder, you leapfrogged it. Rating and power were two
// different scales sharing an axis, and EVERY symptom today came out of that one
// mismatch: heavy-favorite boards ("no reason to pick anyone over anyone else"),
// the 20-1 run, the easiest-path exploit, rank lagging rating so the matchmaker
// served nobodies. I kept treating those as separate problems and tuning a
// different dial for each.
//
// Now: the scale you're measured on is the scale you're climbing, so "near your
// rank" finally means "near your level" and the board asks a real question. A
// full ~70-point run rates 100, level with the champion.
//
// The DEBUT moved with POINTS_START. It is no longer 20 points / rating 55: the
// hyped prospect starts at 42 and rates 74, which is a ~74% favorite over #15 and
// a live dog against anyone above #12. RATING_MIN is still the floor a 0-point
// fighter would sit at, and nobody is ever there.
const RATING_MIN  = 30;      // the floor; a 42-pt debut lands ~74 (see POINTS_START)
// HISTORICAL, AND NO LONGER TRUE — kept because the reasoning is still a warning.
// This block used to read: "a KNIFE EDGE ... span 150 -> 0/8, 175 -> 0/8,
// 200 -> 0/8, 215 -> 4/8. Nothing, nothing, nothing, then half." Those numbers
// were measured BEFORE the rating was calibrated against the ladder, when rating
// and power were two scales sharing an axis — which is why the span had to reach
// 215 to do anything at all, and why it then did everything at once. The block
// outlived its regime: it sat directly above a constant of 168 that it does not
// describe and could not justify, arguing that 200 was the safe value. A comment
// that survives the thing it measured is worse than no comment, because it reads
// as evidence. (The tuning file lists this failure mode; this was an instance of
// it sitting in the file the whole time.)
//
// The runaway-loop concern was real and MAY STILL BE — winning pays points,
// points make you stronger, strength wins more. It just isn't what these numbers
// show. Re-measure before quoting a cliff.
//
// 168 -> 150: A RE-FIT, NOT A TUNE. The span's job is fixed — "~70 pts (a full
// run) reaches ~100, level with the champion" — and equalising WEIGHTS to 1/9
// changed what a point is worth, so the same job needs a different number.
// Measured against the real ladder at 70 pts: span 168 -> 106.5 (champion level
// on the nose, i.e. a full run IS the champion), span 150 -> 100.8. Leaving 168
// under the new weights would have quietly handed every run ~6 free rating.
const RATING_SPAN = 150;     // re-fitted for WEIGHTS=1/9 so ~70 pts (a full run) reaches ~100
const CAP_OVER    = 5;       // a maxed fighter tops out this far above the champion
// STYLE_MAX 11 -> 22. THE MATCHUP SCREEN WAS DECORATION AND THE FILE SAID SO ONCE
// ALREADY: "Rank outweighed style 6:1, so cherry-picking your matchup scored
// identically to picking at RANDOM (16% vs 16%)." Measured again on the current
// board: rank 5.3 : 1 style. The old fix was STEP 3 -> 1 (narrow the bands so the
// three men are the same size); the SHORT LADDER then needed STEP 3 back, the
// power spread returned to 9.0, and rank retook the wheel. A regression undone by
// a later fix, which is why it needs a dial of its own rather than a band width.
//
// Measured at N=300, cherry-picking (safe) vs picking blind:
//     STYLE_MAX 11   safe 14%  blind 11%   a 3-point edge
//     STYLE_MAX 22   safe 18%  blind 10%   an 8-point edge
// Reading the board goes from marginal to nearly doubling your belt rate. That IS
// the playtest spec: "if you cherry pick favorable matchups, that should be an
// advantage, not the same as picking randomly."
//
// The cost is honest and worth writing down: style is not symmetric across the
// roster. Heavyweight is full of strikers with ordinary takedown defence, so
// amplifying the triangle amplifies the wrestler's systematic edge there too —
// grappler sits above striker by ~7 points and that gap grew with this change.
// STYLE_MAX IS A SAFETY RAIL, NOT A DIAL — DO NOT REACH FOR IT TO TUNE STYLE.
// Measured over 5,256 build x opponent x division combinations: |styleDelta| has
// a median of 3.5 and a p99 of 15.7, so a cap of 22 FIRES ON 0.13% OF MATCHUPS.
// Dropping it to 16 would touch 0.84%. It cannot move the balance because it
// almost never sees the ball. (It was 11 once, where it clamped often and did
// behave like a dial — which is where the folklore that it's tunable comes from.)
// Its real job is to stop one absurd stat line producing a 30-point swing.
const STYLE_MAX   = 22;      // biggest style swing, in points of win probability

// STYLE_SCALE IS THE DIAL. It multiplies every term before the clamp, so it moves
// the whole distribution — the median matchup, not just the outliers.
//
// 1.0 = the style triangle at full voice. The reason to turn it DOWN is that a
// division's style balance is really ONE MAN's stat line: every run must beat the
// champion, and his styleDelta against your build is worth ~2x on the belt.
// Measured at 1.0: LHW striker 46% vs wrestler 23%, because Carlos Ulberg has
// elite takedown defence (86%) and a chin that has been cracked (0.41) — a
// striker's dream. Tom Aspinall is the mirror (100% TDD, 3.3 KD/15) and HW
// striker is 23%. Neither is a bug; both are the matchup engine working. The
// question is only how loud one man's stat line should be.
const STYLE_SCALE = 0.75;
const SCALE       = 26;      // rating gap for ~3:1 odds. Lower = the ladder decides
                             // more and your build decides less.

// LEVELS COST MORE AND MEAN MORE. Both curves are ours now, and that is the only
// reason this finally works. It failed twice before, each time because only ONE
// side was controllable:
//   1. Cost escalated (ceil(v/2)) while the stat curve was linear -> the top was
//      priced up and paid the same. Double penalty. Playtester caught it.
//   2. Curves anchored to real fighters made value convex, so cost went flat.
//      Measured: escalating cost then made every build converge on maxing the
//      single best attribute, because deep levels are only affordable once.
// The trap both times was that the MODEL owned value and I owned price, so I
// could only ever push one lever and watch the other refuse to move.
//
// Now: value grows as v^1.6, cost grows as 1+floor(v/4).
//
// THE NEXT SENTENCE USED TO SAY "value slightly outruns cost at the top, so
// committing is rewarded — a 10 is worth reaching". MEASURED, IT IS FALSE, and it
// is false in the direction that matters. Cumulative value per point, taking one
// slider from 1 to level L:
//     L=2  0.0761   L=4  0.0769   L=6  0.0631   L=8  0.0636   L=10  0.0588
// Efficiency DECLINES. The 9->10 step is the worst buy on the sheet (0.0517/pt)
// and 3->4 is the best (0.0852/pt). Spreading strictly beats committing, and the
// "commit and be rewarded" shape the design wants is not in these two curves —
// it was asserted, not measured, and the assertion sat here reading as evidence.
//
// NOT FIXED THIS PASS, deliberately: the fix is a real design change (taper the
// cost, steepen the value, or cap the spread) and it wants its own measurement
// against the harness rather than being bolted onto a ladder change. It is also
// SMALLER than it looks, because the priority-order bots all commit anyway and
// the ladder still moved without it. Left as the honest next question.
//
// Also: maxing one attribute costs 17, not 18 — ATTR_MIN is 1, so it's nine
// steps, not ten. Three maxed attributes cost 51 of a ~44-point earn plus a
// 42-point start, so "three is impossible" is no longer true either; see the
// note in THE-CLIMB-TUNING.txt.
const ATTR_CURVE = v => Math.pow(Math.max(0,v)/ATTR_MAX, 1.6);

// Your rating. Weights are the GAME'S opinion of what wins fights — not the
// sim's. They sum to 1, so the sheet is balanced by construction rather than by
// me measuring it afterwards and being surprised. THAT is what was impossible
// before: every earlier balance pass was archaeology on a model that wouldn't
// move. This is a design decision, written down, in one place, changeable.
// THE TWO STYLES MUST BE WORTH THE SAME. Playtest: "becoming a striking
// specialist weighs a lot more heavily than a grappling specialist."
// Correct, and it was structural rather than subtle:
//
//     striking  power .13 + pace .10 + technique .10 + strdef .11 = 0.44
//     ground    wrestling .12 + grappling .12 + takedef .11       = 0.35
//
// Striking is FOUR sliders and the ground is THREE, so a striker who maxes his
// specialty owned 26% more of the rating than a grappler who maxed his. The per
// slider numbers looked balanced; the per-STYLE totals never were, and the style
// is what the player actually picks. I set these by eye and checked the wrong
// axis.
//
// Each style then totalled 0.39, chin+cardio the remaining 0.22, so maxing "the
// ground" and maxing "the feet" bought exactly the same ceiling.
//
// ...and that answer is measured on the WRONG AXIS — the same mistake as the
// paragraph above it, one level up. "I set these by eye and checked the wrong
// axis" was written about the 0.44/0.35 weights BY the change that replaced them,
// and the replacement did it again: it checked the ceiling instead of the price.
// Read on.
//
// EQUAL STYLE TOTALS MADE THE GROUND 25% CHEAPER. The 0.39/0.39 split balances
// what each style is worth WHEN MAXED. It does not balance what each style COSTS,
// and the player spends points, not weights:
//
//     feet    0.39 spread over FOUR sliders  -> 4 x 17 = 68 pts to own it
//     ground  0.39 spread over THREE sliders -> 3 x 17 = 51 pts to own it
//
// Same ceiling, 17 fewer points. Every slider costs the same to raise, so
// concentrating a style's weight into fewer sliders is a straight discount. The
// styles are equal only at a budget nobody has: measured best rating per budget,
// the ground leads by +4.7 at 20 pts, +12.7 at 42, +15.5 at 50 — and 50 is where
// a championship run lives. At SCALE 26 that last one makes a same-budget
// grappler an 80% FAVORITE over a same-budget striker before the triangle says a
// word. That is fix (c), and it is not the style triangle: measured, flattening
// these weights moves striker 3%->8% and wrestler 30%->20%, closing four fifths
// of a 10x gap. The triangle is the residual, and it is small.
//
// The weights this replaced (striking 0.44, ground 0.35) were near the 4:3 ratio
// that makes points buy equally in both styles. The playtest complaint —
// "becoming a striking specialist weighs a lot more heavily than a grappling
// specialist" — was TRUE and was not a bug: maxing the feet weighed 26% more
// because it cost 33% more. Flattening the totals to 0.39/0.39 answered it by
// inverting it. I checked "is each style worth the same?" when the question the
// player asks is "does each point buy the same?"
//
// EVERY SLIDER IS WORTH 1/9. That is the only assignment where a point buys the
// same rating wherever it goes, because every point costs the same wherever it
// goes. Style totals now differ by construction — feet 4/9, ground 3/9 — and
// that asymmetry is CORRECT: the feet are four sliders and cost four sliders'
// worth. Rating measures how far you have climbed; the style triangle decides who
// beats whom. Those are separate jobs and this is what stops the rating doing
// both.
const W1 = 1/9;
const WEIGHTS = {
  // the feet — 4 sliders, 4/9 together, because they cost 4 sliders to buy
  power:W1, pace:W1, technique:W1, strdef:W1,
  // the ground — 3 sliders, 3/9 together, at the same price per point
  wrestling:W1, grappling:W1, takedef:W1,
  // neither, and both
  chin:W1, cardio:W1
};
// The division's ceiling, read off the ladder rather than picked. In a soft
// division the cap is lower — you cannot farm a weak weight class into a rating
// that would flatten a strong one.
function divCap(){
  const champ = LADDER().find(f=>f.rankNum===0);
  return (champ ? champ.power : 101) + CAP_OVER;
}
function myRating(a){
  let t=0;
  for(const A of ATTRS) t += (WEIGHTS[A.id]||0) * ATTR_CURVE(a[A.id]||0);
  const raw = RATING_MIN + t * RATING_SPAN;
  const cap = divCap();
  if (raw <= cap - 12) return raw;
  // Soft landing rather than a wall: the last 12 points of headroom compress
  // into a smooth approach, so late upgrades still DO something — they just
  // can't take you past the best fighter in the world by 40 points.
  const over = raw - (cap - 12);
  return (cap - 12) + 12 * (1 - Math.exp(-over/12));
}

// THE STYLE TRIANGLE — the game's whole point, and the thing the sim couldn't do.
// Read against the opponent's REAL stats, so the invention bites on something true.
//   - Your wrestling is worth a lot against a man with bad takedown defence,
//     and close to nothing against Topuria's 95%.
//   - Your submissions punish whoever ends up on the mat — the wrestler who
//     shoots on you, or the man you put down yourself.
//   - Your striking pays against someone who gets hit, and stalls against a
//     high-guard defensive fighter.
//   - Your takedown defence is worth everything against a wrestler and nothing
//     against a kickboxer. A counter-pick, and it should read like one.
// STYLE IS AN INTERACTION, NOT A SECOND QUALITY SCORE.
//
// The first version centred every term on 0.5 — "is your wrestling above the
// midpoint" — and it inverted the whole feature. Measured: a pure wrestler at #8
// got style -6.4, -5.0 and -8.2 against three men, one of whom he should maul.
// His level-1 striking was penalised HERE, when myRating() had already charged
// him for it. Style read as "how good are you overall", a second time, so a
// specialist was taxed twice for specialising — the exact opposite of the point.
//
// Now every term is centred on YOUR OWN AVERAGE. A wrestler's wrestling sits
// above his mean and reads as a strength; his striking sits below it and reads
// as a hole. A perfectly balanced fighter nets ~0 however good he is, which is
// right: being well-rounded is a quality, and quality is what the rating is for.
// Style only answers "does what I'm good at hurt THIS man".
// DIVMEAN — what "average" means IN THIS DIVISION.
//
// styleDelta's stated principle is "every term is centred on YOUR OWN AVERAGE",
// and it applies that scrupulously to the PLAYER (see rel(), below) and not at
// all to the OPPONENT, who is measured against hardcoded constants. Those
// constants were fitted once, and they are only correct for one division:
//
//     glass = 0.55 - their chin      <- 0.55 is LIGHT HEAVYWEIGHT's mean chin
//
// Everyone else is more durable than that, so \`glass\` goes negative against the
// whole ladder and A MAXED PUNCHER IS PENALISED FOR HAVING POWER — in ten
// divisions out of eleven. Measured, the striker's mean styleDelta was negative
// in ALL of them (-7.0 in BW, 0.0 in LHW) and the belt rate tracked it: LHW is
// the one division where the constant was right, and the one where the striker
// won 48% of the time. That is not a striker who is good at light heavyweight;
// that is a constant that is right once.
//
// Centred on the division, term 5 nets ~0 across any ladder by construction, and
// only says what it was always supposed to say: "is THIS man, relative to the
// men around him, someone my power hurts?" A division of iron chins is not a
// division where power is worthless — it's one where the few crackable jaws are
// worth hunting.
// Module-level ON PURPOSE: render() rebuilds #app from scratch, so anything scoped
// inside it resets on every tap. The disclosure has to remember it's open.
let scoutOpen = false;

let _DM = {}, _DMdiv = null;
function DIVMEAN(key, fallback){
  if (_DMdiv !== DIV) { _DMdiv = DIV; _DM = {}; _DS = {}; }
  if (_DM[key] != null) return _DM[key];
  const L = LADDER();                    // pure accessor, no side effects
  if (!L || !L.length) return fallback;
  let s = 0, n = 0;
  for (const f of L) { const v = f.style ? f.style[key] : null; if (v != null) { s += v; n++; } }
  return _DM[key] = n ? s / n : fallback;
}
// The division's SPREAD on a stat — how unusual "unusual" is around here. Only the
// scouting report needs this; styleDelta centres on the mean and scales by hand,
// because its coefficients are a design statement about what wins fights, not a
// measurement of the roster.
let _DS = {};
function DIVSD(key, fallback){
  if (_DMdiv !== DIV) { _DMdiv = DIV; _DM = {}; _DS = {}; }
  if (_DS[key] != null) return _DS[key];
  const L = LADDER();
  if (!L || !L.length) return fallback;
  const m = DIVMEAN(key, 0);
  let s = 0, n = 0;
  for (const f of L) { const v = f.style ? f.style[key] : null;
    if (v != null) { s += (v - m) * (v - m); n++; } }
  return _DS[key] = n > 1 ? Math.sqrt(s / n) : fallback;
}

// SCOUT THE CHAMPION AGAINST THE CONTENDERS, NOT AGAINST THE LADDER.
//
// The ladder is 16 ranked men and 24 gatekeepers, and a champion is unusual
// against a gatekeeper on every axis that exists. Z-scoring him over the whole
// pool therefore lit up EVERY stat: measured, "high volume" fired for 7 of the 11
// champions, which is not a scouting report, it's boilerplate — and it crowded
// Carlos Ulberg's cracked chin, the one thing worth knowing about him, off his own
// line. The right comparison class for "is this champion unusual?" is the men who
// are also contenders.
// styleDelta keeps using the full-ladder DIVMEAN, and should: you actually fight
// the gatekeepers, so they belong in the average that prices those fights.
let _RM = {}, _RS = {}, _RMdiv = null;
function rankStat(key, fallback){
  if (_RMdiv !== DIV) { _RMdiv = DIV; _RM = {}; _RS = {}; }
  if (_RM[key] != null) return { m: _RM[key], sd: _RS[key] };
  const L = (LADDER() || []).filter(f => f.rankNum < 99 && f.rankNum !== 0);
  if (L.length < 3) return { m: fallback, sd: 1 };
  let s = 0, n = 0;
  for (const f of L) { const v = f.style ? f.style[key] : null; if (v != null) { s += v; n++; } }
  if (!n) return { m: fallback, sd: 1 };
  const m = s / n;
  let q = 0;
  for (const f of L) { const v = f.style ? f.style[key] : null; if (v != null) q += (v - m) * (v - m); }
  _RM[key] = m; _RS[key] = n > 1 ? Math.sqrt(q / n) : 1;
  return { m: _RM[key], sd: _RS[key] };
}

// THE SCOUTING REPORT — what the champion is, never what you should do about it.
//
// Every run must beat exactly one man, so his stat line, not the division's
// average, decides the division's style balance. Measured: Carlos Ulberg (86%
// TDD, 0.41 chin) makes LHW a 40% belt for a striker and a 21% belt for a
// wrestler; Tom Aspinall (100% TDD, 3.3 KD/15) inverts it at heavyweight. That
// was invisible — the picker showed his NAME and nothing else, so the single
// biggest determinant of a run was a thing you found out by losing to it.
//
// THE LINE THIS FUNCTION WILL NOT CROSS: it takes \`st\` and nothing else. It
// cannot see G.attrs, and that is deliberate, not incidental. The moment a
// scouting report reads your build it stops describing a fighter and starts
// printing the answer — "you're +4.8 against him", "strikers are favoured here" —
// and the 42-point decision solves itself. A scout describes the man; the read is
// yours. Two players should be able to look at Ulberg and disagree: "he can be
// hurt" invites a puncher, but 86% takedown defence is only a problem if you were
// going to shoot, and a technician might just outbox him. That argument is the
// game. \`strikers win here\` would end it.
//
// GRADED, AND GRADED AGAINST HIS OWN DIVISION. Two reasons. First, these are real
// people: "won't be wrestled" is an overclaim about Carlos Ulberg, and "difficult
// to wrestle" is simply true. Nothing here should say more than the stat sheet
// can carry. Second, 86% takedown defence means something different at heavyweight
// than at strawweight, and styleDelta already centres on the division — a report
// centred anywhere else would be describing a different fight from the one the
// game scores.
function champScout(st){
  if (!st) return null;
  const mTdd = DIVMEAN('tdDef', 66), mChin = DIVMEAN('chin', 0.6),
        mKd  = DIVMEAN('kd', 0.5),   mSlpm = DIVMEAN('slpm', 4.4),
        mSub = DIVMEAN('sub', 0.5),  mTd   = DIVMEAN('td', 1.4),
        mSd  = DIVMEAN('strDef', 53);
  const g = (k, d) => { const v = st[k]; return v == null ? d : v; };
  // Z-SCORES, NOT HAND-PICKED DENOMINATORS. The first version of this divided each
  // stat by a constant I chose by eye (kd by ~0.6, tdDef by 18), which made the
  // weights incomparable across axes: knockdowns have a small mean, so dividing by
  // it inflated kd's weight ~2x against everything else. "Show the loudest three"
  // then ranked my arbitrary denominators rather than the fighter. It printed
  // "[Submission grappler]" for TOM ASPINALL — the most feared puncher in the
  // sport — and dropped Carlos Ulberg's cracked chin, the single most
  // decision-relevant fact about him, off his own scouting line.
  // Dividing by the DIVISION'S OWN SPREAD makes every axis mean the same thing:
  // "how unusual is he, among the men he fights".
  // AGAINST THE CONTENDERS for "is he unusual", because a champion is unusual
  // against a gatekeeper on every axis and z-scoring over the whole ladder made
  // "high volume" fire for 7 of 11 champions.
  const z = (k, d) => { const r = rankStat(k, d);
    return r.sd < 1e-6 ? 0 : (g(k, d) - r.m) / r.sd; };
  // ...but his HOLES are priced by the engine against the FULL ladder, because
  // that is the mean styleDelta centres on. Keep the two straight: \`z\` answers
  // "is this remarkable", \`zEng\` answers "will this actually move a fight".
  const zEng = (k, d) => { const s = DIVSD(k, 1);
    return s < 1e-6 ? 0 : (g(k, d) - DIVMEAN(k, d)) / s; };
  const zTdd = z('tdDef', 66), zChin = z('chin', 0.6), zKd = z('kd', 0.5),
        zTd  = z('td', 1.4),   zSub  = z('sub', 0.5),  zVol = z('slpm', 4.4),
        zSd  = z('strDef', 53);
  // A THREAT AND A HOLE — not "the two most unusual things".
  //
  // Ranking purely by |z| surfaces threats and buries holes, because a champion's
  // holes are BY DEFINITION his least remarkable trait. Measured, that read gave
  // Carlos Ulberg "high volume, real knockout power" and never mentioned the 0.41
  // chin — which is the entire reason light heavyweight is a 40% belt for a
  // puncher and a 21% belt for a wrestler. The one fact worth knowing lost a
  // ranking contest to a stat that describes how busy he is.
  //
  // So the shape is fixed: his best weapon, then the way in, if there is one. That
  // is what a scout actually tells a fighter, and it guarantees the strategic half
  // of the report can never be crowded out by flavour. A champion with no hole
  // gets told he has no hole — which is its own, quite loud, piece of information.
  const pick = (arr, skip) => { const ok = arr.filter(x => x.w > 0.7 && x.s !== skip)
    .sort((a,b) => b.w - a.w); return ok[0]; };
  // HOLES ARE SCORED AGAINST THE CONTENDERS TOO, and the threshold is higher.
  //
  // First attempt scored them with zEng (the full-ladder mean the engine centres
  // on) and "has been stopped before" fired for 6 of the 11 champions. The cause
  // is a data artefact worth writing down: \`chin\` is derived from the RECORD, so a
  // gatekeeper with four fights and no stoppage losses reads 0.9, and 24 of those
  // drag the ladder mean above every champion who has actually been in wars. The
  // full-ladder mean says more about sample size than about jaws.
  // (This means styleDelta's own chin centring is inflated the same way. Left
  // alone deliberately — it's a real change and it wants its own measurement —
  // but it is now written down instead of being rediscovered a third time.)
  const holeZ = (k, d) => { const r = rankStat(k, d);
    return r.sd < 1e-6 ? 0 : (g(k, d) - r.m) / r.sd; };
  const hole = pick([
    { w: -holeZ('chin', 0.6),  s: 'durability concerns' },
    { w: -holeZ('tdDef', 66),  s: 'can be taken down' },
    { w: -holeZ('strDef', 53), s: 'hittable' },
  ]);
  // A LABEL, NOT A VERDICT. Derived from his own stats — archetype() reads player
  // attributes on a 1-10 scale and cannot be pointed at a real fighter's stat
  // sheet, so this is a separate, deliberately coarser thing. Driven by whichever
  // trait is genuinely loudest rather than by the order I happened to write the
  // branches in, which is what put Aspinall in the wrong bucket.
  const cands = [[zKd,'kd'],[zTd,'td'],[zSub,'sub'],[zVol,'vol']];
  cands.sort((a,b)=>b[0]-a[0]);
  const [tz, tk] = cands[0];
  const label = tz < 0.75                     ? 'Complete fighter'
              : tk === 'kd'                   ? (zVol > 0.75 ? 'Knockout artist' : 'Puncher')
              : tk === 'td'                   ? (zSub > 0.75 ? 'Submission grappler' : 'Wrestler')
              : tk === 'sub'                  ? 'Grappler'
              :                                 'Volume striker';
  // The label and the threat are drawn from the same stats, so the loudest threat
  // is usually just the label again: "Volume striker — High volume". Say the
  // second thing instead; the label already said the first.
  const SAYS = { 'Volume striker':'High volume', 'Knockout artist':'Real knockout power',
                 'Puncher':'Real knockout power', 'Wrestler':'Looks for the takedown',
                 'Grappler':'Submission threat', 'Submission grappler':'Submission threat' };
  const threat = pick([
    { w: zKd,  s: 'Real knockout power' },
    { w: zSub, s: 'Submission threat' },
    { w: zTd,  s: 'Looks for the takedown' },
    { w: zTdd, s: 'Difficult to wrestle' },
    { w: zVol, s: 'High volume' },
    { w: zSd,  s: 'Hard to hit' },
    { w: zChin,s: 'Hard to hurt' },
  ], SAYS[label]);
  const top = [];
  if (threat) top.push(threat.s);
  if (hole) top.push(hole.s);
  if (!top.length) top.push('No obvious holes');
  return {
    label,
    // NO PRONOUNS. The first version wrote "...but HE has been stopped before" and
    // printed it under Valentina Shevchenko and Kayla Harrison. These are real
    // people and three of the eleven divisions are women's; a hardcoded "he" is
    // just wrong, and inferring gender from the division key is a trap waiting to
    // happen (WW is Welterweight, WBW is Women's Bantamweight — the prefix does not
    // mean what it looks like it means). Noun phrases sidestep it entirely and fit
    // a phone better: "Real knockout power · durability concerns".
    read: (s => s.charAt(0).toUpperCase() + s.slice(1))(top.join(' · ')),
    rows: [
      ['Takedown defence', Math.round(g('tdDef', 66)) + '%', Math.max(0, Math.min(1, g('tdDef', 66) / 100))],
      ['Knockout power',   g('kd', 0.5).toFixed(1),          Math.max(0, Math.min(1, g('kd', 0.5) / 3.5))],
      ['Durability',       g('chin', 0.6) < mChin - 0.08 ? 'Been stopped' : g('chin', 0.6) > mChin + 0.1 ? 'Rarely hurt' : 'Average',
                                                            Math.max(0, Math.min(1, g('chin', 0.6)))],
      ['Output',           g('slpm', 4.4).toFixed(1) + '/min', Math.max(0, Math.min(1, g('slpm', 4.4) / 9))],
    ]
  };
}

function styleDelta(a, st){
  const n = v => (v||0)/ATTR_MAX;
  let mean = 0; for(const A of ATTRS) mean += n(a[A.id]); mean /= ATTRS.length;
  // signed: +ve = one of your strengths, -ve = one of your holes
  const rel = id => Math.max(-1, Math.min(1, (n(a[id]) - mean) / 0.45));
  let d = 0;

  // 1. YOUR WRESTLING vs THEIR TAKEDOWN DEFENCE. tdDef runs ~40-95: a dominant
  //    wrestler mauls a striker who can't stop it and gets nothing at all
  //    against Aspinall's 95%. Openness is centred too, so an average-TDD man is
  //    a neutral matchup rather than a quiet bonus.
  //    CENTRED ON THE DIVISION. The old constant was \`- 0.5\`, i.e. zero at
  //    tdDef 67.5, which is a number about nothing.
  const tddOpen = (DIVMEAN('tdDef', 67.5) - (st.tdDef||60)) / 55;
  d += rel('wrestling') * tddOpen * 13;

  // 2. THEIR WRESTLING vs YOUR TAKEDOWN DEFENCE. The mirror, and why elite TDD
  //    is a counter-pick: everything against a grappler, nothing against a
  //    kickboxer. Your TDD hole only hurts when the man opposite can find it.
  //    CENTRED ON THE DIVISION.
  const theirTd = Math.min(1, (st.td||1.4)/4) - Math.min(1, DIVMEAN('td', 1.4)/4);
  d += rel('takedef') * theirTd * 13;

  // 3. YOUR GRAPPLING, but only if the fight hits the mat — he shoots, or you put
  //    him there. Submissions against a man who won't grapple and can't be taken
  //    down are worth nothing, which is correct. st.mat (1 = never tapped) prices
  //    what it's worth once you arrive.
  const toMat = Math.max(Math.min(1,(st.td||1.4)/4), n(a.wrestling) * Math.max(0,(95-(st.tdDef||60))/55));
  d += rel('grappling') * (toMat - 0.4) * 12 * (1.4 - (st.mat==null?0.8:st.mat));

  // 4. YOUR STRIKING vs THEIR STRIKING DEFENCE.
  //    CENTRED ON THE DIVISION.
  const sdOpen = (DIVMEAN('strDef', 53) - (st.strDef||52)) / 26;
  d += ((rel('power')+rel('technique')+rel('pace'))/3) * sdOpen * 10;

  // 5. YOUR POWER vs THEIR CHIN. "A finisher with durability should have an
  //    advantage over someone with durability concerns." Chin is read off their
  //    RECORD — how often they have actually been stopped — because there is no
  //    durability stat in the data and the record is what durability means.
  //    Dariush (0.24) and Hubbard (0.90) are different fights for a puncher, and
  //    were identical ones to every model we tried before this.
  //    CENTRED ON THE DIVISION, not on 0.55. See DIVMEAN, above.
  const _mc = DIVMEAN('chin', 0.55);
  const glass = _mc - (st.chin==null?_mc:st.chin);
  d += rel('power') * glass * 20;

  // 6. THEIR PACE vs YOUR CARDIO. Deliberately ONE-SIDED: it can only hurt. Great
  //    cardio against a low-output opponent is not an edge, it is an irrelevance
  //    — you don't win rounds by being fresh while nothing happens. Gassing
  //    against a pressure fighter loses the fight. Keyed off ABSOLUTE cardio, not
  //    rel(): a gas tank is a floor you have or don't, not a matter of emphasis.
  const theirPace = Math.max(0, ((st.slpm||4.4) - 4.0) / 2.9);
  d -= Math.max(0, 0.5 - n(a.cardio)) * theirPace * 18;

  // 7. THEIR POP vs YOUR CHIN. The mirror of 5: a fragile fighter has a problem
  //    against a puncher and none against a point-scorer.
  //    CENTRED ON THE DIVISION. A low-KO division is not one where a chin is
  //    free — it's one where the few real punchers are the fights you avoid.
  const _pop = s => Math.min(1, ((s.kd==null?0.4:s.kd)/1.2)*0.65 + ((s.slpm==null?4.4:s.slpm)/6.5)*0.35);
  const theirPop = _pop(st) - _pop({ kd: DIVMEAN('kd', 0.4), slpm: DIVMEAN('slpm', 4.4) });
  d += rel('chin') * theirPop * 14;

  return Math.max(-STYLE_MAX, Math.min(STYLE_MAX, d * STYLE_SCALE));
}

function oppByName(nm){
  const f = LADDER().find(x=>x.name===nm);
  if (!f && nm) console.warn('The Climb: "'+nm+'" is not on the '+DIV+' ladder — stale offer?');
  return f || null;
}

// P(win a single fight). Base from the rating gap, then the style triangle, then
// the record. Cardio is a real attribute now — it was impossible while the sim
// refereed, because the sim has no cardio input. Same for chin. The two things
// every fan argues about were the two the model couldn't hear.
function winProb(oppName){
  const o = oppByName(oppName); if(!o) return 0.5;
  const gap = myRating(G.attrs) - o.power;
  let p = 1/(1+Math.pow(10, -gap/SCALE));
  p += styleDelta(G.attrs, o.style||{})/100;
  // Momentum: a real climb rewards form. Small, so it flavors rather than rules.
  p += Math.min(0.04, (G.streak||0)*0.008);
  return Math.max(0.05, Math.min(0.95, p));
}
const fmtDate = d => d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
// bo3(x) = P(win >= 2 of 3 rounds) given a PER-ROUND probability x.
//
// THE UNITS BUG. winProb() used to return a per-round number, so the card showed
// bo3(p) and fight() rolled three rounds at p. Correct. Then the scorer was
// rewritten and winProb() started returning P(WIN THE FIGHT) — and neither
// consumer was told. So a 75% fighter was displayed AND resolved at bo3(0.75) =
// 84%, and at the 0.95 clamp at bo3(0.95) = 99.3%, which prints as -13,700.
//
// Playtest: "every matchup i was -1000 or higher, up to like -15,000... it
// LOOKED easy, which is boring, but i also lost, which doesn't line up." Both
// halves, one cause: the odds were inflated by a round->fight conversion applied
// to a number that was already a fight probability. It looked like a walkover;
// meanwhile 15 fights at a real ~90% still averages 1.4 losses and two gets you
// cut, so you died anyway.
//
// Now the units are explicit and named. winProb() = P(fight). roundP() inverts
// bo3 to get the per-round number the round-by-round display needs. The card
// shows P(fight) straight.
const bo3 = p => 3*p*p*(1-p) + p*p*p;
// Inverse of bo3: given P(win the fight), what per-round probability produces it?
// bo3 is monotone on [0,1], so bisect — closed form is a cubic and not worth it.
function roundP(pFight){
  let lo=0, hi=1;
  for(let i=0;i<40;i++){ const mid=(lo+hi)/2; if(bo3(mid) < pFight) lo=mid; else hi=mid; }
  return (lo+hi)/2;
}
// ODDS ARE A BAND BEFORE THE FIGHT, A NUMBER AFTER IT.
//
// Playtest: "i lost a fight to chase hooper i was 91% to win, but later i went
// on a 4 fight winning streak at 53%, 36%, 43%, 37%... it feels weird."
//
// Measured 6,000 fights binned by what the card said against what actually
// happened: worst deviation 6.5pts, and that in the thinnest bin. The card was
// telling the truth. Losing at 91% is a 1-in-11; that parlay is a 1-in-33. Both
// landed in one run, which is unlucky and unremarkable.
//
// So there was no bug — and that is exactly the problem. A displayed "91%" is a
// promise the player hears as "you win this one", and losing it reads as the
// game lying rather than as the 1-in-11 it is. The numbers are right, so the
// numbers aren't the fix. Precision is what invites the grievance: nobody feels
// cheated by "heavy favorite".
//
// The number isn't hidden, it's DEFERRED. After the fight you're told exactly
// what you were, which is when it reads as information instead of a promise —
// and when you lose as a big favorite the game says so out loud rather than
// letting you suspect it.
// PHOTOS. 2,331 of them already live in photos/thumb/<slug>.png, named by the
// Cito API's fighterSlug. This mirrors index.html's nameToSlug() — the rules
// look fussy and each one is load-bearing: the API drops generational suffixes
// and apostrophes rather than turning them into dashes, so "Sean O'Malley" is
// sean-omalley (not sean-o-malley) and "Michael Aswell Jr." is michael-aswell.
// Get any of it wrong and the photo silently 404s to initials, which looks like
// "we have no picture" rather than "the slug is wrong".
const SLUG_LETTERS = { 'ł':'l','Ł':'l','đ':'d','Đ':'d','ø':'o','Ø':'o','æ':'ae','Æ':'ae','œ':'oe','Œ':'oe','ß':'ss','ı':'i','İ':'i' };
function nameToSlug(name){
  return String(name||'').toLowerCase()
    .replace(/\\s+(jr\\.?|sr\\.?|i{1,3}|iv|v)\\s*$/i, '')
    .replace(/[łŁđĐøØæÆœŒßıİ]/g, ch => SLUG_LETTERS[ch] || ch)
    .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
// The disc is built with the initials ALREADY in it, and the <img> sits on top.
// If the photo 404s the img hides itself and the initials are simply revealed —
// no onerror text surgery, no flash of a broken-image icon.
function avatarHTML(f){
  return '<div class="av"><span>'+(f.initials||'?')+'</span>'+
    '<img src="/photos/thumb/'+nameToSlug(f.name)+'.png" alt="" loading="lazy" '+
    'onerror="this.style.display=\\'none\\'"></div>';
}

// ONE BAND, TWO VOICES, ONE DEFINITION. \`t\` is what the tile says before the
// fight; \`was\` is how the same verdict reads afterwards. They live on the same
// line ON PURPOSE — the whole point of the post-fight line is that it echoes the
// words the card used, so if these ever drift apart the feature is silently gone
// and nothing throws. (rewardFor already taught this lesson the expensive way: the
// same formula in two places, and I edited one.)
function oddsBand(p){
  if (p >= 0.82) return { t:'Heavy favorite', c:'var(--accent)',  was:'You were a heavy favorite' };
  if (p >= 0.66) return { t:'Favorite',       c:'var(--accent)',  was:'You were a favorite'       };
  if (p >= 0.54) return { t:'Slight edge',    c:'var(--text)',    was:'You had a slight edge'     };
  if (p >= 0.46) return { t:"Pick 'em",       c:'var(--text)',    was:"That was a pick 'em"       };
  if (p >= 0.32) return { t:'Live dog',       c:'var(--gold)',    was:'You were a live dog'       };
  if (p >= 0.18) return { t:'Underdog',       c:'var(--accent2)', was:'You were an underdog'      };
  return              { t:'Big underdog',     c:'var(--accent2)', was:'You were a big underdog'   };
}
// What to say once it's over. Only editorialises when the result was genuinely
// improbable — saying "that's variance" after a coin flip would be noise.
//
// DON'T RESTATE WHAT THE LINE ABOVE ALREADY SAID. That line now reads "You were a
// heavy favorite -488", so this one must not say "heavy favorite" again — it talks
// in 1-in-N instead, which is the one framing neither the band nor the moneyline
// gives you. (An earlier draft read "You were 83% to win (-488). You were a 83%
// favorite...", which stutters and gets the article wrong on top.)
function varianceNote(p, won){
  if (!won && p >= 0.80)
    return "A favorite that big still loses roughly 1 in "+Math.round(1/(1-p))+
           ". Natural variance in MMA, not a bad build.";
  if (won && p <= 0.35)
    return "Roughly a 1 in "+Math.round(1/p)+" shot. That one goes in the highlight reel.";
  return null;
}
const amer = p => { const o = p>=0.5 ? -Math.round(100*p/(1-p)) : Math.round(100*(1-p)/p); return (o>0?'+':'')+o; };

// ── opponent selection ───────────────────────────────────────────────────────
// Three choices, escalating. Ranked opponents are worth more upgrade points —
// the model only pays ~1pt more for beating a contender than a can, so the
// RISK/REWARD HAS TO COME FROM HERE. This is the main tuning dial.
// Offers are CACHED per fight and RANDOMISED within their tier.
//
// Playtest: "it should randomize, it seems to be picking the same matchups every
// time" and "when you lose to a fighter, the matchups should randomize again
// with a possible step down in competition after a loss, not only leave you with
// the ones you chose."
//
// Both were the same cause: offers() was PURE — same state in, same three names
// out — and it was recomputed on every render. So the board never changed, and
// after a loss you stared at the same three men who just beat you.
//
// Now: a fresh roll each fight (keyed on fightNo + losses, so a loss re-rolls),
// picked at random from each tier rather than deterministically.
function pick(arr){ return arr.length ? arr[Math.floor(Math.random()*arr.length)] : null; }

// STYLE-DIVERSE PICKING — the fix for the game's central failure.
//
// Measured: 'striker/safe' won the belt 16% of the time and 'striker/blind',
// same build picking at RANDOM, also won 16%. Cherry-picking your matchup was
// worth exactly nothing. The style triangle wasn't broken — the BOARD was.
// pick() chose at random inside each rank band, so the three cards differed by
// STRENGTH (one below you, one near, one above) and their styles were pot luck.
// You can't pick a favourable matchup when all three men are strangers of
// different sizes; the only readable question was "which is weakest", and that's
// the same question for every build in the game.
//
// So: still one card per rank band — the risk/reward climb is real and stays —
// but WITHIN a band, choose the man whose style is furthest from whoever is
// already on the board. The trio is now deliberately a wrestler, a striker and
// a grappler wherever the division can supply them, so your build has something
// to actually answer.
//
// This invents nothing: every fighter offered is real, at a real rank, with his
// real stats. It's matchmaking, which is a job a promotion really does.
const STYLE_AXES = [
  s => (s.tdDef||60)/95,            // can I take him down
  s => Math.min(1,(s.td||1.4)/4),   // will he take ME down
  s => (s.strDef||52)/66,           // can I hit him
  s => Math.min(1,(s.slpm||4.4)/7), // how hard does he push
  s => (s.chin==null?0.55:s.chin),  // can he be stopped
  s => Math.min(1,(s.sub||0.5)/2.6) // will he tap me
];
const styleDist = (a,b) => {
  if(!a||!b) return 0;
  let t=0; for(const ax of STYLE_AXES) t += Math.abs(ax(a)-ax(b));
  return t;
};
// Pick from \`arr\` the fighter least like everyone in \`taken\`. Ties and empty
// boards fall back to random, so a shallow band never crashes or gets stuck
// serving the same man every run.
function pickDiverse(arr, taken){
  const cands = arr.filter(f=>f && !taken.includes(f));
  if(!cands.length) return null;
  const others = taken.filter(Boolean);
  if(!others.length) return pick(cands);
  let best=null, bestD=-1;
  // jitter so an identical board doesn't recur every single run
  for(const f of cands){
    const d = others.reduce((t,o)=>t+styleDist(f.style,o.style),0) + Math.random()*0.35;
    if(d>bestD){ bestD=d; best=f; }
  }
  return best;
}
// Cache WHO you're offered — never the odds.
//
// First cut cached the whole offer object keyed on fight state, and the test
// caught it instantly: maxing Power+Technique moved the win prob 54.6% -> 54.6%,
// because upgrading doesn't change fightNo/wins/losses/rank so the stale cache
// was served. The card would have lied about your odds the moment you spent a
// point — the exact thing an upgrade screen exists to show.
//
// So: the three OPPONENTS are stable within a fight (they shouldn't re-roll
// because you moved a slider), but their probabilities are recomputed on every
// read against your current build.
let _offerCache = null, _offerKey = '';
// REWARD = RISK x ALTITUDE. Both halves are playtest asks, and together they fix
// the economy the odds bug had been hiding.
//
// Was: max(1, min(2, round((1-p)*3))) — 1 or 2 points, barely varying, and
// completely FLAT by rank. Beating the #2 contender paid what beating a
// gatekeeper paid. No reason to take a hard fight and no reason to climb, which
// is a strange thing to say about a game called The Climb.
//
// It only looked survivable because the bo3 bug inflated every number. With
// honest odds both strategies hit 0% titles and died at #23-33 — the belt was
// off the end of the map. So the economy pays more, and the money goes on the
// two axes the player actually chooses between.
//
//   RISK      a coin flip pays ~2.6x what a gimme pays. The file header still
//             says "the model won't supply the risk/reward on its own" — true,
//             so the game supplies it here.
//
// ALTITUDE IS GONE, AND IT WAS THE RUNAWAY LOOP. It read:
//
//     ALTITUDE  contenders pay double gatekeepers, so climbing compounds: the
//               higher you get the faster you grow, and a run accelerates
//               instead of grinding.
//
// That is the runaway loop RATING_SPAN's comment begged someone to damp, written
// down as a feature. It paid for WHERE YOU ARE rather than HOW FAR YOU MOVED, so
// beating a gimme at #3 paid 2.1x while beating the same gimme at #12 paid 1.35x
// — for identical progress of one rung. Measured, that is the whole open problem:
//
//     the ranked ladder rises   #15 62.2 -> #1 87.4  = 1.8 rating per rung
//     the player rises          ~2.7 pts/win         = 2.2 rating per rung
//
// You outclimb the division you are climbing, so the gap to your own rung WIDENS
// as you go: +11.9 at #15, +16.6 at #12, +18.2 at #3. Every fight sits at 81-83%,
// permanently above MAX_FAVORITE, and no swap can fix it because every legal
// opponent is 17 points beneath you. One number caused the cap to lapse (55% of
// ranked fights over 0.78), the rematch flood (a 20-fight run exhausts a 16-man
// ladder), and the #1 treadmill.
//
// PAY FOR PROGRESS, NOT FOR POSTURE. A win is worth what it MOVED you:
//
//     grind  1 rung/win  x 15 wins  -> +25 rating  } both arrive at the top of
//     bold   3 rungs/win x  5 wins  -> +25 rating  } the ladder at the SAME level
//
// which is exactly the #15 -> #1 span, so the gap you start with (+11.9 = a 74%
// favorite, the hyped-prospect premise) is the gap you keep. The board stays
// under the cap by construction rather than by a constant hunting for it. The two
// paths cost wildly different things — 15-4 versus 5-2 — and that difference is
// the score, which is the design: "how quickly can you become a champion, and
// with what record?"
//
// RUNG_PAY is now THE dial for run length and title rate. Raise it and runs
// shorten and the belt gets cheaper; lower it and the champion pulls away.
// RUNG_PAY 1.3 -> 0.95. Playtest: "41% is too high, it should be closer to the
// other values, around ~20%." The premise is "can you become a UFC champion?" and
// at 2-in-5 the answer was "usually". Now the best builds land at ~20 and the
// spread is 13-21 rather than 18-41.
//
// This is THE dial for the belt rate and it is monotonic — measured at N=120:
//     0.95 -> striker 13 / wrestler 21 / grappler 20
//     1.30 -> striker 18 / wrestler 41 / grappler 37
//     1.40 -> striker 30 / wrestler 33 / grappler 44
// It is sensitive because the economy is a runaway loop (points -> rating -> wins
// -> points), which is exactly why it must be the ONLY thing feeding G.pts. The
// finish bonus was a second, hidden one; see fight().
const RUNG_PAY = 0.95;
// ONE DEFINITION. This lived inline in buildOffers() AND was recomputed in
// offers() — two copies of the same formula, and I edited one. A reward that
// silently disagrees with itself between the card and the payout is exactly the
// class of bug that has cost this prototype the most today.
function rewardFor(f, p){
  // How far this win actually moves you. Sub-rank and gatekeeper wins advance one
  // rung (see fight()), so they pay one rung — no more, and never nothing.
  const r = f.rankNum;
  const rungs = (G.rank == null || r >= 99 || r >= G.rank) ? 1
              : Math.max(1, G.rank - r);
  // Risk still pays, but it MODULATES the rung price rather than multiplying it:
  // risk and rungs both rise with the man above you, so multiplying them raw
  // double-counts the same choice and pays a 3-rung upset ~6x a gimme instead of
  // ~3x. 0.8x for a lock, 1.2x for a coin flip.
  const risk = 0.8 + Math.max(0, 1 - p) * 0.8;
  return Math.max(1, Math.round(rungs * RUNG_PAY * risk));
}

function offers(){
  // DIV IS IN THE KEY. It wasn't, and the failure was silent and total: switch
  // weight class at fight 0 and the key ("0|0|0|null") was unchanged, so you got
  // HEAVYWEIGHT'S three fighters handed back from cache. They aren't in the new
  // division's ladder, so oppByName() returned null and winProb()'s \`if(!o)
  // return 0.5\` fallback made every fight in ten of eleven divisions an exact
  // coin flip. Nothing threw. The tell was a column of 50.0% — a fallback
  // constant wearing a plausible number's clothes.
  const key = [DIV, G.fightNo||0, G.wins, G.losses, G.rank].join('|');
  if (_offerKey !== key || !_offerCache) { _offerKey = key; _offerCache = buildOffers(); }
  // re-price against the CURRENT build every time
  return _offerCache.map(o => {
    const p = winProb(o.f.name);
    return { f:o.f, p, reward:rewardFor(o.f, p), jump:o.jump };
  });
}
function buildOffers(){
  // Exclude everyone you've FOUGHT, not just everyone you've BEATEN.
  //
  // Playtest: "when losing, it doesn't refresh the opponents." I couldn't
  // reproduce that literally — the cache is keyed on losses, so a loss DOES
  // re-roll the list. But G.beat only ever recorded WINS, so the man who just
  // knocked you out stayed in the pool and came back 15% of the time. Getting
  // re-offered your conqueror reads exactly like "nothing changed".
  const fought = new Set(G.log.map(f=>f.opp));
  // HOW MANY TIMES, not just whether. Every rematch path below asked \`fought.has()\`
  // — a yes/no — so once the division was exhausted the board had no way to prefer
  // a man you'd met once over a man you'd met nine times. pickDiverse then picks on
  // style, which is deterministic for a fixed band, so it locked onto ONE opponent
  // and served him forever. Measured on a 33-fight run: Sergei Pavlovich twenty
  // times in a row, fights 15 through 33.
  //
  // A rematch is a career. Twenty rematches is a soft lock with a fighter's name on
  // it, and it is the exact shape of the Walker bug the conqueror rule already
  // fixed — the same mistake one level up, because "never the SAME man twice in a
  // row" was fixed while "never the same man twenty times" was never asked.
  const seen = new Map();
  for (const f of G.log) seen.set(f.opp, (seen.get(f.opp)||0) + 1);
  const timesFought = f => seen.get(f.name) || 0;
  // A TRILOGY IS A CAREER. A TETRALOGY IS A BUG.
  //
  // Least-met cycling alone wasn't enough: at #1 the board can only draw from
  // ranks 1-4 (inBand), so once you've beaten #2/#3/#4 there are exactly two or
  // three legal men left and cycling them just alternates — measured, Pavlovich
  // and Volkov eleven times each. The pool was the problem, not the order.
  //
  // So there's a hard ceiling. Three meetings is Ortiz-Griffin, Gaethje-Poirier,
  // Ali-Frazier — the most any real rivalry gets. Past that the matchmaker isn't
  // booking a rivalry, it's out of ideas, and the honest thing is to say so rather
  // than serve the same face a fourth time.
  const MAX_MEETINGS = 3;
  const overFought = f => timesFought(f) >= MAX_MEETINGS;
  // The least-met men in a list, and only them. Feed this to pickDiverse so the
  // board cycles the division — everyone at 1 before anyone reaches 2 — instead of
  // re-rolling the same face. Style still decides WHICH of the least-met you get.
  const leastFought = (list) => {
    if (!list.length) return list;
    const min = Math.min(...list.map(timesFought));
    return list.filter(f => timesFought(f) === min);
  };
  // ...EXCEPT THE CHAMPION, WHO IS THE WIN CONDITION.
  //
  // This one line was four bugs. "Exclude everyone you've FOUGHT" is right for
  // contenders and catastrophic for the belt: lose ONE title fight and the
  // champion left the pool FOREVER, so \`title\` was empty, so the #1 board became
  // three contenders you had already beaten and the run could never end. Measured,
  // that is the entire remaining mess in one place — a #1 with a title loss farmed
  // #3 for twenty fights (board: \`4@72 1@71 3@93\`, no champion anywhere on it),
  // drifted to rating 110 against an 85-power division, and so:
  //   - every card became a gift            -> MAX_FAVORITE lapsed (51% over cap)
  //   - with nobody legal left to swap in   -> the cap could not fix it
  //   - a 20-fight run ate a 16-man ladder  -> rematches flooded 41% of boards
  // I chased all three as separate problems and patched two of them. They were one
  // bug, and it was not in any of the code I was reading. THE RUN THAT WON'T END IS
  // A RUN WITH NO WIN CONDITION LEFT — check that the win condition is reachable
  // before tuning anything downstream of it.
  //
  // A LOSS TO THE CHAMPION COSTS A SHOT, NOT THE RUN. You must win a fight to earn
  // another crack at him — which is real, and keeps the Walker instant-rematch loop
  // dead (that fix was about being handed your conqueror again IMMEDIATELY; it was
  // never a rule that the belt should become unreachable).
  const isChamp = f => f.rankNum <= 0.5;
  const avail = f => !G.beat.has(f.name) &&
    (isChamp(f) ? (!fought.has(f.name) || G.streak > 0) : !fought.has(f.name));
  const unranked = LADDER().filter(f=>f.rankNum===99 && avail(f));
  const ranked   = LADDER().filter(f=>f.rankNum<99 && avail(f)).sort((a,b)=>b.rankNum-a.rankNum);
  const pool = [];
  if (G.rank == null) {
    // Unranked phase: three gatekeepers of rising difficulty, drawn at random
    // from each third so the same faces don't reappear every run.
    //
    // A loss softens the field HERE TOO. The step-down used to be ranked-only,
    // but your first loss almost always lands while you're still unranked —
    // which is precisely when it was doing nothing. Post-loss, draw all three
    // from the easier half.
    const s = unranked.slice().sort((a,b)=>winProb(b.name)-winProb(a.name));
    const src = G.losses > 0 ? s.slice(0, Math.max(3, Math.ceil(s.length/2))) : s;
    const t = Math.max(1, Math.floor(src.length/3));
    const bands=[src.slice(0,t), src.slice(t,t*2), src.slice(t*2)];
    for(const band of bands) pool.push(pickDiverse(band, pool));
  } else {
    // Ranked phase: someone below, someone near, someone a few spots ABOVE.
    //
    // The first version sorted 'above' descending and took the last element —
    // which is always the CHAMPION. So a #15 got offered a title shot and the
    // average run was 3.6 fights with a 48% belt rate. Caught by simulating 25
    // runs, not by reading the code.
    //
    // Now: the step-up is capped to a few spots, and the champion is only
    // offered once you're #1 (or interim). That's what makes it a climb rather
    // than a coin flip. MAIN TUNING DIAL — widen STEP for a faster game.
    // BAND WIDTH IS THE STYLE DIAL. Measured at #8: the three cards came from
    // #15, #7 and #5 — a 19.4 power spread, worth ~19 pts of win probability,
    // against a style range of ~3. Rank outweighed style 6:1, so cherry-picking
    // your matchup scored identically to picking at RANDOM (16% vs 16%). Making
    // the board style-diverse didn't help; it just varied which stranger was
    // strongest. You cannot pick a favourable matchup when the three men are
    // different sizes — the only readable question is "who's weakest", and that's
    // the same question for every build in the game.
    //
    // So the rungs get close together. STEP 3 -> 1 means the board is roughly
    // one below / one level / one above, a power spread of ~5 rather than ~19,
    // which puts style (up to +-11) in charge of the ORDER while rank still sets
    // the pace of the climb. The risk/reward axis survives: the man above you
    // still pays more and jumps you further.
    // STEP 1 -> 3. THE LADDER MUST BE SHORT, and this is the dial that shortens it.
    //
    // Beating a man TAKES HIS RANK, so the step-up band is the size of the jump.
    // At STEP 1 the only fight that advances you is #n-1, so 15 rungs cost 15
    // wins minimum — and 15 wins on a 5-loss budget forces you to be a ~76%
    // favorite in every one of them, which is the exact fight that feels like
    // theft to lose. At STEP 3 the same ladder is ~5-6 rungs: 8 wins at 68% costs
    // 3.8 expected losses against a budget of 5, and you take the belt at 8-3.
    //
    // This COSTS the thing STEP 1 bought — the note below is still true, rank
    // still outweighs style within a wide band, and the board gets less readable.
    // That trade is the point: an unreadable board you can survive beats a
    // readable one that is arithmetically unwinnable. Style gets its authority
    // back from equal-weight sliders (see WEIGHTS) rather than from narrow bands.
    const STEP = 3;
    // A LOSS STEPS YOU DOWN. You just got beaten — the matchmaker gives you
    // someone softer, not another contender. Widens the 'below' band so the
    // re-roll is a genuine breather rather than the same wall.
    const SOFTEN = G.losses > 0 ? 2 : 0;
    // 'below' used to be EVERYONE beneath you — at #8 that's #9 through #15, and
    // pickDiverse would happily serve #15, a man ~13 power below you. Cap it.
    const BELOW = 3;
    const below = ranked.filter(f=>f.rankNum>G.rank && f.rankNum<=G.rank+BELOW && f.rankNum<99);
    const near  = ranked.filter(f=>Math.abs(f.rankNum-G.rank)<=1 && f.rankNum!==G.rank);
    const up    = ranked.filter(f=>f.rankNum<G.rank && f.rankNum>=G.rank-STEP && f.rankNum>0.5);
    const soft  = ranked.filter(f=>f.rankNum>G.rank+SOFTEN && f.rankNum<=G.rank+SOFTEN+BELOW && f.rankNum<99);
    const title = ranked.filter(f=>f.rankNum<=0.5);   // champ + interim
    pool.push(pickDiverse(SOFTEN ? (soft.length?soft:below) : below, pool));
    pool.push(pickDiverse(near.length?near:up, pool));
    // The title shot isn't a style choice — it's THE fight. No diversity pick.
    pool.push((G.rank<=1 ? pick(title) : null) || pickDiverse(up, pool) || pickDiverse(below, pool));
    // Fallbacks so the offer list is never empty at the top of the ladder.
    if(!pool.filter(Boolean).length) pool.push(...ranked.slice(0,3));
  }

  // LAST RESORT: A REMATCH BEATS AN EMPTY BOARD.
  //
  // avail() hides everyone you've already beaten, and the fallback above was
  // built from \`ranked\` — which is ALREADY filtered by avail(), so when the pool
  // ran dry the fallback was empty too. Measured over 25 runs a division: LHW x2,
  // BW x1, WBW x1 came back with NO FIGHTS and the run simply stopped. Narrowing
  // the bands (STEP 3->1) caused it: a 15-fight run exhausts three or four rungs
  // of a division, and then there is nobody left who is both close to you and
  // new.
  //
  // Beating a man twice is a real career. An empty board is a dead end that looks
  // like a bug, because it is one. So: if the board would be empty, re-offer from
  // the whole ladder ignoring who you've already beaten.
  if(!pool.filter(Boolean).length){
    // A RANKED MAN IS NEVER OFFERED A GATEKEEPER. \`src = near.length ? near : all\`
    // fell back to the WHOLE ladder, unranked pool included — so a #1 contender
    // who had cleared everyone within 4 rungs got served men from the 46-power
    // gatekeeper pool at 95%. Measured, that is most of the #1 treadmill: the
    // favorite-hunter parked at #1 and farmed tune-up fighters for 30 wins. The
    // unranked pool is the ON-RAMP; once you're in the rankings it does not exist.
    const all = LADDER().filter(f => f.name !== (G.last && G.last.o && G.last.o.f.name)
                                  && (G.rank == null ? f.rankNum === 99 : f.rankNum < 99));
    const near = all.filter(f => G.rank==null ? true
                                              : Math.abs(f.rankNum - G.rank) <= 4);
    const src = near.length ? near : all;
    // leastFought: this pool ignores \`avail()\` by design, so without it the same
    // man wins every draw.
    for(let i=0;i<3;i++) pool.push(pickDiverse(leastFought(src.filter(f=>!pool.includes(f) && !overFought(f))), pool));
  }
  // ALWAYS A CHOICE. Playtest: "sometimes it only gives you one option for a
  // matchup. there should always be 2+."
  //
  // Measured, 80 runs: 21.6% of boards offered a single fight, and it clustered
  // exactly where you'd notice — 72% of boards at #15, ~48% at #1-#4. Narrowing
  // the rank bands (STEP 3->1, BELOW cap 3) to make style decide the ORDER also
  // made the three picks collide: at #15 'below' is #16-18, who don't exist, and
  // 'near'/'up' both resolve to #14. The dedup then collapsed three picks into
  // one. It's worst at the EDGES of the ladder, where there is no room on one
  // side — which is precisely where a matchup screen with no matchup on it is
  // most galling, because you're at the top and being handed a fait accompli.
  //
  // So: top up from a widening radius until there are three. Never a dead end,
  // never a fake choice.
  let picked = pool.filter(Boolean).filter((f,i,a)=>a.indexOf(f)===i);
  if (picked.length < 3) {
    // \`fought\`, NOT G.beat. G.beat only records WINS, so filtering on it re-offers
    // the man who just knocked you out — repeatedly. Playtest: "L vs Johnny Walker
    // (64%), L vs Johnny Walker (64%), L vs Johnny Walker (68%)" — three straight
    // rematches with a man who had already beaten him twice, which reads exactly
    // like "it isn't refreshing the matchups when losing". Measured at 28.7% of
    // boards offering someone already fought. The \`fought\` set was three lines
    // above this and tracks both results; I reached for the wrong one.
    const beaten = f => fought.has(f.name);
    // WIDEN UPWARD, NEVER DOWNWARD, AND TAKE THE REMATCH OVER THE STRANGER.
    //
    // Two bugs lived in one line. \`Math.abs(f.rankNum - G.rank) <= radius\` widens
    // SYMMETRICALLY over radii that reach 99, so once the top of the ladder was
    // exhausted a #1 contender got topped up from #13 — measured, rating 108.9
    // against power 67.1 at 95%, on repeat, which is the #1 treadmill's last
    // hiding place. MAX_FAVORITE could not catch it: by then nobody legal was left
    // to swap in, so the cap silently passed the gift through. The 'below' band
    // already caps weakness at 3 rungs on the main path; the top-up was quietly
    // exempt from the rule it was topping up.
    //
    // And it preferred a FRESH man ten rungs down over a REMATCH one rung up,
    // which is backwards twice over: the whole file's position is that "beating a
    // man twice is a real career", while being handed #13 while ranked #1 is not
    // a fight at all. So: bound the weakness first, then prefer new faces WITHIN
    // that bound, and only then rematch — never against a man who beat you.
    const FLOOR = 3;                       // same weakness cap as the 'below' band
    const conqueror = new Set(G.log.filter(x => !x.won).map(x => x.opp));
    const inBand = (f, radius) => f.rankNum < 99 && f.rankNum > 0.5 &&
      f.rankNum >= G.rank - radius && f.rankNum <= G.rank + FLOOR;
    for (const pass of [0, 1]) {           // 0: someone new.  1: a rematch.
      for (const radius of [2,4,7,12,99]) {
        if (picked.length >= 3) break;
        let band = LADDER().filter(f =>
          !picked.includes(f) &&
          (pass === 0 ? !beaten(f) : !conqueror.has(f.name)) &&
          (G.rank == null ? f.rankNum === 99 : inBand(f, radius)));
        // pass 1 IS the rematch pass, and it's where the twenty-in-a-row came from:
        // it happily re-served whoever pickDiverse liked, however many times you'd
        // already met him. Draw from the least-met men only.
        if (pass === 1) band = leastFought(band.filter(f => !overFought(f)));
        while (picked.length < 3 && band.length) {
          const nxt = pickDiverse(band, picked);
          if (!nxt) break;
          picked.push(nxt); band.splice(band.indexOf(nxt), 1);
        }
      }
    }
    // TRUE last resort: a rematch beats an empty board, but only after the whole
    // ladder has been searched for someone new, and never against a man who has
    // already beaten you — losing to the same guy on repeat is the single most
    // demoralising thing the board can do, and it isn't matchmaking, it's a bug
    // wearing a fighter's name.
    if (picked.length < 2) {
      // Same rule as the fallback above: the unranked pool is the on-ramp, not a
      // reserve tank for a contender's board.
      const tier = f => G.rank == null ? f.rankNum === 99 : f.rankNum < 99;
      const lost = new Set(G.log.filter(f=>!f.won).map(f=>f.opp));
      let any = LADDER().filter(f => !picked.includes(f) && !lost.has(f.name) && tier(f) &&
        f.name !== (G.last && G.last.o && G.last.o.f.name));
      if (!any.length) any = LADDER().filter(f => !picked.includes(f) && tier(f) &&
        f.name !== (G.last && G.last.o && G.last.o.f.name));
      // Least-met first here too — this is the deepest fallback, so it runs exactly
      // when the division is most exhausted and the lock-on is most likely.
      any = leastFought(any.filter(f => !overFought(f)));
      while (picked.length < 3 && any.length) {
        const nxt = pickDiverse(any, picked);
        if (!nxt) break;
        picked.push(nxt); any.splice(any.indexOf(nxt), 1);
      }
    }
  }
  // NO FIGHT ON THE BOARD IS A GIFT. Cap the easiest card at MAX_FAVORITE.
  //
  // The 15-wins-on-a-5-loss-budget arithmetic forces you to be a ~76% favorite in
  // every fight, and the playtest read that back exactly: "losing 5 times at an
  // average moderate favorite isn't wrong, but losing 5 times at 80% FEELS wrong."
  // Both halves are right, which makes it a contradiction rather than a tuning
  // miss — you cannot have "no heavy favorites" AND a long ladder. The short
  // ladder (STEP 3 + UNRANKED_WINS 1) is what BUYS this cap: at ~6 rungs the cap
  // is affordable, and on the 18-fight version it sent every strategy to 0%.
  //
  // FIX (b) — WHY THIS DRAWS FROM LADDER(), NOT avail(). The obvious swap-in is
  // "replace the gift with a harder man from the offer pool", but the pool comes
  // from avail(), which excludes everyone you have already FOUGHT. By fight 20 a
  // run has eaten three or four rungs and there is nobody left to swap in, so the
  // cap silently stops working exactly where it matters most — measured, 46% of
  // the favorite-hunter's fights were still >80%. A cap that quietly lapses is
  // worse than no cap: the board keeps promising a ceiling it isn't enforcing.
  // So this replaces the card from the WHOLE ladder, rematches included. Fighting
  // a man twice is a real career; being handed a 90% gift is not a fight.
  // MAX_FAVORITE KILLS THEFT, NOT THE RISK GRADIENT. 0.85, and 0.78 is a
  // CONTRADICTION rather than a tuning miss — which is the tuning file's own
  // central lesson, one level up from where it was written.
  //
  // The board is below / near / up BY DESIGN: "a rank below you can advance you,
  // just less than taking a harder fight." So the three cards are a gradient, and
  // the arithmetic of that gradient is fixed:
  //     a 0.78 cap allows a gap of at most 14.3 rating points
  //     the debut is +11.9 over its OWN rung (=74%, the hyped-prospect premise)
  //     the BELOW card is ~3 rungs weaker again = +17.3 = 82%
  // The below card is over a 0.78 cap ON TURN ONE, by construction, before any
  // drift. To get it under, you must debut a 69% favorite over #15 — which is not
  // a hyped prospect, it's part 2 undone. Parts 2 and 4 of the note cannot both
  // hold: "42 lands the debut at ~78" and "no card above ~75%" are the same shape
  // of contradiction as "no heavy favorites" + "a 15-win climb on a 5-loss
  // budget", and it got solved the same way both times — by measuring instead of
  // hunting for the constant.
  //
  // So the cap's job is not to flatten the gradient (that would delete the safe
  // option and the whole point of the choice). Its job is to kill THEFT: the 95%
  // gatekeeper farm, the outgrown-division treadmill, the man served because the
  // matchmaker ran out of ideas. The designed gradient runs ~66% (up) / ~74%
  // (near) / ~82% (below); 0.85 sits just above it and catches everything that
  // isn't a fight.
  //
  // RANKED BOARDS ONLY. At POINTS_START 42 the debut rates ~74 against a
  // gatekeeper pool averaging 46.9 — every gatekeeper card is ~99%, so an
  // unconditional cap would replace the whole tune-up board with RANKED men and
  // quietly delete UNRANKED_WINS. The one gatekeeper fight is SUPPOSED to be a
  // gift; that's the hyped-prospect premise, and it's one fight, not a treadmill.
  const MAX_FAVORITE = 0.85;
  if (G.rank != null && picked.length) {
    const scored = picked.map(f => ({ f, p: winProb(f.name) }));
    // SORTED, hardest first. This was \`scored.filter(...)\` then \`soft.pop()\` to
    // "keep the hardest" — but \`scored\` is in BOARD order, not odds order, so pop()
    // kept whichever card happened to be listed last. The comment said hardest;
    // the code said last; nothing threw. Sort before you rely on an order.
    const soft = scored.filter(x => x.p > MAX_FAVORITE).sort((a,b) => a.p - b.p);
    // Only ever REPLACE gifts, never erase the board: if EVERY card is over the
    // cap you have outgrown this rung, and the honest answer is to leave the
    // hardest of them standing rather than hand back an empty screen. Playtest:
    // "there should always be 2+."
    if (soft.length === scored.length) soft.shift();   // keep the hardest = lowest p
    // THE CONQUEROR STILL NEVER RETURNS. Drawing from the whole LADDER() is what
    // makes the cap bite late (fix b) — but "the whole ladder" includes the man
    // who knocked you out, and this swap quietly re-offered him: measured, it put
    // a conqueror back on 74 of 436 boards and flooded 60% of them with rematches,
    // failing the two gates that bank the "man who beat you never comes back" fix.
    // Ignoring \`fought\` is the POINT of this pool; ignoring \`lost\` was a bug I
    // added on top of it. A rematch with a man you BEAT is a career. A rematch
    // with the man who beat you, served because the matchmaker ran out of ideas,
    // is the most demoralising thing the board can do.
    const conquerors = new Set(G.log.filter(x => !x.won).map(x => x.opp));
    for (const s of soft) {
      const legal = LADDER()
        .filter(f => !picked.includes(f) && f.rankNum > 0.5 && f.rankNum < 99 &&
                     !conquerors.has(f.name) && winProb(f.name) <= MAX_FAVORITE)
        // the least-bad legal card: closest to the cap from below, so the swap
        // tightens the board rather than skipping you three rungs up the ladder.
        .sort((a,b) => winProb(b.name) - winProb(a.name));
      // A NEW MAN, OR NO SWAP AT ALL. The tuning note's fix (b) proposed drawing
      // from the WHOLE ladder — rematches included — so the cap could still find a
      // hard opponent once avail() was exhausted. Measured, that does two bad
      // things and no good one:
      //   - it re-offers men you have already beaten on every capped board (57% of
      //     boards, breaking the banked "rematches never flood" gate; 31% even
      //     when new men are preferred first), and
      //   - IT DOESN'T EVEN WORK. A man you beat 10 fights ago is a BIGGER gift
      //     now than he was then, because you have gained ~40 points since. The
      //     exhausted pool was never the reason the cap lapses.
      // The real reason is in THE-CLIMB-TUNING.txt: a long run outgrows the
      // division outright (85 pts -> rating 108.6 vs a 107.1 champion), so below
      // #1 there is NO legal opponent to swap in, rematch or not. A cap cannot
      // conjure an opponent who doesn't exist. So this swaps in a new man when the
      // division still has one and otherwise leaves the board alone.
      const harder = legal.find(f => !fought.has(f.name));
      if (harder) picked[picked.indexOf(s.f)] = harder;
    }
  }
  return picked.map(f=>{
    const p = winProb(f.name);
    const reward = rewardFor(f, p);
    // FIX (a) — AN UNRANKED MAN MUST STILL CARRY A JUMP.
    //
    // \`jump\` used to be \`f.rankNum<99 ? f.rankNum : null\`, i.e. null for every
    // gatekeeper. fight() then reads \`if (o.jump != null)\` to advance you, so a
    // RANKED player who beats an unranked man moves nowhere — and the board keeps
    // offering gatekeepers as the soft option. The favorite-hunter found this and
    // farmed it: records of 39-1 with no belt, running out the 40-fight guard.
    // The bug is invisible while unranked (the UNRANKED_WINS branch covers you)
    // and only bites once you're ranked, which is why it survived this long.
    //
    // An unranked man is, by definition, BELOW you. Sub-rank advancement is what
    // he pays: one rung, the same as any other man beneath your rank.
    const jump = f.rankNum < 99 ? f.rankNum : 99;
    return { f, p, reward, jump };
  });
}

// A fight is THREE ROUNDS, not one coin flip.
//
// Playtest: "I lost against someone I was favored 79% over, then lost to someone
// I was 92% over ... that makes it entirely RNG based, more luck than anything."
// Correct. One flip per fight meant an 8% roll ended a run you had no input on,
// and the only decision was picking the highest number.
//
// The fix isn't to fudge the model, it's to use it honestly: the sim's number
// prices a ROUND. Win 2 of 3 and you win the fight. That sharpens the extremes
// and leaves close fights as coin flips, which is exactly where drama belongs:
//     92% -> 98.2%   (upsets 8% -> 1.8%)
//     79% -> 88.6%
//     50% -> 50.0%   (unchanged — a pick'em is still a pick'em)
//     30% -> 21.6%   (underdog runs get HARDER, correctly: beating a contender
//                     should mean something)
// It also gives the run a story for free — "you won rounds 1 and 3".
function fight(o){
  // o.p is P(WIN THE FIGHT). Rounds must be rolled at the per-round rate that
  // reproduces it — rolling three rounds AT o.p resolves the fight at bo3(o.p),
  // i.e. materially easier than the card promised.
  const pr = roundP(o.p);
  let rounds = [0,1,2].map(()=>Math.random() < pr);
  let roundsWon = rounds.filter(Boolean).length;
  const won = roundsWon >= 2;
  // FOUR WAYS TO END A FIGHT, NOT TWO.
  //
  // This read (power + grappling) / 20, so WRESTLING CONTRIBUTED NOTHING. Playtest:
  // "I made a 10/10 wrestler and grappler and won by submission 3 times and
  // decision 8" — half his sheet was invisible to the finish. There was no
  // ground-and-pound in the game: wrestling took you there and then stopped
  // mattering. Same for pace: you could not wear anyone out.
  //
  // The weights are the playtest's own reading and they are deliberately unequal:
  //   power 1.00      a 10 here is a real knockout artist
  //   grappling 1.00  a 10 here is a real submission threat
  //   wrestling 0.45  ground-and-pound is a real finish, but it is not a right hand
  //   pace 0.35       volume finishes people — but only SOME people, see below
  //
  // PACE IS THE MATCHUP ONE. "Pace isn't the same finishing ability as power, but
  // if you put a pace on someone with bad cardio and durability, you can finish
  // them." Exactly — so pace's weight scales with how fragile THIS man is, read off
  // his real chin (0.24 to 0.93 across the roster, median 0.66). Volume against
  // granite is a decision; volume against glass is a third-round TKO. It is the
  // only finishing avenue that depends on who you're in there with.
  const S0 = o.f.style || {};
  // 0 against the best chin in the division, 1 against the worst.
  const frail = Math.max(0, Math.min(1, (0.85 - (S0.chin != null ? S0.chin : 0.66)) / 0.5));
  const FIN_W = { power: 1.00, grappling: 1.00, wrestling: 0.45, pace: 0.35 };
  //  MAXING THE ONE THING YOU ARE IS A WHOLE JOB, NOT HALF OF ONE.
  //
  // This was \`/ (ATTR_MAX*2)\` — a divisor of 20 — which assumed you needed power
  // AND grappling to be a finisher. So the man who maxed HIS avenue capped at 0.55
  // and finished 47% of his wins, while a 1/1/1/1 with no finishing ability
  // anywhere still finished 30%. Floor too high, ceiling too low, every build
  // converging on "sometimes". Playtest: "finishing rates are low, especially if
  // you max out your finishing stats" — right, and structurally so.
  //
  // Now: subtract the baseline every fighter has for free, then SATURATE. One maxed
  // avenue gets you most of the way; maxing everything gets you the rest. Real MMA
  // is the target — Ngannou, Aspinall and Adesanya finish 80-90% of their wins, and
  // a man with no finishing ability at all should be a decision machine.
  const finRaw = (G.attrs.power||0)     * FIN_W.power +
                 (G.attrs.grappling||0) * FIN_W.grappling +
                 (G.attrs.wrestling||0) * FIN_W.wrestling +
                 (G.attrs.pace||0)      * FIN_W.pace * frail;
  const FIN_BASE = ATTR_MIN * (FIN_W.power + FIN_W.grappling + FIN_W.wrestling);  // ~2.45, the free floor
  const finBias = 1 - Math.exp(-Math.max(0, finRaw - FIN_BASE) / 6);
  // HOW you finish follows what you BUILT. Playtest: "I maxed out grappling and
  // never won by submission." He couldn't have: the result line read
  // \`fin ? ' by KO/TKO' : ' by decision'\` — there was no submission ANYWHERE in
  // the game. Every finish printed as a knockout regardless of build, so the
  // whole grappling half of the sheet was invisible in its own results.
  // Weighted by the two attributes that actually finish fights.
  //
  // AND THE SAME COURTESY IN THE OTHER DIRECTION. \`method\` was \`!won ? null : ...\`
  // — losing had no method at all, so the game could tell you exactly how you beat
  // a man and had nothing to say about how he beat you. Half the results in a run
  // were a blank. It reads as though the game stops paying attention the moment
  // you lose, which is precisely the moment the player is paying most.
  //
  // How you GET finished follows what HE does, read off his REAL stats — the same
  // rule as your side of it, pointed the other way. kd is knockdowns per 15min
  // (median 0.27, max 3.54); sub is submission attempts per 15min (median 0.32,
  // max 4.27). Both are long-tailed, so they saturate rather than scale: a man
  // with 3.5 kd is terrifying, not 13x more terrifying than the median.
  const S = o.f.style || {};
  const kd = Math.max(0, S.kd || 0), sb = Math.max(0, S.sub || 0);
  const threat = (kd + sb) / (kd + sb + 1.0);        // ~0.37 median, ~0.89 at the top
  // YOUR CHIN BUYS YOU THE JUDGES. A maxed chin doesn't stop you losing — the
  // result was decided by the rounds above, before any of this — it stops you
  // getting STOPPED. This is deliberately cosmetic with respect to balance: method
  // is chosen after \`won\`, so nothing here can move a win rate. It just means the
  // 1/9 point you spent on chin is visible in your own record.
  // 0 at the floor, 1 at the cap — how much of the thing you actually bought.
  const lvl = (id) => ((G.attrs[id] || ATTR_MIN) - ATTR_MIN) / (ATTR_MAX - ATTR_MIN);

  // ROUND ONE OR BUST. Playtest: "if you have no cardio but high finishing stats,
  // you should rarely — if ever — win a decision."
  //
  // Which is a sharper observation than it first looks, because it is CONDITIONAL.
  // Whether you win is already settled by the rounds above; this only asks HOW. And
  // a fighter with no gas tank who won cannot have won a decision — a decision means
  // he was still there in round three. So low cardio doesn't make you win more, it
  // makes the wins you DO get be early ones. It pushes P(finish | won) toward 1.
  //
  // It reads like a buff for skipping cardio and isn't: method is chosen after
  // \`won\`, so it cannot move a win rate, and the style triangle already charges 13
  // points of belt rate for the empty tank (glass cannon 25% vs complete 38%).
  // SCALED BY finBias, and that correction matters. Pushing every gassed fighter
  // toward a finish had a man with 1 power, 1 grappling, 1 wrestling and 1 pace
  // finishing 74% of his wins — an empty tank does not hand you a way to end a
  // fight you have no way to end. "Round one or bust" only applies to a fighter who
  // owns a round one. Multiplying the push by finBias means no cardio sharpens the
  // finisher you ARE and does nothing for the man who is nobody.
  const gassed = 1 - lvl('cardio');            // 1 at the floor, 0 at a full tank
  const winBase = 0.10 + finBias * 0.74;       // 0.10 for a man who cannot finish -> 0.84 maxed
  const winFin = winBase + (1 - winBase) * gassed * 0.70 * finBias;

  // AND YOU RARELY HEAR THE CARDS WITH NO CHIN EITHER. Playtest: "if you have zero
  // durability, you should rarely make it to a dec." Same logic pointed the other
  // way: when you lose, a man with nothing to absorb it gets stopped.
  //
  // This was \`1 - (chin/10)*0.3\` — a guard so weak it moved finish-against from 42%
  // to 30% across the ENTIRE slider. Ten points bought a twelve-point swing in
  // flavour and nothing else, which is why "0 durability and never finished once"
  // was an ordinary evening rather than a bug.
  const chinMult = 1.85 - 1.25 * lvl('chin');  // 1.85 at the floor, 0.60 maxed
  const loseFin = Math.min(0.92, (0.22 + threat * 0.45) * chinMult);

  const finW = won ? winFin : loseFin;
  const fin = Math.random() < finW && (won || kd + sb > 0);
  // Weights for WHICH finish. Yours: power vs grappling. His: knockdowns vs subs.
  // WHICH finish. Wrestling and pace both cash out mostly as TKO — ground-and-pound
  // and accumulation are stoppages, not taps — but wrestling also sets up the
  // choke, so it feeds both. A 10/10 wrestler-grappler now gets a real share of
  // ground-and-pound instead of reading as a pure sub artist, which is what the
  // archetype (Constrictor) already claims he is.
  const koW  = won ? ((G.attrs.power||1)
                      + (G.attrs.wrestling||0) * 0.50
                      + (G.attrs.pace||0) * 0.60 * frail)
                   : kd;
  const subW = won ? ((G.attrs.grappling||1) * 0.9
                      + (G.attrs.wrestling||0) * 0.35)
                   : sb;
  const bySub = fin && (koW + subW > 0) && Math.random() < subW/(koW+subW);
  const method = !fin ? 'decision' : (bySub ? 'submission' : 'KO/TKO');
  // A FINISH ENDS THE FIGHT. Playtest: "when beating someone by finish, it still
  // shows all 3 rounds as if it were a decision." The rounds array and the
  // finish roll were computed independently, so a first-round KO still printed
  // R1 ✓ R2 ✓ R3 ✓. Truncate at the round it ended in — the first round you won.
  //
  // A LOSS TRUNCATES AT THE FIRST ROUND YOU **LOST**. \`rounds.indexOf(true)\` is
  // the first round you WON, which is the right round for your finish and the
  // wrong one for his: it would have printed "finished in R3" over a card reading
  // R1 ✗ R2 ✗, i.e. stopped in a round you were winning, in a fight already over.
  let finRound = 0;
  if (fin) {
    finRound = rounds.indexOf(won) + 1;   // the first round its winner took
    rounds = rounds.slice(0, finRound);
    roundsWon = rounds.filter(Boolean).length;
  }
  G.log.push({ opp:o.f.name, won, fin, method, p:o.p, rank:o.f.rankNum, rounds, roundsWon, finRound });
  if (won){
    G.wins++; G.streak++; G.beat.add(o.f.name);
    // THE FINISH BONUS IS GONE, AND IT HAD TO GO.
    //
    // This was \`o.reward + (fin?1:0)\`: a point for finishing. Harmless flavour while
    // every build finished at roughly the same rate — and a balance lever the moment
    // that stopped being true. Widening the finish spread to 16%-88% turned +1 into
    // +1.4 points a run for a Surgeon and +7.9 for a Sniper, and the economy's whole
    // problem is a runaway loop: points -> rating -> wins -> points. Measured, it
    // moved the grappler from 33% to 48% belt rate on a change that was supposed to
    // be cosmetic.
    //
    // I said "method is chosen after \`won\`, so it cannot move a win rate" three
    // times today and never checked it. It was true by accident, not by design:
    // \`fin\` fed G.pts. The claim survived because nothing had ever made the finish
    // rate vary enough to expose it.
    //
    // Now method is inert BY CONSTRUCTION — \`fin\` reaches the log and the result
    // line and nothing else — which is what makes it safe to tune on feel.
    G.pts += o.reward;
    // SUB-RANK ADVANCEMENT. Playtest, and it's the right design: "a rank below you
    // can advance you, just less than taking a harder fight."
    //
    // Before this, beating a man at or below your rank moved you NOWHERE, so the
    // board had one honest answer — always take the man above — and the "safe"
    // card was a trap that cost you a loss-budget roll for nothing. Now every win
    // advances; how FAR is the choice:
    //     beat a man ABOVE you  -> you take his rank (a jump of up to STEP)
    //     beat a man BELOW you  -> one rung, every time
    // Measured, that keeps two strategies alive at once and they cost different
    // things:
    //     grind  15 wins @78% -> 4.2 expected losses -> ~50% -> champion at 15-4
    //     bold    5 wins @50% -> 5.0 expected losses -> ~50% -> champion at  5-2
    // Equally LIKELY, wildly different in what you're left holding. Grinding
    // should be slow and ugly, not impossible. The score is the record.
    if (G.rank == null) {
      // A ranked man still pays his rank on debut — the last-resort board can
      // serve one, and beating #12 from nowhere should not deposit you at #15.
      if (o.jump < 99) G.rank = o.jump;
      // Otherwise the gatekeeper proves you belong; he does not rank you above #15.
      else if (G.wins >= UNRANKED_WINS) G.rank = 15;
    } else if (o.jump < G.rank) {
      G.rank = o.jump;               // you beat a better man: you ARE his rank now
    } else {
      G.rank = Math.max(1, G.rank - 1);   // at or below you: one rung, never past #1
    }
    if (o.f.rankNum === 0) G.champ = true;
  } else {
    G.losses++; G.streak = 0;
    // A LOSS COSTS YOU A RUNG. The design said so all along and the code never did
    // it: CUT_AT's own comment reads "losses become a COST, not a coin flip that
    // deletes the run: they cost you rank, time and a soft matchmaking step-down."
    // Only the last two were ever implemented. Rank was untouched, so a loss cost
    // you a slot in the budget and nothing else.
    //
    // It went unnoticed until the belt became reachable again, and then it was
    // glaring: lose a title fight, stay #1, beat one gimme (sub-rank advancement
    // keeps you at #1), get another shot — an unlimited supply of title fights at
    // one fight apiece. Measured, that was a 90% belt rate for the wrestler. A free
    // belt. Now the #1 contender who loses drops to #2 and has to climb back
    // through men he may already have beaten, which is what a title loss costs a
    // real fighter and is the only reason another shot is worth anything.
    if (G.rank != null) G.rank = Math.min(15, G.rank + 1);
  }
  // HIGH WATER MARK, recorded wherever rank last moved — win or loss. Rank is no
  // longer monotonic, so the peak has to be remembered rather than read off the end.
  if (G.champ) G.peak = 0;
  else if (G.rank != null && (G.peak == null || G.rank < G.peak)) G.peak = G.rank;
  // EVERY FIGHT AGES YOU, win or lose. Playtest: "it took a long time to get to
  // the title. I went 18-1." Ducking was free — beating someone ranked BELOW you
  // moves you nowhere, so the safe path had no cost and the run never ended.
  //
  // Now the clock is the cost. ~4 months a fight, so an 18-fight run takes you
  // from 24 to 30. The sim reads \`age\` and applies its real age curve, so this
  // isn't an invented penalty — it's the model. (Honest caveat: measured, that
  // curve is WEAK for a fighter with a big record — 27 to 38 only cost 1.4pts.
  // So this makes ducking cost something, but it is not yet a hard run limit.
  // If runs still drag, the next dial is retiring at ~35.)
  G.fightNo = (G.fightNo||0) + 1;
  G.last = { o, won, fin, method };
  render();
}

// ── render ───────────────────────────────────────────────────────────────────
function newGame(){
  // G.peak IS NEW, AND IT IS NOT DECORATION. endBox has always printed "peaked at
  // #N" off G.rank, which was honest only while rank could not go DOWN — and it
  // could not, until a loss started costing a rung. The moment that landed, the end
  // screen began reporting the rank you were cut at as the rank you peaked at, and
  // nothing threw, because "peaked at #12" is a perfectly plausible thing to read
  // after a bad run. (sim-climb-runs.cjs has tracked its own peak since the day it
  // was written, with a comment saying the game has no G.peakRank. It was right,
  // and the game needed one the whole time.)
  G = { attrs:Object.fromEntries(ATTRS.map(a=>[a.id,ATTR_MIN])), pts:POINTS_START,
        wins:0, losses:0, streak:0, rank:null, peak:null, log:[], beat:new Set(), champ:false, started:false, last:null, fightNo:0 };
  render();
}
// What the current sheet has cost, in points — NOT the sum of levels, now that
// costs escalate. The creator and the in-run upgrade panel share this.
const costTo = lvl => { let c=0; for(let v=ATTR_MIN; v<lvl; v++) c+=upCost(v); return c; };
const spent = () => ATTRS.reduce((s,a)=>s+costTo(G.attrs[a.id]),0);

function render(){
  const app = $('#app'); app.innerHTML='';
  // THE PITCH IS FOR PEOPLE WHO HAVEN'T STARTED. Once you're in a run, the tagline
  // and the three-line subtitle are ~90px of marketing copy you've already read,
  // reprinted above every single screen — on a phone that's most of the space
  // above the fold, spent telling a player who is 8-3 what the game is. The h1
  // stays: it's the title, not the pitch.
  document.body.classList.toggle('playing', !!G.started);
  if (!G.started){ app.appendChild(creator()); return; }
  app.appendChild(hud());
  if (G.champ){ app.appendChild(endBox('CHAMPION. You did it.')); return; }
  if (G.losses>=CUT_AT){ app.appendChild(endBox('Cut. '+CUT_AT+' losses.')); return; }
  if (G.last) app.appendChild(resultBox());
  app.appendChild(upgrade());
  app.appendChild(offerBox());
  app.appendChild(logBox());
}

function creator(){
  const p=document.createElement('div'); p.className='panel';
  p.innerHTML='<div class="rl">Choose your division</div>';

  // WEIGHT CLASS PICKER. Changing division RESTARTS the run — you can't carry a
  // 6-0 record and a half-built fighter into a new weight class, and the ladder,
  // opponents and champion all change underneath. newGame() resets everything,
  // which is the honest behavior; silently keeping your points while swapping
  // the entire board would be the bug.
  // A <select>, not 11 buttons. The grid of cards was ~4 rows of chrome above the
  // thing you actually came here to do, for a choice you make once per run.
  const dv=document.createElement('div'); dv.className='divpick';
  const sel=document.createElement('select'); sel.className='divsel';
  for(const key of D.order){
    const o=document.createElement('option');
    o.value=key; o.selected=(key===DIV);
    const champ=D.divisions[key].ladder.find(f=>f.rankNum===0);
    // "Lightweight — Justin Gaethje" doesn't say WHO Gaethje is to you; an em
    // dash reads as apposition, so the name could be anything. "Lightweight ·
    // C Justin Gaethje" borrows the belt marker the rest of the game already
    // uses (#C on the ladder), so the label explains itself.
    o.textContent=D.divisions[key].label+(champ?'  ·  C: '+champ.name:'  ·  vacant');
    sel.appendChild(o);
  }
  sel.onchange=e=>{ if(e.target.value===DIV) return; DIV=e.target.value; newGame(); };
  dv.appendChild(sel);
  p.appendChild(dv);

  // THE SCOUTING REPORT, under the picker — the only screen where it can change a
  // decision, because it's the screen where you spend the 42 points.
  const chF = D.divisions[DIV] && D.divisions[DIV].ladder.find(f=>f.rankNum===0);
  const sc = chF && champScout(chF.style);
  if (sc) {
    const mk=(t,c,txt)=>{const e=document.createElement(t); if(c)e.className=c;
      if(txt!=null)e.textContent=txt; return e;};
    const box=mk('div','scout');
    const hd=mk('button','scout-hd'); hd.type='button';
    hd.setAttribute('aria-expanded', scoutOpen?'true':'false');
    // textContent, not innerHTML: every string here is a FIGHTER'S NAME off a data
    // feed, and the rest of this file builds nodes rather than pasting markup.
    const nm=mk('span','scout-nm');
    nm.appendChild(mk('span','scout-c','C'));
    nm.appendChild(document.createTextNode(' '+chF.name));
    hd.appendChild(nm);
    hd.appendChild(mk('span','scout-rd',sc.read));
    hd.appendChild(mk('span','scout-ch'+(scoutOpen?' o':''),'▼'));
    // render() rebuilds #app, so this rebuilds the creator. That is what every
    // other control on this screen already does, and scoutOpen is module-level so
    // it survives the rebuild — which is the whole reason it lives out there.
    hd.onclick=()=>{ scoutOpen=!scoutOpen; render(); };
    box.appendChild(hd);
    if (scoutOpen) {
      const bd=mk('div','scout-bd');
      bd.appendChild(mk('div','scout-arch',sc.label));
      for (const [k,v,frac] of sc.rows) {
        const r=mk('div','scout-row');
        const kk=mk('span',null,k); kk.style.color='var(--muted)';
        r.appendChild(kk); r.appendChild(mk('span','v',v));
        bd.appendChild(r);
        const b=mk('div','scout-bar'); const i=mk('i');
        i.style.width=Math.round(frac*100)+'%';
        b.appendChild(i); bd.appendChild(b);
      }
      box.appendChild(bd);
    }
    p.appendChild(box);
  }

  const hd=document.createElement('div'); hd.className='rl'; hd.style.marginTop='.85rem';
  hd.textContent='Create your fighter';
  p.appendChild(hd);
  const left=POINTS_START-spent();
  for(const A of ATTRS){
    // Buttons, not a slider. Playtest: "put the +/- buttons for attributes like
    // it is on the other page." The creator and the upgrade panel were two
    // different controls doing the same job, and the slider's floor bug (drag to
    // 0 for a free downgrade) only existed because it was a slider.
    const row=document.createElement('div'); row.className='attr up';
    const l=document.createElement('label'); l.textContent=A.label;
    const bar=document.createElement('div'); bar.className='lvlwrap';
    bar.innerHTML='<div class="lvlbar"><div class="lvlfill" style="width:'+
      ((G.attrs[A.id]-ATTR_MIN)/(ATTR_MAX-ATTR_MIN)*100)+'%"></div></div>'+
      '<span class="lvlnum">'+G.attrs[A.id]+'<i>/'+ATTR_MAX+'</i></span>';
    const grp=document.createElement('div'); grp.className='pm';
    const cost = upCost(G.attrs[A.id]);
    const canUp = G.attrs[A.id]<ATTR_MAX && left>=cost;
    const canDn = G.attrs[A.id]>ATTR_MIN;

    const dn=document.createElement('button'); dn.className='btn pmbtn'; dn.textContent='−';
    dn.disabled=!canDn; if(!canDn) dn.style.opacity=.25;
    dn.onclick=()=>{ if(G.attrs[A.id]<=ATTR_MIN) return;
      G.attrs[A.id]--; G.pts = POINTS_START - spent(); render(); };

    const up=document.createElement('button'); up.className='btn pmbtn'; up.textContent='+';
    up.disabled=!canUp; if(!canUp) up.style.opacity=.25; else up.style.borderColor='var(--accent)';
    up.onclick=()=>{ if(G.attrs[A.id]>=ATTR_MAX) return;
      const c=upCost(G.attrs[A.id]); if(POINTS_START-spent()<c) return;
      G.attrs[A.id]++; G.pts = POINTS_START - spent(); render(); };

    const c=document.createElement('span'); c.className='pmcost';
    c.textContent = G.attrs[A.id]>=ATTR_MAX ? 'MAX' : cost+(cost>1?' pts':' pt');

    grp.appendChild(dn); grp.appendChild(c); grp.appendChild(up);
    row.appendChild(l); row.appendChild(bar); row.appendChild(grp);
    p.appendChild(row);
  }
  // THE SHEET, SAID OUT LOUD — right under the sliders, updating as you spend, so
  // the creator answers "who am I building" and not just "what did I buy".
  const arch=document.createElement('div'); arch.className='archline';
  arch.innerHTML='<span>Archetype</span><b>'+archetype()+'</b>';
  p.appendChild(arch);
  const pts=document.createElement('div'); pts.className='pts'+(left<0?' over':'');
  pts.style.marginTop='.5rem';
  pts.innerHTML='Points left: <b style="color:'+(left>0?'var(--accent)':'var(--muted)')+'">'+left+'</b>';
  p.appendChild(pts);

  // The legend BUILD block sat between the two anchors I replaced and got eaten
  // with them, leaving \`p.appendChild(legend)\` referencing a variable that no
  // longer existed. creator() threw, the panel rendered zero rows, and the whole
  // page went blank — caught by counting rows, not by reading the diff.
  // NINE ROWS OF REFERENCE, AS TALL AS THE THING IT EXPLAINS. Every attribute's
  // note, printed under a creator that already has nine rows — so the screen you
  // came to use was half glossary. It's read once and it's the definition of
  // reference material, so: a <details>, shut on a phone and open on a desktop
  // where the height is free. Not deleted — a first-timer needs to know what
  // Durability does, and the sheet is meaningless without it.
  const lgw=document.createElement('details'); lgw.className='legwrap';
  lgw.open = !(win_coarse());
  const lgs=document.createElement('summary'); lgs.className='rl';
  lgs.textContent='What the attributes do';
  lgw.appendChild(lgs);
  const legend=document.createElement('div'); legend.className='legend';
  for(const A of ATTRS){
    const r=document.createElement('div'); r.className='lg-row';
    const k=document.createElement('b'); k.textContent=A.label;
    const v=document.createElement('span'); v.textContent=A.note;
    r.appendChild(k); r.appendChild(v); legend.appendChild(r);
  }
  lgw.appendChild(legend);
  p.appendChild(lgw);
  const tip=document.createElement('div'); tip.className='tipbox';
  // KEEP THIS SHORT AND KEEP IT TRUE. Two previous versions of this box shipped
  // advice that was flatly wrong, both times because it was derived from a
  // measurement taken on a broken foundation:
  //   1. "leave no hole, get competent everywhere, then lean" — measured off the
  //      fantasy stat curves, where the top of every attribute was inert.
  //   2. "striking pays the same against everyone" — true of the SIM, which used
  //      to referee. It doesn't any more; the style triangle is ours now, and
  //      striking has a real matchup. The line outlived the thing it described.
  // Player-facing advice is the worst place for a stale finding: it's a lie the
  // player can't check. If a claim here isn't currently measurable, cut it.
  tip.innerHTML='<b>Build for the path you want.</b> A wrestler dominates a striker with '+
    'bad takedown defence, and stalls against elite TDD.';
  p.appendChild(tip);
  const row=document.createElement('div');
  row.style.cssText='display:flex;gap:.5rem;align-items:center;margin-top:.6rem';
  const b=document.createElement('button'); b.className='btn pri'; b.textContent='Turn pro →';
  b.onclick=()=>{ G.started=true; render(); };
  row.appendChild(b);
  // Restart here clears the sheet back to a blank 42 points. It does NOT reset the
  // division — that's the <select> above, which restarts on change anyway, and
  // silently flipping a player's weight class out from under a button labelled
  // "Restart" would be a surprise, not a reset.
  row.appendChild(restartBtn(true));
  p.appendChild(row);
  return p;
}

// RESTART — one definition, both screens, because they are the same intent
// ("start this fighter over") and would otherwise drift into two behaviours.
//
// IT CONFIRMS ONLY WHEN THERE IS SOMETHING TO LOSE. On the creator you are
// throwing away a few clicks of point-spending, and a dialog for that is nagging.
// Mid-run you are throwing away a 9-2 record that took fifteen fights and cannot
// be recovered — CUT_AT, the whole design, is built on losses being irreversible,
// so a misclick that silently deletes the run would be the cruellest bug on the
// page. Same button, and the difference is measured off G.log rather than off
// which screen called it: the screen is a proxy for "has anything happened yet",
// and G.log IS that fact.
function restartBtn(small){
  const b=document.createElement('button');
  b.className='btn'+(small?' restart':'');
  b.textContent='Restart';
  b.title='Start over with a new fighter';
  b.onclick=()=>{
    if (G.log.length &&
        !confirm('Restart?\\n\\nYour '+ufcRecord()+' run ends here and you build a new fighter. This cannot be undone.')) return;
    newGame();
  };
  return b;
}

function hud(){
  const p=document.createElement('div'); p.className='panel';
  const d=document.createElement('div'); d.className='hud';
  d.innerHTML =
    // The HUD shows the PRO record — the one a broadcast would put under your name
    // — with the UFC record beside it, because that's the one the belt cares about.
    '<div><span>Record</span><b>'+totalRecord()+'</b>'+
      '<span style="text-transform:none;letter-spacing:0;margin-top:.15rem">'+ufcRecord()+' UFC</span></div>'+
    // Mid-run it belongs in the HUD, because upgrade points change it: spend four
    // on wrestling and a Knockout artist becomes Ground-and-pound, and you should
    // see that happen rather than have to infer it from nine bars.
    '<div><span>Archetype</span><b class="archv">'+archetype()+'</b></div>'+
    '<div><span>Rank</span><b>'+(G.rank==null?'Unranked':(G.rank===0?'CHAMP':'#'+G.rank))+'</b></div>'+
    '<div><span>Streak</span><b>'+G.streak+'</b></div>'+

    '<div><span>Age</span><b>'+(START_AGE + Math.floor(((G.fightNo||0)*MONTHS_PER_FIGHT)/12))+'</b></div>'+
    // WAS (2 - G.losses): hardcoded when two losses ended a run, and left behind
    // when CUT_AT became a constant and moved to 5 — so getting cut displayed
    // "Lives -3". Clamped at 0 as well: a dead fighter has none, not a negative
    // number of them.
    '<div><span>Losses left</span><b>'+Math.max(0, CUT_AT-G.losses)+'</b></div>';
  // Last, and pushed to the far right by margin-left:auto — a destructive control
  // does not belong next to the thing you came to read, and it should not be the
  // first target your thumb finds. The HUD is the only chrome that persists across
  // every in-run screen, so it's the one place a restart is always where you left it.
  d.appendChild(restartBtn(true));
  p.appendChild(d); return p;
}

function resultBox(){
  const {o,won,fin,method}=G.last;
  const p=document.createElement('div'); p.className='panel';
  const b=document.createElement('div'); b.className='big '+(won?'win':'loss');
  // Both directions name the method. "lost to Tom Aspinall" told you nothing about
  // what happened; "lost to Tom Aspinall by KO/TKO" is the same sentence the win
  // side has always got.
  b.textContent = (won ? 'def. ' : 'lost to ') + o.f.name + ' by ' + (method||'decision');
  p.appendChild(b);
  const L=G.log[G.log.length-1];
  const rd=document.createElement('div'); rd.className='note';
  rd.innerHTML = 'Rounds: ' + L.rounds.map((w,i)=>
    '<b style="color:'+(w?'var(--accent)':'var(--accent2)')+'">R'+(i+1)+(w?' ✓':' ✗')+'</b>').join(' &nbsp; ') +
    (L.fin ? ' &nbsp;→&nbsp; <b style="color:'+(won?'var(--accent)':'var(--accent2)')+'">'+
             (won?'finished in R':'stopped in R')+L.finRound+'</b>'
           : ' &nbsp;→&nbsp; ' + L.roundsWon + '-' + (L.rounds.length-L.roundsWon) + ' on the cards');
  p.appendChild(rd);
  // THE NUMBER, AFTER THE FACT. Deferred, not hidden: before the fight a precise
  // percentage reads as a promise, afterwards it reads as information.
  const od=document.createElement('div'); od.className='note';
  const vn=varianceNote(o.p, won);
  const bd=oddsBand(o.p);
  od.innerHTML = bd.was+' <b>'+amer(o.p)+'</b>.'+
    (vn ? ' <span style="color:'+(won?'var(--accent)':'var(--gold)')+'">'+vn+'</span>' : '');
  p.appendChild(od);
  const n=document.createElement('div'); n.className='note';
  const left = CUT_AT - G.losses;
  n.textContent = won
    ? '+'+o.reward+' upgrade points.'
    : (left===1 ? 'One loss left.' : left+' losses left.');
  p.appendChild(n);
  return p;
}

// Show the COST, not the % boost.
//
// I added a live "+1 (+1.8%)" marginal-value readout to answer an earlier note
// that category impact was unclear. Playtest: "on the upgrades, it should just
// say what it costs to upgrade, not the % boost you get." Right — the % turned
// every upgrade into a solved arithmetic problem: read five numbers, take the
// biggest, no judgement. Showing cost keeps the decision a judgement about the
// fighter you want to be. The marginal calc is gone entirely (it also cost 5
// extra sim calls per render).
function upgrade(){
  // NINE ROWS OF STEPPERS YOU CANNOT USE. This panel always drew every attribute,
  // and mid-run G.pts is usually 0 — you spend the moment you're paid — so the
  // tallest block on the phone was nine disabled controls sitting between the
  // result you wanted to read and the fights you came to pick.
  //
  // A <details> rather than a delete: your build is the only place the sheet is
  // visible mid-run, so hiding it outright would cost real information. Open when
  // there's something to spend (the panel is then the point of the screen), shut
  // when there isn't (it's reference, one tap away).
  const p=document.createElement('details'); p.className='panel upg';
  p.open = G.pts>0;
  const sm=document.createElement('summary'); sm.className='rl';
  sm.innerHTML = G.pts>0
    ? 'Spend upgrade points (<b style="color:var(--accent)">'+G.pts+'</b>)'
    : 'Your fighter <span class="hint">— no points to spend</span>';
  p.appendChild(sm);
  for(const A of ATTRS){
    const row=document.createElement('div'); row.className='attr up';
    const l=document.createElement('label'); l.textContent=A.label;
    // Same level readout as the creator: a bar you can't read a number off is a
    // mood, not information.
    const bar=document.createElement('div'); bar.className='lvlwrap';
    bar.innerHTML='<div class="lvlbar"><div class="lvlfill" style="width:'+
      ((G.attrs[A.id]-ATTR_MIN)/(ATTR_MAX-ATTR_MIN)*100)+'%"></div></div>'+
      '<span class="lvlnum">'+G.attrs[A.id]+'<i>/'+ATTR_MAX+'</i></span>';
    const btn=document.createElement('button'); btn.className='btn';
    const cost = upCost(G.attrs[A.id]);
    const maxed = G.attrs[A.id] >= ATTR_MAX;
    btn.textContent = maxed ? 'MAX' : ('+1  ·  ' + cost + (cost>1?' pts':' pt'));
    btn.style.padding='.15rem .5rem'; btn.style.fontSize='.68rem'; btn.style.whiteSpace='nowrap';
    btn.disabled = G.pts<cost || maxed;
    if(btn.disabled) btn.style.opacity=.3;
    else btn.style.borderColor='var(--accent)';
    btn.onclick=()=>{ if(G.pts<cost||maxed) return; G.attrs[A.id]++; G.pts-=cost; render(); };
    row.appendChild(l); row.appendChild(bar); row.appendChild(btn);
    p.appendChild(row);
  }
  return p;
}

function offerBox(){
  const p=document.createElement('div'); p.className='panel';
  p.innerHTML='<div class="rl">Pick your next fight</div>';
  const g=document.createElement('div'); g.className='opps';
  const list=offers();
  for(const o of list){
    const b=document.createElement('button'); b.className='opp'+(o.p<0.4?' risky':'');
    const rk=o.f.rankNum===99?'Unranked':(o.f.rankNum===0?'CHAMPION':'#'+o.f.rankNum);
    b.innerHTML='<div class="opphd">'+avatarHTML(o.f)+'<div class="oppwho">'+
        '<div class="rk">'+rk+'</div><div class="nm"></div><div class="rec"></div></div></div>'+
      '<div class="odds"><b style="color:'+oddsBand(o.p).c+'">'+oddsBand(o.p).t+'</b></div>'+
      '<div class="rw">+'+o.reward+' upgrade pts if you win</div>';
    b.querySelector('.nm').textContent=o.f.name;
    b.querySelector('.rec').textContent=o.f.record;
    b.onclick=()=>fight(o);
    g.appendChild(b);
  }
  p.appendChild(g);
  return p;
}

// Is this a touch device? Used to decide what starts collapsed — height is scarce
// on a phone and free on a desktop. matchMedia, not a width guess: a narrow
// desktop window has a mouse and plenty of screen, and would be wrong on both.
// Guarded because jsdom has no matchMedia and the whole page would throw.
const win_coarse = () => !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

// ONE DEFINITION of what a fight's method is called, because the record, the
// result line and the end-of-run tally all have to agree. Older logs predate the
// loss-method work and carry method:null on every loss — fall back rather than
// print "null vs Tom Aspinall".
const METHODS = ['KO/TKO','submission','decision'];
const methodTag = f => f.method==='submission' ? 'SUB'
                     : f.method==='KO/TKO'     ? 'KO '
                     : 'DEC';
function methodTally(won){
  const t = {'KO/TKO':0,'submission':0,'decision':0};
  for (const f of G.log) if (f.won===won) t[f.method || 'decision']++;
  return t;
}
function logBox(full){
  // THE LOG GROWS FOREVER AND SITS UNDER EVERY SCREEN. A 15-fight run is 15 rows
  // you scroll past to get anywhere, and the only ones you're reading are the last
  // few. Cap it in-run; the END screen passes full=true, because that's the moment
  // the whole record IS the thing you came to look at.
  const CAP = 5;
  const rows = G.log.slice().reverse();
  const shown = full ? rows : rows.slice(0, CAP);
  const hidden = rows.length - shown.length;
  const p=document.createElement('div'); p.className='panel';
  p.innerHTML='<div class="rl">Your record'+(hidden?' <span class="hint">— last '+CAP+' of '+rows.length+'</span>':'')+'</div>';
  const l=document.createElement('div'); l.className='log';
  if(!G.log.length) l.innerHTML='<span style="color:var(--muted)">No fights yet.</span>';
  shown.forEach(f=>{
    const d=document.createElement('div');
    // EVERY LINE NAMES ITS METHOD. This read \`f.won&&f.fin ? (SUB|KO) : '   '\` —
    // three literal spaces. So a decision showed nothing, and a LOSS showed nothing
    // whatever happened, because f.won gated the whole expression. Two thirds of a
    // record was blank: "L     vs Tom Aspinall (41%)" is a result with the result
    // taken out. The methods existed; the log just never asked about them.
    // WHO HE WAS, IN ONE SLOT. The rank sits where a rankings table puts it —
    // before the name — and the champion's gold C occupies the same slot, because
    // "C" IS his ranking. A record of "W KO vs Sergei Pavlovich" doesn't say
    // whether that was a contender or a gatekeeper, which is most of what a record
    // means; "#3 Sergei Pavlovich" does. f.rank is the opponent's rankNum AT THE
    // TIME, already in the log — 0 champion, 0.5 interim, 99 unranked — so this
    // reads the standing he actually had when you fought him, not his standing now.
    const rk = f.rank===0   ? '<span class="cmark" title="Champion">C</span>'
             : f.rank===0.5 ? '<span class="cmark im" title="Interim champion">C</span>'
             : f.rank>=99   ? '<span class="rk ur" title="Unranked">UR</span>'
             :                '<span class="rk">#'+f.rank+'</span>';
    d.innerHTML='<span class="'+(f.won?'w':'l')+'">'+(f.won?'W':'L')+'</span> '+
      '<span class="mth">'+methodTag(f)+'</span> vs '+rk+' '+f.opp+
      ' <span class="ml">'+amer(f.p)+'</span>';
    l.appendChild(d);
  });
  p.appendChild(l);
  return p;
}

// ONE DESCRIPTION OF THE RUN, for the sheet and the share text both. The rank the
// sheet prints and the rank the tweet claims must be the same rank, so they are
// the same string, built once. (peakLabel is for a scoreboard — "CHAMPION", "#3";
// shareRank has to survive inside a sentence — "champion", "the #3 contender".)
function runSummary(){
  const wins = G.log.filter(f=>f.won);
  const fins = wins.filter(f=>f.fin).length;
  const best = wins.slice().sort((a,b)=>a.p-b.p)[0];
  const w = methodTally(true), l = methodTally(false);
  return {
    champ: !!G.champ,
    // THE SHEET SAYS WHAT THE SCREEN SAYS. endBox() is the moment the run lands —
    // one big coloured verdict, then the record — and the share image was telling a
    // different story in a different voice ("My run", a FINISHED AS hero card). Two
    // designs for one moment is how they drift. This is endBox's own headline,
    // built by the same expression, so the picture can't say something the page
    // didn't.
    verdict: G.champ ? 'CHAMPION.' : 'CUT.',
    verdictSub: G.champ ? 'You did it.' : CUT_AT+' losses.',
    division: (D && D.divisions && D.divisions[DIV] && D.divisions[DIV].label) || DIV,
    fights: G.log.length,
    age: START_AGE + Math.floor(((G.fightNo||0)*MONTHS_PER_FIGHT)/12),
    style: archetype(),
    pro: totalRecord(),
    ufc: ufcRecord(),
    peakLabel: G.champ ? 'CHAMPION' : G.peak==null ? 'UNRANKED' : '#'+G.peak,
    shareRank: G.champ ? 'champion' : G.peak==null ? 'unranked'
             : 'the #'+G.peak+' contender',
    bestWin: best ? 'Best win: '+best.opp+' at '+amer(best.p) : 'No wins',
    finishRate: wins.length ? Math.round(fins/wins.length*100)+'%' : '—',
    // W and L both, exactly like the end screen's tally — a run that got knocked
    // out three times is not the run that got out-pointed three times.
    byMethod: [
      { label:'KO/TKO',     w:w['KO/TKO'],    l:l['KO/TKO'] },
      { label:'Submission', w:w.submission,   l:l.submission },
      { label:'Decision',   w:w.decision,     l:l.decision },
    ],
    // The fight list, newest first, in the end screen's own shape: W/L, method,
    // rank, name, moneyline. This is the part people screenshot.
    log: G.log.slice().reverse().map(f => ({
      won: f.won,
      method: methodTag(f).trim(),
      rank: f.rank===0 ? 'C' : f.rank===0.5 ? 'C' : f.rank>=99 ? 'UR' : '#'+f.rank,
      champ: f.rank<=0.5,
      opp: f.opp,
      ml: amer(f.p),
    })),
  };
}
function endBox(msg){
  const p=document.createElement('div'); p.className='panel';
  const b=document.createElement('div'); b.className='big '+(G.champ?'win':'loss'); b.textContent=msg;
  p.appendChild(b);
  // TWO RECORDS, because they answer two different questions. The PRO record is
  // the one that goes under your name on a broadcast and includes the 10-0 you
  // walked in with; the UFC record is the only one the belt ever cared about, and
  // it's the one every rule in the game actually reads. Printing just the total
  // would flatter a 1-4 run into 11-4; printing just the UFC record loses the
  // premise the whole economy is built on.
  const rec=document.createElement('div'); rec.className='recs';
  rec.innerHTML =
    '<div><span>Pro record</span><b>'+totalRecord()+'</b></div>'+
    '<div><span>UFC record</span><b>'+ufcRecord()+'</b></div>'+
    '<div><span>Peak</span><b>'+(G.champ?'CHAMPION':G.peak==null?'Unranked':'#'+G.peak)+'</b></div>';
  p.appendChild(rec);
  const n=document.createElement('div'); n.className='note';
  const best = G.log.filter(f=>f.won).sort((a,b)=>a.p-b.p)[0];
  // The best win speaks moneyline now too — same reason as the log.
  n.textContent = best ? 'Best win: '+best.opp+' at '+amer(best.p)+'.' : 'No wins.';
  p.appendChild(n);
  // HOW THE RUN ACTUALLY WENT, not just how often. "9-4" and "9-4" are the same
  // line for a man who knocked out nine people and one who out-pointed nine, and
  // they are not the same career. The build already decides method — power buys
  // knockouts, grappling buys taps, chin keeps you off the highlight reel — so
  // this is where a build gets to describe itself in its own results.
  if (G.log.length) {
    const w = methodTally(true), l = methodTally(false);
    const t = document.createElement('div'); t.className='mtally';
    t.innerHTML = '<div class="rl">By method</div>' +
      '<div class="mrow mhead"><span></span><span>W</span><span>L</span></div>' +
      METHODS.map(m =>
        '<div class="mrow"><span>'+(m==='KO/TKO'?'KO/TKO':m==='submission'?'Submission':'Decision')+'</span>'+
        '<span class="'+(w[m]?'w':'z')+'">'+w[m]+'</span>'+
        '<span class="'+(l[m]?'l':'z')+'">'+l[m]+'</span></div>').join('');
    p.appendChild(t);
  }
  // full=true: the run is over and the record is the whole point of this screen.
  p.appendChild(logBox(true));
  const row=document.createElement('div'); row.style.cssText='display:flex;gap:.5rem;flex-wrap:wrap';
  const b2=document.createElement('button'); b2.className='btn pri'; b2.textContent='New run';
  b2.onclick=newGame; row.appendChild(b2);
  // SHARE. GL_SHEET is loaded \`defer\` from /gl-sheet.js, so on a cold page it may
  // not exist yet — and it CANNOT exist when this file is opened over file:// or
  // run headless in the test harness. Degrade by hiding the button rather than
  // throwing: an end screen that crashes because a share renderer is missing would
  // be a worse bug than having no share button.
  if (window.GL_SHEET && window.GL_SHEET.climb) {
    const b3=document.createElement('button'); b3.className='btn'; b3.textContent='Share this run';
    // navigator.share() needs transient activation, so GL_SHEET.open must be called
    // straight out of the click — no awaiting anything first. It does its own
    // rendering behind a busy state.
    b3.onclick=()=>window.GL_SHEET.climb(runSummary());
    row.appendChild(b3);
  }
  p.appendChild(row);
  return p;
}

// LOCKED = LOGGED OUT, AND IT IS NOT THE SAME AS BROKEN.
//
// The page is served to everyone so a shared link previews and Google can read it;
// the LADDER is what's gated, because it carries the power ratings. So a logged-out
// visitor gets real HTML and a real pitch, and the fetch below never happens —
// without this it would fire, get redirected to /signup, receive HTML where it
// wanted JSON, and land in the catch reporting "Could not load /data/climb.json"
// with instructions to run python3. That's a page telling a prospective user the
// site is broken at the exact moment it's asking them to sign up.
if (window.CLIMB_LOCKED) {
  const p=document.createElement('div'); p.className='panel';
  p.innerHTML='<div class="big win">Create a free account to play</div>'+
    '<div class="note">The Climb is free. You build a fighter, start as a 10-0 prospect, '+
    'and try to win a real UFC belt against the real division — no card, no trial.</div>';
  const a=document.createElement('a'); a.className='btn pri'; a.href='/signup?next=/theclimb';
  a.textContent='Create a free account →';
  a.style.cssText='display:inline-block;margin-top:.8rem;text-decoration:none';
  p.appendChild(a);
  const l=document.createElement('a'); l.href='/login?next=/theclimb'; l.textContent='or log in';
  l.style.cssText='display:inline-block;margin:.8rem 0 0 .7rem;color:var(--muted);font-size:.78rem';
  p.appendChild(l);
  $('#app').innerHTML=''; $('#app').appendChild(p);
} else
fetch('/data/climb.json').then(r=>r.json()).then(d=>{
  // No createScorer any more. The 90KB browser-wrapped simulator and the 443KB
  // of FIGHTER_STATS/FIGHT_HISTORY it ate are gone: the game scores fights
  // itself, so all it needs is the ladder. 10 divisions now cost 17KB gzipped —
  // 26x less than ONE division used to.
  D=d;
  DIV = d.order[0];
  newGame();
}).catch(e=>{
  $('#app').innerHTML='<div class="load">Could not load /data/climb.json — '+e.message+
    '<br><br>Run <b>python3 -m http.server</b> in the repo root, then open<br>'+
    '<b>localhost:8000/prototypes/the-climb.html</b></div>';
});
</script>
</body>
</html>
`;
