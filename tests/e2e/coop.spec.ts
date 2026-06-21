import { test, expect } from '@playwright/test';

// Live co-op E2E: the production web build served by a real Harper instance
// (https://localhost:9926 by default), exercising the hosted API end to end.
// CI boots Harper before this suite; locally: `npm run dev` in another terminal,
// then `COOP_E2E=1 npx playwright test --project=coop`.

const uniq = () => `E2E ${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

test('Harper serves the app and the static game data', async ({ page, request }) => {
	const res = await request.get('/GameData/', { headers: { Accept: 'application/json' } });
	expect(res.ok()).toBeTruthy();
	const data = await res.json();
	expect(data.biomes.length).toBeGreaterThan(0);
	expect(data.recipes.length).toBeGreaterThan(0);

	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'Wild Willows' })).toBeVisible();
});

test('create a player against the live backend and enter the world', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'New Game' }).click();

	await page.getByPlaceholder('Caretaker name').fill(uniq());
	await page.getByPlaceholder(/Passcode/).fill('passcode1');
	await page.getByRole('button', { name: 'Begin restoring' }).click();

	await expect(page.locator('.game-screen')).toBeVisible({ timeout: 30_000 });
	await expect(page.locator('canvas')).toBeVisible();
});

test('host a co-op preserve on the live backend', async ({ page }) => {
	await page.goto('/');

	await page.getByRole('button', { name: 'Co-op' }).click();
	await page.getByRole('button', { name: 'Host a New Preserve' }).click();

	await page.getByPlaceholder('Caretaker name').fill(uniq());
	await page.getByPlaceholder(/Passcode/).fill('passcode1');
	await page.getByRole('button', { name: 'Start co-op' }).click();

	// Hosting creates the shared world server-side and drops us into it.
	await expect(page.locator('.game-screen')).toBeVisible({ timeout: 30_000 });
});
