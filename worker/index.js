/**
 * GillyLab paywall Worker.
 *
 * Fronts gillylab.com. Runs before any asset (run_worker_first). Serves the
 * public landing/login/signup pages and /api/* endpoints itself, and only hands
 * over the app (index.html) + data + photos to a valid, SUBSCRIBED session.
 *
 * Auth: email+password (PBKDF2) with a magic-link fallback; sessions are signed
 * cookies. Stripe drives subscription status (Checkout + webhook), so access is
 * hands-off — cancellations/failed payments auto-lock within the session TTL,
 * and the webhook + checkout-success verify keep KV current.
 *
 * Env bindings (see wrangler.toml + PAYWALL-SETUP.md):
 *   ASSETS (static)  USERS, MAGIC (KV)
 *   vars: SITE_URL, FROM_EMAIL, SESSION_TTL_HOURS
 *   secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID,
 *            SESSION_SECRET, RESEND_API_KEY
 */

import { landingPage, loginPage, signupPage, subscribePage, accountPage, notePage, changePasswordPage, forgotPasswordPage, resetPasswordPage, termsPage, privacyPage, contactPage, aboutPage, scorecardPage } from "./pages.js";
import landingData from "./landing-data.js";
import scorecardData from "./scorecard-data.js";
import { gradeCard, buildLeaderboard, userHistory, playerRanks, cleanName } from "./pickem.mjs";

const COOKIE = "gl_session";
const CONTACT_TO = "support@gillylab.com";   // where the contact form is delivered

// Founder-only allow-list for the internal /scorecard model-performance page.
// Add co-founder account emails here to grant them access. Everyone else — even
// paying subscribers — gets bounced.
const FOUNDER_EMAILS = new Set([
  "jeffreyadler123@gmail.com",
]);

// The ONLY files under ./public served WITHOUT a subscribed session — an
// explicit allow-list for the logged-out marketing page. Everything else (the
// app, its data, all other photos) stays gated. Fixed thumbnails power the
// unchanging slides (simulator, tape, box score); the changing slides (featured
// champion, live odds, odds history) contribute their fighters via
// landingData.photos, regenerated alongside the data.
const PUBLIC_LANDING_ASSETS = new Set([
  "/photos/thumb/joshua-van.png",         // simulator
  "/photos/thumb/tatsuro-taira.png",      // simulator
  "/photos/thumb/paddy-pimblett.png",     // tape study
  "/photos/thumb/islam-makhachev.png",    // box score
  "/photos/thumb/alexander-volkanovski.png", // box score
  "/photos/thumb/charles-oliveira.png",   // accolades
  "/photos/thumb/conor-mcgregor.png",     // odds board (static)
  "/photos/thumb/max-holloway.png",       // odds board (static)
  ...((landingData?.photos) || []).map((s) => "/photos/thumb/" + s + ".png"),
  "/og.png", "/favicon.ico", "/favicon.svg", "/apple-touch-icon.png",
  "/gl-logo.png",                          // brand mark in the landing nav
]);

/* ─────────────────────────── small crypto/util helpers ─────────────────────── */
const enc = new TextEncoder();
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64urlToBytes = (s) => { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
const randHex = (n = 32) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return [...a].map(b => b.toString(16).padStart(2, "0")).join(""); };
const timingSafeEq = (a, b) => { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };

async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  return b64url(sig);
}
async function hmacHex(secretBytes, msg) {
  const key = await crypto.subtle.importKey("raw", secretBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, "0")).join("");
}
async function pbkdf2(password, saltBytes) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: saltBytes, iterations: 100000, hash: "SHA-256" }, key, 256);
  return b64url(bits);
}
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { passHash: await pbkdf2(password, salt), passSalt: b64url(salt) };
}
async function verifyPassword(password, passHash, passSalt) {
  if (!passHash || !passSalt) return false;
  const h = await pbkdf2(password, b64urlToBytes(passSalt));
  return timingSafeEq(h, passHash);
}

/* ─────────────────────────────── sessions (signed cookie) ──────────────────── */
async function makeSessionCookie(env, email, sub) {
  const ttl = (parseInt(env.SESSION_TTL_HOURS || "12", 10)) * 3600;
  const payload = b64url(enc.encode(JSON.stringify({ e: email, s: !!sub, exp: Math.floor(Date.now() / 1000) + ttl })));
  const sig = await hmac(env.SESSION_SECRET, payload);
  const val = `${payload}.${sig}`;
  return `${COOKIE}=${val}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${ttl}`;
}
function clearCookie() { return `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`; }
async function readSession(request, env) {
  const cookie = request.headers.get("Cookie") || "";
  const m = cookie.match(new RegExp(`${COOKIE}=([^;]+)`));
  if (!m) return null;
  const [payload, sig] = m[1].split(".");
  if (!payload || !sig) return null;
  if (!timingSafeEq(await hmac(env.SESSION_SECRET, payload), sig)) return null;
  try {
    const d = JSON.parse(new TextDecoder().decode(b64urlToBytes(payload)));
    if (!d.exp || d.exp < Math.floor(Date.now() / 1000)) return null;
    return { email: d.e, sub: !!d.s };
  } catch { return null; }
}

