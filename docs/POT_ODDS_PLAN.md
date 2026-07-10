# Pot Odds — Implementation Plan

Future-branch plan; no code changes on the current branch. Companion to
[AI_IMPROVEMENTS.md](./AI_IMPROVEMENTS.md) — note the sequencing warning there:
**hole-card attribution (P1) should land before or with this**, because pot
odds widens calling ranges in big pots, which amplifies board-blind junk calls
if attribution isn't in place.

## The concept, in one paragraph

Pot odds answer: *is this call priced well?* The price is what it costs to
continue; the payoff is the pot you win. Calling 100 into a 300 pot risks 100
to win 400, so the call only needs to win about 1 time in 4 to break even
(100 / (300 + 100) = 0.25). The bigger the pot relative to the call, the
weaker a hand can profitably continue with; conversely, a huge bet into a tiny
pot needs a strong hand. That ratio — `cost / (pot + cost)` — is the whole
mechanic. Everything else is deciding what "likely enough to win" means for a
given hand.

## What the code does today (and why the pot is invisible)

`handleAI` prices every decision against the bot's **own stack**:

```js
stakes = min(highBet − bet, chips) / (chips + bet + currentRoundChipsInvested)
```

The pot appears nowhere. A 2,000 call is the same decision into a 200 pot as
into a 20,000 pot. This is why a single large flop overbet still folds out
every bot below two pair regardless of how bloated the pot is — the one
remaining reliable exploit.

**Implementation trap #1 — the live pot is split across two places.**
`state.pot` only contains chips swept by `reconcilePot` at *street ends*;
bets made during the current street live on `player.bet`. At decision time:

```js
const livePot = state.pot + state.players.reduce((sum, p) => sum + p.bet, 0);
```

Using `state.pot` alone undercounts by the entire current street (pre-flop it
would be 0 while the blinds and raises sit on `player.bet`).

**Implementation trap #2 — the pinned tests encode the current formula.**
Most `ai.test.js` fixtures leave opponents' `bet` at 0 and set `highBet` at
the state level only, so under the new formula their `livePot` is ~0 and
`potOdds` ≈ 1 (maximum pressure) — several existing tests will flip. That's
correct behavior, handled with the same discipline as the bug fixes: update
fixtures to carry realistic opponent bets (`P1.bet = highBet`), and flip
expectations deliberately in the same PR.

## Design

### Inputs (all already available in `handleAI`)

```js
const costToRemain = Math.min(highBet - activePlayer.bet, activePlayer.chips); // exists
const livePot = state.pot + state.players.reduce((sum, p) => sum + p.bet, 0);  // new
const potOdds = costToRemain / (livePot + costToRemain || 1);                  // 0..1
```

Edge cases: checking is free (`costToRemain` 0 → potOdds 0 → no effect, same
as today); the `|| 1` guards the unopened-pot 0/0; all-in cost capping is
already handled by `costToRemain`, and pot odds *should* use the capped cost —
that is the real price.

### Option A (recommended first): pot-odds multiplier on stakes

Keep the tier architecture; scale the stakes percentage before classification:

```js
// Pure, exported, unit-testable — same pattern as clampBetToLegalRange.
// Cheap calls (small cost relative to the pot) discount perceived stakes;
// overbets inflate them. Anchor: potOdds 0.33 (a pot-sized bet) is neutral.
const potOddsMultiplier = (potOdds) => {
	if (potOdds <= 0.15) return 0.5;   // getting > 5.5:1 — peel cheaply
	if (potOdds <= 0.25) return 0.75;
	if (potOdds <= 0.40) return 1.0;   // normal bet sizing — today's behavior
	if (potOdds <= 0.55) return 1.25;  // overbet territory
	return 1.5;                        // huge overbet into a small pot
};

const investmentRequiredToRemain =
	(costToRemain / totalInvestment) * 100 * potOddsMultiplier(potOdds);
```

Why this shape:

- **One integration point.** Only the stakes number changes; `classifyStakes`,
  every determinant table, `willRaise`, and the raise path are untouched.
- **Neutral by construction at typical sizing**, so the change is a targeted
  behavioral delta: bots peel small stabs more (correct and fun) and respect
  overbets more (kills the "small pot, huge shove" line being *underpriced*…
  while the big-pot version gets called down, killing the other half of the
  exploit).
- The step table is a starting point for tuning — a continuous curve
  (`0.5 + 2.5 × potOdds`, clamped) is equivalent and smoother; pick during
  play-testing.

Scope: `ai.js` only. Effort ~1 day including fixture updates and tuning sims
(the scratchpad tally harness from the board-blindness analysis is the right
tool — measure fold/call/raise across a bet-size × pot-size grid before and
after).

### Option B (destination): equity-threshold calling

Replace the call/fold half of the tier system for post-flop decisions:

```js
call iff estimatedEquity(hand, draws) >= potOdds + margin
```

with a crude equity table (board-participating two pair ≈ 0.7, top pair
≈ 0.5, air ≈ 0.1, …) and — the real payoff — **draw equities**: a flush draw
≈ 0.35 with two cards to come, ≈ 0.18 with one (the 4-and-2 rule falls out
naturally). This is where draw awareness (AI_IMPROVEMENTS.md P5-adjacent)
belongs: draws vs price is the textbook pot-odds decision, and it slots into
option B for free while it fits option A awkwardly.

Costs: replaces `callLimit` semantics post-flop (bigger blast radius), needs
the attribution work as an input (equity of a board-played hand is mostly
chop), and honest equity is fiction without opponent modeling — the table is
a heuristic wearing a principled hat. Do it after option A has proven the
plumbing and P1/P2 have settled the baseline.

### Follow-up in the same area: pot-relative raise sizing

`decideBetProportion(tier) × chips` sizes bets by stack, so a deep bot
"stabs" 3,000 into a 60-chip pot. Once `livePot` exists, sizing becomes
`proportionOfPot(tier) × livePot` (½-pot / ⅔-pot / pot / overbet bands),
clamped by `clampBetToLegalRange` as today. Small change, large feel
improvement, and it makes the bots' own bets carry readable information.
Separate commit from the calling change so each can be tuned independently.

## Test plan

1. **Unit**: `potOddsMultiplier` curve (exported pure function) — boundaries,
   monotonicity; add its tiers to the determinant-integrity style guards.
2. **Black-box flip pairs**: same hand, same bet, small pot vs big pot —
   assert fold vs call. E.g. top pair facing 2,000: into a 500 pot (potOdds
   0.8 → inflated stakes → fold), into an 8,000 pot (potOdds 0.2 →
   discounted → call).
3. **Fixture realism pass**: opponents' `bet` fields populated to match
   `highBet` across `ai.test.js`; every expectation change reviewed
   deliberately (the KNOWN-BUG-flip discipline).
4. **Behavior grid sim** (scratchpad, not committed): fold/call/raise rates
   across bet-size × pot-size × hand-strength, before/after, pasted into the
   PR description.

## Definition of done

- A pot-sized bet plays exactly like today (neutral anchor verified by test).
- A ≤ ⅙-pot stab no longer folds out No Pair bots at the old rate.
- An overbet shove into a dry pot folds out weak pairs *more* than today,
  while the same shove into a bloated pot gets called by made hands.
- All suites green; behavior grid attached to the PR.
