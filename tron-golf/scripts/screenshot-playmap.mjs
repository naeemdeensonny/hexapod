import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});

const page = await browser.newPage();
await page.setViewportSize({ width: 390, height: 844 }); // iPhone 14 size

// Inject a realistic active round + hole with real-ish coordinates (Kinrara hole 1)
const appState = {
  courses: [{
    id: 'kinrara',
    name: 'Kinrara Golf Club',
    location: 'Puchong, Selangor',
    holeCount: 18,
    par: 72,
    tees: ['Blue', 'White', 'Red'],
    centre: { lat: 3.0425, lng: 101.635 },
    description: 'Test',
    approximateCoords: false,
    holes: Array.from({ length: 18 }, (_, i) => ({
      number: i + 1,
      par: i % 3 === 0 ? 5 : i % 3 === 1 ? 3 : 4,
      index: i + 1,
      distances: { Blue: 350, White: 320, Red: 290 },
      // Hole 1: tee facing roughly north-east toward green ~350m away
      tee: i === 0 ? { lat: 3.0395, lng: 101.6325 } : { lat: 3.04 + i * 0.002, lng: 101.633 + i * 0.002 },
      greenCentre: i === 0 ? { lat: 3.0425, lng: 101.635 } : { lat: 3.042 + i * 0.002, lng: 101.635 + i * 0.002 },
      coordsSet: true,
      hazards: [],
    })),
  }],
  rounds: [],
  activeRound: {
    id: 'r1',
    courseId: 'kinrara',
    courseName: 'Kinrara Golf Club',
    tee: 'Blue',
    holeCount: 18,
    format: 'Stroke Play',
    handicapOn: false,
    startedAt: new Date().toISOString(),
    currentHole: 1,
    scores: {},
    status: 'active',
  },
  settings: {
    units: 'm',
    defaultTee: 'Blue',
    gpsAccuracy: 'high',
    autoSave: true,
    keepScreenOn: false,
  },
};

// Set localStorage before the app initialises its store
await page.goto('http://localhost:5174/');
await page.evaluate((state) => {
  localStorage.setItem('tron-golf:v1', JSON.stringify(state));
}, appState);

// Reload so the store bootstraps from the injected localStorage
await page.evaluate(() => { window.location.hash = '/play'; window.location.reload(); });
await page.waitForTimeout(4000); // wait for reload + store init

// Dismiss the "round in progress" resume prompt
const notNow = page.getByText('NOT NOW');
if (await notNow.isVisible()) await notNow.click();

// Wait for Google Maps tiles + idle heading event
await page.waitForTimeout(6000);

await page.screenshot({
  path: '/tmp/claude-0/-home-user-hexapod/6ab219a7-1239-5ecd-92a2-6c6597046e04/scratchpad/playmap.png',
  fullPage: false,
});

console.log('screenshot saved');
await browser.close();
