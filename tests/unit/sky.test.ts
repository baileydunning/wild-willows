import { describe, it, expect } from 'vitest';
import { registerCatalog, setLocale, t } from '../../src/i18n/core';
import enNarrative from '../../src/i18n/en/narrative.json';
import esNarrative from '../../src/i18n/es/narrative.json';
import weatherData from '../../data/weather.json';
import habitatObjects from '../../data/habitat-objects.json';
import recipes from '../../data/recipes.json';
import biomes from '../../data/biomes.json';
import {
	CLOUDS,
	ZODIAC,
	CONSTELLATIONS,
	DAY_SKY,
	FIELDS,
	NIGHT_SKY,
	OVERCAST,
	VIEW,
	clampY,
	overheadNow,
	skyField,
	skyMode,
	wrapDx,
	subject,
} from '../../src/ui/sky';
import { AIM, BOX, PATTERNS } from '../../src/ui/skyArt';

// What the telescope shows: the daytime sky (cloud types and the optical
// effects) and the night sky (constellations, deep-sky objects, the moon and
// planets, and the occasional events) — listed in src/ui/sky.ts, worded in the
// catalog, drawn in src/ui/skyArt.tsx.
//
// Nothing at runtime complains when those drift apart. Something with no
// catalog entry shows its raw key; something with no picture is an invisible
// thing the crosshair can still lock onto; a weather type no cloud claims makes
// an empty middle of the field on that day. All of it quiet, in a panel reached
// by walking up to a piece of furniture — so it is checked here instead.

registerCatalog('en', { narrative: enNarrative });
registerCatalog('es', { narrative: esNarrative });
setLocale('en');

const WEATHER_TYPES = Object.keys((weatherData as any).types);
const SEASONS: string[] = (weatherData as any).seasons;
const tSun = (id: string) => t(`narrative.sky.figures.${id}.sun`);
const BIOMES: string[] = (biomes as any).records.filter((b: any) => b.explorable !== false).map((b: any) => b.id);

describe('the catalog', () => {
	it('holds a whole daytime sky and a whole night one, each id once', () => {
		expect(DAY_SKY.length).toBe(17); // 11 cloud types + 4 optical effects + the sun and the moon
		expect(NIGHT_SKY.length).toBe(44); // 25 figures + 10 deep sky + 5 bodies + 4 events
		// The whole zodiac, plus the thirteenth the horoscopes leave out.
		expect(ZODIAC).toHaveLength(13);
		for (const list of [DAY_SKY, NIGHT_SKY]) {
			const ids = list.map((d) => d.id);
			expect(new Set(ids).size).toBe(ids.length);
		}
	});

	it('says something in both languages about every one of them', () => {
		for (const locale of ['en', 'es']) {
			setLocale(locale);
			for (const [mode, list] of [
				['day', DAY_SKY],
				['night', NIGHT_SKY],
			] as const) {
				for (const d of list) {
					const s = subject(mode, d.id);
					for (const field of [s.name, s.byline, s.text, s.note]) {
						expect(field, `${locale} ${mode} ${d.id}`).toBeTruthy();
						expect(field, `${locale} ${mode} ${d.id}`).not.toMatch(/^narrative\./); // an unresolved key
					}
					expect(s.text.length, `${locale} ${d.id}`).toBeGreaterThan(80);
				}
			}
		}
		setLocale('en');
	});

	it('gives everything a picture and a reach for the crosshair', () => {
		for (const d of [...DAY_SKY, ...NIGHT_SKY]) {
			expect(BOX[d.kind], `no box for ${d.kind}`).toBeTruthy();
			expect(AIM[d.kind], `no aim reach for ${d.kind}`).toBeGreaterThan(0);
		}
		for (const c of CONSTELLATIONS) expect(PATTERNS[c.id], `no star pattern for ${c.id}`).toBeTruthy();
		expect(Object.keys(PATTERNS).sort()).toEqual(CONSTELLATIONS.map((c) => c.id).sort());
	});
});

