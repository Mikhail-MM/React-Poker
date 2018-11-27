
/*
1 ) Analyze Card Hand
2 ) Analyze Bet
	Types of Bets 
		5% - Inconsequential 
		8% - 15 - 20%(high - can be determinant on personality) -  Draw bet
			A draw bet is usually bet by Regular players when they have a decent card
			A player will CALL a draw bet if they are chasing something - Do they have a way into a straight or flush? Do they already have a pair, can get a 2pair?
		25 - 50% - This is a STRONG BET
			It is bet early by aggressive players with a lesser hand, bluffers, and by regular players
			Called by players early if they are really close to chasing a good hand (4 suited on a flop...)
		All In - Well, this is a toughie



Modifiers: (Is Chip Leader / How many Chips do other guys have?)


Flop - 
Conservative player will call a draw bet if they have >9&10, or if they have a medium pair
An aggressive player may do a draw bet if they have a decent pair or >9&10
A regular player will typically call an inconsequential bet, a conservative player may drop it if he has really bad cards <27

Need a new analysis: Are my cards possible to score a straight with? If pocket cards are like 4 away it is ok

Conditions for different bets


Personalities: Standard, Conservative, Aggressive, (WildCards: Erratic/Bluffer)


*/

// Can make bet determinations against current chips or against pot

import { handleOverflowIndex } from './players.js';
import { handleBet, handleFold, determineMinBet } from './bet.js';
import { analyzeHistogram, checkFlush, checkRoyalFlush, checkStraightFlush, checkStraight, buildValueSet } from './cards.js'

