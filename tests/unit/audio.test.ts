import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// ---------------------------------------------------------------------------
// audio.ts drives real <audio> elements through `new Audio()` (absent in jsdom)
// and the game event bridge, and uses requestAnimationFrame for fades. We stub
// all three so playback is observable and deterministic, and use the REAL
// data/audio.json so the ids, paths, and per-sfx gains under test are the ones
// that actually ship.
// ---------------------------------------------------------------------------

class FakeAudio {
	static instances: FakeAudio[] = [];
	src: string;
	volume = 1;
	loop = false;
	paused = true;
	currentTime = 0;
	duration = NaN; // jsdom never loads metadata; tests that need a length set one
	preload = '';
	play = vi.fn(() => {
		this.paused = false;
		return Promise.resolve();
	});
	pause = vi.fn(() => {
		this.paused = true;
	});
	addEventListener = vi.fn();
	constructor(src?: string) {
		this.src = src ?? '';
		FakeAudio.instances.push(this);
	}
}

// A tiny in-memory stand-in for the game event bridge.
vi.mock('../../src/game/bridge', () => {
	const handlers = new Map<string, Set<(p: any) => void>>();
	return {
		bridge: {
			on(evt: string, fn: (p: any) => void) {
				let set = handlers.get(evt);
				if (!set) {
					set = new Set();
					handlers.set(evt, set);
				}
				set.add(fn);
				return () => set!.delete(fn);
			},
			emit(evt: string, payload?: any) {
				handlers.get(evt)?.forEach((fn) => fn(payload));
			},
		},
	};
});

type AudioModule = typeof import('../../src/audio');
let audio: AudioModule;
let bridge: { on: (e: string, f: (p: any) => void) => () => void; emit: (e: string, p?: any) => void };
let cleanup: (() => void) | null = null;

// Fresh module state per test (audio.ts holds lots of module-level singletons).
beforeEach(async () => {
	vi.resetModules();
	FakeAudio.instances = [];
	delete (globalThis as any).wildWillowsDesktop;
	(globalThis as any).Audio = FakeAudio as any;
	(window as any).Audio = FakeAudio as any;
	window.requestAnimationFrame = ((_cb: FrameRequestCallback) => 0) as any;
	window.cancelAnimationFrame = (() => {}) as any;
	document.body.innerHTML = '';
	audio = await import('../../src/audio');
	bridge = (await import('../../src/game/bridge')).bridge as any;
});

afterEach(() => {
	cleanup?.();
	cleanup = null;
});

// --- helpers ---------------------------------------------------------------
const bind = () => {
	cleanup = audio.bindGameAudio();
};
/** Unlock playback (mimics the first user gesture) and drop the ambient loop
 *  elements primeAudio eagerly creates, so one-shot assertions start clean. */
const primeAndClear = () => {
	audio.primeAudio();
	FakeAudio.instances = [];
};
const bySrc = (frag: string) => FakeAudio.instances.filter((a) => a.src.includes(frag));
/** Fire one of an element's own listeners (audio.ts subscribes to 'timeupdate'
 *  to keep the meadow's AABA form moving; jsdom's Audio never ticks). */
const fire = (el: FakeAudio, evt: string) => {
	for (const [name, fn] of el.addEventListener.mock.calls as [string, () => void][]) {
		if (name === evt) fn();
	}
};
/** Play a section up to the seam audio.ts watches for: a moment mid-piece (which
 *  re-arms the seam), then the last beat before the section runs out. */
const playToSeam = (el: FakeAudio) => {
	el.currentTime = 10;
	fire(el, 'timeupdate');
	el.currentTime = el.duration - 0.5;
	fire(el, 'timeupdate');
};
/* The shipping manifest, read once. vitest runs from the repo root, same as the
 * other source-reading suites (see tests/serverSource.ts); import.meta.url is
 * not a file: URL under the jsdom environment this project runs in, so it
 * cannot be used here. */
const MANIFEST = JSON.parse(readFileSync(join(resolve(process.cwd()), 'data/audio.json'), 'utf8'));
/* The element for one manifest id, found by the file the manifest names.
 *
 * Worth the indirection for a sound whose FILE is expected to change: the
 * crackle was pinned to 'FireCrackling.mp3' as a literal, so swapping the asset
 * in data/audio.json turned a working fade into two failing tests that had
 * nothing to say about the fade. What is under test is the behaviour attached
 * to the id, not the name of the file behind it. */
const sfxEl = (id: string) => bySrc(String(MANIFEST.sfx[id]).split('/').pop() as string)[0];
const hoverButton = () => {
	const btn = document.createElement('button');
	document.body.appendChild(btn);
	return btn;
};
const pointerOver = (el: Element) => el.dispatchEvent(new Event('pointerover', { bubbles: true }));

// ---------------------------------------------------------------------------

