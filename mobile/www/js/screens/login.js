// Shared login/signup form, used wherever a screen needs to gate on auth
// (Account tab when logged out, Pick'em/Bracket screens). Not a route of
// its own -- it's a fragment other screens mount into their container.
window.GL_LOGIN_FORM = function(container, opts){
  opts = opts || {};
  var mode = 'login'; // or 'signup'

  function render(){
    container.innerHTML =
      '<div class="gl-card">' +
        '<h3 style="margin:0 0 .8rem">' + (mode==='login' ? 'Log In' : 'Create Free Account') + '</h3>' +
        '<label class="gl-label">Email</label>' +
        '<input class="gl-field" type="email" id="glAuthEmail" autocomplete="email" placeholder="you@example.com">' +
        '<label class="gl-label">Password</label>' +
        '<input class="gl-field" type="password" id="glAuthPw" autocomplete="' + (mode==='login'?'current-password':'new-password') + '" placeholder="••••••••">' +
        '<div class="gl-error" id="glAuthErr" hidden></div>' +
        '<button class="gl-btn gl-btn-primary" id="glAuthSubmit">' + (mode==='login' ? 'Log In' : 'Create Account') + '</button>' +
        '<p class="gl-muted" style="text-align:center;margin-top:.9rem">' +
          (mode==='login' ? 'New here? <a href="#" id="glAuthSwitch" style="color:var(--accent)">Create a free account</a>'
                          : 'Already have an account? <a href="#" id="glAuthSwitch" style="color:var(--accent)">Log in</a>') +
        '</p>' +
      '</div>';

    container.querySelector('#glAuthSwitch').addEventListener('click', function(e){
      e.preventDefault();
      mode = mode === 'login' ? 'signup' : 'login';
      render();
    });

    container.querySelector('#glAuthSubmit').addEventListener('click', function(){
      window.GL_NATIVE.tap();
      var email = container.querySelector('#glAuthEmail').value.trim();
      var pw = container.querySelector('#glAuthPw').value;
      var errEl = container.querySelector('#glAuthErr');
      errEl.hidden = true;
      if (!email || !pw){
        errEl.textContent = 'Enter an email and password.'; errEl.hidden = false; return;
      }
      var action = mode === 'login' ? window.GL_AUTH.login : window.GL_AUTH.signup;
      action(email, pw).then(function(){
        if (opts.onSuccess) opts.onSuccess();
      }).catch(function(err){
        errEl.textContent = (err && err.data && err.data.error) || 'Something went wrong. Try again.';
        errEl.hidden = false;
      });
    });
  }

  render();
};
