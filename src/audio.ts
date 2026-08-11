import { bridge } from './game/bridge';
import { isNativeAndroid } from './native/capacitorBridge';
import audioConfig from '../data/audio.json';

const AUDIO_ASSETS = {
	music: audioConfig.music,
	ambience: audioConfig.ambience,
	sfx: audioConfig.sfx,
};

type SfxId = keyof typeof AUDIO_ASSETS.sfx;
type MusicId = keyof typeof AUDIO_ASSETS.music;
type AmbienceId = keyof typeof AUDIO_ASSETS.ambience;

interface AudioState {
	enabled: boolean;
	musicEnabled: boolean;
	sfxEnabled: boolean;
	masterVolume: number;
	sfxVolume: number;
	musicVolume: number;
}

interface AudioPrefs {
	audioEnabled?: unknown;
	musicEnabled?: unknown;
	sfxEnabled?: unknown;
	masterVolume?: unknown;
	sfxVolume?: unknown;
	musicVolume?: unknown;
}

const state: AudioState = {
	enabled: true,
	musicEnabled: true,
	sfxEnabled: true,
	masterVolume: 0.8,
	sfxVolume: 0.75,
	musicVolume: 0.6,
};

const warnedMissing = new Set<string>();
// Electron desktop enables autoplay, so we can start unlocked there.
//
// The Android build installs the same `wildWillowsDesktop` global (see
// src/native/capacitorBridge.ts) to inherit Electron's solo/offline behavior —
// but autoplay is the one place that equivalence breaks. An Android WebView
// still applies the media-gesture policy, so starting "unlocked" there means the
// first play() rejects and the theme never recovers. Require a real gesture.
let unlockedByGesture = !!(globalThis as any).wildWillowsDesktop?.isDesktop && !isNativeAndroid;
let wantsMusic = false;
let currentMusicId: MusicId = 'wildwillowstheme';
let musicEl: HTMLAudioElement | null = null;
let loadedMusicId: MusicId | null = null;
let fadingMusicEl: HTMLAudioElement | null = null;
let musicFadeRaf: number | null = null;
const MUSIC_CROSSFADE_MS = 2000;
const musicEls = new Map<MusicId, HTMLAudioElement>();
let wantsAmbience = false;
let currentAmbienceId: AmbienceId = 'meadow';
let ambienceEl: HTMLAudioElement | null = null;
let loadedAmbienceId: AmbienceId | null = null;
let fadingAmbienceEl: HTMLAudioElement | null = null;
let ambienceFadeRaf: number | null = null;
const AMBIENCE_CROSSFADE_MS = 2600;
const ambienceEls = new Map<AmbienceId, HTMLAudioElement>();
let footstepsActive = false;
let footstepLoopEl: HTMLAudioElement | null = null;
let hummingActive = false;
let hummingLoopEl: HTMLAudioElement | null = null;
let rainActive = false;
let rainLoopEl: HTMLAudioElement | null = null;
let stormLoopEl: HTMLAudioElement | null = null;
let duckMultiplier = 1;
let duckRaf: number | null = null;
const lastSfxPick = new Map<SfxId, number>();
// One reusable element per sfx file. Avoids leaking a fresh HTMLAudioElement on
// every play (which, with menuhover firing on every hover, accumulates over a
// session until audio — then the whole app — gets glitchy and slow).
const sfxEls = new Map<string, HTMLAudioElement>();
const alternatingSfx = new Set<SfxId>(['pickup']);
const sfxGain = audioConfig.sfxGain as Partial<Record<SfxId, number>>;
const musicGain = audioConfig.musicGain as Partial<Record<MusicId, number>>;
const LEVEL3_AMBIENCE_BOOST = 1.2;

function isLevel3Music(track: MusicId): boolean {
	return /_level3$/.test(track);
}

function clamp01(value: number): number {
	if (!Number.isFinite(value)) return 0;
	if (value < 0) return 0;
	if (value > 1) return 1;
	return value;
}

function warnMissing(path: string) {
	if (warnedMissing.has(path)) return;
	warnedMissing.add(path);
	console.warn(`[audio] Missing asset: ${path}`);
}

