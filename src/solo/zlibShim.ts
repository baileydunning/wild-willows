// Browser stand-in for the `node:zlib` functions the game server imports
// (gzipSync / brotliCompressSync / constants). Vite aliases `node:zlib` to this
// file for the WEB build only — the server's esbuild build keeps the real
// node:zlib external, so the deployed Harper backend is unaffected.
//
// These are NEVER actually called in the browser: response compression only runs
// on the hosted Harper's HTTP path, and GameData.get() returns the plain data
// object (no compression) whenever there's no HTTP request context — which is
// always the case for the in-app solo backend. This shim exists purely so the
// static `import … from 'node:zlib'` resolves cleanly in the web bundle. The
// stubs are inert and must never throw, matching the crypto shim's contract.

export const constants = {
	BROTLI_PARAM_QUALITY: 1,
	BROTLI_PARAM_SIZE_HINT: 2,
} as const;

// Return the input untouched (identity). Never reached in the browser; if it ever
// were, callers treat the result as an opaque body, so an uncompressed passthrough
// is safe and self-consistent.
export function gzipSync(buf: any): any {
	return buf;
}

export function brotliCompressSync(buf: any): any {
	return buf;
}

export default { constants, gzipSync, brotliCompressSync };
