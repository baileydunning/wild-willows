// Client for the game API. Every persisted action goes through these calls.
//
// Transport: on the web the frontend talks to its own origin (the deployed
// Harper). On the desktop build there are two backends — SOLO runs the same
// server logic in-app against local save files (fully offline, see src/solo),
// and CO-OP talks to the hosted Harper. `transport` selects which is live.

import type { Appearance, GameData, GameState } from './types';
import { t, getLocale } from './i18n';
import { soloRequest } from './solo/backend';
import { persist as persistSolo, type SaveMeta } from './solo/saves';
import { DEMO, EDITION, DEMO_WEB_BACKEND } from './demo';
import { adaptiveInterval, ewma } from './perf';
import { CHANNEL } from './platform';
import { bridge } from './game/bridge';
import { reportClientError } from './clientErrors';

const STORAGE_KEY = 'wild-willows:last-save';

// Hosted Harper for desktop co-op. (Web builds ignore this and use their own
// origin.) Override-able later via Settings if needed.
//
// The URL is baked into every shipped build (it's also what the metrics
// uplink, app-open ping, feedback, save-incident and client-error reporters
// use), so moving hosts must not mean stranding installed copies. Owning the
// name makes that a DNS change instead of a release. Do NOT put the vendor
// hostname back here.
export const COOP_BASE_URL = 'https://wildwillows.app';

const isDesktop = !!(globalThis as any).wildWillowsDesktop?.isDesktop;

export type Transport = 'web' | 'solo' | 'coop';
// Desktop defaults to solo so the title screen + solo play work with no network;
// the web build normally uses its own origin. The itch demo defaults to the
// offline solo backend too (passwordless, no accounts) unless it's explicitly
// configured for Harper accounts.
const DEMO_SOLO_DEFAULT = DEMO && !isDesktop && DEMO_WEB_BACKEND === 'solo';
let transport: Transport = isDesktop || DEMO_SOLO_DEFAULT ? 'solo' : 'web';
let soloSlot: SaveMeta | null = null;

// ------------------------------------------------------------- demo backend
// The itch DEMO is a WEB build served as static files, so it has no same-origin
// Harper. It talks to the hosted Harper cross-origin (Harper-first). If that
// probe fails (offline, or CORS not allowed for the itch origin), the demo falls
// back to the fully-offline in-app solo backend so it still plays.
const DEMO_WEB = DEMO && !isDesktop;
let demoBackend: 'pending' | 'harper' | 'solo' = !DEMO_WEB
	? 'harper'
	: DEMO_WEB_BACKEND === 'solo'
		? 'solo' // passwordless offline demo — no probe needed
		: 'pending';

// Which backend this device's demo save actually lives in.
//
// The demo has two DISJOINT save stores — server-side players on the hosted
// Harper, and local slot files — and the title screen shows one or the other.
// Resolving that per session from a network probe meant a single slow or blocked
// probe swapped the store out from under the player: their save was still there,
// but on the side the title wasn't looking at, so it read as "my save was
// deleted" and they'd start over. Pinning it to wherever the save was actually
// created makes the store a property of the save, not of tonight's wifi.
const DEMO_HOME_KEY = 'wild-willows:demo-home';

export function getDemoSaveHome(): 'harper' | 'solo' | null {
	try {
		const v = localStorage.getItem(DEMO_HOME_KEY);
		return v === 'harper' || v === 'solo' ? v : null;
	} catch {
		return null;
	}
}

/** Record where a demo save was created, so later sessions look in the right place. */
export function setDemoSaveHome(home: 'harper' | 'solo'): void {
	try {
		localStorage.setItem(DEMO_HOME_KEY, home);
	} catch {
		/* private mode — falls back to per-session probing, as before */
	}
}

/** Forget the pin (the demo save is gone, so the next one starts fresh). */
export function clearDemoSaveHome(): void {
	try {
		localStorage.removeItem(DEMO_HOME_KEY);
	} catch {
		/* ignore */
	}
}

