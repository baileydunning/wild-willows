// Wild Willows — server: endpoints-game
//
// The gameplay endpoints: the `Resource` base classes every endpoint extends, the
// GameData/GameState reads, and every action that mutates a world — collecting,
// crafting, placing, planting, terraforming, upgrading, resting.
//
// Split out of the single server/resources.ts; see that file for the whole map.

import { t as tr } from '../src/i18n/server';
import { buildStamp } from './pages';
import { gatherResourceIdFor, isWeatherGatheredResource, nextDawnAt, weatherTypeAt } from './weather';
// @ts-ignore — Node built-in; this project deliberately has no @types/node
import { brotliCompressSync, constants as zlibConstants, gzipSync } from 'node:zlib';

import { FEED_CAP, GameError, NODE_REGEN_SECONDS, appendFeed, clamp, db, hash64, posInt, sumValues } from './core';
import { allOf, existsRaw, forceRemove, safeGet } from './store';
import { byPlayer, placementKey } from './keys';
import {
	byArea,
	byWorld,
	defs,
	ensureSoloWorld,
	findBiomeState,
	findDiscovery,
	findInWorld,
	findTerrainAt,
	repairSave,
	worldOf,
} from './worlds';
import {
	BASKET_OVERFLOW_TIER,
	BASKET_SWEEP_TIER,
	CAN_DIP_TIER,
	DIG_FIND_CHANCE,
	HOME_STYLES,
	HOME_TRACKS,
	MAX_BRUSH_TILES,
	MAX_SWEEP_NODES,
	SHOVEL_SALVAGE_TIER,
	SHOVEL_SURVEY_TIER,
	brushSizesFor,
	SLEEPABLE_OBJECTS,
	blocksDoorway,
	homeOf,
	homePerk,
	homeRoom,
	tentBiomeOf,
	tentRoom,
} from './home';
import {
	BEARD_STYLES,
	BODY_TYPES,
	HAIRSTYLES,
	HAIR_COLORS,
	HAT_COLORS,
	HAT_STYLES,
	OUTFIT_COLORS,
	SKIN_TONES,
	hashPasscode,
	patchPlayer,
	requirePlayer,
	sanitizeAppearance,
	sanitizePlayer,
	slugId,
	verifyPasscode,
	withPlayerLock,
} from './player';
import {
	bumpMetrics,
	bumpStanding,
	encodeMetrics,
	freshMetrics,
	metricsView,
	playerDayKey,
	readMetrics,
	sanitizeTzOffset,
	standingOf,
	weatherTimeFromPlay,
} from './metrics';
import {
	STARTING_TERRAIN,
	areaGrid,
	blocksGateTrail,
	buriedCacheAt,
	carriedWeight,
	checkUnlocks,
	consumeMaterials,
	createPlayerRecords,
	freshSnapshot,
	gateGeomOf,
	getOwnedChest,
	inventoryCapacity,
	roomFor,
	matureMs,
	recalcBiome,
	withPendingMaturity,
	recipeUnlockContext,
	recipeUnlockMet,
	seedStartingTerrain,
} from './biome';
import {
	MAX_CUSTOM_GOALS,
	boardPlacements,
	dailyTasksBlock,
	goalLimitFor,
	goalMetric,
	placedCountFor,
	sanitizeGoals,
	snapshot,
} from './tasks';
import { bodyOf, rateLimit } from './rate-limit';
import { awardAchievements, awardWorldAchievements } from './achievements';
import type { CustomGoal, TaskCtx } from './tasks';
import type { TerrainChange } from './biome';

// ================================================================ ENDPOINTS

/**
 * MVP demo-player flow: the game endpoints are publicly accessible (no real
 * auth yet, per the MVP scope). All writes still go through full server-side
 * validation, the underlying tables are NOT exported over REST, and Harper
 * admin credentials are never used or exposed by the frontend. Swap these
 * allow* methods for role checks when real accounts are added.
 */
export class PublicEndpoint extends Resource {
	allowRead() {
		return true;
	}
	allowCreate() {
		return true;
	}
	allowUpdate() {
		return true;
	}
	allowDelete() {
		return false;
	}
}

/**
 * Roles allowed to read the dashboard's data feeds. `super_user` is Harper's
 * own; `metrics_reader` is a role you create with no write permission, so the
 * credential the dashboard holds in a browser tab can read these numbers and do
 * nothing else. That matters because the page keeps the password it logged in
 * with in order to authenticate its own requests — a super-user password sitting
 * in sessionStorage is the keys to the database; a read-only one is a leak worth
 * rotating and nothing worse.
 */
const DASHBOARD_ROLES = new Set(['super_user', 'metrics_reader']);

/** The role name off Harper's user object, tolerating either shape it might take.
 *  Probed rather than assumed — see SystemProbe's 'authenticated user shape'. */
function roleNameOf(user: any): string {
	const r = user?.role;
	if (typeof r === 'string') return r;
	if (r && typeof r === 'object') return String(r.role || r.role_name || r.name || '');
	return '';
}

/** True for Harper's own super-user flag, whichever way it is expressed. */
export function isSuperUser(user: any): boolean {
	return !!(user?.role?.permission?.super_user || user?.role?.super_user || roleNameOf(user) === 'super_user');
}

/**
 * Base class for the endpoints the metrics dashboard reads.
 *
 * Authentication is still entirely Harper's — this only decides WHICH
 * authenticated users get through, and it fails closed: no user object, no
 * access. It deliberately does not fall back to "allow if we can't tell", which
 * is the shape that turns an unrecognized user object into an open endpoint.
 *
 * Endpoints carrying more than gameplay numbers do NOT use this. ListFeedback
 * holds players' reply emails and SystemProbe reports server internals; both stay
 * on the raw Resource, so they need the real super-user key.
 */
export class DashboardEndpoint extends Resource {
	allowRead(user?: any) {
		if (!user) return false;
		return isSuperUser(user) || DASHBOARD_ROLES.has(roleNameOf(user));
	}
	allowCreate() {
		return false;
	}
	allowUpdate() {
		return false;
	}
	allowDelete() {
		return false;
	}
}

/**
 * GET /DashboardAuth/ — "are these credentials good, and who am I?"
 *
 * The login form needs something cheap to test a username and password against.
 * Without this it would have to call /MetricsSummary/, which scans and rolls up
 * every save just to find out whether a password was typed correctly. This reads
 * nothing.
 *
 * It returns the username and role name so the page can show who is signed in —
 * and so a credential that authenticates but lacks the role gets a clear "your
 * account cannot read this" instead of a bare 401 it can't explain.
 */
export class DashboardAuth extends DashboardEndpoint {
	async get() {
		const user: any = (this as any).getContext?.()?.user;
		return {
			ok: true,
			username: user?.username || user?.name || null,
			role: roleNameOf(user) || null,
			superUser: isSuperUser(user),
		};
	}
}

/**
 * GET /Version/ — the stamp baked into this bundle at build time (app version +
 * build timestamp, generated by scripts/build-pages.mjs). deploy.sh polls
 * this on every public entry point after deploying and fails loudly if any node
 * is still serving an older bundle.
 */
export class Version extends PublicEndpoint {
	async get() {
		return { build: buildStamp };
	}
}

/** GET /GameData/ — all static definitions (biomes, animals, recipes, …).
 *
 * This is by far the largest response the game sends (~300 KB of JSON) and web /
 * demo clients fetch it once at open, before login. On the HOSTED Harper
 * we make it cheap two ways:
 *
 *  1. Revalidation. The payload is fully determined by the build (buildStamp),
 *     so we tag it with a build-stamped ETag and honor If-None-Match: repeat
 *     opens get an empty 304 instead of re-downloading the whole catalog.
 *  2. Compression. Harper's REST path does NOT compress resource responses, and
 *     this JSON is highly repetitive, so we brotli/gzip it per the client's
 *     Accept-Encoding — ~300 KB → ~65 KB on the wire.
 *
 * IMPORTANT — this module is bundled BOTH for the hosted Harper (Node) AND into
 * the renderer for the in-app solo backend (src/solo/backend.ts). That backend
 * calls get() with no HTTP request context and uses the return value AS the data,
 * and it runs in a browser where node:zlib does not exist. So get() must return
 * the PLAIN OBJECT whenever there's no request context, and it must never import
 * or touch zlib except on the real HTTP path (which the renderer never takes).
 * Desktop serves GameData locally through exactly that solo path.
 */
let gameDataCache: { stamp: string; obj: any; json: string; etag: string } | null = null;

async function gameDataCached() {
	if (gameDataCache && gameDataCache.stamp === buildStamp) return gameDataCache;
	const d = await defs();
	const obj = {
		biomes: d.biomes,
		animals: d.animals,
		resources: d.resources,
		recipes: d.recipes,
		habitatObjects: d.objects.map((o: any) => ({ ...o, rotatable: isRotatable(o) })),
		tools: d.tools,
		achievements: d.achievements,
		homeStyles: HOME_STYLES,
		homeTracks: HOME_TRACKS,
		nodeRegenSeconds: NODE_REGEN_SECONDS,
		appearanceOptions: {
			skins: SKIN_TONES,
			hair: HAIR_COLORS,
			outfits: OUTFIT_COLORS,
			hats: HAT_STYLES,
			hatColors: HAT_COLORS,
			hairstyles: HAIRSTYLES,
			beards: BEARD_STYLES,
			bodies: BODY_TYPES,
		},
	};
	// Weak validator: body is identical for a given build (though exact bytes differ
	// across br/gzip/identity). `"gd-<build>"` changes whenever the catalog does.
	gameDataCache = { stamp: buildStamp, obj, json: JSON.stringify(obj), etag: `W/"gd-${buildStamp}"` };
	return gameDataCache;
}

// Buffer is a Node global in the Harper runtime; reach it via globalThis so this
// module still type-checks with no @types/node (same trick as the node:crypto use).
export const nodeBuffer: any = (globalThis as any).Buffer;

// Compressed representations, built once per build and cached (server-only path).
let gameDataCompressed: { stamp: string; gzip?: Uint8Array; br?: Uint8Array } | null = null;
function compressedGameData(json: string, enc: 'br' | 'gzip'): Uint8Array {
	const cache =
		gameDataCompressed && gameDataCompressed.stamp === buildStamp
			? gameDataCompressed
			: (gameDataCompressed = { stamp: buildStamp });
	const buf = nodeBuffer.from(json, 'utf8');
	if (enc === 'br') {
		if (!cache.br)
			cache.br = brotliCompressSync(buf, {
				params: {
					[zlibConstants.BROTLI_PARAM_QUALITY]: BROTLI_QUALITY,
					[zlibConstants.BROTLI_PARAM_SIZE_HINT]: buf.length,
				},
			});
		return cache.br as Uint8Array;
	}
	if (!cache.gzip) cache.gzip = gzipSync(buf, { level: 6 });
	return cache.gzip as Uint8Array;
}

/**
 * The brotli quality every compressed body on the HTTP path uses — JSON and the
 * inlined HTML pages alike.
 *
 * Node's DEFAULT is 11, and on a fully-restored world's 363 KB snapshot that
 * costs **over a second of CPU per request** to save ~1 KB over q5 — a denial of
 * service you inflict on yourself, one request at a time. Measured on that
 * snapshot: q4 → 14.5 KB in 1.9 ms · q5 → 10.5 KB in 3.0 ms · q9 → 10.0 KB in
 * 94 ms · q11 → 9.3 KB in 1035 ms. q5 is the knee of that curve and it is what
 * GameData has always used. Re-measure before changing it; `bare
 * brotliCompressSync(buf)` is not the same thing and must not be used here.
 */
export const BROTLI_QUALITY = 5;

/** The content-encoding this client will accept, or null for identity. */
function negotiateEncoding(accept: string): 'br' | 'gzip' | null {
	if (/\bbr\b/.test(accept)) return 'br';
	if (/\bgzip\b/.test(accept)) return 'gzip';
	return null;
}

/**
 * Compress a JSON body. UNCACHED, unlike compressedGameData above — this is for
 * per-player bodies that are different on every call, where a cache would only
 * be a leak whose size tracks the number of players (the failure mode called out
 * on RollupCache).
 */
function compressJson(json: string, enc: 'br' | 'gzip'): Uint8Array {
	const buf = nodeBuffer.from(json, 'utf8');
	if (enc === 'br')
		return brotliCompressSync(buf, {
			params: {
				[zlibConstants.BROTLI_PARAM_QUALITY]: BROTLI_QUALITY,
				[zlibConstants.BROTLI_PARAM_SIZE_HINT]: buf.length,
			},
		});
	return gzipSync(buf, { level: 6 });
}

/**
 * Turn a game-state snapshot into a compressed, revalidatable HTTP response.
 *
 * WHY: `GET /GameState/` is the largest response the game sends after GameData,
 * it is fetched every few actions, and — unlike GameData — it has no fixed size.
 * It grows with the world: ~4 KB on a new save, ~89 KB mid-game, ~363 KB on a
 * fully-restored one, all of it uncompressed, because Harper's REST path does not
 * compress resource responses. A browser player re-syncing every fourth action
 * was pulling that down ten times a minute. Brotli takes the 363 KB case to
 * ~10.5 KB for 3 ms of CPU.
 *
 * THE ETAG IS THE BODY, not a revision counter. `serverTime` is the only field
 * that changes on every call, and no client reads it — it is declared in
 * src/types.ts and referenced nowhere else in src/. Everything else in the
 * snapshot is a pure function of stored state: weather derives from accrued play
 * time on the player row, the daily-task board from that row and the UTC day. So
 * hashing the rest of the body and comparing it to If-None-Match is correct by
 * construction — there is no write path that can forget to bump a counter,
 * because there is no counter. That matters more than the bytes it saves: a
 * stale 304 here would hand a player back a world without the thing they just
 * built, which is indistinguishable from data loss.
 */
