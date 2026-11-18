import { test, expect, type Page } from '@playwright/test';

// Controller play, end to end. Chromium only exposes real gamepads, so this
// installs a fake one before any script runs: navigator.getGamepads() returns a
// standard-mapping pad whose buttons and sticks the test sets directly — the same
// shape a Steam Deck (through Steam Input) or an Xbox pad hands the game. The
// app is flagged "desktop" like solo.spec.ts, so it plays offline with no backend.
//
// What this guards: that a player with only a controller can get from the title
// screen into the meadow, type a name, walk, use the face buttons and the menu
// cycle — and that a player with only a keyboard and mouse sees none of it.

const A = 0,
	B = 1,
	X = 2,
	Y = 3,
	LB = 4,
	RB = 5,
	MENU = 9,
	DOWN = 13;

async function installPad(page: Page, opts: { steamDeck?: boolean } = {}) {
	await page.addInitScript((deck: boolean) => {
		(window as any).wildWillowsDesktop = { isDesktop: true, isSteamDeck: deck };
		const pad = {
			id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)',
			index: 0,
			connected: true,
			mapping: 'standard',
			timestamp: 0,
			buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
			axes: [0, 0, 0, 0],
		};
		(window as any).__pad = pad;
		(window as any).__padOn = false;
		navigator.getGamepads = () => ((window as any).__padOn ? [pad as any, null, null, null] : [null, null, null, null]);
	}, !!opts.steamDeck);
}

/** Plug the pad in, the way a browser announces one on its first button press. */
async function connect(page: Page) {
	await page.evaluate(() => {
		(window as any).__padOn = true;
		const e: any = new Event('gamepadconnected');
		e.gamepad = (window as any).__pad;
		window.dispatchEvent(e);
	});
}

/** Press and release one button, long enough for the per-frame poll to see both. */
async function press(page: Page, button: number) {
	await page.evaluate((i) => {
		(window as any).__pad.buttons[i] = { pressed: true, touched: true, value: 1 };
	}, button);
	await page.waitForTimeout(150);
	await page.evaluate((i) => {
		(window as any).__pad.buttons[i] = { pressed: false, touched: false, value: 0 };
	}, button);
	await page.waitForTimeout(150);
}

async function stick(page: Page, axes: [number, number, number, number], ms: number) {
	await page.evaluate((a) => ((window as any).__pad.axes = a), axes);
	await page.waitForTimeout(ms);
	await page.evaluate(() => ((window as any).__pad.axes = [0, 0, 0, 0]));
	await page.waitForTimeout(150);
}

const ring = (page: Page) => page.locator('[data-pad-focus]');

/** Title screen → named caretaker in the meadow, using only the controller. */
async function enterWithPad(page: Page) {
	await page.goto('/');
	await expect(page.getByRole('button', { name: 'New Game' })).toBeEnabled();
	await connect(page);
	// Picking up the controller puts the selection ring on the screen's main
	// button before anything is pressed, so the first A presses it.
	await expect(ring(page)).toHaveText(/New Game/);
	await press(page, A);
	await expect(page.getByPlaceholder('Caretaker name')).toBeVisible();

	// A on the name box opens the game's own keyboard; A types the key under the
	// ring (Q, capitalized for a name), Menu finishes.
	await expect(ring(page)).toHaveAttribute('placeholder', 'Caretaker name');
	await press(page, A);
	await expect(page.locator('.osk')).toBeVisible();
	await press(page, A);
	await press(page, A);
	await press(page, MENU);
	await expect(page.locator('.osk')).toHaveCount(0);
	await expect(page.getByPlaceholder('Caretaker name')).toHaveValue('Qq');

	// Down through the character options to Begin restoring.
	const begin = page.getByRole('button', { name: 'Begin restoring' });
	for (let i = 0; i < 30; i++) {
		if (await begin.evaluate((el) => el.hasAttribute('data-pad-focus'))) break;
		const onBack = await page
			.getByRole('button', { name: 'Back' })
			.evaluate((el) => el.hasAttribute('data-pad-focus'))
			.catch(() => false);
		await press(page, onBack ? 15 /* right */ : DOWN);
	}
	await expect(begin).toHaveAttribute('data-pad-focus', '');
	await press(page, A);
	await expect(page.locator('.game-screen')).toBeVisible({ timeout: 30_000 });
}

