// Hand-drawn SVG icon set + the character preview used in the creator.
// All icons inherit currentColor so they re-tint with the UI.

import React from 'react';
import { hatPalette, flowerPalette } from '../color';
import { bridge } from '../game/bridge';
import type { Appearance } from '../types';

const PATHS: Record<string, React.ReactNode> = {
	'biome-meadow': (
		<>
			<g transform="rotate(0 12 12)">
				<ellipse cx="12" cy="6.4" rx="2" ry="3.1" />
			</g>
			<g transform="rotate(72 12 12)">
				<ellipse cx="12" cy="6.4" rx="2" ry="3.1" />
			</g>
			<g transform="rotate(144 12 12)">
				<ellipse cx="12" cy="6.4" rx="2" ry="3.1" />
			</g>
			<g transform="rotate(216 12 12)">
				<ellipse cx="12" cy="6.4" rx="2" ry="3.1" />
			</g>
			<g transform="rotate(288 12 12)">
				<ellipse cx="12" cy="6.4" rx="2" ry="3.1" />
			</g>
			<circle cx="12" cy="12" r="2.1" />
		</>
	),
	'biome-forest': <path d="M12 2.5 7 10h2.6l-3.2 5.2H10V20h4v-4.8h3.6L14.4 10H17z" />,
	'biome-wetland': (
		<>
			<rect x="7.7" y="3.4" width="3" height="5.4" rx="1.5" />
			<path d="M9.2 21V9" />
			<rect x="13.3" y="2" width="3" height="5.4" rx="1.5" />
			<path d="M14.8 21V7.4" />
			<path d="M9.2 13.5c-1.7-.2-3-1.6-3.2-3.4 1.7.2 3 1.5 3.2 3.4z" />
		</>
	),
	'biome-desert': (
		<>
			<path d="M12 21V4" />
			<path d="M12 12.5H8.6V8.3" />
			<path d="M12 10H15.6V5.6" />
		</>
	),
	'biome-alpine': (
		<>
			<path d="M2.5 20 9 8l3.6 6 2.3-3.4L21.5 20z" />
			<path d="M6.6 13.6 9 9.6l2.2 3.6" />
		</>
	),
	'biome-coastal': (
		<>
			<path d="M2.5 11.5c2.2 0 2.8-2.1 4.9-2.1s2.8 2.1 4.9 2.1 2.8-2.1 4.9-2.1 2.8 2.1 4.4 2.1" />
			<path d="M2.5 16.5c2.2 0 2.8-1.9 4.9-1.9s2.8 1.9 4.9 1.9 2.8-1.9 4.9-1.9 2.8 1.9 4.4 1.9" />
		</>
	),
	basket: (
		<>
			<path d="M4 10h16l-1.6 9a2 2 0 0 1-2 1.7H7.6a2 2 0 0 1-2-1.7L4 10Z" />
			<path d="M8 10c0-4 2-6.5 4-6.5S16 6 16 10" />
			<path d="M9 13.5v3.5M12 13.5v3.5M15 13.5v3.5" />
		</>
	),
	journal: (
		<>
			<path d="M12 6c-2-1.7-4.6-2.2-8-2v14c3.4-.2 6 .3 8 2 2-1.7 4.6-2.2 8-2V4c-3.4-.2-6 .3-8 2Z" />
			<path d="M12 6v14" />
			<path d="M7 9c1.2 0 2 .2 3 .7M7 12.5c1.2 0 2 .2 3 .7" />
		</>
	),
	tools: (
		<>
			<path
				d="M14.5 6.5a4 4 0 0 1 5-5l-2.8 2.8 1 2.5 2.5 1L23 5a4 4 0 0 1-5 5L8.5 19.5a2.1 2.1 0 0 1-3-3L14.5 6.5Z"
				transform="scale(0.92) translate(0.5 0.8)"
			/>
			<circle cx="6.5" cy="18" r="0.4" />
		</>
	),
	map: (
		<>
			<path d="M12 21s-6.5-5.4-6.5-10.2A6.3 6.5 0 0 1 12 4a6.3 6.5 0 0 1 6.5 6.8C18.5 15.6 12 21 12 21Z" />
			<path d="M12 13.5v-3M12 10.5c0-1.5 1-2.5 2.4-2.8M12 10.5c0-1.5-1-2.5-2.4-2.8" />
		</>
	),
	help: (
		<>
			<circle cx="12" cy="12" r="9" />
			<path d="M9.4 9.2A2.8 2.8 0 0 1 12 7.5c1.5 0 2.7 1 2.7 2.3 0 1.8-2.7 2.1-2.7 3.9" />
			<circle cx="12" cy="16.8" r="0.5" fill="currentColor" />
		</>
	),
	globe: (
		<>
			<circle cx="12" cy="12" r="9" />
			<path d="M3 12h18M12 3c2.6 2.6 3.9 5.6 3.9 9s-1.3 6.4-3.9 9c-2.6-2.6-3.9-5.6-3.9-9S9.4 5.6 12 3Z" />
		</>
	),
	close: <path d="M6 6l12 12M18 6L6 18" />,
	eyedropper: (
		<>
			<path d="M15.4 5.2a2.3 2.3 0 0 1 3.4 3.4L9 18.4l-4.2 1.1 1.1-4.2 9.5-10.1Z" />
			<path d="M13.4 7.4l3.2 3.2" />
		</>
	),
	chest: (
		<>
			<rect x="3.5" y="7" width="17" height="12" rx="2" />
			<path d="M3.5 11h17" />
			<rect x="10.5" y="9.5" width="3" height="3.5" rx="0.8" />
		</>
	),
	hammer: (
		<>
			<path d="M10 5.5 12.5 3a5.5 5.5 0 0 1 6 1.2L21 6.7l-1.8 1.8-1-.3-1.2 1.2L10 5.5Z" />
			<path d="m12.8 8.2-9 9a1.8 1.8 0 0 0 2.5 2.5l9-9" />
		</>
	),
	user: (
		<>
			<circle cx="12" cy="8.5" r="4" />
			<path d="M4.5 20c1.4-3.4 4.2-5 7.5-5s6.1 1.6 7.5 5" />
		</>
	),
	lock: (
		<>
			<rect x="5.5" y="10.5" width="13" height="9.5" rx="2" />
			<path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
			<circle cx="12" cy="15" r="1" fill="currentColor" />
		</>
	),
	play: <path d="M8 5.5v13l10-6.5-10-6.5Z" />,
	// A small bloom. Formerly the two-star sparkle glyph, which read as
	// AI-generated; the "sparkle" key is kept so existing references still resolve.
	sparkle: (
		<>
			<g transform="rotate(0 12 12)">
				<ellipse cx="12" cy="7" rx="1.9" ry="2.9" />
			</g>
			<g transform="rotate(72 12 12)">
				<ellipse cx="12" cy="7" rx="1.9" ry="2.9" />
			</g>
			<g transform="rotate(144 12 12)">
				<ellipse cx="12" cy="7" rx="1.9" ry="2.9" />
			</g>
			<g transform="rotate(216 12 12)">
				<ellipse cx="12" cy="7" rx="1.9" ry="2.9" />
			</g>
			<g transform="rotate(288 12 12)">
				<ellipse cx="12" cy="7" rx="1.9" ry="2.9" />
			</g>
			<circle cx="12" cy="12" r="1.7" fill="currentColor" />
		</>
	),
	target: (
		<>
			<circle cx="12" cy="12" r="8.5" />
			<circle cx="12" cy="12" r="4.6" />
			<circle cx="12" cy="12" r="1.2" fill="currentColor" />
		</>
	),
	leaf: (
		<>
			<path d="M5 19C5 9 11 4.5 20 4c.5 9-4 15-13.5 15" />
			<path d="M5 19c2.5-5.5 6-9 11-11.5" />
		</>
	),
	scales: (
		<>
			<path d="M12 4.5v15" />
			<path d="M8.5 20h7" />
			<path d="M5 8h14" />
			<circle cx="12" cy="4.2" r="0.5" fill="currentColor" />
			<path d="M5 8 3 12.5M5 8l2 4.5M3 12.5a2 1.6 0 0 0 4 0" />
			<path d="M19 8l-2 4.5M19 8l2 4.5M17 12.5a2 1.6 0 0 0 4 0" />
		</>
	),
	paw: (
		<>
			<ellipse cx="7" cy="9" rx="1.8" ry="2.4" />
			<ellipse cx="17" cy="9" rx="1.8" ry="2.4" />
			<ellipse cx="11" cy="6.5" rx="1.8" ry="2.4" transform="rotate(-6 11 6.5)" />
			<ellipse cx="14.5" cy="6.7" rx="1.7" ry="2.3" transform="rotate(8 14.5 6.7)" />
			<path d="M12.2 12c2.8 0 5 2 5 4.4 0 1.7-1.3 2.8-3 2.8-1 0-1.5-.4-2-.4s-1 .4-2 .4c-1.7 0-3-1.1-3-2.8 0-2.4 2.2-4.4 5-4.4Z" />
		</>
	),
	home: (
		<>
			<path d="M4 11.5 12 4l8 7.5" />
			<path d="M6 10v9.5h12V10" />
			<path d="M10 19.5v-5h4v5" />
		</>
	),
	logout: (
		<>
			<path d="M14 4H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7" />
			<path d="M11 12h9.5M17.5 8.5 21 12l-3.5 3.5" />
		</>
	),
	cloud: (
		<>
			<path d="M7 18.5a4 4 0 0 1-.6-8A5.4 5.4 0 0 1 17 9.4a4.2 4.2 0 0 1 0 9.1H7Z" />
		</>
	),
	plus: <path d="M12 5v14M5 12h14" />,
	folder: (
		<>
			<path d="M3.5 6.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-11Z" />
		</>
	),
	back: <path d="M14.5 5.5 8 12l6.5 6.5" />,
	forward: <path d="M9.5 5.5 16 12l-6.5 6.5" />,
	download: (
		<>
			<path d="M12 4v10M8 10.5l4 4 4-4" />
			<path d="M5 19h14" />
		</>
	),
	upload: (
		<>
			<path d="M12 15V5M8 8.5l4-4 4 4" />
			<path d="M5 19h14" />
		</>
	),
	check: <path d="M5 12.5 10 17.5 19 7" />,
	drop: <path d="M12 3.5C15 8 18 11 18 14.5a6 6 0 1 1-12 0C6 11 9 8 12 3.5Z" />,
	sun: (
		<>
			<circle cx="12" cy="12" r="4" />
			<path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.2 5.2 7 7M17 17l1.8 1.8M18.8 5.2 17 7M7 17l-1.8 1.8" />
		</>
	),
	/* Companions to `sun` for the Settings → Appearance picker. The crescent is one
	   closed outline rather than a disc minus a disc, so it strokes cleanly at the
	   15px the picker draws it at, like every other glyph here. */
	moon: <path d="M20 14.2A8.4 8.4 0 0 1 9.6 3.9a8.5 8.5 0 1 0 10.4 10.3Z" />,
	monitor: (
		<>
			<rect x="2.8" y="4.2" width="18.4" height="12.4" rx="2" />
			<path d="M9 20.2h6M12 16.6v3.6" />
		</>
	),
	pin: (
		<>
			<path d="M12 21s-6.5-5.4-6.5-10.2A6.3 6.5 0 0 1 12 4a6.3 6.5 0 0 1 6.5 6.8C18.5 15.6 12 21 12 21Z" />
			<circle cx="12" cy="10.8" r="2.2" />
		</>
	),
	keyboard: (
		<>
			<rect x="2.5" y="7" width="19" height="11" rx="2" />
			<path d="M6 10.5h.01M9.5 10.5h.01M13 10.5h.01M16.5 10.5h.01M6 14h.01M16.5 14h.01M9 14h6" />
		</>
	),
	spade: (
		<>
			<path d="M12 2.5v9" />
			<path d="M9.5 2.5h5" />
			<path d="M7.5 11.5h9v4.5a4.5 4.5 0 0 1-9 0v-4.5Z" />
			<path d="M12 16v5" />
		</>
	),
	axe: (
		<>
			<path d="M12.5 7.5 6 21" />
			<path d="M10 4.5c3-2.5 7-2.5 10 0-1 3.5-3.5 5.5-7.5 5.5L10 7.5v-3Z" />
		</>
	),
	can: (
		<>
			<rect x="7" y="9" width="11" height="10" rx="2.5" />
			<path d="M7 13 2.8 16.6M2.8 16.6l-0.6-2.2M2.8 16.6l2.2.4" />
			<path d="M18 11.5l3-3" />
			<circle cx="12.5" cy="6.5" r="3" />
		</>
	),
	walk: (
		<>
			<circle cx="13" cy="4.5" r="2" />
			<path d="M13 7.5 10 11l1 4.5-3 5M13 7.5l3 3 3.5 1M11 15.5 15 17l1.5 4" />
		</>
	),
	gear: (
		<>
			<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
			<circle cx="12" cy="12" r="3" />
		</>
	),
	chat: (
		<>
			<path d="M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-9l-5 4v-4H4A1.5 1.5 0 0 1 2.5 16V7A1.5 1.5 0 0 1 4 5.5Z" />
			<path d="M7 10h10M7 13.5h6" />
		</>
	),
	trash: (
		<>
			<path d="M4.5 6.5h15M9.5 6.5V4.8a1.3 1.3 0 0 1 1.3-1.3h2.4a1.3 1.3 0 0 1 1.3 1.3v1.7" />
			<path d="M6.5 6.5 7.4 19a1.8 1.8 0 0 0 1.8 1.7h5.6a1.8 1.8 0 0 0 1.8-1.7l.9-12.5" />
			<path d="M10 10.5v6M14 10.5v6" />
		</>
	),
	star: <path d="M12 3.5 14.6 9.2 21 10 16.3 14.3 17.6 20.5 12 17.3 6.4 20.5 7.7 14.3 3 10 9.4 9.2Z" />,
	paint: (
		<>
			{/* wooden handle */}
			<path d="M19.4 3.2 L20.8 4.6 L13.9 11.5 L12.5 10.1 Z" fill="currentColor" />
			{/* metal ferrule + filled bristle head dipping to a paint tip */}
			<path
				d="M12.5 10.1 L13.9 11.5 L10.1 15.3 a3.4 3.4 0 0 1 -2.3 1 L5.6 16.4 L5.7 14.5 a3.4 3.4 0 0 1 1 -2.3 Z"
				fill="currentColor"
			/>
			{/* a little painted swoosh under the brush */}
			<path d="M4.4 18.8 c1.5 1.1 3.2 1.1 4.6 -0.1" />
		</>
	),
	sliders: (
		<>
			<path d="M4 7h8M16 7h4M4 12h4M12 12h8M4 17h10M18 17h2" />
			<circle cx="14" cy="7" r="2" />
			<circle cx="10" cy="12" r="2" />
			<circle cx="16" cy="17" r="2" />
		</>
	),

	// ---- achievement glyphs (one per achievement; rendered inside a star badge) ----
	'ach-grasshopper': (
		<>
			<path d="M4 13c4-1.5 8-1.5 12 0" />
			<path d="M16 13c2 0 3-1 3-3" />
			<path d="M7 13l-3 6M10 13l1 6" />
			<path d="M16 10l3-3" />
		</>
	),
	'ach-gather-hand': (
		<>
			<path d="M4 16c0-3.5 3.5-5.5 8-5.5s8 2 8 5.5" />
			<circle cx="9" cy="8.5" r="1" fill="currentColor" />
			<circle cx="12" cy="7.5" r="1" fill="currentColor" />
			<circle cx="15" cy="8.5" r="1" fill="currentColor" />
		</>
	),
	'ach-mallet': (
		<>
			<path d="M4 20 13 11" />
			<rect x="11" y="4" width="8" height="5.5" rx="1" transform="rotate(45 15 6.75)" />
		</>
	),
	'ach-sprout-thumb': (
		<>
			<path d="M12 21v-8" />
			<path d="M12 13c-3.5 0-5.5-2-5.5-5.5 3.5 0 5.5 2 5.5 5.5Z" />
			<path d="M12 14c2.5 0 4.5-2 4.5-4.5-2.5 0-4.5 2-4.5 4.5Z" />
		</>
	),
	'ach-droplet-ripple': (
		<>
			<path d="M12 3.5c2.5 3.5 4.5 5.5 4.5 8a4.5 4.5 0 1 1-9 0c0-2.5 2-4.5 4.5-8Z" />
			<path d="M4 19c2.5 1.5 13.5 1.5 16 0" />
		</>
	),
	'ach-wildflower': (
		<>
			<circle cx="12" cy="8" r="2.2" />
			<circle cx="12" cy="4" r="1.6" />
			<circle cx="8" cy="8" r="1.6" />
			<circle cx="16" cy="8" r="1.6" />
			<circle cx="9.4" cy="11.5" r="1.6" />
			<circle cx="14.6" cy="11.5" r="1.6" />
			<path d="M12 13v8" />
			<path d="M12 17c-2.5 0-3.5-1.5-3.5-3 2 0 3.5 1 3.5 3Z" />
		</>
	),
	'ach-butterfly': (
		<>
			<path d="M12 6v12" />
			<path d="M12 9C9 5 4 5 4 9s4 5.5 8 3" />
			<path d="M12 9c3-4 8-4 8 0s-4 5.5-8 3" />
			<path d="M12 13c-2 4-6 4-7.5 1.5M12 13c2 4 6 4 7.5 1.5" />
		</>
	),
	'ach-fox-head': (
		<>
			<path d="M5 6.5 7.5 11M19 6.5 16.5 11" />
			<path d="M7.5 8.5C7.5 15 10 18 12 18s4.5-3 4.5-9.5" />
			<path d="M7.5 8.5 12 6l4.5 2.5" />
			<circle cx="10" cy="11" r="0.7" fill="currentColor" />
			<circle cx="14" cy="11" r="0.7" fill="currentColor" />
		</>
	),
	'ach-grass-tuft': (
		<>
			<path d="M6 20c-1.5-5 0-8.5 1.5-11" />
			<path d="M10.5 20c-1-6 .5-9.5 2-12.5" />
			<path d="M14 20c0-5 1-8.5 2.5-10.5" />
			<path d="M18 20c-1-4-2.5-6-3.5-7.5" />
		</>
	),
	'ach-meadow-sun': (
		<>
			<circle cx="12" cy="9" r="3.3" />
			<path d="M12 3.2v1.6M5 9h1.6M17.4 9H19M6.2 5l1.1 1.1M17.8 5l-1.1 1.1" />
			<path d="M4 19c3-2 13-2 16 0" />
		</>
	),
	'ach-fern': (
		<>
			<path d="M7 20C7 11 11 6 17.5 5" />
			<path d="M9 16c1-2 2.2-3 4-3.6M11 12c1-1.6 2.2-2.6 4-3.1M13 9c1-1 2-1.6 3-2" />
		</>
	),
	'ach-tree-hollow': (
		<>
			<path d="M8 21V6a4 4 0 0 1 8 0v15" />
			<ellipse cx="12" cy="11" rx="2" ry="3" />
		</>
	),
	'ach-owl-moon': (
		<>
			<circle cx="10" cy="12.5" r="6" />
			<circle cx="8" cy="11.5" r="1.3" />
			<circle cx="12" cy="11.5" r="1.3" />
			<path d="M10 14l1 1.3" />
			<path d="M18.5 4.5a3.6 3.6 0 1 0 1.2 6.4 4.4 4.4 0 0 1-1.2-6.4Z" />
		</>
	),
	'ach-conifer': (
		<>
			<path d="M12 3 6 12h12L12 3Z" />
			<path d="M8 12 12 18.5 16 12" />
			<path d="M12 18.5V21" />
		</>
	),
	'ach-three-trees': (
		<>
			<path d="M5 19v-3.5M3 15.5h4l-2-4-2 4Z" />
			<path d="M12 20.5v-6M9 14.5h6l-3-6-3 6Z" />
			<path d="M19 19v-3.5M17 15.5h4l-2-4-2 4Z" />
		</>
	),
	'ach-cattail': (
		<>
			<path d="M10 21V5" />
			<rect x="8.4" y="3.5" width="3.2" height="6.5" rx="1.6" />
			<path d="M10 11c2.5 0 4.5-1 6-3.5" />
			<path d="M4 19c3 1 9 1 12-1" />
		</>
	),
	'ach-beaver-dam': (
		<>
			<path d="M4 14 20 10M4 10 20 14" />
			<path d="M3 18c3 1.2 15 1.2 18 0" />
		</>
	),
	'ach-lake': (
		<>
			<path d="M3 9.5c4-2 14-2 18 0" />
			<path d="M4 14c4-1.5 12-1.5 16 0" />
			<path d="M5 18.5c3-1 11-1 14 0" />
		</>
	),
	'ach-heron': (
		<>
			<path d="M7 5c.5 3.5 1 5.5 3.5 6.5" />
			<path d="M10.5 11.5 16 10" />
			<path d="M10.5 11.5v6M10.5 17.5l-2 3M10.5 17.5l2 3" />
			<path d="M7 5 4.5 4" />
		</>
	),
	'ach-marsh-sun': (
		<>
			<circle cx="16" cy="8" r="3" />
			<path d="M8 19V7.5M11.5 19V10" />
			<path d="M3 19c4 1 14 1 18 0" />
		</>
	),
	'ach-cactus': (
		<>
			<path d="M12 21V7" />
			<path d="M12 13.5H8.2a2 2 0 0 1-2-2V9.5M12 11h3.8a2 2 0 0 0 2-2V7.8" />
			<path d="M9 21h6" />
		</>
	),
	'ach-burrow': (
		<>
			<path d="M3 17.5a9 6.5 0 0 1 18 0" />
			<ellipse cx="12" cy="17.5" rx="3.2" ry="2.3" />
		</>
	),
	'ach-rattlesnake': (
		<>
			<path d="M6 18.5c0-4.5 8-4 8-8.5a3 3 0 0 0-6 0" />
			<path d="M14 10c1-1.2 3-1.2 4.2 0" />
			<path d="M5 18.5l-1.2 2M7.2 18.5l-1.2 2" />
		</>
	),
	'ach-agave': (
		<>
			<path d="M12 20.5 8 6M12 20.5 16 6M12 20.5V5M12 20.5 5 12M12 20.5 19 12" />
		</>
	),
	'ach-desert-sun': (
		<>
			<circle cx="12" cy="8.5" r="3.3" />
			<path d="M12 2.2v1.8M3.4 8.5h1.8M18.8 8.5h1.8M5.7 2.7l1.3 1.3M18.3 2.7 17 4" />
			<path d="M9 20.5v-4M9 17.5h2M15 20.5v-3" />
		</>
	),
	'ach-peak': (
		<>
			<path d="M4 19 12 5l8 14Z" />
			<path d="M9 12.5l3 2 3-3" />
		</>
	),
	'ach-pika': (
		<>
			<circle cx="11" cy="13" r="5" />
			<circle cx="8" cy="9" r="1.6" />
			<circle cx="14" cy="9" r="1.6" />
			<path d="M14 13.5 19.5 11" />
			<circle cx="10.4" cy="13" r="0.6" fill="currentColor" />
		</>
	),
	'ach-eagle': (
		<>
			<path d="M3 9c4 1 7 3 9 6 2-3 5-5 9-6" />
			<path d="M12 15v3.5" />
			<path d="M11 18.5h2" />
		</>
	),
	'ach-alpine-flower': (
		<>
			<circle cx="12" cy="9" r="1.9" />
			<circle cx="12" cy="5.3" r="1.3" />
			<circle cx="8.7" cy="8" r="1.3" />
			<circle cx="15.3" cy="8" r="1.3" />
			<circle cx="9.7" cy="11.4" r="1.3" />
			<circle cx="14.3" cy="11.4" r="1.3" />
			<path d="M12 11v9" />
		</>
	),
	'ach-range': (
		<>
			<path d="M2 19 8 9l4 6 3-5 5 9Z" />
			<path d="M6 12.5l2 1 1.5-1.3" />
		</>
	),
	'ach-wave': (
		<>
			<path d="M3 15.5c4 0 5-6 9-6 3 0 4 3 7 2" />
			<path d="M19 11.5c-1 2-4 3-6 2" />
			<path d="M4 19c4 1 12 1 16 0" />
		</>
	),
	'ach-seastar': (
		<>
			<path d="M12 3 14 9.3 20.5 9.3 15.2 13.2 17.2 19.5 12 15.6 6.8 19.5 8.8 13.2 3.5 9.3 10 9.3Z" />
		</>
	),
	'ach-otter': (
		<>
			<path d="M4 13.5c4-2 12-2 16 0" />
			<ellipse cx="12" cy="11" rx="6" ry="3" />
			<circle cx="8" cy="10" r="0.8" fill="currentColor" />
			<path d="M16 9.5c1-1 2.2-1 3.2 0" />
			<path d="M4 17c4 1 12 1 16 0" />
		</>
	),
	'ach-shell': (
		<>
			<path d="M12 19.5 4 9.5a8 6 0 0 1 16 0Z" />
			<path d="M12 19.5 9 9.5M12 19.5l3-10M12 19.5V8.5" />
		</>
	),
	'ach-pelican': (
		<>
			<path d="M7 5.5c1.5 4 1.5 7.5 5 8.5" />
			<path d="M12 14c4 0 5.5-3 5.5-3l-2 5.5-3.5-2.5Z" />
			<path d="M12 14v5.5" />
		</>
	),
	'ach-full-basket': (
		<>
			<path d="M5 11h14l-1.6 8.5H6.6Z" />
			<path d="M8 11c0-4 1.8-6.5 4-6.5s4 2.5 4 6.5" />
			<circle cx="9.5" cy="8.5" r="1" fill="currentColor" />
			<circle cx="13" cy="7.8" r="1" fill="currentColor" />
			<circle cx="11.2" cy="9.5" r="1" fill="currentColor" />
		</>
	),
	'ach-blueprint': (
		<>
			<path d="M6 4h9l4 4v12H6Z" />
			<path d="M15 4v4h4" />
			<path d="M9 12h6M9 15h4" />
		</>
	),
	'ach-watering-can': (
		<>
			<rect x="7" y="9.5" width="9" height="8" rx="2" />
			<path d="M16 11.5l4-2" />
			<path d="M7 12.5 3 10.5" />
			<path d="M4 19v1.6M7 19v1.6M10 19v1.6" />
		</>
	),
	'ach-spade-water': (
		<>
			<path d="M9 3v6.5M7 3h4M6.5 9.5h5v3a2.5 2.5 0 0 1-5 0ZM9 15v4" />
			<path d="M14 17.5c2 1 4 1 6 0" />
		</>
	),
	'ach-toolbelt': (
		<>
			<path d="M12 20.5 6 7M12 20.5V6M12 20.5 18 7" />
			<circle cx="6" cy="6" r="1.5" />
			<rect x="10.4" y="3.8" width="3.2" height="3.2" rx="0.8" />
			<path d="M16.8 3.8 19 7" />
		</>
	),
	'ach-open-book': (
		<>
			<path d="M12 7C9 5 6 5 4 5v12c2 0 5 0 8 2 3-2 6-2 8-2V5c-2 0-5 0-8 2Z" />
			<path d="M12 7v12" />
			<path d="M12 11c1-1 2-1.4 3.2-1.4" />
		</>
	),
	'ach-recipe-stack': (
		<>
			<rect x="5" y="8" width="14" height="11" rx="1.5" />
			<path d="M7 5.5h12a1.5 1.5 0 0 1 1.5 1.5v9" />
			<path d="M8 12h8M8 15h6" />
		</>
	),
	'ach-trail-gate': (
		<>
			<path d="M4 6v14M20 6v14" />
			<path d="M4 9.5h7M4 13h7M4 16.5h7" />
			<path d="M13 16.5 20 10.5" />
		</>
	),
	'ach-paws-fifty': (
		<>
			<circle cx="7" cy="8" r="1.7" />
			<circle cx="6" cy="11" r="1.1" />
			<circle cx="8.6" cy="11" r="1.1" />
			<circle cx="16" cy="9" r="1.7" />
			<circle cx="15" cy="12" r="1.1" />
			<circle cx="17.6" cy="12" r="1.1" />
			<circle cx="11" cy="16" r="1.7" />
		</>
	),
	'ach-preserve-map': (
		<>
			<path d="M4 7 9 5 15 7 20 5v12l-5 2-6-2-5 2Z" />
			<path d="M9 5v12M15 7v12" />
			<circle cx="12" cy="11" r="1.4" fill="currentColor" />
		</>
	),
	'ach-binoculars': (
		<>
			<circle cx="7.5" cy="13" r="3.6" />
			<circle cx="16.5" cy="13" r="3.6" />
			<path d="M9 6.5h1.6l.6 4M15 6.5h-1.6l-.6 4" />
			<path d="M11 13h2" />
		</>
	),
	'ach-balance-leaf': (
		<>
			<path d="M12 4.5v15M7.5 19.5h9" />
			<path d="M4.5 8.5h15" />
			<path d="M4.5 8.5 2.5 13a3 2 0 0 0 4 0L4.5 8.5ZM19.5 8.5 17.5 13a3 2 0 0 0 4 0L19.5 8.5Z" />
		</>
	),
	'ach-triple-leaf': (
		<>
			<path d="M12 20.5c-3-2-5-5-5-9 4 1 6 4 5 9Z" />
			<path d="M12 20.5c3-2 5-5 5-9-4 1-6 4-5 9Z" />
			<path d="M12 20.5v-8" />
		</>
	),
	'ach-signpost': (
		<>
			<path d="M12 4v16" />
			<path d="M4 7h10l2.2 2L14 11H4Z" />
			<path d="M20 12.5H10l-2.2 2L10 16.5h10Z" />
		</>
	),
	'ach-laurel': (
		<>
			<path d="M8 4.5C4 7.5 4 14 8 19" />
			<path d="M16 4.5c4 3 4 9.5 0 14.5" />
			<path d="M12 9.5v8M12 13.5c-2 0-3-1-3-3 2 0 3 1 3 3ZM12 13.5c2 0 3-1 3-3-2 0-3 1-3 3Z" />
		</>
	),
	dice: (
		<>
			<rect x="3.5" y="3.5" width="17" height="17" rx="4" />
			<circle cx="8.6" cy="8.6" r="0.9" fill="currentColor" />
			<circle cx="15.4" cy="8.6" r="0.9" fill="currentColor" />
			<circle cx="12" cy="12" r="0.9" fill="currentColor" />
			<circle cx="8.6" cy="15.4" r="0.9" fill="currentColor" />
			<circle cx="15.4" cy="15.4" r="0.9" fill="currentColor" />
		</>
	),
	note: (
		<>
			<path d="M9 18V5.5l9-2v11" />
			<ellipse cx="6.5" cy="18" rx="2.5" ry="2" />
			<ellipse cx="15.5" cy="16.5" rx="2.5" ry="2" />
		</>
	),
	code: (
		<>
			<path d="M8.5 8 4 12l4.5 4" />
			<path d="M15.5 8 20 12l-4.5 4" />
			<path d="M13.2 6.5 10.8 17.5" />
		</>
	),
};

