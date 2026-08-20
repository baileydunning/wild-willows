// Wild Willows — server: rate-limit
//
// Per-tier token buckets, client address resolution and the request body size
// cap. Every endpoint passes through `rateLimit` and `bodyOf`.
//
// Split out of the single server/resources.ts; see that file for the whole map.

import { t as tr } from '../src/i18n/server';

import { GameError } from './core';

// ------------------------------------------------------------- rate limiting
//
// There was none, at any layer, and the endpoints that most needed it are the
// ones anyone can reach: LoginPlayer runs scrypt, CreatePlayer writes nine rows,
// the telemetry endpoints mint permanent rows from client-supplied keys. Caps on
// individual operations bound what ONE request costs; nothing bounded how many
// requests one caller could make.
//
// This is the ORIGIN limiter, and it is the one that matters. The Cloudflare
// Worker in workers/play.js has its own (see there), but Harper's own hostname
// is reachable directly, so an edge-only limit is something an attacker simply
// routes around. Anything enforced here holds regardless of how the request
// arrived.
//
// NOT APPLIED TO THE IN-APP SOLO BACKEND. `getContext()` returning nothing is
// this file's established signal for "no HTTP request — the renderer is calling
// the game logic directly" (see GameData, which uses it to decide whether to
// build an HTTP envelope at all). Solo play is one player driving their own
// process; rate limiting it would be nonsense, and reusing the existing signal
// means there is no second way of detecting solo that could drift from the first.

interface TokenBucket {
	tokens: number;
	at: number;
}

/**
 * Per-tier budgets, in requests per minute, with a burst allowance.
 *
 * Sized against what the GAME does, not against what feels tidy. A busy player
 * lands maybe 60 actions a minute and heartbeats twice; 600 leaves an order of
 * magnitude of headroom so nobody legitimate ever sees a 429. The strict tiers
 * are the ones where a single request is expensive or writes a permanent row.
 */
const RATE_TIERS = {
	/** scrypt on every call — the most expensive thing an anonymous caller can trigger. */
	auth: { perMinute: 10, burst: 5 },
	/** Writes a permanent row from an anonymous caller. */
	report: { perMinute: 20, burst: 10 },
	/** Client telemetry: AppOpen fires per launch, SyncMetrics every ~3 minutes. */
	telemetry: { perMinute: 60, burst: 30 },
	/** Developer tools. Already gated to one save; this bounds the rest. */
	dev: { perMinute: 60, burst: 30 },
	/** Ordinary gameplay writes. Deliberately generous — see above. */
	action: { perMinute: 600, burst: 120 },
	/** Reads that touch the database. */
	read: { perMinute: 300, burst: 100 },
	/**
	 * GET /GameData — the public catalog. Its own tier, and the numbers come from
	 * what the ORIGIN sees, which is not what a classroom sends.
	 *
	 * THE CACHE MOVED THE GOALPOSTS, so this number moved with it. The old value
	 * (600/min) was the classroom arithmetic: the editor runs student code in a
	 * sandbox="allow-scripts" frame on an opaque origin, so it shares no HTTP
	 * cache and never sends If-None-Match — measured, thirty edits produced thirty
	 * full responses and zero 304s — and thirty students at twenty runs a minute
	 * is 600 from one NAT. That was the right number while every one of those
	 * requests reached this process.
	 *
	 * They no longer do. With the Cloudflare rule on /GameData* the edge answers
	 * the repeats and the origin sees roughly one request per edge location per
	 * day, plus a burst when the cache is cold or has just been purged. So the
	 * question this tier answers changed from "how much does a classroom send" to
	 * "how much can miss the cache", and those are two very different numbers:
	 *
	 *   legitimate, worst case   ~30 in a second or two (cold edge, class presses
	 *                            Run together), then nothing for the rest of the day
	 *   abusive, worst case      /GameData?x=<random> busts the cache on every
	 *                            request, so the whole budget lands here
	 *
	 * At 600/min the second one was ~72 MB a minute — 4.3 GB an hour — from a
	 * single address, entirely inside the published limit. At 60/min it is a
	 * tenth of that, and a cold classroom still clears in one burst with room for
	 * a second wave thirty seconds later.
	 *
	 * BURST EQUALS THE MINUTE ON PURPOSE. Everything honest here is a spike: a
	 * cold cache, a purge, a class starting together. Nothing honest is a grind.
	 * A bucket that holds a full minute and refills at one a second allows the
	 * spike and refuses the sustained pull, which is the shape of the traffic
	 * rather than a compromise between two shapes.
	 */
	catalog: { perMinute: 60, burst: 60 },
} as const;

type RateTier = keyof typeof RATE_TIERS;

