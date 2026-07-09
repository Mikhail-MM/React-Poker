// Black-box tests for the AI decision engine (ai.js exports only handleAI).
// Math.random is pinned per test to force deterministic decision paths.
// "KNOWN BUG" tests pin buggy behavior on purpose (see docs/GAME_LOOP.md §9) —
// flip them when the bug is fixed.
import { handleAI } from './ai.js';
import { cc, mkPlayer, mkState } from '../testUtils/factories.js';

let randomSpy;
const pinRandom = (value) => {
	randomSpy = jest.spyOn(Math, 'random').mockReturnValue(value);
};

afterEach(() => {
	if (randomSpy) randomSpy.mockRestore();
	randomSpy = null;
});

// Three-handed so a fold cannot end the hand (which would cascade into showdown).
const aiState = (aiOverrides, stateOverrides) =>
	mkState(
		[
			mkPlayer('Robo', { robot: true, ...aiOverrides }),
			mkPlayer('P1'),
			mkPlayer('P2'),
		],
		{ activePlayerIndex: 0, ...stateOverrides }
	);

describe('pre-flop decisions (betting1)', () => {
	it('folds junk to a large bet', () => {
		pinRandom(0.5);
		const pushAnimationState = jest.fn();
		const state = handleAI(
			aiState(
				{ cards: cc('7S 2D'), chips: 10000 },
				{ phase: 'betting1', highBet: 5000 }
			),
			pushAnimationState
		);
		expect(state.players[0].folded).toBe(true);
		expect(pushAnimationState).toHaveBeenCalledWith(0, 'FOLD');
	});

	it('calls with big cards when the raise roll fails', () => {
		pinRandom(0.9); // willRaise: 0.9 < 0.75 is false -> call
		const state = handleAI(
			aiState(
				{ cards: cc('AS KC'), chips: 10000 }, // two high cards, offsuit
				{ phase: 'betting1', highBet: 2000 }
			),
			jest.fn()
		);
		expect(state.players[0].bet).toBe(2000);
		expect(state.players[0].chips).toBe(8000);
		expect(state.highBet).toBe(2000); // a call, not a raise
	});

	it('raises with suited big cards when the raise roll succeeds', () => {
		pinRandom(0.99); // willRaise: 0.99 < 1; range index 3 = 'hidraw'; proportion 0.249
		const state = handleAI(
			aiState(
				{ cards: cc('AS KS'), chips: 10000 },
				{ phase: 'betting1', highBet: 20 }
			),
			jest.fn()
		);
		expect(state.players[0].bet).toBe(2490); // floor(0.249 * 10000)
		expect(state.highBet).toBe(2490);
	});

	it('KNOWN BUG #5: pocket aces fold to a large bet', () => {
		// buildPreFlopDeterminant uses switch(highCard) with boolean case labels
		// (ai.js:251), so every pocket pair falls through to the default branch
		// (callLimit 'aggro'). Facing 80% of stack ('beware') aces fold.
		// When fixed, premium pairs should call here.
		pinRandom(0.5);
		const state = handleAI(
			aiState(
				{ cards: cc('AS AC'), chips: 10000 },
				{ phase: 'betting1', highBet: 8000 }
			),
			jest.fn()
		);
		expect(state.players[0].folded).toBe(true);
	});
});

describe('post-flop decisions (betting2-4)', () => {
	it('raises with a full house when the stack covers the bet', () => {
		pinRandom(0.8); // willRaise; range index 3 = 'beware'; proportion 0.95
		const state = handleAI(
			aiState(
				{ cards: cc('7C 7D'), chips: 10000 },
				{
					phase: 'betting2',
					highBet: 100,
					communityCards: cc('7H KS KD 2C 9S'), // 777KK
				}
			),
			jest.fn()
		);
		expect(state.players[0].bet).toBe(9500); // floor(0.95 * 10000)
		expect(state.highBet).toBe(9500);
	});

	it('KNOWN BUG #2 (AI freeze): raising into a bet it cannot cover returns undefined', () => {
		// The AI clamps its raise UP to highBet with no cap at its own stack
		// (ai.js:163-165); handleBet rejects bet > max and returns undefined
		// (bet.js:33-36). App.handleAI then dereferences newState.minBet and
		// throws inside setTimeout — the game silently freezes (players.js:105).
		// When fixed, this must return a state object (an all-in call).
		pinRandom(0.8);
		const result = handleAI(
			aiState(
				{ cards: cc('7C 7D'), chips: 1000 },
				{
					phase: 'betting2',
					highBet: 5000, // opponent shoved for more than our stack
					communityCards: cc('7H KS KD 2C 9S'),
					numPlayersAllIn: 1,
				}
			),
			jest.fn()
		);
		expect(result).toBeUndefined();
	});

	it('KNOWN BUG #6: a flush can never raise (raiseChange typo)', () => {
		// buildGeneralizedDeterminant returns `raiseChange` (sic) for Flush and
		// below (ai.js:213), so willRaise(undefined) is always false. With the
		// roll pinned to 0 — which would pass any defined raiseChance — the AI
		// still just calls. When fixed, this should become a raise.
		pinRandom(0);
		const state = handleAI(
			aiState(
				{ cards: cc('AH QH'), chips: 10000 },
				{
					phase: 'betting2',
					highBet: 100,
					communityCards: cc('9H KH 2H 3S 8D'), // nut flush
				}
			),
			jest.fn()
		);
		expect(state.players[0].bet).toBe(100); // called, did not raise
		expect(state.highBet).toBe(100);
	});

	it('calls cheap bets with a marginal made hand', () => {
		pinRandom(0.9);
		const state = handleAI(
			aiState(
				{ cards: cc('KC 4D'), chips: 10000 },
				{
					phase: 'betting2',
					highBet: 100, // 1% of stack = 'insignificant' stakes
					communityCards: cc('KH 9S 2H 3S 8D'), // top pair
				}
			),
			jest.fn()
		);
		expect(state.players[0].bet).toBe(100);
		expect(state.players[0].folded).toBe(false);
	});

	it('folds a weak hand to heavy pressure', () => {
		pinRandom(0.5);
		const state = handleAI(
			aiState(
				{ cards: cc('6C 4D'), chips: 10000 },
				{
					phase: 'betting2',
					highBet: 5000, // 50% of stack = 'aggro' > No Pair callLimit 'meddraw'
					communityCards: cc('KH 9S 2H JS 8D'),
				}
			),
			jest.fn()
		);
		expect(state.players[0].folded).toBe(true);
	});
});
