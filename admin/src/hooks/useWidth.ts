import { useEffect, useState } from 'react';

/** Current window width; the layout (sidebar, rail, drawer, stacked lists) depends on it, as in the design. */
export function useWidth(): number {
  const [width, setWidth] = useState(() => window.innerWidth);

  useEffect(() => {
    const update = () => {
      if (window.innerWidth > 0) setWidth(window.innerWidth);
    };
    window.addEventListener('resize', update);
    update();
    return () => window.removeEventListener('resize', update);
  }, []);

  return width;
}

export type LayoutMode = 'full' | 'rail' | 'mobile';

/** The design's three layouts: full sidebar from 1100 px, icon rail from 760 px, a drawer below. */
export function layoutOf(width: number): LayoutMode {
  return width >= 1100 ? 'full' : width >= 760 ? 'rail' : 'mobile';
}
