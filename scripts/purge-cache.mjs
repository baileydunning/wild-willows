#!/usr/bin/env node
/**
 * Purge the edge copy of /GameData/ after a deploy.
 *
 * WHY THIS EXISTS. The catalog is served with `s-maxage=86400`, so Cloudflare
 * answers repeats from its own copy for a day and Harper never sees them. That
 * is the whole point — a classroom re-running a fetch example six hundred times
 * a minute should cost the origin nothing — but it means the edge is holding
 * yesterday's catalog the moment you ship new species, new recipes or a
 * corrected diet. Browsers revalidate on every load and would pick the change up
 * instantly; the edge is the thing standing in the way, so a deploy has to tell
 * it to let go.
 *
 * Without this the day-long s-maxage is a day-long lie. With it, the long TTL is
 * safe: quiet time costs nothing and a release is live immediately.
 *
 *   CLOUDFLARE_ZONE_ID    the zone for wildwillows.app
 *   CLOUDFLARE_API_TOKEN  a token with Zone → Cache Purge → Purge
 *
 * Run it AFTER the new build is actually serving, not before: purging first just
 * re-caches the old body.
 *
 *   npm run deploy:purge
 *   npm run deploy:purge -- --soft    # skip quietly when unconfigured
 */

const URLS = ['https://wildwillows.app/GameData/', 'https://wildwillows.app/GameData'];

const soft = process.argv.includes('--soft');
const zone = process.env.CLOUDFLARE_ZONE_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;

if (!zone || !token) {
	const missing = [!zone && 'CLOUDFLARE_ZONE_ID', !token && 'CLOUDFLARE_API_TOKEN'].filter(Boolean).join(' and ');
	if (soft) {
		console.log(`purge-cache: ${missing} not set, skipping.`);
		process.exit(0);
	}
	console.error(
		`purge-cache: ${missing} not set.\n` +
			'\n' +
			'  The catalog is cached at the edge for a day (s-maxage=86400), so until\n' +
			'  this runs, /GameData/ keeps serving the previous build to anyone whose\n' +
			'  request is answered by Cloudflare rather than by Harper.\n' +
			'\n' +
			'  Set both and re-run, or pass --soft to skip on purpose.',
	);
	process.exit(1);
}

const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}/purge_cache`, {
	method: 'POST',
	headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
	body: JSON.stringify({ files: URLS }),
});

/* Read the body before deciding. Cloudflare answers a rejected purge with a 200
 * and `success: false`, so status alone reports a failure as a success. */
const out = await res.json().catch(() => null);
if (!res.ok || !out || out.success !== true) {
	console.error('purge-cache: FAILED', res.status, JSON.stringify(out?.errors ?? out));
	process.exit(1);
}
console.log(`purge-cache: purged ${URLS.length} URLs — the edge will fetch the new catalog on the next request.`);
