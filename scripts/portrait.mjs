// Generates a starting ASCII portrait from a photo with a plain light background.
//
//   node scripts/portrait.mjs [photo] [--force] [--preview]
//
// Writes src/data/portrait/drawing.txt, the single ASCII drawing the site is built from
// (then run `npm run portrait:split`). Refuses to overwrite an existing drawing unless you
// pass --force, so a hand-made drawing is never lost by accident.
//
// The source photo stays local (portrait/ is git-ignored); only the text is published.

import sharp from 'sharp';
import fs from 'node:fs';

const SRC = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 'portrait/source.jpg';
const PREVIEW = process.argv.includes('--preview');
const FORCE = process.argv.includes('--force');
const OUT_DIR = 'src/data/portrait';

// ---- Framing ---------------------------------------------------------------
const CROP = { left: 0.13, top: 0.19, width: 0.74, height: 0.78 }; // head, collar and shoulders
const COLS = 150; // characters across
const GLYPH_ASPECT = 0.6; // JetBrains Mono advance / line height
const WORK_W = 900; // working resolution for mask, lighting and edges

// Bottom fade: alpha falls off smoothly instead of dropping cells.
// Set FADE_FROM below 1 (e.g. 0.7) to dissolve the bottom of the bust; above 1 keeps it solid.
const FADE_FROM = 2;
const FADE_TO = 3;

// Outline rings, in cell widths from the smoothed silhouette.
// Outline: lines drawn at a fixed distance from the silhouette, in cell widths.
const OUTLINE_GAP = 1.6; // main line: distance from the figure
const HALO_GAP = 7.5; // dotted halo further out (set to 0 to remove)
const HALO_EVERY = 3; // keep one halo dot every N columns

// Tone → glyph (dark paper: bright skin is dense).
const CONTRAST = 0.55; // 0 = linear, 1 = full S-curve
const GAMMA = 0.85; // < 1 lifts mid-tones
const EDGE_BOOST = 0.3; // how much edges (glasses, eyes, mouth) add to density
const MIN_DENSITY = 0.2; // floor so dark areas (hair, the black shirt) keep texture instead of vanishing

// ---- Helpers ---------------------------------------------------------------
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const hash = (c, r) => {
  const v = Math.sin(c * 12.9898 + r * 78.233) * 43758.5453;
  return v - Math.floor(v);
};
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Separable box blur (3 passes ≈ gaussian). */
function blur(src, w, h, radius, passes = 3) {
  let a = Float32Array.from(src);
  let b = new Float32Array(a.length);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) {
      let acc = 0;
      const row = y * w;
      for (let x = -radius; x <= radius; x++) acc += a[row + clamp(x, 0, w - 1)];
      for (let x = 0; x < w; x++) {
        b[row + x] = acc / (2 * radius + 1);
        acc += a[row + Math.min(w - 1, x + radius + 1)] - a[row + Math.max(0, x - radius)];
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -radius; y <= radius; y++) acc += b[clamp(y, 0, h - 1) * w + x];
      for (let y = 0; y < h; y++) {
        a[y * w + x] = acc / (2 * radius + 1);
        acc += b[Math.min(h - 1, y + radius + 1) * w + x] - b[Math.max(0, y - radius) * w + x];
      }
    }
  }
  return a;
}

// ---- Load ------------------------------------------------------------------
const meta = await sharp(SRC).metadata();
const crop = {
  left: Math.round(meta.width * CROP.left),
  top: Math.round(meta.height * CROP.top),
  width: Math.round(meta.width * CROP.width),
  height: Math.round(meta.height * CROP.height),
};
const W = WORK_W;
const H = Math.round((W * crop.height) / crop.width);
const ROWS = Math.round(((COLS * crop.height) / crop.width) * GLYPH_ASPECT);

