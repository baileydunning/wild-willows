// What you see through the Stargazing Telescope: the daytime sky by day —
// cloud types and the optical tricks light plays in them — and by night the
// whole northern sky, constellations through galaxies.
//
// Same shape as ui/stories.ts — pure display flavour, no server state, nothing
// saved, nothing unlocked. Walk up to a telescope, press the interact key, and
// sweep the eyepiece around with the arrow keys. The prose lives in the catalog
// (narrative.sky.*) and the pictures in ui/skyArt.tsx; this file is the catalog
// of what is up there, plus the rules that decide where each thing sits.
//
// THE LIVE SKY. What is overhead right now depends on the weather (clouds, and
// whether the stars are out at all) and on the season (everything at night),
// and that is what the near field shows: aim anywhere near the middle and you
// are looking at tonight's real sky. But nothing is ever locked away behind
// waiting for the right night — the rest of the catalog is out in the field
// around it, and the night sky WRAPS, so you can keep turning the telescope one
// way forever and come back round to where you started. A player who wants to
// read about the Perseids in February can go and find them; they just have to
// sweep for it, which is what a telescope is for.

import { t } from '../i18n';

export type SkyMode = 'day' | 'night';

/** What sort of thing this is — which decides how it is drawn (ui/skyArt.tsx),
 *  how close the crosshair has to be, and which catalog group its words are in. */
export type SkyKind = 'cloud' | 'optic' | 'figure' | 'deep' | 'body' | 'event';

/** Catalog group per kind: narrative.sky.<group>.<id>. */
const GROUP: Record<SkyKind, string> = {
	cloud: 'clouds',
	optic: 'optics',
	figure: 'figures',
	deep: 'deep',
	body: 'bodies',
	event: 'events',
};

/** The four altitude bands the cloud types sort into. */
export const CLOUD_LEVELS = ['high', 'mid', 'low', 'towering'] as const;
export type CloudLevel = (typeof CLOUD_LEVELS)[number];

export interface SkyDef {
	id: string;
	kind: SkyKind;
	/** Weather types this belongs to — what puts a cloud or an optical effect in
	 *  the near field. Something belonging to no current weather is still out
	 *  there to find. */
	weather?: string[];
	/** Seasons it stands out in, for everything on the night side. The four
	 *  circumpolar figures list every season, because at these latitudes they
	 *  never set; so do the moon and the satellites, which do not keep a calendar. */
	seasons?: string[];
	/** True for the figures that circle the pole all year — the panel says so. */
	circumpolar?: boolean;
	/** True for the thirteen the sun actually passes through: the twelve signs
	 *  plus Ophiuchus, which astrology leaves out. The panel adds the dates the
	 *  sun is really in it, which are not the dates on the horoscope — see the
	 *  note in the catalog about precession. */
	zodiac?: boolean;
	/** Where a cloud sits in the sky. Clouds only. */
	level?: CloudLevel;
}

/** Everything that does not care which season it is. */
const ALL = ['spring', 'summer', 'autumn', 'winter'];

/** Weather that puts a lid on the sky: on a night like this nothing is
 *  overhead, however clear the calendar says it should be. */
export const OVERCAST = new Set(['cloudy', 'rain', 'storm', 'snow', 'fog']);

/** The daytime sky: ten cloud types, one mountain special, and four of the
 *  things light does on the way through them. */