function resolveAssetUrl(path: string): string {
	if (/^(https?:|file:|blob:|data:)/i.test(path)) return path;
	if (typeof window === 'undefined') return path;
	// In desktop (file://), absolute /audio/... points at the filesystem root.
	// Rebase to the app's current index.html location so one path works for both.
	const rebased = path.startsWith('/') ? `.${path}` : path;
	return new URL(rebased, window.location.href).toString();
}

function createAudio(path: string, loop = false): HTMLAudioElement {
	const el = new Audio(resolveAssetUrl(path));
	el.preload = 'auto';
	el.loop = loop;
	el.addEventListener('error', () => warnMissing(path));
	return el;
}

function effectiveSfxVolume(): number {
	if (!state.enabled || !state.sfxEnabled) return 0;
	return clamp01(state.masterVolume * state.sfxVolume);
}

function effectiveMusicVolume(): number {
	if (!state.enabled || !state.musicEnabled) return 0;
	return clamp01(state.masterVolume * state.musicVolume);
}

function effectiveMusicTrackVolume(track: MusicId): number {
	const gain = musicGain[track] ?? 1;
	return clamp01(effectiveMusicVolume() * gain * duckMultiplier);
}

function effectiveAmbienceVolume(): number {
	if (!state.enabled || !state.musicEnabled) return 0;
	// Keep environmental ambience noticeably softer than music.
	const boost = isLevel3Music(currentMusicId) ? LEVEL3_AMBIENCE_BOOST : 1;
	return clamp01(state.masterVolume * state.musicVolume * 0.45 * boost * duckMultiplier);
}

function effectiveHummingVolume(): number {
	if (!state.enabled || !state.musicEnabled) return 0;
	return clamp01(state.masterVolume * state.musicVolume * 0.2);
}

function effectiveRainVolume(): number {
	if (!state.enabled || !state.musicEnabled) return 0;
	// Keep rain under the music while still clearly audible.
	return clamp01(state.masterVolume * state.musicVolume * 0.5544);
}

function effectiveStormVolume(): number {
	if (!state.enabled || !state.musicEnabled) return 0;
	// Layer storms lightly under rain so weather stays atmospheric, not dominant.
	return clamp01(state.masterVolume * state.musicVolume * 0.17);
}

function getMusicElement(track: MusicId): HTMLAudioElement {
	let el = musicEls.get(track);
	if (!el) {
		el = createAudio(AUDIO_ASSETS.music[track], true);
		musicEls.set(track, el);
	}
	return el;
}

function stopMusicFade() {
	if (musicFadeRaf !== null && typeof window !== 'undefined') {
		window.cancelAnimationFrame(musicFadeRaf);
	}
	musicFadeRaf = null;
	if (fadingMusicEl) {
		fadingMusicEl.pause();
		fadingMusicEl.currentTime = 0;
		fadingMusicEl.volume = 0;
		fadingMusicEl = null;
	}
}

function pauseOrphanedMusic() {
	for (const el of musicEls.values()) {
		if (el === musicEl || el === fadingMusicEl) continue;
		if (!el.paused) el.pause();
		el.currentTime = 0;
		el.volume = 0;
	}
}

