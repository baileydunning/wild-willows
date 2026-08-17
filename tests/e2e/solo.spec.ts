import { test, expect, type Page } from '@playwright/test';

// Solo offline E2E. We flag the app as "desktop" before any script runs, which
// flips the API transport to the in-app solo backend (GameData + all actions are
// served locally, saves go to localStorage). No Harper required.
//
// This suite is the only place the REAL client is exercised — Phaser, the HUD,
// the panels, the keybindings and localStorage saves all together. The unit and
// integration suites can prove the server opens the coastal gate; only this one
// can prove a player can see it happen.

test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => {
		(window as any).wildWillowsDesktop = { isDesktop: true };
	});
});

/** New save → standing in the meadow, HUD up, Phaser running. */
async function newSolo(page: Page, name: string) {
	await page.goto('/');
	await page.getByRole('button', { name: 'New Game' }).click();
	await page.getByPlaceholder('Caretaker name').fill(name);
	await page.getByRole('button', { name: 'Begin restoring' }).click();
	await expect(page.locator('.game-screen')).toBeVisible({ timeout: 30_000 });
	await expect(page.locator('canvas:not(.confetti-canvas)')).toBeVisible();
}

/**
 * Dismiss the opening tutorial.
 *
 * A new save now starts with the interface folded away — no menu bar, no goal
 * board, no toolbelt — and the tutorial hands each piece over at the card that
 * explains it, so a caretaker's first minute is a meadow rather than a cockpit.
 * Skipping is the returning player's path to the same place: everything opens at
 * once. Tests that want the full HUD ask for it here.
 */
async function skipTutorial(page: Page) {
	const skip = page.getByRole('button', { name: 'Skip tutorial' });
	await expect(skip).toBeVisible();
	await skip.click();
	await expect(page.locator('.tutorial-card')).toHaveCount(0);
}

/** The caretaker name DevTools accepts.
 *
 *  The endpoint is gated to `bailey_test` saves (DEV_PLAYER_SLUG in
 *  server/resources.ts), so any test that reaches late-game state through the
 *  dev panel has to be one. Named rather than bypassed, so these exercise the
 *  rule that ships. Tests that do not touch the dev panel keep their descriptive
 *  names — those names are part of what they assert. */
const DEV_SAVE = 'bailey_test';

/** The hidden dev panel (Cmd/Ctrl + Shift + Backspace), used to reach late-game
 *  state without playing the hours it costs. */
async function openDevPanel(page: Page) {
	await page.keyboard.press('Control+Shift+Backspace');
	await expect(page.locator('.panel-head h2', { hasText: 'Dev tools' })).toBeVisible();
}

/** The title of whichever panel is open. */
const openPanelTitle = (page: Page) => page.locator('.panel-head h2');

/**
 * Close the open panel with Escape.
 *
 * Escape dismisses the TOPMOST layer and spends the press on exactly one thing
 * (the chain in App.tsx, pinned by tests/unit/escape-chain.test.ts). A panel
 * frequently opens with its own coach banner floating over it, and banners sit
 * ahead of panels in that chain deliberately — so the first press can be spent
 * on the banner and the panel needs a second. Two presses is the documented
 * worst case; a third would mean the chain is stuck, so this fails rather than
 * pressing forever.
 */
async function closePanel(page: Page) {
	await page.keyboard.press('Escape');
	const closed = await page
		.locator('.panel')
		.waitFor({ state: 'detached', timeout: 1_500 })
		.then(
			() => true,
			() => false,
		);
	// Still up? A banner took the first press. One more finishes the job.
	if (!closed) await page.keyboard.press('Escape');
	await expect(page.locator('.panel')).toHaveCount(0);
}

// --------------------------------------------------------------- title screen

test('title screen loads', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'Wild Willows' })).toBeVisible();
	// Solo is the default mode; New Game becomes enabled once GameData loads.
	await expect(page.getByRole('button', { name: 'New Game' })).toBeEnabled();
});

test('create a solo character and enter the preserve', async ({ page }) => {
	await newSolo(page, 'E2E Explorer');

	// A caretaker starts in the meadow with both meters on screen — the two
	// numbers the whole game is about.
	await expect(page.locator('.hud-area-name')).toContainText('Willow Meadow');
	await expect(page.locator('.meter')).toHaveCount(2);
});

