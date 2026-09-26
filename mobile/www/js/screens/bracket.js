// Legends Bracket -- free (login required, no subscription), wired to the
// real weekly game (see worker/index.js's handleBracketCurrent/-Submit/
// -Leaderboard). One shared bracket for everyone each week: the division
// rotates automatically, the "real" outcome is decided once server-side, and
// this screen is a native, vertically-stacked take on the site's own
// /bracket page (prototypes/legends-bracket.html) rather than a literal port
// of its desktop bracket-with-connector-lines layout -- the rounds already
// read top-to-bottom in normal scroll order here, so there's no need for the
// site's auto-scroll-to-the-next-round behavior either.
window.GL_ROUTER.register('bracket', {
  title: 'Legends Bracket',
  showBack: true,
  render: function(container){
    window.GL_AUTH.ready.then(function(){
      if (!window.GL_AUTH.isLoggedIn()){
        container.innerHTML =
          '<div class="gl-locked">' +
            '<svg viewBox="0 0 24 24"><path d="M6 10V8a6 6 0 0 1 12 0v2" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="4.5" y="10" width="15" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>' +
            '<div><strong style="color:var(--text)">Free account required</strong><br>Browsing is always free -- playing the Legends Bracket needs a quick free account.</div>' +
          '</div>' +
          '<div id="bracketAuthForm"></div>';
        window.GL_LOGIN_FORM(container.querySelector('#bracketAuthForm'), {
          onSuccess: function(){ window.GL_ROUTER.go('bracket'); }
        });
        return;
      }
      mountBracket(container);
    });
  }
});

