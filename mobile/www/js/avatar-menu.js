// Persistent top-right account entry point -- see index.html's #avatarBtn/
// #avatarMenu (fixed-position siblings of #appScroll, so they're on every
// screen and never get wiped by a screen's own innerHTML replacement of
// #app) and the tab-bar comment in index.html for why Account moved out
// of the bottom tab bar entirely. A small dropdown, not a bottom sheet like
// js/more-sheet.js's -- three short menu items don't need a sheet, and a
// dropdown anchored under the button is the more familiar pattern for an
// account/settings/sign-out menu specifically.
window.GL_AVATAR_MENU = (function(){
  var btn, menu, wired = false, isOpen = false;

  function open(){
    if (isOpen) return;
    isOpen = true;
    menu.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    // Deferred so the click that opened the menu doesn't also trigger the
    // document-level listener below and close it again immediately.
    setTimeout(function(){ document.addEventListener('click', onOutsideClick); }, 0);
  }

  function close(){
    if (!isOpen) return;
    isOpen = false;
    menu.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', onOutsideClick);
  }

  function onOutsideClick(e){
    if (menu.contains(e.target) || btn.contains(e.target)) return;
    close();
  }

  function toggle(){ if (isOpen) close(); else open(); }

  function wire(){
    if (wired) return;
    wired = true;
    btn = document.getElementById('avatarBtn');
    menu = document.getElementById('avatarMenu');
    btn.addEventListener('click', function(){
      window.GL_NATIVE.tap();
      toggle();
    });
    menu.addEventListener('click', function(e){
      var item = e.target.closest('[data-avatar-action]');
      if (!item) return;
      window.GL_NATIVE.tap();
      close();
      var action = item.getAttribute('data-avatar-action');
      if (action === 'account'){
        window.GL_ROUTER.go('account');
      } else if (action === 'settings'){
        window.GL_ROUTER.go('settings');
      } else if (action === 'signout'){
        window.GL_AUTH.logout().then(function(){ window.GL_ROUTER.go('home'); });
      }
    });
  }

  return { init: function(){ wire(); } };
})();
