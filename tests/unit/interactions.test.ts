import { describe, it, expect } from 'vitest';
import {
	canPaintClick,
	blocksDoorway,
	blocksGateTrail,
	gateEdges,
	isSleepable,
	isOrphanedTween,
	screenSpaceOverlayTransform,
	worldToScreen,
	arrivalKind,
	pinwheelSpin,
} from '../../src/game/interactions';

// The west→east walking order of the preserve, as WorldScene holds it.
const ORDER = ['meadow', 'forest', 'wetland', 'desert', 'alpine', 'coastal'];

describe('arrivalKind', () => {
	it('THE BUG: a second transition to the area you are already in must not move you', () => {
		// Stepping outside is a round trip, and the door is clickable twice. The
		// duplicate landed after the scene had already moved to the meadow, so it
		// asked for a meadow→meadow "crossing" — which fell through to the
		// came-from-a-neighbour rule and put the caretaker at the east trail gate,
		// halfway across the map from the house they just walked out of.
		expect(arrivalKind('meadow', 'meadow', ORDER)).toBe('in-place');
		expect(arrivalKind('meadow', 'meadow', ORDER)).not.toBe('east-edge');
		// …and it is not a meadow quirk: every area has to stand still for its own id.
		for (const a of ORDER) expect(arrivalKind(a, a, ORDER)).toBe('in-place');
	});

	it('puts you in front of the tent door when you step out of your home', () => {
		expect(arrivalKind('meadow', 'home', ORDER)).toBe('camp-door');
	});

	it('puts you in front of a trail tent when you step out of one', () => {
		expect(arrivalKind('forest', 'tent-forest', ORDER, true)).toBe('tent-door');
	});

	it('falls back rather than guessing when the tent it named is not pitched', () => {
		// No placement to stand in front of — 'tent-forest' is in no walking order,
		// so there is nothing to derive an edge from either.
		expect(arrivalKind('forest', 'tent-forest', ORDER, false)).toBe('default');
	});

	it('enters on the edge facing where you came from', () => {
		expect(arrivalKind('forest', 'meadow', ORDER)).toBe('west-edge');
		expect(arrivalKind('meadow', 'forest', ORDER)).toBe('east-edge');
		// Skipping biomes (the map's travel button) still faces the right way.
		expect(arrivalKind('coastal', 'meadow', ORDER)).toBe('west-edge');
		expect(arrivalKind('meadow', 'coastal', ORDER)).toBe('east-edge');
	});

	it('falls back for an area it has never heard of', () => {
		expect(arrivalKind('forest', 'somewhere-else', ORDER)).toBe('default');
		expect(arrivalKind('brand-new-biome', 'meadow', ORDER)).toBe('default');
		// The home interior is not on the trail, and only the meadow lets out of it.
		expect(arrivalKind('forest', 'home', ORDER)).toBe('default');
	});
});

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

describe('gateEdges — one rule, read from the biome order', () => {
	// The same six areas data/biomes.json ships, deliberately out of order: the
	// answer must come from `order`, not from where a biome sits in the array.
	const BIOMES = [
		{ id: 'coastal', order: 6 },
		{ id: 'meadow', order: 1 },
		{ id: 'alpine', order: 5 },
		{ id: 'forest', order: 2 },
		{ id: 'desert', order: 4 },
		{ id: 'wetland', order: 3 },
	];

	it('gives the first area no way west and the last no way east', () => {
		expect(gateEdges(BIOMES, 'meadow')).toEqual({ westGate: false, eastGate: true });
		expect(gateEdges(BIOMES, 'coastal')).toEqual({ westGate: true, eastGate: false });
	});

	it('gives every area in between a gate on both edges', () => {
		for (const id of ['forest', 'wetland', 'desert', 'alpine']) {
			expect(gateEdges(BIOMES, id), id).toEqual({ westGate: true, eastGate: true });
		}
	});

	it('follows the data when the trail is reordered, rather than a hardcoded list', () => {
		// Drop a seventh area on the end: the coast stops being last, so its east
		// gate opens. A client walking a fixed area list would still be closing it.
		const extended = [...BIOMES, { id: 'tundra', order: 7 }];
		expect(gateEdges(extended, 'coastal')).toEqual({ westGate: true, eastGate: true });
		expect(gateEdges(extended, 'tundra')).toEqual({ westGate: true, eastGate: false });
	});

	it('never claims a gate it cannot place when the definitions have not loaded', () => {
		// A scene can draw a frame before bridge.shared.data arrives. Answering
		// "no gates" is the safe default: it greys nothing out that should be legal.
		expect(gateEdges(undefined, 'forest')).toEqual({ westGate: false, eastGate: false });
		expect(gateEdges([], 'forest')).toEqual({ westGate: false, eastGate: false });
	});
});

