// Accessibility & display preferences. Persisted to localStorage and applied to
// the <html> element as data-attributes plus a `--ui-scale` CSS var, so plain
// CSS (and the Phaser scene, via subscribe) can react without prop-drilling.
// Mirrors the i18n module: self-applies the saved prefs at import time, and is
// safe to import in non-DOM environments (guards document / matchMedia).

import { useSyncExternalStore } from 'react';
import { scheduleFlush, flushNow } from './perf';

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
	/** Custom key bindings: action id -> key token. Empty = built-in defaults. */
	keybinds: Record<string, string[]>;
	/** Show the pulsing ring + key badge over the nearest interactable. */
	interactHint: boolean;
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
	keybinds: {},
	interactHint: true,
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
function normalizeKeybinds(raw: any): Record<string, string[]> {
	const out: Record<string, string[]> = {};
	if (raw && typeof raw === 'object')
		for (const [k, v] of Object.entries(raw)) {
			if (Array.isArray(v)) {
				const toks = v.filter((x): x is string => typeof x === 'string');
				if (toks.length) out[k] = toks;
			} else if (typeof v === 'string') out[k] = [v];
		}
	return out;
}

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
		keybinds: normalizeKeybinds(o.keybinds),
		interactHint: typeof o.interactHint === 'boolean' ? o.interactHint : DEFAULTS.interactHint,
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

// localStorage.setItem is synchronous, main-thread work. The volume sliders call
// setPrefs on every change event — dozens per second while dragging — so writing
// inline meant a blocking serialize+store per pixel of travel. Coalesce instead:
// the in-memory value and the DOM update stay immediate (so the UI is still exact
// to the frame), and only the write is deferred to the next frame. A drag
// therefore ends in one write instead of a hundred.
let writeQueued = false;

function writePrefsNow(): void {
	writeQueued = false;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
	} catch {
		/* storage unavailable (private mode etc.) — still applies for the session */
	}
}

function queuePrefsWrite(): void {
	if (writeQueued) return;
	writeQueued = true;
	scheduleFlush('prefs:write', writePrefsNow);
}

// A deferred write must never be the reason a preference is lost, so force it out
// on the way down. This matters more than it looks: once a tab is hidden the
// browser stops firing requestAnimationFrame entirely, so a queued write would
// otherwise sit there indefinitely. pagehide covers the mobile/bfcache path that
// beforeunload misses.
if (typeof window !== 'undefined') {
	const flushPrefs = () => flushNow('prefs:write');
	window.addEventListener('beforeunload', flushPrefs);
	window.addEventListener('pagehide', flushPrefs);
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'hidden') flushPrefs();
	});
}

/** Merge a patch into the current prefs, persist, apply to the DOM, and notify. */
export function setPrefs(patch: Partial<Prefs>): Prefs {
	current = normalizePrefs({ ...current, ...patch });
	queuePrefsWrite();
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
