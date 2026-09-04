// Wild Willows — server: player
//
// Everything scoped to one player record: field guides, appearance sanitising,
// passcode hashing and verification, the per-player write lock, and the coalesced
// player-patch buffer.
//
// Split out of the single server/resources.ts; see that file for the whole map.

import { t as tr } from '../src/i18n/server';

import { GameError, db } from './core';
import { safeGet } from './store';
import { noteKeyedWorlds } from './keys';
import { cached, closeScope, openScope } from './scan-cache';
import { readDaily, readMetrics } from './metrics';

// ------------------------------------------------------------- field guides
//
// Each AREA has a guide, rather than the preserve sharing one ladder, and each
// guide is written up in two steps:
//
//   1  pocket notes    names, sketches, and a caretaker's hint
//   2  field guide     opens each animal's full page — role, food web, when
//                      they're about, the habitat they keep
//   3  expanded guide  spells out exactly what each animal is waiting for, in
//                      the journal and on the goals the player sets
//
// GUIDE_MAX is the top rung; the naturalist badge and the legacy migration both
// mean "written all the way up" and neither should hardcode a number.
// Tools default to 1 when absent, so nothing has to be seeded.
export const guideTool = (biome: string) => `journal-${biome}`;
export const GUIDE_MAX = 3;
/** The pre-split tool: ONE journal whose tier N covered every area of order < N. */
export const LEGACY_JOURNAL_TOOL = 'field-journal';

const guideLevel = (player: any, biome: string) => (player?.tools?.[guideTool(biome)] as number) || 1;
/** Can this save read the full animal pages for `biome`? */
export const hasGuide = (player: any, biome: string) => guideLevel(player, biome) >= 2;
/** …and the exact "what it's waiting for" requirements? */
export const hasExpandedGuide = (player: any, biome: string) => guideLevel(player, biome) >= GUIDE_MAX;

// Character appearance options (validated server-side; the frontend renders these)
// Preset swatches the creator offers as quick-picks. Colors are no longer
// restricted to this list — players can pick any color — so these are just
// suggestions surfaced in the UI.
// The creator falls back to these when a saved value is missing or malformed.
// Named rather than indexed so the swatch lists below can be reordered freely.
const DEFAULT_SKIN = '#eec39a';
const DEFAULT_HAIR = '#6e4a33';
const DEFAULT_OUTFIT = '#4a7c59';
export const SKIN_TONES = [
	'#fbe8d5',
	'#f6d7b8',
	'#f0cba6',
	'#eec39a',
	'#dcae7f',
	'#d9a06b',
	'#cf9662',
	'#c98f5e',
	'#b97f50',
	'#ad7248',
	'#a66b45',
	'#96603d',
	'#8d5a3a',
	'#7a4a30',
	'#6b4226',
	'#5a3720',
	'#4e2f1e',
];
export const HAIR_COLORS = [
	'#1c1614',
	'#2b2320',
	'#3b2e25',
	'#4a3b30',
	'#5c4636',
	'#6e4a33',
	'#7d5439',
	'#8a5f3d',
	'#a3692f',
	'#b5502e',
	'#c2632f',
	'#c9913f',
	'#d4a44f',
	'#d9b380',
	'#e8dcc0',
	'#8c8c8c',
	'#c9c9c9',
];
export const OUTFIT_COLORS = [
	'#3f6b4c',
	'#4a7c59',
	'#5f9166',
	'#8a9a5b',
	'#4f9a94',
	'#7a9ac0',
	'#5a6b8c',
	'#3f5f80',
	'#7d6b9e',
	'#9b6bb0',
	'#a8586b',
	'#b5707a',
	'#c4653f',
	'#d4783f',
	'#c9913f',
	'#d4a373',
	'#6b7280',
];
export const HAT_STYLES = [
	// 'none' leads the list because it's the default a new character starts with
	'none',
	'straw',
	'leaf',
	'beanie',
	'cap',
	'visor',
	'bucket',
	'flower',
	'party',
	'acorn',
	'beret',
	'ranger',
	'mushroom',
	'wizard',
	'witch',
	'crown',
	'bandana',
	'tophat',
	'newspaper',
	'chef',
	'pirate',
	'frog',
	'cat-ears',
	'headphones',
	'halo',
];
// Suggested hat tints (any hex is accepted); null/absent hatColor = the hat's classic colors.
export const HAT_COLORS = [
	'#c9a35c',
	'#8a734f',
	'#5d4a36',
	'#b05555',
	'#e8734f',
	'#b5707a',
	'#d77bb1',
	'#a8586b',
	'#7d6b9e',
	'#5f86b0',
	'#4f9a94',
	'#5d8a4a',
	'#6aa84f',
	'#e0b23e',
	'#f2efe6',
	'#8c8c8c',
	'#3f3b47',
];
export const HAIRSTYLES = [
	'short',
	'bald',
	'long',
	'bob',
	'curly',
	'curly-long',
	'bun',
	'braid',
	'ponytail',
	'pigtails',
	'afro',
	'mohawk',
	'wavy',
	'spiky',
	'dreads',
	'space-buns',
	'bowl',
	'double-braid',
	'half-up',
	'pixie',
	'cornrows',
	'shag',
];
export const BEARD_STYLES = ['none', 'beard'];
export const BODY_TYPES = ['slim', 'round'];

