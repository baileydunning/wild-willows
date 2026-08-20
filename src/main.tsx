import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import { localeReady } from './i18n';
import { startSteamReporting } from './solo/steamSync';
import { startMetricsUplink } from './solo/metricsUplink';
import { reportAppOpen } from './solo/appOpen';
import { watchDesktopSaveRecovery } from './solo/saveIncident';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { installGlobalErrorReporting } from './clientErrors';

// Before anything renders, so a crash during boot is reported too.
installGlobalErrorReporting();

function mount() {
	ReactDOM.createRoot(document.getElementById('root')!).render(
		<React.StrictMode>
			{/* Outside StrictMode's double-render there is nothing between a thrown
			    render and a blank page. The boundary is the whole tree because a
			    crash anywhere in it takes the whole tree down anyway. */}
			<ErrorBoundary where="app">
				<App />
			</ErrorBoundary>
		</React.StrictMode>,
	);
}

// Wait for the saved language to load before the first render so localized game
// content (tasks, narrative feed) starts in the right language instead of baking
// in English for a beat — but never block more than briefly, so a slow or failed
// catalog load still boots (in English) rather than hanging on a blank screen.
Promise.race([localeReady, new Promise((resolve) => setTimeout(resolve, 1500))]).finally(mount);

// Desktop only: stream the active player's metrics to Steam (no-op elsewhere).
startSteamReporting();
// Solo only: mirror the local save's metrics to the hosted Harper when online.
startMetricsUplink();
// Desktop only: report a save slot that had to be recovered from its backup.
watchDesktopSaveRecovery();
// Acquisition funnel: record that the app was opened (anonymous, per-install), so
// the dashboard can measure how many opens go on to create a character.
reportAppOpen();
