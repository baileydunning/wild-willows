// The pictures in the eyepiece: eleven cloud types drawn as shapes, sixteen
// constellations drawn as their actual star patterns.
//
// Unlike storyArt.tsx, none of this can be a world sprite — the game has no
// cumulonimbus and no Orion, and a constellation has to be drawn at the size the
// telescope is showing it rather than stamped from a fixed-resolution texture.
// So it is plain SVG, in the same flat-shape, no-outline style as the sprites.
//
// Every figure is drawn in its own little box (BOX.cloud / BOX.stars) with the
// origin at its middle, and the panel translates it into the field. Keeping the
// origin central is what lets the crosshair test be a plain distance check.
//
// The star patterns are the real ones, laid out by eye from the sky rather than
// from a catalogue: relative positions and the usual joining lines, normalised
// into a 0–100 box. Magnitudes are rounded to three sizes — the named bright
// star, the ordinary members, and the faint ones you only see on a good night.

import React from 'react';
import type { SkyKind, SkyMode } from './sky';
import { FIELDS } from './sky';

/** The drawing box each figure is composed in. The panel centres it on the
 *  figure's position, so nothing here has to know where it ended up. */
export const BOX: Record<SkyKind, { w: number; h: number }> = {
	cloud: { w: 275, h: 163 },
	optic: { w: 275, h: 163 },
	figure: { w: 230, h: 230 },
	deep: { w: 200, h: 200 },
	body: { w: 170, h: 170 },
	event: { w: 240, h: 240 },
};

/** Clouds are composed in a 220×130 box and then drawn up to fill BOX.cloud —
 *  the shapes were laid out at a comfortable size to write, not at the size the
 *  eyepiece wants them. */
const CLOUD_SCALE = 1.25;

/** How close the crosshair has to be to count as aimed at something. A cloud is
 *  wide and a planet is a dot, so each kind gets its own reach. */
export const AIM: Record<SkyKind, number> = {
	cloud: 100,
	optic: 100,
	figure: 88,
	deep: 72,
	body: 62,
	event: 92,
};

const WHITE = '#f6fbff';
const SHADE = '#d3dfea';
const GREY = '#a9b7c6';
const SLATE = '#7d8c9c';
const DARK = '#5e6b7a';
const RAIN = '#8aa0b6';
const SUN = '#f7e6a8';

/** A run of round puffs along a line — the top of a heap cloud. */
function puffs(list: [number, number, number][], fill: string, opacity = 1) {
	return list.map(([cx, cy, r], i) => <circle key={i} cx={cx} cy={cy} r={r} fill={fill} opacity={opacity} />);
}

/** One cloud, composed in a 220×130 box with its middle at (110, 65) and drawn
 *  up to BOX.cloud. */
export function CloudArt({ id }: { id: string }) {
	return <g transform={`scale(${CLOUD_SCALE})`}>{cloudShape(id)}</g>;
}

function cloudShape(id: string) {
	switch (id) {
		case 'cumulus':
			return (
				<g>
					{puffs(
						[
							[76, 78, 26],
							[110, 62, 33],
							[146, 76, 25],
							[168, 86, 17],
						],
						WHITE,
					)}
					<rect x={58} y={84} width={124} height={18} rx={9} fill={WHITE} />
					<rect x={62} y={94} width={116} height={9} rx={4.5} fill={SHADE} />
				</g>
			);
		case 'cumulonimbus':
			return (
				<g>
					<ellipse cx={112} cy={22} rx={82} ry={13} fill={WHITE} />
					<ellipse cx={112} cy={27} rx={70} ry={9} fill={SHADE} />
					<path d="M78 30 h66 l10 44 q6 26 -8 30 h-72 q-14 -6 -8 -32 z" fill={WHITE} />
					{puffs(
						[
							[92, 44, 18],
							[128, 40, 20],
							[112, 62, 22],
						],
						WHITE,
					)}
					<path d="M74 92 h76 q8 8 -2 12 h-72 q-8 -4 -2 -12 z" fill={SLATE} />
					{[82, 96, 110, 124, 138].map((x, i) => (
						<line key={i} x1={x} y1={104} x2={x - 7} y2={124} stroke={RAIN} strokeWidth={2.4} strokeLinecap="round" />
					))}
					<path d="M150 46 l-11 16 h8 l-9 15" fill="none" stroke={SUN} strokeWidth={3} strokeLinejoin="round" />
				</g>
			);
		case 'stratus':
			return (
				<g>
					<rect x={20} y={54} width={182} height={26} rx={13} fill={GREY} />
					<rect x={34} y={78} width={154} height={16} rx={8} fill={GREY} opacity={0.55} />
					<rect x={48} y={44} width={124} height={13} rx={6.5} fill={SHADE} opacity={0.75} />
				</g>
			);
		case 'stratocumulus':
			return (
				<g>
					{[
						[44, 20],
						[86, 30],
						[132, 26],
						[176, 18],
					].map(([cx, rx], i) => (
						<g key={i}>
							<ellipse cx={cx} cy={64} rx={rx} ry={15} fill={WHITE} />
							<ellipse cx={cx} cy={72} rx={rx - 2} ry={8} fill={SHADE} />
						</g>
					))}
					<ellipse cx={64} cy={88} rx={22} ry={10} fill={SHADE} opacity={0.8} />
					<ellipse cx={150} cy={90} rx={19} ry={9} fill={SHADE} opacity={0.8} />
				</g>
			);
		case 'nimbostratus':
			return (
				<g>
					<rect x={16} y={26} width={190} height={44} rx={12} fill={SLATE} />
					<path
						d="M16 66 q14 12 30 2 q16 12 30 0 q16 12 32 0 q16 12 30 0 q16 12 30 0 q14 8 24 -4 v-10 h-176 z"
						fill={DARK}
					/>
					{[34, 56, 78, 100, 122, 144, 166, 188].map((x, i) => (
						<line key={i} x1={x} y1={78} x2={x - 9} y2={116} stroke={RAIN} strokeWidth={2.2} strokeLinecap="round" />
					))}
				</g>
			);
		case 'altostratus':
			return (
				<g>
					<circle cx={150} cy={54} r={17} fill={SUN} opacity={0.5} />
					<rect x={18} y={40} width={186} height={30} rx={10} fill={GREY} opacity={0.85} />
					<rect x={30} y={70} width={162} height={14} rx={7} fill={GREY} opacity={0.5} />
					<circle cx={150} cy={54} r={17} fill={SUN} opacity={0.28} />
				</g>
			);
		case 'altocumulus':
			return (
				<g>
					{[0, 1].map((row) =>
						[0, 1, 2, 3, 4].map((col) => {
							const cx = 40 + col * 36 + (row ? 16 : 0);
							const cy = 50 + row * 30;
							return (
								<g key={`${row}-${col}`}>
									<ellipse cx={cx} cy={cy} rx={17} ry={11} fill={WHITE} />
									<ellipse cx={cx} cy={cy + 5} rx={15} ry={6} fill={SHADE} />
								</g>
							);
						}),
					)}
				</g>
			);
		case 'cirrus':
			return (
				<g fill="none" stroke={WHITE} strokeLinecap="round">
					<path d="M32 44 q46 -14 92 0 q22 5 40 -8" strokeWidth={5} opacity={0.95} />
					<path d="M46 66 q44 -12 88 2 q20 6 36 -6" strokeWidth={4} opacity={0.8} />
					<path d="M60 88 q40 -10 78 2" strokeWidth={3.4} opacity={0.65} />
					<path d="M124 44 q10 -12 26 -12" strokeWidth={3.4} opacity={0.75} />
					<path d="M170 60 q10 -10 24 -9" strokeWidth={3} opacity={0.6} />
				</g>
			);
		case 'cirrostratus':
			return (
				<g>
					<rect x={12} y={26} width={196} height={78} rx={22} fill={WHITE} opacity={0.34} />
					<circle cx={110} cy={64} r={38} fill="none" stroke={SUN} strokeWidth={3.6} opacity={0.85} />
					<circle cx={110} cy={64} r={44} fill="none" stroke={SUN} strokeWidth={1.6} opacity={0.4} />
					<circle cx={110} cy={64} r={13} fill={SUN} />
				</g>
			);
		case 'cirrocumulus':
			return (
				<g>
					{[0, 1, 2].map((row) =>
						[0, 1, 2, 3, 4, 5, 6].map((col) => {
							const cx = 40 + col * 24 + (row % 2 ? 12 : 0);
							const cy = 42 + row * 22;
							return <circle key={`${row}-${col}`} cx={cx} cy={cy} r={6 - row * 0.6} fill={WHITE} opacity={0.95} />;
						}),
					)}
				</g>
			);
		case 'lenticular':
			return (
				<g>
					<path d="M60 118 l34 -46 l24 30 l16 -18 l28 34 z" fill={DARK} opacity={0.75} />
					<ellipse cx={112} cy={34} rx={62} ry={12} fill={WHITE} />
					<ellipse cx={112} cy={40} rx={58} ry={7} fill={SHADE} />
					<ellipse cx={106} cy={56} rx={46} ry={10} fill={WHITE} />
					<ellipse cx={106} cy={61} rx={42} ry={6} fill={SHADE} />
					<ellipse cx={116} cy={74} rx={30} ry={7} fill={WHITE} opacity={0.9} />
				</g>
			);
		default:
			return <ellipse cx={110} cy={65} rx={50} ry={20} fill={WHITE} />;
	}
}

