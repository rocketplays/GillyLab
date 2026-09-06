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
window.GL_ROUTER.register('climb', {
  title: 'The Climb',
  tab: 'climb',
  fullbleed: true,
  render: function(container){
    container.innerHTML = '<iframe class="gl-embed-frame" src="climb-game.html" title="The Climb"></iframe>';
  }
});
