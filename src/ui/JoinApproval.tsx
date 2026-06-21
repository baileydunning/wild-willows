import { useState } from 'react';
import { useGame } from '../state';
import { Icon } from './icons';

/**
 * Auto-popup for the host: whenever one or more caretakers have asked to join the
 * shared world, this modal appears listing all of them with Approve / Deny. It
 * shows over the game so the host never misses a request.
 */
export function JoinApprovalPopup() {
	const { worlds, activeWorldId, pendingRequests, approveJoin, denyJoin, notify } = useGame();
	const [busy, setBusy] = useState<string | null>(null);

	const world = worlds.find((w) => w.worldId === activeWorldId);
	if (!world || world.solo || !world.isOwner || pendingRequests.length === 0) return null;

	const act = async (token: string, name: string, approve: boolean) => {
		setBusy(token);
		try {
			if (approve) { await approveJoin(token); notify(`${name} can now join`, 'unlock'); }
			else await denyJoin(token);
		} catch (e: any) {
			notify(e?.message || 'Could not respond to that request', 'error');
		} finally {
			setBusy(null);
		}
	};

	return (
		<div className="approval-pop">
			<div className="approval-head">
				<Icon name="user" size={16} />
				<b>{pendingRequests.length === 1 ? 'Someone wants to join' : `${pendingRequests.length} caretakers want to join`}</b>
			</div>
			<div className="approval-list">
				{pendingRequests.map((rq) => (
					<div className="approval-row" key={rq.token}>
						<span className="grow"><b>{rq.name}</b></span>
						<button className="approve-btn" disabled={busy === rq.token} onClick={() => act(rq.token, rq.name, true)}>
							<Icon name="check" size={14} /> Let in
						</button>
						<button className="deny-btn" disabled={busy === rq.token} onClick={() => act(rq.token, rq.name, false)}>
							<Icon name="close" size={14} /> No
						</button>
					</div>
				))}
			</div>
		</div>
	);
}
