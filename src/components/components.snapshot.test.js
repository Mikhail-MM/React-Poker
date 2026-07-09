// Markup snapshots for the presentational components, rendered via
// ReactDOMServer.renderToStaticMarkup (no extra test-renderer dependency).
// These pin class names, inline styles (animation delays, suit colors,
// font sizing), and conditional rendering (hidden vs revealed cards, folded
// state, dealer chip, action bubbles).
import React from 'react';
import ReactDOMServer from 'react-dom/server';

import Card from './cards/Card';
import HiddenCard from './cards/HiddenCard';
import ShowdownPlayer from './players/ShowdownPlayer';
import PlayerStatusNotificationBox from './players/PlayerStatusNotificationBox';
import Player from './players/Player';

import { c, cc, mkPlayer } from '../testUtils/factories';

const markup = (element) => ReactDOMServer.renderToStaticMarkup(element);

describe('Card', () => {
	it('renders a red suit with its animation delay', () => {
		expect(
			markup(<Card cardData={{ ...c('AH'), animationDelay: 250 }} />)
		).toMatchSnapshot();
	});

	it('renders a black suit', () => {
		expect(
			markup(<Card cardData={{ ...c('10S'), animationDelay: 0 }} />)
		).toMatchSnapshot();
	});

	it('folded cards get the folded class and a zeroed animation delay', () => {
		expect(
			markup(<Card cardData={{ ...c('AH'), animationDelay: 250 }} applyFoldedClassname />)
		).toMatchSnapshot();
	});
});

describe('HiddenCard', () => {
	it('renders a face-down robot card', () => {
		expect(
			markup(<HiddenCard cardData={{ ...c('AH'), animationDelay: 250 }} />)
		).toMatchSnapshot();
	});
});

describe('ShowdownPlayer', () => {
	it('renders the avatar and revealed private cards', () => {
		expect(
			markup(
				<ShowdownPlayer
					name="Player 1"
					avatarURL="/assets/boy.svg"
					cards={cc('AH KD')}
				/>
			)
		).toMatchSnapshot();
	});
});

describe('PlayerStatusNotificationBox', () => {
	it('renders the action bubble content', () => {
		expect(
			markup(
				<PlayerStatusNotificationBox
					index={0}
					isActive={true}
					content="Raise 500"
					endTransition={() => {}}
				/>
			)
		).toMatchSnapshot();
	});
});

describe('Player', () => {
	// NOTE: the idle action bubble renders the literal text "null" (the
	// switchboard content starts as null and the component stringifies it);
	// it is present in the real DOM too, hidden by CSS. Pinned as-is.
	const idleSwitchboard = { 0: { isAnimating: false, content: null } };
	// Dealt cards carry an animationDelay stamped by dealPrivateCards.
	const dealtCards = cc('AH KD').map((card, i) => ({ ...card, animationDelay: i * 250 }));
	const playerProps = (playerOverrides = {}, propOverrides = {}) => ({
		arrayIndex: 0,
		playerAnimationSwitchboard: idleSwitchboard,
		endTransition: () => {},
		hasDealerChip: false,
		isActive: false,
		phase: 'betting1',
		clearCards: false,
		player: mkPlayer('Player 1', {
			avatarURL: '/assets/boy.svg',
			cards: dealtCards,
			chips: 19500,
			bet: 500,
			...playerOverrides,
		}),
		...propOverrides,
	});

	it('renders the human player with revealed cards, active ring, and dealer chip', () => {
		expect(
			markup(<Player {...playerProps({}, { isActive: true, hasDealerChip: true })} />)
		).toMatchSnapshot();
	});

	it('renders robot cards face-down before showdown', () => {
		expect(
			markup(<Player {...playerProps({ robot: true, name: 'Robo' })} />)
		).toMatchSnapshot();
	});

	it('reveals robot cards at showdown', () => {
		expect(
			markup(
				<Player {...playerProps({ robot: true, name: 'Robo' }, { phase: 'showdown' })} />
			)
		).toMatchSnapshot();
	});

	it('marks folded players cards', () => {
		expect(
			markup(<Player {...playerProps({ folded: true })} />)
		).toMatchSnapshot();
	});
});
