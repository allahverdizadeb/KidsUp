import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import RegistrationDrawer from '../pages/registrations/RegistrationDrawer.tsx';
import { DrawerContext } from './DrawerContext.ts';
import type { DrawerApi } from './DrawerContext.ts';

/** How long the sheet takes to slide out; its contents stay until then and are taken out of the page right after. */
const SLIDE_OUT_MS = 350;

/** One side sheet for the details of an application, open from any page (the design opens it from the dashboard too). */
export default function DrawerProvider({ children }: { children: ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [shownId, setShownId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  useEffect(() => stopTimer, [stopTimer]);

  const open = useCallback(
    (id: string) => {
      stopTimer();
      setOpenId(id);
      setShownId(id);
    },
    [stopTimer],
  );

  const close = useCallback(() => {
    setOpenId(null);
    stopTimer();
    timer.current = setTimeout(() => setShownId(null), SLIDE_OUT_MS);
  }, [stopTimer]);

  const api = useMemo<DrawerApi>(() => ({ openId, open, close }), [openId, open, close]);

  return (
    <DrawerContext.Provider value={api}>
      {children}
      <RegistrationDrawer open={openId !== null} id={shownId} onClose={close} slideMs={SLIDE_OUT_MS - 30} />
    </DrawerContext.Provider>
  );
}