function startMusicCrossfade(nextTrack: MusicId, nextEl: HTMLAudioElement) {
	const prevEl = musicEl;
	const prevTrack = loadedMusicId ?? nextTrack;
	if (!prevEl || prevEl === nextEl) {
		stopMusicFade();
		musicEl = nextEl;
		loadedMusicId = nextTrack;
		musicEl.volume = effectiveMusicTrackVolume(nextTrack);
		if (musicEl.paused) {
			void musicEl.play().catch(() => {
				// Browser autoplay policies can still block until another user gesture.
			});
		}
		return;
	}

	stopMusicFade();
	fadingMusicEl = prevEl;
	musicEl = nextEl;
	loadedMusicId = nextTrack;
	nextEl.volume = 0;
	if (nextEl.paused) {
		void nextEl.play().catch(() => {
			// Browser autoplay policies can still block until another user gesture.
		});
	}

	const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
	const tick = (now: number) => {
		const elapsed = now - start;
		const t = clamp01(elapsed / MUSIC_CROSSFADE_MS);
		const nextTarget = effectiveMusicTrackVolume(nextTrack);
		const prevTarget = effectiveMusicTrackVolume(prevTrack);
		if (musicEl) musicEl.volume = nextTarget * t;
		if (fadingMusicEl) fadingMusicEl.volume = prevTarget * (1 - t);

		if (t < 1 && wantsMusic && state.enabled) {
			musicFadeRaf = window.requestAnimationFrame(tick);
			return;
		}

		if (fadingMusicEl) {
			fadingMusicEl.pause();
			fadingMusicEl.currentTime = 0;
			fadingMusicEl.volume = 0;
			fadingMusicEl = null;
		}
		if (musicEl) musicEl.volume = nextTarget;
		pauseOrphanedMusic();
		musicFadeRaf = null;
	};

	musicFadeRaf = window.requestAnimationFrame(tick);
}

function getAmbienceElement(track: AmbienceId): HTMLAudioElement {
	let el = ambienceEls.get(track);
	if (!el) {
		el = createAudio(AUDIO_ASSETS.ambience[track], true);
		ambienceEls.set(track, el);
	}
	return el;
}

function stopAmbienceFade() {
	if (ambienceFadeRaf !== null && typeof window !== 'undefined') {
		window.cancelAnimationFrame(ambienceFadeRaf);
	}
	ambienceFadeRaf = null;
	if (fadingAmbienceEl) {
		fadingAmbienceEl.pause();
		fadingAmbienceEl.currentTime = 0;
		fadingAmbienceEl.volume = 0;
		fadingAmbienceEl = null;
	}
}

function pauseOrphanedAmbience() {
	for (const el of ambienceEls.values()) {
		if (el === ambienceEl || el === fadingAmbienceEl) continue;
		if (!el.paused) el.pause();
		el.currentTime = 0;
		el.volume = 0;
	}
}

function startAmbienceCrossfade(nextTrack: AmbienceId, nextEl: HTMLAudioElement) {
	const prevEl = ambienceEl;
	if (!prevEl || prevEl === nextEl) {
		stopAmbienceFade();
		ambienceEl = nextEl;
		loadedAmbienceId = nextTrack;
		ambienceEl.volume = effectiveAmbienceVolume();
		if (ambienceEl.paused) {
			void ambienceEl.play().catch(() => {
				// Browser autoplay policies can still block until another user gesture.
			});
		}
		return;
	}

	stopAmbienceFade();
	fadingAmbienceEl = prevEl;
	ambienceEl = nextEl;
	loadedAmbienceId = nextTrack;
	nextEl.volume = 0;
	if (nextEl.paused) {
		void nextEl.play().catch(() => {
			// Browser autoplay policies can still block until another user gesture.
		});
	}

	const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
	const tick = (now: number) => {
		const elapsed = now - start;
		const t = clamp01(elapsed / AMBIENCE_CROSSFADE_MS);
		const target = effectiveAmbienceVolume();
		if (ambienceEl) ambienceEl.volume = target * t;
		if (fadingAmbienceEl) fadingAmbienceEl.volume = target * (1 - t);

		if (t < 1 && wantsAmbience && state.enabled) {
			ambienceFadeRaf = window.requestAnimationFrame(tick);
			return;
		}

		if (fadingAmbienceEl) {
			fadingAmbienceEl.pause();
			fadingAmbienceEl.currentTime = 0;
			fadingAmbienceEl.volume = 0;
			fadingAmbienceEl = null;
		}
		if (ambienceEl) ambienceEl.volume = target;
		pauseOrphanedAmbience();
		ambienceFadeRaf = null;
	};

	ambienceFadeRaf = window.requestAnimationFrame(tick);
}

