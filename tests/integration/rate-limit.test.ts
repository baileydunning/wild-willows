import { describe, it, expect, beforeEach } from 'vitest';
import { freshWorld, appearance, type World } from './harness';

// Rate limiting did not exist at any layer before this. These pin the two
// properties that matter in opposite directions: it has to bite an abusive
// caller, and it must never bite anyone else — a limiter that 429s real players
// is worse than none at all.
//
// `post()` deliberately carries NO request context, which the server reads as
// "the in-app solo backend is calling" and exempts. `postWith()` supplies one,
// so only these tests exercise the HTTP path.

let w: World;
beforeEach(async () => {
	w = await freshWorld();
});

const ip = (addr: string) => ({ 'cf-connecting-ip': addr });

/**
 * How many calls get THROUGH the limiter before one is refused.
 *
 * A login for a name that does not exist fails with a 404, and that is a served
 * request as far as this is concerned — the point is when the limiter starts
 * turning requests away, not whether the request would have succeeded.
 */
async function until429(fn: (i: number) => Promise<any>, max: number): Promise<number> {
	for (let i = 0; i < max; i++) {
		try {
			await fn(i);
		} catch (e: any) {
			if (e?.statusCode === 429) return i;
		}
	}
	return max;
}

describe('rate limiting leaves ordinary play alone', () => {
	it('never limits the in-app solo backend, however much it does', async () => {
		// Solo is one player driving their own process. Every other integration test
		// in this suite also depends on this staying true.
		const pid = (await w.post('CreatePlayer', { name: 'Solo', passcode: '1234', appearance })).playerId;
		for (let i = 0; i < 400; i++) await w.post('Heartbeat', { playerId: pid });
		const s = await w.get('GameState', pid);
		expect(s.player.id).toBe(pid);
	});

	it('lets a real player burst through gameplay actions', async () => {
		const pid = (await w.post('CreatePlayer', { name: 'Busy', passcode: '1234', appearance })).playerId;
		// Far more than a person can physically do in a couple of minutes.
		const served = await until429(() => w.postWith('Heartbeat', { playerId: pid }, ip('1.2.3.4')), 120);
		expect(served).toBe(120);
	});
});

describe('rate limiting bites an abusive caller', () => {
	it('cuts off repeated logins from one address', async () => {
		// The auth tier is the tight one: every call here runs scrypt, which is
		// synchronous and blocks the whole node.
		const served = await until429(
			() => w.postWith('LoginPlayer', { name: 'nobody', passcode: 'wrong' }, ip('9.9.9.9')),
			60,
		);
		expect(served).toBeGreaterThan(0); // a first attempt always gets through
		expect(served).toBeLessThan(30); // but it does not keep going
	});

	it('does not punish a second address for the first one', async () => {
		await until429(() => w.postWith('LoginPlayer', { name: 'nobody', passcode: 'wrong' }, ip('6.6.6.6')), 60);
		// Someone else, arriving mid-flood, still gets served.
		// A 404 means it reached the handler; a 429 would mean it was turned away
		// for someone else's behaviour.
		await expect(w.postWith('LoginPlayer', { name: 'nobody', passcode: 'wrong' }, ip('7.7.7.7'))).rejects.toMatchObject(
			{ statusCode: 404 },
		);
	});

	it('still caps a caller who rotates addresses', async () => {
		// Per-caller identity is a header, and Harper is reachable without the
		// Worker in front of it, so an attacker can forge a fresh address per
		// request. The service-wide ceiling is what they cannot get around.
		const served = await until429(
			(i) => w.postWith('LoginPlayer', { name: 'nobody', passcode: 'wrong' }, ip(`10.0.${(i >> 8) & 255}.${i & 255}`)),
			4000,
		);
		expect(served).toBeLessThan(4000);
	});
});

describe('body size', () => {
	it('refuses a body far larger than any the game sends', async () => {
		const pid = (await w.post('CreatePlayer', { name: 'Big', passcode: '1234', appearance })).playerId;
		await expect(
			w.post('SubmitFeedback', { message: 'hi', metrics: { blob: 'x'.repeat(200_000) }, playerId: pid }),
		).rejects.toMatchObject({ statusCode: 413 });
	});

	it('accepts the largest body the game actually sends', async () => {
		// AppendFeed is the big one: FEED_CAP lines at the per-line cap.
		const pid = (await w.post('CreatePlayer', { name: 'Feed', passcode: '1234', appearance })).playerId;
		const entries = Array.from({ length: 100 }, (_, i) => ({
			at: Date.now() + i,
			icon: 'leaf',
			text: 'x'.repeat(500),
		}));
		await expect(w.post('AppendFeed', { playerId: pid, entries })).resolves.toBeTruthy();
	});
});

describe('feedback metrics are bounded but keep their shape', () => {
	it('stores a normal report unchanged, with numbers still numbers', async () => {
		await w.post('SubmitFeedback', {
			message: 'chests eat items',
			metrics: { version: '0.3.8', platform: 'desktop', playMinutes: 42, sessions: 4 },
		});
		const { feedback } = await w.as({ role: { super_user: true } }).get('ListFeedback');
		const m = feedback[0].metrics;
		expect(m.playMinutes).toBe(42);
		expect(m.version).toBe('0.3.8');
	});

	it('drops nested structures and caps the rest', async () => {
		const metrics: Record<string, any> = { nested: { a: { b: 1 } }, arr: [1, 2, 3], long: 'y'.repeat(5000) };
		for (let i = 0; i < 200; i++) metrics['k' + i] = i;
		await w.post('SubmitFeedback', { message: 'lots', metrics });
		const { feedback } = await w.as({ role: { super_user: true } }).get('ListFeedback');
		const m = feedback[0].metrics;
		expect(m.nested).toBeUndefined();
		expect(m.arr).toBeUndefined();
		expect(String(m.long).length).toBeLessThanOrEqual(500);
		expect(Object.keys(m).length).toBeLessThanOrEqual(40);
	});
});
