# Changelog

The historical record for the game logic, AI, tests, and documentation: what
changed, when, and why. The main documents ([GAME_LOOP.md](./GAME_LOOP.md),
[TESTING_ROADMAP.md](./TESTING_ROADMAP.md),
[AI_IMPROVEMENTS.md](./AI_IMPROVEMENTS.md),
[POT_ODDS_PLAN.md](./POT_ODDS_PLAN.md)) describe the **current** state of the
application; the history they used to carry inline lives here.

**Numbering contract:** the bug/quirk census numbers (#1–#14) are shared with
GAME_LOOP.md §9. Open entries live there; resolved entries live here in full.
Numbers are stable and never reused.

---

## Resolved bugs & quirks

### #1 — Royal flushes were never detected · fixed 2026-07-09

`checkRoyalFlush` (`cards.js`) required `flushCards[4].value === 10`, but in
`VALUE_MAP` a Ten is `9` (J=10) — unsatisfiable, so a genuine royal flush
always classified as "Straight Flush". Payouts stayed correct (the straight
flush comparator still won on top card), but the UI reported the wrong rank
and the bug masked #1b below. **Fix:** the check now expects
`[13, 12, 11, 10, 9]`; royals are detected, ranked, and reported correctly.
Single-royal payout verified in `showdown.test.js`.

### #1b — Tied royals crashed the showdown · fixed 2026-07-09

Unmasked by the #1 fix: `buildComparator`'s 'Royal Flush' branch seeded its
winners list with `Array.from({length: 1})` = `[undefined]`,
`determineWinner` returned it verbatim, and `payWinners` dereferenced
`undefined.name` — so a **board royal** (community A-K-Q-J-10 suited, every
live player ties) killed the hand, and the phantom entry also miscounted the
split (prize ÷ 3 for 2 winners). **Fix:** the Royal Flush special cases were
*removed* rather than repaired — royals flow through the standard
Straight/Straight Flush comparator (single frame, top card; all royals hold
the ace, so they always tie and split), the standard `determineWinner` loop
(early return deleted), and the standard grouping in
`buildAbsolutePlayerRankings` (tied royals nest as a tie array like every
other rank). All 41 snapshots passed unchanged after the removal, confirming
no behavioral drift outside the tied-royal path.

### #2 — The AI freeze · fixed 2026-07-09

The `players.js` comment "final AI will freeze," reproduced end-to-end: the
AI decides to raise while facing a `highBet` larger than its stack →
`betValue` was clamped up to `highBet` with no `max` cap → `handleBet`
rejects (`bet > max`) and returns `undefined` → `App.handleAI` evaluates
`newState.minBet` on `undefined` → TypeError inside the `setTimeout` callback
→ no further `setState` is ever scheduled → the game silently stops.
**Fix:** both raise sites normalize through
`clampBetToLegalRange(betValue, highBet, max)` (`ai.js`) — lift the bet to
the table price *first*, then cap it at the stack, so an unaffordable "raise"
degrades into a legal all-in call (`min === max` in that situation per
`determineMinBet`). Order matters; capping before lifting reintroduces the
freeze. Verified in `ai.test.js`.

*Residual (still open, by choice):* `handleBet` returning `undefined` for
invalid input remains — tracked as **#2-residual** in GAME_LOOP.md §9.

### #3 — Odd-chip remainder was carried over but never claimable · fixed 2026-07-09

Original design intent: a non-splittable split-pot remainder rides into the
next hand's pot (an "odd chip carries" house rule), and `beginNextRound`
preserved `pot` accordingly. The defect was downstream: payouts flow
exclusively through `sidePots[].potValue`, which are built from each round's
bets alone, so the carried chip was invisible to the payout machinery —
verified across two consecutive hands, the remainder was never paid to anyone
and the pot display drifted up monotonically while chips permanently left the
table economy. **Fix (card-room rule, chosen for simplicity over completing
the carryover):** `payWinners` awards the indivisible remainder to the first
winner at split time, so every pot fully drains to 0 by the end of the hand,
and `beginNextRound` explicitly resets `pot = 0`. Chip conservation now holds
unconditionally. Verified in `showdown.test.js` (two- and three-way odd
splits) and `players.test.js`. The split showdown message reports the
per-winner floor share; the extra chip is not called out in the UI.

### #5 — Pocket pairs mis-evaluated pre-flop · fixed 2026-07-09

`buildPreFlopDeterminant` used `switch(highCard)` with boolean case labels
(`case (highCard > 8)`) — a number never matches a boolean, so every pocket
pair fell to the default branch and pocket aces got the same mediocre
determinant as deuces (verified: aces folded to an 80%-of-stack bet).
**Fix:** converted to a plain if-chain grading pairs into premium (10s+,
`beware`, 0.9 raise chance), mid (7s–9s, `aggro`, 0.75), and low (`aggro`,
0.5) buckets. Verification of the conversion caught a boundary hole: the
final branch was `else if (highCard < 5)`, leaving a pair of *sixes*
(value 5) returning `undefined`, which `handleAI` destructures — a crash
roughly once per ~55 hands with four bots. Closed by making it a plain `else`
(the original switch's `default` semantics). The determinant-integrity suite
caught the hole, exactly as designed. The same broken
`switch(value) case(boolean)` pattern still exists in the unused
`generatePersonality` — dead code, tracked under §9 #12.

### #6 — Post-flop AI raise logic was largely disabled by typos · fixed 2026-07-09

In `buildGeneralizedDeterminant`, the Flush, Straight, Three of a Kind, Two
Pair, Pair and No Pair branches returned `raiseChange` (sic) instead of
`raiseChance` → `willRaise(undefined)` was always false; several `raiseRange`
arrays also contained the single malformed string `'hidraw, strong'` whose
`BET_HIERARCHY` lookup is `undefined`, disabling that tier. Net effect: only
Full House or better could ever raise post-flop — the passive bots everyone
was used to were an accident. **Fix:** both typo families corrected; a
determinant-integrity suite in `ai.test.js` asserts every determinant carries
a numeric `raiseChance` and only tiers that exist in `BET_HIERARCHY`, so this
bug class cannot silently return. This is the most behavior-visible fix of
the census — the bots became dramatically more aggressive (see
AI_IMPROVEMENTS.md for the follow-on analysis).

### #7 — Missing braces at the pre-flop raise site · gone 2026-07-09

The braceless `if (betValue > max)` guarded only
`activePlayer.canRaise = false` while the next two lines always ran. Removed
wholesale by the #2 clamp refactor (`canRaise` is set unconditionally on the
raise path now; the flag itself remains dead — §9 #12).

---

## Feature changes

### Pot commitment wired into AI stakes · 2026-07-09

The "stackInvestment" feature was 90% built all along: `reconcilePot` had
always accumulated each street's bets into `currentRoundChipsInvested` (reset
per hand), but the AI read the never-written `stackInvestment` field instead.
Stakes are now `min(highBet − bet, chips) / (chips + bet +
currentRoundChipsInvested)` — the cost to call, capped at the stack, against
the hand-start stack. This fixed three compounding fold-pressure errors that
made multi-street bluffing the dominant exploit: the shrinking-denominator
effect (every chip invested made the same bet read a higher stakes tier —
inverse pot commitment), the full-`highBet` numerator (overstating the price
whenever the bot was partially in), and the uncapped shove (reading an
oversized all-in as more than the bot could actually lose). All fresh-street
behavior is provably unchanged (the new formula degenerates to the old one
when nothing is invested). Play-testing afterwards surfaced the evaluator's
board-blindness — analyzed in AI_IMPROVEMENTS.md; the untuned hyper-aggressive
AI is deliberately kept for entertainment until that track begins.

### Split-pot house rule · 2026-07-09

Decided with #3: the first winner takes the indivisible remainder (standard
card-room practice) rather than carrying odd chips to the next hand. Chosen
for maintainability — the invariant "the pot is always 0 when a hand ends"
holds by construction.