/* ─────────────────────────────────── users (KV) ────────────────────────────── */
const normEmail = (e) => (e || "").trim().toLowerCase();
const getUser = async (env, email) => { const v = await env.USERS.get("u:" + normEmail(email)); return v ? JSON.parse(v) : null; };
const putUser = async (env, email, obj) => env.USERS.put("u:" + normEmail(email), JSON.stringify(obj));
const emailForCustomer = async (env, custId) => env.USERS.get("cust:" + custId);
const linkCustomer = async (env, custId, email) => env.USERS.put("cust:" + custId, normEmail(email));

/* ─────────────────────────────────── Stripe ────────────────────────────────── */
function formEncode(obj, prefix = "", out = []) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v && typeof v === "object") formEncode(v, key, out);
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
  }
  return out.join("&");
}
async function stripe(env, path, method = "GET", body = null) {
  const res = await fetch("https://api.stripe.com/v1/" + path, {
    method,
    headers: { Authorization: "Bearer " + env.STRIPE_SECRET_KEY, "Content-Type": "application/x-www-form-urlencoded" },
    body: body ? formEncode(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error("stripe " + path + ": " + (data.error?.message || res.status));
  return data;
}
async function createCheckout(env, email, customerId) {
  const params = {
    mode: "subscription",
    "line_items": { "0": { price: env.STRIPE_PRICE_ID, quantity: 1 } },
    success_url: env.SITE_URL + "/api/checkout/success?session_id={CHECKOUT_SESSION_ID}",
    cancel_url: env.SITE_URL + "/subscribe?canceled=1",
    allow_promotion_codes: "true",
    client_reference_id: normEmail(email),
  };
  if (customerId) params.customer = customerId; else params.customer_email = normEmail(email);
  const s = await stripe(env, "checkout/sessions", "POST", params);
  return s.url;
}
async function markSubscribed(env, email, customerId, subscribed, extra = {}) {
  const e = normEmail(email);
  const u = (await getUser(env, e)) || { email: e, createdAt: Date.now() };
  u.subscribed = !!subscribed;
  if (customerId) { u.stripeCustomerId = customerId; await linkCustomer(env, customerId, e); }
  Object.assign(u, extra);
  await putUser(env, e, u);
  return u;
}
async function verifyStripeSig(payload, header, secret) {
  // header: t=timestamp,v1=signature (HMAC-SHA256 of `${t}.${payload}`)
  const parts = Object.fromEntries((header || "").split(",").map(p => p.split("=")));
  if (!parts.t || !parts.v1) return false;
  if (Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) return false; // 5-min tolerance
  const expected = await hmacHex(enc.encode(secret), `${parts.t}.${payload}`);
  return timingSafeEq(expected, parts.v1);
}

/* ─────────────────────────────────── email (Resend) ────────────────────────── */
async function sendEmail(env, to, subject, html, replyTo) {
  if (!env.RESEND_API_KEY) throw new Error("email not configured");
  const payload = { from: env.FROM_EMAIL, to, subject, html };
  if (replyTo) payload.reply_to = replyTo;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + env.RESEND_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("email send failed: " + (await res.text()));
}

// Contact form → email to CONTACT_TO, with reply-to set to the sender so a reply
// goes straight back to them. Honeypot ("company") silently drops bot spam.
async function handleContact(request, env) {
  let b = {};
  try { b = await request.json(); } catch {}
  if (b.company) return json({ ok: true });   // honeypot filled → pretend success, drop
  const name = String(b.name || "").trim();
  const email = String(b.email || "").trim();
  const message = String(b.message || "").trim();
  if (!name || !email || !message) return json({ error: "Please add your name, email, and a message." }, 400);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Please enter a valid email address." }, 400);
  if (message.length > 5000) return json({ error: "Please keep your message under 5,000 characters." }, 400);
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const bodyHtml = `<p><strong>From:</strong> ${esc(name)} &lt;${esc(email)}&gt;</p><p><strong>Message:</strong></p><p>${esc(message).replace(/\n/g, "<br>")}</p>`;
  try {
    await sendEmail(env, CONTACT_TO, `GillyLab contact — ${name}`, bodyHtml, email);
    return json({ ok: true });
  } catch {
    return json({ error: "Couldn't send your message right now. Please email " + CONTACT_TO + " directly." }, 500);
  }
}

/* ─────────────────────────────────── pick'em ───────────────────────────────── */
// All pick'em state lives in the PICKS KV namespace:
//   pf:<email>            -> { name }               display name (profile)
//   nm:<lowername>        -> email                  reservation, enforces uniqueness
//   pk:<slug>:<email>     -> { name, prelimsAt, eventName, eventDate, slug, picks:[…] }
//   ag:<email>            -> { name, byEvent:{ slug: { points, event, date, correct, boutCount } } }
//   gr:<slug>             -> "1"                     per-event grade-sweep marker
const pkGet = async (env, key) => { const v = await env.PICKS.get(key); return v ? JSON.parse(v) : null; };
const pkPut = (env, key, obj) => env.PICKS.put(key, JSON.stringify(obj));
const clampNum = (n, lo, hi) => Math.max(lo, Math.min(hi, Number(n) || 0));

// A logged-in AND subscribed session, or null — pick'em is a subscriber feature.
async function pickemSession(request, env) {
  const s = await readSession(request, env);
  if (!s) return null;
  const u = await getUser(env, s.email);
  if (!u || !u.subscribed) return null;
  return { email: s.email };
}
async function getDisplayName(env, email) { const p = await pkGet(env, "pf:" + email); return (p && p.name) || null; }

async function handlePickemGetName(request, env) {
  const s = await pickemSession(request, env);
  if (!s) return json({ error: "unauthorized" }, 401);
  return json({ name: await getDisplayName(env, s.email) });
}
async function handlePickemSetName(request, env) {
  const s = await pickemSession(request, env);
  if (!s) return json({ error: "unauthorized" }, 401);
  const { name } = await readBody(request);
  const clean = cleanName(name);
  if (!clean) return json({ error: "Pick a name 2–20 characters long (letters, numbers, spaces, _ . -)." }, 400);
  const lower = clean.toLowerCase();
  const owner = await env.PICKS.get("nm:" + lower);
  if (owner && owner !== s.email) return json({ error: "That name is taken — try another." }, 409);
  const prev = await getDisplayName(env, s.email);
  if (prev && prev.toLowerCase() !== lower) await env.PICKS.delete("nm:" + prev.toLowerCase());
  await env.PICKS.put("nm:" + lower, s.email);
  await pkPut(env, "pf:" + s.email, { name: clean });
  const ag = await pkGet(env, "ag:" + s.email);
  if (ag) { ag.name = clean; await pkPut(env, "ag:" + s.email, ag); }   // keep leaderboard name fresh
  return json({ name: clean });
}

// Save/overwrite this user's picks for an event. Rejected once the prelims have
// started — that's the lock. Component points are clamped so a tampered client
// can't inflate a score.
async function handlePickemSave(request, env) {
  const s = await pickemSession(request, env);
  if (!s) return json({ error: "unauthorized" }, 401);
  const name = await getDisplayName(env, s.email);
  if (!name) return json({ error: "needs-name" }, 428);   // client must set a display name first
  const body = await readBody(request);
  const slug = String(body.eventSlug || "").slice(0, 120);
  if (!slug) return json({ error: "missing event" }, 400);
  const prelimsAt = Date.parse(body.prelimsAt);
  if (isFinite(prelimsAt) && Date.now() >= prelimsAt) return json({ error: "locked", locked: true }, 403);
  const CONF = { High: 1, Med: 1, Low: 1 }, METHOD = { "KO/TKO": 1, "Submission": 1, "Decision": 1 };
  const picks = (Array.isArray(body.picks) ? body.picks : []).slice(0, 20).map(p => {
    const winner = String(p.winner || ""), f1 = String(p.f1 || ""), f2 = String(p.f2 || "");
    if (!winner || !f1 || !f2 || (winner !== f1 && winner !== f2)) return null;
    if (!CONF[p.confidence] || !METHOD[p.method]) return null;
    return {
      f1, f2, winner, method: p.method, confidence: p.confidence,
      round: p.method !== "Decision" && p.round != null ? clampNum(p.round, 1, 5) : null,
      wPts: clampNum(p.wPts, 0, 60), mPts: clampNum(p.mPts, 0, 20), rPts: clampNum(p.rPts, 0, 20),
    };
  }).filter(Boolean);
  if (!picks.length) return json({ error: "no valid picks" }, 400);
  await pkPut(env, "pk:" + slug + ":" + s.email, {
    name, submittedAt: Date.now(), prelimsAt: body.prelimsAt || null,
    eventName: String(body.eventName || "").slice(0, 160), eventDate: String(body.eventDate || "").slice(0, 60),
    slug, picks,
  });
  return json({ ok: true, saved: picks.length });
}

// The user's own stored picks for an event (to restore + show a locked state).
async function handlePickemMine(request, env, url) {
  const s = await pickemSession(request, env);
  if (!s) return json({ error: "unauthorized" }, 401);
  const slug = url.searchParams.get("event") || "";
  const rec = slug ? await pkGet(env, "pk:" + slug + ":" + s.email) : null;
  const locked = !!(rec && rec.prelimsAt && Date.now() >= Date.parse(rec.prelimsAt));
  return json({ record: rec, locked });
}

// Finalized results, written by the results workflow and read from the bundle:
//   { events: [{ slug, name, date, bouts:[{ f1, f2, winner, method, round, voided }] }] }
async function loadResults(env, url) {
  try {
    const r = await env.ASSETS.fetch(new Request(new URL("/data/pickem-results.json", url)));
    if (!r.ok) return { events: [] };
    const j = await r.json();
    return j && Array.isArray(j.events) ? j : { events: [] };
  } catch { return { events: [] }; }
}
// Turn one ESPN bout into a gradeable result, or null if it isn't decided yet.
// A bout is decided when a fighter has a `win` outcome (winnerFighterSlug can be
// null for a late replacement) or the method reads draw/no-contest.
function boutToResult(b) {
  if (!b || b.isCancelled) return null;
  const fs = b.fighters || [];
  if (fs.length !== 2) return null;
  const f1 = fs[0].fighterName, f2 = fs[1].fighterName;
  if (!f1 || !f2) return null;
  const win = (b.winnerFighterSlug && fs.find(f => f.fighterSlug === b.winnerFighterSlug)) ||
              fs.find(f => f.outcome === "win");
  if (win) return { f1, f2, winner: win.fighterName, method: b.method || "", round: b.resultRound || null, voided: false };
  const drawNC = /draw|no\s*contest|^\s*nc\s*$/i.test(b.method || "") || fs.every(f => f.outcome === "draw");
  if (drawNC) return { f1, f2, winner: null, method: b.method || "", round: b.resultRound || null, voided: true };
  return null;   // still pending
}
// Read the live ESPN feed from the bundle and return the "focus" card — the one in
// progress (or, between cards, the most recently started card that has results) —
// as gradeable bouts. This lets the leaderboard score a card AS IT HAPPENS, without
// waiting for the end-of-card results sweep. Returns null when nothing has results.
async function loadFocusEvent(env, url) {
  let feed;
  try {
    const r = await env.ASSETS.fetch(new Request(new URL("/data/event.json", url)));
    if (!r.ok) return null;
    feed = await r.json();
  } catch { return null; }
  const events = Array.isArray(feed && feed.data) ? feed.data : [];
  // Only a card that actually has results can be the focus, so we don't need a
  // start-time filter (a future card has no decided bouts). This also sidesteps the
  // prelims-vs-main-card start-time ambiguity.
  const withResults = events
    .map(ev => ({ ev, bouts: (ev.bouts || []).map(boutToResult).filter(Boolean) }))
    .filter(x => x.bouts.length);
  if (!withResults.length) return null;
  // Prefer a live card; otherwise the most recently started card that has results.
  withResults.sort((a, b) => (Date.parse(b.ev.startsAt || 0) || 0) - (Date.parse(a.ev.startsAt || 0) || 0));
  const pick = withResults.find(x => x.ev.status === "live") || withResults[0];
  const total = (pick.ev.bouts || []).filter(b => b && !b.isCancelled && (b.fighters || []).length === 2).length;
  return {
    slug: pick.ev.slug,
    name: pick.ev.title || pick.ev.espnName || pick.ev.shortTitle || pick.ev.slug,
    date: (pick.ev.startsAt || "").slice(0, 10),
    live: pick.ev.status === "live",
    bouts: pick.bouts, decided: pick.bouts.length, total,
  };
}
// Live standings for the focus card: grade every submitted entry against the
// decided-so-far bouts, fresh each request. Read-only — it does NOT touch the agg
// records or the gr:<slug> marker, so the end-of-card sweep still runs once, later.
async function currentBoard(env, url, myName) {
  const focus = await loadFocusEvent(env, url);
  if (!focus) return { scope: "current", event: null, live: false, rows: [], me: null };
  const prefix = "pk:" + focus.slug + ":";
  const keys = await listAllKeys(env, prefix);
  // Grade every entry concurrently — a sequential loop of KV reads is what made this
  // slow (and occasionally time out) once a few dozen people had entered.
  const graded = await Promise.all(keys.map(async (key) => {
    const rec = await pkGet(env, key);
    if (!rec) return null;
    const email = key.slice(prefix.length);
    const name = (await getDisplayName(env, email)) || rec.name;
    if (!name) return null;
    const card = gradeCard(rec, focus.bouts);
    return { name, points: card.total, correct: card.correct, played: focus.decided };
  }));
  const rows = graded.filter(Boolean);
  rows.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  const ranked = rows.map((r, i) => ({ rank: i + 1, ...r }));
  return {
    scope: "current", event: focus.name, date: focus.date, live: focus.live,
    decided: focus.decided, total: focus.total,
    rows: ranked.slice(0, 100),
    me: myName ? (ranked.find(r => r.name === myName) || null) : null,
  };
}
async function listAllKeys(env, prefix) {
  const out = []; let cursor;
  do {
    const page = await env.PICKS.list({ prefix, cursor });
    out.push(...page.keys.map(k => k.name));
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  return out;
}
// Grade-logic version. The gr:<slug> marker stores this; bump it whenever the grading
// rules change to force a one-time re-grade sweep of every finalized event, so cached
// agg totals pick up the new logic. "3" = tolerant name matching (Bobby/King Green)
// + underdog threshold lowered to any dog (wPts > 10).
const GRADE_VERSION = "3";
// Grade every final event whose marker doesn't match GRADE_VERSION and fold each
// user's total into their agg record. Returns finalized slugs, newest first.
async function ensureGraded(env, url) {
  const results = await loadResults(env, url);
  const events = results.events.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const valid = events.filter(ev => ev.slug && Array.isArray(ev.bouts) && ev.bouts.length);
  // Which events still need (re)grading? Check all markers concurrently — this is the
  // steady-state path (hit on every leaderboard/history request once all are graded),
  // and a sequential per-event get was adding latency there.
  const marks = await Promise.all(valid.map(ev => env.PICKS.get("gr:" + ev.slug)));
  const todo = valid.filter((_, i) => marks[i] !== GRADE_VERSION);
  for (const ev of todo) {
    const prefix = "pk:" + ev.slug + ":";
    for (const key of await listAllKeys(env, prefix)) {
      const rec = await pkGet(env, key);
      if (!rec) continue;
      const card = gradeCard(rec, ev.bouts);
      const email = key.slice(prefix.length);
      const ag = (await pkGet(env, "ag:" + email)) || { name: rec.name, byEvent: {} };
      ag.name = (await getDisplayName(env, email)) || rec.name || ag.name;
      ag.byEvent[ev.slug] = { points: card.total, event: ev.name || rec.eventName || "",
                              date: ev.date || rec.eventDate || "", correct: card.correct, boutCount: card.boutCount,
                              decided: card.decided, dogPicks: card.dogPicks, dogCorrect: card.dogCorrect };
      await pkPut(env, "ag:" + email, ag);
    }
    await env.PICKS.put("gr:" + ev.slug, GRADE_VERSION);
  }
  return events.map(e => e.slug);
}

// Finalized slug order + every user's agg record (for leaderboards + ranks).
async function pickemBoardData(env, url) {
  const ordered = await ensureGraded(env, url);
  // Read all agg records concurrently — a sequential await-in-loop is what made the
  // Last 5 / All-time / My-history tabs slow once a few dozen players existed.
  const keys = await listAllKeys(env, "ag:");
  const aggs = (await Promise.all(keys.map(k => pkGet(env, k)))).filter(Boolean);
  return { ordered, aggs };
}

async function handlePickemHistory(request, env, url) {
  const s = await pickemSession(request, env);
  if (!s) return json({ error: "unauthorized" }, 401);
  // ?event=slug -> per-bout breakdown of that card for this user (drill-down).
  const slug = url.searchParams.get("event");
  if (slug) {
    await ensureGraded(env, url);
    const rec = await pkGet(env, "pk:" + slug + ":" + s.email);
    if (!rec) return json({ error: "no picks for that event" }, 404);
    const results = await loadResults(env, url);
    const ev = (results.events || []).find(e => e.slug === slug);
    const card = ev ? gradeCard(rec, ev.bouts) : { bouts: rec.picks.map(p => ({ ...p, pending: true, points: 0 })), total: 0, correct: 0 };
    return json({ slug, event: rec.eventName, date: rec.eventDate, graded: !!ev, total: card.total, correct: card.correct, boutCount: card.boutCount, bouts: card.bouts });
  }
  const { ordered, aggs } = await pickemBoardData(env, url);
  const ag = (await pkGet(env, "ag:" + s.email)) || { name: await getDisplayName(env, s.email), byEvent: {} };
  const ranks = ag.name ? playerRanks(aggs, ordered, ag.name) : { all: null, last5: null };
  return json({ ...userHistory(ag, ordered), rankAll: ranks.all, rankLast5: ranks.last5 });
}
async function handlePickemLeaderboard(request, env, url) {
  const s = await pickemSession(request, env);
  if (!s) return json({ error: "unauthorized" }, 401);
  const scope = url.searchParams.get("scope") || "all";
  const myName = await getDisplayName(env, s.email);
  // The "current" scope grades the in-progress card live from the ESPN feed.
  if (scope === "current") return json(await currentBoard(env, url, myName));
  const { ordered, aggs } = await pickemBoardData(env, url);
  const rows = buildLeaderboard(aggs, ordered, scope);
  return json({ scope, rows: rows.slice(0, 100), me: myName ? (rows.find(r => r.name === myName) || null) : null });
}
// Public (subscriber) profile for any player by display name.
async function handlePickemPlayer(request, env, url) {
  const s = await pickemSession(request, env);
  if (!s) return json({ error: "unauthorized" }, 401);
  const name = (url.searchParams.get("name") || "").trim();
  if (!name) return json({ error: "missing name" }, 400);
  const email = await env.PICKS.get("nm:" + name.toLowerCase());
  if (!email) return json({ error: "not found" }, 404);
  const { ordered, aggs } = await pickemBoardData(env, url);
  const ag = (await pkGet(env, "ag:" + email)) || { name, byEvent: {} };
  const ranks = playerRanks(aggs, ordered, ag.name || name);
  return json({ ...userHistory(ag, ordered), rankAll: ranks.all, rankLast5: ranks.last5 });
}

/* ─────────────────────────────────── responses ─────────────────────────────── */
const html = (body, status = 200, headers = {}) => new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8", ...headers } });
const json = (obj, status = 200, headers = {}) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...headers } });
const redirect = (loc, cookie) => { const h = { Location: loc }; if (cookie) h["Set-Cookie"] = cookie; return new Response(null, { status: 302, headers: h }); };
async function readBody(request) {
  const ct = request.headers.get("Content-Type") || "";
  if (ct.includes("application/json")) return await request.json();
  const form = await request.formData();
  return Object.fromEntries(form.entries());
}

/* ─────────────────────────────────── the Worker ────────────────────────────── */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      // ---- public API ----
      if (path === "/api/signup" && request.method === "POST") return handleSignup(request, env);
      if (path === "/api/login" && request.method === "POST") return handleLogin(request, env);
      if (path === "/api/logout") return redirect(env.SITE_URL + "/", clearCookie());
      if (path === "/api/checkout" && request.method === "POST") return handleCheckout(request, env);
      if (path === "/api/checkout/success") return handleCheckoutSuccess(request, env, url);
      if (path === "/api/portal") return handlePortal(request, env);
      if (path === "/api/stripe-webhook" && request.method === "POST") return handleWebhook(request, env);
      if (path === "/api/magic/start" && request.method === "POST") return handleMagicStart(request, env);
      if (path === "/api/magic/verify") return handleMagicVerify(request, env, url);
      if (path === "/api/change-password" && request.method === "POST") return handleChangePassword(request, env);
      if (path === "/api/reset/start" && request.method === "POST") return handleResetStart(request, env);
      if (path === "/api/reset/complete" && request.method === "POST") return handleResetComplete(request, env);
      if (path === "/api/contact" && request.method === "POST") return handleContact(request, env);
      if (path === "/healthz") return new Response("ok");

      // ---- pick'em (subscriber feature; each handler checks the session) ----
      if (path === "/api/pickem/name" && request.method === "GET") return handlePickemGetName(request, env);
      if (path === "/api/pickem/name" && request.method === "POST") return handlePickemSetName(request, env);
      if (path === "/api/pickem/save" && request.method === "POST") return handlePickemSave(request, env);
      if (path === "/api/pickem/mine") return handlePickemMine(request, env, url);
      if (path === "/api/pickem/history") return handlePickemHistory(request, env, url);
      if (path === "/api/pickem/leaderboard") return handlePickemLeaderboard(request, env, url);
      if (path === "/api/pickem/player") return handlePickemPlayer(request, env, url);

      // ---- public pages ----
      // Auth-entry pages: if already logged in, skip them and go to the app
      // (or /subscribe if the account isn't subscribed yet).
      if (path === "/login" || path === "/signup" || path === "/forgot") {
        const s = await readSession(request, env);
        if (s) {
          const u = await getUser(env, s.email);
          return redirect(env.SITE_URL + (u?.subscribed ? "/" : "/subscribe"));
        }
        if (path === "/login") return html(loginPage());
        if (path === "/signup") return html(signupPage());
        return html(forgotPasswordPage());
      }
      if (path === "/subscribe") return html(subscribePage(url.searchParams.get("canceled")));
      if (path === "/reset") return html(resetPasswordPage(url.searchParams.get("token") || ""));
      if (path === "/terms") return html(termsPage());
      if (path === "/privacy") return html(privacyPage());
      if (path === "/contact") return html(contactPage());
      if (path === "/about") return html(aboutPage());

      // ---- account page (must be logged in) ----
      if (path === "/account") {
        const s = await readSession(request, env);
        if (!s) return redirect(env.SITE_URL + "/login");
        const u = await getUser(env, s.email);
        return html(accountPage(s.email, !!u?.subscribed));
      }
      if (path === "/change-password") {
        const s = await readSession(request, env);
        if (!s) return redirect(env.SITE_URL + "/login");
        return html(changePasswordPage());
      }

      // ---- public marketing assets ----
      // Serve just the landing page's thumbnails/share-image/favicons publicly;
      // everything else under ./public stays gated below.
      if (PUBLIC_LANDING_ASSETS.has(path)) {
        const a = await env.ASSETS.fetch(request);
        if (a.status === 200) {
          const r = new Response(a.body, a);
          r.headers.set("Cache-Control", "public, max-age=86400");
          return r;
        }
        return a;
      }

      // ---- everything else is GATED: the app, its data + photos ----
      const s = await readSession(request, env);

      // Internal, founder-only: model-performance scorecard. Requires a session
      // whose email is on the founder allow-list; not linked anywhere and never
      // shown to ordinary subscribers.
      if (path === "/scorecard") {
        if (!s || !FOUNDER_EMAILS.has(s.email)) return redirect(env.SITE_URL + "/");
        return html(scorecardPage(scorecardData), 200, { "Cache-Control": "private, no-store" });
      }

      if (path === "/" || path === "/index.html") {
        if (!s) return html(landingPage());                    // logged-out -> marketing
        // refresh subscription status from KV so cancellations/renewals reflect fast
        const u = await getUser(env, s.email);
        const subscribed = !!u?.subscribed;
        if (!subscribed) return redirect(env.SITE_URL + "/subscribe");
        const cookie = subscribed !== s.sub ? await makeSessionCookie(env, s.email, subscribed) : null;
        const res = await env.ASSETS.fetch(new Request(new URL("/index.html", url), request));
        const out = new Response(res.body, res);
        out.headers.set("Cache-Control", "private, no-store");
        if (cookie) out.headers.append("Set-Cookie", cookie);
        return out;
      }

      // app sub-resources (data json, photos, logo, etc.) — require a subscribed session
      if (!s || !s.sub) return redirect(env.SITE_URL + "/");
      const asset = await env.ASSETS.fetch(request);
      if (path.startsWith("/data/")) {                 // don't let the crown-jewel data get cached
        const r = new Response(asset.body, asset);
        r.headers.set("Cache-Control", "private, no-store");
        return r;
      }
      return asset;
    } catch (err) {
      return html(notePage("Something went wrong", String(err && err.message || err)), 500);
    }
  },
};

