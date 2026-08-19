import { describe, it, expect } from 'vitest';
import { authoredServerModules, LAYERS, serverSource, serverFiles } from '../serverSource';

// The guard on the guard. Several suites grep the server source for things that
// have no runtime assertion — an untagged refusal, an unwritten metric, a rate
// tier the docs contradict. All of them read it through tests/serverSource.ts.
// If a new server module were added and not listed there, every one of those
// suites would keep passing while looking at less and less of the code.

describe('the server source the text-scanning suites read', () => {
	it('covers every authored module in server/', () => {
		const listed = [...LAYERS].sort();
		const onDisk = authoredServerModules();
		expect(
			onDisk.filter((m) => !listed.includes(m as (typeof LAYERS)[number])),
			'add these to LAYERS in tests/serverSource.ts, or the suites that grep the server go blind to them',
		).toEqual([]);
		expect(listed.filter((m) => !onDisk.includes(m)), 'LAYERS names a module that no longer exists').toEqual([]);
	});

	it('reads as one body of code, not an empty string', () => {
		const src = serverSource();
		expect(src.length).toBeGreaterThan(200_000);
		expect(serverFiles().every((f) => f.src.length > 0)).toBe(true);
	});

	it('still contains the landmarks the other suites look for', () => {
		// A cheap canary: if the split ever drops a module from LAYERS, these go
		// missing here first, with a clearer message than a downstream regex.
		const src = serverSource();
		expect(src).toContain('class GameError extends Error');
		expect(src).toContain('export class GameData extends PublicEndpoint');
		expect(src).toContain('const LANDING_CLICK_TARGETS');
		expect(src).toMatch(/new GameError\(/);
	});
});