---

## Timeline

**2026-07-08**
- `GAME_LOOP.md` design doc created — full mapping of the loop, betting,
  side-pot, and showdown systems, verified by executing the real modules
  against mocked state; original bug census #1–#14 catalogued.
- Characterization test suites added (101 tests): unit coverage for every
  utility module, showdown integration scenarios, `KNOWN BUG` pins for the
  census. Shared factories in `src/testUtils/factories.js`. App smoke test
  stopped making real network requests. PR #47 opened.
- Factory self-tests and snapshot suites (25 snapshots: per-rank best hands,
  full showdown outcomes, component markup). Factory heads-up blind default
  corrected.
- Cascade seam tracing (`testUtils/trace.js` — jest spies on the compiled
  cross-module call sites record state at every hop), 13-scenario side-pot
  matrix with hard invariants (pot === Σ side pots, unique contestants, chip
  conservation), and `TESTING_ROADMAP.md` (transition log → reducer/driver →
  Immer patches → property testing).

**2026-07-09**
- Bug fixes, each flipping its pinned tests in the same change: #1 royal
  detection, #1b tied-royal crash, #2 AI freeze (+ `clampBetToLegalRange`
  helper), #6 raise typos (+ determinant-integrity suite), #3 odd-chip rule,
  #5 pocket-pair grading (+ pair-of-sixes hole caught by the integrity
  suite), #7 removed incidentally. Suite grew to 173 tests / 41 snapshots.
- Pot commitment wired into the AI (feature entry above).
- `AI_IMPROVEMENTS.md` (board-blindness analysis with measured fold/call/raise
  rates, ranked improvement levers) and `POT_ODDS_PLAN.md` (implementation
  plan) added.

**2026-07-11**
- Test files reorganized: co-located under per-area `__tests__/` directories,
  grouped `unit/` vs `integration/`; `cards.showdown.test.js` →
  `showdown.test.js`, `cards.snapshot.test.js` → `showdown.snapshot.test.js`.
  All snapshots survived byte-identical (verified in CI mode).
- Documentation pruned to present tense; this changelog extracted from the
  inline history.
