import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    // Unit + eval suites only. Playwright specs in e2e/ run via `npm run test:e2e`.
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'evals/**/*.{test,spec}.ts'],
    testTimeout: 120_000, // AI calls can be slow
  },
});
