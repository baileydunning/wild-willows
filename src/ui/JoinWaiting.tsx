import { useEffect, useState } from 'react';
import { useGame } from '../state';
import { Icon } from './icons';

/**
 * Shown after a joiner creates their character but before the host has approved
 * them. Polls for approval; when granted, the state context drops us straight
 * into the shared world. If denied, they can fall back to a solo game.
 */
export function JoinWaitingScreen() {
	const { pendingJoin, checkJoinApproval, playSoloInstead, logout } = useGame();
	const [status, setStatus] = useState<'pending' | 'denied' | 'none'>('pending');

	useEffect(() => {
		if (!pendingJoin) return;
		let alive = true;
		const tick = async () => {
			try {
				const s = await checkJoinApproval();
				if (alive && s !== 'approved') setStatus(s);
			} catch { /* keep waiting */ }
		};
		tick();
		const id = window.setInterval(tick, 1500);
		return () => { alive = false; window.clearInterval(id); };
	}, [pendingJoin, checkJoinApproval]);

	if (!pendingJoin) return null;
	const denied = status === 'denied';

	return (
		<div className="welcome">
			<div className="welcome-sky" />
			<div className="welcome-card">
				<h1 className="game-title">Wild Willows</h1>
				{denied ? (
					<>
						<div className="tutorial-icon" style={{ margin: '0 auto 10px' }}><Icon name="close" size={22} /></div>
						<p className="muted">
							{pendingJoin.hostName} didn’t let you into <b>{pendingJoin.worldName}</b> this time.
							You can still play your own solo preserve, or head back.
						</p>
						<div className="form-actions">
							<button className="big-btn subtle" onClick={logout}><Icon name="back" /> <span>Back to menu</span></button>
							<button className="big-btn primary" onClick={playSoloInstead}><Icon name="leaf" /> <span>Play solo instead</span></button>
						</div>
					</>
				) : (
					<>
						<div className="tutorial-icon spin-slow" style={{ margin: '0 auto 10px' }}><Icon name="leaf" size={22} /></div>
						<h2 style={{ margin: '0 0 4px' }}>Waiting for the host…</h2>
						<p className="muted">
							Your character’s ready! <b>{pendingJoin.hostName}</b> just needs to let you in to <b>{pendingJoin.worldName}</b>.
							This page will open the world the moment they approve.
						</p>
						<div className="form-actions">
							<button className="big-btn subtle" onClick={logout}><Icon name="close" size={14} /> <span>Cancel</span></button>
							<button className="big-btn" onClick={playSoloInstead}><Icon name="leaf" /> <span>Play solo while you wait</span></button>
						</div>
					</>
				)}
			</div>
		</div>
	);
}
