// Tests for the test factories themselves. Every other suite trusts these
// shapes, so drift here would silently corrupt the whole test landscape.
// Where possible the factories are cross-checked against the REAL shapes the
// production code produces (the generated deck, generateTable's players,
// determineBlindIndices).
import axios from 'axios';
import { generateDeckOfCards } from '../utils/cards.js';
import { generateTable } from '../utils/players.js';
import { determineBlindIndices } from '../utils/bet.js';
import {
	VALUE_MAP,
	c,
	cc,
	code,
	codes,
	mkPlayer,
	mkState,
	totalChipsInPlay,
} from './factories.js';

jest.mock('axios', () => ({ get: jest.fn() }));

describe('card notation: c() / cc() / code() / codes()', () => {
	it('parses face, suit, and value', () => {
		expect(c('AH')).toEqual({ cardFace: 'A', suit: 'Heart', value: 13 });
		expect(c('10S')).toEqual({ cardFace: '10', suit: 'Spade', value: 9 });
		expect(c('2D')).toEqual({ cardFace: '2', suit: 'Diamond', value: 1 });
	});

	it('produces cards identical to every card in the real generated deck', () => {
		// This pins VALUE_MAP and the card object shape to the source of truth.
		generateDeckOfCards().forEach(realCard => {
			expect(c(code(realCard))).toEqual(realCard);
		});
	});

	it('round-trips through code()/codes() for the whole deck', () => {
		const deckCodes = codes(generateDeckOfCards());
		expect(new Set(deckCodes).size).toBe(52);
		expect(codes(cc(deckCodes.join(' ')))).toEqual(deckCodes);
	});

	it('cc() splits on any whitespace', () => {
		expect(cc('AH  KH\t QH')).toHaveLength(3);
	});

	it('throws on malformed codes', () => {
		expect(() => c('1H')).toThrow();
		expect(() => c('AX')).toThrow();
		expect(() => c('H')).toThrow();
		expect(() => c('')).toThrow();
	});

	it('exports the same VALUE_MAP scale the deck uses', () => {
		expect(VALUE_MAP['2']).toBe(1);
		expect(VALUE_MAP['10']).toBe(9);
		expect(VALUE_MAP['A']).toBe(13);
	});
});

describe('mkPlayer', () => {
	it('has exactly the same field set as a real generateTable player', async () => {
		axios.get.mockResolvedValue({
			data: {
				results: [{ name: { first: 'john', last: 'doe' }, picture: { large: 'url' } }],
			},
		});
		const [realHuman, realRobot] = await generateTable();
		const factoryKeys = Object.keys(mkPlayer('X')).sort();
		expect(factoryKeys).toEqual(Object.keys(realHuman).sort());
		expect(factoryKeys).toEqual(Object.keys(realRobot).sort());
	});

	it('derives roundStartChips from chips + bet unless overridden', () => {
		expect(mkPlayer('X').roundStartChips).toBe(10000);
		expect(mkPlayer('X', { chips: 300, bet: 200 }).roundStartChips).toBe(500);
		expect(mkPlayer('X', { chips: 300, bet: 200, roundStartChips: 42 }).roundStartChips).toBe(42);
	});

	it('applies overrides verbatim', () => {
		const player = mkPlayer('X', { folded: true, allIn: true, robot: true, cards: cc('AH KH') });
		expect(player.folded).toBe(true);
		expect(player.allIn).toBe(true);
		expect(player.robot).toBe(true);
		expect(codes(player.cards)).toEqual(['AH', 'KH']);
	});

	it('never shares nested references between players (transformers mutate deeply)', () => {
		const a = mkPlayer('A');
		const b = mkPlayer('B');
		a.showDownHand.hand.push('junk');
		a.cards.push('junk');
		expect(b.showDownHand.hand).toEqual([]);
		expect(b.cards).toEqual([]);
	});
});

describe('mkState', () => {
	it('derives the player counters from the roster', () => {
		const state = mkState([
			mkPlayer('A'),
			mkPlayer('B', { folded: true }),
			mkPlayer('C', { chips: 0, allIn: true }),
		]);
		expect(state.numPlayersActive).toBe(2);
		expect(state.numPlayersFolded).toBe(1);
		expect(state.numPlayersAllIn).toBe(1);
	});

	it('defaults blinds to the real determineBlindIndices layout for 3+ players', () => {
		[3, 4, 5, 6].forEach(count => {
			const players = Array.from({ length: count }, (_, i) => mkPlayer(`P${i}`));
			const { blindIndex, dealerIndex } = mkState(players);
			const real = determineBlindIndices(dealerIndex, count);
			expect(blindIndex).toEqual({ big: real.bigBlindIndex, small: real.smallBlindIndex });
		});
	});

	it('gives the dealer the small blind heads-up (filterBrokePlayers convention)', () => {
		const state = mkState([mkPlayer('A'), mkPlayer('B')]);
		expect(state.blindIndex).toEqual({ big: 1, small: 0 });
	});

	it('lets overrides win over derived values', () => {
		const state = mkState([mkPlayer('A', { folded: true })], {
			numPlayersActive: 9,
			phase: 'showdown',
			pot: 123,
		});
		expect(state.numPlayersActive).toBe(9);
		expect(state.phase).toBe('showdown');
		expect(state.pot).toBe(123);
	});

	it('never shares arrays between states', () => {
		const a = mkState([mkPlayer('A')]);
		const b = mkState([mkPlayer('B')]);
		a.sidePots.push('junk');
		a.communityCards.push('junk');
		a.showDownMessages.push('junk');
		expect(b.sidePots).toEqual([]);
		expect(b.communityCards).toEqual([]);
		expect(b.showDownMessages).toEqual([]);
	});
});

describe('totalChipsInPlay', () => {
	it('sums stacks, live bets, and the pot', () => {
		const state = mkState(
			[mkPlayer('A', { chips: 100, bet: 50 }), mkPlayer('B', { chips: 200 })],
			{ pot: 1000 }
		);
		expect(totalChipsInPlay(state)).toBe(1350);
	});
});
