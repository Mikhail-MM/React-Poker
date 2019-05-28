import { cloneDeep } from 'lodash';
import { handleOverflowIndex, determinePhaseStartActivePlayer } from './players.js';

const totalNumCards = 52;
const suits = ['Heart', 'Spade', 'Club', 'Diamond'];
const cards = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const VALUE_MAP = {
	2:1,
	3:2,
	4:3,
	5:4,
	6:5,
	7:6,
	8:7,
	9:8,
	10:9,
	J:10,
	Q:11,
	K:12,
	A:13,
};

const randomizePosition = (min, max) => {
	min = Math.ceil(min);
  	max = Math.floor(max);
	return Math.floor(Math.random() * (max - min + 1)) + min;
}


const generateDeckOfCards = () => {
	const deck = [];

	for (let suit of suits) {
		for (let card of cards) {
			deck.push({
				cardFace: card,
				suit: suit,
				value: VALUE_MAP[card]
			})
		}
	}
		return deck
}

const shuffle = (deck) => {
	let shuffledDeck = new Array(totalNumCards);
	let filledSlots = [];
	for (let i = 0; i < totalNumCards; i++) {
		if (i === 51) {
			// Fill last undefined slot when only 1 card left to shuffle
			const lastSlot = shuffledDeck.findIndex((el) => typeof el == 'undefined');
				shuffledDeck[lastSlot] = deck[i];
				filledSlots.push(lastSlot);
		} else {
			let shuffleToPosition = randomizePosition(0, totalNumCards - 1);
				while (filledSlots.includes(shuffleToPosition)) {
					shuffleToPosition = randomizePosition(0, totalNumCards - 1);
				}
						shuffledDeck[shuffleToPosition] = deck[i];
						filledSlots.push(shuffleToPosition);
		}
	}
	return shuffledDeck
}

const popCards = (deck, numToPop) => {
	// Note: While this is a Shallow Copy, (It copies the references to the children) - note that we are mutating it by 
	// Actually modifying the array, NOT the children. This is why the length of mutableCopy changes, but that of deck 
	// Does not.
	const mutableDeckCopy = [...deck];
	let chosenCards;
	if (numToPop === 1) {
		chosenCards = mutableDeckCopy.pop();
	} else {
		chosenCards = [];
		for(let i = 0; i < numToPop; i++) {
			chosenCards.push(mutableDeckCopy.pop());
		}
	}
		return { mutableDeckCopy, chosenCards }
}

const popShowdownCards = (deck, numToPop) => {
	// When dealMissingCommunityCards was calling popCards() with the condition numToPop === 1
	// It was returning a raw object instead of an array, and calling a for...of loop, causing the program to crash
	// Until we can refactor this code and all of its calling functions 
	// (change the code for dealFlop/River/Turn to use a consistent .concat function instead of .push())
	// We'll just duplicat this code here and utilize it in dealMissingCommunityCards
	const mutableDeckCopy = [...deck];
	let chosenCards;
	if (numToPop === 1) {
		chosenCards = [mutableDeckCopy.pop()];
	} else {
		chosenCards = [];
		for(let i = 0; i < numToPop; i++) {
			chosenCards.push(mutableDeckCopy.pop());
		}
	}
		return { mutableDeckCopy, chosenCards }
}

const dealPrivateCards = (state) => {
	state.clearCards = false;
	let animationDelay = 0;
	while (state.players[state.activePlayerIndex].cards.length < 2) {
		const { mutableDeckCopy, chosenCards } = popCards(state.deck, 1);
		
		// Can export to a separate function - as it will be used in many places
		chosenCards.animationDelay = animationDelay;
		animationDelay = animationDelay + 250;

		const newDeck = [...mutableDeckCopy];
		state.players[state.activePlayerIndex].cards.push(chosenCards);

		state.deck = newDeck;
		state.activePlayerIndex = handleOverflowIndex(state.activePlayerIndex, 1, state.players.length, 'up');
	}
	if (state.players[state.activePlayerIndex].cards.length === 2) {
		state.activePlayerIndex = handleOverflowIndex(state.blindIndex.big, 1, state.players.length, 'up');
		state.phase = 'betting1';
			return state;
	} 
}

const dealFlop = (state) => {
	let animationDelay = 0;
	const { mutableDeckCopy, chosenCards } = popCards(state.deck, 3);
		
		for (let card of chosenCards) {
			card.animationDelay = animationDelay;
			animationDelay = animationDelay + 250;
			state.communityCards.push(card);
		}

		state.deck = mutableDeckCopy;
		state = determinePhaseStartActivePlayer(state)
		state.phase = 'betting2';
			
		return state;
}

