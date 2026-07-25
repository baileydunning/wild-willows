import { bridge } from './game/bridge';

type SfxId =
	| 'toast'
	| 'yay'
	| 'hover'
	| 'menuhover'
	| 'cant'
	| 'areaUnlocked'
	| 'water'
	| 'footstep'
	| 'harvest'
	| 'craft'
	| 'plant'
	| 'place'
	| 'pickup'
	| 'move'
	| 'upgrade'
	| 'rest'
	| 'dig';

type MusicId =
	| 'preserve'
	| 'wildwillowstheme'
	| 'meadowambient'
	| 'meadowambient_level2'
	| 'meadowambient_level3'
	| 'hollowforest_level1'
	| 'hollowforest_level2'
	| 'hollowforest_level3'
	| 'wetlands_level1'
	| 'wetlands_level2'
	| 'wetlands_level3'
	| 'scrubland_level1'
	| 'scrubland_level2'
	| 'scrubland_level3'
	| 'graywind_level1'
	| 'graywind_level2'
	| 'graywind_level3'
	| 'pelicanbay_level1'
	| 'pelicanbay_level2'
	| 'pelicanbay_level3';
type AmbienceId = 'meadow' | 'night' | 'rain' | 'storm';

const AUDIO_ASSETS: {
	music: Record<MusicId, string>;
	ambience: Record<AmbienceId, string>;
	sfx: Record<SfxId, string | string[]>;
} = {
	music: {
		preserve: '/audio/music/preserve-loop.mp3',
		wildwillowstheme: '/audio/music/WildWillows_ThemeIdea.mp3',
		meadowambient: '/audio/music/willowmeadow/meadowambient.mp3',
		meadowambient_level2: '/audio/music/willowmeadow/meadowambient_level2.mp3',
		meadowambient_level3: '/audio/music/willowmeadow/meadowambient_level3.mp3',
		hollowforest_level1: '/audio/music/hollowforest/hollowforest_level1.mp3',
		hollowforest_level2: '/audio/music/hollowforest/hollowforest_level2.mp3',
		hollowforest_level3: '/audio/music/hollowforest/hollowforest_level3.mp3',
		wetlands_level1: '/audio/music/wetlands/wetlands_level1.mp3',
		wetlands_level2: '/audio/music/wetlands/wetlands_level2.mp3',
		wetlands_level3: '/audio/music/wetlands/wetlands_level3.mp3',
		scrubland_level1: '/audio/music/scrubland/scrubland_level1.mp3',
		scrubland_level2: '/audio/music/scrubland/scrubland_level2.mp3',
		scrubland_level3: '/audio/music/scrubland/scrubland_level3.mp3',
		graywind_level1: '/audio/music/graywind/graywind_level1.mp3',
		graywind_level2: '/audio/music/graywind/graywind_level2.mp3',
		graywind_level3: '/audio/music/graywind/graywind_level3.mp3',
		pelicanbay_level1: '/audio/music/pelican/pelicanbay_level1.mp3',
		pelicanbay_level2: '/audio/music/pelican/pelicanbay_level2.mp3',
		pelicanbay_level3: '/audio/music/pelican/pelicanbay_level3.mp3',
	},
	ambience: {
		meadow: '/audio/sfx/meadow.mp3',
		night: '/audio/sfx/night.mp3',
		rain: '/audio/sfx/rain.mp3',
		storm: '/audio/sfx/storm.mp3',
	},
	sfx: {
		toast: '/audio/sfx/toast.mp3',
		yay: '/audio/sfx/yay.mp3',
		hover: ['/audio/sfx/hover1.wav', '/audio/sfx/hover2.wav', '/audio/sfx/hover3.wav'],
		menuhover: '/audio/sfx/menuhover.wav',
		cant: '/audio/sfx/cant.wav',
		areaUnlocked: '/audio/sfx/AreaUnlocked.wav',
		water: '/audio/sfx/water.wav',
		footstep: '/audio/sfx/dirtfootsteps.wav',
		harvest: '/audio/sfx/harvest.wav',
		craft: '/audio/sfx/craft.wav',
		plant: '/audio/sfx/plant.mp3',
		place: '/audio/sfx/place.mp3',
		pickup: ['/audio/sfx/pickup1.wav', '/audio/sfx/pickup2.wav'],
		move: '/audio/sfx/move.mp3',
		upgrade: '/audio/sfx/upgrade.mp3',
		rest: '/audio/sfx/rest.mp3',
		dig: '/audio/sfx/dig.wav',
	},
};

