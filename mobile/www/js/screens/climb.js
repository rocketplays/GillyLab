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
// page. Rendering as a normal (scrolling) screen instead, with the iframe
// itself sized to fill the visible viewport below the header via
// .gl-embed-frame's own calc'd height (app.css) -- looks identical to the
// old fullbleed layout when the page hasn't been scrolled, but the header
// is real scrolling content above it now, same mechanism as any other
// screen, rather than a second, independent thing.
window.GL_ROUTER.register('climb', {
  title: 'The Climb',
  tab: 'climb',
  render: function(container){
    container.innerHTML = '<iframe class="gl-embed-frame" src="climb-game.html" title="The Climb"></iframe>';
  }
});
