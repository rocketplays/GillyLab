// Matchup hub -- free on the website at /matchup, no account needed. Pulls
// GET /api/app/matchup (worker/index.js), which mirrors the website page's
// own data pipeline (currentLanding/eventToCard/live-result merge/odds
// backfill) but hands back JSON instead of server-rendered HTML: the
// featured card (or whichever upcoming/past event was picked), a free tale
// of the tape on every bout, the full pre-fight breakdown when it's actually
// precomputed for the site's own current main event, and whether the free
// "Analytics Deep Dive" is available for it.
//
// The deep dive itself is NOT reimplemented natively -- it's raw HTML/CSS
// gen-matchup-free.cjs pre-renders from the live site's own build (see
// worker/matchup-free.js), meant to be dropped into a page that already
// carries its supporting styles/scripts. Rendering that blob's markup here
// with no idea what selectors it depends on is how you get a broken-looking
// "free" feature. Opening the real page in the system browser (same
// external link-out pattern already used for Premium/subscribe) shows the
// exact same free content with zero risk of it rendering wrong.
window.GL_ROUTER.register('matchup', {
  title: 'Matchup',
  tab: 'matchup',
  render: function(container){
    mountMatchup(container);
  }
});

function mountMatchup(container){
  container.innerHTML = '<p class="gl-muted">Loading the card…</p>';

  var data = null;       // last successful /api/app/matchup response
  var showingPast = false;

  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]; }); }
  function fmtDate(iso){
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function fmtOdds(v){ return (v == null || v === '') ? '—' : String(v); }
  function surname(n){
    var p = String(n || '').trim().split(/\s+/);
    var i = p.length - 1;
    while (i > 0 && /^(jr|sr|ii|iii|iv|v)\.?$/i.test(p[i])) i--;
    return p[i] || n;
  }

  function avatar(slug, name){
    var ini = window.GL_FIGHTER.initials(name);
    return (
      '<span class="mf-av">' +
        '<span class="mf-av-initials">' + esc(ini) + '</span>' +
        (slug ? '<img class="mf-av-photo" src="' + window.GL_FIGHTER.PHOTO_BASE + esc(slug) + '.png" alt="" onerror="this.style.display=\'none\'">' : '') +
      '</span>'
    );
  }

  function fighterBtn(name, slug){
    return slug
      ? '<button type="button" class="mf-namebtn" data-slug="' + esc(slug) + '">' + esc(name) + '</button>'
      : '<span>' + esc(name) + '</span>';
  }

  function tapeHTML(t){
    if (!t || !t.a || !t.b) return '';
    var rows = [['Age', t.a.age, t.b.age], ['Height', t.a.ht, t.b.ht], ['Reach', t.a.reach, t.b.reach], ['Stance', t.a.stance, t.b.stance]];
    var body = rows.map(function(r){
      return '<div class="sr-cmp-row"><div class="sr-cmp-lbl">' + r[0] + '</div><div class="sr-cmp-val">' + esc(r[1] || '—') + '</div><div class="sr-cmp-val">' + esc(r[2] || '—') + '</div></div>';
    }).join('');
    return '<div class="sr-common"><div class="sr-common-title">Tale of the tape</div>' + body + '</div>';
  }

  function lockedTeaserHTML(){
    return (
      '<div class="mf-lock">' +
        '<div class="mf-lock-t">🔒 Fight simulator · Matchup analytics · Style · Pace · Path to victory · Storylines</div>' +
        '<p class="gl-muted" style="margin:.3rem 0 .7rem">The full breakdown of every bout is a Premium feature.</p>' +
        '<button type="button" class="gl-btn gl-btn-outline" data-goto="premium">Go Premium for the rest →</button>' +
      '</div>'
    );
  }

  function breakdownHTML(f, t, deepDive){
    if (!t) return lockedTeaserHTML();
    var sA = surname(f.f1), sB = surname(f.f2);
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
          '<div class="sr-cmp-row"><div class="sr-cmp-lbl">Win finish rate</div><div class="sr-cmp-val">' + esc(fd.finRate && fd.finRate.a || '—') + '</div><div class="sr-cmp-val">' + esc(fd.finRate && fd.finRate.b || '—') + '</div></div>' +
          '<div class="sr-cmp-row"><div class="sr-cmp-lbl">Win methods</div><div class="sr-cmp-val">' + esc(fd.methods && fd.methods.a || '—') + '</div><div class="sr-cmp-val">' + esc(fd.methods && fd.methods.b || '—') + '</div></div>' +
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
    var ddBtn = deepDive && deepDive.available
      ? '<button type="button" class="mf-dd-bar" data-deepdive="1">Matchup Analytics Deep Dive <span class="mf-dd-go">›</span></button>'
      : '';
    return ddBtn + parts.join('');
  }

  function resultHTML(f, res){
    if (res.voided) return '<div class="mf-result"><span class="mf-res-tag">Result</span>' + (res.draw ? 'Draw' : 'No Contest') + '</div>';
    if (!res.winner) return '';
    var loser = res.winner === f.f1 ? f.f2 : (res.winner === f.f2 ? f.f1 : '');
    var meth = res.method ? esc(res.method) + (res.round && !/dec/i.test(res.method) ? ' · R' + esc(res.round) : '') : '';
    return '<div class="mf-result"><span class="mf-res-tag">Result</span><strong>' + esc(res.winner) + '</strong> def. ' + esc(loser) + (meth ? ' <span class="mf-res-meth">' + meth + '</span>' : '') + '</div>';
  }

  function fightHTML(f, isMain, deepDive, breakdown){
    var res = f.result || null;
    var oddsOrRes = res
      ? '<div class="mf-meth">' + esc(res.winner === f.f1 ? 'WIN' : (res.winner ? 'LOSS' : '')) + '</div>'
      : '<div class="mf-odds"><b>' + esc(fmtOdds(f.o1)) + '</b> · <b>' + esc(fmtOdds(f.o2)) + '</b></div>';
    var panelBody = res
      ? resultHTML(f, res)
      : (tapeHTML(f.tape) + (isMain ? breakdownHTML(f, breakdown, deepDive) : lockedTeaserHTML()));
    return (
      '<div class="mf-card' + (isMain ? ' main' : '') + '">' +
        '<div class="mf-row">' +
          '<div class="mf-side">' + avatar(f.s1, f.f1) + '<div class="mf-meta">' + (f.rank1 && f.rank1 !== 'NR' ? '<div class="mf-rank">' + esc(f.rank1) + '</div>' : '') + '<div class="mf-name">' + fighterBtn(f.f1, f.s1) + '</div><div class="mf-rec">' + esc(f.rec1 || '') + '</div></div></div>' +
          '<div class="mf-center"><div class="mf-vs">' + (res ? 'FINAL' : 'VS') + '</div><div class="mf-wt">' + esc(f.weight || '') + '</div><button type="button" class="mf-info" data-toggle="1">Fight Info ⌄</button></div>' +
          '<div class="mf-side right"><div class="mf-meta">' + (f.rank2 && f.rank2 !== 'NR' ? '<div class="mf-rank">' + esc(f.rank2) + '</div>' : '') + '<div class="mf-name">' + fighterBtn(f.f2, f.s2) + '</div><div class="mf-rec">' + esc(f.rec2 || '') + '</div></div>' + avatar(f.s2, f.f2) + '</div>' +
        '</div>' +
        '<div class="mf-panel" hidden>' + panelBody + '</div>' +
      '</div>'
    );
  }

  function eventChip(e, isActive){
    return '<button type="button" class="mf-chip' + (isActive ? ' active' : '') + '" data-slug="' + esc(e.slug) + '">' + esc(e.event) + '<span class="mf-chip-d">' + esc(fmtDate(e.date)) + '</span></button>';
  }

  function bodyHTML(){
    var card = data.card;
    if (!card || !card.fights || !card.fights.length) return '<p class="gl-muted">No card posted yet — check back on fight week.</p>';
    var secOrder = ['Main Card', 'Prelims', 'Early Prelims', 'Preliminary Card'];
    var bySec = {};
    card.fights.forEach(function(f){ var s = f.section || 'Main Card'; (bySec[s] = bySec[s] || []).push(f); });
    return Object.keys(bySec).sort(function(a, b){ return (secOrder.indexOf(a) + 1 || 99) - (secOrder.indexOf(b) + 1 || 99); }).map(function(s){
      return '<div class="mf-sechdr">' + esc(s) + '</div>' + bySec[s].map(function(f){ return fightHTML(f, !!f.main, data.deepDive, data.breakdown); }).join('');
    }).join('');
  }

  function render(){
    var card = data.card;
    var chips = (showingPast ? data.past : data.upcoming) || [];
    container.innerHTML =
      '<div class="gl-card" style="margin-bottom:.7rem">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:.6rem">' +
          '<h2 class="gl-heading" style="margin:0;font-size:1.15rem">' + (card ? esc(card.event) : 'No card yet') + '</h2>' +
          '<button type="button" class="gl-btn gl-btn-outline" id="mfRosterBtn" style="width:auto;padding:.5rem .8rem;font-size:.72rem">Roster</button>' +
        '</div>' +
        (card ? '<p class="gl-muted" style="margin:.2rem 0 0">' + esc(fmtDate(card.date)) + (card.city ? ' · ' + esc(card.city) : '') + '</p>' : '') +
      '</div>' +
      '<div class="mf-chiprow-head">' +
        '<button type="button" class="gl-btn gl-btn-outline mf-pastbtn' + (!showingPast ? ' active' : '') + '" data-past="0">Upcoming</button>' +
        '<button type="button" class="gl-btn gl-btn-outline mf-pastbtn' + (showingPast ? ' active' : '') + '" data-past="1">Past events</button>' +
      '</div>' +
      (chips.length ? '<div class="mf-chiprow">' + chips.map(function(e){ return eventChip(e, card && e.slug === card.slug); }).join('') + '</div>' : '') +
      '<div id="mfBody">' + bodyHTML() + '</div>';
    wire();
  }

  function wire(){
    var rosterBtn = container.querySelector('#mfRosterBtn');
    if (rosterBtn) rosterBtn.addEventListener('click', function(){ window.GL_NATIVE.tap(); window.GL_ROUTER.go('roster'); });

    container.querySelectorAll('.mf-pastbtn').forEach(function(btn){
      btn.addEventListener('click', function(){
        window.GL_NATIVE.tap();
        showingPast = btn.getAttribute('data-past') === '1';
        render();
      });
    });

    container.querySelectorAll('.mf-chip').forEach(function(btn){
      btn.addEventListener('click', function(){
        window.GL_NATIVE.tap();
        load(btn.getAttribute('data-slug'));
      });
    });

    container.querySelectorAll('[data-toggle]').forEach(function(btn){
      btn.addEventListener('click', function(){
        window.GL_NATIVE.tap();
        var card = btn.closest('.mf-card');
        var panel = card.querySelector('.mf-panel');
        panel.hidden = !panel.hidden;
        btn.textContent = (panel.hidden ? 'Fight Info' : 'Hide Info') + ' ⌄';
      });
    });

    container.querySelectorAll('[data-goto="premium"]').forEach(function(btn){
      btn.addEventListener('click', function(){ window.GL_NATIVE.tap(); window.GL_ROUTER.go('premium'); });
    });

    container.querySelectorAll('[data-slug].mf-namebtn').forEach(function(btn){
      btn.addEventListener('click', function(){
        window.GL_NATIVE.tap();
        openFighter(btn.getAttribute('data-slug'));
      });
    });

    container.querySelectorAll('[data-deepdive]').forEach(function(btn){
      btn.addEventListener('click', function(){
        window.GL_NATIVE.tap();
        var slug = data.card && data.card.slug;
        window.GL_NATIVE.openExternal(window.GL_API.BASE + '/matchup' + (slug ? '?event=' + encodeURIComponent(slug) : ''));
      });
    });
  }

  function openFighter(slug){
    var body = container.querySelector('#mfBody');
    var chiprow = container.querySelector('.mf-chiprow');
    var chiphead = container.querySelector('.mf-chiprow-head');
    var existing = container.querySelector('#mfFighterPanel');
    if (existing) existing.remove();
    if (body) body.hidden = true;
    if (chiprow) chiprow.hidden = true;
    if (chiphead) chiphead.hidden = true;
    var panel = document.createElement('div');
    panel.id = 'mfFighterPanel';
    panel.innerHTML = '<button type="button" class="gl-btn gl-btn-outline" id="mfFighterBack" style="margin-bottom:.8rem">← Back to card</button><div id="mfFighterHost"></div>';
    container.appendChild(panel);
    panel.querySelector('#mfFighterBack').addEventListener('click', function(){
      window.GL_NATIVE.tap();
      panel.remove();
      if (body) body.hidden = false;
      if (chiprow) chiprow.hidden = false;
      if (chiphead) chiphead.hidden = false;
    });
    window.GL_FIGHTER.load(panel.querySelector('#mfFighterHost'), slug);
  }

  function load(eventSlug){
    container.innerHTML = '<p class="gl-muted">Loading the card…</p>';
    window.GL_API.matchup(eventSlug).then(function(res){
      data = res;
      render();
    }).catch(function(){
      container.innerHTML = '<div class="gl-card"><h3 style="margin:0 0 .4rem">Matchup hub unavailable right now</h3><p>Couldn’t reach gillylab.com. Check your connection and try again shortly.</p></div>';
    });
  }

  load();
}
