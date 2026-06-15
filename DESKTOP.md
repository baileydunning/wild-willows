# Wild Willows — Desktop / Steam build

This wraps the **existing** web app in [Electron](https://www.electronjs.org/) so
it can ship as a standalone desktop game (Steam, itch, etc.). It is **purely
additive** — nothing about the web/browser build or the Harper/Fabric deploy
changes. The desktop app simply boots a *local* Harper instance (same server,
same `web/` build, same REST API) and points a window at it, so Harper stays the
source of truth exactly as it is today.

```
electron/
  main.js        app lifecycle + window, orchestrates the Harper child process
  harper.js      spawns local Harper, waits for it, syncs the component, shutdown
  preload.js     tiny context-isolated bridge (desktop flag + version)
  loading.html   splash shown while the local world boots
  package.json   marks this folder as CommonJS (root stays ESM for the web app)
```

## How it works

1. On launch, the component files (`config.yaml`, `schema.graphql`, `resources.js`,
   `data/`, `web/`) are copied into a **writable** per-user folder
   (`userData/component`) — required because a packaged app is read-only and
   Harper is a separate process that can't read from inside an asar archive.
2. On first launch the app runs `harper install` into `~/WildWillows/harper-root`
   (unattended, via `ROOTPATH` + `HDB_ADMIN_USERNAME`/`HDB_ADMIN_PASSWORD`). The
   root lives there rather than under `userData` because Harper's config
   validator rejects spaces/dots in `rootPath`, and the macOS `userData` path
   (`~/Library/Application Support/…`) contains a space. The
   installer writes a complete, schema-valid config and generates the TLS certs,
   JWT keys, super-user and database dir — things a hand-written config can't
   provide. The app/REST port and `authorizeLocal: true` are baked in via
   `HTTP_SECUREPORT` / `AUTHENTICATION_AUTHORIZELOCAL`. The subprocess also gets
   an **isolated `HOME`** (`userData/harper-home`) so the installer neither sees
   nor clobbers a developer's global Harper (whose boot file lives at
   `~/.harperdb/...`) — without this, the installer detects the global install
   and crashes querying its system database.
3. Subsequent launches skip install and just `harper run` against that ready
   root. First boot still seeds the preserve (150 animals, 126 objects, 97
   recipes…), so it's slow once; later launches are quick. Electron polls the
   endpoint and, once Harper answers, loads `https://127.0.0.1:9926/`.
4. On quit, the Harper child process is torn down. Harper output is also written
   to `userData/logs/harper.log` for troubleshooting.

Because it's a single local player, this is a true **offline, own-it-forever**
build — no hosted server, no network dependency.

## Run it (dev)

You already have Harper installed globally (`npm install -g harper`), which is
all the dev run needs — it falls back to the `harper` on your PATH.

```bash
npm install            # pulls in electron + electron-builder
npm run desktop        # builds web + server, then launches the Electron app
# or, without rebuilding:
npm run desktop:run
```

The web flow is untouched and still works exactly as before:

```bash
npm run build && harper run .     # browser at https://localhost:9926/
npm run dev:web                   # vite dev server with API proxy
harper deploy package=. ...       # Fabric deploy
```

## Package a distributable

```bash
npm run desktop:pack     # quick: builds an UNPACKED app in dist/ (no installer)
npm run desktop:dist     # full: builds + installers in dist/
```

`desktop:pack` is the fastest way to verify a packaged build runs. For Steam you
upload the **unpacked** folder it produces (`dist/mac`, `dist/win-unpacked`,
`dist/linux-unpacked`), not the installer.

### Native modules (the thing most likely to need attention)

Harper's default storage engine is `lmdb`, a **native** module. We run Harper
with Electron's own Node runtime (`ELECTRON_RUN_AS_NODE`), so `lmdb` must be
built for Electron's ABI, not your system Node's. electron-builder does this
automatically (`npmRebuild: true`), and `asarUnpack` keeps `node_modules/harper`
outside the asar so the `.node` binaries are loadable.

If a packaged build fails to start with a native-module error (e.g.
`NODE_MODULE_VERSION` mismatch), rebuild against Electron explicitly:

```bash
npx electron-rebuild -f -w lmdb
```

`harper` is a regular dependency now (`"harper": "^5.1.0"`) — match it to your
installed version (`harper --version`) and confirm `ls node_modules/harper`.

## Things still to do for a real Steam release

- **Controller support** — the game is keyboard-only today; add gamepad input
  for Steam Deck Verified and couch play.
- **Steamworks** — achievements + Steam Cloud (sync the `userData/harper-root`
  data dir) via `steamworks.js`.
- **Code signing** — required for distribution on macOS and Windows.
- **Saves** — the name+passcode multi-save flow is built for a shared server and
  is redundant offline; consider simplifying to local saves.

## Troubleshooting

- **"Couldn't start the world"** now shows the real failure reason plus the path
  to `userData/logs/harper.log`. Check there first.
- **Port already in use** — if you have a dev Harper running (`harper run .` on
  `9926`), the desktop app refuses to start with a clear message. Stop the dev
  instance, or launch with `WW_HARPER_PORT` set to a free port.
- **Reset the local world** — delete `~/WildWillows` to force a fresh install +
  reseed. (The Harper database and isolated home live there; component cache and
  logs live under the app's `userData`.) Earlier broken versions wrote a stray
  `harper-root` under `userData` too — that's now unused and safe to delete.

## Knobs (env vars)

- `WW_HARPER_PORT` — local Harper port (default `9926`).
- `WW_HARPER_CLI` — absolute path to a Harper CLI entry to run instead of the
  resolved/global one (debugging).
