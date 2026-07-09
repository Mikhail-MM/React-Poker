# React-Poker — Game Loop & Showdown Design Doc

This document maps the runtime logic of the game: how the loop is driven, how betting
and pots are reconciled, and — in the most detail — how the showdown/side-pot system
resolves multi-way, capped-stack pots. Everything described here was verified by
executing the actual source modules against mocked state (see
[Appendix A](#appendix-a--simulation-verified-behavior)). Bugs discovered along the
way are catalogued in [§9](#9-bugs--quirks-verified-unless-noted).

Source layout:

| File | Role |
|---|---|
| `src/App.jsx` | React class component; owns all state; drives the loop via `setState` callbacks + `setTimeout` |
| `src/utils/cards.js` | Deck, dealing, hand evaluation, showdown resolution, comparators |
| `src/utils/bet.js` | Bet/fold handling, phase shifting, pot reconciliation, side-pot construction |
| `src/utils/players.js` | Table generation, turn order, round transitions, win check |
| `src/utils/ai.js` | Rule-based AI decisions |
| `src/utils/ui.js` | Presentational helpers (button text, messages, slider) |

---

## 1. Architecture at a glance

The game is a **synchronous state-transformer pipeline wrapped in a React class
component**. There is no reducer, store, or event queue. Instead:

1. `App` holds the entire game state in `this.state`.
2. Every player action (human click or AI decision) deep-clones the state
   (`cloneDeep`), hands the clone to a chain of utility functions that **mutate the
   clone freely and return it**, and commits the result with a single `setState`.
3. The `setState` callback re-arms the loop: if the new `activePlayerIndex` is a
   robot and the phase isn't `showdown`, a `setTimeout(handleAI, 1200)` is scheduled.
   If it's the human, nothing is scheduled — the loop **parks** until a button click.

So the "game loop" is really a *chain of self-scheduling state transitions*:

```
human click ──► handleBet/handleFold ─┐
                                      ├─► cloneDeep(state) ─► transform cascade ─► setState ─► callback
setTimeout ───► App.handleAI ─────────┘                                                  │
     ▲                                                                                   │
     └──────────────── if active player is robot && phase !== 'showdown' ────────────────┘
```

A single action can cascade through many transforms *synchronously* — e.g. a call
that closes the river betting round flows through
`handleBet → determineNextActivePlayer → handlePhaseShift → reconcilePot → showDown →
distributeSidePots` before one `setState` commits everything. This is why the app is
"limited to discrete play phases": each commit lands on a phase boundary, and there
is no way to pause mid-cascade for an animation beat.

### Key invariant

`player.chips + player.bet` is a player's total liquid stack at any moment. Chips
move: `chips → bet` (during a betting round) `→ pot` + `sidePots[].potValue`
(at `reconcilePot`) `→ winner.chips` (at `payWinners`). Chip conservation holds
across the full pipeline, verified by simulation and enforced by the test
suites. (Historically the odd-chip remainder of split pots accumulated in
`state.pot` forever — bug #3, fixed 2026-07-09: the first winner takes the
remainder and every pot drains to 0.)

---

## 2. State shape

### App-level state (`App.jsx:53`)

| Field | Type | Notes |
|---|---|---|
| `loading` | bool | Gates on table-image XHR + `generateTable()` (randomuser.me fetch for AI avatars) |
| `winnerFound` | bool | One player owns all chips → `<WinScreen/>` |
| `players` | Player[] | See below. Broke players are physically removed between rounds |
| `numPlayersActive` | int | Not folded (all-in players still count as active) |
| `numPlayersFolded` / `numPlayersAllIn` | int | Counters consulted by `determineNextActivePlayer` |
| `activePlayerIndex` | int | Whose turn; also reused as a cursor while dealing |
| `dealerIndex`, `blindIndex {big, small}` | int | Positions. SB = dealer+1, BB = dealer+2 |
| `deck` | Card[] | `{cardFace, suit, value}`; `value` is `VALUE_MAP` 1–13 (**2→1 … A→13, so a Ten is `9`**) |
| `communityCards` | Card[] | 0/3/4/5 cards |
| `pot` | int | Display total. Filled by `reconcilePot`, fully drained by `payWinners` (split remainders go to the first winner), and reset to 0 by `beginNextRound` |
| `sidePots` | `{potValue, contestants: name[]}[]` | The bucketed pot system. Accumulates across betting rounds, condensed on each reconcile |
| `highBet` | int | Current bet to match. Reset to 0 each phase (post-flop rounds open with checking allowed) |
| `minBet`, `betInputValue` | int | Slider/validation bookkeeping |
| `phase` | string | `loading → initialDeal → betting1 → betting2 → betting3 → betting4 → showdown` |
| `playerHierarchy` | (entry \| entry[])[] | Full ranking of all non-folded players for the showdown UI; ties are nested arrays |
| `showDownMessages` | `{users, prize, rank}[]` | One per side-pot payout |
| `playerAnimationSwitchboard` | obj | Per-seat `{isAnimating, content}` for action bubbles (React-Transition-Group) |
| `playActionMessages` | [] | **Dead — declared, never used** |
| `clearCards` | bool | Set on "Next Round" to unmount cards so deal animations re-trigger |

### Player object (`players.js:8`)

| Field | Notes |
|---|---|
| `id`, `name`, `avatarURL`, `robot` | `name` doubles as the **join key** everywhere (side-pot contestants, hierarchy, refunds). The `id`/UUID is never used — a duplicate name from randomuser.me would corrupt payouts |
| `cards` | 2 hole cards |
| `chips`, `bet` | `bet` = chips committed *this betting round only* |
| `allIn`, `folded` | Flags; `allIn` set when `chips` hits exactly 0 in `handleBet` |
| `betReconciled` | **The betting-round terminator flag** — see §4 |
| `sidePotStack` | Scratch field: copy of `bet` consumed by `calculateSidePots` |
| `roundStartChips`, `roundEndChips` | For the ± earnings display on the showdown screen |
| `currentRoundChipsInvested` | Written in `reconcilePot`, **never read** (dead) |
| `stackInvestment` | Read by AI pot-odds math, **never incremented** (dead — always 0) |
| `canRaise` | Written by AI, **never read** (dead) |
| `showDownHand` | `{hand, descendingSortHand, heldRankHierarchy, bestHandRank, bestHand, bools}` — filled by `showDown()` |

### Phase machine

```mermaid
stateDiagram-v2
    [*] --> loading
    loading --> initialDeal : componentDidMount (table + blinds ready)
    initialDeal --> betting1 : dealPrivateCards (2 to each, UTG acts)
    betting1 --> betting2 : all reconciled → reconcilePot + dealFlop
    betting2 --> betting3 : reconcilePot + dealTurn
    betting3 --> betting4 : reconcilePot + dealRiver
    betting4 --> showdown : reconcilePot + showDown
    betting1 --> showdown : early exit (folds / all-ins)\ndealMissingCommunityCards + reconcilePot + showDown
    betting2 --> showdown : early exit
    betting3 --> showdown : early exit
    showdown --> betting1 : Next Round → beginNextRound
    showdown --> [*] : checkWin → WinScreen
```

Note: `handlePhaseShift` briefly sets `phase` to `'flop'`/`'turn'`/`'river'`, but
`dealFlop/Turn/River` overwrite it to `betting2/3/4` within the same synchronous
transform — those intermediate values are never observable by React.

---

## 3. Bootstrap (`App.componentDidMount`, `App.jsx:90`)

1. `generateTable()` — human + 4 AI players (AI identities fetched from
   randomuser.me; 18k–20k random stacks, human gets 20k).
2. Random `dealerIndex`; blinds computed (`determineBlindIndices`) and posted
   (`anteUpBlinds` — blind amounts are moved into `player.bet`, not the pot).
3. Deck generated and shuffled.
4. `setState(...)` then **immediately** `runGameLoop()`, which reads `this.state`.
   This only works because `componentDidMount` is `async` — the `setState` happens in
   a promise continuation, outside React 16's batching, so it flushes synchronously.
   Under React 18 automatic batching `runGameLoop` would read stale (null-player)
   state and crash. Fragile by accident (bug #10).
5. `runGameLoop → dealPrivateCards` (`cards.js:102`): deals one card at a time
   starting at the dealer until everyone has 2 (staggered `animationDelay` +250ms per
   card), then sets `activePlayerIndex = BB + 1` (UTG) and `phase = 'betting1'`.
6. `setState` callback arms the AI timer if UTG is a robot.

---

## 4. The betting round

### `betReconciled` semantics

The whole turn system hangs on this one flag:

- Set **true** when a player acts (`handleBet`, `handleFold`).
- Reset to **false** for every non-folded player when someone *raises*
  (`handleBet`, `bet.js:38-47`) — they must respond to the new price.
- Reset to **false** for everyone at each phase boundary (`reconcilePot`).
- **A betting round is over when the turn cursor lands on a player whose
  `betReconciled` is already true** — meaning action returned to someone with
  nothing left to do.

### `determineNextActivePlayer` (`players.js:109`) — the turn cursor

Called after every action; walks the seat ring and either returns state (next actor
found — UI/AI takes over) or short-circuits the rest of the hand:

```mermaid
flowchart TD
    A[advance index, wrap around] --> B{numPlayersActive === 1?}
    B -- yes --> SD[dealMissingCommunityCards<br/>reconcilePot → showDown]
    B -- no --> C{player folded?}
    C -- yes --> A
    C -- no --> D{all-but-one all-in AND<br/>player betReconciled?}
    D -- yes --> SD
    D -- no --> E{player chips === 0?}
    E -- yes --> F{everyone all-in? or<br/>all-but-one and this one is?}
    F -- yes --> SD
    F -- no --> A
    E -- no --> G{betReconciled?}
    G -- yes --> H[handlePhaseShift:<br/>reconcilePot + deal next street]
    G -- no --> I[return state — this player acts]
```

Poker-rules deviation worth knowing: when everyone folds to one player
(`numPlayersActive === 1`), the code still runs out the full board and goes through
the entire showdown machinery — the lone survivor's hole cards are evaluated and
revealed on the showdown screen instead of the hand ending immediately with a mucked
win.

`handlePhaseShift` (`bet.js:73`) maps `betting1→dealFlop`, `betting2→dealTurn`,
`betting3→dealRiver`, `betting4→showDown`, always via `reconcilePot` first. Each
`deal*` calls `determinePhaseStartActivePlayer` (`players.js:89`): first non-folded,
non-broke player left of the big blind opens every post-flop street.

---

## 5. Pot reconciliation & the side-pot system

`reconcilePot` (`bet.js:95`) runs at **every phase boundary** (flop, turn, river,
showdown, and early-showdown paths):

1. For each player: `pot += bet`; `sidePotStack = bet` (scratch copy);
   `betReconciled = false`.
2. `calculateSidePots(state, players)` — the bucketing recursion (below).
3. `condenseSidePots(state)` — merge pots with identical contestant sets.
4. For each player: `bet = 0`.
5. `highBet = minBet = betInputValue = 0` — post-flop rounds open with checks free.

### `calculateSidePots` (`bet.js:132`) — recursive bucketing

Each recursion level slices one "layer" off the bet stacks, from the shortest stack
up:

1. Filter to players with `sidePotStack > 0`.
   - **0 left** → done.
   - **Exactly 1 left** → their remainder is an *uncalled* bet: refund it to their
     chips, subtract from `pot`, done.
2. Sort ascending by `sidePotStack`; take the smallest value `S`.
3. Build one pot: every invested player contributes `S` (subtracted from their
   `sidePotStack`); `potValue = S × count`. **Folded players' chips are included in
   the pot value (dead money) but they are excluded from `contestants`.**
4. Recurse on the remaining stacks.

Worked trace (verified — Appendix A, scenario 1). Bets this round: Alice 200
(all-in), Bob 800, Carol 800, Dave 600 (all-in), Eve 100 (folded):

| Level | Stacks in play | Layer | Pot built | Contestants |
|---|---|---|---|---|
| 1 | Eve 100†, Alice 200, Dave 600, Bob 800, Carol 800 | 100 | 100×5 = **500** | Alice, Dave, Bob, Carol (Eve = dead money) |
| 2 | Alice 100, Dave 500, Bob 700, Carol 700 | 100 | 100×4 = **400** | Alice, Dave, Bob, Carol |
| 3 | Dave 400, Bob 600, Carol 600 | 400 | 400×3 = **1200** | Dave, Bob, Carol |
| 4 | Bob 200, Carol 200 | 200 | 200×2 = **400** | Bob, Carol |
| 5 | — | | | terminate |

### `condenseSidePots` (`bet.js:181`)

Pots with set-identical contestant lists are merged (order-insensitive via
`arrayIdentical`). Two purposes: merges the intra-round layers above (levels 1+2 →
one 900 pot with the same four contestants), and merges *cross-round* pots — since
`sidePots` accumulates across betting streets, a flop pot and a turn pot with the
same live players collapse into one, so the expensive comparator machinery runs once
per contestant set at showdown. Final pots for the trace:
`[{900: A,D,B,C}, {1200: D,B,C}, {400: B,C}]`.

---

## 6. Showdown

Entry: `showDown(state)` (`cards.js:166`), always preceded by `reconcilePot` (so all
chips are potted and bucketed) and, on early exits, `dealMissingCommunityCards`.

### 6.1 Per-player hand evaluation (`cards.js:167-245`)

For **every** player — including folded ones, whose results are computed and then
ignored — over the 7-card set (2 hole + 5 community), sorted descending:

1. **Histograms**: `frequencyHistogram` (by card face) and `suitHistogram` (by suit).
2. **Boolean battery**:
   - `checkFlush` — any suit count ≥ 5; keeps the flushed suit's cards (descending).
   - `checkRoyalFlush` — top five flush cards are exactly A-K-Q-J-10
     (*fixed 2026-07-09 — see bug #1*).
   - `checkStraightFlush` — `checkStraight` run over only the flush-suit cards.
   - `checkStraight` (`cards.js:948`) — scans the descending *unique-value set* for a
     run of 5; the ace-low wheel is handled by `checkLowStraight` (ace 13 → 0,
     re-sort ascending, look for 0-1-2-3-4).
   - `analyzeHistogram` (`cards.js:885`) — quads/trips/pairs; full house = two trips
     or trip+pair; two pair = ≥ 2 pairs. Emits `frequencyHistogramMetaData` with
     face/value of each pair/trip/quad, sorted descending.
3. **Rank selection**: the first `match: true` in a fixed best-to-worst list becomes
   `bestHandRank` (Royal Flush → … → No Pair).
4. **`buildBestHand`** (`cards.js:260`): materializes the exact best 5 cards for that
   rank — e.g. quads + best kicker; trips + top 2 kickers; for straights, one card
   per run value (first face match in the descending hand; suit irrelevant except in
   the straight-flush case, which searches only flush cards); the wheel is
   special-cased to come out as `5-4-3-2-A`.

The ordering of `bestHand` is load-bearing: **every comparator below indexes into it
positionally** (e.g. "card [0] is the quad, card [4] is the kicker").

### 6.2 Two parallel ranking systems

This is a notable design quirk: tie-breaking is implemented **twice**.

| | Display path | Money path |
|---|---|---|
| Entry | `buildAbsolutePlayerRankings` (`cards.js:414`) | `battleRoyale` per side pot (`cards.js:585`) |
| Input | all non-folded players | one pot's `contestants` |
| Tie-breaker | `determineContestedHierarchy` (`cards.js:476`) — recursive | `determineWinner` (`cards.js:804`) — iterative |
| Output | `state.playerHierarchy`: a full ordering of everyone (ties as nested arrays) | winner(s) of that pot only |

Both share `buildComparator` (`cards.js:642`).

### 6.3 `buildComparator` — the per-rank comparators

For a group of players holding the *same* rank, the comparator is an array of
**frames**; each frame holds one "card position to compare" per player, in the order
that decides that rank:

| Rank | Frames (compared in order) |
|---|---|
| Straight / Straight Flush / Royal Flush | 1: top card of the run (all royals hold the ace → tied royals split) |
| Four of a Kind | 2: quad value, kicker |
| Full House | 2: trip value, pair value |
| Three of a Kind | 3: trip, kicker 1, kicker 2 |
| Two Pair | 3: high pair, low pair, kicker |
| Pair | 4: pair, kicker 1, kicker 2, kicker 3 |
| Flush / No Pair | 5: every card |

(A malformed Royal Flush special case used to bypass this table entirely and
crashed on tied royals — removed 2026-07-09, see bug #1b.)

### 6.4 `determineContestedHierarchy` — full ordering with loser queue

Processes a comparator frame-by-frame ("rounds"):

- `processSnapshotFrame` splits a frame into a `winningFrame` (players holding the
  frame's max card value) and a `losingFrame`.
- Losers aren't discarded: the comparator is re-filtered to just the losers and
  **prepended** to a `loserHierarchy` queue (later-eliminated losers have better
  hands, so they must be ranked ahead of earlier-eliminated ones).
- Winners recurse into the next frame until one player remains (sole rank winner) or
  frames run out (true tie → nested array in the hierarchy).
- After the winners' recursion finishes, the loser queue is drained through the same
  machinery, appending 2nd, 3rd… place.

Verified trace (Appendix A, scenario 2): flushes Q-J-10-**9-4** (Carol),
Q-J-10-**8-3** (Bob), Q-J-10-**7-5** (Dan) → frames 1–3 all tie, frame 4 picks Carol
and banishes {Bob, Dan} to the loser queue, which replays and orders Bob over Dan on
their frame 4 → hierarchy `[Carol, Bob, Dan]`.

### 6.5 Paying the pots: `distributeSidePots` (`cards.js:396`)

```
distributeSidePots(state)
 ├─ state.playerHierarchy = buildAbsolutePlayerRankings(state)     // display
 ├─ for each sidePot (main pot first — insertion order):
 │    ├─ rankPlayerHands(state, sidePot.contestants)               // bucket by rank
 │    ├─ battleRoyale(state, rankMap, sidePot.potValue)
 │    │    └─ first non-empty rank bucket wins the pot:
 │    │         1 player  → payWinners (uncontested)
 │    │         2+ players → determineWinner(buildComparator(...)) → payWinners
 │    └─ payWinners: winner.chips += prize; state.pot -= prize
 │         ties: each gets floor(prize/n); the first winner takes the remainder (bug #3 fix)
 └─ every player: roundEndChips = chips                            // for ± display
```

`determineWinner` iterates frames like §6.4 but only keeps the running winners:
players below the frame's max are filtered out of *all* frames; loop ends when one
player remains or frames are exhausted (split pot).

This is exactly the behavior in your theoretical example, verified in scenario 1:
Alice (nut hand, all-in for 200) wins only the 900 main pot she's a contestant of;
Bob's higher flush beats Carol's for both remaining side pots (1200 + 400); Carol
and Dave lose their stakes; folded Eve's 100 was dead money inside the main pot.

---

## 7. Round transition & win condition

"Next Round" button → `App.handleNextRound` (`App.jsx:341`):

1. `setState({clearCards: true})` — unmounts card components so deal animations
   re-trigger next round.
2. `beginNextRound` (`players.js:223`): resets community cards, `sidePots`,
   `playerHierarchy`, `showDownMessages`, and `pot` (clean slate — bug #3 fix);
   fresh shuffled deck; blinds/bet markers back to 20.
3. `passDealerChip` (`players.js:152`): advance dealer to next player who still has
   chips, then `filterBrokePlayers`:
   - **removes** players with 0 chips from the array (indices shift — dealer index is
     re-found by name),
   - re-derives blind indices (special-cased heads-up: dealer posts small blind),
   - `anteUpBlinds` again (no short-stack handling — bug #9),
   - resets all per-round player fields, `roundStartChips = chips + bet`,
   - `dealPrivateCards` → `betting1`.
4. Back in `App`: `checkWin` — if only one player has chips, show `<WinScreen/>`
   (the freshly-dealt state from step 2-3 is discarded).

---

## 8. The AI (`ai.js:20`)

A single-function rule engine, no personality/memory (a `generatePersonality` exists
but is unused and broken). Decision inputs:

1. **Stakes**: `highBet / (chips + bet + stackInvestment) × 100` — i.e. what % of
   your remaining stack the call costs (`stackInvestment` is always 0, so it's
   percent-of-current-stack). `classifyStakes` buckets this into a 9-tier ladder:
   `blind < insignificant < lowdraw < meddraw < hidraw < strong < major < aggro < beware`
   (`BET_HIERARCHY` gives the ordering).
2. **Hand strength → determinant** `{callLimit, raiseChance, raiseRange}`:
   - Pre-flop (`buildPreFlopDeterminant`, `ai.js:249`): heuristics over
     high-card/low-card/suited/connected-gap, with pocket pairs graded
     premium/mid/low (bug #5 fixed 2026-07-09).
   - Post-flop (`buildGeneralizedDeterminant`, `ai.js:185`): keyed purely on current
     made-hand rank, computed by re-running the full §6.1 evaluation battery on
     every AI turn.
3. **Decision**:
   - Fold if `stakes > callLimit`.
   - Else roll `willRaise(raiseChance)`; on success pick a random tier from
     `raiseRange`, and if that tier still ≥ stakes, bet
     `floor(decideBetProportion(tier) × chips)` (each tier maps to a %-of-stack
     band, e.g. `beware` → 75–100%). The bet is then normalized by
     `clampBetToLegalRange` — lifted to `highBet`, capped at `max` — so an
     unaffordable raise becomes an all-in call (bug #2 fix; the uncapped lift
     used to freeze the game).
   - Otherwise call (capped at stack → all-in call).

(Historical note: until the bug #6 typo fixes of 2026-07-09, the post-flop AI
could only raise with a full house or better — everything else silently degraded
to call/fold.)

The AI turn is scheduled purely by the `setState`-callback + `setTimeout(1200ms)`
chain in `App` (`handleAI`, `handleBetInputSubmit`, `handleFold`, `runGameLoop`,
`handleNextRound` all repeat the same arming snippet).

---

## 9. Bugs & quirks (verified unless noted)

Numbered for cross-reference from the sections above. ✅ = reproduced by executing
the real code; 👁 = established by inspection.

1. ✅ **Royal flushes were never detected — detection FIXED 2026-07-09.**
   `checkRoyalFlush` (`cards.js:864`) required `flushCards[4].value === 10`, but in
   `VALUE_MAP` a Ten is `9` (J=10) — unsatisfiable, so royals classified as
   "Straight Flush". The check now expects `[13, 12, 11, 10, 9]`; royals are
   detected, ranked, and reported correctly (single-royal payout verified in
   `cards.showdown.test.js`).
   **1b. ✅ Residual — tied royals crashed the showdown — FIXED 2026-07-09.**
   The #1 fix unmasked this: `buildComparator`'s 'Royal Flush' branch seeded its
   winners list with `Array.from({length: 1})` = `[undefined]`, `determineWinner`
   returned it verbatim, and `payWinners` dereferenced `undefined.name` → a
   **board royal** (community A-K-Q-J-10 suited — every live player ties) killed
   the hand and would have miscounted the split (prize ÷ 3 for 2 winners). Fix:
   the Royal Flush special cases were **removed** rather than repaired — royals
   now flow through the standard Straight/Straight Flush comparator (single
   frame, top card; all royals hold the ace, so they always tie and split), the
   standard `determineWinner` loop (early return deleted), and the standard
   grouping in `buildAbsolutePlayerRankings` (tied royals now nest as a tie
   array like every other rank). Verified in `cards.showdown.test.js`; all other
   snapshots passed unchanged, confirming no behavioral drift outside the
   tied-royal path.
2. ✅ **The documented AI freeze — FIXED 2026-07-09** (`players.js:105` "final AI
   will freeze"). Mechanism, reproduced end-to-end before the fix: AI decides to
   raise while facing a `highBet` larger than its stack → `betValue` was clamped
   up to `highBet` with no `max` cap → `handleBet` rejects (`bet > max`) and
   returns `undefined` (`bet.js:33-36`) → `App.handleAI` (`App.jsx:222-224`)
   evaluates `newState.minBet` on `undefined` → TypeError inside the `setTimeout`
   callback → no further `setState` is ever scheduled → the game silently stops.
   Fix: both raise sites now normalize through `clampBetToLegalRange(betValue,
   highBet, max)` (`ai.js`) — lift the bet to the table price *first*, then cap
   it at the stack, so an unaffordable "raise" degrades into a legal all-in call
   (`min === max` in that situation per `determineMinBet`). Order matters;
   capping before lifting reintroduces the freeze. Verified in `ai.test.js`.
   **Residual, open by choice:** `handleBet` still returns `undefined` for
   out-of-range input (pinned in `bet.test.js`), so a future AI miscalculation
   would still be fatal for a robot. Deliberately not papered over with silent
   clamping — that would mask upstream bugs; if hardened later, prefer a
   descriptive throw at the rejection site.
3. ✅ **Odd-chip remainder was carried over but never claimable — FIXED
   2026-07-09.** Original design intent: a non-splittable remainder rides into
   the next hand's pot (an "odd chip carries" house rule), and `beginNextRound`
   preserved `pot` accordingly. The defect was downstream: payouts flow
   exclusively through `sidePots[].potValue`, which are built from each round's
   bets alone, so the carried chip was invisible to the payout machinery —
   verified across two consecutive hands, the remainder was never paid to
   anyone and the pot display drifted up monotonically while chips permanently
   left the table economy. **Fix (card-room rule, chosen for simplicity over
   implementing the carryover):** `payWinners` now awards the indivisible
   remainder to the first winner at split time, so every pot fully drains to 0
   at the end of the hand, and `beginNextRound` explicitly resets `pot = 0`
   (clean slate — anything left there would be unclaimable by construction).
   Chip conservation now holds unconditionally. Verified in
   `cards.showdown.test.js` (two- and three-way odd splits) and
   `players.test.js`. Note: the split showdown message reports the per-winner
   floor share; the extra chip is not called out in the UI.
4. 👁 **Boolean-vs-number comparison in raise un-reconciliation.**
   `if (!player.folded || !player.chips === 0)` (`bet.js:43`): `!player.chips === 0`
   compares a boolean to a number — always false — so the condition is just
   `!player.folded`. All-in players are marked unreconciled on every raise; mostly
   masked because the turn cursor skips `chips === 0` players.
5. ✅ **Pocket pairs mis-evaluated pre-flop — FIXED 2026-07-09.**
   `buildPreFlopDeterminant` used `switch(highCard)` with boolean case labels
   (`case (highCard > 8)`) — a number never matches a boolean, so every pocket
   pair fell to the default branch and pocket aces got the same mediocre
   determinant as deuces (verified: aces folded to an 80%-of-stack bet). Fix:
   converted to a plain if-chain grading pairs into premium (10s+, `beware`,
   0.9 raise chance), mid (7s–9s, `aggro`, 0.75), and low (`aggro`, 0.5)
   buckets. Verification of the conversion caught a boundary hole: the final
   branch was `else if (highCard < 5)`, leaving a pair of *sixes* (value 5)
   returning `undefined`, which `handleAI` destructures — a crash roughly once
   per ~55 hands with four bots. Closed by making it a plain `else` (the
   original switch's `default` semantics); the determinant-integrity suite is
   what caught it, exactly as designed. The same broken `switch(value)
   case(boolean)` pattern still exists in the unused `generatePersonality`
   (`players.js:61`) — dead code, see #12.
6. ✅ **Post-flop AI raise logic was largely disabled by typos — FIXED
   2026-07-09.** In `buildGeneralizedDeterminant`, the Flush, Straight, Three of
   a Kind, Two Pair, Pair and No Pair branches returned `raiseChange` (sic)
   instead of `raiseChance` → `willRaise(undefined)` was always false; several
   `raiseRange` arrays also contained the single malformed string
   `'hidraw, strong'` whose `BET_HIERARCHY` lookup is `undefined`, disabling
   that tier. Net effect was that only Full House or better could ever raise
   post-flop. Both typo families are fixed; a determinant-integrity suite in
   `ai.test.js` now asserts every determinant carries a numeric `raiseChance`
   and only tiers that exist in `BET_HIERARCHY`, so this bug class cannot
   silently return. Expect noticeably more aggressive bots.
7. ✅ **Missing braces at the pre-flop raise site — GONE 2026-07-09.** The
   braceless `if (betValue > max)` guarded only `activePlayer.canRaise = false`
   while the next two lines always ran. Removed wholesale by the bug #2 clamp
   refactor (`canRaise` is now set unconditionally on the raise path; the flag
   itself remains dead — see #12).
8. 👁 **`condenseSidePots` mutates during iteration** (`bet.js:181-193`): removing
   index `n` shifts later pots down while `n++` still advances, skipping the merge
   of a third consecutive identical-contestant pot. Currently unreachable (at most
   2 identical pots can coexist between condense passes), and even if hit, payouts
   would stay correct — the same winner would just be paid from two pots with a
   duplicate message.
9. 👁 **Blinds don't handle short stacks** (`anteUpBlinds`, `bet.js:11`): posting is
   unconditional subtraction — a player with fewer chips than the blind goes
   *negative*, and a player put all-in by the blind doesn't get `allIn`/counter
   updates (acknowledged at `players.js:216`).
10. 👁 **Bootstrap relies on unbatched `setState`** (`App.jsx:136-154`): see §3.
    Breaks under React 18 automatic batching.
11. 👁 Minor dead/misleading code: `determineWinner`'s `i === comparator.length`
    (`cards.js:833`) can never be true inside the loop; `checkStraight` returns bare
    `false` for short value sets (`cards.js:949`) and callers destructure it —
    legal, but every field comes back `undefined`; the "This mutates
    showDownHand.hand in place(!!)" comment (`cards.js:172`) is wrong (`.map(el =>
    el)` copies before sorting); `popCards` returns a lone object for 1 card but an
    array otherwise, which is why the duplicate `popShowdownCards` exists
    (acknowledged at `cards.js:83-88`).
12. 👁 **Dead state**: `stackInvestment` (AI pot-odds intends stack-across-rounds
    but is never incremented), `canRaise`, `currentRoundChipsInvested`,
    `playActionMessages`, `generatePersonality`, and the player `id` (names are the
    real join key — duplicate names from randomuser.me would corrupt payouts and
    refunds).
13. 👁 `shuffle` (`cards.js:45`) is O(n²) rejection sampling rather than
    Fisher-Yates. Uniform, just wasteful.
14. 👁 Folded players still get full hand evaluation in `showDown` (wasted work),
    and a lone remaining player still triggers a full board runout + showdown +
    card reveal (§4).

---

## 10. Architectural weaknesses & refactor notes

Restating the known weaknesses with what this mapping implies about each:

**Loose typing.** The bug census above is a strong TypeScript sales pitch: #2
(functions that return `state | undefined`), #6 (`raiseChange` typo — unknown
property on a return type), #6b (`'hidraw, strong'` — not a member of a
`BetTier` union), #11 (`popCards`' union return shape), #4 (boolean/number
comparison) are all compile-time catches. The `VALUE_MAP` off-by-face confusion
behind #1 (Ten = 9) is exactly the kind of thing a branded `CardValue` type plus
tests would have surfaced.

**No tests.** *(Since addressed — see below.)* The state transformers are already
*nearly pure* — `App` clones state and the utils mutate only the clone — so the
simulation harness used for this doc required zero refactoring, only stubbing
`axios`/`uuid` imports. That harness has been converted into characterization
suites (`src/utils/*.test.js`, factories in `src/testUtils/factories.js`, run via
`CI=true yarn test`): every scenario in Appendix A and every bug in §9 marked
`KNOWN BUG` is pinned by a test asserting *current* behavior. When a bug is fixed,
its test is meant to be flipped intentionally in the same change. The plan for
evolving this further — cascade seam tracing, an explicit transition log, a
reducer/driver architecture, Immer patch-level time travel, and property-based
pot testing — lives in [TESTING_ROADMAP.md](./TESTING_ROADMAP.md).

**Implicit render-loop state machine.** Because each action is
`(state) → newState` already, migrating to a reducer is mostly mechanical:
actions like `BET`, `FOLD`, `NEXT_ROUND` dispatching into the existing transformer
chains would immediately buy time-travel debugging. The main obstruction is the
side-channel scheduling: the `setState`-callback + `setTimeout` AI chain and the
`pushAnimationState` callback threaded *into* `ai.js` (a state transformer that
imperatively fires UI animations mid-transform). Those would need to become
middleware/effects.

**Discrete phases vs. animations.** The deeper issue this doc makes visible: a
single click can synchronously traverse *multiple* conceptual beats (call → pot
reconcile → deal river → showdown) and commit them as one render. There is no
intermediate state for an animation system to attach to. React-Transition-Group can
only animate the diff between "before click" and "after cascade". Fixing this means
breaking the cascade into a queue of steps (each its own committed state) — which
dovetails with the reducer refactor: emit a list of effects/steps from the pure
logic, let a driver (or saga/XState machine) commit them on a timeline the animation
layer can key off.

---

## Appendix A — Simulation-verified behavior

The actual `bet.js`/`cards.js`/`players.js` modules were executed under Node
(imports shimmed, logic untouched) against mocked pre-showdown states.

**Scenario 1 — capped all-in, dead money, 3 side pots** (the canonical example).
Board 10♥ J♥ Q♥ 2♠ 7♦. Alice A♥K♥ all-in 200 (royal flush — reported as Straight
Flush until the bug #1 fix, now detected correctly); Bob 8♥3♥ (flush, 8 kicker) bet
800; Carol 5♥4♥ (flush, 5 kicker) bet 800; Dave 2♦7♣ (two pair) all-in 600; Eve
folded 100.

- Pots built: `[{900: Alice,Dave,Bob,Carol}, {1200: Dave,Bob,Carol}, {400: Bob,Carol}]` — layer trace in §5.
- Payouts: Alice +900 (net **+700** on a 200 stake despite the nut hand — correctly capped), Bob +1600 (net +800), Carol −800, Dave −600, Eve −100. `state.pot` drained to exactly 0.
- Hierarchy: Alice > Bob > Carol > Dave (Eve excluded as folded).

**Scenario 2 — kicker cascade.** Three flushes sharing Q♥J♥10♥, split on 4th/5th
cards. Hierarchy resolved `Carol > Bob > Dan` via the loser-queue recursion (§6.4);
Carol took the whole 1500 pot.

**Scenario 3 — exact tie + odd chip.** Both live players play the board straight
9-8-7-6-5; pot 801 (51 dead money from a folder). Result: tie detected, nested-array
hierarchy, 400 paid to each, **1 chip stranded in `state.pot`** (bug #3).
*(Fixed 2026-07-09: the first winner now takes the odd chip — 401/400 — and the
pot drains to 0.)*

**Scenario 4 — AI freeze repro.** Heads-up, opponent all-in for 5000, AI stack 1000
holding a full house, RNG forced to the raise path: `handleAI` returned `undefined`
and the `App.handleAI` continuation threw `Cannot read properties of undefined
(reading 'minBet')` — the exact freeze from `players.js:105` (bug #2).
*(Fixed 2026-07-09: the same setup now produces a 1000-chip all-in call and the
hand continues — see the flipped test in `ai.test.js`.)*
