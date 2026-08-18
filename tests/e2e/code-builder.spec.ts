import { test, expect, type Page } from '@playwright/test';

// /learn/code-builder in a real browser.
//
// Every assertion here corresponds to something that actually broke, and that
// unit tests could not have caught, because they were all about what the browser
// does with the document rather than what bytes are in it:
//
//   • the reporting harness failed to parse, so nothing was ever reported;
//   • a syntax error in the student's own code took the harness down with it,
//     so the only sign of trouble was a message in devtools;
//   • error line numbers were relative to our generated document, so a mistake
//     on line 3 of a twelve-line file was reported as "line 103";
//   • the file tabs did nothing, because `hidden` loses to `display: flex`.
//
// The pattern throughout: type into a file, wait for the preview to settle, then
// assert on what a student would actually see.

const FILES = { html: 'index.html', css: 'styles.css', js: 'main.js' };

/** Replace one file's contents the way a student would: select all, then type. */
async function setFile(page: Page, name: string, code: string) {
	await page.getByRole('tab', { name, exact: true }).click();
	const area = page.locator('textarea.wwr-code:visible');
	await area.click();
	await area.press('ControlOrMeta+a');
	await area.fill(code);
	// The preview is debounced (~400ms) and then swaps on load.
	await page.waitForTimeout(1200);
}

const errorPanel = (page: Page) => page.locator('.wwr-error:not([hidden])');
const consoleLines = (page: Page) => page.locator('.wwr-console-lines');

test.beforeEach(async ({ page }) => {
	// Each test starts from the shipped starter project, not the previous test's
	// leftovers — the builder autosaves to localStorage.
	await page.addInitScript(() => window.localStorage.clear());
	await page.goto('/learn/code-builder');
	await expect(page.locator('ww-runner')).toBeVisible();
});

test.describe('the preview document', () => {
	test('renders the student page and reports nothing when the code is fine', async ({ page }) => {
		await setFile(page, FILES.js, 'document.body.innerHTML = "<h1>fine</h1>";');
		await expect(errorPanel(page)).toHaveCount(0);
		const frame = page.frameLocator('iframe.wwr-preview.is-live');
		await expect(frame.locator('h1')).toHaveText('fine');
	});

	test('keeps two preview buffers, one of them live', async ({ page }) => {
		// Single-buffering meant the frame painted white on every re-render, which
		// read as the page flickering while you typed.
		await expect(page.locator('iframe.wwr-preview')).toHaveCount(2);
		await expect(page.locator('iframe.wwr-preview.is-live')).toHaveCount(1);
	});
});

