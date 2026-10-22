import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BoldText from './BoldText';

describe('BoldText', () => {
  it('makes the words between double stars bold and drops the stars', () => {
    const { container } = render(<BoldText text="Bu **çox** vacibdir, **iki dəfə**." />);

    expect(container).toHaveTextContent('Bu çox vacibdir, iki dəfə.');
    expect(screen.getByText('çox').tagName).toBe('B');
    expect(screen.getByText('iki dəfə').tagName).toBe('B');
    expect(container).not.toHaveTextContent('**');
  });

  it('shows plain text as it is', () => {
    const { container } = render(<BoldText text="Heç bir qalın söz yoxdur." />);

    expect(container).toHaveTextContent('Heç bir qalın söz yoxdur.');
    expect(container.querySelector('b')).toBeNull();
  });

  it('never turns text into markup', () => {
    const { container } = render(<BoldText text="<b>not bold</b> **bold**" />);

    expect(container.querySelectorAll('b')).toHaveLength(1);
    expect(container).toHaveTextContent('<b>not bold</b> bold');
  });
});
