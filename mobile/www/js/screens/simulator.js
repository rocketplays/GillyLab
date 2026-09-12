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
      '<div id="simOutput" style="margin-top:1.4rem"></div>'
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
      container.innerHTML = shellHTML(prefillA, prefillB, prefillRounds);
      wireShell(container, prefillA, prefillB, prefillRounds);
    });
  }

  return { load: load };
})();
