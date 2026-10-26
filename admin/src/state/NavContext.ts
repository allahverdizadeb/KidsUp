import { createContext } from 'react';
import type { ApplicationStatus } from '../api/types.ts';

export type PageKey = 'dash' | 'reg' | 'courses' | 'cms' | 'users';

/** What a page asks the next one to show: a status filter, an application, a course. Never in the address. */
export interface Intent {
  status?: ApplicationStatus | 'all';
  applicationId?: string;
  /** Changes with every request, so asking for the same thing twice still acts. */
  nonce: number;
}

export interface Nav {
  page: PageKey;
  intent: Intent | null;
  go: (page: PageKey, intent?: Omit<Intent, 'nonce'>) => void;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
}

export const NavContext = createContext<Nav | null>(null);

export const PAGES: PageKey[] = ['dash', 'reg', 'courses', 'cms', 'users'];

export function isPage(value: string): value is PageKey {
  return (PAGES as string[]).includes(value);
}
