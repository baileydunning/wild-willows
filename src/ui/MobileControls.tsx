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
	const [knob, setKnob] = useState({ x: 0, y: 0 });
	const pointerId = useRef<number | null>(null);

	useEffect(() => {
		return () => {
			bridge.shared.joy = { x: 0, y: 0 };
		};
	}, []);

	if (!isTouchDevice()) return null;

	const updateFromEvent = (e: React.PointerEvent) => {
		const base = baseRef.current;
		if (!base) return;
		const rect = base.getBoundingClientRect();
		const cx = rect.left + rect.width / 2;
		const cy = rect.top + rect.height / 2;
		let dx = (e.clientX - cx) / (rect.width / 2);
		let dy = (e.clientY - cy) / (rect.height / 2);
		const len = Math.hypot(dx, dy);
		if (len > 1) {
			dx /= len;
			dy /= len;
		}
		setKnob({ x: dx, y: dy });
		bridge.shared.joy = { x: dx, y: dy };
	};

	const release = () => {
		pointerId.current = null;
		setActive(false);
		setKnob({ x: 0, y: 0 });
		bridge.shared.joy = { x: 0, y: 0 };
	};

	return (
		<div
			ref={baseRef}
			className={`joystick ${active ? 'active' : ''}`}
			onPointerDown={(e) => {
				pointerId.current = e.pointerId;
				(e.target as HTMLElement).setPointerCapture(e.pointerId);
				setActive(true);
				updateFromEvent(e);
			}}
			onPointerMove={(e) => {
				if (pointerId.current === e.pointerId) updateFromEvent(e);
			}}
			onPointerUp={release}
			onPointerCancel={release}
		>
			<div className="joystick-knob" style={{ transform: `translate(${knob.x * 26}px, ${knob.y * 26}px)` }} />
		</div>
	);
}
