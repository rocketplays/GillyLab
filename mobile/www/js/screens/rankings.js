window.GL_ROUTER.register('rankings', {
  title: 'Rankings',
  tab: 'rankings',
  render: function(container){
    container.innerHTML = '<div class="gl-card"><p>Loading rankings…</p></div>';

    window.GL_API.rankings().then(function(data){
      var rows = (data && data.pound4pound) || (Array.isArray(data) ? data : []);
      if (!rows.length){ throw new Error('empty'); }
      container.innerHTML = rows.slice(0, 15).map(function(r, i){
        return '<div class="gl-card" style="display:flex;align-items:center;gap:.8rem;padding:.8rem 1rem">' +
          '<div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;color:var(--muted);width:1.6rem">' + (i+1) + '</div>' +
          '<div style="font-weight:700">' + (r.name || r) + '</div>' +
        '</div>';
      }).join('');
    }).catch(function(){
      // Expected during the scaffold stage -- gillylab.com's static JSON
      // likely doesn't send CORS headers yet for a cross-origin app fetch.
      // See api.js for the backend follow-up this depends on.
      container.innerHTML =
        '<div class="gl-card">' +
          '<h3 style="margin:0 0 .4rem">Rankings unavailable right now</h3>' +
          '<p>This screen fetches live data from gillylab.com. That endpoint needs a small CORS update on the backend before the app can read it -- tracked as a follow-up, not a bug in this screen.</p>' +
        '</div>';
    });
  }
});
