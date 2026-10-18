import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import Certificate from './Certificate';

const openButton = () => screen.getByRole('button', { name: 'Sertifikat nümunəsini böyüt' });

describe('Certificate', () => {
  it('shows the sample certificate with the dialog closed', () => {
    render(<Certificate />);
    expect(screen.getByRole('img', { name: /sertifikatının nümunəsi$/ })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens a dialog, locks page scroll and moves focus to the close button', async () => {
    render(<Certificate />);
    await userEvent.click(openButton());
    expect(screen.getByRole('dialog', { name: 'Sertifikat nümunəsi' })).toHaveAttribute('aria-modal', 'true');
    expect(document.body.style.overflow).toBe('hidden');
    expect(screen.getByRole('button', { name: 'Bağla' })).toHaveFocus();
  });

  it('can be opened from the text button as well', async () => {
    render(<Certificate />);
    await userEvent.click(screen.getByRole('button', { name: 'Sertifikata yaxından bax' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('closes with Escape, restores scroll and returns focus to what opened it', async () => {
    render(<Certificate />);
    await userEvent.click(openButton());
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('');
    expect(openButton()).toHaveFocus();
  });

  it('closes via the close button and via the backdrop, but not when the image is clicked', async () => {
    render(<Certificate />);
    await userEvent.click(openButton());
    await userEvent.click(screen.getByRole('img', { name: /böyüdülmüş/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Bağla' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await userEvent.click(openButton());
    await userEvent.click(screen.getByRole('dialog'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps keyboard focus trapped on the close button', async () => {
    render(<Certificate />);
    await userEvent.click(openButton());
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Bağla' })).toHaveFocus();
  });

  it('never leaves the page scroll-locked if it unmounts while open', async () => {
    const { unmount } = render(<Certificate />);
    await userEvent.click(openButton());
    unmount();
    expect(document.body.style.overflow).toBe('');
  });
});
