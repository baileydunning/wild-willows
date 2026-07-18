import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
// Bundled dyslexia-specific font (guaranteed regardless of the OS's installed
// fonts) — activated by the data-dyslexia-font accessibility toggle via CSS.
import '@fontsource/opendyslexic/400.css';
import '@fontsource/opendyslexic/700.css';
// UI fonts are bundled (not Google Fonts CDN) so the iOS/desktop builds render
// identically with zero network. Weights mirror the old fonts.googleapis link.
import '@fontsource/fredoka/400.css';
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/quicksand/400.css';
import '@fontsource/quicksand/500.css';
import '@fontsource/quicksand/600.css';
import '@fontsource/quicksand/700.css';
import './styles.css';
import { localeReady } from './i18n';
import { installIosSavesBridge } from './solo/iosSaves';
import { isTouchDevice } from './ui/MobileControls';
import { startSteamReporting } from './solo/steamSync';
import { startMetricsUplink } from './solo/metricsUplink';
import { reportAppOpen } from './solo/appOpen';

// Compact layout (bottom-sheet panels, single-column grids, tighter HUD —
// see body.compact-ui in styles.css). Phones and tablets get it ALWAYS: a
// landscape iPhone is 844+ CSS px wide, so the old max-width media query
// never fired on the device that needed it most. Desktop keeps the exact
// same trigger as before — only when the window is genuinely narrow.
function applyCompactUi() {
	document.body.classList.toggle('compact-ui', isTouchDevice() || window.innerWidth <= 720);
}
applyCompactUi();
window.addEventListener('resize', applyCompactUi);

function mount() {
	ReactDOM.createRoot(document.getElementById('root')!).render(
		<React.StrictMode>
			<App />
		</React.StrictMode>,
	);
}

// Wait for the saved language to load before the first render so localized game
// content (tasks, narrative feed) starts in the right language instead of baking
// in English for a beat — but never block more than briefly, so a slow or failed
// catalog load still boots (in English) rather than hanging on a blank screen.
// On iOS the Filesystem saves bridge must be in place before the first render
// (the title screen lists save slots immediately); elsewhere it's a sync no-op.
const savesReady = installIosSavesBridge().catch(() => {});
Promise.all([savesReady, Promise.race([localeReady, new Promise((resolve) => setTimeout(resolve, 1500))])]).finally(
	mount,
);

// Desktop only: stream the active player's metrics to Steam (no-op elsewhere).
startSteamReporting();
// Solo only: mirror the local save's metrics to the hosted Harper when online.
startMetricsUplink();
// Acquisition funnel: record that the app was opened (anonymous, per-install), so
// the dashboard can measure how many opens go on to create a character.
reportAppOpen();
