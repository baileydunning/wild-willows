# Wild Willows dev log — the preserve now misses you

The theme of this update is simple: the preserve shouldn't freeze the moment you close the game, and there should be a reason to check in tomorrow.

## Your plants grow while you're gone

Plantings now mature over real hours, whether the game is open or not. Come back the next day and your saplings have grown in, quietly adding restoration points to the land. There's a little welcome-back note when it happens — "While you were away, three of your plantings matured and the land grew healthier." No timers to babysit, nothing to water on a schedule. The preserve just keeps living.

## Today's Tasks

A small task board now sits under the compass — a handful of daily goals that rotate at midnight UTC. Everyone in a co-op world sees the same board. Claim what you finish, and the board tidies itself away once it's done. Press `O` if you'd rather tuck it out of sight.

## Dawn, dusk, and who's out when

The HUD now shows the time of day in the preserve — dawn, day, dusk, night — alongside the weather and season. It matters: animals have real activity patterns now. Owls won't show at noon, hawks like a clear sky, and some neighbors only wander through in certain seasons. Each journal card tells you when to look ("Most active at dawn and dusk", "Comes out in the rain"), and locked entries hint at what might draw a newcomer in. A batch of new animal sprites came along for the ride.

## Send me your thoughts, right from the game

There's a new Send Feedback box at the bottom of Settings. Found a bug? Want more frogs? Type it and hit send — it goes straight to me, along with a bit of context (build, platform, playtime) that makes bug reports actually debuggable. Add your email if you'd like a reply; leave it blank to stay anonymous.

It works offline too: playing the desktop build with no connection, your note is saved locally and slips out automatically the next time you start a session with internet. And once it's sent, it's a table row on my end — no inbox rules, no lost mail.

## Small fixes worth calling out

- Typing in any text box no longer plays the game underneath you. No more opening your basket mid-sentence or the caretaker wandering off while you write feedback. (Yes, this bug was discovered by the feedback box itself.)
- Solo saves no longer show "Change passcode" and "Delete this save" in Settings — solo has no passcode, and saves are managed from the load menu.
- Biomes got proper per-area grid sizes, and the meadow's alignment quirks are fixed — every area reads at the same zoom now.

Behind the scenes: deploys to the hosted co-op server now run through GitHub Actions instead of my terminal, so updates land faster and more often.

Back to planting. 🌱
