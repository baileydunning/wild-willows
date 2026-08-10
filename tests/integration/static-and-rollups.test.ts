import { describe, it, expect, beforeEach } from 'vitest';
import { freshWorld, type World } from './harness';

/**
 * The response-cost side of the server: the inlined static pages and binaries,
 * and the two analytics rollups.
 *
 * These aren't about game rules — they're about what a request COSTS. Every one
 * of these guards a specific regression that was showing up in the hosted
 * instance's request p95:
 *
 *   • GET / was shipping ~575 KB of uncompressed HTML on every visit, because
 *     Harper's REST path doesn't compress resource responses and only GameData
 *     had been taught to do it itself.
 *   • /theme.mp3 and the classroom PDFs re-ran Buffer.from(…, 'base64') over
 *     megabytes of build-constant data on every single request.
 *   • Both rollups were nulled by the very writes that make them expensive, so
 *     the caches never actually cached anything.
 *   • findCounterRow full-scanned AppOpen on every app-open ping, and AppOpen is
 *     one row per install forever — the scan grew with the install base.
 */

let w: World;

beforeEach(async () => {
	w = await freshWorld();
});

const size = (body: any): number => (typeof body === 'string' ? Buffer.byteLength(body, 'utf8') : body.length);

// URL-path export names, as registered at the bottom of server/resources.ts.
const PAGES: [name: string, label: string][] = [
	['', 'landing'],
	['dashboard', 'dashboard'],
	['privacy', 'privacy'],
	['age-rating', 'age-rating'],
	['support', 'support'],
];

