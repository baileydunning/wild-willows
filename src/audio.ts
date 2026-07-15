import { bridge } from './game/bridge';

type SfxId = 'toast' | 'hover' | 'footstep' | 'harvest' | 'craft' | 'place' | 'pickup' | 'move' | 'upgrade' | 'rest';

type MusicId = 'preserve' | 'wildwillowstheme' | 'meadowambient';
type AmbienceId = 'meadow';

const AUDIO_ASSETS: {
	music: Record<MusicId, string>;
	ambience: Record<AmbienceId, string>;
	sfx: Record<SfxId, string | string[]>;
} = {
	music: {
		// Replace with your real music file when ready.
		preserve: '/audio/music/preserve-loop.mp3',
		wildwillowstheme: '/audio/music/WildWillows_ThemeIdea.mp3',
		meadowambient: '/audio/music/meadowambient.mp3',
	},
	ambience: {
		meadow: '/audio/sfx/meadow.mp3',
	},
	sfx: {
		// Replace any of these with your own file names/paths.
		toast: '/audio/sfx/toast.mp3',
		hover: ['/audio/sfx/hover1.wav', '/audio/sfx/hover2.wav', '/audio/sfx/hover3.wav'],
		footstep: '/audio/sfx/dirtfootsteps.wav',
		harvest: '/audio/sfx/harvest.mp3',
		craft: '/audio/sfx/craft.mp3',
		place: '/audio/sfx/place.mp3',
		pickup: ['/audio/sfx/pickup1.wav', '/audio/sfx/pickup2.wav'],
		move: '/audio/sfx/move.mp3',
		upgrade: '/audio/sfx/upgrade.mp3',
		rest: '/audio/sfx/rest.mp3',
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
let wantsAmbience = false;
let currentAmbienceId: AmbienceId = 'meadow';
let ambienceEl: HTMLAudioElement | null = null;
let loadedAmbienceId: AmbienceId | null = null;
let footstepsActive = false;
let footstepLoopEl: HTMLAudioElement | null = null;
const lastSfxPick = new Map<SfxId, number>();
const alternatingSfx = new Set<SfxId>(['pickup']);

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
	return clamp01(state.masterVolume * state.sfxVolume);
}

function effectiveMusicVolume(): number {
	if (!state.enabled) return 0;
	return clamp01(state.masterVolume * state.musicVolume);
}

function effectiveAmbienceVolume(): number {
	if (!state.enabled) return 0;
	// Keep environmental ambience noticeably softer than music.
	return clamp01(state.masterVolume * state.musicVolume * 0.45);
}

function ensureMusicElement(track: MusicId): HTMLAudioElement {
	if (!musicEl || loadedMusicId !== track) {
		if (musicEl) {
			musicEl.pause();
			musicEl = null;
		}
		musicEl = createAudio(AUDIO_ASSETS.music[track], true);
		loadedMusicId = track;
	}
	musicEl.volume = effectiveMusicVolume();
	return musicEl;
}

function ensureAmbienceElement(track: AmbienceId): HTMLAudioElement {
	if (!ambienceEl || loadedAmbienceId !== track) {
		if (ambienceEl) {
			ambienceEl.pause();
			ambienceEl = null;
		}
		ambienceEl = createAudio(AUDIO_ASSETS.ambience[track], true);
		loadedAmbienceId = track;
	}
	ambienceEl.volume = effectiveAmbienceVolume();
	return ambienceEl;
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
	const el = ensureMusicElement(currentMusicId);
	el.volume = effectiveMusicVolume();
	if (el.paused) {
		void el.play().catch(() => {
			// Browser autoplay policies can still block until another user gesture.
		});
	}
}

function syncMusicPlayback() {
	const el = ensureMusicElement(currentMusicId);
	el.volume = effectiveMusicVolume();
	if (!wantsMusic || !state.enabled) {
		el.pause();
		loadedMusicId = null;
		return;
	}
	tryPlayMusic();
}

function syncAmbiencePlayback() {
	const el = ensureAmbienceElement(currentAmbienceId);
	el.volume = effectiveAmbienceVolume();
	if (!wantsAmbience || !state.enabled) {
		el.pause();
		el.currentTime = 0;
		loadedAmbienceId = null;
		return;
	}
	if (!unlockedByGesture) return;
	if (el.paused) {
		void el.play().catch(() => {
			// Browser autoplay policies can still block until another user gesture.
		});
	}
}

function syncFootstepPlayback() {
	const el = ensureFootstepLoopElement();
	if (!el) return;
	el.volume = effectiveSfxVolume();
	if (!footstepsActive || !state.enabled) {
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
	const oneShot = createAudio(path, false);
	oneShot.volume = effectiveSfxVolume();
	void oneShot.play().catch(() => {
		// Silent failure is fine; most often blocked until user interacts.
	});
}

export function primeAudio() {
	unlockedByGesture = true;
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

export function setAmbienceActive(active: boolean, track: AmbienceId = 'meadow') {
	wantsAmbience = active;
	currentAmbienceId = track;
	syncAmbiencePlayback();
}

function setFootstepsActive(active: boolean) {
	footstepsActive = active;
	syncFootstepPlayback();
}

export function bindGameAudio(): () => void {
	const offSfx = bridge.on('audio-sfx', (payload: any) => {
		const id = String(payload?.id || '') as SfxId;
		if (id && id in AUDIO_ASSETS.sfx) playSfx(id);
	});
	const offWalk = bridge.on('audio-walk', (payload: any) => {
		setFootstepsActive(!!payload?.active);
	});
	const offToast = bridge.on('audio-toast', () => {
		playSfx('toast');
	});
	return () => {
		offSfx();
		offWalk();
		offToast();
	};
}
