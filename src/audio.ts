import { bridge } from './game/bridge';
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
let unlockedByGesture = !!(globalThis as any).wildWillowsDesktop?.isDesktop;
let wantsMusic = false;
let currentMusicId: MusicId = 'wildwillowstheme';
let musicEl: HTMLAudioElement | null = null;
let loadedMusicId: MusicId | null = null;
let fadingMusicEl: HTMLAudioElement | null = null;
let musicFadeRaf: number | null = null;
const MUSIC_CROSSFADE_MS = 2000;
const musicEls = new Map<MusicId, HTMLAudioElement>();

/* THE MEADOW IS IN AABA.
 *
 * Its piece used to be a loop: one idea, around and around for as long as you
 * stood in the grass. It now plays as a song — two passes of the A section, a
 * contrasting bridge, then A again, and the form repeats. The three health-level
 * mixes are the same A section in different layerings, so they share one bridge
 * between them.
 *
 * This is a layer ON TOP of the track machinery below rather than a second
 * player: the sections are ordinary music tracks, they hand off with the same
 * crossfade every other track change uses, and `currentMusicId` stays whatever
 * the GAME asked for (the health-level mix). Only `loadedMusicId` — what is
 * actually sounding — moves to the bridge and back.
 */
const MUSIC_BRIDGE: Partial<Record<MusicId, MusicId>> = {
	meadowambient: 'meadowambient_alt',
	meadowambient_level2: 'meadowambient_alt',
	meadowambient_level3: 'meadowambient_alt',
};
/** One entry per pass through a section. Read it literally: A, A, B, A, repeat. */
const MUSIC_FORM = ['A', 'A', 'B', 'A'] as const;
/** Hand off a fade's width before the section runs out, so the next one is up as
 *  this one lands rather than after the loop has already wrapped into a repeat
 *  nobody asked for. */
const SECTION_SEAM_S = MUSIC_CROSSFADE_MS / 1000;
const sectionTracks = new Set<MusicId>([
	...(Object.keys(MUSIC_BRIDGE) as MusicId[]),
	...(Object.values(MUSIC_BRIDGE) as MusicId[]),
]);
/** The A track the form is built around, or null when the game is asking for
 *  music that has no form. */
let formHome: MusicId | null = null;
/** Which pass of MUSIC_FORM is sounding right now. */
let formStep = 0;
/** Cleared the moment a seam is acted on and set again once the section has
 *  moved clear of it, so one seam advances the form exactly once — timeupdate
 *  fires about four times a second and the seam is two seconds wide. */
let seamArmed = true;
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
/** How close the caretaker is to a fire: 0 = out of earshot, 1 = standing at it.
 *  The crackle is one looping element whose volume tracks this, rather than a
 *  cue that fires on arrival — walking past a campfire should sound like walking
 *  past a campfire. */
let fireNearness = 0;
let fireLoopEl: HTMLAudioElement | null = null;
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

/* WHICH PIECE BELONGS TO A PLACE.
 *
 * Pure and exported, so the choice can be tested without standing up the app.
 * It used to be a ladder of nested ternaries inside an App effect whose final
 * `else` was the meadow — which meant every area the ladder did not recognise
 * played the meadow's music, and a trail tent ('tent-<biome>') is exactly such
 * an area. Six biomes in the ridge tent sounded like the meadow. Here an
 * unrecognised area is a lookup miss rather than a branch that quietly lands on
 * a real track.
 */
const BIOME_MUSIC: Record<string, readonly [MusicId, MusicId, MusicId]> = {
	meadow: ['meadowambient', 'meadowambient_level2', 'meadowambient_level3'],
	forest: ['hollowforest_level1', 'hollowforest_level2', 'hollowforest_level3'],
	wetland: ['wetlands_level1', 'wetlands_level2', 'wetlands_level3'],
	desert: ['scrubland_level1', 'scrubland_level2', 'scrubland_level3'],
	alpine: ['graywind_level1', 'graywind_level2', 'graywind_level3'],
	coastal: ['pelicanbay_level1', 'pelicanbay_level2', 'pelicanbay_level3'],
};

/** Inside the house, or inside a trail tent pitched out in a biome. Both are
 *  rooms: the land outside stops carrying them. */
export function isIndoorArea(area: string | undefined | null): boolean {
	return !!area && (area === 'home' || area.startsWith('tent-'));
}