interface AudioState {
	enabled: boolean;
	masterVolume: number;
	sfxVolume: number;
	musicVolume: number;
}

interface AudioPrefs {
	audioEnabled?: unknown;
	masterVolume?: unknown;
	sfxVolume?: unknown;
	musicVolume?: unknown;
}

interface AmbiencePlaybackOptions {
	instant?: boolean;
}

const state: AudioState = {
	enabled: true,
	masterVolume: 0.8,
	sfxVolume: 0.75,
	musicVolume: 0.6,
};

const warnedMissing = new Set<string>();
let unlockedByGesture = false;
let wantsMusic = false;
let currentMusicId: MusicId = 'wildwillowstheme';
let musicEl: HTMLAudioElement | null = null;
let loadedMusicId: MusicId | null = null;
let fadingMusicEl: HTMLAudioElement | null = null;
let musicFadeRaf: number | null = null;
const MUSIC_CROSSFADE_MS = 1300;
let wantsAmbience = false;
let currentAmbienceId: AmbienceId = 'meadow';
let ambienceEl: HTMLAudioElement | null = null;
let loadedAmbienceId: AmbienceId | null = null;
let fadingAmbienceEl: HTMLAudioElement | null = null;
let ambienceFadeRaf: number | null = null;
const AMBIENCE_CROSSFADE_MS = 4500;
let wantsAmbienceLayer = false;
let currentAmbienceLayerId: AmbienceId = 'rain';
let ambienceLayerEl: HTMLAudioElement | null = null;
let loadedAmbienceLayerId: AmbienceId | null = null;
let fadingAmbienceLayerEl: HTMLAudioElement | null = null;
let ambienceLayerFadeRaf: number | null = null;
const AMBIENCE_LAYER_CROSSFADE_MS = 4500;
const STORM_AMBIENCE_MULTIPLIER = 0.2295;
let pendingAmbienceInstantSwitch = false;
let pendingAmbienceLayerInstantSwitch = false;
const IDLE_HUMMING_DELAY_MS = 30_000;
const IDLE_HUMMING_MULTIPLIER = 0.25;
let footstepsActive = false;
let footstepLoopEl: HTMLAudioElement | null = null;
let idleHummingEl: HTMLAudioElement | null = null;
let yayEl: HTMLAudioElement | null = null;
let idleHummingTimer: number | null = null;
const lastSfxPick = new Map<SfxId, number>();
const alternatingSfx = new Set<SfxId>(['pickup']);
let audioDuckUntil = 0;
let audioDuckTimer: number | null = null;
const AREA_UNLOCK_DUCK_MULTIPLIER = 0.35;
let areaUnlockMusicDuck = 1;
let areaUnlockMusicDuckRaf: number | null = null;
let areaUnlockMusicDuckFallbackTimer: number | null = null;
const AREA_UNLOCK_MUSIC_DUCK_LEVEL = 0.18;
const AREA_UNLOCK_MUSIC_DUCK_DOWN_MS = 220;
const AREA_UNLOCK_MUSIC_DUCK_UP_MS = 420;
const AREA_UNLOCK_MUSIC_DUCK_FALLBACK_MS = 4500;

function clearAudioDuckTimer() {
	if (audioDuckTimer !== null && typeof window !== 'undefined') {
		window.clearTimeout(audioDuckTimer);
	}
	audioDuckTimer = null;
}

function startAudioDuck(durationMs: number) {
	const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
	audioDuckUntil = Math.max(audioDuckUntil, now + Math.max(0, durationMs));
	clearAudioDuckTimer();
	if (typeof window !== 'undefined') {
		const delay = Math.max(0, audioDuckUntil - now);
		audioDuckTimer = window.setTimeout(() => {
			audioDuckTimer = null;
		}, delay);
	}
}

function currentAudioDuckMultiplier() {
	if (!audioDuckUntil) return 1;
	const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
	return now < audioDuckUntil ? AREA_UNLOCK_DUCK_MULTIPLIER : 1;
}

function refreshMusicVolumeNow() {
	if (musicEl) musicEl.volume = effectiveMusicTrackVolume(currentMusicId);
	if (idleHummingEl && !idleHummingEl.paused) idleHummingEl.volume = effectiveIdleHummingVolume();
}

