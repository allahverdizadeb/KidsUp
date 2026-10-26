import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

export interface Loaded<T> {
  /** The newest answer; `null` until the first one arrives. The old answer stays on screen while the next is on its way. */
  data: T | null;
  /** Why the newest request failed, or `null`. */
  error: unknown;
  reload: () => void;
  setData: Dispatch<SetStateAction<T | null>>;
}

type Inputs = {
  key: string;
  nonce: number;
  refresh: unknown;
};

/**
 * Runs `load` now, whenever `key` changes, whenever `refresh` changes and when `reload` is called, and keeps the
 * newest answer. An answer that arrives after a newer request was made is dropped, so a slow reply cannot lay old
 * data over new.
 *
 * `load` is told whether the run is a background one: only `refresh` changed, so the page is updating itself and
 * nobody asked. Such a request must be sent as a background request, which does not count as somebody working: a
 * forgotten tab that refreshes itself would otherwise keep its session alive for ever.
 */
export function useAsync<T>(
  load: (background: boolean) => Promise<T>,
  key = '',
  refresh: unknown = 0,
): Loaded<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [nonce, setNonce] = useState(0);
  const newest = useRef(0);
  const loader = useRef(load);
  const lastRun = useRef<Inputs | null>(null);
  useEffect(() => {
    loader.current = load;
  });

  useEffect(() => {
    const before = lastRun.current;
    lastRun.current = { key, nonce, refresh };
    const background =
      before !== null && before.key === key && before.nonce === nonce && !Object.is(before.refresh, refresh);
    newest.current += 1;
    const mine = newest.current;
    loader
      .current(background)
      .then((answer) => {
        if (mine !== newest.current) return;
        setData(answer);
        setError(null);
      })
      .catch((failure: unknown) => {
        if (mine !== newest.current) return;
        setError(failure);
      });
    return () => {
      // A newer request (or the end of this component) makes this one's answer stale.
      if (mine === newest.current) newest.current += 1;
    };
  }, [key, nonce, refresh]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, error, reload, setData };
}
