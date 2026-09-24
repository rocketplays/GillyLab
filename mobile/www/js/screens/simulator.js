// Fight Simulator -- Premium's flagship tool: pick any two fighters, run a
// Monte Carlo projection. A full route (not a modal), reached two different
// ways that want two different back-button behaviors: a direct tap on the
// Simulator tab (no back button -- it's a tab-bar destination, same as
// Odds or Events) or the Events page's "Simulate Matchup" button, which
// prefills both fighters and should get a back button since it was pushed
// from there. No static `showBack` here for that reason -- see
// matchup.js's own go('simulator', ..., { showBack: true }) call and
// router.js's go()/opts.showBack for how the two are told apart.
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
  // Custom Simulator ("Build Your Own Simulation") state -- see the section
  // below this file's own breakdownHTML() for what these hold.
  var csState = null, csScrollY = 0;
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
          '<div class="sim-res-tx">' +
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

  // ── Build Your Own Simulation ("Custom Simulator") ──────────────────────
  // App-native port of index.html's cs*() functions (see that block's own
  // header comment). One fetch when the modal opens (GL_API.customSimBase --
  // worker/index.js's /api/app/custom-sim-base -> worker/fight-sim.js's
  // customSimBase()/customSimMethodBaseline(), the real per-category
  // power-score components for both fighters plus the fixed style/closeness/
  // h2h/unproven/k pipeline pieces the site's own csBuildBase() computes),
  // then every slider drag below is pure client-side arithmetic over that
  // one small object -- no further requests, same as the site.
  var CS_CATEGORIES = [
    { key: 'striking',   name: 'Striking',              desc: 'Volume and accuracy landed minus damage absorbed.' },
    { key: 'wrestling',  name: 'Wrestling',              desc: 'Ability to get it to the mat or keep the fight standing.' },
    { key: 'grappling',  name: 'Grappling / Submissions', desc: 'Ability to find submissions on the mat, or stay safe from submission attempts.' },
    { key: 'finishing',  name: 'Finishing power',        desc: 'Finish rate and knockdowns scored.' },
    { key: 'form',       name: 'Recent form',            desc: 'Current win streak / momentum.' },
    { key: 'durability', name: 'Durability / chin',      desc: 'A proven pattern of being able to withstand damage.' },
    { key: 'schedule',   name: 'Strength of schedule',   desc: 'Quality-of-opposition multiplier applied to striking, grappling, and finishing.' },
    { key: 'fightIQ',    name: 'Fight IQ',               desc: 'Gameplanning, in-fight adjustments, and ability to execute the gameplan.', userOnly: true },
  ];
  var CS_EDGE_FLOOR = { striking: 4, wrestling: 3, grappling: 2.5, finishing: 5, form: 1.5, durability: 1.2, schedule: 1.5, fightIQ: 5 };
  var CS_EQUAL_SHARE = 100 / CS_CATEGORIES.length;
  var CS_METHOD_SENSITIVITY = 0.35;
  // Matches worker/fight-sim.js's customSimMethodBaseline() comment: the two
  // constants simMethodDistribution's own winProb-dependent "dominance" bend
  // uses, applied here client-side against the server-supplied pre-dominance
  // {selfFin, koShare} baseline instead of round-tripping per slider drag.
  var CS_DOMINANCE_K = 0.30, CS_DOMINANCE_FACTOR_CAP = 2.2;

  function csRawGap(catKey, base) {
    if (catKey === 'fightIQ') return 0;
    return base.bdB.components[catKey] - base.bdA.components[catKey];
  }
  function csEdgeMax(catKey, base) {
    var floor = CS_EDGE_FLOOR[catKey] || 4;
    return Math.max(floor, Math.abs(csRawGap(catKey, base)) * 1.8);
  }
  function csClampedGap(catKey, base) {
    var max = csEdgeMax(catKey, base);
    return Math.max(-max, Math.min(max, csRawGap(catKey, base)));
  }
  function csWeightMult(catKey) { return csState.cats[catKey].weightPct / CS_EQUAL_SHARE; }
  function csDefaultCats(base) {
    var cats = {};
    CS_CATEGORIES.forEach(function(c){ cats[c.key] = { edge: csRawGap(c.key, base), weightPct: CS_EQUAL_SHARE, locked: false }; });
    return cats;
  }
  function csLockedSum(excludeKey) {
    return CS_CATEGORIES.reduce(function(s, c){
      return s + ((c.key !== excludeKey && csState.cats[c.key].locked) ? csState.cats[c.key].weightPct : 0);
    }, 0);
  }
  // "Pie allocator" redistribution -- locked categories are walled off
  // entirely (never move, never counted as room to borrow from); only the
  // unlocked "free" categories (excluding the one being dragged) absorb the
  // remainder, proportional to their current shares, so the total across all
  // eight always comes out to 100.
  function csNormalizeWeights(catKey, newVal) {
    var lockedSum = csLockedSum(catKey);
    var room = Math.max(0, 100 - lockedSum);
    newVal = Math.max(0, Math.min(room, newVal));
    var freeOthers = CS_CATEGORIES.map(function(c){ return c.key; }).filter(function(k){ return k !== catKey && !csState.cats[k].locked; });
    var remaining = room - newVal;
    if (freeOthers.length > 0) {
      var oldFreeSum = freeOthers.reduce(function(s, k){ return s + csState.cats[k].weightPct; }, 0);
      if (oldFreeSum <= 0.0001) {
        freeOthers.forEach(function(k){ csState.cats[k].weightPct = remaining / freeOthers.length; });
      } else {
        freeOthers.forEach(function(k){ csState.cats[k].weightPct = (csState.cats[k].weightPct / oldFreeSum) * remaining; });
      }
    }
    csState.cats[catKey].weightPct = newVal;
  }
  function csToggleLock(catKey) {
    var st = csState.cats[catKey];
    if (st.locked) { st.locked = false; return; }
    var room = Math.max(0, 100 - csLockedSum(catKey));
    if (st.weightPct > room) csNormalizeWeights(catKey, room);
    st.locked = true;
  }
  function csCustomDiff() {
    var diff = csState.base.bdA.components.other - csState.base.bdB.components.other;
    CS_CATEGORIES.forEach(function(c){
      var st = csState.cats[c.key];
      diff += -st.edge * csWeightMult(c.key);
    });
    return diff;
  }
  function csProbFromDiff(saMinusSb, base) {
    var statDiff = (saMinusSb + base.styleDelta) * (1 - 0.8 * base.closeness);
    var diff = statDiff + base.h2h - base.unpA + base.unpB;
    var raw = 1 / (1 + Math.exp(-diff / base.k));
    return Math.min(0.96, Math.max(0.04, raw));
  }
  // The winProb-dependent tail of index.html's simMethodDistribution --
  // dominance bend (a bigger favorite finishes more) plus the 5-round
  // decision-to-finish shift -- run here against the server-supplied
  // pre-dominance baseline instead of FIGHT_HISTORY, so it's cheap enough to
  // rerun on every slider input event. See worker/fight-sim.js's
  // customSimMethodBaseline() for the baseline half of this split.
  function csMethodFromBaseline(baseline, winProb, rounds) {
    var selfFin = baseline.selfFin, koShare = baseline.koShare;
    if (winProb != null && winProb > 0 && winProb < 1) {
      var domFactor = Math.min(CS_DOMINANCE_FACTOR_CAP, Math.max(1 / CS_DOMINANCE_FACTOR_CAP,
        Math.pow(winProb / (1 - winProb), CS_DOMINANCE_K)));
      var fo = (selfFin / (1 - selfFin)) * domFactor;
      selfFin = fo / (1 + fo);
    }
    var pKO = selfFin * koShare;
    var pSub = selfFin * (1 - koShare);
    var pDec = 1 - selfFin;
    if (rounds === 5 && pDec > 0) {
      var shift = pDec * 0.15;
      var finTot = (pKO + pSub) || 1;
      pKO += shift * (pKO / finTot);
      pSub += shift * (pSub / finTot);
      pDec -= shift;
    }
    return { 'KO/TKO': pKO, 'Submission': pSub, 'Decision': pDec };
  }
  function csMethodDeviation(catKey) {
    var base = csState.base;
    var max = csEdgeMax(catKey, base);
    if (!max) return 0;
    return (csState.cats[catKey].edge - csClampedGap(catKey, base)) / max;
  }
  // {KO/TKO, Submission, Decision} for a win by nameA (winnerKey 'A') or
  // nameB ('B'). applyDeviation=false reproduces the calibrated model's own
  // method read (winProb = the calibrated probability); applyDeviation=true
  // bends it by the finishing/grappling/durability slider deviations only,
  // for "Your custom read" -- same split as the site's csMethodFor().
  function csMethodFor(winnerKey, winProb, applyDeviation) {
    var baseline = winnerKey === 'A' ? csState.methodBaseline.aWins : csState.methodBaseline.bWins;
    var real = csMethodFromBaseline(baseline, winProb, csState.base.rounds);
    if (!applyDeviation) return real;
    var finDev = csMethodDeviation('finishing');
    var grapDev = csMethodDeviation('grappling');
    var durDev = csMethodDeviation('durability');
    var sideSign = winnerKey === 'A' ? -1 : 1;
    var koAdj = sideSign * finDev * CS_METHOD_SENSITIVITY;
    var subAdj = sideSign * grapDev * CS_METHOD_SENSITIVITY;
    var loserIsB = winnerKey === 'A';
    var finRateAdj = (loserIsB ? -1 : 1) * durDev * CS_METHOD_SENSITIVITY;
    var ko = real['KO/TKO'], sub = real['Submission'];
    var finRate = ko + sub;
    var koShare0 = finRate > 0 ? ko / finRate : 0.5;
    var subShare0 = finRate > 0 ? sub / finRate : 0.5;
    var finRateNew = Math.max(0, Math.min(1, finRate + finRateAdj));
    var koShareNew = Math.max(0, Math.min(1, koShare0 + koAdj));
    var subShareNew = Math.max(0, Math.min(1, subShare0 + subAdj));
    var shareTot = koShareNew + subShareNew;
    if (shareTot > 0.0001) { koShareNew /= shareTot; subShareNew /= shareTot; }
    else { koShareNew = 0.5; subShareNew = 0.5; }
    var koNew = finRateNew * koShareNew;
    var subNew = finRateNew * subShareNew;
    return { 'KO/TKO': koNew, 'Submission': subNew, 'Decision': Math.max(0, 1 - koNew - subNew) };
  }
  function csMethodText(dist) {
    return 'KO/TKO ' + Math.round(dist['KO/TKO'] * 100) + '% &middot; Sub ' +
      Math.round(dist['Submission'] * 100) + '% &middot; Dec ' + Math.round(dist['Decision'] * 100) + '%';
  }
  function csEdgeBucket(value, catKey, base) {
    var max = csEdgeMax(catKey, base);
    var abs = Math.abs(value);
    var mag;
    if (abs < max * 0.1) mag = 'Roughly even';
    else if (abs < max * 0.3) mag = 'Slight edge';
    else if (abs < max * 0.6) mag = 'Clear edge';
    else mag = 'Huge edge';
    if (mag === 'Roughly even') return { text: mag, leader: null };
    return { text: mag, leader: value < 0 ? csState.nameA : csState.nameB };
  }
  function csBucketLabel(b) { return b.leader ? (b.text + ': ' + b.leader) : b.text; }
  function csFmtPct(v) {
    var r = Math.round(v * 10) / 10;
    return Number.isInteger(r) ? String(r) : r.toFixed(1);
  }

  function csModalHTML() {
    return (
      '<div id="cs-overlay"></div>' +
      '<div id="cs-box" role="dialog" aria-modal="true" aria-label="Build your own simulation">' +
        '<div class="cs-hd" id="cs-hd"></div>' +
        '<div class="cs-tag">' +
          '<div class="cs-tag-lbl">For each category, set <b>who\'s better and by how much</b>, then how much it <b>matters in this matchup</b> — a shared 100% pool across all eight, so raising one always lowers the others.</div>' +
          '<button type="button" class="cs-x" id="csCloseBtn" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="cs-body" id="cs-body"></div>' +
      '</div>'
    );
  }
  function csHeaderHtml() {
    var s = csState;
    function side(name, slug, rec, right) {
      var av = slug
        ? '<div style="' + HUB_AV_STYLE + '"><img src="' + window.GL_FIGHTER.PHOTO_BASE + esc(slug) + '.png" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;object-position:top center" onerror="this.parentNode.textContent=\'' + esc(hubInitials(name)) + '\'"></div>'
        : '<div style="' + HUB_AV_STYLE + '">' + esc(hubInitials(name)) + '</div>';
      return (
        '<div class="cs-hd-f' + (right ? ' r' : '') + '" data-cs-open="' + (right ? 'b' : 'a') + '" role="button" tabindex="0">' +
          '<span class="mh-hd-av">' + av + '</span>' +
          '<div class="cs-hd-tx"><div class="cs-hd-nm">' + esc(name) + '</div>' + (rec ? '<div class="cs-hd-rc">' + esc(rec) + '</div>' : '') + '</div>' +
        '</div>'
      );
    }
    return side(s.nameA, s.slugA, s.recA, false) +
      '<div class="cs-hd-mid"><div class="cs-hd-vs">VS</div></div>' +
      side(s.nameB, s.slugB, s.recB, true);
  }
  function csOpenFighter(slug) {
    if (!slug) return;
    closeCustomSimulator();
    setTimeout(function(){ window.GL_ROUTER.go('fighter', { slug: slug }); }, 80);
  }
  function csRenderResults() {
    var base = csState.base;
    var calDiff = base.bdA.total - base.bdB.total;
    var curDiff = csCustomDiff();
    var calPA = csProbFromDiff(calDiff, base), calPB = 1 - calPA;
    var curPA = csProbFromDiff(curDiff, base), curPB = 1 - curPA;
    var host = csState.host;
    function setBar(prefix, pA, pB) {
      var fillA = host.querySelector('#' + prefix + 'FillA'), fillB = host.querySelector('#' + prefix + 'FillB');
      var pctA = host.querySelector('#' + prefix + 'PctA'), pctB = host.querySelector('#' + prefix + 'PctB');
      if (fillA) fillA.style.width = (pA * 100).toFixed(1) + '%';
      if (fillB) fillB.style.width = (pB * 100).toFixed(1) + '%';
      if (pctA) pctA.textContent = Math.round(pA * 100) + '%';
      if (pctB) pctB.textContent = Math.round(pB * 100) + '%';
    }
    setBar('csCal', calPA, calPB);
    setBar('csCur', curPA, curPB);
    function setMethod(idName, idVals, name, dist) {
      var nmEl = host.querySelector('#' + idName), valEl = host.querySelector('#' + idVals);
      if (nmEl) nmEl.textContent = surname(name);
      if (valEl) valEl.innerHTML = csMethodText(dist);
    }
    setMethod('csCalMethodNameA', 'csCalMethodA', csState.nameA, csMethodFor('A', calPA, false));
    setMethod('csCalMethodNameB', 'csCalMethodB', csState.nameB, csMethodFor('B', calPB, false));
    setMethod('csCurMethodNameA', 'csCurMethodA', csState.nameA, csMethodFor('A', curPA, true));
    setMethod('csCurMethodNameB', 'csCurMethodB', csState.nameB, csMethodFor('B', curPB, true));
    var drift = Math.round((curPA - calPA) * 100);
    var driftEl = host.querySelector('#csDriftNote');
    if (driftEl) driftEl.textContent = Math.abs(drift) < 1 ? '' : (surname(csState.nameA) + ': ' + (drift > 0 ? '+' : '') + drift + ' pts win chance vs GillyLab model');
  }
  function csUpdateComputedBits() {
    var base = csState.base;
    var host = csState.host;
    CS_CATEGORIES.forEach(function(c){
      var st = csState.cats[c.key];
      var cur = csEdgeBucket(st.edge, c.key, base);
      var labelEl = host.querySelector('[data-cs-edge-label="' + c.key + '"]');
      if (labelEl) labelEl.innerHTML = cur.leader ? (cur.text + ': <span class="cs-who">' + esc(cur.leader) + '</span>') : cur.text;
      var subEl = host.querySelector('[data-cs-edge-sub="' + c.key + '"]');
      if (subEl) {
        if (c.userOnly) {
          subEl.classList.remove('diff');
          subEl.textContent = 'No model signal here — this one is your read only.';
        } else {
          var cal = csEdgeBucket(csClampedGap(c.key, base), c.key, base);
          var same = cur.text === cal.text && cur.leader === cal.leader;
          subEl.classList.toggle('diff', !same);
          subEl.textContent = same ? 'Matches what the GillyLab model says' : ('GillyLab model says: ' + csBucketLabel(cal));
        }
      }
      var wInput = host.querySelector('input[data-cs-role="weight"][data-cs-cat="' + c.key + '"]');
      if (wInput) wInput.value = Math.round(st.weightPct);
      var wLbl = host.querySelector('[data-cs-weight-pct="' + c.key + '"]');
      if (wLbl) { wLbl.textContent = csFmtPct(st.weightPct) + '%'; wLbl.classList.toggle('zero', st.weightPct < 0.5); }
    });
  }
  function csUpdateOutputsOnly() {
    csUpdateComputedBits();
    csRenderResults();
  }
  function csRenderCategories() {
    var host = csState.host;
    var catsHost = host.querySelector('#csCatsHost');
    if (!catsHost) return;
    var base = csState.base;
    var html = '';
    CS_CATEGORIES.forEach(function(c){
      var st = csState.cats[c.key];
      var tickHtml = c.userOnly ? '' :
        '<div class="cs-edge-tick" style="left:' + (((csClampedGap(c.key, base) + csEdgeMax(c.key, base)) / (2 * csEdgeMax(c.key, base))) * 100) + '%"></div>';
      var max = csEdgeMax(c.key, base);
      html += '' +
        '<div class="cs-cat">' +
          '<div class="cs-cat-nm">' + esc(c.name) + (c.userOnly ? ' <span style="color:var(--muted);font-weight:600;font-size:.68rem;text-transform:uppercase;letter-spacing:.04em">(your read only)</span>' : '') + '</div>' +
          '<div class="cs-cat-desc">' + esc(c.desc) + '</div>' +
          '<div class="cs-step">' +
            '<div class="cs-step-lbl">Who\'s better here, and how clearly</div>' +
            '<div class="cs-edge-label" data-cs-edge-label="' + c.key + '"></div>' +
            '<div class="cs-edge-sub" data-cs-edge-sub="' + c.key + '"></div>' +
            '<div class="cs-edge-track-wrap">' + tickHtml +
              '<input type="range" min="' + (-max) + '" max="' + max + '" step="' + (max / 100) + '" value="' + st.edge + '" data-cs-cat="' + c.key + '" data-cs-role="edge">' +
            '</div>' +
            '<div class="cs-edge-endcaps"><span>' + esc(csState.nameA) + '</span><span>' + esc(csState.nameB) + '</span></div>' +
          '</div>' +
          '<div class="cs-step">' +
            '<div class="cs-step-lbl">How much does it matter in this matchup? (pool of 100% across all eight' +
              (st.locked ? ' &mdash; locked, the rest split the remainder' : '') + ')</div>' +
            '<div class="cs-weight-row">' +
              '<input type="range" min="0" max="100" step="1" value="' + Math.round(st.weightPct) + '" data-cs-cat="' + c.key + '" data-cs-role="weight"' + (st.locked ? ' disabled' : '') + '>' +
              '<span class="cs-weight-pct' + (st.weightPct < 0.5 ? ' zero' : '') + '" data-cs-weight-pct="' + c.key + '">' + csFmtPct(st.weightPct) + '%</span>' +
              '<button type="button" class="cs-lock-btn' + (st.locked ? ' locked' : '') + '" data-cs-cat="' + c.key + '" data-cs-role="lock">' + (st.locked ? 'Locked' : 'Lock') + '</button>' +
            '</div>' +
          '</div>' +
        '</div>';
    });
    catsHost.innerHTML = html;
    catsHost.querySelectorAll('input[data-cs-role="edge"]').forEach(function(inp){
      inp.addEventListener('input', function(e){
        var cat = e.target.getAttribute('data-cs-cat');
        csState.cats[cat].edge = parseFloat(e.target.value);
        csUpdateOutputsOnly();
      });
    });
    catsHost.querySelectorAll('input[data-cs-role="weight"]').forEach(function(inp){
      inp.addEventListener('input', function(e){
        var cat = e.target.getAttribute('data-cs-cat');
        csNormalizeWeights(cat, parseFloat(e.target.value));
        csUpdateOutputsOnly();
      });
    });
    catsHost.querySelectorAll('button[data-cs-role="lock"]').forEach(function(btn){
      btn.addEventListener('click', function(e){
        window.GL_NATIVE.tap();
        var cat = e.currentTarget.getAttribute('data-cs-cat');
        csToggleLock(cat);
        csRenderCategories();
        csRenderResults();
      });
    });
    csUpdateComputedBits();
  }
  function csResultsHtml() {
    return '' +
      '<div class="cs-results">' +
        '<div class="cs-resbox">' +
          '<div class="cs-res-lbl"><span>GillyLab Model</span></div>' +
          '<div class="cs-barrow"><span class="cs-nm" id="csCalNameA"></span><div class="cs-track"><div class="cs-fill a" id="csCalFillA" style="width:50%"></div></div><span class="cs-pct" id="csCalPctA">50%</span></div>' +
          '<div class="cs-barrow"><span class="cs-nm" id="csCalNameB"></span><div class="cs-track"><div class="cs-fill b" id="csCalFillB" style="width:50%"></div></div><span class="cs-pct" id="csCalPctB">50%</span></div>' +
          '<div class="cs-method">' +
            '<div class="cs-method-hd">Method of victory</div>' +
            '<div class="cs-method-row"><span class="cs-method-nm" id="csCalMethodNameA"></span><span class="cs-method-vals" id="csCalMethodA"></span></div>' +
            '<div class="cs-method-row"><span class="cs-method-nm" id="csCalMethodNameB"></span><span class="cs-method-vals" id="csCalMethodB"></span></div>' +
          '</div>' +
        '</div>' +
        '<div class="cs-resbox custom">' +
          '<div class="cs-res-lbl"><span>Your custom read</span><span class="cs-drift" id="csDriftNote"></span></div>' +
          '<div class="cs-barrow"><span class="cs-nm" id="csCurNameA"></span><div class="cs-track"><div class="cs-fill a" id="csCurFillA" style="width:50%"></div></div><span class="cs-pct" id="csCurPctA">50%</span></div>' +
          '<div class="cs-barrow"><span class="cs-nm" id="csCurNameB"></span><div class="cs-track"><div class="cs-fill b" id="csCurFillB" style="width:50%"></div></div><span class="cs-pct" id="csCurPctB">50%</span></div>' +
          '<div class="cs-method">' +
            '<div class="cs-method-hd">Method of victory <span style="color:var(--muted);font-weight:600">(driven by finishing power, grappling, and durability only)</span></div>' +
            '<div class="cs-method-row"><span class="cs-method-nm" id="csCurMethodNameA"></span><span class="cs-method-vals" id="csCurMethodA"></span></div>' +
            '<div class="cs-method-row"><span class="cs-method-nm" id="csCurMethodNameB"></span><span class="cs-method-vals" id="csCurMethodB"></span></div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div id="csCatsHost"></div>' +
      '<button type="button" class="cs-run-btn" id="csRunBtn">Jump to Results</button>' +
      '<button type="button" class="cs-reset-btn" id="csResetBtn">Reset</button>';
  }
  function csRenderAll() {
    var host = csState.host;
    host.querySelector('#cs-hd').innerHTML = csHeaderHtml();
    host.querySelector('#cs-hd').querySelectorAll('[data-cs-open]').forEach(function(el){
      el.addEventListener('click', function(){
        window.GL_NATIVE.tap();
        csOpenFighter(el.getAttribute('data-cs-open') === 'a' ? csState.slugA : csState.slugB);
      });
    });
    host.querySelector('#cs-body').innerHTML = csResultsHtml();
    host.querySelector('#csCalNameA').textContent = csState.nameA;
    host.querySelector('#csCalNameB').textContent = csState.nameB;
    host.querySelector('#csCurNameA').textContent = csState.nameA;
    host.querySelector('#csCurNameB').textContent = csState.nameB;
    csRenderCategories();
    csRenderResults();
    host.querySelector('#csResetBtn').addEventListener('click', function(){
      window.GL_NATIVE.tap();
      csState.cats = csDefaultCats(csState.base);
      csRenderCategories();
      csRenderResults();
    });
    // Every slider already updates the result bars live -- this just scrolls
    // #cs-body back to the top so the results are visible again after
    // scrolling down through the eight category cards, same reasoning as the
    // site's own csRunBtn.
    host.querySelector('#csRunBtn').addEventListener('click', function(){
      window.GL_NATIVE.tap();
      var body = host.querySelector('#cs-body');
      if (body) body.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
  function _csKey(e) { if (e.key === 'Escape') closeCustomSimulator(); }
  function csLockScroll() {
    var scroller = document.getElementById('appScroll');
    if (!scroller) return;
    csScrollY = scroller.scrollTop || 0;
    scroller.style.overflow = 'hidden';
  }
  function csUnlockScroll() {
    var scroller = document.getElementById('appScroll');
    if (!scroller) return;
    scroller.style.overflow = '';
    scroller.scrollTop = csScrollY;
  }
  function openCustomSimulator(container, nameA, nameB, rounds, byoBtn) {
    if (!nameA || !nameB || nameA === nameB) return;
    var prevText = byoBtn ? byoBtn.textContent : '';
    if (byoBtn) { byoBtn.disabled = true; byoBtn.textContent = 'Loading…'; }
    window.GL_API.customSimBase(nameA, nameB, rounds).then(function(res){
      if (byoBtn) { byoBtn.disabled = false; byoBtn.textContent = prevText; }
      if (!res || !res.base) return;
      var box = container.querySelector('#cs-box'), ov = container.querySelector('#cs-overlay');
      if (!box || !ov) return;
      csState = {
        host: container, nameA: res.base.nameA, nameB: res.base.nameB,
        slugA: res.slugA || null, slugB: res.slugB || null, recA: res.recA || null, recB: res.recB || null,
        base: res.base, methodBaseline: res.methodBaseline, cats: csDefaultCats(res.base),
      };
      csRenderAll();
      ov.style.display = 'block'; ov.style.opacity = '0';
      box.classList.add('cs-on'); box.style.opacity = '0';
      box.style.transform = 'translate(-50%,-50%) translateY(8px)';
      requestAnimationFrame(function(){ requestAnimationFrame(function(){
        ov.style.opacity = '1'; box.style.opacity = '1';
        box.style.transform = 'translate(-50%,-50%)';
      }); });
      csLockScroll();
      document.addEventListener('keydown', _csKey);
    }).catch(function(){
      if (byoBtn) { byoBtn.disabled = false; byoBtn.textContent = prevText; }
    });
  }
  function closeCustomSimulator() {
    if (!csState) return;
    var host = csState.host;
    var box = host.querySelector('#cs-box'), ov = host.querySelector('#cs-overlay');
    if (box && ov && box.classList.contains('cs-on')) {
      ov.style.opacity = '0';
      box.style.opacity = '0';
      box.style.transform = 'translate(-50%,-50%) translateY(8px)';
      setTimeout(function(){ ov.style.display = 'none'; box.classList.remove('cs-on'); }, 220);
    }
    csState = null;
    csUnlockScroll();
    document.removeEventListener('keydown', _csKey);
  }
  function wireCustomSim(container) {
    var overlay = container.querySelector('#cs-overlay');
    if (overlay) overlay.addEventListener('click', function(){ window.GL_NATIVE.tap(); closeCustomSimulator(); });
    var closeBtn = container.querySelector('#csCloseBtn');
    if (closeBtn) closeBtn.addEventListener('click', function(){ window.GL_NATIVE.tap(); closeCustomSimulator(); });
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
  // Inline `display:none` on both wrapper elements, NOT left to the injected
  // hubCss alone: this markup is appended unconditionally in shellHTML() even
  // when the screen was opened without a `dd` param (no deep-dive data for
  // this pairing), in which case ensureHubCss() never runs and the site's
  // stylesheet (which is what actually hides #mh-overlay/#mh-box) never gets
  // injected. Without this, the raw modal contents -- "Striking", "Grappling",
  // "All", "Wins", "Losses", "×" -- rendered as plain unstyled text at the
  // bottom of the page on first load. hubOpen()/hubClose() already set
  // `.style.display` directly via JS, so this inline default only matters
  // before hubCss (if it ever loads) or a real open/close has run.
  function hubModalHTML(){
    return (
      '<div id="mh-overlay" style="display:none"></div>' +
      '<div id="mh-box" role="dialog" aria-modal="true" aria-label="Matchup analytics" style="display:none">' +
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
    // Clears the defensive inline `display:none` hubModalHTML() ships with
    // (see its own comment) -- an inline style outranks the injected
    // hubCss's `#mh-box.mh-on{display:flex}` class rule regardless of
    // specificity, so leaving it in place would silently break every open
    // from here on. Safe unconditionally: reaching this line already means
    // hubEntry exists, which only happens after ensureHubCss() has run.
    bx.style.display = '';
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
        (window.GL_SHEET ? '<button type="button" class="gl-sheet-btn" id="simShareBtn">Share this simulation</button>' : '') +
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
        '<h1 class="gl-heading" style="margin:.1rem 0 .2rem">Fight <span style="color:var(--accent)">Simulator</span></h1>' +
        '<p class="gl-muted" style="margin:0 0 1rem">Pick any two fighters and run a projection.</p>' +
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
      '<button type="button" class="gl-btn gl-btn-primary gl-btn-notready" id="simRunBtn" style="margin-top:1.1rem">Pick both fighters to simulate</button>' +
      '<button type="button" class="sim-byo-btn gl-btn-notready" id="simByoBtn">Build Your Own Simulation</button>' +
      '<div id="simPickError"></div>' +
      '<div id="simOutput" style="margin-top:1.4rem"></div>' +
      hubModalHTML() +
      csModalHTML()
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
    var byoBtn = container.querySelector('#simByoBtn');
    var output = container.querySelector('#simOutput');
    var pickError = container.querySelector('#simPickError');

    // Not a real `disabled` on either button -- a genuinely disabled button
    // never fires a click event at all, which means tapping it (before
    // picking two fighters) looked exactly like a bug: nothing happened, no
    // explanation, same failure mode pickem.js's own submit button already
    // solved with .gl-btn-notready (see that class's comment in app.css).
    // Left clickable and just dimmed here too, so each click handler can
    // say what's missing instead of silently swallowing the tap.
    function pickReadyMessage(){
      if (!picked.a && !picked.b) return 'Pick both fighters to simulate.';
      if (!picked.a || !picked.b) return 'Pick both fighters to simulate.';
      if (picked.a === picked.b) return 'Choose two different fighters.';
      return '';
    }
    function showPickError(msg){
      if (pickError) pickError.innerHTML = '<p class="gl-error" style="margin:.6rem 0 0">' + esc(msg) + '</p>';
    }
    function clearPickError(){
      if (pickError) pickError.innerHTML = '';
    }
    function refreshButton(){
      var notReady = !!pickReadyMessage();
      if (picked.a && picked.b && picked.a !== picked.b){
        runBtn.textContent = 'Simulate';
      } else if (picked.a && picked.b && picked.a === picked.b){
        runBtn.textContent = 'Pick two different fighters';
      } else {
        runBtn.textContent = 'Pick both fighters to simulate';
      }
      runBtn.classList.toggle('gl-btn-notready', notReady);
      if (byoBtn) byoBtn.classList.toggle('gl-btn-notready', notReady);
      if (!notReady) clearPickError();
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
      clearPickError();
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
        var shareBtn = output.querySelector('#simShareBtn');
        if (shareBtn) shareBtn.addEventListener('click', function(){
          window.GL_NATIVE.tap();
          window.GL_SHEET.sim(res.a, res.b, res.slugA, res.slugB, res.result, rounds).catch(function(){});
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
      if (runBtn.classList.contains('gl-btn-notready')){ showPickError(pickReadyMessage()); return; }
      runSimulation();
    });

    if (byoBtn) byoBtn.addEventListener('click', function(){
      window.GL_NATIVE.tap();
      if (byoBtn.classList.contains('gl-btn-notready')){ showPickError(pickReadyMessage()); return; }
      if (byoBtn.disabled) return; // genuinely mid-fetch (openCustomSimulator's own loading state)
      clearPickError();
      openCustomSimulator(container, picked.a, picked.b, rounds, byoBtn);
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
        wireCustomSim(container);
      });
    });
  }

  return { load: load };
})();