/* ─────────────────────────────── route handlers ────────────────────────────── */
async function handleSignup(request, env) {
  const { email, password } = await readBody(request);
  const e = normEmail(email);
  if (!e || !password || password.length < 8) return json({ error: "Enter an email and a password of at least 8 characters." }, 400);
  const existing = await getUser(env, e);
  if (existing && existing.passHash) return json({ error: "An account with that email already exists — log in instead." }, 409);
  const { passHash, passSalt } = await hashPassword(password);
  const u = Object.assign(existing || { email: e, createdAt: Date.now(), subscribed: false }, { passHash, passSalt });
  await putUser(env, e, u);
  const cookie = await makeSessionCookie(env, e, !!u.subscribed);
  if (u.subscribed) return json({ ok: true, redirect: "/" }, 200, { "Set-Cookie": cookie });
  const checkoutUrl = await createCheckout(env, e, u.stripeCustomerId);
  return json({ ok: true, redirect: checkoutUrl }, 200, { "Set-Cookie": cookie });
}

async function handleLogin(request, env) {
  const { email, password } = await readBody(request);
  const e = normEmail(email);
  const u = await getUser(env, e);
  if (!u || !(await verifyPassword(password, u.passHash, u.passSalt))) return json({ error: "Incorrect email or password." }, 401);
  const cookie = await makeSessionCookie(env, e, !!u.subscribed);
  return json({ ok: true, redirect: u.subscribed ? "/" : "/subscribe" }, 200, { "Set-Cookie": cookie });
}

