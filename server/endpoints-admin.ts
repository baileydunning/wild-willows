// Wild Willows — server: endpoints-admin
//
// Operator-facing endpoints: ServerHealth, SystemProbe and DevTools.
//
// Split out of the single server/resources.ts; see that file for the whole map.

import { t as tr } from '../src/i18n/server';
import { buildStamp } from './pages';
import { SEASONS, WEATHER_TYPES, nextPhaseAt } from './weather';

import { BASE_HEALTH, GameError, db, hash32, seededRng } from './core';
import { byPlayer, placementKey } from './keys';
import { byArea, byWorld, defs, findBiomeState, recomputeStanding, worldOf } from './worlds';
import {
	DEFAULT_HOME,
	HOME_STYLES,
	HOME_TRACKS,
	START_INVENTORY,
	START_TOOLS,
	doorTileOf,
	homeOf,
	homeRoom,
} from './home';
import { STARTER_CHEST, isDevSave, patchPlayer, requirePlayer } from './player';
import { readMetrics, round1, weatherTimeFromPlay } from './metrics';
import {
	ALPINE_MTN_ROWS,
	areaGrid,
	nextMaturityFrom,
	recalcBiome,
	seedStartingTerrain,
	whyReturnedText,
} from './biome';
import { snapshot } from './tasks';
import { bodyOf } from './rate-limit';
import { DashboardEndpoint, PublicEndpoint, nodeBuffer } from './endpoints-game';
import { queryOne } from './endpoints-metrics';

// ---------------------------------------------------------------- system probe
// Harper records its own telemetry into two tables in the `system` database —
// hdb_analytics (aggregated once a minute) and hdb_raw_analytics (per second,
// per thread). If a component can read those in-process, the dashboard can show
// real server health (thread utilisation, database size, HTTP error rate) with
// no credentials stored anywhere and no call out to the operations API on :9925.
//
// Whether a component CAN read them is not documented either way, and the answer
// decides the whole design — so this endpoint finds out instead of guessing. It
// is a throwaway: once we know, it either turns into a real health endpoint or
// gets deleted. Every step is independently caught, so one failure still leaves a
// useful report rather than a stack trace.
//
//   curl -u HDB_ADMIN https://wild.willows.harperfabric.com/SystemProbe/

/** Read at most `max` records from a search, whatever the query did.
 *  The cap is enforced HERE, not in the query: if a condition is ignored or
 *  unsupported, an unbounded scan of a per-minute telemetry table would be
 *  enormous, and the point of a probe is to not take the server down. */
async function takeFrom(iterable: any, max: number): Promise<any[]> {
	const out: any[] = [];
	for await (const item of iterable) {
		if (item != null) out.push(item);
		if (out.length >= max) break;
	}
	return out;
}

/**
 * GET /ServerHealth/ — how the SERVER is doing, as opposed to the players.
 *
 * Reads Harper's own telemetry out of `system.hdb_analytics` in-process, which
 * SystemProbe confirmed a component can do. That is the whole reason this exists
 * in this shape: no super-user password stored in the app, no proxying the
 * operations API on :9925, no second credential to leak. Same DashboardEndpoint
 * gate as the metrics feeds, so the read-only role reaches it.
 *
 * ONE UNVERIFIED THING, stated because it decides whether this works for you: the
 * probe ran as HDB_ADMIN, so it proved a SUPER-USER can read the system database
 * from a component. Whether a `metrics_reader` request can do the same is NOT
 * established — Harper's super_user role carries explicit
 * `permission.system.tables.hdb_analytics.read`, and a role without it may be
 * refused. So the read is caught and reported as `readable: false` with the error
 * attached rather than thrown. If this reads fine as super-user and not as
 * metrics_reader, that IS the answer, and it says so on the page instead of
 * turning into a 500.
 *
 * Record shape: { id: [timeMs, nodeId], period, metric, path, method, type,
 * total, count, ratio, mean, median, p95, p99, time }. `id` is a COMPOSITE array,
 * so it is used for range filtering as a whole and the numeric timestamp is read
 * from `time` — never by coercing `id`, which yields NaN.
 */
const HEALTH_MAX_ROWS = 4000;

