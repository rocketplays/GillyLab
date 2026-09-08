// The tab bar's "More" overflow -- see index.html's tab-bar comment for why
// Rankings/Climb/Account/Simulator live here instead of their own buttons.
// A bottom sheet (slides up from behind the tab bar), not the site-borrowed
// centered #mh-box dialog matchup.js's Deep Dive modal uses -- that CSS is
// the SITE's own injected stylesheet (worker/matchup-free.js's hubCss) and
// has no bottom-sheet variant to reuse, so this is new, app-native CSS (see
// app.css's .more-* rules) built the same way the rest of the app's own
// screens are, with the overlay/scroll-lock/open-close ANIMATION mechanics
// borrowed from matchup.js's hubOpen/hubClose/hubLockScroll.
window.GL_MORE = (function(){
  // Order here is the order they appear in the sheet. Changing which items
  // are "direct" tabs vs "in More" is just editing this array plus the
  // static buttons in index.html -- nothing else to touch.
  var ITEMS = [
    {
      route: 'rankings', label: 'Rankings',
      icon: '<svg viewBox="0 0 24 24" class="more-item-icon"><path d="M5 20V10M12 20V4M19 20v-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    },
    {
      route: 'climb', label: 'The Climb',
      icon: '<svg viewBox="0 0 24 24" class="more-item-icon"><path d="M3 20h4l3-6 3 4 3-9 3 11h2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></svg>',
    },
    {
      route: 'simulator', label: 'Fight Simulator', premium: true,
      icon: '<svg viewBox="0 0 24 24" class="more-item-icon"><circle cx="12" cy="12" r="8.3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10 8.7v6.6l5.5-3.3z" fill="currentColor"/></svg>',
    },
    {
      route: 'account', label: 'Account',
      icon: '<svg viewBox="0 0 24 24" class="more-item-icon"><circle cx="12" cy="8" r="3.4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4.5 20c1.2-4 4-6 7.5-6s6.3 2 7.5 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    },
  ];

  var overlay, sheet, list, scrollY = 0, wired = false, isOpen = false;

  function render(activeRoute){
    list.innerHTML = ITEMS.map(function(it){
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