const dealTurn = (state) => {
	const { mutableDeckCopy, chosenCards } = popCards(state.deck, 1);
	chosenCards.animationDelay = 0;
		
	state.communityCards.push(chosenCards);
	state.deck = mutableDeckCopy;
	state = determinePhaseStartActivePlayer(state)
	state.phase = 'betting3'

		return state
}

const dealRiver = (state) => {
	const { mutableDeckCopy, chosenCards } = popCards(state.deck, 1);
	chosenCards.animationDelay = 0;
		
		state.communityCards.push(chosenCards);
		state.deck = mutableDeckCopy;
		state = determinePhaseStartActivePlayer(state)
		state.phase = 'betting4'

			return state
}

const showDown = (state) => {
	for (let player of state.players) {
		const frequencyHistogram = {};
		const suitHistogram = {};

		player.showDownHand.hand = player.cards.concat(state.communityCards);
		player.showDownHand.descendingSortHand = player.showDownHand.hand.map(el => el).sort((a,b) => b.value - a.value); // This mutates showDownHand.hand in place(!!)

		player.showDownHand.descendingSortHand.forEach(card => {
			frequencyHistogram[card.cardFace] = (frequencyHistogram[card.cardFace] + 1 || 1);
			suitHistogram[card.suit] = (suitHistogram[card.suit] + 1 || 1);
		})

		// For Debugging
		player.frequencyHistogram = frequencyHistogram;
		player.suitHistogram = suitHistogram;

		const valueSet = buildValueSet(player.showDownHand.descendingSortHand);

		const { isFlush, flushedSuit } = checkFlush(suitHistogram);
		const flushCards = (isFlush) && player.showDownHand.descendingSortHand.filter(card => card.suit === flushedSuit);
		const isRoyalFlush = (isFlush) && checkRoyalFlush(flushCards);
		const { isStraightFlush, isLowStraightFlush, concurrentSFCardValues, concurrentSFCardValuesLow } = (isFlush) && checkStraightFlush(flushCards)
		const { isStraight, isLowStraight, concurrentCardValues, concurrentCardValuesLow } = checkStraight(valueSet);
		const { isFourOfAKind, isFullHouse, isThreeOfAKind, isTwoPair, isPair, frequencyHistogramMetaData } = analyzeHistogram(player.showDownHand.descendingSortHand, frequencyHistogram);
		const isNoPair = ((!isRoyalFlush) && (!isStraightFlush) && (!isFourOfAKind) && (!isFullHouse) && (!isFlush) && (!isStraight) && (!isThreeOfAKind) && (!isTwoPair) && (!isPair))
		
		// For debugging/organization purposes, can probably be eliminated
		player.showDownHand.bools = {
			isRoyalFlush,
			isStraightFlush,
			isFourOfAKind,
			isFullHouse,
			isFlush,
			isStraight,
			isThreeOfAKind,
			isTwoPair,
			isPair,
			isNoPair,
		}

		player.showDownHand.heldRankHierarchy = [{
			name: 'Royal Flush',
			match: isRoyalFlush,
		}, {
			name: 'Straight Flush',
			match: isStraightFlush
		}, {
			name: 'Four Of A Kind',
			match: isFourOfAKind,
		}, {
			name: 'Full House',
			match: isFullHouse,
		}, {
			name: 'Flush',
			match: isFlush,
		}, {
			name: 'Straight',
			match: isStraight,
		}, {
			name: 'Three Of A Kind',
			match: isThreeOfAKind,
		}, {
			name: 'Two Pair',
			match: isTwoPair,
		}, {
			name: 'Pair',
			match: isPair,
		}, {
			name: 'No Pair',
			match: isNoPair
		}];

		player.metaData = frequencyHistogramMetaData

		const highRankPosition = player.showDownHand.heldRankHierarchy.findIndex(el => el.match === true);
		player.showDownHand.bestHandRank = player.showDownHand.heldRankHierarchy[highRankPosition].name;
		player.showDownHand.bestHand = buildBestHand(player.showDownHand.descendingSortHand, player.showDownHand.bestHandRank, flushedSuit, flushCards, concurrentCardValues, concurrentCardValuesLow, isLowStraight, isLowStraightFlush, concurrentSFCardValues, concurrentSFCardValuesLow, frequencyHistogramMetaData)

	}
		
		/* 
			Rank Table (obj - MAP)
			Hands as Keys
			Arrays hold Player ID/Name
			Go down forEach
			When we find a contains - 

		*/

		 return distributeSidePots(state)

}

