# AI Improvements — Analysis & Proposals

Companion to [GAME_LOOP.md](./GAME_LOOP.md) §8 (how the AI works today) and
[POT_ODDS_PLAN.md](./POT_ODDS_PLAN.md) (the detailed plan for the pot-odds
lever). Analysis only — no code changes are prescribed for the current branch.

## 1. Where the AI stands (post the 2026-07-09 fixes)

The decision pipeline per turn:

```
stakes  = min(highBet − bet, chips) / (chips + bet + currentRoundChipsInvested)
          → classifyStakes → one of 9 tiers (blind … beware)
hand    → determinant { callLimit, raiseChance, raiseRange }
fold    if stakes tier > callLimit tier
raise   if roll < raiseChance AND a randomly-picked raiseRange tier ≥ stakes,
          betting decideBetProportion(tier) × chips, clamped legal
call    otherwise (capped at stack → all-in call)
```

Three recent changes moved behavior a lot:

1. **Bug #6 fix** re-enabled raising for everything below a full house.
   `raiseChance: 0.2/0.5/0.7` for No Pair/Pair/Two Pair was original design
   intent that had been dormant behind typos — the passive bots everyone was
   used to were an accident.
2. **Bug #5 fix** made pocket pairs playable (aces no longer fold to big bets).
3. **Pot-commitment wiring** made stakes constant across streets (cost-to-call
   against the hand-start stack), removing the "gets easier to bluff the deeper
   they're invested" gradient and enabling short-stack call-offs.

## 2. Diagnosis: board-blindness

The evaluator scores the combined 7-card hand **absolutely**, with no notion of
how much the *hole cards* contribute. A pair or two pair sitting entirely on
the board registers as personal hand strength — and every live player registers
the identical strength. Because the post-flop `callLimit` for Two Pair and
better is `beware` (never folds at any price), a paired board hands the whole
table an unfoldable hand nobody actually holds.

Measured behavior (3,000 trials/spot, bot holds 3♣4♦ — pure junk — in all):

| Spot | fold | call | raise |
|---|---|---|---|
| A. Double-paired board (K-K-9-9-x), facing 20%-stack bet | 0% | 72% | 28% |
| B. Same board, facing a full 10,000 shove | 0% | **100%** | 0% |
| C. Board pair only; short stack after investing 8,000; facing shove | 0% | **100%** | 0% |
| D. Spot C under the pre-wiring math | **100%** | 0% | 0% |
| E. Complete air, dry board, unopened pot | 0% | 81% | **19%** |

Attribution of blame:

- **Spot B is pre-existing** — Two Pair's `beware` callLimit predates every
  recent fix. Board-blindness is the root cause, not the new code.
- **Spot E is the #6 fix waking up** — air stabs 19% per bot per action; with
  four bots, ~59% of unopened pots get stabbed by someone.
- **Spot C-vs-D is the wiring's contribution** — call-offs work as designed,
  but "promising hand" is evaluated board-blind, so 4-high qualifies.

The old game was balanced by mutually-cancelling defects: board-blind
evaluation was masked by bots that couldn't raise (#6) and got scared the
deeper they were invested (inverse commitment). Fixing the two governors
exposed the underlying flaw.

**Product note (deliberate):** the current hyper-aggressive AI is being kept
for now — it makes the game livelier and busts happen fast. The proposals
below are sequenced for whenever challenge should beat chaos.

## 3. Proposed improvements, ranked

### P1 — Hole-card attribution ("does the board play?") — the big one

**Idea:** discount hand strength when the made hand exists on the board
without the bot's participation. Fixes spots A, B, and C simultaneously while
leaving genuinely-made hands exactly as sticky as the commitment wiring
intends.

**Implementation sketch** (post-flop branch of `handleAI`, after `highRank`
is chosen, before `buildGeneralizedDeterminant`):

