window.GL_ROUTER.register('account', {
  title: 'Account',
  // No longer a tab-bar destination -- reached via the top-right avatar
  // menu (see js/avatar-menu.js) instead, so there's no `tab` here for
  // router.js to highlight. showBack gives it the plain inline back arrow
  // like any other pushed screen (fighter profile, settings, etc).
  showBack: true,
  render: function(container){
    function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]; }); }
    function fmtDate(ms){
      if (!ms) return null;
      var d = new Date(ms);
      return isNaN(d.getTime()) ? null : d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    }

    // Climb has no per-account save (see home.js's own climbSection comment
    // -- the-climb.html only ever persists bests to localStorage), so this
    // reads the same per-device key rather than pretending it's synced.
    function climbBests(){
      try { var raw = localStorage.getItem('gl_climb_bests_v1'); return raw ? JSON.parse(raw) : null; } catch(e){ return null; }
    }

    function statRow(label, value, sub){
      return (
        '<div class="acct-stat">' +
          '<div class="acct-stat-label">' + esc(label) + '</div>' +
          '<div class="acct-stat-value">' + esc(value) + (sub ? '<span class="acct-stat-sub">' + esc(sub) + '</span>' : '') + '</div>' +
        '</div>'
      );
    }

    function statsHTML(player){
      var bests = climbBests();
      var divs = bests && bests.belts ? Object.keys(bests.belts).length : 0;
      var pickemRow = (player && player.decided)
        ? statRow('Pick’em', (player.rankAll ? '#' + player.rankAll + ' all-time' : player.total + ' pts'), player.correct + '/' + player.decided + ' correct')
        : statRow('Pick’em', 'No picks yet', 'Make your first picks on This Week’s Card');
      var climbRow = (bests && (bests.mostWins || divs || bests.fastestBelt))
        ? statRow('The Climb', divs ? ('Champion in ' + divs + ' division' + (divs === 1 ? '' : 's')) : (bests.mostWins + ' win best run'), bests.fastestBelt ? ('Fastest belt: ' + bests.fastestBelt + ' fights') : null)
        : statRow('The Climb', 'Not played yet', null);
      return (
        '<div class="gl-sec gl-sec--first">' +
          '<div class="gl-dash-head"><h2 class="gl-dash-title">Your Stats</h2></div>' +
          pickemRow + climbRow +
        '</div>'
      );
    }

    function settingsHTML(){
      return (
        '<div class="gl-sec">' +
          '<div class="gl-dash-head"><h2 class="gl-dash-title">Account Settings</h2></div>' +
          '<button type="button" class="gl-btn gl-btn-outline" id="togglePwBtn" style="margin-top:.6rem">Change Password</button>' +
          '<div id="pwForm" hidden style="margin-top:.8rem">' +
            '<label class="gl-label">Current Password</label>' +
            '<input type="password" class="gl-field" id="pwCurrent" autocomplete="current-password">' +
            '<label class="gl-label">New Password</label>' +
            '<input type="password" class="gl-field" id="pwNew" autocomplete="new-password">' +
            '<div class="gl-muted" id="pwMsg" style="margin-bottom:.5rem"></div>' +
            '<button type="button" class="gl-btn gl-btn-primary" id="pwSaveBtn">Save New Password</button>' +
          '</div>' +
        '</div>'
      );
    }

    function dangerHTML(){
      return (
        '<div class="acct-danger">' +
          '<div class="gl-dash-head"><h2 class="gl-dash-title" style="color:var(--bad)">Delete Account</h2></div>' +
          '<p class="gl-muted" style="margin:.3rem 0 0">Permanently deletes your account and cancels any active subscription. This can’t be undone.</p>' +
          '<button type="button" class="gl-btn acct-danger-btn" id="deleteAcctBtn" style="margin-top:.7rem">Delete My Account</button>' +
          '<div id="deleteConfirm" hidden style="margin-top:.8rem">' +
            '<p class="gl-error" style="margin:0 0 .6rem">Are you sure? Your Pick’em history, Climb progress and subscription will all be permanently removed.</p>' +
            '<div style="display:flex;gap:.6rem">' +
              '<button type="button" class="gl-btn gl-btn-outline" id="deleteCancelBtn" style="flex:1">Cancel</button>' +
              '<button type="button" class="gl-btn acct-danger-btn" id="deleteConfirmBtn" style="flex:1">Yes, Delete</button>' +
            '</div>' +
            '<div class="gl-muted" id="deleteMsg" style="margin-top:.5rem"></div>' +
          '</div>' +
        '</div>'
      );
    }

    // Go Premium (or, once subscribed, Manage Subscription & Billing) is
    // deliberately its own bold, separate block -- not folded into the
    // signed-in header card or the settings list -- per feedback that it
    // needs to actually stand out, not blend in as one more row.
    function premiumBoxHTML(subscribed){
      if (subscribed){
        return (
          '<div class="acct-premium-box">' +
            '<div class="acct-premium-badge">✓ Premium Active</div>' +
            '<h3 style="margin:.3rem 0 .2rem">Manage Subscription &amp; Billing</h3>' +
            '<p style="margin:0 0 .8rem">Update your payment method, view invoices, or cancel anytime.</p>' +
            '<button type="button" class="gl-btn gl-btn-primary" id="portalBtn">Manage Subscription →</button>' +
          '</div>'
        );
      }
      return (
        '<div class="acct-premium-box acct-premium-box--upsell">' +
          '<h3 style="margin:0 0 .2rem">Go Premium</h3>' +
          '<p style="margin:0 0 .8rem">Unlock the full fighter database, live odds, the matchup simulator and more.</p>' +
          '<button type="button" class="gl-btn gl-btn-primary" id="goPremiumBtn">See What’s Included →</button>' +
        '</div>'
      );
    }

    function renderAccount(acct, player){
      var email = (acct && acct.email) || window.GL_AUTH.email();
      var subscribed = !!(acct && acct.subscribed);
      var memberSince = fmtDate(acct && acct.memberSince);
      container.innerHTML =
        '<div class="gl-card">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:.6rem">' +
            '<div>' +
              '<p class="gl-label" style="margin:0">Signed in</p>' +
              '<h3 style="margin:.1rem 0 0">' + esc(email) + '</h3>' +
            '</div>' +
            '<span class="acct-badge ' + (subscribed ? 'acct-badge--premium' : '') + '">' + (subscribed ? 'Premium' : 'Free') + '</span>' +
          '</div>' +
          (memberSince ? '<p class="gl-muted" style="margin:.4rem 0 0">Member since ' + esc(memberSince) + '</p>' : '') +
        '</div>' +
        premiumBoxHTML(subscribed) +
        statsHTML(player) +
        settingsHTML() +
        dangerHTML() +
        '<button type="button" class="gl-btn gl-btn-outline" id="logoutBtn" style="margin-top:1.4rem">Log Out</button>';

      wireAccount(subscribed);
    }

    function wireAccount(subscribed){
      var goBtn = container.querySelector('#goPremiumBtn');
      if (goBtn) goBtn.addEventListener('click', function(){ window.GL_NATIVE.tap(); window.GL_ROUTER.go('premium'); });

      var portalBtn = container.querySelector('#portalBtn');
      if (portalBtn) portalBtn.addEventListener('click', function(){
        window.GL_NATIVE.tap();
        window.GL_NATIVE.openExternal(window.GL_API.BASE + '/api/portal');
      });

      var toggleBtn = container.querySelector('#togglePwBtn');
      var pwForm = container.querySelector('#pwForm');
      if (toggleBtn && pwForm) toggleBtn.addEventListener('click', function(){
        window.GL_NATIVE.tap();
        pwForm.hidden = !pwForm.hidden;
        toggleBtn.textContent = pwForm.hidden ? 'Change Password' : 'Cancel';
      });
      var pwSaveBtn = container.querySelector('#pwSaveBtn');
      if (pwSaveBtn) pwSaveBtn.addEventListener('click', function(){
        window.GL_NATIVE.tap();
        var current = container.querySelector('#pwCurrent').value;
        var next = container.querySelector('#pwNew').value;
        var msg = container.querySelector('#pwMsg');
        if (!next || next.length < 8){ msg.className = 'gl-error'; msg.textContent = 'New password must be at least 8 characters.'; return; }
        msg.className = 'gl-muted'; msg.textContent = 'Saving…';
        pwSaveBtn.disabled = true;
        window.GL_API.changePassword(current, next).then(function(){
          msg.className = 'gl-muted';
          msg.style.color = 'var(--accent)';
          msg.textContent = 'Password updated.';
          container.querySelector('#pwCurrent').value = '';
          container.querySelector('#pwNew').value = '';
          pwSaveBtn.disabled = false;
        }).catch(function(err){
          msg.className = 'gl-error';
          msg.textContent = (err && err.data && err.data.error) || 'Couldn’t change your password — try again.';
          pwSaveBtn.disabled = false;
        });
      });

      var deleteBtn = container.querySelector('#deleteAcctBtn');
      var deleteConfirm = container.querySelector('#deleteConfirm');
      if (deleteBtn && deleteConfirm) deleteBtn.addEventListener('click', function(){
        window.GL_NATIVE.tap();
        deleteConfirm.hidden = false;
        deleteBtn.hidden = true;
      });
      var deleteCancelBtn = container.querySelector('#deleteCancelBtn');
      if (deleteCancelBtn) deleteCancelBtn.addEventListener('click', function(){
        window.GL_NATIVE.tap();
        deleteConfirm.hidden = true;
        deleteBtn.hidden = false;
      });
      var deleteConfirmBtn = container.querySelector('#deleteConfirmBtn');
      if (deleteConfirmBtn) deleteConfirmBtn.addEventListener('click', function(){
        window.GL_NATIVE.tap();
        var msg = container.querySelector('#deleteMsg');
        deleteConfirmBtn.disabled = true;
        deleteCancelBtn.disabled = true;
        msg.textContent = 'Deleting your account…';
        window.GL_API.deleteAccount().then(function(){
          return window.GL_AUTH.logout();
        }).then(function(){
          window.GL_ROUTER.go('account');
        }).catch(function(err){
          msg.className = 'gl-error';
          msg.textContent = (err && err.data && err.data.error) || 'Couldn’t delete your account — try again.';
          deleteConfirmBtn.disabled = false;
          deleteCancelBtn.disabled = false;
        });
      });

      var logoutBtn = container.querySelector('#logoutBtn');
      if (logoutBtn) logoutBtn.addEventListener('click', function(){
        window.GL_NATIVE.tap();
        window.GL_AUTH.logout().then(function(){ window.GL_ROUTER.go('account'); });
      });
    }

    function loadAccount(){
      container.innerHTML = '<p class="gl-muted">Loading account…</p>';
      Promise.all([
        window.GL_API.account().catch(function(){ return null; }),
        window.GL_API.pickemName().catch(function(){ return null; }),
      ]).then(function(results){
        var acct = results[0], nameRes = results[1];
        var playerName = nameRes && nameRes.name;
        return (playerName ? window.GL_API.pickemPlayer(playerName).catch(function(){ return null; }) : Promise.resolve(null))
          .then(function(player){ renderAccount(acct, player); });
      });
    }

    window.GL_AUTH.ready.then(function(){
      if (window.GL_AUTH.isLoggedIn()){
        loadAccount();
        return;
      }
      container.innerHTML =
        '<div class="gl-card"><p>Browsing the free section never requires an account. Create one to play Pick’em and the Legends Bracket, and to sync your progress.</p></div>' +
        '<div id="acctAuthForm"></div>';
      window.GL_LOGIN_FORM(container.querySelector('#acctAuthForm'), {
        onSuccess: function(){ window.GL_ROUTER.go('account'); }
      });
    });
  }
});
