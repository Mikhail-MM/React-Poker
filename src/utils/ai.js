
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


const handleAI = (state) => {
	const activePlayer = state.players[state.activePlayerIndex];
	const totalInvestment = activePlayer.chips + activePlayer.bet;
	const investmentRequiredToRemain = (state.highBet / totalInvestment) * 100; 
	const descendingSortHand = activePlayer.cards.concat(state.communityCards).sort((a, b) => b.value - a.value)
	const { frequencyHistogram, suitHistogram } =  generateHistogram(descendingSortHand)
	const stakes = classifyStakes(state.highBet);

	// We may want to keep track of how much the Ai has already invested into the pot to help determine what action to take.
	switch(state.phase) {
		case('betting1'): { 
			break
		}
		case('betting2'): {
			break
		}
		case('betting3'): {
			break
		}
		case('betting4'): {
			break
		}
	}

}

const classifyStakes = (percentage) => {
	switch (true) {
		case (percentage > 80):
			return 'beware'
		case (percentage > 40):
			return 'aggressive stakes'
		case (percentage > 35): 
			return 'major commitment'
		case (percentage > 20): 
			return 'strong assertion'
		case (percentage > 15):
			return 'high draw'
		case (percentage > 10): 
			return 'medium draw'
		case (percentage > 5):
			return 'low draw'
		case (percentage >= 1): 
			return 'insignificant'
		case (percentage < 1): 
			return 'blind'
	}
}

// Move to analysis utils
const generateHistogram = (hand) => {
	return hand.reduce((acc, cur) => {
		acc.frequencyHistogram[cur.cardFace] = (acc.frequencyHistogram[cur.cardFace] || 0) + 1;
		acc.suitHistogram[cur.suit] = (acc.suitHistogram[cur.suit] || 0) + 1;
		return acc
	}, { frequencyHistogram: {}, suitHistogram: {} })
}


export { handleAI }
