// Tape Study -- new Premium direct tab (see index.html/router.js's tab-bar
// comment). Distinct from the per-fighter "Tape Study" section already
// inside a fighter profile (fighter.js's own tabsHTML) -- this is meant to
// be a top-level hub (e.g. across fighters/cards), not yet built. Stubbed
// for now: this just holds the route/tab slot so the bar and More sheet are
// correct while the real screen gets built. Follow the pattern of any other
// screen module here (mountX(container) + GL_ROUTER.register) when filling
// this in for real.
window.GL_ROUTER.register('tapestudy', {
  title: 'Tape Study',
  tab: 'tapestudy',
  render: function(container){
    container.innerHTML =
      '<h1 class="gl-heading" style="margin:0 0 .3rem">Tape Study</h1>' +
      '<p class="gl-muted">Coming soon.</p>';
  }
});
