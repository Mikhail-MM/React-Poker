import { 
	handleBet, 
	handleFold, 
	determineMinBet 
} from './bet.js';

import { 
	analyzeHistogram, 
	checkFlush, 
	checkRoyalFlush, 
	checkStraightFlush, 
	checkStraight, 
	buildValueSet 
} from './cards.js'

import { 
	renderActionButtonText 
} from './ui.js';

const handleAI = (state, pushAnimationState) => {
	const { highBet } = state
	const activePlayer = state.players[state.activePlayerIndex];
	const min = determineMinBet(highBet, activePlayer.chips, activePlayer.bet)
    const max = activePlayer.chips + activePlayer.bet
	const totalInvestment = activePlayer.chips + activePlayer.bet + activePlayer.stackInvestment; // NOTE: StackInvestment must be incremented at each level of BETTING
	const investmentRequiredToRemain = (highBet / totalInvestment) * 100; 
	const descendingSortHand = activePlayer.cards.concat(state.communityCards).sort((a, b) => b.value - a.value)
	const { frequencyHistogram, suitHistogram } =  generateHistogram(descendingSortHand)
	const stakes = classifyStakes(investmentRequiredToRemain);
	const preFlopValues = activePlayer.cards.map(el => el.value)
	const highCard = Math.max(...preFlopValues)
	const lowCard = Math.min(...preFlopValues)
	switch(state.phase) {
		case('betting1'): { 
			const suited = Object.entries(suitHistogram).find(keyValuePair => keyValuePair[1] === 2)		
			const straightGap = (highCard - lowCard <= 4)
			const { callLimit, raiseChance, raiseRange } = buildPreFlopDeterminant(highCard, lowCard, suited, straightGap)		
			const willCall = (BET_HIERARCHY[stakes] <= BET_HIERARCHY[callLimit])
			const callValue = (activePlayer.chips + activePlayer.bet >= highBet) ? highBet : activePlayer.chips + activePlayer.bet
			if (willCall) {
				if (willRaise(raiseChance)) {
					const determinedRaiseRange = raiseRange[Math.floor(Math.random() * (raiseRange.length - 0)) + 0];
					const wantRaise = (BET_HIERARCHY[stakes] <= BET_HIERARCHY[determinedRaiseRange])
						if (wantRaise) {
							let betValue = Math.floor(decideBetProportion(determinedRaiseRange) * activePlayer.chips)
							if (betValue < highBet) {
								if (highBet < max) {
									betValue = highBet;
								}
							}
							if (betValue > max)
									activePlayer.canRaise = false
									pushAnimationState(state.activePlayerIndex, `${renderActionButtonText(highBet, betValue, activePlayer)} ${betValue}`);
									return handleBet(state, betValue, min, max);
						} else {
							// Do not render the bet value if it's a "check"
							pushAnimationState(state.activePlayerIndex, `${renderActionButtonText(highBet, callValue, activePlayer)} ${(callValue > activePlayer.bet) ? (callValue) : ""}`);
							return handleBet(state, callValue, min, max);
						}	
				} else {
						pushAnimationState(state.activePlayerIndex, `${renderActionButtonText(highBet, callValue, activePlayer)} ${(callValue > activePlayer.bet) ? (callValue) : ""}`);
						return handleBet(state, callValue, min, max);
				}
			} else {
				pushAnimationState(state.activePlayerIndex, `FOLD`);
				return handleFold(state)
			}
		}
		case('betting2'):
		case('betting3'):
		case('betting4'):
			const { 

				isPair,
				isTwoPair,
				isThreeOfAKind,
				isFourOfAKind,
				isFullHouse,
				frequencyHistogramMetaData, 

			} = analyzeHistogram(descendingSortHand, frequencyHistogram);		
			const valueSet = buildValueSet(descendingSortHand);
			const { 

				isStraight, 
				isLowStraight, 
				concurrentCardValues, 
				concurrentCardValuesLow, 

			} = checkStraight(valueSet);
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
			const isRoyalFlush = (isFlush) && 
				checkRoyalFlush(flushCards);
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
			const highRank = handHierarchy[handHierarchy.findIndex(el => el.match === true)].name
			const { callLimit, raiseChance, raiseRange } = buildGeneralizedDeterminant(descendingSortHand, highRank, frequencyHistogramMetaData)
			const willCall = (BET_HIERARCHY[stakes] <= BET_HIERARCHY[callLimit])
			const callValue = (activePlayer.chips + activePlayer.bet >= highBet) ? highBet : activePlayer.chips + activePlayer.bet
			if (willCall) {
				if (willRaise(raiseChance)) {
					const determinedRaiseRange = raiseRange[Math.floor(Math.random() * (raiseRange.length - 0)) + 0];
					const wantRaise = (BET_HIERARCHY[stakes] <= BET_HIERARCHY[determinedRaiseRange])
					if (wantRaise) {
						let betValue = Math.floor(decideBetProportion(determinedRaiseRange) * activePlayer.chips)
						if (betValue < highBet) {
							betValue = highBet;
						}
							activePlayer.canRaise = false
							pushAnimationState(state.activePlayerIndex, `${renderActionButtonText(highBet, betValue, activePlayer)} ${betValue}`);
							return handleBet(state, betValue, min, max);
					} else {
						pushAnimationState(state.activePlayerIndex, `${renderActionButtonText(highBet, callValue, activePlayer)} ${(callValue > activePlayer.bet) ? (callValue) : ""}`);
						return handleBet(state, callValue, min, max);
					}	
				} else {
						pushAnimationState(state.activePlayerIndex, `${renderActionButtonText(highBet, callValue, activePlayer)} ${(callValue > activePlayer.bet) ? (callValue) : ""}`);
						return handleBet(state, callValue, min, max);
				}
			} else {
				pushAnimationState(state.activePlayerIndex, `FOLD`);
				return handleFold(state)
			}
		default: throw Error("Handle AI Running during incorrect phase");
	}
}