const { data: rgb } = await sharp(SRC).extract(crop).resize(W, H, { fit: 'fill', kernel: 'lanczos3' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const N = W * H;
const lum = new Float32Array(N);
const sat = new Float32Array(N);
for (let i = 0; i < N; i++) {
  const r = rgb[i * 3] / 255, g = rgb[i * 3 + 1] / 255, b = rgb[i * 3 + 2] / 255;
  lum[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  sat[i] = mx === 0 ? 0 : (mx - mn) / mx;
}

// ---- 1. Silhouette: flood fill the bright background, then smooth it -------
const isBg = (i) => lum[i] > 0.72 && sat[i] < 0.15;
const bg = new Uint8Array(N);
const stack = [];
const seed = (x, y) => {
  const i = y * W + x;
  if (!bg[i] && isBg(i)) { bg[i] = 1; stack.push(i); }
};
for (let x = 0; x < W; x++) seed(x, 0);
for (let y = 0; y < H; y++) { seed(0, y); seed(W - 1, y); }
while (stack.length) {
  const i = stack.pop();
  const x = i % W, y = (i / W) | 0;
  if (x > 0) seed(x - 1, y);
  if (x < W - 1) seed(x + 1, y);
  if (y > 0) seed(x, y - 1);
  if (y < H - 1) seed(x, y + 1);
}
const fgRaw = new Float32Array(N);
for (let i = 0; i < N; i++) fgRaw[i] = bg[i] ? 0 : 1;
// Smoothing removes stray hairs and jaggies so the outline reads as one clean line.
const fg = blur(fgRaw, W, H, Math.round(W / 120));

// ---- 2. Lighting: blend global tone with local contrast ---------------------
// The source is lit from one side; local contrast keeps the shadowed half of the face readable.
const lumFg = new Float32Array(N);
for (let i = 0; i < N; i++) lumFg[i] = lum[i] * fgRaw[i];
const R = Math.round(W / 20);
const sumL = blur(lumFg, W, H, R);
const sumF = blur(fgRaw, W, H, R);
const toneHi = new Float32Array(N);
for (let i = 0; i < N; i++) {
  const mean = sumF[i] > 0.02 ? sumL[i] / sumF[i] : lum[i];
  const local = 0.5 + (lum[i] - mean) * 2.4;
  toneHi[i] = clamp(0.28 * lum[i] + 0.72 * local);
}

// ---- 3. Edges (Sobel on lightly blurred luminance) --------------------------
const lumS = blur(lum, W, H, 1, 1);
const edge = new Float32Array(N);
for (let y = 1; y < H - 1; y++) {
  for (let x = 1; x < W - 1; x++) {
    const L = (dx, dy) => lumS[(y + dy) * W + x + dx];
    const gx = -L(-1, -1) - 2 * L(-1, 0) - L(-1, 1) + L(1, -1) + 2 * L(1, 0) + L(1, 1);
    const gy = -L(-1, -1) - 2 * L(0, -1) - L(1, -1) + L(-1, 1) + 2 * L(0, 1) + L(1, 1);
    edge[y * W + x] = Math.hypot(gx, gy) * fgRaw[y * W + x];
  }
}

// ---- 4. Downsample to the character grid -----------------------------------
const G = COLS * ROWS;
const cover = new Float32Array(G), tone = new Float32Array(G), edg = new Float32Array(G);
for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    const x0 = Math.floor((c * W) / COLS), x1 = Math.max(x0 + 1, Math.floor(((c + 1) * W) / COLS));
    const y0 = Math.floor((r * H) / ROWS), y1 = Math.max(y0 + 1, Math.floor(((r + 1) * H) / ROWS));
    let n = 0, f = 0, t = 0, e = 0, wsum = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = y * W + x;
      n++;
      f += fg[i];
      const wt = fgRaw[i];
      wsum += wt; t += toneHi[i] * wt; e += edge[i] * wt;
    }
    const k = r * COLS + c;
    cover[k] = f / n;
    tone[k] = wsum ? t / wsum : 1;
    edg[k] = wsum ? e / wsum : 0;
  }
}

const inside = new Uint8Array(G);
for (let k = 0; k < G; k++) inside[k] = cover[k] > 0.5 ? 1 : 0;
// Bust shape: round off the lower corners where the photo crops the shoulders,
// so the figure ends in a clean curve (the outline follows it) instead of a box.
const BUST = { cy: 0.55, rx: 0.52, ry: 0.7 }; // ellipse centre row and radii, as fractions of the grid
for (let r = 0; r < ROWS; r++) {
  const y = (r / ROWS - BUST.cy) / BUST.ry;
  if (y <= 0) continue;
  for (let c = 0; c < COLS; c++) {
    const x = (c - COLS / 2) / (COLS * BUST.rx);
    if (x * x + y * y > 1) inside[r * COLS + c] = 0;
  }
}

