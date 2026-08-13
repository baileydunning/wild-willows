import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

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

	it('stays silent for non-error kinds — the neutral toast has no asset', () => {
		bridge.emit('audio-toast', { kind: 'info' });
		bridge.emit('audio-toast', { kind: 'animal' });
		bridge.emit('audio-toast', { kind: 'achievement' });
		bridge.emit('audio-toast', {}); // no kind
		// There is no sfx/toast file, so the neutral tick was removed rather than
		// left pointing at a 404 on every toast. Restore both the asset and the
		// playSfx('toast') call site in src/audio.ts together if one ever lands.
		expect(bySrc('toast.mp3')).toHaveLength(0);
		// The assertion that actually matters: silence must NOT be "fixed" by
		// routing these through the error sound. Every info toast would then read
		// as something going wrong, which is worse than no sound at all.
		expect(bySrc('cant.ogg')).toHaveLength(0);
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