const buildBestHand = (hand, bestRank, flushedSuit, flushCards, concurrentCardValues, concurrentCardValuesLow, isLowStraight, isLowStraightFlush, concurrentSFCardValues, concurrentSFCardValuesLow, frequencyHistogramMetaData) => {
	// TODO: LOW STRAGHT, STRAIGHT FLUSH (++ LOW STRAIGHT FLUSH...)
	switch(bestRank) {
		case('Royal Flush'): {
			return flushCards.slice(0, 5)
		}
		case('Straight Flush'): {
			if (isLowStraightFlush && concurrentSFCardValues.length < 5) {
				concurrentSFCardValuesLow[0] = 13
				return concurrentSFCardValuesLow.reduce((acc, cur, index) => {
					if (index < 5) {
						acc.push(flushCards[flushCards.findIndex(match => match.value === cur)]);
					}
						return acc;
				}, []).reverse();
			} else {
				return concurrentSFCardValues.reduce((acc, cur, index) => {
					if (index < 5) {
						acc.push(flushCards[flushCards.findIndex(match => match.value === cur)]);
					}
						return acc;
				}, []);
			}
		}
		case('Four Of A Kind'): {
			const bestHand = [];
			let mutableHand = cloneDeep(hand);

			for (let i = 0; i < 4; i++) {
				const indexOfQuad = mutableHand.findIndex(match => match.cardFace === frequencyHistogramMetaData.quads[0].face);
				bestHand.push(mutableHand[indexOfQuad])
					mutableHand = mutableHand.filter((match, index) => index !== indexOfQuad)
			}

				return bestHand.concat(mutableHand.slice(0, 1))
		}
		case('Full House'): {
			const bestHand = [];
			let mutableHand = cloneDeep(hand);
			if (frequencyHistogramMetaData.tripples.length > 1) {
				for (let i = 0; i < 3; i++) {
					const indexOfTripple = mutableHand.findIndex(match => match.cardFace === frequencyHistogramMetaData.tripples[0].face);
					bestHand.push(mutableHand[indexOfTripple])
						mutableHand = mutableHand.filter((match, index) => index !== indexOfTripple)
				}
				for (let i = 0; i < 2; i++) {
					const indexOfPair = mutableHand.findIndex(match => match.cardFace === frequencyHistogramMetaData.tripples[1].face);
					bestHand.push(mutableHand[indexOfPair])
						mutableHand = mutableHand.filter((match, index) => index !== indexOfPair)
				}
					return bestHand
			} else {
				for (let i = 0; i < 3; i++) {
					const indexOfTripple = mutableHand.findIndex(match => match.cardFace === frequencyHistogramMetaData.tripples[0].face);
					bestHand.push(mutableHand[indexOfTripple])
						mutableHand = mutableHand.filter((match, index) => index !== indexOfTripple)
				}
				for (let i = 0; i < 2; i++) {
					const indexOfPair = mutableHand.findIndex(match => match.cardFace === frequencyHistogramMetaData.pairs[0].face);
					bestHand.push(mutableHand[indexOfPair])
						mutableHand = mutableHand.filter((match, index) => index !== indexOfPair)
				}
					return bestHand
			}
		}
		case('Flush'): {
			return flushCards.slice(0, 5)
		}
		case('Straight'): {
			if (isLowStraight && concurrentCardValues.length < 5) {
				concurrentCardValuesLow[0] = 13
				return concurrentCardValuesLow.reduce((acc, cur, index) => {
					if (index < 5) {
						acc.push(hand[hand.findIndex(match => match.value === cur)]);
					}
						return acc;
				}, []).reverse();
			} else {
				return concurrentCardValues.reduce((acc, cur, index) => {
					if (index < 5) {
						acc.push(hand[hand.findIndex(match => match.value === cur)]);
					}
						return acc;
				}, []);
			}
		}
		case('Three Of A Kind'): {
			const bestHand = [];
			let mutableHand = cloneDeep(hand);

			for (let i = 0; i < 3; i++) {
				const indexOfTripple = mutableHand.findIndex(match => match.cardFace === frequencyHistogramMetaData.tripples[0].face);
				bestHand.push(mutableHand[indexOfTripple])
					mutableHand = mutableHand.filter((match, index) => index !== indexOfTripple)
			}

				return bestHand.concat(mutableHand.slice(0, 2))
		}
		case('Two Pair'): {
			const bestHand = [];
			let mutableHand = cloneDeep(hand);
				for (let i = 0; i < 2; i++) {
					const indexOfPair = mutableHand.findIndex(match => match.cardFace === frequencyHistogramMetaData.pairs[0].face);
					bestHand.push(mutableHand[indexOfPair])
						mutableHand = mutableHand.filter((match, index) => index !== indexOfPair)
				}
				
				for (let i = 0; i < 2; i++) {

					const indexOfPair = mutableHand.findIndex(match => match.cardFace === frequencyHistogramMetaData.pairs[1].face);
					bestHand.push(mutableHand[indexOfPair])
						mutableHand = mutableHand.filter((match, index) => index !== indexOfPair)
				}
					return bestHand.concat(mutableHand.slice(0, 1))

		}
		case('Pair'): {
			const bestHand = [];
			let mutableHand = cloneDeep(hand);			
				for (let i = 0; i < 2; i++) {
					const indexOfPair = mutableHand.findIndex(card => card.cardFace === frequencyHistogramMetaData.pairs[0].face);
					// CONSIDER : 
					bestHand.push(mutableHand[indexOfPair])
						mutableHand = mutableHand.filter((card, index) => index !== indexOfPair)
				}
					return bestHand.concat(mutableHand.slice(0, 3))
				

		}
		case('No Pair'): {
			return hand.slice(0, 5)
		}
		default: throw Error('Recieved unfamiliar rank argument in buildBestHand()');
	}
}

