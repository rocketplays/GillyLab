// Legends Bracket -- free (login required, no subscription), wired to the
// real weekly game (see worker/index.js's handleBracketCurrent/-Submit/
// -Leaderboard). One shared bracket for everyone each week: the division
// rotates automatically, the "real" outcome is decided once server-side.
// This screen ports the site's own /bracket page's (prototypes/legends-
// bracket.html) bracket-with-connector-lines layout literally: the site's
// OWN mobile breakpoint (max-width:820px -- 4 columns of ~86vw, horizontal
// scroll-snap) is already a phone-width design, so app.css's .br-scroll/
// .br-bracket/.br-col block is that same CSS, and this screen scrolls
// HORIZONTALLY through Quarterfinals -> Semifinals -> Final -> Champion
// exactly like the site, rather than the old vertical round-by-round stack.
// pickQf/pickSf/pickFinal auto-advance the horizontal scroll to the next
// column once its round is fully picked, mirroring the site's own
// scrollToPending.
window.GL_ROUTER.register('bracket', {
  title: 'Legends Bracket',
  // A direct free-tab-bar destination now (see router.js's FREE_TABS), same
  // as Climb -- no showBack, same convention climb.js uses, since a tab-bar
  // screen has nowhere "back" to from a direct tap. Still reachable via the
  // premium More sheet and the Home dashboard's bracketSection() button too;
  // both of those call go() with no opts, so they land here with the same
  // no-back-button treatment climb.js already gets from those entry points.
  tab: 'bracket',
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

  // Small last-name label that sits on the connector line between a match
  // and the next round, same idea as the site's own connector labels --
  // shows who's advancing (gold before you submit, green once it's the
  // real/locked result) without needing to look at the next column yet.
  function connectorHTML(fighter, kind){
    if (!fighter) return '';
    var parts = String(fighter.name).trim().split(' ');
    return '<span class="br-connector-name ' + kind + '">' + esc(parts[parts.length - 1]) + '</span>';
  }

  function updateProgress(){
    var made = picks.qf.filter(Boolean).length + picks.sf.filter(Boolean).length + (picks.final ? 1 : 0);
    document.getElementById('brProgress').innerHTML = '<strong>' + made + '</strong> of 7 picks made';
    document.getElementById('brSubmitBtn').disabled = made < 7;
  }

  function pickerMatchHTML(a, b, pickedFighter, aClickable, bClickable){
    return (
      '<div class="br-match">' +
        fighterRowHTML(a, { picked: pickedFighter === a, clickable: aClickable }) +
        '<div class="br-vs">vs</div>' +
        fighterRowHTML(b, { picked: pickedFighter === b, clickable: bClickable }) +
        connectorHTML(pickedFighter, 'picked') +
      '</div>'
    );
  }

  function renderPicker(){
    var qfMatches = QF_PAIRS.map(function(pair, i){
      var a = bySeed[pair[0]], b = bySeed[pair[1]];
      return pickerMatchHTML(a, b, picks.qf[i], true, true);
    });
    var qfPairsHTML =
      '<div class="br-pair">' + qfMatches[0] + qfMatches[1] + '</div>' +
      '<div class="br-pair">' + qfMatches[2] + qfMatches[3] + '</div>';

    var sfMatches = [0, 1].map(function(i){
      var a = picks.qf[i * 2], b = picks.qf[i * 2 + 1];
      return pickerMatchHTML(a, b, picks.sf[i], !!a, !!b);
    });
    var sfPairHTML = '<div class="br-pair">' + sfMatches[0] + sfMatches[1] + '</div>';

    var fa = picks.sf[0], fb = picks.sf[1];
    var finalMatchHTML = pickerMatchHTML(fa, fb, picks.final, !!fa, !!fb);

    document.getElementById('brBracket').innerHTML =
      '<div class="br-col"><div class="br-collabel">Quarterfinals</div><div class="br-pairgroup">' + qfPairsHTML + '</div></div>' +
      '<div class="br-col"><div class="br-collabel">Semifinals</div><div class="br-pairgroup">' + sfPairHTML + '</div></div>' +
      '<div class="br-col"><div class="br-collabel">Final</div>' + finalMatchHTML + '</div>' +
      '<div class="br-col br-champcol"><div class="br-collabel" id="brChampLabel">Champion</div>' +
        '<div class="br-champcard" id="brChampCard">' +
          '<div class="br-champ-cap">Your Pick</div>' +
          (picks.final ? fighterRowHTML(picks.final) : '<div class="br-fcard br-fcard--empty">TBD</div>') +
        '</div>' +
      '</div>';

    var matches = document.getElementById('brBracket').querySelectorAll('.br-match');
    // QF matches are the first 4 .br-match nodes, SF the next 2, Final the last --
    // still true here since querySelectorAll returns document order regardless
    // of the extra .br-pairgroup/.br-pair column wrappers around them.
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

  // Horizontal auto-advance -- same idea as the site's own scrollToPending,
  // but scrolls #brScroll's own scrollLeft directly (via the target column's
  // offsetLeft) rather than scrollIntoView, so the OUTER page's vertical
  // scroll position is never touched, just the bracket strip itself.
  var pendingScrollTarget = null; // 'sf' | 'final' | 'champion' | null
  function scrollToPending(){
    if (!pendingScrollTarget) return;
    var idx = { sf: 1, final: 2, champion: 3 }[pendingScrollTarget];
    pendingScrollTarget = null;
    var scroller = document.getElementById('brScroll');
    var cols = document.querySelectorAll('#brBracket .br-col');
    var target = cols[idx];
    if (scroller && target) scroller.scrollTo({ left: target.offsetLeft, behavior: 'smooth' });
  }

  function pickQf(i, f){
    var wasComplete = picks.qf.every(Boolean);
    picks.qf[i] = f;
    if (!wasComplete && picks.qf.every(Boolean)) pendingScrollTarget = 'sf';
    onPickChanged();
  }
  function pickSf(i, f){
    var wasComplete = picks.sf.every(Boolean);
    picks.sf[i] = f;
    if (!wasComplete && picks.sf.every(Boolean)) pendingScrollTarget = 'final';
    onPickChanged();
  }
  function pickFinal(f){
    picks.final = f;
    pendingScrollTarget = 'champion';
    onPickChanged();
  }
  function onPickChanged(){
    [0, 1].forEach(function(i){
      var a = picks.qf[i * 2], b = picks.qf[i * 2 + 1];
      if (picks.sf[i] && picks.sf[i] !== a && picks.sf[i] !== b) picks.sf[i] = null;
    });
    if (picks.final && picks.final !== picks.sf[0] && picks.final !== picks.sf[1]) picks.final = null;
    renderPicker();
    scrollToPending();
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
        '<div class="br-vs">vs</div>' +
        fighterRowHTML(b, { winner: b === winner, loser: b !== winner, yourPick: yourPick === b }) +
        modelCallHTML(winner, yourPick, qfConsensus) +
        note +
        connectorHTML(winner, 'winner') +
      '</div>'
    );
  }
  function renderResults(score){
    // real.qf/sf/final are already resolved FIGHTER OBJECTS (see resolveReal
    // below), not seed numbers -- bySeed[] is keyed by seed, so wrapping any
    // of these in another bySeed[] lookup returns undefined and crashes
    // modelCallHTML's winner.name a few lines down. That silent throw was
    // caught by the outer bracketCurrent().catch() and shown as "Couldn't
    // load this week's bracket" for anyone who'd already submitted -- the
    // actual bug behind that report, not a network issue.
    var qfMatches = QF_PAIRS.map(function(pair, i){
      return realMatchHTML(bySeed[pair[0]], bySeed[pair[1]], real.qf[i], picks.qf[i], consensus[i]);
    });
    var qfPairsHTML = '<div class="br-pair">' + qfMatches[0] + qfMatches[1] + '</div><div class="br-pair">' + qfMatches[2] + qfMatches[3] + '</div>';
    var sfMatches = [0, 1].map(function(i){
      return realMatchHTML(real.qf[i * 2], real.qf[i * 2 + 1], real.sf[i], picks.sf[i], null);
    });
    var sfPairHTML = '<div class="br-pair">' + sfMatches[0] + sfMatches[1] + '</div>';
    var finalWinner = real.final;
    var finalMatchHTML = realMatchHTML(real.sf[0], real.sf[1], finalWinner, picks.final, null);

    document.getElementById('brBracket').innerHTML =
      '<div class="br-col"><div class="br-collabel">Quarterfinals</div><div class="br-pairgroup">' + qfPairsHTML + '</div></div>' +
      '<div class="br-col"><div class="br-collabel">Semifinals</div><div class="br-pairgroup">' + sfPairHTML + '</div></div>' +
      '<div class="br-col"><div class="br-collabel">Final</div>' + finalMatchHTML + '</div>' +
      '<div class="br-col br-champcol"><div class="br-collabel is-final">Champion</div>' +
        '<div class="br-champcard">' +
          fighterRowHTML(finalWinner, { yourPick: picks.final === finalWinner }) +
        '</div>' +
        '<button type="button" class="gl-btn gl-btn-outline" id="brViewLbBtn" style="margin-top:.9rem">View Leaderboard ↓</button>' +
      '</div>';

    var viewLbBtn = document.getElementById('brViewLbBtn');
    if (viewLbBtn) viewLbBtn.addEventListener('click', function(){
      window.GL_NATIVE.tap();
      var lbSec = document.getElementById('brLbSection');
      if (lbSec) lbSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

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
      '<div class="gl-sec"><div class="br-scroll" id="brScroll"><div class="br-bracket" id="brBracket"></div></div></div>' +
      '<div class="gl-sec br-submitrow" id="brSubmitRow">' +
        '<button type="button" class="gl-btn gl-btn-primary" id="brSubmitBtn" disabled>Submit Bracket</button>' +
        '<p class="gl-muted" id="brProgress" style="margin:0">0 of 7 picks made</p>' +
      '</div>' +
      '<div class="gl-error" id="brSubmitErr"></div>' +
      '<div class="gl-sec br-score" id="brScore" hidden></div>' +
      '<div class="gl-sec" id="brLbSection">' +
        '<div class="gl-dash-head"><h2 class="gl-dash-title">Leaderboard</h2></div>' +
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
        // Surface whatever detail we actually have instead of always falling
        // back to the same generic line -- a real server-side error message,
        // an HTTP status, or (no err.status at all) a network-level failure
        // are three different problems and look identical as "something went
        // wrong" otherwise.
        var msg;
        if (err && err.data && err.data.error) msg = err.data.error;
        else if (err && err.status) msg = 'Server error (' + err.status + ') — try again.';
        else if (err && err.message) msg = 'Couldn’t reach the server: ' + err.message;
        else msg = 'Something went wrong — try again.';
        document.getElementById('brSubmitErr').textContent = msg;
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
