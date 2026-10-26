import type { CSSProperties } from 'react';

/** The design's text box: 44px tall, rounded, a red outline when it holds a fault. */
export function inputStyle(invalid: boolean, weight = 600): CSSProperties {
  return {
    width: '100%',
    height: 44,
    padding: '0 14px',
    border: `1px solid ${invalid ? '#C62828' : '#E3E3E3'}`,
    borderRadius: 10,
    background: '#FFFFFF',
    fontSize: 14,
    fontWeight: weight,
  };
}

/** The multi-line text box of the editor and of the notes. */
export function textareaStyle(invalid: boolean): CSSProperties {
  return {
    width: '100%',
    padding: '12px 14px',
    border: `1px solid ${invalid ? '#C62828' : '#E3E3E3'}`,
    borderRadius: 10,
    background: '#FFFFFF',
    fontSize: 14,
    fontWeight: 500,
    lineHeight: 1.55,
    resize: 'vertical',
  };
}
