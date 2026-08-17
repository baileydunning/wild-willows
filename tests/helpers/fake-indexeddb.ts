// A minimal in-memory IndexedDB, covering exactly the surface src/solo/saves.ts
// uses (open + onupgradeneeded/onsuccess/onerror/onblocked, createObjectStore,
// a readonly/readwrite transaction, and get/put/delete/getAllKeys).
//
// It exists because jsdom provides NO IndexedDB, so without it the entire
// IndexedDB save path — including the migration that moves existing players'
// saves off localStorage — never executes in CI. That is the one path in this
// codebase where a silent bug loses somebody's world, so "untested because the
// test environment lacks the API" is not an acceptable place to leave it.
//
// Deliberately small: this is not an IndexedDB implementation, it is a stand-in
// for the handful of calls saves.ts makes. Anything it cannot model (versioning,
// cursors, indexes) is something saves.ts does not use.

export interface FakeIdbOptions {
	/** Every write fails — exercises the "migration could not land" path. */
	failWrites?: boolean;
	/** open() reports an error — exercises the localStorage fallback. */
	openError?: boolean;
	/** open() reports blocked, as when another tab holds an older version. */
	blocked?: boolean;
}

export interface FakeIdb {
	/** Slot ids currently held in IndexedDB. */
	slotIds(): string[];
	/** Read one stored slot, or undefined. */
	read(slotId: string): string | undefined;
	/** Seed a row directly, as if a previous session had written it. */
	seed(slotId: string, contents: string): void;
}

const DB_NAME = 'wild-willows';

export function installFakeIndexedDb(opts: FakeIdbOptions = {}): FakeIdb {
	const rows = new Map<string, string>();
	const stores = new Set<string>();
	// Callbacks are assigned by the caller AFTER the request object is returned,
	// so every one of them has to fire on a later turn — same as the real thing.
	const later = (fn: () => void) => setTimeout(fn, 0);

	const request = (run: () => any) => {
		const req: any = { result: undefined, onsuccess: null, onerror: null };
		later(() => {
			try {
				req.result = run();
				req.onsuccess?.();
			} catch {
				req.onerror?.();
			}
		});
		return req;
	};

	(globalThis as any).indexedDB = {
		open(name: string) {
			const req: any = { result: undefined, onsuccess: null, onerror: null, onupgradeneeded: null, onblocked: null };
			later(() => {
				if (opts.openError) return req.onerror?.();
				if (opts.blocked) return req.onblocked?.();
				const fresh = stores.size === 0;
				req.result = {
					objectStoreNames: { contains: (n: string) => stores.has(n) },
					createObjectStore: (n: string) => void stores.add(n),
					transaction() {
						const tx: any = { onabort: null };
						tx.objectStore = () => ({
							get: (k: string) => request(() => (rows.has('k:' + k) ? rows.get('k:' + k) : undefined)),
							put: (v: string, k: string) =>
								request(() => {
									if (opts.failWrites) throw new Error('quota');
									rows.set('k:' + k, v);
									return k;
								}),
							delete: (k: string) => request(() => void rows.delete('k:' + k)),
							getAllKeys: () =>
								request(() => [...rows.keys()].filter((k) => k.startsWith('k:')).map((k) => k.slice(2))),
						});
						return tx;
					},
				};
				if (fresh && name === DB_NAME) req.onupgradeneeded?.();
				req.onsuccess?.();
			});
			return req;
		},
	};

	return {
		slotIds: () => [...rows.keys()].filter((k) => k.startsWith('k:')).map((k) => k.slice(2)),
		read: (slotId) => rows.get('k:' + slotId),
		seed: (slotId, contents) => void rows.set('k:' + slotId, contents),
	};
}

export function uninstallFakeIndexedDb(): void {
	delete (globalThis as any).indexedDB;
}
