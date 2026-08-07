import { test, expect } from '@playwright/test';

// Regression test for the cursor flickering on the edge of a button.
//
// `button:hover:not(:disabled)` lifts the button 1px (`transform: translateY(-1px)`).
// With the pointer resting inside that last 1px of the button's BOTTOM edge, the
// lift slid the button out from under the pointer: it un-hovered, the transform
// was dropped, it dropped back onto the pointer, and it hovered again — a
// hit-test feedback loop running at frame rate. A 60fps screen capture of the
// title screen showed the button's bottom border and the cursor icon alternating
// on every single frame.
//
// The fix (src/styles.css) is a hover-only pad that holds the hit area still
// across the lift. These tests pin the behaviour that pad exists to guarantee.

test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => {
		(window as any).wildWillowsDesktop = { isDesktop: true };
	});
	await page.goto('/');
});

/** The element actually under the pointer, as the browser's own hit-test sees it. */
const topmostAt = (page: import('@playwright/test').Page, x: number, y: number) =>
	page.evaluate(
		([px, py]) => {
			const el = document.elementFromPoint(px as number, py as number);
			return el?.closest('button') ? 'button' : (el?.tagName.toLowerCase() ?? 'none');
		},
		[x, y],
	);

test('hover stays latched when the pointer rests on a button edge', async ({ page }) => {
	const btn = page.getByRole('button', { name: 'New Game' });
	await expect(btn).toBeEnabled();

	const box = (await btn.boundingBox())!;
	const x = box.x + box.width / 2;
	// Half a pixel inside the bottom edge — the strip the lift used to vacate.
	const yEdge = box.y + box.height - 0.5;

	await page.mouse.move(x, yEdge);
	await expect(btn).toBeVisible();

	// Sample repeatedly WITHOUT moving the mouse. Before the fix the button
	// oscillated under a stationary pointer, so these samples disagreed.
	const samples: string[] = [];
	for (let i = 0; i < 30; i++) {
		samples.push(await topmostAt(page, x, yEdge));
		await page.waitForTimeout(16); // ~one frame
	}
	expect(new Set(samples)).toEqual(new Set(['button']));
});

test('the button does not oscillate under a stationary pointer', async ({ page }) => {
	const btn = page.getByRole('button', { name: 'New Game' });
	await expect(btn).toBeEnabled();

	const box = (await btn.boundingBox())!;
	const x = box.x + box.width / 2;
	await page.mouse.move(x, box.y + box.height - 0.5);
	await page.waitForTimeout(150); // let the 0.08s transform transition settle

	// With hover latched the button holds its lifted position; the flicker showed
	// up as this value moving every frame.
	const tops: number[] = [];
	for (let i = 0; i < 20; i++) {
		tops.push(Math.round(((await btn.boundingBox())?.y ?? 0) * 100));
		await page.waitForTimeout(16);
	}
	expect(new Set(tops).size).toBe(1);
});

test('the pointer cursor does not flicker back to default on the edge', async ({ page }) => {
	const btn = page.getByRole('button', { name: 'New Game' });
	await expect(btn).toBeEnabled();

	const box = (await btn.boundingBox())!;
	const x = box.x + box.width / 2;
	const yEdge = box.y + box.height - 0.5;
	await page.mouse.move(x, yEdge);

	const cursors: string[] = [];
	for (let i = 0; i < 25; i++) {
		cursors.push(
			await page.evaluate(
				([px, py]) => {
					const el = document.elementFromPoint(px as number, py as number);
					return el ? getComputedStyle(el).cursor : 'none';
				},
				[x, yEdge],
			),
		);
		await page.waitForTimeout(16);
	}
	// Every sample must be `pointer`; the bug alternated pointer/default.
	expect([...new Set(cursors)]).toEqual(['pointer']);
});

test('the resting hit area is unchanged — the pad only exists while hovered', async ({ page }) => {
	const btn = page.getByRole('button', { name: 'New Game' });
	await expect(btn).toBeEnabled();
	const box = (await btn.boundingBox())!;
	const x = box.x + box.width / 2;

	// Park the pointer far away so nothing is hovered, then probe just below the
	// button. If the pad were always-on it would swallow this point.
	await page.mouse.move(5, 5);
	await page.waitForTimeout(120);
	expect(await topmostAt(page, x, box.y + box.height + 2)).not.toBe('button');
});

test('moving clearly away still releases hover', async ({ page }) => {
	const btn = page.getByRole('button', { name: 'New Game' });
	await expect(btn).toBeEnabled();
	const box = (await btn.boundingBox())!;
	const x = box.x + box.width / 2;

	await page.mouse.move(x, box.y + box.height - 0.5);
	await page.waitForTimeout(120);
	await page.mouse.move(x, box.y + box.height + 8); // past the pad
	await page.waitForTimeout(120);

	expect(await topmostAt(page, x, box.y + box.height + 8)).not.toBe('button');
});
