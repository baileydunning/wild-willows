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
}

function makeTable(): Table {
	const rows = new Map<string, any>();
	return {
		async get(id) {
			return rows.has(id) ? structuredClone(rows.get(id)) : undefined;
		},
		async put(row) {
			rows.set(row.id, structuredClone(row));
		},
		async patch(id, partial) {
			const cur = rows.get(id) || { id };
			rows.set(id, { ...cur, ...structuredClone(partial) });
		},
		async delete(id) {
			rows.delete(id);
		},
		search() {
			const snap = [...rows.values()].map((r) => structuredClone(r));
			return (async function* () {
				for (const r of snap) yield r;
			})();
		},
		_rows: rows,
	};
}

const TABLES = [
	'Biome', 'Animal', 'ResourceType', 'Recipe', 'HabitatObject', 'ToolDef', 'Achievement',
	'World', 'WorldMember', 'Player', 'BiomeState', 'Chest', 'Placement', 'Discovery',
	'NodeState', 'TerrainTile', 'PlayerAchievement', 'FeedEntry', 'WorldPresence', 'JoinRequest',
	'Feedback',
];

export type Db = Record<string, Table>;

/** Build a fresh world: definition tables seeded from data/*.json, the rest empty. */
export function makeWorld(): Db {
	const db: Db = {};
	for (const t of TABLES) db[t] = makeTable();
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
	get<T = any>(cls: string, id?: string): Promise<T>;
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
		get: (cls, id) => inst(cls, id).get(),
	};
}

export const appearance = {
	skin: '#eec39a', hair: '#6e4a33', outfit: '#4a7c59', hat: 'straw', hairstyle: 'short', body: 'slim',
};

/** First gatherable resource in the meadow — handy for collect tests. */
export function meadowResource(): string {
	return load('data/biomes.json').find((b) => b.id === 'meadow').resources[0];
}
