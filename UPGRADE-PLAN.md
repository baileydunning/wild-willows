# Wild Willows — Dependency Upgrade Plan

Goal: move every dependency to its current major and end with the app **behaving identically** — same solo game, same web/dev flow, same desktop builds (itch.io DMG/zip + Mac App Store) — on supported, non-vulnerable versions.

This plan is ordered so each step is independently verifiable and revertible. Do them **one phase per branch/PR**. Never batch two majors into one commit; when something breaks you want a one-line blame, not a haystack.

---

## The "working the same" contract (run after every phase)

A phase is done only when all of these are green:

- `npm run check` — `tsc --noEmit` + i18n check
- `npm run test` — unit + integration (vitest)
- `npm run test:e2e:solo` — Playwright solo flow
- `npm run build` — web (vite) + server (esbuild)
- `npm run desktop` — app launches and is playable
- `npm run desktop:pack` — packages without error (full `desktop:dist` + `desktop:mas` only in Phase 3 and the final phase)

Keep a `git tag pre-upgrade-baseline` on the current known-good commit so any phase can roll back with `git reset --hard`.

---

## Current state (baseline)

| Package | Current | Target | Risk | Touches |
|---|---|---|---|---|
| electron | 43.2.0 *(already bumped)* | latest 43 | Low | desktop runtime |
| esbuild | 0.24 | 0.28 | Low | server build |
| jsdom | 25 | 30 | Low | unit test env |
| electron-builder | 24 | 26 | **Med** | packaging (clears critical `tar`) |
| react / react-dom | 18 | 19 | Low* | app UI |
| @types/react(-dom) | 18 | 19 | Low | types |
| @vitejs/plugin-react | 4 | 6 | Low | build |
| vitest | 3 | 4 | Med | tests |
| @vitest/coverage-v8 | 3 | 4 | Low | coverage |
| vite | 5 | 8 | **Med** | build (Rolldown) |
| typescript | 5.6 | 7 | Med | `check` only |
| phaser | 3.85 | 4 | **High** | game rendering |

\* React is low-risk **for this repo specifically** — see Phase 4.

Node is already pinned to 24 (`.nvmrc`, `engines`), which satisfies every target below. No Node change needed.

---

## Phase 0 — Prep (do first, no upgrades)

1. Commit or stash current work on `audio`; the working tree has ~9k lines of churn in `package-lock.json` from the Electron debugging. Regenerate it cleanly: `rm -rf node_modules package-lock.json && npm install`, then commit the lockfile so future diffs are meaningful.
2. `git tag pre-upgrade-baseline`.
3. Confirm the full verification contract passes **as-is**. If anything is red now, fix it before upgrading — you can't distinguish "upgrade broke it" from "already broken" otherwise.

---

## Phase 1 — Electron 43 (finish + verify)

`package.json` already says `^43.2.0`; this phase just makes it real and confirms it. This is also the fix for the XProtect "malware moved to Trash" problem — Electron 31 was being flagged, 43 is not.

- `rm -rf node_modules/electron ~/Library/Caches/electron && npm install`
- Verify: `npm run desktop` launches (no signature/GPU errors), then `npm run desktop:pack`.
- Watch for: Electron 31→43 crosses several majors of Chromium/Node-in-Electron. Check `electron/main.js`, `preload.js`, `steam.js`, `metrics-sync.js` for any deprecated `app`/`BrowserWindow`/`ipc` options. The preload contextBridge API is stable, so this is usually clean.

**Rollback:** revert `package.json` electron line, `npm install`.

---

## Phase 2 — esbuild 0.28 + jsdom 30 (trivial, isolated)

Two independent, low-blast-radius bumps.

- `npm i -D esbuild@^0.28 jsdom@^30`
- esbuild: only used in `build:server` for `server/resources.ts`. Pre-1.0 bumps occasionally tighten syntax handling; the ES2022 string-export-name trick you rely on is fine. Verify `npm run build:server` output (`resources.js`) is byte-reasonable and `npm run test:integration` passes.
- jsdom: only the unit-test DOM env. Verify `npm run test:unit`.

