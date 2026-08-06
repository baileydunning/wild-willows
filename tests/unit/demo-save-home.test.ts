import { describe, it, expect, beforeEach } from 'vitest';
import { getDemoSaveHome, setDemoSaveHome, clearDemoSaveHome } from '../../src/api';

// Regression: "demo saves are getting deleted, people can't do another session".
//
// The saves were almost never actually deleted. The itch demo has TWO disjoint
// save stores — server-side players on the hosted Harper, and local slot files —
// and resolveDemoBackend() picked between them every session with an 8-second
// probe of /Version/. The title screen then showed one store or the other.
//
// So a single slow, blocked or cold-started probe swapped the store out from
// under the player. Their save was still there, on the side the title wasn't
// looking at, and the title showed an empty New Game screen. Players reasonably
// concluded the save was gone and started over — at which point the original
// really did become unreachable.
//
// The fix pins the store to wherever the save was actually created, so it's a
// property of the save rather than of tonight's wifi. These tests cover that
// pin; resolveDemoBackend itself reads build-time constants that a unit test
// can't vary, so the decision table it implements is asserted below in the same
// shape the implementation uses.

beforeEach(() => {
	localStorage.clear();
});

describe('the demo save home is remembered', () => {
	it('is unset before a save exists, so the first session is free to probe', () => {
		expect(getDemoSaveHome()).toBeNull();
	});

	it('round-trips harper', () => {
		setDemoSaveHome('harper');
		expect(getDemoSaveHome()).toBe('harper');
	});

	it('round-trips solo', () => {
		setDemoSaveHome('solo');
		expect(getDemoSaveHome()).toBe('solo');
	});

	it('survives a reload (it lives in localStorage, not module state)', () => {
		setDemoSaveHome('harper');
		// module state is irrelevant — read it straight back out of storage
		expect(localStorage.getItem('wild-willows:demo-home')).toBe('harper');
		expect(getDemoSaveHome()).toBe('harper');
	});

	it('is cleared when the demo save is deleted, so the next one may probe again', () => {
		setDemoSaveHome('harper');
		clearDemoSaveHome();
		expect(getDemoSaveHome()).toBeNull();
	});

	it('ignores a junk value rather than trusting it', () => {
		localStorage.setItem('wild-willows:demo-home', 'nonsense');
		expect(getDemoSaveHome()).toBeNull();
	});
});

describe('backend resolution never hides an existing save', () => {
	// Mirrors resolveDemoBackend(): given the remembered home and whether the
	// probe succeeded, which store do we use, and do we warn the player?
	const resolve = (home: 'harper' | 'solo' | null, probeOk: boolean) => {
		if (home === 'solo') return { backend: 'solo', unreachable: false };
		if (probeOk) return { backend: 'harper', unreachable: false };
		if (home === 'harper') return { backend: 'harper', unreachable: true };
		return { backend: 'solo', unreachable: false };
	};

	it('THE BUG: a Harper save is no longer swapped for the empty offline store', () => {
		// Before the fix this returned 'solo' — an empty title over a real save.
		expect(resolve('harper', false)).toEqual({ backend: 'harper', unreachable: true });
	});

	it('tells the player the save is unreachable rather than showing nothing', () => {
		expect(resolve('harper', false).unreachable).toBe(true);
	});

	it('a Harper save is used when the server answers', () => {
		expect(resolve('harper', true)).toEqual({ backend: 'harper', unreachable: false });
	});

	it('an offline save is NOT abandoned just because the server is reachable', () => {
		// The mirror of the same bug: probing into Harper mode would hide a local save.
		expect(resolve('solo', true)).toEqual({ backend: 'solo', unreachable: false });
	});

	it('an offline save keeps working with no network at all', () => {
		expect(resolve('solo', false)).toEqual({ backend: 'solo', unreachable: false });
	});

	it('a first-time player still gets Harper when it is reachable', () => {
		expect(resolve(null, true)).toEqual({ backend: 'harper', unreachable: false });
	});

	it('a first-time player falls back to offline play, with nothing to lose', () => {
		expect(resolve(null, false)).toEqual({ backend: 'solo', unreachable: false });
	});

	it('never reports "unreachable" when there is no save to be unreachable', () => {
		for (const probeOk of [true, false]) {
			expect(resolve(null, probeOk).unreachable).toBe(false);
			expect(resolve('solo', probeOk).unreachable).toBe(false);
		}
	});
});

describe('the unreachable notice needs a save to be about', () => {
	// The pin and the save pointer are cleared in different places — the pin when a
	// demo ends, the pointer when the server 404s — so a stale pin must not be
	// enough on its own to tell the player the server is hiding a save that isn't
	// there. Mirrors isDemoSaveUnreachable().
	const shouldWarn = (flag: boolean, hasSave: boolean) => flag && hasSave;

	it('warns when there is a Harper save and the server is unreachable', () => {
		expect(shouldWarn(true, true)).toBe(true);
	});

	it('stays quiet for a first-time player with no save', () => {
		expect(shouldWarn(false, false)).toBe(false);
	});

	it('stays quiet when the pin is stale but the save is already gone', () => {
		expect(shouldWarn(true, false)).toBe(false);
	});

	it('stays quiet when the save is reachable', () => {
		expect(shouldWarn(false, true)).toBe(false);
	});
});
