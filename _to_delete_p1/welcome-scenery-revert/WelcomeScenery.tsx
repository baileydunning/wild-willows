import { memo, type CSSProperties } from 'react';
import { animalScale, animalSpriteDataUri } from '../game/textures';

/**
 * The title screen's dusk-meadow backdrop.
 *
 * Every animal here is the REAL in-game sprite: `animalSpriteDataUri` renders
 * the same draw commands the world uses (src/game/textures.ts) straight to an
 * SVG data URI. Nothing is hand-copied any more, so retouching a sprite
 * retouches the title screen too — the two can never drift apart again.
 *
 * All movement is pure CSS animation, so the global [data-reduce-motion="1"]
 * rule stills the whole scene automatically. Positions live on a static outer
 * <g transform> and the animation only ever moves things *relative* to that,
 * so a stilled scene keeps every creature exactly where it belongs instead of
 * collapsing to the origin.
 */

/** Pixels (in the 1000x560 viewBox) of a scale-1.0 animal. */
const SPRITE_UNIT = 28;

// btoa + a few hundred shape ops per animal is cheap, but the title screen
// re-renders on every keystroke in the name field — cache by species.
const uriCache = new Map<string, string>();
function spriteUri(id: string, kind: string): string {
	const key = `${id}|${kind}`;
	const hit = uriCache.get(key);
	if (hit !== undefined) return hit;
	let uri = '';
	try {
		uri = animalSpriteDataUri(id, kind);
	} catch {
		// No btoa (SSR / node test env) — draw nothing rather than blow up the
		// whole title screen over decoration.
		uri = '';
	}
	uriCache.set(key, uri);
	return uri;
}

/** CSS custom properties drive the shared `.cross` keyframes. */
type Vars = CSSProperties & Record<`--${string}`, string | number>;
const vars = (v: Record<string, string | number>) => v as Vars;

type CritterProps = {
	id: string;
	kind: string;
	/** Where the animal stands: x is its centre, y is the ground under its feet. */
	x: number;
	y: number;
	/** Overrides the game's proportional size — used where a bug would otherwise
	 *  be a speck at title-screen scale. */
	size?: number;
	/** Sprites are all drawn facing right. */
	flip?: boolean;
	/** Animation class + custom properties, applied to an inner group so they
	 *  never fight with the positioning transform. */
	className?: string;
	style?: CSSProperties;
	/** An extra always-on wobble layered under the main motion (e.g. a waddle
	 *  inside a walk-across). */
	inner?: string;
	innerStyle?: CSSProperties;
};

function Critter({ id, kind, x, y, size, flip, className, style, inner, innerStyle }: CritterProps) {
	const s = (size ?? animalScale(id, kind)) * SPRITE_UNIT;
	const img = (
		<image
			href={spriteUri(id, kind)}
			x={-s / 2}
			y={-s}
			width={s}
			height={s}
			// Bottom-aligned inside a square box, so the sprite's own aspect ratio
			// is preserved and its feet land exactly on y.
			preserveAspectRatio="xMidYMax meet"
		/>
	);
	const facing = flip ? <g transform="scale(-1 1)">{img}</g> : img;
	const wobbled = inner ? (
		<g className={inner} style={innerStyle}>
			{facing}
		</g>
	) : (
		facing
	);
	return (
		<g transform={`translate(${x} ${y})`}>
			{className || style ? (
				<g className={className} style={style}>
					{wobbled}
				</g>
			) : (
				wobbled
			)}
		</g>
	);
}

