import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { setViewportWidth } from '../test/viewport';
import Header from './Header';

describe('Header', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows the full navigation on desktop and no menu button', () => {
    setViewportWidth(1440);
    render(<Header />);
    expect(screen.getByRole('navigation', { name: 'Əsas menyu' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /menyu/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Müraciət et' })[0]).toHaveAttribute('href', '#muraciet');
  });

  it('collapses into a toggleable mobile menu below 1240px', async () => {
    setViewportWidth(800);
    render(<Header />);
    expect(screen.queryByRole('navigation', { name: 'Əsas menyu' })).not.toBeInTheDocument();

    const toggle = screen.getByRole('button', { name: 'Menyunu aç' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Menyunu bağla' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('navigation', { name: 'Mobil menyu' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('link', { name: 'Qiymət' }));
    expect(screen.queryByRole('navigation', { name: 'Mobil menyu' })).not.toBeInTheDocument();
  });

  it('closes the mobile menu with Escape', async () => {
    setViewportWidth(800);
    render(<Header />);
    await userEvent.click(screen.getByRole('button', { name: 'Menyunu aç' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('navigation', { name: 'Mobil menyu' })).not.toBeInTheDocument();
  });

  it('highlights the nav item of the section under the header while scrolling', () => {
    setViewportWidth(1440);
    for (const id of ['oyrenecek', 'modullar']) {
      const section = document.createElement('section');
      section.id = id;
      section.getBoundingClientRect = () => ({ top: id === 'oyrenecek' ? -300 : 50 }) as DOMRect;
      document.body.appendChild(section);
    }
    render(<Header />);
    fireEvent.scroll(window);
    expect(screen.getByRole('link', { name: 'Proqram' })).toHaveStyle({ color: '#FF0083' });
    expect(screen.getByRole('link', { name: 'Qiymət' })).toHaveStyle({ color: '#1A1A1A' });
  });

  it('highlights nothing once the application section is reached', () => {
    setViewportWidth(1440);
    const apply = document.createElement('section');
    apply.id = 'muraciet';
    apply.getBoundingClientRect = () => ({ top: 0 }) as DOMRect;
    document.body.appendChild(apply);
    render(<Header />);
    fireEvent.scroll(window);
    expect(screen.getByRole('link', { name: 'Proqram' })).toHaveStyle({ color: '#1A1A1A' });
  });
});
