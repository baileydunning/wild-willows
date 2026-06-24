import Phaser from 'phaser';
import { bridge } from './bridge';
import { canPaintClick } from './interactions';
import {
	animalScale, animalTexture, ensureAnimalTexture, makeAnimalTextures, makeBaseTextures, makeNodeTextures,
	makeObjectTextures, makePlayerTexture,
} from './textures';
import { seasonStyle, weatherType, liveWeatherType, gatherResourceFor } from '../weather';
import type { BiomeDef, HabitatObjectDef } from '../types';

export const TILE = 32;
const OUT_W = 30;
const OUT_H = 20;
const MTN_ROWS = 4; // rows reserved for the alpine mountain range (impassable)
const COAST_COLS = 4; // columns reserved for the ocean along Pelican Shore's east edge (impassable)

// your base camp: tent + campfire scenery beside the permanent workbench & chest
const CAMP = { tent: { x: 6.5, y: 4.2 }, fire: { x: 7.6, y: 5.1 } };
// right in front of the tent door — where you land when you step back out of the home
const CAMP_TENT_FRONT = { x: CAMP.tent.x, y: CAMP.tent.y + 1.8 };
const CAMP_BLOCK = { x0: 5.5, y0: 3.2, x1: 9.9, y1: 5.9 }; // keep nodes/placements clear of camp

// spawn points when arriving in an area from another
const SPAWNS: Record<string, { x: number; y: number }> = {
	// stepping back out of the home → stand right in front of the camp tent door
	'meadow:from-home': { x: CAMP_TENT_FRONT.x, y: CAMP_TENT_FRONT.y },
	// arriving from the west neighbour → enter at the west edge; from the east → east edge
	'meadow:from-forest': { x: 27.8, y: 10.0 },
	'forest:from-meadow': { x: 1.8, y: 10.0 },
	'forest:from-wetland': { x: 27.8, y: 10.0 },
	'wetland:from-forest': { x: 1.8, y: 10.0 },
	'wetland:from-desert': { x: 27.8, y: 10.0 },
	'desert:from-wetland': { x: 1.8, y: 10.0 },
	// alpine grows downward by MTN_ROWS (4), so its edge gates sit ~4 rows lower
	'desert:from-alpine': { x: 27.8, y: 10.0 },
	'alpine:from-desert': { x: 1.8, y: 13.8 },
	'alpine:from-coastal': { x: 27.8, y: 13.8 },
	'coastal:from-alpine': { x: 1.8, y: 10.0 },
	default: { x: 15, y: 11 },
};

const C = (hex: string) => Phaser.Display.Color.HexStringToColor(hex).color;