export const DAY_SKY: SkyDef[] = [
	{ id: 'cirrus', kind: 'cloud', level: 'high', weather: ['clear', 'cloudy', 'heat'], seasons: ALL },
	{
		id: 'cirrostratus',
		kind: 'cloud',
		level: 'high',
		weather: ['cloudy', 'snow'],
		seasons: ['autumn', 'winter', 'spring'],
	},
	{ id: 'cirrocumulus', kind: 'cloud', level: 'high', weather: ['clear', 'cloudy'], seasons: ALL },
	{
		id: 'altocumulus',
		kind: 'cloud',
		level: 'mid',
		weather: ['cloudy', 'heat', 'storm'],
		seasons: ['spring', 'summer', 'autumn'],
	},
	{ id: 'altostratus', kind: 'cloud', level: 'mid', weather: ['cloudy', 'rain', 'snow', 'storm'], seasons: ALL },
	{
		id: 'lenticular',
		kind: 'cloud',
		level: 'mid',
		weather: ['clear', 'snow'],
		seasons: ['autumn', 'winter', 'spring'],
	},
	{ id: 'stratus', kind: 'cloud', level: 'low', weather: ['fog', 'rain'], seasons: ALL },
	{ id: 'stratocumulus', kind: 'cloud', level: 'low', weather: ['cloudy', 'clear'], seasons: ALL },
	{ id: 'nimbostratus', kind: 'cloud', level: 'low', weather: ['rain', 'snow', 'storm'], seasons: ALL },
	{
		id: 'cumulus',
		kind: 'cloud',
		level: 'towering',
		weather: ['clear', 'heat'],
		seasons: ['spring', 'summer', 'autumn'],
	},
	{ id: 'cumulonimbus', kind: 'cloud', level: 'towering', weather: ['storm'], seasons: ['spring', 'summer', 'autumn'] },
	{ id: 'rainbow', kind: 'optic', weather: ['rain'], seasons: ['spring', 'summer', 'autumn'] },
	// Sun dogs need falling ice crystals between you and the sun: a cold-weather
	// sight, and one you should not be getting in July.
	{ id: 'sundogs', kind: 'optic', weather: ['snow', 'fog'], seasons: ['autumn', 'winter'] },
	{ id: 'crepuscular-rays', kind: 'optic', weather: ['cloudy', 'storm'], seasons: ALL },
	// Rain that evaporates before it lands wants hot dry air under the cloud.
	{ id: 'virga', kind: 'optic', weather: ['heat', 'clear'], seasons: ['spring', 'summer'] },
];

/** The night sky: sixteen constellations, ten things that are not stars at all,
 *  the moon and four planets, and four things that only happen sometimes. */
