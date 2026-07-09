// Seam tracer: records a snapshot of the game state every time the synchronous
// transform cascade crosses a module boundary (bet.js <-> players.js <-> cards.js).
//
// How it works: the source modules call each other through their compiled
// module-exports objects (babel turns `import { fn }` call sites into
// `(0, _module.fn)(...)` property lookups), so jest.spyOn on the module
// namespace intercepts the INTERNAL calls between modules — no source changes.
//
// Limitation worth knowing: calls WITHIN a module (e.g. handlePhaseShift ->
// reconcilePot, both in bet.js, or recursive self-calls) are direct function
// references and cannot be observed this way. Those blind spots are the
// motivating case for Stage 2 of docs/TESTING_ROADMAP.md.
import * as betModule from '../utils/bet.js';
import * as playersModule from '../utils/players.js';
import * as cardsModule from '../utils/cards.js';

import { codes } from './factories.js';

// Every cross-module seam whose first argument is the state object.
const SEAMS = [
	[betModule, 'handleBet'],
	[betModule, 'handleFold'],
	[betModule, 'handlePhaseShift'],
	[betModule, 'reconcilePot'],
	[playersModule, 'determineNextActivePlayer'],
	[playersModule, 'determinePhaseStartActivePlayer'],
	[cardsModule, 'dealPrivateCards'],
	[cardsModule, 'dealFlop'],
	[cardsModule, 'dealTurn'],
	[cardsModule, 'dealRiver'],
	[cardsModule, 'dealMissingCommunityCards'],
	[cardsModule, 'showDown'],
];

// Compact, eagerly-extracted view of the state (the cascade mutates in place,
// so every value must be copied out at the moment of capture).
export const traceSnapshot = (state) => ({
	phase: state.phase,
	pot: state.pot,
	highBet: state.highBet,
	activePlayerIndex: state.activePlayerIndex,
	communityCards: codes(state.communityCards || []),
	players: state.players.map(p =>
		`${p.name} chips=${p.chips} bet=${p.bet}` +
		`${p.folded ? ' FOLDED' : ''}${p.allIn ? ' ALL-IN' : ''}${p.betReconciled ? ' reconciled' : ''}`
	),
	sidePots: (state.sidePots || []).map(sp => `${sp.potValue}: [${sp.contestants.join(', ')}]`),
});

// Runs `driver` with all seams instrumented. Returns the entry-ordered trace
// (state as observed on ENTRY to each seam) plus the driver's return value.
export const traceGameFlow = (driver) => {
	const trace = [];
	const spies = SEAMS.map(([module, name]) => {
		const original = module[name];
		return jest.spyOn(module, name).mockImplementation((...args) => {
			trace.push({ seam: name, stateOnEntry: traceSnapshot(args[0]) });
			return original(...args);
		});
	});
	try {
		const result = driver();
		trace.push({ seam: '(final)', stateOnEntry: traceSnapshot(result) });
		return { trace, result };
	} finally {
		spies.forEach(spy => spy.mockRestore());
	}
};

// The modules re-exported so trace tests can invoke entry points THROUGH the
// instrumented namespace (a direct import binding would bypass the entry spy).
export { betModule, playersModule, cardsModule };