test.describe('controller', () => {
	test.beforeEach(async ({ page }) => installPad(page));

	test('title screen to the meadow with only a controller', async ({ page }) => {
		await enterWithPad(page);
		// Controller prompts, not keyboard ones.
		await expect(page.locator('.tutorial-card')).toContainText('left stick');
		await expect(page.locator('.nav-key')).toHaveCount(0);
	});

	test('walking, tools, and the menus', async ({ page }) => {
		await enterWithPad(page);
		await page.getByRole('button', { name: 'Skip tutorial' }).click();

		// The left stick walks: the caretaker steps off the spawn point, which
		// puts something new in reach (the prompt changes from the chest).
		await stick(page, [0, 1, 0, 0], 700);

		// L1/R1 change tools out in the world.
		const tool = page.locator('.tool-slot.on');
		await expect(tool).toHaveAttribute('aria-label', /Basket/);
		await press(page, RB);
		await expect(tool).toHaveAttribute('aria-label', /Shovel/);
		await expect(page.locator('.prompt-line')).toContainText('Dig here');
		await press(page, LB);
		await expect(tool).toHaveAttribute('aria-label', /Basket/);

		// Y opens the journal; inside a menu L1/R1 step through the others and the
		// tab bar names where you are; B closes (a tip banner may take one press).
		await press(page, Y);
		await expect(page.locator('.menu-tab.on')).toHaveAttribute('aria-label', 'Field journal');
		await press(page, RB);
		await expect(page.locator('.menu-tab.on')).toHaveAttribute('aria-label', 'Progress');
		await press(page, X);
		await expect(page.locator('.menu-tab.on')).toHaveAttribute('aria-label', 'Crafting');
		for (let i = 0; i < 3 && (await page.locator('.panel').count()); i++) await press(page, B);
		await expect(page.locator('.panel')).toHaveCount(0);

		// Menu opens Tools & Upgrades.
		await press(page, MENU);
		await expect(page.locator('.menu-tab.on')).toHaveAttribute('aria-label', /Tool upgrades/);
		await press(page, MENU);
		await expect(page.locator('.panel')).toHaveCount(0);
	});

	test('a dropdown changes only when picked with A', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByRole('button', { name: 'New Game' })).toBeEnabled();
		await connect(page);
		await expect(ring(page)).toHaveText(/New Game/);
		// New Game → Load Game → How to Play → Settings
		await press(page, DOWN);
		await press(page, DOWN);
		await press(page, 15);
		await expect(ring(page)).toHaveText(/Settings/);
		await press(page, A);
		const select = page.locator('select[aria-label="Colorblind mode"]');
		for (let i = 0; i < 30; i++) {
			if (await select.evaluate((el) => el.hasAttribute('data-pad-focus'))) break;
			await press(page, DOWN);
		}
		await expect(select).toHaveAttribute('data-pad-focus', '');
		// Pushing past it changes nothing…
		await press(page, 15);
		await press(page, 14);
		await expect(select).toHaveValue('off');
		// …A opens the list, and A on an option picks it.
		await press(page, A);
		await expect(page.locator('.sp-card')).toBeVisible();
		await press(page, DOWN);
		await press(page, A);
		await expect(page.locator('.sp-card')).toHaveCount(0);
		await expect(select).toHaveValue('redgreen');
	});
});

test.describe('keyboard and mouse', () => {
	test.beforeEach(async ({ page }) => installPad(page));

	test('no controller in use: no ring, keyboard prompts, native fields', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('button', { name: 'New Game' }).click();
		await page.getByPlaceholder('Caretaker name').fill('Keyboard Kit');
		await expect(page.locator('.osk')).toHaveCount(0);
		await page.getByRole('button', { name: 'Begin restoring' }).click();
		await expect(page.locator('.game-screen')).toBeVisible({ timeout: 30_000 });
		await page.getByRole('button', { name: 'Skip tutorial' }).click();
		await expect(ring(page)).toHaveCount(0);
		await expect(page.locator('.tool-key').first()).toHaveText('1');
		await page.keyboard.press('j');
		await expect(page.locator('.panel-head h2')).toContainText('Field Guide');
		await expect(page.locator('.menu-tabs')).toHaveCount(0);
	});
});
