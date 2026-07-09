// Integration tests for the full showdown pipeline:
// reconcilePot -> calculateSidePots -> showDown -> distributeSidePots -> payWinners.
// Scenarios mirror docs/GAME_LOOP.md Appendix A. "KNOWN BUG" tests pin buggy
// behavior on purpose — flip them when the bug is fixed.
import { showDown } from './cards.js';
import { reconcilePot } from './bet.js';
import { cc, mkPlayer, mkState, totalChipsInPlay } from '../testUtils/factories.js';

const runShowdown = (players, communityCodes, overrides = {}) => {
	let state = mkState(players, {
		communityCards: cc(communityCodes),
		phase: 'betting4',
		...overrides,
	});
	state = reconcilePot(state);
	return showDown(state);
};

const hierarchyNames = (state) =>
	state.playerHierarchy.map(entry =>
		Array.isArray(entry) ? entry.map(p => p.name).sort() : entry.name
	);

describe('showdown: capped all-in with layered side pots', () => {
	// Board 10H JH QH 2S 7D. Alice holds the nuts but is all-in for only 200.
	// Bets this round: Alice 200 (all-in), Bob 800, Carol 800, Dave 600 (all-in),
	// Eve 100 (folded, dead money). Total pot 2500.
	const play = () =>
		runShowdown(
			[
				mkPlayer('Alice', { chips: 0, bet: 200, allIn: true, cards: cc('AH KH') }),   // royal flush
				mkPlayer('Bob',   { chips: 1200, bet: 800, cards: cc('8H 3H') }),             // flush, 8 kicker
				mkPlayer('Carol', { chips: 1200, bet: 800, cards: cc('5H 4H') }),             // flush, 5 kicker
				mkPlayer('Dave',  { chips: 0, bet: 600, allIn: true, cards: cc('2D 7C') }),   // two pair
				mkPlayer('Eve',   { chips: 900, bet: 100, folded: true, cards: cc('9S 4C') }),
			],
			'10H JH QH 2S 7D'
		);

	it('buckets bets into layered side pots, merging same-contestant layers', () => {
		const state = play();
		expect(state.sidePots.map(sp => sp.potValue)).toEqual([900, 1200, 400]);
		expect([...state.sidePots[0].contestants].sort()).toEqual(['Alice', 'Bob', 'Carol', 'Dave']);
		expect([...state.sidePots[1].contestants].sort()).toEqual(['Bob', 'Carol', 'Dave']);
		expect([...state.sidePots[2].contestants].sort()).toEqual(['Bob', 'Carol']);
	});

	it('caps the best hand at the pots it is a contestant of', () => {
		const state = play();
		const chipsOf = (name) => state.players.find(p => p.name === name).chips;
		expect(chipsOf('Alice')).toBe(900);  // nut hand, but only eligible for the main pot
		expect(chipsOf('Bob')).toBe(2800);   // higher flush sweeps both side pots (1200 + 400)
		expect(chipsOf('Carol')).toBe(1200); // lower flush wins nothing
		expect(chipsOf('Dave')).toBe(0);
		expect(chipsOf('Eve')).toBe(900);    // folded stake is dead money in the main pot
	});

	it('drains the pot fully and conserves total chips', () => {
		const state = play();
		expect(state.pot).toBe(0);
		expect(totalChipsInPlay(state)).toBe(5800);
	});

	it('ranks all non-folded players in the hierarchy; folded players are excluded', () => {
		const state = play();
		expect(hierarchyNames(state)).toEqual(['Alice', 'Bob', 'Carol', 'Dave']);
	});

	it('emits one showdown message per pot payout', () => {
		const state = play();
		expect(state.showDownMessages).toEqual([
			{ users: ['Alice'], prize: 900, rank: 'Royal Flush' },
			{ users: ['Bob'], prize: 1200, rank: 'Flush' },
			{ users: ['Bob'], prize: 400, rank: 'Flush' },
		]);
	});

	it('detects the royal flush (bug #1 fixed)', () => {
		const state = play();
		const alice = state.players.find(p => p.name === 'Alice');
		expect(alice.showDownHand.bestHandRank).toBe('Royal Flush');
	});

	it('QUIRK: folded players still get their hands fully evaluated', () => {
		const state = play();
		const eve = state.players.find(p => p.name === 'Eve');
		expect(eve.showDownHand.bestHandRank).toBe('No Pair');
	});

	it('records roundEndChips for the earnings display', () => {
		const state = play();
		const alice = state.players.find(p => p.name === 'Alice');
		expect(alice.roundEndChips).toBe(900);
		expect(alice.roundStartChips).toBe(200); // net +700 despite holding the nuts
	});
});

describe('showdown: kicker cascade between same-rank hands', () => {
	// Three flushes share QH JH 10H from the board; places are decided on the
	// 4th and 5th cards via the loser-queue recursion in determineContestedHierarchy.
	const play = () =>
		runShowdown(
			[
				mkPlayer('Bob',   { chips: 500, bet: 500, cards: cc('8H 3H') }), // Q-J-10-8-3
				mkPlayer('Carol', { chips: 500, bet: 500, cards: cc('9H 4H') }), // Q-J-10-9-4
				mkPlayer('Dan',   { chips: 500, bet: 500, cards: cc('7H 5H') }), // Q-J-10-7-5
			],
			'QH JH 10H 2S 6D'
		);

	it('orders the full hierarchy by successive kickers', () => {
		expect(hierarchyNames(play())).toEqual(['Carol', 'Bob', 'Dan']);
	});

	it('pays the whole pot to the best kicker', () => {
		const state = play();
		const chipsOf = (name) => state.players.find(p => p.name === name).chips;
		expect(chipsOf('Carol')).toBe(2000);
		expect(chipsOf('Bob')).toBe(500);
		expect(chipsOf('Dan')).toBe(500);
		expect(state.pot).toBe(0);
	});
});

