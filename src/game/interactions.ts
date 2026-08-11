// Small, framework-free helpers for world-click intent, factored out of
// WorldScene so they can be unit-tested without booting Phaser.

export interface ClickContext {
	/** The currently selected toolbelt tool, e.g. 'paint', 'basket', or null. */
	tool: string | null;
	/** Is the player currently inside their home interior? */
	isHome: boolean;
	/** Is an object being placed (cursor carries a crafted item)? */
	placing: boolean;
	/** Is an existing placement being moved? */
	moving: boolean;
}

/**
 * Whether a click should paint (indoor paint tool) rather than do something
 * else. While placing or moving an object a click means "drop it here", so the
 * paint tool must NOT take over — placement/move win.
 */
export function canPaintClick(ctx: ClickContext): boolean {
	return ctx.tool === 'paint' && ctx.isHome && !ctx.placing && !ctx.moving;
}

// ------------------------------------------------------- sleeping furniture

/** The two things you can sleep on. Mirrors SLEEPABLE_OBJECTS in
 *  server/resources.ts, which is the authoritative copy. */
export const SLEEPABLE_OBJECTS: ReadonlySet<string> = new Set(['home-bed', 'home-sleeping-bag']);

export const isSleepable = (objectId: string | null | undefined): boolean =>
	!!objectId && SLEEPABLE_OBJECTS.has(objectId);

/**
 * Whether a bed at (tx, ty) would block the way in and out of an interior.
 *
 * Sleeping skips the clock forward to the next dawn, so a bed left sitting in
 * the doorway is a trap: you cross it every time you try to leave. Refuse the
 * door tile and the eight around it (Chebyshev distance ≤ 1) so there's always a
 * clear step through. Non-sleepable furniture is unaffected — an ornament by the
 * door is harmless.
 *
 * The server enforces the same rule in PlaceObject and MoveObject; this copy
 * exists so the placement ghost reads red instead of the click being rejected.
 */
export function blocksDoorway(
	objectId: string | null | undefined,
	door: { doorX: number; doorY: number },
	tx: number,
	ty: number,
): boolean {
	if (!isSleepable(objectId)) return false;
	return Math.abs(tx - door.doorX) <= 1 && Math.abs(ty - door.doorY) <= 1;
}

// --------------------------------------------------------------- trail gates

/** Geometry of one area's trail gates, as WorldScene.dimsOf() computes it. */
export interface GateGeom {
	/** Row the gates sit on (playTop + baseRows / 2 - 0.2). */
	gateY: number;
	/** First column of ocean/void — the gate back out sits just inside it. */
	landRight: number;
	/** Is there a gate on the west edge (every area but the first)? */
	westGate: boolean;
	/** Is there a gate on the east edge (every area but the last)? */
	eastGate: boolean;
}

/** The one field of a biome definition the gate rules read. */
export interface GateBiome {
	id: string;
	order?: number;
}

/**
 * Which edges of an area lead somewhere.
 *
 * Derived from `order` in data/biomes.json — the first area has nothing to its
 * west, the last has open ocean to its east — because that is exactly how
 * gateGeomOf() decides it in server/resources.ts. The two used to be worked out
 * differently (the client walked a hardcoded area list and special-cased the
 * coast by name), which meant reordering the trail, or adding an area to it,
 * would have moved the gates on one side and not the other: the client would
 * grey out the wrong tiles, or let a click through to be refused by the server.
 * There is one rule now and it lives in the data.
 */
export function gateEdges(
	biomes: readonly GateBiome[] | undefined,
	area: string,
): { westGate: boolean; eastGate: boolean } {
	const list = biomes || [];
	const order = list.find((b) => b.id === area)?.order || 1;
	const last = list.length ? Math.max(...list.map((b) => b.order || 1)) : order;
	return { westGate: order > 1, eastGate: order < last };
}

