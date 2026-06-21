'use strict';

/**
 * Harper bootstrap for the Wild Willows desktop app.
 *
 * In the web build, Harper serves BOTH the static `web/**` files and the REST
 * API on a single port. The desktop app reuses that exactly: we spawn a local
 * Harper instance and point the Electron window at it. No game logic moves to
 * the client — Harper stays the source of truth, just running on localhost.
 *
 * Two things have to be writable at runtime, which the packaged app install dir
 * is NOT:
 *   1. Harper's root path (database, config, certs, logs) -> userData/harper-root
 *   2. The component, because Harper (a separate process) can't read files from
 *      inside an asar archive                              -> userData/component
 *
 * Verified against the bundled Harper 5.1.0:
 *   - First launch runs `harper install` into a private ROOTPATH. The installer
 *     writes a COMPLETE, schema-valid config and generates the TLS certs, JWT
 *     keys, super-user and database dir that a hand-written config can't.
 *     Providing ROOTPATH + HDB_ADMIN_USERNAME + HDB_ADMIN_PASSWORD makes it
 *     unattended (otherwise it prompts on stdin).
 *   - Because we pass ROOTPATH, the installer will NOT overwrite an existing
 *     valid boot-properties file, so a developer's global Harper is left alone.
 *   - Config env vars (HTTP_SECUREPORT, AUTHENTICATION_AUTHORIZELOCAL) are baked
 *     into the generated config at install time.
 *   - Later launches just `harper run <component>` against that ready root.
 */

const { spawn } = require('node:child_process');
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const crypto = require('node:crypto');

const PORT = Number(process.env.WW_HARPER_PORT) || 9926;
const HOST = '127.0.0.1';
const BASE_URL = `https://${HOST}:${PORT}/`;

const COMPONENT_ENTRIES = ['config.yaml', 'schema.graphql', 'resources.js', 'data', 'web'];

let child = null;
let logStream = null;
let logFilePath = null;
const recentLines = [];

function log(...args) {
	console.log('[harper]', ...args);
}

function record(chunk) {
	const text = chunk.toString();
	process.stdout.write(`[harper] ${text}`);
	if (logStream) logStream.write(text);
	for (const line of text.split('\n')) {
		if (!line.trim()) continue;
		recentLines.push(line);
		if (recentLines.length > 60) recentLines.shift();
	}
}

function bundledComponentDir(app) {
	if (!app.isPackaged) return path.join(__dirname, '..');
	const fromResources = path.join(process.resourcesPath, 'component');
	if (fs.existsSync(fromResources)) return fromResources;
	return path.join(__dirname, '..');
}

/** Recursively copy the component into a writable dir, version-gated. */
function syncComponent(app) {
	const src = bundledComponentDir(app);
	const dest = path.join(app.getPath('userData'), 'component');
	const stampFile = path.join(dest, '.ww-version');
	const wantVersion = app.getVersion();

	let haveVersion = null;
	try { haveVersion = fs.readFileSync(stampFile, 'utf8').trim(); } catch { /* not synced */ }
	if (haveVersion === wantVersion && app.isPackaged) {
		log('component up to date', wantVersion);
		return dest;
	}

	log(`syncing component -> ${dest}`);
	fs.mkdirSync(dest, { recursive: true });
	for (const entry of COMPONENT_ENTRIES) {
		const from = path.join(src, entry);
		const to = path.join(dest, entry);
		if (!fs.existsSync(from)) { log(`  (skip missing ${entry})`); continue; }
		fs.rmSync(to, { recursive: true, force: true });
		fs.cpSync(from, to, { recursive: true });
	}
	fs.writeFileSync(stampFile, wantVersion);
	return dest;
}

/**
 * Resolve how to launch the Harper CLI.
 *  - Prefer the bundled Harper package, run with Electron's own Node runtime
 *    (ELECTRON_RUN_AS_NODE) so we don't depend on a system install.
 *  - Fall back to a `harper` on PATH.
 * Returns a function (subArgs) => { command, args, useElectronNode }.
 */
function resolveHarperLauncher() {
	if (process.env.WW_HARPER_CLI) {
		return (subArgs) => ({ command: process.execPath, args: [process.env.WW_HARPER_CLI, ...subArgs], useElectronNode: true });
	}

	let cliEntry = null;
	try {
		const pkgJsonPath = require.resolve('harper/package.json', {
			paths: [path.join(__dirname, '..'), process.resourcesPath || __dirname],
		});
		const pkgDir = path.dirname(pkgJsonPath);
		const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
		const binRel = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin && (pkg.bin.harper || Object.values(pkg.bin)[0]);
		if (binRel) cliEntry = path.join(pkgDir, binRel);
	} catch { /* fall back below */ }

	if (cliEntry && fs.existsSync(cliEntry)) {
		return (subArgs) => ({ command: process.execPath, args: [cliEntry, ...subArgs], useElectronNode: true });
	}

	const command = process.platform === 'win32' ? 'harper.cmd' : 'harper';
	return (subArgs) => ({ command, args: subArgs, useElectronNode: false });
}

