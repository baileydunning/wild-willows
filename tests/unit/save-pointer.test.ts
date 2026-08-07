import { describe, it, expect, beforeEach } from 'vitest';
import { isMissingSaveError, rememberSave, lastSave, forgetSave } from '../../src/api';

// Regression: "demo saves are getting deleted — people can't do another session".
//
// The save itself was usually fine. What got destroyed was the POINTER to it:
// `continueLast` (src/state.tsx) and the Continue button (src/ui/Welcome.tsx)
// both called forgetSave() in a bare `catch`, so ANY failure to load erased the
// remembered save — offline, CORS, a 503 while Harper was still starting, or an
// itch demo session whose startup probe timed out and fell back to the offline
// backend, where a Harper-side save simply isn't visible.
//
// After that the title screen had no Continue and no way back to a save that was
// still sitting on the server, intact. One transient blip = permanently lost.
//
// The rule now: only a 404 — the server positively saying "no such save" — is
// allowed to erase the pointer. These tests pin that classification, and the
// round-trip that depends on it.

describe('isMissingSaveError', () => {
	it('is true only for a 404 from the server', () => {
		expect(isMissingSaveError({ status: 404 })).toBe(true);
	});

	it('is false for transient network trouble, which carries no status at all', () => {
		expect(isMissingSaveError(new TypeError('Failed to fetch'))).toBe(false);
		expect(isMissingSaveError(new Error('NetworkError when attempting to fetch resource'))).toBe(false);
		expect(isMissingSaveError({})).toBe(false);
		expect(isMissingSaveError(undefined)).toBe(false);
		expect(isMissingSaveError(null)).toBe(false);
	});

	it('is false while Harper is still booting (503) or overloaded (5xx)', () => {
		for (const status of [500, 502, 503, 504]) {
			expect(isMissingSaveError({ status })).toBe(false);
		}
	});

	it('is false for rate limiting and auth blips', () => {
		for (const status of [401, 403, 408, 429]) {
			expect(isMissingSaveError({ status })).toBe(false);
		}
	});
});

describe('the remembered save survives everything except a real 404', () => {
	beforeEach(() => {
		localStorage.clear();
		rememberSave('kayla-z47x0v', 'Kayla', 'solo');
	});

	/** Exactly the guard both Continue paths now apply. */
	const onContinueFailure = (e: any) => {
		if (isMissingSaveError(e)) forgetSave('solo');
	};

	it('keeps the pointer through an offline blip, so Continue is still there next time', () => {
		onContinueFailure(new TypeError('Failed to fetch'));
		expect(lastSave('solo')).toMatchObject({ playerId: 'kayla-z47x0v', name: 'Kayla' });
	});

	it('keeps the pointer when Harper answers 503 mid-restart', () => {
		onContinueFailure({ status: 503, message: 'the preserve is waking up' });
		expect(lastSave('solo')).toMatchObject({ playerId: 'kayla-z47x0v' });
	});

	it('keeps the pointer when a demo session fell back to the offline backend', () => {
		// The local backend has no such player, so the read fails — but the Harper
		// save is still there and must be reachable on a later, online session.
		onContinueFailure(new Error('no save with that id'));
		expect(lastSave('solo')).toMatchObject({ playerId: 'kayla-z47x0v' });
	});

	it('survives a whole run of transient failures', () => {
		for (const e of [new TypeError('Failed to fetch'), { status: 500 }, { status: 429 }, { status: 503 }, {}]) {
			onContinueFailure(e);
		}
		expect(lastSave('solo')).toMatchObject({ playerId: 'kayla-z47x0v' });
	});

	it('DOES clear the pointer when the server says the save is gone', () => {
		onContinueFailure({ status: 404, message: 'no save with that id' });
		expect(lastSave('solo')).toBeNull();
	});

	it('leaves the co-op pointer alone when the solo one is cleared', () => {
		rememberSave('coop-player', 'Coop', 'coop');
		onContinueFailure({ status: 404 });
		expect(lastSave('solo')).toBeNull();
		expect(lastSave('coop')).toMatchObject({ playerId: 'coop-player' });
	});
});

describe('forgetSave(mode) actually forgets', () => {
	// rememberSave writes the record TWICE — to the per-mode key and to a legacy
	// "most recent" key that carries the same mode tag. forgetSave(mode) only
	// cleared the first, and lastSave(mode) falls back to the second whenever the
	// tag matches, so the save came straight back. That made every mode-scoped
	// forget a silent no-op, including the one after a demo is finished and its
	// server-side save really has been deleted — leaving a Continue button that
	// could only ever fail.
	beforeEach(() => localStorage.clear());

	it('clears a solo save from both the per-mode and legacy keys', () => {
		rememberSave('p1', 'One', 'solo');
		expect(lastSave('solo')).not.toBeNull();
		forgetSave('solo');
		expect(lastSave('solo')).toBeNull();
		expect(lastSave()).toBeNull(); // the legacy copy is gone too
	});

	it('clears a co-op save without touching an unrelated solo save', () => {
		rememberSave('solo-1', 'Solo', 'solo');
		rememberSave('coop-1', 'Coop', 'coop');
		forgetSave('coop');
		expect(lastSave('coop')).toBeNull();
		expect(lastSave('solo')).toMatchObject({ playerId: 'solo-1' });
	});

	it('leaves the legacy record alone when it belongs to the OTHER mode', () => {
		rememberSave('coop-1', 'Coop', 'coop'); // legacy copy is now tagged coop
		forgetSave('solo');
		expect(lastSave('coop')).toMatchObject({ playerId: 'coop-1' });
	});

	it('still clears an untagged legacy record as solo (old saves)', () => {
		localStorage.setItem('wild-willows:last-save', JSON.stringify({ playerId: 'old', name: 'Old' }));
		expect(lastSave('solo')).toMatchObject({ playerId: 'old' });
		forgetSave('solo');
		expect(lastSave('solo')).toBeNull();
	});

	it('forgetSave() with no mode still clears everything', () => {
		rememberSave('solo-1', 'Solo', 'solo');
		rememberSave('coop-1', 'Coop', 'coop');
		forgetSave();
		expect(lastSave('solo')).toBeNull();
		expect(lastSave('coop')).toBeNull();
		expect(lastSave()).toBeNull();
	});
});
