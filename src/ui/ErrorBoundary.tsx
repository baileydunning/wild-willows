import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportClientError } from '../clientErrors';
import { t } from '../i18n';

// React unmounts the whole tree when a render throws, so without a boundary a
// single bad component turns the game into a blank page. The player has no idea
// what happened, no way back, and — worse — their save is fine the entire time.
//
// So this does two things a blank screen doesn't: it tells the server (nothing
// else does), and it tells the player their preserve is safe and offers them the
// one action that actually helps.

interface Props {
	children: ReactNode;
	/** Names the part of the interface that failed, so reports are separable. */
	where: string;
}

export class ErrorBoundary extends Component<Props, { failed: boolean }> {
	state = { failed: false };

	static getDerivedStateFromError() {
		return { failed: true };
	}

	componentDidCatch(error: Error, info: ErrorInfo) {
		const top = (info.componentStack || '').trim().split('\n')[0]?.trim() || '';
		reportClientError(error, `${this.props.where}${top ? ` ${top}` : ''}`);
	}

	render() {
		if (!this.state.failed) return this.props.children;
		return (
			<div className="crash">
				<h2>{t('app.crash.title')}</h2>
				{/* The reassurance matters more than the apology: the save is on disk
				    and untouched, and reloading loses nothing but the last few seconds. */}
				<p>{t('app.crash.body')}</p>
				<button className="big-btn primary" onClick={() => window.location.reload()}>
					{t('app.crash.reload')}
				</button>
			</div>
		);
	}
}