const distributeSidePots = (state) => {
	state.playerHierarchy = buildAbsolutePlayerRankings(state);
	console.log("Ultimate Player Hierarchy Determined:")
	console.log(state.playerHierarchy);
	
	for (let sidePot of state.sidePots) {
		const rankMap = rankPlayerHands(state, sidePot.contestants);
		state = battleRoyale(state, rankMap, sidePot.potValue)
	}

	state.players = state.players.map(player => ({
		...player,
		roundEndChips: player.chips
	}));
	
	return state
}

const buildAbsolutePlayerRankings = (state) => {
	
	const activePlayers = state.players.filter(player => !player.folded);
	let hierarchy = [];
	// dupe logic from rankPlayerHands 
	const rankMap = new Map([
		['Royal Flush', []], 
		['Straight Flush', []],
		['Four Of A Kind', []],
		['Full House', []],
		['Flush', []],
		['Straight', []],
		['Three Of A Kind', []],
		['Two Pair', []],
		['Pair', []],
		['No Pair', []]
	]);

	activePlayers.forEach((player, playerIndex) => {
		const {
			name,
			showDownHand: { bestHandRank, bestHand }
		} = player;
		rankMap.get(bestHandRank).push({
			name,
			bestHand,
			playerIndex
		})
	})
	
	for (const [handRank, playersWhoHoldThisRank] of rankMap) {
		if (playersWhoHoldThisRank.length > 0) {
			if (handRank === 'Royal Flush') {
				const formattedPlayersWhoHoldThisRank = playersWhoHoldThisRank.map(player => ({
					name: player.name,
					bestHand: player.bestHand,
					handRank
				}))
				hierarchy = hierarchy.concat(formattedPlayersWhoHoldThisRank);
				continue;
			} 
			if (playersWhoHoldThisRank.length === 1) {
				const { name, bestHand } = playersWhoHoldThisRank[0];
				hierarchy = hierarchy.concat([{
					name,
					bestHand, 
					handRank
				}]);
			} else if (playersWhoHoldThisRank.length > 1) {
				const sortedComparator = buildComparator(handRank, playersWhoHoldThisRank)
				.map((snapshot) => { 
					return snapshot.sort((a, b) => b.card.value - a.card.value)
				});
				const winnerHierarchy = determineContestedHierarchy(sortedComparator, handRank);
				hierarchy = hierarchy.concat(winnerHierarchy);
			}
		}
   }

	return hierarchy;
}

