// The seventy-eight card faces.
//
// Classic tarot, drawn out of this game's world: the names and the meanings are
// the traditional ones, but the Fool steps off a mossy bluff as a young fox, the
// Star is a heron pouring at a pool, and the four suits are willow shoots, dew
// cups, reed blades and seed stones. A player who has learned this deck has
// learned a real one.
//
// Plain SVG, in the same flat-shape, no-outline style as the world sprites, for
// the same reason ui/skyArt.tsx is: none of this can be a world sprite, because
// the game has no High Priestess, and a card has to be drawn at the size the
// table is showing it rather than stamped from a fixed-resolution texture.
//
// Every scene is composed in the SAME 100x168 box with the origin at the top
// left, so the panel can put a card anywhere at any size without any of this
// knowing where it ended up. The Roman numeral and the suit pip in the corners
// are drawn rather than written, so a card face needs no translation.

import React from 'react';
import { COURT, cardDef, type Rank, type Suit } from './arcana';

/** The card box every scene is composed in. Roughly the proportions of a real
 *  tarot card (70x120mm), which is taller than a playing card. */
export const CARD_W = 100;
export const CARD_H = 168;

/** The window the picture lives in — inside the border, above the name band the
 *  panel draws in HTML underneath. */
const SCENE = { x: 8, y: 21, w: 84, h: 126 };

// The card palette. Warm and printed rather than lit, so a face reads the same
// against the light theme and the dark one — a card is an object on a table, not
// part of the interface.
const PARCH = '#f4ead2';
const PARCH_2 = '#e9dbba';
const INK = '#3a3a2c';
const SOFT = '#6f6a52';
const LINE = '#c9b184';
const GOLD = '#c9913f';
const CREAM = '#f8f2e2';
const DAY = '#bcd9e8';
const DUSK = '#e8b98a';
const NIGHT = '#2f3b57';
const WATER = '#7fb4d8';
const DEEP = '#4d7f9e';
const GREEN = '#4a7c59';
const LEAF = '#7cb564';
const GRASS = '#8fae5c';
const WOOD = '#8a6a48';
const BARK = '#6e4a33';
const STONE = '#9a9382';
const SLATE = '#6b6f63';
const ROSE = '#b5707a';
const EMBER = '#e08a4a';
const FLAME = '#f0c24a';
const SNOW = '#eef4f6';
const RUST = '#a9552f';

/** Fur and feather colors for the four suit families. */
const FOX = '#c9713d';
const FOX_2 = '#8f4a26';
const HERON = '#b9c6cf';
const HERON_2 = '#8494a1';
const HAWK = '#8a6b4e';
const HAWK_2 = '#5d4633';
const BADGER = '#6f6b62';
const BADGER_2 = '#33322c';

// --------------------------------------------------------------- primitives

/** The sky behind a scene: a flat wash, because a gradient at card size just
 *  reads as a smudge. */
const Sky = ({ fill = DAY }: { fill?: string }) => (
	<rect x={SCENE.x} y={SCENE.y} width={SCENE.w} height={SCENE.h} fill={fill} />
);

/** Level ground from `y` to the bottom of the scene. */
const Ground = ({ y, fill = GRASS }: { y: number; fill?: string }) => (
	<rect x={SCENE.x} y={y} width={SCENE.w} height={SCENE.y + SCENE.h - y} fill={fill} />
);

/** A soft horizon of low hills, drawn as three overlapping ellipses. */
const Hills = ({ y, fill = GREEN }: { y: number; fill?: string }) => (
	<g fill={fill}>
		<ellipse cx={26} cy={y + 8} rx={30} ry={12} />
		<ellipse cx={58} cy={y + 6} rx={26} ry={10} />
		<ellipse cx={86} cy={y + 9} rx={22} ry={11} />
	</g>
);

/** The two grey peaks that stand at the back of half the deck — the traditional
 *  "far mountains", which mean the thing you have not reached yet. */
const Peaks = ({ y, fill = SLATE }: { y: number; fill?: string }) => (
	<g fill={fill}>
		<path d={`M20 ${y} l14 -20 l14 20 z`} />
		<path d={`M48 ${y} l18 -26 l18 26 z`} />
		<path d={`M56 ${y - 14} l10 -12 l10 12 z`} fill={SNOW} opacity={0.75} />
	</g>
);

/** Still water: a band with two pale ripples on it. */
const Pool = ({ y, h = 18, fill = WATER }: { y: number; h?: number; fill?: string }) => (
	<g>
		<rect x={SCENE.x} y={y} width={SCENE.w} height={h} fill={fill} />
		<rect x={SCENE.x + 8} y={y + h * 0.35} width={30} height={1.6} rx={0.8} fill={CREAM} opacity={0.6} />
		<rect x={SCENE.x + 44} y={y + h * 0.62} width={24} height={1.6} rx={0.8} fill={CREAM} opacity={0.45} />
	</g>
);

const Sun = ({
	cx,
	cy,
	r = 13,
	fill = FLAME,
	rays = 12,
}: {
	cx: number;
	cy: number;
	r?: number;
	fill?: string;
	rays?: number;
}) => (
	<g>
		{Array.from({ length: rays }, (_, i) => {
			const a = (i / rays) * Math.PI * 2;
			return (
				<line
					key={i}
					x1={cx + Math.cos(a) * (r + 2)}
					y1={cy + Math.sin(a) * (r + 2)}
					x2={cx + Math.cos(a) * (r + 7)}
					y2={cy + Math.sin(a) * (r + 7)}
					stroke={fill}
					strokeWidth={i % 2 ? 1.2 : 2.2}
					strokeLinecap="round"
				/>
			);
		})}
		<circle cx={cx} cy={cy} r={r} fill={fill} />
	</g>
);

const Moon = ({
	cx,
	cy,
	r = 10,
	fill = CREAM,
	phase = 'crescent',
}: {
	cx: number;
	cy: number;
	r?: number;
	fill?: string;
	phase?: 'full' | 'crescent';
}) => (
	<g>
		<circle cx={cx} cy={cy} r={r} fill={fill} />
		{phase === 'crescent' && <circle cx={cx + r * 0.5} cy={cy - r * 0.2} r={r * 0.92} fill={NIGHT} />}
	</g>
);

/** An eight-pointed star, the shape the deck uses everywhere it means hope. */
const Star8 = ({ cx, cy, r = 7, fill = FLAME }: { cx: number; cy: number; r?: number; fill?: string }) => {
	const pts: string[] = [];
	for (let i = 0; i < 16; i++) {
		const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
		const rad = i % 2 ? r * 0.36 : r;
		pts.push(`${(cx + Math.cos(a) * rad).toFixed(2)},${(cy + Math.sin(a) * rad).toFixed(2)}`);
	}
	return <polygon points={pts.join(' ')} fill={fill} />;
};

/** A scatter of small stars, seeded by index so it never moves between renders. */
const Stars = ({ list, fill = CREAM }: { list: [number, number, number][]; fill?: string }) => (
	<g fill={fill}>
		{list.map(([cx, cy, r], i) => (
			<circle key={i} cx={cx} cy={cy} r={r} />
		))}
	</g>
);

/** The willow the game is named for: a short trunk and three falling curtains. */
const Willow = ({ x, y, s = 1, leaf = LEAF }: { x: number; y: number; s?: number; leaf?: string }) => (
	<g transform={`translate(${x} ${y}) scale(${s})`}>
		<rect x={-2.5} y={-14} width={5} height={16} rx={1.5} fill={BARK} />
		<ellipse cx={0} cy={-18} rx={17} ry={9} fill={leaf} />
		{[-12, -6, 0, 6, 12].map((dx, i) => (
			<path
				key={i}
				d={`M${dx} -18 q${dx / 3} 10 ${dx / 2} 16`}
				stroke={leaf}
				strokeWidth={1.8}
				fill="none"
				strokeLinecap="round"
			/>
		))}
	</g>
);

/** A plain conifer, for a ridge line. */
const Fir = ({ x, y, s = 1, fill = GREEN }: { x: number; y: number; s?: number; fill?: string }) => (
	<g transform={`translate(${x} ${y}) scale(${s})`}>
		<rect x={-1.2} y={-4} width={2.4} height={5} fill={BARK} />
		<path d="M0 -20 l7 10 h-14 z" fill={fill} />
		<path d="M0 -13 l8.5 12 h-17 z" fill={fill} />
	</g>
);

/** A cattail, the wetland's upright — the deck's pillar wherever two are needed. */
const Cattail = ({ x, y, h = 34, fill = BARK }: { x: number; y: number; h?: number; fill?: string }) => (
	<g>
		<rect x={x - 0.9} y={y - h} width={1.8} height={h} fill={GREEN} />
		<rect x={x - 2.6} y={y - h} width={5.2} height={11} rx={2.6} fill={fill} />
	</g>
);

/** A stand of reeds along a waterline. */
const Reeds = ({ x, y, n = 5, fill = GREEN }: { x: number; y: number; n?: number; fill?: string }) => (
	<g stroke={fill} strokeWidth={1.3} strokeLinecap="round" fill="none">
		{Array.from({ length: n }, (_, i) => (
			<path key={i} d={`M${x + i * 4} ${y} q${i % 2 ? 3 : -3} -7 ${i % 2 ? 1 : -1} -13`} />
		))}
	</g>
);

/** A small flower on a stem. */
const Bloom = ({
	x,
	y,
	r = 2.4,
	fill = ROSE,
	center = FLAME,
}: {
	x: number;
	y: number;
	r?: number;
	fill?: string;
	center?: string;
}) => (
	<g>
		<line x1={x} y1={y} x2={x} y2={y - 6} stroke={GREEN} strokeWidth={1.1} strokeLinecap="round" />
		{Array.from({ length: 5 }, (_, i) => {
			const a = (i / 5) * Math.PI * 2;
			return <circle key={i} cx={x + Math.cos(a) * r} cy={y - 6 + Math.sin(a) * r} r={r * 0.75} fill={fill} />;
		})}
		<circle cx={x} cy={y - 6} r={r * 0.6} fill={center} />
	</g>
);

const MEADOW_COLORS = [ROSE, FLAME, CREAM];

