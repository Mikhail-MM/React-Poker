// Cascade trace tests: capture the INTERMEDIATE state transitions that a
// single player action drives through the transform pipeline — the states
// React never renders. Each snapshot is an ordered log of the state as it
// crossed every module seam (see testUtils/trace.js for how and for the
// same-module blind spots).
import { traceGameFlow, betModule } from '../testUtils/trace.js';
import { cc, mkPlayer, mkState } from '../testUtils/factories.js';

describe('cascade traces', () => {
	it('a call that closes pre-flop betting cascades through the flop deal', () => {
		// P1/P2 already matched; P0's call ends betting1: the turn cursor finds a
		// reconciled player, shifts phase, reconciles the pot (visible in the
		// dealFlop entry state), and deals the flop.
		const state = mkState(
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
			}
		);
		const { trace } = traceGameFlow(() => betModule.handleBet(state, 20, 20, 1000));
		expect(trace.map(step => step.seam)).toEqual([
			'handleBet',
			'determineNextActivePlayer',
			'handlePhaseShift',
			'dealFlop',
			'determinePhaseStartActivePlayer',
			'(final)',
		]);
		expect(trace).toMatchSnapshot();
	});

	it('a fold that leaves one player cascades to a board runout and showdown', () => {
		// P1 already folded; P2's fold leaves P0 alone: the cursor short-circuits
		// into dealMissingCommunityCards -> reconcilePot -> showDown, all in one
		// synchronous transform.
		const state = mkState(
			[
				mkPlayer('P0', { chips: 900, bet: 100, betReconciled: true, cards: cc('2H 7C') }),
				mkPlayer('P1', { chips: 900, bet: 100, folded: true, betReconciled: true, cards: cc('AS KS') }),
				mkPlayer('P2', { chips: 900, bet: 100, cards: cc('AD KD') }),
			],
			{
				activePlayerIndex: 2,
				highBet: 100,
				phase: 'betting2',
				communityCards: cc('9H 10H JH'),
				deck: cc('QS 2D'),
			}
		);
		const { trace } = traceGameFlow(() => betModule.handleFold(state));
		expect(trace.map(step => step.seam)).toEqual([
			'handleFold',
			'determineNextActivePlayer',
			'dealMissingCommunityCards',
			'reconcilePot',
			'showDown',
			'(final)',
		]);
		expect(trace).toMatchSnapshot();
	});

	it('a river call cascades through reconciliation into the showdown', () => {
		// NOTE: reconcilePot does NOT appear as a seam here — handlePhaseShift
		// calls it within bet.js (same-module call, invisible to the tracer).
		// Its effect is only observable in the showDown entry state: bets are
		// swept into pot/sidePots. This is the tracer's core blind spot.
		const state = mkState(
			[
				mkPlayer('Ann', { chips: 700, bet: 300, cards: cc('AH KH') }),
				mkPlayer('Ben', { chips: 700, bet: 300, betReconciled: true, cards: cc('9C 9D') }),
			],
			{
				activePlayerIndex: 0,
				highBet: 300,
				phase: 'betting4',
				communityCards: cc('QH JH 10H 2S 7D'),
				deck: [],
			}
		);
		const { trace } = traceGameFlow(() => betModule.handleBet(state, 300, 300, 1000));
		expect(trace.map(step => step.seam)).toEqual([
			'handleBet',
			'determineNextActivePlayer',
			'handlePhaseShift',
			'showDown',
			'(final)',
		]);
		expect(trace).toMatchSnapshot();
	});
});
