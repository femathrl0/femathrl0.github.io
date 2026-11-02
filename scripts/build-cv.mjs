// Renders /cv/ from the built site to a PDF, so the CV always matches the site's data.
//
//   node scripts/build-cv.mjs            -> dist/felipe-matheus-cv.pdf (run after `astro build`)
//   node scripts/build-cv.mjs --public   -> also copies it to public/ for `npm run dev`
//
// Uses Playwright's Chromium. In CI: `npx playwright install --with-deps chromium`.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const DIST = path.resolve('dist');
const OUT = 'felipe-matheus-cv.pdf';
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png' };

if (!fs.existsSync(path.join(DIST, 'cv', 'index.html'))) {
  console.error('dist/cv/index.html not found. Run `astro build` first.');
  process.exit(1);
}

// Minimal static server over dist/ (absolute asset paths need an origin).
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(DIST, p);
  if (!file.startsWith(DIST) || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const { port } = server.address();

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/cv/`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.emulateMedia({ media: 'print' });
  const pdf = await page.pdf({ format: 'A4', preferCSSPageSize: true, printBackground: true });
  fs.writeFileSync(path.join(DIST, OUT), pdf);
  if (process.argv.includes('--public')) fs.writeFileSync(path.join('public', OUT), pdf);
  console.log(`cv: wrote dist/${OUT} (${(pdf.length / 1024).toFixed(0)} KB)`);
} finally {
  await browser.close();
  server.close();
}
