// Tiny event bridge between React (UI panels, API calls) and Phaser (world).
// React owns the authoritative copy of server state; Phaser reads it from
// `shared` and re-renders dynamic sprites when told the world is dirty.

import type { GameData, GameState } from '../types';

type Handler = (payload?: any) => void;

class Bridge {
	private handlers = new Map<string, Set<Handler>>();

	// Latest data/state, readable synchronously from Phaser.
	// `joy` is the virtual joystick vector written by the mobile controls.
	shared: { data: GameData | null; state: GameState | null; joy: { x: number; y: number } } = {
		data: null,
		state: null,
		joy: { x: 0, y: 0 },
	};

	on(event: string, fn: Handler) {
		if (!this.handlers.has(event)) this.handlers.set(event, new Set());
		this.handlers.get(event)!.add(fn);
		return () => this.off(event, fn);
	}

	off(event: string, fn: Handler) {
		this.handlers.get(event)?.delete(fn);
	}

	emit(event: string, payload?: any) {
		this.handlers.get(event)?.forEach((fn) => {
			try {
				fn(payload);
			} catch (e) {
				console.error(`bridge handler for ${event} failed`, e);
			}
		});
	}
}

// Events used:
//  React -> Phaser: 'world-dirty', 'enter-placement', 'cancel-placement', 'area-changed'
//  Phaser -> React: 'collect-node', 'open-chest', 'open-workbench', 'open-journal',
//                   'animal-clicked', 'request-area', 'place-at', 'toast', 'prompt',
//                   'placement-exited', 'remove-placement'
export const bridge = new Bridge();
