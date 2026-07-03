// What is this game running on? Shared by the solo metrics uplink and the
// feedback sender so both report the same machine/build facts.

/** Wild Willows version from package.json, baked in at build time. */
export const APP_VERSION: string =
	typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';

/** Build timestamp, baked in at build time. */
export const BUILD_TIME: string =
	typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : 'dev';

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
