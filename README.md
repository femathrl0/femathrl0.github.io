# femathrl0.github.io

Felipe Matheus's portfolio. Astro 6 (static) + Tailwind CSS 4. Design notes: `docs/design-plan-minimal-portrait.md`.

## Edit content without touching components

| What | Where |
|---|---|
| Name, headline, bio, contact, CV link | `src/data/site.json` |
| Experience | `src/data/experience.json` |
| Decision log (/about) | `src/data/decisions.json` |
| Research & teaching | `src/data/research.json` |
| Skills | `src/data/skills.json` |
| Case studies | `src/content/projects/*.mdx` |
| Diagrams | `src/components/diagrams/*.astro` (inline SVG, themed by tokens) |
| Colours, type, spacing | tokens at the top of `src/styles/global.css` |

## CV (PDF)

The CV is generated, never edited by hand. `src/pages/cv.astro` lays out the same JSON/MDX data as the site, and `scripts/build-cv.mjs` prints it to `dist/felipe-matheus-cv.pdf` at the end of every `npm run build`. Update the data, rebuild, and the "Download CV" button serves the new PDF.

- `npm run cv:dev` also copies the PDF to `public/` so the button works under `npm run dev`.

## ASCII portrait

The portrait is a plain-text drawing: **`src/data/portrait/drawing.txt`**. To change it:

1. Edit `drawing.txt` in any editor (monospace, spaces only, no tabs).
2. Run `npm run portrait:split`. It writes the two layers the site draws:
   - `figure.txt`: everything except border glyphs; each glyph's opacity follows its ink (`@` solid, `.` faint).
   - `outline.txt`: the border glyphs `_ / \ | -`, drawn bold.
3. With `npm run dev` running, the page updates.

The grid size comes from the drawing, so it can be any width or height.

**From the photo (current portrait):** `npm run portrait -- --force` builds `drawing.txt`, `figure.txt` and `outline.txt` from `portrait/source.jpg` (git-ignored); without `--force` it won't overwrite an existing drawing. Settings are at the top of `scripts/portrait.mjs` (`OUTLINE_GAP`, `HALO_GAP` and `HALO_EVERY` shape the outline). Use `portrait:split` only for hand-made drawings: the generated face uses `-` and `/` as shading, which the split would read as outline.

Glyph intensity comes from measured ink coverage in JetBrains Mono (`node scripts/glyph-ramp.mjs` → `src/data/glyph-ramp.json`, `src/data/glyph-coverage.json`).

The renderer lives in `src/components/Portrait.astro` (canvas, scatter animation, project cards) and `src/lib/portrait.ts` (parsing, layout).

## Run

```sh
npm install
npm run dev      # http://localhost:4321
npm run build    # static site in dist/
```

Requires Node ≥ 22.12.

## Deploy

1. Create a public GitHub repo named `femathrl0.github.io` and push this folder to `main`.
2. Repo Settings → Pages → Source: **GitHub Actions**.
3. Every push to `main` builds and deploys via `.github/workflows/deploy.yml`.
