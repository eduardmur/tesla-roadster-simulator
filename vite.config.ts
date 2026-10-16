/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// GitHub Pages serves the site from /<repo>/; override with BASE_PATH for other hosts.
const base = process.env.BASE_PATH ?? '/flying-tesla/';

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2500,
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
    passWithNoTests: true,
  },
});