describe('audio — playback gating', () => {
	it('does not play sfx until unlocked by a gesture (primeAudio)', () => {
		bind();
		bridge.emit('audio-sfx', { id: 'dig' });
		expect(bySrc('dig.ogg')).toHaveLength(0); // still locked

		audio.primeAudio();
		FakeAudio.instances = [];
		bridge.emit('audio-sfx', { id: 'dig' });
		expect(bySrc('dig.ogg')).toHaveLength(1);
	});

	it('ignores unknown sfx ids', () => {
		bind();
		primeAndClear();
		bridge.emit('audio-sfx', { id: 'totally-not-a-sound' });
		expect(FakeAudio.instances).toHaveLength(0);
	});

	it('does not play sfx when sfx are disabled', () => {
		bind();
		audio.applyAudioPrefs({ sfxEnabled: false });
		primeAndClear();
		bridge.emit('audio-sfx', { id: 'dig' });
		expect(bySrc('dig.ogg')).toHaveLength(0);
	});
});

describe('audio — one-shot sfx', () => {
	it('creates a non-looping one-shot at the mapped path and plays it', () => {
		bind();
		primeAndClear();
		bridge.emit('audio-sfx', { id: 'dig' });
		const [el] = bySrc('dig.ogg');
		expect(el).toBeDefined();
		expect(el.loop).toBe(false);
		expect(el.play).toHaveBeenCalledTimes(1);
	});

	it('applies master*sfx volume and the per-sfx gain', () => {
		bind();
		primeAndClear();
		// defaults: master 0.8, sfx 0.75 -> effective 0.6; dig gain 0.595.
		bridge.emit('audio-sfx', { id: 'dig' });
		expect(bySrc('dig.ogg')[0].volume).toBeCloseTo(0.6 * 0.595, 5);
	});

	it('alternates the pickup sfx between its two files', () => {
		bind();
		primeAndClear();
		bridge.emit('audio-sfx', { id: 'pickup' });
		bridge.emit('audio-sfx', { id: 'pickup' });
		expect(FakeAudio.instances[0].src).toContain('pickup1.ogg');
		expect(FakeAudio.instances[1].src).toContain('pickup2.ogg');
	});

	it('plays one of the hover variants for a multi-file random sfx', () => {
		bind();
		primeAndClear();
		bridge.emit('audio-sfx', { id: 'hover' });
		expect(FakeAudio.instances).toHaveLength(1);
		expect(FakeAudio.instances[0].src).toMatch(/hover[123]\.ogg/);
	});

	it('reuses one cached element per sound across replays (no per-play leak)', () => {
		bind();
		primeAndClear();
		bridge.emit('audio-sfx', { id: 'dig' });
		bridge.emit('audio-sfx', { id: 'dig' });
		bridge.emit('audio-sfx', { id: 'dig' });
		const els = bySrc('dig.ogg');
		expect(els).toHaveLength(1); // not 3 fresh elements
		expect(els[0].play).toHaveBeenCalledTimes(3);
	});
});

describe('audio — toast kind routing', () => {
	beforeEach(() => {
		bind();
		primeAndClear();
	});

	it('plays "cant" for error toasts (blocked actions)', () => {
		bridge.emit('audio-toast', { kind: 'error' });
		expect(bySrc('cant.ogg')).toHaveLength(1);
	});

	it('plays the reward chime for an achievement toast, trimmed to sit under the music', () => {
		bridge.emit('audio-toast', { kind: 'achievement' });
		const [el] = bySrc('Reward1.mp3');
		expect(el).toBeDefined();
		expect(el.loop).toBe(false);
		expect(el.play).toHaveBeenCalledTimes(1);
		// master 0.8 * sfx 0.75 * the manifest's own gain. Read rather than written
		// down, for the same reason the fire's is: sfxGain exists to be tuned.
		expect(el.volume).toBeCloseTo(0.6 * (MANIFEST.sfxGain.achievement as number), 5);
		// and it is the reward, not the refusal
		expect(bySrc('cant.ogg')).toHaveLength(0);
	});

	it('does not duck the music to make room for itself', () => {
		// A badge lands often; the score should not breathe in and out around them.
		audio.setMusicActive(true, 'meadowambient');
		const [music] = bySrc('willowmeadow/meadowambient.mp3');
		const before = music.volume;
		bridge.emit('audio-toast', { kind: 'achievement' });
		expect(music.volume).toBe(before);
	});

	it('stays silent for the remaining kinds — the neutral toast has no asset', () => {
		bridge.emit('audio-toast', { kind: 'info' });
		bridge.emit('audio-toast', { kind: 'animal' });
		bridge.emit('audio-toast', { kind: 'unlock' });
		bridge.emit('audio-toast', {}); // no kind
		// There is no sfx/toast file, so the neutral tick was removed rather than
		// left pointing at a 404 on every toast. Restore both the asset and the
		// playSfx('toast') call site in src/audio.ts together if one ever lands.
		expect(bySrc('toast.mp3')).toHaveLength(0);
		// The assertion that actually matters: silence must NOT be "fixed" by
		// routing these through the error sound. Every info toast would then read
		// as something going wrong, which is worse than no sound at all.
		expect(bySrc('cant.ogg')).toHaveLength(0);
		expect(bySrc('Reward1.mp3')).toHaveLength(0);
	});
});