describe('what is actually up there', () => {
	it('gives every weather type a sky of its own', () => {
		for (const wx of WEATHER_TYPES) {
			expect(overheadNow('day', { weather: wx }).size, `nothing overhead in ${wx}`).toBeGreaterThan(0);
		}
	});

	it('never leaves a real day with an empty sky, whatever the season rolls', () => {
		// Weather is drawn per biome per season from data/weather.json's climate
		// table, so these are the pairs the game can actually produce — and every
		// one of them has to put something overhead, or a player opens the
		// telescope on a blank field and the panel has nothing to say.
		const climate = (weatherData as any).climate as Record<string, Record<string, Record<string, number>>>;
		for (const per of Object.values(climate)) {
			for (const [season, weights] of Object.entries(per)) {
				for (const [wx, weight] of Object.entries(weights)) {
					if (!weight) continue;
					const up = overheadNow('day', { weather: wx, season });
					expect(up.size, `nothing overhead on a ${season} ${wx} day`).toBeGreaterThan(0);
				}
			}
		}
	});

	it('has the sun and the daytime moon in it, and hides the sun in the wet', () => {
		// Everything that comes into sight has to be a thing you can aim at and
		// read — the brightest of them most of all.
		expect(DAY_SKY.map((d) => d.id)).toContain('sun');
		expect(DAY_SKY.map((d) => d.id)).toContain('moon');
		expect([...overheadNow('day', { weather: 'clear', season: 'summer' })]).toContain('sun');
		// …and on a day with a lid on it, the sun is up there but not in sight.
		for (const wx of ['rain', 'storm', 'fog']) {
			expect([...overheadNow('day', { weather: wx, season: 'summer' })], wx).not.toContain('sun');
		}
	});

	it('keeps the cold-air sights out of a summer sky', () => {
		// Sun dogs need falling ice crystals; a July halo is the kind of wrong a
		// player who looks up notices.
		expect([...overheadNow('day', { weather: 'fog', season: 'summer' })]).not.toContain('sundogs');
		expect([...overheadNow('day', { weather: 'fog', season: 'winter' })]).toContain('sundogs');
		// …and the hot-air ones out of a winter one.
		expect([...overheadNow('day', { weather: 'clear', season: 'winter' })]).not.toContain('virga');
		expect([...overheadNow('day', { weather: 'storm', season: 'winter' })]).not.toContain('cumulonimbus');
	});

	it('gives every season a night of its own', () => {
		for (const season of SEASONS) {
			const up = overheadNow('night', { season, weather: 'clear' });
			expect(up.size, `nothing to see in ${season}`).toBeGreaterThanOrEqual(8);
			// …and not just the four that never set: every season has its own sights.
			const seasonal = [...up].filter((id) => !CONSTELLATIONS.find((c) => c.id === id)?.circumpolar);
			expect(seasonal.length, `${season} has nothing but circumpolar figures`).toBeGreaterThanOrEqual(4);
		}
	});

	it('puts a lid on an overcast night, and says so rather than pretending', () => {
		for (const wx of OVERCAST) {
			expect(overheadNow('night', { season: 'winter', weather: wx }).size, `${wx} still shows stars`).toBe(0);
		}
		expect(overheadNow('night', { season: 'winter', weather: 'clear' }).size).toBeGreaterThan(0);
	});

	it('only names weather types and seasons that exist', () => {
		for (const d of DAY_SKY) for (const w of d.weather || []) expect(WEATHER_TYPES).toContain(w);
		for (const d of NIGHT_SKY) for (const s of d.seasons || []) expect(SEASONS).toContain(s);
		for (const d of NIGHT_SKY) expect(d.seasons?.length, `${d.id} is up in no season at all`).toBeGreaterThan(0);
	});

	it('gives every sign of the zodiac its dates, and a real constellation to be', () => {
		for (const z of ZODIAC) {
			expect(PATTERNS[z.id], `${z.id} has no star pattern`).toBeTruthy();
			for (const locale of ['en', 'es']) {
				setLocale(locale);
				// The dates the sun is REALLY in it — the whole point of the line.
				const sun = tSun(z.id);
				expect(sun, `${locale} ${z.id} has no sun dates`).toBeTruthy();
				expect(sun).not.toMatch(/^narrative\./);
			}
			setLocale('en');
		}
		// The band the sun walks is a ring: every season has some of it up.
		for (const season of SEASONS) {
			const up = ZODIAC.filter((z) => z.seasons?.includes(season));
			expect(up.length, `no zodiac up in ${season}`).toBeGreaterThanOrEqual(2);
		}
	});

	it('marks the four circumpolar figures as up in every season', () => {
		for (const c of CONSTELLATIONS)
			if (c.circumpolar) expect([...(c.seasons || [])].sort()).toEqual([...SEASONS].sort());
		expect(CONSTELLATIONS.filter((c) => c.circumpolar)).toHaveLength(4);
	});
});

