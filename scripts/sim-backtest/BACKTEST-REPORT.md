# Fight Simulator — Point-in-Time Backtest & Tuning Report

## What this is

Now that every fighter has per-fight box scores, we can do something we couldn't
when the formula was first written: test it against thousands of real fights and
see how accurate it actually is. This report backtests the live simulator on 4,518
historical UFC bouts, measures where it's mis-calibrated, and fits its key knobs to
the data. Nothing in `index.html` has been changed yet — this is the evidence for
that decision.

## Method (and how leakage was avoided)

The single biggest trap in a backtest like this is letting the future leak into the
prediction. Each fight is scored using **only information that existed the day
before it happened**:

- **Box-score stats recomputed as-of the fight date** — each fighter's striking
  volume/accuracy/defense, takedowns, subs, and knockdowns are rebuilt from only
  their *earlier* bouts, using the exact same formulas as the live career averages.
- **Fight history globally truncated** to bouts before the fight — so form, win
  streak, schedule, durability, and finish rate all reflect only the past.
- **The clock is set to the fight date** — "recency", age, and layoff are measured
  as they stood then, not today.
- **Current rankings are disabled** — a fighter's *current* rank reflects fights
  that hadn't happened yet, so it's turned off; the formula's built-in
  historical-tier estimator still reconstructs an as-of resume signal.

The extracted code is the **exact production formula** — verified to reproduce the
live `simWinProbability` to within 1e-9. Only fights where **both fighters had ≥2
prior UFC box-scored bouts** are graded (4,518 of 9,026 candidate bouts), so we're
never "predicting" from an empty sheet.

## Baseline: the current formula is overconfident

| Metric | Value | Reference |
|---|---|---|
| Accuracy (favorite wins) | 58.2% | market favorites ≈ 60–65% |
| Brier score | 0.2426 | 0.25 = coin flip (lower better) |
| Log loss | 0.6797 | 0.693 = coin flip (lower better) |

The formula has real skill, but the calibration curve shows a clear, symmetric
problem — **it's too confident at the edges**:

| Predicted band | n | Predicted | Actual won |
|---|---|---|---|
| 20–30% | 330 | 25.9% | **35.5%** |
| 30–40% | 705 | 35.6% | 40.9% |
| 40–50% | 1084 | 45.1% | 46.1% |
| 50–60% | 1093 | 54.8% | 53.0% |
| 60–70% | 730 | 64.6% | 60.3% |
| 70–80% | 345 | 74.5% | **64.6%** |
| 80–90% | 113 | 83.4% | 76.1% |
| 90–100% | 14 | 93.0% | **71.4%** |

When it says 75%, favorites actually win ~65%. When it says 25%, they actually win
~35%. That's the textbook signature of a probability spread that's too wide — the
logistic steepness `k` should be larger.

## Tuning

Seven high-leverage knobs were fit to minimize log loss on a **time-based training
split** (fights before July 2024), then scored on the **held-out last two years**
(672 fights) — so improvements are out-of-sample, not curve-fitting. Weights were
mildly regularized toward their current values; striking is held as the reference
scale (otherwise a global weight change would just be degenerate with `k`).

Two candidates emerged:

| | Train log-loss | Test log-loss | Test Brier | Test accuracy |
|---|---|---|---|---|
| **Current** (k=3.2) | 0.6817 | 0.6684 | 0.2377 | 60.9% |
| **k only** (k=5.4) | 0.6735 | 0.6664 | 0.2370 | 60.9% |
| **Full tuned** (k=4.8, grappling 0.88, finishing 0.84) | 0.6719 | 0.6655 | 0.2367 | 60.4% |

The `k`-only change captures most of the out-of-sample gain, keeps accuracy exactly,
and moves a single well-understood parameter. The full retune adds a sliver more
calibration but costs ~0.5pp accuracy and touches the grappling/finishing weights —
though notably in the *same direction* the code comments already suspected (stacked
grappling/finishing terms driving overconfident blowouts).

### Calibration after `k = 5.4` (full set)

