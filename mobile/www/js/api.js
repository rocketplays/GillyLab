// Thin fetch wrapper around the real GillyLab Worker API. The app is a
// separate origin from gillylab.com (capacitor://localhost on iOS,
// http://localhost on Android), so every call here is cross-origin.
//
// Auth: the Worker's session cookie is SameSite=Lax, which is sent on a
// top-level navigation but NOT on a cross-origin fetch() -- so the app
// can't rely on it. Instead, /api/login and /api/signup hand back a
// `token` field in the JSON body (only when the request's Origin is this
// app -- see appCorsHeaders in worker/index.js) that GL_AUTH stores and
// this file sends back as `Authorization: Bearer <token>` on every
// subsequent call. See worker/index.js's readSession for the matching
// bearer-header fallback.
window.GL_API = (function(){
  var BASE = 'https://gillylab.com';

  function request(path, opts){
    opts = opts || {};
    var headers = Object.assign({ 'Content-Type':'application/json' }, opts.headers || {});
    var token = window.GL_AUTH && window.GL_AUTH.token && window.GL_AUTH.token();
    if (token) headers['Authorization'] = 'Bearer ' + token;
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
    rankings: function(){ return request('/api/app/rankings'); },
    refresh: function(){ return request('/api/app/refresh'); },
    // Pick'em -- same JSON endpoints the website's own /pickem page calls
    // client-side, now CORS-enabled for the app's origin (see appCorsHeaders
    // in worker/index.js). Replaces the earlier iframe-the-live-page
    // approach, which turned out to be broken: the SameSite=Lax session
    // cookie never reaches a cross-origin iframe navigation (confirmed on a
    // real device, not just reasoned about). These are plain fetch() calls
    // instead, authenticated with the same bearer token as everything else.
    pickemCard: function(){ return request('/api/app/pickem-card'); },
    pickemName: function(){ return request('/api/pickem/name'); },
    pickemSetName: function(name){ return request('/api/pickem/name', { method:'POST', body:{ name:name } }); },
    pickemMine: function(eventSlug){ return request('/api/pickem/mine?event=' + encodeURIComponent(eventSlug)); },
    pickemSave: function(payload){ return request('/api/pickem/save', { method:'POST', body:payload }); },
    pickemLeaderboard: function(scope){ return request('/api/pickem/leaderboard?scope=' + encodeURIComponent(scope || 'all')); },
    pickemHistory: function(eventSlug){ return request('/api/pickem/history' + (eventSlug ? '?event=' + encodeURIComponent(eventSlug) : '')); },
    request: request,
    BASE: BASE,
  };
})();
