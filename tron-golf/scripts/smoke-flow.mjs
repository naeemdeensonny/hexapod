/**
 * End-to-end smoke test of the V1 acceptance journey on a phone-sized
 * viewport. Start `npm run preview` first, then `node scripts/smoke-flow.mjs`.
 * Screenshots land in ./shots.
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const OUT = new URL('../shots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const BASE = process.env.SMOKE_BASE ?? 'http://localhost:4173/#';

const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
);
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  permissions: ['geolocation'],
  // A point near the Kinrara hole 1 tee so distances are realistic.
  geolocation: { latitude: 3.04628, longitude: 101.635 },
});
const page = await ctx.newPage();

const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

const shot = async (name) => {
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${OUT}${name}.png` });
  console.log('shot:', name);
};
const tap = async (text) => {
  await page.getByRole('button', { name: text, exact: false }).first().click();
  await page.waitForTimeout(250);
};

await page.goto(BASE + '/');
await page.waitForTimeout(600);
await shot('01-menu');

await tap('START ROUND');
await shot('02-courses');

await page.locator('.card').first().click();
await page.waitForTimeout(800);
await shot('03-course-detail');

await tap('SELECT COURSE');
await shot('04-round-setup');

await tap('START HOLE 1');
await shot('05-hole-select');

// exercise the hole arrows
await page.locator('.holesel__arrow--r').click();
await page.locator('.holesel__arrow--l').click();
await page.waitForTimeout(200);

await tap('CONFIRM HOLE');
await page.waitForTimeout(2500);
await shot('06-play-map');

// tap the map to move the distance target
const map = page.locator('.sat-map');
const box = await map.boundingBox();
await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.35);
await page.waitForTimeout(600);
const legs = await page.locator('.play__leg span').allTextContents();
console.log('after target move — legs:', legs);
await shot('07-play-map-target');

await tap('SCORE');
await shot('08-score-entry');
await page.locator('.stepper__btn').nth(1).click(); // strokes +1 -> bogey
await page.waitForTimeout(200);
await shot('09-score-bogey');

await tap('SAVE & NEXT');
await page.waitForTimeout(400);
console.log('url after save:', page.url());

// play out holes 2..18
for (let h = 2; h <= 18; h++) {
  await page.goto(`${BASE}/score`);
  await page.waitForTimeout(150);
  if (h % 3 === 0) await page.locator('.stepper__btn').nth(1).click();
  if (h % 5 === 0) await page.locator('.stepper__btn').nth(0).click();
  await tap(h === 18 ? 'SAVE & FINISH' : 'SAVE & NEXT');
}
console.log('url after hole 18:', page.url());
await shot('10-round-complete');

await page.goto(BASE + '/scorecard');
await page.waitForTimeout(400);
await shot('11-scorecard');
await page.locator('.tbl tbody tr').first().click();
await page.waitForTimeout(400);
console.log('tap row -> ', page.url());

await page.goto(BASE + '/complete');
await page.waitForTimeout(300);
await tap('SAVE ROUND');
await page.waitForTimeout(500);
console.log('after save round:', page.url());
await shot('12-saved-scorecard');

await page.goto(BASE + '/history');
await page.waitForTimeout(400);
await shot('13-history');

await page.goto(BASE + '/settings');
await page.waitForTimeout(300);
await shot('14-settings');

await page.goto(BASE + '/courses/add');
await page.waitForTimeout(1500);
await shot('15-add-course');

// resume-round check: start a round, reload, expect the prompt
await page.goto(BASE + '/setup/kinrara');
await page.waitForTimeout(300);
await tap('START HOLE 1');
await page.goto(BASE + '/');
await page.reload();
await page.waitForTimeout(800);
const resumeVisible = await page.locator('.overlay').isVisible().catch(() => false);
console.log('resume prompt visible after reload:', resumeVisible);
await shot('16-resume-prompt');

console.log('CONSOLE ERRORS:', errors.length ? errors.slice(0, 10) : 'none');
await browser.close();
