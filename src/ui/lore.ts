// Staged biome lore + a coexistence note, shown in the Preserve panel. Pure
// display flavor (no server state), so it lives client-side. The stage is
// chosen by the biome's current health, so the world tells its own recovery
// story as you restore it — and each `coexistence` line names a real
// who-needs-whom relationship from the animal data.

export interface BiomeLore {
	damaged: string;   // 0–25%
	recovering: string; // 26–60%
	thriving: string;  // 61–99%
	restored: string;  // 100%
	coexistence: string;
}

export const BIOME_LORE: Record<string, BiomeLore> = {
	meadow: {
		damaged: 'Bare, dusty ground where a flowering meadow used to be. With the native grasses gone, the pollinators left — and everything that ate them followed.',
		recovering: 'Grass and wildflower are knitting back in. Bees and butterflies work the new blooms, sparrows pick the seed, and the first hunters start watching the edges.',
		thriving: 'A meadow that hums. Voles tunnel the grass, hawks ride the thermals above them, and a fox can finally find enough to stay.',
		restored: 'A full grassland food web, top to bottom — pollinator to predator. Healthy meadows like this store carbon in their deep roots and feed a third of the preserve’s insects.',
		coexistence: 'The fox and the hawks only settle once the voles and rabbits are back — predators arrive last, when there’s finally enough prey to feed them.',
	},
	forest: {
		damaged: 'A logged-over woodland. The big trees and standing snags are gone, so the woodpeckers have nowhere to carve — and the cavity-nesters that reuse their holes never come.',
		recovering: 'The understory is filling in: ferns, shrubs, deadwood for the newts. Squirrels and woodpeckers are back, and where there’s prey the first owls test the dark.',
		thriving: 'Three layers of forest now — floor, understory, canopy — each with its own residents. Flying squirrels glide between the very trees you raised.',
		restored: 'A full, layered old wood. Woodpeckers cut the homes; owls, ducks, and flying squirrels move into the holes they leave behind. Nothing in a forest is wasted.',
		coexistence: 'One big woodpecker carves a cavity, uses it once, and abandons it — and a wood duck, a flying squirrel, or an owl moves straight in.',
	},
	wetland: {
		damaged: 'A drained marsh of cracked mud and dry channels. Without standing water, the whole chain — insects, fish, frogs, the birds that hunt them — has nowhere to begin.',
		recovering: 'Water is back in the channels and the reeds are rising. Frogs, dragonflies, and striders arrive first; herons follow the frogs into the shallows.',
		thriving: 'A loud, wet marsh. Otters and mink work the banks, turtles bask on the logs, and a beaver’s pond holds the whole place together.',
		restored: 'A complete wetland — crane to minnow. It filters everything downstream of it, quiet unpaid work that the whole watershed depends on.',
		coexistence: 'The beaver builds the habitat everyone else needs: its dam makes the deep, still water that otters hunt and herons stalk.',
	},
	desert: {
		damaged: 'An overgrazed flat with no brush and no burrows. With nowhere to escape the heat, even the hardiest animals stay away.',
		recovering: 'Cactus and brush are taking hold, and the first burrows give shade a place to start. Kangaroo rats and lizards venture out at dusk.',
		thriving: 'Life that knows how to wait out the sun. Tortoises dig, owls move into the spare burrows, and a coyote can finally make a living here.',
		restored: 'The hardest country in the preserve, fully alive — elf owl in the cactus, tarantula under the stone. You can’t flood a desert back; you have to shade it back.',
		coexistence: 'In the desert nobody wastes a hole — a tortoise digs a burrow and a burrowing owl moves into the spare room beneath the brush.',
	},
	alpine: {
		damaged: 'A trampled alpine slope, the wildflower turf worn through to bare talus. Up here recovery is measured in decades, not seasons.',
		recovering: 'Turf is knitting back over the rock. Pikas haul hay into the talus, marmots sun on the boulders, and rosy-finches work the snowmelt edges.',
		thriving: 'A living high country. Goats and bighorn pick the cliffs, trout hold in the snowmelt pools, and an eagle circles the ridge.',
		restored: 'The whole range restored against the wind — goat to ptarmigan to trout. Thin air, short summers, and yet a full web holds on up here.',
		coexistence: 'When the eagle circles the ridge, the marmots whistle and the whole slope goes still — the alarm that ties the high country together.',
	},
	coastal: {
		damaged: 'A scoured shore of washed-out dunes and empty tidepools. Without the anchoring dune grass and the kelp wrack, the tide has nothing to feed.',
		recovering: 'Dunes are anchoring and the tidepools are filling — crabs, anemones, mussels. Gulls and plovers work the wrack line again.',
		thriving: 'A living edge. Sea stars patrol the rock, otters raft offshore, and pelicans dive the surf where the fish have returned.',
		restored: 'The wildest stretch of the preserve, whole — whale-spout to clam-siphon. Two keystones do the quiet work that holds it all in balance.',
		coexistence: 'Two keystones run this shore: the sea star keeps mussels from taking every rock, and the otter eats the urchins that would otherwise mow down the kelp.',
	},
};

export function loreStage(health: number): keyof Omit<BiomeLore, 'coexistence'> {
	if (health >= 100) return 'restored';
	if (health >= 61) return 'thriving';
	if (health >= 26) return 'recovering';
	return 'damaged';
}