export function Icon({ name, size = 20, className }: { name: string; size?: number; className?: string }) {
	return (
		<svg
			className={className}
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.8"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			{PATHS[name] || <circle cx="12" cy="12" r="8" />}
		</svg>
	);
}

/**
 * The hand-drawn picture for a gathered material — the same sprite the world
 * draws, snapshotted to a data URL at boot (`snapshotResourceIcons`). Falls
 * back to the old flat colour swatch when the picture isn't ready yet (before
 * the world has booted) or for a resource with no sprite.
 */
export function ResourceIcon({
	id,
	size = 18,
	color,
	className,
}: {
	id: string;
	size?: number;
	color?: string;
	className?: string;
}) {
	const uri = bridge.shared.resourceIcons[id];
	if (uri) {
		return (
			<img
				src={uri}
				width={size}
				height={size}
				className={`res-icon ${className || ''}`}
				style={{ objectFit: 'contain', verticalAlign: 'middle' }}
				alt=""
				aria-hidden="true"
			/>
		);
	}
	return (
		<span
			className={`swatch ${className || ''}`}
			style={{ background: color || '#888', width: size, height: size }}
			aria-hidden="true"
		/>
	);
}

/**
 * The picture of a craftable/plantable object — the very sprite the world will
 * draw once it's placed, snapshotted at boot (`snapshotObjectIcons`) and keyed
 * by the object's `shape`. Sprites come in all aspect ratios, so it renders in
 * a square box with the image contained. Falls back to a colour swatch before
 * the world has booted (or for a shape with no sprite).
 */