/** A star: where it is in the 0–100 box, and how bright — 3 named-bright,
 *  2 ordinary, 1 faint. */
type Star = [number, number, 1 | 2 | 3];

export interface Pattern {
	stars: Star[];
	/** Index pairs — the lines people have always drawn between them. */
	lines: [number, number][];
	/** Stars that are the SUBJECT of the entry (a named star, a cluster, a
	 *  galaxy) and get a ring when you aim at the figure. */
	marks?: number[];
}

export const PATTERNS: Record<string, Pattern> = {
	// The Plough / Big Dipper, the seven stars of the Bear's back and tail.
	'ursa-major': {
		stars: [
			[18, 30, 3],
			[22, 48, 3],
			[40, 54, 2],
			[44, 40, 2],
			[58, 34, 2],
			[72, 30, 3],
			[87, 21, 2],
		],
		lines: [
			[0, 1],
			[1, 2],
			[2, 3],
			[3, 0],
			[3, 4],
			[4, 5],
			[5, 6],
		],
		marks: [0, 1],
	},
	// The Little Dipper, hanging off Polaris.
	'ursa-minor': {
		stars: [
			[18, 20, 3],
			[31, 32, 1],
			[43, 43, 1],
			[53, 55, 2],
			[73, 50, 3],
			[70, 35, 2],
			[59, 65, 1],
		],
		lines: [
			[0, 1],
			[1, 2],
			[2, 3],
			[3, 6],
			[6, 4],
			[4, 5],
			[5, 3],
		],
		marks: [0],
	},
	cassiopeia: {
		stars: [
			[13, 32, 2],
			[32, 56, 2],
			[51, 28, 3],
			[69, 57, 2],
			[87, 27, 2],
		],
		lines: [
			[0, 1],
			[1, 2],
			[2, 3],
			[3, 4],
		],
	},
	// The dragon winding between the two bears, head at the upper right.
	draco: {
		stars: [
			[87, 18, 2],
			[79, 11, 1],
			[76, 25, 2],
			[85, 30, 1],
			[66, 33, 1],
			[54, 26, 2],
			[44, 37, 1],
			[34, 26, 2],
			[24, 35, 1],
			[16, 49, 2],
			[21, 65, 1],
			[35, 71, 3],
			[51, 74, 1],
		],
		lines: [
			[0, 1],
			[1, 2],
			[2, 3],
			[3, 0],
			[2, 4],
			[4, 5],
			[5, 6],
			[6, 7],
			[7, 8],
			[8, 9],
			[9, 10],
			[10, 11],
			[11, 12],
		],
		marks: [11],
	},
	// The Sickle, and the triangle of the lion's haunches.
	leo: {
		stars: [
			[26, 62, 3],
			[24, 49, 2],
			[28, 37, 3],
			[36, 27, 2],
			[46, 21, 1],
			[41, 12, 1],
			[59, 59, 2],
			[61, 37, 2],
			[86, 44, 3],
		],
		lines: [
			[0, 1],
			[1, 2],
			[2, 3],
			[3, 4],
			[4, 5],
			[0, 6],
			[6, 7],
			[7, 2],
			[6, 8],
			[8, 7],
		],
		marks: [0],
	},
	// The kite, with Arcturus at its tail.
	bootes: {
		stars: [
			[46, 84, 3],
			[58, 56, 2],
			[65, 32, 2],
			[50, 16, 2],
			[32, 28, 1],
			[34, 58, 1],
		],
		lines: [
			[0, 1],
			[1, 2],
			[2, 3],
			[3, 4],
			[4, 5],
			[5, 0],
		],
		marks: [0],
	},
	// The Northern Cross, flying down the Milky Way.
	cygnus: {
		stars: [
			[50, 9, 3],
			[50, 45, 2],
			[50, 85, 2],
			[22, 37, 2],
			[78, 40, 2],
			[35, 24, 1],
			[66, 27, 1],
		],
		lines: [
			[0, 1],
			[1, 2],
			[3, 1],
			[1, 4],
			[3, 5],
			[4, 6],
		],
		marks: [0, 2],
	},
	lyra: {
		stars: [
			[27, 17, 3],
			[44, 35, 2],
			[63, 30, 1],
			[60, 57, 2],
			[42, 61, 1],
		],
		lines: [
			[0, 1],
			[1, 2],
			[2, 3],
			[3, 4],
			[4, 1],
		],
		marks: [0],
	},
	aquila: {
		stars: [
			[50, 43, 3],
			[46, 30, 2],
			[55, 55, 2],
			[21, 25, 1],
			[34, 45, 2],
			[40, 74, 1],
			[74, 62, 1],
		],
		lines: [
			[1, 0],
			[0, 2],
			[0, 4],
			[4, 3],
			[4, 5],
			[2, 6],
		],
		marks: [0],
	},
	// Head, heart and the long curling tail — low in the south all summer.
	scorpius: {
		stars: [
			[16, 18, 2],
			[21, 31, 2],
			[17, 44, 1],
			[34, 45, 3],
			[41, 56, 1],
			[47, 67, 2],
			[57, 75, 1],
			[67, 79, 1],
			[75, 71, 2],
			[79, 59, 1],
			[72, 50, 1],
			[63, 45, 2],
		],
		lines: [
			[0, 1],
			[1, 2],
			[1, 3],
			[3, 4],
			[4, 5],
			[5, 6],
			[6, 7],
			[7, 8],
			[8, 9],
			[9, 10],
			[10, 11],
		],
		marks: [3],
	},
	// The Great Square, with the horse's neck running off one corner.
	pegasus: {
		stars: [
			[30, 64, 2],
			[28, 34, 2],
			[64, 30, 2],
			[66, 66, 2],
			[13, 74, 1],
			[8, 88, 2],
		],
		lines: [
			[0, 1],
			[1, 2],
			[2, 3],
			[3, 0],
			[0, 4],
			[4, 5],
		],
	},
	// The chain of stars off the Square's corner, and the smudge above it.
	andromeda: {
		stars: [
			[16, 32, 2],
			[35, 38, 1],
			[54, 44, 3],
			[76, 48, 2],
			[51, 27, 1],
			[48, 18, 1],
			[45, 9, 1],
		],
		lines: [
			[0, 1],
			[1, 2],
			[2, 3],
			[2, 4],
			[4, 5],
			[5, 6],
		],
		marks: [6],
	},
	orion: {
		stars: [
			[30, 21, 3],
			[68, 24, 2],
			[64, 49, 2],
			[54, 52, 2],
			[44, 55, 2],
			[38, 82, 1],
			[72, 80, 3],
			[54, 65, 1],
		],
		lines: [
			[0, 4],
			[1, 2],
			[2, 3],
			[3, 4],
			[4, 5],
			[2, 6],
		],
		marks: [0, 6, 7],
	},
	taurus: {
		stars: [
			[61, 59, 3],
			[50, 51, 2],
			[40, 43, 2],
			[45, 33, 1],
			[57, 31, 1],
			[85, 14, 2],
			[79, 53, 2],
			[19, 19, 1],
			[15, 15, 1],
			[23, 15, 1],
			[19, 23, 1],
		],
		lines: [
			[0, 1],
			[1, 2],
			[2, 3],
			[3, 4],
			[4, 5],
			[0, 6],
		],
		marks: [0, 7, 8, 9, 10],
	},
	gemini: {
		stars: [
			[27, 15, 2],
			[49, 18, 3],
			[29, 36, 1],
			[53, 39, 2],
			[31, 57, 1],
			[59, 57, 1],
			[27, 77, 2],
			[67, 75, 2],
		],
		lines: [
			[0, 2],
			[2, 4],
			[4, 6],
			[1, 3],
			[3, 5],
			[5, 7],
			[2, 3],
		],
		marks: [0, 1],
	},
	'canis-major': {
		stars: [
			[40, 23, 3],
			[20, 30, 2],
			[52, 60, 2],
			[34, 72, 2],
			[69, 70, 1],
			[24, 84, 1],
		],
		lines: [
			[0, 1],
			[0, 2],
			[2, 3],
			[2, 4],
			[3, 5],
		],
		marks: [0],
	},
	// --- the zodiac: the band the sun walks through --------------------------
	// Hamal, Sheratan and Mesarthim, with 41 Arietis and Botein trailing off —
	// five stars is the whole of it, which is the point of the entry.
	aries: {
		stars: [
			[70, 26, 3],
			[50, 34, 2],
			[43, 39, 1],
			[78, 52, 2],
			[90, 62, 1],
		],
		lines: [
			[0, 1],
			[1, 2],
			[0, 3],
			[3, 4],
		],
		marks: [0],
	},
	cancer: {
		stars: [
			[50, 38, 1],
			[54, 52, 2],
			[72, 64, 2],
			[46, 18, 2],
			[36, 80, 2],
		],
		lines: [
			[3, 0],
			[0, 1],
			[1, 2],
			[1, 4],
		],
		marks: [0],
	},
	virgo: {
		stars: [
			[58, 82, 3],
			[50, 58, 2],
			[44, 40, 2],
			[38, 20, 2],
			[20, 44, 1],
			[70, 60, 1],
			[82, 42, 1],
		],
		lines: [
			[0, 1],
			[1, 2],
			[2, 3],
			[2, 4],
			[1, 5],
			[5, 6],
		],
		marks: [0],
	},
	// The two claws at the top, the beam between them, and the pans hanging off.
	libra: {
		stars: [
			[40, 24, 2],
			[64, 46, 2],
			[24, 52, 2],
			[68, 76, 1],
			[16, 74, 1],
		],
		lines: [
			[0, 1],
			[0, 2],
			[1, 3],
			[2, 1],
			[2, 4],
		],
		marks: [0, 1],
	},
	sagittarius: {
		stars: [
			[22, 50, 2],
			[34, 30, 2],
			[50, 42, 2],
			[46, 64, 2],
			[26, 68, 2],
			[68, 58, 2],
			[76, 42, 1],
			[58, 78, 1],
		],
		lines: [
			[0, 1],
			[1, 2],
			[2, 6],
			[6, 5],
			[5, 3],
			[3, 4],
			[4, 0],
			[2, 3],
			[3, 7],
		],
	},
	capricornus: {
		stars: [
			[18, 32, 2],
			[32, 26, 1],
			[70, 34, 2],
			[82, 54, 1],
			[54, 74, 2],
			[32, 60, 1],
		],
		lines: [
			[0, 1],
			[1, 2],
			[2, 3],
			[3, 4],
			[4, 5],
			[5, 0],
		],
	},
	aquarius: {
		stars: [
			[46, 24, 2],
			[56, 34, 1],
			[64, 24, 1],
			[54, 14, 1],
			[32, 44, 2],
			[72, 52, 2],
			[62, 72, 1],
			[80, 78, 1],
		],
		lines: [
			[0, 1],
			[1, 2],
			[2, 3],
			[3, 0],
			[0, 4],
			[1, 5],
			[5, 6],
			[6, 7],
		],
	},
	pisces: {
		stars: [
			[14, 24, 1],
			[26, 36, 1],
			[40, 46, 1],
			[54, 56, 2],
			[68, 46, 1],
			[80, 34, 1],
			[88, 22, 2],
			[50, 74, 1],
			[40, 84, 2],
		],
		lines: [
			[0, 1],
			[1, 2],
			[2, 3],
			[3, 4],
			[4, 5],
			[5, 6],
			[3, 7],
			[7, 8],
		],
	},
	ophiuchus: {
		stars: [
			[50, 12, 3],
			[28, 36, 2],
			[72, 34, 2],
			[34, 64, 2],
			[68, 62, 2],
			[46, 82, 1],
		],
		lines: [
			[0, 1],
			[0, 2],
			[1, 3],
			[2, 4],
			[3, 5],
			[5, 4],
		],
		marks: [0],
	},
};

