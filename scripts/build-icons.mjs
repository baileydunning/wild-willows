// Generates the desktop app icons in build/ from a single source artwork.
//
//   node scripts/build-icons.mjs [source.png]
//
// Why this exists: a full-bleed square dropped straight into build/icon.icns
// renders NOTICEABLY LARGER than every other icon in the macOS Dock. macOS does
// not mask or inset app icons — whatever you ship is drawn at full size — so the
// inset is part of the artwork, and Apple's icon grid specifies it:
//
//   • 1024×1024 canvas
//   • artwork occupies a 824×824 rounded square, centered (≈100px clear on each side)
//   • corner radius ≈ 185.4 at that size (≈0.225 of the square)
//
// That 824/1024 ratio is what makes an icon sit at the same visual size as its
// neighbors. Windows and Linux do NOT inset or mask, so they get the full-bleed
// square instead — same artwork, different framing per platform.
//
// Requires sharp (devDependency). Everything else is hand-rolled so there's no
// dependency on macOS-only tools like iconutil — this runs anywhere.

import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BUILD = join(ROOT, 'build');
const SRC = process.argv[2] ? resolve(process.argv[2]) : join(ROOT, 'build', 'icon-source.png');

// ---------------------------------------------------------------- framing
// The source artwork is a wide camp scene; the icon wants the tent, campfire and
// frog filling the frame rather than a lot of empty sky. Square crop, in source
// pixels, centered on the tent. Tuned by eye at 64px — the size that actually has
// to read in the Dock.
const CROP = { side: 1450, cx: 1024, cy: 1170 };

// ------------------------------------------------------------- icon shape
const CANVAS = 1024;
const ARTWORK = 824; // Apple's macOS icon grid
const INSET = (CANVAS - ARTWORK) / 2;

/**
 * Apple's icon outline is a "squircle" — a rounded rectangle with continuous
 * curvature, not a circular-arc corner. A superellipse with exponent ~5 tracks it
 * closely and is what icon tooling generally uses. Sampled into a polygon, which
 * is exact enough at 1024px and avoids hand-fitting bezier control points.
 */
function squirclePath(size, n = 5, steps = 720) {
	const r = size / 2;
	const pts = [];
	for (let i = 0; i < steps; i++) {
		const theta = (i / steps) * 2 * Math.PI;
		const c = Math.cos(theta);
		const s = Math.sin(theta);
		// superellipse in polar-ish form: |x/r|^n + |y/r|^n = 1
		const x = Math.sign(c) * r * Math.abs(c) ** (2 / n);
		const y = Math.sign(s) * r * Math.abs(s) ** (2 / n);
		pts.push(`${(x + r).toFixed(3)},${(y + r).toFixed(3)}`);
	}
	return `M${pts.join('L')}Z`;
}

