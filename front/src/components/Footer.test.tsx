import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setReducedMotion, setViewportWidth } from '../test/viewport';
import Footer from './Footer';

const rocket = (container: HTMLElement) =>
  container.querySelector('g[stroke-linejoin="round"]') as SVGGElement;

describe('Footer', () => {
  beforeEach(() => {
    setViewportWidth(1440);
    setReducedMotion(false);
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout'] });
  });
  afterEach(() => vi.useRealTimers());

  it('shows the contact links', () => {
    render(<Footer />);
    expect(screen.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute(
      'href',
      'https://wa.me/994509988707',
    );
    expect(screen.getByRole('link', { name: '+994 50 998 87 07' })).toHaveAttribute(
      'href',
      'tel:+994509988707',
    );
  });

  it('flies the rocket along its path while animations are on', () => {
    const { container } = render(<Footer />);
    expect(rocket(container).getAttribute('transform')).toBe('translate(-200 130)');
    vi.advanceTimersByTime(100);
    const first = rocket(container).getAttribute('transform');
    expect(first).toMatch(/^translate\(.+\) rotate\(.+\) scale\(1\)$/);
    vi.advanceTimersByTime(500);
    expect(rocket(container).getAttribute('transform')).not.toBe(first);
  });

  it('scales the rocket down on narrow footers', () => {
    setViewportWidth(500);
    const { container } = render(<Footer />);
    vi.advanceTimersByTime(100);
    expect(rocket(container).getAttribute('transform')).toMatch(/scale\(0\.72\)$/);
  });

  it('lets the visitor pause and resume the animation', async () => {
    const { container } = render(<Footer />);
    vi.advanceTimersByTime(100);
    const pause = screen.getByRole('button', { name: /Animasiyanı dayandır/ });
    expect(pause).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(pause);
    const resume = screen.getByRole('button', { name: /Animasiyanı davam etdir/ });
    expect(resume).toHaveAttribute('aria-pressed', 'true');
    const frozen = rocket(container).getAttribute('transform');
    vi.advanceTimersByTime(500);
    expect(rocket(container).getAttribute('transform')).toBe(frozen);

    fireEvent.click(resume);
    vi.advanceTimersByTime(500);
    expect(rocket(container).getAttribute('transform')).not.toBe(frozen);
  });

  it('draws a single still frame and hides the pause button for reduced motion', () => {
    setReducedMotion(true);
    const { container } = render(<Footer />);
    expect(screen.queryByRole('button', { name: /Animasiya/ })).not.toBeInTheDocument();
    vi.advanceTimersByTime(100);
    const still = rocket(container).getAttribute('transform');
    expect(still).toMatch(/^translate\(/);
    vi.advanceTimersByTime(2000);
    expect(rocket(container).getAttribute('transform')).toBe(still);
  });

  it('brightens the scene while hovered with a mouse, not with touch', () => {
    const { container } = render(<Footer />);
    const footer = container.querySelector('footer') as HTMLElement;
    const flame = () => container.querySelector('g > path[style*="opacity"]') as SVGPathElement;
    expect(flame()).toHaveStyle({ opacity: '0.85' });

    fireEvent.pointerOver(footer, { pointerType: 'touch' });
    expect(flame()).toHaveStyle({ opacity: '0.85' });
    fireEvent.pointerOver(footer, { pointerType: 'mouse' });
    expect(flame()).toHaveStyle({ opacity: '1' });
    fireEvent.pointerOut(footer, { pointerType: 'mouse' });
    expect(flame()).toHaveStyle({ opacity: '0.85' });
  });

  it('draws fewer stars on narrow screens', () => {
    const starCount = (c: HTMLElement) => c.querySelectorAll('path[d^="M0 -5"]').length;
    const wide = render(<Footer />);
    const wideStars = starCount(wide.container);
    wide.unmount();
    setViewportWidth(500);
    const narrow = render(<Footer />);
    expect(starCount(narrow.container)).toBeLessThan(wideStars);
  });

  it('stops animating and cleans up when unmounted', () => {
    const { unmount } = render(<Footer />);
    vi.advanceTimersByTime(50);
    unmount();
    expect(() => vi.advanceTimersByTime(500)).not.toThrow();
  });
});
