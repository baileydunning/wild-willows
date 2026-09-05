// The Stargazing Telescope you build for the house or set up on a ridge.
//
// Two skies in one eyepiece: cloud types and the tricks light plays in them
// while it is light, and once it is properly dark the whole night sky —
// constellations, the things in it that are not stars, the moon and the
// planets, and the few things that only happen sometimes. ui/sky.ts decides
// which, off the same day clock the HUD reads.
//
// You sweep the telescope with the arrow keys — or drag it, or pick a name off
// the strip under the barrel — and whatever ends up in the crosshairs tells you
// what it is and what it means. The sweep goes all the way round: the field
// wraps horizontally, so turning one way for long enough brings you back where
// you started, the way turning on the spot under a real sky does. Up and down
// it stops: the treeline below, the zenith above.
//
// Nothing here is saved. Like the bookshelf, this is a thing to look at and
// learn from: no unlocks, no record of what you have found, no reason to grind
// it. The live state it reads is today's weather, this season and the hour,
// which decide what is actually overhead — and, on a night with a lid on it,
// whether anything is.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../state';
import { content, t as tr } from '../i18n';
import { useI18n } from '../i18n/react';
import { liveDayPhase, liveSeason, liveWeatherType, seasonStyle, weatherType } from '../weather';
import { Icon } from './icons';
import {
	CLOUDS,
	FIELDS,
	OVERCAST,
	VIEW,
	skyDef,
	clampY,
	skyField,
	skyMode,
	wrapDx,
	type Placed,
	type SkyMode,
} from './sky';
import { AIM, BOX, SkyArt, SkyScene, paletteFor } from './skyArt';

/** How fast a held arrow key sweeps the sky, in field units per second. */
const PAN_SPEED = 340;
/** One tap of an arrow key, for players who press rather than hold. */
const PAN_STEP = 52;

