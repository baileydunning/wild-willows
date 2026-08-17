/**
 * play.wildwillows.app — the browser demo, served from Cloudflare's edge.
 *
 * Two jobs.
 *
 * 1. API PROXY. The demo is server-authoritative (DEMO_WEB_BACKEND = 'harper'),
 *    so every action is a request to Harper. Sent from the browser to another
 *    hostname those are cross-origin: a CORS preflight Harper does not answer,
 *    and the client swallows the failures by design, so they fail SILENTLY.
 *    Proxying here makes the browser's request same-origin and the hop to Harper
 *    server-side, where CORS does not apply. No Harper config, and nothing to
 *    re-fix when the API hostname changes again.
 *
 *    Pointed at the vendor hostname deliberately: it has a valid certificate and
 *    has stayed up through every apex change, so the demo does not depend on
 *    wildwillows.app resolving.
 *
 * 2. ROBOTS. The demo is playable and self-contained, so a crawler will index it
 *    as a page about Wild Willows, competing with the real landing page and
 *    splitting the ranking between a marketing page and a bare game canvas.
 */

const CANONICAL = 'https://wildwillows.app/';
const HARPER = 'https://wild.willows.harperfabric.com';

/**
 * EXPLICIT ALLOWLIST — never a prefix match, and never a denylist.
 *
 * This Worker sits on a public hostname with no authentication in front of it.
 * A "proxy everything except X" rule silently exposes each new endpoint the day
 * it is added, which is exactly the kind of mistake nobody notices. Anything not
 * named here falls through to the static assets and 404s.
 *
 * Derived from the calls in src/api.ts. Deliberately ABSENT, and they must stay
 * absent — every dashboard and admin endpoint, which are the ones that carry
 * players' feedback emails, mailing-list addresses and server internals:
 *   DashboardAuth · MetricsSummary · MetricsPlayers · ServerHealth · SystemProbe
 *   ListFeedback · ListMailingList · ClearProblem · GameplayHealth · SaveHealth
 *   LandingStats
 * They are reachable on Harper's own hostname behind its auth, which is where
 * they belong. Adding one here would publish it to the open internet.
 */
const PROXIED = new Set([
	// session + world
	'CreatePlayer',
	'LoginPlayer',
	'DeletePlayer',
	'ChangePasscode',
	'GameData',
	'GameState',
	'Version',
	'SyncPlayer',
	'Heartbeat',
	'RecalcBiome',
	'BiomeSnapshot',
	// actions
	'CollectResource',
	'CraftItem',
	'PlaceObject',
	'MoveObject',
	'RemoveObject',
	'Plant',
	'HarvestPlacement',
	'Terraform',
	'ChestTransfer',
	'DiscardItem',
	'ObserveAnimal',
	'ClaimTask',
	'SetGoals',
	'Rest',
	'UpgradeTool',
	'UpgradeHome',
	'SetHomeColors',
	'SetHomeStyle',
	'SetPlacementColor',
	'UpdateAppearance',
	'AppendFeed',
	// demo lifecycle
	'DeleteDemoSave',
	'ExportDemoSave',
	'DevTools',
	// telemetry + player-submitted
	'Metrics',
	'SyncMetrics',
	'AppOpen',
	'SubmitFeedback',
	'ReportClientError',
	'ReportSaveIncident',
]);

/**
 * Edge rate limiting — a first line, explicitly not the boundary.
 *
 * BEST EFFORT, and worth being honest about why: this state lives in one isolate.
 * Cloudflare runs many, in many locations, and recycles them freely, so a
 * determined attacker spread across colos sees a much higher effective limit than
 * the numbers below suggest. It is here because it is nearly free and it absorbs
 * the common case — one script hammering one endpoint from one place — before any
 * of it reaches Harper.
 *
 * The real enforcement is at the origin (rateLimit in server/resources.ts), which
 * holds no matter how a request arrives. Nothing here should ever be relied on as
 * the only thing standing in front of an endpoint.
 */
const EDGE_LIMIT_PER_MINUTE = 300;
const EDGE_BURST = 120;
const EDGE_MAX_KEYS = 5000;
const edgeBuckets = new Map();

function edgeAllows(ip, now) {
	if (!ip) return true; // cannot attribute it — let the origin decide
	let b = edgeBuckets.get(ip);
	if (!b) {
		// Cheap guard so the map cannot grow without bound inside a long-lived
		// isolate; dropping the oldest entry only ever grants someone a fresh
		// budget, which is the safe direction to fail.
		if (edgeBuckets.size >= EDGE_MAX_KEYS) {
			const oldest = edgeBuckets.keys().next();
			if (!oldest.done) edgeBuckets.delete(oldest.value);
		}
		b = { tokens: EDGE_BURST, at: now };
		edgeBuckets.set(ip, b);
	}
	b.tokens = Math.min(EDGE_BURST, b.tokens + ((now - b.at) / 60000) * EDGE_LIMIT_PER_MINUTE);
	b.at = now;
	if (b.tokens < 1) return false;
	b.tokens -= 1;
	return true;
}

export default {
	async fetch(request, env) {
		const url = new URL(request.url);
		const first = url.pathname.split('/').filter(Boolean)[0];

		if (PROXIED.has(first)) {
			if (!edgeAllows(request.headers.get('cf-connecting-ip'), Date.now())) {
				return new Response(JSON.stringify({ title: 'Too many requests' }), {
					status: 429,
					headers: { 'content-type': 'application/json', 'retry-after': '10' },
				});
			}
			const target = new URL(url.pathname + url.search, HARPER);
			// Forward method and body; fetch sets Host/SNI from the target URL.
			// Deliberately NOT forwarding the whole header set — cookies and client
			// hints have no business reaching Harper, and the body is JSON either way.
			const headers = new Headers();
			for (const h of ['content-type', 'accept', 'accept-encoding', 'accept-language', 'if-none-match']) {
				const v = request.headers.get(h);
				if (v) headers.set(h, v);
			}
			// The client's address, forwarded deliberately. Harper rate-limits per
			// caller (see rateLimit in server/resources.ts) and this is the only thing
			// that tells one caller from another — without it every request through
			// this Worker looks like the same anonymous client and shares one bucket.
			//
			// `cf-connecting-ip` on the INBOUND request is set by Cloudflare and
			// cannot be spoofed by the browser, so what we forward is trustworthy.
			// What the origin cannot know is whether a request reached it through
			// this Worker at all — Harper's hostname is directly reachable — which is
			// why the origin also keeps a service-wide ceiling that does not depend
			// on this header being honest.
			const clientIp = request.headers.get('cf-connecting-ip');
			if (clientIp) headers.set('cf-connecting-ip', clientIp);
			try {
				return await fetch(target, {
					method: request.method,
					headers,
					body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
				});
			} catch {
				/* 502, not a synthesized success. Gameplay reads this: the client shows
				 * "the server can't be reached" and keeps the player's session, whereas
				 * a fake 200 with no body would surface as corrupt state. */
				return new Response(JSON.stringify({ title: 'Upstream unavailable' }), {
					status: 502,
					headers: { 'content-type': 'application/json' },
				});
			}
		}

		const res = await env.ASSETS.fetch(request);
		// Response headers are immutable as returned; re-wrap to set our own.
		const out = new Response(res.body, res);
		out.headers.set('x-robots-tag', 'noindex');
		out.headers.set('link', `<${CANONICAL}>; rel="canonical"`);
		return out;
	},
};
