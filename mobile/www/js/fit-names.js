// Keeps long fighter names on ONE line in modals / the Fight Info dropdown by
// shrinking the font-size until the name fits its box (down to MIN_SCALE of
// the normal size; CSS ellipsis is the fallback past that). Elements are
// re-fitted whenever the DOM changes (a modal opening/re-rendering) or the
// window resizes. Pure presentation -- no data or layout is changed.
(function(){
  var SEL = '.cs-hd-nm, .fp-stat-hd-name, .obh-name, .proj-name, .cs-barrow .cs-nm, .cs-method-row .cs-method-nm, .mh-hd-nm';
  var MIN_SCALE = 0.6, STEP = 0.5;
  var queued = false, obs = null;

  function fit(el){
    el.style.fontSize = '';
    if (!el.clientWidth || el.scrollWidth <= el.clientWidth + 0.5) return;
    var base = parseFloat(window.getComputedStyle(el).fontSize) || 14;
    var size = base, min = base * MIN_SCALE;
    while (el.scrollWidth > el.clientWidth + 0.5 && size > min){
      size -= STEP;
      el.style.fontSize = size + 'px';
    }
  }
  function run(){
    queued = false;
    var els = document.querySelectorAll(SEL);
    for (var i = 0; i < els.length; i++) fit(els[i]);
    if (obs) obs.takeRecords(); // our own style writes shouldn't re-trigger a pass
  }
  function schedule(){
    if (queued) return;
    queued = true;
    requestAnimationFrame(run);
  }
  function start(){
    obs = new MutationObserver(schedule);
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class', 'style'] });
    window.addEventListener('resize', schedule);
    schedule();
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
