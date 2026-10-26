import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ApiError, setCsrfToken, setUnauthorizedHandler } from '../api/client.ts';
import * as sessionApi from '../api/session.ts';
import type { Permission, SignInRequest } from '../api/types.ts';
import { clearEdits } from './cmsEdits.ts';
import { SessionContext } from './SessionContext.ts';
import type { Phase, SessionApi } from './SessionContext.ts';
import { useToast } from './useToast.ts';

/** While somebody works, the session is kept alive; this is how often at most (it ends after 15 idle minutes). */
const KEEP_ALIVE_EVERY_MS = 2 * 60_000;
/** How often the screen looks at the date to see whether it was left alone for too long. */
const IDLE_CHECK_EVERY_MS = 15_000;
/**
 * What shows that somebody is at work: a press, a key, a bare `click` (how a screen reader or a voice command acts
 * on a button) and `input` (dictation). Not the movement of the pointer: a jiggler must not hold a session open.
 */
const WORK_EVENTS = ['pointerdown', 'keydown', 'click', 'input'] as const;
/** The longest idle time the API allows, used if it ever names no usable one. */
const LONGEST_IDLE_SECONDS = 15 * 60;

export default function SessionProvider({ children }: { children: ReactNode }) {
  const { clear: clearToasts } = useToast();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const lastContact = useRef(0); // set when somebody signs in, or a session is found at start-up
  const signedIn = phase.kind === 'in';
  const idleSeconds = phase.kind === 'in' ? phase.session.idle_timeout_seconds : 0;

  // At start: is there a session already (a page reloaded)? A 401 only means nobody is signed in.
  useEffect(() => {
    let alive = true;
    sessionApi
      .currentSession({ quiet: true })
      .then((session) => {
        if (!alive) return;
        setCsrfToken(session.csrf_token);
        lastContact.current = Date.now();
        setPhase({ kind: 'in', session });
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setPhase({
          kind: 'out',
          reason: 'none',
          unreachable: error instanceof ApiError && error.status === 0,
        });
      });
    return () => {
      alive = false;
    };
  }, []);

  // The session is over as far as this screen is concerned: nothing of it stays in view or in memory (the texts
  // that were not saved, the messages, the token).
  const leave = useCallback(() => {
    setCsrfToken(null);
    clearEdits();
    clearToasts();
    setPhase({ kind: 'out', reason: 'expired', unreachable: false });
  }, [clearToasts]);

  // Any answer 401 while signed in means the session is over (idle too long, or ended elsewhere): leave at once,
  // so a screen with families' details does not stay open behind a dead session.
  useEffect(() => {
    if (!signedIn) return;
    setUnauthorizedHandler(leave);
    return () => setUnauthorizedHandler(null);
  }, [signedIn, leave]);

  // While somebody is signed in, the screen watches whether they work. A working person keeps the session alive (at
  // most every two minutes; a request the page makes by itself does not count, see api/client `background`). A
  // screen nobody has touched for as long as the server's idle time leaves, so the details of families do not stay on
  // a screen nobody is looking at: the server ends the session by itself at about the same time, this is the
  // screen's own clock. It is read from the date and looked at when the tab comes back, so a computer that slept
  // is counted too.
  useEffect(() => {
    if (!signedIn) return;
    const idleMs = (idleSeconds > 0 ? idleSeconds : LONGEST_IDLE_SECONDS) * 1000;
    let lastTouch = Date.now();
    const touch = () => {
      const now = Date.now();
      lastTouch = now;
      if (now - lastContact.current < KEEP_ALIVE_EVERY_MS) return;
      lastContact.current = now;
      sessionApi.currentSession({ quiet: false }).catch(() => undefined);
    };
    const check = () => {
      if (Date.now() - lastTouch >= idleMs) leave();
    };
    const timer = setInterval(check, IDLE_CHECK_EVERY_MS);
    for (const type of WORK_EVENTS) window.addEventListener(type, touch);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(timer);
      for (const type of WORK_EVENTS) window.removeEventListener(type, touch);
      document.removeEventListener('visibilitychange', check);
    };
  }, [signedIn, idleSeconds, leave]);

  const signIn = useCallback(async (data: SignInRequest) => {
    const session = await sessionApi.signIn(data);
    setCsrfToken(session.csrf_token);
    lastContact.current = Date.now();
    setPhase({ kind: 'in', session });
  }, []);

  const signOut = useCallback(async () => {
    try {
      await sessionApi.signOut();
    } catch {
      // The cookie may already be dead; the page is signed out either way.
    }
    setCsrfToken(null);
    clearEdits();
    clearToasts();
    setPhase({ kind: 'out', reason: 'signed-out', unreachable: false });
  }, [clearToasts]);

  const can = useCallback(
    (permission: Permission) => phase.kind === 'in' && phase.session.admin.permissions.includes(permission),
    [phase],
  );

  const api = useMemo<SessionApi>(() => ({ phase, signIn, signOut, can }), [phase, signIn, signOut, can]);

  return <SessionContext.Provider value={api}>{children}</SessionContext.Provider>;
}
