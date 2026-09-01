// Wild Willows — server: scan-cache
//
// One request reads a row once.
//
// The key contract (see keys.ts) got a per-world read down from "every save in
// the database" to "this world". What it did not touch is how MANY times one
// request asks for that world. A single Terraform reads BiomeState three
// separate times — recalcBiome's prior state, checkUnlocks' unlock set, the
// achievement sweep's health/returned set — and every one of them is the same
// six rows, microseconds apart, with nothing between them that changed the data.
// Half of all rows read in a heavy minute of play are BiomeState rows, on a
// table that holds six rows per world and never grows.
//
// The call sites already know this: recalcBiome takes `discoveries`, and
// awardAchievements takes `biomeStates` / `discoveries` / `terrain`, purely so a
// caller can lend rows it already read. That is hand-rolled memoization, done
// once per pair of functions that noticed, and it stops at the first call site
// nobody threaded an argument through. This generalizes it.
//
// ---------------------------------------------------------------- the scope
//
// A cache like this is only safe if it cannot outlive the request that filled
// it, and cannot be shared with a request that might write underneath it. There
// is no AsyncLocalStorage here to hang that on: this module is bundled into the
// renderer for the in-app solo backend (see the hash64 note in core.ts for the
// same constraint applied to node:crypto), and importing node:async_hooks would
// fail to resolve in the web build.
//
// So the scope is keyed the same way `pendingPlayerPatch` is: by the id
// withPlayerLock already serializes on. A scope opens when a player takes their
// lock and closes when they release it, and a read finds its scope by looking up
// the id it was ALREADY passed — a world id for the world scans, a player id for
// the player row.
//
// That lookup is what makes it safe rather than merely convenient. A solo
// world's id IS its player's id, so a world read inside that player's lock finds
// the scope and is cached. A legacy pre-0.3 `w_…` world's id matches no locked
// player id, so it finds nothing and reads through uncached — which is also the
// only case where two players could ever be in one world at once. The cache can
// therefore only ever be active when exactly one request can write to what it
// holds, and that falls out of the key rather than out of a rule somebody has to
// remember.
//
// ------------------------------------------------------------- invalidation
//
// Serving a stale row after a write in the same request is not a slow game, it
// is a wrong one — and it is a failure this code already knows by name: the
// comment above `addPlacements` in recalcBiome exists because searches inside a
// transaction can return the pre-write version of a record, and the folding
// arguments exist to work around it. A cache that reintroduced that would undo
// the fix.
//
// So invalidation is not left to call sites. `db()` hands out tables wrapped so
// that put / patch / delete drop every cached read of that table first (see
// core.ts). There is no write path that can forget, because there is no write
// path that does not go through db().
export type Scope = { entries: Map<string, Promise<any>> };

/** Open scopes, by the id their owner serializes on. */
const scopes = new Map<string, Scope>();

/**
 * Begin a request scope for `key`. Nested opens are counted rather than
 * clobbering each other, so a path that takes the same player's lock twice
 * cannot drop the outer scope's cache when the inner one finishes.
 */
const depth = new Map<string, number>();

export function openScope(key: string): void {
	if (!key) return;
	const n = (depth.get(key) || 0) + 1;
	depth.set(key, n);
	if (n === 1) scopes.set(key, { entries: new Map() });
}

export function closeScope(key: string): void {
	if (!key) return;
	const n = (depth.get(key) || 0) - 1;
	if (n > 0) {
		depth.set(key, n);
		return;
	}
	depth.delete(key);
	scopes.delete(key);
}

/**
 * Read through the scope for `scopeKey`, or straight through when there is none.
 *
 * Entry keys are `${table}|…` so a write to one table can drop exactly that
 * table's reads (see invalidateTable).
 *
 * The held value is a PROMISE, not a result: two reads of the same rows issued
 * before either resolves join one load instead of racing two. A rejected load is
 * dropped rather than remembered, so one failure does not stick for the rest of
 * the request.
 *
 * Arrays are handed back as a fresh slice. `byWorld` has always returned a new
 * array per call and callers rely on that — awardAchievements pushes onto the
 * discoveries it was given, recalcBiome filters and pushes onto its terrain —
 * so returning the held array itself would let one caller's fold-in leak into
 * the next reader's view. A slice of six (or six hundred) already-materialized
 * rows costs nothing next to the store read it replaces.
 */
export async function cached<T>(scopeKey: string, entryKey: string, load: () => Promise<T>): Promise<T> {
	// An entry key with no table segment means the caller could not name its table
	// (`${tableName(t)}|world` on a table that answered ''), and every such caller
	// would collide on ONE entry — the whole point of the prefix is that a write to
	// one table drops exactly that table's reads. core.ts resolves the name from
	// the db key so this should be unreachable; if a new backend ever makes it
	// reachable again, read through uncached. Slow is recoverable. Wrong is not.
	if (entryKey.startsWith('|')) return detach(await load());
	const scope = scopeKey ? scopes.get(scopeKey) : undefined;
	if (!scope) return detach(await load());
	const held = scope.entries.get(entryKey);
	if (held) return detach(await held);
	const p = load();
	scope.entries.set(entryKey, p);
	try {
		return detach(await p);
	} catch (e) {
		if (scope.entries.get(entryKey) === p) scope.entries.delete(entryKey);
		throw e;
	}
}

function detach<T>(v: T): T {
	return Array.isArray(v) ? (v.slice() as unknown as T) : v;
}

/**
 * Drop every cached read of one table, in every open scope.
 *
 * Deliberately whole-table rather than per-key: a write can change what a scan
 * of the same table WOULD have returned (a new placement belongs in a scan that
 * ran before it existed), so there is no correct way to keep a scan of a table
 * that was just written. The sets are a handful of entries each, so the sweep is
 * cheaper than reasoning about which of them survived.
 */
export function invalidateTable(table: string): void {
	if (!table || !scopes.size) return;
	const prefix = `${table}|`;
	for (const scope of scopes.values()) {
		if (!scope.entries.size) continue;
		for (const k of scope.entries.keys()) if (k.startsWith(prefix)) scope.entries.delete(k);
	}
}

/** Test/diagnostic hook: forget every scope. Never called from a request path. */
export function resetScopes(): void {
	scopes.clear();
	depth.clear();
}
