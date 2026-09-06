import type { GameState, Placement } from './types';

/**
 * Fold a gameplay POST response into the local snapshot.
 *
 * The sibling of `applyTerraformResult` (src/terraformPatch.ts), for the six
 * verbs that were still paying for it twice.
 *
 * Every action used to cost TWO serial round trips: the POST that did the thing,
 * then a blocking `GET /GameState/` before anything could be drawn. The second
 * trip re-downloads the whole world — every placement, every terrain tile, the
 * feed — uncompressed, so it got slower the more the player had built, and it
 * lands on whichever continent the Harper node is on. Terraform was fixed this
 * way and the other six were left behind, even though each of their responses
 * already carries exactly what the refetch was wanted for.
 *
 * RULES, and they are what keep this safe:
 *
 *  1. Every function returns `null` to mean "I cannot reconstruct this — go get
 *     the authoritative snapshot instead". Returning null is always correct and
 *     costs only what today already costs, so when in doubt, return null.
 *  2. Only fields the server actually SENT are written. Nothing is inferred from
 *     what the client believes the rules are — that is how a client model drifts
 *     from the server's and stays wrong until a reload.
 *  3. An action that reshaped more than its own footprint (an animal came home, a
 *     biome unlocked) bails out wholesale. Those touch discoveries, unlock flags,
 *     achievements and feed entries the response does not enumerate.
 *
 * `scheduleReconcile()` in state.tsx re-fetches the real snapshot shortly after
 * the last patched action either way, so anything not modelled here — daily-task
 * progress, achievements — self-corrects within a second or so rather than
 * lasting until the next full refresh.
 *
 * Pure, so it can be tested against the real server's responses with no React
 * tree and no Phaser scene.
 */

/** Anything that reshapes more than the action's own footprint. */
function broadChange(r: any): boolean {
	return !r?.ok || !!r.newAnimals?.length || !!r.unlockedBiomes?.length;
}

/** Replace one placement by id, or append it if it is new. Never both. */
function withPlacement(prev: GameState, placement: Placement): Placement[] {
	const next = (prev.placements || []).filter((p) => p.id !== placement.id);
	next.push(placement);
	return next;
}

/** Fold in a recalculated biome, if the response carried one. */
function withBiomeState(prev: GameState, next: GameState, r: any): GameState {
	if (!r.biomeState) return next;
	return {
		...next,
		biomeStates: (prev.biomeStates || []).map((b) => (b.biomeId === r.biomeState.biomeId ? r.biomeState : b)),
	};
}

/**
 * `POST /CollectResource/` -> `{ ok, gained, inventory, nodeId, harvestedAt }`.
 *
 * The node's cooldown is the whole point of the refetch here: without it the
 * sprite stays a full node until the next refresh and the player gathers a bare
 * patch. The row id is `worldId:area:nodeId` (see nodeAvailable in WorldScene),
 * falling back to the player id for solo and legacy rows exactly as the reader
 * does, so the two can never disagree about which row they mean.
 */
export function applyCollectResult(r: any, prev: GameState, area: string): GameState | null {
	if (broadChange(r)) return null;
	if (!r.inventory || !r.nodeId || typeof r.harvestedAt !== 'number') return null;
	// An overflowing basket sent part of the haul on to a chest; chest contents
	// are not modelled here, so take the authoritative snapshot instead.
	if (r.storedTo) return null;
	const wid = (prev as any).worldId || prev.player.id;
	// A sweeping basket clears a whole patch, so the server reports every spot it
	// took in `harvested`; anything older (or any lower tier) reports the one.
	const cleared: string[] = Array.isArray(r.harvested) && r.harvested.length ? r.harvested : [r.nodeId];
	const ids = new Set(cleared.map((n: string) => `${wid}:${area}:${n}`));
	const nodeStates = (prev.nodeStates || []).filter((n) => !ids.has(n.id));
	for (const id of ids) nodeStates.push({ id, harvestedAt: r.harvestedAt });
	const next: GameState = {
		...prev,
		player: { ...prev.player, inventory: r.inventory },
		nodeStates,
	};
	// Credit the pickup to any gather-counting goal right away. `gained` is what
	// the server actually granted (basket room can trim it), so the local number
	// and the server's lifetime tally stay in step.
	const gained = Number(r.gained?.[r.resourceId ?? ''] ?? 0);
	return r.resourceId && gained > 0 ? withEventTaskProgress(next, 'gather', gained, String(r.resourceId)) : next;
}

