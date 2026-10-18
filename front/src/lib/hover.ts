// Hover effects on the illustrations. Each key is a value used by the SVG markup;
// it switches to its "hot" value while the owning element (the hover id) is hovered.
// Colors: [hover id, resting value, hovered value]. Moves: [hover id, hovered transform].
const COLORS: Record<string, [string, string, string]> = {
  h0sheet: ['h0', '#FFFFFF', '#FFE6F3'],
  h0line: ['h0', '#9A9A9A', '#FF0083'],
  h1box: ['h1', '#FFFFFF', '#FF0083'],
  h2scr: ['h2', '#EDEDED', '#FF0083'],
  h3hand: ['h3', '#FFFFFF', '#FF0083'],
  i2line: ['i2', '#8C8C8C', '#FF0083'],
  i2hook: ['i2', '#EDEDED', '#FF0083'],
  i3tape: ['i3', '#FFFFFF', '#FF0083'],
  i4coin: ['i4', '#FFFFFF', '#FF0083'],
  i4scr: ['i4', '#EDEDED', '#FF0083'],
  i5bar: ['i5', '#E4E4E4', '#FF0083'],
  i6bulb: ['i6', '#8C8C8C', '#FF0083'],
  b1bar: ['b1', '#E4E4E4', '#FF0083'],
  k1h: ['k1', '#EDEDED', '#FF0083'],
  k2b: ['k2', '#FFFFFF', '#FF0083'],
  k2d: ['k2', '#9A9A9A', '#FFFFFF'],
  k3tape: ['k3', '#FFFFFF', '#FF0083'],
  k4coin: ['k4', '#FFFFFF', '#FF0083'],
  k5bar: ['k5', '#E4E4E4', '#FF0083'],
  k6note: ['k6', '#FFFFFF', '#FF0083'],
};

const MOVES: Record<string, [string, string]> = {
  h0t: ['h0', 'translateY(-3px)'],
  h1t: ['h1', 'rotate(-8deg)'],
  h2t: ['h2', 'translateY(-3px)'],
  h3t: ['h3', 'translate(-3px,-3px)'],
  i2t: ['i2', 'translateY(-4px)'],
  i3t: ['i3', 'translateY(-3px)'],
  i4t: ['i4', 'translateY(-4px)'],
  i5t: ['i5', 'translateY(-4px)'],
  i6t: ['i6', 'translate(4px,-4px)'],
  b1t: ['b1', 'translateY(3px)'],
  k1t: ['k1', 'rotate(-6deg)'],
  k2t: ['k2', 'translateY(-3px)'],
  k3t: ['k3', 'translateY(-3px)'],
  k4t: ['k4', 'translateY(-4px)'],
  k5t: ['k5', 'rotate(-4deg)'],
  k6t: ['k6', 'rotate(-6deg)'],
};

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export function hoverValues(hovered: string | null): Record<string, string> {
  const reduce = prefersReducedMotion();
  const out: Record<string, string> = {};
  for (const [key, [id, rest, hot]] of Object.entries(COLORS)) out[key] = hovered === id ? hot : rest;
  for (const [key, [id, move]] of Object.entries(MOVES)) out[key] = !reduce && hovered === id ? move : 'none';
  return out;
}
