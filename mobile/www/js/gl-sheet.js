/* Hand-ported from the site's GL_SHEET (gl-sheet.js, auto-generated from
   index.html by scripts/gen-gl-sheet.cjs) — NOT auto-generated. Every pure
   canvas primitive below (roundRect, wrap, clip, avatar, brand, footer,
   versusBlock, tapeRow, styleBar, pathBlock, sectionTitle, h2hTable,
   methodCol, formChips, rankTag, the pk-/ev-/sg-prefixed families, the
   share overlay) is copied verbatim from the site version — same fonts, same
   colors, same layout math — so a sheet made in the app is pixel-identical
   to the one the site would have made for the same fight.
   Only the small "resolver" layer differs, because the app has no site
   globals (FIGHTERS, FIGHTER_STATS, FIGHT_HISTORY, nameToSlug,
   renderMatchupBreakdown, the deep-dive hub's _ddGrid/mhNorm/_mhGrade) to
   read from:
     - meta(name, slug) is now an async fetchMeta(slug) that calls the
       app's own GL_API.fighter(slug) (the free /api/app/fighter endpoint)
       and maps the response into the same {name,record,rank,division,
       initials,ht,reach,stance,age,slug} shape.
     - recentForm() reads the same fetch's phys.l5 array instead of
       FIGHT_HISTORY.
     - oddsFor()/renderMatchupBreakdown() are gone entirely — the caller
       (matchup.js) already has the fight tile's o1/o2 and .breakdown
       object (stats/lean/path) from /api/app/matchup, and passes them in
       directly.
     - the striking/grappling cross-tab shading (_sgNorm/_mhGrade) is
       pre-computed server-side now (worker/deep-dive-data.js's
       sheetGrid()/sheetSide(), scripts/gen-deep-dive.cjs) and arrives on
       /api/app/deep-dive-fight's `sheet.A`/`sheet.B` fields as
       shadeCells/shadeCellsD/gradeAllow — sgGrid here just reads those
       numbers instead of recomputing them.
     - photo/logo URLs are absolute (https://gillylab.com/...) since the
       app has no relative page path to resolve them against.
   Do not "simplify" any of the drawing math below without checking the
   site version first — it was tuned pixel by pixel (see gl-sheet.js's own
   comments) and a divergence here is a divergence from what "share sheets
   on the site" actually look like. */
