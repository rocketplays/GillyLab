// Native-feeling replacement for the browser's own alert()/confirm() --
// those render as a plain WebView-chrome dialog (no app styling at all,
// and confirm()'s synchronous blocking call is itself deprecated in modern
// WebViews), which was bettracker.js's only real departure from the rest of
// this app's own toast/dialog conventions (see odds.js's plToast for the
// other half of that pattern -- transient, non-blocking messages; this is
// for anything that needs a tap to dismiss or a yes/no decision).
//
// A single overlay+box pair, created lazily and reused across calls/screens
// (appended straight to <body>, not scoped to any one screen's container,
// since a screen's own innerHTML gets wiped on every navigation -- see
// router.js's `pageEl` comment) rather than one per screen the way
// odds.js's toast is. Both methods return a Promise so a caller can await
// the outcome exactly where confirm()'s return value used to sit.
window.GL_DIALOG = (function(){
  var overlay = null, box = null, titleEl = null, msgEl = null, actionsEl = null;
  var scroller = null, scrollY = 0;

  function ensure(){
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.className = 'gl-confirm-overlay';
    overlay.hidden = true;
    box = document.createElement('div');
    box.className = 'gl-confirm-box';
    box.hidden = true;
    box.setAttribute('role', 'alertdialog');
    box.setAttribute('aria-modal', 'true');
    box.innerHTML =
      '<div class="gl-confirm-title" id="glConfirmTitle" hidden></div>' +
      '<div class="gl-confirm-msg" id="glConfirmMsg"></div>' +
      '<div class="gl-confirm-actions" id="glConfirmActions"></div>';
    document.body.appendChild(overlay);
    document.body.appendChild(box);
    titleEl = box.querySelector('#glConfirmTitle');
    msgEl = box.querySelector('#glConfirmMsg');
    actionsEl = box.querySelector('#glConfirmActions');
  }

  // Same iOS-Safari-ignores-body-overflow fix used throughout this app
  // (more-sheet.js/matchup.js/fighter.js) -- pin #appScroll itself.
  function lockScroll(){
    scroller = document.getElementById('appScroll');
    if (!scroller) return;
    scrollY = scroller.scrollTop || 0;
    scroller.style.overflow = 'hidden';
  }
  function unlockScroll(){
    if (!scroller) return;
    scroller.style.overflow = '';
    scroller.scrollTop = scrollY;
    scroller = null;
  }

  function open(title, message, buttons){
    ensure();
    if (title){ titleEl.textContent = title; titleEl.hidden = false; } else titleEl.hidden = true;
    msgEl.textContent = message;
    actionsEl.innerHTML = '';
    overlay.hidden = false;
    box.hidden = false;
    lockScroll();
    return new Promise(function(resolve){
      function close(value){
        overlay.hidden = true;
        box.hidden = true;
        unlockScroll();
        resolve(value);
      }
      buttons.forEach(function(b){
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'gl-btn ' + (b.primary ? 'gl-btn-primary' : 'gl-btn-outline') + (b.destructive ? ' gl-confirm-destructive' : '');
        btn.textContent = b.label;
        btn.addEventListener('click', function(){ window.GL_NATIVE.tap(); close(b.value); });
        actionsEl.appendChild(btn);
      });
      // Tapping the dimmed backdrop reads as "never mind" -- same outcome as
      // a confirm()'s Cancel, and a no-op (re-resolves nothing further) for
      // a plain alert() with only one button.
      overlay.onclick = function(){ close(buttons.length > 1 ? false : buttons[0].value); };
    });
  }

  return {
    // Resolves once dismissed -- nothing to branch on, mirrors alert()'s
    // own "just continues after" shape for every existing call site.
    alert: function(message, opts){
      opts = opts || {};
      return open(opts.title || '', message, [{ label: opts.okLabel || 'OK', primary: true, value: true }]);
    },
    // Resolves true/false -- mirrors confirm()'s return value, just async.
    confirm: function(message, opts){
      opts = opts || {};
      var destructive = !!opts.destructive;
      return open(opts.title || '', message, [
        { label: opts.cancelLabel || 'Cancel', primary: false, value: false },
        { label: opts.confirmLabel || 'OK', primary: !destructive, destructive: destructive, value: true },
      ]);
    },
  };
})();
