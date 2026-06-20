// Narrative beats woven into the activity feed. As animals return, the *combination*
// of who's back triggers contextual lines ("three kinds of insect are back…", "with
// prey and predator both home the food web has closed its first loop"). Each beat
// fires exactly once — at the moment a return flips its condition from false to true —
// so it never repeats, and (because it's a before/after test on the returned set) it
// stays correct across reloads without any stored flags.

import type { GameData } from '../types';

interface Ctx {
	has: (animalId: string) => boolean;
	kindInBiome: (biome: string, kind: string) => number;
	countInBiome: (biome: string) => number;
	distinctKindsInBiome: (biome: string) => number;
	total: number;
}

interface Beat {
	id: string;
	icon: string;
	text: string;
	test: (c: Ctx) => boolean;
}

function buildCtx(ids: Set<string>, data: GameData): Ctx {
	const back = data.animals.filter((a) => ids.has(a.id));
	return {
		has: (id) => ids.has(id),
		kindInBiome: (biome, kind) => back.filter((a) => a.biome === biome && a.kind === kind).length,
		countInBiome: (biome) => back.filter((a) => a.biome === biome).length,
		distinctKindsInBiome: (biome) => new Set(back.filter((a) => a.biome === biome).map((a) => a.kind)).size,
		total: back.length,
	};
}

// Per-kind milestone templates. {biome} is filled with the biome name. A beat is
// only created for a (biome, kind) pair the biome can actually reach.
const KIND_BEATS: { kind: string; threshold: number; icon: string; text: (biome: string) => string }[] = [
	{ kind: 'insect', threshold: 3, icon: 'leaf', text: (b) => `The air over ${b} hums and ticks again — three kinds of insect have found their way back.` },
	{ kind: 'bird', threshold: 3, icon: 'paw', text: (b) => `Birdsong has returned to ${b}; three species now forage and nest there.` },
	{ kind: 'mammal', threshold: 3, icon: 'paw', text: (b) => `Trails wind through ${b} again — three kinds of mammal move through it now.` },
	{ kind: 'amphibian', threshold: 2, icon: 'drop', text: (b) => `Frogs and salamanders are back in ${b} — a sure sign its water and damp ground are healthy.` },
	{ kind: 'reptile', threshold: 2, icon: 'leaf', text: (b) => `Reptiles bask in ${b} once more, now that there's warmth and cover to find.` },
	{ kind: 'fish', threshold: 1, icon: 'drop', text: (b) => `The waters of ${b} hold fish again.` },
	{ kind: 'invertebrate', threshold: 3, icon: 'paw', text: (b) => `The tidepools and shallows of ${b} are crowded with small life again.` },
];

// Hand-authored combination beats — the satisfying *and educational* ecological
// moments, most of them predator + prey pairings that teach a real relationship.
const COMBO_BEATS: Beat[] = [
	{
		id: 'meadow-fox-prey',
		icon: 'paw',
		text: `Fox and prey are both back in Willow Meadow. Predators like foxes keep rodent and rabbit numbers in check — which stops overgrazing and actually keeps the meadow more diverse, not less.`,
		test: (c) => c.has('red-fox-meadow') && (c.has('cottontail-rabbit') || c.has('meadow-vole')),
	},
	{
		id: 'meadow-hawk-rodent',
		icon: 'paw',
		text: `A red-tailed hawk now hunts the meadow's rodents — nature's pest control. A single hawk can eat hundreds of mice and voles in a year.`,
		test: (c) => c.has('red-tailed-hawk') && (c.has('meadow-vole') || c.has('ground-squirrel')),
	},
	{
		id: 'forest-owl-prey',
		icon: 'paw',
		text: `The great horned owl hunts these woods after dark. Owls have offset ear openings that let them pinpoint a mouse in total blackness by sound alone.`,
		test: (c) => c.has('great-horned-owl') && (c.has('chipmunk') || c.has('tree-squirrel')),
	},
	{
		id: 'forest-bobcat-prey',
		icon: 'paw',
		text: `A bobcat stalks Old Hollow Forest again — an ambush hunter that needs dense cover to creep close, which is exactly the understory you rebuilt.`,
		test: (c) => c.has('bobcat') && (c.has('chipmunk') || c.has('tree-squirrel')),
	},
	{
		id: 'forest-cavity-reuse',
		icon: 'paw',
		text: `A woodpecker carved a cavity, used it once, and left it — and another animal has moved straight in. In a forest, one bird's old home is another's new one.`,
		test: (c) => c.has('pileated-woodpecker') && (c.has('wood-duck') || c.has('northern-flying-squirrel') || c.has('barred-owl')),
	},
	{
		id: 'wetland-beaver',
		icon: 'drop',
		text: `The beaver is back — an ecosystem engineer. Its dams raise the water table and flood new ponds, building habitat that fish, frogs, and birds all depend on.`,
		test: (c) => c.has('beaver'),
	},
	{
		id: 'wetland-beaver-wake',
		icon: 'paw',
		text: `Otters and herons have followed the beaver in. They hunt the deep, still water its dams create — habitat that simply wouldn't exist without it.`,
		test: (c) => c.has('beaver') && (c.has('river-otter') || c.has('great-blue-heron')),
	},
	{
		id: 'wetland-heron-hunt',
		icon: 'drop',
		text: `A great blue heron works the shallows. It hunts by standing utterly still for minutes, then striking faster than the eye can follow.`,
		test: (c) => c.has('great-blue-heron') && (c.has('freshwater-fish') || c.has('painted-turtle') || c.has('mallard-duck')),
	},
	{
		id: 'desert-snake-rodent',
		icon: 'leaf',
		text: `The rattlesnake is back, and it earns its keep: an ambush hunter that senses prey by body heat through pits on its face, keeping desert rodent numbers down.`,
		test: (c) => c.has('rattlesnake') && (c.has('kangaroo-rat') || c.has('desert-cottontail')),
	},
	{
		id: 'desert-coyote-prey',
		icon: 'paw',
		text: `A coyote ranges the scrubland again — a generalist that hunts rodents and rabbits and, in doing so, keeps the whole desert food web balanced.`,
		test: (c) => c.has('coyote') && (c.has('desert-cottontail') || c.has('kangaroo-rat')),
	},
	{
		id: 'desert-shared-burrow',
		icon: 'leaf',
		text: `Nobody wastes a hole in the desert: the tortoise digs a burrow, and a burrowing owl moves into the spare room. A few feet down, it's cool while the surface bakes.`,
		test: (c) => c.has('desert-tortoise') && c.has('burrowing-owl'),
	},
	{
		id: 'alpine-eagle-prey',
		icon: 'paw',
		text: `A golden eagle patrols the ridge. It can spot a marmot from over a mile off and stoop at more than 150 mph — the high country's apex hunter.`,
		test: (c) => c.has('golden-eagle') && (c.has('marmot') || c.has('pika') || c.has('snowshoe-hare')),
	},
	{
		id: 'coastal-keystone',
		icon: 'paw',
		text: `The ochre sea star is back — the original "keystone species." Remove it and mussels take over every rock; return it and the whole tidepool shares the space again.`,
		test: (c) => c.has('sea-star'),
	},
	{
		id: 'coastal-otter-kelp',
		icon: 'drop',
		text: `An otter rafting offshore means a forest beneath it: otters eat the urchins that would otherwise graze the kelp down to bare rock.`,
		test: (c) => c.has('sea-otter'),
	},
];