function ensureFootstepLoopElement(): HTMLAudioElement | null {
	const source = AUDIO_ASSETS.sfx.footstep;
	const path = Array.isArray(source) ? source[0] : source;
	if (!path) return null;
	if (!footstepLoopEl) {
		footstepLoopEl = createAudio(path, true);
	}
	footstepLoopEl.volume = effectiveSfxVolume();
	return footstepLoopEl;
}

function ensureHummingLoopElement(): HTMLAudioElement {
	if (!hummingLoopEl) {
		hummingLoopEl = createAudio('/audio/sfx/humming.ogg', true);
	}
	hummingLoopEl.volume = effectiveHummingVolume();
	return hummingLoopEl;
}

function ensureRainLoopElement(): HTMLAudioElement {
	if (!rainLoopEl) {
		rainLoopEl = createAudio('/audio/sfx/rain.mp3', true);
	}
	rainLoopEl.volume = effectiveRainVolume();
	return rainLoopEl;
}

function ensureStormLoopElement(): HTMLAudioElement {
	if (!stormLoopEl) {
		stormLoopEl = createAudio('/audio/sfx/storm.mp3', true);
	}
	stormLoopEl.volume = effectiveStormVolume();
	return stormLoopEl;
}

function tryPlayMusic() {
	if (!wantsMusic || !state.enabled || !unlockedByGesture) return;
	const next = getMusicElement(currentMusicId);
	if (loadedMusicId && loadedMusicId !== currentMusicId && musicEl) {
		startMusicCrossfade(currentMusicId, next);
		return;
	}
	musicEl = next;
	loadedMusicId = currentMusicId;
	// Don't clobber an in-progress crossfade's volume ramp — this runs on a 15s
	// timer and on every state change, so without the guard the new track jumps
	// to full mid-fade (an audible lurch on area transitions).
	if (musicFadeRaf === null) musicEl.volume = effectiveMusicTrackVolume(currentMusicId);
	if (musicEl.paused) {
		void musicEl.play().catch(() => {
			// Browser autoplay policies can still block until another user gesture.
		});
	}
}

function syncMusicPlayback() {
	if (!wantsMusic || !state.enabled || !state.musicEnabled) {
		stopMusicFade();
		if (musicEl) {
			musicEl.pause();
			musicEl.currentTime = 0;
			musicEl.volume = 0;
		}
		pauseOrphanedMusic();
		loadedMusicId = null;
		return;
	}
	tryPlayMusic();
	pauseOrphanedMusic();
}

function syncAmbiencePlayback() {
	if (!wantsAmbience || !state.enabled || !state.musicEnabled) {
		stopAmbienceFade();
		if (ambienceEl) {
			ambienceEl.pause();
			ambienceEl.currentTime = 0;
			ambienceEl.volume = 0;
		}
		pauseOrphanedAmbience();
		loadedAmbienceId = null;
		return;
	}

	const next = getAmbienceElement(currentAmbienceId);
	if (loadedAmbienceId && loadedAmbienceId !== currentAmbienceId && ambienceEl) {
		if (!unlockedByGesture) return;
		startAmbienceCrossfade(currentAmbienceId, next);
		return;
	}

	ambienceEl = next;
	loadedAmbienceId = currentAmbienceId;
	// Same crossfade guard as music: don't reset volume while a fade is ramping.
	if (ambienceFadeRaf === null) ambienceEl.volume = effectiveAmbienceVolume();
	if (!unlockedByGesture) return;
	if (ambienceEl.paused) {
		void ambienceEl.play().catch(() => {
			// Browser autoplay policies can still block until another user gesture.
		});
	}
	pauseOrphanedAmbience();
}

function syncFootstepPlayback() {
	const el = ensureFootstepLoopElement();
	if (!el) return;
	el.volume = effectiveSfxVolume();
	if (!footstepsActive || !state.enabled || !state.sfxEnabled) {
		el.pause();
		el.currentTime = 0;
		return;
	}
	if (!unlockedByGesture) return;
	if (el.paused) {
		void el.play().catch(() => {
			// Browser autoplay policies can still block until another user gesture.
		});
	}
}

