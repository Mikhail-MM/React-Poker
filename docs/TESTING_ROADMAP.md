# Testing & State-Evolution Roadmap

Companion to [GAME_LOOP.md](./GAME_LOOP.md). That document maps what the code
*does*; this one plans how the testing story — and eventually the state
architecture — evolves so that the game's **invisible micro-transitions**
become observable, capturable, and ultimately time-travelable.

## The core problem

A single player action drives a synchronous cascade
(`handleBet → determineNextActivePlayer → handlePhaseShift → reconcilePot →
dealFlop / showDown → …`) that mutates one shared state object dozens of times
and commits **once** via `setState`. Consequences:

- React only ever renders the *endpoints* of a cascade; every intermediate
  state (pot swept, street dealt, cursor moved) is invisible.
- Tests can assert endpoints easily, but a regression *inside* the cascade can
  produce a coincidentally-correct endpoint.
- Animations cannot attach to beats that are never committed.
- Debugging means `console.log` archaeology instead of stepping a timeline.

The original design instinct — "mutate a private copy freely, hand back the
result" — is actually the reducer mental model with the dispatch granularity
missing. The stages below recover that granularity incrementally, without a
big-bang rewrite, and each stage states what new testing power it buys.

---

## Stage 0+1 — DONE: characterization, snapshots, seam tracing, scenario matrix

What exists today (all zero-source-change):

| Layer | Where | What it pins |
|---|---|---|
| Characterization units | `src/utils/__tests__/unit/` | Endpoint behavior of every exported transformer, incl. `KNOWN BUG` pins |
| Logic snapshots | `showdown.snapshot.test.js` | Exact best-hand construction per rank; full showdown outcomes |
| Component snapshots | `components.snapshot.test.js` | Presentational markup states |
| **Seam traces** | `gameflow.trace.test.js` + `testUtils/trace.js` | **The intermediate states of a cascade**, captured at every module boundary |
| **Side-pot matrix** | `sidePots.matrix.test.js` | 13 bet/fold/all-in/dead-money/refund configurations with per-street ledgers |

The seam tracer exploits a compilation detail: cross-module calls go through
the module-exports object (`(0, _players.determineNextActivePlayer)(state)`),
so `jest.spyOn` on the module namespace intercepts the pipeline's *internal*
calls and records a state snapshot at each hop. This is a poor-man's
transition log, available today.

**Known blind spot:** same-module calls are direct references — invisible.
Concretely: `handlePhaseShift → reconcilePot` (both `bet.js`), the
`calculateSidePots` recursion, and everything inside `showDown`
(`distributeSidePots → battleRoyale → payWinners`, all `cards.js`). The river
trace in `gameflow.trace.test.js` documents this gap deliberately. The matrix
suite compensates for the side-pot blind spot from the outside (per-street
ledgers + invariants); nothing compensates inside `showDown` yet.

Matrix invariants enforced on every scenario (these are the seeds of Stage 5's
properties):

1. `state.pot === Σ sidePots[].potValue` after every street
2. no duplicate contestants within a pot
3. chip conservation end-to-end (bets → pots → refunds)

---

## Stage 2 — Explicit transition log (small, safe source change)

Goal: eliminate the tracer's blind spots by making the pipeline *announce* its
own steps instead of being spied on.

Sketch — a `step` helper threaded through the existing functions:

```js
// utils/transitions.js
let listener = null;
export const onTransition = (fn) => { listener = fn; };
export const step = (label, state) => {
  if (listener) listener({ label, snapshot: summarize(state) });
  return state;
};
```

Then, at each conceptual beat (not each line):

```js
// bet.js
const handlePhaseShift = (state) => {
  switch (state.phase) {
    case 'betting1':
      state.phase = 'flop';
      return dealFlop(step('reconcile:flop', reconcilePot(state)));
    ...
```

Properties of this approach:

- **No behavior change** — `step` is identity when no listener is attached.
- Production can leave it dormant; tests and a future dev-tools panel attach.
- The seam tracer retires; trace tests switch to the explicit log and gain the
  interior beats (`reconcilePot` inside phase shifts, `payWinners` per pot,
  each `calculateSidePots` layer if desired).
- Labels become a stable vocabulary — effectively **naming the actions** ahead
  of the Stage 3 reducer.

