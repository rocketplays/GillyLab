// Local "am I logged in" state, backed by Capacitor Preferences (persists
// across app launches, unlike an in-memory JS variable). This is
// deliberately separate from whether the Worker's session cookie actually
// stuck in the WebView -- see the note in api.js. For the scaffold, a
// successful /api/login or /api/signup response marks the app logged in;
// a real build should also verify the cookie / move to a bearer-token
// scheme once that's decided.
window.GL_AUTH = (function(){
  var KEY = 'gl_session';
  var state = { loggedIn:false, email:null };
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
    login: function(email, password){
      return window.GL_API.login(email, password).then(function(){
        state = { loggedIn:true, email:email };
        return save();
      }).then(notify);
    },
    signup: function(email, password){
      return window.GL_API.signup(email, password).then(function(){
        state = { loggedIn:true, email:email };
        return save();
      }).then(notify);
    },
    logout: function(){
      state = { loggedIn:false, email:null };
      return save().then(notify);
    },
  };
})();
