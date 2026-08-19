// Wild Willows — server: core
//
// Foundations: the database handle, the player-facing GameError type and its
// refusal counters, and the small pure helpers (clamping, hashing, seeded RNG)
// that everything else builds on. Also the handful of global game constants and
// the per-world activity feed.
//
// Split out of the single server/resources.ts; see that file for the whole map.

import { t as tr } from '../src/i18n/server';

import { safeGet } from './store';
import { worldIsKeyed } from './keys';
import { byWorld } from './worlds';

export const db = () => {
	const d = typeof databases !== 'undefined' && databases ? databases.wildwillows : null;
	if (!d || !d.Player) throw new GameError(tr('server.err.dbStarting'), 503, 'server.err.dbStarting');
	return d;
};

// ---------------------------------------------------------------- helpers

/**
 * A refusal the player is meant to see: "not enough stones", "that recipe is
 * still locked", "your house isn't big enough yet".
 *
 * `code` is the message's catalog key, not its text — the text is already
 * translated by the time it gets here, so counting it would split one problem
 * across every language. The key is stable and comparable.
 *
 * Counting happens in the constructor because that is the ONE place all 163
 * refusal sites pass through; a dispatch-layer hook would have to be added to
 * every endpoint class and would be forgotten by the next one. It is a side
 * effect in a constructor, which is usually a smell — the tradeoff is that a
 * refusal cannot be raised without being recorded, which is the property worth
 * having. noteRefusal never throws and never blocks.
 */
export class GameError extends Error {
	statusCode: number;
	code: string;
	constructor(message: string, statusCode = 400, code = 'unknown') {
		super(message);
		this.statusCode = statusCode;
		this.code = code;
		void noteRefusal(code, statusCode);
	}
}

/**
 * Count a refusal by message key. Refusals were the biggest blind spot on the
 * dashboard: a mis-gated recipe could turn away every player who found it and
 * the only signal was somebody writing in. Activity counters can't show this —
 * they count what worked.
 *
 * Aggregated in memory and flushed on a timer rather than written per refusal: a
 * player jabbing at a locked recipe generates a burst, and this is bookkeeping,
 * not the job. Counts are per key only — no player ids, no message text.
 */
const refusalBuffer = new Map<string, { code: string; status: number; count: number; firstSeenAt: number }>();
let refusalFlushTimer: any = null;
const REFUSAL_FLUSH_MS = 15_000;

/** UTC day key, `YYYY-MM-DD`. The bucket label for the per-day counters below. */
const dayKeyUTC = (ms: number) => new Date(ms).toISOString().slice(0, 10);
/**
 * How many days of per-code history to keep. Bounded on purpose: `byDay` lives
 * inside the row, so without a cap a code seen every day would grow its own
 * record forever. Sixty days is the same window LandingStat keeps, and it is far
 * longer than anyone looks back at a refusal.
 */
const PROBLEM_HISTORY_DAYS = 60;

/**
 * Fold today's count into a row's per-day map and drop anything past the window.
 *
 * These tables were pure running totals — one row per code with a `count` that
 * only ever went up. That answers "has this ever happened" and nothing else: a
 * refusal code sitting at 380 could be 380 yesterday or 380 spread over two
 * months, and there was no way to tell which from the stored data. Any date
 * filter built on top could only ever sort rows by `lastSeenAt` while showing
 * all-time numbers beside them.
 *
 * Bucketing by day makes the question answerable. No backfill is possible — the
 * history that was never recorded cannot be recovered — so `byDay` starts empty
 * on existing rows and fills from the day this ships.
 */
export function bumpDay(prev: Record<string, number> | undefined, at: number, by: number): Record<string, number> {
	const cutoff = dayKeyUTC(at - PROBLEM_HISTORY_DAYS * 86_400_000);
	const out: Record<string, number> = {};
	for (const [day, n] of Object.entries(prev || {})) {
		// String compare is safe and cheap on YYYY-MM-DD, which sorts lexically.
		if (day >= cutoff && Number.isFinite(Number(n))) out[day] = Number(n);
	}
	const today = dayKeyUTC(at);
	out[today] = (out[today] || 0) + by;
	return out;
}

export async function flushRefusals(): Promise<void> {
	refusalFlushTimer = null;
	if (!refusalBuffer.size) return;
	const batch = [...refusalBuffer.values()];
	refusalBuffer.clear();
	try {
		const t = (db() as any).Refusal;
		if (!t) return;
		const now = Date.now();
		for (const r of batch) {
			const row = (await safeGet(t, r.code)) || {
				id: r.code,
				code: r.code,
				status: r.status,
				firstSeenAt: r.firstSeenAt,
				count: 0,
			};
			await t.put({
				...row,
				status: r.status,
				lastSeenAt: now,
				count: (row.count || 0) + r.count,
				byDay: bumpDay(row.byDay, now, r.count),
			});
		}
	} catch (e: any) {
		console.error('refusal flush failed —', e?.message || e);
	}
}

async function noteRefusal(code: string, status: number): Promise<void> {
	try {
		const cur = refusalBuffer.get(code);
		if (cur) cur.count++;
		else refusalBuffer.set(code, { code, status, count: 1, firstSeenAt: Date.now() });
		if (!refusalFlushTimer) {
			refusalFlushTimer = setTimeout(() => void flushRefusals(), REFUSAL_FLUSH_MS);
			// Don't hold the process open for a counter.
			refusalFlushTimer?.unref?.();
		}
	} catch {
		/* bookkeeping must never break the refusal it is counting */
	}
}