export function ObjectIcon({
	shape,
	size = 30,
	color,
	className,
}: {
	shape?: string;
	size?: number;
	color?: string;
	className?: string;
}) {
	const uri = shape ? bridge.shared.objectIcons[shape] : undefined;
	if (uri) {
		return (
			<img
				src={uri}
				width={size}
				height={size}
				className={`obj-icon ${className || ''}`}
				style={{ objectFit: 'contain', verticalAlign: 'middle', flex: 'none' }}
				alt=""
				aria-hidden="true"
			/>
		);
	}
	return (
		<span
			className={`swatch ${className || ''}`}
			style={{ background: color || '#8a8', width: size, height: size, flex: 'none' }}
			aria-hidden="true"
		/>
	);
}

/** Cute SVG portrait that mirrors the in-game procedural sprite. */
export function CharacterPreview({ appearance, size = 150 }: { appearance: Appearance; size?: number }) {
	const { skin, hair, outfit, hat, hatColor, hairstyle = 'short', beard = 'none', body = 'slim' } = appearance;
	const bw = body === 'round' ? 8 : 0; // extra body width
	const hp = hatPalette(hat, hatColor); // a/b/line — classic or custom-tinted
	const flowers = flowerPalette(hatColor); // crown blooms hue-rotate together
	// Halos, headphones and the visor sit above/beside the hair rather than
	// covering it, so
	// the bare-head hair volume (and a top bun) still draws underneath them.
	const bareHead = hat === 'none' || hat === 'halo' || hat === 'headphones' || hat === 'visor' || hat === 'cat-ears';
	return (
		<svg width={size} height={size * 1.13} viewBox="0 0 100 113" aria-label="Your character">
			<ellipse cx="50" cy="104" rx={26 + bw / 2} ry="7" fill="#000" opacity="0.12" />
			{/* long styles fall behind the body */}
			{hairstyle === 'long' && <path d="M29 30 Q26 78 34 86 L66 86 Q74 78 71 30 Z" fill={hair} />}
			{hairstyle === 'curly-long' && (
				<g fill={hair}>
					<path d="M29 30 Q26 76 34 84 L66 84 Q74 76 71 30 Z" />
					<circle cx="31" cy="62" r="8" />
					<circle cx="69" cy="62" r="8" />
					<circle cx="33" cy="78" r="8" />
					<circle cx="67" cy="78" r="8" />
					<circle cx="50" cy="84" r="9" />
					<circle cx="41" cy="83" r="8" />
					<circle cx="59" cy="83" r="8" />
				</g>
			)}
			{hairstyle === 'ponytail' && (
				<>
					<g fill={hair}>
						<ellipse cx="67" cy="32" rx="9" ry="10" />
						<ellipse cx="75" cy="47" rx="8" ry="13" />
						<ellipse cx="75" cy="61" rx="6.5" ry="11" />
					</g>
					<ellipse cx="73" cy="41" rx="4.5" ry="3.2" fill="#c9913f" />
				</>
			)}
			{hairstyle === 'pigtails' && (
				<>
					<g fill={hair}>
						<ellipse cx="27" cy="33" rx="8.5" ry="10" />
						<ellipse cx="21" cy="49" rx="7.5" ry="12" />
						<ellipse cx="73" cy="33" rx="8.5" ry="10" />
						<ellipse cx="79" cy="49" rx="7.5" ry="12" />
					</g>
					<ellipse cx="24" cy="42" rx="4.2" ry="3" fill="#c9913f" />
					<ellipse cx="76" cy="42" rx="4.2" ry="3" fill="#c9913f" />
				</>
			)}
			{hairstyle === 'afro' && <circle cx="50" cy="33" r="28" fill={hair} />}
			{hairstyle === 'bob' && (
				<g fill={hair}>
					<ellipse cx="30" cy="42" rx="8" ry="14" />
					<ellipse cx="70" cy="42" rx="8" ry="14" />
				</g>
			)}
			{hairstyle === 'braid' && (
				<>
					<g fill={hair}>
						<ellipse cx="68" cy="34" rx="8" ry="9" />
						<circle cx="71" cy="49" r="6.2" />
						<circle cx="73" cy="58" r="5.5" />
						<circle cx="74.5" cy="66" r="4.8" />
						<circle cx="75" cy="73" r="4" />
					</g>
					<ellipse cx="75" cy="78.5" rx="3.2" ry="2.4" fill="#c9913f" />
				</>
			)}
			{/* wavy: the silhouette has to carry the waves — the original outline curved
			    by ~5 units on a 100-unit canvas and read as plain long hair. Three lobes
			    per side swinging ~10, plus a scalloped hem, so it still reads as "wavy"
			    down at swatch size. */}
			{hairstyle === 'wavy' && (
				<path
					d="M30 27 C20 36 34 42 24 50 C15 58 32 64 25 71 C19 77 33 78 28 83 Q34 90 40.5 83 Q47 90 53.5 83 Q60 90 66.5 83 Q71 88 72 83 C67 78 81 77 75 71 C68 64 85 58 76 50 C66 42 80 36 70 27 Z"
					fill={hair}
				/>
			)}
			{hairstyle === 'dreads' && (
				<g fill={hair}>
					<ellipse cx="30" cy="36" rx="7.5" ry="9" />
					<ellipse cx="70" cy="36" rx="7.5" ry="9" />
					<rect x="21" y="36" width="6" height="40" rx="3" />
					<rect x="28" y="40" width="6" height="34" rx="3" />
					<rect x="66" y="40" width="6" height="34" rx="3" />
					<rect x="73" y="36" width="6" height="40" rx="3" />
				</g>
			)}
			{hairstyle === 'double-braid' && (
				<>
					<g fill={hair}>
						<ellipse cx="32" cy="34" rx="8" ry="9" />
						<circle cx="29" cy="49" r="6.2" />
						<circle cx="27" cy="58" r="5.5" />
						<circle cx="25.5" cy="66" r="4.8" />
						<circle cx="25" cy="73" r="4" />
						<ellipse cx="68" cy="34" rx="8" ry="9" />
						<circle cx="71" cy="49" r="6.2" />
						<circle cx="73" cy="58" r="5.5" />
						<circle cx="74.5" cy="66" r="4.8" />
						<circle cx="75" cy="73" r="4" />
					</g>
					<ellipse cx="25" cy="78.5" rx="3.2" ry="2.4" fill="#c9913f" />
					<ellipse cx="75" cy="78.5" rx="3.2" ry="2.4" fill="#c9913f" />
				</>
			)}
			{hairstyle === 'half-up' && <path d="M29 30 Q26 76 34 85 L66 85 Q74 76 71 30 Z" fill={hair} />}
			{hairstyle === 'shag' && (
				<g fill={hair}>
					<path d="M28 30 Q25 50 30 63 L70 63 Q75 50 72 30 Z" />
					<path d="M28.5 50 L23 67 L33 61 Z" />
					<path d="M71.5 50 L77 67 L67 61 Z" />
				</g>
			)}
			{/* body */}
			<path
				d={`M${30 - bw} 70 Q${30 - bw} 56 50 56 Q${70 + bw} 56 ${70 + bw} 70 L${68 + bw} 96 Q${68 + bw} 102 60 102 L40 102 Q${32 - bw} 102 ${32 - bw} 96 Z`}
				fill={outfit}
			/>
			<path d="M36 70 Q36 62 50 62 Q64 62 64 70 L63 84 L37 84 Z" fill="#ffffff" opacity="0.14" />
			{/* arms */}
			<ellipse cx={28 - bw} cy="76" rx="6" ry="11" fill={outfit} transform={`rotate(8 ${28 - bw} 76)`} />
			<ellipse cx={72 + bw} cy="76" rx="6" ry="11" fill={outfit} transform={`rotate(-8 ${72 + bw} 76)`} />
			{/* boots */}
			<ellipse cx="42" cy="103" rx="6.5" ry="4.5" fill="#5d4a36" />
			<ellipse cx="58" cy="103" rx="6.5" ry="4.5" fill="#5d4a36" />
			{/* head */}
			<circle cx="50" cy="38" r="21" fill={skin} />
			{/* hair on the head */}
			{(hairstyle === 'curly' || hairstyle === 'curly-long') && (
				<g fill={hair}>
					<circle cx="34" cy="27" r="9" />
					<circle cx="44" cy="21" r="10" />
					<circle cx="56" cy="21" r="10" />
					<circle cx="66" cy="27" r="9" />
					<circle cx="29" cy="38" r="7" />
					<circle cx="71" cy="38" r="7" />
				</g>
			)}
			{hairstyle === 'afro' && (
				<g fill={hair}>
					<circle cx="33" cy="26" r="11" />
					<circle cx="45" cy="18" r="12" />
					<circle cx="57" cy="18" r="12" />
					<circle cx="68" cy="26" r="11" />
					<circle cx="28" cy="39" r="9" />
					<circle cx="72" cy="39" r="9" />
				</g>
			)}
			{hairstyle === 'mohawk' && <path d="M43 24 L46 5 L49 21 L52 3 L55 21 L58 6 L60 24 Q52 19 43 24 Z" fill={hair} />}
			{hairstyle === 'spiky' && (
				<path
					d="M30 33 L33 15 L38 19 L41 10 L46 16 L50 8 L54 16 L59 10 L62 19 L67 15 L70 33 Q60 25 50 24.5 Q40 25 30 33 Z"
					fill={hair}
				/>
			)}
			{/* pixie: cropped, with the fringe swept across the brow */}
			{hairstyle === 'pixie' && (
				<path
					d="M29 35 Q29 16 50 15.5 Q70.5 16 71 33.5 Q67.5 27 62 26.5 Q53 32.5 42 31.2 Q33.5 30.5 29 35 Z"
					fill={hair}
				/>
			)}
			{/* cornrows are stroked rows with scalp showing between them */}
			{hairstyle === 'cornrows' && (
				<g stroke={hair} strokeWidth="3.4" strokeLinecap="round" fill="none">
					<path d="M31 34 Q32 20 42 17" />
					<path d="M38 32.5 Q39 19 46.5 16.4" />
					<path d="M45.5 31.5 Q45.5 18.5 49.5 16.2" />
					<path d="M54.5 31.5 Q54.5 18.5 50.5 16.2" />
					<path d="M62 32.5 Q61 19 53.5 16.4" />
					<path d="M69 34 Q68 20 58 17" />
				</g>
			)}
			{hairstyle === 'shag' && (
				<path d="M29 36 Q29 16 50 15.5 Q71 16 71 36 Q66.5 28.5 58 31.5 Q50 27 42 31.5 Q33.5 28.5 29 36 Z" fill={hair} />
			)}
			{/* bowl cut: a rounded cap with a blunt, flat fringe */}
			{hairstyle === 'bowl' && <path d="M29 33 Q29 15 50 15 Q71 15 71 33 Z" fill={hair} />}
			{hairstyle === 'dreads' && (
				<g fill={hair}>
					<path d="M30 34 Q31 18 50 17 Q69 18 70 34 Q66 26 50 25.5 Q34 26 30 34 Z" />
					<rect x="31.5" y="17" width="4.8" height="11" rx="2.4" />
					<rect x="38" y="13" width="4.8" height="14" rx="2.4" />
					<rect x="44.5" y="11" width="4.8" height="15" rx="2.4" />
					<rect x="51" y="12" width="4.8" height="14" rx="2.4" />
					<rect x="57.5" y="14.5" width="4.8" height="13" rx="2.4" />
					<rect x="63.8" y="18" width="4.8" height="10" rx="2.4" />
				</g>
			)}
			{/* 'bald' draws no hair at all */}
			{![
				'curly',
				'curly-long',
				'afro',
				'mohawk',
				'bald',
				'spiky',
				'bowl',
				'dreads',
				'pixie',
				'cornrows',
				'shag',
			].includes(hairstyle) && <path d="M30 34 Q31 18 50 17 Q69 18 70 34 Q66 26 50 25.5 Q34 26 30 34 Z" fill={hair} />}
			{/* Long styles drop a lock over each shoulder. These draw AFTER the body and
			    arms (the bulk of the hair is still the back mass up top, behind them),
			    which is what puts the hair in front of the shoulders instead of
			    disappearing behind them at the neckline. */}
			{/* The strand's OUTER edge stays outside the head circle the whole way down.
			    Waving it inward past x=30 at the cheekbone uncovered a thin crescent of
			    skin between the strand and the back mass on each side, so the waviness
			    lives on the outer silhouette and the hem, where it can't punch a hole in
			    the face. */}
			{hairstyle === 'wavy' && (
				<g fill={hair}>
					<path d="M31 25 C26 38 25 52 27.5 79 Q32.5 84 37.5 79 C34.5 68 42 60 37 50 C33 41 41 33 39.5 26 Z" />
					<path d="M69 25 C74 38 75 52 72.5 79 Q67.5 84 62.5 79 C65.5 68 58 60 63 50 C67 41 59 33 60.5 26 Z" />
				</g>
			)}
			{/* The inner edge bows in to x~40/60 around the cheekbone (y 40-50) so the
			    hair covers a little of each cheek and frames the face, then tapers back
			    out below the jaw. */}
			{hairstyle === 'long' && (
				<g fill={hair}>
					<path d="M31 27 Q24 52 27.5 84 Q32 89.5 38 85 Q39.5 64 40.5 46 Q41 35 39.5 28 Z" />
					<path d="M69 27 Q76 52 72.5 84 Q68 89.5 62 85 Q60.5 64 59.5 46 Q59 35 60.5 28 Z" />
				</g>
			)}
			{hairstyle === 'curly-long' && (
				<g fill={hair}>
					<path d="M33 29 Q27 52 29 80 Q33 85 37.5 81 Q36 56 37.5 29 Z" />
					<circle cx="30" cy="62" r="5.6" />
					<circle cx="31" cy="73" r="5.4" />
					<circle cx="33" cy="83" r="5.2" />
					<path d="M67 29 Q73 52 71 80 Q67 85 62.5 81 Q64 56 62.5 29 Z" />
					<circle cx="70" cy="62" r="5.6" />
					<circle cx="69" cy="73" r="5.4" />
					<circle cx="67" cy="83" r="5.2" />
				</g>
			)}
			{hairstyle === 'bun' && bareHead && (
				<g>
					<circle cx="50" cy="11" r="9" fill={hair} />
					<rect x="42" y="16" width="16" height="4" rx="2" fill="#c9913f" />
				</g>
			)}
			{hairstyle === 'half-up' && bareHead && (
				<g>
					<ellipse cx="50" cy="13" rx="6.8" ry="5.6" fill={hair} />
					<rect x="44" y="16.6" width="12" height="3.2" rx="1.6" fill="#c9913f" />
				</g>
			)}
			{hairstyle === 'space-buns' && bareHead && (
				<g fill={hair}>
					<circle cx="33" cy="19.5" r="8" />
					<circle cx="67" cy="19.5" r="8" />
				</g>
			)}
			{/* face */}
			<circle cx="42.5" cy="40" r="2.6" fill="#3b2e25" />
			<circle cx="57.5" cy="40" r="2.6" fill="#3b2e25" />
			<circle cx="43.3" cy="39.2" r="0.9" fill="#fff" />
			<circle cx="58.3" cy="39.2" r="0.9" fill="#fff" />
			<path d="M46.5 47 Q50 50 53.5 47" stroke="#3b2e25" strokeWidth="1.7" fill="none" strokeLinecap="round" />
			<circle cx="37" cy="45" r="3.4" fill="#e88" opacity="0.35" />
			<circle cx="63" cy="45" r="3.4" fill="#e88" opacity="0.35" />
			{/* beard (always the hair color): a soft, short jaw wrap with the smile kept visible */}
			{beard === 'beard' && (
				<g>
					<path
						d="M32 43 Q34.5 58.5 50 59 Q65.5 58.5 68 43 Q63.5 50.5 56.5 50.8 Q53 50.8 50 49.8 Q47 50.8 43.5 50.8 Q36.5 50.5 32 43 Z"
						fill={hair}
					/>
					<path d="M42.5 45.3 Q46 43.6 50 45.1 Q54 43.6 57.5 45.3 Q54 46.9 50 46.2 Q46 46.9 42.5 45.3 Z" fill={hair} />
					<path d="M46.5 47.2 Q50 50 53.5 47.2" stroke="#3b2e25" strokeWidth="1.7" fill="none" strokeLinecap="round" />
				</g>
			)}
			{/* hats */}
			{hat === 'straw' && (
				<g>
					<ellipse cx="50" cy="23" rx="27" ry="8" fill={hp.a} />
					<path d="M36 22 Q36 8 50 8 Q64 8 64 22 Q57 19 50 19 Q43 19 36 22 Z" fill={hp.b} />
					<path d="M36 20.5 Q50 24.5 64 20.5" stroke={hp.line} strokeWidth="3" fill="none" />
				</g>
			)}
			{hat === 'leaf' && (
				<g transform="rotate(-8 50 16)">
					<path d="M28 20 Q42 2 72 9 Q67 26 40 25 Q32 24 28 20 Z" fill={hp.a} />
					<path d="M30 19.5 Q50 17 68 11" stroke={hp.line} strokeWidth="1.8" fill="none" />
				</g>
			)}
			{hat === 'beanie' && (
				<g>
					<path d="M31 26 Q31 9 50 9 Q69 9 69 26 L69 28 Q59 24 50 24 Q41 24 31 28 Z" fill={hp.a} />
					<path d="M31 27.5 Q50 22.5 69 27.5 L69 31 Q50 26.5 31 31 Z" fill={hp.b} />
					<circle cx="50" cy="8" r="4.5" fill="#e8d8c8" />
				</g>
			)}
			{hat === 'cap' && (
				<g>
					<path d="M30 25 Q30 9 50 9 Q70 9 70 25 Z" fill={hp.a} />
					<path d="M51 24 Q70 22 82 27 Q70 31 51 28 Z" fill={hp.b} />
					<circle cx="50" cy="10" r="2.4" fill={hp.line} />
				</g>
			)}
			{hat === 'bucket' && (
				<g>
					<path d="M35 23 Q35 10 50 10 Q65 10 65 23 Z" fill={hp.a} />
					<path d="M27 22 L73 22 Q70 30 50 31 Q30 30 27 22 Z" fill={hp.b} />
					<path d="M35 23 L65 23 L65 25 Q50 27 35 25 Z" fill={hp.b} />
				</g>
			)}
			{hat === 'flower' && (
				<g>
					<path d="M29 25 Q50 31 71 25" stroke="#5d8a4a" strokeWidth="4.5" fill="none" strokeLinecap="round" />
					{[32, 43, 54, 65].map((x, i) => (
						<g key={i}>
							{[0, 1.26, 2.51, 3.77, 5.03].map((ang, j) => (
								<circle key={j} cx={x + Math.cos(ang) * 3.4} cy={24 + Math.sin(ang) * 3.4} r="2.4" fill={flowers[i]} />
							))}
							<circle cx={x} cy="24" r="1.7" fill="#fff3c4" />
						</g>
					))}
				</g>
			)}
			{hat === 'party' && (
				<g>
					<path d="M50 1 L39 26 L61 26 Z" fill={hp.a} />
					<path d="M50 1 L45.5 12 L54.5 12 Z" fill={hp.b} />
					<path d="M43.5 19 L56.5 19 L58 26 L42 26 Z" fill={hp.line} />
					<circle cx="50" cy="2" r="3.4" fill="#f4e08a" />
				</g>
			)}
			{hat === 'ranger' && (
				<g>
					<ellipse cx="50" cy="23" rx="29" ry="7" fill={hp.a} />
					<path d="M37 22 Q37 8 50 8 Q63 8 63 22 Q57 18.5 50 18.5 Q43 18.5 37 22 Z" fill={hp.b} />
					<path d="M37 21 Q50 25 63 21" stroke={hp.line} strokeWidth="3" fill="none" />
				</g>
			)}
			{hat === 'acorn' && (
				<g>
					<path d="M29 27 Q29 8 50 8 Q71 8 71 27 Q60 23 50 23 Q40 23 29 27 Z" fill={hp.a} />
					<g stroke={hp.line} strokeWidth="1.2" fill="none" opacity="0.55">
						<path d="M36 11 L33.5 25.5" />
						<path d="M43 8.8 L41.5 24" />
						<path d="M50 8.2 L50 23.2" />
						<path d="M57 8.8 L58.5 24" />
						<path d="M64 11 L66.5 25.5" />
					</g>
					<path d="M50 8 L50 2.5" stroke={hp.line} strokeWidth="3.2" strokeLinecap="round" />
					<circle cx="50" cy="2.5" r="2.2" fill={hp.b} />
				</g>
			)}
			{hat === 'beret' && (
				<g>
					<path d="M28 26 Q25.5 12 47 9.5 Q70 7.5 74.5 19 Q76.5 25.5 66 27.5 Q47 30.5 28 26 Z" fill={hp.a} />
					<path d="M28 26 Q47 30.5 66 27.5 Q49 33 30 29.5 Z" fill={hp.line} />
					<circle cx="47.5" cy="9" r="2.8" fill={hp.b} />
				</g>
			)}
			{hat === 'mushroom' && (
				<g>
					<path d="M29 22 Q29 3 50 3 Q71 3 71 22 Q71 25 67 25 L33 25 Q29 25 29 22 Z" fill={hp.a} />
					<path d="M33 25 L67 25 Q60 28.5 50 28.5 Q40 28.5 33 25 Z" fill={hp.line} />
					<circle cx="40" cy="11" r="3.4" fill="#f6efe3" />
					<circle cx="56" cy="8.5" r="4" fill="#f6efe3" />
					<circle cx="63" cy="17" r="2.6" fill="#f6efe3" />
					<circle cx="45" cy="18" r="2" fill="#f6efe3" />
				</g>
			)}
			{hat === 'wizard' && (
				<g>
					<ellipse cx="50" cy="22" rx="26" ry="7" fill={hp.a} />
					<path d="M53 -6 Q50 6 61 22 L38 22 Q50 9 53 -6 Z" fill={hp.b} />
					<path d="M39 21 Q50 17.5 60 21" stroke={hp.line} strokeWidth="3" fill="none" />
					<path
						d="M55 6 L56.2 9 L59.4 9.2 L56.9 11.1 L57.8 14.2 L55 12.4 L52.2 14.2 L53.1 11.1 L50.6 9.2 L53.8 9 Z"
						fill="#f4e08a"
					/>
				</g>
			)}
			{hat === 'witch' && (
				<g>
					<ellipse cx="50" cy="25" rx="31" ry="7.5" fill={hp.a} />
					<path d="M64 -8 Q54 4 61 25 L39 25 Q50 8 64 -8 Z" fill={hp.b} />
					<rect x="40" y="19.5" width="21" height="5.5" fill={hp.line} />
					<rect x="47.5" y="20.4" width="5" height="3.7" fill="#e0b23e" />
				</g>
			)}
			{hat === 'crown' && (
				<g>
					<path d="M36 24 L36 11 L42.5 17.5 L50 7 L57.5 17.5 L64 11 L64 24 Q50 20 36 24 Z" fill={hp.a} />
					<path d="M36 24 L64 24 L64 27 Q50 23 36 27 Z" fill={hp.line} />
					<circle cx="50" cy="20" r="2.1" fill="#c0503f" />
					<circle cx="42" cy="21.4" r="1.5" fill="#3f6fa8" />
					<circle cx="58" cy="21.4" r="1.5" fill="#3f6fa8" />
				</g>
			)}
			{hat === 'bandana' && (
				<g>
					<path d="M30 32 Q30 12 50 11 Q70 12 70 32 Q60 24 50 24 Q40 24 30 32 Z" fill={hp.a} />
					<path d="M33 26 Q50 20 67 26" stroke={hp.line} strokeWidth="2" fill="none" opacity="0.6" />
					<path d="M68 25 L79 29 L71 33 Z" fill={hp.a} />
					<path d="M70 30 L77.5 39 L68.5 35.5 Z" fill={hp.b} />
					<circle cx="44" cy="17.5" r="1.2" fill="#fff" opacity="0.55" />
					<circle cx="56" cy="17.5" r="1.2" fill="#fff" opacity="0.55" />
					<circle cx="50" cy="14" r="1.2" fill="#fff" opacity="0.55" />
				</g>
			)}
			{hat === 'tophat' && (
				<g>
					<ellipse cx="50" cy="24" rx="30" ry="6.5" fill={hp.b} />
					<path d="M37.5 24 L37.5 0 Q50 -2 62.5 0 L62.5 24 Z" fill={hp.a} />
					<rect x="37.5" y="16.5" width="25" height="5" fill={hp.line} />
					<circle cx="58.5" cy="19" r="1.6" fill="#f4e08a" />
				</g>
			)}
			{/* Folded-newspaper hat: the flat trapezoid it used to be read as a plain
			    paper cap. The giveaway shapes are the two upswept corners with a dipped
			    crown between them, the deep folded brim, and the centre crease with the
			    newsprint running either side of it. */}
			{hat === 'newspaper' && (
				<g>
					<path d="M20 29 L26.5 11 Q50 20 73.5 11 L80 29 Z" fill={hp.a} />
					<path d="M50 17.6 L50 29" stroke={hp.line} strokeWidth="1" opacity="0.55" />
					<g stroke={hp.line} strokeWidth="1.05" strokeLinecap="round" opacity="0.6">
						<path d="M31 22 L46 22" />
						<path d="M54 22 L69 22" />
						<path d="M29.5 26 L46 26" />
						<path d="M54 26 L70.5 26" />
					</g>
					<path d="M18 27.5 L82 27.5 Q80 33.5 50 35 Q20 33.5 18 27.5 Z" fill={hp.b} />
					<path d="M18 27.5 L82 27.5" stroke={hp.line} strokeWidth="1" opacity="0.5" />
				</g>
			)}
			{hat === 'chef' && (
				<g>
					<g fill={hp.b}>
						<circle cx="38" cy="10" r="9" />
						<circle cx="50" cy="5.5" r="10.5" />
						<circle cx="62" cy="10" r="9" />
					</g>
					<path d="M36 12 L64 12 L64 23.5 Q50 26 36 23.5 Z" fill={hp.a} />
					<path d="M36 20 Q50 22.5 64 20" stroke={hp.line} strokeWidth="2" fill="none" />
				</g>
			)}
			{hat === 'pirate' && (
				<g>
					{/* tricorn: brim swept up into a point either side, dipping in the middle */}
					<path
						d="M16 29 Q19 12 33 7 Q41 15 50 15 Q59 15 67 7 Q81 12 84 29 Q67 27.5 50 27.5 Q33 27.5 16 29 Z"
						fill={hp.a}
					/>
					<path d="M16 29 Q33 34.5 50 34.5 Q67 34.5 84 29 Q67 26.5 50 26.5 Q33 26.5 16 29 Z" fill={hp.b} />
					<path d="M21 27 Q35 22.5 50 22 Q65 22.5 79 27" stroke={hp.line} strokeWidth="1.5" fill="none" opacity="0.5" />
					<circle cx="50" cy="19" r="4.2" fill="#f6efe3" />
					<circle cx="48.4" cy="18.4" r="1.1" fill={hp.a} />
					<circle cx="51.6" cy="18.4" r="1.1" fill={hp.a} />
					<path d="M46.8 22.2 L53.2 22.2 L52 24.4 L48 24.4 Z" fill="#f6efe3" />
				</g>
			)}
			{hat === 'frog' && (
				<g>
					<path d="M29 30 Q29 11 50 11 Q71 11 71 30 Q60 25.5 50 25.5 Q40 25.5 29 30 Z" fill={hp.a} />
					<circle cx="37" cy="12" r="7.5" fill={hp.a} />
					<circle cx="63" cy="12" r="7.5" fill={hp.a} />
					<circle cx="37" cy="11" r="4.6" fill="#fdf6e8" />
					<circle cx="63" cy="11" r="4.6" fill="#fdf6e8" />
					<circle cx="37" cy="11.6" r="2.3" fill="#2b2b2b" />
					<circle cx="63" cy="11.6" r="2.3" fill="#2b2b2b" />
				</g>
			)}
			{bareHead &&
				![
					'curly',
					'curly-long',
					'afro',
					'mohawk',
					'bun',
					'bald',
					'spiky',
					'bowl',
					'dreads',
					'pixie',
					'cornrows',
					'shag',
				].includes(hairstyle) && <path d="M31 32 Q31 14 50 14 Q69 14 69 32 Q66 22 50 21 Q34 22 31 32 Z" fill={hair} />}
			{/* visor, halo, headphones + cat ears layer over the hair, not instead of it */}
			{hat === 'cat-ears' && (
				<g>
					<path d="M33 25 L36.5 6 L49.5 20.5 Z" fill={hp.a} />
					<path d="M67 25 L63.5 6 L50.5 20.5 Z" fill={hp.a} />
					<path d="M36.8 21.5 L38.6 12 L45 19 Z" fill="#e8a0b0" />
					<path d="M63.2 21.5 L61.4 12 L55 19 Z" fill="#e8a0b0" />
				</g>
			)}
			{hat === 'visor' && (
				<g>
					<path d="M23 30 Q23 22 50 22 Q77 22 77 30 Q64 26.5 50 26.5 Q36 26.5 23 30 Z" fill={hp.b} />
					<path d="M30 27.5 Q30 19.5 50 19.5 Q70 19.5 70 27.5 Q60 24.5 50 24.5 Q40 24.5 30 27.5 Z" fill={hp.a} />
					<path d="M32.5 24.5 Q50 21.4 67.5 24.5" stroke={hp.line} strokeWidth="1.6" fill="none" opacity="0.7" />
				</g>
			)}
			{hat === 'halo' && (
				<g>
					<ellipse cx="50" cy="9" rx="16" ry="4.6" fill="none" stroke={hp.a} strokeWidth="3.6" />
					<ellipse cx="50" cy="9" rx="16" ry="4.6" fill="none" stroke={hp.b} strokeWidth="1.3" />
					<circle cx="63" cy="6.5" r="1.5" fill="#fff3c4" />
				</g>
			)}
			{hat === 'headphones' && (
				<g>
					<path d="M28 40 Q28 12 50 12 Q72 12 72 40" stroke={hp.a} strokeWidth="5" fill="none" strokeLinecap="round" />
					<rect x="22.5" y="32" width="11" height="17" rx="5" fill={hp.b} />
					<rect x="66.5" y="32" width="11" height="17" rx="5" fill={hp.b} />
					<rect x="25.5" y="35.5" width="5" height="10" rx="2.5" fill={hp.line} />
					<rect x="69.5" y="35.5" width="5" height="10" rx="2.5" fill={hp.line} />
				</g>
			)}
		</svg>
	);
}
