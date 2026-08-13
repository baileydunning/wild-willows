import React, { useEffect, useRef, useState } from 'react';
import { bridge } from '../game/bridge';

export function isTouchDevice() {
	return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
}

/**
 * Virtual joystick for phones and tablets.
 *
 * It sits on the RIGHT. On the left it overlapped the activity feed, which is
 * anchored bottom-left and up to 168px tall — phones hide the feed under 720px,
 * so this only ever showed up on the larger touch screens.
 *
 * There is no on-screen interact button. Tapping a thing already runs it, and
 * the players on touch have keyboards for the key-only actions (sleep), so the
 * button was a third way to do what two other inputs already covered.
 */
export function MobileControls() {
	const [active, setActive] = useState(false);
	const baseRef = useRef<HTMLDivElement>(null);
	const knobRef = useRef<HTMLDivElement>(null);
	const padRef = useRef<{ cx: number; cy: number; hw: number; hh: number } | null>(null);
	const pointerId = useRef<number | null>(null);

	useEffect(() => {
		return () => {
			bridge.shared.joy = { x: 0, y: 0 };
		};
	}, []);

	if (!isTouchDevice()) return null;

	// Measured once per gesture instead of once per pointermove.
	//
	// getBoundingClientRect() forces a synchronous layout, and the previous move
	// had just written `transform` to the knob — so every move was a read-after-
	// write layout thrash, for the entire time a finger was on the stick. Which
	// is exactly when Phaser needs the frame budget. The pad is fixed-position
	// and cannot move while the gesture is in flight, so one measurement holds.
	const measure = () => {
		const base = baseRef.current;
		if (!base) return;
		const rect = base.getBoundingClientRect();
		padRef.current = {
			cx: rect.left + rect.width / 2,
			cy: rect.top + rect.height / 2,
			hw: rect.width / 2,
			hh: rect.height / 2,
		};
	};

	// Written straight to the DOM and to the bridge. Phaser reads
	// bridge.shared.joy in its own update(), so driving the knob through React
	// state meant a full render (and a commit) per pointer event to move one
	// element by a few pixels — work React was doing on Phaser's thread.
	const moveKnob = (x: number, y: number) => {
		const el = knobRef.current;
		if (el) el.style.transform = `translate(${x * 26}px, ${y * 26}px)`;
		bridge.shared.joy = { x, y };
	};

	const updateFromEvent = (e: React.PointerEvent) => {
		const pad = padRef.current;
		if (!pad) return;
		let dx = (e.clientX - pad.cx) / pad.hw;
		let dy = (e.clientY - pad.cy) / pad.hh;
		const len = Math.hypot(dx, dy);
		if (len > 1) {
			dx /= len;
			dy /= len;
		}
		moveKnob(dx, dy);
	};

	const release = () => {
		pointerId.current = null;
		padRef.current = null;
		setActive(false);
		moveKnob(0, 0);
	};

	return (
		<div
			ref={baseRef}
			className={`joystick ${active ? 'active' : ''}`}
			onPointerDown={(e) => {
				pointerId.current = e.pointerId;
				(e.target as HTMLElement).setPointerCapture(e.pointerId);
				setActive(true);
				measure();
				updateFromEvent(e);
			}}
			onPointerMove={(e) => {
				if (pointerId.current === e.pointerId) updateFromEvent(e);
			}}
			onPointerUp={release}
			onPointerCancel={release}
		>
			<div ref={knobRef} className="joystick-knob" />
		</div>
	);
}
