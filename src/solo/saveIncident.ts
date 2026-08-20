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

/**
 * Tell the hosted instance that a save could not be read. Fire and forget.
 *
 * `table` namespaces the record id. It defaults to 'Player' because that is what
 * the server's own noteSaveIncident records; desktop slot files pass
 * 'SoloSaveSlot' so a filename can never be mistaken for a Player record id.
 */
export function reportSaveIncident(
	recordId: string,
	kind: 'unreadable' | 'refused' = 'unreadable',
	table: 'Player' | 'SoloSaveSlot' = 'Player',
): void {
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
				table,
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

/**
 * Desktop only: listen for the main process recovering a slot from its backup.
 *
 * electron/saves.js writes slot files atomically and keeps the previous save as
 * `.bak`. When the primary file will not parse it falls back, heals the slot,
 * and emits here. The player is fine — they got a readable save — but the event
 * must not stay local: solo's backend runs in-app, so the SaveIncident row it
 * would normally write lands in the player's OWN database and never reaches us.
 * This is the only way a desktop save going bad becomes visible on /dashboard.
 *
 * Safe to call anywhere: no bridge (web), or an older desktop shell without
 * `onRecovered`, both no-op. Idempotent — repeat calls do not stack listeners.
 */
interface RecoveryBridge {
	saves?: {
		onRecovered?(cb: (info: { slotId: string; from: 'tmp' | 'bak' }) => void): () => void;
	};
}

let watching = false;
export function watchDesktopSaveRecovery(): void {
	if (watching) return;
	const desktopSaves = (globalThis as { wildWillowsDesktop?: RecoveryBridge }).wildWillowsDesktop?.saves;
	if (!desktopSaves?.onRecovered) return;
	watching = true;
	desktopSaves.onRecovered((info) => {
		console.warn(`[saves] slot ${info.slotId} recovered from .${info.from}`);
		reportSaveIncident(info.slotId, 'unreadable', 'SoloSaveSlot');
	});
}