describe('audio — global menuhover delegation', () => {
	beforeEach(() => {
		bind();
		primeAndClear();
	});

	it('plays menuhover when the pointer enters any button', () => {
		pointerOver(hoverButton());
		expect(bySrc('menuhover.ogg')).toHaveLength(1);
	});

	it('does not play for non-button elements', () => {
		const div = document.createElement('div');
		document.body.appendChild(div);
		pointerOver(div);
		expect(bySrc('menuhover.ogg')).toHaveLength(0);
	});

	it('does not re-fire while hovering within the same button', () => {
		const btn = hoverButton();
		pointerOver(btn);
		pointerOver(btn); // e.g. moving onto the button's inner icon
		expect(bySrc('menuhover.ogg')).toHaveLength(1);
	});

	it('skips disabled buttons', () => {
		const btn = hoverButton();
		btn.disabled = true;
		pointerOver(btn);
		expect(bySrc('menuhover.ogg')).toHaveLength(0);
	});
});

describe('audio — bindGameAudio cleanup', () => {
	it('stops responding to events and hover after cleanup', () => {
		const off = audio.bindGameAudio();
		audio.primeAudio();
		FakeAudio.instances = [];
		off();

		bridge.emit('audio-sfx', { id: 'dig' });
		pointerOver(hoverButton());
		expect(FakeAudio.instances).toHaveLength(0);
	});
});

/* WHICH PIECE BELONGS TO A PLACE.
 *
 * The bug this suite is here to keep fixed: a trail tent's area id is
 * 'tent-<biome>', it matched none of the biome branches this choice used to be
 * written as, and so every tent in the preserve played the meadow. */
describe('audio — choosing the gameplay track', () => {
	const restored = () => 100;
	const BIOMES = ['meadow', 'forest', 'wetland', 'desert', 'alpine', 'coastal'];

	it('plays the house piece indoors — in the house and in every trail tent', () => {
		expect(audio.gameplayMusicFor('home', restored)).toBe('home');
		for (const biome of BIOMES) {
			expect(audio.gameplayMusicFor(`tent-${biome}`, restored)).toBe('home');
		}
	});

	it('gives each biome its own piece', () => {
		expect(audio.gameplayMusicFor('meadow', restored)).toBe('meadowambient_level3');
		expect(audio.gameplayMusicFor('forest', restored)).toBe('hollowforest_level3');
		expect(audio.gameplayMusicFor('wetland', restored)).toBe('wetlands_level3');
		expect(audio.gameplayMusicFor('desert', restored)).toBe('scrubland_level3');
		expect(audio.gameplayMusicFor('alpine', restored)).toBe('graywind_level3');
		expect(audio.gameplayMusicFor('coastal', restored)).toBe('pelicanbay_level3');
	});

	it('picks the mix off the biome that is playing, at 50 and 80', () => {
		expect(audio.gameplayMusicFor('alpine', () => 49)).toBe('graywind_level1');
		expect(audio.gameplayMusicFor('alpine', () => 50)).toBe('graywind_level2');
		expect(audio.gameplayMusicFor('alpine', () => 79)).toBe('graywind_level2');
		expect(audio.gameplayMusicFor('alpine', () => 80)).toBe('graywind_level3');
		// and it reads the health of the biome underfoot, not some other one
		const onlyForestIsSick = (id: string) => (id === 'forest' ? 10 : 100);
		expect(audio.gameplayMusicFor('forest', onlyForestIsSick)).toBe('hollowforest_level1');
		expect(audio.gameplayMusicFor('coastal', onlyForestIsSick)).toBe('pelicanbay_level3');
	});

	it('falls back to the meadow for an area with no piece of its own', () => {
		expect(audio.gameplayMusicFor('somewhere-new', restored)).toBe('meadowambient');
		expect(audio.gameplayMusicFor(undefined, restored)).toBe('meadowambient');
	});

	it('knows a room from the open air', () => {
		expect(audio.isIndoorArea('home')).toBe(true);
		expect(audio.isIndoorArea('tent-alpine')).toBe(true);
		expect(audio.isIndoorArea('alpine')).toBe(false);
		expect(audio.isIndoorArea(undefined)).toBe(false);
	});
});

/* A PIECE MAY ONLY BE HEARD WHERE IT BELONGS.
 *
 * Choosing the right track for a place (above) is not the same as making sure a
 * wrong one cannot sound. A request is made against the area the game believed
 * it was in when the request was made, and a request can outlive that belief —
 * a world snapshot fetched before a door and adopted after it, a timer armed in
 * one room and fired in another. Both used to put the house's music out in the
 * grass, and the next refresh put the meadow's back: the flip.
 *
 * So every request carries the kind of place it was made for, and the gate is
 * the thing that says no. Note what "no" means here: the request is DROPPED, not
 * redirected. A stale request must not be able to change the music at all.
 */
