// UFC Rankings -- free on the website at /rankings, no account needed. Was
// a stub (Men's Pound-for-Pound top 15, media panel only, no photos) built
// alongside the Home dashboard before this screen existed for real. Now
// mirrors the website page itself: a Media Panel / Meta AI toggle, every
// division as its own tab (not just P4P), photos with an initials fallback,
// country flags, movement badges, and a tap-through to the same fighter
// lite profile panel Roster/Matchup use. Data comes from GET
// /api/app/rankings?source=media|meta (worker/index.js), which resolves
// each entry to a real /fighter/<slug> the same way rankingsPage's own
// rowHTML does server-side.
window.GL_ROUTER.register('rankings', {
  title: 'Rankings',
  tab: 'rankings',
  render: function(container){
    mountRankings(container);
  }
});

var DIV_LABELS = {
  "Men's Pound-for-Pound Top Rank": "Men's P4P",
  "Women's Pound-for-Pound Top Rank": "Women's P4P",
  'Light Heavyweight': 'Light Heavy',
  "Women's Strawweight": 'W. Strawweight',
  "Women's Flyweight": 'W. Flyweight',
  "Women's Bantamweight": 'W. Bantamweight',
};

function mountRankings(container){
  container.innerHTML = '<p class="gl-muted">Loading rankings…</p>';

  var source = 'media';
  var data = null;      // last successful response for the current source
  var activeDiv = null;
  // Fetched once at mount (mirrors home.js's own account() check) so the
  // bottom "Go Premium" CTA -- a marketing box aimed at non-subscribers --
  // doesn't show to someone who's already premium.
  var subscribed = false;

  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]; }); }
  function divLabel(d){ return DIV_LABELS[d] || d; }
  function isP4PDiv(d){ return /Pound-for-Pound/.test(d || ''); }

  // Mirrors the website's rankingRecordShort() in index.html: "18-2-0" ->
  // "18–2" (draws dropped when zero), "18-2-1" -> "18–2–1".
  function recordShort(record){
    var m = String(record || '').match(/(\d+)-(\d+)-(\d+)/);
    if (!m) return record || '';
    return m[3] !== '0' ? (m[1] + '–' + m[2] + '–' + m[3]) : (m[1] + '–' + m[2]);
  }

  function movBadge(e){
    if (e.isNewEntry) return '<span class="rk-mov new">NEW</span>';
    if (typeof e.rankChange === 'number' && e.rankChange > 0) return '<span class="rk-mov up">▲' + e.rankChange + '</span>';
    if (typeof e.rankChange === 'number' && e.rankChange < 0) return '<span class="rk-mov down">▼' + Math.abs(e.rankChange) + '</span>';
    return '<span class="rk-mov"></span>';
  }

  function rowHTML(e, isP4P){
    var ini = window.GL_FIGHTER.initials(e.name);
    var localThumb = e.photo ? (window.GL_FIGHTER.PHOTO_BASE + esc(e.photo) + '.png') : null;
    var primary = e.imageUrl || localThumb;
    var img = primary
      ? '<span class="rk-av"><span class="rk-av-initials">' + esc(ini) + '</span><img class="rk-av-photo" src="' + esc(primary) + '" alt="" loading="lazy" onerror="' + (e.imageUrl && localThumb ? "this.dataset.tried?this.style.display='none':(this.dataset.tried=1,this.src='" + esc(localThumb) + "')" : "this.style.display='none'") + '"></span>'
      : '<span class="rk-av"><span class="rk-av-initials">' + esc(ini) + '</span></span>';
    var interim = !!e.isInterimChamp;
    var num = e.isChampion ? (interim ? 'IC' : 'C') : ('#' + (e.rank != null ? e.rank : '?'));
    var nameHTML = e.slug
      ? '<button type="button" class="rk-name" data-slug="' + esc(e.slug) + '">' + esc(e.name) + '</button>'
      : '<span class="rk-name rk-name-plain">' + esc(e.name) + '</span>';
    var record = '<span class="rk-record">' + (e.record ? esc(recordShort(e.record)) : '') + '</span>';
    // The Champion/Interim Champion tag used to render as its own pill at
    // the end of the row, but the rk-num column already shows "C"/"IC" for
    // every champion (see `num` above) -- the tag was just repeating that
    // in words, so it's dropped here. tagFor()/tagFor's non-champion
    // division-abbreviation case was never actually reachable (see the
    // comment on tagFor itself), so removing this loses nothing else.
    //
    // rk-flag is now ALWAYS rendered (empty when e.flag is missing) rather
    // than only when present -- .rk-row is a CSS grid with a fixed column
    // per field (see app.css), so a row that skips the flag span entirely
    // shifts every column after it left by one slot, which is exactly the
    // "flags and records don't line up" bug: whether a row's flag/record
    // lined up with its neighbors depended on which OTHER rows around it
    // happened to have a flag or a mov badge, not on that row's own content.
    return (
      '<div class="rk-row' + (e.isChampion ? ' rk-champ' : '') + (interim ? ' rk-interim' : '') + '">' +
        '<span class="rk-num">' + num + '</span>' +
        img +
        nameHTML +
        '<span class="rk-flag">' + (e.flag ? esc(e.flag) : '') + '</span>' +
        movBadge(e) +
        record +
      '</div>'
    );
  }

  function panelHTML(){
    var entries = (data && data.divisions && data.divisions[activeDiv]) || [];
    var isP4P = isP4PDiv(activeDiv);
    return (
      '<div class="rk-panel-title">' + esc(divLabel(activeDiv)) + '</div>' +
      (entries.length ? entries.map(function(e){ return rowHTML(e, isP4P); }).join('') : '<p class="gl-muted" style="text-align:center;padding:1.5rem 0">No entries.</p>')
    );
  }

  // ── Cross-division "Ranking Changes" widget ────────────────────────────
  // Mirrors index.html's renderRankingChangesSummary()/getMovFromHistory():
  // the website computes this purely from fields already on each entry in
  // rankings.json/rankings-meta.json (rankChange / isNewEntry / rank), not
  // from a separate history file or a live diff against a stored previous
  // fetch -- there's no movementHistory array in our checked-in snapshots
  // (that field only appears in a live Cito API pull), so the site's own
  // "recent changes" already runs on the manual rankChange/isNewEntry path.
  // Same data the API's shapeEntry() already serves per row, so this is
  // pure client-side math over the existing /api/app/rankings payload --
  // no new endpoint or generator needed.
  function fmtChgDate(s){
    if (!s) return '';
    var d = new Date(s + 'T00:00:00Z');
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { timeZone: 'UTC', month: 'short', day: 'numeric' });
  }

  function movFromEntry(e){
    if (e.isChampion) return null;
    if (e.isNewEntry) return { direction: 'new', amount: 0, prevRank: null, currRank: e.rank };
    if (typeof e.rankChange === 'number' && e.rankChange !== 0){
      var delta = e.rankChange, currRank = e.rank;
      return { direction: delta > 0 ? 'up' : 'down', amount: Math.abs(delta), prevRank: currRank != null ? currRank + delta : null, currRank: currRank };
    }
    return null;
  }

  function rankingChangesHTML(){
    if (!data || !data.divisions) return '';
    var groups = [];
    var total = 0;
    (data.tabs || []).forEach(function(d){
      if (isP4PDiv(d)) return; // site's widget skips P4P too
      var movers = [];
      (data.divisions[d] || []).forEach(function(e){
        var m = movFromEntry(e);
        if (!m) return;
        movers.push({ name: e.name, slug: e.slug, direction: m.direction, amount: m.amount, prevRank: m.prevRank, currRank: m.currRank });
      });
      if (!movers.length) return;
      movers.sort(function(a, b){ return (a.currRank != null ? a.currRank : 999) - (b.currRank != null ? b.currRank : 999); });
      groups.push({ div: d, movers: movers });
      total += movers.length;
    });
    if (!total) return '';

    var dateLabel = (data.comparedDate && data.date)
      ? (fmtChgDate(data.comparedDate) + ' → ' + fmtChgDate(data.date))
      : (data.date ? fmtChgDate(data.date) : '');

    var groupsHTML = groups.map(function(g){
      var rowsHTML = g.movers.map(function(m){
        var isNew = m.direction === 'new';
        var isUp = m.direction === 'up';
        var cls = isNew ? 'new' : (isUp ? 'up' : 'down');
        var badge = isNew ? 'NEW' : ((isUp ? '▲' : '▼') + m.amount);
        var ranks = isNew ? ('NR→#' + m.currRank) : ('#' + m.prevRank + '→#' + m.currRank);
        var nameHTML = m.slug
          ? '<button type="button" class="rk-chg-name" data-chg-slug="' + esc(m.slug) + '">' + esc(m.name) + '</button>'
          : '<span class="rk-chg-name rk-chg-name-plain">' + esc(m.name) + '</span>';
        return (
          '<div class="rk-chg-row">' +
            '<span class="rk-chg-arrow ' + cls + '">' + badge + '</span>' +
            nameHTML +
            '<span class="rk-chg-ranks">' + ranks + '</span>' +
          '</div>'
        );
      }).join('');
      return '<div class="rk-chg-group"><div class="rk-chg-div-label">' + esc(divLabel(g.div)) + '</div>' + rowsHTML + '</div>';
    }).join('');

    return (
      '<div class="rk-chg" id="rkChanges">' +
        '<div class="rk-chg-hdr">' +
          '<span class="rk-chg-title">' + total + ' Changes</span>' +
          '<span class="rk-chg-date">' + esc(dateLabel) + '</span>' +
          '<span class="rk-chg-chevron">▾</span>' +
        '</div>' +
        '<div class="rk-chg-body"><div class="rk-chg-groups">' + groupsHTML + '</div></div>' +
      '</div>'
    );
  }

  function tabsHTML(){
    return (data.tabs || []).map(function(d){
      return '<button type="button" class="rk-tab' + (d === activeDiv ? ' sel' : '') + '" data-div="' + esc(d) + '">' + esc(divLabel(d)) + '</button>';
    }).join('');
  }

  function render(){
    var dateLine = data.date
      ? (function(){ var dt = new Date(data.date + 'T00:00:00Z'); return isNaN(dt.getTime()) ? '' : 'Updated ' + dt.toLocaleDateString(undefined, { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' }); })()
      : '';
    container.innerHTML =
      '<h1 class="gl-heading" style="margin:.1rem 0 .2rem">UFC <span style="color:var(--accent)">Rankings</span></h1>' +
      (dateLine ? '<p class="gl-muted" style="margin:0 0 .9rem">' + esc(dateLine) + '</p>' : '') +
      '<div class="rk-toggle">' +
        '<button type="button" class="' + (source === 'media' ? 'sel' : '') + '" data-src="media">Media Panel</button>' +
        '<button type="button" class="' + (source === 'meta' ? 'sel' : '') + '" data-src="meta">Meta AI</button>' +
      '</div>' +
      '<p class="rk-src-sub gl-muted">' + (source === 'meta' ? 'Generated by Meta AI statistical model' : 'Generated by UFC media voting panel') + '</p>' +
      rankingChangesHTML() +
      '<div class="rk-tabs">' + tabsHTML() + '</div>' +
      '<div id="rkPanel">' + panelHTML() + '</div>' +
      (subscribed ? '' : '<div class="gl-cta">Rankings are free. <button type="button" class="gl-link-btn" data-goto="premium">Go Premium</button> for every fighter’s full analytics, the simulator and more.</div>');
    wire();
  }

  // Split so switching divisions only re-wires the tabs/panel it actually
  // replaces -- calling the whole wire() again on every tab tap (the
  // previous version) re-attached a fresh listener to .rk-toggle and the
  // Go Premium link (neither one gets rebuilt by a division switch) on top
  // of the one already there, so a few taps in, one click fired several
  // haptics/navigations at once.
  function wireTabsAndPanel(){
    container.querySelectorAll('.rk-tab').forEach(function(btn){
      btn.addEventListener('click', function(){
        window.GL_NATIVE.tap();
        activeDiv = btn.getAttribute('data-div');
        container.querySelector('.rk-tabs').innerHTML = tabsHTML();
        container.querySelector('#rkPanel').innerHTML = panelHTML();
        wireTabsAndPanel();
      });
    });
    container.querySelectorAll('[data-slug]').forEach(function(btn){
      btn.addEventListener('click', function(){
        window.GL_NATIVE.tap();
        // A full navigation to the 'fighter' route -- its own back button
        // returns here, mirroring the website's real page change instead of
        // a panel dropped on top of the rankings list.
        window.GL_ROUTER.go('fighter', { slug: btn.getAttribute('data-slug') });
      });
    });
  }

  function wire(){
    container.querySelectorAll('.rk-toggle button').forEach(function(btn){
      btn.addEventListener('click', function(){
        window.GL_NATIVE.tap();
        var s = btn.getAttribute('data-src');
        if (s === source) return;
        source = s;
        activeDiv = null;
        load();
      });
    });
    wireTabsAndPanel();
    var goPrem = container.querySelector('[data-goto="premium"]');
    if (goPrem) goPrem.addEventListener('click', function(){ window.GL_NATIVE.tap(); window.GL_ROUTER.go('premium'); });
    // Ranking Changes widget -- wired here (not wireTabsAndPanel) because,
    // like .rk-toggle and Go Premium above, it isn't rebuilt on a division
    // tab switch. Re-wiring it from wireTabsAndPanel would stack a fresh
    // click listener on the same still-present nodes every time a tab is
    // tapped (the exact bug the wireTabsAndPanel split above was written to
    // avoid for .rk-toggle/.gl-cta).
    var chg = container.querySelector('#rkChanges');
    if (chg){
      var hdr = chg.querySelector('.rk-chg-hdr');
      if (hdr) hdr.addEventListener('click', function(){ window.GL_NATIVE.tap(); chg.classList.toggle('open'); });
      chg.querySelectorAll('[data-chg-slug]').forEach(function(btn){
        btn.addEventListener('click', function(){
          window.GL_NATIVE.tap();
          window.GL_ROUTER.go('fighter', { slug: btn.getAttribute('data-chg-slug') });
        });
      });
    }
  }

  function load(){
    container.innerHTML = '<p class="gl-muted">Loading rankings…</p>';
    window.GL_API.rankings(source).then(function(res){
      data = res;
      if (!activeDiv || (data.tabs || []).indexOf(activeDiv) < 0) activeDiv = (data.tabs || [])[0] || null;
      if (!activeDiv){ container.innerHTML = '<p class="gl-muted">Rankings unavailable right now.</p>'; return; }
      render();
    }).catch(function(){
      container.innerHTML =
        '<h3 style="margin:0 0 .4rem">Rankings unavailable right now</h3>' +
        '<p class="gl-muted">Couldn’t reach gillylab.com. Check your connection and try again shortly.</p>';
    });
  }

  // Same loggedIn/account() shape as home.js's own fetchPremiumPreviews call
  // -- account() requires a session, so it's only attempted when one exists;
  // any failure (offline, expired token) just leaves `subscribed` false,
  // same fallback subscription.js uses for the tab bar.
  var loggedIn = window.GL_AUTH && window.GL_AUTH.isLoggedIn && window.GL_AUTH.isLoggedIn();
  (loggedIn ? window.GL_API.account().catch(function(){ return null; }) : Promise.resolve(null)).then(function(acct){
    subscribed = !!(acct && acct.subscribed);
    load();
  });
}
