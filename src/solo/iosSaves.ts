// iOS (Capacitor) solo saves. In a plain browser solo saves fall back to
// localStorage, but on iOS WKWebView storage is treated as "website data" the
// OS may evict under storage pressure — losing someone's meadow to a cleanup
// sweep is unacceptable. So on the native iOS app we install the SAME bridge
// shape the Electron preload provides (`globalThis.wildWillowsDesktop.saves`,
// see saves.ts), backed by @capacitor/filesystem: each slot is a JSON file in
// the app's Library/ dir (Directory.Data), which is durable and included in
// device backups.
//
// The import is dynamic and only runs when the Capacitor native runtime is
// actually present, so web/demo/Electron builds never touch the plugin.

const DIR = 'solo-saves';
const ext = (slotId: string) => `${DIR}/${slotId}.json`;

/** True when running inside the native Capacitor shell (not plain Safari). */
export function isCapacitorNative(): boolean {
	const cap = (globalThis as any).Capacitor;
	return !!cap?.isNativePlatform?.();
}

/** Install the Filesystem-backed saves bridge. Call before the app mounts so
 *  the first save-list read already goes to disk. No-op outside Capacitor. */
export async function installIosSavesBridge(): Promise<void> {
	if (!isCapacitorNative()) return;
	if ((globalThis as any).wildWillowsDesktop?.saves) return; // never fight Electron

	const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
	const opts = { directory: Directory.Data } as const;

	try {
		await Filesystem.mkdir({ ...opts, path: DIR, recursive: true });
	} catch {
		// already exists — fine
	}

	(globalThis as any).wildWillowsDesktop = {
		// Not the desktop app — anything checking isDesktop (Steam, quit button)
		// keeps behaving like the web build. Only the saves bridge is provided.
		isDesktop: false,
		saves: {
			async list(): Promise<string[]> {
				try {
					const res = await Filesystem.readdir({ ...opts, path: DIR });
					return res.files.filter((f) => f.name.endsWith('.json')).map((f) => f.name.replace(/\.json$/, ''));
				} catch {
					return [];
				}
			},
			async read(slotId: string): Promise<string | null> {
				try {
					const res = await Filesystem.readFile({ ...opts, path: ext(slotId), encoding: Encoding.UTF8 });
					return typeof res.data === 'string' ? res.data : null;
				} catch {
					return null;
				}
			},
			async write(slotId: string, contents: string): Promise<void> {
				await Filesystem.writeFile({ ...opts, path: ext(slotId), data: contents, encoding: Encoding.UTF8 });
			},
			async remove(slotId: string): Promise<void> {
				try {
					await Filesystem.deleteFile({ ...opts, path: ext(slotId) });
				} catch {
					// already gone — deleting a missing slot shouldn't crash the UI
				}
			},
		},
	};
}
