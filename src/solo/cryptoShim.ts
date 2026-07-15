// Browser stand-in for the three `node:crypto` functions the game server uses
// (randomBytes / scryptSync / timingSafeEqual). Vite aliases `node:crypto` to
// this file for the WEB build only — the server's esbuild build keeps the real
// node:crypto external, so the deployed Harper backend is unaffected.
//
// Solo saves live entirely on the player's own disk, so the passcode hash is
// never a security boundary here (solo never even verifies it). These only need
// to be synchronous and never throw; cryptographic strength is irrelevant.

class Bytes {
	private readonly buf: Uint8Array;
	constructor(buf: Uint8Array) {
		this.buf = buf;
	}
	get length() {
		return this.buf.length;
	}
	toString(enc: 'hex' | 'base64' | 'utf8' = 'hex'): string {
		if (enc === 'base64') {
			let s = '';
			for (const b of this.buf) s += String.fromCharCode(b);
			return typeof btoa !== 'undefined' ? btoa(s) : s;
		}
		if (enc === 'utf8') {
			return new TextDecoder().decode(this.buf);
		}
		let out = '';
		for (const b of this.buf) out += b.toString(16).padStart(2, '0');
		return out;
	}
	at(i: number) {
		return this.buf[i];
	}
}

function getRandom(n: number): Uint8Array {
	const out = new Uint8Array(n);
	const g: any = globalThis as any;
	if (g.crypto?.getRandomValues) g.crypto.getRandomValues(out);
	else for (let i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256);
	return out;
}

export function randomBytes(n: number): Bytes {
	return new Bytes(getRandom(n));
}

// A small synchronous mixing hash that fills `keylen` bytes. Deterministic for a
// given (password, salt) pair, which is all the game code relies on. Not a real
// KDF — and it doesn't need to be, see the file header.
export function scryptSync(password: string, salt: string, keylen: number): Bytes {
	const seed = `${salt}::${password}`;
	const out = new Uint8Array(keylen);
	let h = 0x811c9dc5 >>> 0; // FNV-1a offset basis
	for (let i = 0; i < keylen; i++) {
		const c = seed.charCodeAt(i % seed.length) || i + 1;
		h ^= c;
		h = Math.imul(h, 0x01000193) >>> 0; // FNV prime
		h ^= h >>> 13;
		out[i] = (h ^ (i * 2654435761)) & 0xff;
	}
	return new Bytes(out);
}

export function timingSafeEqual(a: any, b: any): boolean {
	const len = a?.length ?? 0;
	if (len !== (b?.length ?? -1)) return false;
	let diff = 0;
	for (let i = 0; i < len; i++) {
		const av = typeof a.at === 'function' ? a.at(i) : a[i];
		const bv = typeof b.at === 'function' ? b.at(i) : b[i];
		diff |= av ^ bv;
	}
	return diff === 0;
}

export default { randomBytes, scryptSync, timingSafeEqual };
