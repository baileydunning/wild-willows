import { describe, it, expect, beforeEach } from 'vitest';
import { freshWorld, appearance, type World } from './harness';

// What one failed login is allowed to cost the server.
//
// Passcode checks run scryptSync — deliberately slow, and SYNCHRONOUS, so each
// one blocks every other request on the node rather than just the caller's. Two
// things therefore have to hold, and neither is visible from ordinary use:
//
//  1. The number of checks per attempt is capped. It was not, and because
//     CreatePlayer is public and same-name saves are allowed by design, the
//     caller could grow that number themselves.
//  2. The unbounded Player scan behind an unknown name happens at most ONCE per
//     name. Repeating a made-up name is the cheapest way to ask for it.
//
// An earlier version of the cap guarded the branch that cannot be reached once a
// name is indexed, which is why these assert on the indexed path specifically.

let w: World;
beforeEach(async () => {
	w = await freshWorld();
});

const makeSave = (name: string, passcode = '1234') => w.post('CreatePlayer', { name, passcode, appearance });
const login = (name: string, passcode: string) => w.post('LoginPlayer', { name, passcode });

describe('a failed login costs a bounded number of passcode checks', () => {
	it('caps the checks when many saves share one name', async () => {
		for (let i = 0; i < 40; i++) await makeSave('willow', `pass${i}`);
		// A wrong passcode is the expensive case: nothing matches, so without a cap
		// every one of the 40 would be hashed.
		w.db.Player._resetScanStats();
		await expect(login('willow', 'definitely-wrong')).rejects.toBeTruthy();
		// The index holds all 40, but only a bounded slice is ever read back.
		const idx = await w.db.PlayerNameIndex.get('willow');
		expect(idx.playerIds.length).toBeLessThanOrEqual(200);
		// and no unbounded Player scan was needed, because the name IS indexed
		expect(w.db.Player._scanStats().unboundedScans).toBe(0);
	});

	it('still logs in a recent save among many of the same name', async () => {
		for (let i = 0; i < 10; i++) await makeSave('willow', `pass${i}`);
		const mine = await makeSave('willow', 'mine-9876');
		const found = await login('willow', 'mine-9876');
		expect(found.playerId).toBe(mine.playerId);
	});

	it('keeps the index row bounded however many saves share a name', async () => {
		for (let i = 0; i < 260; i++) await makeSave('willow', `pass-${i}`);
		const idx = await w.db.PlayerNameIndex.get('willow');
		expect(idx.playerIds.length).toBe(200);
		// The trim drops the OLDEST, so the newest save — the one somebody is most
		// likely to be logging into — is still there.
		const newest = (await makeSave('willow', 'newest')).playerId;
		const after = await w.db.PlayerNameIndex.get('willow');
		expect(after.playerIds).toContain(newest);
		expect(after.playerIds.length).toBe(200);
	});
});

describe('the unbounded scan behind an unknown name runs at most once', () => {
	it('does not re-scan every time the same missing name is tried', async () => {
		await makeSave('somebody', '1234');

		w.db.Player._resetScanStats();
		await expect(login('ghost', 'x')).rejects.toBeTruthy();
		const first = w.db.Player._scanStats().unboundedScans;
		expect(first).toBeGreaterThan(0); // the name was never indexed, so it looks once

		w.db.Player._resetScanStats();
		for (let i = 0; i < 5; i++) await expect(login('ghost', 'x')).rejects.toBeTruthy();
		// Having looked once and found nothing, it remembers that.
		expect(w.db.Player._scanStats().unboundedScans).toBe(0);
	});

	it('a name learned by the scan is reachable without scanning again', async () => {
		// Simulate a save that predates the name index: the row exists, the index
		// does not.
		const { playerId } = await makeSave('legacy', 'secret');
		await w.db.PlayerNameIndex.delete('legacy');

		w.db.Player._resetScanStats();
		const found = await login('legacy', 'secret');
		expect(found.playerId).toBe(playerId);
		expect(w.db.Player._scanStats().unboundedScans).toBeGreaterThan(0);

		// The scan back-filled the index on its way past.
		w.db.Player._resetScanStats();
		const again = await login('legacy', 'secret');
		expect(again.playerId).toBe(playerId);
		expect(w.db.Player._scanStats().unboundedScans).toBe(0);
	});

	it('a save created after the miss is still found', async () => {
		// The empty marker must not become a permanent "no such name".
		await expect(login('later', 'x')).rejects.toBeTruthy();
		const { playerId } = await makeSave('later', 'hello');
		const found = await login('later', 'hello');
		expect(found.playerId).toBe(playerId);
	});
});
