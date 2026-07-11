// Unit tests for bet.js: blinds, bet/fold handling, phase shifting, pot
// reconciliation and side-pot construction. "KNOWN BUG" tests pin buggy
// behavior on purpose (see docs/GAME_LOOP.md §9) — flip them when fixed.
import {
	determineBlindIndices,
	anteUpBlinds,
	determineMinBet,
	handleBet,
	handleFold,
	handlePhaseShift,
	reconcilePot,
} from '../../bet.js';

import { cc, mkPlayer, mkState } from '../../../testUtils/factories.js';

describe('determineBlindIndices', () => {
	it('puts the small blind left of the dealer and the big blind after', () => {
		expect(determineBlindIndices(0, 5)).toEqual({ smallBlindIndex: 1, bigBlindIndex: 2 });
	});

	it('wraps around the table', () => {
		expect(determineBlindIndices(4, 5)).toEqual({ smallBlindIndex: 0, bigBlindIndex: 1 });
		expect(determineBlindIndices(3, 5)).toEqual({ smallBlindIndex: 4, bigBlindIndex: 0 });
	});
});

describe('anteUpBlinds', () => {
	it('posts the big blind and half for the small blind', () => {
		const players = [mkPlayer('P0'), mkPlayer('P1'), mkPlayer('P2')];
		anteUpBlinds(players, { bigBlindIndex: 2, smallBlindIndex: 1 }, 20);
		expect(players[2].bet).toBe(20);
		expect(players[2].chips).toBe(9980);
		expect(players[1].bet).toBe(10);
		expect(players[1].chips).toBe(9990);
		expect(players[0].bet).toBe(0);
	});

	it('KNOWN BUG #9: a short-stacked blind goes to negative chips', () => {
		// No all-in handling: posting is unconditional subtraction.
		const players = [mkPlayer('P0'), mkPlayer('Short', { chips: 5 })];
		anteUpBlinds(players, { bigBlindIndex: 1, smallBlindIndex: 0 }, 20);
		expect(players[1].chips).toBe(-15);
		expect(players[1].allIn).toBe(false); // flag not set either
	});
});

describe('determineMinBet', () => {
	it('is the high bet when the player can cover it', () => {
		expect(determineMinBet(100, 5000, 0)).toBe(100);
		expect(determineMinBet(100, 200, 50)).toBe(100);
	});

	it('is the player total stack when they cannot cover (all-in call)', () => {
		expect(determineMinBet(100, 60, 20)).toBe(80);
	});
});

describe('handleBet', () => {
	const threeWay = () =>
		mkState(
			[
				mkPlayer('P0', { chips: 1000 }),
				mkPlayer('P1', { chips: 1000, bet: 100 }),
				mkPlayer('P2', { chips: 1000, bet: 100 }),
			],
			{ activePlayerIndex: 0, highBet: 100 }
		);

	it('moves chips into the bet, reconciles the player, and advances the turn', () => {
		const state = handleBet(threeWay(), 100, 100, 1000);
		expect(state.players[0].bet).toBe(100);
		expect(state.players[0].chips).toBe(900);
		expect(state.players[0].betReconciled).toBe(true);
		expect(state.activePlayerIndex).toBe(1);
	});

	it('a raise lifts highBet and un-reconciles the other live players', () => {
		const initial = threeWay();
		initial.players[1].betReconciled = true;
		initial.players[2].betReconciled = true;
		const state = handleBet(initial, 300, 100, 1000);
		expect(state.highBet).toBe(300);
		expect(state.minBet).toBe(300);
		expect(state.players[1].betReconciled).toBe(false);
		expect(state.players[2].betReconciled).toBe(false);
		expect(state.players[0].betReconciled).toBe(true); // the raiser is done acting
	});

	it('KNOWN BUG #4: a raise also un-reconciles all-in players who cannot act', () => {
		// bet.js:43 `(!player.folded || !player.chips === 0)` compares a boolean to a
		// number, so the all-in guard never applies. Masked downstream because the
		// turn cursor skips players with 0 chips.
		const initial = threeWay();
		initial.players[2] = mkPlayer('P2', { chips: 0, bet: 100, allIn: true, betReconciled: true });
		const state = handleBet(initial, 300, 100, 1000);
		expect(state.players[2].betReconciled).toBe(false);
	});

	it('flags an all-in when the bet consumes the stack', () => {
		const initial = threeWay();
		initial.players[0].chips = 250;
		const state = handleBet(initial, 250, 100, 250);
		expect(state.players[0].allIn).toBe(true);
		expect(state.players[0].chips).toBe(0);
		expect(state.numPlayersAllIn).toBe(1);
	});

	it('QUIRK (bug #2 enabler): an invalid bet returns undefined instead of state', () => {
		// App.handleAI dereferences the return value (`newState.minBet`), so an
		// out-of-range robot bet is fatal. The known trigger was fixed on the
		// AI side (clampBetToLegalRange, ai.js), and this footgun stays LOUD by
		// choice: silently clamping here would mask upstream miscalculations.
		// If hardened later, prefer a descriptive throw at the rejection site
		// over a silent clamp.
		expect(handleBet(threeWay(), 2000, 100, 1000)).toBeUndefined(); // above max
		expect(handleBet(threeWay(), 50, 100, 1000)).toBeUndefined(); // below min
	});
});

