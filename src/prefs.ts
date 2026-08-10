// Accessibility & display preferences. Persisted to localStorage and applied to
// the <html> element as data-attributes plus a `--ui-scale` CSS var, so plain
// CSS (and the Phaser scene, via subscribe) can react without prop-drilling.
// Mirrors the i18n module: self-applies the saved prefs at import time, and is
// safe to import in non-DOM environments (guards document / matchMedia).

import { useSyncExternalStore } from 'react';
import { scheduleFlush, flushNow } from './perf';
import { setSimpleText } from './i18n/core';
import { DEMO } from './demo';

export type TextScale = 'sm' | 'md' | 'lg' | 'xl';

/** Colorblind assistance modes. The keys name the axis each correction works on;
 *  the UI shows the official condition names (deuteranopia/protanopia, tritanopia,
 *  achromatopsia). 'off' disables it. */
export type ColorblindMode = 'off' | 'redgreen' | 'blueyellow' | 'mono';

/** UI typeface. Every one of these resolves to fonts already on the machine (or,
 *  for 'storybook', the two the app already loads), so switching costs no
 *  download and works with no network — which matters for the desktop and iOS
 *  builds that can run entirely offline. */
export type FontChoice = 'storybook' | 'rounded' | 'classic' | 'plain' | 'typewriter';
export const FONT_CHOICES: FontChoice[] = ['storybook', 'rounded', 'classic', 'plain', 'typewriter'];

/** Light or dark interface, or 'system' to follow the OS. 'system' is what gets
 *  STORED; it is resolved to one of the two literals on the way to the DOM (see
 *  resolveTheme), so the stylesheet only ever matches data-theme="light|dark". */
export type ThemeChoice = 'system' | 'light' | 'dark';
export const THEME_CHOICES: ThemeChoice[] = ['system', 'light', 'dark'];

/** Overall rendering fidelity. 'high' renders at full device-pixel density with
 *  the full particle/weather load; 'low' caps rendering at 1 CSS pixel per
 *  canvas pixel and thins out particles and weather effects, for machines that
 *  can't hold a smooth frame rate at full fidelity (old laptops, integrated
 *  graphics, a showcase machine you don't control). */
export type GraphicsQuality = 'high' | 'low';
export const GRAPHICS_QUALITIES: GraphicsQuality[] = ['high', 'low'];

export interface Prefs {
	/** Turn off UI animations/transitions and in-world weather particles. */
	reduceMotion: boolean;
	/** Colorblind assistance: a per-type color-correction filter plus the
	 *  high-contrast theme and labeled cues. 'off' when not needed. */
	colorblindMode: ColorblindMode;
	/** Which typeface the interface is set in. */
	fontChoice: FontChoice;
	/** Light or dark interface. Starts on 'light'; 'system' follows the OS and keeps
	 *  following it, but is a choice the player makes rather than the starting state. */
	theme: ThemeChoice;
	/** Deepen the palette until text and edges clear WCAG AA, without leaving the
	 *  warm cream-and-green look behind. Distinct from colorblindMode, which
	 *  additionally colour-corrects and goes stark black-on-white. */
	highContrast: boolean;
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
	/** Swap the game's wording for plainer phrasing (~5th-grade reading level):
	 *  shorter sentences, everyday words, jargon dropped or explained in place.
	 *  Applies to the interface AND the nature writing. */
	simpleText: boolean;
	/** Rendering fidelity: full device-pixel density, particles, and weather vs. a
	 *  lighter-weight render for weaker hardware. Defaults to an autodetected guess
	 *  on first launch (see detectDefaultGraphicsQuality), then stays whatever the
	 *  player last chose. */
	graphicsQuality: GraphicsQuality;
}

/** The zoom factor applied to the UI overlays for each text-size step. */
export const TEXT_SCALE_VALUES: Record<TextScale, number> = { sm: 0.85, md: 1, lg: 1.25, xl: 1.5 };
const TEXT_SCALES: TextScale[] = ['sm', 'md', 'lg', 'xl'];
export const COLORBLIND_MODES: ColorblindMode[] = ['off', 'redgreen', 'blueyellow', 'mono'];

const STORAGE_KEY = 'ww:a11y';
const DEFAULTS: Prefs = {
	reduceMotion: false,
	colorblindMode: 'off',
	fontChoice: 'storybook',
	theme: 'light',
	highContrast: false,
	textScale: 'md',
	musicEnabled: true,
	sfxEnabled: true,
	musicVolume: 0.6,
	sfxVolume: 0.75,
	keybinds: {},
	interactHint: true,
	simpleText: false,
	graphicsQuality: 'high',
};