export class ServerHealth extends DashboardEndpoint {
	async get(target?: any) {
		const now = Date.now();
		// Default 60, not 15. The gauges (database-size, storage-volume,
		// main-thread-utilization) are emitted sparsely, so a 15-minute window
		// routinely landed between samples and reported them as absent.
		const mins = Math.min(Math.max(parseInt(queryOne(target, 'minutes'), 10) || 60, 1), 1440);
		const since = now - mins * 60_000;

		/* ?raw=<metric> dumps a few records verbatim.
		 *
		 * Everything above this line is an interpretation of these records, and the
		 * interpretations have been wrong twice — first about the metric names, then
		 * about the units. This exists so the next question is settled by looking
		 * rather than by another guess. Same auth gate as the rest. */
		const rawMetric = queryOne(target, 'raw');

		let rows: any[] = [];
		let readable = true;
		let readError: string | null = null;
		try {
			const t: any = (globalThis as any).databases?.system?.hdb_analytics;
			if (!t || typeof t.search !== 'function') {
				readable = false;
				readError = 'system.hdb_analytics is not visible to this component';
			} else {
				// Cap enforced in the loop, not trusted to the query: per-minute
				// telemetry across every metric and thread adds up fast.
				rows = await takeFrom(
					t.search({ conditions: [{ attribute: 'id', comparator: 'between', value: [since, now] }] }),
					HEALTH_MAX_ROWS,
				);
			}
		} catch (e: any) {
			readable = false;
			readError = String(e?.message || e);
		}

		/* Metric names are matched by SHAPE, not by an exact string.
		 *
		 * The first cut of this hard-coded 'main-thread-utilization', 'cpu-usage',
		 * 'database-size' and friends, and on the real instance every one of them
		 * missed: the response_* and duration metrics resolved, so the panel looked
		 * alive while thread utilization, CPU, database size and replication lag all
		 * rendered as em-dashes — the failure mode that looks exactly like a healthy
		 * idle server. Harper's names vary by version and casing, so normalize both
		 * sides to bare lowercase letters and match on that: mainThreadUtilization,
		 * main-thread-utilization and MAIN_THREAD_UTILIZATION all reduce to the same
		 * key. `metricsSeen` in the response lists whatever did NOT match, so an
		 * unrecognized name is visible on the page instead of silently absent. */
		const norm = (s: any) =>
			String(s || '')
				.toLowerCase()
				.replace(/[^a-z0-9]/g, '');
		const pick = (...names: string[]) => {
			const want = names.map(norm);
			return rows.filter((r) => want.includes(norm(r.metric)));
		};
		/* Which field carries the number also varies by metric — a gauge lands in
		 * `total`, a rate in `ratio`, a timing in `mean`. Take the first that is
		 * actually a number rather than assuming one. */
		// Bookkeeping, not measurements: numbers present on every record, none of
		// which is the thing the metric is actually reporting.
		const NON_VALUE = new Set(['time', 'period', 'id', 'nodeid', 'node', 'count', 'timestamp', 'starttime', 'endtime']);
		const valueOf = (r: any, prefer?: string) => {
			for (const f of [prefer, 'total', 'value', 'ratio', 'mean', 'median'].filter(Boolean) as string[]) {
				const n = Number(r?.[f]);
				if (Number.isFinite(n)) return n;
			}
			/* Last resort: the first numeric field that is not bookkeeping.
			 *
			 * Hard-coding the field list turned out to be the same mistake as
			 * hard-coding the metric names. database-size and main-thread-utilization
			 * both arrive on the live instance and both still rendered as em-dashes,
			 * because their number is not in `total`. A gauge whose value sits under a
			 * name nothing predicted is still a gauge, and reading it beats reporting
			 * nothing — with `allMetrics[].fields` publishing what was actually there,
			 * so this stays checkable rather than magic. */
			if (r && typeof r === 'object') {
				for (const [k, v] of Object.entries(r)) {
					if (NON_VALUE.has(k.toLowerCase())) continue;
					if (typeof v !== 'number' || !Number.isFinite(v)) continue;
					return v;
				}
			}
			return null;
		};
		/* Every numeric leaf on a record, one level into nested objects, as dotted
		 * paths. This is the diagnostic that ends the guessing: when a gauge reads
		 * em-dash, this says what its records actually carry. */
		const numericFields = (r: any, depth = 0): string[] => {
			if (!r || typeof r !== 'object') return [];
			const out: string[] = [];
			for (const [k, v] of Object.entries(r)) {
				if (k === 'id' || k === 'metric' || k === 'path' || k === 'method' || k === 'type') continue;
				if (v && typeof v === 'object' && !Array.isArray(v) && depth < 1) {
					for (const sub of numericFields(v, depth + 1)) out.push(`${k}.${sub}`);
				} else if (typeof v === 'number' && Number.isFinite(v)) out.push(k);
			}
			return out;
		};
		// Harper writes one row per metric per minute per thread, so a point reading
		// and a window average answer different questions — a utilization spike and a
		// sustained ceiling are not the same problem and shouldn't collapse together.
		/* When a record was written.
		 *
		 * NOT simply `r.time`. The primary key is a composite [timeMs, nodeId], and
		 * on the live instance `time` is frequently absent — so `Number(r.time) || 0`
		 * silently became 0 for every row. Everything built on "the newest sample"
		 * then broke in ways that looked like data rather than like a bug: latestOf
		 * returned the FIRST row it scanned instead of the newest, and grouping by
		 * newest timestamp matched all 80 records in the window at once, which is how
		 * a 4MB database was reported as "17.66GB across 80 databases". Read the
		 * composite id when the field is missing. */
		const timeOf = (r: any): number => {
			const t = Number(r?.time);
			if (Number.isFinite(t) && t > 0) return t;
			const id = r?.id;
			if (Array.isArray(id)) {
				const t0 = Number(id[0]);
				if (Number.isFinite(t0) && t0 > 0) return t0;
			}
			return 0;
		};
		/* Every record sharing the newest timestamp for a metric. Metrics that are
		 * emitted per-database (or per-thread) produce several records an interval,
		 * and picking one of them is arbitrary in a way that is invisible on screen. */
		const latestGroup = (...names: string[]) => {
			const rs = pick(...names);
			if (!rs.length) return [];
			const newest = rs.reduce((m, r) => Math.max(m, timeOf(r)), 0);
			// A metric with no usable timestamp anywhere: one record is all that can
			// honestly be claimed, rather than the whole window summed together.
			if (!newest) return rs.slice(-1);
			return rs.filter((r) => timeOf(r) === newest);
		};
		const latestSum = (...names: string[]) => {
			const vs = latestGroup(...names)
				.map((r) => valueOf(r))
				.filter((v): v is number => v != null);
			return vs.length ? vs.reduce((a, b) => a + b, 0) : null;
		};
		const latestParts = (...names: string[]) => latestGroup(...names).length || null;
		const latestOf = (...names: string[]) => {
			let best: any = null;
			for (const r of pick(...names)) if (!best || timeOf(r) > timeOf(best)) best = r;
			return best;
		};
		// Raw, deliberately unrounded. Rounding here destroyed ratio metrics before
		// they could be converted: round1(0.75) is 0.7, so a 75% window average came
		// out as 70%. Each call site rounds in the unit it is actually reporting.
		const avgOfField = (field: string | undefined, names: string[]) => {
			const xs = pick(...names)
				.map((r) => valueOf(r, field))
				.filter((n): n is number => n != null);
			return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
		};
		const avgOf = (...names: string[]) => avgOfField(undefined, names);
		const sumOf = (...names: string[]) => pick(...names).reduce((a, r) => a + (valueOf(r) || 0), 0);

		// HTTP outcomes arrive as one metric per status (response_200, response_404,
		// response_409…). Counting by prefix means a status this code has never seen
		// still lands somewhere instead of being dropped.
		const byStatus: Record<string, number> = {};
		for (const r of rows) {
			const m = String(r.metric || '');
			if (!m.startsWith('response_')) continue;
			const code = m.slice('response_'.length);
			byStatus[code] = (byStatus[code] || 0) + (Number(r.count) || 0);
		}
		const totalResponses = Object.values(byStatus).reduce((a, b) => a + b, 0);
		const serverErrors = Object.entries(byStatus)
			.filter(([code]) => code.startsWith('5'))
			.reduce((a, [, n]) => a + n, 0);

		/* Slowest paths — GROUPED by path+method across the window.
		 *
		 * These used to be listed raw, one line per analytics record, which on the
		 * real instance meant ten lines of `Metrics GET` each with count 1 and p95
		 * equal to median: a list of the ten slowest individual REQUESTS wearing the
		 * heading "slowest endpoints, by p95". A p95 over one sample is just that
		 * sample. Group first, then report.
		 *
		 * Harper writes these per period, so a row's `count` may be 1 (a single
		 * request) or many (a pre-aggregated period). Both are handled: counts sum,
		 * and the typical figure is weighted by count so a busy period is not given
		 * the same say as a lone slow request. A true window p95 cannot be recovered
		 * from per-period summaries, so the tail is reported as the worst p95 seen
		 * and named `worstMs` rather than dressed up as a percentile it is not. */
		/* Infrastructure traffic is not players, and mixing them makes both numbers
		 * lie. `status` is Harper Fabric's load-balancer probe — @harperdb/status-check,
		 * installed by the platform, not by this app — and on a two-node instance it
		 * runs often enough to dominate the request count. Harper's own operations
		 * (get_usage_licenses and friends) arrive as snake_case names with no HTTP
		 * method, which is what separates them from this app's PascalCase resources.
		 * Neither belongs in "slowest endpoints" or in the denominator of an error
		 * rate that is supposed to describe what players experienced. */
		const PROBE_PATHS = new Set(['status', 'getstatus', 'health', 'healthz', 'healthcheck', 'ping']);
		/* Two different things, kept apart because they mean different things.
		 *
		 * A PROBE is automatic and constant — the platform asking "is this node up"
		 * every few seconds forever. An OPERATION is a person: opening the Harper
		 * console lists your users, describes your tables and reads your components,
		 * and alter_user is somebody changing a password. Calling both "the health
		 * probe" was wrong, and it mattered — a spike in operations is you, and a
		 * spike in probes is the platform deciding something is unwell. */
		/* This dashboard's own endpoints. Listed explicitly rather than pattern-
		 * matched, because the line is about WHO CALLS them, not what they are
		 * named: /Metrics/ looks like tooling and is not — the game client fetches
		 * it on every uplink — while /MetricsSummary/ and /MetricsPlayers/ are only
		 * ever reached by this page. Getting that backwards would move real player
		 * traffic into the tooling bucket and quietly shrink the numbers that
		 * matter. Anything not named here is gameplay. */
		const DASHBOARD_PATHS = new Set(
			[
				'MetricsSummary',
				'MetricsPlayers',
				'GameplayHealth',
				'SaveHealth',
				'ServerHealth',
				'LandingStats',
				'ClearProblem',
				'DashboardAuth',
				'DashboardPage',
				'dashboard',
				'ListFeedback',
				'SystemProbe',
			].map(norm),
		);
		const classify = (path: any, method: any): 'gameplay' | 'dashboard' | 'probe' | 'operation' => {
			const p = String(path || '');
			if (PROBE_PATHS.has(norm(p))) return 'probe';
			// A Harper operation: no HTTP method and a snake_case/lowercase name.
			// This app's resources are PascalCase and always arrive with a method.
			if (!method && /^[a-z][a-z0-9_]*$/.test(p)) return 'operation';
			return DASHBOARD_PATHS.has(norm(p)) ? 'dashboard' : 'gameplay';
		};

		let appCalls = 0;
		let dashCalls = 0;
		let probeCalls = 0;
		let opCalls = 0;
		const probesSeen = new Set<string>();
		const opsSeen = new Set<string>();
		const groups = new Map<
			string,
			{ kind: string; path: string; method: string | null; calls: number; worst: number; wsum: number; wn: number }
		>();
		for (const r of pick('duration', 'transfer', 'request')) {
			if (!r.path) continue;
			const calls0 = Math.max(1, Number(r.count) || 0);
			const kind = classify(r.path, r.method);
			if (kind === 'probe') {
				probeCalls += calls0;
				probesSeen.add(String(r.path));
				continue;
			}
			if (kind === 'operation') {
				opCalls += calls0;
				opsSeen.add(String(r.path));
				continue;
			}
			if (kind === 'dashboard') dashCalls += calls0;
			else appCalls += calls0;
			const method = r.method ? String(r.method) : null;
			const key = `${kind}\u0000${r.path}\u0000${method || ''}`;
			let g = groups.get(key);
			if (!g) groups.set(key, (g = { kind, path: String(r.path), method, calls: 0, worst: 0, wsum: 0, wn: 0 }));
			const calls = Math.max(1, Number(r.count) || 0);
			const tail = Number(r.p95);
			const mid = Number(r.median);
			const typical = Number.isFinite(mid) ? mid : Number(r.mean);
			g.calls += calls;
			if (Number.isFinite(tail)) g.worst = Math.max(g.worst, tail);
			else if (Number.isFinite(typical)) g.worst = Math.max(g.worst, typical);
			if (Number.isFinite(typical)) {
				g.wsum += typical * calls;
				g.wn += calls;
			}
		}
		const rank = (g: any) => ({
			kind: g.kind,
			path: g.path,
			method: g.method,
			// Worst single p95 observed in the window, not a window percentile.
			worstMs: round1(g.worst),
			// Count-weighted typical response, so volume carries the weight.
			typicalMs: g.wn ? round1(g.wsum / g.wn) : null,
			calls: g.calls,
		});
		const byWorst = (a: any, b: any) => b.worstMs - a.worstMs;
		// Two lists, because they answer different questions: one is what players
		// wait for, the other is what this page costs to look at.
		const slowest = [...groups.values()]
			.filter((g) => g.kind === 'gameplay')
			.map(rank)
			.sort(byWorst)
			.slice(0, 10);
		const slowestDashboard = [...groups.values()]
			.filter((g) => g.kind === 'dashboard')
			.map(rank)
			.sort(byWorst)
			.slice(0, 10);

		const util = latestOf('main-thread-utilization', 'mainThreadUtilization', 'thread-utilization', 'utilization');
		// Utilization arrives as a 0-1 ratio from some sources and an already-scaled
		// percent from others (cpu-usage reads 23, thread utilization reads 0.85).
		// round1 on a ratio is destructive — 0.853 becomes 0.9, which is the
		// difference between "comfortable" and "at the ceiling" — so normalize to a
		// percent first and keep one decimal of real precision.
		const asPct = (v: any): number | null => {
			// null must survive as null. Number(null) is 0 and 0 is finite, so the
			// obvious guard let a metric that was never found render as a confident
			// "0%" — a missing gauge and an idle server displayed identically, which
			// is exactly how this panel shipped looking healthy while reading nothing.
			if (v == null || v === '') return null;
			const n = Number(v);
			if (!Number.isFinite(n) || n < 0) return null;
			/* Anything above 100 is not a percentage.
			 *
			 * The old rule was "<= 1 means a ratio, otherwise it is already a
			 * percent", which held for cpu-usage and then met main-thread-utilization
			 * reporting 89,876 — rendered, with total confidence, as "89876%". Some
			 * unit is being used here that this code does not know (microseconds of
			 * busy time, most likely), and the correct response to an unrecognized
			 * unit is to decline rather than to print it with a % sign on the end.
			 * The raw value is published on the metric so it stays diagnosable. */
			if (n > 100) return null;
			return round1(n <= 1 ? n * 100 : n);
		};

		if (rawMetric) {
			const want = norm(rawMetric);
			// Newest first — when you are chasing a unit, the most recent record is
			// the one you want at the top rather than wherever the scan happened to
			// put it.
			const sample = rows
				.filter((r) => norm(r.metric) === want)
				.sort((a, b) => timeOf(b) - timeOf(a))
				.slice(0, 12);
			return {
				generatedAt: now,
				windowMinutes: mins,
				readable,
				readError,
				raw: rawMetric,
				matched: sample.length,
				// Verbatim, so units and per-record breakdowns are visible as they are.
				records: sample,
			};
		}

		const REPL_LATENCY = ['replication-latency', 'replicationLatency', 'replication-lag', 'replicationLag'];
		const seen = [...new Set(rows.map((r) => String(r.metric)))].sort();
		// Anything this endpoint consumed, so the leftovers can be named.
		const matched = new Set(
			[
				'main-thread-utilization',
				'mainThreadUtilization',
				'thread-utilization',
				'utilization',
				'cpu-usage',
				'cpuUsage',
				'cpu',
				'process-cpu',
				'cpu-utilization',
				'memory',
				'memory-usage',
				'memoryUsage',
				'heap-used',
				'rss',
				'database-size',
				'databaseSize',
				'db-size',
				'storage-size',
				'storage-volume',
				'storageVolume',
				'volume-size',
				'disk-size',
				'disk-total',
				'node-storage',
				'nodeStorage',
				'duration',
				'transfer',
				'request',
				'bytes-sent',
				'bytesSent',
				'egress',
				'transfer-out',
				'bytes-received',
				'bytesReceived',
				'ingress',
				'transfer-in',
				...REPL_LATENCY,
			].map(norm),
		);
		for (const m of seen) if (norm(m).startsWith('response')) matched.add(norm(m));

		return {
			generatedAt: now,
			windowMinutes: mins,
			readable,
			readError,
			samples: rows.length,
			cappedAtMaxRows: rows.length >= HEALTH_MAX_ROWS,
			// The capacity ceiling. This app is served by a small number of threads,
			// so sustained utilization is the thing that runs out before anything else.
			threads: {
				utilizationPct: util ? asPct(valueOf(util)) : null,
				/* What the metric actually said, and whether it could be read as a
				 * percentage at all. A gauge that is present but unintelligible is a
				 * different fact from a gauge that is missing, and the panel says which
				 * instead of showing the same em-dash for both. */
				utilizationRaw: util ? valueOf(util) : null,
				utilizationUnitKnown: util ? asPct(valueOf(util)) != null : null,
				windowAvgPct: asPct(
					avgOf('main-thread-utilization', 'mainThreadUtilization', 'thread-utilization', 'utilization'),
				),
				cpuPct: asPct(avgOf('cpu-usage', 'cpuUsage', 'cpu', 'process-cpu', 'cpu-utilization')),
				/* `memory` reports 33 with a max of 84 on the live instance — that is a
				 * percentage, not a byte count, and calling the field memoryBytes was
				 * wrong even though nothing rendered it. Report it as what it is, and
				 * only when it is in a range a percentage can occupy. */
				memoryPct: asPct(valueOf(latestOf('memory', 'memory-usage', 'memoryUsage'))),
			},
			storage: {
				/* Sum the newest sample, not one of them.
				 *
				 * database-size arrives once per DATABASE per interval, so latestOf
				 * returned whichever record happened to land last — 4MB on an instance
				 * whose records range to 437MB, displayed as "0.00GB". Taking every
				 * record sharing the newest timestamp gives the total across
				 * databases, which is what "database size" means on a tile. */
				databaseBytes: latestSum('database-size', 'databaseSize', 'db-size', 'storage-size'),
				databaseParts: latestParts('database-size', 'databaseSize', 'db-size', 'storage-size'),
				volumeBytes: valueOf(latestOf('storage-volume', 'storageVolume', 'volume-size', 'disk-size', 'disk-total')),
				nodeStorageBytes: valueOf(latestOf('node-storage', 'nodeStorage')),
			},
			http: (() => {
				/* The 5xx rate should describe what PLAYERS hit, but the response_*
				 * counters carry no path — they are global per status — so 5xx cannot
				 * be attributed to a route directly. The duration records DO carry
				 * paths, which gives an exact infrastructure request count.
				 *
				 * Subtracting one from the other is only sound if the two families are
				 * counting the same events. They are checked against each other rather
				 * than assumed: if the totals do not reconcile within 5%, the app-only
				 * rate is NOT reported, because scaling a denominator by a ratio that
				 * does not hold is a guess wearing a percentage sign. `basis` says
				 * which of the two you are looking at, every time. */
				// The dashboard's own traffic is not player traffic either. Counting it
				// as such put six requests per page view into the denominator of a
				// rate that is supposed to describe the game.
				const infraCalls = probeCalls + opCalls + dashCalls;
				const totalCalls = appCalls + infraCalls;
				const reconciles =
					totalResponses > 0 && totalCalls > 0 && Math.abs(totalCalls - totalResponses) / totalResponses <= 0.05;
				const appResponses = reconciles ? Math.max(0, totalResponses - infraCalls) : null;
				const basis = appResponses && appResponses > 0 ? 'app' : 'all';
				const denom = basis === 'app' ? (appResponses as number) : totalResponses;
				return {
					responses: totalResponses,
					byStatus,
					serverErrors,
					// Over player traffic where that is defensible, over everything where
					// it is not — and `errorRateBasis` always says which.
					errorRatePct: denom ? round1((serverErrors / denom) * 100) : 0,
					errorRateBasis: basis,
					errorRateOf: denom,
					requests: {
						app: appCalls,
						gameplay: appCalls,
						// This page looking at itself.
						dashboard: dashCalls,
						// The platform asking whether this node is alive.
						probes: probeCalls,
						probePaths: [...probesSeen].sort(),
						// A human in the Harper console, or a tool acting like one.
						operations: opCalls,
						operationPaths: [...opsSeen].sort(),
						infrastructure: infraCalls,
						infrastructurePaths: [...probesSeen, ...opsSeen].sort(),
						// Whether the request records and the response counters agree. When
						// they don't, something is being counted by one and not the other,
						// and that is worth seeing rather than smoothing over.
						reconcilesWithResponses: reconciles,
					},
					slowest,
					slowestDashboard,
					/* How long gameplay actually takes, as a headline rather than
					 * something to be reconstructed from the table below. The 5xx rate
					 * only reports requests that FAILED; a server that answers every
					 * call successfully in two seconds has a perfect error rate and a
					 * game nobody wants to play. Count-weighted so the endpoints players
					 * hit constantly carry the number, and the worst path is named
					 * because "worst 1.4s" without a name is not actionable. */
					gameplayTiming: (() => {
						const gs = [...groups.values()].filter((g) => g.kind === 'gameplay');
						if (!gs.length) return null;
						const calls = gs.reduce((a, g) => a + g.calls, 0);
						const wsum = gs.reduce((a, g) => a + g.wsum, 0);
						const wn = gs.reduce((a, g) => a + g.wn, 0);
						const worstG = gs.reduce((m, g) => (g.worst > (m?.worst ?? -1) ? g : m), null as any);
						return {
							calls,
							typicalMs: wn ? round1(wsum / wn) : null,
							worstMs: worstG ? round1(worstG.worst) : null,
							worstPath: worstG ? worstG.path : null,
							worstMethod: worstG ? worstG.method : null,
							// How many distinct gameplay routes were exercised at all.
							paths: gs.length,
						};
					})(),
				};
			})(),
			// Two nodes replicate behind this, so latency between them is what says
			// whether they are actually keeping up with each other.
			replication: {
				latencyMs: (() => {
					const v = avgOfField('mean', REPL_LATENCY) ?? avgOf(...REPL_LATENCY);
					return v == null ? null : round1(v);
				})(),
				samples: pick(...REPL_LATENCY).length,
				bytesSent: sumOf('bytes-sent', 'bytesSent', 'egress', 'transfer-out'),
				bytesReceived: sumOf('bytes-received', 'bytesReceived', 'ingress', 'transfer-in'),
			},
			/* Every metric name that arrived, and which of them this endpoint knows
			 * what to do with. `unmatched` is the important one: it is the list that
			 * would have told me the gauges were reading the wrong names, instead of
			 * five em-dashes that look exactly like an idle server. It is rendered on
			 * the page, so the panel diagnoses itself next time. */
			metricsSeen: seen,
			metricsUnmatched: seen.filter((m) => !matched.has(norm(m))),
			/* Every metric in the window, aggregated the same way regardless of what
			 * it is. The named gauges above are an opinionated reading of a handful
			 * of these; this is the rest of the telemetry without an opinion, so a
			 * metric this endpoint has never heard of is still legible instead of
			 * being a name in an apology at the bottom of the page. */
			allMetrics: seen
				.map((name) => {
					const rs = pick(name);
					const vals = rs.map((r) => valueOf(r)).filter((v): v is number => v != null);
					let latest: any = null;
					for (const r of rs) if (!latest || timeOf(r) > timeOf(latest)) latest = r;
					const sum = vals.reduce((a, b) => a + b, 0);
					return {
						metric: name,
						samples: rs.length,
						// Counters are worth summing, gauges are worth reading latest. Both
						// are given rather than guessing which kind this metric is.
						latest: latest ? valueOf(latest) : null,
						total: vals.length ? round1(sum) : null,
						mean: vals.length ? round1(sum / vals.length) : null,
						min: vals.length ? round1(Math.min(...vals)) : null,
						max: vals.length ? round1(Math.max(...vals)) : null,
						// A metric with paths is per-route; one without is instance-wide.
						paths: [
							...new Set(
								rs
									.map((r) => r.path)
									.filter(Boolean)
									.map(String),
							),
						].length,
						read: matched.has(norm(name)),
						// Where this metric's numbers actually live. When a gauge above
						// shows an em-dash, this is the field list that explains why.
						fields: [...new Set(rs.flatMap((r) => numericFields(r)))].sort(),
					};
				})
				.sort((a, b) => b.samples - a.samples),
		};
	}
}

