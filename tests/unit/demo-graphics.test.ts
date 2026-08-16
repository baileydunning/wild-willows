import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The itch demo runs in an iframe on a stranger's machine, next to whatever else
// they have open, and it is the first thing anyone sees of the game. The hardware
// autodetect is written to be optimistic — it only drops to 'low' on signals it
// really trusts — which is right for a player who chose to install the game and
// wrong for a demo that has one shot at not stuttering. So the demo build starts
// on 'low' regardless of what the machine reports.
//
// It is a DEFAULT, not a lock: a saved preference still wins, and the title
// screen carries the toggle.

const loadDetect = async (demo: boolean) => {
	vi.doMock('../../src/demo', () => ({
		DEMO: demo,
		DEMO_FOREST_BIOME: 'forest',
		EDITION: demo ? 'demo' : 'full',
		DEMO_WEB_BACKEND: 'harper',
	}));
	const mod = await import('../../src/prefs');
	return mod;
};

/** The autodetect reads navigator; pretend to be a capable machine so that any
 *  'low' we see is the demo rule and not the hardware one. */
const beCapable = () => {
	vi.stubGlobal('navigator', { ...globalThis.navigator, hardwareConcurrency: 16, deviceMemory: 16 });
};

beforeEach(() => {
	vi.resetModules();
	beCapable();
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.doUnmock('../../src/demo');
});

describe('graphics quality the first time the game is opened', () => {
	it('starts the browser demo on low even on capable hardware', async () => {
		const { detectDefaultGraphicsQuality } = await loadDetect(true);
		expect(detectDefaultGraphicsQuality()).toBe('low');
	});

	it('leaves the full game on high, where the autodetect decides', async () => {
		const { detectDefaultGraphicsQuality } = await loadDetect(false);
		expect(detectDefaultGraphicsQuality()).toBe('high');
	});

	it('still respects a saved choice in the demo, because this is only a default', async () => {
		const { normalizePrefs } = await loadDetect(true);
		// A demo player who turned the pretty version back on keeps it.
		expect(normalizePrefs({ graphicsQuality: 'high' }, false, 'low').graphicsQuality).toBe('high');
	});

	it('does not force low on the desktop build', async () => {
		// A DEMO-flagged desktop build is not a thing we ship, but the rule is
		// written as "demo AND not desktop" to match how every other demo/desktop
		// default in the app is spelled, so pin that behaviour down.
		vi.stubGlobal('wildWillowsDesktop', { isDesktop: true });
		const { detectDefaultGraphicsQuality } = await loadDetect(true);
		expect(detectDefaultGraphicsQuality()).toBe('high');
	});

	it('still drops to low on genuinely weak hardware outside the demo', async () => {
		vi.stubGlobal('navigator', { ...globalThis.navigator, hardwareConcurrency: 2 });
		const { detectDefaultGraphicsQuality } = await loadDetect(false);
		expect(detectDefaultGraphicsQuality()).toBe('low');
	});
});
