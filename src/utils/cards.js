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

const fullDeck = generateDeckOfCards()

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

const dealPrivateCards = (state) => {
	/*

		connorToday at 1:28 PM
		why use a while

		do you remember where you posted it? I want to take a look
		I found it, but you only wrote 
		
		const dealPocketCards = gameState => {
		  gameState.allPlayers.forEach();
		};

		So you can build an array of all of the cards that would be dealt to the players (players.length * 2), and use a forEach loop to give each player the valid index
		If you have 6 players, pop off 12 cards into an array. First player gets the card at index 0, 6. Second gets the cards at index 1, 7(edited)
		is that what you mean by declarative?

	*/

	// A MORE DECLARATIVE APPROACH WOULD BE MORE ELEGANT AND SAVE PROCESSING POWER


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
		const bestHands = {}

		player.showDownHand.hand = player.cards.concat(state.communityCards);
		player.showDownHand.descendingSortHand = player.showDownHand.hand.sort((a,b) => b.value - a.value);

		player.showDownHand.descendingSortHand.forEach(card => {
			frequencyHistogram[card.cardFace] = (frequencyHistogram[card.cardFace] + 1 || 1);
			suitHistogram[card.suit] = (suitHistogram[card.suit] + 1 || 1);
		})

		// For Debugging
		player.frequencyHistogram = frequencyHistogram;
		player.suitHistogram = suitHistogram;

		const valueSet = buildValueSet(player.showDownHand.descendingSortHand);

		const { isFlush, flushedSuit } = checkFlush(player.showDownHand.descendingSortHand, suitHistogram);
		const flushCards = isFlush ? player.showDownHand.descendingSortHand.filter(card => card.suit === flushedSuit) : null
		const isRoyalFlush = isFlush ? checkRoyalFlush(flushCards) : false;
		const isStraightFlush = isFlush ? checkStraightFlush(flushCards) : false; // DOES NOT ACCOUNT FOR OUR NEW OBJ STRUCTURE - NEEDS DESTRUCTURING
		const { isStraight, isLowStraight, concurrentCardValues } = checkStraight(valueSet);
		const { isFourOfAKind, isFullHouse, isThreeOfAKind, isTwoPair, isPair, frequencyHistogramMetaData } = analyzeHistogram(player.showDownHand.descendingSortHand, frequencyHistogram);
		const isNoPair = ((!isRoyalFlush) && (!isStraightFlush) && (!isFourOfAKind) && (!isFullHouse) && (!isFlush) && (!isStraight) && (!isThreeOfAKind) && (!isTwoPair) && (!isPair))
		
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
		player.showDownHand.bestHand = buildBestHand(player.showDownHand.descendingSortHand, player.showDownHand.bestHandRank, flushedSuit, flushCards, concurrentCardValues, isLowStraight, frequencyHistogramMetaData)

		// TODO: IGNORE ALL WHO ARE FOLDED...


		/*
			hand.reduce((prev = {}, next) => {
   			 prev[next] = (prev[next] || 0) + 1;
    		return prev;
			});
		*/
	}
		
		/* 
			Rank Table (obj - MAP)
			Hands as Keys
			Arrays hold Player ID/Name
			Go down forEach
			When we find a contains - 

		*/

		 return rankPlayerHands(state);

}