/**
 * True when the player has a demo save on the hosted Harper but this session
 * couldn't reach it. The title screen uses this to say so plainly instead of
 * showing an empty New Game screen over a save that still exists.
 *
 * Requires a remembered save as well as the pin, so a first-time player who is
 * simply offline never sees it — there's nothing of theirs to be unreachable.
 * The two are cleared in different places (the pin when a demo ends, the pointer
 * when the server 404s), so a stale pin must not be enough on its own to accuse
 * the server of hiding a save that isn't there.
 */
let demoHomeUnreachable = false;
export const isDemoSaveUnreachable = () => demoHomeUnreachable && lastSave('solo') != null;

/** The resolved demo backend: 'harper' once the hosted server answered, 'solo'
 *  once we've committed to the offline fallback, 'pending' before the probe. */
export function getDemoBackend(): 'pending' | 'harper' | 'solo' {
	return demoBackend;
}

/**
 * Can we reach the hosted Harper? Throws if not.
 *
 * Probed with the SAME headers real API calls use — Content-Type triggers a CORS
 * preflight, and a bare GET could pass where real calls fail it. This way the
 * probe fails exactly when gameplay would. It asks /Version/ (a few bytes) rather
 * than /GameData/ (~300 KB), which the original probe downloaded and threw away.
 *
 * RETRIED, because a demo player is never really offline: the demo IS a web page
 * they just loaded, so if it rendered at all they have a working connection. A
 * failed probe therefore means the SERVER hiccuped — a cold start, a transient
 * 5xx, a CORS blip — not that the player has no network. Committing to the
 * offline save store on the first stumble stranded people in a different save
 * store over a problem that a second attempt usually clears. The first attempt is
 * generous (cold starts are slow); the retry is short.
 */
async function probeHostedHarper(): Promise<void> {
	const attempts = [8000, 4000];
	let lastErr: unknown;
	for (let i = 0; i < attempts.length; i++) {
		try {
			const res = await fetch(COOP_BASE_URL + '/Version/', {
				headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
				signal: AbortSignal.timeout(attempts[i]),
			});
			if (!res.ok) throw new Error(`status ${res.status}`);
			return;
		} catch (e) {
			lastErr = e;
			if (i < attempts.length - 1) await new Promise((r) => setTimeout(r, 500));
		}
	}
	throw lastErr instanceof Error ? lastErr : new Error('hosted Harper unreachable');
}

/** Probe the hosted Harper once at startup (DEMO web only). On success we keep
 *  the 'web' transport pointed at the hosted Harper; on any failure we commit to
 *  the in-app solo backend for the whole session. A no-op for every other build. */
export async function resolveDemoBackend(): Promise<'harper' | 'solo'> {
	if (!DEMO_WEB) return 'harper';
	if (demoBackend === 'harper') return demoBackend;
	// Solo-default demo (DEMO_WEB_BACKEND === 'solo'): committed to the offline
	// backend before the first request, no probe needed.
	//
	// UNLESS this device pinned a demo save to Harper, which every demo save did
	// back when 'harper' was the default. Short-circuiting here would point those
	// players at the empty offline store: their save is still sitting on the
	// server, but the title screen isn't looking there, and "my save is gone" is
	// what that looks like from the outside. It's the exact failure the
	// DEMO_HOME_KEY pin exists to prevent — the pin just has to be consulted here
	// too, now that 'solo' can be the STARTING value and not only a fallback.
	//
	// Falling through re-uses the probe below, including its catch: if Harper is
	// unreachable the `home === 'harper'` branch keeps them in Harper mode and
	// flags it, rather than silently starting them somewhere else.
	if (demoBackend === 'solo' && getDemoSaveHome() !== 'harper') return demoBackend;

	demoHomeUnreachable = false;
	const home = getDemoSaveHome();

	// This device already has a demo save in the offline store. Never probe past
	// it into Harper mode — that would hide a save that's sitting right here.
	if (home === 'solo') {
		demoBackend = 'solo';
		setTransport('solo');
		return demoBackend;
	}

	try {
		await probeHostedHarper();
		demoBackend = 'harper';
		setTransport('web');
	} catch {
		// Both attempts failed. The player almost certainly HAS a connection (they
		// just loaded this page), so this is the server being unhappy, not them
		// being offline.
		if (home === 'harper') {
			// This device's demo save lives on Harper. Falling back to the offline
			// store here is what made saves look deleted: the title would show an
			// empty slot list, the player would start over, and the real save became
			// unreachable for good. Stay in Harper mode and let the title say the
			// server can't be reached, so the save is still there next time.
			demoBackend = 'harper';
			demoHomeUnreachable = true;
			setTransport('web');
			return demoBackend;
		}
		// Nothing of theirs to lose yet, so let them play rather than dead-ending on
		// a title screen. This save is pinned to the offline store on creation, so a
		// later session that CAN reach Harper won't swap it out from under them.
		demoBackend = 'solo';
		setTransport('solo');
	}
	return demoBackend;
}

