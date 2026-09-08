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
// and the full pre-fight breakdown + "Analytics Deep Dive" availability for
// whichever of those main events actually has one precomputed --
// scripts/gen-landing-data.cjs and gen-matchup-free.cjs now cover the
// current card AND the upcoming carousel's own main events (each capped for
// build cost, see those scripts), not just the one currently-held card. Each
// carousel entry below carries its own `breakdown`/`deepDive`, same shape as
// the top-level `card`'s.
//
// The deep dive itself is NOT reimplemented natively -- it's raw HTML
// gen-matchup-free.cjs pre-renders from the live site's own build (see
// worker/matchup-free.js: the same striking/grappling grid markup the
// website's own #mh-box modal shows), dropped straight into this screen's
// own in-app modal (#mh-overlay/#mh-box, same IDs/classes as the site so
// its shipped `hubCss` applies unmodified) instead of opening gillylab.com
// in the system browser. Tapping "Matchup Analytics Deep Dive" on ANY main
// event -- the featured card or any carousel slide -- opens that event's
// own entry (see `hubData`, keyed by slug from `data.hub`/each carousel
// entry's own `.hub`), never just the featured card's.
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

  // Matchup Analytics Deep Dive modal data, keyed by event slug -- the
  // featured card's own `hub` plus every carousel slide's own `hub`, so a
  // slide's button opens THAT event's analysis, not always the featured
  // card's. Rebuilt on every load() (see below); the modal DOM itself
  // (#mh-overlay/#mh-box) is part of render()'s own markup, same as any
  // other screen content, but its CSS/behavior mirror the site's #mh-box
  // exactly -- see hubModalHTML()/wireHub() below.
  var hubData = {};
  var hubState = { slug: null, tab: 'striking', filter: 'all' };
  var hubScrollY = 0;

  // Fetched once per load() (see load() below), same "call account(),
  // treat a logged-out/failed call as not-premium" pattern as fighter.js
  // and simulator.js -- gates the Simulate Matchup bar below, since this
  // screen itself is free/no-session-required but that button isn't.
  var subscribed = false;

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

  // Numbered PPV (gold) / DWCS (blue) event styling -- same classification
  // index.html uses for its own .numbered-card/.dwcs-card treatment: a
  // numbered PPV is "UFC 331" etc. (name starts with a number), DWCS is
  // Contender Series/Dana White's own separate check. A regular Fight Night
  // matches neither and just keeps the app's normal green accent -- there's
  // no "regular" class, green is simply the default look.
  function isDwcsName(name){ return /contender\s+series|dana\s+white/i.test(name || ''); }
  function specialClassFor(name){
    if (/^UFC\s+\d+\b/i.test(String(name || '').trim())) return 'mf-numbered';
    if (isDwcsName(name)) return 'mf-dwcs';
    return '';
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

  function breakdownHTML(f, t, deepDive, eventSlug){
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
    // Carries the OWNING event's slug (the featured card, or whichever
    // carousel slide this bout belongs to) -- not assumed to be
    // data.card.slug -- so opening the modal (see wire()'s [data-deepdive]
    // handler / hubOpen()) always shows that event's own analysis.
    var ddBtn = (deepDive && deepDive.available && eventSlug)
      ? '<button type="button" class="mf-dd-bar" data-deepdive="' + esc(eventSlug) + '">Matchup Analytics Deep Dive <span class="mf-dd-go">›</span></button>'
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

  // Same renderer for the featured card AND every carousel slide -- a
  // slide's own "main event" gets the full breakdown + Analytics Deep Dive
  // whenever the API actually has one for that event's slug (see the
  // worker/index.js comment above), the locked teaser otherwise. Non-main
  // bouts always get the locked teaser regardless -- only ever the main
  // event is free, on any card.
  // Mirrors the website's own simulateMatchup() gating exactly: every
  // scheduled (not-yet-fought), non-DWCS bout gets a Simulate Matchup bar --
  // main event or not, same as the site (its fightRow() has no isMain
  // check on this button either). The one difference from the site: the
  // site's whole document is already premium-gated at the HTTP layer, so
  // every viewer who can load the page is a subscriber -- this screen is
  // free/public, so the button itself is subscribed-gated here instead.
  // `special === 'mf-dwcs'` is the same isDwcsName() regex the site's own
  // isDWCSRaw()/the worker's isDwcsEvent() use, just computed once per card
  // (see specialClassFor/cardBodyHTML) rather than needing a per-fight flag
  // from the API.
  function simBarHTML(f, special){
    if (!subscribed || f.result || special === 'mf-dwcs') return '';
    return (
      '<button type="button" class="mf-sim-bar" data-sim-a="' + esc(f.f1) + '" data-sim-b="' + esc(f.f2) + '" data-sim-rounds="' + (f.rounds === 5 ? 5 : 3) + '">' +
        'Simulate Matchup' +
      '</button>'
    );
  }

  function fightHTML(f, isMain, deepDive, breakdown, eventSlug, special){
    var res = f.result || null;
    var panelBody = res
      ? resultHTML(f, res)
      : (tapeHTML(f.tape) + (isMain ? breakdownHTML(f, breakdown, deepDive, eventSlug) : lockedTeaserHTML()));
    return (
      '<div class="mf-card' + (isMain ? ' main' : '') + (isMain && special ? ' ' + special : '') + '">' +
        '<div class="mf-row">' +
          '<div class="mf-side">' + avatar(f.s1, f.f1) + '<div class="mf-meta">' + (f.rank1 && f.rank1 !== 'NR' ? '<div class="mf-rank">' + esc(f.rank1) + '</div>' : '') + '<div class="mf-name">' + fighterBtn(f.f1, f.s1) + '</div><div class="mf-rec">' + esc(f.rec1 || '') + '</div></div></div>' +
          '<div class="mf-center"><div class="mf-vs">' + (res ? 'FINAL' : 'VS') + '</div><div class="mf-wt">' + esc(f.weight || '') + '</div>' + (res ? '' : '<div class="mf-odds"><b>' + esc(fmtOdds(f.o1)) + '</b> · <b>' + esc(fmtOdds(f.o2)) + '</b></div>') + '<button type="button" class="mf-info" data-toggle="1">Fight Info ⌄</button></div>' +
          '<div class="mf-side right">' + avatar(f.s2, f.f2) + '<div class="mf-meta">' + (f.rank2 && f.rank2 !== 'NR' ? '<div class="mf-rank">' + esc(f.rank2) + '</div>' : '') + '<div class="mf-name">' + fighterBtn(f.f2, f.s2) + '</div><div class="mf-rec">' + esc(f.rec2 || '') + '</div></div></div>' +
        '</div>' +
        simBarHTML(f, special) +
        '<div class="mf-panel" hidden>' + panelBody + '</div>' +
      '</div>'
    );
  }

  function cardBodyHTML(c, deepDive, breakdown){
    if (!c || !c.fights || !c.fights.length) return '<p class="gl-muted">No card posted yet — check back on fight week.</p>';
    var special = specialClassFor(c.event);
    var secOrder = ['Main Card', 'Prelims', 'Early Prelims', 'Preliminary Card'];
    var bySec = {};
    c.fights.forEach(function(f){ var s = f.section || 'Main Card'; (bySec[s] = bySec[s] || []).push(f); });
    return Object.keys(bySec).sort(function(a, b){ return (secOrder.indexOf(a) + 1 || 99) - (secOrder.indexOf(b) + 1 || 99); }).map(function(s){
      return '<div class="mf-sechdr">' + esc(s) + '</div>' + bySec[s].map(function(f){ return fightHTML(f, !!f.main, deepDive, breakdown, c.slug, special); }).join('');
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
        '<input type="search" id="mfSearchInput" class="mf-search-input" placeholder="Search any fighter for their profile…" autocomplete="off">' +
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
      var special = specialClassFor(c.event);
      return (
        '<div class="mf-ev-slide" data-slug="' + esc(c.slug) + '">' +
          '<div class="mf-ev-slide-hdr' + (special ? ' ' + special : '') + '">' +
            '<div class="mf-ev-slide-name">' + esc(c.event) + '</div>' +
            '<div class="mf-ev-slide-sub">' + esc([when, c.location || c.city].filter(Boolean).join(' · ')) + '</div>' +
          '</div>' +
          cardBodyHTML(c, c.deepDive || { available: false }, c.breakdown || null) +
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

  // ---- Matchup Analytics Deep Dive modal -----------------------------
  // Same IDs/classes as the website's own #mh-box (worker/pages.js) so its
  // shipped `hubCss` (worker/matchup-free.js) applies with zero rewriting --
  // this is the site's exact modal, not a native reimplementation, same
  // reasoning as the striking/grappling grid markup itself already being
  // pre-rendered server-side.
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
  // Same markup/photo path as the site's own hubSide()/mhHubSide() -- kept
  // as its own small avatar here (not .mf-av) since the modal header CSS
  // (mh-hd-av/mh-hd-f) comes straight from the site's stylesheet, which
  // expects this exact inline-styled circle, not the app's own avatar class.
  function hubSide(nm, slug, rec, right){
    var av = slug
      ? '<div style="' + HUB_AV_STYLE + '"><img src="' + window.GL_FIGHTER.PHOTO_BASE + esc(slug) + '.png" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;object-position:top center" onerror="this.parentNode.textContent=\'' + esc(hubInitials(nm)) + '\'"></div>'
      : '<div style="' + HUB_AV_STYLE + '">' + esc(hubInitials(nm)) + '</div>';
    return (
      '<div class="mh-hd-f' + (right ? ' r' : '') + '">' +
        '<span class="mh-hd-av">' + av + '</span>' +
        '<div class="mh-hd-tx"><div class="mh-hd-nm">' + esc(nm) + '</div>' + (rec ? '<div class="mh-hd-rc">' + esc(rec) + '</div>' : '') + '</div>' +
      '</div>'
    );
  }
  function hubShowPane(){
    var key = hubState.tab + '-' + hubState.filter;
    container.querySelectorAll('[data-mh-pane]').forEach(function(p){ p.style.display = (p.getAttribute('data-mh-pane') === key) ? '' : 'none'; });
    var b = container.querySelector('#mh-body');
    if (b) b.scrollTop = 0;
  }
  function hubRenderEntry(){
    var e = hubData[hubState.slug];
    if (!e) return;
    var subBits = [e.weight, e.rounds ? (e.rounds + ' RDS') : ''].filter(Boolean);
    var mid = '<div class="mh-hd-vs">VS</div>' + (subBits.length ? '<div class="mh-hd-sub">' + esc(subBits.join(' · ')) + '</div>' : '');
    var hd = container.querySelector('#mh-hd');
    if (hd) hd.innerHTML = hubSide(e.n1, e.s1, e.rec1, false) + '<div class="mh-hd-mid">' + mid + '</div>' + hubSide(e.n2, e.s2, e.rec2, true);
    var body = container.querySelector('#mh-body');
    if (body) body.innerHTML =
      '<div data-mh-pane="striking-all">' + e.striking.all + '</div>' +
      '<div data-mh-pane="striking-win" style="display:none">' + e.striking.win + '</div>' +
      '<div data-mh-pane="striking-loss" style="display:none">' + e.striking.loss + '</div>' +
      '<div data-mh-pane="grappling-all" style="display:none">' + e.grappling.all + '</div>' +
      '<div data-mh-pane="grappling-win" style="display:none">' + e.grappling.win + '</div>' +
      '<div data-mh-pane="grappling-loss" style="display:none">' + e.grappling.loss + '</div>';
    hubShowPane();
  }
  // iOS Safari ignores body{overflow:hidden} for touch scrolling -- pin the
  // page with position:fixed and restore the exact offset on close, same
  // fix the website's own lockPageScroll/unlockPageScroll use (see
  // worker/pages.js's mfLockScroll comment). Here it's #appScroll (the
  // app's own scrolling column, not <body>) that has to be pinned.
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
  function hubOpen(slug){
    if (!hubData[slug]) return;
    var ov = container.querySelector('#mh-overlay'), bx = container.querySelector('#mh-box');
    if (!ov || !bx) return;
    window.GL_NATIVE.tap();
    hubState = { slug: slug, tab: 'striking', filter: 'all' };
    hubRenderEntry();
    container.querySelectorAll('#mh-tabs .mh-tab').forEach(function(b){ b.classList.toggle('on', b.getAttribute('data-mh-tab') === 'striking'); });
    container.querySelectorAll('#mh-filter .mh-filter-btn').forEach(function(b){ b.classList.toggle('on', b.getAttribute('data-mh-filter') === 'all'); });
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
    var ov = container.querySelector('#mh-overlay'), bx = container.querySelector('#mh-box');
    if (!ov || !bx) return;
    ov.style.opacity = '0';
    bx.style.opacity = '0';
    bx.style.transform = 'translate(-50%,-50%) translateY(8px)';
    setTimeout(function(){ ov.style.display = 'none'; bx.classList.remove('mh-on'); }, 220);
    hubUnlockScroll();
  }
  function wireHub(){
    var overlay = container.querySelector('#mh-overlay');
    if (overlay) overlay.addEventListener('click', function(e){ if (e.target === overlay) hubClose(); });
    var closeBtn = container.querySelector('#mhCloseBtn');
    if (closeBtn) closeBtn.addEventListener('click', function(){ window.GL_NATIVE.tap(); hubClose(); });
    container.querySelectorAll('#mh-tabs .mh-tab').forEach(function(btn){
      btn.addEventListener('click', function(){
        window.GL_NATIVE.tap();
        hubState.tab = btn.getAttribute('data-mh-tab');
        container.querySelectorAll('#mh-tabs .mh-tab').forEach(function(b){ b.classList.toggle('on', b === btn); });
        hubShowPane();
      });
    });
    container.querySelectorAll('#mh-filter .mh-filter-btn').forEach(function(btn){
      btn.addEventListener('click', function(){
        window.GL_NATIVE.tap();
        hubState.filter = btn.getAttribute('data-mh-filter');
        container.querySelectorAll('#mh-filter .mh-filter-btn').forEach(function(b){ b.classList.toggle('on', b === btn); });
        hubShowPane();
      });
    });
  }

  function eventHeaderHTML(card){
    var special = card ? specialClassFor(card.event) : '';
    return (
      '<div class="mf-event-header' + (special ? ' ' + special : '') + '">' +
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
      carouselHTML() +
      hubModalHTML();
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

    container.querySelectorAll('[data-sim-a]').forEach(function(btn){
      btn.addEventListener('click', function(e){
        e.stopPropagation();
        window.GL_NATIVE.tap();
        window.GL_ROUTER.go('simulator', {
          a: btn.getAttribute('data-sim-a'),
          b: btn.getAttribute('data-sim-b'),
          rounds: parseInt(btn.getAttribute('data-sim-rounds'), 10),
        });
      });
    });

    container.querySelectorAll('[data-deepdive]').forEach(function(btn){
      btn.addEventListener('click', function(){
        hubOpen(btn.getAttribute('data-deepdive'));
      });
    });

    wireSearch();
    wireCarousel();
    wireHub();
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

  // The site's #mh-box stylesheet (worker/matchup-free.js's `css`) is only
  // ever injected once per app session -- it's the same ~17KB blob on every
  // load() and every screen visit, so re-injecting it per navigation would
  // just pile up duplicate <style> tags for no benefit.
  function ensureHubCss(css){
    if (!css || document.getElementById('mfHubCssTag')) return;
    var tag = document.createElement('style');
    tag.id = 'mfHubCssTag';
    tag.textContent = css;
    document.head.appendChild(tag);
  }

  function load(eventSlug){
    container.innerHTML = '<p class="gl-muted">Loading the card…</p>';
    // The Card page is public (no login required), unlike the site's fully
    // gated index.html -- so whether to show each fight's Simulate Matchup
    // bar has to come from a parallel, best-effort account() call rather
    // than something already known when this screen loads. A failed/absent
    // account() (logged out, or offline) just means no sim bars, not an
    // error for the whole page -- the matchup data is what actually matters.
    Promise.all([
      window.GL_API.matchup(eventSlug),
      window.GL_API.account().catch(function(){ return null; }),
    ]).then(function(results){
      var res = results[0], acct = results[1];
      subscribed = !!(acct && acct.subscribed);
      data = res;
      ensureHubCss(res.hubCss);
      hubData = {};
      if (res.card && res.hub) hubData[res.card.slug] = res.hub;
      (res.carousel || []).forEach(function(c){ if (c && c.hub) hubData[c.slug] = c.hub; });
      render();
    }).catch(function(){
      container.innerHTML = '<div class="gl-card"><h3 style="margin:0 0 .4rem">Matchup hub unavailable right now</h3><p>Couldn’t reach gillylab.com. Check your connection and try again shortly.</p></div>';
    });
  }

  load();
}
