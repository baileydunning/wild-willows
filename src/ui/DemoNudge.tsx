import { useState } from 'react';
import { STORE_ITCH_URL, STORE_MAS_URL } from '../demo';
import { useGame } from '../state';
import { useI18n } from '../i18n/react';
import { Icon } from './icons';

/**
 * DEMO only: the soft "Are you done playing?" prompt.
 *
 * Raised by watchDemoNudge (src/demoNudge.ts) when the window has sat untouched
 * for five minutes, or when the player has been away for a while and just come
 * back. Unlike the hard-stop popup at the end of the demo, this one is a
 * SUGGESTION: nothing is frozen, nothing is deleted, Escape or "Keep playing"
 * puts it away and the meadow is exactly where they left it.
 *
 * The order of the asks is the point. The save comes first and the store second,
 * because a save file in their downloads is a reason to come back that survives
 * closing the tab, while a store link they don't click leaves nothing behind.
 * The buy buttons only appear AFTER the export succeeds — at that moment the
 * pitch is no longer "buy this game", it's "you already have your meadow; here's
 * where it opens", which is a much smaller step to take.
 */
export function DemoNudge() {
	const { demoNudge, dismissDemoNudge, exportDemo } = useGame();
	const { t } = useI18n();
	const [exporting, setExporting] = useState(false);
	const [exported, setExported] = useState(false);
	const [exportError, setExportError] = useState(false);
	if (!demoNudge) return null;

	const onExport = async () => {
		setExporting(true);
		setExportError(false);
		const name = await exportDemo();
		setExporting(false);
		if (name) setExported(true);
		else setExportError(true);
	};

	return (
		<div
			className="panel-backdrop demo-done-backdrop demo-nudge-backdrop"
			role="dialog"
			aria-modal="true"
			aria-labelledby="demo-nudge-title"
		>
			<div className="panel demo-done-card demo-nudge-card">
				<div className="demo-done-icon">
					<Icon name={exported ? 'check' : 'paw'} size={30} />
				</div>
				<h2 id="demo-nudge-title">{exported ? t('app.demo.nudgeSavedTitle') : t('app.demo.nudgeTitle')}</h2>
				<p>{exported ? t('app.demo.nudgeSavedBody') : t('app.demo.nudgeBody')}</p>

				{!exported && (
					<button className="big-btn primary" onClick={onExport} disabled={exporting}>
						<Icon name="download" size={15} />{' '}
						<span>{exporting ? t('app.demo.exporting') : t('app.demo.exportButton')}</span>
					</button>
				)}
				{exportError && <p className="form-error">{t('app.demo.exportFail')}</p>}

				{/* Says the quiet part out loud: dismissing this doesn't cost them the
				    save. A prompt that looks like a last chance pressures people who
				    aren't ready, and the demo has nothing to gain from that. */}
				<p className="muted small demo-nudge-anytime">{t('app.demo.nudgeAnytime')}</p>

				{/* Both links leave the frame on purpose (see STORE_*_URL in src/demo.ts):
				    inside itch's embed, a same-frame navigation would close the game the
				    player is still in the middle of. */}
				{exported && (
					<div className="demo-nudge-stores">
						<a
							className="big-btn primary demo-nudge-store"
							href={STORE_ITCH_URL}
							target="_blank"
							rel="noopener noreferrer"
						>
							<Icon name="star" size={15} /> <span>{t('app.demo.storeItch')}</span>
						</a>
						<a className="big-btn demo-nudge-store" href={STORE_MAS_URL} target="_blank" rel="noopener noreferrer">
							<Icon name="star" size={15} /> <span>{t('app.demo.storeMas')}</span>
						</a>
					</div>
				)}

				<button className="big-btn subtle demo-nudge-dismiss" onClick={dismissDemoNudge}>
					<span>{exported ? t('app.demo.nudgeBackToGame') : t('app.demo.nudgeKeepPlaying')}</span>
				</button>
			</div>
		</div>
	);
}