- **Detecting participation, per rank family:**
  - Pairs/trips/quads/full house: `frequencyHistogramMetaData` already carries
    the rank-defining faces; intersect with the hole faces
    (`activePlayer.cards[].cardFace`). Empty intersection ⇒ board-made.
  - Flush: count hole cards of `flushedSuit`; 0 ⇒ board flush.
  - Straight: check whether either hole card's value appears in
    `concurrentCardValues` (the winning run).
  - **Simpler universal alternative:** run the same evaluation battery over
    `state.communityCards` alone → `boardRank`. If `boardRank === highRank`,
    the board plays. One extra evaluation per AI turn (cheap), reuses all
    existing functions, no per-rank logic. Recommended for phase 1. (Note:
    `checkStraight` returns bare `false` for < 5 unique values — the 3-card
    flop board — so the helper must tolerate the destructure-undefined quirk,
    same as `handleAI` already does.)
- **Applying the discount (phase 1, binary):** when the board plays, override
  the determinant to roughly the No Pair posture — proposal:
  `{ callLimit: 'meddraw', raiseChance: 0.1, raiseRange: ['lowdraw', 'meddraw'] }`.
  Everyone has this hand; only kickers differ.
- **Phase 2 (graded):** three tiers — board plays fully / one hole card
  participates / hand made by both hole cards — demoting `callLimit` one tier
  for the middle case (Two Pair `beware` → `aggro`). Kicker quality (an ace
  kicker on a board-played hand has real chop/win value) can nudge the
  discount, but that's polish.

**Test plan:** the five measured spots above become fixtures; spot B flips to
fold, spot C flips to fold, A stops raising. The existing pot-commitment tests
survive untouched — their fixtures hold a hole King that participates in the
pair, which is exactly the point.

Effort: ~half a day incl. tests. No architecture changes.

### P2 — Aggression tuning (a taste dial, not a bug)

The awakened `raiseChance` values were never play-tested. Proposed dials once
the entertainment period ends:

| Rank | now | proposed | rationale |
|---|---|---|---|
| No Pair | 0.2 | 0.05 | air stabs ~59% of unopened pots table-wide |
| Pair | 0.5 | 0.25–0.3 | half of all pairs raising is relentless |
| Two Pair | 0.7 | 0.5 | with P1 in place, this only hits real two pair |

Raise *sizing* (`decideBetProportion × chips`) ignores the pot entirely —
pot-relative sizing lands with the pot-odds work (see the plan doc).

### P3 — Bluff-catch floor

A small unconditional call probability on the fold branch — e.g. 5–10%,
scaled up by commitment — makes human bluff-spam statistically unprofitable
over a session without visibly changing any single hand. ~5 lines plus tests;
independent of everything else.

### P4 — Pre-flop bucket differentiation

`highCard > 8 && lowCard > 6` rates K-8o as `beware` (never folds pre-flop),
identical to A-K. Split the never-fold bucket by kicker quality and suitedness;
today's table is loose-passive at the top rather than tight. Small,
data-table-only change guarded by the determinant-integrity tests.

### P5 (stretch) — Opponent aggression memory

Track per-opponent raise frequency (a counter on the player object, incremented
in `handleBet` when a raise reopens action) and discount `stakes` against
chronic aggressors. First step beyond memoryless play; needs design for
reset/decay. Defer until P1–P3 have settled the baseline.

## 4. What NOT to change

- **The pot-commitment wiring stays.** Spot C-vs-D is intended behavior; the
  discomfort comes from board-blindness (P1's job), not the wiring.
- **The determinant-integrity tests** (`ai.test.js`) guard every table tweak
  above — any new tier string or missing `raiseChance` fails loudly.
- **The tier-ladder architecture** is worth keeping through P1–P4; it's
  legible and every proposal above fits inside it. The first thing that
  genuinely strains it is equity-based calling (see POT_ODDS_PLAN.md,
  option B).

## 5. Suggested sequence

1. P1 attribution — *before* pot odds (pot odds widens calls in big pots,
   which makes board-blind junk calls worse, not better).
2. Pot odds, option A ([POT_ODDS_PLAN.md](./POT_ODDS_PLAN.md)).
3. P2 tuning + P3 bluff-catch floor (one balancing pass, played and felt).
4. P4 pre-flop table.
5. Draw awareness + pot odds option B together (they're the same concept:
   equity vs price).
