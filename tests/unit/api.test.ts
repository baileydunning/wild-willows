import { describe, it, expect, beforeEach } from 'vitest';
import {
	api,
	setTransport,
	getTransport,
	setPlayerId,
	getPlayerId,
	rememberSave,
	lastSave,
	forgetSave,
} from '../../src/api';

beforeEach(() => {
	localStorage.clear();
	setPlayerId(null);
	setTransport('web');
});

describe('transport + playerId state', () => {
	it('round-trips the active transport', () => {
		expect(getTransport()).toBe('web');
		setTransport('solo');
		expect(getTransport()).toBe('solo');
		setTransport('coop');
		expect(getTransport()).toBe('coop');
	});

	it('round-trips the current player id', () => {
		expect(getPlayerId()).toBeNull();
		setPlayerId('demo');
		expect(getPlayerId()).toBe('demo');
	});
});

describe('calling the api with no session', () => {
	// The bug this pins down: these methods used to build their request body
	// eagerly with a pid() helper that THREW. The throw happened while the
	// argument object was being assembled — before post() ran, before a promise
	// existed, and so before any .catch() could attach. So
	// `api.heartbeat().catch(() => undefined)` did NOT swallow a missing session;
	// the exception unwound out of the React effect that called it and took the
	// whole app down through the top-level ErrorBoundary. Three players hit a
	// "Not logged in" crash screen for what should have been one skipped beat.
	//
	// Every one of these must REJECT, never throw synchronously.
	const callers: Array<[string, () => Promise<unknown>]> = [
		['heartbeat', () => api.heartbeat(300_000)],
		['appendFeed', () => api.appendFeed([{ icon: 'leaf', text: 'hi', at: Date.now() }])],
		['syncPlayer', () => api.syncPlayer(1, 2, 'meadow', 0)],
		['collect', () => api.collect('meadow', 'n1', 'r1')],
		['craft', () => api.craft('basket')],
		['harvest', () => api.harvest('p1')],
		['recalc', () => api.recalc('meadow')],
		['claimTask', () => api.claimTask('t1')],
		['rest', () => api.rest()],
		['gameState (no explicit id)', () => api.gameState()],
		['metrics (no explicit id)', () => api.metrics()],
	];

	for (const [name, call] of callers) {
		it(`${name} rejects rather than throwing`, async () => {
			setPlayerId(null);
			// The assertion is the shape of the failure, not just that it failed:
			// calling it must not blow up on this line.
			let promise: Promise<unknown>;
			expect(() => (promise = call())).not.toThrow();
			await expect(promise!).rejects.toThrow();
		});
	}

	it('marks the rejection so callers can tell it from a network failure', async () => {
		setPlayerId(null);
		await expect(api.heartbeat()).rejects.toMatchObject({ noSession: true });
	});

	it('a plain .catch() is enough to swallow it', async () => {
		setPlayerId(null);
		// Exactly the call site in state.tsx's heartbeat effect. Before the fix this
		// threw straight past the .catch and out of the effect.
		let swallowed = false;
		await api
			.heartbeat(300_000)
			.then(() => undefined)
			.catch(() => {
				swallowed = true;
			});
		expect(swallowed).toBe(true);
	});

	it('still lets an explicit player id through without a session', () => {
		setPlayerId(null);
		// steamSync and the metrics uplink pass an id directly; those must not be
		// gated on the module-level session.
		expect(() => void api.gameState('someone-abc123').catch(() => undefined)).not.toThrow();
		expect(() => void api.metrics('someone-abc123').catch(() => undefined)).not.toThrow();
	});
});

describe('save memory (per-mode "Continue")', () => {
	it('remembers and reads back the last save for a mode', () => {
		rememberSave('p1', 'Sam', 'solo');
		expect(lastSave('solo')).toMatchObject({ playerId: 'p1', name: 'Sam', mode: 'solo' });
	});

	it('keeps solo and co-op saves separate', () => {
		rememberSave('p1', 'Solo Sam', 'solo');
		rememberSave('p2', 'Coop Cam', 'coop');
		expect(lastSave('solo')).toMatchObject({ playerId: 'p1', mode: 'solo' });
		expect(lastSave('coop')).toMatchObject({ playerId: 'p2', mode: 'coop' });
	});

	it('treats an untagged legacy save as solo', () => {
		// Simulate a save written before per-mode tracking existed.
		localStorage.setItem('wild-willows:last-save', JSON.stringify({ playerId: 'old', name: 'Legacy' }));
		expect(lastSave('solo')).toMatchObject({ playerId: 'old' });
		expect(lastSave('coop')).toBeNull();
	});

	it('forgetSave(mode) clears only that mode', () => {
		rememberSave('p1', 'Solo Sam', 'solo');
		rememberSave('p2', 'Coop Cam', 'coop');
		forgetSave('solo');
		expect(lastSave('solo')).toBeNull();
		expect(lastSave('coop')).toMatchObject({ playerId: 'p2' });
	});

	it('forgetSave() with no mode clears everything', () => {
		rememberSave('p1', 'Solo Sam', 'solo');
		rememberSave('p2', 'Coop Cam', 'coop');
		forgetSave();
		expect(lastSave('solo')).toBeNull();
		expect(lastSave('coop')).toBeNull();
		expect(lastSave()).toBeNull();
	});

	it('returns null when nothing has been saved', () => {
		expect(lastSave('solo')).toBeNull();
		expect(lastSave()).toBeNull();
	});
});