/**
 * A best-effort guess at whether this device can comfortably handle full
 * rendering fidelity. Only ever used as the STARTING value on a fresh
 * install (see the fallbackQuality param below) — once a player has an
 * opinion, saved or not, this never overrides it.
 *
 * Conservative on purpose: it only downgrades to 'low' on signals that are
 * fairly reliable indicators of weak hardware (few logical cores, or the
 * browser explicitly reporting little memory). Anything unknown or
 * unavailable (most desktop Safari, some privacy-hardened browsers) is
 * treated as capable rather than guessed against.
 *
 * The browser demo is the one exception and starts on 'low' outright — see the
 * first line of the body.
 */
export function detectDefaultGraphicsQuality(): GraphicsQuality {
	// The browser demo starts on low whatever the machine claims. It runs inside
	// an itch.io iframe, on hardware we know nothing about, sharing a GPU with
	// every other tab the player has open — and the autodetect below is
	// deliberately optimistic, so it would wave most of that through. A first
	// impression that stutters costs more than one that is slightly less pretty.
	// This is only the DEFAULT: the toggle is on the title screen, and the choice
	// sticks in localStorage once made.
	if (DEMO && !isDesktopBuild()) return 'low';
	try {
		const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : undefined;
		if (typeof cores === 'number' && cores > 0 && cores <= 2) return 'low';
		// Chrome/Edge/Android only; undefined elsewhere (Safari, Firefox) — treated
		// as "no signal" rather than "definitely fine", per the comment above.
		const mem = typeof navigator !== 'undefined' ? (navigator as any).deviceMemory : undefined;
		if (typeof mem === 'number' && mem > 0 && mem <= 2) return 'low';
	} catch {
		/* navigator unavailable (SSR, tests) — fall through to the safe default */
	}
	return 'high';
}

/** True on the Electron desktop build. Checked inline off the preload bridge —
 *  the same thing audio.ts does — rather than importing IS_DESKTOP from api.ts,
 *  which would drag the whole API module into a module every entry point loads. */
function isDesktopBuild(): boolean {
	return !!(globalThis as { wildWillowsDesktop?: { isDesktop?: boolean } }).wildWillowsDesktop?.isDesktop;
}

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

/** The OS-level dark-mode media query, or null where there's no matchMedia (SSR,
 *  the metrics tests, older embedded webviews). Held once rather than re-queried,
 *  because the change listener below has to attach to the same object. */
const darkQuery: MediaQueryList | null = (() => {
	try {
		return typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: dark)') : null;
	} catch {
		return null;
	}
})();

function systemPrefersDark(): boolean {
	return !!darkQuery?.matches;
}

/** Turn the stored choice into the literal the stylesheet matches on. Anything
 *  that isn't an explicit light/dark asks the OS, so 'system' is resolved fresh
 *  on every apply — including the one the media listener triggers. */
export function resolveTheme(p: Prefs = current): 'light' | 'dark' {
	if (p.theme === 'light' || p.theme === 'dark') return p.theme;
	return systemPrefersDark() ? 'dark' : 'light';
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

export function normalizePrefs(raw: any, fallbackReduce = false, fallbackQuality: GraphicsQuality = 'high'): Prefs {
	const o = raw && typeof raw === 'object' ? raw : {};
	const textScale: TextScale = TEXT_SCALES.includes(o.textScale) ? o.textScale : DEFAULTS.textScale;
	// Font: the picker replaced a `dyslexiaFont` on/off switch that swapped in
	// OpenDyslexic. That face is gone, so a save that had it on can't be honoured
	// literally — but silently dropping such a player back to the decorative
	// default would undo a deliberate readability choice. 'plain' (the plainest
	// system sans) is the closest thing still on offer.
	const fontChoice: FontChoice = FONT_CHOICES.includes(o.fontChoice)
		? o.fontChoice
		: o.dyslexiaFont === true
			? 'plain'
			: DEFAULTS.fontChoice;
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
		fontChoice,
		// Neither a save written before dark mode existed nor a brand-new one carries a
		// `theme` key, and both land on light: the game looks the way it always has
		// until somebody goes and changes it. Following the OS is a choice a player
		// makes, not something that happens to them the first time they launch.
		theme: THEME_CHOICES.includes(o.theme) ? o.theme : DEFAULTS.theme,
		highContrast: typeof o.highContrast === 'boolean' ? o.highContrast : DEFAULTS.highContrast,
		textScale,
		musicEnabled: typeof o.musicEnabled === 'boolean' ? o.musicEnabled : DEFAULTS.musicEnabled,
		sfxEnabled: typeof o.sfxEnabled === 'boolean' ? o.sfxEnabled : DEFAULTS.sfxEnabled,
		musicVolume: normalizeVolume(o.musicVolume, DEFAULTS.musicVolume),
		sfxVolume: normalizeVolume(o.sfxVolume, DEFAULTS.sfxVolume),
		keybinds: normalizeKeybinds(o.keybinds),
		interactHint: typeof o.interactHint === 'boolean' ? o.interactHint : DEFAULTS.interactHint,
		simpleText: typeof o.simpleText === 'boolean' ? o.simpleText : DEFAULTS.simpleText,
		graphicsQuality: GRAPHICS_QUALITIES.includes(o.graphicsQuality) ? o.graphicsQuality : fallbackQuality,
	};
}

