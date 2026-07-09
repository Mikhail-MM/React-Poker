// Unit tests for players.js: table generation, turn order, round transitions,
// and the early-showdown short circuits. "KNOWN BUG" tests pin buggy behavior
// on purpose (see docs/GAME_LOOP.md §9) — flip them when fixed.
import axios from 'axios';
import {
	generateTable,
	handleOverflowIndex,
	determineNextActivePlayer,
	determinePhaseStartActivePlayer,
	beginNextRound,
	checkWin,
} from './players.js';

import { cc, mkPlayer, mkState } from '../testUtils/factories.js';

jest.mock('axios', () => ({ get: jest.fn() }));

describe('handleOverflowIndex', () => {
	it('wraps upward around the table', () => {
		expect(handleOverflowIndex(5, 1, 6, 'up')).toBe(0);
		expect(handleOverflowIndex(2, 3, 6, 'up')).toBe(5);
		expect(handleOverflowIndex(0, 1, 6, 'up')).toBe(1);
	});

	it('KNOWN BUG: the down direction returns out-of-bounds indices when not wrapping', () => {
		// ((current - increment) % length) + length only lands in range when the
		// subtraction goes negative. Unused in the codebase today ('up' only),
		// but a trap for future callers. When fixed, (2,1,6) should be 1.
		expect(handleOverflowIndex(0, 1, 6, 'down')).toBe(5); // wrap case works
		expect(handleOverflowIndex(2, 1, 6, 'down')).toBe(7); // out of bounds!
	});

	it('throws on an unfamiliar direction', () => {
		expect(() => handleOverflowIndex(0, 1, 6, 'sideways')).toThrow();
	});
});

describe('determinePhaseStartActivePlayer', () => {
	it('starts the street left of the big blind', () => {
		const state = mkState(
			[mkPlayer('P0'), mkPlayer('P1'), mkPlayer('P2'), mkPlayer('P3')],
			{ blindIndex: { big: 1, small: 0 } }
		);
		expect(determinePhaseStartActivePlayer(state).activePlayerIndex).toBe(2);
	});

	it('skips folded and broke players', () => {
		const state = mkState(
			[
				mkPlayer('P0'),
				mkPlayer('P1'),
				mkPlayer('P2', { folded: true }),
				mkPlayer('P3', { chips: 0 }),
			],
			{ blindIndex: { big: 1, small: 0 } }
		);
		expect(determinePhaseStartActivePlayer(state).activePlayerIndex).toBe(0);
	});
});

describe('determineNextActivePlayer', () => {
	it('hands the turn to the next unreconciled player', () => {
		const state = mkState(
			[
				mkPlayer('P0', { betReconciled: true }),
				mkPlayer('P1'),
				mkPlayer('P2'),
			],
			{ activePlayerIndex: 0 }
		);
		expect(determineNextActivePlayer(state).activePlayerIndex).toBe(1);
	});

	it('skips folded players', () => {
		const state = mkState(
			[
				mkPlayer('P0', { betReconciled: true }),
				mkPlayer('P1', { folded: true, betReconciled: true }),
				mkPlayer('P2'),
			],
			{ activePlayerIndex: 0 }
		);
		expect(determineNextActivePlayer(state).activePlayerIndex).toBe(2);
	});

	it('shifts the phase when action returns to a reconciled player', () => {
		const state = mkState(
			[
				mkPlayer('P0', { bet: 20, betReconciled: true }),
				mkPlayer('P1', { bet: 20, betReconciled: true }),
				mkPlayer('P2', { bet: 20, betReconciled: true }),
			],
			{
				activePlayerIndex: 0,
				phase: 'betting1',
				deck: cc('2C 3C 4C 5C 6C'),
				blindIndex: { big: 2, small: 1 },
			}
		);
		const next = determineNextActivePlayer(state);
		expect(next.phase).toBe('betting2');
		expect(next.pot).toBe(60);
	});

	it('runs straight to showdown when everyone else has folded', () => {
		// QUIRK: rather than ending the hand immediately, the code runs the board
		// out and pushes the survivor through the full showdown machinery.
		const state = mkState(
			[
				mkPlayer('Winner', { chips: 900, bet: 100, betReconciled: true, cards: cc('2H 7C') }),
				mkPlayer('FoldA', { chips: 900, bet: 100, folded: true, betReconciled: true, cards: cc('AS KS') }),
				mkPlayer('FoldB', { chips: 900, bet: 100, folded: true, betReconciled: true, cards: cc('AD KD') }),
			],
			{
				activePlayerIndex: 0,
				phase: 'betting1',
				communityCards: cc('9H 10H JH QS 2D'),
				deck: [],
			}
		);
		const next = determineNextActivePlayer(state);
		expect(next.phase).toBe('showdown');
		expect(next.players[0].chips).toBe(1200); // 900 + the 300 pot
		expect(next.pot).toBe(0);
	});

	it('runs straight to showdown when all live players are all-in', () => {
		const state = mkState(
			[
				mkPlayer('AllInA', { chips: 0, bet: 500, allIn: true, betReconciled: true, cards: cc('AH KH') }),
				mkPlayer('AllInB', { chips: 0, bet: 500, allIn: true, betReconciled: true, cards: cc('2C 7D') }),
			],
			{
				activePlayerIndex: 0,
				phase: 'betting1',
				communityCards: cc('10H JH QH 2S 7S'),
				deck: [],
			}
		);
		const next = determineNextActivePlayer(state);
		expect(next.phase).toBe('showdown');
		expect(next.players[0].chips).toBe(1000); // royal (reported straight) flush scoops
		expect(next.players[1].chips).toBe(0);
	});
});

