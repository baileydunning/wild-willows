import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { notePanelOpen, resetPanelOpens, settlePanelOpens, snapshotPanelOpens } from '../../src/menuMetrics';

// Menu opens are counted in the client and flushed on the heartbeat rather than
// costing a request of their own. The two things worth pinning: a dropped beat
// must not lose the opens it was carrying, and a menu opened WHILE a beat was in
// flight must survive that beat settling.

beforeEach(() => {
	resetPanelOpens();
});

describe('buffering menu opens', () => {
	it('reports nothing when no menu has been opened', () => {
		expect(snapshotPanelOpens()).toBeUndefined();
	});

	it('counts opens per menu', () => {
		notePanelOpen('journal');
		notePanelOpen('journal');
		notePanelOpen('crafting');
		expect(snapshotPanelOpens()).toEqual({ journal: 2, crafting: 1 });
	});

	it('hands back a copy, so the buffer cannot be mutated through it', () => {
		notePanelOpen('journal');
		const snap = snapshotPanelOpens()!;
		snap.journal = 99;
		expect(snapshotPanelOpens()).toEqual({ journal: 1 });
	});
});

describe('settling a beat', () => {
	it('clears what was reported', () => {
		notePanelOpen('journal');
		const snap = snapshotPanelOpens();
		settlePanelOpens(snap);
		expect(snapshotPanelOpens()).toBeUndefined();
	});

	it('keeps opens that happened while the beat was in flight', () => {
		notePanelOpen('journal');
		const inFlight = snapshotPanelOpens(); // { journal: 1 } — what the server got
		notePanelOpen('journal'); // opened again before the response landed
		notePanelOpen('goals');
		settlePanelOpens(inFlight);
		expect(snapshotPanelOpens()).toEqual({ journal: 1, goals: 1 });
	});

	it('loses nothing when a beat never lands', () => {
		notePanelOpen('settings');
		snapshotPanelOpens(); // beat sent…
		settlePanelOpens(undefined); // …and failed, so nothing settles
		notePanelOpen('settings');
		expect(snapshotPanelOpens()).toEqual({ settings: 2 });
	});
});

describe('signing out', () => {
	it('drops unsent opens, which belong to the save that made them', () => {
		notePanelOpen('journal');
		resetPanelOpens();
		expect(snapshotPanelOpens()).toBeUndefined();
	});
});

// The server keeps a fixed allow-list of menus a heartbeat may report against,
// so a client cannot invent a column in the dashboard. The cost of that is
// drift: a panel added to PanelId but not to the list is counted in the client,
// sent on every beat and silently dropped, which reads as a menu nobody opens
// rather than one nobody measured. The telescope, the Board of Finds and the
// mirror were all missing that way. This pins the two lists together so the
// next panel fails here instead of quietly going unrecorded.
describe('the server allow-list covers every panel', () => {
	const root = process.cwd();

	// Both lists are read out of the source rather than imported: PanelId is a
	// type and so has no runtime form, and MENU_PANELS is private to the worker.
	// Comments go first — the prose around these entries is full of apostrophes.
	const quoted = (src: string, decl: RegExp, what: string) => {
		const body = src.match(decl);
		if (!body) throw new Error(`could not find ${what}`);
		const code = body[1].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');
		return [...code.matchAll(/'([^']+)'/g)].map((m) => m[1]);
	};

	const panelIds = () =>
		quoted(
			readFileSync(resolve(root, 'src/types.ts'), 'utf8'),
			/export type PanelId =([\s\S]*?);/,
			'the PanelId declaration in src/types.ts',
		);

	const menuPanels = () =>
		quoted(
			readFileSync(resolve(root, 'server/endpoints-metrics.ts'), 'utf8'),
			/const MENU_PANELS = new Set\(\[([\s\S]*?)\]\);/,
			'MENU_PANELS in server/endpoints-metrics.ts',
		);

	it('accepts every panel the client can open', () => {
		const allowed = new Set(menuPanels());
		expect(panelIds().filter((id) => !allowed.has(id))).toEqual([]);
	});

	it('lists nothing that is not a panel, apart from the help overlay', () => {
		const known = new Set([...panelIds(), 'help']);
		expect(menuPanels().filter((menu) => !known.has(menu))).toEqual([]);
	});
});