describe('audio — what may sound where', () => {
	const playing = () => FakeAudio.instances.filter((a) => !a.paused && a.loop).map((a) => a.src);
	const isPlaying = (frag: string) => playing().some((src) => src.includes(frag));

	beforeEach(() => {
		/* Resolve every crossfade in one synchronous tick (same trick as the
		 * track-position tests above), so `playing()` is what is actually sounding
		 * rather than what is still on its way out. */
		window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
			cb((typeof performance !== 'undefined' ? performance.now() : Date.now()) + 10_000);
			return 0;
		}) as any;
		// The gate says so on the console; the suite does not need to hear it.
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		primeAndClear();
	});

	it('reads the kind of place an area is', () => {
		expect(audio.musicPlaceForArea('meadow')).toBe('outdoors');
		expect(audio.musicPlaceForArea('coastal')).toBe('outdoors');
		expect(audio.musicPlaceForArea('home')).toBe('indoors');
		expect(audio.musicPlaceForArea('tent-wetland')).toBe('indoors');
		expect(audio.musicPlaceForArea(null)).toBe('menu');
		expect(audio.musicPlaceForArea(undefined)).toBe('menu');
	});

	it('refuses the house piece out in the grass, and leaves the meadow playing', () => {
		audio.setMusicActive(true, 'meadowambient', 'outdoors');
		expect(isPlaying('willowmeadow/meadowambient.mp3')).toBe(true);

		// A stale request: the house's piece, asked for while standing outdoors.
		audio.setMusicActive(true, 'home', 'outdoors');
		expect(isPlaying('HomeMusic.mp3')).toBe(false);
		expect(isPlaying('willowmeadow/meadowambient.mp3')).toBe(true);
	});

	it('refuses a biome piece indoors, and leaves the house playing', () => {
		audio.setMusicActive(true, 'home', 'indoors');
		expect(isPlaying('HomeMusic.mp3')).toBe(true);

		audio.setMusicActive(true, 'meadowambient', 'indoors');
		expect(isPlaying('willowmeadow/meadowambient.mp3')).toBe(false);
		expect(isPlaying('HomeMusic.mp3')).toBe(true);

		// and not by luck of it being the meadow — no biome piece gets in
		audio.setMusicActive(true, 'wetlands_level1', 'indoors');
		expect(isPlaying('wetlands/Wetlands_level1.mp3')).toBe(false);
		expect(isPlaying('HomeMusic.mp3')).toBe(true);
	});

	it('keeps the menu theme off the preserve and the preserve off the menu', () => {
		audio.setMusicActive(true, 'wildwillowstheme', 'menu');
		expect(isPlaying('WildWillows_ThemeIdea.mp3')).toBe(true);

		audio.setMusicActive(true, 'meadowambient', 'menu');
		expect(isPlaying('willowmeadow/meadowambient.mp3')).toBe(false);
		expect(isPlaying('WildWillows_ThemeIdea.mp3')).toBe(true);

		audio.setMusicActive(true, 'meadowambient', 'outdoors');
		audio.setMusicActive(true, 'wildwillowstheme', 'outdoors');
		expect(isPlaying('WildWillows_ThemeIdea.mp3')).toBe(false);
	});

	/* The refusal above holds the line by keeping what is already right. With
	 * nothing right to keep — the very first request of a session is the wrong one
	 * — silence would be worse than the wrong grass, so the place's own piece
	 * answers instead. Still never the piece that was asked for. */
	it('falls back to the place own piece when there is nothing right to keep', () => {
		audio.setMusicActive(true, 'home', 'outdoors');
		expect(isPlaying('HomeMusic.mp3')).toBe(false);
		expect(isPlaying('willowmeadow/meadowambient.mp3')).toBe(true);
	});

	it('takes a piece at its word when no place is claimed', () => {
		// The rest of this suite drives tracks directly; that has to keep working.
		audio.setMusicActive(true, 'home');
		expect(isPlaying('HomeMusic.mp3')).toBe(true);
	});

	it('carries no ambience indoors or on the menu, however it is asked', () => {
		audio.setAmbienceActive(true, 'meadow', 'outdoors');
		expect(isPlaying('sfx/meadow.mp3')).toBe(true);

		audio.setAmbienceActive(true, 'meadow', 'indoors');
		expect(isPlaying('sfx/meadow.mp3')).toBe(false);

		audio.setAmbienceActive(true, 'night', 'menu');
		expect(isPlaying('sfx/night.mp3')).toBe(false);

		audio.setAmbienceActive(true, 'night', 'outdoors');
		expect(isPlaying('sfx/night.mp3')).toBe(true);
	});
});

