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
				/* Both of these target frame PACING, not how much work the GPU does.
				 *
				 * Measured (Chrome trace, three runs): during gameplay the compositor runs
				 * at 60/s while requestAnimationFrame fires at 30/s — exactly every other
				 * vsync — with the main thread at ~18% and the GPU at ~6%. Nothing is
				 * missing a deadline; the canvas is simply locked to half rate. Turning
				 * graphics quality down cut GPU work 40% and moved the frame rate by zero,
				 * which is what ruled out fill rate as the cause.
				 *
				 * `desynchronized` releases the canvas from that lock-step with the
				 * compositor. `powerPreference` asks for the discrete GPU where a machine
				 * has one, which also affects how presentation is scheduled. Neither
				 * changes a pixel of what is drawn. */
				desynchronized: true,
				powerPreference: 'high-performance',
			},
			input: { activePointers: 3 }, // joystick + tap at the same time
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
