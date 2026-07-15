import { describe, it, expect, beforeEach } from 'vitest';
import { freshWorld, appearance, meadowResource, type World } from './harness';

// Co-op multiplayer logic against the real server bundle: shared worlds, the
// host-approval join flow, shared-node cooldowns, per-player inventories,
// realtime presence, and the 6-caretaker cap. (Ported from scripts/coop-harness.mjs.)

let w: World;
const RES = meadowResource();

beforeEach(async () => {
	w = await freshWorld();
});

async function hostWithWorld(name = 'Host Hana') {
	const host = await w.post('CreatePlayer', { name, passcode: 'pwpw', appearance });
	const cw = await w.post('CreateWorld', { playerId: host.playerId, name: 'Willowdale' });
	await w.post('SwitchWorld', { playerId: host.playerId, worldId: cw.world.worldId });
	return { hostId: host.playerId, worldId: cw.world.worldId, code: cw.world.joinCode as string };
}

async function approvedJoin(code: string, worldId: string, hostId: string, name: string) {
	const friend = await w.post('CreatePlayer', { name, passcode: 'pwpw', appearance });
	const token = `tok_${name.replace(/\s+/g, '_')}`;
	await w.post('RequestJoin', { joinCode: code, token, name });
	await w.post('ResolveJoin', { playerId: hostId, worldId, token, approve: true });
	const jn = await w.post('JoinWorld', { playerId: friend.playerId, joinCode: code, token });
	return { friendId: friend.playerId, token, jn };
}

describe('world hosting + join codes', () => {
	it('creates a co-op world with a 6-char join code', async () => {
		const { code } = await hostWithWorld();
		expect(code).toHaveLength(6);
	});

	it('CheckWorldCode finds a real world and rejects a bogus one', async () => {
		const { code } = await hostWithWorld();
		expect((await w.post('CheckWorldCode', { joinCode: code })).exists).toBe(true);
		expect((await w.post('CheckWorldCode', { joinCode: 'ZZZZZZ' })).exists).toBe(false);
	});
});

describe('host-approval join flow', () => {
	it('blocks joining until the host approves, then lets the friend in', async () => {
		const { hostId, worldId, code } = await hostWithWorld();
		const friend = await w.post('CreatePlayer', { name: 'Fin', passcode: 'pwpw', appearance });
		const token = 'tok_fin';
		await w.post('RequestJoin', { joinCode: code, token, name: 'Fin' });

		await expect(w.post('JoinWorld', { playerId: friend.playerId, joinCode: code, token })).rejects.toThrow(/approve/i);

		const pend = await w.post('PendingJoinRequests', { playerId: hostId });
		expect(pend.requests.some((r: any) => r.token === token)).toBe(true);

		await w.post('ResolveJoin', { playerId: hostId, worldId, token, approve: true });
		const jn = await w.post('JoinWorld', { playerId: friend.playerId, joinCode: code, token });
		expect(jn.ok).toBe(true);
		expect(jn.worldId).toBe(worldId);
	});

	it('re-login resumes the co-op world, not a solo one', async () => {
		const { hostId, worldId, code } = await hostWithWorld();
		await approvedJoin(code, worldId, hostId, 'Fin');
		const back = await w.post('LoginPlayer', { name: 'Fin', passcode: 'pwpw' });
		expect(back.worldId).toBe(worldId);
	});
});

describe('shared world semantics', () => {
	it('shares node cooldowns but keeps inventories per-player', async () => {
		const { hostId, worldId, code } = await hostWithWorld();
		const { friendId } = await approvedJoin(code, worldId, hostId, 'Fin');

		const node = 'shared-node-x';
		await w.post('CollectResource', { playerId: hostId, biomeId: 'meadow', nodeId: node, resourceId: RES });
		// Same physical node — the friend can't instantly re-harvest it.
		await expect(
			w.post('CollectResource', { playerId: friendId, biomeId: 'meadow', nodeId: node, resourceId: RES }),
		).rejects.toThrow(/regrow/i);

		// Host gathered from another node too; inventories are independent.
		await w.post('CollectResource', { playerId: hostId, biomeId: 'meadow', nodeId: 'h-only', resourceId: RES });
		const host = await w.post('LoginPlayer', { name: 'Host Hana', passcode: 'pwpw' });
		const friend = await w.post('LoginPlayer', { name: 'Fin', passcode: 'pwpw' });
		expect(host.state.player.inventory[RES] || 0).toBeGreaterThan(friend.state.player.inventory[RES] || 0);
	});

	it('merges player positions into a shared presence map', async () => {
		const { hostId, worldId, code } = await hostWithWorld();
		const { friendId } = await approvedJoin(code, worldId, hostId, 'Fin');
		await w.post('Presence', { playerId: hostId, x: 5, y: 6, area: 'meadow' });
		const fp = await w.post('Presence', { playerId: friendId, x: 12, y: 9, area: 'meadow' });
		expect(fp.peers.some((p: any) => p.playerId === hostId && p.x === 5 && p.y === 6)).toBe(true);
		const wp = await w.db.WorldPresence.get(worldId);
		expect(wp.players[hostId] && wp.players[friendId]).toBeTruthy();
	});

	it('solo presence has no peers', async () => {
		const solo = await w.post('CreatePlayer', { name: 'Lone', passcode: 'pwpw', appearance });
		const p = await w.post('Presence', { playerId: solo.playerId, x: 1, y: 1, area: 'meadow' });
		expect(p.peers).toHaveLength(0);
	});
});

describe('roster + 6-caretaker cap', () => {
	it('fills to 6, closes the world, blocks a 7th, but lets members re-enter', async () => {
		const { hostId, worldId, code } = await hostWithWorld();
		const first = await approvedJoin(code, worldId, hostId, 'Fin'); // members: host + Fin = 2
		for (let i = 0; i < 4; i++) await approvedJoin(code, worldId, hostId, `Filler ${i}`); // → 6

		const roster = await w.post('WorldRoster', { playerId: hostId });
		expect(roster.roster).toHaveLength(6);
		expect(roster.closed).toBe(true);

		expect((await w.post('CheckWorldCode', { joinCode: code })).world.full).toBe(true);
		await expect(w.post('RequestJoin', { joinCode: code, token: 'tok_7', name: 'Too Late' })).rejects.toThrow(
			/full|closed/i,
		);

		// An existing member can still re-enter the closed world.
		const reenter = await w.post('JoinWorld', { playerId: first.friendId, joinCode: code, token: 'whatever' });
		expect(reenter.worldId).toBe(worldId);
	});
});
