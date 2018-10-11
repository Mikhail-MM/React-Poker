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

		const { isFlush, flushedSuit } = checkFlush(suitHistogram);
		const flushMatchCards = isFlush ? player.showDownHand.descendingSortHand.filter(card => card.suit === flushedSuit) : null

		const isRoyalFlush = isFlush ? checkRoyalFlush(flushMatchCards) : false;
		const isStraightFlush = isFlush ? checkStraightFlush(flushMatchCards) : false;
		const isStraight = checkStraight(valueSet);
		const { isFourOfAKind, isFullHouse, isThreeOfAKind, isTwoPair, isPair, metaData } = analyzeHistogram(frequencyHistogram);
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

		player.metaData = metaData;

		const highRankPosition = player.showDownHand.heldRankHierarchy.findIndex(el => el.match === true);
		player.showDownHand.bestHandRank = player.showDownHand.heldRankHierarchy[highRankPosition].name;
		// IGNORE ALL WHO ARE FOLDED...


		// can build ranking by putting these in an array and find indexOf(true) 
		// In a group of players, this will map to who has the first highest rank
		// Can easily determine winner with who has the closest rank (index 0 = highest rank if we order the obj props from high ranking down)




		/*
			hand.reduce((prev = {}, next) => {
   			 prev[next] = (prev[next] || 0) + 1;
    		return prev;
			});
		*/
	}
		return state
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

const analyzeHistogram = (frequencyHistogram) => {
	let isFourOfAKind = false;
	let isFullHouse = false
	let isThreeOfAKind = false;
	let isTwoPair = false;
	let isPair = false;
	let numTripples = 0;
	let numPairs = 0;
	let metaData = {
		pairs: [],
		tripples: [],
		quads: [],
	}
	for (let cardFace in frequencyHistogram) {
		if (frequencyHistogram[cardFace] === 4) {
			isFourOfAKind = true
				metaData.quads.push(cardFace)
		}
		if (frequencyHistogram[cardFace] === 3) {
			isThreeOfAKind = true
			numTripples++
				metaData.tripples.push(cardFace)
		}
		if (frequencyHistogram[cardFace] === 2) {
			isPair = true
			numPairs++
				metaData.pairs.push(cardFace)
		}
	}
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
			metaData
		}

}



const checkStraight = (valueSet) => {
	if (valueSet.length < 5) return false
	if (valueSet[0] === 13) {
		const isLowStraight = checkLowStraight([...valueSet])
		if (isLowStraight) return true
	}
	let concurrentCards = 0;
	for (let i = 1; i < valueSet.length; i++) {
		if (concurrentCards === 5) {
			// Return early if we have 5 concurrent cards instead of checking next index and possibly breakign the streak
			return true
		}
		if ((valueSet[i] - valueSet[i - 1]) === -1) {
			if(i === 1) {
				concurrentCards = 2
			} else { concurrentCards++ }
		} else { concurrentCards = 0 }
	}
	if (concurrentCards >= 5) {
		return true
	} else { return false }
}

const checkLowStraight = (valueSetCopy) => {
	let concurrentCards = 0;
	valueSetCopy[0] = 0; // Convert Ace High Value (13) to Low Wildcard Value (0)
	valueSetCopy.sort((a,b) => a - b) // Sort in Ascending Order 
	// Basically look for [0, 1, 2, 3, 4,] AKA [A, 2, 3, 4, 5]
	for (let i = 1; i < 5; i++) {
		if((valueSetCopy[i] - valueSetCopy[i - 1]) === 1 ) {
			if (i === 1) {
				concurrentCards = 2
			} else { concurrentCards++ }
		} else { concurrentCards = 0 }
	}
	if (concurrentCards === 5) {
		return true
	} else { return false }
}



const buildValueSet = (hand) => {
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

*/