// Preserve-wide totals — quieter, reflective beats as the whole place fills in.
const TOTAL_BEATS: Beat[] = [
	{ id: 'total-10', icon: 'sparkle', text: `Ten kinds of animal now share the preserve. What started as bare ground is starting to feel alive.`, test: (c) => c.total >= 10 },
	{ id: 'total-25', icon: 'sparkle', text: `Twenty-five species across the preserve — the quiet you inherited has well and truly broken.`, test: (c) => c.total >= 25 },
	{ id: 'total-40', icon: 'sparkle', text: `Forty kinds of neighbor now. Word has clearly travelled: this is a safe place again.`, test: (c) => c.total >= 40 },
];

// Biome-specific feed lines, surfaced gradually over time while the player is in
// that area (see the timer in state.tsx). A big randomized pool per biome blends
// ecology, atmosphere, coexistence, and fun facts. `g` gates a line to the biome's
// recovery and what the player has done there:
//   h   = minimum biome health
//   a   = at least ONE of these animals has returned
//   all = ALL of these animals have returned   (animal combinations)
//   c   = ALL of these objects have been crafted (crafting combinations)
// `i` overrides the feed icon (default 'leaf').
export interface FeedLine {
	t: string;
	g?: { h?: number; a?: string[]; all?: string[]; c?: string[] };
	i?: string;
}

