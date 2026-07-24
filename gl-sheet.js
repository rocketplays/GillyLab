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

  // ASK FOR THE FONTS. document.fonts.ready only waits for loads ALREADY PENDING;
  // it does not start any. And a webfont is only fetched when RENDERED DOM TEXT
  // uses it — ctx.font does not trigger a fetch. So on a page whose own type is
  // system-ui (every free page: -apple-system, BlinkMacSystemFont, ...), Barlow is
  // referenced by nothing the browser paints, ready resolves instantly, and the
  // canvas quietly draws in the default sans.
  //
  // Which is not a cosmetic difference: the fallback is not CONDENSED. Every width
  // this file measures — clip(), the 104px verdict on the Climb card — is computed
  // against a face ~35% wider than the one the layout was designed for, so text
  // overruns the canvas and gets clipped at 1080. Reported as "on smaller phones
  // the CHAMPION line is too wide and goes off the page"; it was every phone that
  // hadn't loaded Barlow for some other reason, and the size of the phone was a
  // coincidence of which ones had it cached.
  //
  // load() both starts the fetch and resolves when it's usable. Failures are
  // swallowed: a sheet in the fallback face is worse than one in Barlow but far
  // better than no sheet, and drawClimb now fits its headline either way.
  const fontsReady = async () => {
    if (!document.fonts) return;
    // load() is the part that's new. Guarded separately from ready() so a browser
    // with FontFaceSet but no load() still gets the old behaviour rather than
    // silently skipping the wait it used to do.
    if (document.fonts.load) {
      try {
        await Promise.all([
          document.fonts.load('800 104px "Barlow Condensed"'),
          document.fonts.load('700 24px "Barlow Condensed"'),
          document.fonts.load('400 27px "Barlow"'),
          document.fonts.load('500 26px "Barlow"'),
        ]);
      } catch (e) { /* offline, blocked, or no such family — draw in the fallback */ }
    }
    try { await document.fonts.ready; } catch (e) {}
  };
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
  // shareText === null MEANS "THERE IS NOTHING TO SHARE", AND THAT IS THE SWITCH.
  //
  // A Share button sends the image plus a gillylab.com LINK. That link is the whole
  // point on the FREE sheets — /pickem and /theclimb are public pages, and a picks
  // card landing in a group chat with a link is how someone new arrives. It is
  // pointless on the PAYWALLED sheets: nobody can open a matchup breakdown they
  // can't reach, so "Share" there offers a link to a locked door.
  //
  // So this is not a blanket removal, and it must not become one. gl-sheet.js is
  // generated from this exact module by gen-gl-sheet.cjs and served to the free
  // pages — deleting the button outright would take it off /pickem and /theclimb
  // too, which is the opposite of what anyone wants. The caller decides, by whether
  // it has a share line worth sending.
  async function open(drawFn, filename, shareText) {
    const canShare = !!shareText;
    let ov = document.getElementById('glSheet');
    if (!ov) {
      ov = document.createElement('div'); ov.id = 'glSheet'; ov.className = 'pl-share';
      ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Share sheet');
      document.body.appendChild(ov);
    }
    // The hint has to match the buttons actually on screen — a line explaining a
    // Share button that isn't there is how copy goes stale (see the audits that
    // passed for weeks against phrasing nobody printed any more).
    const hint = canShare
      ? (IOS ? 'Save photo → tap Save Image to add it to Photos. Share sends the sheet with a link.'
             : 'Save photo downloads the image. Share sends the sheet with a link.')
      : (IOS ? 'Save photo → tap Save Image to add it to Photos.'
             : 'Save photo downloads the image.');
    ov.innerHTML = `<div class="pl-share-inner gl-sheet-inner">
      <div class="gl-sheet-preview"><img id="glSheetImg" alt="Shareable sheet"></div>
      <div class="pl-share-actions">
        <button type="button" id="glSheetSave" class="pl-act primary">Save photo</button>
        ${canShare ? '<button type="button" id="glSheetShare" class="pl-act">Share</button>' : ''}
        <button type="button" id="glSheetClose" class="pl-act ghost">Close</button>
      </div>
      <div class="pl-share-hint">${hint}</div>
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
    // Absent on the paywalled sheets — see canShare above. Save photo still routes
    // through navigator.share({files}) on iOS, because that IS how iOS saves to
    // Photos; it sends no text and no URL, so it is not a share in this sense.
    const shareBtn = canShare && ov.querySelector('#glSheetShare');
    if (shareBtn) shareBtn.addEventListener('click', () => {
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
  // The "capper card" — a shareable, verified stat line built to be posted. Name +
  // ✓ Verified badge headline, CLV hero, the four numbers, then (when present) the
  // leaderboard rank, a signature beat, and last-5 form. Sections are optional, so the
  // canvas height is computed from what's actually shown to keep it clean.
  async function drawBetHistory(data) {
    await fontsReady();
    const logo = await loadBrandLogo();
    const M = 64;
    const hasRank = !!(data.rank && data.rank.text);
    const hasSig  = !!(data.signature && data.signature.pick);
    const hasForm = !!(data.form && data.form.results && data.form.results.length);
    let CH = 250;
    CH += hasRank ? 72 : 6;
    CH += 240;                 // hero CLV
    CH += 320;                 // 2×2 tiles
    if (hasSig)  CH += 132;
    if (hasForm) CH += 116;
    CH += 150;                 // footer band
    const cv = document.createElement('canvas'); cv.width = W; cv.height = CH;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = BG; ctx.fillRect(0, 0, W, CH);
    brand(ctx, 78, 'Bet & CLV Tracker', logo);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';

    // Name headline — the star of a capper card — with room reserved for the badge.
    ctx.fillStyle = TXT; ctx.font = '800 72px ' + COND;
    const nm = clip(ctx, data.name || 'My record', W - M * 2 - (data.verified ? 230 : 0));
    ctx.fillText(nm, M, 172);
    const nameW = ctx.measureText(nm).width;
    // ✓ VERIFIED badge — the authenticity mark that makes this worth sharing over a
    // fakeable screenshot. Check is drawn by hand so it renders regardless of font.
    if (data.verified) {
      ctx.font = '800 24px ' + COND;
      const label = 'VERIFIED', bh = 48, by = 128;
      const bw = 44 + ctx.measureText(label).width + 22, bx = M + nameW + 24;
      roundRect(ctx, bx, by, bw, bh, bh / 2); ctx.fillStyle = 'rgba(0,230,104,0.13)'; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,230,104,0.5)'; roundRect(ctx, bx, by, bw, bh, bh / 2); ctx.stroke();
      const cx = bx + 24, cyy = by + bh / 2;
      ctx.strokeStyle = ACC; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx - 8, cyy); ctx.lineTo(cx - 2, cyy + 7); ctx.lineTo(cx + 9, cyy - 8); ctx.stroke();
      ctx.fillStyle = ACC; ctx.textBaseline = 'middle'; ctx.fillText(label, bx + 42, cyy + 2); ctx.textBaseline = 'alphabetic';
    }
    ctx.font = '400 27px ' + SANS; ctx.fillStyle = MUT;
    ctx.fillText(clip(ctx, [data.rangeLabel, data.settled + ' settled'].filter(Boolean).join('   ·   '), W - M * 2), M, 216);

    let y = 250;
    // Leaderboard rank ribbon.
    if (hasRank) {
      const rh = 46; roundRect(ctx, M, y, W - M * 2, rh, 10); ctx.fillStyle = 'rgba(255,207,122,0.10)'; ctx.fill();
      ctx.font = '700 24px ' + COND; ctx.fillStyle = AMB; ctx.textBaseline = 'middle';
      ctx.fillText(clip(ctx, String(data.rank.text).toUpperCase(), W - M * 2 - 44), M + 22, y + rh / 2 + 1);
      ctx.textBaseline = 'alphabetic'; y += 72;
    } else { y += 6; }

    // Hero: CLV is the headline the whole product is about.
    roundRect(ctx, M, y, W - M * 2, 210, 16); ctx.fillStyle = CARD; ctx.fill();
    ctx.font = '700 24px ' + COND; ctx.fillStyle = MUT; ctx.fillText('CLOSING LINE VALUE', M + 32, y + 56);
    const clvNull = data.clv == null;
    ctx.font = '800 108px ' + COND; ctx.fillStyle = clvNull ? MUT : (data.clv > 0 ? ACC : BT_RED);
    const clvTxt = clvNull ? '—' : (data.clv > 0 ? '+' : '') + Number(data.clv).toFixed(1);
    ctx.fillText(clvTxt, M + 32, y + 156);
    if (!clvNull) { const cw = ctx.measureText(clvTxt).width; ctx.font = '700 30px ' + COND; ctx.fillStyle = MUT; ctx.fillText('pts', M + 32 + cw + 12, y + 156); }
    ctx.font = '400 25px ' + SANS; ctx.fillStyle = '#c9ccd3'; ctx.textAlign = 'right';
    ctx.fillText(data.clvSub || '', W - M - 32, y + 156); ctx.textAlign = 'left';
    y += 240;

    // The four numbers.
    const gw = (W - M * 2 - 20) / 2, gh = 140;
    btTile(ctx, M, y, gw, gh, 'Record', data.record || '0-0', TXT);
    btTile(ctx, M + gw + 20, y, gw, gh, 'ROI', data.roi == null ? '—' : (data.roi > 0 ? '+' : '') + Number(data.roi).toFixed(1) + '%', data.roi == null ? TXT : (data.roi > 0 ? ACC : BT_RED));
    btTile(ctx, M, y + gh + 20, gw, gh, 'Units', (data.units > 0 ? '+' : '') + Number(data.units || 0).toFixed(1) + 'u', data.units > 0 ? ACC : (data.units < 0 ? BT_RED : TXT));
    btTile(ctx, M + gw + 20, y + gh + 20, gw, gh, 'Beat the closing line', data.beatTxt || '—', TXT);
    y += 320;

    // Signature beat — the flex.
    if (hasSig) {
      const sh = 108; roundRect(ctx, M, y, W - M * 2, sh, 14); ctx.fillStyle = CARD; ctx.fill();
      roundRect(ctx, M, y, 6, sh, 3); ctx.fillStyle = ACC; ctx.fill();
      ctx.font = '700 22px ' + COND; ctx.fillStyle = MUT; ctx.fillText('BIGGEST WIN', M + 30, y + 42);
      ctx.font = '800 34px ' + COND; ctx.fillStyle = TXT;
      ctx.fillText(clip(ctx, data.signature.pick, W - M * 2 - 260), M + 30, y + 82);
      ctx.textAlign = 'right';
      ctx.font = '800 42px ' + COND; ctx.fillStyle = ACC;
      ctx.fillText((data.signature.units > 0 ? '+' : '') + Number(data.signature.units).toFixed(1) + 'u', W - M - 30, y + 58);
      if (data.signature.clv != null) { ctx.font = '400 24px ' + SANS; ctx.fillStyle = MUT; ctx.fillText('CLV ' + (data.signature.clv > 0 ? '+' : '') + Number(data.signature.clv).toFixed(1), W - M - 30, y + 92); }
      ctx.textAlign = 'left'; y += 132;
    }

    // Last-N form dots.
    if (hasForm) {
      ctx.font = '700 22px ' + COND; ctx.fillStyle = MUT; ctx.textBaseline = 'middle';
      ctx.fillText('LAST ' + data.form.results.length, M, y + 26);
      let dx = M + 132; const dr = 15;
      data.form.results.forEach((r) => {
        ctx.beginPath(); ctx.arc(dx + dr, y + 26, dr, 0, 2 * Math.PI);
        ctx.fillStyle = r === 'W' ? ACC : (r === 'L' ? BT_RED : MUT); ctx.fill();
        dx += dr * 2 + 12;
      });
      if (data.form.units != null) {
        ctx.textAlign = 'right'; ctx.font = '800 30px ' + COND;
        const up = data.form.units > 0;
        ctx.fillStyle = up ? ACC : (data.form.units < 0 ? BT_RED : TXT);
        ctx.fillText((up ? '+' : '') + Number(data.form.units).toFixed(1) + 'u last ' + data.form.results.length, W - M, y + 26);
        ctx.textAlign = 'left';
      }
      ctx.textBaseline = 'alphabetic'; y += 116;
    }

    // Branded footer — the point: this is verified, not a screenshot.
    ctx.font = '400 24px ' + SANS; ctx.fillStyle = FOOT; ctx.textAlign = 'center';
    ctx.fillText('Verified & auto-graded · CLV measured against the closing line', W / 2, CH - 90);
    ctx.font = '700 30px ' + COND; ctx.fillStyle = MUT; ctx.fillText('gillylab.com', W / 2, CH - 46);
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
    // Parlay legs get their own small avatars, preloaded alongside the main ones.
    const legImgs = await Promise.all(bets.map(b => Promise.all((b.legs || []).map(l => loadImg(l.slug)))));
    // Rows are variable height: a parlay expands to list its legs in a 2-up grid below the
    // header, so a multi-leg parlay stays compact (ceil(n/2) rows).
    const PLEG_ROW = 46, PHEAD_H = 84;
    const cardH = bets.map(b => (b.legs && b.legs.length) ? (PHEAD_H + Math.ceil(b.legs.length / 2) * PLEG_ROW + 14) : (rowH - 12));
    const CH = Math.max(1080, listTop + cardH.reduce((s, h) => s + h + 12, 0) + 130);
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
      const isParlay = !!(b.legs && b.legs.length);
      const h = cardH[i];
      roundRect(ctx, 64, y, W - 128, h, 12); ctx.fillStyle = CARD; ctx.fill();
      // Avatars, left. Two discs overlap slightly with a "vs" beneath them. A parlay has
      // no single face — its header skips the avatar and lists its legs below instead.
      const pics = imgs[i] || [], names = (b.names || []);
      const cy = isParlay ? (y + 44) : (y + h / 2);       // header-row center
      let tx = 96;
      if (!isParlay && pics.length > 1) {
        // Two faces: smaller discs, or the pair eats the row and squeezes the pick.
        const r = 28, c1 = 96 + r, c2 = 96 + r * 2 + 14;
        avatar(ctx, pics[0], c1, cy - 10, r, initialsOf(names[0]), LINE);
        avatar(ctx, pics[1], c2, cy - 10, r, initialsOf(names[1]), LINE);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = '700 20px ' + COND; ctx.fillStyle = MUT;
        ctx.fillText('VS', (c1 + c2) / 2, cy + r + 12);
        tx = c2 + r + 22;
      } else if (!isParlay && pics.length === 1) {
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
      // A normal bet keeps its match/book subtitle. A parlay drops the event line and the
      // per-leg odds, and lays the legs out 2-up (small avatar + pick) to stay compact.
      if (!isParlay) {
        ctx.font = '400 27px ' + SANS; ctx.fillStyle = MUT;
        ctx.fillText(clip(ctx, (b.match || '') + (b.book ? '   ·   ' + b.book : ''), maxW), tx, cy + 26);
      } else {
        const lg = legImgs[i] || [], divX = W / 2, legsTop = y + PHEAD_H, prows = Math.ceil(b.legs.length / 2);
        // A slim centre divider anchors the two columns so the right-hand legs don't float.
        ctx.strokeStyle = LINE; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(divX, legsTop - 2); ctx.lineTo(divX, legsTop + prows * PLEG_ROW - 8); ctx.stroke();
        b.legs.forEach((l, j) => {
          const col = j % 2, cellX = col === 0 ? 96 : (divX + 30);
          const lcy = legsTop + Math.floor(j / 2) * PLEG_ROW + PLEG_ROW / 2 - 3;
          const r = 17, ax = cellX + r, tx2 = ax + r + 16;
          avatar(ctx, lg[j], ax, lcy, r, initialsOf(l.name), LINE);
          ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
          ctx.font = '700 28px ' + COND; ctx.fillStyle = '#c9ccd3';
          ctx.fillText(clip(ctx, l.pick || '', (col === 0 ? divX - 22 : W - 96) - tx2), tx2, lcy);
        });
      }
      ctx.textBaseline = 'alphabetic';
      y += h + 12;
    });
    ctx.font = '400 23px ' + SANS; ctx.fillStyle = FOOT; ctx.textAlign = 'center';
    ctx.fillText('Tracked on gillylab.com', W / 2, CH - 60);
    ctx.textAlign = 'left';
    return cv;
  }

  /* ── The Climb ───────────────────────────────────────────────────────────
     A finished run: the two records, where you peaked, and how the fights
     actually ended. Square, because it's a scoreboard, not a bracket.

     It lives HERE rather than in prototypes/the-climb.html for the reason this
     whole file exists: index.html is the single source of truth for GL_SHEET, and
     gen-gl-sheet.cjs generates the copy that standalone pages load. A share sheet
     forked into the prototype would drift from the app's within a week — the
     generator's own header says as much ("Generated (not forked) so the two can
     never drift"). The prototype loads ../gl-sheet.js exactly like /pickem loads
     /gl-sheet.js.  */
  // The Climb's end screen, as a card. It follows endBox() beat for beat — big
  // coloured verdict, the three records, the best win, W/L by method, then the
  // fight list — because that IS the design the player just reacted to. The first
  // version invented its own layout (a "FINISHED AS" hero, a 2x2 tile grid, wins
  // only) and told the same story in a different voice, which is how the picture
  // ends up disagreeing with the page.
  const CLIMB_RED = '#ff5a3d';
  async function drawClimb(d) {
    await fontsReady();
    const logo = await loadBrandLogo();
    // HEIGHT FOLLOWS THE RUN. A fixed 1350 looked right at nine fights and left a
    // 210px hole under a five-fight run — and a five-fight run is a fighter who got
    // CUT, which is exactly when the card shouldn't look like it lost its footing.
    // Floor of 1080 so a two-fight disaster is still a card and not a strip.
    const LIST_TOP = 828, ROW_H = 48, FOOT = 150;
    const rows = (d.log || []).slice(0, 9);
    const CH = Math.max(1080, LIST_TOP + rows.length * ROW_H + FOOT);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = CH;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = BG; ctx.fillRect(0, 0, W, CH);
    brand(ctx, 78, 'The Climb', logo);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';

    const win = !!d.champ, hero = win ? ACC : CLIMB_RED;

    // THE VERDICT — the page's own .big line, at the size it deserves, in two
    // colours: the word in the result's colour, the rest in white.
    //
    // MEASURED AND FITTED, NOT HARD-CODED AT 104px. Two things move its width and
    // neither is under this function's control: WHAT it says ("CHAMPION. You did
    // it." is half again as wide as "CUT. 5 losses.") and WHICH FACE it lands in
    // (if Barlow Condensed hasn't loaded, the fallback sans is ~35% wider and the
    // line runs off the 1080 canvas and gets clipped — which is the bug this was
    // reported as). Shrink until it fits; a slightly smaller headline is nobody's
    // problem, a headline missing its last three words is.
    let vSize = 104;
    const verdictW = () => {
      ctx.font = '800 ' + vSize + 'px ' + COND;
      return ctx.measureText(d.verdict || '').width +
             ctx.measureText(' ' + (d.verdictSub || '')).width;
    };
    while (vSize > 52 && verdictW() > W - 128) vSize -= 2;
    ctx.font = '800 ' + vSize + 'px ' + COND;
    const vw = ctx.measureText(d.verdict || '').width;
    ctx.fillStyle = hero;
    ctx.fillText(d.verdict || '', 64, 190);
    ctx.fillStyle = TXT;
    ctx.fillText(' ' + (d.verdictSub || ''), 64 + vw, 190);
    // The archetype used to live HERE, as the second of four items in this muted
    // line — recorded but invisible, which is not what it's for. It's the one thing
    // on the card that says who you built rather than what happened to him, so it
    // gets its own titled row below. This line is context: where, how long, how old.
    ctx.font = '400 27px ' + SANS; ctx.fillStyle = MUT;
    ctx.fillText(clip(ctx, [d.division, d.fights + ' fights', 'age ' + d.age]
      .filter(Boolean).join('   ·   '), W - 128), 64, 236);

    // ARCHETYPE — titled, gold, its own row. Gold because that's the colour the
    // game already gives it in the HUD and the creator; a share card that recolours
    // the thing it's showing off is a third design nobody asked for.
    roundRect(ctx, 64, 272, W - 128, 76, 12); ctx.fillStyle = CARD; ctx.fill();
    ctx.font = '700 22px ' + COND; ctx.fillStyle = MUT;
    ctx.fillText('ARCHETYPE', 96, 318);
    ctx.textAlign = 'right'; ctx.font = '800 40px ' + COND; ctx.fillStyle = AMB;
    ctx.fillText(clip(ctx, d.style || '—', W - 300), W - 96, 320);
    ctx.textAlign = 'left';

    // THE THREE RECORDS, in the end screen's order and wording.
    roundRect(ctx, 64, 364, W - 128, 150, 16); ctx.fillStyle = CARD; ctx.fill();
    const cols = [['PRO RECORD', d.pro, TXT], ['UFC RECORD', d.ufc, win ? ACC : TXT],
                  ['PEAK', d.peakLabel, win ? AMB : TXT]];
    cols.forEach(([lab, val, col], i) => {
      const x = 96 + i * ((W - 192) / 3);
      ctx.font = '700 22px ' + COND; ctx.fillStyle = MUT; ctx.fillText(lab, x, 418);
      ctx.font = '800 58px ' + COND; ctx.fillStyle = col;
      ctx.fillText(String(val || '—'), x, 482);
    });

    ctx.font = '400 26px ' + SANS; ctx.fillStyle = '#c9ccd3';
    ctx.fillText(clip(ctx, d.bestWin || '', W - 128), 64, 558);

    // BY METHOD — W and L, the same little table the end screen prints.
    let y = 620;
    ctx.font = '700 24px ' + COND; ctx.fillStyle = MUT;
    ctx.fillText('BY METHOD', 64, y);
    ctx.textAlign = 'right';
    ctx.fillText('W', W - 150, y); ctx.fillText('L', W - 72, y);
    ctx.textAlign = 'left';
    y += 16;
    for (const m of (d.byMethod || [])) {
      y += 46;
      ctx.font = '400 27px ' + SANS; ctx.fillStyle = TXT; ctx.fillText(m.label, 64, y);
      ctx.textAlign = 'right'; ctx.font = '700 30px ' + COND;
      ctx.fillStyle = m.w ? ACC : MUT; ctx.fillText(String(m.w), W - 150, y);
      ctx.fillStyle = m.l ? CLIMB_RED : MUT; ctx.fillText(String(m.l), W - 72, y);
      ctx.textAlign = 'left';
    }

    // THE RECORD — the part people screenshot. Newest first, capped so the card
    // stays readable; the count says what's missing rather than pretending.
    y = LIST_TOP;
    const hidden = (d.log || []).length - rows.length;
    ctx.font = '700 24px ' + COND; ctx.fillStyle = MUT;
    ctx.fillText('THE RUN' + (hidden ? '   (LAST ' + rows.length + ' OF ' + (d.log || []).length + ')' : ''), 64, y);
    for (const f of rows) {
      y += ROW_H;
      roundRect(ctx, 64, y - 34, W - 128, 42, 8); ctx.fillStyle = '#16181d'; ctx.fill();
      ctx.font = '800 26px ' + COND; ctx.fillStyle = f.won ? ACC : CLIMB_RED;
      ctx.fillText(f.won ? 'W' : 'L', 84, y);
      ctx.font = '400 22px ' + SANS; ctx.fillStyle = MUT; ctx.fillText(f.method, 118, y);
      // The champion's gold C, same mark the log uses.
      const rx = 196;
      if (f.champ) {
        roundRect(ctx, rx, y - 22, 26, 26, 5); ctx.fillStyle = AMB; ctx.fill();
        ctx.font = '800 18px ' + COND; ctx.fillStyle = '#1a1204';
        ctx.textAlign = 'center'; ctx.fillText('C', rx + 13, y - 3); ctx.textAlign = 'left';
      } else {
        ctx.font = '400 22px ' + SANS; ctx.fillStyle = MUT;
        ctx.fillText(f.rank, rx, y);
      }
      ctx.font = '500 26px ' + SANS; ctx.fillStyle = TXT;
      ctx.fillText(clip(ctx, f.opp, W - 128 - 240 - 130), 242, y);
      ctx.textAlign = 'right'; ctx.font = '400 24px ' + SANS; ctx.fillStyle = MUT;
      ctx.fillText(f.ml, W - 88, y); ctx.textAlign = 'left';
    }

    ctx.font = '400 23px ' + SANS; ctx.fillStyle = FOOT; ctx.textAlign = 'center';
    ctx.fillText('Build a fighter. Climb the real rankings. Win the belt.', W / 2, CH - 96);
    ctx.fillText('gillylab.com/theclimb', W / 2, CH - 56);
    ctx.textAlign = 'left';
    return cv;
  }

  /* ── MATCHUP HUB SHEETS: striking + grappling ────────────────────────────
     One card per tab of the deep dive, at 1080x1920 — the story cut, the same
     shape drawMatchup uses by DEFAULT and for the same reason it gives there:
     it is the only one that can carry the analysis at a size worth reading.

     THEY WERE 1350 AND EVERYTHING WAS TOO SMALL. 4:5 is the feed maximum and it
     is the right shape for a card with three sections; these have four, and the
     striking one has to hold two 3x3 cross-tabs whose cells carry two numbers
     each. At 1350 the type was shrunk until it fitted, which is the wrong end of
     the trade — the cells were 62px with 17px sample counts. Going to 1920 buys
     570px, which is what pays for the bigger type AND the defensive section.
     Height is the cheap axis: a story scrolls, a feed crop does not.

     GRAPPLING STAYS AT 1350. Six rows and a blurb compose well at 4:5, and the
     in-between heights are a trap: Instagram crops a feed post to 4:5, so a 1600
     card would silently lose its bottom row. 1350 or 1920, nothing between.

     EVERY OUTSIDE DEPENDENCY IS typeof-GUARDED, and that is not defensive
     habit — gen-gl-sheet.cjs slices this module out and serves it as
     gl-sheet.js to the FREE pages (/pickem, /theclimb), where _ddGrid, mhNorm
     and FIGHT_GRID do not exist. drawMatchup already does this with
     renderMatchupBreakdown. An unguarded reference here would throw on a page
     that has nothing to do with this feature.  */
  const _sgGrid  = (n) => (typeof _ddGrid === 'function') ? _ddGrid(n) : null;
  const _sgRead  = (A, B, n1, n2, d) => (typeof ddRead === 'function') ? ddRead(A, B, n1, n2, d) : '';
  const _sgNorm  = (n, m, i) => (typeof mhNorm === 'function') ? mhNorm(n, m, i) : null;
  const _sgGI    = (p, t) => ['dist','clinch','ground'].indexOf(p)*3 + ['head','body','leg'].indexOf(t);
  const SG_FLOOR = 25;   // mirrors _MH_FLOOR: under 25 thrown, a cell has no rate worth shading

  // The read, in the same green-tinted block the modal uses, so the card and the
  // panel it came from are recognisably the same thing.
  function sgRead(ctx, text, y) {
    const x = 64, w = W - 128;
    ctx.font = '400 27px ' + SANS;
    const lines = wrap(ctx, text, w - 44).slice(0, 3);
    const h = 34 + lines.length * 36;
    roundRect(ctx, x, y, w, h, 12);
    ctx.fillStyle = hexA(ACC, 0.07); ctx.fill();
    ctx.strokeStyle = hexA(ACC, 0.22); ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = TXT; ctx.font = '400 27px ' + SANS;
    lines.forEach((ln, i) => ctx.fillText(ln, x + 22, y + 40 + i * 36));
    return y + h + 18;
  }

  // The hub's signature row: label centred, values outside, bars growing OUT from
  // the middle so the longer side is the message before you read a digit. `accA`/
  // `accB` light the accent, and are passed in already gated — the card never
  // decides on its own that a gap is real.
  // `S` — a scale on the vertical rhythm and the type. 1 is the original, which is
  // what the GRAPPLING card uses and must keep: it was signed off as-is, and the one
  // time I scaled it up the six rows ran past the footer and printed "REVERSALS"
  // through "gillylab.com". The striking card is 1920 and passes 1.3.
  //
  // A scale rather than two copies of this function, because two copies of a layout
  // is two layouts, and they drift. Width does NOT scale — the canvas is 1080 either
  // way, so only the rhythm and the type have anywhere to go.
  function sgBar(ctx, label, txtA, txtB, subA, subB, fracA, fracB, y, accA, accB, S) {
    S = S || 1;
    const px = (n) => Math.round(n * S);
    ctx.textAlign = 'center'; ctx.font = '400 ' + px(21) + 'px ' + SANS; ctx.fillStyle = MUT;
    ctx.fillText(String(label).toUpperCase(), W / 2, y);
    const vy = y + px(40);
    ctx.textAlign = 'left';  ctx.font = '700 ' + px(36) + 'px ' + COND; ctx.fillStyle = accA ? ACC : TXT;
    ctx.fillText(txtA, 64, vy);
    ctx.textAlign = 'right'; ctx.fillStyle = accB ? ACC : TXT;
    ctx.fillText(txtB, W - 64, vy);
    if (subA || subB) {
      ctx.font = '400 ' + px(20) + 'px ' + SANS; ctx.fillStyle = FOOT;
      ctx.textAlign = 'left';  if (subA) ctx.fillText(subA, 64, vy + px(26));
      ctx.textAlign = 'right'; if (subB) ctx.fillText(subB, W - 64, vy + px(26));
    }
    const gap = 18, half = 268, bh = px(12), by = y + px(16);
    const lx = W / 2 - gap - half, rx = W / 2 + gap;
    roundRect(ctx, lx, by, half, bh, 6); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill();
    roundRect(ctx, rx, by, half, bh, 6); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill();
    // A TRUE ZERO DRAWS NOTHING. The floor was Math.max(4, …), which gave Brahimaj's
    // 0 reversals a 4px nub — a bar, however small, says "some". The floor exists so
    // a small-but-real value stays visible; it must not manufacture one.
    const barW = (f) => { const v = Math.max(0, Math.min(1, f)); return v > 0 ? Math.max(4, half * v) : 0; };
    const wa = barW(fracA), wb = barW(fracB);
    // Left bar grows leftward from the centre; right bar grows rightward.
    if (wa) { roundRect(ctx, lx + half - wa, by, wa, bh, 6);
              ctx.fillStyle = accA ? ACC : 'rgba(255,255,255,0.34)'; ctx.fill(); }
    if (wb) { roundRect(ctx, rx, by, wb, bh, 6);
              ctx.fillStyle = accB ? ACC : 'rgba(255,255,255,0.34)'; ctx.fill(); }
    ctx.textAlign = 'left';
    return y + (subA || subB ? 96 : 80);
  }
  // sectionTitle() is drawMatchup's, sized for its sheet. Same `S` as sgBar so the
  // headings grow with the rows they head — a 29px heading over 48px numbers reads
  // as a caption, not a section.
  function sgTitle(ctx, t, y, S) {
    S = S || 1;
    ctx.strokeStyle = LINE; ctx.lineWidth = 1;
    const ly = y - Math.round(40.5 * S) - 0.5;
    ctx.beginPath(); ctx.moveTo(64, ly); ctx.lineTo(W - 64, ly); ctx.stroke();
    ctx.font = '700 ' + Math.round(29 * S) + 'px ' + SANS; ctx.fillStyle = TXT;
    ctx.fillText(String(t).toUpperCase(), 64, y);
    return y + Math.round(30 * S);
  }

  // The 3x3 cross-tab, shaded against the fighter's own division exactly as the
  // modal shades it — same mhNorm, same floor, same capped z. It is the one thing
  // on the striking tab that no other view in the product shows, so a striking
  // card without it would be a card of the parts that aren't the point.
  // `showLabels` — the DIST/CLIN/GRND rail down the left.
  //
  // ONLY THE LEFT GRID GETS IT, and not to save ink: at 420px wide the right grid's
  // rail was right-aligned into x-12, which put "DIST" straight through the LEFT
  // grid's LEG column — the label sat against Magny's 71% like a caption for it.
  // The two grids share the same rows by construction, so one rail labels both; the
  // second was always redundant, and redundant furniture is what collided.
  function sgGrid(ctx, G, name, x, y, w, showLabels) {
    const cw = w / 3, rh = 84;
    ctx.textAlign = 'center';
    ctx.font = '700 25px ' + SANS; ctx.fillStyle = MUT;
    ['HEAD','BODY','LEG'].forEach((t, i) => ctx.fillText(t, x + cw * i + cw / 2, y));
    let yy = y + 16;
    [['dist','DIST'],['clinch','CLIN'],['ground','GRND']].forEach(([p, plabel]) => {
      if (showLabels) {
        ctx.textAlign = 'right'; ctx.font = '700 22px ' + SANS; ctx.fillStyle = FOOT;
        ctx.fillText(plabel, x - 14, yy + rh / 2 + 7);
      }
      ['head','body','leg'].forEach((t, ci) => {
        const i = _sgGI(p, t), c = G.cells[i];
        const n = c[1], thin = n < SG_FLOOR, r = n ? c[0] / n : 0;
        const b = thin ? null : _sgNorm(name, 'acc', i);
        let bg = 'rgba(255,255,255,0.03)';
        if (b && b.spread) {
          const z = Math.max(-1, Math.min(1, ((r - b.med) / b.spread) / 2));
          bg = z >= 0 ? 'rgba(0,230,104,' + (0.06 + 0.44 * z).toFixed(3) + ')'
                      : 'rgba(255,64,64,' + (0.06 + 0.34 * (-z)).toFixed(3) + ')';
        }
        const cx = x + cw * ci + 4, cy = yy + 4, cwid = cw - 8, chh = rh - 8;
        roundRect(ctx, cx, cy, cwid, chh, 9); ctx.fillStyle = bg; ctx.fill();
        if (thin) { ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 1; ctx.stroke(); }
        ctx.textAlign = 'center';
        // TEXT ON A TILE IS NOT TEXT ON THE BACKGROUND, AND THE PALETTE HAS TO KNOW.
        //
        // The sample line was FOOT (#6f727a) — a mid grey chosen against the near
        // black canvas, and unreadable the moment the tile behind it goes bright
        // green. That is the SAME bug the modal was reported for ("her ground
        // accuracy shows 86%, but the total strikes are totally unreadable"), and
        // the modal already fixed it: .mh-gc b is #fff and .mh-gc i is
        // rgba(255,255,255,0.72). I built this grid and reached for the canvas
        // greys instead of copying the answer sitting in the CSS.
        //
        // White with alpha survives both ends of the scale — the tile ranges from
        // 6% to 50% green and 6% to 40% red, and nothing in that range is light
        // enough to fight white. A fixed grey only ever works on one background.
        //
        // An empty cell says nothing rather than "0%", which would read as a
        // measured zero instead of the absence it is. Same rule as the modal.
        ctx.font = '700 38px ' + COND;
        ctx.fillStyle = !n ? FOOT : (thin ? 'rgba(255,255,255,0.60)' : '#fff');
        ctx.fillText(n ? Math.round(r * 100) + '%' : '·', cx + cwid / 2, cy + 38);
        ctx.font = '400 23px ' + SANS;
        ctx.fillStyle = thin ? MUT : 'rgba(255,255,255,0.72)';
        ctx.fillText(n ? c[0] + '/' + n : '—', cx + cwid / 2, cy + 65);
      });
      yy += rh;
    });
    ctx.textAlign = 'left';
    return yy;
  }

  // Shared top: brand, date, avatars, names, records. Returns the y to build from.
  //
  // HEIGHT IS PER SHEET, and the two differ on purpose. Grappling is six rows and
  // reads well at the 4:5 feed maximum; striking has to carry two 3x3 cross-tabs
  // AND the defensive lanes, which do not fit there at a size worth reading. The
  // in-between sizes are the trap: Instagram crops a feed post to 4:5, so a 1600
  // card would lose its bottom. 1350 or 1920, nothing else.
  async function sgHead(nameA, nameB, info, kicker, CH, R) {
    await fontsReady();
    const a = meta(nameA), b = meta(nameB);
    const [imgA, imgB, logo] = await Promise.all([loadImg(a.slug), loadImg(b.slug), loadBrandLogo()]);
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = CH;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = BG; ctx.fillRect(0, 0, W, CH);
    brand(ctx, 84, kicker, logo);
    const sub = [(info && info.weightClass) || '', (info && info.date) || ''].filter(Boolean).join(' · ');
    if (sub) { ctx.font = '400 26px ' + SANS; ctx.fillStyle = MUT; ctx.fillText(sub, 64, 122); }
    // showForm=false: the win/loss chips are a fact about the career, and these two
    // cards are about one department of one fight.
    const y = versusBlock(ctx, a, b, imgA, imgB, 158, R || 46, NEU_A, NEU_B, false);
    return { cv, ctx, CH, y };
  }

  async function drawStriking(nameA, nameB, info) {
    const A = _sgGrid(nameA), B = _sgGrid(nameB);
    if (!A || !B) throw new Error('No striking breakdown available for this bout.');
    // S=1.3 — this card has 1920 to spend and four sections to fill, so the type can
    // go where the grappling card's could not.
    const S = 1.3;
    const { cv, ctx, CH, y: y0 } = await sgHead(nameA, nameB, info, (info && info.event) || 'UFC', 1920, 54);
    let y = y0 + 10;

    // NO READ BLOCK ON THIS CARD. It is the one thing here that also appears, word
    // for word, at the top of the panel the reader just came from — and it cost
    // ~140px of a budget that the grids and the defensive lanes both wanted. The
    // sections below ARE the read, in the form a card is good at. The grappling
    // card keeps its blurb: it has the room, and its numbers are less self-evident.

    // WHERE THE FIGHT HAPPENS — share of everything they throw. No accent: a share
    // has no direction (see the modal).
    //
    // THE BAR IS THE PERCENTAGE, same as the modal. This scaled to the larger of the
    // two, so an 11% clinch share drew a full-width bar — the bar answering "who
    // does this more?" beside a number answering "how much?". Absolute keeps the
    // three rows comparable to each other, which is the section's whole point: they
    // are shares of one man's output and they sum to 100.
    y = sgTitle(ctx, 'Where the fight happens', y + Math.round(44*S), S) + Math.round(14*S);
    const tot = (G) => G.cells.reduce((s, c) => s + c[1], 0) || 1;
    const tA = tot(A), tB = tot(B);
    [[0, 'At range'], [1, 'In the clinch'], [2, 'On the ground']].forEach(([g, lab]) => {
      const ra = (A.cells[g*3][1] + A.cells[g*3+1][1] + A.cells[g*3+2][1]) / tA;
      const rb = (B.cells[g*3][1] + B.cells[g*3+1][1] + B.cells[g*3+2][1]) / tB;
      y = sgBar(ctx, lab, Math.round(ra*100) + '%', Math.round(rb*100) + '%', null, null, ra, rb, y, false, false, S);
    });

    // HOW WELL IT LANDS — the cross-tab, per fighter, shaded against his division.
    y = sgTitle(ctx, 'How well it lands', y + Math.round(48*S), S) + Math.round(30*S);
    const gw = 420;
    ctx.textAlign = 'center'; ctx.font = '700 32px ' + COND; ctx.fillStyle = TXT;
    const lastA = (typeof _ddLast === 'function') ? _ddLast(nameA) : nameA;
    const lastB = (typeof _ddLast === 'function') ? _ddLast(nameB) : nameB;
    ctx.fillText(clip(ctx, String(lastA).toUpperCase(), gw), 108 + gw/2, y);
    ctx.fillText(clip(ctx, String(lastB).toUpperCase(), gw), W - 84 - gw/2, y);
    ctx.textAlign = 'left';
    const gy = y + 36;
    sgGrid(ctx, A, nameA, 108, gy, gw, true);          // the rail labels both grids
    const gEnd = sgGrid(ctx, B, nameB, W - 84 - gw, gy, gw, false);
    y = gEnd + 40;
    ctx.textAlign = 'center'; ctx.font = '400 24px ' + SANS; ctx.fillStyle = FOOT;
    ctx.fillText('accuracy by position and target · shaded vs the division median', W / 2, y);
    ctx.textAlign = 'left';

    // WHAT LANDS ON THEM — the striking tab's fourth section, and the reason this
    // card is 1920 rather than 1350. GRADED, NOT COMPARED, and the accent runs
    // BACKWARDS because the number is a beating: below your own division's median is
    // the good end. Two verdicts side by side, not a contest — the same rule as the
    // modal. Getting it the other way up would paint the best defender on the card
    // red, which is how the very first cut of this grid behaved.
    const LANES = [['dist','head','Head at range'],['dist','body','Body at range'],
                   ['dist','leg','Leg kicks'],['ground','head','Ground strikes']];
    const rows = [];
    for (const [p, t, lab] of LANES) {
      const i = _sgGI(p, t), ca = A.cellsD[i], cb = B.cellsD[i];
      if (ca[1] < SG_FLOOR && cb[1] < SG_FLOOR) continue;   // nothing measured either side
      rows.push([lab, i, ca, cb]);
    }
    if (rows.length) {
      // The heading is drawn INSIDE the room check, not before it. The 1350 version
      // printed "WHAT LANDS ON THEM" over empty canvas because the budget was
      // computed after the title was already on the page.
      // 62*S, not 74*S — these rows carry no subs any more, so they are the short
      // kind. Budgeting with the tall figure would have hidden a row that fits.
      const need = Math.round(92*S) + Math.round(62*S);                       // title + one row, the minimum worth printing
      if (CH - 100 - y >= need) {
        y = sgTitle(ctx, 'What lands on them', y + Math.round(50*S), S) + Math.round(14*S);
        const room = Math.floor((CH - 100 - y) / Math.round(62*S));
        for (const [lab, i, ca, cb] of rows.slice(0, Math.max(0, room))) {
          const ra = ca[1] ? ca[0]/ca[1] : 0, rb = cb[1] ? cb[0]/cb[1] : 0;
          const nA = ca[1] >= SG_FLOOR ? _sgNorm(nameA, 'allow', i) : null;
          const nB = cb[1] >= SG_FLOOR ? _sgNorm(nameB, 'allow', i) : null;
          const gA = (typeof _mhGrade === 'function') ? _mhGrade(ra, ca[1], nA, true) : null;
          const gB = (typeof _mhGrade === 'function') ? _mhGrade(rb, cb[1], nB, true) : null;
          // PERCENTAGES ONLY. The landed/thrown counts came off: this section is
          // four rows of one comparison, and "372/1214" under a 31% was answering a
          // question nobody asks of a share sheet. The grid above still carries its
          // samples, where the floor makes them load-bearing — here they were
          // furniture. Dropping them also shortens the row from 96px to 81px, which
          // is why all four lanes now fit.
          y = sgBar(ctx, lab,
            ca[1] < SG_FLOOR ? '—' : Math.round(ra*100) + '%',
            cb[1] < SG_FLOOR ? '—' : Math.round(rb*100) + '%',
            null, null,
            ra, rb, y, gA === 'w', gB === 'w', S);
        }
      }
    }

    // THERE IS NO "WHAT LANDS ON THEM" ON THIS CARD, AND IT IS NOT AN OVERSIGHT.
    // I added it, because the card LOOKED about a quarter empty. Measured, on a
    // 1350 canvas: content ends at y=1142 and the footer sits at 1310, so the real
    // slack is 116px. A section title costs 92 and one row costs 62 — 154 minimum.
    // It does not fit, and the version that "fitted" printed the heading with zero
    // rows under it, because the row budget evaluated to 0 AFTER the title was
    // already drawn.
    //
    // 116px above a footer is padding, not a hole. The eyeball said 25% empty off a
    // scaled preview; the arithmetic said 8.6%. If this card ever must carry the
    // defensive lanes, the honest way is the 1080x1920 story cut — not shrinking the
    // grid, which is the one thing on the striking tab no other view shows.
    footer(ctx, CH);
    return cv;
  }

  async function drawGrappling(nameA, nameB, info) {
    const A = _sgGrid(nameA), B = _sgGrid(nameB);
    if (!A || !B) throw new Error('No grappling breakdown available for this bout.');
    // STAYS AT 1350, AND THE SCALE IS ARITHMETIC, NOT TASTE.
    //
    // Dropping the blurb frees ~124px, and that plus the 34px of slack it already
    // had is the entire budget for bigger type. Traced against a footer at 1310:
    //     S=1.30  content ends 1368   overflows by 98
    //     S=1.20  content ends 1309   overflows by 39
    //     S=1.15  content ends 1275   overflows by 5
    //     S=1.10  content ends 1241   fits, 29px spare
    // So 1.10. I had shipped 1.30 by eye and it printed "REVERSALS" straight through
    // "gillylab.com · not betting advice" with the last row hanging off the canvas —
    // which is what a layout does when nobody counts.
    const S = 1.1;
    const { cv, ctx, CH, y: y0 } = await sgHead(nameA, nameB, info, (info && info.event) || 'UFC', 1350, 46);
    let y = y0 + 8;
    // No read block: it is the one thing on this card that also sits, word for word,
    // at the top of the panel the reader just came from, and it was the ~124px the
    // numbers wanted. Same call as the striking card.

    // Per 15 minutes, not per fight — the same exposure the modal and the profile
    // page use. A card that said "per fight" would disagree with both.
    const exp = (G) => (G.cage > 0 ? G.cage / 900 : (G.sFights || 1));
    const per15 = A.cage > 0 && B.cage > 0;
    const eA = per15 ? A.cage / 900 : (A.sFights || 1), eB = per15 ? B.cage / 900 : (B.sFights || 1);
    const unit = per15 ? '/15min' : '/fight';
    const mins = (s) => Math.floor(s/60) + 'm ' + String(Math.round(s%60)).padStart(2,'0') + 's';
    const lead = (fn) => (typeof fn === 'function') ? fn : () => 0;
    const LP = lead(typeof _mhLeadProp === 'function' ? _mhLeadProp : null);
    const LR = lead(typeof _mhLeadRatio === 'function' ? _mhLeadRatio : null);

    y = sgTitle(ctx, 'Takedowns', y + Math.round(44*S), S) + Math.round(14*S);
    const tdLead = LP(A.tdL, A.tdA, B.tdL, B.tdA);
    y = sgBar(ctx, 'Takedowns landed',
      A.tdL + '/' + A.tdA, B.tdL + '/' + B.tdA,
      (A.tdA ? Math.round(A.tdL/A.tdA*100) + '% · ' : '') + (A.tdL/eA).toFixed(1) + unit,
      (B.tdA ? Math.round(B.tdL/B.tdA*100) + '% · ' : '') + (B.tdL/eB).toFixed(1) + unit,
      A.tdA ? A.tdL/A.tdA : 0, B.tdA ? B.tdL/B.tdA : 0, y, tdLead === 1, tdLead === 2, S);
    const sA = A.tdAgA ? (A.tdAgA-A.tdAgL)/A.tdAgA : 0, sB = B.tdAgA ? (B.tdAgA-B.tdAgL)/B.tdAgA : 0;
    const stLead = LP(A.tdAgA-A.tdAgL, A.tdAgA, B.tdAgA-B.tdAgL, B.tdAgA);
    y = sgBar(ctx, 'Takedowns stopped',
      (A.tdAgA-A.tdAgL) + '/' + A.tdAgA, (B.tdAgA-B.tdAgL) + '/' + B.tdAgA,
      A.tdAgA ? Math.round(sA*100) + '%' : 'never shot on',
      B.tdAgA ? Math.round(sB*100) + '%' : 'never shot on',
      sA, sB, y, stLead === 1, stLead === 2, S);

    // +70, and the reason is the same one that made it +52 at the old size:
    // sgTitle draws its hairline at y-48.5, and an sgBar carrying subs paints them
    // at prevY+82. Too small a gap and the rule goes straight through the "55%"
    // under Takedowns stopped, which is exactly what shipped at +30.
    y = sgTitle(ctx, 'Control', y + Math.round(58*S), S) + Math.round(14*S);
    const cA = A.ctrl / eA, cB = B.ctrl / eB, mC = Math.max(cA, cB, 1);
    const cLead = LR(cA, cB, 1.25);
    y = sgBar(ctx, 'Control time', mins(A.ctrl), mins(B.ctrl),
      mins(cA) + ' ' + (per15 ? 'per 15 min' : 'per fight'),
      mins(cB) + ' ' + (per15 ? 'per 15 min' : 'per fight'),
      cA/mC, cB/mC, y, cLead === 1, cLead === 2, S);
    const kA = A.ctrlAg / eA, kB = B.ctrlAg / eB, mK = Math.max(kA, kB, 1);
    // Not accented: a long bar here is time on your back.
    y = sgBar(ctx, 'Time spent under control', mins(A.ctrlAg), mins(B.ctrlAg),
      mins(kA) + ' ' + (per15 ? 'per 15 min' : 'per fight'),
      mins(kB) + ' ' + (per15 ? 'per 15 min' : 'per fight'),
      kA/mK, kB/mK, y, false, false, S);

    // Sparse — dropped entirely when both are zero rather than printed as 0 vs 0,
    // which reads as a measured tie instead of the absence it is.
    const ex = [['Submission attempts', A.sub, B.sub], ['Reversals', A.rev, B.rev]].filter(r => r[1] || r[2]);
    if (ex.length) {
      y = sgTitle(ctx, 'On the mat', y + Math.round(58*S), S) + Math.round(14*S);   // clears the subs above — see Control
      for (const [lab, va, vb] of ex) {
        const ra = va/eA, rb = vb/eB, m = Math.max(ra, rb, 0.01);
        const l = (typeof _mhLeadRate === 'function') ? _mhLeadRate(va, eA, vb, eB) : 0;
        y = sgBar(ctx, lab, String(va), String(vb),
          'in ' + A.sFights + ' fights', 'in ' + B.sFights + ' fights',
          ra/m, rb/m, y, l === 1, l === 2, S);
      }
    }
    footer(ctx, CH);
    return cv;
  }

  return {
    // Square card of the user's tracked record over the selected date range.
    betHistory: (data) => open(() => drawBetHistory(data || {}), 'gillylab-capper-card.png',
      'My verified betting record on gillylab.com'),
    // Square card of the pending bets on one upcoming event.
    betCard: (data) => open(() => drawBetCard(data || {}), 'gillylab-my-card.png',
      'My card on gillylab.com'),
    // SAVE PHOTO ONLY — null shareText, which drops the Share button (see open()).
    // Both of these live behind the paywall, so a shared link points at a door the
    // recipient cannot open; the image is the whole gift. The FREE sheets below
    // (pickem, climb) keep their share line on purpose — that link is how a picks
    // card in a group chat brings someone in.
    // Full 1080x1920 by default. Pass 'portrait' for the lighter 4:5 feed cut.
    matchup: (a, b, info, fmt) => open(() => drawMatchup(a, b, info || {}, fmt),
      'gillylab-' + a.replace(/\s+/g, '-').toLowerCase() + '-vs-' + b.replace(/\s+/g, '-').toLowerCase() +
        (fmt === 'portrait' ? '-feed' : '') + '.png',
      null),
    sim: (a, b, result, rounds) => open(() => drawSim(a, b, result, rounds),
      'gillylab-sim-' + a.replace(/\s+/g, '-').toLowerCase() + '-vs-' + b.replace(/\s+/g, '-').toLowerCase() + '.png',
      null),
    // One condensed 4:5 card per matchup-hub tab. Paywalled, so null shareText —
    // Save photo only, same as matchup and sim.
    striking: (a, b, info) => open(() => drawStriking(a, b, info || {}),
      'gillylab-striking-' + a.replace(/\s+/g, '-').toLowerCase() + '-vs-' + b.replace(/\s+/g, '-').toLowerCase() + '.png',
      null),
    grappling: (a, b, info) => open(() => drawGrappling(a, b, info || {}),
      'gillylab-grappling-' + a.replace(/\s+/g, '-').toLowerCase() + '-vs-' + b.replace(/\s+/g, '-').toLowerCase() + '.png',
      null),
    // Square card of the user's pick'em selections for the featured event.
    pickem: (data) => open(() => drawPickem(data || {}),
      'gillylab-picks.png',
      'My picks for ' + ((data && data.eventName) || 'the card') + ' — make yours on gillylab.com'),
    // Square card of a finished Climb run.
    climb: (data) => open(() => drawClimb(data || {}),
      'gillylab-the-climb.png',
      'I went ' + ((data && data.ufc) || '0-0') + ' on The Climb and finished as ' +
        ((data && data.shareRank) || 'unranked') + ' — gillylab.com'),
    close: close
  };
})();
if (typeof window !== 'undefined') window.GL_SHEET = GL_SHEET;
