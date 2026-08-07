import { describe, it, expect } from 'vitest';
import {
	canPaintClick,
	blocksDoorway,
	isSleepable,
	isOrphanedTween,
	screenSpaceOverlayTransform,
	worldToScreen,
} from '../../src/game/interactions';

describe('canPaintClick', () => {
	it('paints when the paint tool is selected indoors and nothing is being placed/moved', () => {
		expect(canPaintClick({ tool: 'paint', isHome: true, placing: false, moving: false })).toBe(true);
	});

	it('does NOT paint while placing an object (a click should drop it instead)', () => {
		expect(canPaintClick({ tool: 'paint', isHome: true, placing: true, moving: false })).toBe(false);
	});

	it('does NOT paint while moving an existing placement', () => {
		expect(canPaintClick({ tool: 'paint', isHome: true, placing: false, moving: true })).toBe(false);
	});

	it('only paints indoors', () => {
		expect(canPaintClick({ tool: 'paint', isHome: false, placing: false, moving: false })).toBe(false);
	});

	it('only paints with the paint tool selected', () => {
		expect(canPaintClick({ tool: 'basket', isHome: true, placing: false, moving: false })).toBe(false);
		expect(canPaintClick({ tool: null, isHome: true, placing: false, moving: false })).toBe(false);
	});
});

describe('blocksDoorway — beds stay clear of the exit', () => {
	// Sleeping jumps the clock to dawn, so a bed in the doorway is a trap you
	// cross every time you try to leave. Mirrors the authoritative server rule.
	const door = { doorX: 11, doorY: 12 };

	it('blocks the door tile itself', () => {
		expect(blocksDoorway('home-bed', door, 11, 12)).toBe(true);
	});

	it('blocks all eight tiles around the door, diagonals included', () => {
		for (let dx = -1; dx <= 1; dx++) {
			for (let dy = -1; dy <= 1; dy++) {
				expect(blocksDoorway('home-sleeping-bag', door, door.doorX + dx, door.doorY + dy)).toBe(true);
			}
		}
	});

	it('allows two tiles away in any direction', () => {
		expect(blocksDoorway('home-bed', door, 11, 10)).toBe(false);
		expect(blocksDoorway('home-bed', door, 9, 12)).toBe(false);
		expect(blocksDoorway('home-bed', door, 13, 14)).toBe(false);
	});

	it('only applies to sleepable furniture', () => {
		expect(blocksDoorway('garden-gnome', door, 11, 12)).toBe(false);
		expect(blocksDoorway('small-chest', door, 11, 12)).toBe(false);
	});

	it('is safe with no object selected', () => {
		expect(blocksDoorway(null, door, 11, 12)).toBe(false);
		expect(blocksDoorway(undefined, door, 11, 12)).toBe(false);
	});
});

describe('isSleepable', () => {
	it('recognises exactly the two sleepables', () => {
		expect(isSleepable('home-bed')).toBe(true);
		expect(isSleepable('home-sleeping-bag')).toBe(true);
	});

	it('rejects lookalikes and non-furniture', () => {
		// 'reed-bed' / 'eelgrass-bed' are outdoor habitat, not somewhere you sleep.
		for (const id of ['reed-bed', 'eelgrass-bed', 'oyster-bed', 'hammock', 'workbench', '', null, undefined]) {
			expect(isSleepable(id as any)).toBe(false);
		}
	});
});

describe('isOrphanedTween — the session-long slowdown', () => {
	// Phaser drops a tween when it COMPLETES. A `repeat: -1` tween never does, and
	// destroying its sprite doesn't remove it, so every world rebuild left looping
	// tweens ticking against dead objects. They accumulated for the whole session,
	// which is why only logging out (scene shutdown → TweenManager destroyed)
	// cleared it.
	const live = { scene: {} }; // a live Phaser GameObject
	const dead = { scene: null }; // destroy() nulls `scene`
	const plain = { t: 0.5 }; // the weather cross-fade's value holder
	const isGO = (t: unknown) => t === live || t === dead;

	it('sweeps a tween whose only target was destroyed', () => {
		expect(isOrphanedTween([dead], isGO)).toBe(true);
	});

	it('keeps a tween whose target is alive', () => {
		expect(isOrphanedTween([live], isGO)).toBe(false);
	});

	it('keeps a multi-target tween while ANY target is alive', () => {
		expect(isOrphanedTween([dead, live], isGO)).toBe(false);
		expect(isOrphanedTween([live, dead, dead], isGO)).toBe(false);
	});

	it('sweeps only when every game-object target is dead', () => {
		expect(isOrphanedTween([dead, dead], isGO)).toBe(true);
	});

	it('never touches a tween driving a plain value holder', () => {
		// The weather cross-fade animates `{ t: 0 }` — no lifecycle, must survive.
		expect(isOrphanedTween([plain], isGO)).toBe(false);
	});

	it('ignores plain targets when judging a mixed tween', () => {
		expect(isOrphanedTween([plain, dead], isGO)).toBe(true);
		expect(isOrphanedTween([plain, live], isGO)).toBe(false);
	});

	it('is safe with no targets at all', () => {
		expect(isOrphanedTween(undefined, isGO)).toBe(false);
		expect(isOrphanedTween([], isGO)).toBe(false);
	});

	it('treats undefined scene as destroyed too', () => {
		expect(isOrphanedTween([{ scene: undefined }], () => true)).toBe(true);
	});
});

