// Odds board -- new Premium direct tab (see index.html/router.js's tab-bar
// comment). Stubbed for now: no data pipeline exists yet, this just holds
// the route/tab slot so the bar and More sheet are correct while the real
// screen gets built. Follow the pattern of any other screen module here
// (mountX(container) + GL_ROUTER.register) when filling this in for real.
window.GL_ROUTER.register('odds', {
  title: 'Odds',
  tab: 'odds',
  render: function(container){
    container.innerHTML =
      '<h1 class="gl-heading" style="margin:0 0 .3rem">Odds</h1>' +
      '<p class="gl-muted">Coming soon.</p>';
  }
});
