// Staged biome lore + a coexistence note, shown in the Preserve panel. Pure
// display flavor (no server state), so it lives client-side. The stage is
// chosen by the biome's current health, so the world tells its own recovery
// story as you restore it — and each `coexistence` line names a real
// who-needs-whom relationship from the animal data.
//
// The prose lives in the catalog (narrative.lore.<biome>.<stage>); this stays a
// thin lookup that resolves each field through t() so consumers can keep reading
// BIOME_LORE[id][stage] and BIOME_LORE[id].coexistence unchanged.

import { t } from '../i18n';

export interface BiomeLore {
	damaged: string; // 0–25%
	recovering: string; // 26–60%
	thriving: string; // 61–99%
	restored: string; // 100%
	coexistence: string;
}

const BIOME_IDS = ['meadow', 'forest', 'wetland', 'desert', 'alpine', 'coastal'] as const;
const LORE_STAGES = ['damaged', 'recovering', 'thriving', 'restored', 'coexistence'] as const;

/** Build a live BiomeLore whose fields resolve through t() at read time. */
function loreFor(biome: string): BiomeLore {
	const out = {} as BiomeLore;
	for (const stage of LORE_STAGES) {
		Object.defineProperty(out, stage, {
			enumerable: true,
			get: () => t(`narrative.lore.${biome}.${stage}`),
		});
	}
	return out;
}

export const BIOME_LORE: Record<string, BiomeLore> = Object.fromEntries(BIOME_IDS.map((id) => [id, loreFor(id)]));

export function loreStage(health: number): keyof Omit<BiomeLore, 'coexistence'> {
	if (health >= 100) return 'restored';
	if (health >= 61) return 'thriving';
	if (health >= 26) return 'recovering';
	return 'damaged';
}
