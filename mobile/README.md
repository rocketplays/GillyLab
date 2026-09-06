# GillyLab App (Capacitor scaffold)

Native iOS + Android app shell. Architecture decision (see conversation this
was built from): Capacitor wrapping a purpose-built single-page app -- not
the website's server-rendered pages as-is, and not a full React Native
rewrite. The goal is a shell that reads as a real app (native chrome, no
full-page reloads, haptics, splash/status bar) while reusing the site's look
and, eventually, its data.

## Structure

- `www/` -- the actual app. Plain HTML/CSS/JS, no build step (yet). This is
  what Capacitor packages into the native shells.
  - `index.html` -- app shell: top bar, `<main id="app">` content outlet,
    bottom tab bar.
  - `css/app.css` -- GillyLab's dark palette (`--accent`, `--bg`, `--card`,
    etc. -- same values as `worker/pages.js`), safe-area-aware top/tab bars.
  - `js/router.js` -- hash-based client-side router. Screens register
    themselves and render into `#app`; no page ever reloads.
  - `js/api.js` -- fetch wrapper against `https://gillylab.com`. **Read the
    comment at the top --** cross-origin auth/cookie behavior from a
    Capacitor WebView is unverified; see Known Follow-Ups below.
  - `js/auth.js` -- local logged-in/out state via `@capacitor/preferences`
    (persists across launches).
  - `js/native.js` -- StatusBar / SplashScreen / Haptics / Browser plugin
    wiring. Everything no-ops safely outside a native shell so `www/` is
    still previewable in a plain browser during development.
  - `js/screens/*.js` -- one file per tab: `home`, `climb` (playable fully
    logged out), `rankings` (free, fetches live data), `pickem` (gated --
    shows the login/signup form when logged out), `account` (login/signup
    or profile + logout), `premium` (static feature breakdown, "Continue to
    Upgrade" opens `gillylab.com/subscribe` in the system browser).
- `android/`, `ios/` -- generated native projects (`npx cap add android/ios`).
  Committed to git (this is normal for Capacitor apps) except build output
  (see `.gitignore`).
- `capacitor.config.json` -- app id `com.gillylab.app`, dark background,
  splash/status bar config.

## Getting it running

```
cd mobile
npm install
npx cap sync
npx cap open android   # requires Android Studio
npx cap open ios       # requires Xcode -- macOS only
```

This was scaffolded and syntax-checked in a Linux sandbox, so `npx cap add
android/ios` and `npx cap sync` have already been run successfully here.
Actually building and running needs Xcode (iOS, macOS-only) and/or Android
Studio (Android) on your machine -- neither is available in the sandbox that
built this.

## Design decisions worth knowing

- **Free vs. gated, per the spec this was built to:** Home, Climb, and
  Rankings are reachable with no account at all. Pick'em (and the Legends
  Bracket once it's added) check `GL_AUTH.isLoggedIn()` and show a login/
  signup form in place of the real screen when logged out.
- **No in-app purchase.** The Premium screen is a static read-only feature
  list. The upgrade button opens `gillylab.com/subscribe` in the system
  browser (`@capacitor/browser`), so the actual charge happens on the
  website via the existing Stripe checkout -- not through Apple's IAP. This
  is the standard way apps avoid the 30% App Store cut for something that
  isn't digital-goods-in-the-app, but Apple's guidelines on this
  (specifically what counts as an allowed "reader app" pattern vs. what
  needs their External Purchase Link entitlement) are strict and have
  shifted over time -- worth a deliberate compliance check before shipping
  to the App Store, not just a coding decision.
- **Native tab bar vs. HTML tab bar:** built as a carefully-styled HTML/CSS
  bar (blur, safe-area insets, haptic tap feedback) rather than a true
  native `UITabBar`/`BottomNavigationView` via a plugin. This was the
  pragmatic middle ground for "Capacitor done properly" -- a real native tab
  bar plugin is a further upgrade if the HTML version doesn't feel close
  enough once it's actually on a device.

## Known follow-ups (not done in this scaffold)

1. **Auth across origins.** The app's WebView origin (`capacitor://
   localhost` on iOS, `https://localhost` on Android) is different from
   `gillylab.com`. Whether the existing `/api/login` / `/api/signup`
   session cookie survives a cross-origin `fetch(..., {credentials:
   'include'})` depends on the cookie's `SameSite`/`Secure` flags and
   whether the Worker sends `Access-Control-Allow-Origin` (echoing the
   app's origin, not `*`) + `Access-Control-Allow-Credentials: true`. Needs
   testing on a real device/simulator; may need a token-based auth mode
   added to the Worker specifically for the app if cookies don't work.
2. **CORS on public data.** `rankings.js` fetches `/data/rankings.json`
   directly and has a graceful fallback message if it 404s/CORS-fails --
   the Worker likely needs to add CORS headers to its static JSON responses
   for the app to actually read them.
3. **Real Climb tuning.** The Climb screen here is a simplified standalone
   version of the mechanic (see the comment in `climb.js`), not wired to
   the site's actual model/tuning (`THE-CLIMB-TUNING.txt`).
4. **Pick'em / Legends Bracket screens.** Currently just confirm "you're
   logged in" -- the real weekly card/bracket UI still needs to be built
   for the app (can likely reuse a lot of the Legends Bracket work already
   done for the website, adapted to this screen structure).
5. **App icon / splash art.** `capacitor.config.json` sets colors only; no
   actual icon/splash image assets have been generated yet.
