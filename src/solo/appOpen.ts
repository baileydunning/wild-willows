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
import { APP_VERSION, CHANNEL, detectOS, getDeviceId, isDevDevice } from '../platform';

function endpoint(): string {
	// Desktop and the browser demo both post cross-origin to the hosted Harper;
	// the deployed web build posts to its own origin.
	return `${hostedBase()}/AppOpen/`;
}

async function send(
	phase: 'open' | 'created' | 'resumed' | 'demo_done' | 'demo_nudge' | 'kb_gate',
	extra: Record<string, any> = {},
): Promise<void> {
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
				// Which channel this copy came from (itch | mas | direct | dev).
				// Orthogonal to `platform`: itch ships a download AND the browser demo,
				// so the pair is what actually answers "where are players coming from".
				channel: CHANNEL,
				// One of our machines, not a player's — see isDevDevice().
				dev: isDevDevice(),
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

/**
 * Fire when a player picks up an EXISTING save — Continue, Load Game, or a
 * passcode login.
 *
 * Without this the funnel only ever heard about character CREATION, so everyone
 * returning to a save they already had was counted as a BOUNCE: they opened the
 * app, created nothing, and landed in "never made a character". That is the
 * opposite of what they did — a returning player is the strongest engagement
 * signal the game has, and counting them as a bounce made the rate meaningless
 * exactly as the game started retaining people.
 *
 * Sticky server-side, so it survives however many times they come back.
 */
export function reportSaveResumed(): void {
	void send('resumed');
}

/** Fire once when the demo hard-stop is reached (the goal animals have returned).
 *  Device-scoped and sticky on the server, so it survives the save being reset
 *  when the player dismisses the thank-you popup. */
export function reportDemoComplete(): void {
	void send('demo_done');
}

/**
 * The demo's "are you done playing?" prompt, reported as a three-step funnel:
 * 'shown' when it goes up, 'exported' when a save is downloaded from it, 'store'
 * when a buy link is followed.
 *
 * Device-scoped and sticky server-side, so it outlives the demo save (which the
 * hard-stop deletes) and answers the only question worth asking about an
 * interruption: did it produce exports and store visits that the quiet paths —
 * the Settings button, the end-of-demo popup — were not producing on their own.
 * If `shown` climbs and the other two don't, the prompt is a tax rather than a
 * conversion, and it should be softened or dropped.
 */
export function reportDemoNudge(step: 'shown' | 'exported' | 'store'): void {
	void send('demo_nudge', { nudgeStep: step });
}

/**
 * Fire when the keyboard gate blocks this device — "Wild Willows needs a
 * keyboard" — and again with `gotIn` if a keyboard later shows up and the same
 * visit gets through.
 *
 * This is the ONLY thing a gated player can report. The gate wraps GameProvider
 * (see App.tsx), so someone stuck behind it never gets a player id or a save
 * slot, and the /SyncMetrics/ path needs both — which is why this rides the
 * device-scoped acquisition ping instead. Until now such a device was
 * indistinguishable from someone who opened the game and wandered off: it
 * counted as a bounce.
 *
 * Its own phase rather than 'open', because 'open' increments the per-device
 * open count and a gate ping is not a launch. Both flags are sticky server-side.
 */
export function reportKeyboardGate(gotIn: boolean): void {
	void send('kb_gate', { keyboardGatePassed: !!gotIn });
}
