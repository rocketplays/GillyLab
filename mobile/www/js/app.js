document.addEventListener('DOMContentLoaded', function(){
  window.GL_NATIVE.init();
  window.GL_AUTH.ready.then(function(){
    window.GL_ROUTER.init();
    window.GL_AVATAR_MENU.init();
    // Tab bar starts in the plain (non-premium) layout -- this swaps the
    // Account tab for More once the subscription check resolves, so a
    // premium user briefly sees Account before it flips to More rather
    // than blocking first paint on a network round-trip.
    window.GL_SUB.refresh();
    // Warm the cache for the screens people open first so their first tap is
    // instant (see the response cache in api.js). Deferred so it never competes
    // with first paint.
    setTimeout(function(){
      var A = window.GL_API;
      ['/api/app/rankings?source=media', '/api/app/roster', '/api/app/matchup', '/api/app/leaders'].forEach(function(p){ A.prefetch(p); });
    }, 600);
  });
  // Start loading a fighter profile the instant a name is touched, so the data is
  // usually already in the cache by the time the tap completes.
  document.addEventListener('touchstart', function(e){
    var el = e.target.closest && e.target.closest('[data-slug],[data-chg-slug]');
    if (!el) return;
    var slug = el.getAttribute('data-slug') || el.getAttribute('data-chg-slug');
    if (!slug || !/^[a-z0-9-]+$/.test(slug)) return;
    window.GL_API.prefetch('/api/app/fighter?slug=' + encodeURIComponent(slug));
    window.GL_API.prefetch('/api/app/fighter-extras?slug=' + encodeURIComponent(slug));
  }, { passive: true });
  window.GL_AUTH.onChange(function(){
    // Cached responses may differ by plan/account -- start clean.
    window.GL_API.clearCache();
    // Re-render whatever screen is up so login/logout is reflected
    // immediately (e.g. the lock screen on Pick'em swaps to the real one).
    var name = (location.hash || '#/home').replace(/^#\//, '').split('/')[0] || 'home';
    window.GL_ROUTER.go(name);
    // Plan can only be known once logged in, and logging out means it's
    // definitely not premium anymore -- re-check either way.
    window.GL_SUB.refresh();
  });
});
