// Real dashboard, not a static list of links to the other tabs. Pulls a
// little from each: this week's main event (with a real tale-of-the-tape
// stat peek), the upcoming card strip, a betting-odds peek, the biggest
// rankings movers, the active roster (with a division breakdown), and
// Pick'em/Climb/Legends Bracket collapsed into one compact "Play & Compete"
// row -- so Home actually tells you something on open instead of being a
// table of contents, and reads as a dashboard with real variety in it
// (a hero visual, a horizontal scroller, a probability slip, a composition
// chart) rather than six identical text-and-button blocks stacked straight
// down. This is a full rebuild of the previous version, worked out with the
// user across several mockup passes before being ported here.
//
// One deliberate simplification versus the old Home: the Bet Tracker and
// Tape Study preview cards that used to live here for premium members are
// gone. Both tools are still fully reachable (Bet Tracker/Tape Study tabs,
// or the More sheet), they just don't get their own Home teaser anymore --
// the new layout is one shared structure for every account tier rather than
// a different premium-only stack of sections, and those two didn't have a
// place in the design the user actually approved. Worth revisiting if that
// costs those features real discoverability.
//
// Also NOT included yet: a "2026 Leaders" stat-leaderboard section (sig.
// strikes/takedowns/KO/submission leaders) was part of the mockups this was
// built from, but there is no season-stat-leaders data pipeline anywhere in
// this codebase yet -- computing it for real means a new aggregation script
// over fight-stats.json, not just a home.js change. Left out rather than
// shipped with placeholder numbers; see the conversation this was built
// from for the mockup if/when that pipeline gets built.
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
    function go(route, params){ return function(){ window.GL_NATIVE.tap(); window.GL_ROUTER.go(route, params); }; }

    // Last name only, same suffix-skipping logic as bettracker.js's own
    // surname() -- used here for the Scheduled Cards strip's matchup line
    // ("Silva vs Wang" rather than the full billed event name).
    function surname(n){
      var p = String(n || '').trim().split(/\s+/);
      var i = p.length - 1;
      while (i > 0 && /^(jr|sr|ii|iii|iv|v)\.?$/i.test(p[i])) i--;
      return p[i] || n;
    }

    // Small circular avatar (photo, falling back to initials) -- shared by
    // every section below (hero, event strip, movers, roster strip) rather
    // than each inventing its own markup, same as the old moverAvatar().
    function av(name, photo, cls){
      var ini = window.GL_FIGHTER.initials(name);
      return (
        '<span class="av ' + (cls || '') + '">' +
          '<span class="av-initials">' + esc(ini) + '</span>' +
          (photo ? '<img class="av-photo" src="' + window.GL_FIGHTER.PHOTO_BASE + esc(photo) + '.png" alt="" onerror="this.style.display=\'none\'">' : '') +
        '</span>'
      );
    }

    // ── 1. This Week's Main Event -- hero avatars/VS row (unchanged from the
    // old mainEventSection) plus a new "Tale of the Tape" stat peek when the
    // API actually has one (taleOfTape is null for a pairing with too little
    // per-fighter stat coverage -- see worker/index.js's taleOfTapeFor).
    function tapeHTML(rows){
      if (!rows || !rows.length) return '';
      var short = { 'Sig. strikes landed / min':'Sig Str', 'Striking accuracy':'Str Acc', 'Striking defense':'Str Def', 'Takedowns / 15 min':'TD Avg', 'Takedown accuracy':'TD Acc', 'Takedown defense':'TD Def' };
      var body = rows.map(function(r){
        var aw = Math.max(0, Math.min(100, r.aW || 0)), bw = Math.max(0, Math.min(100, r.bW || 0));
        var total = aw + bw || 1;
        return (
          '<div class="he-tape-row">' +
            '<span class="he-tape-label">' + esc(short[r.label] || r.label) + '</span>' +
            '<span class="he-tape-bar">' +
              '<span class="he-tape-fill a" style="width:' + (aw / total * 100) + '%"></span>' +
              '<span class="he-tape-fill b" style="width:' + (bw / total * 100) + '%"></span>' +
            '</span>' +
          '</div>'
        );
      }).join('');
      return '<div class="he-tape"><div class="he-tape-title">Tale of the Tape</div>' + body + '</div>';
    }
    function mainEventSection(card, taleOfTape){
      var main = card && (card.fights || [])[0];
      var head = '<div class="gl-dash-head"><h2 class="gl-dash-title hm-title">This Week’s Main Event</h2></div>';
      if (!card || !main){
        return (
          '<div class="gl-sec gl-sec--first">' + head +
            '<p class="gl-muted" style="margin:.4rem 0 0">No card posted yet — check back on fight week.</p>' +
          '</div>'
        );
      }
      var heName = function(name, slug){
        return slug
          ? '<button type="button" class="he-name" style="background:none;border:none;padding:0;margin:0;font:inherit;color:inherit;cursor:pointer" data-slug="' + esc(slug) + '">' + esc(name) + '</button>'
          : '<div class="he-name">' + esc(name) + '</div>';
      };
      return (
        '<div class="gl-sec gl-sec--first">' +
          head +
          '<div class="he-row">' +
            '<div class="he-side">' + av(main.f1, main.s1, 'he-av') + heName(main.f1, main.s1) + '</div>' +
            '<div class="he-vs">VS</div>' +
            '<div class="he-side">' + av(main.f2, main.s2, 'he-av') + heName(main.f2, main.s2) + '</div>' +
          '</div>' +
          '<p class="gl-muted" style="margin:.6rem 0 .8rem;text-align:center">' + esc(card.event) + '</p>' +
          tapeHTML(taleOfTape) +
          '<button type="button" class="gl-btn gl-btn-outline" style="margin-top:.8rem" data-goto="matchup">View Full Card</button>' +
        '</div>'
      );
    }

    // ── 2. Scheduled Cards -- horizontal strip of the upcoming carousel,
    // same numbered(gold)/DWCS(blue)/regular(green) event classification
    // matchup.js's own eventTypeClass()/isDwcsName() use for the Events tab,
    // ported here rather than shared as a module since it's three lines.
    function eventKind(name){
      if (/^UFC\s+\d+\b/i.test(String(name || '').trim())) return 'gold';
      if (/contender\s+series|dana\s+white/i.test(name || '')) return 'blue';
      return 'green';
    }
    // The billed event string is the only place season/week shows up (no
    // separate structured field from the API) -- older cards were numbered
    // sequentially instead ("Dana White's Contender Series 68") and have no
    // season/week to parse, so those just fall back to the plain "DWCS" tag.
    function eventKindLabel(kind, name){
      if (kind === 'gold') return name;
      if (kind === 'blue'){
        var m = /Season\s*(\d+)\D+Week\s*(\d+)/i.exec(name || '');
        return m ? ('DWCS: S' + m[1] + ' E' + m[2]) : 'DWCS';
      }
      return 'Fight Night';
    }
    function scheduledCardsSection(carousel){
      var events = (carousel || []).slice(0, 8);
      if (!events.length) return '';
      var cards = events.map(function(c){
        var main = (c.fights || [])[0];
        var kind = eventKind(c.event);
        var when = c.date ? new Date(c.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
        var matchup = main ? (surname(main.f1) + ' vs ' + surname(main.f2)) : (c.event || '');
        return (
          '<button type="button" class="hm-ev-card ' + kind + '" data-goto="matchup">' +
            '<div class="hm-ev-tag ' + kind + '">' + esc(eventKindLabel(kind, c.event)) + '</div>' +
            (main ? '<div class="hm-ev-fighters">' + av(main.f1, main.s1, 'hm-ev-av') + av(main.f2, main.s2, 'hm-ev-av') + '</div>' : '') +
            '<div class="hm-ev-title">' + esc(matchup) + '</div>' +
            '<div class="hm-ev-date">' + esc(when) + '</div>' +
          '</button>'
        );
      }).join('');
      return (
        '<div class="gl-sec">' +
          '<div class="gl-dash-head gl-dash-head--evenspace"><h2 class="gl-dash-title hm-title">Scheduled Cards</h2></div>' +
          '<div class="hm-strip">' + cards + '</div>' +
        '</div>'
      );
    }

    // ── 3. Betting Odds -- a real probability slip for the main event
    // (moneyline + a de-vigged win% bar), not a full odds board -- the full
    // Odds & Projections screen is a premium tab, so the button under this
    // only appears for subscribed accounts; free accounts still get the
    // peek (the same moneyline the Events tab's tiles already show them).
    function impliedPct(o1, o2){
      if (o1 == null || o2 == null) return null;
      var raw = function(american){ return american < 0 ? (-american) / (-american + 100) : 100 / (american + 100); };
      var a = raw(o1), b = raw(o2);
      var sum = a + b;
      if (!sum) return null;
      return { a: Math.round(a / sum * 100), b: Math.round(b / sum * 100) };
    }
    function oddsSection(matchupCard, subscribed){
      var main = matchupCard && (matchupCard.fights || [])[0];
      if (!main || (main.o1 == null && main.o2 == null)) return '';
      var pct = impliedPct(main.o1, main.o2);
      var fmt = function(v){ return (v == null || v === '') ? '—' : String(v); };
      return (
        '<div class="gl-sec">' +
          '<div class="gl-dash-head"><h2 class="gl-dash-title hm-title">Betting Odds</h2></div>' +
          '<div class="hm-odds-card">' +
            '<div class="hm-odds-fighter">' + av(main.f1, main.s1, 'hm-odds-av') + '<span class="hm-odds-fname">' + esc(main.f1) + '</span>' +
              '<span class="hm-odds-pill ' + (main.o1 < main.o2 ? 'fav' : 'dog') + '">' + esc(fmt(main.o1)) + '</span></div>' +
            '<div class="hm-odds-fighter" style="margin-bottom:0">' + av(main.f2, main.s2, 'hm-odds-av') + '<span class="hm-odds-fname">' + esc(main.f2) + '</span>' +
              '<span class="hm-odds-pill ' + (main.o2 < main.o1 ? 'fav' : 'dog') + '">' + esc(fmt(main.o2)) + '</span></div>' +
            (pct ? (
              '<div class="hm-odds-bar"><span class="hm-odds-bar-a" style="width:' + pct.a + '%"></span><span class="hm-odds-bar-b" style="width:' + pct.b + '%"></span></div>' +
              '<div class="hm-odds-foot"><span>' + esc(main.f1) + ' ' + pct.a + '%</span><span>' + esc(main.f2) + ' ' + pct.b + '%</span></div>'
            ) : '') +
          '</div>' +
          (subscribed ? '<button type="button" class="gl-btn gl-btn-outline" style="margin-top:.8rem" data-goto="odds">View Odds</button>' : '') +
        '</div>'
      );
    }

    // ── 4. Biggest Movers -- unchanged rows, always ends in a real button
    // (this used to be the one list-style section that only had a top-right
    // text link instead of a bottom button like Odds/Roster; fixed to match).
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
              av(m.name, m.photo, 'gl-dash-av') +
              '<span class="gl-dash-arrow ' + (up ? 'up' : 'down') + '">' + (up ? '▲' : '▼') + ' ' + Math.abs(m.change) + '</span>' +
              moverName(m.name, m.slug) +
              '<span class="gl-muted" style="font-size:.78rem">' + esc(m.division) + '</span>' +
            '</div>'
          );
        }).join('');
      } else if (rows.length){
        body = rows.slice(0, 3).map(function(r){
          return (
            '<div class="gl-dash-row">' +
              '<span class="gl-dash-rank">#' + r.rank + '</span>' +
              av(r.name, r.photo, 'gl-dash-av') +
              moverName(r.name, r.slug) +
            '</div>'
          );
        }).join('');
      } else {
        body = '<p class="gl-muted" style="margin:0">Rankings unavailable right now.</p>';
      }
      return (
        '<div class="gl-sec">' +
          '<div class="gl-dash-head gl-dash-head--evenspace"><h2 class="gl-dash-title hm-title">' + (movers.length ? 'Biggest Movers' : 'Rankings — Pound-for-Pound') + '</h2></div>' +
          body +
          '<button type="button" class="gl-btn gl-btn-outline" style="margin-top:.8rem" data-goto="rankings">View Rankings</button>' +
        '</div>'
      );
    }

    // ── 4b. "<year> Leaders" -- the season stat-leaderboard from the
    // original mockups, built for real now off GET /api/app/leaders (see
    // worker/index.js + scripts/gen-season-leaders.cjs). Free-tier content,
    // same as everything else above it -- one horizontal strip of four
    // category cards (reusing the Scheduled Cards strip pattern), each a
    // top-3 ranked list rather than a single number, so it reads as a real
    // leaderboard, not just another stat tile.
    var LEADER_CATEGORIES = [
      { key: 'sigStrikes', label: 'Sig. Strikes', unit: '', color: 'var(--accent)' },
      { key: 'takedowns', label: 'Takedowns', unit: '', color: '#3a86ff' },
      { key: 'ko', label: 'KO/TKO', unit: '', color: '#e6b800' },
      { key: 'submissions', label: 'Submissions', unit: '', color: '#a855f7' },
    ];
    function leaderCard(cat, rows){
      if (!rows || !rows.length) return '';
      var body = rows.slice(0, 3).map(function(r, i){
        return (
          '<div class="hm-lead-row">' +
            '<span class="hm-lead-rank">' + (i + 1) + '</span>' +
            av(r.name, r.photo, 'hm-lead-av') +
            (r.slug
              ? '<button type="button" class="hm-lead-name gl-link-btn" data-slug="' + esc(r.slug) + '">' + esc(r.name) + '</button>'
              : '<span class="hm-lead-name">' + esc(r.name) + '</span>') +
            '<span class="hm-lead-val">' + r.value + '</span>' +
          '</div>'
        );
      }).join('');
      return (
        '<div class="hm-lead-card">' +
          '<div class="hm-lead-title" style="color:' + cat.color + '">' + esc(cat.label) + '</div>' +
          body +
        '</div>'
      );
    }
    function leadersSection(leadersData){
      var year = (leadersData && leadersData.year) || new Date().getFullYear();
      var categories = (leadersData && leadersData.categories) || {};
      var cards = LEADER_CATEGORIES.map(function(cat){ return leaderCard(cat, categories[cat.key]); }).filter(Boolean).join('');
      if (!cards) return '';
      return (
        '<div class="gl-sec">' +
          '<div class="gl-dash-head"><h2 class="gl-dash-title hm-title">' + year + ' Leaders</h2></div>' +
          '<div class="hm-strip hm-lead-strip">' + cards + '</div>' +
        '</div>'
      );
    }

    // ── 5. Active Roster -- big count + a 4-photo strip (worker's own
    // /api/app/roster now sends both `divisions` and `photos`, cross-
    // referenced from fighter-lite.json since roster.json itself is just a
    // flat name list with no division on it) plus a 12-division composition
    // bar with its own legend, grouped under Men's/Women's.
    var DIVISION_COLORS = {
      'Flyweight': '#00e668', 'Bantamweight': '#3a86ff', 'Featherweight': '#e6b800', 'Lightweight': '#a855f7',
      'Welterweight': '#ff9d3a', 'Middleweight': '#ff3d00', 'Light Heavyweight': '#ff5c8a', 'Heavyweight': '#14b8a6',
      "Women's Strawweight": '#38bdf8', "Women's Flyweight": '#a3e635', "Women's Bantamweight": '#818cf8', "Women's Featherweight": '#d6a26a',
      'Other': '#5b5b63'
    };
    var MEN_DIVS = ['Flyweight', 'Bantamweight', 'Featherweight', 'Lightweight', 'Welterweight', 'Middleweight', 'Light Heavyweight', 'Heavyweight'];
    var WOMEN_DIVS = ["Women's Strawweight", "Women's Flyweight", "Women's Bantamweight", "Women's Featherweight"];
    function rosterSection(rosterData){
      var fighters = (rosterData && rosterData.fighters) || [];
      var divisions = (rosterData && rosterData.divisions) || [];
      var photos = (rosterData && rosterData.photos) || [];
      if (!fighters.length){
        return (
          '<div class="gl-sec">' +
            '<div class="gl-dash-head"><h2 class="gl-dash-title hm-title">Active Roster</h2></div>' +
            '<p class="gl-muted" style="margin:.4rem 0 0">Roster unavailable right now.</p>' +
            '<button type="button" class="gl-btn gl-btn-outline" style="margin-top:.8rem" data-goto="roster">View Roster</button>' +
          '</div>'
        );
      }
      var total = fighters.length;
      var byDiv = {};
      divisions.forEach(function(d){ byDiv[d.division] = d.count; });
      var bar = divisions.filter(function(d){ return d.count > 0; }).map(function(d){
        return '<span style="width:' + (d.count / total * 100) + '%;background:' + (DIVISION_COLORS[d.division] || DIVISION_COLORS.Other) + '"></span>';
      }).join('');
      var legendGroup = function(label, divs){
        var items = divs.filter(function(d){ return (byDiv[d] || 0) > 0; }).map(function(d){
          return '<span class="hm-comp-item"><span class="hm-comp-dot" style="background:' + DIVISION_COLORS[d] + '"></span>' + esc(d.replace("Women's ", '')) + '</span>';
        }).join('');
        return items ? '<div class="hm-comp-group-label">' + label + '</div><div class="hm-comp-legend">' + items + '</div>' : '';
      };
      var otherCount = byDiv['Other'] || 0;
      var photoStrip = photos.map(function(p){ return av(p.name, p.photo, 'hm-roster-av'); }).join('');
      return (
        '<div class="gl-sec">' +
          '<div class="gl-dash-head"><h2 class="gl-dash-title hm-title">Active Roster</h2></div>' +
          '<div class="hm-roster-top">' +
            '<div><div class="hm-roster-stat">' + total + '</div><div class="hm-roster-stat-label">on current roster</div></div>' +
            (photoStrip ? '<div class="hm-roster-strip">' + photoStrip + '</div>' : '') +
          '</div>' +
          (bar ? '<div class="hm-comp-bar">' + bar + '</div>' : '') +
          legendGroup("Men's", MEN_DIVS) +
          legendGroup("Women's", WOMEN_DIVS) +
          (otherCount ? '<div class="hm-comp-legend"><span class="hm-comp-item"><span class="hm-comp-dot" style="background:' + DIVISION_COLORS.Other + '"></span>Other</span></div>' : '') +
          '<button type="button" class="gl-btn gl-btn-outline" style="margin-top:.8rem" data-goto="roster">View Roster</button>' +
        '</div>'
      );
    }

    // ── 6. Play & Compete -- Pick'em/Climb/Legends Bracket as one row of
    // three square tiles instead of three separate full-width sections.
    // Each tile carries its own short status line, computed the same way
    // the old full-size sections used to.
    function pickemTileStatus(card, mine){
      var loggedIn = window.GL_AUTH.isLoggedIn();
      if (!card) return 'This week’s card';
      if (!loggedIn) return 'Sign up free';
      var total = card.bouts.length;
      var done = mine && mine.record && Array.isArray(mine.record.picks) ? mine.record.picks.length : 0;
      if (mine && mine.record) return done + '/' + total + ' picked';
      if (card.locked) return 'Picks locked';
      return total + ' fights open';
    }
    // Bracket rotates weekly at a fixed epoch Monday -- same
    // BRACKET_EPOCH_MONDAY/weekly-boundary math as worker/index.js's
    // bracketWeekIndex(), computed here client-side purely off Date.now()
    // since the rotation instant is fixed and needs no API round-trip.
    var BRACKET_EPOCH_MONDAY = Date.UTC(2024, 0, 1, 5, 0, 0);
    var BRACKET_WEEK_MS = 7 * 24 * 3600 * 1000;
    function bracketCountdown(){
      var now = Date.now();
      var n = Math.floor((now - BRACKET_EPOCH_MONDAY) / BRACKET_WEEK_MS);
      var nextRotation = BRACKET_EPOCH_MONDAY + (n + 1) * BRACKET_WEEK_MS;
      var ms = nextRotation - now;
      if (ms <= 0) return 'Updates soon';
      var totalHours = Math.floor(ms / 3600000);
      var d = Math.floor(totalHours / 24), h = totalHours % 24;
      return 'Updates in ' + d + 'D ' + h + 'H';
    }
    function playCompeteSection(pickemCard, pickemMine){
      return (
        '<div class="gl-sec">' +
          '<div class="gl-dash-head"><h2 class="gl-dash-title hm-title">Play & Compete</h2></div>' +
          '<div class="hm-tile-row">' +
            '<button type="button" class="hm-tile" data-goto="pickem"><span class="hm-tile-icon">🥊</span><span class="hm-tile-title">Pick’em</span><span class="hm-tile-sub">' + esc(pickemTileStatus(pickemCard, pickemMine)) + '</span></button>' +
            '<button type="button" class="hm-tile" data-goto="climb"><span class="hm-tile-icon">🏔️</span><span class="hm-tile-title">The Climb</span><span class="hm-tile-sub">Build a fighter, become the GOAT</span></button>' +
            '<button type="button" class="hm-tile" data-goto="bracket"><span class="hm-tile-icon">🏆</span><span class="hm-tile-title">Legends Bracket</span><span class="hm-tile-sub">' + esc(bracketCountdown()) + '</span></button>' +
          '</div>' +
        '</div>'
      );
    }

    // ── 7. Your Premium Tools -- Bet Tracker + Tape Study previews,
    // subscribed accounts only (see render()'s subscribed ? ... branch).
    // Reintroduces what the previous rebuild deliberately dropped (see the
    // file header comment), reshaped to fit this one-shared-layout Home
    // instead of living in a separate premium-only stack: two richer cards
    // (real numbers, real avatars) rather than a third square icon tile,
    // since these already have actual data behind them, unlike Play &
    // Compete's tiles which are mostly just entry points.
    // Same icon+title header shape on both cards below (previously Bet
    // Tracker was a stat grid and Tape Study was an avatar pair -- two
    // different layouts side by side read as messy/inconsistent; unified
    // to one shape so the row reads as a matched pair).
    function toolStat(val, cls, label){
      return '<div class="hm-tool-stat"><span class="hm-tool-stat-v ' + (cls || '') + '">' + val + '</span><span class="hm-tool-stat-l">' + label + '</span></div>';
    }
    function betTrackerCard(stats){
      var hasBets = !!(stats && stats.n > 0);
      var body;
      if (!hasBets){
        body = '<div class="hm-tool-sub">Log your first bet and this card starts tracking your units, record and closing-line value automatically.</div>';
      } else {
        var unitsTxt = stats.units == null ? '—' : (stats.units > 0 ? '+' : '') + stats.units.toFixed(1) + 'u';
        var unitsCls = stats.units > 0 ? 'hm-tool-pos' : stats.units < 0 ? 'hm-tool-neg' : '';
        var roiTxt = stats.roi == null ? '—' : (stats.roi > 0 ? '+' : '') + stats.roi.toFixed(1) + '%';
        var roiCls = stats.roi > 0 ? 'hm-tool-pos' : stats.roi < 0 ? 'hm-tool-neg' : '';
        var clvTxt = stats.avgClv == null ? '—' : (stats.avgClv > 0 ? '+' : '') + stats.avgClv.toFixed(1) + ' pts';
        var clvCls = stats.avgClv > 0 ? 'hm-tool-pos' : stats.avgClv < 0 ? 'hm-tool-neg' : '';
        body = (
          '<div class="hm-tool-stats">' +
            toolStat(unitsTxt, unitsCls, 'Units') +
            toolStat(stats.w + '-' + stats.l, '', 'Record') +
            toolStat(roiTxt, roiCls, 'ROI') +
            toolStat(clvTxt, clvCls, 'Avg CLV') +
          '</div>'
        );
      }
      return (
        '<div class="hm-tool-card">' +
          '<div class="hm-tool-head"><span class="hm-tool-icon">🎯</span><span class="hm-tool-title">Bet Tracker</span></div>' +
          body +
          '<button type="button" class="gl-btn gl-btn-outline hm-tool-btn" data-goto="bettracker">Open Bet Tracker</button>' +
        '</div>'
      );
    }
    function tapeStudyCard(){
      return (
        '<div class="hm-tool-card">' +
          '<div class="hm-tool-head"><span class="hm-tool-icon">🎬</span><span class="hm-tool-title">Tape Study</span></div>' +
          '<div class="hm-tool-sub">Full tape index for all upcoming events.</div>' +
          '<button type="button" class="gl-btn gl-btn-outline hm-tool-btn" data-goto="tapestudy">Browse Tape Study</button>' +
        '</div>'
      );
    }
    function premiumToolsSection(betsStats){
      return (
        '<div class="gl-sec">' +
          '<div class="gl-dash-head"><h2 class="gl-dash-title hm-title">More Premium Tools</h2></div>' +
          '<div class="hm-tools-row">' +
            betTrackerCard(betsStats) +
            tapeStudyCard() +
          '</div>' +
        '</div>'
      );
    }

    function wire(){
      container.querySelectorAll('[data-goto]').forEach(function(el){
        el.addEventListener('click', go(el.getAttribute('data-goto')));
      });
      // Scheduled Cards' tiles all route to the Events tab's own carousel
      // rather than deep-linking to that specific slide -- matchup.js's
      // render() doesn't currently accept a route param to preselect one
      // (it always loads the default featured card + carousel), so jumping
      // straight to a specific card would need that screen extended first.
      container.querySelectorAll('[data-slug]').forEach(function(el){
        el.addEventListener('click', function(){
          window.GL_NATIVE.tap();
          window.GL_ROUTER.go('fighter', { slug: el.getAttribute('data-slug') });
        });
      });
    }

    // Order: Main Event -> Scheduled Cards -> Betting Odds -> Biggest Movers
    // -> Scheduled Cards -> <year> Leaders -> Biggest Movers -> Active
    // Roster -> Play & Compete -> (subscribed accounts only) More Premium
    // Tools (Bet Tracker/Tape Study previews) -> (free accounts only) Go
    // Premium pitch. Leaders is free-tier content, same as everything above
    // it; the two premium/free blocks at the very end are the only
    // tier-specific branch left, and they're mutually exclusive with each
    // other -- see the file header comment for what reintroducing the old
    // premium-only Bet Tracker/Tape Study teasers traded away the first
    // time this was rebuilt (nothing now -- both are back, just reshaped
    // to fit this one-shared-layout structure).
    function render(pickemCard, pickemMine, rankingsData, matchupCard, rosterData, subscribed, taleOfTape, carousel, leadersData, betsStats){
      container.innerHTML =
        mainEventSection(matchupCard, taleOfTape) +
        oddsSection(matchupCard, subscribed) +
        scheduledCardsSection(carousel) +
        leadersSection(leadersData) +
        moversSection(rankingsData) +
        rosterSection(rosterData) +
        playCompeteSection(pickemCard, pickemMine) +
        (subscribed ? premiumToolsSection(betsStats) : '') +
        (subscribed ? '' : (
          '<div class="gl-cta" style="border-color:color-mix(in srgb, var(--accent) 40%, var(--border))">' +
            '<h3 style="margin:0 0 .3rem;color:var(--accent)">Go Premium</h3>' +
            '<p style="margin-bottom:.8rem;color:var(--muted)">Full fighter database, live odds, the simulator, and more.</p>' +
            '<button type="button" class="gl-btn gl-btn-outline" data-goto="premium">See what’s included</button>' +
          '</div>'
        ));
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
        window.GL_API.leaders().catch(function(){ return null; }),
      ]).then(function(results){
        var cardRes = results[0], rankingsData = results[1], matchupRes = results[2], rosterData = results[3], acct = results[4], leadersData = results[5];
        var card = cardRes && cardRes.card;
        var matchupCard = matchupRes && matchupRes.card;
        var taleOfTape = matchupRes && matchupRes.taleOfTape;
        var carousel = matchupRes && matchupRes.carousel;
        // /api/app/pickem-card requires a session (worker/index.js returns
        // 401 with no session), so cardRes is always null for a logged-out
        // visitor -- the public /api/app/matchup response (matchupCard,
        // fetched either way for the Main Event section above) carries the
        // same event name, which is the only field playCompeteSection's
        // pickemTileStatus actually reads for a logged-out visitor, so it
        // stands in here instead of the tile just reading "This week's card"
        // with no event context.
        if (!card && !loggedIn && matchupCard) card = { name: matchupCard.event || '', bouts: matchupCard.fights || [] };
        var subscribed = !!(acct && acct.subscribed);
        // GET /api/app/bets is subscribed-only server-side (403 otherwise --
        // see worker/index.js), so this is only ever fetched once we already
        // know this account is subscribed, same gating pickemMine below does
        // off loggedIn. Its `stats` field is exactly what Bet Tracker's own
        // history header already summarizes a bettor's record/ROI/CLV from --
        // reused as-is, no new backend work for this preview.
        var betsPromise = subscribed ? window.GL_API.bets().catch(function(){ return null; }) : Promise.resolve(null);
        if (!card || !loggedIn) {
          return betsPromise.then(function(betsRes){
            render(card, null, rankingsData, matchupCard, rosterData, subscribed, taleOfTape, carousel, leadersData, betsRes && betsRes.stats);
          });
        }
        return Promise.all([
          window.GL_API.pickemMine(card.slug).catch(function(){ return null; }),
          betsPromise,
        ]).then(function(more){
          var mine = more[0], betsRes = more[1];
          render(card, mine, rankingsData, matchupCard, rosterData, subscribed, taleOfTape, carousel, leadersData, betsRes && betsRes.stats);
        });
      });
    });
  }
});
