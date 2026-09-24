// Real, native Pick'em -- not an iframe. An earlier version of this screen
// iframed the live gillylab.com/pickem page (see git history), reasoning
// that its scoring/card logic shouldn't be reimplemented a second time. That
// broke on a real device: the site's session cookie is SameSite=Lax, and a
// SameSite=Lax cookie is never sent on an iframe's cross-origin navigation,
// by spec, in every browser engine -- confirmed via on-device testing, not
// just reasoned about. The iframe kept hitting the real site's own /signup
// page as if logged out, no matter how many times you signed up in the app.
//
// This version calls the same JSON endpoints the live page's own client JS
// calls (GET /api/app/pickem-card for the card+scoring table, GET/POST
// /api/pickem/name, GET /api/pickem/mine, POST /api/pickem/save, GET
// /api/pickem/leaderboard, GET /api/pickem/history) -- all of which already
// accept the app's bearer token via readSession's existing fallback, and are
// now CORS-enabled for the app's origin (see appCorsHeaders in
// worker/index.js). Plain fetch() calls, no cookie involved at all.
//
// The scoring math (wPts/mPts/rPts × confidence multiplier) mirrors the
// live page's own client script exactly -- pulled from gillylab.com/pickem's
// rendered output while building this, not guessed.
window.GL_ROUTER.register('pickem', {
  title: "Pick'em",
  tab: 'pickem',
  render: function(container){
    window.GL_AUTH.ready.then(function(){
      if (!window.GL_AUTH.isLoggedIn()){
        container.innerHTML =
          '<div class="gl-locked">' +
            '<svg viewBox="0 0 24 24"><path d="M6 10V8a6 6 0 0 1 12 0v2" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="4.5" y="10" width="15" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>' +
            '<div><strong style="color:var(--text)">Free account required</strong><br>Browsing is always free -- playing Pick’em and the Legends Bracket needs a quick free account.</div>' +
          '</div>' +
          '<div id="pickemAuthForm"></div>';
        window.GL_LOGIN_FORM(container.querySelector('#pickemAuthForm'), {
          onSuccess: function(){ window.GL_ROUTER.go('pickem'); }
        });
        return;
      }
      mountPickem(container);
    });
  }
});

