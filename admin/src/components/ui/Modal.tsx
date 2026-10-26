import { useId, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useOverlay } from '../../hooks/useOverlay.ts';
import { ICON } from '../../lib/icons.ts';
import { sx } from '../../lib/sx.ts';
import { Icon } from './Icon.tsx';

interface ModalProps {
  /** The dialog's name for screen readers (and its heading when `ModalHeader` is used). */
  label: string;
  onClose: () => void;
  children: ReactNode;
  /** The widest the window gets, in px. */
  width?: number;
  /** Stacking: confirmations sit above forms, the preview above all. */
  layer?: number;
  /** How dark the page behind goes (0-1). */
  dim?: number;
  role?: 'dialog' | 'alertdialog';
  /** The id of the text that describes the window (read after its name). */
  describedBy?: string;
  /** Replaces parts of the window's frame (the default is a form-sized window that scrolls). */
  frame?: CSSProperties;
}

/** A window over the page with the design's frame: it closes with Escape, with a click outside and with its button. */
export function Modal({
  label,
  onClose,
  children,
  width = 560,
  layer = 110,
  dim = 0.36,
  role = 'dialog',
  describedBy,
  frame,
}: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);
  useOverlay(true, onClose, ref);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: layer,
        background: `rgba(26,26,26,${dim})`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        animation: 'kaFade .2s ease',
      }}
    >
      <div
        ref={ref}
        role={role}
        aria-modal="true"
        aria-label={label}
        aria-describedby={describedBy}
        onClick={(event) => event.stopPropagation()}
        style={{
          width: `min(${width}px,100%)`,
          maxHeight: 'calc(100vh - 32px)',
          overflowY: 'auto',
          background: '#FFFFFF',
          borderRadius: 16,
          boxShadow: '0 24px 64px rgba(26,26,26,.2)',
          animation: 'kaIn .25s ease',
          display: 'flex',
          flexDirection: 'column',
          ...frame,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** The round grey button that closes a window. */
export function CloseButton({ onClick, label = 'Bağla' }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      {...sx(
        {
          width: 36,
          height: 36,
          border: 'none',
          borderRadius: 10,
          background: '#F3F3F4',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        },
        { background: '#EAEAEA' },
      )}
    >
      <Icon d={ICON.close} size={16} stroke="#1A1A1A" strokeWidth={2.2} />
    </button>
  );
}

export function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div
      style={{
        padding: '22px 24px 6px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>{title}</h2>
      <CloseButton onClick={onClose} />
    </div>
  );
}

interface ConfirmProps {
  title: string;
  text: string;
  confirmLabel: string;
  busy?: boolean;
  /** `danger` is the design's red confirmation (something that cannot be taken back); `careful` is a dark one. */
  tone?: 'danger' | 'careful';
  onConfirm: () => void;
  onCancel: () => void;
}

const CONFIRM_LOOK = {
  danger: {
    icon: ICON.trash,
    iconBackground: '#FDECEC',
    iconColor: '#C62828',
    button: '#C62828',
    hover: '#A91F1F',
  },
  careful: {
    icon: ICON.download,
    iconBackground: '#F3F3F4',
    iconColor: '#1A1A1A',
    button: '#1A1A1A',
    hover: '#333333',
  },
};

/** "Are you sure?" for something that cannot be taken back (or that needs a second thought). */
export function ConfirmDialog({
  title,
  text,
  confirmLabel,
  busy = false,
  tone = 'danger',
  onConfirm,
  onCancel,
}: ConfirmProps) {
  const look = CONFIRM_LOOK[tone];
  const textId = useId();
  return (
    <Modal
      label={title}
      role="alertdialog"
      describedBy={textId}
      width={420}
      layer={120}
      dim={0.4}
      onClose={onCancel}
    >
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <span
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: look.iconBackground,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon d={look.icon} size={20} stroke={look.iconColor} />
        </span>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{title}</h2>
        <p
          id={textId}
          style={{ margin: 0, fontSize: 14, lineHeight: 1.55, fontWeight: 500, color: '#4A4A4A' }}
        >
          {text}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
          <button
            type="button"
            onClick={onCancel}
            {...sx(
              {
                height: 40,
                padding: '0 16px',
                border: '1px solid #E3E3E3',
                borderRadius: 10,
                background: '#FFFFFF',
                fontSize: 14,
                fontWeight: 700,
              },
              { background: '#F7F7F8' },
            )}
          >
            Ləğv et
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            {...sx(
              {
                height: 40,
                padding: '0 16px',
                border: 'none',
                borderRadius: 10,
                background: look.button,
                color: '#FFFFFF',
                fontSize: 14,
                fontWeight: 800,
                opacity: busy ? 0.6 : 1,
              },
              { background: look.hover },
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
