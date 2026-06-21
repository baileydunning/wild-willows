import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import { startSteamReporting } from './solo/steamSync';

ReactDOM.createRoot(document.getElementById('root')!).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>
);

// Desktop only: stream the active player's metrics to Steam (no-op elsewhere).
startSteamReporting();
