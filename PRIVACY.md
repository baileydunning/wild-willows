# Wild Willows — Privacy Policy

**Effective date:** July 3, 2026
**Developer:** Bailey Dunning
**Contact:** wildwillowsgame@gmail.com

Wild Willows is a cozy nature-restoration game. It is designed to work fully offline, requires no account, and collects as little as possible. This policy explains exactly what data the game handles, what (if anything) leaves your device, and how to reach me about it. The hosted copy of this policy lives at https://wild.willows.harperfabric.com/privacy.html (its source of truth is `PRIVACY.md` in the game's repository).

## The short version

- No account, no sign-in, no ads, no tracking, no third-party analytics.
- Your world lives in save files on your own device.
- When you're online, the game periodically sends me an **anonymous gameplay-statistics snapshot** (play time, things crafted, animals returned, and so on) identified only by a random ID, so I can see how the game is being played and improve it.
- The only personal information I ever receive is what **you choose to type into the feedback form** — including an optional email address if you'd like a reply.

## Data stored on your device

Your saves are local files in the app's data folder (on macOS, inside the app's container under `Library/Application Support/Wild Willows/saves/`). Each save holds your caretaker's name and appearance, your world (terrain, placements, plants, animals, chests), and gameplay counters. The game also uses local browser-style storage for small preferences (for example, whether the tasks board is collapsed) and to queue unsent feedback while offline. None of this local data is readable by me; deleting the app (or the save files) removes it.

The Mac App Store build is solo-only: there is no multiplayer, no account, and no passcode. The game is fully playable with no internet connection.

## Gameplay statistics I collect (automatic, anonymous)

While the game is open and a network connection exists, it sends a snapshot of your save's gameplay statistics to my server (`wild.willows.harperfabric.com`) roughly every five minutes, plus once when the window is hidden or closed. Each snapshot contains:

- a **random identifier** for the save slot (a UUID generated on your device — it is not derived from you, your device, or your Apple ID, and I cannot use it to identify you);
- the **name you gave the save** (I suggest a caretaker name rather than your real name);
- basic **app and platform information**: app version, build timestamp, platform ("desktop" or "web"), and operating system family (mac / windows / linux);
- **gameplay counters**: play time, number of sessions, resources collected, items crafted, objects placed, plants planted, animals observed and returned, biomes unlocked, achievements earned, and similar progression numbers.

That's the whole list. Snapshots contain no location data, no contact information, no device identifiers, and no advertising identifiers. I use them solely to understand how Wild Willows is played (for example, where players stall in the early game) and to improve it. Sending is best-effort: if you're offline, reports are simply skipped — they are not queued, and the game does not nag you to connect.

## Feedback you choose to send

The in-game feedback form (in Settings) sends me whatever message you type, plus light diagnostic context so a report like "the game feels slow" makes sense: app version and build, platform and operating system, browser user-agent string, your save's name, tutorial progress, unlocked biomes, achievement count, and play time.

You may optionally include an **email address** if you'd like a reply. It is used only to respond to your feedback — never for marketing, and never shared. If you're offline when you submit, the feedback is stored on your device and sent automatically once a connection returns. On my server, feedback (including any reply email) is readable only by me, the developer.

## What I don't do

I do not sell, rent, or share your data with anyone. The game contains no advertising, no tracking SDKs, no third-party analytics, and no social integrations. I do not profile you, and I do not combine game data with data from other sources. The app makes outgoing HTTPS connections only, and only to my own server. (Builds distributed through the Mac App Store contain no Steam integration; builds launched through Steam sync gameplay stats and achievements to your Steam profile, which is governed by Valve's privacy policy.)

## Where data is stored

Gameplay snapshots and feedback are stored in my database on my hosting provider's infrastructure, which processes the data only on my behalf. Data is transmitted over HTTPS.

## Retention and deletion

Gameplay snapshots are kept so long-term trends stay visible; each save slot has exactly one row that is overwritten by its latest snapshot. Feedback is kept until it has been read and acted on. To have either deleted, email **wildwillowsgame@gmail.com** — include your save's name (and, if you can find it, the save-slot ID) for snapshots, or the approximate date and message for feedback, and I'll remove it. Deleting the app from your device stops all collection immediately.

## Children

Wild Willows is suitable for all ages. I do not knowingly collect personal information from children; the game never asks for a real name, and the only free-text personal data anywhere is the optional feedback email. If you believe a child has submitted personal information through the feedback form, contact me and I will delete it.

## The web and co-op versions

If you play the browser version (or a future co-op build), your save lives on my server instead of your device: the save name, a passcode (stored only as a salted scrypt hash, never in plaintext), your caretaker's appearance, and your world state. Co-op worlds additionally share world state and live player positions with the other members of that world. Everything else in this policy — no ads, no tracking, no sharing — applies identically.

## Changes to this policy

If the game's data practices ever change, I will update this policy, revise the effective date above, and note the change in the game's release notes. Material changes will be called out in-game.

## Contact

Questions, concerns, or deletion requests: **wildwillowsgame@gmail.com**.