const STAR_R: Record<1 | 2 | 3, number> = { 1: 1.5, 2: 2.4, 3: 3.6 };

/** One constellation, drawn in a 230×230 box with its middle at (115, 115). */
export function ConstellationArt({ id, hot }: { id: string; hot: boolean }) {
	const pat = PATTERNS[id];
	if (!pat) return null;
	// Patterns are laid out in a 0–100 box but few of them fill it — Orion is
	// tall and narrow, Cassiopeia short and wide. Each one is scaled up to fill
	// the drawing box (aspect kept, so nothing is stretched), which is what makes
	// every figure read at the same size through the eyepiece.
	const xs = pat.stars.map((st) => st[0]);
	const ys = pat.stars.map((st) => st[1]);
	const x0 = Math.min(...xs);
	const y0 = Math.min(...ys);
	const span = Math.max(Math.max(...xs) - x0, Math.max(...ys) - y0) || 100;
	const PAD = 26; // room for the glow around a bright star at the edge
	const S = (BOX.figure.w - PAD * 2) / span;
	const px = (n: number) => (n - x0) * S + PAD;
	const py = (n: number) => (n - y0) * S + PAD;
	const marks = new Set(pat.marks || []);
	return (
		<g>
			{pat.lines.map(([a, b], i) => (
				<line
					key={i}
					x1={px(pat.stars[a][0])}
					y1={py(pat.stars[a][1])}
					x2={px(pat.stars[b][0])}
					y2={py(pat.stars[b][1])}
					stroke={hot ? '#9fd6ff' : '#5f7f9e'}
					strokeWidth={hot ? 1.5 : 1}
					strokeLinecap="round"
					opacity={hot ? 0.95 : 0.55}
				/>
			))}
			{pat.stars.map(([x, y, m], i) => (
				<g key={i}>
					{(m === 3 || (hot && marks.has(i))) && (
						<circle cx={px(x)} cy={py(y)} r={STAR_R[m] * (hot ? 3 : 2.4)} fill="#cfe7ff" opacity={hot ? 0.3 : 0.18} />
					)}
					<circle cx={px(x)} cy={py(y)} r={STAR_R[m] * (hot ? 1.25 : 1)} fill={hot ? '#ffffff' : '#e6f1ff'} />
				</g>
			))}
		</g>
	);
}

