window.GL_ROUTER.register('home', {
  title: 'GillyLab',
  tab: 'home',
  render: function(container){
    container.innerHTML =
      '<div class="gl-card">' +
        '<h2 class="gl-heading" style="margin:0 0 .3rem;font-size:1.15rem">Welcome to GillyLab</h2>' +
        '<p>Everything below is free to browse, logged out. Create a free account only when you want to play Pick’em or the Legends Bracket.</p>' +
      '</div>' +
      tile('climb', 'The Climb', 'Fictional-fighter career sim. Play free, no account needed.') +
      tile('rankings', 'Rankings', 'Media panel + AI rankings, updated weekly.') +
      tile('pickem', '‘Pick’em', 'Weekly card predictions. Free account required to play.') +
      '<div class="gl-card" style="border-color:color-mix(in srgb, var(--accent) 40%, var(--border))">' +
        '<h3 style="margin:0 0 .3rem;color:var(--accent)">Go Premium</h3>' +
        '<p style="margin-bottom:.8rem">Full fighter database, live odds, the simulator, and more.</p>' +
        '<button class="gl-btn gl-btn-outline" id="homePremiumBtn">See what’s included</button>' +
      '</div>';

    container.querySelectorAll('[data-goto]').forEach(function(el){
      el.addEventListener('click', function(){ window.GL_NATIVE.tap(); window.GL_ROUTER.go(el.getAttribute('data-goto')); });
    });
    container.querySelector('#homePremiumBtn').addEventListener('click', function(){
      window.GL_NATIVE.tap(); window.GL_ROUTER.go('premium');
    });
  }
});

function tile(route, title, desc){
  return '<div class="gl-card" data-goto="' + route + '" style="cursor:pointer">' +
    '<h3 style="margin:0 0 .2rem">' + title + '</h3>' +
    '<p>' + desc + '</p>' +
  '</div>';
}
