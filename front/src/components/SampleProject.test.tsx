import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { setViewportWidth } from '../test/viewport';
import SampleProject from './SampleProject';

describe('SampleProject', () => {
  it('starts on the sketch stage', () => {
    setViewportWidth(1440);
    render(<SampleProject />);
    expect(screen.getByText('Mərhələ 1 / 4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Eskiz/ })).toHaveAttribute('aria-current', 'step');
  });

  it('walks through every stage of the example project', async () => {
    setViewportWidth(1440);
    render(<SampleProject />);

    await userEvent.click(screen.getByRole('button', { name: /Prototip və sınaq/ }));
    expect(screen.getByText('Mərhələ 2 / 4')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Sadə hesab/ }));
    expect(screen.getByText('Material xərci')).toBeInTheDocument();
    expect(screen.getByText('Fərq').nextSibling).toHaveTextContent('3 AZN');

    await userEvent.click(screen.getByRole('button', { name: /Təqdimat/ }));
    expect(screen.getByText('Mərhələ 4 / 4')).toBeInTheDocument();
    expect(screen.queryByText('Material xərci')).not.toBeInTheDocument();
  });

  it('uses two columns of stage buttons on narrow screens', () => {
    setViewportWidth(500);
    render(<SampleProject />);
    expect(screen.getByRole('group', { name: 'Layihənin mərhələləri' })).toHaveStyle({
      gridTemplateColumns: 'repeat(2,minmax(0,1fr))',
    });
  });
});