// ---------------------------------------------------------------- the scene
//
// What the clouds and the constellations hang IN. A sky is not a blue
// rectangle: it is a colour that changes with the weather and the hour, a sun
// or a moon somewhere in it, and a line of hills along the bottom that tells
// you which way is up. Panning down reaches the treeline; panning up reaches
// the zenith; panning sideways goes round forever.

interface Palette {
	/** Top of the sky, and the band just above the hills. */
	top: string;
	low: string;
	/** The glow the sun or moon casts into that band. */
	glow: string;
	/** Far ridge, near ridge, and the trees on it. */
	ridge: string;
	near: string;
	/** A wash laid over everything — how thick the air is today. */
	haze?: string;
	hazeAt?: number;
	/** How far down the sky the deep colour holds before it starts paling to the
	 *  horizon, and where the horizon colour has fully taken over. Both come
	 *  early at dawn and dusk, when the warm band reaches most of the way up. */
	fade?: number;
	lowAt?: number;
	/** Where the sun hangs, as fractions of the field — omitted when the weather
	 *  has it hidden. */
	sun?: [number, number];
}

/** One palette per weather type, plus the two half-lit hours. Picked by eye
 *  against the game's own sky tints (weather.json's dayPhaseStyle). */
const PALETTES: Record<string, Palette> = {
	clear: { top: '#1f63b8', low: '#9ed3f2', glow: '#ffeec2', ridge: '#7fa2b0', near: '#3c6140', sun: [0.86, 0.14] },
	cloudy: {
		top: '#5c7089',
		low: '#aab7c6',
		glow: '#e2e3da',
		ridge: '#8496a2',
		near: '#3b5642',
		haze: '#c9d2da',
		hazeAt: 0.1,
	},
	rain: {
		top: '#3a4a5b',
		low: '#7d8994',
		glow: '#bcc4ca',
		ridge: '#6d7d88',
		near: '#2e4437',
		haze: '#8fa2b0',
		hazeAt: 0.16,
	},
	storm: {
		top: '#212c39',
		low: '#4c5866',
		glow: '#98a3b0',
		ridge: '#454f5c',
		near: '#22322a',
		haze: '#5d6a78',
		hazeAt: 0.2,
	},
	fog: {
		top: '#8c979d',
		low: '#cbd0d0',
		glow: '#e8e8e2',
		ridge: '#b4bcbd',
		near: '#68766a',
		haze: '#dfe3e3',
		hazeAt: 0.42,
	},
	snow: {
		top: '#66809f',
		low: '#c6d5e6',
		glow: '#f0f5fa',
		ridge: '#9fb0c0',
		near: '#586b60',
		haze: '#dbe5ee',
		hazeAt: 0.2,
	},
	heat: {
		top: '#3781bd',
		low: '#e7d5a0',
		glow: '#ffe9a8',
		ridge: '#a8a288',
		near: '#59683c',
		haze: '#f0e2b4',
		hazeAt: 0.14,
		sun: [0.86, 0.12],
	},
	dawn: {
		top: '#374a8c',
		low: '#f2ac78',
		glow: '#ffcf95',
		ridge: '#7d7f9a',
		near: '#2c3f35',
		fade: 0.1,
		lowAt: 0.55,
		sun: [0.86, 0.86],
	},
	dusk: {
		top: '#2c3c74',
		low: '#dc8a63',
		glow: '#ffb27a',
		ridge: '#6f7188',
		near: '#28382f',
		fade: 0.1,
		lowAt: 0.55,
		sun: [0.86, 0.88],
	},
	night: { top: '#060c1e', low: '#152037', glow: '#7f95c6', ridge: '#141f30', near: '#0d1715' },
};

export function paletteFor(mode: SkyMode, weather: string, phase: string): Palette {
	if (mode === 'night') return PALETTES.night;
	if (phase === 'dawn' || phase === 'dusk') return PALETTES[phase];
	return PALETTES[weather] || PALETTES.clear;
}

/** A ridgeline, as one path across `w` units — repeated to tile the field.
 *  Seeded off a fixed sequence so the hills are the same hills every time. */
function ridgePath(w: number, base: number, height: number, seed: number, steps: number): string {
	let s = seed;
	const rnd = () => {
		s = (s * 1103515245 + 12345) >>> 0;
		return s / 4294967295;
	};
	let d = `M0 ${base + height}`;
	for (let i = 0; i <= steps; i++) {
		const x = (i / steps) * w;
		const y = base - Math.sin((i / steps) * Math.PI * 3.1) * height * (0.45 + rnd() * 0.55);
		d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
	}
	return `${d} L${w} ${base + height} Z`;
}

/** A run of jagged peaks — the alpine's ridgeline, drawn as a saw rather than a
 *  roll, because that is the difference you see from the valley. */
function peakPath(w: number, base: number, height: number, seed: number, count: number): string {
	let s = seed;
	const rnd = () => {
		s = (s * 1103515245 + 12345) >>> 0;
		return s / 4294967295;
	};
	let d = `M0 ${base + height}`;
	for (let i = 0; i <= count; i++) {
		const x = (i / count) * w;
		const h = height * (0.5 + rnd() * 0.9);
		d += ` L${(x - w / count / 2).toFixed(1)} ${(base - h).toFixed(1)} L${x.toFixed(1)} ${(base + height * 0.15).toFixed(1)}`;
	}
	return `${d} L${w} ${base + height} Z`;
}

/** Smooth dunes: long sine humps with no jitter, because that is what wind-built
 *  sand looks like next to water-built hills. */
