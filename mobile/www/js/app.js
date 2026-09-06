document.addEventListener('DOMContentLoaded', function(){
  window.GL_NATIVE.init();
  window.GL_AUTH.ready.then(function(){
    window.GL_ROUTER.init();
  });
  window.GL_AUTH.onChange(function(){
    // Re-render whatever screen is up so login/logout is reflected
    // immediately (e.g. the lock screen on Pick'em swaps to the real one).
    var name = (location.hash || '#/home').replace(/^#\//, '').split('/')[0] || 'home';
    window.GL_ROUTER.go(name);
  });
});
