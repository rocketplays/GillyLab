// Matchup hub -- free on the website at /matchup, no account needed. Built to
// mirror the real page's UX, not just its data: a fighter search bar at top
// (debounced against /api/fighter-search, same endpoint the website's own
// search bar calls), a single dropdown to jump to a past event's results
// (matching the site's native <select>, not a row of toggle buttons), the
// featured card with a free tale of the tape on every bout, and a swipeable
// carousel of FULL upcoming fight cards below it -- not name-only chips that
// have to be tapped and re-fetched one at a time. Tapping any fighter is a
// full navigation to the 'fighter' route (GL_ROUTER.go), same as the website
// fully replacing the page for a profile instead of layering a panel on top
// of whatever you were looking at.
//
// GET /api/app/matchup (worker/index.js) mirrors the website page's own data
// pipeline (currentLanding/eventToCard/live-result merge/odds backfill) but
// hands back JSON: the featured card (or whichever past event was picked),
// the same full-card carousel matchupPage itself builds for upcoming events,
// the full pre-fight breakdown when it's actually precomputed for the site's
// current main event, and whether the free "Analytics Deep Dive" is
// available for it.
//
// The deep dive itself is NOT reimplemented natively -- it's raw HTML/CSS
// gen-matchup-free.cjs pre-renders from the live site's own build (see
// worker/matchup-free.js), meant to be dropped into a page that already
// carries its supporting styles/scripts. Opening the real page in the
// system browser (same external link-out pattern already used for
// Premium/subscribe) shows the exact same free content with zero risk of
// it rendering wrong.
window.GL_ROUTER.register('matchup', {
  title: 'Card',
  tab: 'matchup',
  render: function(container){
    mountMatchup(container);
  }
});

