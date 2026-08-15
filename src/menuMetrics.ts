// How long players sit in menus, and which ones they open.
//
// Dwell time already exists for the world — the heartbeat credits its elapsed
// gap to whichever area the player is standing in (areaSeconds, see Heartbeat
// in server/resources.ts). Menus are the blind spot in that picture: a save can
// report forty minutes in Old Hollow Forest without saying that eleven of them
// were spent reading the journal.
//
// The server can't see this on its own — which panel is open is React state in
// the client — so the open panel rides along on the heartbeat and is credited
// the same way, and opens are counted here and flushed on the same beat rather
// than costing a request of their own.
//
// Menu time OVERLAPS area time rather than being carved out of it. areaSeconds
// therefore keeps exactly the meaning it has always had, and every row recorded
// before this existed stays comparable with every row after it — the same
// concern metricsRev was introduced for. Read menuSeconds as a breakdown of
// play time, not as a slice removed from it.

/** Opens counted since the last beat that landed. Keyed by PanelId. */
let pending: Record<string, number> = {};

/** Count one opening of a panel. Called on the transition INTO a panel, so
 *  re-rendering an open menu — or closing one — never inflates the count. */
export function notePanelOpen(panel: string): void {
	if (!panel) return;
	pending[panel] = (pending[panel] || 0) + 1;
}

/** The opens waiting to be reported, or undefined if there are none (so the
 *  heartbeat body stays empty in the overwhelmingly common case). The caller
 *  must pass whatever it gets back to settlePanelOpens once the beat lands. */
export function snapshotPanelOpens(): Record<string, number> | undefined {
	const keys = Object.keys(pending);
	return keys.length ? { ...pending } : undefined;
}

/** Clear the opens that were successfully reported.
 *
 *  Subtracts rather than resetting: a panel opened while the beat was in flight
 *  has already been counted into `pending` but was NOT in the snapshot the
 *  server received, and resetting would throw it away. A failed beat settles
 *  nothing, so the counts simply ride along on the next one. */
export function settlePanelOpens(sent: Record<string, number> | undefined): void {
	if (!sent) return;
	for (const [panel, n] of Object.entries(sent)) {
		const left = (pending[panel] || 0) - n;
		if (left > 0) pending[panel] = left;
		else delete pending[panel];
	}
}

/** Drop everything buffered (a new save signing in — opens belong to the save
 *  that made them, and an unsent buffer must not follow the player to another). */
export function resetPanelOpens(): void {
	pending = {};
}
