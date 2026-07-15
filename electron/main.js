"use strict";

/**
 * Wild Willows — desktop (Steam) shell.
 *
 * Solo play runs entirely in-app (the same game logic, against local save files
 * in userData/saves), so the desktop app loads the BUNDLED web build straight
 * from disk and needs no server and no network to play solo. Co-op talks to the
 * hosted Harper over HTTPS from the renderer (see src/api.ts COOP_BASE_URL).
 */

const { app, BrowserWindow, shell, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const steam = require("./steam");
const metricsSync = require("./metrics-sync");

// Desktop app can allow autoplay so opening music starts without a click.
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

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
    const packaged = path.join(
      process.resourcesPath,
      "component",
      "web",
      "index.html",
    );
    if (fs.existsSync(packaged)) return packaged;
  }
  return path.join(__dirname, "..", "web", "index.html");
}

// --- solo save files: userData/saves/<slotId>.json ---
function savesDir() {
  const dir = path.join(app.getPath("userData"), "saves");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
const slotFile = (slotId) =>
  path.join(
    savesDir(),
    `${String(slotId).replace(/[^a-zA-Z0-9_-]/g, "")}.json`,
  );

function registerSaveIpc() {
  ipcMain.handle("saves:list", async () => {
    try {
      return fs
        .readdirSync(savesDir())
        .filter((f) => f.endsWith(".json"))
        .map((f) => f.slice(0, -5));
    } catch {
      return [];
    }
  });
  ipcMain.handle("saves:read", async (_e, slotId) => {
    try {
      return fs.readFileSync(slotFile(slotId), "utf8");
    } catch {
      return null;
    }
  });
  ipcMain.handle("saves:write", async (_e, slotId, contents) => {
    fs.writeFileSync(slotFile(slotId), String(contents), "utf8");
  });
  ipcMain.handle("saves:remove", async (_e, slotId) => {
    try {
      fs.unlinkSync(slotFile(slotId));
    } catch {
      /* already gone */
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: "#1f2a1d",
    show: false,
    title: "Wild Willows",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());

  // Open external (http/https) links in the system browser; keep file:// in-app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

async function boot() {
  steam.init(app); // no-op when not launched through Steam
  metricsSync.start(); // listens for renderer metrics → Steam (no-op without Steam)
  registerSaveIpc();
  createWindow();
  try {
    await mainWindow.loadFile(webIndexPath());
  } catch (err) {
    console.error("[main] failed to load app:", err);
  }
}

app.whenReady().then(boot);

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) boot();
});

app.on('before-quit', () => {
	metricsSync.stop();
	steam.shutdown();
});
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
