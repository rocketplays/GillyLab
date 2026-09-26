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

  // ── Push notifications (Pick'em Reminders/Results, Bet Results -- see
  // Settings' Notifications section and worker/index.js's runLockReminders/
  // runResultRecaps/runBetResultPushes) ──────────────────────────────────
  // Account-tied, not device-tied: a logged-out visitor has no email/device
  // record to send to at all (see settings.js's own reasoning for hiding
  // the toggles entirely for them), so registration only ever happens once
  // logged in, and is torn down again on logout. Wired off GL_AUTH's own
  // onChange/ready rather than from account.js's login/signup screen, so it
  // fires the same way whether the session came from a fresh login or was
  // just restored from Preferences on app launch.
  var lastPushToken = null;
  function registerPush(){
    var P = plugins();
    if (!P.PushNotifications || !isNative()) return;
    P.PushNotifications.checkPermissions().then(function(perm){
      if (perm && perm.receive === 'granted') return perm;
      return P.PushNotifications.requestPermissions();
    }).then(function(perm){
      if (!perm || perm.receive !== 'granted') return;   // denied -- nothing more to do here
      return P.PushNotifications.register();
    }).catch(function(){});
  }
  function unregisterPush(){
    var P = plugins();
    if (!P.PushNotifications || !isNative()) return;
    if (lastPushToken){
      window.GL_API.unregisterPushToken(lastPushToken).catch(function(){});
      lastPushToken = null;
    }
  }
  function wirePushListeners(){
    var P = plugins();
    if (!P.PushNotifications) return;
    // Fires once register() above succeeds, with the actual APNs/FCM device
    // token -- this is the "device record" Settings' toggles otherwise have
    // nothing to attach to. Re-fires on every app launch even for an
    // already-registered device (APNs/FCM tokens can rotate), so this POSTs
    // every time rather than only the first time.
    P.PushNotifications.addListener('registration', function(token){
      lastPushToken = token && token.value;
      if (lastPushToken && window.GL_AUTH.isLoggedIn()){
        window.GL_API.registerPushToken(lastPushToken).catch(function(){});
      }
    });
    P.PushNotifications.addListener('registrationError', function(){
      // Denied permission or a native registration failure -- Settings'
      // toggles simply won't do anything for this device until it
      // succeeds; no separate UI for this yet.
    });
    // Tapping a delivered notification (app backgrounded or closed) -- no
    // per-notification deep link built yet (which card, which bet), so this
    // just brings the app to Home rather than doing nothing.
    P.PushNotifications.addListener('pushNotificationActionPerformed', function(){
      try { window.GL_ROUTER.go('home'); } catch(e){}
    });
  }
  wirePushListeners();
  if (window.GL_AUTH){
    window.GL_AUTH.ready.then(function(){
      if (window.GL_AUTH.isLoggedIn()) registerPush();
    });
    window.GL_AUTH.onChange(function(state){
      if (state.loggedIn) registerPush(); else unregisterPush();
    });
  }

  return { init: init, tap: tap, openExternal: openExternal, isNative: isNative };
})();