describe('showdown: exact tie splits the pot', () => {
	// Both live players play the board straight 9-8-7-6-5. Pot is 801
	// (51 of dead money from a folder), so the split leaves an odd chip.
	const play = () =>
		runShowdown(
			[
				mkPlayer('Xavier', { chips: 500, bet: 375, cards: cc('2H 3H') }),
				mkPlayer('Yvonne', { chips: 500, bet: 375, cards: cc('2D 4D') }),
				mkPlayer('Zed',    { chips: 500, bet: 51, folded: true, cards: cc('JS QS') }),
			],
			'5S 6D 7H 8C 9S'
		);

	it('represents the tie as a nested array in the hierarchy', () => {
		expect(hierarchyNames(play())).toEqual([['Xavier', 'Yvonne']]);
	});

	it('pays each winner an equal floor share', () => {
		const state = play();
		expect(state.players.find(p => p.name === 'Xavier').chips).toBe(900);
		expect(state.players.find(p => p.name === 'Yvonne').chips).toBe(900);
		expect(state.showDownMessages).toEqual([
			{ users: ['Xavier', 'Yvonne'], prize: 400, rank: 'Straight' },
		]);
	});

	it('KNOWN BUG #3: the odd chip is stranded in state.pot', () => {
		// payWinners pays floor(801/2) to each winner and never distributes the
		// remainder; beginNextRound does not reset pot, so the chip leaves
		// circulation permanently. When fixed, expect state.pot to be 0.
		expect(play().pot).toBe(1);
	});
});

describe('showdown: everyone folded to one player', () => {
	it('awards the lone survivor the whole pot, including dead money', () => {
		const state = runShowdown(
			[
				mkPlayer('Winner', { chips: 900, bet: 100, cards: cc('2H 7C') }),
				mkPlayer('FoldA',  { chips: 900, bet: 100, folded: true, cards: cc('AS KS') }),
				mkPlayer('FoldB',  { chips: 900, bet: 100, folded: true, cards: cc('AD KD') }),
			],
			'9H 10H JH QS 2D'
		);
		expect(state.sidePots).toEqual([{ potValue: 300, contestants: ['Winner'] }]);
		expect(state.players.find(p => p.name === 'Winner').chips).toBe(1200);
		expect(state.pot).toBe(0);
		// QUIRK: the survivor's hand is still evaluated and ranked (no mucked win);
		// they "win" with whatever they hold, even a weak hand.
		expect(hierarchyNames(state)).toEqual(['Winner']);
	});
});

describe('showdown: tied royal flushes (board royal)', () => {
	it('KNOWN BUG #1b: two royal flushes crash the payout machinery', () => {
		// buildComparator's 'Royal Flush' branch seeds its winners list with
		// Array.from({length: 1}) = [undefined] (cards.js:647), determineWinner
		// returns it verbatim, and payWinners dereferences undefined.name. This
		// was unreachable while bug #1 masked royal detection; fixing detection
		// made a board royal (community A-K-Q-J-10 suited, so every live player
		// holds a royal) reach it. The phantom entry also miscounts the split
		// (prize / 3 for 2 winners). When fixed: a clean two-way split, 500 each.
		expect(() =>
			runShowdown(
				[
					mkPlayer('P1', { chips: 500, bet: 500, cards: cc('2C 3D') }),
					mkPlayer('P2', { chips: 500, bet: 500, cards: cc('4S 5C') }),
				],
				'AH KH QH JH 10H'
			)
		).toThrow(TypeError);
	});
});

describe('showdown: wheel vs higher straight', () => {
	it('the ace-low wheel loses to a six-high straight', () => {
		const state = runShowdown(
			[
				mkPlayer('Wheel',  { chips: 500, bet: 500, cards: cc('AH 2H') }), // 5-4-3-2-A
				mkPlayer('SixHigh', { chips: 500, bet: 500, cards: cc('6S 2D') }), // 6-5-4-3-2
			],
			'3C 4D 5S 9H KC'
		);
		expect(hierarchyNames(state)).toEqual(['SixHigh', 'Wheel']);
		expect(state.players.find(p => p.name === 'SixHigh').chips).toBe(1500);
	});
});

describe('showdown: full house vs flush ordering', () => {
	it('rank buckets beat kickers: a full house beats any flush', () => {
		const state = runShowdown(
			[
				mkPlayer('Boat',  { chips: 500, bet: 500, cards: cc('9C 9D') }), // 999-KK
				mkPlayer('Flush', { chips: 500, bet: 500, cards: cc('AH QH') }), // nut flush
			],
			'9H KH KS 2H 7D'
		);
		expect(hierarchyNames(state)).toEqual(['Boat', 'Flush']);
		expect(state.players.find(p => p.name === 'Boat').chips).toBe(1500);
	});
});