export class SystemProbe extends Resource {
	async get() {
		const now = Date.now();
		const steps: any[] = [];
		const step = async (name: string, fn: () => Promise<any>) => {
			try {
				steps.push({ step: name, ok: true, ...((await fn()) || {}) });
			} catch (e: any) {
				steps.push({ step: name, ok: false, error: String(e?.message || e) });
			}
		};

		const dbs: any = (globalThis as any).databases;

		await step('databases global', async () => ({
			present: !!dbs,
			names: dbs ? Object.keys(dbs) : [],
		}));

		await step('system database', async () => {
			const sys = dbs?.system;
			return { present: !!sys, tables: sys ? Object.keys(sys) : [] };
		});

		// The two tables we actually care about, and what they look like.
		for (const tableName of ['hdb_analytics', 'hdb_raw_analytics']) {
			await step(`${tableName} · shape`, async () => {
				const t = dbs?.system?.[tableName];
				if (!t) return { present: false };
				return {
					present: true,
					hasSearch: typeof t.search === 'function',
					hasGet: typeof t.get === 'function',
				};
			});
		}

		// Try to actually read the last hour. Several condition shapes, because the
		// in-process search API and the operations API do not obviously take the
		// same one — whichever returns rows is the answer.
		const since = now - 3_600_000;
		const shapes: Array<{ label: string; query: any }> = [
			{
				label: 'between [since, now]',
				query: { conditions: [{ attribute: 'id', comparator: 'between', value: [since, now] }] },
			},
			{
				label: 'greater_than since',
				query: { conditions: [{ attribute: 'id', comparator: 'greater_than', value: since }] },
			},
			{ label: 'gt since', query: { conditions: [{ attribute: 'id', comparator: 'gt', value: since }] } },
			{ label: 'no conditions, limit 50', query: { limit: 50 } },
		];
		for (const shape of shapes) {
			await step(`hdb_analytics · ${shape.label}`, async () => {
				const t = dbs?.system?.hdb_analytics;
				if (!t || typeof t.search !== 'function') return { skipped: 'table not readable' };
				const rows = await takeFrom(t.search(shape.query), 200);
				// Report the SHAPE of what came back, not the rows themselves — this is
				// reconnaissance, and a telemetry dump is not something to page through.
				const metrics: Record<string, number> = {};
				const types: Record<string, number> = {};
				let oldest = 0;
				let newest = 0;
				for (const r of rows) {
					const m = String(r?.metric || '?');
					metrics[m] = (metrics[m] || 0) + 1;
					const ty = String(r?.type || '?');
					types[ty] = (types[ty] || 0) + 1;
					const id = Number(r?.id) || 0;
					if (id && (!oldest || id < oldest)) oldest = id;
					if (id > newest) newest = id;
				}
				return {
					returned: rows.length,
					cappedAt200: rows.length >= 200,
					metrics,
					types,
					oldest: oldest ? new Date(oldest).toISOString() : null,
					newest: newest ? new Date(newest).toISOString() : null,
					sampleKeys: rows[0] ? Object.keys(rows[0]) : [],
					sample: rows[0] || null,
				};
			});
		}

		// Replication, specifically. There are two nodes behind this, so
		// replication-latency / bytes-sent / bytes-received are the metrics that
		// actually matter — a Problems page for a two-node setup that cannot say
		// whether the nodes are in sync is missing its main job.
		await step('hdb_analytics · replication metrics', async () => {
			const t = dbs?.system?.hdb_analytics;
			if (!t || typeof t.search !== 'function') return { skipped: 'table not readable' };
			const rows = await takeFrom(
				t.search({ conditions: [{ attribute: 'id', comparator: 'between', value: [now - 3_600_000, now] }] }),
				500,
			);
			const wanted = new Set(['replication-latency', 'bytes-sent', 'bytes-received']);
			const hits = rows.filter((r: any) => wanted.has(String(r?.metric)));
			return {
				scanned: rows.length,
				replicationRows: hits.length,
				byMetric: hits.reduce((acc: Record<string, number>, r: any) => {
					acc[r.metric] = (acc[r.metric] || 0) + 1;
					return acc;
				}, {}),
				sample: hits[0] || null,
			};
		});

		// `server` carries cluster information per the component docs. With two nodes
		// replicating, whatever is on here may answer "are both nodes up and caught
		// up" without touching the operations API at all.
		await step('server global', async () => {
			const s: any = (globalThis as any).server;
			if (!s) return { present: false };
			const keys = Object.keys(s);
			// Anything that looks like it knows about the other node.
			const clusterish = keys.filter((k) => /cluster|repl|node|peer|leader|member/i.test(k));
			const detail: Record<string, any> = {};
			for (const k of clusterish) {
				try {
					const v = s[k];
					detail[k] =
						typeof v === 'function' ? 'function' : v && typeof v === 'object' ? Object.keys(v).slice(0, 20) : v;
				} catch (e: any) {
					detail[k] = `threw: ${e?.message || e}`;
				}
			}
			return { present: true, keys: keys.slice(0, 40), clusterish, detail };
		});

		// Node skew, checked the way deploy.sh already checks it: ask both
		// public entry points what build they are serving. This needs no credentials
		// and no operations API — GET /Version/ is public and already exists — and a
		// mismatch is exactly what deploy.sh calls "a stale component or broken
		// replication". Done server-side so there is no cross-origin problem, with a
		// short timeout so a wedged peer cannot hang this request.
		await step('node build skew', async () => {
			const peers = ['https://wild.willows.harperfabric.com', 'https://wild.willows.harperfabric.com:9926'];
			const results = await Promise.all(
				peers.map(async (base) => {
					try {
						const res = await fetch(`${base}/Version/`, {
							headers: { accept: 'application/json' },
							signal: AbortSignal.timeout(3000),
						});
						if (!res.ok) return { node: base, ok: false, status: res.status };
						const body: any = await res.json();
						return { node: base, ok: true, build: body?.build || null };
					} catch (e: any) {
						return { node: base, ok: false, error: String(e?.message || e) };
					}
				}),
			);
			const builds = [...new Set(results.filter((r: any) => r.ok).map((r: any) => r.build))];
			return {
				expected: buildStamp,
				results,
				inSync: builds.length === 1 && builds[0] === buildStamp,
				distinctBuilds: builds.length,
			};
		});

		// The authenticated user, as Harper hands it to an endpoint.
		//
		// This decides how role-based access gets written. `allowRead(user)` is the
		// hook, but the shape of `user` is not documented, and auth code written
		// against a guessed shape fails in exactly two ways: it denies everybody, or
		// it lets everybody in. Neither is discoverable by reading the code. So read
		// the real object off the real server first.
		//
		// Values are described, never echoed — this response is a diagnostic, and a
		// diagnostic that prints password hashes is a new vulnerability.
		await step('authenticated user shape', async () => {
			const ctx: any = (this as any).getContext?.();
			const user: any = ctx?.user;
			if (!user) return { present: false, contextKeys: ctx ? Object.keys(ctx).slice(0, 30) : [] };
			const describe = (v: any): any => {
				if (v === null) return 'null';
				if (Array.isArray(v))
					return `array[${v.length}]${v.length && typeof v[0] === 'string' ? ': ' + v.slice(0, 8).join(',') : ''}`;
				if (typeof v === 'object')
					return Object.fromEntries(
						Object.entries(v)
							.slice(0, 12)
							.map(([k, x]) => [k, describe(x)]),
					);
				if (typeof v === 'string') {
					// Names and role labels are the whole point of this probe; anything
					// that smells like a secret is reported as present, not printed.
					return /pass|hash|salt|secret|token|key/i.test(v) ? `string(${v.length})` : v;
				}
				return typeof v;
			};
			const safe: Record<string, any> = {};
			for (const [k, v] of Object.entries(user)) {
				safe[k] = /pass|hash|salt|secret|token|key/i.test(k) ? `«redacted ${typeof v}»` : describe(v);
			}
			return {
				present: true,
				keys: Object.keys(user),
				shape: safe,
				// The two candidate paths for a role check, resolved against reality.
				'user.role': describe(user.role),
				'user.role?.role': typeof user.role === 'object' ? describe((user.role as any)?.role) : undefined,
			};
		});

		await step('logger global', async () => {
			const l: any = (globalThis as any).logger;
			return { present: !!l, methods: l ? Object.keys(l).slice(0, 20) : [] };
		});

		return {
			checkedAt: now,
			note: 'Throwaway reconnaissance for the Problems page — delete once the answer is known.',
			verdict: steps.find((s) => s.step?.startsWith('hdb_analytics ·') && s.returned > 0)
				? 'hdb_analytics IS readable in-process — the dashboard can show real server health with no stored credentials.'
				: dbs?.system
					? 'system database is visible but no analytics rows came back — check the condition shapes above.'
					: 'system database is NOT visible to this component — server health would need the operations API on :9925.',
			steps,
		};
	}
}