export function setTransport(t: Transport) {
	transport = t;
}
export function getTransport(): Transport {
	return transport;
}
// The save slot the active solo game autosaves to after each action.
export function setSoloSlot(meta: SaveMeta | null) {
	soloSlot = meta;
}
export function getSoloSlot(): SaveMeta | null {
	return soloSlot;
}

// Throttled autosave: at most one write per window, always capturing the latest
// state at fire time. Bounds data loss to the window length and avoids writing
// the whole save on every single action.
//
// The window ADAPTS to what a save actually costs. Persisting serializes every
// dynamic table and stringifies the result, so it gets steadily more expensive
// as a preserve grows — a long save is megabytes of JSON. A fixed window means
// that growing cost eats an ever-larger share of the frame budget, which is a
// big part of why long sessions ended up unplayable. Instead we measure each
// write and stretch the interval so saving stays a small duty cycle of wall
// time, then tighten back up if it gets cheap again.
//
// SAVE_MAX_MS is the safety rail: backing off is bounded, so an unexpected quit
// can never cost more than that much progress. Quit / tab-hide / leaving play
// still force an immediate flush, so normal exits lose nothing at all.
const SAVE_THROTTLE_MS = 1500; // floor — never save more often than this
const SAVE_MAX_MS = 12_000; // ceiling — never risk more progress than this
const SAVE_DUTY = 0.03; // spend at most ~3% of wall time writing saves
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let savePending = false;
let saveCostMs = 0; // EWMA of one full serialize+write

/** Current autosave window, derived from what the last few saves actually cost. */
export function soloSaveIntervalMs(): number {
	return adaptiveInterval(saveCostMs, SAVE_THROTTLE_MS, SAVE_MAX_MS, SAVE_DUTY);
}

/** Diagnostics: measured cost of a save on this device/save size. */
export const soloSaveCostMs = (): number => saveCostMs;

/** Persist and fold the measured duration into the adaptive interval. */
async function runSoloSave(slot: SaveMeta): Promise<void> {
	const started = typeof performance !== 'undefined' ? performance.now() : Date.now();
	try {
		await persistSolo(slot);
	} finally {
		const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - started;
		saveCostMs = ewma(saveCostMs, elapsed);
	}
}

function scheduleSoloSave() {
	savePending = true;
	if (saveTimer != null) return;
	saveTimer = setTimeout(() => {
		saveTimer = null;
		if (savePending && soloSlot) {
			savePending = false;
			runSoloSave(soloSlot).catch((e) => {
				// Silently swallowing this meant a player whose disk was full kept
				// playing a session that was never being written down. SaveIncident
				// only covers saves that won't READ, so this is reported too.
				reportClientError(e, 'solo save write');
				bridge.emit('save-error', { message: t('app.error.saveWriteFailed') });
			});
		}
	}, soloSaveIntervalMs());
}

/** Force any pending solo save to disk now (on quit / tab hide / leaving play). */
export async function flushSoloSave(): Promise<void> {
	if (saveTimer != null) {
		clearTimeout(saveTimer);
		saveTimer = null;
	}
	if (savePending && soloSlot) {
		savePending = false;
		try {
			await runSoloSave(soloSlot);
		} catch {
			/* best effort */
		}
	}
}

