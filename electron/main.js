'use strict';

/**
 * Wild Willows — desktop (Steam) shell.
 *
 * This is a thin wrapper around the EXISTING web app. It does not change the
 * game: it boots a local Harper instance (same server, same web build, same
 * API) and loads it in a window. The browser/Fabric deployment is unaffected.
 */

const { app, BrowserWindow, shell, session } = require('electron');
const path = require('node:path');
const harper = require('./harper');
const steam = require('./steam');
const metricsSync = require('./metrics-sync');

// Single instance only — two copies would fight over the Harper port/data.
if (!app.requestSingleInstanceLock()) {
	app.quit();
	process.exit(0);
}

let mainWindow = null;

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

	// Show the splash immediately while Harper boots.
	mainWindow.loadFile(path.join(__dirname, 'loading.html'));

	// Open external links in the system browser, never in-app.
	mainWindow.webContents.setWindowOpenHandler(({ url }) => {
		if (!url.startsWith(harper.BASE_URL)) {
			shell.openExternal(url);
			return { action: 'deny' };
		}
		return { action: 'allow' };
	});

	mainWindow.on('closed', () => {
		mainWindow = null;
	});
}

// Harper serves over HTTPS with a self-signed cert in local dev. Accept it ONLY
// for our loopback origin; everything else uses normal certificate validation.
app.on('certificate-error', (event, _webContents, url, _error, _cert, callback) => {
	if (url.startsWith(`https://${harper.HOST}:${harper.PORT}`)) {
		event.preventDefault();
		callback(true);
	} else {
		callback(false);
	}
});

// Harper's loopback endpoint uses a self-signed cert. Tell Chromium's verifier
// to trust it for our host only — this prevents the handshake from even being
// flagged (quieter than just catching `certificate-error` after the fact).
function trustLoopbackCert() {
	session.defaultSession.setCertificateVerifyProc((request, callback) => {
		if (request.hostname === harper.HOST) callback(0); // 0 = trusted/valid
		else callback(-3); // -3 = fall back to Chromium's default verification
	});
}

async function boot() {
	trustLoopbackCert();
	steam.init(app); // no-op when not launched through Steam
	createWindow();
	try {
		const url = await harper.start(app);
		if (mainWindow) await mainWindow.loadURL(url);
		metricsSync.start(); // poll local metrics → Steam Stats (no-op without Steam)
	} catch (err) {
		console.error('[main] Harper failed to start:', err);
		if (mainWindow) {
			await mainWindow.loadFile(path.join(__dirname, 'loading.html'), { hash: 'error' });
			// Keep the UI clean: just a one-line reason. Full detail is in the log.
			const reason = String(err && err.message ? err.message : err).split('\n')[0];
			const logPath = harper.getLogFilePath() || '';
			await mainWindow.webContents.executeJavaScript(
				`window.__wwShowError(${JSON.stringify(reason)}, ${JSON.stringify(logPath)});`
			).catch(() => {});
		}
	}
}

app.whenReady().then(boot);

app.on('second-instance', () => {
	if (mainWindow) {
		if (mainWindow.isMinimized()) mainWindow.restore();
		mainWindow.focus();
	}
});

app.on('window-all-closed', () => {
	// Quit on all platforms; the local backend should not outlive the window.
	app.quit();
});

app.on('activate', () => {
	if (BrowserWindow.getAllWindows().length === 0) boot();
});

// Make sure Harper is torn down whenever the app exits.
app.on('before-quit', () => { metricsSync.stop(); steam.shutdown(); harper.stop(); });
process.on('exit', () => harper.stop());
process.on('SIGINT', () => {
	harper.stop();
	process.exit(0);
});
process.on('SIGTERM', () => {
	harper.stop();
	process.exit(0);
});
