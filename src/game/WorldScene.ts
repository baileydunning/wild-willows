import Phaser from 'phaser';
import { bridge } from './bridge';
import {
	animalScale, animalTexture, ensureAnimalTexture, makeAnimalTextures, makeBaseTextures, makeNodeTextures,
	makeObjectTextures, makePlayerTexture,
} from './textures';
import type { BiomeDef, HabitatObjectDef } from '../types';

export const TILE = 32;
const OUT_W = 30;
const OUT_H = 20;

// your base camp: tent + campfire scenery beside the permanent workbench & chest
const CAMP = { tent: { x: 6.5, y: 4.2 }, fire: { x: 7.6, y: 5.1 } };
const CAMP_BLOCK = { x0: 5.5, y0: 3.2, x1: 9.9, y1: 5.9 }; // keep nodes/placements clear of camp

// spawn points when arriving in an area from another
const SPAWNS: Record<string, { x: number; y: number }> = {
	// arriving from the west neighbour → enter at the west edge; from the east → east edge
	'meadow:from-forest': { x: 27.8, y: 10.0 },
	'forest:from-meadow': { x: 1.8, y: 10.0 },
	'forest:from-wetland': { x: 27.8, y: 10.0 },
	'wetland:from-forest': { x: 1.8, y: 10.0 },
	'wetland:from-desert': { x: 27.8, y: 10.0 },
	'desert:from-wetland': { x: 1.8, y: 10.0 },
	default: { x: 15, y: 11 },
};

function hashStr(s: string): number {
	let h = 2166136261;
	for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
	return h >>> 0;
}

