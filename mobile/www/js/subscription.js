// Whether the signed-in account is a premium subscriber -- the one piece
// GL_AUTH doesn't know (it only tracks logged-in/out, per its own header
// comment). This exists solely to drive the tab bar's Account-vs-More slot
// (see router.js's setPremiumMode + index.html's tab-bar comment); screens
// that gate their own content (fighter.js, matchup.js, simulator.js) each
// still make their own account()/matchup() calls and don't depend on this.
window.GL_SUB = (function(){
  function refresh(){
    if (!window.GL_AUTH.isLoggedIn()){
      window.GL_ROUTER.setPremiumMode(false);
      return Promise.resolve(false);
    }
    return window.GL_API.account().then(function(acct){
      var sub = !!(acct && acct.subscribed);
      window.GL_ROUTER.setPremiumMode(sub);
      return sub;
    }).catch(function(){
      // Offline, or the account fetch failed for some other reason -- fall
      // back to the plain (non-premium) tab layout rather than leaving the
      // bar in whatever state it happened to be in.
      window.GL_ROUTER.setPremiumMode(false);
      return false;
    });
  }
  return { refresh: refresh };
})();
