import { afterEach, describe, expect, it, vi } from 'vitest';
import { hoverValues, prefersReducedMotion } from './hover';

function mockReducedMotion(reduce: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: reduce }) as unknown as typeof window.matchMedia;
}

describe('hoverValues', () => {
  afterEach(() => mockReducedMotion(false));

  it('returns resting values when nothing is hovered', () => {
    const values = hoverValues(null);
    expect(values.h1box).toBe('#FFFFFF');
    expect(values.h1t).toBe('none');
  });

  it('switches only the hovered illustration to its hot values', () => {
    const values = hoverValues('h1');
    expect(values.h1box).toBe('#FF0083');
    expect(values.h1t).toBe('rotate(-8deg)');
    expect(values.h0sheet).toBe('#FFFFFF');
    expect(values.h0t).toBe('none');
  });

  it('keeps colour changes but drops movement when reduced motion is requested', () => {
    mockReducedMotion(true);
    const values = hoverValues('h1');
    expect(values.h1box).toBe('#FF0083');
    expect(values.h1t).toBe('none');
  });
});

describe('prefersReducedMotion', () => {
  afterEach(() => mockReducedMotion(false));

  it('reflects the media query', () => {
    mockReducedMotion(true);
    expect(prefersReducedMotion()).toBe(true);
    mockReducedMotion(false);
    expect(prefersReducedMotion()).toBe(false);
  });
});
