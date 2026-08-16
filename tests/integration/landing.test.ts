import { describe, it, expect, beforeEach } from 'vitest';
import { freshWorld, type World } from './harness';

// Landing-page endpoints: LandingEvent aggregates anonymous visit/click
// beacons into per-day LandingStat rows that the LandingStats rollup (and the
// /dashboard landing section) reads, and the two classroom PDFs count their own
// downloads server-side.
//
// A JoinMailingList / ListMailingList pair used to be covered here too. Both
// endpoints and the MailingListSignup table behind them were removed — the site
// collects no email address by any route now, so there is nothing left to test
// and nothing left that could leak one.

let w: World;

beforeEach(async () => {
	w = await freshWorld();
});

describe('LandingEvent + LandingStats', () => {
	it('aggregates visits, uniques and clicks into per-day rows', async () => {
		await w.post('LandingEvent', { type: 'visit', first: true });
		await w.post('LandingEvent', { type: 'visit' });
		await w.post('LandingEvent', { type: 'click', target: 'itch' });
		await w.post('LandingEvent', { type: 'click', target: 'itch' });
		await w.post('LandingEvent', { type: 'click', target: 'appstore' });
		// junk target must collapse into "other", not mint a new counter key
		await w.post('LandingEvent', { type: 'click', target: 'weird<script>' });

		const out = await w.get('LandingStats');
		expect(out.totals.visits).toBe(2);
		expect(out.totals.uniques).toBe(1);
		expect(out.totals.clicks.itch).toBe(2);
		expect(out.totals.clicks.appstore).toBe(1);
		expect(out.totals.clicks.other).toBe(1);
		expect(out.totals.totalClicks).toBe(4);
		// The rollup carries no signup series at all now, not a zeroed one.
		expect(out.totals.signups).toBeUndefined();
		expect(out.days[0].signups).toBeUndefined();
		expect(out.days).toHaveLength(1);
		expect(out.days[0].visits).toBe(2);
		expect(out.days[0].totalClicks).toBe(4);
	});

	// Regression: Harper hands back FROZEN records (the harness does too, since the
	// day this bit us), so a counter that mutated the fetched row in place threw
	// "Cannot assign to read only property" inside bumpLandingStat's catch. Every
	// event after the first of the day was swallowed and the dashboard read a flat
	// 1 visit/day. Anything past the first increment here is the real assertion.
	it("keeps counting long after the day's row exists", async () => {
		for (let i = 0; i < 5; i++) await w.post('LandingEvent', { type: 'visit' });
		for (let i = 0; i < 3; i++) await w.post('LandingEvent', { type: 'click', target: 'pdf-guide' });

		const rows = [];
		for await (const row of w.db.LandingStat.search()) rows.push(row);
		expect(rows).toHaveLength(1); // still ONE row for the day, not a fresh one each time
		expect(rows[0].visits).toBe(5);
		expect(rows[0].clicks['pdf-guide']).toBe(3);
	});

	it('counts the classroom PDF targets instead of collapsing them into other', async () => {
		await w.post('LandingEvent', { type: 'click', target: 'pdf-worksheets' });
		await w.post('LandingEvent', { type: 'click', target: 'school-copy' });
		await w.post('LandingEvent', { type: 'click', target: 'edu-nav' });

		const out = await w.get('LandingStats');
		expect(out.totals.clicks['pdf-worksheets']).toBe(1);
		expect(out.totals.clicks['school-copy']).toBe(1);
		expect(out.totals.clicks['edu-nav']).toBe(1);
		expect(out.totals.clicks.other).toBeUndefined();
	});

	// The mailing list is gone: no endpoint to post an address to, no table for
	// one to land in. Asserted rather than assumed, because a half-removal that
	// left JoinMailingList reachable would quietly start collecting PII again
	// behind a landing page that no longer asks for it.
	it('has no mailing-list surface left to collect an address', async () => {
		// Wrapped in a thunk rather than awaited directly: the harness resolves the
		// endpoint class synchronously, so a missing one throws where it is called
		// instead of handing back a rejected promise.
		await expect(
			Promise.resolve().then(() => w.post('JoinMailingList', { email: 'secret@example.com' })),
		).rejects.toThrow(/No endpoint named JoinMailingList/);
		expect(w.db.MailingListSignup).toBeUndefined();
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

describe('classroom PDFs', () => {
	it('serves each PDF and counts the download server-side', async () => {
		const guide = await w.get('educator-guide.pdf');
		expect(guide.status).toBe(200);
		expect(guide.headers['content-type']).toBe('application/pdf');
		// real PDF bytes, not an empty/placeholder body
		expect(guide.body.length).toBeGreaterThan(1000);
		expect(guide.body.subarray(0, 4).toString('latin1')).toBe('%PDF');

		const sheets = await w.get('student-worksheets.pdf');
		expect(sheets.status).toBe(200);
		expect(sheets.body.subarray(0, 4).toString('latin1')).toBe('%PDF');

		// a second fetch of the guide must add to the count, not reset it
		await w.get('educator-guide.pdf');

		const out = await w.get('LandingStats');
		expect(out.totals.downloads.guide).toBe(2);
		expect(out.totals.downloads.worksheets).toBe(1);
		expect(out.totals.totalDownloads).toBe(3);
		expect(out.days[0].totalDownloads).toBe(3);
	});

	it('resolves under the bare name too, in case Harper strips the extension', async () => {
		const guide = await w.get('educator-guide');
		expect(guide.status).toBe(200);
		expect(guide.headers['content-type']).toBe('application/pdf');
	});
});
