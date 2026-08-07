import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { freshWorld, appearance, type World } from './harness';

// Regression tests for undecodable-record self-healing.
//
// Production symptom (Harper logs, thousands of them):
//   Error decoding record Error: Data read, but end of buffer not reached
//   {"id":"kayla-z47x0v","name":"kayla","passcodeSalt":…
//     at RecordEncoder.decode … at async ensureSoloWorld
//
// Two facts make this both dangerous and fixable, and every test below pins one
// of them:
//
//  • Harper CATCHES that error, logs it, and returns null (RecordEncoder.decode).
//    It never throws. So an unreadable row looks exactly like a missing row, and
//    code that reacts to "missing" by creating a replacement will overwrite a
//    live save.
//  • msgpackr raises it only AFTER decoding the value completely — it means
//    "unread bytes remain", not "data is bad". The record is intact and can be
//    recovered by decoding in sequential mode, then rewritten.
//
// The harness reproduces both behaviours faithfully: `_corrupt(id)` appends
// trailing bytes to the real msgpackr payload, makes get() return undefined, and
// leaves the bytes readable through primaryStore.

let w: World;
let errs: string[];

beforeEach(async () => {
	w = await freshWorld();
	errs = [];
	vi.spyOn(console, 'error').mockImplementation((...a: any[]) => {
		errs.push(a.map(String).join(' '));
	});
});

afterEach(() => vi.restoreAllMocks());

const make = (name = 'Kayla', passcode = 'hunter2') => w.post('CreatePlayer', { name, passcode, appearance });

describe('undecodable Player rows heal on read', () => {
	it('recovers the record instead of reporting the save as missing', async () => {
		const { playerId } = await make();
		const before = structuredClone(w.db.Player._rows.get(playerId));
		w.db.Player._corrupt(playerId);
		expect(await w.db.Player.get(playerId)).toBeUndefined(); // Harper's silent null

		const login = await w.post('LoginPlayer', { name: 'Kayla', passcode: 'hunter2' });

		expect(login.ok).toBe(true);
		expect(w.db.Player._isCorrupt(playerId)).toBe(false); // rewritten → healed
		expect(w.db.Player._rows.get(playerId)).toEqual(before); // byte-for-byte the same save
		expect(errs.join('\n')).toContain(`salvaged undecodable record: Player/${playerId}`);
	});

	it('preserves credentials, so the player can still log in afterwards', async () => {
		const { playerId } = await make();
		w.db.Player._corrupt(playerId);
		await w.post('LoginPlayer', { name: 'Kayla', passcode: 'hunter2' });

		const healed = w.db.Player._rows.get(playerId);
		expect(healed.passcodeHash).toBeTruthy();
		expect(healed.passcodeSalt).toBeTruthy();
		// the real proof: the passcode still verifies against the healed row
		await expect(w.post('LoginPlayer', { name: 'Kayla', passcode: 'hunter2' })).resolves.toMatchObject({ ok: true });
		await expect(w.post('LoginPlayer', { name: 'Kayla', passcode: 'wrong' })).rejects.toThrow();
	});

	it('never destroys the row — a corrupt save is not silently deleted', async () => {
		const { playerId } = await make();
		w.db.Player._corrupt(playerId);
		await w.post('LoginPlayer', { name: 'Kayla', passcode: 'hunter2' });
		expect(w.db.Player._rows.has(playerId)).toBe(true);
		expect(errs.join('\n')).not.toContain('purged');
	});

	it('keeps progress made before the row went bad', async () => {
		const { playerId } = await make();
		await w.post('SyncPlayer', { playerId, x: 12, y: 9, area: 'meadow', tutorialStep: 4 });
		const before = structuredClone(w.db.Player._rows.get(playerId));
		w.db.Player._corrupt(playerId);

		await w.post('LoginPlayer', { name: 'Kayla', passcode: 'hunter2' });

		expect(w.db.Player._rows.get(playerId)).toEqual(before);
	});
});

