// Go Premium -- the site's OWN /subscribe feature-tile carousel, shipped
// as-is: mockup graphics, colors, the horizontal swipe rail, tap-to-expand
// lightbox, all of it (see worker/index.js's /api/app/premium-features,
// which hands back the exact CSS/markup/script subscribePage() drops into
// the real page). Not a native reimplementation -- that was tried first
// (a plain text tile grid) and didn't hold up next to "look like the
// actual site, with the pictures, colors, graphics, everything, side to
// side, swipeable": the real thing IS a self-contained blob of CSS/HTML/JS
// built specifically for this (scripts/gen-showcase-proto.cjs), so this
// screen fetches and runs that blob directly instead of hand-copying it.
//
// The script is a single self-invoking `(function(){ ... })()` (see
// gen-showcase-proto.cjs), so it's safe to create a fresh <script> element
// and run it again on every visit to this screen -- nothing it declares
// leaks into the global scope to collide with a prior run. window.__FX_
// PREMIUM_ONLY is already baked into the fetched script (subscribe-
// features.js is generated with it set to true), so it shows only the
// premium groups -- the free features already live in the rest of the app.
//
// No purchase happens in the app -- tapping through opens the real
// subscribe page in the system browser, so the upgrade is a normal web
// checkout (Stripe), not an in-app purchase. That sidesteps Apple's IAP
// requirement, which only applies to purchases completed inside the app
// itself.
window.GL_ROUTER.register('premium', {
  title: 'Go Premium',
  tab: 'account',
  showBack: true,
  render: function(container){
    container.innerHTML = '<p class="gl-muted">Loading…</p>';

    // The fetched CSS is scoped under .sub-cx / .fx-* / #tiers / .fx-lb (the
    // site's own class names) and is the same on every visit -- injected
    // once and left in the document, same ensure-pattern as the Card
    // screen's deep-dive modal CSS (matchup.js's ensureHubCss).
    function ensureCss(css){
      if (!css || document.getElementById('pmFeaturesCssTag')) return;
      var tag = document.createElement('style');
      tag.id = 'pmFeaturesCssTag';
      tag.textContent = css;
      document.head.appendChild(tag);
    }

    window.GL_API.premiumFeatures().then(function(res){
      // .sub-cx is the exact wrapper subscribePage() puts around this same
      // markup on the site -- its own local CSS-variable overrides (the
      // widget was built to also run inside marketing pages with a
      // different palette) and the "SEE EVERYTHING PREMIUM UNLOCKS" label.
      // Reused verbatim (see the .sub-cx/.sub-cx-head rules in app.css)
      // rather than only shipping the bare #tiers/#lb the featuresMarkup
      // itself contains, so this matches the real page beat for beat.
      container.innerHTML =
        '<div class="gl-sec gl-sec--first">' +
          '<h1 class="gl-heading" style="font-size:1.4rem;margin:0 0 .3rem">Go Premium</h1>' +
          '<p class="gl-muted" style="margin:0">Everything free, plus the whole database and every tool.</p>' +
        '</div>' +
        '<div class="sub-cx"><div class="sub-cx-head">See everything Premium unlocks</div>' + (res.markup || '') + '</div>' +
        '<button type="button" class="gl-btn gl-btn-primary" id="upgradeBtn" style="margin-top:1.2rem">Continue to Upgrade</button>' +
        '<p class="gl-muted" style="text-align:center;margin-top:.6rem">Opens gillylab.com to complete secure checkout by Stripe · cancel anytime.</p>';

      ensureCss(res.css);

      // Runs the site's own carousel-building script fresh against the
      // #tiers/#lb elements just rendered above -- see the file header for
      // why re-running this on every visit is safe.
      if (res.script){
        var s = document.createElement('script');
        s.textContent = res.script;
        document.body.appendChild(s);
      }

      var upgradeBtn = container.querySelector('#upgradeBtn');
      if (upgradeBtn) upgradeBtn.addEventListener('click', function(){
        window.GL_NATIVE.tap();
        window.GL_NATIVE.openExternal(window.GL_API.BASE + '/subscribe');
      });
    }).catch(function(){
      container.innerHTML =
        '<h3 style="margin:0 0 .4rem">Couldn’t load Premium features</h3>' +
        '<p class="gl-muted">Check your connection and try again.</p>' +
        '<button type="button" class="gl-btn gl-btn-primary" id="upgradeBtn" style="margin-top:1rem">Continue to Upgrade</button>';
      var upgradeBtn = container.querySelector('#upgradeBtn');
      if (upgradeBtn) upgradeBtn.addEventListener('click', function(){
        window.GL_NATIVE.tap();
        window.GL_NATIVE.openExternal(window.GL_API.BASE + '/subscribe');
      });
    });
  }
});
