import { test, expect } from '@playwright/test';

// Solo offline E2E. We flag the app as "desktop" before any script runs, which
// flips the API transport to the in-app solo backend (GameData + all actions are
// served locally, saves go to localStorage). No Harper required.
test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => {
		(window as any).wildWillowsDesktop = { isDesktop: true };
	});
});

test('title screen loads', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'Wild Willows' })).toBeVisible();
	// Solo is the default mode; New Game becomes enabled once GameData loads.
	await expect(page.getByRole('button', { name: 'New Game' })).toBeEnabled();
});

test('create a solo character and enter the preserve', async ({ page }) => {
	await page.goto('/');

	await page.getByRole('button', { name: 'New Game' }).click();

	const nameField = page.getByPlaceholder('Caretaker name');
	await expect(nameField).toBeVisible();
	await nameField.fill('E2E Explorer');

	await page.getByRole('button', { name: 'Begin restoring' }).click();

	// Entering the world swaps the welcome card for the game screen (Phaser canvas + HUD).
	await expect(page.locator('.game-screen')).toBeVisible({ timeout: 30_000 });
	await expect(page.locator('canvas')).toBeVisible();
});

test('the solo save is remembered for "Continue"', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'New Game' }).click();
	await page.getByPlaceholder('Caretaker name').fill('Returning Rae');
	await page.getByRole('button', { name: 'Begin restoring' }).click();
	await expect(page.locator('.game-screen')).toBeVisible({ timeout: 30_000 });

	// Reload: the title screen should now offer to continue the just-made save.
	await page.goto('/');
	await expect(page.getByRole('button', { name: /Continue as Returning Rae/ })).toBeVisible();
});
