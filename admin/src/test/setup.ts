import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { setCsrfToken, setUnauthorizedHandler } from '../api/client.ts';
import { clearEdits } from '../state/cmsEdits.ts';

// A failed query says what it looked for, not the whole page (which is long and holds the test families' details).
// `waitFor` and `findBy…` give a slow machine (coverage on, other work running) more than the default second.
configure({
  getElementError: (message) => new Error(message ?? 'element not found'),
  asyncUtilTimeout: 5000,
});

// jsdom lacks these browser APIs; the panel uses them.
window.scrollTo = vi.fn();
window.matchMedia = vi.fn().mockImplementation((query: string) => ({
  matches: false,
  media: query,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  document.body.style.overflow = '';
  window.location.hash = '';
  // State that lives outside the components must not leak from one test into the next.
  setCsrfToken(null);
  setUnauthorizedHandler(null);
  clearEdits();
});