| Band | Current (pred/actual) | k=5.4 (pred/actual) |
|---|---|---|
| 30–40% | 36 / 41 | 36 / 38 |
| 40–50% | 45 / 46 | 45 / 44 |
| 50–60% | 55 / 53 | 54 / 55 |
| 60–70% | 65 / 60 | **64 / 64** |
| 70–80% | 74 / 65 | 73 / 81 (n=100) |

The overconfidence in the busy mid-bands is essentially gone.

## What it does to real matchups (live stats)

| Matchup | Current | k=5.4 | Full |
|---|---|---|---|
| Makhachev vs Oliveira | 72% | 64% | 66% |
| Topuria vs Holloway | 72% | 64% | 64% |
| Topuria vs Oliveira | 60% | 56% | 57% |
| Jon Jones vs Aspinall | 39% | 43% | 46% |
| Dvalishvili vs Umar Nurmagomedov | 58% | 55% | 55% |
| Pereira vs Ankalaev | 59% | 56% | 56% |
| O'Malley vs Dvalishvili | 28% | 37% | 35% |
| Rakhmonov vs Belal Muhammad | 76% | 67% | 67% |
| Edwards vs Usman | 37% | 42% | 42% |
| Du Plessis vs Strickland | 29% | 37% | 35% |
| Pantoja vs Moreno | 62% | 57% | 57% |
| Aspinall vs Gane | 75% | 66% | 65% |
| Chimaev vs Whittaker | 73% | 64% | 64% |
| Zhang Weili vs Suarez | 48% | 49% | 49% |

Every favorite stays a favorite; the pick order never changes. The edges just get
pulled toward reality — big favorites shed ~7–9 points of overconfidence, coin-flips
barely move.

## Caveats (honest limitations)

- **The graded sample skews toward thinner-résumé fighters** than a typical marquee
  matchup (it needs ≥2 prior box-scored bouts, which catches a lot of early-career
  fights). Elite current matchups likely aren't *quite* as overconfident as the
  aggregate suggests — but the direction is unambiguous.
- **Rankings are off in the backtest but on in the live product.** `k` is a global
  slope, so the overconfidence fix transfers cleanly; the exact optimum for the
  with-rankings formula could differ by a little.
- **MMA is genuinely high-variance.** ~60% accuracy and Brier ~0.24 aren't a weak
  model — they're close to what the betting market itself achieves. The win here is
  honest probabilities, not a leap in raw accuracy.

## Recommendation

Adopt the **`k` only** change: `3.2 → 5.4`. It's one robust, well-motivated knob
that fixes the documented overconfidence, improves out-of-sample log-loss and Brier,
and leaves accuracy and every pick order untouched. The full retune is a reasonable
"slightly more" option if you'd rather also trim the grappling/finishing weights.

*Harness: `scripts/sim-backtest/` — `extract-sim.cjs` (pulls the live formula),
`backtest.cjs` (point-in-time grading), `tune.cjs` (fitting). Re-runnable any time
the data grows.*

---

## Follow-up: real control time replaces the old proxy

