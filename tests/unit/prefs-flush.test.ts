import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// The reported bug: dragging a volume slider made the game unplayable.
//
// `onChange` on a range input fires per pixel of travel, and setPrefs used to do
// a synchronous localStorage.setItem AND notify every subscriber on each one —
// including the Phaser scene, which responded to ANY preference change by tearing
// down and rebuilding the whole animal layer and all weather particles.
//
// These tests cover the two halves of the fix that live outside Phaser: the write
// is coalesced, and subscribers get enough information to ignore changes that
// don't affect them.

let frameQueue: FrameRequestCallback[] = [];

function tick(steps = 1) {
	for (let i = 0; i < steps; i++) {
		const due = frameQueue;
		frameQueue = [];
		for (const cb of due) cb(performance.now());
	}
}

beforeEach(() => {
	frameQueue = [];
	vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
		frameQueue.push(cb);
		return frameQueue.length;
	});
	localStorage.clear();
	vi.resetModules();
});

afterEach(() => {
	vi.restoreAllMocks();
});

/** Simulates a drag: many change events in a row, as one gesture. */
const drag = (setPrefs: any, key: string, from: number, to: number, steps: number) => {
	for (let i = 0; i <= steps; i++) setPrefs({ [key]: from + ((to - from) * i) / steps });
};

describe('setPrefs write coalescing', () => {
	it('writes once for a whole slider drag instead of once per event', async () => {
		const { setPrefs } = await import('../../src/prefs');
		const write = vi.spyOn(Storage.prototype, 'setItem');

		drag(setPrefs, 'musicVolume', 0, 1, 100); // 101 change events

		expect(write).not.toHaveBeenCalled(); // nothing written inline
		tick();
		expect(write).toHaveBeenCalledTimes(1);
	});

	it('still persists the final value of the drag', async () => {
		const { setPrefs, getPrefs } = await import('../../src/prefs');
		drag(setPrefs, 'musicVolume', 0, 1, 50);
		tick();

		expect(getPrefs().musicVolume).toBe(1);
		const stored = JSON.parse(localStorage.getItem('ww:a11y')!);
		expect(stored.musicVolume).toBe(1);
	});

	it('applies the new value to memory immediately, before the write lands', async () => {
		const { setPrefs, getPrefs } = await import('../../src/prefs');
		setPrefs({ musicVolume: 0.42 });
		// No frame yet — the UI must still read the exact current value.
		expect(getPrefs().musicVolume).toBe(0.42);
	});

	it('flushes a pending write when the page is hidden', async () => {
		const { setPrefs } = await import('../../src/prefs');
		setPrefs({ musicVolume: 0.33 });

		vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
		document.dispatchEvent(new Event('visibilitychange'));

		const stored = JSON.parse(localStorage.getItem('ww:a11y')!);
		expect(stored.musicVolume).toBe(0.33);
	});

	it('flushes a pending write on pagehide, so nothing is lost on the way out', async () => {
		const { setPrefs } = await import('../../src/prefs');
		setPrefs({ textScale: 'lg' });
		window.dispatchEvent(new Event('pagehide'));
		expect(JSON.parse(localStorage.getItem('ww:a11y')!).textScale).toBe('lg');
	});

	it('survives storage being unavailable (private mode)', async () => {
		const { setPrefs, getPrefs } = await import('../../src/prefs');
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('QuotaExceededError');
		});
		expect(() => {
			setPrefs({ musicVolume: 0.5 });
			tick();
		}).not.toThrow();
		expect(getPrefs().musicVolume).toBe(0.5); // still applies for the session
	});
});

describe('subscribers can ignore irrelevant changes', () => {
	it('hands the full prefs object to subscribers so they can diff', async () => {
		const { setPrefs, subscribe } = await import('../../src/prefs');
		const seen: any[] = [];
		const off = subscribe((p) => seen.push(p));

		setPrefs({ musicVolume: 0.1 });

		expect(seen).toHaveLength(1);
		expect(seen[0]).toMatchObject({ musicVolume: 0.1 });
		// The world scene gates on these two; they must be readable from the payload.
		expect(seen[0]).toHaveProperty('reduceMotion');
		expect(seen[0]).toHaveProperty('interactHint');
		off();
	});

	it('a volume drag never changes the two prefs the world draws from', async () => {
		const { setPrefs, subscribe } = await import('../../src/prefs');
		// Mirrors the gate in WorldScene: rebuild only when these actually change.
		const { getPrefs } = await import('../../src/prefs');
		let lastMotion = getPrefs().reduceMotion;
		let lastHint = getPrefs().interactHint;
		let rebuilds = 0;
		const off = subscribe((p) => {
			if (p.reduceMotion === lastMotion && p.interactHint === lastHint) return;
			lastMotion = p.reduceMotion;
			lastHint = p.interactHint;
			rebuilds++;
		});

		drag(setPrefs, 'musicVolume', 0, 1, 100);
		drag(setPrefs, 'sfxVolume', 1, 0, 100);
		expect(rebuilds).toBe(0); // ~200 events, zero world rebuilds

		setPrefs({ reduceMotion: !lastMotion }); // a pref the world DOES draw from
		expect(rebuilds).toBe(1);
		off();
	});

	it('a repeated no-op toggle does not rebuild', async () => {
		const { setPrefs, subscribe, getPrefs } = await import('../../src/prefs');
		let lastMotion = getPrefs().reduceMotion;
		let rebuilds = 0;
		const off = subscribe((p) => {
			if (p.reduceMotion === lastMotion) return;
			lastMotion = p.reduceMotion;
			rebuilds++;
		});
		for (let i = 0; i < 20; i++) setPrefs({ reduceMotion: lastMotion });
		expect(rebuilds).toBe(0);
		off();
	});
});