describe('inlined HTML pages', () => {
	it('returns a plain string when there is no request context', async () => {
		// This is the path the in-app solo backend takes; it must never touch zlib,
		// which is a no-op shim in the web build.
		const r = await w.get('');
		expect(typeof r.body).toBe('string');
		expect(r.status).toBe(200);
		expect(r.headers['content-type']).toMatch(/text\/html/);
	});

	it.each(PAGES)('compresses %s when the client accepts brotli', async (page) => {
		const plain = await w.fetch(page);
		const br = await w.fetch(page, { 'accept-encoding': 'gzip, deflate, br' });
		expect(br.headers['content-encoding']).toBe('br');
		expect(size(br.body)).toBeLessThan(size(plain.body));
	});

	it('falls back to gzip, then to identity', async () => {
		const gz = await w.fetch('', { 'accept-encoding': 'gzip, deflate' });
		expect(gz.headers['content-encoding']).toBe('gzip');

		const identity = await w.fetch('', { 'accept-encoding': 'identity' });
		expect(identity.headers['content-encoding']).toBeUndefined();
		expect(typeof identity.body).toBe('string');
	});

	it('advertises Vary so a proxy cannot serve brotli to a client that refuses it', async () => {
		const r = await w.fetch('', { 'accept-encoding': 'br' });
		expect(r.headers.vary).toBe('Accept-Encoding');
	});

	it('revalidates into an empty 304', async () => {
		const first = await w.fetch('', { 'accept-encoding': 'br' });
		expect(first.headers.etag).toBeTruthy();

		const again = await w.fetch('', { 'if-none-match': first.headers.etag });
		expect(again.status).toBe(304);
		expect(again.body).toBeFalsy();

		// A strong/weak prefix mismatch still counts as a match…
		const strong = await w.fetch('', { 'if-none-match': String(first.headers.etag).replace(/^W\//, '') });
		expect(strong.status).toBe(304);

		// …but a stale build stamp does not.
		const stale = await w.fetch('', { 'if-none-match': 'W/"landing-0.0.1+ancient"' });
		expect(stale.status).toBe(200);
		expect(stale.body).toBeTruthy();
	});

	it('gives each page its own etag', async () => {
		const tags = await Promise.all(
			PAGES.map(async ([p]) => (await w.fetch(p, { 'accept-encoding': 'br' })).headers.etag),
		);
		expect(new Set(tags).size).toBe(tags.length);
	});

	it('compresses each page only once', async () => {
		const a = await w.fetch('', { 'accept-encoding': 'br' });
		const b = await w.fetch('', { 'accept-encoding': 'br' });
		// Same buffer instance — not merely equal bytes — proves it was memoized
		// rather than recompressed.
		expect(b.body).toBe(a.body);
	});
});

describe('inlined binaries', () => {
	it('decodes the og image once and reuses the buffer', async () => {
		const a = await w.get('og-image');
		const b = await w.get('og-image');
		expect(a.body).toBe(b.body);
		expect(a.headers['content-type']).toBe('image/jpeg');
	});

	it('decodes the theme audio once and reuses the buffer', async () => {
		const a = await w.get('theme');
		const b = await w.get('theme');
		expect(a.body).toBe(b.body);
		expect(a.headers['content-type']).toBe('audio/mpeg');
	});

	it('decodes each PDF once, and still counts every download', async () => {
		const a = await w.get('educator-guide');
		const b = await w.get('educator-guide');
		expect(a.body).toBe(b.body);
		expect(a.headers['content-type']).toBe('application/pdf');

		// Memoizing the bytes must not memoize the counter with them.
		const stats = await w.get('LandingStats');
		expect(stats.totals.downloads.guide).toBe(2);
	});
});

describe('rollup caches', () => {
	/** Count scans of one table by wrapping its search(). */
	function countScans(table: string) {
		const t = w.db[table] as any;
		const real = t.search.bind(t);
		const counter = { n: 0 };
		t.search = (...args: any[]) => {
			counter.n++;
			return real(...args);
		};
		return counter;
	}

	// Same shape the solo uplink sends — see metrics-uplink.test.ts.
	const snapshot = (over: Record<string, any> = {}) => ({
		playerId: 'sam',
		name: 'Sam',
		playSeconds: 1200,
		playMinutes: 20,
		sessions: 3,
		counts: { resourcesCollected: 40 },
		tutorialStep: 9,
		unlockedBiomes: 2,
		lastSeenAt: Date.now(),
		...over,
	});

	it('scans SoloMetrics once for a burst of concurrent dashboard reads', async () => {
		await w.post('SyncMetrics', { clientId: 'slot-1', name: 'Solo One', snapshot: snapshot({ name: 'Solo One' }) });
		const scans = countScans('SoloMetrics');

		const [a, b, c] = await Promise.all([w.get('Metrics'), w.get('Metrics'), w.get('Metrics')]);
		expect(scans.n).toBe(1);
		expect(a.players).toHaveLength(1);
		expect(b.players).toHaveLength(1);
		expect(c.players).toHaveLength(1);
	});

	it('serves a repeat dashboard read from cache', async () => {
		await w.post('SyncMetrics', { clientId: 'slot-1', name: 'Solo One', snapshot: snapshot({ name: 'Solo One' }) });
		await w.get('Metrics');
		const scans = countScans('SoloMetrics');
		await w.get('Metrics');
		expect(scans.n).toBe(0);
	});

	it('still shows a write on the very next read', async () => {
		await w.post('SyncMetrics', { clientId: 'slot-1', name: 'Solo One', snapshot: snapshot({ name: 'Solo One' }) });
		expect((await w.get('Metrics')).players).toHaveLength(1);

		// The cache is marked stale rather than dropped — but read-your-own-write
		// must survive that, or a player's uplink silently misses the dashboard.
		await w.post('SyncMetrics', { clientId: 'slot-2', name: 'Solo Two', snapshot: snapshot({ name: 'Solo Two' }) });
		const out = await w.get('Metrics');
		expect(out.players.map((p: any) => p.name).sort()).toEqual(['Solo One', 'Solo Two']);
	});

	it('does not scan LandingStat again for a repeat rollup read', async () => {
		await w.post('LandingEvent', { type: 'visit', first: true });
		await w.get('LandingStats');
		const scans = countScans('LandingStat');
		await w.get('LandingStats');
		expect(scans.n).toBe(0);
	});

	it('shows a landing visit on the next rollup read', async () => {
		await w.post('LandingEvent', { type: 'visit', first: true });
		expect((await w.get('LandingStats')).totals.visits).toBe(1);
		await w.post('LandingEvent', { type: 'visit' });
		expect((await w.get('LandingStats')).totals.visits).toBe(2);
	});
});

describe('AppOpen counters', () => {
	it('does not scan the table on a warm ping', async () => {
		await w.post('AppOpen', { deviceId: 'dev-a', phase: 'open' });

		// AppOpen holds one row per install FOREVER, so a scan here grows with the
		// install base. Once the row exists, a keyed read has to be enough.
		const scans = countAppOpenScans();
		await w.post('AppOpen', { deviceId: 'dev-a', phase: 'open' });
		expect(scans.n).toBe(0);

		const row = await w.db.AppOpen.get('dev:dev-a');
		expect(row.opens).toBe(2);
	});

	it('falls back to a scan when a cold instance returns a spurious null', async () => {
		await w.post('AppOpen', { deviceId: 'dev-b', phase: 'open' });
		await w.post('AppOpen', { deviceId: 'dev-b', phase: 'open' });

		// Simulate the cold-start hazard the guard exists for: the row is really
		// there, but the primary-key read answers null. Without the scan fallback
		// the handler reads that as "new device" and resets the count to 1.
		const t = w.db.AppOpen as any;
		const realGet = t.get.bind(t);
		t.get = async () => null;
		await w.post('AppOpen', { deviceId: 'dev-b', phase: 'open' });
		t.get = realGet;

		const row = await w.db.AppOpen.get('dev:dev-b');
		expect(row.opens).toBe(3);
		expect(row.firstOpenAt).toBeGreaterThan(0);
	});

	it('starts a genuinely new device at one', async () => {
		await w.post('AppOpen', { deviceId: 'brand-new', phase: 'open' });
		const row = await w.db.AppOpen.get('dev:brand-new');
		expect(row.opens).toBe(1);
	});

	function countAppOpenScans() {
		const t = w.db.AppOpen as any;
		const real = t.search.bind(t);
		const counter = { n: 0 };
		t.search = (...args: any[]) => {
			counter.n++;
			return real(...args);
		};
		return counter;
	}
});
