// Characterization tests for deck handling and hand-evaluation primitives in cards.js.
// These pin CURRENT behavior. Tests labeled "KNOWN BUG" assert buggy output on
// purpose (open census: docs/GAME_LOOP.md §9; resolved: docs/CHANGELOG.md) — flip them when the bug is fixed.
import {
	generateDeckOfCards,
	shuffle,
	popCards,
	dealPrivateCards,
	dealFlop,
	dealTurn,
	dealRiver,
	dealMissingCommunityCards,
	checkFlush,
	checkRoyalFlush,
	checkStraightFlush,
	checkStraight,
	analyzeHistogram,
	buildValueSet,
} from '../../cards.js';

import { c, cc, mkPlayer, mkState } from '../../../testUtils/factories.js';

const descending = (cards) => [...cards].sort((a, b) => b.value - a.value);

describe('generateDeckOfCards', () => {
	const deck = generateDeckOfCards();

	it('produces 52 unique cards, 13 per suit', () => {
		expect(deck).toHaveLength(52);
		const keys = new Set(deck.map(card => `${card.cardFace}-${card.suit}`));
		expect(keys.size).toBe(52);
		const hearts = deck.filter(card => card.suit === 'Heart');
		expect(hearts).toHaveLength(13);
	});

	it('maps card faces to the 1-13 value scale (2→1 ... A→13, so a Ten is 9)', () => {
		const byFace = (face, suit = 'Heart') =>
			deck.find(card => card.cardFace === face && card.suit === suit);
		expect(byFace('2').value).toBe(1);
		expect(byFace('10').value).toBe(9);
		expect(byFace('J').value).toBe(10);
		expect(byFace('Q').value).toBe(11);
		expect(byFace('K').value).toBe(12);
		expect(byFace('A').value).toBe(13);
	});
});

describe('shuffle', () => {
	it('returns all 52 cards with no empty slots', () => {
		const shuffled = shuffle(generateDeckOfCards());
		expect(shuffled).toHaveLength(52);
		expect(shuffled.every(card => card && card.cardFace && card.suit)).toBe(true);
		const keys = new Set(shuffled.map(card => `${card.cardFace}-${card.suit}`));
		expect(keys.size).toBe(52);
	});
});

describe('popCards', () => {
	it('pops from the END of the deck and does not mutate the original', () => {
		const deck = cc('2C 3C 4C 5C');
		const { mutableDeckCopy, chosenCards } = popCards(deck, 3);
		expect(chosenCards.map(card => card.cardFace)).toEqual(['5', '4', '3']);
		expect(mutableDeckCopy).toHaveLength(1);
		expect(deck).toHaveLength(4);
	});

	it('QUIRK: returns a bare card object (not an array) when popping 1 card', () => {
		// This shape inconsistency is why popShowdownCards exists (cards.js:83-88).
		const { chosenCards } = popCards(cc('2C 3C'), 1);
		expect(Array.isArray(chosenCards)).toBe(false);
		expect(chosenCards.cardFace).toBe('3');
	});
});

describe('checkFlush', () => {
	it('detects 5+ of a suit and reports the suit', () => {
		expect(checkFlush({ Heart: 5, Spade: 2 })).toEqual({ isFlush: true, flushedSuit: 'Heart' });
		expect(checkFlush({ Club: 6, Diamond: 1 })).toEqual({ isFlush: true, flushedSuit: 'Club' });
	});

	it('rejects 4 of a suit', () => {
		expect(checkFlush({ Heart: 4, Spade: 2, Club: 1 })).toEqual({ isFlush: false, flushedSuit: null });
	});
});

