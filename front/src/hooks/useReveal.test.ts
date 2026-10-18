import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useReveal } from './useReveal';

let observed: Element[] = [];
let notify: (entries: Partial<IntersectionObserverEntry>[]) => void = () => {};

class FakeIntersectionObserver {
  constructor(callback: (entries: Partial<IntersectionObserverEntry>[]) => void) {
    notify = callback;
  }
  observe = (el: Element) => observed.push(el);
  unobserve = vi.fn();
  disconnect = vi.fn();
}

function revealElement(top: number) {
  const el = document.createElement('div');
  el.setAttribute('data-reveal', '1');
  el.getBoundingClientRect = () => ({ top }) as DOMRect;
  document.body.appendChild(el);
  return el;
}

describe('useReveal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    observed = [];
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('keeps elements that are already on screen visible', () => {
    const el = revealElement(100);
    renderHook(() => useReveal());
    vi.advanceTimersByTime(100);
    expect(el.style.opacity).toBe('');
    expect(observed).not.toContain(el);
  });

  it('hides elements below the fold and reveals them when they intersect', () => {
    const el = revealElement(5000);
    renderHook(() => useReveal());
    vi.advanceTimersByTime(100);
    expect(el.style.opacity).toBe('0');
    expect(observed).toContain(el);

    notify([{ isIntersecting: false, target: el }]);
    expect(el.style.opacity).toBe('0');
    notify([{ isIntersecting: true, target: el }]);
    expect(el.style.opacity).toBe('1');
    expect(el.style.transform).toBe('none');
  });

  it('reveals hidden elements on scroll once they are within the viewport', () => {
    let top = 5000;
    const el = revealElement(top);
    el.getBoundingClientRect = () => ({ top }) as DOMRect;
    renderHook(() => useReveal());
    vi.advanceTimersByTime(100);

    window.dispatchEvent(new Event('scroll'));
    expect(el.style.opacity).toBe('0');
    top = 200;
    window.dispatchEvent(new Event('scroll'));
    expect(el.style.opacity).toBe('1');
  });

  it('shows everything after 2.5s even if nothing intersected', () => {
    const el = revealElement(5000);
    renderHook(() => useReveal());
    vi.advanceTimersByTime(100);
    expect(el.style.opacity).toBe('0');
    vi.advanceTimersByTime(2500);
    expect(el.style.opacity).toBe('1');
  });

  it('never leaves elements hidden after unmount', () => {
    const el = revealElement(5000);
    const { unmount } = renderHook(() => useReveal());
    vi.advanceTimersByTime(100);
    unmount();
    expect(el.style.opacity).toBe('1');
  });

  it('does nothing when the user prefers reduced motion', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    const el = revealElement(5000);
    renderHook(() => useReveal());
    vi.advanceTimersByTime(3000);
    expect(el.style.opacity).toBe('');
  });

  it('does nothing without IntersectionObserver support', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
    vi.stubGlobal('IntersectionObserver', undefined);
    delete (window as { IntersectionObserver?: unknown }).IntersectionObserver;
    const el = revealElement(5000);
    renderHook(() => useReveal());
    vi.advanceTimersByTime(3000);
    expect(el.style.opacity).toBe('');
  });
});