const buildGeneralizedDeterminant = (hand, highRank, frequencyHistogramMetaData) => {
	if (highRank === 'Royal Flush') {
		return {
			callLimit: 'beware',
			raiseChance: 1,
			raiseRange: ['beware']
		}
	} else if (highRank === 'Straight Flush') {
		return {
			callLimit: 'beware',
			raiseChance: 1,
			raiseRange: ['strong','aggro', 'beware']
		}
	} else if (highRank === 'Four Of A Kind') {
		return {
			callLimit: 'beware',
			raiseChance: 1,
			raiseRange: ['strong','aggro', 'beware']
		}
	} else if (highRank === 'Full House') {
		return {
			callLimit: 'beware',
			raiseChance: 1,
			raiseRange: ['hidraw', 'strong', 'aggro', 'beware']
		}
	} else if (highRank === 'Flush') {
		return {
			callLimit: 'beware',
			raiseChange: 1,
			raiseRange: ['strong', 'aggro', 'beware'],
		}
	} else if (highRank === 'Straight') {
		return {
			callLimit: 'beware',
			raiseChange: 1,
			raiseRange: ['lowdraw', 'meddraw', 'hidraw, strong'],
		}
	} else if (highRank === 'Three Of A Kind') {
		return {
			callLimit: 'beware',
			raiseChange: 1,
			raiseRange: ['lowdraw', 'meddraw', 'hidraw, strong'],
		}
	} else if (highRank === 'Two Pair') {
		return {
			callLimit: 'beware',
			raiseChange: 0.7,
			raiseRange: ['lowdraw', 'meddraw', 'hidraw, strong'],
		}
	} else if (highRank === 'Pair') {
		return {
			callLimit: 'hidraw',
			raiseChange: 0.5,
			raiseRange: ['lowdraw', 'meddraw', 'hidraw, strong'],
		}
	} else if (highRank === 'No Pair') {
		return {
			callLimit: 'meddraw',
			raiseChange: 0.2,
			raiseRange: ['lowdraw', 'meddraw', 'hidraw, strong'],
		}
	}
}

const buildPreFlopDeterminant = (highCard, lowCard, suited, straightGap) => {
	if (highCard === lowCard) {
		switch(highCard) {
			case(highCard > 8): {
				return {
					callLimit: 'beware',
					raiseChance: 0.9,
					raiseRange: ['lowdraw', 'meddraw', 'hidraw', 'strong'], // randomly determine bet based on this
				}
			}
			case(highCard > 5): {
				return {
					callLimit: 'aggro',
					raiseChance: 0.75, // If Math.random() is < than this, select a random raiseTarget 
					raiseRange: ['insignificant', 'lowdraw', 'meddraw'],
				}
			}
			case(highCard < 5):
			default: {
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
			return {
				callLimit: 'beware',
				raiseChance: 1,
				raiseRange: ['insignificant', 'lowdraw', 'meddraw', 'hidraw'],
			}
		} else {
			return {
				callLimit: 'beware',
				raiseChance: 0.75,
				raiseRange: ['insignificant', 'lowdraw', 'meddraw', 'hidraw'],
			}
		}
	} else if (highCard > 8 && lowCard > 6) {
		// One high card
		if (suited) {
			return {
				callLimit: 'beware',
				raiseChance: 0.65,
				raiseRange: ['insignificant', 'lowdraw', 'meddraw', 'hidraw'],
			}
		} else {
			return {
				callLimit: 'beware',
				raiseChance: 0.45,
				raiseRange: ['insignificant', 'lowdraw', 'meddraw', 'hidraw'],
			}
		}
	} else if (highCard > 8 && lowCard < 6) {
		if (suited) {
			return {
				callLimit: 'major',
				raiseChance: 0.45,
				raiseRange: ['insignificant', 'lowdraw'],
			}
		} else {
			return {
				callLimit: 'aggro',
				raiseChance: 0.35,
				raiseRange: ['insignificant', 'lowdraw'],
			}
		}
	} else if (highCard > 5 && lowCard > 3) {
		if (suited) {
			return{
				callLimit: 'strong',
				raiseChance: 0.1,
				raiseRange: ['insignificant', 'lowdraw'],
			}
		} else if (straightGap) {
			return {
				callLimit: 'aggro',
				raiseChance: 0,
			}
		} else {
			return {
				callLimit: 'strong',
				raiseChance: 0,
			}
		}
	} else {
		if (suited) {
			return {
				callLimit: 'strong',
				raiseChance: 0.1,
				raiseRange: ['insignificant'],
			}
		} else if (straightGap) {
			return {
				callLimit: 'strong',
				raiseChance: 0,
			}
		} else {
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

const generateHistogram = (hand) => {
	const histogram = hand.reduce((acc, cur) => {
		acc.frequencyHistogram[cur.cardFace] = (acc.frequencyHistogram[cur.cardFace] || 0) + 1;
		acc.suitHistogram[cur.suit] = (acc.suitHistogram[cur.suit] || 0) + 1;
		return acc
	}, { frequencyHistogram: {}, suitHistogram: {} })
	return histogram
}

export { handleAI }