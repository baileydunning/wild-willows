'use strict';

/**
 * Are we running on a Steam Deck (or anything else running SteamOS)?
 *
 * Steam puts SteamDeck=1 in the environment of what it launches on a Deck, and
 * that covers both a Steam build and the AppImage added as a non-Steam game.
 * SteamOS's own os-release is the fallback, for launches from Desktop Mode.
 * Decided once, before the app is ready, because the display scale switch in
 * main.js has to be appended that early.
 */

const fs = require('node:fs');

let cached = null;

function isSteamDeck() {
	if (cached !== null) return cached;
	cached = process.env.SteamDeck === '1';
	if (!cached && process.platform === 'linux') {
		try {
			cached = /^ID=steamos$/m.test(fs.readFileSync('/etc/os-release', 'utf8'));
		} catch {
			cached = false;
		}
	}
	return cached;
}

module.exports = { isSteamDeck };
