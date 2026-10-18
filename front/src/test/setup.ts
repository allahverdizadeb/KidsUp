import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// jsdom lacks these browser APIs; the page uses all of them.
class ObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('IntersectionObserver', ObserverStub);
vi.stubGlobal('ResizeObserver', ObserverStub);
window.scrollTo = vi.fn();
window.matchMedia = vi.fn().mockImplementation((query: string) => ({
  matches: false,
  media: query,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}));

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
});