/** A row of little blooms along the ground, for the fertile cards. */
const Meadow = ({ y, colors = MEADOW_COLORS }: { y: number; colors?: string[] }) => (
	<g>
		{[13, 26, 39, 55, 68, 82].map((x, i) => (
			<Bloom key={x} x={x} y={y + (i % 2 ? 2 : 0)} fill={colors[i % colors.length]} r={2} />
		))}
	</g>
);

/**
 * A caretaker: the same flat, round-headed figure the world draws, at card size.
 * Everything the deck needs a person for is this shape in a different color,
 * which is what keeps twenty-two hand-composed scenes looking like one deck.
 */
const Figure = ({
	x,
	y,
	s = 1,
	robe = CREAM,
	trim = GOLD,
	skin = '#e0b48c',
	arms = 'down',
	flip = false,
}: {
	x: number;
	y: number;
	s?: number;
	robe?: string;
	trim?: string;
	skin?: string;
	arms?: 'down' | 'up' | 'out' | 'one-up' | 'reach';
	flip?: boolean;
}) => (
	<g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
		<path d="M-9 0 q0 -20 9 -20 q9 0 9 20 z" fill={robe} />
		<path d="M-9 0 q9 3 18 0 l0 -3 q-9 3 -18 0 z" fill={trim} />
		{arms === 'down' && (
			<path d="M-8 -15 l-3 12 M8 -15 l3 12" stroke={robe} strokeWidth={3.2} strokeLinecap="round" fill="none" />
		)}
		{arms === 'out' && (
			<path d="M-8 -16 l-9 3 M8 -16 l9 3" stroke={robe} strokeWidth={3.2} strokeLinecap="round" fill="none" />
		)}
		{arms === 'up' && (
			<path d="M-7 -16 l-6 -10 M7 -16 l6 -10" stroke={robe} strokeWidth={3.2} strokeLinecap="round" fill="none" />
		)}
		{arms === 'one-up' && (
			<path d="M-7 -16 l-5 -11 M7 -16 l4 11" stroke={robe} strokeWidth={3.2} strokeLinecap="round" fill="none" />
		)}
		{arms === 'reach' && (
			<path d="M-7 -16 l-11 -4 M7 -16 l11 -4" stroke={robe} strokeWidth={3.2} strokeLinecap="round" fill="none" />
		)}
		<circle cx={0} cy={-24} r={5.2} fill={skin} />
		<path d="M-5.4 -26 q5.4 -6 10.8 0 q-5.4 -3 -10.8 0 z" fill={BARK} />
	</g>
);

/** A bird in the air: two strokes, which is all a bird at this size can be. */
const Flier = ({ x, y, s = 1, fill = INK }: { x: number; y: number; s?: number; fill?: string }) => (
	<path
		d={`M${x - 4 * s} ${y} q${4 * s} ${-3.5 * s} ${4 * s} 0 q0 ${-3.5 * s} ${4 * s} 0`}
		stroke={fill}
		strokeWidth={1.3 * s}
		fill="none"
		strokeLinecap="round"
	/>
);

// ------------------------------------------------------------------ animals
//
// Four families carry the deck, one per suit, and they are the same four in the
// court cards and in the corners of the Wheel and the World: a fox for fire, a
// heron for water, a hawk for air, a badger for earth. Each is built from the
// same handful of shapes at four sizes, so a Page and a King are recognizably
// the same creature at different points in its life.

const Fox = ({ x, y, s = 1, sit = false }: { x: number; y: number; s?: number; sit?: boolean }) => (
	<g transform={`translate(${x} ${y}) scale(${s})`}>
		{sit ? (
			<path d="M-12 0 q-2 -15 10 -16 q12 1 11 16 z" fill={FOX} />
		) : (
			<>
				<ellipse cx={-1} cy={-8} rx={12} ry={6.5} fill={FOX} />
				<path d="M-9 -3 l-1 5 M-3 -3 l0 5 M4 -3 l1 5 M9 -4 l2 5" stroke={FOX_2} strokeWidth={2} strokeLinecap="round" />
			</>
		)}
		<path d="M-11 -6 q-11 1 -14 -9 q7 3 14 3 z" fill={FOX} />
		<path d="M-13 -7 q-6 0 -8 -4 q4 1 8 1 z" fill={CREAM} />
		<circle cx={9} cy={-15} r={6} fill={FOX} />
		<path d="M5 -19 l-1 -7 l6 4 z M13 -19 l3 -7 l2 7 z" fill={FOX} />
		<path d="M12 -12 l6 1 l-6 2 z" fill={INK} />
		<circle cx={7.5} cy={-16} r={1} fill={INK} />
		<path d="M5 -12 q4 3 8 0" fill={CREAM} />
	</g>
);

const Heron = ({ x, y, s = 1, wings = false }: { x: number; y: number; s?: number; wings?: boolean }) => (
	<g transform={`translate(${x} ${y}) scale(${s})`}>
		<path d="M-2 0 l0 -11 M4 0 l0 -11" stroke={FLAME} strokeWidth={1.5} strokeLinecap="round" />
		<ellipse cx={0} cy={-16} rx={10} ry={6} fill={HERON} />
		{wings && <path d="M-9 -18 q-8 -12 2 -16 q3 8 8 12 z" fill={HERON_2} />}
		{!wings && <path d="M-8 -17 q6 -5 12 -1 q-5 4 -12 1 z" fill={HERON_2} />}
		<path d="M5 -19 q6 -6 5 -14" stroke={HERON} strokeWidth={3} fill="none" strokeLinecap="round" />
		<circle cx={10} cy={-34} r={3.6} fill={HERON} />
		<path d="M12 -34 l8 2 l-8 1.6 z" fill={FLAME} />
		<path d="M8 -37 q4 -4 7 -2 q-4 1 -7 2 z" fill={BADGER_2} />
		<circle cx={9} cy={-35} r={0.8} fill={INK} />
	</g>
);

const Hawk = ({ x, y, s = 1, stoop = false }: { x: number; y: number; s?: number; stoop?: boolean }) => (
	<g transform={`translate(${x} ${y}) scale(${s})`}>
		{stoop ? (
			<>
				<ellipse cx={0} cy={-8} rx={6} ry={11} fill={HAWK} transform="rotate(24)" />
				<path d="M-4 -14 q-16 -8 -18 4 q10 1 18 2 z" fill={HAWK_2} />
				<path d="M4 -14 q16 -8 18 4 q-10 1 -18 2 z" fill={HAWK_2} />
			</>
		) : (
			<>
				<path d="M-3 0 l0 -8 M3 0 l0 -8" stroke={FLAME} strokeWidth={1.6} strokeLinecap="round" />
				<ellipse cx={0} cy={-14} rx={7} ry={10} fill={HAWK} />
				<path d="M-7 -18 q-5 8 -1 13 q3 -6 5 -10 z" fill={HAWK_2} />
				<path d="M-4 -8 l1 4 M0 -8 l0 4 M4 -8 l-1 4" stroke={CREAM} strokeWidth={1} />
			</>
		)}
		<circle cx={2} cy={-26} r={4.6} fill={HAWK} />
		<path d="M-2.6 -28 q4 -3 7 -1 q-4 0 -7 1 z" fill={CREAM} />
		<path d="M6 -27 q4 1 3 4 q-2 -2 -3 -4 z" fill={FLAME} />
		<circle cx={3} cy={-27} r={1} fill={INK} />
	</g>
);

const Badger = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => (
	<g transform={`translate(${x} ${y}) scale(${s})`}>
		<ellipse cx={0} cy={-8} rx={13} ry={7} fill={BADGER} />
		<path
			d="M-10 -2 l0 4 M-4 -2 l0 4 M4 -2 l0 4 M10 -2 l0 4"
			stroke={BADGER_2}
			strokeWidth={2.2}
			strokeLinecap="round"
		/>
		<circle cx={11} cy={-14} r={6} fill={CREAM} />
		<path d="M8 -19 q3 -3 6 0 q-3 -1 -6 0 z" fill={BADGER_2} />
		<path d="M9 -19 l-1.5 10 M14 -19 l1.5 9" stroke={BADGER_2} strokeWidth={2.4} strokeLinecap="round" />
		<path d="M15 -12 l4 1 l-4 1.6 z" fill={BADGER_2} />
		<circle cx={12} cy={-14} r={0.9} fill={INK} />
	</g>
);

const Stag = ({ x, y, s = 1, skull = false }: { x: number; y: number; s?: number; skull?: boolean }) => (
	<g transform={`translate(${x} ${y}) scale(${s})`}>
		{!skull && (
			<>
				<ellipse cx={-2} cy={-12} rx={13} ry={8} fill={WOOD} />
				<path
					d="M-11 -5 l-1 7 M-4 -5 l0 7 M4 -5 l1 7 M10 -6 l2 7"
					stroke={BARK}
					strokeWidth={2.2}
					strokeLinecap="round"
				/>
				<path d="M9 -18 q6 -2 6 6 l-4 2 z" fill={WOOD} />
			</>
		)}
		<ellipse cx={12} cy={-24} rx={4.4} ry={5.6} fill={skull ? CREAM : WOOD} />
		{skull && <circle cx={12} cy={-25} r={1.6} fill={SOFT} />}
		{!skull && <circle cx={13.5} cy={-25} r={1} fill={INK} />}
		<path
			d="M9 -29 q-3 -9 -8 -11 q4 0 6 3 q-1 -5 -3 -7 q4 2 6 6 M15 -29 q3 -9 8 -11 q-4 0 -6 3 q1 -5 3 -7 q-4 2 -6 6"
			stroke={skull ? CREAM : BARK}
			strokeWidth={1.6}
			fill="none"
			strokeLinecap="round"
		/>
	</g>
);

const Hare = ({
	x,
	y,
	s = 1,
	howl = false,
	flip = false,
}: {
	x: number;
	y: number;
	s?: number;
	howl?: boolean;
	flip?: boolean;
}) => (
	<g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
		<path d="M-9 0 q-1 -12 6 -13 q8 1 7 13 z" fill={STONE} />
		<circle cx={5} cy={-16} r={5} fill={STONE} />
		<path
			d={
				howl
					? 'M2 -20 q-2 -12 1 -13 q3 2 2 13 z M7 -20 q0 -12 3 -13 q3 3 1 13 z'
					: 'M2 -20 q-4 -10 -1 -12 q4 1 4 12 z M7 -20 q1 -11 5 -12 q2 3 -2 12 z'
			}
			fill={STONE}
		/>
		<circle cx={7} cy={-17} r={1} fill={INK} />
		<circle cx={-9} cy={-3} r={3} fill={CREAM} />
	</g>
);

