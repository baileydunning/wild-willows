import { describe, it, expect } from 'vitest';
import { serialRun } from '../../src/serialRun';

// What `await flushFeed()` has to mean.
//
// The first fix made flushFeed return its promise, which looked sufficient and
// wasn't: it empties the buffer BEFORE awaiting the network write, so a caller
// arriving while a write is in flight finds an empty buffer, returns instantly,
// and believes the flush is done while the request is still on the wire. The demo
// hits that on its most important path — the hard-stop fires a flush it doesn't
// await at the same moment the export button appears, and the heartbeat does the
// same on a timer — so an export a beat later could reach the server first and
// carry a save missing its newest lines.
//
// These drive the real helper, with the append held open by hand so the race is
// deterministic rather than a matter of timing luck.

/** Let EVERY pending microtask run. `await Promise.resolve()` only drains one
 *  tick, which is enough for a broken implementation to still look blocked —
 *  a macrotask boundary is what actually settles the queue. */
const settle = () => new Promise((r) => setTimeout(r, 0));

/** A promise you resolve yourself, standing in for a request in flight. */
function deferred() {
	let resolve!: () => void;
	let reject!: (e: unknown) => void;
	const promise = new Promise<void>((res, rej) => {
		resolve = () => res();
		reject = rej;
	});
	return { promise, resolve, reject };
}

describe('serialRun', () => {
	it('THE BUG: a later call waits for a flush that is already in flight', async () => {
		const buffer: string[] = ['a line written just before the demo ended'];
		const sent: string[][] = [];
		const inFlight = deferred();

		const flush = serialRun(async () => {
			if (!buffer.length) return;
			const batch = buffer.splice(0, buffer.length); // emptied BEFORE the await
			await inFlight.promise;
			sent.push(batch);
		});

		void flush(); // the hard-stop's fire-and-forget flush
		await settle(); // let it get as far as the network call
		expect(buffer).toHaveLength(0); // …and the buffer is already empty

		// The player presses Export. Nothing has been sent yet.
		let exportReady = false;
		const exportPath = flush().then(() => {
			exportReady = true;
		});

		await settle();
		expect(exportReady).toBe(false); // must NOT have sailed past the open request
		expect(sent).toHaveLength(0);

		inFlight.resolve();
		await exportPath;
		expect(exportReady).toBe(true);
		expect(sent).toEqual([['a line written just before the demo ended']]);
	});

	it('picks up lines that arrived while the earlier write was open', async () => {
		const buffer: string[] = ['first'];
		const sent: string[][] = [];
		const inFlight = deferred();
		let opened = false;

		const flush = serialRun(async () => {
			if (!buffer.length) return;
			const batch = buffer.splice(0, buffer.length);
			if (!opened) {
				opened = true;
				await inFlight.promise;
			}
			sent.push(batch);
		});

		void flush();
		await settle();
		buffer.push('written while the first request was open'); // a pickup mid-flight

		const second = flush();
		inFlight.resolve();
		await second;

		// Both batches went, in order, and the second run saw the newer line because
		// it re-read the buffer AFTER the first had settled.
		expect(sent).toEqual([['first'], ['written while the first request was open']]);
		expect(buffer).toHaveLength(0);
	});

	it('never lets two runs overlap', async () => {
		let running = 0;
		let overlapped = false;
		const flush = serialRun(async () => {
			running++;
			if (running > 1) overlapped = true;
			await new Promise((r) => setTimeout(r, 1));
			running--;
		});
		await Promise.all([flush(), flush(), flush(), flush()]);
		expect(overlapped).toBe(false);
	});

	it('runs calls in the order they were made', async () => {
		const order: string[] = [];
		let n = 0;
		const runner = serialRun(async () => {
			const mine = `call ${n++}`;
			await new Promise((r) => setTimeout(r, 1));
			order.push(mine);
		});
		await Promise.all([runner(), runner(), runner()]);
		expect(order).toEqual(['call 0', 'call 1', 'call 2']);
	});

	it('a failed run does not poison the ones after it', async () => {
		// An offline blip must not wedge the feed for the rest of the session.
		const sent: string[] = [];
		let failNext = true;
		const flush = serialRun(async () => {
			if (failNext) {
				failNext = false;
				throw new Error('offline');
			}
			sent.push('landed');
		});

		await expect(flush()).rejects.toThrow(/offline/); // the caller who asked hears about it
		await flush(); // …and the next one runs perfectly normally
		expect(sent).toEqual(['landed']);
	});
});
