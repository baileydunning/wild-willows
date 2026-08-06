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