const Owl = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => (
	<g transform={`translate(${x} ${y}) scale(${s})`}>
		<path d="M-10 0 q-2 -22 10 -22 q12 0 10 22 z" fill={CREAM} />
		<path d="M-7 -4 q7 4 14 0 q-7 6 -14 0 z" fill={WOOD} opacity={0.5} />
		<path d="M-9 -18 q9 -12 18 0 q-9 -5 -18 0 z" fill={WOOD} />
		<circle cx={-4} cy={-16} r={4.2} fill={CREAM} />
		<circle cx={4} cy={-16} r={4.2} fill={CREAM} />
		<circle cx={-4} cy={-16} r={2} fill={INK} />
		<circle cx={4} cy={-16} r={2} fill={INK} />
		<path d="M0 -15 l-2 3 h4 z" fill={FLAME} />
	</g>
);

// ------------------------------------------------------------ suit emblems
//
// The four suits, drawn out of the preserve: a willow shoot for Wands, a
// dew-filled bloom for Cups, a reed blade for Swords, a carved seed stone for
// Pentacles. Every emblem is composed around (0, 0) so the pip layouts below can
// stamp it anywhere without knowing what it is.

const WandEmblem = ({ s = 1 }: { s?: number }) => (
	<g transform={`scale(${s})`}>
		<rect x={-1.4} y={-11} width={2.8} height={22} rx={1.4} fill={WOOD} />
		<path d="M1 -6 q7 -2 8 -8 q-8 0 -8 8 z" fill={LEAF} />
		<path d="M-1 1 q-7 -2 -8 -8 q8 0 8 8 z" fill={LEAF} />
		<circle cx={0} cy={-12} r={2} fill={LEAF} />
	</g>
);

const CupEmblem = ({ s = 1 }: { s?: number }) => (
	<g transform={`scale(${s})`}>
		<path d="M-7 -6 q7 12 14 0 z" fill={GOLD} />
		<rect x={-1.4} y={5} width={2.8} height={4} fill={GOLD} />
		<ellipse cx={0} cy={9.4} rx={5.4} ry={1.9} fill={GOLD} />
		<ellipse cx={0} cy={-6} rx={7} ry={2.3} fill={WATER} />
		<circle cx={0} cy={-9.5} r={2} fill={CREAM} opacity={0.85} />
	</g>
);

const SwordEmblem = ({ s = 1 }: { s?: number }) => (
	<g transform={`scale(${s})`}>
		<path d="M0 -12 l2.4 6 l0 11 l-4.8 0 l0 -11 z" fill={HERON} />
		<rect x={-5.4} y={5} width={10.8} height={2.2} rx={1.1} fill={GOLD} />
		<rect x={-1.2} y={7} width={2.4} height={5} rx={1.2} fill={BARK} />
	</g>
);

const PentacleEmblem = ({ s = 1 }: { s?: number }) => {
	const pts: string[] = [];
	for (let i = 0; i < 5; i++) {
		const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
		pts.push(`${(Math.cos(a) * 6).toFixed(2)},${(Math.sin(a) * 6).toFixed(2)}`);
	}
	return (
		<g transform={`scale(${s})`}>
			<circle cx={0} cy={0} r={9} fill={STONE} />
			<circle cx={0} cy={0} r={9} fill="none" stroke={SOFT} strokeWidth={1} />
			<polygon points={pts.join(' ')} fill="none" stroke={CREAM} strokeWidth={1.3} strokeLinejoin="round" />
		</g>
	);
};

const EMBLEM: Record<Suit, (p: { s?: number }) => React.JSX.Element> = {
	wands: WandEmblem,
	cups: CupEmblem,
	swords: SwordEmblem,
	pentacles: PentacleEmblem,
};

/** The suit's own color, for the pip corner and the card's ground. */
const SUIT_TINT: Record<Suit, string> = {
	wands: EMBER,
	cups: DEEP,
	swords: HERON_2,
	pentacles: GREEN,
};

/** Which family stands in a suit's court cards. */
const COURT_ANIMAL: Record<Suit, (p: { x: number; y: number; s?: number }) => React.JSX.Element> = {
	wands: (p) => <Fox {...p} sit />,
	cups: (p) => <Heron {...p} />,
	swords: (p) => <Hawk {...p} />,
	pentacles: (p) => <Badger {...p} />,
};

// ------------------------------------------------------- the Major Arcana
//
// Twenty-two hand-composed scenes, one per card, in journey order. Each is the
// traditional picture recast: the same gesture, the same objects, the same
// meaning, told with the animals and the plants of the preserve. The Fool still
// steps off a cliff with a bundle on a stick; he is just a fox this time.

