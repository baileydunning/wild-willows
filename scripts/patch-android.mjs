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

// Handle every configuration change the activity can survive IN PROCESS.
// Anything not listed here destroys and recreates the activity — which on this
// app means the WebView reloads, Phaser tears down the scene, and the player is
// dumped back at the title mid-session.
//
// Capacitor's template covers orientation/keyboard/screenSize/locale/uiMode. The
// three it omits are exactly the ChromeOS ones:
//   density    — plugging into an external monitor, or changing ChromeOS's
//                display-size slider, changes DPI. On a laptop this is rare; on a
//                Chromebook docked at a classroom desk it is a daily event.
//   navigation — a Chromebook gaining/losing a d-pad-ish input device.
//   fontScale  — ChromeOS accessibility text scaling; the WebView restyles fine
//                on its own, so a full restart is pure loss.
const CONFIG_CHANGES = [
	'orientation',
	'keyboardHidden',
	'keyboard',
	'screenSize',
	'smallestScreenSize',
	'screenLayout',
	'locale',
	'layoutDirection',
	'uiMode',
	'density',
	'navigation',
	'fontScale',
].join('|');

edit(MANIFEST, 'survive ChromeOS config changes (density/navigation/fontScale)', (xml) =>
	xml.replace(/android:configChanges="[^"]*"/, `android:configChanges="${CONFIG_CHANGES}"`),
);

edit(MANIFEST, 'ChromeOS launch window size', (xml) => {
	if (xml.includes('<layout')) return xml;
	// ChromeOS launches an Android app into a phone-shaped window unless the
	// activity declares otherwise, so a landscape game opens as a tall slice and
	// the player has to resize before they can see anything. defaultWidth/Height
	// are honoured on first launch; minWidth/minHeight stop the window being
	// dragged down to a size the HUD can't lay out in.
	const layout = `
            <layout
                android:defaultWidth="1280dp"
                android:defaultHeight="800dp"
                android:minWidth="640dp"
                android:minHeight="400dp"
                android:gravity="center" />`;
	return xml.replace(/(<activity\b[^>]*>)/, `$1${layout}`);
});

// ---------------------------------------------------------------- sdk levels
edit('android/variables.gradle', 'SDK levels (min 28 / target 36)', (gradle) =>
	gradle
		// minSdk 28, NOT 30. Chromebooks split across two Android runtimes: ARCVM
		// (Android 11 / API 30) on anything from ChromeOS 100 onward, and the older
		// ARC++ container (Android 9 / API 28) on the pre-ARCVM fleet — which is
		// disproportionately the cheap, older, still-in-service school hardware this
		// game is aimed at. minSdk 30 makes the app invisible to all of them for the
		// sake of storage shims we don't use anyway (saves go to the app-private
		// Directory.Data via @capacitor/filesystem, so scoped storage never applies).
		.replace(/minSdkVersion\s*=\s*\d+/, 'minSdkVersion = 28')
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

	// Attach it to the release buildType when a keystore was provided, and fall
	// back to the DEBUG key when it wasn't.
	//
	// The fallback is not cosmetic. Gradle's release buildType has no signing
	// config by default, and an AGP release build with no signing config emits
	// `app-release-unsigned.apk` — which no Android device or Chromebook will
	// install, so the "local smoke build still works" promise quietly wasn't true.
	// Debug-signing keeps the smoke build installable; the CI publish job still
	// refuses to push anything that isn't release-signed, so this can't leak to itch.
	out = out.replace(
		/(buildTypes\s*\{[\s\S]*?release\s*\{)/,
		`$1
            if (System.getenv("ANDROID_KEYSTORE_PATH")) {
                signingConfig signingConfigs.wildWillowsRelease
            } else {
                signingConfig signingConfigs.debug
            }`,
	);
	return out;
});

console.log(
	changed === 0
		? '\nNothing to do — project already patched.\n'
		: `\nDone — ${changed} change${changed === 1 ? '' : 's'} applied.\n`,
);