const squircleMask = (size) =>
	Buffer.from(
		`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
			`<path d="${squirclePath(size)}" fill="#fff"/></svg>`,
	);

/** The cropped source artwork at `size`, square, no mask. */
const cropped = (size) =>
	sharp(SRC)
		.extract({
			left: Math.round(CROP.cx - CROP.side / 2),
			top: Math.round(CROP.cy - CROP.side / 2),
			width: CROP.side,
			height: CROP.side,
		})
		.resize(size, size, { fit: 'cover' });

/** Full-bleed square PNG — Windows and Linux draw icons unmasked and uninset. */
const squarePng = (size) => cropped(size).png().toBuffer();

/** macOS PNG: squircle-masked artwork inset on a transparent canvas. */
async function macPng(size) {
	const art = Math.round((ARTWORK / CANVAS) * size);
	const pad = Math.round((size - art) / 2);
	const masked = await cropped(art)
		.composite([{ input: squircleMask(art), blend: 'dest-in' }])
		.png()
		.toBuffer();
	return sharp({
		create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
	})
		.composite([{ input: masked, top: pad, left: pad }])
		.png()
		.toBuffer();
}

// ------------------------------------------------------------------ .icns
// Apple's container format: 'icns' + total byte length, then type/length/data
// records. PNG payloads are valid for every type used here. The type codes are
// the same set electron-builder emits, so nothing downstream sees a change in
// what's available.
const ICNS_TYPES = [
	['ic07', 128], // 128×128
	['ic08', 256], // 256×256
	['ic09', 512], // 512×512
	['ic10', 1024], // 512×512@2x
	['ic11', 32], // 16×16@2x
	['ic12', 64], // 32×32@2x
	['ic13', 256], // 128×128@2x
	['ic14', 512], // 256×256@2x
];

async function buildIcns() {
	const entries = [];
	for (const [type, size] of ICNS_TYPES) {
		entries.push({ type, data: await macPng(size) });
	}
	// Optional table of contents: type + total record length for each entry.
	const tocLen = 8 + entries.length * 8;
	const toc = Buffer.alloc(tocLen);
	toc.write('TOC ', 0, 'ascii');
	toc.writeUInt32BE(tocLen, 4);
	entries.forEach((e, i) => {
		toc.write(e.type, 8 + i * 8, 'ascii');
		toc.writeUInt32BE(e.data.length + 8, 12 + i * 8);
	});

	const records = entries.map((e) => {
		const head = Buffer.alloc(8);
		head.write(e.type, 0, 'ascii');
		head.writeUInt32BE(e.data.length + 8, 4);
		return Buffer.concat([head, e.data]);
	});

	const body = Buffer.concat([toc, ...records]);
	const header = Buffer.alloc(8);
	header.write('icns', 0, 'ascii');
	header.writeUInt32BE(body.length + 8, 4);
	return Buffer.concat([header, body]);
}

// ------------------------------------------------------------------- .ico
// Windows container: 6-byte header, then a 16-byte directory entry per image,
// then the payloads. PNG payloads are supported from Vista on; every size here
// is stored as PNG, which keeps the file small.
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

async function buildIco() {
	const images = [];
	for (const size of ICO_SIZES) images.push({ size, data: await squarePng(size) });

	const header = Buffer.alloc(6);
	header.writeUInt16LE(0, 0); // reserved
	header.writeUInt16LE(1, 2); // 1 = icon
	header.writeUInt16LE(images.length, 4);

	let offset = 6 + images.length * 16;
	const dir = [];
	for (const img of images) {
		const e = Buffer.alloc(16);
		e.writeUInt8(img.size >= 256 ? 0 : img.size, 0); // 0 means 256
		e.writeUInt8(img.size >= 256 ? 0 : img.size, 1);
		e.writeUInt8(0, 2); // palette
		e.writeUInt8(0, 3); // reserved
		e.writeUInt16LE(1, 4); // color planes
		e.writeUInt16LE(32, 6); // bits per pixel
		e.writeUInt32LE(img.data.length, 8);
		e.writeUInt32LE(offset, 12);
		offset += img.data.length;
		dir.push(e);
	}
	return Buffer.concat([header, ...dir, ...images.map((i) => i.data)]);
}

// ------------------------------------------------------------------- main
mkdirSync(BUILD, { recursive: true });

// icon.png is the canonical macOS-spec artwork: electron-builder falls back to it
// when regenerating platform icons, so keeping the inset here means the Dock size
// can't silently regress.
writeFileSync(join(BUILD, 'icon.png'), await macPng(CANVAS));
writeFileSync(join(BUILD, 'icon.icns'), await buildIcns());
writeFileSync(join(BUILD, 'icon.ico'), await buildIco());

console.log(`icons written from ${SRC}`);
console.log(`  build/icon.png   ${CANVAS}×${CANVAS}  macOS grid — ${ARTWORK}px artwork, ${INSET}px clear each side`);
console.log(`  build/icon.icns  ${ICNS_TYPES.map(([, s]) => s).join(', ')}`);
console.log(`  build/icon.ico   ${ICO_SIZES.join(', ')} (full-bleed square)`);