export const BIOME_LINES: Record<string, FeedLine[]> = {
	meadow: [
		// atmosphere
		{ t: `Wind moves through the grass in long silver waves; somewhere a sparrow answers it.` },
		{ t: `The meadow smells of warm earth and crushed clover after you turn the soil.` },
		{ t: `Grasshoppers spring out of the grass ahead of your steps like little sparks.`, i: 'sparkle' },
		{ t: `Seed heads nod on their stalks, scattering next year's meadow on the breeze.` },
		{ t: `Dew beads the spiderwebs strung between the grass blades at first light.` },
		{ t: `A breath of wind carries dandelion seeds drifting past like tiny parachutes.` },
		{ t: `The light goes gold and low across the grass tips toward evening.` },
		{ t: `Crickets tune up in the warm grass — a sound you feel as much as hear.` },
		{ t: `Morning fog catches in the grass and burns off in ribbons as the sun climbs.` },
		{ t: `A meadow is never truly silent; even at night the crickets keep the conversation going.` },
		// ecology / educational
		{ t: `Native grasses send roots three times deeper than the grass is tall — that's where a meadow stores its strength.` },
		{ t: `Grasslands hide most of their carbon underground, which is why a healthy meadow shrugs off fire and drought.` },
		{ t: `Wildflowers and pollinators evolved together; a flower's shape often matches the tongue of its favorite bee.` },
		{ t: `Ground-nesting birds rely on unmowed grass for cover — a tidy lawn is a desert to them.` },
		{ t: `Voles tunnel runways through the grass thatch, and those runways feed nearly every meadow predator.` },
		{ t: `Many meadow flowers bloom in sequence through the season, so something is always feeding the bees.` },
		{ t: `Clover pulls nitrogen out of the air and into the soil, quietly fertilizing the whole meadow for free.` },
		{ t: `Crab spiders hide inside flowers, perfectly camouflaged, ambushing the pollinators that visit.` },
		{ t: `Goldfinches wait to nest until thistles go to seed, timing their chicks to the food supply.` },
		{ t: `A single square foot of healthy meadow soil can hold more living things than there are people on Earth.` },
		// fun / quirky
		{ t: `A grasshopper can leap 20 times its body length — like you clearing a bus from a standing start.`, i: 'sparkle' },
		{ t: `Ladybugs can eat 5,000 aphids in a lifetime, which is why gardeners adore them.`, i: 'sparkle' },
		{ t: `Monarch caterpillars eat only milkweed, storing its toxins to make themselves taste terrible.`, i: 'sparkle' },
		{ t: `A bumblebee's buzz isn't its wings — it's the flight muscles shivering to shake pollen loose.`, i: 'sparkle' },
		{ t: `Killdeer fake a broken wing to lure predators from the nest, then "recover" and fly off.`, i: 'sparkle' },
		{ t: `Butterflies taste with their feet before they decide to feed.`, i: 'sparkle' },
		{ t: `Crickets chirp faster when it's warmer — count the chirps and you can estimate the temperature.`, i: 'sparkle' },
		{ t: `A meadowlark isn't a lark at all, but a cousin of the blackbird with a flutelike song.`, i: 'sparkle' },
		{ t: `A single dandelion can launch 2,000 seeds, each on its own tiny parachute.`, i: 'sparkle' },
		{ t: `Bluebirds can spot a caterpillar in the grass from fifty feet away.`, i: 'sparkle' },
		{ t: `Swallows drink on the wing, skimming low to sip from puddles without ever landing.`, i: 'sparkle' },
		{ t: `Garter snakes are harmless to you and a quiet menace to the slugs and mice you'd rather not host.`, i: 'sparkle' },
		// coexistence (gated)
		{ t: `Bees pollinate the flowers and the flowers feed the bees' young — neither would last long without the other.`, i: 'paw' },
		{ t: `Where the fox hunts, the rabbits stay on the move, and the grass they don't overgraze grows back thick.`, i: 'paw', g: { a: ['red-fox-meadow'] } },
		{ t: `The hawk overhead and the snake in the grass hunt the same voles from opposite directions.`, i: 'paw', g: { a: ['red-tailed-hawk'] } },
		{ t: `The monarchs go where the milkweed grows, and the milkweed spreads wherever the meadow is left wild.`, i: 'paw', g: { a: ['monarch-butterfly'] } },
		{ t: `Rabbits crop the grass low in patches, and ground-feeding birds love the open lanes they leave behind.`, i: 'paw', g: { a: ['cottontail-rabbit'] } },
		{ t: `Sparrows and finches eat the seeds the meadow drops, then scatter what they don't digest — gardeners with wings.`, i: 'paw', g: { a: ['song-sparrow', 'american-goldfinch'] } },
		// progress-gated atmosphere
		{ t: `The first real flush of wildflowers has opened; color is returning to the meadow.`, g: { h: 25 } },
		{ t: `The bare patches are knitting closed — green is winning back the dust.`, g: { h: 40 } },
		{ t: `Butterflies are everywhere now; the meadow has hit its stride.`, g: { h: 50 } },
		{ t: `The meadow hums in a way it didn't when you arrived — that low insect drone is the sound of health.`, g: { h: 60 } },
		{ t: `Swallows work the bugs above the grass at dusk; hard to believe this was bare dirt.`, g: { h: 80 } },
		// more
		{ t: `The whir you hear at dusk is a nighthawk, mouth open, hoovering insects from the air.` },
		{ t: `Praying mantises are the meadow's tigers in miniature, ambushing insects far larger than themselves.` },
		{ t: `Leafcutter bees snip neat circles from leaves to line their nests, one tidy parcel at a time.`, i: 'sparkle' },
		{ t: `A patch of bare ground left in the sun becomes a runway and a sunning spot for ground bees and lizards.` },
		{ t: `Foxes have whiskers on their legs as well as their faces, feeling their way through the tall grass.`, i: 'sparkle' },
		{ t: `The deeper a meadow's roots, the more rain it drinks before a drop ever runs off.` },
		{ t: `Painted ladies are among the farthest-traveling butterflies on Earth, crossing whole continents.`, i: 'sparkle' },
		{ t: `By late summer the meadow is mostly seed — a banquet laid out for every bird that passes.` },
		// animal combinations
		{ t: `Fox on the ground and hawk in the air — the meadow's voles are hunted from both worlds now.`, i: 'paw', g: { all: ['red-fox-meadow', 'red-tailed-hawk'] } },
		{ t: `Butterflies, bees, and beetles all working the same blooms — the pollination crew is complete.`, i: 'paw', g: { all: ['monarch-butterfly', 'bumblebee', 'lady-beetle'] } },
		{ t: `An owl has claimed the night shift over the meadow, hunting the mice the day birds never see.`, i: 'paw', g: { a: ['barn-owl', 'western-screech-owl'] } },
		{ t: `Deer and rabbits graze the same grass at different heights, and between them keep it from running wild.`, i: 'paw', g: { all: ['mule-deer', 'cottontail-rabbit'] } },
		// crafting combinations
		{ t: `A berry bush beside a shrub: a pantry and a place to bolt for cover, exactly what the small birds want.`, g: { c: ['berry-bush', 'shrub'] } },
		{ t: `Wildflower patch and pollinator garden together have turned this corner into a bee highway.`, g: { c: ['wildflower-patch', 'pollinator-garden'] } },
		{ t: `Brush pile and rock pile both down — cover now for everything from voles to garter snakes.`, g: { c: ['brush-pile', 'rock-pile'] } },
		{ t: `Oak and willow both rooted, and the meadow finally has real shade to offer.`, g: { c: ['oak-tree', 'willow-tree'] } },
		{ t: `A pond to drink from and a bath to splash in — the meadow's birds have both now.`, i: 'drop', g: { c: ['small-pond', 'bird-bath'] } },
	],
	forest: [
		// atmosphere
		{ t: `Light falls in green shafts through the canopy, shifting as the leaves move.` },
		{ t: `The forest floor is springy underfoot — centuries of fallen leaves turned to soil.` },
		{ t: `Somewhere above, a woodpecker drums a hollow trunk like a knock at a door.` },
		{ t: `The air here is cool and damp and smells of moss and old wood.` },
		{ t: `A branch creaks; a squirrel scolds; then the forest settles back into its hush.` },
		{ t: `Mist hangs low between the trunks in the early morning, slow to lift under the canopy.` },
		{ t: `Mushrooms have pushed up overnight along a fallen log, pale against the dark wood.` },
		{ t: `Leaves spiral down one at a time, each a slow green-gold parachute.` },
		{ t: `A wren's song spills out of the understory, far bigger than the bird that made it.` },
		{ t: `Rain doesn't fall so much as drip here, handed down leaf by leaf from the canopy.`, i: 'drop' },
		// ecology
		{ t: `Dead standing trees, called snags, are some of the richest habitat in a forest — homes carved and reused for generations.` },
		{ t: `An old forest grows in layers — floor, understory, canopy — and each shelters a different community.` },
		{ t: `Beneath the soil, fungi link tree roots into networks that trade water and nutrients between trees.` },
		{ t: `A rotting log is not waste; it's a slow-release pantry feeding insects, fungi, newts, and the soil itself.` },
		{ t: `Mature trees pull water up from deep underground and breathe it into the air, making their own weather.` },
		{ t: `Forest soils store enormous amounts of carbon — disturb them and much of it escapes to the sky.` },
		{ t: `Many forest seeds need an animal to bury or carry them; the forest plants itself through its residents.` },
		{ t: `Owls fly almost silently thanks to comb-like feather edges that break up the sound of the air.` },
		{ t: `Bats can eat their own body weight in insects in a single night.` },
		{ t: `Salamanders breathe partly through their skin and need the damp, shaded forest floor to survive.` },
		// fun
		{ t: `Flying squirrels don't truly fly — they glide on a membrane between their limbs, steering with the tail.`, i: 'sparkle' },
		{ t: `A pileated woodpecker can chisel a hole big enough to put your fist through, hunting carpenter ants.`, i: 'sparkle' },
		{ t: `Banana slugs can be bright yellow and as long as your hand, and they clean the forest floor as they go.`, i: 'sparkle' },
		{ t: `Black bears climb trees to nap on branches, sometimes wedged in surprisingly comfortably.`, i: 'sparkle' },
		{ t: `A chickadee's "dee-dee-dee" call adds more "dees" the more dangerous the predator it spots.`, i: 'sparkle' },
		{ t: `Newts can be toxic enough to make a predator deeply regret the attempt.`, i: 'sparkle' },
		{ t: `Squirrels sometimes "fake bury" nuts to fool any thieves watching them.`, i: 'sparkle' },
		{ t: `A bear's sense of smell is thousands of times keener than ours — it can wind food from miles off.`, i: 'sparkle' },
		{ t: `Wood ducks nest in tree cavities, and their ducklings leap from the hole to the ground on their first day.`, i: 'sparkle' },
		{ t: `Some forest fungi glow faintly in the dark — "foxfire" that early travelers used to mark trails.`, i: 'sparkle' },
		// coexistence (gated)
		{ t: `A woodpecker carves a cavity, uses it once, and leaves it — and the forest's renters move straight in.`, i: 'paw', g: { a: ['pileated-woodpecker', 'woodpecker'] } },
		{ t: `The owl hunts the night shift, the hawk the day — between them, few mice go uncounted.`, i: 'paw', g: { a: ['great-horned-owl', 'barred-owl'] } },
		{ t: `Squirrels bury more nuts than they ever dig up, and the ones they forget grow into the next forest.`, i: 'paw', g: { a: ['tree-squirrel', 'chipmunk'] } },
		{ t: `A bobcat needs dense cover to creep close — exactly the understory you've coaxed back.`, i: 'paw', g: { a: ['bobcat'] } },
		{ t: `Bats and owls split the night between insects and mice, and the forest is quieter for prey by dawn.`, i: 'paw', g: { a: ['little-brown-bat'] } },
		// progress-gated
		{ t: `Saplings are catching hold in the open ground; the understory is finding its feet.`, g: { h: 25 } },
		{ t: `The canopy is starting to close overhead, and the floor below it cools into real forest.`, g: { h: 50 } },
		{ t: `Three layers of forest now — floor, understory, canopy — each with its own residents.`, g: { h: 70 } },
		{ t: `The woods feel old again, the kind of quiet that takes decades to grow back.`, g: { h: 80 } },
		// more
		{ t: `Moss holds rainwater like a sponge, releasing it slowly so the forest floor never quite dries.`, i: 'drop' },
		{ t: `A single oak can support over 2,000 species across its life — a whole world in one tree.` },
		{ t: `Porcupines have around 30,000 quills, each tipped with tiny barbs.`, i: 'sparkle' },
		{ t: `Nuthatches walk headfirst down tree trunks, seeing insects the upward-climbers miss.`, i: 'sparkle' },
		{ t: `Deadwood left to rot returns more to the forest than living wood ever could.` },
		{ t: `Fishers are one of the few hunters quick enough to flip a porcupine and take it safely.`, i: 'sparkle' },
		{ t: `Tree rings record droughts, fires, and good years alike — a diary written in wood.` },
		{ t: `The understory shrubs feed the deer and the berries feed the birds; nothing in the layers goes spare.` },
		{ t: `A woodpecker's tongue is so long it wraps around the back of its skull when not in use.`, i: 'sparkle' },
		{ t: `Ravens mimic sounds, solve puzzles, and seem to slide and tumble through the air just for fun.`, i: 'sparkle' },
		{ t: `Fallen leaves shelter overwintering insects that become the first food of spring.` },
		{ t: `Spotted towhees rummage in the leaf litter so loudly you'd swear they were something far bigger.`, i: 'sparkle' },
		{ t: `A forest cools the air around it; step under the canopy on a hot day and you'll feel it drop.` },
		// animal combinations
		{ t: `Two owl species splitting the night between them — the forest dark is well hunted now.`, i: 'paw', g: { all: ['great-horned-owl', 'barred-owl'] } },
		{ t: `The big woodpecker carves the holes and the wood ducks claim them — cavity housing, forest-style.`, i: 'paw', g: { all: ['pileated-woodpecker', 'wood-duck'] } },
		{ t: `A large predator roams these woods again, and the whole forest is more alert for it.`, i: 'paw', g: { a: ['black-bear', 'bobcat'] } },
		{ t: `Squirrels by day, flying squirrels by night — canopy and cavities both busy around the clock.`, i: 'paw', g: { all: ['tree-squirrel', 'northern-flying-squirrel'] } },
		// crafting combinations
		{ t: `Standing deadwood and a nesting tree together: the woodpeckers carve, and everyone else moves in.`, g: { c: ['standing-deadwood', 'nesting-tree'] } },
		{ t: `Mushroom log and hollow log both rotting down — fungi fed, newts sheltered, soil rebuilt.`, g: { c: ['mushroom-log', 'hollow-log'] } },
		{ t: `A woodland pool beside a fern spring gives the salamanders the damp they can't live without.`, i: 'drop', g: { c: ['woodland-pool', 'fern-spring'] } },
		{ t: `A berry bush in the understory with ferns underfoot — food and cover on the forest floor at once.`, g: { c: ['berry-bush', 'fern-grove'] } },
	],
	wetland: [
		// atmosphere
		{ t: `Reeds rattle softly in the wind, and somewhere out in them a frog clears its throat.`, i: 'drop' },
		{ t: `The water lies still and dark, doubling the sky and the reeds along its edge.`, i: 'drop' },
		{ t: `A dragonfly stitches back and forth above the surface, all glittering wings.`, i: 'sparkle' },
		{ t: `Mud sucks at your boots near the bank, rich and black and full of life.` },
		{ t: `Concentric rings spread where something rose to feed, then vanished again.`, i: 'drop' },
		{ t: `The marsh smells green and mineral, of wet earth and growing reeds.` },
		{ t: `Red-winged blackbirds sway on the cattails, flashing their shoulders and calling.`, i: 'paw' },
		{ t: `Mist sits on the water at dawn until the first heron steps through it.`, i: 'drop' },
		{ t: `A water strider skates the surface tension, dimpling the water without breaking it.`, i: 'sparkle' },
		{ t: `Frogs go quiet as you pass, then start up again behind you, one brave voice at a time.` },
		// ecology
		{ t: `Wetlands filter pollutants and store floodwater — doing for free what costs cities millions.`, i: 'drop' },
		{ t: `Amphibians breathe partly through their skin, so their presence is a sign the water is clean.`, i: 'drop' },
		{ t: `A marsh is among the most productive habitats on Earth, rivaling rainforests for sheer abundance.` },
		{ t: `Reed beds are nurseries — countless young fish, frogs, and insects hide among the stems.`, i: 'drop' },
		{ t: `Wetlands recharge groundwater, letting rain soak in slowly instead of rushing away.`, i: 'drop' },
		{ t: `Cattails clean the water as they grow, drawing excess nutrients up into their stalks.` },
		{ t: `Many birds migrate thousands of miles between wetlands — lose one and a whole journey breaks.`, i: 'paw' },
		{ t: `Mud at the bottom of a marsh can lock away carbon for thousands of years.` },
		{ t: `Frogs' eggs, tadpoles, and adults each fill a different role in the food web as they grow.` },
		{ t: `Still water grows warm and rich; moving water stays cool and clear. A marsh needs both.`, i: 'drop' },
		// fun
		{ t: `Dragonflies have hunted these skies for over 300 million years — older than the dinosaurs.`, i: 'sparkle' },
		{ t: `A dragonfly catches prey in midair over 90% of the time — one of nature's deadliest hunters.`, i: 'sparkle' },
		{ t: `Beavers' front teeth never stop growing; gnawing wood is what keeps them filed down.`, i: 'sparkle' },
		{ t: `Some turtles can breathe through their rear ends, handy for a winter spent underwater.`, i: 'sparkle' },
		{ t: `A heron's neck has a special hinge that lets it strike like a loosed spring.`, i: 'sparkle' },
		{ t: `Otters keep a favorite rock as a tool and tuck it in a "pocket" of loose skin.`, i: 'sparkle' },
		{ t: `Bitterns point their bills skyward and sway with the reeds to vanish in plain sight.`, i: 'sparkle' },
		{ t: `A bullfrog's call can carry half a mile across still water on a calm night.`, i: 'sparkle' },
		{ t: `Kingfishers hover, then dive headfirst, closing a third eyelid like goggles before they hit.`, i: 'sparkle' },
		{ t: `Muskrats build little lodges and push-up feeding huts out of the reeds they cut.`, i: 'sparkle' },
		// coexistence (gated)
		{ t: `The beaver doesn't move into habitat — it builds it. Its dam makes the deep water everyone else needs.`, i: 'paw', g: { a: ['beaver'] } },
		{ t: `Otters and herons both hunt the still water the beaver's dam holds back.`, i: 'paw', g: { a: ['river-otter', 'great-blue-heron'] } },
		{ t: `The heron stalks the shallows the frogs hide in, and the frogs eat the insects the reeds shelter.`, i: 'paw', g: { a: ['great-blue-heron'] } },
		{ t: `Turtles bask on the logs that otters and muskrats leave drifting — everything gets reused here.`, i: 'paw', g: { a: ['painted-turtle', 'snapping-turtle'] } },
		{ t: `Where there are minnows there are kingfishers; the marsh feeds upward from the smallest fish.`, i: 'paw', g: { a: ['freshwater-fish'] } },
		// progress-gated
		{ t: `Water is finding the old channels again, and the reeds are rising to meet it.`, i: 'drop', g: { h: 25 } },
		{ t: `The marsh is loud now — frogs, blackbirds, the whir of dragonflies all at once.`, g: { h: 50 } },
		{ t: `Open water and reed bed and mud bank, all here at once: the marsh reads as a marsh again.`, i: 'drop', g: { h: 70 } },
		{ t: `Standing at the water's edge, it's hard to picture the cracked mud you started from.`, i: 'drop', g: { h: 80 } },
		// more
		{ t: `Sandhill cranes mate for life and dance to court — bowing, leaping, tossing grass in the air.`, i: 'sparkle' },
		{ t: `A wetland's edge, where water meets land, packs in more species than either side alone.` },
		{ t: `Leopard frogs can leap many times their length to vanish into the water at the first alarm.`, i: 'sparkle' },
		{ t: `Mergansers have serrated bills — "sawbills" — for gripping the slippery fish they chase underwater.`, i: 'sparkle' },
		{ t: `Cattail fluff was once used to stuff life jackets; the marsh has always been useful.` },
		{ t: `Damselflies fold their wings along their backs at rest; dragonflies hold theirs out flat.`, i: 'sparkle' },
		{ t: `A beaver pond slows the water enough for silt to settle, clearing everything downstream.`, i: 'drop' },
		{ t: `Marsh wrens build several dummy nests, leaving a predator to guess which one holds the eggs.`, i: 'sparkle' },
		{ t: `Green herons sometimes drop a feather or insect on the water as bait, then snatch the fish it draws.`, i: 'sparkle' },
		{ t: `Whirligig beetles have split eyes that watch above and below the waterline at the same time.`, i: 'sparkle' },
		{ t: `A single acre of healthy marsh can shelter thousands of nesting and migrating birds in a season.`, i: 'paw' },
		{ t: `Cattail roots were a staple food here long before there were towns to drain the marsh.` },
		// animal combinations
		{ t: `Beaver and otter both working the water — the marsh has its engineer and its acrobat.`, i: 'paw', g: { all: ['beaver', 'river-otter'] } },
		{ t: `Heron in the shallows, fish in the water below it — the marsh's food chain is wired together.`, i: 'paw', g: { all: ['great-blue-heron', 'freshwater-fish'] } },
		{ t: `A tall marsh bird stalks the reeds again, patient as the water itself.`, i: 'paw', g: { a: ['sandhill-crane', 'american-bittern'] } },
		{ t: `Turtles share the basking logs by day; nothing here wastes a sunny perch.`, i: 'paw', g: { all: ['painted-turtle', 'snapping-turtle'] } },
		// crafting combinations
		{ t: `Reed bed and cattail stand together: nursery and cover for half the marsh at once.`, i: 'drop', g: { c: ['reed-bed', 'cattail-stand'] } },
		{ t: `A lily pool above a mud bank — frogs get sun and ooze both, just how they like it.`, i: 'drop', g: { c: ['lily-pool', 'mud-bank'] } },
		{ t: `A nesting platform over the water and logs to bask on — marsh birds and turtles both set.`, g: { c: ['nesting-platform', 'marsh-log'] } },
		{ t: `Bulrush and sedge tussocks give the marsh wrens a whole maze to hide their nests in.`, g: { c: ['bulrush', 'sedge-tussock'] } },
	],
	desert: [
		// atmosphere
		{ t: `Heat shimmers off the flats, and the only sound is the wind moving sand grain by grain.` },
		{ t: `A roadrunner darts between the brush, all legs and purpose, and is gone.`, i: 'paw' },
		{ t: `The light is huge here, and the shadows under each shrub are sharp and cool.` },
		{ t: `Come dusk the desert exhales; the heat lifts and the night shift begins to stir.` },
		{ t: `A lizard does push-ups on a warm stone, claiming the rock for itself.`, i: 'sparkle' },
		{ t: `The brush smells of dust and resin, sharpened by the heat.` },
		{ t: `Stars come out thick and close over the desert once the sun is finally down.` },
		{ t: `Tracks cross the sand from the night before — a story of who went where in the cool dark.` },
		{ t: `A cactus wren rattles from a cholla, scolding nothing in particular.`, i: 'paw' },
		{ t: `After a rare rain the whole flat turns faintly green, racing to bloom before it dries.` },
		// ecology
		{ t: `Many desert animals never drink — they wring water from the seeds they eat and their own metabolism.` },
		{ t: `Burrows are the desert's air-conditioning: a few feet down it stays mild while the surface bakes.` },
		{ t: `Cactus opens its pores at night, not in the daytime heat, to lose as little water as it can.` },
		{ t: `Desert soil wears a living crust of moss and lichen that holds it together — one footstep can undo years.` },
		{ t: `Seeds can wait years in the desert soil for the one good rain that makes blooming worth it.` },
		{ t: `Shade is a resource here; a single nurse plant can shelter a dozen seedlings beneath it.` },
		{ t: `Desert predators hunt at dawn and dusk to dodge both the heat and the cold of deep night.` },
		{ t: `A saguaro can take 50 years to grow its first arm and live for over 150.` },
		{ t: `Pack rats build middens that, preserved in the dry air, can record the desert's history for millennia.` },
		{ t: `The desert runs on pulses — long waits broken by sudden, frantic abundance after rain.` },
		// fun
		{ t: `Kangaroo rats can go their whole lives without drinking a drop of water.`, i: 'sparkle' },
		{ t: `A horned lizard can squirt a jet of blood from its eyes to startle a predator.`, i: 'sparkle' },
		{ t: `Roadrunners can sprint over 20 mph and would genuinely rather run than fly.`, i: 'sparkle' },
		{ t: `Elf owls are smaller than a soda can and nest in holes woodpeckers leave in the cactus.`, i: 'sparkle' },
		{ t: `Tarantulas can go months between meals and live for decades.`, i: 'sparkle' },
		{ t: `A Gila woodpecker drills nest holes in saguaros that countless other desert animals later use.`, i: 'sparkle' },
		{ t: `Jackrabbits dump heat through their enormous ears, which glow with blood vessels.`, i: 'sparkle' },
		{ t: `Some desert toads sleep underground for most of the year, surfacing only for the rains.`, i: 'sparkle' },
		{ t: `Chuckwallas wedge into rock cracks and puff up so tightly that nothing can pull them out.`, i: 'sparkle' },
		{ t: `A kit fox's huge ears dump heat and pick up the faintest rustle of a beetle in the dark.`, i: 'sparkle' },
		// coexistence (gated)
		{ t: `Nobody wastes a hole in the desert: the tortoise digs the burrow, the owl takes the spare room.`, i: 'paw', g: { a: ['desert-tortoise', 'burrowing-owl'] } },
		{ t: `The rattlesnake senses prey by body heat and keeps the rodents in check — pest control with patience.`, i: 'paw', g: { a: ['rattlesnake'] } },
		{ t: `A coyote eats whatever the desert offers, and in doing so keeps the whole web from tipping.`, i: 'paw', g: { a: ['coyote'] } },
		{ t: `The woodpecker carves the cactus, and elf owls and flycatchers move into the holes it leaves.`, i: 'paw', g: { a: ['gila-woodpecker'] } },
		{ t: `Quail travel in coveys, dozens of eyes watching for the hawk so each can keep feeding.`, i: 'paw', g: { a: ['gambels-quail'] } },
		// progress-gated
		{ t: `Brush is taking hold, and with it the first scraps of shade the flat has had in years.`, g: { h: 25 } },
		{ t: `Burrows dot the ground now; the desert's life has somewhere to escape the sun.`, g: { h: 50 } },
		{ t: `Cactus, brush, and burrow all in place — the scrubland is functioning as a desert should.`, g: { h: 70 } },
		{ t: `At dusk the whole flat comes alive with rustles and calls; the dead heat is long gone.`, g: { h: 80 } },
		// more
		{ t: `Costa's hummingbirds dive-display in the desert spring, the sun flaring purple off their throats.`, i: 'sparkle' },
		{ t: `Agave may grow for decades, bloom once in a towering spike, and then die — all on one budget of water.` },
		{ t: `Antelope squirrels run with their tails flipped over their backs like little parasols.`, i: 'sparkle' },
		{ t: `A desert night can be 40 degrees cooler than the same spot at noon.` },
		{ t: `Phainopeplas eat mistletoe berries and plant the next crop wherever they perch.`, i: 'sparkle' },
		{ t: `Banded geckos squeak when grabbed and can drop their tail to make a clean escape.`, i: 'sparkle' },
		{ t: `Desert bees nest in the ground and time their whole lives to a few weeks of bloom.` },
		{ t: `Wash channels carry the rare flood, and the biggest brush always grows along their banks.` },
		{ t: `Creosote bushes can clone themselves for thousands of years from a single original plant.` },
		{ t: `Scorpions glow an eerie blue-green under ultraviolet light, for reasons no one fully understands.`, i: 'sparkle' },
		{ t: `Desert iguanas stay active at body temperatures that would kill most other lizards.`, i: 'sparkle' },
		{ t: `A sudden downpour can fill a bone-dry wash with a flash flood in a matter of minutes.`, i: 'drop' },
		// animal combinations
		{ t: `Tortoise burrow with a borrowed owl inside — desert real estate is fully booked.`, i: 'paw', g: { all: ['desert-tortoise', 'burrowing-owl'] } },
		{ t: `Rattlesnake and kangaroo rat sharing the same flat — predator and prey, the desert in balance.`, i: 'paw', g: { all: ['rattlesnake', 'kangaroo-rat'] } },
		{ t: `A desert hunter ranges the flats after dark now, reading the sand for tracks.`, i: 'paw', g: { a: ['coyote', 'kit-fox'] } },
		{ t: `The woodpecker drills the cactus and the elf owl takes the hole — the saguaro is an apartment block.`, i: 'paw', g: { all: ['gila-woodpecker', 'elf-owl'] } },
		// crafting combinations
		{ t: `A burrow mound and a shaded rock shelter give the desert two ways to duck the sun.`, g: { c: ['burrow-mound', 'shaded-rock-shelter'] } },
		{ t: `Cactus and brush together: shade, cover, and food where there used to be only bare flat.`, g: { c: ['cactus-patch', 'desert-brush'] } },
		{ t: `Marigolds and a nectar feeder out — now the hummingbirds have a reason to detour through here.`, g: { c: ['nectar-feeder', 'desert-marigold'] } },
		{ t: `Mesquite and palo verde, the desert's nurse trees, shading every seedling that starts beneath them.`, g: { c: ['mesquite-tree', 'palo-verde-tree'] } },
	],
	alpine: [
		// atmosphere
		{ t: `The wind never quite stops up here; it leans on the grass and combs the snowfields.` },
		{ t: `Far below, the lower country lies hazed and small; up here the air is thin and bright.` },
		{ t: `A marmot's whistle bounces off the rock and the whole slope seems to listen.`, i: 'paw' },
		{ t: `Cloud shadows slide across the talus, and for a moment the mountain dims, then blazes again.` },
		{ t: `Snowmelt trickles between the stones, ice-cold and clear enough to see every pebble.`, i: 'drop' },
		{ t: `Cushion plants hug the ground in tight green mounds, out of the wind's reach.` },
		{ t: `The quiet up here has weight to it, broken only by wind and the odd falling stone.` },
		{ t: `Wildflowers crowd a sheltered hollow, blooming hard and fast in the short alpine summer.` },
		{ t: `Frost still rims the shadows at midday where the sun hasn't reached.` },
		{ t: `A pika dashes across the rocks with a mouthful of flowers, working against the coming winter.`, i: 'paw' },
		// ecology
		{ t: `Alpine plants grow low and slow against the cold — some cushion plants are centuries old but inches across.` },
		{ t: `Snow is insulation: many small animals spend winter in the mild gap between snowpack and ground.` },
		{ t: `Alpine soils are thin and ancient; a single inch can take a thousand years to form.` },
		{ t: `Up here, summer is a sprint — plants must sprout, flower, and seed in just a few frantic weeks.` },
		{ t: `Snowmelt timing sets the whole mountain's clock; everything blooms and breeds to match it.`, i: 'drop' },
		{ t: `Lichens grow on bare rock at a fraction of a millimeter a year, the slow pioneers of the heights.` },
		{ t: `Cold, clean meltwater holds more oxygen — which is why alpine trout can live in it.`, i: 'drop' },
		{ t: `Wind-stunted trees at treeline can be ancient, twisted into shapes by centuries of gales.` },
		{ t: `Alpine species are climate sentinels — as it warms they can only climb, until they run out of mountain.` },
		{ t: `A meadow of alpine wildflowers may bloom all at once, racing the snow that will return in weeks.` },
		// fun
		{ t: `Pikas don't hibernate — they spend all summer stacking "haypiles" to eat under the snow.`, i: 'sparkle' },
		{ t: `A golden eagle can spot prey from over a mile away and stoop at more than 150 mph.`, i: 'sparkle' },
		{ t: `Mountain goats aren't true goats, and they scale near-vertical cliffs on rubbery, gripping hooves.`, i: 'sparkle' },
		{ t: `Ptarmigan grow feathered "snowshoes" on their feet and turn white to vanish in winter.`, i: 'sparkle' },
		{ t: `Clark's nutcrackers can hide tens of thousands of pine seeds and remember where most of them are.`, i: 'sparkle' },
		{ t: `Marmots spend up to eight months a year hibernating, hearts barely ticking over.`, i: 'sparkle' },
		{ t: `Bighorn rams crash heads at 20 mph; their skulls are built with a double layer to take it.`, i: 'sparkle' },
		{ t: `An ermine turns from brown to pure white in winter, keeping only a black tail-tip.`, i: 'sparkle' },
		{ t: `Rosy-finches nest higher than almost any other songbird, right up among the snowfields.`, i: 'sparkle' },
		{ t: `Snowshoe hares change coat color with the seasons, brown in summer and white in snow.`, i: 'sparkle' },
		// coexistence (gated)
		{ t: `When the eagle circles, the marmots whistle and the whole slope freezes — the alarm that ties the heights together.`, i: 'paw', g: { a: ['golden-eagle'] } },
		{ t: `Clark's nutcracker plants the pines it forgets, and the whole treeline marches uphill on its memory.`, i: 'paw', g: { a: ['clarks-nutcracker'] } },
		{ t: `Pikas and marmots share the talus, one stacking hay, the other sunning on the boulders above.`, i: 'paw', g: { a: ['pika', 'marmot'] } },
		{ t: `The ermine follows the voles into the gap beneath the snow, hunting where the cold can't reach.`, i: 'paw', g: { a: ['ermine'] } },
		{ t: `Trout hold in the snowmelt pools, and the eagles and martens learn exactly where to watch.`, i: 'paw', g: { a: ['snowmelt-trout'] } },
		// progress-gated
		{ t: `Turf is knitting back over the bare talus, a fraction of an inch at a time.`, g: { h: 25 } },
		{ t: `Wildflowers have taken the sheltered hollows, and the marmots have someplace worth sunning.`, g: { h: 50 } },
		{ t: `Turf, snowmelt pool, and rocky shelter all in place — the high country is whole again.`, g: { h: 70 } },
		{ t: `An eagle could circle this ridge now and find a slope full of life beneath it.`, g: { h: 80 } },
		// more
		{ t: `Boreal toads climb surprisingly high, breeding in snowmelt ponds that vanish by late summer.`, i: 'sparkle' },
		{ t: `Mountain bluebirds hover like kestrels before dropping on insects in the turf.`, i: 'sparkle' },
		{ t: `Whitebark pines depend almost entirely on the nutcracker to plant their seeds.` },
		{ t: `Alpine air holds less oxygen, so the animals that live here run on famously efficient blood.` },
		{ t: `Pine grosbeaks are so unafraid of people that old-timers called them "mope-heads."`, i: 'sparkle' },
		{ t: `A marmot colony posts sentries; one whistle and every burrow empties in a heartbeat.`, i: 'paw' },
		{ t: `Snow lingers in the shadows of boulders into midsummer, watering the flowers downhill of it.`, i: 'drop' },
		{ t: `Up here, a warm rock in the morning sun is the most valuable real estate on the mountain.` },
		{ t: `Glacier lilies push up through the very edge of the melting snow to bloom before anything else.` },
		{ t: `White-crowned sparrows sing slightly different dialects from one mountain to the next.`, i: 'sparkle' },
		{ t: `Alpine chipmunks scatter their seed caches in dozens of hidden larders to outlast the winter.` },
		{ t: `The treeline isn't really a line — it's a slow surrender of forest to wind and cold.` },
		// animal combinations
		{ t: `Pika stacking hay and marmot sunning above it — the talus is fully tenanted now.`, i: 'paw', g: { all: ['pika', 'marmot'] } },
		{ t: `Eagle circling and marmots below to whistle the alarm — the whole slope works as one.`, i: 'paw', g: { all: ['golden-eagle', 'marmot'] } },
		{ t: `A cliff-climber has claimed the crags, picking its way where nothing else dares.`, i: 'paw', g: { a: ['mountain-goat', 'bighorn-sheep'] } },
		{ t: `A small, fierce hunter works the talus now, slipping between the stones after voles.`, i: 'paw', g: { a: ['ermine', 'pine-marten'] } },
		// crafting combinations
		{ t: `Snowmelt pool beside alpine flowers — water and forage both, in the brief mountain summer.`, i: 'drop', g: { c: ['snowmelt-pool', 'alpine-wildflower-patch'] } },
		{ t: `Heather mat and moss cushion knitting the thin soil together against the wind.`, g: { c: ['heather-mat', 'moss-cushion'] } },
		{ t: `Krummholz pine and subalpine fir holding the treeline — the last trees before the bare heights.`, g: { c: ['krummholz-pine', 'subalpine-fir'] } },
		{ t: `A burrow mound tucked into a rock pile — the pikas and marmots have their fortress.`, g: { c: ['burrow-mound', 'rock-pile'] } },
	],
	coastal: [
		// atmosphere
		{ t: `The surf comes in long and steady, and the whole shore breathes with it.`, i: 'drop' },
		{ t: `Gulls wheel and squabble over the wrack line, picking through what the tide left behind.`, i: 'paw' },
		{ t: `The air is all salt and kelp and cold spray off the breakers.` },
		{ t: `A wave draws back and the tidepools brim, each a tiny world of color.`, i: 'drop' },
		{ t: `Sandpipers chase the retreating water and flee the next wave, over and over, never quite caught.`, i: 'paw' },
		{ t: `Fog rolls in off the water and softens the whole coast to grays and silver.` },
		{ t: `Sea glass and shell fragments glint where the last high tide stranded them.` },
		{ t: `The rocks are slick with weed and loud with the suck and hiss of the surge.`, i: 'drop' },
		{ t: `A pelican glides a hand's breadth above the swell, riding the cushion of air it makes.`, i: 'paw' },
		{ t: `Out past the breakers, the sea heaves slow and enormous and indifferent.`, i: 'drop' },
		// ecology
		{ t: `Tidepool animals live a double life, surviving both crashing waves and hours of exposure to air.` },
		{ t: `Kelp can grow up to two feet a day, building underwater forests that shelter hundreds of species.`, i: 'drop' },
		{ t: `Dune grasses anchor the shore with deep roots — without them, one storm can wash a beach away.` },
		{ t: `The wrack line of stranded kelp feeds a whole community of insects, birds, and crabs.`, i: 'paw' },
		{ t: `Mussels and barnacles filter the seawater, clearing it as they feed.`, i: 'drop' },
		{ t: `A tidepool's residents are zoned by how long they can stand being out of water.`, i: 'drop' },
		{ t: `Estuaries and shorelines are nurseries for fish that later fill the open ocean.`, i: 'drop' },
		{ t: `Anemones sting their prey with harpoon cells too small to feel through your skin.` },
		{ t: `Eelgrass meadows lock away carbon faster, acre for acre, than a rainforest.`, i: 'drop' },
		{ t: `Migrating shorebirds time their stopovers to the tides, feeding on what the water uncovers.`, i: 'paw' },
		// fun
		{ t: `Sea otters hold hands while they sleep so the current doesn't drift them apart.`, i: 'sparkle' },
		{ t: `A sea star can push its stomach out of its body to digest prey too big to swallow.`, i: 'sparkle' },
		{ t: `Hermit crabs trade up shells as they grow, sometimes lining up to swap in size order.`, i: 'sparkle' },
		{ t: `A group of pelicans is a "squadron," and they plunge-dive for fish from up to 60 feet.`, i: 'sparkle' },
		{ t: `Octopuses can taste with their arms and squeeze through any gap bigger than their beak.`, i: 'sparkle' },
		{ t: `Sea stars can regrow lost arms, and a few can regrow a whole body from one.`, i: 'sparkle' },
		{ t: `Sanderlings run on legs that blur like clockwork as they chase the waves.`, i: 'sparkle' },
		{ t: `A barnacle glues its own head to the rock and kicks food into its mouth with its legs.`, i: 'sparkle' },
		{ t: `Harbor seals can sleep underwater, surfacing to breathe without ever waking.`, i: 'sparkle' },
		{ t: `Gray whales make one of the longest migrations of any mammal — thousands of miles each way.`, i: 'sparkle' },
		// coexistence (gated)
		{ t: `The sea star is the original keystone: remove it and mussels take every rock; return it and all share the space.`, i: 'paw', g: { a: ['sea-star'] } },
		{ t: `An otter offshore means a forest beneath it — it eats the urchins that would mow the kelp to stubble.`, i: 'paw', g: { a: ['sea-otter'] } },
		{ t: `Pelicans and cormorants follow the fish the kelp shelters; the forest below feeds the wings above.`, i: 'paw', g: { a: ['brown-pelican', 'pelagic-cormorant'] } },
		{ t: `Oystercatchers pry open the mussels the tide grows fat, prizing the rocks open one by one.`, i: 'paw', g: { a: ['black-oystercatcher'] } },
		{ t: `Where the anemones and mussels share a rock in peace, you can thank the sea star patrolling it.`, i: 'paw', g: { a: ['sea-star', 'giant-green-anemone'] } },
		// progress-gated
		{ t: `Dunes are anchoring and the tidepools are filling; the shore is finding its footing.`, i: 'drop', g: { h: 25 } },
		{ t: `Crabs, anemones, gulls — the wrack line and the rocks are busy again.`, g: { h: 50 } },
		{ t: `Anchored dune, full tidepool, kelp in the wrack: the whole shore is working as one.`, i: 'drop', g: { h: 70 } },
		{ t: `Whale-spout to clam-siphon, the coast hums with life from the deep water to the dry sand.`, g: { h: 80 } },
		// more
		{ t: `Green sea turtles can hold their breath for hours while resting on the bottom.`, i: 'sparkle' },
		{ t: `A mussel anchors itself with "byssal threads" stronger, for their size, than steel cable.` },
		{ t: `Dolphins sleep one half of their brain at a time so they never stop surfacing to breathe.`, i: 'sparkle' },
		{ t: `Snowy plovers nest in bare scrapes on open sand, which is why a quiet beach matters so much.`, i: 'paw' },
		{ t: `Kelp holds onto rock with a "holdfast," not roots — it drinks straight from the seawater.`, i: 'drop' },
		{ t: `Turnstones flip stones and weed looking for the small life hiding underneath — hence the name.`, i: 'sparkle' },
		{ t: `Bat stars come in a riot of colors, no two quite the same.`, i: 'sparkle' },
		{ t: `The highest tides of the month come with the new and full moon, reaching places the sea rarely touches.`, i: 'drop' },
		{ t: `Anna's hummingbirds dive from on high and "sing" with their tail feathers in a courtship power-dive.`, i: 'sparkle' },
		{ t: `Pigeon guillemots flash bright red feet and mouths as they court along the sea cliffs.`, i: 'sparkle' },
		{ t: `A receding tide opens a whole world that will be underwater again within hours.`, i: 'drop' },
		{ t: `Beach hoppers bury themselves in damp sand by day and swarm the wrack line after dark.`, i: 'sparkle' },
		// animal combinations
		{ t: `Sea star patrolling the rock and anemones holding their space beneath it — the tidepool shares fairly now.`, i: 'paw', g: { all: ['sea-star', 'anemone'] } },
		{ t: `Otter and seal both offshore — the kelp beds are rich enough to feed them both.`, i: 'paw', g: { all: ['sea-otter', 'harbor-seal'] } },
		{ t: `Pelicans and cormorants diving the same shoals — the fish the kelp shelters feed the wings above.`, i: 'paw', g: { all: ['pelican', 'cormorant'] } },
		{ t: `Shorebirds work the open sand again, racing the waves for what the water uncovers.`, i: 'paw', g: { a: ['snowy-plover', 'sanderling'] } },
		// crafting combinations
		{ t: `Tidepool and kelp wrack together: the crabs and gulls have both a home and a buffet.`, i: 'drop', g: { c: ['tidepool', 'kelp-wrack'] } },
		{ t: `Dune grass and beach shrub anchoring the sand — the shore can hold a storm now.`, g: { c: ['dune-grass', 'beach-shrub'] } },
		{ t: `Eelgrass and oyster beds filtering the shallows — the water clears and the fish come back.`, i: 'drop', g: { c: ['eelgrass-bed', 'oyster-bed'] } },
		{ t: `Safe nesting ground above the tide line — the shorebirds can finally raise young here.`, g: { c: ['coastal-nesting-area', 'nesting-platform'] } },
	],
};