test.describe('errors reach the student, not just devtools', () => {
	test('explains a syntax error in plain language', async ({ page }) => {
		// A parse error discards the whole script block. When the harness shared
		// that block, it died too and nothing was ever reported.
		await setFile(page, FILES.js, 'loadGameData();\n\nvar');
		await expect(errorPanel(page)).toContainText('Something was left open');
		await expect(errorPanel(page)).toContainText('missing } or )');
	});

	test('reports the line in the student’s own file', async ({ page }) => {
		await setFile(page, FILES.js, '// one\n// two\n// three\n// four\nnopeNotHere();');
		await expect(errorPanel(page)).toContainText('line 5');
	});

	test('never reports a line past the end of the file', async ({ page }) => {
		// An end-of-input error is reported at the line AFTER the last one, which
		// is correct and useless: "line 4" in a three-line file reads as broken.
		await setFile(page, FILES.js, 'const x = {\n  a: 1,\n');
		const text = await errorPanel(page).innerText();
		const m = /line (\d+)/.exec(text);
		if (m) expect(Number(m[1])).toBeLessThanOrEqual(3);
	});

	test('never shows Safari’s useless "Script error."', async ({ page }) => {
		// The preview runs in a sandboxed, opaque-origin frame, and Safari refuses
		// to describe a script error in one to a cross-origin listener: window.onerror
		// gets the literal string "Script error." with no message, file or line.
		// Chrome hands over the real thing, which is exactly why this survived a
		// browser test — one engine was being helpful.
		//
		// The host parses the code itself, where there is no origin barrier, so the
		// message is real in both. This assertion is the guard.
		for (const broken of ['var', 'function go() {\n  console.log("x");', 'const s = "unclosed;']) {
			await setFile(page, FILES.js, broken);
			await expect(errorPanel(page)).not.toContainText('Script error');
			await expect(consoleLines(page)).not.toContainText('Script error');
			await expect(consoleLines(page)).toContainText(/line \d+/);
		}
	});

	test('names the mistake, not the machinery', async ({ page }) => {
		// new Function wraps the code in a synthetic function, so an unterminated
		// file makes the parser trip on the WRAPPER's closing brace — blaming a
		// character the student never typed and cannot find anywhere in their file.
		await setFile(page, FILES.js, 'const a = 1;\nconst b = 2;\nvar');
		await expect(consoleLines(page)).toContainText('Unexpected end of input');
		await expect(consoleLines(page)).toContainText('line 3');
	});

	test('reports one message per failure, not two', async ({ page }) => {
		// Both the host and the frame notice the same broken file.
		await setFile(page, FILES.js, 'var');
		await expect(page.locator('.wwr-console-line')).toHaveCount(1);
	});

	test('explains a missing element rather than printing null', async ({ page }) => {
		await setFile(page, FILES.js, 'document.querySelector("#nothing").textContent = "x";');
		await expect(errorPanel(page)).toContainText('That element is not on the page');
	});

	test('clears the error once the code is fixed', async ({ page }) => {
		await setFile(page, FILES.js, 'oops(');
		await expect(errorPanel(page)).toHaveCount(1);
		await setFile(page, FILES.js, 'console.log("ok");');
		await expect(errorPanel(page)).toHaveCount(0);
	});
});

test.describe('the console', () => {
	test('shows what the student logged', async ({ page }) => {
		await setFile(page, FILES.js, 'console.log("hello from the student");');
		await expect(consoleLines(page)).toContainText('hello from the student');
	});

	test('summarises a long array instead of printing all of it', async ({ page }) => {
		// Chapter 4 says console.log(data). Serialising 150 records in full is what
		// made the console look broken — the browser was busy, not idle.
		await setFile(page, FILES.js, 'console.log(Array.from({length: 150}, (_, i) => ({ n: i })));');
		await expect(consoleLines(page)).toContainText('Array(150)');
		await expect(consoleLines(page)).toContainText('more');
	});

	test('caps a single enormous value', async ({ page }) => {
		await setFile(page, FILES.js, 'console.log("x".repeat(50000));');
		await expect(consoleLines(page)).toContainText('more characters');
	});

	test('shows errors too, the way every other console does', async ({ page }) => {
		// The case that made this feel broken: a syntax error means NONE of the
		// student's code ran, so nothing they logged appears and the pane sits empty
		// with no explanation. An error that shows only in a separate panel reads as
		// the console itself being broken.
		await setFile(page, FILES.js, 'loadGameData();\n\nvar');
		await expect(consoleLines(page)).toContainText('SyntaxError');
		await expect(consoleLines(page)).toContainText('line 3');
	});

	test('keeps the logs that ran before the error', async ({ page }) => {
		await setFile(page, FILES.js, 'console.log("before");\nnopeNotHere();');
		await expect(consoleLines(page)).toContainText('before');
		await expect(consoleLines(page)).toContainText('ReferenceError');
	});

	test('says so when there is genuinely nothing to show', async ({ page }) => {
		// Empty is ambiguous: it looks identical whether nothing was logged, the
		// code never ran, or the pane is broken.
		await setFile(page, FILES.js, 'var a = 1;');
		await expect(consoleLines(page)).toBeEmpty();
		const hint = await consoleLines(page).evaluate((el) => getComputedStyle(el, '::before').content);
		expect(hint).toContain('Nothing logged yet');
	});

	test('resizes from the keyboard and folds away', async ({ page }) => {
		const box = page.locator('.wwr-console');
		const head = page.locator('.wwr-console-head');
		const before = (await box.boundingBox())!.height;
		await head.focus();
		await head.press('ArrowUp');
		await head.press('ArrowUp');
		expect((await box.boundingBox())!.height).toBeGreaterThan(before);

		await page.locator('.wwr-fold').click();
		await expect(box).toHaveClass(/is-collapsed/);
		await expect(page.locator('.wwr-console-lines')).toBeHidden();
	});
});

