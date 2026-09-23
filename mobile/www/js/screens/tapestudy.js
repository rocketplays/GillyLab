// Tape Study -- top-level Premium hub, mirroring the site's own /tape-study
// page (index.html's #page-tape-study / renderTapeStudyPage): a 3-level
// accordion -- Event, then Fighter (both corners of every bout, in fight
// order), then that fighter's own fight-history rows with a Watch link.
// Clicking a fighter's name (not the row) opens their full profile.
//
// Distinct from the per-fighter "Tape Study" tab already inside a fighter's
// own profile (fighter.js's tapeStudyHTML) -- this is the cross-fighter
// browse view the site's nav has as its own top-level page. It reuses that
// exact same data path, GET /api/app/fighter-extras?slug=... -> the
// server-baked `extras.tapeStudy` array (gen-app-fighter-extras.cjs's
// buildTapeStudy already ports the site's own populateTapeStudy grouping/
// filtering logic at build time), rather than shipping the client-side
// FIGHT_HISTORY/TAPE_STUDY consts index.html bakes for its own accordion --
// those only exist inside the multi-MB desktop-only index.html this app
// never loads.
//
// The event/fighter list comes from GET /api/app/matchup -- the same call
// the Events tab already makes -- via its `card` (this week's featured
// event) plus `carousel` (the announced events after it). Per-fighter tape
// history is then fetched LAZILY, one call per fighter, the first time that
// fighter's row is expanded and cached after that -- same lazy-load-on-
// first-open behavior as the site's own toggleTapeFighter, so just browsing
// the event/fighter list never pays for fetching everyone's history up
// front.
window.GL_ROUTER.register('tapestudy', {
  title: 'Tape Study',
  tab: 'tapestudy',
  render: function(container){
    window.GL_TAPESTUDY.load(container);
  }
});

