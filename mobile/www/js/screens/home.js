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

    // Pick'em is its own top-level category, same as Climb/Rankings/Roster --
    // it just sits right after This Week's Main Event since it's about that
    // same card.
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
          '<div class="gl-sec gl-sec--first">' + head +
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

    // Small circular avatar (photo, falling back to initials) -- reuses
    // Rankings' own .rk-av/.rk-av-initials/.rk-av-photo styling rather than
    // inventing a third avatar size, since this list is basically a 3-row
    // slice of that same screen.
    function moverAvatar(name, photo){
      var ini = window.GL_FIGHTER.initials(name);
      return (
        '<span class="rk-av">' +
          '<span class="rk-av-initials">' + esc(ini) + '</span>' +
          (photo ? '<img class="rk-av-photo" src="' + window.GL_FIGHTER.PHOTO_BASE + esc(photo) + '.png" alt="" onerror="this.style.display=\'none\'">' : '') +
        '</span>'
      );
    }
    function moverName(name, slug){
      return slug
        ? '<button type="button" class="gl-dash-row-name gl-link-btn" style="text-decoration:none;color:inherit" data-slug="' + esc(slug) + '">' + esc(name) + '</button>'
        : '<span class="gl-dash-row-name">' + esc(name) + '</span>';
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
              moverAvatar(m.name, m.photo) +
              '<span class="gl-dash-arrow ' + (up ? 'up' : 'down') + '">' + (up ? '▲' : '▼') + ' ' + Math.abs(m.change) + '</span>' +
              moverName(m.name, m.slug) +
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
              moverAvatar(r.name, r.photo) +
              moverName(r.name, r.slug) +
            '</div>'
          );
        }).join('');
      } else {
        body = '<p class="gl-muted" style="margin:0">Rankings unavailable right now.</p>';
      }
      return (
        '<div class="gl-sec">' +
          '<div class="gl-dash-head gl-dash-head--evenspace"><h2 class="gl-dash-title">' + (movers.length ? 'Rankings — Biggest Movers' : 'Rankings — Pound-for-Pound') + '</h2></div>' +
          body +
          '<button type="button" class="gl-btn gl-btn-outline" style="margin-top:.8rem" data-goto="rankings">See full rankings</button>' +
        '</div>'
      );
    }

    // Premium-only teaser cards for the three tools that got their own
    // direct tabs (see router.js's PREMIUM_TABS) but have no data pipeline
    // built yet -- odds.js/bettracker.js/tapestudy.js are still "Coming
    // soon" stub screens. Simulator isn't previewed here since it already
    // has its own "Simulate Matchup" button on every fight on the Events
    // tab -- a Home teaser for it would just be a second, redundant
    // entry point. Copy below mirrors the real premium website's own
    // headers/blurbs for these three pages verbatim (see index.html's
    // #page-odds/#page-bets/#page-tape-study) so the preview describes
    // what's actually coming, not a made-up placeholder pitch.
    function toolPreviewSection(title, blurb, cta, route, extra){
      return (
        '<div class="gl-sec">' +
          '<div class="gl-dash-head"><h2 class="gl-dash-title">' + esc(title) + '</h2></div>' +
          '<p style="margin:.4rem 0 0">' + blurb + '</p>' +
          (extra ? '<p class="gl-muted" style="margin:.3rem 0 0;font-size:.78rem">' + extra + '</p>' : '') +
          '<button type="button" class="gl-btn gl-btn-outline" style="margin-top:.8rem" data-goto="' + route + '">' + esc(cta) + '</button>' +
        '</div>'
      );
    }
    // Site header: "Betting Odds" / "Odds across all major sportsbooks ·
    // Updated daily" (index.html's #page-odds).
    function oddsPreviewSection(){
      return toolPreviewSection(
        'Betting Odds',
        'Moneylines and prop markets across every major sportsbook for every fight on the card.',
        'View Odds', 'odds'
      );
    }
    // Site header: "Bet & CLV Tracker" / "Input your bets to track CLV,
    // ROI, units and record." plus its exact disclaimer (index.html's
    // #page-bets) -- carried over here since it's a real legal note, not
    // just marketing copy.
    function bettrackerPreviewSection(){
      return toolPreviewSection(
        'Bet & CLV Tracker',
        'Log your bets to track closing-line value, ROI, units and your record.',
        'Open Bet Tracker', 'bettracker',
        'A personal record-keeping tool only — GillyLab doesn’t accept wagers, handle money, or offer betting advice.'
      );
    }
    // Site header: "Tape Study" / "Tape index for upcoming events" --
    // organized by event then fighter (index.html's #page-tape-study),
    // separate from the tape study tab already inside a fighter's own
    // profile.
    function tapestudyPreviewSection(){
      return toolPreviewSection(
        'Tape Study',
        'A tape index for every upcoming card — browse by event, then by fighter.',
        'Browse Tape Study', 'tapestudy'
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
      // Movers' names are tappable straight to their fighter profile, same as
      // everywhere else in the app (Roster/Matchup/Rankings) -- a full route
      // navigation with its own back button, not a panel over Home.
      container.querySelectorAll('[data-slug]').forEach(function(el){
        el.addEventListener('click', function(){
          window.GL_NATIVE.tap();
          window.GL_ROUTER.go('fighter', { slug: el.getAttribute('data-slug') });
        });
      });
    }

    // Free order: Card, Pick'em (about that same card), Climb, Rankings,
    // Roster, then the Go Premium pitch -- each its own top-level category
    // with its own small preview, so Home reads as a dashboard over the
    // rest of the app rather than an arbitrary list.
    //
    // Premium order differs: Card, then teasers for the three new
    // premium-only tools that don't have their own Home real estate yet
    // (Odds/Bet Tracker/Tape Study -- see the toolPreviewSection functions
    // above), then Rankings, Roster, and Pick'em/Climb pushed down to the
    // bottom two slots. A premium member already knows Pick'em and Climb
    // are there (they're direct tabs' worth of familiar), so the new tools
    // get the prominent spots up top instead; the Go Premium pitch is
    // dropped entirely since a subscriber has already bought in.
    function render(pickemCard, pickemMine, rankingsData, matchupCard, rosterData, subscribed){
      var pickem = pickemCard ? pickemSection(pickemCard, pickemMine) : '';
      var climb = climbSection();
      var rankings = moversSection(rankingsData);
      var roster = rosterSection(rosterData);
      container.innerHTML = subscribed
        ? (
            mainEventSection(matchupCard) +
            oddsPreviewSection() +
            bettrackerPreviewSection() +
            tapestudyPreviewSection() +
            rankings +
            roster +
            pickem +
            climb
          )
        : (
            mainEventSection(matchupCard) +
            pickem +
            climb +
            rankings +
            roster +
            '<div class="gl-cta" style="border-color:color-mix(in srgb, var(--accent) 40%, var(--border))">' +
              '<h3 style="margin:0 0 .3rem;color:var(--accent)">Go Premium</h3>' +
              '<p style="margin-bottom:.8rem;color:var(--muted)">Full fighter database, live odds, the simulator, and more.</p>' +
              '<button type="button" class="gl-btn gl-btn-outline" data-goto="premium">See what’s included</button>' +
            '</div>'
          );
      wire();
    }

    window.GL_AUTH.ready.then(function(){
      var loggedIn = window.GL_AUTH.isLoggedIn();
      return Promise.all([
        window.GL_API.pickemCard().catch(function(){ return null; }),
        window.GL_API.rankings().catch(function(){ return null; }),
        window.GL_API.matchup().catch(function(){ return null; }),
        window.GL_API.roster().catch(function(){ return null; }),
        loggedIn ? window.GL_API.account().catch(function(){ return null; }) : Promise.resolve(null),
      ]).then(function(results){
        var cardRes = results[0], rankingsData = results[1], matchupRes = results[2], rosterData = results[3], acct = results[4];
        var card = cardRes && cardRes.card;
        var matchupCard = matchupRes && matchupRes.card;
        var subscribed = !!(acct && acct.subscribed);
        if (!card || !loggedIn) return render(card, null, rankingsData, matchupCard, rosterData, subscribed);
        return window.GL_API.pickemMine(card.slug).catch(function(){ return null; }).then(function(mine){
          render(card, mine, rankingsData, matchupCard, rosterData, subscribed);
        });
      });
    });
  }
});
