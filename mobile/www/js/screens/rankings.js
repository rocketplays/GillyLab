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

  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]; }); }
  function divLabel(d){ return DIV_LABELS[d] || d; }

  function movBadge(e){
    if (e.isNewEntry) return '<span class="rk-mov new">NEW</span>';
    if (typeof e.rankChange === 'number' && e.rankChange > 0) return '<span class="rk-mov up">▲' + e.rankChange + '</span>';
    if (typeof e.rankChange === 'number' && e.rankChange < 0) return '<span class="rk-mov down">▼' + Math.abs(e.rankChange) + '</span>';
    return '<span class="rk-mov"></span>';
  }

  function rowHTML(e){
    var ini = window.GL_FIGHTER.initials(e.name);
    var localThumb = e.photo ? (window.GL_FIGHTER.PHOTO_BASE + esc(e.photo) + '.png') : null;
    var primary = e.imageUrl || localThumb;
    var img = primary
      ? '<span class="rk-av"><span class="rk-av-initials">' + esc(ini) + '</span><img class="rk-av-photo" src="' + esc(primary) + '" alt="" loading="lazy" onerror="' + (e.imageUrl && localThumb ? "this.dataset.tried?this.style.display='none':(this.dataset.tried=1,this.src='" + esc(localThumb) + "')" : "this.style.display='none'") + '"></span>'
      : '<span class="rk-av"><span class="rk-av-initials">' + esc(ini) + '</span></span>';
    var num = e.isChampion ? 'C' : ('#' + (e.rank != null ? e.rank : '?'));
    var nameHTML = e.slug
      ? '<button type="button" class="rk-name" data-slug="' + esc(e.slug) + '">' + esc(e.name) + '</button>'
      : '<span class="rk-name rk-name-plain">' + esc(e.name) + '</span>';
    return (
      '<div class="rk-row' + (e.isChampion ? ' rk-champ' : '') + '">' +
        '<span class="rk-num">' + num + '</span>' +
        img +
        nameHTML +
        (e.flag ? '<span class="rk-flag">' + esc(e.flag) + '</span>' : '') +
        movBadge(e) +
      '</div>'
    );
  }

  function panelHTML(){
    var entries = (data && data.divisions && data.divisions[activeDiv]) || [];
    return (
      '<div class="rk-panel-title">' + esc(divLabel(activeDiv)) + '</div>' +
      (entries.length ? entries.map(rowHTML).join('') : '<p class="gl-muted" style="text-align:center;padding:1.5rem 0">No entries.</p>')
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
      '<div class="gl-card" style="margin-bottom:.7rem">' +
        (dateLine ? '<p class="gl-muted" style="margin:0 0 .7rem">' + esc(dateLine) + ' · ' + (source === 'meta' ? 'Meta AI' : 'UFC Media Panel') + '</p>' : '') +
        '<div class="rk-toggle">' +
          '<button type="button" class="' + (source === 'media' ? 'sel' : '') + '" data-src="media">Media Panel</button>' +
          '<button type="button" class="' + (source === 'meta' ? 'sel' : '') + '" data-src="meta">Meta AI</button>' +
        '</div>' +
      '</div>' +
      '<div class="rk-tabs">' + tabsHTML() + '</div>' +
      '<div id="rkPanel">' + panelHTML() + '</div>';
    wire();
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
    container.querySelectorAll('.rk-tab').forEach(function(btn){
      btn.addEventListener('click', function(){
        window.GL_NATIVE.tap();
        activeDiv = btn.getAttribute('data-div');
        container.querySelector('.rk-tabs').innerHTML = tabsHTML();
        container.querySelector('#rkPanel').innerHTML = panelHTML();
        wire();
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

  function load(){
    container.innerHTML = '<p class="gl-muted">Loading rankings…</p>';
    window.GL_API.rankings(source).then(function(res){
      data = res;
      if (!activeDiv || (data.tabs || []).indexOf(activeDiv) < 0) activeDiv = (data.tabs || [])[0] || null;
      if (!activeDiv){ container.innerHTML = '<p class="gl-muted">Rankings unavailable right now.</p>'; return; }
      render();
    }).catch(function(){
      container.innerHTML =
        '<div class="gl-card">' +
          '<h3 style="margin:0 0 .4rem">Rankings unavailable right now</h3>' +
          '<p>Couldn’t reach gillylab.com. Check your connection and try again shortly.</p>' +
        '</div>';
    });
  }

  load();
}
