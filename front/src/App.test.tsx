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

  it('never uses dangerouslySetInnerHTML or inline event-handler attributes', () => {
    const { container } = render(<App />);
    expect(container.innerHTML).not.toMatch(/\son[a-z]+="/i);
    expect(container.querySelector('script')).toBeNull();
  });
});