describe('the star patterns', () => {
	it('joins stars that exist, and never a star to itself', () => {
		for (const [id, pat] of Object.entries(PATTERNS)) {
			for (const [a, b] of pat.lines) {
				expect(pat.stars[a], `${id}: line from missing star ${a}`).toBeTruthy();
				expect(pat.stars[b], `${id}: line to missing star ${b}`).toBeTruthy();
				expect(a, `${id}: a star joined to itself`).not.toBe(b);
			}
			for (const m of pat.marks || []) expect(pat.stars[m], `${id}: mark on missing star ${m}`).toBeTruthy();
		}
	});

	it('keeps every star inside the 0–100 box it is drawn in', () => {
		for (const [id, pat] of Object.entries(PATTERNS)) {
			expect(pat.stars.length, `${id} has too few stars to read`).toBeGreaterThanOrEqual(5);
			for (const [x, y] of pat.stars) {
				for (const n of [x, y]) {
					expect(n, `${id}: star off the box`).toBeGreaterThanOrEqual(0);
					expect(n, `${id}: star off the box`).toBeLessThanOrEqual(100);
				}
			}
		}
	});

	it('leaves no figure a scatter of unconnected stars', () => {
		for (const [id, pat] of Object.entries(PATTERNS)) {
			const joined = new Set(pat.lines.flat());
			const loose = pat.stars.map((_, i) => i).filter((i) => !joined.has(i));
			// A loose star is deliberate (the Pleiades, M31) and must be MARKED as
			// the point of interest — otherwise it is a star nobody drew a line to.
			for (const i of loose) expect(pat.marks || [], `${id}: star ${i} is joined to nothing`).toContain(i);
		}
	});
});

describe('laying out a sky', () => {
	it('places everything, once, inside the field and above the treeline', () => {
		for (const [mode, list] of [
			['day', DAY_SKY],
			['night', NIGHT_SKY],
		] as const) {
			const f = FIELDS[mode];
			const field = skyField(mode, { weather: 'clear', season: 'winter' });
			expect(field.map((p) => p.id).sort()).toEqual(list.map((d) => d.id).sort());
			for (const p of field) {
				expect(p.x, `${p.id} off the field`).toBeGreaterThanOrEqual(0);
				expect(p.x, `${p.id} off the field`).toBeLessThan(f.w);
				expect(p.y, `${p.id} in the ground`).toBeGreaterThan(0);
				// A rainbow is the one thing that stands ON the ground — its arc springs
				// from the hills, so its box is allowed to reach them. Everything else
				// hangs clear of the treeline.
				const feet = p.id === 'rainbow' ? 0 : BOX[p.kind].h / 2;
				expect(p.y + feet, `${p.id} buried in the hills`).toBeLessThan(f.sky);
			}
		}
	});

	it('stacks the daytime sky by altitude — the picture teaching what the words do', () => {
		const field = skyField('day', { weather: 'clear' });
		const at = (id: string) => field.find((p) => p.id === id)!.y;
		// Small y is high in the sky: ice at the top, heaps through the middle,
		// the flat grey layers lying on the hills.
		expect(at('cirrus')).toBeLessThan(at('altocumulus'));
		expect(at('altocumulus')).toBeLessThan(at('stratus'));
		expect(at('sundogs')).toBeLessThan(at('rainbow'));
	});

	it('puts what is overhead in the middle and leaves the rest to be swept up', () => {
		const field = skyField('night', { season: 'winter', weather: 'clear' });
		const mid = (p: { x: number; y: number }) => Math.abs(wrapDx(FIELDS.night.w / 2, p.x, 'night'));
		const overhead = field.filter((p) => p.overhead);
		const rest = field.filter((p) => !p.overhead);
		expect(overhead.length).toBeGreaterThan(0);
		expect(rest.length).toBeGreaterThan(0);
		// Nothing is locked away: the far ones are still in the field, just further
		// round it, so a sweep reaches them.
		expect(Math.max(...overhead.map(mid))).toBeLessThan(Math.max(...rest.map(mid)));
	});

	it('is the same sky every time you open it under the same conditions', () => {
		const a = skyField('day', { weather: 'storm', season: 'summer' });
		const b = skyField('day', { weather: 'storm', season: 'summer' });
		expect(a.map((p) => [p.id, Math.round(p.x), Math.round(p.y)])).toEqual(
			b.map((p) => [p.id, Math.round(p.x), Math.round(p.y)]),
		);
	});

	it('always has something to aim at when the eyepiece opens', () => {
		// The view starts at the middle of the sky band; whatever is overhead has
		// to be within reach of it, or the telescope opens onto nothing.
		for (const weather of WEATHER_TYPES) {
			const near = skyField('day', { weather }).filter((p) => p.overhead);
			const from = { x: FIELDS.day.w / 2, y: FIELDS.day.sky / 2 };
			const closest = Math.min(...near.map((p) => Math.abs(wrapDx(from.x, p.x, 'day'))));
			expect(closest, `nothing in view in ${weather}`).toBeLessThan(VIEW / 2);
		}
		for (const season of SEASONS) {
			const near = skyField('night', { season, weather: 'clear' }).filter((p) => p.overhead);
			const closest = Math.min(...near.map((p) => Math.abs(wrapDx(FIELDS.night.w / 2, p.x, 'night'))));
			expect(closest, `nothing in view in ${season}`).toBeLessThan(VIEW / 2);
		}
	});

	it('is stars at night and clouds the rest of the time', () => {
		expect(skyMode('night')).toBe('night');
		for (const phase of ['dawn', 'day', 'dusk']) expect(skyMode(phase)).toBe('day');
	});
});

