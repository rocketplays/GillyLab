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
- **Never iframe a page that needs a login.** Confirmed on a real device:
  `SameSite=Lax` cookies are never sent on a cross-origin iframe navigation,
  by spec, in every browser engine -- not an edge case, not something that
  might work on some devices. Pick'em originally iframed the live
  `gillylab.com/pickem` page and it never once saw a logged-in visitor; see
  `pickem.js` for the fix (a real screen calling the JSON APIs with the
  bearer token, same mechanism as Rankings/Climb). Climb's iframe is fine
  and doesn't need to change -- it loads a file bundled inside the app
  itself (same origin) and only calls the deliberately public
  `/api/app/climb` endpoint, so no cookie is ever involved. The rule for any
  future screen (Legends Bracket, the roster/matchup-style pages below):
  iframing a same-origin bundled file or a genuinely public endpoint is
  fine; iframing a live page that depends on the visitor's login never
  works from inside this app, no matter how it's coaxed.

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
3. **Pick'em / Legends Bracket screens.** Pick'em done -- as a real native
   screen (`pickem.js`), not an iframe. The original iframe-the-live-page
   version was confirmed broken on a real device (see the "never iframe a
   page that needs a login" note above); it's since been rebuilt to call
   the same JSON endpoints the live page's own client script uses
   (`GET /api/app/pickem-card`, `/api/pickem/mine`, `/save`,
   `/leaderboard`, `/history`) with the app's bearer token, same mechanism
   as Rankings/Climb. Legends Bracket screen not started -- build it the
   same way from the start, not as an iframe.
4. **App icon / splash art.** Done. Source art in `assets/icon.png`,
   `assets/splash.png`, `assets/splash-dark.png`, generated from the
   GillyLab mark; all platform-specific resolutions (Android mipmaps/
   drawables, iOS `Assets.xcassets`) generated via `capacitor-assets
   generate` and committed.
5. **Token refresh/expiry.** Done. `GET /api/app/refresh` (worker/index.js)
   verifies the current bearer token via the same `readSession` path as
   everything else and, if still valid, hands back a fresh token with a
   renewed full-length TTL. `auth.js` decodes the token's own `exp` claim
   client-side (the payload is signed, not encrypted, so no secret is
   needed to read it) and calls this endpoint once the token is within
   `REFRESH_MARGIN_SEC` (6h) of expiring -- checked on load, on
   `visibilitychange` (foregrounding the app), and every 30 minutes while
   open. An already-expired token is left alone (refreshing it would fail
   the same check login/signup would) and just falls back to the
   logged-out view, same as before this existed. Deliberately not built on
   `@capacitor/app`'s resume event, since adding that plugin is a native-
   platform change (Podfile/Gradle) unverified in this sandbox -- plain
   `visibilitychange` already works in a Capacitor WebView.
6. **Roster + Matchup-style free browsing.** Not started. The spec calls
   for "an entire free section, structured like it currently is" -- the app
   is still missing the Active Roster page and a Matchup-equivalent screen
   (fighter profiles, fight info dropdowns, etc.) that the website has on
   `/roster` and `/matchup`. Both are free/logged-out-browsable on the
   website already (`/data/roster.json` is in the public-assets allowlist
   near the top of `worker/index.js`), so this should mostly be new app-side
   UI consuming existing data, not new backend work -- check whether
   `/matchup`'s own data needs a small `/api/app/*`-style endpoint the way
   Rankings and Pick'em's card did, or whether it's already served plainly
   enough to fetch directly. Per the note above: build as a real screen,
   not an iframe of the live page.
