import { describe, it, expect } from 'vitest';
import { fingerprintPath, fingerprintScript } from '../../src/clientErrors';

// A crash row on the dashboard is keyed server-side by hash32(message|where)
// (ReportClientError in server/resources.ts), so `where` is the whole definition
// of "the same bug". Both helpers here exist because that definition was wrong
// in two ways at once, and both failed the same direction: they SPLIT one
// problem across many rows, which is how a real crash hides inside a wall of
// count-of-1 entries in a top-25 list.
//
// Worth guarding with tests because neither failure is visible from the code —
// it looks fine, reports fine, and only shows up as a dashboard that has been
// quietly useless for weeks.

describe('fingerprintPath', () => {
	it('collapses an id carried in the URL', () => {
		// The actual rows this was written for: eight separate "Failed to fetch"
		// entries, one per player, each with a count of 1.
		expect(fingerprintPath('/Metrics/bailey-test-fhkbf5')).toBe('/Metrics/:id');
		expect(fingerprintPath('/Metrics/bobo-jogukk')).toBe('/Metrics/:id');
		expect(fingerprintPath('/GameState/jeancrafteo-xhswa7')).toBe('/GameState/:id');
	});

	it('maps every id for one endpoint onto a single fingerprint', () => {
		const ids = ['tiokapon-b76gcd', 'caretaker-ubfplc', 'briar-nes8rj', 'sss-c69wiy'];
		expect(new Set(ids.map((id) => fingerprintPath(`/Metrics/${id}`))).size).toBe(1);
	});

	it('leaves endpoints that pass the id in the body alone', () => {
		// These were already aggregating correctly — the fix must not change them,
		// or their existing rows split instead.
		expect(fingerprintPath('/AppendFeed/')).toBe('/AppendFeed/');
		expect(fingerprintPath('/SyncPlayer/')).toBe('/SyncPlayer/');
		expect(fingerprintPath('/Heartbeat/')).toBe('/Heartbeat/');
	});

	it('keeps the endpoint name, which is the part that identifies the call', () => {
		expect(fingerprintPath('/Metrics/abc')).not.toBe('/:id/:id');
		expect(fingerprintPath('/CollectResource/')).toContain('CollectResource');
	});

	it('drops the query string', () => {
		expect(fingerprintPath('/GameplayHealth/?minutes=60')).toBe('/GameplayHealth/');
		expect(fingerprintPath('/Metrics/abc?exclude=bailey_test')).toBe('/Metrics/:id');
	});

	it('normalises every argument segment, not just the first', () => {
		expect(fingerprintPath('/Thing/a/b')).toBe('/Thing/:id/:id');
	});

	it('survives junk without throwing', () => {
		expect(fingerprintPath('')).toBe('');
		expect(fingerprintPath('/')).toBe('/');
		expect(fingerprintPath(undefined as any)).toBe('');
	});
});

describe('fingerprintScript', () => {
	it('strips the Vite content hash so one bug keeps one row across deploys', () => {
		// These three are the same chunk from three different builds. Before this,
		// each deploy re-filed every crash under a brand-new row, so the panel could
		// show you a bug three times and never say it was the same bug.
		const builds = ['index-B0BrE4OL.js', 'index-BBw9oUwa.js', 'index-D8U6LTEu.js'];
		expect(builds.map(fingerprintScript)).toEqual(['index.js', 'index.js', 'index.js']);
		expect(new Set(builds.map(fingerprintScript)).size).toBe(1);
	});

	it('keeps different chunks apart', () => {
		expect(fingerprintScript('resources-ugg_vsS3.js')).toBe('resources.js');
		expect(fingerprintScript('img-assets-D43MmXoy.js')).toBe('img-assets.js');
		expect(fingerprintScript('index-Cipm5zeY.js')).not.toBe(fingerprintScript('resources-ugg_vsS3.js'));
	});

	it('takes the basename out of a full URL', () => {
		expect(fingerprintScript('https://wildwillows.app/assets/index-B0BrE4OL.js')).toBe('index.js');
	});

	it('leaves a hand-written filename intact', () => {
		// The pattern must not eat a real hyphenated name, or two unrelated files
		// merge into one row — the opposite failure, and a worse one.
		expect(fingerprintScript('demo-nudge.js')).toBe('demo-nudge.js');
		expect(fingerprintScript('main.tsx')).toBe('main.tsx');
		expect(fingerprintScript('worker.js')).toBe('worker.js');
	});

	it('falls back rather than throwing on nothing', () => {
		expect(fingerprintScript('')).toBe('unknown');
		expect(fingerprintScript(undefined as any)).toBe('unknown');
	});
});