// Accept any standard #rgb or #rrggbb hex color; falls back to a default if the
// value isn't a valid color string.
function cleanHex(c: any, fallback: string): string {
	return typeof c === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(c.trim())
		? c.trim().toLowerCase()
		: fallback;
}

export function sanitizeAppearance(a: any) {
	a = a || {};
	return {
		skin: cleanHex(a.skin, DEFAULT_SKIN),
		hair: cleanHex(a.hair, DEFAULT_HAIR),
		outfit: cleanHex(a.outfit, DEFAULT_OUTFIT),
		hat: HAT_STYLES.includes(a.hat) ? a.hat : 'none',
		// null means "the hat's classic colors" — only a valid hex overrides it
		hatColor:
			typeof a.hatColor === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(a.hatColor.trim())
				? a.hatColor.trim().toLowerCase()
				: null,
		hairstyle: HAIRSTYLES.includes(a.hairstyle) ? a.hairstyle : 'short',
		beard: BEARD_STYLES.includes(a.beard) ? a.beard : 'none',
		body: BODY_TYPES.includes(a.body) ? a.body : 'slim',
	};
}

/**
 * Never send secrets back to the client.
 *
 * Also the one place the client is told whether this save may use dev tools.
 * The client needs to know so the hidden panel simply does not open on a save
 * that cannot use it — a panel whose every button answers "not this save" is
 * both useless and a signpost. A boolean is sent rather than the name behind it
 * (see DEV_PLAYER_SLUG): what unlocks dev tools stays on the server, and the
 * gate itself is enforced there regardless of what any client believes.
 */
export function sanitizePlayer(player: any) {
	if (!player) return player;
	const { passcode, passcodeHash, passcodeSalt, ...rest } = player;
	rest.devTools = isDevSave(player);
	// metrics/daily are persisted as JSON strings; the client and the offline solo
	// backend expect them as objects, so decode them on the way out.
	if (rest.metrics !== undefined) rest.metrics = readMetrics(player);
	if (rest.daily !== undefined) rest.daily = readDaily(player);
	return rest;
}

// ----------------------------------------------------------- passcode hashing
// Passcodes are never stored in plaintext: each save keeps a random salt and a
// scrypt hash. Verification is constant-time. Legacy saves created before this
// (plaintext `passcode`) are transparently re-hashed on their next successful
// login and the plaintext field is dropped.
// @ts-ignore — node:crypto is provided by the Harper Node runtime (no @types/node here)
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export function hashPasscode(passcode: string, salt?: string): { salt: string; hash: string } {
	const s = salt || randomBytes(16).toString('hex');
	const hash = scryptSync(String(passcode), s, 32).toString('hex');
	return { salt: s, hash };
}

/** Constant-time check of a passcode against a stored salt+hash. */
function checkHash(passcode: string, salt: string, hash: string): boolean {
	try {
		const B = (globalThis as any).Buffer;
		const got = scryptSync(String(passcode), salt, 32);
		const want = B.from(hash, 'hex');
		return got.length === want.length && timingSafeEqual(got, want);
	} catch {
		return false;
	}
}

