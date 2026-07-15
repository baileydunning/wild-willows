import { describe, it, expect, beforeEach, vi } from 'vitest';

// A localStorage shim (unit env has none) so the solo save IO can round-trip.
const store = new Map<string, string>();
(globalThis as any).localStorage = {
	getItem: (k: string) => store.get(k) ?? null,
	setItem: (k: string, v: string) => {
		store.set(k, v);
	},
	removeItem: (k: string) => {
		store.delete(k);
	},
	key: (i: number) => [...store.keys()][i] ?? null,
	get length() {
		return store.size;
	},
};

// Control what the "active save" serializes to, so we can simulate an in-game restyle.
const h = vi.hoisted(() => ({ data: { Player: [] as any[] } as Record<string, any[]> }));
vi.mock('../../src/solo/backend', () => ({ serializeActiveSave: () => h.data }));

import { createSlot, persist, listSaves, loadSaveData, exportSlot, importSave } from '../../src/solo/saves';

describe('solo save meta stays in sync with the live player', () => {
	beforeEach(() => {
		store.clear();
	});

	it('persist refreshes appearance + name from the saved player row (restyle bug)', async () => {
		h.data = { Player: [{ id: 'ivy', name: 'Ivy', appearance: { hat: 'straw', hair: '#6e4a33' } }] };
		const slot = await createSlot({ playerId: 'ivy', name: 'Ivy', appearance: { hat: 'straw', hair: '#6e4a33' } });
		expect((await listSaves())[0].appearance.hat).toBe('straw');

		// player restyles in-game, then the world autosaves
		h.data = { Player: [{ id: 'ivy', name: 'Ivy Bloom', appearance: { hat: 'crown', hair: '#ffffff' } }] };
		await persist(slot);

		const m = (await listSaves()).find((x) => x.slotId === slot.slotId)!;
		expect(m.appearance.hat).toBe('crown'); // load screen now shows the new look
		expect(m.appearance.hair).toBe('#ffffff');
		expect(m.name).toBe('Ivy Bloom');
	});

	it('falls back to the existing meta when the player row is missing', async () => {
		h.data = { Player: [{ id: 'sam', name: 'Sam', appearance: { hat: 'beanie' } }] };
		const slot = await createSlot({ playerId: 'sam', name: 'Sam', appearance: { hat: 'beanie' } });
		h.data = { Player: [] }; // nothing to read
		await persist(slot);
		expect((await listSaves())[0].appearance.hat).toBe('beanie');
	});
});

describe('export / import round-trip (offline save backups)', () => {
	beforeEach(() => {
		store.clear();
	});

	it('exports the full save (world data + name + appearance) and re-imports it as a new slot', async () => {
		h.data = {
			Player: [{ id: 'ivy', name: 'Ivy', appearance: { hat: 'crown', hair: '#fff' } }],
			Plot: [{ id: 'p1', crop: 'fern' }],
		};
		const slot = await createSlot({ playerId: 'ivy', name: 'Ivy', appearance: { hat: 'crown', hair: '#fff' } });
		await persist(slot);

		const dump = await exportSlot(slot.slotId);
		expect(dump).toBeTruthy();
		const parsed = JSON.parse(dump!);
		expect(parsed.app).toBe('wild-willows'); // encrypted envelope
		expect(typeof parsed.sig).toBe('string');
		expect(typeof parsed.nonce).toBe('string');
		expect(typeof parsed.enc).toBe('string');
		// the payload is encrypted — no plaintext leaks into the file
		expect(dump).not.toContain('ivy');
		expect(dump).not.toContain('crown');
		expect(dump).not.toContain('fern');
		expect(parsed.save).toBeUndefined();

		// wipe everything (simulating a fresh machine) and import the file back
		store.clear();
		const meta = await importSave(dump!);
		expect(meta.slotId).not.toBe(slot.slotId); // lands as a NEW slot, never clobbers
		expect(meta.name).toBe('Ivy');
		expect(meta.appearance.hat).toBe('crown'); // character design survives the round-trip

		const metas = await listSaves();
		expect(metas).toHaveLength(1);
		expect(metas[0].playerId).toBe('ivy');
		const restored = await loadSaveData(metas[0].slotId);
		expect(restored?.data.Plot[0].crop).toBe('fern'); // world data too
	});

	it('rejects malformed, unencrypted, or non-save JSON', async () => {
		await expect(importSave('not json at all')).rejects.toThrow('invalid-save');
		await expect(importSave(JSON.stringify({ hello: 'world' }))).rejects.toThrow('invalid-save');
		// a bare {meta,data} with no encrypted envelope is refused
		await expect(importSave(JSON.stringify({ meta: { playerId: 'a' }, data: {} }))).rejects.toThrow('invalid-save');
		// right envelope shape, but the ciphertext is bogus
		await expect(
			importSave(JSON.stringify({ app: 'wild-willows', v: 1, nonce: 'n', sig: 'x', enc: 'AAAA' })),
		).rejects.toThrow('invalid-save');
	});

	it('rejects an edited save (ciphertext changed or tag no longer matches)', async () => {
		h.data = { Player: [{ id: 'ivy', name: 'Ivy', appearance: {} }], Wallet: [{ id: 'w', coins: 10 }] };
		const slot = await createSlot({ playerId: 'ivy', name: 'Ivy', appearance: {} });
		await persist(slot);
		const env = JSON.parse((await exportSlot(slot.slotId))!);

		// flip a chunk of the ciphertext — decrypts to garbage, so import is refused
		const tampered = { ...env, enc: 'Zm9vYmFy' + env.enc.slice(8) };
		await expect(importSave(JSON.stringify(tampered))).rejects.toThrow('invalid-save');

		// forging a new sig also fails (the secret isn't just "trust the file")
		await expect(importSave(JSON.stringify({ ...env, sig: 'deadbeefdeadbeefdeadbeefdeadbeef' }))).rejects.toThrow(
			'invalid-save',
		);

		// the untouched original still imports cleanly
		await expect(importSave(JSON.stringify(env))).resolves.toMatchObject({ playerId: 'ivy' });
	});

	it('never overwrites an existing save when importing the same file twice', async () => {
		h.data = { Player: [{ id: 'sam', name: 'Sam', appearance: {} }] };
		const slot = await createSlot({ playerId: 'sam', name: 'Sam', appearance: {} });
		const dump = (await exportSlot(slot.slotId))!;
		await importSave(dump);
		await importSave(dump);
		// original + two imports = three independent slots
		expect(await listSaves()).toHaveLength(3);
	});
});
