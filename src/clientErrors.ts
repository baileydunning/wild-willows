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

import { COOP_BASE_URL, IS_DESKTOP } from './api';
import { DEMO } from './demo';
import { APP_VERSION, BUILD_TIME, detectOS } from './platform';

/** Fingerprints already sent this session, so one bad frame doesn't flood. */
const seen = new Set<string>();
/** Hard ceiling per session — a render loop can fault faster than we can send. */
const MAX_PER_SESSION = 8;
let sent = 0;

function endpoint(): string {
	return `${IS_DESKTOP || DEMO ? COOP_BASE_URL : ''}/ReportClientError/`;
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
		reportClientError(ev.error, `window:${(ev.filename || '').split('/').pop() || 'unknown'}:${ev.lineno || 0}`);
	});
	window.addEventListener('unhandledrejection', (ev) => {
		reportClientError(ev.reason, 'unhandledrejection');
	});
}
