import { handleOverflowIndex } from './players.js';

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
		state.activePlayerIndex = handleOverflowIndex(state.blindIndex.big, 1, state.players.length, 'up');
		// Maybe move this minbet stuff to reconcile pot?
		state.phase = 'betting2';
			
			return state;
}

const dealTurn = (state) => {
	const { mutableDeckCopy, chosenCards } = popCards(state.deck, 1);
	chosenCards.animationDelay = 0;
		
		state.communityCards.push(chosenCards);
		state.deck = mutableDeckCopy;
		state.activePlayerIndex = handleOverflowIndex(state.blindIndex.big, 1, state.players.length, 'up');
		state.phase = 'betting3'

			return state
}

const dealRiver = (state) => {
	const { mutableDeckCopy, chosenCards } = popCards(state.deck, 1);
	chosenCards.animationDelay = 0;
		
		state.communityCards.push(chosenCards);
		state.deck = mutableDeckCopy;
		state.activePlayerIndex = handleOverflowIndex(state.blindIndex.big, 1, state.players.length, 'up');
		state.phase = 'betting4'

			return state
}

const showDown = (state) => {
	for (let player of state.players) {
	// perhaps sort only after writing the histogram
		console.log(player)
		player.showDownHand.hand = player.cards.concat(state.communityCards).sort((a,b) => b.value - a.value);
		player.showDownHand.hand.forEach(card => {
			player.showDownHand.histogram.faces[card.cardFace] = (player.showDownHand.histogram.faces[card.cardFace] + 1 || 1);
			player.showDownHand.histogram.suits[card.suit] = (player.showDownHand.histogram.suits[card.suit] + 1 || 1);
		})

		/*
			hand.reduce((prev = {}, next) => {
   			 prev[next] = (prev[next] || 0) + 1;
    		return prev;
			});
		*/
	}
		return state
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