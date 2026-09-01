# An auto-updater for the desktop build — what's already there, what's forbidden, what's left

Research note. Short version: **of the three ways a player can get this game on
their desktop, two already auto-update and the third is not allowed to.** The
only unserved population is people who download the file from the itch.io *web
page* instead of installing through the itch app — and for them the right tool
is a version *nudge*, not a self-updater. Reasons below, in the order that
killed each option.

## The three channels

| How they got it | Who updates it today | Can an in-app updater help? |
|---|---|---|
| Mac App Store | Apple | **No — prohibited.** Guideline 2.4.5(vii) |
| itch.io **via the itch app** | the itch app, by butler patch | No — already solved, and it would fight |
| itch.io **direct download** from the web page | nobody | Yes, and this is the whole gap |

### Mac App Store: not a choice we get to make

App Store Review Guideline 2.4.5, Mac-specific:

> **(vii)** They must use the Mac App Store to distribute updates; other update
> mechanisms are not allowed.
>
> **(iv)** They may not download or install standalone apps, kexts, additional
> code, or resources to add functionality or significantly change the app from
> what we see during the review process.

So electron-updater must be *absent from the MAS bundle*, not merely disabled at
runtime behind `process.mas`. There is already a pattern for exactly this in
`package.json` — `mas.files` excludes `node_modules/steamworks.js/**`, and
`electron/steam.js` no-ops when the module is missing. Any updater follows the
same shape: excluded from the MAS build, `require`d defensively, silent when
absent.

### itch app: already auto-updating, for free, because of butler

From itch.io's own docs and support:

> The itch app looks for game updates on start-up, and every 30 minutes.

> Games will only auto-update in the app if the creator is using our patch-based
> uploading system, butler.

`desktop-build.yml` already pushes every platform with butler, and the Windows
`dir` target — the one with the essay in `package.json` defending it — is
precisely what makes those updates *patches* rather than 400 MB re-downloads.
The auto-updater on Windows is not missing. It shipped the day that comment was
written.

Worth being explicit about the corollary: an electron-updater running inside an
itch-app install would be a **second** updater rewriting files inside a folder
the itch app believes it owns and diffs against. Best case it duplicates work;
worst case the next itch patch applies against a tree that no longer matches the
build it was diffed from.

## Option A — electron-updater. Priced out on every platform at once.

Current: `electron-updater@6.8.9` (published 2026-08-17; `next` is a 7.0.0
alpha). Compatible with electron-builder 26 in principle. Per platform:

**Windows — hard blocker.** electron-builder's own docs: *"Simplified auto-update
is supported on Windows if you use the default NSIS target."* NSIS only. Our
target is `dir`, deliberately, and the reasons in `package.json` have not
changed: itch's manual calls installers "the absolute worst", the itch app would
re-run an installer on every Play, and `portable` re-extracts ~400 MB to TEMP on
every launch. Serving the direct-download minority would mean adding a *second*
Windows artifact (`dir` for itch + `nsis` for the website), and the `dir` copy —
which is the one nearly everyone has — still could not update itself. Also note
Windows builds here are unsigned (no `WIN_CSC_LINK` in CI), which makes an
unsigned self-updating installer a SmartScreen story on top of everything else.

**macOS — works, but only against ourselves.** Squirrel.Mac needs the `zip`
target (we have it, alongside dmg) and *"macOS application must be signed in
order for auto updating to work"* (we sign and notarize). DMG alone cannot
update — `latest-mac.yml` is generated from the zip. So this one is technically
available… for the same population that mostly bought on the Mac App Store,
where it is banned.

**Linux — works, with the usual AppImage caveats.** AppImage is supported;
electron-updater has a long tail of issues around replacing the running AppImage
in place versus writing a `*update.AppImage` next to it, and it needs the
`APPIMAGE` env var, so it does nothing if a player extracted the AppImage.

