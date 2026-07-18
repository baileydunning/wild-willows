# iOS App Store runbook

How to take Wild Willows from this repo to TestFlight / the App Store. The
game itself is already mobile-ready: virtual joystick (bottom-right),
tap-to-move, tap-to-interact, pinch-to-zoom, compact touch UI — no keyboard
needed. The iOS app is the same
offline solo build the desktop ships, wrapped by Capacitor in a WKWebView.

Everything in "Already done" is committed; only the Xcode steps below need
your Mac (signing, archiving, and uploading cannot run anywhere else).

## Already done (committed)

- **Capacitor** installed (`@capacitor/core/cli/ios`, v8, Swift Package
  Manager — no CocoaPods needed) with `capacitor.config.ts` (appId
  `io.harper.wildwillows`, webDir `web`).
- **ios/ Xcode project** generated (`npm run ios:add`) and synced.
- **Landscape-only, iPhone + iPad**, full-screen (required for
  landscape-only on iPad), status bar hidden, and
  `ITSAppUsesNonExemptEncryption=false` — all in `ios/App/App/Info.plist`.
- **App icon + splash** generated from `build/icon.png` into
  `ios/App/App/Assets.xcassets` (single 1024×1024 universal icon; brand-green
  splash).
- **Durable saves**: `src/solo/iosSaves.ts` stores save slots as JSON files
  via `@capacitor/filesystem` (Library dir, backed up) instead of
  localStorage, which iOS can evict. Installed at boot in `main.tsx`.
- **Web tweaks**: `viewport-fit=cover` + `user-scalable=no`; joystick moved
  to bottom-right and controls padded with `env(safe-area-inset-*)`;
  Fredoka/Quicksand now bundled via @fontsource (fully offline, no Google
  Fonts CDN).
- **npm scripts**: `ios:add` (one-time, done), `ios:sync`
  (build web + copy into Xcode project), `ios:open` (open in Xcode).

## Prerequisites (once)

- Xcode 16+ from the App Store, then `xcodebuild -runFirstLaunch`.
- Your Apple Developer Program membership (team `JB4CT3MZ6L` — same as MAS).
- In [App Store Connect](https://appstoreconnect.apple.com): **Apps → + →
  New App** → platform iOS, bundle id `io.harper.wildwillows`, SKU e.g.
  `wildwillows-ios`. (Register the bundle id at
  developer.apple.com/account → Identifiers first if it's not offered.)

## Every release

```bash
npm run ios:sync   # rebuild web/ and copy it into ios/App
npm run ios:open   # open the project in Xcode
```

Then in Xcode:

1. Select the **App** target → **Signing & Capabilities** → check
   "Automatically manage signing", pick your team. (First time only.)
2. **General** tab: bump **Version** (e.g. 0.1.15) and **Build** number —
   each upload needs a higher build number.
3. Device selector: **Any iOS Device (arm64)**.
4. **Product → Archive**. When the Organizer opens: **Distribute App →
   App Store Connect → Upload** (accept defaults; it validates on the way).
5. Wait ~10 min for processing, then the build appears in App Store Connect
   under **TestFlight**. Test it on your own phone via the TestFlight app
   before submitting.

## First submission checklist (App Store Connect)

- **Screenshots**: iPhone 6.9" and iPad 13" (landscape). Run in the Xcode
  simulator (`Cmd+S` saves a screenshot) — two devices, ~4 shots each.
- **Privacy policy URL**: reuse the hosted `privacy.html` (same one the
  web/dashboard build serves).
- **App privacy** questionnaire: solo play is fully offline. If the metrics
  uplink (`src/solo/metricsUplink.ts`, anonymous device id) is active in this
  build, declare "Identifiers → Device ID" for Analytics, not tracking.
  If you'd rather declare "no data collected", ship with the uplink disabled.
- **Age rating** questionnaire: matches the existing `age-rating.html` (4+).
- **Export compliance**: already answered by `ITSAppUsesNonExemptEncryption`
  in Info.plist — no question at submission time.
- **Pricing**, category **Games → Casual/Family**, then **Submit for Review**.

## Testing without a Mac to hand

- Simulator: `npm run ios:sync && npx cap run ios` (needs Xcode installed).
- On-device quick check of the touch controls without Xcode: any phone
  browser against `npm run dev:web` on your LAN (`vite --host`) — the
  controls key off `pointer: coarse`, not off Capacitor.

## Gotchas

- `ios/App/App/public/` and `capacitor.config.json` in the project are
  build products of `ios:sync` (gitignored) — never edit them by hand.
- Don't touch `ios/App/CapApp-SPM/Package.swift`; `cap sync` regenerates it.
- If Xcode complains about a missing `CapacitorFilesystem` package the first
  time: **File → Packages → Resolve Package Versions** (SPM resolves the
  local path from `node_modules`, so `npm install` must have run).
- Version bumps: Xcode's Version/Build fields live in the project, not
  package.json — keep them roughly in step with the desktop version so crash
  reports are attributable.
