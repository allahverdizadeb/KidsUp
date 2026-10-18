import { useCallback, useMemo, useState } from 'react';
import type { PointerEvent } from 'react';
import { hoverValues } from '../lib/hover';

type PointerHandler = (e: PointerEvent) => void;

/** Tracks which illustration (by id) the mouse is over. Touch/pen never trigger hover effects. */
export function useHover(ids: readonly string[]) {
  const [hov, setHov] = useState<string | null>(null);

  const on = useMemo(() => {
    const handlers: Record<string, PointerHandler> = {};
    for (const id of ids) handlers[id] = (e) => e.pointerType === 'mouse' && setHov(id);
    return handlers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const off = useCallback(() => setHov(null), []);
  const hv = useMemo(() => hoverValues(hov), [hov]);

  return { hov, setHov, on, off, hv };
}
