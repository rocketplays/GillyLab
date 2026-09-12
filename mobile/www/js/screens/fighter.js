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

  // Full 8-item marketing list shown to logged-out/free users, with a "Go
  // Premium" CTA. A subscribed user never sees this -- they get the real
  // tabbed content instead (fightHistoryHTML/tapeStudyHTML/oddsHistoryHTML/
  // accoladesHTML/newsHTML via tabsHTML()); the Fight Simulator entry here
  // stays purely descriptive copy since that tool lives in the premium
  // "More" tab-bar sheet, not on this profile.
  var ALL_LOCKED_ITEMS = [
    ['Fight simulator', 'Run this fighter against anyone on the roster.'],
    ['Full fight history', 'Every pro bout — result, method, round &amp; opponent.'],
    ['Box scores', 'Full detailed statistics for every UFC bout in history, head-to-head.'],
    ['Tape study', 'Links to full video of each of their previous fights.'],
    ['Closing-line history', 'Their closing line for each fight — favorite or underdog.'],
    ['Accolades', 'Belt ranks, titles, finishes, bonuses &amp; records.'],
    ['Scouting report', 'Style, pace, tendencies and the path to beating them.'],
    ['Live odds &amp; props', 'Moneyline, round totals &amp; method props by book.'],
  ];

  function lockGridHTML(items){
    return items.map(function(it){
      return '<div class="fp-lock-i"><div class="fp-lock-it">' + it[0] + '</div><div class="fp-lock-id">' + it[1] + '</div></div>';
    }).join('');
  }

  function lockedHTML(){
    return (
      '<div class="fp-lock">' +
        '<div class="fp-lock-h"><span class="fp-lock-ico">🔒</span><div class="fp-lock-t">The full profile &amp; tools</div></div>' +
        '<div class="gl-muted" style="margin:.2rem 0 .8rem">Everything GillyLab Premium unlocks:</div>' +
        '<div class="fp-lock-grid">' + lockGridHTML(ALL_LOCKED_ITEMS) + '</div>' +
        '<button type="button" class="gl-btn gl-btn-primary" data-goto="premium">Go Premium for the full profile &amp; tools</button>' +
      '</div>'
    );
  }

  function accoladesHTML(list){
    if (!list || !list.length) return '<p class="gl-muted" style="margin:.4rem 0 0">No accolades recorded yet.</p>';
    return '<div class="fp-acc-list">' + list.map(function(a){
      return (
        '<div class="fp-acc-row">' +
          '<span class="fp-acc-icon">' + esc(a.icon || '🏆') + '</span>' +
          '<div>' +
            '<div class="fp-acc-title">' + esc(a.title || '') + '</div>' +
            (a.detail ? '<div class="fp-acc-detail">' + esc(a.detail) + '</div>' : '') +
          '</div>' +
        '</div>'
      );
    }).join('') + '</div>';
  }

  // Grouped by `section` (already ordered/grouped server-side, matching the
  // website's own populateTapeStudy) -- a header row whenever the section
  // changes, then one row per fight. Watch links open externally (Paramount+/
  // YouTube) rather than navigating the app's own WebView away from itself.
  function tapeStudyHTML(list){
    if (!list || !list.length) return '<p class="gl-muted" style="margin:.4rem 0 0">No tape study links yet.</p>';
    var html = '';
    var lastSection;
    list.forEach(function(t){
      if (t.section !== lastSection){
        html += '<div class="fp-tape-sec">' + esc(t.section || 'Fights') + '</div>';
        lastSection = t.section;
      }
      var meta = [t.date, t.event].filter(Boolean).join(' · ');
      html += (
        '<div class="fp-tape-row">' +
          '<div>' +
            '<div class="fp-tape-opp">vs ' + esc(t.opponent || '') + '</div>' +
            (meta ? '<div class="fp-tape-meta">' + esc(meta) + '</div>' : '') +
          '</div>' +
          (t.url
            ? '<button type="button" class="fp-tape-watch" data-watch="' + esc(t.url) + '">Watch</button>'
            : '<span class="fp-tape-none">No footage</span>') +
        '</div>'
      );
    });
    return '<div class="fp-tape-list">' + html + '</div>';
  }

  // Result-colored text, same green-W/red-L/dim-else convention the site
  // uses across Fight History and Odds History.
  function resultClass(r){ return r === 'W' ? 'good' : (r === 'L' ? 'bad' : ''); }

  // ── Regional promotion strength -- same tier/color convention matchup.js's
  // own PROMO_TIER_COLORS uses for the Fight Info breakdown, duplicated here
  // rather than shared (this app's per-screen-self-contained convention).
  // The actual tier LOOKUP (index.html's ~90-org PROMOTION_TIERS table)
  // isn't ported client-side at all -- gen-app-fighter-extras.cjs already
  // resolved each fight-history row's `orgTier`/the Record Breakdown's
  // per-org `tier` to a plain {tier,label} at build time, so these two
  // renderers just need the color mapping, not the table itself.
  var PROMO_TIER_COLORS = { 1: '#00e668', 2: '#3ecbff', 3: 'var(--accent)', 4: '#ffb020', 5: '#ff5c5c' };
  // Bordered pill -- same treatment as the site's promotionTierBadgeHTML(),
  // used next to the Event column in Fight History.
  function promoTierBadgeHTML(tier){
    if (!tier) return '';
    var c = PROMO_TIER_COLORS[tier.tier] || PROMO_TIER_COLORS[5];
    return '<span class="fp-tier-badge" style="border-color:' + c + ';color:' + c + '">' + esc(tier.label) + '</span>';
  }
  // Plain color-coded text, no border -- same treatment as the site's
  // promotionTierTextHTML(), used in Record Breakdown's Fights By
  // Organization list (a wrapping grid, where a bordered pill on every row
  // read as too heavy, per that function's own comment in index.html).
  function promoTierTextHTML(tier){
    if (!tier) return '';
    var c = PROMO_TIER_COLORS[tier.tier] || PROMO_TIER_COLORS[5];
    return '<span class="fp-tier-text" style="color:' + c + '">' + esc(tier.label) + '</span>';
  }

  // ── Record Breakdown -- ported from populateRecordBreakdown() in
  // index.html: Wins/Losses By Method, Other Results (draws/no-contests,
  // only when either is nonzero, same as the site), and Fights By
  // Organization with each org's regional promotion strength called out.
  // All the actual counting/sorting already happened at build time
  // (gen-app-fighter-extras.cjs's buildRecordBreakdown) -- this is pure
  // display over that precomputed shape.
  function rbStatRow(label, value){
    return '<div class="fp-rb-stat"><span class="fp-rb-lbl">' + esc(label) + '</span><span class="fp-rb-val">' + value + '</span></div>';
  }
  function rbOrgRow(o){
    return (
      '<div class="fp-rb-stat">' +
        '<span class="fp-rb-lbl fp-rb-org-lbl">' + esc(o.org) + promoTierTextHTML(o.tier) + '</span>' +
        '<span class="fp-rb-val">' + o.count + '</span>' +
      '</div>'
    );
  }
  function recordBreakdownHTML(rb){
    if (!rb) return '';
    var w = rb.winsByMethod || {}, l = rb.lossesByMethod || {};
    var other = (rb.draws || rb.noContests)
      ? '<div class="fp-rb-section"><div class="fp-rb-title">Other Results</div>' +
          (rb.draws ? rbStatRow('Draws', rb.draws) : '') +
          (rb.noContests ? rbStatRow('No Contests', rb.noContests) : '') +
        '</div>'
      : '';
    var orgs = (rb.orgs || []).map(rbOrgRow).join('') || rbStatRow('No data', 0);
    return (
      '<div class="fp-rb-grid">' +
        '<div class="fp-rb-section"><div class="fp-rb-title">Wins By Method</div>' +
          rbStatRow('KO/TKO', w.koTko || 0) + rbStatRow('Submission', w.sub || 0) + rbStatRow('Decision', w.dec || 0) +
          (w.dq ? rbStatRow('Disqualification', w.dq) : '') +
        '</div>' +
        '<div class="fp-rb-section"><div class="fp-rb-title">Losses By Method</div>' +
          rbStatRow('KO/TKO', l.koTko || 0) + rbStatRow('Submission', l.sub || 0) + rbStatRow('Decision', l.dec || 0) +
          (l.dq ? rbStatRow('Disqualification', l.dq) : '') +
        '</div>' +
        other +
        '<div class="fp-rb-section"><div class="fp-rb-title">Fights By Organization</div>' + orgs + '</div>' +
      '</div>'
    );
  }
  // Toggle + panel, right under the record line -- same placement as the
  // site's own Record Breakdown (next to the W-L-D numbers, above the tab
  // content), and the same measured-max-height slide-open animation
  // matchup.js's Fight Info toggle uses (see wireRecordBreakdown below for
  // why: a WKWebView doesn't reliably collapse a 0fr grid row to true zero).
  function recordBreakdownBlockHTML(rb){
    if (!rb) return '';
    return (
      '<div style="margin-top:.5rem">' +
        '<button type="button" class="fp-record-toggle" data-rb-toggle="1">Record Breakdown ⌄</button>' +
        '<div class="fp-record-panel" id="fpRecordPanel"><div class="fp-record-panel-inner">' + recordBreakdownHTML(rb) + '</div></div>' +
      '</div>'
    );
  }

  // Ported from index.html's static #fh-table/#fh-stats-hint markup and
  // populateFightHistory() -- a real 5-column table (Date/Opponent/Result/
  // Method/Event, Round+Time folded into a second line under Method, same
  // reason the site folded them in: a 7-column table pushed everything past
  // Result off-screen on mobile), not a card-per-fight list. The gold
  // "Rows with a Stats tag are clickable" hint banner only appears when at
  // least one row actually has one, same as the site's `_anyStats` flag. A
  // row with an embedded `stats` object (attached server-side by
  // /api/app/fighter-extras -- see worker/index.js) gets a "Stats" chip
  // above its date and is clickable straight to openStatsModal(); everything
  // else is a plain row, same as a non-UFC bout with no ESPN box score on
  // the site.
  var STATS_ICON_SVG = '<svg width="9" height="9" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><rect x="0" y="6" width="3" height="6" rx="0.5"/><rect x="4.5" y="3" width="3" height="9" rx="0.5"/><rect x="9" y="0" width="3" height="12" rx="0.5"/></svg>';
  function fightHistoryHTML(list){
    if (!list || !list.length) return '<p class="gl-muted" style="margin:.4rem 0 0">No fight history yet.</p>';
    var anyStats = list.some(function(f){ return !!f.stats; });
    var hint = anyStats
      ? ('<div class="fp-hist-hint">' + STATS_ICON_SVG +
          '<span>Rows with a <b>Stats</b> tag are clickable — open the full fight stat breakdown (strikes, takedowns, control &amp; more).</span>' +
        '</div>')
      : '';
    // Clickable opponent name -- ported from the site's own .fh-opponent
    // (index.html's document-level click delegate, ~132220): tapping the
    // name navigates to THAT fighter's profile, separate from the row's own
    // click (which opens the box score) -- see wireExtras, which checks
    // e.target.closest('.fp-hist-opp-link') the same way the site's row
    // handler checks e.target.closest('.fh-opponent') before calling
    // openFightStats. oppSlug is resolved server-side (profileSlugFor
    // against fighter-lite) -- an opponent with no resolvable profile just
    // renders as plain text, same as the site's own dead-end case.
    function oppNameHTML(f){
      return f.oppSlug
        ? '<span class="fp-hist-opp-link" data-opp-slug="' + esc(f.oppSlug) + '">' + esc(f.opponent || '') + '</span>'
        : esc(f.opponent || '');
    }
    var rows = list.map(function(f, i){
      // Upcoming placeholder row -- attached server-side (worker/index.js's
      // /api/app/fighter-extras) when this fighter has a live, not-yet-decided
      // bout booked. Mirrors the site's own populateFightHistory __upcoming
      // branch: pill-styled "Upcoming" badge in the Result column, a dash for
      // Method, never clickable (no box score exists yet).
      if (f.__upcoming) {
        return (
          '<tr class="fp-hist-row">' +
            '<td class="fp-hist-td fp-hist-date">' + esc(f.date || 'TBD') + '</td>' +
            '<td class="fp-hist-td fp-hist-opp">' + oppNameHTML(f) + '</td>' +
            '<td class="fp-hist-td" style="text-align:center"><span class="fp-hist-upcoming">Upcoming</span></td>' +
            '<td class="fp-hist-td fp-hist-method" style="color:var(--muted)">—</td>' +
            '<td class="fp-hist-td fp-hist-event">' + esc(f.event || '') + '</td>' +
          '</tr>'
        );
      }
      var subLine = [f.round ? 'R' + f.round : '', f.time || ''].filter(Boolean).join(' · ');
      var clickable = !!f.stats;
      return (
        '<tr class="fp-hist-row' + (clickable ? ' fp-hist-row--click' : '') + '"' +
          (clickable ? ' data-hist-i="' + i + '" role="button" tabindex="0"' : '') + '>' +
          '<td class="fp-hist-td fp-hist-date">' +
            (clickable ? '<div class="fp-hist-chip">' + STATS_ICON_SVG + 'Stats</div>' : '') +
            esc(f.date || '') +
          '</td>' +
          '<td class="fp-hist-td fp-hist-opp">' + oppNameHTML(f) + '</td>' +
          '<td class="fp-hist-td fp-hist-result ' + resultClass(f.result) + '">' + esc(f.result || '—') + '</td>' +
          '<td class="fp-hist-td fp-hist-method">' + esc(f.method || '') +
            (subLine ? '<div class="fp-hist-sub">' + esc(subLine) + '</div>' : '') +
          '</td>' +
          '<td class="fp-hist-td fp-hist-event">' + esc(f.event || '') + promoTierBadgeHTML(f.orgTier) + '</td>' +
        '</tr>'
      );
    }).join('');
    return (
      hint +
      '<div class="fp-hist-wrap"><table class="fp-hist-table">' +
        '<thead><tr>' +
          '<th>Date</th><th>Opponent</th><th style="text-align:center">Result</th><th>Method</th><th>Event</th>' +
        '</tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table></div>'
    );
  }

  // Ported from populateOddsHistory() in index.html -- date/result are
  // already cross-referenced from Fight History server-side (see
  // gen-app-fighter-extras.cjs's buildOddsHistory), so this is pure display.
  function oddsHistoryHTML(list){
    if (!list || !list.length) return '<p class="gl-muted" style="margin:.4rem 0 0">No odds history yet.</p>';
    return '<div class="fp-odds-list">' + list.map(function(h){
      var isNum = typeof h.odds === 'number';
      var fav = isNum && h.odds < 0;
      var oddsDisplay = isNum ? (h.odds > 0 ? '+' + h.odds : String(h.odds)) : '—';
      return (
        '<div class="fp-odds-row">' +
          '<div class="fp-odds-left">' +
            '<div class="fp-odds-top">' +
              '<span class="fp-odds-opp">vs ' + esc(h.opponent || '') + '</span>' +
              '<span class="fp-odds-result ' + resultClass(h.result) + '">' + esc(h.result || '—') + '</span>' +
            '</div>' +
            (h.date ? '<div class="fp-odds-meta">' + esc(h.date) + '</div>' : '') +
          '</div>' +
          '<div class="fp-odds-price ' + (fav ? 'good' : 'warn') + '">' + esc(oddsDisplay) + '</div>' +
        '</div>'
      );
    }).join('') + '</div>';
  }

  // Ported from populateFighterNews() in index.html -- each item is a whole
  // tappable row opening the article externally (rather than navigating the
  // app's own WebView away from itself), same reasoning as Tape Study's
  // Watch buttons. An item with no url falls back to the site's own Google
  // News search URL rather than being non-interactive.
  function newsHTML(news){
    var items = news && news.items;
    if (!items || !items.length) return '<p class="gl-muted" style="margin:.4rem 0 0">No recent news.</p>';
    return '<div class="fp-news-list">' + items.map(function(it){
      var meta = [it.source, it.date].filter(Boolean).join(' · ');
      var url = it.url || ('https://news.google.com/search?q=' + encodeURIComponent('"' + (it.title || '') + '"'));
      return (
        '<button type="button" class="fp-news-row" data-watch="' + esc(url) + '">' +
          (it.injury ? '<span class="fp-news-flag">⚠ Injury/Card news</span>' : '') +
          (meta ? '<div class="fp-news-meta">' + esc(meta) + '</div>' : '') +
          '<div class="fp-news-title">' + esc(it.title || '') + '</div>' +
        '</button>'
      );
    }).join('') + '</div>';
  }

  // The full site order is Fight History / Tape Study / Odds History /
  // Accolades / News (index.html's openFighter()) -- only tabs with actual
  // content for this fighter appear, same "no tab" vs. "empty tab" rule
  // gen-app-fighter-extras.cjs's build-time omission already follows. A
  // fighter with just one non-empty section skips the tab switcher entirely
  // (a pointless single-tab bar) and shows that section under its own
  // heading instead.
  function tabsHTML(extras){
    var tabs = [];
    if (extras.fightHistory && extras.fightHistory.length) tabs.push({ key: 'history', label: 'Fight History', body: fightHistoryHTML(extras.fightHistory) });
    if (extras.tapeStudy && extras.tapeStudy.length) tabs.push({ key: 'tape', label: 'Tape Study', body: tapeStudyHTML(extras.tapeStudy) });
    if (extras.oddsHistory && extras.oddsHistory.length) tabs.push({ key: 'odds', label: 'Odds History', body: oddsHistoryHTML(extras.oddsHistory) });
    if (extras.accolades && extras.accolades.length) tabs.push({ key: 'accolades', label: 'Accolades', body: accoladesHTML(extras.accolades) });
    if (extras.news && extras.news.items && extras.news.items.length) tabs.push({ key: 'news', label: 'News', body: newsHTML(extras.news) });
    if (!tabs.length) return '';
    if (tabs.length === 1){
      return '<div class="fp-extras"><div class="rk-panel-title">' + tabs[0].label + '</div>' + tabs[0].body + '</div>';
    }
    return (
      '<div class="fp-extras">' +
        '<div class="fp-tabs">' + tabs.map(function(t, i){
          return '<button type="button" class="fp-tab' + (i === 0 ? ' sel' : '') + '" data-fptab="' + t.key + '">' + esc(t.label) + '</button>';
        }).join('') + '</div>' +
        tabs.map(function(t, i){
          return '<div class="fp-tabpanel" data-fppanel="' + t.key + '"' + (i === 0 ? '' : ' hidden') + '>' + t.body + '</div>';
        }).join('') +
      '</div>'
    );
  }

  // ── box-score modal, ported from openFightStats()/_fsRow()/_fsBar() in
  // index.html -- a native modal (not the site's shared #modal-overlay/
  // #modal-box, which belongs to the site's own injected stylesheet), opened
  // straight from a clickable Fight History row (see wireExtras). Module-
  // level state (activeContainer/modalScrollY) rather than closed over a
  // single load() call, same reason matchup.js's own hub modal keeps its
  // state at the screen-module level -- this modal only ever needs to talk
  // to whichever profile is currently on screen. ──────────────────────────
  var activeContainer = null, activeFighterSlug = null, modalScrollY = 0;

  function fsPct(l, a){ return a > 0 ? Math.round(100 * l / a) : 0; }
  function fsSecs(t){ var m = String(t || '').match(/(\d+):(\d+)/); return m ? (+m[1] * 60 + +m[2]) : 0; }
  function fsBar(lv, rv){
    var tot = lv + rv;
    if (tot <= 0) return '';
    var lp = Math.max(8, Math.min(92, Math.round(100 * lv / tot)));
    if (lv === rv) lp = 50;
    return (
      '<div class="fp-stat-bar">' +
        '<div class="fp-stat-bar-l' + (lv >= rv ? ' lead' : '') + '" style="width:' + lp + '%"></div>' +
        '<div class="fp-stat-bar-r' + (rv >= lv ? ' lead' : '') + '" style="width:' + (100 - lp) + '%"></div>' +
      '</div>'
    );
  }
  function fsRow(label, lhtml, rhtml, lv, rv, bar){
    return (
      '<div class="fp-stat-row">' +
        '<div class="fp-stat-row-top">' +
          '<span class="fp-stat-v l">' + lhtml + '</span>' +
          '<span class="fp-stat-lbl">' + esc(label) + '</span>' +
          '<span class="fp-stat-v r">' + rhtml + '</span>' +
        '</div>' +
        (bar ? fsBar(lv, rv) : '') +
      '</div>'
    );
  }
  // Circular thumbnail avatar for the modal header, same 40px/accent-border
  // treatment as the site's own _fsAva() -- falls back to initials via the
  // existing onerror pattern used everywhere else in this app.
  function fsAva(slug, name){
    var ini = initials(name);
    return slug
      ? '<span class="fp-stat-ava"><img src="' + PHOTO_BASE + esc(slug) + '.png" alt="" onerror="this.parentNode.textContent=\'' + esc(ini) + '\'"></span>'
      : '<span class="fp-stat-ava">' + esc(ini) + '</span>';
  }
  function statsModalBodyHTML(fighterName, fighterSlug, row){
    var f = row.stats.f, o = row.stats.o;
    function sig(s){ return s.sigL + '/' + s.sigA + ' <span class="fp-stat-pct">(' + fsPct(s.sigL, s.sigA) + '%)</span>'; }
    var mfull = String(row.method || '').trim();
    var resultLine = '';
    if (row.result === 'W' || row.result === 'L'){
      var winner = row.result === 'W' ? fighterName : row.opponent;
      resultLine = winner + ' by ' + (mfull || 'decision') + (row.round ? ' R' + row.round : '') + (row.time ? ' - ' + row.time : '');
    } else if (row.result === 'D'){
      resultLine = 'Draw' + (row.round ? ' R' + row.round : '') + (row.time ? ' - ' + row.time : '');
    } else if (row.result === 'NC'){
      resultLine = 'No Contest';
    }
    return (
      '<div class="fp-stat-hd">' +
        '<span class="fp-stat-hd-side">' + fsAva(fighterSlug, fighterName) + '<span class="fp-stat-hd-name">' + esc(fighterName) + '</span></span>' +
        '<span class="fp-stat-hd-side r"><span class="fp-stat-hd-name r">' + esc(row.opponent || '') + '</span>' + fsAva(row.oppSlug, row.opponent) + '</span>' +
      '</div>' +
      '<div class="fp-stat-sub">' +
        '<span>' + esc(row.date || '') + '</span>' +
        (resultLine ? '<div class="fp-stat-result">' + esc(resultLine) + '</div>' : '') +
      '</div>' +
      fsRow('Knockdowns', f.kd, o.kd, f.kd, o.kd, (f.kd + o.kd) > 0) +
      fsRow('Sig. Strikes', sig(f), sig(o), f.sigL, o.sigL, true) +
      fsRow('Total Strikes', f.totL + '/' + f.totA, o.totL + '/' + o.totA, f.totL, o.totL, true) +
      fsRow('Takedowns', f.tdL + '/' + f.tdA, o.tdL + '/' + o.tdA, f.tdL, o.tdL, (f.tdA + o.tdA) > 0) +
      fsRow('Sub. Att', f.sub, o.sub, f.sub, o.sub, (f.sub + o.sub) > 0) +
      fsRow('Reversals', f.rev, o.rev, f.rev, o.rev, (f.rev + o.rev) > 0) +
      fsRow('Control', esc(f.ctrl || '0:00'), esc(o.ctrl || '0:00'), fsSecs(f.ctrl), fsSecs(o.ctrl), (fsSecs(f.ctrl) + fsSecs(o.ctrl)) > 0) +
      '<div class="fp-stat-subhead">Sig. strikes by target</div>' +
      fsRow('Head', f.head[0] + '/' + f.head[1], o.head[0] + '/' + o.head[1], f.head[0], o.head[0], true) +
      fsRow('Body', f.body[0] + '/' + f.body[1], o.body[0] + '/' + o.body[1], f.body[0], o.body[0], true) +
      fsRow('Leg', f.leg[0] + '/' + f.leg[1], o.leg[0] + '/' + o.leg[1], f.leg[0], o.leg[0], true) +
      '<div class="fp-stat-subhead">Sig. strikes by position</div>' +
      fsRow('Distance', f.dist[0] + '/' + f.dist[1], o.dist[0] + '/' + o.dist[1], f.dist[0], o.dist[0], true) +
      fsRow('Clinch', f.clinch[0] + '/' + f.clinch[1], o.clinch[0] + '/' + o.clinch[1], f.clinch[0], o.clinch[0], (f.clinch[1] + o.clinch[1]) > 0) +
      fsRow('Ground', f.ground[0] + '/' + f.ground[1], o.ground[0] + '/' + o.ground[1], f.ground[0], o.ground[0], (f.ground[1] + o.ground[1]) > 0)
    );
  }
  function statsModalHTML(){
    return (
      '<div id="fpStatsOverlay" class="fp-modal-overlay" hidden></div>' +
      '<div id="fpStatsBox" class="fp-modal-box" hidden role="dialog" aria-modal="true" aria-label="Fight stats">' +
        '<button type="button" class="fp-modal-close" id="fpStatsClose" aria-label="Close">&times;</button>' +
        '<div id="fpStatsBody"></div>' +
      '</div>'
    );
  }
  // Same iOS-Safari-ignores-body-overflow fix used throughout this app
  // (more-sheet.js/matchup.js) -- pin #appScroll itself, not <body>.
  function lockScroll(){
    var scroller = document.getElementById('appScroll');
    if (!scroller) return;
    modalScrollY = scroller.scrollTop || 0;
    scroller.style.overflow = 'hidden';
  }
  function unlockScroll(){
    var scroller = document.getElementById('appScroll');
    if (!scroller) return;
    scroller.style.overflow = '';
    scroller.scrollTop = modalScrollY;
  }
  function openStatsModal(fighterName, row){
    if (!activeContainer || !row || !row.stats) return;
    var overlay = activeContainer.querySelector('#fpStatsOverlay');
    var box = activeContainer.querySelector('#fpStatsBox');
    var body = activeContainer.querySelector('#fpStatsBody');
    if (!overlay || !box || !body) return;
    body.innerHTML = statsModalBodyHTML(fighterName, activeFighterSlug, row);
    overlay.hidden = false;
    box.hidden = false;
    lockScroll();
  }
  function closeStatsModal(){
    if (!activeContainer) return;
    var overlay = activeContainer.querySelector('#fpStatsOverlay');
    var box = activeContainer.querySelector('#fpStatsBox');
    if (overlay) overlay.hidden = true;
    if (box) box.hidden = true;
    unlockScroll();
  }

  // Same measured-max-height slide-open technique as matchup.js's own Fight
  // Info toggle (see its own comment on why: this app's WKWebView doesn't
  // reliably collapse a CSS grid-template-rows 0fr row to a true zero for a
  // panel with real content, which the site's simpler class-toggle approach
  // relies on).
  function wireRecordBreakdown(container){
    var btn = container.querySelector('[data-rb-toggle]');
    var panel = container.querySelector('#fpRecordPanel');
    if (!btn || !panel) return;
    btn.addEventListener('click', function(){
      window.GL_NATIVE.tap();
      var isOpen = panel.classList.contains('open');
      if (isOpen){
        panel.style.maxHeight = panel.scrollHeight + 'px';
        void panel.offsetHeight;
        panel.classList.remove('open');
        panel.style.maxHeight = '0px';
      } else {
        panel.classList.add('open');
        panel.style.maxHeight = panel.scrollHeight + 'px';
        var onEnd = function(e){
          if (e.target !== panel || e.propertyName !== 'max-height') return;
          if (panel.classList.contains('open')) panel.style.maxHeight = 'none';
          panel.removeEventListener('transitionend', onEnd);
        };
        panel.addEventListener('transitionend', onEnd);
      }
      btn.textContent = 'Record Breakdown ' + (isOpen ? '⌄' : '⌃');
      btn.classList.toggle('open', !isOpen);
    });
  }

  function wireExtras(container, fighterName, extras){
    wireRecordBreakdown(container);
    var tabs = container.querySelectorAll('[data-fptab]');
    tabs.forEach(function(btn){
      btn.addEventListener('click', function(){
        window.GL_NATIVE.tap();
        var which = btn.getAttribute('data-fptab');
        tabs.forEach(function(b){ b.classList.toggle('sel', b === btn); });
        container.querySelectorAll('[data-fppanel]').forEach(function(p){
          p.hidden = p.getAttribute('data-fppanel') !== which;
        });
      });
    });
    container.querySelectorAll('[data-watch]').forEach(function(btn){
      btn.addEventListener('click', function(){
        window.GL_NATIVE.tap();
        window.GL_NATIVE.openExternal(btn.getAttribute('data-watch'));
      });
    });
    var fightHistory = (extras && extras.fightHistory) || [];
    container.querySelectorAll('[data-hist-i]').forEach(function(row){
      row.addEventListener('click', function(e){
        // A tap on the opponent's own name navigates to their profile
        // instead (wired separately below) -- same as the site's row
        // handler skipping .fh-opponent before calling openFightStats.
        if (e.target && e.target.closest && e.target.closest('.fp-hist-opp-link')) return;
        window.GL_NATIVE.tap();
        var f = fightHistory[+row.getAttribute('data-hist-i')];
        if (f) openStatsModal(fighterName, f);
      });
    });
    container.querySelectorAll('.fp-hist-opp-link[data-opp-slug]').forEach(function(link){
      link.addEventListener('click', function(e){
        e.stopPropagation();
        window.GL_NATIVE.tap();
        window.GL_ROUTER.go('fighter', { slug: link.getAttribute('data-opp-slug') });
      });
    });
    var overlay = container.querySelector('#fpStatsOverlay');
    var closeBtn = container.querySelector('#fpStatsClose');
    if (overlay) overlay.addEventListener('click', function(){ window.GL_NATIVE.tap(); closeStatsModal(); });
    if (closeBtn) closeBtn.addEventListener('click', function(){ window.GL_NATIVE.tap(); closeStatsModal(); });
  }

  // Free-flowing, like the website's own /fighter/<slug> page (.fp-head,
  // .fsx-bio, .fsx-group) -- avatar/name header and stat bars are plain
  // content with thin divider lines, not boxed cards. The Premium lock
  // block for free/logged-out viewers is the only thing that's ever boxed,
  // same as the site's own paywall treatment.
  //
  // `subscribed` picks the tail: false gets the full 8-item locked list with
  // a "Go Premium" CTA; true gets the real tabbed Fight History/Tape Study/
  // Odds History/Accolades/News content (`extras`, possibly with nothing at
  // all for this particular fighter, or null if that fetch itself failed --
  // either way treated as "nothing to show yet", NOT as "not premium").
  // Keeping this a separate flag from `extras` matters: a subscribed viewer
  // whose extras fetch hiccups on a bad connection must never see the "Go
  // Premium" upsell they've already paid for -- see load()'s comment on why
  // account() and fighterExtras() are fetched/caught separately.
  function renderHTML(f, subscribed, extras){
    f = f || {};
    var rankLabel = f.rank && f.rank !== 'NR' ? (/C/.test(f.rank) ? 'Champion' : f.rank) : '';
    var metaBits = [f.record, f.division, f.country].filter(Boolean).join(' · ');
    var tail = subscribed ? (tabsHTML(extras || {}) + statsModalHTML()) : lockedHTML();
    // Same placement as the site: right under the record, above everything
    // else -- only for a subscribed viewer with actual breakdown data (the
    // toggle simply doesn't render rather than opening onto an empty panel).
    var recordBreakdown = (subscribed && extras && extras.recordBreakdown) ? recordBreakdownBlockHTML(extras.recordBreakdown) : '';
    return (
      '<div class="fp-head">' +
        avatarHtml(f) +
        '<div>' +
          (rankLabel ? '<div class="gl-label" style="margin:0 0 .1rem;color:var(--accent)">' + esc(rankLabel) + '</div>' : '') +
          '<h1 class="gl-heading" style="margin:0;font-size:1.3rem">' + esc(f.name) + '</h1>' +
          (metaBits ? '<p class="gl-muted" style="margin:.2rem 0 0">' + esc(metaBits) + '</p>' : '') +
          recordBreakdown +
        '</div>' +
      '</div>' +
      bioHTML(f.phys) +
      statsHTML(f.groups) +
      tail
    );
  }

  // GL_FIGHTER is a singleton (registered once, reused for every navigation
  // to 'fighter'), so two overlapping loads can genuinely happen -- e.g. a
  // double-tap firing GL_ROUTER.go('fighter', ...) twice in a row, or
  // tapping a second fighter before the first profile finished loading.
  // Without a sequence guard, whichever request's promise resolves LAST
  // wins, in real (network) order rather than call order -- so an older
  // request's .catch() can fire (and briefly paint the connection-error
  // message) after a newer request already started, right before that
  // newer request's own .then() overwrites it with the real profile a
  // moment later. That's the "red error flashes then goes away" bug.
  // Same fix as matchup.js's own searchSeq: only the most recent load()
  // call is allowed to touch the DOM.
  var loadSeq = 0;

  // Renders straight into `container` (loading state, then result), and wires
  // the profile's own "Go Premium" button plus (for subscribed viewers) the
  // Accolades/Tape Study tab switcher and Watch buttons. Callers own the back
  // button and list-vs-panel visibility around this -- see roster.js/matchup.js.
  //
  // account() is fetched alongside fighter() (both free/no-cost calls) purely
  // to read `subscribed` -- a logged-out call resolves to null here (caught),
  // same "not signed in = not premium" treatment as everywhere else in the
  // app. Only a subscribed viewer triggers the extra fighterExtras() call;
  // there's no point asking a free/logged-out viewer's device to hit an
  // endpoint that will just 401/403.
  function load(container, slug){
    var mySeq = ++loadSeq;
    activeContainer = container;
    activeFighterSlug = slug;
    container.innerHTML = '<p class="gl-muted">Loading fighter…</p>';
    Promise.all([
      window.GL_API.fighter(slug),
      window.GL_API.account().catch(function(){ return null; }),
    ]).then(function(results){
      if (mySeq !== loadSeq) return; // a newer profile request already won
      var fighterRes = results[0], acct = results[1];
      var subscribed = !!(acct && acct.subscribed);
      var extrasPromise = subscribed
        ? window.GL_API.fighterExtras(slug).catch(function(){ return null; })
        : Promise.resolve(null);
      return extrasPromise.then(function(extras){
        if (mySeq !== loadSeq) return;
        container.innerHTML = renderHTML(fighterRes.fighter, subscribed, extras);
        var goPrem = container.querySelector('[data-goto="premium"]');
        if (goPrem) goPrem.addEventListener('click', function(){
          window.GL_NATIVE.tap();
          window.GL_ROUTER.go('premium');
        });
        if (subscribed) wireExtras(container, fighterRes.fighter && fighterRes.fighter.name, extras || {});
      });
    }).catch(function(){
      if (mySeq !== loadSeq) return;
      container.innerHTML = '<p class="gl-error">Couldn’t load this fighter’s profile — check your connection and try again.</p>';
    });
  }

  return { load: load, renderHTML: renderHTML, avatarHtml: avatarHtml, initials: initials, esc: esc, PHOTO_BASE: PHOTO_BASE };
})();
