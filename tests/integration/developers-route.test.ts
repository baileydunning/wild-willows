import { describe, it, expect, beforeEach } from 'vitest';
import { freshWorld, type World } from './harness';

// /developers and /developers/api — the public-API documentation.
//
// One resource, two paths, one canonical. The routing is the same getId()
// dispatch /learn and /teachers use, and the reason it gets its own test is the
// same reason those did: an unknown slug under a section must 404 rather than
// quietly serve the section's only page from any URL somebody invents.

let w: World;
beforeEach(async () => {
	w = await freshWorld();
});

const dev = (slug: string) => w.fetch<any>('developers', {}, slug);

describe('the /developers section routes', () => {
	it('serves the docs at /developers/api', async () => {
		const res = await dev('api');
		expect(res.status ?? 200).toBe(200);
		expect(String(res.body)).toContain('Open Game Data');
	});

	it('and at /developers, which is what people type', async () => {
		const res = await dev('');
		expect(res.status ?? 200).toBe(200);
		expect(String(res.body)).toContain('Open Game Data');
	});

	it('but only one of the two claims to be canonical', async () => {
		// Two URLs serving byte-identical HTML split every ranking signal between
		// them unless one of them says which is real.
		const body = String((await dev('')).body);
		expect(body).toContain('<link rel="canonical" href="https://wildwillows.app/developers/api">');
		expect(body).not.toContain('rel="canonical" href="https://wildwillows.app/developers"');
	});

	it('404s an unknown slug rather than serving the docs from anywhere', async () => {
		expect((await dev('v2')).status).toBe(404);
		expect((await dev('api/v1')).status).toBe(404);
	});

	it('documents the endpoint it is about, and links to the lesson', async () => {
		const body = String((await dev('api')).body);
		expect(body).toContain('https://wildwillows.app/GameData/');
		expect(body).toContain('/learn/web-development');
	});
});
