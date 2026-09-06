import { describe, it, expect, beforeEach } from 'vitest';
import { makeWorld, appearance, type Db } from './harness';

// The late home upgrades (levels 5-7) each switch on a named ABILITY — one
// sentence of new behaviour rather than a bigger number. Three of the nine live
// on the server, and this file is where they are held to what the menu promises:
//
//   Packed Well   (Comfort 5)  bulk earth and stone stop filling the basket twice
//   Standing Order(Comfort 6)  a full basket spills into your own chests, anywhere
//   Fine Fittings (Furnishings 5) home furnishings cost a quarter less
//
// Like home-perks.test.ts, this imports the TS SOURCE rather than the built
// bundle, so the rules are covered before `npm run build:server` has run.

const holder: { db: Db } = { db: makeWorld() };
let endpoints: Record<string, any> | null = null;

async function loadTsServer(): Promise<Record<string, any>> {
	if (endpoints) return endpoints;
	const g = globalThis as any;
	g.Resource = class {
		_id: any;
		constructor(id?: any) {
			this._id = id;
		}
		getId() {
			return this._id;
		}
	};
	g.databases = {
		get wildwillows() {
			return holder.db;
		},
	};
	endpoints = (await import('../../server/resources')) as Record<string, any>;
	return endpoints;
}

let mod: Record<string, any>;
const post = (cls: string, body: any) => new (mod as any)[cls]().post(body);
let pid: string;

/** A built house at the given track levels, with a basket full of `inventory`. */
async function givenHouse(
	levels: Partial<Record<'space' | 'comfort' | 'decor' | 'light', number>> = {},
	inventory: Record<string, number> = {},
) {
	await holder.db.Player.patch(pid, {
		home: { style: 'cabin', space: 2, comfort: 1, decor: 1, light: 1, styleLocked: true, ...levels },
		inventory,
		devUnlockAll: true,
	});
}

beforeEach(async () => {
	mod = await loadTsServer();
	holder.db = makeWorld();
	pid = (await post('CreatePlayer', { name: 'Homey', passcode: '1234', appearance })).playerId;
});

// `stones` carry weight 2 in data/resources.json — the whole point of Packed Well.
const HEAVY = 'stones';

describe('Packed Well — bulk earth and stone ride light (Comfort 5)', () => {
	/** How many of `id` would still fit in the basket right now. */
	const roomLeft = async (id: string) => {
		const { roomFor } = await import('../../server/biome');
		const { defs } = await import('../../server/worlds');
		const player = await holder.db.Player.get(pid);
		return roomFor(id, player.inventory, await defs(), player);
	};

	it('lets a basket hold twice as much rock as it did', async () => {
		await givenHouse({ comfort: 4 }, { [HEAVY]: 10 });
		const before = await roomLeft(HEAVY);
		await givenHouse({ comfort: 5 }, { [HEAVY]: 10 });
		const after = await roomLeft(HEAVY);
		// The same house, the same pile, one level apart: the rock in the basket
		// stopped weighing double AND each further stone costs half what it did,
		// so there is markedly more room than there was.
		expect(after).toBeGreaterThan(before * 1.9);
	});

	it('leaves a handful of seeds exactly as light as it always was', async () => {
		const light = 'seeds';
		await givenHouse({ comfort: 4 }, { [light]: 10 });
		const before = await roomLeft(light);
		await givenHouse({ comfort: 5 }, { [light]: 10 });
		// same carry bonus removed from the comparison by reading the capacity
		// difference out of the level table rather than assuming it
		const { HOME_TRACKS } = await import('../../server/home');
		const gained = HOME_TRACKS.comfort.levels[4].carry - HOME_TRACKS.comfort.levels[3].carry;
		expect(await roomLeft(light)).toBe(before + gained);
	});

	it('is not granted before the level that sells it', async () => {
		const { homeHas } = await import('../../server/home');
		await givenHouse({ comfort: 4 });
		expect(homeHas(await holder.db.Player.get(pid), 'lightLoad')).toBe(false);
		await givenHouse({ comfort: 5 });
		expect(homeHas(await holder.db.Player.get(pid), 'lightLoad')).toBe(true);
	});
});