const buildBestHand = (hand, bestRank, flushedSuit, flushCards, concurrentCardValues, isLowStraight, frequencyHistogramMetaData) => {
	// TODO: LOW STRAGHT, STRAIGHT FLUSH (++ LOW STRAIGHT FLUSH...)
	switch(bestRank) {
		case('Royal Flush'): {
			return flushCards.slice(0, 5)
		}
		case('Straight Flush'): {

		}
		case('Four Of A Kind'): {
			const bestHand = [];
			let mutableHand = cloneDeep(hand);

			for (let i = 0; i < 4; i++) {
				const indexOfQuad = mutableHand.findIndex(card => card.cardFace === frequencyHistogramMetaData.quads[0].face);
				bestHand.push(mutableHand[indexOfQuad])
					mutableHand = mutableHand.filter((card, index) => index !== indexOfQuad)
			}

				return bestHand.concat(mutableHand.slice(0, 1))
		}
		case('Full House'): {
			const bestHand = [];
			let mutableHand = cloneDeep(hand);
			if (frequencyHistogramMetaData.tripples.length > 1) {
				for (let i = 0; i < 3; i++) {
					const indexOfTripple = mutableHand.findIndex(card => card.cardFace === frequencyHistogramMetaData.tripples[0].face);
					bestHand.push(mutableHand[indexOfTripple])
						mutableHand = mutableHand.filter((card, index) => index !== indexOfTripple)
				}
				for (let i = 0; i < 2; i++) {
					const indexOfPair = mutableHand.findIndex(card => card.cardFace === frequencyHistogramMetaData.tripples[1].face);
					bestHand.push(mutableHand[indexOfPair])
						mutableHand = mutableHand.filter((card, index) => index !== indexOfPair)
				}
					return bestHand
			} else {
				for (let i = 0; i < 3; i++) {
					const indexOfTripple = mutableHand.findIndex(card => card.cardFace === frequencyHistogramMetaData.tripples[0].face);
					bestHand.push(mutableHand[indexOfTripple])
						mutableHand = mutableHand.filter((card, index) => index !== indexOfTripple)
				}
				for (let i = 0; i < 2; i++) {
					const indexOfPair = mutableHand.findIndex(card => card.cardFace === frequencyHistogramMetaData.pairs[0].face);
					bestHand.push(mutableHand[indexOfPair])
						mutableHand = mutableHand.filter((card, index) => index !== indexOfPair)
				}
					return bestHand
			}
		}
		case('Flush'): {
			return flushCards.slice(0, 5)
		}
		case('Straight'): {
			// TODO: Account for LOW STRAIGHT
			return concurrentCardValues.reduce((acc, cur, index) => {
				if (index < 5) {
					acc.push(hand[hand.findIndex(card => card.value === cur)]);
				}
					return acc;
			}, []);
		}
		case('Three Of A Kind'): {
			const bestHand = [];
			let mutableHand = cloneDeep(hand);

			for (let i = 0; i < 3; i++) {
				const indexOfTripple = mutableHand.findIndex(card => card.cardFace === frequencyHistogramMetaData.tripples[0].face);
				bestHand.push(mutableHand[indexOfTripple])
					mutableHand = mutableHand.filter((card, index) => index !== indexOfTripple)
			}

				return bestHand.concat(mutableHand.slice(0, 2))
		}
		case('Two Pair'): {
			const bestHand = [];
			let mutableHand = cloneDeep(hand);
				
				for (let i = 0; i < 2; i++) {
					const indexOfPair = mutableHand.findIndex(card => card.cardFace === frequencyHistogramMetaData.pairs[0].face);
					bestHand.push(mutableHand[indexOfPair])
						mutableHand = mutableHand.filter((card, index) => index !== indexOfPair)
				}
				
				for (let i = 0; i < 2; i++) {
					const indexOfPair = mutableHand.findIndex(card => card.cardFace === frequencyHistogramMetaData.pairs[1].face);
					bestHand.push(mutableHand[indexOfPair])
						mutableHand = mutableHand.filter((card, index) => index !== indexOfPair)
				}
					return bestHand.concat(mutableHand.slice(0, 1))


		}
		case('Pair'): {
			const bestHand = [];
			let mutableHand = cloneDeep(hand);
				
				for (let i = 0; i < 2; i++) {
					const indexOfPair = mutableHand.findIndex(card => card.cardFace === frequencyHistogramMetaData.pairs[0].face);
					bestHand.push(mutableHand[indexOfPair])
						mutableHand = mutableHand.filter((card, index) => index !== indexOfPair)
				}
				
					return bestHand.concat(mutableHand.slice(0, 3))
				

		}
		case('No Pair'): {
			return hand.slice(0, 5)
		}
	}
}


