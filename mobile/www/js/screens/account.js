window.GL_ROUTER.register('account', {
  title: 'Account',
  tab: 'account',
  render: function(container){
    window.GL_AUTH.ready.then(function(){
      if (window.GL_AUTH.isLoggedIn()){
        container.innerHTML =
          '<div class="gl-card">' +
            '<p class="gl-label">Signed in</p>' +
            '<h3 style="margin:.1rem 0 0">' + window.GL_AUTH.email() + '</h3>' +
          '</div>' +
          '<div class="gl-card" data-goto="premium" style="cursor:pointer;border-color:color-mix(in srgb, var(--accent) 40%, var(--border))">' +
            '<h3 style="margin:0 0 .3rem;color:var(--accent)">Go Premium</h3>' +
            '<p>Unlock the full database, live odds, and the simulator.</p>' +
          '</div>' +
          '<button class="gl-btn gl-btn-outline" id="logoutBtn">Log Out</button>';
        container.querySelector('[data-goto]').addEventListener('click', function(){ window.GL_ROUTER.go('premium'); });
        container.querySelector('#logoutBtn').addEventListener('click', function(){
          window.GL_NATIVE.tap();
          window.GL_AUTH.logout().then(function(){ window.GL_ROUTER.go('account'); });
        });
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