describe('a corrupt World is not mistaken for a missing one', () => {
	it('ensureSoloWorld heals the world rather than re-creating it', async () => {
		const { playerId } = await make();
		// Give the world state that a freshly-created replacement would NOT have, so
		// a silent re-create is actually detectable. (Without this the test passes
		// even against the bug, because a rebuilt solo world coincidentally matches
		// the original field for field.) Only fields ensureSoloWorld leaves alone —
		// meadowShift is legitimately rewritten by migrateMeadowWest.
		const world = w.db.World._rows.get(playerId);
		world.name = "Kayla's long-running preserve";
		world.createdAt = 1600000000000;
		const before = structuredClone(world);
		w.db.World._corrupt(playerId);

		await w.post('LoginPlayer', { name: 'Kayla', passcode: 'hunter2' });

		// The exact production failure: a null read here used to run World.put() and
		// stamp a brand-new world over the real one, resetting name/createdAt/shift.
		expect(w.db.World._rows.get(playerId)).toEqual(before);
		expect(w.db.World._isCorrupt(playerId)).toBe(false);
	});

	it('does not create a duplicate membership for a corrupt WorldMember row', async () => {
		const { playerId } = await make();
		const memberId = `${playerId}:${playerId}`;
		const before = structuredClone(w.db.WorldMember._rows.get(memberId));
		w.db.WorldMember._corrupt(memberId);

		await w.post('LoginPlayer', { name: 'Kayla', passcode: 'hunter2' });

		expect(w.db.WorldMember._rows.get(memberId)).toEqual(before);
		expect([...w.db.WorldMember._rows.keys()]).toEqual([memberId]);
	});
});

describe('safety limits on salvage', () => {
	it('refuses a salvage that lost the passcode, leaving the row for manual repair', async () => {
		const { playerId } = await make();
		// Simulate a genuinely lossy salvage: credentials gone from the stored bytes.
		const row = w.db.Player._rows.get(playerId);
		delete row.passcodeHash;
		w.db.Player._corrupt(playerId);

		await w.post('LoginPlayer', { name: 'Kayla', passcode: 'hunter2' }).catch(() => {});

		expect(w.db.Player._isCorrupt(playerId)).toBe(true); // NOT rewritten
		expect(w.db.Player._rows.has(playerId)).toBe(true); // NOT deleted
		expect(errs.join('\n')).toContain('partial salvage refused');
	});

	it('reports a genuinely absent record as absent, without inventing one', async () => {
		await expect(w.get('GameState', 'ghost')).rejects.toThrow();
		expect(w.db.Player._rows.has('ghost')).toBe(false);
		expect(errs.join('\n')).not.toContain('salvaged undecodable record');
	});

	it('healthy rows are left completely alone', async () => {
		const { playerId } = await make();
		const before = structuredClone(w.db.Player._rows.get(playerId));
		await w.post('LoginPlayer', { name: 'Kayla', passcode: 'hunter2' });
		expect(errs.join('\n')).not.toContain('salvage');
		expect(w.db.Player._rows.get(playerId).id).toBe(before.id);
	});
});

describe('scans surface dropped rows instead of hiding them', () => {
	it('counts undecodable rows a scan skipped rather than silently shrinking results', async () => {
		const a = await make('Kayla', 'pw1234');
		await make('Methernal', 'pw2345');
		// A world-state row that a scan will walk past.
		const tiles = w.db.TerrainTile;
		await tiles.put({ id: `${a.playerId}:meadow:3:4`, worldId: a.playerId, area: 'meadow', x: 3, y: 4, type: 'grass' });
		tiles._corrupt(`${a.playerId}:meadow:3:4`);

		await w.post('LoginPlayer', { name: 'Kayla', passcode: 'pw1234' });

		expect(errs.join('\n')).toMatch(/scan of \w+: \d+ undecodable record\(s\) omitted/);
	});

	it('one bad row does not truncate the rest of a scan', async () => {
		const a = await make('Kayla', 'pw1234');
		const tiles = w.db.TerrainTile;
		for (let x = 0; x < 5; x++) {
			await tiles.put({
				id: `${a.playerId}:meadow:${x}:0`,
				worldId: a.playerId,
				area: 'meadow',
				x,
				y: 0,
				type: 'grass',
			});
		}
		tiles._corrupt(`${a.playerId}:meadow:1:0`); // bad row in the middle

		const state = await w.get('GameState', a.playerId);

		// 4 of 5 survive — the 3 rows after the bad one must still be there.
		expect(state.terrain?.length ?? 0).toBe(4);
	});
});
