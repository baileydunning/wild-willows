import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/* A SNAPSHOT FROM BEFORE THE DOOR DOES NOT GET TO SAY WHERE WE ARE.
 *
 * Stepping through a door is a round trip: tell the server where we are, then
 * fetch the world back. Meanwhile the app fetches that same world for its own
 * reasons all the time — the heartbeat, the day-rollover watcher, the trailing
 * reconcile, every non-optimistic action.
 *
 * A fetch that LEFT before the door and LANDED after it describes the room we
 * just walked out of, and adoptState took it at face value. Everything reading
 * player.area snapped back to the old area and then forward again on the next
 * refresh — the HUD, the panels, and audibly the music, which crossfaded to the
 * house's piece out in the meadow and then back. That is the flip players heard.
 *
 * The fence is a counter bumped the moment the server agrees we have moved: a
 * fetch that started under an older number is dropped on arrival. These tests
 * read the source rather than mounting the provider, same as the other rules
 * pinned on state.tsx (see recipe-unlock-quiet.test.ts) — what is worth pinning
 * here is the SHAPE, because the failure mode is someone tidying the guard away
 * or adding a sixth caller that fetches the world without it.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = readFileSync(join(root, 'src/state.tsx'), 'utf8');

/** The body of a `const <name> = useCallback(` up to its dependency array. */
function callback(name: string): string {
	const start = src.indexOf(`const ${name} = useCallback(`);
	expect(start).toBeGreaterThan(-1);
	const end = src.indexOf('\n\t\t[', start);
	expect(end).toBeGreaterThan(start);
	return src.slice(start, end);
}

describe('a world snapshot that outlived the room it was fetched for', () => {
	it('is fetched under an epoch and dropped if the epoch moved', () => {
		const refresh = callback('refresh');
		// captured BEFORE the await, compared AFTER it — a guard read after the
		// fetch resolves would always agree with itself
		const captured = refresh.indexOf('areaEpoch.current');
		const awaited = refresh.indexOf('await api.gameState()');
		expect(captured).toBeGreaterThan(-1);
		expect(captured).toBeLessThan(awaited);
		expect(refresh.slice(awaited)).toMatch(/if \(.*areaEpoch\.current\) return/);
	});

	it('is retired the moment the server agrees the caretaker has moved', () => {
		const changeArea = callback('changeArea');
		const synced = changeArea.indexOf('api.syncPlayer(');
		const bumped = changeArea.indexOf('++areaEpoch.current');
		const fetched = changeArea.indexOf('await api.gameState()');
		expect(synced).toBeGreaterThan(-1);
		// After the sync (anything in flight before it predates the move) and before
		// our own fetch (so ours is the only one that can land).
		expect(bumped).toBeGreaterThan(synced);
		expect(bumped).toBeLessThan(fetched);
	});

	it('leaves no unguarded way to adopt the world from the server', () => {
		// The shape that caused this: fetch and adopt in one breath, with nothing in
		// between to notice the world had moved on. Every snapshot fetch now goes
		// through refresh() or through changeArea's own guarded one.
		expect(src).not.toContain('adoptState(await api.gameState())');
		expect(src.match(/api\.gameState\(\)/g) ?? []).toHaveLength(2);
	});
});
