import React from 'react';

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

const renderShowdownMessages = (showDownMessages) => {
    return showDownMessages.map(message => {
		const { users, prize, rank } = message;
		if (users.length > 1) {
			return (
				<React.Fragment>
					<div className="message--container">
						<span className="message--user">
							{`${users.length} players `}
						</span>
						<span className="message--content">
							{`split the pot with a `}
						</span>
						<span className="message--rank">
							{`${rank}!`}
						</span>
					</div>
					{ 
						users.map(user => {
							return(
								<div class="message--container">
									<span className="message--player">
										{`${user} `}
									</span>
									<span className="message--content">
										{`takes `}
									</span>
									<span className="message--earnings">
										{`${prize} chips `}
									</span>
									<span className="message--content">
										{`from the pot.`}
									</span>
								</div>
							)
						})
					}
				</React.Fragment>
			)
		} else if (users.length === 1) {
			return(
				<div class="message--container">
					<span className="message--player">
						{`${users[0]} `}
					</span>
					<span className="message--content">
						{`wins `}
					</span>
					<span className="message--earnings">
						{`${prize} chips `}
					</span>
					<span className="message--content">
						{`from the pot with a `}
					</span>
					<span className="message--rank">
						{`${rank}!`}
					</span>
				</div>
			)
		}
	})
}

export { 
	renderPhaseStatement, 
	renderUnicodeSuitSymbol, 
	renderShowdownMessages 
}

