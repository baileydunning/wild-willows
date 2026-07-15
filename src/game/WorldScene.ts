import Phaser from 'phaser';
import { bridge } from './bridge';
import { canPaintClick } from './interactions';
import {
	animalScale,
	animalTexture,
	ensureAnimalTexture,
	makeAnimalTextures,
	makeBaseTextures,
	makeNodeTextures,
	makeObjectTextures,
	makePlayerTexture,
	snapshotResourceIcons,
	snapshotObjectIcons,
	INV_TEX_SCALE,
	TEX_SCALE,
} from './textures';
import {
	seasonStyle,
	weatherType,
	liveWeatherType,
	dayPhaseStyle,
	phaseAtProgress,
	gatherResourceFor,
} from '../weather';
import { t, content } from '../i18n';
import { getPrefs, subscribe as subscribePrefs } from '../prefs';
import { gearOn, subscribe as subscribeGear } from '../gear';
import { isTypingTarget } from '../typing';
import { harvestReadyAt } from '../types';
import type { BiomeDef, HabitatObjectDef } from '../types';

export const TILE = 32;
// Base grid — the home interior's world size, and the fallback for any biome
// without an explicit `grid` in data/biomes.json. Outdoor biomes are BIGGER
// than the screen now (the meadow especially): the camera follows the
// caretaker and you walk to see the rest.
const OUT_W = 30;
const OUT_H = 20;
// "Normal" zoom shows a fixed VIEW_W×VIEW_H tile window — a function of the
// SCREEN, not the biome's world size — so every biome reads at exactly the same
// zoom regardless of how big it is (the meadow no longer feels zoomed out just
// because it's wider). The world scrolls with the player to reveal the rest.
const VIEW_W = 30;
const VIEW_H = 20;
// Outdoors the camera has NO bounds: it keeps the caretaker centered even at
// the world edge, so the player (and any gathering spot they stand beside) can
// never get stuck under the fixed UI panels (HUD, task board, toolbelt) — a
// playtest "big problem". The world is ringed with matching ground (see
// drawSurround) sized to cover the widest possible camera view, so the space
// past the edge reads as more preserve — you just can't walk there
// (handleMovement clamps at the true edge).
const SURROUND_X = 20; // tiles of surround left/right (≥ half the widest view)
const SURROUND_Y = 14; // tiles of surround above/below (≥ half the tallest view)
const MTN_ROWS = 8; // rows reserved for the alpine mountain range (impassable) — a tall, close range
const COAST_COLS = 4; // columns reserved for the ocean along Pelican Shore's east edge (impassable)

// your base camp: tent + campfire scenery beside the permanent crafting station & chest.
// The camp keeps its EXACT main-branch arrangement (tent, campfire, chest, sign
// all in the same relative spots and the same distance to the forest gate); the
// whole block just sits MEADOW_SHIFT tiles further east so a strip of wild land
// opens to its WEST. Nothing from main moved relative to the rest of the meadow.
const CAMP = { tent: { x: 20.5, y: 4.2 }, fire: { x: 21.6, y: 5.1 } };
// right in front of the tent door — where you land when you step back out of the home
const CAMP_TENT_FRONT = { x: CAMP.tent.x, y: CAMP.tent.y + 1.8 };
const CAMP_BLOCK = { x0: 19.5, y0: 3.2, x1: 23.9, y1: 5.9 }; // keep nodes/placements clear of camp

// The west→east walking order of the preserve — arrivals enter at the edge
// facing the biome they came from. Spawn positions are computed from each
// area's own grid size (see spawnFor), since biomes are different sizes now.
const AREA_ORDER = ['meadow', 'forest', 'wetland', 'desert', 'alpine', 'coastal'];
const SPAWN_DEFAULT = { x: 24, y: 11 };

const C = (hex: string) => Phaser.Display.Color.HexStringToColor(hex).color;

// Has any weather been shown yet this session? The first weather you see is
// allowed to "start up" (rain/snow building from the top); every biome you
// transfer into afterwards should already be mid-storm, so we pre-warm the
// emitter on entry. Module-scoped so it survives scene.restart().
let weatherShownThisSession = false;

// Player-chosen zoom (+/− keys), multiplied onto the normal window zoom.
// Module-scoped so it survives area changes; every session starts back at
// normal (1). Exactly one step out and one step in from "perfect" — a nudge,
// not a telescope. ZOOM_STEP is both the per-press factor and the range bound,
// so one press reaches the limit either way.
const ZOOM_STEP = 1.25;
const USER_ZOOM_MIN = 1 / ZOOM_STEP;
const USER_ZOOM_MAX = ZOOM_STEP;
let userZoom = 1;

function hashStr(s: string): number {
	let h = 2166136261;
	for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
	return h >>> 0;
}

function mulberry32(seed: number) {
	let a = seed >>> 0;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
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
	/** Optional live-computed prompt (recomputed each frame while you're near),
	 *  used for locked gates so the bottom bar always shows what's still needed. */
	liveLabel?: () => string;
}

export class WorldScene extends Phaser.Scene {
	area = 'meadow';
	private player!: Phaser.GameObjects.Image;
	private playerShadow!: Phaser.GameObjects.Image;
	private walkT = 0;
	private keys!: any;
	private groundTiles: Phaser.GameObjects.Image[] = [];
	// Living vegetation out in the unwalkable surround/edge — tinted from dead
	// (brown) to alive as the biome's health rises, so the whole world beyond the
	// fence recovers alongside it.
	private healthDeco: Phaser.GameObjects.Image[] = [];
	private dynamic!: Phaser.GameObjects.Group;
	private animals!: Phaser.GameObjects.Group; // animals live in their own layer so a
	private animalSig = ''; // routine refresh doesn't reset their wandering
	private interactables: Interactable[] = [];
	private nodes: NodeDef[] = [];
	private nodeSprites = new Map<string, Phaser.GameObjects.Container>();
	private lastPrompt = '';
	private unsubs: Array<() => void> = [];
	private placementObjectId: string | null = null;
	private movingPlacementId: string | null = null;
	private sleeping = false;
	private ghost: Phaser.GameObjects.Container | null = null;
	private placeRotation = 0; // degrees (0/90/180/270) applied to the object being placed/moved
	private moveAccum = 0;
	private lastSynced = { x: 0, y: 0 };
	private activeTool = 'basket';
	private highlight!: Phaser.GameObjects.Container;
	private tileCursor!: Phaser.GameObjects.Image;
	// The interactable the pointer is currently hovering (for hover feedback), and
	// a signature of the last dynamic-layer build so redundant world-dirty events
	// (boot nudges, unrelated saves) don't tear down and rebuild every sprite/tween.
	private hoveredIt: Interactable | null = null;
	private lastGateInfo: string | null = null;
	private dynamicSig = '';
	private isTouch = false;
	private alive = false; // true between create() and shutdown (scene.isActive() is false DURING create)
	private waterTiles = new Set<string>();
	private waterTileCenters: { x: number; y: number }[] = []; // pixel centers of open-water tiles
	private bridgeTiles = new Set<string>();
	// Live co-op: other players in this same area, drawn as their own avatars and
	// smoothly eased toward the positions reported by the presence loop.
	private remotes = new Map<
		string,
		{
			sprite: Phaser.GameObjects.Image;
			shadow: Phaser.GameObjects.Image;
			label: Phaser.GameObjects.Text;
			sig: string;
			walkT: number;
			lastX: number;
			lastY: number;
			moveUntil: number;
		}
	>();
	// Weather visuals: a camera-locked full-screen weather-colour tint and a
	// world-locked rain/snow particle emitter, swapped when the weather changes.
	private weatherOverlay?: Phaser.GameObjects.Rectangle;
	private weatherEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
	private weatherSig = '';
	// Day/night: a second full-screen tint that eases through dawn → day → dusk →
	// night → dawn over the play-time day. lightState is the value being tweened.
	private lightOverlay?: Phaser.GameObjects.Rectangle;
	private lightTween?: Phaser.Tweens.Tween;
	private lightState = { r: 255, g: 255, b: 255, a: 0 };
	private lightPhase = ''; // current day phase the tint is set to (dawn/day/dusk/night)
	// Warm "sky glow" gradient (dawn/dusk): a top-weighted overlay so a strong
	// sunset colours the top of the view without washing the whole ground brown.
	private skyOverlay?: Phaser.GameObjects.Image;
	private skyTween?: Phaser.Tweens.Tween;
	// Night lights: things that genuinely push back the dark. A screen-sized
	// RenderTexture (off-list) is stamped each frame with one radial gradient
	// per light source — the player's headlamp (if crafted) and every lit
	// campfire — and drives ONE inverted bitmap mask on the night tint (WebGL
	// only), carving a pool of true daylight color around each light.
	// lampGlow is the headlamp's warm additive halo (works on any renderer);
	// campfires already carry their own halo from drawPlacements.
	private lampGlow?: Phaser.GameObjects.Image;
	private lightMaskRT?: Phaser.GameObjects.RenderTexture;
	private lightBrush?: Phaser.GameObjects.Image;
	private lightBitmapMask?: Phaser.Display.Masks.BitmapMask;
	private skyState = { r: 255, g: 200, b: 150, a: 0 };
	// Free-running day clock (mirrors the HUD's DayTimer): advances on wall time so
	// the cycle keeps moving even when idle, and re-syncs when the snapshot's day moves.
	private dayAnchor?: { base: number; wall: number };
	private lastSnapDay = -1;

	constructor() {
		super('world');
	}

	init(data: any) {
		this.area = data?.area || bridge.shared.state?.player.area || 'meadow';
	}

	private get isHome() {
		return this.area === 'home';
	}

	/** The wild-biome id this trail-tent interior belongs to (null outside tents). */
	private get tentBiome(): string | null {
		const m = /^tent-([a-z][a-z-]*)$/.exec(this.area);
		return m ? m[1] : null;
	}

	/** Inside any interior — the home or a trail tent. */
	private get isIndoors() {
		return this.isHome || !!this.tentBiome;
	}

	/** The interior room for wherever we are: the home's configured room, or the
	 *  fixed tent-sized room of a trail tent. */
	private roomSpec() {
		return this.tentBiome ? this.tentRoom() : this.homeRoom();
	}

	/** Trail-tent interior: the starter-tent footprint with canvas-y colors —
	 *  decor/light pinned to 1 so drawHomeRoom skips the house-only flourishes. */
	private tentRoom() {
		const inner = { w: 6, h: 5 };
		const x0 = Math.floor((OUT_W - inner.w) / 2);
		const y0 = Math.floor((OUT_H - inner.h) / 2);
		const x1 = x0 + inner.w - 1,
			y1 = y0 + inner.h - 1;
		return {
			x0,
			y0,
			x1,
			y1,
			floor: '#c8b088', // groundcloth
			wall: '#8a7c5a', // weathered canvas — warm tan, just a whisper of olive
			accent: '#e3c75f',
			rug: '#b5707a',
			decor: 1,
			light: 1,
			doorX: Math.round((x0 + x1) / 2),
			doorY: y1,
		};
	}

	/** Interior floor rectangle (tile coords) + cosmetics for the current home config. */
	private homeRoom() {
		const home =
			bridge.shared.state?.player?.home || ({ style: 'cabin', space: 1, comfort: 1, decor: 1, light: 1 } as any);
		const data = bridge.shared.data;
		const styles = data?.homeStyles || {};
		const style = styles[home.style] || styles.cabin || { floor: '#c9a373', wall: '#9c7a52', accent: '#b5707a' };
		const spaceLevels = data?.homeTracks?.space?.levels || [];
		const inner = spaceLevels[(home.space || 1) - 1]?.inner || { w: 8, h: 6 };
		const x0 = Math.floor((OUT_W - inner.w) / 2);
		const y0 = Math.floor((OUT_H - inner.h) / 2);
		const x1 = x0 + inner.w - 1,
			y1 = y0 + inner.h - 1;
		const colors = home.colors || {};
		return {
			x0,
			y0,
			x1,
			y1,
			floor: colors.floor || style.floor,
			wall: colors.wall || style.wall,
			accent: colors.accent || style.accent,
			rug: colors.rug || colors.accent || style.accent,
			decor: home.decor || 1,
			light: home.light || 1,
			doorX: Math.round((x0 + x1) / 2),
			doorY: y1,
		};
	}