const MAJOR_SCENES: Record<string, () => React.JSX.Element> = {
	// 0 — the first step, taken before you know where the ground is.
	fool: () => (
		<g>
			<Sky fill={DAY} />
			<Peaks y={92} />
			<Sun cx={72} cy={40} r={8} fill={CREAM} rays={10} />
			<path d="M8 108 h44 l0 39 h-44 z" fill={GRASS} />
			<path d="M52 108 q6 14 10 39 h-10 z" fill={STONE} />
			<Bloom x={16} y={106} fill={CREAM} />
			<Fox x={38} y={108} s={0.9} />
			<path d="M26 100 l-12 -18" stroke={WOOD} strokeWidth={2} strokeLinecap="round" />
			<path d="M11 82 q6 -5 9 3 q-6 4 -9 -3 z" fill={ROSE} />
			<Flier x={26} y={44} s={1.1} />
			<Flier x={40} y={52} s={0.8} />
			<Bloom x={72} y={140} fill={FLAME} r={1.8} />
		</g>
	),
	// I — everything you need is already on the table.
	magician: () => (
		<g>
			<Sky fill={DUSK} />
			<Ground y={112} fill={GRASS} />
			<Meadow y={126} colors={[ROSE, FLAME]} />
			<path d="M20 26 q30 10 60 0" stroke={LEAF} strokeWidth={2} fill="none" />
			{[26, 40, 54, 68].map((x) => (
				<circle key={x} cx={x} cy={30 + (x % 28 === 12 ? 2 : 0)} r={2.2} fill={ROSE} />
			))}
			<ellipse cx={50} cy={112} rx={26} ry={5} fill={WOOD} />
			<rect x={44} y={114} width={12} height={16} fill={BARK} />
			<g transform="translate(28 108) scale(0.62)">
				<WandEmblem />
			</g>
			<g transform="translate(41 108) scale(0.62)">
				<CupEmblem />
			</g>
			<g transform="translate(59 108) scale(0.62)">
				<SwordEmblem />
			</g>
			<g transform="translate(72 108) scale(0.55)">
				<PentacleEmblem />
			</g>
			<Figure x={50} y={104} s={1.15} robe={CREAM} trim={GOLD} arms="one-up" />
			<rect x={36} y={44} width={2} height={22} rx={1} fill={WOOD} transform="rotate(-14 37 55)" />
			<path d="M42 40 q7 0 7 -7 q-7 0 -7 7 z" fill={LEAF} />
			<path d="M44 34 q8 4 16 0 q-8 8 -16 0 z" fill={GOLD} opacity={0.6} />
		</g>
	),
	// II — the one who knows and does not say.
	'high-priestess': () => (
		<g>
			<Sky fill={NIGHT} />
			<Stars
				list={[
					[18, 34, 1],
					[30, 28, 0.8],
					[70, 32, 1],
					[82, 42, 0.9],
					[50, 26, 0.7],
				]}
			/>
			<Pool y={118} h={29} fill={DEEP} />
			<rect x={26} y={30} width={48} height={90} fill={INK} opacity={0.35} />
			<Cattail x={26} y={124} h={78} fill={BARK} />
			<Cattail x={74} y={124} h={78} fill={CREAM} />
			<path d="M32 40 q18 -8 36 0 l0 60 q-18 8 -36 0 z" fill={GREEN} opacity={0.45} />
			{[36, 44, 52, 60, 68].map((x) => (
				<path
					key={x}
					d={`M${x} 40 q${x % 16 ? 3 : -3} 30 0 60`}
					stroke={LEAF}
					strokeWidth={1.2}
					fill="none"
					opacity={0.7}
				/>
			))}
			<Owl x={50} y={116} s={1.25} />
			<Moon cx={50} cy={130} r={6} fill={CREAM} phase="crescent" />
			<Star8 cx={50} cy={44} r={5} fill={CREAM} />
		</g>
	),
	// III — abundance, and the patience it takes to grow any of it.
	empress: () => (
		<g>
			<Sky fill={DAY} />
			<Hills y={92} fill={GREEN} />
			<Ground y={100} fill={GRASS} />
			<Willow x={20} y={104} s={0.85} />
			<Willow x={82} y={104} s={0.7} />
			<rect x={8} y={122} width={84} height={25} fill={FLAME} opacity={0.45} />
			{[12, 20, 28, 36, 44, 52, 60, 68, 76, 84].map((x, i) => (
				<path key={x} d={`M${x} 147 l0 -${16 + (i % 3) * 3}`} stroke={GOLD} strokeWidth={1.6} strokeLinecap="round" />
			))}
			<Stag x={54} y={122} s={1.1} />
			{[0, 1, 2, 3, 4, 5, 6].map((i) => (
				<Star8 key={i} cx={38 + i * 5} cy={38} r={2.6} fill={CREAM} />
			))}
			<Bloom x={16} y={140} fill={ROSE} />
			<Bloom x={88} y={144} fill={CREAM} />
		</g>
	),
	// IV — the shape a thing keeps when someone insists on it.
	emperor: () => (
		<g>
			<Sky fill={RUST} />
			<Peaks y={100} fill={SLATE} />
			<Ground y={104} fill="#a8875f" />
			<rect x={34} y={82} width={32} height={40} rx={2} fill={STONE} />
			<rect x={30} y={76} width={40} height={8} rx={2} fill={SOFT} />
			{[36, 46, 56, 66].map((x) => (
				<circle key={x} cx={x} cy={72} r={4} fill={STONE} />
			))}
			<Stag x={50} y={100} s={1.05} />
			<rect x={72} y={92} width={2.4} height={34} rx={1.2} fill={WOOD} />
			<circle cx={73} cy={90} r={4} fill={GOLD} />
			<path d="M12 128 h76" stroke={SOFT} strokeWidth={1.4} />
			<Bloom x={20} y={142} fill={FLAME} r={1.7} />
		</g>
	),
	// V — what the people before you worked out, offered whole.
	hierophant: () => (
		<g>
			<Sky fill={PARCH_2} />
			<Ground y={116} fill="#b9a97e" />
			<rect x={20} y={30} width={7} height={90} fill={STONE} />
			<rect x={73} y={30} width={7} height={90} fill={STONE} />
			<path d="M40 116 l0 -46 q10 -22 20 0 l0 46 z" fill={BARK} />
			<ellipse cx={50} cy={62} rx={24} ry={16} fill={GREEN} />
			<ellipse cx={50} cy={54} rx={16} ry={11} fill={LEAF} />
			<ellipse cx={50} cy={88} rx={5} ry={7} fill={INK} opacity={0.55} />
			{[0, 1, 2, 3].map((i) => (
				<circle key={i} cx={44 + i * 4} cy={44} r={1.6} fill={FLAME} />
			))}
			<Figure x={38} y={140} s={0.72} robe="#a8bfa0" trim={GOLD} arms="up" />
			<Figure x={62} y={140} s={0.72} robe="#c8b28e" trim={GOLD} arms="up" />
			<path d="M44 122 l6 8 l6 -8" stroke={GOLD} strokeWidth={1.6} fill="none" strokeLinecap="round" />
		</g>
	),
	// VI — a choice made with the whole of you, not half.
	lovers: () => (
		<g>
			<Sky fill={DAY} />
			<Sun cx={50} cy={38} r={8} fill={FLAME} rays={10} />
			<Hills y={96} fill={GREEN} />
			<Ground y={104} fill={GRASS} />
			<path d="M18 104 q0 -34 20 -40" stroke={BARK} strokeWidth={3} fill="none" strokeLinecap="round" />
			<ellipse cx={22} cy={62} rx={12} ry={10} fill={LEAF} />
			{[16, 22, 27].map((x, i) => (
				<circle key={x} cx={x} cy={58 + i * 4} r={2} fill={ROSE} />
			))}
			<path d="M82 104 q0 -34 -20 -40" stroke={BARK} strokeWidth={3} fill="none" strokeLinecap="round" />
			<ellipse cx={78} cy={62} rx={12} ry={10} fill={EMBER} />
			<path d="M70 76 q10 6 16 -2 q-6 10 -16 2 z" fill={GREEN} />
			<Heron x={38} y={132} s={0.72} />
			<g transform="scale(-1 1) translate(-124 0)">
				<Heron x={62} y={132} s={0.72} />
			</g>
			<Bloom x={50} y={144} fill={CREAM} r={2} />
		</g>
	),
	// VII — two pulls, one road, and your hands on both.
	chariot: () => (
		<g>
			<Sky fill={NIGHT} />
			<Stars
				list={[
					[18, 32, 1],
					[34, 26, 0.8],
					[66, 28, 0.9],
					[82, 36, 1],
				]}
			/>
			<rect x={8} y={96} width={84} height={12} fill={STONE} />
			{[12, 24, 36, 48, 60, 72, 84].map((x) => (
				<rect key={x} x={x} y={90} width={7} height={6} fill={SOFT} />
			))}
			<Ground y={108} fill="#8a8a68" />
			<rect x={38} y={104} width={30} height={18} rx={3} fill={WOOD} />
			<rect x={38} y={100} width={30} height={5} rx={2} fill={GOLD} />
			<circle cx={44} cy={126} r={7} fill={BARK} />
			<circle cx={62} cy={126} r={7} fill={BARK} />
			<circle cx={44} cy={126} r={2.4} fill={GOLD} />
			<circle cx={62} cy={126} r={2.4} fill={GOLD} />
			<Figure x={53} y={102} s={0.85} robe="#8fa8c4" trim={GOLD} arms="out" />
			<Hare x={22} y={130} s={0.8} />
			<Hare x={34} y={136} s={0.8} flip />
			<path d="M14 122 l24 -12" stroke={CREAM} strokeWidth={1.2} />
			<Star8 cx={53} cy={92} r={3.4} fill={CREAM} />
		</g>
	),
	// VIII — the soft hand that closes the jaws.
	strength: () => (
		<g>
			<Sky fill={DUSK} />
			<Hills y={100} fill={GREEN} />
			<Ground y={110} fill={GRASS} />
			<path
				d="M36 34 q7 -7 14 0 q-7 7 -14 0 z M50 34 q7 -7 14 0 q-7 7 -14 0 z"
				fill="none"
				stroke={GOLD}
				strokeWidth={1.6}
			/>
			<g transform="translate(66 128) scale(1.05)">
				<path d="M-14 0 q-2 -14 9 -15 q12 1 10 15 z" fill={WOOD} />
				<circle cx={8} cy={-18} r={7} fill={WOOD} />
				<path d="M3 -23 l-1 -6 l5 3 z M13 -23 l4 -6 l1 6 z" fill={WOOD} />
				<path d="M11 -14 q5 0 6 3 q-4 1 -6 -3 z" fill={CREAM} />
				<circle cx={6} cy={-19} r={1} fill={INK} />
			</g>
			<Figure x={36} y={132} s={1} robe={CREAM} trim={LEAF} arms="reach" />
			<Bloom x={20} y={144} fill={ROSE} r={1.8} />
			<Bloom x={88} y={140} fill={FLAME} r={1.8} />
		</g>
	),
	// IX — a light carried away from everyone, and then back.
	hermit: () => (
		<g>
			<Sky fill="#2b3346" />
			<Stars
				list={[
					[16, 30, 0.9],
					[30, 38, 0.7],
					[76, 30, 1],
					[86, 44, 0.8],
				]}
			/>
			<Peaks y={112} fill="#565b56" />
			<Ground y={116} fill={SNOW} />
			<Fir x={20} y={120} s={0.8} fill="#3d5f47" />
			<Fir x={86} y={124} s={0.7} fill="#3d5f47" />
			<Figure x={52} y={140} s={1.15} robe="#8d8974" trim={SOFT} arms="one-up" />
			<rect x={64} y={102} width={2} height={38} rx={1} fill={BARK} />
			<g transform="translate(38 98)">
				<rect x={-5} y={-6} width={10} height={12} rx={2} fill={SOFT} />
				<Star8 cx={0} cy={0} r={4} fill={FLAME} />
				<rect x={-1} y={-11} width={2} height={5} fill={SOFT} />
			</g>
			<path d="M38 104 l-2 12" stroke={FLAME} strokeWidth={1} opacity={0.5} />
		</g>
	),
	// X — the turn nobody is holding the handle of.
	wheel: () => (
		<g>
			<Sky fill="#4a5f7a" />
			<Stars
				list={[
					[16, 32, 0.9],
					[84, 34, 0.9],
				]}
			/>
			<circle cx={50} cy={86} r={30} fill={PARCH_2} />
			<circle cx={50} cy={86} r={30} fill="none" stroke={GOLD} strokeWidth={2.4} />
			<circle cx={50} cy={86} r={19} fill="none" stroke={SOFT} strokeWidth={1.4} />
			{Array.from({ length: 8 }, (_, i) => {
				const a = (i / 8) * Math.PI * 2;
				return (
					<line
						key={i}
						x1={50 + Math.cos(a) * 6}
						y1={86 + Math.sin(a) * 6}
						x2={50 + Math.cos(a) * 29}
						y2={86 + Math.sin(a) * 29}
						stroke={SOFT}
						strokeWidth={1.6}
					/>
				);
			})}
			<circle cx={50} cy={86} r={6} fill={GOLD} />
			<circle cx={50} cy={56} r={4.4} fill={LEAF} />
			<circle cx={80} cy={86} r={4.4} fill={FLAME} />
			<circle cx={50} cy={116} r={4.4} fill={RUST} />
			<circle cx={20} cy={86} r={4.4} fill={SNOW} />
			<Hawk x={18} y={40} s={0.42} />
			<Fox x={82} y={42} s={0.42} sit />
			<Badger x={18} y={140} s={0.42} />
			<Stag x={80} y={142} s={0.42} />
		</g>
	),
	// XI — the scales do not care who is holding them.
	justice: () => (
		<g>
			<Sky fill={PARCH_2} />
			<rect x={22} y={26} width={6} height={96} fill={STONE} />
			<rect x={72} y={26} width={6} height={96} fill={STONE} />
			<path d="M22 30 h56" stroke={SOFT} strokeWidth={3} />
			<Ground y={122} fill="#b0a37c" />
			<Heron x={50} y={122} s={1.1} />
			<path d="M34 70 h32" stroke={GOLD} strokeWidth={1.6} />
			<rect x={49} y={54} width={2} height={17} fill={GOLD} />
			<path d="M28 70 q6 10 12 0 z" fill={GOLD} />
			<path d="M60 70 q6 10 12 0 z" fill={GOLD} />
			<line x1={34} y1={70} x2={34} y2={62} stroke={GOLD} strokeWidth={1} />
			<line x1={66} y1={70} x2={66} y2={62} stroke={GOLD} strokeWidth={1} />
			<path d="M84 118 l0 -34 l3 -8 l3 8 l0 34 z" fill={LEAF} />
		</g>
	),
	// XII — hanging still on purpose, and seeing it differently.
	'hanged-man': () => (
		<g>
			<Sky fill="#8fb0c4" />
			<Ground y={128} fill={GRASS} />
			<rect x={16} y={40} width={5} height={90} fill={BARK} />
			<rect x={79} y={40} width={5} height={90} fill={BARK} />
			<rect x={16} y={40} width={68} height={5} fill={BARK} />
			<path d="M20 45 q6 8 2 14 M84 45 q-6 8 -2 14" stroke={LEAF} strokeWidth={2} fill="none" />
			<line x1={50} y1={45} x2={50} y2={62} stroke={SOFT} strokeWidth={1.4} />
			<circle cx={50} cy={68} r={16} fill={FLAME} opacity={0.28} />
			<g transform="translate(50 62)">
				<path d="M-8 0 q0 22 8 22 q8 0 8 -22 z" fill={BADGER_2} />
				<path d="M-8 4 q-13 -6 -10 -16 q7 6 10 12 z" fill="#4a4740" />
				<path d="M8 4 q13 -6 10 -16 q-7 6 -10 12 z" fill="#4a4740" />
				<circle cx={-2.6} cy={19} r={1} fill={FLAME} />
				<circle cx={2.6} cy={19} r={1} fill={FLAME} />
			</g>
			<Bloom x={26} y={144} fill={CREAM} r={1.8} />
		</g>
	),
	// XIII — the ending that is the only door to the next thing.
	death: () => (
		<g>
			<Sky fill="#d9c9a8" />
			<Sun cx={72} cy={44} r={9} fill={FLAME} rays={0} />
			<Peaks y={92} fill="#8b8c86" />
			<Ground y={100} fill="#9d9a72" />
			<Pool y={112} h={10} fill={DEEP} />
			<Ground y={122} fill="#8f9367" />
			<Stag x={44} y={140} s={1.25} skull />
			<Bloom x={44} y={110} fill={CREAM} r={2.6} center={FLAME} />
			<Reeds x={72} y={124} n={5} fill={GREEN} />
			<Flier x={28} y={50} s={1} fill={SOFT} />
			<Flier x={40} y={58} s={0.8} fill={SOFT} />
			<Bloom x={16} y={144} fill={ROSE} r={1.8} />
			<Bloom x={86} y={146} fill={CREAM} r={1.8} />
		</g>
	),
	// XIV — one foot in the water, one on the bank, pouring carefully.
	temperance: () => (
		<g>
			<Sky fill="#cfe0d8" />
			<Peaks y={78} fill="#8d9a9c" />
			<Sun cx={50} cy={30} r={6} fill={FLAME} rays={8} />
			<Ground y={104} fill={GRASS} />
			<Pool y={116} h={31} fill={DEEP} />
			<path d="M8 104 q30 -6 60 4 l0 12 h-60 z" fill={GRASS} />
			<Heron x={46} y={120} s={1.2} wings />
			<g transform="translate(28 88) scale(0.62)">
				<CupEmblem />
			</g>
			<g transform="translate(70 104) scale(0.62)">
				<CupEmblem />
			</g>
			<path d="M31 94 q12 6 36 4" stroke={WATER} strokeWidth={2.2} fill="none" strokeLinecap="round" />
			{[18, 24, 30].map((x, i) => (
				<Bloom key={x} x={x} y={116 + i} fill="#d8c04a" r={1.8} />
			))}
			<path d="M76 66 l0 20 M70 76 h12" stroke={GOLD} strokeWidth={1.4} />
		</g>
	),
	// XV — the chain is loose. It always was.
	devil: () => (
		<g>
			<Sky fill="#241f28" />
			<Ground y={124} fill="#3a3038" />
			<path d="M50 124 q-16 -6 -14 -30 q2 -20 14 -22 q12 2 14 22 q2 24 -14 30 z" fill="#4a3a30" />
			<path d="M40 74 q-12 -10 -16 -22 q10 6 16 14 z M60 74 q12 -10 16 -22 q-10 6 -16 14 z" fill="#4a3a30" />
			<circle cx={44} cy={92} r={3.4} fill={EMBER} />
			<circle cx={56} cy={92} r={3.4} fill={EMBER} />
			<path d="M44 104 q6 6 12 0 q-6 -1 -12 0 z" fill={INK} />
			{[26, 34, 66, 74].map((x, i) => (
				<path
					key={x}
					d={`M${x} 60 q${i % 2 ? 6 : -6} 14 ${i % 2 ? 2 : -2} 26`}
					stroke="#5c4a2e"
					strokeWidth={1.6}
					fill="none"
				/>
			))}
			<Figure x={24} y={146} s={0.66} robe="#6d6152" trim="#4a4034" arms="down" />
			<Figure x={76} y={146} s={0.66} robe="#6d6152" trim="#4a4034" arms="down" />
			{[24, 76].map((x) => (
				<path
					key={x}
					d={`M${x} 124 q${x < 50 ? 10 : -10} 4 ${x < 50 ? 22 : -22} 2`}
					stroke={LEAF}
					strokeWidth={1.4}
					fill="none"
					opacity={0.75}
				/>
			))}
			<path d="M14 44 l0 16 M11 46 q3 -8 6 0" stroke={EMBER} strokeWidth={1.6} fill="none" />
		</g>
	),
	// XVI — what was built wrong comes down in a second, and quickly.
	tower: () => (
		<g>
			<Sky fill="#1e2436" />
			<Ground y={130} fill="#403c30" />
			<path d="M42 130 l3 -70 l10 0 l3 70 z" fill={SLATE} />
			<path d="M40 60 q10 -8 20 0 l-3 -8 q-7 -4 -14 0 z" fill={BARK} />
			<path d="M60 52 l16 -12 l-4 10 z" fill={BARK} />
			<path d="M62 34 l14 -16 l-10 22 l-6 6 z" fill={FLAME} />
			<path d="M50 26 l-6 22 h7 l-9 20" stroke={FLAME} strokeWidth={2.6} fill="none" strokeLinejoin="round" />
			<Flier x={26} y={78} s={1.2} fill={CREAM} />
			<Flier x={76} y={92} s={1.1} fill={CREAM} />
			{[30, 40, 62, 72].map((x, i) => (
				<circle key={x} cx={x} cy={100 + (i % 2) * 12} r={1.6} fill={EMBER} />
			))}
			<path d="M34 130 l-6 12 M68 130 l7 12" stroke={SLATE} strokeWidth={2} strokeLinecap="round" />
		</g>
	),
	// XVII — after the worst of it, a quiet sky and clean water.
	star: () => (
		<g>
			<Sky fill="#2c4463" />
			<Star8 cx={50} cy={44} r={11} fill={CREAM} />
			{[20, 32, 44, 56, 68, 80].map((x, i) => (
				<Star8 key={x} cx={x} cy={i % 2 ? 30 : 60} r={3.4} fill={FLAME} />
			))}
			<Star8 cx={86} cy={46} r={3.4} fill={FLAME} />
			<Ground y={110} fill="#4e6a4e" />
			<Pool y={120} h={27} fill={DEEP} />
			<Heron x={40} y={122} s={1.15} />
			<g transform="translate(64 100) scale(0.6)">
				<CupEmblem />
			</g>
			<path d="M64 108 q2 10 -1 16" stroke={WATER} strokeWidth={2} fill="none" strokeLinecap="round" />
			<path d="M28 112 q3 8 0 12" stroke={WATER} strokeWidth={2} fill="none" strokeLinecap="round" />
			<Reeds x={76} y={128} n={4} />
			<Willow x={16} y={112} s={0.55} leaf="#3f6b4b" />
		</g>
	),
	// XVIII — the road at night, where nothing is quite the shape you thought.
	moon: () => (
		<g>
			<Sky fill="#25314c" />
			<Moon cx={50} cy={44} r={13} fill={CREAM} phase="full" />
			<circle cx={45} cy={40} r={2.6} fill="#d8cfb4" />
			<circle cx={54} cy={49} r={2} fill="#d8cfb4" />
			{Array.from({ length: 10 }, (_, i) => (
				<path
					key={i}
					d={`M${28 + i * 5} ${62 + (i % 2) * 3} l0 5`}
					stroke={CREAM}
					strokeWidth={1.2}
					opacity={0.5}
					strokeLinecap="round"
				/>
			))}
			<Ground y={104} fill="#3d4a3c" />
			<path d="M44 147 q4 -30 6 -43 q2 13 6 43 z" fill="#8f9b7e" />
			<rect x={16} y={82} width={9} height={24} rx={2} fill={SLATE} />
			<rect x={75} y={82} width={9} height={24} rx={2} fill={SLATE} />
			<Hare x={30} y={126} s={0.85} howl />
			<Hare x={70} y={126} s={0.85} howl flip />
			<Pool y={138} h={9} fill="#2f4a58" />
			<path d="M46 142 q4 -5 8 0 l3 4 h-14 z" fill="#7a6a55" />
			<path d="M44 140 l-4 -4 M56 140 l4 -4" stroke="#7a6a55" strokeWidth={1.4} strokeLinecap="round" />
		</g>
	),
	// XIX — plain daylight, and nothing to work out.
	sun: () => (
		<g>
			<Sky fill="#a9d6ef" />
			<Sun cx={50} cy={48} r={16} fill={FLAME} rays={16} />
			<rect x={8} y={104} width={84} height={5} fill="#b39a6a" />
			{[16, 30, 44, 58, 72, 86].map((x, i) => (
				<g key={x}>
					<line x1={x} y1={104} x2={x} y2={92} stroke={GREEN} strokeWidth={1.6} />
					<circle cx={x} cy={88} r={4.5} fill={GOLD} />
					<circle cx={x} cy={88} r={2} fill={BARK} />
					{i % 2 === 0 && <ellipse cx={x - 5} cy={94} rx={4} ry={2} fill={LEAF} />}
				</g>
			))}
			<Ground y={109} fill={GRASS} />
			<g transform="translate(50 142)">
				<ellipse cx={-2} cy={-10} rx={13} ry={7.5} fill="#c39a63" />
				<circle cx={4} cy={-8} r={1.6} fill={CREAM} />
				<circle cx={-8} cy={-12} r={1.6} fill={CREAM} />
				<path
					d="M-11 -4 l-1 6 M-4 -4 l0 6 M4 -4 l1 6 M10 -5 l2 6"
					stroke="#a37e4c"
					strokeWidth={2.2}
					strokeLinecap="round"
				/>
				<circle cx={12} cy={-18} r={5.4} fill="#c39a63" />
				<path d="M9 -23 q3 -3 6 0 q-3 -1 -6 0 z" fill="#c39a63" />
				<circle cx={13.6} cy={-19} r={1} fill={INK} />
			</g>
			<Bloom x={16} y={146} fill={ROSE} r={1.8} />
		</g>
	),
	// XX — the call to look at all of it honestly, and answer.
	judgment: () => (
		<g>
			<Sky fill="#cbd8e0" />
			<Peaks y={86} fill="#8f9aa0" />
			<circle cx={50} cy={44} r={19} fill={CREAM} opacity={0.7} />
			{Array.from({ length: 14 }, (_, i) => {
				const a = (i / 14) * Math.PI * 2;
				return (
					<line
						key={i}
						x1={50 + Math.cos(a) * 20}
						y1={44 + Math.sin(a) * 20}
						x2={50 + Math.cos(a) * 27}
						y2={44 + Math.sin(a) * 27}
						stroke={CREAM}
						strokeWidth={1.6}
						strokeLinecap="round"
					/>
				);
			})}
			<path d="M40 50 q10 -14 22 -6 q-6 12 -22 6 z" fill={GOLD} />
			<path d="M62 44 q9 -3 11 4 q-8 3 -11 -4 z" fill={FLAME} />
			<Ground y={110} fill="#7f8f6a" />
			<Pool y={126} h={21} fill={DEEP} />
			<Reeds x={12} y={132} n={5} />
			<Reeds x={72} y={134} n={5} />
			<Heron x={34} y={134} s={0.72} wings />
			<Heron x={62} y={138} s={0.62} wings />
			<Flier x={22} y={70} s={1.1} fill={SOFT} />
			<Flier x={78} y={78} s={1} fill={SOFT} />
		</g>
	),
	// XXI — all the way around, and the ring closes.
	world: () => (
		<g>
			<Sky fill="#3f6a84" />
			<Stars
				list={[
					[16, 30, 0.9],
					[84, 32, 0.9],
					[50, 24, 0.7],
				]}
			/>
			<ellipse cx={50} cy={86} rx={30} ry={40} fill="none" stroke={LEAF} strokeWidth={5} />
			{Array.from({ length: 12 }, (_, i) => {
				const a = (i / 12) * Math.PI * 2;
				return (
					<ellipse
						key={i}
						cx={50 + Math.cos(a) * 30}
						cy={86 + Math.sin(a) * 40}
						rx={3.4}
						ry={2}
						fill={GREEN}
						transform={`rotate(${(a * 180) / Math.PI} ${50 + Math.cos(a) * 30} ${86 + Math.sin(a) * 40})`}
					/>
				);
			})}
			<path d="M46 46 q4 -6 8 0 q-4 4 -8 0 z" fill={GOLD} />
			<path d="M46 126 q4 6 8 0 q-4 -4 -8 0 z" fill={GOLD} />
			<Figure x={50} y={112} s={1.05} robe={CREAM} trim={GOLD} arms="out" />
			<Hawk x={18} y={44} s={0.4} />
			<Fox x={84} y={46} s={0.4} sit />
			<Badger x={18} y={144} s={0.4} />
			<Stag x={82} y={146} s={0.4} />
		</g>
	),
};

