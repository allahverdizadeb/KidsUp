import type { CSSProperties } from 'react';

/** What an element changes while the pointer is over it: the design's `style-hover`. */
export interface HoverStyle {
  background?: string;
  color?: string;
  borderColor?: string;
  transform?: string;
  boxShadow?: string;
}

const CLASS_OF: Record<keyof HoverStyle, string> = {
  background: 'h-bg',
  color: 'h-fg',
  borderColor: 'h-bd',
  transform: 'h-tf',
  boxShadow: 'h-sh',
};
const VARIABLE_OF: Record<keyof HoverStyle, string> = {
  background: '--h-bg',
  color: '--h-fg',
  borderColor: '--h-bd',
  transform: '--h-tf',
  boxShadow: '--h-sh',
};

interface Styled {
  className?: string;
  style: CSSProperties;
}

/**
 * An element's style, and what changes on hover. The page's policy forbids style attributes in markup, so the base
 * style goes through React's style object (which the browser accepts) and the hover values are custom properties
 * that the classes of index.css read: `<button {...sx({ height: 40 }, { background: '#E00073' })}>`.
 */
export function sx(base: CSSProperties, hover?: HoverStyle, className?: string): Styled {
  const classes = className ? [className] : [];
  const style: Record<string, string | number | undefined> = { ...base };
  if (hover) {
    for (const key of Object.keys(hover) as (keyof HoverStyle)[]) {
      const value = hover[key];
      if (value === undefined) continue;
      classes.push(CLASS_OF[key]);
      style[VARIABLE_OF[key]] = value;
    }
  }
  return { className: classes.length ? classes.join(' ') : undefined, style: style as CSSProperties };
}
