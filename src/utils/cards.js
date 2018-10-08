import produce from 'immer'

const totalNumCards = 52
const suits = ['Heart', 'Spade', 'Club', 'Diamond'];
const cards = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

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
				suit: suit
			})
		}
	}
		return deck
}

const fullDeck = generateDeckOfCards()

const shuffle = (deck) => {
	let shuffledDeck = new Array(totalNumCards);
	let filledSlots = []
	for (let i = 0; i < totalNumCards; i++) {
		if (i === 51) {
			// Fill last undefined slot when only 1 card left to shuffle
			const lastSlot = shuffledDeck.findIndex((el) => typeof el == 'undefined')
				shuffledDeck[lastSlot] = deck[i]
				filledSlots.push(lastSlot)
		} else {
			let shuffleToPosition = randomizePosition(0, totalNumCards - 1)
				while (filledSlots.includes(shuffleToPosition)) {
					shuffleToPosition = randomizePosition(0, totalNumCards - 1)
				}
						shuffledDeck[shuffleToPosition] = deck[i]
						filledSlots.push(shuffleToPosition)
		}
	}
	return shuffledDeck
}

const popCards = (deck, numToPop) => {
	// Note: While this is a Shallow Copy, (It copies the references to the children) - note that we are mutating it by 
	// Actually modifying the array, NOT the children. This is why the length of mutableCopy changes, but that of deck 
	// Does not.
	const mutableDeckCopy = [...deck]
	let chosenCards;
	if (numToPop === 1) {
		chosenCards = mutableDeckCopy.pop()
	} else {
		chosenCards = [];
		for(let i = 0; i < numToPop; i++) {
			chosenCards.push(mutableDeckCopy.pop())
		}
	}
		return { mutableDeckCopy, chosenCards }
}



export { fullDeck, shuffle, popCards }