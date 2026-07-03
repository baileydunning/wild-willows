import { describe, it, expect, beforeEach } from 'vitest';
import { freshWorld, type World } from './harness';

// SubmitFeedback stores player feedback in the Feedback table; ok:true is the
// client's cue to drop its offline-queue copy. ListFeedback (admin-only in
// production — it extends the raw Resource, not PublicEndpoint) reads it all
// back, newest first.

let w: World;

beforeEach(async () => {
	w = await freshWorld();
});

describe('SubmitFeedback', () => {
	it('stores feedback and returns ok', async () => {
		const r = await w.post('SubmitFeedback', {
			message: 'The willow grove is gorgeous. Found a bug: chests eat items when full.',
			replyTo: 'player@example.com',
			metrics: { platform: 'desktop', mode: 'solo', playMinutes: 42 },
			queuedAt: Date.now() - 60_000,
		});
		expect(r.ok).toBe(true);
		expect(r.id).toBeTruthy();

		const rows = [];
		for await (const row of w.db.Feedback.search()) rows.push(row);
		expect(rows).toHaveLength(1);
		expect(rows[0].message).toContain('chests eat items');
		expect(rows[0].replyTo).toBe('player@example.com');
		expect(rows[0].metrics.playMinutes).toBe(42);
	});

	it('treats replyTo as optional', async () => {
		const r = await w.post('SubmitFeedback', { message: 'More frogs please', metrics: {} });
		expect(r.ok).toBe(true);
		const rows = [];
		for await (const row of w.db.Feedback.search()) rows.push(row);
		expect(rows[0].replyTo).toBeNull();
	});

	it('rejects an empty message and a malformed reply email', async () => {
		await expect(w.post('SubmitFeedback', { message: '   ' })).rejects.toThrow();
		await expect(w.post('SubmitFeedback', { message: 'hi', replyTo: 'not-an-email' })).rejects.toThrow();
		const rows = [];
		for await (const row of w.db.Feedback.search()) rows.push(row);
		expect(rows).toHaveLength(0);
	});

	it('rejects a message over the length cap', async () => {
		await expect(w.post('SubmitFeedback', { message: 'x'.repeat(4001) })).rejects.toThrow();
	});
});

describe('ListFeedback', () => {
	it('returns all feedback, newest first', async () => {
		await w.post('SubmitFeedback', { message: 'first note' });
		// force distinct createdAt ordering
		await new Promise((r) => setTimeout(r, 5));
		await w.post('SubmitFeedback', { message: 'second note', replyTo: 'p@example.com' });

		const out = await w.get('ListFeedback');
		expect(out.count).toBe(2);
		expect(out.feedback[0].message).toBe('second note');
		expect(out.feedback[1].message).toBe('first note');
	});

	it('is empty when nothing has been submitted', async () => {
		const out = await w.get('ListFeedback');
		expect(out.count).toBe(0);
		expect(out.feedback).toEqual([]);
	});
});
