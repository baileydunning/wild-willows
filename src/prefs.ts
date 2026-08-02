// Accessibility & display preferences. Persisted to localStorage and applied to
// the <html> element as data-attributes plus a `--ui-scale` CSS var, so plain
// CSS (and the Phaser scene, via subscribe) can react without prop-drilling.
// Mirrors the i18n module: self-applies the saved prefs at import time, and is
// safe to import in non-DOM environments (guards document / matchMedia).

import { useSyncExternalStore } from 'react';

export type TextScale = 'sm' | 'md' | 'lg' | 'xl';

/** Colorblind assistance modes. The keys name the axis each correction works on;
 *  the UI shows the official condition names (deuteranopia/protanopia, tritanopia,
 *  achromatopsia). 'off' disables it. */
export type ColorblindMode = 'off' | 'redgreen' | 'blueyellow' | 'mono';

export interface Prefs {
	/** Turn off UI animations/transitions and in-world weather particles. */
	reduceMotion: boolean;
	/** Colorblind assistance: a per-type color-correction filter plus the
	 *  high-contrast theme and labeled cues. 'off' when not needed. */
	colorblindMode: ColorblindMode;
	/** Switch the UI to a dyslexia-friendly typeface with roomier spacing. */
	dyslexiaFont: boolean;
	/** UI text/control scale. */
	textScale: TextScale;
	/** Play background music and ambience. */
	musicEnabled: boolean;
	/** Play sound effects (footsteps, toasts, pickups, weather). */
	sfxEnabled: boolean;
	/** Background music/ambience level, 0–1. */
	musicVolume: number;
	/** Sound-effects level, 0–1. */
	sfxVolume: number;
}

/** The zoom factor applied to the UI overlays for each text-size step. */
export const TEXT_SCALE_VALUES: Record<TextScale, number> = { sm: 0.85, md: 1, lg: 1.25, xl: 1.5 };
const TEXT_SCALES: TextScale[] = ['sm', 'md', 'lg', 'xl'];
export const COLORBLIND_MODES: ColorblindMode[] = ['off', 'redgreen', 'blueyellow', 'mono'];

const STORAGE_KEY = 'ww:a11y';
const DEFAULTS: Prefs = {
	reduceMotion: false,
	colorblindMode: 'off',
	dyslexiaFont: false,
	textScale: 'md',
	musicEnabled: true,
	sfxEnabled: true,
	musicVolume: 0.6,
	sfxVolume: 0.75,
};

/** Clamp an arbitrary value to a 0–1 volume, falling back when it isn't a number. */
function normalizeVolume(v: unknown, fallback: number): number {
	if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
	return v < 0 ? 0 : v > 1 ? 1 : v;
}

function systemReduceMotion(): boolean {
	try {
		return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
	} catch {
		return false;
	}
}

/** Coerce an arbitrary stored/patched blob into a valid Prefs. Unknown or
 *  missing fields fall back (reduceMotion falls back to the OS setting on a
 *  fresh install so motion-sensitive players get sensible defaults). */
export function normalizePrefs(raw: any, fallbackReduce = false): Prefs {
	const o = raw && typeof raw === 'object' ? raw : {};
	const dyslexiaFont = typeof o.dyslexiaFont === 'boolean' ? o.dyslexiaFont : DEFAULTS.dyslexiaFont;
	let textScale: TextScale = TEXT_SCALES.includes(o.textScale) ? o.textScale : DEFAULTS.textScale;
	// OpenDyslexic already renders larger than the default face, so the extra-large
	// step on top of it overflows the UI. Cap at large whenever the font is on.
	if (dyslexiaFont && textScale === 'xl') textScale = 'lg';
	// Colorblind: prefer the new mode enum; migrate the legacy on/off boolean to
	// the most common (red-green) mode so existing saves keep their assistance.
	const colorblindMode: ColorblindMode = COLORBLIND_MODES.includes(o.colorblindMode)
		? o.colorblindMode
		: typeof o.colorblind === 'boolean'
			? o.colorblind
				? 'redgreen'
				: 'off'
			: DEFAULTS.colorblindMode;
	return {
		reduceMotion: typeof o.reduceMotion === 'boolean' ? o.reduceMotion : fallbackReduce,
		colorblindMode,
		dyslexiaFont,
		textScale,
		musicEnabled: typeof o.musicEnabled === 'boolean' ? o.musicEnabled : DEFAULTS.musicEnabled,
		sfxEnabled: typeof o.sfxEnabled === 'boolean' ? o.sfxEnabled : DEFAULTS.sfxEnabled,
		musicVolume: normalizeVolume(o.musicVolume, DEFAULTS.musicVolume),
		sfxVolume: normalizeVolume(o.sfxVolume, DEFAULTS.sfxVolume),
	};
}

let current: Prefs = { ...DEFAULTS };
const listeners = new Set<(p: Prefs) => void>();

export function getPrefs(): Prefs {
	return current;
}

function applyToDom(p: Prefs): void {
	if (typeof document === 'undefined' || !document.documentElement) return;
	const root = document.documentElement;
	root.dataset.reduceMotion = p.reduceMotion ? '1' : '0';
	root.dataset.colorblind = p.colorblindMode; // off | redgreen | blueyellow | mono
	root.dataset.dyslexiaFont = p.dyslexiaFont ? '1' : '0';
	root.dataset.textScale = p.textScale;
	root.style.setProperty('--ui-scale', String(TEXT_SCALE_VALUES[p.textScale]));
}

/** Subscribe to preference changes; returns an unsubscribe fn. */
export function subscribe(fn: (p: Prefs) => void): () => void {
	listeners.add(fn);
	return () => {
		listeners.delete(fn);
	};
}

/** Merge a patch into the current prefs, persist, apply to the DOM, and notify. */
export function setPrefs(patch: Partial<Prefs>): Prefs {
	current = normalizePrefs({ ...current, ...patch });
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
	} catch {
		/* storage unavailable (private mode etc.) — still applies for the session */
	}
	applyToDom(current);
	listeners.forEach((fn) => {
		try {
			fn(current);
		} catch {
			/* one bad listener shouldn't break the rest */
		}
	});
	return current;
}

/** React hook: re-renders when any preference changes. */
export function usePrefs(): Prefs {
	return useSyncExternalStore(subscribe, getPrefs, getPrefs);
}

// Restore saved prefs at import time (defaulting reduceMotion to the OS setting).
try {
	const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
	current = normalizePrefs(saved ? JSON.parse(saved) : null, systemReduceMotion());
} catch {
	current = normalizePrefs(null, systemReduceMotion());
}
applyToDom(current);
