'use strict';

/**
 * Solo save-slot storage for the desktop build — the durable half of it.
 *
 * Player progress is the highest-value state this app holds: it is authored over
 * many hours, it exists in exactly one place (there is no server copy for solo —
 * see the top of electron/main.js), and losing it is unrecoverable. So the write
 * path here is deliberately more careful than `fs.writeFileSync` on the slot.
 *
 * WHY NOT writeFileSync(slot, contents)
 * -------------------------------------
 * `writeFileSync` opens the real save with O_TRUNC and then streams bytes into
 * it. Between the truncate and the last byte the player's save on disk is a
 * PREFIX of the new save — and a save is megabytes of JSON (src/solo/saves.ts
 * says as much), so that window is not theoretical. A crash, a power cut, a
 * force-quit, or the OS reclaiming a laptop mid-write leaves a file that parses
 * as nothing. The old save is already gone; there is nothing to fall back to.
 * Autosave fires after actions, so this window is entered constantly.
 *
 * THE WRITE PATH
 * --------------
 *   1. Write the new contents to `<slot>.json.tmp`, then fsync THE FILE. fsync is
 *      the part that matters: without it the bytes may still be in the page cache
 *      when step 3 makes the rename visible, and a crash can surface a renamed
 *      file with unwritten contents.
 *   2. rename(`<slot>.json` -> `<slot>.json.bak`). rename(2) is atomic within a
 *      filesystem, so the previous COMPLETE save is preserved under one name or
 *      the other at every instant. This rotates rather than copies: a copy would
 *      duplicate megabytes on every autosave.
 *   3. rename(`<slot>.json.tmp` -> `<slot>.json`). Also atomic. Readers see
 *      either the whole old save or the whole new one, never a prefix.
 *   4. fsync the DIRECTORY, so the renames themselves are durable and not just
 *      the file contents. Best-effort: Windows cannot fsync a directory handle.
 *
 * Crash windows, and what survives each:
 *   - during 1        -> `<slot>.json` untouched. A stale `.tmp` is overwritten
 *                        by the next write.
 *   - between 2 and 3 -> `<slot>.json` is briefly absent; `.bak` holds the last
 *                        complete save and `.tmp` holds the new one. readSlot()
 *                        finds `.tmp` valid and promotes it, so even here the
 *                        newest complete save is what the player gets back.
 *   - during/after 3  -> `<slot>.json` is the new save. Done.
 *
 * THE READ PATH
 * -------------
 * readSlot() walks `<slot>.json` -> `<slot>.json.tmp` -> `<slot>.json.bak` and
 * returns the first candidate that is non-empty and parses as JSON. Primary is
 * tried first on purpose: if primary is valid, a leftover `.tmp` is an
 * UNCOMMITTED write (we crashed before step 2), and honouring it would resurrect
 * a save the write path never promised. `.tmp` only wins when primary is missing
 * or unreadable, which is exactly the 2-3 window above.
 *
 * When a fallback wins, it is immediately written back through the same atomic
 * path so the slot is left healthy. Without that heal, the NEXT write would
 * rotate the corrupt primary over the good `.bak` (step 2 is unconditional) and
 * throw away the only intact copy. Recovery is reported through the `onRecover`
 * hook so the renderer can file a save incident (src/solo/saveIncident.ts).
 *
 * This module deliberately does NOT require('electron'): it is plain Node fs
 * against a directory path, so tests/unit/desktop-saves.test.ts can drive the
 * real code against a temp dir. main.js supplies app.getPath('userData').
 */

const fs = require('node:fs');
const path = require('node:path');

/** Slot ids become filenames, so they are restricted to a safe alphabet. */
function safeSlotId(slotId) {
	return String(slotId).replace(/[^a-zA-Z0-9_-]/g, '');
}

/** True when `text` is a non-empty, fully-parseable JSON document. */
function isCompleteJson(text) {
	if (typeof text !== 'string' || text.length === 0) return false;
	try {
		JSON.parse(text);
		return true;
	} catch {
		// A truncated write fails here, which is the whole point: JSON has no
		// valid proper prefix, so parseability stands in for completeness.
		return false;
	}
}

/** fsync a directory so a rename is durable. Not supported everywhere. */
function fsyncDir(dir) {
	let fd;
	try {
		fd = fs.openSync(dir, 'r');
		fs.fsyncSync(fd);
	} catch {
		// Windows cannot open a directory for fsync (EPERM/EISDIR), and some
		// filesystems reject it. The renames still happened; only the ordering
		// guarantee is weaker. Not worth failing a save over.
	} finally {
		if (fd !== undefined) {
			try {
				fs.closeSync(fd);
			} catch {
				/* already closed */
			}
		}
	}
}