Test capability unlocked: cascade tests assert a *complete* ordered beat log;
side-pot tests observe each recursion layer as it happens rather than
reconstructing it from the final ledger.

Effort: ~1 day. Risk: near zero (identity function + call-site decoration).

---

## Stage 3 — Reducer + step queue (the architectural payoff)

Goal: each beat becomes a dispatched action producing a committed state, so
React (and the animation layer) can render *between* beats.

The current cascade collapses many beats into one call because functions call
each other directly. Invert that: functions **return what should happen
next** instead of doing it.

```js
// The pure core: one beat per dispatch, no self-scheduling.
const reduce = (state, action) => {
  switch (action.type) {
    case 'BET':            // validate + move chips (no cursor advance!)
    case 'ADVANCE_CURSOR': // one determineNextActivePlayer step
    case 'RECONCILE_POT':
    case 'DEAL_FLOP': case 'DEAL_TURN': case 'DEAL_RIVER': case 'RUN_OUT_BOARD':
    case 'SHOWDOWN': case 'PAY_POT':   // one side pot per action
    case 'NEXT_ROUND':
  }
  return { state, next: [/* follow-up actions */] };
};

// The driver: owns time. Drains `next` through a queue, committing each
// state, optionally with a delay per action type (animation beats!).
```

Notes anchored in the current code:

- The existing transformers largely *are* the case bodies already —
  `handleBet` minus its tail-call into `determineNextActivePlayer`, etc. The
  refactor is mostly **cutting the tail-calls** and returning follow-up
  actions instead. Stage 2's labels are the action names.
- The AI stops being called from a `setState` callback; the driver sees
  "active player is a robot" and enqueues `AI_DECIDE` (whose *output* is a
  `BET`/`FOLD` action). `pushAnimationState` stops being threaded into
  `ai.js` — animations subscribe to committed actions instead.
