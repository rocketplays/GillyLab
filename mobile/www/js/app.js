document.addEventListener('DOMContentLoaded', function(){
  window.GL_NATIVE.init();
  window.GL_AUTH.ready.then(function(){
    window.GL_ROUTER.init();
    // Tab bar starts in the plain (non-premium) layout -- this swaps the
    // Account tab for More once the subscription check resolves, so a
    // premium user briefly sees Account before it flips to More rather
    // than blocking first paint on a network round-trip.
    window.GL_SUB.refresh();
  });
  window.GL_AUTH.onChange(function(){
    // Re-render whatever screen is up so login/logout is reflected
    // immediately (e.g. the lock screen on Pick'em swaps to the real one).
    var name = (location.hash || '#/home').replace(/^#\//, '').split('/')[0] || 'home';
    window.GL_ROUTER.go(name);
    // Plan can only be known once logged in, and logging out means it's
    // definitely not premium anymore -- re-check either way.
    window.GL_SUB.refresh();
  });
});
