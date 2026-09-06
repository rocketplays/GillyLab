// Thin fetch wrapper around the real GillyLab Worker API. The app is a
// separate origin from gillylab.com (capacitor://localhost on iOS,
// https://localhost on Android), so every call here is cross-origin.
//
// KNOWN FOLLOW-UP (backend, not yet done): the Worker's /api/login and
// /api/signup currently set a session cookie for the website. Whether that
// cookie round-trips correctly to a Capacitor WebView depends on the
// cookie's SameSite/Secure flags and the Worker's CORS response headers
// (Access-Control-Allow-Origin must echo the app's origin, and
// Access-Control-Allow-Credentials: true must be set, for a cross-origin
// fetch with credentials to keep a cookie at all). Until that's verified,
// treat auth as best-effort here -- see auth.js for how the app tracks
// "logged in" locally regardless of whether the cookie actually stuck.
window.GL_API = (function(){
  var BASE = 'https://gillylab.com';

  function request(path, opts){
    opts = opts || {};
    var headers = Object.assign({ 'Content-Type':'application/json' }, opts.headers || {});
    return fetch(BASE + path, {
      method: opts.method || 'GET',
      headers: headers,
      credentials: 'include',
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    }).then(function(res){
      return res.json().catch(function(){ return {}; }).then(function(data){
        if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed'), { status: res.status, data: data });
        return data;
      });
    });
  }

  return {
    login: function(email, password){ return request('/api/login', { method:'POST', body:{ email:email, password:password } }); },
    signup: function(email, password){ return request('/api/signup', { method:'POST', body:{ email:email, password:password } }); },
    rankings: function(){ return request('/data/rankings.json'); },
    request: request,
    BASE: BASE,
  };
})();