- **Bug classes retired wholesale:** the freeze (bug #2) becomes impossible
  as a hang — an invalid `BET` reduces to `{ state, next: [ERROR_EFFECT] }`
  instead of `undefined` propagating into `setState`; the React 18 batching
  trap (bug #10) disappears because nothing reads `this.state` mid-flight.
- Time travel arrives here for free: the driver keeps
  `[{action, state}, ...]` — step back = pointer decrement.

Test capability unlocked: reducer tests are trivially deterministic
(`expect(reduce(state, action))`), golden game replays become
`actions.reduce(reduce, initialState)`, and every historical bug becomes a
one-action regression test.

Effort: the real project (1–2 weeks incremental). Can be done one action at a
time — the driver can fall back to the legacy cascade for not-yet-extracted
actions.

---

## Stage 4 — Keep the mutation, gain immutability: Immer + patches

The mutative style is the codebase's native mental model — and it can be
*kept*. [Immer](https://immerjs.github.io/immer/) wraps a mutable draft over
an immutable base; existing transformer bodies run unchanged inside
`produce()`:

```js
import { produce, enablePatches } from 'immer';
enablePatches();

const [nextState, patches, inversePatches] = produceWithPatches(
  state,
  draft => reduce(draft, action)   // existing mutative code, verbatim
);
```

What this buys, in order of relevance to this repo:

- **`cloneDeep` retires.** Structural sharing replaces full-state deep clones
  on every action (currently the single biggest allocation in the loop).
- **Patches ARE the micro-mutation log.** Each patch is
  `{op: 'replace', path: ['players', 2, 'chips'], value: 400}` — the exact
  "discrete bucketed micro-state transition objects" hypothesized in the
  original design, generated automatically from unmodified mutative code.
- **Inverse patches = rewind.** Field-level time travel without storing full
  snapshots.
- Accidental mutation of the *base* state (the bug class the original
  `cloneDeep` defended against) becomes a thrown error in dev via
  `Object.freeze`.

Test capability unlocked: assert on patch streams
(`expect(patches).toContainEqual({op: 'replace', path: ['pot'], value: 0})`) —
mutation-level precision without hand-writing observers. Snapshot the patch
log of a whole hand: that's the ultimate trace test.

Effort: days, not weeks — largely additive at the dispatch wrapper. Sequence
it after Stage 3 (patches-per-action are meaningful; patches-per-cascade less
so).

---

## Stage 5 — Property-based testing for the pot system

The matrix suite hand-picks 13 configurations; the pot system's input space is
enormous (bet sizes × all-in depths × fold timing × street counts). Generate
it instead, with [fast-check](https://fast-check.dev/):

```js
fc.assert(fc.property(arbitraryBettingHistory(), history => {
  const ledger = playStreets(history.roster, history.streets);
  // The matrix invariants, now over thousands of random configurations:
  //   pot === Σ sidePots, contestants unique + live-at-build-time,
  //   chip conservation, refund ≤ largest bet, pots monotonically
  //   non-shrinking across condensation, ...
}));
```

The `playStreets` runner and its three invariants in `sidePots.matrix.test.js`
were written to be lifted directly into properties. Additional properties
worth encoding: *paying* the generated pots (through `showDown`) never mints
or destroys chips (modulo bug #3 until fixed — a perfect example of a property
that documents a bug precisely: conservation error is always `< winners.length`).

Effort: 1–2 days once fast-check is a devDependency. Independent of Stages
2–4 — could be done tomorrow.

---

## AI challenge track

The pot-commitment wiring (2026-07-09) fixed the biggest exploit multiplier:
stakes are now the cost-to-call (capped at the stack) measured against the
hand-start stack via `currentRoundChipsInvested`. Post-wiring play-testing
surfaced the next layer — the evaluator is board-blind, and the awakened
raise tables are untuned — analyzed in depth in
[AI_IMPROVEMENTS.md](./AI_IMPROVEMENTS.md), with the pot-odds lever specced in
[POT_ODDS_PLAN.md](./POT_ODDS_PLAN.md). Ranked sequence (rationale in those
docs — notably, attribution must precede pot odds):

1. **Hole-card attribution** — discount hands the board made for everyone
   (junk currently calls off full stacks on paired boards).
2. **Pot odds** (option A: stakes multiplier) — the pot is not an input
   anywhere; a single flop overbet still folds out every bot below two pair.
3. **Aggression tuning + bluff-catch floor** — one balancing pass after 1–2.
4. **Pre-flop bucket differentiation** — K8o currently rates `beware` (never
   folds pre-flop) identically to AK.
5. **Draw awareness + equity-threshold calling** (pot odds option B) — the
   destination architecture for post-flop calls.

*Deliberate current state: the untuned hyper-aggressive AI is being kept for
entertainment value until this track begins.*

## Wishlist / decision table

| Item | Stage | Effort | Payoff | Notes |
|---|---|---|---|---|
| Side-pot matrix + invariants | ✅ done | — | high | 13 scenarios, per-street ledgers |
| Cascade seam traces | ✅ done | — | high | module-boundary blind spots documented |
| Fix the pinned bug census | ✅ done | — | high | #1, #1b, #2 (freeze), #3 (odd chip → first winner), #5 (pocket pairs), #6 (raise typos), #7 fixed 2026-07-09. Still open: #4 (all-in un-reconcile), #9 (short-stack blinds), optional `handleBet` hardening (descriptive throw) |
| `step()` transition log | 2 | ~1 day | high | names the action vocabulary |
| Trace `showDown` interior (per-pot payouts) | 2 | hours | med | needs `step()`; closes the biggest blind spot |
| Reducer + driver queue | 3 | 1–2 wks | very high | animation beats, time travel, retires bug classes #2/#10 |
| Immer + patch log | 4 | days | high | keeps mutative style; `cloneDeep` retires |
| fast-check pot properties | 5 | 1–2 days | high | independent; can precede Stage 2 |
| Seeded RNG injection (deck + AI) | any | ~1 day | med | full-game golden replays need determinism |
| AI challenge track (pot odds, draws, bluff-catch floor) | any | days | high | see §AI challenge track; pot commitment wired 2026-07-09 |
| TypeScript migration | any | ongoing | high | see GAME_LOOP.md §10 — catches bug classes #2/#4/#6 at compile time |

## Suggested order

1. ~~Fix the freeze (bug #2)~~ — **done 2026-07-09** (along with #1/#1b),
   exactly as intended: the pinned tests were flipped in the same change.
2. Stage 5 properties for the pot system (independent, cheap, directly serves
   the "many variants" goal beyond any hand-written matrix).
3. Stage 2 `step()` log — small, and its labels de-risk Stage 3.
4. Stage 3 reducer/driver — the architectural payoff.
5. Stage 4 Immer patches — micro-mutation time travel on top.
