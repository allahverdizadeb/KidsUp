import { useEffect, useState } from 'react';

/** The value, once it has stopped changing for `delay` ms (a search runs after typing, not on every key). */
export function useDebounced<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
}
