import type { CSSProperties } from 'react';

interface IconProps {
  /** The `d` of the path (lib/icons.ts). */
  d: string;
  size?: number;
  stroke?: string;
  strokeWidth?: number;
  style?: CSSProperties;
}

/** A line icon of the design. Decoration only: the control around it carries the name. */
export function Icon({ d, size = 20, stroke = 'currentColor', strokeWidth = 1.9, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={style}
    >
      <path d={d} />
    </svg>
  );
}