export const NIGHT_SKY: SkyDef[] = [
	// --- the figures ---------------------------------------------------------
	{ id: 'ursa-major', kind: 'figure', seasons: ALL, circumpolar: true },
	{ id: 'ursa-minor', kind: 'figure', seasons: ALL, circumpolar: true },
	{ id: 'cassiopeia', kind: 'figure', seasons: ALL, circumpolar: true },
	{ id: 'draco', kind: 'figure', seasons: ALL, circumpolar: true },
	{ id: 'bootes', kind: 'figure', seasons: ['spring', 'summer'] },
	{ id: 'cygnus', kind: 'figure', seasons: ['summer', 'autumn'] },
	{ id: 'lyra', kind: 'figure', seasons: ['summer'] },
	{ id: 'aquila', kind: 'figure', seasons: ['summer'] },
	{ id: 'pegasus', kind: 'figure', seasons: ['autumn'] },
	{ id: 'andromeda', kind: 'figure', seasons: ['autumn'] },
	{ id: 'orion', kind: 'figure', seasons: ['winter'] },
	{ id: 'canis-major', kind: 'figure', seasons: ['winter'] },
	// --- the band the sun walks through --------------------------------------
	// The twelve signs, in order round the ecliptic, plus the one astrology
	// leaves out. Every one of them is a real constellation first.
	{ id: 'aries', kind: 'figure', seasons: ['autumn', 'winter'], zodiac: true },
	{ id: 'taurus', kind: 'figure', seasons: ['winter'], zodiac: true },
	{ id: 'gemini', kind: 'figure', seasons: ['winter', 'spring'], zodiac: true },
	{ id: 'cancer', kind: 'figure', seasons: ['winter', 'spring'], zodiac: true },
	{ id: 'leo', kind: 'figure', seasons: ['spring'], zodiac: true },
	{ id: 'virgo', kind: 'figure', seasons: ['spring', 'summer'], zodiac: true },
	{ id: 'libra', kind: 'figure', seasons: ['summer'], zodiac: true },
	{ id: 'scorpius', kind: 'figure', seasons: ['summer'], zodiac: true },
	{ id: 'ophiuchus', kind: 'figure', seasons: ['summer'], zodiac: true },
	{ id: 'sagittarius', kind: 'figure', seasons: ['summer'], zodiac: true },
	{ id: 'capricornus', kind: 'figure', seasons: ['summer', 'autumn'], zodiac: true },
	{ id: 'aquarius', kind: 'figure', seasons: ['autumn'], zodiac: true },
	{ id: 'pisces', kind: 'figure', seasons: ['autumn'], zodiac: true },
	// --- things that are not stars -------------------------------------------
	{ id: 'milky-way', kind: 'deep', seasons: ['summer', 'autumn', 'winter'] },
	{ id: 'andromeda-galaxy', kind: 'deep', seasons: ['autumn', 'winter'] },
	{ id: 'orion-nebula', kind: 'deep', seasons: ['winter'] },
	{ id: 'pleiades', kind: 'deep', seasons: ['autumn', 'winter'] },
	{ id: 'hercules-cluster', kind: 'deep', seasons: ['spring', 'summer'] },
	{ id: 'ring-nebula', kind: 'deep', seasons: ['summer'] },
	{ id: 'lagoon-nebula', kind: 'deep', seasons: ['summer'] },
	{ id: 'double-cluster', kind: 'deep', seasons: ['autumn', 'winter'] },
	{ id: 'beehive', kind: 'deep', seasons: ['winter', 'spring'] },
	{ id: 'whirlpool-galaxy', kind: 'deep', seasons: ['spring', 'summer'] },
	// --- the moon and the planets --------------------------------------------
	{ id: 'moon', kind: 'body', seasons: ALL },
	{ id: 'jupiter', kind: 'body', seasons: ['autumn', 'winter'] },
	{ id: 'saturn', kind: 'body', seasons: ['summer', 'autumn'] },
	{ id: 'mars', kind: 'body', seasons: ['winter', 'spring'] },
	{ id: 'venus', kind: 'body', seasons: ['spring', 'summer'] },
	// --- and the things that only happen sometimes ---------------------------
	{ id: 'perseids', kind: 'event', seasons: ['summer'] },
	{ id: 'geminids', kind: 'event', seasons: ['winter'] },
	{ id: 'aurora', kind: 'event', seasons: ['autumn', 'winter'] },
	{ id: 'satellites', kind: 'event', seasons: ALL },
];

export const SKY: Record<SkyMode, SkyDef[]> = { day: DAY_SKY, night: NIGHT_SKY };

/** Just the clouds, in the order the sky stacks them — the altitude line under
 *  a cloud's paragraph reads its `level` off this. */
export const CLOUDS = DAY_SKY.filter((d) => d.kind === 'cloud');
/** Just the constellations — the "up all year / best in spring" line. */
export const CONSTELLATIONS = NIGHT_SKY.filter((d) => d.kind === 'figure');

export const DAY_IDS = DAY_SKY.map((d) => d.id);
export const NIGHT_IDS = NIGHT_SKY.map((d) => d.id);

export function skyDef(mode: SkyMode, id: string): SkyDef | undefined {
	return SKY[mode].find((d) => d.id === id);
}

/** One thing in the sky, with its words resolved in the language that is on. */
export interface SkySubject {
	id: string;
	mode: SkyMode;
	kind: SkyKind;
	/** What it is called — "Cumulonimbus", "Orion", "Saturn". */
	name: string;
	/** The small line under it: the plain name, or what sort of thing it is. */
	byline: string;
	/** The paragraph you get for aiming at it. */
	text: string;
	/** The one line of "and this is what it tells you" under the paragraph. */
	note: string;
	/** True when this is part of tonight's / today's actual sky. */
	overhead: boolean;
}

/** Everything about one thing in the sky, in the current language. */
export function subject(mode: SkyMode, id: string, overhead = false): SkySubject {
	const kind = skyDef(mode, id)?.kind || (mode === 'day' ? 'cloud' : 'figure');
	const key = `narrative.sky.${GROUP[kind]}.${id}`;
	return {
		id,
		mode,
		kind,
		name: t(`${key}.name`),
		byline: t(`${key}.byline`),
		text: t(`${key}.text`),
		note: t(`${key}.note`),
		overhead,
	};
}

