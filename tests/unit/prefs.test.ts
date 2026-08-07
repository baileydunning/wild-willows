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

import {
	normalizePrefs,
	getPrefs,
	setPrefs,
	subscribe,
	resolveTheme,
	FONT_CHOICES,
	THEME_CHOICES,
	TEXT_SCALE_VALUES,
} from '../../src/prefs';

describe('accessibility prefs', () => {
	beforeEach(() => {
		store.clear();
		setPrefs({
			reduceMotion: false,
			colorblindMode: 'off',
			fontChoice: 'storybook',
			highContrast: false,
			textScale: 'md',
			theme: 'light',
		});
	});

	it('normalizes unknown/missing fields to safe defaults', () => {
		expect(normalizePrefs(null)).toEqual({
			reduceMotion: false,
			colorblindMode: 'off',
			fontChoice: 'storybook',
			highContrast: false,
			textScale: 'md',
			musicEnabled: true,
			sfxEnabled: true,
			musicVolume: 0.6,
			sfxVolume: 0.75,
			keybinds: {},
			interactHint: true,
			simpleText: false,
			theme: 'light',
		});
		expect(normalizePrefs('nonsense')).toEqual({
			reduceMotion: false,
			colorblindMode: 'off',
			fontChoice: 'storybook',
			highContrast: false,
			textScale: 'md',
			musicEnabled: true,
			sfxEnabled: true,
			musicVolume: 0.6,
			sfxVolume: 0.75,
			keybinds: {},
			interactHint: true,
			simpleText: false,
			theme: 'light',
		});
		// bad textScale falls back; a valid colorblind mode is preserved
		expect(normalizePrefs({ textScale: 'huge', colorblindMode: 'blueyellow' })).toEqual({
			reduceMotion: false,
			colorblindMode: 'blueyellow',
			fontChoice: 'storybook',
			highContrast: false,
			textScale: 'md',
			musicEnabled: true,
			sfxEnabled: true,
			musicVolume: 0.6,
			sfxVolume: 0.75,
			keybinds: {},
			interactHint: true,
			simpleText: false,
			theme: 'light',
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

	it('accepts every offered font and rejects anything else', () => {
		for (const f of FONT_CHOICES) expect(normalizePrefs({ fontChoice: f }).fontChoice).toBe(f);
		// An unknown value (a hand-edited save, or a font retired in a later build)
		// must land on the default rather than reach the DOM as a bogus data-font.
		expect(normalizePrefs({ fontChoice: 'comic-sans' }).fontChoice).toBe('storybook');
		expect(normalizePrefs({ fontChoice: 42 }).fontChoice).toBe('storybook');
		expect(normalizePrefs({}).fontChoice).toBe('storybook');
	});

	it('migrates the retired dyslexia-font toggle to the plainest face', () => {
		// The picker replaced a `dyslexiaFont` switch that swapped in OpenDyslexic.
		// That font is gone, so someone who had it on can't get it back — but they
		// chose it for readability, and dropping them onto the decorative default
		// would quietly undo that. 'plain' is the closest survivor.
		expect(normalizePrefs({ dyslexiaFont: true }).fontChoice).toBe('plain');
		expect(normalizePrefs({ dyslexiaFont: false }).fontChoice).toBe('storybook');
		// Anyone who has since used the picker keeps their pick — the dead flag
		// lingers in old saved blobs and must not override it.
		expect(normalizePrefs({ dyslexiaFont: true, fontChoice: 'classic' }).fontChoice).toBe('classic');
	});

	it('allows extra-large text with every font', () => {
		// xl used to be clamped to lg because OpenDyslexic already ran large. With
		// that font gone the cap goes too, so the biggest text is available again.
		for (const f of FONT_CHOICES) expect(normalizePrefs({ fontChoice: f, textScale: 'xl' }).textScale).toBe('xl');
		setPrefs({ textScale: 'xl' });
		setPrefs({ fontChoice: 'classic' });
		expect(getPrefs().textScale).toBe('xl');
	});

	it('exposes high contrast on <html> so the CSS can theme off it', () => {
		expect(document.documentElement.dataset.highContrast).toBe('0');
		setPrefs({ highContrast: true });
		expect(document.documentElement.dataset.highContrast).toBe('1');
		// It's independent of the colorblind modes, which carry their own (much
		// starker) theme — turning one on must not imply or clear the other.
		setPrefs({ colorblindMode: 'mono' });
		expect(document.documentElement.dataset.highContrast).toBe('1');
		setPrefs({ highContrast: false, colorblindMode: 'off' });
		expect(document.documentElement.dataset.highContrast).toBe('0');
	});

	it('exposes the font on <html> so the CSS can theme off it', () => {
		setPrefs({ fontChoice: 'typewriter' });
		expect(document.documentElement.dataset.font).toBe('typewriter');
		setPrefs({ fontChoice: 'storybook' });
		expect(document.documentElement.dataset.font).toBe('storybook');
	});

	it('persists changes and reflects them in getPrefs', () => {
		setPrefs({ colorblindMode: 'blueyellow', textScale: 'lg' });
		// In memory the change is immediate, so the UI always reads the exact value.
		expect(getPrefs().colorblindMode).toBe('blueyellow');
		expect(getPrefs().textScale).toBe('lg');
		// The storage write is coalesced to the next frame (a volume-slider drag
		// fires dozens of changes per second and used to write on every one — see
		// tests/unit/prefs-flush.test.ts). Leaving the page forces it out, which is
		// the guarantee that actually matters: nothing is lost.
		window.dispatchEvent(new Event('pagehide'));
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
			fontChoice: 'storybook',
			highContrast: false,
			textScale: 'xl',
			musicEnabled: true,
			sfxEnabled: true,
			musicVolume: 0.6,
			sfxVolume: 0.75,
			keybinds: {},
			interactHint: true,
			simpleText: false,
			theme: 'light',
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
	it('starts on light and stays there until somebody chooses otherwise', () => {
		// A brand-new save has no `theme` key, and neither does one written before
		// dark mode shipped. Both land on light, so the game looks the way it always
		// has until the player goes and changes it.
		expect(normalizePrefs(null).theme).toBe('light');
		expect(normalizePrefs({}).theme).toBe('light');
		expect(normalizePrefs({ textScale: 'lg', fontChoice: 'classic' }).theme).toBe('light');
		// Not even a dark OS reaches in and decides for them — 'system' has to be picked.
		expect(resolveTheme(normalizePrefs({}))).toBe('light');
		// A hand-edited or future-build value must not reach the DOM as a bogus attribute.
		expect(normalizePrefs({ theme: 'sepia' }).theme).toBe('light');
		expect(normalizePrefs({ theme: 7 }).theme).toBe('light');
		// Every offered choice is still honoured once it IS set.
		for (const c of THEME_CHOICES) expect(normalizePrefs({ theme: c }).theme).toBe(c);
	});

	it('resolves the theme to a literal light/dark before it reaches <html>', () => {
		// The stylesheet matches [data-theme='dark'] / 'light' and knows nothing about
		// 'system', so 'system' must never survive as far as the attribute.
		const root = document.documentElement;

		setPrefs({ theme: 'dark' });
		expect(getPrefs().theme).toBe('dark');
		expect(resolveTheme()).toBe('dark');
		expect(root.dataset.theme).toBe('dark');

		setPrefs({ theme: 'light' });
		expect(root.dataset.theme).toBe('light');

		// jsdom has no matchMedia, which is also the no-DOM / older-webview case:
		// resolving must not throw, and must land on light.
		setPrefs({ theme: 'system' });
		expect(getPrefs().theme).toBe('system');
		expect(root.dataset.theme).toBe('light');
		expect(['light', 'dark']).toContain(root.dataset.theme);
	});

	it('keeps the theme independent of the other display prefs', () => {
		// High contrast and the colorblind modes each carry a theme layered ON TOP of
		// light/dark — turning one on must not disturb the other two.
		setPrefs({ theme: 'dark', highContrast: true, colorblindMode: 'mono' });
		const root = document.documentElement;
		expect(root.dataset.theme).toBe('dark');
		expect(root.dataset.highContrast).toBe('1');
		expect(root.dataset.colorblind).toBe('mono');

		setPrefs({ highContrast: false, colorblindMode: 'off' });
		expect(root.dataset.theme).toBe('dark');
		expect(getPrefs().theme).toBe('dark');
	});

	it('persists the theme like any other preference', () => {
		setPrefs({ theme: 'dark' });
		window.dispatchEvent(new Event('pagehide'));
		expect(JSON.parse(store.get('ww:a11y')!).theme).toBe('dark');
		// and a round-trip through storage brings it back intact
		expect(normalizePrefs(JSON.parse(store.get('ww:a11y')!)).theme).toBe('dark');
	});
});
