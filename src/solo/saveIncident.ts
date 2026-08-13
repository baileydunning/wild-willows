// Uplink for saves that would not open.
//
// Desktop solo runs the whole backend in-app, so the SaveIncident row the server
// writes on a decode failure lands in the PLAYER'S local database and never
// reaches the hosted Harper. The failures we most need to see are exactly the
// ones we cannot see. This posts a minimal, anonymous record so an unreadable
// desktop save shows up on /dashboard next to the hosted ones.
//
// Strictly best-effort and never rethrows: the player has already hit one
// failure, and telemetry must not stack a second one on top of it.

import { hostedBase, IS_DESKTOP } from '../api';

import { APP_VERSION, BUILD_TIME } from '../platform';

/** Tell the hosted instance that a save could not be read. Fire and forget. */
export function reportSaveIncident(recordId: string, kind: 'unreadable' | 'refused' = 'unreadable'): void {
	try {
		if (!recordId) return;
		// Desktop and the demo's offline fallback post cross-origin to the hosted
		// Harper; a deployed web build posts to its own origin (same rule as the
		// metrics uplink).
		const url = `${hostedBase()}/ReportSaveIncident/`;
		void fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			keepalive: true,
			signal: AbortSignal.timeout(10_000),
			body: JSON.stringify({
				table: 'Player',
				recordId,
				kind,
				platform: IS_DESKTOP ? 'desktop' : 'web',
				version: APP_VERSION,
				build: BUILD_TIME,
			}),
		}).catch(() => {
			/* offline — the incident is lost, which is better than a second error */
		});
	} catch {
		/* never surface a telemetry failure to the player */
	}
}
