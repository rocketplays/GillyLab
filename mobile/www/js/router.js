// Minimal hash-based client-side router. The whole point of building the
// app's screens as a real SPA (per the architecture decision) is that
// switching screens never does a full page load -- no browser-style white
// flash, no lost scroll-position jank. Route changes just swap the content
// of #app and update the tab bar / inline back button to match. There's no
// fixed top bar -- see index.html/app.css.
window.GL_ROUTER = (function(){
  var screens = {};       // routeName -> { title, render(container, params), tab }
  var current = null;
  var previous = null;    // last DIFFERENT route, for back() -- see fighter.js
  var appEl, appScrollEl, backBtn, tabbarEl;
  // go() writes location.hash itself (so the URL reflects the current
  // screen), but a hash write fires the browser's own 'hashchange' event --
  // which the router also listens for, to handle back/forward and direct
  // hash navigation. Without this flag, every go(name, params) call
  // re-triggered itself a moment later via that event, through fromHash(),
  // which only ever knows the bare route name and has no way to recover
  // `params` (e.g. a fighter's slug) from the hash. That second, param-less
  // render started a second load with an undefined slug, which failed fast
  // and briefly showed a "check your connection" error right before the
  // FIRST (correct) request finished and overwrote it -- the "red error
  // flashes then disappears" bug. Set right before a hash write that we
  // triggered ourselves, so the resulting 'hashchange' is ignored once.
  var ignoreNextHashChange = false;

  function register(name, screen){ screens[name] = screen; }

  // Free users get 6 direct tabs (Home/Card/Pick'em/Climb/Rankings/Roster);
  // Account isn't one of them any more -- it lives in the persistent
  // top-right avatar menu (see index.html's #avatarBtn + js/avatar-menu.js)
  // instead of costing a tab slot for either plan. Premium accounts get a
  // 7th slot, "more" (js/more-sheet.js's sheet), for tools that don't
  // warrant their own bar button yet (Fight Simulator today).
  // js/subscription.js calls setPremiumMode() once it knows the signed-in
  // account's plan; isPremium starts false so a free/logged-out visitor
  // (or the brief window before that check resolves) sees the plain
  // 6-tab layout, matching the free-user layout exactly.
  var PREMIUM_ONLY_ROUTES = ['simulator'];
  var isPremium = false;

  function setPremiumMode(premium){
    isPremium = !!premium;
    var moreBtn = tabbarEl.querySelector('[data-route="more"]');
    if (moreBtn) moreBtn.hidden = !isPremium;
    // Re-apply so a screen already showing gets re-highlighted on the tab
    // that's now actually visible. A screen with no `tab` of its own (e.g.
    // a pushed fighter profile, or Account/Settings now that they're not
    // tab-bar destinations) has nothing to re-target -- leave the bar as it
    // is, same as go() would.
    if (current && screens[current] && screens[current].tab) setActiveTab(screens[current].tab);
  }

  function setActiveTab(name){
    var target = name;
    // Premium-only routes (just "simulator" so far) have no button of their
    // own for a free user (the screen shows its own locked/upsell state
    // instead), so there's nothing to highlight; for premium, it collapses
    // onto "more".
    if (PREMIUM_ONLY_ROUTES.indexOf(name) !== -1){
      if (!isPremium) return; // leave the bar exactly as it was
      target = 'more';
    }
    var tabs = tabbarEl.querySelectorAll('.gl-tab');
    for (var i=0;i<tabs.length;i++){
      tabs[i].classList.toggle('active', tabs[i].getAttribute('data-route') === target);
    }
  }

  function go(name, params){
    var screen = screens[name];
    if (!screen){ console.error('GL_ROUTER: unknown route', name); return; }
    if (current && current !== name) previous = current;
    current = name;
    var newHash = '#/' + name;
    // Only when the hash is actually changing -- if it's already what we
    // want (e.g. re-opening a different fighter while the hash is still
    // "#/fighter"), no hashchange fires at all, so setting the flag here
    // unconditionally would wrongly swallow the NEXT real one (a manual
    // hash edit or a back/forward gesture).
    if (location.hash !== newHash){
      ignoreNextHashChange = true;
      location.hash = newHash;
    }
    // No fixed top bar -- the back button is plain scrolling content at the
    // top of the page (see .gl-back-inline / index.html), same as it works
    // on the premium in-app SPA.
    backBtn.hidden = !screen.showBack;
    // A screen with no `tab` of its own (e.g. a fighter profile pushed from
    // Roster/Matchup/Rankings) leaves the tab bar exactly as it was --
    // otherwise every tab would go dark the moment you tapped into a
    // profile, since no tab button matches a route name like "fighter".
    if (screen.tab) setActiveTab(screen.tab);
    // Reset per-screen modifier classes (e.g. fullbleed) before the next
    // screen renders, so nothing leaks from whichever screen was up before.
    // The centered brand mark (see .gl-page-brand / index.html) lives on
    // appScrollEl, a sibling of appEl -- so it's untouched by a screen's own
    // full innerHTML replacement of appEl and scrolls away with the rest of
    // the page instead of sitting fixed like the top bar.
    appScrollEl.className = 'gl-app' + (screen.fullbleed ? ' gl-app--fullbleed' : '');
    appEl.innerHTML = '';
    appScrollEl.scrollTop = 0;
    screen.render(appEl, params || {});
  }

  // Real "go back to wherever this screen was pushed from" -- used by the
  // back button so a fighter profile opened from Matchup returns to
  // Matchup, one opened from Roster returns to Roster, etc., rather than
  // always dumping the visitor back on Home. Mirrors the website itself:
  // clicking a fighter is a full page navigation with a real back button,
  // not a panel layered over the page you were on.
  function back(){ go(previous || 'home'); }

  function fromHash(){
    var name = (location.hash || '#/home').replace(/^#\//, '') || 'home';
    var base = name.split('/')[0];
    if (!screens[base]) base = 'home';
    go(base);
  }

  function init(){
    appScrollEl = document.getElementById('appScroll');
    appEl = document.getElementById('app');
    backBtn = document.getElementById('pageBackBtn');
    tabbarEl = document.getElementById('tabbar');

    tabbarEl.querySelectorAll('.gl-tab').forEach(function(btn){
      btn.addEventListener('click', function(){
        window.GL_NATIVE.tap();
        var route = btn.getAttribute('data-route');
        // "More" isn't a real screen -- there's nothing to register() or
        // go() to. It opens/closes a sheet instead (see more-sheet.js).
        if (route === 'more'){ window.GL_MORE.toggle(); return; }
        go(route);
      });
    });
    backBtn.addEventListener('click', function(){
      window.GL_NATIVE.tap();
      back();
    });
    window.addEventListener('hashchange', function(){
      if (ignoreNextHashChange){ ignoreNextHashChange = false; return; }
      fromHash();
    });
    fromHash();
  }

  return { register: register, go: go, back: back, init: init, current: function(){ return current; }, setPremiumMode: setPremiumMode };
})();