export function TelescopePanel() {
	const { data, state, setPanel } = useGame();
	const { t } = useI18n();

	const snap = state?.weather;
	const area = state?.player.area || 'meadow';
	// Indoors there is no weather of its own: the window looks out over whichever
	// biome you are standing in, and the house's window looks over the meadow.
	const tent = /^tent-([a-z][a-z-]*)$/.exec(area)?.[1];
	const outside = tent || (area === 'home' ? 'meadow' : area);
	const worldId = (state as any)?.worldId || state?.player.id || '';
	const phase = liveDayPhase(snap);
	const mode: SkyMode = skyMode(phase);
	const season = liveSeason(snap);
	const wx = liveWeatherType(worldId, outside, snap);
	const cloudedOut = mode === 'night' && OVERCAST.has(wx);
	const f = FIELDS[mode];

	// The sky itself. Only re-laid when the conditions actually change, so a
	// re-render (a pan, a hover) never shuffles anything.
	const field = useMemo(() => skyField(mode, { weather: wx, season }), [mode, wx, season]);
	const pal = useMemo(() => paletteFor(mode, wx, phase), [mode, wx, phase]);

	// Where the eyepiece is pointed, in field units. It opens ON something —
	// the first thing that is actually overhead — rather than at the geometric
	// middle of the field, so the first thing you see is a thing and not a patch
	// of empty sky with "nothing in the crosshairs" beside it.
	const opening = useCallback(
		(list: Placed[]) => {
			const first = list.find((p) => p.overhead) || list[0];
			return first ? { x: first.x, y: clampY(first.y, mode) } : { x: f.w / 2, y: f.sky / 2 };
		},
		[f.w, f.sky, mode],
	);
	const [at, setAt] = useState(() => opening(field));
	const [hover, setHover] = useState<string | null>(null);
	const held = useRef(new Set<string>());
	const raf = useRef(0);
	const last = useRef(0);
	const scope = useRef<HTMLDivElement>(null);

	const half = VIEW / 2;
	const move = useCallback(
		(dx: number, dy: number) => setAt((p) => ({ x: (((p.x + dx) % f.w) + f.w) % f.w, y: clampY(p.y + dy, mode) })),
		[f.w, mode],
	);

	// Day and night are different sizes of sky: re-aim when the hour turns them
	// over, rather than leaving the view pointed off the end of the new one.
	useEffect(() => {
		setAt(opening(field));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [mode]);

	// Arrow keys: held keys sweep smoothly, a tap nudges. Escape is left alone —
	// App's close chain owns it. The world behind does not walk while this is
	// open (WorldScene.handleMovement checks bridge.shared.uiBlocking).
	useEffect(() => {
		const DIRS: Record<string, [number, number]> = {
			ArrowLeft: [-1, 0],
			ArrowRight: [1, 0],
			ArrowUp: [0, -1],
			ArrowDown: [0, 1],
			a: [-1, 0],
			d: [1, 0],
			w: [0, -1],
			s: [0, 1],
		};
		const key = (e: KeyboardEvent) => DIRS[e.key] || DIRS[e.key.toLowerCase()];
		const down = (e: KeyboardEvent) => {
			if (!key(e)) return;
			e.preventDefault(); // arrows scroll the panel body otherwise
			const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
			if (held.current.has(k)) return; // key repeat — the loop is already on it
			held.current.add(k);
			const [dx, dy] = key(e)!;
			move(dx * PAN_STEP, dy * PAN_STEP);
		};
		const up = (e: KeyboardEvent) => {
			held.current.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
		};
		const loop = (now: number) => {
			const dt = last.current ? Math.min(0.05, (now - last.current) / 1000) : 0;
			last.current = now;
			let dx = 0;
			let dy = 0;
			for (const k of held.current) {
				const d = DIRS[k];
				if (d) {
					dx += d[0];
					dy += d[1];
				}
			}
			if (dx || dy) move(dx * PAN_SPEED * dt, dy * PAN_SPEED * dt);
			raf.current = requestAnimationFrame(loop);
		};
		raf.current = requestAnimationFrame(loop);
		window.addEventListener('keydown', down);
		window.addEventListener('keyup', up);
		// A held key whose keyup goes somewhere else (alt-tab, a click outside)
		// would sweep forever — drop everything when the window goes away.
		const blur = () => held.current.clear();
		window.addEventListener('blur', blur);
		return () => {
			cancelAnimationFrame(raf.current);
			held.current.clear();
			last.current = 0;
			window.removeEventListener('keydown', down);
			window.removeEventListener('keyup', up);
			window.removeEventListener('blur', blur);
		};
	}, [move]);

	// Drag to sweep, for a mouse or a thumb. The barrel follows the pointer, so
	// dragging left brings the sky in from the right — the same way turning a
	// telescope feels.
	const drag = useRef<{ id: number; x: number; y: number } | null>(null);
	const onDown = (e: React.PointerEvent) => {
		drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	};
	const onMove = (e: React.PointerEvent) => {
		const d = drag.current;
		if (!d || d.id !== e.pointerId) return;
		const el = scope.current;
		const scale = el ? VIEW / el.clientWidth : 1;
		move((d.x - e.clientX) * scale, (d.y - e.clientY) * scale);
		drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
	};
	const onUp = (e: React.PointerEvent) => {
		if (drag.current?.id === e.pointerId) drag.current = null;
	};

	// What is in the crosshairs: the nearest thing to the middle, within reach —
	// measured the short way round, so a thing just over the wrap still counts.
	const aimed = useMemo(() => {
		let best: Placed | null = null;
		let bestScore = Infinity;
		for (const p of field) {
			const d = Math.hypot(wrapDx(at.x, p.x, mode), p.y - at.y);
			const reach = AIM[p.kind];
			if (d < reach && d - reach < bestScore) {
				best = p;
				bestScore = d - reach;
			}
		}
		return best;
	}, [field, at, mode]);

	// Hover wins over the crosshair — you pointed at that one on purpose.
	const shown = (hover && field.find((p) => p.id === hover)) || aimed;

	// The strip under the barrel: everything the eyepiece can currently see.
	const inView = field.filter((p) => Math.abs(wrapDx(at.x, p.x, mode)) < half + 70 && Math.abs(p.y - at.y) < half + 70);

	const centerOn = (p: Placed) => {
		setAt({ x: p.x, y: clampY(p.y, mode) });
		setHover(null);
	};

	if (!data || !state) return null;

	const wxName = content('weather', wx, 'name', weatherType(wx).name);
	// "rain or snow" — the weather a cloud you are NOT seeing today belongs to.
	const weatherList = (id: string) => {
		const list = (skyDef('day', id)?.weather || []).map((w) => content('weather', w, 'name', weatherType(w).name));
		return list.join(t('panels.telescope.or'));
	};
	const seasonName = content('weather', `season.${season}`, 'label', seasonStyle(season).label);
	const conditions = cloudedOut
		? t('panels.telescope.cloudedOut', { weather: wxName })
		: mode === 'day'
			? t('panels.telescope.today', { weather: wxName })
			: t('panels.telescope.tonight', { season: seasonName });

	const close = () => setPanel(null);
	// Three copies of everything, one field-width apart: the sweep runs off one
	// edge and onto the next without a seam, which is what makes the sky round.
	const TILES = [-f.w, 0, f.w];

	return (
		<div className="panel-backdrop" onClick={close}>
			<div className="panel panel-wide scope-panel" onClick={(e) => e.stopPropagation()}>
				<div className="panel-head">
					<h2>
						<Icon name={mode === 'day' ? 'cloud' : 'star'} size={20} /> {t('panels.telescope.title')}
					</h2>
					<button className="icon-btn" onClick={close} aria-label={t('panels.common.close')}>
						<Icon name="close" />
					</button>
				</div>
				<div className="panel-body scope-body">
					<div className="scope-conditions">
						<span className="scope-mode">
							{t(mode === 'day' ? 'panels.telescope.modeDay' : 'panels.telescope.modeNight')}
						</span>
						<span className="muted small">{conditions}</span>
					</div>

					<div className="scope-stage">
						<div
							className={`scope-eye ${mode}`}
							ref={scope}
							onPointerDown={onDown}
							onPointerMove={onMove}
							onPointerUp={onUp}
							onPointerCancel={onUp}
							role="img"
							aria-label={t('panels.telescope.eyepieceLabel')}
						>
							<svg
								viewBox={`${at.x - half} ${at.y - half} ${VIEW} ${VIEW}`}
								width="100%"
								height="100%"
								preserveAspectRatio="xMidYMid slice"
							>
								{TILES.map((ox) => (
									<SkyScene key={ox} mode={mode} pal={pal} ox={ox} biome={outside} />
								))}
								{TILES.map((ox) =>
									field.map((p) => {
										const box = BOX[p.kind];
										return (
											<g
												key={`${ox}:${p.id}`}
												transform={`translate(${p.x + ox - box.w / 2} ${p.y - box.h / 2})`}
												onPointerEnter={() => setHover(p.id)}
												onPointerLeave={() => setHover((h) => (h === p.id ? null : h))}
												style={{ cursor: 'pointer' }}
												// Today's sky is drawn; everything else is a ghost of itself.
												// The catalog is always ALL there — you can sweep round to a
												// thunderhead in February — but a rainbow at full strength in a
												// clear sky would be a lie about the weather, and the weather is
												// half of what this thing is for. Aiming at a ghost brings it up
												// enough to see, and the card says why it is faint.
												opacity={p.overhead ? 1 : shown?.id === p.id ? 0.55 : 0.26}
											>
												<rect x={0} y={0} width={box.w} height={box.h} fill="transparent" />
												<SkyArt kind={p.kind} id={p.id} hot={!!shown && shown.id === p.id} />
											</g>
										);
									}),
								)}
							</svg>
							<div className="scope-glass" />
							<div className={`scope-cross ${shown ? 'on' : ''}`} />
						</div>

						<div className="scope-read">
							{shown ? (
								<>
									<div className="scope-read-head">
										<h3 className="scope-name">{shown.name}</h3>
										{shown.overhead && (
											<span className="scope-badge">
												<Icon name="check" size={12} /> {t('panels.telescope.overhead')}
											</span>
										)}
									</div>
									<p className="muted small scope-byline">{shown.byline}</p>
									<p className="scope-text">{shown.text}</p>
									<p className="scope-note">
										<Icon name="sparkle" size={13} /> {shown.note}
									</p>
									<p className="muted small scope-where">{whereLine(t, shown, seasonName)}</p>
									{skyDef('night', shown.id)?.zodiac && (
										<p className="muted small scope-zodiac">
											{t('panels.telescope.zodiacLine', { when: tr(`narrative.sky.figures.${shown.id}.sun`) })}
										</p>
									)}
									{!shown.overhead && (
										<p className="muted small scope-notnow">
											{shown.mode === 'day'
												? t('panels.telescope.notToday', { weather: weatherList(shown.id) })
												: t('panels.telescope.notTonight', { when: whenLine(t, shown) })}
											{cloudedOut && ` ${t('panels.telescope.lidOn')}`}
										</p>
									)}
								</>
							) : (
								<div className="scope-empty">
									<Icon name="target" size={18} />
									<p className="muted small">{t('panels.telescope.aimHint')}</p>
								</div>
							)}
						</div>
					</div>

					<div className="scope-strip">
						<span className="muted small scope-strip-label">{t('panels.telescope.inView')}</span>
						{inView.length ? (
							inView.map((p) => (
								<button
									key={p.id}
									className={`scope-chip ${shown && shown.id === p.id ? 'on' : ''}`}
									onClick={() => centerOn(p)}
								>
									{p.name}
								</button>
							))
						) : (
							<span className="muted small">{t('panels.telescope.emptyView')}</span>
						)}
					</div>
					<p className="muted small scope-hint">{t('panels.telescope.hint')}</p>
				</div>
			</div>
		</div>
	);
}

/** When a night thing is worth going out for, in a sentence rather than a
 *  label — the second half of "not up tonight". */
function whenLine(t: (k: string, p?: Record<string, string | number>) => string, p: Placed): string {
	const def = skyDef('night', p.id);
	if (def?.circumpolar) return t('panels.telescope.allYear');
	const seasons = (def?.seasons || []).map((s) => t(`panels.telescope.seasons.${s}`));
	return seasons.length
		? t('panels.telescope.bestIn', { seasons: seasons.join(', ') })
		: t('panels.telescope.seasonsAny');
}

/** The last line of the card: where a cloud sits in the sky, when a figure is
 *  best seen, what sort of thing everything else is. All of it off the catalog
 *  rather than the prose, so a translation never has to keep a season list in
 *  step with the text above it. */
function whereLine(
	t: (k: string, p?: Record<string, string | number>) => string,
	p: Placed,
	seasonName: string,
): string {
	if (p.kind === 'cloud') {
		const level = CLOUDS.find((c) => c.id === p.id)?.level || 'mid';
		return t(`panels.telescope.levels.${level}`);
	}
	if (p.kind === 'optic') return t('panels.telescope.optic');
	if (p.kind === 'body') return t('panels.telescope.body');
	// Figures, deep-sky things and the showers all answer the same question:
	// when is it worth going out and looking for this?
	const def = skyDef(p.mode, p.id);
	if (def?.circumpolar) return t('panels.telescope.allYear');
	const seasons = (def?.seasons || []).map((s) => t(`panels.telescope.seasons.${s}`));
	if (seasons.length) return t('panels.telescope.bestIn', { seasons: seasons.join(', ') });
	return seasonName;
}
