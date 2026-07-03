import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { sendFeedback, flushFeedbackQueue, pendingFeedbackCount, gatherFeedbackMetrics } from '../../src/feedback';
import { setTransport } from '../../src/api';

// The offline path: feedback that can't reach the server is queued in
// localStorage and retried at session start, deleted only after the server
// confirms (ok:true) it stored the item.

const QUEUE_KEY = 'wild-willows:feedback-queue';

const okResponse = () => ({ ok: true, status: 200, json: async () => ({ ok: true, id: 'fb_1' }) });
const badRequest = () => ({ ok: false, status: 400, json: async () => ({ title: 'nope' }) });

beforeEach(() => {
	localStorage.clear();
	setTransport('web');
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('sendFeedback', () => {
	it('resolves sent:true and queues nothing when the server confirms', async () => {
		const fetchMock = vi.fn(async () => okResponse());
		vi.stubGlobal('fetch', fetchMock);
		const r = await sendFeedback('love the otters', 'me@example.com', null);
		expect(r.sent).toBe(true);
		expect(pendingFeedbackCount()).toBe(0);
		const body = JSON.parse(fetchMock.mock.calls[0][1].body);
		expect(body.message).toBe('love the otters');
		expect(body.replyTo).toBe('me@example.com');
		expect(body.metrics.mode).toBe('web');
	});

	it('queues the item locally when the network is down', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
		const r = await sendFeedback('offline thoughts', '', null);
		expect(r.sent).toBe(false);
		expect(pendingFeedbackCount()).toBe(1);
		const [item] = JSON.parse(localStorage.getItem(QUEUE_KEY)!);
		expect(item.message).toBe('offline thoughts');
		expect(item.replyTo).toBeNull();
		expect(item.queuedAt).toBeGreaterThan(0);
	});

	it('surfaces a server rejection instead of queueing it forever', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => badRequest()));
		await expect(sendFeedback('hi', 'bad-email', null)).rejects.toThrow();
		expect(pendingFeedbackCount()).toBe(0);
	});
});

describe('flushFeedbackQueue', () => {
	it('sends queued items and deletes them only after confirmation', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
		await sendFeedback('first', '', null);
		await sendFeedback('second', '', null);
		expect(pendingFeedbackCount()).toBe(2);

		const fetchMock = vi.fn(async () => okResponse());
		vi.stubGlobal('fetch', fetchMock);
		await flushFeedbackQueue();
		expect(pendingFeedbackCount()).toBe(0);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('keeps the queue intact when still offline', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
		await sendFeedback('still here', '', null);
		await flushFeedbackQueue();
		expect(pendingFeedbackCount()).toBe(1);
	});

	it('drops items the server permanently rejects', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
		await sendFeedback('will 400 later', '', null);
		vi.stubGlobal('fetch', vi.fn(async () => badRequest()));
		await flushFeedbackQueue();
		expect(pendingFeedbackCount()).toBe(0); // never sendable — don't retry forever
	});
});

describe('gatherFeedbackMetrics', () => {
	it('reports platform/mode and player progress when a session is open', () => {
		setTransport('solo');
		const m = gatherFeedbackMetrics({
			player: { name: 'Sam', tutorialStep: 7, unlockedBiomes: ['meadow', 'wetland'], metrics: { playSeconds: 3600, sessions: 5 } },
			achievements: ['a', 'b'],
		} as any);
		expect(m.mode).toBe('solo');
		expect(m.playerName).toBe('Sam');
		expect(m.tutorialStep).toBe(7);
		expect(m.unlockedBiomes).toBe('meadow, wetland');
		expect(m.achievements).toBe(2);
		expect(m.playMinutes).toBe(60);
		expect(m.sessions).toBe(5);
	});
});