(function () {
  'use strict';
  var W = 1080, H = 1920;
  var BG = '#0e1014', LINE = 'rgba(255,255,255,0.10)';
  var TXT = '#f0f0f0', MUT = '#8a8d94', ACC = '#00e668', AMB = '#ffcf7a', FOOT = '#6f727a';
  var SANS = "'Barlow', sans-serif", COND = "'Barlow Condensed', sans-serif";
  var SITE = 'https://gillylab.com';
  var IOS = (function () {
    var ua = navigator.userAgent || '';
    return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1);
  })();

  var fontsReady = function () {
    if (!document.fonts) return Promise.resolve();
    var loads = document.fonts.load ? Promise.all([
      document.fonts.load('800 104px "Barlow Condensed"'),
      document.fonts.load('700 24px "Barlow Condensed"'),
      document.fonts.load('400 27px "Barlow"'),
      document.fonts.load('500 26px "Barlow"'),
    ]).catch(function () {}) : Promise.resolve();
    return loads.then(function () {
      return document.fonts.ready ? document.fonts.ready.catch(function () {}) : null;
    });
  };

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function wrap(ctx, text, maxW) {
    var words = String(text || '').split(/\s+/).filter(Boolean), out = [];
    var line = '';
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      var t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
    }
    if (line) out.push(line);
    return out;
  }
  function clip(ctx, text, maxW) {
    var s = String(text || '');
    if (ctx.measureText(s).width <= maxW) return s;
    while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
    return s + '…';
  }
  var loadOne = function (src) {
    return new Promise(function (res) {
      if (!src) return res(null);
      var im = new Image();
      im.crossOrigin = 'anonymous';
      im.onload = function () { res(im); }; im.onerror = function () { res(null); };
      im.src = src;
    });
  };
  // Absolute, unlike the site's relative './photos/...' — the app has no
  // page path to resolve against. Same fallback order: full-res jpg, then
  // the small thumb png.
  function loadImg(slug) {
    if (!slug) return Promise.resolve(null);
    return loadOne(SITE + '/photos/' + slug + '.jpg').then(function (im) {
      return im || loadOne(SITE + '/photos/thumb/' + slug + '.png');
    });
  }
  var _brandLogoP = null;
  function loadBrandLogo() { return (_brandLogoP = _brandLogoP || loadOne(SITE + '/gl-logo.png?v=8')); }

  function initialsOf(name) {
    return (name || '').split(/\s+/).map(function (p) { return p[0]; }).join('').slice(0, 3).toUpperCase();
  }
  // The app's own /api/app/fighter (data/fighter-lite.json) response mapped
  // into the same shape the site's meta() built from FIGHTERS/FIGHTER_STATS.
  // A fetch failure (offline, unknown slug) resolves to a bare fallback
  // rather than rejecting — a sheet with "—"/"NR" everywhere beats no sheet,
  // same philosophy as the site swallowing a failed odds/photo fetch.
  function fetchMeta(name, slug) {
    if (!slug || !window.GL_API || !window.GL_API.fighter) {
      return Promise.resolve({ name: name, record: '—', rank: 'NR', division: '', initials: initialsOf(name), ht: null, reach: null, stance: null, age: null, slug: slug || null, form: [] });
    }
    return window.GL_API.fighter(slug).then(function (res) {
      var f = (res && res.fighter) || {};
      var phys = f.phys || {};
      var l5 = phys.l5 || [];
      return {
        name: f.name || name,
        record: f.record || '—',
        rank: f.rank || 'NR',
        division: f.division || '',
        initials: initialsOf(f.name || name),
        ht: phys.ht || null, reach: phys.reach || null, stance: phys.stance || null,
        age: (phys.age != null ? phys.age : null),
        slug: f.slug || slug,
        // l5 is most-recent-first; recentForm reads oldest->newest, same as the site.
        form: l5.map(function (x) { return x.r; }).reverse(),
      };
    }).catch(function () {
      return { name: name, record: '—', rank: 'NR', division: '', initials: initialsOf(name), ht: null, reach: null, stance: null, age: null, slug: slug, form: [] };
    });
  }

  var NEU_A = '#8ab4ff', NEU_B = '#ffcf7a';
  function champColors(rankA, rankB) {
    var isChamp = function (r) { return r && String(r).replace(/^#/, '') === 'C'; };
    var champA = isChamp(rankA), champB = isChamp(rankB);
    if (champA && !champB) return [AMB, ACC];
    if (champB && !champA) return [ACC, AMB];
    return [ACC, AMB];
  }
  function hexA(hex, alpha) {
    var h = hex.replace('#', '');
    var n = parseInt(h.length === 3 ? h.split('').map(function (c) { return c + c; }).join('') : h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alpha + ')';
  }
  var FORM_COL = { W: '#00e668', L: '#ff6a5e', D: '#8a8d94', NC: '#8a8d94' };
  function formChips(ctx, cx, y, form) {
    if (!form.length) return;
    var w = 34, h = 26, gap = 7;
    var total = form.length * w + (form.length - 1) * gap;
    var x = cx - total / 2;
    form.forEach(function (r) {
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
  function rankTag(rank) {
    if (!rank || rank === 'NR') return '';
    var t = String(rank).replace(/^#/, '');
    if (t === 'C') return '  ·  Champion';
    if (t === 'IC') return '  ·  Interim champ';
    return '  ·  #' + t;
  }

  function avatar(ctx, img, cx, cy, r, initials, ring) {
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath();
    ctx.fillStyle = '#1b1e25'; ctx.fill();
    if (img) {
      ctx.clip();
      var s = Math.max((r * 2) / img.width, (r * 2) / img.height);
      var dw = img.width * s, dh = img.height * s;
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
    var tx = 64;
    if (logo && logo.width) {
      var bh = 52, bw = logo.width * (bh / logo.height);
      ctx.drawImage(logo, 64, y - 40, bw, bh);
      tx = 64 + bw + 16;
    }
    ctx.font = '800 34px ' + COND;
    ctx.fillStyle = TXT; ctx.fillText('GILLY', tx, y);
    var w = ctx.measureText('GILLY').width;
    ctx.fillStyle = ACC; ctx.fillText('LAB', tx + w, y);
    if (kicker) {
      ctx.textAlign = 'right'; ctx.font = '700 22px ' + COND;
      ctx.fillStyle = MUT; ctx.fillText(String(kicker).toUpperCase(), W - 64, y);
      ctx.textAlign = 'left';
    }
  }
  function footer(ctx, h) {
    ctx.textAlign = 'center'; ctx.font = '400 24px ' + SANS; ctx.fillStyle = FOOT;
    ctx.fillText('gillylab.com · not betting advice', W / 2, h - 40);
    ctx.textAlign = 'left';
  }
  function versusBlock(ctx, a, b, imgA, imgB, y, radius, colA, colB, showForm) {
    var cxA = 280, cxB = W - 280, R = radius || 46;
    colA = colA || NEU_A; colB = colB || NEU_B;
    avatar(ctx, imgA, cxA, y + R, R, a.initials, ACC);
    avatar(ctx, imgB, cxB, y + R, R, b.initials, ACC);
    ctx.textAlign = 'center'; ctx.font = '800 60px ' + COND; ctx.fillStyle = MUT;
    ctx.fillText('VS', W / 2, y + R + 20);

    var ny = y + 2 * R + 56;
    ctx.fillStyle = TXT;
    var nmA = a.name.toUpperCase(), nmB = b.name.toUpperCase();
    var nameMaxW = 460;
    var nameSize = 46;
    var nameFits = function (s) { ctx.font = '700 ' + s + 'px ' + COND; return ctx.measureText(nmA).width <= nameMaxW && ctx.measureText(nmB).width <= nameMaxW; };
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
    var fa = a.form || [], fb = b.form || [];
    if (!fa.length && !fb.length) return ny + 46;
    formChips(ctx, cxA, ny + 18, fa);
    formChips(ctx, cxB, ny + 18, fb);
    return ny + 76;
  }
  function tapeRow(ctx, label, va, vb, y) {
    ctx.textAlign = 'left'; ctx.font = '700 42px ' + COND;
    ctx.fillStyle = TXT; ctx.fillText(va == null ? '—' : String(va), 64, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = TXT; ctx.fillText(vb == null ? '—' : String(vb), W - 64, y);
    ctx.textAlign = 'center'; ctx.font = '600 24px ' + SANS; ctx.fillStyle = MUT;
    ctx.fillText(String(label).toUpperCase(), W / 2, y - 4);
    ctx.textAlign = 'left';
  }
  function styleBar(ctx, y, leanA, leanB, colA, colB, nameA, nameB) {
    var x = 64, w = W - 128, h = 18;
    colA = colA || NEU_A; colB = colB || NEU_B;
    var surname = function (n) {
      var t = String(n || '').trim().split(/\s+/).filter(Boolean);
      var i = t.length - 1;
      while (i > 0 && /^(jr|sr|ii|iii|iv)\.?$/i.test(t[i])) i--;
      return (t[i] || String(n || '')).toUpperCase();
    };
    var px = function (lean) { return (lean == null ? null : x + w * (lean / 100)); };
    var pa = px(leanA), pb = px(leanB);

    ctx.font = '700 24px ' + COND;
    var la = surname(nameA), lb = surname(nameB);
    var wa = ctx.measureText(la).width, wb = ctx.measureText(lb).width;
    var collide = pa != null && pb != null && Math.abs(pa - pb) < (wa + wb) / 2 + 16;
    var label = function (p, txt, col, dy) {
      if (p == null) return;
      var half = ctx.measureText(txt).width / 2;
      var cx = Math.min(Math.max(p, x + half), x + w - half);
      ctx.textAlign = 'center'; ctx.fillStyle = col;
      ctx.fillText(txt, cx, y + dy);
      ctx.textAlign = 'left';
    };
    label(pa, la, colA, collide ? -58 : -24);
    label(pb, lb, colB, -24);

    roundRect(ctx, x, y, w, h, h / 2); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill();
    var dot = function (p, col) {
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
  function pathBlock(ctx, name, text, colour, y, maxLines) {
    var x = 64, w = W - 128;
    ctx.font = '400 28px ' + SANS;
    var cap = maxLines || 5;
    var all = wrap(ctx, text, w - 48);
    var lines = all.slice(0, cap);
    if (all.length > cap) lines[cap - 1] = clip(ctx, lines[cap - 1] + ' …', w - 48);
    var h = 58 + lines.length * 37;
    roundRect(ctx, x, y, w, h, 12);
    ctx.fillStyle = hexA(colour, 0.07); ctx.fill();
    ctx.strokeStyle = hexA(colour, 0.24);
    ctx.lineWidth = 1; ctx.stroke();
    ctx.font = '700 30px ' + COND; ctx.fillStyle = colour;
    ctx.fillText(String(name).toUpperCase(), x + 24, y + 40);
    ctx.font = '400 28px ' + SANS; ctx.fillStyle = TXT;
    lines.forEach(function (ln, i) { ctx.fillText(ln, x + 24, y + 76 + i * 37); });
    return y + h + 14;
  }
  function sectionTitle(ctx, t, y) {
    ctx.strokeStyle = LINE; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(64, y - 40.5); ctx.lineTo(W - 64, y - 40.5); ctx.stroke();
    ctx.font = '700 29px ' + SANS; ctx.fillStyle = TXT;
    ctx.fillText(String(t).toUpperCase(), 64, y);
    return y + 30;
  }
  var H2H_ROWS = [
    ['Sig. strikes / min', 'slpm', true],
    ['Striking accuracy', 'strAcc', true],
    ['Sig. strikes absorbed / min', 'sapm', false],
    ['Striking defense', 'strDef', true],
    ['Takedowns / 15 min', 'tdLanded', true],
    ['Takedown accuracy', 'tdAcc', true],
    ['Takedown defense', 'tdDef', true],
    ['Sub. attempts / 15 min', 'subAvg', true],
  ];
  var statTxt = function (v) { return (v == null ? '—' : String(v)); };
  function h2hTable(ctx, sa, sb, y, sig) {
    sa = sa || {}; sb = sb || {}; sig = sig || {};
    H2H_ROWS.forEach(function (r) {
      var label = r[0], key = r[1];
      var real = !!sig[key];
      ctx.textAlign = 'left'; ctx.font = '700 37px ' + COND;
      ctx.fillStyle = TXT; ctx.fillText(statTxt(sa[key]), 64, y);
      ctx.textAlign = 'right'; ctx.font = '700 37px ' + COND;
      ctx.fillStyle = TXT; ctx.fillText(statTxt(sb[key]), W - 64, y);
      ctx.textAlign = 'center'; ctx.font = '400 24px ' + SANS; ctx.fillStyle = real ? MUT : FOOT;
      ctx.fillText(label, W / 2, y - 3);
      ctx.textAlign = 'left';
      y += 39;
    });
    return y;
  }
  function methodCol(ctx, x, w, name, methods, wins, col, y) {
    ctx.textAlign = 'left';
    ctx.font = '700 28px ' + COND; ctx.fillStyle = col;
    ctx.fillText(clip(ctx, String(name).toUpperCase(), w), x, y);
    var yy = y + 34;
    ['KO/TKO', 'Submission', 'Decision'].forEach(function (k) {
      var pct = wins > 0 ? Math.round(((methods[k] || 0) / wins) * 100) : 0;
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

  // ── MATCHUP SHEET ──────────────────────────────────────────────────────
  // f: the app's own fight-tile object (f1,f2,s1,s2,rank1,rank2,rec1,rec2,
  // o1,o2 — already-formatted odds strings like "+128"). breakdown: the
  // matching f.breakdown object (stats.a/b/sig, lean.a/b, path.a/b), which
  // /api/app/matchup already sends — see gen-landing-data.cjs's per-fight
  // `breakdown` field. ctxInfo: {event, date, weightClass}.
  function drawMatchup(f, breakdown, ctxInfo) {
    breakdown = breakdown || {};
    return fontsReady().then(function () {
      return Promise.all([fetchMeta(f.f1, f.s1), fetchMeta(f.f2, f.s2)]);
    }).then(function (metas) {
      var a = metas[0], b = metas[1];
      // Tale-of-the-tape/rank/record come from the fight tile when present —
      // it's the same data the Fight Info panel is already showing, so the
      // sheet can't disagree with the screen it was shared from.
      a.record = f.rec1 || a.record; a.rank = f.rank1 || a.rank;
      b.record = f.rec2 || b.record; b.rank = f.rank2 || b.rank;
      return Promise.all([loadImg(a.slug), loadImg(b.slug), loadBrandLogo()]).then(function (imgs) {
        var imgA = imgs[0], imgB = imgs[1], logo = imgs[2];
        var colors = champColors(a.rank, b.rank), colA = colors[0], colB = colors[1];

        var CH = H;
        var cv = document.createElement('canvas');
        cv.width = W; cv.height = CH;
        var ctx = cv.getContext('2d');
        ctx.fillStyle = BG; ctx.fillRect(0, 0, W, CH);

        brand(ctx, 82, (ctxInfo && ctxInfo.event) || 'UFC', logo);
        ctx.font = '400 24px ' + SANS; ctx.fillStyle = MUT;
        var divName = (ctxInfo && ctxInfo.weightClass) || a.division || '';
        var dateStr = (ctxInfo && ctxInfo.date) || '';
        if (dateStr) ctx.fillText(dateStr, 64, 118);

        var y = versusBlock(ctx, a, b, imgA, imgB, 152, 46, colA, colB, true);
        if (divName) {
          ctx.save();
          ctx.textAlign = 'center'; ctx.font = '600 22px ' + SANS; ctx.fillStyle = MUT;
          ctx.fillText(divName.toUpperCase(), W / 2, y - 3);
          ctx.restore();
        }

        y = sectionTitle(ctx, 'Tale of the tape', y + 46);
        y += 44;
        tapeRow(ctx, 'height', a.ht, b.ht, y); y += 45;
        tapeRow(ctx, 'reach', a.reach, b.reach, y); y += 45;
        tapeRow(ctx, 'age', a.age, b.age, y); y += 45;
        tapeRow(ctx, 'stance', a.stance, b.stance, y); y += 45;
        if (f.o1 != null && f.o2 != null) {
          ctx.textAlign = 'left'; ctx.font = '700 32px ' + COND;
          ctx.fillStyle = TXT; ctx.fillText(String(f.o1), 64, y);
          ctx.textAlign = 'right'; ctx.fillStyle = TXT;
          ctx.fillText(String(f.o2), W - 64, y);
          ctx.textAlign = 'center'; ctx.font = '400 20px ' + SANS; ctx.fillStyle = FOOT;
          ctx.fillText('MONEYLINE', W / 2, y - 3);
          ctx.textAlign = 'left';
          y += 12;
        }
        y += 18;

        y = sectionTitle(ctx, 'Head to head', y + 44) + 38;
        var stats = breakdown.stats || {};
        y = h2hTable(ctx, stats.a, stats.b, y, stats.sig);

        var lean = breakdown.lean || {};
        y = sectionTitle(ctx, 'Style', y + 40);
        styleBar(ctx, y + 76, lean.a, lean.b, ACC, ACC, a.name, b.name);
        y += 152;

        y = sectionTitle(ctx, 'Path to victory', y + 42) + 14;
        var path = breakdown.path || {};
        if (path.a) y = pathBlock(ctx, a.name, path.a, ACC, y, 4);
        if (path.b) y = pathBlock(ctx, b.name, path.b, ACC, y, 4);

        footer(ctx, CH);
        return cv;
      });
    });
  }

  // ── SIMULATION SHEET ───────────────────────────────────────────────────
  function drawSim(nameA, nameB, slugA, slugB, result, rounds) {
    return fontsReady().then(function () {
      return Promise.all([fetchMeta(nameA, slugA), fetchMeta(nameB, slugB)]);
    }).then(function (metas) {
      var a = metas[0], b = metas[1];
      return Promise.all([loadImg(a.slug), loadImg(b.slug), loadBrandLogo()]).then(function (imgs) {
        var imgA = imgs[0], imgB = imgs[1], logo = imgs[2];
        var pctA = Math.round((result.winsA / result.n) * 100), pctB = 100 - pctA;
        var CH = 1080;
        var cv = document.createElement('canvas');
        cv.width = W; cv.height = CH;
        var ctx = cv.getContext('2d');
        ctx.fillStyle = BG; ctx.fillRect(0, 0, W, CH);

        brand(ctx, 72, 'Fight simulator', logo);
        ctx.textAlign = 'right'; ctx.font = '400 23px ' + SANS; ctx.fillStyle = MUT;
        ctx.fillText(result.n.toLocaleString() + ' simulations  ·  ' + rounds + ' rounds', W - 64, 104);
        ctx.textAlign = 'left';

        var colA = ACC, colB = ACC;
        var y = versusBlock(ctx, a, b, imgA, imgB, 150, 46, colA, colB, false);

        y = sectionTitle(ctx, 'Win probability', y + 46) + 34;
        ctx.font = '800 104px ' + COND;
        ctx.textAlign = 'left'; ctx.fillStyle = colA; ctx.fillText(pctA + '%', 64, y + 76);
        ctx.textAlign = 'right'; ctx.fillStyle = colB; ctx.fillText(pctB + '%', W - 64, y + 76);
        ctx.textAlign = 'left';
        y += 100;
        var bx = 64, bw = W - 128, bh = 22;
        roundRect(ctx, bx, y, bw, bh, bh / 2); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill();
        ctx.save();
        roundRect(ctx, bx, y, bw, bh, bh / 2); ctx.clip();
        if (pctA >= pctB) {
          ctx.fillStyle = colA; ctx.fillRect(bx, y, bw * (pctA / 100), bh);
        } else {
          var fw = bw * (pctB / 100);
          ctx.fillStyle = colB; ctx.fillRect(bx + bw - fw, y, fw, bh);
        }
        ctx.restore();
        y += 74;

        y = sectionTitle(ctx, 'How each fighter wins', y + 20) + 24;
        var gap = 44, colW = (W - 128 - gap) / 2;
        var yA = methodCol(ctx, 64, colW, a.name, result.methodsA, result.winsA, colA, y);
        var yB = methodCol(ctx, 64 + colW + gap, colW, b.name, result.methodsB, result.winsB, colB, y);
        y = Math.max(yA, yB);

        footer(ctx, CH);
        return cv;
      });
    });
  }

  // ── STRIKING / GRAPPLING CROSS-TAB SHEETS ──────────────────────────────
  // sheet: the {A,B} object from /api/app/deep-dive-fight's `sheet` field
  // (worker/deep-dive-data.js's sheetGrid/sheetSide) — the raw _ddGrid shape
  // (cells, cellsD, tdL/tdA/tdAgL/tdAgA/ctrl/ctrlAg/sub/rev/cage/sFights)
  // PLUS shadeCells/shadeCellsD (division-normalized z-scores, already
  // clamped to [-1,1]) and gradeAllow (w/b/n per SHEET_LANES entry) — the
  // exact numbers the site's _sgNorm()/_mhGrade() would have produced, just
  // computed once on the server instead of read off site globals here.
  var SG_FLOOR = 25;
  var SG_LANES = [['dist', 'head'], ['dist', 'body'], ['dist', 'leg'], ['ground', 'head']];
  var _sgGI = function (p, t) { return ['dist', 'clinch', 'ground'].indexOf(p) * 3 + ['head', 'body', 'leg'].indexOf(t); };
  function lastNameOf(full) {
    var parts = String(full || '').trim().split(/\s+/).filter(Boolean);
    while (parts.length > 1 && /^(jr|sr|ii|iii|iv|v)\.?$/i.test(parts[parts.length - 1])) parts.pop();
    return parts[parts.length - 1] || '';
  }
  function sgBar(ctx, label, txtA, txtB, subA, subB, fracA, fracB, y, accA, accB, S) {
    S = S || 1;
    var px = function (n) { return Math.round(n * S); };
    ctx.textAlign = 'center'; ctx.font = '400 ' + px(21) + 'px ' + SANS; ctx.fillStyle = MUT;
    ctx.fillText(String(label).toUpperCase(), W / 2, y);
    var vy = y + px(40);
    ctx.textAlign = 'left'; ctx.font = '700 ' + px(36) + 'px ' + COND; ctx.fillStyle = accA ? ACC : TXT;
    ctx.fillText(txtA, 64, vy);
    ctx.textAlign = 'right'; ctx.fillStyle = accB ? ACC : TXT;
    ctx.fillText(txtB, W - 64, vy);
    if (subA || subB) {
      ctx.font = '400 ' + px(20) + 'px ' + SANS; ctx.fillStyle = FOOT;
      ctx.textAlign = 'left'; if (subA) ctx.fillText(subA, 64, vy + px(26));
      ctx.textAlign = 'right'; if (subB) ctx.fillText(subB, W - 64, vy + px(26));
    }
    var gap = 18, half = 268, bh = px(12), by = y + px(16);
    var lx = W / 2 - gap - half, rx = W / 2 + gap;
    roundRect(ctx, lx, by, half, bh, 6); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill();
    roundRect(ctx, rx, by, half, bh, 6); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill();
    var barW = function (f) { var v = Math.max(0, Math.min(1, f)); return v > 0 ? Math.max(4, half * v) : 0; };
    var wa = barW(fracA), wb = barW(fracB);
    if (wa) { roundRect(ctx, lx + half - wa, by, wa, bh, 6); ctx.fillStyle = accA ? ACC : 'rgba(255,255,255,0.34)'; ctx.fill(); }
    if (wb) { roundRect(ctx, rx, by, wb, bh, 6); ctx.fillStyle = accB ? ACC : 'rgba(255,255,255,0.34)'; ctx.fill(); }
    ctx.textAlign = 'left';
    return y + (subA || subB ? 96 : 80);
  }
  function sgTitle(ctx, t, y, S) {
    S = S || 1;
    ctx.strokeStyle = LINE; ctx.lineWidth = 1;
    var ly = y - Math.round(40.5 * S) - 0.5;
    ctx.beginPath(); ctx.moveTo(64, ly); ctx.lineTo(W - 64, ly); ctx.stroke();
    ctx.font = '700 ' + Math.round(29 * S) + 'px ' + SANS; ctx.fillStyle = TXT;
    ctx.fillText(String(t).toUpperCase(), 64, y);
    return y + Math.round(30 * S);
  }
  // Same 3x3 cross-tab as the site's sgGrid, but reads its shading straight
  // off G.shadeCells[i] (pre-computed server-side) instead of calling
  // _sgNorm(name, 'acc', i) itself.
  function sgGrid(ctx, G, x, y, w, showLabels) {
    var cw = w / 3, rh = 84;
    ctx.textAlign = 'center';
    ctx.font = '700 25px ' + SANS; ctx.fillStyle = MUT;
    ['HEAD', 'BODY', 'LEG'].forEach(function (t, i) { ctx.fillText(t, x + cw * i + cw / 2, y); });
    var yy = y + 16;
    [['dist', 'DIST'], ['clinch', 'CLIN'], ['ground', 'GRND']].forEach(function (pair) {
      var p = pair[0], plabel = pair[1];
      if (showLabels) {
        ctx.textAlign = 'right'; ctx.font = '700 22px ' + SANS; ctx.fillStyle = FOOT;
        ctx.fillText(plabel, x - 14, yy + rh / 2 + 7);
      }
      ['head', 'body', 'leg'].forEach(function (t, ci) {
        var i = _sgGI(p, t), c = G.cells[i];
        var n = c[1], thin = n < SG_FLOOR, r = n ? c[0] / n : 0;
        var z = thin ? null : G.shadeCells[i];
        var bg = 'rgba(255,255,255,0.03)';
        if (z != null) {
          bg = z >= 0 ? 'rgba(0,230,104,' + (0.06 + 0.44 * z).toFixed(3) + ')'
                      : 'rgba(255,64,64,' + (0.06 + 0.34 * (-z)).toFixed(3) + ')';
        }
        var cx = x + cw * ci + 4, cy = yy + 4, cwid = cw - 8, chh = rh - 8;
        roundRect(ctx, cx, cy, cwid, chh, 9); ctx.fillStyle = bg; ctx.fill();
        if (thin) { ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 1; ctx.stroke(); }
        ctx.textAlign = 'center';
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
  function sgHead(nameA, nameB, slugA, slugB, info, kicker, CH, R) {
    return fontsReady().then(function () {
      return Promise.all([fetchMeta(nameA, slugA), fetchMeta(nameB, slugB)]);
    }).then(function (metas) {
      var a = metas[0], b = metas[1];
      return Promise.all([loadImg(a.slug), loadImg(b.slug), loadBrandLogo()]).then(function (imgs) {
        var imgA = imgs[0], imgB = imgs[1], logo = imgs[2];
        var cv = document.createElement('canvas');
        cv.width = W; cv.height = CH;
        var ctx = cv.getContext('2d');
        ctx.fillStyle = BG; ctx.fillRect(0, 0, W, CH);
        brand(ctx, 84, kicker, logo);
        var sub = [(info && info.weightClass) || '', (info && info.date) || ''].filter(Boolean).join(' · ');
        if (sub) { ctx.font = '400 26px ' + SANS; ctx.fillStyle = MUT; ctx.fillText(sub, 64, 122); }
        var colors = champColors(a.rank, b.rank), colA = colors[0], colB = colors[1];
        var y = versusBlock(ctx, a, b, imgA, imgB, 158, R || 46, colA, colB, false);
        return { cv: cv, ctx: ctx, CH: CH, y: y, a: a, b: b };
      });
    });
  }
  function drawStriking(nameA, nameB, slugA, slugB, sheet, info) {
    var A = sheet && sheet.A, B = sheet && sheet.B;
    if (!A || !B) return Promise.reject(new Error('No striking breakdown available for this bout.'));
    var S = 1.3;
    return sgHead(nameA, nameB, slugA, slugB, info, (info && info.event) || 'UFC', 1920, 54).then(function (head) {
      var cv = head.cv, ctx = head.ctx, CH = head.CH;
      var y = head.y + 10;

      y = sgTitle(ctx, 'Where the fight happens', y + Math.round(44 * S), S) + Math.round(14 * S);
      var tot = function (G) { return G.cells.reduce(function (s, c) { return s + c[1]; }, 0) || 1; };
      var tA = tot(A), tB = tot(B);
      [[0, 'At range'], [1, 'In the clinch'], [2, 'On the ground']].forEach(function (row) {
        var g = row[0], lab = row[1];
        var ra = (A.cells[g * 3][1] + A.cells[g * 3 + 1][1] + A.cells[g * 3 + 2][1]) / tA;
        var rb = (B.cells[g * 3][1] + B.cells[g * 3 + 1][1] + B.cells[g * 3 + 2][1]) / tB;
        y = sgBar(ctx, lab, Math.round(ra * 100) + '%', Math.round(rb * 100) + '%', null, null, ra, rb, y, false, false, S);
      });

      y = sgTitle(ctx, 'How well it lands', y + Math.round(48 * S), S) + Math.round(30 * S);
      var gw = 420;
      ctx.textAlign = 'center'; ctx.font = '700 32px ' + COND; ctx.fillStyle = TXT;
      ctx.fillText(clip(ctx, String(lastNameOf(nameA)).toUpperCase(), gw), 108 + gw / 2, y);
      ctx.fillText(clip(ctx, String(lastNameOf(nameB)).toUpperCase(), gw), W - 84 - gw / 2, y);
      ctx.textAlign = 'left';
      var gy = y + 36;
      sgGrid(ctx, A, 108, gy, gw, true);
      var gEnd = sgGrid(ctx, B, W - 84 - gw, gy, gw, false);
      y = gEnd + 40;
      ctx.textAlign = 'center'; ctx.font = '400 24px ' + SANS; ctx.fillStyle = FOOT;
      ctx.fillText('accuracy by position and target · shaded vs the division median', W / 2, y);
      ctx.textAlign = 'left';

      var rows = [];
      SG_LANES.forEach(function (lane, li) {
        var p = lane[0], t = lane[1];
        var i = _sgGI(p, t), ca = A.cellsD[i], cb = B.cellsD[i];
        if (ca[1] < SG_FLOOR && cb[1] < SG_FLOOR) return;
        var lab = ['Head at range', 'Body at range', 'Leg kicks', 'Ground strikes'][li];
        rows.push([lab, li, ca, cb]);
      });
      if (rows.length) {
        var need = Math.round(92 * S) + Math.round(62 * S);
        if (CH - 100 - y >= need) {
          y = sgTitle(ctx, 'What lands on them', y + Math.round(50 * S), S) + Math.round(14 * S);
          var room = Math.floor((CH - 100 - y) / Math.round(62 * S));
          rows.slice(0, Math.max(0, room)).forEach(function (row) {
            var lab = row[0], li = row[1], ca = row[2], cb = row[3];
            var ra = ca[1] ? ca[0] / ca[1] : 0, rb = cb[1] ? cb[0] / cb[1] : 0;
            var gA = A.gradeAllow ? A.gradeAllow[li] : null;
            var gB = B.gradeAllow ? B.gradeAllow[li] : null;
            y = sgBar(ctx, lab,
              ca[1] < SG_FLOOR ? '—' : Math.round(ra * 100) + '%',
              cb[1] < SG_FLOOR ? '—' : Math.round(rb * 100) + '%',
              null, null, ra, rb, y, gA === 'w', gB === 'w', S);
          });
        }
      }
      footer(ctx, CH);
      return cv;
    });
  }
  function drawGrappling(nameA, nameB, slugA, slugB, sheet, info) {
    var A = sheet && sheet.A, B = sheet && sheet.B;
    if (!A || !B) return Promise.reject(new Error('No grappling breakdown available for this bout.'));
    var S = 1.1;
    return sgHead(nameA, nameB, slugA, slugB, info, (info && info.event) || 'UFC', 1350, 46).then(function (head) {
      var cv = head.cv, ctx = head.ctx, CH = head.CH;
      var y = head.y + 8;

      var per15 = A.cage > 0 && B.cage > 0;
      var eA = per15 ? A.cage / 900 : (A.sFights || 1), eB = per15 ? B.cage / 900 : (B.sFights || 1);
      var unit = per15 ? '/15min' : '/fight';
      var mins = function (s) { return Math.floor(s / 60) + 'm ' + String(Math.round(s % 60)).padStart(2, '0') + 's'; };

      y = sgTitle(ctx, 'Takedowns', y + Math.round(44 * S), S) + Math.round(14 * S);
      y = sgBar(ctx, 'Takedowns landed',
        A.tdL + '/' + A.tdA, B.tdL + '/' + B.tdA,
        (A.tdA ? Math.round(A.tdL / A.tdA * 100) + '% · ' : '') + (A.tdL / eA).toFixed(1) + unit,
        (B.tdA ? Math.round(B.tdL / B.tdA * 100) + '% · ' : '') + (B.tdL / eB).toFixed(1) + unit,
        A.tdA ? A.tdL / A.tdA : 0, B.tdA ? B.tdL / B.tdA : 0, y, false, false, S);
      var sA = A.tdAgA ? (A.tdAgA - A.tdAgL) / A.tdAgA : 0, sB = B.tdAgA ? (B.tdAgA - B.tdAgL) / B.tdAgA : 0;
      y = sgBar(ctx, 'Takedowns stopped',
        (A.tdAgA - A.tdAgL) + '/' + A.tdAgA, (B.tdAgA - B.tdAgL) + '/' + B.tdAgA,
        A.tdAgA ? Math.round(sA * 100) + '%' : 'never shot on',
        B.tdAgA ? Math.round(sB * 100) + '%' : 'never shot on',
        sA, sB, y, false, false, S);

      y = sgTitle(ctx, 'Control', y + Math.round(58 * S), S) + Math.round(14 * S);
      var cA = A.ctrl / eA, cB = B.ctrl / eB, mC = Math.max(cA, cB, 1);
      y = sgBar(ctx, 'Control time', mins(A.ctrl), mins(B.ctrl),
        mins(cA) + ' ' + (per15 ? 'per 15 min' : 'per fight'),
        mins(cB) + ' ' + (per15 ? 'per 15 min' : 'per fight'),
        cA / mC, cB / mC, y, false, false, S);
      var kA = A.ctrlAg / eA, kB = B.ctrlAg / eB, mK = Math.max(kA, kB, 1);
      y = sgBar(ctx, 'Time spent under control', mins(A.ctrlAg), mins(B.ctrlAg),
        mins(kA) + ' ' + (per15 ? 'per 15 min' : 'per fight'),
        mins(kB) + ' ' + (per15 ? 'per 15 min' : 'per fight'),
        kA / mK, kB / mK, y, false, false, S);

      var ex = [['Submission attempts', A.sub, B.sub], ['Reversals', A.rev, B.rev]].filter(function (r) { return r[1] || r[2]; });
      if (ex.length) {
        y = sgTitle(ctx, 'On the mat', y + Math.round(58 * S), S) + Math.round(14 * S);
        ex.forEach(function (row) {
          var lab = row[0], va = row[1], vb = row[2];
          var ra = va / eA, rb = vb / eB, m = Math.max(ra, rb, 0.01);
          y = sgBar(ctx, lab, String(va), String(vb),
            'in ' + A.sFights + ' fights', 'in ' + B.sFights + ' fights',
            ra / m, rb / m, y, false, false, S);
        });
      }
      footer(ctx, CH);
      return cv;
    });
  }

  // ── PICK'EM SHEET ──────────────────────────────────────────────────────
  var PK_CONF_COL = { High: ACC, Med: AMB, Low: MUT };
  var PK_RED = '#ff5f57';
  function pkMethodLabel(p) {
    if (!p.method) return 'method TBD';
    if (p.method === 'Decision') return 'Decision';
    return p.method + (p.round ? ' · R' + p.round : '');
  }
  function pkPossessive(name) { return name ? (name + (/s$/i.test(name) ? "'" : "'s")) : 'My'; }
  function pkLegend(ctx, x, y) {
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = '700 21px ' + COND; ctx.fillStyle = MUT;
    ctx.fillText('CONFIDENCE', x, y);
    var lx = x + ctx.measureText('CONFIDENCE').width + 28;
    [['High', ACC], ['Med', AMB], ['Low', MUT]].forEach(function (pair) {
      var lab = pair[0], c = pair[1];
      roundRect(ctx, lx, y - 5, 26, 9, 4.5); ctx.fillStyle = c; ctx.fill();
      ctx.font = '600 24px ' + SANS; ctx.fillStyle = TXT;
      ctx.fillText(lab, lx + 36, y + 1);
      lx += 36 + ctx.measureText(lab).width + 34;
    });
    ctx.textBaseline = 'alphabetic';
  }
  function pkInitials(name) {
    return String(name || '').split(/\s+/).map(function (s) { return s[0]; }).join('').slice(0, 2).toUpperCase();
  }
  function drawSegs(ctx, segs, x, y, maxX) {
    var cx = x;
    for (var i = 0; i < segs.length; i++) {
      var s = segs[i];
      ctx.font = s.f; ctx.fillStyle = s.c;
      var t = s.t;
      if (maxX != null && cx + ctx.measureText(t).width > maxX) t = clip(ctx, t, Math.max(0, maxX - cx));
      if (!t) continue;
      ctx.fillText(t, cx, y);
      cx += ctx.measureText(t).width;
      if (maxX != null && cx >= maxX) break;
    }
    return cx;
  }
  function segsWidth(ctx, segs) {
    var w = 0;
    segs.forEach(function (s) { ctx.font = s.f; w += ctx.measureText(s.t).width; });
    return w;
  }
  function drawSegsCentered(ctx, segs, cx, y, maxX) {
    var tw = segsWidth(ctx, segs);
    drawSegs(ctx, segs, cx - tw / 2, y, maxX);
  }
  function pkPickBadge(ctx, cx, cy, r, hit) {
    var br = Math.max(13, r * 0.36), bx = cx + r * 0.64, by = cy + r * 0.64;
    ctx.beginPath(); ctx.arc(bx, by, br + 3, 0, Math.PI * 2); ctx.fillStyle = BG; ctx.fill();
    ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fillStyle = hit === false ? PK_RED : ACC; ctx.fill();
    ctx.strokeStyle = '#0b0c0f'; ctx.lineWidth = Math.max(2, br * 0.26); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    if (hit === false) {
      var d = br * 0.4;
      ctx.moveTo(bx - d, by - d); ctx.lineTo(bx + d, by + d);
      ctx.moveTo(bx + d, by - d); ctx.lineTo(bx - d, by + d);
    } else {
      ctx.moveTo(bx - br * 0.42, by);
      ctx.lineTo(bx - br * 0.06, by + br * 0.36);
      ctx.lineTo(bx + br * 0.46, by - br * 0.34);
    }
    ctx.stroke();
  }
  function pkBoutCard(ctx, p, x, y, w, imgWin, imgLose, graded, s) {
    var R = 53 * s;
    var headY = y + 18 * s;
    var tag = p.isMain ? 'MAIN EVENT' : '';
    if (tag) {
      ctx.textAlign = 'center'; ctx.font = '700 ' + (20 * s).toFixed(1) + 'px ' + SANS; ctx.fillStyle = ACC;
      ctx.fillText(tag, x + w / 2, headY);
    }
    if (graded) {
      var pts = p.points | 0, ptsStr = (pts > 0 ? '+' : '') + pts;
      ctx.textAlign = 'right'; ctx.font = '800 ' + (26 * s).toFixed(1) + 'px ' + COND;
      ctx.fillStyle = p.voided ? MUT : (pts > 0 ? ACC : (pts < 0 ? PK_RED : MUT));
      ctx.fillText(ptsStr, x + w, headY);
    }
    var cxA = x + w * 0.27, cxB = x + w * 0.73;
    var avY = headY + 15 * s + R;
    var hit = p.voided ? null : (graded ? !!p.winnerHit : true);
    var ringCol = graded ? (p.voided ? MUT : (p.winnerHit ? ACC : PK_RED)) : (PK_CONF_COL[p.confidence] || MUT);
    avatar(ctx, imgWin, cxA, avY, R, pkInitials(p.winner), ringCol);
    avatar(ctx, imgLose, cxB, avY, R, pkInitials(p.loser), LINE);
    if (!p.voided) pkPickBadge(ctx, cxA, avY, R, hit);
    ctx.textAlign = 'center'; ctx.font = '800 ' + (31 * s).toFixed(1) + 'px ' + COND; ctx.fillStyle = MUT;
    ctx.fillText('VS', x + w / 2, avY + 10 * s);

    var nameY = avY + R + 41 * s;
    var nameMax = w * 0.4;
    ctx.font = '700 ' + (28 * s).toFixed(1) + 'px ' + COND;
    ctx.fillStyle = TXT; ctx.fillText(clip(ctx, (p.winner || '').toUpperCase(), nameMax), cxA, nameY);
    ctx.fillStyle = '#c8ccd2'; ctx.fillText(clip(ctx, (p.loser || '').toUpperCase(), nameMax), cxB, nameY);

    var lineY = nameY + 33 * s;
    ctx.textAlign = 'left';
    if (!graded) {
      ctx.textAlign = 'center'; ctx.font = '600 ' + (23 * s).toFixed(1) + 'px ' + SANS; ctx.fillStyle = ringCol;
      ctx.fillText(clip(ctx, pkMethodLabel(p), nameMax), cxA, lineY);
      ctx.textAlign = 'left';
    } else if (p.voided) {
      ctx.textAlign = 'center'; ctx.font = '600 ' + (23 * s).toFixed(1) + 'px ' + SANS; ctx.fillStyle = MUT;
      ctx.fillText('Draw / No Contest', x + w / 2, lineY);
      ctx.textAlign = 'left';
    } else {
      var win = p.actualWinner || p.winner, los = p.actualLoser || p.loser || '';
      var seg = [
        { t: win, f: '700 ' + (24 * s).toFixed(1) + 'px ' + COND, c: TXT },
        { t: ' def. ', f: '400 ' + (19 * s).toFixed(1) + 'px ' + SANS, c: MUT },
        { t: los, f: '400 ' + (20 * s).toFixed(1) + 'px ' + SANS, c: '#c8ccd2' },
      ];
      drawSegsCentered(ctx, seg, x + w / 2, lineY, x + w - 4);
    }
  }
  var ROW_H = 225;
  function drawPickem(data) {
    return fontsReady().then(function () {
      return loadBrandLogo();
    }).then(function (logo) {
      var picks = (data.picks || []).slice();
      var n = picks.length || 1;
      var graded = !!data.graded;
      var title = pkPossessive(data.name) + (graded ? ' Results' : ' Picks');

      var cv = document.createElement('canvas');
      cv.width = W;
      var ctx = cv.getContext('2d');
      ctx.font = '800 60px ' + COND;
      var titleLines = wrap(ctx, title, W - 128).slice(0, 2);
      var L = titleLines.length;
      var lastTitleY = 152 + (L - 1) * 64;
      var subY = lastTitleY + 46;
      var legendY = subY + 44;
      var divY = legendY + (graded ? 22 : 24);
      var listTop = divY + (graded ? 22 : 26);

      var gap = 28, divH = 56;
      var hasFlag = picks.some(function (p) { return p.isMainCard; });
      var hasMain = picks.some(function (p) { return p.isMain; });
      var canSplit = hasFlag || hasMain;
      var mainCardAll = !canSplit ? picks : (hasFlag ? picks.filter(function (p) { return p.isMainCard || p.isMain; }) : picks.filter(function (p) { return p.isMain; }));
      var prelims = !canSplit ? [] : (hasFlag ? picks.filter(function (p) { return !p.isMainCard && !p.isMain; }) : picks.filter(function (p) { return !p.isMain; }));
      var mainEvent = mainCardAll.filter(function (p) { return p.isMain; })[0] || null;
      var mainCardRest = mainCardAll.filter(function (p) { return p !== mainEvent; });
      function gridDims(arr) {
        var cols = arr.length <= 1 ? 1 : 2;
        var rows = Math.ceil(arr.length / cols);
        var colW = (W - 128 - gap * (cols - 1)) / cols;
        var s = Math.min(1, colW / 620);
        return { cols: cols, rows: rows, colW: colW, s: s, rowH: ROW_H * s, h: rows * ROW_H * s };
      }
      function gridX(grid, arr, i) {
        if (grid.cols === 2 && i === arr.length - 1 && arr.length % 2 === 1) {
          return 64 + (W - 128 - grid.colW) / 2;
        }
        return 64 + (i % grid.cols) * (grid.colW + gap);
      }
      var mainCardGrid = mainCardRest.length ? gridDims(mainCardRest) : null;
      var prelimsGrid = prelims.length ? gridDims(prelims) : null;
      var bodyH = (mainEvent ? ROW_H : 0) + (mainCardGrid ? mainCardGrid.h : 0) + (prelimsGrid ? divH + prelimsGrid.h : 0);
      var footerBlockH = 40;
      var CH = Math.round(listTop + bodyH + footerBlockH);
      cv.height = CH;
      ctx = cv.getContext('2d');
      ctx.fillStyle = BG; ctx.fillRect(0, 0, W, CH);

      brand(ctx, 78, "Pick'em", logo);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = TXT; ctx.font = '800 60px ' + COND;
      titleLines.forEach(function (line, i) { ctx.fillText(line, 64, 152 + i * 64); });
      ctx.font = '400 27px ' + SANS; ctx.fillStyle = MUT;
      var tail = graded
        ? (picks.filter(function (p) { return p.winnerHit; }).length + '/' + n + ' winners')
        : (n + ' pick' + (n === 1 ? '' : 's'));
      var sub = [data.eventName, data.eventDate, tail].filter(Boolean).join('   ·   ');
      ctx.fillText(clip(ctx, sub, W - 128), 64, subY);
      pkLegend(ctx, 64, legendY);
      if (graded) {
        var total = data.totalPoints || 0;
        ctx.textBaseline = 'middle'; ctx.textAlign = 'right';
        var valStr = (total > 0 ? '+' : '') + total + ' pts';
        ctx.font = '800 32px ' + COND; ctx.fillStyle = total < 0 ? PK_RED : ACC;
        ctx.fillText(valStr, W - 64, legendY + 1);
        var vw = ctx.measureText(valStr).width;
        ctx.font = '700 22px ' + COND; ctx.fillStyle = MUT;
        ctx.fillText('TOTAL', W - 64 - vw - 12, legendY + 1);
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      }
      ctx.strokeStyle = LINE; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(64, divY); ctx.lineTo(W - 64, divY); ctx.stroke();

      // winnerSlug/loserSlug come straight off the app's own pick payload —
      // built from BOUTS' s1/s2, unlike the site which derives the loser
      // slug via nameToSlug() at share time.
      return Promise.all(picks.map(function (p) {
        return Promise.all([loadImg(p.winnerSlug), loadImg(p.loserSlug)]);
      })).then(function (imgPairs) {
        var imgFor = new Map(picks.map(function (p, i) { return [p, imgPairs[i]]; }));
        var cy = listTop;
        if (mainEvent) {
          var imgs0 = imgFor.get(mainEvent);
          pkBoutCard(ctx, mainEvent, 64, cy, W - 128, imgs0[0], imgs0[1], graded, 1);
          cy += ROW_H;
        }
        if (mainCardGrid) {
          mainCardRest.forEach(function (p, i) {
            var row = Math.floor(i / mainCardGrid.cols);
            var bx = gridX(mainCardGrid, mainCardRest, i), by = cy + row * mainCardGrid.rowH;
            var imgs = imgFor.get(p);
            pkBoutCard(ctx, p, bx, by, mainCardGrid.colW, imgs[0], imgs[1], graded, mainCardGrid.s);
          });
          cy += mainCardGrid.h;
        }
        if (prelimsGrid) {
          ctx.textAlign = 'left'; ctx.font = '700 22px ' + COND; ctx.fillStyle = MUT;
          ctx.fillText('PRELIMS', 64, cy + 30);
          ctx.strokeStyle = LINE; ctx.beginPath(); ctx.moveTo(64, cy + divH - 14); ctx.lineTo(W - 64, cy + divH - 14); ctx.stroke();
          cy += divH;
          prelims.forEach(function (p, i) {
            var row = Math.floor(i / prelimsGrid.cols);
            var bx = gridX(prelimsGrid, prelims, i), by = cy + row * prelimsGrid.rowH;
            var imgs = imgFor.get(p);
            pkBoutCard(ctx, p, bx, by, prelimsGrid.colW, imgs[0], imgs[1], graded, prelimsGrid.s);
          });
          cy += prelimsGrid.h;
        }
        return cv;
      });
    });
  }

  // ── FULL EVENT CARD (no picks) ─────────────────────────────────────────
  function evGroups(fights) {
    var hasFlag = fights.some(function (f) { return f.isMainCard; });
    var mainCardAll = hasFlag ? fights.filter(function (f) { return f.isMainCard || f.isMain; }) : fights.filter(function (f) { return f.isMain; });
    var prelims = hasFlag ? fights.filter(function (f) { return !f.isMainCard && !f.isMain; }) : fights.filter(function (f) { return !f.isMain; });
    var mainEvent = mainCardAll.filter(function (f) { return f.isMain; })[0] || mainCardAll[0] || null;
    var coMain = mainCardAll.filter(function (f) { return f !== mainEvent; })[0] || null;
    var restMainCard = mainCardAll.filter(function (f) { return f !== mainEvent && f !== coMain; });
    return { mainEvent: mainEvent, coMain: coMain, restMainCard: restMainCard, prelims: prelims };
  }
  function evPairX(x0, w, R, vsGap) {
    var span = 4 * R + vsGap;
    var cxA = x0 + (w - span) / 2 + R;
    return { cxA: cxA, cxB: cxA + 2 * R + vsGap };
  }
  function evNameGradient(ctx, y, fontPx) {
    var g = ctx.createLinearGradient(0, y - fontPx * 0.78, 0, y + fontPx * 0.26);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.55, '#ffffff');
    g.addColorStop(1, '#7e9188');
    return g;
  }
  function evLastName(full) { return lastNameOf(full); }
  function evFitNameFont(ctx, name, maxW, weight, maxFontPx, minFontPx) {
    var fontPx = maxFontPx;
    ctx.font = weight + ' ' + fontPx.toFixed(1) + 'px ' + COND;
    while (fontPx > minFontPx && ctx.measureText(name).width > maxW) {
      fontPx -= 1;
      ctx.font = weight + ' ' + fontPx.toFixed(1) + 'px ' + COND;
    }
    return fontPx;
  }
  function evDrawName(ctx, text, cx, y, maxW, weight, fontPx) {
    var name = evLastName(text).toUpperCase();
    ctx.font = weight + ' ' + fontPx.toFixed(1) + 'px ' + COND;
    ctx.textAlign = 'center';
    ctx.fillStyle = evNameGradient(ctx, y, fontPx);
    ctx.fillText(clip(ctx, name, maxW), cx, y);
    ctx.textAlign = 'left';
  }
  function evBoutCard(ctx, f, x, y, w, imgA, imgB, s) {
    var R = 62 * s, vsGap = 30 * s;
    var pair = evPairX(x, w, R, vsGap), cxA = pair.cxA, cxB = pair.cxB;
    var avY = y + 6 * s + R;
    avatar(ctx, imgA, cxA, avY, R, pkInitials(f.f1), LINE);
    avatar(ctx, imgB, cxB, avY, R, pkInitials(f.f2), LINE);
    ctx.textAlign = 'center'; ctx.font = '800 ' + (26 * s).toFixed(1) + 'px ' + COND; ctx.fillStyle = MUT;
    ctx.fillText('VS', x + w / 2, avY + 9 * s);
    var nameFontPx = 32 * s, nameY = avY + R + nameFontPx + 12 * s, nameMax = w * 0.46, nameMin = 20 * s;
    var name1 = evLastName(f.f1).toUpperCase(), name2 = evLastName(f.f2).toUpperCase();
    var fitPx = Math.min(
      evFitNameFont(ctx, name1, nameMax, '800', nameFontPx, nameMin),
      evFitNameFont(ctx, name2, nameMax, '800', nameFontPx, nameMin)
    );
    evDrawName(ctx, f.f1, cxA, nameY, nameMax, '800', fitPx);
    evDrawName(ctx, f.f2, cxB, nameY, nameMax, '800', fitPx);
  }
  function auroraBG(ctx, w, h) {
    ctx.fillStyle = BG; ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    [
      { x: 0.10 * w, y: 0.08 * h, r: 0.62 * w, c: 'rgba(0,230,104,0.11)' },
      { x: 0.92 * w, y: 0.38 * h, r: 0.58 * w, c: 'rgba(50,120,255,0.08)' },
      { x: 0.45 * w, y: h, r: 0.62 * w, c: 'rgba(0,230,104,0.09)' },
    ].forEach(function (b) {
      var g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      g.addColorStop(0, b.c); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    });
    ctx.restore();
  }
  function brandCentered(ctx, cx, y, size) {
    ctx.textAlign = 'left'; ctx.font = '800 ' + size + 'px ' + COND;
    var gW = ctx.measureText('GILLY').width, lW = ctx.measureText('LAB').width;
    var x0 = cx - (gW + lW) / 2;
    ctx.fillStyle = TXT; ctx.fillText('GILLY', x0, y);
    ctx.fillStyle = ACC; ctx.fillText('LAB', x0 + gW, y);
    ctx.textAlign = 'center';
  }
  var EV_BAR_H = 64, EV_BAR_GAP = 18;
  function evSectionBar(ctx, y, label, borderColor) {
    var x = 64, w = W - 128, h = EV_BAR_H;
    var g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, 'rgba(0,230,104,0.09)'); g.addColorStop(1, 'rgba(0,230,104,0.03)');
    ctx.fillStyle = g; roundRect(ctx, x, y, w, h, 8); ctx.fill();
    ctx.strokeStyle = borderColor || 'rgba(0,230,104,0.35)'; ctx.lineWidth = 1;
    roundRect(ctx, x, y, w, h, 8); ctx.stroke();
    ctx.textAlign = 'center'; ctx.font = '700 30px ' + COND; ctx.fillStyle = TXT;
    ctx.fillText(label, W / 2, y + h / 2 + 10);
    ctx.textAlign = 'left';
  }
  function evDrawTitle(ctx, text, cx, y0, maxW, font, lineH) {
    ctx.font = font;
    var words = String(text || '').toUpperCase().split(/\s+/).filter(Boolean);
    var lines = [];
    var cur = [], curW = 0;
    words.forEach(function (w, i) {
      var wSpaceW = ctx.measureText(w + ' ').width;
      if (cur.length && curW + ctx.measureText(w).width > maxW) { lines.push(cur); cur = []; curW = 0; }
      cur.push(i); curW += wSpaceW;
    });
    if (cur.length) lines.push(cur);
    lines.slice(0, 2).forEach(function (idxs, li) {
      var lineText = idxs.map(function (i) { return words[i]; }).join(' ');
      var x = cx - ctx.measureText(lineText).width / 2;
      ctx.textAlign = 'left';
      idxs.forEach(function (wi) {
        var word = words[wi];
        ctx.fillStyle = wi === 0 ? TXT : ACC;
        ctx.fillText(word, x, y0 + li * lineH);
        x += ctx.measureText(word + ' ').width;
      });
    });
    ctx.textAlign = 'center';
  }
  var EV_ROW_H = 196;
  function evGridDims(arr) {
    var cols = arr.length <= 1 ? 1 : (arr.length === 2 ? 2 : 3);
    var rows = Math.ceil(arr.length / cols);
    var evGap = 24;
    var colW = (W - 128 - evGap * (cols - 1)) / cols;
    var s = Math.min(1, colW / 300);
    return { cols: cols, rows: rows, colW: colW, gap: evGap, s: s, rowH: EV_ROW_H * s, h: rows * EV_ROW_H * s };
  }
  function evRowX(cols, colW, gap, rowLen, idx) {
    if (rowLen >= cols) return 64 + idx * (colW + gap);
    var totalW = cols * colW + (cols - 1) * gap;
    if (rowLen === 1) return 64 + (totalW - colW) / 2;
    var cx = 64 + colW + gap / 2 + idx * (colW + gap);
    return cx - colW / 2;
  }
  // data: { name, fights: [{f1,f2,s1,s2,isMain,isMainCard}] } — s1/s2 come
  // straight off the app's own fight-tile objects (no nameToSlug needed).
  function drawEventCard(data) {
    return fontsReady().then(function () {
      return loadBrandLogo();
    }).then(function (logo) {
      var fights = (data.fights || []).filter(function (f) { return f && f.f1 && f.f2; });
      var groups = evGroups(fights);
      var mainEvent = groups.mainEvent, coMain = groups.coMain, restMainCard = groups.restMainCard, prelims = groups.prelims;

      var topMargin = 56, heroR = 72, heroVsGap = 64;
      var EV_HERO_CENTER_H = 270;
      var heroH = mainEvent ? Math.max(heroR * 2 + 92, EV_HERO_CENTER_H) : 0;
      var mainCardGrid = restMainCard.length ? evGridDims(restMainCard) : null;
      var prelimsGrid = prelims.length ? evGridDims(prelims) : null;
      var showMainCardBar = !!(mainEvent || coMain || restMainCard.length);
      var bottomPad = 48;
      var bodyH = topMargin
        + (showMainCardBar ? EV_BAR_H + EV_BAR_GAP : 0)
        + heroH
        + (mainCardGrid ? mainCardGrid.h : 0)
        + (prelimsGrid ? EV_BAR_H + EV_BAR_GAP + prelimsGrid.h : 0);
      var CH = Math.round(bodyH + bottomPad);

      var cv = document.createElement('canvas');
      cv.width = W; cv.height = Math.max(CH, 640);
      var ctx = cv.getContext('2d');
      auroraBG(ctx, W, cv.height);

      var allFights = (mainEvent ? [mainEvent] : []).concat(coMain ? [coMain] : []).concat(restMainCard, prelims);
      return Promise.all(allFights.map(function (f) { return Promise.all([loadImg(f.s1), loadImg(f.s2)]); })).then(function (imgPairs) {
        var imgFor = new Map(allFights.map(function (f, i) { return [f, imgPairs[i]]; }));

        var cy = topMargin;
        if (showMainCardBar) {
          evSectionBar(ctx, cy, 'MAIN CARD', '#fff');
          cy += EV_BAR_H + EV_BAR_GAP;
        }
        if (mainEvent) {
          var centerW = 220;
          var pairW = (W - 128 - centerW) / 2;
          var leftX = 64, rightX = 64 + pairW + centerW, centerX = 64 + pairW + centerW / 2;
          var avY = cy + heroR;

          var drawPair = function (f, x0) {
            if (!f) return;
            var pr = evPairX(x0, pairW, heroR, heroVsGap), cxA = pr.cxA, cxB = pr.cxB;
            avatar(ctx, imgFor.get(f)[0], cxA, avY, heroR, pkInitials(f.f1), ACC);
            avatar(ctx, imgFor.get(f)[1], cxB, avY, heroR, pkInitials(f.f2), ACC);
            ctx.textAlign = 'center'; ctx.font = '800 34px ' + COND; ctx.fillStyle = MUT;
            ctx.fillText('VS', x0 + pairW / 2, avY + 11);
            var heroNameFontPx = 36, nameY = avY + heroR + heroNameFontPx + 14, nameMax = pairW * 0.52, heroNameMin = 24;
            var heroName1 = evLastName(f.f1).toUpperCase(), heroName2 = evLastName(f.f2).toUpperCase();
            var heroFitPx = Math.min(
              evFitNameFont(ctx, heroName1, nameMax, '800', heroNameFontPx, heroNameMin),
              evFitNameFont(ctx, heroName2, nameMax, '800', heroNameFontPx, heroNameMin)
            );
            evDrawName(ctx, f.f1, cxA, nameY, nameMax, '800', heroFitPx);
            evDrawName(ctx, f.f2, cxB, nameY, nameMax, '800', heroFitPx);
          };
          drawPair(mainEvent, leftX);
          drawPair(coMain, rightX);

          ctx.textAlign = 'center';
          var my = cy;
          brandCentered(ctx, centerX, my + 26, 27);
          my += 26 + 18;
          if (logo && logo.width) {
            var lh = 56, lw = logo.width * (lh / logo.height);
            ctx.drawImage(logo, centerX - lw / 2, my, lw, lh);
            my += lh;
          }
          my += 44;
          evDrawTitle(ctx, data.name || 'UFC', centerX, my + 40, centerW - 16, '800 46px ' + COND, 50);
          ctx.textAlign = 'left';
          cy += Math.max(heroR * 2 + 92, EV_HERO_CENTER_H);
        }

        function drawEvGrid(arr, grid) {
          var lastRow = grid.rows - 1;
          arr.forEach(function (f, i) {
            var row = Math.floor(i / grid.cols);
            var rowStart = row * grid.cols;
            var rowLen = row === lastRow ? (arr.length - rowStart) : grid.cols;
            var idxInRow = i - rowStart;
            var bx = evRowX(grid.cols, grid.colW, grid.gap, rowLen, idxInRow);
            var by = cy + row * grid.rowH;
            var imgs = imgFor.get(f);
            evBoutCard(ctx, f, bx, by, grid.colW, imgs[0], imgs[1], grid.s);
          });
          cy += grid.h;
        }
        if (mainCardGrid) drawEvGrid(restMainCard, mainCardGrid);
        if (prelimsGrid) {
          evSectionBar(ctx, cy, 'PRELIMS', '#fff');
          cy += EV_BAR_H + EV_BAR_GAP;
          drawEvGrid(prelims, prelimsGrid);
        }
        return cv;
      });
    });
  }

  // ── the share overlay (mirrors odds.js's parlay slip / the site's own) ──
  var asset = null;
  function toFile(cv) {
    return new Promise(function (res, rej) {
      if (!cv.toBlob) return rej(new Error("This browser can't export the image."));
      try {
        cv.toBlob(function (b) {
          if (!b) return rej(new Error("Couldn't render the image."));
          res({ file: new File([b], 'gillylab.png', { type: 'image/png' }), blob: b });
        }, 'image/png');
      } catch (e) { rej(e); }
    });
  }
  var canShareFiles = function (f) { return !!(navigator.canShare && f && navigator.canShare({ files: [f] })); };
  function download(blob, filename) {
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url; link.download = filename;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }
  function close() {
    var ov = document.getElementById('glSheet');
    if (ov) ov.classList.remove('open');
    asset = null;
  }
  function busy(on) {
    ['glSheetSave', 'glSheetShare'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.disabled = !!on; el.classList.toggle('busy', !!on);
    });
  }
  // shareText === null drops the Share button — every one of this app's
  // sheets is paywalled premium content, so (matching the site's own rule
  // for its paywalled sheets) none of them carry a shareable link; Save
  // photo is the only action. See gl-sheet.js's own comment on this switch.
  function open(drawFn, filename, shareText) {
    var canShare = !!shareText;
    var ov = document.getElementById('glSheet');
    if (!ov) {
      ov = document.createElement('div'); ov.id = 'glSheet'; ov.className = 'pl-share gl-sheet';
      ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Share sheet');
      document.body.appendChild(ov);
    }
    var hint = canShare
      ? (IOS ? 'Save photo → tap Save Image to add it to Photos. Share sends the sheet with a link.'
             : 'Save photo downloads the image. Share sends the sheet with a link.')
      : (IOS ? 'Save photo → tap Save Image to add it to Photos.'
             : 'Save photo downloads the image.');
    ov.innerHTML =
      '<div class="pl-share-inner gl-sheet-inner">' +
        '<div class="gl-sheet-preview"><img id="glSheetImg" alt="Shareable sheet"></div>' +
        '<div class="pl-share-actions">' +
          '<button type="button" id="glSheetSave" class="pl-act primary">Save photo</button>' +
          (canShare ? '<button type="button" id="glSheetShare" class="pl-act">Share</button>' : '') +
          '<button type="button" id="glSheetClose" class="pl-act ghost">Close</button>' +
        '</div>' +
        '<div class="pl-share-hint">' + hint + '</div>' +
      '</div>';
    ov.classList.add('open');

    ov.querySelector('#glSheetClose').addEventListener('click', close);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });

    busy(true);
    return drawFn().then(function (cv) {
      return toFile(cv).then(function (a) {
        asset = a;
        var img = ov.querySelector('#glSheetImg');
        img.src = cv.toDataURL('image/png');
        busy(false);

        ov.querySelector('#glSheetSave').addEventListener('click', function () {
          if (!asset) return;
          if (IOS && canShareFiles(asset.file)) { navigator.share({ files: [asset.file] }).catch(function () {}); return; }
          download(asset.blob, filename);
        });
        var shareBtn = canShare && ov.querySelector('#glSheetShare');
        if (shareBtn) shareBtn.addEventListener('click', function () {
          if (!asset) return;
          var url = SITE;
          if (canShareFiles(asset.file)) {
            var withUrl = { files: [asset.file], text: shareText, url: url, title: 'GillyLab' };
            var payload = (navigator.canShare && navigator.canShare(withUrl)) ? withUrl : { files: [asset.file], text: shareText, title: 'GillyLab' };
            navigator.share(payload).catch(function () {});
          } else if (navigator.share) {
            navigator.share({ text: shareText, url: url, title: 'GillyLab' }).catch(function () {});
          }
        });
      });
    }).catch(function (err) {
      var hintEl = ov.querySelector('.pl-share-hint');
      if (hintEl) hintEl.textContent = (err && err.message) || "Couldn't build the image.";
      busy(false);
    });
  }

  window.GL_SHEET = {
    // Full fight card poster — "Share this card" on the Events tab.
    eventCard: function (data) {
      return open(function () { return drawEventCard(data || {}); },
        'gillylab-' + (((data && data.name) || 'fight-card').toString().replace(/\s+/g, '-').toLowerCase()) + '.png',
        null);
    },
    // Tale-of-the-tape sheet — Fight Info dropdown's "Generate matchup sheet".
    matchup: function (f, breakdown, info) {
      return open(function () { return drawMatchup(f, breakdown, info || {}); },
        'gillylab-' + f.f1.replace(/\s+/g, '-').toLowerCase() + '-vs-' + f.f2.replace(/\s+/g, '-').toLowerCase() + '.png',
        null);
    },
    // Fight Simulator's "Share this simulation".
    sim: function (a, b, slugA, slugB, result, rounds) {
      return open(function () { return drawSim(a, b, slugA, slugB, result, rounds); },
        'gillylab-sim-' + a.replace(/\s+/g, '-').toLowerCase() + '-vs-' + b.replace(/\s+/g, '-').toLowerCase() + '.png',
        null);
    },
    // Deep Dive modal's per-tab "Generate striking/grappling sheet".
    striking: function (a, b, slugA, slugB, sheet, info) {
      return open(function () { return drawStriking(a, b, slugA, slugB, sheet, info || {}); },
        'gillylab-striking-' + a.replace(/\s+/g, '-').toLowerCase() + '-vs-' + b.replace(/\s+/g, '-').toLowerCase() + '.png',
        null);
    },
    grappling: function (a, b, slugA, slugB, sheet, info) {
      return open(function () { return drawGrappling(a, b, slugA, slugB, sheet, info || {}); },
        'gillylab-grappling-' + a.replace(/\s+/g, '-').toLowerCase() + '-vs-' + b.replace(/\s+/g, '-').toLowerCase() + '.png',
        null);
    },
    // Pick'em picks/results — Pick'em screen and My History.
    pickem: function (data) {
      return open(function () { return drawPickem(data || {}); }, 'gillylab-picks.png', null);
    },
    close: close
  };
})();
