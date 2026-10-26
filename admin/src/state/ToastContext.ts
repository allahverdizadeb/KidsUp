import { createContext } from 'react';

export type ToastKind = 'ok' | 'error';

export interface ToastApi {
  /**
   * A short message at the corner of the screen. A success goes away after a while (it waits as long as the pointer
   * or the keyboard focus is on it); a failure stays until it is closed. Never put a name or a number of a family in it.
   */
  toast: (kind: ToastKind, title: string, sub?: string) => void;
  /** Takes every message away (the session is over: nothing of it may stay on the screen). */
  clear: () => void;
}

export const ToastContext = createContext<ToastApi | null>(null);