describe('Fine Fittings — the house makes its own trim (Furnishings 5)', () => {
	/** A craftable home furnishing and its listed price. */
	const fittingRecipe = () => {
		const recipes: any[] = [...holder.db.Recipe._rows.values()];
		return recipes.find((r) => r.category === 'home' && Object.values(r.materials || {}).some((q: any) => q >= 4));
	};

	it('charges a quarter less for a home furnishing', async () => {
		const recipe = fittingRecipe()!;
		const listed = recipe.materials as Record<string, number>;
		const discounted = Object.fromEntries(
			Object.entries(listed).map(([id, q]) => [id, Math.max(1, Math.floor(q * 0.75))]),
		);
		// Stock EXACTLY the discounted price: if the endpoint charged the listed
		// one it would refuse for want of materials, which is the sharpest possible
		// version of this assertion.
		await givenHouse({ decor: 5 }, { ...discounted });
		const r = await post('CraftItem', { playerId: pid, recipeId: recipe.id });
		expect(r.ok).toBe(true);
		const after = (await holder.db.Player.get(pid)).inventory || {};
		for (const id of Object.keys(discounted)) expect(after[id] || 0).toBe(0);
	});

	it('charges the listed price without it', async () => {
		const recipe = fittingRecipe()!;
		const listed = recipe.materials as Record<string, number>;
		const discounted = Object.fromEntries(
			Object.entries(listed).map(([id, q]) => [id, Math.max(1, Math.floor(q * 0.75))]),
		);
		await givenHouse({ decor: 4 }, { ...discounted });
		await expect(post('CraftItem', { playerId: pid, recipeId: recipe.id })).rejects.toThrow();
	});

	it('leaves anything that is not a furnishing at full price', async () => {
		const recipes: any[] = [...holder.db.Recipe._rows.values()];
		const other = recipes.find(
			(r) => r.category === 'habitat' && Object.values(r.materials || {}).some((q: any) => q >= 4),
		);
		const cheap = Object.fromEntries(
			Object.entries(other.materials as Record<string, number>).map(([id, q]) => [
				id,
				Math.max(1, Math.floor(q * 0.75)),
			]),
		);
		await givenHouse({ decor: 7 }, { ...cheap });
		await expect(post('CraftItem', { playerId: pid, recipeId: other.id })).rejects.toThrow();
	});
});

describe('Standing Order — a basket that never turns you away (Comfort 6)', () => {
	const RES = 'seeds';
	/** The chest every caretaker starts with, standing in the meadow. */
	const meadowChest = async () => {
		const rows: any[] = [];
		for await (const c of holder.db.Chest.search()) rows.push(c);
		return rows.find((c) => c.area === 'meadow');
	};
	/** A chest indoors, which is what the ability reaches for. Chests are
	 *  world-keyed (`<worldId>:<area>:<tail>` — see WORLD_KEYED in server/keys.ts),
	 *  so a fixture with a made-up id is simply never found by byWorld. */
	const homeChestId = () => `${pid}:home:pl_home_chest`;
	const giveHomeChest = async () => {
		await holder.db.Chest.put({
			id: homeChestId(),
			worldId: pid,
			playerId: pid,
			area: 'home',
			x: 4,
			y: 4,
			capacity: 400,
			contents: {},
		});
		return homeChestId();
	};
	/** Fill the basket to the brim so every pick has to go somewhere else. */
	const fullBasket = { wildflowers: 1_000_000 };

	it('sends the spare home when there is nowhere out here to put it', async () => {
		const here = await meadowChest();
		await holder.db.Chest.patch(here.id, { contents: { wildflowers: here.capacity } }); // no room out here
		await giveHomeChest();
		await givenHouse({ comfort: 6 }, fullBasket);

		const r = await post('CollectResource', { playerId: pid, biomeId: 'meadow', nodeId: 'n1', resourceId: RES });
		expect(r.ok).toBe(true);
		expect(r.storedTo).toHaveProperty(homeChestId());
		expect((await holder.db.Chest.get(homeChestId())).contents[RES]).toBeGreaterThan(0);
	});

	it('still fills the chest you are standing beside first', async () => {
		const here = await meadowChest();
		await giveHomeChest();
		await givenHouse({ comfort: 6 }, fullBasket);

		const r = await post('CollectResource', { playerId: pid, biomeId: 'meadow', nodeId: 'n2', resourceId: RES });
		expect(Object.keys(r.storedTo)).toEqual([here.id]);
		expect((await holder.db.Chest.get(homeChestId())).contents[RES]).toBeUndefined();
	});

	it('turns a full basket away without it, exactly as it always did', async () => {
		const here = await meadowChest();
		await holder.db.Chest.patch(here.id, { contents: { wildflowers: here.capacity } });
		await giveHomeChest();
		await givenHouse({ comfort: 5 }, fullBasket);

		await expect(
			post('CollectResource', { playerId: pid, biomeId: 'meadow', nodeId: 'n3', resourceId: RES }),
		).rejects.toThrow();
	});
});

