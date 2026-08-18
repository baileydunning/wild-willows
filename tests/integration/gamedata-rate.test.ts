import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { freshWorld, type World } from './harness';

// GET /GameData/ is public, unauthenticated, documented, and half a megabyte.
// Until now it was also the only endpoint in the file with no rate limit at all:
// rate limiting is charged in bodyOf (every POST) and explicitly at the two GETs
// that touch the database, and this one is neither.
//
// Two things have to be true, and the second is the one that is easy to get
// wrong. It has to be bounded — and when it bounds someone, the answer has to
// reach a cross-origin caller as a 429. A 429 without the CORS header does not
// arrive in a browser's catch block as a 429; it arrives as an opaque network
// failure with no status and no message, which is indistinguishable from the
// student's own code being broken.

let w: World;
beforeEach(async () => {
	w = await freshWorld();
});

const hdrs = (ip: string) => ({ 'cf-connecting-ip': ip, 'accept-encoding': '' });

describe('the catalog is rate limited', () => {
	it('answers normally well inside the budget', async () => {
		const res = await w.fetch<any>('GameData', hdrs('203.0.113.10'));
		expect(res.status ?? 200).toBe(200);
		expect(res.headers['access-control-allow-origin']).toBe('*');
	});

	it('starts refusing a caller that will not stop', async () => {
		let refused: any = null;
		// The burst is 300; a few hundred past it is enough to prove the ceiling
		// exists without depending on its exact value.
		for (let i = 0; i < 2000 && !refused; i++) {
			const res = await w.fetch<any>('GameData', hdrs('203.0.113.20'));
			if ((res.status ?? 200) === 429) refused = res;
		}
		expect(refused, 'GameData never refused a caller in 2000 requests').toBeTruthy();
	});

	it('and the refusal is readable by the browsers that will hit it', async () => {
		let refused: any = null;
		for (let i = 0; i < 2000 && !refused; i++) {
			const res = await w.fetch<any>('GameData', hdrs('203.0.113.30'));
			if ((res.status ?? 200) === 429) refused = res;
		}
		expect(refused).toBeTruthy();
		// THE POINT OF THE WHOLE TEST. Without this the student sees a CORS error.
		expect(refused.headers['access-control-allow-origin']).toBe('*');
		expect(refused.headers['retry-after']).toBe('60');
		expect(refused.headers['cache-control']).toBe('no-store');
		expect(String(refused.body)).toMatch(/fetch it once/i);
		// It points at the page that explains the limit rather than just saying no.
		expect(String(refused.body)).toContain('/developers/api');
	});

	it('is generous enough for a class behind one address', async () => {
		// Thirty students, each re-fetching as they type. If this fails, a whole
		// classroom starts seeing errors halfway through the period and every one
		// of them reads it as their own code being wrong.
		let ok = 0;
		for (let i = 0; i < 300; i++) {
			const res = await w.fetch<any>('GameData', hdrs('198.51.100.7'));
			if ((res.status ?? 200) === 200) ok++;
		}
		expect(ok).toBe(300);
	});

	it('does not limit one caller because of another', async () => {
		for (let i = 0; i < 400; i++) await w.fetch<any>('GameData', hdrs('203.0.113.40'));
		const other = await w.fetch<any>('GameData', hdrs('203.0.113.41'));
		expect(other.status ?? 200).toBe(200);
	});

	it('never limits the in-app caller, which has no request context', async () => {
		// No context is the server's signal for the solo backend, and it must keep
		// getting the plain object — not an envelope, and never a 429. Built
		// directly rather than through w.fetch, which always attaches a context.
		const mod: any = await import('../../resources.js');
		for (let i = 0; i < 400; i++) {
			const obj = await new mod.GameData().get();
			expect(Array.isArray(obj.animals)).toBe(true);
		}
	});

	it('NEVER refuses a client that revalidates — this is the guarantee', async () => {
		// The one caller that must never break is the game, so the limiter is
		// charged AFTER the If-None-Match check rather than before it. Any client
		// that keeps its ETag is therefore unrefusable, however often it asks.
		const first = await w.fetch<any>('GameData', hdrs('203.0.113.50'));
		const etag = first.headers.etag;
		expect(etag).toBeTruthy();
		let refused = 0;
		let notModified = 0;
		for (let i = 0; i < 3000; i++) {
			const res = await w.fetch<any>('GameData', { ...hdrs('203.0.113.50'), 'if-none-match': etag });
			if ((res.status ?? 200) === 429) refused++;
			if (res.status === 304) notModified++;
		}
		expect(refused, 'a revalidating client was refused').toBe(0);
		expect(notModified).toBe(3000);
	});

	it('and a revalidation does not eat the budget of a real request either', async () => {
		const first = await w.fetch<any>('GameData', hdrs('203.0.113.60'));
		for (let i = 0; i < 3000; i++) await w.fetch<any>('GameData', { ...hdrs('203.0.113.60'), 'if-none-match': first.headers.etag });
		// 3000 revalidations later, the full-body budget is untouched.
		const full = await w.fetch<any>('GameData', hdrs('203.0.113.60'));
		expect(full.status ?? 200).toBe(200);
	});

	it('the desktop game does not make this call at all', async () => {
		// The strongest guarantee is the one that does not depend on a limit being
		// generous enough. src/api.ts serves /GameData/ from the bundle on desktop,
		// which is also what makes the title screen work offline — so every shipped
		// desktop, Steam and Mac App Store build is outside this endpoint entirely.
		const api = readFileSync(resolve(__dirname, '../../src/api.ts'), 'utf8');
		expect(api).toMatch(/isDesktop && \(soloSlot != null \|\| path\.startsWith\('\/GameData'\)\)/);
	});

	it('and the browser demo calls it once per session, with no retry', async () => {
		const state = readFileSync(resolve(__dirname, '../../src/state.tsx'), 'utf8');
		expect([...state.matchAll(/api\.gameData\(\)/g)]).toHaveLength(1);
		// In a mount effect with an empty dependency list: once, not per render.
		expect(state).toMatch(/const d = await api\.gameData\(\);/);
	});

	it('and the Worker forwards the address, so demo players are not one caller', async () => {
		// Without this every request through the Worker shares a single bucket, and
		// a limit sized for one player would be a limit for all of them at once.
		const worker = readFileSync(resolve(__dirname, '../../workers/play.js'), 'utf8');
		expect(worker).toMatch(/if \(clientIp\) headers\.set\('cf-connecting-ip', clientIp\);/);
		expect(worker).toMatch(/'if-none-match'/);
	});

	it('declares the tier it is charged against', async () => {
		const mod: any = await import('../../resources.js');
		expect(mod.GameData.rateTier).toBe('catalog');
	});
});
