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
      '<div id="pkPanel" hidden></div>';

    renderBouts();
    wireShell();
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
            '<button type="button" class="pk-fighter' + (f1sel ? ' sel' : '') + '" data-pick="' + esc(b.f1) + '"' + (locked ? ' disabled' : '') + '>' + esc(b.f1) + '</button>' +
            '<button type="button" class="pk-fighter' + (f2sel ? ' sel' : '') + '" data-pick="' + esc(b.f2) + '"' + (locked ? ' disabled' : '') + '>' + esc(b.f2) + '</button>' +
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

  function showPanel(html){
    var panel = container.querySelector('#pkPanel');
    var bouts = container.querySelector('#pkBouts');
    var bar = container.querySelector('.pk-submitbar');
    var subnav = container.querySelector('.pk-subnav');
    var nameCard = container.querySelector('#pkNameCard');
    [bouts, bar, subnav, nameCard].forEach(function(el){ if (el) el.hidden = true; });
    panel.hidden = false;
    panel.innerHTML = '<button type="button" class="gl-btn gl-btn-outline" id="pkBack" style="margin-bottom:.8rem">← Back to picks</button>' + html;
    container.querySelector('#pkBack').addEventListener('click', function(){
      window.GL_NATIVE.tap();
      panel.hidden = true;
      [bouts, bar, subnav, nameCard].forEach(function(el){ if (el) el.hidden = false; });
    });
  }

  function showLeaderboard(){
    showPanel('<p class="gl-muted">Loading leaderboard…</p>');
    window.GL_API.pickemLeaderboard('current').then(function(res){
      var rows = res.rows || [];
      var body = !rows.length
        ? '<p class="gl-muted">No fights scored yet.</p>'
        : rows.map(function(r){
            var me = res.me && r.name === res.me.name;
            return '<div class="gl-card" style="display:flex;align-items:center;justify-content:space-between;padding:.7rem 1rem;margin-bottom:.5rem">' +
              '<span>#' + r.rank + ' ' + esc(r.name) + (me ? ' <span style="color:var(--accent)">(you)</span>' : '') + '</span>' +
              '<strong>' + r.points + '</strong>' +
            '</div>';
          }).join('');
      showPanel('<button type="button" class="gl-btn gl-btn-outline" id="pkBack" style="margin-bottom:.8rem">← Back to picks</button>' + body);
      container.querySelector('#pkBack').addEventListener('click', function(){
        var panel = container.querySelector('#pkPanel'), bouts = container.querySelector('#pkBouts'), bar = container.querySelector('.pk-submitbar'), subnav = container.querySelector('.pk-subnav'), nameCard = container.querySelector('#pkNameCard');
        panel.hidden = true;
        [bouts, bar, subnav, nameCard].forEach(function(el){ if (el) el.hidden = false; });
      });
    }).catch(function(){
      showPanel('<p class="gl-error">Leaderboard unavailable right now.</p>');
    });
  }

  function showHistory(){
    showPanel('<p class="gl-muted">Loading your history…</p>');
    window.GL_API.pickemHistory().then(function(res){
      var evs = res.events || [];
      var body = !evs.length
        ? '<p class="gl-muted">No graded cards yet. Make your picks -- they’ll be scored here after the event.</p>'
        : evs.map(function(e){
            var pts = e.points || 0;
            return '<div class="gl-card" style="display:flex;align-items:center;justify-content:space-between;padding:.7rem 1rem;margin-bottom:.5rem">' +
              '<span>' + esc(e.event || e.slug) + '<br><span class="gl-muted" style="font-size:.8rem">' + esc(e.date || '') + ' · ' + (e.correct || 0) + '/' + (e.boutCount || 0) + '</span></span>' +
              '<strong style="color:' + (pts >= 0 ? 'var(--accent)' : 'var(--bad)') + '">' + (pts > 0 ? '+' : '') + pts + '</strong>' +
            '</div>';
          }).join('');
      showPanel('<button type="button" class="gl-btn gl-btn-outline" id="pkBack" style="margin-bottom:.8rem">← Back to picks</button>' + body);
      container.querySelector('#pkBack').addEventListener('click', function(){
        var panel = container.querySelector('#pkPanel'), bouts = container.querySelector('#pkBouts'), bar = container.querySelector('.pk-submitbar'), subnav = container.querySelector('.pk-subnav'), nameCard = container.querySelector('#pkNameCard');
        panel.hidden = true;
        [bouts, bar, subnav, nameCard].forEach(function(el){ if (el) el.hidden = false; });
      });
    }).catch(function(){
      showPanel('<p class="gl-error">History unavailable right now.</p>');
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
    if (mine && mine.record) { submitted = true; updateBar(); }
  }).catch(function(){
    container.innerHTML = '<p class="gl-error">Couldn’t load this week’s card -- check your connection and try again.</p>';
  });
}