describe('audio — music & ambience activation', () => {
	it('starts a looping music track and applies track volume', () => {
		audio.primeAudio();
		FakeAudio.instances = [];
		audio.setMusicActive(true, 'meadowambient');
		const [m] = bySrc('willowmeadow/meadowambient.mp3');
		expect(m).toBeDefined();
		expect(m.loop).toBe(true);
		expect(m.play).toHaveBeenCalled();
		// master 0.8 * music 0.6 * gain(1) * duck(1)
		expect(m.volume).toBeCloseTo(0.48, 5);
	});

	it('does not start music when music is disabled', () => {
		audio.applyAudioPrefs({ musicEnabled: false });
		audio.primeAudio();
		FakeAudio.instances = [];
		audio.setMusicActive(true, 'meadowambient');
		expect(bySrc('willowmeadow/meadowambient.mp3')).toHaveLength(0);
	});

	it('pauses music when set inactive', () => {
		audio.primeAudio();
		FakeAudio.instances = [];
		audio.setMusicActive(true, 'meadowambient');
		const [m] = bySrc('willowmeadow/meadowambient.mp3');
		audio.setMusicActive(false, 'meadowambient');
		expect(m.pause).toHaveBeenCalled();
	});

	/* LEAVING A PLACE SHOULD NOT REWIND ITS MUSIC.
	 *
	 * Crossing a border used to pause the old track AND send it back to zero, so a
	 * lap of the preserve was the opening phrase of six pieces over and over. The
	 * fix is the absence of those rewinds, which is exactly the kind of thing that
	 * gets helpfully "tidied" back in later — hence a test.
	 *
	 * The crossfade runs on requestAnimationFrame, which the suite stubs into a
	 * no-op; this one hands it a timestamp past the end of the fade so the whole
	 * transition resolves in a single synchronous tick. */
	it('leaves a track where it stood, and picks it up there on the way back', () => {
		window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
			cb((typeof performance !== 'undefined' ? performance.now() : Date.now()) + 10_000);
			return 0;
		}) as any;
		audio.primeAudio();
		FakeAudio.instances = [];

		audio.setMusicActive(true, 'meadowambient');
		const [meadow] = bySrc('willowmeadow/meadowambient.mp3');
		meadow.currentTime = 42; // three quarters of a minute into the piece

		audio.setMusicActive(true, 'wetlands_level1'); // walk into the wetland
		expect(meadow.paused).toBe(true);
		expect(meadow.currentTime).toBe(42);

		audio.setMusicActive(true, 'meadowambient'); // and back again
		expect(meadow.paused).toBe(false);
		expect(meadow.currentTime).toBe(42);
	});

	it('keeps its place when music is switched off and on', () => {
		audio.primeAudio();
		FakeAudio.instances = [];
		audio.setMusicActive(true, 'meadowambient');
		const [meadow] = bySrc('willowmeadow/meadowambient.mp3');
		meadow.currentTime = 17;

		audio.applyAudioPrefs({ musicEnabled: false });
		expect(meadow.paused).toBe(true);
		expect(meadow.currentTime).toBe(17);

		audio.applyAudioPrefs({ musicEnabled: true });
		expect(meadow.currentTime).toBe(17);
	});

	/* THE MEADOW IS A SONG, NOT A LOOP.
	 *
	 * Two passes of the health-level mix (A), one pass of the alt track (B), then
	 * A again — and around. The game never asks for the bridge: it keeps asking for
	 * the meadow, and the form decides what is actually sounding.
	 *
	 * Same trick as the crossfade test above: rAF is handed a timestamp past the
	 * end of the fade so each handoff resolves in one synchronous tick. */
	describe('the meadow plays in AABA', () => {
		const runFades = () => {
			window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
				cb((typeof performance !== 'undefined' ? performance.now() : Date.now()) + 10_000);
				return 0;
			}) as any;
		};

		it('holds A for two passes, hands the third to the bridge, then takes it back', () => {
			runFades();
			audio.primeAudio();
			FakeAudio.instances = [];

			audio.setMusicActive(true, 'meadowambient');
			const [meadow] = bySrc('willowmeadow/meadowambient.mp3');
			meadow.duration = 138;

			// First A. The seam here only starts the repeat — no bridge yet.
			playToSeam(meadow);
			expect(bySrc('meadowambient_alt.mp3')).toHaveLength(0);
			expect(meadow.paused).toBe(false);

			// Second A. This seam is the one that hands over.
			playToSeam(meadow);
			const [alt] = bySrc('meadowambient_alt.mp3');
			expect(alt).toBeDefined();
			expect(alt.loop).toBe(true);
			expect(alt.currentTime).toBe(0); // a section takes its turn from the top
			expect(alt.play).toHaveBeenCalled();
			expect(meadow.paused).toBe(true);
			// data/audio.json trims the alt to sit with the A mixes: 0.8 * 0.6 * 0.29
			expect(alt.volume).toBeCloseTo(0.1392, 4);

			// One pass of the bridge, and the meadow comes back at its own top.
			alt.duration = 99;
			meadow.currentTime = 60;
			playToSeam(alt);
			expect(meadow.paused).toBe(false);
			expect(meadow.currentTime).toBe(0);
			expect(alt.paused).toBe(true);
		});

		it('does not let a state change drag the bridge off the air', () => {
			runFades();
			audio.primeAudio();
			FakeAudio.instances = [];

			audio.setMusicActive(true, 'meadowambient');
			const [meadow] = bySrc('willowmeadow/meadowambient.mp3');
			meadow.duration = 138;
			playToSeam(meadow);
			playToSeam(meadow);
			const [alt] = bySrc('meadowambient_alt.mp3');
			expect(alt.paused).toBe(false);

			// The game re-asserts the meadow on every state change and on a 15s timer.
			audio.setMusicActive(true, 'meadowambient');
			expect(alt.paused).toBe(false);
			expect(meadow.paused).toBe(true);
		});

		it('carries the form through a health-level change', () => {
			runFades();
			audio.primeAudio();
			FakeAudio.instances = [];

			audio.setMusicActive(true, 'meadowambient');
			const [meadow] = bySrc('willowmeadow/meadowambient.mp3');
			meadow.duration = 138;
			playToSeam(meadow); // first A done

			// The meadow gets healthier: same A section, fuller mix, same song.
			audio.setMusicActive(true, 'meadowambient_level3');
			const [level3] = bySrc('meadowambient_level3.mp3');
			level3.duration = 138;
			playToSeam(level3); // second A done -> bridge
			expect(bySrc('meadowambient_alt.mp3')).toHaveLength(1);
		});

		it('starts the form over after a spell away from the meadow', () => {
			runFades();
			audio.primeAudio();
			FakeAudio.instances = [];

			audio.setMusicActive(true, 'meadowambient');
			const [meadow] = bySrc('willowmeadow/meadowambient.mp3');
			meadow.duration = 138;
			playToSeam(meadow); // one A in

			audio.setMusicActive(true, 'wetlands_level1'); // out to the wetland and back
			audio.setMusicActive(true, 'meadowambient');

			// Back at the top of the form: one seam is a repeat, not the bridge.
			playToSeam(meadow);
			expect(bySrc('meadowambient_alt.mp3')).toHaveLength(0);
			playToSeam(meadow);
			expect(bySrc('meadowambient_alt.mp3')).toHaveLength(1);
		});

		it('leaves tracks with no form looping as they always did', () => {
			runFades();
			audio.primeAudio();
			FakeAudio.instances = [];

			audio.setMusicActive(true, 'wetlands_level1');
			const [wetland] = bySrc('Wetlands_level1.mp3');
			wetland.duration = 120;
			playToSeam(wetland);
			playToSeam(wetland);
			expect(wetland.paused).toBe(false);
			expect(FakeAudio.instances.filter((a) => a.src.includes('willowmeadow'))).toHaveLength(0);
		});
	});

	it('starts looping ambience softened below music level', () => {
		audio.primeAudio();
		FakeAudio.instances = [];
		audio.setAmbienceActive(true, 'night');
		const [a] = bySrc('night.mp3');
		expect(a).toBeDefined();
		expect(a.loop).toBe(true);
		expect(a.play).toHaveBeenCalled();
		// master 0.8 * music 0.6 * 0.45 ambience factor
		expect(a.volume).toBeCloseTo(0.216, 5);
	});
});

