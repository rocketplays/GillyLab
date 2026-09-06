window.GL_ROUTER.register('pickem', {
  title: "Pick'em",
  tab: 'pickem',
  render: function(container){
    window.GL_AUTH.ready.then(function(){
      if (window.GL_AUTH.isLoggedIn()){
        container.innerHTML =
          '<div class="gl-card">' +
            '<h3 style="margin:0 0 .3rem">Signed in as ' + window.GL_AUTH.email() + '</h3>' +
            '<p>This is where the real Pick’em card (and, later, the Legends Bracket) renders. Wiring in the live weekly card is the next build step once the shell and auth flow are confirmed working end to end.</p>' +
          '</div>';
        return;
      }
      container.innerHTML =
        '<div class="gl-locked">' +
          '<svg viewBox="0 0 24 24"><path d="M6 10V8a6 6 0 0 1 12 0v2" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="4.5" y="10" width="15" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>' +
          '<div><strong style="color:var(--text)">Free account required</strong><br>Browsing is always free -- playing Pick’em and the Legends Bracket needs a quick free account.</div>' +
        '</div>' +
        '<div id="pickemAuthForm"></div>';
      window.GL_LOGIN_FORM(container.querySelector('#pickemAuthForm'), {
        onSuccess: function(){ window.GL_ROUTER.go('pickem'); }
      });
    });
  }
});