// ------------------------------------------------------- the Minor Arcana
//
// Forty numbered cards and sixteen court cards. The numbered ones are laid out
// the way a real deck lays them out — the suit's emblem stamped in the pattern
// that belongs to its number — over a scene that says what that number MEANS in
// that suit. So the four of Swords is four reed blades over a still hollow and
// the four of Wands is four shoots over a lit doorway, and you can tell them
// apart across a table without reading a word.

/** Where the pips sit for each count, in scene coordinates, and how big to
 *  stamp them. The arrangements are the traditional ones: a single emblem in the
 *  middle, then rows and columns that stay legible right up to ten. */
const PIP_LAYOUT: Record<number, { at: [number, number][]; s: number }> = {
	1: { at: [[50, 86]], s: 1.55 },
	2: {
		at: [
			[34, 74],
			[66, 100],
		],
		s: 1.05,
	},
	3: {
		at: [
			[50, 58],
			[33, 106],
			[67, 106],
		],
		s: 1,
	},
	4: {
		at: [
			[34, 64],
			[66, 64],
			[34, 110],
			[66, 110],
		],
		s: 0.95,
	},
	5: {
		at: [
			[33, 58],
			[67, 58],
			[50, 86],
			[33, 114],
			[67, 114],
		],
		s: 0.88,
	},
	6: {
		at: [
			[32, 56],
			[68, 56],
			[32, 88],
			[68, 88],
			[32, 120],
			[68, 120],
		],
		s: 0.86,
	},
	7: {
		at: [
			[50, 50],
			[33, 76],
			[67, 76],
			[33, 102],
			[67, 102],
			[33, 128],
			[67, 128],
		],
		s: 0.76,
	},
	8: {
		at: [
			[33, 52],
			[67, 52],
			[33, 78],
			[67, 78],
			[33, 104],
			[67, 104],
			[33, 130],
			[67, 130],
		],
		s: 0.72,
	},
	9: {
		at: [
			[30, 56],
			[50, 56],
			[70, 56],
			[30, 88],
			[50, 88],
			[70, 88],
			[30, 120],
			[50, 120],
			[70, 120],
		],
		s: 0.66,
	},
	10: {
		at: [
			[33, 48],
			[67, 48],
			[33, 70],
			[67, 70],
			[33, 92],
			[67, 92],
			[33, 114],
			[67, 114],
			[33, 136],
			[67, 136],
		],
		s: 0.62,
	},
};