const determineContestedHierarchy = (sortedComparator, handRank) => {
	let winnerHierarchy = [];
	let loserHierarchy = [];
	const processComparator = (comparator, round = 0) => {
		if (comparator[0].length === 1) {
			const { name, bestHand } = comparator[0][0]
			winnerHierarchy = winnerHierarchy.concat([{name, bestHand, handRank}])
			return;
		}
		let filterableComparator = sortedComparator.map(el => el);
		const frame = comparator[round];
		const { winningFrame, losingFrame } = processSnapshotFrame(frame);
		if (losingFrame.length > 0) {
			// Loser Hierarchy can have mixed types, Array of Objects OR Objects
			// The comparators will be processed differently
			// We will run processComparator on all entries. 
			// If it's a single object, we can just concat it right up to the winnerHierarchy
			// If it's an array, it's essentially a filtered comparator already and we will run it.
			// Initial Loserhierarchy: [{steve, card:8}]
			// losingFrame: [{dave, card:9}, {jim, card:4}]
			// New loserHierarchy: [[{dave, card:9}, {jim, card:4}], {steve, card:8}]
			const lowerTierComparator = filterableComparator.map(frame => {
				return frame.filter(snapshot => {
					return losingFrame.some(snapshotToMatchName => {
						return snapshotToMatchName.name === snapshot.name;
					})
				})
			})
			// Push the filtered comparator to the FRONT of the losers queue. 
			// Users who are eliminated earlier must be processed last, as they have worse cards than those who are eliminated later.
			loserHierarchy = [lowerTierComparator].concat(loserHierarchy);
		}
		if (winningFrame.length === 1) {
			const {name, bestHand} = winningFrame[0];
			winnerHierarchy = winnerHierarchy.concat([{
				name,
				bestHand,
				handRank
			}])
		} else if (round === (sortedComparator.length - 1)) {
			const filteredWinnerSnapshots = winningFrame.map(snapshot => ({
				name: snapshot.name,
				bestHand: snapshot.bestHand,
				handRank
			}))
			winnerHierarchy = winnerHierarchy.concat([filteredWinnerSnapshots]);
		} else {
			const higherTierComparator = filterableComparator.map(frame => {
				return frame.filter(snapshot => {
					return winningFrame.some(snapshotToMatchName => {
						return snapshotToMatchName.name === snapshot.name;
					})
				})
			})
			processComparator(higherTierComparator, (round + 1));
		}
	}

	const processLowTierComparators = (loserHierarchyFrame) => {
		if (loserHierarchy.length > 0) {
			const loserComparatorToProcess = loserHierarchyFrame[0];
			loserHierarchy = loserHierarchyFrame.slice(1);
			processComparator(loserComparatorToProcess);
			processLowTierComparators(loserHierarchy);
		}
	}
	processComparator(sortedComparator);
	processLowTierComparators(loserHierarchy);
	return winnerHierarchy;
}



const processSnapshotFrame = (frame) => {
	const highValue = frame[0].card.value;
	const winningFrame = frame.filter(snapshot => snapshot.card.value === highValue);
	const losingFrame = frame.filter(snapshot => snapshot.card.value < highValue);
	return { winningFrame, losingFrame }
}

const rankPlayerHands = (state, contestants) => {
	
	const rankMap = new Map([
		['Royal Flush', []], 
		['Straight Flush', []],
		['Four Of A Kind', []],
		['Full House', []],
		['Flush', []],
		['Straight', []],
		['Three Of A Kind', []],
		['Two Pair', []],
		['Pair', []],
		['No Pair', []]
	]);

	for (let contestant of contestants) {
		const playerIndex = state.players.findIndex(player => player.name === contestant);
		const player = state.players[playerIndex];
		if (!player.folded) {
			rankMap.get(player.showDownHand.bestHandRank).push({
				name: player.name,
				playerIndex,
				bestHand: player.showDownHand.bestHand,
			});
		}
	}
		return rankMap;
}

const battleRoyale = (state, rankMap, prize) => {
	let winnerFound = false;

	// Map.entries().find(([rank, contestants]) => { logic here })
	// We can iterate in insertion order this way as well: for (const [key, value] of map) {} .. for of loop will be MUCH cleaner
	rankMap.forEach((contestants, rank, map) => {
		if (!winnerFound) {
			if (contestants.length === 1) {
				winnerFound = true
				console.log("Uncontested Winner, ", contestants[0].name, " , beating out the competition with a ", rank)
				state = payWinners(state, contestants, prize, rank)
			} else if (contestants.length > 1) {
				console.log(contestants)
				winnerFound = true
				// Return Early. Build Truncated Comparators for different pair functions. length 4 for Pair, length 3 for 2 pairs, length 2 for full house/four of a kind, etc.
				const winners = determineWinner(buildComparator(rank, contestants), rank)
					if (winners.length === 1) {
					   console.log("Uncontested Winner, ", winners[0].name, " , beating out the competition with a ", rank)
						state = payWinners(state, winners, prize, rank)
					} else {
					   console.log("We have a tie! Split the pot amongst ", winners, " Who will take the pot with their ", rank)
						state = payWinners(state, winners, prize, rank)
					}
				// Send Contestants to Algo that Determines best hand of same ranks
				// (contestants is an array of all contestants)
			}
		}})
			return state
}

const payWinners = (state, winners, prize, rank) => {
	if(winners.length === 1) {
		state.showDownMessages = state.showDownMessages.concat([{
			users: [winners[0].name],
			prize,
			rank
		}]);
		console.log("Transferring ", prize, " chips to ", winners[0].name)
		state.players[winners[0].playerIndex].chips += prize
		state.pot -= prize
	} else if (winners.length > 1) {
		const overflow = prize % winners.length;
		const splitPot = Math.floor(prize / winners.length)
		console.log("Mediating Tie. Total Prize ", prize, " split into ", winners.length, " portions with an overflow of ", overflow)
		state.showDownMessages = state.showDownMessages.concat([{
			users: winners.map(winner => winner.name),
			prize: splitPot,
			rank
		}])
		winners.forEach(winner => {
			state.players[winner.playerIndex].chips += splitPot
			state.pot -= splitPot
		})
	}
		return state
}

