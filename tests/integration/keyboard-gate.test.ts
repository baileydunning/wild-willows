import { describe, it, expect, beforeEach } from 'vitest';
import { freshWorld, type World } from './harness';

// The keyboard gate, end to end: POST /AppOpen/ {phase:'kb_gate'} → sticky flags
// on the device row → summary.acquisition.keyboardGate.
//
// A device with no keyboard never reaches a save slot, so this row is the only
// place it can be counted, and it was previously counted as a bounce — someone
// who opened the game and chose to leave. Everything below exists to keep that
// correction from introducing a new wrong number in its place.

let w: World;
beforeEach(async () => {
	w = await freshWorld();
});

const gateOf = async () => (await w.get('MetricsSummary')).summary.acquisition.keyboardGate;

describe('keyboard gate (AppOpen)', () => {
	it('counts a blocked device without counting it as another open', async () => {
		await w.post('AppOpen', { deviceId: 'phone-1', phase: 'open', platform: 'web', os: 'ios' });
		await w.post('AppOpen', { deviceId: 'phone-1', phase: 'kb_gate', keyboardGatePassed: false });

		const a = (await w.get('MetricsSummary')).summary.acquisition;
		expect(a.devices).toBe(1);
		// The gate ping describes the launch that already pinged. If it bumped
		// opens, every rate on the acquisition panel would drift.
		expect(a.totalOpens).toBe(1);
		expect(a.keyboardGate.shown).toBe(1);
		expect(a.keyboardGate.turnedAway).toBe(1);
	});

	it('keeps the tablet that found a keyboard out of the turned-away count', async () => {
		await w.post('AppOpen', { deviceId: 'ipad-1', phase: 'open', platform: 'web', os: 'ios' });
		await w.post('AppOpen', { deviceId: 'ipad-1', phase: 'kb_gate', keyboardGatePassed: false });
		// …a Bluetooth keyboard turns up and they get in.
		await w.post('AppOpen', { deviceId: 'ipad-1', phase: 'kb_gate', keyboardGatePassed: true });

		const kg = await gateOf();
		expect(kg.shown).toBe(1);
		expect(kg.gotIn).toBe(1);
		expect(kg.turnedAway).toBe(0);
	});

	it('never un-gates a device once it has been gated', async () => {
		await w.post('AppOpen', { deviceId: 'phone-2', phase: 'open', platform: 'web', os: 'android' });
		await w.post('AppOpen', { deviceId: 'phone-2', phase: 'kb_gate', keyboardGatePassed: false });
		// A later ordinary launch must not re-derive the flag from a request that
		// says nothing about it — a phone turned away in March is still a phone
		// turned away.
		await w.post('AppOpen', { deviceId: 'phone-2', phase: 'open', platform: 'web', os: 'android' });

		const kg = await gateOf();
		expect(kg.shown).toBe(1);
		expect(kg.turnedAway).toBe(1);
	});

	it('and never un-passes one either', async () => {
		await w.post('AppOpen', { deviceId: 'ipad-2', phase: 'open', platform: 'web', os: 'ios' });
		await w.post('AppOpen', { deviceId: 'ipad-2', phase: 'kb_gate', keyboardGatePassed: true });
		// A second visit with the keyboard unplugged blocks again; it must not
		// resurrect them as turned away, or one person oscillates between buckets.
		await w.post('AppOpen', { deviceId: 'ipad-2', phase: 'kb_gate', keyboardGatePassed: false });

		const kg = await gateOf();
		expect(kg.gotIn).toBe(1);
		expect(kg.turnedAway).toBe(0);
	});

	it('breaks the turned-away devices down by operating system', async () => {
		for (const [id, os] of [
			['p1', 'ios'],
			['p2', 'ios'],
			['p3', 'android'],
		] as const) {
			await w.post('AppOpen', { deviceId: id, phase: 'open', platform: 'web', os });
			await w.post('AppOpen', { deviceId: id, phase: 'kb_gate', keyboardGatePassed: false });
		}
		// got in — must not appear in the breakdown
		await w.post('AppOpen', { deviceId: 'p4', phase: 'open', platform: 'web', os: 'android' });
		await w.post('AppOpen', { deviceId: 'p4', phase: 'kb_gate', keyboardGatePassed: true });

		const kg = await gateOf();
		expect(kg.byOs).toEqual({ ios: 2, android: 1 });
	});

	it('says how much of the bounce rate it accounts for', async () => {
		// two phones turned away, one person who opened and left, one who played
		await w.post('AppOpen', { deviceId: 'p1', phase: 'open', platform: 'web', os: 'ios' });
		await w.post('AppOpen', { deviceId: 'p1', phase: 'kb_gate', keyboardGatePassed: false });
		await w.post('AppOpen', { deviceId: 'p2', phase: 'open', platform: 'web', os: 'android' });
		await w.post('AppOpen', { deviceId: 'p2', phase: 'kb_gate', keyboardGatePassed: false });
		await w.post('AppOpen', { deviceId: 'quitter', phase: 'open', platform: 'desktop', os: 'mac' });
		await w.post('AppOpen', { deviceId: 'player', phase: 'open', platform: 'desktop', os: 'mac' });
		await w.post('AppOpen', { deviceId: 'player', phase: 'created', creationMs: 4000 });

		const a = (await w.get('MetricsSummary')).summary.acquisition;
		expect(a.devices).toBe(4);
		expect(a.bounced).toBe(3);
		// 2 of the 3 "bounces" never got the chance to bounce.
		expect(a.keyboardGate.turnedAway).toBe(2);
		expect(a.keyboardGate.pctOfBounced).toBe(67);
		expect(a.keyboardGate.pctOfDevices).toBe(50);
	});

	it('dates the number instead of implying it covers all time', async () => {
		const before = await gateOf();
		// Nothing gated yet: zeros, and no start date to imply otherwise.
		expect(before.shown).toBe(0);
		expect(before.since).toBe(0);

		await w.post('AppOpen', { deviceId: 'p1', phase: 'open', platform: 'web', os: 'ios' });
		await w.post('AppOpen', { deviceId: 'p1', phase: 'kb_gate', keyboardGatePassed: false });
		const after = await gateOf();
		expect(after.since).toBeGreaterThan(0);
	});

	it('still requires a device id', async () => {
		await expect(w.post('AppOpen', { phase: 'kb_gate' })).rejects.toThrow();
	});
});