if (typeof window !== 'undefined') {
	window.addEventListener('beforeunload', () => void flushSoloSave());
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'hidden') void flushSoloSave();
	});
}

let currentPlayerId: string | null = null;

export function setPlayerId(id: string | null) {
	currentPlayerId = id;
}
export function getPlayerId(): string | null {
	return currentPlayerId;
}

export type SaveMode = 'solo' | 'coop';
const modeKey = (mode: SaveMode) => `${STORAGE_KEY}:${mode}`;

// The last save is remembered per mode, so the title screen's "Continue" only
// offers the most recent save that matches the Solo/Co-op toggle.
export function rememberSave(playerId: string, name: string, mode: SaveMode = 'solo') {
	try {
		const rec = JSON.stringify({ playerId, name, mode });
		localStorage.setItem(modeKey(mode), rec);
		localStorage.setItem(STORAGE_KEY, rec); // overall most-recent (legacy/fallback)
	} catch {
		/* private mode etc. */
	}
}
export function lastSave(mode?: SaveMode): { playerId: string; name: string; mode?: SaveMode } | null {
	try {
		if (!mode) {
			const raw = localStorage.getItem(STORAGE_KEY);
			return raw ? JSON.parse(raw) : null;
		}
		const raw = localStorage.getItem(modeKey(mode));
		if (raw) return JSON.parse(raw);
		// Legacy fallback: a save made before per-mode tracking has no mode tag —
		// treat it as solo so existing players keep their Continue button.
		const legacy = localStorage.getItem(STORAGE_KEY);
		if (legacy) {
			const rec = JSON.parse(legacy);
			if (rec.mode === mode || (!rec.mode && mode === 'solo')) return rec;
		}
		return null;
	} catch {
		return null;
	}
}
/**
 * Where the hosted Harper lives, as seen from this build — for calls that must
 * ALWAYS reach the shared server no matter what the game transport is doing
 * (feedback, mailing list). Same-origin only for the plain web build, which is
 * itself served by Harper; desktop and the itch DEMO are both cross-origin.
 *
 * Exported because src/feedback.ts used to keep its own copy of this rule that
 * had never learned about the demo: `IS_DESKTOP ? COOP_BASE_URL : ''` sent demo
 * players' feedback to the itch origin, where it 404'd and was thrown away.
 * Deliberately NOT the same as the base `request()` picks — that one is about
 * gameplay transport and has the local/solo short-circuit ahead of it.
 */
export function hostedBase(): string {
	if (isDesktop) return COOP_BASE_URL;
	// Served from a host WE control (wildwillows.app, play.wildwillows.app): post
	// same-origin. On play.* the Cloudflare Worker forwards these paths to Harper
	// server-side, so the browser never makes a cross-origin request and there is
	// no CORS to configure. That matters more than it sounds: these calls are all
	// fire-and-forget with swallowed errors, so when CORS blocks them nothing
	// surfaces — the reports simply stop arriving and the dashboard quietly
	// under-counts. Same-origin removes the failure mode rather than configuring
	// around it.
	if (CHANNEL === 'direct') return '';
	// itch's iframe (or anywhere else): has to go cross-origin to Harper, which
	// DOES require Harper to allow that origin. '' is the plain web build, which
	// Harper serves itself.
	return DEMO_WEB ? COOP_BASE_URL : '';
}

/**
 * True only when the server authoritatively said this save does not exist (404).
 *
 * The distinction matters a lot: a failure to LOAD a save is not evidence the
 * save is GONE. Network drops, CORS hiccups, a 503 while Harper is still
 * starting, or a demo session that fell back to the offline backend all make a
 * perfectly good save momentarily unreadable. Treating those as deletion is how
 * players lost demo saves they could never get back — see continueLast.
 */
export function isMissingSaveError(e: any): boolean {
	return e?.status === 404;
}