function dunePath(w: number, base: number, height: number, phase: number): string {
	let d = `M0 ${base + height}`;
	for (let i = 0; i <= 40; i++) {
		const x = (i / 40) * w;
		const y = base - Math.sin((i / 40) * Math.PI * 4 + phase) * height * 0.5 - height * 0.2;
		d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
	}
	return `${d} L${w} ${base + height} Z`;
}

/** Little repeated marks along a line — trees, reeds, cactus, grass. `shape`
 *  gets an x and returns one path. */
function scatter(w: number, seed: number, gap: number, shape: (x: number, r: number) => string): string {
	let s = seed;
	const rnd = () => {
		s = (s * 1103515245 + 12345) >>> 0;
		return s / 4294967295;
	};
	const out: string[] = [];
	for (let x = 10; x < w; x += gap * (0.6 + rnd())) out.push(shape(x, rnd()));
	return out.join(' ');
}

/** Conifer silhouettes — the preserve's own trees, seen from far enough away to
 *  be shapes. */
function treeLine(w: number, y: number, seed: number, scale = 1) {
	return scatter(w, seed, 30 * scale, (x, r) => {
		const h = (26 + r * 26) * scale;
		const half = h * 0.3;
		return `M${x.toFixed(1)} ${y} l${half.toFixed(1)} ${(-h).toFixed(1)} l${half.toFixed(1)} ${h} z`;
	});
}

/** What each biome's own horizon is made of. The sky above it is the weather's;
 *  the land below it is the place's — so a telescope on the coast looks out over
 *  water and one in the alpine looks out over rock, and you can tell where you
 *  set it up without being told. */
interface Ground {
	ridge: string;
	near: string;
	accent: string;
	/** Coast and wetland have water in front of the land. */
	water?: string;
}

export const BIOME_GROUND: Record<string, Ground> = {
	meadow: { ridge: '#8ba88f', near: '#41693f', accent: '#e8cf68' },
	forest: { ridge: '#6d8a76', near: '#26412c', accent: '#16281a' },
	wetland: { ridge: '#8ba392', near: '#3a5340', accent: '#8a9a52', water: '#4d707a' },
	desert: { ridge: '#cdae7e', near: '#9a734a', accent: '#5f7f4c' },
	alpine: { ridge: '#93a6b8', near: '#4b5763', accent: '#eef4fa' },
	coastal: { ridge: '#bcb08e', near: '#95875a', accent: '#6f9aa6', water: '#3f7180' },
};

export function groundFor(biome: string): Ground {
	return BIOME_GROUND[biome] || BIOME_GROUND.meadow;
}

/** The land itself, per biome, drawn from the horizon down. */
function Land({ biome, w, g, h }: { biome: string; w: number; g: number; h: number }) {
	const c = groundFor(biome);
	const floor = <rect x={0} y={g - 6} width={w} height={h - g + 12} fill={c.near} />;
	switch (biome) {
		case 'forest':
			return (
				<g>
					<path d={ridgePath(w, g - 60, 70, 7, 24)} fill={c.ridge} opacity={0.5} />
					<path d={treeLine(w, g - 30, 51, 1.5)} fill={c.ridge} opacity={0.75} />
					<path d={ridgePath(w, g - 8, 40, 91, 18)} fill={c.near} />
					{floor}
					<path d={treeLine(w, g + 4, 33, 2.1)} fill={c.accent} />
				</g>
			);
		case 'wetland':
			return (
				<g>
					<path d={ridgePath(w, g - 40, 34, 13, 22)} fill={c.ridge} opacity={0.5} />
					<path d={treeLine(w, g - 16, 61, 0.8)} fill={c.ridge} opacity={0.6} />
					<rect x={0} y={g - 6} width={w} height={h - g + 12} fill={c.water} />
					{/* still water: a few long flat glints */}
					{[0.1, 0.34, 0.58, 0.82].map((fx, i) => (
						<rect key={i} x={w * fx} y={g + 22 + i * 16} width={90} height={4} rx={2} fill="#dfeaf0" opacity={0.28} />
					))}
					{/* reeds standing in it */}
					<path
						d={scatter(w, 71, 26, (x, r) => `M${x.toFixed(1)} ${g + 14} l0 ${(-30 - r * 26).toFixed(1)}`)}
						stroke={c.accent}
						strokeWidth={3}
						fill="none"
					/>
					<path
						d={scatter(w, 71, 26, (x, r) => `M${x.toFixed(1)} ${(g - 20 - r * 24).toFixed(1)} l0 -12`)}
						stroke="#7a5c34"
						strokeWidth={5.5}
						strokeLinecap="round"
						fill="none"
					/>
				</g>
			);
		case 'desert':
			return (
				<g>
					{/* a mesa on the skyline, then two runs of dune */}
					<path d={`M${w * 0.16} ${g - 4} l0 -78 l${w * 0.1} 0 l0 78 z`} fill={c.ridge} opacity={0.55} />
					<path d={`M${w * 0.62} ${g - 4} l0 -54 l${w * 0.07} 0 l0 54 z`} fill={c.ridge} opacity={0.45} />
					<path d={dunePath(w, g - 30, 64, 0.6)} fill={c.ridge} opacity={0.75} />
					<path d={dunePath(w, g - 4, 52, 2.4)} fill={c.near} />
					{floor}
					{/* saguaro: a trunk and two arms */}
					<path
						d={scatter(
							w,
							87,
							150,
							(x, r) =>
								`M${x.toFixed(1)} ${g} l0 ${(-46 - r * 30).toFixed(1)} M${x.toFixed(1)} ${(g - 30).toFixed(1)} l-14 0 l0 -18 M${x.toFixed(1)} ${(g - 42).toFixed(1)} l14 0 l0 -14`,
						)}
						stroke={c.accent}
						strokeWidth={7}
						strokeLinecap="round"
						fill="none"
					/>
				</g>
			);
		case 'alpine':
			return (
				<g>
					<path d={peakPath(w, g - 40, 190, 5, 7)} fill={c.ridge} opacity={0.5} />
					<path d={peakPath(w, g - 10, 130, 29, 9)} fill={c.near} />
					{floor}
					{/* snow caught on the tops */}
					<path d={peakPath(w, g - 10, 130, 29, 9)} fill={c.accent} opacity={0.16} />
					<path d={treeLine(w, g + 10, 33, 0.7)} fill="#2b3a33" opacity={0.9} />
				</g>
			);
		case 'coastal':
			return (
				<g>
					<path d={dunePath(w, g - 26, 40, 1.2)} fill={c.ridge} opacity={0.6} />
					<rect x={0} y={g - 6} width={w} height={h - g + 12} fill={c.water} />
					{/* a strip of beach, then the sea with its lines of swell */}
					<path d={dunePath(w, g - 2, 26, 3.1)} fill={c.near} />
					{[0.06, 0.2, 0.36, 0.5, 0.66, 0.8, 0.94].map((fx, i) => (
						<rect
							key={i}
							x={w * fx}
							y={g + 30 + (i % 3) * 22}
							width={120}
							height={5}
							rx={2.5}
							fill="#e6f1f4"
							opacity={0.3}
						/>
					))}
					<path
						d={scatter(
							w,
							97,
							40,
							(x, r) => `M${x.toFixed(1)} ${g + 6} q4 ${(-16 - r * 12).toFixed(1)} 12 ${(-20 - r * 14).toFixed(1)}`,
						)}
						stroke={c.accent}
						strokeWidth={2.4}
						fill="none"
						opacity={0.8}
					/>
				</g>
			);
		default:
			// meadow: rolling grass, a scatter of flowers, one line of trees far off
			return (
				<g>
					<path d={ridgePath(w, g - 46, 54, 7, 26)} fill={c.ridge} opacity={0.55} />
					<path d={treeLine(w, g - 26, 51, 0.7)} fill={c.ridge} opacity={0.5} />
					<path d={ridgePath(w, g - 8, 74, 91, 22)} fill={c.near} />
					{floor}
					<path
						d={scatter(w, 33, 34, (x, r) => `M${x.toFixed(1)} ${g + 10} l0 ${(-14 - r * 12).toFixed(1)}`)}
						stroke="#5b8250"
						strokeWidth={3}
						strokeLinecap="round"
						fill="none"
					/>
					<path
						d={scatter(w, 41, 90, (x, r) => `M${x.toFixed(1)} ${(g + 2 - r * 8).toFixed(1)} a3 3 0 1 0 0.1 0`)}
						fill={c.accent}
						opacity={0.85}
					/>
				</g>
			);
	}
}

