import type { ReactNode } from 'react';

/** The title of a page, one line under it, and the buttons that belong to the page. */
export function PageHeader({ title, sub, actions }: { title: string; sub: string; actions?: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 16,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 720 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.15 }}>
          {title}
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            lineHeight: 1.55,
            fontWeight: 500,
            color: '#6B6B6B',
            textWrap: 'pretty',
          }}
        >
          {sub}
        </p>
      </div>
      {actions && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>{actions}</div>
      )}
    </div>
  );
}
