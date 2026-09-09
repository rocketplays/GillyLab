// Placeholder destination for the avatar menu's "Settings" item (see
// js/avatar-menu.js). Deliberately blank for now -- the user asked to leave
// this empty and fill it in later. Not a tab-bar destination (reached only
// from the avatar menu), so it gets the plain inline back arrow like Account
// and a pushed fighter profile do.
window.GL_ROUTER.register('settings', {
  title: 'Settings',
  showBack: true,
  render: function(container){
    container.innerHTML =
      '<div class="gl-card"><p class="gl-muted" style="margin:0">Settings are coming soon.</p></div>';
  }
});