const rankPlayerHands = (state) => {
	/*

		bpfToday at 2:25 PM
		also I do this for readability
		new Map(Object.entries({
		  'Royal Flush': [],
		  // etc.
		}));
	*/

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
	// THIS WILL WORK > JUST PUSH ONLY THE PLAYERS IN EACH POT CONTEST.
			// Determine how to mediate a tie, etc, etc...
	for (let player of state.players) {
		rankMap.get(player.showDownHand.bestHandRank).push(player.name);
	}
	state.rankMap = rankMap;
		return console.log("Prepare the Grudge Match!")
		// return battleRoyale(state);
}

const battleRoyale = (state) => {
	// val should be an array of player ID or Table Position Index
	state.rankMap.forEach((val, key, map) => {
		if (val.length === 1) {
			// Uncontested Winner (player at val[0])
				state = payWinner(state, val[0], key) 
		} else if (val.length > 1) {
			// Send Contestants to Algo that Determines best hand of same ranks
			// (val is an array of all contestants)
				const winner = grudgeMatch(state, val, key)
					state = payWinner(state, winner, key)
		}
	})

		return state
}

const payWinner = (state, winnerID, key) => {
	const winner = state.players[state.players.findIndex(el => el.name === winnerID)];
	// maximumWinnings should be determined at reconcilePot() at the end of a betting round 
	let maximumWinnings = winner.roundStartChips

	// transfer chips from pot to winner 
	// determine if he only gets a side-pot based on chips at start of round
		// If there is a side-pot payout, remove the winner from the next round's consideration
		// Run battle royale again
		state.rankMap.set(state.rankMap.get(key).filter(player => player !== winnerID))
			return battleRoyale(state)
}

const grudgeMatch = (state, winners, handRank) => {
	// Determine who wins on the basis of highest pair, card, kicker, etc...
}


