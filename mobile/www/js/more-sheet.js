// The tab bar's "More" overflow -- PREMIUM ONLY, the 7th tab slot for a
// premium account (see index.html's tab-bar comment / router.js's
// PREMIUM_TABS). Premium's direct 6 tabs are Home/Events/Simulator/Odds/
// Bet Tracker/Tape Study, so this sheet holds the rest -- Rankings, Roster,
// Pick'em, Climb -- rather than Fight Simulator, which moved out to become
// a direct tab of its own. None of these four are premium-GATED content
// (they're the same free-tier screens everyone gets), so `premium: false`
// on each -- no "Premium" badge, they're just relocated here to make room
// up front for the new premium-only tools. Account lives in the persistent
// top-right avatar menu now (see js/avatar-menu.js), not in here.
// A bottom sheet (slides up from behind the tab bar), not the site-borrowed
// centered #mh-box dialog matchup.js's Deep Dive modal uses -- that CSS is
// the SITE's own injected stylesheet (worker/matchup-free.js's hubCss) and
// has no bottom-sheet variant to reuse, so this is new, app-native CSS (see
// app.css's .more-* rules) built the same way the rest of the app's own
// screens are, with the overlay/scroll-lock/open-close ANIMATION mechanics
// borrowed from matchup.js's hubOpen/hubClose/hubLockScroll.
window.GL_MORE = (function(){
  // Order here is the order these items appear in the sheet -- this
  // curation is provisional, to be revisited once more premium features
  // land. Icons are the same ones these routes used as direct tabs before
  // this restructure (see router.js's now-unused-for-premium RANKINGS_TAB/
  // ROSTER_TAB/PICKEM_TAB/CLIMB_TAB icons -- kept in sync by hand since
  // they're small, static strings, not worth sharing a module for).
  var FEATURE_ITEMS = [
    {
      route: 'rankings', label: 'Rankings', premium: false,
      icon: '<svg viewBox="0 0 24 24" class="more-item-icon"><path d="M5 20V10M12 20V4M19 20v-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    },
    {
      route: 'roster', label: 'Roster', premium: false,
      icon: '<svg viewBox="0 0 24 24" class="more-item-icon"><circle cx="12" cy="7" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="5.5" cy="9" r="2.3" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="18.5" cy="9" r="2.3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M4 19c.7-3 2.8-4.6 5.2-4.9M20 19c-.7-3-2.8-4.6-5.2-4.9M8.5 19.5c.6-3.2 1.9-4.9 3.5-4.9s2.9 1.7 3.5 4.9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    },
    {
      route: 'pickem', label: "Pick'em", premium: false,
      icon: '<svg viewBox="0 0 24 24" class="more-item-icon"><circle cx="12" cy="12" r="8.3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8.3 12.4l2.5 2.5 5-5.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    },
    {
      route: 'climb', label: 'The Climb', premium: false,
      icon: '<svg viewBox="0 0 24 24" class="more-item-icon"><path d="M3 20h4l3-6 3 4 3-9 3 11h2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></svg>',
    },
  ];

  var overlay, sheet, list, scrollY = 0, wired = false, isOpen = false;

  function render(activeRoute){
    var items = FEATURE_ITEMS;
    list.innerHTML = items.map(function(it){
      return (
        '<button type="button" class="more-item' + (it.route === activeRoute ? ' active' : '') + '" data-route="' + it.route + '">' +
          it.icon +
          '<span class="more-item-label">' + it.label + '</span>' +
          (it.premium ? '<span class="more-item-badge">Premium</span>' : '') +
        '</button>'
      );
    }).join('');
  }

  // Same iOS-Safari-ignores-body-overflow fix as matchup.js's
  // hubLockScroll/hubUnlockScroll -- pin #appScroll itself, not <body>.
  function lockScroll(){
    var scroller = document.getElementById('appScroll');
    if (!scroller) return;
    scrollY = scroller.scrollTop || 0;
    scroller.style.overflow = 'hidden';
  }
  function unlockScroll(){
    var scroller = document.getElementById('appScroll');
    if (!scroller) return;
    scroller.style.overflow = '';
    scroller.scrollTop = scrollY;
  }

  function open(){
    if (isOpen) return;
    isOpen = true;
    // Highlight whichever of these four screens is currently showing, if
    // any -- e.g. reopening More while already on Rankings shows Rankings
    // as selected rather than nothing.
    render(window.GL_ROUTER.current());
    overlay.hidden = false;
    sheet.hidden = false;
    lockScroll();
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){
        overlay.classList.add('on');
        sheet.classList.add('on');
      });
    });
  }

  function close(){
    if (!isOpen) return;
    isOpen = false;
    overlay.classList.remove('on');
    sheet.classList.remove('on');
    unlockScroll();
    setTimeout(function(){
      overlay.hidden = true;
      sheet.hidden = true;
    }, 220);
  }

  function toggle(){ if (isOpen) close(); else open(); }

  function wire(){
    if (wired) return;
    wired = true;
    overlay = document.getElementById('moreOverlay');
    sheet = document.getElementById('moreSheet');
    list = document.getElementById('moreSheetList');
    overlay.addEventListener('click', function(){ window.GL_NATIVE.tap(); close(); });
    list.addEventListener('click', function(e){
      var btn = e.target.closest('[data-route]');
      if (!btn) return;
      window.GL_NATIVE.tap();
      close();
      window.GL_ROUTER.go(btn.getAttribute('data-route'));
    });
  }

  // Wired lazily on first use rather than at script-load time, same reason
  // router.js's own init() waits for DOMContentLoaded via app.js -- the
  // #moreOverlay/#moreSheet elements need to already exist in the DOM.
  function ensureWired(){ if (!wired) wire(); }

  return {
    toggle: function(){ ensureWired(); toggle(); },
    open: function(){ ensureWired(); open(); },
    close: function(){ ensureWired(); close(); },
  };
})();