const handleAI = (state) => {
	console.log("AI Util Running")
	console.log(state)
	const { highBet } = state
	const activePlayer = state.players[state.activePlayerIndex];
	const min = determineMinBet(highBet, activePlayer.chips, activePlayer.bet)
    const max = activePlayer.chips + activePlayer.bet
	const totalInvestment = activePlayer.chips + activePlayer.bet + activePlayer.stackInvestment;
	const investmentRequiredToRemain = (highBet / totalInvestment) * 100; 
	const descendingSortHand = activePlayer.cards.concat(state.communityCards).sort((a, b) => b.value - a.value)
	console.log("Pre-Histogram Generation")
	const { frequencyHistogram, suitHistogram } =  generateHistogram(descendingSortHand)
	console.log("Histogram Generated")
	const stakes = classifyStakes(investmentRequiredToRemain);
	//console.log("Current Stakes To Remain In Pot: ", stakes)
	const preFlopValues = activePlayer.cards.map(el => el.value)
	const highCard = Math.max(...preFlopValues)
	const lowCard = Math.min(...preFlopValues)
	// We may want to keep track of how much the Ai has already invested into the pot to help determine what action to take.
	//console.log(state.phase)
	/*

		TODO:

		Ensure that the AI can handle going all-in on a bet - validate their input - ensure that willCall or wilLRaise amounts are above minBet

		This may be a consideration around the slider - will it accept 

	*/
	console.log("AI Thinking")
	switch(state.phase) {
		case('betting1'): { 
			const suited = Object.entries(suitHistogram).find(keyValuePair => keyValuePair[1] === 2)			
			const straightGap = (highCard - lowCard <= 4)
			// Raise? If Good High Card - Raise inconsequential (Aggro will raise, standard will call)
			// If good high card and low card, bet lowdraw 
			// If ++ suited or straight gap, 
			const { callLimit, raiseChance, raiseRange } = buildPreFlopDeterminant(highCard, lowCard, suited, straightGap)
			//console.log(activePlayer.name, " is ready to call up to", callLimit, " stakes. There is a ", raiseChance, " chance that the AI will raise with one of these possible bets if it has not been met: ", raiseRange)
			// Need to fix logic - If 
			const willCall = (BET_HIERARCHY[stakes] <= BET_HIERARCHY[callLimit])
			//console.log("Will Ai call?", willCall)
			const callValue = (activePlayer.chips >= highBet) ? highBet : activePlayer.chips + activePlayer.bet

			if (willCall) {
				if (willRaise(raiseChance)) {
					//console.log("AI has decided to bet")
					const determinedRaiseRange = raiseRange[Math.floor(Math.random() * (raiseRange.length - 0)) + 0];
					//console.log("AI's preferred bet state: ", determinedRaiseRange, " stakes.")
					const wantRaise = (BET_HIERARCHY[stakes] <= BET_HIERARCHY[determinedRaiseRange])
					//console.log("Does the AI need to raise to reach this state? ", wantRaise)
						if (wantRaise) {

							// ERROR - Due to the randomization - we may have an issue .... of a raise being lower than a call??
							let betValue = Math.floor(decideBetProportion(determinedRaiseRange) * activePlayer.chips)
							if (betValue < highBet) {
								//console.log("AI's decided raise is below current high bet ...")
								if (highBet < max) {
									betValue = highBet;
								}
							}
							if (betValue > max)
							console.log("AI bets ", betValue)
									activePlayer.canRaise = false
									return handleBet(state, betValue, min, max);
						} else {
							console.log("AI Wants to Call.")
							return handleBet(state, callValue, min, max);
						}	
				} else {
					console.log("AI Wants to Call.")
						return handleBet(state, callValue, min, max);
				}
			} else {
				return handleFold(state)
			}
			// TODO: RESET AI STATE IN NEXT-ROUND FN
			break
		}
		case('betting2'):
		case('betting3'):
		case('betting4'):
			//console.log("running AI")

			// Repeated Logic from cards.js, we can possibly export this into a meta method, we can export this elsewhere
			const { 

				isPair,
				isTwoPair,
				isThreeOfAKind,
				isFourOfAKind,
				isFullHouse,
				frequencyHistogramMetaData, 

			} = analyzeHistogram(descendingSortHand, frequencyHistogram);		
			//console.log("Analyzed Histogram")
			const valueSet = buildValueSet(descendingSortHand);
			//console.log("Built Value Set")
			const { 

				isStraight, 
				isLowStraight, 
				concurrentCardValues, 
				concurrentCardValuesLow, 

			} = checkStraight(valueSet);
			//console.log("Checked Straight")
			//console.log(flushCards)
			const { 
				
				isFlush, 
				flushedSuit, 

			} = checkFlush(suitHistogram);

			const flushCards = (isFlush) && 
				descendingSortHand
					.filter(card => card.suit === flushedSuit);

			const { 
			
				isStraightFlush, 
				isLowStraightFlush, 
				concurrentSFCardValues, 
				concurrentSFCardValuesLow, 

			} = (isFlush) && checkStraightFlush(flushCards);
			//console.log("Checked Straight Flush")
			//console.log("Checked Flush")
			const isRoyalFlush = (isFlush) && 
				checkRoyalFlush(flushCards);
			//console.log("Checked Royal Flush")
			const isNoPair = (
				(!isRoyalFlush) && 
				(!isStraightFlush) && 
				(!isFourOfAKind) && 
				(!isFullHouse) && 
				(!isFlush) && 
				(!isStraight) && 
				(!isThreeOfAKind) && 
				(!isTwoPair) && 
				(!isPair));
			//console.log("Checked No Pair")
		const handHierarchy = [{
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
		//console.log("Matches Done")
		const highRank = handHierarchy[handHierarchy.findIndex(el => el.match === true)].name
		const { callLimit, raiseChance, raiseRange } = buildGeneralizedDeterminant(descendingSortHand, highRank, frequencyHistogramMetaData)
		//console.log(activePlayer.name, " is ready to call up to", callLimit, " stakes. There is a ", raiseChance, " chance that the AI will raise with one of these possible bets if it has not been met: ", raiseRange)
		const willCall = (BET_HIERARCHY[stakes] <= BET_HIERARCHY[callLimit])
		//console.log("Will Ai call?", willCall)
		const callValue = (activePlayer.chips >= highBet) ? highBet : activePlayer.chips
		if (willCall) {
				if (willRaise(raiseChance)) {
					//console.log("AI has decided to bet")
					const determinedRaiseRange = raiseRange[Math.floor(Math.random() * (raiseRange.length - 0)) + 0];
					//console.log("AI's preferred bet state: ", determinedRaiseRange, " stakes.")
					const wantRaise = (BET_HIERARCHY[stakes] <= BET_HIERARCHY[determinedRaiseRange])
					//console.log("Does the AI need to raise to reach this state? ", wantRaise)
						if (wantRaise) {

							// ERROR - Due to the randomization - we may have an issue .... of a raise being lower than a call??
							let betValue = Math.floor(decideBetProportion(determinedRaiseRange) * activePlayer.chips)
							if (betValue < highBet) {
								//console.log("AI's decided raise is below current high bet ...")
								betValue = highBet;
							}
							//console.log("AI bets ", betValue)
									activePlayer.canRaise = false
									return handleBet(state, betValue, min, max);
						} else {
							//console.log("AI Wants to Call.")
							return handleBet(state, callValue, min, max);
						}	
				} else {
					//console.log("AI Wants to Call.")
						return handleBet(state, callValue, min, max);
				}
			} else {
				return handleFold(state)
			}
	}
}

// TODO: Programatically determine raise chance AND raise range based on card aggregate value
const buildGeneralizedDeterminant = (hand, highRank, frequencyHistogramMetaData) => {
	if (highRank === 'Royal Flush') {
		//console.log("AI Has Royal Flush")
		return {
			callLimit: 'beware',
			raiseChance: 1,
			raiseRange: ['beware']
		}
	} else if (highRank === 'Straight Flush') {
		//console.log("AI Has Straight Flush")
		return {
			callLimit: 'beware',
			raiseChance: 1,
			raiseRange: ['strong','aggro', 'beware']
		}
	} else if (highRank === 'Four Of A Kind') {
		//console.log("AI Has 4Kind")
		return {
			callLimit: 'beware',
			raiseChance: 1,
			raiseRange: ['strong','aggro', 'beware']
		}
	} else if (highRank === 'Full House') {
		//console.log("AI Has Full House")
		return {
			callLimit: 'beware',
			raiseChance: 1,
			raiseRange: ['hidraw', 'strong', 'aggro', 'beware']
		}
	} else if (highRank === 'Flush') {
		//console.log("AI Has Flush")
		return {
			callLimit: 'beware',
			raiseChange: 1,
			raiseRange: ['strong', 'aggro', 'beware'],
		}
	} else if (highRank === 'Straight') {
		//console.log("AI Has Straight")
		return {
			callLimit: 'beware',
			raiseChange: 1,
			raiseRange: ['lowdraw', 'meddraw', 'hidraw, strong'],
		}
	} else if (highRank === 'Three Of A Kind') {
		//console.log("AI Has Trips")
		return {
			callLimit: 'beware',
			raiseChange: 1,
			raiseRange: ['lowdraw', 'meddraw', 'hidraw, strong'],
		}
	} else if (highRank === 'Two Pair') {
		//console.log("AI Has 2Pair")
		return {
			callLimit: 'beware',
			raiseChange: 0.7,
			raiseRange: ['lowdraw', 'meddraw', 'hidraw, strong'],
		}
	} else if (highRank === 'Pair') {
		//console.log("AI Has Pair")
		return {
			callLimit: 'hidraw',
			raiseChange: 0.5,
			raiseRange: ['lowdraw', 'meddraw', 'hidraw, strong'],
		}
	} else if (highRank === 'No Pair') {
		//console.log("AI Has No Pair")
		return {
			callLimit: 'meddraw',
			raiseChange: 0.2,
			raiseRange: ['lowdraw', 'meddraw', 'hidraw, strong'],
		}
	}
}

const buildPreFlopDeterminant = (highCard, lowCard, suited, straightGap) => {
	if (highCard === lowCard) {
		// Pre-Flop Pair
		// Don't really need a switch...
		switch(highCard) {
			case(highCard > 8): {
				//console.log('a')
				return {
					callLimit: 'beware',
					raiseChance: 0.9,
					raiseRange: ['lowdraw', 'meddraw', 'hidraw', 'strong'], // randomly determine bet based on this
				}
			}
			case(highCard > 5): {
				//console.log('b')
				return {
					callLimit: 'aggro',
					raiseChance: 0.75, // If Math.random() is < than this, select a random raiseTarget 
					raiseRange: ['insignificant', 'lowdraw', 'meddraw'],
				}
			}
			case(highCard < 5):
			default: {
				//console.log('c')
				return {
					callLimit: 'aggro',
					raiseChance: 0.5,
					raiseRange: ['insignificant', 'lowdraw', 'meddraw'],
				}
			}
		}
	} else if (highCard > 9 && lowCard > 9) {
		// Two high cards
		if (suited) {
			//console.log('d')
			return {
				callLimit: 'beware',
				raiseChance: 1,
				raiseRange: ['insignificant', 'lowdraw', 'meddraw', 'hidraw'],
			}
		} else {
			//console.log('e')
			return {
				callLimit: 'beware',
				raiseChance: 0.75,
				raiseRange: ['insignificant', 'lowdraw', 'meddraw', 'hidraw'],
			}
		}
	} else if (highCard > 8 && lowCard > 6) {
		// One high card
		if (suited) {
			//console.log('f')
			return {
				callLimit: 'beware',
				raiseChance: 0.65,
				raiseRange: ['insignificant', 'lowdraw', 'meddraw', 'hidraw'],
			}
		} else {
			//console.log('g')
			return {
				callLimit: 'beware',
				raiseChance: 0.45,
				raiseRange: ['insignificant', 'lowdraw', 'meddraw', 'hidraw'],
			}
		}
	} else if (highCard > 8 && lowCard < 6) {
		if (suited) {
			//console.log('h')
			return {
				callLimit: 'major',
				raiseChance: 0.45,
				raiseRange: ['insignificant', 'lowdraw'],
			}
		} else {
			//console.log('i')
			return {
				callLimit: 'aggro',
				raiseChance: 0.35,
				raiseRange: ['insignificant', 'lowdraw'],
			}
		}
	} else if (highCard > 5 && lowCard > 3) {
		if (suited) {
			//console.log('j')
			return{
				callLimit: 'strong',
				raiseChance: 0.1,
				raiseRange: ['insignificant', 'lowdraw'],
			}
		} else if (straightGap) {
			//console.log('k')
			return {
				callLimit: 'aggro',
				raiseChance: 0,
			}
		} else {
			//console.log('l')
			return {
				callLimit: 'strong',
				raiseChance: 0,
			}
		}
	} else {
		if (suited) {
			//console.log('m')
			return {
				callLimit: 'strong',
				raiseChance: 0.1,
				raiseRange: ['insignificant'],
			}
		} else if (straightGap) {
			//console.log('n')
			return {
				callLimit: 'strong',
				raiseChance: 0,
			}
		} else {
			//console.log('o')
			return {
				callLimit: 'insignificant',
				raiseChance: 0,
			}
		}
	}
}

const classifyStakes = (percentage) => {
	switch (true) {
		case (percentage > 75):
			return 'beware'
		case (percentage > 40):
			return 'aggro'
		case (percentage > 35): 
			return 'major'
		case (percentage > 25): 
			return 'strong'
		case (percentage > 15):
			return 'hidraw'
		case (percentage > 10): 
			return 'meddraw'
		case (percentage > 3):
			return 'lowdraw'
		case (percentage >= 1): 
			return 'insignificant'
		case (percentage < 1):
		default:  
			return 'blind'
	}
}

const decideBetProportion = (stakes) => {
	if (stakes === 'blind') {
		return Math.random() * (0.1 - 0) + 0
	} else if (stakes === 'insignificant') {
		return Math.random() * (0.03 - 0.01) + 0.01
	} else if (stakes === 'lowdraw') {
		return Math.random() * (0.10 - 0.03) + 0.03
	} else if (stakes === 'meddraw') {
		return Math.random() * (0.15 - 0.10) + 0.10
	} else if (stakes === 'hidraw') {
		return Math.random() * (0.25 - 0.15) + 0.15
	} else if (stakes === 'strong') {
		return Math.random() * (0.35 - 0.25) + 0.25
	} else if (stakes === 'major') {
		return Math.random() * (0.40 - 0.35) + 0.35
	} else if (stakes === 'aggro') {
		return Math.random() * (0.75 - 0.40) + 0.40
	} else if (stakes === 'beware') {
		return Math.random() * (1 - 0.75) + 0.75
	}
}

const betHierarchy = ['blind', 'insignificant', 'lowdraw', 'meddraw', 'hidraw', 'strong', 'major', 'aggro', 'beware'];

const BET_HIERARCHY = {
	blind: 0,
	insignificant: 1,
	lowdraw: 2,
	meddraw: 3,
	hidraw: 4,
	strong: 5,
	major: 6,
	aggro: 7,
	beware: 8,
}

const willRaise = (chance) => {
	return Math.random() < chance
}
// Move to analysis utils
const generateHistogram = (hand) => {
	console.log("Histogram Generation Called")
	console.log(hand)
	const histogram = hand.reduce((acc, cur) => {
		console.log("Reduce Internal")
		console.log(cur)
		console.log(acc)
		acc.frequencyHistogram[cur.cardFace] = (acc.frequencyHistogram[cur.cardFace] || 0) + 1;
		acc.suitHistogram[cur.suit] = (acc.suitHistogram[cur.suit] || 0) + 1;
		return acc
	}, { frequencyHistogram: {}, suitHistogram: {} })
	console.log(histogram)
	return histogram
}


export { handleAI }


//SUPERTAG