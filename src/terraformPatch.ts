import type { GameState } from './types';

/**
 * Fold a `POST /Terraform/` response into the local snapshot.
 *
 * Digging and watering used to cost two serial round trips: the terraform call,
 * then a full `GET /GameState/` refetch before the soil could be drawn. That
 * second trip re-downloaded the entire terrain array — which grows by a row on
 * every dig — so the wait got longer the more you dug. Terraform already returns
 * the finished tile, the player's new inventory and the recalculated biome state,
 * which is everything the refetch was needed for.
 *
 * Returns the next state, or null to say "I can't reconstruct this — go fetch the
 * authoritative snapshot instead". Kept as a pure function so it can be tested
 * against the real server's responses without a React tree.
 */
export function applyTerraformResult(r: any, prev: GameState, area: string, x: number, y: number): GameState | null {
	if (!r?.ok) return null;
	// An animal coming home or a biome unlocking reshapes far more than this one
	// tile (discoveries, unlock flags, feed entries), so take the full snapshot.
	if (r.newAnimals?.length || r.unlockedBiomes?.length) return null;
	// Drop the old row at this position — by id when the server named one, and by
	// position too, since legacy beds can carry an id that predates the current
	// scheme (see findTerrainAt on the server).
	// A late-tier shovel or can shapes a run of tiles in one action, so the server
	// reports `tiles` (the clicked one first) alongside the single `tile` older
	// clients read. Dropping every square the response names — by id and by
	// position — keeps this correct for a run without costing a refetch.
	const shaped: any[] = Array.isArray(r.tiles) && r.tiles.length ? r.tiles : r.tile ? [r.tile] : [];
	const gone = new Set([r.removedId, ...shaped.map((tt: any) => tt.id)].filter(Boolean));
	const at = new Set([`${area},${x},${y}`, ...shaped.map((tt: any) => `${tt.area},${tt.x},${tt.y}`)]);
	const terrain = (prev.terrain || []).filter((tt: any) => !gone.has(tt.id) && !at.has(`${tt.area},${tt.x},${tt.y}`));
	terrain.push(...shaped);
	const next: GameState = { ...prev, terrain };
	if (r.inventory) next.player = { ...prev.player, inventory: r.inventory };
	if (r.biomeState)
		next.biomeStates = (prev.biomeStates || []).map((b) => (b.biomeId === r.biomeState.biomeId ? r.biomeState : b));
	return next;
}
