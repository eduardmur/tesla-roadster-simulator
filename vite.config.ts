/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { renderHowItWorks } from './scripts/howItWorks';

// GitHub Pages serves the site from /<repo>/; override with BASE_PATH for other hosts.
const base = process.env.BASE_PATH ?? '/flying-tesla/';
// Absolute site URL for canonical links, Open Graph and JSON-LD.
const site = process.env.SITE_URL ?? 'https://eduardmur.github.io/flying-tesla/';

/** Fills the static /how-it-works page with numbers, tables and diagrams from the physics module. */
function howItWorks(): Plugin {
  return {
    name: 'flying-tesla:how-it-works',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        if (ctx.filename.includes('how-it-works')) return renderHowItWorks(html, site);
        return html.split('{{site}}').join(site);
      },
    },
  };
}

export default defineConfig({
  base,
  plugins: [react(), howItWorks()],
  build: {
    target: 'es2022',
    // The Rapier physics chunk embeds its WASM and is lazy-loaded; it is expected to be large.
    chunkSizeWarningLimit: 4500,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        howItWorks: resolve(import.meta.dirname, 'how-it-works/index.html'),
      },
    },
  },
  test: {
    include: ['tests/physics/**/*.test.ts', 'tests/sim/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30000,
  },
});
