/**
 * Run one async task at a time, in call order, so that awaiting a call means
 * every call made before it has finished too.
 *
 * The bug this exists for: a "flush my buffer" function that empties the buffer
 * and THEN awaits the network write looks correctly awaitable, and isn't. A
 * second caller arriving while the first write is still in flight finds an empty
 * buffer, returns immediately, and carries on — believing the flush is done when
 * the request is still on the wire. Exporting a demo save hit exactly that: the
 * heartbeat (and the demo's hard-stop) fire flushes they don't await, so a player
 * pressing Export a moment later could get a save missing the very lines the
 * flush was there to keep.
 *
 * Chaining fixes both halves at once, because each run re-reads its source AFTER
 * the previous run has settled:
 *
 *   • awaiting a call waits for the in-flight one, so the write has landed;
 *   • anything that piled up DURING that write is picked up by this run rather
 *     than left for a flush nobody is waiting on.
 *
 * A rejected task doesn't poison the chain — the failure is delivered to the
 * caller that asked for that run, and the next one starts from a clean tail.
 */
export function serialRun(task: () => Promise<void> | void): () => Promise<void> {
	let tail: Promise<void> = Promise.resolve();
	return () => {
		const next = tail.then(() => task());
		tail = next.then(
			() => undefined,
			() => undefined,
		);
		return next;
	};
}