let current: Prefs = { ...DEFAULTS };
const listeners = new Set<(p: Prefs) => void>();

export function getPrefs(): Prefs {
	return current;
}

/**
 * The device-pixel ratio the game canvas actually renders at — one canvas pixel
 * per this many CSS pixels. High quality renders at native device pixels (capped
 * at 2× for perf); Low pins it to 1×, which is the single biggest frame-rate
 * lever on weak hardware.
 *
 * This is the SINGLE SOURCE OF TRUTH for that ratio, and both halves of the
 * render path must read it from here: PhaserGame sizes and zooms the canvas by
 * it, and WorldScene's camera scales its zoom clamp by it so framing stays
 * identical across ratios.
 *
 * In particular the camera must NOT read the ratio back off Phaser's
 * `scale.displayScale`. That value is derived from the canvas's *measured* CSS
 * bounds and is recomputed before those bounds are re-read, so it lags one
 * refresh behind. While the ratio was fixed at startup that lag was invisible —
 * it converged after the first couple of refreshes. Once the ratio can change at
 * runtime (switching Graphics Quality), the resize handler fires while
 * displayScale still describes the PREVIOUS mode, so the camera would clamp its
 * zoom against the wrong ratio and jump — badly enough to lose the character
 * off-screen. Deriving it from the pref instead is exact on the first frame.
 */
export function renderScale(): number {
	if (current.graphicsQuality === 'low') return 1;
	return Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2);
}

/** Push the plain-language choice into the i18n layer, which owns the overlay. */
function applyToI18n(p: Prefs): void {
	setSimpleText(p.simpleText);
}

function applyToDom(p: Prefs): void {
	if (typeof document === 'undefined' || !document.documentElement) return;
	const root = document.documentElement;
	root.dataset.reduceMotion = p.reduceMotion ? '1' : '0';
	root.dataset.colorblind = p.colorblindMode; // off | redgreen | blueyellow | mono
	root.dataset.font = p.fontChoice;
	root.dataset.theme = resolveTheme(p); // always 'light' | 'dark', never 'system'
	root.dataset.highContrast = p.highContrast ? '1' : '0';
	root.dataset.textScale = p.textScale;
	root.dataset.graphicsQuality = p.graphicsQuality;
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

function notifyAll(): void {
	listeners.forEach((fn) => {
		try {
			fn(current);
		} catch {
			/* one bad listener shouldn't break the rest */
		}
	});
}

/** Merge a patch into the current prefs, persist, apply to the DOM, and notify. */
export function setPrefs(patch: Partial<Prefs>): Prefs {
	current = normalizePrefs({ ...current, ...patch });
	queuePrefsWrite();
	applyToDom(current);
	applyToI18n(current);
	notifyAll();
	return current;
}

// Follow the OS while the choice is 'system' — "match system" that only matches
// at startup isn't matching system. Nothing is persisted here: the stored value
// stays 'system', only the resolved data-theme moves. addEventListener('change')
// is the modern form; Safari <14 only has addListener, hence the fallback.
if (darkQuery) {
	const onSystemThemeChange = () => {
		if (current.theme !== 'system') return;
		applyToDom(current);
		notifyAll();
	};
	if (typeof darkQuery.addEventListener === 'function') darkQuery.addEventListener('change', onSystemThemeChange);
	else darkQuery.addListener?.(onSystemThemeChange);
}

/** React hook: re-renders when any preference changes. */
export function usePrefs(): Prefs {
	return useSyncExternalStore(subscribe, getPrefs, getPrefs);
}

/** React hook for the theme actually on screen — 'light' or 'dark', never
 *  'system'. Unlike usePrefs this also re-renders when the OS flips underneath a
 *  'system' choice, since the Prefs object itself is unchanged in that case. */
export function useResolvedTheme(): 'light' | 'dark' {
	return useSyncExternalStore(
		subscribe,
		() => resolveTheme(current),
		() => 'light' as const,
	);
}

// Restore saved prefs at import time (defaulting reduceMotion to the OS setting,
// and graphics quality to an autodetected guess — see detectDefaultGraphicsQuality).
try {
	const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
	current = normalizePrefs(saved ? JSON.parse(saved) : null, systemReduceMotion(), detectDefaultGraphicsQuality());
} catch {
	current = normalizePrefs(null, systemReduceMotion(), detectDefaultGraphicsQuality());
}
applyToDom(current);
applyToI18n(current); // the saved choice must apply before the first render
