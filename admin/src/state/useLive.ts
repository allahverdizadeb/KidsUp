import { useContext } from 'react';
import { LiveContext } from './LiveContext.ts';
import type { Live } from './LiveContext.ts';

export function useLive(): Live {
  const live = useContext(LiveContext);
  if (!live) throw new Error('useLive needs a LiveProvider');
  return live;
}