function clearIdleHummingTimer() {
	if (idleHummingTimer !== null && typeof window !== 'undefined') {
		window.clearTimeout(idleHummingTimer);
	}
	idleHummingTimer = null;
}

function effectiveIdleHummingVolume(): number {
	if (!state.enabled) return 0;
	return clamp01(state.masterVolume * state.musicVolume * IDLE_HUMMING_MULTIPLIER * currentAudioDuckMultiplier());
}

function stopIdleHumming() {
	clearIdleHummingTimer();
	if (!idleHummingEl) return;
	idleHummingEl.pause();
	idleHummingEl.currentTime = 0;
	idleHummingEl.volume = 0;
}

function ensureIdleHummingElement(): HTMLAudioElement {
	if (!idleHummingEl) idleHummingEl = createAudio('/audio/sfx/humming.m4a', true);
	idleHummingEl.volume = effectiveIdleHummingVolume();
	return idleHummingEl;
}

function ensureYayElement(): HTMLAudioElement {
	if (!yayEl) {
		yayEl = createAudio(AUDIO_ASSETS.sfx.yay as string, false);
		yayEl.preload = 'auto';
		yayEl.load();
	}
	return yayEl;
}

function scheduleIdleHumming() {
	clearIdleHummingTimer();
	if (footstepsActive || !state.enabled || !unlockedByGesture || typeof window === 'undefined') return;
	idleHummingTimer = window.setTimeout(() => {
		idleHummingTimer = null;
		if (footstepsActive || !state.enabled || !unlockedByGesture) return;
		const el = ensureIdleHummingElement();
		el.volume = effectiveIdleHummingVolume();
		if (el.paused) void el.play().catch(() => undefined);
	}, IDLE_HUMMING_DELAY_MS);
}

function stopAreaUnlockMusicDuckAnimation() {
	if (areaUnlockMusicDuckRaf !== null && typeof window !== 'undefined') {
		window.cancelAnimationFrame(areaUnlockMusicDuckRaf);
	}
	areaUnlockMusicDuckRaf = null;
}

function clearAreaUnlockMusicDuckFallback() {
	if (areaUnlockMusicDuckFallbackTimer !== null && typeof window !== 'undefined') {
		window.clearTimeout(areaUnlockMusicDuckFallbackTimer);
	}
	areaUnlockMusicDuckFallbackTimer = null;
}

function animateAreaUnlockMusicDuck(target: number, durationMs: number) {
	const to = clamp01(target);
	stopAreaUnlockMusicDuckAnimation();
	const from = areaUnlockMusicDuck;
	if (durationMs <= 0 || Math.abs(from - to) < 0.001 || typeof window === 'undefined') {
		areaUnlockMusicDuck = to;
		refreshMusicVolumeNow();
		return;
	}
	const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
	const tick = (now: number) => {
		const t = clamp01((now - start) / durationMs);
		areaUnlockMusicDuck = from + (to - from) * t;
		refreshMusicVolumeNow();
		if (t < 1) {
			areaUnlockMusicDuckRaf = window.requestAnimationFrame(tick);
			return;
		}
		areaUnlockMusicDuck = to;
		areaUnlockMusicDuckRaf = null;
		refreshMusicVolumeNow();
	};
	areaUnlockMusicDuckRaf = window.requestAnimationFrame(tick);
}

function beginAreaUnlockMusicDuck() {
	clearAreaUnlockMusicDuckFallback();
	animateAreaUnlockMusicDuck(AREA_UNLOCK_MUSIC_DUCK_LEVEL, AREA_UNLOCK_MUSIC_DUCK_DOWN_MS);
	if (typeof window !== 'undefined') {
		areaUnlockMusicDuckFallbackTimer = window.setTimeout(() => {
			areaUnlockMusicDuckFallbackTimer = null;
			animateAreaUnlockMusicDuck(1, AREA_UNLOCK_MUSIC_DUCK_UP_MS);
		}, AREA_UNLOCK_MUSIC_DUCK_FALLBACK_MS);
	}
}

function endAreaUnlockMusicDuck() {
	clearAreaUnlockMusicDuckFallback();
	animateAreaUnlockMusicDuck(1, AREA_UNLOCK_MUSIC_DUCK_UP_MS);
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
	if (!state.enabled) return 0;
	return clamp01(state.masterVolume * state.sfxVolume * currentAudioDuckMultiplier());
}

