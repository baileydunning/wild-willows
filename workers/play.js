/**
 * play.wildwillows.app — the browser demo, served from Cloudflare's edge.
 *
 * The static-assets binding in wrangler.jsonc does nearly all the work: routing,
 * SPA fallback and caching are the asset server's job. This script exists for
 * two things it can't do.
 *
 * 1. TELEMETRY PROXY. The demo posts a handful of fire-and-forget reports to
 *    Harper. Sent from the browser to another hostname those are cross-origin,
 *    which means a CORS preflight, which Harper does not answer — so every one
 *    of them failed, silently, because the client swallows their errors by
 *    design. Proxying them here makes the browser's request SAME-ORIGIN and the
 *    hop to Harper server-side, where CORS does not apply. No Harper config, and
 *    nothing to re-fix if the apex hostname changes again.
 *
 *    Pointed at the vendor hostname on purpose: it has a valid certificate and
 *    works today, so the demo's reporting does not depend on wildwillows.app
 *    resolving. Change it once the apex is settled if you'd rather.
 *
 * 2. ROBOTS. The demo is playable and self-contained, so a crawler will index it
 *    as a page about Wild Willows, competing with the real landing page and
 *    splitting the ranking between a marketing page and a bare game canvas.
 *
 * Per `run_worker_first` in wrangler.jsonc this only runs for the HTML entry
 * point and the proxied paths. Asset requests (JS chunks, audio) skip the Worker
 * entirely — crawlers index pages, not chunks, and skipped invocations are ones
 * we are not billed for.
 */

const CANONICAL = 'https://wildwillows.app/';
const HARPER = 'https://wild.willows.harperfabric.com';

/* Explicit allowlist, not a prefix match. This Worker sits on a public hostname;
 * a loose rule would turn it into an open proxy to every endpoint Harper
 * exposes, including the admin-only ones. Add a name here only when the demo
 * genuinely calls it. */
const PROXIED = new Set([
	'AppOpen',
	'SyncMetrics',
	'ReportClientError',
	'ReportSaveIncident',
	'SubmitFeedback',
]);

export default {
	async fetch(request, env) {
		const url = new URL(request.url);
		const first = url.pathname.split('/').filter(Boolean)[0];

		if (PROXIED.has(first)) {
			const target = new URL(url.pathname + url.search, HARPER);
			// Forward method and body; let fetch set Host/SNI from the target URL.
			// Deliberately NOT forwarding the whole header set — cookies and client
			// hints have no business reaching Harper, and the body is JSON either way.
			const headers = new Headers();
			for (const h of ['content-type', 'accept', 'accept-language']) {
				const v = request.headers.get(h);
				if (v) headers.set(h, v);
			}
			try {
				return await fetch(target, {
					method: request.method,
					headers,
					body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
				});
			} catch {
				// Telemetry is best-effort on the client too — answer rather than 500,
				// so a Harper hiccup never shows up as an error in a player's console.
				return new Response(JSON.stringify({ ok: false }), {
					status: 202,
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