/**
 * `POST /Plant/` -> `{ ok, placement, inventory, usedFrom, perkGrowth, ...recalc }`.
 *
 * Sowing CONSUMES the watered bed it went into, and the response does not name
 * the tile it removed — only the placement it created. The bed is at the
 * placement's own square, so that is what is dropped, by position. Matching on
 * the placement's coordinates rather than the caller's arguments keeps this
 * anchored to what the server actually did.
 */
export function applyPlantResult(r: any, prev: GameState): GameState | null {
	if (broadChange(r)) return null;
	if (!r.placement || !r.inventory) return null;
	const p = r.placement as Placement;
	const terrain = (prev.terrain || []).filter((tt: any) => !(tt.area === p.area && tt.x === p.x && tt.y === p.y));
	const next: GameState = {
		...prev,
		terrain,
		placements: withPlacement(prev, p),
		player: { ...prev.player, inventory: r.inventory },
	};
	return withBiomeState(prev, next, r);
}

/**
 * `POST /PlaceObject/` -> `{ ok, placement, craftedItems, ...recalc }`.
 *
 * No inventory here: placing spends a CRAFTED item, not raw resources.
 */
export function applyPlaceResult(r: any, prev: GameState): GameState | null {
	if (broadChange(r)) return null;
	if (!r.placement || !r.craftedItems) return null;
	const next: GameState = {
		...prev,
		placements: withPlacement(prev, r.placement as Placement),
		player: { ...prev.player, craftedItems: r.craftedItems },
	};
	// One thing is now standing in the world — credit it to the build goal on this
	// frame, not on the next sync.
	return withBiomeState(prev, withEventTaskProgress(next, 'place', 1), r);
}

/**
 * `POST /HarvestPlacement/` -> `{ ok, placementId, gained, inventory, placement }`.
 *
 * The returned placement carries the new `lastHarvestAt`, which is what moves the
 * plant out of harvest-ready and restarts its regrow clock.
 */
export function applyHarvestResult(r: any, prev: GameState): GameState | null {
	if (broadChange(r)) return null;
	if (!r.placement || !r.inventory) return null;
	return {
		...prev,
		placements: withPlacement(prev, r.placement as Placement),
		player: { ...prev.player, inventory: r.inventory },
	};
}

/**
 * `POST /CraftItem/` -> `{ ok, crafted, craftedItems, inventory, chests, usedFrom, refund, unlockedBiomes }`.
 *
 * Crafting can pull materials from chests, so `chests` comes back too and has to
 * be adopted or a chest would still show the spent stack. Crafting the thing that
 * opens a biome is caught by broadChange: an unlock rewrites the player's unlock
 * flags and can seed a whole area's starting terrain.
 */
export function applyCraftResult(r: any, prev: GameState): GameState | null {
	if (broadChange(r)) return null;
	if (!r.craftedItems || !r.inventory) return null;
	const next: GameState = {
		...prev,
		player: { ...prev.player, craftedItems: r.craftedItems, inventory: r.inventory },
	};
	if (r.chests) next.chests = r.chests;
	return next;
}

/**
 * `POST /MoveObject/` -> `{ ok, placement }`.
 *
 * The narrowest of the six: one row moves, nothing else changes. Rotation rides
 * the same endpoint and the same response.
 */
export function applyMoveResult(r: any, prev: GameState): GameState | null {
	if (broadChange(r)) return null;
	if (!r.placement) return null;
	return { ...prev, placements: withPlacement(prev, r.placement as Placement) };
}

/**
 * `POST /RemoveObject/` -> `{ ok, removed, craftedItems, refunded, inventory,
 *                             chestPatches, removedChestId, ...recalc }`.
 *
 * The counterpart to applyPlaceResult, and the last of the build-loop verbs to
 * get one. Two shapes arrive through here and both are handled, because they are
 * the same action from the player's side — pick that up:
 *
 *  • Picking up a CRAFTED object returns it to the crafted-items pouch
 *    (`craftedItems`), leaving raw materials alone.
 *  • Digging up a PLANT refunds its materials instead (`refunded`), which lands
 *    in the basket and, when the basket is full, spills into chests. That is why
 *    the server now sends `inventory` and a `chestPatches` delta: without them
 *    this case could not be reconstructed and had to bail.
 *
 * Taking away a chest deletes its row as well as its placement, so
 * `removedChestId` drops it here too — otherwise the chest panel would keep
 * offering a container that no longer exists until the next full sync.
 *
 * `chestPatches` is applied by id and never appends: a patch names a chest that
 * already existed, and inventing one from a response would be exactly the kind of
 * client-side guess rule 2 above forbids.
 */
