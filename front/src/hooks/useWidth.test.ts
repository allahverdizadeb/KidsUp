import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useWidth } from './useWidth';

function resizeTo(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  window.dispatchEvent(new Event('resize'));
}

describe('useWidth', () => {
  it('returns the current window width and follows resizes', () => {
    resizeTo(1200);
    const { result } = renderHook(() => useWidth());
    expect(result.current).toBe(1200);
    act(() => resizeTo(500));
    expect(result.current).toBe(500);
  });

  it('ignores a zero width (hidden iframes report it)', () => {
    resizeTo(900);
    const { result } = renderHook(() => useWidth());
    act(() => resizeTo(0));
    expect(result.current).toBe(900);
  });
});
