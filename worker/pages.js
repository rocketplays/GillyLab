/* Public HTML pages served by the Worker (landing, auth, subscribe, account).
   Self-contained (no gated assets) and on-brand with the app: dark + #00e668. */

const PRICE_LABEL = "$9.99 / month";   // display only — real price lives in Stripe

const shell = (title, body, extraJs = "") => `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  :root{--accent:#00e668;--bg:#0a0a0b;--card:#141416;--line:rgba(255,255,255,.09);--muted:rgba(255,255,255,.55)}
  *{box-sizing:border-box}
  html{background:var(--bg)}   /* dark behind the body so tall screens / iOS overscroll never show white */
  body{margin:0;background:radial-gradient(1200px 600px at 50% -10%,#15201a 0%,var(--bg) 55%);color:#fff;
       font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;min-height:100vh;min-height:100dvh}
  .wrap{max-width:440px;margin:0 auto;padding:2.5rem 1.25rem 4rem}
  .hero{max-width:760px;text-align:center;padding-top:1rem}
  .brand{font-weight:900;letter-spacing:.14em;font-size:1rem}
  .brand .a{color:var(--accent)}
  h1{font-size:2.15rem;line-height:1.1;margin:1.4rem 0 .6rem;font-weight:850}
  h1 .a{color:var(--accent)}
  .sub{color:var(--muted);font-size:1.02rem;max-width:520px;margin:0 auto 1.6rem}
  .card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:1.4rem 1.3rem;margin-top:1.25rem}
  label{display:block;font-size:.8rem;color:var(--muted);margin:.85rem 0 .3rem;font-weight:600}
  input{width:100%;padding:.7rem .8rem;background:#0e0e10;border:1px solid var(--line);border-radius:9px;color:#fff;font-size:1rem}
  input:focus{outline:none;border-color:var(--accent)}
  button,.btn{display:inline-block;width:100%;text-align:center;margin-top:1.1rem;padding:.8rem 1rem;border:0;border-radius:10px;
       background:var(--accent);color:#04120a;font-weight:800;font-size:1rem;cursor:pointer;text-decoration:none}
  .btn.ghost{background:transparent;color:#fff;border:1px solid var(--line);font-weight:600}
  .row{display:flex;gap:.75rem;justify-content:center;flex-wrap:wrap;margin-top:1.6rem}
  .row .btn{width:auto;padding:.8rem 1.5rem}
  .muted{color:var(--muted)} .center{text-align:center}
  a{color:var(--accent)}
  .msg{margin-top:.9rem;font-size:.88rem;min-height:1.1em}
  .msg.err{color:#ff6a5e} .msg.ok{color:var(--accent)}
  .alt{margin-top:1rem;text-align:center;font-size:.88rem}
  .feat{display:grid;gap:.55rem;text-align:left;max-width:360px;margin:1.4rem auto 0;color:rgba(255,255,255,.8);font-size:.95rem}
  .feat div::before{content:"✓ ";color:var(--accent);font-weight:900}
  .price{font-weight:800;color:var(--accent)}
  hr.or{border:0;border-top:1px solid var(--line);margin:1.4rem 0 .2rem;position:relative}
  hr.or::after{content:"or";position:absolute;top:-.7em;left:50%;transform:translateX(-50%);background:var(--card);padding:0 .6rem;color:var(--muted);font-size:.8rem}
</style></head><body><div class="wrap">${body}</div>
<script>
function post(url, data){return fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)}).then(r=>r.json());}
function wire(formId, url, msgId){
  var f=document.getElementById(formId); if(!f)return;
  f.addEventListener("submit",function(e){e.preventDefault();
    var m=document.getElementById(msgId); m.className="msg"; m.textContent="Working…";
    var data={}; new FormData(f).forEach((v,k)=>data[k]=v);
    post(url,data).then(function(r){
      if(r.error){m.className="msg err";m.textContent=r.error;return;}
      if(r.redirect){window.location=r.redirect;return;}
      if(r.ok){m.className="msg ok";m.textContent="If an account exists for that email, a sign-in link is on its way — check your inbox. New here? Create an account below.";}
    }).catch(function(){m.className="msg err";m.textContent="Network error — try again.";});
  });
}
${extraJs}
</script></body></html>`;