/** The gameplay track for an area, given a way to read a biome's health.
 *  Health picks the mix; the area picks the piece. */
export function gameplayMusicFor(area: string | undefined | null, biomeHealth: (biomeId: string) => number): MusicId {
	if (isIndoorArea(area)) return 'home';
	const tiers = area ? BIOME_MUSIC[area] : undefined;
	// An outdoor area with no music of its own: the meadow is the preserve's
	// default piece, and silence would be worse than the wrong grass.
	if (!tiers) return BIOME_MUSIC.meadow[0];
	const health = biomeHealth(area as string);
	return health < 50 ? tiers[0] : health < 80 ? tiers[1] : tiers[2];
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
	/* preload is keyed off `loop`, which cleanly separates the two kinds of audio
	 * here: everything looping is long-form (music, ambience, rain/storm, walking,
	 * humming) and everything one-shot is a short sfx.
	 *
	 * 'auto' on a looping track downloads the WHOLE file the moment the element is
	 * constructed. Entering the world builds the meadow ambience — 5.1 MB — and a
	 * music track, on top of the app bundle and the in-app backend chunk still
	 * settling, and the result is a few seconds of a character that barely moves.
	 * 'metadata' lets them stream instead; playback starts just as promptly because
	 * these are backgrounds, not cues.
	 *
	 * Short sfx keep 'auto' deliberately — they're tens of KB, and a gather sound
	 * that arrives late is worse than one that cost a few hundred KB up front. */
	el.preload = loop ? 'metadata' : 'auto';
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

function effectiveFireVolume(): number {
	if (!state.enabled || !state.sfxEnabled) return 0;
	const gain = sfxGain.fireCrackling ?? 1;
	// Nearness last: it is the only part that changes while the player moves, and
	// it multiplies whatever the preferences already allow.
	return clamp01(state.masterVolume * state.sfxVolume * gain * fireNearness);
}

/*
 * A TRACK KEEPS ITS PLACE WHILE YOU ARE AWAY FROM IT.
 *
 * Nothing below ever rewinds a music element. Walking from the meadow into the
 * wetland pauses the meadow's piece where it stands, and walking back picks it
 * up from that bar rather than restarting the opening phrase — which is what
 * made a lap of the preserve sound like the same eight seconds of music four
 * times over.
 *
 * The elements are cached per track for the life of the session (musicEls), and
 * a paused HTMLAudioElement holds its currentTime, so this costs nothing and
 * needs no bookkeeping: it is the ABSENCE of the rewinds that used to be here.
 * Volume is still reset, because a resumed track has its volume set on the way
 * back in and a stale one would ramp from the wrong place.
 */
function getMusicElement(track: MusicId): HTMLAudioElement {
	let el = musicEls.get(track);
	if (!el) {
		el = createAudio(AUDIO_ASSETS.music[track], true);
		/* A section carries its own timekeeping. timeupdate only fires while the
		 * element is actually playing, so a form that nobody is listening to costs
		 * nothing — and there is no interval left running over a paused meadow. */
		if (sectionTracks.has(track)) {
			const section = el;
			el.addEventListener('timeupdate', () => advanceMusicForm(section));
		}
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
		fadingMusicEl.pause(); // left where it stands — see the note above getMusicElement
		fadingMusicEl.volume = 0;
		fadingMusicEl = null;
	}
}

/* Silence every track that is not the current one or the one fading out — and
 * leave each of them exactly where it stopped, so returning to that place in the
 * world returns to that place in its music.
 *
 * Both writes are guarded on the value ACTUALLY changing, and that is the whole
 * point of the function's shape. This loop walks EVERY music track ever built:
 * musicEls is a cache that is never pruned, so a long session accumulates up to
 * all 21 of them, and it runs on EVERY game state change via syncMusicPlayback.
 * Re-pausing an element that is already paused with its volume already at 0 is
 * pure cost for no observable effect, and `volume` is not a free write — it
 * crosses into the media pipeline. */
function pauseOrphanedMusic() {
	for (const el of musicEls.values()) {
		if (el === musicEl || el === fadingMusicEl) continue;
		if (!el.paused) el.pause();
		if (el.volume !== 0) el.volume = 0;
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
			fadingMusicEl.pause(); // keeps its position for the next time you come back
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

/* Guarded for exactly the reasons spelled out over pauseOrphanedMusic: a
 * no-op assignment to currentTime still seeks, this walks the whole unpruned
 * ambienceEls cache, and syncAmbiencePlayback calls it on every state change.
 * Fewer tracks than music, same wasted work per pass. */
function pauseOrphanedAmbience() {
	for (const el of ambienceEls.values()) {
		if (el === ambienceEl || el === fadingAmbienceEl) continue;
		if (!el.paused) el.pause();
		if (el.currentTime !== 0) el.currentTime = 0;
		if (el.volume !== 0) el.volume = 0;
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

function ensureFireLoopElement(): HTMLAudioElement | null {
	const path = AUDIO_ASSETS.sfx.fireCrackling;
	if (typeof path !== 'string' || !path) return null;
	if (!fireLoopEl) {
		fireLoopEl = createAudio(path, true);
	}
	fireLoopEl.volume = effectiveFireVolume();
	return fireLoopEl;
}

/** What should actually be sounding for a given request: the bridge while it has
 *  the floor, the requested track the rest of the time. */
function sectionTrackFor(requested: MusicId): MusicId {
	const bridge = MUSIC_BRIDGE[requested];
	if (!bridge) return requested;
	return MUSIC_FORM[formStep] === 'B' ? bridge : requested;
}

/* Walking out of the meadow ends the song and walking back in starts a new one,
 * so a request for music outside the form puts it back at the top. The ELEMENTS
 * still keep their positions either way — it is the form that starts over, not
 * the audio. A health level changing under the form is not a new song: it is the
 * same A section in a fuller mix, and the form plays on through it. */
function noteMusicRequest(requested: MusicId) {
	if (MUSIC_BRIDGE[requested]) {
		if (formHome === null) {
			formStep = 0;
			seamArmed = true;
		}
		formHome = requested;
		return;
	}
	formHome = null;
	formStep = 0;
	seamArmed = true;
}

/** Runs off the playing section's own timeupdate. */
function advanceMusicForm(el: HTMLAudioElement) {
	if (el !== musicEl || formHome === null) return;
	if (!wantsMusic || !state.enabled || !state.musicEnabled) return;
	const duration = el.duration;
	if (!Number.isFinite(duration) || duration <= 0) return;
	if (duration - el.currentTime > SECTION_SEAM_S) {
		seamArmed = true;
		return;
	}
	if (!seamArmed) return;
	seamArmed = false;

	const from = MUSIC_FORM[formStep];
	formStep = (formStep + 1) % MUSIC_FORM.length;
	const to = MUSIC_FORM[formStep];
	// A into its own repeat: the element's loop IS the handoff, and a crossfade
	// from a track to itself would only put a seam in a seamless one.
	if (to === from) return;

	const next = sectionTrackFor(formHome);
	const nextEl = getMusicElement(next);
	/* The one deliberate rewind in this file (see the note over getMusicElement).
	 * A section takes its turn from the top: the form is a piece being played
	 * through, not a place being returned to. */
	nextEl.currentTime = 0;
	startMusicCrossfade(next, nextEl);
}

function tryPlayMusic() {
	if (!wantsMusic || !state.enabled || !unlockedByGesture) return;
	// The form's own handoffs move loadedMusicId to the bridge while currentMusicId
	// stays on the meadow. Comparing against the raw request here would drag the
	// bridge back off the air on the next state change.
	const track = sectionTrackFor(currentMusicId);
	const next = getMusicElement(track);
	if (loadedMusicId && loadedMusicId !== track && musicEl) {
		startMusicCrossfade(track, next);
		return;
	}
	musicEl = next;
	loadedMusicId = track;
	// Don't clobber an in-progress crossfade's volume ramp — this runs on a 15s
	// timer and on every state change, so without the guard the new track jumps
	// to full mid-fade (an audible lurch on area transitions).
	if (musicFadeRaf === null) musicEl.volume = effectiveMusicTrackVolume(track);
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
			// Turning music off is another kind of leaving: it resumes where it
			// stopped rather than starting the piece over.
			musicEl.pause();
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

function syncFirePlayback() {
	const el = ensureFireLoopElement();
	if (!el) return;
	el.volume = effectiveFireVolume();
	if (fireNearness <= 0 || !state.enabled || !state.sfxEnabled) {
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

const DUCK_RAMP_DOWN_MS = 300;
const DUCK_HOLD_MS = 3800;
const DUCK_RAMP_UP_MS = 800;
const DUCK_TARGET = 0.15;

/**
 * Pull the music and ambience down so a cue can be heard over them, hold, and
 * bring them back.
 *
 * `target` is how far down: an area unlocking is a rare, large moment and gets
 * the deep dip; an animal coming home happens often enough that the same dip
 * would turn the soundtrack into a series of holes.
 */
function duckMusicFor(holdMs = DUCK_HOLD_MS, target = DUCK_TARGET) {
	if (duckRaf !== null && typeof window !== 'undefined') {
		window.cancelAnimationFrame(duckRaf);
		duckRaf = null;
	}
	// Start the ramp from wherever the mix currently sits, not from full volume.
	// A second cue arriving mid-duck used to snap the music back up and dip it
	// again, which is more noticeable than the cue it was making room for.
	const from = duckMultiplier;
	const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
	const total = DUCK_RAMP_DOWN_MS + holdMs + DUCK_RAMP_UP_MS;
	const tick = (now: number) => {
		const elapsed = now - start;
		if (elapsed < DUCK_RAMP_DOWN_MS) {
			const t = elapsed / DUCK_RAMP_DOWN_MS;
			duckMultiplier = from - t * (from - target);
		} else if (elapsed < DUCK_RAMP_DOWN_MS + holdMs) {
			duckMultiplier = target;
		} else {
			const t = (elapsed - DUCK_RAMP_DOWN_MS - holdMs) / DUCK_RAMP_UP_MS;
			duckMultiplier = target + clamp01(t) * (1 - target);
		}
		if (musicEl) musicEl.volume = effectiveMusicTrackVolume(loadedMusicId ?? currentMusicId);
		if (ambienceEl) ambienceEl.volume = effectiveAmbienceVolume();
		if (elapsed < total) {
			duckRaf = window.requestAnimationFrame(tick);
		} else {
			duckMultiplier = 1;
			if (musicEl) musicEl.volume = effectiveMusicTrackVolume(loadedMusicId ?? currentMusicId);
			if (ambienceEl) ambienceEl.volume = effectiveAmbienceVolume();
			duckRaf = null;
		}
	};
	duckRaf = window.requestAnimationFrame(tick);
}

/**
 * Cues that make room for themselves, and how much room.
 *
 * An area unlocking is the game's biggest moment: deep dip, long hold. An animal
 * returning is a smaller one that can arrive in bursts, so it dips less and for
 * about as long as its own cue takes to say what it came to say.
 */
const SFX_DUCK: Partial<Record<SfxId, { hold: number; target: number }>> = {
	areaUnlocked: { hold: DUCK_HOLD_MS, target: DUCK_TARGET },
	animalReturn: { hold: 2200, target: 0.4 },
};

/**
 * Cues that must not stack.
 *
 * A heartbeat that finds six animals home announces six arrivals, and an action
 * that triggers a recalc can land a second batch a moment later. One chime per
 * batch is the intent (state.tsx plays it once for the whole batch), and this is
 * the backstop for the second batch — six overlapping copies of the same 7-second
 * cue is a wall of sound, not a celebration.
 */
const SFX_COOLDOWN_MS: Partial<Record<SfxId, number>> = { animalReturn: 2500 };
const lastSfxAt = new Map<SfxId, number>();

/**
 * THE CUE CHANNEL: one ceremony at a time, and the bigger one wins.
 *
 * These are the long, attention-carrying sounds — the ones that announce
 * something rather than confirm it. Two of them playing over each other is not
 * two pieces of news, it is mush, and the moment a biome opens is exactly the
 * moment several animals come home, so the collision is the common case rather
 * than the rare one.
 *
 * Higher number wins. An arriving cue that outranks the one playing takes the
 * floor (the loser is faded, not chopped); one that ties or ranks lower is
 * dropped rather than queued, because a fanfare for something that happened nine
 * seconds ago is worse than no fanfare. Reordering the ladder is reordering these
 * numbers and nothing else.
 *
 * Deliberately NOT in here: dig, craft, pickup, hover and the rest. Those are
 * feedback for something the player just did with their own hands, and feedback
 * that might not answer is worse than feedback that overlaps.
 */
const CUE_PRIORITY: Partial<Record<SfxId, number>> = {
	areaUnlocked: 4, // a whole biome opening — the largest thing that happens
	animalReturn: 3, // a species home again
	upgrade: 2, // the player's own hands, but a milestone rather than a click
	sunriseBirds: 1, // atmosphere; it yields to anything with news
};
const CUE_FADE_OUT_MS = 180;
let activeCue: { priority: number; el: HTMLAudioElement } | null = null;
let cueFadeRaf: number | null = null;

/** Take a losing cue down over a beat instead of cutting it mid-word. */
function fadeOutCue(el: HTMLAudioElement) {
	if (cueFadeRaf !== null && typeof window !== 'undefined') {
		window.cancelAnimationFrame(cueFadeRaf);
		cueFadeRaf = null;
	}
	const stop = () => {
		el.pause();
		try {
			el.currentTime = 0;
		} catch {
			/* not seekable — it is stopping either way */
		}
	};
	if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
		stop();
		return;
	}
	const from = el.volume;
	const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
	const tick = (t: number) => {
		const progress = clamp01((t - start) / CUE_FADE_OUT_MS);
		el.volume = from * (1 - progress);
		if (progress < 1) {
			cueFadeRaf = window.requestAnimationFrame(tick);
			return;
		}
		stop();
		cueFadeRaf = null;
	};
	cueFadeRaf = window.requestAnimationFrame(tick);
}

/**
 * Can this cue speak? Yes if nothing is speaking or it outranks whoever is —
 * in which case the incumbent is faded out on the way past.
 *
 * A cue that has finished on its own leaves `paused`/`ended` set, so the channel
 * frees itself without an event listener or a timer to keep in step with it.
 */
function takeCueFloor(priority: number, el: HTMLAudioElement): boolean {
	const held = activeCue;
	const speaking = !!held && !held.el.paused && !held.el.ended;
	if (speaking && held) {
		if (priority <= held.priority) return false;
		if (held.el !== el) fadeOutCue(held.el);
	}
	activeCue = { priority, el };
	return true;
}

function playSfx(id: SfxId) {
	if (!state.enabled || !state.sfxEnabled || !unlockedByGesture) return;
	const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
	const cooldown = SFX_COOLDOWN_MS[id];
	if (cooldown) {
		const lastPlayed = lastSfxAt.get(id);
		if (lastPlayed !== undefined && startedAt - lastPlayed < cooldown) return;
	}
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
	// Ask for the floor before anything is heard, and spend the cooldown only on a
	// cue that actually plays: a chime dropped for an unlock must not also burn the
	// window that would have let the next batch of arrivals be heard.
	const priority = CUE_PRIORITY[id];
	if (priority !== undefined && !takeCueFloor(priority, el)) return;
	if (cooldown) lastSfxAt.set(id, startedAt);
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
	const duck = SFX_DUCK[id];
	if (duck) duckMusicFor(duck.hold, duck.target);
}

export function primeAudio() {
	unlockedByGesture = true;
	tryPlayMusic();
	syncAmbiencePlayback();
	syncFootstepPlayback();
	syncHummingPlayback();
	syncRainPlayback();
	syncFirePlayback();
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
	syncFirePlayback();
}

export function setMusicActive(active: boolean, track: MusicId = 'wildwillowstheme') {
	wantsMusic = active;
	currentMusicId = track;
	noteMusicRequest(track);
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

function setFireNearness(level: number) {
	const next = clamp01(level);
	if (next === fireNearness) return;
	const wasSilent = fireNearness <= 0;
	fireNearness = next;
	// Moving around a fire is the common case and only changes a volume. Going
	// through the full sync there would pause and restart the loop at every step.
	if (!wasSilent && next > 0) {
		if (fireLoopEl) fireLoopEl.volume = effectiveFireVolume();
		return;
	}
	syncFirePlayback();
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
		// The neutral toast tick has no asset yet (there is no sfx/toast file), so
		// non-error toasts are deliberately silent. Every other sfx id reaches
		// playSfx through the `id in AUDIO_ASSETS.sfx` guard below and no-ops on its
		// own when an asset is missing; this call site is hard-coded, so it has to
		// be removed by hand. Restore both together if a toast sound ever lands.
	});
	const offRain = bridge.on('audio-rain', (payload: any) => {
		setRainActive(!!payload?.active);
	});
	// The scene sends a 0..1 nearness rather than an on/off, so the crackle fades
	// up as you approach instead of appearing at a threshold.
	const offFire = bridge.on('audio-fire', (payload: any) => {
		setFireNearness(Number(payload?.level) || 0);
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
		offFire();
		if (typeof document !== 'undefined') document.removeEventListener('pointerover', onPointerOver);
	};
}
