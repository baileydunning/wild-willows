// Tiny event bridge between React (UI panels, API calls) and Phaser (world).
// React owns the authoritative copy of server state; Phaser reads it from
// `shared` and re-renders dynamic sprites when told the world is dirty.

import type { GameData, GameState, Peer } from '../types';

type Handler = (payload?: any) => void;

class Bridge {
	private handlers = new Map<string, Set<Handler>>();

	// Latest data/state, readable synchronously from Phaser.
	// `joy` is the virtual joystick vector written by the mobile controls.
	// `presence` is the live set of other players in the same co-op world.
	// `self` is our own live position (tile coords), written by Phaser every frame
	// so the co-op presence loop can stream smooth micro-movements.
	shared: {
		data: GameData | null;
		state: GameState | null;
		joy: { x: number; y: number };
		presence: Peer[];
		self: { x: number; y: number; area: string } | null;
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
		presence: [],
		self: null,
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
//                   'animal-clicked', 'request-area', 'place-at', 'toast', 'prompt',
//                   'placement-exited', 'remove-placement'
export const bridge = new Bridge();
