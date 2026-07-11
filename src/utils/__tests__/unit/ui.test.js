// Tests for the pure presentational helpers in ui.js. JSX-returning helpers
// are asserted via static markup (no extra test-renderer dependency needed).
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import {
	renderPhaseStatement,
	renderUnicodeSuitSymbol,
	renderActionButtonText,
	renderNetPlayerEarnings,
	renderShowdownMessages,
} from '../../ui.js';

describe('renderPhaseStatement', () => {
	it('maps phases to banner text', () => {
		expect(renderPhaseStatement('loading')).toBe('Finding a Table, Please Wait');
		expect(renderPhaseStatement('betting1')).toBe('Betting 1');
		expect(renderPhaseStatement('betting2')).toBe('Flop');
		expect(renderPhaseStatement('betting3')).toBe('Turn');
		expect(renderPhaseStatement('betting4')).toBe('River');
		expect(renderPhaseStatement('showdown')).toBe('Show Your Cards!');
	});

	it('throws on an unfamiliar phase', () => {
		expect(() => renderPhaseStatement('intermission')).toThrow();
	});
});

describe('renderUnicodeSuitSymbol', () => {
	it('maps suits to unicode symbols', () => {
		expect(renderUnicodeSuitSymbol('Heart')).toBe('♥');
		expect(renderUnicodeSuitSymbol('Diamond')).toBe('♦');
		expect(renderUnicodeSuitSymbol('Spade')).toBe('♠');
		expect(renderUnicodeSuitSymbol('Club')).toBe('♣');
	});

	it('throws on an unfamiliar suit', () => {
		expect(() => renderUnicodeSuitSymbol('Rose')).toThrow();
	});
});

describe('renderActionButtonText', () => {
	const player = (chips, bet = 0) => ({ chips, bet });

	it('labels the available action', () => {
		expect(renderActionButtonText(0, 0, player(1000))).toBe('Check');
		expect(renderActionButtonText(100, 100, player(1000))).toBe('Call');
		expect(renderActionButtonText(0, 50, player(1000))).toBe('Bet');
		expect(renderActionButtonText(100, 250, player(1000))).toBe('Raise');
	});

	it('labels all-ins, whether under the high bet or for the exact stack', () => {
		expect(renderActionButtonText(100, 50, player(50))).toBe('All-In!');
		expect(renderActionButtonText(100, 1000, player(900, 100))).toBe('All-In!');
	});
});

describe('renderNetPlayerEarnings', () => {
	const markup = (end, start) =>
		ReactDOMServer.renderToStaticMarkup(renderNetPlayerEarnings(end, start));

	it('shows signed earnings with a matching class', () => {
		expect(markup(150, 100)).toContain('+50');
		expect(markup(150, 100)).toContain('positive');
		expect(markup(100, 150)).toContain('-50');
		expect(markup(100, 150)).toContain('negative');
	});

	it('shows an unsigned zero for a wash', () => {
		expect(markup(100, 100)).toContain('>0<');
	});
});

describe('renderShowdownMessages', () => {
	const markupOf = (messages) =>
		ReactDOMServer.renderToStaticMarkup(
			React.createElement('div', null, renderShowdownMessages(messages))
		);

	it('announces a single winner with prize and rank', () => {
		const markup = markupOf([
			{ users: ['Alice'], prize: 900, rank: 'Straight Flush' },
		]);
		expect(markup).toContain('Alice');
		expect(markup).toContain('900');
		expect(markup).toContain('Straight Flush');
	});

	it('announces split pots per winner', () => {
		const markup = markupOf([
			{ users: ['Xavier', 'Yvonne'], prize: 400, rank: 'Straight' },
		]);
		expect(markup).toContain('2 players');
		expect(markup).toContain('split the pot');
		expect(markup).toContain('Xavier');
		expect(markup).toContain('Yvonne');
		expect(markup).toContain('400');
	});
});
