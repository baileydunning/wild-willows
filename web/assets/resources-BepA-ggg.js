import{_ as e,a as t,b as n,c as r,d as i,f as a,g as o,h as s,i as c,l,m as u,n as d,o as f,p,r as m,s as h,t as g,u as _,v,x as y,y as b}from"./index-Bb7JflpX.js";var x={BROTLI_PARAM_QUALITY:1,BROTLI_PARAM_SIZE_HINT:2};function S(e){return e}function C(e){return e}b(`en`,{server:y});var w=`<!doctype html>
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
`,T=`<!doctype html>
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
`,ee=`<!doctype html>
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
`,te=`<!doctype html>
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
	.vfilter { display: inline-flex; align-items: center; gap: .4rem; margin-top: .5rem; font-size: .78rem; color: var(--muted); }
	.vfilter select {
		font: inherit; font-size: .8rem; cursor: pointer; color: var(--accent-dark);
		border: 1px solid var(--rule); background: var(--card); border-radius: 999px;
		padding: .3rem .7rem; box-shadow: var(--shadow);
	}
	.vfilter.is-off { opacity: .4; } /* range selector is moot while "All versions" is picked */
	.vfilter.is-off select { cursor: not-allowed; }
	.filter-note { display: inline-block; margin-left: .5rem; font-size: .74rem; font-weight: 700; color: var(--accent-dark); background: var(--accent-soft); border-radius: 999px; padding: .1rem .55rem; }
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

	/* ---- player highlights ---- */
	.hlgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(248px, 1fr)); gap: .8rem; }
	.hlcard { display: flex; gap: .75rem; align-items: center; background: linear-gradient(180deg,#fffdf7,#f6f3e8); border:1px solid var(--rule); border-radius: 16px; padding: .75rem .85rem; box-shadow: var(--shadow); transition: transform .12s ease; }
	.hlcard:hover { transform: translateY(-3px); }
	.hlav { flex: none; width: 66px; }
	.hlav svg { width: 100%; height: auto; }
	.hlbody { flex: 1; min-width: 0; }
	.hlname { display: flex; align-items: center; gap: .45rem; font-weight: 700; color: var(--ink); font-size: .96rem; margin-bottom: .35rem; overflow: hidden; text-overflow: ellipsis; }
	.hltop { display: flex; align-items: center; gap: .4rem; flex-wrap: wrap; margin-bottom: .5rem; }
	.hltag { font-size: .66rem; font-weight: 700; letter-spacing: .02em; color: var(--accent-dark); background: var(--accent-soft); border-radius: 999px; padding: .12rem .55rem; }
	.hledi { font-size: .6rem; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; border-radius: 999px; padding: .1rem .45rem; }
	.hledi.demo { color: #a9781c; background: #f6e8c9; }
	.hledi.full { color: var(--accent-dark); background: var(--accent-soft); }
	.hlstats { display: grid; grid-template-columns: repeat(3, 1fr); gap: .5rem .35rem; }
	.hlstat { display: flex; flex-direction: column; }
	.hlstat b { font-size: .96rem; color: var(--ink); font-variant-numeric: tabular-nums; line-height: 1.1; }
	.hlstat span { font-size: .64rem; color: var(--faint); }
	.hlcard { cursor: pointer; }
	.hlcard:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

	/* ---- player modal ---- */
	.modal-overlay { position: fixed; inset: 0; background: rgba(30,38,24,.55); display: flex; align-items: flex-start; justify-content: center; padding: 4vh 1rem; z-index: 100; overflow-y: auto; }
	.modal { background: var(--bg); border-radius: 20px; max-width: 880px; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,.3); padding: 1.4rem 1.4rem 1.8rem; position: relative; }
	.modal-close { position: absolute; top: .9rem; right: 1rem; border: none; background: var(--card); border-radius: 999px; width: 34px; height: 34px; font-size: 1.2rem; line-height: 1; cursor: pointer; color: var(--muted); box-shadow: var(--shadow); }
	.modal-close:hover { color: var(--ink); }
	.modal-head { display: flex; gap: 1rem; align-items: center; margin-bottom: 1.1rem; padding-right: 2.4rem; }
	.modal-head .mav { flex: none; width: 84px; }
	.modal-head .mav svg { width: 100%; height: auto; }
	.modal-head h2 { margin: 0 0 .3rem; font-size: 1.3rem; }
	.modal-head .msub { color: var(--muted); font-size: .82rem; display: flex; gap: .5rem .7rem; flex-wrap: wrap; align-items: center; }
	.checklist { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px,1fr)); gap: .45rem .8rem; }
	.checkitem { display: flex; align-items: center; gap: .45rem; font-size: .84rem; color: var(--muted); }
	.checkitem .ck { width: 18px; height: 18px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: .72rem; font-weight: 700; flex: none; }
	.checkitem .ck.on { background: var(--accent-soft); color: var(--accent-dark); }
	.checkitem .ck.off { background: #f0e4e4; color: #b06a6a; }
	.reclist { display: flex; flex-direction: column; gap: .3rem; }
	.recrow { display: flex; justify-content: space-between; gap: 1rem; font-size: .82rem; color: var(--faint); border-bottom: 1px dashed var(--rule); padding-bottom: .3rem; }
	.recrow b { color: var(--ink); font-weight: 600; }
	body.modal-open { overflow: hidden; }

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
			<label class="vfilter"><span>Version</span>
				<select id="version-filter"><option value="all">All versions</option></select>
			</label>
			<label class="vfilter" id="version-mode-wrap"><span>Range</span>
				<select id="version-mode">
					<option value="exact">Only this</option>
					<option value="min">This &amp; newer</option>
				</select>
			</label>
			<label class="vfilter"><span>Edition</span>
				<select id="edition-filter"><option value="all">All editions</option></select>
			</label>
			<label class="vfilter"><span>Platform</span>
				<select id="platform-filter"><option value="all">All platforms</option></select>
			</label>
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

/* Shared action labels (used by the all-time totals and the per-player modal). */
const ACTION_LABELS = {
	resourcesCollected: "Resources collected", terraformActions: "Terraform actions", plantsPlanted: "Plants planted",
	itemsCrafted: "Items crafted", objectsPlaced: "Objects placed", animalsReturned: "Animals returned",
	itemsDiscarded: "Items discarded", animalsObserved: "Animals observed", chestDeposits: "Chest deposits",
	tasksCompleted: "Tasks completed", toolsUpgraded: "Tools upgraded", homeUpgrades: "Home upgrades",
	recolors: "Recolors", chestWithdrawals: "Chest withdrawals", objectsMoved: "Objects moved",
	objectsRemoved: "Objects removed", homesBuilt: "Homes built",
};

/* Compact duration: minutes under an hour, else "Xh Ym". */
function fmtDur(sec) { const m = Math.round(n(sec) / 60); if (m < 60) return m + "m"; const h = Math.floor(m / 60), r = m % 60; return r ? \`\${h}h \${r}m\` : \`\${h}h\`; }

/* ------------------------------------------------------------------ *
 * Per-player modal — a full picture of one caretaker's playthrough
 * ------------------------------------------------------------------ */
let PLAYERS_BY_ID = {};
let modalEl = null;

/** Build the modal body for one player: header, headline stats, progress,
 *  milestones, a full action breakdown, time-by-area, and recent achievements. */
function playerModalHTML(p) {
	const bs = p.biomeSummary || {}, ach = p.achievements || {}, act = p.activation || {}, counts = p.counts || {};
	const edi = p.edition === "demo" ? "demo" : "full";
	const areaMin = (p.areaMinutes && Object.keys(p.areaMinutes).length)
		? p.areaMinutes
		: Object.fromEntries(Object.entries(p.areaSeconds || {}).map(([k, v]) => [k, Math.round(n(v) / 60)]));
	const joined = p.daysSinceJoined != null ? \`joined \${p.daysSinceJoined}d ago\` : "";
	const last = p.hoursSinceActive != null ? \`last seen \${p.hoursSinceActive}h ago\` : "";
	const tut = n(p.tutorialStep) >= 99 ? "Done" : \`Step \${n(p.tutorialStep)}\`;

	const kpis = \`<div class="grid kpis">\${[
		kpi(fmtDur(p.playSeconds), "Played", \`\${fmt(n(p.playMinutes))}m total\`),
		kpi(fmt(n(p.sessions)), n(p.sessions) === 1 ? "Session" : "Sessions", \`\${n(p.avgSessionMinutes)}m avg\`),
		kpi(fmt(n(p.totalActions)), "Actions", \`\${n(p.actionsPerMinute)}/min\`),
		kpi(\`\${n(ach.earned)}<small>/\${n(ach.total)}</small>\`, "Achievements", \`\${fmt(n(ach.points))} pts\`),
	].join("")}</div>\`;

	const progress = cardTitled("Progress", null, \`<div class="grid kpis">\${[
		kpi(fmt(n(p.unlockedBiomes || bs.biomesUnlocked)), "Biomes unlocked"),
		kpi(fmt(n(bs.biomesFullyRestored)), "Biomes restored"),
		kpi(\`\${n(bs.avgHealth)}<small>%</small>\`, "Avg biome health"),
		kpi(fmt(n(bs.totalAnimalsReturned)), "Animals returned"),
	].join("")}</div>\`);

	const cdid = (k) => n(counts[k]) > 0;
	const flags = [
		["Collected a resource", act.collected || cdid("resourcesCollected")],
		["Terraformed the land", act.terraformed || cdid("terraformActions")],
		["Planted something", act.planted || cdid("plantsPlanted")],
		["Crafted an item", act.crafted || cdid("itemsCrafted")],
		["Placed an object", act.placed || cdid("objectsPlaced")],
		["Attracted an animal", act.attractedAnimal || n(bs.totalAnimalsReturned) > 0],
		["Upgraded a tool", act.upgradedTool || cdid("toolsUpgraded")],
		["Built a home", act.builtHome || cdid("homesBuilt")],
		["Upgraded a home", act.upgradedHome || cdid("homeUpgrades")],
		["Unlocked 2nd biome", act.unlockedSecondBiome || n(p.unlockedBiomes || bs.biomesUnlocked) >= 2],
	];
	const checklist = cardTitled("Milestones", null, \`<div class="checklist">\${flags.map(([l, on]) =>
		\`<span class="checkitem"><span class="ck \${on ? "on" : "off"}">\${on ? "✓" : "·"}</span>\${l}</span>\`).join("")}</div>\`);

	const totalActs = Object.values(counts).reduce((a, b) => a + n(b), 0);
	const actionsCard = cardTitled("Everything they did", \`\${fmt(totalActs)} actions\`,
		barRows(objToEntries(counts), { labelMap: ACTION_LABELS }));
	const areaCard = Object.keys(areaMin).length
		? cardTitled("Time by area", null, barRows(objToEntries(areaMin), { cls: "sky", fmtNum: (v) => \`\${fmt(v)}m\` }))
		: "";

	const recent = (ach.recent || []).slice(0, 8);
	const recCard = recent.length
		? cardTitled("Recent achievements", \`\${n(ach.earned)} earned\`, \`<div class="reclist">\${recent.map((r) =>
			\`<div class="recrow"><b>\${esc(r.name || r.id || "")}</b><span>\${r.earnedAt ? new Date(r.earnedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}</span></div>\`).join("")}</div>\`)
		: "";

	const onboard = cardTitled("Onboarding", null, \`<div class="grid kpis">\${[
		kpi(p.creationSeconds != null ? \`\${n(p.creationSeconds)}<small>s</small>\` : "—", "Creation time"),
		kpi(p.timeToFirstActionSeconds != null ? \`\${n(p.timeToFirstActionSeconds)}<small>s</small>\` : "—", "Time to 1st action"),
		kpi(tut, "Tutorial"),
	].join("")}</div>\`);

	const meta = esc([p.platform, p.os, p.version].filter(Boolean).join(" · "));
	const when = [joined, last].filter(Boolean).join(" · ");
	return \`<button class="modal-close" data-close aria-label="Close">×</button>\` +
		\`<div class="modal-head"><div class="mav">\${avatarSVG(p.appearance)}</div><div><h2>\${esc(p.name || "Unnamed")}</h2>\` +
		\`<div class="msub"><span class="hledi \${edi}">\${edi}</span>\${meta ? \`<span>\${meta}</span>\` : ""}\${when ? \`<span>\${when}</span>\` : ""}</div></div></div>\` +
		kpis +
		\`<div class="grid two" style="margin-top:.8rem">\${progress}\${checklist}</div>\` +
		\`<div style="margin-top:.8rem">\${actionsCard}</div>\` +
		(areaCard ? \`<div class="grid two" style="margin-top:.8rem">\${areaCard}\${recCard}</div>\` : (recCard ? \`<div style="margin-top:.8rem">\${recCard}</div>\` : "")) +
		\`<div style="margin-top:.8rem">\${onboard}</div>\`;
}

/** Open the modal for a player id (looked up from the last render). */
function openPlayerModal(pid) {
	const p = PLAYERS_BY_ID[pid];
	if (!p) return;
	if (!modalEl) {
		modalEl = document.createElement("div");
		modalEl.className = "modal-overlay";
		modalEl.innerHTML = \`<div class="modal" role="dialog" aria-modal="true"></div>\`;
		document.body.appendChild(modalEl);
		modalEl.addEventListener("click", (e) => {
			if (e.target === modalEl || (e.target.closest && e.target.closest("[data-close]"))) closePlayerModal();
		});
	}
	modalEl.querySelector(".modal").innerHTML = playerModalHTML(p);
	modalEl.style.display = "flex";
	document.body.classList.add("modal-open");
}
function closePlayerModal() {
	if (modalEl) modalEl.style.display = "none";
	document.body.classList.remove("modal-open");
}

/* ------------------------------------------------------------------ *
 * Main render
 * ------------------------------------------------------------------ */
function render(data) {
	const s = (data && data.summary) || {};
	const players = (data && data.players) || [];
	const A = s.audience || {}, E = s.engagement || {}, R = s.retention || {}, P = s.progression || {};
	const flt = (data && data.filters) || {};
	const out = [];

	/* ---- Overview KPIs ---- */
	const versionLabel = flt.version ? \`v\${flt.version}\${flt.versionMode === "min" ? " & newer" : ""}\` : "";
	const activeFilters = [versionLabel, flt.edition, flt.platform].filter(Boolean).map(esc);
	const overviewSub = activeFilters.length ? \`filtered to \${activeFilters.join(" · ")}\` : "who is out there right now";
	out.push(sec("Overview", overviewSub, \`<div class="grid kpis">\${[
		kpi(fmt(s.players), "Total caretakers", "unique anonymous saves"),
		kpi(\`<span class="accent">\${fmt(A.activeNow)}</span>\`, "Active now", "seen in the last 5 minutes"),
		kpi(fmt(A.activeLast24h), "Active · 24h"),
		kpi(fmt(A.activeLast7d), "Active · 7d"),
		kpi(fmt(A.newLast24h), "New · 24h", \`\${fmt(A.newLast7d)} in the last 7 days\`),
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

	/* ---- Player highlights (rendered here, appended at the bottom) ---- */
	let charSection = "";
	// Everyone who played more than 5 minutes — most engaged first. Each card is
	// clickable and opens a full breakdown modal (looked up by playerId).
	PLAYERS_BY_ID = {};
	for (const p of players) if (p && p.playerId) PLAYERS_BY_ID[p.playerId] = p;
	const engaged = players.filter((p) => p && n(p.playSeconds) > 300);
	if (engaged.length) {
		const top = [...engaged].sort((a, b) =>
			n(b.playSeconds) - n(a.playSeconds) ||
			n(b.totalActions) - n(a.totalActions) ||
			n(b.achievements && b.achievements.points) - n(a.achievements && a.achievements.points)
		);

		// Superlative badges: each dimension's true leader (within the shown set)
		// earns its tag; a standout who leads several shows up to two of them.
		const supTags = {};
		const assignSup = (key, label) => {
			let best = 0, idx = -1;
			top.forEach((p, i) => { const v = n(key(p)); if (v > best) { best = v; idx = i; } });
			if (idx >= 0) (supTags[idx] = supTags[idx] || []).push(label);
		};
		assignSup((p) => p.playSeconds, "Most playtime");
		assignSup((p) => p.totalActions, "Most active");
		assignSup((p) => p.achievements && p.achievements.earned, "Most achievements");
		assignSup((p) => p.biomeSummary && p.biomeSummary.biomesFullyRestored, "Most restored");

		const stat = (v, l) => \`<div class="hlstat"><b>\${v}</b><span>\${l}</span></div>\`;
		const cards = top.map((p, i) => {
			const bs = p.biomeSummary || {};
			const edi = p.edition === "demo" ? "demo" : "full";
			const tags = (supTags[i] || []).slice(0, 2).map((t) => \`<span class="hltag">\${t}</span>\`).join("");
			return \`<div class="hlcard" data-pid="\${esc(p.playerId || "")}" role="button" tabindex="0" title="Click for full breakdown"><div class="hlav">\${avatarSVG(p.appearance)}</div><div class="hlbody"><div class="hltop">\${tags}<span class="hledi \${edi}">\${edi}</span></div><div class="hlstats">\${[
				stat(fmtDur(p.playSeconds), "played"),
				stat(fmt(n(p.sessions)), n(p.sessions) === 1 ? "session" : "sessions"),
				stat(fmt(n(p.totalActions)), "actions"),
				stat(\`\${n(p.achievements && p.achievements.earned)}★\`, "achievements"),
				stat(fmt(n(bs.totalAnimalsReturned)), "animals"),
				stat(fmt(n(p.unlockedBiomes || bs.biomesUnlocked)), "biomes"),
			].join("")}</div></div></div>\`;
		}).join("");
		charSection = sec("Player highlights", \`everyone who played more than 5 min · \${top.length} caretakers · click a card for the full breakdown\`,
			\`<div class="card"><div class="hlgrid">\${cards}</div></div>\`);
	}

	/* ---- Acquisition + Activation funnels ---- */
	const acq = s.acquisition || {};
	const fun = s.funnel || {};
	const dc = s.demoCompletion || {};
	const acqCards = cardTitled("Acquisition funnel", "per device", funnel([
		{ label: "Opened the app", value: acq.devices },
		{ label: "Created a character", value: acq.converted },
	]) + \`<div class="grid three" style="margin-top:1rem">\${[
		kpi(fmt(acq.totalOpens), "App opens"),
		kpi(\`<span class="accent">\${pct(acq.conversionPct)}</span>\`, "Conversion"),
		kpi(pct(acq.bounceRatePct), "Bounced"),
	].join("")}</div>\`);
	const demoCard = dc.demoInstalls
		? cardTitled("Demo completion", "reached the 5-animal hard-stop", funnel([
			{ label: "Made a character", value: dc.createdCharacter },
			{ label: "Finished the demo", value: dc.reachedGoal },
		]) + \`<div class="grid three" style="margin-top:1rem">\${[
			kpi(fmt(dc.demoInstalls), "Demo installs"),
			kpi(\`<span class="accent">\${pct(dc.completionPct)}</span>\`, "Completion", "of demo players who started"),
			kpi(fmt(dc.reachedGoal), "Finished"),
		].join("")}</div>\`)
		: "";
	// Every activation signal we have. "Created" is the entry point (always first
	// and largest); the rest are sorted by count so the funnel always reads
	// top-down. They're independent booleans, not strict prerequisites, so sorting
	// by count — not by an assumed sequence — is the honest way to show them.
	const funRest = [
		{ label: "Collected a resource", value: fun.collected },
		{ label: "Terraformed the land", value: fun.terraformed },
		{ label: "Planted something", value: fun.planted },
		{ label: "Crafted an item", value: fun.crafted },
		{ label: "Placed an object", value: fun.placed },
		{ label: "Attracted an animal", value: fun.attractedAnimal },
		{ label: "Upgraded a tool", value: fun.upgradedTool },
		{ label: "Built a home", value: fun.builtHome },
		{ label: "Upgraded a home", value: fun.upgradedHome },
		{ label: "Unlocked 2nd biome", value: fun.unlockedSecondBiome },
	].filter((st) => st.value != null).sort((a, b) => n(b.value) - n(a.value));
	const funSteps = funnel([{ label: "Created character", value: fun.created }, ...funRest]);
	out.push(sec("Funnels", "from install to a thriving meadow",
		\`<div class="grid two">\${acqCards}\${cardTitled("Activation funnel", "all caretakers", funSteps)}</div>\` +
		(demoCard ? \`<div style="margin-top:.8rem">\${demoCard}</div>\` : "")));

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
	out.push(sec("What caretakers do", "every tracked action, all-time", card(
		barRows(objToEntries(acts).slice(0, 17), { labelMap: ACTION_LABELS }))));

	/* ---- Onboarding timing ---- */
	const cr = s.creation || {}, ttfa = s.timeToFirstAction || {};
	out.push(sec("Onboarding", "first impressions", \`<div class="grid kpis">\${[
		kpi(\`\${n(cr.avgCreationSeconds)}<small>s</small>\`, "Avg creation time", \`\${fmt(cr.savesWithTiming)} timed\`),
		kpi(\`\${n(cr.medianCreationSeconds)}<small>s</small>\`, "Median creation time"),
		kpi(\`\${n(ttfa.avgSeconds)}<small>s</small>\`, "Time to first action", \`\${fmt(ttfa.playersMeasured)} measured\`),
		kpi(\`\${n(acq.avgCharactersPerPerson)}\`, "Characters per person", \`\${fmt(acq.totalCharactersCreated)} created total\`),
	].join("")}</div>\`));

	/* ---- Settings & accessibility ---- */
	const set = s.settings || {};
	if (set.savesReporting) {
		const au = set.audio || {}, a11y = set.accessibility || {};
		const cbLabels = { off: "Off", redgreen: "Red–green", blueyellow: "Blue–yellow", mono: "Monochrome" };
		const tsLabels = { sm: "Small", md: "Medium", lg: "Large", xl: "Extra large" };
		out.push(sec("Settings & accessibility", \`what \${fmt(set.savesReporting)} caretakers have turned on\`, \`<div class="grid two">\` +
			cardTitled("Audio", "since the sound update", \`<div class="grid three">\${[
				kpi(\`<span class="accent">\${pct(au.musicOffPct)}</span>\`, "Music off", \`\${fmt(au.musicOff)} caretakers\`),
				kpi(pct(au.sfxOffPct), "SFX off", \`\${fmt(au.sfxOff)} caretakers\`),
				kpi(fmt(au.fullyMuted), "Fully muted"),
			].join("")}</div>\`) +
			cardTitled("Accessibility options", "how many have each on", \`<div class="grid three">\${[
				kpi(fmt(a11y.reduceMotion), "Reduce motion"),
				kpi(fmt(a11y.colorblindOn), "Colorblind aid"),
				kpi(fmt(a11y.dyslexiaFont), "Dyslexia font"),
			].join("")}</div><div style="margin-top:1rem">\${barRows(objToEntries(a11y.textScales || {}), { labelMap: tsLabels, cls: "sky" })}</div>\`) +
			\`</div>\` +
			(a11y.colorblindOn ? \`<div class="card" style="margin-top:.8rem"><h3>Colorblind modes<span class="tag">among users of the aid</span></h3>\${barRows(objToEntries(a11y.colorblindModes || {}).filter(([k]) => k !== "off"), { labelMap: cbLabels, cls: "gold" })}</div>\` : "")));
	}

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

	/* ---- Player highlights — kept at the bottom ---- */
	if (charSection) out.push(charSection);

	document.getElementById("root").innerHTML = out.join("");
}

/* ------------------------------------------------------------------ *
 * Fetch + wire-up
 * ------------------------------------------------------------------ */
// Active dashboard filters (all server-side, applied to the whole report).
const FILTERS = { version: "all", edition: "all", platform: "all", versionMode: "exact" };

/** Grey out the "Range" selector unless a specific version is chosen. */
function syncVersionMode() {
	const wrap = document.getElementById("version-mode-wrap");
	const sel = document.getElementById("version-mode");
	if (!wrap || !sel) return;
	const off = FILTERS.version === "all";
	wrap.classList.toggle("is-off", off);
	sel.disabled = off;
	sel.value = FILTERS.versionMode;
}
const FILTER_CFG = [
	{ key: "version", el: "version-filter", list: "availableVersions", allLabel: "All versions", cap: (v) => v },
	{ key: "edition", el: "edition-filter", list: "availableEditions", allLabel: "All editions", cap: (v) => v.charAt(0).toUpperCase() + v.slice(1) },
	{ key: "platform", el: "platform-filter", list: "availablePlatforms", allLabel: "All platforms", cap: (v) => v.charAt(0).toUpperCase() + v.slice(1) },
];

/** Fill each filter dropdown from the response, preserving the active choices. */
function populateFilterOptions(filters) {
	if (!filters) return;
	for (const cfg of FILTER_CFG) {
		const sel = document.getElementById(cfg.el);
		const opts = filters[cfg.list];
		if (!sel || !Array.isArray(opts)) continue;
		sel.innerHTML = \`<option value="all">\${cfg.allLabel}</option>\` +
			opts.map((v) => \`<option value="\${esc(v)}">\${esc(cfg.cap(String(v)))}</option>\`).join("");
		sel.value = FILTERS[cfg.key] === "all" || opts.includes(FILTERS[cfg.key]) ? FILTERS[cfg.key] : "all";
		FILTERS[cfg.key] = sel.value;
	}
	// Restore the version range mode from the server echo, then sync the control.
	FILTERS.versionMode = filters.versionMode === "min" ? "min" : "exact";
	syncVersionMode();
}

async function load() {
	const root = document.getElementById("root");
	const gen = document.getElementById("generated");
	root.innerHTML = \`<div class="skeleton">Gathering the meadow’s numbers…</div>\`;
	try {
		// Exclude dev/test saves so they don't skew the numbers (matches the
		// server's ?exclude filter). Optional version/edition/platform each scope
		// the whole report server-side.
		let url = "../Metrics/?exclude=bailey_test";
		for (const cfg of FILTER_CFG) {
			if (FILTERS[cfg.key] && FILTERS[cfg.key] !== "all") url += \`&\${cfg.key}=\` + encodeURIComponent(FILTERS[cfg.key]);
		}
		// A specific version can be widened to "this version & newer" (min mode);
		// otherwise the report isolates the single selected version.
		if (FILTERS.version !== "all" && FILTERS.versionMode === "min") url += "&versionMode=min";
		const res = await fetch(url, { headers: { accept: "application/json" } });
		if (!res.ok) throw new Error(\`Metrics endpoint returned \${res.status}\`);
		const data = await res.json();
		populateFilterOptions(data.filters);
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
for (const cfg of FILTER_CFG) {
	const sel = document.getElementById(cfg.el);
	if (sel) sel.addEventListener("change", (e) => {
		FILTERS[cfg.key] = e.target.value;
		if (cfg.key === "version") syncVersionMode(); // enable/disable the range control
		load();
	});
}
const versionModeSel = document.getElementById("version-mode");
if (versionModeSel) versionModeSel.addEventListener("change", (e) => {
	FILTERS.versionMode = e.target.value === "min" ? "min" : "exact";
	if (FILTERS.version !== "all") load(); // moot while "All versions" is selected
});

// Open a player's breakdown modal when their highlight card is clicked or
// activated by keyboard. Delegated on #root, which persists across re-renders.
const rootEl = document.getElementById("root");
rootEl.addEventListener("click", (e) => {
	const card = e.target.closest && e.target.closest(".hlcard[data-pid]");
	if (card) openPlayerModal(card.getAttribute("data-pid"));
});
rootEl.addEventListener("keydown", (e) => {
	if (e.key !== "Enter" && e.key !== " ") return;
	const card = e.target.closest && e.target.closest(".hlcard[data-pid]");
	if (card) { e.preventDefault(); openPlayerModal(card.getAttribute("data-pid")); }
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closePlayerModal(); });

// expose for offline/unit rendering (jsdom smoke test)
window.__renderDashboard = render;
window.__openPlayerModal = openPlayerModal;
if (!window.__NO_AUTOLOAD) load();
<\/script>
</body>
</html>
`,ne=`0.2.2+2026-08-03T11:11:44.220Z`,re=class{constructor(e){this.buf=e}get length(){return this.buf.length}toString(e=`hex`){if(e===`base64`){let e=``;for(let t of this.buf)e+=String.fromCharCode(t);return typeof btoa<`u`?btoa(e):e}if(e===`utf8`)return new TextDecoder().decode(this.buf);let t=``;for(let e of this.buf)t+=e.toString(16).padStart(2,`0`);return t}at(e){return this.buf[e]}};function ie(e){let t=new Uint8Array(e),n=globalThis;if(n.crypto?.getRandomValues)n.crypto.getRandomValues(t);else for(let n=0;n<e;n++)t[n]=Math.floor(Math.random()*256);return t}function ae(e){return new re(ie(e))}function E(e,t,n){let r=`${t}::${e}`,i=new Uint8Array(n),a=2166136261;for(let e=0;e<n;e++){let t=r.charCodeAt(e%r.length)||e+1;a^=t,a=Math.imul(a,16777619)>>>0,a^=a>>>13,i[e]=(a^e*2654435761)&255}return new re(i)}function D(e,t){let n=e?.length??0;if(n!==(t?.length??-1))return!1;let r=0;for(let i=0;i<n;i++){let n=typeof e.at==`function`?e.at(i):e[i],a=typeof t.at==`function`?t.at(i):t[i];r|=n^a}return r===0}var oe=v.records.map(e=>e.id);function O(e){return Math.max(0,Math.round((q(e)?.playSeconds||0)*1e3)+(e?.clockOffsetMs||0))}var k=()=>{let e=typeof databases<`u`&&databases?databases.wildwillows:null;if(!e||!e.Player)throw new A(n(`server.err.dbStarting`),503);return e},A=class extends Error{constructor(e,t=400){super(e),this.statusCode=t}},se=(e,t,n)=>Math.max(t,Math.min(n,e));function ce(e){let t=2166136261;for(let n=0;n<e.length;n++)t^=e.charCodeAt(n),t=Math.imul(t,16777619);return t>>>0}function le(e){let t=e>>>0;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}function ue(e,t){let r=Number(e);if(!Number.isInteger(r)||r<=0)throw new A(n(`server.err.positiveWholeNumber`,{label:t}));return r}function j(e){return e?Object.values(e).reduce((e,t)=>e+(t||0),0):0}function de(e){return/end of buffer|buffer not reached|decod/i.test(String(e?.message||e))}async function fe(e,t){try{return await e.delete(t),!0}catch(e){if(!de(e))throw e}try{return await e.put({id:t}),await e.delete(t),!0}catch{return!1}}async function M(e,t){try{let n=await e.get(t);if(n)try{JSON.stringify({...n})}catch(e){if(de(e))throw e}return n}catch(n){if(de(n))return await fe(e,t),console.error(`purged undecodable record: ${t}`),null;throw n}}async function pe(e){let t=[];try{for await(let n of e)t.push(n)}catch(e){console.error(`scan: skipping undecodable record(s) —`,e?.message||e)}return t}async function N(e){return!e||typeof e.search!=`function`?[]:pe(e.search({}))}async function P(e,t){return!e||typeof e.search!=`function`?[]:(await pe(e.search({}))).filter(e=>e?.playerId===t)}function F(e){return e?.worldId||e?.id}async function I(e,t){return!e||typeof e.search!=`function`?[]:(await pe(e.search({}))).filter(e=>(e?.worldId??e?.playerId)===t)}async function me(e,t,n){return(await I(e,t)).find(e=>e.id===n)||null}async function he(e,t,n,r,i){return(await I(e,t)).find(e=>e.area===n&&e.x===r&&e.y===i)||null}async function L(e,t,n){return(await I(e,t)).find(e=>e.biomeId===n)||null}async function ge(e,t,n){return(await I(e,t)).find(e=>e.animalId===n)||null}function _e(){let e=``;for(let t=0;t<6;t++)e+=`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`[Math.floor(Math.random()*32)];return e}var R=6;async function z(e,t={}){let r=k(),i=e.id;await r.World.get(i)||await r.World.put({id:i,name:e.name?n(`server.world.soloName`,{name:e.name}):n(`server.world.mySoloName`),solo:!0,ownerId:e.id,joinCode:null,createdAt:e.createdAt||Date.now(),maxMembers:1,meadowShift:t.freshGrid?et:0,meadowShiftY:t.freshGrid?tt:0});let a=`${i}:${e.id}`;await r.WorldMember.get(a)||await r.WorldMember.put({id:a,worldId:i,playerId:e.id,role:`owner`,joinedAt:e.createdAt||Date.now(),lastSeenAt:Date.now()}),e.worldId||await r.Player.patch(e.id,{worldId:i}),t.freshGrid||await nt(i)}async function ve(e){let t=k(),n=await P(t.WorldMember,e),r=[];for(let i of n){let n=await t.World.get(i.worldId);if(!n)continue;let a=(await I(t.WorldMember,n.id)).length;r.push({worldId:n.id,name:n.name,solo:!!n.solo,role:i.role,joinCode:n.solo?null:n.joinCode,memberCount:a,maxMembers:n.maxMembers||R,isOwner:n.ownerId===e})}return r.sort((e,t)=>e.solo===t.solo?0:e.solo?-1:1)}async function ye(e,t){let n=k(),r=await n.Player.get(e);if(!r)return[];let i=r.unlockedBiomes||[`meadow`];if(t===r.id)return i;let a=await I(n.BiomeState,t),o=new Set(i);for(let e of a)e.unlocked&&o.add(e.biomeId);let s=[...o];return s.length!==i.length&&await n.Player.patch(e,{unlockedBiomes:s}),s}var be=!1;async function xe(){if(be)return;be=!0;let t=k(),n=[[t.Biome,v.records],[t.Recipe,e.records],[t.HabitatObject,o.records],[t.ToolDef,s.records],[t.ResourceType,u.records],[t.Animal,[...p.records,...a.records]],[t.Achievement,i.records]];for(let[e,t]of n){let n=new Set(t.map(e=>e.id));for(let t of await pe(e.search({})))n.has(t.id)||await e.delete(t.id);for(let n of t)await e.put(n)}}var Se=null;async function B(){if(await xe(),!Se){let e=k(),[t,n,r,i,a,o,s]=await Promise.all([N(e.Biome),N(e.Animal),N(e.ResourceType),N(e.Recipe),N(e.HabitatObject),N(e.ToolDef),N(e.Achievement)]),c=e=>new Map(e.map(e=>[e.id,e]));s.sort((e,t)=>(e.order||0)-(t.order||0)),Se={biomes:t,animals:n,resources:r,recipes:i,objects:a,tools:o,achievements:s,biome:c(t),animal:c(n),resource:c(r),recipe:c(i),object:c(a),tool:c(o),achievement:c(s)}}return Se}var Ce=75,we=5,Te=`grasshopper`,Ee=100,V={biome:`meadow`,minHealth:30},H={cabin:{name:`Log Cabin`,floor:`#c8a064`,wall:`#5e3f29`,accent:`#b5707a`,materials:{branches:16,fiber:6},requires:V,perk:{id:`forage`,base:.1,perLevel:.05,cap:.6}},cottage:{name:`Meadow Cottage`,floor:`#e6d3a6`,wall:`#aab9c6`,accent:`#7fae6a`,materials:{wildflowers:6,fiber:10,clay:4},requires:V,perk:{id:`growth`,base:.1,perLevel:.04,cap:.5}},stone:{name:`Stone Hearth`,floor:`#a9a499`,wall:`#6f6a62`,accent:`#d98a4f`,materials:{stones:14,clay:6},requires:V,perk:{id:`thrift`,base:.1,perLevel:.05,cap:.6}}},U={style:`cabin`,space:1,comfort:1,decor:1,light:1,styleLocked:!1},W={space:{name:`Space`,blurb:`A bigger room with more floor to decorate.`,levels:[{inner:{w:6,h:5}},{inner:{w:8,h:6},materials:{branches:12,fiber:8},requires:{biome:`meadow`,minHealth:30}},{inner:{w:10,h:7},materials:{branches:18,stones:6,clay:6},requires:{biome:`forest`,minHealth:45}},{inner:{w:12,h:9},materials:{branches:24,clay:10,"clean-water":6},requires:{biome:`wetland`,minHealth:55}}]},comfort:{name:`Comfort`,blurb:`Carry more on every gathering trip (+capacity).`,levels:[{carry:0},{carry:45,materials:{fiber:10,branches:4},requires:{biome:`meadow`,minHealth:35}},{carry:95,materials:{fiber:14,moss:6},requires:{biome:`forest`,minHealth:50}},{carry:160,materials:{reeds:10,fiber:12},requires:{biome:`wetland`,minHealth:60}}]},decor:{name:`Furnishings`,blurb:`A finer rug and wall trim in your style.`,levels:[{},{materials:{fiber:8,wildflowers:4}},{materials:{fiber:12,berries:6},requires:{biome:`meadow`,minHealth:50}},{materials:{fiber:16,clay:6},requires:{biome:`forest`,minHealth:55}}]},light:{name:`Warmth`,blurb:`Windows and a warm hearth glow.`,levels:[{},{materials:{branches:6,stones:4}},{materials:{stones:8,clay:4},requires:{biome:`forest`,minHealth:45}},{materials:{clay:6,"clean-water":4},requires:{biome:`wetland`,minHealth:55}}]}};function G(e){if(e?.home)return{...U,...e.home};let t=e?.homeTier||1;return{...U,space:t,comfort:t,styleLocked:t>1}}var De=e=>W.comfort.levels[(G(e).comfort||1)-1]?.carry||0,Oe=5;function ke(e){let t=G(e);if(!t.styleLocked)return null;let n=H[t.style]?.perk;if(!n)return null;let r=(t.space||1)+(t.comfort||1)+(t.decor||1)+(t.light||1),i=Math.min(n.cap,n.base+n.perLevel*Math.max(0,r-Oe));return{id:n.id,strength:i}}function Ae(e){let t=W.space.levels[(G(e).space||1)-1]?.inner||{w:8,h:6},n=Math.floor((gt-t.w)/2),r=Math.floor((_t-t.h)/2);return{x0:n,y0:r,x1:n+t.w-1,y1:r+t.h-1}}var je={w:6,h:5};function Me(e){let t=/^tent-([a-z][a-z-]*)$/.exec(String(e||``));return t?t[1]:null}function Ne(){let e=Math.floor((gt-je.w)/2),t=Math.floor((_t-je.h)/2);return{x0:e,y0:t,x1:e+je.w-1,y1:t+je.h-1}}var Pe=.75,Fe={1:200,2:350,3:550,4:800},Ie={water:6,wildflowers:1},Le={basket:1,shovel:1,"watering-can":1,"field-journal":1},Re=[`#f6d7b8`,`#eec39a`,`#d9a06b`,`#b97f50`,`#8d5a3a`,`#6b4226`],ze=[`#3b2e25`,`#6e4a33`,`#a3692f`,`#c9913f`,`#d9b380`,`#8c8c8c`],Be=[`#4a7c59`,`#7a9ac0`,`#b5707a`,`#c9913f`,`#7d6b9e`,`#5d8a8a`],Ve=[`straw`,`leaf`,`beanie`,`cap`,`bucket`,`flower`,`party`,`ranger`,`mushroom`,`wizard`,`crown`,`bandana`,`none`],He=[`#c9a35c`,`#b5707a`,`#5f86b0`,`#5d8a4a`,`#7d6b9e`,`#b05555`],Ue=[`short`,`bald`,`long`,`bob`,`curly`,`curly-long`,`bun`,`braid`,`ponytail`,`pigtails`,`afro`,`mohawk`],We=[`none`,`beard`],Ge=[`slim`,`round`];function Ke(e,t){return typeof e==`string`&&/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(e.trim())?e.trim().toLowerCase():t}function qe(e){return e||={},{skin:Ke(e.skin,Re[1]),hair:Ke(e.hair,ze[1]),outfit:Ke(e.outfit,Be[0]),hat:Ve.includes(e.hat)?e.hat:`straw`,hatColor:typeof e.hatColor==`string`&&/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(e.hatColor.trim())?e.hatColor.trim().toLowerCase():null,hairstyle:Ue.includes(e.hairstyle)?e.hairstyle:`short`,beard:We.includes(e.beard)?e.beard:`none`,body:Ge.includes(e.body)?e.body:`slim`}}function Je(e){if(!e)return e;let{passcode:t,passcodeHash:n,passcodeSalt:r,...i}=e;return i.metrics!==void 0&&(i.metrics=q(e)),i.daily!==void 0&&(i.daily=at(e)),i}function Ye(e,t){let n=t||ae(16).toString(`hex`);return{salt:n,hash:E(String(e),n,32).toString(`hex`)}}function Xe(e,t,n){try{let r=globalThis.Buffer,i=E(String(e),t,32),a=r.from(n,`hex`);return i.length===a.length&&D(i,a)}catch{return!1}}async function Ze(e,t){let n=String(t||``);if(e.passcodeHash&&e.passcodeSalt)return Xe(n,e.passcodeSalt,e.passcodeHash);if(typeof e.passcode==`string`&&n.length>0&&n===e.passcode){let{salt:t,hash:r}=Ye(n);return await k().Player.patch(e.id,{passcodeHash:r,passcodeSalt:t,passcode:null}),!0}return!1}function Qe(e){return String(e).trim().toLowerCase().replace(/[^a-z0-9]+/g,`-`).replace(/^-+|-+$/g,``)}var $e={x:23,y:5,size:`small-chest`,capacity:120},et=14,tt=0;async function nt(e){let t=k(),n=await M(t.World,e);if(!n)return!1;let r=typeof n?.meadowShift==`number`?n.meadowShift:0,i=typeof n?.meadowShiftY==`number`?n.meadowShiftY:0,a=et-r,o=tt-i;if(a!==0||o!==0){for(let n of[t.Placement,t.TerrainTile,t.Chest])for(let t of await I(n,e))t.area===`meadow`&&await n.patch(t.id,{x:(Number(t.x)||0)+a,y:(Number(t.y)||0)+o});for(let n of await I(t.WorldMember,e)){let r=await M(t.Player,n.playerId);r?.area===`meadow`&&F(r)===e&&await t.Player.patch(r.id,{x:(Number(r.x)||0)+a,y:(Number(r.y)||0)+o})}}return n&&(r!==et||i!==tt)&&await t.World.patch(e,{meadowShift:et,meadowShiftY:tt}),a!==0||o!==0}async function K(e){if(!e||typeof e!=`string`)throw new A(n(`server.err.playerIdRequired`));let t=await M(k().Player,e);if(!t)throw new A(n(`server.err.noSaveLogin`),404);return{player:t}}function rt(e){return{firstSeenAt:e,lastSeenAt:e,lastHeartbeatAt:0,playSeconds:0,sessions:0,counts:{},areaSeconds:{},curSessionSeconds:0,sessionLengths:{},firstActionAt:0,creationMs:0}}function q(e){let t=e?.metrics;if(t==null)return null;if(typeof t==`string`)try{return JSON.parse(t)}catch{return null}return t}function it(e){return JSON.stringify(e??{})}function at(e){let t=e?.daily;if(t==null)return null;if(typeof t==`string`)try{return JSON.parse(t)}catch{return null}return t}function ot(e){return JSON.stringify(e??{})}var st=new Set([`recolors`,`appearanceChanges`]);function ct(e){let t=e/60;return t<2?`<2m`:t<10?`2-10m`:t<30?`10-30m`:`30m+`}async function J(e,t={},n={}){if(!e?.id)return null;let r=Object.entries(t).filter(([,e])=>e),i=Object.entries(n).filter(([,e])=>e);if(!r.length&&!i.length)return q(e);let a=Date.now(),o=await k().Player.get(e.id)||e,s=q(o)||rt(o.createdAt||a),c={...s.counts||{}};for(let[e,t]of r)c[e]=(c[e]||0)+t;let l={...s,counts:c,lastSeenAt:a};!s.firstActionAt&&r.some(([e,t])=>t&&!st.has(e))&&(l.firstActionAt=a);let u={metrics:it(l)};if(i.length){let e=pt(o,a),t=at(o),n={...(t?.dayKey===e?t:{dayKey:e,counts:{}}).counts||{}};for(let[e,t]of i)n[e]=(n[e]||0)+t;u.daily=ot({dayKey:e,counts:n})}return await k().Player.patch(e.id,u),l}var lt=864e5,ut=4,dt=e=>(Number.isFinite(e?.tzOffsetMinutes)?e.tzOffsetMinutes:0)*6e4,ft=e=>{let t=Math.round(Number(e));return Number.isFinite(t)?se(t,-840,840):0};function pt(e,t){return Math.floor((t+dt(e)-ut*36e5)/lt)}var Y=e=>Math.round(e*10)/10;function mt(e){let t=Date.now(),n=q(e)||rt(e.createdAt||t),r=n.playSeconds||0,i=n.sessions||0,a=n.counts||{},o=Object.entries(a).reduce((e,[t,n])=>e+(st.has(t)?0:n||0),0),s=e.createdAt||n.firstSeenAt||t,c=n.lastSeenAt||null,l=n.areaSeconds||{},u={};for(let[e,t]of Object.entries(l))u[e]=Math.round((t||0)/60);let d=Object.entries(l).sort((e,t)=>(t[1]||0)-(e[1]||0))[0]?.[0]||null,f=n.firstActionAt||0,p=f?Y((f-s)/1e3):null,m=n.creationMs||0,h=c?Y((t-c)/36e5):null,g=Math.floor((t-s)/lt),_=`dormant`;return h!=null&&(h<=24?_=`active`:h<=168&&(_=`recent`)),{playerId:e.id,name:e.name,createdAt:s,firstSeenAt:n.firstSeenAt||s,lastSeenAt:c,daysSinceJoined:g,hoursSinceActive:h,status:_,isNewToday:t-s<=lt,language:n.language||null,sessions:i,playSeconds:r,playMinutes:Math.round(r/60),avgSessionMinutes:i?Math.round(r/60/i):0,totalActions:o,actionsPerSession:i?Y(o/i):0,actionsPerMinute:r>0?Y(o/(r/60)):0,tutorialStep:e.tutorialStep||0,currentArea:e.area||null,unlockedBiomes:(e.unlockedBiomes||[]).length,areaSeconds:l,areaMinutes:u,mostTimeArea:d,sessionLengths:n.sessionLengths||{},timeToFirstActionSeconds:p,creationMs:m,creationSeconds:m?Y(m/1e3):null,appearance:e.appearance||null,counts:a}}function ht(e,t,n){let r=e.counts||{};return{collected:(r.resourcesCollected||0)>0,terraformed:(r.terraformActions||0)>0,planted:(r.plantsPlanted||0)>0,crafted:(r.itemsCrafted||0)>0||Object.keys(n.craftedEver||{}).length>0,placed:(r.objectsPlaced||0)>0,attractedAnimal:(t?.totalAnimalsReturned||0)>0,upgradedTool:(r.toolsUpgraded||0)>0,builtHome:(r.homesBuilt||0)>0,upgradedHome:(r.homeUpgrades||0)>0,unlockedSecondBiome:(e.unlockedBiomes||0)>=2}}var gt=30,_t=20,vt=8;function yt(e,t){let n=t===`home`?null:e.biome.get(t)?.grid;return{cols:n?.cols||gt,rows:(n?.rows||_t)+(t===`alpine`?vt:0)}}var bt={tilled:`#8a6a48`,watered:`#6b4f33`,water:`#5d96c8`};function xt(e,t,n){let r=parseInt(e.slice(1),16),i=parseInt(t.slice(1),16),a=e=>{let t=r>>e&255,a=i>>e&255;return Math.round(t+(a-t)*se(n,0,1))};return`#`+[a(16),a(8),a(0)].map(e=>e.toString(16).padStart(2,`0`)).join(``)}var St=e=>String(e).replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`);function Ct(e,t,n,r,i){let a=yt(e,t?.id||``),o=a.cols*16+16,s=a.rows*16+16+22,c=t?.palette?.damaged||`#b9a37c`,l=t?.palette?.healthy||`#8fbf6f`,u=xt(c,l,n/100),d=xt(c,l,n/100*.8),f=e=>8+e*16,p=e=>8+e*16,m=[];m.push(`<rect x="0" y="0" width="${o}" height="${s}" rx="10" fill="${u}"/>`);for(let e=0;e<a.rows;e++)for(let t=0;t<a.cols;t++)(t+e)%2==0&&m.push(`<rect x="${f(t)}" y="${p(e)}" width="16" height="16" fill="${d}" opacity="0.22"/>`);for(let e of i){let t=bt[e.type];t&&m.push(`<rect x="${f(e.x)}" y="${p(e.y)}" width="16" height="16" rx="3" fill="${t}"/>`)}for(let t of r){let n=e.object.get(t.objectId)?.color||`#6b5a3a`;m.push(`<circle cx="${f(t.x)+16/2}" cy="${p(t.y)+16/2}" r="6.72" fill="${n}" stroke="#2b3321" stroke-opacity="0.35"/>`)}return m.push(`<rect x="0" y="${s-22}" width="${o}" height="22" fill="#2b3321" opacity="0.55"/>`),m.push(`<text x="8" y="${s-7}" font-family="sans-serif" font-size="12" fill="#fdfaf0">${St(t?.name||`Area`)} — ${n}% health · ${r.length} placed</text>`),`<svg xmlns="http://www.w3.org/2000/svg" width="${o}" height="${s}" viewBox="0 0 ${o} ${s}">${m.join(``)}</svg>`}function wt(e){return`data:image/svg+xml;base64,`+globalThis.Buffer.from(e,`utf8`).toString(`base64`)}async function Tt(e,t={}){let n=k(),r=await B(),i=await P(n.BiomeState,e),a=new Map(i.map(e=>[e.biomeId,e])),o=t.images?await P(n.Placement,e):[],s=t.images?await P(n.TerrainTile,e):[],c=r.biomes.map(e=>{let n=a.get(e.id)||{},i={biomeId:e.id,name:e.name,health:n.health||0,balance:n.balance||0,returnedCount:n.returnedCount||0,unlocked:!!n.unlocked,explorable:!!e.explorable};if(t.images&&n.unlocked){let t=o.filter(t=>t.area===e.id),n=s.filter(t=>t.area===e.id);i.placements=t.length,i.snapshot=wt(Ct(r,e,i.health,t,n))}return i});return{biomes:c,summary:Et(c)}}function Et(e){let t=e.filter(e=>e.unlocked);return{biomesUnlocked:t.length,biomesFullyRestored:t.filter(e=>(e.health||0)>=100).length,avgHealth:t.length?Math.round(t.reduce((e,t)=>e+(t.health||0),0)/t.length):0,totalAnimalsReturned:e.reduce((e,t)=>e+(t.returnedCount||0),0)}}async function Dt(e,t,n,r,i=0,a=0,o=`full`){let s=k(),c=await B(),l=Date.now(),{salt:u,hash:d}=Ye(n),f={id:e,name:t,passcodeSalt:u,passcodeHash:d,appearance:r,tzOffsetMinutes:i,createdAt:l,clockOffsetMs:h(0,`day`),worldId:e,area:`meadow`,x:24.5,y:6.5,inventory:{...Ie},craftedItems:{},tools:{...Le},unlockedBiomes:[`meadow`],visitedBiomes:[`meadow`],tutorialStep:0,home:{...U},metrics:it({...rt(l),creationMs:a>0?Math.round(a):0,edition:o}),customGoals:[]};await s.Player.put(f);let p=e,m=c.biomes.map(t=>({id:`${p}:${t.id}`,worldId:p,playerId:e,biomeId:t.id,health:we,balance:0,returnedCount:0,unlocked:t.id===`meadow`}));for(let e of m)await s.BiomeState.put(e);let g=`pl_${e}_starter-chest`,_=[{id:g,worldId:p,playerId:e,objectId:`small-chest`,area:`meadow`,x:$e.x,y:$e.y,placedAt:l}];for(let e of _)await s.Placement.put(e);let v={id:g,worldId:p,playerId:e,area:`meadow`,x:$e.x,y:$e.y,size:`small-chest`,capacity:$e.capacity,contents:{}};return await s.Chest.put(v),{player:f,seeded:{biomeStates:m,placements:_,chests:[v]}}}async function Ot(e){let t=Date.now(),n=await B(),r=e.player?.worldId||e.player?.id,i=O(e.player);return{player:Je(e.player),biomeStates:e.seeded.biomeStates,placements:e.seeded.placements,chests:e.seeded.chests,discoveries:[],nodeStates:[],terrain:[],achievements:[],feed:[],serverTime:t,weather:l(r,i,oe),dailyTasks:wn({wid:r,player:e.player,d:n,discoveries:[],biomeStates:e.seeded.biomeStates,placements:e.seeded.placements,chests:e.seeded.chests,now:t}),customGoals:e.player.customGoals||[],goalLimit:on(e.player,n),nodeRegenSeconds:Ce,inventoryCapacity:kt(e.player)}}function kt(e){return(Fe[e.tools?.basket||1]||200)+De(e)}function At(e,t){let n=Date.now(),r={};for(let i of e){if(t&&i.plantedAt){let e=(t.object.get(i.objectId)?.growSeconds||0)*1e3;if(e>0&&n-i.plantedAt<e)continue}r[i.objectId]=(r[i.objectId]||0)+1}return r}var jt=90;function Mt(e){let t=95*(1-Math.exp(-Math.max(0,e)/jt));return se(Math.round(we+t),0,100)}var Nt=[{animals:5,cap:60},{animals:10,cap:75},{animals:15,cap:88}];function Pt(e){for(let t of Nt)if(e<t.animals)return t.cap;return 100}function Ft(e){return(e?.matureHours||0)*36e5}function It(e,t,n){let r=Ft(e);return r>0&&n-(t.placedAt||0)>=r}function Lt(e,t,n,r){let i=Ft(e);if(i<=0)return!1;let a=(t.placedAt||0)+i;return a>n&&a<=r}var Rt=8;function zt(e,t,n=0,r=Date.now()){let i=0,a=0;for(let n of t){let t=e.object.get(n.objectId);t&&(i+=t.healthValue||0,It(t,n,r)&&(a+=t.matureBonus||0))}return i+=Math.min(a,Rt),n>0&&(i+=2*Math.min(n,7)),i}var Bt=.45,Vt=.35,Ht=.2;function Ut(e,t,n){let r=e.animals.filter(e=>e.biome===t),i=r.length;if(i===0)return 0;let a=r.filter(e=>n.has(e.id));if(a.length>=i)return 100;let o=a.length/i,s=r.filter(e=>(e.requirements?.animals||[]).length>0),c=s.filter(e=>n.has(e.id)).length,l=s.length?c/s.length:1,u=new Set(r.map(e=>e.kind)),d=new Set(a.map(e=>e.kind)),f=u.size?d.size/u.size:0,p=Bt*o+Vt*l+Ht*f;return se(Math.round(p*100),0,99)}function Wt(e,t=!1){let n=new Set(e.filter(e=>e.type===`water`&&(!t||!e.seeded)).map(e=>`${e.x},${e.y}`)),r=new Set,i=0,a=0;for(let e of n){if(r.has(e))continue;let t=[e];r.add(e);let o=0,s=1/0,c=-1/0,l=1/0,u=-1/0;for(;t.length;){let[e,i]=t.pop().split(`,`).map(Number);o++,s=Math.min(s,e),c=Math.max(c,e),l=Math.min(l,i),u=Math.max(u,i);for(let[a,o]of[[1,0],[-1,0],[0,1],[0,-1]]){let s=`${e+a},${i+o}`;n.has(s)&&!r.has(s)&&(r.add(s),t.push(s))}}i=Math.max(i,o),a=Math.max(a,Math.max(c-s+1,u-l+1))}return{tiles:n.size,lake:i,river:a}}function Gt(e,t){let n=e.requirements?.conditions;return!n||!(!t||Array.isArray(n.weather)&&n.weather.length&&!n.weather.includes(t.type)||Array.isArray(n.season)&&n.season.length&&!n.season.includes(t.season)||Array.isArray(n.dayPhase)&&n.dayPhase.length&&!n.dayPhase.includes(t.dayPhase))}function Kt(e,t,n,r,i,a,o=null){let s=e.requirements||{};if(t<(s.minHealth||0)||n<(s.minBalance||0)||!Gt(e,o))return!1;for(let[e,t]of Object.entries(s.objects||{}))if((r[e]||0)<t)return!1;for(let e of s.animals||[])if(!i.has(e))return!1;let c=s.water;return!(c&&((a.tiles||0)<(c.tiles||0)||(a.lake||0)<(c.lake||0)||(a.river||0)<(c.river||0)))}function qt(e,t){let n=e.requirements?.objects||{},r=Object.keys(n);if(!r.length)return 70;let i=30,a=0,o=0;for(let[e,s]of Object.entries(n)){let n=t[e]||0;n>=s?(i+=Math.round(30/r.length),o+=n-s):a++}return i+=Math.round(40*(1-Math.exp(-o/6))),i-=a*25,se(i,5,100)}function Jt(e,t){let r=e.requirements||{},i=[],a=Object.entries(r.objects||{}).map(([e,r])=>n(`server.whyReturned.objectQty`,{qty:r,name:t.object.get(e)?.name||e}));if(a.length&&i.push(n(`server.whyReturned.habitat`,{objects:a.join(n(`server.list.comma`))})),r.water){let e=r.water;e.lake?i.push(n(`server.whyReturned.lake`,{tiles:e.lake})):e.river?i.push(n(`server.whyReturned.river`,{tiles:e.river})):e.tiles&&i.push(n(`server.whyReturned.tiles`,{tiles:e.tiles}))}r.minHealth&&i.push(n(`server.whyReturned.health`,{health:r.minHealth})),r.minBalance&&i.push(n(`server.whyReturned.balance`,{balance:r.minBalance})),r.animals?.length&&i.push(n(`server.whyReturned.animals`,{animals:r.animals.map(e=>t.animal.get(e)?.name||e).join(n(`server.list.and`))}));let o=r.conditions;if(o){let e=[];o.weather?.length&&e.push(o.weather.join(n(`server.list.or`))),o.season?.length&&e.push(n(`server.whyReturned.inSeason`,{seasons:o.season.join(n(`server.list.or`))})),o.dayPhase?.length&&e.push(n(`server.whyReturned.atPhase`,{phases:o.dayPhase.join(n(`server.list.or`))})),e.length&&i.push(n(`server.whyReturned.moment`,{conditions:e.join(n(`server.list.comma`))}))}return n(`server.whyReturned.sentence`,{reasons:i.join(n(`server.list.comma`))})}async function X(e,t,i,a={}){let o=k(),s=await B();if(!s.biome.get(i))throw new A(n(`server.err.unknownBiome`,{biome:i}));let c=(await I(o.Placement,e)).filter(e=>e.area===i);a.removeIds?.length&&(c=c.filter(e=>!a.removeIds.includes(e.id)));for(let e of a.addPlacements||[])e.area===i&&(c=c.filter(t=>t.id!==e.id),c.push(e));let l=At(c,s),u=(await I(o.TerrainTile,e)).filter(e=>e.area===i);a.removeTerrainIds?.length&&(u=u.filter(e=>!a.removeTerrainIds.includes(e.id)));for(let e of a.addTerrain||[])e.area===i&&(u=u.filter(t=>t.id!==e.id),u.push(e));let d=Math.min(3,u.filter(e=>e.type===`watered`).length)*.5,f=u.filter(e=>e.type===`water`&&!e.seeded).length,p=Wt(u),h=Mt(zt(s,c,f,Date.now())+d),g=a.player||await M(o.Player,t),v=g?O(g):null,y=v===null?null:{type:_(e,i,v),season:r(v),dayPhase:m(v)},b=await I(o.Discovery,e),x=new Set(b.map(e=>e.animalId)),S=()=>[...x].filter(e=>s.animal.get(e)?.biome===i).length,C=Math.min(h,Pt(S())),w=Ut(s,i,x),T=[],ee=s.animals.filter(e=>e.biome===i),te=x.has(Te);for(let n of ee)if(!x.has(n.id)&&!(!te&&n.id!==Te)&&Kt(n,C,w,l,x,p,y)){let r={id:`${e}:${n.id}`,worldId:e,playerId:t,animalId:n.id,biomeId:i,comfort:qt(n,l),timesObserved:0,firstObservedAt:Date.now(),whyReturned:Jt(n,s)};await o.Discovery.put(r),x.add(n.id),w=Ut(s,i,x),T.push({...r,animal:n});break}C=Math.min(h,Pt(S()));for(let e of b){if(e.biomeId!==i)continue;let t=s.animal.get(e.animalId);if(!t)continue;let n=qt(t,l);n!==e.comfort&&await o.Discovery.patch(e.id,{comfort:n})}let ne=S(),re=await L(o.BiomeState,e,i),ie=re?.id??`${e}:${i}`;await o.BiomeState.patch(ie,{health:C,balance:w,returnedCount:ne});let ae={...re||{id:ie,worldId:e,playerId:t,biomeId:i,unlocked:i===`meadow`},health:C,balance:w,returnedCount:ne},E=C-(re?.health??we),D={};if(E>0&&(D[`health:${i}`]=E),T.length&&(D[`animal:${i}`]=T.length,D.animal=T.length),Object.keys(D).length){let e=a.player||await o.Player.get(t);e&&await J(e,{},D)}return{biomeState:ae,newAnimals:T,unlockedBiomes:await Zt(e,t,{player:a.player,freshState:ae})}}var Yt={wetland:[...[6,7,8,9,10,11,12,13,14].map(e=>({x:e,y:4,type:`water`})),{x:14,y:5,type:`water`},{x:14,y:6,type:`water`},{x:15,y:6,type:`water`},{x:20,y:6,type:`water`},{x:21,y:6,type:`water`},{x:22,y:6,type:`water`},{x:20,y:7,type:`water`},{x:21,y:7,type:`water`},{x:22,y:7,type:`water`},{x:10,y:14,type:`watered`},{x:11,y:14,type:`watered`}]};async function Xt(e,t,n){let r=Yt[n];if(!r)return;let i=k();for(let a of r){let r=`${e}:${n}:${a.x}:${a.y}`;await i.TerrainTile.get(r)||await i.TerrainTile.put({id:r,worldId:e,playerId:t,area:n,x:a.x,y:a.y,type:a.type,seeded:!0,updatedAt:Date.now()})}}async function Zt(e,t,n={}){let r=k(),i=await B(),a=n.player||await r.Player.get(t),o=[],s=new Set(a.unlockedBiomes||[]),c=new Set(a.pendingUnlockRewards||[]),l=new Set((await I(r.BiomeState,e)).filter(e=>e.unlocked).map(e=>e.biomeId));for(let u of i.biomes){if(!u.unlock||l.has(u.id))continue;let i=u.unlock,d=n.freshState?.biomeId===i.biome?n.freshState:await L(r.BiomeState,e,i.biome);if(!d||!l.has(i.biome)||(d.health||0)<(i.minHealth||0)||(d.returnedCount||0)<(i.minAnimals||0)||i.minTotalAnimals&&(await I(r.Discovery,e)).length<i.minTotalAnimals)continue;if(i.requiresItem){let e=a.craftedItems?.[i.requiresItem]||0,t=a.craftedEver?.[i.requiresItem]||0;if(e<=0&&t<=0)continue}if(i.requiresTool&&(a.tools?.[i.requiresTool.id]||1)<i.requiresTool.tier)continue;l.add(u.id),s.add(u.id),c.add(u.id),await r.Player.patch(t,{unlockedBiomes:[...s],pendingUnlockRewards:[...c]});let f=await L(r.BiomeState,e,u.id);await r.BiomeState.patch(f?.id??`${e}:${u.id}`,{unlocked:!0}),await Xt(e,t,u.id),o.push({id:u.id,name:u.name})}return o}function Qt(e,t){let n=e.unlock;return!n||!(typeof n.minHealth==`number`&&t.health<n.minHealth||typeof n.animalsReturned==`number`&&t.animalsReturned<n.animalsReturned||n.requiresAnimal&&!t.returnedAnimalIds.has(n.requiresAnimal)||n.requiresCrafted&&(t.craftedEver?.[n.requiresCrafted]||0)<=0)}async function $t(e,t,n,r){let i=k(),a=await L(i.BiomeState,e,t),o=await I(i.Discovery,e),s=new Set(o.filter(e=>r.animal.get(e.animalId)?.biome===t).map(e=>e.animalId));return{health:a?.health||0,animalsReturned:s.size,returnedAnimalIds:s,craftedEver:n.craftedEver||{}}}async function en(e,t,n,r){let i=await me(e.Chest,r,n);if(i)return i;let a=await me(e.Placement,r,n);if(a){let i=t.object.get(a.objectId);if(i?.isChest){let t={id:n,worldId:r,playerId:a.playerId,area:a.area,x:a.x,y:a.y,size:a.objectId,capacity:i.chestCapacity||60,contents:{}};return await e.Chest.put(t),t}}return null}async function tn(e,t,r=e.id){let i=k(),a=await I(i.Chest,r);for(let[r,i]of Object.entries(t)){let t=e.inventory?.[r]||0,o=a.reduce((e,t)=>e+(t.contents?.[r]||0),0);if(t+o<i)throw new A(n(`server.err.notEnough`,{resource:r,need:i,have:t+o}))}let o={inventory:{},chests:{}},s={...e.inventory||{}},c=new Map(a.map(e=>[e.id,{...e.contents||{}}]));for(let[e,r]of Object.entries(t)){let t=r,i=Math.min(s[e]||0,t);i>0&&(s[e]-=i,s[e]<=0&&delete s[e],o.inventory[e]=i,t-=i);for(let n of a){if(t<=0)break;let r=c.get(n.id),i=Math.min(r[e]||0,t);i>0&&(r[e]-=i,r[e]<=0&&delete r[e],o.chests[n.id]=o.chests[n.id]||{},o.chests[n.id][e]=i,t-=i)}if(t>0)throw new A(n(`server.err.notEnoughShort`,{resource:e}))}await i.Player.patch(e.id,{inventory:s});for(let e of a)o.chests[e.id]&&await i.Chest.patch(e.id,{contents:c.get(e.id)});return{usedFrom:o,inventory:s}}var nn={craft:`hammer`,build:`hammer`,grow:`leaf`,plant:`leaf`,collect:`basket`,observe:`journal`,welcome:`paw`,attract:`paw`,welcomeTotal:`paw`,home:`home`,tool:`hammer`,unlock:`map`,health:`leaf`,biomeAnimals:`paw`},rn=[`space`,`comfort`,`decor`,`light`],an=6;function on(e,t){let n=new Set(e?.unlockedBiomes||[`meadow`]);return t.biomes.filter(e=>e.explorable).every(e=>n.has(e.id))?6:3}function sn(e){let{d:t,biomeStates:r,discoveries:i,player:a}=e,o=new Map(r.map(e=>[e.biomeId,e]));for(let e of t.biomes){let r=e.unlock;if(!r||o.get(e.id)?.unlocked)continue;let s=o.get(r.biome);if(!s?.unlocked||!(a?.visitedBiomes||[`meadow`]).includes(r.biome))continue;let c=t.biome.get(r.biome)?.name||r.biome,l=t.biome.get(e.id)?.name||e.id,u=[];if(r.minHealth&&u.push({text:n(`server.nextbiome.health`,{biome:c,goal:r.minHealth,cur:Math.round(s.health||0)}),done:(s.health||0)>=r.minHealth}),r.minAnimals&&u.push({text:n(`server.nextbiome.animals`,{biome:c,goal:r.minAnimals,cur:s.returnedCount||0}),done:(s.returnedCount||0)>=r.minAnimals}),r.minTotalAnimals&&u.push({text:n(`server.nextbiome.total`,{goal:r.minTotalAnimals,cur:i.length}),done:i.length>=r.minTotalAnimals}),r.requiresItem){let e=t.object.get(r.requiresItem)?.name||r.requiresItem,i=(a?.craftedItems?.[r.requiresItem]||0)+(a?.craftedEver?.[r.requiresItem]||0);u.push({text:n(`server.nextbiome.craft`,{item:e}),done:i>0})}if(!u.length)return null;let d=u.filter(e=>e.done).length;return{id:`next-biome`,kind:`unlock`,icon:`map`,pinned:!0,text:n(`server.nextbiome.title`,{biome:l}),hint:n(`server.nextbiome.hint`,{biome:l}),target:u.length,progress:d,counter:``,reward:{},steps:u,claimed:!1}}return null}function cn(e,t){let r=t.d.animal.get(e);if(!r)return[];let i=(t.d.biome.get(r.biome)?.order||1)+1;if((t.player?.tools?.[`field-journal`]||1)<i)return[{text:n(`server.goal.upgradeGuide`),done:!1}];let a=[];for(let[e,i]of Object.entries(r.requirements?.objects||{})){let o=(t.placements||[]).filter(t=>t.objectId===e&&t.area===r.biome).length;a.push({text:n(`server.goal.habitatStep`,{have:Math.min(o,i),need:i,name:t.d.object.get(e)?.name||e}),done:o>=i})}if(r.requirements?.minHealth){let e=t.biomeStates.find(e=>e.biomeId===r.biome),i=Math.round(e?.health||0);a.push({text:n(`server.goal.healthStep`,{cur:i,need:r.requirements.minHealth}),done:i>=r.requirements.minHealth})}return a}function ln(e,t){return fn((t.d.recipes||[]).find(t=>t.output?.itemId===e)?.materials||{},t)}function un(e,t){return fn(H[e]?.materials||{},t)}function dn(e,t,n){return fn((n.d.tool.get(e)?.tiers||[]).find(e=>e.tier===t)?.materials||{},n)}function fn(e,t){return Object.entries(e).map(([e,r])=>{let i=gn(t,e);return{text:n(`server.goal.matStep`,{have:Math.min(i,r),need:r,name:t.d.resource.get(e)?.name||e}),done:i>=r}})}function pn(e){let n=(e.unlockedBiomes?.length?e.unlockedBiomes:e.player?.unlockedBiomes?.length?e.player.unlockedBiomes:[`meadow`]).flatMap(t=>e.d.biome.get(t)?.resources||[]);return[...new Set(n)].filter(n=>n!==`water`&&!t(n)&&e.d.resource.get(n))}function mn(e,t){let n=pn(e),r={};if(!n.length)return r;let i=le(ce(`goalreward:${t}`)),a=[...n];for(let e=0;e<2&&a.length;e++){let e=a.splice(Math.floor(i()*a.length),1)[0];r[e]=3+Math.floor(i()*3)}return r}function hn(e,n){let r=(e.d.biome.get(n)?.resources||[]).filter(n=>n!==`water`&&!t(n)&&e.d.resource.get(n)),i={};if(!r.length)return i;let a=le(ce(`unlockreward:${n}`)),o=[...r];for(let e=0;e<2&&o.length;e++){let e=o.splice(Math.floor(a()*o.length),1)[0];i[e]=4+Math.floor(a()*3)}return i}function gn(e,t){return(e.player?.inventory?.[t]||0)+(e.chests||[]).reduce((e,n)=>e+(n.contents?.[t]||0),0)}function _n(e,t){return(e.placements||[]).filter(e=>e.objectId===t).length}function vn(e,t){return(e.placements||[]).filter(e=>e.objectId===t&&typeof e.plantedAt==`number`).length}function yn(e,t){switch(e.kind){case`craft`:case`build`:return t.player?.craftedEver?.[e.itemId||``]||0;case`grow`:return vn(t,e.itemId||``);case`plant`:return(t.placements||[]).filter(e=>typeof e.plantedAt==`number`).length;case`collect`:return gn(t,e.resourceId||``);case`observe`:return t.discoveries.filter(e=>(e.timesObserved||0)>0).length;case`welcomeTotal`:return t.discoveries.length;default:return 0}}function bn(e,t){switch(e.kind){case`craft`:case`grow`:case`plant`:case`collect`:case`observe`:case`welcomeTotal`:return Math.max(0,Math.min(e.target,yn(e,t)-(e.base||0)));case`build`:return Math.max(0,Math.min(e.target,(t.player?.craftedEver?.[e.itemId||``]||0)-(e.base||0)))+Math.max(0,Math.min(e.target,_n(t,e.itemId||``)-(e.basePlace||0)));case`welcome`:case`attract`:return+!!t.discoveries.some(t=>t.animalId===e.animalId);case`home`:if(e.track===`build`){let n=t.player?.home;return n?.styleLocked?+(!e.styleId||n.style===e.styleId):0}return t.player?.home?.[e.track||``]>=e.target?e.target:Math.min(e.target,t.player?.home?.[e.track||``]||1);case`tool`:{let n=t.player?.tools?.[e.toolId||``]||1;return Math.min(e.target,n)}case`unlock`:return+!!t.biomeStates.some(t=>t.biomeId===e.biomeId&&t.unlocked);case`health`:{let n=t.biomeStates.find(t=>t.biomeId===e.biomeId);return Math.min(e.target,Math.round(n?.health||0))}case`biomeAnimals`:{let n=t.discoveries.filter(t=>t.biomeId===e.biomeId).length;return Math.min(e.target,n)}default:return 0}}function xn(e,t){let r=t.d;switch(e.kind){case`craft`:return n(`server.goal.craft`,{count:e.target,item:r.object.get(e.itemId)?.name||e.itemId});case`build`:return n(`server.goal.build`,{count:e.target,item:r.object.get(e.itemId)?.name||e.itemId});case`grow`:return n(`server.goal.grow`,{count:e.target,item:r.object.get(e.itemId)?.name||e.itemId});case`plant`:return n(`server.goal.plant`,{count:e.target});case`collect`:return n(`server.goal.collect`,{count:e.target,resource:r.resource.get(e.resourceId)?.name||e.resourceId});case`observe`:return n(`server.goal.observe`,{count:e.target});case`welcome`:return n(`server.goal.welcome`,{animal:r.animal.get(e.animalId)?.name||e.animalId});case`attract`:return n(`server.goal.attract`,{kind:r.animal.get(e.animalId)?.kind||n(`server.goal.creature`)});case`welcomeTotal`:return n(`server.goal.welcomeTotal`,{count:e.target});case`home`:return e.track===`build`?n(`server.goal.buildHome`,{style:H[e.styleId||``]?.name||n(`server.goal.aHouse`)}):n(`server.goal.home`,{track:n(`server.goal.track.${e.track}`),level:e.target});case`tool`:{let t=r.tool.get(e.toolId),i=(t?.tiers||[]).find(t=>t.tier===e.target);return n(`server.goal.tool`,{tool:i?.name||t?.name||e.toolId})}case`unlock`:return n(`server.goal.unlock`,{biome:r.biome.get(e.biomeId)?.name||e.biomeId});case`health`:return n(`server.goal.restore`,{biome:r.biome.get(e.biomeId)?.name||e.biomeId,pct:e.target});case`biomeAnimals`:return n(`server.goal.biomeAnimals`,{count:e.target,biome:r.biome.get(e.biomeId)?.name||e.biomeId});default:return``}}function Sn(e){let t=e.discoveries.some(e=>e.animalId===Te),r=Object.keys(e.player?.craftedEver||{}).length>0;return[{id:`start-gather`,kind:`gather`,icon:`basket`,text:n(`server.task.collectSeeds`),hint:n(`server.task.gatherHint`),target:12,progress:Math.min(12,gn(e,`seeds`))},{id:`start-craft`,kind:`craft`,icon:`hammer`,text:n(`server.task.craftFirst`),hint:n(`server.task.craftFirstHint`),target:1,progress:+!!r},{id:`start-welcome`,kind:`welcome`,icon:`sparkle`,text:n(`server.task.welcomeGrasshopper`),hint:n(`server.task.welcomeGrasshopperHint`),target:1,progress:+!!t}]}function Cn(e,t){let n=[],r=[`craft`,`build`,`grow`,`plant`,`collect`,`observe`,`welcome`,`attract`,`welcomeTotal`,`home`,`tool`,`unlock`,`health`,`biomeAnimals`],i=!1;for(let a of Array.isArray(e)?e:[]){if(n.length>=an)break;let e=a?.kind;if(!r.includes(e))continue;if(e===`home`){if(i)continue;i=!0}let o={id:typeof a?.id==`string`&&a.id?a.id.slice(0,40):`cg_${Math.random().toString(36).slice(2,10)}`,kind:e,target:Math.max(1,Math.min(99,Math.floor(Number(a?.target)||1)))};if(e===`craft`||e===`build`||e===`grow`){if(!t.object.get(a?.itemId))continue;o.itemId=a.itemId}else if(e===`collect`){if(!t.resource.get(a?.resourceId))continue;o.resourceId=a.resourceId}else if(e===`welcome`||e===`attract`){if(!t.animal.get(a?.animalId))continue;o.animalId=a.animalId,o.target=1}else if(e===`home`)if(a?.track===`build`){if(!H[a?.styleId])continue;o.track=`build`,o.styleId=a.styleId,o.target=1}else{if(!rn.includes(a?.track))continue;o.track=a.track}else if(e===`tool`){let e=t.tool.get(a?.toolId);if(!e)continue;let n=Math.max(1,...(e.tiers||[]).map(e=>e.tier));o.toolId=a.toolId,o.target=Math.min(n,Math.max(2,Math.floor(Number(a?.target)||2)))}else if(e===`unlock`){if(!t.biome.get(a?.biomeId))continue;o.biomeId=a.biomeId,o.target=1}else if(e===`health`){if(!t.biome.get(a?.biomeId))continue;o.biomeId=a.biomeId,o.target=Math.max(1,Math.min(100,Math.floor(Number(a?.target)||100)))}else if(e===`biomeAnimals`){if(!t.biome.get(a?.biomeId))continue;let e=t.animals.filter(e=>e.biome===a.biomeId).length;if(e<=0)continue;o.biomeId=a.biomeId,o.target=e}n.push(o)}return n}function wn(e){let{player:t,now:r,d:i}=e,a=pt(t,r),o=t?.goalClaims||{},s=[],c=t?.pendingUnlockRewards||[];if(!c.length){let t=sn(e);t&&s.push(t)}for(let t of c){let r=i.biome.get(t)?.name||t;s.push({id:`unlock-reward:${t}`,kind:`unlock`,icon:`sparkle`,text:n(`server.unlockreward.title`,{biome:r}),hint:n(`server.unlockreward.hint`,{biome:r}),target:1,progress:1,counter:``,reward:hn(e,t),claimed:!1})}for(let t of Sn(e))o[t.id]||s.push({...t,counter:``,reward:mn(e,t.id),claimed:!1});for(let r of t?.customGoals||[]){if(o[r.id])continue;let t=r.kind===`build`?r.target*2:r.target,i=r.kind===`attract`?cn(r.animalId||``,e):r.kind===`craft`||r.kind===`build`?ln(r.itemId||``,e):r.kind===`home`&&r.track===`build`?un(r.styleId||``,e):r.kind===`tool`?dn(r.toolId||``,r.target,e):void 0;s.push({id:r.id,kind:r.kind,icon:nn[r.kind]||`check`,text:xn(r,e),target:t,counter:``,reward:mn(e,r.id),progress:bn(r,e),claimed:!1,hint:n(`server.goal.hint.${r.kind}`),...i?{steps:i}:{}})}return{dayKey:a,endsAt:0,tasks:s}}async function Tn(e,t={}){let n=k(),r=await B(),i=await M(n.Player,e),a=r.biome.get(i?.area),o=Me(i?.area),s=o?!!r.biome.get(o)?.explorable:!1;i&&i.area!==`home`&&!s&&(!a||!a.explorable)&&(i={...i,area:`meadow`,x:24.5,y:6.5});let c=t.worldId||F(i),[u,d,f,p,m,h,g,_]=await Promise.all([I(n.BiomeState,c),I(n.Placement,c),I(n.Chest,c),I(n.Discovery,c),I(n.NodeState,c),I(n.TerrainTile,c),P(n.PlayerAchievement,e),I(n.FeedEntry,c)]),v=[...i?.unlockedBiomes?.length?i.unlockedBiomes:[`meadow`]];if(i&&c!==i.id){let e=new Set(i.unlockedBiomes||[`meadow`]);for(let t of u)t.unlocked&&e.add(t.biomeId);i={...i,unlockedBiomes:[...e]}}let y=Date.now(),b=O(i);return{player:Je(i),worldId:c,biomeStates:u,placements:d,chests:f,discoveries:p,nodeStates:m,terrain:h,achievements:[...g].sort((e,t)=>(t.earnedAt||0)-(e.earnedAt||0)).map(e=>e.achievementId),feed:[..._].sort((e,t)=>(e.at||0)-(t.at||0)).slice(-100).map(e=>({id:e.id,at:e.at,icon:e.icon,text:e.text})),serverTime:y,weather:l(c,b,oe,i?.devWeather||null),dailyTasks:wn({wid:c,player:i,d:r,discoveries:p,biomeStates:u,placements:d,chests:f,now:y,unlockedBiomes:v}),customGoals:i?.customGoals||[],goalLimit:on(i,r),nodeRegenSeconds:Ce,inventoryCapacity:kt(i)}}async function Z(e){let t=await e;if(!t||typeof t!=`object`)throw new A(n(`server.err.bodyRequired`));return t}var En={"welcome-grasshopper":e=>!!e.disc(`grasshopper`),forager:e=>(e.counts.resourcesCollected||0)>=100,"makers-hands":e=>(e.counts.itemsCrafted||0)>=10,"green-thumb":e=>(e.counts.plantsPlanted||0)>=10,waterworks:e=>(e.counts.terraformActions||0)>=15,"meadow-first-bloom":e=>e.returned(`meadow`)>=8,"meadow-pollinators":e=>e.kindReturned(`meadow`,`insect`)>=5,"meadow-apex":e=>!!e.disc(`red-fox-meadow`),"meadow-mender":e=>e.health(`meadow`)>=80,"meadow-reborn":e=>e.returned(`meadow`)>=25,"forest-understory":e=>e.returned(`forest`)>=10,"forest-cavities":e=>!!e.disc(`pileated-woodpecker`)&&(!!e.disc(`wood-duck`)||!!e.disc(`northern-flying-squirrel`)||!!e.disc(`great-horned-owl`)||!!e.disc(`barred-owl`)),"forest-night-shift":e=>!!e.disc(`great-horned-owl`)&&!!e.disc(`barred-owl`)&&!!e.disc(`little-brown-bat`),"forest-canopy":e=>e.health(`forest`)>=80,"forest-reborn":e=>e.returned(`forest`)>=25,"wetland-first-water":e=>e.returned(`wetland`)>=8,"wetland-engineer":e=>!!e.disc(`beaver`),"wetland-lakemaker":e=>e.water(`wetland`).lake>=6,"wetland-restored":e=>e.health(`wetland`)>=80,"wetland-reborn":e=>e.returned(`wetland`)>=25,"desert-first-life":e=>e.returned(`desert`)>=8,"desert-burrows":e=>!!e.disc(`burrowing-owl`)&&!!e.disc(`kangaroo-rat`)&&!!e.disc(`desert-tortoise`),"desert-hunter":e=>!!e.disc(`rattlesnake`)||!!e.disc(`coyote`),"desert-restored":e=>e.health(`desert`)>=80,"desert-reborn":e=>e.returned(`desert`)>=25,"alpine-treeline":e=>e.returned(`alpine`)>=8,"alpine-haypile":e=>!!e.disc(`pika`),"alpine-crown":e=>!!e.disc(`golden-eagle`),"alpine-restored":e=>e.health(`alpine`)>=80,"alpine-reborn":e=>e.returned(`alpine`)>=25,"coastal-tide":e=>e.returned(`coastal`)>=8,"coastal-keystone":e=>!!e.disc(`sea-star`),"coastal-otter":e=>!!e.disc(`sea-otter`),"coastal-restored":e=>e.health(`coastal`)>=80,"coastal-reborn":e=>e.returned(`coastal`)>=25,"well-stocked":e=>(e.counts.resourcesCollected||0)>=1e3,"master-builder":e=>(e.counts.objectsPlaced||0)>=150,"master-gardener":e=>(e.counts.plantsPlanted||0)>=75,landscaper:e=>(e.counts.terraformActions||0)>=150,"fully-equipped":e=>e.tool(`basket`)>=4&&e.tool(`shovel`)>=4&&e.tool(`watering-can`)>=4,naturalist:e=>e.tool(`field-journal`)>=7,"recipe-collector":e=>e.craftedDistinct>=75,"open-road":e=>e.unlockedCount>=2,"welcoming-committee":e=>e.totalReturned>=50,"full-house":e=>e.totalReturned>=100,"field-notes":e=>(e.counts.animalsObserved||0)>=100,"steady-hand":e=>e.unlockedCount>=3&&e.unlockedHealthy(50),"three-restored":e=>e.biomesAtHealth(80)>=3,trailblazer:e=>e.unlockedCount>=6,"caretaker-of-the-whole":e=>e.totalReturned>=150};async function Dn(e){let t=await P(k().PlayerAchievement,e);return new Set(t.map(e=>e.achievementId))}async function On(e){let t=await B(),n=await P(k().PlayerAchievement,e),r=t.achievements.length||1,i=new Map(n.map(e=>[e.achievementId,e])),a=t.achievements.reduce((e,t)=>e+(i.has(t.id)&&t.points||0),0),o={};for(let e of t.achievements)i.has(e.id)&&(o[e.category]=(o[e.category]||0)+1);let s=[...n].sort((e,t)=>(t.earnedAt||0)-(e.earnedAt||0)).slice(0,5).map(e=>({id:e.achievementId,name:t.achievement.get(e.achievementId)?.name||e.achievementId,earnedAt:e.earnedAt}));return{earned:n.length,total:t.achievements.length,points:a,completion:Y(n.length/r),byCategory:o,recent:s}}async function Q(e,t={}){try{let n=k(),r=await B(),i=await M(n.Player,e);if(!i)return[];let a=await Dn(e),o=F(i),[s,c,l]=await Promise.all([I(n.BiomeState,o),I(n.Discovery,o),I(n.TerrainTile,o)]);for(let e of t.addDiscoveries||[])e?.animalId&&!c.some(t=>t.animalId===e.animalId)&&c.push(e);for(let e of t.freshBiomeStates||[])e?.biomeId&&(s=s.filter(t=>t.biomeId!==e.biomeId),s.push(e));let u=new Map(s.map(e=>[e.biomeId,e])),d=new Map(c.map(e=>[e.animalId,e])),f=new Map,p=new Set(i.unlockedBiomes||[]),m={counts:q(i)?.counts||{},health:e=>u.get(e)?.health||0,returned:e=>u.get(e)?.returnedCount||0,disc:e=>d.get(e),totalReturned:c.length,kindReturned:(e,t)=>c.filter(n=>{let i=r.animal.get(n.animalId);return i&&i.biome===e&&i.kind===t}).length,tool:e=>i.tools?.[e]||1,unlockedCount:(i.unlockedBiomes||[]).length,craftedDistinct:Object.keys(i.craftedEver||{}).length,tutorialStep:i.tutorialStep||0,water:e=>(f.has(e)||f.set(e,Wt(l.filter(t=>t.area===e),!0)),f.get(e)),biomesAtHealth:e=>s.filter(t=>(t.health||0)>=e).length,unlockedHealthy:e=>s.filter(e=>p.has(e.biomeId)).every(t=>(t.health||0)>=e)},h=Date.now(),g=[];for(let t of r.achievements){if(a.has(t.id))continue;let r=En[t.id];!r||!r(m)||(await n.PlayerAchievement.put({id:`${e}:${t.id}`,playerId:e,achievementId:t.id,biome:t.biome,earnedAt:h}),g.push(t))}return g}catch{return[]}}async function kn(e,t,n={}){let r=await Q(t,n);try{let r=k(),i=await r.World.get(e);if(i&&!i.solo)for(let i of await I(r.WorldMember,e))i.playerId!==t&&await Q(i.playerId,n)}catch{}return r}var $=class extends Resource{allowRead(){return!0}allowCreate(){return!0}allowUpdate(){return!0}allowDelete(){return!1}},An=class extends ${async get(){return{build:ne}}},jn=null;async function Mn(){if(jn&&jn.stamp===`0.2.2+2026-08-03T11:11:44.220Z`)return jn;let e=await B(),t={biomes:e.biomes,animals:e.animals,resources:e.resources,recipes:e.recipes,habitatObjects:e.objects.map(e=>({...e,rotatable:lr(e)})),tools:e.tools,achievements:e.achievements,homeStyles:H,homeTracks:W,nodeRegenSeconds:Ce,appearanceOptions:{skins:Re,hair:ze,outfits:Be,hats:Ve,hatColors:He,hairstyles:Ue,beards:We,bodies:Ge}};return jn={stamp:ne,obj:t,json:JSON.stringify(t),etag:`W/"gd-${ne}"`},jn}var Nn=null;function Pn(e,t){(!Nn||Nn.stamp!==`0.2.2+2026-08-03T11:11:44.220Z`)&&(Nn={stamp:ne});let n=Buffer.from(e,`utf8`);return t===`br`?(Nn.br||(Nn.br=C(n,{params:{[x.BROTLI_PARAM_QUALITY]:5,[x.BROTLI_PARAM_SIZE_HINT]:n.length}})),Nn.br):(Nn.gzip||(Nn.gzip=S(n,{level:6})),Nn.gzip)}var Fn=class extends ${async get(){let{obj:e,json:t,etag:n}=await Mn(),r=this.getContext?.()?.headers;if(!r||typeof r.get!=`function`)return e;let i=`public, max-age=300, stale-while-revalidate=604800`,a=e=>e.replace(/^W\//,``).trim(),o=String(r.get(`if-none-match`)||``);if(o&&a(o)===a(n))return{status:304,headers:{etag:n,"cache-control":i}};let s={"content-type":`application/json; charset=utf-8`,"cache-control":i,etag:n,vary:`Accept-Encoding`},c=String(r.get(`accept-encoding`)||``),l=t;return/\bbr\b/.test(c)?(s[`content-encoding`]=`br`,l=Pn(t,`br`)):/\bgzip\b/.test(c)&&(s[`content-encoding`]=`gzip`,l=Pn(t,`gzip`)),{status:200,headers:s,body:l}}},In=class extends ${async post(e){let{name:t,passcode:r,appearance:i,tzOffsetMinutes:a,creationMs:o,edition:s}=await Z(e),c=s===`demo`?`demo`:`full`,l=String(t||``).trim();if(l.length<2||l.length>24)throw new A(n(`server.err.nameLength`));let u=String(r||``);if(u.length<4||u.length>32)throw new A(n(`server.err.passcodeLength`));let d;if(c===`demo`){let e=Qe(l)||`caretaker`,t=k();do d=`${e}-${Math.random().toString(36).slice(2,8)}`;while(await M(t.Player,d))}else{if(d=Qe(l),!d)throw new A(n(`server.err.nameNeedsAlnum`));if(await M(k().Player,d))throw new A(n(`server.err.saveExists`),409)}let f=se(Math.round(Number(o)||0),0,36e5),p=await Dt(d,l,u,qe(i),ft(a),f,c),m=[];try{await z(p.player,{freshGrid:!0}),m=await ve(d)}catch(e){console.error(`world setup skipped (CreatePlayer):`,e)}return{ok:!0,playerId:d,worldId:d,worlds:m,state:await Ot(p)}}},Ln=class extends ${async post(e){let{name:t,passcode:r}=await Z(e),i=Qe(String(t||``)),a=i?await k().Player.get(i):null;if(!a)throw new A(n(`server.err.noSaveWithName`),404);if(!await Ze(a,r))throw new A(n(`server.err.passcodeMismatch`),403);let o=k(),s=0;for(let e of[o.Placement,o.Chest,o.BiomeState,o.Discovery,o.NodeState,o.TerrainTile,o.FeedEntry])for(let t of await I(e,i))await e.delete(t.id),s++;for(let e of await P(o.PlayerAchievement,i))await o.PlayerAchievement.delete(e.id),s++;for(let e of await P(o.WorldMember,i))await o.WorldMember.delete(e.id),s++;return await o.World.get(i)&&(await o.World.delete(i),s++),await o.Player.delete(i),{ok:!0,deleted:i,recordsRemoved:s+1}}},Rn=class extends ${async post(e){let{playerId:t}=await Z(e),r=Qe(String(t||``)),i=k(),a=r?await M(i.Player,r):null;if(!a)return{ok:!0,deleted:null};if(q(a)?.edition!==`demo`)throw new A(n(`server.err.notDemoSave`),403);let o=0;for(let e of[i.Placement,i.Chest,i.BiomeState,i.Discovery,i.NodeState,i.TerrainTile,i.FeedEntry])for(let t of await I(e,r))await e.delete(t.id),o++;for(let e of await P(i.PlayerAchievement,r))await i.PlayerAchievement.delete(e.id),o++;for(let e of await P(i.WorldMember,r))await i.WorldMember.delete(e.id),o++;return await M(i.World,r)&&(await i.World.delete(r),o++),await i.Player.delete(r),{ok:!0,deleted:r,recordsRemoved:o+1}}},zn=class extends ${async post(e){let{playerId:t}=await Z(e),r=Qe(String(t||``)),i=k(),a=r?await M(i.Player,r):null;if(!a)throw new A(n(`server.err.noSaveWithName`),404);if(q(a)?.edition!==`demo`)throw new A(n(`server.err.notDemoSave`),403);let o=F(a),s={...a,metrics:it({...q(a)||{},edition:`full`})};return{ok:!0,meta:{playerId:r,name:a.name||`Caretaker`,appearance:a.appearance||{},createdAt:a.createdAt||Date.now(),updatedAt:Date.now()},data:{Player:[s],PlayerAchievement:await P(i.PlayerAchievement,r),BiomeState:await I(i.BiomeState,o),Chest:await I(i.Chest,o),Placement:await I(i.Placement,o),Discovery:await I(i.Discovery,o),NodeState:await I(i.NodeState,o),TerrainTile:await I(i.TerrainTile,o),FeedEntry:await I(i.FeedEntry,o),World:await M(i.World,o)?[await M(i.World,o)]:[],WorldMember:await P(i.WorldMember,r),WorldPresence:[],JoinRequest:[]}}}},Bn=class extends ${async post(e){let{playerId:t,currentPasscode:r,newPasscode:i}=await Z(e),{player:a}=await K(t);if(!await Ze(a,r))throw new A(n(`server.err.passcodeMismatch`),403);let o=String(i||``);if(o.length<4||o.length>32)throw new A(n(`server.err.newPasscodeLength`));let{salt:s,hash:c}=Ye(o);return await k().Player.patch(t,{passcodeHash:c,passcodeSalt:s,passcode:null}),{ok:!0}}},Vn=class extends ${async post(e){let{name:t,passcode:r,tzOffsetMinutes:i}=await Z(e),a=Qe(String(t||``)),o=a?await M(k().Player,a):null;if(!o)throw new A(n(`server.err.noSaveTryNew`),404);if(!await Ze(o,r))throw new A(n(`server.err.passcodeMismatch`),403);let s=await B(),c=Date.now(),l=q(o)||rt(o.createdAt||c);await k().Player.patch(a,{metrics:it({...l,lastHeartbeatAt:0}),...i==null?{}:{tzOffsetMinutes:ft(i)}});let u=o.worldId||a,d=[];try{await z(o),u=(await k().Player.get(a)).worldId||a,await ye(a,u),d=await ve(a)}catch(e){console.error(`world setup skipped (LoginPlayer):`,e)}let f=s.biome.get(o.area);return(o.area===`home`||!f||!f.explorable)&&await k().Player.patch(a,{area:`meadow`,x:24.5,y:6.5}),{ok:!0,playerId:a,worldId:u,worlds:d,state:await Tn(a)}}},Hn=class extends ${async get(){let e=String(this.getId()||``);return await K(e),Tn(e)}},Un=class extends ${async post(e){let{playerId:t}=await Z(e),{player:n}=await K(t);return await z(n),{ok:!0,activeWorldId:F(n),worlds:await ve(t)}}},Wn=class extends ${async post(e){let{playerId:t,name:r}=await Z(e),i=k(),{player:a}=await K(t);await z(a);let o=String(r||``).trim()||n(`server.world.coopName`,{name:a.name});if(o.length>40)throw new A(n(`server.err.worldNameLength`));let s=`w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`,c=_e(),l=await N(i.World),u=new Set(l.map(e=>e.joinCode).filter(Boolean)),d=0;for(;u.has(c)&&d++<20;)c=_e();let f=Date.now();await i.World.put({id:s,name:o,solo:!1,ownerId:t,joinCode:c,createdAt:f,maxMembers:R}),await i.WorldMember.put({id:`${s}:${t}`,worldId:s,playerId:t,role:`owner`,joinedAt:f,lastSeenAt:f});let p=await B();for(let e of p.biomes)await i.BiomeState.put({id:`${s}:${e.id}`,worldId:s,playerId:t,biomeId:e.id,health:we,balance:0,returnedCount:0,unlocked:e.id===`meadow`});return{ok:!0,world:{worldId:s,name:o,joinCode:c,solo:!1,role:`owner`,isOwner:!0,memberCount:1,maxMembers:R},worlds:await ve(t)}}};async function Gn(e,t){let n=String(t||``).trim().toUpperCase();return n&&(await N(e.World)).find(e=>!e.solo&&e.joinCode===n)||null}var Kn=class extends ${async post(e){let{playerId:t,joinCode:r,token:i}=await Z(e),a=k(),{player:o}=await K(t);await z(o);let s=await Gn(a,r);if(!s)throw new A(n(`server.err.noWorldWithCode`),404);let c=`${s.id}:${t}`;if(!await a.WorldMember.get(c)){let e=String(i||``).trim(),r=e?await a.JoinRequest.get(`${s.id}:${e}`):null;if(!r||r.status!==`approved`)throw new A(n(`server.err.hostNotApproved`),403);let l=s.maxMembers||R;if((await I(a.WorldMember,s.id)).length>=l)throw new A(n(`server.err.worldFullJoined`,{max:l}),409);await a.WorldMember.put({id:c,worldId:s.id,playerId:t,role:`member`,joinedAt:Date.now(),lastSeenAt:Date.now()}),await a.JoinRequest.delete(`${s.id}:${e}`);let u=Date.now();await a.FeedEntry.put({id:`f_${s.id}_${u}_${Math.random().toString(36).slice(2,7)}`,worldId:s.id,playerId:t,at:u,icon:`user`,text:n(`server.feed.joinedWorld`,{name:o.name})})}await a.Player.patch(t,{worldId:s.id}),await ye(t,s.id);let l=await ve(t);if(!l.some(e=>e.worldId===s.id)){let e=await I(a.WorldMember,s.id),n=e.some(e=>e.playerId===t)?e.length:e.length+1;l=[...l,{worldId:s.id,name:s.name,solo:!1,role:s.ownerId===t?`owner`:`member`,joinCode:s.joinCode,memberCount:n,maxMembers:s.maxMembers||R,isOwner:s.ownerId===t}]}return{ok:!0,worldId:s.id,worlds:l,state:await Tn(t,{worldId:s.id})}}},qn=class extends ${async post(e){let{joinCode:t}=await Z(e),r=k(),i=await Gn(r,t);if(!i)return{ok:!0,exists:!1};let a=(await I(r.WorldMember,i.id)).length,o=await r.Player.get(i.ownerId),s=i.maxMembers||R;return{ok:!0,exists:!0,world:{worldId:i.id,name:i.name,hostName:o?.name||n(`server.fallback.host`),memberCount:a,maxMembers:s,full:a>=s}}}},Jn=class extends ${async post(e){let{joinCode:t,token:r,name:i}=await Z(e),a=k(),o=await Gn(a,t);if(!o)throw new A(n(`server.err.noWorldWithCode`),404);let s=String(r||``).trim();if(!s)throw new A(n(`server.err.missingToken`));let c=o.maxMembers||R;if((await I(a.WorldMember,o.id)).length>=c)throw new A(n(`server.err.worldFullClosed`,{max:c}),409);let l=String(i||``).trim().slice(0,24)||n(`server.fallback.newCaretaker`);await a.JoinRequest.put({id:`${o.id}:${s}`,worldId:o.id,token:s,name:l,status:`pending`,createdAt:Date.now()});let u=await a.Player.get(o.ownerId);return{ok:!0,worldId:o.id,world:{name:o.name,hostName:u?.name||n(`server.fallback.host`)}}}},Yn=class extends ${async post(e){let{worldId:t,token:n}=await Z(e);return{ok:!0,status:(await k().JoinRequest.get(`${t}:${String(n||``).trim()}`))?.status||`none`}}},Xn=class extends ${async post(e){let{playerId:t}=await Z(e),{player:n}=await K(t),r=k(),i=F(n),a=await r.World.get(i);if(!a||a.solo||a.ownerId!==t)return{ok:!0,requests:[]};let o=(await I(r.JoinRequest,i)).filter(e=>e.status===`pending`);return o.sort((e,t)=>(e.createdAt||0)-(t.createdAt||0)),{ok:!0,requests:o.map(e=>({token:e.token,name:e.name,createdAt:e.createdAt}))}}},Zn=class extends ${async post(e){let{playerId:t,worldId:r,token:i,approve:a}=await Z(e);await K(t);let o=k(),s=await o.World.get(r);if(!s||s.solo)throw new A(n(`server.err.noCoopWorld`),404);if(s.ownerId!==t)throw new A(n(`server.err.onlyHostApproves`),403);let c=`${r}:${String(i||``).trim()}`;if(!await o.JoinRequest.get(c))throw new A(n(`server.err.requestNotPending`),404);return await o.JoinRequest.patch(c,{status:a?`approved`:`denied`,resolvedAt:Date.now()}),{ok:!0}}},Qn=class extends ${async post(e){let{playerId:t}=await Z(e),{player:r}=await K(t),i=k(),a=F(r),o=await i.World.get(a),s=o?.maxMembers||R;if(!o||o.solo)return{ok:!0,roster:[],closed:!1,maxMembers:s,joinCode:null};let c=await I(i.WorldMember,a),l=[];for(let e of c){let t=await M(i.Player,e.playerId);l.push({playerId:e.playerId,name:t?.name||n(`server.fallback.caretaker`),isOwner:e.role===`owner`||o.ownerId===e.playerId,joinedAt:e.joinedAt||0})}return l.sort((e,t)=>(e.joinedAt||0)-(t.joinedAt||0)),{ok:!0,roster:l,closed:l.length>=s,maxMembers:s,joinCode:o.joinCode}}},$n=class extends ${async post(e){let{playerId:t,worldId:r}=await Z(e),i=k(),{player:a}=await K(t);await z(a);let o=String(r||``);if(!await i.WorldMember.get(`${o}:${t}`))throw new A(n(`server.err.notWorldMember`),403);return await i.Player.patch(t,{worldId:o}),await i.WorldMember.patch(`${o}:${t}`,{lastSeenAt:Date.now()}),await ye(t,o),{ok:!0,worldId:o,worlds:await ve(t),state:await Tn(t,{worldId:o})}}},er=class extends ${async post(e){let{playerId:t,worldId:r}=await Z(e),i=k(),{player:a}=await K(t),o=String(r||``);if(o===t)throw new A(n(`server.err.cannotLeaveSolo`));let s=`${o}:${t}`;if(!await i.WorldMember.get(s))throw new A(n(`server.err.notInWorld`),404);await i.WorldMember.delete(s),a.worldId===o&&(await i.Player.patch(t,{worldId:t,area:`meadow`,x:24.5,y:6.5}),await ye(t,t));let c=a.worldId===o?t:a.worldId||t;return{ok:!0,worldId:c,worlds:await ve(t),state:await Tn(t,{worldId:c})}}},tr=15e3,nr=class extends ${async post(e){let{playerId:t,x:n,y:r,area:i}=await Z(e),a=k(),{player:o}=await K(t),s=F(o),c=Date.now(),l=Number.isFinite(Number(n))?Number(n):o.x,u=Number.isFinite(Number(r))?Number(r):o.y,d=typeof i==`string`?i:o.area;if((await a.World.get(s))?.solo)return{ok:!0,worldId:s,peers:[]};let f={...(await a.WorldPresence.get(s)||{id:s,players:{}}).players||{}};f[t]={playerId:t,name:o.name,appearance:o.appearance,area:d,x:l,y:u,t:c};for(let e of Object.keys(f))c-(f[e]?.t||0)>tr&&delete f[e];return await a.WorldPresence.put({id:s,players:f,updatedAt:c}),{ok:!0,worldId:s,peers:Object.values(f).filter(e=>e.playerId!==t)}}},rr=class extends ${async post(e){let{playerId:r,biomeId:i,nodeId:a,resourceId:o}=await Z(e),s=k(),l=await B(),{player:u}=await K(r),d=F(u),f=l.biome.get(i);if(!f)throw new A(n(`server.err.unknownBiome`,{biome:i}));if(!(u.unlockedBiomes||[]).includes(i))throw new A(n(`server.err.biomeLocked`,{biome:f.name}),403);let p=l.resource.get(o);if(!p)throw new A(n(`server.err.unknownResource`,{resource:o}));if(t(o)){let e=_(d,i,O(u));if(c(i,e)!==o)throw new A(n(`server.err.weatherOnly`,{resource:p.name}),409)}else if(!(f.resources||[]).includes(o))throw new A(n(`server.err.resourceNotInBiome`,{resource:o,biome:f.name}));if(!a||typeof a!=`string`)throw new A(n(`server.err.nodeIdRequired`));let m=`${d}:${i}:${a}`,h=await s.NodeState.get(m),g=Date.now();if(h&&g-h.harvestedAt<Ce*1e3)throw new A(n(`server.err.regrowing`),409);let v=kt(u),y=j(u.inventory);if(y>=v)throw new A(n(`server.err.basketFullStore`),409);let b=u.tools?.[p.tool]||1,x=Math.min(Math.max(1,b),v-y),S=ke(u),C=+(S?.id===`forage`&&v-y-x>0&&Math.random()<S.strength),w=x+C,T={...u.inventory||{}};return T[o]=(T[o]||0)+w,await s.Player.patch(r,{inventory:T}),await s.NodeState.put({id:m,worldId:d,playerId:r,harvestedAt:g}),await J(u,{resourcesCollected:w},{[`res:${o}`]:w}),await Q(r),{ok:!0,gained:{[o]:w},perkBonus:C||void 0,inventory:T,nodeId:a,harvestedAt:g}}},ir=class extends ${async post(e){let{playerId:t,chestId:r,resourceId:i,qty:a,direction:o}=await Z(e),s=k(),c=await B(),{player:l}=await K(t),u=F(l),d=ue(a,`qty`),f=await en(s,c,r,u);if(!f)throw new A(n(`server.err.chestNotFound`),404);let p={...l.inventory||{}},m={...f.contents||{}};if(o===`deposit`){if((p[i]||0)<d)throw new A(n(`server.err.notEnoughInBasket`,{resource:i}));if(j(m)+d>f.capacity)throw new A(n(`server.err.chestFull`),409);p[i]-=d,p[i]<=0&&delete p[i],m[i]=(m[i]||0)+d}else if(o===`withdraw`){if((m[i]||0)<d)throw new A(n(`server.err.notEnoughInChest`,{resource:i}));if(j(p)+d>kt(l))throw new A(n(`server.err.basketFull`),409);m[i]-=d,m[i]<=0&&delete m[i],p[i]=(p[i]||0)+d}else throw new A(n(`server.err.badDirection`));return await s.Player.patch(t,{inventory:p}),await s.Chest.patch(r,{contents:m}),await J(l,o===`deposit`?{chestDeposits:1}:{chestWithdrawals:1}),{ok:!0,inventory:p,chest:{...f,contents:m}}}},ar=class extends ${async post(e){let{playerId:t,kind:r,id:i,qty:a}=await Z(e),o=k(),{player:s}=await K(t),c=ue(a,`qty`);if(!i||typeof i!=`string`)throw new A(n(`server.err.idRequired`));if(r===`crafted`){let e={...s.craftedItems||{}};if((e[i]||0)<c)throw new A(n(`server.err.discardTooMany`));return e[i]-=c,e[i]<=0&&delete e[i],await o.Player.patch(t,{craftedItems:e}),await J(s,{itemsDiscarded:c}),{ok:!0,craftedItems:e}}let l={...s.inventory||{}};if((l[i]||0)<c)throw new A(n(`server.err.discardTooMany`));return l[i]-=c,l[i]<=0&&delete l[i],await o.Player.patch(t,{inventory:l}),await J(s,{itemsDiscarded:c}),{ok:!0,inventory:l}}},or=class extends ${async post(e){let{playerId:t,recipeId:r}=await Z(e),i=k(),a=await B(),{player:o}=await K(t),s=F(o),c=a.recipe.get(r);if(!c)throw new A(n(`server.err.unknownRecipe`,{recipe:r}));let l=a.object.get(c.output.itemId);if(l?.plantable)throw new A(n(`server.err.plantedNotCrafted`,{name:c.name}),400);if(!o.devUnlockAll&&l?.homeMin&&(G(o).space||1)<l.homeMin)throw new A(n(`server.err.needsProperHouse`,{name:c.name}),403);let u=!!o.devUnlockAll;if(!u&&c.unlockBiome&&!(o.unlockedBiomes||[]).includes(c.unlockBiome))throw new A(n(`server.err.recipeBiomeLocked`),403);if(!u&&c.unlock&&c.unlockBiome&&!Qt(c,await $t(s,c.unlockBiome,o,a)))throw new A(n(`server.err.recipeLocked`,{label:c.unlock.label}),403);if(c.requiresTool&&(o.tools?.[c.requiresTool.id]||1)<c.requiresTool.tier){let e=a.tool.get(c.requiresTool.id);throw new A(n(`server.err.requiresUpgradedTool`,{tool:e?.name||c.requiresTool.id}),403)}if(c.once&&(o.craftedEver?.[c.output.itemId]||0)>0)throw new A(n(`server.err.craftOnce`,{name:c.name}),409);let{usedFrom:d,inventory:f}=await tn(o,c.materials||{},s),p=ke(o),m;if(p?.id===`thrift`&&Object.keys(c.materials||{}).length&&Math.random()<p.strength){let e=kt(o)-j(f);for(let[t,n]of Object.entries(c.materials||{})){let r=Math.min(Math.max(1,Math.floor(n/2)),Math.max(0,e));r>0&&(m||={},m[t]=r,f[t]=(f[t]||0)+r,e-=r)}}let h={...o.craftedItems||{}},g={...o.craftedEver||{}};h[c.output.itemId]=(h[c.output.itemId]||0)+(c.output.qty||1),g[c.output.itemId]=(g[c.output.itemId]||0)+(c.output.qty||1),await i.Player.patch(t,m?{craftedItems:h,craftedEver:g,inventory:f}:{craftedItems:h,craftedEver:g});let _=await Zt(s,t,{player:{...o,craftedItems:h,craftedEver:g}}),v=await I(i.Chest,s);return await J(o,{itemsCrafted:1},{craft:1}),await Q(t),{ok:!0,crafted:c.output,craftedItems:h,inventory:f,chests:v,usedFrom:d,refund:m,unlockedBiomes:_}}};function sr(e){let t=Number(e);return Number.isFinite(t)?(Math.round(t/90)*90%360+360)%360:0}var cr=new Set([`wooden-fence`,`dry-stone-wall`,`wooden-bench`,`hammock`,`picnic-blanket`,`garden-arch`,`trail-signpost`,`flower-cart`,`home-bed`,`home-sleeping-bag`,`home-bookshelf`,`home-armchair`,`home-fireplace`,`home-table`,`home-dresser`,`home-driftwoodshelf`,`home-mushroomshelf`,`home-reedmat`,`home-peltrug`,`home-rug`,`home-cushions`,`home-stool`,`home-aquarium`,`home-telescope`]);function lr(e){return e?e.rotatable===!0||e.bridge||/-path$/.test(e.id)?!0:cr.has(e.id):!1}var ur=class extends ${async post(e){let{playerId:t,objectId:r,area:i,x:a,y:o,rotation:s}=await Z(e),c=k(),l=await B(),{player:u}=await K(t),d=F(u),f=l.object.get(r);if(!f)throw new A(n(`server.err.unknownObject`,{object:r}));if(f.placement===`none`)throw new A(n(`server.err.kitNotPlaceable`,{name:f.name}));if((u.craftedItems?.[r]||0)<=0)throw new A(n(`server.err.noneCrafted`,{name:f.name}));let p=Math.round(Number(a)),m=Math.round(Number(o)),h=yt(l,i);if(!Number.isFinite(p)||!Number.isFinite(m)||p<1||m<1||p>h.cols-2||m>h.rows-2)throw new A(n(`server.err.outOfReach`));let g=Me(i);if(i===`home`){if(f.placement===`outdoor`)throw new A(n(`server.err.outdoorOnly`,{name:f.name}));if(f.homeMin&&(G(u).space||1)<f.homeMin)throw new A(n(`server.err.needsBiggerHome`,{name:f.name}),403);let e=Ae(u);if(p<e.x0||p>e.x1||m<e.y0||m>e.y1)throw new A(n(`server.err.placeOnFloor`))}else if(g){let e=l.biome.get(g);if(!e)throw new A(n(`server.err.unknownArea`,{area:i}));if(!(u.unlockedBiomes||[]).includes(g))throw new A(n(`server.err.biomeLocked`,{biome:e.name}),403);if(f.placement===`outdoor`)throw new A(n(`server.err.outdoorOnly`,{name:f.name}));if(f.homeMin&&f.homeMin>1)throw new A(n(`server.err.tentTooSmall`,{name:f.name}),403);let t=Ne();if(p<t.x0||p>t.x1||m<t.y0||m>t.y1)throw new A(n(`server.err.placeOnFloor`))}else{let e=l.biome.get(i);if(!e)throw new A(n(`server.err.unknownArea`,{area:i}));if(!(u.unlockedBiomes||[]).includes(i))throw new A(n(`server.err.biomeLocked`,{biome:e.name}),403);if(f.placement===`indoor`)throw new A(n(`server.err.indoorOnly`,{name:f.name}));if(!(f.biomes||[]).includes(i))throw new A(n(`server.err.wrongHabitat`,{name:f.name,biome:e.name}));if(e.oceanCols&&p>=h.cols-e.oceanCols)throw new A(n(`server.err.openOcean`),409)}if(f.requiresTool&&(u.tools?.[f.requiresTool.id]||1)<f.requiresTool.tier)throw new A(n(`server.err.placeRequiresTool`,{name:f.name,tool:l.tool.get(f.requiresTool.id)?.name||f.requiresTool.id}),403);let _=await I(c.Placement,d);if(_.some(e=>e.area===i&&e.x===p&&e.y===m))throw new A(n(`server.err.spotTaken`),409);if(f.onePerArea&&_.some(e=>e.area===i&&e.objectId===r))throw new A(n(`server.err.onePerArea`,{name:f.name}),409);let v=i===`home`||!!g,y=v?null:await he(c.TerrainTile,d,i,p,m);if(y)if(y.type===`water`){if(!f.bridge)throw new A(n(`server.err.openWaterBridge`),409)}else throw new A(n(`server.err.bedForPlanting`),409);else if(f.bridge&&!v)throw new A(n(`server.err.bridgeNeedsWater`),409);let b={...u.craftedItems||{}};--b[r],b[r]<=0&&delete b[r],await c.Player.patch(t,{craftedItems:b});let x=`pl_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,S={id:x,worldId:d,playerId:t,objectId:r,area:i,x:p,y:m,placedAt:Date.now(),rotation:lr(f)?sr(s):0};if(await c.Placement.put(S),f.isChest&&await c.Chest.put({id:x,worldId:d,playerId:t,area:i,x:p,y:m,size:r,capacity:f.chestCapacity||60,contents:{}}),v)return await J(u,{objectsPlaced:1},{place:1}),await Q(t),{ok:!0,placement:S,craftedItems:b};let C=await X(d,t,i,{addPlacements:[S],player:{...u,craftedItems:b}});return await J(u,{objectsPlaced:1,animalsReturned:C.newAnimals?.length||0},{place:1}),await kn(d,t,{addDiscoveries:C.newAnimals,freshBiomeStates:[C.biomeState]}),{ok:!0,placement:S,craftedItems:b,...C}}},dr=class extends ${async post(e){let{playerId:t,area:r,x:i,y:a,plantId:o}=await Z(e),s=k(),c=await B(),{player:l}=await K(t),u=F(l),d=c.biome.get(r);if(!d)throw new A(n(`server.err.unknownArea`,{area:r}));if(!(l.unlockedBiomes||[]).includes(r))throw new A(n(`server.err.biomeLocked`,{biome:d.name}),403);let f=c.object.get(o);if(!f||!f.plantable)throw new A(n(`server.err.notPlantable`));if(!(f.biomes||[]).includes(r))throw new A(n(`server.err.wouldNotTakeRoot`,{name:f.name,biome:d.name}));let p=Math.round(Number(i)),m=Math.round(Number(a)),h=await he(s.TerrainTile,u,r,p,m);if(!h||h.type!==`watered`)throw new A(n(`server.err.plantIntoWatered`));let{usedFrom:g,inventory:_}=await tn(l,f.plantCost||{},u);await s.TerrainTile.delete(h.id);let v=ke(l),y=v?.id===`growth`?v.strength:0,b=Date.now(),x={id:`pl_${b}_${Math.random().toString(36).slice(2,8)}`,worldId:u,playerId:t,objectId:o,area:r,x:p,y:m,placedAt:b-Math.round(Ft(f)*y),plantedAt:b-Math.round((f.growSeconds||0)*1e3*y)};await s.Placement.put(x);let S=await X(u,t,r,{addPlacements:[x],removeTerrainIds:[h.id],player:{...l,inventory:_}});return await J(l,{plantsPlanted:1,animalsReturned:S.newAnimals?.length||0},{plant:1}),await kn(u,t,{addDiscoveries:S.newAnimals,freshBiomeStates:[S.biomeState]}),{ok:!0,placement:x,inventory:_,usedFrom:g,perkGrowth:y||void 0,...S}}};function fr(e,t){let n=e?.yield;if(!n||!e?.plantable||!t?.plantedAt)return null;let r=(e.growSeconds||0)*1e3,i=(n.regrowSeconds||60)*1e3;return t.lastHarvestAt?t.lastHarvestAt+i:t.plantedAt+r}var pr=class extends ${async post(e){let{playerId:t,placementId:r}=await Z(e),i=k(),a=await B(),{player:o}=await K(t),s=F(o),c=Date.now(),l=(await I(i.Placement,s)).find(e=>e.id===r);if(!l)throw new A(n(`server.err.placementNotFound`),404);let u=a.object.get(l.objectId),d=u?.yield;if(!d)throw new A(n(`server.err.notHarvestable`));let f=fr(u,l);if(f==null||c<f)throw new A(n(`server.err.notReadyYet`));let p=kt(o),m={...o.inventory||{}},h=Math.max(0,p-j(m)),g=Math.min(d.qty||1,h);if(g<=0)throw new A(n(`server.err.basketFullHarvest`),409);return m[d.resourceId]=(m[d.resourceId]||0)+g,await i.Player.patch(t,{inventory:m}),await i.Placement.patch(r,{lastHarvestAt:c}),await J(o,{resourcesCollected:g}),{ok:!0,placementId:r,gained:{[d.resourceId]:g},inventory:m,placement:{...l,lastHarvestAt:c}}}},mr=class extends ${async post(e){let{playerId:t,appearance:n}=await Z(e),{player:r}=await K(t),i=qe(n);return await k().Player.patch(t,{appearance:i}),await J(r,{appearanceChanges:1}),{ok:!0,appearance:i}}},hr=class extends ${async post(e){let{playerId:t,placementId:r,x:i,y:a,rotation:o}=await Z(e),s=k(),{player:c}=await K(t),l=F(c),u=await I(s.Placement,l),d=u.find(e=>e.id===r);if(!d)throw new A(n(`server.err.placementNotFound`),404);if(d.objectId===`workbench`)throw new A(n(`server.err.workbenchStays`));let f=yt(await B(),d.area),p=Math.round(Number(i)),m=Math.round(Number(a));if(!Number.isFinite(p)||!Number.isFinite(m)||p<1||m<1||p>f.cols-2||m>f.rows-2)throw new A(n(`server.err.outOfReach`));if(u.some(e=>e.id!==r&&e.area===d.area&&e.x===p&&e.y===m))throw new A(n(`server.err.spotTaken`),409);let h=await B(),g=h.object.get(d.objectId),_=await he(s.TerrainTile,l,d.area,p,m);if(_)if(_.type===`water`){if(!g?.bridge)throw new A(n(`server.err.openWaterBridgeOnly`),409)}else throw new A(n(`server.err.bedForPlantingShort`),409);else if(g?.bridge)throw new A(n(`server.err.bridgesOverWater`),409);let v={x:p,y:m};return o!==void 0&&lr(g)&&(v.rotation=sr(o)),await s.Placement.patch(r,v),await en(s,h,r,l)&&await s.Chest.patch(r,{x:p,y:m}),await J(c,{objectsMoved:1}),{ok:!0,placement:{...d,...v}}}},gr=class extends ${async post(e){let{playerId:t,placementId:r}=await Z(e),i=k(),{player:a}=await K(t),o=F(a),s=await me(i.Placement,o,r);if(!s)throw new A(n(`server.err.placementNotFound`),404);if(s.objectId===`workbench`)throw new A(n(`server.err.workbenchStays`));let c=await me(i.Chest,o,r);if(c&&j(c.contents)>0)throw new A(n(`server.err.emptyChestFirst`),409);if(s.objectId===`trail-tent`){let e=`tent-${s.area}`;if((await I(i.Placement,o)).some(t=>t.area===e))throw new A(n(`server.err.tentNotEmpty`),409)}let l=(await B()).object.get(s.objectId),u=null,d={...a.craftedItems||{}},f={...a.inventory||{}},p=new Map;if(l?.plantable&&s.plantedAt&&Object.keys(l.plantCost||{}).length){u={...l.plantCost};let e=kt(a),t=j(f),s=(await I(i.Chest,o)).filter(e=>e.id!==r);for(let[r,i]of Object.entries(u)){let a=i,o=Math.min(a,Math.max(0,e-t));o>0&&(f[r]=(f[r]||0)+o,t+=o,a-=o);for(let e of s){if(a<=0)break;let t=p.get(e.id)||{...e.contents||{}},n=e.capacity-j(t),i=Math.min(n,a);i>0&&(t[r]=(t[r]||0)+i,p.set(e.id,t),a-=i)}if(a>0)throw new A(n(`server.err.noRoomRefund`),409)}}else d[s.objectId]=(d[s.objectId]||0)+1;if(c&&await i.Chest.delete(r),await i.Placement.delete(r),u){await i.Player.patch(t,{inventory:f});for(let[e,t]of p)await i.Chest.patch(e,{contents:t})}else await i.Player.patch(t,{craftedItems:d});let m=s.area!==`home`&&!Me(s.area)?await X(o,t,s.area,{removeIds:[r],player:{...a,craftedItems:d,inventory:f}}):null;return await J(a,{objectsRemoved:1,animalsReturned:m?.newAnimals?.length||0}),await kn(o,t,m?{addDiscoveries:m.newAnimals,freshBiomeStates:[m.biomeState]}:{}),{ok:!0,removed:r,craftedItems:d,refunded:u,...m||{}}}},_r=class extends ${async post(e){let{playerId:t,toolId:r}=await Z(e),i=k(),a=await B(),{player:o}=await K(t),s=a.tool.get(r);if(!s)throw new A(n(`server.err.unknownTool`,{tool:r}));let c=F(o),l=o.tools?.[r]||1,u=(s.tiers||[]).find(e=>e.tier===l+1);if(!u)throw new A(n(`server.err.toolMaxed`,{tool:s.name}));if(u.requires?.biome&&((await L(i.BiomeState,c,u.requires.biome))?.health||0)<(u.requires.minHealth||0)){let e=a.biome.get(u.requires.biome);throw new A(n(`server.err.restoreFirst`,{biome:e?.name||u.requires.biome,health:u.requires.minHealth}),403)}let{usedFrom:d,inventory:f}=await tn(o,u.materials||{},c),p={...o.tools||{},[r]:u.tier};await i.Player.patch(t,{tools:p});let m=await Zt(c,t,{player:{...o,tools:p}}),h=await I(i.Chest,c);return await J(o,{toolsUpgraded:1}),await Q(t),{ok:!0,tools:p,inventory:f,chests:h,usedFrom:d,unlockedBiomes:m,upgraded:{toolId:r,tier:u.tier,name:u.name}}}},vr=class extends ${async post(e){let{playerId:t,track:r}=await Z(e),i=k(),{player:a}=await K(t),o=F(a),s=W[r];if(!s)throw new A(n(`server.err.unknownHomeUpgrade`));let c=G(a);if(!c.styleLocked)throw new A(n(`server.err.buildStyleFirst`),403);let l=c[r]||1,u=s.levels[l];if(!u)throw new A(n(`server.err.trackMaxed`,{track:s.name.toLowerCase()}));if(u.requires?.biome&&((await L(i.BiomeState,o,u.requires.biome))?.health||0)<(u.requires.minHealth||0)){let e=(await B()).biome.get(u.requires.biome);throw new A(n(`server.err.restoreFirst`,{biome:e?.name||u.requires.biome,health:u.requires.minHealth}),403)}let{usedFrom:d,inventory:f}=await tn(a,u.materials||{},o),p={...c,[r]:l+1};await i.Player.patch(t,{home:p});let m=await I(i.Chest,o);return await Q(t),await J(a,{homeUpgrades:1}),{ok:!0,home:p,inventory:f,chests:m,usedFrom:d,upgraded:{track:r,level:l+1,name:s.name}}}},yr=[`home-sleeping-bag`,`home-bed`],br=class extends ${async post(e){let{playerId:t}=await Z(e),r=k(),{player:i}=await K(t),a=F(i);if(!(await I(r.Placement,a)).some(e=>yr.includes(e.objectId)))throw new A(n(`server.err.needBedToRest`),403);let o=await I(r.NodeState,a);for(let e of o)await r.NodeState.delete(e.id);let s=O(i),c=f(s)-s;return await r.Player.patch(t,{clockOffsetMs:(i.clockOffsetMs||0)+c}),await J(i,{restsTaken:1}),{ok:!0,rested:!0,refreshed:o.length}}},xr=e=>typeof e==`string`&&/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(e.trim()),Sr=class extends ${async post(e){let{playerId:t,colors:r}=await Z(e),i=k(),{player:a}=await K(t),o=G(a);if(!o.styleLocked)throw new A(n(`server.err.buildBeforeRepaint`),403);let s={...o.colors};for(let e of[`floor`,`wall`,`accent`,`rug`])r?.[e]&&xr(r[e])&&(s[e]=String(r[e]).trim().toLowerCase());return await i.Player.patch(t,{home:{...o,colors:s}}),await J(a,{recolors:1}),{ok:!0}}},Cr=class extends ${async post(e){let{playerId:t,placementId:r,color:i}=await Z(e),a=k(),{player:o}=await K(t);if(!G(o).styleLocked)throw new A(n(`server.err.buildBeforeRepaintThings`),403);if(!xr(i))throw new A(n(`server.err.invalidColor`));if(!await me(a.Placement,F(o),r))throw new A(n(`server.err.itemNotHere`),404);return await a.Placement.patch(r,{color:String(i).trim().toLowerCase()}),await J(o,{recolors:1}),{ok:!0}}},wr=class extends ${async post(e){let{playerId:t,style:r}=await Z(e),i=k(),{player:a}=await K(t),o=H[r];if(!o)throw new A(n(`server.err.unknownHomeStyle`));let s=G(a);if(s.styleLocked)throw new A(n(`server.err.homeAlreadyBuilt`),403);let c=F(a);if(o.requires?.biome&&((await L(i.BiomeState,c,o.requires.biome))?.health||0)<(o.requires.minHealth||0)){let e=(await B()).biome.get(o.requires.biome);throw new A(n(`server.err.restoreFirst`,{biome:e?.name||o.requires.biome,health:o.requires.minHealth}),403)}let{usedFrom:l,inventory:u}=await tn(a,o.materials||{},c),d={...s,style:r,styleLocked:!0,space:2};await i.Player.patch(t,{home:d});let f=await I(i.Chest,c);return await Q(t),await J(a,{homesBuilt:1}),{ok:!0,home:d,inventory:u,chests:f,usedFrom:l,built:H[r].name}}},Tr=class extends ${async post(e){let{playerId:t,animalId:r}=await Z(e),i=k(),a=await B(),{player:o}=await K(t),s=F(o),c=await ge(i.Discovery,s,r);if(!c)throw new A(n(`server.err.animalNotReturned`),404);let l=pt(o,Date.now()),u=c.lastObservedDayKey!==l,d=(c.timesObserved||0)+1;return await i.Discovery.patch(c.id,{timesObserved:d,lastObservedDayKey:l}),await J(o,{animalsObserved:1},u?{observe:1}:{}),await Q(t),{ok:!0,discovery:{...c,timesObserved:d},animal:a.animal.get(r)}}},Er=class extends ${async post(e){let{playerId:t,taskId:r}=await Z(e),i=k(),a=await B(),{player:o}=await K(t),s=F(o),c=Date.now(),[l,u,d,f]=await Promise.all([I(i.Discovery,s),I(i.BiomeState,s),I(i.Placement,s),I(i.Chest,s)]),p=wn({wid:s,player:o,d:a,discoveries:l,biomeStates:u,placements:d,chests:f,now:c,unlockedBiomes:o.unlockedBiomes}),m=p.tasks.find(e=>e.id===String(r||``));if(!m)throw new A(n(`server.err.taskNotOnBoard`),404);if(m.pinned)throw new A(n(`server.err.taskNotClaimable`),409);if(m.claimed)throw new A(n(`server.err.taskAlreadyClaimed`),409);if(m.progress<m.target)throw new A(n(`server.err.taskNotFinished`),409);let h=kt(o),g={...o.inventory||{}},_=Math.max(0,h-j(g)),v={};for(let[e,t]of Object.entries(m.reward||{})){let n=Math.min(t,_);n<=0||(g[e]=(g[e]||0)+n,v[e]=n,_-=n)}if(!Object.keys(v).length)throw new A(n(`server.err.basketFullReward`),409);let y=String(m.id).startsWith(`start-`),b=String(m.id).startsWith(`unlock-reward:`),x={inventory:g};if(b){let e=String(m.id).slice(14);x.pendingUnlockRewards=(o.pendingUnlockRewards||[]).filter(t=>t!==e)}else y?x.goalClaims={...o.goalClaims||{},[m.id]:!0}:x.customGoals=(o.customGoals||[]).filter(e=>e.id!==m.id);await i.Player.patch(t,x),await J(o,{tasksCompleted:1}),await Q(t);let S={...p,tasks:p.tasks.map(e=>e.id===m.id?{...e,claimed:!0}:e)};return{ok:!0,taskId:m.id,text:m.text,gained:v,inventory:g,dailyTasks:S}}},Dr=class extends ${async post(e){let{playerId:t,goals:n}=await Z(e),{player:r}=await K(t),i=k(),a=await B(),o=F(r),s=Date.now(),[c,l,u,d]=await Promise.all([I(i.Discovery,o),I(i.BiomeState,o),I(i.Placement,o),I(i.Chest,o)]),f={wid:o,player:r,d:a,discoveries:c,biomeStates:l,placements:u,chests:d,now:s,unlockedBiomes:r.unlockedBiomes},p=new Map((r.customGoals||[]).map(e=>[e.id,e])),m=on(r,a),h=Cn(n,a),g=[];for(let e of h){let t=p.get(e.id);if(!t&&g.length>=m)continue;if(g.length>=an)break;let n=t&&typeof t.base==`number`?t.base:yn(e,f),r={...e,base:n};e.kind===`build`&&(r.basePlace=t&&typeof t.basePlace==`number`?t.basePlace:_n(f,e.itemId||``)),g.push(r)}return await i.Player.patch(t,{customGoals:g}),{ok:!0,customGoals:g,goalLimit:m}}},Or=class extends ${async post(e){let{playerId:t,area:r,x:i,y:a,action:o}=await Z(e),s=k(),c=await B(),{player:l}=await K(t),u=F(l),d=c.biome.get(r);if(!d)throw new A(n(`server.err.terraformOutdoors`));if(!(l.unlockedBiomes||[]).includes(r))throw new A(n(`server.err.biomeLocked`,{biome:d.name}),403);let f=Math.round(Number(i)),p=Math.round(Number(a)),m=yt(c,r);if(!Number.isFinite(f)||!Number.isFinite(p)||f<1||p<1||f>m.cols-2||p>m.rows-2)throw new A(n(`server.err.outOfReach`));if((await I(s.Placement,u)).some(e=>e.area===r&&e.x===f&&e.y===p))throw new A(n(`server.err.somethingPlaced`));let h=`${u}:${r}:${f}:${p}`,g=await he(s.TerrainTile,u,r,f,p),_=l.inventory||{},v=null,y,b=null;if(o===`dig`){if((l.tools?.shovel||0)<1)throw new A(n(`server.err.needShovel`));if(g)throw new A(n(`server.err.alreadyPrepared`));v={id:h,worldId:u,playerId:t,area:r,x:f,y:p,type:`tilled`,updatedAt:Date.now()},await s.TerrainTile.put(v);let e=d.digResources||[];if(e.length&&Math.random()<Pe){let n=e[Math.floor(Math.random()*e.length)],r=Math.max(0,kt(l)-j(_)),i=Math.min(l.tools?.shovel||1,r);i>0&&(_={..._,[n]:(_[n]||0)+i},await s.Player.patch(t,{inventory:_}),b={resourceId:n,amount:i})}}else if(o===`water`){if((l.tools?.[`watering-can`]||0)<1)throw new A(n(`server.err.needWateringCan`));if(!g)throw new A(n(`server.err.prepareBedFirst`));if(g.type===`water`)throw new A(n(`server.err.alreadyOpenWater`));let e=g.type===`tilled`?`watered`:`water`;if(e===`water`&&d.canFlood===!1)throw new A(n(`server.err.tooDryToFlood`,{biome:d.name}));if((_.water||0)+(_[`clean-water`]||0)<1)throw new A(n(`server.err.needWater`,{count:1}));_={..._};let r=1;for(let e of[`water`,`clean-water`]){let t=Math.min(_[e]||0,r);t>0&&(_[e]-=t,_[e]<=0&&delete _[e],r-=t)}await s.Player.patch(t,{inventory:_}),v={...g,type:e,updatedAt:Date.now()},await s.TerrainTile.patch(g.id,{type:e,updatedAt:Date.now()})}else if(o===`clear`){if(!g)throw new A(n(`server.err.nothingToClear`));await s.TerrainTile.delete(g.id),y=g.id}else throw new A(n(`server.err.badTerraformAction`));let x=await X(u,t,r,{addTerrain:v?[v]:[],removeTerrainIds:y?[y]:[],player:{...l,inventory:_}});return await J(l,{terraformActions:1,animalsReturned:x.newAnimals?.length||0},o===`water`?{water:1}:{}),await kn(u,t,{addDiscoveries:x.newAnimals,freshBiomeStates:[x.biomeState]}),{ok:!0,tile:v,removedId:y,dug:b,inventory:_,...x}}},kr=class extends ${async post(e){let{playerId:t,biomeId:n}=await Z(e),{player:r}=await K(t),i=await X(F(r),t,n);return await kn(F(r),t,{addDiscoveries:i.newAnimals,freshBiomeStates:[i.biomeState]}),{ok:!0,...i}}},Ar=class extends ${async post(e){let{playerId:t,x:r,y:i,area:a,tutorialStep:o}=await Z(e),s=k(),c=await B(),{player:l}=await K(t),u={};if(Number.isFinite(Number(r))&&(u.x=Number(r)),Number.isFinite(Number(i))&&(u.y=Number(i)),Number.isInteger(o)&&o>=0&&o<=99&&(u.tutorialStep=o,u.tutorialMaxStep=Math.max(l.tutorialMaxStep??0,l.tutorialStep??0,o)),a===`home`)u.area=`home`;else if(Me(a)){let e=Me(a),t=c.biome.get(e);if(!t)throw new A(n(`server.err.unknownArea`,{area:a}));if(!(l.unlockedBiomes||[]).includes(e))throw new A(n(`server.err.biomeLocked`,{biome:t.name}),403);let r=F(l);if(!(await I(s.Placement,r)).some(t=>t.area===e&&t.objectId===`trail-tent`))throw new A(n(`server.err.noTentHere`),404);u.area=a}else if(a){let e=c.biome.get(a);if(!e)throw new A(n(`server.err.unknownArea`,{area:a}));if(!(l.unlockedBiomes||[]).includes(a))throw new A(n(`server.err.biomeLocked`,{biome:e.name}),403);if(!e.explorable)throw new A(n(`server.err.notExplorable`,{biome:e.name}),403);u.area=a;let r=l.visitedBiomes||[`meadow`];if(r.includes(a)||(u.visitedBiomes=[...r,a]),Yt[a]){let e=F(l);(await I(s.TerrainTile,e)).some(e=>e.area===a)||(await Xt(e,t,a),await X(e,t,a,{player:l}))}}return await s.Player.patch(t,u),u.tutorialStep!==void 0&&await Q(t),{ok:!0,player:Je(await s.Player.get(t))}}},jr=class extends ${async post(e){let{playerId:t,entries:n}=await Z(e),{player:r}=await K(t),i=F(r),a=k(),o=Array.isArray(n)?n.slice(0,Ee):[],s=0;for(let e of o){let n=String(e?.text||``).slice(0,500).trim();if(!n)continue;let r=Number(e?.at)||Date.now(),o=String(e?.icon||`leaf`).slice(0,40),c=`f_${i}_${r}_${Math.random().toString(36).slice(2,9)}`;await a.FeedEntry.put({id:c,worldId:i,playerId:t,at:r,icon:o,text:n}),s++}let c=(await I(a.FeedEntry,i)).sort((e,t)=>(e.at||0)-(t.at||0));if(c.length>Ee)for(let e of c.slice(0,c.length-Ee))await a.FeedEntry.delete(e.id);return{ok:!0,added:s}}},Mr=18e5,Nr=9e4,Pr=class extends ${async post(e){let{playerId:t,language:n,edition:r}=await Z(e),i=k(),a=await B(),{player:o}=await K(t),s=Date.now(),c=q(o)||rt(o.createdAt||s),l=typeof n==`string`&&n.trim()?n.trim().toLowerCase().slice(0,12):null,u=r===`demo`?`demo`:r===`full`?`full`:null,d=c.lastHeartbeatAt||0,f=s-d,p=c.playSeconds||0,m=c.sessions||0,h=c.curSessionSeconds||0,g={...c.areaSeconds||{}},_={...c.sessionLengths||{}},v=d===0||f>Mr;if(v){if(h>0){let e=ct(h);_[e]=(_[e]||0)+1}h=0,m+=1}else{let e=Math.min(f,Nr)/1e3;p+=e,h+=e;let t=o.area||`unknown`;g[t]=Y((g[t]||0)+e)}let y={...c,firstSeenAt:c.firstSeenAt||o.createdAt||s,lastSeenAt:s,lastHeartbeatAt:s,playSeconds:Math.round(p),sessions:m,curSessionSeconds:Math.round(h),areaSeconds:g,sessionLengths:_,...l?{language:l}:{},...u?{edition:c.edition===`demo`?`demo`:u}:{}};await i.Player.patch(t,{metrics:it(y)});let b=F(o),x=null,S=[],C=[];try{let e=c.lastSeenAt||0,n=v&&e>0&&s-e>6e5,r=await I(i.Placement,b),l=d>0?d:s,u=new Set;for(let t of r)Lt(a.object.get(t.objectId),t,n?e:l,s)&&u.add(t.area);let f=await I(i.BiomeState,b),p=new Set(f.filter(e=>e.unlocked).map(e=>e.biomeId)),m=n?[...p]:[...u].filter(e=>p.has(e)),h=0;for(let e of m){let n=f.find(t=>t.biomeId===e)?.health||0,r=await X(b,t,e,{player:o});h+=Math.max(0,(r.biomeState?.health||0)-n),S.push(...r.newAnimals||[]),C.push(r.biomeState)}if((S.length||C.length)&&await kn(b,t,{addDiscoveries:S,freshBiomeStates:C}),n){let t=r.filter(t=>{let n=a.object.get(t.objectId);return p.has(t.area)&&Lt(n,t,e,s)}).length;(t>0||S.length>0||h>0)&&(x={awayHours:Math.round((s-e)/36e5*10)/10,matured:t,healthGain:h,arrivals:S.map(e=>e.animal?.name).filter(Boolean)})}}catch(e){console.error(`heartbeat growth pass skipped:`,e)}return await Q(t),{ok:!0,metrics:mt({...o,metrics:y}),...S.length?{newAnimals:S}:{},...C.length?{biomeStates:C}:{},...x?{welcomeBack:x}:{}}}},Fr=null,Ir=3e4;function Lr(e){return String(e).split(/[^0-9]+/).filter(Boolean).map(e=>parseInt(e,10))}function Rr(e,t){let n=Lr(e),r=Lr(t);if(!n.length&&!r.length)return e<t?-1:+(e>t);if(!n.length)return-1;if(!r.length)return 1;let i=Math.max(n.length,r.length);for(let e=0;e<i;e++){let t=n[e]??0,i=r[e]??0;if(t!==i)return t<i?-1:1}return 0}var zr=class extends ${async get(e){let t=k(),r=String(this.getId?.()||e?.id||``).trim();if(r){let e=await t.Player.get(r);if(!e)throw new A(n(`server.err.noSaveWithId`),404);let i=await Tt(r),a=mt(e);return{player:{...a,biomeSummary:i.summary,activation:ht(a,i.summary,e),achievements:await On(r),biomes:i.biomes}}}let i=Date.now(),a;if(Fr&&i-Fr.at<Ir)a=Fr.all;else{let e=[];try{e=await N(t.SoloMetrics)}catch{}a=e.map(e=>{let t={};if(e.snapshot)try{t=typeof e.snapshot==`string`?JSON.parse(e.snapshot):e.snapshot}catch{t={}}let n=t.lastSeenAt||e.updatedAt||null,r=t.createdAt||e.createdAt||i,a=n?Y((i-n)/36e5):null,o=`dormant`;a!=null&&(a<=24?o=`active`:a<=168&&(o=`recent`));let s=t.playSeconds||0,c=Math.round(s+(t.creationMs||0)/1e3),l=Math.max(t.sessions||0,+((t.creationMs||0)>0));return{...t,playerId:e.id,name:e.name||t.name||null,solo:!0,platform:e.platform||null,os:e.os||null,language:e.language||t.language||null,version:e.version||null,build:e.build||null,lastSyncedAt:e.updatedAt||null,counts:t.counts||{},playSeconds:c,playMinutes:Math.round(c/60),avgSessionMinutes:l?Math.round(c/60/l):0,sessions:l,totalActions:t.totalActions||0,currentArea:t.currentArea||null,unlockedBiomes:t.unlockedBiomes||0,tutorialStep:t.tutorialStep||0,activation:t.activation||{},achievements:t.achievements||null,biomeSummary:t.biomeSummary||{biomesUnlocked:0,avgHealth:0,biomesFullyRestored:0,totalAnimalsReturned:0},areaSeconds:t.areaSeconds||{},sessionLengths:t.sessionLengths||{},creationMs:t.creationMs||0,creationSeconds:t.creationSeconds??(t.creationMs?Y(t.creationMs/1e3):null),timeToFirstActionSeconds:t.timeToFirstActionSeconds??null,appearance:t.appearance||null,createdAt:r,lastSeenAt:n,hoursSinceActive:a,minutesSinceActive:n?Y((i-n)/6e4):null,status:o,daysSinceJoined:Math.floor((i-r)/lt),isNewToday:i-r<=lt}}).sort((e,t)=>(t.lastSeenAt||0)-(e.lastSeenAt||0)||t.playSeconds-e.playSeconds),Fr={at:i,all:a}}let o={};for(let e of a){let t=e.version||`unknown`;o[t]=(o[t]||0)+1}let s=Object.keys(o).sort((e,t)=>t.localeCompare(e,void 0,{numeric:!0})),c=[...new Set(a.map(e=>e.edition===`demo`?`demo`:`full`))].sort(),l=[...new Set(a.map(e=>e.platform||`unknown`))].sort(),u=new Set;try{let t=typeof e?.getAll==`function`?[...e.getAll(`exclude`),...e.getAll(`excludeName`)]:[];for(let e of t.flatMap(e=>String(e).split(`,`))){let t=e.trim().toLowerCase();t&&u.add(t)}}catch{}u.size&&(a=a.filter(e=>!u.has(String(e.name||``).trim().toLowerCase())));let d=``;try{let t=typeof e?.getAll==`function`?e.getAll(`version`):[];d=String(t&&t[0]||``).trim()}catch{}let f=`exact`;try{let t=typeof e?.getAll==`function`?e.getAll(`versionMode`):[];String(t&&t[0]||``).trim().toLowerCase()===`min`&&(f=`min`)}catch{}let p=!!d&&d.toLowerCase()!==`all`,m=e=>{if(!p)return!0;let t=e||`unknown`;return f===`min`?Rr(t,d)>=0:t===d};p&&(a=a.filter(e=>m(e.version||`unknown`)));let h=t=>{try{let n=typeof e?.getAll==`function`?e.getAll(t):[];return String(n&&n[0]||``).trim()}catch{return``}},g=h(`edition`),_=h(`platform`);g&&g.toLowerCase()!==`all`&&(a=a.filter(e=>(e.edition===`demo`?`demo`:`full`)===g)),_&&_.toLowerCase()!==`all`&&(a=a.filter(e=>(e.platform||`unknown`)===_));let v=a.length||1,y=e=>Math.round(e/v*100),b={};for(let e of a)for(let[t,n]of Object.entries(e.counts))b[t]=(b[t]||0)+n;let x=a.reduce((e,t)=>e+t.playSeconds,0),S=a.reduce((e,t)=>e+t.sessions,0),C=a.reduce((e,t)=>e+t.totalActions,0),w={activeNow:a.filter(e=>e.minutesSinceActive!=null&&e.minutesSinceActive<=5).length,activeLast24h:a.filter(e=>e.status===`active`).length,activeLast7d:a.filter(e=>e.status===`active`||e.status===`recent`).length,dormant:a.filter(e=>e.status===`dormant`).length,newLast24h:a.filter(e=>i-e.createdAt<=lt).length,newLast7d:a.filter(e=>i-e.createdAt<=7*lt).length},T=e=>{let t={};for(let n of a){let r=e(n)||`unknown`;t[r]=(t[r]||0)+1}return t},ee=T(e=>e.language||`en`),te=T(e=>e.platform),ne=T(e=>e.os),re=T(e=>e.version),ie=T(e=>e.edition||`full`),ae=a.filter(e=>e.sessions>=2).length,E=(e,t)=>e.counts&&(e.counts[t]||0)>0,D={created:a.length,collected:a.filter(e=>e.activation?.collected||E(e,`resourcesCollected`)).length,terraformed:a.filter(e=>e.activation?.terraformed||E(e,`terraformActions`)).length,planted:a.filter(e=>e.activation?.planted||E(e,`plantsPlanted`)).length,crafted:a.filter(e=>e.activation?.crafted||E(e,`itemsCrafted`)).length,placed:a.filter(e=>e.activation?.placed||E(e,`objectsPlaced`)).length,attractedAnimal:a.filter(e=>e.activation?.attractedAnimal||(e.biomeSummary?.totalAnimalsReturned||0)>0).length,upgradedTool:a.filter(e=>e.activation?.upgradedTool||E(e,`toolsUpgraded`)).length,builtHome:a.filter(e=>e.activation?.builtHome||E(e,`homesBuilt`)).length,upgradedHome:a.filter(e=>e.activation?.upgradedHome||E(e,`homeUpgrades`)).length,unlockedSecondBiome:a.filter(e=>e.activation?.unlockedSecondBiome||(e.unlockedBiomes||0)>=2).length},oe={collected:y(D.collected),terraformed:y(D.terraformed),planted:y(D.planted),crafted:y(D.crafted),placed:y(D.placed),attractedAnimal:y(D.attractedAnimal),upgradedTool:y(D.upgradedTool),builtHome:y(D.builtHome),upgradedHome:y(D.upgradedHome),unlockedSecondBiome:y(D.unlockedSecondBiome)},O={};for(let e of a)e.currentArea&&(O[e.currentArea]=(O[e.currentArea]||0)+1);let se=Object.entries(O).sort((e,t)=>t[1]-e[1])[0]?.[0]||null,ce={};for(let e of a){let t=String(e.tutorialStep||0);ce[t]=(ce[t]||0)+1}let le=a.filter(e=>(e.biomeSummary?.biomesUnlocked||0)>0),ue=le.length?Math.round(le.reduce((e,t)=>e+(t.biomeSummary.avgHealth||0),0)/le.length):0,j=a.filter(e=>e.achievements),de=j.reduce((e,t)=>e+(t.achievements.earned||0),0),fe={},M={},pe={};for(let e of j){for(let t of e.achievements.recent||[])t?.id&&(fe[t.id]=(fe[t.id]||0)+1);for(let[t,n]of Object.entries(e.achievements.byCategory||{}))M[t]=(M[t]||0)+n;let t=e.achievements.earned||0,n=t===0?`0`:`${Math.floor((t-1)/10)*10+1}-${(Math.floor((t-1)/10)+1)*10}`;pe[n]=(pe[n]||0)+1}let P={totalDefined:j.reduce((e,t)=>Math.max(e,t.achievements.total||0),0),totalEarned:de,avgPerPlayer:Y(de/(j.length||1)),avgCompletionPct:j.length?Math.round(j.reduce((e,t)=>e+(t.achievements.completion||0),0)/j.length*100):0,avgPoints:Y(j.reduce((e,t)=>e+(t.achievements.points||0),0)/(j.length||1)),byCategory:M,recentDistribution:fe,completionHistogram:pe},F={};for(let e of a)for(let[t,n]of Object.entries(e.areaSeconds||{}))F[t]=(F[t]||0)+n;let I=Object.values(F).reduce((e,t)=>e+t,0),me={};for(let[e,t]of Object.entries(F))me[e]=Math.round(t/60);let he={totalSeconds:Math.round(I),byAreaSeconds:F,byAreaMinutes:me,mostTimeArea:Object.entries(F).sort((e,t)=>t[1]-e[1])[0]?.[0]||null},L={"<2m":0,"2-10m":0,"10-30m":0,"30m+":0};for(let e of a)for(let[t,n]of Object.entries(e.sessionLengths||{}))L[t]=(L[t]||0)+n;let ge=a.filter(e=>(e.creationMs||0)>0),_e={savesWithTiming:ge.length,avgCreationSeconds:ge.length?Y(ge.reduce((e,t)=>e+t.creationMs,0)/ge.length/1e3):0,medianCreationSeconds:ge.length?Y([...ge].map(e=>e.creationMs).sort((e,t)=>e-t)[Math.floor(ge.length/2)]/1e3):0},R={},z=(e,t)=>{if(t==null||t===``)return;let n=String(t);(R[e]||={})[n]=(R[e][n]||0)+1};for(let e of a){let t=e.appearance;t&&(z(`skin`,t.skin),z(`hair`,t.hair),z(`outfit`,t.outfit),z(`hat`,t.hat),z(`hatColor`,t.hatColor),z(`hairstyle`,t.hairstyle),z(`beard`,t.beard),z(`body`,t.body))}let ve={savesWithAppearance:a.filter(e=>e.appearance).length,choices:R},ye=a.filter(e=>e.timeToFirstActionSeconds!=null),be={playersMeasured:ye.length,avgSeconds:ye.length?Y(ye.reduce((e,t)=>e+t.timeToFirstActionSeconds,0)/ye.length):0},xe=a.filter(e=>e.prefs&&typeof e.prefs==`object`),Se=xe.length||1,B=e=>xe.filter(t=>e(t.prefs)).length,Ce=e=>{let t={};for(let n of xe){let r=e(n.prefs)||`unknown`;t[r]=(t[r]||0)+1}return t},we=B(e=>e.musicEnabled===!1),Te=B(e=>e.sfxEnabled===!1),Ee={savesReporting:xe.length,audio:{musicOff:we,sfxOff:Te,fullyMuted:B(e=>e.musicEnabled===!1&&e.sfxEnabled===!1),musicOffPct:Math.round(we/Se*100),sfxOffPct:Math.round(Te/Se*100)},accessibility:{reduceMotion:B(e=>e.reduceMotion===!0),dyslexiaFont:B(e=>e.dyslexiaFont===!0),colorblindOn:B(e=>e.colorblindMode&&e.colorblindMode!==`off`),anyEnabled:B(e=>e.reduceMotion===!0||e.dyslexiaFont===!0||e.colorblindMode&&e.colorblindMode!==`off`||e.textScale&&e.textScale!==`md`),colorblindModes:Ce(e=>e.colorblindMode||`off`),textScales:Ce(e=>e.textScale||`md`)}},V=[];try{V=await N(t.AppOpen)}catch{}p&&(V=V.filter(e=>m(e.version||`unknown`))),g&&g.toLowerCase()!==`all`&&(V=V.filter(e=>(e.edition===`demo`?`demo`:`full`)===g)),_&&_.toLowerCase()!==`all`&&(V=V.filter(e=>(e.platform||`unknown`)===_));let H=V.length,U=V.filter(e=>e.converted).length,W=V.filter(e=>e.edition===`demo`),G=W.filter(e=>e.converted).length,De=W.filter(e=>e.reachedDemoGoal).length,Oe={demoInstalls:W.length,createdCharacter:G,reachedGoal:De,completionPct:G?Math.round(De/G*100):0},ke={};for(let e of V){let t=e.edition===`demo`?`demo`:`full`;ke[t]=(ke[t]||0)+1}let Ae=V.filter(e=>(e.creationMs||0)>0),je=V.reduce((e,t)=>e+(t.savesCreated||0),0),Me={};for(let e of V){let t=String(e.savesCreated||0);Me[t]=(Me[t]||0)+1}let Ne={devices:H,totalOpens:V.reduce((e,t)=>e+(t.opens||0),0),converted:U,bounced:H-U,conversionPct:H?Math.round(U/H*100):0,bounceRatePct:H?Math.round((H-U)/H*100):0,avgCreatorSeconds:Ae.length?Y(Ae.reduce((e,t)=>e+t.creationMs,0)/Ae.length/1e3):0,totalCharactersCreated:je,avgCharactersPerPerson:H?Y(je/H):0,avgCharactersPerConverted:U?Y(je/U):0,charactersPerPersonHistogram:Me,editions:ke};return{generatedAt:i,source:`solo-metrics`,filters:{availableVersions:s,availableEditions:c,availablePlatforms:l,version:p?d:null,versionMode:p?f:null,edition:g&&g.toLowerCase()!==`all`?g:null,platform:_&&_.toLowerCase()!==`all`?_:null},summary:{players:a.length,soloPlayers:a.length,excludedNames:[...u],audience:w,languages:ee,platforms:te,operatingSystems:ne,versions:re,editions:ie,engagement:{totalPlayHours:Y(x/3600),totalPlaySeconds:x,avgPlayMinutesPerPlayer:Math.round(x/60/v),totalSessions:S,avgSessionsPerPlayer:Y(S/v),avgSessionMinutes:S?Math.round(x/60/S):0,totalActions:C,avgActionsPerPlayer:Y(C/v)},retention:{returningPlayers:ae,returningRatePct:y(ae)},progression:{avgBiomeHealth:ue,biomesFullyRestored:a.reduce((e,t)=>e+(t.biomeSummary?.biomesFullyRestored||0),0),avgUnlockedBiomes:Y(a.reduce((e,t)=>e+(t.unlockedBiomes||0),0)/v),mostPopularArea:se,tutorialStepHistogram:ce},areaDwell:he,sessionLengthDistribution:L,creation:_e,appearancePopularity:ve,timeToFirstAction:be,acquisition:Ne,demoCompletion:Oe,settings:Ee,funnel:D,funnelPct:oe,actionTotals:b,achievements:P},players:a}}},Br=class extends ${async get(){let e=String(this.getId?.()||``).trim();if(!e)throw new A(n(`server.err.snapshotPathId`));await K(e);let t=k(),r=await B(),i=(await P(t.BiomeState,e)).filter(e=>e.unlocked),a=await P(t.Placement,e),o=await P(t.TerrainTile,e);return{ok:!0,playerId:e,areas:i.map(e=>{let t=r.biome.get(e.biomeId),n=a.filter(t=>t.area===e.biomeId),i=o.filter(t=>t.area===e.biomeId),s=Ct(r,t,e.health||0,n,i);return{area:e.biomeId,name:t?.name||e.biomeId,health:e.health||0,placements:n.length,image:wt(s),svg:s}})}}},Vr=class extends ${async post(e){let{playerId:t,action:r,area:i,amount:a,value:o,resources:s,animalId:c}=await Z(e),l=k(),u=await B(),{player:f}=await K(t),p=[];switch(r){case`set-time`:{let e=String(o||`dawn`),n=O(f),r=h(n,e)-n;await l.Player.patch(t,{clockOffsetMs:(f.clockOffsetMs||0)+r}),p.push(`Set time to ${e}`);break}case`reset-clock`:{let e=Math.round((q(f)?.playSeconds||0)*1e3);await l.Player.patch(t,{clockOffsetMs:h(0,`day`)-e}),p.push(`Reset the game clock to the first morning`);break}case`seed-water`:{let e=i||`wetland`;for(let n of(await P(l.TerrainTile,t)).filter(t=>t.area===e))await l.TerrainTile.delete(n.id);await Xt(t,t,e),await X(t,t,e,{player:f}),p.push(`Reseeded starting terrain for ${e}`);break}case`clear-terrain`:{let e=i||f.area,n=0;for(let r of(await P(l.TerrainTile,t)).filter(t=>t.area===e))await l.TerrainTile.delete(r.id),n++;await X(t,t,e,{player:f}),p.push(`Cleared ${n} terrain tiles in ${e}`);break}case`grant-resources`:{let e={...f.inventory||{}},n=new Set(u.resources.map(e=>e.id)),r=0;if(s&&typeof s==`object`){for(let[t,i]of Object.entries(s)){let a=Math.floor(Number(i)||0);a>0&&n.has(t)&&(e[t]=(e[t]||0)+a,r++)}p.push(`Granted ${r} resource type${r===1?``:`s`}`)}else{let t=Math.max(1,Number(a)||200);for(let n of u.resources)e[n.id]=(e[n.id]||0)+t;p.push(`Granted ${t} of every resource`)}await l.Player.patch(t,{inventory:e});break}case`max-tools`:{let e={...f.tools||{}};for(let t of u.tools){let n=Math.max(...t.tiers.map(e=>e.tier));e[t.id]=n}await l.Player.patch(t,{tools:e}),p.push(`All tools set to max tier`);break}case`unlock-all`:{let e=u.biomes.map(e=>e.id);await l.Player.patch(t,{unlockedBiomes:e});for(let n of e)await l.BiomeState.patch(`${t}:${n}`,{unlocked:!0});p.push(`Unlocked all biomes (${e.length})`);break}case`unlock-next`:{let e=[...u.biomes].sort((e,t)=>(e.order||0)-(t.order||0)),n=new Set(f.unlockedBiomes||[`meadow`]),r=e.find(e=>!n.has(e.id));if(!r){p.push(`Every biome is already unlocked`);break}n.add(r.id),await l.Player.patch(t,{unlockedBiomes:[...n]}),await l.BiomeState.patch(`${t}:${r.id}`,{unlocked:!0}),await Xt(t,t,r.id),p.push(`Unlocked the next area: ${r.name}`);break}case`relock-all`:await l.Player.patch(t,{unlockedBiomes:[`meadow`]});for(let e of u.biomes)await l.BiomeState.patch(`${t}:${e.id}`,{unlocked:e.id===`meadow`});p.push(`Re-locked every biome except the meadow`);break;case`reset-tools`:await l.Player.patch(t,{tools:{...Le}}),p.push(`Tools reset to tier 1`);break;case`restart-game`:{let e=t;for(let e of await P(l.Placement,t))await l.Placement.delete(e.id);for(let e of await P(l.Chest,t))await l.Chest.delete(e.id);for(let e of await P(l.TerrainTile,t))await l.TerrainTile.delete(e.id);for(let e of await P(l.Discovery,t))await l.Discovery.delete(e.id);for(let e of await P(l.NodeState,t))await l.NodeState.delete(e.id);for(let e of await P(l.FeedEntry,t))await l.FeedEntry.delete(e.id);for(let e of await P(l.PlayerAchievement,t))await l.PlayerAchievement.delete(e.id);for(let n of u.biomes)await l.BiomeState.put({id:`${e}:${n.id}`,worldId:e,playerId:t,biomeId:n.id,health:we,balance:0,returnedCount:0,unlocked:n.id===`meadow`});let n=`pl_${t}_starter-chest`;await l.Placement.put({id:n,worldId:e,playerId:t,objectId:`small-chest`,area:`meadow`,x:$e.x,y:$e.y,placedAt:Date.now()}),await l.Chest.put({id:n,worldId:e,playerId:t,area:`meadow`,x:$e.x,y:$e.y,size:`small-chest`,capacity:$e.capacity,contents:{}}),await l.Player.patch(t,{area:`meadow`,x:24.5,y:6.5,inventory:{...Ie},craftedItems:{},craftedEver:{},tools:{...Le},unlockedBiomes:[`meadow`],visitedBiomes:[`meadow`],tutorialStep:0,home:{...U},customGoals:[],goalClaims:{},devUnlockAll:!1,clockOffsetMs:h(0,`day`)-Math.round((q(f)?.playSeconds||0)*1e3)}),p.push(`Restarted the game — fresh save (name, passcode & look kept)`);break}case`build-home`:{let e=o&&H[o]?o:`cabin`,n={...G(f),style:e,space:Math.max(2,G(f).space||1),styleLocked:!0};await l.Player.patch(t,{home:n}),p.push(`Built home: ${H[e].name}`);break}case`max-home`:{let e={style:o&&H[o]?o:G(f).style||`cabin`,space:W.space.levels.length,comfort:W.comfort.levels.length,decor:W.decor.levels.length,light:W.light.levels.length,styleLocked:!0};await l.Player.patch(t,{home:e}),p.push(`Home maxed on every track`);break}case`reset-home`:await l.Player.patch(t,{home:{...U}}),p.push(`Home reset to the starter tent`);break;case`set-health`:{let e=i||f.area,n=Math.max(0,Math.min(100,Number(o)||100));await l.BiomeState.patch(`${t}:${e}`,{health:n}),p.push(`Set ${e} health to ${n}% (recomputes on next change)`);break}case`reset-biome`:{let e=i||f.area,n=0;for(let r of(await P(l.Placement,t)).filter(t=>t.area===e))u.object.get(r.objectId)?.isChest||(await l.Placement.delete(r.id),n++);for(let n of(await P(l.TerrainTile,t)).filter(t=>t.area===e))await l.TerrainTile.delete(n.id);let r=0;for(let n of(await P(l.Discovery,t)).filter(t=>t.biomeId===e))await l.Discovery.delete(n.id),r++;let a=`${t}:${e}:`;for(let e of(await P(l.NodeState,t)).filter(e=>String(e.id).startsWith(a)))await l.NodeState.delete(e.id);await l.BiomeState.patch(`${t}:${e}`,{health:we,balance:0,returnedCount:0}),await Xt(t,t,e),await X(t,t,e,{player:f}),p.push(`Reset ${e} to its damaged state — removed ${n} object${n===1?``:`s`} and sent ${r} animal${r===1?``:`s`} away (chests kept)`);break}case`lock-biome`:{let e=i||f.area;if(e===`meadow`)throw new A(n(`server.err.meadowCannotLock`));let r=(f.unlockedBiomes||[]).filter(t=>t!==e);await l.Player.patch(t,{unlockedBiomes:r}),await l.BiomeState.patch(`${t}:${e}`,{unlocked:!1}),p.push(`Locked ${e} again (unlock requirements must be met to re-enter)`);break}case`unlock-recipes`:{let e=o===void 0?!f.devUnlockAll:!!o;await l.Player.patch(t,{devUnlockAll:e}),p.push(e?`All recipes unlocked (gates ignored)`:`Recipe progress gates restored`);break}case`welcome-animals`:{let e=i||f.area,n=u.animals.filter(t=>t.biome===e),r=new Set((await P(l.Discovery,t)).filter(t=>t.biomeId===e).map(e=>e.animalId)),a=0;for(let i of n)r.has(i.id)||(await l.Discovery.put({id:`${t}:${i.id}`,playerId:t,animalId:i.id,biomeId:e,comfort:3,timesObserved:0,firstObservedAt:Date.now(),whyReturned:Jt(i,u)}),a++);await X(t,t,e,{player:f}),p.push(`Welcomed ${a} animal${a===1?``:`s`} to ${e} (${n.length} total)`);break}case`spawn-animal`:{let e=u.animals.find(e=>e.id===c);if(!e)throw new A(n(`server.err.unknownAnimal`,{animal:c}));let r=`${t}:${e.id}`;await l.Discovery.get(r)||await l.Discovery.put({id:r,playerId:t,animalId:e.id,biomeId:e.biome,comfort:85,timesObserved:1,firstObservedAt:Date.now(),whyReturned:Jt(e,u)});let i=f.unlockedBiomes||[`meadow`];i.includes(e.biome)||await l.Player.patch(t,{unlockedBiomes:[...i,e.biome]}),await X(t,t,e.biome,{player:f}),await l.Discovery.patch(r,{comfort:85}),p.push(`Spawned ${e.name} in ${e.biome} — comfort 85, biome unlocked`);break}case`populate-biome`:{let e=i||f.area,r=u.biome.get(e);if(!r||e===`home`)throw new A(n(`server.err.cannotPopulate`,{area:e}));let a=F(f),o=new Set(f.unlockedBiomes||[`meadow`]);o.has(e)||(o.add(e),await l.Player.patch(t,{unlockedBiomes:[...o]}));for(let t of(await I(l.Placement,a)).filter(t=>t.area===e))u.object.get(t.objectId)?.isChest||await l.Placement.delete(t.id);for(let t of(await I(l.TerrainTile,a)).filter(t=>t.area===e))await l.TerrainTile.delete(t.id);let s=yt(u,e),c=e===`alpine`?vt:0,d=(e===`coastal`?s.cols-(r.oceanCols||0):s.cols)-2,m=c+2,h=s.rows-2,g=(t,n)=>e===`meadow`&&t>=19&&t<=24&&n>=3&&n<=6,_=Date.now()-3888e6,v=le(ce(`populate:${a}:${e}`)),y=(e,t)=>e+Math.floor(v()*(t-e+1)),b=e=>e[Math.floor(v()*e.length)],x=new Set;(await I(l.Chest,a)).filter(t=>t.area===e).forEach(e=>x.add(`${e.x},${e.y}`));let S=(e,t)=>e>=2&&e<=d&&t>=m&&t<=h&&!g(e,t)&&!x.has(`${e},${t}`),C=[],w=(e,t)=>{S(e,t)&&(x.add(`${e},${t}`),C.push({x:e,y:t}))};if(r.canFlood!==!1){let e=y(3,Math.max(3,Math.min(d-4,10))),t=y(m+1,Math.max(m+1,Math.min(h-3,m+6)));for(let n=0;n<3;n++)for(let r=0;r<4;r++)(r!==0&&r!==3||n!==0&&n!==2)&&w(e+r,t+n);w(e+1,t-1),w(e+2,t+3);let n=y(Math.floor((2+d)/2),d-2),r=m;w(n,r);for(let e=0,t=y(13,18);e<t&&r<h;e++)v()<.25&&n>3&&n<d-1?n+=v()<.5?-1:1:r+=1,w(n,r),v()<.25&&w(Math.min(d,n+1),r)}let T=u.objects.filter(t=>(t.biomes||[]).includes(e)&&t.placement!==`indoor`&&t.placement!==`none`&&!t.isChest&&!t.bridge);if(!T.length)throw new A(n(`server.err.noPlaceableObjects`,{biome:r.name}));let ee=e=>/-path$/.test(e.id)||e.id===`wooden-fence`||e.id===`dry-stone-wall`,te=T.filter(e=>e.plantable&&(e.growSeconds||0)>=80),ne=T.filter(e=>e.plantable&&(e.growSeconds||0)<80),re=new Set([`shrub`,`rock-pile`,`hollow-log`,`log-shelter`,`brush-pile`,`stone-cairn`,`rock-cairn`,`clover-patch`,`butterfly-flowers`,`pollinator-garden`,`fallen-branch-shelter`,`insect-hotel`,`birdhouse`,`bird-perch`]),ie=T.filter(e=>!e.plantable&&!ee(e)&&re.has(e.id)),ae=T.filter(ee),E=T.filter(e=>!e.plantable&&!ee(e)&&!re.has(e.id)),D=ie.length?ie:ne,oe=[],O=(n,r,i)=>{if(!n||!S(r,i))return!1;x.add(`${r},${i}`);let o={id:`pl_dev_${e}_${r}_${i}`,worldId:a,playerId:t,objectId:n.id,area:e,x:r,y:i,placedAt:_};return n.plantable&&(o.plantedAt=_),oe.push(o),!0},k=(e,t,n,r,i)=>{if(!e.length)return;let a=v()<.65?b(e):null;for(let o=0,s=0;o<r&&s<r*8;s++){let r=a&&v()<.7?a:b(e);O(r,t+y(-i,i),n+y(-i,i))&&o++}};for(let e=0,t=y(8,12);e<t;e++){let e=y(2,d),t=y(m,h),n=v();n<.4&&ne.length?k(ne,e,t,y(4,8),2):n<.72&&te.length?(k(te,e,t,y(2,4),2),k(D,e,t,y(1,3),2)):k(D,e,t,y(3,6),2)}if(ae.length)for(let e=0,t=y(1,2);e<t;e++){let e=b(ae),t=v()<.5,n=y(4,6),r=y(2,Math.max(2,d-(t?n:0))),i=y(m,Math.max(m,h-(t?0:n)));for(let a=0;a<n;a++)O(e,r+(t?a:0),i+(t?0:a))}for(let e=0,t=0,n=y(14,20);E.length&&e<n&&t<n*12;t++)O(b(E),y(2,d),y(m,h))&&e++;for(let e=0;oe.length<34&&e<500;e++)O(b(T),y(2,d),y(m,h));for(let n of C)await l.TerrainTile.put({id:`${a}:${e}:${n.x}:${n.y}`,worldId:a,playerId:t,area:e,x:n.x,y:n.y,type:`water`,updatedAt:Date.now()});for(let e of oe)await l.Placement.put(e);let se=C.length,ue=oe.length,j=u.animals.filter(t=>t.biome===e),de=new Set((await I(l.Discovery,a)).filter(t=>t.biomeId===e).map(e=>e.animalId));for(let n of j)de.has(n.id)||await l.Discovery.put({id:`${a}:${n.id}`,worldId:a,playerId:t,animalId:n.id,biomeId:e,comfort:90,timesObserved:0,firstObservedAt:Date.now(),whyReturned:Jt(n,u)});await X(a,t,e,{player:f});let fe=await L(l.BiomeState,a,e);await l.BiomeState.patch(fe?.id??`${a}:${e}`,{health:100,balance:100,returnedCount:j.length});for(let t of(await I(l.Discovery,a)).filter(t=>t.biomeId===e))await l.Discovery.patch(t.id,{comfort:90});p.push(`Populated ${r.name}: ${ue} objects, ${se} water tiles, ${j.length} animals home, health 100`);break}case`set-weather`:{let e=o&&typeof o==`object`?o:null;if(!e||e.clear){await l.Player.patch(t,{devWeather:null}),p.push(`Weather override cleared — back to the live sky`);break}let r=f.devWeather||{},i={type:r.type??null,season:r.season??null};if(`type`in e){if(e.type&&!d.includes(e.type))throw new A(n(`server.err.unknownWeatherType`,{type:e.type}));i.type=e.type||null}if(`season`in e){if(e.season&&!g.includes(e.season))throw new A(n(`server.err.unknownSeason`,{season:e.season}));i.season=e.season||null}await l.Player.patch(t,{devWeather:i}),p.push(`Weather override: ${i.type||`live`} · ${i.season||`live`}`);break}default:throw new A(n(`server.err.unknownDevAction`,{action:r}))}return{ok:!0,log:p,state:await Tn(t)}}},Hr=4e3,Ur=class extends ${async post(e){let t=await Z(e),r=String(t.message||``).trim();if(!r)throw new A(n(`server.err.feedbackEmpty`));if(r.length>Hr)throw new A(n(`server.err.feedbackTooLong`,{max:Hr}));let i=String(t.replyTo||``).trim().slice(0,200)||null;if(i&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(i))throw new A(n(`server.err.feedbackBadEmail`));let a=t.metrics&&typeof t.metrics==`object`&&!Array.isArray(t.metrics)?t.metrics:{},o=Number(t.queuedAt)||null,s=`fb_${Date.now()}_${Math.random().toString(36).slice(2,10)}`;return await k().Feedback.put({id:s,message:r,replyTo:i,metrics:a,queuedAt:o,createdAt:Date.now()}),{ok:!0,id:s}}},Wr=class extends Resource{async get(){let e=await N(k().Feedback);return e.sort((e,t)=>(t.createdAt||0)-(e.createdAt||0)),{count:e.length,feedback:e}}},Gr=24e3,Kr=class extends ${async post(e){let t=await Z(e),r=String(t.clientId||``).trim().slice(0,64);if(!r)throw new A(n(`server.err.clientIdRequired`));let i=t.snapshot&&typeof t.snapshot==`object`&&!Array.isArray(t.snapshot)?t.snapshot:null;if(!i)throw new A(n(`server.err.snapshotRequired`));let a=JSON.stringify(i);if(a.length>Gr)throw new A(n(`server.err.snapshotTooLarge`));let o=k(),s=`solo:${r}`,c=await M(o.SoloMetrics,s);return await o.SoloMetrics.put({id:s,clientId:r,name:String(t.name||i.name||``).slice(0,40),platform:String(t.platform||``).slice(0,20)||null,os:String(t.os||``).slice(0,20)||null,version:String(t.version||``).slice(0,24)||null,build:String(t.build||``).slice(0,40)||null,language:String(t.language||i.language||``).trim().toLowerCase().slice(0,12)||null,snapshot:a,createdAt:c?.createdAt||Date.now(),updatedAt:Date.now()}),Fr=null,{ok:!0}}},qr=class extends ${async post(e){let t=await Z(e),r=String(t.deviceId||``).trim().slice(0,64);if(!r)throw new A(n(`server.err.deviceIdRequired`));let i=t.phase===`created`?`created`:t.phase===`demo_done`?`demo_done`:`open`,a=Date.now(),o=k(),s=`dev:${r}`,c=await M(o.AppOpen,s),l=se(Math.round(Number(t.creationMs)||0),0,36e5);return await o.AppOpen.put({id:s,deviceId:r,platform:String(t.platform||``).slice(0,20)||c?.platform||null,os:String(t.os||``).slice(0,20)||c?.os||null,version:String(t.version||``).slice(0,24)||c?.version||null,edition:t.edition===`demo`||c?.edition===`demo`?`demo`:t.edition===`full`?`full`:c?.edition||null,language:String(t.language||``).trim().toLowerCase().slice(0,12)||c?.language||null,firstOpenAt:c?.firstOpenAt||a,lastOpenAt:a,opens:(c?.opens||0)+ +(i===`open`),converted:c?.converted||i===`created`,firstConvertedAt:c?.firstConvertedAt||(i===`created`?a:0),savesCreated:(c?.savesCreated||0)+ +(i===`created`),creationMs:i===`created`&&l>0?l:c?.creationMs||0,reachedDemoGoal:c?.reachedDemoGoal||i===`demo_done`,demoGoalAt:c?.demoGoalAt||(i===`demo_done`?a:0),updatedAt:a}),Fr=null,{ok:!0}}},Jr=e=>({status:200,headers:{"content-type":`text/html; charset=utf-8`,"cache-control":`public, max-age=3600`},body:e}),Yr=class extends ${async get(){return Jr(w)}},Xr=class extends ${async get(){return Jr(T)}},Zr=class extends ${async get(){return Jr(ee)}},Qr=class extends ${async get(){return Jr(te)}};export{qr as AppOpen,jr as AppendFeed,Br as BiomeSnapshot,Bn as ChangePasscode,qn as CheckWorldCode,ir as ChestTransfer,Er as ClaimTask,rr as CollectResource,or as CraftItem,In as CreatePlayer,Wn as CreateWorld,Rn as DeleteDemoSave,Ln as DeletePlayer,Vr as DevTools,ar as DiscardItem,zn as ExportDemoSave,Fn as GameData,Hn as GameState,pr as HarvestPlacement,Pr as Heartbeat,Yn as JoinRequestStatus,Kn as JoinWorld,er as LeaveWorld,Wr as ListFeedback,Vn as LoginPlayer,zr as Metrics,hr as MoveObject,Un as MyWorlds,Tr as ObserveAnimal,Xn as PendingJoinRequests,ur as PlaceObject,dr as Plant,nr as Presence,kr as RecalcBiome,gr as RemoveObject,Jn as RequestJoin,Zn as ResolveJoin,br as Rest,Dr as SetGoals,Sr as SetHomeColors,wr as SetHomeStyle,Cr as SetPlacementColor,Ur as SubmitFeedback,$n as SwitchWorld,Kr as SyncMetrics,Ar as SyncPlayer,Or as Terraform,mr as UpdateAppearance,vr as UpgradeHome,_r as UpgradeTool,An as Version,Qn as WorldRoster,Xr as"age-rating",Qr as dashboard,Pt as healthCapForReturns,Yr as privacy,Zr as support};