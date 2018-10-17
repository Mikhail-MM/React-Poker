import { handlePhaseShift, reconcilePot, anteUpBlinds, determineBlindIndices } from './bet.js';
import { dealMissingCommunityCards, showDown, generateDeckOfCards, shuffle, dealPrivateCards } from './cards.js';

const axios = require('axios')
// TODO Generate UUID to simulate User ID and really get a perf match on binding to players when determining winnings
const generateTable = async () => {
	const users = [{
		name: 'Scarface Bojangles',
		avatarURL: '/assets/boy.svg',
		cards: [],
		showDownHand: {
			hand: [],
			descendingSortHand: [], 
		},
		chips: 20000,
		roundStartChips: 2000,
		bet: 0,
		betReconciled: false,
		folded: false,
	}];

	const response = await axios.get(`https://randomuser.me/api/?results=5&nat=us,gb,fr`);
	let randomUsers = response.data.results
		.map(user => ({ 
			name: `${user.name.first.charAt(0).toUpperCase()}${user.name.first.slice(1)} ${user.name.last.charAt(0).toUpperCase()}${user.name.last.slice(1)}`,
			avatarURL: user.picture.large,
			cards: [],
			chips: Math.floor(Math.random() * (20000 - 2000)) + 2000,
			roundStartChips: 2000,
			showDownHand: {
				hand: [],
				descendingSortHand: [],
			},
			bet: 0,
			betReconciled: false,
			folded: false,
		}))
		.forEach(user => users.push(user))

	return users
}

const handleOverflowIndex = (currentIndex, incrementBy, arrayLength, direction) => {
	switch (direction) {
		case('up'): {
			return (
				(currentIndex + incrementBy) % arrayLength
			)
		}
		case('down'): {
			return (
				((currentIndex - incrementBy) % arrayLength) + arrayLength 
			)
		}
	}
}

const determinePhaseStartActivePlayer = (state, recursion = false) => {
	if (!recursion) {
		state.activePlayerIndex = handleOverflowIndex(state.blindIndex.big, 1, state.players.length, 'up');
	} else if (recursion) {
		state.activePlayerIndex = handleOverflowIndex(state.activePlayerIndex, 1, state.players.length, 'up');
	}
		if (state.players[state.activePlayerIndex].folded) {
			return determinePhaseStartActivePlayer(state, true)
		}
		if (state.players[state.activePlayerIndex].chips === 0) {
			return determinePhaseStartActivePlayer(state, true)
		}
				return state
}

const determineNextActivePlayer = (state) => {
	state.activePlayerIndex = handleOverflowIndex(state.activePlayerIndex, 1, state.players.length, 'up')
	if (state.numPlayersActive ===  1) {
		return(showDown(reconcilePot(dealMissingCommunityCards(state))))
	}
	if (state.players[state.activePlayerIndex].folded) {
		return determineNextActivePlayer(state);
	}
	if (state.players[state.activePlayerIndex].chips === 0) {
		if (state.numPlayersAllIn === state.numPlayersActive) {
			return(showDown(reconcilePot(dealMissingCommunityCards(state))))
		} else {
			return determineNextActivePlayer(state);
		}
	}
	if (state.players[state.activePlayerIndex].betReconciled) {
		return handlePhaseShift(state);
	}
			return state
}

const passDealerChip = (state) => {
	// This is messy because we are determining active player, dealer, and blinds based on an arbitrary index, not with flags on player entries.
	// When we remove all players who have ran out of chips, the new indices will not match up cleanly. We need to find the index of the player, keep track of who it is or 
	state.dealerIndex = handleOverflowIndex(state.dealerIndex, 1, state.players.length, 'up');
	const nextDealer = state.players[state.dealerIndex]
	if (nextDealer.chips === 0) {
		return passDealerChip(state)
	}

		return filterBrokePlayers(state, nextDealer.name);
}

const filterBrokePlayers = (state, dealerID) => {
	state.players = state.players.filter(player => player.chips > 0);
	const newDealerIndex = state.players.findIndex(player => player.name === dealerID)
	state.dealerIndex = newDealerIndex
	state.activePlayerIndex = newDealerIndex
	if (state.players.length === 1) {
		// Victory!
		return state
	} else if (state.players.length === 2) {
		// Need to refine rules for who goes first when 2 players are left
		// Can move this logic to our determineBlindIndices fn
		state.blindIndex.small = newDealerIndex;
		state.blindIndex.big = handleOverflowIndex(newDealerIndex, 1, state.players.length, 'up');
		state.players = anteUpBlinds(state.players, { bigBlindIndex: state.blindIndex.big, smallBlindIndex: state.blindIndex.small }, state.minBet).map(player => ({
			...player,
			cards:[],
			showDownHand: {
				hand: [],
				descendingSortHand: [],
			},
			betReconciled: false,
			folded: false,
		}))
		state.numPlayersAllIn = 0;
		state.numPlayersFolded = 0;
		state.numPlayersActive = state.players.length;
	} else {
		const blindIndicies = determineBlindIndices(newDealerIndex, state.players.length);
		state.blindIndex = {
        	big: blindIndicies.bigBlindIndex,
        	small: blindIndicies.smallBlindIndex,
      	}
		state.players = anteUpBlinds(state.players, blindIndicies, state.minBet).map(player => ({
			...player,
			cards: [],
			showDownHand: {
				hand: [],
				descendingSortHand: [],
			},
			betReconciled: false,
			folded: false,
		}))
		state.numPlayersAllIn = 0; // May need to alter this is big/small blind brings a player all in
		state.numPlayersFolded = 0;
		state.numPlayersActive = state.players.length;
	}
		return dealPrivateCards(state)
}

const beginNextRound = (state) => {
	state.communityCards = [];
	state.sidePots = [];
	state.deck = shuffle(generateDeckOfCards())
	state.highBet = 20;
	state.minBet = 20; // can export out to initialState
	return passDealerChip(state)
}

// NEED INITIAL PLAYER STATE
// INITIAL TABLE STATE
export { generateTable, handleOverflowIndex, determineNextActivePlayer, determinePhaseStartActivePlayer, beginNextRound }