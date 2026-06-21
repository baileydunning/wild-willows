// Hand-drawn SVG icon set + the character preview used in the creator.
// All icons inherit currentColor so they re-tint with the UI.

import React from 'react';
import type { Appearance } from '../types';

const PATHS: Record<string, React.ReactNode> = {
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
			<path d="M14.5 6.5a4 4 0 0 1 5-5l-2.8 2.8 1 2.5 2.5 1L23 5a4 4 0 0 1-5 5L8.5 19.5a2.1 2.1 0 0 1-3-3L14.5 6.5Z" transform="scale(0.92) translate(0.5 0.8)" />
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
	sparkle: (
		<>
			<path d="M12 3.5 13.8 9 19 11l-5.2 2L12 18.5 10.2 13 5 11l5.2-2L12 3.5Z" />
			<path d="M19 16.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z" />
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
	check: <path d="M5 12.5 10 17.5 19 7" />,
	drop: <path d="M12 3.5C15 8 18 11 18 14.5a6 6 0 1 1-12 0C6 11 9 8 12 3.5Z" />,
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
			<circle cx="12" cy="12" r="3.2" />
			<path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M18.5 5.5l-2.1 2.1M7.6 16.4l-2.1 2.1" />
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
			<path d="M12.5 10.1 L13.9 11.5 L10.1 15.3 a3.4 3.4 0 0 1 -2.3 1 L5.6 16.4 L5.7 14.5 a3.4 3.4 0 0 1 1 -2.3 Z" fill="currentColor" />
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
			<circle cx="12" cy="4" r="1.6" /><circle cx="8" cy="8" r="1.6" /><circle cx="16" cy="8" r="1.6" />
			<circle cx="9.4" cy="11.5" r="1.6" /><circle cx="14.6" cy="11.5" r="1.6" />
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
			<circle cx="10" cy="11" r="0.7" fill="currentColor" /><circle cx="14" cy="11" r="0.7" fill="currentColor" />
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
			<circle cx="8" cy="11.5" r="1.3" /><circle cx="12" cy="11.5" r="1.3" />
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
			<circle cx="8" cy="9" r="1.6" /><circle cx="14" cy="9" r="1.6" />
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
			<circle cx="12" cy="5.3" r="1.3" /><circle cx="8.7" cy="8" r="1.3" /><circle cx="15.3" cy="8" r="1.3" />
			<circle cx="9.7" cy="11.4" r="1.3" /><circle cx="14.3" cy="11.4" r="1.3" />
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
			<circle cx="9.5" cy="8.5" r="1" fill="currentColor" /><circle cx="13" cy="7.8" r="1" fill="currentColor" /><circle cx="11.2" cy="9.5" r="1" fill="currentColor" />
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
			<circle cx="7" cy="8" r="1.7" /><circle cx="6" cy="11" r="1.1" /><circle cx="8.6" cy="11" r="1.1" />
			<circle cx="16" cy="9" r="1.7" /><circle cx="15" cy="12" r="1.1" /><circle cx="17.6" cy="12" r="1.1" />
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
			<circle cx="7.5" cy="13" r="3.6" /><circle cx="16.5" cy="13" r="3.6" />
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

/** Cute SVG portrait that mirrors the in-game procedural sprite. */
export function CharacterPreview({ appearance, size = 150 }: { appearance: Appearance; size?: number }) {
	const { skin, hair, outfit, hat, hairstyle = 'short', body = 'slim' } = appearance;
	const bw = body === 'round' ? 8 : 0; // extra body width
	return (
		<svg width={size} height={size * 1.13} viewBox="0 0 100 113" aria-label="Your character">
			<ellipse cx="50" cy="104" rx={26 + bw / 2} ry="7" fill="#000" opacity="0.12" />
			{/* long styles fall behind the body */}
			{hairstyle === 'long' && (
				<path d="M29 30 Q26 78 34 86 L66 86 Q74 78 71 30 Z" fill={hair} />
			)}
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
			{hairstyle === 'mohawk' && (
				<path d="M43 24 L46 5 L49 21 L52 3 L55 21 L58 6 L60 24 Q52 19 43 24 Z" fill={hair} />
			)}
			{!['curly', 'curly-long', 'afro', 'mohawk'].includes(hairstyle) && (
				<path d="M30 34 Q31 18 50 17 Q69 18 70 34 Q66 26 50 25.5 Q34 26 30 34 Z" fill={hair} />
			)}
			{hairstyle === 'bun' && hat === 'none' && (
				<g>
					<circle cx="50" cy="11" r="9" fill={hair} />
					<rect x="42" y="16" width="16" height="4" rx="2" fill="#c9913f" />
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
			{/* hats */}
			{hat === 'straw' && (
				<g>
					<ellipse cx="50" cy="23" rx="27" ry="8" fill="#c9a35c" />
					<path d="M36 22 Q36 8 50 8 Q64 8 64 22 Q57 19 50 19 Q43 19 36 22 Z" fill="#d8b56e" />
					<path d="M36 20.5 Q50 24.5 64 20.5" stroke="#a3814f" strokeWidth="3" fill="none" />
				</g>
			)}
			{hat === 'leaf' && (
				<g transform="rotate(-8 50 16)">
					<path d="M28 20 Q42 2 72 9 Q67 26 40 25 Q32 24 28 20 Z" fill="#5d8a4a" />
					<path d="M30 19.5 Q50 17 68 11" stroke="#436b35" strokeWidth="1.8" fill="none" />
				</g>
			)}
			{hat === 'beanie' && (
				<g>
					<path d="M31 26 Q31 9 50 9 Q69 9 69 26 L69 28 Q59 24 50 24 Q41 24 31 28 Z" fill="#b5707a" />
					<path d="M31 27.5 Q50 22.5 69 27.5 L69 31 Q50 26.5 31 31 Z" fill="#9e5f69" />
					<circle cx="50" cy="8" r="4.5" fill="#e8d8c8" />
				</g>
			)}
			{hat === 'cap' && (
				<g>
					<path d="M30 25 Q30 9 50 9 Q70 9 70 25 Z" fill="#5f86b0" />
					<path d="M51 24 Q70 22 82 27 Q70 31 51 28 Z" fill="#4f739a" />
					<circle cx="50" cy="10" r="2.4" fill="#3f5f80" />
				</g>
			)}
			{hat === 'bucket' && (
				<g>
					<path d="M35 23 Q35 10 50 10 Q65 10 65 23 Z" fill="#9aa86a" />
					<path d="M27 22 L73 22 Q70 30 50 31 Q30 30 27 22 Z" fill="#86945a" />
					<path d="M35 23 L65 23 L65 25 Q50 27 35 25 Z" fill="#86945a" />
				</g>
			)}
			{hat === 'flower' && (
				<g>
					<path d="M29 25 Q50 31 71 25" stroke="#5d8a4a" strokeWidth="4.5" fill="none" strokeLinecap="round" />
					{[32, 43, 54, 65].map((x, i) => (
						<g key={i}>
							{[0, 1.26, 2.51, 3.77, 5.03].map((ang, j) => (
								<circle key={j} cx={x + Math.cos(ang) * 3.4} cy={24 + Math.sin(ang) * 3.4} r="2.4" fill={['#e87a9e', '#f4c95f', '#c45ad0', '#e8954f'][i]} />
							))}
							<circle cx={x} cy="24" r="1.7" fill="#fff3c4" />
						</g>
					))}
				</g>
			)}
			{hat === 'party' && (
				<g>
					<path d="M50 1 L39 26 L61 26 Z" fill="#d77bb1" />
					<path d="M50 1 L45.5 12 L54.5 12 Z" fill="#e89ac0" />
					<path d="M43.5 19 L56.5 19 L58 26 L42 26 Z" fill="#7d6b9e" />
					<circle cx="50" cy="2" r="3.4" fill="#f4e08a" />
				</g>
			)}
			{hat === 'none' && !['curly', 'curly-long', 'afro', 'mohawk', 'bun'].includes(hairstyle) && (
				<path d="M31 32 Q31 14 50 14 Q69 14 69 32 Q66 22 50 21 Q34 22 31 32 Z" fill={hair} />
			)}
		</svg>
	);
}