const Pips = ({ suit, n, dim = 1 }: { suit: Suit; n: number; dim?: number }) => {
	const Emblem = EMBLEM[suit];
	const layout = PIP_LAYOUT[n];
	return (
		<g opacity={dim}>
			{layout.at.map(([x, y], i) => (
				<g key={i} transform={`translate(${x} ${y})`}>
					<Emblem s={layout.s} />
				</g>
			))}
		</g>
	);
};

/** One numbered card: a mood behind, the pips, and anything laid over the top. */
const pip =
	(suit: Suit, n: number, sky: string, back?: React.ReactNode, front?: React.ReactNode) => (): React.JSX.Element => (
		<g>
			<Sky fill={sky} />
			{back}
			<Pips suit={suit} n={n} />
			{front}
		</g>
	);

/**
 * One court card: the suit's animal, its emblem standing beside it, and — for
 * the two that sit — a chair to sit in.
 *
 * All sixteen are built here rather than drawn one at a time, so a Page and a
 * King of the same suit are recognizably the same creature at two points in its
 * life, and a Queen of Cups and a Queen of Swords are recognizably the same
 * rank. The rank marks are the traditional ones: nothing for a Page, the ground
 * it has covered for a Knight, a star for a Queen, a crown for a King.
 */
const court =
	(suit: Suit, rank: Rank, sky: string, back?: React.ReactNode, animalScale = 1) =>
	(): React.JSX.Element => {
		const Animal = COURT_ANIMAL[suit];
		const Emblem = EMBLEM[suit];
		const tint = SUIT_TINT[suit];
		const seated = rank === 'queen' || rank === 'king';
		const ground =
			suit === 'cups' ? DEEP : suit === 'pentacles' ? '#6d7f4e' : suit === 'swords' ? '#93a2a6' : '#a58a55';
		return (
			<g>
				<Sky fill={sky} />
				{back}
				<Ground y={118} fill={ground} />
				{seated && (
					<g>
						<rect x={36} y={46} width={32} height={70} rx={4} fill={tint} opacity={0.45} />
						<rect x={40} y={52} width={24} height={4} rx={2} fill={GOLD} opacity={0.85} />
						<rect x={30} y={110} width={44} height={9} rx={3} fill={tint} opacity={0.7} />
					</g>
				)}
				{rank === 'knight' && (
					<path d="M12 132 q30 -10 62 -2" stroke={CREAM} strokeWidth={1.6} fill="none" opacity={0.55} />
				)}
				<ellipse cx={54} cy={138} rx={20} ry={4} fill={INK} opacity={0.17} />
				<g transform="translate(54 0)">
					<Animal x={0} y={137} s={animalScale * 1.6} />
				</g>
				<g transform="translate(20 92)">
					<Emblem s={1.7} />
				</g>
				{rank === 'king' && <path d="M42 40 l4 9 l7 -11 l7 11 l4 -9 l2 13 h-26 z" fill={GOLD} />}
				{rank === 'queen' && <Star8 cx={53} cy={44} r={7} fill={GOLD} />}
			</g>
		);
	};

// --- Wands (fire): what you want badly enough to start ----------------------
const WANDS_SKY = '#e6a862';

const WANDS: Record<string, () => React.JSX.Element> = {
	'wands-ace': pip(
		'wands',
		1,
		'#f0c07a',
		<Hills y={118} fill="#b98a4a" />,
		<Sun cx={50} cy={40} r={9} fill={FLAME} rays={12} />,
	),
	'wands-two': pip(
		'wands',
		2,
		WANDS_SKY,
		<>
			<Hills y={112} fill="#b98a4a" />
			<Peaks y={112} fill="#8f8676" />
		</>,
		<circle cx={50} cy={40} r={8} fill={STONE} opacity={0.8} />,
	),
	'wands-three': pip(
		'wands',
		3,
		'#efb86e',
		<Pool y={126} h={21} fill="#c98f4c" />,
		<>
			<Flier x={26} y={132} s={0.9} fill={BARK} />
			<Flier x={72} y={136} s={0.8} fill={BARK} />
		</>,
	),
	'wands-four': pip(
		'wands',
		4,
		'#f2c98a',
		<Ground y={124} fill="#b98a4a" />,
		<>
			<path d="M30 62 q20 -12 40 0" stroke={LEAF} strokeWidth={2.4} fill="none" />
			{[34, 44, 54, 64].map((x) => (
				<circle key={x} cx={x} cy={58 + (x % 20 === 4 ? 2 : 0)} r={2.4} fill={ROSE} />
			))}
		</>,
	),
	'wands-five': pip(
		'wands',
		5,
		'#e59a52',
		<Ground y={126} fill="#a87a42" />,
		<path d="M20 44 l60 26 M80 44 l-60 26" stroke={RUST} strokeWidth={1.6} opacity={0.55} />,
	),
	'wands-six': pip(
		'wands',
		6,
		'#f4cd8e',
		<Ground y={128} fill="#b98a4a" />,
		<>
			<path d="M34 40 q16 -8 32 0 l0 12 q-16 -8 -32 0 z" fill={LEAF} />
			<Star8 cx={50} cy={34} r={4} fill={GOLD} />
		</>,
	),
	'wands-seven': pip(
		'wands',
		7,
		'#e08f4a',
		<Ground y={132} fill="#8f6a3a" />,
		<path d="M8 140 h84" stroke={BARK} strokeWidth={3} />,
	),
	'wands-eight': pip(
		'wands',
		8,
		'#bcd9e8',
		<Hills y={128} fill={GREEN} />,
		<>
			{[30, 46, 62].map((x, i) => (
				<path key={x} d={`M${x} ${40 + i * 4} q10 6 20 2`} stroke={CREAM} strokeWidth={1.4} fill="none" opacity={0.7} />
			))}
		</>,
	),
	'wands-nine': pip(
		'wands',
		9,
		'#c99a62',
		<Ground y={136} fill="#7d6038" />,
		<path d="M10 40 q40 -10 80 0" stroke={SOFT} strokeWidth={1.6} fill="none" opacity={0.6} />,
	),
	'wands-ten': pip(
		'wands',
		10,
		'#c98d52',
		<Ground y={140} fill="#7d6038" />,
		<path d="M14 44 q36 12 72 0" stroke={BARK} strokeWidth={2.4} fill="none" opacity={0.7} />,
	),
	'wands-page': court('wands', 'page', '#f0c07a', <Hills y={110} fill="#b98a4a" />, 0.82),
	'wands-knight': court('wands', 'knight', '#e59a52', <Peaks y={116} fill="#8f8676" />, 0.95),
	'wands-queen': court('wands', 'queen', '#f4cd8e', <Hills y={110} fill="#b98a4a" />, 1),
	'wands-king': court('wands', 'king', '#e08f4a', <Peaks y={116} fill="#8f8676" />, 1.05),
};

