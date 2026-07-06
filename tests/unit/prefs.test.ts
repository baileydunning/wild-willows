import { describe, it, expect, beforeEach } from 'vitest';

// localStorage shim (node env has none) so prefs can persist + round-trip. Set
// up BEFORE importing prefs, since the module reads saved prefs at import time.
const store = new Map<string, string>();
(globalThis as any).localStorage = {
	getItem: (k: string) => store.get(k) ?? null,
	setItem: (k: string, v: string) => { store.set(k, v); },
	removeItem: (k: string) => { store.delete(k); },
	key: (i: number) => [...store.keys()][i] ?? null,
	get length() { return store.size; },
};

import { normalizePrefs, getPrefs, setPrefs, subscribe, TEXT_SCALE_VALUES } from '../../src/prefs';

describe('accessibility prefs', () => {
	beforeEach(() => {
		store.clear();
		setPrefs({ reduceMotion: false, colorblind: false, textScale: 'md' });
	});

	it('normalizes unknown/missing fields to safe defaults', () => {
		expect(normalizePrefs(null)).toEqual({ reduceMotion: false, colorblind: false, textScale: 'md' });
		expect(normalizePrefs('nonsense')).toEqual({ reduceMotion: false, colorblind: false, textScale: 'md' });
		// bad textScale falls back; valid booleans preserved
		expect(normalizePrefs({ textScale: 'huge', colorblind: true })).toEqual({ reduceMotion: false, colorblind: true, textScale: 'md' });
		// reduceMotion default can be seeded from the OS setting
		expect(normalizePrefs({}, true).reduceMotion).toBe(true);
	});

	it('persists changes and reflects them in getPrefs', () => {
		setPrefs({ colorblind: true, textScale: 'lg' });
		expect(getPrefs().colorblind).toBe(true);
		expect(getPrefs().textScale).toBe('lg');
		// written through to storage as JSON
		const saved = JSON.parse(store.get('ww:a11y')!);
		expect(saved.colorblind).toBe(true);
		expect(saved.textScale).toBe('lg');
	});

	it('merges patches without dropping other fields', () => {
		setPrefs({ reduceMotion: true });
		setPrefs({ textScale: 'xl' });
		expect(getPrefs()).toEqual({ reduceMotion: true, colorblind: false, textScale: 'xl' });
	});

	it('notifies subscribers on change and stops after unsubscribe', () => {
		let seen = 0;
		const unsub = subscribe(() => { seen++; });
		setPrefs({ colorblind: true });
		expect(seen).toBe(1);
		unsub();
		setPrefs({ colorblind: false });
		expect(seen).toBe(1);
	});

	it('maps each text scale to a zoom factor', () => {
		expect(TEXT_SCALE_VALUES.md).toBe(1);
		expect(TEXT_SCALE_VALUES.sm).toBeLessThan(1);
		expect(TEXT_SCALE_VALUES.xl).toBeGreaterThan(TEXT_SCALE_VALUES.lg);
	});

	// The unit env is jsdom, so this exercises the real DOM application path the
	// CSS keys off of ([data-colorblind], [data-reduce-motion], --ui-scale).
	it('applies prefs to <html> so the CSS can react', () => {
		setPrefs({ colorblind: true, reduceMotion: true, textScale: 'xl' });
		const root = document.documentElement;
		expect(root.dataset.colorblind).toBe('1');
		expect(root.dataset.reduceMotion).toBe('1');
		expect(root.dataset.textScale).toBe('xl');
		expect(root.style.getPropertyValue('--ui-scale')).toBe(String(TEXT_SCALE_VALUES.xl));

		setPrefs({ colorblind: false, reduceMotion: false, textScale: 'md' });
		expect(root.dataset.colorblind).toBe('0');
		expect(root.dataset.reduceMotion).toBe('0');
		expect(root.style.getPropertyValue('--ui-scale')).toBe('1');
	});
});