function mountPickem(container){
  container.innerHTML = '<p class="gl-muted">Loading this week’s card…</p>';

  // Same /photos/thumb/<slug>.png convention the website itself uses (see the
  // PUBLIC_ASSETS allowlist in worker/index.js) -- absolute, since the app is
  // a different origin. onerror="this.remove()" on each <img> above means a
  // fighter with no photo on file just shows the name, not a broken-image icon.
  var FIGHTER_PHOTO_BASE = window.GL_API.BASE + '/photos/thumb/';
  var CONF_MULT = { High: 2, Med: 1.5, Low: 1 };
  var card = null, score = {}, picks = {}, name = null, locked = false;
  var submitted = false, dirty = false, inFlight = false;

  function sideOf(bout, winnerName){ return winnerName === bout.f1 ? 'f1' : 'f2'; }
  function partsFor(id, side, method, round){
    var sc = score[id];
    if (!sc) return { wPts:0, mPts:0, rPts:0 };
    var wPts = (sc.wPts && sc.wPts[side]) || 0;
    var mPts = (method && sc.mPts && sc.mPts[side]) ? (sc.mPts[side][method] || 0) : 0;
    var rPts = (method && method !== 'Decision' && round && sc.rPts) ? (sc.rPts[String(round)] || 0) : 0;
    return { wPts:wPts, mPts:mPts, rPts:rPts };
  }
  function potential(p){
    if (!p || !p.winner) return 0;
    var pt = partsFor(p.boutId, p.side, p.method, p.round);
    var m = CONF_MULT[p.confidence] || CONF_MULT.Med;
    return Math.round((pt.wPts + pt.mPts + pt.rPts) * m);
  }
  function isComplete(p){ return !!(p && p.winner && p.method && p.confidence && (p.method === 'Decision' || p.round)); }

  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]; }); }

  // Two-letter initials fallback (e.g. "Quentin Pasley" -> "QP") for a
  // fighter with no photo on file. The initials sit underneath the <img> the
  // whole time; onerror just hides the image so they show through, rather
  // than leaving a blank gap where a photo would have been.
  function initials(name){
    var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  function avatarHtml(slug, name){
    return (
      '<span class="pk-fighter-avatar">' +
        '<span class="pk-fighter-initials">' + esc(initials(name)) + '</span>' +
        (slug ? '<img class="pk-fighter-photo" src="' + FIGHTER_PHOTO_BASE + esc(slug) + '.png" alt="" onerror="this.style.display=\'none\'">' : '') +
      '</span>'
    );
  }

  function renderShell(){
    var lockedNote = locked ? '<p class="gl-error" style="margin-top:.3rem">Picks are locked -- prelims have started.</p>' : '';
    container.innerHTML =
      '<div class="gl-card" style="margin-bottom:.7rem">' +
        '<h2 class="gl-heading" style="margin:0 0 .2rem;font-size:1.1rem">' + esc(card.name) + '</h2>' +
        '<p class="gl-muted" style="margin:0">' + esc(card.date) + '</p>' +
        lockedNote +
      '</div>' +
      (name ? '' :
        '<div class="gl-card" id="pkNameCard">' +
          '<div class="gl-label">Pick a display name</div>' +
          '<p class="gl-muted" style="margin:0 0 .6rem">This is how you show up on the leaderboard.</p>' +
          '<input class="gl-field" id="pkNameInput" maxlength="20" placeholder="e.g. KO_Merchant" autocomplete="off">' +
          '<div class="gl-error" id="pkNameErr" hidden></div>' +
          '<button class="gl-btn gl-btn-outline" id="pkNameSave" type="button">Save name</button>' +
        '</div>') +
      '<div class="pk-subnav">' +
        '<button type="button" class="gl-btn gl-btn-outline" id="pkOpenLb" style="flex:1">🏆 Leaderboard</button>' +
        '<button type="button" class="gl-btn gl-btn-outline" id="pkOpenHist" style="flex:1">📊 My history</button>' +
      '</div>' +
      '<div id="pkBouts"></div>' +
      '<div class="pk-submitbar">' +
        '<div class="gl-muted" id="pkBarInfo">0/' + card.bouts.length + ' picks · +0 possible</div>' +
        '<button type="button" class="gl-btn gl-btn-primary" id="pkSubmit" disabled>Submit picks</button>' +
      '</div>' +
      (window.GL_SHEET ? '<button type="button" class="gl-sheet-btn" id="pkShareBtn" hidden>Share picks</button>' : '') +
      '<div id="pkPanel" hidden></div>';

    renderBouts();
    wireShell();
    updateShareBtn();
  }
  // Mirrors the site's data-pk-share button on the live event page -- shown
  // once picks are actually submitted, since a share sheet of half-finished
  // picks isn't useful. Unlike the site (whose one button flips between
  // "Share picks"/"Share results" depending on whether BOUTS.every(isDone)),
  // this screen never shows graded results itself -- that's My History's job
  // (see the separate share button in showHistoryEvent below) -- so here it's
  // always "Share picks", ungraded.
  function updateShareBtn(){
    var btn = container.querySelector('#pkShareBtn');
    if (!btn) return;
    btn.hidden = !submitted;
  }
  function sharePicks(){
    if (!window.GL_SHEET) return;
    window.GL_NATIVE.tap();
    var picksOut = card.bouts.map(function(b){
      var p = picks[b.id];
      if (!p || !p.winner) return null;
      var winnerIsF1 = p.winner === b.f1;
      return {
        winner: p.winner, loser: winnerIsF1 ? b.f2 : b.f1,
        winnerSlug: winnerIsF1 ? b.s1 : b.s2, loserSlug: winnerIsF1 ? b.s2 : b.s1,
        method: p.method || null, round: p.round || null, confidence: p.confidence || 'Med',
      };
    }).filter(Boolean);
    if (!picksOut.length) return;
    window.GL_SHEET.pickem({
      name: name, eventName: card.name, eventDate: card.date,
      graded: false, picks: picksOut,
    }).catch(function(){});
  }

  function renderBouts(){
    var host = container.querySelector('#pkBouts');
    if (!host) return;
    host.innerHTML = card.bouts.map(function(b){
      var p = picks[b.id];
      var winner = p && p.winner;
      var f1sel = winner === b.f1, f2sel = winner === b.f2;
      var showDetail = !!winner && !locked;
      var pts = !winner ? 'Tap a fighter to pick the winner'
        : (isComplete(p) ? 'Total possible points: <strong>' + potential(p) + '</strong>'
           : '<span class="gl-error" style="margin:0">Still need ' + (!p.method ? 'method' : 'round') + '</span>');
      return (
        '<div class="pk-bout gl-card" data-bout="' + b.id + '">' +
          '<div class="pk-bout-head"><span class="gl-label" style="margin:0">' + esc(b.wc || '') + '</span></div>' +
          '<div class="pk-fighters">' +
            '<button type="button" class="pk-fighter' + (f1sel ? ' sel' : '') + '" data-pick="' + esc(b.f1) + '"' + (locked ? ' disabled' : '') + '>' +
              avatarHtml(b.s1, b.f1) +
              '<span>' + esc(b.f1) + '</span>' +
            '</button>' +
            '<button type="button" class="pk-fighter' + (f2sel ? ' sel' : '') + '" data-pick="' + esc(b.f2) + '"' + (locked ? ' disabled' : '') + '>' +
              avatarHtml(b.s2, b.f2) +
              '<span>' + esc(b.f2) + '</span>' +
            '</button>' +
          '</div>' +
          (showDetail ?
            '<div class="pk-row"><span class="pk-row-label">Method</span><div class="pk-seg" data-role="method">' +
              ['KO/TKO','Submission','Decision'].map(function(m){ return '<button type="button" data-method="' + m + '" class="' + (p.method === m ? 'sel' : '') + '">' + m + '</button>'; }).join('') +
            '</div></div>' +
            (p.method && p.method !== 'Decision' ?
              '<div class="pk-row"><span class="pk-row-label">Round</span><div class="pk-seg" data-role="round">' +
                ['1','2','3'].map(function(r){ return '<button type="button" data-round="' + r + '" class="' + (String(p.round) === r ? 'sel' : '') + '">R' + r + '</button>'; }).join('') +
              '</div></div>' : '') +
            '<div class="pk-row"><span class="pk-row-label">Confidence</span><div class="pk-seg" data-role="conf">' +
              ['High','Med','Low'].map(function(c){ return '<button type="button" data-c="' + c + '" class="' + (p.confidence === c ? 'sel' : '') + '">' + c + '</button>'; }).join('') +
            '</div></div>'
            : '') +
          '<div class="pk-bout-foot"><span class="gl-muted" style="margin:0">' + pts + '</span>' +
            (winner && !locked ? '<button type="button" class="pk-clear" data-clear="' + b.id + '">Clear</button>' : '') +
          '</div>' +
        '</div>'
      );
    }).join('');

    host.querySelectorAll('.pk-fighter').forEach(function(btn){
      btn.addEventListener('click', function(){
        window.GL_NATIVE.tap();
        var el = btn.closest('.pk-bout'); var id = el.getAttribute('data-bout');
        var b = card.bouts.filter(function(x){ return x.id === id; })[0];
        var p = picks[id] || (picks[id] = { boutId:id });
        var pick = btn.getAttribute('data-pick');
        if (p.winner === pick){ delete picks[id]; }
        else { p.winner = pick; p.side = sideOf(b, pick); if (!p.confidence) p.confidence = 'Med'; }
        dirty = true; renderBouts(); updateBar();
      });
    });
    host.querySelectorAll('[data-method]').forEach(function(btn){
      btn.addEventListener('click', function(){
        window.GL_NATIVE.tap();
        var el = btn.closest('.pk-bout'); var id = el.getAttribute('data-bout');
        var p = picks[id]; if (!p) return;
        p.method = btn.getAttribute('data-method');
        if (p.method === 'Decision') p.round = null;
        dirty = true; renderBouts(); updateBar();
      });
    });
    host.querySelectorAll('[data-round]').forEach(function(btn){
      btn.addEventListener('click', function(){
        window.GL_NATIVE.tap();
        var el = btn.closest('.pk-bout'); var id = el.getAttribute('data-bout');
        var p = picks[id]; if (!p) return;
        p.round = parseInt(btn.getAttribute('data-round'), 10);
        dirty = true; renderBouts(); updateBar();
      });
    });
    host.querySelectorAll('[data-c]').forEach(function(btn){
      btn.addEventListener('click', function(){
        window.GL_NATIVE.tap();
        var el = btn.closest('.pk-bout'); var id = el.getAttribute('data-bout');
        var p = picks[id]; if (!p) return;
        p.confidence = btn.getAttribute('data-c');
        dirty = true; renderBouts(); updateBar();
      });
    });
    host.querySelectorAll('[data-clear]').forEach(function(btn){
      btn.addEventListener('click', function(){
        window.GL_NATIVE.tap();
        delete picks[btn.getAttribute('data-clear')];
        dirty = true; renderBouts(); updateBar();
      });
    });
  }

  function updateBar(){
    var total = card.bouts.length, done = 0, stake = 0;
    card.bouts.forEach(function(b){ var p = picks[b.id]; if (isComplete(p)) done++; if (p && p.winner) stake += potential(p); });
    var info = container.querySelector('#pkBarInfo');
    if (info) info.textContent = done + '/' + total + ' picks · +' + stake + ' possible';
    var btn = container.querySelector('#pkSubmit');
    // inFlight is an explicit flag, not text-sniffing -- the whole point of
    // this branch existing is so the *same* call that clears "Submitting…"
    // (the save's success/failure handler) can still update the label. The
    // old version checked the button's own text for "Submitting" to avoid
    // clobbering it mid-request, which also blocked the one call meant to
    // clear it -- the button froze on "Submitting…" forever even though the
    // save had already succeeded (confirmed: state was correct on the next
    // screen render, only the live label was stuck).
    if (btn && !inFlight){
      if (locked){ btn.textContent = 'Locked'; btn.disabled = true; btn.classList.remove('gl-btn-notready'); }
      else if (submitted && !dirty){ btn.textContent = 'Picks submitted ✓'; btn.disabled = true; btn.classList.remove('gl-btn-notready'); }
      else {
        btn.textContent = submitted ? 'Update picks' : 'Submit picks';
        // Not a real `disabled` -- a genuinely disabled button never fires a
        // click at all, which means tapping it looks exactly like a bug
        // (nothing happens, no explanation). Left clickable and just dimmed,
        // so the click handler itself can tell the person what's missing.
        var notReady = done < total || !name;
        btn.disabled = false;
        btn.classList.toggle('gl-btn-notready', notReady);
      }
    }
  }

  function wireShell(){
    updateBar();
    var shareBtn = container.querySelector('#pkShareBtn');
    if (shareBtn) shareBtn.addEventListener('click', sharePicks);
    var nameSave = container.querySelector('#pkNameSave');
    if (nameSave){
      nameSave.addEventListener('click', function(){
        window.GL_NATIVE.tap();
        var input = container.querySelector('#pkNameInput');
        var errEl = container.querySelector('#pkNameErr');
        var val = (input.value || '').trim();
        errEl.hidden = true;
        window.GL_API.pickemSetName(val).then(function(res){
          name = res.name;
          renderShell();
        }).catch(function(err){
          errEl.textContent = (err && err.data && err.data.error) || 'Could not save that name.';
          errEl.hidden = false;
        });
      });
    }
    var submitBtn = container.querySelector('#pkSubmit');
    if (submitBtn){
      submitBtn.addEventListener('click', function(){
        window.GL_NATIVE.tap();
        if (inFlight || submitBtn.disabled) return;
        // Not truly disabled (see updateBar) -- just dimmed -- specifically
        // so this branch can run and explain why, instead of a real
        // `disabled` button silently swallowing the tap.
        if (submitBtn.classList.contains('gl-btn-notready')){
          var total = card.bouts.length, done = 0;
          card.bouts.forEach(function(b){ if (isComplete(picks[b.id])) done++; });
          var msg = !name ? 'Save a display name above first.'
            : done < total ? 'Finish every fight before submitting (' + done + '/' + total + ' done).'
            : '';
          if (msg){
            var info = container.querySelector('#pkBarInfo');
            if (info) info.innerHTML = '<span class="gl-error" style="margin:0">' + esc(msg) + '</span>';
          }
          return;
        }
        var payload = { eventSlug: card.slug, eventName: card.name, eventDate: card.date, prelimsAt: card.prelimsAt, picks: [] };
        card.bouts.forEach(function(b){
          var p = picks[b.id]; if (!isComplete(p)) return;
          var pt = partsFor(b.id, p.side, p.method, p.round);
          payload.picks.push({ f1:b.f1, f2:b.f2, winner:p.winner, method:p.method, round: p.method !== 'Decision' ? p.round : null, confidence:p.confidence, wPts:pt.wPts, mPts:pt.mPts, rPts:pt.rPts });
        });
        if (!payload.picks.length) return;
        inFlight = true;
        submitBtn.disabled = true; submitBtn.textContent = 'Submitting…';
        window.GL_API.pickemSave(payload).then(function(res){
          inFlight = false;
          if (res && res.ok){ submitted = true; dirty = false; }
          updateBar();
          updateShareBtn();
        }).catch(function(err){
          inFlight = false;
          if (err && err.data && err.data.error === 'needs-name'){ name = null; renderShell(); return; }
          if (err && err.data && err.data.locked){ locked = true; }
          updateBar();
        });
      });
    }
    var openLb = container.querySelector('#pkOpenLb');
    if (openLb) openLb.addEventListener('click', function(){ window.GL_NATIVE.tap(); showLeaderboard(); });
    var openHist = container.querySelector('#pkOpenHist');
    if (openHist) openHist.addEventListener('click', function(){ window.GL_NATIVE.tap(); showHistory(); });
  }

  // ── Leaderboard scope tabs + live auto-refresh -----------------------------
  // Mirrors the site's PK_LB_SCOPE/pkBoardPaint (index.html ~8433-8491): the
  // "current" scope grades the in-progress card live off the results feed, so
  // it's worth polling every 45s while that tab is actually on screen. Unlike
  // matchup.js's live-card poll (which guards on `container.isConnected` --
  // container there is the router's #app element, which is never itself
  // removed, only emptied), the element this guards on is the leaderboard
  // list <div> created fresh inside the panel each time showLeaderboard()
  // runs -- that element genuinely goes stale/disconnected the moment the
  // panel is replaced (switching scope, opening a player, backing out to
  // picks, or the router clearing #app on navigation away), so checking
  // *its* isConnected actually detects "nobody's looking at this anymore",
  // which a check on the never-removed container element would not.
  var PK_LB_SCOPE = 'current';
  var PK_LB_TIMER = null;
  function pkClearLbTimer(){ if (PK_LB_TIMER){ clearInterval(PK_LB_TIMER); PK_LB_TIMER = null; } }

  function showPanel(html, opts){
    opts = opts || {};
    var panel = container.querySelector('#pkPanel');
    var bouts = container.querySelector('#pkBouts');
    var bar = container.querySelector('.pk-submitbar');
    var subnav = container.querySelector('.pk-subnav');
    var nameCard = container.querySelector('#pkNameCard');
    [bouts, bar, subnav, nameCard].forEach(function(el){ if (el) el.hidden = true; });
    panel.hidden = false;
    panel.innerHTML = '<button type="button" class="gl-btn gl-btn-outline" id="pkBack" style="margin-bottom:.8rem">' + esc(opts.backLabel || '← Back to picks') + '</button>' + html;
    container.querySelector('#pkBack').addEventListener('click', function(){
      window.GL_NATIVE.tap();
      if (opts.onBack){ opts.onBack(); return; }
      pkClearLbTimer();
      panel.hidden = true;
      [bouts, bar, subnav, nameCard].forEach(function(el){ if (el) el.hidden = false; });
    });
  }

  // Shared with showPlayerProfile()/showHistory() -- same fields+layout as
  // the site's pkStatsHead/pkRankBadges (index.html ~8319-8339).
  function statsHeadHtml(res){
    var pct = function(n, d){ return d ? Math.round(100 * n / d) + '%' : '—'; };
    var n = (res.events || []).length;
    var badges = [];
    if (res.rankAll) badges.push('All-time #' + res.rankAll);
    if (res.rankLast5) badges.push('Last 5 #' + res.rankLast5);
    return '<div class="pk-hist-head">' +
      (res.name ? '<div class="pk-hist-name">' + esc(res.name) + '</div>' : '') +
      (badges.length ? '<div class="pk-hist-ranks">' + badges.map(function(p){ return '<span class="pk-rank-badge">' + esc(p) + '</span>'; }).join('') + '</div>' : '') +
      '<div class="pk-hist-total"><span class="pk-hist-total-num">' + (res.total || 0) + '</span>' +
      '<span class="pk-hist-total-lbl">total points · ' + n + ' card' + (n === 1 ? '' : 's') + '</span></div>' +
      '<div class="pk-hist-stats">' +
        '<div class="pk-hist-stat"><span class="pk-hist-stat-num">' + (res.correct || 0) + '/' + (res.decided || 0) + '</span>' +
          '<span class="pk-hist-stat-lbl">picks correct · ' + pct(res.correct, res.decided) + '</span></div>' +
        '<div class="pk-hist-stat"><span class="pk-hist-stat-num">' + (res.dogCorrect || 0) + '/' + (res.dogPicks || 0) + '</span>' +
          '<span class="pk-hist-stat-lbl">underdogs hit · ' + pct(res.dogCorrect, res.dogPicks) + '</span></div>' +
      '</div></div>';
  }

  function showLeaderboard(scope){
    PK_LB_SCOPE = scope || PK_LB_SCOPE || 'current';
    pkClearLbTimer();
    var tabs = [['current', 'This card'], ['last5', 'Last 5'], ['all', 'All-time']].map(function(t){
      return '<button type="button" class="pk-tab' + (PK_LB_SCOPE === t[0] ? ' sel' : '') + '" data-lb-scope="' + t[0] + '">' + t[1] + '</button>';
    }).join('');
    showPanel(
      '<div class="pk-tabs">' + tabs + '</div>' +
      '<div id="pkLbStatus"></div>' +
      '<div class="pk-board-list" id="pkLbList"><div class="pk-board-empty">Loading…</div></div>'
    );
    container.querySelectorAll('[data-lb-scope]').forEach(function(btn){
      btn.addEventListener('click', function(){
        window.GL_NATIVE.tap();
        showLeaderboard(btn.getAttribute('data-lb-scope'));
      });
    });
    pkPaintLeaderboard();
    // Same 45s cadence as the site (index.html ~8450). Only "current" is a
    // live-graded board -- last5/all only change once a card finishes.
    if (PK_LB_SCOPE === 'current') PK_LB_TIMER = setInterval(pkPaintLeaderboard, 45000);
  }

  function pkPaintLeaderboard(){
    var scope = PK_LB_SCOPE;
    window.GL_API.pickemLeaderboard(scope).then(function(res){
      var listEl = container.querySelector('#pkLbList');
      if (!listEl || !listEl.isConnected){ pkClearLbTimer(); return; }   // panel gone/replaced
      if (scope !== PK_LB_SCOPE) return;                                 // user switched tabs mid-fetch
      var statusEl = container.querySelector('#pkLbStatus');
      var rows = res.rows || [];
      if (statusEl){
        if (scope === 'current' && res.event){
          var badge = res.live ? '<span class="pk-live-badge">● LIVE</span>' : '<span class="pk-final-badge">Final</span>';
          var prog = res.total ? ((res.decided || 0) + ' of ' + res.total + ' fights scored') : '';
          statusEl.innerHTML = '<div class="pk-board-status-row">' + badge +
            '<span class="pk-board-event">' + esc(res.event) + '</span>' +
            (prog ? '<span class="pk-board-prog">' + esc(prog) + '</span>' : '') + '</div>';
        } else statusEl.innerHTML = '';
      }
      if (!rows.length){
        listEl.innerHTML = '<div class="pk-board-empty">' + (scope === 'current'
          ? (res.event ? 'No fights scored yet -- standings update as results come in.' : 'No card in progress. Try Last 5 or All-time.')
          : 'No graded picks yet -- check back after the next card.') + '</div>';
        return;
      }
      var meName = res.me && res.me.name;
      var rowHtml = function(r, me){
        return '<button type="button" class="pk-board-row' + (me ? ' me' : '') + '" data-player="' + esc(r.name) + '">' +
          '<span class="pk-board-rank">' + r.rank + '</span>' +
          '<span class="pk-board-name">' + esc(r.name) + (me ? ' <span class="pk-you">you</span>' : '') + '</span>' +
          '<span class="pk-board-pts">' + r.points + '</span><span class="pk-board-chev">›</span></button>';
      };
      var out = rows.map(function(r){ return rowHtml(r, meName && r.name === meName); }).join('');
      if (res.me && !rows.some(function(r){ return r.name === meName; })) out += '<div class="pk-board-sep">···</div>' + rowHtml(res.me, true);
      listEl.innerHTML = out;
      listEl.querySelectorAll('[data-player]').forEach(function(btn){
        btn.addEventListener('click', function(){
          window.GL_NATIVE.tap();
          showPlayerProfile(btn.getAttribute('data-player'));
        });
      });
    }).catch(function(err){
      var listEl = container.querySelector('#pkLbList');
      if (!listEl || !listEl.isConnected){ pkClearLbTimer(); return; }
      if (scope !== PK_LB_SCOPE) return;
      if (err && err.status === 401) pkClearLbTimer();
      listEl.innerHTML = '<div class="pk-board-empty">Leaderboard unavailable right now.</div>';
    });
  }

  // ── Player profile (opened from a leaderboard name) ------------------------
  // Mirrors openPickemPlayer/renderPickemPlayer (index.html ~8494-8516).
  function showPlayerProfile(name){
    showPanel('<div class="pk-board-empty">Loading…</div>', { backLabel: '← Back to leaderboard', onBack: showLeaderboard });
    window.GL_API.pickemPlayer(name).then(function(res){
      if (!res.name) res.name = name;
      var evs = res.events || [];
      var rows = evs.map(function(e){
        var pts = e.points || 0;
        return '<div class="pk-hist-row pk-hist-row-static">' +
          '<div class="pk-hist-row-main"><div class="pk-hist-ev">' + esc(e.event || e.slug) + '</div>' +
          '<div class="pk-hist-meta">' + esc(e.date || '') + ' · ' + (e.correct || 0) + '/' + (e.boutCount || 0) + ' winners</div></div>' +
          '<div class="pk-hist-pts ' + (pts >= 0 ? 'pos' : 'neg') + '">' + (pts > 0 ? '+' : '') + pts + '</div></div>';
      }).join('');
      var body = statsHeadHtml(res) + (evs.length ? '<div class="pk-hist-list">' + rows + '</div>' : '<div class="pk-hist-empty">No graded cards yet.</div>');
      showPanel(body, { backLabel: '← Back to leaderboard', onBack: showLeaderboard });
    }).catch(function(err){
      var msg = (err && err.status === 404) ? 'Player not found.' : 'Profile unavailable right now.';
      showPanel('<p class="gl-error">' + esc(msg) + '</p>', { backLabel: '← Back to leaderboard', onBack: showLeaderboard });
    });
  }

  // ── History: per-event list, then per-bout drill-down -----------------------
  // Mirrors renderPickemHistory + renderPickemHistoryEvent (index.html ~8341-8431).
  function showHistory(){
    showPanel('<p class="gl-muted">Loading your history…</p>');
    window.GL_API.pickemHistory().then(function(res){
      renderHistoryList(res);
    }).catch(function(){
      showPanel('<p class="gl-error">History unavailable right now.</p>');
    });
  }

  function renderHistoryList(res){
    var evs = res.events || [];
    var head = statsHeadHtml(res);
    var body = !evs.length
      ? head + '<div class="pk-hist-empty">No graded cards yet. Make your picks -- they’ll be scored here after the event.</div>'
      : head + '<div class="pk-hist-list">' + evs.map(function(e){
          var pts = e.points || 0;
          return '<button type="button" class="pk-hist-row" data-hist-event="' + esc(e.slug) + '">' +
            '<div class="pk-hist-row-main"><div class="pk-hist-ev">' + esc(e.event || e.slug) + '</div>' +
            '<div class="pk-hist-meta">' + esc(e.date || '') + ' · ' + (e.correct || 0) + '/' + (e.boutCount || 0) + ' winners</div></div>' +
            '<div class="pk-hist-pts ' + (pts >= 0 ? 'pos' : 'neg') + '">' + (pts > 0 ? '+' : '') + pts + '</div>' +
            '<div class="pk-hist-arrow">›</div></button>';
        }).join('') + '</div>';
    showPanel(body);
    container.querySelectorAll('[data-hist-event]').forEach(function(btn){
      btn.addEventListener('click', function(){
        window.GL_NATIVE.tap();
        showHistoryEvent(btn.getAttribute('data-hist-event'), res);
      });
    });
  }

  function showHistoryEvent(slug, listRes){
    var backToList = function(){ renderHistoryList(listRes); };
    showPanel('<div class="pk-board-empty">Loading…</div>', { backLabel: '← All cards', onBack: backToList });
    window.GL_API.pickemHistory(slug).then(function(res){
      var bouts = res.bouts || [];
      var rows = bouts.map(function(b){
        var tag = 'pending', label = 'Pending';
        if (b.voided) { tag = 'void'; label = 'No contest — void'; }
        else if (b.pending) { tag = 'pending'; label = 'Pending'; }
        else if (b.winnerHit) { tag = 'hit'; label = 'Winner' + (b.methodHit ? ' + method' : '') + (b.roundHit ? ' + round' : ''); }
        else { tag = 'miss'; label = 'Wrong winner'; }
        var pts = b.points || 0;
        var sub = (b.method || '—') + (b.round ? ' · R' + b.round : '') + ' · ' + (b.confidence || '') + ' conf · ' + label;
        return '<div class="pk-hist-bout ' + tag + '">' +
          '<div class="pk-hist-bout-main"><div class="pk-hist-bout-pick">' + esc(b.winner || '') + '</div>' +
          '<div class="pk-hist-bout-detail">' + esc(sub) + '</div></div>' +
          '<div class="pk-hist-bout-pts ' + (pts > 0 ? 'pos' : pts < 0 ? 'neg' : 'zero') + '">' + (pts > 0 ? '+' : '') + pts + '</div></div>';
      }).join('');
      var total = res.total || 0;
      var body = '<div class="pk-hist-ev-head"><div class="pk-hist-ev-name">' + esc(res.event || slug) + '</div>' +
        '<div class="pk-hist-ev-total ' + (total >= 0 ? 'pos' : 'neg') + '">' + (total > 0 ? '+' : '') + total + ' pts</div></div>' +
        (res.graded ? '' : '<div class="pk-note pk-locked" style="margin:0 0 .6rem">Not fully graded yet — results still coming in.</div>') +
        '<div class="pk-hist-bouts">' + rows + '</div>' +
        // Mirrors the site's My History "Share results" button
        // (sharePickemHistory()) -- only offered once the card is fully
        // graded, same gate as the site's own version. No winner/loser slugs
        // in this history payload (gradeCard's bouts carry names only, not
        // s1/s2) so the sheet's avatars fall back to initials here -- same
        // graceful-degradation the sheet already does for any missing photo.
        (window.GL_SHEET && res.graded && bouts.length
          ? '<button type="button" class="gl-sheet-btn" id="pkHistShareBtn">Share results</button>' : '');
      showPanel(body, { backLabel: '← All cards', onBack: backToList });
      var histShareBtn = container.querySelector('#pkHistShareBtn');
      if (histShareBtn) histShareBtn.addEventListener('click', function(){
        window.GL_NATIVE.tap();
        var picksOut = bouts.map(function(b){
          return {
            winner: b.winner, loser: b.winner === b.f1 ? b.f2 : b.f1,
            winnerSlug: null, loserSlug: null,
            method: b.method || null, round: b.round || null, confidence: b.confidence || 'Med',
            voided: !!b.voided, winnerHit: !!b.winnerHit, methodHit: !!b.methodHit, roundHit: !!b.roundHit,
            actualWinner: b.winnerHit ? b.winner : null,
            points: b.points || 0,
          };
        });
        window.GL_SHEET.pickem({
          name: name, eventName: res.event || slug, eventDate: res.date || '',
          graded: true, totalPoints: total, picks: picksOut,
        }).catch(function(){});
      });
    }).catch(function(){
      showPanel('<p class="gl-error">Couldn’t load that card.</p>', { backLabel: '← All cards', onBack: backToList });
    });
  }

  Promise.all([
    window.GL_API.pickemCard(),
    window.GL_API.pickemName().catch(function(){ return { name:null }; })
  ]).then(function(results){
    var cardRes = results[0], nameRes = results[1];
    card = cardRes.card; score = cardRes.score || {};
    name = nameRes && nameRes.name;
    locked = !!card.locked;
    return window.GL_API.pickemMine(card.slug).catch(function(){ return null; });
  }).then(function(mine){
    if (mine && mine.record && Array.isArray(mine.record.picks)){
      mine.record.picks.forEach(function(p){
        var b = card.bouts.filter(function(x){ return (x.f1 === p.f1 && x.f2 === p.f2) || (x.f1 === p.f2 && x.f2 === p.f1); })[0];
        if (!b) return;
        picks[b.id] = { boutId:b.id, winner:p.winner, side: sideOf(b, p.winner), method:p.method, round:p.round, confidence:p.confidence };
      });
    }
    if (mine && mine.locked) locked = true;
    renderShell();
    if (mine && mine.record) { submitted = true; updateBar(); updateShareBtn(); }
  }).catch(function(){
    container.innerHTML = '<p class="gl-error">Couldn’t load this week’s card -- check your connection and try again.</p>';
  });
}
