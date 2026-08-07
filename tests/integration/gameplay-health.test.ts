import { describe, it, expect, beforeEach } from 'vitest';
import { makeWorld, appearance, type Db } from './harness';

// The dashboard counted what players did, never what failed. A recipe gated on
// the wrong biome could turn away everyone who found it and every activity
// counter still looked healthy, because a refusal isn't an activity — and a crash
// in the interface produced no events at all.
//
// These walk the two new chains end to end: a refusal raised anywhere in the
// server reaches /GameplayHealth/, and a crash the client reports does too.

const holder: { db: Db } = { db: makeWorld() };
let endpoints: Record<string, any> | null = null;
async function loadTsServer(): Promise<Record<string, any>> {
	if (endpoints) return endpoints;
	const g = globalThis as any;
	g.Resource = class {
		_id: any;
		constructor(id?: any) {
			this._id = id;
		}
		getId() {
			return this._id;
		}
	};
	g.databases = {
		get wildwillows() {
			return holder.db;
		},
	};
	endpoints = (await import('../../server/resources')) as Record<string, any>;
	return endpoints;
}

let mod: Record<string, any>;
const post = (cls: string, body: any) => new (mod as any)[cls]().post(body);
const get = (cls: string) => new (mod as any)[cls]().get();

let pid: string;

beforeEach(async () => {
	mod = await loadTsServer();
	holder.db = makeWorld();
	pid = (await post('CreatePlayer', { name: 'Unlucky', passcode: '1234', appearance })).playerId;
});

describe('refusals', () => {
	it('records the reason a player was turned away', async () => {
		// No stones, so the craft is refused. This is the shape of the bug the panel
		// exists to catch: the player is stuck and nothing else on the dashboard moves.
		await expect(post('CraftItem', { playerId: pid, recipeId: 'simple-path' })).rejects.toThrow();

		const health = await get('GameplayHealth');
		expect(health.refusals.total).toBeGreaterThan(0);
		const codes = health.refusals.top.map((r: any) => r.code);
		expect(codes.some((c: string) => c.startsWith('server.err.'))).toBe(true);
	});

	it('counts by message key, so one problem does not split across languages', async () => {
		// The same refusal three times is one row with a count of three — not three
		// rows, and not one row per locale the message happened to be rendered in.
		for (let i = 0; i < 3; i++) {
			await expect(post('CraftItem', { playerId: pid, recipeId: 'simple-path' })).rejects.toThrow();
		}
		const health = await get('GameplayHealth');
		const rows = health.refusals.top.filter((r: any) => r.code === 'server.err.notEnough');
		expect(rows).toHaveLength(1);
		expect(rows[0].count).toBe(3);
		expect(health.refusals.distinct).toBeLessThan(health.refusals.total);
	});

	it('separates the game saying no from the game falling over', async () => {
		// A 4xx is a rule working. Only 5xx means something is actually broken, and
		// conflating them would bury the signal under normal play.
		await expect(post('CraftItem', { playerId: pid, recipeId: 'simple-path' })).rejects.toThrow();
		const health = await get('GameplayHealth');
		expect(health.refusals.total).toBeGreaterThan(0);
		expect(health.refusals.serverFaults).toBe(0);
	});
});

describe('interface crashes', () => {
	it('records one row per distinct crash, counted', async () => {
		const crash = { message: "Cannot read properties of undefined (reading 'x')", where: 'app Journal' };
		await post('ReportClientError', crash);
		await post('ReportClientError', crash);
		await post('ReportClientError', { message: 'different boom', where: 'app Toolbelt' });

		const health = await get('GameplayHealth');
		expect(health.clientErrors.distinct).toBe(2);
		expect(health.clientErrors.total).toBe(3);
		expect(health.clientErrors.top[0].count).toBe(2);
	});

	it('keeps only the top of the stack, so a save cannot ride along in a report', async () => {
		// A crash report must never become a way to ship save contents off a device.
		await post('ReportClientError', {
			message: 'boom',
			where: 'app',
			stack: Array.from({ length: 40 }, (_, i) => `frame ${i} secret-save-data`).join('\n'),
		});
		const health = await get('GameplayHealth');
		const stack = health.clientErrors.top[0].stack || '';
		expect(stack.length).toBeLessThanOrEqual(400);
		expect(stack).not.toContain('frame 39');
	});

	it('ignores an empty report rather than storing a blank row', async () => {
		await post('ReportClientError', { message: '   ' });
		const health = await get('GameplayHealth');
		expect(health.clientErrors.total).toBe(0);
	});
});
