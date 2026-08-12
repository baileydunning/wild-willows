// Native (Capacitor / Android) bootstrap.
//
// The Android app is the same web build the desktop app loads, so rather than
// teaching the game about a third platform we install the SAME global bridge
// Electron's preload exposes (`wildWillowsDesktop`). Everything downstream then
// works unchanged:
//
//   • src/api.ts       — sees isDesktop, so transport defaults to 'solo' and no
//                        gameplay call ever leaves the device
//   • src/solo/saves.ts— sees `.saves`, so slots become real files instead of
//                        localStorage (which a WebView can evict under storage
//                        pressure — that's a lost 20-hour save, not a nuisance)
//   • src/solo/steamSync.ts — sees no `.steam`, so it no-ops exactly like the
//                        Linux/AppImage build does
//
// The one place "Android is not Electron" leaks is audio autoplay; see the
// `isNativeAndroid` export and its use in src/audio.ts.
//
// TIMING IS LOAD-BEARING. src/api.ts reads `wildWillowsDesktop.isDesktop` at
// MODULE EVALUATION time (a top-level const), not on first call. ES imports are
// evaluated before any importing module's body runs, so installing the bridge
// from inside a function called in main.tsx would be too late — api.ts would
// already have decided it was a web build. That's why this module does its work
// as a top-level side effect and why main.tsx imports it FIRST.
//
// The install itself is synchronous (Capacitor.isNativePlatform() is sync); only
// the individual filesystem operations are async, resolved lazily per call.

import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';

function detectNativeAndroid(): boolean {
	try {
		return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
	} catch {
		// Capacitor absent entirely (unit tests, SSR) — definitively not native.
		return false;
	}
}

/** True only inside the Capacitor Android app. False on web, in Electron, and in tests. */
export const isNativeAndroid: boolean = detectNativeAndroid();

// Save slots live in the app's private data dir, the direct analogue of the
// Electron build's userData/saves. Directory.Data is app-private and survives
// updates; it is NOT the user-visible Documents dir, so nothing here is exposed
// to a file manager or to other apps.
const SAVES_DIR = 'saves';
const slotPath = (slotId: string) => `${SAVES_DIR}/${slotId}.json`;

/** Filesystem.readdir throws rather than returning empty when the dir is absent. */
async function ensureSavesDir(): Promise<void> {
	try {
		await Filesystem.mkdir({ path: SAVES_DIR, directory: Directory.Data, recursive: true });
	} catch {
		// Already exists — mkdir has no "if not exists" flag, so the throw IS the
		// happy path on every launch after the first.
	}
}

async function list(): Promise<string[]> {
	await ensureSavesDir();
	try {
		const res = await Filesystem.readdir({ path: SAVES_DIR, directory: Directory.Data });
		return (res.files || [])
			.map((f: any) => (typeof f === 'string' ? f : f?.name))
			.filter((n: unknown): n is string => typeof n === 'string' && n.endsWith('.json'))
			.map((n: string) => n.slice(0, -'.json'.length));
	} catch {
		return [];
	}
}

async function read(slotId: string): Promise<string | null> {
	try {
		const res = await Filesystem.readFile({
			path: slotPath(slotId),
			directory: Directory.Data,
			encoding: Encoding.UTF8,
		});
		// Typed as string | Blob; with an explicit encoding it is always a string
		// on Android, but be defensive rather than handing JSON.parse a Blob.
		return typeof res.data === 'string' ? res.data : null;
	} catch {
		return null; // missing slot — saves.ts treats null as "no such save"
	}
}

async function write(slotId: string, contents: string): Promise<void> {
	await ensureSavesDir();
	await Filesystem.writeFile({
		path: slotPath(slotId),
		directory: Directory.Data,
		encoding: Encoding.UTF8,
		data: contents,
		recursive: true,
	});
}

async function remove(slotId: string): Promise<void> {
	try {
		await Filesystem.deleteFile({ path: slotPath(slotId), directory: Directory.Data });
	} catch {
		// Already gone. saves.ts swallows delete errors anyway.
	}
}

if (isNativeAndroid && !(globalThis as any).wildWillowsDesktop) {
	(globalThis as any).wildWillowsDesktop = {
		isDesktop: true,
		platform: 'android',
		version: Capacitor.getPlatform(),
		saves: { list, read, write, remove },
		// Deliberately no `steam` key — steamSync.ts checks for it and no-ops.
	};
}