/**
 * Base dir for Harper's root + isolated home. Harper's config validator rejects
 * `rootPath` values containing spaces or dots (pattern: [\/a-zA-Z_0-9:-]), so we
 * CANNOT use Electron's userData (`~/Library/Application Support/…` has a space).
 * The user's home dir is space/dot-free on macOS and typical Linux; we guard for
 * the Windows case where a username can contain a space.
 */
function harperBaseDir(app) {
	const candidate = path.join(app.getPath('home'), 'WildWillows');
	const withoutDrive = candidate.replace(/^[A-Za-z]:/, ''); // ignore Windows "C:"
	if (!/[ .]/.test(withoutDrive)) return candidate;
	if (process.platform === 'win32') return path.join(process.env.SystemDrive || 'C:', 'WildWillows');
	return path.join('/Users/Shared', 'WildWillows');
}

/** Stable admin password for the LOCAL install (loopback only). Generated once. */
function localAdminPassword(app) {
	const secretFile = path.join(app.getPath('userData'), '.ww-harper-secret');
	try { return fs.readFileSync(secretFile, 'utf8').trim(); } catch { /* generate */ }
	const pw = crypto.randomBytes(24).toString('hex');
	fs.writeFileSync(secretFile, pw, { mode: 0o600 });
	return pw;
}

/** A root is ready to run once the installer has produced a config + database. */
function isInstalled(rootPath) {
	return fs.existsSync(path.join(rootPath, 'harper-config.yaml')) &&
		fs.existsSync(path.join(rootPath, 'database'));
}

/** Clear a half-finished root (e.g. left by an earlier failed attempt). */
function clearStaleRoot(rootPath) {
	for (const f of ['harper-config.yaml', '.ww-config-version', '.ww-seeded']) {
		try { fs.rmSync(path.join(rootPath, f), { force: true }); } catch { /* ignore */ }
	}
}

/** Reject fast if something is already on our port. */
function checkPortFree() {
	return new Promise((resolve, reject) => {
		const socket = net.connect({ host: HOST, port: PORT });
		socket.setTimeout(1500);
		socket.on('connect', () => {
			socket.destroy();
			reject(new Error(`Port ${PORT} is already in use. Stop any dev Harper, or set WW_HARPER_PORT.`));
		});
		socket.on('timeout', () => { socket.destroy(); resolve(); });
		socket.on('error', () => resolve());
	});
}

/**
 * Build the subprocess env. We point HOME/USERPROFILE at an isolated dir so
 * Harper's installer never sees (or clobbers) a developer's GLOBAL Harper install
 * — its boot-properties file lives at `<home>/.harperdb/...`. Without this, the
 * installer detects the global install and crashes querying its system DB.
 */
function launcherEnv(rootPath, homeDir, extra) {
	return {
		...process.env,
		HOME: homeDir,
		USERPROFILE: homeDir,
		ROOTPATH: rootPath,
		NODE_ENV: 'production',
		...extra,
	};
}

