import type { CSSProperties, ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  style?: CSSProperties;
  /** The flatter look of the tables and the editor: 14px corners and a thin shadow. */
  soft?: boolean;
  /** The id of the card's heading: the card then is a named region of the page, found by that name. */
  labelledBy?: string;
}

/** The white rounded panel of the dashboard (20px corners) and of the registrations (14px). */
export function Card({ children, style, soft = false, labelledBy }: CardProps) {
  const look: CSSProperties = {
    background: '#FFFFFF',
    border: `1px solid ${soft ? '#EDEDED' : '#ECECEE'}`,
    borderRadius: soft ? 14 : 20,
    boxShadow: soft
      ? '0 1px 2px rgba(26,26,26,.04)'
      : '0 1px 2px rgba(26,26,26,.03),0 8px 24px rgba(26,26,26,.03)',
    ...style,
  };
  return labelledBy ? (
    <section aria-labelledby={labelledBy} style={look}>
      {children}
    </section>
  ) : (
    <div style={look}>{children}</div>
  );
}