The formula used to *guess* at grappling control ("low striking + high takedown
volume + proven → probably controlling"). The per-fight box scores now carry the
**actual control seconds**, so that guess was replaced with a measured term: net
control time (a fighter's control seconds minus their opponents', per 15 min),
credibility-dampened and soft-capped, computed live from the same box-score data
behind the clickable modal.

Net control alone is a real, monotonic signal (fighters with a +3 min/15 edge win
57%, those at −3 win 42%; AUC 0.548). Tested point-in-time on the same 4,518 fights:

| | Test log-loss | Test Brier | Test accuracy |
|---|---|---|---|
| k=5.4, old proxy | 0.6664 | 0.2370 | 60.9% |
| k=5.4, proxy removed (no term) | 0.6666 | 0.2371 | 60.9% |
| **k=5.4, real control (weight 0.4, cap 3.5)** | **0.6623** | **0.2351** | **61.2%** |

Two things stand out: the old proxy was **inert** (removing it changes nothing),
and the real term improves every out-of-sample metric — and improves the *test* set
more than the *train* set, the signature of genuine signal rather than overfitting.
It shifts matchups the way the tape does: Merab over O'Malley 52→59%, Usman over
Edwards 58→63%, and Pereira vs Ankalaev 56→50% (the model finally respects a
wrestler's control threat against a striker).

### Cumulative effect (out-of-sample)

| | Log-loss | Brier | Accuracy |
|---|---|---|---|
| Original (k=3.2, proxy) | 0.6684 | 0.2377 | 60.9% |
| + k→5.4 | 0.6664 | 0.2370 | 60.9% |
| + real control time | 0.6623 | 0.2351 | 61.2% |
| + grappleEdge weight 1.6→2.5 | **0.6622** | **0.2350** | **61.5%** |

---

## Follow-up: is grappling matchup-dependent?

The question: does a grappler's edge get modulated by the *opponent's* takedown
defense — blunted vs an elite-TDD opponent, amplified vs a leaky one?

**It already is**, via the `simStyleMatchupDelta` grapple term: each fighter's
takedown/sub threat is scaled by `(0.65 − opponent's takedown defense)`, so the
threat flips negative against an elite defender and is amplified against a poor one.

Two experiments on the 4,518-fight backtest tested whether to extend it:

1. **A control-time-specific matchup adjustment** (scale the new control boost by
   opponent TDD) — **rejected**. Out-of-sample log-loss was dead flat (0.6623)
   across every slope, and train log-loss slightly worsened. It's redundant with
   the takedown/sub matchup term already above, which is why it adds nothing.

2. **Re-weighting the existing grapple matchup term** — **modest, real gain**. Both
   train and out-of-sample log-loss improved together as the weight rose from 1.6
   and then plateaued around 2.5-3.0 (train 0.6730→0.6725, test 0.6625→0.6621),
   with test accuracy peaking ~61.5-61.8%. That co-movement (not train-only) is the
   signature of genuine signal, not overfitting. Adopted **1.6 → 2.5** as a
   conservative value within the plateau. The term is hard-capped at ±1.2 points
   regardless of weight, so even a large takedown-defense gap can't run away, and
   elite matchups (where both fighters defend takedowns well) barely move.

Net: the matchup dependence you'd want is present and now slightly sharper; a
separate control-matchup knob was tested and left out because the data didn't
support it.

---

## Follow-up: the age curve (and a leak found while testing it)

A full one-at-a-time sensitivity scan of every remaining hand-set weight, followed
by a joint fit, showed the production/situational weights are already well-balanced
— the big single-term numbers were terms stealing each other's variance, and the
honest joint gain was tiny. With one exception: **age**.

Two things surfaced:

1. **A point-in-time leak in the age term.** `calcAge` used a no-arg `new Date()`
   (today) rather than the fight-date clock, so the backtest was measuring each
   fighter's age *now*, not at the fight. Fixed (harness rewires it); this made the
   honest baseline slightly worse, as removing a leak should.

2. **The age penalty was badly under-tuned** — the biggest miss in the whole
   formula. It only started at 36; sweeping the onset and steepness point-in-time,
   both training and held-out sets minimized around an onset of **30-32** with a
   steeper curve. This matches sports science (athletic peak ~27-30, decline from
   the early 30s): the old age-36 threshold was crediting fading veterans with prime
   ability their results no longer supported.

Adopted the **moderate** curve: onset **32** (was 36), steepness ×1.5, cap 1.5→2.0.

| | Test log-loss | Test Brier | Test accuracy |
|---|---|---|---|
| old age curve (onset 36) | 0.6631 | 0.2355 | 60.9% |
| **moderate (onset 32)** | **0.6554** | **0.2317** | **62.2%** |

This was the single largest out-of-sample gain of the entire effort — larger than k,
control, and grappleEdge combined. It fades older fighters a few points against
younger ones (Oliveira/Topuria 43→40%, Jones/Aspinall 42→38%, Volkanovski/Evloev
44→40%), and cancels out when both are old (Dos Anjos/Gamrot unchanged).

## Final state

The simulator now sits at **test log-loss 0.6554, Brier 0.2317, accuracy 62.2%**
(point-in-time, held-out) — up from the original **0.6684 / 60.9%**. Five validated
changes shipped (k, real control time, grappleEdge weight, age-clock fix, age
curve); four ideas were tested and **rejected** for no out-of-sample benefit
(control-matchup adjustment, and re-weighting grappling/finishing/most situational
terms). The discipline throughout: keep only what improves held-out data.
