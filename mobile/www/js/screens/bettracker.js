// Bet Tracker & CLV -- native port of index.html's own Bet & CLV Tracker
// page. Two lanes, same as the site: a bet on a fight the app tracks is
// VERIFIED (auto-graded from the result, and earns CLV when it's a
// moneyline logged before its segment's closing line locks in); anything
// else is SELF-REPORTED (the user settles it by hand, never touches CLV).
//
// Unlike the site, this screen does NOT port index.html's client-side
// grading (btDeriveAll/btGradeWin/btFightResult/...). GET /api/app/bets
// (see worker/index.js) already grades every bet read-only, server-side,
// off the exact same functions the site's own leaderboard/player routes
// use (btEffectiveGrade/btOutcome) -- so this file only ever renders
// numbers the Worker already computed. Every mutation (add/edit/delete/
// settle) posts straight to the real /api/bets/* routes the website uses,
// now CORS-attached for the app's origin (see appCorsAttach in
// worker/index.js) -- no separate app-only write path.
//
// The screenshot bet reader ("Scan a screenshot") IS ported -- see the
// "scan" section below. It uses a plain <input type="file" accept="image/*">
// rather than a native Capacitor Camera plugin: that's what the site itself
// uses (this is a browser feature, not something scan-specific to being a
// web page), it needs no new native dependency/permission-string work in
// this app (no @capacitor/camera is installed), and tapping it already
// surfaces the OS's own "Photo Library / Take Photo" sheet on both
// platforms. The canvas share-card PNG export is still NOT ported -- a
// separate add-on (exporting your OWN bet history as an image to share),
// not part of logging a bet.
window.GL_ROUTER.register('bettracker', {
  title: 'Bet Tracker',
  tab: 'bettracker',
  render: function(container, params){
    window.GL_BETTRACKER.load(container, params);
  }
});

