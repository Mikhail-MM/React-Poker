import React from 'react';

import Handle from "../components/slider/Handle";
import Track from "../components/slider/Track";
import { sliderStyle, railStyle } from "../components/slider/styles";

import { Slider, Rail, Handles, Tracks } from 'react-compound-slider'

import { 
  determineMinBet
} from './bet.js';

const renderPhaseStatement = (phase) => {
	switch(phase) {
		case('loading'): return 'Finding a Table, Please Wait';
		case('initialDeal'): return 'Dealing out the cards';
		case('betting1'): return 'Betting 1';
		case('flop'): return 'Flop';
		case('betting2'): return 'Flop';
		case('turn'): return 'Turn';
		case('betting3'): return 'Turn';
		case('river'): return 'River';
		case('betting4'): return 'River';
		case('showdown'): return 'Show Your Cards!';
		default: throw Error('Unfamiliar phase returned from renderPhaseStatement()');
	}
}

const renderUnicodeSuitSymbol = (suit) => {
	switch(suit) {
		case('Heart'): return '\u2665';
		case('Diamond'): return '\u2666';
		case('Spade'): return '\u2660';
		case('Club'): return '\u2663';
		default: throw Error('Unfamiliar String Recieved in Suit Unicode Generation');
	}
}

const renderActionButtonText = (highBet, betInputValue, activePlayer) => {
	if ((highBet === 0) && (betInputValue === 0)) {
		return 'Check'
	} else if ((highBet === betInputValue)) {
		return 'Call'
	} else if ((highBet === 0) && (betInputValue > highBet)) {
		return 'Bet'
	} else if ((betInputValue < highBet) || (betInputValue === activePlayer.chips + activePlayer.bet)) {
		return 'All-In!'
	} else if (betInputValue > highBet) {
		return 'Raise'
	} 
}

const renderNetPlayerEarnings = (endChips, startChips) => {
	const netChipEarnings = (endChips - startChips);
	const win = (netChipEarnings > 0);
	const none = (netChipEarnings === 0);	
	return(
		<div class={`showdownPlayer--earnings ${(win) ? ('positive') : (none) ? ('') : ('negative')}`}>
			{`${(win) ? ('+') : ('')}${netChipEarnings}`}
		</div>  
	)
}

const renderShowdownMessages = (showDownMessages) => {
    return showDownMessages.map((message, index) => {
		const { users, prize, rank } = message;
		if (users.length > 1) {
			return (
				<React.Fragment key={index}>
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
								<div key={index + user} class="message--container">
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
				<div key={index} className="message--container">
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

const renderActionMenu = (highBet, players, activePlayerIndex, phase, changeSliderInputFn) => {
	const min = determineMinBet(highBet, players[activePlayerIndex].chips, players[activePlayerIndex].bet)
	const max = players[activePlayerIndex].chips + players[activePlayerIndex].bet
	return(
		(phase === 'betting1' || phase === 'betting2' || phase === 'betting3' || phase === 'betting4') ? (players[activePlayerIndex].robot) ? (<h4> {`Current Move: ${players[activePlayerIndex].name}`}</h4>) : (
			<React.Fragment>
			<Slider
				rootStyle={sliderStyle}
				domain={[min, max]}
				values={[min]}
				step={1}

				onChange={changeSliderInputFn}
					mode={2}
			>
				<Rail>
					{
						({ getRailProps }) => (
							<div style={railStyle} {...getRailProps()} />
						)
					}
				</Rail>
				<Handles>
					{ 
						({ handles, getHandleProps}) => (
							<div className='slider-handles'>
								{ 
									handles.map(handle => (
										<Handle
											key={handle.id}
											handle={handle}
											getHandleProps={getHandleProps}
										/>
									))
								}
							</div>
						)
					}
				</Handles>
				<Tracks right={false}>
					{
						({ tracks, getTrackProps }) => (
							<div className='slider-tracks'>
								{
									tracks.map(
										({ id, source, target }) => (
											<Track
												key={id}
												source={source}
												target={target}
												getTrackProps={getTrackProps}
											/>
										)
									)
								}
							</div>
						)
					}
				</Tracks>
			</Slider>
			</React.Fragment>
		) : null
	)
}

export { 
	renderPhaseStatement, 
	renderUnicodeSuitSymbol, 
	renderShowdownMessages,
	renderNetPlayerEarnings,
	renderActionMenu,
	renderActionButtonText 
}