const HEALTH_LINES: Record<number, (biome: string) => string> = {
	25: (b) => `${b} has crossed a quarter restored — bare ground is becoming real habitat, and the first hardy species can finally risk it.`,
	50: (b) => `${b} is halfway back — and halfway is the tipping point. From here recovery speeds up, as the life you've brought back helps bring back more.`,
	80: (b) => `${b} is thriving at 80% — healthy enough now to support its top predators and a full, working food web.`,
	100: (b) => `${b} is fully restored. What you inherited as damaged ground is, simply, wild again.`,
};

/** Progress beat for a biome crossing a health threshold (25/50/80/100). */
export function healthMilestoneLine(threshold: number, biomeName: string): string | null {
	return HEALTH_LINES[threshold] ? HEALTH_LINES[threshold](biomeName) : null;
}

export const HEALTH_THRESHOLDS = [25, 50, 80, 100];

/** Is a biome line eligible given the area's current recovery + what's been built? */
function lineEligible(line: FeedLine, health: number, returnedIds: Set<string>, crafted: Set<string>): boolean {
	const g = line.g;
	if (!g) return true;
	if (g.h !== undefined && health < g.h) return false;
	if (g.a && !g.a.some((id) => returnedIds.has(id))) return false;
	if (g.all && !g.all.every((id) => returnedIds.has(id))) return false;
	if (g.c && !g.c.every((id) => crafted.has(id))) return false;
	return true;
}