describe('checkStraight', () => {
	// checkStraight expects a DESCENDING unique-value set (buildValueSet of the
	// descending-sorted 7-card hand).
	const valueSetOf = (codes) => buildValueSet(descending(cc(codes)));

	it('detects a standard straight', () => {
		const result = checkStraight(valueSetOf('AH KS QC JD 10H 8S 3C'));
		expect(result.isStraight).toBe(true);
		expect(result.concurrentCardValues).toEqual([13, 12, 11, 10, 9]);
	});

	it('takes the top 5 of a 6-card run', () => {
		const result = checkStraight(valueSetOf('KH QS JC 10D 9H 8S 2C'));
		expect(result.isStraight).toBe(true);
		expect(result.concurrentCardValues).toEqual([12, 11, 10, 9, 8]);
	});

	it('detects the ace-low wheel (A-2-3-4-5)', () => {
		const wheel = checkStraight(valueSetOf('AH 9S 5C 4D 3H 2S 7C'));
		expect(wheel.isStraight).toBe(true);
		expect(wheel.isLowStraight).toBe(true);
		expect(wheel.concurrentCardValuesLow).toEqual([0, 1, 2, 3, 4]);
	});

	it('rejects a broken run', () => {
		const result = checkStraight(valueSetOf('KH QS JC 9D 8H 6S 2C'));
		expect(result.isStraight).toBe(false);
		expect(result.isLowStraight).toBe(false);
	});

	it('QUIRK: returns the bare primitive false for fewer than 5 unique values', () => {
		// Callers destructure this; every field silently comes back undefined.
		expect(checkStraight([13, 12, 11, 10])).toBe(false);
	});
});

describe('checkRoyalFlush', () => {
	it('detects a genuine royal flush (bug #1 fixed)', () => {
		const royal = descending(cc('AH KH QH JH 10H'));
		expect(checkRoyalFlush(royal)).toBe(true);
	});

	it('detects a royal at the top of a longer flush', () => {
		expect(checkRoyalFlush(descending(cc('AH KH QH JH 10H 3H 2H')))).toBe(true);
	});

	it('rejects a king-high straight flush', () => {
		expect(checkRoyalFlush(descending(cc('KH QH JH 10H 9H')))).toBe(false);
	});

	it('a royal flush also passes the straight-flush check (rank selection prefers Royal Flush)', () => {
		const royal = descending(cc('AH KH QH JH 10H'));
		const result = checkStraightFlush(royal);
		expect(result.isStraightFlush).toBe(true);
		expect(result.concurrentSFCardValues).toEqual([13, 12, 11, 10, 9]); // Adjusted for correct royal flush values
	});
});

describe('checkStraightFlush', () => {
	it('detects a straight flush from the flushed-suit cards only', () => {
		const flushCards = descending(cc('9H 8H 7H 6H 5H 2H'));
		const result = checkStraightFlush(flushCards);
		expect(result.isStraightFlush).toBe(true);
		expect(result.concurrentSFCardValues).toEqual([8, 7, 6, 5, 4]);
	});

	it('rejects a flush that is not a straight flush', () => {
		const flushCards = descending(cc('KH JH 8H 5H 2H'));
		expect(checkStraightFlush(flushCards).isStraightFlush).toBe(false);
	});
});

describe('analyzeHistogram', () => {
	// Signature is (hand, frequencyHistogram); the hand argument is unused.
	it('detects four of a kind', () => {
		const result = analyzeHistogram(null, { A: 4, 3: 2, 2: 1 });
		expect(result.isFourOfAKind).toBe(true);
		expect(result.frequencyHistogramMetaData.quads).toEqual([{ face: 'A', value: 13 }]);
	});

	it('detects a full house from a trip plus a pair', () => {
		const result = analyzeHistogram(null, { K: 3, Q: 2, 5: 1, 2: 1 });
		expect(result.isFullHouse).toBe(true);
		expect(result.isThreeOfAKind).toBe(true);
	});

	it('detects a full house from two trips, sorted descending', () => {
		const result = analyzeHistogram(null, { Q: 3, K: 3, 2: 1 });
		expect(result.isFullHouse).toBe(true);
		expect(result.frequencyHistogramMetaData.tripples.map(t => t.face)).toEqual(['K', 'Q']);
	});

	it('detects two pair and sorts pairs descending (kicker selection depends on it)', () => {
		const result = analyzeHistogram(null, { 9: 2, K: 2, Q: 2, 2: 1 });
		expect(result.isTwoPair).toBe(true);
		expect(result.frequencyHistogramMetaData.pairs.map(p => p.face)).toEqual(['K', 'Q', '9']);
	});

	it('detects a lone pair', () => {
		const result = analyzeHistogram(null, { 7: 2, K: 1, Q: 1, 9: 1, 3: 1 });
		expect(result.isPair).toBe(true);
		expect(result.isTwoPair).toBe(false);
		expect(result.isFullHouse).toBe(false);
	});
});

