// Go Premium -- mirrors gillylab.com/subscribe: the same three feature
// groups, the same tiles, the same copy (see FEATURE_GROUPS below, pulled
// straight from worker/pages.js's own `slides` array -- the source the
// site's landing-page carousel AND /subscribe's tile grid both render
// from). Not a live embed of that page's actual interactive grid (that's a
// ~160KB script tied to server-rendered mockup HTML per feature -- built
// for a desktop/tablet-width scroll rail, not a native screen), but the
// same features, same grouping, same descriptions, laid out as a plain
// native tile grid instead. Free features (Pick'em, The Climb, rankings &
// roster, fighter stats) are left out here on purpose -- this screen is
// specifically what PREMIUM adds on top of the free app the visitor is
// already using, same as /subscribe's own tile grid hides its free group
// (window.__FX_PREMIUM_ONLY) for the identical reason.
//
// No purchase happens in the app -- tapping through opens the real
// subscribe page in the system browser, so the upgrade is a normal web
// checkout (Stripe), not an in-app purchase. That sidesteps Apple's IAP
// requirement, which only applies to purchases completed inside the app
// itself.
var FEATURE_GROUPS = [
  {
    label: 'Before the fight',
    note: 'where the research begins',
    tiles: [
      ['Fight simulator', 'Any matchup through the tuned model — winner, method and round.'],
      ['Matchup analytics deep dive', 'Every strike by target and position, plus grappling — shaded against the division. Main event free.'],
      ['Style, pace & path to victory', 'Striker or grappler, the pace they imply, how each one wins. Main event free.'],
    ],
  },
  {
    label: 'Betting tools',
    note: 'become a smarter, more efficient bettor',
    tiles: [
      ['Live odds & props', 'Moneyline, round totals and props, book by book.'],
      ['Bet & CLV tracker', 'Log a bet; it grades itself. Record, ROI, units, closing-line value.'],
      ['Line movement', 'Every bout’s odds, day by day, from open to now.'],
      ['Parlay builder', 'Build a slip, then re-price it at every other book.'],
      ['Odds & line history', 'Every fighter’s closing lines, bout by bout.'],
    ],
  },
  {
    label: 'Complete fighter history',
    note: 'every fighter, every bout',
    tiles: [
      ['Box scores for every bout', 'Strikes, takedowns and control for every UFC fight ever.'],
      ['Career accolades', 'Titles, belt ranks, records and fight-night awards.'],
      ['One-click tape study', 'Every fight links straight to the film.'],
    ],
  },
];

window.GL_ROUTER.register('premium', {
  title: 'Go Premium',
  tab: 'account',
  showBack: true,
  render: function(container){
    function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]; }); }

    function groupHTML(g){
      var tiles = g.tiles.map(function(t){
        return '<div class="pm-tile"><div class="pm-tile-t">' + esc(t[0]) + '</div><div class="pm-tile-d">' + esc(t[1]) + '</div></div>';
      }).join('');
      return (
        '<div class="gl-sec">' +
          '<div class="gl-dash-head"><h2 class="gl-dash-title">' + esc(g.label) + '</h2><p class="gl-muted" style="margin:.15rem 0 0">' + esc(g.note) + '</p></div>' +
          '<div class="pm-grid">' + tiles + '</div>' +
        '</div>'
      );
    }

    container.innerHTML =
      '<div class="gl-sec gl-sec--first">' +
        '<h1 class="gl-heading" style="font-size:1.4rem;margin:0 0 .3rem">Go Premium</h1>' +
        '<p class="gl-muted" style="margin:0">Everything free, plus the whole database and every tool:</p>' +
      '</div>' +
      FEATURE_GROUPS.map(groupHTML).join('') +
      '<button type="button" class="gl-btn gl-btn-primary" id="upgradeBtn" style="margin-top:.4rem">Continue to Upgrade</button>' +
      '<p class="gl-muted" style="text-align:center;margin-top:.6rem">Opens gillylab.com to complete secure checkout by Stripe · cancel anytime.</p>';

    container.querySelector('#upgradeBtn').addEventListener('click', function(){
      window.GL_NATIVE.tap();
      window.GL_NATIVE.openExternal(window.GL_API.BASE + '/subscribe');
    });
  }
});