describe('audio — environmental loops via events', () => {
	beforeEach(() => {
		bind();
		audio.primeAudio();
	});

	it('toggles the footstep loop on audio-walk', () => {
		bridge.emit('audio-walk', { active: true });
		const [fs] = bySrc('dirtfootsteps.ogg');
		expect(fs).toBeDefined();
		expect(fs.loop).toBe(true);
		expect(fs.play).toHaveBeenCalled();

		bridge.emit('audio-walk', { active: false });
		expect(fs.pause).toHaveBeenCalled();
	});

	it('starts the humming loop on audio-idle', () => {
		bridge.emit('audio-idle', { active: true });
		expect(bySrc('humming.ogg')[0].play).toHaveBeenCalled();
	});

	it('starts rain and storm layers on audio-rain', () => {
		bridge.emit('audio-rain', { active: true });
		expect(bySrc('rain.mp3')[0].play).toHaveBeenCalled();
		expect(bySrc('storm.mp3')[0].play).toHaveBeenCalled();
	});
});

describe('audio — applyAudioPrefs', () => {
	it('clamps volumes into range and honors sfx gain', () => {
		bind();
		audio.applyAudioPrefs({ masterVolume: 5, sfxVolume: 0.5, musicVolume: 2 });
		audio.primeAudio();
		FakeAudio.instances = [];
		bridge.emit('audio-sfx', { id: 'menuhover' }); // gain 1
		// master clamped 1 * sfx 0.5 = 0.5
		expect(bySrc('menuhover.ogg')[0].volume).toBeCloseTo(0.5, 5);
	});

	it('leaves unspecified fields unchanged', () => {
		bind();
		audio.applyAudioPrefs({ sfxVolume: 0.4 }); // master stays default 0.8
		audio.primeAudio();
		FakeAudio.instances = [];
		bridge.emit('audio-sfx', { id: 'menuhover' });
		expect(bySrc('menuhover.ogg')[0].volume).toBeCloseTo(0.8 * 0.4, 5);
	});
});

