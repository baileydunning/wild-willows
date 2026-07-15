// What is this game running on? Shared by the solo metrics uplink and the
// feedback sender so both report the same machine/build facts.

/** Wild Willows version from package.json, baked in at build time. */
export const APP_VERSION: string = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';

/** Build timestamp, baked in at build time. */
export const BUILD_TIME: string = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : 'dev';

/**
 * Best-effort operating system from the user agent. Works in both the
 * Electron renderer (whose UA embeds the host OS) and plain browsers.
 * Android must be tested before Linux — its UA contains "Linux" too.
 */
export function detectOS(): string {
	if (typeof navigator === 'undefined') return 'unknown';
	const ua = navigator.userAgent || '';
	if (/Windows/i.test(ua)) return 'windows';
	if (/Android/i.test(ua)) return 'android';
	if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
	if (/Macintosh|Mac OS X/i.test(ua)) return 'mac';
	if (/Linux|X11/i.test(ua)) return 'linux';
	return 'unknown';
}

// A stable, anonymous per-install id, persisted in localStorage. Used only to
// group app-open / character-creation events per person for the acquisition
// funnel (opens → characters created). Not tied to any save or account.
const DEVICE_ID_KEY = 'wild-willows:device-id';

export function getDeviceId(): string {
	try {
		let id = localStorage.getItem(DEVICE_ID_KEY);
		if (!id) {
			id =
				typeof crypto !== 'undefined' && crypto.randomUUID
					? crypto.randomUUID()
					: `d_${Date.now()}_${Math.random().toString(36).slice(2)}`;
			localStorage.setItem(DEVICE_ID_KEY, id);
		}
		return id;
	} catch {
		// Private mode / no storage — fall back to an ephemeral id (won't dedupe
		// across launches, but the ping still lands).
		return `d_${Date.now()}_${Math.random().toString(36).slice(2)}`;
	}
}