function syncHummingPlayback() {
	const el = ensureHummingLoopElement();
	el.volume = effectiveHummingVolume();
	if (!hummingActive || !state.enabled || !state.musicEnabled) {
		el.pause();
		el.currentTime = 0;
		return;
	}
	if (!unlockedByGesture) return;
	if (el.paused) {
		void el.play().catch(() => {
			// Browser autoplay policies can still block until another user gesture.
		});
	}
}

function syncRainPlayback() {
	const rainEl = ensureRainLoopElement();
	const stormEl = ensureStormLoopElement();
	rainEl.volume = effectiveRainVolume();
	stormEl.volume = effectiveStormVolume();
	if (!rainActive || !state.enabled || !state.musicEnabled) {
		rainEl.pause();
		rainEl.currentTime = 0;
		stormEl.pause();
		stormEl.currentTime = 0;
		return;
	}
	if (!unlockedByGesture) return;
	if (rainEl.paused) {
		void rainEl.play().catch(() => {
			// Browser autoplay policies can still block until another user gesture.
		});
	}
	if (stormEl.paused) {
		void stormEl.play().catch(() => {
			// Browser autoplay policies can still block until another user gesture.
		});
	}
}

const DUCK_RAMP_DOWN_MS = 300;
const DUCK_HOLD_MS = 3800;
const DUCK_RAMP_UP_MS = 800;
const DUCK_TARGET = 0.15;

function duckForUnlock(holdMs = DUCK_HOLD_MS) {
	if (duckRaf !== null && typeof window !== 'undefined') {
		window.cancelAnimationFrame(duckRaf);
		duckRaf = null;
	}
	const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
	const total = DUCK_RAMP_DOWN_MS + holdMs + DUCK_RAMP_UP_MS;
	const tick = (now: number) => {
		const elapsed = now - start;
		if (elapsed < DUCK_RAMP_DOWN_MS) {
			const t = elapsed / DUCK_RAMP_DOWN_MS;
			duckMultiplier = 1 - t * (1 - DUCK_TARGET);
		} else if (elapsed < DUCK_RAMP_DOWN_MS + holdMs) {
			duckMultiplier = DUCK_TARGET;
		} else {
			const t = (elapsed - DUCK_RAMP_DOWN_MS - holdMs) / DUCK_RAMP_UP_MS;
			duckMultiplier = DUCK_TARGET + clamp01(t) * (1 - DUCK_TARGET);
		}
		if (musicEl) musicEl.volume = effectiveMusicTrackVolume(currentMusicId);
		if (ambienceEl) ambienceEl.volume = effectiveAmbienceVolume();
		if (elapsed < total) {
			duckRaf = window.requestAnimationFrame(tick);
		} else {
			duckMultiplier = 1;
			if (musicEl) musicEl.volume = effectiveMusicTrackVolume(currentMusicId);
			if (ambienceEl) ambienceEl.volume = effectiveAmbienceVolume();
			duckRaf = null;
		}
	};
	duckRaf = window.requestAnimationFrame(tick);
}

function playSfx(id: SfxId) {
	if (!state.enabled || !state.sfxEnabled || !unlockedByGesture) return;
	const source = AUDIO_ASSETS.sfx[id];
	let path: string;
	if (Array.isArray(source)) {
		if (source.length === 0) return;
		const last = lastSfxPick.get(id);
		let index = 0;
		if (alternatingSfx.has(id) && source.length > 1) {
			index = last === undefined ? 0 : (last + 1) % source.length;
		} else {
			index = Math.floor(Math.random() * source.length);
			if (source.length > 1 && last !== undefined && index === last) {
				index = (index + 1 + Math.floor(Math.random() * (source.length - 1))) % source.length;
			}
		}
		lastSfxPick.set(id, index);
		path = source[index];
	} else {
		path = source;
	}
	let el = sfxEls.get(path);
	if (!el) {
		el = createAudio(path, false);
		sfxEls.set(path, el);
	}
	const gain = sfxGain[id] ?? 1;
	el.volume = clamp01(effectiveSfxVolume() * gain);
	try {
		el.currentTime = 0; // restart if it's re-triggered mid-play
	} catch {
		/* not seekable yet — fine */
	}
	void el.play().catch(() => {
		// Silent failure is fine; most often blocked until user interacts.
	});
	if (id === 'areaUnlocked') duckForUnlock();
}

