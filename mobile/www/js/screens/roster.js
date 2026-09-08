// Active Roster -- free on the website at /roster, no account needed. Pulls
// GET /api/app/roster (worker/index.js): the full active-roster name list
// plus this week's signings/releases, each name resolved to a /fighter/
// <slug> profile slug server-side (same profileSlugFor() the website's own
// rosterSSR() uses) so a tap only ever opens a profile that actually exists.
window.GL_ROUTER.register('roster', {
  title: 'Active Roster',
  tab: 'roster',
  render: function(container){
    mountRoster(container);
  }
});

function mountRoster(container){
  container.innerHTML = '<p class="gl-muted">Loading roster…</p>';
  var fighters = [], changes = [];
  var activeLetter = 'All';

  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]; }); }

  function nameHTML(f){
    return f.slug
      ? '<button type="button" class="ar-name" data-slug="' + esc(f.slug) + '">' + esc(f.name) + '</button>'
      : '<span class="ar-name ar-name-plain">' + esc(f.name) + '</span>';
  }

  function changesHTML(){
    if (!changes.length) return '';
    var col = function(title, items, cls){
      return (
        '<div class="ar-ch-col">' +
          '<div class="ar-ch-h ' + cls + '">' + title + ' <span class="ar-ch-n">' + items.length + '</span></div>' +
          (items.length
            ? items.map(function(f){ return '<div class="ar-ch-row">' + nameHTML(f) + '</div>'; }).join('')
            : '<div class="gl-muted" style="font-size:.82rem">None</div>')
        + '</div>'
      );
    };
    var weeks = changes.map(function(w){
      return (
        '<div class="gl-card" style="margin-bottom:.7rem">' +
          '<div class="gl-label" style="margin:0 0 .6rem">' + esc(w.week || '') + '</div>' +
          '<div class="ar-ch-cols">' + col('Added', w.added || [], 'up') + col('Removed', w.removed || [], 'down') + '</div>' +
        '</div>'
      );
    }).join('');
    return '<div class="gl-dash-head" style="margin-bottom:.4rem"><span class="gl-label" style="margin:0">This week’s roster moves</span></div>' + weeks;
  }

  function listHTML(){
    var letters = ['All'].concat('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''));
    var bar = letters.map(function(L){
      return '<button type="button" class="ar-letter' + (L === activeLetter ? ' active' : '') + '" data-l="' + L + '">' + L + '</button>';
    }).join('');
    var shown = activeLetter === 'All' ? fighters : fighters.filter(function(f){ return (f.name || '').trim().toUpperCase().indexOf(activeLetter) === 0; });
    var body = shown.length
      ? '<div class="ar-count">' + shown.length + ' fighter' + (shown.length === 1 ? '' : 's') + '</div><div class="ar-grid">' + shown.map(nameHTML).join('') + '</div>'
      : '<p class="gl-muted">No fighters starting with "' + esc(activeLetter) + '".</p>';
    return (
      '<div class="ar-bar">' + bar + '</div>' +
      body
    );
  }

  function renderList(){
    container.innerHTML =
      '<div class="gl-card"><h3 style="margin:0 0 .3rem">' + fighters.length + ' fighters on the active roster</h3><p class="gl-muted" style="margin:0">Kept up to date with the week’s signings and releases.</p></div>' +
      changesHTML() +
      '<div id="arList">' + listHTML() + '</div>';
    wireList();
  }

  function wireList(){
    container.querySelectorAll('.ar-letter').forEach(function(btn){
      btn.addEventListener('click', function(){
        window.GL_NATIVE.tap();
        activeLetter = btn.getAttribute('data-l');
        var listHost = container.querySelector('#arList');
        if (listHost) listHost.innerHTML = listHTML();
        wireList();
      });
    });
    // A full navigation to the 'fighter' route (its own back button returns
    // here) -- mirrors the website: clicking a fighter is a real page
    // change, not a panel dropped on top of the roster list.
    container.querySelectorAll('[data-slug]').forEach(function(btn){
      btn.addEventListener('click', function(){
        window.GL_NATIVE.tap();
        window.GL_ROUTER.go('fighter', { slug: btn.getAttribute('data-slug') });
      });
    });
  }

  window.GL_API.roster().then(function(res){
    fighters = res.fighters || [];
    changes = res.changes || [];
    renderList();
  }).catch(function(){
    container.innerHTML = '<div class="gl-card"><h3 style="margin:0 0 .4rem">Roster unavailable right now</h3><p>Couldn’t reach gillylab.com. Check your connection and try again shortly.</p></div>';
  });
}
