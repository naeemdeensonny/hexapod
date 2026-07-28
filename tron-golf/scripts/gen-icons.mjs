/**
 * Generates PWA icons (192×192 and 512×512 PNG) using Playwright/Chromium.
 * Run once: node scripts/gen-icons.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'public');
fs.mkdirSync(outDir, { recursive: true });

const html = (size) => `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8"/>
<style>
  * { margin:0; padding:0; }
  html, body { width:${size}px; height:${size}px; background:#000820; overflow:hidden; }
</style>
</head><body>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#000820"/>
  <circle cx="256" cy="256" r="230" fill="none" stroke="#35e0ff" stroke-width="10"/>
  <circle cx="256" cy="256" r="210" fill="none" stroke="#35e0ff" stroke-width="2" stroke-opacity="0.3"/>
  <line x1="256" y1="100" x2="256" y2="390" stroke="rgba(255,255,255,0.95)" stroke-width="10"/>
  <polygon points="256,100 356,148 256,196" fill="#ffe000"/>
  <circle cx="256" cy="390" r="8" fill="rgba(255,255,255,0.6)"/>
  <text x="256" y="455" font-family="monospace" font-size="48" font-weight="bold"
        fill="#35e0ff" text-anchor="middle" letter-spacing="4">TRON</text>
  <text x="256" y="495" font-family="monospace" font-size="30" font-weight="bold"
        fill="rgba(53,224,255,0.6)" text-anchor="middle" letter-spacing="8">GOLF</text>
</svg>
</body></html>`;

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});

for (const size of [192, 512]) {
  const page = await browser.newPage();
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(html(size));
  const buf = await page.screenshot({ type: 'png' });
  fs.writeFileSync(path.join(outDir, `icon-${size}.png`), buf);
  console.log(`icon-${size}.png written`);
  await page.close();
}

await browser.close();