/** The faint background stars — not constellations, just sky. Generated once
 *  from a fixed sequence so the same stars are there every night. */
const DUST = (() => {
	let s = 1337;
	const rnd = () => {
		s = (s * 1664525 + 1013904223) >>> 0;
		return s / 4294967295;
	};
	const f = FIELDS.night;
	return Array.from({ length: 460 }, () => ({
		x: rnd() * f.w,
		y: rnd() * f.sky * 1.04,
		r: 0.5 + rnd() * 1.2,
		o: 0.2 + rnd() * 0.55,
	}));
})();

/** A few birds, far enough off to be marks rather than animals. Fixed spots —
 *  they are scenery, not a flock that needs simulating. */
const BIRDS: [number, number, number][] = [
	[0.18, 0.3, 1],
	[0.21, 0.33, 0.8],
	[0.245, 0.29, 0.9],
	[0.62, 0.2, 1],
	[0.655, 0.235, 0.75],
	[0.83, 0.42, 0.9],
];

/** One tile of the backdrop, drawn at `ox` — the panel draws three of these
 *  side by side so the sweep can run round the field forever. */
export function SkyScene({ mode, pal, ox, biome }: { mode: SkyMode; pal: Palette; ox: number; biome: string }) {
	const f = FIELDS[mode];
	const ground = f.sky;
	const id = `${mode}-${ox}`;
	return (
		<g transform={`translate(${ox} 0)`}>
			<defs>
				{/* Deep colour held through the top two thirds, paling only as it comes
				    down to the hills — a linear fade top to bottom washes the whole sky
				    out, because the eyepiece is usually looking at the middle of it. */}
				<linearGradient id={`sky-${id}`} x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stopColor={pal.top} />
					<stop offset={`${(pal.fade ?? 0.55) * 100}%`} stopColor={pal.top} />
					<stop offset={`${(pal.lowAt ?? 0.9) * 100}%`} stopColor={pal.low} />
					<stop offset="100%" stopColor={pal.glow} stopOpacity={0.5} />
				</linearGradient>
			</defs>
			<rect x={0} y={-400} width={f.w} height={ground + 400} fill={`url(#sky-${id})`} />
			{mode === 'night' &&
				DUST.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={d.r} fill="#dce8ff" opacity={d.o} />)}
			{/* the glow the sun or the moon leaves along the horizon */}
			<ellipse
				cx={f.w * 0.5}
				cy={ground}
				rx={f.w * 0.42}
				ry={150}
				fill={pal.glow}
				opacity={mode === 'night' ? 0.1 : 0.2}
			/>
			{pal.sun && (
				<g>
					<circle cx={f.w * pal.sun[0]} cy={f.sky * pal.sun[1]} r={104} fill={pal.glow} opacity={0.18} />
					<circle cx={f.w * pal.sun[0]} cy={f.sky * pal.sun[1]} r={58} fill={pal.glow} opacity={0.3} />
					<circle cx={f.w * pal.sun[0]} cy={f.sky * pal.sun[1]} r={26} fill="#fff6d8" />
				</g>
			)}
			{mode === 'day' &&
				BIRDS.map(([fx, fy, sc], i) => (
					<path
						key={i}
						d={`M${f.w * fx} ${ground * fy} q${5 * sc} ${-4 * sc} ${10 * sc} 0 q${5 * sc} ${-4 * sc} ${10 * sc} 0`}
						fill="none"
						stroke="#2f3a30"
						strokeWidth={1.6 * sc}
						opacity={0.4}
					/>
				))}
			{/* the land, which belongs to the biome rather than to the weather */}
			<Land biome={biome} w={f.w} g={ground} h={f.h} />
			{mode === 'night' && (
				<rect x={0} y={ground - 90} width={f.w} height={f.h - ground + 100} fill="#0a1018" opacity={0.72} />
			)}
			{pal.haze && <rect x={0} y={-400} width={f.w} height={ground + 400} fill={pal.haze} opacity={pal.hazeAt} />}
		</g>
	);
}

// ------------------------------------------------------- optics: light itself

/** The four things light does on its way through a sky, drawn in the cloud box. */
function opticShape(id: string) {
	switch (id) {
		case 'rainbow': {
			const bands = ['#c1524f', '#d08a45', '#d8c451', '#5f9a55', '#4a76b8', '#6a5a9c'];
			return (
				<g fill="none" strokeWidth={7} strokeLinecap="round">
					{bands.map((c, i) => (
						<path
							key={c}
							d={`M18 ${120} A ${92 + i * 7} ${92 + i * 7} 0 0 1 ${202 - i * 14} 120`}
							stroke={c}
							opacity={0.72}
						/>
					))}
					<rect x={0} y={118} width={220} height={14} fill="none" />
				</g>
			);
		}
		case 'sundogs':
			return (
				<g>
					<circle cx={110} cy={64} r={40} fill="none" stroke={SUN} strokeWidth={2.4} opacity={0.55} />
					<circle cx={110} cy={64} r={14} fill={SUN} />
					{[70, 150].map((cx) => (
						<g key={cx}>
							<ellipse cx={cx} cy={64} rx={11} ry={8} fill={SUN} opacity={0.9} />
							<ellipse cx={cx} cy={64} rx={20} ry={11} fill={SUN} opacity={0.28} />
						</g>
					))}
				</g>
			);
		case 'crepuscular-rays':
			return (
				<g>
					{[-34, -17, 0, 17, 34].map((a, i) => (
						<path
							key={i}
							d={`M110 46 L${110 + a * 1.5 - 9} 138 L${110 + a * 1.5 + 9} 138 Z`}
							fill={SUN}
							opacity={0.46 - Math.abs(a) * 0.004}
						/>
					))}
					{puffs(
						[
							[86, 44, 22],
							[118, 34, 26],
							[146, 46, 20],
						],
						SLATE,
					)}
					<rect x={70} y={46} width={92} height={12} rx={6} fill={SLATE} />
				</g>
			);
		case 'virga':
			return (
				<g>
					{puffs(
						[
							[88, 44, 20],
							[118, 34, 24],
							[146, 46, 18],
						],
						WHITE,
					)}
					<rect x={72} y={46} width={90} height={12} rx={6} fill={SHADE} />
					{[84, 100, 116, 132, 148].map((x, i) => (
						<path
							key={i}
							d={`M${x} 58 q${6 - i} 26 ${14 - i * 2} 40`}
							fill="none"
							stroke={RAIN}
							strokeWidth={3}
							strokeLinecap="round"
							opacity={0.75 - i * 0.06}
						/>
					))}
				</g>
			);
		default:
			return null;
	}
}