async function handleCheckout(request, env) {
  const s = await readSession(request, env);
  const body = await readBody(request).catch(() => ({}));
  const e = normEmail(s?.email || body.email);
  if (!e) return json({ error: "Log in first." }, 401);
  const u = await getUser(env, e);
  const checkoutUrl = await createCheckout(env, e, u?.stripeCustomerId);
  return json({ ok: true, redirect: checkoutUrl });
}

async function handleCheckoutSuccess(request, env, url) {
  const sessionId = url.searchParams.get("session_id");
  if (!sessionId) return redirect(env.SITE_URL + "/");
  const cs = await stripe(env, "checkout/sessions/" + sessionId, "GET");
  const email = normEmail(cs.client_reference_id || cs.customer_details?.email || cs.customer_email);
  const paid = cs.payment_status === "paid" || cs.status === "complete";
  if (email && paid) {
    await markSubscribed(env, email, cs.customer, true);
    const cookie = await makeSessionCookie(env, email, true);
    return redirect(env.SITE_URL + "/?welcome=1", cookie);
  }
  return redirect(env.SITE_URL + "/subscribe");
}

// Stripe Customer Portal — lets a subscriber manage or cancel their subscription
// and update their card. Requires the Customer Portal to be enabled once in the
// Stripe dashboard (Settings -> Billing -> Customer portal), in both test and live.
async function handlePortal(request, env) {
  const s = await readSession(request, env);
  if (!s) return redirect(env.SITE_URL + "/login");
  const u = await getUser(env, s.email);
  if (!u || !u.stripeCustomerId) return redirect(env.SITE_URL + "/");
  try {
    const session = await stripe(env, "billing_portal/sessions", "POST", {
      customer: u.stripeCustomerId,
      return_url: env.SITE_URL + "/",
    });
    return redirect(session.url);
  } catch (e) {
    return html(notePage("Billing portal unavailable", "Couldn't open the billing portal just now — please try again in a moment."), 500);
  }
}

