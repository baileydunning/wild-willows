import { describe, it, expect, beforeEach } from 'vitest';
import { freshWorld, appearance, type World } from './harness';

// GET /GameState/ is the largest response the game sends after GameData, it is
// fetched every few actions by the browser build, and — unlike GameData — it has
// no fixed size: it is the whole world, and it grows with it. Harper's REST path
// does not compress resource responses, so a well-restored save was shipping a
// third of a megabyte of uncompressed JSON, ten times a minute, to a player who
// might be on the other side of an ocean.
//
// It is now compressed and revalidatable, on the SAME contract GameData uses:
// with no request context the endpoint still returns the plain object, because
// that path is the in-app solo backend (which has no zlib) and this harness.
//
// The ETag is a hash of the body itself rather than a revision counter, so these
// tests pin the property that makes that safe: the tag must change whenever
// anything the player can observe changes, and a 304 must never be answered for
// a world that has moved on. A revision counter can be forgotten on a new write
// path; a body hash cannot.

const gunzipish = async (body: any, enc: string) => {
	const { brotliDecompressSync, gunzipSync } = await import('node:zlib');
	const buf = Buffer.from(body);
	return JSON.parse((enc === 'br' ? brotliDecompressSync(buf) : gunzipSync(buf)).toString('utf8'));
};

let w: World;
let playerId: string;
beforeEach(async () => {
	w = await freshWorld();
	const created = await w.post<any>('CreatePlayer', { name: 'Ada', passcode: 'pw1234', appearance });
	playerId = created.playerId;
});

const BR = { 'accept-encoding': 'br, gzip' };

describe('GET /GameState/ — transport', () => {
	it('returns the plain state object when there is no request context', async () => {
		// The solo backend and the desktop app take this path, and they use the
		// return value AS the data. An envelope here would break both.
		const state = await w.get<any>('GameState', playerId);
		expect(state.player?.name).toBe('Ada');
		expect(state).not.toHaveProperty('status');
		expect(state).not.toHaveProperty('body');
	});

	it('brotli-compresses the body for a client that accepts it, and round-trips', async () => {
		const res = await w.fetch<any>('GameState', BR, playerId);
		expect(res.status).toBe(200);
		expect(res.headers['content-encoding']).toBe('br');
		expect(res.headers['content-type']).toMatch(/application\/json/);
		const decoded = await gunzipish(res.body, 'br');
		// The compressed body must be the same state the plain path returns.
		const plain = await w.get<any>('GameState', playerId);
		expect(decoded.player.name).toBe(plain.player.name);
		expect(decoded.worldId).toBe(plain.worldId);
		expect(decoded.placements.length).toBe(plain.placements.length);
		// …including the field that is spliced back on after the hash is taken.
		expect(typeof decoded.serverTime).toBe('number');
	});

	it('falls back to gzip, then to identity, per Accept-Encoding', async () => {
		const gz = await w.fetch<any>('GameState', { 'accept-encoding': 'gzip' }, playerId);
		expect(gz.headers['content-encoding']).toBe('gzip');
		expect((await gunzipish(gz.body, 'gzip')).player.name).toBe('Ada');

		const plain = await w.fetch<any>('GameState', {}, playerId);
		expect(plain.headers['content-encoding']).toBeUndefined();
		expect(JSON.parse(String(plain.body)).player.name).toBe('Ada');
	});

	it('is smaller compressed than raw', async () => {
		const raw = await w.fetch<any>('GameState', {}, playerId);
		const br = await w.fetch<any>('GameState', BR, playerId);
		expect(br.body.length).toBeLessThan(Buffer.byteLength(String(raw.body), 'utf8'));
	});

	it('answers If-None-Match with an empty 304 when nothing has changed', async () => {
		const first = await w.fetch<any>('GameState', BR, playerId);
		expect(first.headers.etag).toMatch(/^W\/"gs-/);

		const second = await w.fetch<any>('GameState', { ...BR, 'if-none-match': first.headers.etag }, playerId);
		expect(second.status).toBe(304);
		// Explicitly empty: Harper serializes the returned object into the body when
		// `body` is absent, which would put `{"status":304,…}` inside a 304.
		expect(second.body.length).toBe(0);
		expect(second.headers.etag).toBe(first.headers.etag);
	});

	it('matches a strong-form If-None-Match too (proxies rewrite the W/ prefix)', async () => {
		const first = await w.fetch<any>('GameState', BR, playerId);
		const strong = String(first.headers.etag).replace(/^W\//, '');
		const second = await w.fetch<any>('GameState', { ...BR, 'if-none-match': strong }, playerId);
		expect(second.status).toBe(304);
	});

	it('does NOT 304 once the world has actually changed', async () => {
		const first = await w.fetch<any>('GameState', BR, playerId);
		await w.post('Terraform', { playerId, area: 'meadow', x: 4, y: 4, action: 'dig' });

		const second = await w.fetch<any>('GameState', { ...BR, 'if-none-match': first.headers.etag }, playerId);
		expect(second.status).toBe(200);
		expect(second.headers.etag).not.toBe(first.headers.etag);
		// and the body really does carry the new tile
		const decoded = await gunzipish(second.body, 'br');
		expect(decoded.terrain.length).toBeGreaterThan(0);
	});

	it('keeps the same ETag across calls when only serverTime moves', async () => {
		// serverTime changes on every call and no client reads it, so it is excluded
		// from the hash. If it ever leaks back in, this test fails and the ETag stops
		// being able to hit at all — which is the quiet way this feature dies.
		const a = await w.fetch<any>('GameState', BR, playerId);
		await new Promise((r) => setTimeout(r, 5));
		const b = await w.fetch<any>('GameState', BR, playerId);
		expect(b.headers.etag).toBe(a.headers.etag);
		const [da, db] = [await gunzipish(a.body, 'br'), await gunzipish(b.body, 'br')];
		expect(db.serverTime).toBeGreaterThanOrEqual(da.serverTime);
	});

	it('marks the response private, revalidate-always, and varying on encoding', async () => {
		// One player's save, reached through a shared Cloudflare Worker: a `public`
		// copy in any intermediary cache could be served to the next caller.
		const res = await w.fetch<any>('GameState', BR, playerId);
		expect(res.headers['cache-control']).toBe('private, no-cache');
		expect(res.headers.vary).toBe('Accept-Encoding');
	});

	it('gives two different saves different ETags', async () => {
		const other = await w.post<any>('CreatePlayer', { name: 'Bo', passcode: 'pw1234', appearance });
		const a = await w.fetch<any>('GameState', BR, playerId);
		const b = await w.fetch<any>('GameState', BR, other.playerId);
		expect(a.headers.etag).not.toBe(b.headers.etag);
	});
});