export function forgetSave(mode?: SaveMode) {
	try {
		if (mode) {
			localStorage.removeItem(modeKey(mode));
			// rememberSave writes the SAME record to both the per-mode key and the
			// legacy most-recent key, and lastSave(mode) falls back to the legacy one
			// whenever its mode tag matches. Clearing only the per-mode key therefore
			// did nothing at all — lastSave immediately resurrected the save from the
			// copy left behind. Drop that copy too when it refers to this mode.
			const legacy = localStorage.getItem(STORAGE_KEY);
			if (legacy) {
				const rec = JSON.parse(legacy);
				if (rec?.mode === mode || (!rec?.mode && mode === 'solo')) localStorage.removeItem(STORAGE_KEY);
			}
		} else {
			localStorage.removeItem(STORAGE_KEY);
			localStorage.removeItem(modeKey('solo'));
			localStorage.removeItem(modeKey('coop'));
		}
	} catch {
		/* ignore */
	}
}

// GameData is static definitions bundled with the app, so on desktop it's always
// served locally — the title screen then works offline regardless of mode.
//
// Authoritative solo guard: desktop solo play is fully offline, so if a solo save
// is the active session (soloSlot set), EVERY call is served in-app — gameplay must
// never leak to the hosted Harper even if `transport` was somehow left stale. Co-op
// clears soloSlot (exitSolo/logout run before any co-op flow), so this only ever
// fires for genuine solo play; co-op still routes to the server as intended.
const isLocalCall = (path: string) =>
	transport === 'solo' || (isDesktop && (soloSlot != null || path.startsWith('/GameData')));

async function request<T>(path: string, options?: RequestInit): Promise<T> {
	const method = (options?.method || 'GET').toUpperCase();

	// --- solo / local in-app backend ---
	if (isLocalCall(path)) {
		const body = options?.body ? JSON.parse(String(options.body)) : undefined;
		const res = await soloRequest(path, method, body);
		if (res.status >= 400) {
			const err: any = new Error(res.body?.title || t('app.error.requestFailed', { status: res.status }));
			err.status = res.status;
			throw err;
		}
		// Autosave the world after any mutating action — throttled so frequent
		// actions (movement sync, heartbeats) don't serialize+write the whole save
		// every time. The trailing write captures the latest state.
		if (method !== 'GET' && soloSlot && transport === 'solo') scheduleSoloSave();
		return res.body as T;
	}

	// --- web (same origin) or desktop co-op / demo (hosted Harper) ---
	// The itch demo is served cross-origin from the hosted Harper, so its web
	// calls target COOP_BASE_URL too (only reached in Harper mode; the solo
	// fallback routes through the local branch above).
	const base = (transport === 'coop' && isDesktop) || DEMO_WEB ? COOP_BASE_URL : '';
	// fetch() REJECTS (rather than resolving with a status) only when the request
	// never reached a server at all: no connection, DNS, CORS, or the machine going
	// to sleep mid-request. The browser's wording for that is "Failed to fetch" —
	// "Load failed" in Safari — which used to travel straight to a toast and told
	// the player nothing about what was wrong or what to do. Name it here, once,
	// where every web and co-op call passes through.
	let res: Response;
	try {
		res = await fetch(base + path, {
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			...options,
		});
	} catch (e: any) {
		// Reported as well as shown: a spike here is the difference between "one
		// player's wifi" and "the server is down", and the toast only tells the
		// player. Deduplicated per session inside reportClientError, so a client
		// that is properly offline sends this at most once (and fails to, quietly).
		reportClientError(e, `fetch ${method} ${path.split('?')[0]}`);
		const err: any = new Error(t('app.error.backendUnreachable'));
		err.offline = true;
		err.cause = e; // the raw reason is kept for the console, not for the player
		throw err;
	}
	if (!res.ok) {
		let message = t('app.error.requestFailed', { status: res.status });
		try {
			const body = await res.json();
			message = body?.title || body?.error || body?.message || message;
		} catch {
			/* keep default */
		}
		const err: any = new Error(message);
		err.status = res.status;
		throw err;
	}
	return res.json();
}

function post<T>(path: string, body: object): Promise<T> {
	return request<T>(path, { method: 'POST', body: JSON.stringify(body) });
}

