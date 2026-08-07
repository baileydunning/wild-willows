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
	const gone = new Set([r.removedId, r.tile?.id].filter(Boolean));
	const terrain = (prev.terrain || []).filter(
		(tt: any) => !gone.has(tt.id) && !(tt.area === area && tt.x === x && tt.y === y),
	);
	if (r.tile) terrain.push(r.tile);
	const next: GameState = { ...prev, terrain };
	if (r.inventory) next.player = { ...prev.player, inventory: r.inventory };
	if (r.biomeState)
		next.biomeStates = (prev.biomeStates || []).map((b) => (b.biomeId === r.biomeState.biomeId ? r.biomeState : b));
	return next;
}
