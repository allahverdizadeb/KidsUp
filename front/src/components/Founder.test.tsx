import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Founder from './Founder';

describe('Founder', () => {
  it('introduces the founder with a photo and message', () => {
    render(<Founder />);
    expect(screen.getByRole('heading', { name: 'Babək Allahverdizadə' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Babək Allahverdizadə' })).toHaveAttribute(
      'src',
      '/assets/babek.jpeg',
    );
    expect(screen.getByText(/Wharton məktəbinin/)).toBeInTheDocument();
  });

  it('opens every external link in a new tab without leaking window.opener', () => {
    render(<Founder />);
    const external = screen.getAllByRole('link').filter((a) => a.getAttribute('target') === '_blank');
    expect(external).toHaveLength(2);
    for (const link of external) {
      expect(link.getAttribute('href')).toMatch(/^https:\/\//);
      expect(link.getAttribute('rel')).toContain('noopener');
    }
  });
});
