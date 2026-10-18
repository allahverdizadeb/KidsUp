import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  // Never inline assets as data: URIs; the production CSP forbids them (font-src / img-src are 'self' only).
  build: { assetsInlineLimit: 0 },
  server: {
    // In dev the API runs on :8000; the browser talks to it through this proxy (no CORS needed).
    proxy: { '/api': 'http://localhost:8000' },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
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