/**
 * Run a call that needs a signed-in save, resolving the player id first.
 *
 * This replaced a `pid()` helper that THREW when there was no session, and the
 * difference matters more than it looks. Every method below builds its request
 * body eagerly, so `api.heartbeat().catch(() => undefined)` evaluated `pid()`
 * while assembling the argument object — before `post()` was called, before a
 * promise existed, and so before `.catch` was ever attached. A missing session
 * escaped every error handler in the app. It was not swallowed by the
 * `.catch(() => undefined)` sitting on the same line; it unwound out of the
 * React effect that called it and took the whole app down through the top-level
 * ErrorBoundary — which is how a dropped heartbeat became a "Not logged in"
 * crash screen for three players.
 *
 * Moving the check inside a callback makes it a REJECTION, which is what all
 * those existing handlers were already written to catch. `err.noSession` marks
 * it so a caller can tell "you are signed out" apart from "the network is down".
 */
function session<T>(run: (playerId: string) => Promise<T>): Promise<T> {
	if (!currentPlayerId) {
		const err: any = new Error(t('app.error.notLoggedIn'));
		err.noSession = true;
		return Promise.reject(err);
	}
	return run(currentPlayerId);
}

export const api = {
	gameData: () => request<GameData>('/GameData/'),
	gameState: (playerId?: string) =>
		playerId ? request<GameState>(`/GameState/${playerId}`) : session((id) => request<GameState>(`/GameState/${id}`)),
	createPlayer: (name: string, passcode: string, appearance: Appearance, creationMs = 0) =>
		post<{ ok: boolean; playerId: string; state: GameState }>('/CreatePlayer/', {
			name,
			passcode,
			appearance,
			tzOffsetMinutes: -new Date().getTimezoneOffset(),
			creationMs,
			edition: EDITION,
		}),
	login: (name: string, passcode: string) =>
		post<{ ok: boolean; playerId: string; state: GameState }>('/LoginPlayer/', {
			name,
			passcode,
			tzOffsetMinutes: -new Date().getTimezoneOffset(),
		}),

	deletePlayer: (name: string, passcode: string) =>
		post<{ ok: boolean; deleted: string }>('/DeletePlayer/', { name, passcode }),
	changePasscode: (currentPasscode: string, newPasscode: string) =>
		session((playerId) => post<{ ok: boolean }>('/ChangePasscode/', { playerId, currentPasscode, newPasscode })),
	updateAppearance: (appearance: Appearance) =>
		session((playerId) =>
			post<{ ok: boolean; appearance: Appearance }>('/UpdateAppearance/', { playerId, appearance }),
		),
	collect: (biomeId: string, nodeId: string, resourceId: string) =>
		session((playerId) => post<any>('/CollectResource/', { playerId, biomeId, nodeId, resourceId })),
	chestTransfer: (chestId: string, resourceId: string, qty: number, direction: 'deposit' | 'withdraw') =>
		session((playerId) => post<any>('/ChestTransfer/', { playerId, chestId, resourceId, qty, direction })),
	craft: (recipeId: string) => session((playerId) => post<any>('/CraftItem/', { playerId, recipeId })),
	discard: (kind: 'material' | 'crafted', id: string, qty: number) =>
		session((playerId) => post<any>('/DiscardItem/', { playerId, kind, id, qty })),
	place: (objectId: string, area: string, x: number, y: number, rotation = 0) =>
		session((playerId) => post<any>('/PlaceObject/', { playerId, objectId, area, x, y, rotation })),
	remove: (placementId: string) => session((playerId) => post<any>('/RemoveObject/', { playerId, placementId })),
	move: (placementId: string, x: number, y: number, rotation?: number) =>
		session((playerId) => post<any>('/MoveObject/', { playerId, placementId, x, y, rotation })),
	upgradeTool: (toolId: string) => session((playerId) => post<any>('/UpgradeTool/', { playerId, toolId })),
	upgradeHome: (track: string) => session((playerId) => post<any>('/UpgradeHome/', { playerId, track })),
	setHomeStyle: (style: string) => session((playerId) => post<any>('/SetHomeStyle/', { playerId, style })),
	rest: () => session((playerId) => post<any>('/Rest/', { playerId })),
	setHomeColors: (colors: { floor?: string; wall?: string; accent?: string; rug?: string }) =>
		session((playerId) => post<any>('/SetHomeColors/', { playerId, colors })),
	setPlacementColor: (placementId: string, color: string) =>
		session((playerId) => post<any>('/SetPlacementColor/', { playerId, placementId, color })),
	observe: (animalId: string) => session((playerId) => post<any>('/ObserveAnimal/', { playerId, animalId })),
	claimTask: (taskId: string) => session((playerId) => post<any>('/ClaimTask/', { playerId, taskId })),
	setGoals: (goals: any[]) => session((playerId) => post<any>('/SetGoals/', { playerId, goals })),
	terraform: (area: string, x: number, y: number, action: 'dig' | 'water' | 'clear') =>
		session((playerId) => post<any>('/Terraform/', { playerId, area, x, y, action })),
	plant: (area: string, x: number, y: number, plantId: string) =>
		session((playerId) => post<any>('/Plant/', { playerId, area, x, y, plantId })),
	harvest: (placementId: string) => session((playerId) => post<any>('/HarvestPlacement/', { playerId, placementId })),
	syncPlayer: (x: number, y: number, area?: string, tutorialStep?: number) =>
		session((playerId) => post<any>('/SyncPlayer/', { playerId, x, y, area, tutorialStep })),
	// language + edition ride on the heartbeat so metrics can report interface
	// language and split demo vs paid players
	// `idleGateMs` reports the client's input-idle window (see HEARTBEAT_IDLE_MS in
	// src/state.tsx). The server stamps it on the metrics blob so a dashboard can
	// tell which definition of "play time" a row was recorded under, instead of
	// silently averaging two of them together.
	heartbeat: (idleGateMs?: number) =>
		session((playerId) => post<any>('/Heartbeat/', { playerId, language: getLocale(), edition: EDITION, idleGateMs })),
	appendFeed: (entries: { icon: string; text: string; at: number }[]) =>
		session((playerId) => post<any>('/AppendFeed/', { playerId, entries })),
	recalc: (biomeId: string) => session((playerId) => post<any>('/RecalcBiome/', { playerId, biomeId })),
	dev: (action: string, args: Record<string, any> = {}) =>
		session((playerId) => post<any>('/DevTools/', { playerId, action, ...args })),
	// Per-player metrics view (drives Steam Stats/Achievements on desktop).
	metrics: (playerId?: string) =>
		playerId
			? request<{ player: any }>(`/Metrics/${playerId}`)
			: session((id) => request<{ player: any }>(`/Metrics/${id}`)),
};

