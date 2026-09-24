// App Settings -- reached only from the avatar menu (see js/avatar-menu.js),
// same plain-back-arrow treatment as Account. Four sections: Notifications
// (push + email, each a real per-category toggle persisted via
// worker/index.js's /api/app/notification-prefs -- push has no send
// pipeline behind it yet, see that route's own comment, but the prefs are
// real and ready), Support (mailto contact), Socials (link-outs), and App
// Info (Privacy/Terms/version). No account-identity stuff here -- that's
// Account's job; this is app-level preferences and info only.
window.GL_ROUTER.register('settings', {
  title: 'Settings',
  showBack: true,
  // A genuine sub-page, not one of the app's main sections -- router.js
  // hides the bottom tab bar and the brand row while this is open, showing
  // this screen's own `title` ("Settings") as a plain page title instead.
  // Reappears automatically on back() since go() re-evaluates this flag on
  // every navigation.
  hideTabbar: true,
  render: function(container){
    var SUPPORT_EMAIL = 'support@gillylab.com';
    var SOCIALS = [
      { label: 'X / Twitter', handle: '@thegillylab', url: 'https://x.com/thegillylab' },
      { label: 'Instagram', handle: '@thegillylab', url: 'https://instagram.com/thegillylab' },
      { label: 'gillylab.com', handle: null, url: 'https://gillylab.com' },
    ];
    var APP_VERSION = '0.1.0';   // mirrors mobile/package.json's "version" -- bump both together

    function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]; }); }

    function switchHTML(key, label, sub){
      return (
        '<label class="gl-switch-row">' +
          '<div class="gl-switch-tx"><div class="gl-switch-label">' + esc(label) + '</div>' + (sub ? '<div class="gl-switch-sub">' + esc(sub) + '</div>' : '') + '</div>' +
          '<span class="gl-switch"><input type="checkbox" data-pref="' + esc(key) + '"><span class="gl-switch-track"></span></span>' +
        '</label>'
      );
    }

    function notificationsHTML(subscribed){
      // Bet Results only makes sense for Premium -- the Bet & CLV Tracker
      // itself (bettracker.js) is a subscribed-only feature, so a free user
      // has no tracked bets to ever get graded and shouldn't see a toggle
      // for a notification that can never fire for them.
      return (
        '<div class="gl-sec gl-sec--first">' +
          '<div class="gl-dash-head"><h2 class="gl-dash-title">Push Notifications</h2></div>' +
          switchHTML('pushPickemReminders', 'Pick’em Reminders', 'A nudge before picks lock for the next card') +
          switchHTML('pushPickemResults', 'Pick’em Results', 'When your picks are graded after a card') +
          (subscribed ? switchHTML('pushBetResults', 'Bet Results', 'When a tracked bet is graded win or loss') : '') +
        '</div>' +
        '<div class="gl-sec">' +
          '<div class="gl-dash-head"><h2 class="gl-dash-title">Email Notifications</h2></div>' +
          '<p class="gl-muted" style="margin:0 0 .5rem">We’ll only email you about the things you leave on here.</p>' +
          switchHTML('emailPickemReminders', 'Pick’em Reminders', 'Picks-locking-soon and missed-card nudges') +
          switchHTML('emailPickemResults', 'Pick’em Results', 'Your recap after a card grades') +
        '</div>'
      );
    }

    function supportHTML(){
      return (
        '<div class="gl-sec">' +
          '<div class="gl-dash-head"><h2 class="gl-dash-title">Support</h2></div>' +
          '<p class="gl-muted" style="margin:0 0 .6rem">Questions, bugs, feature ideas -- we read every email.</p>' +
          '<div class="gl-list-row"><div class="gl-list-label">Support Email</div><div class="gl-list-value">' + esc(SUPPORT_EMAIL) + '</div></div>' +
          '<button type="button" class="gl-btn gl-btn-outline" id="contactBtn" style="margin-top:.7rem">Contact Us</button>' +
        '</div>'
      );
    }

    function socialsHTML(){
      var rows = SOCIALS.map(function(s, i){
        var label = s.handle ? (s.label + ' - ' + s.handle) : s.label;
        return '<button type="button" class="gl-list-row gl-list-row--btn" data-social="' + i + '"><div class="gl-list-label">' + esc(label) + '</div><span class="gl-list-go">›</span></button>';
      }).join('');
      return (
        '<div class="gl-sec">' +
          '<div class="gl-dash-head"><h2 class="gl-dash-title">Follow GillyLab</h2></div>' +
          rows +
        '</div>'
      );
    }

    function appInfoHTML(){
      return (
        '<div class="gl-sec">' +
          '<div class="gl-dash-head"><h2 class="gl-dash-title">App Info</h2></div>' +
          '<button type="button" class="gl-list-row gl-list-row--btn" id="aboutBtn"><div class="gl-list-label">About</div><span class="gl-list-go">›</span></button>' +
          '<button type="button" class="gl-list-row gl-list-row--btn" id="privacyBtn"><div class="gl-list-label">Privacy Policy</div><span class="gl-list-go">›</span></button>' +
          '<button type="button" class="gl-list-row gl-list-row--btn" id="termsBtn"><div class="gl-list-label">Terms of Service</div><span class="gl-list-go">›</span></button>' +
          '<div class="gl-list-row"><div class="gl-list-label">App Version</div><div class="gl-list-value">' + esc(APP_VERSION) + '</div></div>' +
        '</div>'
      );
    }

    function render(prefs, subscribed){
      container.innerHTML =
        notificationsHTML(subscribed) +
        supportHTML() +
        socialsHTML() +
        appInfoHTML();
      wire(prefs);
    }

    function wire(prefs){
      // Notification toggles -- each checkbox POSTs just its own key on
      // change, optimistic (flips right away) with a revert if the save
      // fails, same pattern as a plain iOS/Android settings toggle.
      container.querySelectorAll('[data-pref]').forEach(function(input){
        var key = input.getAttribute('data-pref');
        input.checked = prefs[key] !== false;
        input.addEventListener('change', function(){
          window.GL_NATIVE.tap();
          var val = input.checked;
          var body = {}; body[key] = val;
          window.GL_API.setNotificationPrefs(body).catch(function(){
            input.checked = !val;   // revert on failure
          });
        });
      });

      var contactBtn = container.querySelector('#contactBtn');
      if (contactBtn) contactBtn.addEventListener('click', function(){
        window.GL_NATIVE.tap();
        // A mailto: link is a non-http(s) scheme, so the WebView hands it
        // straight to the OS -- opens the device's mail app the same way
        // Browser.open() would open gillylab.com in a browser, no separate
        // plugin needed.
        window.location.href = 'mailto:' + SUPPORT_EMAIL + '?subject=' + encodeURIComponent('GillyLab App Feedback');
      });

      container.querySelectorAll('[data-social]').forEach(function(btn){
        btn.addEventListener('click', function(){
          window.GL_NATIVE.tap();
          var s = SOCIALS[parseInt(btn.getAttribute('data-social'), 10)];
          if (s) window.GL_NATIVE.openExternal(s.url);
        });
      });

      var aboutBtn = container.querySelector('#aboutBtn');
      if (aboutBtn) aboutBtn.addEventListener('click', function(){ window.GL_NATIVE.tap(); window.GL_NATIVE.openExternal('https://gillylab.com/about'); });
      var privacyBtn = container.querySelector('#privacyBtn');
      if (privacyBtn) privacyBtn.addEventListener('click', function(){ window.GL_NATIVE.tap(); window.GL_NATIVE.openExternal('https://gillylab.com/privacy'); });
      var termsBtn = container.querySelector('#termsBtn');
      if (termsBtn) termsBtn.addEventListener('click', function(){ window.GL_NATIVE.tap(); window.GL_NATIVE.openExternal('https://gillylab.com/terms'); });
    }

    // Notification prefs are per-account (server-side), so a logged-out
    // visitor gets the defaults shown but can't actually save a change --
    // Support/Socials/App Info don't need an account at all, so the whole
    // screen still renders for them; only the toggle POSTs will 401 (caught
    // above, no-op besides reverting the switch). window.GL_AUTH.ready is
    // the same gate account.js waits on before trusting isLoggedIn().
    window.GL_AUTH.ready.then(function(){
      if (window.GL_AUTH.isLoggedIn()){
        Promise.all([
          window.GL_API.notificationPrefs().catch(function(){ return {}; }),
          window.GL_API.account().catch(function(){ return null; }),
        ]).then(function(results){
          render(results[0], !!(results[1] && results[1].subscribed));
        });
      } else {
        render({}, false);
      }
    });
  }
});