/**
 * Whether flooding (tx, ty) would wall off a trail gate.
 *
 * Open water blocks walking, so a channel dug across the mouth of a gate locks
 * the player out of the next biome entirely — the gate is an interactable you
 * have to stand next to, and you cannot stand in water. Refuse the gate tile
 * and the pocket around it (one row either side, the two columns in from each
 * edge) so there is always a dry step through.
 *
 * Only flooding is refused. A tilled or watered soil bed is walkable and
 * perfectly fine on the trail. The server enforces the same rule in Terraform;
 * this copy exists so the click is blocked with a message instead of making a
 * round trip to be rejected.
 */
export function blocksGateTrail(tx: number, ty: number, g: GateGeom): boolean {
	if (Math.abs(ty - Math.round(g.gateY)) > 1) return false;
	if (g.westGate && tx <= 2) return true;
	if (g.eastGate && tx >= g.landRight - 3) return true;
	return false;
}

// ------------------------------------------------------------ tween hygiene

/**
 * Phaser tweens are fire-and-forget: the manager drops one when it COMPLETES.
 * A `repeat: -1` tween never completes, and destroying the sprite it drives does
 * NOT remove it — so it keeps ticking against a dead object for the rest of the
 * session, costing frame time and holding the object in memory.
 *
 * That was the session-long slowdown only a re-login cleared: the world layers
 * are rebuilt constantly, every rebuild destroyed sprites carrying looping
 * tweens (swaying grass, bobbing water, pulsing nodes, breathing animals), and
 * the orphans piled up. Logging out "fixed" it because scene shutdown destroys
 * the whole TweenManager.
 *
 * Split out here so the rule can be tested without booting Phaser.
 */

/** Minimal shape of the bits we judge. A live Phaser GameObject has a `scene`;
 *  `destroy()` nulls it. Plain objects never had one. */
export interface TweenTargetLike {
	scene?: unknown;
}

/**
 * Should this tween be swept?
 *
 * Only game objects are judged: a tween may legitimately drive a plain value
 * holder (the weather cross-fade animates a `{ t: 0 }` counter), which has no
 * lifecycle and must never be swept. A tween goes only when EVERY game-object
 * target it has is destroyed — one live target means it's still doing work.
 */
export function isOrphanedTween(targets: unknown[] | undefined, isGameObject: (t: unknown) => boolean): boolean {
	if (!targets?.length) return false;
	const judged = targets.filter(isGameObject) as TweenTargetLike[];
	if (!judged.length) return false; // plain-object targets: not ours to judge
	return judged.every((t) => !t.scene);
}

// -------------------------------------------------------- night-light mask

/**
 * Where a screen-space overlay must sit, and at what scale, to render 1:1 over
 * the viewport despite the camera's zoom.
 *
 * Phaser's camera matrix is `translate(x + origin) · scale(zoom) · translate(-origin)`,
 * so an object with `scrollFactor: 0` at position `p` lands at
 * `screen = p·zoom + origin·(1 − zoom) + camX`. A BitmapMask is rendered through
 * that same camera and then sampled in screen space, so a mask left at scale 1
 * and position 0 comes out `zoom`× too big and offset — which put every stamped
 * light at zoom² of its intended position, sliding the campfire halo off the
 * fire as the camera scrolled.
 *
 * Solving `screen = 0` for `p` and cancelling the scale gives the values below.
 */
export function screenSpaceOverlayTransform(cam: {
	width: number;
	height: number;
	originX: number;
	originY: number;
	zoom: number;
	x?: number;
	y?: number;
}): { scale: number; x: number; y: number } {
	const invZoom = 1 / cam.zoom;
	return {
		scale: invZoom,
		x: cam.width * cam.originX * (1 - invZoom) - (cam.x ?? 0) * invZoom,
		y: cam.height * cam.originY * (1 - invZoom) - (cam.y ?? 0) * invZoom,
	};
}

/** Where a world point renders on screen, given the camera's visible world rect. */
export const worldToScreen = (world: number, viewEdge: number, zoom: number): number => (world - viewEdge) * zoom;
