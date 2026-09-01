// In-memory implementation of the tiny slice of the Harper table API that the
// game server (server/resources.ts) actually uses: get / put / patch / delete /
// search. One LocalDb instance == one solo save's world. The server logic runs
// against this exactly as it would against `databases.wildwillows`, so there is
// a single source of truth for all game rules.
//
// The static "definition" tables (Biome, Animal, …) are seeded from the same
// data/*.json the Harper data loader uses. The dynamic per-save tables start
// empty and are what we serialize to a save file on disk.

import biomesData from '../../data/biomes.json';
import recipesData from '../../data/recipes.json';
import objectsData from '../../data/habitat-objects.json';
import toolsData from '../../data/tools.json';
import resourcesData from '../../data/resources.json';
import animals1Data from '../../data/animals-1.json';
import animals2Data from '../../data/animals-2.json';
import achievementsData from '../../data/achievements.json';

// Shallow copy only. Deep cloning every row on every read was the original
// design, but the server does full-table scans on every action, so deep clones
// (JSON parse/stringify) created huge GC churn that compounded as the world grew
// and made long sessions lag. A shallow copy protects against the common case
// (callers mutating a row's top-level fields) at a fraction of the cost; the
// server writes changes back via put/patch rather than mutating reads in place.
const copy = <T>(v: T): T => (v && typeof v === 'object' ? { ...(v as any) } : v);

/**
 * The primary-key prefix a query is bounded to, or null for an unbounded scan.
 * Mirrors Harper's handling: a `starts_with` (or its `sw` alias) condition on the
 * primary key — named explicitly or left null, which Harper reads as the primary
 * key — becomes a range bound. Anything else is ignored, which degrades to a full
 * scan: slower, never wrong.
 */
function idPrefixOf(query: any): string | null {
	const conditions = query?.conditions;
	if (!Array.isArray(conditions)) return null;
	for (const c of conditions) {
		if (!c) continue;
		const attribute = c.attribute ?? c[0] ?? null;
		if (attribute !== null && attribute !== 'id') continue;
		const comparator = c.comparator;
		if (comparator !== 'starts_with' && comparator !== 'sw') continue;
		const value = c.value ?? c[1];
		if (value == null) continue;
		return String(value);
	}
	return null;
}

/** Bumped on every write to any table. persist() uses it to skip a save when
 *  nothing has actually changed since the last one. */
let writeVersion = 0;
export const dbWriteVersion = () => writeVersion;

class LocalTable {
	/**
	 * The table's name, as `databases.wildwillows` would answer it.
	 *
	 * Not decoration. The server reads it back through `tableName()` to decide a
	 * key prefix (WORLD_KEYED / AREA_KEYED in server/worlds.ts) and to key and
	 * invalidate the request scan cache. An instance without it reads as the empty
	 * string, every table shares one cache entry, and the solo game quietly serves
	 * one table's rows for another's — which is not a slow game, it is a wrong one.
	 * Harper's own tables are classes, so `.name` is there for free; this is the
	 * backend that has to say so out loud.
	 */
	readonly name: string;

	constructor(name: string) {
		this.name = name;
	}

	private rows = new Map<string, any>();
	// Serializing the whole save on every autosave got steadily more expensive as
	// a preserve grew, and a typical action dirties one or two tables out of nine.
	// So each table caches its own JSON and only re-stringifies when it has been
	// written to. Costs one retained string per table (bounded by save size) and
	// turns a multi-hundred-millisecond freeze into a concat of cached strings.
	private dirty = true;
	private json = '[]';

	// Harper resolves get() to a stored record by primary key (or null).
	async get(id: any): Promise<any | null> {
		const rec = this.rows.get(String(id));
		return rec ? copy(rec) : null;
	}

	// put replaces the whole record (id taken from the record).
	async put(record: any): Promise<void> {
		if (!record || record.id == null) throw new Error('put() requires a record with an id');
		this.rows.set(String(record.id), copy(record));
		this.touch();
	}

	// patch merges a partial into an existing record (shallow, like Harper).
	async patch(id: any, partial: any): Promise<void> {
		const key = String(id);
		const cur = this.rows.get(key) || { id: key };
		this.rows.set(key, { ...cur, ...partial, id: cur.id ?? key });
		this.touch();
	}

