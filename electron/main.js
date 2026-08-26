'use strict';

/**
 * Wild Willows — desktop (Steam) shell.
 *
 * Solo play runs entirely in-app (the same game logic, against local save files
 * in userData/saves), so the desktop app loads the BUNDLED web build straight
 * from disk and needs no server and no network to play solo. Telemetry reaches
 * the hosted Harper over HTTPS from the renderer (see src/api.ts HOSTED_BASE_URL).
 */

const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const steam = require('./steam');
const { createSaveStore } = require('./saves');
const metricsSync = require('./metrics-sync');

// Desktop app can allow autoplay so opening music starts without a click.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// Single instance only — two copies would fight over the same save files.
// NOT in the Mac App Store build: the App Sandbox blocks Electron's singleton
// from bind()ing its Unix socket in $TMPDIR ("Operation not permitted"), so
// requestSingleInstanceLock() returns false and the app silently quits on
// launch for every store download. Launch Services already prevents a second
// copy of a sandboxed store app, so the lock is unnecessary there.
if (!process.mas && !app.requestSingleInstanceLock()) {
	app.quit();
	process.exit(0);
}

let mainWindow = null;

// --- where the bundled web build lives (dev vs packaged) ---
function webIndexPath() {
	if (app.isPackaged) {
		const packaged = path.join(process.resourcesPath, 'component', 'web', 'index.html');
		if (fs.existsSync(packaged)) return packaged;
	}
	return path.join(__dirname, '..', 'web', 'index.html');
}

// --- solo save files: userData/saves/<slotId>.json ---
//
// Progress is the highest-value state this app holds and, for solo, the ONLY
// copy — so writes go through electron/saves.js, which writes to a temp file,
// fsyncs it, rotates the previous save to `.bak`, and renames into place. See
// that file's header for the crash-window analysis. Reads fall back to `.tmp`
// then `.bak` when the primary file will not parse.

let saveStore = null;
function saves() {
	if (!saveStore) {
		saveStore = createSaveStore(path.join(app.getPath('userData'), 'saves'), {
			log: (...args) => console.warn(...args),
			// Tell the renderer a save came back from a backup. It forwards this to
			// the hosted instance (src/solo/saveIncident.ts) so desktop corruption is
			// visible on /dashboard instead of being invisible by construction.
			onRecover: (info) => {
				if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('saves:recovered', info);
			},
		});
	}
	return saveStore;
}

function registerSaveIpc() {
	ipcMain.handle('saves:list', async () => saves().listSlots());
	ipcMain.handle('saves:read', async (_e, slotId) => saves().readSlot(slotId));
	ipcMain.handle('saves:write', async (_e, slotId, contents) => {
		saves().writeSlot(slotId, contents);
	});
	ipcMain.handle('saves:remove', async (_e, slotId) => saves().removeSlot(slotId));
}

// --- navigation lockdown (defense in depth) ---
//
// This window only ever shows the BUNDLED web build loaded over file://. It has
// no in-app browsing, no OAuth popup, no embedded storefront — so every
// navigation to anywhere else is, by definition, something going wrong: an
// injected <a target>, a compromised third-party asset, a crafted save that
// smuggles markup into the DOM. contextIsolation and nodeIntegration:false
// already stand between a hostile page and Node, but they are one layer. If a
// remote origin can never be reached in the first place, that layer never has to
// hold.
//
// Applied via app.on('web-contents-created') rather than to mainWindow alone so
// it also covers anything created later — a child window, a devtools extension
// page, a <webview> someone adds in a year's time.
const ALLOWED_PROTOCOLS = new Set(['file:', 'devtools:']);

function isInternalUrl(rawUrl) {
	try {
		return ALLOWED_PROTOCOLS.has(new URL(rawUrl).protocol);
	} catch {
		return false; // unparseable is not internal
	}
}

