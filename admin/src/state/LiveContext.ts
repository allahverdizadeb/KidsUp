import { createContext } from 'react';

export interface Live {
  /** Goes up whenever applications arrived or changed: a list that depends on it loads again. */
  tick: number;
  /** After this page changed something, the others should look again. */
  refresh: () => void;
  /** How many applications wait for an answer ("new"), for the badge of the menu. */
  newApplications: number;
}

export const LiveContext = createContext<Live | null>(null);
