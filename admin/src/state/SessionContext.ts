import { createContext } from 'react';
import type { Permission, Session, SignInRequest } from '../api/types.ts';

/** Why nobody is signed in: just opened, signed out on purpose, or the session ended by itself. */
export type SignedOutReason = 'none' | 'signed-out' | 'expired';

export type Phase =
  | { kind: 'loading' }
  | { kind: 'out'; reason: SignedOutReason; unreachable: boolean }
  | { kind: 'in'; session: Session };

export interface SessionApi {
  phase: Phase;
  signIn: (data: SignInRequest) => Promise<void>;
  signOut: () => Promise<void>;
  /** Whether the signed-in role holds a permission. Cosmetic: the API checks every request again. */
  can: (permission: Permission) => boolean;
}

export const SessionContext = createContext<SessionApi | null>(null);
