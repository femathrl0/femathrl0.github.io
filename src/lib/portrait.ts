// The portrait is two plain-text layers in src/data/portrait/ (figure.txt, outline.txt).
// Shared by the build-time fallback and the client canvas, so both draw the same thing.
import coverageData from '../data/glyph-coverage.json';

const COVERAGE = coverageData as Record<string, number>;
export const GLYPH_ASPECT = 0.6; // JetBrains Mono advance / line height

export interface Glyph { c: number; r: number; ch: string; ink: number; layer: 'figure' | 'outline' }
export interface Portrait { cols: number; rows: number; glyphs: Glyph[] }

const lines = (txt: string) => txt.replace(/\r/g, '').replace(/\t/g, '    ').replace(/\n+$/, '').split('\n');

/** Parse the two layers. Outline glyphs win where both layers have a character. */
export function parsePortrait(figure: string, outline: string): Portrait {
  const f = lines(figure), o = lines(outline);
  const rows = Math.max(f.length, o.length);
  const cols = Math.max(...f.map((l) => l.length), ...o.map((l) => l.length));
  const glyphs: Glyph[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const oc = o[r]?.[c] ?? ' ';
      const fc = f[r]?.[c] ?? ' ';
      if (oc !== ' ') glyphs.push({ c, r, ch: oc, ink: COVERAGE[oc] ?? 0.6, layer: 'outline' });
      else if (fc !== ' ') glyphs.push({ c, r, ch: fc, ink: COVERAGE[fc] ?? 0.6, layer: 'figure' });
    }
  }
  return { cols, rows, glyphs };
}

/** Layout in a 500×500 "stage" space; the canvas adds a 150 margin on every side. */
export function layout(p: Portrait) {
  const cellW = 500 / p.cols;
  const cellH = cellW / GLYPH_ASPECT;
  return { cellW, cellH, offY: (500 - p.rows * cellH) / 2 };
}

/** Both layers merged, for the no-JS text fallback. */
export function toText(p: Portrait): string {
  const grid = Array.from({ length: p.rows }, () => Array<string>(p.cols).fill(' '));
  for (const g of p.glyphs) grid[g.r][g.c] = g.ch;
  return grid.map((row) => row.join('').trimEnd()).join('\n');
}

/** Deterministic per-cell noise in [0, 1). */
export function hash(c: number, r: number, salt = 0): number {
  const v = Math.sin(c * 127.1 + r * 311.7 + salt * 74.7) * 43758.5453;
  return v - Math.floor(v);
}