window.GL_TAPESTUDY = (function(){
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]; }); }

  function lockedHTML(){
    return (
      '<div class="fp-lock">' +
        '<div class="fp-lock-h"><span class="fp-lock-ico">🔒</span><div class="fp-lock-t">Tape Study</div></div>' +
        '<div class="gl-muted" style="margin:.2rem 0 .8rem">Everything GillyLab Premium unlocks here:</div>' +
        '<div class="fp-lock-grid">' +
          '<div class="fp-lock-i"><div class="fp-lock-it">Full fight footage</div><div class="fp-lock-id">Curated video links for every fighter on the upcoming cards, opponent by opponent.</div></div>' +
          '<div class="fp-lock-i"><div class="fp-lock-it">Browse by card</div><div class="fp-lock-id">Every fighter booked on an upcoming event, both corners, in one place.</div></div>' +
        '</div>' +
        '<button type="button" class="gl-btn gl-btn-primary" data-goto="premium">Go Premium for Tape Study</button>' +
      '</div>'
    );
  }

  // Same has-photo/initials-fallback treatment as index.html's own
  // tapeAvatarHTML, keyed off the fighter's profile slug (this app has no
  // per-fight `photo1`/`photo2` field the way the site's Cito payload does --
  // /api/app/matchup instead resolves each side to a profile slug, and every
  // other screen here (matchup.js's avatar()) already renders a photo from
  // that slug via GL_FIGHTER.PHOTO_BASE, so this reuses the identical path).
  function avatarHTML(slug, name){
    var ini = window.GL_FIGHTER.initials(name);
    if (!slug) return '<div class="tape-fighter-avatar">' + esc(ini) + '</div>';
    return (
      '<div class="tape-fighter-avatar has-photo">' +
        '<img src="' + window.GL_FIGHTER.PHOTO_BASE + esc(slug) + '.png" alt="" ' +
          'onerror="this.parentNode.textContent=\'' + esc(ini) + '\'">' +
      '</div>'
    );
  }

  // One row per already-catalogued fight, same fields/order as fighter.js's
  // own tapeStudyHTML (grouped by section there; this hub's fighter-level
  // drill-down skips the section header since gen-app-fighter-extras.cjs's
  // buildTapeStudy already orders newest-first within one flat list here).
  function historyRowsHTML(list){
    if (!list || !list.length) {
      return '<div class="tape-watch-placeholder" style="display:block;padding:.5rem 0;">No footage available yet.</div>';
    }
    return '<div class="tape-history-list">' + list.map(function(t){
      var meta = [t.date, t.event].filter(Boolean).join(' · ');
      return (
        '<div class="tape-history-row">' +
          '<div class="tape-history-main">' +
            '<div class="tape-history-opponent">vs ' + esc(t.opponent || '') + '</div>' +
            (meta ? '<div class="tape-history-meta">' + esc(meta) + '</div>' : '') +
          '</div>' +
          '<div class="tape-history-watch">' +
            (t.url
              ? '<button type="button" class="tape-watch-link" data-watch="' + esc(t.url) + '">▶ Watch</button>'
              : '<span class="tape-watch-placeholder">No footage</span>') +
          '</div>' +
        '</div>'
      );
    }).join('') + '</div>';
  }

  function fighterRowHTML(fr, eventId, fIdx){
    var fighterId = eventId + '-f' + fIdx;
    return (
      '<div class="tape-fighter" id="' + fighterId + '" data-fighter-slug="' + esc(fr.slug || '') + '">' +
        '<div class="tape-fighter-header" data-tape-toggle-fighter="' + fighterId + '">' +
          avatarHTML(fr.slug, fr.name) +
          '<div style="flex:1;min-width:0;">' +
            '<div class="tape-fighter-name" data-open-fighter="' + esc(fr.slug || '') + '">' + esc(fr.name || '') + '</div>' +
            '<div class="tape-fighter-meta">' + esc([fr.div, fr.rec].filter(Boolean).join(' · ')) + '</div>' +
          '</div>' +
          '<svg class="tape-chevron" width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '</div>' +
        '<div class="tape-fighter-history"></div>' +
      '</div>'
    );
  }

  function eventCardHTML(c, evtIdx){
    var eventId = 'tape-evt-' + evtIdx;
    var fighters = [];
    // Both corners of every bout, in fight order -- same as the site's own
    // per-event fighter list (not one row per bout).
    (c.fights || []).forEach(function(f){
      fighters.push({ name: f.f1, slug: f.s1, div: f.weight, rec: f.rec1 });
      fighters.push({ name: f.f2, slug: f.s2, div: f.weight, rec: f.rec2 });
    });
    if (!fighters.length) return '';
    var dateStr = '';
    try {
      if (c.date) dateStr = new Date(c.date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) { /* leave blank */ }
    return (
      '<div class="tape-event" id="' + eventId + '">' +
        '<div class="tape-event-header" data-tape-toggle-event="' + eventId + '">' +
          '<div>' +
            '<div class="tape-event-name">' + esc(c.event || '') + '</div>' +
            '<div class="tape-event-date">' + esc(dateStr) + '</div>' +
          '</div>' +
          '<svg class="tape-chevron" width="12" height="7" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '</div>' +
        '<div class="tape-event-fighters">' + fighters.map(function(fr, i){ return fighterRowHTML(fr, eventId, i); }).join('') + '</div>' +
      '</div>'
    );
  }

  function renderHTML(cards){
    var events = cards.map(eventCardHTML).filter(Boolean).join('');
    if (!events) events = '<div class="tape-empty">No upcoming cards found.</div>';
    return (
      '<h1 class="gl-heading" style="margin:0 0 .3rem">Tape <span style="color:var(--accent)">Study</span></h1>' +
      '<p class="gl-muted" style="margin:0 0 1rem">Film on every fighter booked for an upcoming card.</p>' +
      '<div class="tape-accordion">' + events + '</div>'
    );
  }

  var extrasCache = {}; // fighter slug -> already-fetched tapeStudy array, cleared each load()

  function wire(container){
    container.querySelectorAll('[data-goto="premium"]').forEach(function(btn){
      btn.addEventListener('click', function(){ window.GL_NATIVE.tap(); window.GL_ROUTER.go('premium'); });
    });
    container.querySelectorAll('[data-tape-toggle-event]').forEach(function(hdr){
      hdr.addEventListener('click', function(){
        window.GL_NATIVE.tap();
        var el = document.getElementById(hdr.getAttribute('data-tape-toggle-event'));
        if (el) el.classList.toggle('open');
      });
    });
    container.querySelectorAll('[data-tape-toggle-fighter]').forEach(function(hdr){
      hdr.addEventListener('click', function(){
        window.GL_NATIVE.tap();
        var id = hdr.getAttribute('data-tape-toggle-fighter');
        var el = document.getElementById(id);
        if (!el) return;
        var wasOpen = el.classList.contains('open');
        el.classList.toggle('open');
        if (wasOpen) return;
        var body = el.querySelector('.tape-fighter-history');
        if (!body || body.dataset.loaded) return;
        var slug = el.getAttribute('data-fighter-slug');
        if (!slug) {
          body.innerHTML = '<div class="tape-watch-placeholder" style="display:block;padding:.5rem 0;">No fight history on file yet.</div>';
          body.dataset.loaded = '1';
          return;
        }
        body.innerHTML = '<div class="gl-muted" style="padding:.5rem 0;font-size:.8rem;">Loading…</div>';
        var pending = extrasCache[slug] || window.GL_API.fighterExtras(slug).then(function(res){
          return (res && res.tapeStudy) || [];
        }).catch(function(){ return []; });
        extrasCache[slug] = pending;
        pending.then(function(list){
          if (!container.isConnected) return;
          body.innerHTML = historyRowsHTML(list);
          body.dataset.loaded = '1';
          body.querySelectorAll('[data-watch]').forEach(function(btn){
            btn.addEventListener('click', function(){
              window.GL_NATIVE.tap();
              window.GL_NATIVE.openExternal(btn.getAttribute('data-watch'));
            });
          });
        });
      });
    });
    container.querySelectorAll('[data-open-fighter]').forEach(function(el){
      el.addEventListener('click', function(e){
        e.stopPropagation();
        var slug = el.getAttribute('data-open-fighter');
        if (!slug) return;
        window.GL_NATIVE.tap();
        window.GL_ROUTER.go('fighter', { slug: slug });
      });
    });
  }

  var loadSeq = 0;
  function load(container){
    var mySeq = ++loadSeq;
    extrasCache = {};
    container.innerHTML = '<p class="gl-muted">Loading…</p>';
    window.GL_API.account().catch(function(){ return null; }).then(function(acct){
      if (mySeq !== loadSeq) return;
      var subscribed = !!(acct && acct.subscribed);
      if (!subscribed) {
        container.innerHTML = lockedHTML();
        wire(container);
        return;
      }
      window.GL_API.matchup().then(function(res){
        if (mySeq !== loadSeq) return;
        var cards = [];
        if (res && res.card) cards.push(res.card);
        if (res && Array.isArray(res.carousel)) cards = cards.concat(res.carousel);
        container.innerHTML = renderHTML(cards);
        wire(container);
      }).catch(function(){
        if (mySeq !== loadSeq) return;
        container.innerHTML = '<p class="gl-error">Couldn’t load Tape Study — check your connection and try again.</p>';
      });
    });
  }

  return { load: load };
})();
