import { describe, it, expect, beforeEach, vi } from 'vitest';

// A localStorage shim (unit env has none) so the solo save IO can round-trip.
const store = new Map<string, string>();
(globalThis as any).localStorage = {
	getItem: (k: string) => store.get(k) ?? null,
	setItem: (k: string, v: string) => { store.set(k, v); },
	removeItem: (k: string) => { store.delete(k); },
	key: (i: number) => [...store.keys()][i] ?? null,
	get length() { return store.size; },
};

// Control what the "active save" serializes to, so we can simulate an in-game restyle.
const h = vi.hoisted(() => ({ data: { Player: [] as any[] } as Record<string, any[]> }));
vi.mock('../../src/solo/backend', () => ({ serializeActiveSave: () => h.data }));

import { createSlot, persist, listSaves } from '../../src/solo/saves';

describe('solo save meta stays in sync with the live player', () => {
	beforeEach(() => { store.clear(); });

	it('persist refreshes appearance + name from the saved player row (restyle bug)', async () => {
		h.data = { Player: [{ id: 'ivy', name: 'Ivy', appearance: { hat: 'straw', hair: '#6e4a33' } }] };
		const slot = await createSlot({ playerId: 'ivy', name: 'Ivy', appearance: { hat: 'straw', hair: '#6e4a33' } });
		expect((await listSaves())[0].appearance.hat).toBe('straw');

		// player restyles in-game, then the world autosaves
		h.data = { Player: [{ id: 'ivy', name: 'Ivy Bloom', appearance: { hat: 'crown', hair: '#ffffff' } }] };
		await persist(slot);

		const m = (await listSaves()).find((x) => x.slotId === slot.slotId)!;
		expect(m.appearance.hat).toBe('crown');   // load screen now shows the new look
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
