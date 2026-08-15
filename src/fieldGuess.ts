// Field intuition — the guess the expanded guide asks for before it answers.
//
// The expanded field guide used to print an animal's exact habitat checklist the
// moment you opened its entry, which meant the reward for upgrading the guide
// was that you stopped having to think about habitat at all. This module keeps
// the checklist (nobody gets blocked) but puts one prediction in front of it:
// read the hint, pick which object you believe the animal is waiting for, then
// the list opens. Guessing is retrieval practice; reading is not.
//
// Deliberately client-only. A guess is a note the player made to themselves
// about a page they were reading, not game progress: it grants nothing, gates
// nothing, and the server neither knows nor cares. That keeps it out of the
// save format and off the co-op wire, and means a cleared entry costs the
// player nothing but the chance to guess again.
//
// Mirrors prefs.ts: localStorage-backed, guarded for non-DOM environments
// (Vitest, the server's import of shared modules), and exposed to React through
// useSyncExternalStore so a recorded guess repaints the card immediately.

import { useSyncExternalStore } from 'react';

/** What the player did with an animal's guess prompt. */
export type GuessOutcome = 'correct' | 'wrong' | 'skipped';

const STORAGE_KEY = 'wildwillows:field-guesses';

let guesses: Record<string, GuessOutcome> = {};
const listeners = new Set<() => void>();
/** Bumped on every change and handed to useSyncExternalStore as the snapshot,
 *  so React can compare cheaply without us cloning the map on every read. */
let version = 0;

function load() {
	try {
		const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(STORAGE_KEY);
		if (!raw) return;
		const parsed = JSON.parse(raw) as unknown;
		if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
			// Drop anything that isn't one of our outcomes, so a hand-edited or
			// half-written entry can't put a junk value in front of the player.
			for (const [id, v] of Object.entries(parsed as Record<string, unknown>)) {
				if (v === 'correct' || v === 'wrong' || v === 'skipped') guesses[id] = v;
			}
		}
	} catch {
		// Unparseable or unavailable storage (private mode, disabled, corrupt):
		// start empty. Guesses are a nicety — never fail a journal render for one.
		guesses = {};
	}
}
load();

function save() {
	try {
		if (typeof localStorage === 'undefined') return;
		localStorage.setItem(STORAGE_KEY, JSON.stringify(guesses));
	} catch {
		// Storage full or blocked — keep the in-memory answer for this session.
	}
}

function emit() {
	version++;
	for (const fn of listeners) fn();
}

/** Re-read the store from localStorage, discarding the in-memory copy.
 *  Used when something outside this module has replaced the stored value —
 *  another window of the same save, or a test starting from a clean slate. */
export function reloadGuesses() {
	guesses = {};
	load();
	emit();
}

/** What the player already did with this animal's prompt, if anything. */
export function guessFor(animalId: string): GuessOutcome | undefined {
	return guesses[animalId];
}

/** Record an answer. First answer wins — reopening a card can't farm the tally. */
export function recordGuess(animalId: string, outcome: GuessOutcome) {
	if (guesses[animalId]) return;
	guesses[animalId] = outcome;
	save();
	emit();
}

/** Correct guesses out of the ones actually attempted (skips don't count against). */
export function guessTally(): { correct: number; attempted: number } {
	let correct = 0;
	let attempted = 0;
	for (const v of Object.values(guesses)) {
		if (v === 'skipped') continue;
		attempted++;
		if (v === 'correct') correct++;
	}
	return { correct, attempted };
}

/** Subscribe to guess changes (React store contract). */
function subscribe(fn: () => void) {
	listeners.add(fn);
	return () => {
		listeners.delete(fn);
	};
}

/** Re-render on any recorded guess. Returns a version counter, not the map —
 *  callers read through guessFor/guessTally so nothing depends on identity. */
export function useFieldGuesses(): number {
	return useSyncExternalStore(
		subscribe,
		() => version,
		() => version,
	);
}

// ---------------------------------------------------------------------------
// Choosing what to ask
// ---------------------------------------------------------------------------

/** Small stable string hash (FNV-1a). Same animal → same options, every time
 *  the card is opened, so the prompt can't be rerolled into an easier one. */
function hashStr(s: string): number {
	let h = 0x811c9dc5;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return h >>> 0;
}

/**
 * The object the guess is *about*: the animal's signature requirement when the
 * data names one (it is chosen to be the telling, diagnostic piece of habitat),
 * otherwise the object it needs most of, tie-broken by id so the pick is stable.
 */
export function signatureObject(req: { objects?: Record<string, number>; signature?: string }): string | null {
	const objects = req.objects || {};
	const ids = Object.keys(objects);
	if (!ids.length) return null;
	if (req.signature && objects[req.signature] != null) return req.signature;
	return ids.sort((a, b) => objects[b] - objects[a] || a.localeCompare(b))[0];
}

/**
 * Three options for one animal: the real answer plus two plausible wrong ones.
 *
 * Distractors are drawn from habitat this player could actually build in the
 * same biome, minus everything this animal genuinely needs — so a wrong answer
 * is wrong about *ecology*, not about availability, and the player cannot win
 * by spotting the one item that looks buildable here. The order is seeded on
 * the animal id, so the answer is not always in the same slot but also never
 * moves between openings of the same card.
 */
export function guessOptions(
	animalId: string,
	answer: string,
	ownRequirements: Record<string, number>,
	biomePool: string[],
): string[] {
	const excluded = new Set([...Object.keys(ownRequirements), answer]);
	const pool = [...new Set(biomePool)].filter((id) => !excluded.has(id)).sort();
	const seed = hashStr(animalId);
	const distractors: string[] = [];
	// Walk the sorted pool with a seeded stride so two animals in the same biome
	// don't land on the same pair, without needing a shuffle we'd have to seed.
	if (pool.length) {
		const stride = 1 + (seed % Math.max(1, pool.length - 1));
		let i = seed % pool.length;
		for (let n = 0; n < pool.length && distractors.length < 2; n++) {
			const cand = pool[i % pool.length];
			if (!distractors.includes(cand)) distractors.push(cand);
			i += stride;
		}
	}
	const options = [answer, ...distractors];
	// Rotate rather than shuffle: deterministic, and enough to move the answer
	// off slot 0 for most animals.
	const shift = seed % options.length;
	return [...options.slice(shift), ...options.slice(0, shift)];
}