function effectiveSfxTrackVolume(id: SfxId): number {
	if (id === 'areaUnlocked') {
		return clamp01(state.masterVolume * state.sfxVolume);
	}
	const multiplier =
		id === 'menuhover'
			? 0.7
			: id === 'hover'
				? 0.8
				: id === 'dig'
					? 0.6
					: id === 'water'
						? 1.3
						: id === 'craft'
							? 0.8
							: id === 'plant'
								? 1.4
								: id === 'yay'
									? 0.5
									: 1;
	return clamp01(effectiveSfxVolume() * multiplier);
}

function effectiveMusicVolume(): number {
	if (!state.enabled) return 0;
	return clamp01(state.masterVolume * state.musicVolume * areaUnlockMusicDuck * currentAudioDuckMultiplier());
}

function effectiveMusicTrackVolume(track: MusicId): number {
	const trackMultiplier =
		track === 'hollowforest_level1' ||
		track === 'hollowforest_level2' ||
		track === 'hollowforest_level3' ||
		track === 'wetlands_level1' ||
		track === 'wetlands_level2' ||
		track === 'wetlands_level3'
			? 0.7
			: track === 'pelicanbay_level1' || track === 'pelicanbay_level2' || track === 'pelicanbay_level3'
				? 0.49
			: 1;
	const hollowForestExtraDrop =
		track === 'hollowforest_level1' || track === 'hollowforest_level2' || track === 'hollowforest_level3';
	const adjustedMultiplier = hollowForestExtraDrop ? 0.6 : trackMultiplier;
	return clamp01(effectiveMusicVolume() * adjustedMultiplier);
}

function effectiveAmbienceVolume(): number {
	if (!state.enabled) return 0;
	// Keep environmental ambience noticeably softer than music.
	return clamp01(state.masterVolume * state.musicVolume * 0.45 * currentAudioDuckMultiplier());
}

function effectiveAmbienceTrackVolume(track: AmbienceId): number {
	const multiplier = track === 'storm' ? 0.2295 : track === 'rain' ? 0.585 : 0.45;
	return clamp01(state.masterVolume * state.musicVolume * multiplier * currentAudioDuckMultiplier());
}

function effectiveStormLayerVolume(): number {
	return clamp01(state.masterVolume * state.musicVolume * STORM_AMBIENCE_MULTIPLIER * currentAudioDuckMultiplier());
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

function stopAmbienceLayerFade() {
	if (ambienceLayerFadeRaf !== null && typeof window !== 'undefined') {
		window.cancelAnimationFrame(ambienceLayerFadeRaf);
	}
	ambienceLayerFadeRaf = null;
	if (fadingAmbienceLayerEl) {
		fadingAmbienceLayerEl.pause();
		fadingAmbienceLayerEl.currentTime = 0;
		fadingAmbienceLayerEl.volume = 0;
		fadingAmbienceLayerEl = null;
	}
}

function ensureMusicElement(track: MusicId): HTMLAudioElement {
	if (musicEl && loadedMusicId === track) {
		musicEl.volume = effectiveMusicTrackVolume(track);
		return musicEl;
	}
	const nextEl = createAudio(AUDIO_ASSETS.music[track], true);
	nextEl.volume = effectiveMusicTrackVolume(track);
	return nextEl;
}

function ensureAmbienceElement(track: AmbienceId): HTMLAudioElement {
	if (ambienceEl && loadedAmbienceId === track) {
		ambienceEl.volume = effectiveAmbienceTrackVolume(track);
		return ambienceEl;
	}
	const nextEl = createAudio(AUDIO_ASSETS.ambience[track], true);
	nextEl.volume = effectiveAmbienceTrackVolume(track);
	return nextEl;
}

function ensureAmbienceLayerElement(track: AmbienceId): HTMLAudioElement {
	if (ambienceLayerEl && loadedAmbienceLayerId === track) {
		ambienceLayerEl.volume = effectiveStormLayerVolume();
		return ambienceLayerEl;
	}
	const nextEl = createAudio(AUDIO_ASSETS.ambience[track], true);
	nextEl.volume = effectiveStormLayerVolume();
	return nextEl;
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
			void musicEl.play().catch(() => undefined);
		}
		return;
	}

	stopMusicFade();
	fadingMusicEl = prevEl;
	musicEl = nextEl;
	loadedMusicId = nextTrack;
	nextEl.volume = 0;
	if (nextEl.paused) {
		void nextEl.play().catch(() => undefined);
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
		musicFadeRaf = null;
	};

	musicFadeRaf = window.requestAnimationFrame(tick);
}

