import { del, get, post } from './client.ts';
import type { Session, SignInRequest } from './types.ts';

/** Sign in with the e-mail, the password and the current one-time code. The answer carries the CSRF token. */
export const signIn = (data: SignInRequest) => post<Session>('/sessions', data, { anonymous: true });

/** Who is signed in. At start-up a 401 only means nobody is, so it is not treated as an expired session. */
export const currentSession = (options: { quiet: boolean }) =>
  get<Session>('/sessions/current', { anonymous: options.quiet });

export const signOut = () => del('/sessions/current');
