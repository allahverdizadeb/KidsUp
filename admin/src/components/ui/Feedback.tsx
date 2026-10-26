import { ICON } from '../../lib/icons.ts';
import { describe } from '../../lib/errors.ts';
import { sx } from '../../lib/sx.ts';
import { Icon } from './Icon.tsx';

/** Shown while a page's data is on its way. */
export function Loading({ label = 'Yüklənir…' }: { label?: string }) {
  return (
    <div
      role="status"
      style={{
        padding: '48px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        fontSize: 14,
        fontWeight: 600,
        color: '#6B6B6B',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          border: '2px solid #E3E3E3',
          borderTopColor: '#FF0083',
          animation: 'kaSpin .8s linear infinite',
        }}
      />
      {label}
    </div>
  );
}

/** A page's data could not be loaded: what went wrong, and a way to try again. */
export function LoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const problem = describe(error);
  return (
    <div
      role="alert"
      style={{
        padding: '40px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        textAlign: 'center',
        background: '#FFFFFF',
        border: '1px solid #EDEDED',
        borderRadius: 14,
      }}
    >
      <span
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          background: '#FDECEC',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon d={ICON.alert} size={22} stroke="#C62828" strokeWidth={2} />
      </span>
      <span style={{ fontSize: 15, fontWeight: 800 }}>{problem.title}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: '#6B6B6B' }}>{problem.sub}</span>
      <button
        type="button"
        onClick={onRetry}
        {...sx(
          {
            marginTop: 6,
            height: 36,
            padding: '0 14px',
            border: '1px solid #E3E3E3',
            borderRadius: 10,
            background: '#FFFFFF',
            fontSize: 13,
            fontWeight: 700,
          },
          { background: '#F7F7F8' },
        )}
      >
        Yenidən cəhd et
      </button>
    </div>
  );
}