/** Spawn a Harper CLI subcommand. Returns the ChildProcess. */
function spawnHarper(makeCmd, subArgs, cwd, env) {
	const { command, args, useElectronNode } = makeCmd(subArgs);
	const fullEnv = useElectronNode ? { ...env, ELECTRON_RUN_AS_NODE: '1' } : env;
	log('launch:', command, args.join(' '));
	const proc = spawn(command, args, { cwd, env: fullEnv, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
	proc.stdout.on('data', record);
	proc.stderr.on('data', record);
	return proc;
}

/** Run `harper install` to completion (unattended). */
function runInstall(makeCmd, rootPath, env, { timeoutMs = 6 * 60 * 1000 } = {}) {
	return new Promise((resolve, reject) => {
		const proc = spawnHarper(makeCmd, ['install'], rootPath, env);
		const timer = setTimeout(() => { try { proc.kill('SIGTERM'); } catch {} reject(new Error('Harper install timed out')); }, timeoutMs);
		proc.on('error', (err) => { clearTimeout(timer); reject(err); });
		proc.on('exit', (code) => {
			clearTimeout(timer);
			if (code === 0) resolve();
			else reject(new Error(`Harper install failed (exit ${code})`));
		});
	});
}

/** Start Harper. Resolves with the URL once the HTTP endpoint answers. */
async function start(app) {
	// Root + isolated home live OUTSIDE userData because Harper's validator
	// forbids spaces/dots in rootPath (see harperBaseDir).
	const base = harperBaseDir(app);
	const rootPath = path.join(base, 'harper-root');
	fs.mkdirSync(rootPath, { recursive: true });

	// Isolated HOME so we never touch / get confused by a global dev Harper.
	const harperHome = path.join(base, 'harper-home');
	fs.mkdirSync(harperHome, { recursive: true });

	const logsDir = path.join(app.getPath('userData'), 'logs');
	fs.mkdirSync(logsDir, { recursive: true });
	logFilePath = path.join(logsDir, 'harper.log');
	logStream = fs.createWriteStream(logFilePath, { flags: 'a' });
	logStream.write(`\n\n===== launch ${new Date().toISOString()} =====\n`);

	await checkPortFree();

	const componentDir = syncComponent(app);
	const makeCmd = resolveHarperLauncher();

	// --- First run: install Harper into our private root (unattended) ---
	if (!isInstalled(rootPath)) {
		clearStaleRoot(rootPath);
		log('installing Harper into', rootPath);
		try {
			await runInstall(makeCmd, rootPath, launcherEnv(rootPath, harperHome, {
				HDB_ADMIN_USERNAME: 'wildwillows',
				HDB_ADMIN_PASSWORD: localAdminPassword(app),
				HTTP_SECUREPORT: String(PORT),
				AUTHENTICATION_AUTHORIZELOCAL: 'true',
			}));
		} catch (err) {
			if (logStream) logStream.write(`\n[bootstrap] install failed: ${err.message}\n${recentLines.slice(-15).join('\n')}\n`);
			throw err;
		}
		log('install complete');
	}

	// --- Run the app against the ready root ---
	const firstSeed = !fs.existsSync(path.join(rootPath, '.ww-seeded'));
	child = spawnHarper(makeCmd, ['run', componentDir], componentDir, launcherEnv(rootPath, harperHome));

	let earlyExit = null;
	child.on('error', (err) => { earlyExit = err; });
	child.on('exit', (code, signal) => {
		log(`exited (code=${code} signal=${signal})`);
		if (code && code !== 0) earlyExit = new Error(`Harper exited with code ${code}`);
		child = null;
	});

	// First boot still seeds the preserve (150 animals / 126 objects / 97 recipes).
	const timeoutMs = firstSeed ? 4 * 60 * 1000 : 90 * 1000;
	try {
		await waitUntilReady({ timeoutMs, getExit: () => earlyExit });
	} catch (err) {
		if (logStream) logStream.write(`\n[bootstrap] start failed: ${err.message}\n${recentLines.slice(-15).join('\n')}\n`);
		throw err;
	}
	try { fs.writeFileSync(path.join(rootPath, '.ww-seeded'), new Date().toISOString()); } catch { /* ignore */ }
	log('ready at', BASE_URL);
	return BASE_URL;
}

/** Poll the local endpoint until Harper answers (any HTTP response = up). */
function waitUntilReady({ timeoutMs = 90000, intervalMs = 600, getExit } = {}) {
	const deadline = Date.now() + timeoutMs;
	return new Promise((resolve, reject) => {
		const attempt = () => {
			const exit = getExit && getExit();
			if (exit) return reject(exit);
			const req = https.get(BASE_URL, { rejectUnauthorized: false, timeout: 2500 }, (res) => { res.resume(); resolve(true); });
			req.on('error', retry);
			req.on('timeout', () => { req.destroy(); retry(); });
		};
		const retry = () => {
			const exit = getExit && getExit();
			if (exit) return reject(exit);
			if (Date.now() > deadline) return reject(new Error(`Harper did not become ready within ${Math.round(timeoutMs / 1000)}s`));
			setTimeout(attempt, intervalMs);
		};
		attempt();
	});
}

/** Stop Harper on app quit. */
function stop() {
	if (logStream) { try { logStream.end(); } catch {} logStream = null; }
	if (!child) return;
	log('stopping');
	try {
		if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/t', '/f']);
		else child.kill('SIGTERM');
	} catch (err) { log('stop error', err); }
	child = null;
}

function getLogFilePath() { return logFilePath; }

module.exports = { start, stop, BASE_URL, PORT, HOST, getLogFilePath };
