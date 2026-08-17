// Integration harness: drives the REAL built server bundle (resources.js)
// against an in-memory stand-in for Harper's `databases` / `Resource`. This is
// the same technique as scripts/coop-harness.mjs, refactored so every test gets
// a clean world (fresh tables) while the server module itself is imported once.
//
// Why the bundle and not the TS source? It's exactly what `harper deploy` ships,
// so these tests exercise the artifact that actually runs in production.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Packr } from '../../node_modules/harper/node_modules/msgpackr/index.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, '..', '..');

const load = (p: string): any[] => JSON.parse(readFileSync(join(root, p), 'utf8')).records;

// ---- in-memory table store (matches the Harper API slice the server uses) ----
interface Table {
	get(id: string): Promise<any>;
	put(row: any): Promise<void>;
	patch(id: string, partial: any): Promise<void>;
	delete(id: string): Promise<void>;
	search(query?: any): AsyncIterable<any>;
	_rows: Map<string, any>;
	/** Rows yielded by search() since the last _resetScanStats(), and how many of
	 *  those scans were unbounded. The key-scoping tests assert on both. */
	_scanStats(): { rowsScanned: number; scans: number; unboundedScans: number };
	_resetScanStats(): void;
	/** put + patch + delete since the last _resetWriteStats(). On Harper each of
	 *  these is a billable write, and the free tier allows 1,000/minute TOTAL
	 *  across every player — so this is the number that sets concurrency. */
	_writeStats(): { puts: number; patches: number; deletes: number; total: number };
	_resetWriteStats(): void;
	/** Table class name — the server reads it to pick per-table salvage rules. */
	name: string;
	/** Harper's `static primaryStore`: the raw byte store under the table. */
	primaryStore: any;
	/**
	 * Simulate an undecodable row, the way real Harper behaves: the record's bytes
	 * stay on disk intact but carry trailing framing bytes, so RecordEncoder.decode
	 * throws "Data read, but end of buffer not reached", logs it, and hands the
	 * caller **null** — indistinguishable from an absent row. See the salvage notes
	 * in server/resources.ts.
	 */
	_corrupt(id: string): void;
	/** True once the row decodes normally again (i.e. it healed). */
	_isCorrupt(id: string): boolean;
}

/** Freeze an object and everything reachable from it (Harper's `freezeData`). */
function deepFreeze<T>(value: T): T {
	if (value && typeof value === 'object' && !Object.isFrozen(value)) {
		Object.freeze(value);
		for (const v of Object.values(value as any)) deepFreeze(v);
	}
	return value;
}

/**
 * The primary-key prefix a query is bounded to, or null for an unbounded scan.
 * Mirrors Harper: a `starts_with` condition naming the primary key (or naming
 * nothing, which Harper reads as the primary key) becomes a range bound.
 */
function idPrefixOf(query: any): string | null {
	const conditions = query?.conditions;
	if (!Array.isArray(conditions)) return null;
	for (const c of conditions) {
		if (!c) continue;
		const attribute = c.attribute ?? c[0] ?? null;
		if (attribute !== null && attribute !== 'id') continue;
		if (c.comparator !== 'starts_with' && c.comparator !== 'sw') continue;
		const value = c.value ?? c[1];
		if (value != null) return String(value);
	}
	return null;
}

