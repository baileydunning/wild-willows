// Atomic slot writes + backup recovery for the desktop shell (electron/saves.js).
//
// These drive the REAL module against a temp directory rather than a mock fs.
// The whole point of the module is what survives a crash mid-write, and a mock
// that "fails the write" proves nothing about rename/fsync ordering — so the
// tests reconstruct the on-disk states a crash can actually leave behind
// (a truncated primary, a leftover .tmp, a stale .bak) and assert what a
// subsequent read hands back.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
const { createSaveStore, safeSlotId, isCompleteJson } = require_('../../electron/saves.js') as {
	createSaveStore: (
		dir: string,
		opts?: { onRecover?: (i: { slotId: string; from: 'tmp' | 'bak' }) => void; log?: (...a: unknown[]) => void },
	) => {
		dir: string;
		listSlots(): string[];
		readSlot(id: string): string | null;
		writeSlot(id: string, contents: string): void;
		removeSlot(id: string): void;
		slotPath(id: string): string;
		tmpPath(id: string): string;
		bakPath(id: string): string;
	};
	safeSlotId: (id: unknown) => string;
	isCompleteJson: (text: unknown) => boolean;
};

let dir: string;
const save = (n: number) => JSON.stringify({ meta: { slotId: 'a', updatedAt: n }, data: { Player: [{ id: n }] } });

beforeEach(() => {
	dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ww-saves-'));
});
afterEach(() => {
	fs.rmSync(dir, { recursive: true, force: true });
});

describe('slot ids', () => {
	it('strips anything that is not filename-safe', () => {
		expect(safeSlotId('../../etc/passwd')).toBe('etcpasswd');
		expect(safeSlotId('slot-1_A')).toBe('slot-1_A');
	});

	it('refuses a write whose id sanitizes to nothing', () => {
		const store = createSaveStore(dir);
		expect(() => store.writeSlot('///', save(1))).toThrow(/empty slot id/);
	});
});

describe('completeness check', () => {
	it('rejects a truncated document', () => {
		const whole = save(1);
		expect(isCompleteJson(whole)).toBe(true);
		expect(isCompleteJson(whole.slice(0, whole.length - 5))).toBe(false);
		expect(isCompleteJson('')).toBe(false);
	});
});

describe('writeSlot', () => {
	it('round-trips and leaves no temp file behind', () => {
		const store = createSaveStore(dir);
		store.writeSlot('slot1', save(1));
		expect(store.readSlot('slot1')).toBe(save(1));
		expect(fs.existsSync(store.tmpPath('slot1'))).toBe(false);
	});

	it('keeps the previous save as .bak on the next write', () => {
		const store = createSaveStore(dir);
		store.writeSlot('slot1', save(1));
		store.writeSlot('slot1', save(2));
		expect(store.readSlot('slot1')).toBe(save(2));
		expect(fs.readFileSync(store.bakPath('slot1'), 'utf8')).toBe(save(1));
	});

	it('never lists .tmp or .bak as slots', () => {
		const store = createSaveStore(dir);
		store.writeSlot('slot1', save(1));
		store.writeSlot('slot1', save(2));
		fs.writeFileSync(store.tmpPath('slot1'), save(3));
		expect(store.listSlots()).toEqual(['slot1']);
	});
});

describe('recovery', () => {
	it('falls back to .bak when the primary was truncated mid-write', () => {
		const store = createSaveStore(dir);
		store.writeSlot('slot1', save(1));
		store.writeSlot('slot1', save(2));
		// The failure a non-atomic writeFileSync produces: O_TRUNC landed, the
		// bytes did not.
		const partial = save(3);
		fs.writeFileSync(store.slotPath('slot1'), partial.slice(0, 20));

		expect(store.readSlot('slot1')).toBe(save(1));
	});

	it('prefers a valid .tmp over .bak — that is the newer save', () => {
		const store = createSaveStore(dir);
		store.writeSlot('slot1', save(1));
		store.writeSlot('slot1', save(2));
		// Crash between "rotate primary to .bak" and "rename .tmp into place".
		fs.renameSync(store.slotPath('slot1'), store.bakPath('slot1'));
		fs.writeFileSync(store.tmpPath('slot1'), save(3));

		expect(store.readSlot('slot1')).toBe(save(3));
	});

	it('ignores .tmp when the primary is intact — an uncommitted write is not a save', () => {
		const store = createSaveStore(dir);
		store.writeSlot('slot1', save(1));
		// Crash before the rotate: .tmp is complete but was never published.
		fs.writeFileSync(store.tmpPath('slot1'), save(99));

		expect(store.readSlot('slot1')).toBe(save(1));
	});

	it('heals the slot so the next write cannot eat the good backup', () => {
		const store = createSaveStore(dir);
		store.writeSlot('slot1', save(1));
		store.writeSlot('slot1', save(2));
		fs.writeFileSync(store.slotPath('slot1'), 'not json at all');

		expect(store.readSlot('slot1')).toBe(save(1)); // recovered from .bak
		// Without the write-back, the next write would rotate the CORRUPT primary
		// over the only intact copy.
		expect(fs.readFileSync(store.slotPath('slot1'), 'utf8')).toBe(save(1));
		expect(store.readSlot('slot1')).toBe(save(1));
	});

	it('reports the recovery so it can be sent upstream', () => {
		const seen: Array<{ slotId: string; from: string }> = [];
		const store = createSaveStore(dir, { onRecover: (i) => seen.push(i) });
		store.writeSlot('slot1', save(1));
		store.writeSlot('slot1', save(2));
		fs.writeFileSync(store.slotPath('slot1'), '{"truncated": ');

		store.readSlot('slot1');
		expect(seen).toEqual([{ slotId: 'slot1', from: 'bak' }]);
	});

	it('returns null when nothing readable is left', () => {
		const store = createSaveStore(dir);
		expect(store.readSlot('missing')).toBe(null);
		store.writeSlot('slot1', save(1));
		fs.writeFileSync(store.slotPath('slot1'), 'garbage');
		fs.writeFileSync(store.bakPath('slot1'), 'also garbage');
		expect(store.readSlot('slot1')).toBe(null);
	});
});

describe('removeSlot', () => {
	it('takes the shadow files with it', () => {
		const store = createSaveStore(dir);
		store.writeSlot('slot1', save(1));
		store.writeSlot('slot1', save(2));
		fs.writeFileSync(store.tmpPath('slot1'), save(3));

		store.removeSlot('slot1');
		expect(fs.existsSync(store.slotPath('slot1'))).toBe(false);
		expect(fs.existsSync(store.bakPath('slot1'))).toBe(false);
		expect(fs.existsSync(store.tmpPath('slot1'))).toBe(false);
		expect(store.readSlot('slot1')).toBe(null);
	});
});
