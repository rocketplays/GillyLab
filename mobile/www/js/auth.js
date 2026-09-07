// Local "am I logged in" state, backed by Capacitor Preferences (persists
// across app launches, unlike an in-memory JS variable). The Worker hands
// back a bearer token on login/signup (see api.js's header comment for why
// the cookie alone doesn't work cross-origin) -- that token is what's
// actually persisted and sent on every API call; loggedIn/email are just
// for the UI.
window.GL_AUTH = (function(){
  var KEY = 'gl_session';
  var state = { loggedIn:false, email:null, token:null };
  var listeners = [];

  // How long before the token's own `exp` claim to renew it. Half the
  // default SESSION_TTL_HOURS (12h), so a session that's actually used
  // renews itself well before expiry rather than right at the wire; a
  // session that sits idle past this window without the app being opened
  // just expires like the cookie would, same as before this existed.
  var REFRESH_MARGIN_SEC = 6 * 3600;
  // Cheap safety net against overlapping refreshes (a resume event and the
  // periodic timer landing at the same moment) -- refresh() is idempotent
  // server-side either way, this just avoids two redundant round-trips.
  var refreshing = null;

  function Prefs(){ return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Preferences) || null; }

  function notify(){ listeners.forEach(function(fn){ fn(state); }); }

  function load(){
    var p = Prefs();
    if (!p) return Promise.resolve();
    return p.get({ key:KEY }).then(function(res){
      if (res && res.value){
        try { state = JSON.parse(res.value); } catch(e){}
      }
    }).catch(function(){});
  }

  function save(){
    var p = Prefs();
    if (!p) return Promise.resolve();
    return p.set({ key:KEY, value:JSON.stringify(state) }).catch(function(){});
  }

  // The token is `<b64url-json>.<b64url-hmac>` (see worker/index.js's
  // makeSessionToken) -- the payload isn't encrypted, just signed, so the
  // app can read its own `exp` claim without the server's secret. This is
  // read-only client-side bookkeeping to decide *when* to ask for a
  // refresh; the worker still independently verifies the signature and
  // expiry on every request, so a tampered/expired token gains nothing
  // here even if this decode were spoofed.
  function decodeExp(token){
    if (!token) return null;
    try {
      var payload = token.split('.')[0].replace(/-/g,'+').replace(/_/g,'/');
      while (payload.length % 4) payload += '=';
      var json = JSON.parse(decodeURIComponent(escape(atob(payload))));
      return json.exp || null;
    } catch(e){ return null; }
  }

  function maybeRefresh(){
    if (!state.loggedIn || !state.token) return Promise.resolve();
    var exp = decodeExp(state.token);
    var now = Math.floor(Date.now() / 1000);
    // No readable exp, or already past it: nothing a refresh call can fix
    // (readSession rejects an already-expired token -- see worker
    // comment), so don't spend a request finding that out. The next
    // login/signup is what recovers from that state, same as today.
    if (!exp || exp <= now) return Promise.resolve();
    if (exp - now > REFRESH_MARGIN_SEC) return Promise.resolve();
    if (refreshing) return refreshing;
    refreshing = window.GL_API.refresh().then(function(data){
      if (data && data.token){
        state = { loggedIn:true, email:state.email, token:data.token };
        return save().then(notify);
      }
    }).catch(function(){
      // Refresh failing (expired mid-flight, offline, etc.) just leaves the
      // existing token in place -- the app keeps working until it actually
      // expires, then screens fall back to the logged-out view same as any
      // other session expiry.
    }).then(function(){ refreshing = null; });
    return refreshing;
  }

  var ready = load().then(maybeRefresh);

  // Belt-and-suspenders scheduling rather than a native "app resumed"
  // event: adding @capacitor/app is a real native-platform change (new
  // Podfile/Gradle dependency, needs `cap sync` + a rebuild) that hasn't
  // been exercised on a device yet, so this sticks to plain web APIs that
  // already work in a Capacitor WebView. `visibilitychange` fires when the
  // app is backgrounded/foregrounded; the interval catches a long
  // foreground session that never backgrounds.
  document.addEventListener('visibilitychange', function(){
    if (document.visibilityState === 'visible') maybeRefresh();
  });
  setInterval(maybeRefresh, 30 * 60 * 1000);

  return {
    onChange: function(fn){ listeners.push(fn); },
    ready: ready,
    isLoggedIn: function(){ return state.loggedIn; },
    email: function(){ return state.email; },
    token: function(){ return state.token; },
    login: function(email, password){
      return window.GL_API.login(email, password).then(function(data){
        state = { loggedIn:true, email:email, token: data.token || null };
        return save();
      }).then(notify);
    },
    signup: function(email, password){
      return window.GL_API.signup(email, password).then(function(data){
        state = { loggedIn:true, email:email, token: data.token || null };
        return save();
      }).then(notify);
    },
    logout: function(){
      state = { loggedIn:false, email:null, token:null };
      return save().then(notify);
    },
  };
})();