// ------------------------------------------------------------------ the field

/** The sky you pan around in, in the eyepiece's own units.
 *
 *  Both skies WRAP horizontally: sweep one way long enough and you come back
 *  round to where you started, the way turning on the spot under a real sky
 *  does. `horizon` is the strip of land along the bottom — pan down and you
 *  reach the ground, which is what makes the view a place rather than a
 *  swatch of blue. */
export const FIELDS: Record<SkyMode, { w: number; h: number; sky: number; horizon: number; rows: number }> = {
	// Day: 7 columns of 320 (a cloud is 275 wide), four altitude bands.
	day: { w: 2240, h: 1700, sky: 1500, horizon: 200, rows: 4 },
	// Night: 8 columns of 320, five rows of sky above the treeline.
	night: { w: 3200, h: 1620, sky: 1400, horizon: 220, rows: 5 },
};

/** One step across the field — the width of a column in either sky. */
export const COLUMN = 320;

/** How much of it the eyepiece shows at once (a square, then masked to a disc). */
export const VIEW = 340;

/** Stable per-id jitter so a laid-out sky doesn't read as a grid. The same
 *  string in always gives the same offset out, so the field is identical every
 *  time you open the telescope under the same conditions. */
function hash(s: string): number {
	let h = 2166136261;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return (h >>> 0) / 4294967295;
}

/** Where one thing sits, in field units, with its subject already resolved. */
export interface Placed extends SkySubject {
	x: number;
	y: number;
}

/**
 * How high in the sky each daytime thing hangs, as a fraction of the sky band.
 *
 * THE VERTICAL AXIS IS ALTITUDE. Pan up from the treeline and you climb through
 * the sky the way the real one is stacked: stratus lying on the hills, the heap
 * clouds towering through the middle, cirrus in the ice at the top. It means the
 * picture teaches the same thing the words do, and it is why the day side is
 * laid out in bands rather than on the night side's plain grid.
 */
const DAY_BAND: Record<string, number> = {
	high: 0.18,
	mid: 0.41,
	towering: 0.63,
	low: 0.84,
};
/** The optical effects are not clouds and have their own heights: a rainbow
 *  stands on the ground, sun dogs ride the high ice, rays fall from mid-level
 *  gaps, and virga hangs below a shower that never lands. */
const OPTIC_BAND: Record<string, number> = {
	rainbow: 0.95,
	sundogs: 0.3,
	'crepuscular-rays': 0.52,
	virga: 0.74,
};

/** What is genuinely up right now: this season's night sky, or this weather's
 *  clouds. An overcast night has nothing overhead at all — which is true, and
 *  is why the panel says so rather than pretending. */
export function overheadNow(mode: SkyMode, opts: { weather?: string; season?: string }): Set<string> {
	const near = new Set<string>();
	if (mode === 'day') {
		// BOTH have to agree. A thunderhead belongs to a storm and to the warm half
		// of the year; sun dogs belong to snow and to the cold half. Asking only
		// what the weather is puts ice halos in a July sky, which is the sort of
		// wrong that a player who looks up notices.
		for (const d of DAY_SKY) {
			if (!opts.weather || !d.weather?.includes(opts.weather)) continue;
			if (opts.season && d.seasons && !d.seasons.includes(opts.season)) continue;
			near.add(d.id);
		}
	} else if (!opts.weather || !OVERCAST.has(opts.weather)) {
		for (const d of NIGHT_SKY) if (opts.season && d.seasons?.includes(opts.season)) near.add(d.id);
	}
	return near;
}

/** How far the top and bottom rows of the night sky sit from the ends of the
 *  band. Enough to clear the tallest thing drawn in one (the 240-unit box an
 *  aurora or a meteor shower is composed in) — and, at the top, enough that the
 *  eyepiece can be centred ON the top row rather than stopped just below it:
 *  the travel stops half a view from the edge, so anything within half a view of
 *  the top can be looked at but never aimed at. Same reason the highest band of
 *  the daytime sky starts well down from the top. */
const ROW_INSET = 260;