window.GL_BETTRACKER = (function(){
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]; }); }
  function fmtOdds(n){ return (n == null ? '—' : (n > 0 ? '+' + n : '' + n)); }
  function u1(n){ return (Math.round((n || 0) * 10) / 10).toFixed(1); }
  function u2(n){ return (Math.round(n * 100) / 100).toFixed(2).replace(/\.?0+$/, ''); }
  var BT_METH = { KO: 'KO/TKO', SUB: 'submission', DEC: 'decision' };
  var BT_MARKETS = {
    ML: 'Moneyline (winner)',
    TOTAL: 'Total rounds (over / under)',
    METHOD: 'Method (how the fight ends)',
    DISTANCE: 'Fight goes the distance?',
    DBLMETH: 'Win by either method (double chance)',
    ROUNDSTART: 'Will the fight start a round?',
    ENDROUND: 'Fight ends in a round',
    WINRDS: 'Winner in a group of rounds',
    METHRDS: 'Win by KO/TKO or submission in a group of rounds',
    NODEC: 'Finish only (void if it goes to a decision)',
  };
  function winGroups(n){
    return n >= 5
      ? [{ lab: 'Rounds 1–3', rounds: [1,2,3], dec: false }, { lab: 'Rounds 4–5 or decision', rounds: [4,5], dec: true }]
      : [{ lab: 'Round 1 or 2', rounds: [1,2], dec: false }, { lab: 'Round 3 or decision', rounds: [3], dec: true }];
  }
  function methGroups(n){
    return n >= 5
      ? [{ lab: 'Rounds 1–3', rounds: [1,2,3] }, { lab: 'Rounds 2–4', rounds: [2,3,4] }, { lab: 'Rounds 3–5', rounds: [3,4,5] }]
      : [{ lab: 'Round 1–2', rounds: [1,2] }, { lab: 'Round 2–3', rounds: [2,3] }];
  }
  function surname(n){
    var p = String(n || '').trim().split(/\s+/);
    var i = p.length - 1;
    while (i > 0 && /^(jr|sr|ii|iii|iv|v)\.?$/i.test(p[i])) i--;
    return p[i] || n;
  }
  var RANGE_DAYS = { '7d': 7, '30d': 30, '6m': 182, '12m': 365, all: null };
  var BT_SCAN_MAX_BATCH = 12;   // mirrors the site's own cap -- an accidental "select all" from a camera roll
  var BT_SCAN_CONCURRENCY = 3;
  var BT_SCAN_LONG_EDGE = 1568; // Claude resizes to ~this anyway server-side -- no benefit sending more

  // ── screen state -----------------------------------------------------
  var activeContainer = null, loadSeq = 0;
  var view = 'history';                    // history | log | board | player
  var fromOdds = false;                    // true only via a Parlay Builder handoff
  var betsData = null, fightsData = null;  // caches from GL_API.bets()/betFights()
  var hScope = 'verified', hRange = 'all', hTab = 'active', hCard = 'all', editId = null;
  var logKind = 'card', logEventSlug = null, logFight = null, logMarket = 'ML', lastSide = null;
  var legs = [];                           // staged parlay legs
  var boardTab = 'units', boardRange = 'all', playerName = '';
  var pendingPrefill = null;               // one-shot handoff payload from odds.js
  var scanQueue = [], scanIdx = 0;         // { name, file, status: reading|ready|error|done|skipped, draft, matches, error }

  function betById(id){ return (betsData && betsData.bets || []).find(function(b){ return b.id === id; }); }
  function eventBySlug(slug){ return (fightsData && fightsData.events || []).find(function(e){ return e.slug === slug; }); }
  function allFights(){
    var out = [];
    (fightsData && fightsData.events || []).forEach(function(e){ e.fights.forEach(function(f){ out.push(Object.assign({ evSlug: e.slug, evLabel: e.label }, f)); }); });
    return out;
  }
  function findFight(id){ return allFights().find(function(f){ return f.id === id; }); }
  function segStarted(f){ var t = Date.parse(f.segAt); return isFinite(t) && t <= Date.now(); }

  // ── stats (mirrors index.html's btStats, off already-graded rows) ----
  function computeStats(list){
    var st = list.filter(function(b){ return ['won','lost','push','void'].indexOf(b.status) !== -1; });
    var w = st.filter(function(b){ return b.status === 'won'; }).length;
    var l = st.filter(function(b){ return b.status === 'lost'; }).length;
    var staked = st.filter(function(b){ return b.status !== 'push' && b.status !== 'void'; }).reduce(function(s,b){ return s + b.stake; }, 0);
    var units = st.reduce(function(s,b){ return s + b.profit; }, 0);
    var clvs = st.filter(function(b){ return b.clv != null; });
    return {
      w: w, l: l, roi: staked ? (units / staked * 100) : null, units: units,
      avgClv: clvs.length ? clvs.reduce(function(s,b){ return s + b.clv; }, 0) / clvs.length : null,
      beat: clvs.filter(function(b){ return b.clv > 0; }).length, clvN: clvs.length,
      pending: list.filter(function(b){ return b.status === 'pending'; }).length,
    };
  }
  function inRange(range){ return function(b){ var d = RANGE_DAYS[range]; return !d || (Date.now() - b.ts) <= d * 864e5; }; }

  // ── shell --------------------------------------------------------------
  function topTabsHTML(){
    return '<div class="bt-tabs">' +
      '<div class="' + (view === 'history' ? 'active' : '') + '" data-view="history">History</div>' +
      '<div class="' + (view === 'log' ? 'active' : '') + '" data-view="log">Log a bet</div>' +
      '<div class="' + (view === 'board' || view === 'player' ? 'active' : '') + '" data-view="board">Leaderboard</div>' +
      '</div>';
  }

  function renderShell(){
    var host = activeContainer;
    host.innerHTML =
      '<div class="gl-muted" style="text-transform:uppercase;font-size:.68rem;letter-spacing:.1em;margin-bottom:.1rem">Premium</div>' +
      '<h1 class="gl-heading" style="margin:.1rem 0 .3rem">Bet <span style="color:var(--accent)">Tracker</span></h1>' +
      (fromOdds && view === 'log' ? '<button type="button" class="bt-back-btn" data-back-odds>&larr; Back to Odds &amp; Projections</button>' : '') +
      topTabsHTML() +
      '<div id="bt-body"></div>';
    renderView();
  }

  function renderView(){
    var body = activeContainer.querySelector('#bt-body');
    if (!body) return;
    if (view === 'history') renderHistory(body);
    else if (view === 'log') renderLog(body);
    else if (view === 'board') renderBoard(body);
    else if (view === 'player') renderPlayer(body, playerName);
  }

  function setView(v){
    view = v;
    if (v !== 'log') fromOdds = false;
    if (v === 'log'){ logEventSlug = null; logFight = null; logMarket = 'ML'; }
    renderShell();
  }

  // ── History --------------------------------------------------------------
  function betCards(list){
    var seen = {}, out = [];
    list.filter(function(b){ return b.verified && b.evSlug; }).forEach(function(b){
      if (!seen[b.evSlug]){
        var ev = eventBySlug(b.evSlug);
        seen[b.evSlug] = { slug: b.evSlug, label: ev ? ev.label : (b.match.split(' · ').pop() || 'Card'), ts: b.ts, n: 0, pending: 0 };
        out.push(seen[b.evSlug]);
      }
      seen[b.evSlug].n++;
      if (b.status === 'pending') seen[b.evSlug].pending++;
    });
    return out;
  }

  function legsHTML(b){
    if (b.market !== 'PARLAY' || !b.legs) return '';
    var statuses = b.legStatuses || [];
    return '<div class="bt-legs">' + b.legs.map(function(l, i){
      var st = statuses[i] || 'pending';
      var ico = st === 'won' ? '✓' : st === 'lost' ? '✗' : st === 'void' ? '·' : '…';
      return '<div class="bt-leg bt-leg-' + st + '"><span class="bt-leg-ico">' + ico + '</span>' +
        '<span class="bt-leg-p">' + esc(l.pick) + '</span><span class="bt-leg-o">' + fmtOdds(l.odds) + '</span></div>';
    }).join('') + '</div>';
  }

  function betRowHTML(b){
    var res;
    if (b.status === 'won') res = '<span class="bt-res bt-pos">Won +' + u1(b.profit) + 'u</span>';
    else if (b.status === 'lost') res = '<span class="bt-res bt-neg">Lost ' + u1(b.profit) + 'u</span>';
    else if (b.status === 'void') res = '<span class="bt-res" style="color:var(--muted)">Void · stake back</span>';
    else if (b.status === 'push') res = '<span class="bt-res" style="color:var(--muted)">Push</span>';
    else res = '<span class="bt-res" style="color:#ffcf7a;font-size:0.8rem">Open</span>';
    var V = '<span class="bt-v">verified</span>';
    var badge;
    if (!b.verified) badge = '<span class="bt-badge bt-b-self">self-reported</span>';
    else if (b.status === 'pending') badge = '<span class="bt-badge bt-b-none">' + V + ' · ' +
      (b.market === 'PARLAY' && b.legsLive ? (b.legsIn || 0) + ' of ' + b.legsLive + ' legs in' : 'pending') + '</span>';
    else if (b.clv != null) badge = '<span class="bt-badge ' + (b.clv > 0 ? 'bt-b-clv' : 'bt-b-neg') + '">CLV ' + (b.clv > 0 ? '+' : '') + b.clv + '</span>';
    else if (b.priced && b.noClv) badge = '<span class="bt-badge bt-b-none">' + V + ' · no CLV · ' + esc(b.noClv) + '</span>';
    else badge = '<span class="bt-badge bt-b-none">' + V + '</span>';
    var line = (b.closeOdds != null
      ? 'You <b>' + fmtOdds(b.rawOdds) + '</b> &rarr; close <b>' + fmtOdds(b.closeOdds) + '</b>'
      : '<b>' + fmtOdds(b.odds) + '</b>')
      + ' · ' + u2(b.stake) + 'u'
      + (b.book ? ' · <span class="bt-book">' + esc(b.book) + '</span>' : '');
    var acts = '';
    if (b.status === 'pending'){
      var bits = [];
      if (b.kind === 'manual') bits.push(
        '<button class="win" data-settle="' + esc(b.id) + '" data-status="won">Won</button>' +
        '<button class="lose" data-settle="' + esc(b.id) + '" data-status="lost">Lost</button>' +
        '<button data-settle="' + esc(b.id) + '" data-status="push">Push</button>');
      if (b.editable) bits.push('<button data-edit-open="' + esc(b.id) + '">Edit</button><button data-delete="' + esc(b.id) + '">Delete</button>');
      if (bits.length) acts = '<div class="bt-acts">' + bits.join('') + '</div>';
      if (editId === b.id){
        acts += '<div class="bt-editrow"><div class="bt-row2">' +
          '<div><label>Your odds</label><input type="number" data-e-odds value="' + b.rawOdds + '"></div>' +
          '<div><label>Stake (units)</label><input type="number" step="0.5" min="0.5" data-e-stake value="' + b.stake + '"></div></div>' +
          '<label>Sportsbook (optional)</label><input maxlength="40" data-e-book value="' + esc(b.book || '') + '">' +
          '<div class="bt-acts"><button class="win" data-edit-save="' + esc(b.id) + '">Save</button><button data-edit-cancel>Cancel</button></div></div>';
      }
    }
    return '<div class="bt-bet"><div class="bt-bet-top">' +
      '<div class="bt-bet-txt"><div class="bt-nm">' + esc(b.pick) + '</div><div class="bt-mk">' + esc(b.match) + '</div></div>' + res + '</div>' +
      legsHTML(b) + '<div class="bt-mid"><div>' + line + '</div>' + badge + '</div>' + acts + '</div>';
  }

  function renderHistory(host){
    if (!betsData){ host.innerHTML = '<p class="gl-muted">Loading your bets…</p>'; return; }
    var scoped = betsData.bets.filter(inRange(hRange));
    var verified = scoped.filter(function(b){ return b.verified; });
    var vs = computeStats(verified);
    var shown = hScope === 'verified' ? verified : scoped;
    var s = computeStats(shown);
    var rangeBtn = function(k, lbl){ return '<div class="' + (hRange === k ? 'on' : '') + '" data-range="' + k + '">' + lbl + '</div>'; };
    var clvTxt = vs.avgClv == null ? '—' : (vs.avgClv > 0 ? '+' : '') + vs.avgClv.toFixed(1) + '<span>pts</span>';
    var h = '<div class="bt-hero"><div class="bt-hero-lbl">Verified closing line value</div>' +
      '<div class="bt-hero-row"><div class="bt-big ' + (vs.avgClv < 0 ? 'neg' : '') + '">' + clvTxt + '</div>' +
      '<div class="bt-hero-sub">' + (vs.clvN ? 'beat the close on <b style="color:var(--text)">' + vs.beat + ' of ' + vs.clvN + '</b> moneylines' : 'no graded moneylines in this range') + '</div></div>' +
      '<div class="bt-foot"><b style="color:#c9ccd3">Moneylines only</b> — props are still <b style="color:#c9ccd3">verified</b> and count toward record, ROI and units.</div></div>';
    h += '<div class="bt-grid">' +
      '<div class="bt-tile"><div class="bt-tile-t">Record</div><div class="bt-tile-v">' + s.w + '-' + s.l + '</div></div>' +
      '<div class="bt-tile"><div class="bt-tile-t">ROI</div><div class="bt-tile-v ' + (s.roi > 0 ? 'bt-pos' : s.roi < 0 ? 'bt-neg' : '') + '">' + (s.roi == null ? '—' : (s.roi > 0 ? '+' : '') + s.roi.toFixed(1) + '%') + '</div></div>' +
      '<div class="bt-tile"><div class="bt-tile-t">Units</div><div class="bt-tile-v ' + (s.units > 0 ? 'bt-pos' : s.units < 0 ? 'bt-neg' : '') + '">' + (s.units > 0 ? '+' : '') + s.units.toFixed(1) + 'u</div></div>' +
      '<div class="bt-tile"><div class="bt-tile-t">Pending</div><div class="bt-tile-v">' + s.pending + '</div></div></div>';
    h += '<div class="bt-toggle"><div class="' + (hScope === 'verified' ? 'on' : '') + '" data-scope="verified">Verified only</div>' +
      '<div class="' + (hScope === 'all' ? 'on' : '') + '" data-scope="all">All (incl. self-reported)</div></div>';
    h += '<div class="bt-ranges">' + rangeBtn('7d','7D') + rangeBtn('30d','30D') + rangeBtn('6m','6M') + rangeBtn('12m','12M') + rangeBtn('all','All time') + '</div>';

    var pend = shown.filter(function(b){ return b.status === 'pending'; });
    var settled = shown.filter(function(b){ return b.status !== 'pending'; });
    h += '<div class="bt-subtabs"><div class="' + (hTab === 'active' ? 'on' : '') + '" data-tab="active">Active (' + pend.length + ')</div>' +
      '<div class="' + (hTab === 'past' ? 'on' : '') + '" data-tab="past">Past bets (' + settled.length + ')</div></div>';

    var cards = betCards(shown);
    if (hTab === 'active'){
      var liveCards = cards.filter(function(c){ return c.pending > 0; });
      if (liveCards.length > 1){
        h += '<div class="bt-cards"><div class="' + (hCard === 'all' ? 'on' : '') + '" data-card="all">All cards</div>' +
          liveCards.map(function(c){ return '<div class="' + (hCard === c.slug ? 'on' : '') + '" data-card="' + esc(c.slug) + '">' + esc(c.label) + ' (' + c.n + ')</div>'; }).join('') + '</div>';
      }
      var showCards = liveCards.filter(function(c){ return hCard === 'all' || hCard === c.slug; });
      showCards.forEach(function(c){
        var rows = pend.filter(function(b){ return b.evSlug === c.slug; });
        if (!rows.length) return;
        h += '<div class="bt-cardhdr"><div class="bt-cardhdr-t">' + esc(c.label) + '</div></div>';
        h += rows.sort(function(a,b){ return b.createdAt - a.createdAt; }).map(betRowHTML).join('');
      });
      var loose = pend.filter(function(b){ return !b.evSlug || !liveCards.some(function(c){ return c.slug === b.evSlug; }); });
      if (loose.length && hCard === 'all'){
        h += '<div class="bt-cardhdr"><div class="bt-cardhdr-t">Other pending</div></div>';
        h += loose.sort(function(a,b){ return b.ts - a.ts; }).map(betRowHTML).join('');
      }
      if (!pend.length && shown.length) h += '<div class="bt-empty">No open bets — your settled ones are under <b>Past bets</b>.</div>';
    } else {
      var doneCards = cards.filter(function(c){ return c.n - c.pending > 0; }).sort(function(a,b){ return (b.pending>0?1:0)-(a.pending>0?1:0) || b.ts - a.ts; });
      if (doneCards.length > 1){
        h += '<select class="bt-card-select" data-card-select><option value="all"' + (hCard === 'all' ? ' selected' : '') + '>All cards</option>' +
          doneCards.map(function(c){ return '<option value="' + esc(c.slug) + '"' + (hCard === c.slug ? ' selected' : '') + '>' + esc(c.label) + (c.pending>0?' · live':'') + ' (' + (c.n - c.pending) + ')</option>'; }).join('') + '</select>';
      }
      doneCards.filter(function(c){ return hCard === 'all' || hCard === c.slug; }).forEach(function(c){
        var rows = settled.filter(function(b){ return b.evSlug === c.slug; });
        if (!rows.length) return;
        var st = computeStats(rows);
        h += '<div class="bt-cardhdr"><div class="bt-cardhdr-t">' + esc(c.label) + (c.pending>0?' <span class="bt-live-tag">live</span>':'') + '</div>' +
          '<div class="bt-cardsum ' + (st.units>0?'bt-pos':st.units<0?'bt-neg':'') + '">' + st.w + '-' + st.l + ' · ' + (st.units>0?'+':'') + u1(st.units) + 'u</div></div>';
        h += rows.sort(function(a,b){ return b.ts - a.ts; }).map(betRowHTML).join('');
      });
      var looseDone = settled.filter(function(b){ return !b.evSlug || !doneCards.some(function(c){ return c.slug === b.evSlug; }); });
      if (looseDone.length && hCard === 'all'){
        h += '<div class="bt-cardhdr"><div class="bt-cardhdr-t">Other settled</div></div>';
        h += looseDone.sort(function(a,b){ return b.ts - a.ts; }).map(betRowHTML).join('');
      }
      if (!settled.length && shown.length) h += '<div class="bt-empty">Nothing settled in this range yet.</div>';
    }
    if (!shown.length) h += '<div class="bt-empty">No bets logged' + (hRange === 'all' ? ' yet' : ' in this range') + '.</div>';
    host.innerHTML = h;
  }

  // ── Log a bet -----------------------------------------------------------
  function pairableMkt(m){ return m === 'ML' || m === 'TOTAL'; }
  function legErr(leg){
    if (legs.length && legs[0].evSlug !== leg.evSlug) return 'Every leg of a parlay has to be on the same event.';
    var same = legs.filter(function(l){ return l.fightId === leg.fightId; });
    if (same.length){
      if (!pairableMkt(leg.market) || same.some(function(l){ return !pairableMkt(l.market); }))
        return 'On one fight, only a moneyline and a rounds O/U can be parlayed.';
      if (same.some(function(l){ return l.market === leg.market; })) return 'You already have that market on this fight.';
    }
    return null;
  }
  function combineOdds(list){
    var amToDec = function(a){ return a > 0 ? 1 + a/100 : 1 + 100/(-a); };
    var decToAm = function(d){ return d >= 2 ? Math.round((d-1)*100) : -Math.round(100/(d-1)); };
    return decToAm(list.reduce(function(p,o){ return p * amToDec(o); }, 1));
  }

  function marketFieldsHTML(f){
    var sel1 = lastSide === 2 ? '' : ' selected', sel2 = lastSide === 2 ? ' selected' : '';
    if (logMarket === 'ML') return '<label>Winner</label><select data-mlwin><option value="1"' + sel1 + '>' + esc(f.f1) + '</option><option value="2"' + sel2 + '>' + esc(f.f2) + '</option></select>';
    if (logMarket === 'METHOD') return '<div class="bt-row2"><div><label>Winner</label><select data-mfr><option value="1"' + sel1 + '>' + esc(f.f1) + '</option><option value="2"' + sel2 + '>' + esc(f.f2) + '</option><option value="any">Either fighter</option></select></div>' +
      '<div><label>Method</label><select data-mmeth><option value="KO">KO/TKO</option><option value="SUB">Submission</option><option value="DEC">Decision</option></select></div></div>';
    if (logMarket === 'ENDROUND'){ var rds = ''; for (var i=1;i<=f.rounds;i++) rds += '<option value="'+i+'">Round '+i+'</option>';
      return '<label>Winner</label><select data-erf><option value="1"' + sel1 + '>' + esc(f.f1) + '</option><option value="2"' + sel2 + '>' + esc(f.f2) + '</option><option value="any">Either fighter</option></select>' +
      '<div class="bt-row2"><div><label>Method</label><select data-erm><option value="ANY">Any finish</option><option value="KO">KO/TKO</option><option value="SUB">Submission</option></select></div><div><label>Ends in</label><select data-err>' + rds + '</select></div></div>'; }
    if (logMarket === 'WINRDS'){ var gs = winGroups(f.rounds);
      return '<label>Winner</label><select data-wrf><option value="1"' + sel1 + '>' + esc(f.f1) + '</option><option value="2"' + sel2 + '>' + esc(f.f2) + '</option></select>' +
        '<label>Wins in</label><select data-wrg>' + gs.map(function(g,i){ return '<option value="'+i+'">'+g.lab+'</option>'; }).join('') + '</select>'; }
    if (logMarket === 'METHRDS'){ var gm = methGroups(f.rounds);
      return '<div class="bt-row2"><div><label>Winner</label><select data-mrf><option value="1"' + sel1 + '>' + esc(f.f1) + '</option><option value="2"' + sel2 + '>' + esc(f.f2) + '</option></select></div>' +
        '<div><label>Method</label><select data-mrm><option value="KO">KO/TKO</option><option value="SUB">Submission</option></select></div></div>' +
        '<label>In</label><select data-mrg>' + gm.map(function(g,i){ return '<option value="'+i+'">'+g.lab+'</option>'; }).join('') + '</select>'; }
    if (logMarket === 'TOTAL'){ var o=''; for (var r=1;r<f.rounds;r++) o += '<option value="'+r+'.5">'+r+'.5 rounds</option>';
      return '<div class="bt-row2"><div><label>Line</label><select data-tline>' + o + '</select></div><div><label>Over / Under</label><select data-tou><option value="O">Over</option><option value="U">Under</option></select></div></div>'; }
    if (logMarket === 'ROUNDSTART'){ var o2=''; for (var r2=2;r2<=f.rounds;r2++) o2 += '<option value="'+r2+'">Round '+r2+'</option>';
      return '<div class="bt-row2"><div><label>Round</label><select data-rsr>' + o2 + '</select></div><div><label>Will it start?</label><select data-rsyn><option value="Y">Will start</option><option value="N">Won\'t start</option></select></div></div>'; }
    if (logMarket === 'DISTANCE') return '<label>Does the fight reach a decision?</label><select data-dyn><option value="Y">Yes — goes the distance</option><option value="N">No — ends in a finish</option></select>';
    if (logMarket === 'DBLMETH') return '<div class="bt-row2"><div><label>Winner</label><select data-dcf><option value="1"' + sel1 + '>' + esc(f.f1) + '</option><option value="2"' + sel2 + '>' + esc(f.f2) + '</option></select></div>' +
      '<div><label>By</label><select data-dcm><option value="KO">KO/TKO or decision</option><option value="SUB">Submission or decision</option><option value="KOSUB">KO/TKO or submission</option></select></div></div>';
    if (logMarket === 'NODEC') return '<label>Winner (finish only — void if it goes to a decision)</label><select data-ndf><option value="1"' + sel1 + '>' + esc(f.f1) + '</option><option value="2"' + sel2 + '>' + esc(f.f2) + '</option></select>';
    return '';
  }
  function buildPick(f, host){
    var g = function(sel){ return host.querySelector(sel); };
    if (logMarket === 'ML'){ var s = +g('[data-mlwin]').value; return { pick: surname(s===1?f.f1:f.f2) + ' ML', p: { side: s }, priced: true, closeSide: s }; }
    if (logMarket === 'METHOD'){ var sv=g('[data-mfr]').value, m=g('[data-mmeth]').value, any=sv==='any';
      return { pick: any ? ('Fight ends by ' + BT_METH[m]) : (surname(sv==='1'?f.f1:f.f2) + ' by ' + BT_METH[m]), p: { side: any?'any':+sv, methodCat: m }, priced: false }; }
    if (logMarket === 'ENDROUND'){ var sv2=g('[data-erf]').value, mv=g('[data-erm]').value, n=+g('[data-err]').value, any2=sv2==='any';
      var mt = mv==='ANY' ? '' : (mv==='KO' ? ' by KO/TKO' : ' by submission');
      return { pick: any2 ? ('Fight ends' + mt + ' in round ' + n) : (surname(sv2==='1'?f.f1:f.f2) + (mv==='ANY'?' to win':mt) + ' in round ' + n), p: { side: any2?'any':+sv2, meth: mv, round: n }, priced: false }; }
    if (logMarket === 'WINRDS'){ var s3=+g('[data-wrf]').value, grp=winGroups(f.rounds)[+g('[data-wrg]').value];
      return { pick: surname(s3===1?f.f1:f.f2) + ' to win — ' + grp.lab.toLowerCase(), p: { side: s3, rounds: grp.rounds, dec: grp.dec }, priced: false }; }
    if (logMarket === 'METHRDS'){ var s4=+g('[data-mrf]').value, m4=g('[data-mrm]').value, grp4=methGroups(f.rounds)[+g('[data-mrg]').value];
      return { pick: surname(s4===1?f.f1:f.f2) + ' by ' + (m4==='KO'?'KO/TKO':'submission') + ' — ' + grp4.lab.toLowerCase(), p: { side: s4, methodCat: m4, rounds: grp4.rounds }, priced: false }; }
    if (logMarket === 'TOTAL'){ var L=parseFloat(g('[data-tline]').value), ou=g('[data-tou]').value; return { pick: (ou==='O'?'Over ':'Under ') + L + ' rounds', p: { line: L, ou: ou }, priced: false }; }
    if (logMarket === 'ROUNDSTART'){ var n2=+g('[data-rsr]').value, yn=g('[data-rsyn]').value; return { pick: 'Fight ' + (yn==='Y'?'starts':'does NOT start') + ' round ' + n2, p: { round: n2, yn: yn }, priced: false }; }
    if (logMarket === 'DISTANCE'){ var yn2=g('[data-dyn]').value; return { pick: yn2==='Y' ? 'Goes the distance' : 'Does NOT go the distance', p: { yn: yn2 }, priced: false }; }
    if (logMarket === 'NODEC'){ var s5=+g('[data-ndf]').value; return { pick: surname(s5===1?f.f1:f.f2) + ' by finish (void if decision)', p: { side: s5 }, priced: false }; }
    var s6=+g('[data-dcf]').value, fm=g('[data-dcm]').value;
    var DM = { KO:{methods:['KO','DEC'],lab:'KO/TKO or decision'}, SUB:{methods:['SUB','DEC'],lab:'submission or decision'}, KOSUB:{methods:['KO','SUB'],lab:'KO/TKO or submission'} }[fm] || { methods:['KO','DEC'], lab:'KO/TKO or decision' };
    return { pick: surname(s6===1?f.f1:f.f2) + ' by ' + DM.lab, p: { side: s6, methods: DM.methods }, priced: false };
  }

  // ── Scan a screenshot -----------------------------------------------------
  // One image in, one draft out (POST /api/bets/scan -- see worker/index.js's
  // handleBetsScan). The worker does all the real work: a vision model reads
  // the slip, and the worker independently re-matches each leg against a
  // live, undecided bout and classifies it onto one of the app's own 10
  // BT_MARKETS codes (never trusting the model's own market label) -- this
  // file only ever renders that result and posts through the exact same
  // POST /api/bets a hand-built bet uses. Nothing saves until the user
  // reviews and confirms one screenshot at a time.
  //
  // scanPickText mirrors index.html's own btScanPickText exactly: the same
  // phrasing buildPick() above produces for a hand-picked market, built here
  // from the worker's plain market+params instead of live form fields, so a
  // scanned tracked bet reads identically to one entered by hand.
  function scanPickText(market, params, f1, f2, boutRounds){
    var p = params || {};
    var who = function(s){ return surname(s === 2 ? f2 : f1); };
    var sameRounds = function(a, b){ return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every(function(v,i){ return v === b[i]; }); };
    if (market === 'ML') return who(p.side) + ' ML';
    if (market === 'METHOD') return p.side === 'any' ? ('Fight ends by ' + BT_METH[p.methodCat]) : (who(p.side) + ' by ' + BT_METH[p.methodCat]);
    if (market === 'ENDROUND'){
      var any = p.side === 'any';
      var mt = p.meth === 'ANY' ? '' : (p.meth === 'KO' ? ' by KO/TKO' : ' by submission');
      return any ? ('Fight ends' + mt + ' in round ' + p.round) : (who(p.side) + (p.meth === 'ANY' ? ' to win' : mt) + ' in round ' + p.round);
    }
    if (market === 'TOTAL') return (p.ou === 'O' ? 'Over ' : 'Under ') + p.line + ' rounds';
    if (market === 'ROUNDSTART') return 'Fight ' + (p.yn === 'Y' ? 'starts' : 'does NOT start') + ' round ' + p.round;
    if (market === 'DISTANCE') return p.yn === 'Y' ? 'Goes the distance' : 'Does NOT go the distance';
    if (market === 'WINRDS'){
      var g1 = winGroups(boutRounds).filter(function(g){ return sameRounds(g.rounds, p.rounds); })[0];
      return who(p.side) + ' to win — ' + (g1 ? g1.lab.toLowerCase() : ('rounds ' + (p.rounds || []).join('-')));
    }
    if (market === 'METHRDS'){
      var g2 = methGroups(boutRounds).filter(function(g){ return sameRounds(g.rounds, p.rounds); })[0];
      return who(p.side) + ' by ' + (p.methodCat === 'KO' ? 'KO/TKO' : 'submission') + ' — ' + (g2 ? g2.lab.toLowerCase() : ('rounds ' + (p.rounds || []).join('-')));
    }
    if (market === 'DBLMETH'){
      var key = (p.methods || []).join(',');
      var lab = key === 'KO,DEC' ? 'KO/TKO or decision' : key === 'SUB,DEC' ? 'submission or decision' : 'KO/TKO or submission';
      return who(p.side) + ' by ' + lab;
    }
    if (market === 'NODEC') return who(p.side) + ' by finish (void if decision)';
    return '';
  }

  // Downscale to ~BT_SCAN_LONG_EDGE on the long edge before upload (same as
  // the site's own btScanDownscale) -- smaller request, and no benefit
  // sending more pixels than the model resizes to anyway.
  function downscaleImage(file){
    return new Promise(function(resolve, reject){
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function(){
        var scale = Math.min(1, BT_SCAN_LONG_EDGE / Math.max(img.width, img.height));
        var w = Math.max(1, Math.round(img.width * scale)), h = Math.max(1, Math.round(img.height * scale));
        var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        var dataUrl = cv.toDataURL('image/jpeg', 0.85);
        resolve(dataUrl.slice(dataUrl.indexOf(',') + 1));
      };
      img.onerror = function(){ URL.revokeObjectURL(url); reject(new Error('Could not read that image file.')); };
      img.src = url;
    });
  }

  function runScanOne(item){
    return downscaleImage(item.file).then(function(b64){
      return window.GL_API.betScan(b64, 'image/jpeg');
    }).then(function(r){
      if (r && r.ok){ item.status = 'ready'; item.draft = r.draft; item.matches = r.matches || null; }
      else { item.status = 'error'; item.error = (r && r.error) || 'Could not read this screenshot.'; }
    }).catch(function(err){
      item.status = 'error'; item.error = (err && err.data && err.data.error) || 'Could not read this screenshot.';
    }).then(function(){
      if (logKind === 'scan' && scanQueue[scanIdx] === item) renderView();
    });
  }
  // Concurrency-limited pool, same as the site -- BT_SCAN_CONCURRENCY items in
  // flight at once, so a full batch doesn't serialize into a slow queue but
  // also doesn't hammer the worker/vision API all at once.
  function runScanQueue(){
    var cursor = 0;
    function next(){
      if (cursor >= scanQueue.length) return Promise.resolve();
      var item = scanQueue[cursor++];
      return runScanOne(item).then(next);
    }
    for (var i = 0; i < BT_SCAN_CONCURRENCY; i++) next();
  }
  function pickScanFiles(fileList){
    var files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return;
    if (files.length > BT_SCAN_MAX_BATCH){
      alert('Max ' + BT_SCAN_MAX_BATCH + ' screenshots at once — taking the first ' + BT_SCAN_MAX_BATCH + '.');
      files = files.slice(0, BT_SCAN_MAX_BATCH);
    }
    scanQueue = files.map(function(f){ return { name: f.name, file: f, status: 'reading', draft: null, matches: null, error: null }; });
    scanIdx = 0;
    renderView();
    runScanQueue();
  }

  function scanHTML(){
    var n = scanQueue.length;
    if (!n){
      return '<input type="file" accept="image/*" multiple style="display:none" data-scan-files>' +
        '<button type="button" class="bt-btn" data-scan-choose>Choose screenshots…</button>' +
        '<div class="bt-note" style="margin-top:.6rem">Scan a screenshot to log your bets. Each becomes a draft you review and confirm one at a time — nothing saves until you confirm it. If it matches an upcoming fight, it tracks as <b style="color:var(--accent)">verified</b>.</div>';
    }
    if (scanIdx >= n){
      var done = scanQueue.filter(function(x){ return x.status === 'done'; }).length;
      var skipped = scanQueue.filter(function(x){ return x.status === 'skipped'; }).length;
      return '<div class="bt-note">Done — ' + done + ' logged' + (skipped ? ', ' + skipped + ' skipped' : '') + '.</div>' +
        '<button type="button" class="bt-btn" data-view="history">Go to bet history</button> ' +
        '<button type="button" class="bt-btn bt-btn-ghost" data-scan-more>Scan more</button>';
    }
    var item = scanQueue[scanIdx];
    var h = '<div class="bt-note" style="margin-bottom:.6rem">' + (scanIdx + 1) + ' of ' + n + '</div>';
    if (item.status === 'reading'){
      h += '<div class="bt-empty">Reading this screenshot…</div>';
    } else if (item.status === 'error'){
      h += '<div class="bt-note lock">' + esc(item.error || "Couldn't read this screenshot.") + '</div>' +
        '<button type="button" class="bt-btn" data-kind="custom">Enter this one manually</button> ' +
        '<button type="button" class="bt-btn bt-btn-ghost" data-scan-skip>Skip</button>';
    } else if (item.status === 'ready'){
      var d = item.draft;
      var scanLegs = d.kind === 'parlay' ? d.parlay.legs : [d.manual];
      var matches = item.matches || [];
      // Eligible for the same tracked/verified path a manually-entered bet
      // gets, on any of the 10 markets -- every leg must have classified onto
      // one of them from a matched, undecided bout AND (for a parlay) carry
      // its own real odds. One leg failing any of that drops the WHOLE bet
      // to self-reported -- no mixing tracked and self-reported legs.
      var legTrackable = function(l, m){ return m && m.trackable && isFinite(l.odds) && l.odds !== 0; };
      var canTrack = scanLegs.length && scanLegs.every(function(l, i){ return legTrackable(l, matches[i]); });
      var unc = (d.uncertain_fields || []).filter(function(f){ return f && f !== 'not a bet slip'; });
      if (unc.length) h += '<div class="bt-note">Couldn\'t read clearly: ' + esc(unc.join(', ')) + ' — check before confirming.</div>';
      if (canTrack){
        var allPriced = matches.every(function(m){ return m.priced; });
        var rows = scanLegs.map(function(l, i){
          var m = matches[i], pickTxt = scanPickText(m.market, m.params, m.f1, m.f2, m.rounds);
          return '<div class="bt-row2"><div>' + esc(pickTxt) + '</div><div style="text-align:right">' + esc(String(l.odds)) + '</div></div>';
        }).join('');
        h += '<div class="bt-note" style="border-color:var(--accent)">Matches ' + (scanLegs.length > 1 ? 'an upcoming card' : 'a live, undecided fight') +
          ' — logs the same way as picking it under Upcoming fights: <b style="color:var(--accent)">verified</b>' +
          (allPriced ? ', and CLV-eligible until that segment starts.' : '. Not CLV-scored (this market doesn\'t carry a trustworthy closing line), same as picking it manually.') + '</div>' +
          rows +
          '<div class="bt-row2" style="margin-top:.4rem"><div><label>Stake (units)</label><input type="number" data-scan-stake value="' + (d.stake != null ? d.stake : 1) + '" step="0.5" min="0.5"></div>' +
          '<div><label>Sportsbook (optional)</label><input maxlength="40" data-scan-book value="' + esc(d.book || '') + '"></div></div>' +
          '<label style="display:flex;align-items:center;gap:.4rem;font-weight:400;text-transform:none;letter-spacing:0"><input type="checkbox" data-scan-track checked style="width:auto"> Track this bet (verified) — uncheck to log as self-reported instead</label>' +
          '<button type="button" class="bt-btn" data-scan-confirm-tracked>Log this bet</button> ' +
          '<button type="button" class="bt-btn bt-btn-ghost" data-scan-skip>Skip</button>';
      } else {
        var matchText = scanLegs.map(function(l){ return l.matchup; }).join(' + ');
        var pickText = scanLegs.map(function(l){ return l.pick + ' (' + l.market + ')'; }).join(' | ') + (d.kind === 'parlay' ? ' — ' + scanLegs.length + '-leg parlay' : '');
        var oddsVal = d.kind === 'parlay' ? d.parlay.parlayOdds : d.manual.odds;
        var anyMatch = matches.some(Boolean);
        if (anyMatch) h += '<div class="bt-note" style="border-color:var(--accent)">Matches an upcoming card, but not cleanly enough to auto-track (missing a leg\'s odds, a market this can\'t classify confidently, or an unclear winner) — logging as self-reported. You can log it again under Upcoming fights if you\'d rather have it tracked.</div>';
        h += '<label>Matchup / event</label><input data-scan-match value="' + esc(matchText) + '">' +
          '<label>Your pick + market</label><input data-scan-pick value="' + esc(pickText) + '">' +
          '<div class="bt-row2"><div><label>Your odds</label><input type="number" data-scan-odds value="' + (isFinite(oddsVal) ? oddsVal : '') + '" placeholder="-150"></div>' +
          '<div><label>Stake (units)</label><input type="number" data-scan-stake value="' + (d.stake != null ? d.stake : '') + '" placeholder="1" step="0.5" min="0.5"></div></div>' +
          '<label>Sportsbook (optional)</label><input maxlength="40" data-scan-book value="' + esc(d.book || '') + '">' +
          '<div class="bt-note">We don\'t track this fight from a screenshot, so it\'s tagged <b style="color:#ffcf7a">self-reported</b>: you settle it yourself, excluded from verified CLV/ROI.</div>' +
          '<button type="button" class="bt-btn" data-scan-confirm>Log this bet</button> ' +
          '<button type="button" class="bt-btn bt-btn-ghost" data-scan-skip>Skip</button>';
      }
    }
    return h;
  }

  function scanConfirm(host){
    var item = scanQueue[scanIdx]; if (!item || item.status !== 'ready') return;
    var match = host.querySelector('[data-scan-match]').value.trim();
    var pick = host.querySelector('[data-scan-pick]').value.trim();
    var odds = parseInt(host.querySelector('[data-scan-odds]').value, 10);
    var stake = parseFloat(host.querySelector('[data-scan-stake]').value) || 1;
    var book = (host.querySelector('[data-scan-book]') || {}).value || '';
    if (!match || !pick || !isFinite(odds)){ alert('Fill in the matchup, your pick and the odds.'); return; }
    window.GL_API.betAdd({ kind: 'manual', match: match, pick: pick, odds: odds, stake: stake, book: book })
      .then(function(){ return reloadBets(); })
      .then(function(){ item.status = 'done'; scanIdx++; renderView(); })
      .catch(function(err){ alert((err && err.data && err.data.error) || 'Could not log that bet.'); });
  }
  // A matched, trackable, undecided leg (or set of legs, for a parlay) --
  // posts through the exact same request shape submitCard()/submitParlay()
  // build for a manually-picked bet, so the server's tracked-bet validation
  // runs identically either way. Unchecking "Track this bet" rebuilds the
  // self-reported body instead, from the same underlying draft.
  function scanConfirmTracked(host){
    var item = scanQueue[scanIdx]; if (!item || item.status !== 'ready') return;
    var d = item.draft, matches = item.matches || [];
    var scanLegs = d.kind === 'parlay' ? d.parlay.legs : [d.manual];
    var stake = parseFloat(host.querySelector('[data-scan-stake]').value) || 1;
    var book = (host.querySelector('[data-scan-book]') || {}).value || '';
    var trackChecked = !!(host.querySelector('[data-scan-track]') || {}).checked;
    var shortMatch = function(m){ return surname(m.f1) + ' vs ' + surname(m.f2); };
    var body;
    if (!trackChecked){
      var match = scanLegs.map(function(l){ return l.matchup; }).join(' + ');
      var pick = scanLegs.map(function(l){ return l.pick + ' (' + l.market + ')'; }).join(' | ') + (d.kind === 'parlay' ? ' — ' + scanLegs.length + '-leg parlay' : '');
      var odds = d.kind === 'parlay' ? d.parlay.parlayOdds : d.manual.odds;
      if (!isFinite(odds)){ alert('Missing odds on this one — enter it manually instead.'); return; }
      body = { kind: 'manual', match: match, pick: pick, odds: odds, stake: stake, book: book };
    } else if (d.kind === 'parlay'){
      body = {
        kind: 'tracked', market: 'PARLAY', stake: stake, book: book,
        match: scanLegs.length + '-leg parlay (scanned)', odds: d.parlay.parlayOdds,
        legs: scanLegs.map(function(l, i){
          var m = matches[i];
          return { fightId: m.fightId, market: m.market, params: m.params,
            pick: scanPickText(m.market, m.params, m.f1, m.f2, m.rounds), match: shortMatch(m), odds: l.odds };
        }),
      };
    } else {
      var m0 = matches[0];
      body = { kind: 'tracked', fightId: m0.fightId, market: m0.market,
        pick: scanPickText(m0.market, m0.params, m0.f1, m0.f2, m0.rounds), match: shortMatch(m0),
        params: m0.params, priced: !!m0.priced, closeSide: (m0.params && m0.params.side === 2) ? 2 : 1,
        odds: d.manual.odds, stake: stake, book: book };
    }
    window.GL_API.betAdd(body)
      .then(function(){ return reloadBets(); })
      .then(function(){ item.status = 'done'; scanIdx++; renderView(); })
      .catch(function(err){ alert((err && err.data && err.data.error) || 'Could not log that bet.'); });
  }
  function scanSkip(){
    var item = scanQueue[scanIdx]; if (!item) return;
    item.status = 'skipped'; scanIdx++; renderView();
  }

  function stageHTML(){
    if (!legs.length) return '';
    var ready = legs.length > 1;
    var comb = combineOdds(legs.map(function(l){ return l.odds; }));
    var h = '<div class="bt-stage"><div class="bt-stage-t">Parlay · ' + legs.length + ' leg' + (legs.length===1?'':'s') + '</div>';
    h += legs.map(function(l, i){
      return '<div class="bt-leg"><span class="bt-leg-p">' + esc(l.pick) + '</span><span class="bt-leg-m">' + esc(l.match) + '</span>' +
        '<span class="bt-leg-o">' + fmtOdds(l.odds) + '</span><button type="button" class="bt-leg-x" data-rm-leg="' + i + '">×</button></div>';
    }).join('');
    if (ready){
      var allML = legs.every(function(l){ return l.market === 'ML'; });
      h += '<div class="bt-note">' + (allML
        ? 'Verified — each leg grades off its own fight, and <b style="color:var(--accent)">CLV</b> averages across all of them once every leg is in.'
        : '<b style="color:var(--text)">Won\'t count toward CLV.</b> Still <b style="color:var(--accent)">verified</b> — each leg grades off its own fight.') + '</div>';
      h += '<div class="bt-row2"><div><label>Combined odds</label><input type="number" data-p-odds value="' + comb + '"></div>' +
        '<div><label>Stake (units)</label><input type="number" data-p-stake value="1" step="0.5" min="0.5"></div></div>' +
        '<label>Sportsbook (optional)</label><input data-p-book placeholder="e.g. DraftKings" maxlength="40" value="' + esc(legs[0].book || '') + '">' +
        '<button type="button" class="bt-btn" data-submit-parlay>Add parlay</button>';
    } else {
      h += '<div class="bt-note">Pick another fight below and add a second leg.</div>';
    }
    h += '<button type="button" class="bt-btn bt-btn-ghost" data-clear-legs>Clear parlay</button></div>';
    return h;
  }

  function renderLog(host){
    if (!fightsData){ host.innerHTML = '<p class="gl-muted">Loading upcoming fights…</p>'; return; }
    var h = stageHTML() + '<div class="bt-panel"><div class="bt-seg">' +
      '<div class="' + (logKind === 'card' ? 'on' : '') + '" data-kind="card">Upcoming fights</div>' +
      '<div class="' + (logKind === 'custom' ? 'on' : '') + '" data-kind="custom">Custom bet</div>' +
      '<div class="' + (logKind === 'scan' ? 'on' : '') + '" data-kind="scan">Scan a screenshot</div></div>';
    if (logKind === 'scan'){
      h += scanHTML();
    } else if (logKind === 'card'){
      var evs = (fightsData.events || []).filter(function(e){ return e.fights.some(function(f){ return !segStarted(f) || true; }); });
      if (!evs.length){ h += '<div class="bt-empty">No upcoming fights are posted right now.</div>'; }
      else {
        h += '<label>Event</label><select data-esel><option value="">Choose an event…</option>' +
          evs.map(function(e){ return '<option value="' + esc(e.slug) + '"' + (logEventSlug === e.slug ? ' selected' : '') + '>' + esc(e.label) + '</option>'; }).join('') + '</select>';
        var ev = logEventSlug ? eventBySlug(logEventSlug) : null;
        if (ev){
          h += '<label>Fight</label><select data-fsel><option value="">Choose a fight…</option>' +
            ev.fights.map(function(f){ return '<option value="' + esc(f.id) + '"' + (logFight && logFight.id === f.id ? ' selected' : '') + '>' + esc(f.f1) + ' vs ' + esc(f.f2) + '</option>'; }).join('') + '</select>';
        }
        if (logFight){
          var f = logFight, priced = logMarket === 'ML';
          h += '<label>Market</label><select data-mkt>' + Object.keys(BT_MARKETS).map(function(k){ return '<option value="' + k + '"' + (logMarket===k?' selected':'') + '>' + BT_MARKETS[k] + '</option>'; }).join('') + '</select>' + marketFieldsHTML(f);
          h += '<div class="bt-row2"><div><label>Your odds</label><input type="number" data-odds placeholder="-150"></div>' +
            '<div><label>Stake (units)</label><input type="number" data-stake value="1" step="0.5" min="0.5"></div></div>' +
            '<label>Sportsbook (optional)</label><input data-book placeholder="e.g. DraftKings" maxlength="40">';
          h += priced
            ? (segStarted(f)
              ? '<div class="bt-note lock"><b>Won\'t count toward CLV — ' + (f.section === 'main' ? 'main card has started' : 'prelims already started') + '.</b> Still <b style="color:var(--accent)">verified</b>.</div>'
              : '<div class="bt-note">Verified — auto-graded when the fight resolves, with <b style="color:var(--accent)">CLV</b> measured against the closing line.</div>')
            : '<div class="bt-note"><b style="color:var(--text)">Won\'t count toward CLV.</b> This bet is still <b style="color:var(--accent)">verified</b> — auto-graded from the result.</div>';
          if (legs.length) h += '<button type="button" class="bt-btn" data-add-leg>＋ Add leg to parlay</button>';
          else h += '<button type="button" class="bt-btn" data-submit-card>Add bet</button><button type="button" class="bt-btn bt-btn-ghost" data-add-leg>＋ Start a parlay with this</button>';
        }
      }
    } else {
      h += '<label>Matchup / event</label><input data-cmatch placeholder="e.g. Silva vs Jones — PFL 7">' +
        '<label>Your pick + market</label><input data-csel placeholder="e.g. Silva inside the distance">' +
        '<div class="bt-row2"><div><label>Your odds</label><input type="number" data-codds placeholder="-150"></div><div><label>Stake (units)</label><input type="number" data-cstake value="1" step="0.5" min="0.5"></div></div>' +
        '<label>Sportsbook (optional)</label><input data-cbook placeholder="e.g. DraftKings" maxlength="40">' +
        '<div class="bt-note">We don\'t track this fight, so it\'s tagged <b style="color:#ffcf7a">self-reported</b>: you settle it yourself, excluded from verified CLV/ROI.</div>' +
        '<button type="button" class="bt-btn" data-submit-custom>Add bet</button>';
    }
    host.innerHTML = h + '</div>';
  }

  function submitCard(host){
    var f = logFight; if (!f) return;
    var odds = parseInt(host.querySelector('[data-odds]').value, 10);
    var stake = parseFloat(host.querySelector('[data-stake]').value) || 1;
    if (!isFinite(odds) || !odds){ window.GL_NATIVE && window.GL_NATIVE.toast && window.GL_NATIVE.toast('Enter the odds you got.'); alert('Enter the odds you got.'); return; }
    var p = buildPick(f, host);
    var ev = eventBySlug(f.evSlug);
    window.GL_API.betAdd({
      kind: 'tracked', fightId: f.id, market: logMarket, pick: p.pick,
      match: surname(f.f1) + ' vs ' + surname(f.f2) + (ev ? ' · ' + ev.label : ''),
      params: p.p, priced: p.priced, closeSide: p.closeSide, odds: odds, stake: stake,
      book: (host.querySelector('[data-book]') || {}).value || '',
    }).then(function(){ return reloadBets(); }).then(function(){ setView('history'); })
      .catch(function(err){ alert((err && err.data && err.data.error) || 'Could not log that bet.'); });
  }
  function submitCustom(host){
    var m = host.querySelector('[data-cmatch]').value.trim(), pk = host.querySelector('[data-csel]').value.trim();
    var odds = parseInt(host.querySelector('[data-codds]').value, 10), stake = parseFloat(host.querySelector('[data-cstake]').value) || 1;
    if (!m || !pk || !isFinite(odds)){ alert('Fill in the matchup, your pick and the odds.'); return; }
    window.GL_API.betAdd({ kind: 'manual', match: m, pick: pk, odds: odds, stake: stake, book: (host.querySelector('[data-cbook]')||{}).value || '' })
      .then(function(){ return reloadBets(); }).then(function(){ setView('history'); })
      .catch(function(err){ alert((err && err.data && err.data.error) || 'Could not log that bet.'); });
  }
  function submitParlay(host){
    if (legs.length < 2) return;
    var odds = parseInt(host.querySelector('[data-p-odds]').value, 10);
    var stake = parseFloat(host.querySelector('[data-p-stake]').value) || 1;
    if (!isFinite(odds)){ alert('Enter the combined odds.'); return; }
    var ev = eventBySlug(legs[0].evSlug);
    window.GL_API.betAdd({ kind: 'tracked', market: 'PARLAY', legs: legs, match: ev ? ev.label : '', odds: odds, stake: stake, book: (host.querySelector('[data-p-book]')||{}).value || '' })
      .then(function(){ legs = []; return reloadBets(); }).then(function(){ setView('history'); })
      .catch(function(err){ alert((err && err.data && err.data.error) || 'Could not log that parlay.'); });
  }

  // ── Leaderboard + player profile -----------------------------------------
  function renderBoard(host){
    var tab = function(id, label){ return '<button type="button" class="pk-tab' + (boardTab === id ? ' sel' : '') + '" data-board-tab="' + id + '">' + label + '</button>'; };
    var rng = function(k, lbl){ return '<div class="' + (boardRange === k ? 'on' : '') + '" data-board-range="' + k + '">' + lbl + '</div>'; };
    var blurb = boardTab === 'clv' ? 'Implied win probability vs. the closing line, averaged across settled moneylines.'
      : boardTab === 'roi' ? 'Profit as a percentage of everything staked.' : 'Net profit, in units.';
    host.innerHTML = '<div class="pk-tabs">' + tab('units','Units') + tab('roi','ROI') + tab('clv','CLV') + '</div>' +
      '<div class="bt-ranges">' + rng('all','All time') + rng('7d','7D') + rng('30d','30D') + rng('6m','6M') + rng('12m','1Y') + '</div>' +
      '<div class="bt-foot" style="margin:.2rem 0 1rem">Verified, auto-graded bets only. ' + blurb + '</div>' +
      '<div class="pk-board-list" id="bt-board-list"><div class="pk-board-empty">Loading…</div></div>';
    var at = boardTab, ar = boardRange;
    window.GL_API.betLeaderboard(at, ar).then(function(r){
      if (view !== 'board' || boardTab !== at || boardRange !== ar) return;
      var list = activeContainer.querySelector('#bt-board-list'); if (!list) return;
      var rows = r.rows || [], me = r.me, meName = me && me.name;
      if (!rows.length){ list.innerHTML = '<div class="pk-board-empty">No ranked bettors in this range yet.</div>'; return; }
      var fmt = function(row){ return boardTab === 'clv' ? ((row.clv>0?'+':'') + row.clv.toFixed(1) + ' pts') : boardTab === 'roi' ? ((row.roi>0?'+':'') + row.roi.toFixed(1) + '%') : ((row.units>0?'+':'') + row.units.toFixed(1) + 'u'); };
      var col = function(row){ var v = row[boardTab]; return v > 0 ? 'var(--accent)' : v < 0 ? '#ff6b6b' : ''; };
      var rowHTML = function(row, isMe){ return '<button type="button" class="pk-board-row' + (isMe?' me':'') + '" data-open-player="' + esc(row.name) + '">' +
        '<span class="pk-board-rank">' + row.rank + '</span><span class="pk-board-name">' + esc(row.name) + (isMe?' <span class="pk-you">you</span>':'') +
        ' <span style="opacity:.5;font-weight:600">' + row.w + '-' + row.l + '</span></span>' +
        '<span class="pk-board-pts" style="color:' + col(row) + '">' + fmt(row) + '</span><span class="pk-board-chev">›</span></button>'; };
      var out = rows.map(function(row){ return rowHTML(row, meName && row.name === meName); }).join('');
      if (me && !rows.some(function(row){ return row.name === meName; })) out += '<div class="pk-board-sep">···</div>' + rowHTML(me, true);
      list.innerHTML = out;
    }).catch(function(){
      var list = activeContainer.querySelector('#bt-board-list'); if (list) list.innerHTML = '<div class="pk-board-empty">Leaderboard unavailable right now.</div>';
    });
  }
  function playerBetHTML(b){
    var res;
    if (b.status === 'won') res = '<span class="bt-res bt-pos">Won +' + (b.profit==null?'0':u1(b.profit)) + 'u</span>';
    else if (b.status === 'lost') res = '<span class="bt-res bt-neg">Lost ' + (b.profit==null?'0':u1(b.profit)) + 'u</span>';
    else if (b.status === 'void') res = '<span class="bt-res" style="color:var(--muted)">Void</span>';
    else res = '<span class="bt-res" style="color:var(--muted)">Push</span>';
    var line = b.closeOdds != null ? 'You <b>' + fmtOdds(b.odds) + '</b> &rarr; close <b>' + fmtOdds(b.closeOdds) + '</b>' : '<b>' + fmtOdds(b.odds) + '</b>';
    var badge = b.clv != null ? '<span class="bt-badge ' + (b.clv>0?'bt-b-clv':'bt-b-neg') + '">CLV ' + (b.clv>0?'+':'') + b.clv + '</span>' : '';
    return '<div class="bt-bet"><div class="bt-bet-top"><div class="bt-bet-txt"><div class="bt-nm">' + esc(b.pick) + '</div><div class="bt-mk">' + esc(b.match) + '</div></div>' + res + '</div>' +
      '<div class="bt-mid"><div>' + line + ' · ' + u2(b.stake) + 'u</div>' + badge + '</div></div>';
  }
  function playerPendingHTML(b){
    var badge = (b.market === 'PARLAY' && b.legsLive) ? '<span class="bt-badge bt-b-none">' + (b.legsIn||0) + ' of ' + b.legsLive + ' legs in</span>' : '';
    return '<div class="bt-bet"><div class="bt-bet-top"><div class="bt-bet-txt"><div class="bt-nm">' + esc(b.pick) + '</div><div class="bt-mk">' + esc(b.match) + '</div></div>' +
      '<span class="bt-res" style="color:#ffcf7a;font-size:0.8rem">Open</span></div><div class="bt-mid"><div><b>' + fmtOdds(b.odds) + '</b> · ' + u2(b.stake) + 'u</div>' + badge + '</div></div>';
  }
  function openPlayer(name){ playerName = name; setView('player'); }
  function renderPlayer(host, name){
    host.innerHTML = '<button type="button" class="pk-hist-back" data-back-board>&larr; Back to leaderboard</button><div class="pk-board-empty">Loading…</div>';
    window.GL_API.betPlayer(name).then(function(r){
      if (view !== 'player') return;
      var back = '<button type="button" class="pk-hist-back" data-back-board>&larr; Back to leaderboard</button>';
      var st = r.stats, bets = r.bets || [], pending = r.pending || [];
      var h = back + '<div style="font-weight:800;font-size:1.15rem;margin:.5rem 0 .8rem">' + esc(r.name || name) + '</div>';
      if (st){
        var clvTxt = st.avgClv == null ? '—' : (st.avgClv>0?'+':'') + st.avgClv.toFixed(1);
        h += '<div class="bt-grid">' +
          '<div class="bt-tile"><div class="bt-tile-t">Record</div><div class="bt-tile-v">' + st.w + '-' + st.l + '</div></div>' +
          '<div class="bt-tile"><div class="bt-tile-t">ROI</div><div class="bt-tile-v ' + (st.roi>0?'bt-pos':st.roi<0?'bt-neg':'') + '">' + (st.roi==null?'—':(st.roi>0?'+':'')+st.roi.toFixed(1)+'%') + '</div></div>' +
          '<div class="bt-tile"><div class="bt-tile-t">Units</div><div class="bt-tile-v ' + (st.units>0?'bt-pos':st.units<0?'bt-neg':'') + '">' + (st.units>0?'+':'')+st.units.toFixed(1)+'u</div></div>' +
          '<div class="bt-tile"><div class="bt-tile-t">Avg CLV</div><div class="bt-tile-v ' + (st.avgClv<0?'bt-neg':'') + '">' + clvTxt + '</div></div></div>';
      }
      if (pending.length){ h += '<div class="bt-cardhdr"><div class="bt-cardhdr-t">Open bets (' + pending.length + ')</div></div>' + pending.map(playerPendingHTML).join(''); }
      if (bets.length){ h += '<div class="bt-cardhdr"><div class="bt-cardhdr-t">Settled</div></div>' + bets.map(playerBetHTML).join(''); }
      else if (!pending.length) h += '<div class="bt-empty">No bets yet.</div>';
      host.innerHTML = h;
    }).catch(function(){
      host.innerHTML = '<button type="button" class="pk-hist-back" data-back-board>&larr; Back to leaderboard</button><div class="pk-board-empty">Profile unavailable right now.</div>';
    });
  }

  // ── data loading ----------------------------------------------------------
  function reloadBets(){
    return window.GL_API.bets().then(function(r){ betsData = r; return r; }).catch(function(){ betsData = { bets: [], stats: null }; return betsData; });
  }
  function reloadFights(){
    return window.GL_API.betFights().then(function(r){ fightsData = r; return r; }).catch(function(){ fightsData = { events: [] }; return fightsData; });
  }

  // ── one-shot handoff from odds.js's Parlay Builder "Log this bet" --------
  // btLegToBet's site-side equivalent: each PARLAY.legs[] item here already
  // carries betFightId/betEvSlug/betRounds straight off /api/app/odds (see
  // worker/index.js), so this is a direct field mapping, no fuzzy name
  // matching needed the way the site's own btLegToBet requires.
  function legToBet(leg){
    if (!leg.betFightId) return null;
    var side = leg.side === 'f1' ? 1 : 2;
    var nm = side === 1 ? leg.f1name : leg.f2name;
    var base = { fightId: leg.betFightId, evSlug: leg.betEvSlug, match: surname(leg.f1name) + ' vs ' + surname(leg.f2name), odds: Number(leg.odds), book: leg.booklabel || '' };
    if (leg.mkt === 'ml') return Object.assign({}, base, { market: 'ML', params: { side: side }, pick: surname(nm) + ' ML' });
    if (leg.mkt === 'total'){ var ou = /^o/i.test(leg.ou || '') ? 'O' : 'U';
      return Object.assign({}, base, { market: 'TOTAL', params: { line: Number(leg.line), ou: ou }, pick: (ou==='O'?'Over ':'Under ') + leg.line + ' rounds' }); }
    if (leg.mkt === 'method'){ var m = leg.method === 'ko' ? 'KO' : leg.method === 'sub' ? 'SUB' : 'DEC';
      return Object.assign({}, base, { market: 'METHOD', params: { side: side, methodCat: m }, pick: surname(nm) + ' by ' + BT_METH[m] }); }
    if (leg.mkt === 'round') return Object.assign({}, base, { market: 'ENDROUND', params: { side: side, meth: 'ANY', round: Number(leg.round) }, pick: surname(nm) + ' to win in round ' + leg.round });
    if (leg.mkt === 'dblchance'){
      var DM = { koSub: { methods:['KO','SUB'], lab:'KO/TKO or submission' }, koDec: { methods:['KO','DEC'], lab:'KO/TKO or decision' }, subDec: { methods:['SUB','DEC'], lab:'submission or decision' } }[leg.method];
      if (!DM) return null;
      return Object.assign({}, base, { market: 'DBLMETH', params: { side: side, methods: DM.methods }, pick: surname(nm) + ' by ' + DM.lab });
    }
    return null;
  }
  function applyPrefill(){
    if (!pendingPrefill) return;
    var rawLegs = pendingPrefill.legs || [];
    pendingPrefill = null;
    var out = [];
    for (var i = 0; i < rawLegs.length; i++){
      var b = legToBet(rawLegs[i]);
      if (!b){ alert("Couldn't match one of those picks to a trackable fight."); return; }
      out.push(b);
    }
    if (!out.length) return;
    if (out.length > 1){ legs = out; logKind = 'card'; return; }
    var single = out[0];
    var f = findFight(single.fightId);
    if (f){ logEventSlug = f.evSlug; logFight = f; logMarket = single.market; }
  }

  // ── locked state (mirrors odds.js) ---------------------------------------
  function lockedHTML(){
    return '<div class="fp-lock">' +
      '<div class="fp-lock-h"><span class="fp-lock-ico">🔒</span><div class="fp-lock-t">Bet Tracker &amp; CLV</div></div>' +
      '<div class="gl-muted" style="margin:.2rem 0 .8rem">Everything GillyLab Premium unlocks here:</div>' +
      '<div class="fp-lock-grid">' +
        '<div class="fp-lock-i"><div class="fp-lock-it">Auto-graded bets</div><div class="fp-lock-id">Log a bet on any tracked fight and it grades itself the moment the result lands.</div></div>' +
        '<div class="fp-lock-i"><div class="fp-lock-it">Closing line value</div><div class="fp-lock-id">See how your price compared to the close on every moneyline you logged.</div></div>' +
        '<div class="fp-lock-i"><div class="fp-lock-it">Record, ROI &amp; units</div><div class="fp-lock-id">A running tally across every bet, verified and self-reported alike.</div></div>' +
        '<div class="fp-lock-i"><div class="fp-lock-it">Leaderboard</div><div class="fp-lock-id">See where your CLV, ROI and units stack up against other cappers.</div></div>' +
      '</div>' +
      '<button type="button" class="gl-btn gl-btn-primary" data-goto="premium">Go Premium for the Bet Tracker</button>' +
      '</div>';
  }

  // ── event delegation (container-scoped -- torn down each navigation) ----
  var bound = false;
  function bind(container){
    if (bound) return;
    bound = true;
    function hit(e, sel){ return e.target && e.target.closest ? e.target.closest(sel) : null; }
    container.addEventListener('click', function(e){
      var t;
      if ((t = hit(e, '[data-goto]'))){ window.GL_NATIVE.tap(); window.GL_ROUTER.go(t.getAttribute('data-goto')); return; }
      if ((t = hit(e, '[data-view]'))){ window.GL_NATIVE.tap(); setView(t.getAttribute('data-view')); return; }
      if ((t = hit(e, '[data-back-odds]'))){ window.GL_NATIVE.tap(); window.GL_ROUTER.back(); return; }
      if ((t = hit(e, '[data-scope]'))){ hScope = t.getAttribute('data-scope'); renderView(); return; }
      if ((t = hit(e, '[data-range]'))){ hRange = t.getAttribute('data-range'); renderView(); return; }
      if ((t = hit(e, '[data-tab]'))){ hTab = t.getAttribute('data-tab'); hCard = 'all'; renderView(); return; }
      if ((t = hit(e, '[data-card]'))){ hCard = t.getAttribute('data-card'); renderView(); return; }
      if ((t = hit(e, '[data-settle]'))){ var id = t.getAttribute('data-settle'), st = t.getAttribute('data-status');
        window.GL_API.betSettle(id, st).then(function(){ return reloadBets(); }).then(renderView).catch(function(err){ alert((err && err.data && err.data.error) || 'Could not settle that bet.'); }); return; }
      if ((t = hit(e, '[data-edit-open]'))){ editId = t.getAttribute('data-edit-open'); renderView(); return; }
      if (hit(e, '[data-edit-cancel]')){ editId = null; renderView(); return; }
      if ((t = hit(e, '[data-edit-save]'))){
        var id2 = t.getAttribute('data-edit-save'), row = t.closest('.bt-bet');
        var odds = parseInt(row.querySelector('[data-e-odds]').value, 10), stake = parseFloat(row.querySelector('[data-e-stake]').value), book = row.querySelector('[data-e-book]').value;
        if (!isFinite(odds) || !odds){ alert('Enter the odds you got.'); return; }
        window.GL_API.betEdit(id2, odds, stake, book).then(function(){ editId = null; return reloadBets(); }).then(renderView).catch(function(err){ alert((err && err.data && err.data.error) || 'Could not edit that bet.'); });
        return;
      }
      if ((t = hit(e, '[data-delete]'))){
        if (!confirm('Delete this bet?')) return;
        window.GL_API.betDelete(t.getAttribute('data-delete')).then(function(){ return reloadBets(); }).then(renderView).catch(function(err){ alert((err && err.data && err.data.error) || 'Could not delete that bet.'); });
        return;
      }
      if ((t = hit(e, '[data-card-select]'))) return; // handled by change listener
      if ((t = hit(e, '[data-kind]'))){ logKind = t.getAttribute('data-kind'); renderView(); return; }
      if ((t = hit(e, '[data-rm-leg]'))){ legs.splice(Number(t.getAttribute('data-rm-leg')), 1); renderView(); return; }
      if (hit(e, '[data-clear-legs]')){ legs = []; renderView(); return; }
      if ((t = hit(e, '[data-add-leg]'))){
        var f = logFight; if (!f) return;
        var host = activeContainer.querySelector('#bt-body');
        var odds = parseInt(host.querySelector('[data-odds]').value, 10);
        if (!isFinite(odds) || !odds){ alert('Enter the odds you got for this leg.'); return; }
        var p = buildPick(f, host);
        var leg = { fightId: f.id, evSlug: f.evSlug, market: logMarket, params: p.p, pick: p.pick, match: surname(f.f1) + ' vs ' + surname(f.f2), odds: odds };
        var err = legErr(leg); if (err){ alert(err); return; }
        legs.push(leg); logFight = null; logMarket = 'ML'; renderView(); return;
      }
      if (hit(e, '[data-submit-card]')){ submitCard(activeContainer.querySelector('#bt-body')); return; }
      if (hit(e, '[data-submit-custom]')){ submitCustom(activeContainer.querySelector('#bt-body')); return; }
      if (hit(e, '[data-submit-parlay]')){ submitParlay(activeContainer.querySelector('#bt-body')); return; }
      if ((t = hit(e, '[data-board-tab]'))){ boardTab = t.getAttribute('data-board-tab'); renderView(); return; }
      if ((t = hit(e, '[data-board-range]'))){ boardRange = t.getAttribute('data-board-range'); renderView(); return; }
      if ((t = hit(e, '[data-open-player]'))){ window.GL_NATIVE.tap(); openPlayer(t.getAttribute('data-open-player')); return; }
      if (hit(e, '[data-back-board]')){ window.GL_NATIVE.tap(); setView('board'); return; }
      if (hit(e, '[data-scan-choose]')){ var fi = activeContainer.querySelector('[data-scan-files]'); if (fi) fi.click(); return; }
      if (hit(e, '[data-scan-more]')){ scanQueue = []; scanIdx = 0; renderView(); return; }
      if (hit(e, '[data-scan-skip]')){ window.GL_NATIVE.tap(); scanSkip(); return; }
      if (hit(e, '[data-scan-confirm]')){ scanConfirm(activeContainer.querySelector('#bt-body')); return; }
      if (hit(e, '[data-scan-confirm-tracked]')){ scanConfirmTracked(activeContainer.querySelector('#bt-body')); return; }
    });
    container.addEventListener('change', function(e){
      var t = e.target;
      if (!t) return;
      if (t.matches('[data-esel]')){ logEventSlug = t.value || null; logFight = null; logMarket = 'ML'; renderView(); return; }
      if (t.matches('[data-fsel]')){ logFight = findFight(t.value) || null; logMarket = 'ML'; lastSide = null; renderView(); return; }
      if (t.matches('[data-mkt]')){ logMarket = t.value; renderView(); return; }
      if (t.matches('[data-card-select]')){ hCard = t.value; renderView(); return; }
      if (t.matches('[data-mlwin],[data-mfr],[data-erf],[data-wrf],[data-mrf],[data-dcf],[data-ndf]')){ lastSide = (+t.value === 2) ? 2 : 1; return; }
      if (t.matches('[data-scan-files]')){ pickScanFiles(t.files); return; }
    });
  }

  // ── boot -------------------------------------------------------------------
  function load(container, params){
    var mySeq = ++loadSeq;
    activeContainer = container;
    bound = false;
    container.innerHTML = '<p class="gl-muted">Loading…</p>';
    if (params && params.legs){ pendingPrefill = params; fromOdds = true; }
    window.GL_API.account().catch(function(){ return null; }).then(function(acct){
      if (mySeq !== loadSeq) return;
      var subscribed = !!(acct && acct.subscribed);
      if (!subscribed){
        container.innerHTML = lockedHTML();
        var gp = container.querySelector('[data-goto="premium"]');
        if (gp) gp.addEventListener('click', function(){ window.GL_NATIVE.tap(); window.GL_ROUTER.go('premium'); });
        return;
      }
      view = 'history'; hScope = 'verified'; hRange = 'all'; hTab = 'active'; hCard = 'all'; editId = null;
      logKind = 'card'; logEventSlug = null; logFight = null; logMarket = 'ML'; lastSide = null; legs = [];
      boardTab = 'units'; boardRange = 'all'; scanQueue = []; scanIdx = 0;
      Promise.all([reloadBets(), reloadFights()]).then(function(){
        if (mySeq !== loadSeq) return;
        applyPrefill();
        if (legs.length || logFight) view = 'log';
        bind(container);
        renderShell();
      });
    });
  }

  return { load: load };
})();
