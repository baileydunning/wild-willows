import Phaser from 'phaser';
import { bridge } from './bridge';
import {
	canPaintClick,
	isSleepable,
	blocksDoorway,
	blocksGateTrail,
	gateEdges,
	isOrphanedTween,
	screenSpaceOverlayTransform,
	arrivalKind,
} from './interactions';
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
	liveDayProgress,
	phaseAtProgress,
	gatherResourceFor,
} from '../weather';
import { t, content, getLocale, isSimpleText } from '../i18n';
import { getPrefs, renderScale, subscribe as subscribePrefs } from '../prefs';
import { getBindings, keyCodeFor, keyLabel } from '../keybindings';
import { gearOn, subscribe as subscribeGear } from '../gear';
import { isTypingTarget } from '../typing';
import { scheduleFlush, cancelFlush } from '../perf';
import { harvestReadyAt } from '../types';
import type { BiomeDef, HabitatObjectDef, Placement } from '../types';

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
const SURROUND_X = 26; // tiles of surround left/right (≥ half the widest view)
const SURROUND_Y = 18; // tiles of surround above/below (≥ half the tallest view)
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

// How long a shaped tile ignores a second command (see terraformRepeatGuard).
// Long enough to cover an impatient double-click on a slow connection, short
// enough that deliberately watering a bed twice to flood it still feels instant.
const TERRAFORM_REPEAT_MS = 700;

const C = (hex: string) => Phaser.Display.Color.HexStringToColor(hex).color;

// Has any weather been shown yet this session? The first weather you see is
// allowed to "start up" (rain/snow building from the top); every biome you
// transfer into afterwards should already be mid-storm, so we pre-warm the
// emitter on entry. Module-scoped so it survives scene.restart().
let weatherShownThisSession = false;
/** How long one weather blends into the next. Long enough that clouds thinning
 *  into clear sky reads as weather doing what weather does, rather than a
 *  lighting cue snapping over — which is what a hard swap looked like. */
const WEATHER_FADE_MS = 3200;
/** How often to sweep up tweens left pointing at destroyed sprites. */
const TWEEN_SWEEP_MS = 5000;

// Player-chosen zoom (+/− keys), multiplied onto the normal window zoom.
// Module-scoped so it survives area changes; every session starts back at
// normal (1). Up to two steps out and two steps in from "perfect" — a nudge,
// not a telescope. ZOOM_STEP is the per-press factor; the range spans two presses
// each way (SURROUND_X/Y are sized to cover the widest of those views).
const ZOOM_STEP = 1.25;
const USER_ZOOM_MIN = 1 / (ZOOM_STEP * ZOOM_STEP);
const USER_ZOOM_MAX = ZOOM_STEP * ZOOM_STEP;
let userZoom = 1;

function hashStr(s: string): number {
	let h = 2166136261;
	for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
	return h >>> 0;
}

/** Fold an epoch-milliseconds value into a running hash, both halves of it.
 *  `^` coerces through ToInt32, and a 13-digit ms timestamp does not fit — so
 *  mixing one in directly would silently discard everything above bit 31 and let
 *  two times exactly 2^32 ms apart (~49.7 days) hash identically. Growth and
 *  regrow timers are driven off these, so that collision would show up as a plant
 *  that never visually matures. */
function mixMs(h: number, ms: number): number {
	const lo = ms >>> 0;
	const hi = Math.floor(ms / 4294967296) >>> 0;
	h = Math.imul(h ^ lo, 16777619) >>> 0;
	return Math.imul(h ^ hi, 16777619) >>> 0;
}

/** hashStr memoized over the small, repeating vocabularies the dynamic signature
 *  walks — terrain types and object ids, a few dozen distinct strings shared
 *  across thousands of rows. Bounded so a stray unique value can't grow it. */
const hashMemo = new Map<string, number>();
function hashCached(s: string): number {
	let h = hashMemo.get(s);
	if (h === undefined) {
		h = hashStr(s);
		if (hashMemo.size > 512) hashMemo.clear();
		hashMemo.set(s, h);
	}
	return h;
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
	/** Optional live check for "is there anything to do here right now". Something
	 *  that returns false is skipped when picking what to focus, so a spent
	 *  resource node stops claiming the ring and the prompt while it regrows —
	 *  the sprout already says it is coming back. Clicking one directly still
	 *  runs `action`, which is what explains the wait. */
	available?: () => boolean;
}

/** One built placement, kept so a repaint can reuse it instead of rebuilding it. */
interface PlacementEntry {
	/** Everything the sprites baked in; a mismatch means rebuild. */
	key: string;
	/** Every object created for this placement, so it can be torn down cleanly. */
	objs: Phaser.GameObjects.GameObject[];
	/** Re-pushed on every repaint — refreshDynamic empties the live list. */
	its: Interactable[];
	/** The only thing that keeps moving after the sprite exists (growth, maturing). */
	applyScale: () => void;
	/** The next clock event this placement is waiting on, if any. */
	growth?: { at: number; matures: boolean };
}

/** The interior rectangle (tile coords) plus its cosmetics — what roomSpec()
 *  hands back for the home or a trail tent. Named only so the memoised copy the
 *  scene holds onto can be typed; see roomSpec(). */
interface RoomSpec {
	x0: number;
	y0: number;
	x1: number;
	y1: number;
	floor: string;
	wall: string;
	accent: string;
	rug: string;
	decor: number;
	light: number;
	doorX: number;
	doorY: number;
}

export class WorldScene extends Phaser.Scene {
	area = 'meadow';
	private player!: Phaser.GameObjects.Image;
	private playerShadow!: Phaser.GameObjects.Image;
	private walkT = 0;
	private walkAudioActive = false;
	private keys!: any;
	private moveKeys: {
		up: Phaser.Input.Keyboard.Key[];
		down: Phaser.Input.Keyboard.Key[];
		left: Phaser.Input.Keyboard.Key[];
		right: Phaser.Input.Keyboard.Key[];
		interact: Phaser.Input.Keyboard.Key[];
	} = { up: [], down: [], left: [], right: [], interact: [] };
	private interactBadge?: Phaser.GameObjects.Text;
	private groundTiles: Phaser.GameObjects.Image[] = [];
	// Living vegetation out in the unwalkable surround/edge — tinted from dead
	// (brown) to alive as the biome's health rises, so the whole world beyond the
	// fence recovers alongside it.
	private healthDeco: Phaser.GameObjects.Image[] = [];
	// Ground tinting touches every static sprite in the world (~10k in the meadow),
	// so it is memoised against the only inputs that can change the colour. Reset
	// in drawGround(), because a fresh sprite set starts untinted.
	private tintSig = '';
	private dynamic!: Phaser.GameObjects.Group;
	// Terraformed tiles get their own layer and are diffed rather than rebuilt.
	// They are the one dynamic thing that accumulates without bound over a
	// session, so tearing them all down on every dig made each dig cost more than
	// the last. Keyed "tx,ty"; `it` is the plant-bed interactable for watered soil.
	private terrain!: Phaser.GameObjects.Group;
	private terrainSprites = new Map<
		string,
		{ type: string; img: Phaser.GameObjects.Image; zone?: Phaser.GameObjects.GameObject; it?: Interactable }
	>();
	private animals!: Phaser.GameObjects.Group; // animals live in their own layer so a
	private animalSig = ''; // routine refresh doesn't reset their wandering
	private interactables: Interactable[] = [];
	private nodes: NodeDef[] = [];
	// Nodes and placements are DIFFED, for the same reason terrain is (above) and
	// with the same shape. They were torn down and rebuilt in full on every
	// world-dirty — every gather, dig, place and weather tick — so the cost of one
	// action scaled with everything the player had ever built. Reviewers described
	// it exactly: "any time there were too many resources on the screen my game
	// would come to a screeching halt, especially as you're building and placing
	// way more items." Each rebuild also re-created an infinite tween per node and
	// per harvest-ready plant, and re-attached every pointer handler.
	//
	// Keyed by id plus everything the sprites bake in, so anything that actually
	// changed is still rebuilt and anything that did not is left alone. Placing
	// item #200 now costs what item #1 cost.
	private nodeLayer!: Phaser.GameObjects.Group;
	private nodeEntries = new Map<string, { key: string; container: Phaser.GameObjects.Container; it: Interactable }>();
	private placementLayer!: Phaser.GameObjects.Group;
	private placementSprites = new Map<string, PlacementEntry>();
	private lastPrompt = '';
	private unsubs: Array<() => void> = [];
	// --- per-frame caches (perf) ---------------------------------------------
	// The frame loop used to rebuild these every tick. They all change only when
	// the world does, so they are memoised against the identity of the array they
	// are derived from: a new state object means a rebuild, otherwise a hit.
	private frameTime = 0;
	private nodeStateMap: Map<string, any> | null = null;
	private nodeStateSrc: unknown = null;
	private fireCache: { x: number; y: number }[] | null = null;
	private fireCacheSrc: unknown = null;
	private fireCacheArea = '';
	private hintKeyCache = ''; // '' = needs recompute
	// id -> habitat-object def (see objectDefs). Keyed by the data array's identity
	// AND the active wording, because the one synthetic def carries a localized name.
	private objectDefMap: Map<string, HabitatObjectDef> | null = null;
	private objectDefSrc: unknown = null;
	private objectDefLocale = '';
	// `area:x,y` -> the placement standing on that tile (see placementAt).
	private placementByTile: Map<string, Placement> | null = null;
	private placementByTileSrc: unknown = null;
	// The interior room, which is a pure function of the area + the home config.
	private roomCache: RoomSpec | null = null;
	private roomCacheArea = '';
	private roomCacheHome: unknown = null;
	private roomCacheData: unknown = null;
	// The object id currently being placed or moved (see activeObjectId).
	private activeIdCache: string | null = null;
	private activeIdMoving: string | null = null;
	private activeIdPlacing: string | null = null;
	private activeIdSrc: unknown = null;
	/** Ring of reusable floating labels — see floatText(). */
	private floatLabels: Phaser.GameObjects.Text[] = [];
	private floatNext = 0;
	private static readonly FLOAT_POOL = 8;
	// One-shot gather effects (tool swing + flying items) reuse a ring too — see
	// fxSprite(). Sized to cover a burst: a gather spends up to 4 of these and each
	// animation runs ~600ms, so this holds roughly a second of fast gathering
	// before the ring wraps and clips the oldest effect.
	private fxSprites: Phaser.GameObjects.Image[] = [];
	private fxNext = 0;
	private static readonly FX_POOL = 24;
	// Terraform specks are Arcs, not Images, so they need their own ring. A dig
	// throws 6 at once and each lives ~380-580ms.
	private fxSpecks: Phaser.GameObjects.Arc[] = [];
	private speckNext = 0;
	private static readonly SPECK_POOL = 24;
	private lastGateCheckAt = 0;
	private lastFocusX = Infinity;
	private lastFocusY = Infinity;
	private lastFocusLabel: string | null = null;
	private lastFocusSource: 'near' | 'hover' | null = null;

