import React, { useEffect, useRef, useState } from 'react';
import { bridge } from '../game/bridge';

export function isTouchDevice() {
	return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
}

/** Virtual joystick (bottom-right) for phones and tablets. There is no
 *  separate interact button — tapping a thing in the world interacts with it
 *  (walking you over first if it's out of reach; see WorldScene). App.tsx
 *  unmounts this while any panel/card overlay is open so the joystick never
 *  floats on top of a modal. */
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