describe('blocksGateTrail — water never seals a trail gate', () => {
	// A middle biome: 30 cols, 26 playable rows, so the gates sit on row 12.8 and
	// there is a gate on both edges. Open water blocks walking, so flooding the
	// mouth of a gate would lock the player out of the neighbouring biome.
	const middle = { gateY: 12.8, landRight: 30, westGate: true, eastGate: true };

	it('blocks the two columns in from the west gate, on the gate row and either side', () => {
		for (const ty of [12, 13, 14]) {
			expect(blocksGateTrail(1, ty, middle)).toBe(true);
			expect(blocksGateTrail(2, ty, middle)).toBe(true);
		}
	});

	it('blocks the matching pocket at the east gate', () => {
		for (const ty of [12, 13, 14]) {
			expect(blocksGateTrail(27, ty, middle)).toBe(true);
			expect(blocksGateTrail(28, ty, middle)).toBe(true);
		}
	});

	it('leaves the rest of the shoreline floodable', () => {
		expect(blocksGateTrail(4, 13, middle)).toBe(false); // clear of the gate column
		expect(blocksGateTrail(1, 10, middle)).toBe(false); // same column, well above the gate
		expect(blocksGateTrail(15, 13, middle)).toBe(false); // mid-map, gate row
	});

	it('only guards edges that actually have a gate', () => {
		const first = { ...middle, westGate: false }; // Willow Meadow: no gate west
		expect(blocksGateTrail(1, 13, first)).toBe(false);
		const last = { ...middle, eastGate: false, landRight: 26 }; // Pelican Shore: ocean east
		expect(blocksGateTrail(24, 13, last)).toBe(false);
		expect(blocksGateTrail(1, 13, last)).toBe(true); // still has its way back west
	});

	it('follows the alpine gates down past the mountain band', () => {
		const alpine = { gateY: 20.8, landRight: 30, westGate: true, eastGate: true };
		expect(blocksGateTrail(1, 21, alpine)).toBe(true);
		expect(blocksGateTrail(1, 13, alpine)).toBe(false); // where a lowland gate would be
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
	it('recognises the things you can sleep on', () => {
		expect(isSleepable('home-bed')).toBe(true);
		expect(isSleepable('home-sleeping-bag')).toBe(true);
		// The hammock is NOT one of them, and used to be. Sleeping skips the clock
		// to the next dawn; lying in a hammock is the one piece of furniture you
		// get into precisely to let an afternoon go by at its own speed. It is a
		// seat now (SEATS in WorldScene) — you lie in it and the animals come over.
		expect(isSleepable('hammock')).toBe(false);
	});

	it('rejects lookalikes and non-furniture', () => {
		// 'reed-bed' / 'eelgrass-bed' are outdoor habitat, not somewhere you sleep.
		for (const id of ['reed-bed', 'eelgrass-bed', 'oyster-bed', 'workbench', '', null, undefined]) {
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

describe('pinwheelSpin', () => {
	const TAU = Math.PI * 2;
	/** Where the blades end up, wrapped back into a single turn. */
	const lands = (from: number, rest: number, turns = 3) => {
		const end = from + pinwheelSpin(from, rest, turns);
		return ((end % TAU) + TAU) % TAU;
	};
	const wrap = (a: number) => ((a % TAU) + TAU) % TAU;

	it('is a clean number of turns when it starts from rest', () => {
		expect(pinwheelSpin(0, 0, 3)).toBeCloseTo(TAU * 3, 10);
		// a placement with a lean: the lean is the rest pose, not an offset to undo
		expect(pinwheelSpin(0.06, 0.06, 3)).toBeCloseTo(TAU * 3, 10);
	});

	it('THE BUG: a nudge mid-spin still winds down on the pole', () => {
		// Blades are a separate image pinned to the post. Adding a flat three turns
		// to wherever the last spin had got to left the fan resting a few degrees
		// round from the pole it is supposed to be pinned to — and every impatient
		// second press walked it further out, until the pinwheel sat visibly askew.
		const rest = 0.06;
		for (const caught of [0.9, 2.4, 4.7, 6.0]) {
			expect(lands(caught, rest)).toBeCloseTo(wrap(rest), 10);
		}
	});

	it('always turns forwards, never back a few degrees to reach rest', () => {
		// Reversing to land on the rest pose would read as the wind changing rather
		// than as the pinwheel slowing down.
		for (const caught of [0.1, 1.0, 3.3, 5.9]) {
			expect(pinwheelSpin(caught, 0.06, 3)).toBeGreaterThan(0);
			// and never so far that it overshoots the turns it was asked for
			expect(pinwheelSpin(caught, 0.06, 3)).toBeLessThan(TAU * 4);
		}
	});
});
