// Side-pot scenario matrix: table-driven coverage of the pot bucketing,
// condensation, dead-money, and refund system (reconcilePot ->
// calculateSidePots -> condenseSidePots).
//
// Every scenario runs the same way: play one or more betting streets, then
// snapshot the per-street LEDGER (pots, contestants, stacks after each
// reconcile). Three invariants are hard-asserted for every scenario:
//   1. state.pot === sum of sidePot values after every street
//   2. no duplicate contestants within a pot
//   3. chips are conserved end-to-end (bets -> pot -> refunds)
//
// Street notation: { PlayerName: bet } or { PlayerName: { bet, folds: true } }.
import { reconcilePot } from './bet.js';
import { mkPlayer, mkState } from '../testUtils/factories.js';

const playStreets = (roster, streets) => {
	let state = mkState(
		Object.entries(roster).map(([name, chips]) => mkPlayer(name, { chips }))
	);
	const startingTotal = Object.values(roster).reduce((sum, chips) => sum + chips, 0);
	const ledger = [];

	streets.forEach((street, streetIndex) => {
		Object.entries(street).forEach(([name, action]) => {
			const config = typeof action === 'number' ? { bet: action } : action;
			const player = state.players.find(p => p.name === name);
			player.chips -= config.bet || 0;
			player.bet = config.bet || 0;
			if (config.folds) {
				player.folded = true;
				state.numPlayersFolded++;
				state.numPlayersActive--;
			}
		});

		state = reconcilePot(state);

		// Invariant 1: the display pot is exactly the sum of the tracked pots.
		const sidePotTotal = state.sidePots.reduce((sum, sp) => sum + sp.potValue, 0);
		expect(state.pot).toBe(sidePotTotal);
		// Invariant 2: a contestant appears at most once per pot.
		state.sidePots.forEach(sp => {
			expect(new Set(sp.contestants).size).toBe(sp.contestants.length);
		});

		ledger.push({
			street: streetIndex + 1,
			pot: state.pot,
			sidePots: state.sidePots.map(sp => `${sp.potValue}: [${sp.contestants.join(', ')}]`),
			stacks: state.players.map(p => `${p.name}=${p.chips}${p.folded ? ' FOLDED' : ''}`),
		});
	});

	// Invariant 3: no chips created or destroyed anywhere in the pipeline.
	const endingTotal =
		state.players.reduce((sum, p) => sum + p.chips + p.bet, 0) + state.pot;
	expect(endingTotal).toBe(startingTotal);

	return ledger;
};

const scenarios = [
	{
		name: 'everyone calls the same amount -> one pot',
		roster: { A: 1000, B: 1000, C: 1000 },
		streets: [{ A: 100, B: 100, C: 100 }],
	},
	{
		name: 'one short all-in below the field -> main pot + side pot',
		roster: { A: 100, B: 1000, C: 1000 },
		streets: [{ A: 100, B: 300, C: 300 }],
	},
	{
		name: 'the bet.js comment ladder (100/200/300/500/1000) with final refund',
		// The worked example from the comment block in calculateSidePots:
		// layers 500/400/300/400, then E's uncalled 500 is refunded.
		roster: { A: 100, B: 200, C: 300, D: 500, E: 1500 },
		streets: [{ A: 100, B: 200, C: 300, D: 500, E: 1000 }],
	},
	{
		name: 'dead money below the lowest all-in stays in the main pot',
		// The folder's 50 splits across both layers; condensation merges the
		// identical-contestant layers back into one pot.
		roster: { Folder: 1000, A: 100, B: 1000 },
		streets: [{ Folder: { bet: 50, folds: true }, A: 100, B: 100 }],
	},
	{
		name: 'dead money spanning multiple all-in layers',
		// Folder's 500 covers the 200 layer (into the main pot) and 300 more
		// (into the second layer); B's last 300 is uncalled and refunded.
		roster: { Folder: 1000, A: 200, B: 1000 },
		streets: [{ Folder: { bet: 500, folds: true }, A: 200, B: 800 }],
	},
	{
		name: 'uncalled raise is refunded to the raiser',
		roster: { Raiser: 1000, Caller: 200 },
		streets: [{ Raiser: 500, Caller: 200 }],
	},
	{
		name: 'everyone folds to the aggressor -> single-contestant pot of dead money',
		roster: { A: 1000, B: 1000, C: 1000 },
		streets: [{ A: 100, B: { bet: 100, folds: true }, C: { bet: 100, folds: true } }],
	},
	{
		name: 'abandoned small blind is dead money across both layers',
		roster: { SmallBlind: 1000, BigBlind: 1000, Caller: 1000 },
		streets: [{ SmallBlind: { bet: 10, folds: true }, BigBlind: 20, Caller: 20 }],
	},
	{
		name: 'odd un-round amounts layer and refund exactly',
		// 33/77/101: layers 99 + 88, then 24 uncalled back to C.
		roster: { A: 33, B: 77, C: 1000 },
		streets: [{ A: 33, B: 77, C: 101 }],
	},
	{
		name: 'two streets with identical contestants condense into one pot',
		roster: { A: 1000, B: 1000, C: 1000 },
		streets: [
			{ A: 100, B: 100, C: 100 },
			{ A: 250, B: 250, C: 250 },
		],
	},
	{
		name: 'contestants shrinking across streets keep pots separate',
		// A funds street 1 then folds during street 2. QUIRK: A remains listed
		// as a contestant of the street-1 pot (contestant lists are frozen at
		// pot-build time); the showdown re-checks folded status, so A still
		// cannot win it — the staleness is safe but real.
		roster: { A: 1000, B: 1000, C: 1000 },
		streets: [
			{ A: 100, B: 100, C: 100 },
			{ A: { bet: 0, folds: true }, B: 200, C: 200 },
		],
	},
	{
		name: 'a checked-through street adds no pots',
		roster: { A: 1000, B: 1000, C: 1000 },
		streets: [
			{ A: 100, B: 100, C: 100 },
			{ A: 0, B: 0, C: 0 },
		],
	},
	{
		name: 'kitchen sink: multi-street ladder, dead money, and condensation',
		// Street 1: A all-in 150 under B/C's 400, folder abandons 100.
		// Street 2: B and C keep betting; their new pot condenses into the
		// existing B/C side pot while A's main pot stays frozen.
		roster: { A: 150, B: 1000, C: 1000, Folder: 1000 },
		streets: [
			{ A: 150, B: 400, C: 400, Folder: { bet: 100, folds: true } },
			{ B: 300, C: 300 },
		],
	},
];

describe('side-pot scenario matrix', () => {
	scenarios.forEach(({ name, roster, streets }) => {
		it(name, () => {
			expect(playStreets(roster, streets)).toMatchSnapshot();
		});
	});
});
