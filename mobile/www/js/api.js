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

  // ── Response cache (stale-while-revalidate) ────────────────────────────
  // Screens used to refetch and flash "Loading…" on EVERY visit, even to data
  // that changes weekly (rankings, roster, fighter profiles). Public, read-only
  // GETs are now cached: inside `fresh` the cached copy is returned instantly
  // with no network call; past it (but inside `stale`) the cached copy is still
  // returned instantly and a silent background refetch updates the cache for
  // the next visit. Live or personal data (odds, bets, pick'em, account, push,
  // premium extras) is deliberately NOT listed and always hits the network.
  // The cache is cleared on login/logout (see app.js).
  var MIN = 60 * 1000, HOUR = 60 * MIN;
  var CACHE_RULES = [
    { prefix: '/api/app/rankings',         fresh: 10 * MIN, stale: 24 * HOUR },
    { prefix: '/api/app/roster',           fresh: 10 * MIN, stale: 24 * HOUR },
    { prefix: '/api/app/leaders',          fresh: 10 * MIN, stale: 24 * HOUR },
    { prefix: '/api/app/premium-features', fresh: 60 * MIN, stale: 24 * HOUR },
    { prefix: '/api/app/fighter?',         fresh: 5 * MIN,  stale: 24 * HOUR },
    { prefix: '/api/fighter-search',       fresh: 10 * MIN, stale: 24 * HOUR },
    // Events can go live / get results, so never serve this one stale.
    { prefix: '/api/app/matchup',          fresh: 45 * 1000, stale: 0, memoryOnly: true },
  ];
  var LS_PREFIX = 'glc1:';
  var mem = {};       // path -> { t, body (JSON string) }
  var inflight = {};  // path -> Promise (dedupes simultaneous identical GETs)

  function ruleFor(path){
    for (var i = 0; i < CACHE_RULES.length; i++){
      if (path.indexOf(CACHE_RULES[i].prefix) === 0) return CACHE_RULES[i];
    }
    return null;
  }
  function lsGet(k){ try { return JSON.parse(localStorage.getItem(LS_PREFIX + k) || 'null'); } catch(e){ return null; } }
  function lsSet(k, v){ try { localStorage.setItem(LS_PREFIX + k, JSON.stringify(v)); } catch(e){} }
  function lookup(path, rule){
    var hit = mem[path] || (rule.memoryOnly ? null : lsGet(path));
    if (!hit || !hit.body) return null;
    mem[path] = hit;
    var age = Date.now() - hit.t;
    if (age <= rule.fresh) return { body: hit.body, fresh: true };
    if (age <= rule.stale) return { body: hit.body, fresh: false };
    return null;
  }
  function store(path, rule, data){
    var body;
    try { body = JSON.stringify(data); } catch(e){ return; }
    var rec = { t: Date.now(), body: body };
    mem[path] = rec;
    if (!rule.memoryOnly && body.length < 600000) lsSet(path, rec);
  }
  function clearCache(){
    mem = {};
    try {
      var drop = [];
      for (var i = 0; i < localStorage.length; i++){ var k = localStorage.key(i); if (k && k.indexOf(LS_PREFIX) === 0) drop.push(k); }
      drop.forEach(function(k){ localStorage.removeItem(k); });
    } catch(e){}
  }

  function network(path, opts){
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

  function cachedNetwork(path, rule, opts){
    if (inflight[path]) return inflight[path];
    var p = network(path, opts).then(function(data){
      delete inflight[path];
      store(path, rule, data);
      return data;
    }, function(err){ delete inflight[path]; throw err; });
    inflight[path] = p;
    return p;
  }

  function request(path, opts){
    opts = opts || {};
    var isGet = (!opts.method || opts.method === 'GET') && !opts.body;
    var rule = isGet ? ruleFor(path) : null;
    if (!rule) return network(path, opts);
    var hit = opts.nocache ? null : lookup(path, rule);
    if (hit){
      // Stale hit: show it now, refresh quietly for next time.
      if (!hit.fresh) cachedNetwork(path, rule, opts).catch(function(){});
      return Promise.resolve(JSON.parse(hit.body));
    }
    return cachedNetwork(path, rule, opts);
  }

  // Fire-and-forget cache warm-up (never throws, never blocks).
  function prefetch(path){
    var rule = ruleFor(path);
    if (!rule) return;
    var hit = lookup(path, rule);
    if (hit && hit.fresh) return;
    cachedNetwork(path, rule, {}).catch(function(){});
  }

  return {
    login: function(email, password){ return request('/api/login', { method:'POST', body:{ email:email, password:password } }); },
    signup: function(email, password){ return request('/api/signup', { method:'POST', body:{ email:email, password:password } }); },
    // Forgot password -- same /api/reset/start the website's /forgot page
    // posts to, now CORS-attached for the app (see worker/index.js). The
    // app has no deep-linking set up (see capacitor.config.json), so the
    // emailed reset link is completed on the website in the system browser,
    // same as checkout/the billing portal already are -- there's no
    // resetComplete call here because the app never has the reset token,
    // only the website's own /reset?token=... page does. The user just logs
    // in normally afterward with the password they set there.
    resetStart: function(email){ return request('/api/reset/start', { method:'POST', body:{ email:email } }); },
    // Magic-link sign-in -- device-flow-shaped (see worker/index.js's
    // handleAppMagicStart for why): start() hands back a pollId, never the
    // real emailed token; poll() is called repeatedly with that pollId
    // until the emailed link has been tapped (status 'done', with a bearer
    // token to complete sign-in) or the request expires (status 'expired').
    magicStart: function(email){ return request('/api/app/magic/start', { method:'POST', body:{ email:email } }); },
    magicPoll: function(pollId){ return request('/api/app/magic/poll', { method:'POST', body:{ pollId:pollId } }); },
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
    // /api/app/notification-prefs. Both push and email categories are live:
    // push actually sends now (see registerPushToken below + worker's FCM
    // send pipeline wired into runLockReminders/runResultRecaps/
    // runBetResultPushes); email categories are read by the Pick'em
    // reminder/recap/missed-nudge cron jobs.
    notificationPrefs: function(){ return request('/api/app/notification-prefs'); },
    setNotificationPrefs: function(prefs){ return request('/api/app/notification-prefs', { method:'POST', body:prefs }); },
    // Push device-token registration -- see js/native.js's registerPush/
    // unregisterPush (fired off GL_AUTH's ready/onChange, not this screen)
    // and worker/index.js's /api/app/push-token. Token is the raw FCM/APNs
    // token string from the PushNotifications plugin's 'registration' event.
    registerPushToken: function(token){ return request('/api/app/push-token', { method:'POST', body:{ token:token } }); },
    unregisterPushToken: function(token){ return request('/api/app/push-token', { method:'DELETE', body:{ token:token } }); },
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
    prefetch: prefetch,
    clearCache: clearCache,
    BASE: BASE,
  };
})();
