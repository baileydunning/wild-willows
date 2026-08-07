import { describe, it, expect, beforeEach } from 'vitest';
import { journalNav } from '../../src/ui/journalNav';

// A field journal stand should open the journal on the biome you're standing in.
//
// The panel initialised its tab from the journal's history trail, so reading a
// lectern in the wetland showed whatever biome you'd last browsed. `openAt` makes
// the stand point the trail at the current biome first — which also retargets a
// panel that's already open, since the panel subscribes to the trail.

/** The trail is module state, so unwind it between tests. */
beforeEach(() => {
	while (journalNav.canBack()) journalNav.back();
	journalNav.visit({ kind: 'view', tab: '__reset__', view: 'list' });
	while (journalNav.canBack()) journalNav.back();
});

describe('openAt points the journal at a biome', () => {
	it('lands on the requested biome', () => {
		journalNav.openAt('wetland');
		expect(journalNav.current()).toMatchObject({ kind: 'view', tab: 'wetland' });
	});

	it('overrides whatever biome was being browsed before', () => {
		journalNav.visit({ kind: 'view', tab: 'forest', view: 'list' });
		journalNav.openAt('desert');
		expect(journalNav.current()).toMatchObject({ tab: 'desert' });
	});

	it('keeps the reading mode you were last using', () => {
		journalNav.visit({ kind: 'view', tab: 'forest', view: 'web' });
		journalNav.openAt('alpine');
		expect(journalNav.current()).toMatchObject({ tab: 'alpine', view: 'web' });
	});

	it('defaults to the entry list when arriving from an animal card', () => {
		journalNav.visit({ kind: 'animal', id: 'great-horned-owl' });
		journalNav.openAt('coastal');
		expect(journalNav.current()).toMatchObject({ tab: 'coastal', view: 'list' });
	});

	it('leaves Back working, so the stand does not strand you', () => {
		journalNav.visit({ kind: 'view', tab: 'forest', view: 'list' });
		journalNav.openAt('meadow');
		expect(journalNav.canBack()).toBe(true);
		expect(journalNav.back()).toMatchObject({ tab: 'forest' });
	});

	it('re-reading the same stand is a no-op rather than a pile of history', () => {
		journalNav.openAt('meadow');
		const before = journalNav.canBack();
		journalNav.openAt('meadow');
		journalNav.openAt('meadow');
		expect(journalNav.canBack()).toBe(before);
		expect(journalNav.current()).toMatchObject({ tab: 'meadow' });
	});

	it('notifies subscribers, so an already-open panel retargets', () => {
		let fired = 0;
		const off = journalNav.subscribe(() => fired++);
		journalNav.openAt('wetland');
		expect(fired).toBeGreaterThan(0);
		off();
	});
});