export function applyRemoveResult(r: any, prev: GameState): GameState | null {
	if (broadChange(r)) return null;
	if (!r.removed || !r.craftedItems || !r.inventory) return null;
	// An older server (or a replayed response) that predates the delta fields
	// cannot describe a refund, so refuse rather than drop the refunded materials
	// on the floor until the next sync.
	if (r.refunded && !Array.isArray(r.chestPatches)) return null;

	let chests = prev.chests || [];
	if (r.removedChestId) chests = chests.filter((c) => c.id !== r.removedChestId);
	if (r.chestPatches?.length) {
		const byId = new Map<string, any>(r.chestPatches.map((c: any) => [c.id, c.contents]));
		chests = chests.map((c) => (byId.has(c.id) ? { ...c, contents: byId.get(c.id) } : c));
	}

	const next: GameState = {
		...prev,
		placements: (prev.placements || []).filter((p) => p.id !== r.removed),
		chests,
		player: { ...prev.player, craftedItems: r.craftedItems, inventory: r.inventory },
	};
	return withBiomeState(prev, next, r);
}

/**
 * Keep "how much of this are you holding" goals honest between syncs.
 *
 * Every optimistic patch above rewrites the inventory (or the chests) and leaves
 * the task board exactly as the server last sent it, so the opening goal — gather
 * 10 seeds — sat at 0/10 while seeds visibly piled up in the basket, until the
 * trailing reconcile fetched a fresh board a moment later. A counter that lags
 * the thing it counts reads as broken, and it is the FIRST number a new player
 * watches.
 *
 * Only goals the server tagged with a `resourceId` are touched, and they're
 * recomputed the same way the server does it (basket + every chest, minus the
 * goal's baseline). Everything else is left alone: a board is server truth, and
 * guessing at progress rules the client doesn't own is how the two drift.
 */
export function withHeldTaskProgress(next: GameState): GameState {
	const block = next.dailyTasks;
	if (!block?.tasks?.length) return next;
	const held = (id: string) =>
		(next.player?.inventory?.[id] || 0) + (next.chests || []).reduce((sum, c) => sum + (c.contents?.[id] || 0), 0);
	let moved = false;
	const tasks = block.tasks.map((t) => {
		// A monotonic goal counts gathering, not holding — spending its materials
		// must not walk the bar backwards, so it is credited at the pickup instead
		// (withEventTaskProgress) and left alone here.
		if (!t.resourceId || t.monotonic) return t;
		const progress = Math.max(0, Math.min(t.target, held(t.resourceId) - (t.base || 0)));
		if (progress === t.progress) return t;
		moved = true;
		return { ...t, progress };
	});
	return moved ? { ...next, dailyTasks: { ...block, tasks } } : next;
}

/**
 * Credit an action to any goal that counts that action.
 *
 * These goals measure what has been DONE — seeds gathered, things placed in the
 * world — rather than what is currently held or standing, and the server keeps a
 * lifetime tally for each. Mirroring the act locally is what makes the bar move
 * on the same frame as the act itself: the player watched themselves pick the
 * seed up or put the thing down, so a counter that waits for the next sync reads
 * as the game not having noticed. Only ever upward, exactly like the number it
 * is mirroring.
 *
 * `resourceId` narrows a 'gather' credit to one material; a goal that doesn't
 * name one takes any.
 */
export function withEventTaskProgress(
	next: GameState,
	event: 'gather' | 'place',
	amount: number,
	resourceId?: string,
): GameState {
	const block = next.dailyTasks;
	if (!block?.tasks?.length || amount <= 0) return next;
	let moved = false;
	const tasks = block.tasks.map((t) => {
		if (t.event !== event) return t;
		if (t.resourceId && t.resourceId !== resourceId) return t;
		const progress = Math.min(t.target, t.progress + amount);
		if (progress === t.progress) return t;
		moved = true;
		return { ...t, progress };
	});
	return moved ? { ...next, dailyTasks: { ...block, tasks } } : next;
}
