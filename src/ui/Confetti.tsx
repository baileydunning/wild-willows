import { useEffect, useRef } from 'react';
import { bridge } from '../game/bridge';

/**
 * A full-screen confetti celebration, fired via the bridge event `confetti` —
 * the grand-finale achievement (Caretaker of the Whole), and testable from dev
 * tools. Pure canvas + rAF, mounted once at the app root; it draws nothing (and
 * costs nothing) until triggered.
 *
 * The feel: two side "cannons" burst up-and-inward, plus a wide, gentle rain
 * from above — released in a few staggered waves so it lands as a big, joyful,
 * slow flutter rather than a quick sprinkle. Pieces sway on the way down.
 */
const COLORS = [
	'#6aa253',
	'#c9913f',
	'#5b9cab',
	'#cf8a3a',
	'#a5433a',
	'#7bae55',
	'#e6d3a6',
	'#d98a4f',
	'#7a9ac9',
	'#c86b9a',
	'#e8c14b',
];

interface Piece {
	x: number;
	y: number;
	vx: number;
	vy: number;
	rot: number;
	vr: number;
	w: number;
	h: number;
	color: string;
	shape: 0 | 1 | 2;
	sway: number;
	swaySpeed: number;
	swayAmp: number;
	life: number;
}

const GRAVITY = 0.028; // gentle — a slow, floaty descent
const TERMINAL = 2.3; // capped fall speed so nothing plummets
const DRAG = 0.988; // horizontal air resistance

export function Confetti() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const piecesRef = useRef<Piece[]>([]);
	const rafRef = useRef<number | null>(null);
	const tRef = useRef(0);
	const timersRef = useRef<number[]>([]);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const resize = () => {
			const dpr = Math.min(window.devicePixelRatio || 1, 2);
			canvas.width = window.innerWidth * dpr;
			canvas.height = window.innerHeight * dpr;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		};
		resize();
		window.addEventListener('resize', resize);

		const makePiece = (p: Partial<Piece>): Piece => {
			const w = 7 + Math.random() * 8;
			const shape = (Math.random() < 0.34 ? 2 : Math.random() < 0.5 ? 0 : 1) as 0 | 1 | 2;
			return {
				x: 0,
				y: 0,
				vx: 0,
				vy: 0,
				rot: Math.random() * Math.PI * 2,
				vr: (Math.random() - 0.5) * 0.22,
				w,
				h: shape === 2 ? w * (2.2 + Math.random()) : w * 0.7, // ribbons are long
				color: COLORS[(Math.random() * COLORS.length) | 0],
				shape,
				sway: Math.random() * Math.PI * 2,
				swaySpeed: 0.02 + Math.random() * 0.03,
				swayAmp: 0.6 + Math.random() * 1.8,
				life: 0,
				...p,
			};
		};

		// One wave: a wide gentle rain from the top + two corner cannons firing up-inward.
		const wave = () => {
			const W = window.innerWidth,
				H = window.innerHeight;
			const rain = Math.min(160, Math.round(W / 7));
			for (let i = 0; i < rain; i++) {
				piecesRef.current.push(
					makePiece({
						x: Math.random() * W,
						y: -20 - Math.random() * H * 0.4,
						vx: (Math.random() - 0.5) * 1.2,
						vy: 0.4 + Math.random() * 1.2,
					}),
				);
			}
			const perCannon = 42;
			for (const side of [0, 1]) {
				const ox = side === 0 ? -10 : W + 10;
				const dir = side === 0 ? 1 : -1;
				for (let i = 0; i < perCannon; i++) {
					const ang = Math.random() * 0.5 + 0.15; // up-and-inward spread
					const speed = 9 + Math.random() * 7;
					piecesRef.current.push(
						makePiece({
							x: ox,
							y: H * (0.72 + Math.random() * 0.2),
							vx: dir * Math.cos(ang) * speed,
							vy: -Math.sin(ang) * speed - 3,
						}),
					);
				}
			}
			if (rafRef.current == null) {
				tRef.current = 0;
				rafRef.current = window.requestAnimationFrame(tick);
			}
		};

		const launch = () => {
			// A few staggered waves so the celebration lasts and keeps refreshing.
			wave();
			timersRef.current.push(window.setTimeout(wave, 350));
			timersRef.current.push(window.setTimeout(wave, 750));
			timersRef.current.push(window.setTimeout(wave, 1200));
		};

		const tick = () => {
			const H = window.innerHeight;
			tRef.current += 1;
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			const alive: Piece[] = [];
			for (const p of piecesRef.current) {
				p.life += 1;
				p.vy = Math.min(TERMINAL, p.vy + GRAVITY);
				p.vx *= DRAG;
				p.sway += p.swaySpeed;
				p.x += p.vx + Math.sin(p.sway) * p.swayAmp;
				p.y += p.vy;
				p.rot += p.vr;
				if (p.y < H + 40) alive.push(p);
				ctx.save();
				ctx.translate(p.x, p.y);
				ctx.rotate(p.rot);
				ctx.fillStyle = p.color;
				ctx.globalAlpha = p.life < 8 ? p.life / 8 : 1; // brief fade-in
				if (p.shape === 1) {
					ctx.beginPath();
					ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
					ctx.fill();
				} else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); // square or ribbon
				ctx.restore();
			}
			piecesRef.current = alive;
			if (alive.length > 0) {
				rafRef.current = window.requestAnimationFrame(tick);
			} else {
				ctx.clearRect(0, 0, canvas.width, canvas.height);
				rafRef.current = null;
			}
		};

		const off = bridge.on('confetti', launch);
		return () => {
			off();
			window.removeEventListener('resize', resize);
			if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current);
			timersRef.current.forEach((id) => window.clearTimeout(id));
			timersRef.current = [];
			rafRef.current = null;
			piecesRef.current = [];
		};
	}, []);

	return <canvas ref={canvasRef} className="confetti-canvas" aria-hidden="true" />;
}