describe('checkWin', () => {
	it('declares a winner when one player holds all the chips', () => {
		expect(checkWin([{ chips: 100 }, { chips: 0 }, { chips: 0 }])).toBe(true);
		expect(checkWin([{ chips: 100 }, { chips: 50 }, { chips: 0 }])).toBe(false);
	});
});

describe('beginNextRound', () => {
	const roundState = () =>
		mkState(
			[
				mkPlayer('Alice', { chips: 5000, cards: cc('AH KH'), folded: true }),
				mkPlayer('Broke', { chips: 0, cards: cc('2C 3C') }),
				mkPlayer('Carol', { chips: 3000, cards: cc('9S 9D') }),
				mkPlayer('Dave', { chips: 2000, cards: cc('4H 8C') }),
			],
			{
				dealerIndex: 0,
				pot: 7,
				phase: 'showdown',
				communityCards: cc('2H 5D 8S JC QD'),
				sidePots: [{ potValue: 0, contestants: [] }],
				playerHierarchy: [{ name: 'stale' }],
				showDownMessages: [{ users: ['stale'], prize: 0, rank: 'Pair' }],
				highBet: 999,
				betInputValue: 999,
				minBet: 0,
			}
		);

	it('removes broke players and passes the dealer chip past them', () => {
		const state = beginNextRound(roundState());
		expect(state.players.map(p => p.name)).toEqual(['Alice', 'Carol', 'Dave']);
		expect(state.dealerIndex).toBe(1); // Carol: seat 1 (Broke) was skipped, then removed
	});

	it('posts blinds and deals a fresh hand', () => {
		const state = beginNextRound(roundState());
		// 3 players, dealer Carol(1): small blind Dave(2), big blind Alice(0)
		expect(state.blindIndex).toEqual({ big: 0, small: 2 });
		expect(state.players[0].bet).toBe(20);
		expect(state.players[2].bet).toBe(10);
		expect(state.phase).toBe('betting1');
		expect(state.activePlayerIndex).toBe(1); // left of the big blind
		state.players.forEach(player => {
			expect(player.cards).toHaveLength(2);
			expect(player.cards[0]).toBeDefined();
			expect(player.folded).toBe(false);
			expect(player.betReconciled).toBe(false);
			expect(player.roundStartChips).toBe(player.chips + player.bet);
		});
		expect(state.deck).toHaveLength(52 - 6);
	});

	it('resets round bookkeeping (community cards, side pots, messages, bet markers)', () => {
		const state = beginNextRound(roundState());
		expect(state.communityCards).toEqual([]);
		expect(state.sidePots).toEqual([]);
		expect(state.playerHierarchy).toEqual([]);
		expect(state.showDownMessages).toEqual([]);
		expect(state.numPlayersActive).toBe(3);
		expect(state.numPlayersFolded).toBe(0);
		expect(state.numPlayersAllIn).toBe(0);
	});

	it('KNOWN BUG #3 (companion): the pot is NOT reset between rounds', () => {
		// Odd chips stranded by split pots (see cards.showdown.test.js) accumulate
		// here forever. When fixed, expect 0.
		expect(beginNextRound(roundState()).pot).toBe(7);
	});

	it('gives the dealer the small blind heads-up', () => {
		const state = beginNextRound(
			mkState(
				[
					mkPlayer('Alice', { chips: 5000, cards: cc('AH KH') }),
					mkPlayer('Broke', { chips: 0, cards: cc('2C 3C') }),
					mkPlayer('Carol', { chips: 3000, cards: cc('9S 9D') }),
				],
				{ dealerIndex: 0, pot: 0, phase: 'showdown' }
			)
		);
		expect(state.players.map(p => p.name)).toEqual(['Alice', 'Carol']);
		expect(state.dealerIndex).toBe(1); // Carol
		expect(state.blindIndex).toEqual({ big: 0, small: 1 }); // dealer posts small
		expect(state.players[1].bet).toBe(10);
		expect(state.players[0].bet).toBe(20);
	});
});

describe('generateTable', () => {
	it('builds the human plus 4 AI opponents from the remote roster', async () => {
		axios.get.mockResolvedValue({
			data: {
				results: [
					{ name: { first: 'john', last: 'doe' }, picture: { large: 'url1' } },
					{ name: { first: 'jane', last: 'roe' }, picture: { large: 'url2' } },
					{ name: { first: 'max', last: 'poe' }, picture: { large: 'url3' } },
					{ name: { first: 'ada', last: 'loe' }, picture: { large: 'url4' } },
				],
			},
		});
		const players = await generateTable();
		expect(players).toHaveLength(5);
		expect(players[0].name).toBe('Player 1');
		expect(players[0].robot).toBe(false);
		expect(players[0].chips).toBe(20000);
		expect(players[1].name).toBe('John Doe');
		players.slice(1).forEach(player => {
			expect(player.robot).toBe(true);
			expect(player.chips).toBeGreaterThanOrEqual(18000);
			expect(player.chips).toBeLessThan(20000);
		});
	});
});
