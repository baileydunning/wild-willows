import { describe, it, expect } from 'vitest';
import { STORY_PLATES, figureUri } from '../../src/ui/storyArt';

describe('tmp: plates actually render', () => {
	it('produces a picture for every figure', () => {
		for (const [id, plate] of Object.entries(STORY_PLATES)) {
			for (const fig of plate.figures) {
				const uri = figureUri(fig as any);
				expect(uri, `${id} → ${JSON.stringify(fig)}`).toBeTruthy();
				expect(uri!.startsWith('data:image/svg+xml')).toBe(true);
				expect(uri!.length, `${id} → ${JSON.stringify(fig)} is suspiciously tiny`).toBeGreaterThan(300);
			}
		}
	});
});
