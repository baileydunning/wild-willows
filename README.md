# Wild Willows 🌿

A cozy nature-restoration life sim. You've set up camp at the edge of a damaged nature preserve: gather fallen materials, craft and plant habitat, shape the land biome by biome — and real animals return when the habitat truly supports them.

**Harper is the source of truth.** Player progress, inventory, chests, crafting, placements, terrain, biome health, ecological balance, animal discoveries, comfort levels, tool upgrades, biome unlocks, and play metrics all live in Harper and are validated server-side. The browser never computes game state on its own.

Built with TypeScript, React + Vite (UI shell), Phaser 3 (world), and Harper v5 (database, API resources, seeded data). **The hosted Harper is endpoints only** — it serves no static files; the game UI ships inside the desktop app (locally, Vite serves it and proxies API calls to Harper). All art — terrain, objects, animals, the player, and journal thumbnails — is procedurally generated from simple shapes at boot, so the game ships with zero asset files.

---

## Run it locally

Prerequisites: Node 24+, Harper v5 (`npm install -g harper`).

```bash
npm install
npm run dev          # terminal 1 — builds resources.js, starts Harper (API only) on :9926
npm run dev:web      # terminal 2 — vite serves the UI on http://localhost:5173, proxying API calls to Harper
```

Open **http://localhost:5173/**. Harper is **endpoints only** (no static hosting — see `config.yaml`), so the UI is always served by Vite locally; the dev proxy (`vite.config.ts`) accepts Harper's self-signed local certificate for you. Choose **New Game**, customize your caretaker (skin, hair color, hairstyle, build, outfit, hat), pick a name and passcode, and begin. **Load Game** signs back into any save from any browser; the last save on a device also gets a one-click **Continue**. An interactive tutorial walks new caretakers through the loop (skippable; progress saved to Harper).

> **Keyboard required.** Wild Willows is a keyboard game (WASD/arrows to roam, letter keys for panels, number keys for tools), so it gates to devices with a keyboard. A computer (any mouse/trackpad) is allowed; a touch-only phone/tablet sees a "connect a keyboard" screen until a key is pressed.

After changing `server/resources.ts`, run `npm run build:server` (or restart `npm run dev`, which rebuilds then starts `harper dev .`). To check the **production build** instead of the dev server, `npm run build:web && npx vite preview` serves it on :4173 with the same API proxy. A scripted end-to-end API check lives at `scripts/smoke-test.sh`.

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

The **integration harness** (`tests/integration/harness.ts`) installs lightweight stand-ins for Harper's `databases` / `Resource` globals, then imports the committed `resources.js` — the exact artifact `harper deploy` ships — giving each test a fresh in-memory world seeded from `data/*.json`. It's the same technique as the `scripts/coop-harness.mjs` smoke harness, refactored for Vitest. The **solo E2E** reaches offline mode by setting `window.wildWillowsDesktop = { isDesktop: true }` before the app boots, which flips the API transport to the in-app solo backend (no network). The **co-op E2E** CI job boots Harper with `harper run .` (endpoints only) and waits for `/GameData/`; Playwright's own webServer then builds the app with `COOP_ENABLED=true` and serves it via `vite preview`, whose proxy carries API calls to that Harper. For a quick manual end-to-end API check there's also `scripts/smoke-test.sh`.

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

- **Solo** (the v1 build) runs **entirely in-app and offline.** The same server logic (`server/resources.ts`) executes in the renderer against an in-memory `LocalDb` (`src/solo/`) seeded from `data/*.json`; after each action the world is serialized to a save slot. No passcode — solo saves are local JSON files in `userData/saves/<slotId>.json`, read/written over IPC (`electron/main.js`).
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

