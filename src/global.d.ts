// injected by vite at build time (see vite.config.ts `define`)
declare const __BUILD_TIME__: string;
declare const __APP_VERSION__: string;
declare const __DEMO__: boolean;
declare const __CHANNEL__: string;

// Side-effect CSS/font imports (bundled by vite, not tsc). TS 6+ requires an
// ambient declaration for these or it errors with TS2882.
declare module '*.css';