function startAmbienceCrossfade(nextTrack: AmbienceId, nextEl: HTMLAudioElement) {
	const prevEl = ambienceEl;
	if (!prevEl || prevEl === nextEl) {
		stopAmbienceFade();
		ambienceEl = nextEl;
		loadedAmbienceId = nextTrack;
		ambienceEl.volume = effectiveAmbienceTrackVolume(nextTrack);
		if (ambienceEl.paused) {
			void ambienceEl.play().catch(() => undefined);
		}
		return;
	}

	stopAmbienceFade();
	fadingAmbienceEl = prevEl;
	ambienceEl = nextEl;
	loadedAmbienceId = nextTrack;
	nextEl.volume = 0;
	if (nextEl.paused) {
		void nextEl.play().catch(() => undefined);
	}

	const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
	const tick = (now: number) => {
		const elapsed = now - start;
		const t = clamp01(elapsed / AMBIENCE_CROSSFADE_MS);
		const target = effectiveAmbienceTrackVolume(nextTrack);
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
		ambienceFadeRaf = null;
	};

	ambienceFadeRaf = window.requestAnimationFrame(tick);
}

function startAmbienceLayerCrossfade(nextTrack: AmbienceId, nextEl: HTMLAudioElement) {
	const prevEl = ambienceLayerEl;
	if (!prevEl || prevEl === nextEl) {
		stopAmbienceLayerFade();
		ambienceLayerEl = nextEl;
		loadedAmbienceLayerId = nextTrack;
		ambienceLayerEl.volume = clamp01(
			state.masterVolume * state.musicVolume * STORM_AMBIENCE_MULTIPLIER * currentAudioDuckMultiplier(),
		);
		if (ambienceLayerEl.paused) {
			void ambienceLayerEl.play().catch(() => undefined);
		}
		return;
	}

	stopAmbienceLayerFade();
	fadingAmbienceLayerEl = prevEl;
	ambienceLayerEl = nextEl;
	loadedAmbienceLayerId = nextTrack;
	nextEl.volume = 0;
	if (nextEl.paused) {
		void nextEl.play().catch(() => undefined);
	}

	const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
	const tick = (now: number) => {
		const elapsed = now - start;
		const t = clamp01(elapsed / AMBIENCE_LAYER_CROSSFADE_MS);
		const target = effectiveStormLayerVolume();
		if (ambienceLayerEl) ambienceLayerEl.volume = target * t;
		if (fadingAmbienceLayerEl) fadingAmbienceLayerEl.volume = target * (1 - t);

		if (t < 1 && wantsAmbienceLayer && state.enabled) {
			ambienceLayerFadeRaf = window.requestAnimationFrame(tick);
			return;
		}

		if (fadingAmbienceLayerEl) {
			fadingAmbienceLayerEl.pause();
			fadingAmbienceLayerEl.currentTime = 0;
			fadingAmbienceLayerEl.volume = 0;
			fadingAmbienceLayerEl = null;
		}
		if (ambienceLayerEl) ambienceLayerEl.volume = target;
		ambienceLayerFadeRaf = null;
	};

	ambienceLayerFadeRaf = window.requestAnimationFrame(tick);
}

function switchAmbienceImmediate(nextTrack: AmbienceId, nextEl: HTMLAudioElement) {
	stopAmbienceFade();
	if (ambienceEl && ambienceEl !== nextEl) {
		ambienceEl.pause();
		ambienceEl.currentTime = 0;
		ambienceEl.volume = 0;
	}
	ambienceEl = nextEl;
	loadedAmbienceId = nextTrack;
	nextEl.volume = effectiveAmbienceTrackVolume(nextTrack);
	if (nextEl.paused) {
		void nextEl.play().catch(() => undefined);
	}
}