App Store Connect also needs **screenshots** (`scripts/mas-screenshots.py` converts window captures to Apple's required 16:10 sizes by scaling to 2880×1800 and edge-padding) and a **privacy policy URL** — that's `public/privacy.html` (prose source of truth: `PRIVACY.md`), served at `https://wild.willows.harperfabric.com/privacy.html`. The hosted Harper is endpoints-only, so the page is **served by an endpoint**: `scripts/build-pages.mjs` inlines `public/*.html` into `server/pages.ts` during `npm run build:server`, and the `privacy` / `age-rating` exports in `resources.js` return the HTML (Harper's path matcher strips the `.html` suffix). Deploy (`./deploy-coop.sh`) after rebuilding. The **age-suitability page** (`/age-rating.html`) documents the content basis for the ratings (Apple 4+ / ESRB Everyone / PEGI 3): non-violent, educational, no ads/IAP/chat/UGC. For the App Privacy questionnaire: the app collects **Gameplay Content / Product Interaction** (anonymous per-save-slot metrics snapshots, not linked to identity, for analytics) and, only when a player submits feedback, an optional **email address** (linked only to that feedback, for support). No tracking, no ads, no third-party analytics.

### Re-enabling co-op later

Co-op lives behind one switch — `COOP_ENABLED` in `src/features.ts`, wired through Vite's `__COOP_ENABLED__` define (`vite.config.ts`). Off by default; the co-op code dead-code-eliminates from the build. To bring it back, either build with `COOP_ENABLED=true npm run desktop:dist`, or flip the fallback in `src/features.ts` to `true` permanently — then point `COOP_BASE_URL` (`src/api.ts`) at a live co-op server and move `harper` back to `dependencies` if the desktop app needs a local Harper again. The co-op E2E suite already builds with the flag on, so multiplayer stays tested.

### Native modules

`steamworks.js` is the one **native** dependency the packaged app loads, so it must be built for Electron's ABI rather than your system Node's. electron-builder handles this automatically (`npmRebuild: true`), and `asarUnpack` keeps it outside the asar so its `.node` binary stays loadable. If a packaged build fails with a `NODE_MODULE_VERSION` mismatch, rebuild explicitly:

```bash
npx electron-rebuild -f -w steamworks.js
```

### Steam Stats & Achievements

The renderer owns the live metrics (solo in-app, co-op via the hosted Harper), so `src/solo/steamSync.ts` pushes the active player's `/Metrics/` view to the main process every ~60s (and again on hide/quit); `electron/metrics-sync.js` maps the numbers onto Steam Stats and milestone achievements via `electron/steam.js`. Everything no-ops unless the app is launched through Steam, so `npm run desktop` still works.

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

## Content at a glance

- **6 biomes** — Willow Meadow, Old Hollow Forest, Rushwater Wetland, Redstone Scrubland (desert), Graywind Heights (alpine), Pelican Shore (coastal). All six are explorable on foot and fully restorable.
- **150 animals** — **25 per biome**, each with diet, shelter, a real-world fact, and habitat return requirements. Every animal has a **unique, procedurally-built sprite** composed from its species traits (quills for a porcupine, antlers for a deer, long legs for a heron, a domed shell for a turtle, claws for a crab…), so no two read alike.
- **175 habitat objects** and **146 recipes** across habitat, structures & decor, paths, storage, camp comforts, and restoration kits. Plantable flowers/grasses/trees are **planted, not crafted** (see below), so 132 of the recipes are craftable items and the remaining 14 are the plant set.
- **Unlockable crafting** — most recipes start locked and unlock one at a time as a biome recovers (health crossed, a keystone animal welcomed), with a clear "New Crafting Recipe Unlocked" callout. New caretakers begin with a handful of starter recipes (Grass Patch + a few) and **almost no materials** (just a little water, seeds, and wildflowers) — the first job is to gather.
- **Three chest sizes** — Small (**120**), Medium (**250**), and a Large Chest (**500**) that unlocks later, once Redstone Scrubland is restored to 60% and you've crafted a Medium Chest first.
- **38 gatherable resources**, including biome-exclusive ones (e.g. geode and agave nectar in the desert; quartz crystal, obsidian, pine nuts, lichen, juniper berries, and packed snow in the alpine) and **5 weather-gated rarities** that only surface during the right weather (see **Weather & seasons**). Node generation **guarantees every resource appears** in its biome, and early staples like fallen branches keep at least three spots in the meadow and forest.
- **4 tools** with deep upgrade tracks (basket/shovel/watering can each have 4 tiers; the field journal has 7 — a baseline plus one guide per area).
- Every biome has **at least 3 plantable tree types** plus its own distinct plants, palette, and animals.
- **50 achievements** earned for restoration milestones, food-web moments (keystones, predators, ecosystem engineers), gathering/crafting/terraforming mastery, and preserve-wide progress (no hidden ones; locked entries show a non-spoilery hint). The first, **First Friend**, is earned the moment you welcome the grasshopper home — and the **grasshopper is always the first animal to return anywhere**: every other animal is gated behind it. All are server-validated and shown in a dedicated **Achievements** menu (press **K**), most-recent unlocks first, each card a gold ★ badge around its own unique glyph.
- **A home you can step inside, decorate, and upgrade.** Walk up to your camp tent in Willow Meadow and press **E** to step into your home interior (the sign right by the door upgrades it). Decorate by crafting **indoor-only "camp comfort" items** — a starter sleeping bag, rug, lamp, house plant, plus hammock, string lights, armchair, fireplace, bookshelf and more — and placing them on the floor (the crafting menu has a dedicated **"Inside your home"** filter). Some bigger pieces (fireplace, bed, bookshelf, armchair) need a proper **house**, not the starter tent. First you **build** your home by choosing one of three distinct styles — a **Log Cabin** (wood), a **Meadow Cottage** (fiber & flowers), or a **Stone Hearth** (stone) — each built from its own materials, which sets its look for good. After that, upgrade along its **upgrade tracks** — **Space** (bigger room), **Comfort** (a flat carry-capacity perk on top of your basket), **Furnishings** (rug + wall trim), and **Warmth** (windows + a hearth glow). Upgrades cost materials and a little biome progress.
- **Daily tasks** — a small rotating board of three light goals per real (UTC) day (gather / craft / place / water / plant / observe), derived deterministically from `(worldId, day)` — no stored task rows, no scheduler. Progress reads per-day counters bumped by normal play; rewards are small material bundles drawn from your unlocked biomes. The board sits under the top-right nav (**O** collapses it) and disappears once everything's claimed.
- **A living, biome-specific feed.** A corner activity feed narrates everything you do, and the notable beats also persist to a **Feed** menu (press **F**, last 100 kept per player in Harper); the prominent toast notifications are reserved for the big moments (animal returns, biome unlocks, achievements, errors). The narrative is woven into the feed: as combinations of animals and crafted habitat come together, contextual lines surface — predator + prey, ecosystem engineers, keystone species — and each biome has **50+ randomized lines** (ecology, atmosphere, coexistence, and fun facts) that appear over time, **always specific to the area you're in**, with many gated to that biome's recovery, the animals back there, or the habitat you've built. Crossing a biome health threshold and welcoming an animal both add their own beats.

## Database schema (`schema.graphql`)

Definition tables, seeded from `data/*.json` by the built-in dataLoader: `Biome` · `Animal` · `ResourceType` · `Recipe` · `HabitatObject` · `ToolDef` · `Achievement`.

Personal tables (keyed by playerId): `Player` (inventory, crafted items, `craftedEver`, tool tiers, unlocked biomes, position, tutorial step, home config, active `worldId`, and a `metrics` blob) · `PlayerAchievement` (one row per earned achievement).

World-owned tables (keyed by `worldId`; solo world id === player id): `BiomeState` (health, balance, returned count, unlocked) · `Chest` · `Placement` · `Discovery` (returned animals) · `NodeState` (node regen timestamps) · `TerrainTile` (tilled / watered / open-water tiles) · `FeedEntry` (shared activity feed, last 100 per world). `worldId` is declared **last** on each of these tables and **un-indexed** — Harper's structured encoder only tolerates new attributes appended at the end, so the column was added without rewriting existing rows (legacy rows read it as null; `byWorld` falls back to playerId).

Co-op tables: `World` (id, name, solo, ownerId, joinCode, maxMembers) · `WorldMember` (membership: worldId, playerId, role) · `WorldPresence` (`@export`-ed; one record per world holding the live positions map, subscribed over WebSocket) · `JoinRequest` (pending/approved/denied join requests by token).

Standalone tables: `Feedback` (player-submitted feedback: message, optional reply email, diagnostic context; written via `POST /SubmitFeedback/`, readable only by an authenticated super user via `GET /ListFeedback/`) · `SoloMetrics` (one row per solo save slot, upserted by the desktop metrics uplink via `POST /SyncMetrics/`).

Tables are deliberately **not** exported over REST — everything flows through the custom resources below. On boot the server **reconciles** the seed tables against the definition JSON, deleting any orphaned records left by a rename/removal (Harper's loader only upserts, so this prevents stale duplicates like an old "Water Restoration Kit").

## API resources (`server/resources.ts` → `resources.js`)

| Endpoint | Does |
|---|---|
| `GET /GameData/` | All static definitions + character appearance options |
| `POST /CreatePlayer/` · `POST /LoginPlayer/` · `POST /DeletePlayer/` | Create / load / delete a save (name + passcode) |
| `POST /ChangePasscode/` · `POST /UpdateAppearance/` | Change a save's passcode (current one must match) / restyle your caretaker anytime |
| `GET /GameState/<playerId>` | Full state snapshot |
| `POST /CollectResource/` | Gather from a node (cooldown, basket capacity, tool-tier yield 1–4) |
| `POST /ChestTransfer/` | Deposit / withdraw with capacity enforced |
| `POST /CraftItem/` | Craft from basket + all chests; restoration kits are one-time |
| `POST /PlaceObject/` · `POST /RemoveObject/` · `POST /MoveObject/` | Place / pick up / relocate objects → recalculates the biome |
| `POST /DiscardItem/` | Throw away basket materials or crafted items (server-validated; kits can't be discarded) |
| `POST /Plant/` | Plant into a watered bed; the plant grows in over time |
| `POST /Terraform/` | Shovel digs beds, watering can waters (1 water) or floods into open water; dry biomes can't be flooded |
| `POST /UpgradeTool/` | Tool upgrades (materials + biome-progress gates) |
| `POST /UpgradeHome/` | Level up one of the home's upgrade tracks (materials + biome-progress gate) |
| `POST /SetHomeStyle/` | Build your home in a chosen style (Log Cabin / Meadow Cottage / Stone Hearth) — the first upgrade |
| `POST /SetHomeColors/` · `POST /SetPlacementColor/` | Paint tool: recolor the home interior (floor/wall/accent, built homes only) / recolor one placed item |
| `POST /Rest/` | Sleep in your bed or sleeping bag to refresh every gathering spot |
| `POST /ClaimTask/` | Claim a finished daily task's reward (the board itself is derived per world + UTC day; only claims are stored) |
| `POST /ObserveAnimal/` | Record a field-journal observation |
| `POST /RecalcBiome/` | Re-evaluate health / balance / animal returns (also fires when a plant matures) |
| `POST /SyncPlayer/` | Persist position / area changes (seeds an area's starting terrain on first entry) |
| `POST /Heartbeat/` | Accrue play time + session counts while the game is open |
| `POST /AppendFeed/` | Persist activity-feed messages (pruned to the last 100 per world) |
| `POST /MyWorlds/` · `POST /CreateWorld/` · `POST /JoinWorld/` · `POST /SwitchWorld/` · `POST /LeaveWorld/` · `POST /WorldRoster/` | Co-op worlds: list / host / join / switch / leave / roster of everyone who's ever joined (see Co-op multiplayer) |
| `POST /CheckWorldCode/` · `POST /RequestJoin/` · `POST /JoinRequestStatus/` · `POST /PendingJoinRequests/` · `POST /ResolveJoin/` | Co-op join flow: verify a code, request to join, poll status, host's inbox, host approve/deny |
| `POST /Presence/` | Co-op live presence (positions merged into `WorldPresence`, pushed over WebSocket) |
| `GET /Metrics/` · `GET /Metrics/<playerId>` | Analytics dashboard (see below) |
| `POST /SyncMetrics/` | Solo metrics uplink: upserts one solo save's metrics snapshot into `SoloMetrics`, keyed by the save slot's UUID (see Metrics & analytics) |
| `POST /SubmitFeedback/` · `GET /ListFeedback/` | Player feedback (message + optional reply email + diagnostic context) → `Feedback` table; reading it back is super-user-only |
| `GET /BiomeSnapshot/<playerId>` | Generated SVG "postcards" of each area |
| `POST /DevTools/` | Developer-only testing helpers (restricted to one save) |
| `GET /privacy.html` · `GET /age-rating.html` | Policy pages (privacy policy, age suitability) served as endpoints — HTML inlined from `public/*.html` by `scripts/build-pages.mjs`, for store listings |

## How animals return

On every change the biome is recalculated:

- **Health** = 5 baseline + the health value of placed objects + tended soil/open-water bonuses, on a gentle curve toward 100. The ground visibly greens (or warms, in the desert) as it rises.
- **Ecological balance** measures how complete the **food web** is, from three signals: the fraction of the biome's animals that have returned (45%), the fraction of its **predators / top-of-chain species** back (35%) — these depend on prey, so a biome of herbivores with no predators correctly reads as unbalanced — and **trophic breadth**, how many different animal *kinds* are represented (20%). By design it **cannot reach 100% until every animal in the biome is back**, so the final stretch of balance is the reward for a fully recovered ecosystem.
- Each animal has **return requirements**: minimum health, sometimes balance, specific habitat objects, sometimes water features, and sometimes other animals already back (predators wait for their prey). Every biome has a quick **early ramp** — the first few animals need only one or two easy-to-craft objects at very low health (the meadow grasshopper returns at just 15% health with a single Grass Patch) — with the rest hardened to need a real mix of *planting and crafting*.
- **Water-dwellers need terraformed water.** Shaping open-water tiles with the watering can forms ponds, **lakes** (a large connected body), and **rivers** (a long connected channel). Animals like the snapping turtle (lake), belted kingfisher (river), and bittern (open water) only return once you've shaped the right water.
- **Plants must mature.** A freshly planted habitat is a sprout and does **not** count toward an animal's requirement until it has fully grown in — and the moment it matures the biome re-checks, so anything now eligible arrives on its own.
- Animals return **one at a time** per change, so a biome fills with visitors gradually rather than all at once.
- Returned animals get a **comfort level**; remove key habitat and they become "rarely seen," but they're never owned, captured, or lost like pets.

## Biomes, restoration kits & progression

Restore each biome to unlock the next. There's **one restoration kit per area** — each craftable only once, but available **right away** (no health gate), so the real bar is the health + animals, not the kit. Every unlock now needs the gating biome at **80% health**, with **progressively steeper animal counts** (per-biome and preserve-wide totals):

| Unlock | Requirements |
|---|---|
| Old Hollow Forest | Meadow **80%** · **10** meadow animals · Forest Restoration Kit |
| Rushwater Wetland | Forest **80%** · **10** forest animals · **25 total animals** · Wetland Restoration Kit |
| Redstone Scrubland (desert) | Wetland **80%** · **13** wetland animals · **45 total** · Scrubland Restoration Kit |
| Graywind Heights (alpine) | Desert **80%** · **15** desert animals · **65 total** · Alpine Restoration Kit |
| Pelican Shore (coastal) | Alpine **80%** · **17** alpine animals · **85 total** · Migration Path Marker |

All targets stay attainable — every one of a biome's 25 animals can return by 80% health. Areas connect by trail gates, and you spawn at the correct edge when you travel; a forward trail shows a **trail sign** until its destination is unlocked, then becomes an open gate. **Rushwater Wetland opens partly pre-shaped** — channels, a pond, and watered beds are seeded the first time you enter, so it reads as a wetland immediately. **Redstone Scrubland** is dry by design: you can ready soil beds for planting but **cannot flood it** into open water, and it has exclusive resources (geode, agave nectar) feeding desert-only crafts. **Graywind Heights** rises into an **impassable, snow-capped range** along its skyline — the map extends downward by the same number of rows so its restorable floor stays the same size as every other biome — and it carries its own exclusive resources (quartz crystal, obsidian, pine nuts, lichen, juniper berries, packed snow) feeding alpine-only crafts like the Crystal Snowmelt Spring, Pika Haypile, Whitebark Seed Cache, Crystal Cairn, and Obsidian Totem.

## Tools

Four tools, each upgraded with materials gated on biome progress. Higher tiers gather more at once (tier 1→1 … tier 4→4):

- **Gathering Basket** (4 tiers) — carry capacity 200 → 800.
- **Shovel** (4 tiers) — prepare beds, shape mud banks/burrows, dig more per swing.
- **Watering Can** (4 tiers) — collect 1 → 4 water per fill.
- **Field Journal** (7 tiers) — a baseline journal plus a dedicated field guide for each area (Willow Meadow → Pelican Shore). The baseline always shows each animal's basic entry and comfort, but the **full diet, shelter, fact, and return hints stay locked** until you **gather that area's own materials and upgrade its guide** — so even the meadow's full entries are earned, not free. You upgrade in each area using resources found there.

## Crafting, planting & terraforming

Crafting needs no station — press **C** anywhere; it draws from your basket first, then all linked chests, atomically. The crafting menu has two filter dropdowns: **Place** (by biome the item can go in) and **Type** (Plants & flowers / Habitat / Structures & decor / Paths & fences / Storage / Camp comforts / Restoration kits), plus a **search box** that matches a recipe's name, what it makes, its type, **and its ingredients** — so typing "reeds" or "clay" surfaces everything that uses them. Each recipe shows the areas it can be placed in, and one-time kits show a "Crafted ✓" state once made. Restoration kits in your basket are milestone items and **can't be thrown away**.

Many items can also be **planted**: dig a soil bed with the shovel, water it, then plant a seed/sapling that sprouts and grows in over time. Every biome has 3+ plantable trees and its own flowers/grasses. Crafted items each get a small deterministic visual variation so no two look identical.

## Resource nodes & water

Resource nodes are scattered per area, with the mix **randomized per player** (deterministic, so they stay put) while guaranteeing every biome resource appears. A **water source is guaranteed near where you spawn** (skipped in the dry desert), and new saves start with extra water so early bed-watering isn't a grind. You can **build anywhere** — if you place or plant on a regen spot, the node simply **relocates** to the nearest free tile, keeping its regrowth timer. Nodes regenerate on a per-node timer.

## Weather & seasons

Every biome has its own **weather**, and it changes on its own — about every ten **minutes of play** (the calendar advances from accrued play time via the heartbeat, not the wall clock, so a world you leave for a week is exactly where you left it; there's deliberately **no day/night cycle**). Weather is a **pure deterministic function of `(worldId, biome, play-time)`** computed in `server/weather.ts` and stamped into every state snapshot, so it needs no extra tables, stays identical for everyone in a co-op world, and can be **forecast** exactly. The same dependency-free module is imported by the client (`src/weather.ts`) for a live clock and forecast that stay perfectly in step with the server.

- **Seasons** cycle spring → summer → autumn → winter (a few play-days each), biasing which weather a biome rolls via per-biome, per-season **climate weights** in `data/weather.json`. The season subtly tints the ground.
- **Seven weather types** — clear, cloudy, rain, storm, fog, snow, heat — each with a full-screen colour wash and, for rain/storm and snow, falling **particle** weather (pre-warmed on biome entry so you arrive mid-storm rather than watching it start). A HUD chip shows the current weather + season.
- **Weather & Seasons guide (press M)** is an educational panel: for the biome you're standing in it explains, in plain language grounded in **credible sources** (USGS, NOAA/NWS, NPS, US FWS, EPA, university extension, Britannica, Audubon, Smithsonian), **how the current weather and current season shape that biome** — desert rain waking spadefoot toads, alpine snowpack as a slow-release "water tower," forest "fog drip," storm-cast kelp wrack feeding the beach, and so on. It also shows a short cross-preserve **forecast** (Now / Next / Later) per biome. The weather-gated resources are intentionally **not** listed — finding them is a surprise.
- **Weather-gated gather nodes.** While the right weather is active, a biome sprouts a couple of nodes for a unique material: rain → **Rainwater**, desert storm → **Stormglass** (fused like fulgurite), snow → **Frostflower**, fog → **Morning Dew**, desert heat → **Sunstone**. The pairing is biome-specific (a desert storm yields stormglass; a temperate rain just pools rainwater), defined in `data/weather.json`'s `gather` map, and the server re-checks the live weather before granting one, so they can't be gathered out of season.
- **They're functional, not just collectibles.** Each crafts into bespoke decor with real restoration value — **Rain Basin** (a water source), **Sunstone Cairn** (shelter), **Frostflower Planter** (plant), plus a **Dewlit Lantern** and **Stormglass Lantern**, and two home pieces (**Frostflower Vase**, **Stormglass Chandelier**). Sunstone also feeds the desert field-guide upgrade. And three uncommon animals now want a weather build to settle: the **Chuckwalla** basks on a Sunstone Cairn, the **White-tailed Ptarmigan** wants a Frostflower Planter in bloom, and the **Western Meadowlark** drinks from a Rain Basin — so weather collecting ties straight into the restoration loop.

## Field journal

Grouped by biome, the journal shows each animal's actual **sprite thumbnail** (a colored creature for returned animals, a silhouette for ones still to come), comfort level, why it returned, and — once the field guide is upgraded for that area — full diet/shelter/habitat notes and exact return hints. The header names the **field guide for the area you're viewing** (e.g. "Rushwater Wetland Field Guide"), and you can toggle **Unknown first** to surface the animals you haven't found yet or **search** by name or kind.

## Metrics & analytics

A client **heartbeat** accrues play time and counts sessions while the game is open (paused when the tab is hidden). The read-only **Metrics** endpoint surfaces it for dashboards:

- `GET /Metrics/<playerId>` — one player's play time, engagement intensity, recency/status, progression, per-biome health, an **achievements** block (earned/total, points, completion, recent unlocks, by-category counts), and a rendered **SVG snapshot** of each unlocked area (ground tinted by health, terrain and placed objects drawn in).
- `GET /Metrics/` — global **audience** (active/new buckets), **engagement**, **retention** (returning players), **progression**, an **activation funnel** (created → collected → crafted → placed → attracted animal → unlocked 2nd biome), summed action totals, an **achievements** summary (total earned, avg per player, a per-achievement earn distribution so you can see where players stall, and a completion histogram), a **co-op** summary (number of shared worlds, players in co-op, avg members per world, pending join requests), and a per-biome breakdown.
- `GET /BiomeSnapshot/<playerId>` — just the area images, as base64 data-URIs + raw SVG.

**Solo metrics uplink.** Solo players never appear in the hosted `Player` table (their world lives in local save files), so the client periodically POSTs the local save's derived metrics view to the hosted Harper (`src/solo/metricsUplink.ts` → `POST /SyncMetrics/` → `SoloMetrics` table, every ~5 min plus a flush on hide/close). Each report is a full snapshot keyed by the save slot's UUID, so missed reports lose nothing; it's strictly best-effort and solo stays fully playable offline. The global `/Metrics/` view then reports solo players alongside hosted ones. What's sent and why is spelled out for players in the privacy policy (`public/privacy.html`, inlined into `resources.js` by `scripts/build-pages.mjs` and served by the `privacy` endpoint at `/privacy.html`; prose source of truth `PRIVACY.md`).

**Player feedback.** Settings has a feedback form (`src/feedback.ts`): the message, an optional reply email, and light diagnostic context (version, build, platform/OS, progression numbers) POST to the hosted Harper's `/SubmitFeedback/` — even from the solo desktop build, since it must land in the shared `Feedback` table. Offline sends queue in localStorage and retry each session until the server confirms storage. Reading feedback back is super-user-only (`GET /ListFeedback/`).

## Saves & developer tools

Each save is a name + passcode pair. Passcodes are **never stored in plaintext** — each save keeps a random salt and a scrypt hash, verified in constant time; legacy plaintext saves are transparently re-hashed on their next login. No secret fields (passcode, hash, or salt) are ever returned to the client. **Settings → Lock this save** logs out and clears the remembered session so reopening requires the passcode. A hidden **developer panel** (opened with **Cmd/Ctrl + Shift + Delete** so players won't stumble onto it; no username gate) offers testing helpers: reseed/clear an area's terrain, grant chosen amounts of each resource, max all tools, unlock all biomes, and set biome health.

## Controls

WASD / arrows to move · **E** / Space to interact · **1–4** select tools (basket · shovel · watering can · paint) · **B** basket · **J** journal · **K** achievements · **F** activity feed · **C** crafting · **P** preserve map · **M** weather & seasons guide · **T** tools & upgrades · **O** today's tasks board · **U** People (co-op worlds only) · **G** settings · **H** How to Play · click animals to observe · Shift+click a placed object to pick it up · Esc closes menus / cancels placement. Gathering spots glow, the nearest interactable gets a pulsing ring, pickups animate into your basket, and the activity feed narrates what you just did. The **?** button (or **H**) opens How to Play with the full reference. These exactly match the in-game **How to Play** reference and the HUD buttons.

## Co-op multiplayer

> **Hidden in v1.** Co-op is gated behind `COOP_ENABLED` (`src/features.ts`) and off in the shipped solo-only build. The code below is intact and tested — see [Re-enabling co-op](#re-enabling-co-op-later). When enabled, the title screen shows a Solo/Co-op toggle.

At **New Game** you choose **Solo** or **Co-op** (a toggle on the title screen). A save is bound to one world for its lifetime.

- **Host** creates a shared preserve and a 6-character **join code**. **Join** verifies a code, sends a request to the host, lets you build your character while the host reviews, then drops you into a **waiting room** until they approve — the host gets a popup listing everyone asking to join, with Approve / Deny. When you're let in, the world feed announces *"{name} joined the preserve!"*.
- **What's shared vs. personal.** The world — biomes, terrain, placements, plants, chests, returning animals, biome health, the activity feed — is shared by everyone in it. Your **basket, tools, field journal, appearance, position, and achievements stay personal**. (Exception: *world* achievements like **First Friend** are earned by **all** members at once; personal ones like your own crafting counts are not.)
- **Live presence.** Other players appear as their own caretakers and move smoothly. Each client publishes its exact position ~12×/sec via `POST /Presence/`, which merges it into the per-world `WorldPresence` record and returns the current positions map; Phaser interpolates between updates. (This uses short, quickly-closed reads on purpose — a long-lived WebSocket subscription to the record would hold a Harper read transaction open and get force-closed after a few minutes.) Other world changes (placing, terraforming, collecting) sync on a ~1.5s timer.
- **People menu (U)** shows the join code to copy, who's currently here, and the host's pending requests. A **Co-op** badge by the area name marks a shared world. The guided tutorial adapts: the host's first step teaches inviting, a joiner's just welcomes them.
- **Endpoints:** `MyWorlds` · `CreateWorld` · `JoinWorld` · `SwitchWorld` · `LeaveWorld` · `Presence` · `CheckWorldCode` · `RequestJoin` · `JoinRequestStatus` · `PendingJoinRequests` · `ResolveJoin`.
- **Schema:** world-owned state is keyed by `worldId` (declared at the end of each table, un-indexed, so the column could be added without rewriting existing rows). New tables: `World`, `WorldMember`, `WorldPresence`, `JoinRequest`. Single-player is modelled as a private "world of one" whose id equals the player's id.

## Notes & simplifications

- Passcodes are salted + scrypt-hashed, but auth is still lightweight: game endpoints identify a save by the `playerId` in the request body rather than a verified session token, so anyone who knows a save's id could act on it. Add per-request session tokens (issued on login/create, checked on every mutation) before anything public.
- Animal behavior is gentle wandering + click-to-observe. Weather and seasons are in (see **Weather & seasons**); there's deliberately **no day/night cycle** — the only ambient thing that changes is the weather itself.
- Harper subtlety: conditional searches inside one transaction don't see that transaction's own writes, so endpoints pass fresh records into recalculation explicitly (see comments in `server/resources.ts`).