/**
 * Pick the next time-based feed line for the player's *current* biome — strictly
 * biome-specific. Respects recovery / animal-combination / crafting-combination
 * gates and never repeats a line already shown (tracked in `shown`). Returns null
 * if there's nothing new to say right now.
 */
export function nextFeedFact(opts: {
	area: string;
	health: number;
	returnedIds: Set<string>;
	crafted: Set<string>;
	shown: Set<string>;
}): { key: string; icon: string; text: string } | null {
	const { area, health, returnedIds, crafted, shown } = opts;
	const pool = (BIOME_LINES[area] || [])
		.map((line, i) => ({ key: `b:${area}:${i}`, icon: line.i || 'leaf', text: line.t, line }))
		.filter((c) => !shown.has(c.key) && lineEligible(c.line, health, returnedIds, crafted));
	if (pool.length === 0) return null;
	const pick = pool[Math.floor(Math.random() * pool.length)];
	return { key: pick.key, icon: pick.icon, text: pick.text };
}

/** Build the full beat list once we know the biome names. */
function allBeats(data: GameData): Beat[] {
	const beats: Beat[] = [];
	for (const biome of data.biomes) {
		for (const kb of KIND_BEATS) {
			// only create a beat the biome can actually reach
			const available = data.animals.filter((a) => a.biome === biome.id && a.kind === kb.kind).length;
			if (available < kb.threshold) continue;
			beats.push({
				id: `kind-${biome.id}-${kb.kind}`,
				icon: kb.icon,
				text: kb.text(biome.name),
				test: (c) => c.kindInBiome(biome.id, kb.kind) >= kb.threshold,
			});
		}
		// "every kind of creature" in a biome
		const totalKinds = new Set(data.animals.filter((a) => a.biome === biome.id).map((a) => a.kind)).size;
		if (totalKinds >= 4) {
			beats.push({
				id: `allkinds-${biome.id}`,
				icon: 'leaf',
				text: `Every kind of creature — from the smallest insect to the top predator — is represented in ${biome.name} now. A complete community.`,
				test: (c) => c.distinctKindsInBiome(biome.id) >= totalKinds,
			});
		}
	}
	return [...beats, ...COMBO_BEATS, ...TOTAL_BEATS];
}

let cache: { data: GameData; beats: Beat[] } | null = null;

/**
 * Return the narrative lines to add to the feed given the returned-animal set
 * before and after this batch of returns. A beat fires only when the new
 * returns flip it from false to true — so each fires exactly once, ever.
 */
export function narrativeBeats(before: Set<string>, after: Set<string>, data: GameData): { icon: string; text: string }[] {
	if (!cache || cache.data !== data) cache = { data, beats: allBeats(data) };
	const cb = buildCtx(before, data);
	const ca = buildCtx(after, data);
	const out: { icon: string; text: string }[] = [];
	for (const beat of cache.beats) {
		if (beat.test(ca) && !beat.test(cb)) out.push({ icon: beat.icon, text: beat.text });
	}
	return out.slice(0, 3); // never flood the feed in one batch
}
