// Fight Simulator -- Premium's flagship tool: pick any two fighters, run a
// Monte Carlo projection. A full route (not a modal), reached from the
// fighter profile's "Fight simulator" item (which prefills Fighter A) or
// directly via window.GL_ROUTER.go('simulator').
//
// Unlike the Deep Dive modal or the Go Premium carousel (both the site's own
// generated HTML/CSS/JS injected as-is), this screen is rendered NATIVELY,
// driven by GET /api/app/fight-sim (see worker/index.js + worker/fight-sim.js
// + scripts/gen-fight-sim.cjs). The math itself is a big, intricate model
// (~50 functions) tangled through index.html's 144k-line monolith with a
// ~10MB data dependency (FIGHTER_STATS + FIGHT_HISTORY) -- there's no clean
// "fetch this self-contained CSS/HTML/JS blob" boundary the way the Deep
// Dive hub or the /subscribe carousel have, and shipping that data to every
// device just to run a probability calculation isn't a trade worth making
// when a Worker can run the same math server-side in milliseconds and
// return a small JSON result instead. See scripts/gen-fight-sim.cjs's own
// header comment for the full reasoning.
window.GL_ROUTER.register('simulator', {
  title: 'Fight Simulator',
  tab: 'simulator',
  showBack: true,
  render: function(container, params){
    window.GL_SIMULATOR.load(container, params);
  }
});

