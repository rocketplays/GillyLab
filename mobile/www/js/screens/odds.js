// Odds & Projections -- Premium-only native port of the site's own Odds &
// Projections page (index.html's handleOddsPage + renderProjectionsPage +
// the Parlay Builder). Driven entirely by GET /api/app/odds (see
// worker/index.js), which does the event-pick/bout-match/MANUAL_PROP_ODDS
// merge server-side and ships plain per-fight market data instead of HTML
// strings -- this file is the "render natively" half of that trade (see
// scripts/gen-odds-page.cjs's header for the full reasoning).
//
// The Parlay Builder (add/remove legs, one-book-per-slip, ML+O/U-only
// same-fight pairing, cross-book re-pricing, stake/payout, share-as-image)
// has NO server component on the site either -- it's pure client state over
// whatever's on screen -- so it's ported here as close to verbatim as this
// screen's own container-scoped rendering (vs. the site's page-global ids)
// allows. "Log this bet" is deliberately omitted: there's no real Bet
// Tracker yet for it to preload into (mobile/www/js/screens/bettracker.js
// is still a stub).
window.GL_ROUTER.register('odds', {
  title: 'Odds & Projections',
  tab: 'odds',
  render: function(container){
    window.GL_ODDS.load(container);
  }
});

window.GL_ODDS = (function(){
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]; }); }
  var SUFFIXES = { jr: 1, 'jr.': 1, sr: 1, 'sr.': 1, ii: 1, iii: 1, iv: 1, v: 1 };
  function surname(n){
    var parts = String(n || '').trim().split(/\s+/);
    var i = parts.length - 1;
    while (i > 0 && SUFFIXES[parts[i].toLowerCase()]) i--;
    return parts[i] || n || '';
  }
  var PL_IOS = /iP(hone|od|ad)/.test(navigator.userAgent || '') || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  // Fixed display order for the parlay's cross-book re-pricing row -- same
  // list worker/odds-page.js's BOOK_ORDER carries (pure display ordering,
  // not correctness-critical: the odds themselves always come straight off
  // each .pl-pick cell's own data-odds).
  var BOOK_ORDER = ['fanduel', 'draftkings', 'betmgm', 'betonlineag', 'bovada'];

  function fmtOdds(n){
    if (n === null || n === undefined) return '<span class="odds-value odds-value-na">N/A</span>';
    var cls = n < 0 ? 'fav' : 'dog';
    var str = n > 0 ? '+' + n : '' + n;
    return '<span class="odds-value ' + cls + '">' + str + '</span>';
  }

  // ── One priced cell, clickable to add/remove a parlay leg. `meta` mirrors
  // the site's plCell() data-attrs exactly (fid/book/booklabel/fight/mkt/
  // side/method/round/ou/line/label) so plLegFromDs below can read them back
  // the same way regardless of which market built the cell.
  function plCell(meta, odds){
    if (odds === null || odds === undefined) return '<td>' + fmtOdds(odds) + '</td>';
    var attrs = Object.keys(meta).filter(function(k){ return meta[k] !== undefined && meta[k] !== null; })
      .map(function(k){ return 'data-' + k + '="' + esc(String(meta[k])) + '"'; }).join(' ');
    return '<td class="pl-pick" role="button" tabindex="0" ' + attrs + ' data-odds="' + odds + '">' + fmtOdds(odds) + '</td>';
  }

  // ── Market table builders -- each fed the already-merged (live+manual)
  // per-fight data /api/app/odds shapes, no further data-source logic here.
  function moneylineHTML(fight){
    var rows = fight.moneyline || [];
    if (!rows.length) return '<p class="gl-muted odds-empty">No moneyline data available yet.</p>';
    var last1 = surname(fight.f1), last2 = surname(fight.f2);
    var fightLabel = last1 + ' vs ' + last2;
    var trs = rows.map(function(r){
      var base = { fid: fight.fid, book: r.book, booklabel: r.label, fight: fightLabel, mkt: 'ml' };
      return '<tr class="row-' + r.cls + '"><td><span class="book-name book-' + r.cls + '">' + esc(r.label) + '</span></td>' +
        plCell(Object.assign({}, base, { side: 'f1', label: last1 + ' to win' }), r.o1) +
        plCell(Object.assign({}, base, { side: 'f2', label: last2 + ' to win' }), r.o2) +
        '</tr>';
    }).join('');
    return '<table class="odds-table"><thead><tr><th>Sportsbook</th><th>' + esc(last1) + '</th><th>' + esc(last2) + '</th></tr></thead><tbody>' + trs + '</tbody></table>';
  }

  function totalsHTML(fight){
    var lines = fight.totals || [];
    if (!lines.length) return '<p class="gl-muted odds-empty">No rounds O/U data available yet.</p>';
    var fightLabel = surname(fight.f1) + ' vs ' + surname(fight.f2);
    var body = lines.map(function(grp){
      var rows = (grp.books || []).map(function(b){
        var base = { fid: fight.fid, book: b.book, booklabel: b.label, fight: fightLabel, mkt: 'total', line: grp.line };
        return '<tr class="row-' + b.cls + '"><td><span class="book-name book-' + b.cls + '">' + esc(b.label) + '</span></td>' +
          plCell(Object.assign({}, base, { ou: 'over', label: 'Over ' + grp.line + ' rds' }), b.over) +
          plCell(Object.assign({}, base, { ou: 'under', label: 'Under ' + grp.line + ' rds' }), b.under) +
          '</tr>';
      }).join('');
      return '<tr class="prop-subheader"><td colspan="3"><strong>O/U ' + grp.line + '</strong></td></tr>' + rows;
    }).join('');
    return '<table class="odds-table"><thead><tr><th>Rounds O/U</th><th>Over</th><th>Under</th></tr></thead><tbody>' + body + '</tbody></table>';
  }

  // Shared skeleton for Method / Double Chance -- both are two named blocks
  // (one per fighter) of book rows, just different column sets.
  function twoSidedTableHTML(fight, block, cols, emptyMsg){
    if (!block || (!(block.f1 || []).length && !(block.f2 || []).length)) return '<p class="gl-muted odds-empty">' + emptyMsg + '</p>';
    var fightLabel = surname(fight.f1) + ' vs ' + surname(fight.f2);
    function side(name, sideKey, rows){
      if (!rows || !rows.length) return '';
      var trs = rows.map(function(r){
        var base = { fid: fight.fid, book: r.book, booklabel: r.label, fight: fightLabel, mkt: cols.mkt, side: sideKey };
        var cells = cols.keys.map(function(k){
          return plCell(Object.assign({}, base, { method: k.key, label: name + ' ' + k.label }), r[k.key]);
        }).join('');
        return '<tr class="row-' + r.cls + '"><td><span class="book-name book-' + r.cls + '">' + esc(r.label) + '</span></td>' + cells + '</tr>';
      }).join('');
      return '<tr class="prop-subheader"><td colspan="' + (cols.keys.length + 1) + '"><strong>' + esc(name) + '</strong></td></tr>' + trs;
    }
    var body = side(surname(fight.f1), 'f1', block.f1) + side(surname(fight.f2), 'f2', block.f2);
    if (!body) return '<p class="gl-muted odds-empty">' + emptyMsg + '</p>';
    var heads = cols.keys.map(function(k){ return '<th>' + k.head + '</th>'; }).join('');
    return '<table class="odds-table"><thead><tr><th>Sportsbook</th>' + heads + '</tr></thead><tbody>' + body + '</tbody></table>';
  }
  var METHOD_COLS = { mkt: 'method', keys: [
    { key: 'ko', head: 'KO/TKO', label: 'by KO/TKO' },
    { key: 'sub', head: 'Submission', label: 'by submission' },
    { key: 'dec', head: 'Decision', label: 'by decision' },
  ] };
  var DBL_COLS = { mkt: 'dblchance', keys: [
    { key: 'koSub', head: 'KO/TKO or Sub', label: 'by KO/TKO or submission' },
    { key: 'koDec', head: 'KO/TKO or Dec', label: 'by KO/TKO or decision' },
    { key: 'subDec', head: 'Sub or Dec', label: 'by submission or decision' },
  ] };
  function methodHTML(fight){ return twoSidedTableHTML(fight, fight.method, METHOD_COLS, 'No method-of-victory odds entered yet.'); }
  function doubleChanceHTML(fight){ return twoSidedTableHTML(fight, fight.doubleChance, DBL_COLS, 'No double chance odds entered yet.'); }

  function roundPropsHTML(fight){
    var block = fight.roundProps;
    if (!block || (!(block.f1 || []).length && !(block.f2 || []).length)) return '<p class="gl-muted odds-empty">No round-props odds entered yet.</p>';
    var rounds = block.rounds === 5 ? 5 : 3;
    var fightLabel = surname(fight.f1) + ' vs ' + surname(fight.f2);
    function side(name, sideKey, rows){
      if (!rows || !rows.length) return '';
      var trs = rows.map(function(r){
        var base = { fid: fight.fid, book: r.book, booklabel: r.label, fight: fightLabel, mkt: 'round', side: sideKey };
        var cells = (r.rounds || []).map(function(v, i){
          return plCell(Object.assign({}, base, { round: i + 1, label: name + ' in R' + (i + 1) }), v);
        }).join('');
        return '<tr class="row-' + r.cls + '"><td><span class="book-name book-' + r.cls + '">' + esc(r.label) + '</span></td>' + cells + '</tr>';
      }).join('');
      return '<tr class="prop-subheader"><td colspan="' + (rounds + 1) + '"><strong>' + esc(name) + '</strong></td></tr>' + trs;
    }
    var body = side(surname(fight.f1), 'f1', block.f1) + side(surname(fight.f2), 'f2', block.f2);
    if (!body) return '<p class="gl-muted odds-empty">No round-props odds entered yet.</p>';
    var heads = ''; for (var r = 1; r <= rounds; r++) heads += '<th>Round ' + r + '</th>';
    return '<table class="odds-table"><thead><tr><th>Sportsbook</th>' + heads + '</tr></thead><tbody>' + body + '</tbody></table>';
  }

  // Compact inline sparkline -- accent-green f1, gray f2, dashed "even" line
  // -- same visual language as buildLineMovementSVG, computed from the
  // already-realigned {date,price1,price2} days array.
  function lineMovementSVG(days){
    var W = 520, H = 130, P = 10, n = days.length;
    function xFor(i){ return n > 1 ? P + (W - 2 * P) * i / (n - 1) : W / 2; }
    var vals = [];
    days.forEach(function(d){
      if (typeof d.price1 === 'number') vals.push(d.price1);
      if (typeof d.price2 === 'number') vals.push(d.price2);
    });
    if (!vals.length) return '';
    var lo = Math.min.apply(null, vals.concat([0])), hi = Math.max.apply(null, vals.concat([0]));
    var pad = (hi - lo) * 0.08 || 10;
    lo -= pad; hi += pad;
    function yFor(v){ return H - P - ((v - lo) / (hi - lo)) * (H - 2 * P); }
    var zeroY = yFor(0).toFixed(1);
    function lineFor(key, color, w){
      var pts = [];
      days.forEach(function(d, i){ if (typeof d[key] === 'number') pts.push([xFor(i), yFor(d[key])]); });
      if (pts.length < 2) return '';
      var poly = pts.map(function(p){ return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');
      var last = pts[pts.length - 1];
      var dots = [pts[0], last].map(function(p){ return '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="4" fill="' + color + '"/>'; }).join('');
      return '<polyline points="' + poly + '" fill="none" stroke="' + color + '" stroke-width="' + w + '" stroke-linejoin="round" stroke-linecap="round"/>' + dots;
    }
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="display:block;">' +
      '<line x1="' + P + '" y1="' + zeroY + '" x2="' + (W - P) + '" y2="' + zeroY + '" stroke="rgba(255,255,255,0.12)" stroke-width="1" stroke-dasharray="3 4"/>' +
      '<text x="' + P + '" y="' + (zeroY - 3) + '" fill="rgba(255,255,255,0.3)" font-size="9" style="text-transform:uppercase;letter-spacing:0.05em">even</text>' +
      lineFor('price2', '#8a8a92', 2) + lineFor('price1', '#00e668', 2.6) +
      '</svg>';
  }
  function lineMovementHTML(fight){
    var lm = fight.lineMovement;
    var last1 = surname(fight.f1), last2 = surname(fight.f2);
    if (!lm || !Array.isArray(lm.days) || lm.days.length < 2){
      return '<p class="gl-muted odds-empty">Line movement will populate here as odds are tracked across multiple days — check back as fight week approaches.</p>';
    }
    var days = lm.days;
    var firstA = days.filter(function(d){ return typeof d.price1 === 'number'; })[0];
    var firstB = days.filter(function(d){ return typeof d.price2 === 'number'; })[0];
    var revA = days.slice().reverse().filter(function(d){ return typeof d.price1 === 'number'; })[0];
    var revB = days.slice().reverse().filter(function(d){ return typeof d.price2 === 'number'; })[0];
    var openDate = days[0] ? days[0].date : '';
    function od(v){ return (typeof v !== 'number') ? 'N/A' : (v > 0 ? '+' + v : '' + v); }
    function prob(v){ return (typeof v !== 'number') ? null : (v < 0 ? (-v) / (-v + 100) : 100 / (v + 100)); }
    function legend(dot, name, open, close, key){
      return '<span style="white-space:nowrap;"><span style="color:' + dot + ';">●</span> ' + esc(name) +
        ' <span style="font-weight:700;letter-spacing:0.03em;">' + od(open ? open[key] : null) + ' → ' + od(close ? close[key] : null) + '</span></span>';
    }
    var blurb;
    var po = prob(firstA ? firstA.price1 : null), pc = prob(revA ? revA.price1 : null);
    if (po === null || pc === null) blurb = 'Tracked across ' + days.length + ' days of consensus moneyline movement.';
    else {
      var delta = pc - po, move;
      if (Math.abs(delta) < 0.02) move = 'the line has held steady';
      else if (delta > 0) move = 'money has moved toward ' + last1 + ", shortening " + last1 + "'s price";
      else move = 'money has moved toward ' + last2 + ", shortening " + last2 + "'s price";
      blurb = 'Tracked across ' + days.length + ' days: ' + move + '.';
    }
    return '' +
      lineMovementSVG(days) +
      '<div style="display:flex;justify-content:space-between;font-size:9px;color:rgba(255,255,255,0.32);text-transform:uppercase;letter-spacing:0.06em;margin-top:1px;"><span>' + esc(openDate) + ' · open</span><span>now</span></div>' +
      '<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;font-size:0.78rem;margin-top:0.55rem;">' + legend('#00e668', last1, firstA, revA, 'price1') + legend('#8a8a92', last2, firstB, revB, 'price2') + '</div>' +
      '<div style="font-size:0.75rem;color:var(--muted);margin-top:0.6rem;line-height:1.45;">' + blurb + ' Consensus moneyline average across sportsbooks.</div>';
  }

  var TABS = [
    { key: 'ml', label: 'Moneyline', fn: moneylineHTML },
    { key: 'tot', label: 'Rounds O/U', fn: totalsHTML },
    { key: 'method', label: 'Method', fn: methodHTML },
    { key: 'dbl', label: 'Double Chance', fn: doubleChanceHTML },
    { key: 'round', label: 'Round Props', fn: roundPropsHTML },
    { key: 'lm', label: 'Line Movement', fn: lineMovementHTML },
  ];

  function fighterAvatar(name, slug){
    return window.GL_FIGHTER.avatarHtml({ name: name, photo: slug || null });
  }

  function fightPanelHTML(fight, i){
    var last1 = surname(fight.f1), last2 = surname(fight.f2);
    var header = '<div class="odds-board-header">' +
      '<div class="obh-fighter' + (fight.s1 ? ' obh-link' : '') + '" data-fighter-slug="' + esc(fight.s1 || '') + '">' + fighterAvatar(fight.f1, fight.s1) + '<div class="obh-name">' + esc(fight.f1) + '</div></div>' +
      '<div class="obh-vs">vs</div>' +
      '<div class="obh-fighter obh-right' + (fight.s2 ? ' obh-link' : '') + '" data-fighter-slug="' + esc(fight.s2 || '') + '"><div class="obh-name">' + esc(fight.f2) + '</div>' + fighterAvatar(fight.f2, fight.s2) + '</div>' +
      '</div>';
    var tabBtns = TABS.map(function(t, ti){
      return '<button type="button" class="odds-prop-btn' + (ti === 0 ? ' active' : '') + '" data-prop-tab="' + t.key + '">' + t.label + '</button>';
    }).join('');
    var panels = TABS.map(function(t, ti){
      return '<div class="odds-prop-panel" data-prop-panel="' + t.key + '"' + (ti === 0 ? '' : ' style="display:none;"') + '>' + t.fn(fight) + '</div>';
    }).join('');
    return '<div id="odds-fight-' + i + '" class="fight-odds-panel"' + (i > 0 ? ' style="display:none;"' : '') + '>' +
      '<div class="odds-divider"></div>' + header +
      '<div class="odds-prop-tabs">' + tabBtns + '</div>' + panels +
      '</div>';
  }

  function oddsBoardHTML(fights){
    if (!fights.length) return '';
    var btns = fights.map(function(f, i){
      return '<button type="button" class="rank-div-btn' + (i === 0 ? ' active' : '') + '" data-fight-select="' + i + '">' + esc(surname(f.f1)) + ' vs. ' + esc(surname(f.f2)) + '</button>';
    }).join('');
    var panels = fights.map(fightPanelHTML).join('');
    return '<div class="odds-grid">' +
      plHelpHTML() +
      '<div class="odds-fight-selector" id="oddsFightBtns">' + btns + '</div>' +
      panels +
      '</div>';
  }

  function plHelpHTML(){
    return '<div class="pl-help">' +
      '<div class="pl-help-head"><span class="pl-help-badge">Parlay builder</span><span class="pl-help-lead">Tap any price — moneyline, rounds O/U, method, or round props — to add it to your slip. The slip sits at the bottom: set a stake to see the payout, and compare the same picks across every book that prices them. Greyed-out cells can\'t be added.</span></div>' +
      '<ul class="pl-help-rules">' +
        '<li><strong>One sportsbook per parlay.</strong> Legs can\'t cross books — though the slip will show you what the same picks pay elsewhere, and can switch in one tap.</li>' +
        '<li><strong>On one fight, only a moneyline and a rounds O/U can be parlayed.</strong> Method and round props either imply the moneyline or overlap each other, so they have to stand alone.</li>' +
      '</ul>' +
      '<div class="pl-help-note">Odds move frequently — the numbers here may have shifted slightly since they were last pulled. Always confirm the current price at the sportsbook before betting.</div>' +
      '</div>';
  }

  // ── Projections grid -- same no-vig data every matched fight already
  // carries (fight.noVig), just laid out as a bar per fight instead of a
  // table. Skips a fight with no live h2h market anywhere, same as the site.
  function projectionsHTML(fights){
    var cards = fights.map(function(f, idx){
      if (!f.noVig) return null;
      var aFav = f.noVig.pct1 >= f.noVig.pct2;
      return '<div class="projection-card">' +
        '<div class="proj-top">' +
          '<div class="proj-fighter' + (aFav ? ' fav' : '') + '" data-fighter-slug="' + esc(f.s1 || '') + '">' + fighterAvatar(f.f1, f.s1) + '<div class="proj-name">' + esc(f.f1) + '</div></div>' +
          '<div class="proj-fighter right' + (aFav ? '' : ' fav') + '" data-fighter-slug="' + esc(f.s2 || '') + '"><div class="proj-name">' + esc(f.f2) + '</div>' + fighterAvatar(f.f2, f.s2) + '</div>' +
        '</div>' +
        '<div class="proj-bar2">' +
          '<div class="proj-seg proj-seg-left ' + (aFav ? 'win' : 'lose') + '" style="width:' + f.noVig.pct1 + '%;"><span class="proj-seg-pct">' + f.noVig.pct1 + '%</span></div>' +
          '<div class="proj-seg proj-seg-right ' + (aFav ? 'lose' : 'win') + '"><span class="proj-seg-pct">' + f.noVig.pct2 + '%</span></div>' +
        '</div>' +
        (idx === 0 ? '<div class="proj-main-tag">Main event</div>' : '') +
        '</div>';
    }).filter(Boolean);
    if (!cards.length) return '<p class="gl-muted odds-empty">Projections will populate once sportsbooks post moneyline odds for this card.</p>';
    return '<div class="proj-grid">' + cards.join('') + '</div>';
  }

  // ── Parlay Builder -- pure client state, no server component (same as the
  // site). Kept container-scoped rather than the site's page-global ids
  // since this screen's DOM is torn down/rebuilt on every route change.
  var PARLAY = { book: null, legs: [], stake: 100, open: false };
  var plShareAsset = null;
  var plSw = { x: null, y: null, base: 0, cur: 0, lock: null };

  function plAmToDec(a){ a = Number(a); return a > 0 ? 1 + a / 100 : 1 + 100 / (-a); }
  function plDecToAm(d){ return d >= 2 ? Math.round((d - 1) * 100) : -Math.round(100 / (d - 1)); }
  function plMoney(n){ return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function plDec(){ return PARLAY.legs.reduce(function(p, l){ return p * plAmToDec(l.odds); }, 1); }
  function plSelKey(l){ return [l.fid, l.mkt, l.side || '', l.method || '', l.round || '', l.ou || '', l.line || ''].join('~'); }
  function plLegKey(l){ return [l.fid, l.book, l.mkt, l.side || '', l.method || '', l.round || '', l.ou || '', l.line || ''].join('~'); }
  function plLegFromDs(ds){
    return { fid: ds.fid, book: ds.book, booklabel: ds.booklabel, fight: ds.fight,
      mkt: ds.mkt, side: ds.side, method: ds.method, round: ds.round ? Number(ds.round) : undefined,
      ou: ds.ou, line: ds.line ? Number(ds.line) : undefined, odds: Number(ds.odds), label: ds.label };
  }
  var PL_PAIRABLE = { ml: 1, total: 1 };
  function plValidate(legs, newLeg){
    var same = legs.filter(function(l){ return l.fid === newLeg.fid; });
    if (!same.length) return { ok: true };
    if (!PL_PAIRABLE[newLeg.mkt] || same.some(function(l){ return !PL_PAIRABLE[l.mkt]; })){
      return { ok: false, reason: 'On one fight, only a moneyline and a rounds O/U can be combined — method, double chance, and round props have to stand alone.' };
    }
    if (same.some(function(l){ return l.mkt === newLeg.mkt; })){
      return { ok: false, reason: newLeg.mkt === 'ml' ? 'You already have a moneyline on this fight.' : 'You already have a rounds O/U on this fight.' };
    }
    return { ok: true };
  }

  // ── Screen state -- set once per load(), read by the handlers below.
  var activeContainer = null, eventLabel = '', plAnim = null, plBound = false;

  function plBookGrid(){
    var grid = {};
    activeContainer.querySelectorAll('.pl-pick').forEach(function(td){
      var ds = td.dataset;
      grid[ds.book] = grid[ds.book] || {};
      grid[ds.book][plSelKey(ds)] = { odds: Number(ds.odds), label: ds.booklabel };
    });
    return grid;
  }
  function plBookPrices(){
    if (!PARLAY.legs.length) return [];
    var grid = plBookGrid(), out = [];
    var books = Object.keys(grid).sort(function(a, b){
      var ia = BOOK_ORDER.indexOf(a), ib = BOOK_ORDER.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
    books.forEach(function(bk){
      var g = grid[bk];
      var dec = 1, label = bk;
      for (var i = 0; i < PARLAY.legs.length; i++){
        var entry = g[plSelKey(PARLAY.legs[i])];
        if (!entry) return;
        dec *= plAmToDec(entry.odds); label = entry.label;
      }
      out.push({ book: bk, label: label, dec: dec, am: plDecToAm(dec) });
    });
    return out;
  }
  function plSwitchBook(bookKey){
    if (bookKey === PARLAY.book) return;
    var g = plBookGrid()[bookKey];
    if (!g) return;
    var next = [], label = bookKey;
    for (var i = 0; i < PARLAY.legs.length; i++){
      var l = PARLAY.legs[i], entry = g[plSelKey(l)];
      if (!entry){ plToast("That book doesn't price every leg in this slip."); return; }
      label = entry.label;
      next.push(Object.assign({}, l, { book: bookKey, booklabel: entry.label, odds: entry.odds }));
    }
    plAnim = 'reprice';
    PARLAY.legs = next; PARLAY.book = bookKey; plRender();
  }
  function plToast(msg){
    var t = activeContainer.querySelector('#plToast');
    if (!t){
      t = document.createElement('div'); t.id = 'plToast'; t.className = 'pl-toast';
      t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite');
      activeContainer.appendChild(t);
    }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(plToast._t); plToast._t = setTimeout(function(){ t.classList.remove('show'); }, 2800);
  }
  function plToggle(td){
    var leg = plLegFromDs(td.dataset);
    var key = plLegKey(leg);
    var idx = -1;
    for (var i = 0; i < PARLAY.legs.length; i++) if (plLegKey(PARLAY.legs[i]) === key){ idx = i; break; }
    if (idx >= 0){ PARLAY.legs.splice(idx, 1); if (!PARLAY.legs.length) PARLAY.book = null; plRender(); return; }
    if (PARLAY.legs.length && PARLAY.book && leg.book !== PARLAY.book){
      plToast('One sportsbook per parlay — your slip is ' + PARLAY.legs[0].booklabel + ', that leg is ' + leg.booklabel + '.');
      return;
    }
    var v = plValidate(PARLAY.legs, leg);
    if (!v.ok){ plToast(v.reason); return; }
    plAnim = PARLAY.legs.length ? 'leg' : 'body';
    window.GL_NATIVE.tap();
    PARLAY.book = leg.book; PARLAY.legs.push(leg); plRender();
  }
  function plClearAll(){ PARLAY.legs = []; PARLAY.book = null; plShareClose(); plRender(); }

  function plCardHTML(opts){
    opts = opts || {};
    var share = !!opts.share;
    var dec = plDec(), am = plDecToAm(dec), n = PARLAY.legs.length;
    var stake = Math.max(0, Number(PARLAY.stake) || 0);
    var prob = (100 / dec).toFixed(1);
    var shotDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    var legs = PARLAY.legs.map(function(l, i){
      return '<div class="pl-card-leg"><div style="min-width:0;"><div class="pl-leg-fight">' + esc(l.fight || '') + '</div><div class="pl-leg-pick">' + esc(l.label) + '</div></div>' +
        '<div class="pl-leg-right"><span class="pl-card-odds">' + (l.odds > 0 ? '+' : '') + l.odds + '</span>' +
        (share ? '' : '<span class="pl-leg-x" role="button" tabindex="0" data-idx="' + i + '" title="Remove leg" aria-label="Remove leg">×</span>') +
        '</div></div>';
    }).join('');
    var byFight = {}; PARLAY.legs.forEach(function(l){ byFight[l.fid] = (byFight[l.fid] || 0) + 1; });
    var sgpFights = Object.keys(byFight).filter(function(k){ return byFight[k] > 1; })
      .map(function(k){ var m = PARLAY.legs.filter(function(l){ return l.fid === k; })[0]; return m && m.fight; }).filter(Boolean);
    var sgp = sgpFights.length ? '<div class="pl-warn">⚠ Same-game parlay on ' + esc(sgpFights.join(', ')) + ' — a moneyline and a rounds O/U on one fight are correlated, so the book will likely price these two at lower odds.</div>' : '';
    return '<div class="pl-card">' +
      '<div class="pl-card-head"><div class="pl-brand">Gilly<span>Lab</span></div>' +
      '<div class="pl-card-meta">' + esc(eventLabel) + ' · ' + esc(PARLAY.legs[0].booklabel) + '</div>' +
      (share ? '' : '<button type="button" id="plShareOpen" class="pl-shot" title="Share or screenshot this slip">Share</button>') +
      '</div><div class="pl-card-legs">' + legs + '</div>' + sgp +
      '<div class="pl-card-total"><div><div class="pl-cap">' + n + '-leg parlay</div><div class="pl-total">' + (am > 0 ? '+' : '') + am + '</div></div>' +
      '<div style="text-align:right;"><div class="pl-cap">Stake ' + (share ? plMoney(stake) : '<span id="plCardStake">' + plMoney(stake) + '</span>') + '</div>' +
      '<div class="pl-pay">Returns ' + (share ? '<strong>' + plMoney(stake * dec) + '</strong>' : '<strong id="plCardReturn">' + plMoney(stake * dec) + '</strong>') + '</div></div></div>' +
      '<div class="pl-card-foot">gillylab.com · implied ' + prob + '% · ' + esc(shotDate) + ' · odds subject to change</div></div>';
  }

  function plShareText(){
    var dec = plDec(), am = plDecToAm(dec);
    var stake = Math.max(0, Number(PARLAY.stake) || 0);
    var lines = PARLAY.legs.map(function(l){ return '• ' + l.fight + ' — ' + l.label + '  ' + (l.odds > 0 ? '+' : '') + l.odds; });
    return [
      eventLabel + ' · ' + PARLAY.legs[0].booklabel,
      PARLAY.legs.length + '-leg parlay  ' + (am > 0 ? '+' : '') + am,
      '', lines.join('\n'), '',
      plMoney(stake) + ' returns ' + plMoney(stake * dec) + ' (implied ' + (100 / dec).toFixed(1) + '%)',
      'via gillylab.com',
    ].join('\n');
  }
  function plFallbackCopy(txt, done){
    var ta = document.createElement('textarea');
    ta.value = txt; ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:absolute;left:-9999px;top:0;';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { plToast("Couldn't copy — select the text manually."); }
    document.body.removeChild(ta);
  }
  function plCopyText(){
    var txt = plShareText();
    var done = function(){ plToast('Slip copied to clipboard.'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done).catch(function(){ plFallbackCopy(txt, done); });
    else plFallbackCopy(txt, done);
  }

  // ── Slip → PNG, drawn on canvas (not html-to-canvas -- unreliable in
  // Safari, which is exactly the browser "save to camera roll" needs).
  function plRoundRect(ctx, x, y, w, h, r){
    ctx.beginPath();
    if (ctx.roundRect){ ctx.roundRect(x, y, w, h, r); return; }
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function plWrap(ctx, text, maxW){
    var words = String(text).split(' '), lines = [], cur = '';
    words.forEach(function(w){ var t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur){ lines.push(cur); cur = w; } else cur = t; });
    if (cur) lines.push(cur);
    return lines;
  }
  function plClip(ctx, text, maxW){
    text = String(text);
    if (maxW <= 0) return '';
    if (ctx.measureText(text).width <= maxW) return text;
    var lo = 0, hi = text.length;
    while (lo < hi){ var mid = (lo + hi) >> 1; if (ctx.measureText(text.slice(0, mid) + '…').width <= maxW) lo = mid + 1; else hi = mid; }
    return text.slice(0, Math.max(1, lo - 1)) + '…';
  }
  function plDrawSlip(){
    var S = Math.min(3, Math.max(2, Math.round(window.devicePixelRatio || 1) + 1));
    var W = 560, PAD = 22;
    var BG = '#14161b', BORDER = 'rgba(255,255,255,0.10)', DIV = 'rgba(255,255,255,0.08)';
    var TXT = '#e8e8ea', MUT = '#8a8d94', ACC = '#00e668', AMB = '#ffcf7a', FTC = '#6f727a';
    var SANS = "'Barlow', sans-serif", COND = "'Barlow Condensed', sans-serif";
    var legs = PARLAY.legs, n = legs.length;
    var dec = plDec(), am = plDecToAm(dec), stake = Math.max(0, Number(PARLAY.stake) || 0);
    var prob = (100 / dec).toFixed(1);
    var date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    var byFight = {}; legs.forEach(function(l){ byFight[l.fid] = (byFight[l.fid] || 0) + 1; });
    var sgpF = Object.keys(byFight).filter(function(k){ return byFight[k] > 1; }).map(function(k){ var m = legs.filter(function(l){ return l.fid === k; })[0]; return m && m.fight; }).filter(Boolean);
    var warn = sgpF.length ? '⚠ Same-game parlay on ' + sgpF.join(', ') + ' — a moneyline and a rounds O/U on one fight are correlated, so the book will likely price these two at lower odds.' : '';

    var cv = document.createElement('canvas'), ctx = cv.getContext('2d');
    ctx.font = '400 12px ' + SANS;
    var warnLines = warn ? plWrap(ctx, warn, W - 2 * PAD - 4) : [];
    var HEAD = 32, LEGH = 48, TOTH = 62, FOOTH = 26, WARNLH = 16;
    var warnH = warnLines.length ? warnLines.length * WARNLH + 12 : 0;
    var H = PAD + HEAD + n * LEGH + warnH + TOTH + FOOTH + 8;

    cv.width = Math.round(W * S); cv.height = Math.round(H * S);
    ctx.scale(S, S);
    plRoundRect(ctx, 0.5, 0.5, W - 1, H - 1, 12);
    ctx.fillStyle = BG; ctx.fill(); ctx.strokeStyle = BORDER; ctx.lineWidth = 1; ctx.stroke();
    function rule(yy, col){ ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(PAD, yy + 0.5); ctx.lineTo(W - PAD, yy + 0.5); ctx.stroke(); }

    var y = PAD;
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    ctx.font = '800 16px ' + COND; ctx.fillStyle = TXT; ctx.fillText('GILLY', PAD, y + 13);
    var bw = ctx.measureText('GILLY').width;
    ctx.fillStyle = ACC; ctx.fillText('LAB', PAD + bw, y + 13);
    var brandW = bw + ctx.measureText('LAB').width;
    ctx.font = '600 10px ' + SANS; ctx.fillStyle = MUT; ctx.textAlign = 'right';
    ctx.fillText(plClip(ctx, (eventLabel + ' · ' + legs[0].booklabel).toUpperCase(), W - 2 * PAD - brandW - 14), W - PAD, y + 12);
    ctx.textAlign = 'left';
    y += HEAD - 10; rule(y, DIV); y += 4;

    legs.forEach(function(l, i){
      var oddsTxt = (l.odds > 0 ? '+' : '') + l.odds;
      ctx.font = '800 18px ' + COND;
      var leftMax = W - 2 * PAD - ctx.measureText(oddsTxt).width - 16;
      ctx.font = '600 10px ' + SANS; ctx.fillStyle = MUT;
      ctx.fillText(plClip(ctx, String(l.fight || '').toUpperCase(), leftMax), PAD, y + 15);
      ctx.font = '600 14px ' + SANS; ctx.fillStyle = TXT;
      ctx.fillText(plClip(ctx, l.label, leftMax), PAD, y + 33);
      ctx.font = '800 18px ' + COND; ctx.fillStyle = TXT; ctx.textAlign = 'right';
      ctx.fillText(oddsTxt, W - PAD, y + 31);
      ctx.textAlign = 'left';
      y += LEGH;
      if (i < n - 1) rule(y - 9, DIV);
    });

    if (warnLines.length){
      ctx.font = '400 12px ' + SANS; ctx.fillStyle = AMB;
      warnLines.forEach(function(line){ y += WARNLH; ctx.fillText(line, PAD, y); });
      y += 12;
    }
    rule(y, BORDER); y += 6;

    ctx.font = '700 10px ' + SANS; ctx.fillStyle = MUT;
    ctx.fillText(n + '-LEG PARLAY', PAD, y + 13);
    ctx.font = '800 26px ' + COND; ctx.fillStyle = ACC;
    ctx.fillText((am > 0 ? '+' : '') + am, PAD, y + 40);
    ctx.textAlign = 'right';
    ctx.font = '700 10px ' + SANS; ctx.fillStyle = MUT;
    ctx.fillText('STAKE ' + plMoney(stake), W - PAD, y + 13);
    ctx.font = '800 19px ' + COND; ctx.fillStyle = ACC;
    var rv = plMoney(stake * dec), rvw = ctx.measureText(rv).width;
    ctx.fillText(rv, W - PAD, y + 40);
    ctx.font = '400 12px ' + SANS; ctx.fillStyle = MUT;
    ctx.fillText('Returns', W - PAD - rvw - 7, y + 40);
    ctx.textAlign = 'left';
    y += TOTH - 8;

    ctx.font = '400 10px ' + SANS; ctx.fillStyle = FTC;
    ctx.fillText(plClip(ctx, 'gillylab.com · implied ' + prob + '% · ' + date + ' · odds subject to change', W - 2 * PAD), PAD, y + 10);
    return cv;
  }
  function plFontsReady(){ return (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve(); }
  function plSlipFile(cb){
    var cv = plDrawSlip();
    if (!cv.toBlob){ plToast("This device can't export the image."); return; }
    cv.toBlob(function(b){
      if (!b){ plToast("Couldn't render the image."); return; }
      cb(new File([b], 'gillylab-parlay.png', { type: 'image/png' }), b);
    }, 'image/png');
  }
  function plSetShareBusy(busy){
    var b = activeContainer.querySelector('#plSaveImg');
    if (!b) return;
    b.disabled = !!busy; b.classList.toggle('busy', !!busy);
    if (busy) b.setAttribute('aria-busy', 'true'); else b.removeAttribute('aria-busy');
  }
  function plPrepShareAsset(){
    plShareAsset = null;
    plSetShareBusy(true);
    plFontsReady().then(function(){
      plSlipFile(function(file, blob){ plShareAsset = { file: file, blob: blob }; plSetShareBusy(false); });
    });
  }
  function plCanShareFiles(file){ return !!(navigator.canShare && file && navigator.canShare({ files: [file] })); }
  function plDownload(blob){
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'gillylab-parlay.png';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 2000);
    plToast('Slip image saved.');
  }
  function plSaveImage(){
    if (!PARLAY.legs.length) return;
    var asset = plShareAsset;
    if (!asset) return;
    if (PL_IOS && plCanShareFiles(asset.file)){ navigator.share({ files: [asset.file] }).catch(function(){}); return; }
    plDownload(asset.blob);
  }
  function plShareOpen(){
    if (!PARLAY.legs.length) return;
    var ov = activeContainer.querySelector('#plShare');
    if (!ov){
      ov = document.createElement('div'); ov.id = 'plShare'; ov.className = 'pl-share';
      ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Share parlay slip');
      activeContainer.appendChild(ov);
    }
    ov.innerHTML = '<div class="pl-share-inner">' + plCardHTML({ share: true }) +
      '<div class="pl-share-actions">' +
        '<button type="button" id="plSaveImg" class="pl-act primary">Save photo</button>' +
        '<button type="button" id="plCopyTxt" class="pl-act">Copy text</button>' +
        '<button type="button" id="plShareClose" class="pl-act ghost">Close</button>' +
      '</div>' +
      '<div class="pl-share-hint">' + (PL_IOS ? 'Save photo → tap Save Image to add it to Photos.' : 'Save photo downloads the image.') + '</div>' +
      '</div>';
    ov.classList.add('open');
    plPrepShareAsset();
  }
  function plShareClose(){
    var ov = activeContainer && activeContainer.querySelector('#plShare');
    if (ov) ov.classList.remove('open');
    plShareAsset = null;
  }

  function plTweenHeight(el, prevH){
    if (!prevH) return;
    var nextH = el.offsetHeight;
    if (nextH === prevH) return;
    el.style.overflow = 'hidden';
    el.style.height = prevH + 'px';
    void el.offsetHeight;
    el.style.transition = 'height 0.22s ease';
    el.style.height = nextH + 'px';
    function done(){ clearTimeout(plTweenHeight._t); el.removeEventListener('transitionend', onEnd); el.style.height = ''; el.style.transition = ''; el.style.overflow = ''; }
    function onEnd(e){ if (e.target === el && e.propertyName === 'height') done(); }
    el.addEventListener('transitionend', onEnd);
    plTweenHeight._t = setTimeout(done, 400);
  }

  function plRender(){
    var el = activeContainer.querySelector('#parlaySlip');
    plSw.cur = 0;
    var keys = {}; PARLAY.legs.forEach(function(l){ keys[plLegKey(l)] = 1; });
    activeContainer.querySelectorAll('.pl-pick').forEach(function(td){
      var ds = td.dataset;
      var selected = !!keys[plLegKey(ds)];
      td.classList.toggle('sel', selected);
      td.setAttribute('aria-pressed', selected ? 'true' : 'false');
      var dim = false;
      if (!selected && PARLAY.legs.length){
        if (PARLAY.book && ds.book !== PARLAY.book) dim = true;
        else if (!plValidate(PARLAY.legs, plLegFromDs(ds)).ok) dim = true;
      }
      td.classList.toggle('pl-dim', dim);
      if (dim) td.setAttribute('aria-disabled', 'true'); else td.removeAttribute('aria-disabled');
    });
    if (!el) return;
    clearTimeout(plTweenHeight._t);
    el.style.height = ''; el.style.transition = ''; el.style.overflow = '';
    clearTimeout(plRender._clr);
    if (!PARLAY.legs.length){
      el.classList.remove('open');
      plRender._clr = setTimeout(function(){ if (!PARLAY.legs.length) el.innerHTML = ''; }, 260);
      return;
    }
    var dec = plDec(), am = plDecToAm(dec);
    var stake = Math.max(0, Number(PARLAY.stake) || 0);
    var n = PARLAY.legs.length;
    var prices = plBookPrices();
    var best = prices.length ? prices.reduce(function(a, b){ return b.dec > a.dec ? b : a; }, prices[0]) : null;
    var cmpHtml = prices.length > 1 ? '<div class="pl-books"><span class="pl-cap" style="margin-right:2px;">Same picks at</span>' +
      prices.map(function(p){
        return '<button type="button" class="pl-book-opt' + (p.book === PARLAY.book ? ' cur' : '') + (best && p.book === best.book ? ' best' : '') + '" data-book="' + p.book + '">' +
          esc(p.label) + ' <strong>' + (p.am > 0 ? '+' : '') + p.am + '</strong>' + (best && p.book === best.book ? '<span class="pl-best-tag">best</span>' : '') + '</button>';
      }).join('') + '</div>' : '';

    var prevH = el.classList.contains('open') ? el.offsetHeight : 0;

    el.classList.add('open');
    el.classList.toggle('collapsed', !PARLAY.open);
    el.innerHTML = '<div class="pl-swipe">' +
      '<button type="button" class="pl-swipe-clear" id="plSwipeClear" tabindex="-1" aria-hidden="true">Clear</button>' +
      '<div class="pl-inner" id="plInner">' +
      '<div class="pl-bar" id="plBar" role="button" tabindex="0" aria-expanded="' + (PARLAY.open ? 'true' : 'false') + '">' +
        '<div class="pl-bar-left"><span class="pl-chev">⌄</span><span><strong>' + n + ' leg' + (n > 1 ? 's' : '') + '</strong> <span style="color:var(--muted);">· ' + esc(PARLAY.legs[0].booklabel) + '</span></span></div>' +
        '<div class="pl-bar-right"><div style="text-align:right;"><div class="pl-cap">Parlay odds</div><div class="pl-total">' + (am > 0 ? '+' : '') + am + '</div></div>' +
        '<button type="button" id="plClear" class="pl-clear">Clear</button></div>' +
      '</div>' +
      '<div class="pl-body">' + plCardHTML({}) + cmpHtml +
        '<div class="pl-controls"><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">' +
          '<span class="pl-cap">Stake</span><input id="plStake" class="pl-stake" type="number" min="0" step="5" value="' + stake + '" aria-label="Stake amount in dollars" inputmode="decimal">' +
          '<div style="font-size:0.72rem;color:var(--muted);">Profit <strong id="plProfit" style="color:var(--text);">' + plMoney(stake * (dec - 1)) + '</strong></div>' +
        '</div></div>' +
      '</div></div></div>';

    if (n === 1 || plAnim === 'body'){ var body = el.querySelector('.pl-body'); if (body) body.classList.add('pl-in'); }
    else if (plAnim === 'leg'){ var rows = el.querySelectorAll('.pl-card-leg'); if (rows.length) rows[rows.length - 1].classList.add('pl-leg-in'); }
    else if (plAnim === 'reprice'){ el.classList.add('pl-repriced'); clearTimeout(plRender._rp); plRender._rp = setTimeout(function(){ el.classList.remove('pl-repriced'); }, 320); }
    plTweenHeight(el, prevH);
    plAnim = null;
  }

  function plUpdateMoney(){
    var dec = plDec(), s = Math.max(0, Number(PARLAY.stake) || 0);
    function set(id, v){ var el = activeContainer.querySelector('#' + id); if (el) el.textContent = v; }
    set('plProfit', plMoney(s * (dec - 1)));
    set('plCardStake', plMoney(s));
    set('plCardReturn', plMoney(s * dec));
  }

  function plBind(container){
    if (plBound) return;
    plBound = true;
    var SW_MAX = -88, SW_SNAP = -44;
    function hit(e, sel){ return e.target && e.target.closest ? e.target.closest(sel) : null; }
    container.addEventListener('click', function(e){
      var cell = hit(e, '.pl-pick'); if (cell){ plToggle(cell); return; }
      var fs = hit(e, '[data-fighter-slug]');
      if (fs && !hit(e, '.pl-pick')){
        var slug = fs.getAttribute('data-fighter-slug');
        if (slug){ window.GL_NATIVE.tap(); window.GL_ROUTER.go('fighter', { slug: slug }); }
        return;
      }
      var x = hit(e, '.pl-leg-x'); if (x){ window.GL_NATIVE.tap(); PARLAY.legs.splice(Number(x.dataset.idx), 1); if (!PARLAY.legs.length) PARLAY.book = null; plRender(); return; }
      var bo = hit(e, '.pl-book-opt'); if (bo){ window.GL_NATIVE.tap(); plSwitchBook(bo.dataset.book); return; }
      if (hit(e, '#plShareOpen')){ window.GL_NATIVE.tap(); plShareOpen(); return; }
      if (hit(e, '#plSaveImg')){ plSaveImage(); return; }
      if (hit(e, '#plCopyTxt')){ plCopyText(); return; }
      if (hit(e, '#plShareClose')){ window.GL_NATIVE.tap(); plShareClose(); return; }
      if (hit(e, '#plClear') || hit(e, '#plSwipeClear')){ window.GL_NATIVE.tap(); plClearAll(); return; }
      if (hit(e, '#plBar')){ window.GL_NATIVE.tap(); PARLAY.open = !PARLAY.open; plAnim = PARLAY.open ? 'body' : null; plRender(); return; }
      var propTab = hit(e, '[data-prop-tab]');
      if (propTab){
        window.GL_NATIVE.tap();
        var panel = propTab.closest('.fight-odds-panel');
        panel.querySelectorAll('[data-prop-tab]').forEach(function(b){ b.classList.toggle('active', b === propTab); });
        var key = propTab.getAttribute('data-prop-tab');
        panel.querySelectorAll('[data-prop-panel]').forEach(function(p){ p.style.display = (p.getAttribute('data-prop-panel') === key) ? '' : 'none'; });
        return;
      }
      var fightSel = hit(e, '[data-fight-select]');
      if (fightSel){
        window.GL_NATIVE.tap();
        var idx = fightSel.getAttribute('data-fight-select');
        container.querySelectorAll('#oddsFightBtns [data-fight-select]').forEach(function(b){ b.classList.toggle('active', b === fightSel); });
        container.querySelectorAll('.fight-odds-panel').forEach(function(p){ p.style.display = (p.id === 'odds-fight-' + idx) ? '' : 'none'; });
        return;
      }
    });
    container.addEventListener('input', function(e){
      if (e.target && e.target.id === 'plStake'){ PARLAY.stake = e.target.value === '' ? 0 : Number(e.target.value); plUpdateMoney(); }
    });
    // Swipe-the-slip-left-to-reveal-Clear (iOS-style), locked to the
    // horizontal axis so the legs list still scrolls vertically.
    container.addEventListener('touchstart', function(e){
      var inner = hit(e, '#plInner');
      if (!inner || hit(e, 'input, button')) { plSw.x = null; return; }
      plSw.x = e.touches[0].clientX; plSw.y = e.touches[0].clientY;
      plSw.base = plSw.cur; plSw.lock = null;
      inner.style.transition = 'none';
    }, { passive: true });
    container.addEventListener('touchmove', function(e){
      if (plSw.x === null) return;
      var inner = container.querySelector('#plInner'); if (!inner) return;
      var dx = e.touches[0].clientX - plSw.x, dy = e.touches[0].clientY - plSw.y;
      if (plSw.lock === null){
        if (Math.abs(dx) > Math.abs(dy) + 4) plSw.lock = 'x';
        else if (Math.abs(dy) > Math.abs(dx) + 4) plSw.lock = 'y';
      }
      if (plSw.lock !== 'x') return;
      plSw.cur = Math.max(SW_MAX, Math.min(0, plSw.base + dx));
      inner.style.transform = 'translateX(' + plSw.cur + 'px)';
    }, { passive: true });
    container.addEventListener('touchend', function(){
      if (plSw.x === null) return;
      plSw.x = null;
      var inner = container.querySelector('#plInner'); if (!inner) return;
      inner.style.transition = '';
      plSw.cur = plSw.cur < SW_SNAP ? SW_MAX : 0;
      inner.style.transform = 'translateX(' + plSw.cur + 'px)';
    });
  }
  function plReset(){ PARLAY = { book: null, legs: [], stake: 100, open: false }; plShareClose(); plRender(); }

  // ── Locked state -- same treatment fighter.js gives its own premium tail:
  // one combined "not premium" state for logged-out AND logged-in-free,
  // rather than a separate login form (this screen has no free preview to
  // fall back to either way).
  function lockedHTML(){
    return '<div class="fp-lock">' +
      '<div class="fp-lock-h"><span class="fp-lock-ico">🔒</span><div class="fp-lock-t">Odds &amp; Projections</div></div>' +
      '<div class="gl-muted" style="margin:.2rem 0 .8rem">Everything GillyLab Premium unlocks here:</div>' +
      '<div class="fp-lock-grid">' +
        '<div class="fp-lock-i"><div class="fp-lock-it">Live odds by book</div><div class="fp-lock-id">Moneyline, rounds O/U, method, double chance &amp; round props across every major sportsbook.</div></div>' +
        '<div class="fp-lock-i"><div class="fp-lock-it">Win projections</div><div class="fp-lock-id">No-vig implied win probability, consensus across books, for every fight on the card.</div></div>' +
        '<div class="fp-lock-i"><div class="fp-lock-it">Line movement</div><div class="fp-lock-id">See which way the money has moved since lines opened.</div></div>' +
        '<div class="fp-lock-i"><div class="fp-lock-it">Parlay builder</div><div class="fp-lock-id">Build a slip across fights, compare it across books, and share it as an image.</div></div>' +
      '</div>' +
      '<button type="button" class="gl-btn gl-btn-primary" data-goto="premium">Go Premium for Odds &amp; Projections</button>' +
      '</div>';
  }

  function renderHTML(data){
    var fights = data.fights || [];
    if (!fights.length){
      return '<div class="gl-muted" style="text-transform:uppercase;font-size:.68rem;letter-spacing:.1em;margin-bottom:.1rem">' + esc(eventLabel || 'UFC') + '</div>' +
        '<h1 class="gl-heading" style="margin:.1rem 0 .3rem">Betting <span style="color:var(--accent)">Odds</span></h1>' +
        '<p class="gl-muted" style="text-align:center;padding:3rem 1rem;">📋<br><br>Odds not yet posted for this card — check back closer to fight night.</p>';
    }
    return '' +
      '<div class="gl-muted" style="text-transform:uppercase;font-size:.68rem;letter-spacing:.1em;margin-bottom:.1rem">' + esc(eventLabel || 'UFC') + '</div>' +
      '<h1 class="gl-heading" style="margin:.1rem 0 .2rem">Betting <span style="color:var(--accent)">Odds</span></h1>' +
      '<p class="gl-muted" style="margin:0 0 1rem">Odds across all major sportsbooks · Updated daily</p>' +
      oddsBoardHTML(fights) +
      '<div id="parlaySlip" class="parlay-slip" aria-live="polite"></div>' +
      '<div style="border-top:1px solid var(--border);margin:2rem 0 1.25rem"></div>' +
      '<h1 class="gl-heading" style="margin:0 0 .2rem">Win <span style="color:var(--accent)">Projections</span></h1>' +
      '<p class="gl-muted" style="margin:0 0 1rem">No-vig implied probability · Consensus across all major books</p>' +
      projectionsHTML(fights);
  }

  var loadSeq = 0;
  function load(container){
    var mySeq = ++loadSeq;
    activeContainer = container;
    plBound = false;
    container.innerHTML = '<p class="gl-muted">Loading odds…</p>';
    window.GL_API.account().catch(function(){ return null; }).then(function(acct){
      if (mySeq !== loadSeq) return;
      var subscribed = !!(acct && acct.subscribed);
      if (!subscribed){
        container.innerHTML = lockedHTML();
        var goPrem = container.querySelector('[data-goto="premium"]');
        if (goPrem) goPrem.addEventListener('click', function(){ window.GL_NATIVE.tap(); window.GL_ROUTER.go('premium'); });
        return;
      }
      window.GL_API.odds().then(function(res){
        if (mySeq !== loadSeq) return;
        eventLabel = (res && res.eventLabel) || '';
        PARLAY = { book: null, legs: [], stake: 100, open: false };
        container.innerHTML = renderHTML(res || { fights: [] });
        plBind(container);
      }).catch(function(err){
        if (mySeq !== loadSeq) return;
        if (err && (err.status === 401 || err.status === 403)){
          container.innerHTML = lockedHTML();
          var gp = container.querySelector('[data-goto="premium"]');
          if (gp) gp.addEventListener('click', function(){ window.GL_NATIVE.tap(); window.GL_ROUTER.go('premium'); });
          return;
        }
        container.innerHTML = '<p class="gl-error">Couldn’t load odds — check your connection and try again.</p>';
      });
    });
  }

  return { load: load };
})();
