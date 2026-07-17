import{r as fa,s as pa,t as h,i as mt,w as Ht,g as wa,W as ga,S as ya,n as Ue,a as ba,b as Nt,d as va,c as Lt,e as ka,o as xa,f as Sa,h as Aa,j as Ma,k as Ia,l as $a,m as Ta}from"./index-BetZ8Xpb.js";fa("en",{server:pa});const Pa=`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Privacy Policy — Wild Willows</title>
<meta name="description" content="Privacy policy for Wild Willows, a cozy nature-restoration game.">
<style>
	:root {
		--bg: #f4f1e8;
		--card: #fffdf7;
		--ink: #33402e;
		--muted: #6b7263;
		--accent: #4a7c46;
		--rule: #dcd6c4;
	}
	* { box-sizing: border-box; }
	body {
		margin: 0;
		background: var(--bg);
		color: var(--ink);
		font: 17px/1.65 Georgia, 'Times New Roman', serif;
	}
	main {
		max-width: 46rem;
		margin: 0 auto;
		padding: 3rem 1.5rem 5rem;
	}
	.card {
		background: var(--card);
		border: 1px solid var(--rule);
		border-radius: 14px;
		padding: 2.5rem 2.75rem;
	}
	h1 {
		font-size: 1.9rem;
		line-height: 1.25;
		margin: 0 0 0.25rem;
		color: var(--accent);
	}
	.meta { color: var(--muted); font-size: 0.95rem; margin: 0 0 1.75rem; }
	h2 {
		font-size: 1.2rem;
		margin: 2.25rem 0 0.6rem;
		color: var(--accent);
		border-bottom: 1px solid var(--rule);
		padding-bottom: 0.35rem;
	}
	ul { padding-left: 1.3rem; }
	li { margin: 0.4rem 0; }
	a { color: var(--accent); }
	strong { color: var(--ink); }
	.footer { color: var(--muted); font-size: 0.9rem; margin-top: 2.5rem; text-align: center; }
	@media (max-width: 540px) { .card { padding: 1.5rem 1.25rem; } }
</style>
</head>
<body>
<main>
	<div class="card">
		<h1>Wild Willows — Privacy Policy</h1>
		<p class="meta">Effective July 3, 2026 · Developer: Bailey Dunning · <a href="mailto:wildwillowsgame@gmail.com">wildwillowsgame@gmail.com</a></p>

		<p>Wild Willows is a cozy nature-restoration game. It is designed to work fully offline, requires no account, and collects as little as possible. This page explains exactly what data the game handles, what (if anything) leaves your device, and how to reach me about it.</p>

		<h2>The short version</h2>
		<ul>
			<li>No account, no sign-in, no ads, no tracking, no third-party analytics.</li>
			<li>Your world lives in save files on your own device.</li>
			<li>When you're online, the game periodically sends me an <strong>anonymous gameplay-statistics snapshot</strong> (play time, things crafted, animals returned, and so on) identified only by a random ID, so I can see how the game is being played and improve it.</li>
			<li>The only personal information I ever receive is what <strong>you choose to type into the feedback form</strong> — including an optional email address if you'd like a reply.</li>
		</ul>

		<h2>Data stored on your device</h2>
		<p>Your saves are local files in the app's data folder. Each save holds your caretaker's name and appearance, your world (terrain, placements, plants, animals, chests), and gameplay counters. The game also uses local browser-style storage for small preferences and to queue unsent feedback while offline. None of this local data is readable by me; deleting the app (or the save files) removes it.</p>
		<p>The Mac App Store build is solo-only: there is no multiplayer, no account, and no passcode. The game is fully playable with no internet connection.</p>

		<h2>Gameplay statistics I collect (automatic, anonymous)</h2>
		<p>While the game is open and a network connection exists, it sends a snapshot of your save's gameplay statistics to my server roughly every five minutes, plus once when the window is hidden or closed. Each snapshot contains:</p>
		<ul>
			<li>a <strong>random identifier</strong> for the save slot (a UUID generated on your device — it is not derived from you, your device, or your Apple&nbsp;ID, and I cannot use it to identify you);</li>
			<li>the <strong>name you gave the save</strong> (I suggest a caretaker name rather than your real name);</li>
			<li>basic <strong>app and platform information</strong>: app version, build timestamp, platform ("desktop" or "web"), operating system family (mac / windows / linux), and the interface language you play in (e.g. English or Spanish);</li>
			<li><strong>gameplay counters</strong>: play time, number of sessions, resources collected, items crafted, objects placed, plants planted, animals observed and returned, biomes unlocked, achievements earned, and similar progression numbers.</li>
		</ul>
		<p>That's the whole list. Snapshots contain no location data, no contact information, no device identifiers, and no advertising identifiers. I use them solely to understand how Wild Willows is played and to improve it. Sending is best-effort: if you're offline, reports are simply skipped — they are not queued, and the game does not nag you to connect.</p>

		<h2>Feedback you choose to send</h2>
		<p>The in-game feedback form (in Settings) sends me whatever message you type, plus light diagnostic context so a report like "the game feels slow" makes sense: app version and build, platform and operating system, browser user-agent string, your save's name, tutorial progress, unlocked biomes, achievement count, and play time.</p>
		<p>You may optionally include an <strong>email address</strong> if you'd like a reply. It is used only to respond to your feedback — never for marketing, and never shared. If you're offline when you submit, the feedback is stored on your device and sent automatically once a connection returns. On my server, feedback (including any reply email) is readable only by me, the developer.</p>

		<h2>What I don't do</h2>
		<p>I do not sell, rent, or share your data with anyone. The game contains no advertising, no tracking SDKs, no third-party analytics, and no social integrations. I do not profile you, and I do not combine game data with data from other sources. The app makes outgoing HTTPS connections only, and only to my own server. (Builds distributed through the Mac App Store contain no Steam integration; builds launched through Steam sync gameplay stats and achievements to your Steam profile, which is governed by Valve's privacy policy.)</p>

		<h2>Where data is stored</h2>
		<p>Gameplay snapshots and feedback are stored in my database on my hosting provider's infrastructure, which processes the data only on my behalf. Data is transmitted over HTTPS.</p>

		<h2>Retention and deletion</h2>
		<p>Gameplay snapshots are kept so long-term trends stay visible; each save slot has exactly one row that is overwritten by its latest snapshot. Feedback is kept until it has been read and acted on. To have either deleted, email <a href="mailto:wildwillowsgame@gmail.com">wildwillowsgame@gmail.com</a> — include your save's name for snapshots, or the approximate date and message for feedback, and I'll remove it. Deleting the app from your device stops all collection immediately.</p>

		<h2>Children</h2>
		<p>Wild Willows is suitable for all ages. I do not knowingly collect personal information from children; the game never asks for a real name, and the only free-text personal data anywhere is the optional feedback email. If you believe a child has submitted personal information through the feedback form, contact me and I will delete it.</p>

		<h2>The web and co-op versions</h2>
		<p>If you play the browser version (or a future co-op build), your save lives on my server instead of your device: the save name, a passcode (stored only as a salted hash, never in plaintext), your caretaker's appearance, and your world state. Co-op worlds additionally share world state and live player positions with the other members of that world. Everything else in this policy — no ads, no tracking, no sharing — applies identically.</p>

		<h2>Changes to this policy</h2>
		<p>If the game's data practices ever change, I will update this policy, revise the effective date above, and note the change in the game's release notes. Material changes will be called out in-game.</p>

		<h2>Contact</h2>
		<p>Questions, concerns, or deletion requests: <a href="mailto:wildwillowsgame@gmail.com">wildwillowsgame@gmail.com</a>.</p>
	</div>
	<p class="footer">Wild Willows 🌿 · <a href="/age-rating.html">Age Suitability</a></p>
</main>
</body>
</html>
`,Ca=`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Age Suitability — Wild Willows</title>
<meta name="description" content="Age suitability and content information for Wild Willows, a cozy nature-restoration game.">
<style>
	:root {
		--bg: #f4f1e8;
		--card: #fffdf7;
		--ink: #33402e;
		--muted: #6b7263;
		--accent: #4a7c46;
		--rule: #dcd6c4;
	}
	* { box-sizing: border-box; }
	body {
		margin: 0;
		background: var(--bg);
		color: var(--ink);
		font: 17px/1.65 Georgia, 'Times New Roman', serif;
	}
	main {
		max-width: 46rem;
		margin: 0 auto;
		padding: 3rem 1.5rem 5rem;
	}
	.card {
		background: var(--card);
		border: 1px solid var(--rule);
		border-radius: 14px;
		padding: 2.5rem 2.75rem;
	}
	h1 {
		font-size: 1.9rem;
		line-height: 1.25;
		margin: 0 0 0.25rem;
		color: var(--accent);
	}
	.meta { color: var(--muted); font-size: 0.95rem; margin: 0 0 1.75rem; }
	h2 {
		font-size: 1.2rem;
		margin: 2.25rem 0 0.6rem;
		color: var(--accent);
		border-bottom: 1px solid var(--rule);
		padding-bottom: 0.35rem;
	}
	ul { padding-left: 1.3rem; }
	li { margin: 0.4rem 0; }
	a { color: var(--accent); }
	strong { color: var(--ink); }
	.badge {
		display: inline-block;
		background: var(--accent);
		color: #fffdf7;
		border-radius: 999px;
		padding: 0.15rem 0.9rem;
		font-size: 0.95rem;
		margin: 0 0.4rem 0.4rem 0;
	}
	.footer { color: var(--muted); font-size: 0.9rem; margin-top: 2.5rem; text-align: center; }
	@media (max-width: 540px) { .card { padding: 1.5rem 1.25rem; } }
</style>
</head>
<body>
<main>
	<div class="card">
		<h1>Wild Willows — Age Suitability</h1>
		<p class="meta">Effective July 3, 2026 · Developer: Bailey Dunning · <a href="mailto:wildwillowsgame@gmail.com">wildwillowsgame@gmail.com</a></p>

		<p>Wild Willows is a cozy nature-restoration game: you gather fallen materials, craft and plant habitat, and watch real animals return as the land recovers. It is designed to be <strong>suitable for all ages</strong>.</p>

		<p>
			<span class="badge">Apple App Store: 4+</span>
			<span class="badge">ESRB: Everyone</span>
			<span class="badge">PEGI: 3</span>
		</p>

		<h2>What the game contains</h2>
		<ul>
			<li><strong>Gentle, non-violent play.</strong> There is no combat, no enemies, and no way to fail. Animals are observed and welcomed home — never hunted, harmed, captured, or lost. Nothing dies.</li>
			<li><strong>Educational nature content.</strong> Every animal comes with a real-world fact, and an in-game weather &amp; seasons guide explains real ecology in plain language, grounded in credible sources (USGS, NOAA, NPS, Audubon, and similar).</li>
			<li><strong>Mild ambient weather only.</strong> Rain, storms, fog, snow, and heat are visual atmosphere — they never threaten the player or the animals.</li>
			<li><strong>Simple friendly art.</strong> All visuals are soft, procedurally generated shapes; there is no realistic, frightening, or graphic imagery.</li>
		</ul>

		<h2>What the game does not contain</h2>
		<ul>
			<li>No violence, blood, or scary content</li>
			<li>No profanity, crude humor, or mature themes</li>
			<li>No alcohol, tobacco, or drug references</li>
			<li>No gambling, simulated or otherwise</li>
			<li>No advertising of any kind</li>
			<li>No in-app purchases, loot boxes, or microtransactions</li>
			<li>No chat, social features, or user-generated content from other players (the Mac App Store build is solo-only)</li>
			<li>No account, sign-in, or personal information required to play</li>
		</ul>

		<h2>Online features</h2>
		<p>The game is fully playable offline. When online, it sends only anonymous gameplay statistics (play time, items crafted, animals returned) so I can improve the game — nothing personal, and nothing is shown to or shared with other players. An optional feedback form in Settings sends a message privately to the developer; it is the only free-text input that leaves the device, and including an email address is optional. Full details are in the <a href="/privacy.html">privacy policy</a>.</p>

		<p>If a future update enables the optional co-op mode (web version), players join a shared world only by invite code with the host's explicit approval, and other players see just a chosen caretaker name and character — there is no chat system.</p>

		<h2>For parents</h2>
		<p>Wild Willows has no mechanisms that pressure play: no timers that punish absence (a world you leave is exactly where you left it), no daily-login streaks to lose, no purchases to make, and no strangers to encounter. If you have any questions, email <a href="mailto:wildwillowsgame@gmail.com">wildwillowsgame@gmail.com</a>.</p>
	</div>
	<p class="footer">Wild Willows 🌿 · <a href="/privacy.html">Privacy Policy</a></p>
</main>
</body>
</html>
`,Ba=`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Support — Wild Willows</title>
<meta name="description" content="Support, help, and frequently asked questions for Wild Willows, a cozy nature-restoration game.">
<style>
	:root {
		--bg: #f4f1e8;
		--card: #fffdf7;
		--ink: #33402e;
		--muted: #6b7263;
		--accent: #4a7c46;
		--rule: #dcd6c4;
	}
	* { box-sizing: border-box; }
	body {
		margin: 0;
		background: var(--bg);
		color: var(--ink);
		font: 17px/1.65 Georgia, 'Times New Roman', serif;
	}
	main {
		max-width: 46rem;
		margin: 0 auto;
		padding: 3rem 1.5rem 5rem;
	}
	.card {
		background: var(--card);
		border: 1px solid var(--rule);
		border-radius: 14px;
		padding: 2.5rem 2.75rem;
	}
	h1 {
		font-size: 1.9rem;
		line-height: 1.25;
		margin: 0 0 0.25rem;
		color: var(--accent);
	}
	.meta { color: var(--muted); font-size: 0.95rem; margin: 0 0 1.75rem; }
	h2 {
		font-size: 1.2rem;
		margin: 2.25rem 0 0.6rem;
		color: var(--accent);
		border-bottom: 1px solid var(--rule);
		padding-bottom: 0.35rem;
	}
	ul { padding-left: 1.3rem; }
	li { margin: 0.4rem 0; }
	a { color: var(--accent); }
	strong { color: var(--ink); }
	kbd {
		font: 0.85em ui-monospace, SFMono-Regular, Menlo, monospace;
		background: var(--bg);
		border: 1px solid var(--rule);
		border-bottom-width: 2px;
		border-radius: 5px;
		padding: 0.05rem 0.4rem;
	}
	.contact {
		background: var(--bg);
		border: 1px solid var(--rule);
		border-radius: 10px;
		padding: 1rem 1.25rem;
		margin: 1rem 0;
	}
	.footer { color: var(--muted); font-size: 0.9rem; margin-top: 2.5rem; text-align: center; }
	@media (max-width: 540px) { .card { padding: 1.5rem 1.25rem; } }
</style>
</head>
<body>
<main>
	<div class="card">
		<h1>Wild Willows — Support</h1>
		<p class="meta">Developer: Bailey Dunning · <a href="mailto:wildwillowsgame@gmail.com">wildwillowsgame@gmail.com</a></p>

		<p>Wild Willows is a cozy nature-restoration game: gather fallen materials, craft and plant habitat, and welcome real animals back as the land recovers. If something isn't working — or you just have a question — here's how to get help.</p>

		<h2>Contact</h2>
		<div class="contact">
			<p style="margin:0"><strong>Email:</strong> <a href="mailto:wildwillowsgame@gmail.com">wildwillowsgame@gmail.com</a> — I read everything and reply as quickly as I can.</p>
		</div>
		<p>You can also send feedback <strong>from inside the game</strong>: open <strong>Settings</strong> (press <kbd>G</kbd>) and use the feedback form. Include your email if you'd like a reply. It works offline too — the message is kept on your device and sent automatically once you're connected.</p>

		<h2>Common questions</h2>
		<ul>
			<li><strong>Do I need an internet connection?</strong> No. The game is fully playable offline, with no account and no sign-in.</li>
			<li><strong>A keyboard is required.</strong> Move with <kbd>WASD</kbd> or the arrow keys; press <kbd>H</kbd> (or the <strong>?</strong> button) any time for the full How to Play reference.</li>
			<li><strong>Where are my saves?</strong> Save files live on your device, inside the app's data folder. Deleting the app removes them, so keep a backup if you're reinstalling and want to keep your preserve.</li>
			<li><strong>How do I start over?</strong> Create a new save from the title screen, or delete a save from the Load Game menu.</li>
			<li><strong>Something looks stuck or broken.</strong> Quit and reopen the app first — your world is saved after every action, so nothing is lost. If it persists, email me or use the in-game feedback form and describe what you were doing; the report arrives with the version info I need.</li>
			<li><strong>The window opened but the game says "connect a keyboard."</strong> Wild Willows is keyboard-driven by design; pressing any key on a connected keyboard dismisses the gate.</li>
		</ul>

		<h2>Feature requests</h2>
		<p>Ideas are as welcome as bug reports — the feedback form and email both come straight to me, the developer.</p>

		<h2>Privacy &amp; age suitability</h2>
		<p>Wild Willows collects almost nothing — see the <a href="/privacy.html">privacy policy</a> for exactly what and why, and the <a href="/age-rating.html">age-suitability page</a> for content information (suitable for all ages).</p>
	</div>
	<p class="footer">Wild Willows 🌿 · <a href="/privacy.html">Privacy Policy</a> · <a href="/age-rating.html">Age Suitability</a></p>
</main>
</body>
</html>
`,Ra=`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Wild Willows — Metrics Dashboard</title>
<meta name="description" content="Anonymous gameplay metrics for Wild Willows, a cozy nature-restoration life sim.">
<meta name="robots" content="noindex">
<style>
	:root {
		--bg: #eef2e3;
		--bg2: #e5ecd6;
		--card: #fffdf7;
		--ink: #2f3a27;
		--muted: #6b7263;
		--faint: #9aa189;
		--accent: #4a7c46;
		--accent-dark: #35602f;
		--accent-soft: #dceccf;
		--gold: #d9a441;
		--sky: #6ea8c8;
		--rose: #d77b8f;
		--rule: #dfe0cf;
		--shadow: 0 1px 2px rgba(47,58,39,.06), 0 6px 20px rgba(47,58,39,.07);
		--radius: 18px;
	}
	* { box-sizing: border-box; }
	html { -webkit-text-size-adjust: 100%; }
	body {
		margin: 0;
		background:
			radial-gradient(1200px 480px at 80% -10%, #f4f8ec 0%, transparent 60%),
			linear-gradient(180deg, var(--bg) 0%, var(--bg2) 100%);
		background-attachment: fixed;
		color: var(--ink);
		font: 15px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
		min-height: 100vh;
	}
	.wrap { max-width: 1180px; margin: 0 auto; padding: clamp(1rem, 3vw, 2.5rem) clamp(.9rem, 3vw, 2rem) 5rem; }

	/* ---- header ---- */
	header.top { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 1rem 1.4rem; margin-bottom: 1.6rem; }
	.brand { display: flex; align-items: center; gap: .8rem; }
	.brand .leaf {
		width: 46px; height: 46px; flex: none;
		border-radius: 14px;
		background: linear-gradient(140deg, var(--accent) 0%, var(--accent-dark) 100%);
		display: grid; place-items: center; box-shadow: var(--shadow);
	}
	.brand h1 { font-size: clamp(1.35rem, 3.5vw, 1.9rem); margin: 0; letter-spacing: -.02em; }
	.brand p { margin: .1rem 0 0; color: var(--muted); font-size: .92rem; }
	.meta { margin-left: auto; text-align: right; color: var(--muted); font-size: .82rem; }
	.meta .live { display: inline-flex; align-items: center; gap: .4rem; font-weight: 600; color: var(--accent-dark); }
	.dot { width: 9px; height: 9px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 0 rgba(74,124,70,.5); animation: pulse 2s infinite; }
	@keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(74,124,70,.45);} 70% { box-shadow: 0 0 0 8px rgba(74,124,70,0);} 100% { box-shadow: 0 0 0 0 rgba(74,124,70,0);} }
	button.refresh {
		margin-top: .4rem; font: inherit; font-size: .82rem; cursor: pointer;
		border: 1px solid var(--rule); background: var(--card); color: var(--accent-dark);
		padding: .35rem .8rem; border-radius: 999px; box-shadow: var(--shadow); transition: transform .1s;
	}
	button.refresh:hover { transform: translateY(-1px); }
	button.refresh:active { transform: translateY(0); }

	/* ---- section ---- */
	section { margin: 2.2rem 0 0; }
	.sec-head { display: flex; align-items: baseline; gap: .6rem; margin: 0 .2rem .85rem; }
	.sec-head h2 { font-size: 1.04rem; margin: 0; letter-spacing: -.01em; }
	.sec-head .sub { color: var(--faint); font-size: .82rem; }

	/* ---- kpi cards ---- */
	.grid { display: grid; gap: .8rem; }
	.kpis { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
	.card {
		background: var(--card); border: 1px solid var(--rule);
		border-radius: var(--radius); padding: 1rem 1.1rem; box-shadow: var(--shadow);
	}
	.kpi .v { font-size: clamp(1.5rem, 4.5vw, 2rem); font-weight: 700; letter-spacing: -.02em; line-height: 1.05; }
	.kpi .k { color: var(--muted); font-size: .8rem; margin-top: .25rem; }
	.kpi .hint { color: var(--faint); font-size: .72rem; margin-top: .35rem; }
	.kpi .v small { font-size: .55em; font-weight: 600; color: var(--faint); margin-left: .15em; }
	.accent { color: var(--accent-dark); }

	.two { grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }
	.three { grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); }

	.card h3 { margin: 0 0 .9rem; font-size: .96rem; }
	.card h3 .tag { float: right; font-size: .74rem; font-weight: 600; color: var(--faint); }

	/* ---- horizontal bar rows ---- */
	.bars { display: flex; flex-direction: column; gap: .55rem; }
	.bar { display: grid; grid-template-columns: minmax(64px, 34%) 1fr auto; align-items: center; gap: .6rem; }
	.bar .lab { color: var(--muted); font-size: .82rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-transform: capitalize; }
	.bar .track { background: var(--accent-soft); border-radius: 999px; height: 12px; overflow: hidden; }
	.bar .fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--accent) 0%, var(--accent-dark) 100%); min-width: 3px; transition: width .8s cubic-bezier(.2,.7,.2,1); }
	.bar .num { font-size: .8rem; color: var(--ink); font-variant-numeric: tabular-nums; min-width: 2.4ch; text-align: right; }
	.fill.sky { background: linear-gradient(90deg, #8cc0da, var(--sky)); }
	.fill.gold { background: linear-gradient(90deg, #e6bd62, var(--gold)); }
	.fill.rose { background: linear-gradient(90deg, #e5a0af, var(--rose)); }

	/* ---- funnel ---- */
	.funnel { display: flex; flex-direction: column; gap: .5rem; }
	.step { position: relative; background: var(--accent-soft); border-radius: 12px; overflow: hidden; }
	.step .sfill { background: linear-gradient(90deg, var(--accent), var(--accent-dark)); height: 100%; position: absolute; inset: 0; width: 0; border-radius: 12px; transition: width .9s cubic-bezier(.2,.7,.2,1); }
	.step .srow { position: relative; display: flex; justify-content: space-between; align-items: center; padding: .6rem .85rem; gap: 1rem; }
	.step .sname { font-weight: 600; font-size: .86rem; }
	.step .sval { font-variant-numeric: tabular-nums; font-size: .84rem; display: flex; gap: .55rem; align-items: baseline; }
	.step .spct { color: var(--accent-dark); font-weight: 700; }
	.step.lite .sname, .step.lite .sval { color: var(--ink); }
	.step .drop { color: var(--rose); font-size: .72rem; }

	/* ---- donut / distribution ---- */
	.legend { display: flex; flex-wrap: wrap; gap: .5rem .9rem; margin-top: .8rem; }
	.legend .li { display: flex; align-items: center; gap: .4rem; font-size: .8rem; color: var(--muted); }
	.legend .sw { width: 11px; height: 11px; border-radius: 3px; flex: none; }
	.donutwrap { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
	.donutwrap svg { flex: none; }

	/* ---- characters ---- */
	.charwrap { }
	.chargrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: .7rem; }
	.charcard {
		background: linear-gradient(180deg, #fffdf7, #f6f3e8);
		border: 1px solid var(--rule); border-radius: 16px;
		padding: .7rem .5rem .6rem; text-align: center; box-shadow: var(--shadow);
		transition: transform .12s ease;
	}
	.charcard:hover { transform: translateY(-3px); }
	.charcard svg { width: 100%; height: auto; max-width: 92px; }
	.charcard .cmeta { margin-top: .3rem; font-size: .72rem; color: var(--muted); line-height: 1.35; }
	.charcard .cmeta b { color: var(--accent-dark); font-weight: 700; }
	.charcard .badge { display: inline-block; margin-top: .25rem; font-size: .66rem; color: var(--gold); font-weight: 700; letter-spacing: .02em; }

	/* ---- swatches ---- */
	.swatches { display: flex; flex-wrap: wrap; gap: .5rem; }
	.swatch { display: flex; flex-direction: column; align-items: center; gap: .25rem; }
	.swatch .chip { width: 30px; height: 30px; border-radius: 9px; border: 1px solid rgba(0,0,0,.12); box-shadow: inset 0 0 0 2px rgba(255,255,255,.35); }
	.swatch .cnt { font-size: .72rem; color: var(--muted); font-variant-numeric: tabular-nums; }

	/* ---- histogram (mini columns) ---- */
	.cols { display: flex; align-items: flex-end; gap: .5rem; height: 108px; padding-top: .3rem; }
	.col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: .3rem; height: 100%; justify-content: flex-end; }
	.col .cbar { width: 100%; max-width: 42px; border-radius: 7px 7px 3px 3px; background: linear-gradient(180deg, var(--accent), var(--accent-dark)); min-height: 3px; transition: height .8s cubic-bezier(.2,.7,.2,1); }
	.col .cn { font-size: .72rem; color: var(--ink); font-variant-numeric: tabular-nums; }
	.col .cl { font-size: .68rem; color: var(--faint); text-align: center; }

	/* ---- editions: demo vs full ---- */
	.vs { display: flex; flex-direction: column; gap: .7rem; }
	.vslegend { display: flex; gap: 1rem; margin: 0 0 .2rem; font-size: .8rem; }
	.vslegend .li { display: flex; align-items: center; gap: .4rem; font-weight: 600; }
	.vslegend .sw { width: 12px; height: 12px; border-radius: 4px; }
	.vsrow { display: grid; grid-template-columns: 1fr auto; gap: .3rem .8rem; }
	.vsrow .vlab { color: var(--muted); font-size: .82rem; }
	.vsrow .vnums { font-variant-numeric: tabular-nums; font-size: .84rem; display: flex; gap: .8rem; align-items: baseline; }
	.vsrow .vd { color: #a9781c; font-weight: 700; }
	.vsrow .vf { color: var(--accent-dark); font-weight: 700; }
	.vsrow .vbar { grid-column: 1 / -1; height: 9px; border-radius: 999px; overflow: hidden; background: linear-gradient(90deg, var(--accent) 0%, var(--accent-dark) 100%); }
	.vsrow .vbar i { display: block; height: 100%; background: linear-gradient(90deg, #e6bd62, var(--gold)); border-radius: 999px; transition: width .8s cubic-bezier(.2,.7,.2,1); }
	.emptynote { color: var(--faint); font-size: .82rem; padding: .4rem 0; }
	footer { margin-top: 3rem; text-align: center; color: var(--faint); font-size: .76rem; }
	footer a { color: var(--accent-dark); }

	.skeleton { color: var(--faint); text-align: center; padding: 4rem 1rem; font-size: .95rem; }
	.err { background: #fdeaea; border: 1px solid #f3c9c9; color: #9c3b3b; border-radius: var(--radius); padding: 1rem 1.2rem; }

	@media (max-width: 560px) {
		.meta { margin-left: 0; text-align: left; width: 100%; }
		.bar { grid-template-columns: minmax(56px, 40%) 1fr auto; }
		.chargrid { grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); }
	}
</style>
</head>
<body>
<div class="wrap">
	<header class="top">
		<div class="brand">
			<div class="leaf" aria-hidden="true">
				<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M12 21C6 21 3 16 3 11 3 6 7 3 12 3c-1 4 2 6 5 7 3 1 4 4 4 5 0 3-3 6-9 6Z" fill="#eaf6df"/><path d="M12 21C9 17 9 11 12 3" stroke="#4a7c46" stroke-width="1.4" stroke-linecap="round"/></svg>
			</div>
			<div>
				<h1>Wild Willows Metrics</h1>
				<p>Anonymous gameplay analytics</p>
			</div>
		</div>
		<div class="meta">
			<div class="live"><span class="dot"></span> Live dashboard</div>
			<div id="generated">Loading…</div>
			<button class="refresh" id="refresh" type="button">↻ Refresh</button>
		</div>
	</header>

	<div id="root">
		<div class="skeleton skeleton-loading skeleton">
			<div class="skeleton" id="loading">Gathering the meadow’s numbers…</div>
		</div>
	</div>

	<footer>
		Wild Willows · a cozy nature-restoration life sim, backed by Harper ·
		metrics are aggregated and anonymous.
	</footer>
</div>

<script>
"use strict";

/* ------------------------------------------------------------------ *
 * Color helpers — ported 1:1 from src/color.ts so avatars match the
 * exact palette the game renders in-app.
 * ------------------------------------------------------------------ */
function hexToHsl(hex) {
	let c = String(hex || "#000000").replace("#", "");
	if (c.length === 3) c = c.split("").map((ch) => ch + ch).join("");
	const r = parseInt(c.slice(0, 2), 16) / 255;
	const g = parseInt(c.slice(2, 4), 16) / 255;
	const b = parseInt(c.slice(4, 6), 16) / 255;
	const max = Math.max(r, g, b), min = Math.min(r, g, b);
	const l = (max + min) / 2;
	if (max === min) return { h: 0, s: 0, l: l * 100 };
	const d = max - min;
	const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
	let h;
	if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
	else if (max === g) h = ((b - r) / d + 2) * 60;
	else h = ((r - g) / d + 4) * 60;
	return { h, s: s * 100, l: l * 100 };
}
function hslToHex(h, s, l) {
	h = ((h % 360) + 360) % 360;
	s = Math.max(0, Math.min(100, s)) / 100;
	l = Math.max(0, Math.min(100, l)) / 100;
	const k = (n) => (n + h / 30) % 12;
	const a = s * Math.min(l, 1 - l);
	const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
	const to = (v) => Math.round(v * 255).toString(16).padStart(2, "0");
	return \`#\${to(f(0))}\${to(f(8))}\${to(f(4))}\`;
}
function shade(hex, dl) { const { h, s, l } = hexToHsl(hex); return hslToHex(h, s, l + dl); }
const HAT_BASE = {
	straw: { a: "#c9a35c", b: "#d8b56e", line: "#a3814f" },
	leaf: { a: "#5d8a4a", line: "#436b35" },
	beanie: { a: "#b5707a", b: "#9e5f69" },
	cap: { a: "#5f86b0", b: "#4f739a", line: "#3f5f80" },
	bucket: { a: "#9aa86a", b: "#86945a" },
	party: { a: "#d77bb1", b: "#e89ac0", line: "#b45f95" },
	flower: { a: "#e87a9e" },
	wizard: { a: "#7d6b9e", b: "#8f7bb5", line: "#645380" },
	crown: { a: "#e0b23e", b: "#f0c95e", line: "#b8902e" },
	mushroom: { a: "#c9584c", b: "#d4685c", line: "#a84237" },
	ranger: { a: "#8a734f", b: "#9c845c", line: "#5d4a36" },
	bandana: { a: "#b05555", b: "#c96a5f", line: "#8d3f3f" },
};
function hatPalette(hat, custom) {
	const base = HAT_BASE[hat] || HAT_BASE.straw;
	if (!custom) return { a: base.a, b: base.b ?? shade(base.a, 8), line: base.line ?? shade(base.a, -14) };
	return { a: custom, b: shade(custom, 8), line: shade(custom, -14) };
}
function flowerPalette(custom) {
	const base = ["#e87a9e", "#f4c95f", "#c45ad0", "#e8954f"];
	if (!custom) return base;
	const c = hexToHsl(custom), b0 = hexToHsl(base[0]);
	return base.map((hex) => { const b = hexToHsl(hex); return hslToHex(c.h + (b.h - b0.h), c.s + (b.s - b0.s), c.l + (b.l - b0.l)); });
}

/* small helpers */
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const n = (x) => (x == null || isNaN(x) ? 0 : x);
const fmt = (x) => n(x).toLocaleString("en-US");
const pct = (x) => \`\${Math.round(n(x))}%\`;

/* ------------------------------------------------------------------ *
 * Avatar — ported from CharacterPreview (src/ui/icons.tsx). Returns an
 * SVG string. Names are never rendered.
 * ------------------------------------------------------------------ */
function avatarSVG(app) {
	const a = app || {};
	const skin = a.skin || "#eec39a", hair = a.hair || "#6e4a33", outfit = a.outfit || "#4a7c59";
	const hat = a.hat || "none", hatColor = a.hatColor || null;
	const hairstyle = a.hairstyle || "short", beard = a.beard || "none", body = a.body || "slim";
	const bw = body === "round" ? 8 : 0;
	const hp = hatPalette(hat, hatColor);
	const fl = flowerPalette(hatColor);
	let s = "";
	s += \`<ellipse cx="50" cy="104" rx="\${26 + bw / 2}" ry="7" fill="#000" opacity="0.12"/>\`;
	if (hairstyle === "long") s += \`<path d="M29 30 Q26 78 34 86 L66 86 Q74 78 71 30 Z" fill="\${hair}"/>\`;
	if (hairstyle === "curly-long") s += \`<g fill="\${hair}"><path d="M29 30 Q26 76 34 84 L66 84 Q74 76 71 30 Z"/><circle cx="31" cy="62" r="8"/><circle cx="69" cy="62" r="8"/><circle cx="33" cy="78" r="8"/><circle cx="67" cy="78" r="8"/><circle cx="50" cy="84" r="9"/><circle cx="41" cy="83" r="8"/><circle cx="59" cy="83" r="8"/></g>\`;
	if (hairstyle === "ponytail") s += \`<g fill="\${hair}"><ellipse cx="67" cy="32" rx="9" ry="10"/><ellipse cx="75" cy="47" rx="8" ry="13"/><ellipse cx="75" cy="61" rx="6.5" ry="11"/></g><ellipse cx="73" cy="41" rx="4.5" ry="3.2" fill="#c9913f"/>\`;
	if (hairstyle === "pigtails") s += \`<g fill="\${hair}"><ellipse cx="27" cy="33" rx="8.5" ry="10"/><ellipse cx="21" cy="49" rx="7.5" ry="12"/><ellipse cx="73" cy="33" rx="8.5" ry="10"/><ellipse cx="79" cy="49" rx="7.5" ry="12"/></g><ellipse cx="24" cy="42" rx="4.2" ry="3" fill="#c9913f"/><ellipse cx="76" cy="42" rx="4.2" ry="3" fill="#c9913f"/>\`;
	if (hairstyle === "afro") s += \`<circle cx="50" cy="33" r="28" fill="\${hair}"/>\`;
	if (hairstyle === "bob") s += \`<g fill="\${hair}"><ellipse cx="30" cy="42" rx="8" ry="14"/><ellipse cx="70" cy="42" rx="8" ry="14"/></g>\`;
	if (hairstyle === "braid") s += \`<g fill="\${hair}"><ellipse cx="68" cy="34" rx="8" ry="9"/><circle cx="71" cy="49" r="6.2"/><circle cx="73" cy="58" r="5.5"/><circle cx="74.5" cy="66" r="4.8"/><circle cx="75" cy="73" r="4"/></g><ellipse cx="75" cy="78.5" rx="3.2" ry="2.4" fill="#c9913f"/>\`;
	// body
	s += \`<path d="M\${30 - bw} 70 Q\${30 - bw} 56 50 56 Q\${70 + bw} 56 \${70 + bw} 70 L\${68 + bw} 96 Q\${68 + bw} 102 60 102 L40 102 Q\${32 - bw} 102 \${32 - bw} 96 Z" fill="\${outfit}"/>\`;
	s += \`<path d="M36 70 Q36 62 50 62 Q64 62 64 70 L63 84 L37 84 Z" fill="#ffffff" opacity="0.14"/>\`;
	s += \`<ellipse cx="\${28 - bw}" cy="76" rx="6" ry="11" fill="\${outfit}" transform="rotate(8 \${28 - bw} 76)"/>\`;
	s += \`<ellipse cx="\${72 + bw}" cy="76" rx="6" ry="11" fill="\${outfit}" transform="rotate(-8 \${72 + bw} 76)"/>\`;
	s += \`<ellipse cx="42" cy="103" rx="6.5" ry="4.5" fill="#5d4a36"/><ellipse cx="58" cy="103" rx="6.5" ry="4.5" fill="#5d4a36"/>\`;
	// head
	s += \`<circle cx="50" cy="38" r="21" fill="\${skin}"/>\`;
	if (hairstyle === "curly" || hairstyle === "curly-long") s += \`<g fill="\${hair}"><circle cx="34" cy="27" r="9"/><circle cx="44" cy="21" r="10"/><circle cx="56" cy="21" r="10"/><circle cx="66" cy="27" r="9"/><circle cx="29" cy="38" r="7"/><circle cx="71" cy="38" r="7"/></g>\`;
	if (hairstyle === "afro") s += \`<g fill="\${hair}"><circle cx="33" cy="26" r="11"/><circle cx="45" cy="18" r="12"/><circle cx="57" cy="18" r="12"/><circle cx="68" cy="26" r="11"/><circle cx="28" cy="39" r="9"/><circle cx="72" cy="39" r="9"/></g>\`;
	if (hairstyle === "mohawk") s += \`<path d="M43 24 L46 5 L49 21 L52 3 L55 21 L58 6 L60 24 Q52 19 43 24 Z" fill="\${hair}"/>\`;
	if (!["curly", "curly-long", "afro", "mohawk", "bald"].includes(hairstyle))
		s += \`<path d="M30 34 Q31 18 50 17 Q69 18 70 34 Q66 26 50 25.5 Q34 26 30 34 Z" fill="\${hair}"/>\`;
	if (hairstyle === "bun" && hat === "none") s += \`<g><circle cx="50" cy="11" r="9" fill="\${hair}"/><rect x="42" y="16" width="16" height="4" rx="2" fill="#c9913f"/></g>\`;
	// face
	s += \`<circle cx="42.5" cy="40" r="2.6" fill="#3b2e25"/><circle cx="57.5" cy="40" r="2.6" fill="#3b2e25"/>\`;
	s += \`<circle cx="43.3" cy="39.2" r="0.9" fill="#fff"/><circle cx="58.3" cy="39.2" r="0.9" fill="#fff"/>\`;
	s += \`<path d="M46.5 47 Q50 50 53.5 47" stroke="#3b2e25" stroke-width="1.7" fill="none" stroke-linecap="round"/>\`;
	s += \`<circle cx="37" cy="45" r="3.4" fill="#e88" opacity="0.35"/><circle cx="63" cy="45" r="3.4" fill="#e88" opacity="0.35"/>\`;
	if (beard === "beard") s += \`<g><path d="M32 43 Q34.5 58.5 50 59 Q65.5 58.5 68 43 Q63.5 50.5 56.5 50.8 Q53 50.8 50 49.8 Q47 50.8 43.5 50.8 Q36.5 50.5 32 43 Z" fill="\${hair}"/><path d="M42.5 45.3 Q46 43.6 50 45.1 Q54 43.6 57.5 45.3 Q54 46.9 50 46.2 Q46 46.9 42.5 45.3 Z" fill="\${hair}"/><path d="M46.5 47.2 Q50 50 53.5 47.2" stroke="#3b2e25" stroke-width="1.7" fill="none" stroke-linecap="round"/></g>\`;
	// hats
	if (hat === "straw") s += \`<g><ellipse cx="50" cy="23" rx="27" ry="8" fill="\${hp.a}"/><path d="M36 22 Q36 8 50 8 Q64 8 64 22 Q57 19 50 19 Q43 19 36 22 Z" fill="\${hp.b}"/><path d="M36 20.5 Q50 24.5 64 20.5" stroke="\${hp.line}" stroke-width="3" fill="none"/></g>\`;
	if (hat === "leaf") s += \`<g transform="rotate(-8 50 16)"><path d="M28 20 Q42 2 72 9 Q67 26 40 25 Q32 24 28 20 Z" fill="\${hp.a}"/><path d="M30 19.5 Q50 17 68 11" stroke="\${hp.line}" stroke-width="1.8" fill="none"/></g>\`;
	if (hat === "beanie") s += \`<g><path d="M31 26 Q31 9 50 9 Q69 9 69 26 L69 28 Q59 24 50 24 Q41 24 31 28 Z" fill="\${hp.a}"/><path d="M31 27.5 Q50 22.5 69 27.5 L69 31 Q50 26.5 31 31 Z" fill="\${hp.b}"/><circle cx="50" cy="8" r="4.5" fill="#e8d8c8"/></g>\`;
	if (hat === "cap") s += \`<g><path d="M30 25 Q30 9 50 9 Q70 9 70 25 Z" fill="\${hp.a}"/><path d="M51 24 Q70 22 82 27 Q70 31 51 28 Z" fill="\${hp.b}"/><circle cx="50" cy="10" r="2.4" fill="\${hp.line}"/></g>\`;
	if (hat === "bucket") s += \`<g><path d="M35 23 Q35 10 50 10 Q65 10 65 23 Z" fill="\${hp.a}"/><path d="M27 22 L73 22 Q70 30 50 31 Q30 30 27 22 Z" fill="\${hp.b}"/><path d="M35 23 L65 23 L65 25 Q50 27 35 25 Z" fill="\${hp.b}"/></g>\`;
	if (hat === "flower") {
		let g = \`<g><path d="M29 25 Q50 31 71 25" stroke="#5d8a4a" stroke-width="4.5" fill="none" stroke-linecap="round"/>\`;
		[32, 43, 54, 65].forEach((x, i) => {
			g += \`<g>\`;
			[0, 1.26, 2.51, 3.77, 5.03].forEach((ang) => { g += \`<circle cx="\${x + Math.cos(ang) * 3.4}" cy="\${24 + Math.sin(ang) * 3.4}" r="2.4" fill="\${fl[i]}"/>\`; });
			g += \`<circle cx="\${x}" cy="24" r="1.7" fill="#fff3c4"/></g>\`;
		});
		s += g + \`</g>\`;
	}
	if (hat === "party") s += \`<g><path d="M50 1 L39 26 L61 26 Z" fill="\${hp.a}"/><path d="M50 1 L45.5 12 L54.5 12 Z" fill="\${hp.b}"/><path d="M43.5 19 L56.5 19 L58 26 L42 26 Z" fill="\${hp.line}"/><circle cx="50" cy="2" r="3.4" fill="#f4e08a"/></g>\`;
	if (hat === "ranger") s += \`<g><ellipse cx="50" cy="23" rx="29" ry="7" fill="\${hp.a}"/><path d="M37 22 Q37 8 50 8 Q63 8 63 22 Q57 18.5 50 18.5 Q43 18.5 37 22 Z" fill="\${hp.b}"/><path d="M37 21 Q50 25 63 21" stroke="\${hp.line}" stroke-width="3" fill="none"/></g>\`;
	if (hat === "mushroom") s += \`<g><path d="M29 22 Q29 3 50 3 Q71 3 71 22 Q71 25 67 25 L33 25 Q29 25 29 22 Z" fill="\${hp.a}"/><path d="M33 25 L67 25 Q60 28.5 50 28.5 Q40 28.5 33 25 Z" fill="\${hp.line}"/><circle cx="40" cy="11" r="3.4" fill="#f6efe3"/><circle cx="56" cy="8.5" r="4" fill="#f6efe3"/><circle cx="63" cy="17" r="2.6" fill="#f6efe3"/><circle cx="45" cy="18" r="2" fill="#f6efe3"/></g>\`;
	if (hat === "wizard") s += \`<g><ellipse cx="50" cy="22" rx="26" ry="7" fill="\${hp.a}"/><path d="M53 -6 Q50 6 61 22 L38 22 Q50 9 53 -6 Z" fill="\${hp.b}"/><path d="M39 21 Q50 17.5 60 21" stroke="\${hp.line}" stroke-width="3" fill="none"/><path d="M55 6 L56.2 9 L59.4 9.2 L56.9 11.1 L57.8 14.2 L55 12.4 L52.2 14.2 L53.1 11.1 L50.6 9.2 L53.8 9 Z" fill="#f4e08a"/></g>\`;
	if (hat === "crown") s += \`<g><path d="M36 24 L36 11 L42.5 17.5 L50 7 L57.5 17.5 L64 11 L64 24 Q50 20 36 24 Z" fill="\${hp.a}"/><path d="M36 24 L64 24 L64 27 Q50 23 36 27 Z" fill="\${hp.line}"/><circle cx="50" cy="20" r="2.1" fill="#c0503f"/><circle cx="42" cy="21.4" r="1.5" fill="#3f6fa8"/><circle cx="58" cy="21.4" r="1.5" fill="#3f6fa8"/></g>\`;
	if (hat === "bandana") s += \`<g><path d="M30 32 Q30 12 50 11 Q70 12 70 32 Q60 24 50 24 Q40 24 30 32 Z" fill="\${hp.a}"/><path d="M33 26 Q50 20 67 26" stroke="\${hp.line}" stroke-width="2" fill="none" opacity="0.6"/><path d="M68 25 L79 29 L71 33 Z" fill="\${hp.a}"/><path d="M70 30 L77.5 39 L68.5 35.5 Z" fill="\${hp.b}"/><circle cx="44" cy="17.5" r="1.2" fill="#fff" opacity="0.55"/><circle cx="56" cy="17.5" r="1.2" fill="#fff" opacity="0.55"/><circle cx="50" cy="14" r="1.2" fill="#fff" opacity="0.55"/></g>\`;
	if (hat === "none" && !["curly", "curly-long", "afro", "mohawk", "bun", "bald"].includes(hairstyle))
		s += \`<path d="M31 32 Q31 14 50 14 Q69 14 69 32 Q66 22 50 21 Q34 22 31 32 Z" fill="\${hair}"/>\`;
	return \`<svg viewBox="0 0 100 113" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Anonymous caretaker">\${s}</svg>\`;
}

/* ------------------------------------------------------------------ *
 * Render building blocks
 * ------------------------------------------------------------------ */
function kpi(v, k, hint) {
	return \`<div class="card kpi"><div class="v">\${v}</div><div class="k">\${k}</div>\${hint ? \`<div class="hint">\${hint}</div>\` : ""}</div>\`;
}
function barRows(entries, opts) {
	opts = opts || {};
	const cls = opts.cls || "";
	const rows = entries.filter((e) => e).map((e) => [e[0], n(e[1])]);
	if (!rows.length) return \`<div class="emptynote">No data yet.</div>\`;
	const max = opts.max || Math.max(...rows.map((r) => r[1]), 1);
	return \`<div class="bars">\${rows.map(([lab, val]) =>
		\`<div class="bar"><span class="lab" title="\${esc(lab)}">\${esc(opts.labelMap ? (opts.labelMap[lab] || lab) : lab)}</span>\` +
		\`<span class="track"><span class="fill \${cls}" style="width:\${Math.max(2, (val / max) * 100)}%"></span></span>\` +
		\`<span class="num">\${opts.fmtNum ? opts.fmtNum(val) : fmt(val)}</span></div>\`
	).join("")}</div>\`;
}
function objToEntries(obj) { return Object.entries(obj || {}).sort((a, b) => n(b[1]) - n(a[1])); }

function donut(segments, size) {
	size = size || 128;
	const total = segments.reduce((a, s) => a + n(s.value), 0) || 1;
	const r = size / 2 - 10, cx = size / 2, cy = size / 2, C = 2 * Math.PI * r;
	let off = 0;
	const rings = segments.map((s) => {
		const frac = n(s.value) / total;
		const dash = \`\${frac * C} \${C - frac * C}\`;
		const el = \`<circle cx="\${cx}" cy="\${cy}" r="\${r}" fill="none" stroke="\${s.color}" stroke-width="16" stroke-dasharray="\${dash}" stroke-dashoffset="\${-off * C}" transform="rotate(-90 \${cx} \${cy})"/>\`;
		off += frac;
		return el;
	}).join("");
	const svg = \`<svg width="\${size}" height="\${size}" viewBox="0 0 \${size} \${size}">\${rings}<text x="\${cx}" y="\${cy - 2}" text-anchor="middle" font-size="20" font-weight="700" fill="#2f3a27">\${fmt(total)}</text><text x="\${cx}" y="\${cy + 16}" text-anchor="middle" font-size="10" fill="#9aa189">total</text></svg>\`;
	const legend = \`<div class="legend">\${segments.map((s) => \`<span class="li"><span class="sw" style="background:\${s.color}"></span>\${esc(s.label)} · <b>\${fmt(s.value)}</b></span>\`).join("")}</div>\`;
	return \`<div class="donutwrap">\${svg}<div>\${legend}</div></div>\`;
}

function funnel(steps) {
	const top = n(steps[0] && steps[0].value) || 1;
	return \`<div class="funnel">\${steps.map((st, i) => {
		const w = Math.max(3, (n(st.value) / top) * 100);
		const drop = i > 0 && steps[i - 1].value ? Math.round((1 - n(st.value) / n(steps[i - 1].value)) * 100) : 0;
		return \`<div class="step"><span class="sfill" style="width:\${w}%"></span><div class="srow">\` +
			\`<span class="sname">\${esc(st.label)}</span>\` +
			\`<span class="sval"><span class="spct">\${pct((st.value / top) * 100)}</span><span>\${fmt(st.value)}</span>\` +
			\`\${i > 0 && drop > 0 ? \`<span class="drop">−\${drop}%</span>\` : ""}</span></div></div>\`;
	}).join("")}</div>\`;
}

function histCols(obj, opts) {
	opts = opts || {};
	const entries = opts.order ? opts.order.filter((k) => k in (obj || {})).map((k) => [k, obj[k]]) : Object.entries(obj || {});
	if (!entries.length) return \`<div class="emptynote">No data yet.</div>\`;
	const max = Math.max(...entries.map((e) => n(e[1])), 1);
	return \`<div class="cols">\${entries.map(([k, v]) => {
		const h = Math.max(3, (n(v) / max) * 82);
		return \`<div class="col"><span class="cn">\${fmt(v)}</span><span class="cbar" style="height:\${h}px"></span><span class="cl">\${esc(opts.labelMap ? (opts.labelMap[k] || k) : k)}</span></div>\`;
	}).join("")}</div>\`;
}

const r1 = (x) => Math.round(n(x) * 10) / 10;
/* Per-edition rollup computed from the players array. A player is "demo" only
 * when explicitly stamped edition:"demo"; everything else is the full game. */
function editionStats(arr) {
	const c = arr.length;
	const sum = (f) => arr.reduce((a, p) => a + n(f(p)), 0);
	const rate = (k) => (c ? Math.round((arr.filter((p) => p.activation && p.activation[k]).length / c) * 100) : 0);
	const playSec = sum((p) => p.playSeconds);
	const returning = arr.filter((p) => n(p.sessions) > 1).length;
	return {
		count: c,
		playHours: r1(playSec / 3600),
		avgMin: c ? Math.round(playSec / 60 / c) : 0,
		avgSessions: c ? r1(sum((p) => p.sessions) / c) : 0,
		totalActions: sum((p) => p.totalActions),
		avgActions: c ? Math.round(sum((p) => p.totalActions) / c) : 0,
		avgAch: c ? r1(sum((p) => p.achievements && p.achievements.earned) / c) : 0,
		avgHealth: c ? Math.round(sum((p) => p.biomeSummary && p.biomeSummary.avgHealth) / c) : 0,
		avgBiomes: c ? r1(sum((p) => p.unlockedBiomes) / c) : 0,
		collected: rate("collected"), crafted: rate("crafted"), placed: rate("placed"),
		attractedAnimal: rate("attractedAnimal"), unlockedSecondBiome: rate("unlockedSecondBiome"),
		returningPct: c ? Math.round((returning / c) * 100) : 0,
	};
}
function vsTable(rows, demo, full) {
	const legend = \`<div class="vslegend"><span class="li"><span class="sw" style="background:#d9a441"></span>Demo</span><span class="li"><span class="sw" style="background:var(--accent)"></span>Full</span></div>\`;
	const body = rows.map((row) => {
		const dv = demo[row.key], fv = full[row.key];
		const suf = row.suf || "";
		const share = n(dv) + n(fv) > 0 ? (n(dv) / (n(dv) + n(fv))) * 100 : 50;
		return \`<div class="vsrow"><span class="vlab">\${row.label}</span>\` +
			\`<span class="vnums"><span class="vd">\${fmt(dv)}\${suf}</span><span class="vf">\${fmt(fv)}\${suf}</span></span>\` +
			\`<span class="vbar"><i style="width:\${share}%"></i></span></div>\`;
	}).join("");
	return \`\${legend}<div class="vs">\${body}</div>\`;
}

function sec(title, sub, body) {
	return \`<section><div class="sec-head"><h2>\${title}</h2>\${sub ? \`<span class="sub">\${sub}</span>\` : ""}</div>\${body}</section>\`;
}
function card(inner) { return \`<div class="card">\${inner}</div>\`; }
function cardTitled(title, tag, inner) { return \`<div class="card"><h3>\${title}\${tag ? \`<span class="tag">\${tag}</span>\` : ""}</h3>\${inner}</div>\`; }

/* ------------------------------------------------------------------ *
 * Main render
 * ------------------------------------------------------------------ */
function render(data) {
	const s = (data && data.summary) || {};
	const players = (data && data.players) || [];
	const A = s.audience || {}, E = s.engagement || {}, R = s.retention || {}, P = s.progression || {};
	const out = [];

	/* ---- Overview KPIs ---- */
	out.push(sec("Overview", "who is out there right now", \`<div class="grid kpis">\${[
		kpi(fmt(s.players), "Total caretakers", "unique anonymous saves"),
		kpi(\`<span class="accent">\${fmt(A.activeNow)}</span>\`, "Active now", "seen in the last 5 minutes"),
		kpi(fmt(A.activeLast24h), "Active · 24h"),
		kpi(fmt(A.activeLast7d), "Active · 7d"),
		kpi(fmt(A.newLast24h), "New · 24h", \`\${fmt(A.newLast7d)} in the last 7 days\`),
		kpi(fmt(A.dormant), "Dormant", "quiet for over a week"),
	].join("")}</div>\`));

	/* ---- Engagement KPIs ---- */
	out.push(sec("Engagement", "time spent tending the wild", \`<div class="grid kpis">\${[
		kpi(\`\${fmt(E.totalPlayHours)}<small>hrs</small>\`, "Total play time"),
		kpi(\`\${fmt(E.avgPlayMinutesPerPlayer)}<small>min</small>\`, "Avg per caretaker"),
		kpi(fmt(E.totalSessions), "Sessions", \`\${n(E.avgSessionsPerPlayer)} avg per caretaker\`),
		kpi(\`\${fmt(E.avgSessionMinutes)}<small>min</small>\`, "Avg session length"),
		kpi(fmt(E.totalActions), "Total actions", \`\${fmt(E.avgActionsPerPlayer)} avg per caretaker\`),
		kpi(\`<span class="accent">\${pct(R.returningRatePct)}</span>\`, "Return rate", \`\${fmt(R.returningPlayers)} came back\`),
	].join("")}</div>\`));

	/* ---- Editions: demo vs full ---- */
	const edOf = (p) => (p.edition === "demo" ? "demo" : "full");
	const demoPlayers = players.filter((p) => edOf(p) === "demo");
	const fullPlayers = players.filter((p) => edOf(p) === "full");
	const dStat = editionStats(demoPlayers), fStat = editionStats(fullPlayers);
	const edSum = s.editions || {};
	const playersDonut = donut([
		{ label: "Full", value: edSum.full != null ? edSum.full : fStat.count, color: "#4a7c46" },
		{ label: "Demo", value: edSum.demo != null ? edSum.demo : dStat.count, color: "#d9a441" },
	].filter((x) => x.value));
	const vsRows = [
		{ key: "count", label: "Caretakers" },
		{ key: "playHours", label: "Total play time", suf: "h" },
		{ key: "avgMin", label: "Avg play / caretaker", suf: "m" },
		{ key: "avgSessions", label: "Avg sessions / caretaker" },
		{ key: "totalActions", label: "Total actions" },
		{ key: "avgActions", label: "Avg actions / caretaker" },
		{ key: "avgAch", label: "Avg achievements earned" },
		{ key: "avgHealth", label: "Avg biome health", suf: "%" },
		{ key: "avgBiomes", label: "Avg biomes unlocked" },
		{ key: "returningPct", label: "Returned (2+ sessions)", suf: "%" },
		{ key: "collected", label: "Collected a resource", suf: "%" },
		{ key: "crafted", label: "Crafted an item", suf: "%" },
		{ key: "placed", label: "Placed an object", suf: "%" },
		{ key: "attractedAnimal", label: "Attracted an animal", suf: "%" },
		{ key: "unlockedSecondBiome", label: "Unlocked 2nd biome", suf: "%" },
	];
	out.push(sec("Editions · demo vs full", "how the free demo compares to the full game",
		cardTitled("Caretakers by edition", "who is playing", playersDonut) +
		\`<div class="card" style="margin-top:.8rem"><h3>Every metric, side by side<span class="tag">demo vs full</span></h3>\` +
		vsTable(vsRows, dStat, fStat) + \`</div>\`));

	/* ---- Characters gallery (rendered here, appended at the bottom) ---- */
	let charSection = "";
	const withApp = players.filter((p) => p && p.appearance);
	if (withApp.length) {
		// sort by achievement points / playtime so the most-developed caretakers lead
		const sorted = [...withApp].sort((a, b) =>
			n(b.achievements && b.achievements.points) - n(a.achievements && a.achievements.points) ||
			n(b.playSeconds) - n(a.playSeconds));
		const cards = sorted.map((p) => {
			const mins = Math.round(n(p.playSeconds) / 60);
			const ach = n(p.achievements && p.achievements.earned);
			const biomes = n(p.unlockedBiomes || (p.biomeSummary && p.biomeSummary.biomesUnlocked));
			const restored = n(p.biomeSummary && p.biomeSummary.biomesFullyRestored);
            const meta = mins > 0
                ? \`<b>\${mins}m</b> played · <b>\${ach}</b>★\`
                : \`just created\`;
			return \`<div class="charcard">\${avatarSVG(p.appearance)}<div class="cmeta">\${meta}<br>\${biomes} biome\${biomes === 1 ? "" : "s"} unlocked</div>\${restored > 0 ? \`<span class="badge">✦ \${restored} restored</span>\` : ""}</div>\`;
		}).join("");
		charSection = sec("Caretakers they created", \`\${withApp.length} characters with saved looks · names hidden\`,
			\`<div class="card charwrap"><div class="chargrid">\${cards}</div></div>\`);
	}

	/* ---- Acquisition + Activation funnels ---- */
	const acq = s.acquisition || {};
	const fun = s.funnel || {};
	const acqCards = cardTitled("Acquisition funnel", "per device", funnel([
		{ label: "Opened the app", value: acq.devices },
		{ label: "Created a character", value: acq.converted },
	]) + \`<div class="grid three" style="margin-top:1rem">\${[
		kpi(fmt(acq.totalOpens), "App opens"),
		kpi(\`<span class="accent">\${pct(acq.conversionPct)}</span>\`, "Conversion"),
		kpi(pct(acq.bounceRatePct), "Bounced"),
	].join("")}</div>\`);
	const funSteps = funnel([
		{ label: "Created character", value: fun.created },
		{ label: "Collected a resource", value: fun.collected },
		{ label: "Crafted an item", value: fun.crafted },
		{ label: "Placed an object", value: fun.placed },
		{ label: "Attracted an animal", value: fun.attractedAnimal },
		{ label: "Unlocked 2nd biome", value: fun.unlockedSecondBiome },
	]);
	out.push(sec("Funnels", "from install to a thriving meadow",
		\`<div class="grid two">\${acqCards}\${cardTitled("Activation funnel", "all caretakers", funSteps)}</div>\`));

	/* ---- Progression ---- */
	const tut = P.tutorialStepHistogram || {};
	const tutDone = n(tut["99"]);
	const tutTotal = Object.values(tut).reduce((a, v) => a + n(v), 0) || 1;
	out.push(sec("Progression", "restoring the biomes", \`<div class="grid two">\` +
		cardTitled("Restoration", null, \`<div class="grid three">\${[
			kpi(\`\${fmt(P.avgBiomeHealth)}<small>%</small>\`, "Avg biome health"),
			kpi(fmt(P.biomesFullyRestored), "Biomes fully restored"),
			kpi(n(P.avgUnlockedBiomes), "Avg biomes unlocked"),
		].join("")}</div><div style="margin-top:.4rem" class="bars"><div class="bar"><span class="lab">Most loved</span><span class="track"><span class="fill gold" style="width:100%"></span></span><span class="num" style="text-transform:capitalize">\${esc(P.mostPopularArea || "—")}</span></div></div>\`) +
		cardTitled("Tutorial completion", \`\${pct((tutDone / tutTotal) * 100)} finished\`, histCols(tut, {
			labelMap: { "0": "Step 0", "99": "Done" },
		}) + \`<div class="hint" style="color:var(--faint);font-size:.76rem;margin-top:.5rem">Step 99 = tutorial complete. Early drop-off shows where new caretakers pause.</div>\`) +
		\`</div>\`));

	/* ---- Time by area ---- */
	const ad = s.areaDwell || {};
	const byAreaMin = ad.byAreaMinutes && Object.keys(ad.byAreaMinutes).length
		? ad.byAreaMinutes
		: Object.fromEntries(Object.entries(ad.byAreaSeconds || {}).map(([k, v]) => [k, Math.round(n(v) / 60)]));
	if (Object.keys(byAreaMin).length) {
		const totalMin = ad.totalSeconds != null ? Math.round(n(ad.totalSeconds) / 60) : Object.values(byAreaMin).reduce((a, v) => a + n(v), 0);
		out.push(sec("Time by area", "where caretakers spend their minutes", cardTitled(
			"Minutes per area", \`\${fmt(totalMin)}m total · most time in \${esc(ad.mostTimeArea || objToEntries(byAreaMin)[0][0])}\`,
			barRows(objToEntries(byAreaMin), { cls: "sky", fmtNum: (v) => \`\${fmt(v)}m\` }))));
	}

	/* ---- Platforms / OS / versions ---- */
	const plat = s.platforms || {}, oss = s.operatingSystems || {}, vers = s.versions || {};
	const platSeg = [
		{ label: "Desktop", value: plat.desktop, color: "#4a7c46" },
		{ label: "Web", value: plat.web, color: "#6ea8c8" },
	].filter((x) => x.value);
	out.push(sec("Platforms & builds", "where the game is being played", \`<div class="grid two">\` +
		cardTitled("Platform", null, donut(platSeg)) +
		cardTitled("Operating system", null, barRows(objToEntries(oss), { labelMap: { mac: "macOS", windows: "Windows", linux: "Linux" }, cls: "sky" })) +
		\`</div><div class="card" style="margin-top:.8rem"><h3>Game version</h3>\` +
		barRows(objToEntries(vers), { cls: "gold" }) + \`</div>\`));

	/* ---- Action totals ---- */
	const acts = s.actionTotals || {};
	const actLabels = {
		resourcesCollected: "Resources collected", terraformActions: "Terraform actions", plantsPlanted: "Plants planted",
		itemsCrafted: "Items crafted", objectsPlaced: "Objects placed", animalsReturned: "Animals returned",
		itemsDiscarded: "Items discarded", animalsObserved: "Animals observed", chestDeposits: "Chest deposits",
		tasksCompleted: "Tasks completed", toolsUpgraded: "Tools upgraded", homeUpgrades: "Home upgrades",
		recolors: "Recolors", chestWithdrawals: "Chest withdrawals", objectsMoved: "Objects moved",
		objectsRemoved: "Objects removed", homesBuilt: "Homes built",
	};
	out.push(sec("What caretakers do", "every tracked action, all-time", card(
		barRows(objToEntries(acts).slice(0, 17), { labelMap: actLabels }))));

	/* ---- Onboarding timing ---- */
	const cr = s.creation || {}, ttfa = s.timeToFirstAction || {};
	out.push(sec("Onboarding", "first impressions", \`<div class="grid kpis">\${[
		kpi(\`\${n(cr.avgCreationSeconds)}<small>s</small>\`, "Avg creation time", \`\${fmt(cr.savesWithTiming)} timed\`),
		kpi(\`\${n(cr.medianCreationSeconds)}<small>s</small>\`, "Median creation time"),
		kpi(\`\${n(ttfa.avgSeconds)}<small>s</small>\`, "Time to first action", \`\${fmt(ttfa.playersMeasured)} measured\`),
		kpi(\`\${n(acq.avgCharactersPerPerson)}\`, "Characters per person", \`\${fmt(acq.totalCharactersCreated)} created total\`),
	].join("")}</div>\`));

	/* ---- Achievements ---- */
	const ach = s.achievements || {};
	const byCat = ach.byCategory || {};
	const catLabels = { "getting-started": "Getting started", biome: "Biome", preserve: "Preserve", mastery: "Mastery" };
	out.push(sec("Achievements", "milestones earned across the meadow", \`<div class="grid two">\` +
		cardTitled("Totals", null, \`<div class="grid three">\${[
			kpi(fmt(ach.totalEarned), "Earned", \`of \${fmt(ach.totalDefined)} defined\`),
			kpi(n(ach.avgPerPlayer), "Avg per caretaker"),
			kpi(\`\${fmt(ach.avgPoints)}<small>pts</small>\`, "Avg points"),
		].join("")}</div><div style="margin-top:1rem">\${barRows(objToEntries(byCat), { labelMap: catLabels, cls: "gold" })}</div>\`) +
		cardTitled("Completion spread", "% of achievements earned", histCols(ach.completionHistogram, {
			order: ["0", "1-10", "11-20", "21-30", "31-40", "41-50"],
			labelMap: { "0": "0%", "1-10": "1–10", "11-20": "11–20", "21-30": "21–30", "31-40": "31–40", "41-50": "41–50" },
		}) + \`<div class="hint" style="color:var(--faint);font-size:.76rem;margin-top:.5rem">Most caretakers are early on; a few have restored nearly everything.</div>\`) +
		\`</div>\`));

	/* ---- Most-earned achievements ---- */
	const rec = s.achievements && s.achievements.recentDistribution;
	if (rec && Object.keys(rec).length) {
		out.push(sec("Popular achievements", "most frequently earned", card(
			barRows(objToEntries(rec).slice(0, 12), { cls: "" }))));
	}

	/* ---- Character gallery — kept at the bottom ---- */
	if (charSection) out.push(charSection);

	document.getElementById("root").innerHTML = out.join("");
}

/* ------------------------------------------------------------------ *
 * Fetch + wire-up
 * ------------------------------------------------------------------ */
async function load() {
	const root = document.getElementById("root");
	const gen = document.getElementById("generated");
	root.innerHTML = \`<div class="skeleton">Gathering the meadow’s numbers…</div>\`;
	try {
		// Exclude dev/test saves so they don't skew the numbers (matches the
		// server's ?exclude filter — case-insensitive, exact display-name match).
		const res = await fetch("../Metrics/?exclude=bailey_test", { headers: { accept: "application/json" } });
		if (!res.ok) throw new Error(\`Metrics endpoint returned \${res.status}\`);
		const data = await res.json();
		render(data);
		if (data.generatedAt) {
			const d = new Date(data.generatedAt);
			gen.textContent = \`Updated \${d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}\`;
		}
	} catch (err) {
		root.innerHTML = \`<div class="err"><b>Couldn’t load metrics.</b><br>\${esc(err.message || err)}<br><span style="font-size:.8rem;opacity:.8">The dashboard reads from the <code>/Metrics/</code> endpoint on this host.</span></div>\`;
		gen.textContent = "";
	}
}

document.getElementById("refresh").addEventListener("click", load);
// expose for offline/unit rendering (jsdom smoke test)
window.__renderDashboard = render;
if (!window.__NO_AUTOLOAD) load();
<\/script>
</body>
</html>
`,ja="0.1.15+2026-07-17T12:44:17.919Z";class qt{constructor(a){this.buf=a}get length(){return this.buf.length}toString(a="hex"){if(a==="base64"){let o="";for(const n of this.buf)o+=String.fromCharCode(n);return typeof btoa<"u"?btoa(o):o}if(a==="utf8")return new TextDecoder().decode(this.buf);let e="";for(const o of this.buf)e+=o.toString(16).padStart(2,"0");return e}at(a){return this.buf[a]}}function Da(t){const a=new Uint8Array(t),e=globalThis;if(e.crypto?.getRandomValues)e.crypto.getRandomValues(a);else for(let o=0;o<t;o++)a[o]=Math.floor(Math.random()*256);return a}function Oa(t){return new qt(Da(t))}function Ft(t,a,e){const o=`${a}::${t}`,n=new Uint8Array(e);let r=2166136261;for(let s=0;s<e;s++){const c=o.charCodeAt(s%o.length)||s+1;r^=c,r=Math.imul(r,16777619)>>>0,r^=r>>>13,n[s]=(r^s*2654435761)&255}return new qt(n)}function Ea(t,a){const e=t?.length??0;if(e!==(a?.length??-1))return!1;let o=0;for(let n=0;n<e;n++){const r=typeof t.at=="function"?t.at(n):t[n],s=typeof a.at=="function"?a.at(n):a[n];o|=r^s}return o===0}const zt=Lt.records.map(t=>t.id);function Re(t){return Math.max(0,Math.round((t?.metrics?.playSeconds||0)*1e3)+(t?.clockOffsetMs||0))}const M=()=>{const t=typeof databases<"u"&&databases?databases.wildwillows:null;if(!t||!t.Player)throw new g(h("server.err.dbStarting"),503);return t};class g extends Error{constructor(a,e=400){super(a),this.statusCode=e}}const Ae=(t,a,e)=>Math.max(a,Math.min(e,t));function ut(t){let a=2166136261;for(let e=0;e<t.length;e++)a^=t.charCodeAt(e),a=Math.imul(a,16777619);return a>>>0}function ht(t){let a=t>>>0;return()=>{a|=0,a=a+1831565813|0;let e=Math.imul(a^a>>>15,1|a);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}function _t(t,a){const e=Number(t);if(!Number.isInteger(e)||e<=0)throw new g(h("server.err.positiveWholeNumber",{label:a}));return e}function he(t){return t?Object.values(t).reduce((a,e)=>a+(e||0),0):0}function ct(t){return/end of buffer|buffer not reached|decod/i.test(String(t?.message||t))}async function Wa(t,a){try{return await t.delete(a),!0}catch(e){if(!ct(e))throw e}try{return await t.put({id:a}),await t.delete(a),!0}catch{return!1}}async function X(t,a){try{const e=await t.get(a);if(e)try{JSON.stringify({...e})}catch(o){if(ct(o))throw o}return e}catch(e){if(ct(e))return await Wa(t,a),console.error(`purged undecodable record: ${a}`),null;throw e}}async function Ve(t){const a=[];try{for await(const e of t)a.push(e)}catch(e){console.error("scan: skipping undecodable record(s) —",e?.message||e)}return a}async function ie(t){return!t||typeof t.search!="function"?[]:Ve(t.search({}))}async function _(t,a){return!t||typeof t.search!="function"?[]:(await Ve(t.search({}))).filter(o=>o?.playerId===a)}function F(t){return t?.worldId||t?.id}async function $(t,a){return!t||typeof t.search!="function"?[]:(await Ve(t.search({}))).filter(o=>(o?.worldId??o?.playerId)===a)}async function He(t,a,e){return(await $(t,a)).find(n=>n.id===e)||null}async function Xe(t,a,e,o,n){return(await $(t,a)).find(s=>s.area===e&&s.x===o&&s.y===n)||null}async function be(t,a,e){return(await $(t,a)).find(n=>n.biomeId===e)||null}async function Ha(t,a,e){return(await $(t,a)).find(n=>n.animalId===e)||null}function Pt(){const t="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";let a="";for(let e=0;e<6;e++)a+=t[Math.floor(Math.random()*t.length)];return a}const ve=6;async function je(t,a={}){const e=M(),o=t.id;await e.World.get(o)||await e.World.put({id:o,name:t.name?h("server.world.soloName",{name:t.name}):h("server.world.mySoloName"),solo:!0,ownerId:t.id,joinCode:null,createdAt:t.createdAt||Date.now(),maxMembers:1,meadowShift:a.freshGrid?Ye:0,meadowShiftY:a.freshGrid?Je:0});const n=`${o}:${t.id}`;await e.WorldMember.get(n)||await e.WorldMember.put({id:n,worldId:o,playerId:t.id,role:"owner",joinedAt:t.createdAt||Date.now(),lastSeenAt:Date.now()}),t.worldId||await e.Player.patch(t.id,{worldId:o}),a.freshGrid||await Za(o)}async function Me(t){const a=M(),e=await _(a.WorldMember,t),o=[];for(const n of e){const r=await a.World.get(n.worldId);if(!r)continue;const s=(await $(a.WorldMember,r.id)).length;o.push({worldId:r.id,name:r.name,solo:!!r.solo,role:n.role,joinCode:r.solo?null:r.joinCode,memberCount:s,maxMembers:r.maxMembers||ve,isOwner:r.ownerId===t})}return o.sort((n,r)=>n.solo===r.solo?0:n.solo?-1:1)}async function et(t,a){const e=M(),o=await e.Player.get(t);if(!o)return[];const n=o.unlockedBiomes||["meadow"];if(a===o.id)return n;const r=await $(e.BiomeState,a),s=new Set(n);for(const i of r)i.unlocked&&s.add(i.biomeId);const c=[...s];return c.length!==n.length&&await e.Player.patch(t,{unlockedBiomes:c}),c}let Ct=!1;async function Na(){if(Ct)return;Ct=!0;const t=M(),a=[[t.Biome,Lt.records],[t.Recipe,ka.records],[t.HabitatObject,xa.records],[t.ToolDef,Sa.records],[t.ResourceType,Aa.records],[t.Animal,[...Ma.records,...Ia.records]],[t.Achievement,$a.records]];for(const[e,o]of a){const n=new Set(o.map(r=>r.id));for(const r of await Ve(e.search({})))n.has(r.id)||await e.delete(r.id);for(const r of o)await e.put(r)}}let ot=null;async function z(){if(await Na(),!ot){const t=M(),[a,e,o,n,r,s,c]=await Promise.all([ie(t.Biome),ie(t.Animal),ie(t.ResourceType),ie(t.Recipe),ie(t.HabitatObject),ie(t.ToolDef),ie(t.Achievement)]),i=l=>new Map(l.map(m=>[m.id,m]));c.sort((l,m)=>(l.order||0)-(m.order||0)),ot={biomes:a,animals:e,resources:o,recipes:n,objects:r,tools:s,achievements:c,biome:i(a),animal:i(e),resource:i(o),recipe:i(n),object:i(r),tool:i(s),achievement:i(c)}}return ot}const tt=75,Se=5,lt="grasshopper",Ze=100,st={biome:"meadow",minHealth:30},fe={cabin:{name:"Log Cabin",floor:"#c8a064",wall:"#5e3f29",accent:"#b5707a",materials:{branches:16,fiber:6},requires:st,perk:{id:"forage",base:.1,perLevel:.05,cap:.6}},cottage:{name:"Meadow Cottage",floor:"#e6d3a6",wall:"#aab9c6",accent:"#7fae6a",materials:{wildflowers:6,fiber:10,clay:4},requires:st,perk:{id:"growth",base:.1,perLevel:.04,cap:.5}},stone:{name:"Stone Hearth",floor:"#a9a499",wall:"#6f6a62",accent:"#d98a4f",materials:{stones:14,clay:6},requires:st,perk:{id:"thrift",base:.1,perLevel:.05,cap:.6}}},Ne={style:"cabin",space:1,comfort:1,decor:1,light:1,styleLocked:!1},ye={space:{name:"Space",blurb:"A bigger room with more floor to decorate.",levels:[{inner:{w:6,h:5}},{inner:{w:8,h:6},materials:{branches:12,fiber:8},requires:{biome:"meadow",minHealth:30}},{inner:{w:10,h:7},materials:{branches:18,stones:6,clay:6},requires:{biome:"forest",minHealth:45}},{inner:{w:12,h:9},materials:{branches:24,clay:10,"clean-water":6},requires:{biome:"wetland",minHealth:55}}]},comfort:{name:"Comfort",blurb:"Carry more on every gathering trip (+capacity).",levels:[{carry:0},{carry:45,materials:{fiber:10,branches:4},requires:{biome:"meadow",minHealth:35}},{carry:95,materials:{fiber:14,moss:6},requires:{biome:"forest",minHealth:50}},{carry:160,materials:{reeds:10,fiber:12},requires:{biome:"wetland",minHealth:60}}]},decor:{name:"Furnishings",blurb:"A finer rug and wall trim in your style.",levels:[{},{materials:{fiber:8,wildflowers:4}},{materials:{fiber:12,berries:6},requires:{biome:"meadow",minHealth:50}},{materials:{fiber:16,clay:6},requires:{biome:"forest",minHealth:55}}]},light:{name:"Warmth",blurb:"Windows and a warm hearth glow.",levels:[{},{materials:{branches:6,stones:4}},{materials:{stones:8,clay:4},requires:{biome:"forest",minHealth:45}},{materials:{clay:6,"clean-water":4},requires:{biome:"wetland",minHealth:55}}]}};function ce(t){if(t?.home)return{...Ne,...t.home};const a=t?.homeTier||1;return{...Ne,space:a,comfort:a,styleLocked:a>1}}const La=t=>ye.comfort.levels[(ce(t).comfort||1)-1]?.carry||0,qa=5;function ft(t){const a=ce(t);if(!a.styleLocked)return null;const e=fe[a.style]?.perk;if(!e)return null;const o=(a.space||1)+(a.comfort||1)+(a.decor||1)+(a.light||1),n=Math.min(e.cap,e.base+e.perLevel*Math.max(0,o-qa));return{id:e.id,strength:n}}function Fa(t){const a=ye.space.levels[(ce(t).space||1)-1]?.inner||{w:8,h:6},e=Math.floor((bt-a.w)/2),o=Math.floor((vt-a.h)/2);return{x0:e,y0:o,x1:e+a.w-1,y1:o+a.h-1}}const Ge={w:6,h:5};function Le(t){const a=/^tent-([a-z][a-z-]*)$/.exec(String(t||""));return a?a[1]:null}function za(){const t=Math.floor((bt-Ge.w)/2),a=Math.floor((vt-Ge.h)/2);return{x0:t,y0:a,x1:t+Ge.w-1,y1:a+Ge.h-1}}const _a=.75,Qa={1:200,2:350,3:550,4:800},Qt={water:6,wildflowers:1},dt={basket:1,shovel:1,"watering-can":1,"field-journal":1},Gt=["#f6d7b8","#eec39a","#d9a06b","#b97f50","#8d5a3a","#6b4226"],Ut=["#3b2e25","#6e4a33","#a3692f","#c9913f","#d9b380","#8c8c8c"],Zt=["#4a7c59","#7a9ac0","#b5707a","#c9913f","#7d6b9e","#5d8a8a"],Yt=["straw","leaf","beanie","cap","bucket","flower","party","ranger","mushroom","wizard","crown","bandana","none"],Ga=["#c9a35c","#b5707a","#5f86b0","#5d8a4a","#7d6b9e","#b05555"],Jt=["short","bald","long","bob","curly","curly-long","bun","braid","ponytail","pigtails","afro","mohawk"],Kt=["none","beard"],Vt=["slim","round"];function it(t,a){return typeof t=="string"&&/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(t.trim())?t.trim().toLowerCase():a}function Xt(t){return t=t||{},{skin:it(t.skin,Gt[1]),hair:it(t.hair,Ut[1]),outfit:it(t.outfit,Zt[0]),hat:Yt.includes(t.hat)?t.hat:"straw",hatColor:typeof t.hatColor=="string"&&/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(t.hatColor.trim())?t.hatColor.trim().toLowerCase():null,hairstyle:Jt.includes(t.hairstyle)?t.hairstyle:"short",beard:Kt.includes(t.beard)?t.beard:"none",body:Vt.includes(t.body)?t.body:"slim"}}function pt(t){if(!t)return t;const{passcode:a,passcodeHash:e,passcodeSalt:o,...n}=t;return n}function wt(t,a){const e=Oa(16).toString("hex"),o=Ft(String(t),e,32).toString("hex");return{salt:e,hash:o}}function Ua(t,a,e){try{const o=globalThis.Buffer,n=Ft(String(t),a,32),r=o.from(e,"hex");return n.length===r.length&&Ea(n,r)}catch{return!1}}async function gt(t,a){const e=String(a||"");if(t.passcodeHash&&t.passcodeSalt)return Ua(e,t.passcodeSalt,t.passcodeHash);if(typeof t.passcode=="string"&&e.length>0&&e===t.passcode){const{salt:o,hash:n}=wt(e);return await M().Player.patch(t.id,{passcodeHash:n,passcodeSalt:o,passcode:null}),!0}return!1}function Be(t){return String(t).trim().toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"")}const ue={x:23,y:5,capacity:120},Ye=14,Je=0;async function Za(t){const a=M(),e=await X(a.World,t),o=typeof e?.meadowShift=="number"?e.meadowShift:0,n=typeof e?.meadowShiftY=="number"?e.meadowShiftY:0,r=Ye-o,s=Je-n;if(r!==0||s!==0){for(const c of[a.Placement,a.TerrainTile,a.Chest])for(const i of await $(c,t))i.area==="meadow"&&await c.patch(i.id,{x:(Number(i.x)||0)+r,y:(Number(i.y)||0)+s});for(const c of await $(a.WorldMember,t)){const i=await X(a.Player,c.playerId);i?.area==="meadow"&&F(i)===t&&await a.Player.patch(i.id,{x:(Number(i.x)||0)+r,y:(Number(i.y)||0)+s})}}return e&&(o!==Ye||n!==Je)&&await a.World.patch(t,{meadowShift:Ye,meadowShiftY:Je}),r!==0||s!==0}async function H(t){if(!t||typeof t!="string")throw new g(h("server.err.playerIdRequired"));const a=await X(M().Player,t);if(!a)throw new g(h("server.err.noSaveLogin"),404);return{player:a}}function qe(t){return{firstSeenAt:t,lastSeenAt:t,lastHeartbeatAt:0,playSeconds:0,sessions:0,counts:{},areaSeconds:{},curSessionSeconds:0,sessionLengths:{},firstActionAt:0,creationMs:0}}const ea=new Set(["recolors","appearanceChanges"]);function Ya(t){const a=t/60;return a<2?"<2m":a<10?"2-10m":a<30?"10-30m":"30m+"}async function J(t,a={},e={}){if(!t?.id)return null;const o=Object.entries(a).filter(([,u])=>u),n=Object.entries(e).filter(([,u])=>u);if(!o.length&&!n.length)return t.metrics||null;const r=Date.now(),s=await M().Player.get(t.id)||t,c=s.metrics||qe(s.createdAt||r),i={...c.counts||{}};for(const[u,p]of o)i[u]=(i[u]||0)+p;const l={...c,counts:i,lastSeenAt:r};!c.firstActionAt&&o.some(([u,p])=>p&&!ea.has(u))&&(l.firstActionAt=r);const m={metrics:l};if(n.length){const u=yt(s,r),d={...(s.daily?.dayKey===u?s.daily:{counts:{}}).counts||{}};for(const[f,w]of n)d[f]=(d[f]||0)+w;m.daily={dayKey:u,counts:d}}return await M().Player.patch(t.id,m),l}const xe=864e5,Ja=4,Ka=t=>(Number.isFinite(t?.tzOffsetMinutes)?t.tzOffsetMinutes:0)*6e4,ta=t=>{const a=Math.round(Number(t));return Number.isFinite(a)?Ae(a,-840,840):0};function yt(t,a){return Math.floor((a+Ka(t)-Ja*36e5)/xe)}const Y=t=>Math.round(t*10)/10;function aa(t){const a=Date.now(),e=t.metrics||qe(t.createdAt||a),o=e.playSeconds||0,n=e.sessions||0,r=e.counts||{},s=Object.entries(r).reduce((v,[I,A])=>v+(ea.has(I)?0:A||0),0),c=t.createdAt||e.firstSeenAt||a,i=e.lastSeenAt||null,l=e.areaSeconds||{},m={};for(const[v,I]of Object.entries(l))m[v]=Math.round((I||0)/60);const u=Object.entries(l).sort((v,I)=>(I[1]||0)-(v[1]||0))[0]?.[0]||null,p=e.firstActionAt||0,d=p?Y((p-c)/1e3):null,f=e.creationMs||0,w=i?Y((a-i)/36e5):null,x=Math.floor((a-c)/xe);let y="dormant";return w!=null&&(w<=24?y="active":w<=24*7&&(y="recent")),{playerId:t.id,name:t.name,createdAt:c,firstSeenAt:e.firstSeenAt||c,lastSeenAt:i,daysSinceJoined:x,hoursSinceActive:w,status:y,isNewToday:a-c<=xe,language:e.language||null,sessions:n,playSeconds:o,playMinutes:Math.round(o/60),avgSessionMinutes:n?Math.round(o/60/n):0,totalActions:s,actionsPerSession:n?Y(s/n):0,actionsPerMinute:o>0?Y(s/(o/60)):0,tutorialStep:t.tutorialStep||0,currentArea:t.area||null,unlockedBiomes:(t.unlockedBiomes||[]).length,areaSeconds:l,areaMinutes:m,mostTimeArea:u,sessionLengths:e.sessionLengths||{},timeToFirstActionSeconds:d,creationMs:f,creationSeconds:f?Y(f/1e3):null,appearance:t.appearance||null,counts:r}}function Va(t,a,e){const o=t.counts||{};return{collected:(o.resourcesCollected||0)>0,crafted:(o.itemsCrafted||0)>0||Object.keys(e.craftedEver||{}).length>0,placed:(o.objectsPlaced||0)>0,attractedAnimal:(a?.totalAnimalsReturned||0)>0,unlockedSecondBiome:(t.unlockedBiomes||0)>=2}}const bt=30,vt=20,na=8;function Fe(t,a){const e=a==="home"?null:t.biome.get(a)?.grid,o=e?.cols||bt,n=(e?.rows||vt)+(a==="alpine"?na:0);return{cols:o,rows:n}}const Xa={tilled:"#8a6a48",watered:"#6b4f33",water:"#5d96c8"};function Bt(t,a,e){const o=parseInt(t.slice(1),16),n=parseInt(a.slice(1),16),r=s=>{const c=o>>s&255,i=n>>s&255;return Math.round(c+(i-c)*Ae(e,0,1))};return"#"+[r(16),r(8),r(0)].map(s=>s.toString(16).padStart(2,"0")).join("")}const en=t=>String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");function ra(t,a,e,o,n){const i=Fe(t,a?.id||""),l=i.cols*16+8*2,m=i.rows*16+8*2+22,u=a?.palette?.damaged||"#b9a37c",p=a?.palette?.healthy||"#8fbf6f",d=Bt(u,p,e/100),f=Bt(u,p,e/100*.8),w=v=>8+v*16,x=v=>8+v*16,y=[];y.push(`<rect x="0" y="0" width="${l}" height="${m}" rx="10" fill="${d}"/>`);for(let v=0;v<i.rows;v++)for(let I=0;I<i.cols;I++)(I+v)%2===0&&y.push(`<rect x="${w(I)}" y="${x(v)}" width="16" height="16" fill="${f}" opacity="0.22"/>`);for(const v of n){const I=Xa[v.type];I&&y.push(`<rect x="${w(v.x)}" y="${x(v.y)}" width="16" height="16" rx="3" fill="${I}"/>`)}for(const v of o){const A=t.object.get(v.objectId)?.color||"#6b5a3a";y.push(`<circle cx="${w(v.x)+16/2}" cy="${x(v.y)+16/2}" r="${16*.42}" fill="${A}" stroke="#2b3321" stroke-opacity="0.35"/>`)}return y.push(`<rect x="0" y="${m-22}" width="${l}" height="22" fill="#2b3321" opacity="0.55"/>`),y.push(`<text x="8" y="${m-7}" font-family="sans-serif" font-size="12" fill="#fdfaf0">${en(a?.name||"Area")} — ${e}% health · ${o.length} placed</text>`),`<svg xmlns="http://www.w3.org/2000/svg" width="${l}" height="${m}" viewBox="0 0 ${l} ${m}">${y.join("")}</svg>`}function oa(t){return"data:image/svg+xml;base64,"+globalThis.Buffer.from(t,"utf8").toString("base64")}async function tn(t,a={}){const e=M(),o=await z(),n=await _(e.BiomeState,t),r=new Map(n.map(l=>[l.biomeId,l])),s=a.images?await _(e.Placement,t):[],c=a.images?await _(e.TerrainTile,t):[],i=o.biomes.map(l=>{const m=r.get(l.id)||{},u={biomeId:l.id,name:l.name,health:m.health||0,balance:m.balance||0,returnedCount:m.returnedCount||0,unlocked:!!m.unlocked,explorable:!!l.explorable};if(a.images&&m.unlocked){const p=s.filter(f=>f.area===l.id),d=c.filter(f=>f.area===l.id);u.placements=p.length,u.snapshot=oa(ra(o,l,u.health,p,d))}return u});return{biomes:i,summary:an(i)}}function an(t){const a=t.filter(e=>e.unlocked);return{biomesUnlocked:a.length,biomesFullyRestored:a.filter(e=>(e.health||0)>=100).length,avgHealth:a.length?Math.round(a.reduce((e,o)=>e+(o.health||0),0)/a.length):0,totalAnimalsReturned:t.reduce((e,o)=>e+(o.returnedCount||0),0)}}async function nn(t,a,e,o,n=0,r=0,s="full"){const c=M(),i=await z(),l=Date.now(),{salt:m,hash:u}=wt(e),p={id:t,name:a,passcodeSalt:m,passcodeHash:u,appearance:o,tzOffsetMinutes:n,createdAt:l,clockOffsetMs:Ue(0,"day"),worldId:t,area:"meadow",x:24.5,y:6.5,inventory:{...Qt},craftedItems:{},tools:{...dt},unlockedBiomes:["meadow"],visitedBiomes:["meadow"],tutorialStep:0,home:{...Ne},metrics:{...qe(l),creationMs:r>0?Math.round(r):0,edition:s},customGoals:[]};await c.Player.put(p);const d=t,f=i.biomes.map(v=>({id:`${d}:${v.id}`,worldId:d,playerId:t,biomeId:v.id,health:Se,balance:0,returnedCount:0,unlocked:v.id==="meadow"}));for(const v of f)await c.BiomeState.put(v);const w=`pl_${t}_starter-chest`,x=[{id:w,worldId:d,playerId:t,objectId:"small-chest",area:"meadow",x:ue.x,y:ue.y,placedAt:l}];for(const v of x)await c.Placement.put(v);const y={id:w,worldId:d,playerId:t,area:"meadow",x:ue.x,y:ue.y,size:"small-chest",capacity:ue.capacity,contents:{}};return await c.Chest.put(y),{player:p,seeded:{biomeStates:f,placements:x,chests:[y]}}}async function rn(t){const a=Date.now(),e=await z(),o=t.player?.worldId||t.player?.id,n=Re(t.player);return{player:pt(t.player),biomeStates:t.seeded.biomeStates,placements:t.seeded.placements,chests:t.seeded.chests,discoveries:[],nodeStates:[],terrain:[],achievements:[],feed:[],serverTime:a,weather:Nt(o,n,zt),dailyTasks:It({player:t.player,d:e,discoveries:[],biomeStates:t.seeded.biomeStates,placements:t.seeded.placements,chests:t.seeded.chests,now:a}),customGoals:t.player.customGoals||[],goalLimit:St(t.player,e),nodeRegenSeconds:tt,inventoryCapacity:we(t.player)}}function we(t){const a=t.tools?.basket||1;return(Qa[a]||200)+La(t)}function on(t,a){const e=Date.now(),o={};for(const n of t){if(a&&n.plantedAt){const s=(a.object.get(n.objectId)?.growSeconds||0)*1e3;if(s>0&&e-n.plantedAt<s)continue}o[n.objectId]=(o[n.objectId]||0)+1}return o}const sn=90;function cn(t){const a=(100-Se)*(1-Math.exp(-Math.max(0,t)/sn));return Ae(Math.round(Se+a),0,100)}const ln=[{animals:5,cap:60},{animals:10,cap:75},{animals:15,cap:88}];function Rt(t){for(const a of ln)if(t<a.animals)return a.cap;return 100}function kt(t){return(t?.matureHours||0)*36e5}function dn(t,a,e){const o=kt(t);return o>0&&e-(a.placedAt||0)>=o}function jt(t,a,e,o){const n=kt(t);if(n<=0)return!1;const r=(a.placedAt||0)+n;return r>e&&r<=o}const mn=8;function un(t,a,e=0,o=Date.now()){let n=0,r=0;for(const s of a){const c=t.object.get(s.objectId);c&&(n+=c.healthValue||0,dn(c,s,o)&&(r+=c.matureBonus||0))}return n+=Math.min(r,mn),e>0&&(n+=2*Math.min(e,7)),n}const hn=.45,fn=.35,pn=.2;function Dt(t,a,e){const o=t.animals.filter(f=>f.biome===a),n=o.length;if(n===0)return 0;const r=o.filter(f=>e.has(f.id));if(r.length>=n)return 100;const s=r.length/n,c=o.filter(f=>(f.requirements?.animals||[]).length>0),i=c.filter(f=>e.has(f.id)).length,l=c.length?i/c.length:1,m=new Set(o.map(f=>f.kind)),u=new Set(r.map(f=>f.kind)),p=m.size?u.size/m.size:0,d=hn*s+fn*l+pn*p;return Ae(Math.round(d*100),0,99)}function sa(t,a=!1){const e=new Set(t.filter(s=>s.type==="water"&&(!a||!s.seeded)).map(s=>`${s.x},${s.y}`)),o=new Set;let n=0,r=0;for(const s of e){if(o.has(s))continue;const c=[s];o.add(s);let i=0,l=1/0,m=-1/0,u=1/0,p=-1/0;for(;c.length;){const[d,f]=c.pop().split(",").map(Number);i++,l=Math.min(l,d),m=Math.max(m,d),u=Math.min(u,f),p=Math.max(p,f);for(const[w,x]of[[1,0],[-1,0],[0,1],[0,-1]]){const y=`${d+w},${f+x}`;e.has(y)&&!o.has(y)&&(o.add(y),c.push(y))}}n=Math.max(n,i),r=Math.max(r,Math.max(m-l+1,p-u+1))}return{tiles:e.size,lake:n,river:r}}function wn(t,a){const e=t.requirements?.conditions;return e?!(!a||Array.isArray(e.weather)&&e.weather.length&&!e.weather.includes(a.type)||Array.isArray(e.season)&&e.season.length&&!e.season.includes(a.season)||Array.isArray(e.dayPhase)&&e.dayPhase.length&&!e.dayPhase.includes(a.dayPhase)):!0}function gn(t,a,e,o,n,r,s=null){const c=t.requirements||{};if(a<(c.minHealth||0)||e<(c.minBalance||0)||!wn(t,s))return!1;for(const[l,m]of Object.entries(c.objects||{}))if((o[l]||0)<m)return!1;for(const l of c.animals||[])if(!n.has(l))return!1;const i=c.water;return!(i&&((r.tiles||0)<(i.tiles||0)||(r.lake||0)<(i.lake||0)||(r.river||0)<(i.river||0)))}function Ot(t,a){const e=t.requirements?.objects||{},o=Object.keys(e);if(!o.length)return 70;let n=30,r=0,s=0;for(const[c,i]of Object.entries(e)){const l=a[c]||0;l>=i?(n+=Math.round(30/o.length),s+=l-i):r++}return n+=Math.round(40*(1-Math.exp(-s/6))),n-=r*25,Ae(n,5,100)}function Ke(t,a){const e=t.requirements||{},o=[],n=Object.entries(e.objects||{}).map(([s,c])=>h("server.whyReturned.objectQty",{qty:c,name:a.object.get(s)?.name||s}));if(n.length&&o.push(h("server.whyReturned.habitat",{objects:n.join(h("server.list.comma"))})),e.water){const s=e.water;s.lake?o.push(h("server.whyReturned.lake",{tiles:s.lake})):s.river?o.push(h("server.whyReturned.river",{tiles:s.river})):s.tiles&&o.push(h("server.whyReturned.tiles",{tiles:s.tiles}))}e.minHealth&&o.push(h("server.whyReturned.health",{health:e.minHealth})),e.minBalance&&o.push(h("server.whyReturned.balance",{balance:e.minBalance})),e.animals?.length&&o.push(h("server.whyReturned.animals",{animals:e.animals.map(s=>a.animal.get(s)?.name||s).join(h("server.list.and"))}));const r=e.conditions;if(r){const s=[];r.weather?.length&&s.push(r.weather.join(h("server.list.or"))),r.season?.length&&s.push(h("server.whyReturned.inSeason",{seasons:r.season.join(h("server.list.or"))})),r.dayPhase?.length&&s.push(h("server.whyReturned.atPhase",{phases:r.dayPhase.join(h("server.list.or"))})),s.length&&o.push(h("server.whyReturned.moment",{conditions:s.join(h("server.list.comma"))}))}return h("server.whyReturned.sentence",{reasons:o.join(h("server.list.comma"))})}async function re(t,a,e,o={}){const n=M(),r=await z();if(!r.biome.get(e))throw new g(h("server.err.unknownBiome",{biome:e}));let s=(await $(n.Placement,t)).filter(C=>C.area===e);o.removeIds?.length&&(s=s.filter(C=>!o.removeIds.includes(C.id)));for(const C of o.addPlacements||[])C.area===e&&(s=s.filter(L=>L.id!==C.id),s.push(C));const c=on(s,r);let i=(await $(n.TerrainTile,t)).filter(C=>C.area===e);o.removeTerrainIds?.length&&(i=i.filter(C=>!o.removeTerrainIds.includes(C.id)));for(const C of o.addTerrain||[])C.area===e&&(i=i.filter(L=>L.id!==C.id),i.push(C));const l=Math.min(3,i.filter(C=>C.type==="watered").length)*.5,m=i.filter(C=>C.type==="water"&&!C.seeded).length,u=sa(i),p=Date.now(),d=un(r,s,m,p)+l,f=cn(d),w=o.player||await X(n.Player,a),x=w?Re(w):null,y=x===null?null:{type:Ht(t,e,x),season:Ta(x),dayPhase:va(x)},v=await $(n.Discovery,t),I=new Set(v.map(C=>C.animalId)),A=()=>[...I].filter(C=>r.animal.get(C)?.biome===e).length;let T=Math.min(f,Rt(A())),j=Dt(r,e,I);const P=[],D=r.animals.filter(C=>C.biome===e),W=I.has(lt);for(const C of D)if(!I.has(C.id)&&!(!W&&C.id!==lt)&&gn(C,T,j,c,I,u,y)){const L={id:`${t}:${C.id}`,worldId:t,playerId:a,animalId:C.id,biomeId:e,comfort:Ot(C,c),timesObserved:0,firstObservedAt:Date.now(),whyReturned:Ke(C,r)};await n.Discovery.put(L),I.add(C.id),j=Dt(r,e,I),P.push({...L,animal:C});break}T=Math.min(f,Rt(A()));for(const C of v){if(C.biomeId!==e)continue;const L=r.animal.get(C.animalId);if(!L)continue;const V=Ot(L,c);V!==C.comfort&&await n.Discovery.patch(C.id,{comfort:V})}const q=A(),N=await be(n.BiomeState,t,e),G=N?.id??`${t}:${e}`;await n.BiomeState.patch(G,{health:T,balance:j,returnedCount:q});const te={...N||{id:G,worldId:t,playerId:a,biomeId:e,unlocked:e==="meadow"},health:T,balance:j,returnedCount:q},oe=T-(N?.health??Se),K={};if(oe>0&&(K[`health:${e}`]=oe),P.length&&(K[`animal:${e}`]=P.length,K.animal=P.length),Object.keys(K).length){const C=o.player||await n.Player.get(a);C&&await J(C,{},K)}const ee=await xt(t,a,{player:o.player,freshState:te});return{biomeState:te,newAnimals:P,unlockedBiomes:ee}}const ia={wetland:[...[6,7,8,9,10,11,12,13,14].map(t=>({x:t,y:4,type:"water"})),{x:14,y:5,type:"water"},{x:14,y:6,type:"water"},{x:15,y:6,type:"water"},{x:20,y:6,type:"water"},{x:21,y:6,type:"water"},{x:22,y:6,type:"water"},{x:20,y:7,type:"water"},{x:21,y:7,type:"water"},{x:22,y:7,type:"water"},{x:10,y:14,type:"watered"},{x:11,y:14,type:"watered"}]};async function We(t,a,e){const o=ia[e];if(!o)return;const n=M();for(const r of o){const s=`${t}:${e}:${r.x}:${r.y}`;await n.TerrainTile.get(s)||await n.TerrainTile.put({id:s,worldId:t,playerId:a,area:e,x:r.x,y:r.y,type:r.type,seeded:!0,updatedAt:Date.now()})}}async function xt(t,a,e={}){const o=M(),n=await z(),r=e.player||await o.Player.get(a),s=[],c=new Set(r.unlockedBiomes||[]),i=new Set(r.pendingUnlockRewards||[]),l=new Set((await $(o.BiomeState,t)).filter(m=>m.unlocked).map(m=>m.biomeId));for(const m of n.biomes){if(!m.unlock||l.has(m.id))continue;const u=m.unlock,p=e.freshState?.biomeId===u.biome?e.freshState:await be(o.BiomeState,t,u.biome);if(!p||!l.has(u.biome)||(p.health||0)<(u.minHealth||0)||(p.returnedCount||0)<(u.minAnimals||0)||u.minTotalAnimals&&(await $(o.Discovery,t)).length<u.minTotalAnimals)continue;if(u.requiresItem){const f=r.craftedItems?.[u.requiresItem]||0,w=r.craftedEver?.[u.requiresItem]||0;if(f<=0&&w<=0)continue}if(u.requiresTool&&(r.tools?.[u.requiresTool.id]||1)<u.requiresTool.tier)continue;l.add(m.id),c.add(m.id),i.add(m.id),await o.Player.patch(a,{unlockedBiomes:[...c],pendingUnlockRewards:[...i]});const d=await be(o.BiomeState,t,m.id);await o.BiomeState.patch(d?.id??`${t}:${m.id}`,{unlocked:!0}),await We(t,a,m.id),s.push({id:m.id,name:m.name})}return s}function yn(t,a){const e=t.unlock;return e?!(typeof e.minHealth=="number"&&a.health<e.minHealth||typeof e.animalsReturned=="number"&&a.animalsReturned<e.animalsReturned||e.requiresAnimal&&!a.returnedAnimalIds.has(e.requiresAnimal)||e.requiresCrafted&&(a.craftedEver?.[e.requiresCrafted]||0)<=0):!0}async function bn(t,a,e,o){const n=M(),r=await be(n.BiomeState,t,a),s=await $(n.Discovery,t),c=new Set(s.filter(i=>o.animal.get(i.animalId)?.biome===a).map(i=>i.animalId));return{health:r?.health||0,animalsReturned:c.size,returnedAnimalIds:c,craftedEver:e.craftedEver||{}}}async function ca(t,a,e,o){const n=await He(t.Chest,o,e);if(n)return n;const r=await He(t.Placement,o,e);if(r){const s=a.object.get(r.objectId);if(s?.isChest){const c={id:e,worldId:o,playerId:r.playerId,area:r.area,x:r.x,y:r.y,size:r.objectId,capacity:s.chestCapacity||60,contents:{}};return await t.Chest.put(c),c}}return null}async function ze(t,a,e=t.id){const o=M(),n=await $(o.Chest,e);for(const[i,l]of Object.entries(a)){const m=t.inventory?.[i]||0,u=n.reduce((p,d)=>p+(d.contents?.[i]||0),0);if(m+u<l)throw new g(h("server.err.notEnough",{resource:i,need:l,have:m+u}))}const r={inventory:{},chests:{}},s={...t.inventory||{}},c=new Map(n.map(i=>[i.id,{...i.contents||{}}]));for(const[i,l]of Object.entries(a)){let m=l;const u=Math.min(s[i]||0,m);u>0&&(s[i]-=u,s[i]<=0&&delete s[i],r.inventory[i]=u,m-=u);for(const p of n){if(m<=0)break;const d=c.get(p.id),f=Math.min(d[i]||0,m);f>0&&(d[i]-=f,d[i]<=0&&delete d[i],r.chests[p.id]=r.chests[p.id]||{},r.chests[p.id][i]=f,m-=f)}if(m>0)throw new g(h("server.err.notEnoughShort",{resource:i}))}await o.Player.patch(t.id,{inventory:s});for(const i of n)r.chests[i.id]&&await o.Chest.patch(i.id,{contents:c.get(i.id)});return{usedFrom:r,inventory:s}}const vn={craft:"hammer",build:"hammer",grow:"leaf",plant:"leaf",collect:"basket",observe:"journal",welcome:"paw",attract:"paw",welcomeTotal:"paw",home:"home",tool:"hammer",unlock:"map",health:"leaf",biomeAnimals:"paw"},kn=["space","comfort","decor","light"],la=6;function St(t,a){const e=new Set(t?.unlockedBiomes||["meadow"]);return a.biomes.filter(n=>n.explorable).every(n=>e.has(n.id))?6:3}function xn(t){const{d:a,biomeStates:e,discoveries:o,player:n}=t,r=new Map(e.map(s=>[s.biomeId,s]));for(const s of a.biomes){const c=s.unlock;if(!c||r.get(s.id)?.unlocked)continue;const i=r.get(c.biome);if(!i?.unlocked||!(n?.visitedBiomes||["meadow"]).includes(c.biome))continue;const l=a.biome.get(c.biome)?.name||c.biome,m=a.biome.get(s.id)?.name||s.id,u=[];if(c.minHealth&&u.push({text:h("server.nextbiome.health",{biome:l,goal:c.minHealth,cur:Math.round(i.health||0)}),done:(i.health||0)>=c.minHealth}),c.minAnimals&&u.push({text:h("server.nextbiome.animals",{biome:l,goal:c.minAnimals,cur:i.returnedCount||0}),done:(i.returnedCount||0)>=c.minAnimals}),c.minTotalAnimals&&u.push({text:h("server.nextbiome.total",{goal:c.minTotalAnimals,cur:o.length}),done:o.length>=c.minTotalAnimals}),c.requiresItem){const d=a.object.get(c.requiresItem)?.name||c.requiresItem,f=(n?.craftedItems?.[c.requiresItem]||0)+(n?.craftedEver?.[c.requiresItem]||0);u.push({text:h("server.nextbiome.craft",{item:d}),done:f>0})}if(!u.length)return null;const p=u.filter(d=>d.done).length;return{id:"next-biome",kind:"unlock",icon:"map",pinned:!0,text:h("server.nextbiome.title",{biome:m}),hint:h("server.nextbiome.hint",{biome:m}),target:u.length,progress:p,counter:"",reward:{},steps:u,claimed:!1}}return null}function Sn(t,a){const e=a.d.animal.get(t);if(!e)return[];const o=(a.d.biome.get(e.biome)?.order||1)+1;if((a.player?.tools?.["field-journal"]||1)<o)return[{text:h("server.goal.upgradeGuide"),done:!1}];const r=[];for(const[s,c]of Object.entries(e.requirements?.objects||{})){const i=(a.placements||[]).filter(l=>l.objectId===s&&l.area===e.biome).length;r.push({text:h("server.goal.habitatStep",{have:Math.min(i,c),need:c,name:a.d.object.get(s)?.name||s}),done:i>=c})}if(e.requirements?.minHealth){const s=a.biomeStates.find(i=>i.biomeId===e.biome),c=Math.round(s?.health||0);r.push({text:h("server.goal.healthStep",{cur:c,need:e.requirements.minHealth}),done:c>=e.requirements.minHealth})}return r}function An(t,a){const e=(a.d.recipes||[]).find(o=>o.output?.itemId===t);return At(e?.materials||{},a)}function Mn(t,a){return At(fe[t]?.materials||{},a)}function In(t,a,e){const n=(e.d.tool.get(t)?.tiers||[]).find(r=>r.tier===a);return At(n?.materials||{},e)}function At(t,a){return Object.entries(t).map(([e,o])=>{const n=Mt(a,e);return{text:h("server.goal.matStep",{have:Math.min(n,o),need:o,name:a.d.resource.get(e)?.name||e}),done:n>=o}})}function $n(t){const e=(t.unlockedBiomes?.length?t.unlockedBiomes:t.player?.unlockedBiomes?.length?t.player.unlockedBiomes:["meadow"]).flatMap(o=>t.d.biome.get(o)?.resources||[]);return[...new Set(e)].filter(o=>o!=="water"&&!mt(o)&&t.d.resource.get(o))}function Et(t,a){const e=$n(t),o={};if(!e.length)return o;const n=ht(ut(`goalreward:${a}`)),r=[...e];for(let s=0;s<2&&r.length;s++){const c=r.splice(Math.floor(n()*r.length),1)[0];o[c]=3+Math.floor(n()*3)}return o}function Tn(t,a){const e=(t.d.biome.get(a)?.resources||[]).filter(s=>s!=="water"&&!mt(s)&&t.d.resource.get(s)),o={};if(!e.length)return o;const n=ht(ut(`unlockreward:${a}`)),r=[...e];for(let s=0;s<2&&r.length;s++){const c=r.splice(Math.floor(n()*r.length),1)[0];o[c]=4+Math.floor(n()*3)}return o}function Mt(t,a){const e=t.player?.inventory?.[a]||0,o=(t.chests||[]).reduce((n,r)=>n+(r.contents?.[a]||0),0);return e+o}function da(t,a){return(t.placements||[]).filter(e=>e.objectId===a).length}function Pn(t,a){return(t.placements||[]).filter(e=>e.objectId===a&&typeof e.plantedAt=="number").length}function ma(t,a){switch(t.kind){case"craft":case"build":return a.player?.craftedEver?.[t.itemId||""]||0;case"grow":return Pn(a,t.itemId||"");case"plant":return(a.placements||[]).filter(e=>typeof e.plantedAt=="number").length;case"collect":return Mt(a,t.resourceId||"");case"observe":return a.discoveries.filter(e=>(e.timesObserved||0)>0).length;case"welcomeTotal":return a.discoveries.length;default:return 0}}function Cn(t,a){switch(t.kind){case"craft":case"grow":case"plant":case"collect":case"observe":case"welcomeTotal":return Math.max(0,Math.min(t.target,ma(t,a)-(t.base||0)));case"build":{const e=Math.max(0,Math.min(t.target,(a.player?.craftedEver?.[t.itemId||""]||0)-(t.base||0))),o=Math.max(0,Math.min(t.target,da(a,t.itemId||"")-(t.basePlace||0)));return e+o}case"welcome":case"attract":return a.discoveries.some(e=>e.animalId===t.animalId)?1:0;case"home":if(t.track==="build"){const e=a.player?.home;return e?.styleLocked&&(!t.styleId||e.style===t.styleId)?1:0}return a.player?.home?.[t.track||""]>=t.target?t.target:Math.min(t.target,a.player?.home?.[t.track||""]||1);case"tool":{const e=a.player?.tools?.[t.toolId||""]||1;return Math.min(t.target,e)}case"unlock":return a.biomeStates.some(e=>e.biomeId===t.biomeId&&e.unlocked)?1:0;case"health":{const e=a.biomeStates.find(o=>o.biomeId===t.biomeId);return Math.min(t.target,Math.round(e?.health||0))}case"biomeAnimals":{const e=a.discoveries.filter(o=>o.biomeId===t.biomeId).length;return Math.min(t.target,e)}default:return 0}}function Bn(t,a){const e=a.d;switch(t.kind){case"craft":return h("server.goal.craft",{count:t.target,item:e.object.get(t.itemId)?.name||t.itemId});case"build":return h("server.goal.build",{count:t.target,item:e.object.get(t.itemId)?.name||t.itemId});case"grow":return h("server.goal.grow",{count:t.target,item:e.object.get(t.itemId)?.name||t.itemId});case"plant":return h("server.goal.plant",{count:t.target});case"collect":return h("server.goal.collect",{count:t.target,resource:e.resource.get(t.resourceId)?.name||t.resourceId});case"observe":return h("server.goal.observe",{count:t.target});case"welcome":return h("server.goal.welcome",{animal:e.animal.get(t.animalId)?.name||t.animalId});case"attract":return h("server.goal.attract",{kind:e.animal.get(t.animalId)?.kind||h("server.goal.creature")});case"welcomeTotal":return h("server.goal.welcomeTotal",{count:t.target});case"home":return t.track==="build"?h("server.goal.buildHome",{style:fe[t.styleId||""]?.name||h("server.goal.aHouse")}):h("server.goal.home",{track:h(`server.goal.track.${t.track}`),level:t.target});case"tool":{const o=e.tool.get(t.toolId),n=(o?.tiers||[]).find(r=>r.tier===t.target);return h("server.goal.tool",{tool:n?.name||o?.name||t.toolId})}case"unlock":return h("server.goal.unlock",{biome:e.biome.get(t.biomeId)?.name||t.biomeId});case"health":return h("server.goal.restore",{biome:e.biome.get(t.biomeId)?.name||t.biomeId,pct:t.target});case"biomeAnimals":return h("server.goal.biomeAnimals",{count:t.target,biome:e.biome.get(t.biomeId)?.name||t.biomeId});default:return""}}function Rn(t){const a=t.discoveries.some(o=>o.animalId===lt),e=Object.keys(t.player?.craftedEver||{}).length>0;return[{id:"start-gather",kind:"gather",icon:"basket",text:h("server.task.collectSeeds"),hint:h("server.task.gatherHint"),target:12,progress:Math.min(12,Mt(t,"seeds"))},{id:"start-craft",kind:"craft",icon:"hammer",text:h("server.task.craftFirst"),hint:h("server.task.craftFirstHint"),target:1,progress:e?1:0},{id:"start-welcome",kind:"welcome",icon:"sparkle",text:h("server.task.welcomeGrasshopper"),hint:h("server.task.welcomeGrasshopperHint"),target:1,progress:a?1:0}]}function jn(t,a){const e=[],o=["craft","build","grow","plant","collect","observe","welcome","attract","welcomeTotal","home","tool","unlock","health","biomeAnimals"];let n=!1;for(const r of Array.isArray(t)?t:[]){if(e.length>=la)break;const s=r?.kind;if(!o.includes(s))continue;if(s==="home"){if(n)continue;n=!0}const c=typeof r?.id=="string"&&r.id?r.id.slice(0,40):`cg_${Math.random().toString(36).slice(2,10)}`,i=Math.max(1,Math.min(99,Math.floor(Number(r?.target)||1))),l={id:c,kind:s,target:i};if(s==="craft"||s==="build"||s==="grow"){if(!a.object.get(r?.itemId))continue;l.itemId=r.itemId}else if(s==="collect"){if(!a.resource.get(r?.resourceId))continue;l.resourceId=r.resourceId}else if(s==="welcome"||s==="attract"){if(!a.animal.get(r?.animalId))continue;l.animalId=r.animalId,l.target=1}else if(s==="home")if(r?.track==="build"){if(!fe[r?.styleId])continue;l.track="build",l.styleId=r.styleId,l.target=1}else{if(!kn.includes(r?.track))continue;l.track=r.track}else if(s==="tool"){const m=a.tool.get(r?.toolId);if(!m)continue;const u=Math.max(1,...(m.tiers||[]).map(p=>p.tier));l.toolId=r.toolId,l.target=Math.min(u,Math.max(2,Math.floor(Number(r?.target)||2)))}else if(s==="unlock"){if(!a.biome.get(r?.biomeId))continue;l.biomeId=r.biomeId,l.target=1}else if(s==="health"){if(!a.biome.get(r?.biomeId))continue;l.biomeId=r.biomeId,l.target=Math.max(1,Math.min(100,Math.floor(Number(r?.target)||100)))}else if(s==="biomeAnimals"){if(!a.biome.get(r?.biomeId))continue;const m=a.animals.filter(u=>u.biome===r.biomeId).length;if(m<=0)continue;l.biomeId=r.biomeId,l.target=m}e.push(l)}return e}function It(t){const{player:a,now:e,d:o}=t,n=yt(a,e),r=a?.goalClaims||{},s=[],c=a?.pendingUnlockRewards||[];if(!c.length){const i=xn(t);i&&s.push(i)}for(const i of c){const l=o.biome.get(i)?.name||i;s.push({id:`unlock-reward:${i}`,kind:"unlock",icon:"sparkle",text:h("server.unlockreward.title",{biome:l}),hint:h("server.unlockreward.hint",{biome:l}),target:1,progress:1,counter:"",reward:Tn(t,i),claimed:!1})}for(const i of Rn(t))r[i.id]||s.push({...i,counter:"",reward:Et(t,i.id),claimed:!1});for(const i of a?.customGoals||[]){if(r[i.id])continue;const l=i.kind==="build"?i.target*2:i.target,m=i.kind==="attract"?Sn(i.animalId||"",t):i.kind==="craft"||i.kind==="build"?An(i.itemId||"",t):i.kind==="home"&&i.track==="build"?Mn(i.styleId||"",t):i.kind==="tool"?In(i.toolId||"",i.target,t):void 0;s.push({id:i.id,kind:i.kind,icon:vn[i.kind]||"check",text:Bn(i,t),target:l,counter:"",reward:Et(t,i.id),progress:Cn(i,t),claimed:!1,hint:h(`server.goal.hint.${i.kind}`),...m?{steps:m}:{}})}return{dayKey:n,endsAt:0,tasks:s}}async function De(t,a={}){const e=M(),o=await z();let n=await X(e.Player,t);const r=o.biome.get(n?.area),s=Le(n?.area),c=s?!!o.biome.get(s)?.explorable:!1;n&&n.area!=="home"&&!c&&(!r||!r.explorable)&&(n={...n,area:"meadow",x:24.5,y:6.5});const i=a.worldId||F(n),[l,m,u,p,d,f,w,x]=await Promise.all([$(e.BiomeState,i),$(e.Placement,i),$(e.Chest,i),$(e.Discovery,i),$(e.NodeState,i),$(e.TerrainTile,i),_(e.PlayerAchievement,t),$(e.FeedEntry,i)]),y=[...n?.unlockedBiomes?.length?n.unlockedBiomes:["meadow"]];if(n&&i!==n.id){const A=new Set(n.unlockedBiomes||["meadow"]);for(const T of l)T.unlocked&&A.add(T.biomeId);n={...n,unlockedBiomes:[...A]}}const v=Date.now(),I=Re(n);return{player:pt(n),worldId:i,biomeStates:l,placements:m,chests:u,discoveries:p,nodeStates:d,terrain:f,achievements:[...w].sort((A,T)=>(T.earnedAt||0)-(A.earnedAt||0)).map(A=>A.achievementId),feed:[...x].sort((A,T)=>(A.at||0)-(T.at||0)).slice(-Ze).map(A=>({id:A.id,at:A.at,icon:A.icon,text:A.text})),serverTime:v,weather:Nt(i,I,zt,n?.devWeather||null),dailyTasks:It({player:n,d:o,discoveries:p,biomeStates:l,placements:m,chests:u,now:v,unlockedBiomes:y}),customGoals:n?.customGoals||[],goalLimit:St(n,o),nodeRegenSeconds:tt,inventoryCapacity:we(n)}}async function O(t){const a=await t;if(!a||typeof a!="object")throw new g(h("server.err.bodyRequired"));return a}const Dn={"welcome-grasshopper":t=>!!t.disc("grasshopper"),forager:t=>(t.counts.resourcesCollected||0)>=100,"makers-hands":t=>(t.counts.itemsCrafted||0)>=10,"green-thumb":t=>(t.counts.plantsPlanted||0)>=10,waterworks:t=>(t.counts.terraformActions||0)>=15,"meadow-first-bloom":t=>t.returned("meadow")>=8,"meadow-pollinators":t=>t.kindReturned("meadow","insect")>=5,"meadow-apex":t=>!!t.disc("red-fox-meadow"),"meadow-mender":t=>t.health("meadow")>=80,"meadow-reborn":t=>t.returned("meadow")>=25,"forest-understory":t=>t.returned("forest")>=10,"forest-cavities":t=>!!t.disc("pileated-woodpecker")&&(!!t.disc("wood-duck")||!!t.disc("northern-flying-squirrel")||!!t.disc("great-horned-owl")||!!t.disc("barred-owl")),"forest-night-shift":t=>!!t.disc("great-horned-owl")&&!!t.disc("barred-owl")&&!!t.disc("little-brown-bat"),"forest-canopy":t=>t.health("forest")>=80,"forest-reborn":t=>t.returned("forest")>=25,"wetland-first-water":t=>t.returned("wetland")>=8,"wetland-engineer":t=>!!t.disc("beaver"),"wetland-lakemaker":t=>t.water("wetland").lake>=6,"wetland-restored":t=>t.health("wetland")>=80,"wetland-reborn":t=>t.returned("wetland")>=25,"desert-first-life":t=>t.returned("desert")>=8,"desert-burrows":t=>!!t.disc("burrowing-owl")&&!!t.disc("kangaroo-rat")&&!!t.disc("desert-tortoise"),"desert-hunter":t=>!!t.disc("rattlesnake")||!!t.disc("coyote"),"desert-restored":t=>t.health("desert")>=80,"desert-reborn":t=>t.returned("desert")>=25,"alpine-treeline":t=>t.returned("alpine")>=8,"alpine-haypile":t=>!!t.disc("pika"),"alpine-crown":t=>!!t.disc("golden-eagle"),"alpine-restored":t=>t.health("alpine")>=80,"alpine-reborn":t=>t.returned("alpine")>=25,"coastal-tide":t=>t.returned("coastal")>=8,"coastal-keystone":t=>!!t.disc("sea-star"),"coastal-otter":t=>!!t.disc("sea-otter"),"coastal-restored":t=>t.health("coastal")>=80,"coastal-reborn":t=>t.returned("coastal")>=25,"well-stocked":t=>(t.counts.resourcesCollected||0)>=1e3,"master-builder":t=>(t.counts.objectsPlaced||0)>=150,"master-gardener":t=>(t.counts.plantsPlanted||0)>=75,landscaper:t=>(t.counts.terraformActions||0)>=150,"fully-equipped":t=>t.tool("basket")>=4&&t.tool("shovel")>=4&&t.tool("watering-can")>=4,naturalist:t=>t.tool("field-journal")>=7,"recipe-collector":t=>t.craftedDistinct>=75,"open-road":t=>t.unlockedCount>=2,"welcoming-committee":t=>t.totalReturned>=50,"full-house":t=>t.totalReturned>=100,"field-notes":t=>(t.counts.animalsObserved||0)>=100,"steady-hand":t=>t.unlockedCount>=3&&t.unlockedHealthy(50),"three-restored":t=>t.biomesAtHealth(80)>=3,trailblazer:t=>t.unlockedCount>=6,"caretaker-of-the-whole":t=>t.totalReturned>=150};async function On(t){const a=await _(M().PlayerAchievement,t);return new Set(a.map(e=>e.achievementId))}async function En(t){const a=await z(),e=await _(M().PlayerAchievement,t),o=a.achievements.length||1,n=new Map(e.map(i=>[i.achievementId,i])),r=a.achievements.reduce((i,l)=>i+(n.has(l.id)&&l.points||0),0),s={};for(const i of a.achievements)n.has(i.id)&&(s[i.category]=(s[i.category]||0)+1);const c=[...e].sort((i,l)=>(l.earnedAt||0)-(i.earnedAt||0)).slice(0,5).map(i=>({id:i.achievementId,name:a.achievement.get(i.achievementId)?.name||i.achievementId,earnedAt:i.earnedAt}));return{earned:e.length,total:a.achievements.length,points:r,completion:Y(e.length/o),byCategory:s,recent:c}}async function le(t,a={}){try{const e=M(),o=await z(),n=await e.Player.get(t);if(!n)return[];const r=await On(t),s=F(n);let[c,i,l]=await Promise.all([$(e.BiomeState,s),$(e.Discovery,s),$(e.TerrainTile,s)]);for(const y of a.addDiscoveries||[])y?.animalId&&!i.some(v=>v.animalId===y.animalId)&&i.push(y);for(const y of a.freshBiomeStates||[])y?.biomeId&&(c=c.filter(v=>v.biomeId!==y.biomeId),c.push(y));const m=new Map(c.map(y=>[y.biomeId,y])),u=new Map(i.map(y=>[y.animalId,y])),p=new Map,d=new Set(n.unlockedBiomes||[]),f={counts:n.metrics?.counts||{},health:y=>m.get(y)?.health||0,returned:y=>m.get(y)?.returnedCount||0,disc:y=>u.get(y),totalReturned:i.length,kindReturned:(y,v)=>i.filter(I=>{const A=o.animal.get(I.animalId);return A&&A.biome===y&&A.kind===v}).length,tool:y=>n.tools?.[y]||1,unlockedCount:(n.unlockedBiomes||[]).length,craftedDistinct:Object.keys(n.craftedEver||{}).length,tutorialStep:n.tutorialStep||0,water:y=>(p.has(y)||p.set(y,sa(l.filter(v=>v.area===y),!0)),p.get(y)),biomesAtHealth:y=>c.filter(v=>(v.health||0)>=y).length,unlockedHealthy:y=>c.filter(v=>d.has(v.biomeId)).every(v=>(v.health||0)>=y)},w=Date.now(),x=[];for(const y of o.achievements){if(r.has(y.id))continue;const v=Dn[y.id];!v||!v(f)||(await e.PlayerAchievement.put({id:`${t}:${y.id}`,playerId:t,achievementId:y.id,biome:y.biome,earnedAt:w}),x.push(y))}return x}catch{return[]}}async function Oe(t,a,e={}){const o=await le(a,e);try{const n=M(),r=await n.World.get(t);if(r&&!r.solo)for(const s of await $(n.WorldMember,t))s.playerId!==a&&await le(s.playerId,e)}catch{}return o}class R extends Resource{allowRead(){return!0}allowCreate(){return!0}allowUpdate(){return!0}allowDelete(){return!1}}class Gn extends R{async get(){return{build:ja}}}class Un extends R{async get(){const a=await z();return{biomes:a.biomes,animals:a.animals,resources:a.resources,recipes:a.recipes,habitatObjects:a.objects.map(e=>({...e,rotatable:Tt(e)})),tools:a.tools,achievements:a.achievements,homeStyles:fe,homeTracks:ye,nodeRegenSeconds:tt,appearanceOptions:{skins:Gt,hair:Ut,outfits:Zt,hats:Yt,hatColors:Ga,hairstyles:Jt,beards:Kt,bodies:Vt}}}}class Zn extends R{async post(a){const{name:e,passcode:o,appearance:n,tzOffsetMinutes:r,creationMs:s,edition:c}=await O(a),i=c==="demo"?"demo":"full",l=String(e||"").trim();if(l.length<2||l.length>24)throw new g(h("server.err.nameLength"));const m=String(o||"");if(m.length<4||m.length>32)throw new g(h("server.err.passcodeLength"));let u;if(i==="demo"){const w=Be(l)||"caretaker",x=M();do u=`${w}-${Math.random().toString(36).slice(2,8)}`;while(await X(x.Player,u))}else{if(u=Be(l),!u)throw new g(h("server.err.nameNeedsAlnum"));if(await X(M().Player,u))throw new g(h("server.err.saveExists"),409)}const p=Ae(Math.round(Number(s)||0),0,60*6e4),d=await nn(u,l,m,Xt(n),ta(r),p,i);let f=[];try{await je(d.player,{freshGrid:!0}),f=await Me(u)}catch(w){console.error("world setup skipped (CreatePlayer):",w)}return{ok:!0,playerId:u,worldId:u,worlds:f,state:await rn(d)}}}class Yn extends R{async post(a){const{name:e,passcode:o}=await O(a),n=Be(String(e||"")),r=n?await M().Player.get(n):null;if(!r)throw new g(h("server.err.noSaveWithName"),404);if(!await gt(r,o))throw new g(h("server.err.passcodeMismatch"),403);const s=M();let c=0;for(const i of[s.Placement,s.Chest,s.BiomeState,s.Discovery,s.NodeState,s.TerrainTile,s.FeedEntry])for(const l of await $(i,n))await i.delete(l.id),c++;for(const i of await _(s.PlayerAchievement,n))await s.PlayerAchievement.delete(i.id),c++;for(const i of await _(s.WorldMember,n))await s.WorldMember.delete(i.id),c++;return await s.World.get(n)&&(await s.World.delete(n),c++),await s.Player.delete(n),{ok:!0,deleted:n,recordsRemoved:c+1}}}class Jn extends R{async post(a){const{playerId:e}=await O(a),o=Be(String(e||"")),n=M(),r=o?await X(n.Player,o):null;if(!r)return{ok:!0,deleted:null};if(r.metrics?.edition!=="demo")throw new g(h("server.err.notDemoSave"),403);let s=0;for(const c of[n.Placement,n.Chest,n.BiomeState,n.Discovery,n.NodeState,n.TerrainTile,n.FeedEntry])for(const i of await $(c,o))await c.delete(i.id),s++;for(const c of await _(n.PlayerAchievement,o))await n.PlayerAchievement.delete(c.id),s++;for(const c of await _(n.WorldMember,o))await n.WorldMember.delete(c.id),s++;return await X(n.World,o)&&(await n.World.delete(o),s++),await n.Player.delete(o),{ok:!0,deleted:o,recordsRemoved:s+1}}}class Kn extends R{async post(a){const{playerId:e}=await O(a),o=Be(String(e||"")),n=M(),r=o?await X(n.Player,o):null;if(!r)throw new g(h("server.err.noSaveWithName"),404);if(r.metrics?.edition!=="demo")throw new g(h("server.err.notDemoSave"),403);const s=F(r),c={...r,metrics:{...r.metrics||{},edition:"full"}};return{ok:!0,...{meta:{playerId:o,name:r.name||"Caretaker",appearance:r.appearance||{},createdAt:r.createdAt||Date.now(),updatedAt:Date.now()},data:{Player:[c],PlayerAchievement:await _(n.PlayerAchievement,o),BiomeState:await $(n.BiomeState,s),Chest:await $(n.Chest,s),Placement:await $(n.Placement,s),Discovery:await $(n.Discovery,s),NodeState:await $(n.NodeState,s),TerrainTile:await $(n.TerrainTile,s),FeedEntry:await $(n.FeedEntry,s),World:await X(n.World,s)?[await X(n.World,s)]:[],WorldMember:await _(n.WorldMember,o),WorldPresence:[],JoinRequest:[]}}}}}class Vn extends R{async post(a){const{playerId:e,currentPasscode:o,newPasscode:n}=await O(a),{player:r}=await H(e);if(!await gt(r,o))throw new g(h("server.err.passcodeMismatch"),403);const s=String(n||"");if(s.length<4||s.length>32)throw new g(h("server.err.newPasscodeLength"));const{salt:c,hash:i}=wt(s);return await M().Player.patch(e,{passcodeHash:i,passcodeSalt:c,passcode:null}),{ok:!0}}}class Xn extends R{async post(a){const{name:e,passcode:o,tzOffsetMinutes:n}=await O(a),r=Be(String(e||"")),s=r?await X(M().Player,r):null;if(!s)throw new g(h("server.err.noSaveTryNew"),404);if(!await gt(s,o))throw new g(h("server.err.passcodeMismatch"),403);const c=await z(),i=Date.now(),l=s.metrics||qe(s.createdAt||i);await M().Player.patch(r,{metrics:{...l,lastHeartbeatAt:0},...n!=null?{tzOffsetMinutes:ta(n)}:{}});let m=s.worldId||r,u=[];try{await je(s),m=(await M().Player.get(r)).worldId||r,await et(r,m),u=await Me(r)}catch(d){console.error("world setup skipped (LoginPlayer):",d)}const p=c.biome.get(s.area);return(s.area==="home"||!p||!p.explorable)&&await M().Player.patch(r,{area:"meadow",x:24.5,y:6.5}),{ok:!0,playerId:r,worldId:m,worlds:u,state:await De(r)}}}class er extends R{async get(){const a=String(this.getId()||"");return await H(a),De(a)}}class tr extends R{async post(a){const{playerId:e}=await O(a),{player:o}=await H(e);return await je(o),{ok:!0,activeWorldId:F(o),worlds:await Me(e)}}}class ar extends R{async post(a){const{playerId:e,name:o}=await O(a),n=M(),{player:r}=await H(e);await je(r);const s=String(o||"").trim()||h("server.world.coopName",{name:r.name});if(s.length>40)throw new g(h("server.err.worldNameLength"));const c=`w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;let i=Pt();const l=await ie(n.World),m=new Set(l.map(f=>f.joinCode).filter(Boolean));let u=0;for(;m.has(i)&&u++<20;)i=Pt();const p=Date.now();await n.World.put({id:c,name:s,solo:!1,ownerId:e,joinCode:i,createdAt:p,maxMembers:ve}),await n.WorldMember.put({id:`${c}:${e}`,worldId:c,playerId:e,role:"owner",joinedAt:p,lastSeenAt:p});const d=await z();for(const f of d.biomes)await n.BiomeState.put({id:`${c}:${f.id}`,worldId:c,playerId:e,biomeId:f.id,health:Se,balance:0,returnedCount:0,unlocked:f.id==="meadow"});return{ok:!0,world:{worldId:c,name:s,joinCode:i,solo:!1,role:"owner",isOwner:!0,memberCount:1,maxMembers:ve},worlds:await Me(e)}}}async function $t(t,a){const e=String(a||"").trim().toUpperCase();return e&&(await ie(t.World)).find(o=>!o.solo&&o.joinCode===e)||null}class nr extends R{async post(a){const{playerId:e,joinCode:o,token:n}=await O(a),r=M(),{player:s}=await H(e);await je(s);const c=await $t(r,o);if(!c)throw new g(h("server.err.noWorldWithCode"),404);const i=`${c.id}:${e}`;if(!await r.WorldMember.get(i)){const u=String(n||"").trim(),p=u?await r.JoinRequest.get(`${c.id}:${u}`):null;if(!p||p.status!=="approved")throw new g(h("server.err.hostNotApproved"),403);const d=c.maxMembers||ve;if((await $(r.WorldMember,c.id)).length>=d)throw new g(h("server.err.worldFullJoined",{max:d}),409);await r.WorldMember.put({id:i,worldId:c.id,playerId:e,role:"member",joinedAt:Date.now(),lastSeenAt:Date.now()}),await r.JoinRequest.delete(`${c.id}:${u}`);const w=Date.now();await r.FeedEntry.put({id:`f_${c.id}_${w}_${Math.random().toString(36).slice(2,7)}`,worldId:c.id,playerId:e,at:w,icon:"user",text:h("server.feed.joinedWorld",{name:s.name})})}await r.Player.patch(e,{worldId:c.id}),await et(e,c.id);let m=await Me(e);if(!m.some(u=>u.worldId===c.id)){const u=await $(r.WorldMember,c.id),p=u.some(d=>d.playerId===e)?u.length:u.length+1;m=[...m,{worldId:c.id,name:c.name,solo:!1,role:c.ownerId===e?"owner":"member",joinCode:c.joinCode,memberCount:p,maxMembers:c.maxMembers||ve,isOwner:c.ownerId===e}]}return{ok:!0,worldId:c.id,worlds:m,state:await De(e,{worldId:c.id})}}}class rr extends R{async post(a){const{joinCode:e}=await O(a),o=M(),n=await $t(o,e);if(!n)return{ok:!0,exists:!1};const r=(await $(o.WorldMember,n.id)).length,s=await o.Player.get(n.ownerId),c=n.maxMembers||ve;return{ok:!0,exists:!0,world:{worldId:n.id,name:n.name,hostName:s?.name||h("server.fallback.host"),memberCount:r,maxMembers:c,full:r>=c}}}}class or extends R{async post(a){const{joinCode:e,token:o,name:n}=await O(a),r=M(),s=await $t(r,e);if(!s)throw new g(h("server.err.noWorldWithCode"),404);const c=String(o||"").trim();if(!c)throw new g(h("server.err.missingToken"));const i=s.maxMembers||ve;if((await $(r.WorldMember,s.id)).length>=i)throw new g(h("server.err.worldFullClosed",{max:i}),409);const m=String(n||"").trim().slice(0,24)||h("server.fallback.newCaretaker");await r.JoinRequest.put({id:`${s.id}:${c}`,worldId:s.id,token:c,name:m,status:"pending",createdAt:Date.now()});const u=await r.Player.get(s.ownerId);return{ok:!0,worldId:s.id,world:{name:s.name,hostName:u?.name||h("server.fallback.host")}}}}class sr extends R{async post(a){const{worldId:e,token:o}=await O(a);return{ok:!0,status:(await M().JoinRequest.get(`${e}:${String(o||"").trim()}`))?.status||"none"}}}class ir extends R{async post(a){const{playerId:e}=await O(a),{player:o}=await H(e),n=M(),r=F(o),s=await n.World.get(r);if(!s||s.solo||s.ownerId!==e)return{ok:!0,requests:[]};const c=(await $(n.JoinRequest,r)).filter(i=>i.status==="pending");return c.sort((i,l)=>(i.createdAt||0)-(l.createdAt||0)),{ok:!0,requests:c.map(i=>({token:i.token,name:i.name,createdAt:i.createdAt}))}}}class cr extends R{async post(a){const{playerId:e,worldId:o,token:n,approve:r}=await O(a);await H(e);const s=M(),c=await s.World.get(o);if(!c||c.solo)throw new g(h("server.err.noCoopWorld"),404);if(c.ownerId!==e)throw new g(h("server.err.onlyHostApproves"),403);const i=`${o}:${String(n||"").trim()}`;if(!await s.JoinRequest.get(i))throw new g(h("server.err.requestNotPending"),404);return await s.JoinRequest.patch(i,{status:r?"approved":"denied",resolvedAt:Date.now()}),{ok:!0}}}class lr extends R{async post(a){const{playerId:e}=await O(a),{player:o}=await H(e),n=M(),r=F(o),s=await n.World.get(r),c=s?.maxMembers||ve;if(!s||s.solo)return{ok:!0,roster:[],closed:!1,maxMembers:c,joinCode:null};const i=await $(n.WorldMember,r),l=[];for(const m of i){const u=await X(n.Player,m.playerId);l.push({playerId:m.playerId,name:u?.name||h("server.fallback.caretaker"),isOwner:m.role==="owner"||s.ownerId===m.playerId,joinedAt:m.joinedAt||0})}return l.sort((m,u)=>(m.joinedAt||0)-(u.joinedAt||0)),{ok:!0,roster:l,closed:l.length>=c,maxMembers:c,joinCode:s.joinCode}}}class dr extends R{async post(a){const{playerId:e,worldId:o}=await O(a),n=M(),{player:r}=await H(e);await je(r);const s=String(o||"");if(!await n.WorldMember.get(`${s}:${e}`))throw new g(h("server.err.notWorldMember"),403);return await n.Player.patch(e,{worldId:s}),await n.WorldMember.patch(`${s}:${e}`,{lastSeenAt:Date.now()}),await et(e,s),{ok:!0,worldId:s,worlds:await Me(e),state:await De(e,{worldId:s})}}}class mr extends R{async post(a){const{playerId:e,worldId:o}=await O(a),n=M(),{player:r}=await H(e),s=String(o||"");if(s===e)throw new g(h("server.err.cannotLeaveSolo"));const c=`${s}:${e}`;if(!await n.WorldMember.get(c))throw new g(h("server.err.notInWorld"),404);await n.WorldMember.delete(c),r.worldId===s&&(await n.Player.patch(e,{worldId:e,area:"meadow",x:24.5,y:6.5}),await et(e,e));const i=r.worldId===s?e:r.worldId||e;return{ok:!0,worldId:i,worlds:await Me(e),state:await De(e,{worldId:i})}}}const Wn=15e3;class ur extends R{async post(a){const{playerId:e,x:o,y:n,area:r}=await O(a),s=M(),{player:c}=await H(e),i=F(c),l=Date.now(),m=Number.isFinite(Number(o))?Number(o):c.x,u=Number.isFinite(Number(n))?Number(n):c.y,p=typeof r=="string"?r:c.area;if((await s.World.get(i))?.solo)return{ok:!0,worldId:i,peers:[]};const w={...(await s.WorldPresence.get(i)||{players:{}}).players||{}};w[e]={playerId:e,name:c.name,appearance:c.appearance,area:p,x:m,y:u,t:l};for(const y of Object.keys(w))l-(w[y]?.t||0)>Wn&&delete w[y];await s.WorldPresence.put({id:i,players:w,updatedAt:l});const x=Object.values(w).filter(y=>y.playerId!==e);return{ok:!0,worldId:i,peers:x}}}class hr extends R{async post(a){const{playerId:e,biomeId:o,nodeId:n,resourceId:r}=await O(a),s=M(),c=await z(),{player:i}=await H(e),l=F(i),m=c.biome.get(o);if(!m)throw new g(h("server.err.unknownBiome",{biome:o}));if(!(i.unlockedBiomes||[]).includes(o))throw new g(h("server.err.biomeLocked",{biome:m.name}),403);const u=c.resource.get(r);if(!u)throw new g(h("server.err.unknownResource",{resource:r}));if(mt(r)){const P=Ht(l,o,Re(i));if(wa(o,P)!==r)throw new g(h("server.err.weatherOnly",{resource:u.name}),409)}else if(!(m.resources||[]).includes(r))throw new g(h("server.err.resourceNotInBiome",{resource:r,biome:m.name}));if(!n||typeof n!="string")throw new g(h("server.err.nodeIdRequired"));const p=`${l}:${o}:${n}`,d=await s.NodeState.get(p),f=Date.now();if(d&&f-d.harvestedAt<tt*1e3)throw new g(h("server.err.regrowing"),409);const w=we(i),x=he(i.inventory);if(x>=w)throw new g(h("server.err.basketFullStore"),409);const y=i.tools?.[u.tool]||1,v=Math.min(Math.max(1,y),w-x),I=ft(i),A=I?.id==="forage"&&w-x-v>0&&Math.random()<I.strength?1:0,T=v+A,j={...i.inventory||{}};return j[r]=(j[r]||0)+T,await s.Player.patch(e,{inventory:j}),await s.NodeState.put({id:p,worldId:l,playerId:e,harvestedAt:f}),await J(i,{resourcesCollected:T},{[`res:${r}`]:T}),await le(e),{ok:!0,gained:{[r]:T},perkBonus:A||void 0,inventory:j,nodeId:n,harvestedAt:f}}}class fr extends R{async post(a){const{playerId:e,chestId:o,resourceId:n,qty:r,direction:s}=await O(a),c=M(),i=await z(),{player:l}=await H(e),m=F(l),u=_t(r,"qty"),p=await ca(c,i,o,m);if(!p)throw new g(h("server.err.chestNotFound"),404);const d={...l.inventory||{}},f={...p.contents||{}};if(s==="deposit"){if((d[n]||0)<u)throw new g(h("server.err.notEnoughInBasket",{resource:n}));if(he(f)+u>p.capacity)throw new g(h("server.err.chestFull"),409);d[n]-=u,d[n]<=0&&delete d[n],f[n]=(f[n]||0)+u}else if(s==="withdraw"){if((f[n]||0)<u)throw new g(h("server.err.notEnoughInChest",{resource:n}));if(he(d)+u>we(l))throw new g(h("server.err.basketFull"),409);f[n]-=u,f[n]<=0&&delete f[n],d[n]=(d[n]||0)+u}else throw new g(h("server.err.badDirection"));return await c.Player.patch(e,{inventory:d}),await c.Chest.patch(o,{contents:f}),await J(l,s==="deposit"?{chestDeposits:1}:{chestWithdrawals:1}),{ok:!0,inventory:d,chest:{...p,contents:f}}}}class pr extends R{async post(a){const{playerId:e,kind:o,id:n,qty:r}=await O(a),s=M(),{player:c}=await H(e),i=_t(r,"qty");if(!n||typeof n!="string")throw new g(h("server.err.idRequired"));if(o==="crafted"){const m={...c.craftedItems||{}};if((m[n]||0)<i)throw new g(h("server.err.discardTooMany"));return m[n]-=i,m[n]<=0&&delete m[n],await s.Player.patch(e,{craftedItems:m}),await J(c,{itemsDiscarded:i}),{ok:!0,craftedItems:m}}const l={...c.inventory||{}};if((l[n]||0)<i)throw new g(h("server.err.discardTooMany"));return l[n]-=i,l[n]<=0&&delete l[n],await s.Player.patch(e,{inventory:l}),await J(c,{itemsDiscarded:i}),{ok:!0,inventory:l}}}class wr extends R{async post(a){const{playerId:e,recipeId:o}=await O(a),n=M(),r=await z(),{player:s}=await H(e),c=F(s),i=r.recipe.get(o);if(!i)throw new g(h("server.err.unknownRecipe",{recipe:o}));const l=r.object.get(i.output.itemId);if(l?.plantable)throw new g(h("server.err.plantedNotCrafted",{name:i.name}),400);if(!s.devUnlockAll&&l?.homeMin&&(ce(s).space||1)<l.homeMin)throw new g(h("server.err.needsProperHouse",{name:i.name}),403);const m=!!s.devUnlockAll;if(!m&&i.unlockBiome&&!(s.unlockedBiomes||[]).includes(i.unlockBiome))throw new g(h("server.err.recipeBiomeLocked"),403);if(!m&&i.unlock&&i.unlockBiome){const I=await bn(c,i.unlockBiome,s,r);if(!yn(i,I))throw new g(h("server.err.recipeLocked",{label:i.unlock.label}),403)}if(i.requiresTool&&(s.tools?.[i.requiresTool.id]||1)<i.requiresTool.tier){const I=r.tool.get(i.requiresTool.id);throw new g(h("server.err.requiresUpgradedTool",{tool:I?.name||i.requiresTool.id}),403)}if(i.once&&(s.craftedEver?.[i.output.itemId]||0)>0)throw new g(h("server.err.craftOnce",{name:i.name}),409);const{usedFrom:u,inventory:p}=await ze(s,i.materials||{},c),d=ft(s);let f;if(d?.id==="thrift"&&Object.keys(i.materials||{}).length&&Math.random()<d.strength){let I=we(s)-he(p);for(const[A,T]of Object.entries(i.materials||{})){const j=Math.min(Math.max(1,Math.floor(T/2)),Math.max(0,I));j>0&&(f=f||{},f[A]=j,p[A]=(p[A]||0)+j,I-=j)}}const w={...s.craftedItems||{}},x={...s.craftedEver||{}};w[i.output.itemId]=(w[i.output.itemId]||0)+(i.output.qty||1),x[i.output.itemId]=(x[i.output.itemId]||0)+(i.output.qty||1),await n.Player.patch(e,f?{craftedItems:w,craftedEver:x,inventory:p}:{craftedItems:w,craftedEver:x});const y=await xt(c,e,{player:{...s,craftedItems:w,craftedEver:x}}),v=await $(n.Chest,c);return await J(s,{itemsCrafted:1},{craft:1}),await le(e),{ok:!0,crafted:i.output,craftedItems:w,inventory:p,chests:v,usedFrom:u,refund:f,unlockedBiomes:y}}}function ua(t){const a=Number(t);return Number.isFinite(a)?(Math.round(a/90)*90%360+360)%360:0}const Hn=new Set(["wooden-fence","dry-stone-wall","wooden-bench","hammock","picnic-blanket","garden-arch","trail-signpost","flower-cart","home-bed","home-sleeping-bag","home-bookshelf","home-armchair","home-fireplace","home-table","home-dresser","home-driftwoodshelf","home-mushroomshelf","home-reedmat","home-peltrug","home-rug","home-cushions","home-stool","home-aquarium","home-telescope"]);function Tt(t){return t?t.rotatable===!0||t.bridge||/-path$/.test(t.id)?!0:Hn.has(t.id):!1}class gr extends R{async post(a){const{playerId:e,objectId:o,area:n,x:r,y:s,rotation:c}=await O(a),i=M(),l=await z(),{player:m}=await H(e),u=F(m),p=l.object.get(o);if(!p)throw new g(h("server.err.unknownObject",{object:o}));if(p.placement==="none")throw new g(h("server.err.kitNotPlaceable",{name:p.name}));if((m.craftedItems?.[o]||0)<=0)throw new g(h("server.err.noneCrafted",{name:p.name}));const d=Math.round(Number(r)),f=Math.round(Number(s)),w=Fe(l,n);if(!Number.isFinite(d)||!Number.isFinite(f)||d<1||f<1||d>w.cols-2||f>w.rows-2)throw new g(h("server.err.outOfReach"));const x=Le(n);if(n==="home"){if(p.placement==="outdoor")throw new g(h("server.err.outdoorOnly",{name:p.name}));if(p.homeMin&&(ce(m).space||1)<p.homeMin)throw new g(h("server.err.needsBiggerHome",{name:p.name}),403);const D=Fa(m);if(d<D.x0||d>D.x1||f<D.y0||f>D.y1)throw new g(h("server.err.placeOnFloor"))}else if(x){const D=l.biome.get(x);if(!D)throw new g(h("server.err.unknownArea",{area:n}));if(!(m.unlockedBiomes||[]).includes(x))throw new g(h("server.err.biomeLocked",{biome:D.name}),403);if(p.placement==="outdoor")throw new g(h("server.err.outdoorOnly",{name:p.name}));if(p.homeMin&&p.homeMin>1)throw new g(h("server.err.tentTooSmall",{name:p.name}),403);const W=za();if(d<W.x0||d>W.x1||f<W.y0||f>W.y1)throw new g(h("server.err.placeOnFloor"))}else{const D=l.biome.get(n);if(!D)throw new g(h("server.err.unknownArea",{area:n}));if(!(m.unlockedBiomes||[]).includes(n))throw new g(h("server.err.biomeLocked",{biome:D.name}),403);if(p.placement==="indoor")throw new g(h("server.err.indoorOnly",{name:p.name}));if(!(p.biomes||[]).includes(n))throw new g(h("server.err.wrongHabitat",{name:p.name,biome:D.name}));if(D.oceanCols&&d>=w.cols-D.oceanCols)throw new g(h("server.err.openOcean"),409)}if(p.requiresTool&&(m.tools?.[p.requiresTool.id]||1)<p.requiresTool.tier)throw new g(h("server.err.placeRequiresTool",{name:p.name,tool:l.tool.get(p.requiresTool.id)?.name||p.requiresTool.id}),403);const y=await $(i.Placement,u);if(y.some(D=>D.area===n&&D.x===d&&D.y===f))throw new g(h("server.err.spotTaken"),409);if(p.onePerArea&&y.some(D=>D.area===n&&D.objectId===o))throw new g(h("server.err.onePerArea",{name:p.name}),409);const v=n==="home"||!!x,I=v?null:await Xe(i.TerrainTile,u,n,d,f);if(I)if(I.type==="water"){if(!p.bridge)throw new g(h("server.err.openWaterBridge"),409)}else throw new g(h("server.err.bedForPlanting"),409);else if(p.bridge&&!v)throw new g(h("server.err.bridgeNeedsWater"),409);const A={...m.craftedItems||{}};A[o]-=1,A[o]<=0&&delete A[o],await i.Player.patch(e,{craftedItems:A});const T=`pl_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,j={id:T,worldId:u,playerId:e,objectId:o,area:n,x:d,y:f,placedAt:Date.now(),rotation:Tt(p)?ua(c):0};if(await i.Placement.put(j),p.isChest&&await i.Chest.put({id:T,worldId:u,playerId:e,area:n,x:d,y:f,size:o,capacity:p.chestCapacity||60,contents:{}}),v)return await J(m,{objectsPlaced:1},{place:1}),await le(e),{ok:!0,placement:j,craftedItems:A};const P=await re(u,e,n,{addPlacements:[j],player:{...m,craftedItems:A}});return await J(m,{objectsPlaced:1,animalsReturned:P.newAnimals?.length||0},{place:1}),await Oe(u,e,{addDiscoveries:P.newAnimals,freshBiomeStates:[P.biomeState]}),{ok:!0,placement:j,craftedItems:A,...P}}}class yr extends R{async post(a){const{playerId:e,area:o,x:n,y:r,plantId:s}=await O(a),c=M(),i=await z(),{player:l}=await H(e),m=F(l),u=i.biome.get(o);if(!u)throw new g(h("server.err.unknownArea",{area:o}));if(!(l.unlockedBiomes||[]).includes(o))throw new g(h("server.err.biomeLocked",{biome:u.name}),403);const p=i.object.get(s);if(!p||!p.plantable)throw new g(h("server.err.notPlantable"));if(!(p.biomes||[]).includes(o))throw new g(h("server.err.wouldNotTakeRoot",{name:p.name,biome:u.name}));const d=Math.round(Number(n)),f=Math.round(Number(r)),w=await Xe(c.TerrainTile,m,o,d,f);if(!w||w.type!=="watered")throw new g(h("server.err.plantIntoWatered"));const{usedFrom:x,inventory:y}=await ze(l,p.plantCost||{},m);await c.TerrainTile.delete(w.id);const v=ft(l),I=v?.id==="growth"?v.strength:0,A=Date.now(),j={id:`pl_${A}_${Math.random().toString(36).slice(2,8)}`,worldId:m,playerId:e,objectId:s,area:o,x:d,y:f,placedAt:A-Math.round(kt(p)*I),plantedAt:A-Math.round((p.growSeconds||0)*1e3*I)};await c.Placement.put(j);const P=await re(m,e,o,{addPlacements:[j],removeTerrainIds:[w.id],player:{...l,inventory:y}});return await J(l,{plantsPlanted:1,animalsReturned:P.newAnimals?.length||0},{plant:1}),await Oe(m,e,{addDiscoveries:P.newAnimals,freshBiomeStates:[P.biomeState]}),{ok:!0,placement:j,inventory:y,usedFrom:x,perkGrowth:I||void 0,...P}}}function Nn(t,a){const e=t?.yield;if(!e||!t?.plantable||!a?.plantedAt)return null;const o=(t.growSeconds||0)*1e3,n=(e.regrowSeconds||60)*1e3;return a.lastHarvestAt?a.lastHarvestAt+n:a.plantedAt+o}class br extends R{async post(a){const{playerId:e,placementId:o}=await O(a),n=M(),r=await z(),{player:s}=await H(e),c=F(s),i=Date.now(),l=(await $(n.Placement,c)).find(y=>y.id===o);if(!l)throw new g(h("server.err.placementNotFound"),404);const m=r.object.get(l.objectId),u=m?.yield;if(!u)throw new g(h("server.err.notHarvestable"));const p=Nn(m,l);if(p==null||i<p)throw new g(h("server.err.notReadyYet"));const d=we(s),f={...s.inventory||{}},w=Math.max(0,d-he(f)),x=Math.min(u.qty||1,w);if(x<=0)throw new g(h("server.err.basketFullHarvest"),409);return f[u.resourceId]=(f[u.resourceId]||0)+x,await n.Player.patch(e,{inventory:f}),await n.Placement.patch(o,{lastHarvestAt:i}),await J(s,{resourcesCollected:x}),{ok:!0,placementId:o,gained:{[u.resourceId]:x},inventory:f,placement:{...l,lastHarvestAt:i}}}}class vr extends R{async post(a){const{playerId:e,appearance:o}=await O(a),{player:n}=await H(e),r=Xt(o);return await M().Player.patch(e,{appearance:r}),await J(n,{appearanceChanges:1}),{ok:!0,appearance:r}}}class kr extends R{async post(a){const{playerId:e,placementId:o,x:n,y:r,rotation:s}=await O(a),c=M(),{player:i}=await H(e),l=F(i),m=await $(c.Placement,l),u=m.find(T=>T.id===o);if(!u)throw new g(h("server.err.placementNotFound"),404);if(u.objectId==="workbench")throw new g(h("server.err.workbenchStays"));const p=await z(),d=Fe(p,u.area),f=Math.round(Number(n)),w=Math.round(Number(r));if(!Number.isFinite(f)||!Number.isFinite(w)||f<1||w<1||f>d.cols-2||w>d.rows-2)throw new g(h("server.err.outOfReach"));if(m.some(T=>T.id!==o&&T.area===u.area&&T.x===f&&T.y===w))throw new g(h("server.err.spotTaken"),409);const x=await z(),y=x.object.get(u.objectId),v=await Xe(c.TerrainTile,l,u.area,f,w);if(v)if(v.type==="water"){if(!y?.bridge)throw new g(h("server.err.openWaterBridgeOnly"),409)}else throw new g(h("server.err.bedForPlantingShort"),409);else if(y?.bridge)throw new g(h("server.err.bridgesOverWater"),409);const I={x:f,y:w};return s!==void 0&&Tt(y)&&(I.rotation=ua(s)),await c.Placement.patch(o,I),await ca(c,x,o,l)&&await c.Chest.patch(o,{x:f,y:w}),await J(i,{objectsMoved:1}),{ok:!0,placement:{...u,...I}}}}class xr extends R{async post(a){const{playerId:e,placementId:o}=await O(a),n=M(),{player:r}=await H(e),s=F(r),c=await He(n.Placement,s,o);if(!c)throw new g(h("server.err.placementNotFound"),404);if(c.objectId==="workbench")throw new g(h("server.err.workbenchStays"));const i=await He(n.Chest,s,o);if(i&&he(i.contents)>0)throw new g(h("server.err.emptyChestFirst"),409);if(c.objectId==="trail-tent"){const x=`tent-${c.area}`;if((await $(n.Placement,s)).some(v=>v.area===x))throw new g(h("server.err.tentNotEmpty"),409)}const m=(await z()).object.get(c.objectId);let u=null;const p={...r.craftedItems||{}},d={...r.inventory||{}},f=new Map;if(m?.plantable&&c.plantedAt&&Object.keys(m.plantCost||{}).length){u={...m.plantCost};const x=we(r);let y=he(d);const v=(await $(n.Chest,s)).filter(I=>I.id!==o);for(const[I,A]of Object.entries(u)){let T=A;const j=Math.min(T,Math.max(0,x-y));j>0&&(d[I]=(d[I]||0)+j,y+=j,T-=j);for(const P of v){if(T<=0)break;const D=f.get(P.id)||{...P.contents||{}},W=P.capacity-he(D),q=Math.min(W,T);q>0&&(D[I]=(D[I]||0)+q,f.set(P.id,D),T-=q)}if(T>0)throw new g(h("server.err.noRoomRefund"),409)}}else p[c.objectId]=(p[c.objectId]||0)+1;if(i&&await n.Chest.delete(o),await n.Placement.delete(o),u){await n.Player.patch(e,{inventory:d});for(const[x,y]of f)await n.Chest.patch(x,{contents:y})}else await n.Player.patch(e,{craftedItems:p});const w=c.area!=="home"&&!Le(c.area)?await re(s,e,c.area,{removeIds:[o],player:{...r,craftedItems:p,inventory:d}}):null;return await J(r,{objectsRemoved:1,animalsReturned:w?.newAnimals?.length||0}),await Oe(s,e,w?{addDiscoveries:w.newAnimals,freshBiomeStates:[w.biomeState]}:{}),{ok:!0,removed:o,craftedItems:p,refunded:u,...w||{}}}}class Sr extends R{async post(a){const{playerId:e,toolId:o}=await O(a),n=M(),r=await z(),{player:s}=await H(e),c=r.tool.get(o);if(!c)throw new g(h("server.err.unknownTool",{tool:o}));const i=F(s),l=s.tools?.[o]||1,m=(c.tiers||[]).find(x=>x.tier===l+1);if(!m)throw new g(h("server.err.toolMaxed",{tool:c.name}));if(m.requires?.biome&&((await be(n.BiomeState,i,m.requires.biome))?.health||0)<(m.requires.minHealth||0)){const y=r.biome.get(m.requires.biome);throw new g(h("server.err.restoreFirst",{biome:y?.name||m.requires.biome,health:m.requires.minHealth}),403)}const{usedFrom:u,inventory:p}=await ze(s,m.materials||{},i),d={...s.tools||{},[o]:m.tier};await n.Player.patch(e,{tools:d});const f=await xt(i,e,{player:{...s,tools:d}}),w=await $(n.Chest,i);return await J(s,{toolsUpgraded:1}),await le(e),{ok:!0,tools:d,inventory:p,chests:w,usedFrom:u,unlockedBiomes:f,upgraded:{toolId:o,tier:m.tier,name:m.name}}}}class Ar extends R{async post(a){const{playerId:e,track:o}=await O(a),n=M(),{player:r}=await H(e),s=F(r),c=ye[o];if(!c)throw new g(h("server.err.unknownHomeUpgrade"));const i=ce(r);if(!i.styleLocked)throw new g(h("server.err.buildStyleFirst"),403);const l=i[o]||1,m=c.levels[l];if(!m)throw new g(h("server.err.trackMaxed",{track:c.name.toLowerCase()}));if(m.requires?.biome&&((await be(n.BiomeState,s,m.requires.biome))?.health||0)<(m.requires.minHealth||0)){const y=(await z()).biome.get(m.requires.biome);throw new g(h("server.err.restoreFirst",{biome:y?.name||m.requires.biome,health:m.requires.minHealth}),403)}const{usedFrom:u,inventory:p}=await ze(r,m.materials||{},s),d={...i,[o]:l+1};await n.Player.patch(e,{home:d});const f=await $(n.Chest,s);return await le(e),await J(r,{homeUpgrades:1}),{ok:!0,home:d,inventory:p,chests:f,usedFrom:u,upgraded:{track:o,level:l+1,name:c.name}}}}const Ln=["home-sleeping-bag","home-bed"];class Mr extends R{async post(a){const{playerId:e}=await O(a),o=M(),{player:n}=await H(e),r=F(n);if(!(await $(o.Placement,r)).some(m=>Ln.includes(m.objectId)))throw new g(h("server.err.needBedToRest"),403);const c=await $(o.NodeState,r);for(const m of c)await o.NodeState.delete(m.id);const i=Re(n),l=ba(i)-i;return await o.Player.patch(e,{clockOffsetMs:(n.clockOffsetMs||0)+l}),await J(n,{restsTaken:1}),{ok:!0,rested:!0,refreshed:c.length}}}const ha=t=>typeof t=="string"&&/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(t.trim());class Ir extends R{async post(a){const{playerId:e,colors:o}=await O(a),n=M(),{player:r}=await H(e),s=ce(r);if(!s.styleLocked)throw new g(h("server.err.buildBeforeRepaint"),403);const c={...s.colors};for(const i of["floor","wall","accent","rug"])o?.[i]&&ha(o[i])&&(c[i]=String(o[i]).trim().toLowerCase());return await n.Player.patch(e,{home:{...s,colors:c}}),await J(r,{recolors:1}),{ok:!0}}}class $r extends R{async post(a){const{playerId:e,placementId:o,color:n}=await O(a),r=M(),{player:s}=await H(e);if(!ce(s).styleLocked)throw new g(h("server.err.buildBeforeRepaintThings"),403);if(!ha(n))throw new g(h("server.err.invalidColor"));if(!await He(r.Placement,F(s),o))throw new g(h("server.err.itemNotHere"),404);return await r.Placement.patch(o,{color:String(n).trim().toLowerCase()}),await J(s,{recolors:1}),{ok:!0}}}class Tr extends R{async post(a){const{playerId:e,style:o}=await O(a),n=M(),{player:r}=await H(e),s=fe[o];if(!s)throw new g(h("server.err.unknownHomeStyle"));const c=ce(r);if(c.styleLocked)throw new g(h("server.err.homeAlreadyBuilt"),403);const i=F(r);if(s.requires?.biome&&((await be(n.BiomeState,i,s.requires.biome))?.health||0)<(s.requires.minHealth||0)){const w=(await z()).biome.get(s.requires.biome);throw new g(h("server.err.restoreFirst",{biome:w?.name||s.requires.biome,health:s.requires.minHealth}),403)}const{usedFrom:l,inventory:m}=await ze(r,s.materials||{},i),u={...c,style:o,styleLocked:!0,space:2};await n.Player.patch(e,{home:u});const p=await $(n.Chest,i);return await le(e),await J(r,{homesBuilt:1}),{ok:!0,home:u,inventory:m,chests:p,usedFrom:l,built:fe[o].name}}}class Pr extends R{async post(a){const{playerId:e,animalId:o}=await O(a),n=M(),r=await z(),{player:s}=await H(e),c=F(s),i=await Ha(n.Discovery,c,o);if(!i)throw new g(h("server.err.animalNotReturned"),404);const l=yt(s,Date.now()),m=i.lastObservedDayKey!==l,u=(i.timesObserved||0)+1;return await n.Discovery.patch(i.id,{timesObserved:u,lastObservedDayKey:l}),await J(s,{animalsObserved:1},m?{observe:1}:{}),await le(e),{ok:!0,discovery:{...i,timesObserved:u},animal:r.animal.get(o)}}}class Cr extends R{async post(a){const{playerId:e,taskId:o}=await O(a),n=M(),r=await z(),{player:s}=await H(e),c=F(s),i=Date.now(),[l,m,u,p]=await Promise.all([$(n.Discovery,c),$(n.BiomeState,c),$(n.Placement,c),$(n.Chest,c)]),d=It({player:s,d:r,discoveries:l,biomeStates:m,placements:u,chests:p,now:i,unlockedBiomes:s.unlockedBiomes}),f=d.tasks.find(P=>P.id===String(o||""));if(!f)throw new g(h("server.err.taskNotOnBoard"),404);if(f.pinned)throw new g(h("server.err.taskNotClaimable"),409);if(f.claimed)throw new g(h("server.err.taskAlreadyClaimed"),409);if(f.progress<f.target)throw new g(h("server.err.taskNotFinished"),409);const w=we(s),x={...s.inventory||{}};let y=Math.max(0,w-he(x));const v={};for(const[P,D]of Object.entries(f.reward||{})){const W=Math.min(D,y);W<=0||(x[P]=(x[P]||0)+W,v[P]=W,y-=W)}if(!Object.keys(v).length)throw new g(h("server.err.basketFullReward"),409);const I=String(f.id).startsWith("start-"),A=String(f.id).startsWith("unlock-reward:"),T={inventory:x};if(A){const P=String(f.id).slice(14);T.pendingUnlockRewards=(s.pendingUnlockRewards||[]).filter(D=>D!==P)}else I?T.goalClaims={...s.goalClaims||{},[f.id]:!0}:T.customGoals=(s.customGoals||[]).filter(P=>P.id!==f.id);await n.Player.patch(e,T),await J(s,{tasksCompleted:1}),await le(e);const j={...d,tasks:d.tasks.map(P=>P.id===f.id?{...P,claimed:!0}:P)};return{ok:!0,taskId:f.id,text:f.text,gained:v,inventory:x,dailyTasks:j}}}class Br extends R{async post(a){const{playerId:e,goals:o}=await O(a),{player:n}=await H(e),r=M(),s=await z(),c=F(n),[i,l,m,u]=await Promise.all([$(r.Discovery,c),$(r.BiomeState,c),$(r.Placement,c),$(r.Chest,c)]),p={player:n,discoveries:i,placements:m,chests:u,unlockedBiomes:n.unlockedBiomes},d=new Map((n.customGoals||[]).map(y=>[y.id,y])),f=St(n,s),w=jn(o,s),x=[];for(const y of w){const v=d.get(y.id);if(!v&&x.length>=f)continue;if(x.length>=la)break;const I=v&&typeof v.base=="number"?v.base:ma(y,p),A={...y,base:I};y.kind==="build"&&(A.basePlace=v&&typeof v.basePlace=="number"?v.basePlace:da(p,y.itemId||"")),x.push(A)}return await r.Player.patch(e,{customGoals:x}),{ok:!0,customGoals:x,goalLimit:f}}}class Rr extends R{async post(a){const{playerId:e,area:o,x:n,y:r,action:s}=await O(a),c=M(),i=await z(),{player:l}=await H(e),m=F(l),u=i.biome.get(o);if(!u)throw new g(h("server.err.terraformOutdoors"));if(!(l.unlockedBiomes||[]).includes(o))throw new g(h("server.err.biomeLocked",{biome:u.name}),403);const p=Math.round(Number(n)),d=Math.round(Number(r)),f=Fe(i,o);if(!Number.isFinite(p)||!Number.isFinite(d)||p<1||d<1||p>f.cols-2||d>f.rows-2)throw new g(h("server.err.outOfReach"));if((await $(c.Placement,m)).some(P=>P.area===o&&P.x===p&&P.y===d))throw new g(h("server.err.somethingPlaced"));const x=`${m}:${o}:${p}:${d}`,y=await Xe(c.TerrainTile,m,o,p,d);let v=l.inventory||{},I=null,A,T=null;if(s==="dig"){if((l.tools?.shovel||0)<1)throw new g(h("server.err.needShovel"));if(y)throw new g(h("server.err.alreadyPrepared"));I={id:x,worldId:m,playerId:e,area:o,x:p,y:d,type:"tilled",updatedAt:Date.now()},await c.TerrainTile.put(I);const P=u.digResources||[];if(P.length&&Math.random()<_a){const D=P[Math.floor(Math.random()*P.length)],W=Math.max(0,we(l)-he(v)),q=Math.min(l.tools?.shovel||1,W);q>0&&(v={...v,[D]:(v[D]||0)+q},await c.Player.patch(e,{inventory:v}),T={resourceId:D,amount:q})}}else if(s==="water"){if((l.tools?.["watering-can"]||0)<1)throw new g(h("server.err.needWateringCan"));if(!y)throw new g(h("server.err.prepareBedFirst"));if(y.type==="water")throw new g(h("server.err.alreadyOpenWater"));const P=1,D=y.type==="tilled"?"watered":"water";if(D==="water"&&u.canFlood===!1)throw new g(h("server.err.tooDryToFlood",{biome:u.name}));if((v.water||0)+(v["clean-water"]||0)<P)throw new g(h("server.err.needWater",{count:P}));v={...v};let q=P;for(const N of["water","clean-water"]){const G=Math.min(v[N]||0,q);G>0&&(v[N]-=G,v[N]<=0&&delete v[N],q-=G)}await c.Player.patch(e,{inventory:v}),I={...y,type:D,updatedAt:Date.now()},await c.TerrainTile.patch(y.id,{type:D,updatedAt:Date.now()})}else if(s==="clear"){if(!y)throw new g(h("server.err.nothingToClear"));await c.TerrainTile.delete(y.id),A=y.id}else throw new g(h("server.err.badTerraformAction"));const j=await re(m,e,o,{addTerrain:I?[I]:[],removeTerrainIds:A?[A]:[],player:{...l,inventory:v}});return await J(l,{terraformActions:1,animalsReturned:j.newAnimals?.length||0},s==="water"?{water:1}:{}),await Oe(m,e,{addDiscoveries:j.newAnimals,freshBiomeStates:[j.biomeState]}),{ok:!0,tile:I,removedId:A,dug:T,inventory:v,...j}}}class jr extends R{async post(a){const{playerId:e,biomeId:o}=await O(a),{player:n}=await H(e),r=await re(F(n),e,o);return await Oe(F(n),e,{addDiscoveries:r.newAnimals,freshBiomeStates:[r.biomeState]}),{ok:!0,...r}}}class Dr extends R{async post(a){const{playerId:e,x:o,y:n,area:r,tutorialStep:s}=await O(a),c=M(),i=await z(),{player:l}=await H(e),m={};if(Number.isFinite(Number(o))&&(m.x=Number(o)),Number.isFinite(Number(n))&&(m.y=Number(n)),Number.isInteger(s)&&s>=0&&s<=99&&(m.tutorialStep=s,m.tutorialMaxStep=Math.max(l.tutorialMaxStep??0,l.tutorialStep??0,s)),r==="home")m.area="home";else if(Le(r)){const u=Le(r),p=i.biome.get(u);if(!p)throw new g(h("server.err.unknownArea",{area:r}));if(!(l.unlockedBiomes||[]).includes(u))throw new g(h("server.err.biomeLocked",{biome:p.name}),403);const d=F(l);if(!(await $(c.Placement,d)).some(w=>w.area===u&&w.objectId==="trail-tent"))throw new g(h("server.err.noTentHere"),404);m.area=r}else if(r){const u=i.biome.get(r);if(!u)throw new g(h("server.err.unknownArea",{area:r}));if(!(l.unlockedBiomes||[]).includes(r))throw new g(h("server.err.biomeLocked",{biome:u.name}),403);if(!u.explorable)throw new g(h("server.err.notExplorable",{biome:u.name}),403);m.area=r;const p=l.visitedBiomes||["meadow"];if(p.includes(r)||(m.visitedBiomes=[...p,r]),ia[r]){const d=F(l);(await $(c.TerrainTile,d)).some(w=>w.area===r)||(await We(d,e,r),await re(d,e,r,{player:l}))}}return await c.Player.patch(e,m),m.tutorialStep!==void 0&&await le(e),{ok:!0,player:pt(await c.Player.get(e))}}}class Or extends R{async post(a){const{playerId:e,entries:o}=await O(a),{player:n}=await H(e),r=F(n),s=M(),c=Array.isArray(o)?o.slice(0,Ze):[];let i=0;for(const m of c){const u=String(m?.text||"").slice(0,500).trim();if(!u)continue;const p=Number(m?.at)||Date.now(),d=String(m?.icon||"leaf").slice(0,40),f=`f_${r}_${p}_${Math.random().toString(36).slice(2,9)}`;await s.FeedEntry.put({id:f,worldId:r,playerId:e,at:p,icon:d,text:u}),i++}const l=(await $(s.FeedEntry,r)).sort((m,u)=>(m.at||0)-(u.at||0));if(l.length>Ze)for(const m of l.slice(0,l.length-Ze))await s.FeedEntry.delete(m.id);return{ok:!0,added:i}}}const qn=30*60*1e3,Fn=90*1e3;class Er extends R{async post(a){const{playerId:e,language:o,edition:n}=await O(a),r=M(),s=await z(),{player:c}=await H(e),i=Date.now(),l=c.metrics||qe(c.createdAt||i),m=typeof o=="string"&&o.trim()?o.trim().toLowerCase().slice(0,12):null,u=n==="demo"?"demo":n==="full"?"full":null,p=l.lastHeartbeatAt||0,d=i-p;let f=l.playSeconds||0,w=l.sessions||0,x=l.curSessionSeconds||0;const y={...l.areaSeconds||{}},v={...l.sessionLengths||{}},I=p===0||d>qn;if(I){if(x>0){const W=Ya(x);v[W]=(v[W]||0)+1}x=0,w+=1}else{const W=Math.min(d,Fn)/1e3;f+=W,x+=W;const q=c.area||"unknown";y[q]=Y((y[q]||0)+W)}const A={...l,firstSeenAt:l.firstSeenAt||c.createdAt||i,lastSeenAt:i,lastHeartbeatAt:i,playSeconds:Math.round(f),sessions:w,curSessionSeconds:Math.round(x),areaSeconds:y,sessionLengths:v,...m?{language:m}:{},...u?{edition:l.edition==="demo"?"demo":u}:{}};await r.Player.patch(e,{metrics:A});const T=F(c);let j=null;const P=[],D=[];try{const W=l.lastSeenAt||0,q=I&&W>0&&i-W>10*6e4,N=await $(r.Placement,T),G=p>0?p:i,te=new Set;for(const L of N){const V=s.object.get(L.objectId);jt(V,L,q?W:G,i)&&te.add(L.area)}const oe=await $(r.BiomeState,T),K=new Set(oe.filter(L=>L.unlocked).map(L=>L.biomeId)),ee=q?[...K]:[...te].filter(L=>K.has(L));let C=0;for(const L of ee){const V=oe.find(Ie=>Ie.biomeId===L)?.health||0,se=await re(T,e,L,{player:c});C+=Math.max(0,(se.biomeState?.health||0)-V),P.push(...se.newAnimals||[]),D.push(se.biomeState)}if((P.length||D.length)&&await Oe(T,e,{addDiscoveries:P,freshBiomeStates:D}),q){const L=N.filter(V=>{const se=s.object.get(V.objectId);return K.has(V.area)&&jt(se,V,W,i)}).length;(L>0||P.length>0||C>0)&&(j={awayHours:Math.round((i-W)/36e5*10)/10,matured:L,healthGain:C,arrivals:P.map(V=>V.animal?.name).filter(Boolean)})}}catch(W){console.error("heartbeat growth pass skipped:",W)}return await le(e),{ok:!0,metrics:aa({...c,metrics:A}),...P.length?{newAnimals:P}:{},...D.length?{biomeStates:D}:{},...j?{welcomeBack:j}:{}}}}let Ce=null;const zn=3e4;class Wr extends R{async get(a){const e=M(),o=String(this.getId?.()||a?.id||"").trim();if(o){const b=await e.Player.get(o);if(!b)throw new g(h("server.err.noSaveWithId"),404);const k=await tn(o),B=aa(b);return{player:{...B,biomeSummary:k.summary,activation:Va(B,k.summary,b),achievements:await En(o),biomes:k.biomes}}}const n=Date.now();let r;if(Ce&&n-Ce.at<zn)r=Ce.all;else{let b=[];try{b=await ie(e.SoloMetrics)}catch{}r=b.map(k=>{let B={};if(k.snapshot)try{B=typeof k.snapshot=="string"?JSON.parse(k.snapshot):k.snapshot}catch{B={}}const Z=B.lastSeenAt||k.updatedAt||null,ke=B.createdAt||k.createdAt||n,Qe=Z?Y((n-Z)/36e5):null;let rt="dormant";return Qe!=null&&(Qe<=24?rt="active":Qe<=24*7&&(rt="recent")),{...B,playerId:k.id,name:k.name||B.name||null,solo:!0,platform:k.platform||null,os:k.os||null,language:k.language||B.language||null,version:k.version||null,build:k.build||null,lastSyncedAt:k.updatedAt||null,counts:B.counts||{},playSeconds:B.playSeconds||0,sessions:B.sessions||0,totalActions:B.totalActions||0,currentArea:B.currentArea||null,unlockedBiomes:B.unlockedBiomes||0,tutorialStep:B.tutorialStep||0,activation:B.activation||{},achievements:B.achievements||null,biomeSummary:B.biomeSummary||{biomesUnlocked:0,avgHealth:0,biomesFullyRestored:0,totalAnimalsReturned:0},areaSeconds:B.areaSeconds||{},sessionLengths:B.sessionLengths||{},creationMs:B.creationMs||0,creationSeconds:B.creationSeconds??(B.creationMs?Y(B.creationMs/1e3):null),timeToFirstActionSeconds:B.timeToFirstActionSeconds??null,appearance:B.appearance||null,createdAt:ke,lastSeenAt:Z,hoursSinceActive:Qe,minutesSinceActive:Z?Y((n-Z)/6e4):null,status:rt,daysSinceJoined:Math.floor((n-ke)/xe),isNewToday:n-ke<=xe}}).sort((k,B)=>(B.lastSeenAt||0)-(k.lastSeenAt||0)||B.playSeconds-k.playSeconds),Ce={at:n,all:r}}const s=new Set;try{const b=typeof a?.getAll=="function"?[...a.getAll("exclude"),...a.getAll("excludeName")]:[];for(const k of b.flatMap(B=>String(B).split(","))){const B=k.trim().toLowerCase();B&&s.add(B)}}catch{}s.size&&(r=r.filter(b=>!s.has(String(b.name||"").trim().toLowerCase())));const c=r.length||1,i=b=>Math.round(b/c*100),l={};for(const b of r)for(const[k,B]of Object.entries(b.counts))l[k]=(l[k]||0)+B;const m=r.reduce((b,k)=>b+k.playSeconds,0),u=r.reduce((b,k)=>b+k.sessions,0),p=r.reduce((b,k)=>b+k.totalActions,0),d={activeNow:r.filter(b=>b.minutesSinceActive!=null&&b.minutesSinceActive<=5).length,activeLast24h:r.filter(b=>b.status==="active").length,activeLast7d:r.filter(b=>b.status==="active"||b.status==="recent").length,dormant:r.filter(b=>b.status==="dormant").length,newLast24h:r.filter(b=>n-b.createdAt<=xe).length,newLast7d:r.filter(b=>n-b.createdAt<=7*xe).length},f=b=>{const k={};for(const B of r){const Z=b(B)||"unknown";k[Z]=(k[Z]||0)+1}return k},w=f(b=>b.language||"en"),x=f(b=>b.platform),y=f(b=>b.os),v=f(b=>b.version),I=f(b=>b.edition||"full"),A=r.filter(b=>b.sessions>=2).length,T={created:r.length,collected:r.filter(b=>b.activation?.collected).length,crafted:r.filter(b=>b.activation?.crafted).length,placed:r.filter(b=>b.activation?.placed).length,attractedAnimal:r.filter(b=>b.activation?.attractedAnimal).length,unlockedSecondBiome:r.filter(b=>b.activation?.unlockedSecondBiome).length},j={collected:i(T.collected),crafted:i(T.crafted),placed:i(T.placed),attractedAnimal:i(T.attractedAnimal),unlockedSecondBiome:i(T.unlockedSecondBiome)},P={};for(const b of r)b.currentArea&&(P[b.currentArea]=(P[b.currentArea]||0)+1);const D=Object.entries(P).sort((b,k)=>k[1]-b[1])[0]?.[0]||null,W={};for(const b of r){const k=String(b.tutorialStep||0);W[k]=(W[k]||0)+1}const q=r.filter(b=>(b.biomeSummary?.biomesUnlocked||0)>0),N=q.length?Math.round(q.reduce((b,k)=>b+(k.biomeSummary.avgHealth||0),0)/q.length):0,G=r.filter(b=>b.achievements),te=G.reduce((b,k)=>b+(k.achievements.earned||0),0),oe={},K={},ee={};for(const b of G){for(const Z of b.achievements.recent||[])Z?.id&&(oe[Z.id]=(oe[Z.id]||0)+1);for(const[Z,ke]of Object.entries(b.achievements.byCategory||{}))K[Z]=(K[Z]||0)+ke;const k=b.achievements.earned||0,B=k===0?"0":`${Math.floor((k-1)/10)*10+1}-${(Math.floor((k-1)/10)+1)*10}`;ee[B]=(ee[B]||0)+1}const C={totalDefined:G.reduce((b,k)=>Math.max(b,k.achievements.total||0),0),totalEarned:te,avgPerPlayer:Y(te/(G.length||1)),avgCompletionPct:G.length?Math.round(G.reduce((b,k)=>b+(k.achievements.completion||0),0)/G.length*100):0,avgPoints:Y(G.reduce((b,k)=>b+(k.achievements.points||0),0)/(G.length||1)),byCategory:K,recentDistribution:oe,completionHistogram:ee},L={};for(const b of r)for(const[k,B]of Object.entries(b.areaSeconds||{}))L[k]=(L[k]||0)+B;const V=Object.values(L).reduce((b,k)=>b+k,0),se={};for(const[b,k]of Object.entries(L))se[b]=Math.round(k/60);const Ie={totalSeconds:Math.round(V),byAreaSeconds:L,byAreaMinutes:se,mostTimeArea:Object.entries(L).sort((b,k)=>k[1]-b[1])[0]?.[0]||null},$e={"<2m":0,"2-10m":0,"10-30m":0,"30m+":0};for(const b of r)for(const[k,B]of Object.entries(b.sessionLengths||{}))$e[k]=($e[k]||0)+B;const de=r.filter(b=>(b.creationMs||0)>0),_e={savesWithTiming:de.length,avgCreationSeconds:de.length?Y(de.reduce((b,k)=>b+k.creationMs,0)/de.length/1e3):0,medianCreationSeconds:de.length?Y([...de].map(b=>b.creationMs).sort((b,k)=>b-k)[Math.floor(de.length/2)]/1e3):0},Te={},ae=(b,k)=>{if(k==null||k==="")return;const B=String(k);(Te[b]||={})[B]=(Te[b][B]||0)+1};for(const b of r){const k=b.appearance;k&&(ae("skin",k.skin),ae("hair",k.hair),ae("outfit",k.outfit),ae("hat",k.hat),ae("hatColor",k.hatColor),ae("hairstyle",k.hairstyle),ae("beard",k.beard),ae("body",k.body))}const Pe={savesWithAppearance:r.filter(b=>b.appearance).length,choices:Te},pe=r.filter(b=>b.timeToFirstActionSeconds!=null),nt={playersMeasured:pe.length,avgSeconds:pe.length?Y(pe.reduce((b,k)=>b+k.timeToFirstActionSeconds,0)/pe.length):0};let me=[];try{me=await ie(e.AppOpen)}catch{}const ne=me.length,ge=me.filter(b=>b.converted).length,Ee={};for(const b of me){const k=b.edition==="demo"?"demo":"full";Ee[k]=(Ee[k]||0)+1}const S=me.filter(b=>(b.creationMs||0)>0),E=me.reduce((b,k)=>b+(k.savesCreated||0),0),Q={};for(const b of me){const k=String(b.savesCreated||0);Q[k]=(Q[k]||0)+1}const U={devices:ne,totalOpens:me.reduce((b,k)=>b+(k.opens||0),0),converted:ge,bounced:ne-ge,conversionPct:ne?Math.round(ge/ne*100):0,bounceRatePct:ne?Math.round((ne-ge)/ne*100):0,avgCreatorSeconds:S.length?Y(S.reduce((b,k)=>b+k.creationMs,0)/S.length/1e3):0,totalCharactersCreated:E,avgCharactersPerPerson:ne?Y(E/ne):0,avgCharactersPerConverted:ge?Y(E/ge):0,charactersPerPersonHistogram:Q,editions:Ee};return{generatedAt:n,source:"solo-metrics",summary:{players:r.length,soloPlayers:r.length,excludedNames:[...s],audience:d,languages:w,platforms:x,operatingSystems:y,versions:v,editions:I,engagement:{totalPlayHours:Y(m/3600),totalPlaySeconds:m,avgPlayMinutesPerPlayer:Math.round(m/60/c),totalSessions:u,avgSessionsPerPlayer:Y(u/c),avgSessionMinutes:u?Math.round(m/60/u):0,totalActions:p,avgActionsPerPlayer:Y(p/c)},retention:{returningPlayers:A,returningRatePct:i(A)},progression:{avgBiomeHealth:N,biomesFullyRestored:r.reduce((b,k)=>b+(k.biomeSummary?.biomesFullyRestored||0),0),avgUnlockedBiomes:Y(r.reduce((b,k)=>b+(k.unlockedBiomes||0),0)/c),mostPopularArea:D,tutorialStepHistogram:W},areaDwell:Ie,sessionLengthDistribution:$e,creation:_e,appearancePopularity:Pe,timeToFirstAction:nt,acquisition:U,funnel:T,funnelPct:j,actionTotals:l,achievements:C},players:r}}}class Hr extends R{async get(){const a=String(this.getId?.()||"").trim();if(!a)throw new g(h("server.err.snapshotPathId"));await H(a);const e=M(),o=await z(),n=(await _(e.BiomeState,a)).filter(i=>i.unlocked),r=await _(e.Placement,a),s=await _(e.TerrainTile,a),c=n.map(i=>{const l=o.biome.get(i.biomeId),m=r.filter(d=>d.area===i.biomeId),u=s.filter(d=>d.area===i.biomeId),p=ra(o,l,i.health||0,m,u);return{area:i.biomeId,name:l?.name||i.biomeId,health:i.health||0,placements:m.length,image:oa(p),svg:p}});return{ok:!0,playerId:a,areas:c}}}class Nr extends R{async post(a){const{playerId:e,action:o,area:n,amount:r,value:s,resources:c,animalId:i}=await O(a),l=M(),m=await z(),{player:u}=await H(e),p=[];switch(o){case"set-time":{const d=String(s||"dawn"),f=Re(u),w=Ue(f,d)-f;await l.Player.patch(e,{clockOffsetMs:(u.clockOffsetMs||0)+w}),p.push(`Set time to ${d}`);break}case"reset-clock":{const d=Math.round((u?.metrics?.playSeconds||0)*1e3);await l.Player.patch(e,{clockOffsetMs:Ue(0,"day")-d}),p.push("Reset the game clock to the first morning");break}case"seed-water":{const d=n||"wetland";for(const f of(await _(l.TerrainTile,e)).filter(w=>w.area===d))await l.TerrainTile.delete(f.id);await We(e,e,d),await re(e,e,d,{player:u}),p.push(`Reseeded starting terrain for ${d}`);break}case"clear-terrain":{const d=n||u.area;let f=0;for(const w of(await _(l.TerrainTile,e)).filter(x=>x.area===d))await l.TerrainTile.delete(w.id),f++;await re(e,e,d,{player:u}),p.push(`Cleared ${f} terrain tiles in ${d}`);break}case"grant-resources":{const d={...u.inventory||{}},f=new Set(m.resources.map(x=>x.id));let w=0;if(c&&typeof c=="object"){for(const[x,y]of Object.entries(c)){const v=Math.floor(Number(y)||0);v>0&&f.has(x)&&(d[x]=(d[x]||0)+v,w++)}p.push(`Granted ${w} resource type${w===1?"":"s"}`)}else{const x=Math.max(1,Number(r)||200);for(const y of m.resources)d[y.id]=(d[y.id]||0)+x;p.push(`Granted ${x} of every resource`)}await l.Player.patch(e,{inventory:d});break}case"max-tools":{const d={...u.tools||{}};for(const f of m.tools){const w=Math.max(...f.tiers.map(x=>x.tier));d[f.id]=w}await l.Player.patch(e,{tools:d}),p.push("All tools set to max tier");break}case"unlock-all":{const d=m.biomes.map(f=>f.id);await l.Player.patch(e,{unlockedBiomes:d});for(const f of d)await l.BiomeState.patch(`${e}:${f}`,{unlocked:!0});p.push(`Unlocked all biomes (${d.length})`);break}case"unlock-next":{const d=[...m.biomes].sort((x,y)=>(x.order||0)-(y.order||0)),f=new Set(u.unlockedBiomes||["meadow"]),w=d.find(x=>!f.has(x.id));if(!w){p.push("Every biome is already unlocked");break}f.add(w.id),await l.Player.patch(e,{unlockedBiomes:[...f]}),await l.BiomeState.patch(`${e}:${w.id}`,{unlocked:!0}),await We(e,e,w.id),p.push(`Unlocked the next area: ${w.name}`);break}case"relock-all":{await l.Player.patch(e,{unlockedBiomes:["meadow"]});for(const d of m.biomes)await l.BiomeState.patch(`${e}:${d.id}`,{unlocked:d.id==="meadow"});p.push("Re-locked every biome except the meadow");break}case"reset-tools":{await l.Player.patch(e,{tools:{...dt}}),p.push("Tools reset to tier 1");break}case"restart-game":{const d=e;for(const w of await _(l.Placement,e))await l.Placement.delete(w.id);for(const w of await _(l.Chest,e))await l.Chest.delete(w.id);for(const w of await _(l.TerrainTile,e))await l.TerrainTile.delete(w.id);for(const w of await _(l.Discovery,e))await l.Discovery.delete(w.id);for(const w of await _(l.NodeState,e))await l.NodeState.delete(w.id);for(const w of await _(l.FeedEntry,e))await l.FeedEntry.delete(w.id);for(const w of await _(l.PlayerAchievement,e))await l.PlayerAchievement.delete(w.id);for(const w of m.biomes)await l.BiomeState.put({id:`${d}:${w.id}`,worldId:d,playerId:e,biomeId:w.id,health:Se,balance:0,returnedCount:0,unlocked:w.id==="meadow"});const f=`pl_${e}_starter-chest`;await l.Placement.put({id:f,worldId:d,playerId:e,objectId:"small-chest",area:"meadow",x:ue.x,y:ue.y,placedAt:Date.now()}),await l.Chest.put({id:f,worldId:d,playerId:e,area:"meadow",x:ue.x,y:ue.y,size:"small-chest",capacity:ue.capacity,contents:{}}),await l.Player.patch(e,{area:"meadow",x:24.5,y:6.5,inventory:{...Qt},craftedItems:{},craftedEver:{},tools:{...dt},unlockedBiomes:["meadow"],visitedBiomes:["meadow"],tutorialStep:0,home:{...Ne},customGoals:[],goalClaims:{},devUnlockAll:!1,clockOffsetMs:Ue(0,"day")-Math.round((u?.metrics?.playSeconds||0)*1e3)}),p.push("Restarted the game — fresh save (name, passcode & look kept)");break}case"build-home":{const d=s&&fe[s]?s:"cabin",f={...ce(u),style:d,space:Math.max(2,ce(u).space||1),styleLocked:!0};await l.Player.patch(e,{home:f}),p.push(`Built home: ${fe[d].name}`);break}case"max-home":{const d={style:s&&fe[s]?s:ce(u).style||"cabin",space:ye.space.levels.length,comfort:ye.comfort.levels.length,decor:ye.decor.levels.length,light:ye.light.levels.length,styleLocked:!0};await l.Player.patch(e,{home:d}),p.push("Home maxed on every track");break}case"reset-home":{await l.Player.patch(e,{home:{...Ne}}),p.push("Home reset to the starter tent");break}case"set-health":{const d=n||u.area,f=Math.max(0,Math.min(100,Number(s)||100));await l.BiomeState.patch(`${e}:${d}`,{health:f}),p.push(`Set ${d} health to ${f}% (recomputes on next change)`);break}case"reset-biome":{const d=n||u.area;let f=0;for(const y of(await _(l.Placement,e)).filter(v=>v.area===d))m.object.get(y.objectId)?.isChest||(await l.Placement.delete(y.id),f++);for(const y of(await _(l.TerrainTile,e)).filter(v=>v.area===d))await l.TerrainTile.delete(y.id);let w=0;for(const y of(await _(l.Discovery,e)).filter(v=>v.biomeId===d))await l.Discovery.delete(y.id),w++;const x=`${e}:${d}:`;for(const y of(await _(l.NodeState,e)).filter(v=>String(v.id).startsWith(x)))await l.NodeState.delete(y.id);await l.BiomeState.patch(`${e}:${d}`,{health:Se,balance:0,returnedCount:0}),await We(e,e,d),await re(e,e,d,{player:u}),p.push(`Reset ${d} to its damaged state — removed ${f} object${f===1?"":"s"} and sent ${w} animal${w===1?"":"s"} away (chests kept)`);break}case"lock-biome":{const d=n||u.area;if(d==="meadow")throw new g(h("server.err.meadowCannotLock"));const f=(u.unlockedBiomes||[]).filter(w=>w!==d);await l.Player.patch(e,{unlockedBiomes:f}),await l.BiomeState.patch(`${e}:${d}`,{unlocked:!1}),p.push(`Locked ${d} again (unlock requirements must be met to re-enter)`);break}case"unlock-recipes":{const d=s===void 0?!u.devUnlockAll:!!s;await l.Player.patch(e,{devUnlockAll:d}),p.push(d?"All recipes unlocked (gates ignored)":"Recipe progress gates restored");break}case"welcome-animals":{const d=n||u.area,f=m.animals.filter(y=>y.biome===d),w=new Set((await _(l.Discovery,e)).filter(y=>y.biomeId===d).map(y=>y.animalId));let x=0;for(const y of f)w.has(y.id)||(await l.Discovery.put({id:`${e}:${y.id}`,playerId:e,animalId:y.id,biomeId:d,comfort:3,timesObserved:0,firstObservedAt:Date.now(),whyReturned:Ke(y,m)}),x++);await re(e,e,d,{player:u}),p.push(`Welcomed ${x} animal${x===1?"":"s"} to ${d} (${f.length} total)`);break}case"spawn-animal":{const d=m.animals.find(y=>y.id===i);if(!d)throw new g(h("server.err.unknownAnimal",{animal:i}));const f=`${e}:${d.id}`;await l.Discovery.get(f)||await l.Discovery.put({id:f,playerId:e,animalId:d.id,biomeId:d.biome,comfort:85,timesObserved:1,firstObservedAt:Date.now(),whyReturned:Ke(d,m)});const x=u.unlockedBiomes||["meadow"];x.includes(d.biome)||await l.Player.patch(e,{unlockedBiomes:[...x,d.biome]}),await re(e,e,d.biome,{player:u}),await l.Discovery.patch(f,{comfort:85}),p.push(`Spawned ${d.name} in ${d.biome} — comfort 85, biome unlocked`);break}case"populate-biome":{const d=n||u.area,f=m.biome.get(d);if(!f||d==="home")throw new g(h("server.err.cannotPopulate",{area:d}));const w=F(u),x=new Set(u.unlockedBiomes||["meadow"]);x.has(d)||(x.add(d),await l.Player.patch(e,{unlockedBiomes:[...x]}));for(const S of(await $(l.Placement,w)).filter(E=>E.area===d))m.object.get(S.objectId)?.isChest||await l.Placement.delete(S.id);for(const S of(await $(l.TerrainTile,w)).filter(E=>E.area===d))await l.TerrainTile.delete(S.id);const y=Fe(m,d),v=d==="alpine"?na:0,I=d==="coastal"?y.cols-(f.oceanCols||0):y.cols,A=2,T=I-2,j=v+2,P=y.rows-2,D=(S,E)=>d==="meadow"&&S>=19&&S<=24&&E>=3&&E<=6,W=Date.now()-45*864e5,q=ht(ut(`populate:${w}:${d}`)),N=(S,E)=>S+Math.floor(q()*(E-S+1)),G=S=>S[Math.floor(q()*S.length)],te=new Set;(await $(l.Chest,w)).filter(S=>S.area===d).forEach(S=>te.add(`${S.x},${S.y}`));const oe=(S,E)=>S>=A&&S<=T&&E>=j&&E<=P&&!D(S,E)&&!te.has(`${S},${E}`),K=[],ee=(S,E)=>{oe(S,E)&&(te.add(`${S},${E}`),K.push({x:S,y:E}))};if(f.canFlood!==!1){const S=N(A+1,Math.max(A+1,Math.min(T-4,A+8))),E=N(j+1,Math.max(j+1,Math.min(P-3,j+6)));for(let b=0;b<3;b++)for(let k=0;k<4;k++)(k===0||k===3)&&(b===0||b===2)||ee(S+k,E+b);ee(S+1,E-1),ee(S+2,E+3);let Q=N(Math.floor((A+T)/2),T-2),U=j;ee(Q,U);for(let b=0,k=N(13,18);b<k&&U<P;b++)q()<.25&&Q>A+1&&Q<T-1?Q+=q()<.5?-1:1:U+=1,ee(Q,U),q()<.25&&ee(Math.min(T,Q+1),U)}const C=m.objects.filter(S=>(S.biomes||[]).includes(d)&&S.placement!=="indoor"&&S.placement!=="none"&&!S.isChest&&!S.bridge);if(!C.length)throw new g(h("server.err.noPlaceableObjects",{biome:f.name}));const L=S=>/-path$/.test(S.id)||S.id==="wooden-fence"||S.id==="dry-stone-wall",V=C.filter(S=>S.plantable&&(S.growSeconds||0)>=80),se=C.filter(S=>S.plantable&&(S.growSeconds||0)<80),Ie=new Set(["shrub","rock-pile","hollow-log","log-shelter","brush-pile","stone-cairn","rock-cairn","clover-patch","butterfly-flowers","pollinator-garden","fallen-branch-shelter","insect-hotel","birdhouse","bird-perch"]),$e=C.filter(S=>!S.plantable&&!L(S)&&Ie.has(S.id)),de=C.filter(L),_e=C.filter(S=>!S.plantable&&!L(S)&&!Ie.has(S.id)),Te=$e.length?$e:se,ae=[],Pe=(S,E,Q)=>{if(!S||!oe(E,Q))return!1;te.add(`${E},${Q}`);const U={id:`pl_dev_${d}_${E}_${Q}`,worldId:w,playerId:e,objectId:S.id,area:d,x:E,y:Q,placedAt:W};return S.plantable&&(U.plantedAt=W),ae.push(U),!0},pe=(S,E,Q,U,b)=>{if(!S.length)return;const k=q()<.65?G(S):null;for(let B=0,Z=0;B<U&&Z<U*8;Z++){const ke=k&&q()<.7?k:G(S);Pe(ke,E+N(-b,b),Q+N(-b,b))&&B++}};for(let S=0,E=N(8,12);S<E;S++){const Q=N(A,T),U=N(j,P),b=q();b<.4&&se.length?pe(se,Q,U,N(4,8),2):b<.72&&V.length?(pe(V,Q,U,N(2,4),2),pe(Te,Q,U,N(1,3),2)):pe(Te,Q,U,N(3,6),2)}if(de.length)for(let S=0,E=N(1,2);S<E;S++){const Q=G(de),U=q()<.5,b=N(4,6),k=N(A,Math.max(A,T-(U?b:0))),B=N(j,Math.max(j,P-(U?0:b)));for(let Z=0;Z<b;Z++)Pe(Q,k+(U?Z:0),B+(U?0:Z))}for(let S=0,E=0,Q=N(14,20);_e.length&&S<Q&&E<Q*12;E++)Pe(G(_e),N(A,T),N(j,P))&&S++;for(let S=0;ae.length<34&&S<500;S++)Pe(G(C),N(A,T),N(j,P));for(const S of K)await l.TerrainTile.put({id:`${w}:${d}:${S.x}:${S.y}`,worldId:w,playerId:e,area:d,x:S.x,y:S.y,type:"water",updatedAt:Date.now()});for(const S of ae)await l.Placement.put(S);const nt=K.length,me=ae.length,ne=m.animals.filter(S=>S.biome===d),ge=new Set((await $(l.Discovery,w)).filter(S=>S.biomeId===d).map(S=>S.animalId));for(const S of ne)ge.has(S.id)||await l.Discovery.put({id:`${w}:${S.id}`,worldId:w,playerId:e,animalId:S.id,biomeId:d,comfort:90,timesObserved:0,firstObservedAt:Date.now(),whyReturned:Ke(S,m)});await re(w,e,d,{player:u});const Ee=await be(l.BiomeState,w,d);await l.BiomeState.patch(Ee?.id??`${w}:${d}`,{health:100,balance:100,returnedCount:ne.length});for(const S of(await $(l.Discovery,w)).filter(E=>E.biomeId===d))await l.Discovery.patch(S.id,{comfort:90});p.push(`Populated ${f.name}: ${me} objects, ${nt} water tiles, ${ne.length} animals home, health 100`);break}case"set-weather":{const d=s&&typeof s=="object"?s:null;if(!d||d.clear){await l.Player.patch(e,{devWeather:null}),p.push("Weather override cleared — back to the live sky");break}const f=u.devWeather||{},w={type:f.type??null,season:f.season??null};if("type"in d){if(d.type&&!ga.includes(d.type))throw new g(h("server.err.unknownWeatherType",{type:d.type}));w.type=d.type||null}if("season"in d){if(d.season&&!ya.includes(d.season))throw new g(h("server.err.unknownSeason",{season:d.season}));w.season=d.season||null}await l.Player.patch(e,{devWeather:w}),p.push(`Weather override: ${w.type||"live"} · ${w.season||"live"}`);break}default:throw new g(h("server.err.unknownDevAction",{action:o}))}return{ok:!0,log:p,state:await De(e)}}}const Wt=4e3;class Lr extends R{async post(a){const e=await O(a),o=String(e.message||"").trim();if(!o)throw new g(h("server.err.feedbackEmpty"));if(o.length>Wt)throw new g(h("server.err.feedbackTooLong",{max:Wt}));const n=String(e.replyTo||"").trim().slice(0,200)||null;if(n&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(n))throw new g(h("server.err.feedbackBadEmail"));const r=e.metrics&&typeof e.metrics=="object"&&!Array.isArray(e.metrics)?e.metrics:{},s=Number(e.queuedAt)||null,c=`fb_${Date.now()}_${Math.random().toString(36).slice(2,10)}`;return await M().Feedback.put({id:c,message:o,replyTo:n,metrics:r,queuedAt:s,createdAt:Date.now()}),{ok:!0,id:c}}}class qr extends Resource{async get(){const a=await ie(M().Feedback);return a.sort((e,o)=>(o.createdAt||0)-(e.createdAt||0)),{count:a.length,feedback:a}}}const _n=24e3;class Fr extends R{async post(a){const e=await O(a),o=String(e.clientId||"").trim().slice(0,64);if(!o)throw new g(h("server.err.clientIdRequired"));const n=e.snapshot&&typeof e.snapshot=="object"&&!Array.isArray(e.snapshot)?e.snapshot:null;if(!n)throw new g(h("server.err.snapshotRequired"));const r=JSON.stringify(n);if(r.length>_n)throw new g(h("server.err.snapshotTooLarge"));const s=M(),c=`solo:${o}`,i=await X(s.SoloMetrics,c);return await s.SoloMetrics.put({id:c,clientId:o,name:String(e.name||n.name||"").slice(0,40),platform:String(e.platform||"").slice(0,20)||null,os:String(e.os||"").slice(0,20)||null,version:String(e.version||"").slice(0,24)||null,build:String(e.build||"").slice(0,40)||null,language:String(e.language||n.language||"").trim().toLowerCase().slice(0,12)||null,snapshot:r,createdAt:i?.createdAt||Date.now(),updatedAt:Date.now()}),Ce=null,{ok:!0}}}class zr extends R{async post(a){const e=await O(a),o=String(e.deviceId||"").trim().slice(0,64);if(!o)throw new g(h("server.err.deviceIdRequired"));const n=e.phase==="created"?"created":"open",r=Date.now(),s=M(),c=`dev:${o}`,i=await X(s.AppOpen,c),l=Ae(Math.round(Number(e.creationMs)||0),0,60*6e4);return await s.AppOpen.put({id:c,deviceId:o,platform:String(e.platform||"").slice(0,20)||i?.platform||null,os:String(e.os||"").slice(0,20)||i?.os||null,version:String(e.version||"").slice(0,24)||i?.version||null,edition:e.edition==="demo"||i?.edition==="demo"?"demo":e.edition==="full"?"full":i?.edition||null,language:String(e.language||"").trim().toLowerCase().slice(0,12)||i?.language||null,firstOpenAt:i?.firstOpenAt||r,lastOpenAt:r,opens:(i?.opens||0)+(n==="open"?1:0),converted:i?.converted||n==="created",firstConvertedAt:i?.firstConvertedAt||(n==="created"?r:0),savesCreated:(i?.savesCreated||0)+(n==="created"?1:0),creationMs:n==="created"&&l>0?l:i?.creationMs||0,updatedAt:r}),Ce=null,{ok:!0}}}const at=t=>({status:200,headers:{"content-type":"text/html; charset=utf-8","cache-control":"public, max-age=3600"},body:t});class _r extends R{async get(){return at(Pa)}}class Qr extends R{async get(){return at(Ca)}}class Gr extends R{async get(){return at(Ba)}}class Ur extends R{async get(){return at(Ra)}}export{zr as AppOpen,Or as AppendFeed,Hr as BiomeSnapshot,Vn as ChangePasscode,rr as CheckWorldCode,fr as ChestTransfer,Cr as ClaimTask,hr as CollectResource,wr as CraftItem,Zn as CreatePlayer,ar as CreateWorld,Jn as DeleteDemoSave,Yn as DeletePlayer,Nr as DevTools,pr as DiscardItem,Kn as ExportDemoSave,Un as GameData,er as GameState,br as HarvestPlacement,Er as Heartbeat,sr as JoinRequestStatus,nr as JoinWorld,mr as LeaveWorld,qr as ListFeedback,Xn as LoginPlayer,Wr as Metrics,kr as MoveObject,tr as MyWorlds,Pr as ObserveAnimal,ir as PendingJoinRequests,gr as PlaceObject,yr as Plant,ur as Presence,jr as RecalcBiome,xr as RemoveObject,or as RequestJoin,cr as ResolveJoin,Mr as Rest,Br as SetGoals,Ir as SetHomeColors,Tr as SetHomeStyle,$r as SetPlacementColor,Lr as SubmitFeedback,dr as SwitchWorld,Fr as SyncMetrics,Dr as SyncPlayer,Rr as Terraform,vr as UpdateAppearance,Ar as UpgradeHome,Sr as UpgradeTool,Gn as Version,lr as WorldRoster,Qr as"age-rating",Ur as dashboard,Rt as healthCapForReturns,_r as privacy,Gr as support};