describe('audio — cues that make room for themselves', () => {
	/* A heartbeat coming back from a long absence can announce half a dozen
	 * arrivals in one pass, and a second batch can follow moments later when the
	 * recalc lands. state.tsx already collapses each batch to one emit; this is
	 * the backstop for the batches themselves. */
	it('plays one animal-return cue for a burst of arrivals', () => {
		bind();
		primeAndClear();
		for (let i = 0; i < 5; i++) bridge.emit('audio-sfx', { id: 'animalReturn' });
		const [el] = bySrc('AnimalReturn1.mp3');
		expect(el).toBeDefined();
		expect(el.play).toHaveBeenCalledTimes(1);
	});

	it('holds back only the cue that stacks, not everything around it', () => {
		bind();
		primeAndClear();
		bridge.emit('audio-sfx', { id: 'animalReturn' });
		bridge.emit('audio-sfx', { id: 'animalReturn' });
		bridge.emit('audio-sfx', { id: 'dig' });
		expect(bySrc('dig.ogg')[0].play).toHaveBeenCalledTimes(1);
	});

	it('softens the unlock fanfare, which is mastered far hotter than the rest', () => {
		bind();
		primeAndClear();
		bridge.emit('audio-sfx', { id: 'areaUnlocked' });
		// master 0.8 * sfx 0.75 * gain 0.32
		expect(bySrc('BiomeUnlocked.mp3')[0].volume).toBeCloseTo(0.6 * 0.32, 5);
	});
});

describe('audio — one ceremony at a time', () => {
	/* The suite stubs requestAnimationFrame into a no-op, so a losing cue's fade
	 * never advances on its own. These hand it a timestamp past the end of the
	 * fade, which resolves the whole thing in one synchronous tick — the point
	 * being that the loser actually stops, not how it got there. */
	const runFades = () => {
		window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
			cb((typeof performance !== 'undefined' ? performance.now() : Date.now()) + 10_000);
			return 0;
		}) as any;
	};

	it('hands the floor to the biome unlock when an animal is already announcing', () => {
		bind();
		primeAndClear();
		runFades();
		bridge.emit('audio-sfx', { id: 'animalReturn' });
		const [arrival] = bySrc('AnimalReturn1.mp3');
		expect(arrival.play).toHaveBeenCalledTimes(1);
		expect(arrival.paused).toBe(false);

		bridge.emit('audio-sfx', { id: 'areaUnlocked' });
		expect(bySrc('BiomeUnlocked.mp3')[0].play).toHaveBeenCalledTimes(1);
		expect(arrival.paused).toBe(true); // faded out of the way, not left underneath
		expect(arrival.volume).toBe(0);
	});

	it('drops an arrival that lands while the unlock is still speaking', () => {
		bind();
		primeAndClear();
		bridge.emit('audio-sfx', { id: 'areaUnlocked' });
		bridge.emit('audio-sfx', { id: 'animalReturn' });
		const [arrival] = bySrc('AnimalReturn1.mp3');
		expect(arrival?.play ?? (() => {})).not.toHaveBeenCalled();
	});

	it('does not spend the arrival cooldown on a chime nobody heard', () => {
		bind();
		primeAndClear();
		bridge.emit('audio-sfx', { id: 'areaUnlocked' });
		bridge.emit('audio-sfx', { id: 'animalReturn' }); // dropped — outranked
		bySrc('BiomeUnlocked.mp3')[0].pause(); // the fanfare finishes
		bridge.emit('audio-sfx', { id: 'animalReturn' });
		expect(bySrc('AnimalReturn1.mp3')[0].play).toHaveBeenCalledTimes(1);
	});

	it('lets the biome unlock talk over an achievement chime, not the other way round', () => {
		bind();
		primeAndClear();
		runFades();
		bridge.emit('audio-toast', { kind: 'achievement' });
		const [reward] = bySrc('Reward1.mp3');
		expect(reward.play).toHaveBeenCalledTimes(1);

		bridge.emit('audio-sfx', { id: 'areaUnlocked' });
		expect(bySrc('BiomeUnlocked.mp3')[0].play).toHaveBeenCalledTimes(1);
		expect(reward.paused).toBe(true);

		// and an achievement landing mid-fanfare is dropped rather than queued
		bridge.emit('audio-toast', { kind: 'achievement' });
		expect(reward.play).toHaveBeenCalledTimes(1);
	});

	it("still answers the player's own hands mid-ceremony", () => {
		bind();
		primeAndClear();
		bridge.emit('audio-sfx', { id: 'areaUnlocked' });
		bridge.emit('audio-sfx', { id: 'dig' });
		expect(bySrc('dig.ogg')[0].play).toHaveBeenCalledTimes(1);
	});

	/* runFades above resolves each fade the instant it starts, which is exactly
	 * what hides the interesting case: cues can arrive FASTER than a fade takes.
	 * This pump queues the frames instead, so a losing cue can be preempted while
	 * its own fade is still in flight. */
	const framePump = () => {
		const queued = new Map<number, FrameRequestCallback>();
		let nextId = 1;
		window.requestAnimationFrame = (cb: FrameRequestCallback) => {
			queued.set(nextId, cb);
			return nextId++;
		};
		window.cancelAnimationFrame = (id: number) => {
			queued.delete(id);
		};
		/** Run every frame that is waiting, well past the end of any fade. */
		return () => {
			const due = [...queued.values()];
			queued.clear();
			const t = (typeof performance !== 'undefined' ? performance.now() : Date.now()) + 10_000;
			for (const cb of due) cb(t);
		};
	};

	it('leaves nothing playing underneath when ceremonies arrive faster than a fade', () => {
		// Dawn, then an upgrade, then a badge — all inside the 180ms fade. Each one
		// outranks the last, so the floor changes hands twice while the first cue is
		// still fading. The fade state is per element for exactly this: one shared
		// handle meant the badge cancelled the dawn chorus's fade on its way to
		// fading the upgrade, and the dawn chorus — no longer the active cue, so
		// nobody's business to stop — went on playing under the winner.
		bind();
		primeAndClear();
		const runFrames = framePump();

		bridge.emit('audio-sfx', { id: 'sunriseBirds' });
		const [dawn] = bySrc('SunriseBirds.mp3');
		expect(dawn.paused).toBe(false);

		bridge.emit('audio-sfx', { id: 'upgrade' });
		bridge.emit('audio-sfx', { id: 'achievement' });
		runFrames();

		expect(bySrc('Reward1.mp3')[0].paused).toBe(false); // the winner is speaking
		expect(bySrc('Upgrade1.mp3')[0].paused).toBe(true); // it took the floor cleanly
		expect(dawn.paused, 'the dawn chorus was left playing underneath').toBe(true);
		expect(dawn.volume).toBe(0);
	});

	it('calls off a pending fade when the same cue is asked for again', () => {
		// The dawn chorus loses the floor and is asked for again a moment later.
		// Its fade must not go on running against the copy now starting.
		bind();
		primeAndClear();
		const runFrames = framePump();

		bridge.emit('audio-sfx', { id: 'sunriseBirds' });
		bridge.emit('audio-sfx', { id: 'areaUnlocked' }); // outranks it; dawn starts fading
		bySrc('BiomeUnlocked.mp3')[0].pause(); // ...and the fanfare finishes
		bridge.emit('audio-sfx', { id: 'sunriseBirds' }); // dawn is asked for again
		runFrames();

		const [dawn] = bySrc('SunriseBirds.mp3');
		expect(dawn.paused).toBe(false);
		expect(dawn.volume).toBeGreaterThan(0);
	});
});