function mulberry32(seed: number) {
	let a = seed >>> 0;
	return () => {
		a |= 0; a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

interface NodeDef {
	id: string;
	resourceId: string;
	tx: number;
	ty: number;
}

interface Interactable {
	x: number;
	y: number;
	label: string;
	action: () => void;
}

export class WorldScene extends Phaser.Scene {
	area = 'meadow';
	private player!: Phaser.GameObjects.Image;
	private playerShadow!: Phaser.GameObjects.Image;
	private walkT = 0;
	private keys!: any;
	private groundTiles: Phaser.GameObjects.Image[] = [];
	private dynamic!: Phaser.GameObjects.Group;
	private animals!: Phaser.GameObjects.Group; // animals live in their own layer so a
	private animalSig = '';                      // routine refresh doesn't reset their wandering
	private interactables: Interactable[] = [];
	private nodes: NodeDef[] = [];
	private nodeSprites = new Map<string, Phaser.GameObjects.Container>();
	private lastPrompt = '';
	private unsubs: Array<() => void> = [];
	private placementObjectId: string | null = null;
	private movingPlacementId: string | null = null;
	private ghost: Phaser.GameObjects.Container | null = null;
	private moveAccum = 0;
	private lastSynced = { x: 0, y: 0 };
	private activeTool = 'basket';
	private highlight!: Phaser.GameObjects.Container;
	private tileCursor!: Phaser.GameObjects.Image;
	private isTouch = false;
	private alive = false; // true between create() and shutdown (scene.isActive() is false DURING create)
	private waterTiles = new Set<string>();
	private bridgeTiles = new Set<string>();

	constructor() {
		super('world');
	}

	init(data: any) {
		const area = data?.area || bridge.shared.state?.player.area || 'meadow';
		// 'home' is retired — old saves land back in the meadow
		this.area = area === 'home' ? 'meadow' : area;
	}

	private get worldW() {
		return OUT_W * TILE;
	}
	private get worldH() {
		return OUT_H * TILE;
	}
	private biomeDef(id = this.area): BiomeDef | undefined {
		return bridge.shared.data?.biomes.find((b) => b.id === id);
	}
	private objectDef(id: string): HabitatObjectDef | undefined {
		if (id === 'workbench') {
			return { id, name: 'Workbench', shape: 'workbench', placement: 'outdoor' } as any;
		}
		return bridge.shared.data?.habitatObjects.find((o) => o.id === id);
	}

	create(data: any) {
		this.alive = true;
		makeBaseTextures(this);
		makeObjectTextures(this);
		makeAnimalTextures(this);
		makeNodeTextures(this);
		this.isTouch = this.sys.game.device.input.touch && !this.sys.game.device.os.desktop;

		this.cameras.main.setBounds(0, 0, this.worldW, this.worldH);
		this.cameras.main.setBackgroundColor('#26301f');
		this.applyZoom();
		this.scale.on('resize', () => this.applyZoom());
		this.drawGround();

		this.dynamic = this.add.group();
		this.animals = this.add.group();
		const playerKey = makePlayerTexture(this, bridge.shared.state?.player.appearance);
		this.playerShadow = this.add.image(0, 0, 'shadow').setDepth(2);
		this.player = this.add.image(0, 0, playerKey).setDepth(1000);
		const spawn = data?.spawn || this.savedSpawn();
		this.player.setPosition(spawn.x * TILE, spawn.y * TILE);
		this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
		this.startLeaves();

		this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SPACE,ESC,SHIFT');
		this.input.keyboard!.on('keydown-ESC', () => {
			if (this.placementObjectId || this.movingPlacementId) bridge.emit('placement-exited');
		});

		// When the player is typing in a text field (passcode, save name, chest
		// amounts, …) the game must NOT eat those keystrokes for movement. Disable
		// the scene's keyboard (and Phaser's global key capture) whenever a text
		// input is focused, and restore it the moment focus leaves.
		const isTextEntry = (el: EventTarget | null) => {
			const n = el as HTMLElement | null;
			if (!n) return false;
			const tag = n.tagName;
			return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || n.isContentEditable;
		};
		const onFocusIn = (e: FocusEvent) => {
			if (!isTextEntry(e.target)) return;
			const kb = this.input.keyboard;
			if (!kb) return;
			kb.enabled = false;
			kb.disableGlobalCapture();
			kb.resetKeys(); // drop any held WASD so the player stops dead
		};
		const onFocusOut = (e: FocusEvent) => {
			if (!isTextEntry(e.target)) return;
			const kb = this.input.keyboard;
			if (!kb) return;
			kb.enabled = true;
			kb.enableGlobalCapture();
		};
		document.addEventListener('focusin', onFocusIn);
		document.addEventListener('focusout', onFocusOut);
		this.events.once('shutdown', () => {
			document.removeEventListener('focusin', onFocusIn);
			document.removeEventListener('focusout', onFocusOut);
		});

		// nearest-interactable highlight (pulsing ring + key hint)
		const ring = this.add.image(0, 0, 'ring').setTint(0xffe9a8);
		const badgeBg = this.add.circle(0, -30, 9.5, 0x2b3321, 0.92).setStrokeStyle(1.5, 0xffe9a8, 1);
		const badgeText = this.add
			.text(0, -30, this.isTouch ? '·' : 'E', { fontFamily: 'Quicksand, sans-serif', fontSize: '11px', color: '#f0e8d4', fontStyle: 'bold' })
			.setOrigin(0.5);
		this.highlight = this.add.container(0, 0, [ring, badgeBg, badgeText]).setDepth(6000).setVisible(false);
		this.tweens.add({ targets: ring, scale: { from: 0.92, to: 1.08 }, alpha: { from: 0.95, to: 0.6 }, duration: 700, yoyo: true, repeat: -1 });

		this.tileCursor = this.add.image(0, 0, 'ghost-ok').setDepth(5900).setVisible(false).setAlpha(0.8);

		this.refreshDynamic();
		// Fresh-login safety net: on login the scene can finish booting before the
		// saved game state has been handed to the bridge. When that happens the
		// world (placements, chests, terrain, animals) draws empty and previously
		// only filled in after the first place/dig forced a refresh. Keep repainting
		// until the save actually arrives so the preserve is there immediately.
		let tries = 0;
		const ensurePainted = () => {
			if (!this.alive) return;
			this.refreshDynamic();
			if (!bridge.shared.state && tries++ < 40) this.time.delayedCall(75, ensurePainted);
		};
		ensurePainted();

		this.unsubs.push(bridge.on('world-dirty', () => this.refreshDynamic()));
		this.unsubs.push(bridge.on('enter-placement', (p: any) => this.enterPlacement(p.objectId)));
		this.unsubs.push(bridge.on('cancel-placement', () => this.exitPlacement()));
		this.unsubs.push(bridge.on('enter-move', (p: any) => this.enterMove(p.placementId)));
		this.unsubs.push(
			bridge.on('appearance-changed', (appearance: any) => {
				if (this.alive) this.player.setTexture(makePlayerTexture(this, appearance));
			})
		);
		this.unsubs.push(bridge.on('tool-selected', (toolId: string) => (this.activeTool = toolId)));
		this.unsubs.push(bridge.on('mobile-interact', () => this.nearestInteractable()?.action()));
		this.unsubs.push(bridge.on('collected', (p: any) => this.playPickup(p)));
		this.unsubs.push(bridge.on('terraformed', (p: any) => this.playTerraformFx(p)));
		this.unsubs.push(
			bridge.on('area-changed', (area: string) => {
				const key = `${area}:from-${this.area}`;
				this.exitPlacement();
				this.scene.restart({ area, spawn: SPAWNS[key] || SPAWNS.default });
			})
		);
		this.events.once('shutdown', () => {
			this.alive = false;
			this.unsubs.forEach((u) => u());
			this.unsubs = [];
		});

		this.time.addEvent({ delay: 4000, loop: true, callback: () => this.updateNodeVisuals() });
		this.input.on('pointerdown', (pointer: Phaser.Input.Pointer, over: any[]) => {
			const tx = Math.floor(pointer.worldX / TILE);
			const ty = Math.floor(pointer.worldY / TILE);
			if (this.movingPlacementId) {
				if (this.canPlaceAt(tx, ty, false, this.movingPlacementId)) {
					bridge.emit('move-to', { placementId: this.movingPlacementId, x: tx, y: ty });
					this.exitPlacement();
				}
				return;
			}
			if (this.placementObjectId) {
				if (this.canPlaceAt(tx, ty)) bridge.emit('place-at', { objectId: this.placementObjectId, x: tx, y: ty });
				return;
			}
			// terraform with shovel / watering can on an empty reachable tile
			if (this.terraformAction() && (!over || over.length === 0) && this.tileReachable(tx, ty)) {
				bridge.emit('terraform-at', this.terraformPayload(tx, ty));
			}
		});
	}

	/** Fit-to-screen camera zoom: fills phones edge-to-edge, stays cozy on desktop. */
	private applyZoom() {
		const w = this.scale.width;
		const h = this.scale.height;
		const zoom = Phaser.Math.Clamp(Math.max(w / this.worldW, h / this.worldH), 0.85, 1.7);
		this.cameras.main.setZoom(zoom);
	}

	private terraformAction(): 'dig' | 'water' | null {
		if (this.activeTool === 'shovel') return 'dig';
		if (this.activeTool === 'watering-can') return 'water';
		return null;
	}

	private terrainAt(tx: number, ty: number) {
		const s = bridge.shared.state;
		return s?.terrain?.find((t) => t.area === this.area && t.x === tx && t.y === ty);
	}

	/** Digging prepared ground clears it; watering needs a prepared bed. */
	private terraformActionFor(tx: number, ty: number): 'dig' | 'water' | 'clear' {
		const existing = this.terrainAt(tx, ty);
		if (this.activeTool === 'shovel') return existing ? 'clear' : 'dig';
		return 'water';
	}

	/** Terraform event payload — destructive actions on a watered bed ask first. */
	private terraformPayload(tx: number, ty: number) {
		const action = this.terraformActionFor(tx, ty);
		const existing = this.terrainAt(tx, ty);
		let confirm: string | undefined;
		let block: string | undefined;
		if (existing?.type === 'watered') {
			if (action === 'clear') confirm = 'Clear this watered soil bed? The water used on it is lost.';
			else if (action === 'water') {
				// Flooding the tile you're standing on would strand you in open
				// water, so block it outright instead of asking — same tile key the
				// movement collision uses.
				const onTile = Math.floor(this.player.x / TILE) === tx
					&& Math.floor((this.player.y + 8) / TILE) === ty;
				if (onTile) block = "You're standing here — step off before flooding this bed into open water.";
				// otherwise flooding happens immediately — no confirmation prompt
			}
		}
		return { area: this.area, x: tx, y: ty, action, confirm, block };
	}

	private tileReachable(tx: number, ty: number): boolean {
		const px = this.player.x / TILE - 0.5;
		const py = this.player.y / TILE - 0.5;
		return Math.abs(tx - px) <= 2.4 && Math.abs(ty - py) <= 2.4 && this.canPlaceAt(tx, ty, true);
	}

	private savedSpawn() {
		const p = bridge.shared.state?.player;
		if (p && p.area === this.area && Number.isFinite(p.x)) {
			const x = Phaser.Math.Clamp(p.x, 1, this.worldW / TILE - 1);
			const y = Phaser.Math.Clamp(p.y, 1, this.worldH / TILE - 1);
			return { x, y };
		}
		return SPAWNS.default;
	}

	// ------------------------------------------------------------- ground

	private drawGround() {
		this.groundTiles = [];
		const rng = mulberry32(hashStr(this.area));
		for (let ty = 0; ty < OUT_H; ty++) {
			for (let tx = 0; tx < OUT_W; tx++) {
				const img = this.add.image(tx * TILE + 16, ty * TILE + 16, 'tile').setDepth(0);
				(img as any).shade = 0.92 + rng() * 0.08;
				this.groundTiles.push(img);
			}
		}
		this.tintGround();
	}

	private tintGround() {
		const biome = this.biomeDef();
		const state = bridge.shared.state?.biomeStates.find((b) => b.biomeId === this.area);
		const health = state?.health ?? 5;
		const from = Phaser.Display.Color.HexStringToColor(biome?.palette.damaged || '#b9a37c');
		const to = Phaser.Display.Color.HexStringToColor(biome?.palette.healthy || '#8fbf6f');
		const t = Phaser.Math.Clamp(health / 100, 0, 1);
		const mix = Phaser.Display.Color.Interpolate.ColorWithColor(from, to, 100, Math.round(t * 100));
		for (const img of this.groundTiles) {
			const s = (img as any).shade ?? 1;
			const color = Phaser.Display.Color.GetColor(mix.r * s, mix.g * s, mix.b * s);
			img.setTint(color);
		}
	}

	// ------------------------------------------------- dynamic world objects

	private refreshDynamic() {
		if (!this.alive) return;
		this.dynamic.clear(true, true);
		this.nodeSprites.clear();
		this.interactables = [];
		// collision lookups: open water blocks walking unless bridged
		const st = bridge.shared.state;
		this.waterTiles = new Set(
			(st?.terrain || []).filter((tt) => tt.area === this.area && tt.type === 'water').map((tt) => `${tt.x},${tt.y}`)
		);
		this.bridgeTiles = new Set(
			(st?.placements || [])
				.filter((pl) => pl.area === this.area && this.objectDef(pl.objectId)?.bridge)
				.map((pl) => `${pl.x},${pl.y}`)
		);
		this.tintGround();
		this.drawTerrain();
		this.drawDoodads();
		this.drawStaticFeatures();
		this.drawNodes();
		this.drawPlacements();

		// Animals are redrawn only when the cast actually changes (a new arrival, a
		// comfort shift, or a different area) — not on every gather/place — so they
		// keep wandering instead of snapping back to their spawn on each action.
		const here = (st?.discoveries || []).filter((disc) => disc.biomeId === this.area);
		const sig = this.area + '|' + here.map((d) => `${d.animalId}:${d.comfort ?? ''}`).sort().join(',');
		if (sig !== this.animalSig) {
			this.animalSig = sig;
			this.animals.clear(true, true);
			this.drawAnimals();
		}
	}

	/** Terraformed ground: tilled beds and watered, recovering soil. */
	private drawTerrain() {
		const s = bridge.shared.state;
		if (!s?.terrain) return;
		for (const tile of s.terrain) {
			if (tile.area !== this.area) continue;
			const x = tile.x * TILE + 16;
			const y = tile.y * TILE + 16;
			if (tile.type === 'water') {
				const img = this.addDyn(this.add.image(x, y, 'terrain-water').setDepth(1.6));
				this.tweens.add({ targets: img, alpha: { from: 1, to: 0.86 }, duration: 1300 + ((tile.x + tile.y) % 4) * 180, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
				continue;
			}
			this.addDyn(this.add.image(x, y, tile.type === 'watered' ? 'watered' : 'tilled').setDepth(1.5));
			if (tile.type === 'watered') {
				// watered beds are ready for planting; terraform clicks still reach the
				// soil here so the can/shovel can flood or clear it (with confirmation)
				this.registerInteractable({
					x, y, label: 'Plant in this watered bed',
					action: () => bridge.emit('bed-clicked', { area: this.area, x: tile.x, y: tile.y }),
				}, undefined, { terraformPassthrough: true });
			}
		}
	}

	/** Wire an interactable so it can also be tapped/clicked directly (mobile-first). */
	private registerInteractable(
		it: Interactable,
		hitObject?: Phaser.GameObjects.GameObject,
		opts: { terraformPassthrough?: boolean } = {}
	) {
		this.interactables.push(it);
		const target =
			hitObject ||
			this.addDyn(this.add.zone(it.x, it.y, 44, 46).setOrigin(0.5).setInteractive({ useHandCursor: true }));
		target.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
			if (this.placementObjectId || this.movingPlacementId) return;
			// Only ground tiles (watered beds) let terraform clicks pass through to
			// the soil beneath (flooding/clearing). Chests, nodes, and stations always
			// run their own action — holding the shovel or can no longer turns
			// "open chest" into a baffling terraform error.
			if (this.terraformAction() && opts.terraformPassthrough) {
				const tx = Math.floor(pointer.worldX / TILE);
				const ty = Math.floor(pointer.worldY / TILE);
				if (this.tileReachable(tx, ty)) {
					bridge.emit('terraform-at', this.terraformPayload(tx, ty));
				}
				return;
			}
			if (pointer.event && (pointer.event as MouseEvent).shiftKey) return; // shift = pick up
			const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, it.x, it.y);
			if (dist <= 96) it.action();
			else bridge.emit('toast', { text: 'Walk a little closer first.', kind: 'info' });
		});
	}

	/** Soft ground details that change with biome health: cracks heal into tufts and flowers. */
	private drawDoodads() {
		const state = bridge.shared.state?.biomeStates.find((b) => b.biomeId === this.area);
		const health = state?.health ?? 5;
		const rng = mulberry32(hashStr(`${this.area}-doodads`));
		const spot = (): { x: number; y: number } | null => {
			const x = (1 + rng() * (OUT_W - 2)) * TILE;
			const y = (1.4 + rng() * (OUT_H - 2.4)) * TILE;
			if (this.area === 'meadow' && x > (CAMP_BLOCK.x0 - 0.4) * TILE && x < (CAMP_BLOCK.x1 + 0.4) * TILE && y > (CAMP_BLOCK.y0 - 0.4) * TILE && y < (CAMP_BLOCK.y1 + 0.4) * TILE) return null;
			return { x, y };
		};
		const scatter = (key: string, count: number, alpha = 1) => {
			for (let i = 0; i < count; i++) {
				const p = spot();
				if (!p) continue;
				this.addDyn(this.add.image(p.x, p.y, key).setDepth(1).setAlpha(alpha).setAngle(rng() * 20 - 10));
			}
		};
		scatter('crack', Math.round(((100 - health) / 100) * 26), 0.8);
		scatter('pebble', 12, 0.8);
		scatter('tuft', Math.round((health / 100) * 44) + 4);
		scatter('tinyflower', Math.max(0, Math.round(((health - 25) / 100) * 26)));
	}

	private addDyn<T extends Phaser.GameObjects.GameObject>(obj: T): T {
		this.dynamic.add(obj);
		return obj;
	}

	private drawStaticFeatures() {
		const state = bridge.shared.state;
		if (this.area === 'meadow') {
			// base camp: tent + flickering campfire (the workbench/chest are placements)
			const tx2 = CAMP.tent.x * TILE, ty2 = CAMP.tent.y * TILE;
			this.addDyn(this.add.image(tx2, ty2 + 22, 'shadow').setDepth(3).setScale(2.0, 1.1));
			this.addDyn(this.add.image(tx2, ty2, 'tent').setDepth(ty2));
			const fx = CAMP.fire.x * TILE, fy = CAMP.fire.y * TILE;
			const fireGlow = this.addDyn(this.add.image(fx, fy - 4, 'glow').setTint(0xffb84f).setDepth(fy - 1).setScale(1.3));
			(fireGlow as Phaser.GameObjects.Image).setBlendMode(Phaser.BlendModes.ADD);
			const fire = this.addDyn(this.add.image(fx, fy, 'campfire').setDepth(fy));
			this.tweens.add({ targets: [fire, fireGlow], alpha: { from: 1, to: 0.75 }, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

			const gx = (OUT_W - 1.2) * TILE;
			const gy = 9.8 * TILE;
			this.addDyn(this.add.image(gx, gy, 'gate').setDepth(gy));
			this.addDyn(this.add.image(gx - 20, gy + 26, 'sign').setDepth(gy + 26));
			const forestUnlocked = state?.player.unlockedBiomes.includes('forest');
			this.registerInteractable({
				x: gx, y: gy, label: forestUnlocked ? 'Walk to Old Hollow Forest' : 'Read the trail sign',
				action: () => {
					if (forestUnlocked) bridge.emit('request-area', { area: 'forest' });
					else {
						const label = this.biomeDef('forest')?.unlock?.label || 'Restore the meadow first.';
						bridge.emit('toast', { text: `The forest trail is overgrown. ${label}`, kind: 'info' });
					}
				},
			});
		} else if (this.area === 'forest') {
			const gx = 1.2 * TILE;
			const gy = 9.8 * TILE;
			this.addDyn(this.add.image(gx, gy, 'gate').setDepth(gy));
			this.registerInteractable({ x: gx, y: gy, label: 'Walk back to Willow Meadow', action: () => bridge.emit('request-area', { area: 'meadow' }) });

			const sx = (OUT_W - 1.2) * TILE;
			const sy = 9.8 * TILE;
			const wetlandUnlocked = state?.player.unlockedBiomes.includes('wetland');
			const wetlandExplorable = this.biomeDef('wetland')?.explorable;
			const wetlandOpen = wetlandUnlocked && wetlandExplorable;
			this.addDyn(this.add.image(sx, sy, wetlandOpen ? 'gate' : 'sign').setDepth(sy));
			this.registerInteractable({
				x: sx, y: sy, label: wetlandOpen ? 'Walk to Rushwater Wetland' : 'Read the trail sign (Rushwater Wetland)',
				action: () => {
					if (wetlandOpen) {
						bridge.emit('request-area', { area: 'wetland' });
						return;
					}
					const wetland = this.biomeDef('wetland');
					const text = wetlandUnlocked
						? 'Rushwater Wetland is unlocked! Follow the boardwalk east to step into the marsh.'
						: `The wetland path is washed out. ${wetland?.unlock?.label || ''}`;
					bridge.emit('toast', { text, kind: 'info' });
				},
			});
			// a few standing dead snags for atmosphere
			const rng = mulberry32(hashStr('forest-snags'));
			for (let i = 0; i < 5; i++) {
				const x = (4 + rng() * 22) * TILE;
				const y = (2 + rng() * 4) * TILE;
				this.addDyn(this.add.image(x, y, 'obj-deadwood').setDepth(y).setAlpha(0.85).setTint(0xb9aa8e));
			}
		} else if (this.area === 'wetland') {
			// gate back to the forest on the west edge
			const gx = 1.2 * TILE;
			const gy = 9.8 * TILE;
			this.addDyn(this.add.image(gx, gy, 'gate').setDepth(gy));
			this.registerInteractable({ x: gx, y: gy, label: 'Walk back to Old Hollow Forest', action: () => bridge.emit('request-area', { area: 'forest' }) });

			// trail east toward the desert (Redstone Scrubland)
			const sx = (OUT_W - 1.2) * TILE;
			const sy = 9.8 * TILE;
			const desertUnlocked = state?.player.unlockedBiomes.includes('desert');
			const desertExplorable = this.biomeDef('desert')?.explorable;
			const desertOpen = desertUnlocked && desertExplorable;
			this.addDyn(this.add.image(sx, sy, desertOpen ? 'gate' : 'sign').setDepth(sy));
			this.registerInteractable({
				x: sx, y: sy, label: desertOpen ? 'Walk to Redstone Scrubland' : 'Read the trail sign (Redstone Scrubland)',
				action: () => {
					if (desertOpen) {
						bridge.emit('request-area', { area: 'desert' });
						return;
					}
					const desert = this.biomeDef('desert');
					const text = desertUnlocked
						? 'Redstone Scrubland is unlocked! The desert trail east opens soon.'
						: `The desert trail is blocked. ${desert?.unlock?.label || ''}`;
					bridge.emit('toast', { text, kind: 'info' });
				},
			});
		} else if (this.area === 'desert') {
			// gate back to the wetland on the west edge
			const gx = 1.2 * TILE;
			const gy = 9.8 * TILE;
			this.addDyn(this.add.image(gx, gy, 'gate').setDepth(gy));
			this.registerInteractable({ x: gx, y: gy, label: 'Walk back to Rushwater Wetland', action: () => bridge.emit('request-area', { area: 'wetland' }) });

			// trail east toward the alpine heights (Graywind Heights)
			const sx = (OUT_W - 1.2) * TILE;
			const sy = 9.8 * TILE;
			const alpineUnlocked = state?.player.unlockedBiomes.includes('alpine');
			const alpineExplorable = this.biomeDef('alpine')?.explorable;
			const alpineOpen = alpineUnlocked && alpineExplorable;
			this.addDyn(this.add.image(sx, sy, alpineOpen ? 'gate' : 'sign').setDepth(sy));
			this.registerInteractable({
				x: sx, y: sy, label: alpineOpen ? 'Walk to Graywind Heights' : 'Read the trail sign (Graywind Heights)',
				action: () => {
					if (alpineOpen) {
						bridge.emit('request-area', { area: 'alpine' });
						return;
					}
					const alpine = this.biomeDef('alpine');
					const text = alpineUnlocked
						? 'Graywind Heights is unlocked! The mountain trail opens soon.'
						: `The mountain trail is blocked. ${alpine?.unlock?.label || ''}`;
					bridge.emit('toast', { text, kind: 'info' });
				},
			});
		}
	}

	// resource nodes — layout and resource mix are randomized per player + area
	// (deterministic from that seed so they stay put), and every biome resource
	// is guaranteed to appear at least once so recipes remain craftable.
	private computeNodes(): NodeDef[] {
		const biome = this.biomeDef();
		if (!biome) return [];
		const playerId = bridge.shared.state?.player.id || 'anon';
		const rng = mulberry32(hashStr(`${playerId}-${this.area}-nodes`));
		const count = 16;

		// Build the resource bag for this area. GUARANTEE every biome resource
		// appears at least once (one of each, placed first), then fill the rest
		// with a weighted random draw so early-game staples are easy to find
		// (seeds especially — used by almost every meadow recipe). Coverage is no
		// longer left to a shuffle that could drop a resource: if it's in the
		// biome, a node for it is generated.
		const NODE_WEIGHT: Record<string, number> = { seeds: 4, fiber: 2 };
		const res = biome.resources || [];
		const weighted: string[] = [];
		for (const r of res) for (let i = 0; i < (NODE_WEIGHT[r] || 1); i++) weighted.push(r);
		// shuffle only the guaranteed prefix's *order* (positions are random anyway),
		// then append weighted fill up to `count`
		const pool: string[] = [...res];
		while (pool.length < count && weighted.length) pool.push(weighted[Math.floor(rng() * weighted.length)]);

		const nodes: NodeDef[] = [];
		let attempts = 0;
		while (nodes.length < count && attempts < 400) {
			attempts++;
			const tx = 1 + Math.floor(rng() * (OUT_W - 3));
			const ty = 1 + Math.floor(rng() * (OUT_H - 3));
			if (this.inCamp(tx, ty)) continue;
			if (nodes.some((n) => Math.abs(n.tx - tx) < 2 && Math.abs(n.ty - ty) < 2)) continue;
			const resourceId = pool[nodes.length] || res[nodes.length % res.length];
			nodes.push({ id: `n${nodes.length}`, resourceId, tx, ty });
		}

		// Players can build anywhere; a regen spot that ends up under a placement or
		// terraformed tile simply relocates to the nearest free tile (keeping its id
		// and cooldown). Unaffected nodes stay put.
		const s = bridge.shared.state;
		const occupied = new Set<string>();
		for (const p of s?.placements || []) if (p.area === this.area) occupied.add(`${p.x},${p.y}`);
		for (const tt of s?.terrain || []) if (tt.area === this.area) occupied.add(`${tt.x},${tt.y}`);
		const taken = new Set(nodes.map((n) => `${n.tx},${n.ty}`));
		for (const node of nodes) {
			if (!occupied.has(`${node.tx},${node.ty}`)) continue;
			const spot = this.findFreeTile(node.tx, node.ty, occupied, taken);
			if (spot) {
				taken.delete(`${node.tx},${node.ty}`);
				node.tx = spot.tx;
				node.ty = spot.ty;
				taken.add(`${node.tx},${node.ty}`);
			}
		}

		// Always guarantee a water source near where you spawn — early game needs
		// water for soil beds and recipes. (Skipped in dry biomes like the desert,
		// which have no water resource.)
		const waterRes = res.includes('water') ? 'water' : res.includes('clean-water') ? 'clean-water' : null;
		if (waterRes) {
			const anchor = this.area === 'meadow' ? { tx: 12, ty: 8 } : { tx: 4, ty: 11 };
			const hasNearby = nodes.some(
				(n) => (n.resourceId === 'water' || n.resourceId === 'clean-water') &&
					Math.abs(n.tx - anchor.tx) <= 5 && Math.abs(n.ty - anchor.ty) <= 5,
			);
			if (!hasNearby) {
				const aKey = `${anchor.tx},${anchor.ty}`;
				const anchorFree = anchor.tx >= 1 && anchor.ty >= 1 && anchor.tx <= OUT_W - 2 && anchor.ty <= OUT_H - 2 &&
					!occupied.has(aKey) && !taken.has(aKey) && !this.inCamp(anchor.tx, anchor.ty);
				const spot = anchorFree ? anchor : this.findFreeTile(anchor.tx, anchor.ty, occupied, taken);
				if (spot) {
					nodes.push({ id: 'nw', resourceId: waterRes, tx: spot.tx, ty: spot.ty });
					taken.add(`${spot.tx},${spot.ty}`);
				}
			}
		}
		return nodes;
	}

	private inCamp(tx: number, ty: number): boolean {
		return this.area === 'meadow' && tx > CAMP_BLOCK.x0 - 1 && tx < CAMP_BLOCK.x1 + 1 && ty > CAMP_BLOCK.y0 - 1 && ty < CAMP_BLOCK.y1 + 1;
	}

	/** Nearest in-bounds tile (ring search) that isn't built on or used by another node. */
	private findFreeTile(cx: number, cy: number, occupied: Set<string>, taken: Set<string>): { tx: number; ty: number } | null {
		for (let r = 1; r <= 10; r++) {
			for (let dx = -r; dx <= r; dx++) {
				for (let dy = -r; dy <= r; dy++) {
					if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; // current ring only
					const tx = cx + dx;
					const ty = cy + dy;
					if (tx < 1 || ty < 1 || tx > OUT_W - 2 || ty > OUT_H - 2) continue;
					const key = `${tx},${ty}`;
					if (occupied.has(key) || taken.has(key) || this.inCamp(tx, ty)) continue;
					return { tx, ty };
				}
			}
		}
		return null;
	}

	private nodeAvailable(node: NodeDef): boolean {
		const s = bridge.shared.state;
		if (!s) return true;
		const rec = s.nodeStates.find((n) => n.id === `${s.player.id}:${this.area}:${node.id}`);
		if (!rec) return true;
		return Date.now() - rec.harvestedAt >= s.nodeRegenSeconds * 1000;
	}

	private drawNodes() {
		this.nodes = this.computeNodes();
		const data = bridge.shared.data;
		for (const node of this.nodes) {
			const res = data?.resources.find((r) => r.id === node.resourceId);
			const x = node.tx * TILE + 16;
			const y = node.ty * TILE + 16;
			const container = this.add.container(x, y).setDepth(y);

			const texKey = this.textures.exists(`rnode-${node.resourceId}`) ? `rnode-${node.resourceId}` : 'node';
			const img = this.add.image(0, 0, texKey);
			if (texKey === 'node') img.setTint(Phaser.Display.Color.HexStringToColor(res?.color || '#999999').color);
			const sprout = this.add.image(0, 2, 'sprout');
			container.add([img, sprout]);
			(container as any).nodeImg = img;
			(container as any).sproutImg = sprout;
			container.setSize(36, 36).setInteractive({ useHandCursor: true });
			this.addDyn(container);
			this.nodeSprites.set(node.id, container);
			this.tweens.add({
				targets: container, scale: { from: 1, to: 1.07 },
				duration: 1100 + (node.tx % 5) * 130, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
			});
			const it: Interactable = {
				x, y, label: `Gather ${res?.name || node.resourceId}`,
				action: () => {
					if (this.nodeAvailable(node)) bridge.emit('collect-node', { biomeId: this.area, nodeId: node.id, resourceId: node.resourceId });
					else bridge.emit('toast', { text: 'Still regrowing — let it rest a little longer.', kind: 'info' });
				},
			};
			this.registerInteractable(it, container);
		}
		this.updateNodeVisuals();
	}

	private updateNodeVisuals() {
		if (!this.alive) return;
		for (const node of this.nodes) {
			const c = this.nodeSprites.get(node.id);
			if (!c || !c.active) continue;
			const available = this.nodeAvailable(node);
			((c as any).nodeImg as Phaser.GameObjects.Image).setVisible(available);
			((c as any).sproutImg as Phaser.GameObjects.Image).setVisible(!available);
		}
	}

	// ----------------------------------------------------- feedback effects

	/** Items visibly pop out of the node, arc into your basket, and a +N floats up. */
	private playPickup(p: { nodeId: string; resourceId: string; qty: number; tool: string; color?: string }) {
		if (!this.alive) return;
		const node = this.nodes.find((n) => n.id === p.nodeId);
		const sx = node ? node.tx * TILE + 16 : this.player.x;
		const sy = node ? node.ty * TILE + 16 : this.player.y;
		const texKey = this.textures.exists(`rnode-${p.resourceId}`) ? `rnode-${p.resourceId}` : 'node';

		// tool swing beside the player
		const toolKey = `tool-${p.tool}`;
		if (this.textures.exists(toolKey)) {
			const toolImg = this.add.image(this.player.x + 14, this.player.y - 4, toolKey).setDepth(6500).setAngle(-30);
			this.tweens.add({
				targets: toolImg, angle: 28, duration: 220, yoyo: true,
				onComplete: () => this.tweens.add({ targets: toolImg, alpha: 0, duration: 160, onComplete: () => toolImg.destroy() }),
			});
		}
		// little squash on the player — you can see yourself grab it
		this.tweens.add({ targets: this.player, scaleX: 1.12, scaleY: 0.9, duration: 110, yoyo: true });

		for (let i = 0; i < Math.min(p.qty, 3); i++) {
			const item = this.add.image(sx, sy, texKey).setDepth(6400).setScale(0.55);
			this.tweens.add({
				targets: item,
				x: { value: () => this.player.x, duration: 430 + i * 90, ease: 'Sine.easeIn' },
				y: { value: () => this.player.y - 6, duration: 430 + i * 90, ease: 'Back.easeIn' },
				scale: 0.2,
				alpha: { from: 1, to: 0.7 },
				delay: i * 70,
				onComplete: () => item.destroy(),
			});
		}
		const res = bridge.shared.data?.resources.find((r) => r.id === p.resourceId);
		this.floatText(sx, sy - 18, `+${p.qty} ${res?.name || p.resourceId}`, '#fff7dd');
	}

	private playTerraformFx(p: { x: number; y: number; action: string }) {
		if (!this.alive) return;
		const x = p.x * TILE + 16;
		const y = p.y * TILE + 16;
		const toolKey = p.action === 'water' ? 'tool-watering-can' : 'tool-shovel';
		const toolImg = this.add.image(x + 10, y - 12, toolKey).setDepth(6500).setAngle(-25);
		this.tweens.add({
			targets: toolImg, angle: 30, duration: 240, yoyo: true,
			onComplete: () => toolImg.destroy(),
		});
		const color = p.action === 'water' ? 0x8fd0e8 : 0x8a6a48;
		for (let i = 0; i < 6; i++) {
			const speck = this.add.circle(x, y, 2.4, color, 0.9).setDepth(6450);
			this.tweens.add({
				targets: speck,
				x: x + (Math.random() - 0.5) * 36,
				y: y - 6 - Math.random() * 18,
				alpha: 0,
				duration: 380 + Math.random() * 200,
				ease: 'Sine.easeOut',
				onComplete: () => speck.destroy(),
			});
		}
		this.floatText(x, y - 16, p.action === 'water' ? 'Watered!' : p.action === 'dig' ? 'Soil bed ready' : 'Cleared', '#fff7dd');
	}

	private floatText(x: number, y: number, text: string, color: string) {
		const t = this.add
			.text(x, y, text, {
				fontFamily: 'Quicksand, sans-serif', fontSize: '13px', color, fontStyle: 'bold',
				stroke: '#2b3321', strokeThickness: 3,
			})
			.setOrigin(0.5)
			.setDepth(7000);
		this.tweens.add({ targets: t, y: y - 26, alpha: 0, duration: 1100, ease: 'Sine.easeOut', onComplete: () => t.destroy() });
	}

	private drawPlacements() {
		const s = bridge.shared.state;
		if (!s) return;
		for (const p of s.placements) {
			if (p.area !== this.area) continue;
			const def = this.objectDef(p.objectId);
			if (!def) continue;
			const x = p.x * TILE + 16;
			const y = p.y * TILE + 16;
			const tall = ['tree', 'deadwood', 'perch', 'platform', 'willow', 'oak', 'pine'].includes(def.shape || '');
			this.addDyn(this.add.image(x, y + (tall ? 22 : 10), 'shadow').setDepth(3).setScale(tall ? 1.0 : 1.2, 0.9));

			// freshly planted things start as a sprout and grow in
			const growMs = (def.growSeconds || 0) * 1000;
			const age = p.plantedAt ? Date.now() - p.plantedAt : Infinity;
			const stillGrowing = growMs > 0 && age < growMs;
			// fall back to the generic kit sprite if this object's shape texture is
			// missing (e.g. data with a newer shape than the loaded client), so a
			// placed item never renders as a blank/black missing-texture square
			const shapeKey = `obj-${def.shape || 'kit'}`;
			const objKey = this.textures.exists(shapeKey) ? shapeKey : 'obj-kit';
			const img = this.addDyn(
				this.add.image(x, y, stillGrowing ? 'sprout' : objKey).setDepth(y)
			);
			if (stillGrowing) {
				this.time.delayedCall(growMs - age + 300, () => {
					if (!this.alive) return;
					this.refreshDynamic();
					// the plant is now mature habitat — re-check who can return
					bridge.emit('plant-matured', this.area);
				});
			}

			// Camp fixtures stay crisp and identical; everything the player crafts
			// and places gets a little deterministic character seeded from its
			// placement id, so no two crafted items look exactly alike.
			const isFixture = def.isChest || ['workbench', 'field-journal-stand', 'bed'].includes(p.objectId);
			const growScale = stillGrowing ? 1 + (age / growMs) * 0.6 : 1;
			if (isFixture) {
				img.setScale(growScale);
			} else {
				const vr = mulberry32(hashStr(p.id));
				img.setFlipX(vr() < 0.5);
				img.setRotation((vr() - 0.5) * 0.12); // ±~3.5° lean
				img.setScale(growScale * (0.9 + vr() * 0.2)); // 0.9–1.1 size
				const shade = 0.82 + vr() * 0.18; // 0.82–1.0 brightness
				const v = Math.round(255 * shade);
				img.setTint((v << 16) | (v << 8) | v);
			}

			img.setInteractive({ useHandCursor: true });
			const hasPrimaryAction = isFixture;
			img.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
				if (this.placementObjectId || this.movingPlacementId) return;
				// shovel digs planted things back up — materials are refunded
				if (this.terraformAction() === 'dig' && def.plantable && p.plantedAt) {
					const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y);
					if (dist <= 110) bridge.emit('dig-up', { placementId: p.id, name: def.name });
					else bridge.emit('toast', { text: 'Walk a little closer first.', kind: 'info' });
					return;
				}
				if (this.terraformAction()) return;
				if (pointer.event && (pointer.event as MouseEvent).shiftKey) {
					bridge.emit('remove-placement', { placementId: p.id, objectId: p.objectId, name: def.name });
					return;
				}
				if (!hasPrimaryAction) {
					const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y);
					if (dist <= 110) bridge.emit('placement-clicked', { placementId: p.id, objectId: p.objectId, name: def.name, plantedAt: p.plantedAt });
					else bridge.emit('toast', { text: 'Walk a little closer first.', kind: 'info' });
				}
			});

			if (def.isChest) {
				this.registerInteractable({ x, y, label: `Open ${def.name}`, action: () => bridge.emit('open-chest', { chestId: p.id }) }, img);
			} else if (p.objectId === 'workbench') {
				this.registerInteractable({ x, y, label: 'Craft at the workbench', action: () => bridge.emit('open-workbench') }, img);
			} else if (p.objectId === 'field-journal-stand') {
				this.registerInteractable({ x, y, label: 'Read your field journal', action: () => bridge.emit('open-journal') }, img);
			} else if (p.objectId === 'bed') {
				this.registerInteractable({ x, y, label: 'Rest a moment', action: () => bridge.emit('toast', { text: 'You take a quiet breath. The preserve is in good hands.', kind: 'info' }) }, img);
			}
		}
	}

	private drawAnimals() {
		const s = bridge.shared.state;
		const d = bridge.shared.data;
		if (!s || !d) return;
		const rng = mulberry32(hashStr(`${this.area}-animals-${s.discoveries.length}`));
		const here = s.discoveries.filter((disc) => disc.biomeId === this.area);
		const placementsHere = s.placements.filter((p) => p.area === this.area);

		let shown = 0;
		for (const disc of here) {
			if (shown >= 14) break;
			const animal = d.animals.find((a) => a.id === disc.animalId);
			if (!animal) continue;
			// low comfort = rarely seen (but never gone)
			if ((disc.comfort ?? 50) < 30 && rng() < 0.6) continue;
			shown++;

			// appear near habitat they depend on when possible
			const reqIds = Object.keys(animal.requirements?.objects || {});
			const anchors = placementsHere.filter((p) => reqIds.includes(p.objectId));
			let ax: number, ay: number;
			if (anchors.length && rng() < 0.8) {
				const a = anchors[Math.floor(rng() * anchors.length)];
				ax = a.x * TILE + 16 + (rng() - 0.5) * 90;
				ay = a.y * TILE + 16 + (rng() - 0.5) * 70;
			} else {
				ax = (2 + rng() * (OUT_W - 4)) * TILE;
				ay = (2 + rng() * (OUT_H - 4)) * TILE;
			}
			ax = Phaser.Math.Clamp(ax, TILE, this.worldW - TILE);
			ay = Phaser.Math.Clamp(ay, TILE, this.worldH - TILE);

			ensureAnimalTexture(this, animal.id, animal.kind);
			const { key, tint } = animalTexture(animal.id, animal.kind);
			if (animal.kind !== 'insect') {
				const sh = this.add.image(ax, ay + 9, 'shadow').setDepth(3).setScale(0.75, 0.7).setAlpha(0.8);
				this.animals.add(sh);
				const shadowTimer = this.time.addEvent({
					delay: 90, loop: true,
					callback: () => {
						const target = (sh as any).animal as Phaser.GameObjects.Image | undefined;
						if (target?.active && sh.active) sh.setPosition(target.x, target.y + 9);
						else if (!sh.active) shadowTimer.remove(); // stop following once the animal layer is cleared
					},
				});
				const img = this.add.image(ax, ay, key).setDepth(ay);
				this.animals.add(img);
				(sh as any).animal = img;
				this.decorateAnimal(img, animal, tint, rng);
			} else {
				const img = this.add.image(ax, ay, key).setDepth(ay);
				this.animals.add(img);
				this.decorateAnimal(img, animal, tint, rng);
			}
		}
	}

	private decorateAnimal(img: Phaser.GameObjects.Image, animal: any, tint: number | null, rng: () => number) {
		if (tint) img.setTint(tint);
		// proportional size per species (bear ≫ chipmunk ≫ salamander), with a
		// touch of per-animal jitter so individuals still vary
		const scale = animalScale(animal.id, animal.kind);
		img.setScale(scale);
		img.setInteractive({ useHandCursor: true });
		img.on('pointerdown', () => bridge.emit('animal-clicked', { animalId: animal.id }));
		// gentle breathing — everything in the preserve feels alive (keeps its base size)
		this.tweens.add({
			targets: img, scaleY: { from: scale, to: scale * 0.94 },
			duration: 650 + rng() * 450, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
		});
		this.wander(img, img.x, img.y, animal.kind, rng);
	}

	/** Drifting leaves for a little ambient life outdoors. */
	private startLeaves() {
		this.time.addEvent({
			delay: 2800,
			loop: true,
			callback: () => {
				if (!this.alive) return;
				const x = Math.random() * this.worldW;
				const leaf = this.add.image(x, -8, 'leaf-fall').setDepth(4000).setAlpha(0.85);
				this.tweens.add({
					targets: leaf,
					y: this.worldH + 12,
					x: x + 60 + Math.random() * 120,
					angle: 200 + Math.random() * 240,
					duration: 9000 + Math.random() * 6000,
					ease: 'Sine.easeInOut',
					onComplete: () => leaf.destroy(),
				});
			},
		});
	}

	private wander(img: Phaser.GameObjects.Image, homeX: number, homeY: number, kind: string, rng: () => number) {
		const roam = kind === 'bird' || kind === 'insect' ? 130 : 80;
		const speed = kind === 'insect' ? 26 : kind === 'bird' ? 42 : 18;
		const hop = () => {
			if (!img.active) return;
			const tx = Phaser.Math.Clamp(homeX + (rng() - 0.5) * roam * 2, TILE, this.worldW - TILE);
			const ty = Phaser.Math.Clamp(homeY + (rng() - 0.5) * roam * 1.4, TILE, this.worldH - TILE);
			const dist = Phaser.Math.Distance.Between(img.x, img.y, tx, ty);
			img.setFlipX(tx < img.x);
			this.tweens.add({
				targets: img, x: tx, y: ty,
				duration: Math.max(600, (dist / speed) * 1000),
				ease: 'Sine.easeInOut',
				onUpdate: () => img.setDepth(img.y),
				onComplete: () => {
					if (img.active) this.time.delayedCall(800 + rng() * 3500, hop);
				},
			});
		};
		this.time.delayedCall(rng() * 1200, hop);
	}

	// ------------------------------------------------------ placement mode

	private enterPlacement(objectId: string) {
		this.exitPlacement();
		this.placementObjectId = objectId;
		const def = this.objectDef(objectId);
		const ghost = this.add.container(0, 0).setDepth(5000).setAlpha(0.8);
		const frame = this.add.image(0, 0, 'ghost-ok');
		const pk = `obj-${def?.shape || 'kit'}`;
		const preview = this.add.image(0, 0, this.textures.exists(pk) ? pk : 'obj-kit').setAlpha(0.75);
		ghost.add([frame, preview]);
		(ghost as any).frame = frame;
		this.ghost = ghost;
	}

	/** Pick an existing placement up onto the cursor and drop it somewhere new. */
	private enterMove(placementId: string) {
		this.exitPlacement();
		const placement = bridge.shared.state?.placements.find((p) => p.id === placementId);
		if (!placement) return;
		this.movingPlacementId = placementId;
		const def = this.objectDef(placement.objectId);
		const ghost = this.add.container(0, 0).setDepth(5000).setAlpha(0.85);
		const frame = this.add.image(0, 0, 'ghost-ok');
		const pk = `obj-${def?.shape || 'kit'}`;
		const preview = this.add.image(0, 0, this.textures.exists(pk) ? pk : 'obj-kit').setAlpha(0.8);
		ghost.add([frame, preview]);
		(ghost as any).frame = frame;
		this.ghost = ghost;
	}

	private exitPlacement() {
		this.placementObjectId = null;
		this.movingPlacementId = null;
		this.ghost?.destroy();
		this.ghost = null;
	}

	private canPlaceAt(tx: number, ty: number, forTerraform = false, ignoreId?: string): boolean {
		if (tx < 1 || ty < 1 || tx >= OUT_W - 1 || ty >= OUT_H - 1) return false;
		if (this.area === 'meadow' && tx >= 6 && tx <= 8 && ty >= 4 && ty <= 5) return false; // tent + campfire tiles
		const s = bridge.shared.state;
		if (s?.placements.some((p) => p.id !== ignoreId && p.area === this.area && p.x === tx && p.y === ty)) return false;
		// note: resource nodes never block building — if you build on a regen spot,
		// the node relocates itself (see computeNodes)
		// water tiles only accept bridges (terraform clicks are exempt — the can/shovel work on water)
		if (!forTerraform && this.waterTiles.has(`${tx},${ty}`)) {
			const activeId = this.movingPlacementId
				? bridge.shared.state?.placements.find((p) => p.id === this.movingPlacementId)?.objectId
				: this.placementObjectId;
			return !!(activeId && this.objectDef(activeId)?.bridge);
		}
		return true;
	}

	// --------------------------------------------------------------- update

	update(_time: number, delta: number) {
		const dt = delta / 1000;
		this.handleMovement(dt);
		this.playerShadow.setPosition(this.player.x, this.player.y + 15);
		this.handleGhost();
		this.handleInteraction();
		this.syncPosition(dt);
	}

	private handleMovement(dt: number) {
		const k = this.keys;
		let vx = 0, vy = 0;
		if (k.A.isDown || k.LEFT.isDown) vx -= 1;
		if (k.D.isDown || k.RIGHT.isDown) vx += 1;
		if (k.W.isDown || k.UP.isDown) vy -= 1;
		if (k.S.isDown || k.DOWN.isDown) vy += 1;
		// virtual joystick (mobile)
		const joy = bridge.shared.joy;
		if (vx === 0 && vy === 0 && (Math.abs(joy.x) > 0.15 || Math.abs(joy.y) > 0.15)) {
			vx = joy.x;
			vy = joy.y;
		}
		if (vx === 0 && vy === 0) {
			// settle back upright when standing still
			this.player.setRotation(this.player.rotation * 0.8);
			return;
		}
		this.walkT += dt * 11;
		this.player.setRotation(Math.sin(this.walkT) * 0.075); // cozy waddle
		const len = Math.hypot(vx, vy);
		const speed = 160;
		let nx = this.player.x + (vx / len) * speed * dt;
		let ny = this.player.y + (vy / len) * speed * dt;

		nx = Phaser.Math.Clamp(nx, 18, this.worldW - 18);
		ny = Phaser.Math.Clamp(ny, 20, this.worldH - 18);

		if (vx !== 0) this.player.setFlipX(vx < 0);

		// open water blocks walking — unless a bridge spans that tile
		const blocked = (px: number, py: number) => {
			const key = `${Math.floor(px / TILE)},${Math.floor((py + 8) / TILE)}`;
			return this.waterTiles.has(key) && !this.bridgeTiles.has(key);
		};
		// If we're already standing in open water (e.g. a bed was flooded
		// underfoot), don't trap the player — let them walk straight back out.
		const alreadyInWater = blocked(this.player.x, this.player.y);
		if (!alreadyInWater && blocked(nx, ny)) {
			if (!blocked(nx, this.player.y)) ny = this.player.y; // slide along the bank
			else if (!blocked(this.player.x, ny)) nx = this.player.x;
			else {
				nx = this.player.x;
				ny = this.player.y;
			}
		}

		this.player.setPosition(nx, ny);
		this.player.setDepth(ny + 16);
	}

	private handleGhost() {
		if (!this.ghost || (!this.placementObjectId && !this.movingPlacementId)) return;
		const pointer = this.input.activePointer;
		const tx = Math.floor(pointer.worldX / TILE);
		const ty = Math.floor(pointer.worldY / TILE);
		this.ghost.setPosition(tx * TILE + 16, ty * TILE + 16);
		const ok = this.canPlaceAt(tx, ty, false, this.movingPlacementId || undefined);
		((this.ghost as any).frame as Phaser.GameObjects.Image).setTexture(ok ? 'ghost-ok' : 'ghost-bad');
	}

	private nearestInteractable(): Interactable | null {
		let best: Interactable | null = null;
		let bestDist = 68; // generous reach so E grabs what you're clearly standing beside
		for (const it of this.interactables) {
			const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, it.x, it.y);
			if (d < bestDist) {
				best = it;
				bestDist = d;
			}
		}
		return best;
	}

	private handleInteraction() {
		const terraforming = this.terraformAction();
		const busy = this.placementObjectId || this.movingPlacementId;
		// E/Space interactions stay available while terraforming — only clicks shape
		// the ground, so holding the shovel/can no longer locks you out of chests and beds
		const near = busy ? null : this.nearestInteractable();

		// pulsing highlight on whatever you can interact with right now
		if (near) {
			this.highlight.setVisible(true).setPosition(near.x, near.y + 2);
		} else {
			this.highlight.setVisible(false);
		}

		// terraform tile cursor under the pointer
		if (terraforming) {
			const pointer = this.input.activePointer;
			const tx = Math.floor(pointer.worldX / TILE);
			const ty = Math.floor(pointer.worldY / TILE);
			const ok = this.tileReachable(tx, ty);
			this.tileCursor.setVisible(true).setPosition(tx * TILE + 16, ty * TILE + 16).setTexture(ok ? 'ghost-ok' : 'ghost-bad');
		} else {
			this.tileCursor.setVisible(false);
		}

		const verb = this.isTouch ? 'Tap' : 'E';
		const prompt = this.movingPlacementId
			? `${this.isTouch ? 'Tap' : 'Click'} a tile to move it there${this.isTouch ? '' : ' · Esc to cancel'}`
			: this.placementObjectId
			? `${this.isTouch ? 'Tap' : 'Click'} a tile to place${this.isTouch ? '' : ' · Esc to stop placing'}`
			: terraforming
				? (terraforming === 'dig'
					? `Shovel out: ${this.isTouch ? 'tap' : 'click'} nearby ground to dig a soil bed · dig a shaped tile again to clear or drain it`
					: `Watering can out: water a soil bed to ready it for planting (1 water) · water again to flood into open water (1 water)`)
					+ (near ? ` · ${verb} — ${near.label}` : '')
				: near
					? `${verb} — ${near.label}`
					: '';
		if (prompt !== this.lastPrompt) {
			this.lastPrompt = prompt;
			bridge.emit('prompt', prompt);
		}
		if (near && (Phaser.Input.Keyboard.JustDown(this.keys.E) || Phaser.Input.Keyboard.JustDown(this.keys.SPACE))) {
			near.action();
		}
	}

	private syncPosition(dt: number) {
		this.moveAccum += dt;
		if (this.moveAccum < 3) return;
		this.moveAccum = 0;
		const tx = this.player.x / TILE;
		const ty = this.player.y / TILE;
		if (Math.abs(tx - this.lastSynced.x) > 0.5 || Math.abs(ty - this.lastSynced.y) > 0.5) {
			this.lastSynced = { x: tx, y: ty };
			bridge.emit('player-moved', { x: tx, y: ty });
		}
	}
}
