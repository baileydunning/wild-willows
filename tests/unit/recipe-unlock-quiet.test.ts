import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// A new crafting recipe is news, not an interruption.
//
// Unlocks arrive in clumps — restore a biome a few points and several gates fall
// at once — and each one used to throw a toast across the top of the HUD about
// something that would still be sitting in the crafting menu whenever the player
// got round to it. The announcement now goes to the activity feed only, where it
// is timestamped and scrollable and costs nobody their attention mid-task.
//
// Toasts are for what you must react to now (a task ready to claim, an animal
// arriving, a refusal). This pins the recipe announcement on the quiet side of
// that line.

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const catalog = (locale: string) => JSON.parse(read(`src/i18n/${locale}/app.json`));

/** The recipe-unlock effect in state.tsx, from its diff of unlocked ids to the
 *  end of that useEffect's body. */
function recipeUnlockEffect(): string {
	const src = read('src/state.tsx');
	const start = src.indexOf('unlockedRecipeIds(data, state)');
	expect(start).toBeGreaterThan(-1); // the effect still exists at all
	const end = src.indexOf('}, [', start);
	return src.slice(start, end);
}

describe('a newly unlocked recipe', () => {
	it('is announced in the feed', () => {
		const effect = recipeUnlockEffect();
		expect(effect).toContain('pushLog');
		expect(effect).toContain('app.feed.recipeUnlocked');
		for (const locale of ['en', 'es']) expect(catalog(locale).feed.recipeUnlocked).toBeTruthy();
	});

	it('does not toast', () => {
		expect(recipeUnlockEffect()).not.toMatch(/\btoast\(/);
	});

	it('has no toast string left behind to be reached for', () => {
		// The key is gone from the catalogs too, so a future edit that wires a toast
		// back up has to add the copy deliberately rather than find it lying there.
		for (const locale of ['en', 'es']) expect(catalog(locale).toast.recipeUnlocked).toBeUndefined();
	});

	it('leaves the toasts that ARE worth interrupting for', () => {
		// Guard against reading this rule too broadly next time.
		const en = catalog('en').toast;
		expect(en.achievementUnlocked).toBeTruthy();
		expect(en.taskComplete).toBeTruthy();
	});
});
