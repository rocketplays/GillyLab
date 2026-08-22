/* AUTO-GENERATED from prototypes/the-climb.html by scripts/gen-climb-page.cjs — do not edit by hand.
   Edit the prototype: it is what the whole test/sim harness reads. */
export const climbPage = ({ head, nav, back, cta, footer }) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#12251b">
<title>The Climb — build a fighter, win the UFC belt | GillyLab</title>
<meta name="description" content="Build a UFC fighter, start as a 10-0 prospect, pick your fights and climb the real rankings to the belt. Free on GillyLab.">
<!-- The share sheet is the app's, not a copy of it. gen-gl-sheet.cjs generates
     gl-sheet.js out of index.html so standalone pages can render a sheet that is
     byte-identical to the app's; /pickem already loads it exactly this way. Barlow
     is required — GL_SHEET draws in it and awaits document.fonts.ready, so without
     the link the sheet renders in a fallback face and looks like a knock-off of
     itself. Both are relative because this page is served from the repo root. -->
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&family=Barlow:wght@300;400;500&family=Press+Start+2P&display=swap" rel="stylesheet">
<script src="/gl-sheet.js?v=06bcf16b" defer></script>
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

  /* ── THE GAME PLAN ───────────────────────────────────────────────────────────
     The screen you draw up before a fight: scouting, where/read choices with
     honest pros and cons, a corner steer scaled by Fight IQ. */
  .plan .plan-hd{display:flex;align-items:center;gap:.55rem;margin-bottom:.3rem}
  .plan .plan-hd .oppwho .nm{font-weight:700;font-size:.98rem;line-height:1.2}
  .plan .plan-hd .oppwho .rk{font-size:.58rem;text-transform:uppercase;letter-spacing:.07em;color:var(--muted)}
  .plan .plan-hd .oppwho .rec{font-size:.72rem;color:var(--muted)}
  .plan-scout{background:var(--surface);border:1px solid var(--border);border-radius:7px;padding:.55rem .7rem;margin:.35rem 0 .2rem}
  .plan-scout .scout-arch{font-size:.78rem;font-weight:700;color:var(--gold)}
  .plan-scout .scout-row{display:flex;justify-content:space-between;font-size:.72rem;margin-top:.35rem}
  .plan-scout .scout-row .v{color:var(--text);font-variant-numeric:tabular-nums}
  .plan-scout .scout-bar{height:3px;background:var(--surface2);border-radius:2px;margin-top:.15rem;overflow:hidden}
  .plan-scout .scout-bar i{display:block;height:100%;background:var(--muted)}
  .plan-lab{color:var(--muted);font-size:.62rem;text-transform:uppercase;letter-spacing:.08em;margin:.8rem 0 .4rem}
  .plan-opts{display:flex;flex-wrap:wrap;gap:.4rem}
  .plan-opt{background:var(--surface2);border:1px solid var(--border);border-radius:7px;
    padding:.45rem .7rem;font-size:.8rem;color:var(--text);cursor:pointer;font-family:inherit}
  .plan-opt:hover{border-color:var(--muted)}
  .plan-opt.on{border-color:var(--accent);background:rgba(0,230,104,.09);color:var(--accent)}
  /* corner's pick — a high-Fight-IQ steer, marked so the optimal plan is unmistakable */
  .plan-opt.pick{border-color:var(--gold)}
  .plan-opt.pick.on{border-color:var(--accent)}
  .plan-opt .pick-tag{display:block;font-size:.6rem;text-transform:uppercase;letter-spacing:.05em;
    color:var(--gold);font-weight:700;margin-top:.15rem}
  .pc{background:var(--surface);border:1px solid var(--border);border-radius:7px;padding:.5rem .65rem;margin-top:.5rem}
  .pc-line{display:flex;gap:.45rem;align-items:flex-start;font-size:.78rem;line-height:1.5;margin:.2rem 0}
  .pc-line .mk{flex:0 0 auto;width:.85rem;text-align:center;font-weight:700}
  .pc-line.pro .mk{color:var(--accent)}
  .pc-line.con .mk{color:var(--accent2)}
  .corner{display:flex;gap:.5rem;align-items:flex-start;margin-top:.85rem;padding-top:.7rem;
    border-top:1px solid var(--border);font-size:.78rem;color:var(--text);font-style:italic;line-height:1.5}
  .plan-act{display:flex;gap:.5rem;align-items:center;margin-top:.85rem}

  /* ── IN-FIGHT MOMENTS ─────────────────────────────────────────────────────── */
  .bout-bars{display:flex;gap:12px;margin:.5rem 0 .3rem}
  .bout-bar{flex:1}
  .bout-bl{display:flex;justify-content:space-between;font-size:.62rem;color:var(--muted);margin-bottom:3px}
  .bout-tr{height:7px;border-radius:4px;background:var(--surface2);overflow:hidden;border:1px solid var(--border)}
  .bout-tr span{display:block;height:100%}
  .bout-beat{margin-top:.7rem;background:var(--surface2);border-radius:8px;padding:.5rem .7rem;font-size:.86rem;font-weight:700}
  .bout-beat.good{color:var(--gold);border:1px solid var(--gold)}
  .bout-beat.bad{color:var(--accent2);border:1px solid var(--accent2)}
  .bout-iq{font-size:.73rem;color:var(--muted);font-style:italic;margin:.4rem 2px .1rem}
  .bout-opt{flex:1 1 100%;text-align:left}
  .bout-ct{display:flex;justify-content:space-between;align-items:center;font-weight:700;font-size:.82rem;margin-bottom:.25rem}
  .bout-ct .rr{font-size:.55rem;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
  .bout-opt.risk .bout-ct .rr{color:var(--accent2)}
  /* Opponent's name+photo on the RIGHT, matching their column in the bars below —
     scoped to .bout only; .opphd itself is shared with the offer/callout/rival
     cards elsewhere, which still want the plain left-aligned layout. */
  .bout .opphd{justify-content:space-between}
  .opp-id{display:flex;align-items:center;gap:.5rem}
  .opp-nm{font-weight:700;font-size:.86rem;color:var(--text);white-space:nowrap}

  /* IMPACT FX — one-shot classes toggled by JS (G.fxPanel/G.fxAvatar, set in
     advanceBout()/boutChoose(), consumed and cleared in boutBox()) right before a
     fresh bout panel is built, so the animation plays once on paint and never
     replays on an unrelated re-render. Kept subtle — this READS a fight, it
     doesn't need to look like a fighting game. */
  @keyframes climbShake{
    10%,90%{transform:translateX(-1px)} 20%,80%{transform:translateX(2px)}
    30%,50%,70%{transform:translateX(-4px)} 40%,60%{transform:translateX(4px)} }
  @keyframes climbFlashGood{0%{box-shadow:inset 0 0 0 999px rgba(0,230,104,.18)}100%{box-shadow:inset 0 0 0 999px rgba(0,230,104,0)}}
  @keyframes climbFlashBad{0%{box-shadow:inset 0 0 0 999px rgba(255,61,0,.20)}100%{box-shadow:inset 0 0 0 999px rgba(255,61,0,0)}}
  @keyframes climbPunch{0%{transform:scale(1)}35%{transform:scale(1.16)}100%{transform:scale(1)}}
  .bout.fx-shake{animation:climbShake .4s ease-in-out}
  .bout.fx-flash-good{animation:climbFlashGood .6s ease-out}
  .bout.fx-flash-bad{animation:climbFlashBad .6s ease-out}
  .av.fx-punch img{animation:climbPunch .35s ease-out}
  .av.fx-rattled img{animation:climbShake .4s ease-in-out;filter:saturate(.35) brightness(.8)}

  /* RETRO HUD — a pixel font for SHORT tags/numbers only (bar labels, the risk
     chip, splat text). Sentence-length copy — the beat line, the pro/con text —
     stays in Barlow; Press Start 2P at paragraph length is a readability tax, not
     "gamified". Segmented bars and a notched panel border carry the rest of the
     arcade read, both pure CSS, no new art. */
  .bout-bl span, .bout-ct .rr{font-family:'Press Start 2P',monospace;letter-spacing:0}
  .bout-bl span{font-size:.5rem}
  .bout-ct .rr{font-size:.46rem}
  .panel.bout{
    position:relative;
    border:3px solid var(--border);
    clip-path:polygon(0 6px,6px 6px,6px 0,calc(100% - 6px) 0,calc(100% - 6px) 6px,100% 6px,
      100% calc(100% - 6px),calc(100% - 6px) calc(100% - 6px),calc(100% - 6px) 100%,
      6px 100%,6px calc(100% - 6px),0 calc(100% - 6px));
  }
  .bout-opt{
    border:2px solid var(--border);
    clip-path:polygon(0 4px,4px 4px,4px 0,calc(100% - 4px) 0,calc(100% - 4px) 4px,100% 4px,
      100% calc(100% - 4px),calc(100% - 4px) calc(100% - 4px),calc(100% - 4px) 100%,
      4px 100%,4px calc(100% - 4px),0 calc(100% - 4px));
  }
  /* Segmented "Mega Man" health-bar chunks — an overlay, not a repaint of the fill,
     so it works regardless of what color JS sets on the fill span underneath. */
  .bout-tr{position:relative}
  .bout-tr::after{content:'';position:absolute;inset:0;pointer-events:none;
    background-image:repeating-linear-gradient(90deg, transparent 0 7px, rgba(0,0,0,.42) 7px 9px)}
  /* Hit-splat — one-shot pixel-font pop text, G.fxSplat, same lifecycle as
     G.fxPanel/G.fxAvatar (set in advanceBout(), consumed+cleared in boutBox()). */
  @keyframes climbSplat{
    0%{opacity:0;transform:translate(-50%,-40%) scale(.4) rotate(-6deg)}
    15%{opacity:1;transform:translate(-50%,-50%) scale(1.15) rotate(-3deg)}
    30%{transform:translate(-50%,-50%) scale(1) rotate(0deg)}
    75%{opacity:1}
    100%{opacity:0;transform:translate(-50%,-65%) scale(1) rotate(0deg)}
  }
  .fx-splat{position:absolute;left:50%;top:38%;z-index:5;pointer-events:none;
    font-family:'Press Start 2P',monospace;font-size:1.05rem;letter-spacing:.02em;
    text-shadow:2px 2px 0 rgba(0,0,0,.6),-1px -1px 0 rgba(0,0,0,.6);
    animation:climbSplat 1.1s ease-out forwards}

  /* ── SIGNATURE PICKER — compact cards + a detail strip (stays 2-up on mobile) */
  .siggrid{display:grid;grid-template-columns:1fr 1fr;gap:.4rem}
  .sigcard{background:var(--surface2);border:1px solid var(--border);border-radius:7px;padding:.4rem .55rem;text-align:left;cursor:pointer;font-family:inherit;color:var(--text)}
  .sigcard:hover{border-color:var(--muted)}
  .sigcard.on{border-color:var(--accent);background:rgba(0,230,104,.07)}
  .sgh{font-weight:700;font-size:.78rem;color:var(--gold)}
  .sigcard.on .sgh{color:var(--accent)}
  .sgs{font-size:.66rem;line-height:1.3;color:var(--muted);margin-top:.12rem}
  .sigdetail{margin-top:.5rem;font-size:.72rem;line-height:1.45;color:var(--text);background:var(--surface);border:1px solid var(--border);border-radius:7px;padding:.5rem .65rem}
  .sigdetail .sge{display:block}
  .sigdetail .sgf{display:block;margin-top:.25rem;color:var(--muted);font-size:.68rem}
  .sigdetail .sgf b{color:var(--accent2)}
  .sigdetail.muted{color:var(--muted)}
  .sigcard.locked{opacity:.5;cursor:not-allowed}
  .sigcard.locked .sgh{color:var(--muted)}
  .sigcard.locked .sgs{color:var(--gold)}
  .panel.sigunlock{border-color:var(--gold)}
  .su-name{font-weight:700;font-size:1rem;color:var(--gold)}
  .su-line{font-size:.82rem;line-height:1.5;margin-top:.3rem;color:var(--text)}
  .su-flaw{font-size:.72rem;color:var(--muted);margin-top:.35rem}
  .su-act{display:flex;gap:.5rem;margin-top:.7rem;flex-wrap:wrap}
  .champ-note{background:#1a1206;border:1px solid var(--gold);border-radius:8px;padding:.5rem .7rem;font-size:.78rem;color:var(--gold);margin-bottom:.5rem;line-height:1.5}
  .btn.retire{margin-top:.7rem;border-color:var(--gold);color:var(--gold)}
  .sigv{font-size:.78rem}

  /* ── THE CALLOUT ─────────────────────────────────────────────────────────────
     A statement fight, set apart from the safe ladder in gold. */
  .co-rl{color:var(--gold);margin-top:.85rem}
  .opp.callout{border:1.5px solid var(--gold);background:#161009;position:relative;width:100%;text-align:left}
  .opp.callout .rk{color:var(--gold)}
  .co-tag{position:absolute;top:0;right:0;background:var(--gold);color:#1a1206;font-size:.52rem;
    font-weight:700;letter-spacing:.05em;padding:2px 8px;border-bottom-left-radius:7px}
  .co-rr{display:flex;flex-direction:column;gap:2px;margin-top:.5rem;font-size:.66rem;line-height:1.45}
  .co-rr .up{color:var(--accent)}
  .co-rr .dn{color:var(--accent2)}
  /* hype meter in the HUD */
  .hypv{display:inline-flex;align-items:center;gap:3px}
  .hp{width:12px;height:6px;border-radius:3px;background:var(--border);display:inline-block}
  .hp.on{background:var(--gold)}
  .hype-rdy{color:var(--gold);font-size:.55rem;text-transform:uppercase;letter-spacing:.05em;margin-left:4px;font-weight:700}
  /* rivalry card — the callout's angry twin */
  .rv-rl{color:var(--accent2);margin-top:.85rem}
  .opp.rival{border:1.5px solid var(--accent2);background:#160a09;position:relative;width:100%;text-align:left}
  .opp.rival .rk{color:var(--accent2)}
  .co-tag.rival{background:var(--accent2);color:#fff}
  .co-rr .rvup{color:var(--accent)}

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
  button.btn.pri{background:linear-gradient(180deg,rgba(0,230,104,.09),rgba(0,230,104,.03));color:#f4f5f7;border-color:rgba(0,230,104,.35)}
  button.btn.pri:hover{background:linear-gradient(180deg,rgba(0,230,104,.18),rgba(0,230,104,.07));border-color:var(--accent)}
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
  /* Aurora background + top/bottom fade — matches the landing/app pages. Green glow on a
     solid html canvas (so phone insets stay dark), transparent body, two fixed layers at
     z-index:-1 behind the content: #bgfx the aurora, #bgedge the edge fade. */
  html{background:#0a0a0b radial-gradient(1100px 520px at 50% -6%,#12251b 0%,#0a0a0b 52%)}
  body{background:transparent}
  #bgfx{position:fixed;inset:0;z-index:-1;pointer-events:none;--a1:0.081;--a2:0.063;--a3:0.072;--aur:1;background:radial-gradient(60vw 48vh at 12% 28%,rgba(0,230,104,calc(var(--a1) * var(--aur))) 0%,transparent 62%),radial-gradient(66vw 55vh at 88% 58%,rgba(50,120,255,calc(var(--a2) * var(--aur))) 0%,transparent 62%),radial-gradient(72vw 48vh at 45% 90%,rgba(0,230,104,calc(var(--a3) * var(--aur))) 0%,transparent 62%)}
  #bgedge{position:fixed;inset:0;z-index:-1;pointer-events:none;background:linear-gradient(180deg,#0a0a0b 0,transparent 100px,transparent calc(100% - 260px),#0a0a0b 100%)}
</style>
</head>
<body>
<div id="bgfx"></div><div id="bgedge"></div>
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
       must describe the game that exists. UPDATED for the DWCS prologue — the
       game no longer opens on the UFC roster; G.signed gates a fictional
       Contender Series pool in front of it (see dwcsPool()/dwcsOffers()). "Start
       as a 10-0 prospect entering the UFC" was true when POINTS_START 42 bought
       your very first fight; it's still true of what you arrive AS once you sign,
       just no longer of the FIRST screen you see. If DWCS, POINTS_START, or the
       10-0 framing move, this line moves. -->
  <p class="sub">Build a fighter. Win your way onto Dana White's Contender Series,<br>
    then enter the UFC as a 10-0 prospect. Pick your fights, climb the rankings, win the belt.<br>
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
// is not level zero: a UFC fighter with literally no takedown defense isn't a
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

// FIGHT IQ IS NOT A COMBAT ATTRIBUTE, AND THAT SEPARATION IS THE WHOLE DESIGN.
//
// It is not a COMBAT stat: styleDelta, myRating and archetype all iterate ATTRS (the
// nine above), so a point in Fight IQ moves no base rating and no archetype — it can
// never be "spend points, win more" through raw fighting ability, which is why it is
// deliberately kept OUT of ATTRS. What it moves instead is your GAME PLAN.
//
// Before a fight you draw up a plan against the opponent's REAL stats, and every plan
// carries a hidden edge (see planFor). Fight IQ does two things to that read: it lets
// you SEE the edges (a high-IQ fighter's scouting spells out the full read and the
// corner names the phase that wins the fight; a low-IQ fighter gets the gist and a
// corner that just says "go get him"), AND it sharpens how hard the read LANDS (the
// plan's execution and ceiling scale with Fight IQ in commitPlan). So it does move win
// probability — but only through the plan you draw up, never through your chin or your
// hands. It is a genuine build lever: points here are points NOT in power or wrestling,
// and measured, maxing it still trails a gifted athlete — the read closes most of the
// gap, the last few points are the gym time you traded. Lives in G.attrs.fightiq so the
// creator/upgrade steppers reuse the exact same row code; nowhere that reads ATTRS sees it.
const FIGHT_IQ = { id:'fightiq', label:'Fight IQ',
  note:'reading the matchup — sharper scouting, a corner that names the play, and a game plan that bites harder' };
// The build-screen list: the nine that fight, plus the one that reads the fight.
// UI ONLY. Every balance path stays on ATTRS.
const UI_ATTRS = ATTRS.concat([FIGHT_IQ]);

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
  // NOT 'Guard player'. High takedown defense means he is NOT on his back — the
  // old name described the opposite of the build it was attached to.
  'grappling+takedef':   'Submission threat',
}).map(([k, v]) => [k.split('+').sort().join('+'), v]));
// HOW MUCH AN ATTRIBUTE DEFINES A FIGHTER. Not how much it's WORTH — WEIGHTS
// already prices that at 1/9 each, deliberately, and this must not second-guess it.
// This is about language: nobody is called anything for having a chin. You are
// named for what you DO to someone (power, pace, technique, wrestling, grappling)
// and only described by what you RESIST with (chin, cardio, defense).
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
const START_AGE = 24, MONTHS_PER_FIGHT = 7;
// AGE CATCHES EVERYONE. ~4 months a fight, so a long run drifts a fighter into his
// thirties — and past ~32 the tank and the chin start to go. A modest, LATE decline:
// win the belt young and you never feel it, but grind a run into your late thirties and
// you lose a real slice of your cardio and durability. It is the clock the "win before
// you fade" arc needs. 0 through 32, +5%/yr, capped at 40%.
function ageDecline(){
  const age = START_AGE + Math.floor(((G.fightNo||0)*MONTHS_PER_FIGHT)/12);
  const ageC = Math.max(0, (age - 32) * 0.04);   // the calendar — now that the number climbs, this actually fires
  // HARD MILES, and the hardest are championship rounds. Decline tracks the TITLE
  // fights on your record — the belt-WINNING fight is free, but every DEFENSE after
  // wears you ~3% — so the CLIMB doesn't feel it while a REIGN fades GENTLY: a champion
  // is dominant early and slips late, but a great one can still string defenses together.
  // 3% (not the old 10%) is deliberate: at 10% a maxed champ's five-defense survival was
  // ~17%, which dragged GOAT down to ~4% once the climb itself was made fair. GOAT should
  // scale WITH the division — ~8% in the hardest, ~15% in the softest — and that comes
  // from a gentler fade plus the division's own belt rate, not from a brutal reign.
  const titleFights = (G.log||[]).filter(f => f.titleFight).length;
  const reignWear = Math.max(0, titleFights - 1) * 0.03;
  const grind = Math.max(0, (G.log||[]).length - 22) * 0.025;
  return Math.min(0.55, ageC + reignWear + grind);
}

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
// A LOSS ON THE RECORD vs A LIFE SPENT. G.losses is the LIFE budget (the cut), and a
// spared first title loss deliberately doesn't spend one. But the record must still
// COUNT it — you did lose the fight, and it shows in the log (playtest: went 16-1, the
// loss showed in the history but the record read 16-0). So the record counts losses
// from the log; G.losses stays the life counter, untouched, so the cut is unchanged.
const lossCount   = () => G.log.reduce((n,f)=>n+(f.won?0:1),0);
const ufcRecord   = () => G.wins + '-' + lossCount();
// DWCS FIGHTS BELONG IN THE PRO RECORD, NOT THE UFC ONE. Same split as
// REGIONAL just above: G.wins/lossCount() are the UFC record and every rule
// in the game reads them (CUT_AT, UNRANKED_WINS), so a DWCS result can never
// be added there without re-arming the exact bug that comment warns about.
// But "pro record" is supposed to be the WHOLE career, and G.dwcsLog is real
// fights the player actually watched happen — leaving them out just because
// they predate the contract reads as a bug, not as the isolation it's
// protecting. Folded in at the point of PRINTING, same as REGIONAL.
const dwcsWinCount  = () => (G.dwcsLog||[]).reduce((n,f)=>n+(f.won?1:0),0);
const dwcsLossCount = () => (G.dwcsLog||[]).reduce((n,f)=>n+(f.won?0:1),0);
const totalRecord = () => (REGIONAL.w + dwcsWinCount() + G.wins) + '-' + (REGIONAL.l + dwcsLossCount() + lossCount());
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
// roster. Heavyweight is full of strikers with ordinary takedown defense, so
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
// elite takedown defense (86%) and a chin that has been cracked (0.41) — a
// striker's dream. Tom Aspinall is the mirror (100% TDD, 3.3 KD/15) and HW
// striker is 23%. Neither is a bug; both are the matchup engine working. The
// question is only how loud one man's stat line should be.
const STYLE_SCALE = 0.75;
const SCALE       = 26;      // rating gap for ~3:1 odds. Lower = the ladder decides
                             // more and your build decides less.

// CARDIO IN A FIVE-ROUND TITLE FIGHT. Multiplies the one-sided cardio-vs-pace
// penalty (styleDelta term 6) when the belt is on the line.
//
// THIS IS THE MOST TARGETED DIAL IN THE FILE AND THAT IS WHY IT IS SMALL. It fires
// on ONE fight per run — and it is the fight the whole run is for, so a point here
// is worth more than a point anywhere else (see STYLE_SCALE: the champion's matchup
// is worth ~2x on the belt). It is also ONE-SIDED: it can only hurt, and the builds
// it hurts are the ones the sim already has at the bottom.
//
//   MEASURED at baseline (40 careers/strategy), cardio by build:
//     striker/smart  13% belt, cardio 1.4      <- already the floor
//     striker/bold   25% belt, cardio 1.1
//     wrestler/smart 53% belt, cardio 9.8      <- already the ceiling
//   The harness's bar is "no strategy at 0% and none running away with it", so a
//   cardio tax at the title fight pushes on both guardrails at once. The naive
//   scale is 25/15 = 1.67 (the fight is 66% longer); 1.35 is deliberately under it
//   because gassing is not linear in minutes and because this term already had a
//   x18 coefficient. See the sim table in THE-CLIMB-TUNING.txt for what 1.35 cost.
const TITLE_CARDIO = 1.35;

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
//   - Your wrestling is worth a lot against a man with bad takedown defense,
//     and close to nothing against Topuria's 95%.
//   - Your submissions punish whoever ends up on the mat — the wrestler who
//     shoots on you, or the man you put down yourself.
//   - Your striking pays against someone who gets hit, and stalls against a
//     high-guard defensive fighter.
//   - Your takedown defense is worth everything against a wrestler and nothing
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
// hurt" invites a puncher, but 86% takedown defense is only a problem if you were
// going to shoot, and a technician might just outbox him. That argument is the
// game. \`strikers win here\` would end it.
//
// GRADED, AND GRADED AGAINST HIS OWN DIVISION. Two reasons. First, these are real
// people: "won't be wrestled" is an overclaim about Carlos Ulberg, and "difficult
// to wrestle" is simply true. Nothing here should say more than the stat sheet
// can carry. Second, 86% takedown defense means something different at heavyweight
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
  // First attempt scored them with zEng (the full-ladder mean) and "durability
  // concerns" fired for 6 of the 11 champions. I explained that here as a
  // sample-size artefact — "chin comes from the RECORD, so a gatekeeper with four
  // fights and no stoppage losses reads 0.9, and 24 of those drag the mean up" —
  // wrote it into a commit as a real bug, and had never measured it.
  //
  // IT IS FALSE. corr(career fights, chin) = 0.059 across all 438 fighters: no
  // relationship. Only FOUR fighters have under ten fights and they average 0.542,
  // BELOW the roster, not 0.9. The artefact I described does not exist.
  //
  // What's true is duller and not a bug: champions average 0.061 below their own
  // ladder, because champions have fought elite competition and some of them have
  // genuinely been stopped — Volkanovski 0.38, Ulberg 0.41, Gaethje 0.46 are
  // facts, not noise. Priced out, that is worth 0.9 points of styleDelta to a
  // maxed puncher at the title fight against a median |styleDelta| of 3.5. Real,
  // small, and TRUE TO THE MEN. Nothing to fix.
  //
  // Contenders are still the right comparison class for a scouting report — "is he
  // unusual among the men who could take his belt" is the question a scout asks —
  // but that is a reporting choice, not a repair.
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
  // A SPECIFIC ARCHETYPE, NOT A BUCKET. Playtest: "pavlovich is just 'Puncher', he
  // should be 'power puncher' or something more specific." The label is display-only
  // (it feeds no scorer), so it can afford to be evocative — and the z-scores already
  // carry the nuance the old five buckets threw away. The loudest trait sets the
  // family; a SECOND loud trait makes it specific. Measured on heavyweight: Aspinall
  // is loud everywhere (a complete finisher -> Knockout artist), Pavlovich is loud
  // ONLY in power (-> Power puncher), Hokit pairs power with output (-> Volume
  // puncher), Valter Walker takes you down and taps you (-> Submission wrestler).
  // \`skip\` is the one threat-line the label already implies, so it isn't said twice.
  let label, skip;
  if (tz < 0.75) {                                   // nothing loud — name what he RESISTS with
    label = zSd  > 0.75 ? 'Slick technician'
          : zChin > 0.9  ? 'Durable veteran'
          : zTdd  > 0.9  ? 'Hard to take down'
          :                'Well-rounded';
    skip  = zSd  > 0.75 ? 'Hard to hit'
          : zChin > 0.9  ? 'Hard to hurt'
          : zTdd  > 0.9  ? 'Difficult to wrestle' : null;
  } else if (tk === 'kd') {                          // power is loudest
    label = zVol  > 0.6  ? 'Pressure knockout artist'
          : (zSub > 0.75 || zTdd > 0.9) ? 'Knockout artist'   // loud beyond power = complete finisher
          : zChin > 0.6  ? 'Come-forward slugger'
          :                'Power puncher';                    // one-shot power, nothing else loud
    skip  = 'Real knockout power';
  } else if (tk === 'td') {                          // takedowns loudest
    label = zSub > 0.6  ? 'Submission wrestler'
          : zKd  > 0.6  ? 'Ground-and-pound wrestler'
          : zTdd > 0.75 ? 'Dominant wrestler'
          :               'Grinding wrestler';
    skip  = 'Looks for the takedown';
  } else if (tk === 'sub') {                         // submissions loudest
    label = zTd > 0.75 ? 'Submission wrestler' : 'Submission ace';
    skip  = 'Submission threat';
  } else {                                           // volume loudest
    label = zSd   > 0.6 ? 'Slick volume striker'
          : zKd   > 0.6 ? 'Volume puncher'
          : zChin > 0.6 ? 'Pressure fighter'
          :               'Volume striker';
    skip  = 'High volume';
  }
  const threat = pick([
    { w: zKd,  s: 'Real knockout power' },
    { w: zSub, s: 'Submission threat' },
    { w: zTd,  s: 'Looks for the takedown' },
    { w: zTdd, s: 'Difficult to wrestle' },
    { w: zVol, s: 'High volume' },
    { w: zSd,  s: 'Hard to hit' },
    { w: zChin,s: 'Hard to hurt' },
  ], skip);
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
      ['Takedown defense', Math.round(g('tdDef', 66)) + '%', Math.max(0, Math.min(1, g('tdDef', 66) / 100))],
      ['Knockout power',   g('kd', 0.5).toFixed(1),          Math.max(0, Math.min(1, g('kd', 0.5) / 3.5))],
      ['Durability',       g('chin', 0.6) < mChin - 0.08 ? 'Been stopped' : g('chin', 0.6) > mChin + 0.1 ? 'Rarely hurt' : 'Average',
                                                            Math.max(0, Math.min(1, g('chin', 0.6)))],
      ['Output',           g('slpm', 4.4).toFixed(1) + '/min', Math.max(0, Math.min(1, g('slpm', 4.4) / 9))],
    ]
  };
}

// \`title\` = five-round fight. Only the cardio term reads it; see term 6.
function styleDelta(a, st, title){
  const n = v => (v||0)/ATTR_MAX;
  let mean = 0; for(const A of ATTRS) mean += n(a[A.id]); mean /= ATTRS.length;
  // signed: +ve = one of your strengths, -ve = one of your holes
  const rel = id => Math.max(-1, Math.min(1, (n(a[id]) - mean) / 0.45));
  let d = 0;

  // 1. YOUR WRESTLING vs THEIR TAKEDOWN DEFENSE. tdDef runs ~40-95: a dominant
  //    wrestler mauls a striker who can't stop it and gets nothing at all
  //    against Aspinall's 95%. Openness is centred too, so an average-TDD man is
  //    a neutral matchup rather than a quiet bonus.
  //    CENTRED ON THE DIVISION. The old constant was \`- 0.5\`, i.e. zero at
  //    tdDef 67.5, which is a number about nothing.
  const tddOpen = (DIVMEAN('tdDef', 67.5) - (st.tdDef||60)) / 55;
  d += rel('wrestling') * tddOpen * 13;

  // 2. THEIR WRESTLING vs YOUR TAKEDOWN DEFENSE. The mirror, and why elite TDD
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

  // 4. YOUR STRIKING vs THEIR STRIKING DEFENSE.
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
  //    AND IT BITES HARDER OVER FIVE ROUNDS. A title fight is 25 minutes, not 15,
  //    and the championship rounds are exactly where a gas tank stops being an
  //    abstraction. This is the one term that gets a title multiplier, because it
  //    is the only one whose real-world mechanism is a function of TIME: your chin,
  //    your power and your wrestling do not change because the fight is longer.
  //
  //    TITLE_CARDIO is deliberately below the naive 25/15 = 1.67. Gassing is not
  //    linear in minutes, and this term is a one-sided penalty on a build the game
  //    already punishes — see the sim note at TITLE_CARDIO's definition.
  const theirPace = Math.max(0, ((st.slpm||4.4) - 4.0) / 2.9);
  d -= Math.max(0, 0.5 - n(a.cardio)) * theirPace * 18 * (title ? TITLE_CARDIO : 1);

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

// P(win a single fight) AGAINST A FIGHTER OBJECT DIRECTLY — the math half of
// winProb(), pulled out so a caller who already HAS the opponent (not just a
// name on the current division's LADDER()) can price a fight against him. This
// is what makes DWCS (dwcsOffers, below — the opponent is never on LADDER(),
// it's a small fictional pool) and any cross-division fight possible without
// duplicating the model. winProb(name) is now the name-lookup convenience
// wrapper; anything that already has the opponent object should call this
// directly instead of routing through oppByName().
function winProbAgainst(o){
  if (!o) return 0.5;
  const gap = myRating(G.attrs) - o.power;
  let p = 1/(1+Math.pow(10, -gap/SCALE));
  // isChamp(o) -> the belt is on the line -> five rounds -> cardio weighs more.
  // The card shows this: the number you see already has the title weighting in it,
  // so a low-cardio build is told the championship rounds are a problem BEFORE it
  // accepts the fight, not after it loses one.
  p += styleDelta(G.attrs, o.style||{}, isChamp(o))/100;
  // Momentum: a real climb rewards form. Small, so it flavors rather than rules.
  p += Math.min(0.04, (G.streak||0)*0.008);
  p -= ageDecline() * 0.9;   // the legs and the timing go first
  return Math.max(0.05, Math.min(0.95, p));
}
// P(win a single fight). Base from the rating gap, then the style triangle, then
// the record. Cardio is a real attribute now — it was impossible while the sim
// refereed, because the sim has no cardio input. Same for chin. The two things
// every fan argues about were the two the model couldn't hear.
function winProb(oppName){
  return winProbAgainst(oppByName(oppName));
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
// bo5(x) = P(win >= 3 of 5). Title fights are five rounds. C(5,3)p^3q^2 +
// C(5,4)p^4q + p^5.
const bo5 = p => { const q = 1-p; return 10*p*p*p*q*q + 5*p*p*p*p*q + p*p*p*p*p; };
// A TITLE FIGHT IS FIVE ROUNDS, AND THAT MUST NOT MOVE THE ODDS BY ITSELF.
//
// The naive change is to roll five rounds instead of three at the same per-round
// number. That is a silent balance change: a longer series converts a per-round
// edge into a bigger fight edge, so every title fight would quietly drift toward
// the favourite and the belt rate — which the tuning file calls THE dial — would
// move without anyone touching it. At a 0.60 per-round rate, bo3 = 0.648 and
// bo5 = 0.683; the card would say one thing and the fight would do another. That
// is the units bug above, wearing a round count.
//
// So the ROUND COUNT is presentation and granularity only: invert bo5 instead of
// bo3 and P(win the fight) is still exactly o.p, which is what the card printed.
// Five rounds changes the STORY (you can now be down 2-0 and still win), not the
// result distribution. The cardio weighting below is where the odds are meant to
// move, deliberately and visibly.
const isChamp = f => !!f && f.rankNum <= 0.5;   // champ + interim = the belt is on the line
// WHO HOLDS THE BELT is dynamic (G.beltHolder). The CHAMPION badge must be read off THAT,
// not the static rank-0 slot: once the belt changes hands, the old champion still sits at
// rank 0 in the ladder and would wrongly read "CHAMP" everywhere he appears (playtest: beat
// the flyweight champ, lost the belt on to someone else, and the ex-champ kept showing as
// CHAMP as a repeating rival). holdsBelt is the truth; rankBadge is the label to show.
const holdsBelt = f => !!f && !!G.beltHolder && f.name === G.beltHolder;
const rankBadge = f => !f ? '' : f.dwcs ? 'DWCS' : holdsBelt(f) ? 'CHAMPION'
  : f.rankNum >= 99 ? 'Unranked' : f.rankNum <= 0.5 ? 'Ex-champ' : '#'+f.rankNum;
const boN = (p, n) => n === 5 ? bo5(p) : bo3(p);
// Inverse of boN: given P(win the fight), what per-round probability produces it?
// Monotone on [0,1], so bisect — closed form is a cubic (or quintic) and not worth it.
function roundP(pFight, n){
  let lo=0, hi=1;
  for(let i=0;i<40;i++){ const mid=(lo+hi)/2; if(boN(mid, n||3) < pFight) lo=mid; else hi=mid; }
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
//
// DWCS FIGHTERS HAVE NO REAL PHOTO TO 404 TO — they're fictional (see
// dwcsPool()), so /photos/thumb/<slug>.png was never going to exist for them.
// TWO THINGS RULED OUT ALREADY: cartoon avatar generators (DiceBear) read as
// silly for what's meant to be a real prospect, and real regional-promotion
// headshots (PFL/LFA/Cage Warriors) are off the table — this site isn't
// covered for that image usage the way it is for the licensed UFC roster
// photos. So: a plain silhouette. It's the actual real-world convention for
// "no official photo yet" (which a genuine Contender Series prospect
// wouldn't have), it needs no external service at all (inline SVG, no CDN,
// no CSP question, no rate limit), and it doesn't compete with a real photo
// for attention the way a generated face would. Same icon for every DWCS
// fighter, on purpose — it's a placeholder, not an identity.
const SILHOUETTE = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'+
  '<rect width="100" height="100" fill="#18181d"/>'+
  '<circle cx="50" cy="38" r="19" fill="#33333d"/>'+
  '<path d="M50 60c-23 0-38 15-38 34v6h76v-6c0-19-15-34-38-34z" fill="#33333d"/>'+
  '</svg>'
);
function avatarHTML(f){
  const slug = nameToSlug(f.name);
  const src = f.dwcs ? SILHOUETTE : '/photos/thumb/'+slug+'.png';
  return '<div class="av"><span>'+(f.initials||'?')+'</span>'+
    '<img src="'+src+'" alt="" loading="lazy" '+
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
//
// THOSE THREE ROWS ARE HEAVYWEIGHT ONLY, AT N=120, AND THEY PREDATE THE FINISH
// BONUS REMOVAL. Read them as a shape, not as numbers. And the sentence above
// them — "THE dial for the belt rate" — is true in a way that misleads, so:
//
// RUNG_PAY IS NOT A UNIFORM SHIFT. IT DOES NOT COMPRESS THE SPREAD; IT WIDENS IT.
// Measured across divisions at N=350 (SE ~2.5):
//                      RUNG_PAY 0.95   0.75
//     HW striker             31%        21%   (-10)
//     WSW grappler           41%        37%   ( -4)
// The gap between them goes 10 -> 16. Turning this down hits the HARD divisions
// 2.5x harder than the soft ones, because in a soft division you reach the title
// regardless of the economy and in a hard one the points ARE the climb. So it
// cannot be used to pull a too-wide band back into range — reach for it to lower
// the belt rate overall, never to tighten the spread. That job belongs to
// DIV_SWING (see gen-climb-data.cjs), which moves every rung of one division.
// Found by trying it: the free-title-shot rule cost +6 belt, the obvious fix was
// RUNG_PAY 0.95 -> 0.85, and the obvious fix would have made the spread worse.
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

// ── TITLE DEFENSES ────────────────────────────────────────────────────────────
// Winning the belt no longer ends the run. As champion you defend it against the top
// contenders (5-round title fights); each win grows your legacy. It reuses the whole
// pipeline — plan, moments, signature — the only differences are who's offered and
// that a win banks a defense instead of moving your rank.
// LEGACY TIER — champion, dominant champion, or the GOAT, by title defenses. It's the
// milestone that turns "retire" into "retire as the GOAT", and it reads off the reign
// you actually built rather than a participation trophy.
function legacyTier(){
  const d = G.defenses || 0;
  // A WON SUPERFIGHT OUTRANKS EVEN THE GOAT TIER — it's not more title
  // defenses, it's a second division beaten as a guest. Checked first so it
  // always shows once earned, same as every other tier here reading off the
  // reign actually built rather than a participation trophy.
  if ((G.superfights||[]).some(s=>s.won)) return { name:'Two-division statement', goat:true, superfight:true };
  if (d >= 5) return { name:'GOAT', goat:true };
  if (d >= 3) return { name:'Dominant champion', goat:false };
  if (G.champ || G.wasChamp) return { name:'Champion', goat:false };
  return null;
}
// ── THE SUPERFIGHT ────────────────────────────────────────────────────────────
// Unlocked at 3 title defenses — reuses legacyTier()'s own "Dominant champion"
// threshold rather than inventing a second number to learn. Opponent is the
// CURRENT CHAMPION one weight class up (D.order runs heaviest-first, so index-1
// is "up"). If DIV is already the heaviest division, there is nothing above it —
// that's correct, not a gap to patch around.
//
// OFFERED ONCE PER THRESHOLD CROSSED (3, then 6, then 9…), not a permanent
// fourth button every single defense — this is meant to read as a rare,
// career-capping moment. It stays on the board across defenses at the SAME
// threshold until the player actually fights it (win or lose), then goes
// quiet until the next multiple of 3.
function superfightOffer(){
  const d = G.defenses || 0;
  if (d < 3) return null;
  const threshold = Math.floor(d/3)*3;
  if ((G.superfights||[]).some(s=>s.threshold===threshold)) return null;
  const idx = D.order.indexOf(DIV);
  if (idx <= 0) return null;   // already the heaviest division
  const theirDiv = D.order[idx-1];
  const champ = D.divisions[theirDiv] && D.divisions[theirDiv].ladder.find(f=>f.rankNum===0);
  if (!champ) return null;
  // winProbAgainst(), NOT winProb(name) — the foreign champion is never on
  // THIS division's LADDER(), so oppByName() would silently return null and
  // winProb()'s 0.5 fallback would price a real fight as a coinflip. This is
  // exactly what winProbAgainst() was pulled out of winProb() for.
  return { f:champ, p:winProbAgainst(champ), reward:1, jump:0, superfight:true, superDiv:theirDiv };
}
function champDefenders(){
  const last = G.last && G.last.o && G.last.o.f.name;
  const top = LADDER().filter(f => f.rankNum >= 1 && f.rankNum < 99 && f.name !== last)
    .sort((a,b)=>a.rankNum-b.rankNum).slice(0,3);
  return top.map(f => {
    // A champion dominates EARLY and fades LATE — that's the wear-and-age decline
    // (see ageDecline), not a flat cap. A fresh champ can blow out his first defenses;
    // by the fifth or sixth, the hard miles of championship rounds have caught up and
    // a hungry contender is a real threat. The 0.88 cap sits just above the regular
    // ceiling (MAX_FAVORITE 0.85) on purpose: a FRESH champion picking the softest of
    // the top three IS more dominant than a contender fight, and that early cushion is
    // what lets a great reign string defenses together and reach GOAT (~15% in the
    // softest divisions). The real cap on difficulty is still the decline; a defense
    // pays +1 as a cushion for reclaiming the belt if you drop it.
    const p = Math.min(0.88, winProb(f.name));
    return { f, p, reward: 1, jump: 0, titleFight:true, defense:true };
  });
}
// ── DWCS — the prologue before you're signed ─────────────────────────────────
// NOT the real gatekeeper pool. LADDER()'s rankNum===99 fighters are built by
// gen-climb-data.cjs's recentUFC() filter to be CURRENT UFC roster fighters —
// deliberately recognisable, deliberately not obscure. A Contender Series
// opponent is the opposite of that: someone who ISN'T signed yet. There's no
// real, currently-unsigned fighter anywhere in this game's data (FIGHTERS/
// FIGHT_HISTORY only cover the UFC roster), so this is a small, DELIBERATELY
// fictional pool — same move as REGIONAL (the {w:10,l:0} display-only prologue
// stat), flavour rather than a claim about anyone real. Calibrated relative to
// the CURRENT division's real gatekeeper floor rather than hand-authored per
// division, so it stays honest without a new data file.
const DWCS_NAMES = [
  'Marcus Boone','Kai Dunbar','Tyrell Voss','Dante Ruiz','Owen Kessler',
  'Bo Tanaka','Ezra Callahan','Milo Petrov','Aiden Roark','Silas Vance',
  'Jonah Okafor','Reid Castellan','Wyatt Sorensen','Elias Marchetti',
  'Cole Abernathy','Rafi Zamora'
];
function dwcsPool(){
  const real = LADDER().filter(f=>f.rankNum===99).map(f=>f.power);
  // A FEW POINTS BELOW EVEN THE SOFTEST REAL GATEKEEPER — a DWCS prospect
  // should always read as a rung under the softest fighter already on the
  // roster, never as tough as one.
  const floor = (real.length ? Math.min(...real) : RATING_MIN + 15) - 6;
  // rankNum:99 (not a sentinel string) so every numeric comparison elsewhere in
  // the file (isChamp, rankBadge, avail()) keeps working on this object without
  // a special case. dwcs:true is the actual marker applyResult()/offers() read.
  return DWCS_NAMES.map((name, i) => ({
    name, record: (5 + (i % 4)) + '-' + (i % 3) + '-0',
    initials: name.split(' ').map(w=>w[0]).join(''), country: null,
    rankNum: 99, dwcs: true,
    power: Math.round((floor - (i % 5)) * 10) / 10,
    // NEAR-AVERAGE STYLE, ON PURPOSE. Real gatekeepers carry real, sometimes
    // specialised stats, and styleDelta can swing a favourite down to a coinflip
    // on an unlucky matchup (measured elsewhere: up to +-16.5 points). A DWCS
    // fighter isn't supposed to be a stylistic trap — keeping these near the
    // styleOf() fallback defaults from gen-climb-data.cjs is what makes "big
    // favorite" mean big favorite regardless of who gets drawn.
    style: { tdDef:60, strDef:52, td:1.4, sub:0.5, kd:0.4, slpm:4.4, sapm:4.0, tdAcc:35, chin:0.5, mat:0.5 },
  }));
}
function dwcsOffers(){
  const pool = dwcsPool();
  if ((G.dwcsLosses||0) > 0){
    // SECOND CHANCE — "shouldn't really ever lose this one." Difficulty alone
    // can't promise that (style variance is bigger than the power gap), so
    // don't band it: pick the single friendliest matchup — power AND style
    // both working in the player's favor — by construction, not luck. Offered
    // as the ONLY card: the point is not making the player pick wrong.
    const best = pool.slice().sort((a,b)=>winProbAgainst(b)-winProbAgainst(a))[0];
    return [{ f:best, p:winProbAgainst(best), reward:0, jump:99, dwcs:true }];
  }
  // FIRST FIGHT — three options off the easier half of the pool, spread across
  // it (not clustered) so there's still a real choice, just a favorable one
  // however it's made.
  const easier = pool.slice().sort((a,b)=>a.power-b.power).slice(0, Math.max(1, Math.ceil(pool.length/2)));
  const n = easier.length;
  const idxs = n >= 3 ? [0, Math.floor((n-1)/2), n-1] : easier.map((_,i)=>i);
  return idxs.map(i => { const f = easier[i]; return { f, p:winProbAgainst(f), reward:0, jump:99, dwcs:true }; });
}
function offers(){
  // BEFORE THE UFC. Everything below this line — the ranked ladder, the
  // gatekeeper, the belt — is untouched and unreachable until G.signed. See
  // applyResult()'s DWCS branch for what a win/loss here does and does not do.
  if (!G.signed) return dwcsOffers();
  if (G.champ) {
    const defs = champDefenders();
    const sf = superfightOffer();
    return sf ? defs.concat(sf) : defs;
  }
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
  let list = _offerCache.map(o => {
    const p = winProb(o.f.name);
    return { f:o.f, p, reward:rewardFor(o.f, p), jump:o.jump };
  });
  // THE TITLE SHOT — the belt is HELD by someone (dynamic). Once you're the #1 contender
  // and coming off a win, you get your crack at whoever holds it: the division's champion,
  // or the man who took it off you. Injected here so it's ALWAYS reachable — the reason
  // the belt could never be won back was that the static rank-0 champ, once beaten, left
  // the pool for good. You must be on a win to earn the shot (a title loss costs a shot,
  // not the run), which keeps the old instant-rematch loop dead.
  if (!G.beltHolder) G.beltHolder = (LADDER().find(f=>f.rankNum===0) || {}).name || null;
  if (G.rank === 1 && G.streak > 0 && G.beltHolder) {
    const holder = LADDER().find(f => f.name === G.beltHolder);
    if (holder) {
      const p = winProb(holder.name);
      list = list.filter(o => o.f.name !== holder.name);   // no duplicate contender card
      list.unshift({ f: holder, p, reward: rewardFor({rankNum:0}, p), jump: 0, titleFight: true });
      list = list.slice(0, 3);
    }
  }
  return list;
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
  // (isChamp is module-level now — fight() needs the same predicate to decide five
  // rounds, and two copies of "what is a title fight" is exactly how they drift.)
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
  // FINAL PROXIMITY GUARD — a ranked board is men near your rank, full stop.
  //
  // Playtest: "i beat the #2 guy, then the 3 matchups were #12, 13 and 14, then a
  // title shot." Reproduced immediately — measured, a #2 was offered #15/#14/#10. It
  // is the top of the ladder outgrowing its own division (the tuning note two blocks
  // up spells this out: past #1 there is no legal near-rank man left, so every
  // fallback reaches DOWN to whoever is unfought — which is the bottom of the
  // rankings). A #2 fighting #14 isn't a climb, it's a step off the ladder.
  //
  // So one honest last pass: any slot holding a man more than PROX rungs below you is
  // swapped for the nearest legal alternative — the closest contender by rank,
  // rematches allowed (a rivalry is a career, and rematching #3 beats fighting #14),
  // never a man who beat you, never a gatekeeper, and the champion only if you're #1.
  // It swaps only when a genuinely closer man exists, so it can never empty the board
  // — it just refuses to send a title contender to fight the back of the division.
  if (G.rank != null) {
    // PROX 6, NOT 3, AND THAT GAP IS DELIBERATE. The main bands already keep the
    // board within ~3 rungs; this guard exists only to catch the EGREGIOUS reach the
    // fallbacks make when the division is exhausted near you — the measured #2-offered-
    // #12/#13/#14. Swapping every 4-rung step-down instead would push near-rank
    // REMATCHES onto the board often enough to break the 20% "rematches never flood"
    // gate (measured: 21.9% at PROX 4). Six catches the nonsense a player notices and
    // leaves the mild step-downs — a #2 seeing a #7 — alone, where a rematch would be
    // a worse fix than the thing it fixes.
    const PROX = 6;
    const conq = new Set(G.log.filter(x => !x.won).map(x => x.opp));
    for (let i = 0; i < picked.length; i++) {
      const f = picked[i];
      if (!f || f.rankNum >= 99 || f.rankNum <= G.rank + PROX) continue;   // absent, unranked, or already close
      const gap = f.rankNum - G.rank;
      const alt = LADDER().filter(g =>
        g.rankNum < 99 && !picked.includes(g) && !conq.has(g.name) && !overFought(g) &&
        (g.rankNum <= 0.5 ? G.rank <= 1 : true) &&              // the belt is a #1-only fight
        Math.abs(g.rankNum - G.rank) < gap                     // strictly closer than the man we're replacing
      // prefer a man you HAVEN'T fought (adds no rematch), then the closest by rank.
      ).sort((a, b) => (seen.has(a.name)?1:0) - (seen.has(b.name)?1:0)
                    || Math.abs(a.rankNum - G.rank) - Math.abs(b.rankNum - G.rank));
      if (alt.length) picked[i] = alt[0];
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
// ── RESOLVING A FIGHT — ONE MODEL, TWO PATHS ──────────────────────────────────
// These four are the whole fight math, pulled out of fight() so the instant path
// (bots, tests) and the played-out path (in-fight moments) resolve identically.
// boutRolls decides the ROUNDS at the per-round rate; boutFinishCtx reads your
// finishing ability and his fragility/danger; deriveFinish decides HOW it ends. Every
// number here is verbatim from the old fight() body — the equivalence is guarded by
// test-climb's belt/finish rates, which read the prototype.
// ── SIGNATURE ABILITIES ───────────────────────────────────────────────────────
// One defining edge per fighter, each a strength paired with a wrinkle so it reshapes
// how you fight without simply making you stronger. Every effect is gated on G.sig, so
// a fighter with no signature — and every bot and test — plays exactly as before. The
// hooks live in the shared resolvers (boutFinishCtx / boutRolls / applyPunch), the
// in-fight moments (advanceBout / boutChoose) and the read (commitPlan / corners).
const SIGS = [
  { id:'killer',  name:'Killer Instinct', icon:'ti-bolt', short:"Finishes hurt men — but overreaches.",
    line:"When you rock a man, you finish him. Few survive once you've got them hurt.",
    flaw:"You overreach — swing for the finish and miss, and you'll pay for it." },
  { id:'chin',    name:'Iron Chin', icon:'ti-shield-half', short:"Can't be put away — rarely finishes.",
    line:"You don't get put away. You can eat a bomb and keep trading when you're hurt.",
    flaw:"A grinder, not a killer — the highlight finishes just aren't in you." },
  { id:'scram',   name:'Scrambler', icon:'ti-arrows-shuffle', short:"Escapes the mat — light on top.",
    line:"Nobody keeps you down. You slip takedowns and escape submissions at will.",
    flaw:"Slick off your back, but you do little damage from the top." },
  { id:'dog',     name:'Dog in Him', icon:'ti-flame', short:"Rises to hard fights — coasts otherwise.",
    line:"You rise to the harder fight — most dangerous when you're supposed to lose.",
    flaw:"You coast against lesser men, and let fights get closer than they should." },
  { id:'general', name:'Ring General', icon:'ti-eye', short:"Out-thinks everyone — rarely finishes.",
    line:"You out-think everyone in there. Your corner always has the read, and a sharp game plan cuts deeper.",
    flaw:"You out-point people — you rarely take anyone out." },
  { id:'subace',  name:'Submission Ace', icon:'ti-target', short:"Taps anyone — but needs the mat.",
    line:"A submission from any position — get the fight to the ground and it's only a matter of time.",
    flaw:"Little power standing — if you can't get him down, you can't finish him." },
  { id:'gnp',     name:'Ground & Pound', icon:'ti-hammer', short:"Mauls from the top — no sub game.",
    line:"You maul from the top. Get him down and the ground strikes come in waves until the ref steps in.",
    flaw:"No submission threat — if you can't get him to the mat, it goes to the cards." },
];
const SIG = id => SIGS.find(s=>s.id===id) || null;
// EACH SIGNATURE NEEDS THE TOOL FOR IT. You can't be a Submission Ace with no
// grappling, or a Killer with no power — the ability sharpens a real strength, it does
// not invent one, and it's the synergy that makes it matter (a 10-grappling Submission
// Ace is Oliveira; a 6 is dangerous; a 1 is nonsense). So each is gated behind a floor
// in its attribute; below it the card is locked with the requirement shown. Mid-run
// the floor is always met — you can only RAISE stats after turning pro — so the
// resolvers never need to re-check it; this is enforced entirely on the build screen.
const SIG_REQ = { killer:['power',6], chin:['chin',6], scram:['takedef',6],
                  dog:['cardio',6], general:['fightiq',6], subace:['grappling',6], gnp:['wrestling',6] };
const sigMet = id => { const r=SIG_REQ[id]; return !r || (G.attrs[r[0]]||ATTR_MIN) >= r[1]; };
const sigReqLabel = id => { const r=SIG_REQ[id]; if(!r) return '';
  const a = UI_ATTRS.find(x=>x.id===r[0]); return 'Needs '+(a?a.label:r[0])+' '+r[1]+'+'; };
// Mid-run, spending upgrade points can raise you across a signature's floor. When it
// does, offer the switch ONCE — G.sigOffered remembers everything already unlocked
// (seeded at "turn pro" with whatever you built into), so a declined offer never nags.
function checkSigUnlock(){
  if (!G.sigOffered) G.sigOffered = new Set();
  for (const s of SIGS){
    if (sigMet(s.id) && !G.sigOffered.has(s.id)){
      G.sigOffered.add(s.id);
      if (s.id !== G.sig) G.sigUnlockPrompt = s.id;   // a genuinely new option — offer it
    }
  }
}
function sigUnlockBox(){
  const s = SIG(G.sigUnlockPrompt), cur = SIG(G.sig);
  const p=document.createElement('div'); p.className='panel sigunlock';
  const rl=document.createElement('div'); rl.className='rl'; rl.style.color='var(--gold)';
  rl.textContent='New signature unlocked'; p.appendChild(rl);
  const nm=document.createElement('div'); nm.className='su-name'; nm.textContent=s.name; p.appendChild(nm);
  const ln=document.createElement('div'); ln.className='su-line'; ln.textContent=s.line; p.appendChild(ln);
  const fl=document.createElement('div'); fl.className='su-flaw'; fl.textContent='Wrinkle: '+s.flaw; p.appendChild(fl);
  const act=document.createElement('div'); act.className='su-act';
  const sw=document.createElement('button'); sw.className='btn pri'; sw.textContent='Switch to '+s.name;
  sw.onclick=()=>{ G.sig=s.id; G.sigUnlockPrompt=null; render(); };
  const keep=document.createElement('button'); keep.className='btn';
  keep.textContent = cur ? 'Keep '+cur.name : 'Stay without one';
  keep.onclick=()=>{ G.sigUnlockPrompt=null; render(); };
  act.appendChild(sw); act.appendChild(keep); p.appendChild(act);
  return p;
}
const DOG_PULL = 0.20;   // Dog in Him: how hard the odds pull toward even
const SUB_CHANCE = 0.10;  // Submission Ace: a threat from any position, both ways
// SUBMISSION ACE, applied once the winner is known so it works on BOTH paths. Two-way,
// so it's win-rate-neutral: catch a sub from a losing position (a win out of nowhere),
// but hunt too hard from on top and you get swept and drop the decision. Either way,
// a live submission threat in every scramble.
function applyPunch(o, R){
  if (G.sig !== 'subace') return R;
  // Mean-preserving: a symmetric flip would quietly tax favorites (more wins to lose
  // than losses to steal), so the "catch from behind" is scaled by your odds — the
  // bigger a favorite you are, the rarer but larger each steal — which keeps the net
  // win rate flat while still throwing a submission scramble into any fight.
  const r = o.p / Math.max(0.05, 1 - o.p);
  if (!R.won && Math.random() < Math.min(0.5, SUB_CHANCE * r)) { // you catch one from behind
    // THE FINISH ROUND IS YOURS. You tapped him in it, so mark the last round won — else
    // the card showed "finished in R3" next to a LOST R3, and a losing scorecard on a
    // win (playtest: "won but I lost the rounds"). Now it reads e.g. 0-0-1, finished R3.
    const rounds = (R.rounds && R.rounds.length ? R.rounds.slice() : [true]);
    rounds[rounds.length - 1] = true;
    return { won:true, fin:true, method:'submission', rounds, roundsWon: rounds.filter(Boolean).length, finRound: rounds.length };
  }
  if ( R.won && Math.random() < SUB_CHANCE){                      // swept hunting the finish
    // A DECISION LOSS NEEDS A LOSING CARD. Passing R.rounds through unchanged left the
    // winning scorecard on a fight this just flipped to a loss — playtest: "lost by
    // decision but all three rounds show a green check." Flip rounds from the back until
    // you're a round short, so the card reads like the close decision you actually
    // dropped (e.g. 3-0 -> 1-2) instead of contradicting the verdict.
    const rounds = R.rounds.slice(); let rw = rounds.filter(Boolean).length;
    const needed = (rounds.length + 1) / 2;
    for (let i = rounds.length - 1; i >= 0 && rw >= needed; i--) if (rounds[i]){ rounds[i] = false; rw--; }
    return { won:false, fin:false, method:'decision', rounds, roundsWon:rw, finRound: 0 };
  }
  return R;
}

function boutRolls(o){
  const nRounds = (isChamp(o.f) || o.titleFight) ? 5 : 3;
  const needed  = (nRounds + 1) / 2;          // 2 of 3, 3 of 5
  let p = o.p;
  if (G.sig === 'dog') p = p + (0.5 - p) * DOG_PULL;   // better dog, worse frontrunner
  const pr = roundP(p, nRounds);
  const rounds = Array.from({length:nRounds}, ()=>Math.random() < pr);
  const roundsWon = rounds.filter(Boolean).length;
  return { nRounds, needed, pr, rounds, roundsWon, won: roundsWon >= needed };
}
function boutFinishCtx(o){
  const S = o.f.style || {};
  const frail = Math.max(0, Math.min(1, (0.85 - (S.chin != null ? S.chin : 0.66)) / 0.5));
  const FIN_W = { power: 1.00, grappling: 1.00, wrestling: 0.45, pace: 0.35 };
  const finRaw = (G.attrs.power||0)*FIN_W.power + (G.attrs.grappling||0)*FIN_W.grappling +
                 (G.attrs.wrestling||0)*FIN_W.wrestling + (G.attrs.pace||0)*FIN_W.pace*frail;
  const FIN_BASE = ATTR_MIN * (FIN_W.power + FIN_W.grappling + FIN_W.wrestling);
  const finBias = 1 - Math.exp(-Math.max(0, finRaw - FIN_BASE) / 6);
  const kd = Math.max(0, S.kd || 0), sb = Math.max(0, S.sub || 0);
  const threat = (kd + sb) / (kd + sb + 1.0);
  const lvl = (id) => ((G.attrs[id] || ATTR_MIN) - ATTR_MIN) / (ATTR_MAX - ATTR_MIN);
  const ageMul = 1 - ageDecline();
  const gassed = 1 - lvl('cardio') * ageMul;   // you gas sooner in the back half of a career
  const winBase = 0.10 + finBias * 0.74;
  const winFin = winBase + (1 - winBase) * gassed * 0.70 * finBias;
  const chinMult = 1.85 - 1.25 * lvl('chin') * ageMul;  // a fading chin gets stopped more
  const loseFin = Math.min(0.92, (0.22 + threat * 0.45) * chinMult);
  const matDef = lvl('grappling') * 0.75 + lvl('takedef') * 0.25;
  let subDef = 1 - 0.80 * matDef, wF = winFin, lF = loseFin, fB = finBias;
  const sg = G.sig;
  if (sg === 'chin')    { lF *= 0.55; wF *= 0.85; }              // eats bombs; finishes less
  else if (sg === 'scram')   { subDef *= 0.45; }                // very hard to submit
  else if (sg === 'general') { wF *= 0.80; fB *= 0.85; }        // out-points, rarely finishes
  else if (sg === 'subace')  {                                 // finishing machine on the mat, nothing if he sprawls
      const tdd = (o.f.style && o.f.style.tdDef != null) ? o.f.style.tdDef : 66;
      const gettable = Math.max(0, Math.min(1, (92 - tdd) / 45));
      wF = wF + (1 - wF) * 0.30 * gettable;
    }
  else if (sg === 'gnp')     {                                 // pounds out the takedown-able; stalls vs a sprawl
      const tdd = (o.f.style && o.f.style.tdDef != null) ? o.f.style.tdDef : 66;
      const gettable = Math.max(0, Math.min(1, (92 - tdd) / 45));
      wF = wF + (1 - wF) * 0.30 * gettable;
    }
  else if (sg === 'killer')  { wF = wF + (1 - wF) * 0.20; }     // finishes a touch more overall
  return { frail, finBias: fB, kd, sb, threat, winFin: wF, loseFin: lF, subDef, gassed };
}
function finishMethod(o, ctx, won){
  let koW  = won ? ((G.attrs.power||1) + (G.attrs.wrestling||0)*0.50 + (G.attrs.pace||0)*0.60*ctx.frail) : ctx.kd;
  let subW = won ? ((G.attrs.grappling||1)*0.9 + (G.attrs.wrestling||0)*0.35) : ctx.sb * ctx.subDef;
  // Submission Ace hunts the TAP: his wrestling becomes submissions, not ground-and-pound,
  // and the sub weight is boosted — so he no longer taps 100% of the time (playtest: 9 subs,
  // 0 KOs on a build with real power). Real STANDING power still cracks a chin, so a
  // well-rounded ace keeps the occasional KO (~1 in 4) while a pure grappler almost never
  // does. Method-only — never touches the win rate.
  if (won && G.sig === 'subace') {
    koW  = (G.attrs.power||1) + (G.attrs.pace||0)*0.40*ctx.frail;
    subW = ((G.attrs.grappling||1)*0.9 + (G.attrs.wrestling||0)*0.60) * 1.8;
  }
  // Ground & Pound is the exact MIRROR of the ace. The ace keeps his natural standing
  // power (the odd KO) and boosts the tap; G&P keeps his natural grappling (the odd sub)
  // and boosts the ground STRIKES. So wrestling drives a boosted TKO from the top, while a
  // high-grappling wrestler still threatens the occasional submission — a pure wrestler
  // almost never does. Method-only, win-rate untouched.
  if (won && G.sig === 'gnp') {
    koW  = ((G.attrs.power||1)*0.5 + (G.attrs.wrestling||0)*1.2 + (G.attrs.pace||0)*0.4*ctx.frail) * 1.6;
    subW = (G.attrs.grappling||1) * 0.9;
  }
  const bySub = (koW + subW > 0) && Math.random() < subW/(koW+subW);
  return bySub ? 'submission' : 'KO/TKO';
}
function deriveFinish(o, ctx, rounds, roundsWon, won){
  const finW = won ? ctx.winFin : ctx.loseFin;
  const fin = Math.random() < finW && (won || ctx.kd + ctx.sb > 0);
  const method = !fin ? 'decision' : finishMethod(o, ctx, won);
  let finRound = 0, rr = rounds, rw = roundsWon;
  if (fin) { finRound = rounds.indexOf(won) + 1; rr = rounds.slice(0, finRound); rw = rr.filter(Boolean).length; }
  return { fin, method, finRound, rounds: rr, roundsWon: rw };
}

function fight(o){
  // o.p is P(WIN THE FIGHT). Rounds must be rolled at the per-round rate that
  // reproduces it — rolling three rounds AT o.p resolves the fight at bo3(o.p),
  // i.e. materially easier than the card promised.
  //
  // FIVE ROUNDS FOR THE BELT. roundP inverts bo5 for a title fight, so P(win) is
  // still exactly o.p — the extra two rounds add story, not odds. See boN.
  const b = boutRolls(o);
  let rounds = b.rounds, roundsWon = b.roundsWon;
  const won = b.won;
  const ctx = boutFinishCtx(o);
  const f = deriveFinish(o, ctx, rounds, roundsWon, won);
  rounds = f.rounds; roundsWon = f.roundsWon;
  const fin = f.fin, method = f.method, finRound = f.finRound;
  applyResult(o, applyPunch(o, { won, fin, method, rounds, roundsWon, finRound }));
}

// THE BOOKKEEPING — everything after the result is known: the log, the win/loss
// branches, rank, hype, the clock. Extracted so the instant path (fight) and the
// played-out path (an in-fight-moments bout) share ONE copy of the rank/hype/cut
// rules rather than two that could drift apart.
function applyResult(o, R){
  const { won, fin, method, rounds, roundsWon, finRound } = R;
  // THE DWCS PROLOGUE — a hard early return, on purpose, in the same style as
  // the belt-loss bookkeeping below this function is famous for getting wrong.
  // MUST NOT touch G.wins, G.losses, G.streak, G.rank, G.beat, or CUT_AT in any
  // way — "the career starts as is afterwards" means a signed fighter's very
  // first real UFC fight has to see G.wins===0, G.losses===0 exactly like it
  // always has. G.log itself is untouched for the same reason (it's the UFC
  // record). But the RESULT SCREEN still needs the round-by-round detail to
  // show how the fight went, so G.dwcsLog carries the same shape G.log does —
  // display-only, same move as REGIONAL and totalRecord() below.
  if (o.dwcs){
    G.dwcsLog = G.dwcsLog || [];
    G.dwcsLog.push({ opp:o.f.name, won, fin, method, rounds, roundsWon, finRound });
    if (won){ G.signed = true; G.dwcsLosses = 0; }
    else { G.dwcsLosses = (G.dwcsLosses||0) + 1; }   // never read against CUT_AT — see above
    // MIRROR ONLY THE UI-FACING PART OF THE SHARED TAIL BELOW (G.last, G.bout,
    // render) — NOT G.fightNo (the age clock), NOT G.peak. Those are real-career
    // bookkeeping and a DWCS fight isn't on the clock yet.
    G.last = { o, won, fin, method };
    G.bout = null;
    render();
    return;
  }
  // THE SUPERFIGHT — a legacy fight in ANOTHER division. Real enough to belong
  // in the record (G.log, G.wins/G.losses, G.streak, the age clock) — unlike
  // DWCS above, this happens mid-career and the spec decision was explicit:
  // a loss "should still count as an ordinary loss... it's a real UFC-
  // sanctioned fight." But G.champ is true the entire time (you're still
  // champion of YOUR OWN division throughout), which is exactly why this
  // cannot fall through into the normal branches below: \`if (G.champ)\` there
  // means "bank a defense," and a superfight win is not one. Written as its
  // own explicit copy of the record-keeping half of this function, on
  // purpose NOT sharing code with the belt logic, so a future edit to
  // defenses/rank/titleLosses below cannot silently start reaching this
  // fight too.
  if (o.superfight){
    G.log.push({ opp:o.f.name, won, fin, method, p:o.p, rank:o.f.rankNum, rounds, roundsWon, finRound,
                 superfight:true, titleFight:false });
    G.superfights = G.superfights || [];
    const threshold = Math.floor((G.defenses||0)/3)*3;
    G.superfights.push({ div:o.superDiv, opp:o.f.name, won, threshold });
    if (won){ G.wins++; G.streak++; G.beat.add(o.f.name); G.hype = Math.min(3, (G.hype||0)+1); }
    else { G.losses++; G.streak = 0; G.hype = 0; }
    // EXPLICITLY NOT TOUCHED, WIN OR LOSE: G.rank, G.champ, G.defenses,
    // G.beltHolder, G.titleLosses, G.outOfShots, G.spared. This fight cannot
    // move you in your own division and cannot cost a title shot — only a
    // CUT_AT life on a loss, same as any contender fight.
    G.fightNo = (G.fightNo||0) + 1;
    G.last = { o, won, fin, method };
    G.bout = null;
    render();
    return;
  }
  // titleFight is stored EXPLICITLY, not inferred from rounds.length===5. A title
  // fight that ends in a FINISH has a short round array, so the old inference counted
  // only title DECISIONS toward championship wear — and a strong build finishes its
  // challengers, so a dominant champion accrued almost no wear and his defenses never
  // got harder (measured: offered p pinned at 0.80 through seven straight defenses).
  // The belt is on the line when you're defending (o.titleFight) or challenging the
  // champion (rankNum 0); both are the five-round fights the reign wears you down with.
  G.log.push({ opp:o.f.name, won, fin, method, p:o.p, rank:o.f.rankNum, rounds, roundsWon, finRound,
               titleFight: !!o.titleFight || o.f.rankNum === 0 });
  if (won){
    G.wins++; G.streak++; G.beat.add(o.f.name);
    // HYPE. A normal win banks a pip (cap 3). A CALLOUT win spends the meter you
    // cashed to make the fight — the reward for a statement fight is the rank leap
    // itself (sub-rank advancement below vaults you to his rank), not more hype.
    G.hype = o.callout ? 0 : Math.min(3, (G.hype||0) + 1);
    if (o.rival){ (G.avenged || (G.avenged = new Set())).add(o.f.name); G.hype = Math.min(3, (G.hype||0) + 1); }
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
    if (G.champ) {
      // A SUCCESSFUL TITLE DEFENSE — you keep the belt, the legacy grows, rank unmoved.
      G.defenses = (G.defenses || 0) + 1;
    } else {
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
      if (o.titleFight) {   // you beat the man holding the belt — it's yours
        G.champ = true; G.beltFight = G.beltFight || G.log.length;
        // FIRST TITLE RESETS THE STRIKE COUNT. A title shot you lost BEFORE you ever
        // won the belt shouldn't combine with a later belt loss to end the run — the
        // "two belt losses and the era's over" clock starts when your reign starts.
        // (Reclaims don't reset — wasChamp stays true — so the loop can't be farmed.)
        if (!G.wasChamp) G.titleLosses = 0;
        G.beltHolder = null;   // you hold it now
      }
    }
  } else {
    // NOBODY GETS CUT FOR LOSING TO THE CHAMPION.
    //
    // Measured before building this: 21.3% of all runs ended CUT with the last
    // fight being a title loss. One run in five finished by telling you the UFC
    // released you for the crime of challenging for the belt, which is not a thing
    // that has ever happened to anyone. The most common bad ending in the game was
    // also its least believable.
    //
    // THE RULE: your first title loss is free. Your second ends the run — but as
    // "you've run out of title shots", not "you're cut". Losses to CONTENDERS are
    // untouched; CUT_AT still means what it always meant.
    //
    // WHY THE SECOND ONE ENDS IT REGARDLESS OF BUDGET, which is the load-bearing
    // half: a free title loss plus a champion who returns after one win is exactly
    // the shape of the bug this file already has a section about — "lose a title
    // fight, stay #1, beat one gimme, get another shot: an unlimited supply of
    // title fights at one fight apiece. Measured, a 90% belt rate. A free belt."
    // A loss costing a rung defused that once. Handing the loss back would re-arm
    // it. So the exemption is a ONE-SHOT, and the cap is a hard stop on the run
    // rather than on the budget — a run that cannot end is the failure mode this
    // whole game has been bitten by, and it is worth being blunt about preventing.
    // THE BELT ON THE LINE — a lost CHALLENGE (o.f IS the champion) or a lost DEFENSE
    // (you're the champion, o.titleFight). Both are belt losses, and TWO in a career
    // ends the run — "the era's over", not a cut. This is what caps the reclaim loop:
    // a champion who drops a defense gets ONE shot to win it back; lose the belt a
    // second time and there is no third reign to grind. (Playtest: a maxed champ could
    // drop the belt, climb straight back, and pad defenses on the 5-loss budget — the
    // legacy padded through lives, not through skill.) A lost defense used to check
    // only \`rankNum === 0\`, which is the CONTENDER's rank on a defense, never 0 — so
    // this rule silently never fired for the exact fights it was meant to govern.
    // THE BELT ON THE LINE — a lost CHALLENGE (you weren't champ, o.titleFight) or a
    // lost DEFENSE (you were champ, o.titleFight). Both are belt losses; two ends the
    // run — "the era's over", not a cut. o.titleFight is the one true signal now: a lost
    // defense's opponent is a CONTENDER, so the old \`rankNum === 0\` check never fired for
    // the exact fights it governed.
    const beltOnTheLine = !!o.titleFight;
    if (beltOnTheLine) {
      G.titleLosses = (G.titleLosses || 0) + 1;
      if (G.titleLosses >= 2) G.outOfShots = true;   // the second belt loss ends the run
      else if (!G.champ) G.spared = true;            // a first lost CHALLENGE is still free
    }
    // BELT LOSSES DON'T SPEND A CUT LIFE. G.losses is the CUT budget only — five losses
    // to CONTENDERS and the UFC releases you. A title loss (challenge OR defense) is
    // governed by the two-strike rule above, not this budget. Counting a defense here let
    // a belt loss quietly be your fifth "life" and END the run while the card was saying
    // "you lost the belt but not the run — win it back" (playtest: exactly that). The
    // DISPLAYED record still counts every loss — lossCount() reads the log, not this.
    if (!beltOnTheLine) G.losses++;
    G.streak = 0;
    // ANY loss breaks your momentum and resets the callout meter — which is the whole
    // downside of calling your shot and missing: you spent three wins of hype, dropped
    // a rung like any loss, and you're building it back from zero.
    G.hype = 0;
    // LOSING THE BELT. A champion who drops a title defense loses it and falls to #1
    // (the drop-a-rung below takes 0 -> 1), with the belt back on the line via the
    // ladder champion. An ordinary loss — a life, a rung to reclaim — the reign is
    // over but the run isn't.
    if (G.champ) { G.champ = false; G.wasChamp = true; G.beltHolder = o.f.name; }   // the belt goes to the man who beat you
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
  G.bout = null;
  render();
}

// ── IN-FIGHT MOMENTS ──────────────────────────────────────────────────────────
// A fight is no longer resolved in one hidden instant. The ROUNDS and the finish are
// still decided by the same model (boutRolls/deriveFinish), so the odds you were
// shown are the odds you get and the instant path is untouched — but the fight is now
// PLAYED OUT, and at up to two live junctures (you've hurt him, or you're in trouble)
// it pauses for a two-sided gamble. The SAFE choice changes nothing: the pre-rolled
// result stands exactly as fight() would have resolved it, which is what keeps the
// belt tuning intact. Only aggression can move the night — a swarm that lands ends it
// early, a swarm that misses can cost you a round, firing back while hurt can steal a
// round or get you stopped. Read it against your build and the scoreboard.
function startBout(o){
  G.bout = { o, base: boutRolls(o), ctx: boutFinishCtx(o), i:0, rounds:[],
             hisDmg:0, myDmg:0, moment:null, usedHurt:false, usedTrouble:false, override:null, moments:[] };
  advanceBout();
}
function advanceBout(){
  const B = G.bout;
  while (B.i < B.base.rounds.length && !B.moment && !B.override){
    // ── PRE-ROUND MOMENTS — fire before the final round is FOUGHT, keyed on
    // fight STATE (the scoreline, your gas tank) rather than a damage
    // threshold from a round that already happened. At most one per fight;
    // closeround (score) takes priority over fade (cardio) if a 5-round fight
    // is somehow both tied and gassed heading into the last round.
    if (B.i === B.base.nRounds - 1) {
      const wonSoFar = B.rounds.filter(Boolean).length, lostSoFar = B.rounds.length - wonSoFar;
      if (!B.usedClose && wonSoFar === lostSoFar) {
        // Both flags, not just usedClose — a fade/push resolution can flip an
        // already-fought round (flipLoss) WITHOUT advancing B.i, which can
        // retroactively create a tie that would otherwise re-trigger this
        // exact check on re-entry and stack a second pre-round moment onto
        // the same boundary (caught via testing, not by inspection).
        B.usedClose = true; B.usedFade = true; B.moment = { type:'closeround' }; break;
      } else if (!B.usedFade && B.base.nRounds === 5) {
        B.usedFade = true;   // one look at this, regardless of the roll
        if (Math.random() < clampv(0.25 + B.ctx.gassed*0.50, 0.15, 0.75)) {
          B.usedClose = true;   // same reasoning, symmetric direction
          B.moment = { type:'fade' }; break;
        }
      }
    }
    const r = B.base.rounds[B.i]; B.rounds.push(r); B.i++;
    if (r) B.hisDmg = Math.min(1, B.hisDmg + 0.30 + B.ctx.finBias*0.16 + B.ctx.frail*0.10);
    else   B.myDmg  = Math.min(1, B.myDmg  + 0.26 + B.ctx.threat*0.28);
    // A finish OPPORTUNITY — you've hurt him, and you have the tools to end it.
    if (r && !B.usedHurt && B.hisDmg > 0.55 &&
        Math.random() < clampv((B.ctx.finBias*0.48 + B.ctx.frail*0.20) * (G.sig==='killer'?1.4:1), 0, 0.58)){
      B.usedHurt = true; B.moment = { type:'hurt' };
      G.fxPanel = 'flash-good'; G.fxAvatar = 'punch'; G.fxSplat = 'HURT!';   // you just hurt him
      break;
    }
    // TROUBLE — he's hurt you, and he's dangerous.
    if (!r && !B.usedTrouble && B.myDmg > 0.55 &&
        Math.random() < clampv(B.ctx.threat*0.60, 0, 0.45)){
      B.usedTrouble = true; B.moment = { type:'trouble' };
      G.fxPanel = 'shake'; G.fxAvatar = 'rattled'; G.fxSplat = 'ROCKED!';   // you just got rocked
      break;
    }
  }
  if (B.moment){ render(); return; }
  boutFinalize();
}
function boutFinalize(){
  const B = G.bout, o = B.o;
  let R;
  if (B.override){ R = B.override; }
  else {
    // The player WATCHED these rounds happen, so a finish can't be retro-fitted to an
    // earlier round the way the instant path truncates it (playtest: banked after
    // winning R1-R2, then "KO in R1"). Keep the rounds as shown and land any finish in
    // the FINAL round — and only when that round went the winner's way, so "KO in R3"
    // always sits on a round R3 the winner actually took. Otherwise it's the decision
    // the scorecard already says it is. Win rate is unchanged (finish is method-only).
    const rounds = B.rounds.slice();
    const rw = rounds.filter(Boolean).length;
    const won = rw >= B.base.needed;
    const df = deriveFinish(o, B.ctx, rounds, rw, won);
    if (df.fin && rounds.length && rounds[rounds.length - 1] === won)
      R = { won, fin:true, method:df.method, finRound:rounds.length, rounds, roundsWon:rw };
    else
      R = { won, fin:false, method:'decision', finRound:0, rounds, roundsWon:rw };
  }
  o.moments = B.moments || [];        // carry the in-fight calls onto the result screen
  applyResult(o, applyPunch(o, R));   // clears G.bout and renders the result
}
// AGGRESSION IS VARIANCE, NOT FREE WIN%. The gamble is keyed on whether you were
// GOING to win anyway (the pre-rolled outcome from here): if you're ahead, landing it
// is a highlight finish that changes the METHOD, not the winner, and missing risks
// getting caught and dropping the fight; if you're behind, it's a chance to STEAL a
// win, balanced against getting stopped. Tuned (see the sim) so ALWAYS-swarming is
// win-rate-neutral — the edge comes from reading WHEN to, not from mashing it.
const AGG_BACKFIRE = 0.60;   // ahead + miss -> you get caught and lose
const AGG_STEAL    = 0.50;   // behind + land -> you steal the win
// COMPOSED/EVADE is the same shape as swarm/fire but flattened — lower ceiling,
// lower floor. Half the backfire, well below AGG_STEAL, so leaning on it every
// time isn't a stealth-better swarm; it's a different risk band, not a free one.
const CTL_BACKFIRE = 0.30;
const CTL_STEAL    = 0.35;
// GROUND/CLINCH is a different AXIS entirely — keyed off wrestling/grappling
// instead of finish context, so it rewards a build the standing options never
// touch. Not directly comparable to AGG_* / CTL_* pLand; balance it against
// them via the sim (THE-CLIMB-TUNING.txt), not by eyeballing the numbers.
const lvlOf = (id) => clampv(((G.attrs[id]||ATTR_MIN) - ATTR_MIN) / (ATTR_MAX - ATTR_MIN), 0, 1);
function resolveAggressive(pLand, backfire, stopAgainst, verb, winning, steal, finish, flipLoss, rec){
  if (winning) {
    if (Math.random() < pLand) { finish(true); rec(verb+' — and got the finish. It paid off.', true); }
    else if (Math.random() < backfire) {
      const flipped = flipLoss();
      if (flipped) {
        if (Math.random() < stopAgainst) { finish(false); rec(verb+', got caught, and lost it.', false); }
        else rec(verb+', dropped the round — but survived.', false);
      } else rec(verb+' and missed — no harm done.', null);
    } else rec(verb+'; he covered up. No harm.', null);
  } else {
    if (Math.random() < pLand * steal) { finish(true); rec(verb+' — and stole the fight. It paid off.', true); }
    else if (Math.random() < stopAgainst) { finish(false); rec(verb+', got caught, and got stopped.', false); }
    else rec(verb+' — and nothing came of it. No change.', null);
  }
}
function boutChoose(kind){
  const B = G.bout, o = B.o, m = B.moment; if(!m) return; B.moment = null;
  const noopWon = () => B.rounds.concat(B.base.rounds.slice(B.i)).filter(Boolean).length >= B.base.needed;
  const finish = (won) => { B.override = { won, fin:true, finRound:B.i,
      method: finishMethod(o, B.ctx, won), rounds: B.rounds.slice(), roundsWon: B.rounds.filter(Boolean).length }; };
  const flipLoss = () => { const j = B.base.rounds.indexOf(true, B.i);
      if (j >= 0) { B.base.rounds[j] = false; return true; }
      for (let k=B.rounds.length-1;k>=0;k--) if (B.rounds[k]) { B.rounds[k]=false; return true; } return false; };
  // RECORD THE CALL AND HOW IT LANDED, so the result screen can tell you whether the
  // risk paid off — the same transparency the game plan gets. rec(text, good): good=true
  // it paid off, false it cost you, null a wash.
  const hurt = m.type === 'hurt';
  const rec = (text, good) => {
    (B.moments || (B.moments=[])).push({ text, good });
    // Flash green when the call paid off, red when it backfired — reuses the SAME
    // good/false/null judgment the result screen already reads off B.moments, so
    // there's no second "was this good" call to keep in sync with the first.
    if (good === true) G.fxPanel = 'flash-good';
    else if (good === false) G.fxPanel = 'flash-bad';
  };
  if (kind === 'bank' || kind === 'weather' || kind === 'manage' || kind === 'coast') {
    // Describe the CHOICE, not the outcome. "Banked the round" / "weathered it" claimed a
    // result the fight might not deliver — the natural finish still lands whether you
    // gambled or not (playtest: played safe, still won/lost by submission, note said you
    // banked/weathered it). Passing on the SWARM is true regardless of how the fight ends.
    const passText = {
      hurt: 'Had him hurt — you passed on the swarm and let it play out.',
      trouble: 'In trouble — you covered up rather than fire back.',
      fade: 'Championship rounds — you managed the pace and protected what you had.',
      closeround: 'Dead even entering the last round — you trusted the scorecards.',
    }[m.type];
    rec(passText, null);
    advanceBout(); return;
  }
  const winning = noopWon(), sg = G.sig;
  const sigMult = (killerMult, softMult) => sg === 'killer' ? killerMult : (sg === 'scram' || sg === 'chin') ? softMult : 1;
  const stopAgainst = sg === 'chin' ? 0.22 : (sg === 'scram' ? 0.35 : 0.5);       // iron chin / scrambler survive

  if (kind === 'swarm' || kind === 'fire') {
    let pLand = clampv(0.45 + B.ctx.finBias*0.30 + B.ctx.frail*0.20, 0.2, 0.9);
    if (sg === 'killer') pLand = Math.min(0.95, pLand + 0.15);  // finisher lands it
    const backfire = AGG_BACKFIRE * sigMult(1.3, 0.5);
    // The VERB follows the moment (you had him hurt -> swarmed; you were in trouble -> fired
    // back), NOT the scoreline. Keying it off \`winning\` was the bug: a hurt-and-swarm that
    // stole a fight you were losing read "you fired back" (playtest), and two different
    // moments could print the identical line.
    const verb = hurt ? 'You swarmed' : 'You fired back';
    resolveAggressive(pLand, backfire, stopAgainst, verb, winning, AGG_STEAL, finish, flipLoss, rec);
  } else if (kind === 'compose' || kind === 'evade') {
    // Measured version of swarm/fire: flatter in both directions, keyed a touch
    // less on finish context (technique/output over raw power).
    let pLand = clampv(0.30 + B.ctx.finBias*0.20 + B.ctx.frail*0.12, 0.15, 0.65);
    if (sg === 'killer') pLand = Math.min(0.80, pLand + 0.08);
    const backfire = CTL_BACKFIRE * sigMult(1.15, 0.6);
    const verb = hurt ? 'You stayed composed, picking your shots' : 'You evaded and countered';
    resolveAggressive(pLand, backfire, stopAgainst*0.7, verb, winning, CTL_STEAL, finish, flipLoss, rec);
  } else if (kind === 'ground' || kind === 'clinch') {
    // Wrestling/grappling-keyed alternate route — control instead of damage, so a
    // grappling build has something to do in a moment the standing options ignore.
    const groundSkill = lvlOf('wrestling')*0.6 + lvlOf('grappling')*0.4;
    const pTD = clampv(0.35 + groundSkill*0.45, 0.2, 0.85);
    if (hurt) {
      const verb = 'You dragged it to the ground';
      const pFinish = clampv(0.35 + lvlOf('grappling')*0.35 + B.ctx.frail*0.15, 0.15, 0.85);
      if (Math.random() < pTD) {
        const stealChance = winning ? pFinish : pFinish*CTL_STEAL;
        if (Math.random() < stealChance) { finish(true); rec(verb+' — locked up the finish from top.', true); }
        else rec(verb+' — controlled the position, banked it clean.', null);
      } else {
        const scramble = 0.18 * sigMult(1.2, 0.6);
        if (Math.random() < scramble && flipLoss()) rec(verb+', got stuffed, and he scrambled back into it.', false);
        else rec(verb+' and got stuffed — no harm done.', null);
      }
    } else {
      // Sim (scripts/sim-climb-moments.cjs) caught this labeled "Low risk" but
      // scoring worse than every other option — the failure branch guaranteed a
      // round loss, no in-between. Retuned: holds more often at baseline, and
      // failing to hold is USUALLY a harmless scramble (like weather), only
      // sometimes a dropped round, rarely a stoppage.
      const verb = 'You clinched up';
      const holdChance = clampv(0.65 + groundSkill*0.30, 0.55, 0.95);
      if (Math.random() < holdChance) {
        rec(verb+' — tied him up and rode out the danger.', null);
      } else {
        const clinchStop = sg === 'chin' ? 0.08 : (sg === 'scram' ? 0.12 : 0.18);
        if (Math.random() < clinchStop) { finish(false); rec(verb+", couldn't hold on, and got stopped.", false); }
        else if (Math.random() < 0.45) { flipLoss(); rec(verb+" but couldn't hold him off — dropped the round.", false); }
        else rec(verb+' — lost the tie-up, but scrambled clear. No harm.', null);
      }
    }
  } else if (kind === 'push') {
    // FADE — championship rounds, resolved BEFORE round 5 is fought (B.i is
    // still the index of that unfought round, so finish()'s finRound:B.i and
    // flipLoss()'s search from B.i both land on it correctly). Cardio, not
    // damage, is the variable: a fresh tank pushes safely, an empty one risks
    // getting caught trying to close the show.
    const gassed = B.ctx.gassed;
    const pFinish = clampv(0.22 + B.ctx.finBias*0.35 - gassed*0.15, 0.08, 0.70);
    const backfire = clampv(0.30 + gassed*0.50, 0.15, 0.85);
    if (Math.random() < pFinish) { finish(true); rec('You pushed the pace in the championship rounds — and closed the show.', true); }
    else if (Math.random() < backfire) {
      if (Math.random() < stopAgainst) { finish(false); rec('You pushed too hard, gassed, and got caught.', false); }
      else if (flipLoss()) rec('You pushed too hard and faded — you lost the final round.', false);
      else rec('You emptied the tank and it cost you nothing in the end.', null);
    } else rec('You pushed the pace, gassed a little, but held on.', null);
  } else if (kind === 'finish') {
    // CLOSEROUND — dead even entering the last round. There's no lead to
    // defend and no deficit to erase, so this always uses resolveAggressive's
    // BEHIND branch (winning=false): pushing here is chasing a finish to
    // remove doubt, never protecting a scoreline that doesn't exist yet.
    let pLand = clampv(0.45 + B.ctx.finBias*0.30 + B.ctx.frail*0.20, 0.2, 0.9);
    if (sg === 'killer') pLand = Math.min(0.95, pLand + 0.15);
    resolveAggressive(pLand, AGG_BACKFIRE, stopAgainst, 'You pushed for the finish', false, AGG_STEAL, finish, flipLoss, rec);
  }
  if (B.override) { boutFinalize(); return; }
  advanceBout();
}

// The moment screen — condition read off accumulated damage, the beat, and two
// choices whose pros/cons are honest. The Fight IQ readout is as sharp as your IQ.
function boutBox(){
  const B = G.bout, o = B.o, m = B.moment, last = o.f.name.split(' ').pop();
  // STRIKER vs GRAPPLER FRAMING — read off the same weights the sim uses to pick the
  // finish, so the beats, the choices AND the condition read all speak your language.
  const _koW = (G.attrs.power||1) + (G.attrs.wrestling||0)*0.5 + (G.attrs.pace||0)*0.6;
  const _subW = (G.attrs.grappling||1)*0.9 + (G.attrs.wrestling||0)*0.35;
  const grappler = _subW > _koW;
  const p = document.createElement('div'); p.className = 'panel bout';
  // IMPACT FX — G.fxPanel/G.fxAvatar are one-shot, set by advanceBout()/boutChoose()
  // right before this render. Consume and clear them here so a later, unrelated
  // re-render of this same panel never replays a stale hit.
  if (G.fxPanel === 'shake') p.classList.add('fx-shake');
  else if (G.fxPanel === 'flash-good') p.classList.add('fx-flash-good');
  else if (G.fxPanel === 'flash-bad') p.classList.add('fx-flash-bad');
  G.fxPanel = null;
  // Opponent's photo+name sit on the RIGHT, matching the opponent's column in
  // the health bars below (bars.js: "You" left, opponent right) — so the
  // avatar reads as the opponent's corner, not a floating generic header.
  const head = document.createElement('div'); head.className = 'opphd';
  const rl = document.createElement('div'); rl.className = 'rl'; rl.style.marginBottom = '0';
  rl.textContent = 'Round ' + B.i + ' of ' + B.base.nRounds;
  const oppId = document.createElement('div'); oppId.className = 'opp-id';
  const oppName = document.createElement('span'); oppName.className = 'opp-nm'; oppName.textContent = o.f.name;
  oppId.appendChild(oppName);
  oppId.insertAdjacentHTML('beforeend', avatarHTML(o.f));
  const avEl = oppId.querySelector('.av');
  // Pixelation (canvas swap) is gone — the img has proven, correct .av CSS
  // (opaque background, object-fit, sizing); the canvas swap didn't inherit any
  // of it, which is why initials sometimes showed through around the edges. The
  // plain real photo stays; the retro read now comes from the HUD chrome alone.
  if (G.fxAvatar === 'punch') avEl.classList.add('fx-punch');
  else if (G.fxAvatar === 'rattled') avEl.classList.add('fx-rattled');
  G.fxAvatar = null;
  head.appendChild(rl); head.appendChild(oppId); p.appendChild(head);
  if (G.fxSplat) {
    const splat = document.createElement('div'); splat.className = 'fx-splat';
    splat.textContent = G.fxSplat;
    splat.style.color = G.fxSplat === 'HURT!' ? 'var(--accent)' : 'var(--accent2)';
    p.appendChild(splat);
    G.fxSplat = null;
  }
  const bars = document.createElement('div'); bars.className = 'bout-bars';
  const cond = (d) => d>0.55 ? 'hurt' : d>0.3 ? 'banged up' : 'fresh';
  const bar = (label, frac, color, tag, danger) => {
    const c = document.createElement('div'); c.className='bout-bar';
    const l = document.createElement('div'); l.className='bout-bl';
    const a=document.createElement('span'); a.textContent=label;
    const s=document.createElement('span'); s.textContent=tag; if(danger) s.style.color='var(--accent2)';
    l.appendChild(a); l.appendChild(s);
    const tr=document.createElement('div'); tr.className='bout-tr'; const i=document.createElement('span');
    i.style.width=Math.round(Math.max(0,Math.min(1,frac))*100)+'%'; i.style.background=color; tr.appendChild(i);
    c.appendChild(l); c.appendChild(tr); return c;
  };
  bars.appendChild(bar('You', 1-B.myDmg, 'var(--accent)', cond(B.myDmg), B.myDmg>0.55));
  bars.appendChild(bar(last, 1-B.hisDmg, 'var(--accent2)', B.hisDmg>0.55?(grappler?'in trouble':'rocked'):cond(B.hisDmg), false));
  p.appendChild(bars);
  const rd = document.createElement('div'); rd.className='note';
  rd.innerHTML = 'Rounds: ' + B.rounds.map((w,idx)=>'<b style="color:'+(w?'var(--accent)':'var(--accent2)')+'">R'+(idx+1)+(w?' ✓':' ✗')+'</b>').join(' &nbsp; ');
  p.appendChild(rd);
  const iq = G.sig==='general' ? ATTR_MAX : (G.attrs.fightiq || ATTR_MIN);
  // fade/closeround are strategic reads, not a damage state — neither clearly
  // "good" nor "bad" the way being hurt or in trouble is, so no colored border.
  const beatClass = m.type==='hurt' ? 'good' : m.type==='trouble' ? 'bad' : '';
  const beat = document.createElement('div'); beat.className = 'bout-beat ' + beatClass;
  const readout = document.createElement('div'); readout.className = 'bout-iq';
  const opts = document.createElement('div'); opts.className = 'plan-opts'; opts.style.marginTop='.6rem';
  const choice = (label, risk, kind, pro, con) => {
    const b=document.createElement('button'); b.className='plan-opt bout-opt'+(risk?' risk':'');
    b.innerHTML='<div class="bout-ct"><span>'+label+'</span><span class="rr">'+(risk?'High risk':'Low risk')+'</span></div>'+
      '<div class="pc-line pro"><span class="mk">+</span><span>'+pro+'</span></div>'+
      '<div class="pc-line con"><span class="mk">−</span><span>'+con+'</span></div>';
    b.onclick=()=>boutChoose(kind); return b;
  };
  if (m.type === 'hurt'){
    beat.textContent = grappler ? "You've got " + last + " in deep trouble on the ground."
                                : 'You rocked ' + last + " — he's hurt.";
    readout.textContent = grappler
      ? (iq>=8 ? "Your corner: the position's locked and he's fading — the tap is right there."
       : iq>=4 ? "You've got him hurt — there's a finish here."
       : "You've got a dominant position.")
      : (iq>=8 ? "Your corner reads it: he's badly hurt and fading — this is the moment."
       : iq>=4 ? 'He looks hurt — there might be a finish here.'
       : 'He looks a little rocked.');
    opts.appendChild(choice(grappler?'Squeeze for the finish':'Swarm for the finish', true, 'swarm',
      grappler ? "Your best shot at the tap, while you've got him locked up."
               : "Your best shot at ending it now, while he's rocked.",
      grappler ? 'Let him scramble free and he\\'s back in it — and you\\'ve spent yourself.'
               : 'If he survives he ties you up and steals the round — and a desperation takedown is live.'));
    opts.appendChild(choice('Drag it to the ground', true, 'ground',
      'A wrestler/grappler\\'s best shot — take him down and finish from top.',
      'Fail the takedown and you\\'ve spent the moment for nothing, or worse.'));
    opts.appendChild(choice('Stay composed', false, 'compose',
      'Pick your shots instead of unloading — a real but smaller shot at the finish.',
      'Less firepower than a full swarm if the shot is actually there.'));
    opts.appendChild(choice(grappler?'Hold the position':'Bank it, stay fresh', false, 'bank',
      grappler ? 'Keep control, bank the round, stay fresh.' : 'Bank a clean round and stay fresh for later.',
      grappler ? 'You let a hurt, dangerous man work back to his feet.' : 'You let a dangerous, hurt man recover.'));
  } else if (m.type === 'trouble') {
    beat.textContent = grappler ? last + " has turned it around — you're in a bad spot."
                                : last + " has you hurt — you're in trouble.";
    readout.textContent = grappler
      ? (iq>=8 ? "Your corner: you're stuck underneath but composed — work your escape."
       : iq>=4 ? "Bad position — stay calm and work out." : "He's on top of you.")
      : (iq>=8 ? "Your corner: you're rocked but clear-headed — he's loading up on you."
       : iq>=4 ? "You're hurt — careful now." : 'You got caught clean.');
    opts.appendChild(choice(grappler?'Scramble out':'Fire back', true, 'fire',
      grappler ? 'Explode out and reverse it — steal the round, or better.'
               : 'A chance to steal the round — or turn the whole fight.',
      grappler ? "Scramble wrong and he takes your back and sinks it in."
               : "Trading while you're hurt, you're far more likely to get finished."));
    opts.appendChild(choice('Evade and counter', true, 'evade',
      'Circle, pick your counters — a smaller shot at stealing it than trading outright.',
      "Still hurt while you're doing it — a clean counter isn't guaranteed."));
    opts.appendChild(choice('Clinch up', false, 'clinch',
      'A wrestler/grappler\\'s way out — tie him up and ride out the danger.',
      "Lose the tie-up and you're still exposed, without the round."));
    opts.appendChild(choice(grappler?'Ride it out':'Weather it, survive', false, 'weather',
      grappler ? 'Defend, tie him up, and get through the round.' : 'Cover up, and get out of the round.',
      'You concede the round to stay in the fight.'));
  } else if (m.type === 'fade') {
    // CHAMPIONSHIP ROUNDS — a proactive read on your OWN gas tank, not a
    // reaction to a hit. Only fires in 5-round fights, once, before round 5.
    const gassed = B.ctx.gassed;
    beat.textContent = 'Championship rounds — your gas tank is running out.';
    readout.textContent = gassed > 0.6
      ? (iq>=8 ? "Your corner: you're empty. One more push, or you coast it home."
       : iq>=4 ? "You're gassed — decide now: push or manage." : "You're exhausted.")
      : (iq>=8 ? "Your corner: you've got enough left for one more push, if you want it."
       : iq>=4 ? "You're tiring, but there's something left." : "You're breathing hard.");
    opts.appendChild(choice('Push the pace', true, 'push',
      'Empty the tank and go for the finish — remove all doubt.',
      "You're gassed — get caught pushing and it can cost you the round, or worse."));
    opts.appendChild(choice('Manage the pace', false, 'manage',
      "Protect what you've banked and coast the final round home.",
      "You leave the door open for a finish you didn't have to give up."));
  } else if (m.type === 'closeround') {
    // DEAD EVEN entering the last round — a score-state moment, not a damage
    // one. Fires at most once, and only when the tally is EXACTLY tied.
    beat.textContent = 'Dead even — it comes down to this round.';
    readout.textContent = iq>=8 ? "Your corner: the cards are a coin flip. Take it out of their hands."
      : iq>=4 ? 'This round decides it — judges or a finish.' : "It's even. Anything can happen.";
    opts.appendChild(choice('Push for the finish', true, 'finish',
      "Take the decision out of the judges' hands.",
      'Reaching for it in an even fight can get you caught.'));
    opts.appendChild(choice('Play it safe', false, 'coast',
      'Trust your work and let the round — and the scorecards — play out.',
      "You're leaving it to three strangers with pens."));
  }
  p.appendChild(beat); p.appendChild(readout); p.appendChild(opts);
  return p;
}


// ── render ───────────────────────────────────────────────────────────────────
// Best-effort, first-party "a run started" ping for /admin/activity — fires on
// EVERY newGame() call, including the automatic one boot() makes the moment
// climb.json loads, so this is "runs started" in the sense the game itself
// defines a run (arrive -> playing), not a separate deliberate click. Works
// identically from both surfaces this file is generated into (the standalone
// /theclimb page and the premium app's in-SPA embed) since both share this
// same newGame(). No-ops silently if there's no session (shouldn't happen —
// climb.json itself is gated — but never let this throw into the game).
function reportClimbRun(){
  try { fetch('/api/activity/climb-run', { method:'POST', keepalive:true }).catch(function(){}); } catch(e){}
}
function newGame(){
  reportClimbRun();
  // G.peak IS NEW, AND IT IS NOT DECORATION. endBox has always printed "peaked at
  // #N" off G.rank, which was honest only while rank could not go DOWN — and it
  // could not, until a loss started costing a rung. The moment that landed, the end
  // screen began reporting the rank you were cut at as the rank you peaked at, and
  // nothing threw, because "peaked at #12" is a perfectly plausible thing to read
  // after a bad run. (sim-climb-runs.cjs has tracked its own peak since the day it
  // was written, with a comment saying the game has no G.peakRank. It was right,
  // and the game needed one the whole time.)
  G = { attrs:Object.assign(Object.fromEntries(ATTRS.map(a=>[a.id,ATTR_MIN])), {fightiq:ATTR_MIN}), pts:POINTS_START,
        // G.signed gates the DWCS prologue in front of the real UFC state below —
        // see applyResult()'s DWCS branch and dwcsOffers(). false start means every
        // new run opens on the Contender Series, exactly as decided.
        signed:false, dwcsLosses:0, dwcsLog:[],
        wins:0, losses:0, streak:0, rank:null, peak:null, log:[], beat:new Set(), champ:false, started:false, last:null, fightNo:0,
        // HYPE — the callout meter. One pip per win (cap 3), spent to call your shot,
        // and reset by any loss, so a statement fight is a thing you earn on a run and
        // gamble away, not a button you can mash. See calloutOffer / fight().
        hype:0, bout:null, sig:null, avenged:new Set(), sigOffered:new Set(), sigUnlockPrompt:null,
        defenses:0, retired:false, wasChamp:false, beltFight:null, bestsSaved:false,
        // titleLosses/spared/outOfShots MUST reset here. A one-shot exemption that
        // survives newGame() is a one-shot exemption you get once per browser tab.
        titleLosses:0, spared:false, outOfShots:false,
        // WHO HOLDS THE BELT — a NAME, tracked dynamically, because the belt changes
        // hands. It starts on the division's champion; when you win it, it's null (you
        // hold it); when you drop a defense, it moves to the man who beat you, and THAT
        // is who you challenge to win it back. Bound to a static rank-0 slot before, the
        // belt vanished the moment it left that slot (playtest: "lost it, never got it
        // back — Aspinall never came up again, Pavlovich didn't have it either").
        beltHolder:null };
  G.beltHolder = (LADDER().find(f=>f.rankNum===0) || {}).name || null;
  render();
}
// What the current sheet has cost, in points — NOT the sum of levels, now that
// costs escalate. The creator and the in-run upgrade panel share this.
const costTo = lvl => { let c=0; for(let v=ATTR_MIN; v<lvl; v++) c+=upCost(v); return c; };
// FIGHT IQ IS FLAT — 1 point per level, always, unlike the combat attributes whose
// last point costs more than their first. Playtest: "fight iq upgrades should be 1
// point each, not get more expensive as they go up." It's cheap and linear on
// purpose: it isn't a stat you specialise INTO, it's how much of the read you want,
// and a rising cost would push players to leave it at 1 the same way it does the
// combat sliders — which is exactly the wrong incentive for the one stat that makes
// the game plan legible.
const upCostOf = (id, v) => id === 'fightiq' ? 1 : upCost(v);
const costToOf = (id, lvl) => id === 'fightiq' ? (lvl - ATTR_MIN) : costTo(lvl);
// Fight IQ spends from the SAME wallet — a point in it is a point not in the cage,
// which is what makes investing in reads a real trade rather than a free upgrade.
const spent = () => ATTRS.reduce((s,a)=>s+costTo(G.attrs[a.id]),0) + costToOf('fightiq', G.attrs.fightiq||ATTR_MIN);

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
  // THE RUN ENDS ON A FIGHT, SO SHOW IT. Playtest: "when winning the belt or getting
  // cut, it doesn't show the results from your choices at the end." The terminal
  // screens jumped straight to the run summary and skipped resultBox — so the
  // belt-winning or run-ending fight, and the game plan you took into it, vanished.
  // Render that last fight above the summary on every ending.
  const endFight = () => { if (G.last) app.appendChild(resultBox()); };
  if (G.retired){ endFight(); const _rt=legacyTier(); app.appendChild(endBox(_rt&&_rt.goat ? 'RETIRED as the GOAT — '+(G.defenses||0)+' title defenses.' : 'RETIRED on top — '+(G.defenses||0)+' title defense'+((G.defenses||0)===1?'':'s')+'.')); return; }
  // OUT OF SHOTS IS NOT A CUT, and it is checked FIRST. If you take your second
  // title fight on your fifth loss, both conditions are true at once and the run
  // has to end with the honest one: you didn't get released, you ran out of cracks
  // at the belt. Ordering is the whole fix — put this second and the 21% of runs
  // this exists for would still print "Cut".
  // A former champion's ending names his LEGACY, not just the loss — the screen must
  // agree with the share card (which reads THE GOAT / CHAMPION), so a 5-defense reign
  // never ends on a bare "no belt".
  const legacyTail = () => { const t=legacyTier(), d=G.defenses||0;
    return d ? ' You leave '+(t&&t.goat?'as the GOAT':'a champion')+' — '+d+' title defense'+(d===1?'':'s')+'.' : ' You leave a former champion.'; };
  if (G.outOfShots){ endFight(); app.appendChild(endBox((G.wasChamp||G.champ) ? 'You lose the belt for the last time. The reign is over.'+legacyTail() : 'No shots left. The title stays out of reach.')); return; }
  if (G.losses>=CUT_AT){ endFight(); app.appendChild(endBox((G.wasChamp||G.champ) ? 'After that loss, you call it a career.'+legacyTail() : 'Cut. '+CUT_AT+' losses.')); return; }
  // DRAWING UP A PLAN IS A FOCUS MODE. You've picked the man; now the screen is
  // the fight you're about to have, and nothing else — the offer list, the upgrade
  // panel and the log would all just be noise you have to scroll past to commit.
  if (G.pending){ app.appendChild(planBox()); return; }
  // A FIGHT IN PROGRESS pauses here at each in-fight moment; nothing else renders.
  if (G.bout && G.bout.moment){ app.appendChild(boutBox()); return; }
  if (G.last) app.appendChild(resultBox());
  if (G.sigUnlockPrompt) app.appendChild(sigUnlockBox());
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
  const _cbl = bestsLine();
  if (_cbl){ const bb=document.createElement('div'); bb.className='note'; bb.style.cssText='color:var(--gold);margin:.3rem 0 .2rem;font-size:.72rem'; bb.textContent='Your bests — '+_cbl; p.appendChild(bb); }
  p.appendChild(hofBox());

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
  for(const A of UI_ATTRS){
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
    const cost = upCostOf(A.id, G.attrs[A.id]);
    const canUp = G.attrs[A.id]<ATTR_MAX && left>=cost;
    const canDn = G.attrs[A.id]>ATTR_MIN;

    const dn=document.createElement('button'); dn.className='btn pmbtn'; dn.textContent='−';
    dn.disabled=!canDn; if(!canDn) dn.style.opacity=.25;
    dn.onclick=()=>{ if(G.attrs[A.id]<=ATTR_MIN) return;
      G.attrs[A.id]--; G.pts = POINTS_START - spent(); render(); };

    const up=document.createElement('button'); up.className='btn pmbtn'; up.textContent='+';
    up.disabled=!canUp; if(!canUp) up.style.opacity=.25; else up.style.borderColor='var(--accent)';
    up.onclick=()=>{ if(G.attrs[A.id]>=ATTR_MAX) return;
      const c=upCostOf(A.id, G.attrs[A.id]); if(POINTS_START-spent()<c) return;
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
  for(const A of UI_ATTRS){
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
    'bad takedown defense, and stalls against elite TDD.';
  p.appendChild(tip);
  // SIGNATURE PICKER — one defining edge, chosen at build time. No Tabler icons in
  // the prototype, so the cards are text; the effects live in the resolvers (see SIGS).
  const sgw=document.createElement('div'); sgw.className='sigwrap';
  const sgl=document.createElement('div'); sgl.className='rl'; sgl.style.marginTop='.9rem';
  sgl.textContent='Signature — one defining edge'; sgw.appendChild(sgl);
  const sgg=document.createElement('div'); sgg.className='siggrid';
  if (G.sig && !sigMet(G.sig)) G.sig = null;   // you dropped the stat below the ability's floor
  const sigCard=(s)=>{
    const locked = s && !sigMet(s.id);
    const c=document.createElement('button');
    c.className='sigcard'+(((s?s.id:null)===(G.sig||null))?' on':'')+(locked?' locked':'');
    const h=document.createElement('div'); h.className='sgh'; h.textContent = s ? s.name : 'No signature';
    const e=document.createElement('div'); e.className='sgs';
    e.textContent = !s ? 'A pure all-rounder.' : locked ? sigReqLabel(s.id) : s.short;
    c.appendChild(h); c.appendChild(e);
    if (locked) { c.disabled = true; }
    else { c.onclick=()=>{ G.sig = s ? s.id : null; render(); }; }
    return c;
  };
  sgg.appendChild(sigCard(null));
  SIGS.forEach(s=>sgg.appendChild(sigCard(s)));
  sgw.appendChild(sgg);
  // The full edge + wrinkle for the SELECTED signature, so the cards stay compact
  // (a 2-up grid instead of a long stack that scrolls forever on a phone).
  const curSig = SIG(G.sig);
  const sgd=document.createElement('div'); sgd.className='sigdetail';
  if (curSig){
    sgd.innerHTML='<span class="sge"></span><span class="sgf"><b>Wrinkle </b><span></span></span>';
    sgd.querySelector('.sge').textContent=curSig.line;
    sgd.querySelector('.sgf span').textContent=curSig.flaw;
  } else {
    sgd.classList.add('muted');
    sgd.textContent='No signature — a pure all-rounder, no edge and no flaw.';
  }
  sgw.appendChild(sgd); p.appendChild(sgw);
  const row=document.createElement('div');
  row.style.cssText='display:flex;gap:.5rem;align-items:center;margin-top:.6rem';
  const b=document.createElement('button'); b.className='btn pri'; b.textContent='Turn pro →';
  b.onclick=()=>{ G.started=true; G.sigOffered=new Set(SIGS.filter(s=>sigMet(s.id)).map(s=>s.id)); render(); };
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
    (G.sig ? '<div><span>Signature</span><b class="sigv">'+(SIG(G.sig)?SIG(G.sig).name:'')+'</b></div>' : '')+
    '<div><span>Rank</span><b>'+(G.rank==null?'Unranked':(G.rank===0?'CHAMP':'#'+G.rank))+'</b></div>'+
    '<div><span>Streak</span><b>'+G.streak+'</b></div>'+
    // HYPE — three pips, gold as they fill, "ready" once you can call your shot. Only
    // shown once you're ranked, since a callout needs a rung to leap from.
    (G.rank!=null
      ? '<div><span>Hype</span><b class="hypv">'+
          [0,1,2].map(i=>'<i class="hp'+((G.hype||0)>i?' on':'')+'"></i>').join('')+
          ((G.hype||0)>=3?'<span class="hype-rdy">ready</span>':'')+'</b></div>'
      : '')+

    '<div><span>Age</span><b>'+(START_AGE + Math.floor(((G.fightNo||0)*MONTHS_PER_FIGHT)/12))+'</b></div>'+
    // WAS (2 - G.losses): hardcoded when two losses ended a run, and left behind
    // when CUT_AT became a constant and moved to 5 — so getting cut displayed
    // "Lives -3". Clamped at 0 as well: a dead fighter has none, not a negative
    // number of them.
    // WHICH CLOCK IS ACTUALLY RUNNING. A contender is cut on his 5th loss (G.losses). But
    // once you're a champion or former champion, the run ends on your SECOND belt loss —
    // and belt losses don't touch the cut budget, so showing "1 loss left" there was a lie
    // the moment a belt loss ended the run (playtest). Show the belt clock for anyone in
    // championship territory, the cut budget for everyone else.
    ((G.champ || G.wasChamp)
      ? '<div><span>Title losses left</span><b>'+Math.max(0, 2-(G.titleLosses||0))+'</b></div>'
      : '<div><span>Losses left</span><b>'+Math.max(0, CUT_AT-G.losses)+'</b></div>');
  // Last, and pushed to the far right by margin-left:auto — a destructive control
  // does not belong next to the thing you came to read, and it should not be the
  // first target your thumb finds. The HUD is the only chrome that persists across
  // every in-run screen, so it's the one place a restart is always where you left it.
  d.appendChild(restartBtn(true));
  p.appendChild(d); return p;
}

function resultBox(){
  const {o,won,fin,method}=G.last;
  // THE DWCS SIGNING IS THE BIGGEST MOMENT IN THE PROLOGUE — the one screen
  // between "trying out" and "a UFC career," and it was reading as a same-size
  // headline as a regular win. Reuses the .sigunlock treatment (gold border,
  // an eyebrow label above the headline) that a new signature move already
  // gets — the closest thing this game already has to "a big deal" chrome —
  // rather than inventing a second visual language for one screen. A DWCS
  // LOSS stays completely ordinary on purpose: only signing is the milestone.
  const dwcsSigned = o.dwcs && won;
  const p=document.createElement('div'); p.className = dwcsSigned ? 'panel sigunlock' : 'panel';
  if (dwcsSigned){
    const rl=document.createElement('div'); rl.className='rl'; rl.style.color='var(--gold)';
    rl.textContent = "YOU'RE IN THE UFC"; p.appendChild(rl);
  }
  const b=document.createElement('div'); b.className='big '+(won?'win':'loss');
  if (dwcsSigned) b.style.cssText='color:var(--gold);font-size:1.5rem';
  // Both directions name the method. "lost to Tom Aspinall" told you nothing about
  // what happened; "lost to Tom Aspinall by KO/TKO" is the same sentence the win
  // side has always got.
  // THE DWCS WIN READS AS A SIGNING, NOT A PLACEMENT. "You're now ranked #15"
  // was explicitly ruled out — the payoff line here is the contract, not the
  // number. The rank still appears everywhere it always has (the HUD, every
  // offer card) starting the very next screen; this is only about what this
  // ONE line says.
  b.textContent = o.dwcs
    ? (won ? 'The UFC signs you.' : 'Close — but Dana gives you another look.')
    : (won ? 'def. ' : 'lost to ') + o.f.name + ' by ' + (method||'decision');
  p.appendChild(b);
  // A DWCS FIGHT NEVER TOUCHES G.log (see applyResult's DWCS branch — the whole
  // point is that a signed fighter's UFC record starts clean), so the round
  // detail below reads from G.dwcsLog instead — same shape, display only.
  const L = o.dwcs ? G.dwcsLog[G.dwcsLog.length-1] : G.log[G.log.length-1];
  const rd=document.createElement('div'); rd.className='note';
  rd.innerHTML = 'Rounds: ' + L.rounds.map((w,i)=>
    '<b style="color:'+(w?'var(--accent)':'var(--accent2)')+'">R'+(i+1)+(w?' ✓':' ✗')+'</b>').join(' &nbsp; ') +
    (L.fin ? ' &nbsp;→&nbsp; <b style="color:'+(won?'var(--accent)':'var(--accent2)')+'">'+
             (won?'finished in R':'stopped in R')+L.finRound+'</b>'
           : ' &nbsp;→&nbsp; ' + L.roundsWon + '-' + (L.rounds.length-L.roundsWon) + ' on the cards');
  p.appendChild(rd);
  // THE FANFARE. Names what just happened in real terms — who you beat, on
  // what show, and what a contract actually means for the run — rather than
  // leaving the gold border to carry the whole moment on its own.
  if (dwcsSigned){
    // NOT "a spot in the rankings" — a debut is unranked. offers() doesn't set
    // G.rank until the (separate, real) gatekeeper fight is won afterward; the
    // fanfare has to stay true to that or it's a promise the very next screen
    // breaks. Just who you beat, and that it's real now.
    const fw=document.createElement('div'); fw.className='su-line'; fw.style.marginTop='.5rem';
    fw.innerHTML = 'You beat <b>'+o.f.name+'</b> on Dana White\\'s Contender Series. Welcome to the UFC.';
    p.appendChild(fw);
  }
  // THE SPARE, ANNOUNCED ONCE, ON THE CARD WHERE IT HAPPENED.
  // Nothing clears G.spared — I wrote a comment here claiming the next fight did,
  // which was false the moment I typed it. It's gated instead: resultBox only ever
  // renders G.last, so this shows on the title loss itself and is gone the next
  // fight because o.f.rankNum stops being 0. titleLosses===1 is belt-and-braces —
  // on a SECOND title loss the run is over and render() returns the end screen
  // before it reaches here, but I'd rather this be true by its own condition than
  // by the ordering of a function two hundred lines away.
  if (G.titleLosses === 1 && !won && o.titleFight) {
    const sp=document.createElement('div'); sp.className='note';
    sp.style.color='var(--gold)'; sp.style.marginTop='.4rem';
    sp.textContent = o.defense
      ? "You lost the belt — but not the run. Win it back, or drop one more title fight and the era's over."
      : "The UFC isn't cutting you for challenging for the belt. That one's free — but the next title loss ends the run.";
    p.appendChild(sp);
  }
  // THE NUMBER, AFTER THE FACT. Deferred, not hidden: before the fight a precise
  // percentage reads as a promise, afterwards it reads as information.
  // DWCS skips both this and the game-plan block below — the user wants that
  // screen to read as just who you beat and that you're in, not a betting-market
  // recap of a Contender Series tryout.
  if (!o.dwcs){
  const od=document.createElement('div'); od.className='note';
  const vn=varianceNote(o.p, won);
  const bd=oddsBand(o.p);
  od.innerHTML = bd.was+' <b>'+amer(o.p)+'</b>.'+
    (vn ? ' <span style="color:'+(won?'var(--accent)':'var(--gold)')+'">'+vn+'</span>' : '');
  p.appendChild(od);
  }
  // WHAT WAS THE READ WORTH? Deferred like the odds line — the edge was hidden
  // going in, so this is where it becomes information rather than a promise, and it
  // is the answer to "how much did my choices actually matter": the fight's base
  // odds, then the number your game plan moved it to. The verdict is on the READ,
  // not the result — a good plan can still lose and a bad one still win, and showing
  // the swing separately from the W/L is the whole point of decoupling the two.
  if (!o.dwcs && o.plan){
    const b=Math.round(o.plan.base*100), pl=Math.round(o.plan.planned*100), d=o.plan.swing;
    const col = d>=3 ? 'var(--accent)' : d<=-3 ? 'var(--accent2)' : 'var(--muted)';
    const verdict = d>=3 ? 'Your read tilted the fight your way.'
                  : d<=-3 ? 'You played right into his strengths.'
                  : 'A wash — the read barely moved it either way.';
    const pn=document.createElement('div'); pn.className='note';
    pn.innerHTML='Game plan — <b>'+o.plan.where+'</b> · <b>'+o.plan.read+'</b>: '+
      'took the fight from <b>'+b+'%</b> to <b style="color:'+col+'">'+pl+'%</b> '+
      '<span style="color:'+col+'">('+(d>0?'+':'')+d+')</span>. '+
      '<span style="color:var(--muted)">'+verdict+'</span>';
    p.appendChild(pn);
  }
  // THE IN-FIGHT CALLS, said out loud — did risking it (or playing it safe) pay off? Same
  // idea as the game-plan line: the moment junctures you steered are worth seeing resolve.
  if (o.moments && o.moments.length){
    for (const mo of o.moments){
      const mc = mo.good===true ? 'var(--accent)' : mo.good===false ? 'var(--accent2)' : 'var(--muted)';
      const mn=document.createElement('div'); mn.className='note';
      mn.innerHTML='In the fight — <span style="color:'+mc+'">'+mo.text+'</span>';
      p.appendChild(mn);
    }
  }
  // THE CALLOUT PAYOFF, said out loud — the whole point of the gamble is the moment
  // it lands or doesn't.
  if (o.callout){
    const cn=document.createElement('div'); cn.className='note';
    cn.style.color = won ? 'var(--gold)' : 'var(--muted)';
    cn.style.marginTop='.3rem';
    cn.textContent = won
      ? 'Statement made. You called out '+o.f.name+' and vaulted the rankings.'
      : "The gamble didn't land — your hype's spent. Build it back and go again.";
    p.appendChild(cn);
  }
  if (o.rival){
    const rn=document.createElement('div'); rn.className='note'; rn.style.marginTop='.3rem';
    rn.style.color = won ? 'var(--gold)' : 'var(--muted)';
    const tookRank = (won && G.rank === o.f.rankNum && o.f.rankNum < 99);
    // A rival is never the current belt-holder (that's a title shot), so beating one
    // settles the grudge and takes his rung — it does NOT hand you the belt.
    rn.textContent = !won ? o.f.name+' still owns you.'
      : 'You settled the score with '+o.f.name+'.'+(tookRank ? ' His #'+o.f.rankNum+' spot is yours,' : ' Grudge retired,')+' and your hype is up.';
    p.appendChild(rn);
  }
  if (o.superfight){
    const fn=document.createElement('div'); fn.className='note'; fn.style.marginTop='.3rem';
    fn.style.color = won ? 'var(--gold)' : 'var(--muted)';
    fn.textContent = won
      ? 'A second belt, beaten as a guest. '+o.f.name+' won\\'t forget it — but yours is untouched.'
      : o.f.name+' defends his own house. Your belt is still yours.';
    p.appendChild(fn);
  }
  const n=document.createElement('div'); n.className='note';
  if (o.dwcs){
    // No upgrade points here (see applyResult's DWCS branch — reward is flat 0,
    // this fight is before G.pts means what it means once there's a real
    // career), and CUT_AT is the UFC budget, not this one, so no "losses left"
    // either. The only thing this line needs to say is what's next.
    n.textContent = won ? 'Welcome to the UFC.' : "Same phone call, one more shot — nothing lost.";
    if (won){ n.style.color='var(--gold)'; n.style.fontWeight='700'; }
  } else {
    const left = CUT_AT - G.losses;
    n.textContent = won
      ? '+'+o.reward+' upgrade points.'
      : (left===1 ? 'One loss left.' : left+' losses left.');
  }
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
  for(const A of UI_ATTRS){
    const row=document.createElement('div'); row.className='attr up';
    const l=document.createElement('label'); l.textContent=A.label;
    // Same level readout as the creator: a bar you can't read a number off is a
    // mood, not information.
    const bar=document.createElement('div'); bar.className='lvlwrap';
    bar.innerHTML='<div class="lvlbar"><div class="lvlfill" style="width:'+
      ((G.attrs[A.id]-ATTR_MIN)/(ATTR_MAX-ATTR_MIN)*100)+'%"></div></div>'+
      '<span class="lvlnum">'+G.attrs[A.id]+'<i>/'+ATTR_MAX+'</i></span>';
    const btn=document.createElement('button'); btn.className='btn';
    const cost = upCostOf(A.id, G.attrs[A.id]);
    const maxed = G.attrs[A.id] >= ATTR_MAX;
    btn.textContent = maxed ? 'MAX' : ('+1  ·  ' + cost + (cost>1?' pts':' pt'));
    btn.style.padding='.15rem .5rem'; btn.style.fontSize='.68rem'; btn.style.whiteSpace='nowrap';
    btn.disabled = G.pts<cost || maxed;
    if(btn.disabled) btn.style.opacity=.3;
    else btn.style.borderColor='var(--accent)';
    btn.onclick=()=>{ if(G.pts<cost||maxed) return; G.attrs[A.id]++; G.pts-=cost; checkSigUnlock(); render(); };
    row.appendChild(l); row.appendChild(bar); row.appendChild(btn);
    p.appendChild(row);
  }
  return p;
}

// ── RIVALRIES ─────────────────────────────────────────────────────────────────
// The matchmaker already remembers who beat you (and deliberately HIDES them, so you
// never get forced into a demoralising rematch). A rivalry flips that into an opt-in:
// the man who handed you a loss resurfaces as a RIVAL card you can choose or duck.
// Beat him and you settle it — sub-rank advancement leapfrogs you to his rank, you
// bank a hype pip, and G.avenged retires the grudge so he stops appearing. Lose again
// and it's an ordinary loss that deepens the record. A third meeting is a trilogy.
// It distorts nothing: your conqueror is almost always a few rungs away already.
// A rivalry has to marinate — a real one is a loss, a rebuild, THEN the rematch, not
// a do-over handed to you the very next night. So a fresh loss stays hidden for a few
// fights (the man who beat you moves on, you get back on track), and only then does he
// resurface as a RIVAL card. An OLDER unavenged loss is already past this window, so
// the loop below naturally offers the grudge that's had time to build.
const RIVAL_COOLDOWN = 3;
function rivalOffer(){
  if (G.rank == null) return null;
  const avenged = G.avenged || new Set();
  const beatenSince = new Set();   // men you've beaten as we scan back — the grudge is settled
  for (let i = G.log.length - 1; i >= 0; i--){
    const Lx = G.log[i];
    // A WIN over him, more recent than any older loss, retires the grudge — INCLUDING the
    // win that took his belt. Before, only a rival-CARD win set G.avenged, so beating the
    // champion for the title left him an "unavenged loss" and he kept coming back as a
    // rival (playtest: beat the champ, then fought him three more times as "the champ").
    if (Lx.won) { beatenSince.add(Lx.opp); continue; }
    if (avenged.has(Lx.opp) || beatenSince.has(Lx.opp)) continue;
    if (Lx.opp === G.beltHolder) continue;            // he holds the belt now — that's a TITLE SHOT, not a grudge
    if (G.log.length - 1 - i < RIVAL_COOLDOWN) continue;  // too soon — let it build first
    const f = LADDER().find(x => x.name === Lx.opp && x.rankNum < 99);
    if (!f) continue;                                 // must still be on the ladder
    const w = G.log.filter(x => x.opp === f.name && x.won).length;
    const l = G.log.filter(x => x.opp === f.name && !x.won).length;
    if (w + l >= 3) continue;                         // TRILOGY IS THE CAP — no fourth meeting (playtest: 4 in a row)
    return { f, p: winProb(f.name), reward: rewardFor(f, winProb(f.name)), jump: f.rankNum,
             rival:true, histW:w, histL:l, trilogy:(w+l) >= 2, lossHow:Lx.method, lossRank:Lx.rank };
  }
  return null;
}

// ── THE CALLOUT ───────────────────────────────────────────────────────────────
// "The risk/reward of playing it safe or calling out a much higher matchup." The
// three cards are the ladder — one rung at a time, safe, small pay. The callout is
// the gamble: once your HYPE meter is full (three wins), you can skip the queue and
// challenge a contender 5-8 rungs above you. Win and sub-rank advancement vaults you
// straight to his rank for a big points haul; lose and it's an ordinary loss (a rung,
// a life) with your hype spent for nothing. It reuses every existing system — winProb
// prices you as the underdog you are, rewardFor already pays by the size of the leap,
// and it runs through the same game-plan screen, which is exactly where a sharp read
// turns a +260 dog into a live one.
//
// CONTENDERS ONLY, NEVER THE BELT. The champion is a #1 fight earned by climbing;
// letting a #5 fluke-KO the champ off a callout would hand out belts the economy
// never priced. The callout tops out at #1 — the statement is "I belong up here",
// and the title stays its own separate night.
function calloutTarget(){
  if (G.rank == null || (G.hype||0) < 3) return null;
  const lo = G.rank - 5;                 // the CLOSEST man you can call out (5 rungs up)
  if (lo < 1) return null;               // near the top — climb the last rungs honestly
  const hi = Math.max(1, G.rank - 8);    // the highest-ranked you can reach
  const conq = new Set(G.log.filter(x => !x.won).map(x => x.opp));
  const band = LADDER().filter(f => f.rankNum >= hi && f.rankNum <= lo &&
                                    f.rankNum >= 1 && f.rankNum < 99 && !conq.has(f.name));
  if (!band.length) return null;
  // Prefer a man you haven't beaten (a real statement), and rotate the target across
  // fights so the board offers a fresh name rather than the same fixture every time.
  const fresh = band.filter(f => !G.beat.has(f.name));
  const pool = (fresh.length ? fresh : band).slice().sort((a,b)=>a.rankNum-b.rankNum);
  return pool[(G.fightNo||0) % pool.length];
}
function calloutOffer(){
  const f = calloutTarget(); if (!f) return null;
  const p = winProb(f.name);
  return { f, p, reward: rewardFor(f, p), jump: f.rankNum, callout:true };
}

function offerBox(){
  const p=document.createElement('div'); p.className='panel';
  p.innerHTML='<div class="rl">'+(!G.signed?"Dana White's Contender Series":G.champ?'Defend your title':'Pick your next fight')+'</div>';
  if (!G.signed){
    const dn=document.createElement('div'); dn.className='champ-note';
    dn.innerHTML = (G.dwcsLosses>0)
      ? "<b>One more shot.</b> Dana liked what he saw — win this and you're in."
      : "<b>Win, and the UFC signs you.</b> Lose, and you're back on the show for another look.";
    p.appendChild(dn);
  }
  // WORN DOWN — when the decline is real, say so, so the retire-or-push decision has
  // the feel it should: you can sense yourself slipping.
  if (ageDecline() > 0.12){
    const wn=document.createElement('div'); wn.className='champ-note';
    wn.style.cssText='border-color:var(--accent2);color:var(--accent2)';
    wn.innerHTML='<b>The miles are showing.</b> The tank and the chin aren\\'t what they were — every fight from here is tougher than the last.';
    p.appendChild(wn);
  }
  if (G.champ){
    const ch=document.createElement('div'); ch.className='champ-note';
    const _t=legacyTier();
    ch.innerHTML='<b>You hold the belt.</b> '+(G.defenses?('Defended '+G.defenses+' time'+(G.defenses===1?'':'s')+(_t&&_t.name!=='Champion'?' \\u2014 <b style="color:var(--gold)">'+_t.name+(_t.goat?' status':'')+'</b>':'')+'. '):'')+'Take a challenger, or retire on top.';
    p.appendChild(ch);
  }
  const g=document.createElement('div'); g.className='opps';
  const list=offers();
  for(const o of list){
    const b=document.createElement('button'); b.className='opp'+(o.p<0.4?' risky':'');
    // A title shot (challenging the belt holder) reads CHAMPION even if the man wearing
    // the belt is ranked #2 — he holds it, that's what matters.
    const titleShot = o.titleFight && !o.defense;
    // A SUPERFIGHT OPPONENT IS NOT AN EX-CHAMP — rankBadge() reads f.rankNum<=0.5
    // as "Ex-champ" because on THIS division's ladder that's what rank 0 means
    // once you hold the belt yourself. He's a foreign fighter with no rank on
    // this ladder at all; he's the reigning champion of his own division, which
    // is the entire point of the fight. Override before rankBadge ever sees him.
    const rk = titleShot ? 'CHAMPION' : o.superfight ? 'C · '+(D.divisions[o.superDiv]&&D.divisions[o.superDiv].label||o.superDiv) : rankBadge(o.f);
    b.innerHTML='<div class="opphd">'+avatarHTML(o.f)+'<div class="oppwho">'+
        '<div class="rk">'+rk+'</div><div class="nm"></div><div class="rec"></div></div></div>'+
      (o.superfight ? '<div class="note" style="color:var(--gold);margin:.1rem 0 .3rem">The superfight. Your belt isn\\'t on the line — his legacy is.</div>' : '')+
      '<div class="odds"><b style="color:'+oddsBand(o.p).c+'">'+oddsBand(o.p).t+'</b></div>'+
      '<div class="rw">'+(o.dwcs ? '<b style="color:var(--gold)">Win → the UFC signs you</b>' : o.superfight ? '<b style="color:var(--gold)">Win → a second division, beaten as a guest</b>' : o.defense ? ('Defend the belt · +'+o.reward+' pt') : titleShot ? '<b style="color:var(--gold)">Win → the belt is yours · +'+o.reward+' upgrade pts</b>' : ('+'+o.reward+' upgrade pts if you win'))+'</div>';
    b.querySelector('.nm').textContent=o.f.name;
    b.querySelector('.rec').textContent=o.f.record;
    // WHO you fight is still chosen here (and the difficulty band is honest — that's
    // the risk/reward of the pick). HOW you fight is the next screen. So this no
    // longer resolves the fight; it opens the game plan against this man.
    b.onclick=()=>beginPlan(o);
    g.appendChild(b);
  }
  p.appendChild(g);

  // THE CALLOUT — a fourth, bigger option, set apart, only when your hype is full and
  // there's a contender far enough above to make it a statement.
  const co = calloutOffer();
  if (co){
    const lbl=document.createElement('div'); lbl.className='rl co-rl'; lbl.textContent='Or call your shot';
    p.appendChild(lbl);
    const c=document.createElement('button'); c.className='opp callout';
    const rk='#'+co.f.rankNum;
    c.innerHTML='<div class="co-tag">STATEMENT FIGHT</div>'+
      '<div class="opphd">'+avatarHTML(co.f)+'<div class="oppwho">'+
        '<div class="rk">Call out '+rk+'</div><div class="nm"></div><div class="rec"></div></div></div>'+
      '<div class="odds"><b style="color:'+oddsBand(co.p).c+'">'+oddsBand(co.p).t+'</b></div>'+
      '<div class="co-rr"><span class="up">Win → vault to '+rk+' · +'+co.reward+' upgrade pts</span>'+
        '<span class="dn">Lose → drop a rung · your hype resets</span></div>';
    c.querySelector('.nm').textContent=co.f.name;
    c.querySelector('.rec').textContent=co.f.record;
    c.onclick=()=>beginPlan(co);
    p.appendChild(c);
  }

  // THE RIVAL — the man who beat you, offered back on your terms (never as champion).
  const rv = G.champ ? null : rivalOffer();
  if (rv){
    const lbl=document.createElement('div'); lbl.className='rl rv-rl';
    lbl.textContent = rv.trilogy ? 'The trilogy' : 'Unfinished business'; p.appendChild(lbl);
    const c=document.createElement('button'); c.className='opp rival';
    const rk = holdsBelt(rv.f) ? 'CHAMP' : rv.f.rankNum<=0.5 ? 'Ex-champ' : '#'+rv.f.rankNum;
    const rec = rv.histW+'\\u2013'+rv.histL;
    const how = rv.lossHow==='KO/TKO' ? 'knocked you out' : rv.lossHow==='submission' ? 'submitted you' : 'took a decision';
    const at  = (rv.lossRank!=null && rv.lossRank<99) ? ' at #'+(rv.lossRank===0?'C':rv.lossRank) : '';
    const hist = rv.trilogy ? "You're "+rec+" against him — this one settles it."
                            : 'He '+how+at+" — you're "+rec+' against him.';
    c.innerHTML='<div class="co-tag rival">'+(rv.trilogy?'TRILOGY':'RIVAL')+'</div>'+
      '<div class="opphd">'+avatarHTML(rv.f)+'<div class="oppwho"><div class="rk">Settle it \\u00b7 '+rk+'</div><div class="nm"></div><div class="rec"></div></div></div>'+
      '<div class="odds"><b style="color:'+oddsBand(rv.p).c+'">'+oddsBand(rv.p).t+'</b></div>'+
      '<div class="co-rr"><span class="up rvup">Win \\u2192 settle it, take his rank, +'+rv.reward+' upgrade pts</span>'+
        '<span class="dn">Lose \\u2192 he owns you, '+rv.histW+'\\u2013'+(rv.histL+1)+'</span></div>';
    c.querySelector('.nm').textContent=rv.f.name;
    c.querySelector('.rec').textContent=hist;
    c.onclick=()=>beginPlan(rv);
    p.appendChild(c);
  }
  if (G.champ){
    const _rt=legacyTier();
    const rb=document.createElement('button'); rb.className='btn retire';
    rb.textContent = _rt && _rt.goat ? 'Retire as the GOAT' : 'Retire as champion';
    rb.onclick=()=>{ if(confirm((_rt&&_rt.goat?'Retire as the GOAT?':'Retire as champion?')+'\\n\\nYou walk away on top with '+(G.defenses||0)+' title defense'+((G.defenses||0)===1?'':'s')+'. This ends the run.')){ G.retired=true; render(); } };
    p.appendChild(rb);
  }
  return p;
}

// ── THE GAME PLAN ─────────────────────────────────────────────────────────────
// The single luck-based roll the fight used to be — accept a man, get a W or an L
// off one number — becomes a decision: read his real weaknesses, choose WHERE you
// want the fight and WHAT you're hunting, and live with the trade-offs. Each choice
// carries a hidden edge computed off the opponent's REAL stats (planFor), and it
// moves the odds — but it is never SHOWN, because "which option is the favorite's"
// can't be the tell or there's no choice left to make. You weigh honest pros and
// cons and commit; whether you read it right is answered by the fight, then by the
// post-fight line. Fight IQ decides how much of the read you actually get to see.
const clampv = (v,a,b) => Math.max(a, Math.min(b, v));

// HOW MUCH A READ IS WORTH — the dial for this whole layer.
//
// The plan delta is RECENTRED before this scale hits it (see commitPlan): each axis
// is measured against the average of the options you're choosing among, so the mean
// plan is ~zero and the choice is purely relative — pick well and gain, pick lazily
// and lose. Playtest measured the old absolute edges and they were nearly pure
// upside: best plan +5 to +12, worst reasonable plan only -1 to -3. "The consequences
// for a bad plan should be higher; it mostly goes one way." Centring fixes the skew;
// this scale sets how loud the (now two-sided) choice is.
//
// 2.7, MEASURED. On the centred spread it puts a versatile fighter's best/worst plan
// at roughly +12 / -12, a one-phase specialist (whose only lever is the read) at a
// smaller +6 / -6 — correctly, a fighter with fewer tactical options has a smaller
// plan decision — and a plan you can't even run at the -22 floor. Capped +15 / -22:
// a bad read now genuinely costs, and running a plan you have no business in is the
// worst thing you can do to yourself, which is exactly right.
const PLAN_SCALE = 2.7;

// The half-drawn plan lives on G.pending so newGame() clears it (a plan pinned to a
// dead opponent is a bug) and so it survives render()'s teardown, like scoutOpen.
function beginPlan(o){ G.pending = { o, where:null, read:null }; render(); }
function cancelPlan(){ G.pending = null; render(); }

// planFor(o) — the whole read, computed once off YOUR sheet and HIS real stats.
// Returns { clarity, where:[opt...], read:[opt...] }; each opt is
// { id, label, edge (win% points, HIDDEN), pros:[{w,t}], cons:[{w,t}] }. Every
// pro/con line is gated by the matchup and weighted by how much it matters, so the
// lines Fight IQ reveals first are the decisive ones.
function planFor(o){
  const st = o.f.style || {};
  const n  = id => (G.attrs[id]||ATTR_MIN)/ATTR_MAX;          // 0.1 .. 1.0
  // YOU, aggregated the way a corner would describe you.
  const yStrike = (n('power')+n('technique')+n('pace'))/3;
  const yPow=n('power'), yTech=n('technique'), yWr=n('wrestling'), yGrap=n('grappling');
  const yTakeDef=n('takedef'), yStrDef=n('strdef'), yCardio=n('cardio'), yChin=n('chin');
  const ySubDef = n('grappling')*0.75 + n('takedef')*0.25;
  // CAN YOU EVEN RUN THIS PLAN? Playtest: "i was a pure striker, no wrestling or
  // grappling, and Fight IQ at 5 told me to take it to the mat. that just doesn't
  // make sense." Right — a fighter with no ground game can't drag anyone down, so a
  // mat-based plan should score badly for him no matter how weak the opponent's
  // takedown defense is, and the corner should never point him there. noGround is
  // how little ground game you have (0 for a real wrestler/grappler, up to ~0.35 for
  // a pure striker); it taxes the grappling and clinch plans directly.
  const noGround = Math.max(0, 0.45 - (yWr+yGrap)/2);
  // HIM, read off real stats and centred on the division — "hittable" means
  // "hittable for THIS weight class", the discipline styleDelta already uses.
  const oStrDef = st.strDef!=null ? st.strDef : 53;
  const oOpen    = clampv((DIVMEAN('strDef',53) - oStrDef)/26, -1, 1);   // + = easy to hit
  const oTddOpen = clampv((DIVMEAN('tdDef',66) - (st.tdDef!=null?st.tdDef:60))/40, -1, 1); // + = takedown-able
  const oTdThr   = clampv((st.td!=null?st.td:1.4)/4, 0, 1);              // his takedown offense
  const oSubThr  = clampv((st.sub!=null?st.sub:0.4)/2, 0, 1);            // his submission offense
  const oSubVuln = clampv(1.4 - (st.mat!=null?st.mat:0.8), 0, 1.2);      // how tappable HE is
  const oChinV   = clampv((DIVMEAN('chin',0.6) - (st.chin!=null?st.chin:0.6))/0.4, -1, 1); // + = fragile
  const oPace    = clampv(((st.slpm!=null?st.slpm:4.4) - 4.0)/2.9, 0, 1.2);
  const oPop     = clampv((st.kd!=null?st.kd:0.4)/1.2, 0, 1.2);          // his knockout pop
  const grappler = oSubThr > 0.32 || oTdThr > 0.45;
  const striker  = oOpen < -0.10 && oPace > 0.45;

  const P = (w,t)=>({w,t});
  // Threshold 1.0, not 0.4: a line only shows if the matchup actually makes it TRUE
  // for you. It's what stops a pure striker reading "your grappling can finish it" on
  // the mat plan — that pro is weighted by your grappling, so at 1/10 it never clears
  // the bar, and the striker sees only the honest cons of a plan he can't run.
  const opt = (id,label,edge,pros,cons)=>({ id, label, edge,
    pros: pros.filter(x=>x.w>1.0).sort((a,b)=>b.w-a.w),
    cons: cons.filter(x=>x.w>1.0).sort((a,b)=>b.w-a.w) });

  // ---- WHERE DO YOU WANT THE FIGHT ----
  const eStrike =
      9*yStrike*Math.max(0,oOpen)
    + 7*yPow*Math.max(0,oChinV)
    + 5*(grappler?1:0)*(0.35+0.65*yTakeDef)
    - 8*Math.max(0,-oOpen)*(1-yStrike)
    - 7*oTdThr*(1-yTakeDef);
  const wStrike = opt('strike','Strike at range', eStrike, [
    P(9*yStrike*Math.max(0,oOpen),         'His guard leaks — your hands are live at range.'),
    P(7*yPow*Math.max(0,oChinV),           "His chin's cracked before, and your power can find it."),
    P(6*(grappler?1:0)*yTakeDef,           'Keeps it off the mat, away from his best work.'),
  ], [
    P(8*Math.max(0,-oOpen)*(1-yStrike),    "He's the sharper striker — this is his gym, not yours."),
    P(7*oTdThr*(1-yTakeDef),               'He can change levels on you any time he wants.'),
    P(3.5*(oPace>0.6?1:0)*Math.max(0,0.5-yCardio),'He throws in volume, and long exchanges will cost you gas.'),
  ]);
  const eGrapple =
      10*yWr*Math.max(0,oTddOpen)
    + 8*yGrap*oSubVuln*(0.5+0.5*yWr)
    + 4*(striker?1:0)
    - 14*oSubThr*(1-ySubDef)
    - 7*Math.max(0,-oTddOpen)
    - 16*noGround;                    // you can't grapple if you can't wrestle it there
  const wGrapple = opt('grapple','Take it to the mat', eGrapple, [
    P(10*yWr*Math.max(0,oTddOpen),         'His takedown defense is soft — you can put him down at will.'),
    P(8*yGrap*oSubVuln,                    'He gives up his back under pressure, and your grappling can finish it.'),
    P(4.5*(striker?1:0)*yWr,               'Ground a striker and you take away everything he does.'),
  ], [
    P(14*oSubThr*(1-ySubDef),              "He's a submission ace — on the mat, you're in his world."),
    P(7*Math.max(0,-oTddOpen),             'He stuffs shots — you could spend all night chasing takedowns.'),
    P(4*(1-yWr)*(1-yGrap),                 "It's not your game — you'd be fighting where you're weakest."),
  ]);
  const eClinch =
      4*(striker?1:0)
    + 3*oPace*yCardio
    + 1.8*(yWr+yGrap)
    - 5*oTdThr*(1-yTakeDef)
    - 8*noGround
    - 2;
  const wClinch = opt('clinch','Clinch and grind', eClinch, [
    P(4.5*(striker?1:0),                   'Ties up a rangy striker and smothers his offense.'),
    P(3.5*oPace*yCardio,                   'Leans on a high-output man and drains his tank.'),
    P(3*(yWr+yGrap)/2,                     'Plays to your grappling without committing to a shot.'),
  ], [
    P(5*oTdThr*(1-yTakeDef),               'The clinch is exactly where he hunts the level change.'),
    P(2.2,                                 'Grinding rounds are close ones — you leave it to the judges.'),
  ]);

  // ---- KEY READ ----
  const eEarly =
      6*Math.max(0,oChinV)
    + 4*(oPace<0.5?1:0)*yStrike
    - 7*Math.max(0,0.5-yCardio)*Math.max(0.4,oPace)
    - 3*(isChamp(o.f)?1:0)*Math.max(0,0.5-yCardio);
  const rEarly = opt('early','Pressure early', eEarly, [
    P(6*Math.max(0,oChinV),                'He can be hurt early, before he settles in.'),
    P(4*(oPace<0.5?1:0)*yStrike,           'He starts slow — jump on him before he warms up.'),
    P(6*yWr*Math.max(0,oTddOpen),          "Shoot early, before he's warmed up to defend the takedown."),
  ], [
    P(7*Math.max(0,0.5-yCardio)*oPace,     'Trading hard early with a busy man empties your tank.'),
    P(3.5*(isChamp(o.f)?1:0)*Math.max(0,0.5-yCardio),'Five hard rounds punish a fast start.'),
  ]);
  const eDeep =
      7*oPace*yCardio
    + 3*yCardio
    - 7*Math.max(0,0.55-yChin)*oPop
    - 3*(oChinV>0.4?1:0);
  const rDeep = opt('deep','Take him deep', eDeep, [
    P(7*oPace*yCardio,                     'He fades late — drag a fast starter into deep water.'),
    P(3.5*yCardio,                         'Your gas tank owns the championship rounds.'),
    P(5*((yWr+yGrap)/2)*yCardio,           'Grind him on the mat — top control drains a gas tank fast.'),
  ], [
    P(7*Math.max(0,0.55-yChin)*oPop,       'With your chin, giving a puncher the early rounds is a gamble.'),
    P(3*(oChinV>0.4?1:0),                  "He's there to be finished early — waiting throws it away."),
  ]);
  const eCounter =
      4*yStrDef
    + 3*Math.max(0,oOpen)*yTech
    - 5*(grappler?1:0)*(1-yTakeDef)
    - 3*oPace;
  const rCounter = opt('counter','Sit and counter', eCounter, [
    P(4.5*yStrDef,                         'Low-risk — make him lead and punish the entries.'),
    P(3.5*Math.max(0,oOpen)*yTech,         "He's hittable — pick him apart as he comes in."),
    P(4.5*yTakeDef*(oTdThr>0.35?1:0),      'Let him shoot first — stuff it, and take over in the scramble.'),
  ], [
    P(5*(grappler?1:0)*(1-yTakeDef),       'Sitting back lets a grappler pick when to shoot.'),
    P(3.5*oPace,                           'A volume fighter out-works a counter-puncher on the cards.'),
  ]);

  // FIGHT IQ -> how much of the read you get. 0.25 at IQ 1, 1.0 at IQ 10. It gates
  // how many pro/con lines show and how sure the corner is — never the edges
  // themselves, which are always fully in play whether you can see them or not.
  // Starts near ZERO so the bottom of the ladder shows no named pros/cons at all — the
  // read is deducible from the scouting tape but never handed to you, and you're meant to
  // be unsure of the exact best path. Climbs to 1.0 (the whole breakdown) as Fight IQ maxes.
  // A Ring General always SEES it fully ("the corner always has the read"); its Fight IQ
  // level feeds plan POWER instead (see commitPlan), so sight is maxed here regardless.
  const sightIQ = G.sig==='general' ? ATTR_MAX : (G.attrs.fightiq||ATTR_MIN);
  const clarity = 0.12 + 0.88*((sightIQ-ATTR_MIN)/(ATTR_MAX-ATTR_MIN));
  // A natural phrase for the corner, and whether YOU can actually implement the plan.
  // The corner only ever steers toward a phase you can run: everyone can strike, but
  // "keep it on the mat" needs the wrestling to get it there, so a pure striker is
  // never told to grapple even against a takedown-vulnerable man.
  wStrike.short='on the feet';   wStrike.exec=true;
  wGrapple.short='on the mat';   wGrapple.exec = (yWr>=0.4 || yGrap>=0.55);
  wClinch.short='in the clinch'; wClinch.exec = (yWr>=0.3 || (yWr+yGrap)>=0.55);
  // A corner-ready phrase for each READ too, so a high-IQ corner can name the best one
  // — not just the best WHERE. Without these the read axis got only generic matchup
  // colour that mapped to none of the three buttons (playtest: "even at 10/10 the corner
  // doesn't make clear what to choose"), so half the plan was unguided at every level.
  rEarly.short   = 'press the pace early';
  rDeep.short    = 'take him into deep water';
  rCounter.short = 'sit back and counter';
  // THE OPPONENT, IN A CORNER'S WORDS — and this is what makes the advice matchup-
  // dependent instead of a stock speech. Playtest: "it gives the same advice every
  // time, it should be matchup dependent." The corner used to lead with your phase
  // (for a striker, always "on the feet"), so every fight sounded the same. Now it
  // classifies THE MAN IN FRONT OF YOU by his dominant danger and speaks to it: a
  // read on him, the counter to run (tuned to YOUR tools), and the one trap he
  // punishes. A wrestler, a puncher and a volume fighter now get three different
  // speeches — as they should. Priority order, most decisive threat first.
  let cRead, cCounter, cTrap;
  if (oSubThr>0.4 || oTdThr>0.5) {                              // grappler / wrestler
    cRead    = "He'll look to drag it to the mat";
    cCounter = yTakeDef>=0.5 ? "make him pay every time he shoots" : "keep circling and stay off the fence";
    cTrap    = "do not get planted on your back";
  } else if (oPop>0.6) {                                        // puncher
    cRead    = "He's got real pop in his hands";
    cCounter = "be first, then get off the center-line";
    cTrap    = yChin<0.55 ? "one clean shot could end your night" : "don't stand and trade with him";
  } else if (oPace>0.6) {                                       // volume / pressure
    cRead    = "He wants to drown you in volume";
    cCounter = yCardio>=0.5 ? "weather it early and take his air away late" : "cut the cage off and make him reset";
    cTrap    = "don't get pulled into his pace";
  } else if (oOpen<-0.15) {                                     // elusive / defensive
    cRead    = "He's slick — hard to pin down";
    cCounter = "stay patient and dig to the body";
    cTrap    = "don't get careless reaching for him";
  } else if (oChinV>0.25) {                                     // hittable / fragile
    cRead    = "His chin has cracked before";
    cCounter = "sit down on your shots and hunt it";
    cTrap    = "don't get reckless chasing the finish";
  } else {                                                      // complete / rounded
    cRead    = "He's a well-rounded veteran";
    cCounter = "win the small exchanges and out-work him";
    cTrap    = "don't give him a clean look at anything";
  }
  return { clarity, coach:{read:cRead, counter:cCounter, trap:cTrap},
           where:[wStrike,wGrapple,wClinch], read:[rEarly,rDeep,rCounter] };
}

// The corner's steer scales with Fight IQ, and it points at a PHASE, never a
// result. A sure corner still leaves you the read choice and every con to weigh —
// a sharp call on a bad matchup is still a bad matchup. It also refuses to fake
// confidence when nothing is good.
// The corner is the always-present payoff of Fight IQ, and it's driven by two axes:
// WHAT it knows scales with the opponent (coach.read/counter/trap, matchup-specific),
// and HOW MUCH it tells you scales with your Fight IQ level (1-10, every level a
// visible step — playtest: "it should shift every upgrade"). Each tier adds a
// concrete increment rather than rewording the last: a blank, the read on him, your
// phase, the counter, conviction, the why, the read with detail, then the one trap he
// punishes — information accumulating. Because read/counter/trap come from the man in
// front of you, a wrestler and a puncher get different speeches at every level.
// s = best WHERE short, rd = best READ short, both the actual highest-edge picks. The
// corner names the WHERE from tier 3 and adds the READ from tier 4 up, so by high Fight
// IQ it points at BOTH buttons you should press (and the plan panel marks them too). Low
// tiers stay murky on purpose — Fight IQ is the dial from "your fight to read" to "clear
// as day", and it's paid for in the combat points you didn't spend.
function cornerLine(iq, s, rd, coach){
  const ot = coach.read, tr = coach.trap;
  const C  = t => 'Your corner: “'+t+'”';
  const cap = t => t.charAt(0).toUpperCase()+t.slice(1);
  switch (Math.max(1, Math.min(10, iq|0))) {
    case 1:  return C("Your fight to read in there. Trust your gut and don't hesitate.");
    case 2:  return C(ot+". Feel him out early before you commit.");
    case 3:  return C(ot+". I'd lean toward keeping it "+s+".");                 // where HINT
    case 4:  return C("Keep it "+s+". The rest you'll read as it comes.");        // where NAMED, read open
    case 5:  return C(ot+". Keep it "+s+" — that part's clear.");                 // where FIRM + his style
    case 6:  return C("Keep it "+s+". "+cap(rd)+".");                             // read NAMED
    case 7:  return C(ot+". Keep it "+s+", "+rd+".");                             // both + his style
    case 8:  return C("Keep it "+s+", "+rd+" — that's the game plan.");           // + WHERE marked
    case 9:  return C("Keep it "+s+", "+rd+". And watch it: "+tr+".");            // + the trap
    default: return C(ot+". Keep it "+s+", "+rd+", and whatever happens, "+tr+". Clear as day.");  // + READ marked
  }
}

function commitPlan(o, plan){
  const w = plan.where.find(x=>x.id===G.pending.where);
  const r = plan.read.find(x=>x.id===G.pending.read);
  const base = o.p;                              // the fight before you read it
  // RECENTRE — the plan is a relative CHOICE, not a bonus. Each axis is centred on the
  // average of the options you're choosing among (executable WHERE, all READs), so the
  // best pick gains, the worst loses, and a lazy pick nets ~zero. A plan you can't even
  // run — a striker choosing the mat — sits far below the mean and is punished hardest.
  const avg = a => a.reduce((s,x)=>s+x.edge,0)/a.length;
  const execW = plan.where.filter(x=>x.exec);
  const wMean = avg(execW.length ? execW : plan.where);
  const rMean = avg(plan.read);
  // FIGHT IQ EXECUTES THE READ, it doesn't just SHOW it — and its ceiling rises with it.
  // Measured: with plan power flat, Fight IQ only REVEALED the best plan (a low-IQ striker
  // who picked "strike" by common sense got the identical swing), so it cost ~13 win% of
  // combat levels and returned almost nothing. Two IQ-scaled dials fix that: the read
  // EXECUTES harder in a sharp mind (iqMult), and its CEILING lifts, so a high-IQ fighter
  // can out-think a CLOSE fight the way a bounded plan never could.
  //
  // Deliberately NOT full parity, even for a Ring General: maxing the read still trails a
  // gifted athlete by a few win%, because at the top the more athletic fighter beats the
  // cerebral one who skipped the gym. IQ closes most of the gap and adds the clarity.
  //
  // RING GENERAL SPLITS SIGHT FROM POWER. It always SEES the plan (full clarity + marks —
  // "the corner always has the read", handled in planFor), and its read CUTS DEEPER per
  // Fight IQ level: a steeper execution + ceiling slope than a normal fighter. So Ring
  // General is never wasted — its value GROWS with your Fight IQ (measured ~+3 win% at IQ 6,
  // ~+5 at IQ 10 over no signature), which is exactly the "10 Fight IQ + Ring General should
  // pay off" the playtest asked for. It still sits a hair UNDER a gifted athlete, because
  // combat outscores plan per point — leaning combat stays the min-max, here as everywhere.
  const isGen = G.sig === 'general';
  const iqF = ((G.attrs.fightiq||ATTR_MIN) - ATTR_MIN)/(ATTR_MAX - ATTR_MIN);   // 0 at IQ1 -> 1 at IQ10
  const iqMult = 0.8 + iqF * (isGen ? 0.7 : 0.5);           // a General's read executes harder per level
  let delta = ((w.edge - wMean) + (r.edge - rMean)) * PLAN_SCALE * iqMult;  // win% pts, +good / -bad
  delta = clampv(delta, -22, 15 + iqF * (isGen ? 12 : 9));  // and its ceiling climbs faster (o.p still capped 0.85/0.88)
  if (o.titleFight) delta *= 0.5;               // against the best in the world, less to out-scheme
  // The read moves the fight and the deferred odds line reflects it: o.p now carries
  // the plan. \`swing\` is the ACTUAL applied points AFTER the 5%/95% clamp — if you were
  // already a 95% favorite a great read adds nothing and the post-fight line says so.
  o.p = clampv(base + delta/100, 0.05, 0.95);
  // THE READ CAN'T MAKE A FAVORITE A LOCK, but it must never DRAG A FAVORITE DOWN either.
  // Re-cap the post-plan odds at the board's own ceiling — 0.85 contender, 0.88 title —
  // so a great plan can't stack a close fight into a formality. But if you were ALREADY
  // above that ceiling (a big favorite on an early card, or a soft title shot), the cap
  // is max(base, ceiling), so a GOOD plan holds you at your base instead of showing a
  // phantom deduction (playtest: right game plan as a big favorite, still read as a
  // minus). A bad plan can still cost you — it just resolves below base, not below the cap.
  const cap = o.titleFight ? 0.88 : 0.85;
  o.p = Math.min(o.p, Math.max(base, cap));
  o.plan = { where:w.label, read:r.label, base, planned:o.p, swing:Math.round((o.p-base)*100) };
  G.pending = null;
  startBout(o);
}

function planBox(){
  const o = G.pending.o;
  const plan = planFor(o);
  const wrap = document.createElement('div'); wrap.className='panel plan';
  wrap.appendChild((()=>{const e=document.createElement('div'); e.className='rl'; e.textContent='Draw up your game plan'; return e;})());

  // WHO you're in there with.
  const hd=document.createElement('div'); hd.className='plan-hd';
  hd.innerHTML=avatarHTML(o.f)+'<div class="oppwho"><div class="rk"></div><div class="nm"></div><div class="rec"></div></div>';
  const rk = (o.titleFight && !o.defense) ? 'CHAMPION' : rankBadge(o.f);
  hd.querySelector('.rk').textContent=rk;
  hd.querySelector('.nm').textContent=o.f.name;
  hd.querySelector('.rec').textContent=o.f.record;
  wrap.appendChild(hd);

  // The scouting report — real stats, the same champScout the creator uses.
  const sc = champScout(o.f.style);
  if (sc){
    const s=document.createElement('div'); s.className='plan-scout';
    const lab=document.createElement('div'); lab.className='scout-arch'; lab.textContent=sc.label; s.appendChild(lab);
    const rd=document.createElement('div'); rd.className='note'; rd.style.marginTop='.15rem'; rd.textContent=sc.read; s.appendChild(rd);
    for (const [k,v,frac] of sc.rows){
      const r=document.createElement('div'); r.className='scout-row';
      const kk=document.createElement('span'); kk.textContent=k; kk.style.color='var(--muted)';
      const vv=document.createElement('span'); vv.className='v'; vv.textContent=v;
      r.appendChild(kk); r.appendChild(vv); s.appendChild(r);
      const b=document.createElement('div'); b.className='scout-bar'; const i=document.createElement('i');
      i.style.width=Math.round(frac*100)+'%'; b.appendChild(i); s.appendChild(b);
    }
    wrap.appendChild(s);
  }

  // Pros/cons for the selected option, as many lines as Fight IQ lets you see.
  const pcFor = (option)=>{
    const box=document.createElement('div'); box.className='pc';
    let shown = 0;
    const show=(arr,cls)=>{
      if(!arr.length) return;
      const mk = cls==='pro' ? '+' : '−';
      // NO FLOOR — at low Fight IQ this rounds to zero and the breakdown stays hidden, so
      // the read is DEDUCIBLE (the scouting stats above are all there) but never spelled
      // out. You're meant to be unsure of the exact best path; buying Fight IQ is what turns
      // the raw tape into named pros and cons. Skill is reading it before you can afford to.
      const cnt = Math.round(plan.clarity*arr.length);
      arr.slice(0,cnt).forEach(x=>{
        const l=document.createElement('div'); l.className='pc-line '+cls;
        const m=document.createElement('span'); m.className='mk'; m.textContent=mk;
        const t=document.createElement('span'); t.textContent=x.t;
        l.appendChild(m); l.appendChild(t); box.appendChild(l); shown++;
      });
    };
    show(option.pros,'pro'); show(option.cons,'con');
    if(!option.pros.length && !option.cons.length){
      const l=document.createElement('div'); l.className='pc-line'; l.style.color='var(--muted)';
      l.textContent="Not much either way here — it's a wash against this guy."; box.appendChild(l);
    } else if(shown===0){
      const l=document.createElement('div'); l.className='pc-line'; l.style.color='var(--muted)';
      l.textContent="Your corner can't call it — read him off the tape yourself."; box.appendChild(l);
    }
    return box;
  };

  // THE CORNER'S ACTUAL PICKS — highest-edge WHERE you can run, highest-edge READ. The
  // reveal STAGES with Fight IQ, a rung at a time (playtest: "8 told me exactly what to
  // do — each rung should be slightly more"): the corner hints the where (3), names it
  // (4-5), names the read (6-7), then the trap (9). The button MARKS trail the prose so
  // certainty on both axes is the TOP-rung payoff, not a mid-IQ cliff — the WHERE lights
  // up at 8, the READ only at 10. Below that you weigh the pros and cons yourself.
  const effIQ = G.sig==='general' ? ATTR_MAX : (G.attrs.fightiq||ATTR_MIN);
  const execWhere = plan.where.filter(w=>w.exec);
  const bestW = (execWhere.length?execWhere:plan.where).slice().sort((a,b)=>b.edge-a.edge)[0];
  const bestR = plan.read.slice().sort((a,b)=>b.edge-a.edge)[0];

  const group = (labelText, arr, kind, pickId, marked)=>{
    const g=document.createElement('div');
    const lab=document.createElement('div'); lab.className='plan-lab'; lab.textContent=labelText; g.appendChild(lab);
    const opts=document.createElement('div'); opts.className='plan-opts';
    const sel=G.pending[kind];
    arr.forEach(op=>{
      const isPick = marked && op.id===pickId;
      const b=document.createElement('button'); b.className='plan-opt'+(sel===op.id?' on':'')+(isPick?' pick':'');
      const t=document.createElement('span'); t.textContent=op.label; b.appendChild(t);
      if(isPick){ const tag=document.createElement('span'); tag.className='pick-tag'; tag.textContent="corner's pick"; b.appendChild(tag); }
      b.onclick=()=>{ G.pending[kind]=op.id; render(); };
      opts.appendChild(b);
    });
    g.appendChild(opts);
    const selOpt=arr.find(x=>x.id===sel);
    if(selOpt) g.appendChild(pcFor(selOpt));
    return g;
  };

  wrap.appendChild(group('Where do you want the fight?', plan.where, 'where', bestW.id, effIQ>=8));
  wrap.appendChild(group('Key read', plan.read, 'read', bestR.id, effIQ>=10));

  // The corner — a steer, not a verdict, only as sharp as your Fight IQ, and only ever
  // toward a phase you can actually fight in. It names the best-edge WHERE (never one a
  // pure striker can't run) AND the best-edge READ, each unlocked in turn as Fight IQ
  // rises, plus the matchup's trap at the top — the same two picks marked on the buttons.
  const corner=document.createElement('div'); corner.className='corner';
  corner.textContent=cornerLine(effIQ, bestW.short||bestW.label.toLowerCase(), bestR.short||bestR.label.toLowerCase(), plan.coach);
  wrap.appendChild(corner);

  const act=document.createElement('div'); act.className='plan-act';
  const ready = !!(G.pending.where && G.pending.read);
  const lock=document.createElement('button'); lock.className='btn pri'; lock.textContent='Lock in game plan →';
  lock.disabled=!ready; if(!ready) lock.style.opacity=.4;
  lock.onclick=()=>{ if(!ready) return; commitPlan(o, plan); };
  const back=document.createElement('button'); back.className='btn'; back.textContent='← Back'; back.onclick=cancelPlan;
  act.appendChild(lock); act.appendChild(back); wrap.appendChild(act);
  if(!ready){
    const h=document.createElement('div'); h.className='note'; h.style.marginTop='.4rem';
    h.textContent='Choose where you want the fight and your key read.'; wrap.appendChild(h);
  }
  return wrap;
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
// ── PERSONAL BESTS ACROSS RUNS ────────────────────────────────────────────────
// Persisted to localStorage so the climb has a memory: your fastest belt, best run,
// most title defenses and how many divisions you've held. Every access is guarded —
// on file:// or in a headless test localStorage may be missing, and a bragging-rights
// feature must never be the thing that throws.
const BESTS_KEY = 'gl_climb_bests_v1';
function loadBests(){
  try { const s = localStorage.getItem(BESTS_KEY);
    if (s) return Object.assign({fastestBelt:null,mostWins:0,mostDefenses:0,belts:{}}, JSON.parse(s)); } catch(e){}
  return {fastestBelt:null,mostWins:0,mostDefenses:0,belts:{}};
}
function saveBests(b){ try { localStorage.setItem(BESTS_KEY, JSON.stringify(b)); } catch(e){} }
// Fold the finished run into the saved bests; returns any records it just beat.
function updateBests(){
  const b = loadBests(), nu = [], wonBelt = G.champ || G.wasChamp;
  if (wonBelt && G.beltFight && (b.fastestBelt == null || G.beltFight < b.fastestBelt)) { b.fastestBelt = G.beltFight; nu.push('fastest belt'); }
  if (G.wins > (b.mostWins||0)) { b.mostWins = G.wins; nu.push('most wins'); }
  if ((G.defenses||0) > (b.mostDefenses||0)) { b.mostDefenses = G.defenses; nu.push('most title defenses'); }
  if (wonBelt) { b.belts = b.belts || {}; b.belts[DIV] = (b.belts[DIV]||0) + 1; }
  saveBests(b);
  return { b, nu };
}
function bestsLine(){
  const b = loadBests(), parts = [];
  if (b.fastestBelt) parts.push('Fastest belt: '+b.fastestBelt+' fight'+(b.fastestBelt===1?'':'s'));
  if (b.mostDefenses) parts.push('Most defenses: '+b.mostDefenses);
  const divs = b.belts ? Object.keys(b.belts).length : 0;
  if (divs) parts.push('Champion in '+divs+' division'+(divs===1?'':'s'));
  if (b.mostWins) parts.push('Best run: '+b.mostWins+' wins');
  return parts.join('   ·   ');
}

// ── HALL OF FAME ───────────────────────────────────────────────────────────────
// BESTS (above) keeps AGGREGATE maxima — your fastest belt, your best run — one
// number per category, the previous record overwritten the moment a new run beats
// it. Hall of Fame is the roster those numbers were pulled out of: every finished
// run, kept, so a mediocre fighter isn't just erased the moment a better one
// arrives. It's an ADDITIVE read of the same runSummary() the end screen and the
// share sheet already build — no new game-state tracking, only new persistence.
//
// SEPARATE KEY, NOT AN EXTENSION OF gl_climb_bests_v1. The old key's shape
// (fastestBelt: a NUMBER) and this one's (an ARRAY of run records) are
// incompatible; writing the new shape under the old key would mean loadBests()
// silently starts reading \`b.fastestBelt < X\` against an array and every
// comparison lies without throwing — precisely the "a value changed what it
// meant and every caller quietly lied" failure this file's tuning notes keep
// finding. New key, and BESTS keeps doing its own job untouched.
const HOF_KEY = 'gl_climb_hof_v1', HOF_MAX = 50;
function loadHOF(){
  try { const s = localStorage.getItem(HOF_KEY); if (s) { const a = JSON.parse(s); if (Array.isArray(a)) return a; } } catch(e){}
  return [];
}
function saveHOF(list){ try { localStorage.setItem(HOF_KEY, JSON.stringify(list.slice(0, HOF_MAX))); } catch(e){} }
// Fold the finished run into the Hall of Fame. Newest first, capped at HOF_MAX —
// this is a browser localStorage value, not a database, and the feature's whole
// value is bragging rights over a career's worth of runs, not an archive.
function updateHOF(){
  const s = runSummary();
  const entry = {
    name: (G.fighterName || 'Your fighter'), division: s.division, verdict: s.verdict,
    verdictSub: s.verdictSub, style: s.style, defenses: s.defenses, wasChamp: s.wasChamp,
    peakLabel: s.peakLabel, pro: s.pro, ufc: s.ufc, fights: s.fights,
    finishRate: s.finishRate, date: Date.now(),
  };
  const list = loadHOF();
  list.unshift(entry);
  saveHOF(list);
  return entry;
}
// TIER ORDER FOR SORTING — GOAT first, CUT last. A fixed rank rather than a
// string compare, because 'CHAMPION.' > 'CUT.' alphabetically would put a cut
// prospect ahead of a champion and nobody would notice until they looked.
const HOF_TIER = { 'THE GOAT.':0, 'CHAMPION.':1, 'NO BELT.':2, 'CUT.':3 };
function hofBox(){
  const list = loadHOF();
  const d = document.createElement('details'); d.className = 'legwrap panel';
  const sum = document.createElement('summary'); sum.textContent = 'Hall of Fame'+(list.length?' ('+list.length+')':'');
  d.appendChild(sum);
  if (!list.length){
    const e = document.createElement('div'); e.className = 'note'; e.textContent = 'No finished runs yet — your first retired or cut fighter lands here.';
    d.appendChild(e);
  } else {
    const sorted = list.slice().sort((a,b) => (HOF_TIER[a.verdict]??9) - (HOF_TIER[b.verdict]??9) || b.date - a.date);
    for (const e of sorted){
      const row = document.createElement('div'); row.className = 'lg-row';
      const b = document.createElement('b'); b.textContent = e.name+' — '+e.division;
      const sp = document.createElement('span');
      sp.textContent = e.verdict.replace(/\\.$/,'')+(e.verdictSub?' · '+e.verdictSub:'')+' · '+e.style+' · '+e.pro+' pro ('+e.ufc+' UFC)';
      row.appendChild(b); row.appendChild(sp);
      d.appendChild(row);
    }
  }
  return d;
}

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
    // LEGACY OUTRANKS THE ENDING. A champion — current OR former — keeps his legacy on
    // the card no matter HOW the run ended: losing your last belt fight (outOfShots) or
    // getting cut later doesn't turn a 5-defense GOAT into "NO BELT. Out of title shots"
    // (playtest: 18-6, 5 defenses, retired at GOAT, card said No belt). Only a fighter
    // who NEVER won it reads out-of-shots or cut. So wasChamp is checked BEFORE outOfShots.
    verdict: (G.champ || G.wasChamp) ? (legacyTier() && legacyTier().goat ? 'THE GOAT.' : 'CHAMPION.')
           : G.outOfShots ? 'NO BELT.'
           : 'CUT.',
    verdictSub: (G.champ || G.wasChamp)
                ? ((G.defenses||0) ? (G.defenses+' title defense'+(G.defenses===1?'':'s')+'.')
                                   : (G.wasChamp ? 'Former champion.' : 'You did it.'))
              : G.outOfShots ? 'Out of title shots.'
              : CUT_AT+' losses.',
    signature: SIG(G.sig) ? SIG(G.sig).name : null,
    defenses: G.defenses || 0,
    wasChamp: !!G.wasChamp,
    division: (D && D.divisions && D.divisions[DIV] && D.divisions[DIV].label) || DIV,
    fights: G.log.length,
    age: START_AGE + Math.floor(((G.fightNo||0)*MONTHS_PER_FIGHT)/12),
    style: archetype(),
    pro: totalRecord(),
    ufc: ufcRecord(),
    // PEAK checks G.peak===0, not G.champ — a FORMER champion who lost the belt is no
    // longer G.champ, but his peak was the belt, and the card must read CHAMPION, not #0.
    peakLabel: G.peak===0 ? 'CHAMPION' : G.peak==null ? 'UNRANKED' : '#'+G.peak,
    shareRank: G.peak===0 ? 'champion' : G.peak==null ? 'unranked'
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
    '<div><span>Peak</span><b>'+(G.peak===0?'CHAMPION':G.peak==null?'Unranked':'#'+G.peak)+'</b></div>'+
    '<div><span>Fighting style</span><b>'+archetype()+'</b></div>'+
    (SIG(G.sig)?'<div><span>Signature move</span><b>'+SIG(G.sig).name+'</b></div>':'')+
    ((G.defenses||0)?'<div><span>Title defenses</span><b>'+G.defenses+'</b></div>':'');
  p.appendChild(rec);
  // WHAT THOSE TWO NAMES MEAN, said plainly — the archetype is read off the build, the
  // signature is the edge you picked, and neither was self-explaining on the card (playtest).
  {
    const _s = SIG(G.sig);
    const wm = document.createElement('div'); wm.className='note'; wm.style.cssText='margin-top:.3rem;color:var(--muted)';
    wm.innerHTML = '<b>Fighting style</b> is how your build fights, read from your stats'
      + (_s ? '. <b>'+_s.name+'</b> — '+_s.short : '') + '';
    p.appendChild(wm);
  }
  // PERSONAL BESTS — folded in once per run, with any records just beaten called out.
  // HALL OF FAME rides the same once-per-run guard so a finished run is never
  // logged twice (endBox can render more than once for the same ended run).
  if (!G.bestsSaved){ G._bests = updateBests(); updateHOF(); G.bestsSaved = true; }
  const _br = G._bests || { nu:[] };
  if (_br.nu && _br.nu.length){ const nb=document.createElement('div'); nb.className='note'; nb.style.cssText='color:var(--gold);margin-top:.4rem;font-weight:700'; nb.textContent='New personal best — '+_br.nu.join(', ')+'!'; p.appendChild(nb); }
  const _bl=bestsLine(); if(_bl){ const bd=document.createElement('div'); bd.className='note'; bd.style.marginTop='.3rem'; bd.textContent='Career bests: '+_bl; p.appendChild(bd); }
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
    '<div class="note">The Climb is free. You build a fighter, fight your way onto Dana '+
    'White\\'s Contender Series, then enter the UFC as a 10-0 prospect and try to win a '+
    'real belt against the real division — no card, no trial.</div>';
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
