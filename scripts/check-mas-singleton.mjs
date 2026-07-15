#!/usr/bin/env node
/**
 * CI guard against the "App Store app bounces on launch" regression.
 *
 * In the sandboxed Mac App Store build, Electron's single-instance lock
 * (app.requestSingleInstanceLock()) tries to bind() a Unix domain socket in
 * $TMPDIR. The App Sandbox denies that bind() on some macOS versions (confirmed
 * on Ventura 13.7), so the lock reports "not acquired" and electron/main.js then
 * calls app.quit()/process.exit(0) — a SILENT bounce-on-launch (exit 0, no crash
 * report) for every affected App Store user. It only works on newer macOS where
 * the app-group container path is used instead, which is why it slips past
 * developer testing.
 *
 * The fix is to guard the call with `process.mas` (true only in Mac App Store
 * builds) so the sandboxed build never touches the socket. This check fails the
 * build if that guard is ever removed.
 *
 * Why a static check and not a real launch test: a signed MAS build fails
 * receipt validation (exit 173) anywhere outside the App Store, and GitHub's
 * macOS runners are too new to reproduce the Ventura sandbox behavior — so
 * literally launching the packaged binary in CI cannot catch this. Asserting the
 * guard in source is deterministic and runner-OS independent.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const mainPath = join(root, 'electron', 'main.js');

const src = readFileSync(mainPath, 'utf8');
const lines = src.split('\n');

const callLines = lines
	.map((line, i) => ({ line, n: i + 1 }))
	.filter(({ line }) => line.includes('requestSingleInstanceLock') && !line.trimStart().startsWith('//'));

if (callLines.length === 0) {
	console.error('✖ check-mas-singleton: no requestSingleInstanceLock() call found in electron/main.js.');
	console.error('  If the single-instance lock was removed on purpose, delete or update this check.');
	process.exit(1);
}

let failed = false;
for (const { line, n } of callLines) {
	if (!line.includes('process.mas')) {
		console.error(
			`✖ check-mas-singleton: electron/main.js:${n} calls requestSingleInstanceLock() without a \`process.mas\` guard.`,
		);
		console.error(`    ${line.trim()}`);
		console.error('  In the sandboxed Mac App Store build this silently quits the app on launch.');
		console.error('  Guard it, e.g.:  if (!process.mas && !app.requestSingleInstanceLock()) { ... }');
		failed = true;
	}
}

if (failed) process.exit(1);
console.log('✓ check-mas-singleton: single-instance lock is guarded against the MAS sandbox.');
