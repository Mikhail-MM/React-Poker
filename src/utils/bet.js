import { dealFlop, dealTurn, dealRiver, showDown } from './cards.js';
import { handleOverflowIndex, determineNextActivePlayer } from './players.js';
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
	for (let player of state.players) {
		state.pot = state.pot + player.bet;
		player.sidePotStack = player.bet; // sidePotStack is just a copy of player.bet which can be reference and mutated in side pot calculations
		player.betReconciled = false; // This is used as a marker to determine whether to adv to next round of betting
	}
	state = calculateSidePots(state, state.players)

	for (let player of state.players) {
		player.bet = 0 // Reset all player bets to 0 for the start of the next round
	}

	state.minBet = 0; // Reset markers which control min/max bet validation
	state.highBet = 0;
	state.betInputValue = 0;
		return state
}


const calculateSidePots = (state, playerStacks) => {
	// Filter out all players who either
	// 		1) Upon first iteration of the function - did not bet this round
	//		2) Upon subsequent iterations, already had a side pot built for them
	const investedPlayers = playerStacks.filter(player => player.sidePotStack > 0)
	if (investedPlayers.length === 0) {
		// Function completed, exit.
		return state
	}
	if (investedPlayers.length === 1) {
		// This condition occurs when there is a single player who has bet an excess amount of chips. Refund and exit.
		const playerToRefund = state.players[state.players.findIndex(player => player.name === investedPlayers[0].name)];
		playerToRefund.chips = playerToRefund.chips + investedPlayers[0].sidePotStack;
			return state
	}
		// Sort all players, Smallest stack first.
		const ascBetPlayers = investedPlayers.sort((a,b) => a.sidePotStack - b.sidePotStack);
		const smallStackValue = ascBetPlayers[0].sidePotStack;
		
		const builtSidePot = ascBetPlayers.reduce((acc, cur) => {
			/***
				If we have a group of players with this bet configuration
				[100, 200, 300, 500, 1000]
					We build a side pot for the player with 100 chips invested, by subtracting 100 from each index and accumulating them.
					Each player who we subtract from is an eligible contestant
						We should end up with [0, 100, 300, 500, 100] in the original array
						And the accumulator will be { potValue: 500, contestants[(all the players in the original array)]}
						Mutations will be done to the original array to persist changes
							We can pass this to the next iteration of the function to repeat logic recursively
			***/
			if (!cur.folded) {
				acc.contestants.push(cur.name);
			}
			acc.potValue = acc.potValue + smallStackValue;
			cur.sidePotStack = cur.sidePotStack - smallStackValue
				return acc
		}, {
			contestants: [],
			potValue: 0,
		});
			state.sidePots.push(builtSidePot);
				return calculateSidePots(state, ascBetPlayers)

				// An issue is that these pots are not consolidated when some players fold out and leave - we will have 2 pots with the same contestants!
}

export { 
	determineBlindIndices, 
	anteUpBlinds, 
	determineMinBet,
	handleBet,
	handleFold,
	handlePhaseShift,
}

/*

P1		P2		P3		P4
500		1000	500		300  chip totals
|		|		|		|	
all-in     call   	call 	raiseTo
500		250     250     300		betting
|		|		|		|
fold 	fold 	call    |
				300		|  go to next round

P1		P2		P3		P4
250		750		200		0

Pot: 1100 Chips

[250, 250, 300, 500]
*/