function makeTable(name = 'Table'): Table {
	const rows = new Map<string, any>();
	const corrupt = new Set<string>();
	let rowsScanned = 0;
	let scans = 0;
	let unboundedScans = 0;
	let puts = 0;
	let patches = 0;
	let deletes = 0;
	// The real encoder, so tests exercise genuine msgpackr behaviour rather than a
	// hand-rolled imitation of it.
	const encoder = new Packr({ structures: [], structuredClone: false });
	// Trailing bytes matching the shape seen in the production hex dumps. Kept as a
	// plain Uint8Array rather than a Buffer because this project ships no @types/node.
	const TRAILER = new Uint8Array([0xd5, 0x72, 0x60, 0x00]);
	const withTrailer = (packed: Uint8Array): Uint8Array => {
		const out = new Uint8Array(packed.length + TRAILER.length);
		out.set(packed, 0);
		out.set(TRAILER, packed.length);
		return out;
	};

	/**
	 * Hand back a FROZEN copy, the way real Harper does.
	 *
	 * Harper deep-freezes every record it decodes — its row cache depends on the
	 * decoded object never being mutated (utility/lmdb: `freezeData = true`, plus an
	 * explicit `freezeRecord` on the read path). Because the deployed bundle is ESM,
	 * i.e. strict mode, `row.count = row.count + 1` on a fetched record THROWS
	 * "Cannot assign to read only property" rather than failing quietly.
	 *
	 * This harness used to return plain writable structuredClones, so read-modify-
	 * write-in-place looked fine here and died in production — which is exactly how
	 * the landing-page counters sat at 1/day for weeks with green tests. Server code
	 * must rebuild a literal (`{ ...row, count: row.count + 1 }`) or use patch();
	 * freezing here is what makes that non-negotiable.
	 */
	const frozenCopy = (row: any): any => deepFreeze(structuredClone(row));

	const table: Table = {
		async get(id) {
			// Harper returns null for a record it cannot decode — it does NOT throw.
			if (corrupt.has(id)) return undefined;
			return rows.has(id) ? frozenCopy(rows.get(id)) : undefined;
		},
		async put(row) {
			puts++;
			corrupt.delete(row.id); // a full put rewrites the bytes → row is healed
			rows.set(row.id, structuredClone(row));
		},
		async patch(id, partial) {
			patches++;
			const cur = rows.get(id) || { id };
			rows.set(id, { ...cur, ...structuredClone(partial) });
		},
		async delete(id) {
			deletes++;
			corrupt.delete(id);
			rows.delete(id);
		},
		search(query?: any) {
			// Honour a primary-key `starts_with` bound the way Harper does: it compiles
			// to primaryStore.getRange({start, end}), so only keys inside the range are
			// ever visited. Modelling that here is what makes these tests able to FAIL
			// when a row is written outside its world's key run — with an unfiltered
			// mock, a broken key contract still reads correctly and the bug ships.
			const prefix = idPrefixOf(query);
			const keys = prefix === null ? [...rows.keys()] : [...rows.keys()].filter((k) => String(k).startsWith(prefix));
			scans++;
			if (prefix === null) unboundedScans++;
			rowsScanned += keys.length;
			// Undecodable rows surface as nulls in a scan, exactly as Harper yields them.
			const snap = keys.map((k) => rows.get(k)).map((r) => (corrupt.has(r.id) ? null : frozenCopy(r)));
			return (async function* () {
				for (const r of snap) yield r;
			})();
		},
		_scanStats: () => ({ rowsScanned, scans, unboundedScans }),
		_writeStats: () => ({ puts, patches, deletes, total: puts + patches + deletes }),
		_resetWriteStats() {
			puts = 0;
			patches = 0;
			deletes = 0;
		},
		_resetScanStats() {
			rowsScanned = 0;
			scans = 0;
			unboundedScans = 0;
		},
		_rows: rows,
		name,
		primaryStore: {
			encoder,
			// `valueAsBuffer` short-circuits decoding and returns the stored payload.
			getSync(id: string, options?: any) {
				if (!rows.has(id)) return undefined;
				if (!options?.valueAsBuffer) return frozenCopy(rows.get(id));
				const packed = encoder.pack(rows.get(id));
				return corrupt.has(id) ? withTrailer(packed) : packed;
			},
		},
		_corrupt(id) {
			if (!rows.has(id)) throw new Error(`cannot corrupt missing row ${name}/${id}`);
			corrupt.add(id);
		},
		_isCorrupt(id) {
			return corrupt.has(id);
		},
	};
	return table;
}

const TABLES = [
	'Biome',
	'Animal',
	'ResourceType',
	'Recipe',
	'HabitatObject',
	'ToolDef',
	'Achievement',
	'World',
	'WorldMember',
	'Player',
	'BiomeState',
	'Chest',
	'Placement',
	'Discovery',
	'NodeState',
	'TerrainTile',
	'PlayerAchievement',
	'FeedEntry',
	'WorldPresence',
	'JoinRequest',
	'Feedback',
	'SoloMetrics',
	'AppOpen',
	'LandingStat',
	'PlayerNameIndex',
	'SaveIncident',
	'Refusal',
	'ClientError',
];

export type Db = Record<string, Table>;

/** Build a fresh world: definition tables seeded from data/*.json, the rest empty. */
export function makeWorld(): Db {
	const db: Db = {};
	for (const t of TABLES) db[t] = makeTable(t);
	const seed = (table: string, recs: any[]) => recs.forEach((r) => db[table]._rows.set(r.id, structuredClone(r)));
	seed('Biome', load('data/biomes.json'));
	seed('Animal', [...load('data/animals-1.json'), ...load('data/animals-2.json')]);
	seed('ResourceType', load('data/resources.json'));
	seed('Recipe', load('data/recipes.json'));
	seed('HabitatObject', load('data/habitat-objects.json'));
	seed('ToolDef', load('data/tools.json'));
	seed('Achievement', load('data/achievements.json'));
	return db;
}

