import { act, renderHook } from '@testing-library/react';
import type { PointerEvent } from 'react';
import { describe, expect, it } from 'vitest';
import { useHover } from './useHover';

const pointer = (pointerType: string) => ({ pointerType }) as PointerEvent;

describe('useHover', () => {
  it('starts with nothing hovered', () => {
    const { result } = renderHook(() => useHover(['a', 'b']));
    expect(result.current.hov).toBeNull();
    expect(result.current.hv.h1box).toBe('#FFFFFF');
  });

  it('tracks the hovered id for mouse pointers and clears it on leave', () => {
    const { result } = renderHook(() => useHover(['h1']));
    act(() => result.current.on.h1(pointer('mouse')));
    expect(result.current.hov).toBe('h1');
    expect(result.current.hv.h1box).toBe('#FF0083');
    act(() => result.current.off());
    expect(result.current.hov).toBeNull();
  });

  it('ignores touch and pen pointers', () => {
    const { result } = renderHook(() => useHover(['h1']));
    act(() => result.current.on.h1(pointer('touch')));
    act(() => result.current.on.h1(pointer('pen')));
    expect(result.current.hov).toBeNull();
  });
});