// Change password for a logged-in user — requires the current password.
async function handleChangePassword(request, env) {
  const s = await readSession(request, env);
  if (!s) return json({ error: "Please log in again." }, 401);
  const { current, password } = await readBody(request);
  if (!password || password.length < 8) return json({ error: "New password must be at least 8 characters." }, 400);
  const u = await getUser(env, s.email);
  if (!u || !(await verifyPassword(current, u.passHash, u.passSalt))) return json({ error: "Your current password is incorrect." }, 401);
  const { passHash, passSalt } = await hashPassword(password);
  u.passHash = passHash; u.passSalt = passSalt;
  await putUser(env, s.email, u);
  return json({ ok: true });
}

// Forgot password — email a reset link (mirrors magic-link, distinct "r:" token).
async function handleResetStart(request, env) {
  const { email } = await readBody(request);
  const e = normEmail(email);
  if (!e) return json({ error: "Enter your email." }, 400);
  const u = await getUser(env, e);   // only send if the account exists (no enumeration)
  if (u) {
    const token = randHex(32);
    await env.MAGIC.put("r:" + token, e, { expirationTtl: 900 }); // 15 min
    const link = `${env.SITE_URL}/reset?token=${token}`;
    await sendEmail(env, e, "Reset your GillyLab password",
      `<p>Click to set a new password for GillyLab:</p><p><a href="${link}">${link}</a></p><p>This link expires in 15 minutes. If you didn't request it, ignore this email.</p>`);
  }
  return json({ ok: true });
}