function hardenContents(contents) {
	// Top-level navigation: allow file:// (our own app), send http/https to the
	// system browser, and drop everything else (javascript:, data:, blob:, …).
	contents.on('will-navigate', (event, url) => {
		if (isInternalUrl(url)) return;
		event.preventDefault();
		if (/^https?:$/i.test(safeProtocol(url))) void shell.openExternal(url);
		else console.warn('[main] blocked navigation to', url);
	});

	// Same rule for in-page redirects that skip will-navigate.
	contents.on('will-redirect', (event, url) => {
		if (!isInternalUrl(url)) {
			event.preventDefault();
			console.warn('[main] blocked redirect to', url);
		}
	});

	// window.open / target=_blank. Deny by DEFAULT: the previous handler allowed
	// anything non-http, which included javascript: and data: URLs.
	contents.setWindowOpenHandler(({ url }) => {
		if (/^https?:$/i.test(safeProtocol(url))) {
			void shell.openExternal(url);
			return { action: 'deny' };
		}
		console.warn('[main] blocked window.open to', url);
		return { action: 'deny' };
	});

	// The app embeds nothing. A <webview> would be a second renderer with its own
	// preload — refuse outright, and strip the preload in case a future Electron
	// changes when preventDefault takes effect.
	contents.on('will-attach-webview', (event, webPreferences) => {
		delete webPreferences.preload;
		webPreferences.nodeIntegration = false;
		event.preventDefault();
	});

	// Nothing here needs camera, mic, location, notifications, clipboard reads or
	// any other gated capability — the game is a canvas and some DOM. Refusing all
	// of them means a hostile page cannot even raise the prompt.
	const session = contents.session;
	if (session) {
		session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
		session.setPermissionCheckHandler(() => false);
	}
}

/** Protocol of a URL, or '' when it will not parse. */
function safeProtocol(rawUrl) {
	try {
		return new URL(rawUrl).protocol;
	} catch {
		return '';
	}
}

app.on('web-contents-created', (_event, contents) => hardenContents(contents));

function createWindow() {
	mainWindow = new BrowserWindow({
		width: 1280,
		height: 800,
		minWidth: 960,
		minHeight: 600,
		backgroundColor: '#1f2a1d',
		show: false,
		title: 'Wild Willows',
		webPreferences: {
			contextIsolation: true,
			nodeIntegration: false,
			preload: path.join(__dirname, 'preload.js'),
		},
	});

	mainWindow.once('ready-to-show', () => mainWindow.show());

	// External links, navigation and permissions are handled by hardenContents(),
	// wired to every web contents via app.on('web-contents-created') above.

	mainWindow.on('closed', () => {
		mainWindow = null;
	});
}

// Native "About Wild Willows" panel (macOS app menu → About): credit
// contributors here so the acknowledgement ships in the built/App Store app,
// not only on the in-game title screen. Sandbox-safe; no entitlement needed.
function configureAboutPanel() {
	if (process.platform !== 'darwin') return;
	app.setAboutPanelOptions({
		applicationName: 'Wild Willows',
		applicationVersion: app.getVersion(),
		copyright: '© 2026 Bailey Dunning',
		credits: 'Made by Bailey Dunning\nMusic & sound by Jon Licht',
	});
}

// Windows/Linux ship a default Electron application menu bar — File / Edit /
// View / Window / Help, including Reload and Toggle DevTools — drawn right on
// top of the game window. It is the single loudest "this is just Electron" tell
// in the packaged build, so drop it there.
//
// macOS is deliberately left alone: its menu lives in the system bar rather than
// the window, and configureAboutPanel() above hangs the credits off its standard
// App menu. It also NEEDS the menu — macOS takes the standard editing shortcuts
// (Cmd+C/V/X/A) from menu items, so nulling the menu would break typing in the
// save-name field. Windows and Linux get those from Chromium natively in
// editable fields, with or without a menu.
function configureAppMenu() {
	if (process.platform === 'darwin') return;
	Menu.setApplicationMenu(null);
}

async function boot() {
	configureAboutPanel();
	configureAppMenu();
	steam.init(app); // no-op when not launched through Steam
	metricsSync.start(); // listens for renderer metrics → Steam (no-op without Steam)
	registerSaveIpc();
	createWindow();
	try {
		await mainWindow.loadFile(webIndexPath());
	} catch (err) {
		console.error('[main] failed to load app:', err);
	}
}

void app.whenReady().then(boot, (err) => {
	console.error('[main] app failed to become ready:', err);
	app.quit();
});

app.on('second-instance', () => {
	if (mainWindow) {
		if (mainWindow.isMinimized()) mainWindow.restore();
		mainWindow.focus();
	}
});

app.on('window-all-closed', () => {
	app.quit();
});

app.on('activate', () => {
	if (BrowserWindow.getAllWindows().length === 0) void boot();
});

app.on('before-quit', () => {
	metricsSync.stop();
	steam.shutdown();
});
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
