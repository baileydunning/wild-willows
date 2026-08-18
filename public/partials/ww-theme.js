/* Wild Willows — light/dark toggle for the classroom pages.
 *
 * MUST be inlined in <head>, before any markup. The attribute has to be on
 * <html> before the first paint, or a student who chose dark gets a full-page
 * flash of cream on every navigation — which is worse than not offering the
 * setting at all.
 *
 * Same convention as the game (src/prefs.ts): the stored preference may be
 * absent (follow the system) or the literal 'light' / 'dark', and what lands on
 * the element is ALWAYS one of the two literals. The stylesheet therefore never
 * has to know that 'system' exists — see ww-dark.css.
 *
 * Kept separate from ww-builder.js because the lesson page needs the toggle too
 * and does not need any of the builder's machinery.
 */
(function () {
	'use strict';

	var KEY = 'wildWillowsTheme';
	var root = document.documentElement;

	function stored() {
		try {
			var v = localStorage.getItem(KEY);
			return v === 'light' || v === 'dark' ? v : null;
		} catch (e) {
			/* Private mode, or a locked-down managed profile. Not being able to
			 * REMEMBER the choice must not stop them making it for this session. */
			return null;
		}
	}

	var systemDark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

	function resolve() {
		return stored() || (systemDark && systemDark.matches ? 'dark' : 'light');
	}

	function apply(theme) {
		root.setAttribute('data-theme', theme);
	}

	// Runs immediately, at parse time, ahead of <body>. This line is the reason
	// this file is in the head and not with the others at the end of the page.
	apply(resolve());

	/* A student who has never touched the toggle should follow the OS as it
	 * changes — sunset, or a school-managed policy flipping at a set hour. Once
	 * they have chosen, their choice wins and this stops mattering. */
	if (systemDark && systemDark.addEventListener) {
		systemDark.addEventListener('change', function () {
			if (!stored()) apply(resolve());
		});
	}

	function wire() {
		var btn = document.getElementById('theme-toggle');
		if (!btn) return;

		function label() {
			var dark = root.getAttribute('data-theme') === 'dark';
			// The control describes what pressing it will DO. "Dark mode: on" reads
			// as a state and leaves people guessing what the click does.
			btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
			btn.setAttribute('title', dark ? 'Switch to light mode' : 'Switch to dark mode');
			btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
		}

		btn.addEventListener('click', function () {
			var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
			apply(next);
			try {
				localStorage.setItem(KEY, next);
			} catch (e) {
				/* see stored() — the session still gets the theme they asked for */
			}
			label();
			try {
				document.dispatchEvent(new CustomEvent('ww:metric', { bubbles: true, detail: { key: 'theme_' + next } }));
			} catch (e) {
				/* analytics never gets to break a lesson in progress */
			}
		});

		label();
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
	else wire();
})();
