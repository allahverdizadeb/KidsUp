import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { NavContext, isPage } from './NavContext.ts';
import type { Intent, Nav, PageKey } from './NavContext.ts';

/** The page is kept in the address after the #, so a reload and the back button stay where they were. Only the
 * page's name goes there: no id, no search word, nothing about a family (admin rule 6). */
function pageFromAddress(): PageKey {
  const name = window.location.hash.replace(/^#\/?/, '');
  return isPage(name) ? name : 'dash';
}

export default function NavProvider({ children }: { children: ReactNode }) {
  const [page, setPage] = useState<PageKey>(pageFromAddress);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const nonce = useRef(0);
  const current = useRef(page);

  // The back button and a typed address: a move this code did not make itself forgets what the last page asked for.
  useEffect(() => {
    const onChange = () => {
      const next = pageFromAddress();
      if (next === current.current) return;
      current.current = next;
      setPage(next);
      setIntent(null);
      setMenuOpen(false);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const go = useCallback((next: PageKey, wanted?: Omit<Intent, 'nonce'>) => {
    nonce.current += 1;
    current.current = next;
    setIntent(wanted ? { ...wanted, nonce: nonce.current } : null);
    setMenuOpen(false);
    setPage(next);
    window.location.hash = next;
    window.scrollTo(0, 0);
  }, []);

  const nav = useMemo<Nav>(() => ({ page, intent, go, menuOpen, setMenuOpen }), [page, intent, go, menuOpen]);

  return <NavContext.Provider value={nav}>{children}</NavContext.Provider>;
}
