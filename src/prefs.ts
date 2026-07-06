// Accessibility & display preferences. Persisted to localStorage and applied to
// the <html> element as data-attributes plus a `--ui-scale` CSS var, so plain
// CSS (and the Phaser scene, via subscribe) can react without prop-drilling.
// Mirrors the i18n module: self-applies the saved prefs at import time, and is
// safe to import in non-DOM environments (guards document / matchMedia).

import { useSyncExternalStore } from 'react';

export type TextScale = 'sm' | 'md' | 'lg' | 'xl';

export interface Prefs {
	/** Turn off UI animations/transitions and in-world weather particles. */
	reduceMotion: boolean;
	/** Stronger, labeled weather cues that don't rely on color alone. */
	colorblind: boolean;
	/** UI text/control scale. */
	textScale: TextScale;
}

/** The zoom factor applied to the UI overlays for each text-size step. */
export const TEXT_SCALE_VALUES: Record<TextScale, number> = { sm: 0.85, md: 1, lg: 1.25, xl: 1.5 };
const TEXT_SCALES: TextScale[] = ['sm', 'md', 'lg', 'xl'];

const STORAGE_KEY = 'ww:a11y';
const DEFAULTS: Prefs = { reduceMotion: false, colorblind: false, textScale: 'md' };

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
	return {
		reduceMotion: typeof o.reduceMotion === 'boolean' ? o.reduceMotion : fallbackReduce,
		colorblind: typeof o.colorblind === 'boolean' ? o.colorblind : DEFAULTS.colorblind,
		textScale: TEXT_SCALES.includes(o.textScale) ? o.textScale : DEFAULTS.textScale,
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
	root.dataset.colorblind = p.colorblind ? '1' : '0';
	root.dataset.textScale = p.textScale;
	root.style.setProperty('--ui-scale', String(TEXT_SCALE_VALUES[p.textScale]));
}

/** Subscribe to preference changes; returns an unsubscribe fn. */
export function subscribe(fn: (p: Prefs) => void): () => void {
	listeners.add(fn);
	return () => { listeners.delete(fn); };
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
		try { fn(current); } catch { /* one bad listener shouldn't break the rest */ }
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
