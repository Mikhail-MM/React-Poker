import { dealFlop, dealTurn, dealRiver, showDown } from './cards.js';
/*
const determineBlindIndices = (dealerIndex, numPlayers) => {
	let bigBlindIndex;
	let smallBlindIndex;
	/*return({
		bigBlindIndex: (dealerIndex + 2) % numPlayers,
		smallBlindIndex: (dealerIndex + 1) % numPlayers
	})

		This method is unnecessary if we reverse the array of players. The idea is that when we iterate on an array, we move from left to right. However, when determining 
	the position of the blinds and taking turns in poker, we actually move from right to left. To follow with the rhythm of Poker, we would be iterating the index  of the 
	active playerDOWN ... leading to issues -
	since we can go below 0 (If we go over the length of the array, we can return to the start by doing modulo % array.length. However, itertaing down, we will reach -1, and would need to compensate)



	if ((dealerIndex - 2) < 0) {
		// Ensure that we cycle around to the other end of the array if moving left of the Dealer chip brings us to a negative 
		bigBlindIndex = ((dealerIndex - 2) % numPlayers) + numPlayers
	} else {
		bigBlindIndex = dealerIndex - 2
	}	
	if ((dealerIndex - 1) < 0) {
		smallBlindIndex = ((dealerIndex - 1) % numPlayers) + numPlayers
	} else { 
		smallBlindIndex = dealerIndex - 1
	}
	
	return { bigBlindIndex, smallBlindIndex }	
}
*/

import { handleOverflowIndex } from './players.js';

const determineBlindIndices = (dealerIndex, numPlayers) => {
	return({
		bigBlindIndex: (dealerIndex + 2) % numPlayers,
		smallBlindIndex: (dealerIndex + 1) % numPlayers,
	});
}

const anteUpBlinds = (players, blindIndices, minBet) => {

	const { bigBlindIndex, smallBlindIndex } = blindIndices;
	players[bigBlindIndex].bet = minBet;
	players[bigBlindIndex].chips = players[bigBlindIndex].chips - minBet;
	players[smallBlindIndex].bet = minBet / 2;
	players[smallBlindIndex].chips = players[smallBlindIndex].chips - (minBet / 2);
		return players
}

const determineMinBet = (highBet, playerChips) => {
	if (playerChips < highBet) {
		return playerChips;
	} else {
		return highBet;
	}
}
const handleBet = (state, bet, min, max) => {
	console.log(min)
	console.log(max)
	if (bet < min) return console.log("Invalid Bet")
	if (bet > max) return console.log("Invalid Bet")

	if (bet > state.highBet) {
		// minbet and highbet may be condensed to a single property
		state.highBet = bet;
		state.minBet = state.highBet;
		for (let player of state.players) {
			if (!player.folded || !player.chips === 0) {
				player.betReconciled = false;
			}
		}
	}

	const activePlayer = state.players[state.activePlayerIndex];
		const subtractableChips = bet - activePlayer.bet;
		activePlayer.bet = bet;
		activePlayer.chips = activePlayer.chips - subtractableChips;
		if (activePlayer.chips === 0) {
			state.numPlayersAllIn++
		}
		activePlayer.betReconciled = true;
	

	determineNextActivePlayer(state)
	return state
}

const handleFold = (state) => {
	const activePlayer = state.players[state.activePlayerIndex];
		activePlayer.folded = true;
		activePlayer.betReconciled = true;
		state.numPlayersFolded++
		state.numPlayersActive--

		const nextState = determineNextActivePlayer(state)
		return nextState
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

const handlePhaseShift = (state) => {
	switch(state.phase) {
		case('betting1'): {
			state.phase = 'flop';
			return dealFlop(reconcilePot(state));
		}
		case('betting2'): {
			state.phase = 'turn';
			return dealTurn(reconcilePot(state));
		}
		case('betting3'): {
			state.phase = 'river'
			return dealRiver(reconcilePot(state));
		}
		case('betting4'): {
			state.phase = 'showdown'
			return showDown(reconcilePot(state));
		}
	}
	return reconcilePot(state)
}

const reconcilePot = (state) => {
	// TODO: ENSURE that bet matches up with side pot - do not exceed low bet input when have a player betting 500 and one betting 1000
	for (let player of state.players) {
		state.pot = state.pot + player.bet;
		player.bet = 0;
		player.betReconciled = false;
	}
	state.minBet = 0;
	state.highBet = 0;
	return state
}

export { 
	determineBlindIndices, 
	anteUpBlinds, 
	determineMinBet,
	handleBet,
	handleFold,
}