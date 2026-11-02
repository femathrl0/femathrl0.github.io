import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Case studies. One MDX file per project in src/content/projects/.
const projects = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    short: z.string(), // short name used in lists
    summary: z.string(), // one or two sentences for the home page
    order: z.number(),
    role: z.string().optional(),
    context: z.string(),
    period: z.string().optional(),
    status: z.string(), // e.g. "In production since 2026-11-01"
    highlights: z.array(z.string()).default([]),
    stack: z.array(z.string()).default([]),
    links: z
      .array(z.object({ label: z.string(), href: z.string().url() }))
      .default([]),
  }),
});

export const collections = { projects };
