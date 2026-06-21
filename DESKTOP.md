# Wild Willows — Desktop / Steam build

This wraps the web app in [Electron](https://www.electronjs.org/) so it can ship
as a standalone desktop game (Steam, itch, etc.).

Two play modes, two backends:

- **Solo** runs **entirely in-app, fully offline.** The exact same game server
  logic (`server/resources.ts`) executes inside the renderer against an
  in-memory database, persisted to local JSON save files — no Harper process, no
  network. See `src/solo/`.
- **Co-op** talks to the **hosted Harper** over HTTPS (`COOP_BASE_URL` in
  `src/api.ts`, currently `https://wild.willows.harperfabric.com`), because a
  shared world needs a shared server.

The web/browser build and the Harper/Fabric deploy are unaffected — on the web
the app just talks to its own origin as before.

```
electron/
  main.js        app lifecycle + window; loads the bundled web build (offline)
                 and provides the solo save-file store over IPC
  preload.js     context-isolated bridge: desktop flag + saves API
  steam.js       Steamworks init / stats / achievements (no-op outside Steam)
  metrics-sync.js  (legacy) Steam stat sync — see note below
  harper.js      (legacy) local-Harper launcher — no longer used at boot
  package.json   marks this folder as CommonJS (root stays ESM for the web app)
```

## How it works

1. On launch the app loads the **bundled `web/` build straight from disk**
   (`file://`), so it opens instantly and needs no server to play solo. (The
   build uses Vite `base: './'` so the same `web/` works both from disk and when
   served at Harper's root for web/co-op.)
2. **Solo:** picking *New Game* or *Load Game* runs the real server endpoints in
   the renderer (`src/solo/backend.ts` installs `Resource`/`databases` shims and
   imports `server/resources.ts`). State lives in an in-memory `LocalDb`
   (`src/solo/localDb.ts`) seeded from `data/*.json`; after every action the
   world is serialized to a save slot. No passcode — solo saves are local files,
   each just a name + character. Slots are JSON files in `userData/saves/`
   (offline, durable, Steam-Cloud-syncable), read/written over IPC.
3. **Co-op:** selecting Co-op points the API client at the hosted Harper. Hosting
   or joining, presence, and approvals all go to that shared server.
4. There is no local Harper child process and nothing to install on first run.

Solo is a true **offline, own-it-forever** experience; co-op requires a network
connection to the shared server.

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

## Steam Stats & Achievements

The renderer owns the live game metrics (solo runs in-app; co-op uses the hosted
Harper), so `src/solo/steamSync.ts` periodically reads the active player's
`/Metrics/` view and pushes it to the main process over IPC (`steam:metrics`).
`electron/metrics-sync.js` receives it and maps the numbers onto Steam Stats +
the milestone achievements via `electron/steam.js`. Everything is a no-op unless
the app is launched through Steam, so `npm run desktop` still works.

Define these in the Steamworks dashboard (App Admin → **Stats**, then
**Achievements**) with matching API names:

Stats (INT): `play_minutes`, `sessions`, `resources_collected`, `items_crafted`,
`objects_placed`, `plants_planted`, `animals_observed`, `animals_returned`,
`biomes_unlocked`.

Achievements: `ACH_FIRST_ANIMAL`, `ACH_FIRST_CRAFT`, `ACH_SECOND_BIOME`,
`ACH_NATURALIST`, `ACH_GREEN_THUMB`, `ACH_DEDICATED`. The unlock thresholds live
in `ACHIEVEMENTS` in `metrics-sync.js` — tweak freely.

Testing: `steam_appid.txt` holds `480` (Valve's public test app) so the Steam API
initializes during development with the Steam client running. Replace it with your
real App ID (or set `WW_STEAM_APPID`) once you have one; in packaged Steam builds
Steam injects the App ID and the file isn't shipped. On first sync the app logs the
actual metric field names to the console — use them to confirm the mapping.

## Things still to do for a real Steam release

- **Controller support** — the game is keyboard-only today; add gamepad input
  for Steam Deck Verified and couch play.
- **Steamworks** — define the Stats/Achievements (API names below) in the
  dashboard so the wired-up sync has targets, and sync `userData/saves/` via
  Steam Cloud.
- **Code signing** — required for distribution on macOS and Windows.
- **Co-op over the internet** — verify the hosted Harper (`COOP_BASE_URL`) sends
  CORS headers that allow the desktop's `file://` origin (`Origin: null`) for the
  co-op endpoints; otherwise co-op fetches from the packaged app will be blocked.

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
