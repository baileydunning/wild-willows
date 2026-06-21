import { describe, it, expect, beforeEach } from 'vitest';
import {
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
