// Fighter lite profile -- a real full-screen route (registered below), not a
// panel layered over whatever screen sent you here. That mirrors the
// website exactly: clicking a fighter on /roster, /matchup or /rankings is a
// full page navigation to /fighter/<slug> with its own back button, not an
// accordion that leaves the previous page's header/list still sitting there
// underneath. Roster/Matchup/Rankings all just do
// `window.GL_ROUTER.go('fighter', { slug: slug })` and the router's own
// back-stack (see router.js's `previous`/`back()`) returns to whichever one
// of them sent you here.
//
// Data comes from GET /api/app/fighter?slug=... (worker/index.js), which is
// the exact same data/fighter-lite.json entry the website's own /fighter/
// <slug> page renders -- same bio, same division-relative stat bars, same
// "the rest is Premium" locked grid.
window.GL_ROUTER.register('fighter', {
  title: 'Fighter',
  showBack: true,
  render: function(container, params){
    window.GL_FIGHTER.load(container, params && params.slug);
  }
});

window.GL_FIGHTER = (function(){
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]; }); }
  function initials(name){
    var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  var PHOTO_BASE = window.GL_API.BASE + '/photos/thumb/';

  function avatarHtml(f){
    var ini = initials(f.name);
    return (
      '<div class="fp-av">' +
        '<span class="fp-av-initials">' + esc(ini) + '</span>' +
        (f.photo ? '<img class="fp-av-photo" src="' + PHOTO_BASE + esc(f.photo) + '.png" alt="" onerror="this.style.display=\'none\'">' : '') +
      '</div>'
    );
  }

  function bioHTML(phys){
    phys = phys || {};
    var cells = [['Height', phys.ht], ['Reach', phys.reach], ['Age', phys.age], ['Stance', phys.stance], ['Gym', phys.gym]]
      .filter(function(c){ return c[1]; })
      .map(function(c){ return '<div><div class="fsx-bio-k">' + c[0] + '</div><div class="fsx-bio-v">' + esc(c[1]) + '</div></div>'; })
      .join('');
    return cells ? '<div class="fsx-bio">' + cells + '</div>' : '';
  }

  function statsHTML(groups){
    if (!groups || !groups.length) return '';
    var legend =
      '<div class="fsx-caption">' +
        '<span class="fsx-lg"><span class="fsx-lg-sw good"></span>better than average</span>' +
        '<span class="fsx-lg"><span class="fsx-lg-sw bad"></span>below average</span>' +
        '<span class="fsx-lg"><span class="fsx-lg-tick"></span>division average</span>' +
      '</div>';
    var body = groups.map(function(g){
      var rows = (g.rows || []).map(function(r){
        var bar = r.bar
          ? '<div class="fsx-bar"><div class="fsx-track"><div class="fsx-fill ' + (r.cls || '') + '" style="width:' + r.w + '%"></div></div><div class="fsx-tick" style="left:' + r.tickX + '%"></div></div>'
          : '<div class="fsx-bar"><div class="fsx-track fsx-track-empty"></div></div>';
        return '<div class="fsx-row"><div class="fsx-label">' + esc(r.label) + '</div>' + bar + '<div class="fsx-val ' + (r.cls || '') + '">' + esc(r.val) + '</div></div>';
      }).join('');
      return '<div class="fsx-group"><div class="fsx-group-t">' + esc(g.t) + '</div>' + rows + '</div>';
    }).join('');
    return legend + body;
  }

  function lockedHTML(){
    var items = [
      ['Fight simulator', 'Run this fighter against anyone on the roster.'],
      ['Full fight history', 'Every pro bout — result, method, round &amp; opponent.'],
      ['Box scores', 'Full detailed statistics for every UFC bout in history, head-to-head.'],
      ['Tape study', 'Links to full video of each of their previous fights.'],
      ['Closing-line history', 'Their closing line for each fight — favorite or underdog.'],
      ['Accolades', 'Belt ranks, titles, finishes, bonuses &amp; records.'],
      ['Scouting report', 'Style, pace, tendencies and the path to beating them.'],
      ['Live odds &amp; props', 'Moneyline, round totals &amp; method props by book.'],
    ];
    var grid = items.map(function(it){
      return '<div class="fp-lock-i"><div class="fp-lock-it">' + it[0] + '</div><div class="fp-lock-id">' + it[1] + '</div></div>';
    }).join('');
    return (
      '<div class="fp-lock">' +
        '<div class="fp-lock-h"><span class="fp-lock-ico">🔒</span><div class="fp-lock-t">The full profile &amp; tools</div></div>' +
        '<div class="gl-muted" style="margin:.2rem 0 .8rem">Everything GillyLab Premium unlocks:</div>' +
        '<div class="fp-lock-grid">' + grid + '</div>' +
        '<button type="button" class="gl-btn gl-btn-primary" data-goto="premium">Go Premium for the full profile &amp; tools</button>' +
      '</div>'
    );
  }

  // Free-flowing, like the website's own /fighter/<slug> page (.fp-head,
  // .fsx-bio, .fsx-group) -- avatar/name header and stat bars are plain
  // content with thin divider lines, not boxed cards. Only the Premium
  // lock block at the end is ever boxed on the site.
  function renderHTML(f){
    f = f || {};
    var rankLabel = f.rank && f.rank !== 'NR' ? (/C/.test(f.rank) ? 'Champion' : f.rank) : '';
    var metaBits = [f.record, f.division, f.country].filter(Boolean).join(' · ');
    return (
      '<div class="fp-head">' +
        avatarHtml(f) +
        '<div>' +
          (rankLabel ? '<div class="gl-label" style="margin:0 0 .1rem;color:var(--accent)">' + esc(rankLabel) + '</div>' : '') +
          '<h1 class="gl-heading" style="margin:0;font-size:1.3rem">' + esc(f.name) + '</h1>' +
          (metaBits ? '<p class="gl-muted" style="margin:.2rem 0 0">' + esc(metaBits) + '</p>' : '') +
        '</div>' +
      '</div>' +
      bioHTML(f.phys) +
      statsHTML(f.groups) +
      lockedHTML()
    );
  }

  // Renders straight into `container` (loading state, then result), and wires
  // the profile's own "Go Premium" button. Callers own the back button and
  // list-vs-panel visibility around this -- see roster.js/matchup.js.
  function load(container, slug){
    container.innerHTML = '<p class="gl-muted">Loading fighter…</p>';
    window.GL_API.fighter(slug).then(function(res){
      container.innerHTML = renderHTML(res.fighter);
      // Same touch as the website's per-fighter <title> -- the top bar names
      // the actual fighter once loaded instead of sitting on the generic
      // "Fighter" placeholder the whole time.
      var titleEl = document.getElementById('topbarTitle');
      if (titleEl && res.fighter && res.fighter.name) titleEl.textContent = res.fighter.name;
      var goPrem = container.querySelector('[data-goto="premium"]');
      if (goPrem) goPrem.addEventListener('click', function(){
        window.GL_NATIVE.tap();
        window.GL_ROUTER.go('premium');
      });
    }).catch(function(){
      container.innerHTML = '<p class="gl-error">Couldn’t load this fighter’s profile — check your connection and try again.</p>';
    });
  }

  return { load: load, renderHTML: renderHTML, avatarHtml: avatarHtml, initials: initials, esc: esc, PHOTO_BASE: PHOTO_BASE };
})();