// ---------------------------------------------------------------- solo saves
// Desktop solo play needs no passcode and no server: start a save, autosave to a
// local slot, and load it back. These wrap the in-app backend + slot storage.

import { newSoloGame as backendNew, loadSoloGame as backendLoad, endSolo } from './solo/backend';
import {
	createSlot,
	listSaves as listSoloSaves,
	loadSaveData,
	deleteSave as deleteSoloSave,
	exportSlot,
	importSave,
	packSaveFile,
} from './solo/saves';

export type { SaveMeta } from './solo/saves';
export { listSoloSaves, deleteSoloSave };

/** DEMO hard-stop cleanup: permanently delete the just-finished demo save so the
 *  player can't log back in and keep going. Handles either backend — the local
 *  slot (solo fallback) or the hosted Harper record (via the guarded, passcode-
 *  free DeleteDemoSave endpoint) — and clears the remembered "Continue" pointer.
 *  Best-effort: a failure here must never block returning to the title. */
export async function deleteDemoSave(): Promise<void> {
	try {
		if (transport === 'solo') {
			const slot = getSoloSlot();
			setSoloSlot(null); // stop the throttled autosave from resurrecting the slot
			endSolo();
			if (slot) await deleteSoloSave(slot.slotId);
		} else {
			const id = currentPlayerId;
			if (id) await request('/DeleteDemoSave/', { method: 'POST', body: JSON.stringify({ playerId: id }) });
		}
	} catch {
		/* best-effort — the popup still returns to the title */
	}
	forgetSave('solo');
	clearDemoSaveHome(); // the demo save is gone; the next one picks its own store
}