const buildComparator = (rank, playerData) => {
	let comparator;
	switch(rank) {
		// TODO: Make These MORE DECLARATIVE!
		case('Royal Flush'): {
			comparator = Array.from({length: 1});
			playerData.forEach((playerShowdownData, index) => {
				comparator.push({
					name: playerData[index].name, // All Royal Flush hands are instant ties, we don't need to process these contestants further, just divide the pot between all players in this array
					playerIndex: playerData[index].playerIndex,
					bestHand: playerData[index].bestHand
				})
			})
			break 
		}
		case('Four Of A Kind'): {
			comparator = Array.from({length: 2}, () => Array.from({length: 0}))
			playerData.forEach((playerShowdownData, index) => {
				comparator[0].push({
					card: playerData[index].bestHand[0], // First Card (Quad) -- same as second, third, and fourth card
					name: playerData[index].name,
					playerIndex: playerData[index].playerIndex,
					bestHand: playerData[index].bestHand
				})
				comparator[1].push({
					card: playerData[index].bestHand[4], // Last Card (Kicker)
					name: playerData[index].name,
					playerIndex: playerData[index].playerIndex,
					bestHand: playerData[index].bestHand
				})
			})
			break 
		}
		case('Full House'): {
			comparator = Array.from({length: 2}, () => Array.from({length: 0}))
			playerData.forEach((playerShowdownData, index) => {
				comparator[0].push({
					card: playerData[index].bestHand[0], // First Card (Tripple) -- same as second and third card
					name: playerData[index].name,
					playerIndex: playerData[index].playerIndex,
					bestHand: playerData[index].bestHand
				})
				comparator[1].push({
					card: playerData[index].bestHand[3], // Fourth Card (Pair) -- same as fifth card
					name: playerData[index].name,
					playerIndex: playerData[index].playerIndex,
					bestHand: playerData[index].bestHand
				})
			})
			break 
		}
		case('Flush'):
		case('No Pair'): {
			comparator = Array.from({length: 5}, () => Array.from({length: 0}))
				playerData.forEach((playerShowdownData, index) => {
					for (let i = 0; i < 5; i++) {
						comparator[i].push({
							card: playerData[index].bestHand[i], // We need to check all 5 cards of a flush/no-pair
							name: playerData[index].name,
							playerIndex: playerData[index].playerIndex,
							bestHand: playerData[index].bestHand
						})
					}
				})
				break
		}
		case('Three Of A Kind'): {
			comparator = Array.from({length: 3}, () => Array.from({length: 0}))
			playerData.forEach((playerShowdownData, index) => {
				comparator[0].push({
					card: playerData[index].bestHand[0], // First Card (Tripple) -- same as second and third cards
					name: playerData[index].name,
					playerIndex: playerData[index].playerIndex,
					bestHand: playerData[index].bestHand
				});
				comparator[1].push({
					card: playerData[index].bestHand[3], // Fourth Card (First Kicker)
					name: playerData[index].name,
					playerIndex: playerData[index].playerIndex,
					bestHand: playerData[index].bestHand
				});
				comparator[2].push({
					card: playerData[index].bestHand[4], // Fifth Card (Second Kicker)
					name: playerData[index].name,
					playerIndex: playerData[index].playerIndex,
					bestHand: playerData[index].bestHand
				});
			})
			break 
		}
		case('Straight'):
		case('Straight Flush'): {
			comparator = Array.from({length: 1}, () => Array.from({length: 0}))
			playerData.forEach((playerShowdownData, index) => {
				comparator[0].push({
					card: playerData[index].bestHand[0], // The highest card of a straight will determine the winner, all others are concurrent and will be the same
					name: playerData[index].name,
					playerIndex: playerData[index].playerIndex,
					bestHand: playerData[index].bestHand
				})
			})
			break 
		}
		case('Two Pair'): {
			comparator = Array.from({length: 3}, () => Array.from({length: 0}))
			playerData.forEach((playerShowdownData, index) => {
				comparator[0].push({
					card: playerData[index].bestHand[0], // First card (First Pair) -- same as second card
					name: playerData[index].name,
					playerIndex: playerData[index].playerIndex,
					bestHand: playerData[index].bestHand
				})
				comparator[1].push({
					card: playerData[index].bestHand[2], // Third card (Second Pair) -- same as fourth card
					name: playerData[index].name,
					playerIndex: playerData[index].playerIndex,
					bestHand: playerData[index].bestHand
				})
				comparator[2].push({
					card: playerData[index].bestHand[4], // Last Card (Kicker)
					name: playerData[index].name,
					playerIndex: playerData[index].playerIndex,
					bestHand: playerData[index].bestHand
				})
			})
			break 
		}
		case('Pair'): {
			comparator = Array.from({length: 4}, () => Array.from({length: 0}))
			playerData.forEach((playerShowdownData, index) => {
				comparator[0].push({
					card: playerData[index].bestHand[0], // First Card (Pair) -- same as second card
					name: playerData[index].name,
					playerIndex: playerData[index].playerIndex,
					bestHand: playerData[index].bestHand
				});
				comparator[1].push({
					card: playerData[index].bestHand[2], // Third Card -- first kicker
					name: playerData[index].name,
					playerIndex: playerData[index].playerIndex,
					bestHand: playerData[index].bestHand
				});
				comparator[2].push({
					card: playerData[index].bestHand[3], // Fourth Card -- second kicker
					name: playerData[index].name,
					playerIndex: playerData[index].playerIndex,
					bestHand: playerData[index].bestHand
				});
				comparator[3].push({
					card: playerData[index].bestHand[4], //  Fifth Card -- third kicker
					name: playerData[index].name,
					playerIndex: playerData[index].playerIndex,
					bestHand: playerData[index].bestHand
				});
			})
			break 
		}
		default: throw Error('Recieved unfamiliar rank argument in buildComparator()');
	}
		return comparator
}

