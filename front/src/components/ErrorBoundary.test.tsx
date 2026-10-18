import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ErrorBoundary from './ErrorBoundary';

function Exploding(): never {
  throw new Error('secret internal detail: db password is hunter2');
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // React logs caught render errors; keep the test output clean.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('renders its children when nothing fails', () => {
    render(
      <ErrorBoundary>
        <p>all good</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('all good')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('replaces a crashing tree with a safe fallback that leaks nothing', () => {
    const { container } = render(
      <ErrorBoundary>
        <Exploding />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Səhifəni göstərmək mümkün olmadı');
    expect(container.textContent).not.toMatch(/secret|hunter2|Error|stack/i);
  });

  it('still offers a way to contact the team, with safe external links', () => {
    render(
      <ErrorBoundary>
        <Exploding />
      </ErrorBoundary>,
    );
    const whatsapp = screen.getByRole('link', { name: 'WhatsApp' });
    expect(whatsapp).toHaveAttribute('href', 'https://wa.me/994509988707');
    expect(whatsapp).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('link', { name: '+994 50 998 87 07' })).toHaveAttribute(
      'href',
      'tel:+994509988707',
    );
  });
});
