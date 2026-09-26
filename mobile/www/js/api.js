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
    rankings: function(source){ return request('/api/app/rankings' + (source ? '?source=' + encodeURIComponent(source) : '')); },
    leaders: function(){ return request('/api/app/leaders'); },
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
    pickemPlayer: function(name){ return request('/api/pickem/player?name=' + encodeURIComponent(name)); },
    // Roster / Matchup / Fighter profile -- free pages on the website, no
    // session required. See worker/index.js's /api/app/roster, /api/app/matchup,
    // /api/app/fighter.
    roster: function(){ return request('/api/app/roster'); },
    matchup: function(eventSlug){ return request('/api/app/matchup' + (eventSlug ? '?event=' + encodeURIComponent(eventSlug) : '')); },
    fighter: function(slug){ return request('/api/app/fighter?slug=' + encodeURIComponent(slug)); },
    // Career Accolades + Tape Study -- Premium-only (see worker/index.js's
    // /api/app/fighter-extras). Rejects with a 401/403 for a logged-out or
    // non-subscribed caller; fighter.js treats that as "show the locked state".
    fighterExtras: function(slug){ return request('/api/app/fighter-extras?slug=' + encodeURIComponent(slug)); },
    // Fight Simulator -- Premium-only (see worker/index.js's /api/app/fight-sim).
    // nameA/nameB are fighter NAMES (as returned by fighterSearch below), not
    // slugs. rounds is 3 or 5.
    fightSim: function(nameA, nameB, rounds){
      return request('/api/app/fight-sim?a=' + encodeURIComponent(nameA) + '&b=' + encodeURIComponent(nameB) + '&rounds=' + (rounds === 5 ? 5 : 3));
    },
    // "Build Your Own Simulation" -- the one data fetch the custom-weighting
    // modal needs (see worker/index.js's /api/app/custom-sim-base +
    // worker/fight-sim.js's customSimBase/customSimMethodBaseline). Called
    // once when the modal opens; every slider drag after that is pure
    // client-side math in simulator.js, no further requests.
    customSimBase: function(nameA, nameB, rounds){
      return request('/api/app/custom-sim-base?a=' + encodeURIComponent(nameA) + '&b=' + encodeURIComponent(nameB) + '&rounds=' + (rounds === 5 ? 5 : 3));
    },
    // Matchup Analytics Deep Dive for an arbitrary fighter pair -- Premium-only
    // (see worker/index.js's /api/app/deep-dive-fight). Only called for a
    // fight matchup.js already knows has data (the `dd` flag on each fight
    // from matchup()/fighterSearch above), never speculatively.
    deepDiveFight: function(nameA, nameB){
      return request('/api/app/deep-dive-fight?a=' + encodeURIComponent(nameA) + '&b=' + encodeURIComponent(nameB));
    },
    fighterSearch: function(q){ return request('/api/fighter-search?q=' + encodeURIComponent(q)); },
    // The site's own /subscribe feature-tile carousel (CSS/markup/script,
    // already premium-only), reused as-is for Go Premium -- see
    // worker/index.js's /api/app/premium-features and premium.js.
    premiumFeatures: function(){ return request('/api/app/premium-features'); },
    // Home dashboard's Bet Tracker teaser -- top 3 of the real units
    // leaderboard (see worker/index.js's /api/app/bettracker-preview).
    bettrackerPreview: function(){ return request('/api/app/bettracker-preview'); },
    // Account screen -- see worker/index.js's /api/app/account,
    // /api/change-password, /api/delete-account.
    account: function(){ return request('/api/app/account'); },
    changePassword: function(current, password){ return request('/api/change-password', { method:'POST', body:{ current:current, password:password } }); },
    deleteAccount: function(){ return request('/api/delete-account', { method:'POST' }); },
    // Settings screen notification preferences -- see worker/index.js's
    // /api/app/notification-prefs. Push categories persist now with no send
    // pipeline behind them yet (no native push plugin/device-token
    // registration in this app); email categories are live, read by the
    // Pick'em reminder/recap/missed-nudge cron jobs.
    notificationPrefs: function(){ return request('/api/app/notification-prefs'); },
    setNotificationPrefs: function(prefs){ return request('/api/app/notification-prefs', { method:'POST', body:prefs }); },
    // App -> web SSO handoff (see worker/index.js's handleAppWebHandoff) --
    // any button that opens an authenticated site page (Manage Subscription,
    // Go Premium checkout) should ask for a handoff URL and open THAT, not
    // the raw destination -- the external browser Browser.open() launches
    // shares none of the app's own session (a separate origin/context
    // entirely), so a raw link there is always logged out.
    webHandoff: function(next){ return request('/api/app/web-handoff?next=' + encodeURIComponent(next)); },
    // Odds & Projections -- Premium-only (see worker/index.js's /api/app/odds).
    // Returns the featured odds event's matched fights, each with moneyline/
    // totals/method/doubleChance/roundProps/lineMovement + a no-vig `noVig`
    // win-probability pair for the Projections view. No params -- same "the
    // page always shows the current odds event" behavior as the website.
    odds: function(){ return request('/api/app/odds'); },
    // Bet Tracker & CLV -- Premium-only. bets() is the ONE app-only route
    // (see worker/index.js's /api/app/bets): it returns the signed-in
    // user's bets already graded read-only (status/CLV/profit computed
    // server-side from the same grader the leaderboard/player routes use),
    // so the app never has to port index.html's client-side btDeriveAll.
    // Every other call below hits the SAME /api/bets/* paths the website's
    // own Bet Tracker uses -- now CORS-attached for the app's origin, no
    // separate /api/app/* route needed for a plain mutation or the board.
    bets: function(){ return request('/api/app/bets'); },
    betFights: function(){ return request('/api/app/bets/fights'); },
    betAdd: function(body){ return request('/api/bets', { method: 'POST', body: body }); },
    // Screenshot bet reader -- one image in, one draft out (see
    // worker/index.js's handleBetsScan). Never saves anything itself; the
    // caller reviews the draft and posts through betAdd, same as any other
    // bet. image is a base64 string with no data: prefix.
    betScan: function(image, mediaType){ return request('/api/bets/scan', { method: 'POST', body: { image: image, mediaType: mediaType || 'image/jpeg' } }); },
    betEdit: function(id, odds, stake, book){ return request('/api/bets/edit', { method: 'POST', body: { id: id, odds: odds, stake: stake, book: book } }); },
    betDelete: function(id){ return request('/api/bets/delete', { method: 'POST', body: { id: id } }); },
    betSettle: function(id, status){ return request('/api/bets/settle', { method: 'POST', body: { id: id, status: status } }); },
    betLeaderboard: function(tab, range){ return request('/api/bets/leaderboard?tab=' + encodeURIComponent(tab || 'units') + '&range=' + encodeURIComponent(range || 'all')); },
    betPlayer: function(name){ return request('/api/bets/player?name=' + encodeURIComponent(name)); },
    // Legends Bracket -- free, login required (see worker/index.js's
    // pickemSession-gated /api/bracket/* routes). bracketCurrent() is safe to
    // call logged out too (it just comes back with loggedIn:false/no mine/
    // real), matching how the site's own /bracket page behaves before the
    // login-required route redirect was added there -- kept lenient here in
    // case a future app entry point wants a read-only peek.
    bracketCurrent: function(){ return request('/api/bracket/current'); },
    bracketSubmit: function(picks){ return request('/api/bracket/submit', { method: 'POST', body: { picks: picks } }); },
    bracketLeaderboard: function(scope){ return request('/api/bracket/leaderboard?scope=' + encodeURIComponent(scope || 'week')); },
    request: request,
    BASE: BASE,
  };
})();
