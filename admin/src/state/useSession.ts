import { useContext } from 'react';
import type { AdminProfile } from '../api/types.ts';
import { SessionContext } from './SessionContext.ts';
import type { SessionApi } from './SessionContext.ts';

export function useSession(): SessionApi {
  const api = useContext(SessionContext);
  if (!api) throw new Error('useSession needs a SessionProvider');
  return api;
}

/** The signed-in staff member; only for screens that exist when somebody is signed in. */
export function useAdmin(): AdminProfile {
  const { phase } = useSession();
  if (phase.kind !== 'in') throw new Error('useAdmin needs a signed-in session');
  return phase.session.admin;
}
