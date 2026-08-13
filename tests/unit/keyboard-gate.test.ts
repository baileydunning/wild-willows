import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { reportKeyboardGate } from '../../src/solo/appOpen';

// Wild Willows needs a keyboard, so a device without one gets the KeyboardGate
// screen instead of the game. That person is the hardest one in the product to
// count: the gate wraps GameProvider, so they never get a player id or a save
// slot, and /SyncMetrics/ — the path every other client metric takes — needs
// both. They can only be counted on the device-scoped AppOpen ping.
//
// Two failure modes are worth pinning down here, because both look like a
// working feature while quietly reporting the wrong number:
//   1. Sending the gate as phase 'open' would count it as a launch, inflating
//      the denominator of every rate on the acquisition panel.
//   2. Reporting without a latch would post again on every flip of
//      (any-pointer: fine) — which is live, so unplugging a mouse re-blocks a
//      desktop — and file one person as several devices.

const GATE = readFileSync(resolve(__dirname, '../../src/ui/KeyboardGate.tsx'), 'utf8');

const okResponse = () => ({ ok: true, status: 200, json: async () => ({ ok: true }) });
const bodyOf = (fetchMock: any, call = 0) => JSON.parse(fetchMock.mock.calls[call][1].body);

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('reportKeyboardGate', () => {
	let fetchMock: any;
	beforeEach(() => {
		localStorage.clear();
		fetchMock = vi.fn(async () => okResponse());
		vi.stubGlobal('fetch', fetchMock);
	});

	it('posts the gate under its own phase, not as an app open', async () => {
		reportKeyboardGate(false);
		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		const body = bodyOf(fetchMock);
		// 'open' would increment this device's open count. A gate ping describes a
		// launch that already pinged; counting it again would double it.
		expect(body.phase).toBe('kb_gate');
		expect(body.phase).not.toBe('open');
		expect(body.keyboardGatePassed).toBe(false);
	});

	it('carries the device facts the dashboard breaks the number down by', async () => {
		reportKeyboardGate(false);
		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		const body = bodyOf(fetchMock);
		// os is what answers "are these phones?" — the whole point of the breakdown.
		expect(body.os).toBeTruthy();
		expect(body.platform).toBeTruthy();
		expect(body.deviceId).toBeTruthy();
	});

	it('flags the tablet-with-a-keyboard case rather than dropping it', async () => {
		reportKeyboardGate(true);
		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		expect(bodyOf(fetchMock).keyboardGatePassed).toBe(true);
	});

	it('stays silent when the network is down', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				throw new TypeError('Failed to fetch');
			}),
		);
		// Best-effort, like every other acquisition ping — a gated player is already
		// having a bad time; an unhandled rejection on top of it helps nobody.
		expect(() => reportKeyboardGate(false)).not.toThrow();
	});
});

describe('KeyboardGate wiring', () => {
	it('reports being blocked, and reports getting in afterwards', () => {
		expect(GATE).toContain("import { reportKeyboardGate } from '../solo/appOpen'");
		expect(GATE).toContain('reportKeyboardGate(false)');
		expect(GATE).toContain('reportKeyboardGate(true)');
	});

	it('latches both sends so one person cannot be counted as several', () => {
		// (any-pointer: fine) is live — the component subscribes to 'change' — so
		// `blocked` can flip more than once in a visit.
		expect(GATE).toContain('const reported = useRef({ blocked: false, gotIn: false })');
		expect(GATE).toContain('reported.current.blocked = true');
		expect(GATE).toContain('reported.current.gotIn = true');
	});

	it('sends nothing for a device that is never blocked', () => {
		// The report lives inside `if (blocked)` / `else if (…reported…)`, so a
		// computer never posts. Guard against a future edit hoisting it out of the
		// branch, which would turn a gate metric into a second opens ping.
		const effect = GATE.slice(GATE.indexOf('useEffect(() => {\n\t\tif (blocked)'));
		const body = effect.slice(0, effect.indexOf('}, [blocked]);'));
		expect(body).toContain('if (blocked)');
		expect(body.indexOf('reportKeyboardGate')).toBeGreaterThan(body.indexOf('if (blocked)'));
	});

	it('still lets a keyboard press through the gate', () => {
		// The escape hatch is the reason `gotIn` exists at all — if this ever goes
		// away, the split stops meaning anything.
		expect(GATE).toContain('setKeyboardSeen(true)');
		expect(GATE).toContain('const blocked = !finePointer && !keyboardSeen');
	});
});
