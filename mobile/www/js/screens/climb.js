// The Climb, playable fully logged out -- no account, no server round-trip.
// This is a scaffold-stage implementation of the mechanic (climb a ladder of
// increasingly tough fictional opponents, one loss ends the run) so the free
// section has something real to interact with. Wiring this to the actual
// site's Climb tuning/data (see THE-CLIMB-TUNING.txt) is a follow-up once
// the shell itself is proven out.
window.GL_ROUTER.register('climb', {
  title: 'The Climb',
  tab: 'climb',
  render: function(container){
    var state = { rung:1, power:70, streak:0, alive:true };

    function opponentPower(rung){ return 65 + rung * 3.2; }

    function fight(){
      window.GL_NATIVE.tap();
      var oppPower = opponentPower(state.rung);
      var winProb = 1/(1+Math.pow(10, -(state.power - oppPower)/12));
      var win = Math.random() < winProb;
      if (win){ state.rung += 1; state.streak += 1; }
      else { state.alive = false; }
      draw();
    }

    function reset(){ state = { rung:1, power:70, streak:0, alive:true }; draw(); }

    function draw(){
      container.innerHTML =
        '<div class="gl-card">' +
          '<p class="gl-label" style="margin-bottom:.2rem">No account needed</p>' +
          '<p>Climb the ladder one opponent at a time. Every win gets you a tougher fight -- one loss ends the run.</p>' +
        '</div>' +
        '<div class="gl-card" style="text-align:center">' +
          '<div style="font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)">Rung</div>' +
          '<div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:900;font-size:2.6rem;color:var(--accent);line-height:1">' + state.rung + '</div>' +
          '<div class="gl-muted">Current streak: ' + state.streak + '</div>' +
        '</div>' +
        (state.alive
          ? '<button class="gl-btn gl-btn-primary" id="climbFightBtn">Fight Next Opponent</button>'
          : '<div class="gl-card" style="text-align:center;border-color:var(--bad)">' +
              '<h3 style="margin:0 0 .3rem;color:var(--bad)">Run Over</h3>' +
              '<p>You made it to rung ' + state.rung + '.</p>' +
            '</div>' +
            '<button class="gl-btn gl-btn-outline" id="climbResetBtn">Start a New Run</button>');

      var fightBtn = container.querySelector('#climbFightBtn');
      if (fightBtn) fightBtn.addEventListener('click', fight);
      var resetBtn = container.querySelector('#climbResetBtn');
      if (resetBtn) resetBtn.addEventListener('click', reset);
    }

    draw();
  }
});