**Rollback:** revert the two versions.

---

## Phase 3 — electron-builder 26 (clears the critical `tar` advisory)

Build-time only, but it touches your most complex config (universal DMG/zip, notarization, MAS sandbox, `steamworks.js` native rebuild). This is why it gets its own phase.

- `npm i -D electron-builder@^26`
- Run `npx electron-builder migrate-schema` — v26 removed `disableDefaultIgnoredFiles` (you don't use it) and shifts some defaults; the migrator patches the `build` block automatically.
- Re-test **every** target you ship: `npm run desktop:pack`, `npm run desktop:dist` (DMG + zip, universal, notarized), and `npm run desktop:mas` (sandbox + provisioning profile). v26 has had packaging regressions across point releases, so pin an exact version once a build passes rather than floating `^26`.
- Watch for: `npmRebuild`/`asarUnpack` behavior around `steamworks.js`, and that notarization (`teamId JB4CT3MZ6L`) still succeeds.

**Rollback:** revert to `electron-builder@24.13.3` and the pre-migrate `build` block.

---

## Phase 4 — React 19 (+ types)

**Low risk here** because your code is already on modern APIs: `src/main.tsx` uses `createRoot`, and there are no `ReactDOM.render`, `findDOMNode`, `defaultProps`-on-functions, `propTypes`, string refs, or `forwardRef` in `src/`. React 19's removals mostly don't apply.

- `npm i react@^19 react-dom@^19 -S` *(they currently sit in devDependencies — keep them there to match your setup)* and `npm i -D @types/react@^19 @types/react-dom@^19`
- Optionally run `npx codemod react/19/migration-recipe` as a safety net (it'll no-op on most of your code).
- Bump `@vitejs/plugin-react` to `^6` in the same PR (its React-19 support lives in v6) — but hold the **Vite** bump for Phase 6; plugin-react 6 supports Vite 5–8.
- Watch for: stricter `useEffect` timing and ref rules. Exercise the React UI panels and the Phaser mount (`PhaserGame.tsx`) in `npm run desktop`.

**Rollback:** revert the four react/types versions + plugin-react.

---

## Phase 5 — Vitest 4 + coverage-v8 4

Test runner only; no shipped-code impact. Coupled to Vite (vitest 4 wants Vite 6+), so it lands just before the Vite bump.

- `npm i -D vitest@^4 @vitest/coverage-v8@^4`
- You have a multi-project setup (`unit` / `integration` in `vitest.config.ts`). v4 changed some config/reporter defaults and workspace handling — reconcile `vitest.config.ts` and confirm both `--project unit` and `--project integration` still resolve.
- Verify: `npm run test`, `npm run test:unit`, `npm run test:integration`.

**Rollback:** revert both versions.

---

## Phase 6 — Vite 8 (staged 5 → 6 → 7 → 8) + Rolldown

Do this **incrementally**, running the build between each step — don't jump 5→8. Vite 8 replaces esbuild/Rollup internals with Rolldown/Oxc.

1. `npm i -D vite@^6` → `npm run build` + `npm run dev:web` (confirm the Harper proxy still works).
2. `npm i -D vite@^7` → build again.
3. `npm i -D vite@^8` → build again.

Repo-specific notes — you're in good shape:
- You set **no** `build.rollupOptions`/`manualChunks` and no `import.meta.hot`, so the `rollupOptions → rolldownOptions` rename and the `import.meta.hot.accept(url)` removal don't affect you.
- Your `define` values are all strings/booleans (`__BUILD_TIME__`, `__APP_VERSION__`, `__COOP_ENABLED__`), so the "define no longer shares object references" change doesn't bite.
- Keep `base: './'`, `build.target: 'es2022'`, `resolve.alias` for `node:crypto`, and the proxy blocks exactly as-is — verify all three survive: `file://` desktop load, the crypto shim in the solo bundle, and the Harper proxy under `dev:web`/`preview`.
- The 2.4 MB chunk warning is pre-existing; if you want to address it, Rolldown’s `build.rolldownOptions.output.advancedChunks` is the v8 way — optional, cosmetic.

**Rollback:** step back one Vite major; each sub-step is its own commit.

---

## Phase 7 — TypeScript 7 (staged 5 → 6 → 7)

Type-check only (`npm run check`); nothing at runtime uses `tsc` (esbuild/vite do the transforms). Microsoft's guidance is explicit: **go through TS 6 first** so every removal surfaces as a warning before it becomes an error.

1. `npm i -D typescript@^6` → `npm run check`, fix every deprecation warning.
2. `npm i -D typescript@^7` → `npm run check`.

Repo-specific: your `tsconfig.json` is already compatible — `target ES2020` (≥ the new ES2015 floor), `moduleResolution: "bundler"` (the removed `node10` resolver isn't used), `strict: true` (already on, so "strict by default" is a no-op). Main caveat: TS 7's programmatic API doesn't stabilize until 7.1, so if you later add ESLint's type-aware rules or `ts-morph`, they may lag — you don't use them today.

**Rollback:** revert to `typescript@5.6.3`.

---

## Phase 8 — Phaser 4 (the real migration, saved for last)

The only bump that changes game code. It's isolated to three files — `src/game/textures.ts`, `src/game/WorldScene.ts`, `src/game/PhaserGame.tsx` — and, helpfully, you use **no custom WebGL pipelines** (the single biggest Phaser 4 pain point is absent). The concrete hotspots in your code:

- **`BitmapMask` (10 uses)** → replaced by the Mask filter API in v4. This is the bulk of the work.
- **`new Phaser.Geom.Point` (7 uses)** → replaced by `Phaser.Math.Vector2`.
- **`RenderTexture` (5 uses)** → v4 buffers draw commands; you must call `.render()` to flush them.

Also sanity-check while you're in there: any `setTintFill` → `setTint` + `setTintMode`, `Math.TAU` now equals `2π` (was `π/2` in v3 — flip any usage), and if you use compressed textures they need a Y-flip (v4 is GL-oriented, Y=0 at bottom).

Approach: `npm i phaser@^4`, run the game, and let the console errors guide you file-by-file — the official guide estimates a few hours for standard-API games, which matches your surface. Use the Phaser team's `v3-to-v4-migration` skill/codemod as a starting pass.

**Verify:** this needs **human playtesting**, not just green tests — load a save, terraform/plant/collect, open home customization (color/mask-heavy), and confirm rendering looks identical. Compare against a build from `pre-upgrade-baseline`.

**Rollback:** revert to `phaser@3.85.2`; because it's isolated to `src/game/*`, this reverts cleanly.

---

## Phase 9 — Ship

1. Full verification contract, all targets.
2. Rebuild and **re-notarize** the itch.io DMG/zip and the MAS build from the fully-upgraded tree — your previously shipped Electron-31 artifacts are the ones players' Macs will flag under XProtect, so a re-release is the actual remediation, not just a local fix.
3. Bump app `version`, tag the release, squash-merge each phase PR in order.
4. `npm audit` should now be clean (electron-builder 26 clears the critical `tar`; the `harper`-tree advisories are dev-only and resolve when its subdeps update — or stay contained since `harper` never ships).

---

## Why this order

Independent, low-risk, high-value first (Electron unblocks dev + fixes XProtect; esbuild/jsdom are free). Then the security-clearing build tool (electron-builder). Then app/build infrastructure grouped by coupling: React → plugin-react, then vitest → Vite (vitest 4 needs Vite 6+, so they move together). TypeScript is type-check-only, so it slots wherever convenient but before the risky finale. Phaser is last because it's the largest, needs human playtesting, and is fully isolated to `src/game/*` — so a failure there can't muddy any other phase.
