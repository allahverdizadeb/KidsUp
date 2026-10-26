import { useContext } from 'react';
import { NavContext } from './NavContext.ts';
import type { Nav } from './NavContext.ts';

export function useNav(): Nav {
  const nav = useContext(NavContext);
  if (!nav) throw new Error('useNav needs a NavProvider');
  return nav;
}
