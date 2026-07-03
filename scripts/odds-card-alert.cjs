#!/usr/bin/env node
/* Card-discrepancy alert. The betting-odds feed (data/odds.json, the-odds-api)
 * updates faster than the card/lineup feed (data/event.json, Cito API), so this
 * compares them and emails when an UPCOMING card looks out of date — either a
 * fighter's opponent changed, or a booked bout is missing from the card.
 *
 * Kept quiet by design:
 *   - anchored to events already in event.json (matched by date within ±48h), so
 *     speculative/futures lines and other-promotion cards are ignored;
 *   - "missing bout" flags require at least one fighter to exist in our own
 *     database (data/fight-stats.json keys), filtering non-UFC noise;
 *   - de-duplicated via data/odds-alert-state.json — each discrepancy is emailed
 *     once when it first appears, not every run, and clears when it's resolved
 *     (e.g. after you add an override, or once Cito catches up).
 *
 * Runs in the update-odds workflow AFTER the override steps, so anything you've
 * already patched doesn't alert. Non-fatal: never fails the workflow.
 *
 * Env: RESEND_API_KEY, ALERT_EMAIL (recipient). Optional ALERT_FROM.
 */
const fs = require('fs');
const path = require('path');
const DATA = path.join(__dirname, '..', 'data');
const STATE_PATH = path.join(DATA, 'odds-alert-state.json');
const WINDOW_MS = 48 * 3600 * 1000;

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const ALERT_EMAIL = process.env.ALERT_EMAIL;
const FROM = process.env.ALERT_FROM || 'GillyLab Alerts <alerts@gillylab.com>';

const load = (p, def) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return def; } };
// Tokenize a name robustly: strip accents, turn hyphens/apostrophes/dots into
// spaces (so "Saint-Denis" == "Saint Denis", "O'Malley" == "O Malley"), and drop
// generational suffixes (Jr/Sr/II/III/IV) so "Rountree Jr." == "Rountree".
const SUFFIX = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v']);
const tokens = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[-'.]/g, ' ').replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter(Boolean).filter(t => !SUFFIX.has(t));
const lastName = s => { const t = tokens(s); return t[t.length - 1] || ''; };
// Two names match if their last name AND first-initial agree (disambiguates
// shared surnames without demanding exact spelling).
const nameMatch = (a, b) => { const ta = tokens(a), tb = tokens(b); return !!(ta.length && tb.length) && ta[ta.length - 1] === tb[tb.length - 1] && ta[0][0] === tb[0][0]; };
const esc = s => String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

function main() {
  const evDoc = load(path.join(DATA, 'event.json'), {});
  const events = (evDoc.data || evDoc || []).filter(e => e && e.startsAt && (e.bouts || []).length);
  const oddsDoc = load(path.join(DATA, 'odds.json'), []);
  const odds = Array.isArray(oddsDoc) ? oddsDoc : (oddsDoc.data || []);
  if (!events.length || !odds.length) { console.log('alert: no events/odds to compare'); return; }

  // Known-fighter last names from our own DB (fight-stats.json keys) — used to
  // filter non-UFC bouts out of "missing bout" flags.
  const known = new Set();
  const box = load(path.join(DATA, 'fight-stats.json'), {});
  for (const name of Object.keys(box)) known.add(lastName(name));

  const cardOf = e => (e.bouts || []).map(b => (b.fighters || []).map(f => f.fighterName || '').filter(Boolean));
  const otherName = (bout, who) => bout.find(n => !nameMatch(n, who)) || '';

  const found = [];  // { key, text }
  for (const line of odds) {
    const home = line.home_team, away = line.away_team, ct = Date.parse(line.commence_time);
    if (!home || !away || isNaN(ct)) continue;
    let ev = null, delta = Infinity;
    for (const e of events) { const d = Math.abs(Date.parse(e.startsAt) - ct); if (d < delta) { delta = d; ev = e; } }
    if (!ev || delta > WINDOW_MS) continue;          // speculative / other promotion → ignore
    const card = cardOf(ev);
    const aL = lastName(away), hL = lastName(home);
    if (!aL || !hL) continue;
    if (card.some(b => b.some(n => nameMatch(n, away)) && b.some(n => nameMatch(n, home)))) continue;  // already on the card → fine

    const aBout = card.find(b => b.some(n => nameMatch(n, away)));
    const hBout = card.find(b => b.some(n => nameMatch(n, home)));
    const evName = ev.title || ev.slug || 'event';
    if (aBout && !hBout) {
      const cardOpp = otherName(aBout, away);
      found.push({ key: `chg|${ev.slug}|${aL}|${hL}`, text: `${evName}: ${away} is listed vs ${home} in the odds, but the card still shows ${away} vs ${cardOpp}. (opponent change → fighter-overrides.json)` });
    } else if (hBout && !aBout) {
      const cardOpp = otherName(hBout, home);
      found.push({ key: `chg|${ev.slug}|${hL}|${aL}`, text: `${evName}: ${home} is listed vs ${away} in the odds, but the card still shows ${home} vs ${cardOpp}. (opponent change → fighter-overrides.json)` });
    } else if (!aBout && !hBout) {
      if (!known.has(aL) && !known.has(hL)) continue;   // neither is a known UFC fighter → likely another promotion
      const k = [aL, hL].sort().join('|');
      found.push({ key: `miss|${ev.slug}|${k}`, text: `${evName}: ${away} vs ${home} is in the odds feed but not on the card. (missing bout → missing-bout-overrides.json)` });
    }
    // both on the card in different bouts → ambiguous/speculative → skip
  }

  const prev = new Set((load(STATE_PATH, { flagged: [] }).flagged) || []);
  const current = found.map(f => f.key);
  const fresh = found.filter(f => !prev.has(f.key));
  fs.writeFileSync(STATE_PATH, JSON.stringify({ flagged: [...new Set(current)].sort() }, null, 2) + '\n');

  if (!fresh.length) { console.log(`alert: ${found.length} active discrepancy(ies), none new`); return; }
  console.log(`alert: ${fresh.length} NEW discrepancy(ies):`);
  fresh.forEach(f => console.log('  -', f.text));
  sendEmail(fresh).catch(e => console.log('alert email error:', e.message));
}

async function sendEmail(fresh) {
  if (!RESEND_API_KEY || !ALERT_EMAIL) { console.log('alert: RESEND_API_KEY / ALERT_EMAIL not set — skipping email'); return; }
  const items = fresh.map(f => `<li>${esc(f.text)}</li>`).join('');
  const html = `<p>GillyLab spotted ${fresh.length} card change(s) the odds feed has but the event feed doesn't yet:</p><ul>${items}</ul><p style="color:#888;font-size:13px">Add the noted override in data/ (and it'll re-apply every fetch until Cito catches up). You won't be emailed about these again unless they change.</p>`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: ALERT_EMAIL, subject: `GillyLab: ${fresh.length} card discrepancy(ies) to review`, html }),
  });
  console.log(res.ok ? `alert: emailed ${ALERT_EMAIL}` : `alert: email failed ${res.status} ${await res.text()}`);
}

try { main(); } catch (e) { console.log('alert: non-fatal error —', e.message); }