/**
 * Verify a save's passcode. Returns true/false. If the save is still on a
 * legacy plaintext passcode and it matches, it is upgraded to a salted hash in
 * place (and the plaintext removed) so secrets stop living in the database.
 */
export async function verifyPasscode(player: any, passcode: string): Promise<boolean> {
	const code = String(passcode || '');
	if (player.passcodeHash && player.passcodeSalt) {
		return checkHash(code, player.passcodeSalt, player.passcodeHash);
	}
	// legacy plaintext save — verify then migrate to a hash
	if (typeof player.passcode === 'string' && code.length > 0 && code === player.passcode) {
		const { salt, hash } = hashPasscode(code);
		await patchPlayer(player.id, { passcodeHash: hash, passcodeSalt: salt, passcode: null });
		return true;
	}
	return false;
}

export function slugId(name: string): string {
	return String(name)
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

/**
 * The only save DevTools will act on, as a name slug.
 *
 * A REAL gate: DevTools is a public endpoint (CreatePlayer hands out player ids
 * to anyone, and workers/play.js proxies DevTools straight from the public
 * site), so without this, `restart-game` — which deletes a save's entire world —
 * is one POST away for anyone who knows an id.
 *
 * Matched on the slug of the save's NAME rather than its id, because ids carry a
 * random suffix (`bailey-test-k3f9a2`) so there is no fixed id to compare, and
 * because slugId normalizes the ways the name gets typed — `bailey_test`,
 * `Bailey_Test`, `bailey test` and `bailey-test` all reduce to the same thing.
 * The match is EXACT, not a prefix: `bailey_testing` is a different save and does
 * not qualify. Several saves can share the name, which is the intended way to
 * have more than one test world.
 *
 * It lives here, beside slugId, because both the DevTools handler and the player
 * view the client is sent have to agree on it (see `devTools` in sanitizePlayer).
 */
const DEV_PLAYER_SLUG = 'bailey-test';

/** True if this save is a test save, i.e. one DevTools will act on. */
export function isDevSave(player: any): boolean {
	return slugId(String(player?.name || '')) === DEV_PLAYER_SLUG;
}

// Starter base camp: tent + campfire scenery with a storage chest. Crafting
// needs no station — it works anywhere, from the basket plus any chests.
export const STARTER_CHEST = { x: 23, y: 5, size: 'small-chest', capacity: 120 };

// ------------------------------------------------------------ player setup

/** Load an existing player or fail — creation only happens via /CreatePlayer/. */
/**
 * Serialize everything that touches one player's row.
 *
 * Every mutating endpoint here is read-modify-write: read the player, compute the
 * new inventory / craftedItems / tools, patch it back. Two requests for the same
 * player interleave freely, so both read the same baseline and the second patch
 * lands on top of the first. On a craft that costs the player either the item or
 * the materials, depending which write wins — and with materials for one craft, a
 * double-click passed BOTH availability checks and made two.
 *
 * The window is exactly as wide as one round trip, which is why an impatient
 * double-click on a slow connection was enough to hit it.
 *
 * A queue per player, not a global one: unrelated players never wait on each
 * other. The promise stored in the map always resolves (the release runs in a
 * finally), so one failed request can't wedge the queue behind it.
 */
const playerLocks = new Map<string, Promise<void>>();

// ------------------------------------------------- coalesced player writes
//
// One gameplay action used to write the Player row two or three times: once for
// the state change (inventory, tools, craftedItems), once for bumpMetrics'
// counters, and sometimes again for achievements. Same row, same request, and on
// Harper every one of those is a separate billable write. On the free tier the
// 1,000 writes/minute allowance is what caps how many people can play at once,
// so the duplicates were coming straight out of the concurrency budget.
//
// While a player is inside withPlayerLock, patches to their row accumulate here
// and are written ONCE when the lock releases. Outside a lock (Heartbeat and the
// login/admin paths do not take one) patchPlayer writes through immediately, so
// a buffered patch can never be left unflushed by a path that does not know
// about the buffer.
//
// Reads have to see the buffer or the coalescing would be observable: bumpMetrics
// deliberately re-reads the freshest row before merging counters, and snapshot()
// builds its response from the row mid-action. getPlayer() overlays the pending
// patch, so every reader sees the row as this request has left it.
const pendingPlayerPatch = new Map<string, any>();
const bufferingPlayers = new Set<string>();

/**
 * The STORED player row, read once per request.
 *
 * Every gameplay action reads this row two or three times — requirePlayer on the
 * way in, the achievement sweep, bumpMetrics merging onto the freshest copy —
 * and inside a lock it cannot change between them, because patchPlayer buffers
 * (below) and nothing else writes Player mid-action. The reads were identical;
 * the only thing the second and third bought was latency.
 *
 * Deliberately the stored row, WITHOUT the pending patch overlaid. Callers that
 * want this request's own writes folded in go through getPlayer, which is the
 * one place that overlay belongs; a cache that quietly applied it would change
 * WHEN an achievement fires (a trigger reading the metrics its own action just
 * bumped) rather than only how often a row is read.
 */
export async function readPlayerRow(playerId: string): Promise<any | null> {
	return cached(playerId, 'Player|row', () => safeGet(db().Player, playerId));
}

/** Patch the player row — buffered inside a lock, written through outside one. */
export async function patchPlayer(playerId: string, partial: any): Promise<void> {
	if (!playerId || !partial) return;
	if (!bufferingPlayers.has(playerId)) {
		await db().Player.patch(playerId, partial); // the real write — never patchPlayer, that is this function
		return;
	}
	const cur = pendingPlayerPatch.get(playerId);
	// Shallow merge, exactly like a sequence of Harper patches: last write wins
	// per key, so collapsing them changes the number of writes and nothing else.
	pendingPlayerPatch.set(playerId, cur ? { ...cur, ...partial } : { ...partial });
}

/** The player row as this request has left it: stored row plus anything pending. */
export async function getPlayer(playerId: string): Promise<any | null> {
	const stored = await readPlayerRow(playerId);
	const pending = pendingPlayerPatch.get(playerId);
	if (!pending) return stored;
	return { ...(stored || { id: playerId }), ...pending };
}

async function flushPlayerPatch(playerId: string): Promise<void> {
	const pending = pendingPlayerPatch.get(playerId);
	pendingPlayerPatch.delete(playerId);
	if (pending) await db().Player.patch(playerId, pending); // the real write
}

export async function withPlayerLock<T>(playerId: string, fn: () => Promise<T>): Promise<T> {
	const ahead = playerLocks.get(playerId);
	let release!: () => void;
	const mine = new Promise<void>((r) => (release = r));
	playerLocks.set(playerId, mine);
	if (ahead) await ahead;
	bufferingPlayers.add(playerId);
	// The read scope opens with the write buffer and closes with it, for the same
	// reason: this is the span in which one request, and only one, is acting on
	// this save. See scan-cache.ts for why the id is the whole safety argument.
	openScope(playerId);
	try {
		return await fn();
	} finally {
		// Flush BEFORE releasing, so the next request in the chain reads a row that
		// already includes this one's writes. On the error path we still flush: the
		// un-coalesced code had already written each patch by the time it threw, and
		// collapsing writes must not also change what survives a failure.
		bufferingPlayers.delete(playerId);
		try {
			await flushPlayerPatch(playerId);
		} catch (e: any) {
			console.error(`flushing player writes for ${playerId} failed —`, e?.message || e);
		}
		// After the flush, so the write above still invalidates a scope that is open
		// — the next request must never inherit this one's rows.
		closeScope(playerId);
		release();
		// Only the last one out clears the slot, or a queued request would be
		// dropped from the chain and start racing again.
		if (playerLocks.get(playerId) === mine) playerLocks.delete(playerId);
	}
}

export async function requirePlayer(playerId: string): Promise<any> {
	if (!playerId || typeof playerId !== 'string')
		throw new GameError(tr('server.err.playerIdRequired'), 400, 'server.err.playerIdRequired');
	const player = await getPlayer(playerId);
	if (!player) throw new GameError(tr('server.err.noSaveLogin'), 404, 'server.err.noSaveLogin');
	noteKeyedWorlds(player);
	return { player };
}
