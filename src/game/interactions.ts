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
