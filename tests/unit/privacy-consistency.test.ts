import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * THE PAGES MUST NOT CONTRADICT EACH OTHER ABOUT WHAT IS TRANSMITTED.
 *
 * The privacy policy said the installed game sends a snapshot every three
 * minutes carrying the caretaker name; the science teacher page said it "sends
 * nothing anywhere"; the support page said the browser demo keeps its save in
 * the browser while the policy said that save is on the server. All three were
 * shipped at once, and the audience for the last two is a school district.
 *
 * For adoption, a contradiction is worse than the collection it was hiding. A
 * teacher or IT administrator can accept "here is precisely what is sent"; they
 * cannot accept two pages on one domain disagreeing about it, because then
 * neither page is evidence of anything.
 *
 * So the rule this file enforces is narrow and mechanical: no page may claim the
 * installed game transmits nothing, and any page that describes what IS
 * collected must name the one field a person wrote themselves. These are checks
 * against the SOURCE OF THE CLAIM, not against the implementation — the code is
 * the arbiter of truth, and tests/unit/lesson-funnel.test.ts and the metrics
 * coverage suite hold the code to its own contract.
 *
 * Ground truth, verified against the client at the time of writing:
 *   • src/solo/metricsUplink.ts — a snapshot every 3 minutes and on hide/close,
 *     carrying the save-slot UUID, the typed caretaker name, platform/os/
 *     version/build/edition/channel/language, every accessibility preference,
 *     and the full gameplay counter set. Playing offline is what sends nothing.
 *   • src/solo/appOpen.ts — a launch ping carrying a persistent per-install UUID.
 *   • src/clientErrors.ts — crash reports carrying a truncated stack trace.
 *   • src/demo.ts DEMO_WEB_BACKEND = 'harper' — the browser demo's save is
 *     server-side; the browser holds only a passwordless pointer to it.
 */

const root = process.cwd();
const PAGES_SRC = readFileSync(join(root, 'server/pages.ts'), 'utf8');

const builtPage = (exportName: string): string => {
	const m = new RegExp(`export const ${exportName}: string = ("(?:[^"\\\\]|\\\\.)*");`).exec(PAGES_SRC);
	if (!m) throw new Error(`${exportName} not found in server/pages.ts — run npm run build:server`);
	return JSON.parse(m[1]);
};

/** Every page a teacher, parent or administrator might read on this question. */
const AUDIENCE_PAGES = [
	['privacyHtml', '/privacy'],
	['supportHtml', '/support'],
	['ageRatingHtml', '/age-rating'],
	['teachersIndexHtml', '/teachers'],
	['teachersScienceHtml', '/teachers/science'],
	['teachersCodingHtml', '/teachers/coding'],
	['landingHtml', '/'],
] as const;

