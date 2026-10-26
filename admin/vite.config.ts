import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  // Never inline assets as data: URIs; the production CSP forbids them (font-src / img-src are 'self' only).
  build: { assetsInlineLimit: 0 },
  server: {
    // In dev the admin API runs on :8001 (back/CLAUDE.md); the browser talks to it through this proxy.
    proxy: { '/api/admin': 'http://localhost:8001' },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // Whole screens are rendered and clicked through (and measured with coverage on a busy machine): a test that is
    // only slow must not fail; one that hangs still does, after 20 seconds.
    testTimeout: 20_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/test/**', 'src/**/*.test.{ts,tsx}'],
      reporter: ['text', 'html'],
      // Project-level gate: `npm run test:coverage` fails below 80% on every metric.
      thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
    },
  },
});
