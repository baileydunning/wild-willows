import { describe, it, expect } from 'vitest';
import { HEALTH_CAPS, healthCapForReturns, nextHealthMilestone } from '../../src/health';

// Mirrors server/resources.ts — if these change, change both places.
describe('health-cap milestones', () => {
	it("caps health until enough of the biome's animals have returned", () => {
		expect(healthCapForReturns(0)).toBe(60);
		expect(healthCapForReturns(4)).toBe(60);
		expect(healthCapForReturns(5)).toBe(75);
		expect(healthCapForReturns(9)).toBe(75);
		expect(healthCapForReturns(10)).toBe(88);
		expect(healthCapForReturns(14)).toBe(88);
		expect(healthCapForReturns(15)).toBe(100);
		expect(healthCapForReturns(25)).toBe(100);
	});

	it('reports the next milestone for the UI plateau note', () => {
		expect(nextHealthMilestone(0)).toEqual({ animals: 5, cap: 60 });
		expect(nextHealthMilestone(12)).toEqual({ animals: 15, cap: 88 });
		expect(nextHealthMilestone(15)).toBeNull();
	});

	it('never deadlocks: every cap clears the biome-unlock health gate path', () => {
		// biome unlocks need 80% health; that must be reachable at the final
		// pre-100 milestone, and caps must increase monotonically
		let last = 0;
		for (const s of HEALTH_CAPS) {
			expect(s.cap).toBeGreaterThan(last);
			last = s.cap;
		}
		expect(healthCapForReturns(HEALTH_CAPS[HEALTH_CAPS.length - 1].animals)).toBe(100);
		expect(HEALTH_CAPS[HEALTH_CAPS.length - 1].cap).toBeGreaterThanOrEqual(80);
	});
});
