// Snapshot tests for the hand evaluator and the showdown pipeline.
// Snapshots pin the exact 5-card best hand the evaluator constructs for every
// rank (including the ace-low edge cases) and the full sanitized outcome of
// the canonical showdown scenarios. Cards serialize as compact codes ('AH').
//
// These complement the targeted assertions in cards.showdown.test.js: a
// behavior change anywhere in evaluation, ranking, side-pot math, or message
// building shows up here as a snapshot diff.
import { showDown } from './cards.js';
import { reconcilePot } from './bet.js';
import { cc, codes, mkPlayer, mkState } from '../testUtils/factories.js';

// Evaluate a single hand: no pots to pay, just the evaluator's verdict.
const evaluate = (holeCodes, boardCodes) => {
	const state = showDown(
		mkState([mkPlayer('Solo', { cards: cc(holeCodes) })], {
			communityCards: cc(boardCodes),
			phase: 'showdown',
		})
	);
	const { bestHandRank, bestHand } = state.players[0].showDownHand;
	return { rank: bestHandRank, bestHand: codes(bestHand) };
};

describe('best-hand construction per rank', () => {
	it('royal flush (KNOWN BUG #1: reported as Straight Flush)', () => {
		expect(evaluate('AH KH', 'QH JH 10H 2S 7D')).toMatchSnapshot();
	});

	it('straight flush', () => {
		expect(evaluate('9H 8H', '7H 6H 5H KS AD')).toMatchSnapshot();
	});

	it('steel wheel (ace-low straight flush)', () => {
		expect(evaluate('AH 2H', '3H 4H 5H KS 9D')).toMatchSnapshot();
	});

	it('four of a kind with kicker', () => {
		expect(evaluate('AS AC', 'AH AD KS 2C 3D')).toMatchSnapshot();
	});

	it('full house', () => {
		expect(evaluate('KS KC', 'KH QS QC 2D 3H')).toMatchSnapshot();
	});

	it('full house from two trips takes the higher trip', () => {
		expect(evaluate('KS KC', 'KH QS QC QD 3H')).toMatchSnapshot();
	});

	it('flush', () => {
		expect(evaluate('AH 9H', 'KH 4H 2H JS QC')).toMatchSnapshot();
	});

	it('straight', () => {
		expect(evaluate('9S 8D', '7H 6C 5S KD AC')).toMatchSnapshot();
	});

	it('wheel (ace-low straight)', () => {
		expect(evaluate('AS 2D', '3C 4H 5S KD 9H')).toMatchSnapshot();
	});

	it('three of a kind with two kickers', () => {
		expect(evaluate('7C 7D', '7H KS QD 2C 3S')).toMatchSnapshot();
	});

	it('two pair with kicker', () => {
		expect(evaluate('KS QD', 'KH QC 9S 2D 3C')).toMatchSnapshot();
	});

	it('pair with three kickers', () => {
		expect(evaluate('JS JD', 'AH 8C 5S 2D 3H')).toMatchSnapshot();
	});

	it('no pair takes the top five cards', () => {
		expect(evaluate('AS JD', '9H 7C 5S 2D QH')).toMatchSnapshot();
	});
});

// Sanitized view of everything the showdown decides: pots, ranking, payouts.
const summarizeShowdown = (state) => ({
	sidePots: state.sidePots,
	hierarchy: state.playerHierarchy.map(entry =>
		Array.isArray(entry)
			? entry.map(p => ({ name: p.name, handRank: p.handRank, bestHand: codes(p.bestHand) }))
			: { name: entry.name, handRank: entry.handRank, bestHand: codes(entry.bestHand) }
	),
	messages: state.showDownMessages,
	players: state.players.map(p => ({
		name: p.name,
		chips: p.chips,
		folded: p.folded,
		rank: p.showDownHand.bestHandRank,
	})),
	residualPot: state.pot,
});

describe('full showdown outcomes', () => {
	it('capped all-in with layered side pots and dead money', () => {
		let state = mkState(
			[
				mkPlayer('Alice', { chips: 0, bet: 200, allIn: true, cards: cc('AH KH') }),
				mkPlayer('Bob', { chips: 1200, bet: 800, cards: cc('8H 3H') }),
				mkPlayer('Carol', { chips: 1200, bet: 800, cards: cc('5H 4H') }),
				mkPlayer('Dave', { chips: 0, bet: 600, allIn: true, cards: cc('2D 7C') }),
				mkPlayer('Eve', { chips: 900, bet: 100, folded: true, cards: cc('9S 4C') }),
			],
			{ communityCards: cc('10H JH QH 2S 7D'), phase: 'betting4' }
		);
		state = showDown(reconcilePot(state));
		expect(summarizeShowdown(state)).toMatchSnapshot();
	});

	it('exact tie with an odd chip (KNOWN BUG #3: chip stranded in pot)', () => {
		let state = mkState(
			[
				mkPlayer('Xavier', { chips: 500, bet: 375, cards: cc('2H 3H') }),
				mkPlayer('Yvonne', { chips: 500, bet: 375, cards: cc('2D 4D') }),
				mkPlayer('Zed', { chips: 500, bet: 51, folded: true, cards: cc('JS QS') }),
			],
			{ communityCards: cc('5S 6D 7H 8C 9S'), phase: 'betting4' }
		);
		state = showDown(reconcilePot(state));
		expect(summarizeShowdown(state)).toMatchSnapshot();
	});
});