function mountMatchup(container){
  container.innerHTML = '<p class="gl-muted">Loading the card…</p>';

  var data = null;       // last successful /api/app/matchup response
  var searchSeq = 0;     // ignore a stale search response that resolves late

  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]; }); }
  function fmtDate(iso, opts){
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString(undefined, opts || { month: 'short', day: 'numeric', year: 'numeric' });
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

  // Same renderer for the featured card AND every carousel slide -- a slide's
  // own "main event" only ever gets the free tale of the tape + locked
  // teaser (its `t`/`deepDive` are always null here, exactly like
  // matchupPage's own `(f.main && ownerCard.main)` gate: the full breakdown
  // and Analytics Deep Dive are precomputed for the site's current card
  // only, never for a carousel pick).
  function fightHTML(f, isMain, deepDive, breakdown){
    var res = f.result || null;
    var panelBody = res
      ? resultHTML(f, res)
      : (tapeHTML(f.tape) + (isMain ? breakdownHTML(f, breakdown, deepDive) : lockedTeaserHTML()));
    return (
      '<div class="mf-card' + (isMain ? ' main' : '') + '">' +
        '<div class="mf-row">' +
          '<div class="mf-side">' + avatar(f.s1, f.f1) + '<div class="mf-meta">' + (f.rank1 && f.rank1 !== 'NR' ? '<div class="mf-rank">' + esc(f.rank1) + '</div>' : '') + '<div class="mf-name">' + fighterBtn(f.f1, f.s1) + '</div><div class="mf-rec">' + esc(f.rec1 || '') + '</div></div></div>' +
          '<div class="mf-center"><div class="mf-vs">' + (res ? 'FINAL' : 'VS') + '</div><div class="mf-wt">' + esc(f.weight || '') + '</div>' + (res ? '' : '<div class="mf-odds"><b>' + esc(fmtOdds(f.o1)) + '</b> · <b>' + esc(fmtOdds(f.o2)) + '</b></div>') + '<button type="button" class="mf-info" data-toggle="1">Fight Info ⌄</button></div>' +
          '<div class="mf-side right"><div class="mf-meta">' + (f.rank2 && f.rank2 !== 'NR' ? '<div class="mf-rank">' + esc(f.rank2) + '</div>' : '') + '<div class="mf-name">' + fighterBtn(f.f2, f.s2) + '</div><div class="mf-rec">' + esc(f.rec2 || '') + '</div></div>' + avatar(f.s2, f.f2) + '</div>' +
        '</div>' +
        '<div class="mf-panel" hidden>' + panelBody + '</div>' +
      '</div>'
    );
  }

  function cardBodyHTML(c, deepDive, breakdown){
    if (!c || !c.fights || !c.fights.length) return '<p class="gl-muted">No card posted yet — check back on fight week.</p>';
    var secOrder = ['Main Card', 'Prelims', 'Early Prelims', 'Preliminary Card'];
    var bySec = {};
    c.fights.forEach(function(f){ var s = f.section || 'Main Card'; (bySec[s] = bySec[s] || []).push(f); });
    return Object.keys(bySec).sort(function(a, b){ return (secOrder.indexOf(a) + 1 || 99) - (secOrder.indexOf(b) + 1 || 99); }).map(function(s){
      return '<div class="mf-sechdr">' + esc(s) + '</div>' + bySec[s].map(function(f){ return fightHTML(f, !!f.main, deepDive, breakdown); }).join('');
    }).join('');
  }

  function pastSelectHTML(){
    var past = data.past || [];
    if (!past.length) return '';
    var upcomingLabel = data.isPast ? '← Back to this week’s card' : 'Upcoming — ' + (data.card ? data.card.event : 'Next Card');
    var options = '<option value="">' + esc(upcomingLabel) + '</option>' + past.map(function(e){
      var label = [e.event, fmtDate(e.date, { month: 'short', day: 'numeric', year: 'numeric' })].filter(Boolean).join(' — ');
      return '<option value="' + esc(e.slug) + '"' + (data.isPast && data.card && data.card.slug === e.slug ? ' selected' : '') + '>' + esc(label) + '</option>';
    }).join('');
    return (
      '<div class="mf-past-top">' +
        '<label for="mfPastSelect" class="mf-past-label">View past event</label>' +
        '<select id="mfPastSelect" class="mf-past-select">' + options + '</select>' +
      '</div>'
    );
  }

  function searchHTML(){
    return (
      '<div class="mf-search">' +
        '<input type="search" id="mfSearchInput" class="mf-search-input" placeholder="Search any fighter for their lite profile…" autocomplete="off">' +
        '<div id="mfSearchResults" class="mf-search-results" hidden></div>' +
      '</div>'
    );
  }

  function carouselHTML(){
    var events = data.carousel || [];
    if (!events.length) return '';
    var dots = events.length > 1
      ? '<div class="mf-car-dots" id="mfCarDots">' + events.map(function(_, i){ return '<button type="button" class="mf-car-dot' + (i === 0 ? ' active' : '') + '" data-i="' + i + '"></button>'; }).join('') + '</div>'
      : '';
    var slides = events.map(function(c){
      var when = fmtDate(c.prelimsAt || c.date, { month: 'short', day: 'numeric' });
      return (
        '<div class="mf-ev-slide" data-slug="' + esc(c.slug) + '">' +
          '<div class="mf-ev-slide-hdr">' +
            '<div class="mf-ev-slide-name">' + esc(c.event) + '</div>' +
            '<div class="mf-ev-slide-sub">' + esc([when, c.location || c.city].filter(Boolean).join(' · ')) + '</div>' +
          '</div>' +
          cardBodyHTML(c, { available: false }, null) +
        '</div>'
      );
    }).join('');
    return (
      '<div class="mf-car-hdr">' +
        '<div class="mf-car-hdr-label">Upcoming Events</div>' +
        '<div class="mf-car-hdr-line"></div>' +
        '<div class="mf-car-hdr-btns">' +
          '<button type="button" class="mf-car-btn" id="mfCarPrev" aria-label="Previous event">‹</button>' +
          '<button type="button" class="mf-car-btn" id="mfCarNext" aria-label="Next event">›</button>' +
        '</div>' +
      '</div>' +
      dots +
      '<div class="mf-carousel-full" id="mfCarouselFull">' + slides + '</div>'
    );
  }

  // "Time Until Event" countdown -- same shape as the premium in-app home
  // page's own #countdown (index.html: updateCountdown()): a live clock
  // instead of a static button sitting next to the title. FINAL once the
  // event is over, LIVE once any bout has a posted result, otherwise
  // days/hours/minutes until the walkout, biggest unit only.
  function countdownParts(card){
    if (data.isPast) return { text: 'FINAL' };
    if (!card) return { text: '—' };
    var live = (card.fights || []).some(function(f){ return f.result; });
    if (live) return { text: 'LIVE' };
    var iso = card.prelimsAt || card.date;
    var d = iso ? new Date(iso) : null;
    if (!d || isNaN(d.getTime())) return { text: '—' };
    var diff = d.getTime() - Date.now();
    if (diff <= 0) return { text: 'TONIGHT' };
    var days = Math.floor(diff / 86400000);
    var hours = Math.floor((diff % 86400000) / 3600000);
    var mins = Math.floor((diff % 3600000) / 60000);
    if (days >= 1) return { num: days, unit: days === 1 ? 'day' : 'days' };
    if (hours >= 1) return { num: hours, unit: 'h' };
    return { num: Math.max(1, mins), unit: 'm' };
  }
  function renderCountdown(){
    var el = container.querySelector('#mfCountdown');
    if (!el) return;
    var v = countdownParts(data && data.card);
    el.innerHTML = v.text != null ? esc(v.text) : (v.num + '<span class="mf-cd-unit">' + esc(v.unit) + '</span>');
  }

  function eventHeaderHTML(card){
    return (
      '<div class="mf-event-header">' +
        '<div class="mf-event-info">' +
          '<h1 class="mf-event-name">' + (card ? esc(card.event) : 'No card yet') + '</h1>' +
          (card ? '<div class="mf-event-details">' + esc(fmtDate(card.prelimsAt || card.date)) + (card.city ? ' · ' + esc(card.city) : '') + '</div>' : '') +
        '</div>' +
        (card ? '<div class="mf-event-countdown"><div class="mf-cd-label">Time Until Event</div><div class="mf-cd-time" id="mfCountdown">—</div></div>' : '') +
      '</div>'
    );
  }

  function render(){
    var card = data.card;
    container.innerHTML =
      searchHTML() +
      pastSelectHTML() +
      eventHeaderHTML(card) +
      '<div id="mfBody">' + cardBodyHTML(card, data.deepDive, data.breakdown) + '</div>' +
      carouselHTML();
    wire();
    renderCountdown();
    if (window.__mfCountdownTimer) clearInterval(window.__mfCountdownTimer);
    window.__mfCountdownTimer = setInterval(renderCountdown, 30000);
  }

  function wire(){
    var pastSelect = container.querySelector('#mfPastSelect');
    if (pastSelect) pastSelect.addEventListener('change', function(){
      window.GL_NATIVE.tap();
      load(pastSelect.value || undefined);
    });

    container.querySelectorAll('[data-toggle]').forEach(function(btn){
      btn.addEventListener('click', function(){
        window.GL_NATIVE.tap();
        var card = btn.closest('.mf-card');
        var panel = card.querySelector('.mf-panel');
        panel.hidden = !panel.hidden;
        btn.textContent = 'Fight Info ' + (panel.hidden ? '⌄' : '⌃');
      });
    });

    container.querySelectorAll('[data-goto="premium"]').forEach(function(btn){
      btn.addEventListener('click', function(){ window.GL_NATIVE.tap(); window.GL_ROUTER.go('premium'); });
    });

    container.querySelectorAll('.mf-namebtn[data-slug]').forEach(function(btn){
      btn.addEventListener('click', function(){
        window.GL_NATIVE.tap();
        window.GL_ROUTER.go('fighter', { slug: btn.getAttribute('data-slug') });
      });
    });

    container.querySelectorAll('[data-deepdive]').forEach(function(btn){
      btn.addEventListener('click', function(){
        window.GL_NATIVE.tap();
        var slug = data.card && data.card.slug;
        window.GL_NATIVE.openExternal(window.GL_API.BASE + '/matchup' + (slug ? '?event=' + encodeURIComponent(slug) : ''));
      });
    });

    wireSearch();
    wireCarousel();
  }

  function wireSearch(){
    var input = container.querySelector('#mfSearchInput');
    var box = container.querySelector('#mfSearchResults');
    if (!input || !box) return;
    var timer = null;

    function hide(){ box.hidden = true; box.innerHTML = ''; }
    function show(html){ box.innerHTML = html; box.hidden = false; }

    input.addEventListener('input', function(){
      var q = input.value.trim();
      if (timer) clearTimeout(timer);
      if (q.length < 2){ hide(); return; }
      timer = setTimeout(function(){
        var mySeq = ++searchSeq;
        window.GL_API.fighterSearch(q).then(function(res){
          if (mySeq !== searchSeq) return; // a newer keystroke's request already won
          var list = res.results || [];
          if (!list.length){ show('<div class="mf-search-empty">No fighters found</div>'); return; }
          show(list.map(function(f){
            return '<button type="button" class="mf-search-item" data-slug="' + esc(f.slug) + '">' +
              '<span class="mfs-name">' + esc(f.name) + '</span>' +
              '<span class="mfs-meta">' + esc([f.division, f.record].filter(Boolean).join(' · ')) + '</span>' +
            '</button>';
          }).join(''));
          box.querySelectorAll('[data-slug]').forEach(function(btn){
            btn.addEventListener('click', function(){
              window.GL_NATIVE.tap();
              hide();
              input.value = '';
              window.GL_ROUTER.go('fighter', { slug: btn.getAttribute('data-slug') });
            });
          });
        }).catch(function(){ hide(); });
      }, 200);
    });
    input.addEventListener('focus', function(){ if (input.value.trim().length >= 2 && box.innerHTML) box.hidden = false; });
    document.addEventListener('click', function(e){ if (e.target !== input && !box.contains(e.target)) hide(); });
  }

  // Prev/next + dots, one slide (clientWidth) at a time, wrapping at either
  // end -- same as matchupPage's own carousel controller. Touch/trackpad
  // swipe already works via CSS scroll-snap; these are the tap affordance
  // and the position indicator.
  function wireCarousel(){
    var track = container.querySelector('#mfCarouselFull');
    var prev = container.querySelector('#mfCarPrev');
    var next = container.querySelector('#mfCarNext');
    var dotsWrap = container.querySelector('#mfCarDots');
    if (!track || !prev || !next) return;
    var dots = dotsWrap ? Array.prototype.slice.call(dotsWrap.querySelectorAll('.mf-car-dot')) : [];
    var slideCount = track.children.length;
    var curIdx = 0, scrolling = false, fallbackTimer = null;

    function clamp(i){ if (!slideCount) return 0; return ((i % slideCount) + slideCount) % slideCount; }
    function updateDots(){ dots.forEach(function(d, i){ d.classList.toggle('active', i === curIdx); }); }
    function goTo(i, smooth){
      curIdx = clamp(i);
      scrolling = true;
      track.scrollTo({ left: curIdx * track.clientWidth, behavior: smooth === false ? 'auto' : 'smooth' });
      updateDots();
      if (fallbackTimer) clearTimeout(fallbackTimer);
      fallbackTimer = setTimeout(function(){ scrolling = false; }, 600);
    }
    prev.addEventListener('click', function(){ window.GL_NATIVE.tap(); if (!scrolling && slideCount > 1) goTo(curIdx - 1); });
    next.addEventListener('click', function(){ window.GL_NATIVE.tap(); if (!scrolling && slideCount > 1) goTo(curIdx + 1); });
    dots.forEach(function(d){ d.addEventListener('click', function(){ window.GL_NATIVE.tap(); if (!scrolling) goTo(parseInt(d.getAttribute('data-i'), 10) || 0); }); });

    var scrollTimer = null;
    track.addEventListener('scroll', function(){
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(function(){
        scrolling = false;
        curIdx = clamp(Math.round(track.scrollLeft / Math.max(1, track.clientWidth)));
        updateDots();
      }, 120);
    });
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
