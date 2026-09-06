// Minimal hash-based client-side router. The whole point of building the
// app's screens as a real SPA (per the architecture decision) is that
// switching screens never does a full page load -- no browser-style white
// flash, no lost scroll-position jank. Route changes just swap the content
// of #app and update the tab bar / top bar to match.
window.GL_ROUTER = (function(){
  var screens = {};       // routeName -> { title, render(container, params), tab }
  var current = null;
  var appEl, topbarTitleEl, backBtn, tabbarEl;

  function register(name, screen){ screens[name] = screen; }

  function setActiveTab(name){
    var tabs = tabbarEl.querySelectorAll('.gl-tab');
    for (var i=0;i<tabs.length;i++){
      tabs[i].classList.toggle('active', tabs[i].getAttribute('data-route') === name);
    }
  }

  function go(name, params){
    var screen = screens[name];
    if (!screen){ console.error('GL_ROUTER: unknown route', name); return; }
    current = name;
    location.hash = '#/' + name;
    topbarTitleEl.textContent = screen.title || 'GillyLab';
    backBtn.hidden = !screen.showBack;
    setActiveTab(screen.tab || name);
    appEl.innerHTML = '';
    appEl.scrollTop = 0;
    screen.render(appEl, params || {});
  }

  function fromHash(){
    var name = (location.hash || '#/home').replace(/^#\//, '') || 'home';
    var base = name.split('/')[0];
    if (!screens[base]) base = 'home';
    go(base);
  }

  function init(){
    appEl = document.getElementById('app');
    topbarTitleEl = document.getElementById('topbarTitle');
    backBtn = document.getElementById('backBtn');
    tabbarEl = document.getElementById('tabbar');

    tabbarEl.querySelectorAll('.gl-tab').forEach(function(btn){
      btn.addEventListener('click', function(){
        window.GL_NATIVE.tap();
        go(btn.getAttribute('data-route'));
      });
    });
    backBtn.addEventListener('click', function(){
      window.GL_NATIVE.tap();
      go('home');
    });
    window.addEventListener('hashchange', fromHash);
    fromHash();
  }

  return { register: register, go: go, init: init };
})();
