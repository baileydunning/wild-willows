import { describe, it, expect } from 'vitest';
import { canPaintClick, blocksDoorway, isSleepable, isOrphanedTween } from '../../src/game/interactions';

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