// --- Cups (water): what you feel, and who you feel it about -----------------
const CUPS: Record<string, () => React.JSX.Element> = {
	'cups-ace': pip(
		'cups',
		1,
		'#c3e0ec',
		<Pool y={124} h={23} fill={WATER} />,
		<>
			<Star8 cx={50} cy={40} r={6} fill={CREAM} />
			<Bloom x={22} y={140} fill={CREAM} r={2} />
		</>,
	),
	'cups-two': pip(
		'cups',
		2,
		'#b7dbe8',
		<Pool y={126} h={21} fill={WATER} />,
		<path d="M40 46 q10 -12 20 0 q-10 8 -20 0 z" fill={ROSE} />,
	),
	'cups-three': pip(
		'cups',
		3,
		'#c8e4dd',
		<Ground y={128} fill={GRASS} />,
		<Meadow y={140} colors={[ROSE, FLAME, CREAM]} />,
	),
	'cups-four': pip(
		'cups',
		4,
		'#9fb9c4',
		<Ground y={128} fill="#6f8a6a" />,
		<Willow x={50} y={44} s={0.7} leaf="#4f7a58" />,
	),
	'cups-five': pip(
		'cups',
		5,
		'#8b9aa6',
		<Pool y={130} h={17} fill="#5f7d8c" />,
		<path d="M24 44 q12 10 24 0 q12 -10 24 0" stroke={SLATE} strokeWidth={1.6} fill="none" opacity={0.7} />,
	),
	'cups-six': pip(
		'cups',
		6,
		'#d9e5c8',
		<Ground y={130} fill={GRASS} />,
		<>
			<Bloom x={18} y={142} fill={CREAM} r={2} />
			<Bloom x={84} y={142} fill={ROSE} r={2} />
		</>,
	),
	'cups-seven': pip(
		'cups',
		7,
		'#7f8fb0',
		<Ground y={140} fill="#5a6a80" />,
		<>
			{[24, 50, 76].map((x) => (
				<ellipse key={x} cx={x} cy={40} rx={12} ry={6} fill={CREAM} opacity={0.35} />
			))}
		</>,
	),
	'cups-eight': pip(
		'cups',
		8,
		'#3f5570',
		<Ground y={138} fill="#405a52" />,
		<Moon cx={74} cy={40} r={8} fill={CREAM} phase="crescent" />,
	),
	'cups-nine': pip(
		'cups',
		9,
		'#bfe0e8',
		<Ground y={136} fill={GRASS} />,
		<path d="M12 44 q38 -10 76 0" stroke={GOLD} strokeWidth={2.4} fill="none" />,
	),
	'cups-ten': pip(
		'cups',
		10,
		'#bcd9e8',
		<Hills y={140} fill={GREEN} />,
		<path d="M18 40 q32 -18 64 0" stroke={ROSE} strokeWidth={2.4} fill="none" opacity={0.8} />,
	),
	'cups-page': court('cups', 'page', '#c3e0ec', <Reeds x={12} y={118} n={5} />, 0.72),
	'cups-knight': court('cups', 'knight', '#b7dbe8', <Hills y={112} fill="#6f9aa8" />, 0.86),
	'cups-queen': court('cups', 'queen', '#d3ecf2', <Reeds x={70} y={118} n={5} />, 0.9),
	'cups-king': court('cups', 'king', '#8fb6c8', <Hills y={112} fill="#5f8898" />, 0.95),
};

// --- Swords (air): what you think, and what thinking costs ------------------
const SWORDS: Record<string, () => React.JSX.Element> = {
	'swords-ace': pip(
		'swords',
		1,
		'#dbe4e8',
		<Peaks y={128} fill="#9aa6a8" />,
		<Star8 cx={50} cy={38} r={6} fill={CREAM} />,
	),
	'swords-two': pip(
		'swords',
		2,
		'#3f5570',
		<Pool y={128} h={19} fill="#33506a" />,
		<Moon cx={50} cy={40} r={8} fill={CREAM} phase="crescent" />,
	),
	'swords-three': pip(
		'swords',
		3,
		'#8f9aa2',
		<Ground y={132} fill="#6c7670" />,
		<>
			{[24, 40, 56, 72].map((x, i) => (
				<path key={x} d={`M${x} ${38 + i * 3} q4 10 1 18`} stroke={CREAM} strokeWidth={1.2} fill="none" opacity={0.6} />
			))}
		</>,
	),
	'swords-four': pip(
		'swords',
		4,
		'#b9c6c4',
		<Ground y={132} fill="#7f8c78" />,
		<path d="M28 44 q22 -14 44 0 l0 8 q-22 -12 -44 0 z" fill={STONE} opacity={0.7} />,
	),
	'swords-five': pip(
		'swords',
		5,
		'#94a4ac',
		<Ground y={134} fill="#6a7570" />,
		<path d="M14 42 q36 14 72 -2" stroke={SLATE} strokeWidth={1.8} fill="none" opacity={0.7} />,
	),
	'swords-six': pip(
		'swords',
		6,
		'#b6c9d2',
		<Pool y={126} h={21} fill="#6a92a4" />,
		<path d="M32 138 q18 8 36 0 l-4 6 h-28 z" fill={WOOD} />,
	),
	'swords-seven': pip(
		'swords',
		7,
		'#c8bfa4',
		<Ground y={136} fill="#9a8c66" />,
		<>
			{[20, 34, 48].map((x, i) => (
				<path key={x} d={`M${x} ${40 + i * 2} l10 4`} stroke={SOFT} strokeWidth={1.2} />
			))}
		</>,
	),
	'swords-eight': pip(
		'swords',
		8,
		'#98a2a6',
		<Ground y={140} fill="#6f7570" />,
		<Reeds x={12} y={146} n={9} fill="#7f8c78" />,
	),
	'swords-nine': pip(
		'swords',
		9,
		'#2f3644',
		<Ground y={140} fill="#3c4450" />,
		<Stars
			list={[
				[18, 36, 0.8],
				[34, 30, 0.7],
				[66, 32, 0.8],
				[84, 40, 0.7],
			]}
		/>,
	),
	'swords-ten': pip(
		'swords',
		10,
		'#3d4a5c',
		<Ground y={142} fill="#4a5460" />,
		<path d="M8 42 q42 -14 84 0" stroke={DUSK} strokeWidth={2.4} fill="none" opacity={0.75} />,
	),
	'swords-page': court('swords', 'page', '#dbe4e8', <Hills y={110} fill="#8f9d8a" />, 0.78),
	'swords-knight': court('swords', 'knight', '#c2ced4', <Peaks y={116} fill="#8d989a" />, 0.92),
	'swords-queen': court('swords', 'queen', '#d3dde2', <Peaks y={116} fill="#8d989a" />, 0.95),
	'swords-king': court('swords', 'king', '#a8b6bc', <Peaks y={116} fill="#77827f" />, 1),
};

// --- Pentacles (earth): what you make, keep, and hand on --------------------
const PENTACLES: Record<string, () => React.JSX.Element> = {
	'pentacles-ace': pip(
		'pentacles',
		1,
		'#d6e8c8',
		<Ground y={124} fill={GRASS} />,
		<>
			<Meadow y={138} colors={[CREAM, ROSE]} />
			<Sun cx={50} cy={40} r={7} fill={FLAME} rays={10} />
		</>,
	),
	'pentacles-two': pip(
		'pentacles',
		2,
		'#bcd9e8',
		<Pool y={130} h={17} fill={WATER} />,
		<path d="M30 60 q20 30 40 0" stroke={LEAF} strokeWidth={2.2} fill="none" />,
	),
	'pentacles-three': pip(
		'pentacles',
		3,
		'#c4c0a8',
		<Ground y={128} fill="#8e8668" />,
		<>
			<rect x={24} y={34} width={52} height={10} rx={2} fill={STONE} />
			<rect x={30} y={44} width={8} height={10} fill={STONE} />
			<rect x={62} y={44} width={8} height={10} fill={STONE} />
		</>,
	),
	'pentacles-four': pip(
		'pentacles',
		4,
		'#a8b598',
		<Ground y={130} fill="#6f7d58" />,
		<rect x={20} y={38} width={60} height={6} rx={3} fill={SOFT} />,
	),
	'pentacles-five': pip(
		'pentacles',
		5,
		'#8f9aa6',
		<Ground y={134} fill={SNOW} />,
		<>
			{Array.from({ length: 12 }, (_, i) => (
				<circle key={i} cx={14 + i * 7} cy={40 + (i % 3) * 6} r={1.4} fill={CREAM} />
			))}
		</>,
	),
	'pentacles-six': pip(
		'pentacles',
		6,
		'#d0e0bc',
		<Ground y={130} fill={GRASS} />,
		<path d="M28 42 q22 -12 44 0" stroke={GOLD} strokeWidth={2.2} fill="none" />,
	),
	'pentacles-seven': pip(
		'pentacles',
		7,
		'#c9dfb4',
		<Ground y={138} fill="#6d7f4e" />,
		<path d="M14 44 q10 -8 18 0 M48 44 q10 -8 18 0" stroke={LEAF} strokeWidth={2} fill="none" />,
	),
	'pentacles-eight': pip(
		'pentacles',
		8,
		'#c0b898',
		<Ground y={140} fill="#8a8060" />,
		<path d="M20 42 h60" stroke={WOOD} strokeWidth={3} />,
	),
	'pentacles-nine': pip(
		'pentacles',
		9,
		'#d8e6c0',
		<Ground y={138} fill={GRASS} />,
		<>
			{[16, 84].map((x) => (
				<Willow key={x} x={x} y={44} s={0.42} />
			))}
		</>,
	),
	'pentacles-ten': pip(
		'pentacles',
		10,
		'#c8d8b4',
		<Ground y={142} fill={GRASS} />,
		<>
			<rect x={30} y={30} width={40} height={12} rx={2} fill={WOOD} />
			<path d="M28 30 l22 -12 l22 12 z" fill={BARK} />
		</>,
	),
	'pentacles-page': court('pentacles', 'page', '#d6e8c8', <Hills y={110} fill={GREEN} />, 0.8),
	'pentacles-knight': court('pentacles', 'knight', '#c9dfb4', <Hills y={110} fill={GREEN} />, 0.92),
	'pentacles-queen': court('pentacles', 'queen', '#d8e6c0', <Hills y={110} fill={GREEN} />, 0.96),
	'pentacles-king': court('pentacles', 'king', '#b6cc9e', <Hills y={112} fill="#3f6b4b" />, 1.02),
};

