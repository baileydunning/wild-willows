import { useEffect, useState } from 'react';
import { api } from '../api';
import { bridge } from '../game/bridge';
import { useGame } from '../state';
import type { Peer, RosterEntry } from '../types';
import { useI18n } from '../i18n/react';
import { Icon } from './icons';

/**
 * The People menu (U). In a co-op preserve it shows the join code, the full join
 * history (everyone who has ever joined — they stay on the roster so they can
 * always return), who's online right now, the host's pending requests, and
 * whether the world has hit its cap and closed. Solo games just explain co-op.
 */
export function PeoplePanel() {
	const { worlds, activeWorldId, state, setPanel, refreshWorlds, notify, pendingRequests, approveJoin, denyJoin } = useGame();
	const { t } = useI18n();
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
		catch { notify(t('panels.people.codeIs', { code: world.joinCode }), 'info'); }
	};

	return (
		<div className="panel-backdrop" onClick={() => setPanel(null)}>
			<div className="panel" onClick={(e) => e.stopPropagation()}>
				<div className="panel-head">
					<h2><Icon name="user" size={20} /> {isCoop ? t('panels.people.titleCoop') : t('panels.people.title')}</h2>
					<button className="icon-btn" onClick={() => setPanel(null)} aria-label={t('panels.common.close')}><Icon name="close" /></button>
				</div>
				<div className="panel-body">
					{!isCoop ? (
						<p className="muted">
							{t('panels.people.soloInfo')}
						</p>
					) : (
						<>
							<div className="recipe">
								<div className="grow">
									<b>{t('panels.people.invite', { world: world!.name })}</b>
									{closed ? (
										<div className="muted small">
											{t('panels.people.closedInfo', { count: roster.length, max: maxMembers })}
										</div>
									) : (
										<div className="muted small">
											{t('panels.people.shareInfo', { count: roster.length, max: maxMembers })}
										</div>
									)}
									<div className="join-code-big" style={{ marginTop: 6, letterSpacing: 2, fontWeight: 700, fontSize: 22 }}>
										{world!.joinCode}
									</div>
								</div>
								<button className="primary" onClick={copy} disabled={!world!.joinCode}>
									<Icon name="plus" size={14} /> {copied ? t('panels.people.copied') : t('panels.people.copyCode')}
								</button>
							</div>

							{world!.isOwner && pendingRequests.length > 0 && (
								<>
									<h3>{t('panels.people.wantsToJoin', { count: pendingRequests.length })}</h3>
									<div className="world-list">
										{pendingRequests.map((rq) => (
											<div className="recipe world-row" key={rq.token}>
												<div className="grow"><b>{rq.name}</b> <span className="muted small">{t('panels.people.asking')}</span></div>
												<button className="primary" disabled={busyToken === rq.token} onClick={async () => {
													setBusyToken(rq.token);
													try { await approveJoin(rq.token); notify(t('panels.people.canNowJoin', { name: rq.name }), 'unlock'); }
													catch (e: any) { notify(e?.message || t('panels.people.couldNotApprove'), 'error'); }
													finally { setBusyToken(null); }
												}}>{t('panels.people.approve')}</button>
												<button className="subtle" disabled={busyToken === rq.token} onClick={async () => {
													setBusyToken(rq.token);
													try { await denyJoin(rq.token); }
													catch (e: any) { notify(e?.message || t('panels.people.couldNotDeny'), 'error'); }
													finally { setBusyToken(null); }
												}}>{t('panels.people.deny')}</button>
											</div>
										))}
									</div>
								</>
							)}

							<h3>{t('panels.people.caretakers', { count: roster.length, max: maxMembers })}{closed ? ` ${t('panels.people.closedTag')}` : ''}</h3>
							<div className="world-list">
								{roster.map((m) => {
									const online = onlineIds.has(m.playerId);
									const isMe = m.playerId === myId;
									return (
										<div className={`recipe world-row ${online ? 'world-active' : ''}`} key={m.playerId}>
											<div className="grow">
												<b>{m.name}</b>
												{m.isOwner && <span className="muted small"> {t('panels.people.host')}</span>}
												{isMe && <span className="muted small"> {t('panels.people.you')}</span>}
											</div>
											<span className={`muted small presence-dot ${online ? 'on' : 'off'}`}>{online ? t('panels.people.hereNow') : t('panels.people.away')}</span>
										</div>
									);
								})}
								{roster.length === 0 && <p className="muted small">{t('panels.people.justYou')}</p>}
							</div>
							<p className="muted small">
								{t('panels.people.membersNote', { max: maxMembers })}
							</p>
						</>
					)}
				</div>
			</div>
		</div>
	);
}
