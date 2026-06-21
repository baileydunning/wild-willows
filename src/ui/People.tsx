import { useEffect, useState } from 'react';
import { api } from '../api';
import { bridge } from '../game/bridge';
import { useGame } from '../state';
import type { Peer, RosterEntry } from '../types';
import { Icon } from './icons';

/**
 * The People menu (U). In a co-op preserve it shows the join code, the full join
 * history (everyone who has ever joined — they stay on the roster so they can
 * always return), who's online right now, the host's pending requests, and
 * whether the world has hit its cap and closed. Solo games just explain co-op.
 */
export function PeoplePanel() {
	const { worlds, activeWorldId, state, setPanel, refreshWorlds, notify, pendingRequests, approveJoin, denyJoin } = useGame();
	const [copied, setCopied] = useState(false);
	const [busyToken, setBusyToken] = useState<string | null>(null);
	const [roster, setRoster] = useState<RosterEntry[]>([]);
	const [closed, setClosed] = useState(false);
	const [maxMembers, setMaxMembers] = useState(6);
	const [, force] = useState(0);

	const world = worlds.find((w) => w.worldId === activeWorldId);
	const isCoop = !!world && !world.solo;

	useEffect(() => { refreshWorlds().catch(() => undefined); }, [refreshWorlds]);
	useEffect(() => bridge.on('presence-updated', () => force((n) => n + 1)), []);
	// pull the join-history roster on open and keep it fresh while the menu is up
	useEffect(() => {
		if (!isCoop) return;
		let alive = true;
		const load = async () => {
			try {
				const r = await api.worldRoster();
				if (!alive) return;
				setRoster(r.roster || []);
				setClosed(!!r.closed);
				setMaxMembers(r.maxMembers || 6);
			} catch { /* ignore */ }
		};
		load();
		const id = window.setInterval(load, 3000);
		return () => { alive = false; window.clearInterval(id); };
	}, [isCoop, activeWorldId]);

	const peers: Peer[] = bridge.shared.presence || [];
	const myId = state?.player?.id;
	const onlineIds = new Set<string>([...peers.map((p) => p.playerId), ...(myId ? [myId] : [])]);

	const copy = async () => {
		if (!world?.joinCode) return;
		try { await navigator.clipboard.writeText(world.joinCode); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }
		catch { notify(`Your code is ${world.joinCode}`, 'info'); }
	};

	return (
		<div className="panel-backdrop" onClick={() => setPanel(null)}>
			<div className="panel" onClick={(e) => e.stopPropagation()}>
				<div className="panel-head">
					<h2><Icon name="user" size={20} /> {isCoop ? 'Caretakers' : 'People'}</h2>
					<button className="icon-btn" onClick={() => setPanel(null)} aria-label="Close"><Icon name="close" /></button>
				</div>
				<div className="panel-body">
					{!isCoop ? (
						<p className="muted">
							This is a <b>solo</b> preserve — just you. To restore a preserve together with friends,
							start a <b>New Game</b> and choose <b>Co-op</b>: you'll get a join code to share.
						</p>
					) : (
						<>
							<div className="recipe">
								<div className="grow">
									<b>Invite friends to {world!.name}</b>
									{closed ? (
										<div className="muted small">
											This preserve is <b>full ({roster.length}/{maxMembers})</b> and closed to new players. Everyone who has joined can always come back.
										</div>
									) : (
										<div className="muted small">
											Share this code ({roster.length}/{maxMembers} caretakers so far). Friends open <b>New Game → Co-op → Join a friend's world</b> and enter it.
										</div>
									)}
									<div className="join-code-big" style={{ marginTop: 6, letterSpacing: 2, fontWeight: 700, fontSize: 22 }}>
										{world!.joinCode}
									</div>
								</div>
								<button className="primary" onClick={copy} disabled={!world!.joinCode}>
									<Icon name="plus" size={14} /> {copied ? 'Copied ✓' : 'Copy code'}
								</button>
							</div>

							{world!.isOwner && pendingRequests.length > 0 && (
								<>
									<h3>Wants to join ({pendingRequests.length})</h3>
									<div className="world-list">
										{pendingRequests.map((rq) => (
											<div className="recipe world-row" key={rq.token}>
												<div className="grow"><b>{rq.name}</b> <span className="muted small">· is asking to join</span></div>
												<button className="primary" disabled={busyToken === rq.token} onClick={async () => {
													setBusyToken(rq.token);
													try { await approveJoin(rq.token); notify(`${rq.name} can now join`, 'unlock'); }
													catch (e: any) { notify(e?.message || 'Could not approve', 'error'); }
													finally { setBusyToken(null); }
												}}>Approve</button>
												<button className="subtle" disabled={busyToken === rq.token} onClick={async () => {
													setBusyToken(rq.token);
													try { await denyJoin(rq.token); }
													catch (e: any) { notify(e?.message || 'Could not deny', 'error'); }
													finally { setBusyToken(null); }
												}}>Deny</button>
											</div>
										))}
									</div>
								</>
							)}

							<h3>Caretakers ({roster.length}/{maxMembers}){closed ? ' · closed' : ''}</h3>
							<div className="world-list">
								{roster.map((m) => {
									const online = onlineIds.has(m.playerId);
									const isMe = m.playerId === myId;
									return (
										<div className={`recipe world-row ${online ? 'world-active' : ''}`} key={m.playerId}>
											<div className="grow">
												<b>{m.name}</b>
												{m.isOwner && <span className="muted small"> · host</span>}
												{isMe && <span className="muted small"> · you</span>}
											</div>
											<span className={`muted small presence-dot ${online ? 'on' : 'off'}`}>{online ? 'here now' : 'away'}</span>
										</div>
									);
								})}
								{roster.length === 0 && <p className="muted small">Just you so far. Share the code above to invite friends.</p>}
							</div>
							<p className="muted small">
								Up to {maxMembers} caretakers per preserve. Everyone listed has joined and can return any time from <b>Continue</b> or <b>Load Game</b>.
							</p>
						</>
					)}
				</div>
			</div>
		</div>
	);
}
