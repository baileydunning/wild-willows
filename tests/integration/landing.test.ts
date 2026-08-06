import { describe, it, expect, beforeEach } from 'vitest';
import { freshWorld, type World } from './harness';

// Landing-page endpoints: JoinMailingList stores deduped signup emails
// (read back only via the admin-only ListMailingList — it extends the raw
// Resource, like ListFeedback), and LandingEvent aggregates anonymous
// visit/click beacons into per-day LandingStat rows that the public
// LandingStats rollup (and the /dashboard landing section) reads.

let w: World;

beforeEach(async () => {
	w = await freshWorld();
});

describe('JoinMailingList', () => {
	it('stores a signup, normalizing and deduping by email', async () => {
		const r = await w.post('JoinMailingList', { email: '  Fan@Example.COM ', source: 'landing' });
		expect(r.ok).toBe(true);

		// same address, different casing — must not create a second row,
		// and must not reveal that the address already existed
		const again = await w.post('JoinMailingList', { email: 'fan@example.com' });
		expect(again).toEqual({ ok: true });

		const rows = [];
		for await (const row of w.db.MailingListSignup.search()) rows.push(row);
		expect(rows).toHaveLength(1);
		expect(rows[0].email).toBe('fan@example.com');
		expect(rows[0].source).toBe('landing');
		expect(rows[0].createdAt).toBeGreaterThan(0);
	});

	it('rejects a missing or malformed email', async () => {
		await expect(w.post('JoinMailingList', {})).rejects.toThrow();
		await expect(w.post('JoinMailingList', { email: 'not-an-email' })).rejects.toThrow();
		const rows = [];
		for await (const row of w.db.MailingListSignup.search()) rows.push(row);
		expect(rows).toHaveLength(0);
	});

	it('silently drops honeypot (bot) submissions', async () => {
		const r = await w.post('JoinMailingList', { email: 'bot@spam.example', website: 'https://spam.example' });
		expect(r.ok).toBe(true);
		const rows = [];
		for await (const row of w.db.MailingListSignup.search()) rows.push(row);
		expect(rows).toHaveLength(0);
	});
});

describe('ListMailingList', () => {
	it('returns all signups, newest first', async () => {
		await w.post('JoinMailingList', { email: 'a@example.com' });
		await new Promise((r) => setTimeout(r, 5)); // force distinct createdAt ordering
		await w.post('JoinMailingList', { email: 'b@example.com' });

		const out = await w.get('ListMailingList');
		expect(out.count).toBe(2);
		expect(out.signups[0].email).toBe('b@example.com');
		expect(out.signups[1].email).toBe('a@example.com');
	});

	it('is empty when nobody has signed up', async () => {
		const out = await w.get('ListMailingList');
		expect(out.count).toBe(0);
		expect(out.signups).toEqual([]);
	});
});

describe('LandingEvent + LandingStats', () => {
	it('aggregates visits, uniques, clicks and signups into per-day rows', async () => {
		await w.post('LandingEvent', { type: 'visit', first: true });
		await w.post('LandingEvent', { type: 'visit' });
		await w.post('LandingEvent', { type: 'click', target: 'itch' });
		await w.post('LandingEvent', { type: 'click', target: 'itch' });
		await w.post('LandingEvent', { type: 'click', target: 'appstore' });
		// junk target must collapse into "other", not mint a new counter key
		await w.post('LandingEvent', { type: 'click', target: 'weird<script>' });
		await w.post('JoinMailingList', { email: 'fan@example.com' });

		const out = await w.get('LandingStats');
		expect(out.totals.visits).toBe(2);
		expect(out.totals.uniques).toBe(1);
		expect(out.totals.clicks.itch).toBe(2);
		expect(out.totals.clicks.appstore).toBe(1);
		expect(out.totals.clicks.other).toBe(1);
		expect(out.totals.totalClicks).toBe(4);
		expect(out.totals.signups).toBe(1);
		expect(out.days).toHaveLength(1);
		expect(out.days[0].visits).toBe(2);
		expect(out.days[0].totalClicks).toBe(4);
	});

	it('never exposes emails through the public rollup', async () => {
		await w.post('JoinMailingList', { email: 'secret@example.com' });
		const out = await w.get('LandingStats');
		expect(JSON.stringify(out)).not.toContain('secret@example.com');
	});

	it('accepts unknown ping types without throwing or writing', async () => {
		const r = await w.post('LandingEvent', { type: 'nonsense' });
		expect(r.ok).toBe(true);
		// read the table directly (the LandingStats endpoint has a short-lived
		// in-module cache, so table state is the reliable assertion here)
		const rows = [];
		for await (const row of w.db.LandingStat.search()) rows.push(row);
		expect(rows).toHaveLength(0);
	});
});
