import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { WorldScene } from './WorldScene';
import { getPrefs, renderScale, subscribe as subscribePrefs } from '../prefs';

export function PhaserGame() {
	const host = useRef<HTMLDivElement>(null);
	const game = useRef<Phaser.Game | null>(null);

	useEffect(() => {
		if (!host.current || game.current) return;
		const el = host.current;
		// Render at native device pixels (capped at 2× for perf) and let CSS scale
		// the canvas back down — otherwise HiDPI/Retina screens stretch a CSS-pixel
		// canvas 2× and everything looks blurry. Phaser's RESIZE mode ignores zoom,
		// so we use NONE + zoom and drive resizes ourselves.
		//
		// Graphics Quality: Low pins this to 1× regardless of the physical device
		// pixel ratio — on a weak/old GPU, halving (or quartering, on a 2×+ Retina
		// panel) the pixel count rendered every frame is the single biggest lever
		// for frame rate, well before anything else in the scene is touched.
		// renderScale() is shared with WorldScene's camera so the two can't disagree.
		const dpr = renderScale;
		const d0 = dpr();
		game.current = new Phaser.Game({
			type: Phaser.AUTO,
			parent: el,
			backgroundColor: '#26301f',
			scale: {
				mode: Phaser.Scale.NONE,
				width: (el.clientWidth || window.innerWidth) * d0,
				height: (el.clientHeight || window.innerHeight) * d0,
				zoom: 1 / d0,
			},
			scene: [WorldScene],
			render: {
				antialias: true,
				pixelArt: false,
				/* Asks for the discrete GPU on machines that have one. A hint: ignored
				 * where it does not apply, and it changes nothing about what is drawn.
				 *
				 * `desynchronized: true` was here too, as an attempt at a measured 30fps
				 * cap (rAF running at exactly half the compositor rate with the main thread
				 * at ~18% and the GPU at ~6%). It CRASHES headless Chromium — the i18n e2e
				 * suite died with "Protocol error … session closed" the moment Phaser built
				 * its WebGL context, while the title-screen tests, which never mount Phaser,
				 * passed. Do not put it back without running `npm run test:e2e:i18n` first.
				 * The frame-rate question is still open and may yet be profiler overhead —
				 * it was never reproduced with DevTools closed. */
				powerPreference: 'high-performance',
			},
			input: { activePointers: 3 }, // joystick + tap at the same time
			fps: {
				/* Why the caretaker used to wade through treacle for the first few
				 * seconds after loading a save — and again every time you clicked back
				 * into the window.
				 *
				 * This was never a frame-rate problem; it was a distance problem.
				 * Phaser's TimeStep.resetDelta() sets an internal `_coolDown` counter to
				 * `panicMax`, and while that counter is above zero smoothDelta() does
				 * `delta = Math.min(delta, 1000 / targetFps)` — it hands update() 16.67ms
				 * no matter how long the frame actually took. resetDelta() runs on boot,
				 * on resume, and on every window focus.
				 *
				 * Movement integrates that delta (`speed * dt` in handleMovement), so
				 * during the cooldown the player covers 16.67ms of ground per frame while
				 * real time runs far ahead. At the ~12fps the scene manages while create()
				 * is still building the world, the default 120-frame cooldown lasts TEN
				 * SECONDS of wall time and moves the player at a fifth of their speed.
				 * Walking looked broken; the frame counter looked fine; both were true.
				 *
				 * 8 frames is enough to swallow the genuinely garbage deltas right after a
				 * resume, and the real protection against those is the separate guard
				 * below it in smoothDelta() — anything over `1000 / minFps` (200ms) is
				 * replaced with the last sane value regardless of this setting, so a tab
				 * left in the background still can't teleport anyone on return.
				 */
				panicMax: 8,
			},
		});
		const applySize = () => {
			const g = game.current;
			if (!g) return;
			// Measure the host BEFORE touching the scale manager — these calls mutate the
			// canvas, which is a child of el.
			const cssW = el.clientWidth || window.innerWidth;
			const cssH = el.clientHeight || window.innerHeight;
			const d = dpr(); // also changes when moving between monitors
			// ORDER IS LOAD-BEARING — resize BEFORE setZoom.
			//
			// Phaser's NONE-mode scale manager writes the canvas's CSS size from only two
			// places, and both are guarded: updateScale() writes it only while the one-shot
			// `_resetZoom` flag is set (and only setZoom() ever sets it), while resize()
			// skips its own write whenever zoom === 1, because its `styleWidth !== width`
			// test is false. Calling setZoom first therefore computed the CSS size from the
			// OLD game size and then consumed the flag, so nothing corrected it afterwards:
			// switching 2× → 1× left a 1275px-backed canvas stretched over 2550 CSS px —
			// double the window. The visible quarter read as "zoomed 2× in", and the player,
			// still centred in the canvas, sat off in the bottom-right corner.
			//
			// Resizing first means the single style write that does happen (setZoom's) sees
			// the new game size. Note 1× → 2× happened to self-correct, which is why only
			// turning Low ON looked broken.
			g.scale.resize(cssW * d, cssH * d);
			g.scale.setZoom(1 / d);
			// Belt and braces: the canvas must always cover the host exactly, whatever d is.
			// Pinning it here keeps that true by construction rather than by depending on
			// which of Phaser's internal write-guards happened to fire.
			g.canvas.style.width = `${cssW}px`;
			g.canvas.style.height = `${cssH}px`;
		};
		const ro = new ResizeObserver(applySize);
		ro.observe(el);
		window.addEventListener('resize', applySize);
		// Switching Graphics Quality in Settings takes effect immediately, without a
		// reload — re-run the same resize path used for a window/monitor change.
		let lastQuality = getPrefs().graphicsQuality;
		const unsubPrefs = subscribePrefs((p) => {
			if (p.graphicsQuality === lastQuality) return;
			lastQuality = p.graphicsQuality;
			applySize();
		});
		return () => {
			ro.disconnect();
			window.removeEventListener('resize', applySize);
			unsubPrefs();
			game.current?.destroy(true);
			game.current = null;
		};
	}, []);

	return <div ref={host} className="game-host" />;
}