function mountBracket(container){
  container.innerHTML = '<p class="gl-muted">Loading this week’s bracket…</p>';

  var PHOTO_BASE = window.GL_API.BASE + '/photos/thumb/';
  var FIGHTERS = [], bySeed = {}, QF_PAIRS = [];
  var real = null;                      // null until you've submitted (spoiler withheld)
  var consensus = [null, null, null, null];
  var picks = { qf: [null, null, null, null], sf: [null, null], final: null };
  var alreadySubmitted = false, lifetimePts = 0, submitting = false;

  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]; }); }

  // ---- belts: lifetime progression, not weekly -- mirrors the site's own
  // ladder exactly (prototypes/legends-bracket.html's BELTS).
  var BELTS = [
    { name: 'White', min: 0, color: '#e8e8ea' },
    { name: 'Blue', min: 20, color: '#2f6fed' },
    { name: 'Purple', min: 50, color: '#8b5cf6' },
    { name: 'Brown', min: 100, color: '#8a5a2b' },
    { name: 'Black', min: 180, color: '#1a1a1a' },
  ];
  function beltInfo(pts){
    var idx = 0;
    for (var i = 0; i < BELTS.length; i++){ if (pts >= BELTS[i].min) idx = i; }
    var belt = BELTS[idx], next = BELTS[idx + 1];
    var pct = next ? Math.max(0, Math.min(1, (pts - belt.min) / (next.min - belt.min))) : 1;
    return { belt: belt, next: next, pct: pct };
  }
  function renderBeltPanel(){
    var info = beltInfo(lifetimePts);
    var nextText = info.next ? (info.next.min - lifetimePts) + ' pts to ' + info.next.name + ' Belt' : 'Top belt reached';
    document.getElementById('brBelt').innerHTML =
      '<div style="display:flex;align-items:center;gap:.7rem">' +
        '<div style="width:2rem;height:1rem;border-radius:3px;flex:none;background:' + info.belt.color + '"></div>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-weight:800;font-size:.85rem">' + esc(info.belt.name) + ' Belt</div>' +
          '<div style="height:5px;border-radius:3px;background:var(--border);overflow:hidden;margin-top:.3rem">' +
            '<div style="height:100%;border-radius:3px;background:' + info.belt.color + ';width:' + (info.pct * 100) + '%"></div>' +
          '</div>' +
          '<div class="gl-muted" style="font-size:.7rem;margin-top:.25rem">' + lifetimePts + ' lifetime pts · ' + esc(nextText) + '</div>' +
        '</div>' +
      '</div>';
  }

  function fighterRowHTML(f, opts){
    opts = opts || {};
    if (!f) return '<div class="br-fcard br-fcard--empty">TBD</div>';
    var cls = 'br-fcard' + (opts.picked ? ' picked' : '') + (opts.winner ? ' winner' : '') + (opts.loser ? ' loser' : '');
    return (
      '<div class="' + cls + '"' + (opts.clickable ? ' data-seed="' + f.seed + '" role="button" tabindex="0"' : '') + '>' +
        '<span class="br-seed">' + f.seed + '</span>' +
        '<img class="br-photo" src="' + PHOTO_BASE + esc(f.photo) + '.png" alt="" loading="lazy" onerror="this.remove()">' +
        '<span class="br-meta"><span class="br-name">' + esc(f.name) + '</span><span class="br-legacy">' + esc(f.legacy) + '</span></span>' +
        (opts.yourPick ? '<span class="br-badge">Your pick</span>' : '') +
      '</div>'
    );
  }

  function updateProgress(){
    var made = picks.qf.filter(Boolean).length + picks.sf.filter(Boolean).length + (picks.final ? 1 : 0);
    document.getElementById('brProgress').innerHTML = '<strong>' + made + '</strong> of 7 picks made';
    document.getElementById('brSubmitBtn').disabled = made < 7;
  }

  function renderPicker(){
    var qfHTML = QF_PAIRS.map(function(pair, i){
      var a = bySeed[pair[0]], b = bySeed[pair[1]];
      return '<div class="br-match">' + fighterRowHTML(a, { picked: picks.qf[i] === a, clickable: true }) + fighterRowHTML(b, { picked: picks.qf[i] === b, clickable: true }) + '</div>';
    });
    var sfHTML = [0, 1].map(function(i){
      var a = picks.qf[i * 2], b = picks.qf[i * 2 + 1];
      return '<div class="br-match">' + fighterRowHTML(a, { picked: picks.sf[i] === a, clickable: !!a }) + fighterRowHTML(b, { picked: picks.sf[i] === b, clickable: !!b }) + '</div>';
    });
    var fa = picks.sf[0], fb = picks.sf[1];
    var finalHTML = '<div class="br-match">' + fighterRowHTML(fa, { picked: picks.final === fa, clickable: !!fa }) + fighterRowHTML(fb, { picked: picks.final === fb, clickable: !!fb }) + '</div>';

    document.getElementById('brBracket').innerHTML =
      '<div class="br-round"><div class="br-round-label">Quarterfinals</div>' + qfHTML.join('') + '</div>' +
      '<div class="br-round"><div class="br-round-label">Semifinals</div>' + sfHTML.join('') + '</div>' +
      '<div class="br-round"><div class="br-round-label">Final</div>' + finalHTML + '</div>' +
      '<div class="br-round"><div class="br-round-label">Champion</div><div class="br-champ">' + (picks.final ? fighterRowHTML(picks.final) : '<div class="br-fcard br-fcard--empty">—</div>') + '</div></div>';

    var matches = document.getElementById('brBracket').querySelectorAll('.br-match');
    // QF matches are the first 4 .br-match nodes, SF the next 2, Final the last.
    matches.forEach(function(m, mi){
      var cards = m.querySelectorAll('.br-fcard[data-seed]');
      cards.forEach(function(el){
        el.addEventListener('click', function(){
          var seed = el.getAttribute('data-seed');
          var f = bySeed[seed];
          if (mi < 4) pickQf(mi, f);
          else if (mi < 6) pickSf(mi - 4, f);
          else pickFinal(f);
        });
      });
    });
    updateProgress();
  }

  function pickQf(i, f){ picks.qf[i] = f; onPickChanged(); }
  function pickSf(i, f){ picks.sf[i] = f; onPickChanged(); }
  function pickFinal(f){ picks.final = f; onPickChanged(); }
  function onPickChanged(){
    [0, 1].forEach(function(i){
      var a = picks.qf[i * 2], b = picks.qf[i * 2 + 1];
      if (picks.sf[i] && picks.sf[i] !== a && picks.sf[i] !== b) picks.sf[i] = null;
    });
    if (picks.final && picks.final !== picks.sf[0] && picks.final !== picks.sf[1]) picks.final = null;
    renderPicker();
  }

  // "GillyLab Model" is just how the real result is labeled -- the model's
  // simulation decided who actually won, so this line states that fact and
  // scores your pick against it in one place, same as the site.
  function modelCallHTML(winner, yourPick, qfConsensus){
    var hit = yourPick === winner;
    var html = 'GillyLab Model: <strong>' + esc(winner.name) + '</strong>' +
      (yourPick ? ' <span style="font-weight:800;color:' + (hit ? 'var(--accent)' : 'var(--bad)') + '">' + (hit ? '✓ you had it' : '✗ you missed it') + '</span>' : '');
    if (qfConsensus){
      var maj = qfConsensus.pctA >= qfConsensus.pctB ? { pct: qfConsensus.pctA, f: qfConsensus.a } : { pct: qfConsensus.pctB, f: qfConsensus.b };
      html += '<div style="margin-top:.25rem;color:var(--accent)">' + maj.pct + '% picked ' + esc(maj.f.name) + '</div>';
    }
    return '<div class="br-modelcall">' + html + '</div>';
  }
  function realMatchHTML(a, b, winner, yourPick, qfConsensus){
    var note = (yourPick && yourPick !== a && yourPick !== b)
      ? '<div class="gl-muted" style="margin-top:.3rem">You had <strong>' + esc(yourPick.name) + '</strong> here — didn’t advance</div>' : '';
    return (
      '<div class="br-match">' +
        fighterRowHTML(a, { winner: a === winner, loser: a !== winner, yourPick: yourPick === a }) +
        fighterRowHTML(b, { winner: b === winner, loser: b !== winner, yourPick: yourPick === b }) +
        modelCallHTML(winner, yourPick, qfConsensus) +
        note +
      '</div>'
    );
  }
  function renderResults(score){
    var qfHTML = QF_PAIRS.map(function(pair, i){
      return realMatchHTML(bySeed[pair[0]], bySeed[pair[1]], bySeed[real.qf[i]], picks.qf[i], consensus[i]);
    }).join('');
    var sfHTML = [0, 1].map(function(i){
      return realMatchHTML(bySeed[real.qf[i * 2]], bySeed[real.qf[i * 2 + 1]], bySeed[real.sf[i]], picks.sf[i], null);
    }).join('');
    var finalWinner = bySeed[real.final];
    var finalHTML = realMatchHTML(bySeed[real.sf[0]], bySeed[real.sf[1]], finalWinner, picks.final, null);

    document.getElementById('brBracket').innerHTML =
      '<div class="br-round"><div class="br-round-label">Quarterfinals</div>' + qfHTML + '</div>' +
      '<div class="br-round"><div class="br-round-label">Semifinals</div>' + sfHTML + '</div>' +
      '<div class="br-round"><div class="br-round-label">Final</div>' + finalHTML + '</div>' +
      '<div class="br-round"><div class="br-round-label" style="color:var(--accent)">Champion</div><div class="br-champ">' + fighterRowHTML(finalWinner, { yourPick: picks.final === finalWinner }) + '</div></div>';

    document.getElementById('brSubmitBtn').disabled = true;
    document.getElementById('brSubmitBtn').textContent = 'Bracket Submitted';
    document.getElementById('brProgress').textContent = '';
    document.getElementById('brScore').innerHTML = '<span class="br-score-big">' + score + '</span><span class="gl-muted"> / 12 — pts added to your lifetime belt progress</span>';
    document.getElementById('brScore').hidden = false;
  }

  // ---- leaderboard (week + season), same .pk-board-* classes the Pick'em
  // and Bet Tracker leaderboards already use -- see pickem.js's renderBoard
  // for the original of this pattern.
  var lbScope = 'week';
  function renderLeaderboard(){
    document.querySelectorAll('#brLbTabs [data-lb-scope]').forEach(function(b){ b.classList.toggle('sel', b.getAttribute('data-lb-scope') === lbScope); });
    var listEl = document.getElementById('brLbList');
    listEl.innerHTML = '<div class="pk-board-empty">Loading…</div>';
    window.GL_API.bracketLeaderboard(lbScope).then(function(res){
      var rows = res.rows || [];
      var meName = res.me && res.me.name;
      if (!rows.length){ listEl.innerHTML = '<div class="pk-board-empty">No brackets scored yet.</div>'; return; }
      var rowHtml = function(r, me){
        return '<div class="pk-board-row' + (me ? ' me' : '') + '">' +
          '<span class="pk-board-rank">' + r.rank + '</span>' +
          '<span class="pk-board-name">' + esc(r.name) + (me ? ' <span class="pk-you">you</span>' : '') + '</span>' +
          '<span class="pk-board-pts">' + r.pts + '</span></div>';
      };
      var out = rows.map(function(r){ return rowHtml(r, meName && r.name === meName); }).join('');
      if (res.me && !rows.some(function(r){ return r.name === meName; })) out += '<div class="pk-board-sep">···</div>' + rowHtml(res.me, true);
      listEl.innerHTML = out;
    }).catch(function(){ listEl.innerHTML = '<div class="pk-board-empty">Leaderboard unavailable right now.</div>'; });
  }

  function resolveReal(raw){
    return { qf: raw.qf.map(function(s){ return bySeed[s]; }), sf: raw.sf.map(function(s){ return bySeed[s]; }), final: bySeed[raw.final] };
  }

  function render(){
    container.innerHTML =
      '<div class="gl-sec gl-sec--first">' +
        '<div class="gl-dash-head"><h2 class="gl-dash-title">Legends Bracket</h2></div>' +
        '<p class="gl-muted" id="brDivision" style="margin:0">This week: —</p>' +
      '</div>' +
      '<div class="gl-sec" id="brBelt"></div>' +
      '<div class="gl-sec">' +
        '<p class="gl-muted" style="margin:0">Fill out every round, then submit once. 1 pt per quarterfinal · 2 pts per semifinal · 4 pts for the final — 12 pts possible.</p>' +
      '</div>' +
      '<div id="brBracket"></div>' +
      '<div class="gl-sec" id="brSubmitRow">' +
        '<div id="brScore" class="br-score" hidden></div>' +
        '<button type="button" class="gl-btn gl-btn-primary" id="brSubmitBtn" disabled>Submit Bracket</button>' +
        '<p class="gl-muted" id="brProgress" style="margin-top:.5rem">0 of 7 picks made</p>' +
        '<div class="gl-error" id="brSubmitErr"></div>' +
      '</div>' +
      '<div class="gl-sec">' +
        '<div class="gl-dash-head"><h2 class="gl-dash-title">Leaderboards</h2></div>' +
        '<div class="pk-tabs" id="brLbTabs">' +
          '<button type="button" class="pk-tab sel" data-lb-scope="week">This Week</button>' +
          '<button type="button" class="pk-tab" data-lb-scope="season">Season</button>' +
        '</div>' +
        '<div class="pk-board-list" id="brLbList"><div class="pk-board-empty">Loading…</div></div>' +
      '</div>';

    document.getElementById('brLbTabs').addEventListener('click', function(e){
      var btn = e.target.closest('[data-lb-scope]');
      if (!btn) return;
      window.GL_NATIVE.tap();
      lbScope = btn.getAttribute('data-lb-scope');
      renderLeaderboard();
    });
    document.getElementById('brSubmitBtn').addEventListener('click', function(){
      if (alreadySubmitted || submitting || !picks.final) return;
      submitting = true;
      var btn = document.getElementById('brSubmitBtn');
      btn.disabled = true;
      document.getElementById('brSubmitErr').textContent = '';
      window.GL_NATIVE.tap();
      window.GL_API.bracketSubmit({
        qf: picks.qf.map(function(f){ return f.seed; }),
        sf: picks.sf.map(function(f){ return f.seed; }),
        final: picks.final.seed,
      }).then(function(res){
        submitting = false;
        alreadySubmitted = true;
        real = resolveReal(res.real);
        lifetimePts = res.lifetimePts || 0;
        renderBeltPanel();
        renderResults(res.score);
        renderLeaderboard();
      }).catch(function(err){
        submitting = false;
        btn.disabled = false;
        document.getElementById('brSubmitErr').textContent = (err && err.data && err.data.error) ? err.data.error : 'Something went wrong — try again.';
      });
    });

    renderBeltPanel();
    if (alreadySubmitted && real){
      renderResults(picks.__score);
      renderLeaderboard();
    } else {
      renderPicker();
    }
  }

  window.GL_API.bracketCurrent().then(function(res){
    FIGHTERS = res.fighters || [];
    bySeed = {}; FIGHTERS.forEach(function(f){ bySeed[f.seed] = f; });
    QF_PAIRS = res.qfPairs || [];
    consensus = (res.consensus || [null, null, null, null]).map(function(c){
      return c ? { a: bySeed[c.seedA], b: bySeed[c.seedB], pctA: c.pctA, pctB: c.pctB } : null;
    });
    lifetimePts = res.lifetimePts || 0;

    if (res.submitted && res.mine && res.real){
      alreadySubmitted = true;
      picks.qf = res.mine.picks.qf.map(function(s){ return bySeed[s]; });
      picks.sf = res.mine.picks.sf.map(function(s){ return bySeed[s]; });
      picks.final = bySeed[res.mine.picks.final];
      picks.__score = res.mine.score;
      real = resolveReal(res.real);
    }

    render();
    var divEl = document.getElementById('brDivision');
    if (divEl) divEl.textContent = 'This week: ' + (res.divisionName || res.division || '—');
  }).catch(function(){
    container.innerHTML = '<p class="gl-muted">Couldn’t load this week’s bracket — check your connection and try again.</p>';
  });
}