/**
 * How much slack the shared fallback bucket gets when a caller cannot be
 * identified. It has to hold every such request at once, so it is sized as a
 * whole-service ceiling rather than a per-caller one: high enough that real
 * aggregate traffic never reaches it, low enough to still cap a flood.
 */
const RATE_UNKEYED_MULTIPLIER = 50;

/**
 * How much of a tier's per-caller budget the whole service may spend at once.
 *
 * This is the backstop against forged client addresses — see the note in
 * rateLimit. Deliberately loose: at 200x the auth tier it is 2,000 logins a
 * minute across every player, which no real population reaches and which still
 * bounds a scripted flood to something the node survives.
 */
const RATE_GLOBAL_MULTIPLIER = 200;

/** Buckets are cheap, but there is one per (tier, caller) and callers are
 *  attacker-supplied — so the map itself needs a ceiling and a sweep. */
const RATE_BUCKET_MAX = 20_000;
const rateBuckets = new Map<string, TokenBucket>();

{
	// Drop buckets that have been idle long enough to have refilled completely;
	// forgetting one of those is free, because a full bucket and no bucket behave
	// identically. Unref'd so it never holds the process open.
	const sweep: any = setInterval(() => {
		const cutoff = Date.now() - 5 * 60_000;
		for (const [k, b] of rateBuckets) if (b.at < cutoff) rateBuckets.delete(k);
	}, 60_000);
	if (typeof sweep?.unref === 'function') sweep.unref();
}

/**
 * The caller's address, from whichever header the hop in front of us set.
 *
 * `cf-connecting-ip` is the one that is present in production (the Worker proxies
 * through Cloudflare, which sets it on the subrequest) and the one an outside
 * caller cannot forge, because Cloudflare overwrites it. The others are fallbacks
 * for a different deployment shape; `x-forwarded-for` is a list, and only its
 * FIRST entry is the original client.
 */
function clientAddress(headers: any): string | null {
	if (!headers || typeof headers.get !== 'function') return null;
	for (const name of ['cf-connecting-ip', 'true-client-ip', 'x-real-ip']) {
		const v = headers.get(name);
		if (v) return String(v).trim().slice(0, 64);
	}
	const fwd = headers.get('x-forwarded-for');
	if (fwd) {
		const first = String(fwd).split(',')[0]?.trim();
		if (first) return first.slice(0, 64);
	}
	return null;
}

/** Warn once, not per request, if no header ever identifies a caller. */
let warnedNoClientAddress = false;

/**
 * Charge one request against `tier`. Throws 429 when the bucket is empty.
 *
 * Returns silently — without charging anything — when there is no HTTP context,
 * which is the in-app solo backend. See the block comment above.
 */
export function rateLimit(res: any, tier: RateTier): void {
	const headers: any = res?.getContext?.()?.headers;
	if (!headers || typeof headers.get !== 'function') return; // solo / internal caller
	// ONCE PER REQUEST, not once per call. The endpoint instance is per-request, so
	// it is the right place to remember. Four endpoints (Heartbeat, Plant,
	// SetHomeStyle, SyncPlayer) are a thin `post` that takes the player lock and
	// hands off to a private method, and BOTH halves call bodyOf — which charged
	// those requests twice and silently halved their budget. Marking the instance
	// fixes it for those and for any future endpoint that reads its body more than
	// once, which is a much easier invariant to keep than "call bodyOf exactly one
	// time".
	if (res.__rateCharged) return;
	res.__rateCharged = true;
	const limits = RATE_TIERS[tier];
	const addr = clientAddress(headers);
	if (!addr && !warnedNoClientAddress) {
		warnedNoClientAddress = true;
		console.error(
			'rate limit: no client-address header on an HTTP request (looked for cf-connecting-ip, true-client-ip, x-real-ip, x-forwarded-for) — falling back to a shared per-tier budget',
		);
	}
	// An unidentifiable caller shares one deliberately roomy bucket per tier. That
	// keeps a header-shape surprise in production from turning into a 429 for every
	// player at once, while still leaving a ceiling in place.
	const perMinute = addr ? limits.perMinute : limits.perMinute * RATE_UNKEYED_MULTIPLIER;
	const burst = addr ? limits.burst : limits.burst * RATE_UNKEYED_MULTIPLIER;
	const now = Date.now();

	// TWO buckets, and the second is what makes the first worth having.
	//
	// A per-caller bucket is only as good as the caller's identity, and here that
	// identity is a header. The Worker sets it honestly, but Harper's hostname is
	// reachable directly, so someone who skips the Worker can put whatever they
	// like in it — and a fresh forged address every request means a fresh full
	// bucket every request. There is no fix for that without a shared secret
	// between the edge and the origin, which is infrastructure this does not have.
	//
	// So the per-caller bucket does the useful, precise job (one bad actor cannot
	// spoil it for everyone), and a service-wide bucket per tier sits behind it as
	// the thing forged addresses cannot get around. Sized so real aggregate traffic
	// never approaches it: the ceiling exists to bound a flood, not to shape
	// ordinary load.
	const caller = takeToken(`${tier}:${addr || '@shared'}`, perMinute, burst, now, false);
	const global = takeToken(
		`${tier}:@global`,
		limits.perMinute * RATE_GLOBAL_MULTIPLIER,
		limits.burst * RATE_GLOBAL_MULTIPLIER,
		now,
		false,
	);
	if (!caller || !global) throw new GameError(tr('server.err.tooManyRequests'), 429, 'server.err.tooManyRequests');
	// Only spend once BOTH have room, so a rejected request never quietly drains
	// the other bucket — otherwise a caller being turned away by one limit would
	// still be eating the budget of the other.
	takeToken(`${tier}:${addr || '@shared'}`, perMinute, burst, now, true);
	takeToken(
		`${tier}:@global`,
		limits.perMinute * RATE_GLOBAL_MULTIPLIER,
		limits.burst * RATE_GLOBAL_MULTIPLIER,
		now,
		true,
	);
}

