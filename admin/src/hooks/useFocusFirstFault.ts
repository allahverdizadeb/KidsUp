import { useCallback, useEffect, useRef } from 'react';
import type { RefObject } from 'react';

/**
 * When a form was refused, the person is taken to the first box marked wrong: they hear what is wrong with it, and
 * the keyboard is where it has to be.
 *
 * `faults` is the form's current faults, by field. The returned function must be called **just before** the new
 * faults are set (not for the faults that go away as a field is edited, or the focus would jump while somebody
 * types): once they are on the screen, the focus moves to the first box with `aria-invalid="true"` in `container`.
 */
export function useFocusFirstFault(
  container: RefObject<HTMLElement | null>,
  faults: Record<string, unknown>,
): () => void {
  const wanted = useRef(false);

  useEffect(() => {
    if (!wanted.current) return;
    wanted.current = false;
    container.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [faults, container]);

  return useCallback(() => {
    wanted.current = true;
  }, []);
}
