import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { ICON } from '../../lib/icons.ts';
import { sx } from '../../lib/sx.ts';
import { Icon } from './Icon.tsx';

type Native = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'style' | 'className'>;

/** The pink button of the design (new course, publish all, send). */
export function PrimaryButton({
  children,
  plus = false,
  ...rest
}: Native & { children: ReactNode; plus?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      {...sx(
        {
          height: 40,
          padding: '0 16px',
          border: 'none',
          borderRadius: 10,
          background: '#FF0083',
          color: '#FFFFFF',
          fontSize: 14,
          fontWeight: 800,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          whiteSpace: 'nowrap',
          transition: 'background .15s',
          opacity: rest.disabled ? 0.6 : 1,
        },
        { background: '#E00073' },
      )}
    >
      {plus && <Icon d={ICON.plus} size={16} strokeWidth={2.4} />}
      {children}
    </button>
  );
}

/** The white button with a grey outline (cancel, edit, show all). */
export function OutlineButton({
  children,
  height = 40,
  ...rest
}: Native & { children: ReactNode; height?: number }) {
  return (
    <button
      type="button"
      {...rest}
      {...sx(
        {
          height,
          padding: '0 16px',
          border: '1px solid #E3E3E3',
          borderRadius: 10,
          background: '#FFFFFF',
          fontSize: 14,
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          whiteSpace: 'nowrap',
          transition: 'background .15s',
          opacity: rest.disabled ? 0.6 : 1,
        },
        { background: '#F7F7F8' },
      )}
    >
      {children}
    </button>
  );
}

/** A small count shown on a button or a chip. */
export function CountBadge({
  children,
  background = '#F3F3F4',
  color,
}: {
  children: ReactNode;
  background?: string;
  color?: string;
}) {
  return (
    <span
      style={{
        minWidth: 20,
        height: 20,
        padding: '0 6px',
        borderRadius: 999,
        background,
        color,
        fontSize: 11,
        fontWeight: 800,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </span>
  );
}
