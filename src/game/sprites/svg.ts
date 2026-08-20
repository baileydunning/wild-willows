// The same drawing API, rendered to SVG instead of to a Phaser texture.
//
// The field journal's thumbnails are DOM images, not game objects, so they can't
// use a Phaser Graphics. Giving the SVG writer the same method names means one
// sprite definition draws both, and the journal can never drift from the world.

import { hexOf } from './canvas';

export class SvgGraphics {
	parts: string[] = [];
	private fill = '#000000';
	private fillA = 1;
	private stroke = '#000000';
	private strokeA = 1;
	private sw = 1;
	constructor(
		private tint: string | null,
		private override: string | null = null,
	) {}
	private col(c: number) {
		if (this.override) return this.override;
		if (this.tint && c === 0xffffff) return this.tint;
		return hexOf(c);
	}
	fillStyle(c: number, a = 1) {
		this.fill = this.col(c);
		this.fillA = a;
		return this;
	}
	lineStyle(w: number, c: number, a = 1) {
		this.sw = w;
		this.stroke = this.col(c);
		this.strokeA = a;
		return this;
	}
	fillEllipse(x: number, y: number, w: number, h: number) {
		this.parts.push(
			`<ellipse cx="${x}" cy="${y}" rx="${w / 2}" ry="${h / 2}" fill="${this.fill}" fill-opacity="${this.fillA}"/>`,
		);
		return this;
	}
	fillCircle(x: number, y: number, r: number) {
		this.parts.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${this.fill}" fill-opacity="${this.fillA}"/>`);
		return this;
	}
	fillRect(x: number, y: number, w: number, h: number) {
		this.parts.push(
			`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${this.fill}" fill-opacity="${this.fillA}"/>`,
		);
		return this;
	}
	fillRoundedRect(x: number, y: number, w: number, h: number, r: number) {
		this.parts.push(
			`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${this.fill}" fill-opacity="${this.fillA}"/>`,
		);
		return this;
	}
	fillTriangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) {
		this.parts.push(
			`<polygon points="${x1},${y1} ${x2},${y2} ${x3},${y3}" fill="${this.fill}" fill-opacity="${this.fillA}"/>`,
		);
		return this;
	}
	lineBetween(x1: number, y1: number, x2: number, y2: number) {
		this.parts.push(
			`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${this.stroke}" stroke-opacity="${this.strokeA}" stroke-width="${this.sw}" stroke-linecap="round"/>`,
		);
		return this;
	}
	strokeEllipse(x: number, y: number, w: number, h: number) {
		this.parts.push(
			`<ellipse cx="${x}" cy="${y}" rx="${w / 2}" ry="${h / 2}" fill="none" stroke="${this.stroke}" stroke-opacity="${this.strokeA}" stroke-width="${this.sw}"/>`,
		);
		return this;
	}
	strokeCircle(x: number, y: number, r: number) {
		this.parts.push(
			`<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${this.stroke}" stroke-opacity="${this.strokeA}" stroke-width="${this.sw}"/>`,
		);
		return this;
	}
	strokeRoundedRect(x: number, y: number, w: number, h: number, r: number) {
		this.parts.push(
			`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="none" stroke="${this.stroke}" stroke-opacity="${this.strokeA}" stroke-width="${this.sw}"/>`,
		);
		return this;
	}
	toSvg(w: number, h: number) {
		return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${this.parts.join('')}</svg>`;
	}
}

/**
 * Render an animal's sprite as an SVG data URI for use in the DOM (field
 * journal). `silhouette` draws it as a single dark shape for animals that have
 * not returned yet. Featured animals use their hand-drawn sprite; everyone else
 * gets the same trait-built sprite the world uses.
 */
