// Static feature breakdown, mirroring gillylab.com/subscribe. No purchase
// happens in the app -- tapping through opens the real subscribe page in
// the system browser, so the upgrade is a normal web checkout (Stripe),
// not an in-app purchase. That sidesteps Apple's IAP requirement, which
// only applies to purchases completed inside the app itself.
window.GL_ROUTER.register('premium', {
  title: 'Go Premium',
  tab: 'account',
  showBack: true,
  render: function(container){
    var features = [
      ['Full Fighter Database', 'Every UFC fighter, complete career stats and history.'],
      ['Live Odds', 'Moneylines, props, and totals updated across sportsbooks.'],
      ['Matchup Simulator', 'Run any fight, any era, and see the model’s breakdown.'],
      ['Rankings & Tape Study', 'AI rankings plus curated film for every fighter.'],
      ['Bet Tracker', 'Log and grade your bets, with CLV tracking.'],
    ];
    container.innerHTML =
      '<div class="gl-card"><p>Everything free, plus:</p></div>' +
      features.map(function(f){
        return '<div class="gl-card"><h3 style="margin:0 0 .2rem">' + f[0] + '</h3><p>' + f[1] + '</p></div>';
      }).join('') +
      '<button class="gl-btn gl-btn-primary" id="upgradeBtn">Continue to Upgrade</button>' +
      '<p class="gl-muted" style="text-align:center;margin-top:.6rem">Opens gillylab.com to complete checkout.</p>';

    container.querySelector('#upgradeBtn').addEventListener('click', function(){
      window.GL_NATIVE.tap();
      window.GL_NATIVE.openExternal(window.GL_API.BASE + '/subscribe');
    });
  }
});