/** Cursor codec. Base64url of the row's playerId — opaque to callers, and it
 *  carries no data a caller could not already read off the row it came from. */
export function encodeMetricsCursor(playerId: string): string {
	return nodeBuffer.from(String(playerId), 'utf8').toString('base64url');
}
export function decodeMetricsCursor(cursor: string): string | null {
	try {
		const out = nodeBuffer.from(String(cursor), 'base64url').toString('utf8');
		return out || null;
	} catch {
		return null;
	}
}

/**
 * The `?fields=list` shape — enough to draw a table row or a caretaker card and
 * nothing else, for callers that don't need the full record. The dashboard does
 * not use this (it wants everything, so its existing rendering keeps working
 * untouched); it exists so a future list view doesn't have to pull 1.6 KB a head.
 */
export function metricsListRow(r: any) {
	return {
		playerId: r.playerId,
		name: r.name,
		edition: r.edition || 'full',
		platform: r.platform,
		os: r.os,
		version: r.version,
		language: r.language,
		status: r.status,
		idle: r.idle,
		createdAt: r.createdAt,
		lastSeenAt: r.lastSeenAt,
		playSeconds: r.playSeconds,
		sessions: r.sessions,
		totalActions: r.totalActions,
		unlockedBiomes: r.unlockedBiomes,
		tutorialStep: r.tutorialStep,
		achievementsEarned: r.achievements?.earned ?? null,
		avgHealth: r.biomeSummary?.avgHealth ?? null,
		appearance: r.appearance,
	};
}

