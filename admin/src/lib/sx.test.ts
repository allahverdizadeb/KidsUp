import { describe, expect, it } from 'vitest';
import { sx } from './sx.ts';

describe('sx', () => {
  it('passes the base style through and adds nothing without a hover', () => {
    expect(sx({ height: 40 })).toEqual({ className: undefined, style: { height: 40 } });
  });

  it('names what changes on hover with classes and gives the values as custom properties', () => {
    const { className, style } = sx({ height: 40 }, { background: '#E00073', transform: 'translateY(-1px)' });
    expect(className).toBe('h-bg h-tf');
    expect(style).toEqual({ height: 40, '--h-bg': '#E00073', '--h-tf': 'translateY(-1px)' });
  });

  it('covers every property the design hovers', () => {
    const { className } = sx(
      {},
      { background: 'a', color: 'b', borderColor: 'c', transform: 'd', boxShadow: 'e' },
    );
    expect(className?.split(' ').sort()).toEqual(['h-bd', 'h-bg', 'h-fg', 'h-sh', 'h-tf']);
  });

  it('keeps a class given by the caller and skips a hover property left undefined', () => {
    const { className, style } = sx({}, { background: undefined, color: '#fff' }, 'mine');
    expect(className).toBe('mine h-fg');
    expect(style).toEqual({ '--h-fg': '#fff' });
  });
});
