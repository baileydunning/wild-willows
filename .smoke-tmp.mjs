import { readFileSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';

const html = readFileSync(process.argv[2], 'utf8');
const DAY = '2026-08-10';
const LANDING = {
  today: DAY,
  totals: { visits: 1200, uniques: 800, totalClicks: 300, signups: 42,
            totalDownloads: 90, downloads: { guide: 60, worksheets: 30 },
            clicks: { appstore: 100, itch: 50, demo: 40, theme: 20, gallery: 10,
                      privacy: 5, support: 5, 'get-nav': 30, 'edu-nav': 20,
                      'pdf-guide': 10, 'pdf-worksheets': 5, 'school-copy': 3, other: 2 } },
  days: Array.from({ length: 20 }, (_, i) => ({
    day: `2026-07-${String(i + 22).padStart(2, '0')}`, visits: 10 + i,
    totalClicks: i, signups: i % 3, downloads: { guide: i, worksheets: i % 2 } })),
};
LANDING.days.push({ day: DAY, visits: 77, totalClicks: 12, signups: 4, downloads: { guide: 3, worksheets: 1 } });

const METRICS = { summary: { audience: {}, engagement: {}, retention: {}, progression: {} },
                  players: [], filters: {} };
const json = (b) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(b) });

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => errors.push('jsdomError: ' + (e.detail?.stack || e.message)));
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://x.test/Metrics/', virtualConsole: vc,
  beforeParse(w) {
    w.fetch = (u) => String(u).includes('LandingStats') ? json(LANDING)
      : String(u).includes('SaveHealth') || String(u).includes('GameplayHealth') ? json({})
      : json(METRICS);
    w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
    w.addEventListener('error', (e) => errors.push('window.error: ' + (e.error?.stack || e.message)));
    w.addEventListener('unhandledrejection', (e) => errors.push('unhandledrejection: ' + (e.reason?.stack || e.reason)));
  } });

await new Promise((r) => setTimeout(r, 1500));
const text = dom.window.document.getElementById('root')?.textContent || '';
console.log('--- errors ---'); console.log(errors.length ? errors.join('\n') : '(none)');
console.log('--- landing section rendered:', /Landing page/.test(text), '| visits today shown:', /77/.test(text));
console.log('--- root text:', JSON.stringify(text.slice(0,200)));
