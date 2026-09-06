// The real Pick'em, not a rebuilt one. worker/index.js's /pickem route
// renders the live weekly card, your saved picks, and your score entirely
// server-side per request (pickemPage in worker/pages.js) -- there's no
// static prototype file to generate an app copy from the way Climb and the
// Legends Bracket have, so this screen iframes the real, live page instead
// of reimplementing its scoring/card logic a second time.
//
// Auth note: an <iframe src="..."> is a navigation, not a fetch(), so it
// can't carry our Authorization bearer header (see api.js) -- only cookies
// ride along on a navigation. This relies on the gl_session cookie the
// Worker's Set-Cookie already attaches to the /api/login response (api.js
// calls it with credentials:'include', so the cookie IS stored) actually
// being sent back on this cross-site iframe GET. That's allowed for
// SameSite=Lax cookies on a "safe" (GET) cross-site navigation in every
// major browser engine's current behavior -- but custom URL schemes
// (capacitor://localhost) are exactly the kind of edge case that needs
// confirming on a real device/simulator, not assumed from spec reading.
// If it doesn't hold up, the real /pickem route's own server-side gate
// (readSession -> redirect to /signup) means the iframe just shows the
// sign-up page instead of a broken one -- a safe, visible failure mode
// rather than a silent one.
window.GL_ROUTER.register('pickem', {
  title: "Pick'em",
  tab: 'pickem',
  // Fullbleed only applies once logged in and the real page is loading in
  // an iframe -- the logged-out lock/login-form view wants the app's normal
  // padded, scrolling layout, so this is toggled inside render() rather
  // than declared statically here.
  render: function(container){
    window.GL_AUTH.ready.then(function(){
      if (!window.GL_AUTH.isLoggedIn()){
        container.innerHTML =
          '<div class="gl-locked">' +
            '<svg viewBox="0 0 24 24"><path d="M6 10V8a6 6 0 0 1 12 0v2" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="4.5" y="10" width="15" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>' +
            '<div><strong style="color:var(--text)">Free account required</strong><br>Browsing is always free -- playing Pick’em and the Legends Bracket needs a quick free account.</div>' +
          '</div>' +
          '<div id="pickemAuthForm"></div>';
        window.GL_LOGIN_FORM(container.querySelector('#pickemAuthForm'), {
          onSuccess: function(){ window.GL_ROUTER.go('pickem'); }
        });
        return;
      }
      container.classList.add('gl-app--fullbleed');
      container.innerHTML = '<iframe class="gl-embed-frame" src="' + window.GL_API.BASE + '/pickem" title="Pick\'em"></iframe>';
    });
  }
});