describe("Curator's Eye — an arranged room pays sooner (Furnishings 6)", () => {
	// The other two abilities in this file change what an ACTION costs or where a
	// crop goes. This one changes a NUMBER the save is carrying: the coziness
	// cache holds the RAW reading, and Curator's Eye is the one thing that alters
	// how the raw is computed rather than what a multiplier does to it. So buying
	// it has to rewrite the cache then and there — otherwise the meter on the HUD
	// (which recomputes from the placements it is holding) climbs immediately
	// while the carry, the perk and the rested speed the server hands out go on
	// quoting the old room until the player happens to move a chair.

	// Twelve different pieces covering eight of the nine comforts: a room that is
	// arranged rather than merely full, which is exactly what the ability is for.
	const ROOM = [
		'home-rug',
		'home-table',
		'home-bed',
		'home-armchair',
		'home-lamp',
		'home-potplant',
		'home-tideglass',
		'home-clayurn',
		'home-stool',
		'home-cushions',
		'home-bookshelf',
		'home-reedmat',
	];
	// Mirrors homeRoom(): the 8×6 interior of a Space-2 house, centred in 30×20.
	const X0 = Math.floor((30 - 8) / 2);
	const Y0 = Math.floor((20 - 6) / 2);

	/** A furnished house sitting one level below Curator's Eye. */
	const furnishedAtFive = async () => {
		await holder.db.Player.patch(pid, {
			home: { style: 'cabin', space: 2, comfort: 1, decor: 5, light: 1, styleLocked: true },
			craftedItems: Object.fromEntries(ROOM.map((id) => [id, 1])),
			devUnlockAll: true,
		});
		for (const [i, id] of ROOM.entries()) {
			const res = await post('PlaceObject', {
				playerId: pid,
				objectId: id,
				area: 'home',
				x: X0 + (i % 8),
				y: Y0 + Math.floor(i / 8),
			});
			expect(res.ok, id).toBe(true);
		}
	};

	/** Buy the next Furnishings level. Its own gates are not what this is about. */
	const buyFurnishings = async () => {
		for (const [key, row] of holder.db.BiomeState._rows) {
			holder.db.BiomeState._rows.set(key, { ...row, unlocked: true, health: 90 });
		}
		await holder.db.Player.patch(pid, {
			inventory: { 'quartz-crystal': 20, 'alpine-flowers': 20, 'juniper-berries': 20 },
		});
		return post('UpgradeHome', { playerId: pid, track: 'decor' });
	};

	/** What the room reads as from the placements themselves — the same recompute
	 *  the HUD's meter does, so it is what the player is being shown. */
	const asShown = async (boost = 0) => {
		const { readCoziness } = await import('../../server/cozy');
		const { homeCozyOpts } = await import('../../server/home');
		const { defs } = await import('../../server/worlds');
		const d = await defs();
		const player = await holder.db.Player.get(pid);
		const rows = [...holder.db.Placement._rows.values()].filter((p: any) => p.area === 'home');
		return readCoziness(rows, (id: string) => d.object.get(id), boost, homeCozyOpts(player));
	};

	/** The buffs the server is actually handing out, cache and all. */
	const asServed = async () => {
		const { homeCozy } = await import('../../server/home');
		return homeCozy(await holder.db.Player.get(pid));
	};

	it('rewrites the cached reading the moment the ability is bought', async () => {
		await furnishedAtFive();
		const cachedBefore = (await holder.db.Player.get(pid)).homeCozy.score;
		await buyFurnishings();
		const cachedAfter = (await holder.db.Player.get(pid)).homeCozy.score;
		expect(cachedAfter).toBeGreaterThan(cachedBefore);
		expect(cachedAfter).toBe((await asShown()).score);
	});

	it('hands out the buff the meter is showing, without waiting for a chair to move', async () => {
		await furnishedAtFive();
		await buyFurnishings();
		const { homeCozyBoost } = await import('../../server/home');
		const shown = await asShown(homeCozyBoost(await holder.db.Player.get(pid)));
		const served = await asServed();
		expect(served.score).toBe(shown.score);
		expect(served.tierId).toBe(shown.tierId);
		expect(served.carry).toBe(shown.carry);
	});

	it('lifts this room a whole tier — the ability is worth what it costs', async () => {
		await furnishedAtFive();
		const before = await asServed();
		await buyFurnishings();
		const after = await asServed();
		expect(after.carry).toBeGreaterThan(before.carry);
	});

	it('leaves the cache exactly where the next place/remove would put it', async () => {
		await furnishedAtFive();
		await buyFurnishings();
		const afterUpgrade = (await holder.db.Player.get(pid)).homeCozy;
		// Moving furniture is the path that used to be the only fix. Putting one
		// more thing down and taking it away again must land on the same number.
		await holder.db.Player.patch(pid, { craftedItems: { 'home-stool': 1 } });
		const placed = await post('PlaceObject', {
			playerId: pid,
			objectId: 'home-stool',
			area: 'home',
			x: X0 + 5,
			y: Y0 + 1,
		});
		await post('RemoveObject', { playerId: pid, placementId: placed.placement?.id ?? placed.placementId });
		expect((await holder.db.Player.get(pid)).homeCozy).toEqual(afterUpgrade);
	});
});