/** Column offsets outward from the middle: 0, +1, -1, +2, -2 … so whatever is
 *  overhead is dealt the seats nearest where the eyepiece opens. */
function outward(n: number): number {
	return n % 2 === 0 ? n / 2 : -(n + 1) / 2;
}

/**
 * Lay out one sky.
 *
 * What is actually overhead takes the middle of the field, in catalog order;
 * everything else is dealt outward from there, along the row or band it belongs
 * in. Deterministic: the same weather and season always give the same sky, so
 * closing the panel and opening it again does not shuffle the stars out from
 * under you.
 */
export function skyField(mode: SkyMode, opts: { weather?: string; season?: string }): Placed[] {
	const near = overheadNow(mode, opts);
	const defs = SKY[mode];
	const ordered = [...defs.filter((d) => near.has(d.id)), ...defs.filter((d) => !near.has(d.id))];
	const f = FIELDS[mode];
	const cx = f.w / 2;
	// How many of each band/row have been placed so far — each keeps its own
	// count, so a band fills outward from the middle independently of the others.
	const taken: Record<string, number> = {};
	return ordered.map((d, i) => {
		let y: number;
		let key: string;
		if (mode === 'day') {
			const band = d.kind === 'optic' ? (OPTIC_BAND[d.id] ?? 0.5) : (DAY_BAND[d.level || 'mid'] ?? 0.5);
			y = band * f.sky;
			// Clouds of the same TYPE of height share a lane; the optics each keep
			// their own, so a rainbow never has to queue behind a stratus deck.
			key = d.kind === 'optic' ? d.id : d.level || 'mid';
		} else {
			// Rows are inset from both ends of the sky band: the top one clears the
			// zenith and the bottom one clears the treeline, so nothing tall — an
			// aurora, a meteor shower — ends up half-buried in the hills.
			const row = i % f.rows;
			y = ROW_INSET + (row / (f.rows - 1)) * (f.sky - ROW_INSET * 2);
			key = `r${row}`;
		}
		const n = taken[key] || 0;
		taken[key] = n + 1;
		// Every other lane is shifted half a column, so the bands do not stack into
		// one vertical pile down the middle of the field — a real sky has cloud at
		// different heights beside each other, not directly on top of each other.
		const lane = Object.keys(taken).indexOf(key);
		const x = cx + (outward(n) + (lane % 2 ? 0.5 : 0)) * COLUMN;
		// An eighth of a column either way — enough to break the grid, never enough
		// to overlap the next seat over or to push the near set out of the view the
		// eyepiece opens on.
		const jx = (hash(`${d.id}:x`) - 0.5) * COLUMN * 0.25;
		const jy = (hash(`${d.id}:y`) - 0.5) * (f.sky / (mode === 'day' ? 6 : f.rows)) * 0.25;
		return {
			...subject(mode, d.id, near.has(d.id)),
			x: (((x + jx) % f.w) + f.w) % f.w,
			y: y + jy,
		};
	});
}

/** Horizontal distance from `from` to `to` in a field that wraps — the SHORT
 *  way round, and signed, so the same helper aims the crosshair and decides
 *  which copy of a thing to draw. */
export function wrapDx(from: number, to: number, mode: SkyMode): number {
	const w = FIELDS[mode].w;
	let d = to - from;
	while (d > w / 2) d -= w;
	while (d < -w / 2) d += w;
	return d;
}

/** Where the eyepiece can look: it turns all the way round, but it does not dig
 *  or fly — the bottom of the travel shows the treeline, the top the zenith. */
export function clampY(y: number, mode: SkyMode): number {
	const f = FIELDS[mode];
	return Math.max(VIEW / 2, Math.min(f.h - VIEW / 2, y));
}

/** The thirteen the sun passes through, in the order it walks them. */
export const ZODIAC = NIGHT_SKY.filter((d) => d.zodiac);

/** Which mode the telescope is in right now. Night is the sky; everything else,
 *  including the half-lit hours, is clouds — dawn and dusk are when the sky is
 *  most worth reading anyway. */
export function skyMode(dayPhase: string): SkyMode {
	return dayPhase === 'night' ? 'night' : 'day';
}
