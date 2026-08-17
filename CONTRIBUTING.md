# Contributing / Developer guide

Everything you need to run, test, build, ship and extend Wild Willows. For what the game *is*, see [README.md](README.md).

> **Source available, not open source.** © 2026 Bailey Dunning, all rights reserved. The code is here to be read, studied and learned from — no licence to use it is granted. See [NOTICE.md](NOTICE.md) for what that does and doesn't allow. Running, building, distributing or deriving from it needs written permission; ask and it may well be yes.

**Harper is the source of truth.** Player progress, inventory, chests, crafting, placements, terrain, biome health, ecological balance, animal discoveries, comfort levels, tool upgrades, biome unlocks, and play metrics all live in Harper and are validated server-side. The browser never computes game state on its own.

---

## Run it locally

Prerequisites: Node 24+, Harper v5 (`npm install -g harper`).

```bash
npm install
npm run dev          # terminal 1 — builds resources.js, starts Harper (API only) on :9926
npm run dev:web      # terminal 2 — vite serves the UI on http://localhost:5173, proxying API calls to Harper
```

Open **http://localhost:5173/**. Harper is **endpoints only** (no static hosting — see `config.yaml`), so the UI is always served by Vite locally; the dev proxy (`vite.config.ts`) accepts Harper's self-signed local certificate for you. Choose **New Game**, customize your caretaker, pick a name and passcode, and begin. **Load Game** signs back into any save from any browser; the last save on a device also gets a one-click **Continue**. An interactive tutorial walks new caretakers through the loop (skippable; progress saved to Harper).

> **Keyboard required.** Wild Willows is a keyboard game, so it gates to devices with a keyboard. A computer (any mouse/trackpad) is allowed; a touch-only phone/tablet sees a "connect a keyboard" screen until a key is pressed.

After changing `server/resources.ts`, run `npm run build:server` (or restart `npm run dev`, which rebuilds then starts `harper dev .`). To check the **production build** instead of the dev server, `npm run build:web && npx vite preview` serves it on :4173 with the same API proxy. To play the **browser demo** — the `DEMO=true` build that ships to itch's html5 channel and to play.wildwillows.app — run `npm run browser`, which rebuilds with the demo behaviour baked in (Harper-first backend, the 5-animal hard-stop, `edition:'demo'` metrics) and opens :4173. It proxies to the same local Harper, so keep `npm run dev` running in another terminal. A scripted end-to-end API check lives at `scripts/smoke-test.sh`.

> **Editing `data/*.json` live:** the server inlines the definition JSON for boot-time reconciliation, so after renaming/removing definition records, rebuild `resources.js` and restart Harper. Write data files atomically (temp + rename) so the live data loader never reads a half-written file.

## Testing

Three layers of tests, all run in CI on every PR and push to `main` (`.github/workflows/ci.yml`):

| Layer | Tool | Location | Covers | Needs a server? |
|---|---|---|---|---|
| Unit | Vitest | `tests/unit/` | Pure logic: recipe unlock gating, the local-save DB, save/transport helpers | No |
| Integration | Vitest | `tests/integration/` | The **real** built server (`resources.js`) against an in-memory Harper mock — create/login, gather, craft, place, plus the full co-op flow (join approval, shared node cooldowns, presence, 6-caretaker cap) | No |
| E2E (solo) | Playwright | `tests/e2e/solo.spec.ts` | The production web build in offline solo mode: title, character creation, entering the world, Continue | No (`vite preview`) |
| E2E (co-op) | Playwright | `tests/e2e/coop.spec.ts` | The same build served by `vite preview`, with API calls **proxied to a live Harper** on `localhost:9926` (Harper is endpoints-only) — live `GameData`, player creation, hosting a shared preserve | Yes (Harper) |

```bash
# unit + integration (fast, no server) — also rebuilds resources.js first
npm test
npm run test:unit
npm run test:integration
npm run test:watch          # vitest watch mode

# solo E2E (auto-builds the web app and serves it with vite preview)
npx playwright install chromium     # one-time browser download
npm run test:e2e:solo

# co-op E2E against a live Harper — boot it in one terminal:
npm run dev                 # builds + starts Harper (API only) on https://localhost:9926
# …then in another (Playwright builds + previews the web app itself,
# with the co-op UI baked in and API calls proxied to that Harper):
COOP_E2E=1 npm run test:e2e:coop

npm run test:all            # typecheck + all Vitest suites + solo E2E
```

The **integration harness** (`tests/integration/harness.ts`) installs lightweight stand-ins for Harper's `databases` / `Resource` globals, then imports the committed `resources.js` — the exact artifact `harper deploy` ships — giving each test a fresh in-memory world seeded from `data/*.json`. It's the same technique as the `scripts/coop-harness.mjs` smoke harness, refactored for Vitest. The **solo E2E** reaches offline mode by setting `window.wildWillowsDesktop = { isDesktop: true }` before the app boots, which flips the API transport to the in-app solo backend (no network). The **co-op E2E** CI job boots Harper with `harper run .` (endpoints only) and waits for `/GameData/`; Playwright's own webServer then builds the app with `COOP_ENABLED=true` and serves it via `vite preview`, whose proxy carries API calls to that Harper. For a quick manual end-to-end API check there's also `scripts/smoke-test.sh`, and `scripts/audit-content.mjs` proves every recipe, tool upgrade, plant, and animal requirement is actually obtainable in unlock order (run against a live Harper).

## Deploy to Harper / Fabric

**The hosted Harper is endpoints only** — the deployed component is just `config.yaml`, `schema.graphql`, `resources.js`, and `data/` (no `web/` build; the game UI ships in the desktop app). The one deploy recipe is `./deploy-coop.sh` (also run by `.github/workflows/deploy.yml`):

```bash
./deploy-coop.sh                 # builds resources.js, stages the component, prompts for the Harper password
# env knobs: HARPER_PW, HARPER_USER (default HDB_ADMIN), TARGET_URL
```

The `dataLoader` seeds all definition tables on every deploy (player data is never touched). Admin credentials are used only by the CLI — they never appear in the frontend. The policy pages (`/privacy.html`, `/age-rating.html`) are served by endpoints inside `resources.js`, so they deploy with everything else.

