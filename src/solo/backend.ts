// The in-app solo backend. It runs the REAL game server logic
// (server/resources.ts) inside the app, against an in-memory LocalDb, so solo
// play needs no Harper server and works fully offline. Co-op is unaffected — it
// still talks to the hosted Harper over HTTP (see src/api.ts).
//
// How the reuse works: server/resources.ts expects two Harper globals,
// `Resource` (a base class) and `databases`. We install lightweight shims on
// globalThis BEFORE importing the module (its `class … extends Resource` runs at
// import time), then dispatch HTTP-shaped calls to the exported endpoint classes.

import { hydrateSave, makeLocalDatabase, serializeSave, type LocalDatabase } from './localDb';

// Minimal stand-in for Harper's Resource base class. Endpoints only ever read
// `this.getId()` (the trailing URL segment, e.g. the playerId in /GameState/x).
class ResourceShim {
	private readonly __ctx: any;
	constructor(ctx?: any) {
		this.__ctx = ctx;
	}
	getId() {
		const c = this.__ctx;
		if (c == null) return undefined;
		return typeof c === 'string' ? c : c.id;
	}
}

let activeDb: LocalDatabase | null = null;
let endpointsPromise: Promise<Record<string, any>> | null = null;

// Load the server module exactly once, with globals in place first.
async function endpoints(): Promise<Record<string, any>> {
	if (!endpointsPromise) {
		const g = globalThis as any;
		g.Resource = ResourceShim;
		// `databases.wildwillows` is read fresh on every db() call in the server, so
		// pointing the getter at our swappable `activeDb` lets us change saves.
		g.databases = {
			get wildwillows() {
				return activeDb;
			},
		};
		endpointsPromise = import('../../server/resources').then((m) => m as Record<string, any>);
	}
	return endpointsPromise;
}

/** Swap in a fresh, empty world (static defs seeded). */
function freshDb(): LocalDatabase {
	activeDb = makeLocalDatabase();
	return activeDb;
}

export interface SoloResult {
	status: number;
	body: any;
}

/**
 * Dispatch an HTTP-shaped request to the in-app server logic.
 * `path` is like '/GameState/foo' or '/CollectResource/'; `method` is GET/POST.
 */
export async function soloRequest(path: string, method: string, body?: any): Promise<SoloResult> {
	const mod = await endpoints();
	// Ensure a world exists so static reads (e.g. GameData on the title screen)
	// work offline before any save is started. New/load reset this explicitly.
	if (!activeDb) freshDb();
	const clean = path.split('?')[0].replace(/^\/+|\/+$/g, '');
	const [name, ...rest] = clean.split('/');
	const Cls = mod[name];
	if (typeof Cls !== 'function') {
		return { status: 404, body: { title: `No solo endpoint for ${name}` } };
	}
	const id = rest.length ? decodeURIComponent(rest.join('/')) : undefined;
	try {
		const inst = new Cls(id);
		const out =
			method.toUpperCase() === 'GET'
				? await inst.get()
				: await inst.post(body ?? {});
		return { status: 200, body: out };
	} catch (e: any) {
		// Mirror the server's GameError → HTTP status mapping.
		const status = e?.statusCode || 400;
		return { status, body: { title: e?.message || 'Solo action failed' } };
	}
}

/** Start a brand-new solo save in a fresh world. Returns the create payload. */
export async function newSoloGame(name: string, appearance: any): Promise<any> {
	freshDb();
	// Solo has no passcode; createPlayer still requires one server-side, so we
	// pass a fixed local token that is never shown or verified.
	const res = await soloRequest('/CreatePlayer/', 'POST', { name, passcode: SOLO_PASSCODE, appearance });
	if (res.status !== 200) throw Object.assign(new Error(res.body?.title || 'Could not start game'), { status: res.status });
	return res.body;
}

/** Load an existing solo save's records into a fresh world and return its snapshot. */
export async function loadSoloGame(playerId: string, saveData: Record<string, any[]>): Promise<any> {
	freshDb();
	hydrateSave(activeDb!, saveData);
	const res = await soloRequest(`/GameState/${encodeURIComponent(playerId)}`, 'GET');
	if (res.status !== 200) throw Object.assign(new Error(res.body?.title || 'Could not load save'), { status: res.status });
	return res.body;
}

/** Snapshot the active world's dynamic tables for writing to disk. */
export function serializeActiveSave(): Record<string, any[]> | null {
	return activeDb ? serializeSave(activeDb) : null;
}

export function hasActiveSolo(): boolean {
	return activeDb != null;
}

export function endSolo(): void {
	activeDb = null;
}

// Fixed, never-shown passcode used so the shared server logic (which requires
// one) is satisfied for local solo saves. Solo never verifies it.
const SOLO_PASSCODE = 'local-solo-save';
