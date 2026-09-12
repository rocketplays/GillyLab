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
  // Fetched once at mount (mirrors home.js's / rankings.js's own account()
  // check) so the bottom "Go Premium" CTA -- aimed at non-subscribers --
  // doesn't show to someone who's already premium.
  var subscribed = false;

  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]; }); }

  function nameHTML(f){
    return f.slug
      ? '<button type="button" class="ar-name" data-slug="' + esc(f.slug) + '">' + esc(f.name) + '</button>'
      : '<span class="ar-name ar-name-plain">' + esc(f.name) + '</span>';
  }

  // Free-flowing, like the website's own rosterSSR() -- each week is just
  // margin-separated, not boxed (only the fight cards on Matchup and the
  // Premium lock block are ever boxed on the site).
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
        '<div class="ar-ch-week">' +
          '<div class="gl-label" style="margin:0 0 .6rem">' + esc(w.week || '') + '</div>' +
          '<div class="ar-ch-cols">' + col('Added', w.added || [], 'up') + col('Removed', w.removed || [], 'down') + '</div>' +
        '</div>'
      );
    }).join('');
    return '<div class="ar-ch-wrap"><div class="gl-label" style="margin:0 0 .7rem">This week’s roster moves</div>' + weeks + '</div>';
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
      '<h1 class="gl-heading" style="font-size:1.3rem;margin:0 0 .2rem">Active Roster</h1>' +
      '<p class="gl-muted" style="margin:0 0 1.1rem">' + fighters.length + ' fighters, kept up to date with the week’s signings and releases.</p>' +
      changesHTML() +
      '<div id="arList">' + listHTML() + '</div>' +
      (subscribed ? '' : '<div class="gl-cta">Roster is free. <button type="button" class="gl-link-btn" data-goto="premium">Go Premium</button> for every fighter’s full analytics, the simulator and more.</div>');
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
    var goPrem = container.querySelector('[data-goto="premium"]');
    if (goPrem) goPrem.addEventListener('click', function(){ window.GL_NATIVE.tap(); window.GL_ROUTER.go('premium'); });
  }

  // Same loggedIn/account() shape as home.js's/rankings.js's own subscription
  // check -- account() requires a session, so it's only attempted when one
  // exists; any failure just leaves `subscribed` false.
  var loggedIn = window.GL_AUTH && window.GL_AUTH.isLoggedIn && window.GL_AUTH.isLoggedIn();
  var acctPromise = loggedIn ? window.GL_API.account().catch(function(){ return null; }) : Promise.resolve(null);

  Promise.all([window.GL_API.roster(), acctPromise]).then(function(results){
    var res = results[0], acct = results[1];
    fighters = res.fighters || [];
    changes = res.changes || [];
    subscribed = !!(acct && acct.subscribed);
    renderList();
  }).catch(function(){
    container.innerHTML = '<h3 style="margin:0 0 .4rem">Roster unavailable right now</h3><p class="gl-muted">Couldn’t reach gillylab.com. Check your connection and try again shortly.</p>';
  });
}