// Remove the side-lighting gradient: fit tone ≈ a + b·col over the face rows
// and subtract the slope, so both halves of the face carry the same weight.
{
  let n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let r = Math.floor(ROWS * 0.15); r < Math.floor(ROWS * 0.62); r++) {
    for (let c = 0; c < COLS; c++) {
      const k = r * COLS + c;
      if (!inside[k]) continue;
      n++; sx += c; sy += tone[k]; sxx += c * c; sxy += c * tone[k];
    }
  }
  const b = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1);
  const cMean = sx / n;
  for (let k = 0; k < G; k++) if (inside[k]) tone[k] -= b * ((k % COLS) - cMean);
  console.log(`lighting slope removed: ${(b * COLS).toFixed(3)} across the width`);
}

// Stretch the subject's tonal range (2nd–98th percentile).
const vals = [];
for (let k = 0; k < G; k++) if (inside[k] && Math.floor(k / COLS) / ROWS < 0.6) vals.push(tone[k]); // tonal range from the face, not the shirt
vals.sort((a, b) => a - b);
const lo = vals[Math.floor(vals.length * 0.03)], hi = vals[Math.floor(vals.length * 0.97)];
const eVals = [];
for (let k = 0; k < G; k++) if (inside[k]) eVals.push(edg[k]);
eVals.sort((a, b) => a - b);
const eHi = eVals[Math.floor(eVals.length * 0.97)] || 1;

// Elliptical fade: the shoulders dissolve earlier at the sides than at the centre,
// so the figure never ends on the crop's straight edges.
const fadeAt = (c, r) => {
  const x = (c - COLS / 2) / (COLS / 2);
  return 1 - smooth(FADE_FROM, FADE_TO, r / ROWS + 0.42 * x * x * smooth(0.45, 0.75, r / ROWS));
};
const cells = [];
for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    const k = r * COLS + c;
    if (!inside[k]) continue;
    const f = fadeAt(c, r);
    if (f < 0.06) continue;
    // Linear tone; each theme applies its own contrast curve (src/lib/portrait.ts).
    const t = clamp((tone[k] - lo) / (hi - lo));
    const e = clamp(edg[k] / eHi);
    cells.push([c, r, Math.round(t * 63), Math.round(e * 9), Math.max(1, Math.round(f * 9))]);
  }
}

// ---- 5. Outline -----------------------------------------------------------
// Exact Euclidean distance (Felzenszwalb) from every pixel to the silhouette, at working
// resolution, then one glyph per cell where an iso-distance line crosses it. The test uses
// the cell's extent along the line's normal, so the outline is exactly one cell thick and
// has no gaps, and each glyph is picked from the line's true slope.
const sil = new Float64Array(N); // 0 on the silhouette, "infinity" elsewhere
const BIG = 1e20;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = y * W + x;
  let on = fg[i] > 0.5;
  if (on) { // same bust ellipse as the figure
    const yy = (y / H - BUST.cy) / BUST.ry;
    const xx = (x / W - 0.5) / BUST.rx;
    if (yy > 0 && xx * xx + yy * yy > 1) on = false;
  }
  sil[i] = on ? 0 : BIG;
}
function edt1d(f, n) {
  const d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  let k = 0; v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) { k--; s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) ** 2 + f[v[k]]; }
  return d;
}
{
  const col = new Float64Array(H);
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) col[y] = sil[y * W + x];
    const d = edt1d(col, H);
    for (let y = 0; y < H; y++) sil[y * W + x] = d[y];
  }
  const row = new Float64Array(W);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) row[x] = sil[y * W + x];
    const d = edt1d(row, W);
    for (let x = 0; x < W; x++) sil[y * W + x] = Math.sqrt(d[x]);
  }
}
const distAt = (x, y) => sil[clamp(Math.round(y), 0, H - 1) * W + clamp(Math.round(x), 0, W - 1)];

