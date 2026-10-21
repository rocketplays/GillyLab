# TestFlight setup & enrolling testers

Bundle ID `com.gillylab.app`, team `JA244RT5Q9`, version 1.0 (build 1). Push is covered in
`PUSH-NOTIFICATIONS-SETUP.txt`; this file is the App Store Connect / TestFlight side.

## One-time setup
1. **App record** — appstoreconnect.apple.com → Apps → "+" → New App
   - Platform iOS, Name "GillyLab", Primary language English (U.S.)
   - Bundle ID: `com.gillylab.app` (appears once the App ID is registered in the developer portal)
   - SKU: anything unique, e.g. `gillylab-ios`
   - User access: Full Access
2. **Build & upload** (on the Mac)
   ```
   cd mobile && npm install && npx cap sync ios && npx cap open ios
   ```
   In Xcode: scheme **App**, destination **Any iOS Device (arm64)** → Product → Archive →
   Distribute App → **App Store Connect** → Upload. Every upload needs a higher build number:
   bump **CURRENT_PROJECT_VERSION** (Signing & Capabilities → General → Build) before archiving.
   Export compliance is pre-answered (`ITSAppUsesNonExemptEncryption = false`, standard HTTPS only).
3. The build shows under App Store Connect → your app → **TestFlight** after ~5–30 min of processing.

## Enrolling testers
**Internal testers (instant, no review, up to 100):** must be App Store Connect users.
- Users and Access → Users → "+" → name, email, role **App Manager/Developer/Marketing** (or "Customer Support"),
  tick **Access to all apps** or just GillyLab → Invite.
- TestFlight → Internal Testing → "+" → create group (e.g. "Core team") → add those users →
  enable **automatic distribution** so each new build goes out on its own.

**External testers (up to 10,000, need Beta App Review once per version):**
- TestFlight → External Testing → "+" → New Group "Public beta".
- Add the build; fill **Test Information** (what to test, feedback email, and a **demo account** —
  Pick'em/Bracket are behind login, so the reviewer needs working credentials).
- Submit for Beta App Review (usually < 1 day).
- On the group, turn on **Public Link** → copy the link, set a tester limit. Anyone with the link installs
  via the TestFlight app. Or add testers by email (they get an invite).

Testers install the **TestFlight** app from the App Store, accept the invite / open the link, and tap Install.
Builds expire after 90 days.

## Checklist before the first external build / App Review
- [x] Push entitlement + Background Modes (remote-notification) + privacy manifest + encryption flag — in repo
- [x] In-app account deletion (Account → Delete Account) — required by App Store guideline 5.1.1(v)
- [x] Privacy policy URL: https://gillylab.com/privacy  ·  Terms: https://gillylab.com/terms
- [ ] Support URL (e.g. https://gillylab.com/faq or a contact page) and marketing URL
- [ ] App Privacy "nutrition labels" in App Store Connect (email address, user ID, usage data; no tracking)
- [ ] Demo account for the reviewer (Pick'em is login-gated; Premium features need a subscribed demo account)
- [ ] Screenshots (6.9" and 6.5" iPhone; iPad if iPad is enabled — the target is currently iPhone + iPad)
- [x] **Payments (App Review guideline 3.1.1 / 3.1.1(a)):** "Go Premium" opens gillylab.com/subscribe (Stripe).
  Apple allows external purchase links on the **US storefront only**, so on iOS every upgrade / "Go Premium" /
  Manage Subscription control is hidden unless the device's App Store storefront is confirmed US
  (`mobile/ios/App/App/StorefrontPlugin.swift` + `GL_NATIVE.upgradeAllowed()`, fail-closed: if the storefront
  can't be read, the buttons stay hidden). Informational "what Premium unlocks" panels remain.
  - **Verify in Xcode/TestFlight:** a US-storefront Apple ID should show Go Premium; any other storefront (or the
    simulator with a non-US region) should show none. If a US device shows no upgrade buttons, the plugin isn't
    registered -- check `MainViewController` is the storyboard's class and Xcode built the two new Swift files.
  - Still advisable: set App Store Connect availability to the **United States only** for the first release
    (guideline 3.1.3(b) is also strict about web-bought subscriptions in other storefronts without in-app purchase).
  - Commission: currently 0% on US link-outs (court injunction); Apple proposed 15%/10%/5% on 2026-08-13 -- not in effect, check before launch.
