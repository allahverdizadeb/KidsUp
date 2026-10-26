import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

/** Windows that are open, the last one on top. Escape closes only the top one, as in the design. */
const open: symbol[] = [];
let locks = 0;

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Whether the element is on the page to be seen: neither it nor anything around it is switched off or hidden. */
function shown(element: HTMLElement): boolean {
  for (let node: HTMLElement | null = element; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
  }
  return true;
}

function focusableIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(shown);
}

/**
 * Behaviour of a dialog or a side sheet while it is open: Escape closes the top one, Tab stays inside it, focus moves
 * in when it opens and goes back to what opened it when it closes, and the page behind does not scroll.
 */
export function useOverlay(active: boolean, onClose: () => void, ref: RefObject<HTMLElement | null>): void {
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    if (!active) return;
    const id = Symbol('overlay');
    open.push(id);
    locks += 1;
    document.body.style.overflow = 'hidden';
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const root = ref.current;
    if (root) {
      const first = focusableIn(root)[0];
      if (first) first.focus();
      else {
        root.tabIndex = -1;
        root.focus();
      }
    }

    const onKey = (event: KeyboardEvent) => {
      if (open[open.length - 1] !== id) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        close.current();
        return;
      }
      if (event.key !== 'Tab' || !ref.current) return;
      const items = focusableIn(ref.current);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const firstItem = items[0] as HTMLElement;
      const lastItem = items[items.length - 1] as HTMLElement;
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      } else if (!ref.current.contains(document.activeElement)) {
        event.preventDefault();
        firstItem.focus();
      }
    };
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('keydown', onKey);
      open.splice(open.indexOf(id), 1);
      locks -= 1;
      if (locks === 0) document.body.style.overflow = '';
      if (before && document.contains(before)) before.focus();
    };
  }, [active, ref]);
}
