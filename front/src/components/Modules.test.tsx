import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MODULES } from '../content/modules';
import Modules from './Modules';

describe('Modules', () => {
  it('shows all six modules collapsed', () => {
    render(<Modules />);
    for (const module of MODULES) expect(screen.getByText(module.title)).toBeInTheDocument();
    for (const button of screen.getAllByRole('button'))
      expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(MODULES[0].topics[0])).not.toBeInTheDocument();
  });

  it('expands one module at a time to show its topics', async () => {
    render(<Modules />);
    const buttons = screen.getAllByRole('button', { name: /Mövzular/ });
    await userEvent.click(buttons[0]);
    for (const topic of MODULES[0].topics) expect(screen.getByText(topic)).toBeInTheDocument();

    await userEvent.click(buttons[1]);
    expect(screen.queryByText(MODULES[0].topics[0])).not.toBeInTheDocument();
    expect(screen.getByText(MODULES[1].topics[0])).toBeInTheDocument();
  });

  it('collapses an open module when its button is pressed again', async () => {
    render(<Modules />);
    await userEvent.click(screen.getAllByRole('button', { name: /Mövzular/ })[2]);
    await userEvent.click(screen.getByRole('button', { name: /Bağla/ }));
    expect(screen.queryByText(MODULES[2].topics[0])).not.toBeInTheDocument();
  });
});