// The server's `db()` reads `databases.wildwillows` fresh on every call, so we
// can hot-swap the underlying world between tests via this mutable holder.
const holder: { db: Db } = { db: makeWorld() };

let endpoints: Record<string, any> | null = null;

/** Import the built bundle exactly once, with the Harper globals installed first. */
export async function loadServer(): Promise<Record<string, any>> {
	if (endpoints) return endpoints;
	const g = globalThis as any;
	g.Resource = class {
		_id: any;
		/** Set by `fetch()` below when a test wants request headers in scope. */
		_ctx: any = null;
		constructor(id?: any) {
			this._id = id;
		}
		getId() {
			return this._id;
		}
		/**
		 * Harper hands endpoints a request context; the ones that content-negotiate
		 * (GameData, and the inlined HTML pages) read `.headers` off it and fall back
		 * to an uncompressed plain response when there is none — that no-context path
		 * is also how the in-app solo backend calls them. Null by default so every
		 * existing test keeps taking that path unchanged.
		 */
		getContext() {
			return this._ctx;
		}
	};
	g.databases = {
		get wildwillows() {
			return holder.db;
		},
	};
	endpoints = (await import(join(root, 'resources.js'))) as Record<string, any>;
	return endpoints;
}

/* ------------------------------------------------------------------ *
 * Authorized dispatch
 * ------------------------------------------------------------------ *
 * `get`/`post` below call the handler DIRECTLY, which is right for the tests
 * that exercise game logic — they'd otherwise have to carry a user object
 * through several hundred assertions that have nothing to do with auth.
 *
 * But it means those helpers cannot say anything about access control, and the
 * existing coverage for it works around that by calling `allowRead(user)` on
 * the prototype and asserting the return value. That tests the predicate, not
 * the protection: an endpoint whose hook correctly returns false is still wide
 * open if nothing consults the hook, and the assertion stays green either way.
 *
 * `as(user)` closes that gap by dispatching the way Harper documents: pick the
 * hook for the verb, consult it, and refuse before the handler runs. It models
 * Harper's default too — an endpoint that defines no hook at all is super-user
 * only, which is the entire protection on ListFeedback and SystemProbe.
 *
 * What it deliberately does NOT prove: that Harper itself still calls these
 * hooks. Nothing running in-process can. Harper 5.2 deprecates all four in
 * favour of operation overrides, and if a future release stops consulting them
 * this harness would keep refusing while the real server let everyone in. That
 * check belongs against a live instance — see scripts/smoke-test.sh.
 */
const VERB_HOOK = { get: 'allowRead', post: 'allowCreate', put: 'allowUpdate', delete: 'allowDelete' } as const;

/** Harper's own super-user test, mirrored from isSuperUser() in server/resources.ts. */
const isSuper = (user: any): boolean =>
	!!(
		user?.role?.permission?.super_user ||
		user?.role?.super_user ||
		user?.role?.role === 'super_user' ||
		user?.role === 'super_user'
	);

export interface AuthorizationError extends Error {
	status: number;
}

export interface AuthedWorld {
	post<T = any>(cls: string, body: any): Promise<T>;
	get<T = any>(cls: string, id?: string, query?: Record<string, string | string[]>): Promise<T>;
}

export interface World {
	db: Db;
	post<T = any>(cls: string, body: any): Promise<T>;
	get<T = any>(cls: string, id?: string, query?: Record<string, string | string[]>): Promise<T>;
	/**
	 * The same calls, dispatched as `user` and refused when the endpoint says no.
	 * Pass `undefined` or `null` for an anonymous request.
	 */
	as(user: any): AuthedWorld;
	/**
	 * Like get(), but with an HTTP request context carrying `headers` — for the
	 * endpoints that content-negotiate or answer If-None-Match. Endpoint names here
	 * are the URL-path exports ('' for the landing page, 'og-image', …), not class
	 * names, so pass them exactly as they appear in the export map.
	 */
	fetch<T = any>(cls: string, headers?: Record<string, string>): Promise<T>;
	/**
	 * A POST carrying an HTTP request context, so `headers` are in scope inside the
	 * handler. Needed because plain `post()` deliberately supplies NO context —
	 * that is the server's signal for "the in-app solo backend is calling", and
	 * rate limiting is skipped for it. Anything that has to exercise a real
	 * request (per-caller rate limits, address handling) must come through here.
	 */
	postWith<T = any>(cls: string, body: any, headers?: Record<string, string>): Promise<T>;
}