test.describe('the editor', () => {
	test('switches files when a tab is clicked', async ({ page }) => {
		// `hidden` is display:none only in the UA stylesheet, so .wwr-editor's
		// display:flex outranked it and every pane stayed on screen at once.
		await page.getByRole('tab', { name: FILES.css, exact: true }).click();
		await expect(page.locator('textarea.wwr-code:visible')).toHaveCount(1);
		await expect(page.locator('textarea.wwr-code:visible')).toHaveValue(/font-family|body/);
	});

	test('indents with Tab without destroying undo', async ({ page }) => {
		// Assigning .value wipes the browser's undo history, so Cmd/Ctrl+Z stopped
		// working the first time a student pressed Tab.
		await page.getByRole('tab', { name: FILES.js, exact: true }).click();
		const area = page.locator('textarea.wwr-code:visible');
		await area.click();
		await area.press('ControlOrMeta+a');
		await area.fill('const a = 1;');
		await area.press('End');
		await area.press('Tab');
		await expect(area).toHaveValue('const a = 1;  ');
		await area.press('ControlOrMeta+z');
		await expect(area).toHaveValue('const a = 1;');
	});

	test('scrolls a long file instead of growing the panel', async ({ page }) => {
		// The line-number gutter is one line per row, so its intrinsic height is the
		// length of the file — which used to push the whole card open and shove the
		// console out of it.
		const card = page.locator('ww-runner');
		const before = (await card.boundingBox())!.height;
		await setFile(page, FILES.js, Array.from({ length: 120 }, (_, i) => `// line ${i}`).join('\n'));
		expect((await card.boundingBox())!.height).toBeCloseTo(before, 0);
		const area = page.locator('textarea.wwr-code:visible');
		expect(await area.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
	});
});

test.describe('view modes', () => {
	test('splits, then shows one side at a time', async ({ page }) => {
		const host = page.locator('ww-runner');
		await expect(host).toHaveClass(/wwr--view-split/);

		await page.getByRole('button', { name: 'Show code' }).click();
		await expect(host).toHaveClass(/wwr--view-code/);
		await expect(page.locator('.wwr-out')).toBeHidden();

		await page.getByRole('button', { name: 'Show page' }).click();
		await expect(page.locator('.wwr-panes')).toBeHidden();
		await expect(page.locator('.wwr-out')).toBeVisible();
	});
});

test.describe('the data the whole lesson depends on', () => {
	test('the student’s own fetch reaches the API and renders', async ({ page }) => {
		// The sandboxed preview has an opaque origin, so this only works because
		// /GameData/ sends Access-Control-Allow-Origin. If that header is ever
		// dropped, this is the test that says so.
		await setFile(page, FILES.html, '<ul id="list"></ul>');
		await setFile(
			page,
			FILES.js,
			[
				'async function load() {',
				'  const r = await fetch("https://wildwillows.app/GameData/");',
				'  const data = await r.json();',
				'  document.querySelector("#list").innerHTML = data.animals',
				'    .filter(a => a.biome === "meadow")',
				'    .map(a => `<li>${a.name}</li>`)',
				'    .join("");',
				'}',
				'load();',
			].join('\n'),
		);
		const frame = page.frameLocator('iframe.wwr-preview.is-live');
		await expect(frame.locator('#list li')).toHaveCount(25);
	});
});

test.describe('layout', () => {
	test('the nav lines up with the toolbar under it', async ({ page }) => {
		// site-core wraps the nav in a centred, max-width container because on the
		// marketing pages it sits above centred prose. This page is a tool: the bar
		// below, the sidebar and the editor all run to the window edges, so a centred
		// nav left the brand indented from "Code Builder" and the two rows' buttons
		// visibly out of step.
		const brand = (await page.locator('.nav .brand').boundingBox())!;
		const title = (await page.locator('.lab-bar h1').boundingBox())!;
		expect(Math.abs(brand.x - title.x)).toBeLessThanOrEqual(1);

		const toggle = (await page.locator('.theme-toggle').boundingBox())!;
		const lastBtn = (await page.locator('#lab-reset').boundingBox())!;
		expect(Math.abs(toggle.x + toggle.width - (lastBtn.x + lastBtn.width))).toBeLessThanOrEqual(1);
	});
});

test.describe('a screen too small for this page', () => {
	// The lesson works on a phone, editors and all. This page is the opposite
	// shape: three files, a preview and a console on screen together, meant to be
	// typed into for a whole period. Shipping a squeezed version of that is a
	// period spent fighting a soft keyboard, so it says so and links to the thing
	// that does work.
	test.use({ viewport: { width: 390, height: 844 } });

	test('shows the explanation instead of the workspace', async ({ page }) => {
		await page.goto('/learn/code-builder');
		await expect(page.locator('#lab-blocked')).toBeVisible();
		await expect(page.locator('.lab-main')).toBeHidden();
		await expect(page.locator('.lab-bar')).toBeHidden();
	});

	test('never boots the editor or its preview frames', async ({ page }) => {
		await page.goto('/learn/code-builder');
		await expect(page.locator('#lab-blocked')).toBeVisible();
		await expect(page.locator('ww-runner.wwr')).toHaveCount(0);
		await expect(page.locator('iframe')).toHaveCount(0);
	});

	test('offers the lesson, which does work here', async ({ page }) => {
		await page.goto('/learn/code-builder');
		await page.getByRole('link', { name: 'Read the Lesson instead' }).click();
		await expect(page).toHaveURL(/\/learn\/web-development$/);
		// …and it really is usable at this size: an editor a student can type in.
		await expect(page.locator('#chapter-1 ww-runner.wwr')).toBeVisible();
		const area = page.locator('#chapter-1 ww-runner textarea.wwr-code').first();
		expect(await area.evaluate((el: HTMLTextAreaElement) => el.readOnly)).toBe(false);
	});
});

test.describe('"Show me" shows the answer without taking their work', () => {
	// The old version pasted the worked code over the student's files behind a
	// confirm(). Someone stuck enough to press it lost what they had, and lost the
	// thing they were comparing against at the same moment.
	const answer = (page: Page, n: number) => page.locator('.cp-code').nth(n);

	test('reveals the code beside their own and leaves the editor alone', async ({ page }) => {
		await page.getByRole('tab', { name: FILES.js, exact: true }).click();
		const area = page.locator('textarea.wwr-code:visible');
		await area.click();
		await area.press('ControlOrMeta+a');
		await area.fill('// my own work');
		await page.waitForTimeout(600);

		await expect(answer(page, 2)).toBeHidden();
		await page.locator('.cp-show').nth(2).click();
		await expect(answer(page, 2)).toBeVisible();
		await expect(answer(page, 2).locator('.cp-pre')).toContainText('loadGameData');

		// The point of the whole change.
		await expect(page.locator('textarea.wwr-code:visible')).toHaveValue('// my own work');
		await expect(page.locator('.cp.is-done')).toHaveCount(0);
	});

	test('every file in the answer gets its own header and Copy', async ({ page }) => {
		// Checkpoint 5 changes two files. One Copy for both would put HTML into
		// main.js.
		const multi = page.locator('.cp').nth(4);
		await multi.locator('.cp-show').click();
		const box = multi.locator('.cp-code');
		await expect(box.locator('.cp-code-name')).toHaveText(['index.html', 'main.js']);
		await expect(box.locator('.cp-copy')).toHaveCount(2);
	});

	test('toggles shut, and is not still open next time', async ({ page }) => {
		const show = page.locator('.cp-show').nth(2);
		await show.click();
		await expect(show).toHaveText('Hide');
		await expect(show).toHaveAttribute('aria-expanded', 'true');
		await show.click();
		await expect(show).toHaveText('Show me');
		await expect(answer(page, 2)).toBeHidden();

		await show.click();
		await page.waitForTimeout(700); // the autosave is debounced
		await page.reload();
		await expect(page.locator('.cp-code:not([hidden])')).toHaveCount(0);
	});

	test('widens the column while it is showing, and gives it back', async ({ page }) => {
		// 280px wraps `await fetch("https://wildwillows.app/GameData/")` into four
		// lines that stop looking like code.
		const side = page.locator('.lab-side');
		const before = (await side.boundingBox())!.width;
		await page.locator('.cp-show').nth(2).click();
		await page.waitForTimeout(400);
		expect((await side.boundingBox())!.width).toBeGreaterThan(before + 60);
		await page.locator('.cp-show').nth(2).click();
		await page.waitForTimeout(400);
		expect((await side.boundingBox())!.width).toBeCloseTo(before, 0);
	});
});

test.describe('the side panel collapses out of the way', () => {
	// The checkpoints and the help are reference: worth having open while you are
	// working out what to do next, and 280px of permanent tax once you know.
	test('gives the editor the whole window and comes back', async ({ page }) => {
		const toggle = page.locator('#lab-side-toggle');
		const side = page.locator('.lab-side');
		const stage = page.locator('.lab-stage');

		await expect(side).toBeVisible();
		await expect(toggle).toHaveAttribute('aria-expanded', 'true');
		const narrow = (await stage.boundingBox())!.width;

		await toggle.click();
		// All the way out, not narrower: a squeezed sidebar still takes room and is
		// no longer readable.
		await expect(side).toBeHidden();
		await expect(toggle).toHaveAttribute('aria-expanded', 'false');
		await expect(toggle).toContainText('Show panel');
		const wide = (await stage.boundingBox())!.width;
		expect(wide).toBeGreaterThan(narrow + 200);

		// The toggle is the one control that has to survive the panel vanishing,
		// and it has to still be where it was: a button that runs away when you
		// press it is one you have to find twice.
		await expect(toggle).toBeVisible();
		await toggle.click();
		await expect(side).toBeVisible();
		await expect(toggle).toContainText('Hide panel');
	});

	test('is a bubble on the seam, with no room for words', async ({ page }) => {
		// It carries a chevron and nothing else, so the only wording is the hidden
		// label — which must still be there, or the button announces bare.
		const toggle = page.locator('#lab-side-toggle');
		const box = (await toggle.boundingBox())!;
		expect(Math.abs(box.width - box.height)).toBeLessThan(2);
		expect(box.width).toBeLessThan(40);
		await expect(toggle).toHaveCSS('border-radius', '50%');

		const label = page.locator('.lab-side-toggle-text');
		expect((await label.boundingBox())!.width).toBeLessThan(3);
		await expect(label).toHaveText('Hide panel');

		// Clear of the editor in both states, or it sits on top of the code.
		const runner = page.locator('.lab-stage ww-runner');
		expect(box.x + box.width).toBeLessThanOrEqual((await runner.boundingBox())!.x);
		await toggle.click();
		const moved = (await toggle.boundingBox())!;
		expect(moved.x + moved.width).toBeLessThanOrEqual((await runner.boundingBox())!.x);
	});

	test('remembers the choice', async ({ page }) => {
		// Somebody who collapsed it did not mean "until I reload".
		await page.locator('#lab-side-toggle').click();
		await expect(page.locator('.lab-side')).toBeHidden();
		await page.waitForTimeout(700); // the autosave is debounced
		await page.reload();
		await expect(page.locator('.lab-side')).toBeHidden();
		await expect(page.locator('#lab-side-toggle')).toHaveAttribute('aria-expanded', 'false');
	});
});
