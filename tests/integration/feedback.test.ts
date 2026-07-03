import { describe, it, expect, beforeEach } from 'vitest';
import { freshWorld, type World } from './harness';

// SubmitFeedback: player feedback is stored in the Feedback table and (when
// SMTP creds exist) emailed to the developer. These tests run without creds,
// so `emailed` is false — the endpoint must still store the row and return
// ok:true, which is the client's cue to drop its offline-queue copy.

let w: World;

beforeEach(async () => {
	w = await freshWorld();
});

describe('SubmitFeedback', () => {
	it('stores feedback and returns ok even when email is not configured', async () => {
		const r = await w.post('SubmitFeedback', {
			message: 'The willow grove is gorgeous. Found a bug: chests eat items when full.',
			replyTo: 'player@example.com',
			metrics: { platform: 'desktop', mode: 'solo', playMinutes: 42 },
			queuedAt: Date.now() - 60_000,
		});
		expect(r.ok).toBe(true);
		expect(r.emailed).toBe(false); // no GMAIL_USER/GMAIL_APP_PASSWORD in tests

		const rows = [];
		for await (const row of w.db.Feedback.search()) rows.push(row);
		expect(rows).toHaveLength(1);
		expect(rows[0].message).toContain('chests eat items');
		expect(rows[0].replyTo).toBe('player@example.com');
		expect(rows[0].metrics.playMinutes).toBe(42);
		expect(rows[0].emailedAt).toBeNull();
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
