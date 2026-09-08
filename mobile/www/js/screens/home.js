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
          '<h2 class="gl-dash-title">Pick’em</h2>' +
          '<p class="gl-muted" style="margin:.2rem 0 0">' + esc(card.name) + '</p>' +
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
        '<div class="gl-sec" id="homePickemCard">' +
          head + body +
          '<button type="button" class="gl-btn gl-btn-outline" style="margin-top:.8rem" data-goto="pickem">' + cta + '</button>' +
        '</div>'
      );
    }

    // The top of Home -- a side-by-side main-event teaser (both fighters'
    // photos, tap "View Full Card" for the real Card/Matchup screen), same
    // spot the premium in-app home page gives its own featured event.
    function mainEventSection(card){
      var main = card && (card.fights || [])[0];
      var head = '<div class="gl-dash-head"><h2 class="gl-dash-title">This Week’s Main Event</h2></div>';
      if (!card || !main){
        return (
          '<div class="gl-sec">' + head +
            '<p class="gl-muted" style="margin:.4rem 0 0">No card posted yet — check back on fight week.</p>' +
          '</div>'
        );
      }
      var av = function(slug, name){
        var ini = window.GL_FIGHTER.initials(name);
        return (
          '<div class="he-av">' +
            '<span class="he-av-initials">' + esc(ini) + '</span>' +
            (slug ? '<img class="he-av-photo" src="' + window.GL_FIGHTER.PHOTO_BASE + esc(slug) + '.png" alt="" onerror="this.style.display=\'none\'">' : '') +
          '</div>'
        );
      };
      return (
        '<div class="gl-sec gl-sec--first">' +
          head +
          '<div class="he-row">' +
            '<div class="he-side">' + av(main.s1, main.f1) + '<div class="he-name">' + esc(main.f1) + '</div></div>' +
            '<div class="he-vs">VS</div>' +
            '<div class="he-side">' + av(main.s2, main.f2) + '<div class="he-name">' + esc(main.f2) + '</div></div>' +
          '</div>' +
          '<p class="gl-muted" style="margin:.6rem 0 0;text-align:center">' + esc(card.event) + '</p>' +
          '<button type="button" class="gl-btn gl-btn-outline" style="margin-top:.8rem" data-goto="matchup">View Full Card</button>' +
        '</div>'
      );
    }

    function rosterSection(rosterData){
      var fighters = (rosterData && rosterData.fighters) || [];
      var weeks = (rosterData && rosterData.changes) || [];
      var w = weeks[0];
      var body;
      if (!fighters.length){
        body = '<p class="gl-muted" style="margin:.4rem 0 0">Roster unavailable right now.</p>';
      } else {
        body = '<p style="margin:.4rem 0 0">' + fighters.length + ' fighters on the active roster</p>';
        if (w && ((w.added && w.added.length) || (w.removed && w.removed.length))){
          body += '<p class="gl-muted" style="margin:.2rem 0 0;font-size:.82rem">' +
            (w.added ? w.added.length : 0) + ' added &nbsp;·&nbsp; ' + (w.removed ? w.removed.length : 0) + ' removed this week</p>';
        }
      }
      return (
        '<div class="gl-sec">' +
          '<div class="gl-dash-head"><h2 class="gl-dash-title">Active Roster</h2></div>' +
          body +
          '<button type="button" class="gl-btn gl-btn-outline" style="margin-top:.8rem" data-goto="roster">View roster</button>' +
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
        '<div class="gl-sec">' +
          '<div class="gl-dash-head"><h2 class="gl-dash-title">' + (movers.length ? 'Biggest Movers' : 'Pound-for-Pound') + '</h2></div>' +
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
        '<div class="gl-sec">' +
          '<div class="gl-dash-head"><h2 class="gl-dash-title">The Climb</h2></div>' +
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

    // Order mirrors the tab bar below Home: Card, Pick'em, Climb, Rankings,
    // Roster -- each with its own small preview -- so Home reads as a
    // dashboard over the rest of the app rather than an arbitrary list.
    function render(pickemCard, pickemMine, rankingsData, matchupCard, rosterData){
      container.innerHTML =
        mainEventSection(matchupCard) +
        (pickemCard ? pickemSection(pickemCard, pickemMine) : '') +
        climbSection() +
        moversSection(rankingsData) +
        rosterSection(rosterData) +
        '<div class="gl-cta" style="border-color:color-mix(in srgb, var(--accent) 40%, var(--border))">' +
          '<h3 style="margin:0 0 .3rem;color:var(--accent)">Go Premium</h3>' +
          '<p style="margin-bottom:.8rem;color:var(--muted)">Full fighter database, live odds, the simulator, and more.</p>' +
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
        window.GL_API.roster().catch(function(){ return null; }),
      ]).then(function(results){
        var cardRes = results[0], rankingsData = results[1], matchupRes = results[2], rosterData = results[3];
        var card = cardRes && cardRes.card;
        var matchupCard = matchupRes && matchupRes.card;
        if (!card || !loggedIn) return render(card, null, rankingsData, matchupCard, rosterData);
        return window.GL_API.pickemMine(card.slug).catch(function(){ return null; }).then(function(mine){
          render(card, mine, rankingsData, matchupCard, rosterData);
        });
      });
    });
  }
});
