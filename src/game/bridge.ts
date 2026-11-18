// Tiny event bridge between React (UI panels, API calls) and Phaser (world).
// React owns the authoritative copy of server state; Phaser reads it from
// `shared` and re-renders dynamic sprites when told the world is dirty.

import type { GameData, GameState } from '../types';

type Handler = (payload?: any) => void;

class Bridge {
	private handlers = new Map<string, Set<Handler>>();

	// Latest data/state, readable synchronously from Phaser.
	// `joy` is the virtual joystick vector written by the mobile controls.
	shared: {
		data: GameData | null;
		state: GameState | null;
		joy: { x: number; y: number };
		// Left-stick vector from a controller (src/gamepad/GamepadLayer.tsx),
		// already past the deadzone. Zeroed whenever a menu has the controller.
		pad: { x: number; y: number };
		// True while the world is placing or moving an object — the controller's B
		// cancels that instead of running the Escape chain.
		placing: boolean;
		// Where the caretaker is on the canvas, in canvas (game) pixels, so the
		// controller's pointer can be put back beside them.
		playerScreen: { x: number; y: number; facingLeft: boolean } | null;
		// True while a React panel/card/help overlay is open. The world ignores
		// pointer clicks in this state so you can't move or place "through" a modal.
		uiBlocking: boolean;
		// Hand-drawn resource sprites (`rnode-*`) snapshotted to data URLs once at
		// boot, so the DOM UI can show the same picture the world uses instead of a
		// flat colour swatch. Keyed by resource id.
		resourceIcons: Record<string, string>;
		// Same trick for the habitat/home object sprites (`obj-*`), so the crafting
		// and planting menus can show a picture of what you're making. Keyed by the
		// object's `shape` (several items can share one sprite).
		objectIcons: Record<string, string>;
	} = {
		data: null,
		state: null,
		joy: { x: 0, y: 0 },
		pad: { x: 0, y: 0 },
		placing: false,
		playerScreen: null,
		uiBlocking: false,
		resourceIcons: {},
		objectIcons: {},
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
//  Phaser -> React: 'collect-node', 'open-chest', 'open-crafting', 'open-journal',
//                   'open-mirror', 'open-finds', 'open-telescope', 'open-tarot', 'open-biomes', 'animal-clicked', 'request-area', 'place-at', 'toast', 'prompt',
//                   'placement-exited', 'remove-placement', 'toggle-light'
//  Controller -> Phaser: 'pad-interact', 'pad-cancel', 'pad-rotate' (±1), 'pad-zoom' (±1)
export const bridge = new Bridge();
