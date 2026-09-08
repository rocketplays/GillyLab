// Real dashboard, not a static list of links to the other tabs. Pulls a
// little from each: this week's Pick'em card + your status on it, the
// biggest rankings movers, and a Climb teaser -- so Home actually tells you
// something on open instead of just being a table of contents.
//
// Climb progress note: Climb is deliberately playable with no account (see
// climb.js), and the-climb.html itself only ever persists your bests to
// localStorage (key gl_climb_bests_v1) -- there's no server-side, per-account
// save. Climb's iframe is same-origin as this app shell (climb-game.html is
// bundled, not gillylab.com), so that localStorage IS readable straight from
// here -- but it's honestly a per-device stat, not an account one, and the
// copy below says so rather than implying it's synced.
window.GL_ROUTER.register('home', {
  title: 'GillyLab',
  tab: 'home',
  render: function(container){
    container.innerHTML = '<p class="gl-muted">Loading…</p>';

    function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]; }); }
    function go(route){ return function(){ window.GL_NATIVE.tap(); window.GL_ROUTER.go(route); }; }

    function pickemSection(card, mine){
      var loggedIn = window.GL_AUTH.isLoggedIn();
      var head =
        '<div class="gl-dash-head">' +
          '<span class="gl-label" style="margin:0">This week’s card</span>' +
          '<h3 style="margin:.2rem 0 0">' + esc(card.name) + '</h3>' +
        '</div>';
      var body, cta;
      if (!loggedIn){
        body = '<p class="gl-muted" style="margin:.4rem 0 0">Free account required to play Pick’em.</p>';
        cta = 'Sign up free';
      } else {
        var total = card.bouts.length;
        var done = mine && mine.record && Array.isArray(mine.record.picks) ? mine.record.picks.length : 0;
        if (mine && mine.record){
          body = '<p style="margin:.4rem 0 0"><strong style="color:var(--accent)">Picks submitted</strong> — ' + done + '/' + total + ' fights</p>';
          cta = 'Review picks';
        } else if (card.locked){
          body = '<p class="gl-error" style="margin:.4rem 0 0">Prelims have started — picks are locked for this card.</p>';
          cta = 'View card';
        } else {
          body = '<p class="gl-muted" style="margin:.4rem 0 0">You haven’t made picks yet — ' + total + ' fights on the card.</p>';
          cta = 'Make your picks';
        }
      }
      return (
        '<div class="gl-card gl-dash-card" id="homePickemCard">' +
          head + body +
          '<button type="button" class="gl-btn gl-btn-primary" style="margin-top:.8rem" data-goto="pickem">' + cta + '</button>' +
        '</div>'
      );
    }

    function matchupTeaserSection(card){
      if (!card) return '';
      var main = (card.fights || [])[0];
      return (
        '<div class="gl-card gl-dash-card">' +
          '<div class="gl-dash-head"><span class="gl-label" style="margin:0">Full card &amp; tale of the tape</span></div>' +
          (main ? '<p style="margin:.4rem 0 0"><strong>' + esc(main.f1) + '</strong> vs <strong>' + esc(main.f2) + '</strong> headlines ' + esc(card.event) + '.</p>'
                : '<p class="gl-muted" style="margin:.4rem 0 0">' + esc(card.event) + '</p>') +
          '<button type="button" class="gl-btn gl-btn-outline" style="margin-top:.8rem" data-goto="matchup">See the full matchup breakdown</button>' +
        '</div>'
      );
    }

    function moversSection(rankingsData){
      var movers = (rankingsData && rankingsData.movers) || [];
      var rows = (rankingsData && rankingsData.rows) || [];
      var body;
      if (movers.length){
        body = movers.slice(0, 3).map(function(m){
          var up = m.change > 0;
          return (
            '<div class="gl-dash-row">' +
              '<span class="gl-dash-arrow ' + (up ? 'up' : 'down') + '">' + (up ? '▲' : '▼') + ' ' + Math.abs(m.change) + '</span>' +
              '<span class="gl-dash-row-name">' + esc(m.name) + '</span>' +
              '<span class="gl-muted" style="font-size:.78rem">' + esc(m.division) + '</span>' +
            '</div>'
          );
        }).join('');
      } else if (rows.length){
        // No movement data this sync -- fall back to the top of the
        // pound-for-pound board rather than showing an empty card.
        body = rows.slice(0, 3).map(function(r){
          return (
            '<div class="gl-dash-row">' +
              '<span class="gl-dash-rank">#' + r.rank + '</span>' +
              '<span class="gl-dash-row-name">' + esc(r.name) + '</span>' +
            '</div>'
          );
        }).join('');
      } else {
        body = '<p class="gl-muted" style="margin:0">Rankings unavailable right now.</p>';
      }
      return (
        '<div class="gl-card gl-dash-card">' +
          '<div class="gl-dash-head"><span class="gl-label" style="margin:0">' + (movers.length ? 'Biggest movers' : 'Pound-for-Pound') + '</span></div>' +
          body +
          '<button type="button" class="gl-btn gl-btn-outline" style="margin-top:.8rem" data-goto="rankings">See full rankings</button>' +
        '</div>'
      );
    }

    function climbSection(){
      var bests = null;
      try { var raw = localStorage.getItem('gl_climb_bests_v1'); if (raw) bests = JSON.parse(raw); } catch(e){}
      var body, cta;
      var divs = bests && bests.belts ? Object.keys(bests.belts).length : 0;
      if (bests && (bests.mostWins || divs || bests.fastestBelt)){
        var parts = [];
        if (divs) parts.push('Champion in ' + divs + ' division' + (divs === 1 ? '' : 's'));
        if (bests.mostWins) parts.push('Best run: ' + bests.mostWins + ' wins');
        if (bests.fastestBelt) parts.push('Fastest belt: ' + bests.fastestBelt + ' fight' + (bests.fastestBelt === 1 ? '' : 's'));
        body = '<p style="margin:.4rem 0 0">' + parts.map(esc).join(' &nbsp;·&nbsp; ') + '</p>' +
          '<p class="gl-muted" style="margin:.3rem 0 0;font-size:.78rem">Saved on this device only — not tied to your account.</p>';
        cta = 'Keep climbing';
      } else {
        body = '<p class="gl-muted" style="margin:.4rem 0 0">Build a fighter from a 10-0 prospect and climb the real rankings to a belt. No account needed.</p>';
        cta = 'Play The Climb';
      }
      return (
        '<div class="gl-card gl-dash-card">' +
          '<div class="gl-dash-head"><span class="gl-label" style="margin:0">The Climb</span></div>' +
          body +
          '<button type="button" class="gl-btn gl-btn-outline" style="margin-top:.8rem" data-goto="climb">' + cta + '</button>' +
        '</div>'
      );
    }

    function wire(){
      container.querySelectorAll('[data-goto]').forEach(function(el){
        el.addEventListener('click', go(el.getAttribute('data-goto')));
      });
    }

    function render(pickemCard, pickemMine, rankingsData, matchupCard){
      container.innerHTML =
        (pickemCard ? pickemSection(pickemCard, pickemMine) : '') +
        matchupTeaserSection(matchupCard) +
        moversSection(rankingsData) +
        climbSection() +
        '<div class="gl-card" style="border-color:color-mix(in srgb, var(--accent) 40%, var(--border))">' +
          '<h3 style="margin:0 0 .3rem;color:var(--accent)">Go Premium</h3>' +
          '<p style="margin-bottom:.8rem">Full fighter database, live odds, the simulator, and more.</p>' +
          '<button type="button" class="gl-btn gl-btn-outline" data-goto="premium">See what’s included</button>' +
        '</div>';
      wire();
    }

    window.GL_AUTH.ready.then(function(){
      var loggedIn = window.GL_AUTH.isLoggedIn();
      return Promise.all([
        window.GL_API.pickemCard().catch(function(){ return null; }),
        window.GL_API.rankings().catch(function(){ return null; }),
        window.GL_API.matchup().catch(function(){ return null; }),
      ]).then(function(results){
        var cardRes = results[0], rankingsData = results[1], matchupRes = results[2];
        var card = cardRes && cardRes.card;
        var matchupCard = matchupRes && matchupRes.card;
        if (!card || !loggedIn) return render(card, null, rankingsData, matchupCard);
        return window.GL_API.pickemMine(card.slug).catch(function(){ return null; }).then(function(mine){
          render(card, mine, rankingsData, matchupCard);
        });
      });
    });
  }
});
