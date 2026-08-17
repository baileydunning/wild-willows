// Crash reporting for the interface.
//
// A render crash, an unhandled promise, a thrown event handler — all of these
// were completely invisible. The player got a blank screen or a dead button and
// closed the game, and nothing was written down anywhere. The only signal was
// somebody writing in to say it "broke", which is a report you get from roughly
// none of the people it happens to.
//
// Kept deliberately small and defensive: reporting a crash must never be able to
// cause one. Everything here swallows its own failures, and nothing is retried —
// a device that can't reach the server is already having a worse problem than a
// missing metric.

import { hostedBase } from './api';

import { APP_VERSION, BUILD_TIME, detectOS } from './platform';

/** Fingerprints already sent this session, so one bad frame doesn't flood. */
const seen = new Set<string>();
/** Hard ceiling per session — a render loop can fault faster than we can send. */
const MAX_PER_SESSION = 8;
let sent = 0;

function endpoint(): string {
	return `${hostedBase()}/ReportClientError/`;
}

/* ------------------------------------------------------------------ *
 * Fingerprints
 * ------------------------------------------------------------------ *
 * A crash row on the dashboard is keyed server-side by hash32(message|where)
 * (ReportClientError in server/resources.ts). So `where` decides what counts as
 * "the same bug", and two things used to make that answer wrong in opposite
 * directions — both of them splitting one problem across many rows, which is
 * the failure mode that hides a real crash inside a wall of ones.
 */

/**
 * Collapse the variable parts of a request path.
 *
 * The path went in raw, so an endpoint that carries its id in the URL minted a
 * separate row per player: eight identical `Failed to fetch` rows reading
 * `/Metrics/bailey-test-fhkbf5`, `/Metrics/bobo-jogukk`, and so on, each with a
 * count of 1, crowding out everything else in a top-25 list. Endpoints that pass
 * the id in the BODY (`/AppendFeed/`) were already aggregating properly — this
 * just makes the rest behave the same way.
 *
 * Only the first segment names the endpoint; everything after it is an argument.
 * Empty segments are left alone so a plain `/AppendFeed/` keeps its shape.
 */
export function fingerprintPath(path: string): string {
	const parts = String(path || '')
		.split('?')[0]
		.split('/');
	for (let i = 2; i < parts.length; i++) if (parts[i]) parts[i] = ':id';
	return parts.join('/');
}

/**
 * Drop the build hash from a bundle filename.
 *
 * `window:` errors were fingerprinted with the script's basename, which for a
 * Vite build is content-hashed — so `index-B0BrE4OL.js` and `index-BBw9oUwa.js`
 * are the same chunk from two deploys, and every release silently re-filed every
 * existing crash under a brand-new row. The panel could show you a bug three
 * times and never once tell you it was the same bug, or that it was still
 * happening. Nothing is lost by stripping it: the exact build already travels in
 * the payload's own `build` and `version` fields.
 *
 * Deliberately narrow — a dash, then 8-10 hash characters, then the extension,
 * anchored at the end. A hand-written name like `demo-nudge.js` does not match.
 */
export function fingerprintScript(filename: string): string {
	const base = String(filename || '')
		.split('/')
		.pop();
	if (!base) return 'unknown';
	return base.replace(/-[A-Za-z0-9_-]{8,10}(\.[A-Za-z0-9]+)$/, '$1');
}

/* ------------------------------------------------------------------ *
 * Transport noise
 * ------------------------------------------------------------------ *
 * A fetch that never reaches a server rejects with "Failed to fetch", and that
 * is worth knowing about — while somebody is playing. It is NOT worth knowing
 * about while the page is being torn down, which is when this app does most of
 * its network I/O: the metrics uplink fires on visibilitychange→hidden and
 * pagehide (src/solo/metricsUplink.ts), and the feed flush does the same on
 * beforeunload (src/state.tsx). A browser killing those in-flight requests is
 * the browser working correctly, and it was filling the crash panel with rows
 * that no code change could ever fix.
 */
let unloading = false;

/** True when a failed request says more about the browser than about the app. */
function transportNoise(): boolean {
	if (unloading) return true;
	// Explicit false only — `undefined` on a platform without the API is not
	// evidence of being offline.
	if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
	// A hidden tab can be frozen mid-request on mobile. Nobody is watching, and
	// nothing the player is doing has failed.
	if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return true;
	return false;
}

/**
 * Report a request that never reached a server, unless the reason is the
 * browser rather than the app. Kept separate from reportClientError so that a
 * genuine JS crash still gets through while hidden or offline — a crash is a
 * crash wherever it happens; a dropped request during teardown is not.
 */
export function reportFetchFailure(err: unknown, method: string, path: string): void {
	if (transportNoise()) return;
	reportClientError(err, `fetch ${method} ${fingerprintPath(path)}`);
}

/**
 * Report a crash, once per distinct place it happens.
 *
 * `where` is the component or handler that failed — the part that makes two
 * identical "undefined is not a function" messages tell you different things.
 */
export function reportClientError(err: unknown, where: string): void {
	try {
		const e = err as any;
		const message = String(e?.message || e || 'unknown error').slice(0, 300);
		const key = `${message}|${where}`;
		if (seen.has(key) || sent >= MAX_PER_SESSION) return;
		seen.add(key);
		sent++;
		// The console keeps the full detail; only the top of the stack is sent.
		console.error(`[${where}]`, err);
		const payload = JSON.stringify({
			message,
			where: where.slice(0, 200),
			stack: String(e?.stack || '').slice(0, 1200),
			platform: detectOS(),
			version: APP_VERSION,
			build: BUILD_TIME,
		});
		// keepalive so a crash that takes the page down with it still gets out.
		void fetch(endpoint(), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: payload,
			keepalive: true,
		}).catch(() => {
			/* offline, or the server is the thing that's broken — either way, drop it */
		});
	} catch {
		/* reporting a crash must never raise one */
	}
}

/**
 * Catch the two kinds of failure that never reach a React boundary: errors
 * thrown outside the render tree (timers, event handlers, the Phaser scene) and
 * promise rejections nobody awaited.
 */
export function installGlobalErrorReporting(): void {
	if (typeof window === 'undefined') return;
	window.addEventListener('error', (ev) => {
		// Resource load failures (a missing image) also surface here, with no
		// Error object — those are noise, not crashes.
		if (!ev.error) return;
		reportClientError(ev.error, `window:${fingerprintScript(ev.filename)}:${ev.lineno || 0}`);
	});
	window.addEventListener('unhandledrejection', (ev) => {
		reportClientError(ev.reason, 'unhandledrejection');
	});
	/* From here on, a failed request is the page closing rather than a fault.
	 * Both events are listened for because neither fires reliably everywhere:
	 * pagehide is the one iOS Safari gives you, beforeunload the one that fires
	 * on a desktop tab close. Cleared again on pageshow, which is what a
	 * bfcache restore looks like — a page that came back is live again, and
	 * leaving the flag set would silence every real report for the rest of it. */
	const onLeaving = () => {
		unloading = true;
	};
	window.addEventListener('pagehide', onLeaving);
	window.addEventListener('beforeunload', onLeaving);
	window.addEventListener('pageshow', () => {
		unloading = false;
	});
}
