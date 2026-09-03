import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// The Player highlights wall can be reordered — by playtime, animals returned,
// how recently someone played, and three more. The ordering rules live inside
// dashboard.html, which is a single self-contained page with no module boundary
// to import, so this file does what tests/unit/metrics-a11y.test.ts does: read
// the page as text, and where the logic is self-contained, lift it out and run
// it for real rather than only asserting that the source mentions it.
//
// Two things here are worth guarding specifically, because both fail silently —
// as a plausible-looking wall of cards, not as an error:
//
//   1. Unknown recency must rank LAST. It is represented as -Infinity, and the
//      obvious comparator (b - a) turns that into NaN, which makes the sort
//      incoherent and the result implementation-defined.
//   2. The superlative badges ("Most playtime", "Most active"…) must follow the
//      caretaker, not the card position. They were keyed by index into the
//      sorted array, which was correct only while exactly one sort existed.

const read = (p: string) => readFileSync(resolve(__dirname, '../../', p), 'utf8');
const DASHBOARD = read('public/dashboard.html');

/** The self-contained sort config + its two helpers, lifted out and evaluated. */
function loadSortModule() {
	const start = DASHBOARD.indexOf('const HL_SORTS = [');
	const end = DASHBOARD.indexOf('* Per-player modal');
	expect(start, 'HL_SORTS not found in dashboard.html').toBeGreaterThan(-1);
	expect(end, 'per-player modal marker not found').toBeGreaterThan(start);
	const src = DASHBOARD.slice(start, end);
	const body = src.slice(0, src.lastIndexOf('}') + 1);
	// `n` is the page's own number coercion, passed in rather than re-extracted.
	const n = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : Number(v) || 0);
	const make = new Function('n', `${body}\nreturn { HL_SORTS, hlSinceMinutes, fmtSince };`) as (nn: typeof n) => {
		HL_SORTS: { key: string; label: string; val: (p: any) => number }[];
		hlSinceMinutes: (p: any) => number;
		fmtSince: (m: number) => string;
	};
	return make(n);
}

const { HL_SORTS, hlSinceMinutes, fmtSince } = loadSortModule();

/** The comparator the render uses, mirrored so ordering can be exercised here. */
const n = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : Number(v) || 0);
const tiebreak = (a: any, b: any) =>
	n(b.playSeconds) - n(a.playSeconds) ||
	n(b.totalActions) - n(a.totalActions) ||
	n(b.achievements && b.achievements.points) - n(a.achievements && a.achievements.points);
const desc = (x: number, y: number) => (x === y ? 0 : x > y ? -1 : 1);
const orderBy = (key: string, rows: any[]) => {
	const cfg = HL_SORTS.find((o) => o.key === key)!;
	expect(cfg, `no sort named ${key}`).toBeTruthy();
	return [...rows].sort((a, b) => desc(cfg.val(a), cfg.val(b)) || tiebreak(a, b)).map((r) => r.id);
};

const HOUR = 3_600_000;
const ROWS = [
	// Long session, little else, played this morning.
	{
		id: 'marathon',
		playerId: 'p-marathon',
		playSeconds: 9000,
		totalActions: 10,
		biomeSummary: { totalAnimalsReturned: 2, biomesFullyRestored: 1 },
		achievements: { earned: 1, points: 5 },
		completion: { overallPct: 12, tracksDone: 1, tracksTotal: 10 },
		minutesSinceActive: 600,
	},
	// Short but dense: leads everything except playtime, and played minutes ago.
	{
		id: 'busy',
		playerId: 'p-busy',
		playSeconds: 600,
		totalActions: 900,
		biomeSummary: { totalAnimalsReturned: 40, biomesFullyRestored: 3 },
		achievements: { earned: 9, points: 90 },
		// Saves that predate the completion tally carry no block at all, which must
		// rank as 0 rather than as NaN — the rows below leave it off for that.
		completion: { overallPct: 61, tracksDone: 4, tracksTotal: 10 },
		minutesSinceActive: 3,
	},
	// Only the older hoursSinceActive field.
	{
		id: 'legacy-hours',
		playerId: 'p-legacy',
		playSeconds: 1200,
		totalActions: 50,
		biomeSummary: { totalAnimalsReturned: 7 },
		achievements: { earned: 0, points: 0 },
		hoursSinceActive: 2,
	},
	// Neither field — recency has to come off lastSeenAt.
	{
		id: 'timestamp-only',
		playerId: 'p-stamp',
		playSeconds: 800,
		totalActions: 5,
		biomeSummary: {},
		lastSeenAt: new Date(Date.now() - 24 * HOUR).toISOString(),
	},
	// No recency signal at all.
	{
		id: 'unknown',
		playerId: 'p-unknown',
		playSeconds: 700,
		totalActions: 4,
		biomeSummary: {},
	},
];