describe('sweeping it', () => {
	it('goes all the way round: the far edge of the field is the near edge', () => {
		for (const mode of ['day', 'night'] as const) {
			const w = FIELDS[mode].w;
			// A thing at x=10 is 20 units to the RIGHT of a view at w-10, not w-20
			// to the left of it.
			expect(wrapDx(w - 10, 10, mode)).toBe(20);
			expect(wrapDx(10, w - 10, mode)).toBe(-20);
			expect(Math.abs(wrapDx(0, w / 2, mode))).toBeLessThanOrEqual(w / 2);
		}
	});

	it('stops at the treeline and at the zenith', () => {
		for (const mode of ['day', 'night'] as const) {
			const f = FIELDS[mode];
			expect(clampY(-500, mode)).toBe(VIEW / 2);
			expect(clampY(f.h + 500, mode)).toBe(f.h - VIEW / 2);
			// …and the ground is inside that travel, so panning down reaches it.
			expect(f.h - VIEW / 2).toBeGreaterThan(f.sky);
		}
	});
});

describe('the telescope itself', () => {
	const def = () => (habitatObjects as any).records.find((o: any) => o.id === 'home-telescope');
	const recipe = () => (recipes as any).records.find((r: any) => r.id === 'home-telescope');

	it('can be set up indoors or out, in every biome', () => {
		expect(def()).toBeTruthy();
		expect(def().placement).toBe('both');
		// A biome list is what makes an outdoor placement legal at all, and this
		// one is meant to go up wherever you are — a ridge, a beach, the meadow.
		expect([...def().biomes].sort()).toEqual([...BIOMES].sort());
		// homeMin would gate the RECIPE (src/recipes.ts) as well as the placement,
		// which would keep a telescope you mean to carry up a ridge uncraftable
		// until the house was big enough to hold one.
		expect(def().homeMin).toBeUndefined();
	});

	it('unlocks early, in the starter biome, out of what grows there', () => {
		const r = recipe();
		expect(r.unlockBiome).toBe('meadow');
		// No achievement and no animal to wait for — a low health bar is the whole
		// gate, so the telescope is in reach in the first stretch of the game.
		expect(r.unlock.requiresAchievement).toBeUndefined();
		expect(r.unlock.requiresAnimal).toBeUndefined();
		expect(r.unlock.minHealth).toBeLessThanOrEqual(15);
		// Every material has to be gatherable in the biome the recipe unlocks in,
		// or "unlocked early" means "unlocked and uncraftable until the alpine".
		const meadow = (biomes as any).records.find((b: any) => b.id === 'meadow').resources;
		for (const mat of Object.keys(r.materials)) expect(meadow, `${mat} does not grow in the meadow`).toContain(mat);
	});
});
