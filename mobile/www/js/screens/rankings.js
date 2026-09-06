window.GL_ROUTER.register('rankings', {
  title: 'Rankings',
  tab: 'rankings',
  render: function(container){
    container.innerHTML = '<div class="gl-card"><p>Loading rankings…</p></div>';

    // Hits /api/app/rankings (worker/index.js) -- a small purpose-built,
    // CORS-enabled endpoint for the app, rather than the raw
    // /data/rankings.json the website itself reads (that file has no CORS
    // headers of its own, and a cross-origin `fetch` needs them to read
    // the response at all).
    window.GL_API.rankings().then(function(data){
      var rows = (data && data.rows) || [];
      if (!rows.length){ throw new Error('empty'); }
      container.innerHTML = rows.slice(0, 15).map(function(r){
        return '<div class="gl-card" style="display:flex;align-items:center;gap:.8rem;padding:.8rem 1rem">' +
          '<div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;color:var(--muted);width:1.6rem">' + r.rank + '</div>' +
          '<div style="font-weight:700">' + r.name + '</div>' +
        '</div>';
      }).join('');
    }).catch(function(){
      container.innerHTML =
        '<div class="gl-card">' +
          '<h3 style="margin:0 0 .4rem">Rankings unavailable right now</h3>' +
          '<p>Couldn’t reach gillylab.com. Check your connection and try again shortly.</p>' +
        '</div>';
    });
  }
});