describe('player highlights sort', () => {
	it('offers every advertised sort, with playtime as the default', () => {
		expect(HL_SORTS.map((o) => o.key)).toEqual([
			'playtime',
			'animals',
			'recent',
			'actions',
			'achievements',
			'restored',
			'menus',
			'completion',
		]);
		for (const o of HL_SORTS) expect(o.label, `${o.key} has no label`).toBeTruthy();
		expect(DASHBOARD).toContain("const HL_SORT = { key: 'playtime' };");
	});

	it('ranks by the chosen field, highest first', () => {
		expect(orderBy('playtime', ROWS)[0]).toBe('marathon');
		expect(orderBy('animals', ROWS)[0]).toBe('busy');
		expect(orderBy('actions', ROWS)[0]).toBe('busy');
		expect(orderBy('achievements', ROWS)[0]).toBe('busy');
		expect(orderBy('restored', ROWS)[0]).toBe('busy');
		expect(orderBy('completion', ROWS)[0]).toBe('busy');
	});

	it('orders recency by smallest gap, across all three source fields', () => {
		// busy 3m · legacy-hours 2h · marathon 10h · timestamp-only 24h · unknown
		expect(orderBy('recent', ROWS)).toEqual(['busy', 'legacy-hours', 'marathon', 'timestamp-only', 'unknown']);
	});

	it('sinks caretakers with no recency signal instead of floating them to the top', () => {
		expect(hlSinceMinutes(ROWS[4])).toBe(Infinity);
		// Two unknowns must not make the comparator incoherent (Infinity - Infinity
		// is NaN); they tie and fall through to the playtime tiebreak.
		const twoBlanks = [
			{ id: 'blank-short', playSeconds: 400, totalActions: 1, biomeSummary: {} },
			{ id: 'blank-long', playSeconds: 4000, totalActions: 1, biomeSummary: {} },
			{ id: 'known', playSeconds: 100, totalActions: 1, biomeSummary: {}, minutesSinceActive: 30 },
		];
		expect(orderBy('recent', twoBlanks)).toEqual(['known', 'blank-long', 'blank-short']);
	});

	it('breaks ties deterministically rather than by arrival order', () => {
		const noAnimals = [
			{ id: 'low', playSeconds: 400, totalActions: 1, biomeSummary: {} },
			{ id: 'high', playSeconds: 4000, totalActions: 1, biomeSummary: {} },
			{ id: 'mid', playSeconds: 900, totalActions: 1, biomeSummary: {} },
		];
		expect(orderBy('animals', noAnimals)).toEqual(['high', 'mid', 'low']);
		expect(orderBy('animals', noAnimals.toReversed())).toEqual(['high', 'mid', 'low']);
	});

	it('reads recency in units a person would say out loud', () => {
		expect(fmtSince(0.4)).toBe('now');
		expect(fmtSince(45)).toBe('45m');
		expect(fmtSince(125)).toBe('2h');
		expect(fmtSince(4000)).toBe('3d');
		expect(fmtSince(Infinity)).toBe('—');
	});
});

describe('player highlights sort control', () => {
	it('renders a pill per sort and marks the active one', () => {
		expect(DASHBOARD).toContain('data-hlsort="${o.key}"');
		expect(DASHBOARD).toContain("class=\"dbtn${HL_SORT.key === o.key ? ' on' : ''}\"");
		expect(DASHBOARD).toContain('aria-label="Sort player highlights"');
		expect(DASHBOARD).toMatch(/aria-pressed="\$\{HL_SORT\.key === o\.key \? 'true' : 'false'\}"/);
	});

	it('reorders in place — no refetch, and no card is filtered out by sorting', () => {
		const handler = DASHBOARD.slice(DASHBOARD.indexOf(".closest('.dbtn[data-hlsort]')"));
		const body = handler.slice(0, handler.indexOf('});'));
		expect(body).toContain('rerender()');
		expect(body, 'sorting must not refetch the payload').not.toContain('load()');
	});

	it('names the active sort in the section subtitle', () => {
		expect(DASHBOARD).toContain('sorted by ${sortCfg.label.toLowerCase()}');
	});
});

describe('superlative badges', () => {
	it('follows the caretaker rather than the card position', () => {
		// The old implementation keyed badges by index into the sorted array, which
		// silently mislabels every card the moment the order can change.
		expect(DASHBOARD).toContain('const supTags = new Map();');
		expect(DASHBOARD).toContain('supTags.get(p)');
		expect(DASHBOARD).not.toMatch(/supTags\[\s*i\s*\]/);
	});

	it('still awards every superlative', () => {
		for (const label of ['Most playtime', 'Most active', 'Most achievements', 'Most restored', 'Most time in menus']) {
			expect(DASHBOARD, `${label} badge missing`).toContain(`'${label}'`);
		}
	});

	// Menu dwell arrived after this wall did, so most rows in hand predate it.
	// Sorting on a field that half the payload doesn't carry is exactly where a
	// comparator goes quietly incoherent, so the reader is pinned here.
	describe('time in menus', () => {
		const MENU_ROWS = [
			{ id: 'reader', playerId: 'p-r', playSeconds: 3000, menuTotalSeconds: 1200, menuMeasured: true },
			{ id: 'skimmer', playerId: 'p-s', playSeconds: 3000, menuTotalSeconds: 60, menuMeasured: true },
			// Older client: carries the per-menu map but not the total.
			{ id: 'map-only', playerId: 'p-m', playSeconds: 3000, menuSeconds: { journal: 300, goals: 100 } },
			// Predates the metric entirely.
			{ id: 'legacy', playerId: 'p-l', playSeconds: 3000 },
		];

		it('ranks by menu time, summing the map when the total is missing', () => {
			expect(orderBy('menus', MENU_ROWS)).toEqual(['reader', 'map-only', 'skimmer', 'legacy']);
		});

		it('treats a save that never reported menu time as zero, not as unknown-first', () => {
			expect(orderBy('menus', MENU_ROWS).at(-1)).toBe('legacy');
		});
	});
});
