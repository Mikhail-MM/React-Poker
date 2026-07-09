// Black-box tests for the AI decision engine (ai.js exports only handleAI).
// Math.random is pinned per test to force deterministic decision paths.
// "KNOWN BUG" tests pin buggy behavior on purpose (see docs/GAME_LOOP.md §9) —
// flip them when the bug is fixed.
import {
	handleAI,
	clampBetToLegalRange,
	buildPreFlopDeterminant,
	buildGeneralizedDeterminant,
	BET_HIERARCHY,
} from './ai.js';
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

describe('determinant integrity (the bug #6 typo class)', () => {
	// Loose typing let `raiseChange` (sic) and the malformed tier string
	// 'hidraw, strong' silently disable most post-flop raising. These tests
	// make the determinant tables' shape executable: every determinant must
	// carry a numeric raiseChance and only tiers that exist in BET_HIERARCHY.
	const RANKS = [
		'Royal Flush', 'Straight Flush', 'Four Of A Kind', 'Full House',
		'Flush', 'Straight', 'Three Of A Kind', 'Two Pair', 'Pair', 'No Pair',
	];

	it('every post-flop determinant has a numeric raiseChance and legal raiseRange tiers', () => {
		RANKS.forEach(rank => {
			const { callLimit, raiseChance, raiseRange } = buildGeneralizedDeterminant(null, rank, null);
			expect(BET_HIERARCHY[callLimit]).toBeDefined();
			expect(typeof raiseChance).toBe('number');
			raiseRange.forEach(tier => expect(BET_HIERARCHY[tier]).toBeDefined());
		});
	});

	it('every pre-flop determinant has a numeric raiseChance and legal tiers when it can raise', () => {
		for (let high = 1; high <= 13; high++) {
			for (let low = 1; low <= high; low++) {
				[true, false].forEach(suited => {
					const { callLimit, raiseChance, raiseRange } = buildPreFlopDeterminant(
						high, low, suited ? {} : undefined, high - low <= 4
					);
					expect(BET_HIERARCHY[callLimit]).toBeDefined();
					expect(typeof raiseChance).toBe('number');
					if (raiseChance > 0) {
						raiseRange.forEach(tier => expect(BET_HIERARCHY[tier]).toBeDefined());
					}
				});
			}
		}
	});
});

describe('clampBetToLegalRange', () => {
	it('lifts a bet below the table price up to the price', () => {
		expect(clampBetToLegalRange(300, 800, 10000)).toBe(800);
	});

	it('passes a legal raise through untouched', () => {
		expect(clampBetToLegalRange(2500, 800, 10000)).toBe(2500);
	});

	it('caps an oversized bet at the stack', () => {
		expect(clampBetToLegalRange(12000, 800, 10000)).toBe(10000);
	});

	it('collapses a raise into an all-in call when the price exceeds the stack', () => {
		// The bug #2 freeze shape: lift-then-cap must land on max — never on
		// the raw bet (illegal: below the price) or on highBet (illegal:
		// above the stack).
		expect(clampBetToLegalRange(950, 5000, 1000)).toBe(1000);
	});
});

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

	it('clamps an unaffordable raise into an all-in call (bug #2 freeze fixed)', () => {
		// Formerly the freeze: the AI decided to raise while facing a highBet
		// larger than its stack, submitted betValue = highBet > max, and
		// handleBet returned undefined (players.js:105, GAME_LOOP.md §9 #2).
		// clampBetToLegalRange now degrades the raise into an all-in call and
		// the hand continues.
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
		expect(result).toBeDefined();
		expect(result.players[0].bet).toBe(1000); // the whole stack, not 5000
		expect(result.players[0].chips).toBe(0);
		expect(result.players[0].allIn).toBe(true);
	});

	it('a flush can raise (bug #6 typos fixed)', () => {
		// raiseChange -> raiseChance restored the raise roll; with the roll
		// pinned to 0, willRaise(1) passes, the range picks 'strong' (index 0),
		// and decideBetProportion('strong') bets 25% of the stack.
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
		expect(state.players[0].bet).toBe(2500); // floor(0.25 * 10000) — a raise
		expect(state.highBet).toBe(2500);
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
