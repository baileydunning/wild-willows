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

/**
 * Storefronts / distribution sources a build can arrive through.
 *
 *   itch   — itch.io: BOTH the browser demo and the desktop download
 *   mas    — the Mac App Store
 *   direct — from us: wildwillows.app (the /play demo and any direct download)
 *   dev    — a local build; never a real player
 *
 * Kept deliberately short. Steam and Android get their own entries when they
 * actually ship — an empty bucket on the dashboard is a channel you have to
 * explain every time you look at it. Adding one later is this list, the
 * detector below, and a label on the dashboard; nothing stored has to change,
 * because AppOpen is a dynamic table and the metrics uplink rides its channel
 * inside the snapshot JSON.
 */
export type Channel = 'itch' | 'mas' | 'direct' | 'dev';

const CHANNELS: Channel[] = ['itch', 'mas', 'direct', 'dev'];

/** The build-time stamp, for builds whose channel runtime can't see (see vite.config.ts). */
const BUILD_CHANNEL: string = typeof __CHANNEL__ !== 'undefined' ? __CHANNEL__ : '';

/**
 * WHERE THIS COPY CAME FROM — the storefront, not the platform.
 *
 * `platform` (web | desktop) already says what it runs on; this says who handed
 * it to the player. They are orthogonal on purpose: itch sells a download AND
 * hosts the browser demo, so 'itch' + 'desktop' and 'itch' + 'web' are both
 * real, and both are worth telling apart from wildwillows.app.
 *
 * Runtime evidence beats the build stamp wherever it exists, because runtime
 * evidence cannot drift. The web bundle in particular is ONE artifact pushed to
 * two places (itch's html5 channel and wildwillows.app/play), so its own
 * hostname is the only thing that can tell those apart — a build-time flag
 * would need two builds and would silently lie the first time one got pushed to
 * the wrong place.
 *
 * Order matters: the most specific, least spoofable signal first.
 */
export function detectChannel(): Channel {
	const desktop: any = (globalThis as any).wildWillowsDesktop;
	// 1. Desktop: the preload already asked the Electron process directly
	//    (process.mas is set only for a Mac App Store build). Trust that over
	//    anything baked in at build time.
	if (desktop?.isDesktop) {
		return normalizeChannel(desktop.channel) || normalizeChannel(BUILD_CHANNEL) || 'direct';
	}
	// 2. Web: the page's own hostname. itch serves HTML5 games from an iframe on
	//    html-classic.itch.zone, NOT from itch.io — match the zone too, or every
	//    browser-demo player gets misfiled.
	const host = typeof location !== 'undefined' ? location.hostname || '' : '';
	if (/(^|\.)itch\.zone$/i.test(host) || /(^|\.)itch\.io$/i.test(host)) return 'itch';
	if (/(^|\.)wildwillows\.app$/i.test(host)) return 'direct';
	if (host === 'localhost' || host === '127.0.0.1' || host === '') return 'dev';
	// Anywhere else — an embed, a mirror, a preview deploy. With no bucket of its
	// own it falls to the build stamp, then to 'direct'. If a surprise traffic
	// source ever matters, give it a real channel rather than reading it out of
	// 'direct'.
	return normalizeChannel(BUILD_CHANNEL) || 'direct';
}

/** A known channel name, or null. Keeps a typo'd WW_CHANNEL from inventing a bucket. */
function normalizeChannel(v: unknown): Channel | null {
	const c = String(v || '')
		.trim()
		.toLowerCase();
	return (CHANNELS as string[]).includes(c) ? (c as Channel) : null;
}

/** Resolved once — nothing here changes for the life of the page. */
export const CHANNEL: Channel = detectChannel();

// A stable, anonymous per-install id, persisted in localStorage. Used only to
// group app-open / character-creation events per person for the acquisition
// funnel (opens → characters created). Not tied to any save or account.
//
// NOTE: inside itch's game iframe this is THIRD-PARTY storage, which browsers
// increasingly partition or clear on their own. Device ids there dedupe less
// reliably than on wildwillows.app (first-party), so itch's device count skews
// high relative to its real audience. Compare channels on conversion RATE, not
// on raw device counts.
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