> **Deploy the staged component — don't deploy straight from the Git URL or the repo root.** `deploy-coop.sh` stages only the component files into a temp dir (a few MB). Harper packages the WHOLE directory when you point it at the repo (ignoring `.gitignore`), which would upload `node_modules` (~1.1G) + `dist/`, and deploying from the raw GitHub URL makes the instance run a full `npm install --include=dev` — unpacking the large **phaser** package there can fail with `TAR_ENTRY_ERROR Unknown system error -122` (that's `EDQUOT` — **disk quota exceeded**). The staged component has **no runtime npm dependencies**, so the instance installs nothing.

## Desktop / Steam build

The desktop app (Steam, itch, etc.) wraps the web build in [Electron](https://www.electronjs.org/) (`electron/`). It loads the bundled `web/` build straight from disk (`file://`) — Vite's `base: './'` makes the same build work both from disk and served at Harper's root — so it opens instantly with no server and no install step.

**v1 ships solo-only.** Co-op is hidden behind the `COOP_ENABLED` flag (`src/features.ts`) so the shipped desktop app is fully offline — no server, no account, nothing to install on first run. The multiplayer code is all still in the repo, just dead-code-eliminated from the build (see [Re-enabling co-op](#re-enabling-co-op-later)).

Two play modes, two backends:

- **Solo** (the v1 build) runs **entirely in-app and offline.** The same server logic (`server/resources.ts`) executes in the renderer against an in-memory `LocalDb` (`src/solo/`) seeded from `data/*.json`; after each action the world is serialized to a save slot. No passcode — solo saves are local JSON files in `userData/saves/<slotId>.json`, read/written over IPC (`electron/main.js`). Because that server module also imports Node built-ins (`node:crypto`, `node:zlib`), Vite aliases both to tiny browser stand-ins for the renderer build (`src/solo/cryptoShim.ts`, `src/solo/zlibShim.ts`) while the server's own esbuild build keeps the real modules — so the deployed Harper is unaffected. Solo routing is authoritative on the active save: whenever a solo slot is loaded, `isLocalCall` (`src/api.ts`) serves **every** request in-app, so solo gameplay never reaches the network even if the transport flag is stale.
- **Co-op** (hidden in v1) talks to the **hosted Harper** over HTTPS (`COOP_BASE_URL` in `src/api.ts`) — a shared world needs a shared server.

There is no hosted web version of the game UI — the hosted Harper is endpoints only (metrics uplink, feedback, dashboards, and the co-op API if re-enabled).

| `electron/` file | Role |
|---|---|
| `main.js` | App lifecycle + window; loads the bundled web build; solo save-file store over IPC |
| `preload.js` | Context-isolated bridge: the `wildWillowsDesktop` flag, the saves API, and the Steam metric push |
| `steam.js` | Steamworks init / stats / achievements (no-op outside Steam) |
| `metrics-sync.js` | Maps the renderer's metrics onto Steam Stats + milestone achievements |
| `package.json` | Marks this folder CommonJS (the repo root stays ESM for the web app) |

### Run & package

```bash
npm install
npm run desktop          # builds web + server, then launches Electron
npm run desktop:run      # launch without rebuilding
npm run desktop:pack     # unpacked app in dist/ (no installer) — fastest packaged check
npm run desktop:dist     # full installers/archives in dist/
npm run desktop:mas      # sandboxed Mac App Store .pkg (universal) — see below
```

Build targets live in `package.json` → `build`: dmg/zip (mac), NSIS + zip (win), AppImage (linux). The only runtime dependency packaged is `steamworks.js`; `harper` is dev-only now, so it isn't bundled. For **itch.io** you upload the installers/archives (see below); for **Steam** you upload the **unpacked** folder (`dist/mac`, `dist/win-unpacked`, `dist/linux-unpacked`) via `steamcmd`, not the installer.

### Shipping to itch.io (v1)

itch.io is the v1 distribution channel ([bai13y/wild-willows](https://bai13y.itch.io/wild-willows)). Solo is offline, so the build is just files players download.

A Mac can only produce the **macOS** `.dmg`/`.zip`; Windows and Linux need their own OS. So either build locally per machine, or let CI build all three:

- **Auto-build + publish via CI (recommended).** `.github/workflows/desktop-build.yml` builds Windows, macOS, and Linux on native runners, then — on a **version-tag push** — publishes each with `butler` to the `windows` / `osx` / `linux` channels of `bai13y/wild-willows`:
  ```bash
  git tag v0.1.0 && git push origin v0.1.0
  ```
  A plain **Actions → Run workflow** (manual) just builds the artifacts and skips publishing. Publishing needs the `BUTLER_API_KEY` secret (from https://itch.io/user/settings/api-keys). butler uploads update the itch page in place — version, channels, and itch-app installs are handled for you, no manual drag-and-drop.

  The release version comes **from the tag** (`v0.1.1` → `0.1.1` artifacts + itch version) via `electron-builder -c.extraMetadata.version`, so you don't bump `package.json` by hand — just tag. (`package.json`'s version is only the local-dev default.)
- **Locally on your Mac.** `npm run desktop:dist` → macOS `.dmg`/`.zip` in `dist/`, then drag into **Edit game → Uploads** by hand if you're not using the tag flow.

On the itch page itself, set it up once as a downloadable **Game** ("played on your computer", installable by the itch app), add screenshots + cover + tags + the AI disclosure, and set it Public. After that, tagging a release keeps the builds current automatically.

> Windows builds are unsigned, so SmartScreen shows a "Windows protected your PC" prompt the first time (More info → Run anyway) — normal for itch games; note it on the store page.

### Browser-playable demo

The demo also has a home on our own domain — **[play.wildwillows.app](https://play.wildwillows.app/)**, the same `web/` build served as static assets by a Cloudflare Worker (`wrangler.jsonc` + `workers/play.js`), deployed by the same workflow that pushes to itch. It is a SUBDOMAIN rather than `wildwillows.app/play` on purpose: the apex is a proxied CNAME to the hosted Harper and depends on Harper issuing a certificate for it, and the demo should not wait on that or break with it. `detectChannel()` (`src/platform.ts`) reads the page's own hostname, so the identical bundle reports `channel: 'itch'` on itch and `channel: 'direct'` here — which is why neither build is stamped with a build-time channel.

The same page also hosts a **play-in-browser demo** — a static web build (`DEMO=true npm run build:web`) served in an iframe on itch, so anyone can try the game with no download. `.github/workflows/web-demo.yml` builds it and `butler push`es the `web/` folder to the **`html5`** channel of `bai13y/wild-willows` on the itch release tags (`itch-v*` / `v*`) or a manual **Actions → Run workflow** (both build *and* publish; needs `BUTLER_API_KEY`).

What the demo build changes (all behind the `DEMO` flag — see `src/demo.ts`):

- **Backend: offline-first, passwordless (`DEMO_WEB_BACKEND` in `src/demo.ts`, default `'solo'`).** The demo runs the real game logic **in the browser** against the in-app `LocalDb` (`src/solo/`) — the same path the desktop app ships — so play needs no server and no network. It is also **passwordless**: the title screen hides the passcode field and auto-mints a throwaway one. This is deliberate capacity planning, not a simplification: server-authoritative play costs ~145 writes and ~1,750 row reads per player per MINUTE (measured — `scripts/capacity-report.mjs`), capping the hosted instance in the low hundreds of concurrent players, while in-app play costs one `/AppOpen/` write per launch and one `/SyncMetrics/` write every 3 minutes. The demo is the one build that can be handed to an unbounded number of people at once, and a cozy single-player demo has no leaderboard or economy for server validation to protect. **Metrics still flow** — `shouldUplink()` (`src/solo/metricsUplink.ts`) reports on the `'solo'` transport too, so the acquisition funnel, the demo→full conversion and the channel split all keep working. Set `DEMO_WEB_BACKEND` back to `'harper'` for the server-validated path; it needs **CORS for itch's origin** on the hosted Harper, and `resolveDemoBackend()` (`src/api.ts`) probes `GET /Version/` at boot with the *same headers real calls use* and falls back to solo if that fails.
- **Demo saves made under the old `'harper'` default are not stranded.** `resolveDemoBackend()` still honours the `DEMO_HOME_KEY` pin: a device whose demo save lives on Harper probes and stays in Harper mode even though `'solo'` is now the starting value. Without that check the flip would point returning players at the empty offline store, which reads as *"the game deleted my save"* — read it before changing the default again.
- **Hard-stop 10 minutes after the forest unlocks, with save carry-over.** The demo spans the starter meadow *and* what lies past it: there's deliberately **no meadow cap**, so the caretaker restores the meadow to unlock the forest, then gets a taste of what follows. Play freezes with a "thanks for playing the demo" popup once **`DEMO_BUDGET_MINUTES` (10)** of play have passed *since the forest unlocked* — accrued wherever they are, while the tab is on screen and someone has touched the game inside the heartbeat's idle window, so it measures the same thing the dashboard's play time does (see `src/demoBudget.ts` and the gate in `src/state.tsx`). **The budget is persisted per save in `localStorage` and re-checked on load.** The original counter was neither: it lived in a `useRef` that reset on every page load, and it only ran while the player stood in the forest area. Reloading the tab handed out a fresh ten minutes of forest time; walking into the wetland — which the demo never blocked, because biome unlocks are ordinary game rules — stopped the clock for good; and since the save is only deleted when the popup is *dismissed*, closing the tab at the thank-you screen kept it. One demo player put in 2h05m across three biomes that way, with the completion flag already set server-side. Change any of those three properties and the demo leaks the full game again. It offers a **"Download my save"** button so the player can carry their meadow into the full downloadable game (its title-screen Import Save): `ExportDemoSave` dumps the world in the offline solo-save shape (`edition` reset to `full`) and the client encrypts it into the standard save envelope — the solo fallback reuses the existing `exportActiveSolo`. Closing the popup returns to the title and **deletes the save** (local slot, or the hosted record via the guarded, passcode-free `DeleteDemoSave` — which refuses anything not tagged `edition:'demo'`), so deletion is deferred until dismiss and can't strand the export.
- **Demo signposting.** The tutorial's first slide notes it's the free demo and what completes it.
- **Metrics tagged `edition`.** Every heartbeat, app-open ping, and metrics uplink carries `edition: 'demo' | 'full'`. The browser demo uplinks to `SoloMetrics` **even in Harper mode** (see `shouldUplink()` in `src/solo/metricsUplink.ts`), so `SoloMetrics` is the single client-metrics stream — desktop solo, browser demo, and offline solo all land there. The `/MetricsSummary/` roll-up splits them by `editions` (demo/full) and `platforms` (web/desktop); `acquisition.editions` (from `AppOpen`) additionally counts installs that never created a character.

One-time itch page setup (persists across butler pushes to `html5`): open the uploaded `html5` build → tick **"This file will be played in the browser"**, set an embed viewport (e.g. 1280×720, click-to-launch, fullscreen on). For the Harper-backed path, enable **CORS** on the hosted Harper for itch's game origin; without it the demo simply runs offline.

The demo gating (tutorial note + the post-unlock budget hard-stop) is driven **purely** by the build-time `DEMO` flag — there is deliberately no runtime toggle, so a player can't open dev tools and switch it off to unlock the full game. To exercise it during development, build the demo for real: `DEMO=true npm run build:web && npx vite preview`.

> Keyboard-only still applies: itch's browser player is desktop-friendly, and the keyboard gate lets any device with a keyboard through.

### Signing & notarizing the macOS build

The macOS build is configured to **code-sign + notarize** so it opens with no Gatekeeper "damaged"/unidentified-developer warning. Config lives in `package.json` → `build.mac` (`hardenedRuntime`, `entitlements: build/entitlements.mac.plist`, `notarize.teamId: JB4CT3MZ6L`) and the entitlements plist grants the JIT / library-validation exceptions Electron + `steamworks.js` need.

To produce a signed, notarized build you need, on your Mac:

- A **Developer ID Application** certificate installed in your login keychain (from your Apple Developer account — *not* "Apple Distribution", which is App-Store-only).
- An **app-specific password** generated at [appleid.apple.com](https://appleid.apple.com) (Sign-In & Security → App-Specific Passwords).

Then build with the notarization credentials in the environment:

```bash
export APPLE_ID="you@example.com"               # your Apple Developer account email
export APPLE_APP_SPECIFIC_PASSWORD="abcd-efgh-ijkl-mnop"
export APPLE_TEAM_ID="JB4CT3MZ6L"
npm run desktop:dist
```

electron-builder finds the Developer ID cert in the keychain, signs the app + nested `steamworks.js` binary, then submits to Apple's notary service and staples the ticket. The resulting `dist/*.dmg` / `*-mac.zip` open cleanly on any Mac. (Notarization adds a few minutes while Apple's service processes the upload.)

> The bundle id (`build.appId`) is `io.harper.wildwillows` and must exactly match the registered App ID, or signing/notarization fails.
>
**Signing in CI.** `desktop-build.yml` signs + notarizes on the macOS runner when these repository secrets are set (Settings → Secrets and variables → Actions); they're applied on the mac runner only, so Windows/Linux stay unsigned, and if they're absent the mac build just comes out unsigned (no failure):

| Secret | Value |
|---|---|
| `APPLE_ID` | Apple **account email** (your Apple ID login) — *not* the bundle id `io.harper.wildwillows`. |
| `APPLE_TEAM_ID` | `JB4CT3MZ6L` |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password from [appleid.apple.com](https://appleid.apple.com) (Sign-In & Security → App-Specific Passwords). |
| `MAC_CSC_LINK` | "Developer ID Application" cert exported as `.p12`, base64-encoded: `base64 -i cert.p12 \| pbcopy`. |
| `MAC_CSC_KEY_PASSWORD` | The password set when exporting that `.p12`. |

### Mac App Store build

`npm run desktop:mas` builds the **Mac App Store variant** (electron-builder `mas` target, universal, signed `.pkg`). It inherits the `mac` config, so everything notarized-DMG-specific is overridden in `package.json` → `build.mas`:

- **App Sandbox instead of hardened runtime + notarization.** MAS apps must run sandboxed; the entitlements pair is `build/entitlements.mas.plist` (app-sandbox, JIT for V8, `network.client` for the solo metrics uplink, and the `TEAM_ID.bundle_id` application group Electron's helpers need) + `build/entitlements.mas.inherit.plist` for child processes. Solo saves already live in `app.getPath('userData')`, which the sandbox allows, so no file-access entitlements are needed.
- **Provisioning profile** from developer.apple.com (Profiles → Distribution → Mac App Store Connect) goes at `build/embedded.provisionprofile` — gitignored; CI decodes it from a secret.
- **Certificates:** the `mas` target signs with **Apple Distribution** (the `.app`) and **Mac Installer Distribution** (the `.pkg`) — *not* the Developer ID cert the DMG uses.
- **`steamworks.js` is excluded** (Steam can't run inside the MAS sandbox; `electron/steam.js` already no-ops when the module is missing).
- **`ITSAppUsesNonExemptEncryption=false`** in `extendInfo` answers App Store Connect's export-compliance question (HTTPS only).

Two CI workflows cover it (secrets: `MAS_CSC_LINK` — base64 `.p12` containing **both** distribution certs, `MAS_CSC_KEY_PASSWORD`, `MAS_PROVISIONING_PROFILE` — base64 profile, plus the existing `APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD` for the upload):

- `.github/workflows/mas-build.yml` — manual run; builds + signs the `.pkg` and uploads it as a GitHub artifact only (submit it yourself via Transporter/Xcode/altool).
- `.github/workflows/mas-release.yml` — on a `mas-v*` tag push (`git tag mas-v0.1.6 && git push origin mas-v0.1.6`) builds and **uploads to App Store Connect**; the version comes from the tag. A manual run just builds the artifact. Note ASC rejects re-uploads of a version+build it has already seen — bump the tag.

App Store Connect also needs **screenshots** (`scripts/mas-screenshots.py` converts window captures to Apple's required 16:10 sizes by scaling to 2880×1800 and edge-padding) and a **privacy policy URL** — that's `public/privacy.html` (prose source of truth: `PRIVACY.md`), served at `https://wild.willows.harperfabric.com/privacy.html`. The hosted Harper is endpoints-only, so the page is **served by an endpoint**: `scripts/build-pages.mjs` inlines `public/*.html` into `server/pages.ts` during `npm run build:server`, and the `privacy` / `age-rating` exports in `resources.js` return the HTML (Harper's path matcher strips the `.html` suffix). Deploy (`./deploy-coop.sh`) after rebuilding. The **age-suitability page** (`/age-rating.html`) documents the content basis for the ratings (Apple 4+ / ESRB Everyone / PEGI 3): non-violent, educational, no ads/IAP/chat/UGC. The **support page** (`/support.html`) is the ASC **Support URL**: contact email, in-game feedback pointer, and an FAQ. The **teachers page** (`/teachers`) is the classroom hub — learning goals, the single-session lesson, discussion prompts, and the two classroom PDFs; its `<style>` is `public/landing.html`'s copied verbatim, so re-copy it rather than tweaking one page's CSS alone. All of these pages are server-side only — editing them needs a rebuild + `./deploy-coop.sh`, never an App Store release. For the App Privacy questionnaire: the app collects **Gameplay Content / Product Interaction** (anonymous per-save-slot metrics snapshots, not linked to identity, for analytics) and, only when a player submits feedback, an optional **email address** (linked only to that feedback, for support). No tracking, no ads, no third-party analytics.

### Re-enabling co-op later

Co-op lives behind one switch — `COOP_ENABLED` in `src/features.ts`, wired through Vite's `__COOP_ENABLED__` define (`vite.config.ts`). Off by default; the co-op code dead-code-eliminates from the build. To bring it back, either build with `COOP_ENABLED=true npm run desktop:dist`, or flip the fallback in `src/features.ts` to `true` permanently — then point `COOP_BASE_URL` (`src/api.ts`) at a live co-op server and move `harper` back to `dependencies` if the desktop app needs a local Harper again. The co-op E2E suite already builds with the flag on, so multiplayer stays tested.

### Native modules

`steamworks.js` is the one **native** dependency the packaged app loads, so it must be built for Electron's ABI rather than your system Node's. electron-builder handles this automatically (`npmRebuild: true`), and `asarUnpack` keeps it outside the asar so its `.node` binary stays loadable. If a packaged build fails with a `NODE_MODULE_VERSION` mismatch, rebuild explicitly:

```bash
npx electron-rebuild -f -w steamworks.js
```

### Steam Stats & Achievements

The renderer owns the live metrics (solo in-app, co-op via the hosted Harper), so `src/solo/steamSync.ts` pushes the active player's `/Metrics/<playerId>` view to the main process every ~60s (and again on hide/quit); `electron/metrics-sync.js` maps the numbers onto Steam Stats and milestone achievements via `electron/steam.js`. Everything no-ops unless the app is launched through Steam, so `npm run desktop` still works.

Define these in the Steamworks dashboard with matching API names:

- **Stats (INT):** `play_minutes`, `sessions`, `resources_collected`, `items_crafted`, `objects_placed`, `plants_planted`, `animals_observed`, `animals_returned`, `biomes_unlocked`.
- **Achievements:** `ACH_FIRST_ANIMAL`, `ACH_FIRST_CRAFT`, `ACH_SECOND_BIOME`, `ACH_NATURALIST`, `ACH_GREEN_THUMB`, `ACH_DEDICATED` — unlock thresholds live in `ACHIEVEMENTS` in `metrics-sync.js`.

For development, `steam_appid.txt` holds `480` (Valve's public test app) so the Steam API initializes with the Steam client running. Set `WW_STEAM_APPID` or replace the file with your real App ID once you have one; in packaged Steam builds Steam injects the App ID.

### Troubleshooting & knobs

- **Reset a solo world** — delete the relevant save file in `userData/saves/` (all of them for a clean slate). On macOS `userData` is `~/Library/Application Support/Wild Willows`.
- **Co-op can't connect** — solo needs no network, but co-op must reach `COOP_BASE_URL`; the packaged app's `file://` origin (`Origin: null`) means the hosted Harper has to send CORS headers that allow it.
- **`WW_STEAM_APPID`** — override the Steam App ID (otherwise `steam_appid.txt`, else `480` in dev).

### Next: a Steam release

itch.io is the v1 home. Steam is the natural next step — most of the plumbing is already here (`electron/steam.js` + `metrics-sync.js` wire stats/achievements through `steamworks.js`, and they no-op safely until launched through Steam). What's left before flipping that on:

- **App ID & depots** — register the app in Steamworks, replace `steam_appid.txt` (`480` dev placeholder) with the real ID, and upload the **unpacked** per-OS folders as depots via `steamcmd` (Steam runs the app directly, unlike itch's installers).
- **Stats & achievements config** — define the Stats/Achievements listed above in the Steamworks dashboard with matching API names so the existing push (`metrics-sync.js`) lights them up.
- **Code signing** — macOS signing + notarization is wired up (see above); Windows signing still needs a code-signing cert to clear SmartScreen.
- **Controller support** — the game is keyboard-only today; add gamepad input for Steam Deck Verified and couch play.
- **Steam Cloud** — sync `userData/saves/` so solo progress follows players across machines.
- **Steam overlay** — `electronEnableSteamOverlay()` is already called in `steam.js`; verify it attaches in a packaged build.
- **(If co-op returns) Co-op CORS** — confirm the hosted Harper allows the desktop's `file://` (`Origin: null`) origin on the co-op endpoints.

---

## Database schema (`schema.graphql`)

Definition tables, seeded from `data/*.json` by the built-in dataLoader: `Biome` · `Animal` · `ResourceType` · `Recipe` · `HabitatObject` · `ToolDef` · `Achievement`.

Personal tables (keyed by playerId): `Player` (inventory, crafted items, `craftedEver`, tool tiers, unlocked biomes, position, tutorial step, home config, active `worldId`, and a `metrics` blob) · `PlayerAchievement` (one row per earned achievement).

World-owned tables (keyed by `worldId`; solo world id === player id): `BiomeState` (health, balance, returned count, unlocked) · `Chest` · `Placement` · `Discovery` (returned animals) · `NodeState` (node regen timestamps) · `TerrainTile` (tilled / watered / open-water tiles) · `FeedEntry` (shared activity feed, last 100 per world). `worldId` is declared **last** on each of these tables and **un-indexed** — Harper's structured encoder only tolerates new attributes appended at the end, so the column was added without rewriting existing rows (legacy rows read it as null; `byWorld` falls back to playerId).

Co-op tables: `World` (id, name, solo, ownerId, joinCode, maxMembers) · `WorldMember` (membership: worldId, playerId, role) · `WorldPresence` (`@export`-ed; one record per world holding the live positions map, subscribed over WebSocket) · `JoinRequest` (pending/approved/denied join requests by token).

Standalone tables: `Feedback` (player-submitted feedback: message, optional reply email, diagnostic context; written via `POST /SubmitFeedback/`, readable only by an authenticated super user via `GET /ListFeedback/`) · `SoloMetrics` (one row per solo save slot, upserted by the desktop metrics uplink via `POST /SyncMetrics/`) · `AppOpen` (acquisition funnel: one row per install/device, upserted by `POST /AppOpen/` — opens vs. characters created).

Tables are deliberately **not** exported over REST — everything flows through the custom resources below. On boot the server **reconciles** the seed tables against the definition JSON, deleting any orphaned records left by a rename/removal (Harper's loader only upserts, so this prevents stale duplicates like an old "Water Restoration Kit"). Reads are also **self-healing**: `safeGet` force-decodes a record on read and, if a schema change ever left it un-decodable, **purges** the bad row and returns null rather than throwing — so one corrupt record can't break a scan or the co-op achievement fan-out.

## API resources (`server/resources.ts` → `resources.js`)

| Endpoint | Does |
|---|---|
| `GET /Version/` | Build stamp (app version + build time) baked into the bundle; `deploy-coop.sh` polls it after a deploy to catch a stale node, and the demo backend probe pings it |
| `GET /GameData/` | All static definitions + character appearance options. On the hosted Harper the ~300 KB JSON is served **brotli/gzip-compressed (~65 KB)** with a build-stamped ETag + `Cache-Control`, so repeat opens revalidate to an empty 304; the in-app solo backend receives the same data as a plain object |
| `POST /CreatePlayer/` · `POST /LoginPlayer/` · `POST /DeletePlayer/` | Create / load / delete a save (name + passcode) |
| `POST /DeleteDemoSave/` · `POST /ExportDemoSave/` | Demo-only, passcode-free: delete or export a demo save — both refuse anything not tagged `edition:'demo'`, so a real save can't be touched |
| `POST /ChangePasscode/` · `POST /UpdateAppearance/` | Change a save's passcode (current one must match) / restyle your caretaker anytime |
| `GET /GameState/<playerId>` | Full state snapshot |
| `POST /CollectResource/` | Gather from a node (cooldown, basket capacity, tool-tier yield 1–4) |
| `POST /ChestTransfer/` | Deposit / withdraw with capacity enforced |
| `POST /CraftItem/` | Craft from basket + all chests; restoration kits are one-time |
| `POST /PlaceObject/` · `POST /RemoveObject/` · `POST /MoveObject/` | Place / pick up / relocate objects → recalculates the biome |
| `POST /DiscardItem/` | Throw away basket materials or crafted items (server-validated; kits can't be discarded) |
| `POST /Plant/` | Plant into a watered bed; the plant grows in over time |
| `POST /HarvestPlacement/` | Gather a mature plant's yield; it regrows after `regrowSeconds`, so a planted bed is a renewable source rather than dig-up-and-replant |
| `POST /Terraform/` | Shovel digs beds, watering can waters (1 water) or floods into open water; dry biomes can't be flooded |
| `POST /UpgradeTool/` | Tool upgrades (materials + biome-progress gates) |
| `POST /UpgradeHome/` | Level up one of the home's upgrade tracks (materials + biome-progress gate) |
| `POST /SetHomeStyle/` | Build your home in a chosen style (Log Cabin / Meadow Cottage / Stone Hearth) — the first upgrade |
| `POST /SetHomeColors/` · `POST /SetPlacementColor/` | Paint tool: recolor the home interior (floor/wall/accent, built homes only) / recolor one placed item |
| `POST /Rest/` | Sleep in your bed or sleeping bag to refresh every gathering spot |
| `POST /ClaimTask/` | Claim a finished daily task's reward (the board itself is derived per world + UTC day; only claims are stored) |
| `POST /SetGoals/` | Replace the player's pinned goal list (goals are derived server-side, so a crafted request can't grant itself rewards) |
| `POST /ObserveAnimal/` | Record a field-journal observation |
| `POST /RecalcBiome/` | Re-evaluate health / balance / animal returns (also fires when a plant matures) |
| `POST /SyncPlayer/` | Persist position / area changes (seeds an area's starting terrain on first entry) |
| `POST /Heartbeat/` | Accrue play time + session counts while the game is open |
| `POST /AppendFeed/` | Persist activity-feed messages (pruned to the last 100 per world) |
| `POST /MyWorlds/` · `POST /CreateWorld/` · `POST /JoinWorld/` · `POST /SwitchWorld/` · `POST /LeaveWorld/` · `POST /WorldRoster/` | Co-op worlds: list / host / join / switch / leave / roster of everyone who's ever joined |
| `POST /CheckWorldCode/` · `POST /RequestJoin/` · `POST /JoinRequestStatus/` · `POST /PendingJoinRequests/` · `POST /ResolveJoin/` | Co-op join flow: verify a code, request to join, poll status, host's inbox, host approve/deny |
| `POST /Presence/` | Co-op live presence (positions merged into `WorldPresence`, pushed over WebSocket) |
| `GET /Metrics/<playerId>` | One player's own live metrics view (public — knowing the save UUID is the capability, as everywhere else) |
| `GET /MetricsSummary/` · `GET /MetricsPlayers/` | Analytics roll-up: aggregates, and per-player rows (paginated). **Super-user only** (see below) |
| `POST /SyncMetrics/` | Solo metrics uplink: upserts one solo save's metrics snapshot into `SoloMetrics`, keyed by the save slot's UUID (see Metrics & analytics) |
| `POST /AppOpen/` | Acquisition-funnel ping, one row per install/device: app opens vs. characters created (bounce), time spent in the creator; carries `edition` |
| `POST /SubmitFeedback/` · `GET /ListFeedback/` | Player feedback (message + optional reply email + diagnostic context) → `Feedback` table; reading it back is super-user-only |
| `GET /dashboard` | Internal gameplay-metrics dashboard page — renders `/MetricsSummary/` + `/MetricsPlayers/` (audience, funnels, progression, achievements, customized caretakers). **Super-user only**, along with the `/SaveHealth/`, `/GameplayHealth/` and `/LandingStats/` feeds it reads |
| `POST /DevTools/` | Developer-only testing helpers (restricted to one save) |
| `GET /privacy.html` · `GET /age-rating.html` · `GET /support.html` | Store-listing pages (privacy policy, age suitability, support/FAQ) served as endpoints — HTML inlined from `public/*.html` by `scripts/build-pages.mjs` |
| `GET /img/<name>.webp` | The landing + teachers page screenshots, content-hashed and served `immutable` for a year. They were base64 data URIs inside the HTML until the pages hit 470 KB and 260 KB of render-blocking document; as real URLs the pages are ~66 KB each, the images cache independently, and the four screenshots BOTH pages use are fetched once. Bytes ride along in `server/img-assets.ts` (generated from `public/img/`) |
| `GET /teachers` | The classroom page — what the game teaches, the 45–60 min lesson arc, discussion prompts, and the two free PDFs. Same inlining path as the pages above; its own URL rather than an anchor on `/` because teachers arrive from a different search and need something shareable |

---

## Systems internals

Design-level descriptions of these systems live in the [README](README.md); what follows is how they're implemented.

### Biome recalculation

On every change the biome is recalculated: **health** is 5 baseline + the health value of placed objects + tended soil/open-water bonuses, on a gentle curve toward 100. **Ecological balance** combines three signals — the fraction of the biome's animals returned (45%), the fraction of its predators / top-of-chain species back (35%), and trophic breadth, how many different animal *kinds* are represented (20%) — so it cannot reach 100% until every animal in the biome is back. Each animal's return requirements (health, balance, habitat objects, water features, prerequisite animals) are checked against that; animals return **one at a time** per change. Freshly planted habitat doesn't count until it matures, and maturing re-triggers the check, so anything now eligible arrives on its own.

### Weather & seasons

Weather is a **pure deterministic function of `(worldId, biome, play-time)`** computed in `server/weather.ts` and stamped into every state snapshot — no extra tables, identical for everyone in a co-op world, and exactly forecastable. The calendar advances from accrued play time via the heartbeat, not the wall clock, so a world you leave for a week is exactly where you left it. The same dependency-free module is imported by the client (`src/weather.ts`) for a live clock and forecast that stay in step with the server. Per-biome, per-season **climate weights** in `data/weather.json` bias which of the seven weather types a biome rolls; that file's `gather` map also defines the weather-gated resource pairings, and the server re-checks the live weather before granting one so they can't be gathered out of season.

### Daily tasks

Three light goals per real (UTC) day, derived deterministically from `(worldId, day)` — no stored task rows, no scheduler. Progress reads per-day counters bumped by normal play; only claims are stored (`POST /ClaimTask/`).

### Field-guide guessing

The expanded guide's "which habitat object is this animal waiting for?" prompt is deterministic per animal (seeded on its id), so it can't be rerolled into an easier one. Guesses live in `localStorage` via `src/fieldGuess.ts`, never in the save or on the wire: they grant nothing and gate nothing. The **Sources** list on each full entry is drawn from the `sources` array every animal record carries.

### Localization (i18n)

All player-facing text flows through a zero-dependency i18n layer (`src/i18n/`). The game ships in **English and Spanish** (pick on the title screen or in Settings → Language); non-English catalogs are lazy-loaded as their own Vite chunks, so English players never download them. `core.ts` is the engine — `t(key, params)` with `{name}` interpolation and `{one, other}` plurals, `tList()` for randomized line pools, and `content(kind, id, field, fallback)` for data-content overlays — and it's environment-free, so the exact same module runs in the React UI, in Phaser, inside `server/resources.ts` (both the hosted bundle and the solo in-renderer import — in solo, switching language localizes server errors live), and under Vitest.

English catalogs live in `src/i18n/en/` split by area: `app.json` (shell, HUD, toasts, settings), `panels.json` (journal, crafting, achievements, tutorial, help…), `narrative.json` (feed beats, per-biome line pools, biome lore), `game.json` (in-world Phaser prompts), and `server.json` (every `GameError`, daily tasks, "why it returned" prose). The client entry (`src/i18n/index.ts`) registers all of them and persists the language choice; the server entry (`src/i18n/server.ts`) registers only `server.json` so the hosted bundle stays lean.

**Game content** (animal names/facts, recipes, biomes, weather guide prose in `data/*.json`) is *not* duplicated into catalogs — display sites wrap it in `content()`, whose fallback is the English text already in the data. `npm run i18n:extract` generates the full translator template (`src/i18n/templates/content.en.json`, ~1,900 fields); a translation is that file copied to `src/i18n/<locale>/content.json` with values translated.

**Adding a language:** create `src/i18n/<locale>/*.json` mirroring the en catalogs (plus the content overlay from the template — partial files are fine, everything falls back to English), add a lazy loader + `LOCALE_NAMES` entry in `src/i18n/index.ts`, and it appears in both language pickers. Spanish (`src/i18n/es/`) is the reference implementation. `npm run i18n:check` (also part of `npm run check`, so CI runs it) lints that every `t()` key referenced in code exists in the en catalogs and reports locale-parity gaps for any other locale; `tests/unit/i18n-es.test.ts` additionally enforces full es↔en key, placeholder, and pool-length parity. Known v1 limits: hosted co-op errors stay English (no per-request locale yet), persisted feed entries keep the language they were written in, and the store-listing pages (`public/*.html`) are deliberately English-only.

### Co-op internals

Each client publishes its exact position ~12×/sec via `POST /Presence/`, which merges it into the per-world `WorldPresence` record and returns the current positions map; Phaser interpolates between updates. (This uses short, quickly-closed reads on purpose — a long-lived WebSocket subscription to the record would hold a Harper read transaction open and get force-closed after a few minutes.) Other world changes (placing, terraforming, collecting) sync on a ~1.5s timer. World-owned state is keyed by `worldId`, declared at the end of each table and un-indexed so the column could be added without rewriting existing rows; single-player is modelled as a private "world of one" whose id equals the player's id. Endpoints: `MyWorlds` · `CreateWorld` · `JoinWorld` · `SwitchWorld` · `LeaveWorld` · `Presence` · `CheckWorldCode` · `RequestJoin` · `JoinRequestStatus` · `PendingJoinRequests` · `ResolveJoin`.

---

## Metrics & analytics

A client **heartbeat** accrues play time and counts sessions while the game is open (paused when the tab is hidden). The read-only **Metrics** endpoints surface it for dashboards.

> **Access.** `GET /Metrics/<playerId>` is public, because the game client reads its own view through it and knowing the save's UUID is the capability — the same model as `/GameState/<playerId>`. **Everything else here is super-user only** (`curl -u HDB_ADMIN …`), the same treatment `/ListFeedback/` gets: the roll-up carries display names, exact first/last activity timestamps, OS, accessibility preferences, appearance and per-player behaviour, and it used to answer all of that to anyone who asked for `GET /Metrics/`. That URL now returns a 404 signpost and no data.

- `GET /Metrics/<playerId>` — one player's live view, computed on the fly from that player's own game state: play time, engagement intensity, recency/status, progression, per-biome health, an **achievements** block (earned/total, points, completion, recent unlocks, by-category counts), and a rendered **SVG snapshot** of each unlocked area (ground tinted by health, terrain and placed objects drawn in). This is exactly the view a solo client derives and uploads via `POST /SyncMetrics/`, so it always reads live game tables.
- `GET /MetricsSummary/` — the aggregate dashboard (**super-user only**), sourced **exclusively from the `SoloMetrics` table** (`source: "solo-metrics"`). It rolls up every uplinked snapshot into global **audience** (active/new buckets), **engagement**, **retention** (returning players), **progression** (incl. a tutorial-step histogram), composition breakdowns (**languages / platforms / operatingSystems / versions**), an **activation funnel** (created → collected → crafted → placed → attracted animal → unlocked 2nd biome), summed **actionTotals**, and an **achievements** summary (total earned, avg per player, avg completion, recent-unlock distribution, completion histogram). Hosted web/co-op players are intentionally out of scope. Optional `?exclude=<name>` (repeatable and/or comma-separated, case-insensitive) drops saves by display name so your own test data doesn't skew the numbers; the dropped names are echoed in `summary.excludedNames`. `?version` / `?versionMode=min` / `?edition` / `?platform` / `?idle=exclude` scope the whole report. `?excludeDevice=<deviceId>` (repeatable and/or comma-separated) is the acquisition-side twin of `?exclude=`: the funnel reads `AppOpen`, one row per install with no save name on it, so your own development launches used to keep counting as app opens — and because a dev machine is only one *device*, the distortion landed almost entirely in `totalOpens` and `totalCharactersCreated` where it is hardest to spot. `acquisition.deviceRoster` lists the top 30 devices busiest-first (built *before* the exclusion, each marked `excluded`) so the dashboard's Devices panel can offer a hide/show toggle, and `acquisition.excludedDevices` reports exactly how many devices, opens and characters were removed. This response is ~6 KB — it no longer carries the player rows.
- `GET /MetricsPlayers/` — the per-player rows (**super-user only**), one record per reporting save, newest-active first. `?limit=` (default 100, max 500) and `?cursor=` page through; `nextCursor` is null on the last page. Takes the same filters as the summary, so both halves always describe one population. `GET /MetricsPlayers/<playerId>` returns one full row; `?fields=list` returns a lean shape for table views. A full row is byte-for-byte what the old `/Metrics/` response carried in `players[]` — nothing renamed, nothing dropped.
- **Two aggregates read differently than their names suggest, so both now say so in the payload.** `summary.sessionLengths` reports `sessionsCovered` / `totalSessions` / `coveragePct` next to the buckets, because the histogram only ever covered sessions a client recorded a length for (it was totalling ~24 while `engagement.totalSessions` said 364). And `summary.timeToFirstAction` now leads with `medianSeconds` plus a `trimmedAvgSeconds`: `avgSeconds` keeps its old meaning and is still there, but a few saves left open before anyone touched them had it reading 4924s — 82 minutes — for an onboarding step that really takes 6-20s. `sessionLengthDistribution` and `avgSeconds` are untouched so existing readers keep working.
- **A per-day series** (`summary.daily`). One entry per day, from the first save created to the most recent activity, and **dense** — days with nobody are zeros, because a chart that omits them draws a busier game than exists. `created` is exact (a save is made once, on a known day). `lastSeen` is the day each save was **last** active, **not** daily active players: a row carries a single `lastSeenAt`, so someone who played all week counts once, on their final day, and the earlier days are unrecoverable. It is named and annotated for what it is rather than charted as DAU; real DAU would need a per-day record the uplink doesn't keep. The dashboard's range picker scopes **only that chart** — nearly every other number on the page is a lifetime total carried on a save (play time, actions, biome health), so a picker that appeared to scope the whole report would be answering a question the data can't.
- **Demo → full carry-over** (`summary.conversions`, plus `convertedFromDemo` / `conversion` on each player row). The strongest signal the demo is earning its keep isn't "finished the demo", it's "bought the game and brought their meadow across". Detected two ways: `ExportDemoSave` stamps `convertedFromDemoAt` + frozen `demoPlaySeconds`/`demoSessions`/`demoActions` onto the copy the player downloads (authoritative, survives the demo row being deleted), and the roll-up also **pairs** an imported save with its original demo row — importing mints a fresh slot id, so both `SoloMetrics` rows exist and share the save's own id (`savePlayerId`, a `<name-slug>-<random6>` minted once by `CreatePlayer` and carried through export/import unchanged). The pairing is what makes conversions that happened *before* the stamp existed visible with no client update; those are reported as `inferred` with `conversion.exact: false` rather than presented as a known timestamp. The demo half of a pair is marked `supersededByFull` rather than deleted, and `conversions.supersededDemoSaves` says how many rows `summary.players` therefore counts twice.
- Action counters are bumped on every gameplay endpoint (collect, craft, place, plant, terraform, move, remove, upgrade tool/home, build/repaint home, rest, chest transfer, discard, observe, claim task, appearance). Purely cosmetic counters (`recolors`, `appearanceChanges`) are recorded in `counts` for insight but excluded from `totalActions`/`actionsPerMinute` so those stay a gameplay-intensity signal.

**Solo metrics uplink.** Solo players never appear in the hosted `Player` table (their world lives in local save files), so the client periodically POSTs the local save's derived metrics view to the hosted Harper (`src/solo/metricsUplink.ts` → `POST /SyncMetrics/` → `SoloMetrics` table, every ~5 min plus a flush on hide/close). Each report is a full snapshot keyed by the save slot's UUID, so missed reports lose nothing; it's strictly best-effort and solo stays fully playable offline. The global roll-up (`/MetricsSummary/` + `/MetricsPlayers/`) reads only these `SoloMetrics` rows — there's no way for the server to aggregate a solo save that hasn't uplinked, since the save itself lives only on the player's machine. What's sent and why is spelled out for players in the privacy policy (`public/privacy.html`, inlined into `resources.js` by `scripts/build-pages.mjs` and served by the `privacy` endpoint at `/privacy.html`; prose source of truth `PRIVACY.md`).

**Player feedback.** Settings has a feedback form (`src/feedback.ts`): the message, an optional reply email, and light diagnostic context (version, build, platform/OS, progression numbers) POST to the hosted Harper's `/SubmitFeedback/` — even from the solo desktop build, since it must land in the shared `Feedback` table. Offline sends queue in localStorage and retry each session until the server confirms storage. Reading feedback back is super-user-only (`GET /ListFeedback/`).

## Saves & developer tools

Each save is a name + passcode pair. Passcodes are **never stored in plaintext** — each save keeps a random salt and a scrypt hash, verified in constant time; legacy plaintext saves are transparently re-hashed on their next login. No secret fields (passcode, hash, or salt) are ever returned to the client. **Settings → Lock this save** logs out and clears the remembered session so reopening requires the passcode. A hidden **developer panel** (opened with **Cmd/Ctrl + Shift + Delete** so players won't stumble onto it; no username gate) offers testing helpers: reseed/clear an area's terrain, grant chosen amounts of each resource, max all tools, unlock all biomes, and set biome health.

## Notes & simplifications

- Passcodes are salted + scrypt-hashed, but auth is still lightweight: game endpoints identify a save by the `playerId` in the request body rather than a verified session token, so anyone who knows a save's id could act on it. Add per-request session tokens (issued on login/create, checked on every mutation) before anything public.
- Animal behavior is gentle wandering + click-to-observe. Weather and seasons are in; there's deliberately **no day/night cycle** — the only ambient thing that changes is the weather itself.
- Harper subtlety: conditional searches inside one transaction don't see that transaction's own writes, so endpoints pass fresh records into recalculation explicitly (see comments in `server/resources.ts`).