const determineWinner = (comparator, rank) => {
	let winners;
	// We can definitely refactor this.
	if (rank === 'Royal Flush') return comparator
		for (let i = 0; i < comparator.length; i++) {
			let highValue = 0;
			let losers = [];
			// Sort Comparator, highest card first
			winners = comparator[i].sort((a, b) => b.card.value - a.card.value).reduce((acc, cur, index) => {
				if (cur.card.value > highValue) {
					
					highValue = cur.card.value;
					acc.push({
						name: cur.name,
						playerIndex: cur.playerIndex,
					});
						return acc;
				} else if (cur.card.value === highValue) {
					acc.push({
						name: cur.name,
						playerIndex: cur.playerIndex,
					});
						return acc;
				} else if (cur.card.value < highValue) {
					losers.push(cur.name);
					return acc; 
				}
			}, [])

			if(winners.length === 1 || i === comparator.length) {
				return winners
			} else {
				if (losers.length >= 1) {
					losers.forEach((nameToExtract) => {
						comparator = comparator.map(snapshot => snapshot.filter((el) => el.name !== nameToExtract));
					})
 				}
			}
		}
	return winners

}

const checkFlush = (suitHistogram) => {
	let isFlush;
	let flushedSuit;
	for (let suit in suitHistogram) {
		if (suitHistogram[suit] >= 5) {
			return { 
				isFlush: true,
				flushedSuit: suit,
			}
		} 
	}
	return {
		isFlush: false,
		flushedSuit: null,
	}
}

const checkRoyalFlush = (flushMatchCards) => {
	if ((flushMatchCards[0].value === 13) &&
		(flushMatchCards[1].value === 12) &&
		(flushMatchCards[2].value === 11) &&
		(flushMatchCards[3].value === 10) &&
		(flushMatchCards[4].value === 10)) { 
			return true  
		} else { return false } 
}

const checkStraightFlush = (flushMatchCards) => {
	const valueSet = buildValueSet(flushMatchCards);
	const { isStraight, isLowStraight, concurrentCardValues, concurrentCardValuesLow } = checkStraight(valueSet);
	return {
		isStraightFlush: isStraight,
		isLowStraightFlush: isLowStraight,
		concurrentSFCardValues: concurrentCardValues,
		concurrentSFCardValuesLow: concurrentCardValuesLow,
	}
}

const analyzeHistogram = (hand, frequencyHistogram) => {
	// Is first argument required? - May be unused
	let isFourOfAKind = false;
	let isFullHouse = false
	let isThreeOfAKind = false;
	let isTwoPair = false;
	let isPair = false;
	let numTripples = 0;
	let numPairs = 0;
	let frequencyHistogramMetaData = {
		pairs: [],
		tripples: [],
		quads: [],
	}
	for (let cardFace in frequencyHistogram) {
		if (frequencyHistogram[cardFace] === 4) {
			isFourOfAKind = true
				frequencyHistogramMetaData.quads.push({
					face: cardFace,
					value: VALUE_MAP[cardFace]
				})
		}
		if (frequencyHistogram[cardFace] === 3) {
			isThreeOfAKind = true
			numTripples++
				frequencyHistogramMetaData.tripples.push({
					face: cardFace,
					value: VALUE_MAP[cardFace]
				})
		}
		if (frequencyHistogram[cardFace] === 2) {
			isPair = true
			numPairs++
				frequencyHistogramMetaData.pairs.push({
					face: cardFace,
					value: VALUE_MAP[cardFace]
				})
		}
	}

		frequencyHistogramMetaData.pairs = frequencyHistogramMetaData.pairs.map(el => el).sort((a,b) => b.value - a.value)
		frequencyHistogramMetaData.tripples = frequencyHistogramMetaData.tripples.map(el => el).sort((a,b) => b.value - a.value)
		frequencyHistogramMetaData.quads = frequencyHistogramMetaData.quads.map(el => el).sort((a,b) => b.value - a.value)
	// Ensure histogram arrays are sorted in descending order to build best hand top down
	// can just check metadata length and omit the counters
	if((numTripples >= 2) || (numPairs >= 1 && numTripples >=1)) {
		isFullHouse = true
	}
	if(numPairs >= 2) {
		isTwoPair = true
	}

		return {
			isFourOfAKind,
			isFullHouse,
			isThreeOfAKind,
			isTwoPair,
			isPair,
			frequencyHistogramMetaData
		}

}

