import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { LAYERS } from '../serverSource';

// The website is written in American English. It had drifted: 120-odd British
// spellings across the pages, the stylesheets, the dashboard and the server's
// own comments — "colour", "behaviour", "centred", "grey", "catalogue",
// "recognised", "defences". Most were in comments, which is exactly how the
// visible copy drifts next.
//
// Pinned as explicit pairs rather than as stems, because two of the obvious
// stems are wrong on an ecology site: `organis` also matches "organism" and
// `realis` also matches "realistic", both of which are correct American English.

const root = process.cwd();

const BRITISH: Array<[string, string]> = [
	['colour', 'color'],
	['behaviour', 'behavior'],
	['favourite', 'favorite'],
	['neighbour', 'neighbor'],
	['flavour', 'flavor'],
	['honour', 'honor'],
	['humour', 'humor'],
	['centre', 'center'],
	['centred', 'centered'],
	['theatre', 'theater'],
	['fibre', 'fiber'],
	['grey', 'gray'],
	['labelled', 'labeled'],
	['labelling', 'labeling'],
	['defence', 'defense'],
	['defences', 'defenses'],
	['offence', 'offense'],
	['licence', 'license'],
	['judgement', 'judgment'],
	['acknowledgement', 'acknowledgment'],
	['sceptical', 'skeptical'],
	['catalogue', 'catalog'],
	['organised', 'organized'],
	['organise', 'organize'],
	['recognise', 'recognize'],
	['recognised', 'recognized'],
	['recognisable', 'recognizable'],
	['unrecognised', 'unrecognized'],
	['optimise', 'optimize'],
	['optimisation', 'optimization'],
	['customise', 'customize'],
	['customisation', 'customization'],
	['visualise', 'visualize'],
	['visualisation', 'visualization'],
	['serialise', 'serialize'],
	['summarise', 'summarize'],
	['apologise', 'apologize'],
	['analyse', 'analyze'],
	['practise', 'practice'],
	['travelling', 'traveling'],
	['travelled', 'traveled'],
	['modelling', 'modeling'],
	['programme', 'program'],
	['whilst', 'while'],
	['amongst', 'among'],
	['learnt', 'learned'],
	['skilful', 'skillful'],
	['fulfil', 'fulfill'],
	['aluminium', 'aluminum'],
	['moustache', 'mustache'],
	['jewellery', 'jewelry'],
	['manoeuvre', 'maneuver'],
	['sulphur', 'sulfur'],
	// Inflections the list above misses: \bhonour\b does not match
	// "honouring", and the -isation forms are a separate word from the -ise.
	['honouring', 'honoring'],
	['behaviours', 'behaviors'],
	['initialise', 'initialize'],
	['initialised', 'initialized'],
	['initialisation', 'initialization'],
	['normalise', 'normalize'],
	['normalises', 'normalizes'],
	['normalised', 'normalized'],
	['normalisation', 'normalization'],
	['sanitise', 'sanitize'],
	['sanitised', 'sanitized'],
	['serialised', 'serialized'],
	['prioritise', 'prioritize'],
	['synchronise', 'synchronize'],
	['authorise', 'authorize'],
	['authorisation', 'authorization'],
	['artefact', 'artifact'],
	['artefacts', 'artifacts'],
];

/* `aria-labelledby` is an ARIA attribute name, not prose, and renaming it would
   break the accessible name of the ideas dialog. It is the one exception. */
const EXEMPT = /aria-labelledby/g;

const FILES = [
	...readdirSync(resolve(root, 'public'))
		.filter((f) => f.endsWith('.html'))
		.map((f) => join('public', f)),
	...readdirSync(resolve(root, 'public/partials')).map((f) => join('public/partials', f)),
	...LAYERS.map((m) => `server/${m}.ts`),
	'ARCHITECTURE.md',
];

describe('the website and ARCHITECTURE.md are written in American English', () => {
	it.each(FILES)('%s', (file) => {
		const src = readFileSync(resolve(root, file), 'utf8').replace(EXEMPT, '');
		const found: string[] = [];
		for (const [british, american] of BRITISH) {
			const m = src.match(new RegExp(`\\b${british}\\b`, 'gi'));
			if (m) found.push(`${m[0]} → ${american} (${m.length}×)`);
		}
		expect(found, `${file} uses British spellings`).toEqual([]);
	});

	it('checks enough words to be worth having', () => {
		expect(BRITISH.length).toBeGreaterThan(40);
	});

	it('does not flag words that are the same in both', () => {
		// The two that caught me out. A stem-based check turns "organism" into
		// "organizm" and "realistic" into "realiztic", on a site about ecology.
		for (const [british] of BRITISH) {
			expect('organism').not.toMatch(new RegExp(`\\b${british}\\b`, 'i'));
			expect('realistic').not.toMatch(new RegExp(`\\b${british}\\b`, 'i'));
			expect('optimistic').not.toMatch(new RegExp(`\\b${british}\\b`, 'i'));
			expect('analysis').not.toMatch(new RegExp(`\\b${british}\\b`, 'i'));
		}
	});
});