export const Scenery = memo(function Scenery() {
	return (
		<svg className="welcome-scenery" viewBox="0 0 1000 560" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
			{/* drifting clouds — the outer group is where each one rests, the
			    animation only ever nudges it left and right from there */}
			<g transform="translate(240 0)">
				<g
					className="cloud cross"
					fill="#f7e9c8"
					opacity="0.16"
					style={vars({ '--x0': '-400px', '--x1': '920px', '--dur': '90s' })}
				>
					<ellipse cx="0" cy="64" rx="72" ry="15" />
					<ellipse cx="52" cy="52" rx="46" ry="12" />
				</g>
			</g>
			<g transform="translate(600 0)">
				<g
					className="cloud cross"
					fill="#f7e9c8"
					opacity="0.12"
					style={vars({ '--x0': '-760px', '--x1': '560px', '--dur': '120s', '--delay': '-70s' })}
				>
					<ellipse cx="0" cy="128" rx="54" ry="11" />
					<ellipse cx="-40" cy="136" rx="36" ry="9" />
				</g>
			</g>
			<g transform="translate(860 0)">
				<g
					className="cloud cross"
					fill="#f7e9c8"
					opacity="0.1"
					style={vars({ '--x0': '-1020px', '--x1': '300px', '--dur': '105s', '--delay': '-30s' })}
				>
					<ellipse cx="0" cy="188" rx="60" ry="12" />
					<ellipse cx="44" cy="196" rx="38" ry="9" />
				</g>
			</g>

			{/* a distant flock heading home — too far off to read as any one species */}
			<g transform="translate(300 150)">
				<g className="flock">
					{[
						[0, 0],
						[34, 14],
						[62, 4],
					].map(([x, y], i) => (
						<g key={i} transform={`translate(${x} ${y})`}>
							<path
								className={`bird-wings w${i % 2}`}
								d="M0 0 Q6 -7 12 0 Q18 -7 24 0"
								stroke="#2e2820"
								strokeWidth="2.4"
								fill="none"
								strokeLinecap="round"
							/>
						</g>
					))}
				</g>
			</g>

			{/* brown bat working the dusk sky for insects — kept out over the
			    willow so it never crosses the title or the menu card */}
			<Critter
				id="brown-bat"
				kind="mammal"
				x={800}
				y={302}
				size={0.72}
				className="cross bat-fly"
				style={vars({ '--x0': '-660px', '--x1': '560px', '--dur': '27s' })}
				inner="bat-flap"
			/>

			{/* meadow hills */}
			<path d="M0 470 Q250 410 500 460 T1000 450 V560 H0 Z" fill="#3d5232" />
			<path d="M0 505 Q300 460 600 500 T1000 495 V560 H0 Z" fill="#324528" />

			{/* willow tree */}
			<g transform="translate(820 350)">
				<path d="M0 150 Q8 80 4 40" stroke="#5a4632" strokeWidth="14" fill="none" strokeLinecap="round" />
				<path d="M2 95 q-30 -8 -50 0" stroke="#5a4632" strokeWidth="7" fill="none" strokeLinecap="round" />
				<ellipse cx="5" cy="30" rx="78" ry="42" fill="#4a6b3a" />
				<ellipse cx="-30" cy="48" rx="40" ry="26" fill="#557a44" />
				<ellipse cx="45" cy="50" rx="36" ry="24" fill="#557a44" />
				<g className="willow-fronds">
					{[-60, -35, -8, 20, 48, 70].map((x, i) => (
						<path
							key={i}
							d={`M${x} ${52 + (i % 3) * 6} q4 36 -4 62`}
							stroke="#6b9152"
							strokeWidth="4"
							fill="none"
							strokeLinecap="round"
						/>
					))}
				</g>
			</g>

			{/* the low willow branch is the evening perch: owl at one end, bluebird
			    at the other (branch runs from x≈772 to x≈822 at y≈445) */}
			<Critter id="great-horned-owl" kind="bird" x={779} y={446} className="owl-perch" />
			<Critter id="bluebird" kind="bird" x={812} y={444} size={0.66} className="bluebird-hop" />

			{/* mule deer grazing by the willow, facing back into the meadow */}
			<Critter id="mule-deer" kind="mammal" x={706} y={470} flip className="deer-graze" />

			{/* meadowlark singing from a stone on the far hill */}
			<g transform="translate(636 466)">
				<ellipse cx="0" cy="-2" rx="13" ry="5" fill="#6e6b62" />
				<ellipse cx="-2" cy="-4" rx="9" ry="4" fill="#84806f" />
			</g>
			<Critter id="western-meadowlark" kind="bird" x={636} y={464} size={0.72} className="lark-sing" />

			{/* little campsite */}
			<g transform="translate(120 450)">
				<path d="M0 60 L38 0 L76 60 Z" fill="#9e5f69" />
				<path d="M38 0 L76 60 L56 60 Z" fill="#8a4f59" />
				<path d="M38 14 L26 60 L50 60 Z" fill="#5d4128" />
				<g transform="translate(100 38)">
					<circle cx="0" cy="22" r="4" fill="#8e8e8a" />
					<circle cx="18" cy="24" r="4" fill="#8e8e8a" />
					<rect x="-2" y="14" width="22" height="5" rx="2.5" fill="#7c5a3c" />
					<circle className="smoke s0" cx="9" cy="-12" r="3.5" fill="#d8d3c8" />
					<circle className="smoke s1" cx="7" cy="-12" r="3" fill="#d8d3c8" />
					<circle className="smoke s2" cx="11" cy="-12" r="4" fill="#d8d3c8" />
					<g className="campfire-flame">
						<path d="M9 -8 L1 14 L17 14 Z" fill="#e8954f" />
						<path d="M9 -2 L4 13 L14 13 Z" fill="#f4c95f" />
						<circle cx="9" cy="2" r="14" fill="#ffd98a" opacity="0.18" />
					</g>
				</g>
			</g>

			{/* goldfinch flitting along the hill behind the camp */}
			<Critter
				id="american-goldfinch"
				kind="bird"
				x={262}
				y={474}
				size={0.62}
				className="finch-flit"
				inner="finch-wings"
			/>

			{/* tree squirrel in the mid meadow, tail-flick and all */}
			<Critter id="tree-squirrel" kind="mammal" x={296} y={500} className="squirrel-perk" />

			{/* burrow country: a ground squirrel standing sentry, a vole darting
			    between the tunnels, and a groundhog easing up out of its mound */}
			<g transform="translate(424 514)">
				<ellipse cx="0" cy="0" rx="20" ry="6" fill="#3b3324" />
				<ellipse cx="1" cy="-2" rx="16" ry="4.5" fill="#4d4130" />
			</g>
			<Critter id="ground-squirrel" kind="mammal" x={416} y={511} size={0.8} className="sentry-alert" />
			<Critter
				id="prairie-vole"
				kind="mammal"
				x={368}
				y={519}
				className="cross vole-dart"
				style={vars({ '--x0': '-14px', '--x1': '30px', '--dur': '6.5s' })}
			/>

			{/* meadow flowers, and the bumblebee working them */}
			{[
				[470, 512, '#d98a9e'],
				[508, 520, '#e3c75f'],
				[548, 514, '#c9884f'],
				[432, 522, '#b8a3d6'],
			].map(([x, y, c], i) => (
				<g key={i} transform={`translate(${x} ${y})`}>
					<path d="M0 0 q1 8 0 14" stroke="#557a44" strokeWidth="2" fill="none" />
					<circle cx="0" cy="0" r="3.4" fill={c as string} />
					<circle cx="0" cy="0" r="1.3" fill="#f4e3b1" />
				</g>
			))}
			<Critter id="bumblebee" kind="insect" x={556} y={516} size={0.55} className="bee-hover" />

			{/* a monarch wandering between the flowers */}
			<Critter id="monarch-butterfly" kind="insect" x={470} y={502} size={0.62} className="monarch-drift" />

			{/* praying mantis stalking a tall stem */}
			<g transform="translate(466 542)">
				<path d="M0 0 q3 -18 -1 -28" stroke="#4a6b3a" strokeWidth="2.4" fill="none" strokeLinecap="round" />
			</g>
			<Critter id="praying-mantis" kind="insect" x={466} y={517} size={0.6} className="mantis-sway" />

			{/* garter snake easing through the near-hill grass */}
			<Critter
				id="garter-snake"
				kind="reptile"
				x={560}
				y={524}
				className="cross snake-slither"
				style={vars({ '--x0': '-180px', '--x1': '150px', '--dur': '48s' })}
			/>

			{/* cottontail hopping across the meadow */}
			<Critter
				id="cottontail-rabbit"
				kind="mammal"
				x={232}
				y={496}
				className="cross"
				style={vars({ '--x0': '-322px', '--x1': '858px', '--dur': '30s' })}
				inner="rabbit-hop"
			/>

			{/* red fox trotting home along the near hill */}
			<Critter
				id="red-fox"
				kind="mammal"
				x={600}
				flip
				y={526}
				className="cross"
				style={vars({ '--x0': '520px', '--x1': '-740px', '--dur': '38s', '--delay': '-14s' })}
				inner="fox-trot"
			/>

			{/* swaying grass tufts on the near hill */}
			{[80, 320, 410, 600, 690, 930].map((x, i) => (
				<g key={i} transform={`translate(${x} ${530 + (i % 2) * 10})`}>
					<path
						className={`grass gr${i % 3}`}
						d="M0 0 q-3 -12 -6 -16 M0 0 q0 -14 1 -18 M0 0 q4 -11 7 -15"
						stroke="#4a6b3a"
						strokeWidth="2.4"
						fill="none"
						strokeLinecap="round"
					/>
				</g>
			))}

			{/* groundhog easing up out of its mound — the mound is drawn after it,
			    so the burrow hides everything below the rim */}
			<g transform="translate(104 550)">
				<Critter id="groundhog" kind="mammal" x={0} y={4} className="groundhog-peek" />
				<ellipse cx="0" cy="0" rx="30" ry="10" fill="#3b3324" />
				<ellipse cx="-2" cy="-2" rx="24" ry="7" fill="#4d4130" />
			</g>

			{/* grasshopper in the foreground grass */}
			<Critter id="grasshopper" kind="insect" x={624} y={544} size={0.55} className="hopper-hop" />

			{/* ladybug crawling the near slope */}
			<Critter
				id="ladybug"
				kind="insect"
				x={336}
				y={540}
				size={0.46}
				className="cross ladybug-crawl"
				style={vars({ '--x0': '-26px', '--x1': '26px', '--dur': '34s' })}
			/>

			{/* garden spider hanging in a web strung between two stems */}
			<g transform="translate(880 508)">
				<g className="web-sway" opacity="0.34">
					<path d="M-22 -34 L-22 22 M22 -34 L22 22" stroke="#8fa07c" strokeWidth="1.6" fill="none" />
					<path
						d="M0 -30 L0 20 M-20 -26 L20 16 M20 -26 L-20 16 M-21 -5 L21 -5"
						stroke="#d8d3c8"
						strokeWidth="0.9"
						fill="none"
					/>
					{[6, 11, 16].map((r) => (
						<path
							key={r}
							d={`M0 ${-5 - r} L${r} -5 L0 ${-5 + r} L${-r} -5 Z`}
							stroke="#d8d3c8"
							strokeWidth="0.9"
							fill="none"
						/>
					))}
				</g>
				<Critter id="garden-spider" kind="invertebrate" x={0} y={2} size={0.48} className="spider-bob" />
			</g>

			{/* opossum ambling the foreground on its nightly rounds */}
			<Critter
				id="opossum"
				kind="mammal"
				x={760}
				y={554}
				size={0.95}
				flip
				className="cross"
				style={vars({ '--x0': '340px', '--x1': '-900px', '--dur': '64s', '--delay': '-22s' })}
				inner="opossum-waddle"
			/>

			{/* snail taking the scenic route across a stone */}
			<g transform="translate(936 552)">
				<ellipse cx="0" cy="0" rx="26" ry="8" fill="#6e6b62" />
				<ellipse cx="-3" cy="-3" rx="18" ry="5" fill="#84806f" />
			</g>
			<Critter
				id="snail"
				kind="invertebrate"
				x={936}
				y={548}
				size={0.55}
				className="cross"
				style={vars({ '--x0': '-18px', '--x1': '18px', '--dur': '90s' })}
			/>

			{/* fireflies */}
			{[160, 240, 330, 420, 500, 580, 650, 730, 780, 900].map((x, i) => (
				<circle key={i} className={`firefly f${i % 4}`} cx={x} cy={430 + ((i * 37) % 90)} r="2.6" fill="#ffe9a8" />
			))}
		</svg>
	);
});
