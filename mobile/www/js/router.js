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

  function setActiveTab(name){
    var tabs = tabbarEl.querySelectorAll('.gl-tab');
    for (var i=0;i<tabs.length;i++){
      tabs[i].classList.toggle('active', tabs[i].getAttribute('data-route') === name);
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
        go(btn.getAttribute('data-route'));
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

  return { register: register, go: go, back: back, init: init };
})();
