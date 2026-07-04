#!/usr/bin/env python3
"""Convert game screenshots to Mac App Store dimensions (2880x1800, 16:10).

Apple only accepts 16:10 screenshots (1280x800, 1440x900, 2560x1600,
2880x1800). Our window captures are ~16:9, so cropping to 16:10 would clip the
HUD at the edges; instead this scales each image to fit 2880 wide and pads the
top/bottom with that image's own edge color, which blends into the full-bleed
game field.

Usage:  python3 scripts/mas-screenshots.py <input-dir> [output-dir]
        (default output: <input-dir>/../mas-screenshots)
Needs:  pip install pillow
"""

import sys
from pathlib import Path

from PIL import Image

TARGET_W, TARGET_H = 2880, 1800


def edge_color(im: Image.Image, top: bool) -> tuple:
	"""Median color of the outermost row — what the padding should look like."""
	row = im.crop((0, 0, im.width, 1) if top else (0, im.height - 1, im.width, im.height))
	px = list(row.convert('RGB').getdata())
	px.sort()
	return px[len(px) // 2]


def convert(src: Path, dst: Path) -> None:
	im = Image.open(src).convert('RGB')
	# Scale to full target width; the height that results is < 1800 for 16:9.
	h = round(im.height * TARGET_W / im.width)
	im = im.resize((TARGET_W, min(h, TARGET_H)), Image.LANCZOS)
	if im.height >= TARGET_H:
		# Already 16:10 or taller — center-crop the height instead.
		top = (im.height - TARGET_H) // 2
		im = im.crop((0, top, TARGET_W, top + TARGET_H))
	else:
		pad = TARGET_H - im.height
		canvas = Image.new('RGB', (TARGET_W, TARGET_H), edge_color(im, top=True))
		# Bottom band gets the bottom edge's color (sky vs. ground can differ).
		bottom = Image.new('RGB', (TARGET_W, pad - pad // 2), edge_color(im, top=False))
		canvas.paste(bottom, (0, TARGET_H - bottom.height))
		canvas.paste(im, (0, pad // 2))
		im = canvas
	im.save(dst, 'PNG')
	print(f'{src.name} -> {dst} ({TARGET_W}x{TARGET_H})')


def main() -> None:
	if len(sys.argv) < 2:
		sys.exit(__doc__)
	indir = Path(sys.argv[1])
	outdir = Path(sys.argv[2]) if len(sys.argv) > 2 else indir.parent / 'mas-screenshots'
	outdir.mkdir(parents=True, exist_ok=True)
	files = sorted(p for p in indir.iterdir() if p.suffix.lower() in ('.png', '.jpg', '.jpeg'))
	if not files:
		sys.exit(f'No images found in {indir}')
	for i, f in enumerate(files, 1):
		convert(f, outdir / f'{i:02d}-{f.stem}.png')


if __name__ == '__main__':
	main()