// Forgot password — set the new password from a valid reset token, then sign in.
async function handleResetComplete(request, env) {
  const { token, password } = await readBody(request);
  if (!token) return json({ error: "Invalid reset link." }, 400);
  if (!password || password.length < 8) return json({ error: "Password must be at least 8 characters." }, 400);
  const e = await env.MAGIC.get("r:" + token);
  if (!e) return json({ error: "That reset link has expired or was already used. Request a new one." }, 400);
  await env.MAGIC.delete("r:" + token);
  const u = (await getUser(env, e)) || { email: e, createdAt: Date.now(), subscribed: false };
  const { passHash, passSalt } = await hashPassword(password);
  u.passHash = passHash; u.passSalt = passSalt;
  await putUser(env, e, u);
  const cookie = await makeSessionCookie(env, e, !!u.subscribed);
  return json({ ok: true, redirect: env.SITE_URL + (u.subscribed ? "/" : "/subscribe") }, 200, { "Set-Cookie": cookie });
}

async function handleWebhook(request, env) {
  const payload = await request.text();
  const sig = request.headers.get("Stripe-Signature");
  if (!(await verifyStripeSig(payload, sig, env.STRIPE_WEBHOOK_SECRET))) return new Response("bad signature", { status: 400 });
  const event = JSON.parse(payload);
  const obj = event.data.object;
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const email = normEmail(obj.client_reference_id || obj.customer_details?.email || obj.customer_email);
        if (email) await markSubscribed(env, email, obj.customer, true);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const active = ["active", "trialing", "past_due"].includes(obj.status);
        const email = await emailForCustomer(env, obj.customer);
        if (email) await markSubscribed(env, email, obj.customer, active, { subStatus: obj.status });
        break;
      }
      case "customer.subscription.deleted": {
        const email = await emailForCustomer(env, obj.customer);
        if (email) await markSubscribed(env, email, obj.customer, false, { subStatus: "canceled" });
        break;
      }
    }
  } catch (e) { /* don't 500 the webhook — Stripe would retry forever; log-and-ack */ }
  return new Response("ok");
}

