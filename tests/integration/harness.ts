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
	search(): AsyncIterable<any>;
	_rows: Map<string, any>;
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

function makeTable(name = 'Table'): Table {
	const rows = new Map<string, any>();
	const corrupt = new Set<string>();
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

	const table: Table = {
		async get(id) {
			// Harper returns null for a record it cannot decode — it does NOT throw.
			if (corrupt.has(id)) return undefined;
			return rows.has(id) ? structuredClone(rows.get(id)) : undefined;
		},
		async put(row) {
			corrupt.delete(row.id); // a full put rewrites the bytes → row is healed
			rows.set(row.id, structuredClone(row));
		},
		async patch(id, partial) {
			const cur = rows.get(id) || { id };
			rows.set(id, { ...cur, ...structuredClone(partial) });
		},
		async delete(id) {
			corrupt.delete(id);
			rows.delete(id);
		},
		search() {
			// Undecodable rows surface as nulls in a scan, exactly as Harper yields them.
			const snap = [...rows.values()].map((r) => (corrupt.has(r.id) ? null : structuredClone(r)));
			return (async function* () {
				for (const r of snap) yield r;
			})();
		},
		_rows: rows,
		name,
		primaryStore: {
			encoder,
			// `valueAsBuffer` short-circuits decoding and returns the stored payload.
			getSync(id: string, options?: any) {
				if (!rows.has(id)) return undefined;
				if (!options?.valueAsBuffer) return structuredClone(rows.get(id));
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
	'MailingListSignup',
	'LandingStat',
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
	endpoints = (await import(join(root, 'resources.js'))) as Record<string, any>;
	return endpoints;
}

export interface World {
	db: Db;
	post<T = any>(cls: string, body: any): Promise<T>;
	get<T = any>(cls: string, id?: string, query?: Record<string, string | string[]>): Promise<T>;
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
	return {
		get db() {
			return holder.db;
		},
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