/** Visible copy only: strip scripts, styles, and structured-data blocks. */
const prose = (html: string): string =>
	html
		.replace(/<script\b[^>]*type=["']application\/ld\+json["'][\s\S]*?<\/script>/gi, '')
		.replace(/<script\b[\s\S]*?<\/script>/gi, '')
		.replace(/<style\b[\s\S]*?<\/style>/gi, '')
		.replace(/<!--[\s\S]*?-->/g, '');

describe('no page claims the installed game transmits nothing', () => {
	/* The exact sentence that shipped, plus the near neighbours somebody would
	 * reach for while rewriting this section in a hurry. */
	const DENIALS = [
		/sends nothing anywhere/i,
		/sends nothing at all/i,
		/never sends anything/i,
		/nothing (?:is )?(?:ever )?(?:sent|transmitted|uploaded) (?:anywhere|at all)/i,
		/no data (?:ever )?leaves (?:your|the) (?:device|machine|computer)/i,
	];

	/* A denial is only a lie unqualified. "A device kept off the network sends
	 * nothing at all" is true and worth saying, so the check runs per SENTENCE and
	 * lets one pass if that same sentence carries the condition. Anything broader
	 * — a qualifier two sentences away, or none — fails. */
	const QUALIFIED =
		/offline|off the network|no(?:t| ) connect|without a (?:connection|network)|never (?:reaches|goes) (?:the )?(?:network|online)/i;

	const sentences = (text: string): string[] =>
		text
			.replace(/<[^>]+>/g, ' ')
			.replace(/&mdash;|&ndash;/g, ' ')
			.split(/(?<=[.!?])\s+/);

	for (const [name, path] of AUDIENCE_PAGES) {
		it(`${path} does not deny that the game reports`, () => {
			for (const sentence of sentences(prose(builtPage(name)))) {
				for (const re of DENIALS) {
					const hit = re.exec(sentence);
					if (!hit) continue;
					expect(
						QUALIFIED.test(sentence),
						`${path} says "${sentence.trim()}" — the game sends a snapshot every three minutes ` +
							`(src/solo/metricsUplink.ts). Say what IS sent, or put the offline condition in the same sentence.`,
					).toBe(true);
				}
			}
		});
	}

	it('still lets a page say the game PLAYS offline, because it does', () => {
		// The offline claim is true and worth keeping: game data is bundled, the
		// save is local, and a machine that never reaches the network runs the whole
		// lesson. Only the "transmits nothing" claim is false. If this ever fails,
		// the regexes above have grown too greedy.
		const science = prose(builtPage('teachersScienceHtml'));
		expect(science).toMatch(/runs entirely offline|plays (?:entirely )?offline|needs no connection to run/i);
	});
});

describe('every page that describes collection names the caretaker name', () => {
	/* The name is the only field in an automatic snapshot that a human wrote, so
	 * it is the only one that could ever be a student's real name. A page that
	 * lists what is collected and omits it is the failure this whole file exists
	 * for: technically a list, practically a denial. */
	const MUST_NAME_IT = [
		['privacyHtml', '/privacy'],
		['ageRatingHtml', '/age-rating'],
		['teachersIndexHtml', '/teachers'],
		['teachersScienceHtml', '/teachers/science'],
	] as const;

	for (const [name, path] of MUST_NAME_IT) {
		it(`${path} says the save name is part of what is sent`, () => {
			const text = prose(builtPage(name));
			expect(text).toMatch(/caretaker name|name (?:you|the student) (?:gave|typed)|save's name|name you gave/i);
		});
	}

	it('/teachers/coding may omit it, because that kit genuinely does not send it', () => {
		// The lesson and the builder count named events and nothing else, and
		// student code never leaves the browser. The page is allowed to say so —
		// but it has to scope the claim to the kit rather than the whole product,
		// or a teacher running both kits reads it as covering the game.
		const coding = prose(builtPage('teachersCodingHtml'));
		expect(coding).toMatch(/student code never leaves the browser/i);
		expect(coding, 'the coding kit page must scope its claim away from the game').toMatch(
			/this kit|the game is a separate program/i,
		);
	});
});

describe('the browser demo save is described as server-side', () => {
	it('/support does not say the demo keeps its progress in the browser', () => {
		const text = prose(builtPage('supportHtml'));
		expect(text).not.toMatch(/stores its progress in the browser itself/i);
		// The practical consequence is still true and still worth stating.
		expect(text).toMatch(/clearing site data/i);
	});

	it('/support and /privacy agree that the demo save lives on the server', () => {
		for (const [name, path] of [
			['supportHtml', '/support'],
			['privacyHtml', '/privacy'],
		] as const) {
			const text = prose(builtPage(name));
			expect(text, `${path} should say where a demo save actually lives`).toMatch(
				/save lives on (?:my|our) server|demo save lives on (?:my|our) server/i,
			);
		}
	});
});

describe('the privacy policy discloses the identifiers it actually sends', () => {
	const text = prose(builtPage('privacyHtml'));

	it('does not make a blanket "no device identifiers" claim', () => {
		// A persistent per-install UUID goes out with every launch ping
		// (src/solo/appOpen.ts + src/platform.ts getDeviceId). The honest version of
		// this claim is about hardware and advertising ids, which really are absent.
		expect(text).not.toMatch(/no device identifiers/i);
		expect(text).toMatch(/no advertising identifiers/i);
	});

	it('discloses the launch ping and its identifier', () => {
		expect(text).toMatch(/when the app opens|once per launch/i);
		expect(text).toMatch(
			/random UUID this installation made for itself|random identifier generated on this installation/i,
		);
	});

	it('discloses crash reports, stack trace included', () => {
		expect(text).toMatch(/stack trace/i);
	});

	it('tells you how to send nothing', () => {
		// Stated as the route that works rather than as the control that is missing:
		// playing offline genuinely sends nothing, and the game loses no feature by
		// it. If a Settings toggle ever lands, this should point at that instead.
		expect(text).toMatch(/play with the device offline/i);
	});
});
