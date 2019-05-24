import { dealFlop, dealTurn, dealRiver, showDown } from './cards.js';
import { determineNextActivePlayer } from './players.js';

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

const determineMinBet = (highBet, playerChipsStack, playerBet) => {
	const playerTotalChips = playerChipsStack + playerBet
	if (playerTotalChips < highBet) {
		return playerTotalChips;
	} else {
		return highBet;
	}
}
const handleBet = (state, bet, min, max) => {
	if (bet < min) {
		state.betInputValue = min;
		return console.log("Invalid Bet")
	}
	if (bet > max) {
		state.betInputValue = max;
		return console.log("Invalid Bet")
	}

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
			activePlayer.allIn = true;
			state.numPlayersAllIn++
		}
		activePlayer.betReconciled = true;
	return determineNextActivePlayer(state)
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
		default: throw Error("handlePhaseShift() called from non-betting phase")
	}
}

const reconcilePot = (state) => {
	for (let player of state.players) {

		state.pot = state.pot + player.bet;

		player.sidePotStack = player.bet;
		player.betReconciled = false; // This is used as a marker to determine whether to adv to next round of betting
	}

		// Why would we even need to condense sidepots?
		// When would there be a situation where there were 2 sidepots with the same player names? 
		// Well, if there were 2 rounds of betting and all players called in
		/*
			[{
				contestants: ["Jim", "Mary", "Jake"],
				pot: 2000 // FROM THE FLOP
			},
			{
				contestatnts: ["Jim", "Mary", "Jake"],
				pot: 3100 // FROM THE TURN
			}]
			It's in our interest to condense these since processing each one requires us to make card comparator functions, which are the most expensive functions here (lots of sorting, etc)
		*/
	state = condenseSidePots(calculateSidePots(state, state.players));

	for (let player of state.players) {
		player.currentRoundChipsInvested += player.bet;
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
		state.pot -= investedPlayers[0].sidePotStack
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
			We should end up with [0, 100, 200, 400, 900] in the original array
			And the accumulator will be { potValue: 500, contestants[(all the players in the original array)]}
			Mutations will be done to the original array to persist changes
				We can pass this to the next iteration of the function to repeat logic recursively, filtering out the "0"
				[100, 200, 400, 900] --> [0, 100, 300, 800] {potValue: 400}
				[100, 300, 800] -> [0, 200, 700] {potValue: 300}
				[200, 700] -> [0, 500] {potValue: 400} --> refund 500
***/
			if (!cur.folded) {
				acc.contestants.push(cur.name);
			}
			acc.potValue = acc.potValue + smallStackValue;
			cur.sidePotStack = cur.sidePotStack - smallStackValue;
				return acc
		}, {
			contestants: [],
			potValue: 0,
		});
			state.sidePots.push(builtSidePot);
				return calculateSidePots(state, ascBetPlayers)

}

const condenseSidePots = (state) => {
	if (state.sidePots.length > 1) {
		for (let i = 0; i < state.sidePots.length; i++) {
			for (let n = i + 1; n < state.sidePots.length; n++ ) {
				if (arrayIdentical(state.sidePots[i].contestants, state.sidePots[n].contestants)) {
					state.sidePots[i].potValue = state.sidePots[i].potValue + state.sidePots[n].potValue;
					state.sidePots = state.sidePots.filter((el, index) => index !== n);
				}
			}
		}
	}
		return state	
}

const arrayIdentical = (arr1, arr2) => {

	if (arr1.length !== arr2.length) {
		return false
	}
		return arr1.map(el => arr2.includes(el)).filter(bool => bool !== true).length !== 0 ? false : true;
		// Can be simplified return arr1.every(el => arr2.includes(el));
}
export { 
	determineBlindIndices, 
	anteUpBlinds, 
	determineMinBet,
	handleBet,
	handleFold,
	handlePhaseShift,
	reconcilePot
}