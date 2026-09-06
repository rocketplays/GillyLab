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

  return {
    onChange: function(fn){ listeners.push(fn); },
    ready: load(),
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
