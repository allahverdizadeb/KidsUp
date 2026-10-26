import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { getPulse } from '../api/applications.ts';
import type { Pulse } from '../api/types.ts';
import { LiveContext } from './LiveContext.ts';
import type { Live } from './LiveContext.ts';
import { useSession } from './useSession.ts';
import { useToast } from './useToast.ts';

const POLL_EVERY_MS = 15_000;

/**
 * Looks every few seconds whether an application arrived, so a new one shows without a reload. The poll is marked
 * as background: it does not keep an idle session alive, and when the session has ended it is the one that finds out.
 */
export default function LiveProvider({ children }: { children: ReactNode }) {
  const { can } = useSession();
  const { toast } = useToast();
  const [tick, setTick] = useState(0);
  const [newApplications, setNewApplications] = useState(0);
  const last = useRef<Pulse | null>(null);
  const mayLook = can('applications:read');

  useEffect(() => {
    if (!mayLook) return;
    let alive = true;
    const look = async () => {
      try {
        const now = await getPulse();
        if (!alive) return;
        const before = last.current;
        last.current = now;
        setNewApplications(now.new_applications);
        if (before === null) return;
        const changed =
          now.applications_total !== before.applications_total ||
          now.new_applications !== before.new_applications ||
          now.latest_application_at !== before.latest_application_at;
        if (!changed) return;
        setTick((n) => n + 1);
        if (now.applications_total > before.applications_total) {
          const arrived = now.applications_total - before.applications_total;
          toast(
            'ok',
            arrived === 1 ? 'Yeni müraciət gəldi' : `${arrived} yeni müraciət gəldi`,
            'Siyahı yeniləndi.',
          );
        }
      } catch {
        // A failed poll is tried again at the next turn; a dead session was already handled by the client.
      }
    };
    void look();
    const timer = setInterval(() => void look(), POLL_EVERY_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [mayLook, toast]);

  const refresh = useCallback(() => {
    setTick((n) => n + 1);
    // Our own change moved the counts as well: the next poll must not announce it as news.
    last.current = null;
    getPulse()
      .then((now) => {
        last.current = now;
        setNewApplications(now.new_applications);
      })
      .catch(() => undefined);
  }, []);

  const live = useMemo<Live>(() => ({ tick, refresh, newApplications }), [tick, refresh, newApplications]);

  return <LiveContext.Provider value={live}>{children}</LiveContext.Provider>;
}
