// Splits a single hand-made ASCII drawing into the two layers the site draws.
//
//   node scripts/portrait-split.mjs            (reads src/data/portrait/drawing.txt)
//
// Border glyphs ( _ / \ | - ) go to outline.txt and are drawn bold; everything else
// goes to figure.txt, where each glyph's opacity follows its ink.

import fs from 'node:fs';

const DIR = 'src/data/portrait';
const SRC = process.argv[2] ?? `${DIR}/drawing.txt`;
const OUTLINE = new Set(['_', '/', '\\', '|', '-']);

const rows = fs.readFileSync(SRC, 'utf8').replace(/\r/g, '').replace(/\t/g, '    ').replace(/\n+$/, '').split('\n');
const figure = [], outline = [];
let nOut = 0, nFig = 0;
for (const row of rows) {
  let f = '', o = '';
  for (const ch of row) {
    if (OUTLINE.has(ch)) { o += ch; f += ' '; nOut++; }
    else { f += ch; o += ' '; if (ch !== ' ') nFig++; }
  }
  figure.push(f.trimEnd());
  outline.push(o.trimEnd());
}
fs.writeFileSync(`${DIR}/figure.txt`, figure.join('\n') + '\n');
fs.writeFileSync(`${DIR}/outline.txt`, outline.join('\n') + '\n');
const cols = Math.max(...rows.map((r) => r.length));
console.log(`split ${SRC}: ${cols}x${rows.length}, ${nFig} figure glyphs, ${nOut} outline glyphs`);
