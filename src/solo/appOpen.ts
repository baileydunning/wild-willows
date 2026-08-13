// Acquisition funnel ping (opens → characters created). Fires directly at the
// hosted Harper (POST /AppOpen/), independent of the game transport, so it works
// for web AND desktop solo/co-op alike — the hosted /Metrics/ dashboard then
// reports how many people opened the app, how many went on to create a
// character (vs bounced), and how many characters each person makes.
//
// Strictly best-effort and anonymous: it sends only a per-install device id (see
// getDeviceId) plus build/OS facts. A dropped ping loses nothing — the next
// open/create re-reports the device's latest state.

import { hostedBase, IS_DESKTOP } from '../api';
import { getLocale } from '../i18n';
import { EDITION } from '../demo';
import { APP_VERSION, CHANNEL, detectOS, getDeviceId } from '../platform';

function endpoint(): string {
	// Desktop and the browser demo both post cross-origin to the hosted Harper;
	// the deployed web build posts to its own origin.
	return `${hostedBase()}/AppOpen/`;
}

async function send(phase: 'open' | 'created' | 'demo_done', extra: Record<string, any> = {}): Promise<void> {
	try {
		await fetch(endpoint(), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			keepalive: true,
			signal: AbortSignal.timeout(10_000),
			body: JSON.stringify({
				deviceId: getDeviceId(),
				phase,
				platform: IS_DESKTOP ? 'desktop' : 'web',
				// Which storefront this copy came from (itch | mas | direct | dev).
				// Orthogonal to `platform`: itch ships a download AND the browser demo,
				// so the pair is what actually answers "where are players coming from".
				channel: CHANNEL,
				os: detectOS(),
				version: APP_VERSION,
				edition: EDITION,
				language: getLocale(),
				...extra,
			}),
		});
	} catch {
		/* offline or server unreachable — fine; acquisition tracking is best-effort */
	}
}

/** Fire once when the app launches (counts toward opens / bounce). */
export function reportAppOpen(): void {
	void send('open');
}

/** Fire once when a character is created, with how long the creator took (ms). */
export function reportCharacterCreated(creationMs: number): void {
	void send('created', { creationMs: Math.max(0, Math.round(creationMs || 0)) });
}

/** Fire once when the demo hard-stop is reached (the goal animals have returned).
 *  Device-scoped and sticky on the server, so it survives the save being reset
 *  when the player dismisses the thank-you popup. */
export function reportDemoComplete(): void {
	void send('demo_done');
}
