import { useEffect, useState } from 'react';

/** Current window width; layout switches (mobile menu, stacked lists) depend on it. */
export function useWidth(): number {
  const [width, setWidth] = useState(() => window.innerWidth);

  useEffect(() => {
    const update = () => {
      if (window.innerWidth > 0) setWidth(window.innerWidth);
    };
    window.addEventListener('resize', update);
    const observer = 'ResizeObserver' in window ? new ResizeObserver(update) : null;
    observer?.observe(document.documentElement);
    update();
    const settle = setTimeout(update, 300);
    return () => {
      window.removeEventListener('resize', update);
      observer?.disconnect();
      clearTimeout(settle);
    };
  }, []);

  return width;
}
