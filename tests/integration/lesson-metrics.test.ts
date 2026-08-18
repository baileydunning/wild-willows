import { describe, it, expect, beforeEach } from 'vitest';
import { freshWorld, type World } from './harness';

// POST /LessonEvent/ → LessonStat → GET /LessonStats/.
//
// The classroom pages' counters, on the same shape as the landing ones and with
// the same hazards. Two of these assertions exist because of bugs that already
// happened once in this codebase:
//
//   • Harper hands back FROZEN records, so a counter that mutates the fetched
//     row throws — into a catch, silently. That is how the landing numbers
//     flatlined at 1/day for weeks while every test passed. Anything past the
//     first event of the day is the real assertion here.
//   • An unbounded key space on a public, unauthenticated endpoint is an
//     unbounded write with a stranger's hand on the dial. Every key is
//     allowlisted; this is what proves it.
//
// And one that exists because of the contract: no identifiers, no free text, no
// raw durations. If a change makes one of these fail, the fix is in PRIVACY.md
// first and the code second.

let w: World;
beforeEach(async () => {
	w = await freshWorld();
});

const send = (counts: Record<string, number>, page = 'builder') => w.post<any>('LessonEvent', { page, counts });

describe('LessonEvent', () => {
	it('aggregates a batch into the day row', async () => {
		await send({ builder_open: 1, runs_manual: 3, first_run: 1 });
		const out = await w.get<any>('LessonStats');
		expect(out.totals.builder_open).toBe(1);
		expect(out.totals.runs_manual).toBe(3);
		expect(out.sessions).toBe(1);
	});

	it('keeps counting long after the day’s row exists', async () => {
		// THE FROZEN-RECORD REGRESSION. The harness freezes reads the way Harper
		// does, so a counter that mutates the fetched row in place fails here and
		// nowhere else. Everything after the first batch is the point.
		await send({ runs_manual: 1 });
		await send({ runs_manual: 1 });
		await send({ runs_manual: 1 });
		const out = await w.get<any>('LessonStats');
		expect(out.totals.runs_manual).toBe(3);
		expect(out.sessions).toBe(3);
	});

	it('accepts only allowlisted counters', async () => {
		await send({ runs_manual: 1, 'DROP TABLE students': 5, madeUpEntirely: 2 });
		const out = await w.get<any>('LessonStats');
		expect(out.totals.runs_manual).toBe(1);
		expect(out.totals['droptablestudents']).toBeUndefined();
		expect(out.totals.madeupentirely).toBeUndefined();
		// Rejects are counted, not discarded: a rising `other` is the signal that a
		// page is reporting something this list has not been taught yet.
		expect(out.totals.other).toBe(2);
	});

	it('allows the error names the runner actually produces, and no others', async () => {
		await send({ 'errors_null-property': 2, 'errors_fetch-failed': 1, 'errors_invented-name': 7 });
		const out = await w.get<any>('LessonStats');
		expect(out.totals['errors_null-property']).toBe(2);
		expect(out.totals['errors_fetch-failed']).toBe(1);
		expect(out.totals['errors_invented-name']).toBeUndefined();
		// A ranking that can be seeded with invented names is not a work queue.
		expect(out.errors.map((e: any) => e.key)).not.toContain('invented-name');
	});

	it('allows the bounded families', async () => {
		await send({
			chapter_6_reached: 1,
			iter_map: 1,
			cond_if: 1,
			checkpoint_title: 1,
			'idea_meadow-roll-call': 1,
			'dwell_chapter-6_1to3m': 1,
		});
		const out = await w.get<any>('LessonStats');
		for (const key of ['chapter_6_reached', 'iter_map', 'cond_if', 'checkpoint_title', 'idea_meadow-roll-call'])
			expect(out.totals[key], key).toBe(1);
	});

	it('rejects a family member outside its bounds', async () => {
		await send({ chapter_0_reached: 1, iter_notAMethod: 1, ['idea_' + 'x'.repeat(64)]: 1 });
		const out = await w.get<any>('LessonStats');
		expect(out.totals.chapter_0_reached).toBeUndefined();
		expect(out.totals.iter_notamethod).toBeUndefined();
		expect(out.totals.other).toBe(3);
	});

	it('clamps an absurd count', async () => {
		// One page-session cannot legitimately produce a billion of anything, and a
		// single bad client should not make a day's numbers unreadable.
		await send({ runs_manual: 1e9 });
		const out = await w.get<any>('LessonStats');
		expect(out.totals.runs_manual).toBeLessThanOrEqual(5000);
	});

	it('never breaks the page, whatever it is sent', async () => {
		// Analytics does not get to surface in a lesson. Every one of these is
		// nonsense and every one must answer ok.
		for (const body of [{}, { page: 'builder' }, { counts: null }, { counts: [] }, { page: 'x', counts: { a: 'b' } }])
			expect((await w.post<any>('LessonEvent', body)).ok).toBe(true);
	});
});

describe('LessonStats', () => {
	it('builds the funnel in order, from real counts', async () => {
		await send({
			view_hub: 10,
			view_coding: 6,
			view_lesson: 5,
			builder_open: 4,
			first_run: 3,
			first_fetch_ok: 2,
			download: 1,
		});
		const out = await w.get<any>('LessonStats');
		expect(out.funnel.map((f: any) => f.id)).toEqual([
			'hub',
			'coding',
			'lesson',
			'builder',
			'run',
			'fetch',
			'download',
		]);
		expect(out.funnel.map((f: any) => f.n)).toEqual([10, 6, 5, 4, 3, 2, 1]);
	});

	it('ranks errors so the worst one is the next thing to explain', async () => {
		await send({ 'errors_null-property': 5, errors_syntax: 9, 'errors_not-defined': 2 });
		const out = await w.get<any>('LessonStats');
		expect(out.errors.map((e: any) => e.key)).toEqual(['syntax', 'null-property', 'not-defined']);
	});

	it('reports how long students spend in the builder, in buckets', async () => {
		// Bucketed, never a raw duration: a precise per-session length is a
		// behavioural trace of one person, and the band answers the question just
		// as well while describing nobody.
		await send({ duration_15to30m: 1 });
		await send({ duration_15to30m: 1 });
		await send({ duration_gt60m: 1 });
		const out = await w.get<any>('LessonStats');
		expect(out.totals.duration_15to30m).toBe(2);
		expect(out.totals.duration_gt60m).toBe(1);
	});

	it('surfaces the health signals a blocked school network produces', async () => {
		await send({ fetch_ok: 3, fetch_failed: 7, storage_unavailable: 1 });
		const out = await w.get<any>('LessonStats');
		expect(out.health.fetchOk).toBe(3);
		expect(out.health.fetchFailed).toBe(7);
		expect(out.health.storageUnavailable).toBe(1);
	});

	it('returns one row per day with its own totals', async () => {
		await send({ runs_manual: 2 });
		const out = await w.get<any>('LessonStats');
		expect(out.days).toHaveLength(1);
		expect(out.days[0].day).toBe(out.today);
		expect(out.days[0].sessions).toBe(1);
		expect(out.days[0].counts.runs_manual).toBe(2);
	});

	it('holds no identifiers, free text or timestamps', async () => {
		// The contract, asserted rather than trusted. Everything stored is a name
		// from the allowlist and a number.
		await send({ runs_manual: 2, 'idea_meadow-roll-call': 1 });
		const out = await w.get<any>('LessonStats');
		for (const [key, value] of Object.entries(out.days[0].counts)) {
			expect(typeof value, `${key} should be a count`).toBe('number');
			expect(key).toMatch(/^[a-z0-9_-]+$/);
		}
	});
});