/**
 * POST /DevTools/ {playerId, action, ...args} — testing helpers for development.
 * Not part of normal play; the client only exposes these behind a hidden dev panel.
 * Actions: 'seed-water' (reseed an area's starting terrain), 'clear-terrain',
 * 'grant-resources', 'max-tools', 'unlock-all', 'set-health', 'reset-biome'
 * (wipe the area back to its damaged state, keeping chests), 'lock-biome'
 * (re-lock the area to retest the unlock flow), 'unlock-recipes' (toggle all
 * recipes craftable), 'welcome-animals' (force every animal in the area back),
 * 'populate-biome' (build a fully-restored showcase biome for screenshots/video),
 * 'set-weather' (force weather/season for filming; value {type?,season?} or clear).
 */
export class DevTools extends PublicEndpoint {
	static rateTier = 'dev'; // developer tools
	async post(data: any) {
		const { playerId, action, area, amount, value, resources, animalId, seed } = await bodyOf(data, this);
		const t = db();
		const d = await defs();
		const { player } = await requirePlayer(playerId);
		// The gate (isDevSave / DEV_PLAYER_SLUG in server/player.ts). Checked after
		// requirePlayer so an unknown id still reads as 404 rather than telling a
		// caller which ids exist, and BEFORE the switch so no action can write
		// anything on a save that isn't a test save.
		//
		// The refusal does not say what WOULD qualify. A player who never sees the
		// panel (the client hides it unless `player.devTools` is set) should not be
		// handed the name that opens it by the one message that can still reach
		// them — a scripted caller included.
		if (!isDevSave(player))
			throw new GameError(tr('server.err.devToolsRestricted'), 403, 'server.err.devToolsRestricted');
		const log: string[] = [];

		switch (action) {
			case 'set-time': {
				// Jump the in-game clock forward to the start of a chosen phase, so the
				// HUD clock, weather, and world lighting all reflect it. `value` is the
				// phase id (dawn/day/dusk/night).
				const phase = String(value || 'dawn');
				const nowT = weatherTimeFromPlay(player);
				const skip = nextPhaseAt(nowT, phase) - nowT;
				await patchPlayer(playerId, { clockOffsetMs: (player.clockOffsetMs || 0) + skip });
				log.push(`Set time to ${phase}`);
				break;
			}
			case 'reset-clock': {
				// Restart the game clock at day one's morning — the same starting time a
				// fresh save gets. Solve for the offset that lands the current play time
				// back on the day-phase start (season resets to the first day too).
				const playMs = Math.round((readMetrics(player)?.playSeconds || 0) * 1000);
				await patchPlayer(playerId, { clockOffsetMs: nextPhaseAt(0, 'day') - playMs });
				log.push('Reset the game clock to the first morning');
				break;
			}
			case 'seed-water': {
				// reset the area's terrain and lay down its starting layout again
				const ar = area || 'wetland';
				for (const tt of (await byPlayer(t.TerrainTile, playerId)).filter((x) => x.area === ar)) {
					await t.TerrainTile.delete(tt.id);
				}
				await seedStartingTerrain(playerId, playerId, ar);
				await recalcBiome(playerId, playerId, ar, { player, fresh: true });
				log.push(`Reseeded starting terrain for ${ar}`);
				break;
			}
			case 'clear-terrain': {
				const ar = area || player.area;
				let n = 0;
				for (const tt of (await byPlayer(t.TerrainTile, playerId)).filter((x) => x.area === ar)) {
					await t.TerrainTile.delete(tt.id);
					n++;
				}
				await recalcBiome(playerId, playerId, ar, { player, fresh: true });
				log.push(`Cleared ${n} terrain tiles in ${ar}`);
				break;
			}
			case 'grant-resources': {
				const inventory = { ...(player.inventory || {}) };
				const valid = new Set(d.resources.map((r: any) => r.id));
				let granted = 0;
				if (resources && typeof resources === 'object') {
					// per-resource amounts: { seeds: 50, clay: 10, ... }
					for (const [id, qty] of Object.entries(resources)) {
						const n = Math.floor(Number(qty) || 0);
						if (n > 0 && valid.has(id)) {
							inventory[id] = (inventory[id] || 0) + n;
							granted++;
						}
					}
					log.push(`Granted ${granted} resource type${granted === 1 ? '' : 's'}`);
				} else {
					// fallback: a flat amount of every resource
					const give = Math.max(1, Number(amount) || 200);
					for (const r of d.resources) inventory[r.id] = (inventory[r.id] || 0) + give;
					log.push(`Granted ${give} of every resource`);
				}
				await patchPlayer(playerId, { inventory });
				break;
			}
			case 'max-tools': {
				const tools = { ...(player.tools || {}) };
				for (const tool of d.tools) {
					const top = Math.max(...tool.tiers.map((ti: any) => ti.tier));
					tools[tool.id] = top;
				}
				await patchPlayer(playerId, { tools });
				log.push('All tools set to max tier');
				break;
			}
			case 'unlock-all': {
				const ids = d.biomes.map((b: any) => b.id);
				await patchPlayer(playerId, { unlockedBiomes: ids });
				for (const id of ids) await t.BiomeState.patch(`${playerId}:${id}`, { unlocked: true });
				log.push(`Unlocked all biomes (${ids.length})`);
				break;
			}
			case 'unlock-next': {
				// unlock just the next locked biome in order (test progression one step)
				const sorted = [...d.biomes].sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
				const unlocked = new Set<string>(player.unlockedBiomes || ['meadow']);
				const nextB = sorted.find((b: any) => !unlocked.has(b.id));
				if (!nextB) {
					log.push('Every biome is already unlocked');
					break;
				}
				unlocked.add(nextB.id);
				await patchPlayer(playerId, { unlockedBiomes: [...unlocked] });
				await t.BiomeState.patch(`${playerId}:${nextB.id}`, { unlocked: true });
				await seedStartingTerrain(playerId, playerId, nextB.id);
				log.push(`Unlocked the next area: ${nextB.name}`);
				break;
			}
			case 'relock-all': {
				// re-lock everything except the meadow, to retest the whole unlock flow
				await patchPlayer(playerId, { unlockedBiomes: ['meadow'] });
				for (const b of d.biomes) await t.BiomeState.patch(`${playerId}:${b.id}`, { unlocked: b.id === 'meadow' });
				log.push('Re-locked every biome except the meadow');
				break;
			}
			case 'reset-tools': {
				await patchPlayer(playerId, { tools: { ...START_TOOLS } });
				log.push('Tools reset to tier 1');
				break;
			}
			case 'restart-game': {
				// Wipe the solo save back to a brand-new game — same as making a fresh
				// character, but the identity (name, passcode, look) is kept. Solo only.
				const wid = playerId; // solo world id === player id
				for (const pl of await byPlayer(t.Placement, playerId)) await t.Placement.delete(pl.id);
				for (const ch of await byPlayer(t.Chest, playerId)) await t.Chest.delete(ch.id);
				for (const tt of await byPlayer(t.TerrainTile, playerId)) await t.TerrainTile.delete(tt.id);
				for (const disc of await byPlayer(t.Discovery, playerId)) await t.Discovery.delete(disc.id);
				for (const ns of await byPlayer(t.NodeState, playerId)) await t.NodeState.delete(ns.id);
				for (const fe of await byPlayer(t.FeedEntry, playerId)) await t.FeedEntry.delete(fe.id);
				for (const pa of await byPlayer(t.PlayerAchievement, playerId)) await t.PlayerAchievement.delete(pa.id);
				// Reset every biome to its damaged, locked state (meadow stays open).
				for (const b of d.biomes) {
					await t.BiomeState.put({
						id: `${wid}:${b.id}`,
						worldId: wid,
						playerId,
						biomeId: b.id,
						health: BASE_HEALTH,
						balance: 0,
						returnedCount: 0,
						unlocked: b.id === 'meadow',
					});
				}
				// Recreate the empty starter chest by the camp.
				const chestId = placementKey(wid, 'meadow', `pl_${playerId}_starter-chest`);
				await t.Placement.put({
					id: chestId,
					worldId: wid,
					playerId,
					objectId: 'small-chest',
					area: 'meadow',
					x: STARTER_CHEST.x,
					y: STARTER_CHEST.y,
					placedAt: Date.now(),
				});
				await t.Chest.put({
					id: chestId,
					worldId: wid,
					playerId,
					area: 'meadow',
					x: STARTER_CHEST.x,
					y: STARTER_CHEST.y,
					size: 'small-chest',
					capacity: STARTER_CHEST.capacity,
					contents: {},
				});
				// Reset the player fields to fresh-start values, keeping identity.
				await patchPlayer(playerId, {
					area: 'meadow',
					x: 24.5,
					y: 6.5,
					inventory: { ...START_INVENTORY },
					craftedItems: {},
					craftedEver: {},
					tools: { ...START_TOOLS },
					unlockedBiomes: ['meadow'],
					visitedBiomes: ['meadow'],
					tutorialStep: 0,
					home: { ...DEFAULT_HOME },
					customGoals: [],
					goalClaims: {},
					devUnlockAll: false,
					// Restart the game clock at day one's morning too (same as a fresh save),
					// so a wiped game doesn't reopen at whatever time you left off.
					clockOffsetMs: nextPhaseAt(0, 'day') - Math.round((readMetrics(player)?.playSeconds || 0) * 1000),
				});
				log.push('Restarted the game — fresh save (name, passcode & look kept)');
				break;
			}
			case 'build-home': {
				// build/found the home in a style (Space → 2, style locked)
				const style = value && HOME_STYLES[value] ? value : 'cabin';
				const home = { ...homeOf(player), style, space: Math.max(2, homeOf(player).space || 1), styleLocked: true };
				await patchPlayer(playerId, { home });
				log.push(`Built home: ${HOME_STYLES[style].name}`);
				break;
			}
			case 'max-home': {
				const home = {
					style: value && HOME_STYLES[value] ? value : homeOf(player).style || 'cabin',
					space: HOME_TRACKS.space.levels.length,
					comfort: HOME_TRACKS.comfort.levels.length,
					decor: HOME_TRACKS.decor.levels.length,
					light: HOME_TRACKS.light.levels.length,
					styleLocked: true,
				};
				await patchPlayer(playerId, { home });
				log.push('Home maxed on every track');
				break;
			}
			case 'reset-home': {
				await patchPlayer(playerId, { home: { ...DEFAULT_HOME } });
				log.push('Home reset to the starter tent');
				break;
			}
			case 'set-health': {
				const ar = area || player.area;
				const h = Math.max(0, Math.min(100, Number(value) || 100));
				await t.BiomeState.patch(`${playerId}:${ar}`, { health: h });
				log.push(`Set ${ar} health to ${h}% (recomputes on next change)`);
				break;
			}
			case 'reset-biome': {
				// Wipe the current area back to its damaged starting state: remove all
				// placed habitat, terraforming, returned animals, and node timers, then
				// reseed the starting terrain and recompute. Chests (and the materials
				// inside them) are kept so a reset never destroys stored inventory.
				const ar = area || player.area;
				let placementsRemoved = 0;
				for (const pl of (await byPlayer(t.Placement, playerId)).filter((x) => x.area === ar)) {
					if (d.object.get(pl.objectId)?.isChest) continue; // keep chests + contents
					await t.Placement.delete(pl.id);
					placementsRemoved++;
				}
				for (const tt of (await byPlayer(t.TerrainTile, playerId)).filter((x) => x.area === ar)) {
					await t.TerrainTile.delete(tt.id);
				}
				let animalsRemoved = 0;
				for (const disc of (await byPlayer(t.Discovery, playerId)).filter((x) => x.biomeId === ar)) {
					await t.Discovery.delete(disc.id);
					animalsRemoved++;
				}
				const nodePrefix = `${playerId}:${ar}:`;
				for (const ns of (await byPlayer(t.NodeState, playerId)).filter((x) => String(x.id).startsWith(nodePrefix))) {
					await t.NodeState.delete(ns.id);
				}
				await t.BiomeState.patch(`${playerId}:${ar}`, { health: BASE_HEALTH, balance: 0, returnedCount: 0 });
				await seedStartingTerrain(playerId, playerId, ar);
				await recalcBiome(playerId, playerId, ar, { player, fresh: true });
				log.push(
					`Reset ${ar} to its damaged state — removed ${placementsRemoved} object${placementsRemoved === 1 ? '' : 's'} and sent ${animalsRemoved} animal${animalsRemoved === 1 ? '' : 's'} away (chests kept)`,
				);
				break;
			}
			case 'lock-biome': {
				// Re-lock the current area so the unlock flow can be retested. The
				// starting meadow can't be locked — you'd have nowhere to stand.
				const ar = area || player.area;
				if (ar === 'meadow') throw new GameError(tr('server.err.meadowCannotLock'), 400, 'server.err.meadowCannotLock');
				const unlocked = (player.unlockedBiomes || []).filter((b: string) => b !== ar);
				await patchPlayer(playerId, { unlockedBiomes: unlocked });
				await t.BiomeState.patch(`${playerId}:${ar}`, { unlocked: false });
				log.push(`Locked ${ar} again (unlock requirements must be met to re-enter)`);
				break;
			}
			case 'unlock-recipes': {
				// Toggle the dev "all recipes craftable" override (ignores progress gates).
				const next = value === undefined ? !player.devUnlockAll : !!value;
				await patchPlayer(playerId, { devUnlockAll: next });
				log.push(next ? 'All recipes unlocked (gates ignored)' : 'Recipe progress gates restored');
				break;
			}
			case 'welcome-animals': {
				// Force every animal in the current area to return — handy for testing
				// the journal, balance, and fully-recovered states.
				const ar = area || player.area;
				const here = d.animals.filter((a: any) => a.biome === ar);
				const already = new Set(
					(await byPlayer(t.Discovery, playerId)).filter((x) => x.biomeId === ar).map((x) => x.animalId),
				);
				let added = 0;
				for (const animal of here) {
					if (already.has(animal.id)) continue;
					await t.Discovery.put({
						id: `${playerId}:${animal.id}`,
						playerId,
						animalId: animal.id,
						biomeId: ar,
						comfort: 3,
						timesObserved: 0,
						firstObservedAt: Date.now(),
						whyReturned: whyReturnedText(animal, d),
					});
					added++;
				}
				await recalcBiome(playerId, playerId, ar, { player, fresh: true });
				log.push(`Welcomed ${added} animal${added === 1 ? '' : 's'} to ${ar} (${here.length} total)`);
				break;
			}
			case 'spawn-animal': {
				// Force a single animal (by id) to return — handy for checking one
				// species' sprite/entry without restoring its whole habitat.
				const animal = d.animals.find((a: any) => a.id === animalId);
				if (!animal)
					throw new GameError(tr('server.err.unknownAnimal', { animal: animalId }), 400, 'server.err.unknownAnimal');
				const discId = `${playerId}:${animal.id}`;
				const existing = await t.Discovery.get(discId);
				if (!existing) {
					await t.Discovery.put({
						id: discId,
						playerId,
						animalId: animal.id,
						biomeId: animal.biome,
						comfort: 85,
						timesObserved: 1,
						firstObservedAt: Date.now(),
						whyReturned: whyReturnedText(animal, d),
					});
				}
				// Make sure the animal's biome is reachable so you can actually go see it.
				const unlocked: string[] = player.unlockedBiomes || ['meadow'];
				if (!unlocked.includes(animal.biome)) {
					await patchPlayer(playerId, { unlockedBiomes: [...unlocked, animal.biome] });
				}
				// recalcBiome recomputes comfort from the (probably bare) habitat, which
				// would drop this animal to "rarely seen" and skip drawing it. Run it for
				// returnedCount/unlocks, then force comfort high so the spawn is visible.
				await recalcBiome(playerId, playerId, animal.biome, { player, fresh: true });
				await t.Discovery.patch(discId, { comfort: 85 });
				log.push(`Spawned ${animal.name} in ${animal.biome} — comfort 85, biome unlocked`);
				break;
			}
			case 'populate-biome': {
				// Showcase builder: turn the current area into a lush, fully-restored
				// biome for screenshots/video — naturally SCATTERED clusters of trees,
				// flowers and shrubs, crafted accents dotted about, path runs, a carved
				// lake + winding river (where the biome holds water), every animal home
				// and comfortable, and health/balance pinned at 100 — with at least one of
				// EVERY object the biome can build standing somewhere, so the shot doubles
				// as a look at the whole catalog. Every run lays out a DIFFERENT scene,
				// so you can keep hitting the button until one frames well; pass back the
				// `seed` from the log to rebuild an exact one. Chests are kept (and not
				// added); all other placements + terrain here are replaced for a clean look.
				const ar = area || player.area;
				const wid = worldOf(player);
				// One seed drives the whole layout — the lake, the river's course, every
				// cluster and accent (or, indoors, where each piece of furniture lands).
				// It changes per run so Populate reshuffles the scene instead of rebuilding
				// the same one; passing a seed back (it's printed in the log) reproduces
				// that exact scene, which is what the old fixed `populate:world:biome` seed
				// gave you every time.
				const runSeed =
					seed === undefined || seed === null || seed === ''
						? `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
						: String(seed);

				// ---- the home interior gets its own showcase -----------------------
				// Same idea indoors, different furniture: max every upgrade track (the
				// biggest floor, and the pieces that need a real house become legal),
				// clear the floor, then set out one of everything that fits. Wall-hung
				// things go against the walls and rugs land in the open middle, so it
				// reads as a furnished room rather than a jumble.
				if (ar === 'home') {
					const rng = seededRng(hash32(`populate:${wid}:home:${runSeed}`));
					const ri = (lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
					const home = {
						style: homeOf(player).style || 'cabin',
						space: HOME_TRACKS.space.levels.length,
						comfort: HOME_TRACKS.comfort.levels.length,
						decor: HOME_TRACKS.decor.levels.length,
						light: HOME_TRACKS.light.levels.length,
						styleLocked: true,
					};
					await patchPlayer(playerId, { home });
					const r = homeRoom({ ...player, home });
					const door = doorTileOf(r);
					const AGED = Date.now() - 45 * 86400000;

					// clean floor — the player's chests and what's in them stay put
					const taken = new Set<string>();
					for (const pl of (await byWorld(t.Placement, wid)).filter((p) => p.area === 'home')) {
						if (d.object.get(pl.objectId)?.isChest) {
							taken.add(`${pl.x},${pl.y}`);
							continue;
						}
						await t.Placement.delete(pl.id);
					}
					(await byWorld(t.Chest, wid)).filter((c) => c.area === 'home').forEach((c) => taken.add(`${c.x},${c.y}`));

					// everything indoor-or-both that this (now maxed) house can hold
					const fits = d.objects.filter(
						(o: any) =>
							o.placement !== 'outdoor' &&
							o.placement !== 'none' &&
							!o.isChest &&
							!o.bridge &&
							(o.homeMin || 0) <= home.space,
					);
					// The doorway and the ring around it stay clear for everything, not
					// just beds: a screenshot wants to see the way out, and it keeps the
					// authoritative blocksDoorway rule satisfied for free.
					const openFloor = (x: number, y: number) =>
						x >= r.x0 &&
						x <= r.x1 &&
						y >= r.y0 &&
						y <= r.y1 &&
						!(Math.abs(x - door.x) <= 1 && Math.abs(y - door.y) <= 1) &&
						!taken.has(`${x},${y}`);
					const rows: any[] = [];
					const put = (def: any, x: number, y: number): boolean => {
						if (!openFloor(x, y)) return false;
						taken.add(`${x},${y}`);
						const row: any = {
							id: placementKey(wid, 'home', `pl_dev_home_${x}_${y}`),
							worldId: wid,
							playerId,
							objectId: def.id,
							area: 'home',
							x,
							y,
							placedAt: AGED,
						};
						if (def.plantable) row.plantedAt = AGED;
						rows.push(row);
						return true;
					};
					/** Tiles touching a wall — where anything hung or shelved belongs. */
					const againstWall = (x: number, y: number) => x === r.x0 || x === r.x1 || y === r.y0 || y === r.y1;
					const WALL_HUNG = /painting|wallclock|shelf|chandelier|string-lights|telescope|dresser|bookshelf/;
					const FLOOR_SPREAD = /rug|reedmat|blanket|cushions|hammock/;
					const putSomewhere = (def: any): boolean => {
						const wants: ((x: number, y: number) => boolean) | null = WALL_HUNG.test(def.id)
							? againstWall
							: FLOOR_SPREAD.test(def.id)
								? (x, y) => !againstWall(x, y)
								: null;
						// the tiles this piece prefers first, then anywhere in the room, then
						// a sweep so a full floor can't silently drop a piece
						for (const test of wants ? [wants, null] : [null]) {
							for (let tries = 0; tries < 80; tries++) {
								const x = ri(r.x0, r.x1),
									y = ri(r.y0, r.y1);
								if (test && !test(x, y)) continue;
								if (put(def, x, y)) return true;
							}
						}
						for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) if (put(def, x, y)) return true;
						return false;
					};
					const missing: string[] = [];
					for (const def of fits) if (!putSomewhere(def)) missing.push(def.id);
					for (const row of rows) await t.Placement.put(row);

					log.push(
						`Furnished the home (${home.space === HOME_TRACKS.space.levels.length ? 'maxed' : 'space ' + home.space}): ` +
							`${rows.length} pieces, ${fits.length - missing.length} of ${fits.length} object types` +
							(missing.length ? ` — no floor left for ${missing.join(', ')}` : ''),
					);
					log.push(`Layout seed ${runSeed} — run Populate again for a different one, or pass this seed to rebuild it`);
					break;
				}

				const biome = d.biome.get(ar);
				if (!biome)
					throw new GameError(tr('server.err.cannotPopulate', { area: ar }), 400, 'server.err.cannotPopulate');

				// make sure the area is reachable so you can walk in and film it
				const unlockedSet = new Set<string>(player.unlockedBiomes || ['meadow']);
				if (!unlockedSet.has(ar)) {
					unlockedSet.add(ar);
					await patchPlayer(playerId, { unlockedBiomes: [...unlockedSet] });
				}

				// clean canvas: drop existing non-chest placements + all terrain here
				for (const pl of (await byWorld(t.Placement, wid)).filter((p) => p.area === ar)) {
					if (d.object.get(pl.objectId)?.isChest) continue;
					await t.Placement.delete(pl.id);
				}
				for (const tt of await byArea(t.TerrainTile, wid, ar)) {
					await t.TerrainTile.delete(tt.id);
				}

				// playable region (mirror the client): alpine reserves a mountain band on
				// top, coastal reserves ocean columns on the east; the meadow keeps camp clear.
				const grid = areaGrid(d, ar);
				const playTop = ar === 'alpine' ? ALPINE_MTN_ROWS : 0;
				const landRight = ar === 'coastal' ? grid.cols - (biome.oceanCols || 0) : grid.cols;
				const xMin = 2,
					xMax = landRight - 2;
				const yMin = playTop + 2,
					yMax = grid.rows - 2;
				const inCamp = (x: number, y: number) => ar === 'meadow' && x >= 19 && x <= 24 && y >= 3 && y <= 6;
				const OLD = Date.now() - 45 * 86400000; // 45 days ago → plants read fully grown, objects fully "matured"

				const rng = seededRng(hash32(`populate:${wid}:${ar}:${runSeed}`));
				const ri = (lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
				const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];

				const occupied = new Set<string>();
				(await byWorld(t.Chest, wid)).filter((c) => c.area === ar).forEach((c) => occupied.add(`${c.x},${c.y}`));
				const free = (x: number, y: number) =>
					x >= xMin && x <= xMax && y >= yMin && y <= yMax && !inCamp(x, y) && !occupied.has(`${x},${y}`);

				// ---- water: shovel out a lake (big blob) and a river (long channel) ----
				const waterCells: { x: number; y: number }[] = [];
				const waterAt = new Set<string>();
				/** Carve one cell. False when it was refused: camp, board edge, already taken. */
				const carve = (x: number, y: number): boolean => {
					if (!free(x, y)) return false;
					occupied.add(`${x},${y}`);
					waterAt.add(`${x},${y}`);
					waterCells.push({ x, y });
					return true;
				};
				/** Move the river onto a cell, carving it unless it is already water. Water
				 *  the channel laid down earlier is somewhere it can keep flowing THROUGH —
				 *  only genuinely forbidden ground (camp, lake, edge) turns it back. */
				const flow = (x: number, y: number): boolean => carve(x, y) || waterAt.has(`${x},${y}`);
				if (biome.canFlood !== false) {
					// lake: a rounded blob toward the left-center of the map
					const lx = ri(xMin + 1, Math.max(xMin + 1, Math.min(xMax - 4, xMin + 8)));
					const ly = ri(yMin + 1, Math.max(yMin + 1, Math.min(yMax - 3, yMin + 6)));
					for (let dy = 0; dy < 3; dy++)
						for (let dx = 0; dx < 4; dx++) {
							if ((dx === 0 || dx === 3) && (dy === 0 || dy === 2)) continue; // clip corners → rounder
							carve(lx + dx, ly + dy);
						}
					carve(lx + 1, ly - 1);
					carve(lx + 2, ly + 3); // organic edges
					// river: a channel winding downhill — one 4-connected step at a time
					// (mostly down, occasional bend) so it stays a single connected river.
					//
					// carve() REFUSES a cell that isn't free — the camp box, the lake, the
					// board edge — and a refused step used to be skipped in place. That
					// punched a hole straight THROUGH the channel rather than shortening it:
					// the meadow's camp sits at x19-24 / y3-6 and the river starts somewhere
					// in x22-40, so about one scene in six arrived as two short stubs with the
					// middle missing — the longer piece as little as five tiles. A blocked step
					// now flows AROUND the obstruction, and the walk counts the rows it
					// actually carved rather than the turns it took, so the river comes out one
					// long connected run whatever it has to get past.
					let rx = ri(Math.floor((xMin + xMax) / 2), xMax - 2),
						ry = yMin;
					while (!carve(rx, ry) && rx < xMax) rx++; // an open cell to spring from
					const riverRows = ri(13, 18);
					// Every pass either moves the head or gives up, so this terminates on its
					// own — the guard is belt and braces, sized to leave room for the bends and
					// detours that cost a pass without gaining a row.
					for (let rows = 1, guard = 0; rows < riverRows && ry < yMax && guard < 6 * riverRows; guard++) {
						// an occasional bend, for a channel that winds rather than ruling a line
						if (rng() < 0.25 && rx > xMin + 1 && rx < xMax - 1) {
							const bx = rx + (rng() < 0.5 ? -1 : 1);
							if (flow(bx, ry)) rx = bx;
							continue;
						}
						if (flow(rx, ry + 1)) {
							ry += 1;
							rows += 1; // only downstream progress counts toward the river's length
							if (rng() < 0.25) carve(Math.min(xMax, rx + 1), ry); // gentle widening (adjacent)
							continue;
						}
						// Blocked below. Sidestep — still 4-connected to the cell the head is on
						// — and try to resume downhill from there, so the water flows AROUND the
						// camp instead of leaving a hole in the middle of the channel.
						const dir = rx < xMax - 1 ? 1 : -1;
						if (flow(rx + dir, ry)) {
							rx += dir;
							continue;
						}
						if (flow(rx - dir, ry)) {
							rx -= dir;
							continue;
						}
						break; // boxed in both ways; the river ends here
					}
				}

				// ---- object pools, classified by how they want to be laid out ----
				const usable = d.objects.filter(
					(o: any) =>
						(o.biomes || []).includes(ar) &&
						o.placement !== 'indoor' &&
						o.placement !== 'none' &&
						!o.isChest &&
						!o.bridge,
				);
				if (!usable.length)
					throw new GameError(
						tr('server.err.noPlaceableObjects', { biome: biome.name }),
						400,
						'server.err.noPlaceableObjects',
					);
				// The trail tent is one-per-area, so it stays out of the random scatter and
				// is placed exactly once by the coverage pass — two tents in a screenshot
				// is a bug the eye catches immediately.
				const scatter = usable.filter((o: any) => !o.onePerArea);
				const isPath = (o: any) => /-path$/.test(o.id) || o.id === 'wooden-fence' || o.id === 'dry-stone-wall';
				const trees = scatter.filter((o: any) => o.plantable && (o.growSeconds || 0) >= 80);
				const flowers = scatter.filter((o: any) => o.plantable && (o.growSeconds || 0) < 80);
				const NATURE = new Set([
					'shrub',
					'rock-pile',
					'hollow-log',
					'log-shelter',
					'brush-pile',
					'stone-cairn',
					'rock-cairn',
					'clover-patch',
					'butterfly-flowers',
					'pollinator-garden',
					'fallen-branch-shelter',
					'insect-hotel',
					'birdhouse',
					'bird-perch',
				]);
				const nature = scatter.filter((o: any) => !o.plantable && !isPath(o) && NATURE.has(o.id));
				const paths = scatter.filter(isPath);
				const decor = scatter.filter((o: any) => !o.plantable && !isPath(o) && !NATURE.has(o.id));
				const undergrowth = nature.length ? nature : flowers; // fallback for biomes with no "nature" props

				const places: any[] = [];
				const place = (def: any, x: number, y: number) => {
					if (!def || !free(x, y)) return false;
					occupied.add(`${x},${y}`);
					const row: any = {
						id: placementKey(wid, ar, `pl_dev_${ar}_${x}_${y}`),
						worldId: wid,
						playerId,
						objectId: def.id,
						area: ar,
						x,
						y,
						placedAt: OLD,
					};
					if (def.plantable) row.plantedAt = OLD; // reads fully grown, not a sprout
					places.push(row);
					return true;
				};
				// A tight cluster of one theme around an anchor — usually dominated by a
				// single species so it reads as a natural patch/grove, not a mix.
				const cluster = (pool: any[], cx: number, cy: number, count: number, radius: number) => {
					if (!pool.length) return;
					const dom = rng() < 0.65 ? pick(pool) : null;
					for (let n = 0, tries = 0; n < count && tries < count * 8; tries++) {
						const def = dom && rng() < 0.7 ? dom : pick(pool);
						if (place(def, cx + ri(-radius, radius), cy + ri(-radius, radius))) n++;
					}
				};

				// themed clusters scattered across the WHOLE map — groves, flower patches,
				// shrubby corners — so it never lines up in rows.
				for (let i = 0, anchors = ri(8, 12); i < anchors; i++) {
					const cx = ri(xMin, xMax),
						cy = ri(yMin, yMax);
					const roll = rng();
					if (roll < 0.4 && flowers.length) cluster(flowers, cx, cy, ri(4, 8), 2);
					else if (roll < 0.72 && trees.length) {
						cluster(trees, cx, cy, ri(2, 4), 2);
						cluster(undergrowth, cx, cy, ri(1, 3), 2);
					} else cluster(undergrowth, cx, cy, ri(3, 6), 2);
				}

				// a path run or two (and paths/fences are the one thing that looks right in a line)
				if (paths.length) {
					for (let i = 0, runs = ri(1, 2); i < runs; i++) {
						const def = pick(paths);
						const horiz = rng() < 0.5;
						const len = ri(4, 6);
						const sx = ri(xMin, Math.max(xMin, xMax - (horiz ? len : 0)));
						const sy = ri(yMin, Math.max(yMin, yMax - (horiz ? 0 : len)));
						for (let k = 0; k < len; k++) place(def, sx + (horiz ? k : 0), sy + (horiz ? 0 : k));
					}
				}

				// crafted accents dotted individually across the map (never clumped)
				for (let n = 0, tries = 0, want = ri(14, 20); decor.length && n < want && tries < want * 12; tries++) {
					if (place(pick(decor), ri(xMin, xMax), ri(yMin, yMax))) n++;
				}
				// top-up so every biome reads lush even if it has few plant/nature types
				for (let tries = 0; places.length < 34 && tries < 500; tries++) {
					place(pick(scatter), ri(xMin, xMax), ri(yMin, yMax));
				}

				// ---- coverage: one of EVERY buildable thing this biome has ----
				// The passes above pick at random, so a showcase shot would routinely
				// miss half the catalog — no good when the point is to see all of it
				// at once. Anything not already standing gets planted here: random tries
				// first (so it lands scattered, like the accent pass), then a systematic
				// sweep so a crowded map can't silently drop an object.
				const placeAnywhere = (def: any): boolean => {
					for (let tries = 0; tries < 60; tries++) if (place(def, ri(xMin, xMax), ri(yMin, yMax))) return true;
					for (let y = yMin; y <= yMax; y++) for (let x = xMin; x <= xMax; x++) if (place(def, x, y)) return true;
					return false;
				};
				const standing = new Set<string>(places.map((r) => r.objectId));
				const missing: string[] = [];
				for (const def of usable) {
					if (standing.has(def.id)) continue;
					if (placeAnywhere(def)) standing.add(def.id);
					else missing.push(def.id);
				}

				// Bridges belong ON the water, so they get their own pass: cross the
				// channel where it's one tile wide, falling back to any open cell. A
				// biome that can't be flooded (the desert) simply has nowhere to put one.
				const bridgeDefs = d.objects.filter(
					(o: any) => (o.biomes || []).includes(ar) && o.bridge && o.placement !== 'indoor',
				);
				const spannedWater = new Set<string>();
				const crossing = (c: { x: number; y: number }) =>
					!waterAt.has(`${c.x - 1},${c.y}`) && !waterAt.has(`${c.x + 1},${c.y}`);
				for (const def of bridgeDefs) {
					const cell =
						waterCells.find((c) => !spannedWater.has(`${c.x},${c.y}`) && crossing(c)) ||
						waterCells.find((c) => !spannedWater.has(`${c.x},${c.y}`));
					if (!cell) {
						missing.push(def.id);
						continue;
					}
					spannedWater.add(`${cell.x},${cell.y}`);
					standing.add(def.id);
					places.push({
						id: placementKey(wid, ar, `pl_dev_${ar}_${cell.x}_${cell.y}`),
						worldId: wid,
						playerId,
						objectId: def.id,
						area: ar,
						x: cell.x,
						y: cell.y,
						placedAt: OLD,
					});
				}

				// commit water + placements
				for (const w of waterCells) {
					await t.TerrainTile.put({
						id: `${wid}:${ar}:${w.x}:${w.y}`,
						worldId: wid,
						playerId,
						area: ar,
						x: w.x,
						y: w.y,
						type: 'water',
						updatedAt: Date.now(),
					});
				}
				for (const row of places) await t.Placement.put(row);
				const waterTiles = waterCells.length;
				const placed = places.length;

				// welcome every animal home, then recalc and pin the showcase numbers
				const here = d.animals.filter((a: any) => a.biome === ar);
				const already = new Set(
					(await byWorld(t.Discovery, wid)).filter((x) => x.biomeId === ar).map((x) => x.animalId),
				);
				for (const animal of here) {
					if (already.has(animal.id)) continue;
					await t.Discovery.put({
						id: `${wid}:${animal.id}`,
						worldId: wid,
						playerId,
						animalId: animal.id,
						biomeId: ar,
						comfort: 90,
						timesObserved: 0,
						firstObservedAt: Date.now(),
						whyReturned: whyReturnedText(animal, d),
					});
				}
				await recalcBiome(wid, playerId, ar, { player, fresh: true });
				// recalc recomputes comfort/health from the habitat; force the picture-perfect
				// state so every animal is drawn (comfort high) and the meters read full.
				const bs = await findBiomeState(t.BiomeState, wid, ar);
				await t.BiomeState.patch(bs?.id ?? `${wid}:${ar}`, { health: 100, balance: 100, returnedCount: here.length });
				for (const disc of (await byWorld(t.Discovery, wid)).filter((x) => x.biomeId === ar)) {
					await t.Discovery.patch(disc.id, { comfort: 90 });
				}
				log.push(
					`Populated ${biome.name}: ${placed} objects, ${waterTiles} water tiles, ${here.length} animals home, health 100`,
				);
				log.push(
					`Every buildable thing is standing: ${standing.size} of ${usable.length + bridgeDefs.length} object types` +
						(missing.length ? ` — nowhere to put ${missing.join(', ')}` : ''),
				);
				log.push(`Layout seed ${runSeed} — run Populate again for a different one, or pass this seed to rebuild it`);
				break;
			}
			case 'set-weather': {
				// Force the weather and/or season for filming — a persistent override
				// on the player that the snapshot (and the client's live clock) honor.
				// `value: { type?, season? }` merges into the current override; a null/
				// empty value (or value.clear) lifts the override back to the live sky.
				const v = value && typeof value === 'object' ? value : null;
				if (!v || v.clear) {
					await patchPlayer(playerId, { devWeather: null });
					log.push('Weather override cleared — back to the live sky');
					break;
				}
				const cur = player.devWeather || {};
				const next: any = { type: cur.type ?? null, season: cur.season ?? null };
				if ('type' in v) {
					if (v.type && !WEATHER_TYPES.includes(v.type))
						throw new GameError(
							tr('server.err.unknownWeatherType', { type: v.type }),
							400,
							'server.err.unknownWeatherType',
						);
					next.type = v.type || null;
				}
				if ('season' in v) {
					if (v.season && !SEASONS.includes(v.season))
						throw new GameError(tr('server.err.unknownSeason', { season: v.season }), 400, 'server.err.unknownSeason');
					next.season = v.season || null;
				}
				await patchPlayer(playerId, { devWeather: next });
				log.push(`Weather override: ${next.type || 'live'} · ${next.season || 'live'}`);
				break;
			}
			default:
				throw new GameError(tr('server.err.unknownDevAction', { action }), 400, 'server.err.unknownDevAction');
		}

		// The dev tools rewrite placements directly — wiping an area, reseeding it,
		// furnishing a house — rather than through the endpoints that keep the goal
		// board's tallies in step with them. Rather than remember which of a dozen
		// actions moved a placement, recompute from the rows on the way out: this is
		// a developer path on one test save, and one scan is cheaper than a tally
		// that silently disagrees with the world it describes.
		await recomputeStanding(worldOf(player), playerId);
		// …and the growth marker beside them, for the same reason: populate plants
		// things, and every heartbeat trusts this number until the moment it names.
		// The placement scan is the one recomputeStanding just did — the request
		// cache serves it — so this costs a write and no reads.
		await patchPlayer(playerId, {
			nextMaturityAt: nextMaturityFrom(d, await byWorld(t.Placement, worldOf(player)), Date.now()),
		});
		return { ok: true, log, state: await snapshot(playerId) };
	}
}
