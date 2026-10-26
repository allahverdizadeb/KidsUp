import { useId } from 'react';
import type { ReactNode } from 'react';

export interface ControlProps {
  id: string;
  'aria-invalid': boolean;
  'aria-describedby': string | undefined;
}

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  /** The control; it gets the id the label points to and the description it is described by. */
  children: (control: ControlProps) => ReactNode;
}

/** A label, a control, a line of help and the fault, joined for screen readers as well as for the eye. */
export function Field({ label, error, hint, children }: FieldProps) {
  const id = useId();
  const describedBy =
    [error ? `${id}-error` : '', hint ? `${id}-hint` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label htmlFor={id} style={{ fontSize: 13, fontWeight: 800 }}>
        {label}
      </label>
      {children({ id, 'aria-invalid': !!error, 'aria-describedby': describedBy })}
      {hint && (
        <span id={`${id}-hint`} style={{ fontSize: 12, fontWeight: 600, color: '#6B6B6B' }}>
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-error`} role="alert" style={{ fontSize: 12, fontWeight: 700, color: '#C62828' }}>
          {error}
        </span>
      )}
    </div>
  );
}
