import { createContext } from 'react';

export interface DrawerApi {
  /** The application whose details are open, if any. */
  openId: string | null;
  open: (id: string) => void;
  close: () => void;
}

export const DrawerContext = createContext<DrawerApi | null>(null);
