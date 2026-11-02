# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Astro (static output) + Tailwind CSS 4, per Felipe's brief. Content in collections (`src/content/projects/*.md`, `src/data/*.json`) so it can be edited without touching components. Hosting: GitHub Pages at `femathrl0.github.io` via GitHub Actions (free tier only).

## Users

Recruiters, hiring managers and engineers evaluating Felipe Matheus for Software Engineer roles; secondarily, master's-program admissions readers. They skim the first screen, then open one case study to judge depth.

## Product Purpose

Developer portfolio for job hunting. Success: a reader leaves knowing Felipe architects and ships real software, with AI in the architecture and in the workflow, and with users at the center.

## Positioning

Software Engineer who builds, architects and ships with AI. Lead with what was built and shipped (Macronutri live in production). Differentiator: a UX research background shown as part of how he engineers. Research-oriented as a secondary signal, never a pure academic page.

## Operating Context

English only. Read on desktop during screening and on phones from LinkedIn links.

## Capabilities and Constraints

Sections: Hero, About, Featured Projects (each with a case-study page: Problem → Approach & Architecture → My Role → Outcome → Stack → Links; order Macronutri, Dossiê; the Music Recommender was removed at Felipe's request), Experience, Research & Teaching, Skills, Contact (email, LinkedIn, GitHub only). Dark theme only (light theme removed at Felipe's request). Lighthouse 90+. SEO: title, description, OG image, sitemap.

## Brand Commitments

- Display name "Felipe Matheus". Headline: "I build, architect and ship software, with AI in the loop and users at the center."
- Voice: direct, concise, short sentences, no buzzword stacking.
- Photo: provided (`portrait/source.jpg`, kept out of git). Shown only as an ASCII portrait with an outline.
- Visual reference chosen by Felipe: brianan.ca's minimal layout and scatter interaction, rebuilt with original code. Dark theme only; Felipe removed the light theme.
- Home is one screen plus a quick view with a Download CV button; the CV PDF is generated from site data on every build.

## Evidence on Hand

Only the facts in Felipe's portfolio brief. No Macronutri usage numbers, revenue, customers or testimonials. Never name Anna's LLM provider. Never call Macronutri a "rebuild" or claim "100% secure". CNI: no internal names beyond "PEG". Dossiê: only brief content (no stack details from the repo). No phone number. Unresolved TODOs are omitted, never placeholdered.

## Product Principles

1. Shipped work first, AI as the how, never the headline buzzword.
2. Make "who decided what" explicit: Felipe decides, agents implement.
3. Every number is real and sourced from the brief.
4. The site itself demonstrates good UX and accessibility.

## Accessibility & Inclusion

WCAG 2.2 AA: semantic HTML, contrast, keyboard navigation, visible focus, `prefers-reduced-motion`.
