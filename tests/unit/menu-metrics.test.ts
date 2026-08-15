import { describe, it, expect, beforeEach } from 'vitest';
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
