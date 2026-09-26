// The real Climb, not a standalone reimplementation. climb-game.html is
// generated from prototypes/the-climb.html by scripts/gen-climb-app-page.cjs
// -- same balance, same tuning, same code as the website's /theclimb -- with
// two differences, both explained in that generator's header comment: it
// fetches the app's deliberately-ungated GET /api/app/climb (so the game is
// playable with no account here, per spec) instead of the website's gated
// /data/climb.json, and its couple of root-relative asset/API references
// are rewritten to absolute gillylab.com URLs since the app is a different
// origin.
//
// Loaded in an <iframe> rather than injected into the app's own DOM: the
// game's CSS assumes it owns the whole page (fonts, background, viewport),
// which an iframe gives it for free without a fight against the app shell's
// own styles.
//
// NOT fullbleed (that flag existed for exactly this screen, but was dropped
// -- see git history/CSS comments if it resurfaces elsewhere): fullbleed
// pinned the brand header in a flex row above the iframe with the
// container's own overflow:hidden, which kept the header on screen
// permanently instead of scrolling away the way it does on every other
// page.
//
// A fixed-height iframe (app.css's old .gl-embed-frame calc) LOOKED right
// in a desktop preview but was broken on a real device: climb-game.html's
// own content is taller than that calc'd estimate (picking a division,
// playing a round, seeing results all grow it), so the iframe got its OWN
// internal scrollbar. A touch-drag anywhere over the game then scrolls
// THAT inner document, not .gl-app -- and since the iframe covers nearly
// the whole screen, virtually every real swipe lands on it. The outer
// page technically still scrolls (a drag starting on the thin header
// strip above the iframe works), but from the user's thumb it reads as
// "the header is stuck", because the one place people actually swipe --
// the game itself -- never reaches the parent. Every other screen is
// plain DOM content with no nested scroll container, so this never comes
// up there.
//
// Fix: don't give the iframe a fixed height at all. Measure the embedded
// document's real content height (same-origin -- climb-game.html is
// served from the app's own local origin, so contentDocument is readable)
// and set the iframe's own height to match, so it never has scroll room
// of its own. .gl-app then becomes the only scrolling container on this
// screen too, exactly like every other tab, and a swipe over the game
// scrolls the header away like anywhere else. Re-measured via
// ResizeObserver because the game's content height changes as you play
// (division picker -> ladder -> results panel).
window.GL_ROUTER.register('climb', {
  title: 'The Climb',
  tab: 'climb',
  render: function(container){
    // Title added above the iframe -- this screen previously had NONE (the
    // game's own in-iframe header is climb-game.html's, a different
    // document), so it was the one page in the app with no page title at
    // all. Matches every other screen's convention exactly (h1.gl-heading,
    // first word plain, second word var(--accent)) -- see roster.js/
    // rankings.js/odds.js for the same pattern.
    container.innerHTML = '<h1 class="gl-heading" style="margin:.1rem 0 .5rem">The <span style="color:var(--accent)">Climb</span></h1>';

    var frame = document.createElement('iframe');
    frame.className = 'gl-embed-frame';
    frame.title = 'The Climb';
    frame.src = 'climb-game.html';
    container.appendChild(frame);

    var ro = null;
    function fit(){
      try {
        var doc = frame.contentDocument;
        var h = doc && doc.documentElement && doc.documentElement.scrollHeight;
        if (h) frame.style.height = h + 'px';
      } catch (e) { /* cross-origin fallback: keep app.css's calc'd height */ }
    }
    frame.addEventListener('load', function(){
      fit();
      try {
        if (window.ResizeObserver && frame.contentDocument) {
          if (ro) ro.disconnect();
          ro = new ResizeObserver(fit);
          ro.observe(frame.contentDocument.documentElement);
        }
      } catch (e) {}
    });
    window.addEventListener('resize', fit);
  }
});
