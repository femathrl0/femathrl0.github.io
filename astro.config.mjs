// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://femathrl0.github.io',
  integrations: [mdx(), sitemap({ filter: (page) => !page.endsWith('/cv/') })],
  vite: { plugins: [tailwindcss()] },
});
