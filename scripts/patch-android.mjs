#!/usr/bin/env node
// Apply Wild Willows' ChromeOS + release-signing settings to the Capacitor
// Android project.
//
// WHY A SCRIPT AND NOT A COMMITTED android/ DIRECTORY:
// `npx cap add android` generates ~100 files from a template that changes with
// every Capacitor release. Regenerating it in CI and patching the handful of
// lines we actually care about keeps the diff reviewable and the upgrade path
// boring. If you later decide to commit android/ (Capacitor's own
// recommendation, and what you want once you start hand-editing native code),
// this script stays useful: every edit below is IDEMPOTENT, so re-running it on
// an already-patched tree is a no-op rather than a duplicate.
//
// Run after `npx cap add android` / `npx cap sync android`:
//     node scripts/patch-android.mjs

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const p = (...parts) => resolve(root, ...parts);

let changed = 0;
const log = (msg) => console.log(`  ${msg}`);

function edit(file, label, fn) {
	const path = p(file);
	if (!existsSync(path)) {
		console.error(`\n✗ Missing ${file} — run \`npx cap add android\` first.`);
		process.exit(1);
	}
	const before = readFileSync(path, 'utf8');
	const after = fn(before);
	if (after === before) {
		log(`· ${label} — already applied`);
		return;
	}
	writeFileSync(path, after);
	log(`✓ ${label}`);
	changed++;
}

console.log('\nPatching Capacitor Android project for ChromeOS + release signing…\n');

// ---------------------------------------------------------------- manifest
const MANIFEST = 'android/app/src/main/AndroidManifest.xml';

edit(MANIFEST, 'ChromeOS hardware features', (xml) => {
	if (xml.includes('android.hardware.touchscreen')) return xml;

	// THE most important lines in the whole Android setup. Google Play assumes an
	// app REQUIRES a touchscreen unless told otherwise, and Chromebooks without
	// touch screens are then filtered out of the listing entirely — the app simply
	// doesn't appear. Same story for the gamepad/telephony-adjacent features some
	// Play filters infer.
	const features = `
    <!-- Chromebooks: most have no touchscreen, and Play filters the listing on
         these unless they are explicitly optional. Removing any of these can
         make the app invisible on ChromeOS. -->
    <uses-feature android:name="android.hardware.touchscreen" android:required="false" />
    <uses-feature android:name="android.hardware.touchscreen.multitouch" android:required="false" />
    <uses-feature android:name="android.hardware.faketouch" android:required="false" />
`;
	return xml.replace(/(<manifest[^>]*>)/, `$1\n${features}`);
});

edit(MANIFEST, 'resizeable activity (ChromeOS windowing)', (xml) => {
	if (/android:resizeableActivity/.test(xml)) return xml;
	// ChromeOS users snap, half-tile and maximize constantly. Without this the
	// window is letterboxed and the Phaser canvas never gets a resize event.
	return xml.replace(/(<application\b)/, '$1\n        android:resizeableActivity="true"');
});

edit(MANIFEST, 'unlock orientation', (xml) =>
	// The game is landscape-shaped but must never LOCK orientation: on ChromeOS a
	// locked activity refuses to resize, which is worse than a slightly odd
	// portrait layout on the rare convertible in tablet mode.
	xml.replace(/\n\s*android:screenOrientation="[^"]*"/g, ''),
);

edit(MANIFEST, 'suppress ChromeOS back button', (xml) => {
	if (xml.includes('SuppressWindowControlNavigationButton')) return xml;
	// Wild Willows has no Android back-stack — it's one activity hosting a canvas.
	// The ChromeOS window-frame back button would therefore either do nothing or
	// kill the app mid-play. Hide it.
	const meta = `
            <meta-data
                android:name="WindowManagerPreference:SuppressWindowControlNavigationButton"
                android:value="true" />`;
	return xml.replace(/(<activity\b[^>]*>)/, `$1${meta}`);
});

// ---------------------------------------------------------------- sdk levels
edit('android/variables.gradle', 'SDK levels (min 30 / target 36)', (gradle) =>
	gradle
		// ChromeOS ARC runs a recent Android; 30 drops nothing that matters and
		// avoids a pile of legacy-storage compatibility shims.
		.replace(/minSdkVersion\s*=\s*\d+/, 'minSdkVersion = 30')
		// Google Play requires API 36 for new apps submitted from 31 Aug 2026.
		.replace(/compileSdkVersion\s*=\s*\d+/, 'compileSdkVersion = 36')
		.replace(/targetSdkVersion\s*=\s*\d+/, 'targetSdkVersion = 36'),
);

// ---------------------------------------------------------------- signing
edit('android/app/build.gradle', 'release signing config', (gradle) => {
	if (gradle.includes('wildWillowsRelease')) return gradle;

	// Reads the keystore from env vars so the same build.gradle works locally and
	// in CI with no secrets on disk. When the env vars are absent (a plain local
	// debug build) the release config is simply not wired up, and Gradle falls
	// back to debug signing instead of failing.
	const signing = `
    signingConfigs {
        wildWillowsRelease {
            def storeFilePath = System.getenv("ANDROID_KEYSTORE_PATH")
            if (storeFilePath) {
                storeFile file(storeFilePath)
                storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias System.getenv("ANDROID_KEY_ALIAS")
                keyPassword System.getenv("ANDROID_KEY_PASSWORD")
            }
        }
    }
`;
	let out = gradle.replace(/(android\s*\{)/, `$1\n${signing}`);

	// Attach it to the release buildType, only when a keystore was actually
	// provided — an unsigned release APK is still useful for a smoke test.
	out = out.replace(
		/(buildTypes\s*\{[\s\S]*?release\s*\{)/,
		`$1
            if (System.getenv("ANDROID_KEYSTORE_PATH")) {
                signingConfig signingConfigs.wildWillowsRelease
            }`,
	);
	return out;
});

console.log(
	changed === 0
		? '\nNothing to do — project already patched.\n'
		: `\nDone — ${changed} change${changed === 1 ? '' : 's'} applied.\n`,
);
