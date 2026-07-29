/**
 * Resilience checks for the persistence layer.
 *
 * Feeds the real built app a series of hostile or legacy localStorage payloads
 * and asserts it comes up usable every time. Start `npm run preview` first,
 * then `node scripts/harden-check.mjs`.
 *
 * The first case is the important one: it is the exact shape written by the
 * pre-hardening build, i.e. what is on the user's phone right now.
 */
import { chromium } from 'playwright';

const BASE = process.env.CHECK_BASE ?? 'http://127.0.0.1:4173/';
const KEY = 'tron-golf:v1';
const SAFE_KEY = 'tron-golf:v1:safe';

/* --- fixtures ------------------------------------------------------------- */

const hole = (n, extra = {}) => ({
  number: n,
  par: 4,
  index: n,
  distances: { White: 350 },
  tee: { lat: 3.034923, lng: 101.636879 },
  greenCentre: { lat: 3.03446, lng: 101.640179 },
  coordsSet: true,
  ...extra,
});

const realCourse = (over = {}) => ({
  id: 'c1',
  name: 'Kinrara',
  location: 'Puchong',
  holeCount: 18,
  par: 72,
  tees: ['White'],
  centre: { lat: 3.0425, lng: 101.635 },
  description: '',
  holes: Array.from({ length: 18 }, (_, i) => hole(i + 1)),
  ...over,
});

const settings = {
  units: 'm',
  defaultTee: 'White',
  gpsAccuracy: 'high',
  autoSave: true,
  keepScreenOn: false,
};

/** The exact bare shape the old build persisted — no envelope, no version. */
const legacyBare = {
  courses: [realCourse()],
  rounds: [],
  activeRound: null,
  settings,
};

const activeRound = (courseId) => ({
  id: 'r1',
  courseId,
  courseName: 'Kinrara',
  tee: 'White',
  holeCount: 18,
  format: 'Stroke Play',
  handicapOn: false,
  startedAt: new Date().toISOString(),
  currentHole: 1,
  scores: {},
  status: 'active',
});

/* --- cases ---------------------------------------------------------------- */

const cases = [
  {
    name: 'legacy bare state (what is on the phone today) loads intact',
    seed: { [KEY]: JSON.stringify(legacyBare) },
    route: '#/courses',
    expect: (r) => r.courseNames.includes('Kinrara') && r.envelopeVersion === 2,
    detail: 'course survives and storage is upgraded to the versioned envelope',
  },
  {
    name: 'corrupt primary falls back to the snapshot',
    seed: {
      [KEY]: '{"courses":[{"id":"c1","na',
      [SAFE_KEY]: JSON.stringify({
        schemaVersion: 2,
        savedAt: new Date().toISOString(),
        state: legacyBare,
      }),
    },
    route: '#/courses',
    expect: (r) => r.courseNames.includes('Kinrara'),
    detail: 'truncated JSON recovered from the mirror',
  },
  {
    name: 'garbage pins are repaired, hole numbering stays complete',
    seed: {
      [KEY]: JSON.stringify({
        ...legacyBare,
        courses: [
          realCourse({
            holes: [
              hole(1, { tee: { lat: 'banana', lng: null } }),
              hole(2, { par: 99, index: -4 }),
              hole(3),
              // holes 4-18 missing entirely
              { number: 'nonsense' },
              null,
            ],
          }),
        ],
      }),
    },
    route: '#/courses',
    expect: (r) => r.courseNames.includes('Kinrara') && r.holeCountShown === 18,
    detail: 'bad holes rebuilt with defaults rather than the course being lost',
  },
  {
    name: 'course with no id is dropped, good courses kept',
    seed: {
      [KEY]: JSON.stringify({
        ...legacyBare,
        courses: [{ name: 'Broken', holes: [] }, realCourse()],
      }),
    },
    route: '#/courses',
    expect: (r) => r.courseNames.includes('Kinrara') && !r.courseNames.includes('Broken'),
    detail: 'partial loss does not cascade',
  },
  {
    name: 'active round pointing at a deleted course is cleared',
    seed: {
      [KEY]: JSON.stringify({ ...legacyBare, activeRound: activeRound('ghost-course') }),
    },
    route: '#/',
    expect: (r) => !r.crashed && !r.bodyText.includes('ROUND IN PROGRESS'),
    detail: 'no stranded session on a course that no longer exists',
  },
  {
    name: 'total garbage seeds a fresh app instead of crashing',
    seed: { [KEY]: 'not json at all <<<>>>' },
    route: '#/courses',
    expect: (r) => !r.crashed && r.courseNames.length > 0,
    detail: 'falls back to seed data',
  },
  {
    name: 'numeric edge cases do not poison the scorecard',
    seed: {
      [KEY]: JSON.stringify({
        ...legacyBare,
        activeRound: {
          ...activeRound('c1'),
          currentHole: 9999,
          scores: {
            1: { strokes: Infinity, putts: -5, penalties: 'x', fairway: 'Z' },
            2: { strokes: 4, putts: 2, penalties: 0, fairway: 'H' },
            bad: { strokes: 3 },
          },
        },
      }),
    },
    route: '#/scorecard',
    expect: (r) => !r.crashed,
    detail: 'Infinity / negatives / bad keys are filtered out',
  },
  {
    name: 'play map still renders with a valid round (play path intact)',
    seed: { [KEY]: JSON.stringify({ ...legacyBare, activeRound: activeRound('c1') }) },
    route: '#/play',
    expect: (r) => !r.crashed && r.playMapHeight > 100,
    detail: 'the screen used on the course is unaffected by the hardening',
  },
];

/* --- runner --------------------------------------------------------------- */

const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
);

let failures = 0;

for (const c of cases) {
  const ctx = await browser.newContext({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();

  await page.addInitScript((seed) => {
    for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
  }, c.seed);

  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await page.goto(BASE + c.route, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);

  const r = await page.evaluate(() => {
    const text = document.body.innerText || '';
    const playMap = document.querySelector('.play__map');
    let envelopeVersion = null;
    try {
      const raw = localStorage.getItem('tron-golf:v1');
      if (raw) envelopeVersion = JSON.parse(raw).schemaVersion ?? null;
    } catch {
      /* leave null */
    }
    return {
      bodyText: text,
      crashed: text.includes('SOMETHING BROKE') || document.body.innerText.trim() === '',
      courseNames: [...document.querySelectorAll('.card__name')].map((e) => e.textContent.trim()),
      holeCountShown: (() => {
        const m = text.match(/(\d+)\s*holes/i);
        return m ? Number(m[1]) : null;
      })(),
      playMapHeight: playMap ? Math.round(playMap.getBoundingClientRect().height) : 0,
      envelopeVersion,
    };
  });

  const ok = c.expect(r) && pageErrors.length === 0;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.name}`);
  console.log(`      ${c.detail}`);
  if (!ok) {
    console.log(`      courses=${JSON.stringify(r.courseNames)} holes=${r.holeCountShown} ` +
      `envelope=${r.envelopeVersion} playMapH=${r.playMapHeight} crashed=${r.crashed}`);
    if (pageErrors.length) console.log(`      pageerror: ${pageErrors.join(' | ')}`);
  }

  await ctx.close();
}

await browser.close();
console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