/** Export the active solo save as a downloadable file. Flushes any pending
 *  autosave first so the backup captures the very latest state — the whole
 *  world, journal, progress, AND the caretaker's name + appearance. */
export async function exportActiveSolo(): Promise<{ filename: string; contents: string } | null> {
	await flushSoloSave();
	const slot = getSoloSlot();
	if (!slot) return null;
	const contents = await exportSlot(slot.slotId);
	if (!contents) return null;
	const safe =
		(slot.name || 'save')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '') || 'save';
	const stamp = new Date().toISOString().slice(0, 10);
	return { filename: `wild-willows-${safe}-${stamp}.json`, contents };
}

/** Import an exported save file as a new local slot; returns the new slot meta. */
export async function importSoloSave(contents: string): Promise<SaveMeta> {
	return importSave(contents);
}

/** Export the active DEMO save as an importable file, whichever backend it's on:
 *  the local solo slot (offline fallback), or the hosted Harper record (dumped by
 *  the guarded ExportDemoSave endpoint, then encrypted client-side into the same
 *  envelope). Lets a demo player carry their meadow into the full downloadable
 *  game via its Import Save. */
export async function exportDemoSave(): Promise<{ filename: string; contents: string } | null> {
	if (transport === 'solo') return exportActiveSolo();
	const id = currentPlayerId;
	if (!id) return null;
	const res: any = await request('/ExportDemoSave/', { method: 'POST', body: JSON.stringify({ playerId: id }) });
	if (!res?.meta || !res?.data) return null;
	const contents = packSaveFile(res.meta, res.data);
	const safe =
		String(res.meta.name || 'save')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '') || 'save';
	const stamp = new Date().toISOString().slice(0, 10);
	return { filename: `wild-willows-${safe}-${stamp}.json`, contents };
}

/** Start a fresh solo game (no passcode) and create its save slot. */
export async function startSoloGame(
	name: string,
	appearance: Appearance,
	creationMs = 0,
): Promise<{ playerId: string; state: GameState; slot: SaveMeta }> {
	setTransport('solo');
	const created = await backendNew(name, appearance, creationMs);
	const slot = await createSlot({ playerId: created.playerId, name, appearance });
	setSoloSlot(slot);
	setPlayerId(created.playerId);
	// Pin the demo to the offline store, so a later session that CAN reach Harper
	// doesn't switch stores and hide this save.
	if (DEMO_WEB) setDemoSaveHome('solo');
	return { playerId: created.playerId, state: created.state, slot };
}

/** Load a solo save slot back into play. */
export async function resumeSoloGame(slotId: string): Promise<{ playerId: string; state: GameState; slot: SaveMeta }> {
	setTransport('solo');
	const file = await loadSaveData(slotId);
	if (!file) {
		// Flagged so callers can tell "this slot is not here" from "this slot is
		// here and will not open" — only the second is a corrupt save, and telling a
		// player their save is unrecoverable when it merely isn't on this device
		// would be worse than saying nothing.
		const missing: any = new Error(t('app.error.saveNotFound'));
		missing.saveMissing = true;
		throw missing;
	}
	const state = await backendLoad(file.meta.playerId, file.data);
	setSoloSlot(file.meta);
	setPlayerId(file.meta.playerId);
	return { playerId: file.meta.playerId, state, slot: file.meta };
}

/** Leave the active solo game (back to the menu) and reset the transport. */
export function exitSolo() {
	void flushSoloSave(); // persist any pending throttled write before we drop it
	setSoloSlot(null);
	endSolo();
	// Back to this build's title-screen backend: solo for desktop and for a demo
	// that fell back to offline; web (hosted Harper) otherwise.
	setTransport(isDesktop || demoBackend === 'solo' ? 'solo' : 'web');
}

/** True on the desktop (Electron) build. The web build always uses its origin. */
export const IS_DESKTOP = isDesktop;