// -------------------------------------------------------------- the deck

/** Every card face in the deck, by id. The test walks this against DECK, so a
 *  card added to the catalog with no picture fails there rather than showing up
 *  as an empty parchment rectangle on the table. */
export const SCENES: Record<string, () => React.JSX.Element> = {
	...MAJOR_SCENES,
	...WANDS,
	...CUPS,
	...SWORDS,
	...PENTACLES,
};

/** Roman numerals, which is how a tarot card has always numbered itself — and
 *  which needs no translation. The Fool is 0 and the court runs on from the
 *  ten, XI to XIV, exactly as the traditional numbering does. */
export function roman(n: number): string {
	if (n === 0) return '0';
	const table: [number, string][] = [
		[10, 'X'],
		[9, 'IX'],
		[5, 'V'],
		[4, 'IV'],
		[1, 'I'],
	];
	let out = '';
	let left = n;
	for (const [v, s] of table)
		while (left >= v) {
			out += s;
			left -= v;
		}
	return out;
}

/** The corner mark: the number in Roman numerals, and a tiny suit emblem (or a
 *  star, for a Major, which belongs to no suit). */
const Corner = ({ n, suit }: { n: number; suit?: Suit }) => {
	const Emblem = suit ? EMBLEM[suit] : null;
	return (
		<g>
			<text x={12} y={16} fontSize={9} fontWeight={700} fill={SOFT} fontFamily="Georgia, serif">
				{roman(n)}
			</text>
			{Emblem ? (
				<g transform="translate(86 11) scale(0.42)">
					<Emblem />
				</g>
			) : (
				<Star8 cx={86} cy={11} r={4} fill={GOLD} />
			)}
		</g>
	);
};

/**
 * One card face, drawn whole: parchment, border, picture, corner mark.
 *
 * A reversed card turns the PICTURE over and leaves the frame alone, which is
 * what a card upside-down on a table actually looks like — the border is the
 * card, the picture is what is printed on it.
 */
export function CardFace({ id, reversed = false }: { id: string; reversed?: boolean }) {
	const scene = SCENES[id];
	const def = cardDef(id);
	const clip = `tarot-clip-${id}`;
	return (
		<svg viewBox={`0 0 ${CARD_W} ${CARD_H}`} width="100%" height="100%" className="tarot-face" aria-hidden="true">
			<defs>
				<clipPath id={clip}>
					<rect x={SCENE.x} y={SCENE.y} width={SCENE.w} height={SCENE.h} rx={2} />
				</clipPath>
			</defs>
			<rect x={0} y={0} width={CARD_W} height={CARD_H} rx={6} fill={PARCH} />
			<g transform={reversed ? `rotate(180 ${CARD_W / 2} ${CARD_H / 2})` : undefined}>
				<g clipPath={`url(#${clip})`}>{scene ? scene() : <Sky fill={PARCH_2} />}</g>
				<Corner n={def?.number ?? 0} suit={def?.suit} />
			</g>
			<rect x={1.5} y={1.5} width={CARD_W - 3} height={CARD_H - 3} rx={5} fill="none" stroke={LINE} strokeWidth={3} />
			<rect
				x={SCENE.x - 1.6}
				y={SCENE.y - 1.6}
				width={SCENE.w + 3.2}
				height={SCENE.h + 3.2}
				rx={3}
				fill="none"
				stroke={SOFT}
				strokeWidth={1.1}
			/>
		</svg>
	);
}

/**
 * The back of a card: woven willow withies, the way a basket is woven, in the
 * one pattern that is the same either way up — so a face-down card gives away
 * nothing about which way it will land.
 */
export function CardBack() {
	return (
		<svg viewBox={`0 0 ${CARD_W} ${CARD_H}`} width="100%" height="100%" className="tarot-back" aria-hidden="true">
			<rect x={0} y={0} width={CARD_W} height={CARD_H} rx={6} fill="#4d6b52" />
			<g opacity={0.5} stroke="#7fa87f" strokeWidth={2} fill="none" strokeLinecap="round">
				{Array.from({ length: 11 }, (_, r) =>
					Array.from({ length: 7 }, (_, c) => (
						<path key={`${r}-${c}`} d={`M${8 + c * 13} ${14 + r * 14} q6.5 ${r % 2 ? 8 : -8} 13 0`} />
					)),
				)}
			</g>
			<rect x={1.5} y={1.5} width={CARD_W - 3} height={CARD_H - 3} rx={5} fill="none" stroke={LINE} strokeWidth={3} />
			<circle cx={CARD_W / 2} cy={CARD_H / 2} r={17} fill="#3f5b46" />
			<Star8 cx={CARD_W / 2} cy={CARD_H / 2} r={10} fill={GOLD} />
			<circle cx={CARD_W / 2} cy={CARD_H / 2} r={3.2} fill="#3f5b46" />
		</svg>
	);
}

/** The little suit badge the guide uses beside each suit's paragraph. */
export function SuitBadge({ suit, size = 26 }: { suit: Suit; size?: number }) {
	const Emblem = EMBLEM[suit];
	return (
		<svg viewBox="0 0 30 30" width={size} height={size} aria-hidden="true">
			<circle cx={15} cy={15} r={14} fill={PARCH_2} />
			<g transform="translate(15 15) scale(0.92)">
				<Emblem />
			</g>
		</svg>
	);
}

/** The court ranks drawn as a row of four, for the guide's court page. */
export function CourtBadge({ rank, size = 26 }: { rank: Rank; size?: number }) {
	const i = COURT.indexOf(rank);
	return (
		<svg viewBox="0 0 30 30" width={size} height={size} aria-hidden="true">
			<circle cx={15} cy={15} r={14} fill={PARCH_2} />
			{Array.from({ length: i + 1 }, (_, k) => (
				<circle key={k} cx={15 + (k - i / 2) * 5.5} cy={15} r={2.2} fill={GOLD} />
			))}
		</svg>
	);
}

// ------------------------------------------------------- the guide's plates
//
// One illustration per chapter of "What tarot is", built out of the same card
// faces the deck is made of rather than out of new art. A book about a deck should
// show the deck: the anatomy chapter shows a Major beside the four Aces, the
// reversals chapter shows one card both ways up, and the court chapter shows a
// suit growing from Page to King.

/** The blank card outline the spreads diagram is drawn from. */
const Slot = ({ x, y, w = 30, h = 48 }: { x: number; y: number; w?: number; h?: number }) => (
	<rect x={x} y={y} width={w} height={h} rx={4} fill={PARCH_2} stroke={LINE} strokeWidth={1.6} />
);

/**
 * The shape of every spread in the panel: three cards in a row, turned left to
 * right. Numbered rather than labeled, so the picture needs no translation, and
 * the order is the point.
 */
const SpreadDiagram = () => (
	<svg viewBox="0 0 200 78" className="tarot-plate-svg" aria-hidden="true">
		{[0, 1, 2].map((i) => {
			const x = 30 + i * 48;
			return (
				<g key={i}>
					<Slot x={x} y={6} />
					<text
						x={x + 15}
						y={37}
						fontSize={20}
						fontWeight={700}
						textAnchor="middle"
						fill={SOFT}
						fontFamily="Georgia, serif"
					>
						{i + 1}
					</text>
				</g>
			);
		})}
		<path d="M34 68 h128" stroke={LINE} strokeWidth={1.6} fill="none" strokeLinecap="round" />
		<path
			d="M156 63 l7 5 l-7 5"
			stroke={LINE}
			strokeWidth={1.6}
			fill="none"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
);

const PLATE_CARDS: Record<string, string[]> = {
	'what-it-is': ['fool', 'star', 'world'],
	anatomy: ['magician', 'wands-ace', 'cups-ace', 'swords-ace', 'pentacles-ace'],
	'how-to-read': ['cups-three', 'swords-two', 'pentacles-six'],
	intention: ['star'],
	reversals: ['star', 'star'],
	majors: ['fool', 'wheel', 'world'],
	suits: ['wands-ace', 'cups-ace', 'swords-ace', 'pentacles-ace'],
	numbers: ['cups-ace', 'cups-five', 'cups-ten'],
	court: ['cups-page', 'cups-knight', 'cups-queen', 'cups-king'],
};

/** The plate at the top of a guide chapter. */
export function GuidePlate({ page }: { page: string }) {
	if (page === 'spreads') {
		return (
			<div className="tarot-plate tarot-plate-diagram">
				<SpreadDiagram />
			</div>
		);
	}
	const cards = PLATE_CARDS[page];
	if (!cards) return null;
	return (
		<div className={`tarot-plate tarot-plate-${page}`} aria-hidden="true">
			{cards.map((id, i) => (
				<span className="tarot-plate-card" key={`${id}-${i}`}>
					<CardFace id={id} reversed={page === 'reversals' && i === 1} />
				</span>
			))}
		</div>
	);
}
