import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { api, setTransport, setPlayerId } from '../../src/api';

// When the network drops, fetch() rejects rather than resolving with a status, and
// the browser's own wording for that is "Failed to fetch" ("Load failed" in
// Safari). That string used to travel all the way to a toast — it names an
// internal API, tells the player nothing about what broke, and offers no way out.
//
// Worse, it arrived once per attempt. Every gather, craft and step goes through
// the same wrapper, so a player who lost their wifi and kept playing stacked up
// identical cards until they gave up. Both halves are asserted here: the message
// is a sentence a person can act on, and the raw one never escapes.

describe('losing the connection', () => {
	const realFetch = globalThis.fetch;

	beforeEach(() => {
		setTransport('web');
		setPlayerId('player-1');
	});
	afterEach(() => {
		globalThis.fetch = realFetch;
		vi.restoreAllMocks();
	});

	/** Every shape a browser uses for "the request never reached a server". */
	const networkFailures = [
		new TypeError('Failed to fetch'), // Chrome / Firefox
		new TypeError('Load failed'), // Safari
		new TypeError('NetworkError when attempting to fetch resource.'),
	];

	it('explains the problem instead of quoting the browser', async () => {
		for (const failure of networkFailures) {
			globalThis.fetch = vi.fn().mockRejectedValue(failure) as any;
			const err = await api.gameState().then(
				() => null,
				(e) => e,
			);
			expect(err, 'the call should still reject').toBeTruthy();
			// The player-facing half: no internal wording, and it says what to do.
			expect(err.message).not.toMatch(/failed to fetch|load failed|networkerror/i);
			expect(err.message.toLowerCase()).toContain('connection');
			// The programmatic half, so callers can tell "offline" from "server said no".
			expect(err.offline).toBe(true);
			// The real reason is kept for the console rather than thrown away.
			expect(err.cause).toBe(failure);
		}
	});

	it('leaves a real server response alone', async () => {
		// A 4xx carries a message the server chose on purpose — that one is worth
		// showing verbatim, and must not be flattened into the offline wording.
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 400,
			json: async () => ({ title: 'Your basket is full' }),
		}) as any;
		const err = await api.gameState().then(
			() => null,
			(e) => e,
		);
		expect(err.message).toBe('Your basket is full');
		expect(err.status).toBe(400);
		expect(err.offline).toBeUndefined();
	});
});

// The other half of "don't say it a thousand times" lives in the toast helper in
// state.tsx, which is closed over by the provider and can't be imported directly.
// Assert the shape that makes it work instead — a regression here is silent, and
// only shows up as the same wall of cards the fix was for.
describe('repeated messages', () => {
	const src = readFileSync(resolve(__dirname, '../../src/state.tsx'), 'utf8');

	it('extends the message already showing rather than stacking another', () => {
		expect(src).toMatch(/lastToast/);
		// same text AND same kind, so an error never silently swallows an info line
		expect(src).toMatch(/showing\.text === text && showing\.kind === kind/);
		// extending means resetting the timer, not adding a toast
		expect(src).toMatch(/clearTimeout\(showing\.timer\)/);
	});

	it('frees the slot when a message is dismissed by hand', () => {
		// Without this the next identical message extends a card that has already
		// gone, and the player sees nothing at all — a worse bug than the spam.
		const dismiss = src.slice(src.indexOf('const dismissToast'), src.indexOf('const toast'));
		expect(dismiss).toMatch(/lastToast\.current\?\.id === id/);
		expect(dismiss).toMatch(/lastToast\.current = null/);
	});
});