**And then there's the feed.** electron-updater needs `latest.yml` /
`latest-mac.yml` on a provider — GitHub Releases (this repo is not public and a
token in the client is not an option), or a generic HTTPS host. We have
Cloudflare and wrangler already, so `updates.wildwillows.app` is a five-minute
job. The bill is the part to notice: **we would be paying egress to serve ~400 MB
payloads that itch.io currently serves for free**, to reach the players who chose
*not* to use the itch app.

## Option B — a version nudge. ~30 lines, no dependency, no new target. ✅

itch.io exposes an unauthenticated endpoint for exactly this:

```
GET https://api.itch.io/wharf/latest?target=bai13y/wild-willows&channel_name=osx
→ {"latest": "0.3.11"}
```

No API key. `channel_name` is our butler channel — `windows`, `osx`, `linux`.
(The `latest` field is omitted when a build was pushed without a user version;
we always pass `--userversion`, so it will be there.)

**The versions already line up exactly, which is the thing that makes this
cheap.** Both jobs in `desktop-build.yml` package with
`-c.extraMetadata.version=$VER` off the tag, and the publish job pushes that same
string as `butler push --userversion "$VERSION"`. So `app.getVersion()` inside
the packaged app and `latest` from wharf are the *same value from the same tag*.
A string compare is honest; no semver library needed.

Shape:

- Main process (not the renderer — `hardenContents()` blocks remote origins, and
  this is a plain outbound fetch from Node, same as the existing telemetry).
- On boot, once, after the window is up. Short timeout, `catch {}` and forget.
- If `latest !== app.getVersion()`, IPC a message to the renderer; show a quiet
  banner: *"Version X is out — get it on itch.io"*, linking to the game page via
  the existing `shell.openExternal` path.
- Gates: skip when `process.mas` (2.4.5 again — a MAS build must not advertise
  an outside update path), skip under Steam, skip in dev.

**It suppresses itself for itch-app players, with no launcher detection.** If the
itch app has already patched them to the latest build, their `app.getVersion()`
equals `latest` and the banner never renders. The banner appears only for people
who are actually behind — which is the direct-download crowd by definition. This
is worth knowing because launcher detection is otherwise awkward:
`ITCHIO_API_KEY` is only set when a manifest action declares `scope`, and
`build/itch.toml` declares none (and is Windows-only anyway).

### Two things to handle before shipping it

1. **PRIVACY.md.** *"designed to work fully offline"* and *"if you'd rather send
   nothing, play with the device offline"* are load-bearing promises. An update
   check is a request to a **third party** (api.itch.io) that reveals an IP and
   the fact that this game is running. It needs its own line in the policy, and
   it should behave like the rest of the telemetry: best-effort, never queued,
   never a nag, and silent when offline.
2. **Don't check on the MAS build even to display nothing.** Gate before the
   fetch, not after.

## Recommendation

1. Ship the nudge (Option B). It covers the only gap that exists, costs no
   dependency, no build target, no bandwidth, and no CI change.
2. Leave electron-updater alone unless a **direct-from-wildwillows.app** desktop
   download ever becomes a real channel. That is the scenario where the NSIS
   target, the signing cert, and the update feed all start earning their keep at
   once — and it is a different decision from this one.
3. Never in the MAS build, on either count.

## Sources

- App Store Review Guidelines 2.4.5 — https://developer.apple.com/app-store/review/guidelines/
- itch app, How updates work — https://itch.io/docs/itch/integrating/updates.html
- itch.io on butler and auto-update — https://x.com/itchio/status/1880356779630162345
- itch.io serverside API (`/wharf/latest`) — https://itch.io/docs/api/serverside
- itch app manifest actions (`scope`, ITCHIO_API_KEY) — https://itch.io/docs/itch/integrating/manifest-actions.html
- electron-builder, Auto Update — https://www.electron.build/docs/features/auto-update/
- electron-builder, AppImage — https://www.electron.build/docs/appimage/
- AppImage replace-in-place issue — https://github.com/electron-userland/electron-builder/issues/3639
- macOS dmg-only cannot update — https://github.com/electron-userland/electron-builder/issues/2137
