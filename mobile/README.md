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
  - `js/api.js` -- fetch wrapper against `https://gillylab.com`. Sends a
    bearer token (see auth.js) instead of relying on the cookie, since the
    cookie is `SameSite=Lax` and won't ride along on a cross-origin fetch.
  - `js/auth.js` -- local logged-in/out state + the bearer token, persisted
    via `@capacitor/preferences` (survives app restarts).
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

## Backend changes made to support the app (worker/index.js)

- **`APP_ORIGINS` / `appCorsHeaders` / `appCorsPreflight`** -- a small
  allowlist (`capacitor://localhost`, `http://localhost`, `https://
  localhost`) that gets CORS headers on responses and an OPTIONS preflight
  handler for `/api/*`. Scoped to exactly those origins -- this does not
  open the API to arbitrary cross-origin JS, just the app shell.
- **`makeSessionToken`** -- same signed payload/signature as the existing
  session cookie (`makeSessionCookie`), just returned as a plain string. The
  cookie is `SameSite=Lax`, which browsers only attach on top-level
  navigations, not on a cross-origin `fetch()` -- so the app can't rely on
  it. Instead it gets this token back from `/api/login`/`/api/signup` and
  sends it as `Authorization: Bearer <token>`.
- **`readSession`** -- now also checks the `Authorization` header (bearer)
  when there's no cookie, so a request authenticated either way resolves to
  the same session.
- **`handleSignup` / `handleLogin`** -- include `token` in the JSON body
  *only* when the request's Origin is an app origin. This is deliberate:
  the cookie is `HttpOnly` specifically so page JS on the website can't read
  it (XSS protection), and putting the same value in a JSON body a browser
  page could read via `fetch()` would undo that. The app is the only client
  that ever sees `token`.
- **`GET /api/app/rankings`** -- a small purpose-built, CORS-enabled
  endpoint that reads `/data/rankings.json` server-side (via the existing
  `loadAssetJson` helper) and returns just the pound-for-pound board as
  `{ generatedAt, rows: [{rank, name}] }`. Added instead of putting CORS
  headers on the static JSON file directly, to keep the exposed surface
  area to exactly what the app screen needs.

The HMAC sign/verify/tamper-rejection logic behind all of this was unit-
tested standalone (Node, mirroring the Worker's crypto helpers) since the
sandbox that built this can't run the actual Worker. **Still unverified:**
whether a real device/simulator's Capacitor WebView actually sends the
`Authorization` header and reads the CORS'd response the way `fetch()`
should -- that needs a real build, which needs Xcode/Android Studio.

## Known follow-ups (not done in this scaffold)

1. **On-device verification.** The bearer-token + CORS plumbing, the real
   Climb screen, and the iframed Pick'em screen are all in place and
   unit-tested/reviewed, but none of it has run inside an actual Capacitor
   WebView yet -- that needs a real build via Xcode/Android Studio, which
   this sandbox can't do.
2. **Real Climb.** Done. `climb.js` iframes `climb-game.html`, generated
   from the actual `prototypes/the-climb.html` engine by
   `scripts/gen-climb-app-page.cjs` -- same balance/tuning as the website,
   fetching a new ungated `GET /api/app/climb` endpoint so it's playable
   with no account, per spec.
3. **Pick'em / Legends Bracket screens.** Pick'em done -- `pickem.js` shows
   a login/signup form when logged out, else iframes the real, live
   `/pickem` page (no reimplementation of its server-side scoring/card
   logic). Relies on the `gl_session` cookie riding along on the iframe's
   cross-site navigation, which is spec-correct for `SameSite=Lax` but
   still needs on-device confirmation (see #1). Legends Bracket screen not
   started.
4. **App icon / splash art.** Done. Source art in `assets/icon.png`,
   `assets/splash.png`, `assets/splash-dark.png`, generated from the
   GillyLab mark; all platform-specific resolutions (Android mipmaps/
   drawables, iOS `Assets.xcassets`) generated via `capacitor-assets
   generate` and committed.
5. **Token refresh/expiry.** Not started. The bearer token expires with the
   same TTL as the cookie (`SESSION_TTL_HOURS`, default 12h) and there's no
   refresh flow yet -- the app will just look logged-out once it expires,
   same as the cookie would, but a longer-lived native app probably wants a
   refresh path eventually.
