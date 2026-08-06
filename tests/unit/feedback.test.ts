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
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				throw new TypeError('Failed to fetch');
			}),
		);
		const r = await sendFeedback('offline thoughts', '', null);
		expect(r.sent).toBe(false);
		expect(pendingFeedbackCount()).toBe(1);
		const [item] = JSON.parse(localStorage.getItem(QUEUE_KEY)!);
		expect(item.message).toBe('offline thoughts');
		expect(item.replyTo).toBeNull();
		expect(item.queuedAt).toBeGreaterThan(0);
	});

	it('surfaces a server rejection instead of queueing it forever', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => badRequest()),
		);
		await expect(sendFeedback('hi', 'bad-email', null)).rejects.toThrow();
		expect(pendingFeedbackCount()).toBe(0);
	});
});

describe('flushFeedbackQueue', () => {
	it('sends queued items and deletes them only after confirmation', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				throw new TypeError('Failed to fetch');
			}),
		);
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
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				throw new TypeError('Failed to fetch');
			}),
		);
		await sendFeedback('still here', '', null);
		await flushFeedbackQueue();
		expect(pendingFeedbackCount()).toBe(1);
	});

	it('drops items the server permanently rejects', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				throw new TypeError('Failed to fetch');
			}),
		);
		await sendFeedback('will 400 later', '', null);
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => badRequest()),
		);
		await flushFeedbackQueue();
		expect(pendingFeedbackCount()).toBe(0); // never sendable — don't retry forever
	});
});

describe('gatherFeedbackMetrics', () => {
	it('reports platform/mode and player progress when a session is open', () => {
		setTransport('solo');
		const m = gatherFeedbackMetrics({
			player: {
				name: 'Sam',
				tutorialStep: 7,
				unlockedBiomes: ['meadow', 'wetland'],
				metrics: { playSeconds: 3600, sessions: 5 },
			},
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

// ---------------------------------------------------------------------------
// Regression: players couldn't submit feedback at all.
//
// Two independent faults, both in postFeedback:
//   1. The base URL was `IS_DESKTOP ? COOP_BASE_URL : ''`, which had never
//      learned about the itch DEMO — a WEB build served cross-origin. Demo
//      feedback POSTed to the itch origin, which serves static files, so it
//      404'd every time.
//   2. Every 4xx except 429 was classified 'invalid', so that 404 was treated as
//      "the player's message is unacceptable": sendFeedback threw an error at
//      them AND the message was discarded rather than queued.
// ---------------------------------------------------------------------------

const notFound = () => ({ ok: false, status: 404, json: async () => ({ title: 'not found' }) });
const serverErr = () => ({ ok: false, status: 500, json: async () => ({ title: 'boom' }) });
const forbidden = () => ({ ok: false, status: 403, json: async () => ({ title: 'nope' }) });
const tooLarge = () => ({ ok: false, status: 413, json: async () => ({ title: 'too big' }) });

describe('a 404 is a routing problem, not a verdict on the message', () => {
	it('does not throw at the player', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => notFound()),
		);
		await expect(sendFeedback('the frog is great', '', null)).resolves.toEqual({ sent: false });
	});

	it('keeps the message instead of discarding it', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => notFound()),
		);
		await sendFeedback('please keep this', '', null);
		expect(pendingFeedbackCount()).toBe(1);
		expect(JSON.parse(localStorage.getItem(QUEUE_KEY)!)[0].message).toBe('please keep this');
	});

	it('delivers it once the endpoint is reachable again', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => notFound()),
		);
		await sendFeedback('deferred', '', null);
		const fetchMock = vi.fn(async () => okResponse());
		vi.stubGlobal('fetch', fetchMock);
		await flushFeedbackQueue();
		expect(pendingFeedbackCount()).toBe(0);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});

describe('only genuine content rejections are permanent', () => {
	it.each([
		['400 bad request', badRequest],
		['413 too large', tooLarge],
	])('drops the item on %s', async (_label, mk) => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mk()),
		);
		await expect(sendFeedback('x', '', null)).rejects.toThrow();
		expect(pendingFeedbackCount()).toBe(0);
	});

	it.each([
		['403 forbidden', forbidden],
		['404 not found', notFound],
		['500 server error', serverErr],
	])('queues the item on %s', async (_label, mk) => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => mk()),
		);
		await expect(sendFeedback('x', '', null)).resolves.toEqual({ sent: false });
		expect(pendingFeedbackCount()).toBe(1);
	});
});

describe('the offline queue stays bounded', () => {
	it('keeps only the newest items when the endpoint is never reachable', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => notFound()),
		);
		for (let i = 0; i < 40; i++) await sendFeedback(`msg ${i}`, '', null);
		expect(pendingFeedbackCount()).toBe(25);
		const q = JSON.parse(localStorage.getItem(QUEUE_KEY)!);
		expect(q[q.length - 1].message).toBe('msg 39'); // newest kept
		expect(q[0].message).toBe('msg 15'); // oldest dropped
	});
});

describe('feedback always targets the hosted Harper', () => {
	it('posts to a same-origin path on the plain web build', async () => {
		const fetchMock = vi.fn(async () => okResponse());
		vi.stubGlobal('fetch', fetchMock);
		await sendFeedback('hello', '', null);
		// The web build is itself served by Harper, so same-origin is correct.
		expect(fetchMock.mock.calls[0][0]).toBe('/SubmitFeedback/');
	});

	it('always uses the SubmitFeedback endpoint regardless of game transport', async () => {
		const fetchMock = vi.fn(async () => okResponse());
		vi.stubGlobal('fetch', fetchMock);
		setTransport('solo'); // offline gameplay — feedback still goes to the server
		await sendFeedback('from solo', '', null);
		expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/SubmitFeedback\/$/);
	});
});