	/**
	 * World dimensions for any area. Outdoor biomes read their size from
	 * data/biomes.json (`grid`); the home interior stays at the base 30×20.
	 * Alpine adds an impassable mountain band on top; coastal reserves ocean
	 * columns on the east.
	 */
	private dimsOf(area: string) {
		const g = area === 'home' ? null : this.biomeDef(area)?.grid;
		const cols = g?.cols || OUT_W;
		const baseRows = g?.rows || OUT_H;
		const mtn = area === 'alpine' ? MTN_ROWS : 0;
		return {
			cols,
			baseRows,
			rows: baseRows + mtn,
			playTop: mtn,
			landRight: area === 'coastal' ? cols - ((this.biomeDef(area) as any)?.oceanCols ?? COAST_COLS) : cols,
			// gates sit at the vertical middle of the playable band
			gateY: mtn + baseRows / 2 - 0.2,
		};
	}
	private get cols() {
		return this.dimsOf(this.area).cols;
	}
	private get baseRows() {
		return this.dimsOf(this.area).baseRows;
	}
	private get worldW() {
		return this.cols * TILE;
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
	private get oceanCols() {
		return this.area === 'coastal' ? ((this.biomeDef() as any)?.oceanCols ?? COAST_COLS) : 0;
	}
	private get landRight() {
		return this.cols - this.oceanCols;
	}
	private get rows() {
		return this.baseRows + this.mtnRows;
	}
	private biomeDef(id = this.area): BiomeDef | undefined {
		return bridge.shared.data?.biomes.find((b) => b.id === id);
	}
	private objectDef(id: string): HabitatObjectDef | undefined {
		if (id === 'workbench') {
			return { id, name: t('game.object.craftingStation'), shape: 'workbench', placement: 'outdoor' } as any;
		}
		return bridge.shared.data?.habitatObjects.find((o) => o.id === id);
	}

	/** Localized display name of a biome (content overlay wins; data name, then a literal, as fallback). */
	private biomeName(id: string, fallback: string): string {
		return content('biome', id, 'name', this.biomeDef(id)?.name || fallback);
	}

	create(data: any) {
		this.alive = true;
		// scene.restart() reuses this instance, so stale (now-destroyed) weather
		// overlay/emitter references must be cleared before they're recreated.
		this.weatherOverlay = undefined;
		this.weatherEmitter = undefined;
		this.weatherSig = '';
		this.lightOverlay = undefined;
		this.lightTween = undefined;
		this.lightPhase = '';
		this.skyOverlay = undefined;
		this.skyTween = undefined;
		this.lampGlow = undefined;
		this.lightMaskRT = undefined;
		this.lightBrush = undefined;
		this.lightBitmapMask = undefined;
		this.dayAnchor = undefined;
		this.lastSnapDay = -1;
		this.dynamicSig = ''; // force a full dynamic rebuild on (re)create
		makeBaseTextures(this);
		makeObjectTextures(this);
		makeAnimalTextures(this);
		makeNodeTextures(this);
		snapshotResourceIcons(this); // cache resource sprites as data URLs for the DOM UI
		snapshotObjectIcons(this); // …and object sprites, for the crafting/planting menus
		this.isTouch = this.sys.game.device.input.touch && !this.sys.game.device.os.desktop;

		// Indoors the camera stays clamped to the room; outdoors it's unbounded so
		// the caretaker is always centered — never hidden under the fixed UI.
		if (this.isIndoors) this.cameras.main.setBounds(0, 0, this.worldW, this.worldH);
		else this.cameras.main.removeBounds();
		this.cameras.main.setBackgroundColor('#26301f');
		this.applyZoom();
		this.scale.on('resize', () => this.applyZoom());

		// groups must exist before drawGround(): the home room is now drawn into the
		// dynamic group so it can be repainted live when you use the paint tool.
		this.dynamic = this.add.group();
		this.animals = this.add.group();

		this.drawGround();
		const playerKey = makePlayerTexture(this, bridge.shared.state?.player.appearance);
		this.playerShadow = this.img(0, 0, 'shadow').setDepth(2);
		this.player = this.img(0, 0, playerKey).setDepth(1000);
		let spawn = data?.spawn || this.savedSpawn();
		// stepping into an interior (home or trail tent): stand just inside the door
		if (this.isIndoors) {
			const r = this.roomSpec();
			spawn = { x: r.doorX + 0.5, y: r.doorY + 0.2 };
		}
		this.player.setPosition(spawn.x * TILE, spawn.y * TILE);
		this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
		this.startLeaves();

		this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SPACE,ESC,SHIFT');
		this.input.keyboard!.on('keydown-ESC', () => {
			if (this.placementObjectId || this.movingPlacementId) bridge.emit('placement-exited');
		});
		// + / − zoom the camera window in and out a little. Scene keyboard input is
		// already disabled while a text field has focus, so typing never zooms.
		this.input.keyboard!.on('keydown', (e: KeyboardEvent) => {
			if (e.key === '+' || e.key === '=') this.nudgeZoom(ZOOM_STEP);
			else if (e.key === '-' || e.key === '_') this.nudgeZoom(1 / ZOOM_STEP);
			// "\" (the key under Delete) turns the object you're placing or moving a
			// quarter-turn; the ghost preview rotates so you can line it up first.
			// "/" is accepted too. Only paths/fences/bridges/furniture rotate — trees,
			// flowers, rocks and radial decor always sit upright.
			else if (
				(e.key === '\\' || e.code === 'Backslash' || e.key === '/' || e.code === 'Slash') &&
				(this.placementObjectId || this.movingPlacementId)
			) {
				e.preventDefault();
				if (!this.activeRotatable()) {
					bridge.emit('toast', { text: t('game.toast.noRotate'), kind: 'info' });
					return;
				}
				this.placeRotation = (this.placeRotation + 90) % 360;
				const preview = this.ghost && ((this.ghost as any).preview as Phaser.GameObjects.Image | undefined);
				preview?.setRotation(Phaser.Math.DegToRad(this.placeRotation));
			}
		});

		// When the player is typing in a text field (passcode, save name, chest
		// amounts, feedback, …) the game must NOT eat those keystrokes for
		// movement. Disable the scene's keyboard (and Phaser's global key capture)
		// whenever a text input is focused, and restore it the moment focus leaves.
		const onFocusIn = (e: FocusEvent) => {
			if (!isTypingTarget(e.target)) return;
			const kb = this.input.keyboard;
			if (!kb) return;
			kb.enabled = false;
			kb.disableGlobalCapture();
			kb.resetKeys(); // drop any held WASD so the player stops dead
		};
		const onFocusOut = (e: FocusEvent) => {
			if (!isTypingTarget(e.target)) return;
			const kb = this.input.keyboard;
			if (!kb) return;
			kb.enabled = true;
			kb.enableGlobalCapture();
		};
		document.addEventListener('focusin', onFocusIn);
		document.addEventListener('focusout', onFocusOut);
		// If the window loses focus while a movement key is held (alt-tab, a click
		// outside the game, an OS overlay…) the keyup never reaches us and Phaser
		// keeps the key "down" forever. A stuck RIGHT then cancels every LEFT
		// press (vx sums to 0), which reads as "movement stopped working in one
		// direction" (playtest). Drop all held keys whenever focus goes away.
		const onWindowBlur = () => this.input.keyboard?.resetKeys();
		const onHidden = () => {
			if (document.visibilityState === 'hidden') this.input.keyboard?.resetKeys();
		};
		window.addEventListener('blur', onWindowBlur);
		document.addEventListener('visibilitychange', onHidden);
		// A text box may already hold focus when this scene (re)starts — e.g.
		// changing areas or reloading while a panel's field is active.
		if (isTypingTarget(document.activeElement)) {
			this.input.keyboard!.enabled = false;
			this.input.keyboard!.disableGlobalCapture();
		}
		// nearest-interactable highlight (pulsing ring + key hint)
		const ring = this.img(0, 0, 'ring').setTint(0xffe9a8);
		const badgeBg = this.add.circle(0, -30, 9.5, 0x2b3321, 0.92).setStrokeStyle(1.5, 0xffe9a8, 1);
		const badgeText = this.add
			.text(0, -30, this.isTouch ? '·' : 'E', {
				fontFamily: 'Quicksand, sans-serif',
				fontSize: '11px',
				color: '#f0e8d4',
				fontStyle: 'bold',
			})
			.setOrigin(0.5);
		this.highlight = this.add.container(0, 0, [ring, badgeBg, badgeText]).setDepth(6000).setVisible(false);
		const ringPulse = this.tweens.add({
			targets: ring,
			scale: { from: 0.92 * INV_TEX_SCALE, to: 1.08 * INV_TEX_SCALE },
			alpha: { from: 0.95, to: 0.6 },
			duration: 700,
			yoyo: true,
			repeat: -1,
		});
		// Honor reduce-motion: hold the ring steady instead of pulsing.
		const applyRingMotion = () => {
			if (getPrefs().reduceMotion) {
				ringPulse.pause();
				ring.setScale(INV_TEX_SCALE).setAlpha(0.95);
			} else if (ringPulse.paused) {
				ringPulse.resume();
			}
		};
		applyRingMotion();

		// Re-apply motion-sensitive visuals when accessibility prefs change: toggling
		// reduce-motion adds/removes rain/snow particles (force a rebuild by clearing
		// the weather signature), pauses/resumes the highlight-ring pulse live, and
		// rebuilds the animal layer so breathing/gait tweens (which check the pref
		// at creation) are torn down or restored immediately.
		const unsubPrefs = subscribePrefs(() => {
			if (!this.alive) return;
			this.weatherSig = '';
			this.applyWeather();
			applyRingMotion();
			this.animalSig = '';
			this.animals.clear(true, true);
			this.drawAnimals();
		});
		// Flipping a gear toggle takes effect immediately: the headlamp halo and
		// boots speed are read live each frame, and the binoculars' glint markers
		// are baked into the animal layer, so rebuild it here.
		const unsubGear = subscribeGear(() => {
			if (!this.alive) return;
			this.animalSig = '';
			this.animals.clear(true, true);
			this.drawAnimals();
		});
		this.events.once('shutdown', () => {
			document.removeEventListener('focusin', onFocusIn);
			document.removeEventListener('focusout', onFocusOut);
			window.removeEventListener('blur', onWindowBlur);
			document.removeEventListener('visibilitychange', onHidden);
			unsubPrefs();
			unsubGear();
		});

		this.tileCursor = this.img(0, 0, 'ghost-ok').setDepth(5900).setVisible(false).setAlpha(0.8);

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

		// unlockedBiomes + home config are now part of the dynamic signature, so a
		// biome unlock (opens a gate) or a home upgrade (changes the camp building)
		// changes the sig and refreshDynamic rebuilds the static features in place —
		// no scene restart, no flash.
		this.unsubs.push(
			bridge.on('world-dirty', () => {
				this.refreshDynamic();
				this.updateNodeVisuals();
				this.applyWeather();
			}),
		);
		this.unsubs.push(bridge.on('enter-placement', (p: any) => this.enterPlacement(p.objectId)));
		this.unsubs.push(bridge.on('cancel-placement', () => this.exitPlacement()));
		this.unsubs.push(bridge.on('enter-move', (p: any) => this.enterMove(p.placementId)));
		this.unsubs.push(
			bridge.on('appearance-changed', (appearance: any) => {
				if (this.alive) this.player.setTexture(makePlayerTexture(this, appearance));
			}),
		);
		// The build animation plays on the camp building; its reveal fires world-dirty,
		// and since home config is now in the dynamic signature, refreshDynamic redraws
		// the upgraded building right under the lifting tarp — a smooth transition, no
		// restart. (Indoors always rebuilds, so the decorated room updates too.)
		this.unsubs.push(bridge.on('home-upgraded', () => this.playBuild()));
		this.unsubs.push(bridge.on('tool-selected', (toolId: string) => (this.activeTool = toolId)));
		this.unsubs.push(bridge.on('mobile-interact', () => this.nearestInteractable()?.action()));
		this.unsubs.push(bridge.on('collected', (p: any) => this.playPickup(p)));
		this.unsubs.push(bridge.on('terraformed', (p: any) => this.playTerraformFx(p)));
		this.unsubs.push(
			bridge.on('area-changed', (area: string) => {
				this.exitPlacement();
				this.scene.restart({ area, spawn: this.spawnFor(area, this.area) });
			}),
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
		// Day/night lighting: snap to the current phase on entry, then hold steady
		// through each phase and ease over 15s to the next one at the boundary.
		this.applyDayNight(true);
		this.time.addEvent({ delay: 2000, loop: true, callback: () => this.applyDayNight() });
		this.input.on('pointerdown', (pointer: Phaser.Input.Pointer, over: any[]) => {
			// A panel/card/help overlay is open — swallow the click so it doesn't
			// move the player or place items on the world behind the modal.
			if (bridge.shared.uiBlocking) return;
			const tx = Math.floor(pointer.worldX / TILE);
			const ty = Math.floor(pointer.worldY / TILE);
			// paint tool (indoors): recolor whatever you click — an item, the rug,
			// the walls, or the floor underneath. While placing or moving an object,
			// a click means "drop it here", so placement/move (below) take priority.
			if (
				canPaintClick({
					tool: this.activeTool,
					isHome: this.isHome,
					placing: !!this.placementObjectId,
					moving: !!this.movingPlacementId,
				})
			) {
				const hit = (bridge.shared.state?.placements || []).find((p) => p.area === 'home' && p.x === tx && p.y === ty);
				if (hit) {
					bridge.emit('paint-click', { placementId: hit.id });
					return;
				}
				const r = this.homeRoom();
				const inFloor = tx >= r.x0 && tx <= r.x1 && ty >= r.y0 && ty <= r.y1;
				const inRing = tx >= r.x0 - 1 && tx <= r.x1 + 1 && ty >= r.y0 - 1 && ty <= r.y1 + 1;
				if (!inFloor && inRing) {
					bridge.emit('paint-click', { target: 'wall' });
					return;
				}
				if (inFloor) {
					// rug hit-test mirrors how drawHomeRoom lays the centre rug out
					const fx = r.x0 * TILE,
						fy = r.y0 * TILE;
					const fw = (r.x1 - r.x0 + 1) * TILE,
						fh = (r.y1 - r.y0 + 1) * TILE;
					const rugW = Math.min(fw - TILE * 2, TILE * (3 + r.decor));
					const rugH = Math.min(fh - TILE * 2, TILE * (2 + r.decor * 0.5));
					const cx = fx + fw / 2,
						cy = fy + fh / 2;
					const onRug =
						r.decor >= 2 && Math.abs(pointer.worldX - cx) <= rugW / 2 && Math.abs(pointer.worldY - cy) <= rugH / 2;
					bridge.emit('paint-click', onRug ? { target: 'rug' } : { target: 'floor' });
				}
				return;
			}
			if (this.movingPlacementId) {
				if (this.canPlaceAt(tx, ty, false, this.movingPlacementId)) {
					bridge.emit('move-to', { placementId: this.movingPlacementId, x: tx, y: ty, rotation: this.placeRotation });
					this.exitPlacement();
				}
				return;
			}
			if (this.placementObjectId) {
				if (this.canPlaceAt(tx, ty))
					bridge.emit('place-at', { objectId: this.placementObjectId, x: tx, y: ty, rotation: this.placeRotation });
				return;
			}
			// terraform with shovel / watering can on an empty reachable tile
			if (this.terraformAction() && (!over || over.length === 0) && this.tileReachable(tx, ty)) {
				bridge.emit('terraform-at', this.terraformPayload(tx, ty));
			}
		});
	}

	/**
	 * Windowed camera zoom that is the SAME in every biome. The base framing is a
	 * fixed VIEW_W×VIEW_H tile window derived only from the screen, so a big biome
	 * (the wide meadow) reads at exactly the same zoom as a small one — it never
	 * feels zoomed out just because the world is larger. The camera follows the
	 * caretaker (startFollow in create) and scrolls to reveal the rest by walking.
	 * + / − nudge one step in / out from this "perfect" zoom, but `fit` is kept as
	 * a floor so zooming out never reveals empty void past the world's edges (so a
	 * biome only smaller than the window in one dimension simply can't zoom out).
	 */
	private applyZoom(smooth = false) {
		const w = this.scale.width;
		const h = this.scale.height;
		// Game pixels are device pixels (see PhaserGame.tsx), so the clamp — tuned in
		// CSS pixels — scales by the display ratio to keep framing identical on HiDPI.
		const dpr = this.scale.displayScale.x || 1;
		const base = Phaser.Math.Clamp(Math.max(w / (VIEW_W * TILE), h / (VIEW_H * TILE)), 0.85 * dpr, 2.6 * dpr);
		// Indoors the `fit` floor stops the camera showing past the room's world
		// rect; outdoors the surround ring covers the widest view, so only the
		// user-zoom range applies.
		const fit = this.isIndoors ? Math.max(w / this.worldW, h / this.worldH) : 0;
		const zoom = Phaser.Math.Clamp(base * userZoom, Math.max(fit, base * USER_ZOOM_MIN), base * USER_ZOOM_MAX);
		if (smooth) this.cameras.main.zoomTo(zoom, 150, 'Sine.easeInOut');
		else this.cameras.main.setZoom(zoom);
	}

	/** + / − keys: step the camera window in or out a notch. */
	private nudgeZoom(factor: number) {
		userZoom = Phaser.Math.Clamp(userZoom * factor, USER_ZOOM_MIN, USER_ZOOM_MAX);
		this.applyZoom(true);
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
			if (action === 'clear') confirm = t('game.confirm.clearWateredBed');
			else if (action === 'water') {
				// Flooding the tile you're standing on would strand you in open
				// water, so block it outright instead of asking — same tile key the
				// movement collision uses.
				const onTile = Math.floor(this.player.x / TILE) === tx && Math.floor((this.player.y + 8) / TILE) === ty;
				if (onTile) block = t('game.block.standingHere');
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

	/**
	 * Where to stand when arriving in `area` from `from`: beside the gate on the
	 * edge that faces where you came from, computed from the destination's own
	 * grid size (biomes are different sizes now, the meadow biggest of all).
	 */
	private spawnFor(area: string, from: string): { x: number; y: number } {
		// stepping back out of the home → right in front of the camp tent door
		if (area === 'meadow' && from === 'home') return { ...CAMP_TENT_FRONT };
		// stepping out of a trail tent → right in front of where it's pitched
		if (from === `tent-${area}`) {
			const p = bridge.shared.state?.placements.find((pl) => pl.area === area && pl.objectId === 'trail-tent');
			if (p) return { x: p.x + 0.5, y: p.y + 1.4 };
		}
		const ai = AREA_ORDER.indexOf(area);
		const fi = AREA_ORDER.indexOf(from);
		if (ai < 0 || fi < 0) return { ...SPAWN_DEFAULT };
		const d = this.dimsOf(area);
		// came from the west neighbour → appear at the west edge; from the east → east edge
		return fi < ai ? { x: 1.8, y: d.gateY } : { x: d.cols - 2.2, y: d.gateY };
	}

	private savedSpawn() {
		const p = bridge.shared.state?.player;
		if (p && p.area === this.area && Number.isFinite(p.x)) {
			const x = Phaser.Math.Clamp(p.x, 1, this.worldW / TILE - 1);
			const y = Phaser.Math.Clamp(p.y, this.playTop + 1, this.worldH / TILE - 1);
			return { x, y };
		}
		return { ...SPAWN_DEFAULT };
	}

	// ------------------------------------------------------------- ground

	private drawGround() {
		this.groundTiles = [];
		this.healthDeco = [];
		if (this.isIndoors) {
			this.drawHomeRoom();
			return;
		}
		const rng = mulberry32(hashStr(this.area));
		// Ground tiles fill only the playable region; in the alpine the top rows
		// are the mountain range, drawn separately below.
		for (let ty = this.playTop; ty < this.rows; ty++) {
			for (let tx = 0; tx < this.landRight; tx++) {
				const img = this.img(tx * TILE + 16, ty * TILE + 16, 'tile').setDepth(0);
				(img as any).shade = 0.92 + rng() * 0.08;
				this.groundTiles.push(img);
			}
		}
		this.drawSurround(rng);
		this.drawEdgeGrass(rng);
		if (this.mtnRows > 0) this.drawMountainBand();
		if (this.area === 'coastal') this.drawCoastBand();
		this.tintGround();
	}

	/**
	 * The walkable edge is marked all the way around: a soft line of taller
	 * grass in the green biomes, a line of boulders in the rocky ones (alpine,
	 * desert, coastal). Where a gate leads to the next biome the line parts,
	 * and a clearly worn dirt trail runs from the world side of the gate into
	 * the biome — the way onward is obvious (the trail sits beside the gate,
	 * never underneath it).
	 */
	private drawEdgeGrass(rng: () => number) {
		const rocky = this.area === 'alpine' || this.area === 'desert' || this.area === 'coastal';
		// desert rocks bake to sandstone; alpine/coastal stay cool grey
		const rockTint = this.area === 'desert' ? C('#d8b98a') : undefined;
		// A loose, scattered line — mixed sizes, mixed sprites, generous jitter —
		// so the boundary reads as wild growth, not a solid wall of repeats.
		// each biome's edge line is drawn in its own vegetation so the boundary
		// looks like it belongs: green grass (forest mixes in trees), desert
		// straw + sandstone, alpine sage + scree, dune grass + beach rock
		const grassPrefix =
			this.area === 'desert'
				? 'drygrass'
				: this.area === 'alpine'
					? 'palegrass'
					: this.area === 'coastal'
						? 'dunegrass'
						: 'tallgrass';
		const clump = (px: number, py: number) => {
			const r = rng();
			const key = rocky
				? r < 0.45
					? 'boulder'
					: r < 0.75
						? grassPrefix
						: `${grassPrefix}3`
				: this.area === 'forest' && r < 0.25
					? 'wildtree'
					: r < 0.3
						? 'tuft'
						: grassPrefix;
			const s = (key === 'tuft' ? 1.1 : key === 'wildtree' ? 0.9 : key === 'boulder' ? 0.65 : 0.55) + rng() * 0.4;
			const jx = (rng() - 0.5) * 18;
			const jy = (rng() - 0.5) * 12;
			// depth clamps ≥1 so the top edge sorts ABOVE the ground tiles (a
			// negative-y clump would otherwise vanish beneath them)
			const img = this.img(px + jx, py + jy, key)
				.setDepth(Math.max(py + jy, 1))
				.setScale(s * INV_TEX_SCALE)
				.setAlpha(0.96);
			if (key === 'boulder') {
				if (rockTint !== undefined) img.setTint(rockTint);
			} else {
				if (key !== 'wildtree') img.setAngle(rng() * 20 - 10);
				this.healthDeco.push(img); // grass/trees along the edge recover with health
			}
		};
		const gy = this.dimsOf(this.area).gateY;
		const ai = AREA_ORDER.indexOf(this.area);
		// which edges actually lead somewhere (coastal's east is open ocean)
		const westGate = ai > 0;
		const eastGate = ai >= 0 && ai < AREA_ORDER.length - 1 && this.area !== 'coastal';
		const GAP = 2.2; // half-width (tiles) of the opening left around a gate

		// A clearly worn dirt trail heading OUT through the opening, from the
		// world edge off toward the next biome — the way onward is obvious. It
		// stays entirely outside the world, clear of the gate (which sits 1.2
		// tiles inside the edge).
		const trail = (edgeTx: number, outward: 1 | -1) => {
			const py = gy * TILE; // gate row
			const g = this.add.graphics().setDepth(0.5); // above ground, below objects
			for (let i = 0.2; i <= 3.8; i += 0.34) {
				const px = (edgeTx + i * outward) * TILE;
				const wob = Math.sin(i * 1.7) * 4;
				g.fillStyle(C('#b59a6d'), 0.95).fillEllipse(px, py + wob, TILE * 1.15, TILE * 0.78);
			}
			for (let i = 0.4; i <= 3.6; i += 0.5) {
				const px = (edgeTx + i * outward) * TILE;
				const wob = Math.sin(i * 1.7) * 4;
				g.fillStyle(C('#9c7f55'), 0.65).fillEllipse(px, py + wob, TILE * 0.6, TILE * 0.3);
			}
		};

		const step = 0.75;
		const topY = this.playTop * TILE - 6;
		const botY = this.rows * TILE + 8;
		// top & bottom lines — stopping short of the coastal surf (no edge line
		// on the ocean; the tideline IS the boundary there), and skipping the
		// alpine top entirely (the mountain range IS that boundary)
		for (let tx = -1; tx < this.cols + 1; tx += step) {
			const px = tx * TILE + 16;
			if (this.area === 'coastal' && tx > this.landRight - 1.5) continue;
			if (this.mtnRows === 0 && rng() < 0.8) clump(px, topY);
			if (rng() < 0.8) clump(px, botY);
		}
		// west & east lines, parted only around real gates (coastal has no east
		// line at all — open water needs no marker)
		for (let ty = this.playTop - 1; ty < this.rows + 1; ty += step) {
			const py = ty * TILE + 16;
			const nearGate = Math.abs(ty - gy) < GAP;
			if (!(westGate && nearGate) && rng() < 0.8) clump(-8, py);
			if (this.area !== 'coastal' && !(eastGate && nearGate) && rng() < 0.8) clump(this.landRight * TILE + 8, py);
		}
		if (westGate) trail(0, -1);
		if (eastGate) trail(this.landRight, 1);
	}

	/**
	 * The camera is unbounded outdoors (it always centers the caretaker), so
	 * ring the world with enough matching ground to cover the widest possible
	 * view. The unexplorable land is OVERGROWN: nearly every surround tile
	 * carries one of three tall-grass sprites (mixed, flipped, jittered — never
	 * a repeat pattern), so past the boundary reads as wild uncut meadow you
	 * clearly can't walk into. Rocky biomes tint the growth dry/pale. The
	 * alpine sky/mountains and the coastal ocean extend into their own
	 * surround instead (drawMountainBand / drawCoastBand).
	 */
	private drawSurround(rng: () => number) {
		// keep the outward gate trails (drawEdgeGrass) clear of growth
		const gy = this.dimsOf(this.area).gateY;
		const ai = AREA_ORDER.indexOf(this.area);
		const westGate = ai > 0;
		const eastGate = ai >= 0 && ai < AREA_ORDER.length - 1 && this.area !== 'coastal';
		const onTrail = (tx: number, ty: number) =>
			Math.abs(ty + 0.5 - gy) < 1.6 &&
			((westGate && tx < 0 && tx >= -4.5) || (eastGate && tx >= this.landRight && tx < this.landRight + 4.5));
		for (let ty = -SURROUND_Y; ty < this.rows + SURROUND_Y; ty++) {
			for (let tx = -SURROUND_X; tx < this.cols + SURROUND_X; tx++) {
				// the playable region is already drawn
				if (tx >= 0 && tx < this.landRight && ty >= this.playTop && ty < this.rows) continue;
				// the mountain band (and the sky above it) paints its own surround
				if (this.mtnRows > 0 && ty < this.playTop) continue;
				// the coastal ocean (and its surround) is painted by drawCoastBand
				if (this.area === 'coastal' && tx >= this.landRight) continue;
				const img = this.img(tx * TILE + 16, ty * TILE + 16, 'tile').setDepth(0);
				(img as any).shade = 0.92 + rng() * 0.08; // same as the playable field
				this.groundTiles.push(img);
				if (!onTrail(tx, ty)) this.surroundDeco(tx, ty, rng);
			}
		}
	}

	/**
	 * One tile's worth of wild growth in the unwalkable surround — per biome,
	 * so every boundary makes sense at a glance: uncut grass around the
	 * meadow, unbroken woods past the forest, dense reeds around the wetland,
	 * dry scrub and rock beyond the desert, scree and snow in the alpine, dune
	 * grass along the coast.
	 */
	private surroundDeco(tx: number, ty: number, rng: () => number) {
		const jx = () => tx * TILE + 16 + (rng() - 0.5) * 14;
		const jy = () => ty * TILE + 16 + (rng() - 0.5) * 12;
		const sprite = (key: string, scale: number, tint?: number, alpha = 0.97, living = false) => {
			const py = jy();
			const img = this.img(jx(), py, key)
				.setDepth(Math.max(py, 1))
				.setScale(scale * INV_TEX_SCALE)
				.setAngle(rng() * 10 - 5)
				.setAlpha(alpha)
				.setFlipX(rng() < 0.5);
			if (tint !== undefined) img.setTint(tint);
			else if (living) this.healthDeco.push(img); // recovers with biome health
			return img;
		};
		const grass = (prefix = 'tallgrass', scale = 0.8 + rng() * 0.35) => {
			const r = rng();
			sprite(r < 0.35 ? prefix : r < 0.65 ? `${prefix}2` : `${prefix}3`, scale, undefined, 0.97, true);
		};
		const roll = rng();
		switch (this.area) {
			case 'forest': // deep unbroken woods with a grassy understory
				if (roll < 0.42) sprite('wildtree', 1 + rng() * 0.5, undefined, 0.97, true).setAngle(0);
				else if (roll < 0.85) grass();
				break;
			case 'wetland': // dense marsh reeds
				if (roll < 0.9) grass('tallgrass', 0.9 + rng() * 0.4);
				break;
			case 'desert': // dry straw scrub thinning into rock and open sand
				if (roll < 0.45) grass('drygrass', 0.7 + rng() * 0.35);
				else if (roll < 0.55) sprite('boulder', 0.6 + rng() * 0.4, 0xd8b98a).setAngle(0);
				else if (roll < 0.62) sprite('pebble', 1, undefined, 0.8);
				break;
			case 'alpine': // hardy pale turf, scree, the odd snow patch
				if (roll < 0.38) grass('palegrass', 0.65 + rng() * 0.35);
				else if (roll < 0.52) sprite('boulder', 0.55 + rng() * 0.5).setAngle(0);
				else if (roll < 0.58)
					this.add.ellipse(jx(), jy(), 18 + rng() * 18, 10 + rng() * 10, 0xffffff, 0.55).setDepth(1);
				break;
			case 'coastal': // wind-blown dune grass and the odd rock
				if (roll < 0.62) grass('dunegrass', 0.7 + rng() * 0.35);
				else if (roll < 0.68) sprite('boulder', 0.55 + rng() * 0.4).setAngle(0);
				break;
			default: // meadow (and anything new): uncut wild meadow
				if (roll < 0.88) grass();
				else if (roll < 0.92) sprite('pebble', 1, undefined, 0.8);
		}
	}

	/** An interior: a cozy room of floor + walls with a door — the home (sized by
	 *  tier) or a trail tent (fixed, canvas-walled; see tentRoom). */
	private drawHomeRoom() {
		const r = this.roomSpec();
		// dark surround outside the room
		this.addDyn(this.add.rectangle(0, 0, this.worldW, this.worldH, C('#1c2216')).setOrigin(0, 0).setDepth(0));
		// wall ring (one tile thick around the floor)
		const wx = (r.x0 - 1) * TILE,
			wy = (r.y0 - 1) * TILE;
		const ww = (r.x1 - r.x0 + 3) * TILE,
			wh = (r.y1 - r.y0 + 3) * TILE;
		this.addDyn(this.add.rectangle(wx, wy, ww, wh, C(r.wall)).setOrigin(0, 0).setDepth(0.1));
		this.addDyn(this.add.rectangle(wx, wy, ww, TILE, 0x000000, 0.18).setOrigin(0, 0).setDepth(0.12)); // back-wall shadow
		// floor
		const fx = r.x0 * TILE,
			fy = r.y0 * TILE;
		const fw = (r.x1 - r.x0 + 1) * TILE,
			fh = (r.y1 - r.y0 + 1) * TILE;
		this.addDyn(this.add.rectangle(fx, fy, fw, fh, C(r.floor)).setOrigin(0, 0).setDepth(0.2));
		// faint plank grid
		for (let gx = r.x0; gx <= r.x1 + 1; gx++)
			this.addDyn(
				this.add
					.rectangle(gx * TILE, fy, 1, fh, 0x000000, 0.06)
					.setOrigin(0, 0)
					.setDepth(0.21),
			);
		for (let gy = r.y0; gy <= r.y1 + 1; gy++)
			this.addDyn(
				this.add
					.rectangle(fx, gy * TILE, fw, 1, 0x000000, 0.06)
					.setOrigin(0, 0)
					.setDepth(0.21),
			);

		// Furnishings track: a wall trim line + a centre rug that gets finer per level
		if (r.decor >= 1) {
			this.addDyn(
				this.add
					.rectangle(wx, wy + TILE - 2, ww, 3, C(r.accent), 0.5)
					.setOrigin(0, 0)
					.setDepth(0.13),
			);
		}
		if (r.decor >= 2) {
			const rugW = Math.min(fw - TILE * 2, TILE * (3 + r.decor));
			const rugH = Math.min(fh - TILE * 2, TILE * (2 + r.decor * 0.5));
			const cx = fx + fw / 2,
				cy = fy + fh / 2;
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
				this.addDyn(
					this.add
						.rectangle(wxp, wy + TILE / 2, TILE * 0.7, TILE * 0.6)
						.setStrokeStyle(2, C('#000000'), 0.25)
						.setDepth(0.141),
				);
			}
		}
		if (r.light >= 3) {
			const glow = this.addDyn(
				this.img(fx + TILE, fy + fh - TILE, 'glow')
					.setTint(0xffcf80)
					.setDepth(0.23)
					.setScale(1.6 * INV_TEX_SCALE)
					.setAlpha(0.5),
			);
			glow.setBlendMode(Phaser.BlendModes.ADD);
			this.tweens.add({
				targets: glow,
				alpha: { from: 0.5, to: 0.32 },
				duration: 1400,
				yoyo: true,
				repeat: -1,
				ease: 'Sine.easeInOut',
			});
		}

		// door on the bottom wall, with a welcome mat just inside it
		const dpx = r.doorX * TILE + 16;
		this.addDyn(this.add.rectangle(dpx, (r.y1 + 1) * TILE + 16, TILE * 0.82, TILE * 1.1, C('#33251a')).setDepth(0.3));
		this.addDyn(this.add.rectangle(dpx, (r.y1 + 1) * TILE + 14, TILE * 0.6, TILE * 0.92, C('#5a3f28')).setDepth(0.31));
		this.addDyn(
			this.add
				.rectangle(dpx, r.doorY * TILE + 16, TILE * 0.95, TILE * 0.55, C(r.accent))
				.setDepth(0.25)
				.setAlpha(0.7),
		);
	}

	/** Refresh an interior (home or trail tent): placed decor + the exit door. */
	private refreshHome() {
		this.waterTiles = new Set();
		this.waterTileCenters = [];
		this.bridgeTiles = new Set();
		this.drawHomeRoom(); // repaint floor/walls/rug so live recolors show immediately
		this.drawPlacements();
		const r = this.roomSpec();
		// the door back out, bottom-center: home → meadow, tent → its biome
		const outside = this.tentBiome || 'meadow';
		this.registerInteractable({
			x: r.doorX * TILE + 16,
			y: r.doorY * TILE + 16,
			label: t('game.label.stepOutside'),
			action: () => bridge.emit('request-area', { area: outside }),
		});
	}

	/** Static, impassable open ocean down the east edge of Pelican Shore. */
	private drawCoastBand() {
		const edgeX = this.landRight * TILE; // where land meets the surf
		// the sea continues through the surround (north, south, east)
		const y0 = -SURROUND_Y * TILE;
		const h = this.worldH + SURROUND_Y * TILE * 2;
		// deep sea fills the reserved columns out past the world edge
		this.add
			.rectangle(edgeX, y0, this.worldW + SURROUND_X * TILE - edgeX, h, C('#2f6f9e'))
			.setOrigin(0, 0)
			.setDepth(0.1);
		// banded water: a lighter shallow strip near shore, deeper blue beyond
		this.add
			.rectangle(edgeX, y0, TILE * 1.6, h, C('#5aa6cf'))
			.setOrigin(0, 0)
			.setDepth(0.12);
		this.add
			.rectangle(edgeX + TILE * 1.6, y0, TILE * 1.3, h, C('#3f8cbb'))
			.setOrigin(0, 0)
			.setDepth(0.12);
		// a damp-sand tideline where the beach gives way to water
		this.add
			.rectangle(edgeX - 6, y0, 12, h, C('#bda572'))
			.setOrigin(0, 0)
			.setDepth(0.13)
			.setAlpha(0.7);
		// rolling foam lines that breathe in and out along the shore
		for (let i = 0; i < 7; i++) {
			const y = (i + 0.5) * (h / 7);
			const foam = this.add.ellipse(edgeX + 4, y, TILE * 1.5, 10, 0xffffff, 0.5).setDepth(0.14);
			this.tweens.add({
				targets: foam,
				x: edgeX + 4 + TILE * 0.6,
				alpha: { from: 0.5, to: 0.15 },
				duration: 1800 + i * 160,
				yoyo: true,
				repeat: -1,
				ease: 'Sine.easeInOut',
			});
			// sun-glints further out
			const glint = this.add.ellipse(edgeX + TILE * (2 + (i % 2)), y - 14, 9, 4, 0xffffff, 0.4).setDepth(0.14);
			this.tweens.add({
				targets: glint,
				alpha: { from: 0.4, to: 0.05 },
				duration: 1300 + i * 130,
				yoyo: true,
				repeat: -1,
				ease: 'Sine.easeInOut',
			});
		}
		// a couple of half-buried rocks at the waterline for texture
		const rng = mulberry32(hashStr('coast-rocks'));
		for (let i = 0; i < 5; i++) {
			const ry = (1 + rng() * (this.baseRows - 2)) * TILE;
			this.add.ellipse(edgeX - 4 + rng() * 6, ry, 16 + rng() * 10, 10, C('#7d7a72')).setDepth(0.15);
		}
	}

	/** Static, impassable snow-capped range across the top of Graywind Heights. */
	private drawMountainBand() {
		const bandH = this.playTop * TILE;
		const W = this.worldW;
		const PAD = SURROUND_X * TILE; // the range continues across the surround
		const PAD_Y = SURROUND_Y * TILE;
		const g = this.add.graphics().setDepth(0.1);
		// cool, high-altitude sky behind the range (covers the surround above too)
		g.fillStyle(C('#c6cfdc'), 1).fillRect(-PAD, -PAD_Y, W + PAD * 2, bandH + PAD_Y);
		const rng = mulberry32(hashStr('graywind-range'));

		// One jagged silhouette layer: a straight base with a peaked top edge. Peaks
		// are drawn crisp as polygons (no texture scaling), sized to the band, so the
		// range stays sharp however tall the band is. Returns the peak apexes.
		const range = (color: number, base: number, lo: number, hi: number, step: number): { x: number; y: number }[] => {
			const pts: Phaser.Geom.Point[] = [new Phaser.Geom.Point(-PAD - 4, bandH + 2)];
			const peaks: { x: number; y: number }[] = [];
			let x = -PAD - step * 0.5;
			while (x < W + PAD + step) {
				const ph = lo + rng() * (hi - lo); // this peak's height above the base
				const px = x + rng() * step * 0.5;
				peaks.push({ x: px, y: base - ph });
				pts.push(new Phaser.Geom.Point(px, base - ph)); // peak
				// saddle sits partway down the peak so ridges connect, not spikes
				pts.push(new Phaser.Geom.Point(px + step * 0.5, base - ph * (0.42 + rng() * 0.18)));
				x += step;
			}
			pts.push(new Phaser.Geom.Point(W + PAD + 4, bandH + 2));
			g.fillStyle(color, 1);
			g.fillPoints(pts, true);
			return peaks;
		};

		// three receding ranges: hazy far → cool mid → dark, tall near
		range(C('#aebaca'), bandH * 0.86, bandH * 0.34, bandH * 0.58, 150);
		range(C('#8d97ab'), bandH * 1.02, bandH * 0.52, bandH * 0.8, 200);
		const near = range(C('#6b7384'), bandH * 1.04, bandH * 0.72, bandH * 1.02, 250);

		// snow caps on the tall near peaks
		g.fillStyle(C('#eef4fb'), 0.95);
		const cap = Math.max(10, bandH * 0.11);
		for (const p of near) {
			if (p.y > bandH * 0.55) continue; // only the ones that rise high
			g.fillTriangle(p.x, p.y + 1, p.x - cap * 0.55, p.y + cap, p.x + cap * 0.55, p.y + cap);
		}
		// soft snowline mist where rock meets the slope
		g.fillStyle(0xffffff, 0.16).fillRect(-PAD, bandH - 7, W + PAD * 2, 7);
	}

	private tintGround() {
		if (this.isIndoors) return; // interiors have their own floor, not a biome ground tint
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
		let baseR = mix.r,
			baseG = mix.g,
			baseB = mix.b;
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
		// Surround/edge vegetation withers to a dry brown when the biome is sick and
		// greens back up as it heals — a multiplicative tint from "dead" toward white
		// (white = the sprite's own colour) by health.
		const dead = Phaser.Display.Color.HexStringToColor('#9c8a5a');
		const dmix = Phaser.Display.Color.Interpolate.ColorWithColor(
			dead,
			{ r: 255, g: 255, b: 255, a: 255 } as any,
			100,
			Math.round(t * 100),
		);
		const decoTint = Phaser.Display.Color.GetColor(dmix.r, dmix.g, dmix.b);
		for (const img of this.healthDeco) img.setTint(decoTint);
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
		if (this.isIndoors) return 'clear';
		return liveWeatherType(this.worldId, this.area, bridge.shared.state?.weather);
	}

	/** `entering` = the player just walked into this biome (scene create/restart),
	 *  so pre-fill the rain/snow so it's already established — unless this is the
	 *  very first weather of the session, which is allowed to animate in. Weather
	 *  that changes while you're standing here always animates in. */
	private applyWeather(entering = false) {
		if (!this.alive) return;
		const typeId = this.currentWeatherType();
		const sig = `${typeId}|${this.isIndoors ? 'in' : 'out'}`;
		if (sig === this.weatherSig) return;
		this.weatherSig = sig;

		const wt = weatherType(typeId);
		this.ensureWeatherOverlay();
		if (!this.isIndoors && wt.overlay) {
			this.weatherOverlay!.setFillStyle(C(wt.overlay.color)).setAlpha(wt.overlay.alpha).setVisible(true);
		} else {
			this.weatherOverlay!.setVisible(false);
		}
		// Reduced-motion players get the weather color/overlay but not the animated
		// rain/snow particles (the colorblind banner still names the weather).
		const prewarm = entering && weatherShownThisSession;
		const particle = this.isIndoors || getPrefs().reduceMotion ? null : wt.particle;
		this.setWeatherParticles(particle, prewarm);
		weatherShownThisSession = true;
		// Weather-gated gather nodes appear/vanish with the weather, so redraw the
		// dynamic layer whenever the type turns over.
		this.refreshDynamic();
	}

	private ensureWeatherOverlay() {
		if (this.weatherOverlay) return;
		this.weatherOverlay = this.add
			.rectangle(-3000, -3000, 9000, 9000, 0xffffff, 0)
			.setOrigin(0, 0)
			.setScrollFactor(0)
			.setDepth(5005)
			.setVisible(false);
	}

	/** Free-running 0..1 day progress. Mirrors the HUD's DayTimer: anchor to the
	 *  snapshot's play-time, then advance on wall time (so the cycle keeps moving
	 *  while idle), re-syncing only when the snapshot's day actually moves. */
	private currentDayProgress(): number | null {
		const snap = bridge.shared.state?.weather;
		if (!snap) return null;
		const dayMs = snap.dayMs || 720000;
		const base = (snap.dayIndex + snap.dayProgress) * dayMs;
		if (!this.dayAnchor || base !== this.lastSnapDay) {
			this.dayAnchor = { base, wall: Date.now() };
			this.lastSnapDay = base;
		}
		const now = this.dayAnchor.base + (Date.now() - this.dayAnchor.wall);
		return (((now % dayMs) + dayMs) % dayMs) / dayMs;
	}

	private ensureLightOverlay() {
		if (this.lightOverlay) return;
		// Sits just above the weather tint, camera-locked, below any UI/sleep dim.
		this.lightOverlay = this.add
			.rectangle(-3000, -3000, 9000, 9000, 0xffffff, 0)
			.setOrigin(0, 0)
			.setScrollFactor(0)
			.setDepth(5006)
			.setVisible(false);
	}

	private ensureSkyOverlay() {
		if (this.skyOverlay) return;
		// One-time vertical gradient texture: opaque (white) at the top, fading to
		// clear by ~80% down. Tinted per phase; stretched to the camera view each
		// frame so the warm band always hugs the top of the screen.
		if (!this.textures.exists('sky-glow')) {
			const H = 256;
			const ct = this.textures.createCanvas('sky-glow', 8, H);
			if (ct) {
				const g = ct.getContext().createLinearGradient(0, 0, 0, H);
				g.addColorStop(0, 'rgba(255,255,255,1)');
				g.addColorStop(0.45, 'rgba(255,255,255,0.4)');
				g.addColorStop(0.8, 'rgba(255,255,255,0)');
				g.addColorStop(1, 'rgba(255,255,255,0)');
				const cx = ct.getContext();
				cx.fillStyle = g;
				cx.fillRect(0, 0, 8, H);
				ct.refresh();
			}
		}
		this.skyOverlay = this.add.image(0, 0, 'sky-glow').setOrigin(0, 0).setDepth(5007).setVisible(false);
	}

	/** Keep the sky-glow gradient covering the visible camera area (top of the
	 *  gradient = top of the screen) as the camera follows the player. */
	private positionSkyOverlay() {
		if (!this.skyOverlay?.visible) return;
		const v = this.cameras.main.worldView;
		this.skyOverlay.setPosition(v.x, v.y).setDisplaySize(v.width, v.height);
	}

	/** Day/night lighting. Each phase (dawn/day/dusk/night — equal quarters of the
	 *  day) holds a steady tint; when the play-time clock crosses into the next
	 *  phase, the tint eases over ~15s to that phase's colour and then holds again.
	 *  The phase comes from the same clock the HUD shows, so they stay in sync.
	 *  Outdoors only — the home keeps its own lighting. */
	private applyDayNight(snap = false) {
		if (!this.alive) return;
		this.ensureLightOverlay();
		this.ensureSkyOverlay();
		// Accessibility: no day/night cycle for reduce-motion OR colorblind mode —
		// hold a clear, steady daytime look. Reduce-motion avoids the animated fades
		// (and the abrupt luminance swing a snap would cause); colorblind mode keeps
		// the palette true instead of shifting every colour under a tint.
		const prefs = getPrefs();
		if (prefs.reduceMotion || prefs.colorblindMode !== 'off') {
			this.lightTween?.stop();
			this.skyTween?.stop();
			this.lightPhase = 'off'; // so it re-applies the real phase if turned back on
			this.lightState = { r: 255, g: 255, b: 255, a: 0 };
			this.skyState = { r: 255, g: 255, b: 255, a: 0 };
			this.lightOverlay!.setVisible(false);
			this.skyOverlay!.setVisible(false);
			return;
		}
		if (this.isIndoors) {
			this.lightOverlay!.setVisible(false);
			this.skyOverlay!.setVisible(false);
			return;
		}
		const progress = this.currentDayProgress();
		if (progress == null) return;
		const phase = phaseAtProgress(progress);
		if (phase === this.lightPhase && !snap) return; // mid-phase — hold steady
		this.lightPhase = phase;
		const st = dayPhaseStyle(phase);
		const flat = Phaser.Display.Color.IntegerToColor(C(st.color));
		const skyC = Phaser.Display.Color.IntegerToColor(C(st.sky?.color || '#ffffff'));
		const skyA = st.sky?.alpha || 0;
		const paint = () => {
			this.lightOverlay!.setFillStyle(
				Phaser.Display.Color.GetColor(
					Math.round(this.lightState.r),
					Math.round(this.lightState.g),
					Math.round(this.lightState.b),
				),
			)
				.setAlpha(this.lightState.a)
				.setVisible(this.lightState.a > 0.001);
			const s = this.skyState;
			this.skyOverlay!.setTint(Phaser.Display.Color.GetColor(Math.round(s.r), Math.round(s.g), Math.round(s.b)))
				.setAlpha(s.a)
				.setVisible(s.a > 0.001);
			this.positionSkyOverlay();
		};
		this.lightTween?.stop();
		this.skyTween?.stop();
		if (snap) {
			this.lightState = { r: flat.red, g: flat.green, b: flat.blue, a: st.alpha };
			this.skyState = { r: skyC.red, g: skyC.green, b: skyC.blue, a: skyA };
			paint();
			return;
		}
		// ~15s ease from the old phase's lighting to the new one (flat + sky glow).
		this.lightTween = this.tweens.add({
			targets: this.lightState,
			r: flat.red,
			g: flat.green,
			b: flat.blue,
			a: st.alpha,
			duration: 15000,
			ease: 'Sine.easeInOut',
			onUpdate: paint,
			onComplete: paint,
		});
		this.skyTween = this.tweens.add({
			targets: this.skyState,
			r: skyC.red,
			g: skyC.green,
			b: skyC.blue,
			a: skyA,
			duration: 15000,
			ease: 'Sine.easeInOut',
			onUpdate: paint,
			onComplete: paint,
		});
	}

	/** Has this player ever crafted a piece of gear? Gear is a `once: true` recipe
	 *  kept forever — craftedEver survives even if the save's inventory shifts. */
	private ownsGear(itemId: string): boolean {
		const p = bridge.shared.state?.player;
		if (!p) return false;
		return (p.craftedEver?.[itemId] || 0) + (p.craftedItems?.[itemId] || 0) > 0;
	}

	/** Headlamp active = owned AND switched on in Tools & Upgrades. When on, it
	 *  lights the ground around you after dusk. */
	private hasHeadlamp(): boolean {
		return this.ownsGear('headlamp') && gearOn('headlamp');
	}

	/** Field binoculars active = owned AND switched on. When on, animals not yet
	 *  recorded in the journal get a soft glint. */
	private hasBinoculars(): boolean {
		return this.ownsGear('binoculars') && gearOn('binoculars');
	}

	/** Hiking boots active = owned AND switched on. When on, you walk a little
	 *  faster across the preserve. */
	private hasBoots(): boolean {
		return this.ownsGear('hiking-boots') && gearOn('boots');
	}

	/** Lazily build the night-light visuals: a shared radial-gradient texture,
	 *  the lamp's warm additive halo, and (WebGL only) the screen-space
	 *  RenderTexture whose stamped alpha carves holes in the night tint. */
	private ensureHeadlamp() {
		if (this.lampGlow) return;
		if (!this.textures.exists('headlamp-light')) {
			const D = 256;
			const ct = this.textures.createCanvas('headlamp-light', D, D);
			if (ct) {
				const cx = ct.getContext();
				const g = cx.createRadialGradient(D / 2, D / 2, 0, D / 2, D / 2, D / 2);
				g.addColorStop(0, 'rgba(255,255,255,1)');
				g.addColorStop(0.5, 'rgba(255,255,255,0.55)');
				g.addColorStop(1, 'rgba(255,255,255,0)');
				cx.fillStyle = g;
				cx.fillRect(0, 0, D, D);
				ct.refresh();
			}
		}
		// halo: a tight personal pool, layered BENEATH the caretaker (depth is
		// re-pinned to just under the player each frame) so light falls on the
		// ground and the character stands in front of it.
		this.lampGlow = this.add
			.image(0, 0, 'headlamp-light')
			.setBlendMode(Phaser.BlendModes.ADD)
			.setTint(0xffd98a)
			.setDisplaySize(TILE * 4, TILE * 4)
			.setVisible(false);
		// mask: a screen-sized RenderTexture, stamped once per light source each
		// frame and used as a single inverted bitmap mask — the tint is removed
		// wherever ANY light shines (BitmapMask needs WebGL — on canvas the
		// additive halos alone still read as light)
		if (this.game.renderer.type === Phaser.WEBGL) {
			this.lightMaskRT = this.make.renderTexture(
				{ x: 0, y: 0, width: this.scale.width, height: this.scale.height },
				false,
			);
			this.lightMaskRT.setOrigin(0, 0).setScrollFactor(0);
			this.lightBrush = this.make.image({ key: 'headlamp-light', add: false });
			this.lightBitmapMask = this.lightMaskRT.createBitmapMask() as Phaser.Display.Masks.BitmapMask;
			this.lightBitmapMask.invertAlpha = true;
		}
	}

	// mask hole sizes (display px): the lamp is a tight personal pool; a campfire
	// throws a wider ring of light
	private static readonly LAMP_MASK = TILE * 5;
	private static readonly FIRE_MASK = TILE * 9;

	/** Every burning fire in this area (world px): the meadow base-camp fire plus
	 *  any placed campfires. These push back the night tint just like the lamp. */
	private firesHere(): { x: number; y: number }[] {
		const fires: { x: number; y: number }[] = [];
		if (this.area === 'meadow') fires.push({ x: CAMP.fire.x * TILE, y: CAMP.fire.y * TILE });
		for (const p of bridge.shared.state?.placements || []) {
			if (p.area === this.area && p.objectId === 'campfire') fires.push({ x: p.x * TILE + 16, y: p.y * TILE + 16 });
		}
		return fires;
	}

	/** Per-frame night-light update. Only active when it's actually dark (night
	 *  tint meaningfully opaque — dusk/dawn washes don't need it, and reduce-
	 *  motion/colorblind modes hold daylight so it never runs there). The lamp
	 *  follows the player; fires burn where they stand; every light's strength
	 *  tracks the tint as night eases in and out. */
	private updateNightLights() {
		const dark = !this.isIndoors && !!this.lightOverlay?.visible && this.lightState.a > 0.15;
		const hasLamp = this.hasHeadlamp();
		const fires = dark ? this.firesHere() : [];
		if (!dark || (!hasLamp && fires.length === 0)) {
			if (this.lampGlow?.visible) this.lampGlow.setVisible(false);
			if (this.lightOverlay?.mask) this.lightOverlay.clearMask();
			return;
		}
		this.ensureHeadlamp();
		// 0..1 as the night tint fades in (0.66 = full night, see weather.json)
		const depth = Phaser.Math.Clamp(this.lightState.a / 0.66, 0, 1);
		const x = this.player.x,
			y = this.player.y;
		// halo pinned just beneath the caretaker so they stand in front of the light
		this.lampGlow!.setPosition(x, y)
			.setDepth(y - 4)
			.setAlpha(hasLamp ? 0.3 * depth : 0)
			.setVisible(hasLamp);
		if (!this.lightMaskRT || !this.lightBrush || !this.lightBitmapMask) return; // canvas renderer: halos only
		// The night tint is screen-space (scrollFactor 0), so the mask is too: a
		// screen-sized RenderTexture, restamped each frame at each light's
		// on-screen position (world → screen via the camera view + zoom).
		const rt = this.lightMaskRT;
		if (rt.width !== this.scale.width || rt.height !== this.scale.height) {
			rt.resize(this.scale.width, this.scale.height);
		}
		const cam = this.cameras.main;
		const stamp = (wx: number, wy: number, size: number, alpha: number) => {
			const s = size * cam.zoom;
			this.lightBrush!.setDisplaySize(s, s).setAlpha(alpha);
			rt.draw(this.lightBrush!, (wx - cam.worldView.x) * cam.zoom, (wy - cam.worldView.y) * cam.zoom);
		};
		rt.clear();
		// the lamp never fully clears the night (max ~0.8 mask alpha) — a modest
		// personal glow, dimmer and tighter than a campfire's
		if (hasLamp) stamp(x, y, WorldScene.LAMP_MASK, Math.min(0.8, depth * 0.9));
		// steady light — no flicker; the lit edge holds still so night reads calmly
		fires.forEach((f) => {
			stamp(f.x, f.y - 6, WorldScene.FIRE_MASK, Math.min(1, depth * 1.35));
		});
		if (!this.lightOverlay!.mask) this.lightOverlay!.setMask(this.lightBitmapMask);
	}

	/** Lazily build the 1-colour rain streak and snow dot textures.
	 * Supersampled like every other texture (see textures.ts) — the emitter
	 * configs compensate with INV_TEX_SCALE particle scales. */
	private ensureWeatherTextures() {
		const S = TEX_SCALE;
		if (!this.textures.exists('wx-rain')) {
			const g = this.make.graphics({ x: 0, y: 0 });
			g.scaleCanvas(S, S).fillStyle(0xbcd2e8, 1).fillRect(0, 0, 2, 12);
			g.generateTexture('wx-rain', 2 * S, 12 * S);
			g.destroy();
		}
		if (!this.textures.exists('wx-snow')) {
			const g = this.make.graphics({ x: 0, y: 0 });
			g.scaleCanvas(S, S).fillStyle(0xffffff, 1).fillCircle(3, 3, 3);
			g.generateTexture('wx-snow', 6 * S, 6 * S);
			g.destroy();
		}
	}

	/**
	 * Swap in (or clear) the falling-weather emitter. Particles are world-locked
	 * and emitted across the full map width so the fall looks uniform wherever the
	 * camera is; they sit above the colour tints so they stay crisp.
	 */
	private setWeatherParticles(kind: 'rain' | 'snow' | null, prewarm = false) {
		if (this.weatherEmitter) {
			this.weatherEmitter.destroy();
			this.weatherEmitter = undefined;
		}
		if (!kind) return;
		this.ensureWeatherTextures();
		// Emit only in a band around the camera instead of across the whole map —
		// the emitter follows the camera in update(). Off-screen particles were
		// still simulated every frame, and on big maps (Graywind under 13s-lifespan
		// snow) that meant hundreds of invisible particles; playtest reported
		// slowdowns there on integrated graphics. Already-fallen particles are
		// world-locked, so panning the camera doesn't drag the weather along.
		const worldSpan = this.worldW + 2 * (SURROUND_X * TILE + 40);
		const span = Math.min(worldSpan, this.scale.width * 2.4);
		const lifespan = kind === 'rain' ? 1700 : 13000;
		if (kind === 'rain') {
			this.weatherEmitter = this.add
				.particles(0, 0, 'wx-rain', {
					x: { min: -span / 2, max: span / 2 },
					y: 0,
					lifespan,
					speedY: { min: 520, max: 700 },
					speedX: { min: -60, max: -20 },
					scaleX: INV_TEX_SCALE,
					scaleY: { min: 0.8 * INV_TEX_SCALE, max: 1.5 * INV_TEX_SCALE },
					alpha: { min: 0.25, max: 0.5 },
					quantity: 2,
					frequency: 26,
					maxAliveParticles: 220,
				})
				.setDepth(5020);
		} else {
			this.weatherEmitter = this.add
				.particles(0, 0, 'wx-snow', {
					x: { min: -span / 2, max: span / 2 },
					y: 0,
					lifespan,
					speedY: { min: 55, max: 85 },
					speedX: { min: -25, max: 25 },
					scale: { min: 0.45 * INV_TEX_SCALE, max: 1 * INV_TEX_SCALE },
					alpha: { min: 0.5, max: 0.9 },
					quantity: 1,
					frequency: 55,
					maxAliveParticles: 240,
				})
				.setDepth(5020);
		}
		this.positionWeatherEmitter();
		// Pre-fill so the screen is already full of falling weather on biome entry
		// (Phaser advances the emitter as if `lifespan` ms had already elapsed).
		// Coarser step (500ms) keeps snow's 13s prewarm from simulating in one
		// frame — the screen still fills, but the spike on biome entry is gone.
		if (prewarm) this.weatherEmitter.fastForward(lifespan, 500);
	}

	/** Keep the emit band parked just above the camera's view. */
	private positionWeatherEmitter() {
		if (!this.weatherEmitter) return;
		const v = this.cameras.main.worldView;
		this.weatherEmitter.setPosition(v.centerX, v.y - 30);
	}

	// ------------------------------------------------- dynamic world objects

	/** Signature of everything the dynamic layer draws — terrain, placements, node
	 *  layout inputs, biome health (tint/doodads) and the current weather (which
	 *  spawns weather-gated nodes). If it's unchanged, the previously built layer
	 *  is already correct, so we skip the full teardown+rebuild (and the dozens of
	 *  ambient tweens that came with it). world-dirty fires on every gather, place,
	 *  and boot nudge, so most fires are no-ops that used to rebuild everything. */
	private computeDynamicSig(): string {
		const st = bridge.shared.state;
		if (!st) return '';
		const health = st.biomeStates.find((b) => b.biomeId === this.area)?.health ?? 5;
		const terrain = (st.terrain || [])
			.filter((tt) => tt.area === this.area)
			.map((tt) => `${tt.x},${tt.y}:${tt.type}`)
			.sort()
			.join('|');
		const placements = (st.placements || [])
			.filter((pl) => pl.area === this.area)
			.map(
				(pl) =>
					`${pl.id}:${pl.objectId}:${pl.x},${pl.y}:${pl.rotation || 0}:${pl.plantedAt || 0}:${(pl as any).lastHarvestAt || 0}`,
			)
			.sort()
			.join('|');
		const wx = liveWeatherType(this.worldId, this.area, st.weather);
		// Unlock state and home config also drive static features (gates open when a
		// biome unlocks; the camp building changes as the home is built/upgraded), so
		// they belong in the signature — otherwise refreshDynamic skips the rebuild
		// and those stay stale until an area change.
		const unlocked = (st.player?.unlockedBiomes || []).slice().sort().join(',');
		const h: any = st.player?.home || {};
		const home = `${h.style || ''}:${h.styleLocked ? 1 : 0}:${h.space || 0}:${h.comfort || 0}:${h.decor || 0}:${h.light || 0}`;
		return `${this.area}#h${health}#wx${wx}#t${terrain}#p${placements}#u${unlocked}#hm${home}`;
	}

	private refreshDynamic(force = false) {
		if (!this.alive) return;
		// Skip the rebuild when nothing the dynamic layer depends on has changed.
		// Indoors always rebuilds — it's a single cheap room, and the paint tool
		// repaints walls/rugs/placements live (colour changes aren't in the sig).
		if (!force && !this.isIndoors) {
			const sig = this.computeDynamicSig();
			if (sig === this.dynamicSig) return;
			this.dynamicSig = sig;
		}
		this.dynamic.clear(true, true);
		this.nodeSprites.clear();
		this.interactables = [];
		this.hoveredIt = null; // its hit zone was just destroyed; a fresh pointerover will re-set it
		if (this.isIndoors) {
			this.refreshHome();
			return;
		}
		// collision lookups: open water blocks walking unless bridged
		const st = bridge.shared.state;
		this.waterTiles = new Set(
			(st?.terrain || []).filter((tt) => tt.area === this.area && tt.type === 'water').map((tt) => `${tt.x},${tt.y}`),
		);
		// pixel centers of every open-water tile — fish live here, walkers avoid it
		this.waterTileCenters = [...this.waterTiles].map((k) => {
			const [tx, ty] = k.split(',').map(Number);
			return { x: tx * TILE + 16, y: ty * TILE + 16 };
		});
		this.bridgeTiles = new Set(
			(st?.placements || [])
				.filter((pl) => pl.area === this.area && this.objectDef(pl.objectId)?.bridge)
				.map((pl) => `${pl.x},${pl.y}`),
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
		// With binoculars, the sig also tracks which animals are still unrecorded, so
		// the glint markers appear the moment they're crafted and clear on observing.
		const binos = this.hasBinoculars();
		const sig =
			this.area +
			'|' +
			(binos ? 'b|' : '') +
			here
				.map((d) => `${d.animalId}:${d.comfort ?? ''}${binos && !d.timesObserved ? ':new' : ''}`)
				.sort()
				.join(',');
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
				const img = this.addDyn(this.img(x, y, 'terrain-water').setDepth(1.6));
				this.tweens.add({
					targets: img,
					alpha: { from: 1, to: 0.86 },
					duration: 1300 + ((tile.x + tile.y) % 4) * 180,
					yoyo: true,
					repeat: -1,
					ease: 'Sine.easeInOut',
				});
				continue;
			}
			this.addDyn(this.img(x, y, tile.type === 'watered' ? 'watered' : 'tilled').setDepth(1.5));
			if (tile.type === 'watered') {
				// watered beds are ready for planting; terraform clicks still reach the
				// soil here so the can/shovel can flood or clear it (with confirmation)
				this.registerInteractable(
					{
						x,
						y,
						label: t('game.label.plantBed'),
						action: () => bridge.emit('bed-clicked', { area: this.area, x: tile.x, y: tile.y }),
					},
					undefined,
					{ terraformPassthrough: true },
				);
			}
		}
	}

	/** Wire an interactable so it can also be tapped/clicked directly (mobile-first). */
	private registerInteractable(
		it: Interactable,
		hitObject?: Phaser.GameObjects.GameObject,
		opts: { terraformPassthrough?: boolean } = {},
	) {
		this.interactables.push(it);
		const target =
			hitObject ||
			this.addDyn(this.add.zone(it.x, it.y, 52, 52).setOrigin(0.5).setInteractive({ useHandCursor: true }));
		// Hover feedback: light up the interactable under the pointer even before you
		// reach it, so it's clear what a click will act on (visuals are unchanged).
		target.on('pointerover', () => {
			if (!bridge.shared.uiBlocking) this.hoveredIt = it;
		});
		target.on('pointerout', () => {
			if (this.hoveredIt === it) this.hoveredIt = null;
		});
		target.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
			if (bridge.shared.uiBlocking) return; // a modal is open — clicks don't reach the world
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
			if (dist <= 120) it.action();
			else bridge.emit('toast', { text: t('game.toast.walkCloser'), kind: 'info' });
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
			if (
				this.area === 'meadow' &&
				x > (CAMP_BLOCK.x0 - 0.4) * TILE &&
				x < (CAMP_BLOCK.x1 + 0.4) * TILE &&
				y > (CAMP_BLOCK.y0 - 0.4) * TILE &&
				y < (CAMP_BLOCK.y1 + 0.4) * TILE
			)
				return null;
			return { x, y };
		};
		const scatter = (key: string, count: number, alpha = 1) => {
			for (let i = 0; i < count; i++) {
				const p = spot();
				if (!p) continue;
				this.addDyn(
					this.img(p.x, p.y, key)
						.setDepth(1)
						.setAlpha(alpha)
						.setAngle(rng() * 20 - 10),
				);
			}
		};
		// density scales with the biome's playable area so big maps aren't barren
		const dScale = Math.max(1, (this.landRight * (this.rows - this.playTop)) / (30 * 20));

		// Graywind Heights reads as high, rocky tundra — scree, boulders and snow
		// patches dominate; even fully restored it stays sparse and grey-green, not
		// a lush green meadow.
		if (this.area === 'alpine') {
			scatter('crack', Math.round(((100 - health) / 100) * 18 * dScale), 0.7);
			scatter('pebble', Math.round(30 * dScale), 0.85); // heavy scree
			// scattered boulders (bigger grey rocks)
			for (let i = 0; i < Math.round(16 * dScale); i++) {
				const p = spot();
				if (!p) continue;
				const w = 16 + rng() * 16;
				this.addDyn(this.add.ellipse(p.x, p.y, w, w * 0.72, C('#8f8e88')).setDepth(1));
				this.addDyn(
					this.add
						.ellipse(p.x - w * 0.15, p.y - w * 0.18, w * 0.5, w * 0.32, C('#a7a69f'))
						.setDepth(1.01)
						.setAlpha(0.8),
				);
			}
			// snow patches — more as the slope recovers and holds snowmelt
			for (let i = 0; i < Math.round((6 + (health / 100) * 16) * dScale); i++) {
				const p = spot();
				if (!p) continue;
				this.addDyn(this.add.ellipse(p.x, p.y, 20 + rng() * 22, 12 + rng() * 12, 0xffffff, 0.7).setDepth(0.9));
			}
			// only sparse alpine turf + a few hardy blooms, never a full green carpet
			scatter('tuft', Math.round(((health / 100) * 14 + 3) * dScale), 0.85);
			scatter('tinyflower', Math.max(0, Math.round(((health - 40) / 100) * 10 * dScale)));
			return;
		}

		scatter('crack', Math.round(((100 - health) / 100) * 26 * dScale), 0.8);
		scatter('pebble', Math.round(12 * dScale), 0.8);
		scatter('tuft', Math.round(((health / 100) * 44 + 4) * dScale));
		scatter('tinyflower', Math.max(0, Math.round(((health - 25) / 100) * 26 * dScale)));
	}

	private addDyn<T extends Phaser.GameObjects.GameObject>(obj: T): T {
		this.dynamic.add(obj);
		return obj;
	}

	/**
	 * `add.image` wrapper — procedural textures are TEX_SCALE× supersampled
	 * (see textures.ts), so every sprite renders at INV_TEX_SCALE to appear at
	 * its logical size. Any later setScale must multiply by INV_TEX_SCALE too.
	 */
	private img(x: number, y: number, key: string): Phaser.GameObjects.Image {
		return this.add.image(x, y, key).setScale(INV_TEX_SCALE);
	}

	/** The little four-point star used wherever the world says "something here
	 *  for you" — harvest-ready plants and the binoculars' unrecorded-animal
	 *  marker share it, so the cue reads the same across the preserve. */
	private ensureMoteTexture() {
		if (this.textures.exists('harvest-mote')) return;
		const g = this.make.graphics({ x: 0, y: 0 }, false);
		g.scaleCanvas(TEX_SCALE, TEX_SCALE);
		g.fillStyle(0xffffff, 1).fillPoints(
			[
				{ x: 5, y: 0 },
				{ x: 6.2, y: 3.8 },
				{ x: 10, y: 5 },
				{ x: 6.2, y: 6.2 },
				{ x: 5, y: 10 },
				{ x: 3.8, y: 6.2 },
				{ x: 0, y: 5 },
				{ x: 3.8, y: 3.8 },
			],
			true,
		);
		g.generateTexture('harvest-mote', 10 * TEX_SCALE, 10 * TEX_SCALE);
		g.destroy();
	}

	/**
	 * A gentle golden shimmer over a trail gate that's been unlocked but not yet
	 * walked through — so a freshly opened way onward is unmistakable. Stops once
	 * the destination biome has been visited (and respects reduce-motion).
	 */
	private gateSparkle(x: number, y: number, targetBiome: string) {
		const visited = bridge.shared.state?.player.visitedBiomes || [];
		if (visited.includes(targetBiome)) return; // already been through — no shimmer
		if (getPrefs().reduceMotion) return;
		if (!this.textures.exists('gate-sparkle')) {
			const g = this.make.graphics({ x: 0, y: 0 }, false);
			g.scaleCanvas(TEX_SCALE, TEX_SCALE);
			g.fillStyle(0xffffff, 1);
			// a small 4-point star
			g.fillPoints(
				[
					{ x: 6, y: 0 },
					{ x: 7.4, y: 4.6 },
					{ x: 12, y: 6 },
					{ x: 7.4, y: 7.4 },
					{ x: 6, y: 12 },
					{ x: 4.6, y: 7.4 },
					{ x: 0, y: 6 },
					{ x: 4.6, y: 4.6 },
				],
				true,
			);
			g.generateTexture('gate-sparkle', 12 * TEX_SCALE, 12 * TEX_SCALE);
			g.destroy();
		}
		// A handful of little stars around the gate that twinkle in and out — built
		// from tweened sprites (the same reliable path the rest of the world uses)
		// rather than a particle emitter.
		const rng = mulberry32(hashStr(`gate-sparkle:${this.area}:${targetBiome}`));
		const tints = [0xffe9a8, 0xfff4c2, 0xcde7ff];
		for (let i = 0; i < 6; i++) {
			const ox = (rng() - 0.5) * 46;
			const oy = (rng() - 0.5) * 50 - 6;
			const star = this.addDyn(this.img(x + ox, y + oy, 'gate-sparkle'))
				.setDepth(y + 60)
				.setAlpha(0)
				.setScale(0)
				.setTint(tints[i % tints.length]);
			star.setBlendMode(Phaser.BlendModes.ADD);
			const peak = 0.12 + rng() * 0.09;
			this.tweens.add({
				targets: star,
				scale: { from: 0, to: peak },
				alpha: { from: 0, to: 0.95 },
				angle: { from: -20, to: 40 },
				duration: 620 + rng() * 360,
				delay: i * 200 + rng() * 220,
				hold: 90,
				yoyo: true,
				repeat: -1,
				repeatDelay: 500 + rng() * 900,
				ease: 'Sine.easeInOut',
			});
		}
	}

	/**
	 * Live "what's still needed to open this gate" line, for the bottom prompt when
	 * standing at a locked gate. Compares the destination biome's unlock rules to
	 * current progress and lists only the parts not yet met.
	 */
	private gateRequirementText(biomeId: string): string {
		const st = bridge.shared.state;
		const d = bridge.shared.data;
		const biome = d?.biomes.find((b) => b.id === biomeId);
		const name = this.biomeName(biomeId, biome?.name || biomeId);
		const u: any = biome?.unlock;
		if (!u || !st) return t('game.gate.locked', { name });
		const prereqName = this.biomeName(u.biome, d?.biomes.find((b) => b.id === u.biome)?.name || u.biome);
		const prereq = st.biomeStates.find((b) => b.biomeId === u.biome);
		const needs: string[] = [];
		if (u.minHealth) {
			const cur = Math.round(prereq?.health || 0);
			if (cur < u.minHealth) needs.push(t('game.gate.needHealth', { biome: prereqName, goal: u.minHealth, cur }));
		}
		if (u.minAnimals) {
			const cur = prereq?.returnedCount || 0;
			if (cur < u.minAnimals) needs.push(t('game.gate.needAnimals', { biome: prereqName, goal: u.minAnimals, cur }));
		}
		if (u.minTotalAnimals) {
			const cur = st.discoveries?.length || 0;
			if (cur < u.minTotalAnimals) needs.push(t('game.gate.needTotalAnimals', { goal: u.minTotalAnimals, cur }));
		}
		if (u.requiresItem) {
			const have =
				(st.player.craftedItems?.[u.requiresItem] || 0) + ((st.player as any).craftedEver?.[u.requiresItem] || 0);
			if (have <= 0) {
				const obj = d?.habitatObjects.find((o) => o.id === u.requiresItem);
				needs.push(
					t('game.gate.needKit', { item: obj ? content('habitatObject', obj.id, 'name', obj.name) : u.requiresItem }),
				);
			}
		}
		if (!needs.length) return t('game.gate.almost', { name });
		return t('game.gate.stillNeeds', { name, needs: needs.join(t('game.gate.sep')) });
	}

	private drawStaticFeatures() {
		const state = bridge.shared.state;
		if (this.area === 'meadow') {
			// base camp: tent + flickering campfire (the crafting station/chest are placements)
			const tx2 = CAMP.tent.x * TILE,
				ty2 = CAMP.tent.y * TILE;
			// the camp building reflects your home: a tent until you build it, then your
			// chosen style, growing a little as Space is upgraded
			const homeC: any = state?.player?.home;
			const built = !!homeC?.styleLocked;
			const wantKey = built ? `home-${homeC.style}` : 'tent';
			const homeKey = this.textures.exists(wantKey) ? wantKey : 'tent';
			// the camp building grows gradually: a small tent, then each Space level a bit bigger
			const homeScale = built ? 1 + Math.max(0, (homeC.space || 2) - 2) * 0.1 : 0.85;
			this.addDyn(
				this.img(tx2, ty2 + 22, 'shadow')
					.setDepth(3)
					.setScale(2.0 * homeScale * INV_TEX_SCALE, 1.1 * INV_TEX_SCALE),
			);
			this.addDyn(
				this.img(tx2, ty2, homeKey)
					.setDepth(ty2)
					.setScale(homeScale * INV_TEX_SCALE),
			);
			// step inside your home to decorate it
			this.registerInteractable({
				x: tx2,
				y: ty2 + 8,
				label: t('game.label.stepInside'),
				action: () => bridge.emit('request-area', { area: 'home' }),
			});
			// the upgrade signpost — shown only while something's left to upgrade
			const tracks = bridge.shared.data?.homeTracks as any;
			const fullyUpgraded =
				built &&
				tracks &&
				['space', 'comfort', 'decor', 'light'].every((k) => (homeC[k] || 1) >= (tracks[k]?.levels.length || 1));
			if (!fullyUpgraded) {
				const sgx = (CAMP.tent.x - 1.2) * TILE,
					sgy = (CAMP.tent.y + 1.1) * TILE;
				this.addDyn(
					this.img(sgx, sgy + 16, 'shadow')
						.setDepth(3)
						.setScale(0.9 * INV_TEX_SCALE, 0.7 * INV_TEX_SCALE),
				);
				this.addDyn(this.img(sgx, sgy, 'sign').setDepth(sgy));
				this.registerInteractable({
					x: sgx,
					y: sgy,
					label: t('game.label.upgradeHome'),
					action: () => bridge.emit('open-home'),
				});
			}
			const fx = CAMP.fire.x * TILE,
				fy = CAMP.fire.y * TILE;
			const fireGlow = this.addDyn(
				this.img(fx, fy - 4, 'glow')
					.setTint(0xffb84f)
					.setDepth(fy - 1)
					.setScale(1.3 * INV_TEX_SCALE),
			);
			(fireGlow as Phaser.GameObjects.Image).setBlendMode(Phaser.BlendModes.ADD);
			this.addDyn(this.img(fx, fy, 'campfire').setDepth(fy));

			const gx = (this.cols - 1.2) * TILE;
			const gy = this.dimsOf(this.area).gateY * TILE;
			const forestUnlocked = state?.player.unlockedBiomes.includes('forest');
			const forestOpen = forestUnlocked && this.biomeDef('forest')?.explorable;
			this.addDyn(this.img(gx, gy, forestOpen ? 'gate' : 'sign').setDepth(gy));
			if (forestOpen) this.gateSparkle(gx, gy, 'forest');
			const forestName = this.biomeName('forest', 'Old Hollow Forest');
			this.registerInteractable({
				x: gx,
				y: gy,
				label: forestOpen
					? t('game.label.walkTo', { name: forestName })
					: t('game.label.readTrailSign', { name: forestName }),
				liveLabel: forestOpen ? undefined : () => this.gateRequirementText('forest'),
				action: () => {
					if (forestOpen) bridge.emit('request-area', { area: 'forest' });
					else {
						const label = this.biomeDef('forest')?.unlock?.label || t('game.toast.restoreMeadowFirst');
						bridge.emit('toast', { text: t('game.toast.forestOvergrown', { label }), kind: 'info' });
					}
				},
			});
		} else if (this.area === 'forest') {
			const gx = 1.2 * TILE;
			const gy = this.dimsOf(this.area).gateY * TILE;
			this.addDyn(this.img(gx, gy, 'gate').setDepth(gy));
			this.registerInteractable({
				x: gx,
				y: gy,
				label: t('game.label.walkBackTo', { name: this.biomeName('meadow', 'Willow Meadow') }),
				action: () => bridge.emit('request-area', { area: 'meadow' }),
			});

			const sx = (this.cols - 1.2) * TILE;
			const sy = gy;
			const wetlandUnlocked = state?.player.unlockedBiomes.includes('wetland');
			const wetlandExplorable = this.biomeDef('wetland')?.explorable;
			const wetlandOpen = wetlandUnlocked && wetlandExplorable;
			this.addDyn(this.img(sx, sy, wetlandOpen ? 'gate' : 'sign').setDepth(sy));
			if (wetlandOpen) this.gateSparkle(sx, sy, 'wetland');
			const wetlandName = this.biomeName('wetland', 'Rushwater Wetland');
			this.registerInteractable({
				x: sx,
				y: sy,
				label: wetlandOpen
					? t('game.label.walkTo', { name: wetlandName })
					: t('game.label.readTrailSign', { name: wetlandName }),
				liveLabel: wetlandOpen ? undefined : () => this.gateRequirementText('wetland'),
				action: () => {
					if (wetlandOpen) {
						bridge.emit('request-area', { area: 'wetland' });
						return;
					}
					const wetland = this.biomeDef('wetland');
					const text = wetlandUnlocked
						? t('game.toast.wetlandUnlocked')
						: t('game.toast.wetlandWashedOut', { label: wetland?.unlock?.label || '' });
					bridge.emit('toast', { text, kind: 'info' });
				},
			});
		} else if (this.area === 'wetland') {
			// gate back to the forest on the west edge
			const gx = 1.2 * TILE;
			const gy = this.dimsOf(this.area).gateY * TILE;
			this.addDyn(this.img(gx, gy, 'gate').setDepth(gy));
			this.registerInteractable({
				x: gx,
				y: gy,
				label: t('game.label.walkBackTo', { name: this.biomeName('forest', 'Old Hollow Forest') }),
				action: () => bridge.emit('request-area', { area: 'forest' }),
			});

			// trail east toward the desert (Redstone Scrubland)
			const sx = (this.cols - 1.2) * TILE;
			const sy = gy;
			const desertUnlocked = state?.player.unlockedBiomes.includes('desert');
			const desertExplorable = this.biomeDef('desert')?.explorable;
			const desertOpen = desertUnlocked && desertExplorable;
			this.addDyn(this.img(sx, sy, desertOpen ? 'gate' : 'sign').setDepth(sy));
			if (desertOpen) this.gateSparkle(sx, sy, 'desert');
			const desertName = this.biomeName('desert', 'Redstone Scrubland');
			this.registerInteractable({
				x: sx,
				y: sy,
				label: desertOpen
					? t('game.label.walkTo', { name: desertName })
					: t('game.label.readTrailSign', { name: desertName }),
				liveLabel: desertOpen ? undefined : () => this.gateRequirementText('desert'),
				action: () => {
					if (desertOpen) {
						bridge.emit('request-area', { area: 'desert' });
						return;
					}
					const desert = this.biomeDef('desert');
					const text = desertUnlocked
						? t('game.toast.desertUnlocked')
						: t('game.toast.desertBlocked', { label: desert?.unlock?.label || '' });
					bridge.emit('toast', { text, kind: 'info' });
				},
			});
		} else if (this.area === 'desert') {
			// gate back to the wetland on the west edge
			const gx = 1.2 * TILE;
			const gy = this.dimsOf(this.area).gateY * TILE;
			this.addDyn(this.img(gx, gy, 'gate').setDepth(gy));
			this.registerInteractable({
				x: gx,
				y: gy,
				label: t('game.label.walkBackTo', { name: this.biomeName('wetland', 'Rushwater Wetland') }),
				action: () => bridge.emit('request-area', { area: 'wetland' }),
			});

			// trail east toward the alpine heights (Graywind Heights)
			const sx = (this.cols - 1.2) * TILE;
			const sy = gy;
			const alpineUnlocked = state?.player.unlockedBiomes.includes('alpine');
			const alpineExplorable = this.biomeDef('alpine')?.explorable;
			const alpineOpen = alpineUnlocked && alpineExplorable;
			this.addDyn(this.img(sx, sy, alpineOpen ? 'gate' : 'sign').setDepth(sy));
			if (alpineOpen) this.gateSparkle(sx, sy, 'alpine');
			const alpineName = this.biomeName('alpine', 'Graywind Heights');
			this.registerInteractable({
				x: sx,
				y: sy,
				label: alpineOpen
					? t('game.label.walkTo', { name: alpineName })
					: t('game.label.readTrailSign', { name: alpineName }),
				liveLabel: alpineOpen ? undefined : () => this.gateRequirementText('alpine'),
				action: () => {
					if (alpineOpen) {
						bridge.emit('request-area', { area: 'alpine' });
						return;
					}
					const alpine = this.biomeDef('alpine');
					const text = alpineUnlocked
						? t('game.toast.alpineUnlocked')
						: t('game.toast.alpineBlocked', { label: alpine?.unlock?.label || '' });
					bridge.emit('toast', { text, kind: 'info' });
				},
			});
		} else if (this.area === 'alpine') {
			// Graywind Heights: the mountain range is drawn statically (drawGround);
			// here we just place the trail gates in the playable region below it.
			const gy = this.dimsOf(this.area).gateY * TILE;

			// gate back to the desert on the west edge
			const gx = 1.2 * TILE;
			this.addDyn(this.img(gx, gy, 'gate').setDepth(gy));
			this.registerInteractable({
				x: gx,
				y: gy,
				label: t('game.label.walkBackTo', { name: this.biomeName('desert', 'Redstone Scrubland') }),
				action: () => bridge.emit('request-area', { area: 'desert' }),
			});

			// trail east toward the coast (Pelican Shore)
			const sx = (this.cols - 1.2) * TILE;
			const coastalUnlocked = state?.player.unlockedBiomes.includes('coastal');
			const coastalExplorable = this.biomeDef('coastal')?.explorable;
			const coastalOpen = coastalUnlocked && coastalExplorable;
			this.addDyn(this.img(sx, gy, coastalOpen ? 'gate' : 'sign').setDepth(gy));
			if (coastalOpen) this.gateSparkle(sx, gy, 'coastal');
			const coastalName = this.biomeName('coastal', 'Pelican Shore');
			this.registerInteractable({
				x: sx,
				y: gy,
				label: coastalOpen
					? t('game.label.walkTo', { name: coastalName })
					: t('game.label.readTrailSign', { name: coastalName }),
				liveLabel: coastalOpen ? undefined : () => this.gateRequirementText('coastal'),
				action: () => {
					if (coastalOpen) {
						bridge.emit('request-area', { area: 'coastal' });
						return;
					}
					const coastal = this.biomeDef('coastal');
					const text = coastalUnlocked
						? t('game.toast.coastalUnlocked')
						: t('game.toast.coastalSnowedIn', { label: coastal?.unlock?.label || '' });
					bridge.emit('toast', { text, kind: 'info' });
				},
			});
		} else if (this.area === 'coastal') {
			// Pelican Shore is the last biome. The ocean runs down the whole east
			// edge (drawn statically in drawCoastBand), so there's no eastern gate —
			// only the trail back up to Graywind Heights on the west edge.
			const gx = 1.2 * TILE;
			const gy = this.dimsOf(this.area).gateY * TILE;
			this.addDyn(this.img(gx, gy, 'gate').setDepth(gy));
			this.registerInteractable({
				x: gx,
				y: gy,
				label: t('game.label.walkBackUpTo', { name: this.biomeName('alpine', 'Graywind Heights') }),
				action: () => bridge.emit('request-area', { area: 'alpine' }),
			});

			// a weathered marker at the end of the shore trail, looking out to sea
			const sx = (this.landRight - 0.6) * TILE;
			const sy = 13 * TILE;
			this.addDyn(this.img(sx, sy, 'obj-driftpile').setDepth(sy));
			this.registerInteractable({
				x: sx,
				y: sy,
				label: t('game.label.lookOcean'),
				action: () => bridge.emit('toast', { text: t('game.toast.oceanView'), kind: 'info' }),
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
		// resource this biome offers. Scaled with the biome's playable area so
		// bigger preserves (the meadow especially) don't feel picked bare.
		const res = biome.resources || [];
		const areaScale = Math.max(1, (this.landRight * (this.rows - this.playTop)) / (30 * 20));
		const count = Math.round(Math.max(20, res.length * 2 + 4) * areaScale);

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
		while (nodes.length < count && attempts < 900) {
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
				const spot = this.findFreeTile(
					Math.floor(this.cols / 2),
					this.playTop + Math.floor(this.baseRows / 2),
					occupied,
					taken,
				);
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
			const anchor = this.area === 'meadow' ? { tx: 26, ty: 8 } : { tx: 4, ty: 11 };
			const hasNearby = nodes.some(
				(n) =>
					(n.resourceId === 'water' || n.resourceId === 'clean-water') &&
					Math.abs(n.tx - anchor.tx) <= 5 &&
					Math.abs(n.ty - anchor.ty) <= 5,
			);
			if (!hasNearby) {
				const aKey = `${anchor.tx},${anchor.ty}`;
				const anchorFree =
					anchor.tx >= 1 &&
					anchor.ty >= this.playTop &&
					anchor.tx <= this.landRight - 2 &&
					anchor.ty <= this.rows - 2 &&
					!occupied.has(aKey) &&
					!taken.has(aKey) &&
					!this.inCamp(anchor.tx, anchor.ty);
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
		return (
			this.area === 'meadow' &&
			tx > CAMP_BLOCK.x0 - 1 &&
			tx < CAMP_BLOCK.x1 + 1 &&
			ty > CAMP_BLOCK.y0 - 1 &&
			ty < CAMP_BLOCK.y1 + 1
		);
	}

	/** Nearest in-bounds tile (ring search) that isn't built on or used by another node. */
	private findFreeTile(
		cx: number,
		cy: number,
		occupied: Set<string>,
		taken: Set<string>,
	): { tx: number; ty: number } | null {
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
			const img = this.img(0, 0, texKey);
			if (texKey === 'node') img.setTint(Phaser.Display.Color.HexStringToColor(res?.color || '#999999').color);
			const sprout = this.img(0, 2, 'sprout');
			container.add([img, sprout]);
			(container as any).nodeImg = img;
			(container as any).sproutImg = sprout;
			container.setSize(52, 52).setInteractive({ useHandCursor: true });
			this.addDyn(container);
			this.nodeSprites.set(node.id, container);
			this.tweens.add({
				targets: container,
				scale: { from: 1, to: 1.07 },
				duration: 1100 + (node.tx % 5) * 130,
				yoyo: true,
				repeat: -1,
				ease: 'Sine.easeInOut',
			});
			const it: Interactable = {
				x,
				y,
				label: t('game.label.gather', {
					name: content('resource', node.resourceId, 'name', res?.name || node.resourceId),
				}),
				action: () => {
					if (this.nodeAvailable(node))
						bridge.emit('collect-node', { biomeId: this.area, nodeId: node.id, resourceId: node.resourceId });
					else bridge.emit('toast', { text: t('game.toast.stillRegrowing'), kind: 'info' });
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
			const toolImg = this.img(this.player.x + 14, this.player.y - 4, toolKey)
				.setDepth(6500)
				.setAngle(-30);
			this.tweens.add({
				targets: toolImg,
				angle: 28,
				duration: 220,
				yoyo: true,
				onComplete: () =>
					this.tweens.add({ targets: toolImg, alpha: 0, duration: 160, onComplete: () => toolImg.destroy() }),
			});
		}
		// little squash on the player — you can see yourself grab it
		this.tweens.add({
			targets: this.player,
			scaleX: 1.12 * INV_TEX_SCALE,
			scaleY: 0.9 * INV_TEX_SCALE,
			duration: 110,
			yoyo: true,
		});

		for (let i = 0; i < Math.min(p.qty, 3); i++) {
			const item = this.img(sx, sy, texKey)
				.setDepth(6400)
				.setScale(0.55 * INV_TEX_SCALE);
			this.tweens.add({
				targets: item,
				x: { value: () => this.player.x, duration: 430 + i * 90, ease: 'Sine.easeIn' },
				y: { value: () => this.player.y - 6, duration: 430 + i * 90, ease: 'Back.easeIn' },
				scale: 0.2 * INV_TEX_SCALE,
				alpha: { from: 1, to: 0.7 },
				delay: i * 70,
				onComplete: () => item.destroy(),
			});
		}
		const res = bridge.shared.data?.resources.find((r) => r.id === p.resourceId);
		this.floatText(
			sx,
			sy - 18,
			t('game.float.pickup', {
				qty: p.qty,
				name: content('resource', p.resourceId, 'name', res?.name || p.resourceId),
			}),
			'#fff7dd',
		);
	}

	private playTerraformFx(p: { x: number; y: number; action: string }) {
		if (!this.alive) return;
		const x = p.x * TILE + 16;
		const y = p.y * TILE + 16;
		const toolKey = p.action === 'water' ? 'tool-watering-can' : 'tool-shovel';
		const toolImg = this.img(x + 10, y - 12, toolKey)
			.setDepth(6500)
			.setAngle(-25);
		this.tweens.add({
			targets: toolImg,
			angle: 30,
			duration: 240,
			yoyo: true,
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
		this.floatText(
			x,
			y - 16,
			p.action === 'water'
				? t('game.float.watered')
				: p.action === 'dig'
					? t('game.float.bedReady')
					: t('game.float.cleared'),
			'#fff7dd',
		);
	}

	/** A ~3s construction flourish on the camp building when the home is built/upgraded. */
	private playBuild() {
		if (!this.alive || this.area !== 'meadow') return; // the camp building lives in the meadow
		const bx = CAMP.tent.x * TILE,
			by = CAMP.tent.y * TILE;
		// a tarp drops over the building while "construction" happens, then lifts
		const tarp = this.add.rectangle(bx, by - 4, 86, 74, C('#cdbb94'), 0.9).setDepth(by + 60);
		this.tweens.add({ targets: tarp, alpha: { from: 0, to: 0.9 }, duration: 250 });
		// sawdust puffs + sparkles kicking up around the base
		const puffs = this.time.addEvent({
			delay: 150,
			loop: true,
			callback: () => {
				if (!this.alive) return;
				const d = this.img(bx + (Math.random() - 0.5) * 64, by + 22 + (Math.random() - 0.5) * 16, 'glow')
					.setTint(0xe6d2a4)
					.setDepth(by + 70)
					.setScale(0.45 * INV_TEX_SCALE)
					.setAlpha(0.75)
					.setBlendMode(Phaser.BlendModes.ADD);
				this.tweens.add({
					targets: d,
					y: d.y - 20,
					alpha: 0,
					scale: 0.8 * INV_TEX_SCALE,
					duration: 620,
					ease: 'Sine.easeOut',
					onComplete: () => d.destroy(),
				});
			},
		});
		const hammer = this.time.addEvent({
			delay: 800,
			loop: true,
			callback: () => {
				if (this.alive) this.floatText(bx + (Math.random() - 0.5) * 30, by - 26, t('game.float.tapTap'), '#fff7dd');
			},
		});
		this.floatText(bx, by - 34, t('game.float.building'), '#fff7dd');
		this.time.delayedCall(3000, () => {
			puffs.remove();
			hammer.remove();
			if (!this.alive) {
				tarp.destroy();
				return;
			}
			// lift the tarp to reveal the finished building, and give it a happy little pop
			this.tweens.add({
				targets: tarp,
				alpha: 0,
				y: by - 40,
				duration: 500,
				ease: 'Sine.easeIn',
				onComplete: () => tarp.destroy(),
			});
			this.floatText(bx, by - 34, t('game.float.done'), '#d8eec2');
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
		bridge.emit('toast', { text: t('game.toast.goodnight'), kind: 'info' });
		// a soft dim over the whole view (oversized + screen-fixed so zoom never matters)
		const dim = this.add
			.rectangle(-2000, -2000, 6000, 6000, 0x0a1026, 0)
			.setOrigin(0, 0)
			.setScrollFactor(0)
			.setDepth(9000);
		this.tweens.add({ targets: dim, alpha: 0.6, duration: 600, ease: 'Sine.easeIn' });
		// drifting "z"s above the sleeper
		const zzz = this.time.addEvent({
			delay: 620,
			loop: true,
			callback: () => {
				if (!this.alive) return;
				const z = this.add
					.text(this.player.x + 12, this.player.y - 14, 'z', {
						fontFamily: 'Quicksand, sans-serif',
						fontSize: '16px',
						color: '#dfe9ff',
						fontStyle: 'bold',
						resolution: 4, // stays crisp under camera zoom
					})
					.setOrigin(0.5)
					.setDepth(9500);
				this.tweens.add({
					targets: z,
					y: z.y - 30,
					x: z.x + 14,
					alpha: 0,
					duration: 1300,
					ease: 'Sine.easeOut',
					onComplete: () => z.destroy(),
				});
			},
		});
		this.time.delayedCall(3000, () => {
			zzz.remove();
			if (!this.alive) return;
			bridge.emit('rest'); // server-side: refresh all gathering spots
			this.player.setAngle(0);
			this.player.setDepth(this.player.y + 16);
			this.tweens.add({ targets: dim, alpha: 0, duration: 700, ease: 'Sine.easeOut', onComplete: () => dim.destroy() });
			this.time.delayedCall(700, () => {
				this.sleeping = false;
			});
		});
	}

	private floatText(x: number, y: number, text: string, color: string) {
		const t = this.add
			.text(x, y, text, {
				fontFamily: 'Quicksand, sans-serif',
				fontSize: '13px',
				color,
				fontStyle: 'bold',
				stroke: '#2b3321',
				strokeThickness: 3,
			})
			.setOrigin(0.5)
			.setDepth(7000);
		this.tweens.add({
			targets: t,
			y: y - 26,
			alpha: 0,
			duration: 1100,
			ease: 'Sine.easeOut',
			onComplete: () => t.destroy(),
		});
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
			this.addDyn(
				this.img(x, y + (tall ? 22 : 10), 'shadow')
					.setDepth(3)
					.setScale((tall ? 1.0 : 1.2) * INV_TEX_SCALE, 0.9 * INV_TEX_SCALE),
			);

			// freshly planted things start as a sprout and grow in
			const growMs = (def.growSeconds || 0) * 1000;
			const age = p.plantedAt ? Date.now() - p.plantedAt : Infinity;
			const stillGrowing = growMs > 0 && age < growMs;
			// fall back to the generic kit sprite if this object's shape texture is
			// missing (e.g. data with a newer shape than the loaded client), so a
			// placed item never renders as a blank/black missing-texture square
			const shapeKey = `obj-${def.shape || 'kit'}`;
			const objKey = this.textures.exists(shapeKey) ? shapeKey : 'obj-kit';
			const img = this.addDyn(this.img(x, y, stillGrowing ? 'sprout' : objKey).setDepth(y));
			if (stillGrowing) {
				this.time.delayedCall(growMs - age + 300, () => {
					if (!this.alive) return;
					this.refreshDynamic(true); // sprout→grown swap isn't a state change, so force it
					// the plant is now mature habitat — re-check who can return
					bridge.emit('plant-matured', this.area);
				});
			}

			// Harvest-ready plants get a soft golden glint above them; if one will
			// become ready later (regrowing after a harvest), nudge a repaint then so
			// the glint appears on its own.
			if (def.yield && p.plantedAt && !stillGrowing) {
				const readyAt = harvestReadyAt(def, { plantedAt: p.plantedAt, lastHarvestAt: (p as any).lastHarvestAt });
				const now = Date.now();
				if (readyAt != null && now >= readyAt) {
					// A single small, dim star that twinkles occasionally above the plant —
					// staggered per-plant so a field of ready plants doesn't pulse in
					// unison (the old full glow on every plant read as a wall of light).
					this.ensureMoteTexture();
					const stagger = hashStr(p.id) % 1400;
					const mote = this.addDyn(
						this.img(x + (tall ? 7 : 5), y - (tall ? 22 : 10), 'harvest-mote')
							.setDepth(y + 40)
							.setTint(0xffe9a8)
							.setAlpha(0)
							.setScale(0.12),
					);
					mote.setBlendMode(Phaser.BlendModes.ADD);
					this.tweens.add({
						targets: mote,
						alpha: { from: 0, to: 0.7 },
						scale: { from: 0.08, to: 0.17 },
						angle: { from: 0, to: 40 },
						duration: 780,
						delay: stagger,
						hold: 120,
						yoyo: true,
						repeat: -1,
						repeatDelay: 900 + (hashStr(p.id + 'r') % 900),
						ease: 'Sine.easeInOut',
					});
					// Register it so E / Space (and the mobile interact button) harvest the
					// nearest ready plant, just like gathering a node. Clicking still opens
					// the placement menu (which also has a Harvest button).
					this.interactables.push({
						x,
						y,
						label: t('game.label.harvest', { name: content('habitatObject', p.objectId, 'name', def.name) }),
						action: () => bridge.emit('harvest-placement', { placementId: p.id }),
					});
				} else if (readyAt != null) {
					this.time.delayedCall(readyAt - now + 200, () => {
						if (this.alive) this.refreshDynamic(true);
					});
				}
			}

			// Camp fixtures stay crisp and identical; everything the player crafts
			// and places gets a little deterministic character seeded from its
			// placement id, so no two crafted items look exactly alike.
			const isFixture =
				def.isChest ||
				!!def.onePerArea ||
				['workbench', 'field-journal-stand', 'bed', 'home-bed', 'home-sleeping-bag'].includes(p.objectId);
			const growScale = stillGrowing ? 1 + (age / growMs) * 0.6 : 1;
			// Living habitat keeps growing for real hours after placement
			// (matureHours): young plants render smaller and ease up to full size
			// as they mature — so the preserve visibly grows between sessions.
			const matMs = (def.matureHours || 0) * 3_600_000;
			const placedAge = Date.now() - (p.placedAt || 0);
			const matureScale = matMs > 0 && !stillGrowing && p.placedAt ? 0.72 + 0.28 * Math.min(1, placedAge / matMs) : 1;
			// player-chosen quarter-turn (see PlaceObject/MoveObject), radians
			const rot = Phaser.Math.DegToRad((p as any).rotation || 0);
			if (isFixture) {
				img.setScale(growScale * matureScale * INV_TEX_SCALE);
				if (rot) img.setRotation(rot);
			} else {
				const vr = mulberry32(hashStr(p.id));
				img.setFlipX(vr() < 0.5);
				img.setRotation(rot + (vr() - 0.5) * 0.12); // chosen turn + a natural ±~3.5° lean
				img.setScale(growScale * matureScale * (0.9 + vr() * 0.2) * INV_TEX_SCALE); // 0.9–1.1 size
				const shade = 0.82 + vr() * 0.18; // 0.82–1.0 brightness
				const v = Math.round(255 * shade);
				img.setTint((v << 16) | (v << 8) | v);
			}
			// paint-tool recolor: a per-item color override wins over the default tint
			if (p.color) img.setTint(Phaser.Display.Color.HexStringToColor(p.color).color);

			// placed campfires glow like the base-camp fire: a warm, steady additive
			// halo (wide wash + bright core — indoors too, cozy in a tent). At night
			// the light mask also carves the dark away here.
			if (p.objectId === 'campfire') {
				const glow = this.addDyn(
					this.img(x, y - 4, 'glow')
						.setTint(0xffb84f)
						.setDepth(y - 1)
						.setScale(1.7 * INV_TEX_SCALE),
				) as Phaser.GameObjects.Image;
				glow.setBlendMode(Phaser.BlendModes.ADD);
				const core = this.addDyn(
					this.img(x, y - 4, 'glow')
						.setTint(0xffd98a)
						.setDepth(y - 1)
						.setScale(0.9 * INV_TEX_SCALE),
				) as Phaser.GameObjects.Image;
				core.setBlendMode(Phaser.BlendModes.ADD);
			}

			img.setInteractive({ useHandCursor: true });
			const hasPrimaryAction = isFixture;
			const defName = content('habitatObject', p.objectId, 'name', def.name);
			img.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
				if (bridge.shared.uiBlocking) return; // a modal is open — clicks don't reach the world
				if (this.placementObjectId || this.movingPlacementId) return;
				if (this.activeTool === 'paint' && this.isHome) return; // painting handled globally
				// shovel digs planted things back up — materials are refunded
				if (this.terraformAction() === 'dig' && def.plantable && p.plantedAt) {
					const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y);
					if (dist <= 120) bridge.emit('dig-up', { placementId: p.id, name: defName });
					else bridge.emit('toast', { text: t('game.toast.walkCloser'), kind: 'info' });
					return;
				}
				if (this.terraformAction()) return;
				if (pointer.event && (pointer.event as MouseEvent).shiftKey) {
					bridge.emit('remove-placement', { placementId: p.id, objectId: p.objectId, name: defName });
					return;
				}
				if (!hasPrimaryAction) {
					const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y);
					if (dist <= 120)
						bridge.emit('placement-clicked', {
							placementId: p.id,
							objectId: p.objectId,
							name: defName,
							plantedAt: p.plantedAt,
							lastHarvestAt: (p as any).lastHarvestAt,
							x: p.x,
							y: p.y,
							rotation: p.rotation || 0,
						});
					else bridge.emit('toast', { text: t('game.toast.walkCloser'), kind: 'info' });
				}
			});

			if (p.objectId === 'trail-tent') {
				// your away-base: step inside to decorate it (its own little interior)
				const interior = `tent-${this.area}`;
				this.registerInteractable(
					{
						x,
						y: y + 8,
						label: t('game.label.stepInTent'),
						action: () => bridge.emit('request-area', { area: interior }),
					},
					img,
				);
			} else if (def.isChest) {
				this.registerInteractable(
					{
						x,
						y,
						label: t('game.label.openChest', { name: defName }),
						action: () => bridge.emit('open-chest', { chestId: p.id }),
					},
					img,
				);
			} else if (p.objectId === 'workbench') {
				this.registerInteractable(
					{ x, y, label: t('game.label.openCrafting'), action: () => bridge.emit('open-crafting') },
					img,
				);
			} else if (p.objectId === 'field-journal-stand') {
				this.registerInteractable(
					{ x, y, label: t('game.label.readJournal'), action: () => bridge.emit('open-journal') },
					img,
				);
			} else if (p.objectId === 'home-bed' || p.objectId === 'home-sleeping-bag') {
				this.registerInteractable({ x, y, label: t('game.label.sleep'), action: () => this.sleepAt(x, y) }, img);
			} else if (p.objectId === 'bed') {
				this.registerInteractable(
					{
						x,
						y,
						label: t('game.label.restMoment'),
						action: () => bridge.emit('toast', { text: t('game.toast.quietBreath'), kind: 'info' }),
					},
					img,
				);
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
				ay = (this.playTop + 2 + rng() * (this.baseRows - 4)) * TILE;
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
				if (w) {
					ax = w.x;
					ay = w.y;
				}
			} else if (!flying && this.isWaterPx(ax, ay)) {
				for (let i = 0; i < 14 && this.isWaterPx(ax, ay); i++) {
					ax = Phaser.Math.Clamp((2 + rng() * (this.landRight - 4)) * TILE, TILE, eastEdge);
					ay = Phaser.Math.Clamp(
						(this.playTop + 2 + rng() * (this.baseRows - 4)) * TILE,
						(this.playTop + 1) * TILE,
						this.worldH - TILE,
					);
				}
			}

			// marine swimmers (dolphin/whale/seal/otter/turtle) ride the open ocean
			// band, overriding the land placement above and skipping the ground shadow.
			const swimmer = this.area === 'coastal' && (animal as any).ocean === true;
			if (swimmer) {
				const o = this.oceanTarget(rng);
				ax = o.x;
				ay = o.y;
			}

			ensureAnimalTexture(this, animal.id, animal.kind);
			const { key, tint } = animalTexture(animal.id, animal.kind);
			if (animal.kind !== 'insect' && !swimmer) {
				const sh = this.img(ax, ay + 9, 'shadow')
					.setDepth(3)
					.setScale(0.75 * INV_TEX_SCALE, 0.7 * INV_TEX_SCALE)
					.setAlpha(0.8);
				this.animals.add(sh);
				const shadowTimer = this.time.addEvent({
					delay: 90,
					loop: true,
					callback: () => {
						const target = (sh as any).animal as Phaser.GameObjects.Image | undefined;
						if (target?.active && sh.active) sh.setPosition(target.x, target.y + 9);
						else if (!sh.active) shadowTimer.remove(); // stop following once the animal layer is cleared
					},
				});
				const img = this.img(ax, ay, key).setDepth(ay);
				this.animals.add(img);
				(sh as any).animal = img;
				this.decorateAnimal(img, animal, tint, rng, swimmer, !disc.timesObserved);
			} else {
				const img = this.img(ax, ay, key).setDepth(ay);
				this.animals.add(img);
				this.decorateAnimal(img, animal, tint, rng, swimmer, !disc.timesObserved);
			}
		}
	}

	private decorateAnimal(
		img: Phaser.GameObjects.Image,
		animal: any,
		tint: number | null,
		rng: () => number,
		ocean = false,
		unseen = false,
	) {
		if (tint) img.setTint(tint);
		// proportional size per species (bear ≫ chipmunk ≫ salamander), with a
		// touch of per-animal jitter so individuals still vary
		const scale = animalScale(animal.id, animal.kind) * INV_TEX_SCALE;
		img.setScale(scale);
		img.setInteractive({ useHandCursor: true });
		// Field binoculars: animals you haven't recorded in the journal yet get the
		// same twinkling golden mote as harvest-ready plants — one cue, everywhere,
		// staggered per animal so a crowd of newcomers doesn't pulse in unison.
		let glint: Phaser.GameObjects.Image | null = null;
		if (unseen && this.hasBinoculars()) {
			this.ensureMoteTexture();
			const stagger = hashStr(animal.id) % 1400;
			glint = this.add
				.image(img.x, img.y, 'harvest-mote')
				.setDepth(img.y + 400)
				.setTint(0xffe9a8)
				.setAlpha(0)
				.setScale(0.12);
			glint.setBlendMode(Phaser.BlendModes.ADD);
			this.animals.add(glint);
			this.tweens.add({
				targets: glint,
				alpha: { from: 0, to: 0.75 },
				scale: { from: 0.08, to: 0.18 },
				angle: { from: 0, to: 40 },
				duration: 780,
				delay: stagger,
				hold: 120,
				yoyo: true,
				repeat: -1,
				repeatDelay: 900 + (hashStr(animal.id + 'r') % 900),
				ease: 'Sine.easeInOut',
			});
			// pinned above the animal as it wanders (same follow trick as the swimmer shadows)
			const follow = this.time.addEvent({
				delay: 60,
				loop: true,
				callback: () => {
					if (img.active && glint!.active) {
						glint!.setPosition(img.x + 4, img.y - img.displayHeight * 0.8 - 5).setDepth(img.y + 400);
					} else {
						follow.remove();
						if (glint?.active) glint.destroy();
					}
				},
			});
		}
		img.on('pointerdown', () => {
			if (bridge.shared.uiBlocking) return; // a modal is open — clicks don't reach the world
			// observing records it — the "someone new" glint has done its job
			if (glint?.active) glint.destroy();
			bridge.emit('animal-clicked', { animalId: animal.id });
		});
		// gentle breathing — everything in the preserve feels alive (keeps its base size).
		// Skipped under reduce-motion, like every other animal flourish; the prefs
		// subscription in create() rebuilds the animal layer when the toggle flips,
		// so all of these tweens honor the setting live.
		if (!getPrefs().reduceMotion) {
			this.tweens.add({
				targets: img,
				scaleY: { from: scale, to: scale * 0.94 },
				duration: 650 + rng() * 450,
				yoyo: true,
				repeat: -1,
				ease: 'Sine.easeInOut',
			});
		}
		// Each kind carries itself differently (see animalGait). Airborne and
		// aquatic species get a constant ambient motion; everything else only
		// animates while actually moving, so a resting meadow stays calm.
		const gait = this.animalGait(animal);
		(img as any).baseOriginY = img.displayOriginY; // resting pose, restored after every flourish
		if (!getPrefs().reduceMotion) this.startAmbientGait(img, gait, rng);
		this.wander(img, img.x, img.y, animal.kind, rng, ocean, gait);
	}

	/** How a species carries itself — picks the movement flourish in wander().
	 *  hop: bouncy arcs (rabbits, squirrels, frogs…) · flit: quick wingbeats
	 *  (birds) · flutter: constant airborne bobbing (insects, bats) · swim: a
	 *  slow roll (fish + marine swimmers) · slither: side-to-side wriggle
	 *  (snakes, salamanders) · amble: a gentle walking rock (other walkers). */
	private animalGait(animal: any): 'hop' | 'flit' | 'flutter' | 'swim' | 'slither' | 'amble' {
		const id = String(animal.id || '');
		if (id.includes('bat') && !id.includes('bat-star')) return 'flutter';
		if (animal.kind === 'insect') return 'flutter';
		if (animal.kind === 'bird') return 'flit';
		if (animal.kind === 'fish' || (animal as any).ocean === true) return 'swim';
		if (/rabbit|hare|squirrel|chipmunk|mouse|vole|frog|toad/.test(id)) return 'hop';
		if (/snake|salamander|ensatina/.test(id)) return 'slither';
		return 'amble';
	}

	/** Vertical bounce amplitude in texture px, sized so every species hops
	 *  roughly the same few screen pixels regardless of its scale. */
	private hopAmp(img: Phaser.GameObjects.Image): number {
		return Phaser.Math.Clamp(4 / Math.max(0.05, img.scaleX), 8, 26);
	}

	/** Always-on motion for creatures that are never still: insects and bats
	 *  hover-bob, fish and marine swimmers roll lazily with the water. The
	 *  bounce uses displayOriginY (not y), so depth sorting and the ground
	 *  shadow stay put — a bob reads as height above the shadow. */
	private startAmbientGait(img: Phaser.GameObjects.Image, gait: string, rng: () => number) {
		const base = (img as any).baseOriginY ?? img.displayOriginY;
		if (gait === 'flutter') {
			this.tweens.add({
				targets: img,
				displayOriginY: { from: base, to: base + this.hopAmp(img) * 0.7 },
				duration: 240 + rng() * 90,
				yoyo: true,
				repeat: -1,
				ease: 'Sine.easeInOut',
			});
			this.tweens.add({
				targets: img,
				angle: { from: -5, to: 5 },
				duration: 700 + rng() * 350,
				yoyo: true,
				repeat: -1,
				ease: 'Sine.easeInOut',
			});
		} else if (gait === 'swim') {
			this.tweens.add({
				targets: img,
				angle: { from: -4, to: 4 },
				duration: 1300 + rng() * 600,
				yoyo: true,
				repeat: -1,
				ease: 'Sine.easeInOut',
			});
		}
	}

	/** Flourish tweens that run only while an animal travels a wander leg;
	 *  wander() removes them and restores the pose when the leg ends. */
	private startMoveGait(img: Phaser.GameObjects.Image, gait: string, rng: () => number): Phaser.Tweens.Tween[] {
		if (getPrefs().reduceMotion) return [];
		const base = (img as any).baseOriginY ?? img.displayOriginY;
		switch (gait) {
			case 'hop':
				return [
					this.tweens.add({
						targets: img,
						displayOriginY: { from: base, to: base + this.hopAmp(img) },
						duration: 165 + rng() * 45,
						yoyo: true,
						repeat: -1,
						ease: 'Sine.easeOut',
					}),
				];
			case 'flit':
				return [
					this.tweens.add({
						targets: img,
						displayOriginY: { from: base, to: base + this.hopAmp(img) * 0.45 },
						duration: 135 + rng() * 40,
						yoyo: true,
						repeat: -1,
						ease: 'Sine.easeInOut',
					}),
				];
			case 'slither':
				return [
					this.tweens.add({
						targets: img,
						angle: { from: -5, to: 5 },
						duration: 170 + rng() * 50,
						yoyo: true,
						repeat: -1,
						ease: 'Sine.easeInOut',
					}),
				];
			case 'amble':
				return [
					this.tweens.add({
						targets: img,
						angle: { from: -2.2, to: 2.2 },
						duration: 250 + rng() * 60,
						yoyo: true,
						repeat: -1,
						ease: 'Sine.easeInOut',
					}),
				];
			default:
				return []; // flutter/swim already carry their ambient motion
		}
	}

	/** A point out in the open ocean band (east of the shore), for marine swimmers. */
	private oceanTarget(rng: () => number, homeX?: number, homeY?: number, roam = Infinity): { x: number; y: number } {
		const x0 = (this.landRight + 0.6) * TILE;
		const x1 = (this.cols - 0.8) * TILE;
		const y0 = (this.playTop + 0.8) * TILE;
		const y1 = this.worldH - TILE;
		for (let i = 0; i < 8; i++) {
			const x = x0 + rng() * Math.max(1, x1 - x0);
			const y = y0 + rng() * Math.max(1, y1 - y0);
			if (homeX == null || Phaser.Math.Distance.Between(homeX, homeY!, x, y) <= roam * 1.5) return { x, y };
		}
		return { x: (x0 + x1) / 2, y: y0 + rng() * Math.max(1, y1 - y0) };
	}

	/** Drifting leaves for a little ambient life outdoors. */
	private startLeaves() {
		// No drifting leaves on the open coast — they read as odd flecks over the
		// sand and surf. The shore gets its pelicans and foam instead. None
		// indoors either (the home or a trail tent).
		if (this.area === 'coastal' || this.isIndoors) return;
		this.time.addEvent({
			delay: 2800,
			loop: true,
			callback: () => {
				if (!this.alive) return;
				const x = Math.random() * this.worldW;
				const leaf = this.img(x, -8, 'leaf-fall').setDepth(4000).setAlpha(0.85);
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
		const near = this.waterTileCenters.filter(
			(c) => Phaser.Math.Distance.Between(homeX, homeY, c.x, c.y) <= roam * 1.5,
		);
		const pool = near.length ? near : this.waterTileCenters;
		const c = pool[Math.floor(rng() * pool.length)];
		// jitter within the tile so a fish doesn't snap dead-center
		return { x: c.x + (rng() - 0.5) * TILE * 0.6, y: c.y + (rng() - 0.5) * TILE * 0.6 };
	}

	private wander(
		img: Phaser.GameObjects.Image,
		homeX: number,
		homeY: number,
		kind: string,
		rng: () => number,
		ocean = false,
		gait: string = 'amble',
	) {
		const roam = ocean ? 140 : kind === 'bird' || kind === 'insect' ? 130 : 80;
		const speed = ocean ? 22 : kind === 'insect' ? 26 : kind === 'bird' ? 42 : 18;
		const aquatic = kind === 'fish';
		const flying = kind === 'bird' || kind === 'insect';
		const hop = () => {
			if (!img.active) return;
			const eastEdge = this.area === 'coastal' ? (this.landRight + 1.2) * TILE : this.worldW - TILE;
			let tx: number, ty: number;
			if (ocean) {
				// marine swimmers drift around the open ocean band, near their spot
				const w = this.oceanTarget(rng, homeX, homeY, roam);
				tx = w.x;
				ty = w.y;
			} else if (aquatic) {
				// fish drift only between open-water tiles near them
				const w = this.fishTarget(homeX, homeY, roam, rng);
				if (!w) {
					this.time.delayedCall(1200 + rng() * 2000, hop);
					return;
				}
				tx = w.x;
				ty = w.y;
			} else {
				// walkers re-roll any target that lands on open water; fliers go anywhere
				let attempts = 0;
				do {
					tx = Phaser.Math.Clamp(homeX + (rng() - 0.5) * roam * 2, TILE, eastEdge);
					ty = Phaser.Math.Clamp(homeY + (rng() - 0.5) * roam * 1.4, (this.playTop + 1) * TILE, this.worldH - TILE);
				} while (!flying && this.isWaterPx(tx, ty) && ++attempts < 12);
				if (!flying && this.isWaterPx(tx, ty)) {
					tx = img.x;
					ty = img.y;
				} // stay put rather than step onto water
			}
			const dist = Phaser.Math.Distance.Between(img.x, img.y, tx, ty);
			img.setFlipX(tx < img.x);
			// gait flourish (bounce/wiggle/rock) runs only for the duration of
			// this leg, then the pose is restored so idle animals sit still
			const flourish = this.startMoveGait(img, gait, rng);
			this.tweens.add({
				targets: img,
				x: tx,
				y: ty,
				duration: Math.max(600, (dist / speed) * 1000),
				ease: 'Sine.easeInOut',
				onUpdate: () => img.setDepth(img.y),
				onComplete: () => {
					for (const t of flourish) t.remove();
					if (img.active) {
						if (gait !== 'flutter' && gait !== 'swim') img.setAngle(0);
						img.displayOriginY = (img as any).baseOriginY ?? img.displayOriginY;
						// hoppers and birds sometimes give one happy bounce while resting
						if ((gait === 'hop' || gait === 'flit') && rng() < 0.35 && !getPrefs().reduceMotion) {
							const base = (img as any).baseOriginY ?? img.displayOriginY;
							this.time.delayedCall(500 + rng() * 1200, () => {
								if (!img.active) return;
								this.tweens.add({
									targets: img,
									displayOriginY: { from: base, to: base + this.hopAmp(img) * 0.6 },
									duration: 150,
									yoyo: true,
									ease: 'Quad.easeOut',
								});
							});
						}
						this.time.delayedCall(800 + rng() * 3500, hop);
					}
				},
			});
		};
		this.time.delayedCall(rng() * 1200, hop);
	}

	// ------------------------------------------------------ placement mode

	private enterPlacement(objectId: string) {
		this.exitPlacement();
		this.placementObjectId = objectId;
		this.placeRotation = 0;
		const def = this.objectDef(objectId);
		const ghost = this.add.container(0, 0).setDepth(5000).setAlpha(0.8);
		const frame = this.img(0, 0, 'ghost-ok');
		const pk = `obj-${def?.shape || 'kit'}`;
		const preview = this.img(0, 0, this.textures.exists(pk) ? pk : 'obj-kit').setAlpha(0.75);
		ghost.add([frame, preview]);
		(ghost as any).frame = frame;
		(ghost as any).preview = preview;
		this.ghost = ghost;
	}

	/** Pick an existing placement up onto the cursor and drop it somewhere new. */
	private enterMove(placementId: string) {
		this.exitPlacement();
		const placement = bridge.shared.state?.placements.find((p) => p.id === placementId);
		if (!placement) return;
		this.movingPlacementId = placementId;
		this.placeRotation = (placement as any).rotation || 0;
		const def = this.objectDef(placement.objectId);
		const ghost = this.add.container(0, 0).setDepth(5000).setAlpha(0.85);
		const frame = this.img(0, 0, 'ghost-ok');
		const pk = `obj-${def?.shape || 'kit'}`;
		const preview = this.img(0, 0, this.textures.exists(pk) ? pk : 'obj-kit').setAlpha(0.8);
		preview.setRotation(Phaser.Math.DegToRad(this.placeRotation));
		ghost.add([frame, preview]);
		(ghost as any).frame = frame;
		(ghost as any).preview = preview;
		this.ghost = ghost;
	}

	private exitPlacement() {
		this.placementObjectId = null;
		this.movingPlacementId = null;
		this.ghost?.destroy();
		this.ghost = null;
	}

	/** The object id currently being placed or moved, if any. */
	private activeObjectId(): string | null {
		if (this.movingPlacementId)
			return bridge.shared.state?.placements.find((p) => p.id === this.movingPlacementId)?.objectId ?? null;
		return this.placementObjectId;
	}
	/** Whether the active place/move object can be rotated (paths, bridges, furniture…). */
	private activeRotatable(): boolean {
		const id = this.activeObjectId();
		return !!(id && this.objectDef(id)?.rotatable);
	}

	private canPlaceAt(tx: number, ty: number, forTerraform = false, ignoreId?: string): boolean {
		// Indoors: you can only decorate on the floor (inside the walls).
		if (this.isIndoors) {
			const r = this.roomSpec();
			if (tx < r.x0 || tx > r.x1 || ty < r.y0 || ty > r.y1) return false;
			const sH = bridge.shared.state;
			if (sH?.placements.some((p) => p.id !== ignoreId && p.area === this.area && p.x === tx && p.y === ty))
				return false;
			// items that need a bigger home can't be placed in a small one yet
			// (a trail tent always counts as the starter size — space 1)
			const activeId = this.movingPlacementId
				? sH?.placements.find((p) => p.id === this.movingPlacementId)?.objectId
				: this.placementObjectId;
			const homeMin = activeId ? this.objectDef(activeId)?.homeMin || 0 : 0;
			const space = this.tentBiome ? 1 : bridge.shared.state?.player?.home?.space || 1;
			if (homeMin > space) return false;
			return true;
		}
		// Pelican Shore: nothing builds on the open ocean; land ends at landRight.
		const right = this.area === 'coastal' ? this.landRight : this.cols - 1;
		if (tx < 1 || ty < (this.playTop || 1) || tx >= right || ty >= this.rows - 1) return false;
		if (
			this.area === 'meadow' &&
			tx >= CAMP.tent.x - 0.5 &&
			tx <= CAMP.tent.x + 1.5 &&
			ty >= Math.floor(CAMP.tent.y) &&
			ty <= Math.floor(CAMP.fire.y)
		)
			return false; // tent + campfire tiles (rows derived from the camp so they track it)
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
		this.positionWeatherEmitter();
		this.handleMovement(dt);
		this.playerShadow.setPosition(this.player.x, this.player.y + 15);
		this.handleGhost();
		this.handleInteraction();
		this.syncPosition(dt);
		this.positionSkyOverlay(); // keep the sunset glow hugging the top of the view
		this.updateNightLights(); // lamplight follows the player, fires burn bright after dark
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
				const shadow = this.img(peer.x * TILE, peer.y * TILE + 15, 'shadow')
					.setDepth(2)
					.setAlpha(0.5);
				const sprite = this.img(peer.x * TILE, peer.y * TILE, key)
					.setDepth(999)
					.setAlpha(0.96);
				const label = this.add
					.text(peer.x * TILE, peer.y * TILE - 26, peer.name || t('game.label.caretaker'), {
						fontFamily: 'system-ui, sans-serif',
						fontSize: '11px',
						color: '#3a2f25',
						backgroundColor: 'rgba(255,255,255,0.7)',
						padding: { x: 4, y: 1 },
						resolution: 4, // stays crisp under camera zoom
					})
					.setOrigin(0.5)
					.setDepth(10000);
				r = { sprite, shadow, label, sig, walkT: 0, lastX: peer.x, lastY: peer.y, moveUntil: 0 };
				this.remotes.set(peer.playerId, r);
			}
			if (r.sig !== sig) {
				r.sprite.setTexture(makePlayerTexture(this, peer.appearance));
				r.sig = sig;
			}
			// "Walking" is driven by the reported position actually changing — not by
			// the easing — so a standing player never waddles. A short window keeps the
			// animation alive smoothly between position updates.
			if (peer.x !== r.lastX || peer.y !== r.lastY) {
				r.moveUntil = this.time.now + 220;
				r.lastX = peer.x;
				r.lastY = peer.y;
			}
			const moving = this.time.now < r.moveUntil;
			const targetX = peer.x * TILE,
				targetY = peer.y * TILE;
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
			r.sprite.destroy();
			r.shadow.destroy();
			r.label.destroy();
			this.remotes.delete(id);
		}
	}

	private clearRemotes() {
		for (const r of this.remotes.values()) {
			r.sprite.destroy();
			r.shadow.destroy();
			r.label.destroy();
		}
		this.remotes.clear();
	}

	private handleMovement(dt: number) {
		if (this.sleeping) return; // can't roam while asleep
		const k = this.keys;
		let vx = 0,
			vy = 0;
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
		// Hiking boots (when owned and switched on) give a gentle speed bump.
		const speed = this.hasBoots() ? 160 * 1.35 : 160;
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
			if (this.isIndoors) {
				const r = this.roomSpec();
				const tx = Math.floor(px / TILE),
					ty = Math.floor((py + 8) / TILE);
				if (tx === r.doorX && ty === r.y1 + 1) return false;
				return tx < r.x0 || tx > r.x1 || ty < r.y0 || ty > r.y1;
			}
			if (this.area === 'coastal' && Math.floor(px / TILE) >= this.landRight) return true;
			// the camp building (tent/house) is solid — walk around it, not through it
			if (this.area === 'meadow') {
				const hx = Math.floor(px / TILE),
					hy = Math.floor((py + 8) / TILE);
				if (
					hx >= CAMP.tent.x - 1.5 &&
					hx <= CAMP.tent.x + 1.5 &&
					hy >= Math.floor(CAMP.tent.y) - 1 &&
					hy <= Math.floor(CAMP.tent.y) + 1
				)
					return true;
			}
			const key = `${Math.floor(px / TILE)},${Math.floor((py + 8) / TILE)}`;
			return this.waterTiles.has(key) && !this.bridgeTiles.has(key);
		};
		// If we're already standing in open water (e.g. a bed was flooded
		// underfoot), don't trap the player — let them walk straight back out.
		const alreadyInWater = blocked(this.player.x, this.player.y);
		if (!alreadyInWater && blocked(nx, ny)) {
			if (!blocked(nx, this.player.y))
				ny = this.player.y; // slide along the bank
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
		// Prefer the thing you're standing beside; otherwise light up whatever the
		// pointer is hovering, so it's clear what a click would act on.
		const focus = near || (busy || terraforming ? null : this.hoveredIt);

		// Walked up to a locked gate → post what's still needed to the corner feed,
		// but only when the remaining list actually CHANGES (not on every approach),
		// so repeatedly walking up to the same gate doesn't spam the feed.
		if (near?.liveLabel) {
			const info = near.liveLabel();
			if (info !== this.lastGateInfo) {
				this.lastGateInfo = info;
				bridge.emit('gate-info', { text: info });
			}
		}

		// pulsing highlight on whatever you can interact with right now
		if (focus) {
			this.highlight.setVisible(true).setPosition(focus.x, focus.y + 2);
		} else {
			this.highlight.setVisible(false);
		}

		// terraform tile cursor under the pointer
		if (terraforming) {
			const pointer = this.input.activePointer;
			const tx = Math.floor(pointer.worldX / TILE);
			const ty = Math.floor(pointer.worldY / TILE);
			const ok = this.tileReachable(tx, ty);
			this.tileCursor
				.setVisible(true)
				.setPosition(tx * TILE + 16, ty * TILE + 16)
				.setTexture(ok ? 'ghost-ok' : 'ghost-bad');
		} else {
			this.tileCursor.setVisible(false);
		}

		const verb = this.isTouch ? t('game.prompt.tap') : 'E';
		const clickVerb = this.isTouch ? t('game.prompt.tap') : t('game.prompt.click');
		const lowVerb = this.isTouch ? t('game.prompt.tapLower') : t('game.prompt.clickLower');
		const rotHint = !this.isTouch && this.activeRotatable() ? t('game.prompt.rotateHint') : '';
		// A locked gate's detailed "what's still needed" text goes to the corner feed
		// (see gate-info below), not this narrow bar — here it just shows its short
		// "read the trail sign" label like any other interactable.
		const nearMain = near ? t('game.prompt.near', { verb, label: near.label }) : '';
		const prompt = this.movingPlacementId
			? t('game.prompt.moveTile', { verb: clickVerb }) + rotHint + (this.isTouch ? '' : t('game.prompt.escCancel'))
			: this.placementObjectId
				? t('game.prompt.placeTile', { verb: clickVerb }) +
					rotHint +
					(this.isTouch ? '' : t('game.prompt.escStopPlacing'))
				: terraforming
					? t(terraforming === 'dig' ? 'game.prompt.shovel' : 'game.prompt.wateringCan', { verb: lowVerb }) +
						(near ? t('game.prompt.nearSuffix', { verb, label: near.label }) : '')
					: nearMain;
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
