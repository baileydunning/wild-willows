import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
// Bundled dyslexia-specific font (guaranteed regardless of the OS's installed
// fonts) — activated by the data-dyslexia-font accessibility toggle via CSS.
import '@fontsource/opendyslexic/400.css';
import '@fontsource/opendyslexic/700.css';
import './styles.css';
import { localeReady } from './i18n';
import { startSteamReporting } from './solo/steamSync';
import { startMetricsUplink } from './solo/metricsUplink';
import { reportAppOpen } from './solo/appOpen';

function mount() {
	ReactDOM.createRoot(document.getElementById('root')!).render(
		<React.StrictMode>
			<App />
		</React.StrictMode>
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
// Acquisition funnel: record that the app was opened (anonymous, per-install), so
// the dashboard can measure how many opens go on to create a character.
reportAppOpen();
