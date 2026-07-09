// Shared factories for unit tests. Mirrors the shapes created in
// utils/players.js (player objects) and App.jsx (app state).

export const VALUE_MAP = {
	2: 1,
	3: 2,
	4: 3,
	5: 4,
	6: 5,
	7: 6,
	8: 7,
	9: 8,
	10: 9,
	J: 10,
	Q: 11,
	K: 12,
	A: 13,
};

const SUIT_MAP = {
	H: 'Heart',
	S: 'Spade',
	C: 'Club',
	D: 'Diamond',
};

// c('AH') -> { cardFace: 'A', suit: 'Heart', value: 13 }
// c('10S') -> { cardFace: '10', suit: 'Spade', value: 9 }
export const c = (code) => {
	const suit = SUIT_MAP[code.slice(-1)];
	const cardFace = code.slice(0, -1);
	if (!suit || !(cardFace in VALUE_MAP)) throw Error(`Bad card code: ${code}`);
	return { cardFace, suit, value: VALUE_MAP[cardFace] };
};

// cc('AH KH QH') -> [card, card, card]
export const cc = (codes) => codes.trim().split(/\s+/).map(c);

export const mkPlayer = (name, overrides = {}) => {
	const player = {
		id: name,
		name,
		avatarURL: '',
		cards: [],
		chips: 10000,
		bet: 0,
		betReconciled: false,
		folded: false,
		allIn: false,
		robot: false,
		canRaise: true,
		stackInvestment: 0,
		roundEndChips: 0,
		currentRoundChipsInvested: 0,
		showDownHand: {
			hand: [],
			descendingSortHand: [],
		},
		...overrides,
	};
	if (overrides.roundStartChips === undefined) {
		player.roundStartChips = player.chips + player.bet;
	}
	return player;
};

export const mkState = (players, overrides = {}) => ({
	players,
	numPlayersActive: players.filter(p => !p.folded).length,
	numPlayersFolded: players.filter(p => p.folded).length,
	numPlayersAllIn: players.filter(p => p.allIn).length,
	activePlayerIndex: 0,
	dealerIndex: 0,
	blindIndex: {
		big: Math.min(2, players.length - 1),
		small: Math.min(1, players.length - 1),
	},
	deck: [],
	communityCards: [],
	pot: 0,
	highBet: 0,
	betInputValue: 0,
	minBet: 20,
	sidePots: [],
	phase: 'betting1',
	playerHierarchy: [],
	showDownMessages: [],
	playActionMessages: [],
	clearCards: false,
	...overrides,
});

export const totalChipsInPlay = (state) =>
	state.players.reduce((sum, p) => sum + p.chips + p.bet, 0) + state.pot;
