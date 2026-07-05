import React, { useEffect, useRef, useState } from 'react';
import { bridge } from '../game/bridge';
import { useI18n } from '../i18n/react';
import { Icon } from './icons';

export function isTouchDevice() {
	return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
}

/** Virtual joystick + interact button for phones and tablets. */
export function MobileControls() {
	const { t } = useI18n();
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
		<>
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
				<div
					className="joystick-knob"
					style={{ transform: `translate(${knob.x * 26}px, ${knob.y * 26}px)` }}
				/>
			</div>
			<button
				className="interact-btn"
				aria-label={t('app.mobile.interact')}
				onPointerDown={(e) => {
					e.preventDefault();
					bridge.emit('mobile-interact');
				}}
			>
				<Icon name="sparkle" size={26} />
			</button>
		</>
	);
}
