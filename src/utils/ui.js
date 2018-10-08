const renderPhaseStatement = (phase) => {
	switch(phase) {
		case('loading'): return 'Finding a Table, Please Wait'
		case('initialDeal'): return 'Dealing out the cards'
		case('betting1'): return 'Betting 1'
		case('flop'): return 'Flop'
		case('betting2'): return 'Flop'
		case('turn'): return 'Turn'
		case('betting3'): return 'Turn'
		case('river'): return 'River'
		case('betting4'): return 'River'
		case('showdown'): return 'Show Your Cards!'
	}
}

const renderUnicodeSuitSymbol = (suit) => {
	switch(suit) {
		case('Heart'): return '\u2665'
		case('Diamond'): return '\u2666'
		case('Spade'): return '\u2660'
		case('Club'): return '\u2663'
	}
}


export { renderPhaseStatement, renderUnicodeSuitSymbol }