/**
 * Create a save store rooted at `dir`.
 *
 * @param {string} dir            directory that holds the slot files
 * @param {object} [opts]
 * @param {(info: {slotId: string, from: 'tmp'|'bak'}) => void} [opts.onRecover]
 *        called when a read fell back to a backup instead of the primary file
 * @param {(...args: unknown[]) => void} [opts.log]
 */
function createSaveStore(dir, opts = {}) {
	const onRecover = opts.onRecover || (() => {});
	const log = opts.log || (() => {});

	function ensureDir() {
		fs.mkdirSync(dir, { recursive: true });
		return dir;
	}

	const slotPath = (slotId) => path.join(ensureDir(), `${safeSlotId(slotId)}.json`);
	const tmpPath = (slotId) => `${slotPath(slotId)}.tmp`;
	const bakPath = (slotId) => `${slotPath(slotId)}.bak`;

	function readIfComplete(file) {
		try {
			const text = fs.readFileSync(file, 'utf8');
			return isCompleteJson(text) ? text : null;
		} catch {
			return null; // missing, or unreadable — same outcome for the caller
		}
	}

	/** Write `contents` to `file` and flush it to the platter before returning. */
	function writeSynced(file, contents) {
		const fd = fs.openSync(file, 'w');
		try {
			fs.writeFileSync(fd, contents, 'utf8');
			fs.fsyncSync(fd);
		} finally {
			fs.closeSync(fd);
		}
	}

	/** List slot ids. `.tmp`/`.bak` are not slots and must never show in the menu. */
	function listSlots() {
		try {
			return fs
				.readdirSync(ensureDir())
				.filter((f) => f.endsWith('.json'))
				.map((f) => f.slice(0, -'.json'.length));
		} catch {
			return [];
		}
	}

	/** Atomically replace the slot's contents. Throws only if the new save could not be written. */
	function writeSlot(slotId, contents) {
		if (!safeSlotId(slotId)) throw new Error('writeSlot: empty slot id');
		const primary = slotPath(slotId);
		const tmp = tmpPath(slotId);
		const bak = bakPath(slotId);

		// 1. the new save, fully on disk, under a name nothing reads as the save
		writeSynced(tmp, String(contents));

		// 2. rotate the previous save to .bak (atomic; replaces any older .bak)
		try {
			fs.renameSync(primary, bak);
		} catch (err) {
			// ENOENT is the normal first-write case. Anything else is worth
			// knowing about, but it must not stop the new save from landing.
			if (err && err.code !== 'ENOENT') log('[saves] could not rotate backup:', err.message);
		}

		// 3. publish the new save (atomic)
		fs.renameSync(tmp, primary);

		// 4. make the renames themselves durable
		fsyncDir(dir);
	}

	/**
	 * Read a slot, falling back to the uncommitted write and then the backup.
	 * Returns the JSON text, or null when nothing readable exists.
	 */
	function readSlot(slotId) {
		const primary = readIfComplete(slotPath(slotId));
		if (primary !== null) return primary;

		for (const from of ['tmp', 'bak']) {
			const file = from === 'tmp' ? tmpPath(slotId) : bakPath(slotId);
			const text = readIfComplete(file);
			if (text === null) continue;

			log(`[saves] slot ${safeSlotId(slotId)}: primary unreadable, recovered from .${from}`);
			// Heal the slot now. If this throws we still hand back the recovered
			// text — a readable save the player can keep playing beats an error.
			try {
				writeSlot(slotId, text);
			} catch (err) {
				log('[saves] recovery write-back failed:', err && err.message);
			}
			try {
				onRecover({ slotId: safeSlotId(slotId), from });
			} catch {
				/* a telemetry hook must never break a load */
			}
			return text;
		}
		return null;
	}

	/** Delete a slot and both of its shadow files. */
	function removeSlot(slotId) {
		for (const file of [slotPath(slotId), tmpPath(slotId), bakPath(slotId)]) {
			try {
				fs.unlinkSync(file);
			} catch {
				/* already gone */
			}
		}
		fsyncDir(dir);
	}

	return { dir, listSlots, readSlot, writeSlot, removeSlot, slotPath, tmpPath, bakPath };
}

module.exports = { createSaveStore, safeSlotId, isCompleteJson };
