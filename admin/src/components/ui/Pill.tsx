import type { StatusLook } from '../../lib/status.ts';

/** A rounded label with a coloured dot: a status of an application, a course, a section, an account. */
export function Pill({ look, size = 'md' }: { look: StatusLook; size?: 'md' | 'sm' }) {
  const small = size === 'sm';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: small ? '3px 9px' : '4px 10px',
        borderRadius: 999,
        background: look.bg,
        color: look.fg,
        fontSize: small ? 11 : 12,
        fontWeight: 700,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: look.dot }} />
      {look.label}
    </span>
  );
}

/** A round badge with initials. */
export function Avatar({
  initials,
  background,
  color,
  size = 40,
  rounded = '50%',
}: {
  initials: string;
  background: string;
  color: string;
  size?: number;
  rounded?: string | number;
}) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: rounded,
        background,
        color,
        fontSize: 13,
        fontWeight: 800,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {initials}
    </span>
  );
}

/** The design's on/off switch, drawn only: the button around it carries the name and the state. */
export function SwitchTrack({ on }: { on: boolean }) {
  return (
    <span
      style={{
        position: 'relative',
        width: 40,
        height: 22,
        borderRadius: 999,
        background: on ? '#1F9D66' : '#D6D6D6',
        flexShrink: 0,
        transition: 'background .2s',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: 3,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#FFFFFF',
          boxShadow: '0 1px 3px rgba(0,0,0,.2)',
          transform: on ? 'translateX(18px)' : 'none',
          transition: 'transform .2s ease',
        }}
      />
    </span>
  );
}