test('the solo save is remembered for "Continue"', async ({ page }) => {
	await newSolo(page, 'Returning Rae');

	// Reload: the title screen should now offer to continue the just-made save.
	await page.goto('/');
	await expect(page.getByRole('button', { name: /Continue as Returning Rae/ })).toBeVisible();
});

// -------------------------------------------------------------------- panels

// Every panel a player reaches by keyboard. These are the whole interface
// outside the canvas, and a panel that throws on open takes the run with it —
// the client-error reports that made ErrorBoundary necessary looked exactly
// like this. Opening each one and reading its title is a cheap smoke test for
// all of them.
//
// The journal's heading is the field guide for the biome you're standing in
// ("Willow Meadow Field Guide (0/25)"), not the panel name — `panels.journal.title`
// is used elsewhere.
const PANELS: { key: string; title: string | RegExp }[] = [
	{ key: 'c', title: 'Crafting' },
	{ key: 'b', title: /Gathering Basket/ },
	{ key: 'j', title: /Field Guide/ },
	{ key: 'k', title: 'Achievements' },
	{ key: 't', title: 'Tools & Upgrades' },
	{ key: 'm', title: 'The Preserve' },
	{ key: 'g', title: 'Your Goals' },
];

test('every panel opens on its key and closes on Escape', async ({ page }) => {
	await newSolo(page, 'Panel Prowler');

	for (const panel of PANELS) {
		await page.keyboard.press(panel.key);
		await expect(openPanelTitle(page)).toContainText(panel.title);
		await closePanel(page);
	}
});

test('the toolbelt selects tools with the number keys', async ({ page }) => {
	await newSolo(page, 'Tool Tester');

	// The belt is not there yet. A brand-new caretaker has been asked to walk
	// around a meadow and nothing else, and a row of implements they have no use
	// for reads as clutter to be ignored rather than tools to be picked up — so
	// the tutorial hands the belt over at the card that explains it.
	await expect(page.locator('.tool-slot')).toHaveCount(0);
	await skipTutorial(page);

	// Three tools outdoors — basket, shovel, watering can, on 1/2/3. (Paint is
	// the fourth binding but its slot only exists inside a finished house, so it
	// is not part of the outdoor belt.)
	const slots = page.locator('.tool-slot');
	await expect(slots).toHaveCount(3);
	// A new caretaker starts holding the basket, so exactly one slot is lit
	// before any key is pressed.
	await expect(page.locator('.tool-slot.on')).toHaveCount(1);

	for (const [i, key] of ['1', '2', '3'].entries()) {
		await page.keyboard.press(key);
		await expect(page.locator('.tool-slot.on')).toHaveCount(1);
		// ...and it is the slot that key belongs to, not merely some slot.
		await expect(slots.nth(i)).toHaveAttribute('aria-pressed', 'true');
	}
});

// ---------------------------------------------------------------- the preserve

test('the preserve map shows six areas, five of them shut', async ({ page }) => {
	await newSolo(page, 'Map Reader');

	await page.keyboard.press('m');
	await expect(openPanelTitle(page)).toContainText('The Preserve');

	// Six stops on the trail map, and a new save has walked into exactly one.
	await expect(page.locator('.pm-stop')).toHaveCount(6);
	await expect(page.locator('.pm-stop.pm-locked')).toHaveCount(5);
	await expect(page.locator('.pm-here')).toHaveCount(1);
});

test('opening the rest of the preserve lights the whole trail', async ({ page }) => {
	// The client half of the progression story: the server's unlock chain is
	// walked in tests/integration/progression-chain.test.ts, but nothing proved
	// the map, the travel UI and the save file agree once it has been.
	await newSolo(page, DEV_SAVE);

	await openDevPanel(page);
	await page.getByRole('button', { name: 'Unlock all biomes' }).click();
	await page.keyboard.press('Escape');

	await page.keyboard.press('m');
	await expect(page.locator('.pm-stop')).toHaveCount(6);
	await expect(page.locator('.pm-stop.pm-locked')).toHaveCount(0);
	// Every trail segment between stops reads as open too.
	await expect(page.locator('.pm-link-open')).toHaveCount(5);
});

