// Wires the native-feel plugins. Everything here is a no-op with a console
// note when running in a plain browser (no window.Capacitor), so the app
// is still previewable outside a device/simulator during development.
window.GL_NATIVE = (function(){
  // Marks roughly when this script started loading -- as early as JS can
  // observe "launch", just after the native splash appears. Used below to
  // guarantee the splash (GillyLab logo + "Know the fight before it
  // starts") stays up for a real minimum stretch rather than however long
  // the shell happens to take to render its first screen, which on a fast
  // device/simulator can be well under capacitor.config's own
  // launchShowDuration -- that config value is only a fallback ceiling
  // (it's what fires if launchAutoHide is left to its own devices), it
  // does NOT delay an explicit SplashScreen.hide() call like init() below
  // makes; calling hide() early dismisses immediately regardless of it,
  // which is exactly why the splash was flashing instead of holding.
  var loadedAt = Date.now();
  var MIN_SPLASH_MS = 1200;

  function plugins(){ return (window.Capacitor && window.Capacitor.Plugins) || {}; }
  function isNative(){ return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); }

  function init(){
    var P = plugins();
    if (P.StatusBar){
      // Dark background, light (white) icons/text -- matches the app's
      // always-dark theme (the site itself has no light variant either).
      P.StatusBar.setStyle({ style: 'DARK' }).catch(function(){});
      if (P.StatusBar.setBackgroundColor) P.StatusBar.setBackgroundColor({ color:'#0a0a0b' }).catch(function(){});
    }
    if (P.SplashScreen){
      var elapsed = Date.now() - loadedAt;
      var wait = Math.max(0, MIN_SPLASH_MS - elapsed);
      setTimeout(function(){
        P.SplashScreen.hide().catch(function(){});
      }, wait);
    }
  }

  function tap(){
    var P = plugins();
    if (P.Haptics) P.Haptics.impact({ style:'LIGHT' }).catch(function(){});
  }

  function openExternal(url){
    var P = plugins();
    if (P.Browser){
      P.Browser.open({ url: url });
    } else {
      window.open(url, '_blank');
    }
  }

  return { init: init, tap: tap, openExternal: openExternal, isNative: isNative };
})();