export const landingPage = () => shell("GillyLab — UFC fighter database", `
  <div class="hero" style="margin:0 auto">
    <div class="brand">GILLY<span class="a">LAB</span></div>
    <h1>The complete <span class="a">UFC</span> fighter database.</h1>
    <p class="sub">Every fighter, full careers, verified records, and clickable per-fight box scores —
       3,000+ fighters and 18,000+ bouts in one place.</p>
    <div class="feat">
      <div>Every UFC fighter, past and present — full fight histories</div>
      <div>Per-fight box scores: strikes, takedowns, control time & more</div>
      <div>Verified records, career stats, rankings & odds</div>
    </div>
    <div class="row">
      <a class="btn" href="/signup">Get access — <span style="opacity:.85">${PRICE_LABEL}</span></a>
      <a class="btn ghost" href="/login">Log in</a>
    </div>
    <p class="muted center" style="margin-top:1.4rem;font-size:.82rem">Cancel anytime. Secure checkout by Stripe.</p>
  </div>`);

export const signupPage = () => shell("Create your GillyLab account", `
  <div class="center"><div class="brand">GILLY<span class="a">LAB</span></div></div>
  <div class="card">
    <h1 style="font-size:1.4rem;text-align:center">Create your account</h1>
    <p class="muted center" style="margin:.2rem 0 0;font-size:.9rem">Then continue to secure checkout (${PRICE_LABEL}).</p>
    <form id="f">
      <label>Email</label><input name="email" type="email" autocomplete="email" required>
      <label>Password</label><input name="password" type="password" autocomplete="new-password" minlength="8" required placeholder="at least 8 characters">
      <button type="submit">Continue to payment →</button>
      <div id="m" class="msg"></div>
    </form>
    <div class="alt muted">Already a member? <a href="/login">Log in</a></div>
  </div>`, `wire("f","/api/signup","m");`);

export const loginPage = () => shell("Log in to GillyLab", `
  <div class="center"><div class="brand">GILLY<span class="a">LAB</span></div></div>
  <div class="card">
    <h1 style="font-size:1.4rem;text-align:center">Log in</h1>
    <form id="f">
      <label>Email</label><input name="email" type="email" autocomplete="email" required>
      <label>Password</label><input name="password" type="password" autocomplete="current-password" required>
      <button type="submit">Log in</button>
      <div id="m" class="msg"></div>
    </form>
    <hr class="or">
    <form id="mf">
      <p class="muted center" style="font-size:.88rem;margin:.6rem 0 0">Log in a different way — we'll email you a one-click link.</p>
      <label>Email</label><input name="email" type="email" autocomplete="email" required>
      <button type="submit" class="ghost" style="background:transparent;border:1px solid var(--line);color:#fff">Email me a sign-in link</button>
      <div id="mm" class="msg"></div>
    </form>
    <div class="alt muted">New here? <a href="/signup">Create an account</a></div>
  </div>`, `wire("f","/api/login","m"); wire("mf","/api/magic/start","mm");`);

export const subscribePage = (canceled) => shell("Subscribe — GillyLab", `
  <div class="center"><div class="brand">GILLY<span class="a">LAB</span></div></div>
  <div class="card center">
    <h1 style="font-size:1.4rem">${canceled ? "Checkout canceled" : "One step left"}</h1>
    <p class="muted">Your account is ready — start your subscription to unlock the full database.</p>
    <p class="price" style="font-size:1.2rem;margin:.6rem 0">${PRICE_LABEL}</p>
    <button id="go">Subscribe with Stripe →</button>
    <div id="m" class="msg"></div>
    <div class="alt"><a href="/api/logout">Log out</a></div>
  </div>`, `
  document.getElementById("go").addEventListener("click",function(){
    var m=document.getElementById("m"); m.className="msg"; m.textContent="Redirecting to secure checkout…";
    post("/api/checkout",{}).then(function(r){ if(r.redirect){window.location=r.redirect;} else {m.className="msg err";m.textContent=r.error||"Error";}});
  });`);

export const accountPage = (email, subscribed) => shell("Account — GillyLab", `
  <div class="center"><div class="brand">GILLY<span class="a">LAB</span></div></div>
  <div class="card">
    <h1 style="font-size:1.4rem;text-align:center">Account</h1>
    <p class="muted">Signed in as <strong style="color:#fff">${email}</strong></p>
    <p>Subscription: <strong style="color:${subscribed ? "var(--accent)" : "#ff6a5e"}">${subscribed ? "Active" : "Inactive"}</strong></p>
    ${subscribed ? `<a class="btn" href="/">Open GillyLab →</a>` : `<a class="btn" href="/subscribe">Subscribe →</a>`}
    <a class="btn ghost" href="/api/logout">Log out</a>
  </div>`);

export const notePage = (title, msg) => shell(title, `
  <div class="center"><div class="brand">GILLY<span class="a">LAB</span></div></div>
  <div class="card center">
    <h1 style="font-size:1.35rem">${title}</h1>
    <p class="muted">${msg}</p>
    <a class="btn ghost" href="/login">Back to login</a>
  </div>`);
