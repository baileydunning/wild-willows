import { describe, it, expect, beforeEach } from 'vitest';

// localStorage shim (node env has none) so prefs can persist + round-trip. Set
// up BEFORE importing prefs, since the module reads saved prefs at import time.
const store = new Map<string, string>();
(globalThis as any).localStorage = {
	getItem: (k: string) => store.get(k) ?? null,
	setItem: (k: string, v: string) => {
		store.set(k, v);
	},
	removeItem: (k: string) => {
		store.delete(k);
	},
	key: (i: number) => [...store.keys()][i] ?? null,
	get length() {
		return store.size;
	},
};

import { normalizePrefs, getPrefs, setPrefs, subscribe, TEXT_SCALE_VALUES } from '../../src/prefs';

describe('accessibility prefs', () => {
	beforeEach(() => {
		store.clear();
		setPrefs({ reduceMotion: false, colorblindMode: 'off', dyslexiaFont: false, textScale: 'md' });
	});

	it('normalizes unknown/missing fields to safe defaults', () => {
		expect(normalizePrefs(null)).toEqual({
			reduceMotion: false,
			colorblindMode: 'off',
			dyslexiaFont: false,
			textScale: 'md',
			musicEnabled: true,
			sfxEnabled: true,
			musicVolume: 0.6,
			sfxVolume: 0.75,
			keybinds: {},
			interactHint: true,
		});
		expect(normalizePrefs('nonsense')).toEqual({
			reduceMotion: false,
			colorblindMode: 'off',
			dyslexiaFont: false,
			textScale: 'md',
			musicEnabled: true,
			sfxEnabled: true,
			musicVolume: 0.6,
			sfxVolume: 0.75,
			keybinds: {},
			interactHint: true,
		});
		// bad textScale falls back; a valid colorblind mode is preserved
		expect(normalizePrefs({ textScale: 'huge', colorblindMode: 'blueyellow' })).toEqual({
			reduceMotion: false,
			colorblindMode: 'blueyellow',
			dyslexiaFont: false,
			textScale: 'md',
			musicEnabled: true,
			sfxEnabled: true,
			musicVolume: 0.6,
			sfxVolume: 0.75,
			keybinds: {},
			interactHint: true,
		});
		// unknown mode falls back to off
		expect(normalizePrefs({ colorblindMode: 'nope' }).colorblindMode).toBe('off');
		// reduceMotion default can be seeded from the OS setting
		expect(normalizePrefs({}, true).reduceMotion).toBe(true);
	});

	it('migrates the legacy colorblind boolean to a mode', () => {
		// old saves stored colorblind: true/false — map onto the common red-green mode
		expect(normalizePrefs({ colorblind: true }).colorblindMode).toBe('redgreen');
		expect(normalizePrefs({ colorblind: false }).colorblindMode).toBe('off');
		// an explicit mode always wins over the legacy boolean
		expect(normalizePrefs({ colorblind: true, colorblindMode: 'mono' }).colorblindMode).toBe('mono');
	});

	it('caps text scale at lg when the dyslexia font is on (xl overflows it)', () => {
		expect(normalizePrefs({ dyslexiaFont: true, textScale: 'xl' }).textScale).toBe('lg');
		// smaller scales are left alone
		expect(normalizePrefs({ dyslexiaFont: true, textScale: 'md' }).textScale).toBe('md');
		// xl is fine without the font
		expect(normalizePrefs({ dyslexiaFont: false, textScale: 'xl' }).textScale).toBe('xl');
		// turning the font on while already at xl clamps down
		setPrefs({ textScale: 'xl' });
		expect(getPrefs().textScale).toBe('xl');
		setPrefs({ dyslexiaFont: true });
		expect(getPrefs().textScale).toBe('lg');
	});

	it('persists changes and reflects them in getPrefs', () => {
		setPrefs({ colorblindMode: 'blueyellow', textScale: 'lg' });
		expect(getPrefs().colorblindMode).toBe('blueyellow');
		expect(getPrefs().textScale).toBe('lg');
		// written through to storage as JSON
		const saved = JSON.parse(store.get('ww:a11y')!);
		expect(saved.colorblindMode).toBe('blueyellow');
		expect(saved.textScale).toBe('lg');
	});

	it('merges patches without dropping other fields', () => {
		setPrefs({ reduceMotion: true });
		setPrefs({ textScale: 'xl' });
		expect(getPrefs()).toEqual({
			reduceMotion: true,
			colorblindMode: 'off',
			dyslexiaFont: false,
			textScale: 'xl',
			musicEnabled: true,
			sfxEnabled: true,
			musicVolume: 0.6,
			sfxVolume: 0.75,
			keybinds: {},
			interactHint: true,
		});
	});

	it('notifies subscribers on change and stops after unsubscribe', () => {
		let seen = 0;
		const unsub = subscribe(() => {
			seen++;
		});
		setPrefs({ colorblindMode: 'redgreen' });
		expect(seen).toBe(1);
		unsub();
		setPrefs({ colorblindMode: 'off' });
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
		setPrefs({ colorblindMode: 'mono', reduceMotion: true, textScale: 'xl' });
		const root = document.documentElement;
		expect(root.dataset.colorblind).toBe('mono');
		expect(root.dataset.reduceMotion).toBe('1');
		expect(root.dataset.textScale).toBe('xl');
		expect(root.style.getPropertyValue('--ui-scale')).toBe(String(TEXT_SCALE_VALUES.xl));

		setPrefs({ colorblindMode: 'off', reduceMotion: false, textScale: 'md' });
		expect(root.dataset.colorblind).toBe('off');
		expect(root.dataset.reduceMotion).toBe('0');
		expect(root.style.getPropertyValue('--ui-scale')).toBe('1');
	});
});