function switchAmbienceLayerImmediate(nextTrack: AmbienceId, nextEl: HTMLAudioElement) {
	stopAmbienceLayerFade();
	if (ambienceLayerEl && ambienceLayerEl !== nextEl) {
		ambienceLayerEl.pause();
		ambienceLayerEl.currentTime = 0;
		ambienceLayerEl.volume = 0;
	}
	ambienceLayerEl = nextEl;
	loadedAmbienceLayerId = nextTrack;
	nextEl.volume = effectiveStormLayerVolume();
	if (nextEl.paused) {
		void nextEl.play().catch(() => undefined);
	}
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

function tryPlayMusic() {
	if (!wantsMusic || !state.enabled || !unlockedByGesture) return;
	const prevEl = musicEl;
	const prevTrack = loadedMusicId;
	const el = ensureMusicElement(currentMusicId);
	if (prevEl && prevTrack && prevTrack !== currentMusicId) {
		startMusicCrossfade(currentMusicId, el);
		return;
	}
	musicEl = el;
	loadedMusicId = currentMusicId;
	el.volume = effectiveMusicTrackVolume(currentMusicId);
	if (el.paused) {
		void el.play().catch(() => undefined);
	}
}

function syncMusicPlayback() {
	if (!wantsMusic || !state.enabled) {
		stopMusicFade();
		if (musicEl) {
			musicEl.pause();
			musicEl.currentTime = 0;
			musicEl.volume = 0;
		}
		loadedMusicId = null;
		return;
	}
	tryPlayMusic();
}

function syncAmbiencePlayback() {
	if (!wantsAmbience || !state.enabled) {
		stopAmbienceFade();
		if (ambienceEl) {
			ambienceEl.pause();
			ambienceEl.currentTime = 0;
			ambienceEl.volume = 0;
		}
		loadedAmbienceId = null;
	} else if (!unlockedByGesture) {
		return;
	} else {
		const prevAmbienceEl = ambienceEl;
		const prevAmbienceTrack = loadedAmbienceId;
		const el = ensureAmbienceElement(currentAmbienceId);
		if (prevAmbienceEl && prevAmbienceTrack && prevAmbienceTrack !== currentAmbienceId) {
			if (pendingAmbienceInstantSwitch) switchAmbienceImmediate(currentAmbienceId, el);
			else startAmbienceCrossfade(currentAmbienceId, el);
		} else {
			ambienceEl = el;
			loadedAmbienceId = currentAmbienceId;
			el.volume = effectiveAmbienceTrackVolume(currentAmbienceId);
			if (el.paused) {
				void el.play().catch(() => undefined);
			}
		}
		pendingAmbienceInstantSwitch = false;
	}

	if (!wantsAmbienceLayer || !state.enabled) {
		stopAmbienceLayerFade();
		if (ambienceLayerEl) {
			ambienceLayerEl.pause();
			ambienceLayerEl.currentTime = 0;
			ambienceLayerEl.volume = 0;
		}
		loadedAmbienceLayerId = null;
		return;
	}
	if (!unlockedByGesture) return;
	const prevLayerEl = ambienceLayerEl;
	const prevLayerTrack = loadedAmbienceLayerId;
	const layerEl = ensureAmbienceLayerElement(currentAmbienceLayerId);
	if (prevLayerEl && prevLayerTrack && prevLayerTrack !== currentAmbienceLayerId) {
		if (pendingAmbienceLayerInstantSwitch) switchAmbienceLayerImmediate(currentAmbienceLayerId, layerEl);
		else startAmbienceLayerCrossfade(currentAmbienceLayerId, layerEl);
		pendingAmbienceLayerInstantSwitch = false;
		return;
	}
	ambienceLayerEl = layerEl;
	loadedAmbienceLayerId = currentAmbienceLayerId;
	layerEl.volume = effectiveStormLayerVolume();
	if (layerEl.paused) {
		void layerEl.play().catch(() => undefined);
	}
	pendingAmbienceLayerInstantSwitch = false;
}

function syncFootstepPlayback() {
	const el = ensureFootstepLoopElement();
	if (!el) return;
	el.volume = effectiveSfxVolume();
	if (!footstepsActive || !state.enabled) {
		el.pause();
		el.currentTime = 0;
		if (!state.enabled) stopIdleHumming();
		else scheduleIdleHumming();
		return;
	}
	stopIdleHumming();
	if (!unlockedByGesture) return;
	if (el.paused) {
		void el.play().catch(() => {
			// Browser autoplay policies can still block until another user gesture.
		});
	}
}

function playSfx(id: SfxId) {
	if (!state.enabled || !unlockedByGesture) return;
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
	const oneShot = id === 'yay' ? ensureYayElement() : createAudio(path, false);
	oneShot.volume = effectiveSfxTrackVolume(id);
	if (id === 'yay') {
		oneShot.currentTime = 0;
	}
	if (id === 'areaUnlocked') {
		beginAreaUnlockMusicDuck();
		oneShot.addEventListener(
			'ended',
			() => {
				endAreaUnlockMusicDuck();
				syncMusicPlayback();
				syncAmbiencePlayback();
				syncFootstepPlayback();
			},
			{ once: true },
		);
	}
	void oneShot.play().catch(() => {
		// Silent failure is fine; most often blocked until user interacts.
	});
}

export function primeAudio() {
	unlockedByGesture = true;
	ensureYayElement();
	tryPlayMusic();
	syncAmbiencePlayback();
	syncFootstepPlayback();
}

export function applyAudioPrefs(prefs: AudioPrefs) {
	state.enabled = prefs.audioEnabled === undefined ? state.enabled : !!prefs.audioEnabled;
	state.masterVolume = clamp01(typeof prefs.masterVolume === 'number' ? prefs.masterVolume : state.masterVolume);
	state.sfxVolume = clamp01(typeof prefs.sfxVolume === 'number' ? prefs.sfxVolume : state.sfxVolume);
	state.musicVolume = clamp01(typeof prefs.musicVolume === 'number' ? prefs.musicVolume : state.musicVolume);
	syncMusicPlayback();
	syncAmbiencePlayback();
	syncFootstepPlayback();
}

export function setMusicActive(active: boolean, track: MusicId = 'wildwillowstheme') {
	wantsMusic = active;
	currentMusicId = track;
	syncMusicPlayback();
}

export function setAmbienceActive(active: boolean, track: AmbienceId = 'meadow', options: AmbiencePlaybackOptions = {}) {
	wantsAmbience = active;
	currentAmbienceId = track;
	pendingAmbienceInstantSwitch = !!options.instant;
	syncAmbiencePlayback();
}

export function setAmbienceLayerActive(active: boolean, track: AmbienceId = 'rain', options: AmbiencePlaybackOptions = {}) {
	wantsAmbienceLayer = active;
	currentAmbienceLayerId = track;
	pendingAmbienceLayerInstantSwitch = !!options.instant;
	syncAmbiencePlayback();
}

function setFootstepsActive(active: boolean) {
	footstepsActive = active;
	if (active) stopIdleHumming();
	else scheduleIdleHumming();
	syncFootstepPlayback();
}

export function bindGameAudio(): () => void {
	let lastMenuHoverTarget: Element | null = null;
	const isMenuHoverTarget = (target: EventTarget | null) => {
		if (!(target instanceof Element)) return null;
		return target.closest('button, [role="button"], .big-btn, .link-btn, .menu-toggle-btn, input, select, textarea');
	};
	const offSfx = bridge.on('audio-sfx', (payload: any) => {
		const id = String(payload?.id || '') as SfxId;
		if (id && id in AUDIO_ASSETS.sfx) playSfx(id);
	});
	const onPointerOver = (event: PointerEvent) => {
		const target = isMenuHoverTarget(event.target);
		if (!target || target === lastMenuHoverTarget) return;
		lastMenuHoverTarget = target;
		playSfx('menuhover');
	};
	const onPointerOut = (event: PointerEvent) => {
		if (!lastMenuHoverTarget) return;
		const current = isMenuHoverTarget(event.target);
		if (!current || current !== lastMenuHoverTarget) return;
		const related = isMenuHoverTarget(event.relatedTarget);
		if (related === lastMenuHoverTarget) return;
		lastMenuHoverTarget = null;
	};
	window.addEventListener('pointerover', onPointerOver, true);
	window.addEventListener('pointerout', onPointerOut, true);
	const offWalk = bridge.on('audio-walk', (payload: any) => {
		setFootstepsActive(!!payload?.active);
	});
	const offToast = bridge.on('audio-toast', () => {
		playSfx('toast');
	});
	const offConfetti = bridge.on('confetti', () => {
		playSfx('yay');
	});
	return () => {
		offSfx();
		offWalk();
		offToast();
		offConfetti();
		window.removeEventListener('pointerover', onPointerOver, true);
		window.removeEventListener('pointerout', onPointerOut, true);
	};
}
