// Capacitor config — the iOS App Store build (`npm run ios:sync` + Xcode).
//
// The iOS app is the same solo-only, fully-offline web build the desktop app
// ships (webDir `web`), wrapped in a WKWebView. Touch controls (virtual
// joystick bottom-right, tap-to-move, tap-to-interact) are built into the web
// app itself and switch on automatically on coarse-pointer devices.
//
// Saves: on iOS the app installs a Filesystem-backed saves bridge
// (src/solo/iosSaves.ts) so solo saves are durable JSON files in the app's
// Library dir — NOT localStorage, which iOS may evict under storage pressure.
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
	appId: 'io.harper.wildwillows',
	appName: 'Wild Willows',
	webDir: 'web',
	// Solid brand green behind the webview so rotation/launch never flashes white.
	backgroundColor: '#324528',
	ios: {
		// Edge-to-edge webview; the CSS safe-area insets (styles.css) keep the
		// joystick and buttons clear of the notch and home indicator.
		contentInset: 'never',
		// Serve the bundle as an iPad-class page on iPad, phone-class on iPhone.
		preferredContentMode: 'mobile',
	},
};

export default config;
