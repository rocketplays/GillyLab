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

  // Full 8-item list shown to logged-out/free users, with a "Go Premium" CTA.
  // Accolades and Tape Study are pulled out of this list (and rendered for
  // real instead) once a subscribed user's extras have loaded -- see
  // comingSoonHTML() for what's shown to premium users in their place.
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

  // Shown to already-subscribed users for the tools that aren't built into
  // the app yet -- same items, minus whichever this screen already delivers
  // for real, and no "Go Premium" button since they already are.
  function comingSoonHTML(builtLabels){
    var remaining = ALL_LOCKED_ITEMS.filter(function(it){ return builtLabels.indexOf(it[0]) === -1; });
    if (!remaining.length) return '';
    return (
      '<div class="fp-lock fp-lock--done">' +
        '<div class="fp-lock-h"><span class="fp-lock-ico">🛠️</span><div class="fp-lock-t">More tools on the way</div></div>' +
        '<div class="gl-muted" style="margin:.2rem 0 .8rem">Still coming to the app (already on the website):</div>' +
        '<div class="fp-lock-grid">' + lockGridHTML(remaining) + '</div>' +
      '</div>'
    );
  }

  // Unlike Accolades/Tape Study (rendered inline from fetched data) or the
  // remaining locked items (a plain, non-interactive grid), the Simulator is
  // a real built feature that lives on its OWN route -- see
  // screens/simulator.js -- so it gets its own small CTA card with a real
  // button instead of a comingSoonHTML tile.
  function simulatorCtaHTML(name){
    return (
      '<div class="fp-lock fp-lock--done">' +
        '<div class="fp-lock-h"><span class="fp-lock-ico">🥊</span><div class="fp-lock-t">Fight Simulator</div></div>' +
        '<p class="gl-muted" style="margin:.2rem 0 .8rem">See how ' + esc(name) + ' projects against anyone on the roster.</p>' +
        '<button type="button" class="gl-btn gl-btn-primary" data-goto="simulator" data-sim-name="' + esc(name) + '">Run the Simulator</button>' +
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

  // The Accolades/Tape Study switcher only appears once a subscribed user's
  // extras have loaded and at least one of the two has content -- a fighter
  // with just one of them skips the tab bar entirely and shows that one
  // section under its own heading instead of a pointless single-tab switcher.
  function extrasHTML(extras){
    var hasAcc = extras && extras.accolades && extras.accolades.length;
    var hasTape = extras && extras.tapeStudy && extras.tapeStudy.length;
    if (!hasAcc && !hasTape) return '';
    if (hasAcc && hasTape){
      return (
        '<div class="fp-extras">' +
          '<div class="fp-tabs">' +
            '<button type="button" class="fp-tab sel" data-fptab="acc">Accolades</button>' +
            '<button type="button" class="fp-tab" data-fptab="tape">Tape Study</button>' +
          '</div>' +
          '<div class="fp-tabpanel" data-fppanel="acc">' + accoladesHTML(extras.accolades) + '</div>' +
          '<div class="fp-tabpanel" data-fppanel="tape" hidden>' + tapeStudyHTML(extras.tapeStudy) + '</div>' +
        '</div>'
      );
    }
    var only = hasAcc
      ? { label: 'Accolades', body: accoladesHTML(extras.accolades) }
      : { label: 'Tape Study', body: tapeStudyHTML(extras.tapeStudy) };
    return (
      '<div class="fp-extras">' +
        '<div class="rk-panel-title">' + only.label + '</div>' +
        only.body +
      '</div>'
    );
  }

  function wireExtras(container){
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
  }

  // Free-flowing, like the website's own /fighter/<slug> page (.fp-head,
  // .fsx-bio, .fsx-group) -- avatar/name header and stat bars are plain
  // content with thin divider lines, not boxed cards. Only the Premium
  // lock/coming-soon block at the end is ever boxed on the site.
  //
  // `subscribed` picks the tail: false gets the full 8-item locked list with
  // a "Go Premium" CTA; true gets real Accolades/Tape Study content (`extras`,
  // possibly with empty arrays for this particular fighter, or null if that
  // fetch itself failed -- either way treated as "nothing to show yet", NOT
  // as "not premium") plus a shorter "more on the way" list for whatever this
  // screen doesn't build yet. Keeping this a separate flag from `extras`
  // matters: a subscribed viewer whose extras fetch hiccups on a bad
  // connection must never see the "Go Premium" upsell they've already paid
  // for -- see load()'s comment on why account() and fighterExtras() are
  // fetched/caught separately.
  function renderHTML(f, subscribed, extras){
    f = f || {};
    var rankLabel = f.rank && f.rank !== 'NR' ? (/C/.test(f.rank) ? 'Champion' : f.rank) : '';
    var metaBits = [f.record, f.division, f.country].filter(Boolean).join(' · ');
    var tail = subscribed
      ? (extrasHTML(extras || {}) + simulatorCtaHTML(f.name) + comingSoonHTML(['Accolades', 'Tape study', 'Fight simulator']))
      : lockedHTML();
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
        var goSim = container.querySelector('[data-goto="simulator"]');
        if (goSim) goSim.addEventListener('click', function(){
          window.GL_NATIVE.tap();
          window.GL_ROUTER.go('simulator', { name: goSim.getAttribute('data-sim-name') });
        });
        if (subscribed) wireExtras(container);
      });
    }).catch(function(){
      if (mySeq !== loadSeq) return;
      container.innerHTML = '<p class="gl-error">Couldn’t load this fighter’s profile — check your connection and try again.</p>';
    });
  }

  return { load: load, renderHTML: renderHTML, avatarHtml: avatarHtml, initials: initials, esc: esc, PHOTO_BASE: PHOTO_BASE };
})();
