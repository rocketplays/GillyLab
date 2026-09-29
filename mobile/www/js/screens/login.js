// Shared login/signup form, used wherever a screen needs to gate on auth
// (Account tab when logged out, Pick'em/Bracket screens). Not a route of
// its own -- it's a fragment other screens mount into their container.
//
// Modes: 'login'/'signup' (the original two), plus 'forgot' (the site's own
// /forgot page, ported in place of a bare "Forgot your password?" link
// leading nowhere) and a magic-link mini-flow nested inside 'login' itself
// (magicState below) -- same shape the site's /login page uses: one primary
// email+password form, then a divider, then a second small "email me a
// link" form beneath it, not a separate screen.
window.GL_LOGIN_FORM = function(container, opts){
  opts = opts || {};
  var mode = 'login'; // 'login' | 'signup' | 'forgot'
  // Magic-link sub-state, only meaningful while mode === 'login'. 'idle' ->
  // 'sent' (email away, polling handleAppMagicPoll) -> resolved by either
  // GL_AUTH.completeWithToken (onSuccess fires, same as any other login) or
  // 'expired' after MAGIC_POLL_TIMEOUT_MS with no tap.
  var magicState = 'idle';
  var magicPollTimer = null;
  var MAGIC_POLL_INTERVAL_MS = 3000;
  var MAGIC_POLL_TIMEOUT_MS = 10 * 60 * 1000; // matches the server's 900s token TTL, plus slack

  function stopMagicPoll(){
    if (magicPollTimer){ clearTimeout(magicPollTimer); magicPollTimer = null; }
  }

  function render(){
    stopMagicPoll();
    if (mode === 'forgot'){ renderForgot(); return; }
    container.innerHTML =
      '<div class="gl-card">' +
        '<h3 style="margin:0 0 .8rem">' + (mode==='login' ? 'Log In' : 'Create Free Account') + '</h3>' +
        '<label class="gl-label">Email</label>' +
        '<input class="gl-field" type="email" id="glAuthEmail" autocomplete="email" placeholder="you@example.com">' +
        '<label class="gl-label">Password</label>' +
        '<input class="gl-field" type="password" id="glAuthPw" autocomplete="' + (mode==='login'?'current-password':'new-password') + '" placeholder="••••••••">' +
        '<div class="gl-error" id="glAuthErr" hidden></div>' +
        '<button class="gl-btn gl-btn-primary" id="glAuthSubmit">' + (mode==='login' ? 'Log In' : 'Create Account') + '</button>' +
        (mode==='login' ? '<p class="gl-muted" style="text-align:center;margin:.6rem 0 0"><a href="#" id="glAuthForgot" style="color:var(--accent)">Forgot your password?</a></p>' : '') +
        '<p class="gl-muted" style="text-align:center;margin-top:.9rem">' +
          (mode==='login' ? 'New here? <a href="#" id="glAuthSwitch" style="color:var(--accent)">Create a free account</a>'
                          : 'Already have an account? <a href="#" id="glAuthSwitch" style="color:var(--accent)">Log in</a>') +
        '</p>' +
        (mode==='login' ? magicBlockHTML() : '') +
      '</div>';

    container.querySelector('#glAuthSwitch').addEventListener('click', function(e){
      e.preventDefault();
      mode = mode === 'login' ? 'signup' : 'login';
      render();
    });
    if (mode === 'login'){
      container.querySelector('#glAuthForgot').addEventListener('click', function(e){
        e.preventDefault();
        mode = 'forgot';
        render();
      });
      wireMagicBlock();
    }

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

  // ── magic-link mini-form, same "hr + form" placement as the site's own
  // /login page (worker/pages.js's loginPage). Three states rendered
  // inline: 'idle' (email input + button), 'sent' (spinner-style copy,
  // polling in the background), 'expired' (a plain retry prompt). ----------
  function magicBlockHTML(){
    if (magicState === 'sent'){
      return (
        '<hr style="border:none;border-top:1px solid var(--border);margin:1.1rem 0">' +
        '<p class="gl-muted" style="text-align:center;margin:0;font-size:.85rem">Check your email and tap the sign-in link there — this screen will sign you in automatically.</p>' +
        '<p class="gl-muted" style="text-align:center;margin:.5rem 0 0;font-size:.8rem"><a href="#" id="glMagicCancel" style="color:var(--accent)">Use a different email</a></p>'
      );
    }
    if (magicState === 'expired'){
      return (
        '<hr style="border:none;border-top:1px solid var(--border);margin:1.1rem 0">' +
        '<p class="gl-error" style="text-align:center;margin:0 0 .6rem">That link expired without being used.</p>' +
        '<label class="gl-label">Email</label>' +
        '<input class="gl-field" type="email" id="glMagicEmail" autocomplete="email" placeholder="you@example.com">' +
        '<button type="button" class="gl-btn gl-btn-outline" id="glMagicSubmit" style="margin-top:.6rem">Email me a sign-in link</button>'
      );
    }
    return (
      '<hr style="border:none;border-top:1px solid var(--border);margin:1.1rem 0">' +
      '<p class="gl-muted" style="text-align:center;margin:0 0 .6rem;font-size:.88rem">Log in a different way — we’ll email you a one-tap link.</p>' +
      '<label class="gl-label">Email</label>' +
      '<input class="gl-field" type="email" id="glMagicEmail" autocomplete="email" placeholder="you@example.com">' +
      '<div class="gl-error" id="glMagicErr" hidden></div>' +
      '<button type="button" class="gl-btn gl-btn-outline" id="glMagicSubmit" style="margin-top:.6rem">Email me a sign-in link</button>'
    );
  }

  function wireMagicBlock(){
    var cancel = container.querySelector('#glMagicCancel');
    if (cancel) cancel.addEventListener('click', function(e){
      e.preventDefault();
      stopMagicPoll();
      magicState = 'idle';
      render();
    });
    var submit = container.querySelector('#glMagicSubmit');
    if (!submit) return;
    submit.addEventListener('click', function(){
      window.GL_NATIVE.tap();
      var emailEl = container.querySelector('#glMagicEmail');
      var email = emailEl && emailEl.value.trim();
      var errEl = container.querySelector('#glMagicErr');
      if (!email){
        if (errEl){ errEl.textContent = 'Enter your email.'; errEl.hidden = false; }
        return;
      }
      submit.disabled = true;
      window.GL_API.magicStart(email).then(function(res){
        magicState = 'sent';
        render();
        if (res && res.pollId) startMagicPoll(res.pollId);
      }).catch(function(){
        submit.disabled = false;
        if (errEl){ errEl.textContent = 'Something went wrong. Try again.'; errEl.hidden = false; }
      });
    });
  }

  // Polls handleAppMagicPoll every MAGIC_POLL_INTERVAL_MS until it comes
  // back 'done' (signs in via GL_AUTH.completeWithToken), 'expired', or this
  // form's own container is no longer on screen -- same isConnected guard
  // matchup.js's/pickem.js's own live pollers use to stop cleanly once the
  // visitor has navigated away rather than leaking a timer against a
  // detached DOM.
  function startMagicPoll(pollId){
    var deadline = Date.now() + MAGIC_POLL_TIMEOUT_MS;
    function tick(){
      if (!container.isConnected){ stopMagicPoll(); return; }
      if (Date.now() > deadline){ magicState = 'expired'; render(); return; }
      window.GL_API.magicPoll(pollId).then(function(res){
        if (!container.isConnected) return;
        if (res && res.status === 'done' && res.token){
          stopMagicPoll();
          window.GL_AUTH.completeWithToken(res.token).then(function(){
            if (opts.onSuccess) opts.onSuccess();
          });
          return;
        }
        if (res && res.status === 'expired'){ magicState = 'expired'; render(); return; }
        magicPollTimer = setTimeout(tick, MAGIC_POLL_INTERVAL_MS);
      }).catch(function(){
        if (!container.isConnected) return;
        magicPollTimer = setTimeout(tick, MAGIC_POLL_INTERVAL_MS);
      });
    }
    magicPollTimer = setTimeout(tick, MAGIC_POLL_INTERVAL_MS);
  }

  // ── forgot-password view, ported from the site's /forgot + /reset pages
  // (worker/pages.js's forgotPasswordPage/resetPasswordPage): request-only
  // here, since completing the reset needs the emailed token, which only
  // the website's own /reset?token=... page has (see api.js's resetStart
  // comment) -- so this just gets the email on its way and tells the
  // visitor to finish on that link, then come back and log in. -----------
  function renderForgot(){
    container.innerHTML =
      '<div class="gl-card">' +
        '<h3 style="margin:0 0 .3rem">Reset password</h3>' +
        '<p class="gl-muted" style="margin:0 0 .8rem;font-size:.88rem">Enter your email and we’ll send you a link to set a new password.</p>' +
        '<label class="gl-label">Email</label>' +
        '<input class="gl-field" type="email" id="glForgotEmail" autocomplete="email" placeholder="you@example.com">' +
        '<div class="gl-error" id="glForgotErr" hidden></div>' +
        '<button class="gl-btn gl-btn-primary" id="glForgotSubmit">Email me a reset link</button>' +
        '<p class="gl-muted" style="text-align:center;margin-top:.9rem"><a href="#" id="glForgotBack" style="color:var(--accent)">Back to log in</a></p>' +
      '</div>';

    container.querySelector('#glForgotBack').addEventListener('click', function(e){
      e.preventDefault();
      mode = 'login';
      render();
    });
    var submit = container.querySelector('#glForgotSubmit');
    submit.addEventListener('click', function(){
      window.GL_NATIVE.tap();
      var emailEl = container.querySelector('#glForgotEmail');
      var email = emailEl.value.trim();
      var errEl = container.querySelector('#glForgotErr');
      errEl.hidden = true;
      if (!email){ errEl.textContent = 'Enter your email.'; errEl.hidden = false; return; }
      submit.disabled = true;
      window.GL_API.resetStart(email).then(function(){
        container.innerHTML =
          '<div class="gl-card">' +
            '<h3 style="margin:0 0 .5rem">Check your email</h3>' +
            '<p class="gl-muted" style="margin:0">If an account exists for that email, a reset link is on its way — check your inbox (and your junk/spam folder, just in case). Open it, set a new password, then come back here and log in.</p>' +
            '<button type="button" class="gl-btn gl-btn-outline" id="glForgotDone" style="margin-top:1rem">Back to log in</button>' +
          '</div>';
        container.querySelector('#glForgotDone').addEventListener('click', function(){
          window.GL_NATIVE.tap();
          mode = 'login';
          render();
        });
      }).catch(function(){
        submit.disabled = false;
        errEl.textContent = 'Something went wrong. Try again.';
        errEl.hidden = false;
      });
    });
  }

  render();
};
