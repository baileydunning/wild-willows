import type { AnimalDef } from '../types';

/**
 * How much work an animal still is, for ordering the entries nobody has found
 * yet. Restoration health is the spine of the requirement set and is what the
 * player is actually pushing on, so it leads outright — everything else is
 * capped below a single point of health and only separates ties. This is a
 * rough ordering, not a promise: two animals wanting the same things can still
 * land in either order, and that is fine.
 */
export function effort(a: AnimalDef): number {
	const r = a.requirements || ({} as AnimalDef['requirements']);
	const objects = Object.values(r.objects || {}).reduce((n, c) => n + (c || 0), 0);
	const animals = (r.animals || []).length;
	const conditions = r.conditions ? 1 : 0;
	// Everything other than health is capped below one point of health, so no
	// pile of small requirements can ever lift an animal past one gated higher.
	const rest = Math.min(99, (r.minBalance || 0) + objects * 2 + animals * 3 + conditions);
	return (r.minHealth || 0) * 100 + rest;
}