window.GL_SIMULATOR = (function(){
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]; }); }

  // Deep Dive modal state -- see the "Matchup Analytics Deep Dive" section
  // below for what these hold and why this screen only ever has one entry
  // rather than matchup.js's slug-keyed map.
  var hubEntry = null, hubTabState = { tab: 'striking', filter: 'all' }, hubScrollY = 0, activeContainer = null;
  function surname(n){
    var p = String(n || '').trim().split(/\s+/);
    var i = p.length - 1;
    while (i > 0 && /^(jr|sr|ii|iii|iv|v)\.?$/i.test(p[i])) i--;
    return p[i] || n;
  }

  // Two independent instances of matchup.js's own search-box pattern (same
  // /api/fighter-search endpoint, same .mf-search* CSS), one per fighter
  // slot, each tracking its own sequence number so a stale keystroke's
  // results can never land after a newer one's.
  function makePicker(container, key, onPick){
    var seq = 0;
    var input = container.querySelector('[data-pick-input="' + key + '"]');
    var box = container.querySelector('[data-pick-results="' + key + '"]');
    var timer = null;
    function hide(){ box.hidden = true; box.innerHTML = ''; }
    function show(html){ box.innerHTML = html; box.hidden = false; }
    input.addEventListener('input', function(){
      var q = input.value.trim();
      if (timer) clearTimeout(timer);
      if (q.length < 2){ hide(); return; }
      timer = setTimeout(function(){
        var mySeq = ++seq;
        window.GL_API.fighterSearch(q).then(function(res){
          if (mySeq !== seq) return;
          var list = res.results || [];
          if (!list.length){ show('<div class="mf-search-empty">No fighters found</div>'); return; }
          show(list.map(function(f){
            return '<button type="button" class="mf-search-item" data-name="' + esc(f.name) + '">' +
              '<span class="mfs-name">' + esc(f.name) + '</span>' +
              '<span class="mfs-meta">' + esc([f.division, f.record].filter(Boolean).join(' · ')) + '</span>' +
            '</button>';
          }).join(''));
          box.querySelectorAll('[data-name]').forEach(function(btn){
            btn.addEventListener('click', function(){
              window.GL_NATIVE.tap();
              hide();
              var name = btn.getAttribute('data-name');
              input.value = name;
              onPick(name);
            });
          });
        }).catch(function(){ hide(); });
      }, 200);
    });
    input.addEventListener('focus', function(){ if (input.value.trim().length >= 2 && box.innerHTML) box.hidden = false; });
    document.addEventListener('click', function(e){ if (e.target !== input && !box.contains(e.target)) hide(); });
    // Typing over a previously-picked name un-picks it -- otherwise a user
    // could edit the text, never re-select, and Simulate would silently run
    // against the old name.
    input.addEventListener('input', function(){ onPick(null); });
  }

  function pctBarHTML(pctA, nameA, nameB){
    var a = Math.round(pctA * 100);
    var b = 100 - a;
    // .sim-probbar-a (accent/green) always used to render on the LEFT
    // regardless of who it actually belonged to -- so the bar looked like
    // it "defaulted" green-left instead of tracking the favorite. These
    // class names now mean "favorite"/"underdog", not "fighter A"/"fighter
    // B" -- assigned by which side is actually >= 50%, so the green always
    // sits on whoever the model favors, left or right.
    var aFav = a >= b;
    var clsA = aFav ? 'sim-probbar-a' : 'sim-probbar-b';
    var clsB = aFav ? 'sim-probbar-b' : 'sim-probbar-a';
    return (
      '<div class="sim-probbar">' +
        '<div class="' + clsA + '" style="width:' + a + '%">' + (a >= 12 ? a + '%' : '') + '</div>' +
        '<div class="' + clsB + '" style="width:' + b + '%">' + (b >= 12 ? b + '%' : '') + '</div>' +
      '</div>' +
      '<div class="sim-probbar-labels">' +
        '<span>' + esc(nameA) + (a < 12 ? ' ' + a + '%' : '') + '</span>' +
        '<span>' + esc(nameB) + (b < 12 ? ' ' + b + '%' : '') + '</span>' +
      '</div>'
    );
  }

  function methodRowsHTML(methods, wins){
    var order = ['KO/TKO', 'Submission', 'Decision'];
    if (!wins) return '<p class="gl-muted" style="margin:.3rem 0 0;font-size:.78rem">No wins in this sample.</p>';
    return '<div class="sim-methods">' + order.map(function(m){
      var pct = Math.round(((methods[m] || 0) / wins) * 100);
      return (
        '<div class="sim-method-row">' +
          '<div class="sim-method-label">' + m + '</div>' +
          '<div class="sim-method-track"><div class="sim-method-fill" style="width:' + pct + '%"></div></div>' +
          '<div class="sim-method-pct">' + pct + '%</div>' +
        '</div>'
      );
    }).join('') + '</div>';
  }

  // Faces + names + raw win count for each side -- mirrors the site's own
  // .sim-results-top (avatar, name, "N / total wins"), favorite called out
  // in accent. Reuses fighter.js's own avatar markup/CSS (.fp-av, 56px)
  // rather than a third copy of the same circular-photo-with-initials-
  // fallback pattern matchup.js/home.js/roster.js already each have their
  // own version of.
  // `data-sim-slug` is only added when a real profile slug came back --
  // wireResult() below wires a click on it to open that fighter's profile.
  // Neither side was clickable at all before this: the simulator was a dead
  // end even though every other fighter photo/name in the app opens a
  // profile.
  function resultsHeaderHTML(nameA, nameB, slugA, slugB, result){
    var aFav = result.winsA >= result.winsB;
    function side(name, slug, wins, fav, right){
      return (
        '<div class="sim-res-fighter' + (fav ? ' fav' : '') + (right ? ' right' : '') + '"' + (slug ? ' data-sim-slug="' + esc(slug) + '" style="cursor:pointer"' : '') + '>' +
          window.GL_FIGHTER.avatarHtml({ name: name, photo: slug || null }) +
          '<div>' +
            '<div class="sim-res-name">' + esc(name) + '</div>' +
            '<div class="sim-res-count">' + wins.toLocaleString() + ' / ' + result.n.toLocaleString() + ' wins</div>' +
          '</div>' +
        '</div>'
      );
    }
    return '<div class="sim-res-top">' + side(nameA, slugA, result.winsA, aFav, false) + side(nameB, slugB, result.winsB, !aFav, true) + '</div>';
  }

  // The composite rating simWinProbability actually runs on -- shown so the
  // win% above isn't a total black box, same reasoning as the site's own
  // .sim-power-row.
  function powerRowHTML(result){
    var aLead = result.powerA >= result.powerB;
    return (
      '<div class="sim-power-row">' +
        '<div class="sim-power-col"><div class="sim-power-label">Power Score</div><div class="sim-power-value' + (aLead ? ' lead' : '') + '">' + result.powerA.toFixed(2) + '</div></div>' +
        '<div class="sim-power-divider"></div>' +
        '<div class="sim-power-col"><div class="sim-power-label">Power Score</div><div class="sim-power-value' + (!aLead ? ' lead' : '') + '">' + result.powerB.toFixed(2) + '</div></div>' +
      '</div>' +
      '<p class="gl-muted" style="margin-top:.5rem;font-size:.68rem">Composite rating from striking output/defense, grappling &amp; finishing rate, and recent form — drives the win-probability estimate above.</p>'
    );
  }

  // Tale of the Tape -- the same raw per-fighter numbers the win-probability
  // model itself reads (worker/fight-sim.js's fighterTaleOfTape(), sourced
  // from FIGHTER_STATS), laid out side by side. No per-row "winner"
  // highlighting -- unlike win% or power score, more of a given stat isn't
  // reliably better (e.g. takedown defense vs. takedown offense pull in
  // opposite directions), so this just shows the numbers straight, the way
  // a tale-of-the-tape table normally does.
  var TAPE_FIELDS = [
    ['Height', 'ht'], ['Reach', 'reach'], ['Stance', 'stance'], ['Age', 'age'],
    ['Str Landed/Min', 'slpm'], ['Str Accuracy', 'strAcc'],
    ['Str Absorbed/Min', 'sapm'], ['Str Defense', 'strDef'],
    ['Takedowns/15min', 'tdLanded'], ['TD Accuracy', 'tdAcc'], ['TD Defense', 'tdDef'],
    ['Sub Attempts/15min', 'subAvg'], ['Finish Rate', 'finRate'],
  ];
  function tapeVal(v){ return (v === null || v === undefined || v === '') ? '—' : String(v); }
  function tapeHTML(tapeA, tapeB){
    if (!tapeA || !tapeB) return '';
    return (
      '<div class="sim-tape">' +
        '<div class="rk-panel-title">Tale of the Tape</div>' +
        TAPE_FIELDS.map(function(f){
          return (
            '<div class="sim-tape-row">' +
              '<div class="sim-tape-val l">' + esc(tapeVal(tapeA[f[1]])) + '</div>' +
              '<div class="sim-tape-label">' + esc(f[0]) + '</div>' +
              '<div class="sim-tape-val r">' + esc(tapeVal(tapeB[f[1]])) + '</div>' +
            '</div>'
          );
        }).join('') +
      '</div>'
    );
  }

  // Style / Pace / Path to victory / Finish & durability / Common opponents /
  // Storylines -- the SAME renderer + CSS classes (.sr-common/.sr-style-*/
  // .sr-cmp-row/.sr-path/.sr-story-line) matchup.js's own breakdownHTML()
  // already uses for scheduled fights, just fed live data for an arbitrary
  // pair (worker/fight-sim.js's matchupBreakdown()) instead of a
  // precomputed one -- no new CSS needed, this is the site's actual output.
  function breakdownHTML(nameA, nameB, t){
    if (!t) return '';
    var sA = surname(nameA), sB = surname(nameB);
    var parts = [];
    var lean = t.lean || {};
    if (lean.a != null || lean.b != null){
      parts.push(
        '<div class="sr-common"><div class="sr-common-title">Style</div>' +
          '<div class="sr-style-track"><div class="sr-style-dot a" style="left:calc(' + (lean.a == null ? 50 : lean.a) + '% - 6px)"></div><div class="sr-style-dot b" style="left:calc(' + (lean.b == null ? 50 : lean.b) + '% - 6px)"></div></div>' +
          '<div class="sr-style-ends"><span>Grappler</span><span>Striker</span></div>' +
          '<div class="sr-style-legend"><span class="a">' + esc(sA) + '</span><span class="b">' + esc(sB) + '</span></div>' +
        '</div>'
      );
    }
    var pace = t.pace || {};
    if (pace.a != null || pace.b != null){
      parts.push(
        '<div class="sr-common"><div class="sr-common-title">Pace (sig. strikes thrown / min)</div>' +
          '<div class="sr-cmp-row"><div class="sr-cmp-lbl"></div><div class="sr-cmp-val">' + esc(pace.a == null ? '—' : pace.a) + '</div><div class="sr-cmp-val">' + esc(pace.b == null ? '—' : pace.b) + '</div></div>' +
        '</div>'
      );
    }
    var path = t.path || {};
    if (path.a || path.b){
      parts.push(
        '<div class="sr-common"><div class="sr-common-title">Path to victory</div>' +
          (path.a ? '<div class="sr-path a"><div class="sr-path-name">' + esc(sA) + '</div>' + esc(path.a) + '</div>' : '') +
          (path.b ? '<div class="sr-path b"><div class="sr-path-name">' + esc(sB) + '</div>' + esc(path.b) + '</div>' : '') +
        '</div>'
      );
    }
    var fd = t.finishDur;
    if (fd){
      parts.push(
        '<div class="sr-common"><div class="sr-common-title">Finish &amp; durability</div>' +
          '<div class="sr-cmp-row"><div class="sr-cmp-lbl">Win finish rate</div><div class="sr-cmp-val">' + esc((fd.finRate && fd.finRate.a) || '—') + '</div><div class="sr-cmp-val">' + esc((fd.finRate && fd.finRate.b) || '—') + '</div></div>' +
          '<div class="sr-cmp-row"><div class="sr-cmp-lbl">Win methods</div><div class="sr-cmp-val">' + esc((fd.methods && fd.methods.a) || '—') + '</div><div class="sr-cmp-val">' + esc((fd.methods && fd.methods.b) || '—') + '</div></div>' +
        '</div>'
      );
    }
    var common = t.common || [];
    if (common.length){
      parts.push(
        '<div class="sr-common"><div class="sr-common-title">Common opponents</div>' +
          common.map(function(c){ return '<div class="sr-common-row"><div class="sr-co-name">' + esc(c.opp) + '</div><div class="sr-co-res">' + esc(sA) + ': ' + esc(c.a) + '</div><div class="sr-co-res">' + esc(sB) + ': ' + esc(c.b) + '</div></div>'; }).join('') +
        '</div>'
      );
    }
    var story = t.story || {};
    if ((story.a && story.a.length) || (story.b && story.b.length)){
      var lines = (story.a || []).map(function(x){ return '<div class="sr-story-line"><span class="a">' + esc(sA) + '</span> ' + esc(x) + '</div>'; })
        .concat((story.b || []).map(function(x){ return '<div class="sr-story-line"><span class="b">' + esc(sB) + '</span> ' + esc(x) + '</div>'; }));
      parts.push('<div class="sr-common"><div class="sr-common-title">Storylines</div>' + lines.join('') + '</div>');
    }
    return parts.join('');
  }

  // ── Matchup Analytics Deep Dive -- reappears on this screen for the exact
  // matchup the Events page's own "Simulate Matchup" button already has real
  // deep-dive data for (see matchup.js's simBarHTML comment), rather than
  // this feature growing to cover every possible simulated pairing. This
  // screen never computes availability itself -- `hubEntry` is either the
  // one already-generated {n1,n2,...} payload for the eventSlug the visitor
  // arrived from (fetched once in load(), see its own comment), or null when
  // they got here some other way (fighter.js's "Run this fighter against
  // anyone" entry point, the tab bar, a typed-in pairing) -- in which case
  // this whole section simply never renders, same as the site has no way to
  // show it for a pairing outside its own grid manifest either.
  //
  // Modal markup/behavior below is a straight duplicate of matchup.js's own
  // hub (same IDs/classes, same site-shipped hubCss, same slide-open-free
  // instant show/hide, same iOS-Safari scroll-lock fix) adapted from a
  // slug-keyed map to a single entry, since this screen only ever has the
  // one matchup open at a time -- see matchup.js's own comments on each
  // piece for the underlying reasoning, not repeated here.
  function ddBarMatches(nameA, nameB){
    return !!hubEntry && ((hubEntry.n1 === nameA && hubEntry.n2 === nameB) || (hubEntry.n1 === nameB && hubEntry.n2 === nameA));
  }
  function ddBarHTML(nameA, nameB){
    if (!ddBarMatches(nameA, nameB)) return '';
    return '<button type="button" class="mf-dd-bar" id="simDDBtn">Matchup Analytics Deep Dive <span class="mf-dd-go">›</span></button>';
  }
  function ensureHubCss(css){
    if (!css || document.getElementById('mfHubCssTag')) return;
    var tag = document.createElement('style');
    tag.id = 'mfHubCssTag';
    tag.textContent = css;
    document.head.appendChild(tag);
  }
  function hubModalHTML(){
    return (
      '<div id="mh-overlay"></div>' +
      '<div id="mh-box" role="dialog" aria-modal="true" aria-label="Matchup analytics">' +
        '<div class="mh-hd" id="mh-hd"></div>' +
        '<div class="mh-tabs" id="mh-tabs">' +
          '<button type="button" class="mh-tab on" data-mh-tab="striking">Striking</button>' +
          '<button type="button" class="mh-tab" data-mh-tab="grappling">Grappling</button>' +
          '<button type="button" class="mh-x" id="mhCloseBtn" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="mh-filter" id="mh-filter">' +
          '<span class="mh-filter-lbl">Fights</span>' +
          '<button type="button" class="mh-filter-btn on" data-mh-filter="all">All</button>' +
          '<button type="button" class="mh-filter-btn" data-mh-filter="win">Wins</button>' +
          '<button type="button" class="mh-filter-btn" data-mh-filter="loss">Losses</button>' +
        '</div>' +
        '<div class="mh-body" id="mh-body"></div>' +
      '</div>'
    );
  }
  var HUB_AV_STYLE = 'width:40px;height:40px;border-radius:50%;overflow:hidden;border:2px solid var(--accent);flex-shrink:0;background:#1a1a1a;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.78rem;color:#fff';
  function hubInitials(nm){
    var p = String(nm || '').trim().split(/\s+/).filter(Boolean);
    if (!p.length) return '?';
    if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
    return (p[0][0] + p[p.length - 1][0]).toUpperCase();
  }
  function hubSide(nm, slug, rec, right){
    var av = slug
      ? '<div style="' + HUB_AV_STYLE + '"><img src="' + window.GL_FIGHTER.PHOTO_BASE + esc(slug) + '.png" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;object-position:top center" onerror="this.parentNode.textContent=\'' + esc(hubInitials(nm)) + '\'"></div>'
      : '<div style="' + HUB_AV_STYLE + '">' + esc(hubInitials(nm)) + '</div>';
    return (
      '<div class="mh-hd-f' + (right ? ' r' : '') + '"' + (slug ? ' data-hub-slug="' + esc(slug) + '" style="cursor:pointer"' : '') + '>' +
        '<span class="mh-hd-av">' + av + '</span>' +
        '<div class="mh-hd-tx"><div class="mh-hd-nm">' + esc(nm) + '</div>' + (rec ? '<div class="mh-hd-rc">' + esc(rec) + '</div>' : '') + '</div>' +
      '</div>'
    );
  }
  function hubShowPane(){
    if (!activeContainer) return;
    var key = hubTabState.tab + '-' + hubTabState.filter;
    activeContainer.querySelectorAll('[data-mh-pane]').forEach(function(p){ p.style.display = (p.getAttribute('data-mh-pane') === key) ? '' : 'none'; });
    var b = activeContainer.querySelector('#mh-body');
    if (b) b.scrollTop = 0;
  }
  function hubRenderEntry(){
    var e = hubEntry;
    if (!e || !activeContainer) return;
    var subBits = [e.weight, e.rounds ? (e.rounds + ' RDS') : ''].filter(Boolean);
    var mid = '<div class="mh-hd-vs">VS</div>' + (subBits.length ? '<div class="mh-hd-sub">' + esc(subBits.join(' · ')) + '</div>' : '');
    var hd = activeContainer.querySelector('#mh-hd');
    if (hd) {
      hd.innerHTML = hubSide(e.n1, e.s1, e.rec1, false) + '<div class="mh-hd-mid">' + mid + '</div>' + hubSide(e.n2, e.s2, e.rec2, true);
      hd.querySelectorAll('[data-hub-slug]').forEach(function(el){
        el.addEventListener('click', function(){
          window.GL_NATIVE.tap();
          var slug = el.getAttribute('data-hub-slug');
          hubClose();
          window.GL_ROUTER.go('fighter', { slug: slug });
        });
      });
    }
    var body = activeContainer.querySelector('#mh-body');
    if (body) body.innerHTML =
      '<div data-mh-pane="striking-all">' + e.striking.all + '</div>' +
      '<div data-mh-pane="striking-win" style="display:none">' + e.striking.win + '</div>' +
      '<div data-mh-pane="striking-loss" style="display:none">' + e.striking.loss + '</div>' +
      '<div data-mh-pane="grappling-all" style="display:none">' + e.grappling.all + '</div>' +
      '<div data-mh-pane="grappling-win" style="display:none">' + e.grappling.win + '</div>' +
      '<div data-mh-pane="grappling-loss" style="display:none">' + e.grappling.loss + '</div>';
    hubShowPane();
  }
  function hubLockScroll(){
    var scroller = document.getElementById('appScroll');
    if (!scroller) return;
    hubScrollY = scroller.scrollTop || 0;
    scroller.style.overflow = 'hidden';
  }
  function hubUnlockScroll(){
    var scroller = document.getElementById('appScroll');
    if (!scroller) return;
    scroller.style.overflow = '';
    scroller.scrollTop = hubScrollY;
  }
  function hubOpen(){
    if (!hubEntry || !activeContainer) return;
    var ov = activeContainer.querySelector('#mh-overlay'), bx = activeContainer.querySelector('#mh-box');
    if (!ov || !bx) return;
    window.GL_NATIVE.tap();
    hubTabState = { tab: 'striking', filter: 'all' };
    hubRenderEntry();
    activeContainer.querySelectorAll('#mh-tabs .mh-tab').forEach(function(b){ b.classList.toggle('on', b.getAttribute('data-mh-tab') === 'striking'); });
    activeContainer.querySelectorAll('#mh-filter .mh-filter-btn').forEach(function(b){ b.classList.toggle('on', b.getAttribute('data-mh-filter') === 'all'); });
    ov.style.display = 'block';
    bx.classList.add('mh-on');
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){
        ov.style.opacity = '1';
        bx.style.opacity = '1';
        bx.style.transform = 'translate(-50%,-50%)';
      });
    });
    hubLockScroll();
  }
  function hubClose(){
    if (!activeContainer) return;
    var ov = activeContainer.querySelector('#mh-overlay'), bx = activeContainer.querySelector('#mh-box');
    if (!ov || !bx) return;
    ov.style.opacity = '0';
    bx.style.opacity = '0';
    bx.style.transform = 'translate(-50%,-50%) translateY(8px)';
    setTimeout(function(){ ov.style.display = 'none'; bx.classList.remove('mh-on'); }, 220);
    hubUnlockScroll();
  }
  function wireHub(container){
    var overlay = container.querySelector('#mh-overlay');
    if (overlay) overlay.addEventListener('click', function(e){ if (e.target === overlay) hubClose(); });
    var closeBtn = container.querySelector('#mhCloseBtn');
    if (closeBtn) closeBtn.addEventListener('click', function(){ window.GL_NATIVE.tap(); hubClose(); });
    container.querySelectorAll('#mh-tabs .mh-tab').forEach(function(btn){
      btn.addEventListener('click', function(){
        window.GL_NATIVE.tap();
        hubTabState.tab = btn.getAttribute('data-mh-tab');
        container.querySelectorAll('#mh-tabs .mh-tab').forEach(function(b){ b.classList.toggle('on', b === btn); });
        hubShowPane();
      });
    });
    container.querySelectorAll('#mh-filter .mh-filter-btn').forEach(function(btn){
      btn.addEventListener('click', function(){
        window.GL_NATIVE.tap();
        hubTabState.filter = btn.getAttribute('data-mh-filter');
        container.querySelectorAll('#mh-filter .mh-filter-btn').forEach(function(b){ b.classList.toggle('on', b === btn); });
        hubShowPane();
      });
    });
  }

  function resultHTML(nameA, nameB, slugA, slugB, result, tapeA, tapeB, breakdown){
    return (
      '<div class="sim-result">' +
        resultsHeaderHTML(nameA, nameB, slugA, slugB, result) +
        '<div class="rk-panel-title">Win Probability</div>' +
        pctBarHTML(result.probA, nameA, nameB) +
        '<div class="sim-result-cols">' +
          '<div><div class="sim-col-h">' + esc(nameA) + ' by</div>' + methodRowsHTML(result.methodsA, result.winsA) + '</div>' +
          '<div><div class="sim-col-h">' + esc(nameB) + ' by</div>' + methodRowsHTML(result.methodsB, result.winsB) + '</div>' +
        '</div>' +
        powerRowHTML(result) +
        tapeHTML(tapeA, tapeB) +
        ddBarHTML(nameA, nameB) +
        breakdownHTML(nameA, nameB, breakdown) +
        '<p class="gl-muted" style="margin-top:1rem;font-size:.72rem">Based on ' + result.n.toLocaleString() + ' simulated fights. A projection, not a prediction — anyone can win on the night.</p>' +
      '</div>'
    );
  }

  function pickerHTML(key, label, prefillName){
    return (
      '<div class="sim-picker">' +
        '<div class="gl-label" style="margin:0 0 .3rem">' + label + '</div>' +
        '<div class="mf-search">' +
          '<input type="text" class="mf-search-input" placeholder="Search fighters…" autocomplete="off" data-pick-input="' + key + '"' + (prefillName ? ' value="' + esc(prefillName) + '"' : '') + '>' +
          '<div class="mf-search-results" hidden data-pick-results="' + key + '"></div>' +
        '</div>' +
      '</div>'
    );
  }

  function shellHTML(prefillA, prefillB, prefillRounds){
    var is5 = prefillRounds === 5;
    return (
      '<div class="gl-sec gl-sec--first">' +
        '<h1 class="gl-heading" style="font-size:1.3rem;margin:0 0 .3rem">Fight Simulator</h1>' +
        '<p class="gl-muted" style="margin:0">Pick any two fighters and run a projection.</p>' +
      '</div>' +
      pickerHTML('a', 'Fighter A', prefillA) +
      pickerHTML('b', 'Fighter B', prefillB) +
      '<div class="sim-rounds">' +
        '<div class="gl-label" style="margin:0 0 .3rem">Fight Length</div>' +
        '<div class="fp-tabs" style="max-width:none">' +
          '<button type="button" class="fp-tab' + (is5 ? '' : ' sel') + '" data-rounds="3">3 Rounds</button>' +
          '<button type="button" class="fp-tab' + (is5 ? ' sel' : '') + '" data-rounds="5">5 Rounds</button>' +
        '</div>' +
      '</div>' +
      '<button type="button" class="gl-btn gl-btn-primary" id="simRunBtn" disabled style="margin-top:1.1rem">Pick both fighters to simulate</button>' +
      '<div id="simOutput" style="margin-top:1.4rem"></div>' +
      hubModalHTML()
    );
  }

  function lockedHTML(){
    return (
      '<div class="fp-lock">' +
        '<div class="fp-lock-h"><span class="fp-lock-ico">🔒</span><div class="fp-lock-t">Fight Simulator</div></div>' +
        '<p class="gl-muted" style="margin:.2rem 0 .9rem">Run any matchup on the roster and see a projected outcome — win probability and method breakdown, powered by the same model as the website.</p>' +
        '<button type="button" class="gl-btn gl-btn-primary" data-goto="premium">Go Premium to unlock the simulator</button>' +
      '</div>'
    );
  }

  function wireShell(container, prefillA, prefillB, prefillRounds){
    var picked = { a: prefillA || null, b: prefillB || null };
    var rounds = prefillRounds === 5 ? 5 : 3;
    var runBtn = container.querySelector('#simRunBtn');
    var output = container.querySelector('#simOutput');

    function refreshButton(){
      if (picked.a && picked.b && picked.a !== picked.b){
        runBtn.disabled = false;
        runBtn.textContent = 'Simulate';
      } else if (picked.a && picked.b && picked.a === picked.b){
        runBtn.disabled = true;
        runBtn.textContent = 'Pick two different fighters';
      } else {
        runBtn.disabled = true;
        runBtn.textContent = 'Pick both fighters to simulate';
      }
    }

    makePicker(container, 'a', function(name){ picked.a = name; refreshButton(); });
    makePicker(container, 'b', function(name){ picked.b = name; refreshButton(); });
    refreshButton();

    container.querySelectorAll('[data-rounds]').forEach(function(btn){
      btn.addEventListener('click', function(){
        window.GL_NATIVE.tap();
        rounds = parseInt(btn.getAttribute('data-rounds'), 10);
        container.querySelectorAll('[data-rounds]').forEach(function(b){ b.classList.toggle('sel', b === btn); });
      });
    });

    function runSimulation(){
      if (runBtn.disabled) return;
      var prevText = runBtn.textContent;
      runBtn.disabled = true;
      runBtn.textContent = 'Simulating…';
      output.innerHTML = '';
      window.GL_API.fightSim(picked.a, picked.b, rounds).then(function(res){
        output.innerHTML = resultHTML(res.a, res.b, res.slugA, res.slugB, res.result, res.tapeA, res.tapeB, res.breakdown);
        output.querySelectorAll('[data-sim-slug]').forEach(function(el){
          el.addEventListener('click', function(){
            window.GL_NATIVE.tap();
            window.GL_ROUTER.go('fighter', { slug: el.getAttribute('data-sim-slug') });
          });
        });
        var ddBtn = output.querySelector('#simDDBtn');
        if (ddBtn) ddBtn.addEventListener('click', function(){ window.GL_NATIVE.tap(); hubOpen(); });
        runBtn.disabled = false;
        runBtn.textContent = 'Run It Again';
      }).catch(function(err){
        output.innerHTML = '<p class="gl-error">' + esc((err && err.data && err.data.error) || 'Couldn’t run the simulation — check your connection and try again.') + '</p>';
        runBtn.disabled = false;
        runBtn.textContent = prevText;
      });
    }

    runBtn.addEventListener('click', function(){
      window.GL_NATIVE.tap();
      runSimulation();
    });

    // Arriving here already knowing both fighters (the Card page's own
    // "Simulate Matchup" button, mirroring the site's simulateMatchup() ->
    // navigate('projections') -> auto runFightSimulator()) runs it
    // immediately rather than making the user tap Simulate a second time.
    if (picked.a && picked.b && picked.a !== picked.b) runSimulation();
  }

  function load(container, params){
    container.innerHTML = '<p class="gl-muted">Loading…</p>';
    window.GL_API.account().catch(function(){ return null; }).then(function(acct){
      var subscribed = !!(acct && acct.subscribed);
      if (!subscribed){
        container.innerHTML = lockedHTML();
        var goPrem = container.querySelector('[data-goto="premium"]');
        if (goPrem) goPrem.addEventListener('click', function(){
          window.GL_NATIVE.tap();
          window.GL_ROUTER.go('premium');
        });
        return;
      }
      // `a` is the current param shape (fighter.js's CTA, matchup.js's
      // Simulate Matchup button); `name` is kept for back-compat with
      // anything still calling go('simulator', {name}) fighter-A-only style.
      var prefillA = (params && (params.a || params.name)) || null;
      var prefillB = (params && params.b) || null;
      var prefillRounds = (params && params.rounds === 5) ? 5 : 3;
      // `dd` is only ever set by matchup.js's own Simulate Matchup button,
      // and only on the one bout per card that already has real Matchup
      // Analytics Deep Dive data -- see its own comment. Reuses the exact
      // same /api/app/matchup endpoint + hub payload the Events page itself
      // just rendered from, rather than this screen computing or fetching
      // anything new on its own.
      var ddSlug = (params && params.dd) || null;
      var hubPromise = ddSlug
        ? window.GL_API.matchup(ddSlug).then(function(res){
            if (res && res.hubCss) ensureHubCss(res.hubCss);
            return (res && res.hub) || null;
          }).catch(function(){ return null; })
        : Promise.resolve(null);
      hubPromise.then(function(hub){
        hubEntry = hub;
        container.innerHTML = shellHTML(prefillA, prefillB, prefillRounds);
        activeContainer = container;
        wireShell(container, prefillA, prefillB, prefillRounds);
        wireHub(container);
      });
    });
  }

  return { load: load };
})();