// Has any weather been shown yet this session? The first weather you see is
// allowed to "start up" (rain/snow building from the top); every biome you
// transfer into afterwards should already be mid-storm, so we pre-warm the
// emitter on entry. Module-scoped so it survives scene.restart().
let weatherShownThisSession = false;

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
	private sleeping = false;
	private ghost: Phaser.GameObjects.Container | null = null;
	private moveAccum = 0;
	private lastSynced = { x: 0, y: 0 };
	private activeTool = 'basket';
	private highlight!: Phaser.GameObjects.Container;
	private tileCursor!: Phaser.GameObjects.Image;
	private isTouch = false;
	private alive = false; // true between create() and shutdown (scene.isActive() is false DURING create)
	private waterTiles = new Set<string>();
	private waterTileCenters: { x: number; y: number }[] = []; // pixel centers of open-water tiles
	private bridgeTiles = new Set<string>();
	// Live co-op: other players in this same area, drawn as their own avatars and
	// smoothly eased toward the positions reported by the presence loop.
	private remotes = new Map<string, { sprite: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text; sig: string; walkT: number; lastX: number; lastY: number; moveUntil: number }>();
	// Weather visuals: a camera-locked full-screen weather-colour tint and a
	// world-locked rain/snow particle emitter, swapped when the weather changes.
	private weatherOverlay?: Phaser.GameObjects.Rectangle;
	private weatherEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
	private weatherSig = '';

	constructor() {
		super('world');
	}

	init(data: any) {
		this.area = data?.area || bridge.shared.state?.player.area || 'meadow';
	}

	private get isHome() {
		return this.area === 'home';
	}

	/** Interior floor rectangle (tile coords) + cosmetics for the current home config. */
	private homeRoom() {
		const home = bridge.shared.state?.player?.home || ({ style: 'cabin', space: 1, comfort: 1, decor: 1, light: 1 } as any);
		const data = bridge.shared.data;
		const styles = data?.homeStyles || {};
		const style = styles[home.style] || styles.cabin || { floor: '#c9a373', wall: '#9c7a52', accent: '#b5707a' };
		const spaceLevels = data?.homeTracks?.space?.levels || [];
		const inner = spaceLevels[(home.space || 1) - 1]?.inner || { w: 8, h: 6 };
		const x0 = Math.floor((OUT_W - inner.w) / 2);
		const y0 = Math.floor((OUT_H - inner.h) / 2);
		const x1 = x0 + inner.w - 1, y1 = y0 + inner.h - 1;
		const colors = home.colors || {};
		return {
			x0, y0, x1, y1,
			floor: colors.floor || style.floor,
			wall: colors.wall || style.wall,
			accent: colors.accent || style.accent,
			rug: colors.rug || colors.accent || style.accent,
			decor: home.decor || 1, light: home.light || 1,
			doorX: Math.round((x0 + x1) / 2), doorY: y1,
		};
	}

	private get worldW() {
		return OUT_W * TILE;
	}
	private get worldH() {
		return this.rows * TILE;
	}
	// Graywind Heights reserves a band of rows at the top for an impassable
	// mountain range. The area grows downward by the same amount so the playable
	// region stays the same size as every other biome.
	private get mtnRows() {
		return this.area === 'alpine' ? MTN_ROWS : 0;
	}
	private get playTop() {
		return this.mtnRows;
	}
	// Pelican Shore reserves a band of columns on the east for the open ocean
	// (impassable). landRight is the first ocean column — playable land is
	// columns 1..landRight-1.
	private get landRight() {
		return this.area === 'coastal' ? OUT_W - COAST_COLS : OUT_W;
	}
	private get rows() {
		return OUT_H + this.mtnRows;
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
		// scene.restart() reuses this instance, so stale (now-destroyed) weather
		// overlay/emitter references must be cleared before they're recreated.
		this.weatherOverlay = undefined;
		this.weatherEmitter = undefined;
		this.weatherSig = '';
		makeBaseTextures(this);
		makeObjectTextures(this);
		makeAnimalTextures(this);
		makeNodeTextures(this);
		this.isTouch = this.sys.game.device.input.touch && !this.sys.game.device.os.desktop;

		this.cameras.main.setBounds(0, 0, this.worldW, this.worldH);
		this.cameras.main.setBackgroundColor('#26301f');
		this.applyZoom();
		this.scale.on('resize', () => this.applyZoom());

		// groups must exist before drawGround(): the home room is now drawn into the
		// dynamic group so it can be repainted live when you use the paint tool.
		this.dynamic = this.add.group();
		this.animals = this.add.group();

		this.drawGround();
		const playerKey = makePlayerTexture(this, bridge.shared.state?.player.appearance);
		this.playerShadow = this.add.image(0, 0, 'shadow').setDepth(2);
		this.player = this.add.image(0, 0, playerKey).setDepth(1000);
		let spawn = data?.spawn || this.savedSpawn();
		// stepping into the home: stand just inside the door
		if (this.isHome) { const r = this.homeRoom(); spawn = { x: r.doorX + 0.5, y: r.doorY + 0.2 }; }
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

		this.unsubs.push(bridge.on('world-dirty', () => { this.refreshDynamic(); this.updateNodeVisuals(); this.applyWeather(); }));
		this.unsubs.push(bridge.on('enter-placement', (p: any) => this.enterPlacement(p.objectId)));
		this.unsubs.push(bridge.on('cancel-placement', () => this.exitPlacement()));
		this.unsubs.push(bridge.on('enter-move', (p: any) => this.enterMove(p.placementId)));
		this.unsubs.push(
			bridge.on('appearance-changed', (appearance: any) => {
				if (this.alive) this.player.setTexture(makePlayerTexture(this, appearance));
			})
		);
		this.unsubs.push(bridge.on('home-upgraded', () => this.playBuild()));
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
			this.clearRemotes();
			this.unsubs.forEach((u) => u());
			this.unsubs = [];
		});

		this.time.addEvent({ delay: 4000, loop: true, callback: () => this.updateNodeVisuals() });
		// Paint weather now (entering = pre-fill so a storm you walk into is already
		// going), then keep it fresh as the weather rolls over every ~10 min.
		this.applyWeather(true);
		this.time.addEvent({ delay: 5000, loop: true, callback: () => this.applyWeather() });
		this.input.on('pointerdown', (pointer: Phaser.Input.Pointer, over: any[]) => {
			const tx = Math.floor(pointer.worldX / TILE);
			const ty = Math.floor(pointer.worldY / TILE);
			// paint tool (indoors): recolor whatever you click — an item, the rug,
			// the walls, or the floor underneath. While placing or moving an object,
			// a click means "drop it here", so placement/move (below) take priority.
			if (canPaintClick({ tool: this.activeTool, isHome: this.isHome, placing: !!this.placementObjectId, moving: !!this.movingPlacementId })) {
				const hit = (bridge.shared.state?.placements || []).find((p) => p.area === 'home' && p.x === tx && p.y === ty);
				if (hit) { bridge.emit('paint-click', { placementId: hit.id }); return; }
				const r = this.homeRoom();
				const inFloor = tx >= r.x0 && tx <= r.x1 && ty >= r.y0 && ty <= r.y1;
				const inRing = tx >= r.x0 - 1 && tx <= r.x1 + 1 && ty >= r.y0 - 1 && ty <= r.y1 + 1;
				if (!inFloor && inRing) { bridge.emit('paint-click', { target: 'wall' }); return; }
				if (inFloor) {
					// rug hit-test mirrors how drawHomeRoom lays the centre rug out
					const fx = r.x0 * TILE, fy = r.y0 * TILE;
					const fw = (r.x1 - r.x0 + 1) * TILE, fh = (r.y1 - r.y0 + 1) * TILE;
					const rugW = Math.min(fw - TILE * 2, TILE * (3 + r.decor));
					const rugH = Math.min(fh - TILE * 2, TILE * (2 + r.decor * 0.5));
					const cx = fx + fw / 2, cy = fy + fh / 2;
					const onRug = r.decor >= 2 &&
						Math.abs(pointer.worldX - cx) <= rugW / 2 && Math.abs(pointer.worldY - cy) <= rugH / 2;
					bridge.emit('paint-click', onRug ? { target: 'rug' } : { target: 'floor' });
				}
				return;
			}
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
			const y = Phaser.Math.Clamp(p.y, this.playTop + 1, this.worldH / TILE - 1);
			return { x, y };
		}
		return SPAWNS.default;
	}

	// ------------------------------------------------------------- ground

	private drawGround() {
		this.groundTiles = [];
		if (this.isHome) { this.drawHomeRoom(); return; }
		const rng = mulberry32(hashStr(this.area));
		// Ground tiles fill only the playable region; in the alpine the top rows
		// are the mountain range, drawn separately below.
		for (let ty = this.playTop; ty < this.rows; ty++) {
			for (let tx = 0; tx < this.landRight; tx++) {
				const img = this.add.image(tx * TILE + 16, ty * TILE + 16, 'tile').setDepth(0);
				(img as any).shade = 0.92 + rng() * 0.08;
				this.groundTiles.push(img);
			}
		}
		if (this.mtnRows > 0) this.drawMountainBand();
		if (this.area === 'coastal') this.drawCoastBand();
		this.tintGround();
	}

	/** The home interior: a cozy room of floor + walls with a door, sized by tier. */
	private drawHomeRoom() {
		const r = this.homeRoom();
		// dark surround outside the room
		this.addDyn(this.add.rectangle(0, 0, this.worldW, this.worldH, C('#1c2216')).setOrigin(0, 0).setDepth(0));
		// wall ring (one tile thick around the floor)
		const wx = (r.x0 - 1) * TILE, wy = (r.y0 - 1) * TILE;
		const ww = (r.x1 - r.x0 + 3) * TILE, wh = (r.y1 - r.y0 + 3) * TILE;
		this.addDyn(this.add.rectangle(wx, wy, ww, wh, C(r.wall)).setOrigin(0, 0).setDepth(0.1));
		this.addDyn(this.add.rectangle(wx, wy, ww, TILE, 0x000000, 0.18).setOrigin(0, 0).setDepth(0.12)); // back-wall shadow
		// floor
		const fx = r.x0 * TILE, fy = r.y0 * TILE;
		const fw = (r.x1 - r.x0 + 1) * TILE, fh = (r.y1 - r.y0 + 1) * TILE;
		this.addDyn(this.add.rectangle(fx, fy, fw, fh, C(r.floor)).setOrigin(0, 0).setDepth(0.2));
		// faint plank grid
		for (let gx = r.x0; gx <= r.x1 + 1; gx++) this.addDyn(this.add.rectangle(gx * TILE, fy, 1, fh, 0x000000, 0.06).setOrigin(0, 0).setDepth(0.21));
		for (let gy = r.y0; gy <= r.y1 + 1; gy++) this.addDyn(this.add.rectangle(fx, gy * TILE, fw, 1, 0x000000, 0.06).setOrigin(0, 0).setDepth(0.21));

		// Furnishings track: a wall trim line + a centre rug that gets finer per level
		if (r.decor >= 1) {
			this.addDyn(this.add.rectangle(wx, wy + TILE - 2, ww, 3, C(r.accent), 0.5).setOrigin(0, 0).setDepth(0.13));
		}
		if (r.decor >= 2) {
			const rugW = Math.min(fw - TILE * 2, TILE * (3 + r.decor));
			const rugH = Math.min(fh - TILE * 2, TILE * (2 + r.decor * 0.5));
			const cx = fx + fw / 2, cy = fy + fh / 2;
			this.addDyn(this.add.rectangle(cx, cy, rugW, rugH, C(r.rug), 0.8).setDepth(0.22));
			this.addDyn(this.add.rectangle(cx, cy, rugW - 10, rugH - 10, C(r.floor), 0.35).setDepth(0.221));
			if (r.decor >= 3) this.addDyn(this.add.rectangle(cx, cy, rugW - 22, rugH - 22, C(r.rug), 0.6).setDepth(0.222));
		}

		// Warmth track: windows along the back wall + a soft hearth glow
		if (r.light >= 2) {
			const windows = r.light; // 2 → two windows, 3 → three, 4 → four
			for (let i = 0; i < windows; i++) {
				const wxp = fx + fw * ((i + 1) / (windows + 1));
				this.addDyn(this.add.rectangle(wxp, wy + TILE / 2, TILE * 0.7, TILE * 0.6, C('#cfe6f2'), 0.85).setDepth(0.14));
				this.addDyn(this.add.rectangle(wxp, wy + TILE / 2, TILE * 0.7, TILE * 0.6).setStrokeStyle(2, C('#000000'), 0.25).setDepth(0.141));
			}
		}
		if (r.light >= 3) {
			const glow = this.addDyn(this.add.image(fx + TILE, fy + fh - TILE, 'glow').setTint(0xffcf80).setDepth(0.23).setScale(1.6).setAlpha(0.5));
			glow.setBlendMode(Phaser.BlendModes.ADD);
			this.tweens.add({ targets: glow, alpha: { from: 0.5, to: 0.32 }, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
		}

		// door on the bottom wall, with a welcome mat just inside it
		const dpx = r.doorX * TILE + 16;
		this.addDyn(this.add.rectangle(dpx, (r.y1 + 1) * TILE + 16, TILE * 0.82, TILE * 1.1, C('#33251a')).setDepth(0.3));
		this.addDyn(this.add.rectangle(dpx, (r.y1 + 1) * TILE + 14, TILE * 0.6, TILE * 0.92, C('#5a3f28')).setDepth(0.31));
		this.addDyn(this.add.rectangle(dpx, r.doorY * TILE + 16, TILE * 0.95, TILE * 0.55, C(r.accent)).setDepth(0.25).setAlpha(0.7));
	}

	/** Refresh the home interior: just your placed decor + the exit door. */
	private refreshHome() {
		this.waterTiles = new Set();
		this.waterTileCenters = [];
		this.bridgeTiles = new Set();
		this.drawHomeRoom(); // repaint floor/walls/rug so live recolors show immediately
		this.drawPlacements();
		const r = this.homeRoom();
		// the door back out, bottom-center (the upgrade sign lives outside, by the tent)
		this.registerInteractable({
			x: r.doorX * TILE + 16,
			y: r.doorY * TILE + 16,
			label: 'Step back outside (E)',
			action: () => bridge.emit('request-area', { area: 'meadow' }),
		});
	}

	/** Static, impassable open ocean down the east edge of Pelican Shore. */
	private drawCoastBand() {
		const edgeX = this.landRight * TILE; // where land meets the surf
		const h = this.worldH;
		// deep sea fills the reserved columns out to the world edge
		this.add.rectangle(edgeX, 0, this.worldW - edgeX, h, C('#2f6f9e')).setOrigin(0, 0).setDepth(0.1);
		// banded water: a lighter shallow strip near shore, deeper blue beyond
		this.add.rectangle(edgeX, 0, TILE * 1.6, h, C('#5aa6cf')).setOrigin(0, 0).setDepth(0.12);
		this.add.rectangle(edgeX + TILE * 1.6, 0, TILE * 1.3, h, C('#3f8cbb')).setOrigin(0, 0).setDepth(0.12);
		// a damp-sand tideline where the beach gives way to water
		this.add.rectangle(edgeX - 6, 0, 12, h, C('#bda572')).setOrigin(0, 0).setDepth(0.13).setAlpha(0.7);
		// rolling foam lines that breathe in and out along the shore
		for (let i = 0; i < 7; i++) {
			const y = (i + 0.5) * (h / 7);
			const foam = this.add.ellipse(edgeX + 4, y, TILE * 1.5, 10, 0xffffff, 0.5).setDepth(0.14);
			this.tweens.add({
				targets: foam, x: edgeX + 4 + TILE * 0.6, alpha: { from: 0.5, to: 0.15 },
				duration: 1800 + i * 160, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
			});
			// sun-glints further out
			const glint = this.add.ellipse(edgeX + TILE * (2 + (i % 2)), y - 14, 9, 4, 0xffffff, 0.4).setDepth(0.14);
			this.tweens.add({ targets: glint, alpha: { from: 0.4, to: 0.05 }, duration: 1300 + i * 130, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
		}
		// a couple of half-buried rocks at the waterline for texture
		const rng = mulberry32(hashStr('coast-rocks'));
		for (let i = 0; i < 5; i++) {
			const ry = (1 + rng() * (OUT_H - 2)) * TILE;
			this.add.ellipse(edgeX - 4 + rng() * 6, ry, 16 + rng() * 10, 10, C('#7d7a72')).setDepth(0.15);
		}
	}

	/** Static, impassable snow-capped range across the top of Graywind Heights. */
	private drawMountainBand() {
		const bandH = this.playTop * TILE;
		// pale sky behind the peaks so gaps above the ridge don't show the void
		this.add.rectangle(0, 0, this.worldW, bandH, Phaser.Display.Color.HexStringToColor('#aeb9c9').color)
			.setOrigin(0, 0).setDepth(0.1);
		// the ridge silhouette, tiled across the full width, sitting on the band base
		const ridgeW = 420, ridgeH = 150;
		const y = bandH - ridgeH + 6; // anchor peaks so their base meets the ground line
		for (let x = -20; x < this.worldW + ridgeW; x += ridgeW) {
			this.add.image(x, y, 'mtnridge').setOrigin(0, 0).setDepth(0.2);
		}
		// soft snowline where the rock meets the meadow
		this.add.rectangle(0, bandH - 3, this.worldW, 6, 0xffffff, 0.25).setOrigin(0, 0).setDepth(0.25);
	}

	private tintGround() {
		if (this.isHome) return; // the home has its own floor, not a biome ground tint
		const biome = this.biomeDef();
		const state = bridge.shared.state?.biomeStates.find((b) => b.biomeId === this.area);
		const health = state?.health ?? 5;
		const from = Phaser.Display.Color.HexStringToColor(biome?.palette.damaged || '#b9a37c');
		const to = Phaser.Display.Color.HexStringToColor(biome?.palette.healthy || '#8fbf6f');
		const t = Phaser.Math.Clamp(health / 100, 0, 1);
		const mix = Phaser.Display.Color.Interpolate.ColorWithColor(from, to, 100, Math.round(t * 100));
		// Lerp the health colour toward the season's tint so spring greens, autumn
		// ambers and winter pales read at a glance. Amount is per-season (winter
		// shifts most). seasonStyle falls back safely if the snapshot is absent.
		let baseR = mix.r, baseG = mix.g, baseB = mix.b;
		const season = bridge.shared.state?.weather?.season;
		if (season) {
			const ss = seasonStyle(season);
			const tintC = Phaser.Display.Color.HexStringToColor(ss.tint);
			const amt = Phaser.Math.Clamp(ss.tintAmount, 0, 1);
			baseR += (tintC.red - baseR) * amt;
			baseG += (tintC.green - baseG) * amt;
			baseB += (tintC.blue - baseB) * amt;
		}
		for (const img of this.groundTiles) {
			const s = (img as any).shade ?? 1;
			const color = Phaser.Display.Color.GetColor(baseR * s, baseG * s, baseB * s);
			img.setTint(color);
		}
	}

	// ------------------------------------------------- weather visuals

	/**
	 * Apply the current weather to the scene: a weather-colour tint plus rain/snow
	 * particles (outdoors only). The weather is a deterministic per-block roll that
	 * turns over every ~10 minutes; this diffs against weatherSig and only rebuilds
	 * the overlay/particles when the type actually changes. No day/night lighting —
	 * the only thing that changes is the weather itself.
	 */
	private get worldId(): string | null {
		const s = bridge.shared.state;
		return (s as any)?.worldId || s?.player?.id || null;
	}

	/** The current weather type for this area (rolls over every ~10 min). */
	private currentWeatherType(): string {
		if (this.isHome) return 'clear';
		return liveWeatherType(this.worldId, this.area, bridge.shared.state?.weather);
	}

	/** `entering` = the player just walked into this biome (scene create/restart),
	 *  so pre-fill the rain/snow so it's already established — unless this is the
	 *  very first weather of the session, which is allowed to animate in. Weather
	 *  that changes while you're standing here always animates in. */
	private applyWeather(entering = false) {
		if (!this.alive) return;
		const typeId = this.currentWeatherType();
		const sig = `${typeId}|${this.isHome ? 'in' : 'out'}`;
		if (sig === this.weatherSig) return;
		this.weatherSig = sig;

		const wt = weatherType(typeId);
		this.ensureWeatherOverlay();
		if (!this.isHome && wt.overlay) {
			this.weatherOverlay!.setFillStyle(C(wt.overlay.color)).setAlpha(wt.overlay.alpha).setVisible(true);
		} else {
			this.weatherOverlay!.setVisible(false);
		}
		const prewarm = entering && weatherShownThisSession;
		this.setWeatherParticles(this.isHome ? null : wt.particle, prewarm);
		weatherShownThisSession = true;
		// Weather-gated gather nodes appear/vanish with the weather, so redraw the
		// dynamic layer whenever the type turns over.
		this.refreshDynamic();
	}

	private ensureWeatherOverlay() {
		if (this.weatherOverlay) return;
		this.weatherOverlay = this.add.rectangle(-3000, -3000, 9000, 9000, 0xffffff, 0)
			.setOrigin(0, 0).setScrollFactor(0).setDepth(5005).setVisible(false);
	}

	/** Lazily build the 1-colour rain streak and snow dot textures. */
	private ensureWeatherTextures() {
		if (!this.textures.exists('wx-rain')) {
			const g = this.make.graphics({ x: 0, y: 0 });
			g.fillStyle(0xbcd2e8, 1).fillRect(0, 0, 2, 12);
			g.generateTexture('wx-rain', 2, 12);
			g.destroy();
		}
		if (!this.textures.exists('wx-snow')) {
			const g = this.make.graphics({ x: 0, y: 0 });
			g.fillStyle(0xffffff, 1).fillCircle(3, 3, 3);
			g.generateTexture('wx-snow', 6, 6);
			g.destroy();
		}
	}

	/**
	 * Swap in (or clear) the falling-weather emitter. Particles are world-locked
	 * and emitted across the full map width so the fall looks uniform wherever the
	 * camera is; they sit above the colour tints so they stay crisp.
	 */
	private setWeatherParticles(kind: 'rain' | 'snow' | null, prewarm = false) {
		if (this.weatherEmitter) { this.weatherEmitter.destroy(); this.weatherEmitter = undefined; }
		if (!kind) return;
		this.ensureWeatherTextures();
		const w = this.worldW;
		const lifespan = kind === 'rain' ? 1700 : 13000;
		if (kind === 'rain') {
			this.weatherEmitter = this.add.particles(0, 0, 'wx-rain', {
				x: { min: -40, max: w + 40 },
				y: -20,
				lifespan,
				speedY: { min: 520, max: 700 },
				speedX: { min: -60, max: -20 },
				scaleY: { min: 0.8, max: 1.5 },
				alpha: { min: 0.25, max: 0.5 },
				quantity: 4,
				frequency: 28,
			}).setDepth(5020);
		} else {
			this.weatherEmitter = this.add.particles(0, 0, 'wx-snow', {
				x: { min: -40, max: w + 40 },
				y: -20,
				lifespan,
				speedY: { min: 45, max: 85 },
				speedX: { min: -25, max: 25 },
				scale: { min: 0.45, max: 1 },
				alpha: { min: 0.5, max: 0.9 },
				quantity: 2,
				frequency: 80,
			}).setDepth(5020);
		}
		// Pre-fill so the screen is already full of falling weather on biome entry
		// (Phaser advances the emitter as if `lifespan` ms had already elapsed).
		if (prewarm) this.weatherEmitter.fastForward(lifespan, 50);
	}

	// ------------------------------------------------- dynamic world objects

	private refreshDynamic() {
		if (!this.alive) return;
		this.dynamic.clear(true, true);
		this.nodeSprites.clear();
		this.interactables = [];
		if (this.isHome) { this.refreshHome(); return; }
		// collision lookups: open water blocks walking unless bridged
		const st = bridge.shared.state;
		this.waterTiles = new Set(
			(st?.terrain || []).filter((tt) => tt.area === this.area && tt.type === 'water').map((tt) => `${tt.x},${tt.y}`)
		);
		// pixel centers of every open-water tile — fish live here, walkers avoid it
		this.waterTileCenters = [...this.waterTiles].map((k) => {
			const [tx, ty] = k.split(',').map(Number);
			return { x: tx * TILE + 16, y: ty * TILE + 16 };
		});
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
			if (this.activeTool === 'paint' && this.isHome) return; // painting takes over clicks indoors
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
			const x = (1 + rng() * (this.landRight - 2)) * TILE;
			const y = (this.playTop + 1.4 + rng() * (this.rows - this.playTop - 2.4)) * TILE;
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
			// the camp building reflects your home: a tent until you build it, then your
			// chosen style, growing a little as Space is upgraded
			const homeC: any = state?.player?.home;
			const built = !!homeC?.styleLocked;
			const wantKey = built ? `home-${homeC.style}` : 'tent';
			const homeKey = this.textures.exists(wantKey) ? wantKey : 'tent';
			// the camp building grows gradually: a small tent, then each Space level a bit bigger
			const homeScale = built ? 1 + Math.max(0, (homeC.space || 2) - 2) * 0.1 : 0.85;
			this.addDyn(this.add.image(tx2, ty2 + 22, 'shadow').setDepth(3).setScale(2.0 * homeScale, 1.1));
			this.addDyn(this.add.image(tx2, ty2, homeKey).setDepth(ty2).setScale(homeScale));
			// step inside your home to decorate it
			this.registerInteractable({
				x: tx2, y: ty2 + 8, label: 'Step inside your home (E)',
				action: () => bridge.emit('request-area', { area: 'home' }),
			});
			// the upgrade signpost — shown only while something's left to upgrade
			const tracks = bridge.shared.data?.homeTracks as any;
			const fullyUpgraded = built && tracks &&
				['space', 'comfort', 'decor', 'light'].every((k) => (homeC[k] || 1) >= (tracks[k]?.levels.length || 1));
			if (!fullyUpgraded) {
				const sgx = (CAMP.tent.x - 1.2) * TILE, sgy = (CAMP.tent.y + 1.1) * TILE;
				this.addDyn(this.add.image(sgx, sgy + 16, 'shadow').setDepth(3).setScale(0.9, 0.7));
				this.addDyn(this.add.image(sgx, sgy, 'sign').setDepth(sgy));
				this.registerInteractable({
					x: sgx, y: sgy, label: 'Upgrade your home (E)',
					action: () => bridge.emit('open-home'),
				});
			}
			const fx = CAMP.fire.x * TILE, fy = CAMP.fire.y * TILE;
			const fireGlow = this.addDyn(this.add.image(fx, fy - 4, 'glow').setTint(0xffb84f).setDepth(fy - 1).setScale(1.3));
			(fireGlow as Phaser.GameObjects.Image).setBlendMode(Phaser.BlendModes.ADD);
			const fire = this.addDyn(this.add.image(fx, fy, 'campfire').setDepth(fy));
			this.tweens.add({ targets: [fire, fireGlow], alpha: { from: 1, to: 0.75 }, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

			const gx = (OUT_W - 1.2) * TILE;
			const gy = 9.8 * TILE;
			const forestUnlocked = state?.player.unlockedBiomes.includes('forest');
			const forestOpen = forestUnlocked && this.biomeDef('forest')?.explorable;
			this.addDyn(this.add.image(gx, gy, forestOpen ? 'gate' : 'sign').setDepth(gy));
			this.registerInteractable({
				x: gx, y: gy, label: forestOpen ? 'Walk to Old Hollow Forest' : 'Read the trail sign (Old Hollow Forest)',
				action: () => {
					if (forestOpen) bridge.emit('request-area', { area: 'forest' });
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
		} else if (this.area === 'alpine') {
			// Graywind Heights: the mountain range is drawn statically (drawGround);
			// here we just place the trail gates in the playable region below it.
			const gy = (this.playTop + 9.8) * TILE;

			// gate back to the desert on the west edge
			const gx = 1.2 * TILE;
			this.addDyn(this.add.image(gx, gy, 'gate').setDepth(gy));
			this.registerInteractable({ x: gx, y: gy, label: 'Walk back to Redstone Scrubland', action: () => bridge.emit('request-area', { area: 'desert' }) });

			// trail east toward the coast (Pelican Shore)
			const sx = (OUT_W - 1.2) * TILE;
			const coastalUnlocked = state?.player.unlockedBiomes.includes('coastal');
			const coastalExplorable = this.biomeDef('coastal')?.explorable;
			const coastalOpen = coastalUnlocked && coastalExplorable;
			this.addDyn(this.add.image(sx, gy, coastalOpen ? 'gate' : 'sign').setDepth(gy));
			this.registerInteractable({
				x: sx, y: gy, label: coastalOpen ? 'Walk to Pelican Shore' : 'Read the trail sign (Pelican Shore)',
				action: () => {
					if (coastalOpen) {
						bridge.emit('request-area', { area: 'coastal' });
						return;
					}
					const coastal = this.biomeDef('coastal');
					const text = coastalUnlocked
						? 'Pelican Shore is unlocked! Follow the trail down to the coast.'
						: `The pass down to the coast is snowed in. ${coastal?.unlock?.label || ''}`;
					bridge.emit('toast', { text, kind: 'info' });
				},
			});
		} else if (this.area === 'coastal') {
			// Pelican Shore is the last biome. The ocean runs down the whole east
			// edge (drawn statically in drawCoastBand), so there's no eastern gate —
			// only the trail back up to Graywind Heights on the west edge.
			const gx = 1.2 * TILE;
			const gy = 9.8 * TILE;
			this.addDyn(this.add.image(gx, gy, 'gate').setDepth(gy));
			this.registerInteractable({ x: gx, y: gy, label: 'Walk back up to Graywind Heights', action: () => bridge.emit('request-area', { area: 'alpine' }) });

			// a weathered marker at the end of the shore trail, looking out to sea
			const sx = (this.landRight - 0.6) * TILE;
			const sy = 13 * TILE;
			this.addDyn(this.add.image(sx, sy, 'obj-driftpile').setDepth(sy));
			this.registerInteractable({
				x: sx, y: sy, label: 'Look out over the ocean',
				action: () => bridge.emit('toast', { text: 'The open Pacific stretches east as far as you can see. Sea glass, kelp, coral, and the rare pearl wash up along the tideline.', kind: 'info' }),
			});
		}
	}

	// resource nodes — layout and resource mix are randomized per player + area
	// (deterministic from that seed so they stay put), and every biome resource
	// is guaranteed to appear at least once so recipes remain craftable.
	private computeNodes(): NodeDef[] {
		const biome = this.biomeDef();
		if (!biome) return [];
		// Seed node layout by the WORLD id (not the player) so everyone in a co-op
		// world sees the same nodes in the same spots. Solo worldId === playerId, so
		// solo layouts are unchanged.
		const wid = (bridge.shared.state as any)?.worldId || bridge.shared.state?.player.id || 'anon';
		const rng = mulberry32(hashStr(`${wid}-${this.area}-nodes`));
		// Node budget — at least twice the resource count (plus a little extra room
		// for weighted staples), so there's always space for two nodes of every
		// resource this biome offers.
		const res = biome.resources || [];
		const count = Math.max(20, res.length * 2 + 4);

		// Build the resource bag for this area. GUARANTEE every biome resource
		// appears at least TWICE (two of each, placed first), then fill the rest
		// with a weighted random draw so early-game staples are easy to find
		// (seeds especially — used by almost every meadow recipe). Coverage is no
		// longer left to a shuffle that could drop a resource: if it's in the
		// biome, at least two nodes for it are generated.
		const NODE_WEIGHT: Record<string, number> = { seeds: 4, fiber: 2 };
		const weighted: string[] = [];
		for (const r of res) for (let i = 0; i < (NODE_WEIGHT[r] || 1); i++) weighted.push(r);
		// Guaranteed prefix: two nodes per resource, placed first (positions are
		// random anyway), then weighted fill up to `count`.
		const pool: string[] = [...res, ...res];
		while (pool.length < count && weighted.length) pool.push(weighted[Math.floor(rng() * weighted.length)]);

		const nodes: NodeDef[] = [];
		let attempts = 0;
		while (nodes.length < count && attempts < 400) {
			attempts++;
			const tx = 1 + Math.floor(rng() * (this.landRight - 3));
			const ty = this.playTop + 1 + Math.floor(rng() * (this.rows - this.playTop - 3));
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

		// Coverage safety net — every gatherable resource MUST have at least a
		// minimum number of spawn spots the moment the world spawns. The placement
		// loop above covers this normally, but if anything slipped through (an
		// unusually crowded map that exhausted placement attempts), force extra
		// nodes in on the nearest free tiles so the guarantee is hard, not a
		// statistic. Fallen branches are an early staple, so the meadow and forest
		// keep at least three.
		const MIN_PER_RESOURCE = 2;
		const minFor = (r: string) =>
			r === 'branches' && (this.area === 'meadow' || this.area === 'forest') ? 3 : MIN_PER_RESOURCE;
		const perResource = new Map<string, number>();
		for (const n of nodes) perResource.set(n.resourceId, (perResource.get(n.resourceId) || 0) + 1);
		for (const r of res) {
			while ((perResource.get(r) || 0) < minFor(r)) {
				const spot = this.findFreeTile(Math.floor(OUT_W / 2), this.playTop + Math.floor(OUT_H / 2), occupied, taken);
				if (!spot) break;
				nodes.push({ id: `n${nodes.length}`, resourceId: r, tx: spot.tx, ty: spot.ty });
				taken.add(`${spot.tx},${spot.ty}`);
				perResource.set(r, (perResource.get(r) || 0) + 1);
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
				const anchorFree = anchor.tx >= 1 && anchor.ty >= this.playTop && anchor.tx <= this.landRight - 2 && anchor.ty <= this.rows - 2 &&
					!occupied.has(aKey) && !taken.has(aKey) && !this.inCamp(anchor.tx, anchor.ty);
				const spot = anchorFree ? anchor : this.findFreeTile(anchor.tx, anchor.ty, occupied, taken);
				if (spot) {
					nodes.push({ id: 'nw', resourceId: waterRes, tx: spot.tx, ty: spot.ty });
					taken.add(`${spot.tx},${spot.ty}`);
				}
			}
		}

		// Weather-gated gather nodes: while a special weather is active in this biome
		// (rain, storm, snow, fog, heat) a couple of spots for its unique resource
		// appear, then vanish when the weather turns over. Positions are seeded by
		// world+biome+weather so co-op players find them in the same places.
		const wxType = liveWeatherType(this.worldId, this.area, bridge.shared.state?.weather);
		const wxRes = gatherResourceFor(bridge.shared.data?.resources, this.area, wxType);
		if (wxRes) {
			const wrng = mulberry32(hashStr(`${this.worldId}:${this.area}:wx:${wxType}`));
			for (let i = 0; i < 2; i++) {
				const ax = 2 + Math.floor(wrng() * Math.max(1, this.landRight - 4));
				const ay = this.playTop + 1 + Math.floor(wrng() * Math.max(1, this.rows - this.playTop - 3));
				const spot = this.findFreeTile(ax, ay, occupied, taken);
				if (spot) {
					nodes.push({ id: `wx-${wxRes.id}-${i}`, resourceId: wxRes.id, tx: spot.tx, ty: spot.ty });
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
					if (tx < 1 || ty < this.playTop || tx > this.landRight - 2 || ty > this.rows - 2) continue;
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
		// Node cooldowns are world-scoped now, so match on the world id (falls back to
		// the player id for solo / legacy rows).
		const wid = (s as any).worldId || s.player.id;
		const rec = s.nodeStates.find((n) => n.id === `${wid}:${this.area}:${node.id}`);
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

	/** A ~3s construction flourish on the camp building when the home is built/upgraded. */
	private playBuild() {
		if (!this.alive || this.area !== 'meadow') return; // the camp building lives in the meadow
		const bx = CAMP.tent.x * TILE, by = CAMP.tent.y * TILE;
		// a tarp drops over the building while "construction" happens, then lifts
		const tarp = this.add.rectangle(bx, by - 4, 86, 74, C('#cdbb94'), 0.9).setDepth(by + 60);
		this.tweens.add({ targets: tarp, alpha: { from: 0, to: 0.9 }, duration: 250 });
		// sawdust puffs + sparkles kicking up around the base
		const puffs = this.time.addEvent({
			delay: 150, loop: true, callback: () => {
				if (!this.alive) return;
				const d = this.add.image(bx + (Math.random() - 0.5) * 64, by + 22 + (Math.random() - 0.5) * 16, 'glow')
					.setTint(0xe6d2a4).setDepth(by + 70).setScale(0.45).setAlpha(0.75).setBlendMode(Phaser.BlendModes.ADD);
				this.tweens.add({ targets: d, y: d.y - 20, alpha: 0, scale: 0.8, duration: 620, ease: 'Sine.easeOut', onComplete: () => d.destroy() });
			},
		});
		const hammer = this.time.addEvent({ delay: 800, loop: true, callback: () => { if (this.alive) this.floatText(bx + (Math.random() - 0.5) * 30, by - 26, 'tap tap', '#fff7dd'); } });
		this.floatText(bx, by - 34, 'Building…', '#fff7dd');
		this.time.delayedCall(3000, () => {
			puffs.remove();
			hammer.remove();
			if (!this.alive) { tarp.destroy(); return; }
			// lift the tarp to reveal the finished building, and give it a happy little pop
			this.tweens.add({ targets: tarp, alpha: 0, y: by - 40, duration: 500, ease: 'Sine.easeIn', onComplete: () => tarp.destroy() });
			this.floatText(bx, by - 34, 'Done! ✨', '#d8eec2');
			bridge.emit('world-dirty'); // ensure the finished building is drawn
		});
	}

	/** Climb into the bed/bag, dim the room, snooze ~3s, then refresh the preserve. */
	private sleepAt(bx: number, by: number) {
		if (this.sleeping) return;
		this.sleeping = true;
		// lie the caretaker down on the bed
		this.player.setPosition(bx, by - 4);
		this.player.setDepth(by + 30);
		this.player.setAngle(-78);
		bridge.emit('toast', { text: 'Goodnight… 💤', kind: 'info' });
		// a soft dim over the whole view (oversized + screen-fixed so zoom never matters)
		const dim = this.add.rectangle(-2000, -2000, 6000, 6000, 0x0a1026, 0).setOrigin(0, 0).setScrollFactor(0).setDepth(9000);
		this.tweens.add({ targets: dim, alpha: 0.6, duration: 600, ease: 'Sine.easeIn' });
		// drifting "z"s above the sleeper
		const zzz = this.time.addEvent({
			delay: 620, loop: true, callback: () => {
				if (!this.alive) return;
				const z = this.add.text(this.player.x + 12, this.player.y - 14, 'z', {
					fontFamily: 'Quicksand, sans-serif', fontSize: '16px', color: '#dfe9ff', fontStyle: 'bold',
				}).setOrigin(0.5).setDepth(9500);
				this.tweens.add({ targets: z, y: z.y - 30, x: z.x + 14, alpha: 0, duration: 1300, ease: 'Sine.easeOut', onComplete: () => z.destroy() });
			},
		});
		this.time.delayedCall(3000, () => {
			zzz.remove();
			if (!this.alive) return;
			bridge.emit('rest'); // server-side: refresh all gathering spots
			this.player.setAngle(0);
			this.player.setDepth(this.player.y + 16);
			this.tweens.add({ targets: dim, alpha: 0, duration: 700, ease: 'Sine.easeOut', onComplete: () => dim.destroy() });
			this.time.delayedCall(700, () => { this.sleeping = false; });
		});
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
			const isFixture = def.isChest || ['workbench', 'field-journal-stand', 'bed', 'home-bed', 'home-sleeping-bag'].includes(p.objectId);
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
			// paint-tool recolor: a per-item color override wins over the default tint
			if (p.color) img.setTint(Phaser.Display.Color.HexStringToColor(p.color).color);

			img.setInteractive({ useHandCursor: true });
			const hasPrimaryAction = isFixture;
			img.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
				if (this.placementObjectId || this.movingPlacementId) return;
				if (this.activeTool === 'paint' && this.isHome) return; // painting handled globally
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
			} else if (p.objectId === 'home-bed' || p.objectId === 'home-sleeping-bag') {
				this.registerInteractable({ x, y, label: 'Go to sleep (refresh gathering spots)', action: () => this.sleepAt(x, y) }, img);
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
				ax = (2 + rng() * (this.landRight - 4)) * TILE;
				ay = (this.playTop + 2 + rng() * (OUT_H - 4)) * TILE;
			}
			// on the shore, let sea creatures drift a touch into the surf but no further
			const eastEdge = this.area === 'coastal' ? (this.landRight + 1.2) * TILE : this.worldW - TILE;
			ax = Phaser.Math.Clamp(ax, TILE, eastEdge);
			ay = Phaser.Math.Clamp(ay, (this.playTop + 1) * TILE, this.worldH - TILE);

			// Fish belong over open water only; ground-walkers (anything that isn't a
			// fish, bird, or insect) keep off open water. Birds and insects fly freely.
			const flying = animal.kind === 'bird' || animal.kind === 'insect';
			if (animal.kind === 'fish') {
				const w = this.fishTarget(ax, ay, Infinity, rng);
				if (w) { ax = w.x; ay = w.y; }
			} else if (!flying && this.isWaterPx(ax, ay)) {
				for (let i = 0; i < 14 && this.isWaterPx(ax, ay); i++) {
					ax = Phaser.Math.Clamp((2 + rng() * (this.landRight - 4)) * TILE, TILE, eastEdge);
					ay = Phaser.Math.Clamp((this.playTop + 2 + rng() * (OUT_H - 4)) * TILE, (this.playTop + 1) * TILE, this.worldH - TILE);
				}
			}

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
		// No drifting leaves on the open coast — they read as odd flecks over the
		// sand and surf. The shore gets its pelicans and foam instead.
		if (this.area === 'coastal') return;
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

	/** Is this pixel position over an open-water tile? */
	private isWaterPx(px: number, py: number): boolean {
		return this.waterTiles.has(`${Math.floor(px / TILE)},${Math.floor(py / TILE)}`);
	}

	/** Pick a point over open water, preferring tiles within `roam` of home. */
	private fishTarget(homeX: number, homeY: number, roam: number, rng: () => number): { x: number; y: number } | null {
		if (!this.waterTileCenters.length) return null;
		const near = this.waterTileCenters.filter((c) => Phaser.Math.Distance.Between(homeX, homeY, c.x, c.y) <= roam * 1.5);
		const pool = near.length ? near : this.waterTileCenters;
		const c = pool[Math.floor(rng() * pool.length)];
		// jitter within the tile so a fish doesn't snap dead-center
		return { x: c.x + (rng() - 0.5) * TILE * 0.6, y: c.y + (rng() - 0.5) * TILE * 0.6 };
	}

	private wander(img: Phaser.GameObjects.Image, homeX: number, homeY: number, kind: string, rng: () => number) {
		const roam = kind === 'bird' || kind === 'insect' ? 130 : 80;
		const speed = kind === 'insect' ? 26 : kind === 'bird' ? 42 : 18;
		const aquatic = kind === 'fish';
		const flying = kind === 'bird' || kind === 'insect';
		const hop = () => {
			if (!img.active) return;
			const eastEdge = this.area === 'coastal' ? (this.landRight + 1.2) * TILE : this.worldW - TILE;
			let tx: number, ty: number;
			if (aquatic) {
				// fish drift only between open-water tiles near them
				const w = this.fishTarget(homeX, homeY, roam, rng);
				if (!w) { this.time.delayedCall(1200 + rng() * 2000, hop); return; }
				tx = w.x; ty = w.y;
			} else {
				// walkers re-roll any target that lands on open water; fliers go anywhere
				let attempts = 0;
				do {
					tx = Phaser.Math.Clamp(homeX + (rng() - 0.5) * roam * 2, TILE, eastEdge);
					ty = Phaser.Math.Clamp(homeY + (rng() - 0.5) * roam * 1.4, (this.playTop + 1) * TILE, this.worldH - TILE);
				} while (!flying && this.isWaterPx(tx, ty) && ++attempts < 12);
				if (!flying && this.isWaterPx(tx, ty)) { tx = img.x; ty = img.y; } // stay put rather than step onto water
			}
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
		// Indoors: you can only decorate on the floor (inside the walls).
		if (this.isHome) {
			const r = this.homeRoom();
			if (tx < r.x0 || tx > r.x1 || ty < r.y0 || ty > r.y1) return false;
			const sH = bridge.shared.state;
			if (sH?.placements.some((p) => p.id !== ignoreId && p.area === 'home' && p.x === tx && p.y === ty)) return false;
			// items that need a bigger home can't be placed in a small one yet
			const activeId = this.movingPlacementId
				? sH?.placements.find((p) => p.id === this.movingPlacementId)?.objectId
				: this.placementObjectId;
			const homeMin = activeId ? this.objectDef(activeId)?.homeMin || 0 : 0;
			const space = bridge.shared.state?.player?.home?.space || 1;
			if (homeMin > space) return false;
			return true;
		}
		// Pelican Shore: nothing builds on the open ocean; land ends at landRight.
		const right = this.area === 'coastal' ? this.landRight : OUT_W - 1;
		if (tx < 1 || ty < (this.playTop || 1) || tx >= right || ty >= this.rows - 1) return false;
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
		// stream our exact live position (tile coords) for co-op presence
		bridge.shared.self = { x: this.player.x / TILE, y: this.player.y / TILE, area: this.area };
		this.updateRemotes(dt);
	}

	/**
	 * Draw the other co-op players who are in this same area. Avatars are created
	 * on demand from each peer's appearance, eased toward their reported tile, and
	 * removed when a player leaves the area or goes quiet. Pure presentation — it
	 * reads bridge.shared.presence, which the React presence loop keeps fresh.
	 */
	private updateRemotes(dt: number) {
		if (!this.alive) return;
		const peers = (bridge.shared.presence || []).filter((p) => p && p.area === this.area && p.playerId);
		const seen = new Set<string>();

		for (const peer of peers) {
			seen.add(peer.playerId);
			const sig = JSON.stringify(peer.appearance || {});
			let r = this.remotes.get(peer.playerId);
			if (!r) {
				const key = makePlayerTexture(this, peer.appearance);
				const shadow = this.add.image(peer.x * TILE, peer.y * TILE + 15, 'shadow').setDepth(2).setAlpha(0.5);
				const sprite = this.add.image(peer.x * TILE, peer.y * TILE, key).setDepth(999).setAlpha(0.96);
				const label = this.add.text(peer.x * TILE, peer.y * TILE - 26, peer.name || 'caretaker', {
					fontFamily: 'system-ui, sans-serif', fontSize: '11px', color: '#3a2f25',
					backgroundColor: 'rgba(255,255,255,0.7)', padding: { x: 4, y: 1 },
				}).setOrigin(0.5).setDepth(10000);
				r = { sprite, shadow, label, sig, walkT: 0, lastX: peer.x, lastY: peer.y, moveUntil: 0 };
				this.remotes.set(peer.playerId, r);
			}
			if (r.sig !== sig) { r.sprite.setTexture(makePlayerTexture(this, peer.appearance)); r.sig = sig; }
			// "Walking" is driven by the reported position actually changing — not by
			// the easing — so a standing player never waddles. A short window keeps the
			// animation alive smoothly between position updates.
			if (peer.x !== r.lastX || peer.y !== r.lastY) {
				r.moveUntil = this.time.now + 220;
				r.lastX = peer.x; r.lastY = peer.y;
			}
			const moving = this.time.now < r.moveUntil;
			const targetX = peer.x * TILE, targetY = peer.y * TILE;
			const k = Math.min(1, dt * 12);
			const nx = r.sprite.x + (targetX - r.sprite.x) * k;
			const ny = r.sprite.y + (targetY - r.sprite.y) * k;
			if (Math.abs(targetX - r.sprite.x) > 0.5) r.sprite.setFlipX(targetX < r.sprite.x);
			// identical waddle to the local player in solo (amplitude 0.075, speed ×11)
			if (moving) {
				r.walkT += dt * 11;
				r.sprite.setRotation(Math.sin(r.walkT) * 0.075);
			} else {
				r.sprite.setRotation(r.sprite.rotation * 0.8);
			}
			r.sprite.setPosition(nx, ny).setDepth(ny + 30);
			r.shadow.setPosition(nx, ny + 15);
			r.label.setPosition(nx, ny - 26);
		}

		// drop avatars for anyone who left this area / went quiet
		for (const [id, r] of this.remotes) {
			if (seen.has(id)) continue;
			r.sprite.destroy(); r.shadow.destroy(); r.label.destroy();
			this.remotes.delete(id);
		}
	}

	private clearRemotes() {
		for (const r of this.remotes.values()) { r.sprite.destroy(); r.shadow.destroy(); r.label.destroy(); }
		this.remotes.clear();
	}

	private handleMovement(dt: number) {
		if (this.sleeping) return; // can't roam while asleep
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
		ny = Phaser.Math.Clamp(ny, this.playTop * TILE + 20, this.worldH - 18);

		if (vx !== 0) this.player.setFlipX(vx < 0);

		// open water blocks walking — unless a bridge spans that tile. On Pelican
		// Shore the ocean band along the east edge is always impassable.
		const blocked = (px: number, py: number) => {
			// indoors: the walls (anything off the floor) block movement — but the
			// door threshold (one tile below the floor, centred) is walkable so you
			// can step right up to the door before leaving.
			if (this.isHome) {
				const r = this.homeRoom();
				const tx = Math.floor(px / TILE), ty = Math.floor((py + 8) / TILE);
				if (tx === r.doorX && ty === r.y1 + 1) return false;
				return tx < r.x0 || tx > r.x1 || ty < r.y0 || ty > r.y1;
			}
			if (this.area === 'coastal' && Math.floor(px / TILE) >= this.landRight) return true;
			// the camp building (tent/house) is solid — walk around it, not through it
			if (this.area === 'meadow') {
				const hx = Math.floor(px / TILE), hy = Math.floor((py + 8) / TILE);
				if (hx >= 5 && hx <= 7 && hy >= 3 && hy <= 5) return true;
			}
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
					? `Shovel — ${this.isTouch ? 'tap' : 'click'} ground to dig a bed (may turn up materials)`
					: `Watering can — ${this.isTouch ? 'tap' : 'click'} a bed to water it, again to flood it`)
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