describe('handleFold', () => {
	it('marks the player folded and advances the turn', () => {
		const state = mkState(
			[mkPlayer('P0'), mkPlayer('P1'), mkPlayer('P2')],
			{ activePlayerIndex: 0, highBet: 100 }
		);
		const next = handleFold(state);
		expect(next.players[0].folded).toBe(true);
		expect(next.players[0].betReconciled).toBe(true);
		expect(next.numPlayersFolded).toBe(1);
		expect(next.numPlayersActive).toBe(2);
		expect(next.activePlayerIndex).toBe(1);
	});
});

describe('reconcilePot', () => {
	it('sweeps bets into the pot and resets betting markers', () => {
		const state = reconcilePot(
			mkState([
				mkPlayer('P0', { bet: 100, betReconciled: true }),
				mkPlayer('P1', { bet: 100, betReconciled: true }),
				mkPlayer('P2', { bet: 100, betReconciled: true }),
			], { highBet: 100, minBet: 100, betInputValue: 100 })
		);
		expect(state.pot).toBe(300);
		state.players.forEach(player => {
			expect(player.bet).toBe(0);
			expect(player.betReconciled).toBe(false);
		});
		expect(state.highBet).toBe(0);
		expect(state.minBet).toBe(0);
		expect(state.betInputValue).toBe(0);
		expect(state.sidePots).toEqual([
			{ potValue: 300, contestants: ['P0', 'P1', 'P2'] },
		]);
	});

	it('splits layered all-in bets into side pots from the shortest stack up', () => {
		const state = reconcilePot(
			mkState([
				mkPlayer('Short', { chips: 0, bet: 100, allIn: true }),
				mkPlayer('Mid', { bet: 300 }),
				mkPlayer('Big', { bet: 300 }),
			])
		);
		expect(state.pot).toBe(700);
		expect(state.sidePots.map(sp => sp.potValue)).toEqual([300, 400]);
		expect([...state.sidePots[0].contestants].sort()).toEqual(['Big', 'Mid', 'Short']);
		expect([...state.sidePots[1].contestants].sort()).toEqual(['Big', 'Mid']);
	});

	it('includes folded players as dead money but not as contestants', () => {
		const state = reconcilePot(
			mkState([
				mkPlayer('Live1', { bet: 200 }),
				mkPlayer('Live2', { bet: 200 }),
				mkPlayer('Deserter', { bet: 200, folded: true }),
			])
		);
		expect(state.sidePots).toEqual([
			{ potValue: 600, contestants: ['Live1', 'Live2'] },
		]);
	});

	it('refunds an uncalled bet to the lone over-bettor', () => {
		const state = reconcilePot(
			mkState([
				mkPlayer('Raiser', { chips: 500, bet: 500 }),
				mkPlayer('Caller', { chips: 0, bet: 200, allIn: true }),
			])
		);
		// 200 is matched (400 pot); the uncalled 300 goes back to the raiser.
		expect(state.pot).toBe(400);
		expect(state.players[0].chips).toBe(800);
		expect(state.sidePots.map(sp => sp.potValue)).toEqual([400]);
	});

	it('condenses same-contestant pots across betting rounds', () => {
		let state = mkState([
			mkPlayer('P0', { bet: 100 }),
			mkPlayer('P1', { bet: 100 }),
		]);
		state = reconcilePot(state);
		state.players[0].bet = 250;
		state.players[1].bet = 250;
		state = reconcilePot(state);
		expect(state.pot).toBe(700);
		expect(state.sidePots).toEqual([
			{ potValue: 700, contestants: ['P0', 'P1'] },
		]);
	});
});

describe('handlePhaseShift', () => {
	it('betting1 -> reconciles the pot and deals the flop into betting2', () => {
		const state = handlePhaseShift(
			mkState(
				[
					mkPlayer('P0', { bet: 20 }),
					mkPlayer('P1', { bet: 20 }),
					mkPlayer('P2', { bet: 20 }),
				],
				{
					phase: 'betting1',
					deck: cc('2C 3C 4C 5C 6C'),
					blindIndex: { big: 2, small: 1 },
				}
			)
		);
		expect(state.phase).toBe('betting2');
		expect(state.pot).toBe(60);
		expect(state.communityCards).toHaveLength(3);
		expect(state.highBet).toBe(0); // post-flop rounds open with checking allowed
		expect(state.activePlayerIndex).toBe(0); // left of the big blind
	});

	it('throws when called outside a betting phase', () => {
		expect(() =>
			handlePhaseShift(mkState([mkPlayer('P0')], { phase: 'showdown' }))
		).toThrow();
	});
});

describe('full betting round via handleBet', () => {
	it('a call that closes the round cascades into the flop deal', () => {
		// P1 and P2 already matched; P0 calling should end betting1 entirely.
		const state = handleBet(
			mkState(
				[
					mkPlayer('P0', { chips: 1000 }),
					mkPlayer('P1', { chips: 980, bet: 20, betReconciled: true }),
					mkPlayer('P2', { chips: 980, bet: 20, betReconciled: true }),
				],
				{
					activePlayerIndex: 0,
					highBet: 20,
					phase: 'betting1',
					deck: cc('2C 3C 4C 5C 6C'),
					blindIndex: { big: 2, small: 1 },
				}
			),
			20,
			20,
			1000
		);
		expect(state.phase).toBe('betting2');
		expect(state.pot).toBe(60);
		expect(state.communityCards).toHaveLength(3);
		expect(state.sidePots).toEqual([
			{ potValue: 60, contestants: ['P0', 'P1', 'P2'] },
		]);
	});
});