	private placementObjectId: string | null = null;
	private movingPlacementId: string | null = null;
	private sleeping = false;
	private ghost: Phaser.GameObjects.Container | null = null;
	private placeRotation = 0; // degrees (0/90/180/270) applied to the object being placed/moved
	private moveAccum = 0;
	private lastSynced = { x: 0, y: 0 };
	// tile key -> scene clock reading when we last sent a shaping command for it
	// (see terraformRepeatGuard)
	private lastTerraformAt = new Map<string, number>();
	// ONE timer for the whole preserve's growth, not one per plant.
	//
	// drawPlacements() used to call this.time.delayedCall() per still-growing plant
	// and per regrowing plant. Nothing ever removed those timers, and
	// drawPlacements() re-runs on EVERY refreshDynamic() — which is every gather,
	// dig, place and weather tick. So a plant growing across 50 actions accumulated
	// 50 identical timers, all due at the same instant, each one forcing a full
	// rebuild and emitting plant-matured (a RecalcBiome POST + a full GameState
	// refetch). N rebuilds x M growing plants, detonating together.
	//
	// That is the "planted too many plants and it dropped to 1 fps, had to refresh"
	// and "a tree grew and I had to save and quit" report. Tracking only the EARLIEST
	// upcoming growth event and re-deriving it on each rebuild makes the cost one
	// timer, regardless of how many plants are in the ground or how long the
	// session has run.
	private growthTimer: Phaser.Time.TimerEvent | null = null;
	/** Epoch ms of the soonest pending growth event, or 0 when nothing is due. */
	private nextGrowthAt = 0;
	/** True when the soonest event is a plant finishing growing (habitat changed,
	 *  so the biome needs re-evaluating) rather than merely becoming harvestable. */
	private nextGrowthMatures = false;
	/** Set when a fired growth event was a maturation, read by the coalesced flush.
	 *  Survives fn replacement in scheduleFlush, which keeps only the last closure. */
	private grownPending = false;
	// Same check api.ts uses to pick the desktop transport. Read once: the preload
	// sets it long before any scene is constructed.
	private readonly isDesktopBuild = !!(globalThis as any).wildWillowsDesktop?.isDesktop;
	// How long the player has to keep moving before their position is saved.
	//
	// SPLIT BY PLATFORM, deliberately. On desktop this write goes to the in-app
	// solo backend and costs a local file write, so the original 3s window is kept
	// exactly as it was — nothing about desktop play changes.
	//
	// On the web every save is an HTTP request through the Cloudflare Worker to
	// Harper, and at 3s a walking player generated up to 20 of them a minute — more
	// than heartbeats and real actions combined, and the single largest source of
	// requests the game makes. 10s costs at most ten seconds of walking on a hard
	// crash (a clean close still flushes, see flushPosition below) and cuts the
	// rate to 6/min. This is a background convenience save, not gameplay state:
	// every action that matters sends its own position with it.
	private readonly syncEverySec = this.isDesktopBuild ? 3 : 10;
	private activeTool = 'basket';
	private highlight!: Phaser.GameObjects.Container;
	/** The highlight ring's infinite pulse, held so it can be parked while the
	 *  ring is hidden (which is most of the time) — see syncRingPulse(). */
	private ringPulse?: Phaser.Tweens.Tween;
	private tileCursor!: Phaser.GameObjects.Image;
	// The interactable the pointer is currently hovering (for hover feedback), and
	// a signature of the last dynamic-layer build so redundant world-dirty events
	// (boot nudges, unrelated saves) don't tear down and rebuild every sprite/tween.
	private hoveredIt: Interactable | null = null;
	private lastGateInfo: string | null = null;
	private dynamicSig = '';
	private isTouch = false;
	private alive = false; // true between create() and shutdown (scene.isActive() is false DURING create)
	/** Unique per scene instance, so queued flushes are namespaced to the scene
	 *  that queued them and can't fire against a restarted one. */
	private readonly sceneUid = ++WorldScene.instances;
	private static instances = 0;
	private waterTiles = new Set<string>();
	private waterTileCenters: { x: number; y: number }[] = []; // pixel centers of open-water tiles
	private bridgeTiles = new Set<string>();
	// Weather visuals: a camera-locked full-screen weather-colour tint and a
	// world-locked rain/snow particle emitter, swapped when the weather changes.
	private weatherOverlay?: Phaser.GameObjects.Rectangle;
	private weatherEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
	/** Runs the colour/alpha cross-fade between two weathers. */
	private weatherFade?: Phaser.Tweens.Tween;
	/** Overlay colour we're currently showing, so a fade can start from it. */
	private weatherOverlayColor = 0xffffff;
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
	private roomSpec(): RoomSpec {
		// Indoors this is asked up to five times a frame — the movement blocking
		// check wants the walls, canPlaceAt wants the floor — and each call built a
		// fresh twelve-field object, homeRoom() re-walking the style and space
		// tables out of the data files to do it.
		//
		// It is a pure function of the area and the home config, and both are
		// swapped wholesale when a new state is adopted (never mutated in place),
		// so memoise against their identity exactly the way firesHere() does: a new
		// state object means a rebuild, anything else — including a live recolor,
		// which comes back as a new state — is a hit.
		const home = bridge.shared.state?.player?.home;
		const data = bridge.shared.data;
		if (
			this.roomCache &&
			this.roomCacheArea === this.area &&
			this.roomCacheHome === home &&
			this.roomCacheData === data
		) {
			return this.roomCache;
		}
		this.roomCacheArea = this.area;
		this.roomCacheHome = home;
		this.roomCacheData = data;
		this.roomCache = this.tentBiome ? this.tentRoom() : this.homeRoom();
		return this.roomCache;
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
			// Same test as gateGeomOf() on the server: an area has an ocean band if the
			// data gives it one. COAST_COLS only covers a definition that names no width.
			landRight: this.oceanColsOf(area) ? cols - this.oceanColsOf(area) : cols,
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
		return this.oceanColsOf(this.area);
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
	/**
	 * id -> habitat-object def, for the O(1) lookups objectDef() hands out.
	 *
	 * objectDef() is one of the busiest functions in the scene: the frame loop asks
	 * it about whatever is on the cursor, drawPlacements() asks it once per
	 * placement on every repaint, and refreshDynamic() asks it once per placement
	 * again just to find the bridges. Every one of those was a linear scan of
	 * habitatObjects with a fresh closure per call — and the 'workbench' branch was
	 * worse still: a new object literal AND a fresh i18n lookup, every time.
	 *
	 * Rebuilt when the data array is swapped (it is loaded once and replaced
	 * wholesale, never mutated) or when the wording changes underneath the
	 * synthetic def — a locale switch and the plain-language toggle both re-word
	 * it, and both are in the key.
	 */
	private objectDefs(): Map<string, HabitatObjectDef> {
		const defs = bridge.shared.data?.habitatObjects;
		const loc = getLocale() + (isSimpleText() ? ':simple' : '');
		if (this.objectDefMap && this.objectDefSrc === defs && this.objectDefLocale === loc) return this.objectDefMap;
		const map = new Map<string, HabitatObjectDef>();
		for (const o of defs || []) map.set(o.id, o);
		// The crafting station is a permanent fixture of the camp, not something the
		// data files describe. Written LAST so it still wins over a same-named entry,
		// which is what the old id === 'workbench' early return did.
		map.set('workbench', {
			id: 'workbench',
			name: t('game.object.craftingStation'),
			shape: 'workbench',
			placement: 'outdoor',
		} as any);
		this.objectDefMap = map;
		this.objectDefSrc = defs;
		this.objectDefLocale = loc;
		return map;
	}

	private objectDef(id: string): HabitatObjectDef | undefined {
		return this.objectDefs().get(id);
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
		this.weatherFade = undefined; // the scene owns the tween; it dies with it
		this.weatherOverlayColor = 0xffffff;
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
		this.dynamicSig = ''; // force a full dynamic rebuild on (re)create
		// Same restart hazard as the overlays above: the float-text ring is holding
		// Text objects that belonged to the scene this instance just was.
		this.floatLabels = [];
		this.floatNext = 0;
		this.fxSprites = [];
		this.fxNext = 0;
		this.fxSpecks = [];
		this.speckNext = 0;
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
		// The ScaleManager is GAME-global, so it outlives this scene. The scene is
		// restarted on every area transition and on every graphics-quality change,
		// so an un-removed handler here leaked one dead scene per restart — each
		// one still firing applyZoom() against a torn-down camera on every resize.
		const onScaleResize = () => this.applyZoom();
		this.scale.on('resize', onScaleResize);
		this.unsubs.push(() => this.scale.off('resize', onScaleResize));

		// groups must exist before drawGround(): the home room is now drawn into the
		// dynamic group so it can be repainted live when you use the paint tool.
		this.dynamic = this.add.group();
		this.animals = this.add.group();
		// Fresh group per create() — the old sprites went with the previous scene,
		// so the diff map has to start empty or it would track destroyed objects.
		this.terrain = this.add.group();
		this.terrainSprites.clear();
		// Same contract as terrain: fresh groups per create(), so the diff maps never
		// track sprites that went with the previous scene.
		this.nodeLayer = this.add.group();
		this.nodeEntries.clear();
		this.placementLayer = this.add.group();
		this.placementSprites.clear();

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
		// The save now holds THIS position, not the one it was holding a moment ago.
		//
		// changeArea() posts the outgoing area's coordinates alongside the incoming
		// area name (it has no way to know where the scene will put you), so between
		// a transition and the first half-tile of walking the server's idea of where
		// you are is a leftover from the area you just left. savedSpawn() reads that
		// row, so anything that rebuilt the scene in that window — a reload, most
		// obviously — resumed you at a position from the previous area. Landing the
		// arrival straight away closes the window; lastSynced is set alongside so a
		// boot (where the spawn came FROM the save) doesn't post it straight back.
		this.lastSynced = { x: spawn.x, y: spawn.y };
		if (data?.spawn) bridge.emit('player-moved', { x: spawn.x, y: spawn.y });
		this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
		this.startLeaves();

		// Arrows, Space, Esc, Shift are fixed. Movement (WASD by default) and the
		// interact key are player-rebindable (see keybindings.ts); the arrows always
		// move too, so a rebind can never strand the player. Rebuilt on any prefs change.
		this.keys = this.input.keyboard!.addKeys('UP,DOWN,LEFT,RIGHT,SPACE,ESC,SHIFT');
		this.rebindMoveKeys();
		this.unsubs.push(subscribePrefs(() => this.rebindMoveKeys()));
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
					bridge.emit('toast', {
						text: t('game.toast.noRotate'),
						kind: 'info',
					});
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
		/* The keyboard plugin outlives its own manager for a moment during teardown:
		 * the object is still there (so a `!kb` check passes) but kb.manager is
		 * already null, and enable/disableGlobalCapture writes preventDefault
		 * straight onto it. Dismantling the DOM moves focus, which fires focusout
		 * synchronously — before the shutdown handler below removes these listeners
		 * — so the window is real and easy to hit. Toggling a settings control is
		 * enough to land in it. Check the manager, not just the plugin. */
		const liveKeyboard = () => {
			if (!this.alive) return null;
			const kb = this.input?.keyboard as any;
			return kb && kb.manager ? (kb as Phaser.Input.Keyboard.KeyboardPlugin) : null;
		};
		const onFocusIn = (e: FocusEvent) => {
			if (!isTypingTarget(e.target)) return;
			const kb = liveKeyboard();
			if (!kb) return;
			kb.enabled = false;
			kb.disableGlobalCapture();
			kb.resetKeys(); // drop any held WASD so the player stops dead
		};
		const onFocusOut = (e: FocusEvent) => {
			if (!isTypingTarget(e.target)) return;
			const kb = liveKeyboard();
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
			if (document.visibilityState !== 'hidden') return;
			this.input.keyboard?.resetKeys();
			// Land the current position before the tab goes away. visibilitychange is
			// the last event that reliably fires on a tab close, so this is the flush
			// that lets syncEverySec be long on the web (see the field's comment).
			//
			// WEB ONLY. Electron fires this too (minimise, hide), but desktop kept the
			// 3s window, so there is at most three seconds of walking to rescue and
			// nothing to compensate for. Skipping it leaves desktop's behaviour on hide
			// exactly what it was before this window was ever split.
			if (!this.isDesktopBuild && this.alive) this.flushPosition();
		};
		window.addEventListener('blur', onWindowBlur);
		document.addEventListener('visibilitychange', onHidden);
		// A text box may already hold focus when this scene (re)starts — e.g.
		// changing areas or reloading while a panel's field is active.
		if (isTypingTarget(document.activeElement)) {
			// Route through the same guard — this runs during create(), which on an
			// area change happens while the previous scene is still unwinding.
			const kb = liveKeyboard();
			if (kb) {
				kb.enabled = false;
				kb.disableGlobalCapture();
			}
		}
		// nearest-interactable highlight (pulsing ring + key hint)
		const ring = this.img(0, 0, 'ring').setTint(0xffe9a8);
		const badgeBg = this.add.circle(0, -30, 9.5, 0x2b3321, 0.92).setStrokeStyle(1.5, 0xffe9a8, 1);
		const badgeText = this.add
			.text(0, -30, this.isTouch ? '·' : this.interactHintKey(), {
				fontFamily: 'Quicksand, sans-serif',
				fontSize: '11px',
				color: '#f0e8d4',
				fontStyle: 'bold',
			})
			// render the key at the texture supersample density so it stays crisp when zoomed in
			.setResolution(TEX_SCALE)
			.setOrigin(0.5);
		this.highlight = this.add.container(0, 0, [ring, badgeBg, badgeText]).setDepth(6000).setVisible(false);
		this.interactBadge = badgeText;
		this.ringPulse = this.tweens.add({
			targets: ring,
			scale: { from: 0.92 * INV_TEX_SCALE, to: 1.08 * INV_TEX_SCALE },
			alpha: { from: 0.95, to: 0.6 },
			duration: 700,
			yoyo: true,
			repeat: -1,
		});
		// Honor reduce-motion: hold the ring steady instead of pulsing. Whether the
		// tween actually runs is syncRingPulse's call now — it folds this pref
		// together with "is the ring even on screen".
		const applyRingMotion = () => {
			if (getPrefs().reduceMotion) ring.setScale(INV_TEX_SCALE).setAlpha(0.95);
			this.syncRingPulse();
		};
		applyRingMotion();

		// Re-apply motion-sensitive visuals when accessibility prefs change: toggling
		// reduce-motion adds/removes rain/snow particles (force a rebuild by clearing
		// the weather signature), pauses/resumes the highlight-ring pulse live, and
		// rebuilds the animal layer so breathing/gait tweens (which check the pref
		// at creation) are torn down or restored immediately.
		//
		// Gated on the two prefs this actually draws from. `subscribePrefs` fires for
		// EVERY preference, and the volume sliders emit a change per pixel of drag —
		// which used to tear down and rebuild every animal and weather particle ~60
		// times a second for a setting the world doesn't render. Comparing the values
		// we care about turns those drags into no-ops.
		let lastMotion = getPrefs().reduceMotion;
		let lastHint = getPrefs().interactHint;
		let lastQuality = getPrefs().graphicsQuality;
		const unsubPrefs = subscribePrefs((p) => {
			if (!this.alive) return;
			// Graphics Quality is not a repaint — it changes the canvas's PIXEL
			// DIMENSIONS, and much of what create() builds is sized in game pixels and
			// never rebuilt afterwards. The clearest casualty is lightMaskRT, the
			// screen-sized RenderTexture behind the night-light mask: it keeps its old
			// dimensions, so after a switch the firelight holes stop lining up with the
			// fires. The camera framing has the same shape of problem, and anything
			// screen-sized added later would inherit it silently.
			//
			// So don't chase each one — rebuild the scene, exactly as walking into a
			// biome does. Booting already in a mode has always rendered correctly, and
			// this makes switching INTO a mode land in that same state by construction,
			// rather than approximating it with a list of patches that has to be kept in
			// sync with every future screen-sized resource.
			if (p.graphicsQuality !== lastQuality) {
				lastQuality = p.graphicsQuality;
				lastMotion = p.reduceMotion;
				lastHint = p.interactHint;
				// Deferred a frame so PhaserGame has already resized the canvas — create()
				// must observe the NEW scale.width/height, and listener order between the
				// two subscribers isn't something to depend on.
				scheduleFlush(this.flushKey('quality'), () => {
					if (!this.alive) return;
					this.exitPlacement();
					// Restart in place: hand back the tile the caretaker is standing on, so
					// changing a display setting doesn't teleport them to the area's spawn
					// point (savedSpawn() would use the last SYNCED position, not the live one).
					this.scene.restart({
						area: this.area,
						spawn: { x: this.player.x / TILE, y: this.player.y / TILE },
					});
				});
				return;
			}
			if (p.reduceMotion === lastMotion && p.interactHint === lastHint) return;
			lastMotion = p.reduceMotion;
			lastHint = p.interactHint;
			// Coalesced to one rebuild per frame, and backed off automatically if it
			// turns out to be expensive on this save (see src/perf.ts).
			scheduleFlush(this.flushKey('prefs'), () => {
				if (!this.alive) return;
				this.weatherSig = '';
				this.applyWeather();
				applyRingMotion();
				this.rebuildAnimals();
			});
		});
		// Flipping a gear toggle takes effect immediately: the headlamp halo and
		// boots speed are read live each frame, and the binoculars' glint markers
		// are baked into the animal layer, so rebuild it here.
		const unsubGear = subscribeGear(() => {
			if (!this.alive) return;
			scheduleFlush(this.flushKey('gear'), () => {
				if (!this.alive) return;
				this.rebuildAnimals();
			});
		});
		this.events.once('shutdown', () => {
			document.removeEventListener('focusin', onFocusIn);
			document.removeEventListener('focusout', onFocusOut);
			window.removeEventListener('blur', onWindowBlur);
			document.removeEventListener('visibilitychange', onHidden);
			unsubPrefs();
			unsubGear();
			// Drop queued rebuilds so a torn-down scene can't be repainted next frame.
			for (const k of ['world', 'prefs', 'gear', 'quality', 'grown']) cancelFlush(this.flushKey(k));
			this.clearGrowthTimer();
			// Let the float-text ring go with the scene that owns it, rather than
			// leaving a restarted create() holding a list of dead Text objects.
			for (const label of this.floatLabels) label.destroy();
			this.floatLabels = [];
			for (const img of this.fxSprites) img.destroy();
			this.fxSprites = [];
			for (const speck of this.fxSpecks) speck.destroy();
			this.fxSpecks = [];
			this.floatNext = 0;
		});

		// Safety net for orphaned tweens (see clearLayer for the full story).
		//
		// clearLayer handles the two layers that churn, but a tween is orphaned by
		// ANY destroy that doesn't kill it first — a peer avatar leaving, a future
		// sprite someone adds — and one missed site silently re-creates a leak that
		// only a re-login clears. That's the part players actually felt: it never
		// got better on its own.
		//
		// So sweep periodically and drop tweens whose targets are all dead. Cheap
		// (a walk over the active list every few seconds) and it makes the whole
		// class of bug self-correcting rather than something to rediscover.
		this.time.addEvent({ delay: TWEEN_SWEEP_MS, loop: true, callback: () => this.sweepOrphanedTweens() });

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
				if (!this.alive || !(this.dynamic as any)?.scene) return; // ignore events landing mid-restart
				// Coalesced to one repaint per frame. This fires on every gather, place
				// and dig, plus the five boot nudges from App.tsx and each weather tick,
				// so a burst used to run the whole refresh (which sorts and joins every
				// terrain tile and placement to build its signature) many times over
				// inside a single frame. One flush per frame is indistinguishable to the
				// player and drops that to once.
				scheduleFlush(this.flushKey('world'), () => {
					if (!this.alive || !(this.dynamic as any)?.scene) return; // re-check: a frame passed
					this.refreshDynamic();
					this.updateNodeVisuals();
					this.applyWeather();
				});
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
		this.unsubs.push(bridge.on('collected', (p: any) => this.playPickup(p)));
		this.unsubs.push(bridge.on('terraformed', (p: any) => this.playTerraformFx(p)));
		this.unsubs.push(
			bridge.on('area-changed', (area: string) => {
				// A transition to the area we're ALREADY standing in is not a transition,
				// and restarting for one teleports the caretaker: spawnFor(a, a) falls
				// through to its "came from a neighbour" branch and lands them at the
				// trail gate on the far edge. That's the "walk out of my house and get
				// yanked to the trail sign" bug — stepping outside is an async round trip,
				// so a second click on the door (or the interact key landing while the
				// first request is still in flight) fired a SECOND area change, this time
				// from the meadow to the meadow.
				//
				// changeArea() drops the duplicate request too; this is the backstop that
				// makes a redundant event harmless no matter where it came from.
				if (area === this.area) return;
				this.exitPlacement();
				this.scene.restart({ area, spawn: this.spawnFor(area, this.area) });
			}),
		);
		this.events.once('shutdown', () => {
			this.alive = false;
			this.setWalkAudio(false);
			this.unsubs.forEach((u) => u());
			this.unsubs = [];
			// These three were built with add:false, so they are NOT on the display
			// list and scene teardown does not collect them. create() only nulled the
			// references, which leaked a screen-sized framebuffer per scene restart —
			// and the scene restarts on every area transition.
			this.lightBitmapMask?.destroy();
			this.lightBrush?.destroy();
			this.lightMaskRT?.destroy();
			this.lightBitmapMask = undefined;
			this.lightBrush = undefined;
			this.lightMaskRT = undefined;
		});

		this.time.addEvent({
			delay: 4000,
			loop: true,
			callback: () => this.updateNodeVisuals(),
		});
		// Paint weather now (entering = pre-fill so a storm you walk into is already
		// going), then keep it fresh as the weather rolls over every ~10 min.
		this.applyWeather(true);
		this.time.addEvent({
			delay: 5000,
			loop: true,
			callback: () => this.applyWeather(),
		});
		// Day/night lighting: snap to the current phase on entry, then hold steady
		// through each phase and ease over 15s to the next one at the boundary.
		this.applyDayNight(true);
		this.time.addEvent({
			delay: 2000,
			loop: true,
			callback: () => this.applyDayNight(),
		});
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
					bridge.emit('move-to', {
						placementId: this.movingPlacementId,
						x: tx,
						y: ty,
						rotation: this.placeRotation,
					});
					this.exitPlacement();
				}
				return;
			}
			if (this.placementObjectId) {
				if (this.canPlaceAt(tx, ty))
					bridge.emit('place-at', {
						objectId: this.placementObjectId,
						x: tx,
						y: ty,
						rotation: this.placeRotation,
					});
				return;
			}
			// terraform with shovel / watering can on an empty reachable tile
			if (
				this.terraformAction() &&
				(!over || over.length === 0) &&
				this.tileReachable(tx, ty) &&
				!this.terraformRepeatGuard(tx, ty)
			) {
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
		// Read from renderScale(), the same source PhaserGame sizes the canvas from —
		// NOT from this.scale.displayScale, which is derived from the canvas's measured
		// CSS bounds and lags a refresh behind. That lag was invisible while the ratio
		// was fixed at startup, but Graphics Quality can change it mid-session, and the
		// resize this fires arrives while displayScale still describes the old mode —
		// clamping against it snapped the camera to the wrong framing.
		const dpr = renderScale();
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

	/** This area's gate geometry, for blocksGateTrail(). */
	private gateGeom() {
		return {
			gateY: this.dimsOf(this.area).gateY,
			landRight: this.landRight,
			...gateEdges(bridge.shared.data?.biomes, this.area),
		};
	}

	/** Width of an area's impassable ocean band, 0 for an inland area. */
	private oceanColsOf(area: string): number {
		if (area === 'home') return 0;
		const def = this.biomeDef(area) as any;
		if (def?.oceanCols) return def.oceanCols;
		return area === 'coastal' ? COAST_COLS : 0;
	}

	/**
	 * Swallow a repeat shaping command on a tile we've only just sent one for.
	 *
	 * Watering escalates — a tilled bed becomes a watered bed, and a watered bed
	 * becomes open water — and which of those a click means is decided from the
	 * LOCAL copy of the tile, which doesn't change until the round trip lands. On a
	 * slow connection the player waters a bed, sees nothing happen, clicks again,
	 * and the second click (still reading "tilled") reaches a server that has since
	 * written "watered" — so it floods the bed they were tending into a pond.
	 *
	 * The server refuses the mismatch outright now (Terraform's `expect`), but a
	 * bounced request is still a wasted trip and an error toast for what is plainly
	 * a double-click. Anything inside this window on the same tile is dropped in
	 * silence; a deliberate second visit — click, watch it soak in, decide to make
	 * a pond — is well past it.
	 */
	private terraformRepeatGuard(tx: number, ty: number): boolean {
		const key = `${tx},${ty}`;
		const now = this.time.now;
		const last = this.lastTerraformAt.get(key);
		if (last !== undefined && now - last < TERRAFORM_REPEAT_MS) return true;
		this.lastTerraformAt.set(key, now);
		// The map is per-scene and only ever holds tiles shaped in the last moment;
		// sweep it rather than let a long session's worth of dug beds accumulate.
		if (this.lastTerraformAt.size > 64) {
			for (const [k, at] of this.lastTerraformAt) if (now - at >= TERRAFORM_REPEAT_MS) this.lastTerraformAt.delete(k);
		}
		return false;
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
				// same for the mouth of a trail gate: water there walls off the way
				// into the next biome (mirrors the check in the Terraform endpoint)
				else if (blocksGateTrail(tx, ty, this.gateGeom())) block = t('game.block.gateTrail');
				// otherwise flooding happens immediately — no confirmation prompt
			}
		}
		// What this click was decided against. The server compares it to the tile it
		// actually holds and refuses the command if the two disagree, so a click
		// aimed at a bed can never land on the different bed it has become in the
		// meantime — which is the whole of the "watering turned my bed into a pond"
		// report. `null` means "I believe this ground is unshaped".
		const expect = existing?.type ?? null;
		return { area: this.area, x: tx, y: ty, action, expect, confirm, block };
	}

	private tileReachable(tx: number, ty: number): boolean {
		const px = this.player.x / TILE - 0.5;
		const py = this.player.y / TILE - 0.5;
		// A roomy reach so digging/watering/placing doesn't need you right on top of
		// the tile (was 2.4 — bumped so you can act from a step or so further back).
		return Math.abs(tx - px) <= 3.2 && Math.abs(ty - py) <= 3.2 && this.canPlaceAt(tx, ty, true);
	}

	/**
	 * Where to stand when arriving in `area` from `from`: beside the gate on the
	 * edge that faces where you came from, computed from the destination's own
	 * grid size (biomes are different sizes now, the meadow biggest of all).
	 */
	private spawnFor(area: string, from: string): { x: number; y: number } {
		const tent = bridge.shared.state?.placements.find((pl) => pl.area === area && pl.objectId === 'trail-tent');
		const d = this.dimsOf(area);
		// The rule itself lives in interactions.ts so it can be tested without Phaser
		// — including the one that stops a duplicate transition throwing the
		// caretaker across the map (see arrivalKind).
		switch (arrivalKind(area, from, AREA_ORDER, !!tent)) {
			case 'in-place':
				return { x: this.player.x / TILE, y: this.player.y / TILE };
			case 'camp-door':
				return { ...CAMP_TENT_FRONT };
			case 'tent-door':
				return { x: tent!.x + 0.5, y: tent!.y + 1.4 };
			case 'west-edge':
				return { x: 1.8, y: d.gateY };
			case 'east-edge':
				return { x: d.cols - 2.2, y: d.gateY };
			default:
				return { ...SPAWN_DEFAULT };
		}
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
		this.tintSig = ''; // brand-new sprites: force the next tintGround() through
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
		// which edges actually lead somewhere (the last area's east is open ocean)
		const { westGate, eastGate } = gateEdges(bridge.shared.data?.biomes, this.area);
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
		const { westGate, eastGate } = gateEdges(bridge.shared.data?.biomes, this.area);
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
		// The tint is a pure function of (area, health, season). refreshDynamic runs
		// on every world change — including terraforming, which moves none of those —
		// so bail before touching ~10k sprites when the result would be identical.
		const sig = `${this.area}|${health}|${bridge.shared.state?.weather?.season ?? ''}`;
		if (sig === this.tintSig) return;
		this.tintSig = sig;
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
		const showOverlay = !this.isIndoors && !!wt.overlay;
		// Walking into a biome shows its weather already established, so that's an
		// instant set. Weather TURNING OVER while you stand there is the case that
		// used to snap — fade it.
		const fadeMs = entering ? 0 : WEATHER_FADE_MS;
		// Graphics Quality: Low also lightens the full-screen colour wash itself —
		// it's a cheap alpha-blended rect, not a perf cost, but a thinner particle
		// field reads oddly under the same heavy tint the full effect was built for,
		// so scale it down to match.
		const overlayAlpha = showOverlay ? wt.overlay!.alpha * (getPrefs().graphicsQuality === 'low' ? 0.6 : 1) : 0;
		this.fadeWeatherOverlay(showOverlay ? C(wt.overlay!.color) : this.weatherOverlayColor, overlayAlpha, fadeMs);
		// Reduced-motion players get the weather color/overlay but not the animated
		// rain/snow particles (the colorblind banner still names the weather).
		const prewarm = entering && weatherShownThisSession;
		const particle = this.isIndoors || getPrefs().reduceMotion ? null : wt.particle;
		this.setWeatherParticles(particle, prewarm, fadeMs > 0);
		weatherShownThisSession = true;
		// Weather-gated gather nodes appear/vanish with the weather, so redraw the
		// dynamic layer whenever the type turns over.
		this.refreshDynamic();
	}

	/**
	 * Blend the weather overlay from what it's showing now to a new colour/alpha.
	 *
	 * Both ends matter. Cloudy→clear is mostly an ALPHA change (the wash lifts),
	 * while rain→cloudy is mostly a COLOUR change at similar alpha — setting either
	 * directly is the jump. Phaser can't tween a Rectangle's fillColor, so this
	 * drives a 0→1 progress value and interpolates the colour itself, which also
	 * keeps colour and alpha exactly in step.
	 *
	 * `ms <= 0` sets immediately (walking into a biome, where the weather should
	 * already be established rather than fading up in front of you).
	 */
	private fadeWeatherOverlay(toColor: number, toAlpha: number, ms: number) {
		const ov = this.weatherOverlay!;
		this.weatherFade?.remove(); // a second turnover mid-fade continues from here
		this.weatherFade = undefined;

		const fromColor = this.weatherOverlayColor;
		const fromAlpha = ov.visible ? ov.alpha : 0;
		const settle = (color: number, alpha: number) => {
			this.weatherOverlayColor = color;
			ov.setFillStyle(color).setAlpha(alpha);
			// Fully transparent still costs a full-screen draw, so drop it out.
			ov.setVisible(alpha > 0.002);
		};

		if (ms <= 0 || (fromColor === toColor && Math.abs(fromAlpha - toAlpha) < 0.002)) {
			settle(toColor, toAlpha);
			return;
		}

		const from = Phaser.Display.Color.IntegerToColor(fromColor);
		const to = Phaser.Display.Color.IntegerToColor(toColor);
		const progress = { t: 0 };
		this.weatherFade = this.tweens.add({
			targets: progress,
			t: 1,
			duration: ms,
			ease: 'Sine.easeInOut', // no hard start/stop — weather eases in and out
			onUpdate: () => {
				if (!this.alive || !ov.scene) return;
				const c = Phaser.Display.Color.Interpolate.ColorWithColor(from, to, 100, progress.t * 100);
				settle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), fromAlpha + (toAlpha - fromAlpha) * progress.t);
			},
			onComplete: () => {
				this.weatherFade = undefined;
				if (this.alive && ov.scene) settle(toColor, toAlpha);
			},
		});
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
	/**
	 * Where the world is in its day, from the SHARED clock in weather.ts.
	 *
	 * This used to keep its own anchor, duplicating that logic — and duplicating
	 * its bug: both re-anchored on any change to the snapshot's play time, so a
	 * snapshot arriving behind the free-running estimate rewound the sky. One
	 * clock means the lighting and the HUD's dial cannot disagree, which is what
	 * the comment on applyDayNight always claimed.
	 */
	private currentDayProgress(): number | null {
		return liveDayProgress(bridge.shared.state?.weather);
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
			this.lightState = {
				r: flat.red,
				g: flat.green,
				b: flat.blue,
				a: st.alpha,
			};
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
		// Called from the frame loop. The fire list only changes when placements do,
		// so it is memoised against the identity of the placements array — walking
		// every placement (a number that grows as the preserve is built out) and
		// allocating a fresh array of points 60 times a second was pure waste.
		const placements = bridge.shared.state?.placements;
		if (this.fireCache && this.fireCacheSrc === placements && this.fireCacheArea === this.area) {
			return this.fireCache;
		}
		const fires: { x: number; y: number }[] = [];
		if (this.area === 'meadow') fires.push({ x: CAMP.fire.x * TILE, y: CAMP.fire.y * TILE });
		for (const p of placements || []) {
			if (p.area === this.area && p.objectId === 'campfire') fires.push({ x: p.x * TILE + 16, y: p.y * TILE + 16 });
		}
		this.fireCache = fires;
		this.fireCacheSrc = placements;
		this.fireCacheArea = this.area;
		return fires;
	}

	/** Per-frame night-light update. Only active when it's actually dark (night
	 *  tint meaningfully opaque — dusk/dawn washes don't need it, and reduce-
	 *  motion/colorblind modes hold daylight so it never runs there). The lamp
	 *  follows the player; fires burn where they stand; every light's strength
	 *  tracks the tint as night eases in and out. */
	private updateNightLights() {
		const dark = !this.isIndoors && !!this.lightOverlay?.visible && this.lightState.a > 0.15;
		// Bail before touching the fire list. The old order built the list (and an
		// empty throwaway array on the daylight path) and only then discovered it
		// had nothing to light — for roughly two thirds of every in-game day.
		if (!dark) {
			if (this.lampGlow?.visible) this.lampGlow.setVisible(false);
			if (this.lightOverlay?.mask) this.lightOverlay.clearMask();
			return;
		}
		const hasLamp = this.hasHeadlamp();
		const fires = this.firesHere();
		if (!hasLamp && fires.length === 0) {
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
		const glow = this.lampGlow!;
		glow.setPosition(x, y).setAlpha(hasLamp ? 0.3 * depth : 0);
		// Guarded for the same reason as the player's depth: the setter queues a
		// display-list re-sort whether or not the value changed.
		const glowDepth = y - 4;
		if (glow.depth !== glowDepth) glow.setDepth(glowDepth);
		if (glow.visible !== hasLamp) glow.setVisible(hasLamp);
		if (!this.lightMaskRT || !this.lightBrush || !this.lightBitmapMask) return; // canvas renderer: halos only
		// The night tint is screen-space (scrollFactor 0), so the mask is too: a
		// screen-sized RenderTexture, restamped each frame at each light's
		// on-screen position (world → screen via the camera view + zoom).
		const rt = this.lightMaskRT;
		if (rt.width !== this.scale.width || rt.height !== this.scale.height) {
			rt.resize(this.scale.width, this.scale.height);
		}
		const cam = this.cameras.main;
		// Cancel the camera transform on the mask itself.
		//
		// A BitmapMask is rendered THROUGH the main camera (WebGLRenderer
		// .drawBitmapMask → mask.renderWebGL(…, camera)) even though this
		// RenderTexture was never added to the display list, and the shader then
		// samples it in screen space. So the camera's zoom and origin apply to the
		// mask: Phaser's matrix works out to
		//     screen = p * zoom + origin * (1 - zoom)
		// Left at scale 1 and position 0, the mask rendered `zoom`× too large and
		// offset, which made every stamped light land at zoom² of its intended
		// screen position. The halo therefore slid off its fire as the camera
		// scrolled — the further you walked, the further it lagged — and the error
		// vanishes only at zoom 1, which is why it survived this long.
		//
		// Scaling by 1/zoom and offsetting by origin·(1 − 1/zoom) makes the mask sit
		// exactly over the screen at 1:1, so texture coords ARE screen coords and
		// the stamping below is finally what it always read as.
		const fit = screenSpaceOverlayTransform(cam);
		rt.setScale(fit.scale);
		rt.setPosition(fit.x, fit.y);
		// worldView reflects LAST frame's scroll: the smooth camera-follow (lerp)
		// for THIS frame isn't applied until the camera's preRender, so a fixed
		// light (a fire) would trail behind as you walk. Predict this frame's
		// scroll using Phaser's own follow math (no-deadzone case) so lights land
		// where the world actually renders this frame, not a frame late.
		let viewX = cam.worldView.x;
		let viewY = cam.worldView.y;
		if (!cam.deadzone) {
			viewX += (this.player.x - cam.followOffset.x - cam.width * cam.originX - cam.scrollX) * cam.lerp.x;
			viewY += (this.player.y - cam.followOffset.y - cam.height * cam.originY - cam.scrollY) * cam.lerp.y;
		}
		// RenderTexture.draw() is beginDraw + batchDraw + endDraw internally, i.e. a
		// framebuffer bind and a pipeline flush PER LIGHT. Campfires are placeable,
		// so that cost was unbounded — a lit path of 20 fires meant 20 binds every
		// frame after dark. One begin/end around the whole set costs one bind total.
		const stamp = (wx: number, wy: number, size: number, alpha: number) => {
			const sz = size * cam.zoom;
			const sx = (wx - viewX) * cam.zoom;
			const sy = (wy - viewY) * cam.zoom;
			// Skip lights that cannot touch the screen at all.
			if (sx + sz < 0 || sy + sz < 0 || sx - sz > rt.width || sy - sz > rt.height) return;
			this.lightBrush!.setDisplaySize(sz, sz).setAlpha(alpha);
			rt.batchDraw(this.lightBrush!, sx, sy);
		};
		rt.clear();
		rt.beginDraw();
		// the lamp never fully clears the night (max ~0.8 mask alpha) — a modest
		// personal glow, dimmer and tighter than a campfire's
		if (hasLamp) stamp(x, y, WorldScene.LAMP_MASK, Math.min(0.8, depth * 0.9));
		// steady light — no flicker; the lit edge holds still so night reads calmly
		for (let i = 0; i < fires.length; i++) {
			const f = fires[i];
			stamp(f.x, f.y, WorldScene.FIRE_MASK, Math.min(1, depth * 1.35));
		}
		rt.endDraw();
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
	private setWeatherParticles(kind: 'rain' | 'snow' | null, prewarm = false, easeOut = false) {
		if (this.weatherEmitter) {
			const old = this.weatherEmitter;
			this.weatherEmitter = undefined;
			if (easeOut) {
				// Rain doesn't stop mid-air. Stop EMITTING but leave what's already
				// falling to land, then clean up once the last particle has expired.
				// Destroying outright was half the visible jump — a full screen of
				// rain vanishing between one frame and the next.
				old.stop();
				const lifespan = old.getData('wxLifespan') || 2000;
				this.time.delayedCall(lifespan + 200, () => {
					if (old.scene) old.destroy();
				});
			} else {
				old.destroy();
			}
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
		// Graphics Quality: Low keeps the same weather TYPE (rain still reads as
		// rain) but halves the particle budget and thins the spawn rate — the
		// scene stays legible with a fraction of the sprites alive at once, which
		// is where weather's per-frame cost actually comes from.
		const lite = getPrefs().graphicsQuality === 'low';
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
					quantity: lite ? 1 : 2,
					frequency: lite ? 60 : 26,
					maxAliveParticles: lite ? 90 : 220,
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
					frequency: lite ? 110 : 55,
					maxAliveParticles: lite ? 100 : 240,
				})
				.setDepth(5020);
		}
		// Remembered so a later stop() knows how long to wait for the sky to clear.
		this.weatherEmitter.setData('wxLifespan', lifespan);
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
		// Terrain and placements are folded to a 32-bit hash instead of a sorted,
		// joined string. This function is the GATE that lets refreshDynamic skip a
		// rebuild, so it runs on every flush — including all the ones it goes on to
		// reject — and terrain is, by this file's own note, "the one dynamic thing
		// that accumulates without bound over a session". Building one ~40KB string
		// per check (map, sort, join, then a full string compare) cost more than the
		// skip saved on a busy save. The fold is order-INDEPENDENT — each row is
		// hashed on its own and the results are combined with `+` and `^`, both
		// commutative — which is what the `.sort()` was there to provide, at O(n)
		// instead of O(n log n) and with no allocation per row.
		let tSum = 0;
		let tXor = 0;
		let tCount = 0;
		for (const tt of st.terrain || []) {
			if (tt.area !== this.area) continue;
			tCount++;
			let h = hashCached(tt.type);
			h = Math.imul(h ^ (tt.x | 0), 16777619) >>> 0;
			h = Math.imul(h ^ (tt.y | 0), 16777619) >>> 0;
			tSum = (tSum + h) | 0;
			tXor ^= h;
		}
		let pSum = 0;
		let pXor = 0;
		let pCount = 0;
		for (const pl of st.placements || []) {
			if (pl.area !== this.area) continue;
			pCount++;
			let h = hashStr(pl.id) ^ hashCached(pl.objectId);
			// *4 keeps the quarter-tile resolution placements are actually stored at.
			h = Math.imul(h ^ (pl.x * 4 + pl.y * 1024), 16777619) >>> 0;
			h = Math.imul(h ^ (pl.rotation || 0), 16777619) >>> 0;
			h = mixMs(h, pl.plantedAt || 0);
			h = mixMs(h, (pl as any).lastHarvestAt || 0);
			pSum = (pSum + h) | 0;
			pXor ^= h;
		}
		// TWO independent accumulators, and this is the part that is easy to get
		// wrong: `+` and `^` are each commutative on their own, but interleaving them
		// into ONE running value is not — the fold then depends on the array's order,
		// and the state array is rebuilt on every refresh, so a pure reorder would
		// read as a change and rebuild the whole layer for nothing. That is exactly
		// what the `.sort()` this replaces was preventing. Kept separate, each
		// accumulator is order-independent, so the pair is too.
		//
		// Counts ride along so the cheapest change to miss — one row added and
		// another removed — has to collide on all three at once.
		const terrain = `${tCount}.${(tSum >>> 0).toString(36)}.${(tXor >>> 0).toString(36)}`;
		const placements = `${pCount}.${(pSum >>> 0).toString(36)}.${(pXor >>> 0).toString(36)}`;
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

	/** Flush keys are per-scene-instance so a restarted scene never inherits the
	 *  pending work (or the learned cost) of the one it replaced. */
	private flushKey(name: string): string {
		return `scene:${this.sceneUid}:${name}`;
	}

	/**
	 * Empty a layer, taking its TWEENS with it.
	 *
	 * This is the fix for the session-long slowdown that only a re-login cleared.
	 * Phaser tweens are fire-and-forget: the manager drops one when it COMPLETES,
	 * and destroying the object it drives does not remove it. Every looping tween
	 * in these layers is `repeat: -1` — the swaying grass, bobbing water, pulsing
	 * gather nodes, breathing animals — so it never completes and was never
	 * dropped. `group.clear(true, true)` destroyed the sprites and left their
	 * tweens behind, still ticking every frame against dead objects.
	 *
	 * The dynamic layer is rebuilt on essentially every world change, so the
	 * orphans accumulated for as long as you played: a few dozen after a minute,
	 * thousands after an hour, each one costing frame time forever. Logging out
	 * "fixed" it only because scene shutdown destroys the whole TweenManager.
	 */
	private clearLayer(group?: Phaser.GameObjects.Group) {
		if (!group || !(group as any).scene) return;
		for (const child of group.getChildren()) {
			this.tweens.killTweensOf(child);
			// Per-object timers (the shadow follower) hang off the sprite too.
			const timer = (child as any).getData?.('wxTimer') as Phaser.Time.TimerEvent | undefined;
			timer?.remove();
		}
		group.clear(true, true);
	}

	/**
	 * Remove tweens whose targets have all been destroyed.
	 *
	 * A Phaser tween holds a hard reference to its targets and keeps updating them
	 * forever when it can't complete (`repeat: -1`). A destroyed sprite doesn't
	 * remove it, so each orphan costs frame time and leaks memory for the rest of
	 * the session. clearLayer prevents the two known sources; this catches the rest
	 * so the game recovers on its own instead of needing a re-login.
	 *
	 * Only Phaser GameObjects are judged — plain-object targets (the weather fade
	 * drives a `{ t: 0 }` counter) have no lifecycle to be dead.
	 */
	private sweepOrphanedTweens() {
		if (!this.alive) return;
		let removed = 0;
		const isGameObject = (t: unknown) => t instanceof Phaser.GameObjects.GameObject;
		for (const tween of this.tweens.getTweens()) {
			if (isOrphanedTween((tween as any).targets, isGameObject)) {
				tween.remove();
				removed++;
			}
		}
		if (removed) console.warn(`world: swept ${removed} orphaned tween(s)`);
	}

	/** Tear down and repaint the animal layer. Shared by the prefs and gear
	 *  subscriptions, both of which need the tweens rebuilt from scratch. */
	private rebuildAnimals() {
		if (!this.alive || !(this.animals as any)?.scene) return;
		this.animalSig = '';
		this.clearLayer(this.animals);
		this.drawAnimals();
	}

	private refreshDynamic(force = false) {
		// Bail if the dynamic layer isn't live. A bridge event (world-dirty) can land
		// mid scene.restart() teardown when this.alive hasn't flipped to false yet;
		// a destroyed Group has its `.scene` nulled, and clearing it throws
		// "Cannot read properties of undefined (reading 'size')".
		if (!this.alive || !this.dynamic || !(this.dynamic as any).scene) return;
		// Skip the rebuild when nothing the dynamic layer depends on has changed.
		// Indoors always rebuilds — it's a single cheap room, and the paint tool
		// repaints walls/rugs/placements live (colour changes aren't in the sig).
		if (!force && !this.isIndoors) {
			const sig = this.computeDynamicSig();
			if (sig === this.dynamicSig) return;
			this.dynamicSig = sig;
		}
		this.clearLayer(this.dynamic);
		this.interactables = [];
		// Growth events are re-derived from the placements we are about to draw, so
		// drop the previous timer rather than letting rebuilds pile them up.
		this.clearGrowthTimer();
		this.hoveredIt = null; // its hit zone was just destroyed; a fresh pointerover will re-set it
		if (this.isIndoors) {
			// Nodes never exist indoors and drawNodes() is not on this path, so they
			// have to be dropped explicitly or the preserve's would show through the
			// room. Placements need no such help: refreshHome() calls drawPlacements(),
			// and anything belonging to the area you just left is absent from its
			// `want` set, so the diff destroys it there.
			this.clearNodeLayer();
			this.refreshHome();
			// A tent interior can hold plants too, so its growth events still need a
			// timer — the outdoor path arms one at the end of refreshDynamic.
			this.armGrowthTimer();
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
			this.clearLayer(this.animals);
			this.drawAnimals();
		}
		// drawPlacements() has now reported every upcoming growth event; arm the one
		// timer that covers the soonest of them.
		this.armGrowthTimer();
	}

	/** Drop every diffed node sprite (going indoors, where there are none). */
	private clearNodeLayer() {
		for (const entry of this.nodeEntries.values()) {
			this.tweens.killTweensOf(entry.container);
			entry.container.destroy();
		}
		this.nodeEntries.clear();
	}

	/** Cancel the pending growth timer and forget what it was waiting for. */
	private clearGrowthTimer() {
		this.growthTimer?.remove(false);
		this.growthTimer = null;
		this.nextGrowthAt = 0;
		this.nextGrowthMatures = false;
	}

	/**
	 * Report an upcoming growth event. Keeps only the soonest — the repaint it
	 * triggers re-runs drawPlacements(), which reports the next one, so the chain
	 * walks the whole field one event at a time with a single live timer.
	 */
	private noteGrowth(at: number, matures: boolean) {
		if (this.nextGrowthAt !== 0 && at >= this.nextGrowthAt) return;
		this.nextGrowthAt = at;
		this.nextGrowthMatures = matures;
	}

	private armGrowthTimer() {
		if (!this.alive || this.nextGrowthAt === 0) return;
		const matures = this.nextGrowthMatures;
		// Anything already due (matured while the tab was hidden) fires on the next
		// tick rather than in the past.
		const delay = Math.max(0, this.nextGrowthAt - Date.now());
		this.growthTimer = this.time.delayedCall(delay, () => {
			this.growthTimer = null;
			if (!this.alive) return;
			if (matures) this.grownPending = true;
			// Coalesced like world-dirty: if a gather lands in the same frame, the two
			// collapse into one rebuild instead of two. Forced, because a sprout
			// becoming a grown plant changes no state the dynamic signature reads.
			scheduleFlush(this.flushKey('grown'), () => {
				if (!this.alive || !(this.dynamic as any)?.scene) return;
				const wasMaturation = this.grownPending;
				this.grownPending = false;
				this.refreshDynamic(true);
				// Only a maturation changes the habitat, so only it is worth the
				// RecalcBiome round trip a listener will make.
				if (wasMaturation) bridge.emit('plant-matured', this.area);
			});
		});
	}

	/**
	 * Terraformed ground: tilled beds and watered, recovering soil.
	 *
	 * Diffed, not rebuilt. Terrain is the only dynamic set that grows for the whole
	 * session, and a dig is by definition a terrain change — so rebuilding it meant
	 * each dig destroyed and recreated every tile dug so far (each destroy costing
	 * two scans of the scene display list, plus an infinite tween and a hit zone per
	 * tile). Tile #200 cost ~200× tile #1. Here only tiles that appeared, vanished,
	 * or changed type are touched, so a dig costs the same at tile 200 as at tile 1.
	 */
	private drawTerrain() {
		const s = bridge.shared.state;
		const want = new Map<string, { x: number; y: number; type: string }>();
		for (const tile of s?.terrain || []) {
			if (tile.area !== this.area) continue;
			want.set(`${tile.x},${tile.y}`, tile);
		}
		// Gone, or retyped (tilled → watered → water): drop the old sprite.
		for (const [key, cur] of [...this.terrainSprites]) {
			const next = want.get(key);
			if (next && next.type === cur.type) continue;
			this.tweens.killTweensOf(cur.img);
			cur.img.destroy();
			cur.zone?.destroy();
			this.terrainSprites.delete(key);
		}
		// New, or retyped: build it.
		for (const [key, tile] of want) {
			if (this.terrainSprites.has(key)) continue;
			this.terrainSprites.set(key, this.buildTerrainTile(tile));
		}
		// refreshDynamic resets this.interactables before calling us, so every
		// surviving bed has to re-announce itself even when its sprite didn't change.
		for (const entry of this.terrainSprites.values()) if (entry.it) this.interactables.push(entry.it);
	}

	/** Build the sprite (and, for watered soil, the plant-bed hit zone) for one tile. */
	private buildTerrainTile(tile: { x: number; y: number; type: string }) {
		const x = tile.x * TILE + 16;
		const y = tile.y * TILE + 16;
		if (tile.type === 'water') {
			const img = this.img(x, y, 'terrain-water').setDepth(1.6);
			this.terrain.add(img);
			this.tweens.add({
				targets: img,
				alpha: { from: 1, to: 0.86 },
				duration: 1300 + ((tile.x + tile.y) % 4) * 180,
				yoyo: true,
				repeat: -1,
				ease: 'Sine.easeInOut',
			});
			return { type: tile.type, img };
		}
		const img = this.img(x, y, tile.type === 'watered' ? 'watered' : 'tilled').setDepth(1.5);
		this.terrain.add(img);
		if (tile.type !== 'watered') return { type: tile.type, img };
		// watered beds are ready for planting; terraform clicks still reach the
		// soil here so the can/shovel can flood or clear it (with confirmation)
		const it: Interactable = {
			x,
			y,
			label: t('game.label.plantBed'),
			action: () => bridge.emit('bed-clicked', { area: this.area, x: tile.x, y: tile.y }),
		};
		// The zone lives in the terrain group, not the dynamic one, so it survives a
		// dynamic rebuild alongside its sprite. registerInteractable pushes `it` onto
		// this.interactables; drawTerrain re-pushes it on subsequent rebuilds.
		const zone = this.add.zone(x, y, 64, 64).setOrigin(0.5).setInteractive({ useHandCursor: true });
		this.terrain.add(zone);
		this.registerInteractable(it, zone, { terraformPassthrough: true });
		return { type: tile.type, img, zone, it };
	}

	/** Wire an interactable so it can also be tapped/clicked directly (mobile-first). */
	private registerInteractable(
		it: Interactable,
		hitObject?: Phaser.GameObjects.GameObject,
		opts: { terraformPassthrough?: boolean; keyOnly?: boolean; collect?: Interactable[] } = {},
	) {
		// `collect` routes the interactable into a diffed entry instead of the live
		// list, so a surviving sprite can re-announce itself on later rebuilds
		// without re-attaching its pointer handlers.
		(opts.collect || this.interactables).push(it);
		const target =
			hitObject ||
			this.addDyn(this.add.zone(it.x, it.y, 64, 64).setOrigin(0.5).setInteractive({ useHandCursor: true }));
		// Hover feedback: light up the interactable under the pointer even before you
		// reach it, so it's clear what a click will act on (visuals are unchanged).
		target.on('pointerover', () => {
			if (!bridge.shared.uiBlocking) this.hoveredIt = it;
		});
		target.on('pointerout', () => {
			if (this.hoveredIt === it) this.hoveredIt = null;
		});
		// keyOnly: the interactable still shows its hover highlight and prompt, and
		// the interact key still runs it, but a CLICK is left alone for whatever else
		// owns it. Beds use this so tapping one opens the move/pick-up menu instead of
		// putting you to sleep — an action that skips the clock to dawn is far too
		// destructive to fire from a stray click on a thing you walked past.
		if (opts.keyOnly) return;
		target.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
			if (bridge.shared.uiBlocking) return; // a modal is open — clicks don't reach the world
			if (this.placementObjectId || this.movingPlacementId) return;
			if (this.activeTool === 'paint' && this.isHome) return; // painting takes over clicks indoors
			// Ground tiles (watered beds) and gather nodes let terraform clicks pass
			// through to the soil beneath — a bed can be flooded or cleared, and a node
			// steps aside (see the node registration in drawNodes). Chests and stations
			// always run their own action instead: they can't move out of the way, and
			// holding the shovel or can should never turn "open chest" into a baffling
			// terraform error.
			if (this.terraformAction() && opts.terraformPassthrough) {
				const tx = Math.floor(pointer.worldX / TILE);
				const ty = Math.floor(pointer.worldY / TILE);
				if (this.tileReachable(tx, ty) && !this.terraformRepeatGuard(tx, ty)) {
					bridge.emit('terraform-at', this.terraformPayload(tx, ty));
				}
				return;
			}
			if (pointer.event && (pointer.event as MouseEvent).shiftKey) return; // shift = pick up
			const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, it.x, it.y);
			if (dist <= 155) it.action();
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
			if (cur < u.minHealth)
				needs.push(
					t('game.gate.needHealth', {
						biome: prereqName,
						goal: u.minHealth,
						cur,
					}),
				);
		}
		if (u.minAnimals) {
			const cur = prereq?.returnedCount || 0;
			if (cur < u.minAnimals)
				needs.push(
					t('game.gate.needAnimals', {
						biome: prereqName,
						goal: u.minAnimals,
						cur,
					}),
				);
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
					t('game.gate.needKit', {
						item: obj ? content('habitatObject', obj.id, 'name', obj.name) : u.requiresItem,
					}),
				);
			}
		}
		if (!needs.length) return t('game.gate.almost', { name });
		return t('game.gate.stillNeeds', {
			name,
			needs: needs.join(t('game.gate.sep')),
		});
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
				this.img(fx, fy, 'glow')
					.setTint(0xffb84f)
					.setDepth(fy - 1)
					.setScale(1.3 * INV_TEX_SCALE),
			);
			(fireGlow as Phaser.GameObjects.Image).setBlendMode(Phaser.BlendModes.ADD);
			this.addDyn(this.img(fx, fy, 'campfire').setDepth(fy));
			// bright core layered ABOVE the fire so the peak brightness sits on the flame
			const fireCore = this.addDyn(
				this.img(fx, fy, 'glow')
					.setTint(0xffd98a)
					.setDepth(fy + 2)
					.setAlpha(0.4)
					.setScale(0.55 * INV_TEX_SCALE),
			);
			(fireCore as Phaser.GameObjects.Image).setBlendMode(Phaser.BlendModes.ADD);

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
						bridge.emit('toast', {
							text: t('game.toast.forestOvergrown', { label }),
							kind: 'info',
						});
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
				label: t('game.label.walkBackTo', {
					name: this.biomeName('meadow', 'Willow Meadow'),
				}),
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
						: t('game.toast.wetlandWashedOut', {
								label: wetland?.unlock?.label || '',
							});
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
				label: t('game.label.walkBackTo', {
					name: this.biomeName('forest', 'Old Hollow Forest'),
				}),
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
						: t('game.toast.desertBlocked', {
								label: desert?.unlock?.label || '',
							});
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
				label: t('game.label.walkBackTo', {
					name: this.biomeName('wetland', 'Rushwater Wetland'),
				}),
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
						: t('game.toast.alpineBlocked', {
								label: alpine?.unlock?.label || '',
							});
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
				label: t('game.label.walkBackTo', {
					name: this.biomeName('desert', 'Redstone Scrubland'),
				}),
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
						: t('game.toast.coastalSnowedIn', {
								label: coastal?.unlock?.label || '',
							});
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
				label: t('game.label.walkBackUpTo', {
					name: this.biomeName('alpine', 'Graywind Heights'),
				}),
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
				action: () =>
					bridge.emit('toast', {
						text: t('game.toast.oceanView'),
						kind: 'info',
					}),
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
			if (this.inCamp(tx, ty) || this.nearGate(tx, ty)) continue;
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
		// The meadow is the opening biome: guarantee a comfortable supply of the two
		// starter staples new caretakers reach for first — plant fiber and water.
		const minFor = (r: string) => {
			if (this.area === 'meadow' && (r === 'fiber' || r === 'water')) return 4;
			if (r === 'branches' && (this.area === 'meadow' || this.area === 'forest')) return 3;
			return MIN_PER_RESOURCE;
		};
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
				nodes.push({
					id: `n${nodes.length}`,
					resourceId: r,
					tx: spot.tx,
					ty: spot.ty,
				});
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
					nodes.push({
						id: 'nw',
						resourceId: waterRes,
						tx: spot.tx,
						ty: spot.ty,
					});
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
					nodes.push({
						id: `wx-${wxRes.id}-${i}`,
						resourceId: wxRes.id,
						tx: spot.tx,
						ty: spot.ty,
					});
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

	/** Keep gather nodes clear of the gate openings (both edges, at the gate row)
	 *  so nothing spawns blocking the way into the next/previous biome. */
	private nearGate(tx: number, ty: number): boolean {
		const gy = this.dimsOf(this.area).gateY;
		if (Math.abs(ty - gy) > 2) return false;
		return tx < 4 || tx > this.landRight - 4;
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
					if (occupied.has(key) || taken.has(key) || this.inCamp(tx, ty) || this.nearGate(tx, ty)) continue;
					// Don't let gather nodes clump: skip any tile touching an existing node
					// (Chebyshev-adjacent), matching the spacing the main scatter enforces.
					let adjacent = false;
					for (let ax = -1; ax <= 1 && !adjacent; ax++)
						for (let ay = -1; ay <= 1; ay++)
							if ((ax || ay) && taken.has(`${tx + ax},${ty + ay}`)) {
								adjacent = true;
								break;
							}
					if (adjacent) continue;
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
		// This runs for every node, every frame, via nearestInteractable(). Building
		// the key string here and scanning nodeStates linearly cost one allocation
		// and one O(nodeStates) walk per node per frame — and nodeStates grows for
		// the life of the save, so it got worse the longer you played.
		const n = node as any;
		if (n._skWid !== wid || n._skArea !== this.area) {
			n._skWid = wid;
			n._skArea = this.area;
			n._sk = `${wid}:${this.area}:${node.id}`;
		}
		if (this.nodeStateSrc !== s.nodeStates) {
			this.nodeStateSrc = s.nodeStates;
			const m = new Map<string, any>();
			for (const ns of s.nodeStates) m.set(ns.id, ns);
			this.nodeStateMap = m;
		}
		const rec = this.nodeStateMap!.get(n._sk);
		if (!rec) return true;
		return Date.now() - rec.harvestedAt >= s.nodeRegenSeconds * 1000;
	}

	/**
	 * Resource nodes, diffed like terrain.
	 *
	 * The node LAYOUT is seeded from the world id, so it only changes when the set
	 * of nodes changes — not when one is gathered. Whether a node is currently
	 * available is already handled separately by updateNodeVisuals(), which just
	 * toggles two sprites. So the whole set used to be destroyed and rebuilt (a
	 * container, two images, a hit area and an infinite tween each) on every
	 * action, to end up looking identical.
	 */
	private drawNodes() {
		this.nodes = this.computeNodes();
		const want = new Map<string, NodeDef>();
		for (const node of this.nodes) want.set(node.id, node);
		for (const [id, entry] of [...this.nodeEntries]) {
			const node = want.get(id);
			if (node && this.nodeKey(node) === entry.key) continue;
			this.tweens.killTweensOf(entry.container);
			entry.container.destroy();
			this.nodeEntries.delete(id);
		}
		for (const node of this.nodes) {
			const existing = this.nodeEntries.get(node.id);
			if (existing) {
				// refreshDynamic emptied this.interactables, so survivors re-announce.
				this.interactables.push(existing.it);
				continue;
			}
			this.nodeEntries.set(node.id, this.buildNode(node));
		}
		this.updateNodeVisuals();
	}

	/** Everything about a node its sprites bake in. Availability is deliberately
	 *  absent — that is updateNodeVisuals()'s job and costs two setVisible calls. */
	private nodeKey(node: NodeDef): string {
		return `${node.resourceId}|${node.tx}|${node.ty}`;
	}

	private buildNode(node: NodeDef) {
		const data = bridge.shared.data;
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
		this.nodeLayer.add(container);
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
			available: () => this.nodeAvailable(node),
			action: () => {
				if (this.nodeAvailable(node))
					bridge.emit('collect-node', {
						biomeId: this.area,
						nodeId: node.id,
						resourceId: node.resourceId,
					});
				else
					bridge.emit('toast', {
						text: t('game.toast.stillRegrowing'),
						kind: 'error',
					});
			},
		};
		// Terraform clicks pass THROUGH a gather node. Shaping the land used to stop
		// dead at every regen spot — you'd click to dig, gather a seed instead, and
		// have to build around a tile you didn't choose. Nodes are the one occupant
		// that can simply move: computeNodes() relocates any node sitting on a
		// terraformed tile to the nearest free square, keeping its id and its
		// cooldown, so digging under one nudges it aside rather than refusing.
		// (Chests and stations still swallow the click — those can't be nudged, and
		// turning "open chest" into a terraform error was the bug that rule fixed.)
		this.registerInteractable(it, container, { terraformPassthrough: true });
		return { key: this.nodeKey(node), container, it };
	}

	private updateNodeVisuals() {
		if (!this.alive) return;
		for (const node of this.nodes) {
			const c = this.nodeEntries.get(node.id)?.container;
			if (!c || !c.active) continue;
			const available = this.nodeAvailable(node);
			((c as any).nodeImg as Phaser.GameObjects.Image).setVisible(available);
			((c as any).sproutImg as Phaser.GameObjects.Image).setVisible(!available);
		}
	}

	// ----------------------------------------------------- feedback effects

	/** Items visibly pop out of the node, arc into your basket, and a +N floats up. */
	private playPickup(p: { nodeId: string; resourceId: string; qty: number; tool: string; color?: string }) {
		// Same mid-restart hazard the world-dirty handler guards against: during
		// scene.restart() `alive` has not flipped yet, but the scene's factories are
		// already gone — so this.add is null and every gather throws out of the
		// bridge handler. `alive` alone is not enough.
		if (!this.alive || !(this.dynamic as any)?.scene) return;
		const node = this.nodes.find((n) => n.id === p.nodeId);
		const sx = node ? node.tx * TILE + 16 : this.player.x;
		const sy = node ? node.ty * TILE + 16 : this.player.y;
		const texKey = this.textures.exists(`rnode-${p.resourceId}`) ? `rnode-${p.resourceId}` : 'node';

		// tool swing beside the player
		const toolKey = `tool-${p.tool}`;
		if (this.textures.exists(toolKey)) {
			const toolImg = this.fxSprite(this.player.x + 14, this.player.y - 4, toolKey)
				.setDepth(6500)
				.setAngle(-30);
			this.tweens.add({
				targets: toolImg,
				angle: 28,
				duration: 220,
				yoyo: true,
				onComplete: () =>
					this.tweens.add({
						targets: toolImg,
						alpha: 0,
						duration: 160,
						// Parked, not destroyed — it belongs to whoever asks next.
						onComplete: () => toolImg.setVisible(false),
					}),
			});
		}
		// Little squash on the player — you can see yourself grab it.
		//
		// A yoyo tween captures its START value at the moment it begins and returns
		// THERE, not to any absolute rest pose. Gathering fast enough to overlap two
		// of these meant the second one started while the player was still mid-squash,
		// captured that squashed scale as its "rest", and yoyo'd back to it. Every
		// overlapping pickup ratcheted the distortion a little further and nothing
		// ever put it back, so a burst of rapid pickups left the caretaker visibly
		// squashed for the rest of the session.
		//
		// Killing the in-flight one and restoring the exact base scale first means
		// every squash starts from the same pose, and the final onComplete restores
		// it exactly rather than trusting float math. This is the only tween in the
		// scene that targets the player (checked), so killTweensOf is safe here — if
		// that ever stops being true, hold a reference to this tween instead.
		this.tweens.killTweensOf(this.player);
		this.player.setScale(INV_TEX_SCALE);
		this.tweens.add({
			targets: this.player,
			scaleX: 1.12 * INV_TEX_SCALE,
			scaleY: 0.9 * INV_TEX_SCALE,
			duration: 110,
			yoyo: true,
			onComplete: () => this.player.setScale(INV_TEX_SCALE),
		});

		for (let i = 0; i < Math.min(p.qty, 3); i++) {
			const item = this.fxSprite(sx, sy, texKey)
				.setDepth(6400)
				.setScale(0.55 * INV_TEX_SCALE);
			this.tweens.add({
				targets: item,
				x: {
					value: () => this.player.x,
					duration: 430 + i * 90,
					ease: 'Sine.easeIn',
				},
				y: {
					value: () => this.player.y - 6,
					duration: 430 + i * 90,
					ease: 'Back.easeIn',
				},
				scale: 0.2 * INV_TEX_SCALE,
				alpha: { from: 1, to: 0.7 },
				delay: i * 70,
				onComplete: () => item.setVisible(false),
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
		// Same guard as playPickup — this is registered on the bridge right next to
		// it and torn down at the same moment.
		if (!this.alive || !(this.dynamic as any)?.scene) return;
		const x = p.x * TILE + 16;
		const y = p.y * TILE + 16;
		const toolKey = p.action === 'water' ? 'tool-watering-can' : 'tool-shovel';
		const toolImg = this.fxSprite(x + 10, y - 12, toolKey)
			.setDepth(6500)
			.setAngle(-25);
		this.tweens.add({
			targets: toolImg,
			angle: 30,
			duration: 240,
			yoyo: true,
			// Parked, not destroyed — it belongs to whoever asks next.
			onComplete: () => toolImg.setVisible(false),
		});
		const color = p.action === 'water' ? 0x8fd0e8 : 0x8a6a48;
		for (let i = 0; i < 6; i++) {
			const speck = this.fxSpeck(x, y, color).setDepth(6450);
			this.tweens.add({
				targets: speck,
				x: x + (Math.random() - 0.5) * 36,
				y: y - 6 - Math.random() * 18,
				alpha: 0,
				duration: 380 + Math.random() * 200,
				ease: 'Sine.easeOut',
				onComplete: () => speck.setVisible(false),
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
		this.tweens.add({
			targets: tarp,
			alpha: { from: 0, to: 0.9 },
			duration: 250,
		});
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
		this.tweens.add({
			targets: dim,
			alpha: 0.6,
			duration: 600,
			ease: 'Sine.easeIn',
		});
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
			this.tweens.add({
				targets: dim,
				alpha: 0,
				duration: 700,
				ease: 'Sine.easeOut',
				onComplete: () => dim.destroy(),
			});
			this.time.delayedCall(700, () => {
				this.sleeping = false;
			});
		});
	}

	/** One slot of the float-text ring, built on first use. */
	/**
	 * A pooled one-shot sprite for gather effects.
	 *
	 * Every pickup used to build a tool image plus up to three item images with
	 * this.add.image() and destroy them ~600ms later. Each one is an allocation, a
	 * display-list insert, and then a removal — so gathering fast enough to overlap
	 * several pickups churned GameObjects continuously, which is what made a rapid
	 * burst stutter. Same ring the float labels use.
	 *
	 * A recycled slot still carries whatever the last effect left on it, and the
	 * two callers between them set texture, position, depth, scale, angle and
	 * alpha — so everything except depth (which both call sites always set) is
	 * reset here. Miss one and an item sprite inherits the tool's -30° tilt.
	 */
	private fxSprite(x: number, y: number, key: string): Phaser.GameObjects.Image {
		const slot = this.fxNext;
		this.fxNext = (this.fxNext + 1) % WorldScene.FX_POOL;
		let img = this.fxSprites[slot];
		// destroy() nulls `.scene`, so a sprite left behind by the scene this instance
		// used to be (scene.restart() reuses the instance) is rebuilt, never reused.
		if (!img || !img.scene) {
			img = this.add.image(0, 0, key);
			this.fxSprites[slot] = img;
		}
		// Wrapping the ring mid-flight cuts the oldest effect short rather than
		// leaving two tweens fighting over one sprite.
		this.tweens.killTweensOf(img);
		return img.setTexture(key).setPosition(x, y).setScale(INV_TEX_SCALE).setAngle(0).setAlpha(1).setVisible(true);
	}

	/**
	 * A pooled dirt/water speck for the terraform effect.
	 *
	 * Digging threw six fresh Arcs per click and destroyed them a third of a second
	 * later, so holding the shovel down churned GameObjects exactly the way rapid
	 * gathering did before fxSprite().
	 *
	 * The colour is per-action (brown for digging, blue for watering) so it has to
	 * be re-applied on every acquire, and the tween drives the object's alpha to 0
	 * while the FILL alpha stays 0.9 — both need resetting or a recycled speck
	 * comes back invisible.
	 */
	private fxSpeck(x: number, y: number, color: number): Phaser.GameObjects.Arc {
		const slot = this.speckNext;
		this.speckNext = (this.speckNext + 1) % WorldScene.SPECK_POOL;
		let arc = this.fxSpecks[slot];
		// destroy() nulls `.scene`, so anything left behind by the scene this instance
		// used to be (scene.restart() reuses the instance) is rebuilt, never reused.
		if (!arc || !arc.scene) {
			arc = this.add.circle(0, 0, 2.4, color, 0.9);
			this.fxSpecks[slot] = arc;
		}
		this.tweens.killTweensOf(arc);
		return arc.setPosition(x, y).setFillStyle(color, 0.9).setAlpha(1).setVisible(true);
	}

	private floatLabel(slot: number): Phaser.GameObjects.Text {
		const existing = this.floatLabels[slot];
		// destroy() nulls `.scene`, so a label left behind by the scene this instance
		// used to be (scene.restart() reuses the instance) is rebuilt, never reused.
		if (existing && existing.scene) return existing;
		const label = this.add
			.text(0, 0, '', {
				fontFamily: 'Quicksand, sans-serif',
				fontSize: '13px',
				color: '#ffffff',
				fontStyle: 'bold',
				stroke: '#2b3321',
				strokeThickness: 3,
			})
			.setOrigin(0.5)
			.setDepth(7000)
			.setVisible(false);
		this.floatLabels[slot] = label;
		return label;
	}

	/**
	 * A little label that rises and fades — "+2 fiber", "tap tap", a sleeper's z.
	 *
	 * POOLED, because Text is far and away the most expensive thing Phaser can
	 * make: every one allocates its own canvas and 2D context, lays the string out,
	 * and uploads a fresh texture to the GPU. This fires on every pickup, every
	 * terraform, once every ~800ms for the length of a build and every 620ms while
	 * asleep — so create-then-destroy-1.1s-later meant a canvas and a texture upload
	 * several times a second during perfectly ordinary play, with the garbage to
	 * match.
	 *
	 * A ring of FLOAT_POOL labels is comfortably more than can ever be in flight at
	 * once (each lives 1.1s and nothing emits them faster than a couple a second),
	 * so by the time the ring comes back around a slot is long since parked. If
	 * something ever did outpace it, killing the old tween first means the oldest
	 * label is simply cut short rather than left with two tweens fighting over it.
	 */
	private floatText(x: number, y: number, text: string, color: string) {
		const slot = this.floatNext;
		this.floatNext = (this.floatNext + 1) % WorldScene.FLOAT_POOL;
		const label = this.floatLabel(slot);
		this.tweens.killTweensOf(label);
		label.setText(text).setColor(color).setPosition(x, y).setAlpha(1).setVisible(true);
		this.tweens.add({
			targets: label,
			y: y - 26,
			alpha: 0,
			duration: 1100,
			ease: 'Sine.easeOut',
			// Parked, not destroyed — it belongs to whoever asks next.
			onComplete: () => label.setVisible(false),
		});
	}

	/**
	 * Placements, diffed like terrain and nodes.
	 *
	 * This is the one that players felt most: every gather, dig, place and weather
	 * tick destroyed and rebuilt every item in the biome — sprite, shadow, hit
	 * area, pointer handler, and for harvest-ready plants an infinite tween — to
	 * end up drawing the same thing. The more you had built, the more each action
	 * cost, which is why it degraded over a session on hardware that should never
	 * have struggled.
	 */
	private drawPlacements() {
		const s = bridge.shared.state;
		if (!s) return;
		const want = new Map<string, any>();
		for (const p of s.placements) {
			if (p.area !== this.area) continue;
			if (!this.objectDef(p.objectId)) continue;
			want.set(p.id, p);
		}
		// Gone, or changed in a way its sprites baked in: drop the old build.
		for (const [id, entry] of [...this.placementSprites]) {
			const p = want.get(id);
			if (p && this.placementKey(p) === entry.key) continue;
			this.destroyPlacement(entry);
			this.placementSprites.delete(id);
		}
		for (const p of want.values()) {
			let entry = this.placementSprites.get(p.id);
			if (entry) {
				// Survived: only the clock-driven part needs touching.
				entry.applyScale();
			} else {
				entry = this.buildPlacement(p);
				this.placementSprites.set(p.id, entry);
			}
			// refreshDynamic emptied this.interactables, so survivors re-announce.
			for (const it of entry.its) this.interactables.push(it);
			if (entry.growth) this.noteGrowth(entry.growth.at, entry.growth.matures);
		}
	}

	/**
	 * Everything about a placement that its sprites bake in.
	 *
	 * Deliberately conservative: plantedAt and lastHarvestAt are in here even
	 * though they only reach the sprite indirectly, because the click handler
	 * closes over them — a stale closure would report the wrong harvest time to
	 * the placement menu. Anything not listed here must be re-derivable by
	 * applyScale(), or it does not belong outside the key.
	 */
	private placementKey(p: any): string {
		const def = this.objectDef(p.objectId);
		const growMs = (def?.growSeconds || 0) * 1000;
		const age = p.plantedAt ? Date.now() - p.plantedAt : Infinity;
		const growing = growMs > 0 && age < growMs;
		let ready = 0;
		if (def?.yield && p.plantedAt && !growing) {
			const at = harvestReadyAt(def, { plantedAt: p.plantedAt, lastHarvestAt: p.lastHarvestAt });
			ready = at != null && Date.now() >= at ? 1 : 0;
		}
		return [
			p.objectId,
			p.x,
			p.y,
			p.rotation || 0,
			p.color || '',
			p.plantedAt || 0,
			p.lastHarvestAt || 0,
			growing ? 1 : 0,
			ready,
		].join('|');
	}

	private destroyPlacement(entry: PlacementEntry) {
		for (const o of entry.objs) {
			this.tweens.killTweensOf(o);
			o.destroy();
		}
	}

	private buildPlacement(p: any): PlacementEntry {
		const def = this.objectDef(p.objectId)!;
		const objs: Phaser.GameObjects.GameObject[] = [];
		const its: Interactable[] = [];
		let growth: { at: number; matures: boolean } | undefined;
		let applyScale: () => void = () => undefined;
		/** Adopt an object into the placement layer AND the entry's teardown list. */
		const own = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
			this.placementLayer.add(o);
			objs.push(o);
			return o;
		};
		const x = p.x * TILE + 16;
		const y = p.y * TILE + 16;
		const tall = ['tree', 'deadwood', 'perch', 'platform', 'willow', 'oak', 'pine'].includes(def.shape || '');
		own(
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
		const img = own(this.img(x, y, stillGrowing ? 'sprout' : objKey).setDepth(y));
		// Recorded on the entry, not scheduled: armGrowthTimer() sets one timer for
		// the soonest across the whole field, and a surviving entry replays this
		// without being rebuilt.
		if (stillGrowing) growth = { at: p.plantedAt + growMs + 300, matures: true };

		// Harvest-ready plants get a soft golden glint above them; if one will
		// become ready later (regrowing after a harvest), nudge a repaint then so
		// the glint appears on its own.
		if (def.yield && p.plantedAt && !stillGrowing) {
			const readyAt = harvestReadyAt(def, {
				plantedAt: p.plantedAt,
				lastHarvestAt: (p as any).lastHarvestAt,
			});
			const now = Date.now();
			if (readyAt != null && now >= readyAt) {
				// A single small, dim star that twinkles occasionally above the plant —
				// staggered per-plant so a field of ready plants doesn't pulse in
				// unison (the old full glow on every plant read as a wall of light).
				this.ensureMoteTexture();
				const stagger = hashStr(p.id) % 1400;
				const mote = own(
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
				its.push({
					x,
					y,
					label: t('game.label.harvest', {
						name: content('habitatObject', p.objectId, 'name', def.name),
					}),
					action: () => bridge.emit('harvest-placement', { placementId: p.id }),
				});
			} else if (readyAt != null) {
				// Becoming harvestable only adds a glint — no habitat change, so no recalc.
				growth = { at: readyAt + 200, matures: false };
			}
		}

		// Camp fixtures stay crisp and identical; everything the player crafts
		// and places gets a little deterministic character seeded from its
		// placement id, so no two crafted items look exactly alike.
		const isFixture =
			def.isChest ||
			!!def.onePerArea ||
			['workbench', 'field-journal-stand', 'bed', 'home-bed', 'home-sleeping-bag'].includes(p.objectId);
		// Living habitat keeps growing for real hours after placement
		// (matureHours): young plants render smaller and ease up to full size
		// as they mature — so the preserve visibly grows between sessions.
		const matMs = (def.matureHours || 0) * 3_600_000;
		// player-chosen quarter-turn (see PlaceObject/MoveObject), radians
		const rot = Phaser.Math.DegToRad((p as any).rotation || 0);
		// Flip, lean and shade are drawn from a generator seeded by the placement
		// id, so they are decided ONCE, here. The draw ORDER matters — it is what
		// makes a given item look the same every session — so it is unchanged.
		let sizeJitter = 1;
		if (isFixture) {
			if (rot) img.setRotation(rot);
		} else {
			const vr = mulberry32(hashStr(p.id));
			img.setFlipX(vr() < 0.5);
			img.setRotation(rot + (vr() - 0.5) * 0.12); // chosen turn + a natural ±~3.5° lean
			sizeJitter = 0.9 + vr() * 0.2; // 0.9–1.1 size
			const shade = 0.82 + vr() * 0.18; // 0.82–1.0 brightness
			const v = Math.round(255 * shade);
			img.setTint((v << 16) | (v << 8) | v);
		}
		// The only thing that keeps changing once the sprite exists. Read from the
		// clock rather than the age captured at build time, so a survivor's growth
		// stays smooth across repaints instead of freezing at its build moment.
		applyScale = () => {
			const liveAge = p.plantedAt ? Date.now() - p.plantedAt : Infinity;
			const growScale = stillGrowing && growMs > 0 ? 1 + (Math.min(liveAge, growMs) / growMs) * 0.6 : 1;
			const placedAge = Date.now() - (p.placedAt || 0);
			const matureScale = matMs > 0 && !stillGrowing && p.placedAt ? 0.72 + 0.28 * Math.min(1, placedAge / matMs) : 1;
			img.setScale(growScale * matureScale * sizeJitter * INV_TEX_SCALE);
		};
		applyScale();
		// paint-tool recolor: a per-item color override wins over the default tint
		if (p.color) img.setTint(Phaser.Display.Color.HexStringToColor(p.color).color);

		// placed campfires glow like the base-camp fire: a warm, steady additive
		// halo (wide wash + bright core — indoors too, cozy in a tent). At night
		// the light mask also carves the dark away here.
		if (p.objectId === 'campfire') {
			const glow = own(
				this.img(x, y, 'glow')
					.setTint(0xffb84f)
					.setDepth(y - 1)
					.setScale(1.7 * INV_TEX_SCALE),
			) as Phaser.GameObjects.Image;
			glow.setBlendMode(Phaser.BlendModes.ADD);
			const core = own(
				this.img(x, y, 'glow')
					.setTint(0xffd98a)
					.setDepth(y + 2)
					.setAlpha(0.4)
					.setScale(0.55 * INV_TEX_SCALE),
			) as Phaser.GameObjects.Image;
			core.setBlendMode(Phaser.BlendModes.ADD);
		}

		img.setInteractive({ useHandCursor: true });
		// Beds render as fixtures (crisp, no random lean or tint) but do NOT claim
		// the click: sleeping is key-only, so a tap falls through to the normal
		// placement menu and you can move a bed like any other piece of furniture.
		const hasPrimaryAction = isFixture && !isSleepable(p.objectId);
		const defName = content('habitatObject', p.objectId, 'name', def.name);
		img.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
			if (bridge.shared.uiBlocking) return; // a modal is open — clicks don't reach the world
			if (this.placementObjectId || this.movingPlacementId) return;
			if (this.activeTool === 'paint' && this.isHome) return; // painting handled globally
			// shovel digs planted things back up — materials are refunded
			if (this.terraformAction() === 'dig' && def.plantable && p.plantedAt) {
				const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y);
				if (dist <= 155) bridge.emit('dig-up', { placementId: p.id, name: defName });
				else bridge.emit('toast', { text: t('game.toast.walkCloser'), kind: 'info' });
				return;
			}
			if (this.terraformAction()) return;
			if (pointer.event && (pointer.event as MouseEvent).shiftKey) {
				bridge.emit('remove-placement', {
					placementId: p.id,
					objectId: p.objectId,
					name: defName,
				});
				return;
			}
			if (!hasPrimaryAction) {
				const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y);
				if (dist <= 155)
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
				else
					bridge.emit('toast', {
						text: t('game.toast.walkCloser'),
						kind: 'info',
					});
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
				{ collect: its },
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
				{ collect: its },
			);
		} else if (p.objectId === 'workbench') {
			this.registerInteractable(
				{
					x,
					y,
					label: t('game.label.openCrafting'),
					action: () => bridge.emit('open-crafting'),
				},
				img,
				{ collect: its },
			);
		} else if (p.objectId === 'field-journal-stand') {
			this.registerInteractable(
				{
					x,
					y,
					label: t('game.label.readJournal'),
					// A stand out in the world opens the journal AT the biome you're
					// standing in. Reopening from the menu still resumes wherever you
					// last were, but walking up to a lectern in the wetland and being
					// shown the forest page is wrong — the stand is a thing in a place.
					// tentBiome covers a stand pitched inside a trail tent, whose area
					// id is `tent-<biome>` rather than a biome id.
					action: () => bridge.emit('open-journal', { area: this.tentBiome || this.area }),
				},
				img,
				{ collect: its },
			);
		} else if (isSleepable(p.objectId)) {
			// Sleep is deliberately KEY-ONLY. Clicking a bed falls through to the
			// placement menu below (move / rotate / pick up), which is what you
			// almost always mean when you click furniture.
			this.registerInteractable(
				{
					x,
					y,
					label: t('game.label.sleep'),
					action: () => this.sleepAt(x, y),
				},
				img,
				{ keyOnly: true, collect: its },
			);
		} else if (p.objectId === 'bed') {
			this.registerInteractable(
				{
					x,
					y,
					label: t('game.label.restMoment'),
					action: () =>
						bridge.emit('toast', {
							text: t('game.toast.quietBreath'),
							kind: 'info',
						}),
				},
				img,
				{ collect: its },
			);
		}
		return { key: this.placementKey(p), objs, its, applyScale, growth };
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
				// Hand the timer to the sprite so clearLayer can cancel it immediately.
				// The self-removal above only fires on the NEXT tick, so a rapid rebuild
				// could stack a fresh timer per animal before the old ones noticed.
				sh.setData('wxTimer', shadowTimer);
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
			// Hand the timer to the sprite so clearLayer can cancel it immediately —
			// the same hazard the shadow follower documents. The self-removal above
			// only fires on the NEXT tick, so rapid rebuilds (every gear toggle, every
			// comfort shift) stacked a fresh 60ms timer per unrecorded animal before
			// the old ones noticed they had nothing left to follow.
			glint.setData('wxTimer', follow);
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
		// Species flagged `aquatic` in the data stay over open water the way fish do,
		// so otters, beavers and crayfish stop strolling across dry land.
		const moveKind = (animal as any).aquatic === true ? 'aquatic' : animal.kind;
		// Seals, otters, turtles and seabirds work both sides of the tideline.
		const amphibious = (animal as any).amphibious === true;
		this.wander(img, img.x, img.y, moveKind, rng, ocean || amphibious, gait, amphibious);
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
		if (animal.kind === 'fish' || (animal as any).ocean === true || (animal as any).aquatic === true) return 'swim';
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
		return {
			x: c.x + (rng() - 0.5) * TILE * 0.6,
			y: c.y + (rng() - 0.5) * TILE * 0.6,
		};
	}

	private wander(
		img: Phaser.GameObjects.Image,
		homeX: number,
		homeY: number,
		kind: string,
		rng: () => number,
		ocean = false,
		gait: string = 'amble',
		amphibious = false,
	) {
		const roam = ocean ? 140 : kind === 'bird' || kind === 'insect' ? 130 : 80;
		const speed = ocean ? 22 : kind === 'insect' ? 26 : kind === 'bird' ? 42 : 18;
		const aquatic = kind === 'fish' || kind === 'aquatic';
		const flying = kind === 'bird' || kind === 'insect';
		const hop = () => {
			if (!img.active) return;
			const eastEdge = this.area === 'coastal' ? (this.landRight + 1.2) * TILE : this.worldW - TILE;
			let tx: number, ty: number;
			// An amphibious animal picks a side each time it moves, so it hauls out
			// onto the shore and slips back into the water over and over.
			const goSea = amphibious ? rng() < 0.55 : ocean;
			if (goSea) {
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
				// Depth only needs to change when the sprite crosses a pixel row, but
				// the raw write queued a re-sort of the whole display list on every
				// frame of every wander leg — which is why the scene was re-sorting
				// even while the player stood still.
				onUpdate: () => {
					const d = img.y | 0;
					if (img.depth !== d) img.setDepth(d);
				},
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
		// A queued enter-placement can arrive while the scene is torn down for a
		// restart (its display list is gone then) — building the ghost via this.add
		// would throw "Cannot read properties of null (reading 'add')".
		if (!this.alive || !this.scene.isActive()) return;
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
		if (!this.alive || !this.scene.isActive()) return; // same guard as enterPlacement (mid-restart safety)
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

	/** The object id currently being placed or moved, if any.
	 *
	 *  Read several times a frame while a ghost is up (the rotate check, and once
	 *  per canPlaceAt call), and the moving case scanned the whole placements array
	 *  for each of them. The answer only changes when placement mode changes or the
	 *  state is swapped, so key the memo on exactly those three things and let it
	 *  invalidate itself — no enter/exitPlacement bookkeeping to keep in sync. */
	private activeObjectId(): string | null {
		const placements = bridge.shared.state?.placements;
		if (
			this.activeIdMoving === this.movingPlacementId &&
			this.activeIdPlacing === this.placementObjectId &&
			this.activeIdSrc === placements
		) {
			return this.activeIdCache;
		}
		this.activeIdMoving = this.movingPlacementId;
		this.activeIdPlacing = this.placementObjectId;
		this.activeIdSrc = placements;
		this.activeIdCache = this.movingPlacementId
			? (placements?.find((p) => p.id === this.movingPlacementId)?.objectId ?? null)
			: this.placementObjectId;
		return this.activeIdCache;
	}
	/** Whether the active place/move object can be rotated (paths, bridges, furniture…). */
	private activeRotatable(): boolean {
		const id = this.activeObjectId();
		return !!(id && this.objectDef(id)?.rotatable);
	}

	/**
	 * The placement standing on a tile of the CURRENT area, if any.
	 *
	 * canPlaceAt() runs up to three times a frame while something is on the cursor
	 * (the ghost, plus tileReachable for the terraform cursor) and every run walked
	 * the entire placements array looking for the tile — a list that only grows as
	 * the preserve is built out, which is exactly when the frame budget is
	 * tightest. It is the same shape of cost drawPlacements() was already fixed
	 * for, one level down.
	 *
	 * Built like waterTiles/bridgeTiles (a flat map of `x,y` keys) but keyed by
	 * area as well, so walking between biomes doesn't invalidate it, and memoised
	 * against the identity of the placements array like firesHere(): a new state
	 * object means a rebuild, anything else is a hit. One entry per tile is the
	 * whole answer — the server never stacks two placements on the same tile.
	 */
	private placementAt(tx: number, ty: number): Placement | undefined {
		const placements = bridge.shared.state?.placements;
		if (!this.placementByTile || this.placementByTileSrc !== placements) {
			const map = new Map<string, Placement>();
			for (const p of placements || []) {
				const key = `${p.area}:${p.x},${p.y}`;
				if (!map.has(key)) map.set(key, p); // first wins, matching the old .some() scan order
			}
			this.placementByTile = map;
			this.placementByTileSrc = placements;
		}
		return this.placementByTile.get(`${this.area}:${tx},${ty}`);
	}

	private canPlaceAt(tx: number, ty: number, forTerraform = false, ignoreId?: string): boolean {
		// Indoors: you can only decorate on the floor (inside the walls).
		if (this.isIndoors) {
			const r = this.roomSpec();
			if (tx < r.x0 || tx > r.x1 || ty < r.y0 || ty > r.y1) return false;
			const onTile = this.placementAt(tx, ty);
			if (onTile && onTile.id !== ignoreId) return false;
			// items that need a bigger home can't be placed in a small one yet
			// (a trail tent always counts as the starter size — space 1)
			const activeId = this.activeObjectId();
			const homeMin = activeId ? this.objectDef(activeId)?.homeMin || 0 : 0;
			const space = this.tentBiome ? 1 : bridge.shared.state?.player?.home?.space || 1;
			if (homeMin > space) return false;
			// Outdoor-only things (the campfire) belong in neither the house nor a
			// trail tent. The indoor branch never checked `placement` at all, so the
			// ghost would read green over a tile the server was always going to
			// refuse. Mirrors the authoritative check in PlaceObject.
			if (activeId && this.objectDef(activeId)?.placement === 'outdoor') return false;
			// Beds stay clear of the doorway. Sleeping jumps the clock to dawn, so a
			// bed parked in the exit is a trap you have to walk over to leave. Mirrors
			// the authoritative check in server/resources.ts (blocksDoorway) so the
			// ghost reads red instead of the server rejecting the click.
			if (blocksDoorway(activeId, r, tx, ty)) return false;
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
		const occupant = this.placementAt(tx, ty);
		if (occupant && occupant.id !== ignoreId) return false;
		// note: resource nodes never block building — if you build on a regen spot,
		// the node relocates itself (see computeNodes)
		// water tiles only accept bridges (terraform clicks are exempt — the can/shovel work on water)
		if (!forTerraform && this.waterTiles.has(`${tx},${ty}`)) {
			const activeId = this.activeObjectId();
			return !!(activeId && this.objectDef(activeId)?.bridge);
		}
		return true;
	}

	// --------------------------------------------------------------- update

	update(_time: number, delta: number) {
		const dt = delta / 1000;
		this.frameTime = _time;
		this.positionWeatherEmitter();
		this.handleMovement(dt);
		const shadowY = this.player.y + 15;
		if (this.playerShadow.x !== this.player.x || this.playerShadow.y !== shadowY) {
			this.playerShadow.setPosition(this.player.x, shadowY);
		}
		this.handleGhost();
		this.handleInteraction();
		this.syncPosition(dt);
		this.positionSkyOverlay(); // keep the sunset glow hugging the top of the view
		this.updateNightLights(); // lamplight follows the player, fires burn bright after dark
	}

	/**
	 * Run the highlight ring's pulse only while the ring can actually be seen.
	 *
	 * `repeat: -1` means the tween never completes, so it sat in the manager
	 * interpolating a scale and an alpha every single frame for the whole session —
	 * including the common case, which is that nothing is in range and the
	 * highlight is hidden (the visibility toggle beside it was already fixed for
	 * the same reason). A paused tween costs nothing and keeps its position in the
	 * cycle, so the ring picks up mid-pulse when it reappears and reads exactly as
	 * it did before. Reduce-motion still wins: applyRingMotion() parks the ring at
	 * its resting scale in create() and this never resumes it.
	 */
	private syncRingPulse() {
		const pulse = this.ringPulse;
		if (!pulse) return;
		const run = !!this.highlight?.visible && !getPrefs().reduceMotion;
		if (run === !pulse.paused) return;
		if (run) pulse.resume();
		else pulse.pause();
	}

	private setWalkAudio(active: boolean) {
		if (this.walkAudioActive === active) return;
		this.walkAudioActive = active;
		bridge.emit('audio-walk', { active });
	}

	/** The compact interact key to show in-world — prefer a real key over the wide
	 *  word "Space", so the little hover badge never overflows. */
	private interactHintKey(): string {
		// Read every frame by the prompt builder. Bindings only change on rebind,
		// which already calls through rebindMoveKeys() — so cache and invalidate
		// there rather than re-deriving the label 60 times a second.
		if (!this.hintKeyCache) {
			const toks = getBindings().interact;
			this.hintKeyCache = keyLabel(toks.find((tk) => tk !== 'space') || toks[0] || 'e');
		}
		return this.hintKeyCache;
	}

	private rebindMoveKeys() {
		this.hintKeyCache = '';
		const kb = this.input.keyboard;
		if (!kb) return;
		// Never remove/destroy the fixed keys (arrows/Space/Esc/Shift) — Phaser keeps
		// one Key per code, so a rebind onto an arrow shares the scene's arrow key.
		const FIXED = new Set([16, 27, 32, 37, 38, 39, 40]);
		for (const arr of Object.values(this.moveKeys))
			for (const key of arr) if (!FIXED.has(key.keyCode)) kb.removeKey(key, true);
		const b = getBindings();
		const build = (tokens: string[]): Phaser.Input.Keyboard.Key[] =>
			tokens
				.map((tok) => keyCodeFor(tok))
				.filter((c): c is number => c != null)
				.map((c) => kb.addKey(c));
		this.moveKeys = {
			up: build(b.moveUp),
			down: build(b.moveDown),
			left: build(b.moveLeft),
			right: build(b.moveRight),
			interact: build(b.interact),
		};
		if (this.interactBadge && !this.isTouch) this.interactBadge.setText(this.interactHintKey());
	}

	private static anyKeyDown(arr: Phaser.Input.Keyboard.Key[]): boolean {
		for (let i = 0; i < arr.length; i++) if (arr[i].isDown) return true;
		return false;
	}

	private handleMovement(dt: number) {
		if (this.sleeping) {
			this.setWalkAudio(false);
			return;
		} // can't roam while asleep
		let vx = 0,
			vy = 0;
		const mk = this.moveKeys;
		// Was `arr.some(key => key.isDown)` — one outer closure plus four inner
		// callbacks allocated every frame, for a four-way check.
		const held = WorldScene.anyKeyDown;
		if (held(mk.left)) vx -= 1;
		if (held(mk.right)) vx += 1;
		if (held(mk.up)) vy -= 1;
		if (held(mk.down)) vy += 1;
		// virtual joystick (mobile)
		const joy = bridge.shared.joy;
		if (vx === 0 && vy === 0 && (Math.abs(joy.x) > 0.15 || Math.abs(joy.y) > 0.15)) {
			vx = joy.x;
			vy = joy.y;
		}
		if (vx === 0 && vy === 0) {
			this.setWalkAudio(false);
			// settle back upright when standing still. Snap to 0 once it is visually
			// upright — the old decay never reached zero, so it kept dirtying the
			// player transform on every frame the player stood still, forever.
			const rot = this.player.rotation;
			if (rot !== 0) this.player.setRotation(Math.abs(rot) < 1e-3 ? 0 : rot * 0.8);
			return;
		}
		this.walkT += dt * 11;
		this.player.setRotation(Math.sin(this.walkT) * 0.075); // cozy waddle
		const len = Math.hypot(vx, vy);
		// Hiking boots (when owned and switched on) give a gentle speed bump.
		const speed = this.hasBoots() ? 160 * 1.2 : 160;
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

		const moved = Phaser.Math.Distance.Between(this.player.x, this.player.y, nx, ny) > 0.1;
		this.player.setPosition(nx, ny);
		// Phaser's depth setter calls displayList.queueDepthSort() unconditionally —
		// it does not check whether the value actually changed. Guarding it keeps
		// the scene's ~10k-object display list from being re-sorted on frames where
		// nothing moved.
		const depth = ny + 16;
		if (this.player.depth !== depth) this.player.setDepth(depth);
		this.setWalkAudio(moved);
	}

	private handleGhost() {
		if (!this.ghost || (!this.placementObjectId && !this.movingPlacementId)) return;
		const pointer = this.input.activePointer;
		const tx = Math.floor(pointer.worldX / TILE);
		const ty = Math.floor(pointer.worldY / TILE);
		this.ghost.setPosition(tx * TILE + 16, ty * TILE + 16);
		const ok = this.canPlaceAt(tx, ty, false, this.movingPlacementId || undefined);
		// setTexture re-resolves the texture, the frame and the display origin. The
		// answer changes only when the pointer crosses between a legal and an
		// illegal tile, so compare the key first.
		const ghostImg = (this.ghost as any).frame as Phaser.GameObjects.Image;
		const ghostKey = ok ? 'ghost-ok' : 'ghost-bad';
		if (ghostImg.texture.key !== ghostKey) ghostImg.setTexture(ghostKey);
	}

	private nearestInteractable(): Interactable | null {
		let best: Interactable | null = null;
		// generous reach so E grabs what you're clearly standing near (was 68)
		let bestD2 = 90 * 90;
		const px = this.player.x;
		const py = this.player.y;
		// Distance first, availability second. available() hits the node-state map,
		// and ~95% of interactables are out of reach on any given frame, so testing
		// it first meant paying for every node in the area 60 times a second.
		// Squared distance also drops a Math.sqrt per interactable per frame.
		for (const it of this.interactables) {
			const dx = px - it.x;
			const dy = py - it.y;
			const d2 = dx * dx + dy * dy;
			if (d2 >= bestD2) continue;
			if (it.available && !it.available()) continue;
			best = it;
			bestD2 = d2;
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
		const hovered = this.hoveredIt && this.hoveredIt.available && !this.hoveredIt.available() ? null : this.hoveredIt;
		const focus = near || (busy || terraforming ? null : hovered);
		const focusSource: 'near' | 'hover' | null = near ? 'near' : focus ? 'hover' : null;

		// Fire exactly once when the ring lands on a new target (or clears), so
		// callers can react (for example: contextual UI) without getting spammed
		// every frame. The hover SFX is reserved for true "in range" focus only.
		// Was a template literal rebuilt every frame purely to detect change. Same
		// comparison, four scalar reads, no allocation.
		const fx = focus ? focus.x : Infinity;
		const fy = focus ? focus.y : Infinity;
		const flabel = focus ? focus.label : null;
		if (
			fx !== this.lastFocusX ||
			fy !== this.lastFocusY ||
			flabel !== this.lastFocusLabel ||
			focusSource !== this.lastFocusSource
		) {
			this.lastFocusX = fx;
			this.lastFocusY = fy;
			this.lastFocusLabel = flabel;
			this.lastFocusSource = focusSource;
			if (focus && focusSource) {
				bridge.emit('interactable-hover', {
					x: focus.x,
					y: focus.y,
					label: focus.label,
					source: focusSource,
				});
				if (focusSource === 'near') bridge.emit('audio-sfx', { id: 'hover' });
			} else {
				bridge.emit('interactable-hover-clear');
			}
		}

		// Walked up to a locked gate → post what's still needed to the corner feed,
		// but only when the remaining list actually CHANGES (not on every approach),
		// so repeatedly walking up to the same gate doesn't spam the feed.
		// liveLabel() rebuilds the whole "what you still need" sentence — several
		// linear scans over biomes/habitat objects plus a handful of i18n
		// interpolations — and the result is byte-identical almost every frame.
		// A requirements line does not need to be recomputed at 60Hz.
		if (near?.liveLabel && this.frameTime - this.lastGateCheckAt >= 250) {
			this.lastGateCheckAt = this.frameTime;
			const info = near.liveLabel();
			if (info !== this.lastGateInfo) {
				this.lastGateInfo = info;
				bridge.emit('gate-info', { text: info });
			}
		}

		// pulsing highlight on whatever you can interact with right now
		if (focus && getPrefs().interactHint !== false) {
			if (!this.highlight.visible) {
				this.highlight.setVisible(true);
				this.syncRingPulse(); // the pulse only ticks while the ring is on screen
			}
			this.highlight.setPosition(focus.x, focus.y + 2);
		} else if (this.highlight.visible) {
			// The common case is "nothing in range", which used to re-assert
			// visible=false on every single frame for the whole session.
			this.highlight.setVisible(false);
			this.syncRingPulse();
		}

		// terraform tile cursor under the pointer
		if (terraforming) {
			const pointer = this.input.activePointer;
			const tx = Math.floor(pointer.worldX / TILE);
			const ty = Math.floor(pointer.worldY / TILE);
			const ok = this.tileReachable(tx, ty);
			if (!this.tileCursor.visible) this.tileCursor.setVisible(true);
			this.tileCursor.setPosition(tx * TILE + 16, ty * TILE + 16);
			const cursorKey = ok ? 'ghost-ok' : 'ghost-bad';
			if (this.tileCursor.texture.key !== cursorKey) this.tileCursor.setTexture(cursorKey);
		} else if (this.tileCursor.visible) {
			this.tileCursor.setVisible(false);
		}

		const verb = this.isTouch ? t('game.prompt.tap') : this.interactHintKey();
		const clickVerb = this.isTouch ? t('game.prompt.tap') : t('game.prompt.click');
		const rotHint = !this.isTouch && this.activeRotatable() ? t('game.prompt.rotateHint') : '';
		// A locked gate's detailed "what's still needed" text goes to the corner feed
		// (see gate-info below), not this narrow bar — here it just shows its short
		// "read the trail sign" label like any other interactable.
		const nearMain = near ? t('game.prompt.near', { verb, label: near.label }) : '';
		// Selecting the shovel or watering can used to prepend an explanation of the
		// tool ("Shovel — click ground to dig a bed…"). The toolbelt already names the
		// selected tool and its tooltip explains it, so the bar restated it on every
		// frame the tool was held — and pushed the actual interaction prompt to the far
		// end of a long line. This bar is only for what the interact key will do.
		const prompt = this.movingPlacementId
			? t('game.prompt.moveTile', { verb: clickVerb }) + rotHint + (this.isTouch ? '' : t('game.prompt.escCancel'))
			: this.placementObjectId
				? t('game.prompt.placeTile', { verb: clickVerb }) +
					rotHint +
					(this.isTouch ? '' : t('game.prompt.escStopPlacing'))
				: nearMain;
		if (prompt !== this.lastPrompt) {
			this.lastPrompt = prompt;
			bridge.emit('prompt', prompt);
		}
		let interactPressed = false;
		for (const key of this.moveKeys.interact) {
			if (Phaser.Input.Keyboard.JustDown(key)) interactPressed = true;
		}
		if (near && interactPressed) {
			near.action();
		}
	}

	private syncPosition(dt: number) {
		this.moveAccum += dt;
		if (this.moveAccum < this.syncEverySec) return;
		this.moveAccum = 0;
		this.flushPosition();
	}

	/**
	 * Save the player's position now, if it has actually moved since the last save.
	 *
	 * Pulled out of syncPosition so the tab going away can force one. Without it,
	 * lengthening the web sync window would lose up to that many seconds of walking
	 * every time someone closed the tab mid-stride — with it, a clean close (tab
	 * closed, navigated away, switched apps) lands the current position and the
	 * longer window only costs anything in a hard crash.
	 *
	 * The >0.5 tile guard stays: standing still must not generate saves, which is
	 * what makes it safe to call this on every hide.
	 */
	private flushPosition() {
		const tx = this.player.x / TILE;
		const ty = this.player.y / TILE;
		if (Math.abs(tx - this.lastSynced.x) > 0.5 || Math.abs(ty - this.lastSynced.y) > 0.5) {
			this.lastSynced = { x: tx, y: ty };
			bridge.emit('player-moved', { x: tx, y: ty });
		}
	}
}