test('a restored area survives a reload', async ({ page }) => {
	// Solo saves live in localStorage; a save that does not reload is the worst
	// bug this game can have, and the one players report as "it forgot me".
	await newSolo(page, DEV_SAVE);

	await openDevPanel(page);
	await page.getByRole('button', { name: 'Unlock all biomes' }).click();
	await page.getByRole('button', { name: /Welcome all animals to meadow/ }).click();
	await page.keyboard.press('Escape');

	await page.goto('/');
	await page.getByRole('button', { name: new RegExp(`Continue as ${DEV_SAVE}`) }).click();
	await expect(page.locator('.game-screen')).toBeVisible({ timeout: 30_000 });

	await page.keyboard.press('m');
	await expect(page.locator('.pm-stop.pm-locked')).toHaveCount(0);
	// The meadow's stop now reports its animals home rather than a locked pip.
	await expect(page.locator('.pm-stop').first()).toContainText('25');
});

test('the journal fills in as animals come home', async ({ page }) => {
	await newSolo(page, DEV_SAVE);

	// The field guide lists every animal of the biome you're standing in from the
	// start — the ones you haven't met are silhouettes, so the page reads as a
	// guide with blanks to fill rather than an empty book.
	await page.keyboard.press('j');
	await expect(openPanelTitle(page)).toContainText('(0/25)');
	await expect(page.locator('.journal-entry')).toHaveCount(25);
	await expect(page.locator('.journal-entry.entry-unknown')).toHaveCount(25);
	await closePanel(page);

	await openDevPanel(page);
	await page.getByRole('button', { name: /Welcome all animals to meadow/ }).click();
	await page.keyboard.press('Escape');

	// Every silhouette has resolved into a real entry you can open.
	await page.keyboard.press('j');
	await expect(openPanelTitle(page)).toContainText('(25/25)');
	await expect(page.locator('.journal-entry.entry-link')).toHaveCount(25);
	await expect(page.locator('.journal-entry.entry-unknown')).toHaveCount(0);
});

test('the achievements panel renders the catalogue against a fresh save', async ({ page }) => {
	// Scope note: this covers the PANEL, not the awarding. Dev tools rebuild the
	// world without ever calling awardAchievements() — only real endpoints do —
	// so a dev-populated save legitimately shows nothing earned. That badges are
	// actually granted is proved server-side, on the real chain, by
	// tests/integration/progression-chain.test.ts.
	await newSolo(page, 'Badge Collector');

	await page.keyboard.press('k');
	await expect(openPanelTitle(page)).toContainText('Achievements');

	const cards = page.locator('.ach-card');
	await expect(cards.first()).toBeVisible();
	// A brand-new caretaker has earned none of them, and every card in the tab
	// says so — a card with neither class means the earned/locked split broke.
	const count = await cards.count();
	await expect(page.locator('.ach-card.locked')).toHaveCount(count);
	await expect(page.locator('.ach-card.earned')).toHaveCount(0);
	await expect(page.locator('.ach-progress')).toBeVisible();
});

// ------------------------------------------------------------------ stability

test('no unhandled client errors during a normal session', async ({ page }) => {
	// ErrorBoundary exists because panels used to throw in the wild. An uncaught
	// exception is that same failure caught before release.
	//
	// Only `pageerror` is collected, deliberately. Console errors in a headless
	// CI browser also carry noise the game does not control (WebGL/driver
	// warnings, blocked requests), and a stability test that cries wolf gets
	// muted — which costs more than it catches.
	const crashes: string[] = [];
	page.on('pageerror', (e) => crashes.push(String(e)));

	await newSolo(page, 'Quiet Runner');
	for (const panel of PANELS) {
		await page.keyboard.press(panel.key);
		await expect(openPanelTitle(page)).toContainText(panel.title);
		await closePanel(page);
	}
	// Walk a little: movement drives the Phaser scene, which is where the
	// silent failures used to be.
	for (const key of ['w', 'a', 's', 'd']) {
		await page.keyboard.down(key);
		await page.waitForTimeout(120);
		await page.keyboard.up(key);
	}

	expect(crashes).toEqual([]);
});