export function OpticArt({ id }: { id: string }) {
	return <g transform={`scale(${CLOUD_SCALE})`}>{opticShape(id)}</g>;
}

// ------------------------------------------ deep sky: the things that are not stars

/** A scatter of small stars in a box, from a fixed sequence — clusters, and the
 *  field stars a nebula sits in. */
function swarm(n: number, seed: number, cx: number, cy: number, spread: number, rmax = 2) {
	let s = seed;
	const rnd = () => {
		s = (s * 1103515245 + 12345) >>> 0;
		return s / 4294967295;
	};
	return Array.from({ length: n }, (_, i) => {
		const a = rnd() * Math.PI * 2;
		const d = Math.pow(rnd(), 0.6) * spread;
		return <circle key={i} cx={cx + Math.cos(a) * d} cy={cy + Math.sin(a) * d} r={0.7 + rnd() * rmax} fill="#eaf2ff" />;
	});
}

/** Everything in a 200×200 box with its middle at (100, 100). */
export function DeepArt({ id, hot }: { id: string; hot: boolean }) {
	const glow = hot ? 0.95 : 0.75;
	switch (id) {
		case 'milky-way':
			return (
				<g opacity={glow}>
					<g transform="rotate(-28 100 100)">
						<rect x={-30} y={64} width={260} height={72} rx={36} fill="#c9d8ff" opacity={0.13} />
						<rect x={-30} y={78} width={260} height={44} rx={22} fill="#dce6ff" opacity={0.12} />
						<rect x={-30} y={92} width={260} height={16} rx={8} fill="#1a2033" opacity={0.5} />
					</g>
					<g transform="rotate(-28 100 100)">{swarm(150, 5, 100, 100, 62, 1.1)}</g>
				</g>
			);
		case 'andromeda-galaxy':
			return (
				<g opacity={glow} transform="rotate(-24 100 100)">
					<ellipse cx={100} cy={100} rx={76} ry={26} fill="#cfd9ff" opacity={0.18} />
					<ellipse cx={100} cy={100} rx={52} ry={17} fill="#e2e7ff" opacity={0.3} />
					<ellipse cx={100} cy={100} rx={22} ry={11} fill="#fff6dd" opacity={0.85} />
					<ellipse cx={100} cy={88} rx={62} ry={4} fill="#7b86ad" opacity={0.35} />
					<ellipse cx={100} cy={112} rx={58} ry={3.5} fill="#7b86ad" opacity={0.3} />
				</g>
			);
		case 'orion-nebula':
			return (
				<g opacity={glow}>
					<ellipse cx={100} cy={104} rx={62} ry={48} fill="#79c6b4" opacity={0.16} />
					<ellipse cx={94} cy={98} rx={40} ry={34} fill="#8fd8c2" opacity={0.22} />
					<ellipse cx={112} cy={116} rx={26} ry={20} fill="#e0b0c8" opacity={0.2} />
					<path d="M62 78 q30 -18 62 6" fill="none" stroke="#0f1626" strokeWidth={7} opacity={0.35} />
					{[
						[96, 100],
						[104, 96],
						[100, 108],
						[108, 106],
					].map(([x, y], i) => (
						<circle key={i} cx={x} cy={y} r={2.4} fill="#ffffff" />
					))}
					{swarm(26, 11, 100, 100, 76, 0.9)}
				</g>
			);
		case 'pleiades':
			return (
				<g opacity={glow}>
					<ellipse cx={100} cy={100} rx={54} ry={44} fill="#9db9ff" opacity={0.14} />
					{[
						[74, 86],
						[96, 74],
						[118, 84],
						[88, 104],
						[110, 108],
						[128, 118],
						[96, 126],
					].map(([x, y], i) => (
						<g key={i}>
							<circle cx={x} cy={y} r={9} fill="#a9c6ff" opacity={0.22} />
							<circle cx={x} cy={y} r={3} fill="#ffffff" />
						</g>
					))}
					{swarm(30, 21, 100, 100, 58, 0.8)}
				</g>
			);
		case 'hercules-cluster':
			return (
				<g opacity={glow}>
					<circle cx={100} cy={100} r={46} fill="#dfe8ff" opacity={0.12} />
					<circle cx={100} cy={100} r={26} fill="#eef3ff" opacity={0.18} />
					{swarm(190, 31, 100, 100, 44, 1)}
				</g>
			);
		case 'ring-nebula':
			return (
				<g opacity={glow}>
					<circle cx={100} cy={100} r={34} fill="#6fc9c4" opacity={0.28} />
					<circle cx={100} cy={100} r={34} fill="none" stroke="#b8e6dd" strokeWidth={9} opacity={0.5} />
					<circle cx={100} cy={100} r={22} fill="#0e1524" />
					<circle cx={100} cy={100} r={2.2} fill="#ffffff" />
					{swarm(24, 41, 100, 100, 80, 0.8)}
				</g>
			);
		case 'lagoon-nebula':
			return (
				<g opacity={glow}>
					<ellipse cx={100} cy={100} rx={64} ry={40} fill="#e2879f" opacity={0.2} />
					<ellipse cx={88} cy={96} rx={38} ry={26} fill="#f0a0b4" opacity={0.22} />
					<path d="M58 108 q40 -22 86 -4" fill="none" stroke="#161d2e" strokeWidth={9} opacity={0.45} />
					{swarm(40, 51, 100, 100, 70, 1)}
				</g>
			);
		case 'double-cluster':
			return (
				<g opacity={glow}>
					<circle cx={72} cy={98} r={30} fill="#dfe8ff" opacity={0.1} />
					<circle cx={132} cy={104} r={28} fill="#dfe8ff" opacity={0.1} />
					{swarm(60, 61, 72, 98, 28, 1.2)}
					{swarm(55, 71, 132, 104, 26, 1.2)}
				</g>
			);
		case 'beehive':
			return (
				<g opacity={glow}>
					<circle cx={100} cy={100} r={54} fill="#dfe8ff" opacity={0.08} />
					{swarm(46, 81, 100, 100, 52, 1.5)}
				</g>
			);
		case 'whirlpool-galaxy':
			return (
				<g opacity={glow}>
					<circle cx={94} cy={104} r={46} fill="#cdd9ff" opacity={0.13} />
					<circle cx={94} cy={104} r={12} fill="#fff4d8" opacity={0.8} />
					<path
						d="M94 104 q28 -30 46 -6 q14 22 -12 36 q-30 16 -52 -8 q-20 -24 6 -46 q26 -20 52 -2"
						fill="none"
						stroke="#e3ebff"
						strokeWidth={5}
						opacity={0.45}
					/>
					<circle cx={146} cy={62} r={13} fill="#cdd9ff" opacity={0.2} />
					<circle cx={146} cy={62} r={5} fill="#fff2d4" opacity={0.75} />
					{swarm(20, 91, 100, 100, 84, 0.8)}
				</g>
			);
		default:
			return null;
	}
}

// ----------------------------------------------- the moon and the planets