/**
 * Refill a bucket and report whether it has a token. With `spend`, take it.
 *
 * Refills continuously rather than in fixed windows: a window lets a caller spend
 * a full budget at the very end of one and the whole of the next immediately
 * after, which is twice the intended rate at exactly the wrong moment.
 */
function takeToken(key: string, perMinute: number, burst: number, now: number, spend: boolean): boolean {
	let bucket = rateBuckets.get(key);
	if (!bucket) {
		if (rateBuckets.size >= RATE_BUCKET_MAX) {
			// At the ceiling, drop the oldest entry rather than refuse the request:
			// running out of bookkeeping space must not become a way to get a 429.
			const oldest = rateBuckets.keys().next();
			if (!oldest.done) rateBuckets.delete(oldest.value);
		}
		bucket = { tokens: burst, at: now };
		rateBuckets.set(key, bucket);
	}
	const refill = ((now - bucket.at) / 60_000) * perMinute;
	bucket.tokens = Math.min(burst, bucket.tokens + refill);
	bucket.at = now;
	if (bucket.tokens < 1) return false;
	if (spend) bucket.tokens -= 1;
	return true;
}

/** The tier an endpoint class declares, defaulting to ordinary gameplay. */
function tierOf(res: any): RateTier {
	const declared = res?.constructor?.rateTier;
	return declared && declared in RATE_TIERS ? (declared as RateTier) : 'action';
}

/**
 * Ceiling on a request body, in bytes of re-serialized JSON.
 *
 * Comfortably above every legitimate body in the game: the largest are
 * AppendFeed (FEED_CAP=100 lines x 500 chars, ~50 KB) and SyncMetrics
 * (METRICS_SNAPSHOT_MAX_BYTES=24 KB plus its scalars). 128 KB leaves room for
 * both to grow without ever coming near it.
 */
const MAX_BODY_BYTES = 128 * 1024;

/**
 * Be honest about what this bounds. Harper has already parsed the request by the
 * time a handler runs, so this cannot protect against the parse — that cost is
 * sunk. What it does stop is the durable half: a body this size being PERSISTED,
 * iterated key-by-key, or copied into a cached rollup, which is where an
 * oversized request turns from one slow moment into a permanent one.
 *
 * The stringify is one pass over an object we already hold, and every real body
 * is tens of bytes, so this is nothing on the gameplay path.
 */
export async function bodyOf(data: any, res?: any) {
	// Charged here because every POST handler in the file goes through this
	// function — one place to enforce it, and no endpoint can be added later that
	// quietly misses it. GETs are charged explicitly at the few that read the
	// database (they have no body to parse).
	if (res) rateLimit(res, tierOf(res));
	const body = await data;
	if (!body || typeof body !== 'object')
		throw new GameError(tr('server.err.bodyRequired'), 400, 'server.err.bodyRequired');
	let bytes = 0;
	try {
		bytes = JSON.stringify(body)?.length ?? 0;
	} catch {
		// Circular or otherwise unserializable — it cannot be stored either, so
		// refuse it here rather than further in.
		throw new GameError(tr('server.err.bodyTooLarge'), 413, 'server.err.bodyTooLarge');
	}
	if (bytes > MAX_BODY_BYTES) throw new GameError(tr('server.err.bodyTooLarge'), 413, 'server.err.bodyTooLarge');
	return body;
}