describe('audio — the campfire crackle', () => {
	/* The scene sends a NEARNESS rather than an on/off, so the fire arrives with
	 * the caretaker instead of appearing at a threshold. These pin the two things
	 * that makes possible: the number reaching the element's volume, and the loop
	 * starting and stopping once, at the edges of earshot. */
	it('rides the nearness the scene sends, and starts only once', () => {
		bind();
		audio.primeAudio();
		const fire = sfxEl('fireCrackling');
		expect(fire, 'the crackle loop should exist once audio is unlocked').toBeDefined();
		expect(fire.loop).toBe(true);
		expect(fire.play).not.toHaveBeenCalled(); // nothing burning nearby yet

		bridge.emit('audio-fire', { level: 0.5 });
		// master 0.8 * sfx 0.75 * the manifest's own gain * nearness 0.5. The gain
		// is read rather than written down for the same reason the filename is:
		// sfxGain exists to be tuned, and a number copied into this file turns a
		// mix adjustment into a failing test about the fade.
		const gain = MANIFEST.sfxGain.fireCrackling as number;
		expect(fire.volume).toBeCloseTo(0.6 * gain * 0.5, 5);
		expect(fire.play).toHaveBeenCalledTimes(1);

		bridge.emit('audio-fire', { level: 1 });
		expect(fire.volume).toBeCloseTo(0.6 * gain, 5);
		expect(fire.play).toHaveBeenCalledTimes(1); // stepping closer is a volume change
	});

	it('goes quiet when the caretaker walks away', () => {
		bind();
		audio.primeAudio();
		const fire = sfxEl('fireCrackling');
		bridge.emit('audio-fire', { level: 1 });
		expect(fire.paused).toBe(false);
		bridge.emit('audio-fire', { level: 0 });
		expect(fire.paused).toBe(true);
		expect(fire.currentTime).toBe(0);
	});
});

describe('the audio manifest', () => {
	const root = resolve(process.cwd());
	const manifest = MANIFEST;

	/* Nothing else catches a path that points at nothing. The ids are typed off
	 * this file so the call sites stay honest, but the VALUES are plain strings
	 * that no type sees: playSfx no-ops on a missing asset, the console warning is
	 * one line, and the symptom is a sound that simply never plays. */
	it('names a file that exists, for every id', () => {
		const missing: string[] = [];
		for (const section of ['music', 'ambience', 'sfx'] as const) {
			for (const [id, value] of Object.entries(manifest[section] as Record<string, string | string[]>)) {
				for (const path of Array.isArray(value) ? value : [value]) {
					if (!existsSync(join(root, 'public', path))) missing.push(`${section}.${id} -> ${path}`);
				}
			}
		}
		expect(missing, 'data/audio.json points at files that are not in public/').toEqual([]);
	});

	it('tunes only ids that exist', () => {
		expect(Object.keys(manifest.sfxGain).filter((k) => !(k in manifest.sfx))).toEqual([]);
		expect(Object.keys(manifest.musicGain).filter((k) => !(k in manifest.music))).toEqual([]);
	});
});
