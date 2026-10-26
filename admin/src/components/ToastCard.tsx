import { useEffect, useRef, useState } from 'react';
import type { FocusEvent } from 'react';
import { ICON } from '../lib/icons.ts';
import { sx } from '../lib/sx.ts';
import type { ToastKind } from '../state/ToastContext.ts';
import { Icon } from './ui/Icon.tsx';

/** How long a success stays when nobody holds it (a failure stays until it is closed). */
const SUCCESS_SHOWN_FOR_MS = 6000;

type ToastCardProps = {
  id: number;
  kind: ToastKind;
  title: string;
  sub: string;
  onDismiss: (id: number) => void;
};

/** One message of the corner. It keeps its place while the pointer or the focus is on it, so there is time to read. */
export default function ToastCard({ id, kind, title, sub, onDismiss }: ToastCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [hasFocus, setHasFocus] = useState(false);
  const isHeld = isHovered || hasFocus;
  const timeLeft = useRef(SUCCESS_SHOWN_FOR_MS);

  useEffect(() => {
    if (kind === 'error' || isHeld) return;
    const startedAt = Date.now();
    const timer = setTimeout(() => onDismiss(id), timeLeft.current);
    return () => {
      clearTimeout(timer);
      timeLeft.current = Math.max(0, timeLeft.current - (Date.now() - startedAt));
    };
  }, [id, kind, isHeld, onDismiss]);

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setHasFocus(false);
  };

  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
      onFocus={() => setHasFocus(true)}
      onBlur={handleBlur}
      style={{
        pointerEvents: 'auto',
        width: 'min(380px,100%)',
        background: '#1A1A1A',
        color: '#FFFFFF',
        borderRadius: 12,
        padding: '14px 16px',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        boxShadow: '0 14px 36px rgba(26,26,26,.28)',
        animation: 'kaIn .25s ease',
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: kind === 'error' ? '#E5484D' : '#1F9D66',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        <Icon d={kind === 'error' ? ICON.alert : ICON.check} size={12} stroke="#FFFFFF" strokeWidth={3} />
      </span>
      <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 800 }}>{title}</span>
        {sub && (
          <span style={{ fontSize: 13, lineHeight: 1.45, fontWeight: 500, color: '#CFCFCF' }}>{sub}</span>
        )}
      </span>
      <button
        type="button"
        onClick={() => onDismiss(id)}
        aria-label="Bağla"
        {...sx(
          {
            width: 24,
            height: 24,
            border: 'none',
            borderRadius: 6,
            background: 'transparent',
            color: '#A3A3A3',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          },
          { color: '#FFFFFF' },
        )}
      >
        <Icon d={ICON.close} size={12} strokeWidth={2.6} />
      </button>
    </div>
  );
}