/** Reset to a brand-new world and return helpers bound to the loaded server. */
export async function freshWorld(): Promise<World> {
	const mod = await loadServer();
	holder.db = makeWorld();
	const inst = (cls: string, id?: string) => {
		const Cls = mod[cls];
		if (typeof Cls !== 'function') throw new Error(`No endpoint named ${cls}`);
		return new Cls(id);
	};
	/** Refuse before the handler runs, the way a real request would be refused. */
	const gate = (cls: string, verb: keyof typeof VERB_HOOK, user: any) => {
		const Cls = mod[cls];
		if (typeof Cls !== 'function') throw new Error(`No endpoint named ${cls}`);
		const hook = Cls.prototype?.[VERB_HOOK[verb]];
		// No hook defined is not "no rule": it is Harper's default, which is an
		// authenticated super user. Treating it as open would quietly bless the two
		// endpoints (ListFeedback, SystemProbe) whose whole protection is the
		// ABSENCE of an override.
		const ok = typeof hook === 'function' ? hook.call(Cls.prototype, user) === true : isSuper(user);
		if (!ok) {
			const err = new Error(`Not authorized: ${verb.toUpperCase()} ${cls}`) as AuthorizationError;
			err.status = 401;
			throw err;
		}
	};
	// Named targetFor, not `query`: the existing get() helper below already has a
	// parameter called `query`, and a shadowed name in a file about authorization
	// is a bad place to make a reader pause.
	const targetFor = (id?: string, q?: Record<string, string | string[]>) => {
		const target = new URLSearchParams() as URLSearchParams & { id?: string };
		if (q)
			for (const [k, vals] of Object.entries(q))
				for (const v of Array.isArray(vals) ? vals : [vals]) target.append(k, String(v));
		target.id = id;
		return target;
	};
	return {
		get db() {
			return holder.db;
		},
		as: (user: any): AuthedWorld => ({
			post: (cls, body) => {
				gate(cls, 'post', user);
				return inst(cls).post(body);
			},
			get: (cls, id, q) => {
				gate(cls, 'get', user);
				return inst(cls, id).get(targetFor(id, q));
			},
		}),
		post: (cls, body) => inst(cls).post(body),
		// Mirror Harper: get() receives a RequestTarget (a URLSearchParams subclass)
		// carrying the path id plus any query params.
		get: (cls, id, query) => {
			const target = new URLSearchParams() as URLSearchParams & { id?: string };
			if (query) {
				for (const [k, vals] of Object.entries(query)) {
					for (const v of Array.isArray(vals) ? vals : [vals]) target.append(k, String(v));
				}
			}
			target.id = id;
			return inst(cls, id).get(target);
		},
		// Same call, but with a request context in scope. Header lookup is
		// case-insensitive, like a real Headers object.
		fetch: (cls, headers) => {
			const lower: Record<string, string> = {};
			for (const [k, v] of Object.entries(headers || {})) lower[k.toLowerCase()] = v;
			const r = inst(cls);
			r._ctx = { headers: { get: (k: string) => lower[String(k).toLowerCase()] ?? null } };
			return r.get(new URLSearchParams());
		},
		postWith: (cls, body, headers) => {
			const lower: Record<string, string> = {};
			for (const [k, v] of Object.entries(headers || {})) lower[k.toLowerCase()] = v;
			const r = inst(cls);
			r._ctx = { headers: { get: (k: string) => lower[String(k).toLowerCase()] ?? null } };
			return r.post(body);
		},
	};
}

export const appearance = {
	skin: '#eec39a',
	hair: '#6e4a33',
	outfit: '#4a7c59',
	hat: 'straw',
	hairstyle: 'short',
	body: 'slim',
};

/**
 * Player.metrics and Player.daily are persisted as JSON STRINGS by the server
 * (so the msgpackr/structon record encoding stays stable — see the note in
 * server/resources.ts). These decode a stored row's field back to an object for
 * assertions, tolerating a legacy object row too.
 */
export const metricsOf = (p: any): any => (typeof p?.metrics === 'string' ? JSON.parse(p.metrics) : p?.metrics || {});
export const dailyOf = (p: any): any => (typeof p?.daily === 'string' ? JSON.parse(p.daily) : p?.daily || {});

/** First gatherable resource in the meadow — handy for collect tests. */
export function meadowResource(): string {
	return load('data/biomes.json').find((b) => b.id === 'meadow').resources[0];
}