describe('buildValueSet', () => {
	it('dedupes values preserving order', () => {
		expect(buildValueSet(descending(cc('KH KS QC 9D 9H 2S')))).toEqual([12, 11, 8, 1]);
	});
});

describe('dealing', () => {
	const threePlayers = () => [mkPlayer('P0'), mkPlayer('P1'), mkPlayer('P2')];

	it('dealPrivateCards gives everyone 2 cards, then action starts left of the big blind', () => {
		const state = mkState(threePlayers(), {
			deck: cc('2C 3C 4C 5C 6C 7C 8C 9C'),
			activePlayerIndex: 0,
			blindIndex: { big: 2, small: 1 },
			phase: 'initialDeal',
		});
		const next = dealPrivateCards(state);
		next.players.forEach(player => expect(player.cards).toHaveLength(2));
		expect(next.deck).toHaveLength(2);
		expect(next.phase).toBe('betting1');
		expect(next.activePlayerIndex).toBe(0); // (big blind 2 + 1) % 3
		expect(next.clearCards).toBe(false);
	});

	it('dealFlop deals 3 community cards and opens betting2 left of the big blind', () => {
		const state = mkState(threePlayers(), {
			deck: cc('2C 3C 4C 5C 6C'),
			blindIndex: { big: 1, small: 0 },
			phase: 'flop',
		});
		const next = dealFlop(state);
		expect(next.communityCards.map(card => card.cardFace)).toEqual(['6', '5', '4']); // popped from deck end
		expect(next.deck).toHaveLength(2);
		expect(next.phase).toBe('betting2');
		expect(next.activePlayerIndex).toBe(2);
	});

	it('dealTurn and dealRiver deal 1 card each and advance the phase', () => {
		let state = mkState(threePlayers(), {
			deck: cc('2C 3C'),
			communityCards: cc('9H 10H JH'),
			blindIndex: { big: 1, small: 0 },
		});
		state = dealTurn(state);
		expect(state.communityCards).toHaveLength(4);
		expect(state.phase).toBe('betting3');
		state = dealRiver(state);
		expect(state.communityCards).toHaveLength(5);
		expect(state.phase).toBe('betting4');
	});

	it('dealFlop skips folded and broke players when picking the opener', () => {
		const players = [mkPlayer('P0'), mkPlayer('P1'), mkPlayer('P2', { folded: true }), mkPlayer('P3', { chips: 0 })];
		const state = mkState(players, {
			deck: cc('2C 3C 4C 5C'),
			blindIndex: { big: 1, small: 0 },
		});
		expect(dealFlop(state).activePlayerIndex).toBe(0); // 2 folded, 3 broke -> wraps to 0
	});

	it('dealMissingCommunityCards runs the board out to 5 and enters showdown', () => {
		const state = mkState(threePlayers(), {
			deck: cc('2C 3C 4C'),
			communityCards: cc('9H 10H JH'),
		});
		const next = dealMissingCommunityCards(state);
		expect(next.communityCards).toHaveLength(5);
		expect(next.deck).toHaveLength(1);
		expect(next.phase).toBe('showdown');
	});

	it('dealMissingCommunityCards is a no-op deal on a full board', () => {
		const state = mkState(threePlayers(), {
			deck: [],
			communityCards: cc('9H 10H JH QS 2D'),
		});
		const next = dealMissingCommunityCards(state);
		expect(next.communityCards).toHaveLength(5);
		expect(next.phase).toBe('showdown');
	});
});