	async delete(id: any): Promise<void> {
		if (this.rows.delete(String(id))) this.touch();
	}

	private touch(): void {
		this.dirty = true;
		writeVersion++;
	}

	// The server calls search({}) / search({ select: ['id'] }) for a full scan, and
	// search({ conditions: [{ attribute: 'id', comparator: 'starts_with', value }] })
	// for a bounded scan of one world's contiguous key run (see the key contract in
	// server/resources.ts). A solo save IS a single world, so the bound rarely
	// excludes anything here — but it must still be honoured, or the migration
	// path and the per-world reads would behave differently offline than they do
	// on Harper, and solo is where those code paths get exercised first.
	// Returns shallow copies; both `for await` and `for…of` iterate the array.
	search(query?: any): any[] {
		const prefix = idPrefixOf(query);
		const out: any[] = [];
		for (const [key, r] of this.rows) {
			if (prefix !== null && !key.startsWith(prefix)) continue;
			out.push(copy(r));
		}
		return out;
	}

	// --- persistence helpers (dynamic tables only) ---
	// Returned straight to JSON.stringify, so live refs are fine (no mutation).
	dump(): any[] {
		return Array.from(this.rows.values());
	}
	/** This table's rows as a JSON array, re-stringified only when dirty. */
	dumpJson(): string {
		if (this.dirty) {
			this.json = JSON.stringify(Array.from(this.rows.values()));
			this.dirty = false;
		}
		return this.json;
	}
	/** Read a row without copying the whole table (used for save metadata). */
	peek(id: any): any | null {
		const rec = this.rows.get(String(id));
		return rec ? copy(rec) : null;
	}
	load(records: any[]): void {
		this.rows.clear();
		for (const r of records || []) if (r && r.id != null) this.rows.set(String(r.id), r);
		this.touch();
	}
	get size() {
		return this.rows.size;
	}
}

// Tables whose contents define a player's save (everything else is static defs).
export const DYNAMIC_TABLES = [
	'Player',
	'PlayerAchievement',
	'BiomeState',
	'Chest',
	'Placement',
	'Discovery',
	'NodeState',
	'TerrainTile',
	'FeedEntry',
] as const;

const SEED: Record<string, { records: any[] }> = {
	Biome: biomesData as any,
	Animal: { records: [...(animals1Data as any).records, ...(animals2Data as any).records] },
	ResourceType: resourcesData as any,
	Recipe: recipesData as any,
	HabitatObject: objectsData as any,
	ToolDef: toolsData as any,
	Achievement: achievementsData as any,
};

export type LocalDatabase = Record<string, LocalTable>;

/** Build a fresh save database: static defs seeded, dynamic tables empty. */
export function makeLocalDatabase(): LocalDatabase {
	const db: LocalDatabase = {};
	for (const [name, data] of Object.entries(SEED)) {
		const t = new LocalTable(name);
		for (const rec of data.records || []) if (rec && rec.id != null) void t.put(rec);
		db[name] = t;
	}
	for (const name of DYNAMIC_TABLES) db[name] = new LocalTable(name);
	return db;
}

/** Serialize only the dynamic (per-save) tables for writing to disk. */
export function serializeSave(db: LocalDatabase): Record<string, any[]> {
	const out: Record<string, any[]> = {};
	for (const name of DYNAMIC_TABLES) out[name] = db[name].dump();
	return out;
}

/**
 * The dynamic tables as the JSON for a save file's `data` object, assembled from
 * each table's cached JSON so untouched tables are never re-stringified.
 *
 * Built as a string rather than an object because the whole point is to avoid
 * handing the full row graph to JSON.stringify again. Key order follows
 * DYNAMIC_TABLES, and every value is already-valid JSON from dumpJson().
 */
export function serializeSaveDataJson(db: LocalDatabase): string {
	let out = '{';
	for (let i = 0; i < DYNAMIC_TABLES.length; i++) {
		const name = DYNAMIC_TABLES[i];
		if (i) out += ',';
		out += JSON.stringify(name) + ':' + db[name].dumpJson();
	}
	return out + '}';
}

/** Hydrate dynamic tables from a previously serialized save. */
export function hydrateSave(db: LocalDatabase, data: Record<string, any[]>): void {
	for (const name of DYNAMIC_TABLES) db[name].load(data?.[name] || []);
}
