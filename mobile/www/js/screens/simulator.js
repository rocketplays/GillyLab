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
    return (
      '<div class="sim-probbar">' +
        '<div class="sim-probbar-a" style="width:' + a + '%">' + (a >= 12 ? a + '%' : '') + '</div>' +
        '<div class="sim-probbar-b" style="width:' + b + '%">' + (b >= 12 ? b + '%' : '') + '</div>' +
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

  function resultHTML(nameA, nameB, result){
    return (
      '<div class="sim-result">' +
        '<div class="rk-panel-title">Win Probability</div>' +
        pctBarHTML(result.probA, nameA, nameB) +
        '<div class="sim-result-cols">' +
          '<div><div class="sim-col-h">' + esc(nameA) + ' by</div>' + methodRowsHTML(result.methodsA, result.winsA) + '</div>' +
          '<div><div class="sim-col-h">' + esc(nameB) + ' by</div>' + methodRowsHTML(result.methodsB, result.winsB) + '</div>' +
        '</div>' +
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
          '<button type="button" class="fp-tab' + (is5 ? ' sel' : '') + '" data-rounds="5">5 Rounds (Title)</button>' +
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
        output.innerHTML = resultHTML(res.a, res.b, res.result);
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
