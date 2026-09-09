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

  // The tab bar's actual buttons are rendered here (renderTabbar, below),
  // not hardcoded in index.html -- a premium account gets a COMPLETELY
  // different set of 6 direct tabs, not the free set plus one more slot.
  // Account isn't a tab at all, for free OR premium -- it lives in the
  // persistent top-right avatar menu (see index.html's #avatarBtn +
  // js/avatar-menu.js) instead of costing a tab slot for either plan.
  //
  // Free: Home, Events, Pick'em, Climb, Rankings, Roster -- unchanged from
  // before this restructure, just Card -> Events.
  // Premium: Home, Events, Simulator, Odds, Bet Tracker, Tape Study as the
  // 6 direct tabs, then a 7th, "More" (js/more-sheet.js's sheet), holding
  // Rankings/Roster/Pick'em/Climb -- those don't lose their tab-bar
  // reachability, they just move into the sheet to make room for the new
  // premium-only tools up front. Order/curation here is provisional -- to
  // be revisited once more premium features land.
  //
  // js/subscription.js calls setPremiumMode() once it knows the signed-in
  // account's plan; isPremium starts false so a free/logged-out visitor
  // (or the brief window before that check resolves) sees the free layout,
  // rendered immediately in init() below.
  var HOME_TAB = {
    route: 'home', label: 'Home',
    icon: '<svg viewBox="0 0 24 24" class="gl-tab-icon"><path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1v-8.5Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  };
  // A boxing glove, drawn vertically like the 🥊 emoji simplified to a
  // straight up-down axis: rounded fist/head on top, tapered wrist cuff at
  // the bottom with a wrap-band line.
  var EVENTS_TAB = {
    route: 'matchup', label: 'Events',
    icon: '<svg viewBox="0 0 24 24" class="gl-tab-icon"><path d="M8 12V8.2a4 4 0 0 1 8 0V12a2.6 2.6 0 0 1-1 2.05V15a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-.95A2.6 2.6 0 0 1 8 12Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9.5 16.5h5a1.5 1.5 0 0 1 1.5 1.5v.5a2.5 2.5 0 0 1-2.5 2.5h-3A2.5 2.5 0 0 1 8 18.5V18a1.5 1.5 0 0 1 1.5-1.5Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8.3 18.6h7.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  };
  // A checkmark badge -- reads as "your pick/confirmed".
  var PICKEM_TAB = {
    route: 'pickem', label: "Pick'em",
    icon: '<svg viewBox="0 0 24 24" class="gl-tab-icon"><circle cx="12" cy="12" r="8.3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8.3 12.4l2.5 2.5 5-5.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };
  var CLIMB_TAB = {
    route: 'climb', label: 'Climb',
    icon: '<svg viewBox="0 0 24 24" class="gl-tab-icon"><path d="M3 20h4l3-6 3 4 3-9 3 11h2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  };
  var RANKINGS_TAB = {
    route: 'rankings', label: 'Rankings',
    icon: '<svg viewBox="0 0 24 24" class="gl-tab-icon"><path d="M5 20V10M12 20V4M19 20v-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  };
  var ROSTER_TAB = {
    route: 'roster', label: 'Roster',
    icon: '<svg viewBox="0 0 24 24" class="gl-tab-icon"><circle cx="12" cy="7" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="5.5" cy="9" r="2.3" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="18.5" cy="9" r="2.3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M4 19c.7-3 2.8-4.6 5.2-4.9M20 19c-.7-3-2.8-4.6-5.2-4.9M8.5 19.5c.6-3.2 1.9-4.9 3.5-4.9s2.9 1.7 3.5 4.9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  };
  // Circle + play triangle -- same icon more-sheet.js used for this when it
  // was a "More" sheet entry rather than its own direct tab.
  var SIMULATOR_TAB = {
    route: 'simulator', label: 'Simulator',
    icon: '<svg viewBox="0 0 24 24" class="gl-tab-icon"><circle cx="12" cy="12" r="8.3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10 8.7v6.6l5.5-3.3z" fill="currentColor"/></svg>',
  };
  // A percent sign -- odds are a probability, not a ledger or a chart.
  var ODDS_TAB = {
    route: 'odds', label: 'Odds',
    icon: '<svg viewBox="0 0 24 24" class="gl-tab-icon"><circle cx="7" cy="7" r="2.3" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="17" cy="17" r="2.3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M18 6 6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  };
  // A notepad/ledger with checklist lines -- tracking placed bets.
  var BETTRACKER_TAB = {
    route: 'bettracker', label: 'Bet Tracker',
    icon: '<svg viewBox="0 0 24 24" class="gl-tab-icon"><rect x="5" y="3.5" width="14" height="17" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8.3 9h7.4M8.3 12.5h7.4M8.3 16h4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  };
  // A video-player frame with a play triangle -- distinct from Simulator's
  // circular play button, reads as "watch/study film".
  var TAPESTUDY_TAB = {
    route: 'tapestudy', label: 'Tape Study',
    icon: '<svg viewBox="0 0 24 24" class="gl-tab-icon"><rect x="4" y="5.5" width="16" height="13" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10.3 9.3v6l5-3z" fill="currentColor"/></svg>',
  };
  var MORE_TAB = {
    route: 'more', label: 'More',
    icon: '<svg viewBox="0 0 24 24" class="gl-tab-icon"><circle cx="5" cy="12" r="1.8" fill="currentColor"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><circle cx="19" cy="12" r="1.8" fill="currentColor"/></svg>',
  };
  var FREE_TABS = [HOME_TAB, EVENTS_TAB, PICKEM_TAB, CLIMB_TAB, RANKINGS_TAB, ROSTER_TAB];
  var PREMIUM_TABS = [HOME_TAB, EVENTS_TAB, SIMULATOR_TAB, ODDS_TAB, BETTRACKER_TAB, TAPESTUDY_TAB];
  var isPremium = false;

  function renderTabbar(){
    var direct = isPremium ? PREMIUM_TABS : FREE_TABS;
    var tabs = isPremium ? direct.concat([MORE_TAB]) : direct;
    tabbarEl.innerHTML = tabs.map(function(t){
      return (
        '<button class="gl-tab" data-route="' + t.route + '" aria-label="' + t.label + '">' +
          t.icon +
          '<span>' + t.label + '</span>' +
        '</button>'
      );
    }).join('');
  }

  function setPremiumMode(premium){
    premium = !!premium;
    var changed = premium !== isPremium;
    isPremium = premium;
    if (changed) renderTabbar();
    // Re-apply so a screen already showing gets re-highlighted on the tab
    // that's now actually visible. A screen with no `tab` of its own (e.g.
    // a pushed fighter profile, or Account/Settings now that they're not
    // tab-bar destinations) has nothing to re-target -- leave the bar as it
    // is, same as go() would.
    if (current && screens[current] && screens[current].tab) setActiveTab(screens[current].tab);
  }

  function setActiveTab(name){
    var direct = isPremium ? PREMIUM_TABS : FREE_TABS;
    var isDirect = direct.some(function(t){ return t.route === name; });
    // A route with no direct button in the CURRENT mode's tab set (e.g.
    // Rankings/Roster/Pick'em/Climb for a premium account, now reached only
    // via the More sheet) has nothing of its own to highlight; for premium
    // it collapses onto "more" instead, same as Simulator used to before it
    // got its own direct tab. For free mode there's no More button to
    // collapse onto, so this just leaves the bar as it was (shouldn't
    // normally happen -- every free-reachable screen has a direct free tab).
    var target = isDirect ? name : (isPremium ? 'more' : null);
    if (target == null) return;
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

    // Render the free layout immediately (matches isPremium's default), then
    // wire clicks via delegation on the bar itself rather than per-button --
    // setPremiumMode() replaces the buttons wholesale via renderTabbar(), so
    // listeners bound to the old button elements would otherwise be lost the
    // moment a premium account's plan comes back from subscription.js.
    renderTabbar();
    tabbarEl.addEventListener('click', function(e){
      var btn = e.target.closest('.gl-tab');
      if (!btn) return;
      window.GL_NATIVE.tap();
      var route = btn.getAttribute('data-route');
      // "More" isn't a real screen -- there's nothing to register() or
      // go() to. It opens/closes a sheet instead (see more-sheet.js).
      if (route === 'more'){ window.GL_MORE.toggle(); return; }
      go(route);
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