/** Everything in a 170×170 box with its middle at (85, 85). */
export function BodyArt({ id, hot }: { id: string; hot: boolean }) {
	const halo = hot ? 0.35 : 0.22;
	switch (id) {
		case 'moon':
			return (
				<g>
					<circle cx={85} cy={85} r={62} fill="#e8eefc" opacity={halo * 0.5} />
					<circle cx={85} cy={85} r={44} fill="#efeadb" />
					<path d="M85 41 a44 44 0 0 0 0 88 a30 44 0 0 1 0 -88" fill="#dcd6c6" opacity={0.55} />
					{[
						[70, 66, 9],
						[96, 78, 6],
						[74, 100, 11],
						[100, 104, 5],
						[88, 56, 4],
					].map(([x, y, r], i) => (
						<circle key={i} cx={x} cy={y} r={r} fill="#cec7b4" opacity={0.75} />
					))}
				</g>
			);
		case 'jupiter':
			return (
				<g>
					<circle cx={85} cy={85} r={46} fill="#f0c48c" opacity={halo * 0.6} />
					<circle cx={85} cy={85} r={31} fill="#e8c79b" />
					<g clipPath="url(#jup)">
						<rect x={54} y={68} width={62} height={7} fill="#c9a173" opacity={0.85} />
						<rect x={54} y={82} width={62} height={9} fill="#d9b184" opacity={0.8} />
						<rect x={54} y={97} width={62} height={6} fill="#bf9367" opacity={0.8} />
						<ellipse cx={97} cy={92} rx={9} ry={5} fill="#c2705a" opacity={0.9} />
					</g>
					<clipPath id="jup">
						<circle cx={85} cy={85} r={31} />
					</clipPath>
					{[26, 44, 62, 82].map((d, i) => (
						<circle key={i} cx={85 + d + 8} cy={85 - 2 + i} r={2.6} fill="#fdf6e6" />
					))}
				</g>
			);
		case 'saturn':
			return (
				<g>
					<circle cx={85} cy={85} r={44} fill="#e6d4a4" opacity={halo * 0.5} />
					<ellipse cx={85} cy={85} rx={56} ry={17} fill="none" stroke="#dcc79a" strokeWidth={9} opacity={0.75} />
					<ellipse cx={85} cy={85} rx={56} ry={17} fill="none" stroke="#0f1524" strokeWidth={2.4} opacity={0.5} />
					<circle cx={85} cy={85} r={26} fill="#e3d3a6" />
					<ellipse cx={85} cy={78} rx={26} ry={7} fill="#efe2bb" opacity={0.6} />
					<path d="M29 85 a56 17 0 0 0 112 0" fill="none" stroke="#dcc79a" strokeWidth={9} opacity={0.75} />
				</g>
			);
		case 'mars':
			return (
				<g>
					<circle cx={85} cy={85} r={38} fill="#e08a5c" opacity={halo * 0.6} />
					<circle cx={85} cy={85} r={22} fill="#c96a44" />
					<ellipse cx={85} cy={68} rx={9} ry={4} fill="#f2ece2" opacity={0.9} />
					<ellipse cx={78} cy={92} rx={10} ry={6} fill="#a9522f" opacity={0.8} />
				</g>
			);
		case 'venus':
			return (
				<g>
					<circle cx={85} cy={85} r={46} fill="#fff3cf" opacity={halo * 0.7} />
					<circle cx={85} cy={85} r={24} fill="#fdf3d2" />
					<path d="M85 61 a24 24 0 0 1 0 48 a16 24 0 0 0 0 -48" fill="#e6d5a8" opacity={0.75} />
				</g>
			);
		default:
			return null;
	}
}

// -------------------------------------------- things that only happen sometimes

/** Everything in a 240×240 box with its middle at (120, 120). */
export function EventArt({ id, hot }: { id: string; hot: boolean }) {
	const on = hot ? 1 : 0.8;
	switch (id) {
		case 'perseids':
		case 'geminids': {
			const tint = id === 'perseids' ? '#dff0ff' : '#ffe9c6';
			const rx = id === 'perseids' ? 78 : 150;
			const ry = id === 'perseids' ? 66 : 78;
			return (
				<g opacity={on}>
					{swarm(30, id === 'perseids' ? 101 : 111, 120, 120, 96, 0.9)}
					{[0, 1, 2, 3, 4, 5, 6].map((i) => {
						const a = (i / 7) * Math.PI * 2 + 0.4;
						const near = 26 + (i % 3) * 14;
						const far = near + 52 + (i % 2) * 26;
						return (
							<line
								key={i}
								x1={rx + Math.cos(a) * near}
								y1={ry + Math.sin(a) * near}
								x2={rx + Math.cos(a) * far}
								y2={ry + Math.sin(a) * far}
								stroke={tint}
								strokeWidth={2.2}
								strokeLinecap="round"
								opacity={0.85 - i * 0.07}
							/>
						);
					})}
					<circle cx={rx} cy={ry} r={3} fill={tint} />
					<circle cx={rx} cy={ry} r={11} fill={tint} opacity={0.2} />
				</g>
			);
		}
		case 'aurora':
			return (
				<g opacity={on}>
					{[0, 1, 2].map((i) => (
						<path
							key={i}
							d={`M${40 + i * 52} 208 q${18 - i * 6} -70 ${8 + i * 10} -128 q${-6 + i * 4} -34 ${14 + i * 6} -52`}
							fill="none"
							stroke={i === 1 ? '#a6f0c8' : '#7fe0b4'}
							strokeWidth={26 - i * 4}
							strokeLinecap="round"
							opacity={0.22}
						/>
					))}
					{[0, 1, 2].map((i) => (
						<path
							key={`c${i}`}
							d={`M${40 + i * 52} 208 q${18 - i * 6} -70 ${8 + i * 10} -128 q${-6 + i * 4} -34 ${14 + i * 6} -52`}
							fill="none"
							stroke="#d8ffe8"
							strokeWidth={5}
							strokeLinecap="round"
							opacity={0.4}
						/>
					))}
					<path d="M28 176 q92 -26 190 -8" fill="none" stroke="#b58ce0" strokeWidth={14} opacity={0.14} />
				</g>
			);
		case 'satellites':
			return (
				<g opacity={on}>
					{swarm(24, 121, 120, 120, 92, 0.9)}
					<line
						x1={34}
						y1={168}
						x2={206}
						y2={72}
						stroke="#dbe8ff"
						strokeWidth={1.6}
						strokeDasharray="7 11"
						opacity={0.55}
					/>
					<circle cx={150} cy={103} r={3.4} fill="#ffffff" />
					<circle cx={150} cy={103} r={9} fill="#ffffff" opacity={0.22} />
				</g>
			);
		default:
			return null;
	}
}

/** One thing in the sky, whatever kind of thing it is. */
export function SkyArt({ kind, id, hot }: { kind: SkyKind; id: string; hot: boolean }) {
	switch (kind) {
		case 'cloud':
			return <CloudArt id={id} />;
		case 'optic':
			return <OpticArt id={id} />;
		case 'figure':
			return <ConstellationArt id={id} hot={hot} />;
		case 'deep':
			return <DeepArt id={id} hot={hot} />;
		case 'body':
			return <BodyArt id={id} hot={hot} />;
		case 'event':
			return <EventArt id={id} hot={hot} />;
		default:
			return null;
	}
}
