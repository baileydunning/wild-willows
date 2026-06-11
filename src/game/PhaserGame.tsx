import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { WorldScene } from './WorldScene';

export function PhaserGame() {
	const host = useRef<HTMLDivElement>(null);
	const game = useRef<Phaser.Game | null>(null);

	useEffect(() => {
		if (!host.current || game.current) return;
		game.current = new Phaser.Game({
			type: Phaser.AUTO,
			parent: host.current,
			backgroundColor: '#26301f',
			// RESIZE + camera zoom keeps the world readable on phones and desktops alike
			scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
			scene: [WorldScene],
			render: { antialias: true, pixelArt: false },
			input: { activePointers: 3 }, // joystick + tap at the same time
		});
		return () => {
			game.current?.destroy(true);
			game.current = null;
		};
	}, []);

	return <div ref={host} className="game-host" />;
}