const checkFlush = (hand, suitHistogram) => {
	let isFlush;
	let flushedSuit;
	for (let suit in suitHistogram) {
		if (suitHistogram[suit] >= 5) {
			return { 
				isFlush: true,
				flushedSuit: suit,
			}
		} else { 
			return {
				isFlush: false,
				flushedSuit: null,
			}
		}
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
	return checkStraight(valueSet);
}

const analyzeHistogram = (hand, frequencyHistogram) => {
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

		frequencyHistogramMetaData.pairs = frequencyHistogramMetaData.pairs.sort((a,b) => b.value - a.value)
		frequencyHistogramMetaData.tripples = frequencyHistogramMetaData.tripples.sort((a,b) => b.value - a.value)
		frequencyHistogramMetaData.quads = frequencyHistogramMetaData.quads.sort((a,b) => b.value - a.value)
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
		console.log("Checking Straight for Value Set:", valueSet);
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
			console.log("Concurrency Found at i=", i)
			if(numConcurrentCards === 0) {
				numConcurrentCards = 2;
					concurrentCardValues.push(valueSet[i - 1]);
					concurrentCardValues.push(valueSet[i]);

			} else { 
				numConcurrentCards++;
					concurrentCardValues.push(valueSet[i]);
			}
		} else {
			console.log("Concurrency Broken") 
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
			let { isLowStraight, concurrentCardValuesLow } = checkLowStraight([...valueSet]);
			if (isLowStraight) return {
				isStraight: true,
				isLowStraight,
				concurrentCardValues: concurrentCardValuesLow,
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
	valueSetCopy.sort((a,b) => a - b); // Sort in Ascending Order 
	// Basically look for [0, 1, 2, 3, 4,] AKA [A, 2, 3, 4, 5]
	console.log("Checking for concurrency - WildCard found (Ace) - Value Set is", valueSetCopy)
	for (let i = 1; i < 5; i++) {
		if (numConcurrentCards === 5) {
			return {
				isLowStraight: true,
				concurrentCardValuesLow,
			}
		}
		if((valueSetCopy[i] - valueSetCopy[i - 1]) === 1 ) {
			console.log("Concurrency Found at i=", i)
			if (numConcurrentCards === 0) {
				numConcurrentCards = 2;
					concurrentCardValuesLow.push(valueSetCopy[i - 1]);
					concurrentCardValuesLow.push(valueSetCopy[i]);
			} else { 
				numConcurrentCards++;
				concurrentCardValuesLow.push(valueSetCopy[i]); 
			}	
		} else { 
			numConcurrentCards = 0;
			concurrentCardValuesLow = [];
		}
	}
	if (numConcurrentCards === 5) {
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
	/*
	return hand.reduce((uniqueFaces, card) => {

	}, [])
	*/

	return Array.from(new Set(hand.map(cardInfo => cardInfo.value)))
}

export { fullDeck, shuffle, popCards, dealPrivateCards, dealFlop, dealTurn, dealRiver, showDown }

// Straight: Divide array into frames: 0-4, 1-5, 2-6, 
// For a straight, converting to a SET may help
// Array.from(new Set([2, 2, 3, 4, 5, 5]));
// So, this fails when it's an array of objects, but we can try to do a reduce

/*
[{face: A, value: 13}].reduce[(cur, acc) => {
	if (cur does not contain our cardFace yet) {
	throw it in there...
	}
}, []]
*/
/*

OLD CHECKS

const checkFourOfAKind = (frequencyHistogram) => {
	for (let cardFace in frequencyHistogram) {
		if (frequencyHistogram[cardFace] === 4) {
			return true
		}
	}
		return false
}
const checkFullHouse = (frequencyHistogram) => {
	let numPairs = 0;
	let numThreeKind = 0;
	for (let cardFace in frequencyHistogram) {
		if (frequencyHistogram[cardFace] === 3) numThreeKind++;
		if (frequencyHistogram[cardFace] === 2) numPairs++
	}

	if ((numThreeKind >= 2) || (numPairs >= 1 && numThreeKind >=1)) {
		return true
	} else {
		return false
	}
}
const checkThreeOfAKind = (frequencyHistogram) => {
	for (let cardFace in frequencyHistogram) {
		if (frequencyHistogram[cardFace] === 3) return true
	}
		return false
}
const checkTwoPair = (frequencyHistogram) => {
	let numPairs = 0;
	for (let cardFace in frequencyHistogram) {
		if (frequencyHistogram[cardFace] === 2) {
			numPairs++
		}
	}
	if (numPairs >= 2) {
		return true
	} else { return false }
}
const checkPair = (frequencyHistogram) => {
	let numPairs = 0;
	for (let cardFace in frequencyHistogram) {
		if (frequencyHistogram[cardFace] === 2) {
			numPairs++
		}
	}
	if (numPairs >= 1) {
		return true
	} else { return false }
}


MikeMKToday at 12:23 AM
I am kind of dreading making the recursive function that should properly deal out pot winnings to all players and take into account side pots. Each player will have maxWinnings which would be set to their chips at the beginning of each round. 
After player hands are eval'd, and it is determined for every player what their Best Hand is - I would need to create a Map which contains arrays of players organized by their strongest possible hand.
{
    'Royal Flush': [],
    'Full House': [Player 1, Player 2],
    'Four of A Kind': [Player 3],
    ...
}

When the Map is established, I will iterate with forEach() - First array with length 1 will be a winner. If the length is >1, will need to compare all player hands to determine a winner (need different comparator functions for each hand type..., though logic can be reused)

When a winner is established, can pluck him out of the array with filter. He will receive maxWinnings * activePlayers chips from the pot. If there is still money left in da pot, will recurse the function to calculate next winner
i think this might work


Connor's Approach: 

{
    [["2C", "3C", "4C", "5C", "6C"].toString()]: getBestHand(["2C", "3C", "4C", "5C", "6C"].)
}
*/