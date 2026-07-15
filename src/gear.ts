// Player-controlled toggles for the caretaker gear (Hiking Boots, Field
// Binoculars, Headlamp). Owning a piece of gear is permanent — crafted once and
// kept forever — but these switches let you turn its effect on or off from the
// Tools & Upgrades menu.
//
// Every gear effect is purely client-side (movement speed, the unrecorded-animal
// glint, the night-light halo), so the toggles live in localStorage and are read
// synchronously by the Phaser scene, mirroring src/prefs.ts. They're global
// (not stored per-save): a preference for how you like to play, like the
// accessibility settings.

import { useSyncExternalStore } from 'react';

export type GearId = 'boots' | 'binoculars' | 'headlamp';
export type GearToggles = Record<GearId, boolean>;

export const GEAR_IDS: GearId[] = ['boots', 'binoculars', 'headlamp'];
const STORAGE_KEY = 'ww:gear';
// Default ON: crafting a piece of gear means you wanted it, so it starts active.
const DEFAULTS: GearToggles = { boots: true, binoculars: true, headlamp: true };

function normalize(raw: any): GearToggles {
	const o = raw && typeof raw === 'object' ? raw : {};
	const out: GearToggles = { ...DEFAULTS };
	for (const id of GEAR_IDS) if (typeof o[id] === 'boolean') out[id] = o[id];
	return out;
}

let current: GearToggles = { ...DEFAULTS };
const listeners = new Set<(g: GearToggles) => void>();

export function getGear(): GearToggles {
	return current;
}

/** Is this piece of gear switched on? (Ownership is checked separately.) */
export function gearOn(id: GearId): boolean {
	return current[id] !== false;
}

/** Subscribe to toggle changes; returns an unsubscribe fn. */
export function subscribe(fn: (g: GearToggles) => void): () => void {
	listeners.add(fn);
	return () => {
		listeners.delete(fn);
	};
}

/** Flip one gear on/off, persist, and notify listeners (UI + the world). */
export function setGear(id: GearId, on: boolean): GearToggles {
	current = normalize({ ...current, [id]: on });
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
	} catch {
		/* storage unavailable (private mode etc.) — still applies for the session */
	}
	listeners.forEach((fn) => {
		try {
			fn(current);
		} catch {
			/* one bad listener shouldn't break the rest */
		}
	});
	return current;
}

/** React hook: re-renders when any gear toggle changes. */
export function useGear(): GearToggles {
	return useSyncExternalStore(subscribe, getGear, getGear);
}

// Restore saved toggles at import time.
try {
	const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
	current = normalize(saved ? JSON.parse(saved) : null);
} catch {
	current = normalize(null);
}
