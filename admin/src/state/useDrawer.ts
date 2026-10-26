import { useContext } from 'react';
import { DrawerContext } from './DrawerContext.ts';
import type { DrawerApi } from './DrawerContext.ts';

export function useDrawer(): DrawerApi {
  const api = useContext(DrawerContext);
  if (!api) throw new Error('useDrawer needs a DrawerProvider');
  return api;
}
