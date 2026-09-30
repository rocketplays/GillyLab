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
  var nextWeekAt = null; // ISO timestamp -- when this week's bracket rotates to a new one
  var nextWeekTimer = null;

  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]; }); }

  // ---- belts: lifetime progression, not weekly -- mirrors the site's own
  // ladder exactly (prototypes/legends-bracket.html's BELTS), stripes and
  // all: `outline` on Black is the same reason the site adds one -- an
  // all-black swatch is otherwise invisible against this app's own near-
  // black background.
  var BELTS = [
    { name: 'White', min: 0, color: '#e8e8ea' },
    { name: 'Blue', min: 20, color: '#2f6fed' },
    { name: 'Purple', min: 50, color: '#8b5cf6' },
    { name: 'Brown', min: 100, color: '#8a5a2b' },
    { name: 'Black', min: 180, color: '#1a1a1a', outline: true },
  ];
  function beltInfo(pts){
    var idx = 0;
    for (var i = 0; i < BELTS.length; i++){ if (pts >= BELTS[i].min) idx = i; }
    var belt = BELTS[idx], next = BELTS[idx + 1];
    var pct, stripes;
    if (next){
      pct = Math.max(0, Math.min(1, (pts - belt.min) / (next.min - belt.min)));
      stripes = Math.min(4, Math.floor(pct * 4));
    } else { pct = 1; stripes = 4; }
    return { belt: belt, next: next, pct: pct, stripes: stripes };
  }
  function renderBeltPanel(){
    var info = beltInfo(lifetimePts);
    var stripesHTML = '';
    for (var s = 0; s < 4; s++) stripesHTML += '<span class="br-belt-stripe' + (s < info.stripes ? ' filled' : '') + '"></span>';
    var nextText = info.next ? (info.next.min - lifetimePts) + ' pts to ' + info.next.name + ' Belt' : 'Top belt reached';
    document.getElementById('brBelt').innerHTML =
      '<div class="br-belt-row">' +
        '<div class="br-belt-swatch" style="background:' + info.belt.color + (info.belt.outline ? ';border:1px solid #ffb340' : '') + '"></div>' +
        '<div class="br-belt-info">' +
          '<div class="br-belt-name">' + esc(info.belt.name) + ' Belt</div>' +
          '<div class="br-belt-stripes">' + stripesHTML + '</div>' +
        '</div>' +
        '<div class="br-belt-progress">' +
          '<div class="br-belt-track"><div class="br-belt-fill" style="width:' + (info.pct * 100) + '%;background:' + info.belt.color + '"></div></div>' +
          '<div class="br-belt-meta">' + lifetimePts + ' lifetime pts · ' + esc(nextText) + '</div>' +
        '</div>' +
      '</div>';
  }

  // "xD xH" until this week's bracket rotates -- same shape home.js's own
  // countdown helpers use (bracketCountdown/pickemLockCountdown), just
  // computed here instead of shared, per this app's per-screen-self-
  // contained convention. Ticks on an interval rather than rendering once,
  // since a visitor who leaves this screen open across the boundary should
  // see it flip to the new week's numbers (and eventually a fresh bracket)
  // without needing to navigate away and back.
  function nextWeekCountdownStr(){
    if (!nextWeekAt) return null;
    var ms = Date.parse(nextWeekAt) - Date.now();
    if (!isFinite(ms) || ms <= 0) return null;
    var totalHours = Math.floor(ms / 3600000);
    var d = Math.floor(totalHours / 24), h = totalHours % 24;
    return d + 'D ' + h + 'H';
  }
  function tickNextWeekCountdown(){
    var el = document.getElementById('brNextWeek');
    if (!el || !el.isConnected){ if (nextWeekTimer){ clearInterval(nextWeekTimer); nextWeekTimer = null; } return; }
    var c = nextWeekCountdownStr();
    el.textContent = c ? ('New bracket in ' + c) : 'A new bracket is on its way — check back soon.';
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
      '</div>' +
      // Bare trailing grid column, not decorative -- see .br-spacer's own
      // CSS comment for why the Champion column can never scroll flush
      // left without it.
      '<div class="br-col br-spacer" aria-hidden="true"></div>';

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
    initColVisibility();
  }

  // See .br-connector-name's own CSS comment for why this exists: a
  // connector-name is opacity:0 by default and only revealed while its own
  // .br-col is the one currently centered/visible. Unlike the site's
  // .round-col nodes (which stay put across re-renders), renderPicker() and
  // renderResults() both replace #brBracket's .br-col elements outright, so
  // any previous observer would be watching detached nodes -- disconnect
  // and re-observe the fresh ones every time either function runs.
  var colObserver = null;
  function initColVisibility(){
    if (colObserver) colObserver.disconnect();
    var scroller = document.getElementById('brScroll');
    var cols = document.querySelectorAll('#brBracket .br-col');
    if (!scroller || !cols.length) return;
    colObserver = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        entry.target.classList.toggle('is-current', entry.intersectionRatio > 0.5);
      });
    }, { root: scroller, threshold: [0, 0.5, 1] });
    cols.forEach(function(col){ colObserver.observe(col); });
  }

  // Horizontal auto-advance. Earlier passes at this (see git history) tried
  // scroller.scrollTo({left: target.offsetLeft}), then
  // target.scrollIntoView({inline:'start'}) paired with CSS
  // scroll-snap-align:start -- both left the settled column sitting flush
  // against the true edge with the next round peeking in on a real device,
  // even after correcting for the scroll container's own padding. The root
  // cause was a mismatch, not a math error: CSS said align:start while this
  // function (and showResults' own jump to the champion card) asked for
  // inline:'center' -- two different engines resolve that disagreement
  // differently, which is exactly why this looked fine in one browser and
  // peeked in another. align:center (see .br-col) now agrees with what's
  // asked for here, so there's nothing left to arbitrate: a plain
  // scrollIntoView reliably centers the target with even space on both
  // sides, and overscrolling past it snaps back to center instead of
  // drifting to an engine-specific resting point.
  var pendingScrollTarget = null; // 'sf' | 'final' | 'champion' | null
  function scrollToPending(){
    if (!pendingScrollTarget) return;
    var idx = { sf: 1, final: 2, champion: 3 }[pendingScrollTarget];
    pendingScrollTarget = null;
    var cols = document.querySelectorAll('#brBracket .br-col');
    var target = cols[idx];
    if (target) target.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
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
  // "Your Picks" recap -- every round's result at a glance, right next to
  // the score number, so it's visible the moment you submit without
  // scrolling back up through each column to see which ones hit. Same
  // ✓/✗ language the QF/SF/Final match rows already use (modelCallHTML).
  function pickResultRowHTML(label, pick, correct, pts){
    return (
      '<div class="br-recap-row">' +
        '<span class="br-recap-lbl">' + label + '</span>' +
        '<span class="br-recap-pick">' + esc(pick ? pick.name : '—') + '</span>' +
        '<span class="br-recap-mark ' + (correct ? 'good' : 'bad') + '">' + (correct ? '✓ +' + pts : '✗') + '</span>' +
      '</div>'
    );
  }
  function recapHTML(){
    var rows = [];
    for (var i = 0; i < 4; i++) rows.push(pickResultRowHTML('QF' + (i + 1), picks.qf[i], picks.qf[i] && real.qf[i] === picks.qf[i], 1));
    for (var j = 0; j < 2; j++) rows.push(pickResultRowHTML('SF' + (j + 1), picks.sf[j], picks.sf[j] && real.sf[j] === picks.sf[j], 2));
    rows.push(pickResultRowHTML('Final', picks.final, !!(picks.final && real.final === picks.final), 4));
    return '<div class="br-recap"><div class="br-recap-title">Your Picks</div>' + rows.join('') + '</div>';
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
      '<div class="br-col br-champcol" id="brColChamp"><div class="br-collabel is-final">Champion</div>' +
        '<div class="br-champcard">' +
          fighterRowHTML(finalWinner, { yourPick: picks.final === finalWinner }) +
        '</div>' +
        // yourPick above only ever shows a badge when you had it RIGHT (see
        // fighterRowHTML) -- picking wrong left this column with zero trace
        // of what you'd actually picked. This line always states it either way.
        (picks.final
          ? (picks.final === finalWinner
              ? '<div class="br-champ-result good">✓ You picked it right</div>'
              : '<div class="br-champ-result bad">✗ You had <strong>' + esc(picks.final.name) + '</strong></div>')
          : '') +
        '<button type="button" class="gl-btn gl-btn-outline" id="brViewLbBtn" style="margin-top:.9rem">View Leaderboard ↓</button>' +
      '</div>' +
      '<div class="br-col br-spacer" aria-hidden="true"></div>';

    var viewLbBtn = document.getElementById('brViewLbBtn');
    if (viewLbBtn) viewLbBtn.addEventListener('click', function(){
      window.GL_NATIVE.tap();
      var lbSec = document.getElementById('brLbSection');
      if (lbSec) lbSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    document.getElementById('brSubmitBtn').disabled = true;
    document.getElementById('brSubmitBtn').textContent = 'Bracket Submitted';
    document.getElementById('brProgress').textContent = '';
    document.getElementById('brScore').innerHTML =
      '<span class="br-score-big">' + score + '</span><span class="gl-muted"> / 12 — pts added to your lifetime belt progress</span>' +
      recapHTML() +
      '<div class="br-next-week" id="brNextWeek"></div>';
    document.getElementById('brScore').hidden = false;
    tickNextWeekCountdown();
    if (nextWeekTimer) clearInterval(nextWeekTimer);
    nextWeekTimer = setInterval(tickNextWeekCountdown, 60000);
    // Mirrors the site's showResults(): land on the champion card whether
    // this is a fresh submit or a reload of a week you already played --
    // renderResults() always rebuilds #brBracket from scratch (scrollLeft
    // resets to 0), so without this the reload path silently stayed on the
    // quarterfinals column instead of showing the result you came back for.
    var champCol = document.getElementById('brColChamp');
    if (champCol) champCol.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    initColVisibility();
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
        '<h1 class="gl-heading" style="margin:.1rem 0 .2rem">Legends <span style="color:var(--accent)">Bracket</span></h1>' +
        '<p class="gl-muted" id="brDivision" style="margin:0">This week: —</p>' +
      '</div>' +
      '<div class="gl-sec" id="brBelt"></div>' +
      '<div class="gl-sec">' +
        '<p class="gl-muted" style="margin:0">Fill out every round, then submit once. 1 pt per quarterfinal · 2 pts per semifinal · 4 pts for the final — 12 pts possible.</p>' +
      '</div>' +
      '<div class="gl-sec"><div class="br-scroll" id="brScroll"><div class="br-bracket" id="brBracket"></div></div></div>' +
      // position:fixed (see .br-submitrow's own CSS comment) -- no longer
      // plain in-flow content, so it never reserves its own space in the
      // page's normal flow. The fixed bar always covers exactly its own
      // height of whatever content is at the TRUE bottom of the page once
      // fully scrolled, regardless of where a spacer sits in between -- the
      // Leaderboard is the last thing on this page, so #brSubmitSpacer has
      // to go AFTER it (not right here, where it only leaves a gap between
      // the button and the score/leaderboard that follows) to actually push
      // the bar's cover-height past the leaderboard's own last rows.
      '<div class="br-submitrow" id="brSubmitRow">' +
        '<button type="button" class="gl-btn gl-btn-primary" id="brSubmitBtn" disabled>Submit Bracket</button>' +
        '<p class="gl-muted" id="brProgress" style="margin:0">0 of 7 picks made</p>' +
      '</div>' +
      '<div class="gl-error" id="brSubmitErr"></div>' +
      '<div class="gl-sec br-score" id="brScore" hidden></div>' +
      '<div class="gl-sec" id="brLbSection">' +
        '<div class="gl-dash-head gl-dash-head--evenspace"><h2 class="gl-dash-title">Leaderboard</h2></div>' +
        '<div class="pk-tabs" id="brLbTabs">' +
          '<button type="button" class="pk-tab sel" data-lb-scope="week">This Week</button>' +
          '<button type="button" class="pk-tab" data-lb-scope="season">Season</button>' +
        '</div>' +
        '<div class="pk-board-list" id="brLbList"><div class="pk-board-empty">Loading…</div></div>' +
      '</div>' +
      '<div id="brSubmitSpacer"></div>';

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
    syncSubmitSpacer();
  }

  // #brSubmitRow is position:fixed (see its own CSS comment), so it no
  // longer reserves its own space in the page's normal flow -- without
  // this, it permanently floats on top of whatever renders right after it
  // (the score/recap/leaderboard), which is exactly what was reported: the
  // bar covering the last leaderboard rows once you'd scrolled all the way
  // down. A guessed fixed rem height here previously wasn't quite tall
  // enough on a real device (its real height varies with the safe-area
  // inset this bar itself sits above) -- measuring the actual rendered bar
  // and matching the spacer to it exactly is the only way to guarantee
  // there's never a gap OR an overlap, on any device.
  function syncSubmitSpacer(){
    var bar = document.getElementById('brSubmitRow');
    var spacer = document.getElementById('brSubmitSpacer');
    if (!bar || !spacer) return;
    spacer.style.height = bar.offsetHeight + 'px';
  }

  window.GL_API.bracketCurrent().then(function(res){
    FIGHTERS = res.fighters || [];
    bySeed = {}; FIGHTERS.forEach(function(f){ bySeed[f.seed] = f; });
    QF_PAIRS = res.qfPairs || [];
    consensus = (res.consensus || [null, null, null, null]).map(function(c){
      return c ? { a: bySeed[c.seedA], b: bySeed[c.seedB], pctA: c.pctA, pctB: c.pctB } : null;
    });
    lifetimePts = res.lifetimePts || 0;
    nextWeekAt = res.nextWeekAt || null;

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