describe('screenSpaceOverlayTransform — the campfire halo drift', () => {
	// Phaser's camera matrix is translate(x+origin) · scale(zoom) · translate(-origin),
	// so a scrollFactor-0 object at p renders at  p·zoom + origin·(1 − zoom) + camX.
	// The night-light mask is rendered THROUGH that camera (BitmapMask does) and
	// then sampled in screen space — so left at scale 1 / position 0 it came out
	// zoom× too large, putting each stamped light at zoom² of its intended screen
	// position. The halo slid off its fire as the camera scrolled.
	const cam = (zoom: number, width = 2550, height = 1532) => ({
		width,
		height,
		originX: 0.5,
		originY: 0.5,
		zoom,
	});
	/** Phaser's transform for a scrollFactor-0 object. */
	const render = (p: number, size: number, scale: number, zoom: number, origin: number) => ({
		start: p * zoom + origin * (1 - zoom),
		size: size * scale * zoom,
	});

	it('is the identity at zoom 1 — which is why the bug hid for so long', () => {
		const t = screenSpaceOverlayTransform(cam(1));
		expect(t).toEqual({ scale: 1, x: 0, y: 0 });
	});

	it('puts the overlay exactly over the viewport at every zoom', () => {
		for (const zoom of [0.85, 1, 1.7, 2.5, 4, 5.2]) {
			const c = cam(zoom);
			const t = screenSpaceOverlayTransform(c);
			const r = render(t.x, c.width, t.scale, zoom, c.width * c.originX);
			expect(r.start).toBeCloseTo(0, 6); // flush to the left edge
			expect(r.size).toBeCloseTo(c.width, 6); // and exactly one screen wide
		}
	});

	it('does the same vertically', () => {
		for (const zoom of [1.3, 2.5, 4]) {
			const c = cam(zoom);
			const t = screenSpaceOverlayTransform(c);
			const r = render(t.y, c.height, t.scale, zoom, c.height * c.originY);
			expect(r.start).toBeCloseTo(0, 6);
			expect(r.size).toBeCloseTo(c.height, 6);
		}
	});

	it('honours a camera that is not at the window origin', () => {
		const c = { ...cam(2), x: 120, y: 40 };
		const t = screenSpaceOverlayTransform(c);
		expect(t.x * c.zoom + c.width * c.originX * (1 - c.zoom) + c.x).toBeCloseTo(0, 6);
		expect(t.y * c.zoom + c.height * c.originY * (1 - c.zoom) + c.y).toBeCloseTo(0, 6);
	});

	it('THE BUG: a light stays put on its fire while the camera scrolls', () => {
		const c = cam(2.5);
		const origin = c.width * c.originX;
		const t = screenSpaceOverlayTransform(c);
		const FIRE = 4000; // fixed world x

		// Walk the camera past the fire and check the halo tracks it exactly.
		const errors = [3200, 3500, 3800, 4100, 4400].map((viewEdge) => {
			const want = worldToScreen(FIRE, viewEdge, c.zoom);
			// stamped at texture coord = intended screen coord, then rendered:
			const got = render(t.x + want * t.scale, 0, t.scale, c.zoom, origin).start;
			return Math.abs(got - want);
		});
		for (const e of errors) expect(e).toBeLessThan(1e-6);
	});

	it('and the old transform did NOT — the error changes as you walk', () => {
		const c = cam(2.5);
		const origin = c.width * c.originX;
		const FIRE = 4000;
		// Old behaviour: RT at scale 1, position 0.
		const errs = [3200, 3800, 4400].map((viewEdge) => {
			const want = worldToScreen(FIRE, viewEdge, c.zoom);
			const got = render(0 + want, 0, 1, c.zoom, origin).start;
			return got - want;
		});
		// Not merely wrong — wrong by a DIFFERENT amount each step, i.e. drift.
		expect(new Set(errs.map((e) => Math.round(e))).size).toBe(errs.length);
		expect(Math.abs(errs[2] - errs[0])).toBeGreaterThan(100);
	});
});
