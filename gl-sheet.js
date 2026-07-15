/* AUTO-GENERATED from index.html by scripts/gen-gl-sheet.cjs — do not edit by hand. */
const GL_SHEET = (function () {
  const W = 1080, H = 1920;
  const BG = '#0e1014', CARD = '#14161b', LINE = 'rgba(255,255,255,0.10)';
  const TXT = '#f0f0f0', MUT = '#8a8d94', ACC = '#00e668', AMB = '#ffcf7a', FOOT = '#6f727a';
  const SANS = "'Barlow', sans-serif", COND = "'Barlow Condensed', sans-serif";
  // Same detection as the parlay slip: only iOS routes Save through the share
  // sheet, because its sheet is the only path to Photos.
  const IOS = (function () {
    const ua = navigator.userAgent || '';
    return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1);
  })();

  const fontsReady = () => (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function wrap(ctx, text, maxW) {
    const words = String(text || '').split(/\s+/).filter(Boolean), out = [];
    let line = '';
    for (const w of words) {
      const t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
    }
    if (line) out.push(line);
    return out;
  }
  function clip(ctx, text, maxW) {
    let s = String(text || '');
    if (ctx.measureText(s).width <= maxW) return s;
    while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
    return s + '…';
  }
  const loadOne = (src) => new Promise((res) => {
    if (!src) return res(null);
    const im = new Image();
    im.onload = () => res(im); im.onerror = () => res(null);
    im.src = src;
  });
  // photos/thumb/*.png are 110x80 — drawing one into a 220px disc upscaled it
  // ~2.8x and it showed. photos/*.jpg are 350x254, enough for the disc at 2x
  // device pixel ratio. Fall back to the thumb only if the full-res is missing.
  async function loadImg(slug) {
    if (!slug) return null;
    return (await loadOne('./photos/' + slug + '.jpg')) || (await loadOne('./photos/thumb/' + slug + '.png'));
  }
  // The GL fist mark, loaded once and reused across every share sheet's wordmark.
  let _brandLogoP;
  function loadBrandLogo() { return (_brandLogoP = _brandLogoP || loadOne('gl-logo.png?v=8')); }

  function meta(name) {
    const f = (typeof FIGHTERS !== 'undefined') ? FIGHTERS.find(x => x && x.name === name) : null;
    const s = (typeof FIGHTER_STATS !== 'undefined' && FIGHTER_STATS[name]) || {};
    return {
      name: name,
      record: (f && f.record) || '—',
      rank: (f && f.rank) || 'NR',
      division: (f && f.division) || '',
      initials: (f && f.initials) || (name || '').split(/\s+/).map(p => p[0]).join('').slice(0, 3).toUpperCase(),
      ht: s.ht || null, reach: s.reach || null, stance: s.stance || null, dob: s.dob || null,
      slug: (typeof nameToSlug === 'function') ? nameToSlug(name) : null
    };
  }
  // Neutral pair, used when we have no odds and therefore no favourite. The brand
  // accent means "favourite"; handing it to whoever happens to be listed first
  // would let the sheet imply a pick it never made.
  const NEU_A = '#8ab4ff', NEU_B = '#ffcf7a';
  function hexA(hex, alpha) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alpha + ')';
  }
  const fmtPrice = (p) => (p > 0 ? '+' : '') + p;

  // data/odds.json once, shared. Resolves null on any failure — the odds row is
  // optional and a missing moneyline must never block the sheet.
  let oddsPromise = null;
  function oddsJson() {
    if (!oddsPromise) oddsPromise = fetch('./data/odds.json').then((r) => r.ok ? r.json() : null).catch(() => null);
    return oddsPromise;
  }
  // American odds <-> implied probability. Averaging prices directly is wrong:
  // -300 and +300 are not symmetric, so the mean of the two prices is nonsense.
  // Average in probability space, then convert back.
  const toProb = (p) => (p > 0 ? 100 / (p + 100) : -p / (-p + 100));
  const toAmerican = (q) => (q >= 0.5 ? -Math.round((100 * q) / (1 - q)) : Math.round((100 * (1 - q)) / q));

  // One consensus moneyline, averaged across every book that prices the fight,
  // rather than quoting a single sportsbook. Uses the odds page's own name matcher.
  async function oddsFor(nameA, nameB) {
    const data = await oddsJson();
    if (!Array.isArray(data)) return null;
    const like = window.namesLikelyMatch || ((x, y) => x === y);
    const ev = data.find((e) => e && e.home_team && e.away_team &&
      ((like(e.home_team, nameA) && like(e.away_team, nameB)) ||
       (like(e.home_team, nameB) && like(e.away_team, nameA))));
    if (!ev || !Array.isArray(ev.bookmakers)) return null;
    const qa = [], qb = [];
    ev.bookmakers.forEach((bk) => {
      const mkt = (bk.markets || []).find((m) => m.key === 'h2h');
      if (!mkt || !Array.isArray(mkt.outcomes)) return;
      const pa = (mkt.outcomes.find((o) => like(o.name, nameA)) || {}).price;
      const pb = (mkt.outcomes.find((o) => like(o.name, nameB)) || {}).price;
      if (pa == null || pb == null) return;
      qa.push(toProb(pa)); qb.push(toProb(pb));
    });
    if (!qa.length) return null;
    const mean = (xs) => xs.reduce((t, v) => t + v, 0) / xs.length;
    const ma = mean(qa), mb = mean(qb);
    return {
      a: toAmerican(ma), b: toAmerican(mb),
      books: qa.length,
      favA: ma > mb, favB: mb > ma,   // favourite = higher implied probability
    };
  }

  // Last five, most recent first. The fastest-reading thing on a fight graphic.
  function recentForm(name) {
    const FH = (typeof FIGHT_HISTORY !== 'undefined' && FIGHT_HISTORY[name]) || [];
    return FH.filter((f) => f && f.result && f.result !== '–' && f.method !== 'Upcoming')
      .slice(0, 5).map((f) => f.result).reverse();   // oldest -> newest, reads left to right
  }
  const FORM_COL = { W: '#00e668', L: '#ff6a5e', D: '#8a8d94', NC: '#8a8d94' };
  function formChips(ctx, cx, y, form) {
    if (!form.length) return;
    const w = 34, h = 26, gap = 7;
    const total = form.length * w + (form.length - 1) * gap;
    let x = cx - total / 2;
    form.forEach((r) => {
      roundRect(ctx, x, y, w, h, 5);
      ctx.fillStyle = hexA(FORM_COL[r] || '#8a8d94', 0.16); ctx.fill();
      ctx.strokeStyle = hexA(FORM_COL[r] || '#8a8d94', 0.5); ctx.lineWidth = 1; ctx.stroke();
      ctx.font = '700 19px ' + SANS; ctx.fillStyle = FORM_COL[r] || '#8a8d94';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(r, x + w / 2, y + h / 2 + 1);
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
      x += w + gap;
    });
  }
  // FIGHTERS.rank already carries its own '#' ("#4"), and champions are stored as
  // "C" / "#C" / "#IC". Prefixing another '#' produced Max Holloway's "##4".
  function rankTag(rank) {
    if (!rank || rank === 'NR') return '';
    const t = String(rank).replace(/^#/, '');
    if (t === 'C') return '  ·  Champion';
    if (t === 'IC') return '  ·  Interim champ';
    return '  ·  #' + t;
  }
  function ageOf(dob) {
    if (!dob) return null;
    const d = new Date(dob); if (isNaN(d.getTime())) return null;
    const t = new Date(); let a = t.getFullYear() - d.getFullYear();
    const m = t.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && t.getDate() < d.getDate())) a--;
    return a >= 0 && a < 90 ? a : null;
  }

  // A circular headshot, or the fighter's initials on a disc when we have no photo.
  function avatar(ctx, img, cx, cy, r, initials, ring) {
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath();
    ctx.fillStyle = '#1b1e25'; ctx.fill();
    if (img) {
      ctx.clip();
      // cover-fit: fill the disc, crop the overflow, never squash the face
      const s = Math.max((r * 2) / img.width, (r * 2) / img.height);
      const dw = img.width * s, dh = img.height * s;
      ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
    } else {
      ctx.fillStyle = MUT; ctx.font = '700 30px ' + COND;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(initials || '?', cx, cy + 2);
    }
    ctx.restore();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = ring; ctx.lineWidth = 3; ctx.stroke();
  }

  function brand(ctx, y, kicker, logo) {
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    let tx = 64;
    if (logo && logo.width) {
      const bh = 52, bw = logo.width * (bh / logo.height);
      ctx.drawImage(logo, 64, y - 40, bw, bh);   // vertically centered on the wordmark
      tx = 64 + bw + 16;
    }
    ctx.font = '800 34px ' + COND;
    ctx.fillStyle = TXT; ctx.fillText('GILLY', tx, y);
    const w = ctx.measureText('GILLY').width;
    ctx.fillStyle = ACC; ctx.fillText('LAB', tx + w, y);
    if (kicker) {
      ctx.textAlign = 'right'; ctx.font = '700 22px ' + COND;
      ctx.fillStyle = MUT; ctx.fillText(String(kicker).toUpperCase(), W - 64, y);
      ctx.textAlign = 'left';
    }
  }
  // The matchup sheet is a 1080x1920 story; the sim sheet carries far less and is
  // a 1080x1080 square. Height is per-sheet, so the footer takes it as an argument.
  function footer(ctx, h) {
    ctx.textAlign = 'center'; ctx.font = '400 24px ' + SANS; ctx.fillStyle = FOOT;
    ctx.fillText('gillylab.com · not betting advice', W / 2, h - 40);
    ctx.textAlign = 'left';
  }
  // Header + both fighters, shared by the two sheets. Returns the y to carry on from.
  function versusBlock(ctx, a, b, imgA, imgB, y, radius, colA, colB, showForm) {
    const cxA = 280, cxB = W - 280, R = radius || 46;
    colA = colA || NEU_A; colB = colB || NEU_B;
    avatar(ctx, imgA, cxA, y + R, R, a.initials, colA);
    avatar(ctx, imgB, cxB, y + R, R, b.initials, colB);
    ctx.textAlign = 'center'; ctx.font = '800 60px ' + COND; ctx.fillStyle = MUT;
    ctx.fillText('VS', W / 2, y + R + 20);

    let ny = y + 2 * R + 56;
    ctx.fillStyle = TXT;
    // Shrink both names in lockstep until the longest fits, so "Christian Leroy
    // Duncan" is not clipped to "Christian Leroy Dunc…". Clip only as a last resort.
    const nmA = a.name.toUpperCase(), nmB = b.name.toUpperCase();
    const nameMaxW = 460;
    let nameSize = 46;
    const nameFits = (s) => { ctx.font = '700 ' + s + 'px ' + COND; return ctx.measureText(nmA).width <= nameMaxW && ctx.measureText(nmB).width <= nameMaxW; };
    while (nameSize > 30 && !nameFits(nameSize)) nameSize -= 2;
    ctx.font = '700 ' + nameSize + 'px ' + COND;
    ctx.fillText(clip(ctx, nmA, nameMaxW), cxA, ny);
    ctx.fillText(clip(ctx, nmB, nameMaxW), cxB, ny);
    ny += 40;
    ctx.font = '400 28px ' + SANS; ctx.fillStyle = MUT;
    ctx.fillText(a.record + rankTag(a.rank), cxA, ny);
    ctx.fillText(b.record + rankTag(b.rank), cxB, ny);
    ctx.textAlign = 'left';
    if (!showForm) return ny + 46;
    const fa = recentForm(a.name), fb = recentForm(b.name);
    if (!fa.length && !fb.length) return ny + 46;
    formChips(ctx, cxA, ny + 18, fa);
    formChips(ctx, cxB, ny + 18, fb);
    return ny + 76;
  }

  // "5'10"  HEIGHT  6'1"" — value, centred label, value.
  function tapeRow(ctx, label, va, vb, y, hiA, hiB, colA, colB) {
    ctx.textAlign = 'left'; ctx.font = '700 42px ' + COND;
    ctx.fillStyle = hiA ? (colA || NEU_A) : TXT; ctx.fillText(va == null ? '—' : String(va), 64, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = hiB ? (colB || NEU_B) : TXT; ctx.fillText(vb == null ? '—' : String(vb), W - 64, y);
    ctx.textAlign = 'center'; ctx.font = '600 24px ' + SANS; ctx.fillStyle = MUT;
    ctx.fillText(String(label).toUpperCase(), W / 2, y - 4);
    ctx.textAlign = 'left';
  }
  // Striker ↔ grappler spectrum. lean is 0..100, 100 = pure striker.
  // Two coloured dots on a bar say nothing about who is who — the colour key is
  // 400px further up the sheet. Label each dot with the fighter's surname in his
  // own colour. Similar styles put the dots as little as 19px apart (leans 52 vs
  // 50), so when the labels would overlap they stack instead of colliding.
  function styleBar(ctx, y, leanA, leanB, colA, colB, nameA, nameB) {
    const x = 64, w = W - 128, h = 18;
    colA = colA || NEU_A; colB = colB || NEU_B;
    const surname = (n) => {
      const t = String(n || '').trim().split(/\s+/).filter(Boolean);
      let i = t.length - 1;
      while (i > 0 && /^(jr|sr|ii|iii|iv)\.?$/i.test(t[i])) i--;   // 'Rountree Jr.' -> ROUNTREE
      return (t[i] || String(n || '')).toUpperCase();
    };
    const px = (lean) => (lean == null ? null : x + w * (lean / 100));
    const pa = px(leanA), pb = px(leanB);

    ctx.font = '700 24px ' + COND;
    const la = surname(nameA), lb = surname(nameB);
    const wa = ctx.measureText(la).width, wb = ctx.measureText(lb).width;
    // stack only when the two labels would actually touch
    const collide = pa != null && pb != null && Math.abs(pa - pb) < (wa + wb) / 2 + 16;
    const label = (p, txt, col, dy) => {
      if (p == null) return;
      const half = ctx.measureText(txt).width / 2;
      const cx = Math.min(Math.max(p, x + half), x + w - half);   // never run off the bar
      ctx.textAlign = 'center'; ctx.fillStyle = col;
      ctx.fillText(txt, cx, y + dy);
      ctx.textAlign = 'left';
    };
    label(pa, la, colA, collide ? -58 : -24);
    label(pb, lb, colB, -24);

    roundRect(ctx, x, y, w, h, h / 2); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill();
    const dot = (p, col) => {
      if (p == null) return;
      ctx.beginPath(); ctx.arc(p, y + h / 2, 17, 0, Math.PI * 2);
      ctx.fillStyle = col; ctx.fill();
      ctx.strokeStyle = BG; ctx.lineWidth = 4; ctx.stroke();
    };
    dot(pa, colA); dot(pb, colB);
    ctx.font = '600 23px ' + SANS; ctx.fillStyle = MUT;
    ctx.textAlign = 'left'; ctx.fillText('GRAPPLER', x, y + 54);
    ctx.textAlign = 'right'; ctx.fillText('STRIKER', x + w, y + 54);
    ctx.textAlign = 'left';
  }

  // A tinted block of wrapped prose, keyed to one fighter's colour.
  function pathBlock(ctx, name, text, colour, y, maxLines) {
    const x = 64, w = W - 128;
    ctx.font = '400 28px ' + SANS;
    const cap = maxLines || 5;
    const all = wrap(ctx, text, w - 48);
    const lines = all.slice(0, cap);
    // Dropping the overflow words silently would end the sentence mid-thought on
    // an image meant for sharing. Mark the cut.
    if (all.length > cap) lines[cap - 1] = clip(ctx, lines[cap - 1] + ' …', w - 48);
    const h = 58 + lines.length * 37;
    roundRect(ctx, x, y, w, h, 12);
    ctx.fillStyle = hexA(colour, 0.07); ctx.fill();
    ctx.strokeStyle = hexA(colour, 0.24);
    ctx.lineWidth = 1; ctx.stroke();
    ctx.font = '700 30px ' + COND; ctx.fillStyle = colour;
    ctx.fillText(String(name).toUpperCase(), x + 24, y + 40);
    ctx.font = '400 28px ' + SANS; ctx.fillStyle = TXT;
    lines.forEach((ln, i) => ctx.fillText(ln, x + 24, y + 76 + i * 37));
    return y + h + 14;
  }
  function sectionTitle(ctx, t, y) {
    // hairline above the label groups the block visually — at 1080px wide the old
    // bare 24px label read as a stray word rather than a heading.
    ctx.strokeStyle = LINE; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(64, y - 40.5); ctx.lineTo(W - 64, y - 40.5); ctx.stroke();
    ctx.font = '700 29px ' + SANS; ctx.fillStyle = TXT;
    ctx.fillText(String(t).toUpperCase(), 64, y);
    return y + 30;
  }
  // Career-stat comparison. `higher` says which direction wins the line — strikes
  // absorbed per minute is won by the SMALLER number, so it can't just be a >.
  const H2H_ROWS = [
    ['Sig. strikes / min', 'slpm', true],
    ['Striking accuracy', 'strAcc', true],
    ['Sig. strikes absorbed / min', 'sapm', false],
    ['Striking defense', 'strDef', true],
    ['Takedowns / 15 min', 'tdLanded', true],
    ['Takedown accuracy', 'tdAcc', true],
    ['Takedown defense', 'tdDef', true],
    ['Sub. attempts / 15 min', 'subAvg', true],
  ];
  const statNum = (v) => { if (v == null) return null; const m = /-?[\d.]+/.exec(String(v)); return m ? parseFloat(m[0]) : null; };
  const statTxt = (v) => (v == null ? '—' : String(v));
  function h2hTable(ctx, sa, sb, y, sig, colA, colB) {
    sa = sa || {}; sb = sb || {}; sig = sig || {};
    colA = colA || NEU_A; colB = colB || NEU_B;
    H2H_ROWS.forEach((r) => {
      const label = r[0], key = r[1], higher = r[2];
      const na = statNum(sa[key]), nb = statNum(sb[key]);
      // A gap that doesn't clear the EDGE_AXES threshold is noise. Drawing ten
      // equally loud rows buries the three that actually separate these two.
      const real = !!sig[key];
      let hiA = false, hiB = false;
      if (real && na != null && nb != null && na !== nb) { const aWins = higher ? na > nb : na < nb; hiA = aWins; hiB = !aWins; }
      ctx.textAlign = 'left'; ctx.font = (hiA ? '700 37px ' : '400 37px ') + COND;
      ctx.fillStyle = hiA ? colA : (real ? TXT : MUT); ctx.fillText(statTxt(sa[key]), 64, y);
      ctx.textAlign = 'right'; ctx.font = (hiB ? '700 37px ' : '400 37px ') + COND;
      ctx.fillStyle = hiB ? colB : (real ? TXT : MUT); ctx.fillText(statTxt(sb[key]), W - 64, y);
      ctx.textAlign = 'center'; ctx.font = '400 24px ' + SANS; ctx.fillStyle = real ? MUT : FOOT;
      ctx.fillText(label, W / 2, y - 3);
      ctx.textAlign = 'left';
      y += 39;
    });
    return y;
  }


  // One fighter's method split. Percentages are of that fighter's own wins, and
  // carry the same 1% floor simMethodRowsHtml uses: a method that never landed in
  // this batch of trials isn't truly impossible.
  function methodCol(ctx, x, w, name, methods, wins, col, y) {
    ctx.textAlign = 'left';
    ctx.font = '700 28px ' + COND; ctx.fillStyle = col;
    ctx.fillText(clip(ctx, String(name).toUpperCase(), w), x, y);
    let yy = y + 34;
    ['KO/TKO', 'Submission', 'Decision'].forEach((k) => {
      let pct = wins > 0 ? Math.round(((methods[k] || 0) / wins) * 100) : 0;
      if (pct === 0 && wins > 0) pct = 1;
      ctx.font = '400 24px ' + SANS; ctx.fillStyle = TXT;
      ctx.textAlign = 'left'; ctx.fillText(k, x, yy + 18);
      ctx.textAlign = 'right'; ctx.font = '700 26px ' + COND; ctx.fillStyle = col;
      ctx.fillText(pct + '%', x + w, yy + 18);
      ctx.textAlign = 'left';
      roundRect(ctx, x, yy + 30, w, 10, 5); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill();
      roundRect(ctx, x, yy + 30, Math.max(6, w * (pct / 100)), 10, 5); ctx.fillStyle = col; ctx.fill();
      yy += 62;
    });
    return yy;
  }

  // Two shapes from one layout. The default is the full 1080x1920: it is the only
  // one that carries the style spectrum and both paths to victory, which are the
  // analysis the sheet exists to show off.
  //
  // 'portrait' is 1080x1350 (Instagram's 4:5 feed maximum) and physically cannot
  // hold them — style bar + paths cost 626px against ~217px of slack. Rather than
  // truncate the prose and shrink the type back to unreadable, portrait drops
  // those two blocks and keeps photos, form, odds, tape and head-to-head at full
  // size. It is a lighter variant, not a smaller copy.
  async function drawMatchup(nameA, nameB, ctxInfo, fmt) {
    await fontsReady();
    const a = meta(nameA), b = meta(nameB);
    const [imgA, imgB, logo] = await Promise.all([loadImg(a.slug), loadImg(b.slug), loadBrandLogo()]);
    // Same analysis object the Scouting Report renders from.
    const ins = (typeof renderMatchupBreakdown === 'function') ? (renderMatchupBreakdown(null, nameA, nameB, {}) || {}) : {};
    const odds = await oddsFor(nameA, nameB).catch(() => null);
    // The brand accent means FAVOURITE, never "listed first". With no market to
    // read, nobody gets it and both fighters take a neutral colour.
    const colA = odds ? (odds.favA ? ACC : AMB) : NEU_A;
    const colB = odds ? (odds.favB ? ACC : AMB) : NEU_B;

    const story = fmt !== 'portrait';   // full sheet unless portrait is asked for
    const CH = story ? H : 1350;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = CH;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = BG; ctx.fillRect(0, 0, W, CH);

    brand(ctx, 82, (ctxInfo && ctxInfo.event) || 'UFC', logo);
    ctx.font = '400 24px ' + SANS; ctx.fillStyle = MUT;
    // The BOUT's weight class first — a fighter's home division is not what he is
    // fighting at tonight. McGregor is FW on the roster and welterweight at UFC 329.
    // Only fall back to the roster division, expanded ('LW' is jargon off-site).
    const divName = (ctxInfo && ctxInfo.weightClass)
      || (window.simDivisionLabel ? window.simDivisionLabel(a.division) : a.division) || '';
    // Date stays under the wordmark; the weight class moves down to sit under the VS.
    const dateStr = (ctxInfo && ctxInfo.date) || '';
    if (dateStr) ctx.fillText(dateStr, 64, 118);

    let y = versusBlock(ctx, a, b, imgA, imgB, 152, 46, colA, colB, true);
    if (divName) {
      // Centered in the empty gap between the two fighters, just above the first
      // divider (the 'Tale of the tape' hairline sits at y + 5.5).
      ctx.save();
      ctx.textAlign = 'center'; ctx.font = '600 22px ' + SANS; ctx.fillStyle = MUT;
      ctx.fillText(divName.toUpperCase(), W / 2, y - 3);
      ctx.restore();
    }


    y = sectionTitle(ctx, 'Tale of the tape', y + 46);
    y += 44;
    const ageA = ageOf(a.dob), ageB = ageOf(b.dob);
    const inches = (v) => { const m = /([\d.]+)/.exec(String(v || '')); return m ? parseFloat(m[1]) : null; };
    const rA = inches(a.reach), rB = inches(b.reach);
    tapeRow(ctx, 'height', a.ht, b.ht, y, false, false, colA, colB); y += 45;
    tapeRow(ctx, 'reach', a.reach, b.reach, y, rA != null && rB != null && rA > rB, rA != null && rB != null && rB > rA, colA, colB); y += 45;
    tapeRow(ctx, 'age', ageA, ageB, y, false, false, colA, colB); y += 45;
    tapeRow(ctx, 'stance', a.stance, b.stance, y, false, false, colA, colB); y += 45;
    // The moneyline belongs with the other head-to-head facts, not in a section of
    // its own. Smaller than the physical rows: it is context, not a measurement.
    if (odds) {
      ctx.textAlign = 'left'; ctx.font = '700 32px ' + COND;
      ctx.fillStyle = odds.favA ? colA : TXT; ctx.fillText(fmtPrice(odds.a), 64, y);
      ctx.textAlign = 'right'; ctx.fillStyle = odds.favB ? colB : TXT;
      ctx.fillText(fmtPrice(odds.b), W - 64, y);
      ctx.textAlign = 'center'; ctx.font = '400 20px ' + SANS; ctx.fillStyle = FOOT;
      ctx.fillText('CONSENSUS MONEYLINE · ' + odds.books + (odds.books === 1 ? ' BOOK' : ' BOOKS'), W / 2, y - 3);
      ctx.textAlign = 'left';
      y += 12;
    }
    y += 18;

    // Head-to-head career numbers, winner of each line in that fighter's colour.
    y = sectionTitle(ctx, 'Head to head', y + 44) + 38;
    y = h2hTable(ctx, ins.statsA, ins.statsB, y, ins.sig, colA, colB);

    if (story) {
      y = sectionTitle(ctx, 'Style', y + 40);
      styleBar(ctx, y + 76, ins.leanA, ins.leanB, colA, colB, a.name, b.name);
      y += 152;   // two label rows + bar + the GRAPPLER/STRIKER captions   // bar + the GRAPPLER/STRIKER captions beneath it

      y = sectionTitle(ctx, 'Path to victory', y + 42) + 14;
      if (ins.pathA) y = pathBlock(ctx, a.name, ins.pathA, colA, y, 4);
      if (ins.pathB) y = pathBlock(ctx, b.name, ins.pathB, colB, y, 4);
    }

    footer(ctx, CH);
    return cv;
  }

  async function drawSim(nameA, nameB, result, rounds) {
    await fontsReady();
    const a = meta(nameA), b = meta(nameB);
    const [imgA, imgB, logo] = await Promise.all([loadImg(a.slug), loadImg(b.slug), loadBrandLogo()]);
    const pctA = Math.round((result.winsA / result.n) * 100), pctB = 100 - pctA;
    const aLeads = pctA >= pctB;

    // Square. The sim sheet carries a fraction of the matchup sheet's content, so
    // a story would be mostly empty space; 1080x1080 also drops straight into a
    // feed or a chat without cropping.
    const CH = 1080;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = CH;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = BG; ctx.fillRect(0, 0, W, CH);

    brand(ctx, 72, 'Fight simulator', logo);
    // Sits on the right, directly under the "Fight simulator" kicker.
    ctx.textAlign = 'right'; ctx.font = '400 23px ' + SANS; ctx.fillStyle = MUT;
    ctx.fillText(result.n.toLocaleString() + ' simulations  ·  ' + rounds + ' rounds', W - 64, 104);
    ctx.textAlign = 'left';

    // Same rule as the matchup sheet: the accent marks the favourite, which here
    // the model actually knows.
    const colA = aLeads ? ACC : AMB, colB = aLeads ? AMB : ACC;
    let y = versusBlock(ctx, a, b, imgA, imgB, 150, 46, colA, colB, false);

    // Win probability — the headline number.
    y = sectionTitle(ctx, 'Win probability', y + 46) + 34;
    ctx.font = '800 104px ' + COND;
    ctx.textAlign = 'left'; ctx.fillStyle = aLeads ? colA : MUT; ctx.fillText(pctA + '%', 64, y + 76);
    ctx.textAlign = 'right'; ctx.fillStyle = aLeads ? MUT : colB; ctx.fillText(pctB + '%', W - 64, y + 76);
    ctx.textAlign = 'left';
    y += 100;
    const bx = 64, bw = W - 128, bh = 22;
    roundRect(ctx, bx, y, bw, bh, bh / 2); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill();
    ctx.save();
    roundRect(ctx, bx, y, bw, bh, bh / 2); ctx.clip();
    ctx.fillStyle = aLeads ? colA : MUT; ctx.fillRect(bx, y, bw * (pctA / 100), bh);
    ctx.fillStyle = aLeads ? MUT : colB; ctx.fillRect(bx + bw * (pctA / 100), y, bw * (pctB / 100), bh);
    ctx.restore();
    y += 74;

    // Method of victory for BOTH fighters, side by side. Each percentage is a share
    // of that fighter's own simulated wins, not of all trials — so each column
    // sums to 100 and the two are read independently.
    y = sectionTitle(ctx, 'How each fighter wins', y + 20) + 24;
    const gap = 44, colW = (W - 128 - gap) / 2;
    const yA = methodCol(ctx, 64, colW, a.name, result.methodsA, result.winsA, colA, y);
    const yB = methodCol(ctx, 64 + colW + gap, colW, b.name, result.methodsB, result.winsB, colB, y);
    y = Math.max(yA, yB);

    footer(ctx, CH);
    return cv;
  }

  // ── PICK'EM CARD (1080 wide, height grows with the card) ─────────────────
  // A clean list of the user's picks — one compact line each: winner + method,
  // with a coloured spine on the left keying confidence (High/Med/Low), explained
  // by the legend up top. Headlined by the player's name; height grows with the
  // number of picks so nothing gets squished.
  const PK_CONF_COL = { High: ACC, Med: AMB, Low: MUT };
  const PK_RED = '#ff5f57';
  function pkMethodLabel(p) {
    if (!p.method) return 'method TBD';
    if (p.method === 'Decision') return 'Decision';
    return p.method + (p.round ? ' · R' + p.round : '');
  }
  function pkPossessive(name) { return name ? (name + (/s$/i.test(name) ? "'" : "'s")) : 'My'; }
  // Confidence colour legend: a short swatch (matching the row spine) + label ×3.
  function pkLegend(ctx, x, y) {
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = '700 21px ' + COND; ctx.fillStyle = MUT;
    ctx.fillText('CONFIDENCE', x, y);
    let lx = x + ctx.measureText('CONFIDENCE').width + 28;
    [['High', ACC], ['Med', AMB], ['Low', MUT]].forEach(([lab, c]) => {
      roundRect(ctx, lx, y - 5, 26, 9, 4.5); ctx.fillStyle = c; ctx.fill();
      ctx.font = '600 24px ' + SANS; ctx.fillStyle = TXT;
      ctx.fillText(lab, lx + 36, y + 1);
      lx += 36 + ctx.measureText(lab).width + 34;
    });
    ctx.textBaseline = 'alphabetic';
  }
  function pkRow(ctx, p, x, y, w, h, img) {
    const col = PK_CONF_COL[p.confidence] || MUT;
    const pad = 7;
    roundRect(ctx, x, y + pad, 6, h - pad * 2, 3); ctx.fillStyle = col; ctx.fill();   // confidence spine
    // small circular headshot of the picked winner (initials disc when no photo).
    // r is sized so the disc's height matches the confidence spine (h - pad*2).
    const r = (h - pad * 2) / 2, avCx = x + 24 + r, avCy = y + h / 2;
    const ini = String(p.winner || '').split(/\s+/).map(s => s[0]).join('').slice(0, 2).toUpperCase();
    avatar(ctx, img, avCx, avCy, r, ini, LINE);
    const tx = avCx + r + 16, cy = y + h / 2 + 1, right = x + w - 12;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    // method measured first so it always fits at the end
    const methodStr = pkMethodLabel(p);
    ctx.font = '400 26px ' + SANS; const methodW = ctx.measureText(methodStr).width;
    // winner name (bold), capped so opponent + method still fit
    ctx.font = '700 38px ' + COND; ctx.fillStyle = TXT;
    const name = clip(ctx, p.winner, Math.min((right - tx) - methodW - 100, (right - tx) * 0.6));
    ctx.fillText(name, tx, cy);
    let cx = tx + ctx.measureText(name).width + 16;
    // "vs opponent" — smaller + muted, clipped to whatever's left before the method
    if (p.loser) {
      ctx.font = '400 23px ' + SANS; ctx.fillStyle = MUT;
      const vs = clip(ctx, 'vs ' + p.loser, right - cx - methodW - 18);
      ctx.fillText(vs, cx, cy);
      cx += ctx.measureText(vs).width + 16;
    }
    // method, inline + muted
    ctx.font = '400 26px ' + SANS; ctx.fillStyle = MUT;
    ctx.fillText(methodStr, cx, cy);
    ctx.textBaseline = 'alphabetic';
  }
  // Draw a run of coloured text segments left→right; clips the running text to maxX.
  function drawSegs(ctx, segs, x, y, maxX) {
    let cx = x;
    for (const s of segs) {
      ctx.font = s.f; ctx.fillStyle = s.c;
      let t = s.t;
      if (maxX != null && cx + ctx.measureText(t).width > maxX) t = clip(ctx, t, Math.max(0, maxX - cx));
      if (!t) continue;
      ctx.fillText(t, cx, y);
      cx += ctx.measureText(t).width;
      if (maxX != null && cx >= maxX) break;
    }
    return cx;
  }
  // Graded variant, styled like the on-page result tile: "Winner def. Opponent" up
  // top (the ACTUAL result), then "You picked <your pick> ✓ · method ✓ · round ✓"
  // beneath (green ticks for each part you got right, a red ✗ for a wrong winner),
  // with the points won or lost on the right.
  function pkResultRow(ctx, p, x, y, w, h, img) {
    const col = PK_CONF_COL[p.confidence] || MUT, pad = 7;
    roundRect(ctx, x, y + pad, 6, h - pad * 2, 3); ctx.fillStyle = col; ctx.fill();
    const r = Math.min(35, (h - pad * 2) / 2), avCx = x + 24 + r, avCy = y + h / 2;
    const win = p.actualWinner || p.winner, los = p.actualLoser || p.loser || '';
    const ini = String(win || '').split(/\s+/).map(s => s[0]).join('').slice(0, 2).toUpperCase();
    avatar(ctx, img, avCx, avCy, r, ini, LINE);
    const tx = avCx + r + 18, right = x + w - 12;
    ctx.textBaseline = 'middle';
    // points, vertically centred on the right
    const pts = p.points | 0, ptsStr = (pts > 0 ? '+' : '') + pts;
    const ptsCol = p.voided ? MUT : (pts > 0 ? ACC : (pts < 0 ? PK_RED : MUT));
    ctx.textAlign = 'right'; ctx.font = '800 48px ' + COND; ctx.fillStyle = ptsCol;
    ctx.fillText(ptsStr, right, y + h / 2 + 1);
    const rightLimit = right - ctx.measureText(ptsStr).width - 30;
    ctx.textAlign = 'left';
    const cy1 = y + h / 2 - 17, cy2 = y + h / 2 + 22;
    // line 1 — the actual result
    if (p.voided) {
      drawSegs(ctx, [{ t: 'Draw / No Contest', f: '700 38px ' + COND, c: TXT }], tx, cy1, rightLimit);
    } else {
      ctx.font = '700 38px ' + COND;
      const winName = clip(ctx, win, (rightLimit - tx) * 0.52);
      const seg1 = [
        { t: winName, f: '700 38px ' + COND, c: TXT },
        { t: '  def. ', f: '400 26px ' + SANS, c: MUT },
        { t: los, f: '400 28px ' + SANS, c: '#c8ccd2' },
      ];
      // Append the actual method only if the whole line fits — a half-cut "KO/…" is
      // uglier than omitting it (the method ✓ tick on line 2 covers correctness).
      if (p.resultMethod) {
        ctx.font = '700 38px ' + COND; let used = ctx.measureText(winName).width;
        ctx.font = '400 26px ' + SANS; used += ctx.measureText('  def. ').width;
        ctx.font = '400 28px ' + SANS; used += ctx.measureText(los).width;
        const mstr = '   ·  ' + p.resultMethod + (p.resultRound ? ' · R' + p.resultRound : '');
        ctx.font = '400 24px ' + SANS;
        if (tx + used + ctx.measureText(mstr).width <= rightLimit) seg1.push({ t: mstr, f: '400 24px ' + SANS, c: MUT });
      }
      drawSegs(ctx, seg1, tx, cy1, rightLimit);
    }
    // line 2 — your pick + result ticks (mirrors the page's "You picked …")
    ctx.font = '600 26px ' + SANS;
    const seg2 = [
      { t: 'You picked ', f: '400 26px ' + SANS, c: MUT },
      { t: clip(ctx, p.winner, (rightLimit - tx) * 0.5), f: '600 26px ' + SANS, c: TXT },
      { t: ' ', f: '400 26px ' + SANS, c: MUT },
    ];
    if (p.voided) {
      seg2.push({ t: '— bout voided', f: '400 26px ' + SANS, c: MUT });
    } else if (p.winnerHit) {
      seg2.push({ t: '✓', f: '700 28px ' + COND, c: ACC });
      if (p.methodHit) seg2.push({ t: ' · method ', f: '400 26px ' + SANS, c: MUT }, { t: '✓', f: '700 28px ' + COND, c: ACC });
      if (p.roundHit) seg2.push({ t: ' · round ', f: '400 26px ' + SANS, c: MUT }, { t: '✓', f: '700 28px ' + COND, c: ACC });
    } else {
      seg2.push({ t: '✗', f: '700 28px ' + COND, c: PK_RED });
    }
    drawSegs(ctx, seg2, tx, cy2, right - 4);
    ctx.textBaseline = 'alphabetic';
  }
  async function drawPickem(data) {
    await fontsReady();
    const logo = await loadBrandLogo();
    const picks = (data.picks || []).slice();
    const n = picks.length || 1;
    const graded = !!data.graded;
    const title = pkPossessive(data.name) + (graded ? ' Results' : ' Picks');

    const cv = document.createElement('canvas');
    cv.width = W;
    let ctx = cv.getContext('2d');
    ctx.font = '800 60px ' + COND;
    const titleLines = wrap(ctx, title, W - 128).slice(0, 2);
    const L = titleLines.length;
    const lastTitleY = 152 + (L - 1) * 64;
    const subY = lastTitleY + 46;
    // Results card: the total rides on the confidence-legend row (right side), and
    // there's no big footer total block — so the whole thing is shorter.
    const legendY = subY + 44;
    const divY = legendY + (graded ? 22 : 24);
    const listTop = divY + (graded ? 22 : 26);
    const rowH = graded ? 96 : 70;
    const footerBlockH = graded ? 88 : 172;
    const CH = Math.max(1080, Math.round(listTop + n * rowH + footerBlockH));
    cv.height = CH;                 // resizing clears the canvas + resets state
    ctx = cv.getContext('2d');
    ctx.fillStyle = BG; ctx.fillRect(0, 0, W, CH);

    brand(ctx, 78, "Pick'em", logo);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = TXT; ctx.font = '800 60px ' + COND;
    titleLines.forEach((line, i) => ctx.fillText(line, 64, 152 + i * 64));
    ctx.font = '400 27px ' + SANS; ctx.fillStyle = MUT;
    const tail = graded
      ? (picks.filter(p => p.winnerHit).length + '/' + n + ' winners')
      : (n + ' pick' + (n === 1 ? '' : 's'));
    const sub = [data.eventName, data.eventDate, tail].filter(Boolean).join('   ·   ');
    ctx.fillText(clip(ctx, sub, W - 128), 64, subY);
    pkLegend(ctx, 64, legendY);
    if (graded) {
      const total = data.totalPoints || 0;
      // Right-aligned above the per-fight points column, level with the legend row.
      ctx.textBaseline = 'middle'; ctx.textAlign = 'right';
      const valStr = (total > 0 ? '+' : '') + total + ' pts';
      ctx.font = '800 32px ' + COND; ctx.fillStyle = total < 0 ? PK_RED : ACC;
      ctx.fillText(valStr, W - 64, legendY + 1);
      const vw = ctx.measureText(valStr).width;
      ctx.font = '700 22px ' + COND; ctx.fillStyle = MUT;
      ctx.fillText('TOTAL', W - 64 - vw - 12, legendY + 1);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    }
    ctx.strokeStyle = LINE; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(64, divY); ctx.lineTo(W - 64, divY); ctx.stroke();

    const listBottom = CH - footerBlockH;
    const slack = Math.max(0, (listBottom - listTop) - n * rowH);
    let ry = listTop + slack / 2;
    const rowImgs = await Promise.all(picks.map(p => loadImg(p.winnerSlug)));
    const drawRow = graded ? pkResultRow : pkRow;
    picks.forEach((p, i) => { drawRow(ctx, p, 64, ry, W - 128, rowH, rowImgs[i]); ry += rowH; });

    // Points-at-stake footer for the picks card; the results card shows its total up top.
    if (!graded) {
      const total = data.totalPoints || 0;
      ctx.strokeStyle = LINE; ctx.beginPath(); ctx.moveTo(64, CH - 124); ctx.lineTo(W - 64, CH - 124); ctx.stroke();
      ctx.textAlign = 'left'; ctx.font = '700 28px ' + COND; ctx.fillStyle = MUT; ctx.textBaseline = 'alphabetic';
      ctx.fillText('TOTAL POSSIBLE POINTS', 64, CH - 84);
      ctx.textAlign = 'right'; ctx.font = '800 50px ' + COND; ctx.fillStyle = ACC;
      ctx.fillText(String(total), W - 64, CH - 76);
      ctx.textAlign = 'left';
    }

    footer(ctx, CH);
    return cv;
  }

  // ── the share overlay (mirrors the parlay slip's, including the iOS split) ──
  let asset = null;
  function toFile(cv) {
    return new Promise((res, rej) => {
      if (!cv.toBlob) return rej(new Error("This browser can't export the image."));
      try {
        cv.toBlob((b) => {
          if (!b) return rej(new Error("Couldn't render the image."));
          res({ file: new File([b], 'gillylab.png', { type: 'image/png' }), blob: b });
        }, 'image/png');
      } catch (e) { rej(e); }   // tainted canvas throws here, not in the callback
    });
  }
  const canShareFiles = (f) => !!(navigator.canShare && f && navigator.canShare({ files: [f] }));
  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = filename;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  function close() {
    const ov = document.getElementById('glSheet');
    if (ov) ov.classList.remove('open');
    asset = null;
    if (typeof unlockPageScroll === 'function') unlockPageScroll();
  }
  function busy(on) {
    ['glSheetSave', 'glSheetShare'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.disabled = !!on; el.classList.toggle('busy', !!on);
    });
  }
  async function open(drawFn, filename, shareText) {
    let ov = document.getElementById('glSheet');
    if (!ov) {
      ov = document.createElement('div'); ov.id = 'glSheet'; ov.className = 'pl-share';
      ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Share sheet');
      document.body.appendChild(ov);
    }
    ov.innerHTML = `<div class="pl-share-inner gl-sheet-inner">
      <div class="gl-sheet-preview"><img id="glSheetImg" alt="Shareable sheet"></div>
      <div class="pl-share-actions">
        <button type="button" id="glSheetSave" class="pl-act primary">Save photo</button>
        <button type="button" id="glSheetShare" class="pl-act">Share</button>
        <button type="button" id="glSheetClose" class="pl-act ghost">Close</button>
      </div>
      <div class="pl-share-hint">${IOS
        ? 'Save photo → tap Save Image to add it to Photos. Share sends the sheet with a link.'
        : 'Save photo downloads the image. Share sends the sheet with a link.'}</div>
    </div>`;
    ov.classList.add('open');
    if (typeof lockPageScroll === 'function') lockPageScroll();

    ov.querySelector('#glSheetClose').addEventListener('click', close);
    ov.addEventListener('click', (e) => { if (e.target === ov) close(); });

    busy(true);
    let cv;
    try { cv = await drawFn(); asset = await toFile(cv); }
    catch (err) {
      ov.querySelector('.pl-share-hint').textContent = err.message || "Couldn't build the image.";
      busy(false);
      return;
    }
    const img = ov.querySelector('#glSheetImg');
    img.src = cv.toDataURL('image/png');
    busy(false);

    // navigator.share() needs transient activation, so it must be called straight
    // out of the click — the PNG is already rendered by the time the buttons enable.
    ov.querySelector('#glSheetSave').addEventListener('click', () => {
      if (!asset) return;
      if (IOS && canShareFiles(asset.file)) { navigator.share({ files: [asset.file] }).catch(() => {}); return; }
      download(asset.blob, filename);
    });
    ov.querySelector('#glSheetShare').addEventListener('click', () => {
      if (!asset) return;
      const url = 'https://gillylab.com';
      if (canShareFiles(asset.file)) {
        const withUrl = { files: [asset.file], text: shareText, url: url, title: 'GillyLab' };
        const payload = (navigator.canShare && navigator.canShare(withUrl)) ? withUrl : { files: [asset.file], text: shareText, title: 'GillyLab' };
        navigator.share(payload).catch(() => {});
      } else if (navigator.share) {
        navigator.share({ text: shareText, url: url, title: 'GillyLab' }).catch(() => {});
      }
    });
  }

  /* ── Bet & CLV Tracker sheets ────────────────────────────────────────────
     Two square 1080 cards, sized for a feed: one for the user's record over the
     date range they're looking at, one for the pending bets on a single card.  */
  const BT_RED = '#ff6a5e';
  const initialsOf = n => String(n || '').trim().split(/\s+/).map(s => s[0] || '').join('').slice(0, 2).toUpperCase();
  // At most 2dp, no trailing zeros: 0.67 / 1.5 / 10
  const uFmt = n => (Math.round(n * 100) / 100).toFixed(2).replace(/\.?0+$/, '');
  function btTile(ctx, x, y, w, h, label, val, col) {
    roundRect(ctx, x, y, w, h, 14); ctx.fillStyle = CARD; ctx.fill();
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = '700 22px ' + COND; ctx.fillStyle = MUT;
    ctx.fillText(String(label).toUpperCase(), x + 26, y + 44);
    ctx.font = '800 54px ' + COND; ctx.fillStyle = col || TXT;
    ctx.fillText(String(val), x + 26, y + 106);
  }
  async function drawBetHistory(data) {
    await fontsReady();
    const logo = await loadBrandLogo();
    const CH = 1080;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = CH;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = BG; ctx.fillRect(0, 0, W, CH);
    brand(ctx, 78, 'Bet & CLV Tracker', logo);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = TXT; ctx.font = '800 60px ' + COND;
    // pkPossessive falls back to "My" when there's no display name yet.
    ctx.fillText(clip(ctx, pkPossessive(data.name) + ' betting record', W - 128), 64, 158);
    ctx.font = '400 27px ' + SANS; ctx.fillStyle = MUT;
    ctx.fillText(clip(ctx, [data.rangeLabel, data.settled + ' settled'].filter(Boolean).join('   ·   '), W - 128), 64, 202);

    // Hero: CLV is the headline the whole product is about.
    roundRect(ctx, 64, 240, W - 128, 210, 16); ctx.fillStyle = CARD; ctx.fill();
    ctx.font = '700 24px ' + COND; ctx.fillStyle = MUT;
    ctx.fillText('CLOSING LINE VALUE', 96, 296);
    const clvNull = data.clv == null;
    ctx.font = '800 108px ' + COND; ctx.fillStyle = clvNull ? MUT : (data.clv > 0 ? ACC : BT_RED);
    const clvTxt = clvNull ? '—' : (data.clv > 0 ? '+' : '') + Number(data.clv).toFixed(1);
    ctx.fillText(clvTxt, 96, 396);
    if (!clvNull) {
      const cw = ctx.measureText(clvTxt).width;
      ctx.font = '700 30px ' + COND; ctx.fillStyle = MUT; ctx.fillText('pts', 96 + cw + 12, 396);
    }
    ctx.font = '400 25px ' + SANS; ctx.fillStyle = '#c9ccd3'; ctx.textAlign = 'right';
    ctx.fillText(data.clvSub || '', W - 96, 396);
    ctx.textAlign = 'left';

    const gw = (W - 128 - 20) / 2, gh = 140;
    btTile(ctx, 64, 476, gw, gh, 'Record', data.record || '0-0', TXT);
    btTile(ctx, 64 + gw + 20, 476, gw, gh, 'ROI', data.roi == null ? '—' : (data.roi > 0 ? '+' : '') + Number(data.roi).toFixed(1) + '%', data.roi == null ? TXT : (data.roi > 0 ? ACC : BT_RED));
    btTile(ctx, 64, 476 + gh + 20, gw, gh, 'Units', (data.units > 0 ? '+' : '') + Number(data.units || 0).toFixed(1) + 'u', data.units > 0 ? ACC : (data.units < 0 ? BT_RED : TXT));
    btTile(ctx, 64 + gw + 20, 476 + gh + 20, gw, gh, 'Beat the close', data.beatTxt || '—', TXT);

    ctx.font = '400 23px ' + SANS; ctx.fillStyle = FOOT; ctx.textAlign = 'center';
    ctx.fillText('CLV measured against the closing line · moneylines only', W / 2, CH - 96);
    ctx.fillText('gillylab.com', W / 2, CH - 56);
    ctx.textAlign = 'left';
    return cv;
  }
  async function drawBetCard(data) {
    await fontsReady();
    const logo = await loadBrandLogo();
    const bets = (data.bets || []).slice(0, 10);
    // 132 not 116: at 116 the pick's descenders ("Du Plessis by submission") ran
    // into the matchup line's ascenders underneath it.
    const rowH = 132, listTop = 318;
    // Total at risk and total return if every bet lands.
    const risked = bets.reduce((s, b) => s + (Number(b.stake) || 0), 0);
    const toWin = bets.reduce((s, b) => { const o = Number(b.odds) || 0;
      return s + (Number(b.stake) || 0) * (o > 0 ? o / 100 : 100 / -o); }, 0);
    // Headshots: one for a fighter-specific pick, two (A vs B) when the bet is
    // about the fight rather than a fighter — a total, the distance, a round start.
    const imgs = await Promise.all(bets.map(b => Promise.all((b.slugs || []).slice(0, 2).map(s => loadImg(s)))));
    const CH = Math.max(1080, listTop + bets.length * rowH + 190);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = CH;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = BG; ctx.fillRect(0, 0, W, CH);
    brand(ctx, 78, 'Bet & CLV Tracker', logo);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = TXT; ctx.font = '800 60px ' + COND;
    ctx.fillText(clip(ctx, pkPossessive(data.name) + (data.results ? ' results' : ' card'), W - 128), 64, 158);
    ctx.font = '400 32px ' + SANS; ctx.fillStyle = MUT;
    ctx.fillText(clip(ctx, [data.eventName, data.eventDate, bets.length + ' bet' + (bets.length === 1 ? '' : 's')].filter(Boolean).join('   ·   '), W - 128), 64, 208);
    // Own line rather than tacked onto the subtitle — a billed event name plus the
    // date already fills that row, and clipping the stake would be worse than a
    // second line. Numbers carry the weight; the return greens.
    let rx = 64;
    const seg = (t, font, col) => { ctx.font = font; ctx.fillStyle = col; ctx.fillText(t, rx, 258); rx += ctx.measureText(t).width; };
    const SEG_L = '400 29px ' + SANS, SEG_N = '800 34px ' + COND;
    if (data.results) {
      // Settled card: the line that matters is how it went.
      const up = (data.units || 0) > 0, dn = (data.units || 0) < 0;
      seg(data.record || '0-0', SEG_N, TXT);
      seg('   ·   ', SEG_L, MUT);
      seg((up ? '+' : '') + uFmt(data.units || 0) + 'u', SEG_N, up ? ACC : (dn ? BT_RED : TXT));
      if (data.roi != null) {
        seg('   ·   ', SEG_L, MUT);
        seg((data.roi > 0 ? '+' : '') + data.roi.toFixed(1) + '% ROI', SEG_N, data.roi > 0 ? ACC : (data.roi < 0 ? BT_RED : TXT));
      }
    } else {
      seg('Risking ', SEG_L, MUT);
      seg(uFmt(risked) + 'u', SEG_N, TXT);
      seg(' to win ', SEG_L, MUT);
      seg(uFmt(toWin) + 'u', SEG_N, ACC);
    }
    ctx.strokeStyle = LINE; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(64, 286); ctx.lineTo(W - 64, 286); ctx.stroke();

    let y = listTop;
    bets.forEach((b, i) => {
      const h = rowH - 12;
      roundRect(ctx, 64, y, W - 128, h, 12); ctx.fillStyle = CARD; ctx.fill();
      // Avatars, left. Two discs overlap slightly with a "vs" beneath them.
      const pics = imgs[i] || [], names = (b.names || []);
      const cy = y + h / 2;
      let tx = 96;
      if (pics.length > 1) {
        // Two faces: smaller discs, or the pair eats the row and squeezes the pick.
        const r = 28, c1 = 96 + r, c2 = 96 + r * 2 + 14;
        avatar(ctx, pics[0], c1, cy - 10, r, initialsOf(names[0]), LINE);
        avatar(ctx, pics[1], c2, cy - 10, r, initialsOf(names[1]), LINE);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = '700 20px ' + COND; ctx.fillStyle = MUT;
        ctx.fillText('VS', (c1 + c2) / 2, cy + r + 12);
        tx = c2 + r + 22;
      } else if (pics.length === 1) {
        const r = 38;
        avatar(ctx, pics[0], 96 + r, cy, r, initialsOf(names[0]), LINE);
        tx = 96 + r * 2 + 22;
      }
      const right = W - 96;
      const oStr = b.odds > 0 ? '+' + b.odds : String(b.odds);
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      let oW;
      // Baselines 42px apart (was 32) so a descender can't reach the line below.
      if (data.results) {
        // Settled: lead with how it went, price demoted underneath.
        const won = b.status === 'won', lost = b.status === 'lost';
        const rStr = won ? '+' + uFmt(b.profit) + 'u' : lost ? uFmt(b.profit) + 'u' : (b.status === 'void' ? 'Void' : '—');
        ctx.font = '800 46px ' + COND; ctx.fillStyle = won ? ACC : lost ? BT_RED : MUT;
        ctx.fillText(rStr, right, cy - 16);
        oW = ctx.measureText(rStr).width;
        ctx.font = '400 26px ' + SANS; ctx.fillStyle = MUT;
        ctx.fillText(oStr + ' · ' + b.stake + 'u', right, cy + 26);
        oW = Math.max(oW, ctx.measureText(oStr + ' · ' + b.stake + 'u').width);
      } else {
        ctx.font = '800 46px ' + COND; ctx.fillStyle = ACC;
        ctx.fillText(oStr, right, cy - 16);
        oW = ctx.measureText(oStr).width;
        ctx.font = '400 26px ' + SANS; ctx.fillStyle = MUT;
        ctx.fillText(b.stake + 'u', right, cy + 26);
      }
      const maxW = right - tx - Math.max(oW, 60) - 28;
      ctx.textAlign = 'left';
      ctx.font = '800 42px ' + COND; ctx.fillStyle = TXT;
      ctx.fillText(clip(ctx, b.pick || '', maxW), tx, cy - 16);
      ctx.font = '400 27px ' + SANS; ctx.fillStyle = MUT;
      ctx.fillText(clip(ctx, b.match || '', maxW), tx, cy + 26);
      ctx.textBaseline = 'alphabetic';
      y += rowH;
    });
    ctx.font = '400 23px ' + SANS; ctx.fillStyle = FOOT; ctx.textAlign = 'center';
    ctx.fillText('Tracked on gillylab.com', W / 2, CH - 60);
    ctx.textAlign = 'left';
    return cv;
  }

  return {
    // Square card of the user's tracked record over the selected date range.
    betHistory: (data) => open(() => drawBetHistory(data || {}), 'gillylab-bet-record.png',
      'My betting record on gillylab.com'),
    // Square card of the pending bets on one upcoming event.
    betCard: (data) => open(() => drawBetCard(data || {}), 'gillylab-my-card.png',
      'My card on gillylab.com'),
    // Full 1080x1920 by default. Pass 'portrait' for the lighter 4:5 feed cut.
    matchup: (a, b, info, fmt) => open(() => drawMatchup(a, b, info || {}, fmt),
      'gillylab-' + a.replace(/\s+/g, '-').toLowerCase() + '-vs-' + b.replace(/\s+/g, '-').toLowerCase() +
        (fmt === 'portrait' ? '-feed' : '') + '.png',
      a + ' vs ' + b + ' — matchup breakdown from gillylab.com'),
    sim: (a, b, result, rounds) => open(() => drawSim(a, b, result, rounds),
      'gillylab-sim-' + a.replace(/\s+/g, '-').toLowerCase() + '-vs-' + b.replace(/\s+/g, '-').toLowerCase() + '.png',
      a + ' vs ' + b + ' — ' + result.n.toLocaleString() + ' simulations on gillylab.com'),
    // Square card of the user's pick'em selections for the featured event.
    pickem: (data) => open(() => drawPickem(data || {}),
      'gillylab-picks.png',
      'My picks for ' + ((data && data.eventName) || 'the card') + ' — make yours on gillylab.com'),
    close: close
  };
})();
if (typeof window !== 'undefined') window.GL_SHEET = GL_SHEET;