export const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// Deterministic PRNG (FNV-1a → mulberry32) — the same tiny pair the client and
// weather module use. Rotating daily tasks are a pure function of (worldId,
// player-local day), so a device can re-derive the list with no stored state.
export function hash32(str: string): number {
	let h = 0x811c9dc5;
	for (let i = 0; i < str.length; i++) {
		h ^= str.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return h >>> 0;
}

/**
 * A 64-bit content hash, as two independent FNV-style passes, base36-encoded.
 *
 * `hash32` is fine for a bucket key but far too narrow to validate a cache: a
 * collision there would answer 304 for a world that HAS changed, and the player
 * reads that as "the game lost what I just did" — silently, with no error to
 * follow. 64 bits puts an accidental collision out of reach.
 *
 * Deliberately NOT node:crypto's createHash: this module is bundled into the
 * renderer for the in-app solo backend, and src/solo/cryptoShim.ts provides only
 * randomBytes / scryptSync / timingSafeEqual. Importing anything else from
 * node:crypto would fail to resolve in the web build.
 */
export function hash64(str: string): string {
	let a = 0x811c9dc5;
	let b = 0x9dc5811c;
	for (let i = 0; i < str.length; i++) {
		const c = str.charCodeAt(i);
		a ^= c;
		a = Math.imul(a, 0x01000193);
		b ^= c + i;
		b = Math.imul(b, 0x85ebca6b);
	}
	return (a >>> 0).toString(36) + (b >>> 0).toString(36);
}

export function seededRng(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export function posInt(n: any, label: string): number {
	const v = Number(n);
	if (!Number.isInteger(v) || v <= 0)
		throw new GameError(tr('server.err.positiveWholeNumber', { label }), 400, 'server.err.positiveWholeNumber');
	return v;
}

export function sumValues(obj: Record<string, number> | undefined): number {
	if (!obj) return 0;
	return Object.values(obj).reduce((a, b) => a + (b || 0), 0);
}

/** True for the Harper structured-encoder error raised on a record whose stored
 *  bytes can't be decoded under the current layout. */
export function isDecodeError(e: any): boolean {
	return /end of buffer|buffer not reached|decod/i.test(String(e?.message || e));
}

// ------------------------------------------------------------- constants

export const NODE_REGEN_SECONDS = 75;
export const BASE_HEALTH = 5;
// The grasshopper is always the first animal to return anywhere — the meadow's
// first sign of life — and every other animal is gated behind it (see recalcBiome).
export const FIRST_ANIMAL_ID = 'grasshopper';
// How many activity-feed messages we keep per player (the feed is pruned to this
// on every append so the table never grows unbounded as people play).
export const FEED_CAP = 100;

// ------------------------------------------------------------- activity feed
//
// The feed is ONE row per world (`${wid}:feed`) holding an array, not one row
// per line.
//
// It used to be a row per line, and that made it the most expensive thing in the
// game per unit of value. Every flush wrote a row per entry, and then pruned to
// the cap — so once a world had been played for a while, each line cost a put
// AND a delete. A capped, append-only log that is only ever read whole has no
// use for per-row addressability; it was paying for random access nobody used.
// As a single row it is one write per flush no matter how many lines it carries,
// and pruning is a slice() rather than a stream of deletes.
export const feedRowId = (worldId: string) => `${worldId}:feed`;

/**
 * The world's feed, oldest→newest. Falls back to the pre-KEY_REV-3 per-line rows
 * for a world that has not been collapsed yet, so an un-migrated save shows its
 * history rather than an empty panel.
 */
export async function readFeed(worldId: string): Promise<any[]> {
	const t = db();
	const row = await safeGet(t.FeedEntry, feedRowId(worldId));
	const entries = Array.isArray(row?.entries) ? row.entries : [];
	if (await worldIsKeyed(worldId)) return entries;
	const legacy = (await byWorld(t.FeedEntry, worldId)).filter((r: any) => r?.id !== feedRowId(worldId));
	if (!legacy.length) return entries;
	return [...entries, ...legacy].sort((a: any, b: any) => (a.at || 0) - (b.at || 0)).slice(-FEED_CAP);
}

/** Replace the world's feed with `entries`, newest kept, capped. One write. */
export async function writeFeed(worldId: string, entries: any[]): Promise<void> {
	await db().FeedEntry.put({
		id: feedRowId(worldId),
		worldId,
		// solo worlds are keyed by the player's id, and several reset/delete paths
		// still find rows via byPlayer — keep them working by carrying it through.
		playerId: worldId,
		entries: entries.slice(-FEED_CAP),
		updatedAt: Date.now(),
	});
}

/** Append lines to a world's feed. One write regardless of how many. */
export async function appendFeed(worldId: string, lines: any[]): Promise<number> {
	const clean = lines
		.map((e: any) => ({
			id: `f_${Number(e?.at) || Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
			at: Number(e?.at) || Date.now(),
			icon: String(e?.icon || 'leaf').slice(0, 40),
			text: String(e?.text || '')
				.slice(0, 500)
				.trim(),
		}))
		.filter((e) => e.text);
	if (!clean.length) return 0;
	const next = [...(await readFeed(worldId)), ...clean].sort((a, b) => (a.at || 0) - (b.at || 0));
	await writeFeed(worldId, next);
	return clean.length;
}
