import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';
import { setViewportWidth } from './test/viewport';

describe('App', () => {
  it('renders every section of the landing page in order', () => {
    setViewportWidth(1440);
    const { container } = render(<App />);
    const ids = Array.from(container.querySelectorAll('section[id]')).map((s) => s.id);
    expect(ids).toEqual([
      'top',
      'proqram',
      'oyrenecek',
      'ders',
      'yanasma',
      'modullar',
      'tapsiriq',
      'layihe',
      'demo-day',
      'sertifikat',
      'haqqimizda',
      'qiymet',
      'brosura',
      'suallar',
      'muraciet',
    ]);
    expect(container.querySelector('header')).toBeInTheDocument();
    expect(container.querySelector('footer')).toBeInTheDocument();
  });

  it('has exactly one h1 and every image has alternative text', () => {
    const { container } = render(<App />);
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    for (const img of container.querySelectorAll('img')) expect(img).toHaveAttribute('alt');
  });

  it('loads every image, script and frame from its own origin (SEC-F-03)', () => {
    const { container } = render(<App />);
    const sources = Array.from(
      container.querySelectorAll('[src], image[href]'),
      (element) => element.getAttribute('src') ?? element.getAttribute('href') ?? '',
    );
    expect(sources.length).toBeGreaterThan(0);
    // `data:` and `blob:` URLs have the origin "null", so they fail here too.
    for (const source of sources) {
      expect(new URL(source, window.location.href).origin, `${source} leaves the own origin`).toBe(
        window.location.origin,
      );
    }
  });

  it('has a target for every link that points inside the page', () => {
    const { container } = render(<App />);
    const links = Array.from(container.querySelectorAll('a[href^="#"]'), (a) => a.getAttribute('href') ?? '');
    expect(links).toContain('#mexfilik'); // the footer's link to the privacy notice
    for (const link of links.filter((href) => href !== '#')) {
      expect(document.getElementById(link.slice(1)), `${link} points at nothing`).not.toBeNull();
    }
  });

  it('never uses dangerouslySetInnerHTML or inline event-handler attributes', () => {
    const { container } = render(<App />);
    expect(container.innerHTML).not.toMatch(/\son[a-z]+="/i);
    expect(container.querySelector('script')).toBeNull();
  });
});