function snapshotResponse(reqHeaders: any, state: any) {
	const { serverTime, ...stable } = state;
	const stableJson = JSON.stringify(stable);
	const etag = `W/"gs-${hash64(stableJson)}"`;
	// Splice serverTime back on rather than stringifying a third of a megabyte
	// twice. Key order is not significant to JSON.parse, and `stable` is never
	// empty — but fall back to the honest path if it somehow is.
	const json =
		stableJson.length > 2
			? `${stableJson.slice(0, -1)},"serverTime":${Number(serverTime) || 0}}`
			: JSON.stringify(state);

	const headers: Record<string, string> = {
		'content-type': 'application/json; charset=utf-8',
		// `private` because this is ONE player's save. The browser demo reaches this
		// through a Cloudflare Worker, and any shared cache that stored a `public`
		// copy could hand one player's world to whoever asked next. `no-cache` means
		// "cache it, but revalidate every time" — which is exactly what the ETag is
		// for; it does NOT mean "don't cache".
		'cache-control': 'private, no-cache',
		etag,
		vary: 'Accept-Encoding',
	};

	// Compare loosely so a weak/strong prefix or quoting mismatch still matches.
	const norm = (s: string) => s.replace(/^W\//, '').trim();
	const ifNoneMatch = String(reqHeaders.get('if-none-match') || '');
	if (ifNoneMatch && norm(ifNoneMatch) === norm(etag)) {
		// An EXPLICITLY empty body. Harper serializes the whole returned object into
		// the response body when `body` is absent (finalizeResponse in its REST
		// layer), so leaving it undefined ships `{"status":304,…}` as the payload of
		// a response that is defined to have none.
		return { status: 304, headers, body: nodeBuffer.alloc(0) };
	}

	const enc = negotiateEncoding(String(reqHeaders.get('accept-encoding') || ''));
	if (!enc) return { status: 200, headers, body: json };
	return { status: 200, headers: { ...headers, 'content-encoding': enc }, body: compressJson(json, enc) };
}

/**
 * CORS for GET /GameData/ — deliberately wide open, and safe to be.
 *
 * This catalog is public, unauthenticated, byte-identical for every caller and
 * already fetched by anonymous browsers before login. `*` therefore exposes
 * nothing that a plain URL does not, and — critically — it is credential-less:
 * `*` and `Access-Control-Allow-Credentials` are mutually exclusive by spec, so
 * no cookie or auth header can ever ride along on a cross-origin read.
 *
 * It is here for the classroom pages (/learn/code-builder), which need it in
 * three places the same-origin case never exercised:
 *   1. The preview iframe is `sandbox="allow-scripts"` WITHOUT `allow-same-origin`,
 *      so student code runs on an OPAQUE origin. Without this header the only fix
 *      is granting `allow-same-origin`, which would hand student JS the parent page.
 *   2. Downloaded projects run from `file://` (`Origin: null`).
 *   3. Anywhere a student continues afterwards — CodePen, a school Google Site.
 * CONTRIBUTING.md already notes the packaged app's `file://` origin needs this too.
 *
 * MUST be on the 304 path as well: a cross-origin client that already holds the
 * ETag revalidates, and a 304 without these headers is a CORS failure — i.e. the
 * lesson would work on first load and mysteriously break on every reload after.
 *
 * Scoped to THIS endpoint by construction (a const, not middleware). It must
 * never spread to GameState or anything under DashboardEndpoint: those are
 * per-player or admin, and same-origin policy is what is currently protecting them.
 */
const GAME_DATA_CORS: Record<string, string> = {
	'access-control-allow-origin': '*',
	// No `access-control-allow-headers`/`-methods`: the lesson teaches bare
	// `fetch(url)` with no custom headers, which is a CORS-simple request and is
	// never preflighted. Nothing here answers OPTIONS, and nothing needs to.
	'access-control-allow-methods': 'GET, HEAD',
};

export class GameData extends PublicEndpoint {
	static rateTier = 'catalog';

	async get() {
		const { obj, json, etag } = await gameDataCached();
		// No HTTP request context → the in-app solo backend (or any internal JS
		// caller). Return the plain data object; do NOT build an envelope or touch
		// zlib (unavailable in the renderer).
		const reqHeaders: any = (this.getContext?.() as any)?.headers;
		if (!reqHeaders || typeof reqHeaders.get !== 'function') return obj;

		/* TWO AUDIENCES, TWO ANSWERS, IN ONE HEADER.
		 *
		 * `max-age=0, must-revalidate` is for the BROWSER: the copy it holds is
		 * stale the instant it lands, so it asks every time and the etag below turns
		 * that into a 304. That is deliberate. The catalog changes on deploy (new
		 * hats, hairstyles, skin tones), and an earlier value here —
		 * `public, max-age=300, stale-while-revalidate=604800` — let a browser serve
		 * the OLD catalog for five minutes without asking and then serve it stale
		 * for up to seven more days while revalidating behind the player's back. A
		 * deploy could take a week to show up, which looks exactly like "the new
		 * options didn't ship".
		 *
		 * `s-maxage=86400` is for the SHARED cache, and it is the one that protects
		 * the origin. A 304 is cheap in bytes and not free in requests: something
		 * still has to compare the etag, and if that something is Harper then a
		 * classroom sending 600 revalidations a minute is still 600 requests a
		 * minute at the database. wildwillows.app is behind Cloudflare, so with a
		 * cache rule on this path the edge answers the repeats from its own copy and
		 * Harper sees roughly one request per edge location per day.
		 *
		 * The day is long on purpose, because a deploy PURGES it — see
		 * scripts/purge-cache.mjs, which npm run deploy:purge calls. Without the
		 * purge this would be a day-long lie; with it, new data is live the moment
		 * it ships and the quiet time in between costs nothing.
		 *
		 * WHAT A BROWSER ACTUALLY RECEIVES IS NOT THIS STRING. The Cloudflare cache
		 * rule on /GameData* is set to take its edge TTL from this header and to
		 * rewrite the browser TTL to ten minutes, so what arrives at a browser is
		 * `max-age=600`, not `max-age=0`. That is deliberate and it is the reason
		 * `must-revalidate` is still worth sending: ten minutes is short enough that
		 * a deploy is visible almost immediately, and long enough that a student
		 * pressing Run twenty times in a period pays for one request rather than
		 * twenty. If that rule is ever removed, this header alone is still correct;
		 * the browser simply goes back to revalidating every time.
		 *
		 * Order matters to nobody but a reader: a shared cache reads s-maxage and
		 * ignores max-age, a browser does the opposite. must-revalidate binds only
		 * once a response IS stale, which for the edge is after the day is up. */
		const cacheControl = 'public, max-age=0, must-revalidate, s-maxage=86400';
		// Revalidation hit: same build the client already has → send nothing.
		// Compare loosely so a weak/strong prefix or quoting mismatch still matches.
		const norm = (s: string) => s.replace(/^W\//, '').trim();
		const ifNoneMatch = String(reqHeaders.get('if-none-match') || '');
		if (ifNoneMatch && norm(ifNoneMatch) === norm(etag)) {
			// Explicitly empty — see the note in snapshotResponse: without this Harper
			// serializes the envelope itself into the body of a 304.
			return {
				status: 304,
				headers: { etag, 'cache-control': cacheControl, ...GAME_DATA_CORS },
				body: nodeBuffer.alloc(0),
			};
		}

		/* CHARGED HERE, AND DELIBERATELY NOT ONE LINE EARLIER.
		 *
		 * Everything above this point is free: no context is the in-app backend, and
		 * a matching If-None-Match is a 304 with an empty body. Both return before
		 * the limiter is ever consulted, so NO CLIENT THAT CACHES CAN BE REFUSED —
		 * which is the property that matters, because the one caller that must never
		 * break is the game.
		 *
		 * For the record, the game is safe twice over. Desktop, Steam and Mac App
		 * Store builds never make this call at all: src/api.ts serves /GameData/ from
		 * the bundle on desktop, which is what makes the title screen work offline.
		 * The browser demo calls it exactly once per session, on mount, with no
		 * retry, through a Worker that forwards cf-connecting-ip so one player is one
		 * caller rather than all of them sharing a bucket. A player would have to
		 * reload the demo twenty times a second to see this.
		 *
		 * THE REFUSAL IS ANSWERED, NOT THROWN. Every other endpoint lets rateLimit
		 * throw and Harper renders the 429. This one cannot: its browser callers are
		 * cross-origin — student code in an opaque-origin sandbox, a downloaded page
		 * on file://, anyone building against the documented API — and a 429 without
		 * Access-Control-Allow-Origin does not reach their catch block as a 429. It
		 * arrives as an opaque network failure with no status and no message, which
		 * is indistinguishable from the student's own code being broken.
		 */
		try {
			rateLimit(this, 'catalog');
		} catch (err: any) {
			// GameError carries `statusCode`, not `status`. Reading the wrong one
			// rethrows every refusal and makes the answer below dead code.
			if (err?.statusCode !== 429) throw err;
			return {
				status: 429,
				headers: {
					'content-type': 'text/plain; charset=utf-8',
					// The bucket's own refill window, so a client that honors this comes
					// back to a budget rather than to another refusal.
					'retry-after': '60',
					'cache-control': 'no-store',
					...GAME_DATA_CORS,
				},
				body: 'Too many requests for the game catalog. It changes only when the game ships a build, so fetch it once and keep it. Wait a minute and try again — see https://wildwillows.app/developers/api for the limits and how to use the ETag.',
			};
		}

		const headers: Record<string, string> = {
			'content-type': 'application/json; charset=utf-8',
			'cache-control': cacheControl,
			etag,
			vary: 'Accept-Encoding',
			...GAME_DATA_CORS,
		};
		const enc = negotiateEncoding(String(reqHeaders.get('accept-encoding') || ''));
		let body: string | Uint8Array = json;
		if (enc) {
			headers['content-encoding'] = enc;
			body = compressedGameData(json, enc);
		}
		return { status: 200, headers, body };
	}
}

/** POST /CreatePlayer/ {name, passcode, appearance} — start a brand-new save. */
export class CreatePlayer extends PublicEndpoint {
	static rateTier = 'auth'; // scrypt runs on this path
	async post(data: any) {
		const { name, passcode, appearance, tzOffsetMinutes, creationMs, edition } = await bodyOf(data, this);
		const ed: 'demo' | 'full' = edition === 'demo' ? 'demo' : 'full';
		const cleanName = String(name || '').trim();
		if (cleanName.length < 2 || cleanName.length > 24)
			throw new GameError(tr('server.err.nameLength'), 400, 'server.err.nameLength');
		const code = String(passcode || '');
		if (code.length < 4 || code.length > 32)
			throw new GameError(tr('server.err.passcodeLength'), 400, 'server.err.passcodeLength');

		// EVERY save gets a unique id (name-slug + random suffix), demo or not. The
		// caretaker name is a label, not an identity: two people — or one person
		// with two saves — may both be "Willow", and neither should be told the
		// name is taken.
		//
		// This also closes a data-loss path. Ids used to be the bare name slug, so
		// a returning player whose row had gone undecodable was told "no save, try
		// New Game" (safeGet reports absent and corrupt identically), typed the
		// same name, landed on the SAME id, and the collision check — also a
		// safeGet — saw nothing and let the fresh save overwrite them. House back
		// to a tent, inventory empty, world untouched in the other tables. A random
		// id cannot land on an existing row, so that sequence is impossible now.
		//
		// existsRaw backs up safeGet here for the same reason: a row that is on
		// disk but unreadable still occupies its id.
		const base = slugId(cleanName) || 'caretaker';
		const t = db();
		let playerId: string;
		do {
			playerId = `${base}-${Math.random().toString(36).slice(2, 8)}`;
		} while ((await safeGet(t.Player, playerId)) || existsRaw(t.Player, playerId));

		// Client reports how long the player spent in the character creator (ms),
		// clamped to a sane range so a bad clock can't skew the average.
		const cms = clamp(Math.round(Number(creationMs) || 0), 0, 60 * 60_000);
		const created = await createPlayerRecords(
			playerId,
			cleanName,
			code,
			sanitizeAppearance(appearance),
			sanitizeTzOffset(tzOffsetMinutes),
			cms,
			ed,
		);
		await indexPlayerName(cleanName, playerId);
		// Per-save setup must never block starting a save — if it throws, the save
		// still works and the next login retries it.
		try {
			await ensureSoloWorld(created.player, { freshGrid: true });
		} catch (e) {
			console.error('save setup skipped (CreatePlayer):', e);
		}
		// COMPAT: `worldId` and `worlds` are dead fields a 0.2.x client still reads.
		return { ok: true, playerId, worldId: playerId, worlds: [], state: await freshSnapshot(created) };
	}
}

/**
 * POST /DeletePlayer/ {name, passcode} — permanently delete a save and every
 * record that belongs to it. Passcode required so nobody can wipe your preserve.
 */
/**
 * Name-slug -> save ids. Exists for one reason: salvageRecord only runs on a
 * POINT READ by id (safeGet), and since ids stopped being the bare name slug a
 * login had no id to point at. A scan can't stand in — toArray drops rows it
 * cannot decode, and a dropped row carries no id — so an undecodable save became
 * unreachable and unhealable. This keeps the ids reachable.
 *
 * Best-effort throughout: a missing or unreadable index must never block a login
 * or a save creation, because the name scan below still finds healthy rows.
 */
async function indexPlayerName(name: string, playerId: string): Promise<void> {
	try {
		const t = db() as any;
		if (!t.PlayerNameIndex) return;
		const id = slugId(String(name || ''));
		if (!id) return;
		const row = (await safeGet(t.PlayerNameIndex, id)) || { id, playerIds: [] };
		const ids: string[] = Array.isArray(row.playerIds) ? row.playerIds : [];
		if (ids.includes(playerId)) return;
		// Append, then trim from the FRONT. The array is append-ordered, login reads
		// it newest-first, and the row is rewritten whole on every append — so an
		// uncapped array is both O(N²) to build and unbounded to read. Dropping the
		// oldest ids keeps the row a fixed size without ever evicting the entries a
		// login is most likely to want.
		const next = [...ids, playerId];
		const trimmed = next.length > PLAYER_NAME_INDEX_MAX ? next.slice(next.length - PLAYER_NAME_INDEX_MAX) : next;
		await t.PlayerNameIndex.put({ ...row, id, playerIds: trimmed });
	} catch (e: any) {
		console.error('player name index write failed —', e?.message || e);
	}
}

async function unindexPlayerName(name: string, playerId: string): Promise<void> {
	try {
		const t = db() as any;
		if (!t.PlayerNameIndex) return;
		const id = slugId(String(name || ''));
		if (!id) return;
		const row = await safeGet(t.PlayerNameIndex, id);
		if (!row || !Array.isArray(row.playerIds)) return;
		await t.PlayerNameIndex.put({ ...row, playerIds: row.playerIds.filter((p: string) => p !== playerId) });
	} catch (e: any) {
		console.error('player name index cleanup failed —', e?.message || e);
	}
}

/** Ids recorded under a name slug. Empty when the index is absent/unreadable. */
/**
 * Ids indexed under a name, or NULL when the name has never been indexed.
 *
 * The distinction is load-bearing. An empty array means "we have looked, and
 * nothing uses this name"; null means "we have never looked". Only the second
 * justifies the unbounded scan in resolveByNameAndPasscode — without the
 * difference, every login attempt for a name that does not exist re-ran that
 * scan, which is exactly the request an attacker repeats.
 */
async function indexedIdsFor(name: string): Promise<string[] | null> {
	try {
		const t = db() as any;
		if (!t.PlayerNameIndex) return null;
		const id = slugId(String(name || ''));
		if (!id) return null;
		const row = await safeGet(t.PlayerNameIndex, id);
		if (!row) return null;
		return Array.isArray(row.playerIds) ? row.playerIds : [];
	} catch {
		return null;
	}
}

/** Record that a name has been looked up, even when nothing was found under it,
 *  so the scan behind it happens at most once per name. */
async function markNameIndexed(name: string, ids: string[]): Promise<void> {
	try {
		const t = db() as any;
		if (!t.PlayerNameIndex) return;
		const id = slugId(String(name || ''));
		if (!id) return;
		if (await safeGet(t.PlayerNameIndex, id)) return; // known already; indexPlayerName owns updates
		await t.PlayerNameIndex.put({ id, playerIds: ids.slice(0, PLAYER_NAME_INDEX_MAX) });
	} catch (e: any) {
		console.error('player name index mark failed —', e?.message || e);
	}
}

/**
 * Resolve the save behind a typed caretaker name + passcode.
 *
 * Player ids used to BE the name slug, so every "log me in / delete my save"
 * endpoint just rebuilt the id from the name. Ids are unique per save now (names
 * are a label, and two saves may share one), so the id can no longer be derived
 * — we try the legacy slug first for saves created before the change, then fall
 * back to every player carrying that name and let the passcode pick.
 *
 * `nameSeen` keeps the old 404-vs-403 split: no save by that name at all, versus
 * a save whose passcode did not match.
 */
/**
 * How many same-name saves one login attempt will run scrypt against.
 *
 * Applies to BOTH candidate sources — the name index and the legacy scan — because
 * the expensive path is the indexed one and capping only the other achieved
 * nothing. Well above any plausible number of real saves sharing an exact name;
 * past it, the oldest same-name saves are not reachable by name login, which is
 * the deliberate trade against letting one request own the event loop.
 */
const LOGIN_SCAN_CANDIDATE_MAX = 12;

/**
 * Wall-clock ceiling on passcode hashing for one login attempt.
 *
 * The count cap is a proxy; this bounds the thing that actually hurts. scryptSync
 * is ~36 ms and blocks the whole node, so this is roughly a dozen checks — and it
 * holds even if scrypt gets slower, the box is loaded, or the parameters change,
 * none of which a count cap would notice.
 */
const LOGIN_HASH_BUDGET_MS = 500;

/**
 * How many ids one PlayerNameIndex row will hold.
 *
 * The row is rewritten whole on every append, so an uncapped array is O(N²) write
 * bytes to build and an unbounded read on every login for that name. Kept far
 * above LOGIN_SCAN_CANDIDATE_MAX so the index is never the thing that decides
 * which saves are reachable — the hash cap is, and it is the one documented as
 * making that trade.
 */
const PLAYER_NAME_INDEX_MAX = 200;

async function resolveByNameAndPasscode(
	name: any,
	passcode: any,
): Promise<{ player: any | null; nameSeen: boolean; unreadable?: boolean }> {
	const wanted = String(name || '')
		.trim()
		.toLowerCase();
	if (!wanted) return { player: null, nameSeen: false, unreadable: false };
	const slug = slugId(String(name || ''));
	const legacy = slug ? await safeGet(db().Player, slug) : null;
	if (legacy && (await verifyPasscode(legacy, passcode))) return { player: legacy, nameSeen: true };
	// Point-read each indexed id BEFORE falling back to a scan. safeGet salvages
	// an undecodable row here; the scan below never can, so this ordering is what
	// keeps a corrupt save recoverable.
	//
	// THE HASHING IS CAPPED HERE, and this loop is the one that needed it. An
	// earlier attempt capped only the fallback scan below, which is the branch that
	// cannot be reached once a name is indexed — so the guard sat on the cheap path
	// while the expensive one ran unbounded. `verifyPasscode` is scryptSync:
	// ~36 ms and SYNCHRONOUS, so it blocks every other request on the node, not
	// just this one. Uncapped, that is 36 ms x however many saves share the name —
	// and since CreatePlayer is public and same-name saves are deliberately
	// allowed, the caller can grow that number themselves. 1,000 saves named
	// "willow" turned one ~60-byte POST into ~36 seconds of dead server.
	//
	// Newest first: someone actively logging in is far likelier to be on a recent
	// save than on the oldest row that ever used the name.
	let indexSeen = false;
	let unreadable = false;
	const indexedIds = await indexedIdsFor(name);
	const hashOrder = (indexedIds ?? []).slice().reverse();
	if (hashOrder.length > LOGIN_SCAN_CANDIDATE_MAX) {
		console.error(
			`login for "${wanted}": ${hashOrder.length} indexed saves share this name, checking the ${LOGIN_SCAN_CANDIDATE_MAX} most recent`,
		);
	}
	const deadline = Date.now() + LOGIN_HASH_BUDGET_MS;
	let hashed = 0;
	for (const pid of hashOrder) {
		const p = await safeGet(db().Player, pid);
		if (!p) {
			// Nothing decoded, but the bytes are on disk: this save exists and we
			// could not open it. Telling the player "no save — try New Game" here is
			// both false and the worst possible advice.
			if (existsRaw(db().Player, pid)) unreadable = true;
			continue;
		}
		indexSeen = true;
		// Two independent bounds. The count cap is the predictable one; the wall-clock
		// budget is the one that actually bounds the harm, because it is measured in
		// the units that hurt (blocked event loop) rather than in a proxy for them.
		// Whichever trips first wins.
		if (hashed >= LOGIN_SCAN_CANDIDATE_MAX || Date.now() > deadline) {
			console.error(`login for "${wanted}": passcode check truncated after ${hashed} candidate(s)`);
			break;
		}
		hashed++;
		if (await verifyPasscode(p, passcode)) return { player: p, nameSeen: true };
	}
	// Last-resort scan for a save the name index never learned about — a save from
	// before the index existed. Reached only when the name is in no index row at
	// all, which after the back-fill below happens at most ONCE per name for the
	// lifetime of the database.
	//
	// That back-fill is the point. This scan is the only unbounded read on the
	// login path and it is reached precisely when a login FAILS, so leaving it
	// repeatable would mean an unauthenticated caller could re-trigger a full
	// Player scan by POSTing an unknown name over and over. Writing what it finds
	// into PlayerNameIndex means the second attempt for that name takes the bounded
	// path above instead. Deleting the scan outright would be simpler and is
	// tempting, but it is what still finds a legacy save, and locking someone out
	// of their world is worse than one scan.
	//
	// Gated on the index row being ABSENT, not on the lookup returning nothing. A
	// name nobody uses gets an empty row written below, so a second attempt with
	// the same made-up name takes the cheap path — otherwise repeating it re-ran a
	// full Player scan every time, which is the request worth repeating.
	let candidates: any[] = [];
	if (indexedIds === null) {
		candidates = (await allOf(db().Player)).filter(
			(p: any) =>
				String(p?.name || '')
					.trim()
					.toLowerCase() === wanted,
		);
		// Heal the index before hashing, so this name never needs the scan again —
		// including when the passcode is wrong, which is the case an attacker repeats.
		if (candidates.length) {
			for (const c of candidates) if (c?.id) await indexPlayerName(String(c.name || name), c.id);
		} else {
			await markNameIndexed(name, []);
		}
		const ordered = candidates
			.slice()
			.sort((a: any, b: any) => (b?.createdAt || 0) - (a?.createdAt || 0))
			.slice(0, LOGIN_SCAN_CANDIDATE_MAX);
		if (candidates.length > ordered.length) {
			console.error(
				`login scan for "${wanted}": ${candidates.length} name matches, hashing the ${ordered.length} most recent`,
			);
		}
		for (const c of ordered) {
			if (Date.now() > deadline) {
				console.error(`login scan for "${wanted}": passcode check truncated on the time budget`);
				break;
			}
			if (await verifyPasscode(c, passcode)) return { player: c, nameSeen: true };
		}
	}
	if (slug && !legacy && existsRaw(db().Player, slug)) unreadable = true;
	return { player: null, nameSeen: !!legacy || indexSeen || candidates.length > 0, unreadable };
}

export class DeletePlayer extends PublicEndpoint {
	static rateTier = 'auth'; // scrypt runs on this path
	async post(data: any) {
		const { name, passcode } = await bodyOf(data, this);
		const found = await resolveByNameAndPasscode(name, passcode);
		if (!found.player) {
			if (found.unreadable) throw new GameError(tr('server.err.saveUnreadable'), 409, 'server.err.saveUnreadable');
			if (found.nameSeen) throw new GameError(tr('server.err.passcodeMismatch'), 403, 'server.err.passcodeMismatch');
			throw new GameError(tr('server.err.noSaveWithName'), 404, 'server.err.noSaveWithName');
		}
		const player = found.player;
		const playerId = player.id;

		const t = db();
		let removed = 0;
		// Delete the player's own solo world (id === playerId) and personal records.
		// Rows under a world id that is not their own are left intact.
		for (const table of [t.Placement, t.Chest, t.BiomeState, t.Discovery, t.NodeState, t.TerrainTile, t.FeedEntry]) {
			for (const rec of await byWorld(table, playerId)) {
				await table.delete(rec.id);
				removed++;
			}
		}
		for (const rec of await byPlayer(t.PlayerAchievement, playerId)) {
			await t.PlayerAchievement.delete(rec.id);
			removed++;
		}
		// Deleting the save is the one place a still-undecodable row must not be
		// left behind, so fall back to forceRemove (stub-then-delete) when the row
		// exists on disk but neither salvage nor a plain delete can touch it.
		if (existsRaw(t.Player, playerId)) await forceRemove(t.Player, playerId);
		await t.Player.delete(playerId);
		await unindexPlayerName(player.name, playerId);
		return { ok: true, deleted: playerId, recordsRemoved: removed + 1 };
	}
}

/**
 * POST /DeleteDemoSave/ {playerId} — passcode-free deletion, used ONLY by the
 * browser demo's hard-stop so a finished demo caretaker can't just log back in.
 * Guarded: it refuses unless the save is tagged edition:'demo' in its metrics,
 * so it can never wipe a real (paid) save even if the id is known. Idempotent —
 * an already-gone save returns ok.
 */
export class DeleteDemoSave extends PublicEndpoint {
	static rateTier = 'auth'; // scrypt runs on this path
	async post(data: any) {
		const { playerId } = await bodyOf(data, this);
		const id = slugId(String(playerId || ''));
		const t = db();
		const player = id ? await safeGet(t.Player, id) : null;
		if (!player) return { ok: true, deleted: null }; // already gone / never existed
		if (readMetrics(player)?.edition !== 'demo')
			throw new GameError(tr('server.err.notDemoSave'), 403, 'server.err.notDemoSave');

		let removed = 0;
		for (const table of [t.Placement, t.Chest, t.BiomeState, t.Discovery, t.NodeState, t.TerrainTile, t.FeedEntry]) {
			for (const rec of await byWorld(table, id)) {
				await table.delete(rec.id);
				removed++;
			}
		}
		for (const rec of await byPlayer(t.PlayerAchievement, id)) {
			await t.PlayerAchievement.delete(rec.id);
			removed++;
		}
		await t.Player.delete(id);
		await unindexPlayerName(player?.name, id);
		return { ok: true, deleted: id, recordsRemoved: removed + 1 };
	}
}

/**
 * POST /ExportDemoSave/ {playerId} — dump a demo save's world in the exact shape
 * the offline solo backend serializes ({ meta, data } where data is the dynamic
 * tables), so a demo player can download it and import it into the full
 * downloadable game. Guarded like DeleteDemoSave: only edition:'demo' saves,
 * passcode-free. The client encrypts the result into the standard save envelope.
 */
export class ExportDemoSave extends PublicEndpoint {
	static rateTier = 'auth'; // scrypt runs on this path
	async post(data: any) {
		const { playerId } = await bodyOf(data, this);
		const id = slugId(String(playerId || ''));
		if (!id) throw new GameError(tr('server.err.noSaveWithName'), 404, 'server.err.noSaveWithName');

		// The WHOLE snapshot is taken under the player's lock, reads included.
		//
		// This endpoint reads nine tables one after another, and without the lock
		// there is nothing stopping a gameplay request landing in the middle of that
		// — the client does not serialize its fetches. Worse, withPlayerLock BUFFERS
		// Player patches and only writes them out as the lock releases, so a
		// half-overlapped action is visible in exactly the wrong order: PlaceObject
		// decrements `craftedItems` inside the lock and writes the Placement row
		// immediately, so an export threading between them captures a Player who
		// still owns the brush pile AND a Placement of the brush pile already in the
		// ground. Import that save into the full game and the item has been
		// duplicated.
		//
		// Taking the lock costs a moment of waiting on a button press the player
		// makes once, and buys a snapshot that is consistent with itself — which is
		// the entire point of a save they are carrying between games.
		return withPlayerLock(id, async () => {
			const t = db();
			const player = await safeGet(t.Player, id);
			if (!player) throw new GameError(tr('server.err.noSaveWithName'), 404, 'server.err.noSaveWithName');
			if (readMetrics(player)?.edition !== 'demo')
				throw new GameError(tr('server.err.notDemoSave'), 403, 'server.err.notDemoSave');

			const wid = worldOf(player);
			// Reset edition to 'full' on the exported copy: the player is carrying this
			// into the paid game, so it should report as a full-game save (Heartbeat
			// keeps 'demo' sticky otherwise).
			//
			// Flipping that flag used to be ALL this did, which erased the most
			// interesting thing that had ever happened to the save: after import it was
			// indistinguishable from one that started in the full game, so "played the
			// demo, liked it, bought it, carried their meadow across" — the single
			// clearest signal the demo is doing its job — left no trace anywhere. Stamp
			// the milestone and freeze how far they had got, so the save can report it
			// about itself from then on.
			const prevMetrics = readMetrics(player) || {};
			const atExport = metricsView(player);
			const exportedPlayer = {
				...player,
				metrics: encodeMetrics({
					...prevMetrics,
					edition: 'full',
					convertedFromDemoAt: Date.now(),
					demoPlaySeconds: atExport.playSeconds,
					demoSessions: atExport.sessions,
					demoActions: atExport.totalActions,
				}),
			};

			const save = {
				meta: {
					playerId: id,
					name: player.name || 'Caretaker',
					appearance: player.appearance || {},
					createdAt: player.createdAt || Date.now(),
					updatedAt: Date.now(),
				},
				// Keys mirror src/solo/localDb.ts DYNAMIC_TABLES so loadSoloGame hydrates
				// cleanly.
				data: {
					Player: [exportedPlayer],
					PlayerAchievement: await byPlayer(t.PlayerAchievement, id),
					BiomeState: await byWorld(t.BiomeState, wid),
					Chest: await byWorld(t.Chest, wid),
					Placement: await byWorld(t.Placement, wid),
					Discovery: await byWorld(t.Discovery, wid),
					NodeState: await byWorld(t.NodeState, wid),
					TerrainTile: await byWorld(t.TerrainTile, wid),
					FeedEntry: await byWorld(t.FeedEntry, wid),
				},
			};
			return { ok: true, ...save };
		});
	}
}

/**
 * POST /ChangePasscode/ {playerId, currentPasscode, newPasscode} — change the
 * passcode while logged in. The current passcode must match before a new one
 * (re-hashed with a fresh salt) is stored.
 */
export class ChangePasscode extends PublicEndpoint {
	static rateTier = 'auth'; // scrypt runs on this path
	async post(data: any) {
		const { playerId, currentPasscode, newPasscode } = await bodyOf(data, this);
		const { player } = await requirePlayer(playerId);
		if (!(await verifyPasscode(player, currentPasscode)))
			throw new GameError(tr('server.err.passcodeMismatch'), 403, 'server.err.passcodeMismatch');
		const next = String(newPasscode || '');
		if (next.length < 4 || next.length > 32)
			throw new GameError(tr('server.err.newPasscodeLength'), 400, 'server.err.newPasscodeLength');
		const { salt, hash } = hashPasscode(next);
		await patchPlayer(playerId, { passcodeHash: hash, passcodeSalt: salt, passcode: null });
		return { ok: true };
	}
}

/** POST /LoginPlayer/ {name, passcode} — load an existing save. */
export class LoginPlayer extends PublicEndpoint {
	static rateTier = 'auth'; // scrypt runs on this path
	async post(data: any) {
		const { name, passcode, tzOffsetMinutes } = await bodyOf(data, this);
		const found = await resolveByNameAndPasscode(name, passcode);
		if (!found.player) {
			// 409, not 404: the save is on disk and unreadable. A 404 sends the player
			// to New Game, which is exactly what must not happen here.
			if (found.unreadable) throw new GameError(tr('server.err.saveUnreadable'), 409, 'server.err.saveUnreadable');
			if (found.nameSeen) throw new GameError(tr('server.err.passcodeMismatch'), 403, 'server.err.passcodeMismatch');
			throw new GameError(tr('server.err.noSaveTryNew'), 404, 'server.err.noSaveTryNew');
		}
		const player = found.player;
		const d = await defs();
		// Reset the heartbeat clock so the first beat after login is counted as a
		// fresh play session (and back-fill metrics for saves made before tracking).
		// lastSeenAt is deliberately NOT bumped here — the first heartbeat reads it
		// to measure the absence for the welcome-back growth summary, then updates it.
		const now = Date.now();
		const playerId = player.id;
		const prev = readMetrics(player) || freshMetrics(player.createdAt || now);
		await patchPlayer(playerId, {
			metrics: encodeMetrics({ ...prev, lastHeartbeatAt: 0 }),
			...(tzOffsetMinutes != null ? { tzOffsetMinutes: sanitizeTzOffset(tzOffsetMinutes) } : {}),
		});
		// Back-fill the solo "world of one" for saves made before multiplayer (this
		// also realigns the meadow to the current camp offset), then resume whichever
		// world this player was last active in (their solo world by default, or any
		// other world id their row still points at).
		// Guarded so a not-yet-migrated instance still logs you in (solo) rather than erroring.
		let active = player.worldId || playerId;
		try {
			await ensureSoloWorld(player);
			active = (await safeGet(db().Player, playerId))?.worldId || playerId;
			await repairSave(active, playerId, d, { force: true });
		} catch (e) {
			console.error('world setup skipped (LoginPlayer):', e);
		}
		// On login, start back out in the meadow rather than loading straight into an
		// interior or a no-longer-explorable area. Done AFTER the meadow realignment
		// above so a returning player lands on the current spawn, never a shifted one.
		const areaBiome = d.biome.get(player.area);
		if (player.area === 'home' || !areaBiome || !areaBiome.explorable) {
			await patchPlayer(playerId, { area: 'meadow', x: 24.5, y: 6.5 });
		}
		// COMPAT: `worldId` and `worlds` are dead fields a 0.2.x client still reads.
		return { ok: true, playerId, worldId: active, worlds: [], state: await snapshot(playerId) };
	}
}

/** GET /GameState/<playerId> — create-or-load the player and return everything.
 *
 * Compressed and revalidatable on the HTTP path — see snapshotResponse for what
 * the ETag is and why it is safe. IMPORTANT, same contract as GameData: with no
 * request context this returns the PLAIN OBJECT. That path is the in-app solo
 * backend (src/solo/backend.ts), which uses the return value as the data and runs
 * in a browser where node:zlib is a no-op shim — and it is also how the
 * integration harness calls this endpoint.
 */
export class GameState extends PublicEndpoint {
	async get() {
		// No body on a GET, so this is charged here rather than through bodyOf.
		rateLimit(this, 'read');
		const playerId = String(this.getId() || '');
		await requirePlayer(playerId);
		// note: GET handlers must not write — invalid areas are normalized in snapshot()
		const state = await snapshot(playerId);
		const reqHeaders: any = (this.getContext?.() as any)?.headers;
		if (!reqHeaders || typeof reqHeaders.get !== 'function') return state;
		return snapshotResponse(reqHeaders, state);
	}
}

/**
 * COMPAT: `MyWorlds` serves clients this build no longer ships.
 *
 * The current client does not call it. Older shipped builds do, and they call it
 * UNGATED on three core paths (startNewSolo, resumeSolo, continueLast). In
 * continueLast the catch rethrows, and `isMissingSaveError` is `status === 404`,
 * so removing the endpoint would not just break their Continue button — it would
 * call `forgetSave()` and drop the player's save pointer. The solo backend
 * returns 404 for an unknown endpoint too, so desktop would break the same way.
 *
 * So it stays, answering the only shape those clients read: one world, which is
 * the player themselves. SAFE TO DELETE once /MetricsSummary/ shows no clients
 * below 0.3.0 for 30 days — check that before removing it, not after.
 */
export class MyWorlds extends PublicEndpoint {
	async post(data: any) {
		const { playerId } = await bodyOf(data, this);
		const { player } = await requirePlayer(playerId);
		await ensureSoloWorld(player);
		return { ok: true, activeWorldId: player.id, worlds: [] };
	}
}

/** POST /CollectResource/ {playerId, biomeId, nodeId, resourceId, alsoNodeIds?} */
export class CollectResource extends PublicEndpoint {
	async post(data: any) {
		const { playerId, biomeId, nodeId, resourceId, alsoNodeIds } = await bodyOf(data, this);
		return withPlayerLock(playerId, async () => {
			const t = db();
			const d = await defs();
			const { player } = await requirePlayer(playerId);
			const wid = worldOf(player);

			const biome = d.biome.get(biomeId);
			if (!biome)
				throw new GameError(tr('server.err.unknownBiome', { biome: biomeId }), 400, 'server.err.unknownBiome');
			if (!(player.unlockedBiomes || []).includes(biomeId))
				throw new GameError(tr('server.err.biomeLocked', { biome: biome.name }), 403, 'server.err.biomeLocked');
			const resDef = d.resource.get(resourceId);
			if (!resDef)
				throw new GameError(
					tr('server.err.unknownResource', { resource: resourceId }),
					400,
					'server.err.unknownResource',
				);
			// Weather-gated resources sidestep the biome resource list, but the matching
			// weather must actually be active in this biome right now (recomputed from the
			// same deterministic function the client used to spawn the node).
			if (isWeatherGatheredResource(resourceId)) {
				// Weather-gated: the resource must be the one this biome's weather yields,
				// recomputed here rather than trusted from the client.
				//
				// The catch is that the two sides SAMPLE the same deterministic function from
				// clocks that tick differently. The client's advances smoothly on wall time, so
				// it crosses a weather boundary the moment it happens and immediately draws the
				// node. This one runs off accrued play time, which only moves in 30s heartbeat
				// steps (and trails further after a hidden tab, capped at MAX_BEAT_MS). So for
				// up to a beat after rain starts, the player is standing in visible rain beside
				// a rainwater node and getting told it "only appears in certain weather".
				//
				// Being strict here protects nothing: weather is deterministic and public, a
				// block is 12 minutes wide, and the grace can only ever admit a resource the
				// player is about to be — or just was — legitimately able to gather. So accept
				// the gather if it matches anywhere in the window the clocks can disagree over.
				// Sampling the two edges as well as the middle is enough because the grace is
				// far smaller than a block, so any boundary inside it falls between two samples.
				//
				// A dev weather override has to gate the same way, for the same reason. It is
				// stored on the player and forces the type for EVERY biome in the snapshot
				// (see weatherSnapshot), which is what the client draws its sky and its gather
				// nodes from. Recomputing the live sky here instead meant "set weather: rain"
				// produced falling rain and rainwater nodes that then refused to be picked up —
				// the override was honored everywhere except the one check that mattered.
				const forced = player?.devWeather?.type || null;
				const base = weatherTimeFromPlay(player);
				const matches = forced
					? gatherResourceIdFor(biomeId, forced) === resourceId
					: [base - MAX_BEAT_MS, base, base + MAX_BEAT_MS].some(
							(at) => gatherResourceIdFor(biomeId, weatherTypeAt(wid, biomeId, Math.max(0, at))) === resourceId,
						);
				if (!matches) {
					throw new GameError(tr('server.err.weatherOnly', { resource: resDef.name }), 409, 'server.err.weatherOnly');
				}
			} else if (!(biome.resources || []).includes(resourceId)) {
				throw new GameError(
					tr('server.err.resourceNotInBiome', { resource: resourceId, biome: biome.name }),
					400,
					'server.err.resourceNotInBiome',
				);
			}
			// Shape-check, not just presence. This string goes straight into a primary
			// key (`${wid}:${biomeId}:${nodeId}`) and the row is never deleted, so an
			// unvalidated value is a client-controlled, permanent key in this world's
			// range — the same hazard the menu-metrics allowlist exists to prevent
			// ("the key space of a stored map should never be whatever a client decides
			// to send"), except here it also inflates every byWorld(NodeState) read the
			// snapshot makes, forever. computeNodes mints `n0…nN`, so the real client
			// is comfortably inside this; a colon is excluded outright because it is
			// the key delimiter the whole scoping contract rests on.
			if (!nodeId || typeof nodeId !== 'string' || !/^[A-Za-z0-9_-]{1,32}$/.test(nodeId))
				throw new GameError(tr('server.err.nodeIdRequired'), 400, 'server.err.nodeIdRequired');

			const now = Date.now();
			const basketTier = player.tools?.basket || 1;

			// A dipping pail (CAN_DIP_TIER) fills straight from open water the caretaker
			// shaped, instead of walking back to a spring — so the wetland restored three
			// biomes ago quietly becomes infrastructure. The spot IS the tile, addressed
			// as `dip-<x>-<y>`, and it carries no regrow cooldown and writes no
			// NodeState: your own pond does not run dry, and it is not a spawn to share.
			const dip = /^dip-(\d+)-(\d+)$/.exec(nodeId);
			if (dip) {
				if (resDef.tool !== 'watering-can')
					throw new GameError(tr('server.err.nodeIdRequired'), 400, 'server.err.nodeIdRequired');
				if ((player.tools?.['watering-can'] || 1) < CAN_DIP_TIER)
					throw new GameError(tr('server.err.needDippingPail'), 403, 'server.err.needDippingPail');
				const shaped = await byArea(t.TerrainTile, wid, biomeId);
				const open = shaped.some(
					(tt: any) => tt.x === Number(dip[1]) && tt.y === Number(dip[2]) && tt.type === 'water',
				);
				if (!open) throw new GameError(tr('server.err.noOpenWaterHere'), 400, 'server.err.noOpenWaterHere');
			}

			// Which spots this pass takes. A basket at BASKET_SWEEP_TIER clears a whole
			// patch in one action, so the client sends the neighbouring same-resource
			// spots alongside the one that was clicked. Every lower tier takes just the
			// one, and an extra that is malformed or still regrowing is dropped rather
			// than failing the gather the player actually asked for.
			const wanted = [nodeId];
			if (basketTier >= BASKET_SWEEP_TIER && Array.isArray(alsoNodeIds)) {
				for (const id of alsoNodeIds) {
					if (wanted.length >= MAX_SWEEP_NODES) break;
					if (typeof id === 'string' && /^[A-Za-z0-9_-]{1,32}$/.test(id) && !wanted.includes(id)) wanted.push(id);
				}
			}

			// node regeneration cooldown — shared across the world so two players can't
			// both drain the same spot
			const ready: string[] = [];
			for (const id of wanted) {
				if (dip) {
					ready.push(id); // open water you shaped has no cooldown
					continue;
				}
				const st = await t.NodeState.get(`${wid}:${biomeId}:${id}`);
				if (st && now - st.harvestedAt < NODE_REGEN_SECONDS * 1000) continue;
				ready.push(id);
			}
			// The clicked spot is the one the player asked for: if THAT is regrowing the
			// gather is refused exactly as it was before sweeping existed.
			if (!ready.includes(nodeId)) throw new GameError(tr('server.err.regrowing'), 409, 'server.err.regrowing');

			const inventory = { ...(player.inventory || {}) };
			// Carrying capacity, counted in weight rather than item count: bulk earth and
			// stone fill the basket twice as fast as a handful of seeds does. Below
			// BASKET_OVERFLOW_TIER a full basket still refuses the gather outright.
			if (roomFor(resourceId, inventory, d, player) <= 0 && basketTier < BASKET_OVERFLOW_TIER)
				throw new GameError(tr('server.err.basketFullStore'), 409, 'server.err.basketFullStore');

			// a higher-tier tool gathers more at once (tier 1→1 … tier 7→7)
			const toolTier = Math.max(1, player.tools?.[resDef.tool] || 1);
			// House perk (Log Cabin — forager's instinct): a chance to spot one extra
			// material on every gather. The chance grows with every home upgrade.
			const perk = homePerk(player);
			const perkBonus = perk?.id === 'forage' && Math.random() < perk.strength ? 1 : 0;
			const picked = toolTier * ready.length + perkBonus;

			const toBasket = Math.min(picked, roomFor(resourceId, inventory, d, player));
			if (toBasket > 0) inventory[resourceId] = (inventory[resourceId] || 0) + toBasket;

			// What will not fit rides on to your nearest chest in this area instead of
			// the haul being cut short — never being turned away is the whole of what a
			// BASKET_OVERFLOW_TIER basket buys.
			let spare = picked - toBasket;
			const storedTo: Record<string, number> = {};
			if (spare > 0 && basketTier >= BASKET_OVERFLOW_TIER) {
				const px = typeof player.x === 'number' ? player.x : 0;
				const py = typeof player.y === 'number' ? player.y : 0;
				const near = (await byWorld(t.Chest, wid))
					.filter((c: any) => c.area === biomeId)
					.sort(
						(a: any, b: any) =>
							Math.hypot((a.x || 0) - px, (a.y || 0) - py) - Math.hypot((b.x || 0) - px, (b.y || 0) - py),
					);
				for (const c of near) {
					if (spare <= 0) break;
					const contents = { ...(c.contents || {}) };
					const put = Math.min(Math.max(0, (c.capacity || 0) - sumValues(contents)), spare);
					if (put <= 0) continue;
					contents[resourceId] = (contents[resourceId] || 0) + put;
					await t.Chest.patch(c.id, { contents });
					storedTo[c.id] = put;
					spare -= put;
				}
			}

			const total = picked - spare;
			if (total <= 0) throw new GameError(tr('server.err.basketFullStore'), 409, 'server.err.basketFullStore');

			await patchPlayer(playerId, { inventory });
			if (!dip)
				for (const id of ready)
					await t.NodeState.put({ id: `${wid}:${biomeId}:${id}`, worldId: wid, playerId, harvestedAt: now });

			// `gathered:<id>` is the LIFETIME tally for that resource, next to the
			// per-day `res:<id>` counter. The starter chain's opening goal reads it so
			// "gather 10 seeds" measures what you have gathered, not what you are still
			// holding: seeds get spent on the very next goal, and a counter that falls
			// back to 4/10 because you planted something is telling the player their
			// work was undone. META-prefixed, so it doesn't double-count against
			// resourcesCollected in the action totals.
			await bumpMetrics(
				player,
				{ resourcesCollected: total, [`gathered:${resourceId}`]: total },
				{ [`res:${resourceId}`]: total },
			);
			await awardAchievements(playerId);
			return {
				ok: true,
				gained: { [resourceId]: total },
				// Named explicitly so the client's optimistic patch knows WHICH resource
				// this pickup was, without inferring it from the gained map — that's how
				// it credits a gather-counting goal on the same frame (actionPatch.ts).
				resourceId,
				perkBonus: perkBonus || undefined,
				inventory,
				nodeId,
				// Every spot this pass cleared (just `nodeId` below the sweep tier), and
				// anything that overflowed into a chest, so the client can patch both
				// rather than refetching the world.
				harvested: ready,
				storedTo: Object.keys(storedTo).length ? storedTo : undefined,
				harvestedAt: now,
			};
		});
	}
}

/** POST /ChestTransfer/ {playerId, chestId, resourceId, qty, direction: 'deposit'|'withdraw'} */
export class ChestTransfer extends PublicEndpoint {
	async post(data: any) {
		const { playerId, chestId, resourceId, qty, direction } = await bodyOf(data, this);
		return withPlayerLock(playerId, async () => {
			const t = db();
			const d = await defs();
			const { player } = await requirePlayer(playerId);
			const wid = worldOf(player);
			const amount = posInt(qty, 'qty');
			const chest = await getOwnedChest(t, d, chestId, wid);
			if (!chest) throw new GameError(tr('server.err.chestNotFound'), 404, 'server.err.chestNotFound');

			const inventory = { ...(player.inventory || {}) };
			const contents = { ...(chest.contents || {}) };

			if (direction === 'deposit') {
				if ((inventory[resourceId] || 0) < amount)
					throw new GameError(
						tr('server.err.notEnoughInBasket', { resource: resourceId }),
						400,
						'server.err.notEnoughInBasket',
					);
				if (sumValues(contents) + amount > chest.capacity)
					throw new GameError(tr('server.err.chestFull'), 409, 'server.err.chestFull');
				inventory[resourceId] -= amount;
				if (inventory[resourceId] <= 0) delete inventory[resourceId];
				contents[resourceId] = (contents[resourceId] || 0) + amount;
			} else if (direction === 'withdraw') {
				if ((contents[resourceId] || 0) < amount)
					throw new GameError(
						tr('server.err.notEnoughInChest', { resource: resourceId }),
						400,
						'server.err.notEnoughInChest',
					);
				if (amount > roomFor(resourceId, inventory, d, player))
					throw new GameError(tr('server.err.basketFull'), 409, 'server.err.basketFull');
				contents[resourceId] -= amount;
				if (contents[resourceId] <= 0) delete contents[resourceId];
				inventory[resourceId] = (inventory[resourceId] || 0) + amount;
			} else {
				throw new GameError(tr('server.err.badDirection'), 400, 'server.err.badDirection');
			}

			await patchPlayer(playerId, { inventory });
			await t.Chest.patch(chestId, { contents });
			await bumpMetrics(player, direction === 'deposit' ? { chestDeposits: 1 } : { chestWithdrawals: 1 });
			return { ok: true, inventory, chest: { ...chest, contents } };
		});
	}
}

/**
 * POST /DiscardItem/ {playerId, kind: 'material'|'crafted', id, qty}
 * Throw away unwanted basket materials or crafted items. Validated server-side
 * (you can't discard more than you hold); discarded things are simply gone.
 */
export class DiscardItem extends PublicEndpoint {
	async post(data: any) {
		const { playerId, kind, id, qty } = await bodyOf(data, this);
		return withPlayerLock(playerId, async () => {
			const t = db();
			const { player } = await requirePlayer(playerId);
			const amount = posInt(qty, 'qty');
			if (!id || typeof id !== 'string') throw new GameError(tr('server.err.idRequired'), 400, 'server.err.idRequired');

			if (kind === 'crafted') {
				const craftedItems = { ...(player.craftedItems || {}) };
				if ((craftedItems[id] || 0) < amount)
					throw new GameError(tr('server.err.discardTooMany'), 400, 'server.err.discardTooMany');
				craftedItems[id] -= amount;
				if (craftedItems[id] <= 0) delete craftedItems[id];
				await patchPlayer(playerId, { craftedItems });
				await bumpMetrics(player, { itemsDiscarded: amount });
				return { ok: true, craftedItems };
			}

			const inventory = { ...(player.inventory || {}) };
			if ((inventory[id] || 0) < amount)
				throw new GameError(tr('server.err.discardTooMany'), 400, 'server.err.discardTooMany');
			inventory[id] -= amount;
			if (inventory[id] <= 0) delete inventory[id];
			await patchPlayer(playerId, { inventory });
			await bumpMetrics(player, { itemsDiscarded: amount });
			return { ok: true, inventory };
		});
	}
}

/** POST /CraftItem/ {playerId, recipeId} — uses inventory + all of the player's chests. */
export class CraftItem extends PublicEndpoint {
	async post(data: any) {
		const { playerId, recipeId } = await bodyOf(data, this);
		// Read-modify-write on the player row — see withPlayerLock. Without this a
		// double-click either loses one craft's output or pays for one and makes two.
		return withPlayerLock(playerId, () => this.craft(playerId, recipeId));
	}

	private async craft(playerId: string, recipeId: string) {
		const t = db();
		const d = await defs();
		const { player } = await requirePlayer(playerId);
		const wid = worldOf(player);

		const recipe = d.recipe.get(recipeId);
		if (!recipe)
			throw new GameError(tr('server.err.unknownRecipe', { recipe: recipeId }), 400, 'server.err.unknownRecipe');
		// Plantable objects can only be planted in a watered bed, never crafted.
		const outObj = d.object.get(recipe.output.itemId);
		if (outObj?.plantable) {
			throw new GameError(
				tr('server.err.plantedNotCrafted', { name: recipe.name }),
				400,
				'server.err.plantedNotCrafted',
			);
		}
		// Dev override (dev save only): skip the biome + progress gates entirely.
		// House-only furniture can't be crafted until your home's Space is upgraded.
		if (!player.devUnlockAll && outObj?.homeMin && (homeOf(player).space || 1) < outObj.homeMin) {
			throw new GameError(tr('server.err.needsProperHouse', { name: recipe.name }), 403, 'server.err.needsProperHouse');
		}
		const devUnlock = !!player.devUnlockAll;
		if (!devUnlock && recipe.unlockBiome && !(player.unlockedBiomes || []).includes(recipe.unlockBiome)) {
			throw new GameError(tr('server.err.recipeBiomeLocked'), 403, 'server.err.recipeBiomeLocked');
		}
		// Progress gate: most recipes only unlock once you've restored their biome
		// far enough (health / animals returned / a keystone animal back).
		if (!devUnlock && recipe.unlock && recipe.unlockBiome) {
			const ctx = await recipeUnlockContext(wid, recipe.unlockBiome, player, d, recipe.unlock);
			if (!recipeUnlockMet(recipe, ctx)) {
				throw new GameError(
					tr('server.err.recipeLocked', { label: recipe.unlock.label }),
					403,
					'server.err.recipeLocked',
				);
			}
		}
		if (recipe.requiresTool && (player.tools?.[recipe.requiresTool.id] || 1) < recipe.requiresTool.tier) {
			const tool = d.tool.get(recipe.requiresTool.id);
			throw new GameError(
				tr('server.err.requiresUpgradedTool', { tool: tool?.name || recipe.requiresTool.id }),
				403,
				'server.err.requiresUpgradedTool',
			);
		}
		// One-time recipes (restoration kits) can only ever be crafted once.
		if (recipe.once && (player.craftedEver?.[recipe.output.itemId] || 0) > 0) {
			throw new GameError(tr('server.err.craftOnce', { name: recipe.name }), 409, 'server.err.craftOnce');
		}

		const { usedFrom, inventory } = await consumeMaterials(player, recipe.materials || {}, wid);

		// House perk (Stone Hearth — hearthkeeper's thrift): a chance that crafting
		// hands back half of each material it consumed (rounded down, at least 1).
		// Refunds land in the basket and never overflow its capacity.
		const perk = homePerk(player);
		let refund: Record<string, number> | undefined;
		if (perk?.id === 'thrift' && Object.keys(recipe.materials || {}).length && Math.random() < perk.strength) {
			for (const [rid, q] of Object.entries(recipe.materials || {})) {
				// Room is re-read per material because the basket fills as we go and a
				// heavy material eats capacity faster than a light one.
				const back = Math.min(Math.max(1, Math.floor((q as number) / 2)), roomFor(rid, inventory, d, player));
				if (back > 0) {
					refund = refund || {};
					refund[rid] = back;
					inventory[rid] = (inventory[rid] || 0) + back;
				}
			}
		}

		const craftedItems = { ...(player.craftedItems || {}) };
		const craftedEver = { ...(player.craftedEver || {}) };
		craftedItems[recipe.output.itemId] = (craftedItems[recipe.output.itemId] || 0) + (recipe.output.qty || 1);
		craftedEver[recipe.output.itemId] = (craftedEver[recipe.output.itemId] || 0) + (recipe.output.qty || 1);
		await patchPlayer(playerId, refund ? { craftedItems, craftedEver, inventory } : { craftedItems, craftedEver });

		// crafting key items (e.g. the water restoration kit) can unlock biomes
		const unlockedBiomes = await checkUnlocks(wid, playerId, { player: { ...player, craftedItems, craftedEver } });

		const chests = await byWorld(t.Chest, wid);
		await bumpMetrics(player, { itemsCrafted: 1 }, { craft: 1 });
		await awardAchievements(playerId);
		return { ok: true, crafted: recipe.output, craftedItems, inventory, chests, usedFrom, refund, unlockedBiomes };
	}
}

/** Snap any angle to the nearest quarter-turn in [0,90,180,270]. Non-numbers → 0. */
function normRot(v: any): number {
	const n = Number(v);
	if (!Number.isFinite(n)) return 0;
	return (((Math.round(n / 90) * 90) % 360) + 360) % 360;
}

// Only things with a real orientation can be rotated — paths, fences/walls,
// bridges, and directional furniture. Trees, flowers, bushes, rocks, ponds and
// radial decor (lanterns, vases, chimes, gnomes…) always sit at 0°.
const ROTATABLE_IDS = new Set<string>([
	'wooden-fence',
	'dry-stone-wall',
	'wooden-bench',
	'hammock',
	'picnic-blanket',
	'garden-arch',
	'trail-signpost',
	'flower-cart',
	'home-bed',
	'home-sleeping-bag',
	'home-bookshelf',
	'home-armchair',
	'home-fireplace',
	'home-table',
	'home-dresser',
	'home-driftwoodshelf',
	'home-mushroomshelf',
	'home-reedmat',
	'home-peltrug',
	'home-rug',
	'home-cushions',
	'home-stool',
	'home-aquarium',
	'home-telescope',
]);
function isRotatable(def: any): boolean {
	if (!def) return false;
	if (def.rotatable === true) return true; // explicit data opt-in
	if (def.bridge) return true; // bridges span water either way
	if (/-path$/.test(def.id)) return true; // any path
	return ROTATABLE_IDS.has(def.id);
}

/** POST /PlaceObject/ {playerId, objectId, area, x, y, rotation?} — area is a biome id or 'home'. */
export class PlaceObject extends PublicEndpoint {
	async post(data: any) {
		const { playerId, objectId, area, x, y, rotation } = await bodyOf(data, this);
		return withPlayerLock(playerId, async () => {
			const t = db();
			const d = await defs();
			const { player } = await requirePlayer(playerId);
			const wid = worldOf(player);

			const def = d.object.get(objectId);
			if (!def)
				throw new GameError(tr('server.err.unknownObject', { object: objectId }), 400, 'server.err.unknownObject');
			if (def.placement === 'none')
				throw new GameError(tr('server.err.kitNotPlaceable', { name: def.name }), 400, 'server.err.kitNotPlaceable');
			if ((player.craftedItems?.[objectId] || 0) <= 0)
				throw new GameError(tr('server.err.noneCrafted', { name: def.name }), 400, 'server.err.noneCrafted');

			const tx = Math.round(Number(x));
			const ty = Math.round(Number(y));
			const grid = areaGrid(d, area);
			if (
				!Number.isFinite(tx) ||
				!Number.isFinite(ty) ||
				tx < 1 ||
				ty < 1 ||
				tx > grid.cols - 2 ||
				ty > grid.rows - 2
			) {
				throw new GameError(tr('server.err.outOfReach'), 400, 'server.err.outOfReach');
			}

			const tentBiome = tentBiomeOf(area);
			if (area === 'home') {
				// decorating your home interior — indoor or 'both' items, on the floor only
				if (def.placement === 'outdoor')
					throw new GameError(tr('server.err.outdoorOnly', { name: def.name }), 400, 'server.err.outdoorOnly');
				// some furniture needs a real house, not the starter tent
				if (def.homeMin && (homeOf(player).space || 1) < def.homeMin) {
					throw new GameError(tr('server.err.needsBiggerHome', { name: def.name }), 403, 'server.err.needsBiggerHome');
				}
				const r = homeRoom(player);
				if (tx < r.x0 || tx > r.x1 || ty < r.y0 || ty > r.y1)
					throw new GameError(tr('server.err.placeOnFloor'), 400, 'server.err.placeOnFloor');
				if (blocksDoorway(objectId, r, tx, ty))
					throw new GameError(tr('server.err.bedBlocksDoor', { name: def.name }), 400, 'server.err.bedBlocksDoor');
			} else if (tentBiome) {
				// decorating a trail-tent interior — indoor rules, tent-sized floor,
				// and only furniture that fits a tent (homeMin 1)
				const biome = d.biome.get(tentBiome);
				if (!biome) throw new GameError(tr('server.err.unknownArea', { area }), 400, 'server.err.unknownArea');
				if (!(player.unlockedBiomes || []).includes(tentBiome))
					throw new GameError(tr('server.err.biomeLocked', { biome: biome.name }), 403, 'server.err.biomeLocked');
				if (def.placement === 'outdoor')
					throw new GameError(tr('server.err.outdoorOnly', { name: def.name }), 400, 'server.err.outdoorOnly');
				if (def.homeMin && def.homeMin > 1)
					throw new GameError(tr('server.err.tentTooSmall', { name: def.name }), 403, 'server.err.tentTooSmall');
				const r = tentRoom();
				if (tx < r.x0 || tx > r.x1 || ty < r.y0 || ty > r.y1)
					throw new GameError(tr('server.err.placeOnFloor'), 400, 'server.err.placeOnFloor');
				if (blocksDoorway(objectId, r, tx, ty))
					throw new GameError(tr('server.err.bedBlocksDoor', { name: def.name }), 400, 'server.err.bedBlocksDoor');
			} else {
				const biome = d.biome.get(area);
				if (!biome) throw new GameError(tr('server.err.unknownArea', { area }), 400, 'server.err.unknownArea');
				if (!(player.unlockedBiomes || []).includes(area))
					throw new GameError(tr('server.err.biomeLocked', { biome: biome.name }), 403, 'server.err.biomeLocked');
				if (def.placement === 'indoor')
					throw new GameError(tr('server.err.indoorOnly', { name: def.name }), 400, 'server.err.indoorOnly');
				if (!(def.biomes || []).includes(area))
					throw new GameError(
						tr('server.err.wrongHabitat', { name: def.name, biome: biome.name }),
						400,
						'server.err.wrongHabitat',
					);
				// nothing builds on the open ocean — coastal land ends before the reserved ocean columns
				if (biome.oceanCols && tx >= grid.cols - biome.oceanCols)
					throw new GameError(tr('server.err.openOcean'), 409, 'server.err.openOcean');
			}
			if (def.requiresTool && (player.tools?.[def.requiresTool.id] || 1) < def.requiresTool.tier) {
				throw new GameError(
					tr('server.err.placeRequiresTool', {
						name: def.name,
						tool: d.tool.get(def.requiresTool.id)?.name || def.requiresTool.id,
					}),
					403,
					'server.err.placeRequiresTool',
				);
			}

			// Both questions below are about THIS area only, and under KEY_REV 4 the
			// area is in the key — so ask for one area's run rather than the world's
			// and filter five sixths of it away here.
			const placements = await byArea(t.Placement, wid, area);
			if (placements.some((p) => p.x === tx && p.y === ty)) {
				throw new GameError(tr('server.err.spotTaken'), 409, 'server.err.spotTaken');
			}
			// Some structures are one-per-biome (e.g. the trail tent — a single shared
			// home base in each wild biome, not a tent city). World-scoped, because
			// each tent opens into one shared interior per biome (like the home).
			if (def.onePerArea && placements.some((p) => p.objectId === objectId)) {
				throw new GameError(tr('server.err.onePerArea', { name: def.name }), 409, 'server.err.onePerArea');
			}
			// terrain/water rules only apply outdoors — interiors have no terrain
			const indoors = area === 'home' || !!tentBiome;
			const tileHere = indoors ? null : await findTerrainAt(t.TerrainTile, wid, area, tx, ty);
			if (tileHere) {
				if (tileHere.type === 'water') {
					if (!def.bridge) throw new GameError(tr('server.err.openWaterBridge'), 409, 'server.err.openWaterBridge');
				} else {
					throw new GameError(tr('server.err.bedForPlanting'), 409, 'server.err.bedForPlanting');
				}
			} else if (def.bridge && !indoors) {
				throw new GameError(tr('server.err.bridgeNeedsWater'), 409, 'server.err.bridgeNeedsWater');
			}

			const craftedItems = { ...(player.craftedItems || {}) };
			craftedItems[objectId] -= 1;
			if (craftedItems[objectId] <= 0) delete craftedItems[objectId];
			await patchPlayer(playerId, { craftedItems });

			const placementId = placementKey(wid, area, `pl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
			const placement = {
				id: placementId,
				worldId: wid,
				playerId,
				objectId,
				area,
				x: tx,
				y: ty,
				placedAt: Date.now(),
				rotation: isRotatable(def) ? normRot(rotation) : 0,
			};
			await t.Placement.put(placement);

			// A new grower can only move the soonest maturity moment EARLIER, and the
			// heartbeat skips its world-wide placement scan while that moment is still
			// ahead of now — so tell it, rather than making it re-derive the fact from
			// every row in the save twice a minute. withPendingMaturity leaves an
			// unknown unknown; see the note on it.
			{
				const at = withPendingMaturity(player.nextMaturityAt, def, placement.placedAt, Date.now());
				if (at !== undefined && at !== player.nextMaturityAt) await patchPlayer(playerId, { nextMaturityAt: at });
			}

			if (def.isChest) {
				await t.Chest.put({
					id: placementId,
					worldId: wid,
					playerId,
					area,
					x: tx,
					y: ty,
					size: objectId,
					capacity: def.chestCapacity || 60,
					contents: {},
				});
			}

			// Indoor decor (home or a tent interior) doesn't affect any biome — skip the recalc.
			if (indoors) {
				await bumpMetrics(player, { objectsPlaced: 1 }, { place: 1 });
				// Indoor decor is still something standing in the world, and a build
				// goal for a chair is finished by putting the chair in the house.
				await bumpStanding(player, { objectId, placed: 1 });
				await awardAchievements(playerId);
				return { ok: true, placement, craftedItems };
			}

			// Read the world's discoveries ONCE and lend them to both passes; the
			// recalc and the achievement sweep were each reading the same rows.
			const discoveries = await byWorld(t.Discovery, wid);
			const recalc = await recalcBiome(wid, playerId, area, {
				addPlacements: [placement],
				player: { ...player, craftedItems },
				discoveries,
			});
			await bumpMetrics(player, { objectsPlaced: 1 }, { place: 1 }); // recalcBiome counts any animal that returned
			await bumpStanding(player, { objectId, placed: 1 });
			await awardWorldAchievements(wid, playerId, {
				addDiscoveries: recalc.newAnimals,
				freshBiomeStates: [recalc.biomeState],
				discoveries,
			});
			return { ok: true, placement, craftedItems, ...recalc };
		});
	}
}

/**
 * POST /Plant/ {playerId, area, x, y, plantId}
 * Sow flowers and trees directly into a watered soil bed. The bed is consumed
 * and becomes a growing plant (a placement with a plantedAt timestamp).
 */
export class Plant extends PublicEndpoint {
	async post(data: any) {
		const { playerId } = await bodyOf(data, this);
		// Read-modify-write on the player row, exactly like CraftItem: consumeMaterials
		// checks the seed is affordable, then debits the player and any chests it drew
		// from in separate awaits. Unlocked, a double-click on "plant" could pass the
		// affordability check twice against the same inventory and plant two seeds for
		// the price of one.
		return withPlayerLock(playerId, () => this.plant(data));
	}

	private async plant(data: any) {
		const { playerId, area, x, y, plantId } = await bodyOf(data, this);
		const t = db();
		const d = await defs();
		const { player } = await requirePlayer(playerId);
		const wid = worldOf(player);

		const biome = d.biome.get(area);
		if (!biome) throw new GameError(tr('server.err.unknownArea', { area }), 400, 'server.err.unknownArea');
		if (!(player.unlockedBiomes || []).includes(area))
			throw new GameError(tr('server.err.biomeLocked', { biome: biome.name }), 403, 'server.err.biomeLocked');

		const def = d.object.get(plantId);
		if (!def || !def.plantable) throw new GameError(tr('server.err.notPlantable'), 400, 'server.err.notPlantable');
		if (!(def.biomes || []).includes(area))
			throw new GameError(
				tr('server.err.wouldNotTakeRoot', { name: def.name, biome: biome.name }),
				400,
				'server.err.wouldNotTakeRoot',
			);

		const tx = Math.round(Number(x));
		const ty = Math.round(Number(y));
		const bed = await findTerrainAt(t.TerrainTile, wid, area, tx, ty);
		if (!bed || bed.type !== 'watered') {
			throw new GameError(tr('server.err.plantIntoWatered'), 400, 'server.err.plantIntoWatered');
		}

		const { usedFrom, inventory } = await consumeMaterials(player, def.plantCost || {}, wid);

		await t.TerrainTile.delete(bed.id); // the bed becomes the plant

		// House perk (Meadow Cottage — green thumb): new plantings start partly
		// grown. Implemented by backdating the planting timestamps a fraction of
		// the grow/mature time — everything downstream (sprout gating, mature
		// habitat bonuses) already derives from these, so no extra state needed.
		const perk = homePerk(player);
		const headStart = perk?.id === 'growth' ? perk.strength : 0;
		const now = Date.now();
		const placementId = placementKey(wid, area, `pl_${now}_${Math.random().toString(36).slice(2, 8)}`);
		const placement = {
			id: placementId,
			worldId: wid,
			playerId,
			objectId: plantId,
			area,
			x: tx,
			y: ty,
			placedAt: now - Math.round(matureMs(def) * headStart),
			plantedAt: now - Math.round((def.growSeconds || 0) * 1000 * headStart),
		};
		await t.Placement.put(placement);
		// Same as PlaceObject above — and it matters more here, because planting is
		// what actually creates growers. The perk back-dates `placedAt`, so reading
		// it (rather than `now`) is what keeps a head start honest.
		{
			const at = withPendingMaturity(player.nextMaturityAt, def, placement.placedAt, now);
			if (at !== undefined && at !== player.nextMaturityAt) await patchPlayer(playerId, { nextMaturityAt: at });
		}

		const discoveries = await byWorld(t.Discovery, wid);
		const recalc = await recalcBiome(wid, playerId, area, {
			addPlacements: [placement],
			removeTerrainIds: [bed.id],
			// The bed is gone and it was watered (the guard above allows nothing
			// else), which is one number on the biome row — no rescan of the area.
			terrainChanges: [{ from: bed.type, to: null }],
			player: { ...player, inventory },
			discoveries,
		});
		await bumpMetrics(player, { plantsPlanted: 1 }, { plant: 1 }); // recalcBiome counts any animal that returned
		// A planting is both: it is standing, and it is planted. The grow goals ask
		// the second question and the build goals the first.
		await bumpStanding(player, { objectId: plantId, placed: 1, planted: 1 });
		await awardWorldAchievements(wid, playerId, {
			addDiscoveries: recalc.newAnimals,
			freshBiomeStates: [recalc.biomeState],
			discoveries,
		});
		return { ok: true, placement, inventory, usedFrom, perkGrowth: headStart || undefined, ...recalc };
	}
}

/**
 * When a yield-bearing thing is ready to harvest — mature (or, for a crafted
 * structure, placed) the first time, then `regrowSeconds` after each harvest.
 * Returns the ms timestamp it becomes ready, or null if it never yields.
 *
 * Not everything that yields is planted. A rain basin is crafted and set down,
 * and then fills on its own; it has no `plantedAt` and nothing to grow, so it is
 * ready from the moment it is standing. Weather is deliberately NOT part of this
 * — readiness is a clock, and `harvestWeather` gates the take on top of it (see
 * HarvestPlacement). Folding the sky in here would make a shower that ends
 * mid-refill look like the basin had been emptied.
 */
function harvestReadyAt(def: any, placement: any): number | null {
	const y = def?.yield;
	if (!y || !placement) return null;
	const regrowMs = (y.regrowSeconds || 60) * 1000;
	if (placement.lastHarvestAt) return placement.lastHarvestAt + regrowMs;
	if (def.plantable) return placement.plantedAt ? placement.plantedAt + (def.growSeconds || 0) * 1000 : null;
	return placement.placedAt ?? null;
}

/**
 * POST /HarvestPlacement/ {playerId, placementId} — gather a mature plant's
 * yield (berries, flowers, acorns…) without uprooting it. The plant stays and
 * regrows its yield after `regrowSeconds`, turning planting into a renewable
 * source instead of dig-up-and-replant.
 */
export class HarvestPlacement extends PublicEndpoint {
	async post(data: any) {
		const { playerId, placementId } = await bodyOf(data, this);
		return withPlayerLock(playerId, async () => {
			const t = db();
			const d = await defs();
			const { player } = await requirePlayer(playerId);
			const wid = worldOf(player);
			const now = Date.now();

			// By id, not by scanning for it: the id carries the world and the area, so
			// this is a point read with the same legacy fallback behind it that
			// RemoveObject already uses. Picking one plant used to read every
			// placement in the preserve to find it.
			const placement = await findInWorld(t.Placement, wid, placementId);
			if (!placement) throw new GameError(tr('server.err.placementNotFound'), 404, 'server.err.placementNotFound');
			const def = d.object.get(placement.objectId);
			const y = def?.yield;
			if (!y) throw new GameError(tr('server.err.notHarvestable'), 400, 'server.err.notHarvestable');
			const readyAt = harvestReadyAt(def, placement);
			if (readyAt == null || now < readyAt)
				throw new GameError(tr('server.err.notReadyYet'), 400, 'server.err.notReadyYet');

			// Some things only give up their yield under the right sky: a rain basin
			// is a stone bowl, and a stone bowl in fair weather is an empty stone bowl.
			//
			// Gated exactly like a weather-gathered resource node (see CollectResource),
			// and for the same reasons: recomputed here rather than trusted from the
			// client, a dev weather override wins outright because it is what the client
			// painted the sky from, and the accrued-play-time clock this runs on trails
			// the client's smooth one by up to a heartbeat — so a player standing in
			// visible rain is not told it isn't raining. The grace can only ever admit a
			// harvest the player was about to be, or just was, entitled to.
			const gate: string[] = def.harvestWeather || [];
			if (gate.length) {
				const forced = player?.devWeather?.type || null;
				const base = weatherTimeFromPlay(player);
				const ok = forced
					? gate.includes(forced)
					: [base - MAX_BEAT_MS, base, base + MAX_BEAT_MS].some((at) =>
							gate.includes(weatherTypeAt(wid, placement.area, Math.max(0, at))),
						);
				if (!ok) {
					throw new GameError(
						tr('server.err.harvestWeatherOnly', { name: def.name }),
						409,
						'server.err.harvestWeatherOnly',
					);
				}
			}

			// grant the yield, respecting carrying capacity
			const inventory = { ...(player.inventory || {}) };
			const take = Math.min(y.qty || 1, roomFor(y.resourceId, inventory, d, player));
			if (take <= 0) throw new GameError(tr('server.err.basketFullHarvest'), 409, 'server.err.basketFullHarvest');
			inventory[y.resourceId] = (inventory[y.resourceId] || 0) + take;

			await patchPlayer(playerId, { inventory });
			await t.Placement.patch(placementId, { lastHarvestAt: now });
			await bumpMetrics(player, { resourcesCollected: take });
			// The starter chain asks whether anything standing has been harvested. It
			// used to answer by looking for a `lastHarvestAt` among every placement in
			// the world; the stamp still goes on the placement, this is the tally of
			// how many carry one. Only the FIRST picking of a plant adds to it —
			// picking the same bush every morning is one harvested plant, not thirty —
			// which is what keeps the tally equal to the count it replaced.
			await bumpStanding(player, { harvested: placement.lastHarvestAt ? 0 : 1 });
			return {
				ok: true,
				placementId,
				gained: { [y.resourceId]: take },
				inventory,
				placement: { ...placement, lastHarvestAt: now },
			};
		});
	}
}

/** POST /UpdateAppearance/ {playerId, appearance} — restyle your caretaker anytime. */
export class UpdateAppearance extends PublicEndpoint {
	async post(data: any) {
		const { playerId, appearance } = await bodyOf(data, this);
		const { player } = await requirePlayer(playerId);
		const clean = sanitizeAppearance(appearance);
		await patchPlayer(playerId, { appearance: clean });
		await bumpMetrics(player, { appearanceChanges: 1 });
		return { ok: true, appearance: clean };
	}
}

/** POST /MoveObject/ {playerId, placementId, x, y} — relocate a placed object within its area. */
export class MoveObject extends PublicEndpoint {
	async post(data: any) {
		const { playerId, placementId, x, y, rotation } = await bodyOf(data, this);
		const t = db();
		const { player } = await requirePlayer(playerId);
		const wid = worldOf(player);

		const placement = await findInWorld(t.Placement, wid, placementId);
		if (!placement) throw new GameError(tr('server.err.placementNotFound'), 404, 'server.err.placementNotFound');
		if (placement.objectId === 'workbench')
			throw new GameError(tr('server.err.workbenchStays'), 400, 'server.err.workbenchStays');

		const dGrid = await defs();
		const grid = areaGrid(dGrid, placement.area);
		const tx = Math.round(Number(x));
		const ty = Math.round(Number(y));
		if (!Number.isFinite(tx) || !Number.isFinite(ty) || tx < 1 || ty < 1 || tx > grid.cols - 2 || ty > grid.rows - 2) {
			throw new GameError(tr('server.err.outOfReach'), 400, 'server.err.outOfReach');
		}
		// Is the destination free? That is a question about ONE area — the one the
		// object is already in, since a move cannot cross areas — so it reads that
		// area's run rather than every placement in the world.
		const here = await byArea(t.Placement, wid, placement.area);
		if (here.some((p) => p.id !== placementId && p.x === tx && p.y === ty)) {
			throw new GameError(tr('server.err.spotTaken'), 409, 'server.err.spotTaken');
		}
		const d = await defs();
		const movingDef = d.object.get(placement.objectId);
		// Same doorway rule as PlaceObject — otherwise a bed could simply be MOVED
		// into the spot it isn't allowed to be placed in.
		if (SLEEPABLE_OBJECTS.has(placement.objectId)) {
			const tentBiome = tentBiomeOf(placement.area);
			const room = placement.area === 'home' ? homeRoom(player) : tentBiome ? tentRoom() : null;
			if (room && blocksDoorway(placement.objectId, room, tx, ty)) {
				throw new GameError(
					tr('server.err.bedBlocksDoor', { name: movingDef?.name || placement.objectId }),
					400,
					'server.err.bedBlocksDoor',
				);
			}
		}
		const tileHere = await findTerrainAt(t.TerrainTile, wid, placement.area, tx, ty);
		if (tileHere) {
			if (tileHere.type === 'water') {
				if (!movingDef?.bridge)
					throw new GameError(tr('server.err.openWaterBridgeOnly'), 409, 'server.err.openWaterBridgeOnly');
			} else {
				throw new GameError(tr('server.err.bedForPlantingShort'), 409, 'server.err.bedForPlantingShort');
			}
		} else if (movingDef?.bridge) {
			throw new GameError(tr('server.err.bridgesOverWater'), 409, 'server.err.bridgesOverWater');
		}

		const patch: any = { x: tx, y: ty };
		if (rotation !== undefined && isRotatable(movingDef)) patch.rotation = normRot(rotation);
		await t.Placement.patch(placementId, patch);
		const chest = await getOwnedChest(t, d, placementId, wid);
		if (chest) await t.Chest.patch(placementId, { x: tx, y: ty }); // chests move with their contents

		await bumpMetrics(player, { objectsMoved: 1 });
		return { ok: true, placement: { ...placement, ...patch } };
	}
}

/** POST /RemoveObject/ {playerId, placementId} — returns the object to your crafted items. */
export class RemoveObject extends PublicEndpoint {
	async post(data: any) {
		const { playerId, placementId } = await bodyOf(data, this);
		return withPlayerLock(playerId, async () => {
			const t = db();
			const { player } = await requirePlayer(playerId);
			const wid = worldOf(player);

			const placement = await findInWorld(t.Placement, wid, placementId);
			if (!placement) throw new GameError(tr('server.err.placementNotFound'), 404, 'server.err.placementNotFound');
			if (placement.objectId === 'workbench') {
				throw new GameError(tr('server.err.workbenchStays'), 400, 'server.err.workbenchStays');
			}

			const chest = await findInWorld(t.Chest, wid, placementId);
			if (chest && sumValues(chest.contents) > 0) {
				throw new GameError(tr('server.err.emptyChestFirst'), 409, 'server.err.emptyChestFirst');
			}

			// A trail tent can't be packed up while furniture is still inside its
			// interior — pack up in there first (mirrors the chest-must-be-empty rule).
			if (placement.objectId === 'trail-tent') {
				const interior = `tent-${placement.area}`;
				const inside = (await byArea(t.Placement, wid, interior)).length > 0;
				if (inside) throw new GameError(tr('server.err.tentNotEmpty'), 409, 'server.err.tentNotEmpty');
			}

			// Digging up something you planted returns its materials instead of an item.
			// Refunds respect basket capacity and spill into chests — never silently
			// overflowing the basket (which used to wedge every later withdraw/gather).
			const d = await defs();
			const def = d.object.get(placement.objectId);
			let refunded: Record<string, number> | null = null;
			const craftedItems = { ...(player.craftedItems || {}) };
			const inventory = { ...(player.inventory || {}) };
			const chestUpdates = new Map<string, Record<string, number>>();
			if (def?.plantable && placement.plantedAt && Object.keys(def.plantCost || {}).length) {
				refunded = { ...def.plantCost };
				const chests = (await byWorld(t.Chest, wid)).filter((c) => c.id !== placementId);
				for (const [resId, qty] of Object.entries(refunded!)) {
					let remaining = qty as number;
					const toBasket = Math.min(remaining, roomFor(resId, inventory, d, player));
					if (toBasket > 0) {
						inventory[resId] = (inventory[resId] || 0) + toBasket;
						remaining -= toBasket;
					}
					for (const c of chests) {
						if (remaining <= 0) break;
						const contents = chestUpdates.get(c.id) || { ...(c.contents || {}) };
						const room = c.capacity - sumValues(contents);
						const toChest = Math.min(room, remaining);
						if (toChest > 0) {
							contents[resId] = (contents[resId] || 0) + toChest;
							chestUpdates.set(c.id, contents);
							remaining -= toChest;
						}
					}
					if (remaining > 0) {
						throw new GameError(tr('server.err.noRoomRefund'), 409, 'server.err.noRoomRefund');
					}
				}
			} else {
				craftedItems[placement.objectId] = (craftedItems[placement.objectId] || 0) + 1;
			}

			// all checks passed — now write
			if (chest) await t.Chest.delete(placementId);
			await t.Placement.delete(placementId);
			if (refunded) {
				await patchPlayer(playerId, { inventory });
				for (const [cid, contents] of chestUpdates) await t.Chest.patch(cid, { contents });
			} else {
				await patchPlayer(playerId, { craftedItems });
			}

			// interiors (home / tent) aren't biomes — skip recalc for their decor
			const outdoors = placement.area !== 'home' && !tentBiomeOf(placement.area);
			const discoveries = outdoors ? await byWorld(t.Discovery, wid) : undefined;
			const recalc = outdoors
				? await recalcBiome(wid, playerId, placement.area, {
						removeIds: [placementId],
						player: { ...player, craftedItems, inventory },
						discoveries,
					})
				: null;
			await bumpMetrics(player, { objectsRemoved: 1 }); // recalcBiome counts any animal that returned
			// Taking something back up is the half that makes these tallies a live
			// count rather than a lifetime one — which is what the goals they feed
			// have always been.
			await bumpStanding(player, {
				objectId: placement.objectId,
				placed: -1,
				planted: typeof placement.plantedAt === 'number' ? -1 : 0,
				// …and it takes its harvest stamp with it, exactly as it did when this
				// was a scan for one.
				harvested: typeof placement.lastHarvestAt === 'number' ? -1 : 0,
			});
			await awardWorldAchievements(
				wid,
				playerId,
				recalc ? { addDiscoveries: recalc.newAnimals, freshBiomeStates: [recalc.biomeState], discoveries } : {},
			);
			// `inventory` and the chest delta ride along so the client can patch this
			// action locally instead of refetching the whole world after it.
			//
			// Removing was the last of the build-loop verbs still on the full-refetch
			// path, and it sits directly beside placing in the tidy-up loop: pick a
			// thing up, put it down somewhere better. Placing patched; removing
			// re-downloaded every placement AND the entire terrain array, which grows
			// by a row on every dig the player has ever made.
			//
			// A DELTA rather than the whole `chests` array CraftItem returns, because
			// everything here is already in hand — no second read of the chest table
			// just to describe a change we performed ourselves. `chestPatches` covers
			// refund spill; `removedChestId` covers taking a chest away, which deletes
			// its row and is the one case where dropping a chest client-side matters.
			return {
				ok: true,
				removed: placementId,
				craftedItems,
				refunded,
				inventory,
				chestPatches: [...chestUpdates].map(([id, contents]) => ({ id, contents })),
				removedChestId: chest ? placementId : null,
				...(recalc || {}),
			};
		});
	}
}

/** POST /UpgradeTool/ {playerId, toolId} */
export class UpgradeTool extends PublicEndpoint {
	async post(data: any) {
		const { playerId, toolId } = await bodyOf(data, this);
		return withPlayerLock(playerId, async () => {
			const t = db();
			const d = await defs();
			const { player } = await requirePlayer(playerId);

			const toolDef = d.tool.get(toolId);
			if (!toolDef) throw new GameError(tr('server.err.unknownTool', { tool: toolId }), 400, 'server.err.unknownTool');
			const wid = worldOf(player);
			const currentTier = player.tools?.[toolId] || 1;
			const nextTier = (toolDef.tiers || []).find((tt: any) => tt.tier === currentTier + 1);
			if (!nextTier)
				throw new GameError(tr('server.err.toolMaxed', { tool: toolDef.name }), 400, 'server.err.toolMaxed');

			if (nextTier.requires?.biome) {
				const bs = await findBiomeState(t.BiomeState, wid, nextTier.requires.biome);
				if ((bs?.health || 0) < (nextTier.requires.minHealth || 0)) {
					const biome = d.biome.get(nextTier.requires.biome);
					throw new GameError(
						tr('server.err.restoreFirst', {
							biome: biome?.name || nextTier.requires.biome,
							health: nextTier.requires.minHealth,
						}),
						403,
						'server.err.restoreFirst',
					);
				}
			}

			const { usedFrom, inventory } = await consumeMaterials(player, nextTier.materials || {}, wid);
			const tools = { ...(player.tools || {}), [toolId]: nextTier.tier };
			await patchPlayer(playerId, { tools });

			// tool upgrades can satisfy biome unlock requirements
			const unlockedBiomes = await checkUnlocks(wid, playerId, { player: { ...player, tools } });
			const chests = await byWorld(t.Chest, wid);
			await bumpMetrics(player, { toolsUpgraded: 1 });
			await awardAchievements(playerId);
			return {
				ok: true,
				tools,
				inventory,
				chests,
				usedFrom,
				unlockedBiomes,
				upgraded: { toolId, tier: nextTier.tier, name: nextTier.name },
			};
		});
	}
}

/** POST /UpgradeHome/ {playerId, track} — level up one of the four home tracks. */
export class UpgradeHome extends PublicEndpoint {
	async post(data: any) {
		const { playerId, track } = await bodyOf(data, this);
		return withPlayerLock(playerId, async () => {
			const t = db();
			const { player } = await requirePlayer(playerId);
			const wid = worldOf(player);

			const def = HOME_TRACKS[track];
			if (!def) throw new GameError(tr('server.err.unknownHomeUpgrade'), 400, 'server.err.unknownHomeUpgrade');
			const home = homeOf(player);
			if (!home.styleLocked) throw new GameError(tr('server.err.buildStyleFirst'), 403, 'server.err.buildStyleFirst');
			const level = home[track] || 1;
			const next = def.levels[level]; // levels[level] is the (level+1)th entry
			if (!next)
				throw new GameError(
					tr('server.err.trackMaxed', { track: def.name.toLowerCase() }),
					400,
					'server.err.trackMaxed',
				);

			if (next.requires?.biome) {
				const bs = await findBiomeState(t.BiomeState, wid, next.requires.biome);
				if ((bs?.health || 0) < (next.requires.minHealth || 0)) {
					const d = await defs();
					const biome = d.biome.get(next.requires.biome);
					throw new GameError(
						tr('server.err.restoreFirst', {
							biome: biome?.name || next.requires.biome,
							health: next.requires.minHealth,
						}),
						403,
						'server.err.restoreFirst',
					);
				}
			}

			const { usedFrom, inventory } = await consumeMaterials(player, next.materials || {}, wid);
			const updated = { ...home, [track]: level + 1 };
			await patchPlayer(playerId, { home: updated });
			const chests = await byWorld(t.Chest, wid);
			await awardAchievements(playerId);
			await bumpMetrics(player, { homeUpgrades: 1 });
			return {
				ok: true,
				home: updated,
				inventory,
				chests,
				usedFrom,
				upgraded: { track, level: level + 1, name: def.name },
			};
		});
	}
}

// Objects you can sleep in/on to rest and refresh the preserve's gathering spots.
// The hammock counts wherever it hangs: it is `placement: 'both'`, so it rests you
// strung between two posts out in a biome as readily as it does indoors.
const SLEEP_OBJECTS = ['home-sleeping-bag', 'home-bed', 'hammock'];

/** POST /Rest/ {playerId} — sleep in your bed/bag to refresh every gathering spot. */
export class Rest extends PublicEndpoint {
	async post(data: any) {
		const { playerId } = await bodyOf(data, this);
		const t = db();
		const { player } = await requirePlayer(playerId);
		const wid = worldOf(player);
		// Is there anywhere to sleep? A bed is a thing standing in the world, and
		// what is standing is a tally on the player row now — so this asks the tally
		// and falls back to the scan only for a save that has none yet (see
		// bumpStanding). Resting used to read every placement in the preserve to
		// find out whether one of them was a bed.
		// A tally may let an action through, but it must never be what REFUSES one:
		// a "no" here turns a player away from their own bed, and the tally is a
		// summary of the rows rather than the rows themselves. So the yes is free
		// and the no is checked — which costs the scan only on the path where the
		// player has nowhere to sleep yet, and none where they do.
		const standing = standingOf(player);
		const tallied = standing ? SLEEP_OBJECTS.some((id) => (standing.placed[id] || 0) > 0) : false;
		const canSleep = tallied || (await byWorld(t.Placement, wid)).some((p) => SLEEP_OBJECTS.includes(p.objectId));
		if (!canSleep) {
			throw new GameError(tr('server.err.needBedToRest'), 403, 'server.err.needBedToRest');
		}
		// refresh all resources: clear node cooldowns so every gathering spot is ready
		const nodes = await byWorld(t.NodeState, wid);
		for (const n of nodes) await t.NodeState.delete(n.id);
		// Sleep through to sunrise: advance the in-game clock to the next dawn (first
		// light), not raw day-start — the day now begins mid-night, so day-start
		// would wake you at 00:00 in the dark.
		const nowT = weatherTimeFromPlay(player);
		const skip = nextDawnAt(nowT) - nowT;
		await patchPlayer(playerId, { clockOffsetMs: (player.clockOffsetMs || 0) + skip });
		await bumpMetrics(player, { restsTaken: 1 });
		return { ok: true, rested: true, refreshed: nodes.length };
	}
}

const isHexColor = (c: any) => typeof c === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(c.trim());

/** POST /SetHomeColors/ {playerId, colors:{floor?,wall?,accent?}} — recolor the home interior (paint tool, built homes only). */
export class SetHomeColors extends PublicEndpoint {
	async post(data: any) {
		const { playerId, colors } = await bodyOf(data, this);
		const t = db();
		const { player } = await requirePlayer(playerId);
		const home = homeOf(player) as any;
		if (!home.styleLocked)
			throw new GameError(tr('server.err.buildBeforeRepaint'), 403, 'server.err.buildBeforeRepaint');
		const next: Record<string, string> = { ...home.colors };
		for (const k of ['floor', 'wall', 'accent', 'rug']) {
			if (colors?.[k] && isHexColor(colors[k])) next[k] = String(colors[k]).trim().toLowerCase();
		}
		await patchPlayer(playerId, { home: { ...home, colors: next } });
		await bumpMetrics(player, { recolors: 1 });
		return { ok: true };
	}
}

/** POST /SetPlacementColor/ {playerId, placementId, color} — recolor one placed item (paint tool). */
export class SetPlacementColor extends PublicEndpoint {
	async post(data: any) {
		const { playerId, placementId, color } = await bodyOf(data, this);
		const t = db();
		const { player } = await requirePlayer(playerId);
		if (!(homeOf(player) as any).styleLocked)
			throw new GameError(tr('server.err.buildBeforeRepaintThings'), 403, 'server.err.buildBeforeRepaintThings');
		if (!isHexColor(color)) throw new GameError(tr('server.err.invalidColor'), 400, 'server.err.invalidColor');
		const placement = await findInWorld(t.Placement, worldOf(player), placementId);
		if (!placement) throw new GameError(tr('server.err.itemNotHere'), 404, 'server.err.itemNotHere');
		await t.Placement.patch(placementId, { color: String(color).trim().toLowerCase() });
		await bumpMetrics(player, { recolors: 1 });
		return { ok: true };
	}
}

/**
 * POST /SetHomeStyle/ {playerId, style} — build your home in the chosen style. This
 * is the FIRST upgrade: it costs the first house's materials, restyles the tent into
 * that style, and enlarges it (Space → 2). Only after this do the four upgrade tracks
 * open up. The style is committed once built.
 */
export class SetHomeStyle extends PublicEndpoint {
	async post(data: any) {
		const { playerId } = await bodyOf(data, this);
		// Same read-modify-write as Plant/CraftItem — this spends materials through
		// consumeMaterials. The `styleLocked` check above is itself part of the
		// race: two concurrent requests can both read an unlocked home, both pass,
		// and both pay.
		return withPlayerLock(playerId, () => this.setStyle(data));
	}

	private async setStyle(data: any) {
		const { playerId, style } = await bodyOf(data, this);
		const t = db();
		const { player } = await requirePlayer(playerId);
		const styleDef = HOME_STYLES[style];
		if (!styleDef) throw new GameError(tr('server.err.unknownHomeStyle'), 400, 'server.err.unknownHomeStyle');
		const home = homeOf(player);
		if (home.styleLocked) throw new GameError(tr('server.err.homeAlreadyBuilt'), 403, 'server.err.homeAlreadyBuilt');
		const wid = worldOf(player);

		// building costs materials unique to the chosen style, behind a shared gate
		if (styleDef.requires?.biome) {
			const bs = await findBiomeState(t.BiomeState, wid, styleDef.requires.biome);
			if ((bs?.health || 0) < (styleDef.requires.minHealth || 0)) {
				const d = await defs();
				const biome = d.biome.get(styleDef.requires.biome);
				throw new GameError(
					tr('server.err.restoreFirst', {
						biome: biome?.name || styleDef.requires.biome,
						health: styleDef.requires.minHealth,
					}),
					403,
					'server.err.restoreFirst',
				);
			}
		}
		const { usedFrom, inventory } = await consumeMaterials(player, styleDef.materials || {}, wid);
		const updated = { ...home, style, styleLocked: true, space: 2 };
		await patchPlayer(playerId, { home: updated });
		const chests = await byWorld(t.Chest, wid);
		await awardAchievements(playerId);
		await bumpMetrics(player, { homesBuilt: 1 });
		return { ok: true, home: updated, inventory, chests, usedFrom, built: HOME_STYLES[style].name };
	}
}

/** POST /ObserveAnimal/ {playerId, animalId} — record an observation in the field journal. */
export class ObserveAnimal extends PublicEndpoint {
	async post(data: any) {
		const { playerId, animalId } = await bodyOf(data, this);
		const t = db();
		const d = await defs();
		const { player } = await requirePlayer(playerId);
		const wid = worldOf(player);

		const disc = await findDiscovery(t.Discovery, wid, animalId);
		if (!disc) throw new GameError(tr('server.err.animalNotReturned'), 404, 'server.err.animalNotReturned');
		// An observation is READING about the animal — opening its journal card
		// (or clicking it in the world, which opens the same card). The daily
		// "read about N animals" task only counts each animal once per day, so
		// re-opening the same card isn't farmable.
		const dayKey = playerDayKey(player, Date.now());
		const firstToday = disc.lastObservedDayKey !== dayKey;
		const timesObserved = (disc.timesObserved || 0) + 1;
		await t.Discovery.patch(disc.id, { timesObserved, lastObservedDayKey: dayKey });
		await bumpMetrics(player, { animalsObserved: 1 }, firstToday ? { observe: 1 } : {});
		await awardAchievements(playerId);
		return { ok: true, discovery: { ...disc, timesObserved }, animal: d.animal.get(animalId) };
	}
}

/**
 * POST /ClaimTask/ {playerId, taskId} — claim a finished daily task's reward.
 * The board itself is derived (see dailyTasksFor); only the claim is stored.
 */
export class ClaimTask extends PublicEndpoint {
	async post(data: any) {
		const { playerId, taskId } = await bodyOf(data, this);
		return withPlayerLock(playerId, async () => {
			const t = db();
			const d = await defs();
			const { player } = await requirePlayer(playerId);
			const wid = worldOf(player);
			const now = Date.now();

			// Terrain rides along because the starter chain's stream goal is measured
			// from it, and this board is the one a claim is validated against — read it
			// here or "Dig a stream" would compute 0/3 and refuse a finished goal. It's
			// one extra read on a claim, which happens a handful of times per save,
			// not on every GameState.
			const [discoveries, biomeStates, placements, chests, terrain] = await Promise.all([
				byWorld(t.Discovery, wid),
				byWorld(t.BiomeState, wid),
				// Nothing on the board counts placements any more — see boardPlacements.
				boardPlacements(wid, player),
				byWorld(t.Chest, wid),
				byWorld(t.TerrainTile, wid),
			]);
			const block = dailyTasksBlock({
				wid,
				player,
				d,
				discoveries,
				biomeStates,
				placements,
				chests,
				terrain,
				now,
				unlockedBiomes: player.unlockedBiomes,
			});
			const task = block.tasks.find((x: any) => x.id === String(taskId || ''));
			if (!task) throw new GameError(tr('server.err.taskNotOnBoard'), 404, 'server.err.taskNotOnBoard');
			if (task.pinned) throw new GameError(tr('server.err.taskNotClaimable'), 409, 'server.err.taskNotClaimable'); // guidance goals aren't claimed
			if (task.claimed) throw new GameError(tr('server.err.taskAlreadyClaimed'), 409, 'server.err.taskAlreadyClaimed');
			if (task.progress < task.target)
				throw new GameError(tr('server.err.taskNotFinished'), 409, 'server.err.taskNotFinished');

			// grant the material bundle, respecting carrying capacity
			const inventory = { ...(player.inventory || {}) };
			const gained: Record<string, number> = {};
			for (const [resId, qty] of Object.entries(task.reward || {})) {
				const take = Math.min(qty as number, roomFor(resId, inventory, d, player));
				if (take <= 0) continue;
				inventory[resId] = (inventory[resId] || 0) + take;
				gained[resId] = take;
			}
			if (!Object.keys(gained).length)
				throw new GameError(tr('server.err.basketFullReward'), 409, 'server.err.basketFullReward');

			// Clear the finished goal out for good. Starters (start-*) aren't stored in
			// the goal list, so they're remembered via goalClaims; a player-set goal is
			// removed from customGoals entirely, so it leaves the board, the goals menu,
			// and frees its slot (no lingering "done" entries piling up).
			const isStarter = String(task.id).startsWith('start-');
			const isUnlockReward = String(task.id).startsWith('unlock-reward:');
			const patch: any = { inventory };
			if (isUnlockReward) {
				// one-time welcome bundle — drop it from the pending list so it doesn't reappear
				const bid = String(task.id).slice('unlock-reward:'.length);
				patch.pendingUnlockRewards = (player.pendingUnlockRewards || []).filter((id: string) => id !== bid);
			} else if (isStarter) {
				patch.goalClaims = { ...(player.goalClaims || {}), [task.id]: true };
			} else {
				patch.customGoals = (player.customGoals || []).filter((g: CustomGoal) => g.id !== task.id);
			}
			await patchPlayer(playerId, patch);
			await bumpMetrics(player, { tasksCompleted: 1 });
			await awardAchievements(playerId);

			// Return the board AS IT IS NOW — recomputed against the patched player, so
			// the claimed goal is gone and the next link of the starter chain is
			// already on it. The response used to carry the pre-claim board with the
			// finished goal flagged `claimed`, which meant the new goal only appeared
			// after the client's follow-up GameState fetch: claim, then a beat of
			// nothing, then the board moves. The player reads that pause as the game
			// not having noticed.
			const dailyTasks = dailyTasksBlock({
				wid,
				player: { ...player, ...patch },
				d,
				discoveries,
				biomeStates,
				placements,
				chests,
				terrain,
				now,
				unlockedBiomes: player.unlockedBiomes,
			});
			return { ok: true, taskId: task.id, text: task.text, gained, inventory, dailyTasks };
		});
	}
}

/**
 * POST /SetGoals/ {playerId, goals:[…]} — replace the player's custom goal list.
 * The client sends the full ordered list (add/remove/reorder are just edits to
 * it); the server validates every entry and stores it. Rewards are NEVER taken
 * from the client — they're derived on claim — so a crafted request can't grant
 * itself materials.
 */
export class SetGoals extends PublicEndpoint {
	async post(data: any) {
		const { playerId, goals } = await bodyOf(data, this);
		const { player } = await requirePlayer(playerId);
		const t = db();
		const d = await defs();
		const wid = worldOf(player);
		const now = Date.now();
		const [discoveries, biomeStates, placements, chests] = await Promise.all([
			byWorld(t.Discovery, wid),
			byWorld(t.BiomeState, wid),
			// A goal's baseline is captured from the same numbers its progress will be
			// read from — see boardPlacements.
			boardPlacements(wid, player),
			byWorld(t.Chest, wid),
		]);
		const ctx: TaskCtx = {
			wid,
			player,
			d,
			discoveries,
			biomeStates,
			placements,
			chests,
			now,
			unlockedBiomes: player.unlockedBiomes,
		};
		// Preserve each existing goal's baseline across edits (reorder/remove); a
		// brand-new goal gets its baseline captured NOW, so progress counts only the
		// work done from here on (fixes goals that showed complete the instant added).
		const prev = new Map<string, CustomGoal>((player.customGoals || []).map((g: CustomGoal) => [g.id, g]));
		// Hold at most `limit` custom goals at once (3 until every biome is open,
		// then 6). Existing goals are kept first; brand-new ones only fill remaining
		// slots, so a submission over the cap is trimmed rather than rejected.
		const limit = goalLimitFor(player, d);
		const cleaned = sanitizeGoals(goals, d);
		const keep: CustomGoal[] = [];
		for (const g of cleaned) {
			const existing = prev.get(g.id);
			if (!existing && keep.length >= limit) continue; // no room for another new one
			if (keep.length >= MAX_CUSTOM_GOALS) break; // hard safety ceiling
			const base = existing && typeof existing.base === 'number' ? existing.base : goalMetric(g, ctx);
			const out: CustomGoal = { ...g, base };
			if (g.kind === 'build') {
				out.basePlace =
					existing && typeof existing.basePlace === 'number' ? existing.basePlace : placedCountFor(ctx, g.itemId || '');
			}
			keep.push(out);
		}
		// Count goals the player AUTHORED, not goals they hold. The list is the wrong
		// thing to measure: a finished goal is deleted from it on claim, so someone
		// who set six and finished six looks identical to someone who never set any.
		// This counter is the only durable trace of "picked the board up as a tool",
		// which is the question the starter chain exists to move (see
		// starterChainMetrics). META, so it doesn't inflate the action totals.
		const added = keep.filter((g) => !prev.has(g.id)).length;
		await patchPlayer(playerId, { customGoals: keep });
		if (added) await bumpMetrics(player, { goalsCreated: added });
		return { ok: true, customGoals: keep, goalLimit: limit };
	}
}

/**
 * POST /Terraform/ {playerId, area, x, y, action: 'dig'|'water'|'clear', size?}
 * Gentle landscape shaping: the shovel prepares a soil bed, the watering can
 * brings it to life (consuming 1 water), and digging again clears it.
 * Watered beds raise biome health directly.
 *
 * `size` is the caretaker's chosen brush — 1, 3 or 9 squares across, centered on
 * the click, defaulting to 1. A tool's tier decides which sizes are OFFERED
 * (brushSizesFor) and nothing else, so no upgrade ever shapes more ground than
 * was asked for. Clearing is always a single square: taking nine tiles back at
 * once is not something to do by accident.
 */
/**
 * The squares one shaping action covers: a `size` x `size` block centered on the
 * tile that was clicked, nearest ring first so a pour that runs out of water
 * spends it closest to where the caretaker aimed.
 *
 * Size comes from the caretaker's own brush setting, never from the tool's tier
 * — the tier only decides which sizes the picker offers. Size 1 returns exactly
 * the clicked square, which is what every tool does until someone chooses
 * otherwise.
 */
function brushTargets(
	tx: number,
	ty: number,
	size: number,
	grid: { cols: number; rows: number },
	fits: (x: number, y: number) => boolean,
): { x: number; y: number }[] {
	const r = Math.floor((Math.max(1, size) - 1) / 2);
	const out: { x: number; y: number }[] = [];
	for (let ring = 0; ring <= r; ring++) {
		for (let dy = -ring; dy <= ring; dy++) {
			for (let dx = -ring; dx <= ring; dx++) {
				// only the squares this ring adds, so the walk stays nearest-first
				if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
				if (out.length >= MAX_BRUSH_TILES) return out;
				const x = tx + dx;
				const y = ty + dy;
				if (x < 1 || y < 1 || x > grid.cols - 2 || y > grid.rows - 2) continue;
				if (!fits(x, y)) continue;
				out.push({ x, y });
			}
		}
	}
	return out;
}

export class Terraform extends PublicEndpoint {
	async post(data: any) {
		const { playerId, area, x, y, action, expect, size } = await bodyOf(data, this);
		return withPlayerLock(playerId, async () => {
			const t = db();
			const d = await defs();
			const { player } = await requirePlayer(playerId);
			const wid = worldOf(player);

			const biome = d.biome.get(area);
			if (!biome) throw new GameError(tr('server.err.terraformOutdoors'), 400, 'server.err.terraformOutdoors');
			if (!(player.unlockedBiomes || []).includes(area))
				throw new GameError(tr('server.err.biomeLocked', { biome: biome.name }), 403, 'server.err.biomeLocked');

			const tx = Math.round(Number(x));
			const ty = Math.round(Number(y));
			const grid = areaGrid(d, area);
			if (
				!Number.isFinite(tx) ||
				!Number.isFinite(ty) ||
				tx < 1 ||
				ty < 1 ||
				tx > grid.cols - 2 ||
				ty > grid.rows - 2
			) {
				throw new GameError(tr('server.err.outOfReach'), 400, 'server.err.outOfReach');
			}
			// One area's placements, not the world's: this asks whether anything
			// stands on ONE tile, and reading the other five areas to answer it made
			// the cost of a dig in the meadow grow every time the coast was built out.
			const placements = await byArea(t.Placement, wid, area);
			if (placements.some((p) => p.x === tx && p.y === ty)) {
				throw new GameError(tr('server.err.somethingPlaced'), 400, 'server.err.somethingPlaced');
			}

			const tileId = `${wid}:${area}:${tx}:${ty}`;
			// Match by position, not id: legacy beds carry an old id but must still be
			// recognized here (see findTerrainAt). A freshly dug bed uses `tileId`.
			//
			// A point read, not a list. This used to read the whole area and pick the
			// clicked square out of it, because the recalc below wanted the area
			// anyway and the tile written in between meant the two reads could not
			// share a cached result — so one dig scanned every tile the player had
			// ever shaped in this biome, twice. The recalc now takes its terrain
			// numbers off the biome row (see recalcBiome), so all that is left to ask
			// is what is on THIS square, which is one row by id — with the same
			// coordinate fallback behind it for a legacy save.
			const existing = await findTerrainAt(t.TerrainTile, wid, area, tx, ty);

			// Compare-and-swap on the tile's type.
			//
			// Watering ESCALATES — bare ground is dug into a bed, a bed is watered, a
			// watered bed floods into open water — and the client decides which of
			// those a click means from its own copy of the tile. That copy doesn't
			// change until the round trip lands, so on a slow connection a player who
			// waters a bed, sees nothing, and clicks again sends a second "water" that
			// was decided against 'tilled' but arrives at a tile that is now 'watered'.
			// The server obligingly floods it, and the bed they were tending becomes a
			// pond. Same shape of accident for a shovel click that lands after the
			// ground it was aimed at has already been dug.
			//
			// So the client now says what it believed the tile was, and a command aimed
			// at ground that has become something else is refused instead of applied to
			// whatever happens to be there. `undefined` skips the check, which keeps
			// older clients (and the integration suites' direct posts) working.
			if (expect !== undefined) {
				const actual = existing?.type ?? null;
				if ((expect ?? null) !== actual) {
					// The overwhelmingly common case, and the one worth explaining: the
					// bed finished watering between the click and its arrival.
					const key =
						expect === 'tilled' && actual === 'watered' ? 'server.err.bedJustWatered' : 'server.err.groundChanged';
					throw new GameError(tr(key), 409, key);
				}
			}

			// The brush the caretaker chose, judged against the tool doing the work.
			// `clear` is deliberately not brushable.
			const brushTool = action === 'water' ? 'watering-can' : 'shovel';
			const offered = brushSizesFor(player.tools?.[brushTool] || 1);
			const brush = size === undefined || size === null ? 1 : Math.round(Number(size));
			if (!Number.isFinite(brush) || !offered.includes(brush))
				throw new GameError(tr('server.err.brushNotAvailable'), 400, 'server.err.brushNotAvailable');

			// The rest of the area's tiles, read only when this action actually needs
			// them: a brush wider than one square has to know which neighbours are
			// bare or already tilled, and a change that MAKES or DRAINS open water
			// re-shapes the lake and river spans the recalc reads — connectivity
			// across the whole area, not a tally anything can adjust in place (see
			// usableTerrainCounts). Every other action — every single-square dig, and
			// every bed taken from tilled to watered — leaves those numbers alone, so
			// the recalc reads them off the biome row and this scan is not paid at all.
			const shapesWater =
				(action === 'water' && existing?.type === 'watered') || (action === 'clear' && existing?.type === 'water');
			const areaTiles: any[] | null = brush > 1 || shapesWater ? await byArea(t.TerrainTile, wid, area) : null;

			let inventory = player.inventory || {};
			let tile: any = null;
			let removedId: string | undefined;
			let dug: { resourceId: string; amount: number } | null = null;
			// Extra tiles a late-tier run/flow shaped in the same pass. Everything
			// downstream (the recalc's addTerrain, the response, the metrics) folds
			// these in beside `tile`, so a tier-4 tool still writes exactly one.
			const alsoTiles: any[] = [];
			// What this action did to each of those tiles, for the recalc's fold — one
			// entry per row handed to it, or it re-reads the area rather than trust a
			// half-described change.
			const changes: TerrainChange[] = [];

			if (action === 'dig') {
				const shovelTier = player.tools?.shovel || 0;
				if (shovelTier < 1) throw new GameError(tr('server.err.needShovel'), 400, 'server.err.needShovel');
				if (existing) throw new GameError(tr('server.err.alreadyPrepared'), 400, 'server.err.alreadyPrepared');
				const stamp = Date.now();
				tile = { id: tileId, worldId: wid, playerId, area, x: tx, y: ty, type: 'tilled', updatedAt: stamp };
				await t.TerrainTile.put(tile);
				changes.push({ from: null, to: 'tilled' });

				// The rest of the chosen brush. Anything already shaped, already built
				// on, or off the workable grid is skipped, so a wide brush can only ever
				// ADD ground — it never overwrites work, and at 1x1 this loop does
				// nothing at all.
				if (brush > 1) {
					const bare = (x2: number, y2: number) =>
						!(x2 === tx && y2 === ty) &&
						!(areaTiles || []).some((tt: any) => tt.x === x2 && tt.y === y2) &&
						!placements.some((pl: any) => pl.x === x2 && pl.y === y2);
					for (const c of brushTargets(tx, ty, brush, grid, bare)) {
						const extra = {
							id: `${wid}:${area}:${c.x}:${c.y}`,
							worldId: wid,
							playerId,
							area,
							x: c.x,
							y: c.y,
							type: 'tilled',
							updatedAt: stamp,
						};
						await t.TerrainTile.put(extra);
						alsoTiles.push(extra);
						changes.push({ from: null, to: 'tilled' });
					}
				}

				// Breaking new ground may turn up a buried material. This only happens
				// when DIGGING a fresh bed — never when clearing/draining one back over.
				// The shovel's tier sets how much you pull up at once (tier 1→1 … 7→7),
				// so upgrading it actually pays off.
				//
				// A survey spade adds to that roll rather than replacing it. Caches sit at
				// fixed, readable places (buriedCacheAt) that it marks on the ground, so
				// digging one is a certainty on top of the usual chance — the upgrade can
				// only ever find you more, and what it really hands over is knowing where
				// to dig instead of hoping.
				const pool = biome.digResources || [];
				const strikes =
					(Math.random() < DIG_FIND_CHANCE ? 1 : 0) +
					(shovelTier >= SHOVEL_SURVEY_TIER
						? [{ x: tx, y: ty }, ...alsoTiles].filter((c: any) => buriedCacheAt(wid, area, c.x, c.y)).length
						: 0);
				if (pool.length && strikes > 0) {
					const resId = pool[Math.floor(Math.random() * pool.length)];
					const amount = Math.min(Math.max(1, shovelTier) * strikes, roomFor(resId, inventory, d, player));
					if (amount > 0) {
						inventory = { ...inventory, [resId]: (inventory[resId] || 0) + amount };
						await patchPlayer(playerId, { inventory });
						dug = { resourceId: resId, amount };
					}
				}
			} else if (action === 'water') {
				if ((player.tools?.['watering-can'] || 0) < 1)
					throw new GameError(tr('server.err.needWateringCan'), 400, 'server.err.needWateringCan');
				if (!existing) throw new GameError(tr('server.err.prepareBedFirst'), 400, 'server.err.prepareBedFirst');
				if (existing.type === 'water')
					throw new GameError(tr('server.err.alreadyOpenWater'), 400, 'server.err.alreadyOpenWater');
				// tilled -> watered bed, watered -> flooded open water: 1 water either way.
				// Chain open-water tiles to shape ponds, lakes, and rivers.
				const cost = 1;
				const newType = existing.type === 'tilled' ? 'watered' : 'water';
				// dry biomes (e.g. the desert) can ready soil beds but cannot be flooded
				if (newType === 'water' && biome.canFlood === false) {
					throw new GameError(tr('server.err.tooDryToFlood', { biome: biome.name }), 400, 'server.err.tooDryToFlood');
				}
				// ...and the trail gates stay walkable: water there would seal the
				// way into the next biome (see blocksGateTrail)
				if (newType === 'water' && blocksGateTrail(tx, ty, gateGeomOf(d, area))) {
					throw new GameError(tr('server.err.gateMustStayClear'), 400, 'server.err.gateMustStayClear');
				}
				const have = (inventory.water || 0) + (inventory['clean-water'] || 0);
				if (have < cost) throw new GameError(tr('server.err.needWater', { count: cost }), 400, 'server.err.needWater');
				inventory = { ...inventory };
				let remaining = cost;
				for (const key of ['water', 'clean-water']) {
					const take = Math.min(inventory[key] || 0, remaining);
					if (take > 0) {
						inventory[key] -= take;
						if (inventory[key] <= 0) delete inventory[key];
						remaining -= take;
					}
				}
				const stamp = Date.now();
				tile = { ...existing, type: newType, updatedAt: stamp };
				await t.TerrainTile.patch(existing.id, { type: newType, updatedAt: stamp });
				changes.push({ from: existing.type, to: newType });

				// The can's tier used to be read only when FILLING it — every upgrade did
				// nothing for the action the can is named after. Now it decides which
				// brushes the picker offers, and the caretaker decides which one is on.
				//
				// A brush only ever takes tilled beds to watered. It never floods, so the
				// dry-biome and gate-trail rules above cannot be reached sideways.
				if (brush > 1) {
					const tilledAt = (x2: number, y2: number) =>
						!(x2 === tx && y2 === ty) &&
						(areaTiles || []).some((tt: any) => tt.x === x2 && tt.y === y2 && tt.type === 'tilled');
					for (const c of brushTargets(tx, ty, brush, grid, tilledAt)) {
						const held = (inventory.water || 0) + (inventory['clean-water'] || 0);
						if (held < 1) break; // out of water — the pour simply stops here
						inventory = { ...inventory };
						let owed = 1;
						for (const key of ['water', 'clean-water']) {
							const take = Math.min(inventory[key] || 0, owed);
							if (take > 0) {
								inventory[key] -= take;
								if (inventory[key] <= 0) delete inventory[key];
								owed -= take;
							}
						}
						const row = (areaTiles || []).find((tt: any) => tt.x === c.x && tt.y === c.y);
						if (!row) continue;
						await t.TerrainTile.patch(row.id, { type: 'watered', updatedAt: stamp });
						alsoTiles.push({ ...row, type: 'watered', updatedAt: stamp });
						changes.push({ from: row.type, to: 'watered' });
					}
				}
				await patchPlayer(playerId, { inventory });
			} else if (action === 'clear') {
				if (!existing) throw new GameError(tr('server.err.nothingToClear'), 400, 'server.err.nothingToClear');
				// SHOVEL_SALVAGE_TIER gives back what the ground soaked up, so remodelling
				// a shoreline stops being a punishment. A watered bed took one water; open
				// water took that plus the pour that flooded it.
				if ((player.tools?.shovel || 0) >= SHOVEL_SALVAGE_TIER) {
					const back = existing.type === 'water' ? 2 : existing.type === 'watered' ? 1 : 0;
					const give = Math.min(back, roomFor('water', inventory, d, player));
					if (give > 0) {
						inventory = { ...inventory, water: (inventory.water || 0) + give };
						await patchPlayer(playerId, { inventory });
						dug = { resourceId: 'water', amount: give };
					}
				}
				await t.TerrainTile.delete(existing.id);
				removedId = existing.id;
				changes.push({ from: existing.type, to: null });
			} else {
				throw new GameError(tr('server.err.badTerraformAction'), 400, 'server.err.badTerraformAction');
			}

			// Every tile this action shaped, the clicked one first. A tool below the run
			// tiers shapes exactly one, so this is just `[tile]`.
			const tiles = tile ? [tile, ...alsoTiles] : alsoTiles;

			const discoveries = await byWorld(t.Discovery, wid);
			const recalc = await recalcBiome(wid, playerId, area, {
				addTerrain: tiles,
				removeTerrainIds: removedId ? [removedId] : [],
				terrainChanges: changes,
				player: { ...player, inventory },
				discoveries,
				// Pre-write, with this action's change folded in above — see the note
				// on `terrain` in recalcBiome. Only when this action had to read the
				// area for its own reasons; otherwise the recalc works from the biome
				// row and `changes`.
				...(areaTiles ? { terrain: areaTiles } : {}),
			});
			// recalcBiome counts any animal that returned
			// `bedsWatered` is a lifetime tally for the starter chain's watering goal.
			// It has to be a counter rather than a count of watered tiles, because
			// planting turns a watered bed into a planted one — counting live tiles
			// would make that goal's progress run backwards the moment the player
			// actually used the bed. It's in META_COUNTERS, so it doesn't double-count
			// against terraformActions in the action totals the dashboard reports.
			// A run shapes several tiles in one request; count the work, not the click,
			// so the watering goal and the dashboard's action totals still line up with
			// what actually happened to the land.
			const shapedCount = Math.max(1, tiles.length);
			await bumpMetrics(
				player,
				{ terraformActions: shapedCount, ...(action === 'water' ? { bedsWatered: shapedCount } : {}) },
				action === 'water' ? { water: shapedCount } : {},
			);
			await awardWorldAchievements(wid, playerId, {
				addDiscoveries: recalc.newAnimals,
				freshBiomeStates: [recalc.biomeState],
				discoveries,
			});
			// `tiles` carries the whole run; `tile` stays for older clients, which read
			// only the square they clicked (see applyTerraformResult).
			return { ok: true, tile, tiles, removedId, dug, inventory, ...recalc };
		});
	}
}

/** POST /RecalcBiome/ {playerId, biomeId} — explicit recalculation (also runs on every placement). */
export class RecalcBiome extends PublicEndpoint {
	async post(data: any) {
		const { playerId, biomeId } = await bodyOf(data, this);
		const { player } = await requirePlayer(playerId);
		const wid = worldOf(player);
		const discoveries = await byWorld(db().Discovery, wid);
		// The explicit recalculation is also the repair hammer — it is what a
		// support answer says to run — so it re-derives the terrain numbers from the
		// rows rather than trusting the ones on the biome row.
		const recalcResult = await recalcBiome(wid, playerId, biomeId, { discoveries, fresh: true });
		await awardWorldAchievements(wid, playerId, {
			addDiscoveries: recalcResult.newAnimals,
			freshBiomeStates: [recalcResult.biomeState],
			discoveries,
		});
		return { ok: true, ...recalcResult };
	}
}

/** POST /SyncPlayer/ {playerId, x, y, area} — persist position (the save point for movement). */
export class SyncPlayer extends PublicEndpoint {
	async post(data: any) {
		const { playerId } = await bodyOf(data, this);
		// Read-modify-write on two accumulating fields: `visitedBiomes` is rebuilt
		// from the row it just read, and `tutorialStep` is kept as a high-water mark.
		// Position sync fires on a timer, so it interleaves with real actions
		// constantly; unlocked, a concurrent write could drop a just-visited biome or
		// walk the tutorial backwards.
		return withPlayerLock(playerId, () => this.sync(data));
	}

	private async sync(data: any) {
		const { playerId, x, y, area, tutorialStep } = await bodyOf(data, this);
		const t = db();
		const d = await defs();
		const { player } = await requirePlayer(playerId);

		const patch: any = {};
		if (Number.isFinite(Number(x))) patch.x = Number(x);
		if (Number.isFinite(Number(y))) patch.y = Number(y);
		if (Number.isInteger(tutorialStep) && tutorialStep >= 0 && tutorialStep <= 99) {
			patch.tutorialStep = tutorialStep;
			// High-water mark: the furthest tutorial step this save ever reached.
			// Progressive UI (HUD nav buttons) keys off THIS, not the live step, so
			// replaying the tutorial from Help — which rewinds tutorialStep back to
			// 0 — never re-hides menu items the player already unlocked. Seed from
			// the current persisted step so pre-existing finished saves keep their
			// reveal on the very first sync after upgrading.
			patch.tutorialMaxStep = Math.max(player.tutorialMaxStep ?? 0, player.tutorialStep ?? 0, tutorialStep);
		}
		if (area === 'home') {
			// the home interior is always reachable from your camp — no gates
			patch.area = 'home';
		} else if (tentBiomeOf(area)) {
			// stepping inside a trail tent: its biome must be open and a tent
			// actually pitched there (the interior belongs to the placement)
			const tb = tentBiomeOf(area)!;
			const biome = d.biome.get(tb);
			if (!biome) throw new GameError(tr('server.err.unknownArea', { area }), 400, 'server.err.unknownArea');
			if (!(player.unlockedBiomes || []).includes(tb)) {
				throw new GameError(tr('server.err.biomeLocked', { biome: biome.name }), 403, 'server.err.biomeLocked');
			}
			const wid = worldOf(player);
			const hasTent = (await byArea(t.Placement, wid, tb)).some((p) => p.objectId === 'trail-tent');
			if (!hasTent) throw new GameError(tr('server.err.noTentHere'), 404, 'server.err.noTentHere');
			patch.area = area;
		} else if (area) {
			const biome = d.biome.get(area);
			if (!biome) throw new GameError(tr('server.err.unknownArea', { area }), 400, 'server.err.unknownArea');
			if (!(player.unlockedBiomes || []).includes(area)) {
				throw new GameError(tr('server.err.biomeLocked', { biome: biome.name }), 403, 'server.err.biomeLocked');
			}
			if (!biome.explorable) {
				throw new GameError(tr('server.err.notExplorable', { biome: biome.name }), 403, 'server.err.notExplorable');
			}
			patch.area = area;
			// Record the first walk into this area — this is what enables fast-travel
			// to it from the preserve guide (you must have physically arrived once).
			const visited = player.visitedBiomes || ['meadow'];
			if (!visited.includes(area)) patch.visitedBiomes = [...visited, area];

			// First time stepping into an area that begins partly shaped, seed its
			// starting terrain now. This also back-fills saves that unlocked the area
			// before the starting-terrain feature existed (e.g. wetlands already open).
			if (STARTING_TERRAIN[area]) {
				const wid = worldOf(player);
				const hasTerrain = (await byArea(t.TerrainTile, wid, area)).length > 0;
				if (!hasTerrain) {
					await seedStartingTerrain(wid, playerId, area);
					// Seeding writes channels and beds without describing them, so this
					// recalc reads the area rather than the numbers on the row.
					await recalcBiome(wid, playerId, area, { player, fresh: true });
				}
			}
		}
		await patchPlayer(playerId, patch);
		// the tutorial finishing (and reaching the grasshopper step) can earn First Friend
		if (patch.tutorialStep !== undefined) await awardAchievements(playerId);
		return { ok: true, player: sanitizePlayer(await safeGet(t.Player, playerId)) };
	}
}

/**
 * POST /AppendFeed/ {playerId, entries:[{icon,text,at}]} — persist activity-feed
 * messages so a player can scroll back through them across sessions. Kept bounded:
 * after each append the player's feed is pruned to the most recent FEED_CAP rows.
 */
export class AppendFeed extends PublicEndpoint {
	async post(data: any) {
		const { playerId, entries } = await bodyOf(data, this);
		const { player } = await requirePlayer(playerId);
		const wid = worldOf(player);
		const t = db();
		const list = Array.isArray(entries) ? entries.slice(0, FEED_CAP) : [];
		// One write for the whole batch, and the cap is applied by slicing the array
		// rather than by deleting rows — so a long-running save costs no more per
		// line than a fresh one.
		const added = await appendFeed(wid, list);
		return { ok: true, added };
	}
}

export const SESSION_GAP_MS = 30 * 60 * 1000; // a fresh heartbeat after this gap = a new session
export const MAX_BEAT_MS = 90 * 1000; // credit at most this much play time per beat (guards idle/closed tabs)
