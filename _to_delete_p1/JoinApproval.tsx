import { useState } from 'react';
import { useGame } from '../state';
import { useI18n } from '../i18n/react';
import { Icon } from './icons';

/**
 * Auto-popup for the host: whenever one or more caretakers have asked to join the
 * shared world, this modal appears listing all of them with Approve / Deny. It
 * shows over the game so the host never misses a request.
 */
export function JoinApprovalPopup() {
	const { worlds, activeWorldId, pendingRequests, approveJoin, denyJoin, notify } = useGame();
	const { t } = useI18n();
	const [busy, setBusy] = useState<string | null>(null);

	const world = worlds.find((w) => w.worldId === activeWorldId);
	if (!world || world.solo || !world.isOwner || pendingRequests.length === 0) return null;

	const act = async (token: string, name: string, approve: boolean) => {
		setBusy(token);
		try {
			if (approve) {
				await approveJoin(token);
				notify(t('panels.people.canNowJoin', { name }), 'unlock');
			} else await denyJoin(token);
		} catch (e: any) {
			notify(e?.message || t('panels.joinApproval.error'), 'error');
		} finally {
			setBusy(null);
		}
	};

	return (
		<div className="approval-pop">
			<div className="approval-head">
				<Icon name="user" size={16} />
				<b>{t('panels.joinApproval.wantsToJoin', { count: pendingRequests.length })}</b>
			</div>
			<div className="approval-list">
				{pendingRequests.map((rq) => (
					<div className="approval-row" key={rq.token}>
						<span className="grow">
							<b>{rq.name}</b>
						</span>
						<button className="approve-btn" disabled={busy === rq.token} onClick={() => act(rq.token, rq.name, true)}>
							<Icon name="check" size={14} /> {t('panels.joinApproval.letIn')}
						</button>
						<button className="deny-btn" disabled={busy === rq.token} onClick={() => act(rq.token, rq.name, false)}>
							<Icon name="close" size={14} /> {t('panels.joinApproval.no')}
						</button>
					</div>
				))}
			</div>
		</div>
	);
}
