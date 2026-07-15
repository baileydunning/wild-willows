// Health-cap milestones, mirrored from the server (server/resources.ts).
// Harper is the source of truth — recalcBiome clamps the stored health — this
// mirror only lets the UI explain WHY a health bar has plateaued.
//
// A biome's health can't outrun its returned life: placements alone used to
// push health to 40-50% with only 1-2 of 25 animals back (playtest), so health
// now plateaus at each cap until enough of the biome's own animals are home.

export const HEALTH_CAPS: { animals: number; cap: number }[] = [
	{ animals: 5, cap: 60 },
	{ animals: 10, cap: 75 },
	{ animals: 15, cap: 88 },
];

/** The max health a biome can reach with this many of its animals returned. */
export function healthCapForReturns(returnedInBiome: number): number {
	for (const step of HEALTH_CAPS) {
		if (returnedInBiome < step.animals) return step.cap;
	}
	return 100;
}

/** The next milestone still ahead, or null once past the last one. */
export function nextHealthMilestone(returnedInBiome: number): { animals: number; cap: number } | null {
	for (const step of HEALTH_CAPS) {
		if (returnedInBiome < step.animals) return step;
	}
	return null;
}
