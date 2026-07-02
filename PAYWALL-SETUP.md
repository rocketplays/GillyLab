# GillyLab paywall — setup guide

This locks the whole site behind a paid Stripe subscription using a Cloudflare
Worker. Once set up it's hands-off: Stripe tracks who's subscribed, a webhook
keeps status current, and the Worker only serves the app to a valid subscriber.

**What's in the repo now**
- `wrangler.toml` — Worker + static-assets config (fill in the KV ids).
- `worker/index.js` — routing, auth (password + magic link), sessions, Stripe, the gate.
- `worker/pages.js` — landing / login / signup / subscribe / account pages.
- `scripts/build-site.sh` — assembles `public/` (the gated app: index.html + data + photos).
- `package.json` — `npm run deploy` builds `public/` and deploys the Worker.

**You'll need accounts:** Cloudflare, Stripe, Resend (for magic-link emails), and
your domain's DNS on Cloudflare. Do everything in Stripe **test mode** first.

---

## 1. Put gillylab.com on Cloudflare
The Worker attaches to your domain, so Cloudflare must manage its DNS.
1. Cloudflare dashboard → **Add a site** → `gillylab.com` (Free plan is fine).
2. Cloudflare shows two nameservers — set those at your domain registrar
   (replacing the current ones). Propagation takes minutes–hours.
   *(Until you attach the Worker in step 7, you can keep the existing GitHub
   Pages DNS records so the current site stays up.)*

## 2. Install + log in to Wrangler
```bash
npm install                 # installs wrangler from package.json
npx wrangler login          # opens browser to authorize
```

## 3. Create the KV namespaces
```bash
npx wrangler kv namespace create USERS
npx wrangler kv namespace create MAGIC
```
Copy each printed `id` into `wrangler.toml` (replace `REPLACE_WITH_..._KV_ID`).

## 4. Stripe: product, price, keys
1. Stripe → **Products** → add a product → add a **recurring** price
   (e.g. $7.99/month). Copy the price id → `price_...`.
2. Stripe → **Developers → API keys** → copy the **Secret key** (`sk_test_...`).
3. Stripe → **Developers → Webhooks** → **Add endpoint**
   - URL: `https://gillylab.com/api/stripe-webhook`
   - Events: `checkout.session.completed`, `customer.subscription.created`,
     `customer.subscription.updated`, `customer.subscription.deleted`
   - After creating it, copy the **Signing secret** → `whsec_...`.

## 5. Resend: email for magic links
1. Create a Resend account → **API Keys** → copy `re_...`.
2. **Domains** → add & verify `gillylab.com` (add the DNS records it gives you —
   easy now that DNS is on Cloudflare). Then set `FROM_EMAIL` in `wrangler.toml`
   to a verified address like `GillyLab <login@gillylab.com>`.

## 6. Set the secrets (values never touch git)
```bash
npx wrangler secret put STRIPE_SECRET_KEY        # sk_test_... (later sk_live_...)
npx wrangler secret put STRIPE_WEBHOOK_SECRET    # whsec_...
npx wrangler secret put STRIPE_PRICE_ID          # price_...
npx wrangler secret put RESEND_API_KEY           # re_...
npx wrangler secret put SESSION_SECRET           # paste: openssl rand -hex 32
```

## 7. Deploy + attach the domain
```bash
npm run deploy         # builds public/ and deploys the Worker
```
Then in the dashboard: **Workers & Pages → gillylab → Settings → Domains & Routes**
→ **Add Custom Domain** → `gillylab.com` (and `www.gillylab.com`). Cloudflare wires
the DNS and routes all traffic through the Worker.

> Test first without touching the domain: `npx wrangler deploy` gives a
> `https://gillylab.<subdomain>.workers.dev` URL. Set `SITE_URL` to that temporarily
> (and the Stripe webhook + success URLs) to run a full test-mode purchase, then
> switch back to `https://gillylab.com` for production.

## 8. Go live
- Flip Stripe to **live mode**, redo the live price + webhook + keys (`sk_live_…`,
  `whsec_…`, `price_…`), and re-run the `wrangler secret put` for those three.
- Update the price label shown on the pages in `worker/pages.js` (`PRICE_LABEL`).

---

## How it behaves
- **Logged out →** `/` shows the landing page. `/signup` creates an account and
  sends them to Stripe Checkout; `/login` supports password **or** "email me a
  sign-in link" (magic link).
- **Subscribed →** `/` serves the real app; all `/data/*` and `/photos/*` are only
  delivered to a subscribed session.
- **Cancels / payment fails →** Stripe's webhook flips the account to inactive;
  the next page load (or session expiry, default 12h) locks them out. Zero manual work.

## Notes
- The old GitHub Pages deploy (`.github/workflows/deploy-pages.yml`) becomes
  redundant once the domain points at the Worker — you can delete that workflow
  and set repo **Settings → Pages → Source: None**. Deploys are now `npm run deploy`.
- Want push-to-deploy? Add a GitHub Action that runs `wrangler deploy` with a
  `CLOUDFLARE_API_TOKEN` secret — say the word and I'll add it.
- `SESSION_SECRET` rotating will log everyone out (harmless). Keep it stable.
