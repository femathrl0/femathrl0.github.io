// Measures how much ink each printable ASCII glyph puts on its cell in JetBrains Mono,
// then keeps an evenly spaced, perceptually ordered ramp for the portrait.
//
//   node scripts/glyph-ramp.mjs   -> src/data/glyph-ramp.json      [[glyph, coverage 0..1], ...] (the generator's ramp)
//                                -> src/data/glyph-coverage.json  {glyph: coverage} for all printable ASCII

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const FONT = path.resolve('node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2');
// Candidates: printable ASCII minus glyphs that read as letters/words too strongly.
const CANDIDATES = ` .'\`,-:;~"^!|/\\()<>=+*?irvcxzsnuoaeLJTYFCZ17%#&$@0OQGDMWNBH8[]{}`;
const STEPS = 24;
// Every printable ASCII glyph is measured too, so hand-drawn portraits get the right intensity.
const ALL = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join(''); // glyphs kept in the ramp (space included)

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(`<style>@font-face{font-family:J;src:url(data:font/woff2;base64,${fs.readFileSync(FONT).toString('base64')})}</style><canvas></canvas>`);
await page.evaluate(() => document.fonts.load('500 64px J'));
const cov = await page.evaluate((chars) => {
  const W = 60, H = 100; // 0.6 advance, 1.0 line
  const c = document.querySelector('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d', { willReadFrequently: true });
  return [...chars].map((ch) => {
    x.clearRect(0, 0, W, H);
    x.font = '500 100px J';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(ch, W / 2, H / 2);
    const d = x.getImageData(0, 0, W, H).data;
    let s = 0;
    for (let i = 3; i < d.length; i += 4) s += d[i];
    return [ch, s / (255 * W * H)];
  });
}, CANDIDATES + ALL);
await browser.close();

const max = Math.max(...cov.map((c) => c[1]));
const coverage = Object.fromEntries(cov.map(([ch, v]) => [ch, +(v / max).toFixed(4)]));
fs.writeFileSync('src/data/glyph-coverage.json', JSON.stringify(coverage));
const norm = Object.entries(coverage).filter(([ch]) => CANDIDATES.includes(ch)).sort((a, b) => a[1] - b[1]);
// Pick the glyph closest to each evenly spaced target; skip duplicates.
const ramp = [];
for (let i = 0; i < STEPS; i++) {
  const t = i / (STEPS - 1);
  let best = norm[0];
  for (const g of norm) if (Math.abs(g[1] - t) < Math.abs(best[1] - t) && !ramp.some((r) => r[0] === g[0])) best = g;
  if (!ramp.some((r) => r[0] === best[0])) ramp.push([best[0], +best[1].toFixed(4)]);
}
ramp.sort((a, b) => a[1] - b[1]);
fs.writeFileSync('src/data/glyph-ramp.json', JSON.stringify(ramp));
console.log(ramp.map((r) => `${r[0]}:${r[1]}`).join('  '));
