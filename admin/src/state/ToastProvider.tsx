import { useCallback, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import ToastCard from '../components/ToastCard.tsx';
import { useWidth } from '../hooks/useWidth.ts';
import { ToastContext } from './ToastContext.ts';
import type { ToastApi, ToastKind } from './ToastContext.ts';

const AT_MOST = 3;

type Toast = {
  id: number;
  kind: ToastKind;
  title: string;
  sub: string;
};

/**
 * At most three messages stay. When a fourth comes, the oldest success goes first: a failure nobody has read yet
 * stays until it is closed (only when all of them are failures does the oldest of them go).
 */
function withinLimit(all: Toast[]): Toast[] {
  const kept = [...all];
  while (kept.length > AT_MOST) {
    const oldestSuccess = kept.findIndex((candidate) => candidate.kind === 'ok');
    kept.splice(oldestSuccess === -1 ? 0 : oldestSuccess, 1);
  }
  return kept;
}

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const width = useWidth();

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);
  const clear = useCallback(() => setToasts([]), []);

  const toast = useCallback<ToastApi['toast']>((kind, title, sub = '') => {
    nextId.current += 1;
    const id = nextId.current;
    setToasts((all) => withinLimit([...all, { id, kind, title, sub }]));
  }, []);

  const api = useMemo(() => ({ toast, clear }), [toast, clear]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        style={{
          position: 'fixed',
          right: 20,
          bottom: 20,
          left: width < 760 ? 16 : 'auto',
          zIndex: 200,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          alignItems: 'flex-end',
          pointerEvents: 'none',
        }}
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} id={t.id} kind={t.kind} title={t.title} sub={t.sub} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