const cw = W / COLS, ch = H / ROWS; // cell size in pixels (ch ≈ cw / GLYPH_ASPECT)
// Glyph for a line direction, judged in cell space: a '/' fills its cell corner to corner,
// so its visual angle is atan(ch/cw) ≈ 59°, not 45°.
const slashAngle = (Math.atan2(ch, cw) * 180) / Math.PI;
const lineGlyph = (tx, ty) => {
  let a = (Math.atan2(-ty, tx) * 180) / Math.PI; // screen y points down
  a = ((a % 180) + 180) % 180;
  const marks = [[0, '-'], [slashAngle, '/'], [90, '|'], [180 - slashAngle, '\\'], [180, '-']];
  let best = marks[0];
  for (const m of marks) if (Math.abs(m[0] - a) < Math.abs(best[0] - a)) best = m;
  return best[1];
};

const contour = [];
const rings = [[OUTLINE_GAP, 'line', 0]];
if (HALO_GAP > 0) rings.push([HALO_GAP, 'dots', 1]);
for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    if (inside[r * COLS + c]) continue;
    const x = (c + 0.5) * cw, y = (r + 0.5) * ch;
    const d = distAt(x, y);
    const k = cw * 0.9; // sample the slope over about a cell, so glyphs follow the curve smoothly
    const gx = distAt(x + k, y) - distAt(x - k, y);
    const gy = distAt(x, y + k) - distAt(x, y - k);
    const gl = Math.hypot(gx, gy) || 1;
    const nx = gx / gl, ny = gy / gl; // normal, pointing away from the figure
    const half = (Math.abs(nx) * cw + Math.abs(ny) * ch) / 2; // cell extent along the normal
    for (const [gap, kind, ring] of rings) {
      const R = gap * cw;
      if (d < R - half || d >= R + half) continue;
      if (kind === 'dots') {
        if (c % HALO_EVERY === 0) contour.push([c, r, '.', ring, 9]);
      } else {
        contour.push([c, r, lineGlyph(-ny, nx), ring, 9]); // tangent = normal rotated 90°
      }
    }
  }
}

// ---- 6. Write the text layers ---------------------------------------------
const ramp = JSON.parse(fs.readFileSync('src/data/glyph-ramp.json', 'utf8'));
const glyphFor_ = (d) => {
  let best = ramp[0];
  for (const g of ramp) if (Math.abs(g[1] - d) < Math.abs(best[1] - d)) best = g;
  return best[0];
};
const blank = () => Array.from({ length: ROWS }, () => Array(COLS).fill(' '));
const figure = blank();
for (const [c, r, t63, e9, f9] of cells) {
  const t = t63 / 63;
  const s = (1 - CONTRAST) * t + CONTRAST * (t * t * (3 - 2 * t));
  const f = f9 / 9;
  // In the fade zone, cells drop out (deterministically) instead of turning into faint
  // lines of dots, so the bust dissolves rather than ending in horizontal streaks.
  if (f < 1 && hash(c, r) > f * f) continue;
  const d = clamp(Math.pow(s, GAMMA) * 0.88 + (e9 / 9) * EDGE_BOOST);
  figure[r][c] = glyphFor_(Math.max(d, MIN_DENSITY));
  continue;
  figure[r][c] = glyphFor_(d);
}
const outline = blank();
for (const [c, r, g] of contour) outline[r][c] = g;
const toTxt = (grid) => grid.map((row) => row.join('').trimEnd()).join('\n') + '\n';

fs.mkdirSync(OUT_DIR, { recursive: true });
// One merged drawing; `npm run portrait:split` turns it into the figure and outline layers.
const merged = figure.map((row, r) => row.map((ch, c) => (outline[r][c] !== ' ' ? outline[r][c] : ch)));
const path = `${OUT_DIR}/drawing.txt`;
if (fs.existsSync(path) && !FORCE) {
  console.error(`${path} exists (it may be hand-made). Re-run with --force to overwrite.`);
  process.exit(1);
}
fs.writeFileSync(path, toTxt(merged));
// Write the layers directly too: the generated face uses '-' and '/' as shading, which the
// border-glyph split would misread as outline.
fs.writeFileSync(`${OUT_DIR}/figure.txt`, toTxt(figure));
fs.writeFileSync(`${OUT_DIR}/outline.txt`, toTxt(outline));
console.log(`wrote ${path}, figure.txt and outline.txt`);
console.log(`portrait: ${COLS}x${ROWS} grid, ${cells.length} cells, ${contour.length} outline glyphs`);
if (PREVIEW) console.log(toTxt(merged));
