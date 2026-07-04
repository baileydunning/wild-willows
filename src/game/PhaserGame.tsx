import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { WorldScene } from './WorldScene';

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
		const dpr = () => Math.min(window.devicePixelRatio || 1, 2);
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
			render: { antialias: true, pixelArt: false },
			input: { activePointers: 3 }, // joystick + tap at the same time
		});
		const applySize = () => {
			const g = game.current;
			if (!g) return;
			const d = dpr();
			g.scale.setZoom(1 / d); // dpr can change when moving between monitors
			g.scale.resize((el.clientWidth || window.innerWidth) * d, (el.clientHeight || window.innerHeight) * d);
		};
		const ro = new ResizeObserver(applySize);
		ro.observe(el);
		window.addEventListener('resize', applySize);
		return () => {
			ro.disconnect();
			window.removeEventListener('resize', applySize);
			game.current?.destroy(true);
			game.current = null;
		};
	}, []);

	return <div ref={host} className="game-host" />;
}