const checkStraight = (valueSet) => {
	if (valueSet.length < 5) return false
	let numConcurrentCards = 0;
	let concurrentCardValues = [];
	for (let i = 1; i < valueSet.length; i++) {
		if (numConcurrentCards === 5) {
			return {
				isStraight: true,
				concurrentCardValues
			}
		}
		if ((valueSet[i] - valueSet[i - 1]) === -1) {
			if(numConcurrentCards === 0) {
				numConcurrentCards = 2;
					concurrentCardValues.push(valueSet[i - 1]);
					concurrentCardValues.push(valueSet[i]);

			} else { 
				numConcurrentCards++;
					concurrentCardValues.push(valueSet[i]);
			}
		} else {
			numConcurrentCards = 0;
			concurrentCardValues = []; 
		}
	}
	if (numConcurrentCards >= 5) {
		return {
			isStraight: true,
			concurrentCardValues
		}
	} else {
		if (valueSet[0] === 13) {
			let { isLowStraight, concurrentCardValuesLow } = checkLowStraight(cloneDeep(valueSet));

			if (isLowStraight) return {
				isStraight: true,
				isLowStraight,
				concurrentCardValues, 
				concurrentCardValuesLow,
			}
		} 
		return { 
			isStraight: false,
			isLowStraight: false, 
			concurrentCardValues, 
		} 
	}
}

const checkLowStraight = (valueSetCopy) => {
	let numConcurrentCards = 0;
	let concurrentCardValuesLow = [];
	valueSetCopy[0] = 0; // Convert Ace High Value (13) to Low Wildcard Value (0)
	const sortedValueSetCopy = valueSetCopy.map(el => el).sort((a,b) => a - b); // Sort in Ascending Order 
	// Basically look for [0, 1, 2, 3, 4,] AKA [A, 2, 3, 4, 5]
	for (let i = 1; i < 5; i++) {
		if (numConcurrentCards >= 5) {
			return {
				isLowStraight: true,
				concurrentCardValuesLow,
			}
		}
		if((sortedValueSetCopy[i] - sortedValueSetCopy[i - 1]) === 1 ) {
			if (numConcurrentCards === 0) {
				numConcurrentCards = 2;
					concurrentCardValuesLow.push(sortedValueSetCopy[i - 1]);
					concurrentCardValuesLow.push(sortedValueSetCopy[i]);
			} else { 
				numConcurrentCards++;
				concurrentCardValuesLow.push(sortedValueSetCopy[i]); 
			}	
		} else { 
			numConcurrentCards = 0;
			concurrentCardValuesLow = [];
		}
	}
	if (numConcurrentCards >= 5) {
		return {
			isLowStraight: true,
			concurrentCardValuesLow,
		}
	} else { 
		return {
			isLowStraight: false,
			concurrentCardValuesLow,
		} 
	}
}


const buildValueSet = (hand) => {
	return Array.from(new Set(hand.map(cardInfo => cardInfo.value)))
}

const dealMissingCommunityCards = (state) => {
	const cardsToPop = 5 - state.communityCards.length
	if (cardsToPop >= 1) {
		let animationDelay = 0;
		const { mutableDeckCopy, chosenCards } = popShowdownCards(state.deck, cardsToPop);
			
			for (let card of chosenCards) {
				card.animationDelay = animationDelay;
				animationDelay = animationDelay + 250;
				state.communityCards.push(card);
			}

		state.deck = mutableDeckCopy;
	}
	state.phase = 'showdown'
	return state
}

export { generateDeckOfCards, shuffle, popCards, dealPrivateCards, dealFlop, dealTurn, dealRiver, showDown, dealMissingCommunityCards, analyzeHistogram, checkFlush, checkRoyalFlush, checkStraightFlush, checkStraight, buildValueSet }