export function primeAudio() {
	unlockedByGesture = true;
	tryPlayMusic();
	syncAmbiencePlayback();
	syncFootstepPlayback();
	syncHummingPlayback();
	syncRainPlayback();
}

export function applyAudioPrefs(prefs: AudioPrefs) {
	state.enabled = prefs.audioEnabled === undefined ? state.enabled : !!prefs.audioEnabled;
	state.musicEnabled = prefs.musicEnabled === undefined ? state.musicEnabled : !!prefs.musicEnabled;
	state.sfxEnabled = prefs.sfxEnabled === undefined ? state.sfxEnabled : !!prefs.sfxEnabled;
	state.masterVolume = clamp01(typeof prefs.masterVolume === 'number' ? prefs.masterVolume : state.masterVolume);
	state.sfxVolume = clamp01(typeof prefs.sfxVolume === 'number' ? prefs.sfxVolume : state.sfxVolume);
	state.musicVolume = clamp01(typeof prefs.musicVolume === 'number' ? prefs.musicVolume : state.musicVolume);
	syncMusicPlayback();
	syncAmbiencePlayback();
	syncFootstepPlayback();
	syncHummingPlayback();
	syncRainPlayback();
}

export function setMusicActive(active: boolean, track: MusicId = 'wildwillowstheme') {
	wantsMusic = active;
	currentMusicId = track;
	syncMusicPlayback();
}

export function setAmbienceActive(active: boolean, track: AmbienceId = 'meadow') {
	wantsAmbience = active;
	currentAmbienceId = track;
	syncAmbiencePlayback();
}

function setFootstepsActive(active: boolean) {
	footstepsActive = active;
	syncFootstepPlayback();
}

function setHummingActive(active: boolean) {
	hummingActive = active;
	syncHummingPlayback();
}

function setRainActive(active: boolean) {
	rainActive = active;
	syncRainPlayback();
}

export function bindGameAudio(): () => void {
	const offSfx = bridge.on('audio-sfx', (payload: any) => {
		const id = String(payload?.id || '') as SfxId;
		if (id && id in AUDIO_ASSETS.sfx) playSfx(id);
	});
	const offWalk = bridge.on('audio-walk', (payload: any) => {
		setFootstepsActive(!!payload?.active);
	});
	const offIdle = bridge.on('audio-idle', (payload: any) => {
		setHummingActive(!!payload?.active);
	});
	const offToast = bridge.on('audio-toast', (payload: any) => {
		// error toasts = a blocked/invalid action ("can't"); everything else
		// (info, unlock, achievement, animal) uses the neutral toast tick.
		const kind = String(payload?.kind || '');
		if (kind === 'error') playSfx('cant');
		else playSfx('toast');
	});
	const offRain = bridge.on('audio-rain', (payload: any) => {
		setRainActive(!!payload?.active);
	});
	// Global menu-hover: one soft tick whenever the pointer enters any UI button,
	// so every menu (top nav, character creation, home, panels…) is covered
	// without wiring each button. Dedup by the button element so moving across a
	// button's inner icon/label doesn't re-fire, and skip disabled buttons.
	let lastHoverBtn: Element | null = null;
	const onPointerOver = (e: Event) => {
		const btn = (e.target as Element | null)?.closest?.('button') ?? null;
		if (!btn) {
			lastHoverBtn = null;
			return;
		}
		if (btn === lastHoverBtn || (btn as HTMLButtonElement).disabled) return;
		lastHoverBtn = btn;
		playSfx('menuhover');
	};
	if (typeof document !== 'undefined') document.addEventListener('pointerover', onPointerOver);
	return () => {
		offSfx();
		offWalk();
		offIdle();
		offToast();
		offRain();
		if (typeof document !== 'undefined') document.removeEventListener('pointerover', onPointerOver);
	};
}