async function handleMagicStart(request, env) {
  const { email } = await readBody(request);
  const e = normEmail(email);
  if (!e) return json({ error: "Enter your email." }, 400);
  // Always respond ok (don't reveal whether an account exists).
  const u = await getUser(env, e);
  if (u) {
    const token = randHex(32);
    await env.MAGIC.put("m:" + token, e, { expirationTtl: 900 }); // 15 min
    const link = `${env.SITE_URL}/api/magic/verify?token=${token}`;
    await sendEmail(env, e, "Your GillyLab sign-in link",
      `<p>Click to sign in to GillyLab:</p><p><a href="${link}">${link}</a></p><p>This link expires in 15 minutes. If you didn't request it, ignore this email.</p>`);
  }
  return json({ ok: true });
}

async function handleMagicVerify(request, env, url) {
  const token = url.searchParams.get("token");
  if (!token) return redirect(env.SITE_URL + "/login");
  const e = await env.MAGIC.get("m:" + token);
  if (!e) return html(notePage("Link expired", "That sign-in link has expired or was already used. Request a new one from the login page."), 400);
  await env.MAGIC.delete("m:" + token);
  const u = await getUser(env, e);
  const cookie = await makeSessionCookie(env, e, !!u?.subscribed);
  return redirect(env.SITE_URL + (u?.subscribed ? "/" : "/subscribe"), cookie);
}
