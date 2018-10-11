import { handlePhaseShift } from './bet.js';
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
		chips: 2000,
		potChipLimit: 2000,
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
			chips: 2000,
			potChipLimit: 2000,
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
	// TODO: Automatically give pot to last player if numActivePlayers === 1;
	if (state.players[state.activePlayerIndex].folded) {
		return determineNextActivePlayer(state);
	}
	if (state.players[state.activePlayerIndex].chips === 0) {
		if (state.numPlayersAllIn === state.numPlayersActive) {
			// TODO: Ensure Community Cards Are Distributed Properly!
			state.phase = 'showdown';
			return state
		} else {
			return determineNextActivePlayer(state);
		}
	}
	if (state.players[state.activePlayerIndex].betReconciled) {
		return handlePhaseShift(state);
	}
			return state
}

export { generateTable, handleOverflowIndex, determineNextActivePlayer, determinePhaseStartActivePlayer }