// Wires the native-feel plugins. Everything here is a no-op with a console
// note when running in a plain browser (no window.Capacitor), so the app
// is still previewable outside a device/simulator during development.
window.GL_NATIVE = (function(){
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
      // capacitor.config gives the splash a minimum show time already;
      // hide once the shell has actually rendered its first screen.
      P.SplashScreen.hide().catch(function(){});
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
